// Serviços prestados pela Vie a cada cliente (etiquetas).
import { esc } from '../ui.js';

export function etiquetasServicos(ids, servicos, { mini = false } = {}) {
  return (ids || [])
    .map((id) => servicos.find((s) => s.id === id))
    .filter(Boolean)
    .map((s) => `<span class="etq cheia etq-servico${mini ? ' mini' : ''}" style="--cor:${esc(s.cor)}"><span class="ponto"></span>${esc(s.nome)}</span>`)
    .join('');
}

// Caixinhas de serviços para os formulários de cliente.
export function escolhaServicos(selecionados, servicos) {
  const marcados = new Set(selecionados || []);
  return `<div class="opcoes-check" data-servicos>${servicos.map((s) => `
    <label><input type="checkbox" value="${esc(s.id)}"${marcados.has(s.id) ? ' checked' : ''}><span class="ponto" style="--cor:${esc(s.cor)}"></span>${esc(s.nome)}</label>`).join('')}</div>`;
}

export const lerServicosMarcados = (el) => [...el.querySelectorAll('[data-servicos] input:checked')].map((i) => i.value);
