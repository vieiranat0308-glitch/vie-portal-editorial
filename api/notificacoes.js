import { handler, metodo, HttpError, getRedis, keys, iguaisSeguro } from '../lib/base.js';
import { chavesVapid, inscricaoValida, inscrever, cancelar, avisar, avisarCliente, avisarEquipe, emailsDoCliente } from '../lib/push.js';
import { enviarEmail } from '../lib/email.js';
import { temInterativo } from './cronograma.js';
import { nomeDoMes } from '../public/js/regras.js';

// Notificações push: ativar/desativar no aparelho, teste e a rotina diária
// (chamada pelo agendamento da Vercel, configurado em vercel.json).
export default handler(async (req, res, usuario) => {
  metodo(req, 'GET', 'POST');

  if (req.query.rotina) {
    if (!chamadaDoAgendamento(req)) throw new HttpError(401, 'Só o agendamento da Vercel chama esta rotina.');
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
    return res.status(200).json(await rotinaDoDia(host ? `https://${host}` : ''));
  }
  if (!usuario) throw new HttpError(401, 'Faça login para continuar.');

  if (req.method === 'GET') return res.status(200).json({ chavePublica: (await chavesVapid()).publicKey });

  const corpo = req.body || {};
  switch (corpo.acao) {
    case 'inscrever':
      if (!inscricaoValida(corpo.inscricao)) throw new HttpError(400, 'Inscrição inválida.');
      await inscrever(usuario.email, corpo.inscricao);
      return res.status(200).json({ ok: true });
    case 'cancelar':
      await cancelar(usuario.email, String(corpo.endpoint || ''));
      return res.status(200).json({ ok: true });
    case 'testar': {
      const enviados = await avisar([usuario.email], { titulo: 'Notificações ativadas ✓', corpo: 'É assim que os avisos do portal da Vie vão chegar.', url: '/' });
      if (!enviados) throw new HttpError(400, 'Nenhum aparelho com notificações ativadas nesta conta.');
      return res.status(200).json({ enviados });
    }
    default:
      throw new HttpError(400, 'Ação desconhecida.');
  }
}, { publico: true });

// A Vercel manda "Authorization: Bearer <CRON_SECRET>" quando a variável existe.
function chamadaDoAgendamento(req) {
  const segredo = process.env.CRON_SECRET;
  if (segredo) return iguaisSeguro(req.headers.authorization, `Bearer ${segredo}`);
  return /vercel-cron/i.test(String(req.headers['user-agent'] || ''));
}

