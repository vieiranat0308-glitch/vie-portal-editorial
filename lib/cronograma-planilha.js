// Leitura da planilha de cronograma da Vie (Google Planilhas, .xlsx, .csv ou a
// página .html exportada), sem IA e sem custo. Colunas reconhecidas pelo cabeçalho:
// data (a coluna antes de "Formato"), Formato, Conteúdo, Copy para arte, Imagem,
// Legenda e OBS. A data vem só na primeira linha do dia; as seguintes herdam.
// A coluna Imagem traz os links do Drive de cada arte ou vídeo.
import { lerXlsx, dataDoExcel } from './xlsx.js';

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
const limpar = (t) => String(t || '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#'
    ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
    : ENTIDADES[e.toLowerCase()] ?? m))
  .replace(/[ \t]+/g, ' ')
  .replace(/ *\n */g, '\n')
  .trim();
const normal = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Tabelas de uma página HTML (exportação do Google Planilhas), respeitando células mescladas.
function tabelasHtml(html) {
  return [...String(html).matchAll(/<table\b[\s\S]*?<\/table>/gi)].map(([tabela]) => {
    const grade = [];
    const ocupadas = {};
    [...tabela.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].forEach(([, tr], l) => {
      const linha = (grade[l] ||= []);
      let c = 0;
      // Só as células de dados: os números de linha/coluna da exportação são <th>.
      for (const [, atributos, conteudo] of tr.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)) {
        while (ocupadas[`${l}:${c}`]) { linha[c] = ''; c++; }
        const linhas = Number((atributos.match(/rowspan="(\d+)"/) || [])[1] || 1);
        const colunas = Number((atributos.match(/colspan="(\d+)"/) || [])[1] || 1);
        linha[c] = limpar(conteudo);
        for (let i = 0; i < linhas; i++) for (let j = 0; j < colunas; j++) if (i || j) ocupadas[`${l + i}:${c + j}`] = true;
        c += colunas;
      }
    });
    return grade.map((l) => Array.from(l, (x) => x ?? ''));
  });
}

function tabelaCsv(texto) {
  const linhas = [];
  let linha = [''];
  let aspas = false;
  const sep = (texto.split('\n')[0].match(/;/g) || []).length > (texto.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') { linha[linha.length - 1] += '"'; i++; } else if (ch === '"') aspas = false;
      else linha[linha.length - 1] += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) linha.push('');
    else if (ch === '\n') { linhas.push(linha); linha = ['']; } else if (ch !== '\r') linha[linha.length - 1] += ch;
  }
  linhas.push(linha);
  return [linhas];
}

// Lê o arquivo e devolve as tabelas (cada uma é uma lista de linhas).
export function tabelasDoArquivo(buf) {
  const b = Buffer.from(buf);
  if (b[0] === 0x50 && b[1] === 0x4b) return lerXlsx(b).map((a) => a.linhas);
  const texto = b.toString('utf8').replace(/^﻿/, '');
  if (/<table\b/i.test(texto)) return tabelasHtml(texto);
  if (/^\s*</.test(texto)) throw new Error('Não encontrei uma tabela nesse arquivo.');
  return tabelaCsv(texto);
}

const COLUNAS = {
  formato: /^formato/,
  conteudo: /^(conteudo|pauta|tema|assunto|pilar)/,
  copy: /^(copy|texto)/,
  imagem: /^(imagem|arte|midia|link|video|criativo|arquivo)/,
  legenda: /^legenda/,
  obs: /^(obs|observ)/,
  data: /^(data|dia)$/,
};

function cabecalho(linhas) {
  for (let i = 0; i < Math.min(linhas.length, 30); i++) {
    const nomes = linhas[i].map(normal);
    const formato = nomes.findIndex((n) => COLUNAS.formato.test(n));
    if (formato < 0) continue;
    const col = {};
    Object.entries(COLUNAS).forEach(([k, re]) => { const j = nomes.findIndex((n) => re.test(n)); if (j >= 0) col[k] = j; });
    // Sem título na coluna da data: é a coluna logo antes de "Formato".
    if (col.data == null) col.data = formato > 0 ? formato - 1 : 0;
    return { linha: i, col };
  }
  return null;
}

