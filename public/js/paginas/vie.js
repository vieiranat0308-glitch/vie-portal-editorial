// Visão da Vie: todos os clientes da assessoria, etiquetados por serviço, e a equipe.
import { api, esc, aviso, falhou, abrirCamada, confirmar, mesAtual, somarMes, saudacao, num, icones } from '../ui.js';
import { STATUS, nomeDoMes } from '../regras.js';
import { camposCliente, lerCliente } from './config.js';
import { painelDeAcessos } from './acessos.js';
import { etiquetasServicos } from '../componentes/servicos.js';

let filtroServico = '';

export async function render(el, ctx) {
  if (ctx.rota.pagina === 'equipe') {
    ctx.topo('Geral', 'Equipe Vie');
    return painelDeAcessos(el, { alvo: 'vie', nomeAlvo: 'Equipe Vie', usuario: ctx.usuario });
  }
  if (ctx.rota.pagina === 'servicos') return paginaServicos(el, ctx);

  let mes = mesAtual();
  let clientes = [];
  const acoes = ctx.topo('Geral', 'Visão geral', `
    <div class="seletor-mes">
      <button data-ir="-1" aria-label="Mês anterior">${icones.esquerda}</button>
      <strong data-mes></strong>
      <button data-ir="1" aria-label="Próximo mês">${icones.direita}</button>
    </div>
    <button class="btn" data-novo><span>Novo cliente</span><span class="mais">+</span></button>`);
  acoes.querySelector('[data-novo]').onclick = () => novoCliente(ctx);
  acoes.querySelectorAll('[data-ir]').forEach((b) => {
    b.onclick = async () => { mes = somarMes(mes, Number(b.dataset.ir)); await carregar(); };
  });

  async function carregar() {
    acoes.querySelector('[data-mes]').textContent = nomeDoMes(mes);
    clientes = await api(`clientes?mes=${mes}`);
    desenhar();
  }

  const temEditorial = (c) => (c.servicos || []).includes('editorial');

  function desenhar() {
    const servicos = ctx.servicos();
    if (filtroServico && !servicos.some((s) => s.id === filtroServico)) filtroServico = '';
    const visiveis = filtroServico ? clientes.filter((c) => (c.servicos || []).includes(filtroServico)) : clientes;
    const soma = (k) => visiveis.reduce((s, c) => s + (c.resumo.porStatus[k] || 0), 0);
    const temCronograma = (c) => c.resumo.total || c.resumo.interativo;
    const semCronograma = visiveis.filter((c) => temEditorial(c) && !temCronograma(c)).length;
    const rascunhos = visiveis.filter((c) => temCronograma(c) && c.resumo.cronograma !== 'publicado').length;
    const mesesEm = (st) => visiveis.filter((c) => c.resumo.cronograma === 'publicado' && c.resumo.aprovacaoMes === st).length;
    const nomeFiltro = servicos.find((s) => s.id === filtroServico)?.nome;

    el.innerHTML = `
      <section class="saudacao">
        <h1>${saudacao()}, ${esc(ctx.usuario.nome.split(' ')[0])}</h1>
        <p>${clientes.length
          ? `Assessoria de marketing em ${esc(nomeDoMes(mes).toLowerCase())}: ${clientes.length} ${clientes.length === 1 ? 'cliente' : 'clientes'}${semCronograma ? `, ${semCronograma} da consultoria editorial ainda sem cronograma` : ''}${rascunhos ? `, ${rascunhos} com cronograma em rascunho` : ''}.`
          : 'Comece cadastrando o primeiro cliente da Vie.'}</p>
      </section>

      ${clientes.length ? `
        <div class="filtros" style="margin-top:22px">
          <button class="filtro${!filtroServico ? ' ativo' : ''}" data-servico="">Todos os clientes <b>${clientes.length}</b></button>
          ${servicos.map((s) => {
            const n = clientes.filter((c) => (c.servicos || []).includes(s.id)).length;
            return `<button class="filtro${filtroServico === s.id ? ' ativo' : ''}" data-servico="${esc(s.id)}"><span class="ponto" style="--cor:${esc(s.cor)}"></span>${esc(s.nome)} <b>${n}</b></button>`;
          }).join('')}
        </div>` : ''}

      <div class="resumo-vie" style="margin-top:${clientes.length ? '4px' : '22px'}">
        <div class="cartao"><div class="numero-grande">${visiveis.length}</div><div class="rot">${nomeFiltro ? esc(nomeFiltro) : 'Clientes'}</div></div>
        <div class="cartao"><div class="numero-grande">${num(visiveis.reduce((s, c) => s + c.resumo.total, 0))}</div><div class="rot">Conteúdos no mês</div></div>
        <div class="cartao"><div class="numero-grande" style="color:var(--s-ajuste)">${soma('ajuste') + mesesEm('ajuste')}</div><div class="rot">Ajustes pedidos</div></div>
        <div class="cartao"><div class="numero-grande" style="color:var(--s-aprovacao)">${soma('aprovacao') + mesesEm('aguardando')}</div><div class="rot">Com o cliente para aprovar</div></div>
        <div class="cartao"><div class="numero-grande" style="color:var(--s-aprovado)">${soma('postado')}</div><div class="rot">Postados</div></div>
      </div>

      ${visiveis.length ? `<div class="grade-clientes">${visiveis.map((c) => cartao(c, servicos)).join('')}</div>`
        : clientes.length ? '<div class="vazio" style="margin-top:22px">Nenhum cliente com este serviço.</div>'
        : '<div class="vazio" style="margin-top:22px"><strong>Nenhum cliente ainda</strong>Clique em “Novo cliente”. Você pode começar pelo exemplo da Dra. Izabella para ver o portal funcionando.</div>'}`;

    el.querySelectorAll('[data-servico]').forEach((b) => { b.onclick = () => { filtroServico = b.dataset.servico; desenhar(); }; });
  }

  function cartao(c, servicos) {
    const r = c.resumo;
    const temCron = r.total || r.interativo;
    const estado = !temCron ? (temEditorial(c) ? ['Sem cronograma', 'var(--muted)'] : null) : r.cronograma === 'publicado' ? ['Cronograma liberado', 'var(--s-aprovado)'] : ['Cronograma em rascunho', 'var(--s-aprovacao)'];
    return `
      <a class="cartao cartao-cliente" style="--cor:${esc(c.cor)}" href="#/c/${encodeURIComponent(c.id)}">
        <div>
          <div class="nome">${esc(c.nome)}</div>
          <div class="muted" style="font-size:13.5px;margin-top:4px">${esc([c.especialidade, c.instagram ? `@${c.instagram}` : ''].filter(Boolean).join(' · '))}</div>
        </div>
        <div class="alertas">${etiquetasServicos(c.servicos, servicos, { mini: true }) || '<span class="muted" style="font-size:12.5px">Sem serviço marcado</span>'}</div>
        ${temCron || estado ? `
          <div class="linha-info"><span>${esc(nomeDoMes(mes, { curto: true }))} · ${temCron ? (r.interativo && !r.total ? 'cronograma interativo' : `${r.total} conteúdos`) : 'sem conteúdos'}</span>${estado ? `<span class="etq" style="--cor:${estado[1]}"><span class="ponto"></span>${estado[0]}</span>` : ''}</div>
          <div class="barra-empilhada">${Object.entries(STATUS).map(([k, s]) => (r.porStatus[k] ? `<span style="flex:${r.porStatus[k]};--cor:${s.cor}" title="${s.nome}: ${r.porStatus[k]}"></span>` : '')).join('')}</div>` : ''}
        <div class="alertas">
          ${r.cronograma === 'publicado' && r.aprovacaoMes === 'ajuste' ? '<span class="etq cheia" style="--cor:var(--s-ajuste)">Ajuste pedido no cronograma</span>' : ''}
          ${r.cronograma === 'publicado' && r.aprovacaoMes === 'aguardando' ? '<span class="etq cheia" style="--cor:var(--s-aprovacao)">Cronograma para aprovar</span>' : ''}
          ${r.cronograma === 'publicado' && r.aprovacaoMes === 'aprovado' ? '<span class="etq cheia" style="--cor:var(--s-aprovado)">Cronograma aprovado</span>' : ''}
          ${r.porStatus.ajuste ? `<span class="etq cheia" style="--cor:var(--s-ajuste)">${r.porStatus.ajuste} ${r.porStatus.ajuste === 1 ? 'ajuste pedido' : 'ajustes pedidos'}</span>` : ''}
          ${r.porStatus.aprovacao ? `<span class="etq cheia" style="--cor:var(--s-aprovacao)">${r.porStatus.aprovacao} para aprovar</span>` : ''}
          ${r.seguidores != null ? `<span class="etq">${num(r.seguidores)} seguidores</span>` : ''}
        </div>
      </a>`;
  }

  await carregar();
}

