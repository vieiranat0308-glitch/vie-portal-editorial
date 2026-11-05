// Moodboard: o roteiro de gravação de vídeo e foto das próximas produções
// (PDF ou Word, ou link do Drive/Canva), que o cliente aprova ou pede alteração.
import { api, esc, aviso, falhou, abrirCamada, confirmar, dataLonga, quando, icones } from '../ui.js';
import { mostrarPdf } from '../componentes/leitor-pdf.js';
import { rotaPlanejamento, botoesAprovacao, faixaAprovarTodos, conversa, ultimoPedido, ligarAprovacao, etiquetaStatus } from '../componentes/planejamento.js';

const TIPOS = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
};

export async function render(el, ctx) {
  const { admin } = ctx;
  const rota = rotaPlanejamento(ctx, 'moodboard');
  const acoes = ctx.topo('Geral', 'Moodboard', admin ? `
    <button class="btn claro" data-novo-link>${icones.link}Adicionar link</button>
    <button class="btn" data-novo-arquivo><span>Enviar moodboard</span><span class="mais">+</span></button>` : '');
  let lista = await api(rota);
  acoes.querySelector('[data-novo-arquivo]')?.addEventListener('click', () => formulario({ modo: 'arquivo' }));
  acoes.querySelector('[data-novo-link]')?.addEventListener('click', () => formulario({ modo: 'link' }));

  const arquivoUrl = (m, baixar) => `/api/${rota}&arquivo=${encodeURIComponent(m.arquivo.id)}${baixar ? '&baixar=1' : ''}`;
  const ehPdf = (m) => m.arquivo?.tipo === TIPOS.pdf;

  function desenhar() {
    // Mais recentes (e as produções que vêm primeiro) no topo.
    const ordenada = lista.slice().sort((a, b) => (b.data || b.criadoEm).localeCompare(a.data || a.criadoEm));
    el.innerHTML = `
      <section class="saudacao"><h1>Moodboard</h1><p>${admin
        ? 'Roteiros de gravação de vídeo e foto das próximas produções. Envie em PDF (aparece aqui dentro) ou Word, ou um link do Drive/Canva: o cliente aprova ou pede alteração.'
        : 'O roteiro das próximas produções de vídeo e foto: referências, looks, cenas e falas. Dê uma olhada e aprove, ou peça alteração.'}</p></section>
      ${faixaAprovarTodos(lista, admin, 'moodboards')}
      <div style="display:grid;gap:14px;margin-top:20px">
        ${ordenada.length ? ordenada.map(cartao).join('') : `<div class="vazio"><strong>Nenhum moodboard ainda</strong>${admin ? 'Envie o roteiro da próxima produção em PDF ou Word (até 4 MB), ou um link.' : 'Quando a equipe preparar o roteiro da próxima produção, ele aparece aqui para você aprovar.'}</div>`}
      </div>`;

    ligarAprovacao(el, { ctx, tipo: 'moodboard', itens: () => lista, nome: 'moodboards', aoMudar: (l) => { lista = l; desenhar(); } });
    el.querySelectorAll('[data-ver]').forEach((b) => { b.onclick = () => ver(lista.find((m) => m.id === b.dataset.ver)); });
    el.querySelectorAll('[data-editar]').forEach((b) => { b.onclick = () => formulario({ item: lista.find((m) => m.id === b.dataset.editar) }); });
    el.querySelectorAll('[data-substituir]').forEach((b) => { b.onclick = () => formulario({ modo: 'arquivo', item: lista.find((m) => m.id === b.dataset.substituir), substituir: true }); });
    el.querySelectorAll('[data-excluir]').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmar('O moodboard e o arquivo dele saem do portal.', { botao: 'Excluir', perigo: true }))) return;
        try { lista = await api(rota, { metodo: 'POST', corpo: { acao: 'excluir', id: b.dataset.excluir } }); desenhar(); } catch (err) { falhou(err); }
      };
    });
  }

  function cartao(m) {
    const formato = m.url ? 'Link' : ehPdf(m) ? 'PDF' : 'Word';
    return `
      <article class="cartao cartao-moodboard">
        <div class="cab-moodboard">
          <span class="icone-doc">${formato === 'Link' ? 'LINK' : formato.toUpperCase()}</span>
          <div style="min-width:0;flex:1">
            <h3 class="serif" style="font-size:22px">${esc(m.titulo)}</h3>
            <p class="muted" style="font-size:13px">${[m.data ? `Produção: ${dataLonga(m.data)}` : '', m.versao > 1 ? `versão ${m.versao}` : '', `enviado em ${quando(m.criadoEm)}`].filter(Boolean).map(esc).join(' · ')}</p>
          </div>
          ${etiquetaStatus(m.status)}
        </div>
        ${m.descricao ? `<p class="texto-moodboard">${esc(m.descricao)}</p>` : ''}
        ${ultimoPedido(m)}
        <div class="botoes-aprovacao">
          ${m.url
            ? `<a class="btn claro" href="${esc(m.url)}" target="_blank" rel="noopener">${icones.link}Abrir moodboard</a>`
            : ehPdf(m) ? `<button class="btn claro" data-ver="${esc(m.id)}">Ver moodboard</button>`
              : `<a class="btn claro" href="${arquivoUrl(m, true)}">${icones.baixar}Baixar (Word)</a>`}
          ${botoesAprovacao(m, admin)}
          ${admin ? `
            <span style="margin-left:auto;display:flex;gap:6px">
              ${m.url ? '' : `<button class="btn fantasma peq" data-substituir="${esc(m.id)}">Nova versão</button>`}
              <button class="btn-icone" data-editar="${esc(m.id)}" title="Editar">${icones.editar}</button>
              <button class="btn-icone" data-excluir="${esc(m.id)}" title="Excluir">${icones.lixo}</button>
            </span>` : ''}
        </div>
        ${conversa(m)}
      </article>`;
  }

  // PDF aberto dentro do portal (página por página, também no celular).
  function ver(m) {
    const camada = abrirCamada(`
      <div class="cab-gaveta"><b style="flex:1">${esc(m.titulo)}</b>
        <a class="btn claro peq" href="${arquivoUrl(m, true)}">${icones.baixar}Baixar</a>
        <button class="btn-icone" data-fechar title="Fechar">${icones.fechar}</button></div>
      <div class="corpo"><div class="leitor-pdf" data-leitor></div>
        <div class="botoes-aprovacao" style="margin-top:14px">${botoesAprovacao(m, admin)}</div></div>`, { gaveta: true, aoFechar: () => {} });
    mostrarPdf(camada.el.querySelector('[data-leitor]'), arquivoUrl(m));
    ligarAprovacao(camada.el, { ctx, tipo: 'moodboard', itens: () => lista, nome: 'moodboards', aoMudar: (l) => { lista = l; camada.fechar(); desenhar(); } });
  }

  function formulario({ modo, item, substituir = false }) {
    const editando = item && !substituir;
    const m = abrirCamada(`
      <h2>${substituir ? 'Nova versão do moodboard' : editando ? 'Editar moodboard' : modo === 'link' ? 'Moodboard por link' : 'Enviar moodboard'}</h2>
      ${substituir ? `<p class="muted">${esc(item.titulo)}: a versão nova volta para a aprovação do cliente.</p>` : ''}
      <div class="grade-campos">
        ${modo === 'arquivo' ? '<label class="campo largo"><span>Arquivo (PDF ou Word, até 4 MB)</span><input class="entrada" name="arquivo" type="file" accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"></label>' : ''}
        ${modo === 'link' || (editando && item.url) ? `<label class="campo largo"><span>Link (Drive, Canva, Docs…)</span><input class="entrada" name="url" type="url" placeholder="https://" value="${esc(item?.url || '')}"></label>` : ''}
        ${substituir ? '' : `
          <label class="campo largo"><span>Título</span><input class="entrada" name="titulo" placeholder="Ex.: Produção de novembro · consultório" value="${esc(item?.titulo || '')}"></label>
          <label class="campo"><span>Data da produção (opcional)</span><input class="entrada" type="date" name="data" value="${esc(item?.data || '')}"></label>
          <label class="campo largo"><span>Recado para o cliente (opcional)</span><textarea class="entrada" name="descricao" rows="3" placeholder="Ex.: separe 3 looks claros e um jaleco">${esc(item?.descricao || '')}</textarea></label>`}
      </div>
      <p class="muted" style="font-size:12.5px">PDF aparece dentro do portal. Word o cliente baixa e abre no celular ou no computador; se puder, exporte em PDF.</p>
      <div class="rodape-modal"><button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>${substituir ? 'Enviar nova versão' : 'Salvar'}</button></div>`);
    const campo = (n) => m.el.querySelector(`[name=${n}]`);
    campo('arquivo')?.addEventListener('change', () => {
      const f = campo('arquivo').files[0];
      if (f && campo('titulo') && !campo('titulo').value) campo('titulo').value = f.name.replace(/\.[^.]+$/, '');
    });
    m.el.querySelector('[data-ok]').onclick = async (ev) => {
      const dados = { titulo: campo('titulo')?.value || item?.titulo || '', data: campo('data')?.value || '', descricao: campo('descricao')?.value || '', url: campo('url')?.value || '' };
      ev.target.disabled = true;
      try {
        if (modo === 'arquivo') {
          const f = campo('arquivo').files[0];
          if (!f) throw new Error('Escolha o arquivo.');
          const ext = f.name.split('.').pop().toLowerCase();
          const mime = TIPOS[ext] || f.type;
          if (!Object.values(TIPOS).includes(mime)) throw new Error('Envie o moodboard em PDF ou Word (.docx).');
          if (f.size > 4 * 1024 * 1024) throw new Error('Arquivo acima de 4 MB. Exporte o PDF em qualidade menor ou mande como link.');
          const q = new URLSearchParams({ mime, nome: f.name, ...(substituir ? { id: item.id } : { titulo: dados.titulo, data: dados.data, descricao: dados.descricao }) });
          lista = await api(`${rota}&${q}`, { metodo: 'POST', arquivo: f });
        } else {
          lista = await api(rota, { metodo: 'POST', corpo: { acao: 'salvar', item: { ...(item ? { id: item.id } : {}), ...dados } } });
        }
        m.fechar();
        aviso(substituir ? 'Nova versão enviada. O cliente foi avisado.' : editando ? 'Moodboard salvo.' : 'Moodboard enviado para a aprovação do cliente.');
        desenhar();
      } catch (err) {
        falhou(err);
        ev.target.disabled = false;
      }
    };
  }

  desenhar();
}
