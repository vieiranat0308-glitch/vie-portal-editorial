// Configurações do cliente (só a Vie): dados do perfil, cor do portal e exclusão.
import { api, esc, aviso, falhou, confirmar } from '../ui.js';

export function camposCliente(c = {}) {
  return `
    <label class="campo largo"><span>Nome do cliente (aparece no portal)</span><input class="entrada" name="nome" value="${esc(c.nome || '')}" placeholder="Ex.: Dra. Izabella Rebello" autofocus></label>
    <label class="campo"><span>Como chamar na saudação</span><input class="entrada" name="tratamento" value="${esc(c.tratamento || '')}" placeholder="Ex.: Izabella"></label>
    <label class="campo"><span>Instagram</span><input class="entrada" name="instagram" value="${esc(c.instagram || '')}" placeholder="@perfil"></label>
    <label class="campo"><span>Especialidade</span><input class="entrada" name="especialidade" value="${esc(c.especialidade || '')}" placeholder="Ex.: Nutrologia, Odontologia"></label>
    <label class="campo"><span>Cor de destaque do portal</span><input class="entrada" type="color" name="cor" value="${esc(c.cor || '#8a391b')}" style="height:44px;padding:4px"></label>`;
}

export async function render(el, ctx) {
  const { cliente } = ctx;
  ctx.topo('Gestão', 'Configurações');
  el.innerHTML = `
    <section class="saudacao"><h1>Configurações</h1><p>Dados do cliente e aparência do portal dele.</p></section>
    <div class="cartao" style="margin-top:22px;max-width:760px">
      <form class="grade-campos" data-form>${camposCliente(cliente)}</form>
      <div class="rodape-modal" style="justify-content:flex-start;margin-top:18px"><button class="btn acc" data-salvar>Salvar</button></div>
    </div>
    <div class="cartao" style="margin-top:18px;max-width:760px;border-color:color-mix(in srgb, var(--s-ajuste) 35%, transparent)">
      <div class="cab"><h3>Excluir cliente</h3></div>
      <p class="muted">Apaga a linha editorial, os cronogramas, ideias, métricas, documentos e os acessos deste cliente. Não dá para desfazer.</p>
      <button class="btn perigo" style="margin-top:14px" data-excluir>Excluir ${esc(cliente.nome)}</button>
    </div>`;

  el.querySelector('[data-salvar]').onclick = async () => {
    const dados = Object.fromEntries(new FormData(el.querySelector('[data-form]')));
    try {
      const salvo = await api(`clientes?id=${encodeURIComponent(cliente.id)}`, { metodo: 'PUT', corpo: dados });
      ctx.atualizarCliente(salvo);
      aviso('Configurações salvas.');
      ctx.ir(`${ctx.base}/config`);
    } catch (err) { falhou(err); }
  };
  el.querySelector('[data-excluir]').onclick = async () => {
    if (!(await confirmar(`Todos os dados de ${cliente.nome} serão apagados para sempre.`, { botao: 'Excluir definitivamente', perigo: true }))) return;
    try {
      await api(`clientes?id=${encodeURIComponent(cliente.id)}`, { metodo: 'DELETE' });
      ctx.limparClientes();
      aviso('Cliente excluído.');
      ctx.ir('/');
    } catch (err) { falhou(err); }
  };
}