function novoCliente(ctx) {
  const m = abrirCamada(`
    <h2>Novo cliente</h2>
    <p class="muted">Cadastre o cliente e marque os serviços que a Vie presta para ele. Depois, convide o cliente para o portal em “Acessos do cliente”.</p>
    <form class="grade-campos" data-form>${camposCliente({}, ctx.servicos())}</form>
    <div class="rodape-modal">
      <button class="btn fantasma" data-exemplo style="margin-right:auto">Criar com o exemplo da Dra. Izabella</button>
      <button class="btn claro" data-fechar>Cancelar</button>
      <button class="btn acc" data-ok>Cadastrar</button>
    </div>`, { largo: true });
  const criar = async (corpo) => {
    try {
      const c = await api('clientes', { metodo: 'POST', corpo });
      m.fechar();
      ctx.limparClientes();
      aviso('Cliente cadastrado.');
      ctx.ir(`/c/${encodeURIComponent(c.id)}${(c.servicos || []).includes('editorial') ? '/linha' : ''}`);
    } catch (err) { falhou(err); }
  };
  m.el.querySelector('[data-ok]').onclick = () => criar(lerCliente(m.el.querySelector('[data-form]')));
  m.el.querySelector('[data-exemplo]').onclick = () => criar({ exemplo: true });
}

