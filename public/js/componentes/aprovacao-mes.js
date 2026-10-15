// Aprovação do cronograma do mês inteiro (usada quando o mês tem o cronograma em HTML).
// Aparece na visão geral e na aba Cronograma, para o cliente e para a Vie.
import { api, esc, aviso, falhou, abrirCamada, quando } from '../ui.js';
import { nomeDoMes } from '../regras.js';

export function situacaoMes(doc) {
  if (!doc?.interativo) return null;
  return doc.aprovacaoMes?.status || 'aguardando';
}

// Faixa com o estado da aprovação e os botões certos para quem está vendo.
export function faixaAprovacaoMes({ ctx, doc, mes, linkCronograma = true }) {
  const situacao = situacaoMes(doc);
  if (!situacao) return '';
  if (!ctx.admin && doc.status !== 'publicado') return '';
  const ap = doc.aprovacaoMes;
  const ultimo = (doc.conversa || []).at(-1);
  const nomeMes = nomeDoMes(mes).split(' ')[0].toLowerCase();
  const link = linkCronograma ? `<a class="btn claro peq" href="#${ctx.base}/cronograma/${mes}">Ver cronograma</a>` : '';
  let titulo;
  let texto;
  let botoes = '';
  let cor;

  if (situacao === 'aprovado') {
    cor = 'var(--s-aprovado)';
    titulo = `Cronograma de ${nomeMes} aprovado`;
    texto = `Aprovado por ${esc(ap.nome)} em ${esc(quando(ap.em))}.`;
    botoes = link;
  } else if (situacao === 'ajuste') {
    cor = 'var(--s-ajuste)';
    titulo = ctx.admin ? `Ajuste pedido no cronograma de ${nomeMes}` : `Você pediu ajuste no cronograma de ${nomeMes}`;
    texto = ctx.admin ? 'Suba a versão ajustada em “Substituir HTML”; ela volta para aprovação.' : 'A equipe Vie está revisando e manda a nova versão por aqui.';
    botoes = `${link}${ctx.admin ? '<button class="btn claro peq" data-aprovar-mes>Marcar como aprovado</button>' : ''}`;
  } else if (ctx.admin) {
    cor = 'var(--s-aprovacao)';
    titulo = doc.status === 'publicado' ? `Cronograma de ${nomeMes} com o cliente para aprovar` : `Cronograma de ${nomeMes} em rascunho`;
    texto = doc.status === 'publicado'
      ? 'Se o cliente aprovou por outro canal (WhatsApp, reunião), registre aqui.'
      : 'Libere para o cliente na aba Cronograma quando estiver pronto.';
    botoes = `${link}${doc.status === 'publicado' ? '<button class="btn acc peq" data-aprovar-mes>Marcar como aprovado</button>' : ''}`;
  } else {
    cor = 'var(--s-aprovacao)';
    titulo = `O cronograma de ${nomeMes} está pronto para a sua aprovação`;
    texto = 'Dê uma olhada e aprove, ou peça ajuste com um comentário.';
    botoes = `${link}<button class="btn claro peq" data-ajuste-mes>Pedir ajuste</button><button class="btn acc peq" data-aprovar-mes>Aprovar cronograma</button>`;
  }

  return `
    <div class="faixa-aprovacao" style="--cor:${cor}">
      <div style="flex:1;min-width:220px">
        <b>${titulo}</b>
        <p class="muted" style="font-size:13.5px;margin-top:2px">${texto}</p>
        ${situacao === 'ajuste' && ultimo ? `<div class="comentario${ultimo.admin ? ' vie' : ''}" style="margin-top:10px"><div class="quem"><b>${esc(ultimo.nome)}</b><span style="margin-left:auto">${esc(quando(ultimo.em))}</span></div><p>${esc(ultimo.texto)}</p></div>` : ''}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${botoes}</div>
    </div>`;
}

// Liga os botões da faixa. `aoMudar(doc)` recebe o cronograma atualizado.
export function ligarAprovacaoMes(el, { ctx, mes, aoMudar }) {
  const rota = `cronograma?cliente=${encodeURIComponent(ctx.cliente.id)}&mes=${mes}`;
  const enviar = async (corpo, mensagem) => {
    try {
      const doc = await api(rota, { metodo: 'POST', corpo });
      aviso(mensagem);
      ctx.atualizarContadores?.();
      aoMudar(doc);
    } catch (err) { falhou(err); }
  };
  el.querySelectorAll('[data-aprovar-mes]').forEach((b) => {
    b.onclick = () => enviar({ acao: 'aprovar-mes' }, ctx.admin ? 'Cronograma marcado como aprovado.' : 'Cronograma aprovado. Obrigada!');
  });
  el.querySelectorAll('[data-ajuste-mes]').forEach((b) => {
    b.onclick = () => {
      const m = abrirCamada(`
        <h2>O que você gostaria de ajustar?</h2>
        <p class="muted">Conte quais dias ou conteúdos mudar. A equipe Vie devolve o cronograma ajustado.</p>
        <textarea class="entrada" rows="5" autofocus placeholder="Ex.: trocar o tema do dia 12, já gravei o reel do dia 20…"></textarea>
        <div class="rodape-modal"><button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>Enviar pedido</button></div>`);
      m.el.querySelector('[data-ok]').onclick = async () => {
        const comentario = m.el.querySelector('textarea').value.trim();
        if (!comentario) return aviso('Conte rapidinho o que ajustar.', { erro: true });
        m.fechar();
        await enviar({ acao: 'ajuste-mes', comentario }, 'Pedido de ajuste enviado para a equipe Vie.');
      };
    };
  });
}

// Lê os posts de dentro do HTML (com IA) e devolve o cronograma atualizado.
export async function lerPostsDoHtml(ctx, mes) {
  const aguarde = abrirCamada(`
    <h2>Lendo o cronograma…</h2>
    <p class="muted">Estou identificando os posts do HTML (datas, formatos, temas e pilares) para atualizar a visão geral. Leva cerca de 1 minuto.</p>`);
  try {
    const doc = await api(`cronograma?cliente=${encodeURIComponent(ctx.cliente.id)}&mes=${mes}`, { metodo: 'POST', corpo: { acao: 'ler-html' } });
    aguarde.fechar();
    const l = doc.leituraHtml;
    aviso(`${l.total} ${l.total === 1 ? 'conteúdo encontrado' : 'conteúdos encontrados'} no HTML. A visão geral já está atualizada.`);
    ctx.atualizarContadores?.();
    return doc;
  } catch (err) {
    aguarde.fechar();
    falhou(err);
    return null;
  }
}
