// Gaveta de um conteúdo do cronograma: leitura, aprovação, comentários e edição (Vie).
import { api, esc, aviso, falhou, abrirCamada, confirmar, copiar, dataLonga, quando, icones } from '../ui.js';
import { FORMATOS, STATUS, corDoPilar } from '../regras.js';

export function etiquetaFormato(formato) {
  const f = FORMATOS[formato] || FORMATOS.reel;
  return `<span class="etq">${icones[formato] || ''}${f.curto}</span>`.replace('<svg', '<svg style="width:13px;height:13px"');
}
export function etiquetaPilar(pilares, pilarId) {
  const p = (pilares || []).find((x) => x.id === pilarId);
  if (!p) return '';
  return `<span class="etq cheia" style="--cor:${corDoPilar(pilares, pilarId)}"><span class="ponto"></span>${esc(p.nome)}</span>`;
}
export function etiquetaStatus(status) {
  const s = STATUS[status] || STATUS.pauta;
  return `<span class="etq" style="--cor:${s.cor}"><span class="ponto"></span>${s.nome}</span>`;
}

// Quem cuida do conteúdo quando o cronograma é dividido entre a Vie e o cliente.
export function etiquetaTrilha(p, admin) {
  return p.trilha === 'vie'
    ? '<span class="etq trilha-vie">Vie publica</span>'
    : `<span class="etq trilha-cliente">${admin ? 'Cliente' : 'Você'}</span>`;
}

const rotaCron = (ctx, mes) => `cronograma?cliente=${encodeURIComponent(ctx.cliente.id)}&mes=${mes}`;

