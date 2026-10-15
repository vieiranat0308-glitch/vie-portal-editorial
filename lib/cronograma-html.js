// Leitura do cronograma em HTML no formato da Vie (sem IA, sem custo).
// Cada post do feed é um <article class="post" data-k="f-DDMM"> e cada dia de
// stories um <article class="day" data-k="s-DDMM">, com data, dia/horário,
// pilar, formato, título, gancho e referências em campos com classe fixa.

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

function texto(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
      return ENTIDADES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

// Conteúdo dos elementos <tag class="... classe ..."> (sem aninhamento da mesma tag).
function todos(html, tag, classe) {
  const re = new RegExp(`<${tag}\\b[^>]*class="[^"]*\\b${classe}\\b[^"]*"[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  return [...String(html).matchAll(re)].map((m) => m[1]);
}
const um = (html, tag, classe) => todos(html, tag, classe)[0];

function formatoDe(rotulo) {
  const t = rotulo.toLowerCase();
  const opcoes = [['reel', /\breels?\b|v[ií]deo|trend/], ['carrossel', /carross/], ['estatico', /est[áa]tico|foto|\bpost\b|arte/], ['story', /stor(y|ies)/]];
  let melhor = null;
  opcoes.forEach(([formato, re]) => {
    const m = t.match(re);
    if (m && (!melhor || m.index < melhor.indice)) melhor = { formato, indice: m.index };
  });
  return melhor?.formato || 'reel';
}

function dataDe(rotulo, mes) {
  const m = String(rotulo).match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (!m) return null;
  const [anoRef, mesRef] = mes.split('-').map(Number);
  const dia = Number(m[1]);
  const mesPost = Number(m[2]);
  // Cronograma de dezembro com posts de janeiro (ou o contrário) vira o ano.
  const ano = mesRef === 12 && mesPost === 1 ? anoRef + 1 : mesRef === 1 && mesPost === 12 ? anoRef - 1 : anoRef;
  if (dia < 1 || dia > 31 || mesPost < 1 || mesPost > 12) return null;
  return `${ano}-${String(mesPost).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

const itens = (html) => todos(html, 'li', '').length
  ? todos(html, 'li', '').map(texto)
  : [...String(html).matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => texto(m[1]));

export function lerCronogramaHtml(html, mes) {
  const posts = [];
  for (const [, atributos, corpo] of String(html).matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)) {
    const classe = (atributos.match(/class="([^"]*)"/) || [])[1] || '';
    const chave = (atributos.match(/data-k="([^"]*)"/) || [])[1];
    const ehPost = /\bpost\b/.test(classe);
    const ehDia = /\bday\b/.test(classe);
    if (!chave || (!ehPost && !ehDia)) continue;
    const data = dataDe(texto(um(corpo, 'p', 'date')), mes);
    if (!data) continue;
    const quando = texto(um(corpo, 'p', 'dow'));
    const horario = quando.includes('·') ? quando.split('·').slice(1).join('·').trim() : '';

    if (ehPost) {
      const rotuloFormato = texto(um(corpo, 'span', 'fmt'));
      const pilar = texto(um(corpo, 'span', 'pill'));
      const referencias = [...(um(corpo, 'p', 'refs') || '').matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
        .map(([, url, rotulo]) => ({ rotulo: texto(rotulo), url: texto(url) }))
        .filter((r) => /^https?:\/\//i.test(r.url));
      posts.push({
        chaveHtml: chave,
        data,
        horario,
        formato: formatoDe(rotuloFormato),
        pilar: pilar.includes('·') ? pilar.split('·').slice(1).join('·').trim() : pilar,
        titulo: texto(um(corpo, 'h4', '') || (corpo.match(/<h[2-5]\b[^>]*>([\s\S]*?)<\/h[2-5]>/i) || [])[1]),
        gancho: todos(corpo, 'p', 'hook').map(texto).join('\n\n'),
        roteiro: rotuloFormato && formatoDe(rotuloFormato) !== rotuloFormato.toLowerCase() && !/^(reel|carrossel|estático|story)$/i.test(rotuloFormato) ? `Formato sugerido: ${rotuloFormato}` : '',
        legenda: '',
        referencias,
      });
    } else {
      const planos = todos(corpo, 'div', 'plan');
      const roteiro = planos.length
        ? planos.map((p) => [texto(um(p, 'p', 'plan-t')), ...itens(p).map((i) => `• ${i}`)].filter(Boolean).join('\n')).join('\n\n')
        : itens(corpo).map((i) => `• ${i}`).join('\n');
      posts.push({
        chaveHtml: chave,
        data,
        horario,
        formato: 'story',
        pilar: null,
        titulo: texto(um(corpo, 'p', 'dir')) || 'Stories do dia',
        gancho: '',
        roteiro,
        legenda: '',
        referencias: [],
      });
    }
  }
  return posts;
}

// Script colocado no HTML servido dentro do portal: liga as caixinhas
// "Feito / Publicado / Usada" do cronograma ao andamento salvo no portal.
function ponteCaixinhas() {
  const seletor = '.done input[data-key]';
  window.addEventListener('message', (e) => {
    if (e.source !== parent || !e.data || e.data.tipo !== 'vie-estado') return;
    const feitos = e.data.feitos || {};
    document.querySelectorAll(seletor).forEach((caixa) => {
      const valor = !!feitos[caixa.dataset.key];
      if (caixa.checked !== valor) {
        caixa.checked = valor;
        caixa.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });
  document.addEventListener('change', (e) => {
    const caixa = e.target;
    if (e.isTrusted && caixa && caixa.matches && caixa.matches(seletor)) {
      parent.postMessage({ tipo: 'vie-marcar', chave: caixa.dataset.key, feito: caixa.checked }, '*');
    }
  }, true);
  parent.postMessage({ tipo: 'vie-pronto' }, '*');
}

export const SCRIPT_PONTE = `<script>(${ponteCaixinhas.toString()})();</script>`;
