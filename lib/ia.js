import Anthropic from '@anthropic-ai/sdk';
import { HttpError } from './base.js';

// Lê o cronograma em HTML (feito pela equipe fora do portal) e devolve a lista de
// conteúdos do mês, para alimentar a visão geral, o calendário e o acompanhamento.
const MODELO = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const LIMITE_CARACTERES = 600_000;

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['posts', 'observacao'],
  properties: {
    observacao: { type: 'string' },
    posts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['data', 'horario', 'formato', 'pilar', 'titulo', 'gancho', 'roteiro', 'legenda'],
        properties: {
          data: { type: 'string', format: 'date' },
          horario: { type: 'string' },
          formato: { type: 'string', enum: ['reel', 'carrossel', 'estatico', 'story'] },
          pilar: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          titulo: { type: 'string' },
          gancho: { type: 'string' },
          roteiro: { type: 'string' },
          legenda: { type: 'string' },
        },
      },
    },
  },
};

const INSTRUCOES = `Você lê cronogramas mensais de conteúdo para Instagram que uma agência de marketing para a área da saúde entrega aos clientes como página HTML, e transforma cada conteúdo programado em um registro.

Os conteúdos podem estar no texto visível da página ou em dados dentro de <script> (listas em JavaScript ou JSON). Considere os dois.

Regras:
- Um registro por conteúdo com data marcada no mês: reels, carrosséis, posts estáticos e stories que tenham um dia específico. Rotinas genéricas de stories ("todos os dias…") não viram registros.
- data no formato AAAA-MM-DD. Se o cronograma mostrar só dia e mês, use o ano do mês de referência.
- formato: reel (vídeo, reels, trend), carrossel, estatico (post de foto ou arte única) ou story.
- pilar: quando o cronograma indicar o pilar ou a editoria do conteúdo, use exatamente o nome correspondente da lista de pilares do cliente; se não houver correspondência clara, null.
- titulo: o tema ou título do conteúdo. gancho: a fala de abertura, o texto da capa ou a chamada. roteiro: o roteiro ou o direcionamento. legenda: a legenda, se houver.
- Copie os textos como estão no cronograma, sem resumir nem reescrever. Campo que não existir no cronograma fica como texto vazio. Não invente conteúdos.
- observacao: uma frase curta em português sobre a leitura (por exemplo, quantos conteúdos encontrou ou algo que não ficou claro).`;

// Tira do HTML o que não traz informação (estilos, imagens embutidas, comentários)
// para caber melhor na leitura, mantendo o texto e os scripts com dados.
export function limparHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, 'data:…')
    .replace(/\s+style="[^"]*"/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n');
}

function exigirChave() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new HttpError(400, 'Para a leitura automática, cadastre a variável ANTHROPIC_API_KEY na Vercel (Settings → Environment Variables) e faça um novo deploy. A mesma chave da Spice Cronogramas serve.');
  }
}

// Chamada única ao Claude com saída em JSON validada pelo esquema.
async function pedirJson({ system, content, schema, maxTokens = 64000 }) {
  const client = new Anthropic();
  let mensagem;
  try {
    const stream = client.beta.messages.stream({
      model: MODELO,
      max_tokens: maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content }],
    });
    mensagem = await stream.finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new HttpError(400, 'A chave ANTHROPIC_API_KEY cadastrada na Vercel não é válida.');
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, 'Muitas leituras ao mesmo tempo. Tente de novo em um minuto.');
    if (err instanceof Anthropic.APIError) throw new HttpError(502, `Não foi possível fazer a leitura agora (${err.status ?? 'erro'}). Tente de novo.`);
    throw err;
  }
  if (mensagem.stop_reason === 'refusal') throw new HttpError(422, 'A leitura automática recusou este arquivo. Confira o conteúdo.');
  if (mensagem.stop_reason === 'max_tokens') throw new HttpError(422, 'O arquivo tem conteúdo demais para uma leitura só.');
  const texto = mensagem.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try {
    return JSON.parse(texto);
  } catch {
    throw new HttpError(502, 'A leitura voltou num formato inesperado. Tente de novo.');
  }
}

export async function lerPostsDoHtml({ html, mes, pilares = [] }) {
  exigirChave();
  const conteudo = limparHtml(html);
  if (conteudo.length > LIMITE_CARACTERES) {
    throw new HttpError(413, 'O HTML é grande demais para ser lido automaticamente. Deixe as imagens em links externos em vez de dentro do arquivo.');
  }
  const resultado = await pedirJson({
    system: INSTRUCOES,
    schema: ESQUEMA,
    content: `Mês de referência: ${mes}.\nPilares do cliente: ${pilares.length ? pilares.map((p) => p.nome).join(' | ') : '(não cadastrados)'}\n\n<cronograma>\n${conteudo}\n</cronograma>`,
  });
  if (!Array.isArray(resultado.posts)) throw new HttpError(502, 'A leitura do cronograma voltou num formato inesperado. Tente de novo.');
  return resultado;
}

const ESQUEMA_PERFIL = {
  type: 'object',
  additionalProperties: false,
  required: ['usuario', 'nome', 'posts', 'seguidores', 'seguindo', 'bio', 'link', 'destaques'],
  properties: {
    usuario: { type: 'string' },
    nome: { type: 'string' },
    posts: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    seguidores: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    seguindo: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    bio: { type: 'string' },
    link: { type: 'string' },
    destaques: { type: 'array', items: { type: 'string' } },
  },
};

// Lê o print de um perfil do Instagram e devolve os números, a bio e os destaques.
export async function lerPerfilDoPrint({ imagem, tipo }) {
  exigirChave();
  return pedirJson({
    maxTokens: 8000,
    schema: ESQUEMA_PERFIL,
    system: `Você lê prints (capturas de tela) de perfis do Instagram e transcreve os dados visíveis.
- posts, seguidores e seguindo como números inteiros. Converta abreviações: "2.985" é 2985; "12,5 mil" ou "12.5K" é 12500. Se não aparecer, null.
- bio: o texto da bio exatamente como está, com as quebras de linha e emojis. Não inclua a categoria do perfil nem o link.
- link: o link que aparece na bio, sem "https://". Vazio se não houver.
- destaques: os nomes dos destaques (stories fixados), na ordem em que aparecem.
- usuario: o @ sem a arroba. nome: o nome exibido.
- Transcreva só o que está no print. Campo que não aparece fica vazio.`,
    content: [
      { type: 'image', source: { type: 'base64', media_type: tipo, data: imagem.toString('base64') } },
      { type: 'text', text: 'Transcreva os dados deste perfil.' },
    ],
  });
}
