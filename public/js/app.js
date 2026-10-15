// Portal Editorial Vie Company: inicialização, rotas e estrutura das telas.
import { api, esc, aviso, falhou, abrirCamada, lerCampos, icones, iniciais } from './ui.js';

const estado = { usuario: null, clienteProprio: null, clientes: null, cache: {} };
const app = document.getElementById('app');

const PAGINAS = {
  painel: () => import('./paginas/painel.js'),
  linha: () => import('./paginas/linha.js'),
  cronograma: () => import('./paginas/cronograma.js'),
  aprovacao: () => import('./paginas/aprovacao.js'),
  ideias: () => import('./paginas/ideias.js'),
  metricas: () => import('./paginas/metricas.js'),
  documentos: () => import('./paginas/documentos.js'),
  acessos: () => import('./paginas/acessos.js'),
  config: () => import('./paginas/config.js'),
  vie: () => import('./paginas/vie.js'),
};

const MENU_CLIENTE = [
  { grupo: 'Geral', itens: [
    ['painel', 'Visão geral', 'geral'],
    ['linha', 'Linha editorial', 'livro'],
    ['cronograma', 'Cronograma', 'calendario'],
    ['aprovacao', 'Aprovação', 'aprovacao'],
    ['ideias', 'Banco de ideias', 'ideia'],
  ] },
  { grupo: 'Acompanhamento', itens: [
    ['metricas', 'Métricas', 'metricas'],
    ['documentos', 'Documentos', 'documentos'],
  ] },
  { grupo: 'Gestão', soAdmin: true, itens: [
    ['acessos', 'Acessos do cliente', 'pessoas'],
    ['config', 'Configurações', 'ajustes'],
  ] },
];

// ---------- Rotas ----------
// #/login · #/convite/TOKEN · #/ (Vie) · #/equipe · #/c/:cliente/:pagina/:extra
function lerRota() {
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (partes[0] === 'login') return { tela: 'login' };
  if (partes[0] === 'convite') return { tela: 'convite', token: partes[1] };
  if (partes[0] === 'c' && partes[1]) return { tela: 'cliente', clienteId: partes[1], pagina: PAGINAS[partes[2]] ? partes[2] : 'painel', extra: partes[3] };
  if (partes[0] === 'equipe') return { tela: 'vie', pagina: 'equipe' };
  return { tela: 'vie', pagina: 'inicio' };
}

export function ir(caminho) {
  if (location.hash === `#${caminho}`) desenhar();
  else location.hash = caminho;
}

async function desenhar() {
  const rota = lerRota();
  if (rota.tela === 'convite') return telaConvite(rota.token);
  if (!estado.usuario) {
    try {
      const eu = await api('auth');
      estado.usuario = eu.usuario;
      estado.clienteProprio = eu.cliente;
    } catch {
      return telaLogin();
    }
  }
  if (rota.tela === 'login') return ir('/');
  const admin = estado.usuario.role === 'admin';

  if (!admin) {
    const proprio = estado.usuario.clienteId;
    if (rota.tela !== 'cliente' || rota.clienteId !== proprio || ['acessos', 'config'].includes(rota.pagina)) {
      return ir(`/c/${proprio}`);
    }
  }
  if (rota.tela === 'cliente') return telaCliente(rota);
  return telaVie(rota);
}

// ---------- Login ----------
function telaLogin(mensagem = '') {
  document.title = 'Entrar · Vie Company';
  app.innerHTML = `
    <div class="tela-login">
      <div class="arte">
        <span class="logo-vie">Vie<small>company</small></span>
        <div>
          <p class="mono" style="color:var(--creme-2)">Consultoria editorial</p>
          <div class="linha"></div>
          <h1>Sua estratégia de conteúdo, mês a mês, em um só lugar.</h1>
        </div>
        <p class="mono" style="color:var(--creme-2);font-size:10px">Marketing para a área da saúde</p>
      </div>
      <div class="form">
        <form class="caixa" novalidate>
          <h2>Entrar no portal</h2>
          <p class="muted">Use o e-mail e a senha cadastrados no seu convite.</p>
          <label class="campo"><span>E-mail</span><input class="entrada" name="email" type="email" autocomplete="email" required autofocus></label>
          <label class="campo"><span>Senha</span><input class="entrada" name="senha" type="password" autocomplete="current-password" required></label>
          <p class="erro-form">${esc(mensagem)}</p>
          <button class="btn acc bloco" type="submit">Entrar</button>
          <p class="muted" style="font-size:13px">Esqueceu a senha? Fale com a equipe Vie para receber um novo link de acesso.</p>
        </form>
      </div>
    </div>`;
  const form = app.querySelector('form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const botao = form.querySelector('button');
    botao.disabled = true;
    try {
      const { usuario } = await api('auth', { metodo: 'POST', corpo: { acao: 'login', ...lerCampos(form) } });
      estado.usuario = null;
      ir(usuario.role === 'admin' ? '/' : `/c/${usuario.clienteId}`);
    } catch (err) {
      form.querySelector('.erro-form').textContent = err.message;
      botao.disabled = false;
    }
  };
}

