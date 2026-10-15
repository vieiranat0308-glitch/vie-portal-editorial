// Linha editorial: leitura em formato de documento e editor estruturado (Vie).
import { api, esc, aviso, falhou, icones, iniciais } from '../ui.js';
import { FORMATOS, DIAS_SEMANA, corDoPilar } from '../regras.js';
import { formularioSecao } from '../componentes/formulario.js';

// Estrutura do editor: cada seção vira uma aba com seus campos.
const SECOES = [
  { id: 'capa', titulo: 'Capa', campos: [
    { k: 'periodo', rotulo: 'Período (ex.: Out · 2026)' },
    { k: 'subtitulo', rotulo: 'Subtítulo' },
  ] },
  { id: 'objetivo', titulo: 'Objetivo', campos: [
    { k: 'objetivo.titulo', rotulo: 'Objetivo estratégico', tipo: 'area' },
    { k: 'objetivo.acompanhar', rotulo: 'Vamos acompanhar todo mês (um por linha)', tipo: 'linhas' },
  ] },
  { id: 'posicionamento', titulo: 'Posicionamento', campos: [
    { k: 'posicionamento.texto', rotulo: 'Posicionamento', tipo: 'area' },
    { k: 'posicionamento.publico', rotulo: 'Público-norte', tipo: 'area' },
  ] },
  { id: 'tom', titulo: 'Tom de voz', campos: [
    { k: 'tom.titulo', rotulo: 'Persona em uma frase' },
    { k: 'tom.soa', rotulo: 'Como soa', tipo: 'area' },
    { k: 'tom.naoSoa', rotulo: 'Como não soa', tipo: 'area' },
    { k: 'tom.bordao', rotulo: 'Bordão', tipo: 'area' },
  ] },
  { id: 'bio', titulo: 'Bio', campos: [
    { k: 'bio.texto', rotulo: 'Bio do perfil', tipo: 'area' },
    { k: 'bio.oQueMudou', rotulo: 'O que mudou', tipo: 'area' },
  ] },
  { id: 'destaques', titulo: 'Destaques', campos: [
    { k: 'destaques', rotulo: 'Destaque', tipo: 'lista', item: [{ k: 'nome', rotulo: 'Nome' }, { k: 'descricao', rotulo: 'O que entra', tipo: 'area' }] },
  ] },
  { id: 'pilares', titulo: 'Pilares', campos: [
    { k: 'pilares', rotulo: 'Pilar', tipo: 'lista', item: [
      { k: 'nome', rotulo: 'Nome do pilar' },
      { k: 'percentual', rotulo: 'Percentual do feed (%)', tipo: 'numero' },
      { k: 'descricao', rotulo: 'Descrição', tipo: 'area', largo: true },
      { k: 'formatos', rotulo: 'Formatos sugeridos', largo: true },
    ] },
  ] },
  { id: 'frequencia', titulo: 'Frequência', campos: [
    { k: 'frequencia.resumo', rotulo: 'Resumo (ex.: cerca de 20 posts por mês)' },
    { k: 'frequencia.gravacao', rotulo: 'Gravação' },
    { k: 'frequencia.slots', rotulo: 'Publicação na semana', tipo: 'lista', item: [
      { k: 'dia', rotulo: 'Dia', tipo: 'dia' },
      { k: 'horario', rotulo: 'Horário' },
      { k: 'formato', rotulo: 'Formato', tipo: 'formato' },
      { k: 'pilares', rotulo: 'Pilar (se marcar mais de um, eles se alternam)', tipo: 'pilares', largo: true },
    ] },
  ] },
  { id: 'estrategias', titulo: 'Estratégias', campos: [
    { k: 'estrategias', rotulo: 'Estratégia especial', tipo: 'lista', item: [
      { k: 'rotulo', rotulo: 'Rótulo (ex.: Reels de teste)' },
      { k: 'titulo', rotulo: 'Título' },
      { k: 'destaque', rotulo: 'Número em destaque (ex.: 28%)' },
      { k: 'texto', rotulo: 'Texto ao lado do número', tipo: 'area', largo: true },
      { k: 'nota', rotulo: 'Nota em destaque', tipo: 'area', largo: true },
      { k: 'passos', rotulo: 'Passo', tipo: 'lista', largo: true, item: [{ k: 'titulo', rotulo: 'Título' }, { k: 'texto', rotulo: 'Texto' }] },
    ] },
  ] },
  { id: 'stories', titulo: 'Stories', campos: [
    { k: 'stories.resumo', rotulo: 'Todos os dias', tipo: 'area' },
    { k: 'stories.dias', rotulo: 'Dia de stories', tipo: 'lista', item: [
      { k: 'dia', rotulo: 'Dia (ex.: Segunda, Sexta a domingo)' },
      { k: 'titulo', rotulo: 'Tema do dia' },
      { k: 'itens', rotulo: 'O que postar (um por linha)', tipo: 'linhas', largo: true },
    ] },
  ] },
  { id: 'series', titulo: 'Séries', campos: [
    { k: 'series', rotulo: 'Série', tipo: 'lista', item: [
      { k: 'nome', rotulo: 'Nome da série', largo: true },
      { k: 'episodios', rotulo: 'Episódio', tipo: 'lista', largo: true, item: [
        { k: 'titulo', rotulo: 'Episódio' },
        { k: 'formato', rotulo: 'Formato' },
        { k: 'fala', rotulo: 'Fala de abertura', tipo: 'area', largo: true },
        { k: 'referencias', rotulo: 'Referências', tipo: 'links', largo: true },
      ] },
    ] },
  ] },
  { id: 'formato', titulo: 'Formato', campos: [
    { k: 'formato.titulo', rotulo: 'Frase de destaque' },
    { k: 'formato.texto', rotulo: 'Explicação', tipo: 'area' },
  ] },
  { id: 'passos', titulo: 'Próximos passos', campos: [
    { k: 'proximosPassos', rotulo: 'Passo', tipo: 'lista', item: [{ k: 'titulo', rotulo: 'Título' }, { k: 'texto', rotulo: 'Texto', tipo: 'area' }] },
  ] },
];