function dataDe(valor, mes) {
  const v = String(valor || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{5}$/.test(v) && Number(v) > 40000 && Number(v) < 60000) return dataDoExcel(v);
  const m = v.match(/^(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{2,4}))?/);
  if (!m) return null;
  const [anoRef, mesRef] = mes.split('-').map(Number);
  const dia = Number(m[1]);
  const mesPost = Number(m[2]);
  if (dia < 1 || dia > 31 || mesPost < 1 || mesPost > 12) return null;
  let ano = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : anoRef;
  if (!m[3]) ano = mesRef === 12 && mesPost === 1 ? anoRef + 1 : mesRef === 1 && mesPost === 12 ? anoRef - 1 : anoRef;
  return `${ano}-${String(mesPost).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function formatoDe(rotulo) {
  const t = normal(rotulo);
  if (/stor(y|ies)/.test(t)) return 'story';
  if (/reel/.test(t)) return 'reel';
  if (/carross/.test(t)) return 'carrossel';
  if (/feed|estatico|post|foto|arte|imagem/.test(t)) return 'estatico';
  if (/video/.test(t)) return 'reel';
  return null;
}

// Links do Drive viram mídia (prévia no portal); outros links, referências.
export function idDoDrive(url) {
  const m = String(url).match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]{20,})/)
    || String(url).match(/docs\.google\.com\/(?:presentation|document)\/d\/([\w-]{20,})/);
  return m ? m[1] : null;
}
const URLS = /https?:\/\/[^\s"'<>,;)]+/g;

function quebraSlides(t) {
  return String(t || '').replace(/\s*(Slide \d+\s*:)/gi, '\n$1').trim();
}

const curto = (t, n = 90) => {
  const linha = String(t || '').split('\n').find((l) => l.trim()) || '';
  const limpo = linha.replace(/^slide \d+\s*:\s*/i, '').trim();
  return limpo.length > n ? `${limpo.slice(0, n - 1).trim()}…` : limpo;
};

// Devolve os conteúdos da planilha. `pilares` ajuda a reconhecer o pilar na coluna Conteúdo.
export function lerPlanilha(buf, mes, pilares = []) {
  const nomesPilares = new Set(pilares.map((p) => normal(p.nome)));
  const posts = [];
  for (const linhas of tabelasDoArquivo(buf)) {
    const cab = cabecalho(linhas);
    if (!cab) continue;
    const { col } = cab;
    const v = (l, k) => (col[k] == null ? '' : String(l[col[k]] ?? '').trim());
    let data = null;
    let ultimoStory = null; // stories seguidos do mesmo dia viram um conteúdo só
    const contagem = {};
    for (const l of linhas.slice(cab.linha + 1)) {
      const novaData = dataDe(v(l, 'data'), mes);
      if (novaData) data = novaData;
      const formato = formatoDe(v(l, 'formato'));
      if (!data || !formato) continue;
      const conteudo = v(l, 'conteudo');
      const copy = v(l, 'copy');
      const imagem = v(l, 'imagem');
      const legenda = v(l, 'legenda');
      const obs = v(l, 'obs');

      // "Pilar: Educação Capilar | Tema do post" ou só o nome do pilar.
      let pilar = '';
      let tema = '';
      let direcao = '';
      const comPilar = conteudo.match(/^pilar\s*:\s*([^|]+)\|?\s*([\s\S]*)$/i);
      if (comPilar) { pilar = comPilar[1].trim(); tema = comPilar[2].trim(); } else if (nomesPilares.has(normal(conteudo)) || (conteudo && conteudo.length <= 40 && !/[.!?]$/.test(conteudo) && copy)) pilar = conteudo;
      else direcao = conteudo;

      const links = imagem.match(URLS) || [];
      const midia = links.map(idDoDrive).filter(Boolean).map((id) => ({ id }));
      const descricaoImagem = imagem.replace(URLS, '').trim();
      const refs = (obs.match(URLS) || []).concat(links.filter((u) => !idDoDrive(u)));

      // Stories do mesmo dia viram um conteúdo só, com as telas em sequência.
      const anterior = ultimoStory;
      if (formato === 'story' && anterior && anterior.data === data) {
        anterior._telas.push(copy || descricaoImagem);
        if (direcao) anterior.roteiro += `\nDireção: ${direcao}`;
        anterior.midia.push(...midia.filter((m) => !anterior.midia.some((x) => x.id === m.id)));
        anterior.roteiro = [anterior._telas.map((t, i) => `Story ${i + 1}: ${t || '—'}`).join('\n'), ...anterior.roteiro.split('\n').filter((l) => /^(Direção|Imagem):/.test(l))].join('\n');
        if (obs) anterior.notaInterna = [anterior.notaInterna, obs].filter(Boolean).join('\n');
        anterior.referencias.push(...refs.map((url) => ({ rotulo: 'Referência', url })));
        continue;
      }
      const n = (contagem[`${data}|${formato}`] = (contagem[`${data}|${formato}`] || 0) + 1);
      const telas = formato === 'story' ? [copy || descricaoImagem] : [];
      posts.push({
        chave: `${data}|${formato}|${n}`,
        data,
        horario: '',
        formato: formato === 'estatico' && midia.length > 1 ? 'carrossel' : formato,
        pilar,
        titulo: curto(tema.split(/(?<=[.!?])\s/)[0]) || curto(copy) || curto(legenda) || `${{ story: 'Stories', reel: 'Reels', carrossel: 'Carrossel', estatico: 'Post' }[formato]} do dia`,
        gancho: formato === 'carrossel' ? curto(copy, 300) : copy,
        roteiro: [
          tema && tema !== curto(tema.split(/(?<=[.!?])\s/)[0]) ? `Pauta: ${tema}` : '',
          formato === 'story' ? `Story 1: ${telas[0] || '—'}` : formato === 'carrossel' ? quebraSlides(copy) : '',
          direcao ? `Direção: ${direcao}` : '',
          descricaoImagem ? `Imagem: ${descricaoImagem}` : '',
        ].filter(Boolean).join('\n\n'),
        legenda,
        notaInterna: obs,
        referencias: refs.map((url) => ({ rotulo: 'Referência', url })),
        midia,
        _telas: telas,
      });
      ultimoStory = formato === 'story' ? posts.at(-1) : null;
    }
    if (posts.length) break; // usa a primeira aba que tem o cronograma
  }
  return posts.map(({ _telas, ...p }) => p);
}

// Endereço para baixar a planilha a partir do link colado (precisa estar
// compartilhada como "Qualquer pessoa com o link").
export function enderecoDeDownload(link) {
  const url = String(link || '').trim();
  const planilha = url.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]{20,})/);
  if (planilha) return `https://docs.google.com/spreadsheets/d/${planilha[1]}/export?format=xlsx`;
  const arquivo = idDoDrive(url);
  if (arquivo) return `https://drive.usercontent.google.com/download?id=${arquivo}&export=download&confirm=t`;
  return null;
}