async function telaConvite(token) {
  document.title = 'Criar acesso · Vie Company';
  app.innerHTML = '<div class="carregando-tela"><span class="logo-vie">Vie<small>company</small></span></div>';
  let convite;
  try {
    convite = await api('auth', { metodo: 'POST', corpo: { acao: 'convite-info', token } });
  } catch (err) {
    return telaLogin(err.message);
  }
  app.innerHTML = `
    <div class="tela-login">
      <div class="arte">
        <span class="logo-vie">Vie<small>company</small></span>
        <div>
          <p class="mono" style="color:var(--creme-2)">${convite.cliente ? 'Portal exclusivo' : 'Equipe Vie'}</p>
          <div class="linha"></div>
          <h1>${convite.cliente ? `Bem-vinda ao portal ${esc(convite.cliente)}.` : 'Bem-vinda à equipe Vie.'}</h1>
        </div>
        <span></span>
      </div>
      <div class="form">
        <form class="caixa" novalidate>
          <h2>Crie o seu acesso</h2>
          <p class="muted">O seu login será <b>${esc(convite.email)}</b>.</p>
          <label class="campo"><span>Como podemos te chamar?</span><input class="entrada" name="nome" value="${esc(convite.nome)}" required></label>
          <label class="campo"><span>Crie uma senha (mínimo 8 caracteres)</span><input class="entrada" name="senha" type="password" autocomplete="new-password" minlength="8" required autofocus></label>
          <p class="erro-form"></p>
          <button class="btn acc bloco" type="submit">Criar acesso e entrar</button>
        </form>
      </div>
    </div>`;
  const form = app.querySelector('form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const { usuario } = await api('auth', { metodo: 'POST', corpo: { acao: 'convite-aceitar', token, ...lerCampos(form) } });
      estado.usuario = null;
      ir(usuario.role === 'admin' ? '/' : `/c/${usuario.clienteId}`);
    } catch (err) {
      form.querySelector('.erro-form').textContent = err.message;
    }
  };
}

// ---------- Estrutura ----------
function moldura({ marcaHtml, menuHtml, titulo }) {
  const u = estado.usuario;
  app.innerHTML = `
    <div class="estrutura">
      <aside class="lateral"><div class="painel">
        <div class="marca">${marcaHtml}</div>
        ${menuHtml}
        <div class="rodape">
          <div class="usuario"><span class="avatar">${esc(iniciais(u.nome))}</span><div><div class="nome">${esc(u.nome)}</div><div class="sub">${u.role === 'admin' ? 'Equipe Vie' : 'Cliente'}</div></div></div>
          <div class="acoes"><button data-conta>Minha conta</button><button data-sair>Sair</button></div>
          ${u.role === 'admin' ? '' : '<div class="assinatura">Consultoria editorial · Vie Company</div>'}
        </div>
      </div></aside>
      <div>
        <div class="barra-mobile"><button data-menu aria-label="Abrir menu">${icones.menu}</button><span class="titulo">${esc(titulo)}</span></div>
        <main class="principal">
          <div class="topo"><div class="trilha"></div><div class="acoes"></div></div>
          <div id="conteudo"></div>
        </main>
      </div>
    </div>`;
  const estrutura = app.querySelector('.estrutura');
  app.querySelector('[data-menu]').onclick = () => estrutura.classList.add('menu-aberto');
  estrutura.addEventListener('click', (e) => {
    if (e.target === estrutura || e.target.closest('.nav-item')) estrutura.classList.remove('menu-aberto');
  });
  app.querySelector('[data-sair]').onclick = sair;
  app.querySelector('[data-conta]').onclick = minhaConta;
  return app.querySelector('#conteudo');
}