const hojeEmSaoPaulo = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const somarMes = (mes, n) => {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
const EMPRESA = 'Vie Company';
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const dataPorExtenso = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return `${DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
};
const lista = (itens) => (itens.length > 1 ? `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}` : itens[0] || '');
const aspas = (t) => `“${String(t || '').slice(0, 60)}${String(t || '').length > 60 ? '…' : ''}”`;

// Uma vez por dia (de manhã): o que o cliente grava hoje e o que está esperando aprovação.
export async function rotinaDoDia(portal = '') {
  const redis = getRedis();
  const hoje = hojeEmSaoPaulo();
  // Mesmo que o agendamento rode duas vezes, os avisos saem uma vez só.
  if (!(await redis.set(keys.rotinaDoDia(hoje), 1, { nx: true, ex: 60 * 60 * 36 }))) return { hoje, jaRodou: true };
  const mes = hoje.slice(0, 7);
  const amanha = new Date(Date.parse(`${hoje}T12:00:00Z`) + 864e5).toISOString().slice(0, 10);
  const clientes = Object.values((await redis.hgetall(keys.clientes)) || {}).filter((c) => c.ativo !== false);
  let enviados = 0;
  for (const c of clientes) {
    const docs = (await Promise.all([mes, somarMes(mes, 1)].map((m) => redis.get(keys.cronograma(c.id, m))))).filter((d) => d?.status === 'publicado');
    const doMes = docs.find((d) => d.mes === mes);
    const base = `/#/c/${encodeURIComponent(c.id)}`;

    // O que o cliente grava hoje (o que a Vie publica não entra aqui).
    const deHoje = (doMes?.posts || []).filter((p) => p.data === hoje && p.trilha !== 'vie' && !['gravado', 'postado'].includes(p.status));
    const stories = deHoje.filter((p) => p.formato === 'story');
    const reels = deHoje.filter((p) => p.formato === 'reel');
    const feed = deHoje.filter((p) => ['carrossel', 'estatico'].includes(p.formato));
    if (stories.length) enviados += await avisarCliente(c.id, { titulo: 'Grave seu story de hoje 🎬', corpo: stories.map((p) => p.titulo).filter(Boolean).slice(0, 2).join(' · ') || 'O roteiro está no seu cronograma.', url: `${base}/cronograma/${mes}`, tag: `story-${hoje}` });
    if (reels.length) enviados += await avisarCliente(c.id, { titulo: 'Grave o reels de hoje 🎥', corpo: lista(reels.map((p) => aspas(p.titulo))), url: `${base}/cronograma/${mes}`, tag: `reels-${hoje}` });
    if (feed.length) enviados += await avisarCliente(c.id, { titulo: 'Hoje tem post no seu cronograma', corpo: lista(feed.map((p) => aspas(p.titulo))), url: `${base}/cronograma/${mes}`, tag: `feed-${hoje}` });

    // Véspera da produção de conteúdo: aviso no app e por e-mail para o cliente, e no app da equipe.
    const producoes = (await redis.get(keys.producoes(c.id))) || [];
    const deAmanha = producoes.filter((p) => p.data === amanha && p.lembrete !== amanha);
    for (const p of deAmanha) {
      const quando = [dataPorExtenso(p.data), p.hora ? `às ${p.hora.replace(':00', 'h').replace(':', 'h')}` : ''].filter(Boolean).join(' ');
      enviados += await avisarCliente(c.id, { titulo: 'Amanhã é o dia da sua produção de conteúdo! 📸', corpo: [quando, p.local].filter(Boolean).join(' · '), url: base, tag: `producao-${p.id}` });
      enviados += await enviarEmail(await emailsDoCliente(c.id), {
        empresa: EMPRESA,
        assunto: 'Amanhã é o dia da sua produção de conteúdo!',
        titulo: 'Amanhã é o dia da sua produção de conteúdo! 📸',
        saudacao: `Oi! Passando para lembrar da produção de conteúdo de ${c.nome}.`,
        texto: 'Separe os looks e o que combinamos no moodboard. Qualquer dúvida, é só chamar a equipe.',
        linhas: [['Quando', quando], ['Local', p.local], ['Observações', p.observacoes]],
        botao: 'Ver no portal',
        link: portal ? `${portal}${base}` : '',
      });
      await avisarEquipe({ titulo: `Amanhã: produção de ${c.nome}`, corpo: [quando, p.local].filter(Boolean).join(' · '), url: base }, c.id);
      p.lembrete = amanha;
    }
    if (deAmanha.length) await redis.set(keys.producoes(c.id), producoes);

    // Aprovações pendentes (do mês e do próximo, se já liberado), moodboards e datas sazonais.
    const [moodboards, sazonais] = await Promise.all([redis.get(keys.moodboards(c.id)), redis.get(keys.sazonal(c.id))]);
    const extras = [...(moodboards || []), ...(sazonais || [])].filter((i) => i.status === 'aprovacao').length;
    const conteudos = extras + docs.reduce((n, d) => n + d.posts.filter((p) => p.status === 'aprovacao' && p.origem !== 'html').length, 0);
    const meses = docs.filter((d) => temInterativo(d) && !['aprovado', 'ajuste'].includes(d.aprovacaoMes?.status)).map((d) => nomeDoMes(d.mes).split(' ')[0].toLowerCase());
    if (conteudos || meses.length) {
      const partes = [conteudos ? `${conteudos} ${conteudos === 1 ? 'item esperando' : 'itens esperando'} a sua aprovação` : '', meses.length ? `o cronograma de ${lista(meses)}` : ''].filter(Boolean);
      enviados += await avisarCliente(c.id, { titulo: 'Tem cronograma para você aprovar! ✨', corpo: `${lista(partes).replace(/^./, (l) => l.toUpperCase())}.`, url: `${base}/aprovacao`, tag: `aprovar-${hoje}` });
    }
  }
  return { hoje, clientes: clientes.length, enviados };
}
