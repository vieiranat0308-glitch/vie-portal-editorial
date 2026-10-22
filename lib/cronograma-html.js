// Leitura do cronograma em HTML nos modelos da Vie (sem IA, sem custo).
// Modelo de cronograma: cada post do feed é um <article class="post" data-k="f-DDMM">
// e cada dia de stories um <article class="day" data-k="s-DDMM">, com data,
// dia/horário, pilar, formato, título, gancho e referências em campos com classe fixa.
// Modelo de roteiros de gravação: cada conteúdo é uma <section class="painel"
// id="a-DDMM"> com quem grava, formato, pilar, tema, gancho, cenas e legenda, e o
// botão "Marcar como gravado" (<button class="marcar" data-r="a-DDMM">).

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

// Texto com o rótulo em negrito separado: "<b>Na tela</b>Texto" vira "Na tela: Texto".
const rotulado = (html) => texto(String(html || '').replace(/<\/(b|strong)>/gi, ': ')).replace(/:\s*:/g, ':');

function lerRoteirosDeGravacao(html, mes) {
  const posts = [];
  for (const [, atributos, corpo] of String(html).matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/gi)) {
    if (!/class="[^"]*\bpainel\b/.test(atributos)) continue;
    const id = (atributos.match(/\bid="([\w-]+)"/) || [])[1];
    const dm = id && id.match(/-(\d{2})(\d{2})$/);
    if (!dm || !/data-grande/.test(corpo)) continue;
    const data = dataDe(`${dm[1]}/${dm[2]}`, mes);
    if (!data) continue;
    const quem = texto(um(corpo, 'p', 'doc-nome'));
    const rotuloFormato = texto(um(corpo, 'span', 'tag'));
    const formato = formatoDe(rotuloFormato || id);
    const ficha = [...(um(corpo, 'dl', 'ficha') || '').matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)]
      .map(([, dt, dd]) => `${texto(dt)}: ${texto(dd)}`);
    const cenas = [...(um(corpo, 'ol', 'cenas') || '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(([, li]) => {
      const tempo = texto(um(li, 'span', 'tempo'));
      const fala = texto(um(li, 'p', 'fala'));
      const tela = rotulado(um(li, 'p', 'tela'));
      return [`${tempo ? `[${tempo}] ` : ''}${fala}`, tela].filter(Boolean).join('\n');
    });
    const telas = itens(um(corpo, 'ol', 'telas') || '');
    const caixas = todos(corpo, 'div', 'caixa').map(rotulado);
    const direcao = itens(um(corpo, 'ul', 'dir') || '');
    const roteiro = [
      quem && `Quem grava: ${quem}`,
      texto(um(corpo, 'p', 'objetivo')),
      ficha.join('\n'),
      cenas.length && `Roteiro\n${cenas.join('\n\n')}`,
      telas.length && telas.map((t, i) => `Tela ${i + 1}: ${t}`).join('\n'),
      caixas.join('\n'),
      direcao.length && `Direção de gravação\n${direcao.map((d) => `• ${d}`).join('\n')}`,
      rotulado(um(corpo, 'p', 'aviso')),
    ].filter(Boolean).join('\n\n');
    const legenda = (corpo.match(/<pre\b[^>]*id="leg-[^"]*"[^>]*>([\s\S]*?)<\/pre>/i) || [])[1];
    posts.push({
      chaveHtml: id,
      marca: 'gravado', // o botão do roteiro marca o conteúdo como gravado
      data,
      horario: '',
      formato,
      pilar: texto(um(corpo, 'span', 'selo')),
      titulo: texto(um(corpo, 'h2', 'tema')) || 'Sem título',
      gancho: texto(um(um(corpo, 'div', 'gancho') || '', 'p', 'fala')),
      roteiro,
      legenda: legenda ? texto(legenda) : '',
      referencias: [],
    });
  }
  return posts;
}

export function lerCronogramaHtml(html, mes) {
  if (/<section\b[^>]*class="[^"]*\bpainel\b/i.test(html) && !/<article\b[^>]*data-k=/i.test(html)) {
    return lerRoteirosDeGravacao(html, mes);
  }
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
// "Feito / Publicado / Usada" do cronograma e os botões "Marcar como gravado"
// dos roteiros ao andamento salvo no portal.
function ponteCaixinhas() {
  const seletor = '.done input[data-key]';
  const botoes = 'button[data-r][aria-pressed]';
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
    // O clique feito daqui não é "confiável", então não volta para o portal.
    document.querySelectorAll(botoes).forEach((b) => {
      if ((b.getAttribute('aria-pressed') === 'true') !== !!feitos[b.dataset.r]) b.click();
    });
  });
  document.addEventListener('click', (e) => {
    const b = e.isTrusted && e.target && e.target.closest && e.target.closest(botoes);
    // Lê o estado depois que o próprio HTML tratou o clique.
    if (b) setTimeout(() => parent.postMessage({ tipo: 'vie-marcar', chave: b.dataset.r, feito: b.getAttribute('aria-pressed') === 'true' }, '*'), 0);
  }, true);
  document.addEventListener('change', (e) => {
    const caixa = e.target;
    if (e.isTrusted && caixa && caixa.matches && caixa.matches(seletor)) {
      parent.postMessage({ tipo: 'vie-marcar', chave: caixa.dataset.key, feito: caixa.checked }, '*');
    }
  }, true);
  parent.postMessage({ tipo: 'vie-pronto' }, '*');
}

export const SCRIPT_PONTE = `<script>(${ponteCaixinhas.toString()})();</script>`;