// Abre a gaveta. `aoMudar(doc)` recebe o cronograma atualizado depois de qualquer alteração.
export async function abrirPost({ ctx, mes, post, aoMudar, editar = false }) {
  const editorial = await ctx.editorial();
  const pilares = editorial.pilares || [];
  const { el, fechar } = abrirCamada('<div class="cab-gaveta"></div><div class="corpo"></div>', { gaveta: true });
  let atual = post;

  async function enviar(corpo) {
    const doc = await api(rotaCron(ctx, mes), { metodo: 'POST', corpo });
    aoMudar?.(doc);
    ctx.atualizarContadores?.();
    return doc;
  }

  function mostrar() {
    const p = atual;
    el.querySelector('.cab-gaveta').innerHTML = `
      ${etiquetaFormato(p.formato)} ${etiquetaPilar(pilares, p.pilarId)}${ctx.abas?.has('cronogramaVie') ? ` ${etiquetaTrilha(p, ctx.admin)}` : ''}
      <span style="margin-left:auto"></span>
      ${ctx.admin ? `<button class="btn-icone" data-editar title="Editar">${icones.editar}</button>` : ''}
      <button class="btn-icone" data-fechar title="Fechar">${icones.fechar}</button>`;
    const acoesCliente = [];
    if (['pauta', 'aprovacao', 'ajuste'].includes(p.status)) {
      acoesCliente.push('<button class="btn acc" data-status="aprovado">Aprovar</button>', '<button class="btn claro" data-ajuste>Pedir ajuste</button>');
    }
    // No cronograma da Vie quem grava e publica é a equipe: o cliente só aprova ou pede ajuste.
    if (p.trilha !== 'vie' && p.status === 'aprovado') acoesCliente.push('<button class="btn claro" data-status="gravado">Marcar como gravado</button>');
    if (p.trilha !== 'vie' && ['aprovado', 'gravado'].includes(p.status)) acoesCliente.push('<button class="btn claro" data-status="postado">Marcar como postado</button>');

    el.querySelector('.corpo').innerHTML = `
      <div>
        <p class="mono muted" style="font-size:10.5px">${esc(dataLonga(p.data))}${p.horario ? ` · ${esc(p.horario)}` : ''}</p>
        <h2 style="margin-top:6px">${p.titulo ? esc(p.titulo) : '<span class="sem-titulo">Sem título</span>'}</h2>
      </div>
      <div class="secao-post">
        <span class="mono">Status</span>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          ${etiquetaStatus(p.status)}
          ${p.statusPor ? `<span class="muted" style="font-size:13px">por ${esc(p.statusPor.nome)} em ${esc(quando(p.statusPor.em))}</span>` : ''}
        </div>
        ${ctx.admin ? `
          <div class="acoes-status">
            <select class="entrada" data-status-admin style="width:auto">${Object.entries(STATUS).map(([k, s]) => `<option value="${k}"${k === p.status ? ' selected' : ''}>${s.nome}</option>`).join('')}</select>
          </div>` : acoesCliente.length ? `<div class="acoes-status">${acoesCliente.join('')}</div>` : ''}
      </div>
      ${p.gancho ? `<div class="secao-post"><span class="mono">${p.formato === 'carrossel' || p.formato === 'estatico' ? 'Capa' : 'Gancho · fala de abertura'}</span><p class="citacao">“${esc(p.gancho)}”</p></div>` : ''}
      ${p.roteiro ? `<div class="secao-post"><span class="mono">Roteiro · direcionamento</span><div class="texto">${esc(p.roteiro)}</div></div>` : ''}
      ${p.legenda ? `<div class="secao-post"><span class="mono" style="display:flex;align-items:center">Legenda <button class="btn fantasma peq" data-copiar-legenda style="margin-left:auto">${icones.copiar}Copiar</button></span><div class="texto">${esc(p.legenda)}</div></div>` : ''}
      ${p.referencias?.length ? `<div class="secao-post"><span class="mono">Referências</span><div style="display:flex;gap:8px;flex-wrap:wrap">${p.referencias.map((r) => `<a class="btn claro peq" href="${esc(r.url)}" target="_blank" rel="noopener">${icones.link}${esc(r.rotulo)}</a>`).join('')}</div></div>` : ''}
      ${ctx.admin && p.notaInterna ? `<div class="secao-post"><span class="mono">Nota interna · só a Vie vê</span><div class="texto" style="background:var(--surface)">${esc(p.notaInterna)}</div></div>` : ''}
      <div class="secao-post">
        <span class="mono">Conversa sobre este conteúdo</span>
        ${(p.comentarios || []).map((c) => `
          <div class="comentario${c.admin ? ' vie' : ''}">
            <div class="quem"><b>${esc(c.nome)}</b>${c.admin ? '<span>· Vie</span>' : ''}<span style="margin-left:auto">${esc(quando(c.em))}</span></div>
            <p>${esc(c.texto)}</p>
          </div>`).join('') || '<p class="muted" style="font-size:14px">Nenhum comentário ainda.</p>'}
        <textarea class="entrada" data-comentario placeholder="Escreva um comentário, dúvida ou ideia…" rows="3"></textarea>
        <div><button class="btn claro peq" data-comentar>Enviar comentário</button></div>
      </div>
      ${ctx.admin ? `<div style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:18px">
        <button class="btn claro peq" data-duplicar>${icones.copiar}Duplicar</button>
        <button class="btn perigo peq" data-excluir>${icones.lixo}Excluir</button>
      </div>` : ''}`;

    const corpo = el.querySelector('.corpo');
    el.querySelector('[data-editar]')?.addEventListener('click', () => editarPost());
    corpo.querySelectorAll('[data-status]').forEach((b) => {
      b.onclick = () => mudarStatus(b.dataset.status);
    });
    corpo.querySelector('[data-status-admin]')?.addEventListener('change', (e) => mudarStatus(e.target.value));
    corpo.querySelector('[data-ajuste]')?.addEventListener('click', pedirAjuste);
    corpo.querySelector('[data-copiar-legenda]')?.addEventListener('click', () => copiar(p.legenda));
    corpo.querySelector('[data-comentar]').onclick = async () => {
      const texto = corpo.querySelector('[data-comentario]').value.trim();
      if (!texto) return;
      try {
        const doc = await enviar({ acao: 'comentar', postId: p.id, texto });
        atual = doc.posts.find((x) => x.id === p.id);
        mostrar();
      } catch (err) { falhou(err); }
    };
    corpo.querySelector('[data-duplicar]')?.addEventListener('click', () => {
      atual = { ...p, id: null, comentarios: [], statusPor: null, status: 'pauta' };
      editarPost();
    });
    corpo.querySelector('[data-excluir]')?.addEventListener('click', async () => {
      if (!(await confirmar('Este conteúdo será removido do cronograma.', { botao: 'Excluir', perigo: true }))) return;
      try {
        await enviar({ acao: 'excluir-post', postId: p.id });
        aviso('Conteúdo excluído.');
        fechar();
      } catch (err) { falhou(err); }
    });
  }

  async function mudarStatus(status, comentario = '') {
    try {
      const doc = await enviar({ acao: 'status', postId: atual.id, status, comentario });
      atual = doc.posts.find((x) => x.id === atual.id);
      aviso(status === 'aprovado' ? 'Conteúdo aprovado. Obrigada!' : `Marcado como “${STATUS[status].nome}”.`);
      mostrar();
    } catch (err) { falhou(err); }
  }

  function pedirAjuste() {
    const m = abrirCamada(`
      <h2>O que você gostaria de ajustar?</h2>
      <p class="muted">A equipe Vie recebe o seu pedido e devolve o conteúdo ajustado.</p>
      <textarea class="entrada" rows="5" autofocus placeholder="Ex.: prefiro outro gancho, esse tema já gravei, mudar o dia…"></textarea>
      <div class="rodape-modal"><button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>Enviar pedido</button></div>`);
    m.el.querySelector('[data-ok]').onclick = async () => {
      const texto = m.el.querySelector('textarea').value.trim();
      if (!texto) return aviso('Conte rapidinho o que ajustar.', { erro: true });
      m.fechar();
      await mudarStatus('ajuste', texto);
    };
  }

  async function editarPost() {
    const p = atual;
    const ideias = await ctx.ideias();
    const [ano, m] = mes.split('-').map(Number);
    const ultimo = `${mes}-${String(new Date(ano, m, 0).getDate()).padStart(2, '0')}`;
    el.querySelector('.cab-gaveta').innerHTML = `<strong style="font-weight:500">${p.id ? 'Editar conteúdo' : 'Novo conteúdo'}</strong><span style="margin-left:auto"></span><button class="btn-icone" data-fechar title="Fechar">${icones.fechar}</button>`;
    el.querySelector('.corpo').innerHTML = `
      <form class="grade-campos" data-form>
        <label class="campo largo"><span>Puxar do banco de ideias (opcional)</span>
          <select class="entrada" data-ideia>
            <option value="">Escolha uma ideia para preencher os campos…</option>
            ${ideias.map((i) => `<option value="${i.id}">${i.usadaEm ? '✓ ' : ''}${esc(FORMATOS[i.formato]?.curto || '')} · ${esc(i.titulo).slice(0, 90)}</option>`).join('')}
          </select>
        </label>
        <label class="campo"><span>Data</span><input class="entrada" type="date" name="data" value="${esc(p.data)}" min="${mes}-01" max="${ultimo}" required></label>
        <label class="campo"><span>Horário</span><input class="entrada" name="horario" value="${esc(p.horario || '')}" placeholder="Ex.: 8h–10h, Manhã"></label>
        <label class="campo"><span>Formato</span><select class="entrada" name="formato">${Object.entries(FORMATOS).map(([k, f]) => `<option value="${k}"${k === p.formato ? ' selected' : ''}>${f.curto}</option>`).join('')}</select></label>
        <label class="campo"><span>Pilar</span><select class="entrada" name="pilarId"><option value="">—</option>${pilares.map((x) => `<option value="${x.id}"${x.id === p.pilarId ? ' selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>
        <label class="campo largo"><span>Título / tema</span><input class="entrada" name="titulo" value="${esc(p.titulo || '')}"></label>
        <label class="campo largo"><span>Gancho, fala de abertura ou texto da capa</span><textarea class="entrada" name="gancho" rows="3">${esc(p.gancho || '')}</textarea></label>
        <label class="campo largo"><span>Roteiro / direcionamento</span><textarea class="entrada" name="roteiro" rows="6">${esc(p.roteiro || '')}</textarea></label>
        <label class="campo largo"><span>Legenda</span><textarea class="entrada" name="legenda" rows="5">${esc(p.legenda || '')}</textarea></label>
        <label class="campo largo"><span>Referências (uma por linha: nome | link)</span><textarea class="entrada" name="referencias" rows="3" placeholder="TikTok ref. 1 | https://…">${esc((p.referencias || []).map((r) => `${r.rotulo} | ${r.url}`).join('\n'))}</textarea></label>
        <label class="campo largo"><span>Nota interna (o cliente não vê)</span><textarea class="entrada" name="notaInterna" rows="2">${esc(p.notaInterna || '')}</textarea></label>
        <label class="campo"><span>Status</span><select class="entrada" name="status">${Object.entries(STATUS).map(([k, s]) => `<option value="${k}"${k === (p.status || 'pauta') ? ' selected' : ''}>${s.nome}</option>`).join('')}</select></label>
      </form>
      <div class="rodape-modal" style="justify-content:flex-start">
        <button class="btn acc" data-salvar>Salvar conteúdo</button>
        <button class="btn claro" data-cancelar>Cancelar</button>
      </div>`;
    const form = el.querySelector('[data-form]');
    let ideiaId = p.ideiaId || null;
    form.querySelector('[data-ideia]').onchange = (e) => {
      const i = ideias.find((x) => x.id === e.target.value);
      if (!i) return;
      ideiaId = i.id;
      form.formato.value = i.formato;
      form.pilarId.value = i.pilarId || '';
      form.titulo.value = i.titulo;
      form.gancho.value = i.gancho || '';
      if (i.roteiro) form.roteiro.value = i.roteiro;
      if (i.referencias?.length) form.referencias.value = i.referencias.map((r) => `${r.rotulo} | ${r.url}`).join('\n');
    };
    el.querySelector('[data-cancelar]').onclick = () => (p.id ? mostrar() : fechar());
    el.querySelector('[data-salvar]').onclick = async () => {
      const dados = Object.fromEntries(new FormData(form));
      const referencias = dados.referencias.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const [rotulo, ...resto] = l.split('|');
        const url = (resto.join('|') || rotulo).trim();
        return { rotulo: resto.length ? rotulo.trim() : 'Referência', url };
      });
      const novo = { ...p, ...dados, referencias, ideiaId, id: p.id || undefined };
      try {
        const doc = await enviar({ acao: 'salvar-post', post: novo, trilha: p.trilha });
        if (ideiaId && !ideias.find((i) => i.id === ideiaId)?.usadaEm) {
          const ideia = ideias.find((i) => i.id === ideiaId);
          ctx.definirIdeias(await api(`ideias?cliente=${encodeURIComponent(ctx.cliente.id)}`, { metodo: 'POST', corpo: { acao: 'salvar', ideia: { ...ideia, usadaEm: mes } } }));
        }
        atual = doc.posts.find((x) => x.id === doc.salvoId);
        aviso('Conteúdo salvo.');
        mostrar();
      } catch (err) { falhou(err); }
    };
  }

  if (editar || !post.id) editarPost(); else mostrar();
}
