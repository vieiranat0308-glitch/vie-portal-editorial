// Conteúdo pronto da Vie lido direto das pastas do Google Drive (sem planilha).
// A pasta do mês tem uma subpasta por data ("22.10", "14/10", "22-10 Mesoterapia"…)
// com as artes e vídeos daquele dia. Vídeo vira reels, imagens viram carrossel
// (ou post único) e o que tiver "story" no nome vira stories.
//
// Pastas compartilhadas como "Qualquer pessoa com o link" são lidas sem custo:
// pela API oficial do Google quando há a chave GOOGLE_API_KEY (opcional, gratuita)
// ou, sem chave, pela página pública de listagem da pasta.

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
const limpar = (t) => String(t || '').replace(/<[^>]+>/g, '')
  .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#'
    ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
    : ENTIDADES[e.toLowerCase()] ?? m))
  .trim();
const normal = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export class ErroDrive extends Error {}

export function idDaPasta(link) {
  const m = String(link || '').match(/drive\.google\.com\/(?:drive\/(?:u\/\d+\/)?folders\/|open\?id=|embeddedfolderview\?id=)([\w-]{10,})/);
  return m ? m[1] : null;
}

const EXTENSOES = {
  imagem: /\.(jpe?g|png|webp|gif|heic|heif|tiff?|bmp)$/i,
  video: /\.(mp4|mov|m4v|webm|avi|mkv|3gp)$/i,
  texto: /\.(txt|md)$/i,
};

function tipoDe(mime, nome) {
  const m = String(mime || '');
  if (m === 'application/vnd.google-apps.folder') return 'pasta';
  if (m === 'application/vnd.google-apps.document') return 'doc';
  if (m.startsWith('image/')) return 'imagem';
  if (m.startsWith('video/')) return 'video';
  if (m === 'text/plain') return 'texto';
  for (const [tipo, re] of Object.entries(EXTENSOES)) if (re.test(nome)) return tipo;
  return 'outro';
}

async function buscar(url, como = 'text') {
  let r;
  try {
    r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
  } catch {
    throw new ErroDrive('Não consegui falar com o Google Drive agora. Tente de novo em instantes.');
  }
  return { ok: r.ok, status: r.status, url: r.url, corpo: como === 'json' ? await r.json().catch(() => ({})) : await r.text() };
}