// Lista de serviços da Vie: nome e cor de cada etiqueta.
async function paginaServicos(el, ctx) {
  const acoes = ctx.topo('Geral', 'Serviços', '<button class="btn acc" data-salvar>Salvar serviços</button>');
  let lista = structuredClone(ctx.servicos());
  const clientes = await api('clientes').catch(() => []);
  const uso = (id) => clientes.filter((c) => (c.servicos || []).includes(id)).length;

  function desenhar() {
    el.innerHTML = `
      <section class="saudacao"><h1>Serviços</h1><p>Os serviços que a Vie presta viram etiquetas nos clientes. Use-as para filtrar a visão geral e ver quem tem cada serviço.</p></section>
      <div class="cartao" style="margin-top:22px;max-width:760px;display:grid;gap:10px">
        ${lista.map((s, i) => `
          <div class="linha-servico">
            <input class="entrada" type="color" value="${esc(s.cor)}" data-cor="${i}" aria-label="Cor" style="width:52px;height:44px;padding:4px">
            <input class="entrada" value="${esc(s.nome)}" data-nome="${i}" placeholder="Nome do serviço">
            <span class="muted" style="font-size:13px;white-space:nowrap">${s.id && uso(s.id) ? `${uso(s.id)} ${uso(s.id) === 1 ? 'cliente' : 'clientes'}` : ''}</span>
            <button class="btn-icone" data-remover="${i}" title="Remover">${icones.lixo}</button>
          </div>`).join('')}
        <div><button class="btn claro peq" data-adicionar>${icones.mais}Adicionar serviço</button></div>
      </div>`;
    el.querySelectorAll('[data-nome]').forEach((c) => { c.oninput = () => { lista[c.dataset.nome].nome = c.value; }; });
    el.querySelectorAll('[data-cor]').forEach((c) => { c.oninput = () => { lista[c.dataset.cor].cor = c.value; }; });
    el.querySelectorAll('[data-remover]').forEach((b) => {
      b.onclick = async () => {
        const s = lista[b.dataset.remover];
        if (s.id && uso(s.id) && !(await confirmar(`${uso(s.id)} ${uso(s.id) === 1 ? 'cliente usa' : 'clientes usam'} “${s.nome}”. A etiqueta some desses clientes.`, { botao: 'Remover', perigo: true }))) return;
        lista.splice(Number(b.dataset.remover), 1);
        desenhar();
      };
    });
    el.querySelector('[data-adicionar]').onclick = () => { lista.push({ nome: '', cor: '#8a391b' }); desenhar(); el.querySelectorAll('[data-nome]')[lista.length - 1]?.focus(); };
  }

  acoes.querySelector('[data-salvar]').onclick = async () => {
    try {
      const salvo = await api('clientes?servicos=1', { metodo: 'PUT', corpo: lista.filter((s) => s.nome.trim()) });
      ctx.definirServicos(salvo);
      lista = structuredClone(salvo);
      aviso('Serviços salvos.');
      desenhar();
    } catch (err) { falhou(err); }
  };
  desenhar();
}