function topo(trilha, titulo, acoesHtml = '') {
  app.querySelector('.topo .trilha').innerHTML = `<span class="mono">${esc(trilha)}</span><span class="muted">/</span><strong>${esc(titulo)}</strong>`;
  const acoes = app.querySelector('.topo .acoes');
  acoes.innerHTML = acoesHtml;
  return acoes;
}

async function telaCliente(rota) {
  const admin = estado.usuario.role === 'admin';
  let cliente;
  try {
    cliente = admin ? (estado.cache.cliente?.id === rota.clienteId ? estado.cache.cliente : await api(`clientes?id=${encodeURIComponent(rota.clienteId)}`)) : estado.clienteProprio;
  } catch (err) {
    falhou(err);
    return ir('/');
  }
  if (estado.cache.cliente?.id !== cliente.id) estado.cache = { cliente };
  document.documentElement.style.setProperty('--acc', cliente.cor || '#7f2a2e');
  document.title = `${cliente.nome} · Portal Editorial`;

  const base = `#/c/${encodeURIComponent(cliente.id)}`;
  const menuHtml = MENU_CLIENTE.filter((g) => admin || !g.soAdmin).map((g) => `
    <div class="grupo"><span class="mono">${g.grupo}</span>
      ${g.itens.map(([id, nome, icone]) => `
        <a class="nav-item${rota.pagina === id ? ' ativo' : ''}" href="${base}${id === 'painel' ? '' : `/${id}`}">
          ${icones[icone]}<span>${nome}</span>${id === 'aprovacao' ? '<span class="contador" data-contador-aprovacao></span>' : ''}
        </a>`).join('')}
    </div>`).join('');
  const marcaHtml = `
    ${admin ? `<a class="voltar" href="#/">${icones.voltar}Todos os clientes</a>` : ''}
    <div class="cliente-nome">${esc(cliente.nome)}</div>
    <span class="mono">Consultoria editorial${cliente.instagram ? ` · @${esc(cliente.instagram)}` : ''}</span>`;

  const conteudo = moldura({ marcaHtml, menuHtml, titulo: cliente.nome });
  const ctx = criarContexto({ cliente, admin, rota, conteudo });
  await carregarPagina(rota.pagina, conteudo, ctx);
  atualizarContadorAprovacao(ctx);
}

async function telaVie(rota) {
  document.documentElement.style.setProperty('--acc', '#7f2a2e');
  document.title = 'Vie Company · Portal Editorial';
  if (!estado.clientes) estado.clientes = await api('clientes').catch(() => []);
  const menuHtml = `
    <div class="grupo"><span class="mono">Geral</span>
      <a class="nav-item${rota.pagina === 'inicio' ? ' ativo' : ''}" href="#/">${icones.geral}<span>Visão geral</span></a>
      <a class="nav-item${rota.pagina === 'equipe' ? ' ativo' : ''}" href="#/equipe">${icones.pessoas}<span>Equipe Vie</span></a>
    </div>
    <div class="grupo"><span class="mono">Clientes</span>
      ${estado.clientes.map((c) => `<a class="nav-item" href="#/c/${encodeURIComponent(c.id)}"><span class="bolinha" style="--cor:${esc(c.cor)}"></span><span>${esc(c.nome)}</span></a>`).join('') || '<span class="nav-item" style="opacity:.6">Nenhum cliente ainda</span>'}
    </div>`;
  const marcaHtml = '<span class="logo-vie">Vie<small>company</small></span><span class="mono">Portal editorial</span>';
  const conteudo = moldura({ marcaHtml, menuHtml, titulo: 'Vie Company' });
  const ctx = criarContexto({ cliente: null, admin: true, rota, conteudo });
  await carregarPagina('vie', conteudo, ctx);
}