export async function render(el, ctx) {
  const editorial = await ctx.editorial();
  if (ctx.rota.extra === 'editar' && ctx.admin) return editor(el, ctx, editorial);
  leitura(el, ctx, editorial);
}

function leitura(el, ctx, e) {
  const { cliente, admin } = ctx;
  ctx.topo('Geral', 'Linha editorial', `
    <button class="btn claro" onclick="window.print()">${icones.imprimir}Imprimir / PDF</button>
    ${admin ? `<a class="btn" href="#${ctx.base}/linha/editar">${icones.editar}Editar</a>` : ''}`);

  const pilares = e.pilares || [];
  const vazio = !Object.keys(e).filter((k) => k !== 'atualizadoEm').length;
  if (vazio) {
    el.innerHTML = `<div class="vazio"><strong>Linha editorial em construção</strong>${admin ? 'Clique em “Editar” para preencher a estratégia deste cliente.' : 'A equipe Vie está finalizando a sua estratégia de conteúdo.'}</div>`;
    return;
  }

  const secoes = [];
  const add = (id, nome, html) => { if (html) secoes.push({ id, nome, html }); };

  add('objetivo', 'Objetivo', e.objetivo?.titulo && `
    <section class="doc-secao" id="objetivo">
      <span class="rotulo">Objetivo estratégico</span>
      <p class="frase-grande" style="color:var(--acc-ink);margin-top:10px">${esc(e.objetivo.titulo)}</p>
      ${e.objetivo.acompanhar?.length ? `<div style="margin-top:26px"><span class="rotulo">Vamos acompanhar todo mês</span><div class="chips-doc">${e.objetivo.acompanhar.map((x) => `<span>${esc(x)}</span>`).join('')}</div></div>` : ''}
    </section>`);

  add('posicionamento', 'Posicionamento', e.posicionamento?.texto && `
    <section class="doc-secao doc-posicionamento" id="posicionamento">
      <span class="rotulo">Posicionamento</span>
      <p class="frase-grande" style="margin-top:14px">${esc(e.posicionamento.texto)}</p>
      ${e.posicionamento.publico ? `<div class="divisor"></div><span class="rotulo">Público-norte</span><p style="font-size:17px;margin-top:8px;max-width:70ch">${esc(e.posicionamento.publico)}</p>` : ''}
    </section>`);

  add('tom', 'Tom de voz', (e.tom?.soa || e.tom?.titulo) && `
    <section class="doc-secao" id="tom">
      <span class="rotulo">Tom de voz e persona</span>
      <h2>${esc(e.tom.titulo || 'Como a marca fala')}</h2>
      <div class="tres">
        ${e.tom.soa ? `<div class="bloco-doc"><span class="rotulo">Como soa</span><p>${esc(e.tom.soa)}</p></div>` : ''}
        ${e.tom.naoSoa ? `<div class="bloco-doc" style="border-top-color:var(--s-ajuste)"><span class="rotulo">Como não soa</span><p>${esc(e.tom.naoSoa)}</p></div>` : ''}
        ${e.tom.bordao ? `<div class="bloco-doc"><span class="rotulo">Bordão</span><p class="serif">“${esc(e.tom.bordao)}”</p></div>` : ''}
      </div>
    </section>`);

  add('bio', 'Bio', e.bio?.texto && `
    <section class="doc-secao" id="bio">
      <span class="rotulo">Bio</span>
      <h2>A bio do perfil</h2>
      <div class="bio-mock">
        <div class="ig">
          <div class="cab-ig"><span class="avatar">${esc(iniciais(cliente.nome))}</span><div><b>${esc(cliente.instagram ? cliente.instagram : cliente.nome)}</b><div class="muted" style="font-size:13px">${esc(cliente.nome)}</div></div></div>
          <p class="bio">${esc(e.bio.texto)}</p>
        </div>
        ${e.bio.oQueMudou ? `<div><span class="rotulo">O que mudou</span><p style="margin-top:8px;font-size:16px">${esc(e.bio.oQueMudou)}</p></div>` : ''}
      </div>
    </section>`);

  add('destaques', 'Destaques', e.destaques?.length && `
    <section class="doc-secao" id="destaques">
      <span class="rotulo">Destaques</span>
      <h2>A vitrine do perfil</h2>
      <div class="quatro">${e.destaques.map((d) => `
        <div class="destaque-circulo"><span class="circulo">${esc((d.nome || '?').trim()[0])}</span><h4>${esc(d.nome)}</h4><p>${esc(d.descricao)}</p></div>`).join('')}
      </div>
    </section>`);

  add('pilares', 'Pilares', pilares.length && `
    <section class="doc-secao" id="pilares">
      <span class="rotulo">Pilares do feed</span>
      <h2>${pilares.length} pilares, uma direção</h2>
      <div class="barra-pilares">${pilares.map((p) => `<span style="flex:${p.percentual || 1};--cor:${corDoPilar(pilares, p.id)}" title="${esc(p.nome)}"></span>`).join('')}</div>
      <div class="${pilares.length === 3 ? 'tres' : 'quatro'}">${pilares.map((p) => `
        <div class="pilar-doc" style="--cor:${corDoPilar(pilares, p.id)}">
          ${p.percentual ? `<span class="pct">${esc(p.percentual)}%</span>` : ''}
          <h4>${esc(p.nome)}</h4>
          <p>${esc(p.descricao)}</p>
          ${p.formatos ? `<p class="fmt">${esc(p.formatos)}</p>` : ''}
        </div>`).join('')}
      </div>
    </section>`);

  const slots = e.frequencia?.slots || [];
  add('frequencia', 'Frequência', slots.length && `
    <section class="doc-secao" id="frequencia">
      <span class="rotulo">Frequência do feed</span>
      <h2>${slots.length} ${slots.length === 1 ? 'publicação' : 'publicações'} por semana</h2>
      <div class="semana-doc">
        ${[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const doDia = slots.filter((s) => Number(s.dia) === d);
          return `<div class="dia-doc${doDia.length ? '' : ' sem-slot'}"><span class="mono">${DIAS_SEMANA[d]}</span>${doDia.map((s) => {
            const nomes = (s.pilares || []).map((id) => pilares.find((p) => p.id === id)?.nome).filter(Boolean);
            return `<div class="slot" style="--cor:${corDoPilar(pilares, s.pilares?.[0])}"><b>${esc(FORMATOS[s.formato]?.curto || s.formato)}</b><span class="muted">${esc(s.horario || '')}</span><span>${esc(nomes.join(' / ') || '')}</span></div>`;
          }).join('')}</div>`;
        }).join('')}
      </div>
      ${e.frequencia.resumo || e.frequencia.gravacao ? `<div style="display:flex;gap:28px;flex-wrap:wrap;margin-top:20px;padding-top:16px;border-top:1px solid var(--line)">
        ${e.frequencia.resumo ? `<p><b style="color:var(--acc-ink)">Por mês:</b> ${esc(e.frequencia.resumo)}</p>` : ''}
        ${e.frequencia.gravacao ? `<p><b style="color:var(--acc-ink)">Gravação:</b> ${esc(e.frequencia.gravacao)}</p>` : ''}
      </div>` : ''}
    </section>`);

  (e.estrategias || []).forEach((s, i) => add(`estrategia-${i}`, s.rotulo || 'Estratégia', `
    <section class="doc-secao" id="estrategia-${i}">
      <span class="rotulo">${esc(s.rotulo)}</span>
      <h2>${esc(s.titulo)}</h2>
      <div class="estrategia">
        <div>
          ${s.destaque ? `<div class="grande">${esc(s.destaque)}</div>` : ''}
          ${s.texto ? `<p style="font-size:16px;margin-top:10px">${esc(s.texto)}</p>` : ''}
          ${s.nota ? `<div class="nota-doc">${esc(s.nota)}</div>` : ''}
        </div>
        ${s.passos?.length ? `<div class="passos">${s.passos.map((p, n) => `<div class="passo"><span class="n">${String(n + 1).padStart(2, '0')}</span><div><b>${esc(p.titulo)}</b><p>${esc(p.texto)}</p></div></div>`).join('')}</div>` : '<div></div>'}
      </div>
    </section>`));

  add('stories', 'Stories', (e.stories?.dias?.length || e.stories?.resumo) && `
    <section class="doc-secao" id="stories">
      <span class="rotulo">Stories</span>
      <h2>A semana de stories</h2>
      ${e.stories.resumo ? `<p style="font-size:16px;margin:-8px 0 20px">${esc(e.stories.resumo)}</p>` : ''}
      <div class="dias-stories">${(e.stories.dias || []).map((d) => `
        <div class="bloco-doc"><span class="rotulo">${esc(d.dia)}</span><p class="serif">${esc(d.titulo)}</p><ul>${(d.itens || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}
      </div>
    </section>`);

  (e.series || []).forEach((s, i) => add(`serie-${i}`, 'Série', `
    <section class="doc-secao" id="serie-${i}">
      <span class="rotulo">Série especial</span>
      <h2>${esc(s.nome)}</h2>
      <div class="tres">${(s.episodios || []).map((ep) => `
        <div class="bloco-doc episodio">
          <span class="rotulo">${esc(ep.titulo)}</span>
          <p class="serif" style="font-size:17px">${esc(ep.formato)}</p>
          ${ep.fala ? `<p class="fala">“${esc(ep.fala)}”</p>` : ''}
          ${(ep.referencias || []).map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.rotulo)} ↗</a>`).join('')}
        </div>`).join('')}
      </div>
    </section>`));

  add('formato', 'Formato', e.formato?.titulo && `
    <section class="doc-secao doc-formato" id="formato">
      <span class="rotulo">Formato de conteúdo</span>
      <p class="frase-grande titulo-grande" style="margin:14px 0 18px">${esc(e.formato.titulo)}</p>
      <p style="font-size:17px;max-width:60ch;position:relative;z-index:1">${esc(e.formato.texto)}</p>
    </section>`);

  add('passos', 'Próximos passos', e.proximosPassos?.length && `
    <section class="doc-secao" id="passos">
      <span class="rotulo">Próximos passos</span>
      <h2>Daqui para a frente</h2>
      <div class="passos-cartoes">${e.proximosPassos.map((p, n) => `
        <div class="bloco-doc"><span class="n">${String(n + 1).padStart(2, '0')}</span><h4>${esc(p.titulo)}</h4><p>${esc(p.texto)}</p></div>`).join('')}
      </div>
    </section>`);

  el.innerHTML = `
    <div class="doc">
      <header class="doc-capa">
        <div class="topo-capa"><img class="logo-img" src="/img/logo-creme.png" alt="Vie Company" style="width:120px"><span class="mono" style="color:var(--creme-2)">${esc(e.periodo || '')}</span></div>
        <div>
          <p class="rotulo">Estratégia de conteúdo</p>
          <h1>${esc(cliente.nome)}</h1>
          ${e.subtitulo ? `<p class="sub">${esc(e.subtitulo)}</p>` : ''}
        </div>
      </header>
      <nav class="indice-doc nao-imprimir">${secoes.map((s) => `<a href="#" data-ancora="${s.id}">${esc(s.nome)}</a>`).join('')}<a href="#${ctx.base}/ideias" style="margin-left:auto;color:var(--acc)">Banco de ideias →</a></nav>
      ${secoes.map((s) => s.html).join('')}
    </div>`;
  el.querySelectorAll('[data-ancora]').forEach((a) => {
    a.onclick = (ev) => {
      ev.preventDefault();
      document.getElementById(a.dataset.ancora)?.scrollIntoView({ behavior: 'smooth' });
    };
  });
}

