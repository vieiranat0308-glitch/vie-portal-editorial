// Peças comuns do Moodboard e do Calendário sazonal: aprovação (Aprovado / Alterar),
// "Aprovar todos", conversa e status, ligadas a /api/planejamento.
import { api, esc, aviso, falhou, abrirCamada, confirmar, quando } from '../ui.js';
import { etiquetaStatus } from './post.js';
import { STATUS } from '../regras.js';

export const rotaPlanejamento = (ctx, tipo) => `planejamento?cliente=${encodeURIComponent(ctx.cliente.id)}&tipo=${tipo}`;
export const pendentes = (itens) => itens.filter((i) => i.status === 'aprovacao');

// Botões do cliente (ou o seletor de status da equipe) para um item.
export function botoesAprovacao(item, admin) {
  if (admin) {
    return `<select class="entrada peq" data-p-status="${esc(item.id)}" style="width:auto">${['aprovacao', 'ajuste', 'aprovado'].map((k) => `<option value="${k}"${k === item.status ? ' selected' : ''}>${STATUS[k].nome}</option>`).join('')}</select>`;
  }
  if (item.status === 'aprovado') return '';
  return `
    <button class="btn acc" data-p-aprovar="${esc(item.id)}">✓ Aprovado</button>
    <button class="btn claro" data-p-alterar="${esc(item.id)}">Alterar</button>`;
}

export function faixaAprovarTodos(itens, admin, nome) {
  const n = pendentes(itens).length;
  if (admin || n < 2) return '';
  return `
    <div class="faixa-aprovar-tudo">
      <div><b>${n} ${nome} esperando a sua aprovação</b><p class="muted" style="font-size:13.5px">Já viu tudo e está de acordo? Aprove de uma vez.</p></div>
      <button class="btn acc" data-p-aprovar-todos>✓ Aprovar todos (${n})</button>
    </div>`;
}

export function conversa(item) {
  const comentarios = item.comentarios || [];
  return `
    <details class="conversa-item">
      <summary>${comentarios.length ? `${comentarios.length} ${comentarios.length === 1 ? 'comentário' : 'comentários'}` : 'Comentar'}</summary>
      ${comentarios.map((c) => `
        <div class="comentario${c.admin ? ' vie' : ''}"><div class="quem"><b>${esc(c.nome)}</b>${c.admin ? '<span>· Vie</span>' : ''}<span style="margin-left:auto">${esc(quando(c.em))}</span></div><p>${esc(c.texto)}</p></div>`).join('')}
      <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
        <textarea class="entrada" data-p-texto="${esc(item.id)}" rows="2" placeholder="Escreva um comentário…" style="flex:1;min-width:200px"></textarea>
        <button class="btn claro peq" data-p-comentar="${esc(item.id)}">Enviar</button>
      </div>
    </details>`;
}

export function ultimoPedido(item) {
  const ultimo = (item.comentarios || []).at(-1);
  if (item.status !== 'ajuste' || !ultimo) return '';
  return `<div class="comentario${ultimo.admin ? ' vie' : ''}"><div class="quem"><b>${esc(ultimo.nome)}</b><span style="margin-left:auto">${esc(quando(ultimo.em))}</span></div><p>${esc(ultimo.texto)}</p></div>`;
}

export { etiquetaStatus };

// Liga os botões. `aoMudar(lista)` recebe a lista atualizada do servidor.
export function ligarAprovacao(el, { ctx, tipo, itens, nome, aoMudar }) {
  const rota = rotaPlanejamento(ctx, tipo);
  const enviar = async (corpo, mensagem) => {
    try {
      const lista = await api(rota, { metodo: 'POST', corpo });
      if (mensagem) aviso(mensagem);
      ctx.atualizarContadores?.();
      aoMudar(lista);
    } catch (err) { falhou(err); }
  };
  el.querySelectorAll('[data-p-aprovar]').forEach((b) => {
    b.onclick = () => { b.disabled = true; enviar({ acao: 'status', id: b.dataset.pAprovar, status: 'aprovado' }, 'Aprovado! A equipe já foi avisada.'); };
  });
  el.querySelectorAll('[data-p-alterar]').forEach((b) => {
    b.onclick = () => {
      const item = itens().find((i) => i.id === b.dataset.pAlterar);
      const m = abrirCamada(`
        <h2>O que você quer alterar?</h2>
        <p class="muted">${esc(item?.titulo || '')}</p>
        <textarea class="entrada" rows="5" autofocus placeholder="Conte o que mudar…"></textarea>
        <div class="rodape-modal"><button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>Enviar para a equipe</button></div>`);
      m.el.querySelector('[data-ok]').onclick = () => {
        const comentario = m.el.querySelector('textarea').value.trim();
        if (!comentario) return aviso('Conte rapidinho o que alterar.', { erro: true });
        m.fechar();
        enviar({ acao: 'status', id: item.id, status: 'ajuste', comentario }, 'Pedido de alteração enviado para a equipe.');
      };
    };
  });
  el.querySelector('[data-p-aprovar-todos]')?.addEventListener('click', async () => {
    const n = pendentes(itens()).length;
    if (!(await confirmar(`Aprovar ${n === 1 ? 'o item' : `os ${n} ${nome}`} que ${n === 1 ? 'está' : 'estão'} esperando a sua aprovação?`, { botao: 'Aprovar todos' }))) return;
    enviar({ acao: 'aprovar-todos' }, 'Tudo aprovado! A equipe já foi avisada.');
  });
  el.querySelectorAll('[data-p-status]').forEach((s) => {
    s.onchange = () => enviar({ acao: 'status', id: s.dataset.pStatus, status: s.value }, 'Status atualizado.');
  });
  el.querySelectorAll('[data-p-comentar]').forEach((b) => {
    b.onclick = () => {
      const textoEl = el.querySelector(`[data-p-texto="${CSS.escape(b.dataset.pComentar)}"]`);
      const texto = textoEl.value.trim();
      if (texto) enviar({ acao: 'comentar', id: b.dataset.pComentar, texto }, 'Comentário enviado.');
    };
  });
}
