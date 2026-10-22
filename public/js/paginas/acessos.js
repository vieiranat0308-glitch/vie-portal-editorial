// Acessos: convida pessoas para o portal de um cliente (ou para a equipe Vie).
import { api, esc, aviso, falhou, abrirCamada, confirmar, copiar, icones, iniciais } from '../ui.js';

export async function render(el, ctx) {
  ctx.topo('Gestão', 'Acessos do cliente');
  await painelDeAcessos(el, { alvo: ctx.cliente.id, nomeAlvo: ctx.cliente.nome, usuario: ctx.usuario });
}

export async function painelDeAcessos(el, { alvo, nomeAlvo, usuario }) {
  const equipe = alvo === 'vie';
  let dados = await api(`usuarios?cliente=${encodeURIComponent(alvo)}`);

  const link = (token) => `${location.origin}/#/convite/${token}`;
  const mensagem = (c) => `Oi${c.nome ? `, ${c.nome.split(' ')[0]}` : ''}! ${equipe ? 'Este é o seu acesso à área da equipe no portal da Vie Company.' : `Este é o seu acesso exclusivo ao Portal Assessoria de Marketing da Vie Company (${nomeAlvo}). Lá ficam as entregas, os cronogramas, as aprovações e o acompanhamento dos resultados.`} Crie a sua senha por aqui (o link vale 7 dias): ${link(c.token)}${equipe ? '' : `\n\nDá para ter o portal como app no celular, com o ícone da Vie na tela: ${location.origin}/#/instalar`}`;

  function desenhar() {
    el.innerHTML = `
      <section class="saudacao"><h1>${equipe ? 'Equipe Vie' : 'Acessos'}</h1><p>${equipe
        ? 'Pessoas da Vie que enxergam e editam todos os clientes.'
        : `Quem pode entrar no portal de ${esc(nomeAlvo)}. Cada pessoa recebe um link de convite para criar a própria senha e só enxerga os documentos deste cliente.`}</p></section>
      <div class="duas" style="margin-top:22px;align-items:start">
        <div class="cartao">
          <div class="cab"><h3>Com acesso</h3><span class="mono">${dados.usuarios.length}</span></div>
          ${dados.usuarios.length ? dados.usuarios.map((u) => `
            <div class="pessoa">
              <span class="avatar">${esc(iniciais(u.nome))}</span>
              <div class="dados"><b style="font-weight:500">${esc(u.nome)}</b><div class="muted" style="font-size:13px">${esc(u.email)}${u.mestre ? ' · conta principal' : ''}</div></div>
              ${u.mestre || u.email === usuario.email ? '' : `<button class="btn perigo peq" data-remover="${esc(u.email)}">Remover</button>`}
            </div>`).join('') : '<p class="muted">Ninguém ainda. Envie um convite.</p>'}
        </div>
        <div class="cartao">
          <div class="cab"><h3>Convites pendentes</h3><button class="btn peq" data-convidar style="margin-left:auto">${icones.mais}Convidar</button></div>
          ${dados.convites.length ? dados.convites.map((c) => `
            <div class="pessoa">
              <div class="dados"><b style="font-weight:500">${esc(c.nome || c.email)}</b><div class="muted" style="font-size:13px">${esc(c.email)} · vale até ${new Date(c.expiraEm).toLocaleDateString('pt-BR')}</div></div>
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
      <div class="rodape-modal"><button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>Gerar convite</button></div>`);
    m.el.querySelector('[data-ok]').onclick = async () => {
      try {
        const convite = await api('usuarios', { metodo: 'POST', corpo: { cliente: alvo, acao: 'convite', nome: m.el.querySelector('[name=nome]').value, email: m.el.querySelector('[name=email]').value } });
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
