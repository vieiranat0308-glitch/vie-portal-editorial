// Aprovação: o que está esperando o cliente e o que o cliente pediu para ajustar.
import { api, esc, falhou, dataLonga, quando } from '../ui.js';
import { corDoPilar } from '../regras.js';
import { abrirPost, etiquetaFormato, etiquetaPilar, etiquetaStatus } from '../componentes/post.js';

export async function render(el, ctx) {
  const { cliente, admin } = ctx;
  const id = encodeURIComponent(cliente.id);
  ctx.topo('Geral', 'Aprovação');
  const editorial = await ctx.editorial();
  const pilares = editorial.pilares || [];

  let itens = [];
  async function carregar() {
    const meses = await api(`cronograma?cliente=${id}`);
    const relevantes = meses.filter((m) => (m.porStatus.aprovacao || 0) + (m.porStatus.ajuste || 0) > 0);
    const docs = await Promise.all(relevantes.map((m) => api(`cronograma?cliente=${id}&mes=${m.mes}`)));
    itens = docs.flatMap((d) => d.posts.filter((p) => ['aprovacao', 'ajuste'].includes(p.status)).map((p) => ({ ...p, mes: d.mes, publicado: d.status === 'publicado' })));
    itens.sort((a, b) => a.data.localeCompare(b.data));
  }

  function bloco(p) {
    const ultimo = (p.comentarios || []).at(-1);
    return `
      <div class="cartao" style="display:grid;gap:12px;border-left:4px solid ${corDoPilar(pilares, p.pilarId)}">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <span class="mono muted" style="font-size:10.5px">${esc(dataLonga(p.data))}</span>
          ${etiquetaFormato(p.formato)} ${etiquetaPilar(pilares, p.pilarId)}
          ${admin && !p.publicado ? '<span class="etq">Mês em rascunho</span>' : ''}
          <span style="margin-left:auto">${etiquetaStatus(p.status)}</span>
        </div>
        <h3 class="serif" style="font-size:22px">${p.titulo ? esc(p.titulo) : '<span class="sem-titulo">Sem título</span>'}</h3>
        ${p.gancho ? `<p class="citacao" style="font:italic 17px/1.4 var(--serif);border-left:3px solid var(--acc);padding-left:14px">“${esc(p.gancho)}”</p>` : ''}
        ${ultimo ? `<div class="comentario${ultimo.admin ? ' vie' : ''}"><div class="quem"><b>${esc(ultimo.nome)}</b><span style="margin-left:auto">${esc(quando(ultimo.em))}</span></div><p>${esc(ultimo.texto)}</p></div>` : ''}
        <div><button class="btn ${p.status === 'aprovacao' && !admin ? 'acc' : 'claro'} peq" data-abrir="${p.mes}|${p.id}">${p.status === 'aprovacao' && !admin ? 'Ver e aprovar' : 'Abrir conteúdo'}</button></div>
      </div>`;
  }

  function desenhar() {
    const aguardandoCliente = itens.filter((p) => p.status === 'aprovacao');
    const ajustes = itens.filter((p) => p.status === 'ajuste');
    const secoes = admin
      ? [['Ajustes pedidos pelo cliente', ajustes, 'Nenhum ajuste pendente. 🎉'], ['Aguardando aprovação do cliente', aguardandoCliente, 'Nada esperando o cliente.']]
      : [['Esperando a sua aprovação', aguardandoCliente, 'Tudo aprovado por aqui. Obrigada!'], ['Ajustes que você pediu', ajustes, 'Nenhum ajuste em andamento.']];
    el.innerHTML = `
      <section class="saudacao"><h1>Aprovação</h1><p>${admin
        ? 'Acompanhe o que está com o cliente e responda os pedidos de ajuste.'
        : 'Aqui ficam os conteúdos que a equipe Vie preparou para você revisar. Aprove ou peça ajuste com um comentário.'}</p></section>
      ${secoes.map(([titulo, lista, vazio]) => `
        <div class="secao-titulo"><h2>${titulo}</h2><span class="etq">${lista.length}</span></div>
        ${lista.length ? `<div style="display:grid;gap:12px">${lista.map(bloco).join('')}</div>` : `<div class="vazio">${vazio}</div>`}`).join('')}`;
    el.querySelectorAll('[data-abrir]').forEach((b) => {
      b.onclick = () => {
        const [mes, postId] = b.dataset.abrir.split('|');
        abrirPost({
          ctx,
          mes,
          post: itens.find((p) => p.id === postId),
          aoMudar: async () => { await carregar().catch(falhou); desenhar(); },
        });
      };
    });
  }

  await carregar();
  desenhar();
}