function criarContexto({ cliente, admin, rota, conteudo }) {
  return {
    cliente,
    admin,
    rota,
    usuario: estado.usuario,
    conteudo,
    topo,
    ir,
    base: cliente ? `/c/${encodeURIComponent(cliente.id)}` : '',
    // Linha editorial e banco de ideias ficam em cache enquanto o cliente está aberto.
    async editorial(forcar = false) {
      if (forcar || !estado.cache.editorial) estado.cache.editorial = await api(`editorial?cliente=${encodeURIComponent(cliente.id)}`);
      return estado.cache.editorial;
    },
    definirEditorial(e) { estado.cache.editorial = e; },
    async ideias(forcar = false) {
      if (forcar || !estado.cache.ideias) estado.cache.ideias = await api(`ideias?cliente=${encodeURIComponent(cliente.id)}`);
      return estado.cache.ideias;
    },
    definirIdeias(i) { estado.cache.ideias = i; },
    atualizarCliente(c) { estado.cache.cliente = c; if (!admin) estado.clienteProprio = c; estado.clientes = null; },
    limparClientes() { estado.clientes = null; },
    atualizarContadores: () => atualizarContadorAprovacao({ cliente, admin }),
  };
}

async function carregarPagina(nome, conteudo, ctx) {
  conteudo.innerHTML = '<p class="muted">Carregando…</p>';
  try {
    const modulo = await PAGINAS[nome]();
    await modulo.render(conteudo, ctx);
  } catch (err) {
    console.error(err);
    if (err.status === 401) return;
    conteudo.innerHTML = `<div class="vazio"><strong>Não foi possível abrir esta página</strong>${esc(err.message)}</div>`;
  }
}

async function atualizarContadorAprovacao({ cliente, admin }) {
  const alvo = app.querySelector('[data-contador-aprovacao]');
  if (!alvo || !cliente) return;
  try {
    const meses = await api(`cronograma?cliente=${encodeURIComponent(cliente.id)}`);
    const chave = admin ? 'ajuste' : 'aprovacao';
    const mesInterativo = admin ? 'ajuste' : 'aguardando';
    const total = meses.reduce((s, m) => s + (m.porStatus[chave] || 0) + (m.aprovacaoMes === mesInterativo ? 1 : 0), 0);
    alvo.textContent = total || '';
    alvo.classList.toggle('alerta', total > 0);
    alvo.title = admin ? 'Ajustes pedidos pelo cliente' : 'Conteúdos esperando a sua aprovação';
  } catch { /* contador é só um extra */ }
}

// ---------- Conta ----------
async function sair() {
  await api('auth', { metodo: 'POST', corpo: { acao: 'logout' } }).catch(() => {});
  estado.usuario = null;
  estado.clientes = null;
  estado.cache = {};
  location.hash = '#/login';
}

function minhaConta() {
  const u = estado.usuario;
  const { el, fechar } = abrirCamada(`
    <h2>Minha conta</h2>
    <p class="muted">${esc(u.nome)} · ${esc(u.email)}</p>
    ${u.mestre ? '<p>Esta é a conta principal da Vie. A senha dela é definida na Vercel, na variável <b>ADMIN_PASSWORD</b>.</p>' : `
    <form class="grade-campos" style="grid-template-columns:1fr">
      <label class="campo"><span>Senha atual</span><input class="entrada" type="password" name="atual" autocomplete="current-password" required></label>
      <label class="campo"><span>Nova senha (mínimo 8 caracteres)</span><input class="entrada" type="password" name="nova" autocomplete="new-password" minlength="8" required></label>
    </form>`}
    <div class="rodape-modal">
      <button class="btn claro" data-fechar>Fechar</button>
      ${u.mestre ? '' : '<button class="btn acc" data-salvar>Alterar senha</button>'}
    </div>`);
  el.querySelector('[data-salvar]')?.addEventListener('click', async () => {
    try {
      await api('auth', { metodo: 'POST', corpo: { acao: 'senha', ...lerCampos(el) } });
      aviso('Senha alterada.');
      fechar();
    } catch (err) {
      falhou(err);
    }
  });
}

window.addEventListener('hashchange', desenhar);
window.addEventListener('sessao-expirada', () => {
  estado.usuario = null;
  telaLogin('Sua sessão expirou. Entre novamente.');
});
desenhar();