function editor(el, ctx, original) {
  const rascunho = structuredClone(original);
  let secaoAtual = 'capa';
  const acoes = ctx.topo('Linha editorial', 'Editar', `
    <a class="btn claro" href="#${ctx.base}/linha">Cancelar</a>
    <button class="btn acc" data-salvar>Salvar linha editorial</button>`);

  function desenhar() {
    el.innerHTML = `
      <div class="editor">
        <nav class="menu-secoes">${SECOES.map((s) => `<button data-secao="${s.id}" class="${s.id === secaoAtual ? 'ativo' : ''}">${s.titulo}</button>`).join('')}</nav>
        <div class="cartao"><div class="form-secao" data-form></div></div>
      </div>`;
    const secao = SECOES.find((s) => s.id === secaoAtual);
    formularioSecao(el.querySelector('[data-form]'), secao, rascunho, { pilares: () => rascunho.pilares || [] });
    el.querySelectorAll('[data-secao]').forEach((b) => {
      b.onclick = () => { secaoAtual = b.dataset.secao; desenhar(); };
    });
  }

  acoes.querySelector('[data-salvar]').onclick = async (ev) => {
    ev.target.disabled = true;
    try {
      const salvo = await api(`editorial?cliente=${encodeURIComponent(ctx.cliente.id)}`, { metodo: 'PUT', corpo: rascunho });
      ctx.definirEditorial(salvo);
      aviso('Linha editorial salva.');
      ctx.ir(`${ctx.base}/linha`);
    } catch (err) {
      falhou(err);
      ev.target.disabled = false;
    }
  };
  desenhar();
}
