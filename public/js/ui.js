// Utilidades de interface: API, avisos, modais, datas e ícones.
import { DIAS_SEMANA, MESES } from './regras.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function api(caminho, { metodo = 'GET', corpo, arquivo, tipo } = {}) {
  const opcoes = { method: metodo, headers: {}, credentials: 'same-origin' };
  if (arquivo) {
    opcoes.body = arquivo;
    opcoes.headers['Content-Type'] = 'application/octet-stream';
  } else if (corpo !== undefined) {
    opcoes.body = JSON.stringify(corpo);
    opcoes.headers['Content-Type'] = 'application/json';
  }
  let resposta;
  try {
    resposta = await fetch(`/api/${caminho}`, opcoes);
  } catch {
    const erro = new Error('Sem conexão com a internet. Tente de novo quando a conexão voltar.');
    erro.semConexao = true;
    throw erro;
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    if (resposta.status === 401 && !caminho.startsWith('auth')) window.dispatchEvent(new Event('sessao-expirada'));
    const erro = new Error(dados.error || 'Algo deu errado. Tente de novo.');
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

export function aviso(mensagem, { erro = false } = {}) {
  const el = document.createElement('div');
  el.className = `aviso${erro ? ' erro' : ''}`;
  el.textContent = mensagem;
  document.getElementById('avisos').append(el);
  setTimeout(() => el.remove(), erro ? 6000 : 3200);
}

export const falhou = (err) => aviso(err.message || String(err), { erro: true });

// Abre um modal centralizado (ou uma gaveta lateral). Devolve { el, fechar }.
export function abrirCamada(html, { gaveta = false, largo = false, aoFechar } = {}) {
  const fundo = document.createElement('div');
  fundo.className = `fundo${gaveta ? '' : ' centro'}`;
  fundo.innerHTML = `<div class="${gaveta ? 'gaveta' : `modal${largo ? ' largo' : ''}`}" role="dialog" aria-modal="true">${html}</div>`;
  const el = fundo.firstElementChild;
  const fechar = () => {
    fundo.remove();
    document.removeEventListener('keydown', tecla);
    aoFechar?.();
  };
  const tecla = (e) => { if (e.key === 'Escape' && document.getElementById('camada').lastElementChild === fundo) fechar(); };
  fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fechar(); });
  el.addEventListener('click', (e) => { if (e.target.closest('[data-fechar]')) fechar(); });
  document.addEventListener('keydown', tecla);
  document.getElementById('camada').append(fundo);
  el.querySelector('[autofocus]')?.focus();
  return { el, fechar };
}

export function confirmar(mensagem, { botao = 'Confirmar', perigo = false } = {}) {
  return new Promise((resolve) => {
    let ok = false;
    const { el, fechar } = abrirCamada(`
      <h2>Tem certeza?</h2>
      <p>${esc(mensagem)}</p>
      <div class="rodape-modal">
        <button class="btn claro" data-fechar>Cancelar</button>
        <button class="btn ${perigo ? 'perigo' : 'acc'}" data-ok>${esc(botao)}</button>
      </div>`, { aoFechar: () => resolve(ok) });
    el.querySelector('[data-ok]').onclick = () => { ok = true; fechar(); };
  });
}

// Lê os campos [name] de um formulário/elemento e devolve um objeto.
export function lerCampos(el) {
  const dados = {};
  el.querySelectorAll('[name]').forEach((c) => {
    dados[c.name] = c.type === 'checkbox' ? c.checked : c.value;
  });
  return dados;
}

export async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    aviso('Copiado!');
  } catch {
    aviso('Não foi possível copiar automaticamente. Selecione e copie o texto.', { erro: true });
  }
}

// ---------- Datas ----------
export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const mesAtual = () => hojeISO().slice(0, 7);
export function somarMes(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function dataObj(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}
export function dataLonga(iso) {
  const d = dataObj(iso);
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`;
}
export function dataCurta(iso) {
  const d = dataObj(iso);
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3).toLowerCase()}`;
}
export const diaSemanaCurto = (iso) => DIAS_SEMANA[dataObj(iso).getDay()].slice(0, 3);
export function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
export function quando(isoCompleto) {
  const d = new Date(isoCompleto);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

// ---------- Números ----------
export function num(n, casas = 0) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: casas });
}
export function compacto(n) {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 1e6) return `${num(n / 1e6, 1)} mi`;
  if (Math.abs(n) >= 1e4) return `${num(n / 1e3, 1)} mil`;
  return num(n);
}
export function iniciais(nome) {
  const partes = String(nome || '?').replace(/^(dra?\.?|dr\.?)\s+/i, '').trim().split(/\s+/);
  return ((partes[0]?.[0] || '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

// ---------- Ícones (traço fino) ----------
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const icones = {
  geral: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  calendario: svg('<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>'),
  livro: svg('<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>'),
  aprovacao: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.6 2.5L16 9.5"/>'),
  feed: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'),
  ideia: svg('<path d="M9 18h6M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.6.5 1 1.3 1 2.1V17h5.6v-.6c0-.8.4-1.6 1-2.1A6.5 6.5 0 0 0 12 2.5z"/>'),
  metricas: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  documentos: svg('<path d="M14 2.5H6.5A2.5 2.5 0 0 0 4 5v14a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 19V8.5z"/><path d="M14 2.5v6h6M8 13h8M8 17h5"/>'),
  perfil: svg('<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="10" r="3.2"/><path d="M6.2 18.6a6.5 6.5 0 0 1 11.6 0"/>'),
  pessoas: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20.5a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20.5a6.5 6.5 0 0 0-4-6"/>'),
  ajustes: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  esquerda: svg('<path d="m15 18-6-6 6-6"/>'),
  direita: svg('<path d="m9 18 6-6-6-6"/>'),
  voltar: svg('<path d="M19 12H5M12 19l-7-7 7-7"/>'),
  mais: svg('<path d="M12 5v14M5 12h14"/>'),
  menu: svg('<path d="M3 6h18M3 12h18M3 18h18"/>'),
  fechar: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  editar: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  lixo: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'),
  copiar: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  link: svg('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
  baixar: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
  imprimir: svg('<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
  reel: svg('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m10 8.5 5 3.5-5 3.5z"/>'),
  carrossel: svg('<rect x="7" y="3" width="14" height="14" rx="2"/><path d="M3 7v12a2 2 0 0 0 2 2h12"/>'),
  estatico: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
  story: svg('<circle cx="12" cy="12" r="9" stroke-dasharray="3 2.2"/><circle cx="12" cy="12" r="4"/>'),
  whatsapp: svg('<path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.4z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8c-1-.4-1.8-1.2-2.2-2.2l.8-1-1-2z"/>'),
  sair: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
};
