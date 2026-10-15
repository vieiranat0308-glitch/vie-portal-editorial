// Formulário gerado a partir de uma descrição de campos (usado no editor da linha editorial).
// Edita o objeto `dados` no lugar; listas podem conter outras listas.
import { esc, icones } from '../ui.js';
import { FORMATOS, DIAS_SEMANA } from '../regras.js';

const obter = (obj, caminho) => caminho.split('.').reduce((o, k) => o?.[k], obj);
function definir(obj, caminho, valor) {
  const partes = caminho.split('.');
  let alvo = obj;
  partes.slice(0, -1).forEach((k) => {
    if (typeof alvo[k] !== 'object' || alvo[k] === null) alvo[k] = {};
    alvo = alvo[k];
  });
  alvo[partes.at(-1)] = valor;
}
const novoIdPilar = () => `p${globalThis.crypto.randomUUID().slice(0, 8)}`;

export function formularioSecao(el, secao, dados, opcoes) {
  const redesenhar = () => formularioSecao(el, secao, dados, opcoes);
  el.innerHTML = `<h2 class="serif" style="font-size:26px">${esc(secao.titulo)}</h2>`;
  secao.campos.forEach((c) => el.append(criarCampo(c, dados, redesenhar, opcoes)));
}

function criarCampo(c, alvo, redesenhar, opcoes) {
  const valor = obter(alvo, c.k);
  const caixa = document.createElement('div');
  if (c.largo) caixa.className = 'largo';

  if (c.tipo === 'lista') {
    const itens = Array.isArray(valor) ? valor : [];
    if (!Array.isArray(valor)) definir(alvo, c.k, itens);
    caixa.style.display = 'grid';
    caixa.style.gap = '10px';
    itens.forEach((item, i) => {
      const bloco = document.createElement('div');
      bloco.className = 'item-lista';
      bloco.innerHTML = `
        <div class="cab-item">
          <span class="mono">${esc(c.rotulo)} ${i + 1}</span>
          <button class="btn-icone" type="button" data-acao="subir" title="Mover para cima" ${i === 0 ? 'disabled' : ''} style="transform:rotate(90deg)">${icones.esquerda}</button>
          <button class="btn-icone" type="button" data-acao="descer" title="Mover para baixo" ${i === itens.length - 1 ? 'disabled' : ''} style="transform:rotate(90deg)">${icones.direita}</button>
          <button class="btn-icone" type="button" data-acao="remover" title="Remover">${icones.lixo}</button>
        </div>
        <div class="grade-campos"></div>`;
      const grade = bloco.querySelector('.grade-campos');
      c.item.forEach((sub) => grade.append(criarCampo(sub, item, redesenhar, opcoes)));
      bloco.querySelector('.cab-item').addEventListener('click', (e) => {
        const acao = e.target.closest('[data-acao]')?.dataset.acao;
        if (!acao) return;
        if (acao === 'remover') {
          if (!confirm(`Remover ${c.rotulo.toLowerCase()} ${i + 1}?`)) return;
          itens.splice(i, 1);
        }
        if (acao === 'subir') [itens[i - 1], itens[i]] = [itens[i], itens[i - 1]];
        if (acao === 'descer') [itens[i + 1], itens[i]] = [itens[i], itens[i + 1]];
        redesenhar();
      });
      caixa.append(bloco);
    });
    const adicionar = document.createElement('button');
    adicionar.type = 'button';
    adicionar.className = 'btn claro peq';
    adicionar.style.justifySelf = 'start';
    adicionar.innerHTML = `${icones.mais}Adicionar ${esc(c.rotulo.toLowerCase())}`;
    adicionar.onclick = () => {
      itens.push(c.k === 'pilares' ? { id: novoIdPilar() } : {});
      redesenhar();
    };
    caixa.append(adicionar);
    return caixa;
  }

  const id = `campo-${Math.random().toString(36).slice(2, 9)}`;
  let controle;
  switch (c.tipo) {
    case 'area':
      controle = `<textarea class="entrada" id="${id}" rows="3">${esc(valor ?? '')}</textarea>`;
      break;
    case 'linhas':
      controle = `<textarea class="entrada" id="${id}" rows="4">${esc((valor || []).join('\n'))}</textarea>`;
      break;
    case 'links':
      controle = `<textarea class="entrada" id="${id}" rows="2" placeholder="Nome | https://…">${esc((valor || []).map((r) => `${r.rotulo} | ${r.url}`).join('\n'))}</textarea>`;
      break;
    case 'numero':
      controle = `<input class="entrada" id="${id}" type="number" min="0" max="100" value="${esc(valor ?? '')}">`;
      break;
    case 'dia':
      controle = `<select class="entrada" id="${id}">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<option value="${d}"${Number(valor) === d ? ' selected' : ''}>${DIAS_SEMANA[d]}</option>`).join('')}</select>`;
      if (valor === undefined) definir(alvo, c.k, 1);
      break;
    case 'formato':
      controle = `<select class="entrada" id="${id}">${Object.entries(FORMATOS).map(([k, f]) => `<option value="${k}"${valor === k ? ' selected' : ''}>${f.curto}</option>`).join('')}</select>`;
      if (valor === undefined) definir(alvo, c.k, 'reel');
      break;
    case 'pilares': {
      const marcados = new Set(valor || []);
      const pilares = opcoes.pilares().filter((p) => p.nome);
      controle = pilares.length
        ? `<div class="opcoes-check" id="${id}">${pilares.map((p) => `<label><input type="checkbox" value="${esc(p.id)}"${marcados.has(p.id) ? ' checked' : ''}> ${esc(p.nome)}</label>`).join('')}</div>`
        : '<p class="muted" style="font-size:13px">Cadastre os pilares primeiro (aba Pilares).</p>';
      break;
    }
    default:
      controle = `<input class="entrada" id="${id}" value="${esc(valor ?? '')}">`;
  }
  caixa.innerHTML = `<label class="campo" for="${id}"><span>${esc(c.rotulo)}</span>${controle}</label>`;

  const el = caixa.querySelector(`#${id}`);
  if (!el) return caixa;
  if (c.tipo === 'pilares') {
    el.addEventListener('change', () => {
      definir(alvo, c.k, [...el.querySelectorAll('input:checked')].map((i) => i.value));
    });
  } else {
    el.addEventListener('input', () => {
      const v = el.value;
      if (c.tipo === 'linhas') definir(alvo, c.k, v.split('\n').map((l) => l.trim()).filter(Boolean));
      else if (c.tipo === 'links') {
        definir(alvo, c.k, v.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
          const [rotulo, ...resto] = l.split('|');
          return resto.length ? { rotulo: rotulo.trim(), url: resto.join('|').trim() } : { rotulo: 'Referência', url: rotulo.trim() };
        }));
      } else if (c.tipo === 'numero') definir(alvo, c.k, v === '' ? null : Number(v));
      else if (c.tipo === 'dia') definir(alvo, c.k, Number(v));
      else definir(alvo, c.k, v);
    });
    if (el.tagName === 'SELECT') el.addEventListener('change', () => el.dispatchEvent(new Event('input')));
  }
  return caixa;
}
