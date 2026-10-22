// Acessos: convida pessoas para o portal de um cliente (ou para a equipe Vie).
import { api, esc, aviso, falhou, abrirCamada, confirmar, copiar, icones, iniciais } from '../ui.js';

export async function render(el, ctx) {
  ctx.topo('Gestão', 'Acessos do cliente');
  await painelDeAcessos(el, { alvo: ctx.cliente.id, nomeAlvo: ctx.cliente.nome, usuario: ctx.usuario });
}

export async function painelDeAcessos(el, { alvo, nomeAlvo, usuario }) {
  const equipe = alvo === 'vie';
  let dados = await api(`usuarios?cliente=${encodeURIComponent(alvo)}`);
  // Na equipe, cada pessoa pode ver todos os clientes ou só alguns.
  const clientes = equipe ? await api('clientes').catch(() => []) : [];
  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || id;
  const resumoAcesso = (lista) => (!Array.isArray(lista) ? 'Todos os clientes'
    : `${lista.length === 1 ? '1 cliente' : `${lista.length} clientes`}: ${lista.map(nomeCliente).join(', ')}`);

  // Campo "quais clientes": Todos (inclusive os novos) ou uma seleção.
  function escolhaDeClientes(selecionados) {
    const todos = !Array.isArray(selecionados);
    return `
      <div class="escolha-clientes">
        <span class="mono" style="font-size:10.5px">Clientes que essa pessoa vê</span>
        <label class="opcao-todos"><input type="checkbox" data-todos${todos ? ' checked' : ''}> <b>Todos os clientes</b> <span class="muted">(inclusive os que forem cadastrados depois)</span></label>
        <div class="lista-clientes"${todos ? ' hidden' : ''}>
          ${clientes.length ? clientes.map((c) => `<label><input type="checkbox" data-cliente="${esc(c.id)}"${!todos && selecionados.includes(c.id) ? ' checked' : ''}> <span class="bolinha" style="--cor:${esc(c.cor)}"></span>${esc(c.nome)}</label>`).join('') : '<p class="muted">Nenhum cliente cadastrado.</p>'}
        </div>
        <p class="muted" style="font-size:12.5px">Quem não vê todos os clientes não mexe em Serviços nem na Equipe Vie, e não cria nem exclui clientes.</p>
      </div>`;
  }
  function ligarEscolha(caixa) {
    const todos = caixa.querySelector('[data-todos]');
    if (todos) todos.onchange = () => { caixa.querySelector('.lista-clientes').hidden = todos.checked; };
  }
  // null = todos; senão a lista marcada.
  function lerEscolha(caixa) {
    if (caixa.querySelector('[data-todos]')?.checked) return null;
    return [...caixa.querySelectorAll('[data-cliente]:checked')].map((i) => i.dataset.cliente);
  }

  const link = (token) => `${location.origin}/#/convite/${token}`;
  const mensagem = (c) => `Oi${c.nome ? `, ${c.nome.split(' ')[0]}` : ''}! ${equipe ? 'Este é o seu acesso à área da equipe no portal da Vie Company.' : `Este é o seu acesso exclusivo ao Portal Assessoria de Marketing da Vie Company (${nomeAlvo}). Lá ficam as entregas, os cronogramas, as aprovações e o acompanhamento dos resultados.`} Crie a sua senha por aqui (o link vale 7 dias): ${link(c.token)}${equipe ? '' : `\n\nDá para ter o portal como app no celular, com o ícone da Vie na tela: ${location.origin}/#/instalar`}`;

  function desenhar() {
    el.innerHTML = `
      <section class="saudacao"><h1>${equipe ? 'Equipe Vie' : 'Acessos'}</h1><p>${equipe
        ? 'Pessoas da Vie com acesso ao portal. Cada uma vê todos os clientes ou só os que você escolher.'
        : `Quem pode entrar no portal de ${esc(nomeAlvo)}. Cada pessoa recebe um link de convite para criar a própria senha e só enxerga os documentos deste cliente.`}</p></section>
      <div class="duas" style="margin-top:22px;align-items:start">
        <div class="cartao">
          <div class="cab"><h3>Com acesso</h3><span class="mono">${dados.usuarios.length}</span></div>
          ${dados.usuarios.length ? dados.usuarios.map((u) => `
            <div class="pessoa">
              <span class="avatar">${esc(iniciais(u.nome))}</span>
              <div class="dados"><b style="font-weight:500">${esc(u.nome)}</b><div class="muted" style="font-size:13px">${esc(u.email)}${u.mestre ? ' · conta principal' : ''}</div>${equipe ? `<div class="acesso-clientes">${esc(u.mestre ? 'Todos os clientes' : resumoAcesso(u.clientes))}</div>` : ''}</div>
              ${equipe && !u.mestre && u.email !== usuario.email ? `<button class="btn claro peq" data-clientes="${esc(u.email)}">Clientes</button>` : ''}
              ${u.mestre || u.email === usuario.email ? '' : `<button class="btn perigo peq" data-remover="${esc(u.email)}">Remover</button>`}
            </div>`).join('') : '<p class="muted">Ninguém ainda. Envie um convite.</p>'}
        </div>
        <div class="cartao">
          <div class="cab"><h3>Convites pendentes</h3><button class="btn peq" data-convidar style="margin-left:auto">${icones.mais}Convidar</button></div>
          ${dados.convites.length ? dados.convites.map((c) => `
            <div class="pessoa">
              <div class="dados"><b style="font-weight:500">${esc(c.nome || c.email)}</b><div class="muted" style="font-size:13px">${esc(c.email)} · vale até ${new Date(c.expiraEm).toLocaleDateString('pt-BR')}</div>${equipe ? `<div class="acesso-clientes">${esc(resumoAcesso(c.clientes))}</div>` : ''}</div>
              <button class="btn claro peq" data-copiar="${c.token}">${icones.copiar}Copiar link</button>
              <a class="btn claro peq" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(mensagem(c))}">${icones.whatsapp}WhatsApp</a>
              <button class="btn-icone" data-cancelar="${c.token}" title="Cancelar convite">${icones.fechar}</button>
            </div>`).join('') : '<p class="muted">Nenhum convite pendente.</p>'}
        </div>
      </div>`;

    el.querySelector('[data-convidar]').onclick = convidar;
    el.querySelectorAll('[data-copiar]').forEach((b) => { b.onclick = () => copiar(mensagem(dados.convites.find((c) => c.token === b.dataset.copiar))); });
    el.querySelectorAll('[data-cancelar]').forEach((b) => {
      b.onclick = async () => {
        await acao({ acao: 'cancelar-convite', token: b.dataset.cancelar });
      };
    });
    el.querySelectorAll('[data-clientes]').forEach((b) => {
      b.onclick = () => {
        const pessoa = dados.usuarios.find((u) => u.email === b.dataset.clientes);
        const m = abrirCamada(`
          <h2>Clientes de ${esc(pessoa.nome || pessoa.email)}</h2>
          ${escolhaDeClientes(pessoa.clientes)}
          <div class="rodape-modal"><button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>Salvar</button></div>`);
        ligarEscolha(m.el);
        m.el.querySelector('[data-ok]').onclick = async () => {
          const escolhidos = lerEscolha(m.el);
          if (escolhidos && !escolhidos.length) return aviso('Escolha pelo menos um cliente, ou marque “Todos os clientes”.', { erro: true });
          m.fechar();
          await acao({ acao: 'clientes-da-pessoa', email: pessoa.email, clientes: escolhidos });
          aviso('Acesso atualizado. Vale a partir da próxima página que a pessoa abrir.');
        };
      };
    });
    el.querySelectorAll('[data-remover]').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmar(`${b.dataset.remover} perde o acesso ao portal imediatamente.`, { botao: 'Remover acesso', perigo: true }))) return;
        await acao({ acao: 'remover', email: b.dataset.remover });
      };
    });
  }

  async function acao(corpo) {
    try {
      await api('usuarios', { metodo: 'POST', corpo: { cliente: alvo, ...corpo } });
      dados = await api(`usuarios?cliente=${encodeURIComponent(alvo)}`);
      desenhar();
    } catch (err) { falhou(err); }
  }

  function convidar() {
    const m = abrirCamada(`
      <h2>Convidar para ${equipe ? 'a equipe Vie' : esc(nomeAlvo)}</h2>
      <div class="grade-campos">
        <label class="campo largo"><span>Nome</span><input class="entrada" name="nome" autofocus></label>
        <label class="campo largo"><span>E-mail (será o login)</span><input class="entrada" type="email" name="email"></label>
      </div>
      ${equipe ? escolhaDeClientes(null) : ''}
      <div class="rodape-modal"><button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>Gerar convite</button></div>`);
    if (equipe) ligarEscolha(m.el);
    m.el.querySelector('[data-ok]').onclick = async () => {
      const escolhidos = equipe ? lerEscolha(m.el) : undefined;
      if (escolhidos && !escolhidos.length) return aviso('Escolha pelo menos um cliente, ou marque “Todos os clientes”.', { erro: true });
      try {
        const convite = await api('usuarios', { metodo: 'POST', corpo: { cliente: alvo, acao: 'convite', nome: m.el.querySelector('[name=nome]').value, email: m.el.querySelector('[name=email]').value, ...(equipe ? { clientes: escolhidos } : {}) } });
        m.fechar();
        dados = await api(`usuarios?cliente=${encodeURIComponent(alvo)}`);
        desenhar();
        const r = abrirCamada(`
          <h2>Convite criado</h2>
          <p>Envie o link para ${esc(convite.nome || convite.email)}. Ele vale 7 dias e só pode ser usado uma vez.</p>
          <div class="link-convite">${esc(link(convite.token))}</div>
          <div class="rodape-modal">
            <button class="btn claro" data-copiar>${icones.copiar}Copiar mensagem</button>
            <a class="btn acc" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(mensagem(convite))}">${icones.whatsapp}Enviar pelo WhatsApp</a>
          </div>`);
        r.el.querySelector('[data-copiar]').onclick = () => copiar(mensagem(convite));
        aviso('Convite gerado.');
      } catch (err) { falhou(err); }
    };
  }

  desenhar();
}
