// Documentos entregues ao cliente: arquivos (PDF/imagem) e links (Drive, Canva…).
import { api, esc, aviso, falhou, abrirCamada, confirmar, mesAtual, icones } from '../ui.js';
import { nomeDoMes } from '../regras.js';

const CATEGORIAS = {
  'linha-editorial': 'Linha editorial',
  cronograma: 'Cronogramas',
  relatorio: 'Relatórios',
  material: 'Materiais de apoio',
  outro: 'Outros',
};

export async function render(el, ctx) {
  const { cliente, admin } = ctx;
  const id = encodeURIComponent(cliente.id);
  const acoes = ctx.topo('Acompanhamento', 'Documentos', admin ? `
    <button class="btn claro" data-link>${icones.link}Adicionar link</button>
    <button class="btn" data-arquivo><span>Enviar arquivo</span><span class="mais">+</span></button>` : '');
  let docs = await api(`documentos?cliente=${id}`);

  acoes.querySelector('[data-link]')?.addEventListener('click', () => formulario('link'));
  acoes.querySelector('[data-arquivo]')?.addEventListener('click', () => formulario('arquivo'));

  function desenhar() {
    el.innerHTML = `
      <section class="saudacao"><h1>Documentos</h1><p>${admin ? 'Tudo o que foi entregue a este cliente fica guardado aqui.' : 'Tudo o que a Vie entregou para você, organizado e sempre à mão.'}</p></section>
      <div style="margin-top:22px">
        ${docs.length ? Object.entries(CATEGORIAS).map(([cat, nome]) => {
          const lista = docs.filter((d) => d.categoria === cat);
          if (!lista.length) return '';
          return `<div class="secao-titulo" style="margin-top:22px"><h2>${nome}</h2></div>${lista.map(item).join('')}`;
        }).join('') : `<div class="vazio"><strong>Nenhum documento ainda</strong>${admin ? 'Envie PDFs (até 4 MB) ou adicione links do Drive, Canva ou Netlify.' : 'Os materiais entregues pela Vie aparecem aqui.'}</div>`}
      </div>`;
    el.querySelectorAll('[data-excluir]').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmar('O documento será removido do portal do cliente.', { botao: 'Excluir', perigo: true }))) return;
        try {
          await api(`documentos?cliente=${id}&id=${encodeURIComponent(b.dataset.excluir)}`, { metodo: 'DELETE' });
          docs = docs.filter((d) => d.id !== b.dataset.excluir);
          desenhar();
        } catch (err) { falhou(err); }
      };
    });
  }

  function item(d) {
    const ext = d.url ? 'LINK' : d.tipo === 'application/pdf' ? 'PDF' : 'IMG';
    const baixar = `/api/documentos?cliente=${id}&baixar=${encodeURIComponent(d.id)}`;
    return `
      <div class="doc-item">
        <span class="icone-doc">${ext}</span>
        <div style="min-width:0">
          <div class="nome">${esc(d.nome)}</div>
          <div class="info">${[d.mes ? nomeDoMes(d.mes) : '', d.descricao, d.tamanho ? `${(d.tamanho / 1024 / 1024).toFixed(1)} MB` : '', `enviado em ${new Date(d.criadoEm).toLocaleDateString('pt-BR')}`].filter(Boolean).map(esc).join(' · ')}</div>
        </div>
        <div class="acoes">
          ${d.url
            ? `<a class="btn claro peq" href="${esc(d.url)}" target="_blank" rel="noopener">${icones.link}Abrir</a>`
            : `<a class="btn claro peq" href="${baixar}&abrir=1" target="_blank" rel="noopener">Abrir</a><a class="btn claro peq" href="${baixar}">${icones.baixar}Baixar</a>`}
          ${admin ? `<button class="btn-icone" data-excluir="${esc(d.id)}" title="Excluir">${icones.lixo}</button>` : ''}
        </div>
      </div>`;
  }

  function formulario(tipo) {
    const m = abrirCamada(`
      <h2>${tipo === 'link' ? 'Adicionar link' : 'Enviar arquivo'}</h2>
      <div class="grade-campos">
        ${tipo === 'link'
          ? '<label class="campo largo"><span>Link</span><input class="entrada" name="url" type="url" placeholder="https://" autofocus></label>'
          : '<label class="campo largo"><span>Arquivo (PDF ou imagem, até 4 MB)</span><input class="entrada" name="arquivo" type="file" accept="application/pdf,image/png,image/jpeg,image/webp"></label>'}
        <label class="campo largo"><span>Nome</span><input class="entrada" name="nome" placeholder="Ex.: Estratégia de conteúdo · Out 2026"></label>
        <label class="campo"><span>Categoria</span><select class="entrada" name="categoria">${Object.entries(CATEGORIAS).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
        <label class="campo"><span>Mês de referência</span><input class="entrada" type="month" name="mes" value="${mesAtual()}"></label>
        <label class="campo largo"><span>Descrição (opcional)</span><input class="entrada" name="descricao"></label>
      </div>
      <div class="rodape-modal"><button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>Salvar</button></div>`);
    const arquivo = m.el.querySelector('[name=arquivo]');
    arquivo?.addEventListener('change', () => {
      const nome = m.el.querySelector('[name=nome]');
      if (!nome.value && arquivo.files[0]) nome.value = arquivo.files[0].name.replace(/\.[^.]+$/, '');
    });
    m.el.querySelector('[data-ok]').onclick = async (ev) => {
      const campos = Object.fromEntries([...m.el.querySelectorAll('[name]:not([type=file])')].map((c) => [c.name, c.value]));
      ev.target.disabled = true;
      try {
        let doc;
        if (tipo === 'link') {
          doc = await api(`documentos?cliente=${id}`, { metodo: 'POST', corpo: campos });
        } else {
          const f = arquivo.files[0];
          if (!f) throw new Error('Escolha o arquivo.');
          if (f.size > 4 * 1024 * 1024) throw new Error('Arquivo acima de 4 MB. Comprima o PDF ou adicione como link do Drive.');
          const q = new URLSearchParams({ cliente: cliente.id, tipo: f.type, arquivo: f.name, ...campos });
          doc = await api(`documentos?${q}`, { metodo: 'POST', arquivo: f });
        }
        docs = [doc, ...docs];
        m.fechar();
        aviso('Documento adicionado.');
        desenhar();
      } catch (err) {
        falhou(err);
        ev.target.disabled = false;
      }
    };
  }

  desenhar();
}