async function listarPelaApi(id, chave) {
  const itens = [];
  let pagina = '';
  do {
    const q = encodeURIComponent(`'${id}' in parents and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name,mimeType,shortcutDetails)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${encodeURIComponent(chave)}${pagina ? `&pageToken=${pagina}` : ''}`;
    const r = await buscar(url, 'json');
    if (!r.ok) {
      if (r.status === 404 || r.status === 403) throw new ErroDrive('A pasta não está aberta. No Drive, clique em Compartilhar → Acesso geral → “Qualquer pessoa com o link” (Leitor).');
      throw new ErroDrive(`O Google Drive recusou a leitura (${r.corpo?.error?.message || r.status}).`);
    }
    for (const f of r.corpo.files || []) {
      // Atalho para outro arquivo: usa o arquivo de verdade.
      const alvo = f.shortcutDetails?.targetId ? { id: f.shortcutDetails.targetId, mimeType: f.shortcutDetails.targetMimeType } : f;
      itens.push({ id: alvo.id, nome: f.name, tipo: tipoDe(alvo.mimeType, f.name) });
    }
    pagina = r.corpo.nextPageToken || '';
  } while (pagina);
  return itens;
}

// Página pública da pasta (a mesma do "incorporar pasta" do Drive).
export function lerPaginaDaPasta(html) {
  const itens = [];
  for (const trecho of String(html).split(/class="flip-entry"/).slice(1)) {
    const id = (trecho.match(/id="entry-([\w-]+)"/) || [])[1] || (trecho.match(/\/(?:file\/d|folders|document\/d)\/([\w-]{10,})/) || [])[1];
    if (!id) continue;
    const nome = limpar((trecho.match(/class="flip-entry-title"[^>]*>([\s\S]*?)<\/div>/) || [])[1]);
    const href = (trecho.match(/href="([^"]+)"/) || [])[1] || '';
    const mime = (trecho.match(/\/type\/([\w.+-]+\/[\w.+-]+)/) || [])[1] || '';
    let tipo = tipoDe(mime, nome);
    if (/\/folders\//.test(href)) tipo = 'pasta';
    else if (/docs\.google\.com\/document\//.test(href)) tipo = 'doc';
    itens.push({ id, nome, tipo });
  }
  return itens;
}

async function listarPelaPagina(id) {
  const r = await buscar(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(id)}`);
  const itens = lerPaginaDaPasta(r.corpo);
  if (!itens.length && (!r.ok || /accounts\.google\.com|ServiceLogin|Sign in|Fazer login/i.test(r.url + r.corpo.slice(0, 3000)))) {
    throw new ErroDrive('A pasta não está aberta. No Drive, clique em Compartilhar → Acesso geral → “Qualquer pessoa com o link” (Leitor).');
  }
  return itens;
}

export function listarPasta(id) {
  const chave = process.env.GOOGLE_API_KEY;
  return chave ? listarPelaApi(id, chave) : listarPelaPagina(id);
}

// Data no nome da pasta ou do arquivo: "22.10", "22/10", "22-10", "22_10".
export function dataNoNome(nome, mes) {
  const m = String(nome).match(/(?:^|[^\d])(\d{1,2})\s*[./_-]\s*(\d{1,2})(?:\s*[./_-]\s*(\d{2,4}))?(?!\d)/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mesPost = Number(m[2]);
  if (dia < 1 || dia > 31 || mesPost < 1 || mesPost > 12) return null;
  const [anoRef, mesRef] = mes.split('-').map(Number);
  let ano = anoRef;
  if (m[3]) ano = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
  else if (mesRef === 12 && mesPost === 1) ano = anoRef + 1;
  else if (mesRef === 1 && mesPost === 12) ano = anoRef - 1;
  return `${ano}-${String(mesPost).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// Formato pelas palavras do caminho ("Stories", "Carrossel", "Reels", "Feed"…).
function formatoNoCaminho(caminho) {
  const t = normal(caminho);
  if (/stor(y|ies)/.test(t)) return 'story';
  if (/reel/.test(t)) return 'reel';
  if (/carross/.test(t)) return 'carrossel';
  if (/estatico|\bfeed\b|\bpost\b/.test(t)) return 'estatico';
  return null;
}

const ordemNatural = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true, sensitivity: 'base' });

// Nome da pasta sem a data e sem palavras de formato vira o título.
function tituloDoNome(nome) {
  const t = String(nome || '')
    .replace(/(?:^|\s)\d{1,2}\s*[./_-]\s*\d{1,2}(?:\s*[./_-]\s*\d{2,4})?/, ' ')
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/\b(stor(y|ies)|reels?|carrossel|feed|est[áa]tico|post)\b/gi, ' ')
    .replace(/^[\s\-–—_:|·.]+|[\s\-–—_:|·.]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return /[a-zà-ú]{3,}/i.test(t) ? t : '';
}

async function lerTexto(item) {
  const url = item.tipo === 'doc'
    ? `https://docs.google.com/document/d/${item.id}/export?format=txt`
    : `https://drive.usercontent.google.com/download?id=${item.id}&export=download&confirm=t`;
  try {
    const r = await buscar(url);
    if (!r.ok || /^\s*<(!doctype|html)/i.test(r.corpo)) return '';
    return r.corpo.replace(/^﻿/, '').trim().slice(0, 5000);
  } catch {
    return '';
  }
}

// Percorre a pasta do mês e devolve os conteúdos, um por data e formato.
export async function lerConteudosDoDrive(pastaId, mes, { listar = listarPasta, ler = lerTexto } = {}) {
  const arquivos = []; // { ...item, data, caminho: [nomes das pastas] }
  let pastasLidas = 0;
  async function percorrer(id, caminho, data, nivel) {
    if (pastasLidas++ > 120) throw new ErroDrive('A pasta tem subpastas demais. Use uma pasta por mês, com uma subpasta por data.');
    const itens = await listar(id);
    const subpastas = [];
    for (const item of itens) {
      const dataItem = dataNoNome(item.nome, mes) || data;
      if (item.tipo === 'pasta') { if (nivel < 3) subpastas.push([item.id, [...caminho, item.nome], dataItem]); } else if (dataItem) arquivos.push({ ...item, data: dataItem, caminho });
    }
    // Poucas por vez, para não sobrecarregar o Drive.
    for (let i = 0; i < subpastas.length; i += 6) {
      await Promise.all(subpastas.slice(i, i + 6).map(([sid, scaminho, sdata]) => percorrer(sid, scaminho, sdata, nivel + 1)));
    }
  }
  await percorrer(pastaId, [], null, 0);

  // Agrupa: mesma data + mesmo formato + mesma pasta = um conteúdo.
  const grupos = new Map();
  for (const a of arquivos.sort(ordemNatural)) {
    if (!['imagem', 'video', 'doc', 'texto'].includes(a.tipo)) continue;
    const pasta = a.caminho.at(-1) || '';
    let formato = formatoNoCaminho(`${a.caminho.join(' / ')} / ${a.nome}`);
    if (a.tipo === 'doc' || a.tipo === 'texto') formato = formato || '*';
    else if (!formato) formato = a.tipo === 'video' ? 'reel' : 'imagens';
    else if (formato === 'reel' && a.tipo === 'imagem') formato = 'capa-reel';
    // Cada vídeo de reels é um conteúdo; imagens da mesma pasta formam um carrossel.
    const separado = a.tipo === 'video' && formato === 'reel';
    const chave = `${a.data}|${formato}|${pasta}${separado ? `|${a.id}` : ''}`;
    if (!grupos.has(chave)) grupos.set(chave, { data: a.data, formato, pasta, arquivos: [], textos: [] });
    grupos.get(chave)[a.tipo === 'doc' || a.tipo === 'texto' ? 'textos' : 'arquivos'].push(a);
  }

  // Textos (Google Docs ou .txt) viram a legenda dos conteúdos do mesmo dia e pasta.
  const textos = [...grupos.values()].filter((g) => g.formato === '*' || !g.arquivos.length);
  const conteudos = [...grupos.values()].filter((g) => g.arquivos.length && g.formato !== '*');
  const formatoFinal = (c) => (c.formato === 'imagens' ? (c.arquivos.length > 1 ? 'carrossel' : 'estatico') : c.formato);
  // O texto vai para o conteúdo do formato citado no nome; senão, para o post do feed do dia.
  const preferencia = ['carrossel', 'estatico', 'reel', 'story'];
  for (const t of textos) {
    const doDia = conteudos.filter((c) => c.data === t.data && c.formato !== 'capa-reel');
    const mesmaPasta = doDia.filter((c) => c.pasta === t.pasta);
    const candidatos = mesmaPasta.length ? mesmaPasta : doDia;
    const alvo = (t.formato !== '*' && candidatos.find((c) => formatoFinal(c) === t.formato))
      || candidatos.slice().sort((a, b) => preferencia.indexOf(formatoFinal(a)) - preferencia.indexOf(formatoFinal(b)))[0];
    if (alvo) alvo.textos.push(...t.textos);
  }
  // Capa de reels vai junto com o vídeo do mesmo dia.
  for (const capa of conteudos.filter((c) => c.formato === 'capa-reel')) {
    const reel = conteudos.find((c) => c.data === capa.data && c.formato === 'reel');
    if (reel) { reel.arquivos.push(...capa.arquivos); capa.arquivos = []; } else capa.formato = 'imagens';
  }

  const contagem = {};
  const posts = [];
  for (const g of conteudos.filter((c) => c.arquivos.length).sort((a, b) => a.data.localeCompare(b.data))) {
    const imagens = g.arquivos.filter((a) => a.tipo === 'imagem').length;
    const formato = g.formato === 'imagens' ? (imagens > 1 ? 'carrossel' : 'estatico') : g.formato;
    const n = (contagem[`${g.data}|${formato}`] = (contagem[`${g.data}|${formato}`] || 0) + 1);
    const legenda = (await Promise.all(g.textos.map(ler))).filter(Boolean).join('\n\n');
    const nomeFormato = { story: 'Stories', reel: 'Reels', carrossel: 'Carrossel', estatico: 'Post' }[formato] || 'Conteúdo';
    const titulo = tituloDoNome(g.pasta) || (g.arquivos.length === 1 ? tituloDoNome(g.arquivos[0].nome) : '') || `${nomeFormato} de ${g.data.slice(8)}/${g.data.slice(5, 7)}`;
    posts.push({
      chave: `${g.data}|${formato}|${n}`,
      data: g.data,
      formato,
      titulo,
      legenda,
      midia: g.arquivos.map((a) => ({ id: a.id, tipo: a.tipo, nome: a.nome })),
      pasta: g.pasta,
    });
  }
  return { posts, arquivos: arquivos.length, pastas: pastasLidas };
}
