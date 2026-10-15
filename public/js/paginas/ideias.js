// Banco de ideias: pautas por pilar e formato. A Vie cadastra; o cliente consulta e sugere.
import { api, esc, aviso, falhou, abrirCamada, confirmar, mesAtual, icones } from '../ui.js';
import { FORMATOS, nomeDoMes, corDoPilar } from '../regras.js';
import { etiquetaFormato, etiquetaPilar } from '../componentes/post.js';

export async function render(el, ctx) {
  const { cliente, admin } = ctx;
  const id = encodeURIComponent(cliente.id);
  const acoes = ctx.topo('Geral', 'Banco de ideias', admin
    ? `<button class="btn" data-nova><span>Nova ideia</span><span class="mais">+</span></button>`
    : `<button class="btn" data-nova><span>Sugerir ideia</span><span class="mais">+</span></button>`);
  const editorial = await ctx.editorial();
  const pilares = editorial.pilares || [];
  let ideias = await ctx.ideias(true);
  const filtro = { formato: '', pilar: '', disponiveis: false, busca: '' };

  acoes.querySelector('[data-nova]').onclick = () => editar({});

  function desenhar() {
    const termo = filtro.busca.trim().toLowerCase();
    const lista = ideias.filter((i) => (!filtro.formato || i.formato === filtro.formato)
      && (!filtro.pilar || i.pilarId === filtro.pilar)
      && (!filtro.disponiveis || !i.usadaEm)
      && (!termo || `${i.titulo} ${i.gancho}`.toLowerCase().includes(termo)));
    const sugestoes = ideias.filter((i) => i.origem === 'cliente' && !i.usadaEm).length;

    el.innerHTML = `
      <section class="saudacao"><h1>Banco de ideias</h1><p>${admin
        ? `${ideias.length} ideias cadastradas, ${ideias.filter((i) => !i.usadaEm).length} ainda não usadas${sugestoes ? ` · ${sugestoes} ${sugestoes === 1 ? 'sugestão nova' : 'sugestões novas'} do cliente` : ''}. As ideias livres alimentam o “Montar mês pela linha editorial”.`
        : 'Pautas pensadas para o seu perfil, organizadas por pilar e formato. Teve uma ideia? Use “Sugerir ideia” e ela chega direto para a equipe Vie.'}</p></section>
      <div class="filtros" style="margin-top:22px">
        <button class="filtro${!filtro.formato ? ' ativo' : ''}" data-formato="">Todos</button>
        ${Object.entries(FORMATOS).filter(([k]) => ideias.some((i) => i.formato === k)).map(([k, f]) => `<button class="filtro${filtro.formato === k ? ' ativo' : ''}" data-formato="${k}">${f.nome}</button>`).join('')}
        <span style="width:1px;height:22px;background:var(--line)"></span>
        ${pilares.map((p) => `<button class="filtro${filtro.pilar === p.id ? ' ativo' : ''}" data-pilar="${p.id}"><span class="ponto" style="--cor:${corDoPilar(pilares, p.id)}"></span>${esc(p.nome)}</button>`).join('')}
        <label class="filtro"><input type="checkbox" data-disponiveis ${filtro.disponiveis ? 'checked' : ''}> Só não usadas</label>
        <input class="entrada busca" type="search" placeholder="Buscar ideia…" value="${esc(filtro.busca)}" data-busca>
      </div>
      ${lista.length ? `<div class="grade-ideias">${lista.map(cartao).join('')}</div>` : '<div class="vazio">Nenhuma ideia com esses filtros.</div>'}`;

    el.querySelectorAll('[data-formato]').forEach((b) => { b.onclick = () => { filtro.formato = b.dataset.formato; desenhar(); }; });
    el.querySelectorAll('[data-pilar]').forEach((b) => { b.onclick = () => { filtro.pilar = filtro.pilar === b.dataset.pilar ? '' : b.dataset.pilar; desenhar(); }; });
    el.querySelector('[data-disponiveis]').onchange = (e) => { filtro.disponiveis = e.target.checked; desenhar(); };
    const busca = el.querySelector('[data-busca]');
    busca.oninput = () => {
      filtro.busca = busca.value;
      const pos = busca.selectionStart;
      desenhar();
      const nova = el.querySelector('[data-busca]');
      nova.focus();
      nova.setSelectionRange(pos, pos);
    };
    el.querySelectorAll('[data-editar]').forEach((b) => { b.onclick = () => editar(ideias.find((i) => i.id === b.dataset.editar)); });
    el.querySelectorAll('[data-excluir]').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmar('Esta ideia será removida do banco.', { botao: 'Excluir', perigo: true }))) return;
        try {
          ideias = await api(`ideias?cliente=${id}`, { metodo: 'POST', corpo: { acao: 'excluir', id: b.dataset.excluir } });
          ctx.definirIdeias(ideias);
          desenhar();
        } catch (err) { falhou(err); }
      };
    });
    el.querySelectorAll('[data-usar]').forEach((b) => { b.onclick = () => usarNoCronograma(ideias.find((i) => i.id === b.dataset.usar)); });
  }

  function cartao(i) {
    const podeEditar = admin || (i.origem === 'cliente' && i.autor === ctx.usuario.email && !i.usadaEm);
    return `
      <article class="cartao ideia${i.usadaEm ? ' usada' : ''}" style="--cor:${corDoPilar(pilares, i.pilarId)}">
        <div style="display:flex;gap:6px;flex-wrap:wrap">${etiquetaFormato(i.formato)}${etiquetaPilar(pilares, i.pilarId)}</div>
        <h4>${esc(i.titulo)}</h4>
        ${i.gancho ? `<p class="gancho">“${esc(i.gancho)}”</p>` : ''}
        ${i.roteiro ? `<p style="font-size:13.5px;white-space:pre-wrap">${esc(i.roteiro)}</p>` : ''}
        ${(i.referencias || []).length ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${i.referencias.map((r) => `<a class="etq" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.rotulo)} ↗</a>`).join('')}</div>` : ''}
        <div class="rodape-ideia">
          ${i.usadaEm ? `<span class="etq">Usada em ${esc(nomeDoMes(i.usadaEm, { curto: true }))}</span>` : ''}
          ${i.origem === 'cliente' ? `<span class="etq cheia" style="--cor:var(--s-aprovacao)">Sugestão ${esc(i.autorNome ? `de ${i.autorNome.split(' ')[0]}` : 'do cliente')}</span>` : ''}
          <span style="margin-left:auto"></span>
          ${admin && !i.usadaEm ? `<button class="btn claro peq" data-usar="${i.id}">Usar no cronograma</button>` : ''}
          ${podeEditar ? `<button class="btn-icone" data-editar="${i.id}" title="Editar">${icones.editar}</button><button class="btn-icone" data-excluir="${i.id}" title="Excluir">${icones.lixo}</button>` : ''}
        </div>
      </article>`;
  }

  function editar(ideia) {
    const m = abrirCamada(`
      <h2>${ideia.id ? 'Editar ideia' : admin ? 'Nova ideia' : 'Sugerir uma ideia'}</h2>
      <div class="grade-campos">
        <label class="campo"><span>Formato</span><select class="entrada" name="formato">${Object.entries(FORMATOS).map(([k, f]) => `<option value="${k}"${k === (ideia.formato || 'reel') ? ' selected' : ''}>${f.curto}</option>`).join('')}</select></label>
        <label class="campo"><span>Pilar</span><select class="entrada" name="pilarId"><option value="">—</option>${pilares.map((p) => `<option value="${p.id}"${p.id === ideia.pilarId ? ' selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
        <label class="campo largo"><span>Título / tema</span><input class="entrada" name="titulo" value="${esc(ideia.titulo || '')}" autofocus></label>
        <label class="campo largo"><span>Gancho, fala de abertura ou capa</span><textarea class="entrada" name="gancho" rows="3">${esc(ideia.gancho || '')}</textarea></label>
        <label class="campo largo"><span>${admin ? 'Roteiro / direcionamento' : 'Detalhes (opcional)'}</span><textarea class="entrada" name="roteiro" rows="4">${esc(ideia.roteiro || '')}</textarea></label>
        <label class="campo largo"><span>Referências (uma por linha: nome | link)</span><textarea class="entrada" name="referencias" rows="2">${esc((ideia.referencias || []).map((r) => `${r.rotulo} | ${r.url}`).join('\n'))}</textarea></label>
      </div>
      <div class="rodape-modal"><button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>${admin || ideia.id ? 'Salvar' : 'Enviar sugestão'}</button></div>`, { largo: true });
    m.el.querySelector('[data-ok]').onclick = async () => {
      const dados = Object.fromEntries([...m.el.querySelectorAll('[name]')].map((c) => [c.name, c.value]));
      dados.referencias = dados.referencias.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const [rotulo, ...resto] = l.split('|');
        return resto.length ? { rotulo: rotulo.trim(), url: resto.join('|').trim() } : { rotulo: 'Referência', url: rotulo.trim() };
      });
      try {
        ideias = await api(`ideias?cliente=${id}`, { metodo: 'POST', corpo: { acao: 'salvar', ideia: { ...ideia, ...dados } } });
        ctx.definirIdeias(ideias);
        m.fechar();
        aviso(admin || ideia.id ? 'Ideia salva.' : 'Sugestão enviada para a equipe Vie!');
        desenhar();
      } catch (err) { falhou(err); }
    };
  }

  function usarNoCronograma(ideia) {
    const mes = mesAtual();
    const m = abrirCamada(`
      <h2>Usar no cronograma</h2>
      <p class="muted">“${esc(ideia.titulo)}” vira um conteúdo planejado no dia escolhido.</p>
      <div class="grade-campos">
        <label class="campo"><span>Data</span><input class="entrada" type="date" name="data" value="${mes}-${String(new Date().getDate()).padStart(2, '0')}"></label>
        <label class="campo"><span>Horário</span><input class="entrada" name="horario" placeholder="Ex.: 18h–21h"></label>
      </div>
      <div class="rodape-modal"><button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>Adicionar ao cronograma</button></div>`);
    m.el.querySelector('[data-ok]').onclick = async () => {
      const data = m.el.querySelector('[name=data]').value;
      if (!data) return aviso('Escolha a data.', { erro: true });
      const mesPost = data.slice(0, 7);
      try {
        await api(`cronograma?cliente=${id}&mes=${mesPost}`, { metodo: 'POST', corpo: { acao: 'salvar-post', post: {
          data, horario: m.el.querySelector('[name=horario]').value, formato: ideia.formato, pilarId: ideia.pilarId,
          titulo: ideia.titulo, gancho: ideia.gancho, roteiro: ideia.roteiro, referencias: ideia.referencias, ideiaId: ideia.id, status: 'pauta',
        } } });
        ideias = await api(`ideias?cliente=${id}`, { metodo: 'POST', corpo: { acao: 'salvar', ideia: { ...ideia, usadaEm: mesPost } } });
        ctx.definirIdeias(ideias);
        m.fechar();
        aviso(`Adicionada ao cronograma de ${nomeDoMes(mesPost)}.`);
        desenhar();
      } catch (err) { falhou(err); }
    };
  }

  desenhar();
}
