// Visão da Vie: todos os clientes da consultoria editorial e a equipe.
import { api, esc, aviso, falhou, abrirCamada, mesAtual, somarMes, saudacao, num, icones } from '../ui.js';
import { STATUS, nomeDoMes } from '../regras.js';
import { camposCliente } from './config.js';
import { painelDeAcessos } from './acessos.js';

export async function render(el, ctx) {
  if (ctx.rota.pagina === 'equipe') {
    ctx.topo('Geral', 'Equipe Vie');
    return painelDeAcessos(el, { alvo: 'vie', nomeAlvo: 'Equipe Vie', usuario: ctx.usuario });
  }

  let mes = mesAtual();
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
    const clientes = await api(`clientes?mes=${mes}`);
    desenhar(clientes);
  }

  function desenhar(clientes) {
    const soma = (k) => clientes.reduce((s, c) => s + (c.resumo.porStatus[k] || 0), 0);
    const semCronograma = clientes.filter((c) => !c.resumo.total).length;
    const rascunhos = clientes.filter((c) => c.resumo.total && c.resumo.cronograma !== 'publicado').length;
    el.innerHTML = `
      <section class="saudacao">
        <h1>${saudacao()}, ${esc(ctx.usuario.nome.split(' ')[0])}</h1>
        <p>${clientes.length ? `Consultoria editorial de ${esc(nomeDoMes(mes).toLowerCase())}: ${clientes.length} ${clientes.length === 1 ? 'cliente' : 'clientes'}${semCronograma ? `, ${semCronograma} ainda sem cronograma` : ''}${rascunhos ? `, ${rascunhos} em rascunho` : ''}.` : 'Comece cadastrando o primeiro cliente da consultoria editorial.'}</p>
      </section>
      <div class="resumo-vie">
        <div class="cartao"><div class="numero-grande">${clientes.length}</div><div class="rot">Clientes</div></div>
        <div class="cartao"><div class="numero-grande">${num(clientes.reduce((s, c) => s + c.resumo.total, 0))}</div><div class="rot">Conteúdos no mês</div></div>
        <div class="cartao"><div class="numero-grande" style="color:var(--s-ajuste)">${soma('ajuste')}</div><div class="rot">Ajustes pedidos</div></div>
        <div class="cartao"><div class="numero-grande" style="color:var(--s-aprovacao)">${soma('aprovacao')}</div><div class="rot">Com o cliente para aprovar</div></div>
        <div class="cartao"><div class="numero-grande" style="color:var(--s-aprovado)">${soma('aprovado') + soma('gravado') + soma('postado')}</div><div class="rot">Aprovados</div></div>
      </div>
      ${clientes.length ? `<div class="grade-clientes">${clientes.map((c) => cartao(c)).join('')}</div>` : `
        <div class="vazio" style="margin-top:22px"><strong>Nenhum cliente ainda</strong>Clique em “Novo cliente”. Você pode começar pelo exemplo da Dra. Izabella para ver o portal funcionando.</div>`}`;
  }

  function cartao(c) {
    const r = c.resumo;
    const estado = !r.total ? ['Sem cronograma', 'var(--muted)'] : r.cronograma === 'publicado' ? ['Liberado', 'var(--s-aprovado)'] : ['Rascunho', 'var(--s-aprovacao)'];
    return `
      <a class="cartao cartao-cliente" style="--cor:${esc(c.cor)}" href="#/c/${encodeURIComponent(c.id)}">
        <div>
          <div class="nome">${esc(c.nome)}</div>
          <div class="muted" style="font-size:13.5px;margin-top:4px">${esc([c.especialidade, c.instagram ? `@${c.instagram}` : ''].filter(Boolean).join(' · '))}</div>
        </div>
        <div class="linha-info"><span>${esc(nomeDoMes(mes, { curto: true }))} · ${r.total} conteúdos</span><span class="etq" style="--cor:${estado[1]}"><span class="ponto"></span>${estado[0]}</span></div>
        <div class="barra-empilhada">${Object.entries(STATUS).map(([k, s]) => (r.porStatus[k] ? `<span style="flex:${r.porStatus[k]};--cor:${s.cor}" title="${s.nome}: ${r.porStatus[k]}"></span>` : '')).join('')}</div>
        <div class="alertas">
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
    <p class="muted">Cadastre o cliente da consultoria editorial. Depois você preenche a linha editorial e convida o cliente para o portal.</p>
    <form class="grade-campos" data-form>${camposCliente()}</form>
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
      ctx.ir(`/c/${encodeURIComponent(c.id)}${corpo.exemplo ? '/linha' : '/linha/editar'}`);
    } catch (err) { falhou(err); }
  };
  m.el.querySelector('[data-ok]').onclick = () => criar(Object.fromEntries(new FormData(m.el.querySelector('[data-form]'))));
  m.el.querySelector('[data-exemplo]').onclick = () => criar({ exemplo: true });
}
