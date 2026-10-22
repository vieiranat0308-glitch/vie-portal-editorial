// Cronograma mensal: calendário, lista por semana, prévia do feed e stories,
// ou o cronograma interativo (HTML pronto feito pela equipe Vie).
// Na Gestão de Instagram o mês se divide em duas trilhas: o cronograma da Vie
// (o que a equipe produz e publica) e o do cliente (o que ele grava e posta).
import { api, esc, aviso, falhou, abrirCamada, confirmar, hojeISO, mesAtual, somarMes, dataObj, dataCurta, diaSemanaCurto, quando, icones, iniciais } from '../ui.js';
import { FORMATOS, nomeDoMes, corDoPilar } from '../regras.js';
import { abrirPost, etiquetaFormato, etiquetaPilar, etiquetaStatus, capaDrive } from '../componentes/post.js';
import { faixaAprovacaoMes, ligarAprovacaoMes, lerPostsDoHtml, avisarLeitura, temInterativo } from '../componentes/aprovacao-mes.js';

let visaoSalva = 'calendario';
const trilhaSalva = {}; // por pessoa e cliente, enquanto a página estiver aberta

export async function render(el, ctx) {
  const { cliente, admin } = ctx;
  const id = encodeURIComponent(cliente.id);
  const mes = /^\d{4}-\d{2}$/.test(ctx.rota.extra || '') ? ctx.rota.extra : mesAtual();
  try { visaoSalva = localStorage.getItem('vie-visao') || visaoSalva; } catch { /* sem armazenamento */ }
  let visao = visaoSalva;
  const separado = !!ctx.abas?.has('cronogramaVie');
  // A Vie abre no que ela produz; o cliente, no que ele precisa fazer.
  const chaveTrilha = `${ctx.usuario?.email}|${cliente.id}`;
  let trilha = separado ? trilhaSalva[chaveTrilha] || (admin ? 'vie' : 'cliente') : 'cliente';
  const nomeTrilha = { vie: 'Cronograma da Vie', cliente: admin ? 'Cronograma do cliente' : 'Seu cronograma' };
  const nomeNaFrase = (t) => (t === 'vie' ? 'cronograma da Vie' : admin ? 'cronograma do cliente' : 'seu cronograma');
  const daTrilha = (p) => !separado || (p.trilha === 'vie' ? 'vie' : 'cliente') === trilha;
  const arquivoDaTrilha = () => (trilha === 'vie' ? doc.interativoVie : doc.interativo);
  const leituraDaTrilha = () => (trilha === 'vie' ? doc.leituraHtmlVie : doc.leituraHtml);
  const planilhaDaTrilha = () => (trilha === 'vie' ? doc.planilhaVie : doc.planilha);
  // O conteúdo que a Vie produz vem da planilha do Drive (com os links das artes).
  const usaPlanilha = () => admin && separado && trilha === 'vie';
  const visaoInicial = () => (arquivoDaTrilha() ? 'interativo' : planilhaDaTrilha()?.total ? 'lista' : visaoSalva);

  const acoes = ctx.topo('Geral', 'Cronograma', `
    <div class="seletor-mes">
      <button data-ir="-1" aria-label="Mês anterior">${icones.esquerda}</button>
      <strong>${esc(nomeDoMes(mes))}</strong>
      <button data-ir="1" aria-label="Próximo mês">${icones.direita}</button>
    </div>
    ${admin ? `<button class="btn" data-novo><span>Novo conteúdo</span><span class="mais">+</span></button>` : ''}`);
  acoes.querySelectorAll('[data-ir]').forEach((b) => { b.onclick = () => ctx.ir(`${ctx.base}/cronograma/${somarMes(mes, Number(b.dataset.ir))}`); });

  const editorial = await ctx.editorial();
  const pilares = editorial.pilares || [];
  let doc = await api(`cronograma?cliente=${id}&mes=${mes}`);
  // Mês com cronograma em HTML abre direto nele.
  visao = visaoInicial();

  const novo = (data) => abrirPost({ ctx, mes, post: { data, formato: 'reel', status: 'pauta', ...(trilha === 'vie' ? { trilha } : {}) }, aoMudar: atualizar });
  acoes.querySelector('[data-novo]')?.addEventListener('click', () => novo(`${mes}-${mes === mesAtual() ? hojeISO().slice(8) : '01'}`));

  function atualizar(novoDoc) { doc = novoDoc; desenhar(); }

  async function salvarMes(campos) {
    try {
      atualizar(await api(`cronograma?cliente=${id}&mes=${mes}`, { metodo: 'POST', corpo: { acao: 'salvar-mes', status: doc.status, foco: doc.foco, observacoes: doc.observacoes, ...campos } }));
      ctx.atualizarContadores();
    } catch (err) { falhou(err); }
  }

  function desenhar() {
    if (doc.status === 'indisponivel') {
      el.innerHTML = `<div class="vazio"><strong>Em preparação</strong>O cronograma de ${esc(nomeDoMes(mes))} ainda está sendo finalizado pela equipe Vie. Assim que for liberado, ele aparece aqui.</div>`;
      return;
    }
    const posts = (doc.posts || []).filter(daTrilha);
    const html = arquivoDaTrilha();
    const algumConteudo = temInterativo(doc) || (doc.posts || []).length;
    const abas = [
      ...(html ? [['interativo', 'Cronograma interativo']] : []),
      ...(posts.length || !html ? [['calendario', 'Calendário'], ['lista', 'Lista'], ['feed', 'Prévia do feed'], ['stories', 'Stories']] : []),
    ];
    if (!abas.some(([k]) => k === visao)) visao = abas[0][0];
    el.innerHTML = `
      ${separado ? `
        <div class="trilhas" role="tablist">
          ${['vie', 'cliente'].map((t) => {
            const n = (doc.posts || []).filter((p) => (p.trilha === 'vie' ? 'vie' : 'cliente') === t).length;
            return `<button data-trilha="${t}" class="${trilha === t ? 'ativo' : ''}" role="tab" aria-selected="${trilha === t}">
              <b>${nomeTrilha[t]}</b>
              <small>${t === 'vie' ? 'O que a Vie produz e publica' : admin ? 'O que o cliente grava e posta' : 'O que você grava e posta'}${n ? ` · ${n}` : ''}</small>
            </button>`;
          }).join('')}
        </div>` : ''}
      ${admin && doc.status !== 'publicado' ? `
        <div class="aviso-rascunho">
          <span><b>Rascunho.</b> ${esc(cliente.nome)} ainda não vê este mês. ${html || posts.length ? 'Revise e libere quando estiver pronto.' : `Suba ${separado ? `o ${nomeNaFrase(trilha)}` : 'o cronograma'} pronto ou monte os conteúdos aqui no portal.`}</span>
          ${!posts.length && !html ? `${usaPlanilha() ? `<button class="btn claro peq" data-planilha>${icones.link}Ligar planilha do Drive</button>` : ''}<button class="btn claro peq" data-subir>${icones.baixar}Subir cronograma pronto (HTML)</button><button class="btn fantasma peq" data-esqueleto>Montar pela linha editorial</button>` : ''}
          <button class="btn acc peq" data-publicar ${algumConteudo ? '' : 'disabled'}>Liberar para o cliente</button>
        </div>` : ''}
      ${faixaAprovacaoMes({ ctx, doc, mes, linkCronograma: false })}

      <div class="faixa-mes">
        <div>
          ${doc.foco ? `<p class="foco">${esc(doc.foco)}</p>` : admin ? '<p class="muted">Sem foco definido para o mês. Use “Foco e recados” para escrever a direção do mês para o cliente.</p>' : ''}
          ${doc.observacoes ? `<p class="obs">${esc(doc.observacoes)}</p>` : ''}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          ${usaPlanilha() && (posts.length || html || doc.status === 'publicado') ? `<button class="btn claro peq" data-planilha>${icones.link}${planilhaDaTrilha() ? 'Planilha do Drive' : 'Ligar planilha do Drive'}</button>` : ''}
          ${admin && (html || posts.length || doc.status === 'publicado') ? `<button class="btn claro peq" data-subir>${icones.baixar}${html ? 'Substituir HTML' : 'Subir cronograma pronto (HTML)'}</button>` : ''}
          ${admin ? `<button class="btn claro peq" data-foco>${icones.editar}Foco e recados</button>` : ''}
          ${admin && (posts.length || (doc.status === 'publicado' && !html)) ? `<button class="btn claro peq" data-esqueleto>${posts.length ? 'Completar' : 'Montar'} pela linha editorial</button>` : ''}
          ${admin && doc.status === 'publicado' ? '<button class="btn fantasma peq" data-despublicar>Voltar para rascunho</button>' : ''}
          ${posts.length ? `<button class="btn claro peq" onclick="window.print()">${icones.imprimir}Imprimir</button>` : ''}
        </div>
      </div>

      ${cartaoPlanilha()}

      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
        ${abas.length > 1 ? `<div class="abas" role="tablist">
          ${abas.map(([k, n]) => `<button data-visao="${k}" class="${visao === k ? 'ativo' : ''}">${n}</button>`).join('')}
        </div>` : ''}
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-left:auto${visao === 'interativo' ? ';display:none' : ''}">
          ${pilares.map((p) => `<span class="etq cheia" style="--cor:${corDoPilar(pilares, p.id)}"><span class="ponto"></span>${esc(p.nome)}</span>`).join('')}
        </div>
      </div>
      <div data-visao-corpo></div>`;

    const corpo = el.querySelector('[data-visao-corpo]');
    if (visao === 'interativo') corpo.innerHTML = interativo();
    else if (!posts.length && visao !== 'stories') {
      const texto = admin
        ? 'Suba o cronograma pronto em HTML, ou monte os conteúdos aqui no portal (“Montar pela linha editorial” ou “Novo conteúdo”).'
        : separado && trilha === 'vie' ? 'Neste mês a equipe Vie ainda não colocou aqui o que vai produzir e publicar.'
          : separado ? 'Neste mês não há conteúdos para você gravar ou postar.' : '';
      corpo.innerHTML = `<div class="vazio"><strong>Nenhum conteúdo ${separado ? `no ${nomeNaFrase(trilha)}` : 'neste mês'}</strong>${texto}</div>`;
    } else if (visao === 'calendario') corpo.innerHTML = calendario(posts);
    else if (visao === 'lista') corpo.innerHTML = lista(posts);
    else if (visao === 'feed') corpo.innerHTML = previaFeed(posts);
    else corpo.innerHTML = stories(posts);

    el.querySelectorAll('[data-trilha]').forEach((b) => {
      b.onclick = () => {
        if (trilha === b.dataset.trilha) return;
        trilha = trilhaSalva[chaveTrilha] = b.dataset.trilha;
        visao = visaoInicial();
        desenhar();
      };
    });
    el.querySelectorAll('[data-visao]').forEach((b) => {
      b.onclick = () => {
        visao = b.dataset.visao;
        try { localStorage.setItem('vie-visao', visao); } catch { /* sem armazenamento */ }
        desenhar();
      };
    });
    el.querySelectorAll('[data-post]').forEach((b) => {
      b.onclick = () => abrirPost({ ctx, mes, post: posts.find((p) => p.id === b.dataset.post), aoMudar: atualizar });
    });
    el.querySelectorAll('[data-add]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); novo(b.dataset.add); }; });
    el.querySelector('[data-publicar]')?.addEventListener('click', () => {
      const m = abrirCamada(`
        <h2>Liberar ${esc(nomeDoMes(mes))}</h2>
        <p>${esc(cliente.nome)} vai passar a ver o cronograma deste mês no portal.</p>
        ${temInterativo(doc) ? '<p class="muted" style="font-size:14px">No cronograma interativo, o cliente pode aprovar o mês ou pedir ajuste com um comentário.</p>' : ''}
        ${(doc.posts || []).some((p) => p.status === 'pauta' && p.origem !== 'html') ? `<label class="opcoes-check"><label><input type="checkbox" checked data-pedir> Pedir aprovação dos conteúdos “Planejados”</label></label>
        <p class="muted" style="font-size:13px">Com essa opção, os conteúdos ficam como “Para aprovar” e o cliente aprova ou pede ajuste em cada um.</p>` : ''}
        <div class="rodape-modal"><button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>Liberar para o cliente</button></div>`);
      m.el.querySelector('[data-ok]').onclick = async () => {
        const pedirAprovacao = !!m.el.querySelector('[data-pedir]')?.checked;
        m.fechar();
        await salvarMes({ status: 'publicado', pedirAprovacao });
        aviso('Cronograma liberado para o cliente.');
      };
    });
    el.querySelector('[data-despublicar]')?.addEventListener('click', async () => {
      if (!(await confirmar('O cliente deixa de ver este mês até você liberar de novo.', { botao: 'Voltar para rascunho' }))) return;
      salvarMes({ status: 'rascunho' });
    });
    el.querySelectorAll('[data-esqueleto]').forEach((b) => {
      b.onclick = async () => {
        const slots = editorial.frequencia?.slots || [];
        if (!slots.length) return aviso('Preencha a frequência do feed na linha editorial primeiro.', { erro: true });
        if (!(await confirmar(`Vou criar os conteúdos de ${nomeDoMes(mes)} seguindo a frequência da linha editorial (${slots.length} por semana) e puxar ideias ainda não usadas do banco. Dias que já têm conteúdo do mesmo formato são mantidos.`, { botao: 'Montar mês' }))) return;
        try {
          const antes = (doc.posts || []).length;
          atualizar(await api(`cronograma?cliente=${id}&mes=${mes}`, { metodo: 'POST', corpo: { acao: 'esqueleto', trilha } }));
          await ctx.ideias(true);
          aviso(`${doc.posts.length - antes} conteúdos criados. Revise e ajuste o que precisar.`);
        } catch (err) { falhou(err); }
      };
    });
    el.querySelectorAll('[data-subir]').forEach((b) => { b.onclick = subirHtml; });
    el.querySelectorAll('[data-planilha]').forEach((b) => { b.onclick = ligarPlanilha; });
    el.querySelector('[data-planilha-atualizar]')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      await enviarAcao({ acao: 'planilha-atualizar', trilha });
      avisarPlanilha();
    });
    el.querySelector('[data-planilha-remover]')?.addEventListener('click', async () => {
      if (!(await confirmar('O portal deixa de ler esta planilha. Os conteúdos e as aprovações que já estão aqui continuam.', { botao: 'Desligar planilha' }))) return;
      enviarAcao({ acao: 'planilha-remover', trilha });
    });
    el.querySelector('[data-remover-html]')?.addEventListener('click', async () => {
      if (!(await confirmar('O arquivo do cronograma interativo será removido deste mês.', { botao: 'Remover', perigo: true }))) return;
      enviarAcao({ acao: 'remover-interativo', trilha });
    });
    ligarAprovacaoMes(el, { ctx, mes, aoMudar: atualizar });
    ligarCaixinhas();
    el.querySelector('[data-reler-html]')?.addEventListener('click', async () => {
      if (posts.some((p) => p.origem !== 'html') && !(await confirmar('Os conteúdos deste mês serão substituídos pelos que estão no HTML. O que já foi marcado como aprovado, gravado ou postado continua marcado.', { botao: 'Ler de novo' }))) return;
      const novo = await lerPostsDoHtml(ctx, mes, trilha);
      if (novo) atualizar(novo);
    });
    el.querySelector('[data-comentar-mes]')?.addEventListener('click', async () => {
      const texto = el.querySelector('[data-comentario-mes]').value.trim();
      if (texto) await enviarAcao({ acao: 'comentar-mes', texto });
    });
    el.querySelector('[data-foco]')?.addEventListener('click', () => {
      const m = abrirCamada(`
        <h2>Foco e recados do mês</h2>
        <label class="campo"><span>Foco do mês (aparece em destaque para o cliente)</span><textarea class="entrada" name="foco" rows="3">${esc(doc.foco || '')}</textarea></label>
        <label class="campo"><span>Recados e observações</span><textarea class="entrada" name="observacoes" rows="5">${esc(doc.observacoes || '')}</textarea></label>
        <div class="rodape-modal"><button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>Salvar</button></div>`);
      m.el.querySelector('[data-ok]').onclick = async () => {
        await salvarMes({ foco: m.el.querySelector('[name=foco]').value, observacoes: m.el.querySelector('[name=observacoes]').value });
        m.fechar();
      };
    });
  }

  // Caixinhas Feito/Publicado/Usada do HTML <-> andamento salvo no portal.
  let ouvinte;
  let filaMarcacoes = Promise.resolve();
  // As chaves do cronograma da Vie são guardadas com o prefixo "vie:"; o HTML não sabe disso.
  function estadoCaixinhas() {
    const prefixo = trilha === 'vie' ? 'vie:' : '';
    const doHtml = (k) => (prefixo ? k.startsWith(prefixo) : !k.startsWith('vie:'));
    const feitos = {};
    Object.entries(doc.marcasHtml || {}).forEach(([k, v]) => { if (doHtml(k)) feitos[k.slice(prefixo.length)] = v; });
    const feito = (p) => (p.marcaHtml === 'gravado' ? ['gravado', 'postado'].includes(p.status) : p.status === 'postado');
    (doc.posts || []).forEach((p) => { if (p.chaveHtml && doHtml(p.chaveHtml)) feitos[p.chaveHtml.slice(prefixo.length)] = feito(p); });
    return feitos;
  }
  function ligarCaixinhas() {
    if (ouvinte) window.removeEventListener('message', ouvinte);
    const quadro = el.querySelector('[data-html-cronograma]');
    if (!quadro) return;
    ouvinte = async (e) => {
      if (!document.body.contains(quadro)) { window.removeEventListener('message', ouvinte); return; }
      if (e.source !== quadro.contentWindow || !e.data) return;
      if (e.data.tipo === 'vie-pronto') {
        quadro.contentWindow.postMessage({ tipo: 'vie-estado', feitos: estadoCaixinhas() }, '*');
      } else if (e.data.tipo === 'vie-marcar') {
        // O cronograma da Vie é marcado pela equipe; para o cliente a caixinha volta como estava.
        if (trilha === 'vie' && !admin) {
          quadro.contentWindow.postMessage({ tipo: 'vie-estado', feitos: estadoCaixinhas() }, '*');
          return;
        }
        const corpo = { acao: 'marcar-html', chave: String(e.data.chave), feito: !!e.data.feito, trilha };
        // Uma marcação por vez, para cliques rápidos não se sobreporem.
        filaMarcacoes = filaMarcacoes.then(async () => {
          try {
            // Atualiza sem redesenhar, para o cronograma não recarregar na tela.
            doc = await api(`cronograma?cliente=${id}&mes=${mes}`, { metodo: 'POST', corpo });
            ctx.atualizarContadores();
          } catch (err) {
            falhou(err);
            quadro.contentWindow.postMessage({ tipo: 'vie-estado', feitos: estadoCaixinhas() }, '*');
          }
        });
      }
    };
    window.addEventListener('message', ouvinte);
  }

  async function enviarAcao(corpo) {
    try {
      atualizar(await api(`cronograma?cliente=${id}&mes=${mes}`, { metodo: 'POST', corpo }));
      ctx.atualizarContadores();
    } catch (err) { falhou(err); }
  }

  function subirHtml() {
    const m = abrirCamada(`
      <h2>${arquivoDaTrilha() ? 'Substituir o cronograma' : 'Subir cronograma pronto'}${separado ? `<small class="muted" style="display:block;font-size:14px;margin-top:4px">${nomeTrilha[trilha]}</small>` : ''}</h2>
      <p class="muted">Envie o arquivo <b>.html</b> ${separado ? (trilha === 'vie' ? 'com o que a Vie vai produzir e publicar' : 'com o que o cliente vai gravar e postar') : 'do cronograma'} em ${esc(nomeDoMes(mes))} (o mesmo que vocês publicariam no Netlify). Ele aparece dentro do portal, só para ${esc(cliente.nome)}.</p>
      <label class="campo"><span>Arquivo HTML (até 4 MB)</span><input class="entrada" type="file" accept=".html,.htm,text/html"></label>
      <p class="muted" style="font-size:13px">Precisa ser um arquivo único. Imagens podem estar dentro do HTML ou em links externos. Se o mês já tinha sido aprovado, a nova versão volta a esperar a aprovação do cliente.</p>
      <div class="rodape-modal"><button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>Enviar</button></div>`);
    m.el.querySelector('[data-ok]').onclick = async (ev) => {
      const f = m.el.querySelector('input[type=file]').files[0];
      if (!f) return aviso('Escolha o arquivo.', { erro: true });
      if (f.size > 4 * 1024 * 1024) return aviso('Arquivo acima de 4 MB. Deixe as imagens em links externos ou comprima-as.', { erro: true });
      ev.target.disabled = true;
      try {
        atualizar(await api(`cronograma?cliente=${id}&mes=${mes}&interativo=1&trilha=${trilha}&nome=${encodeURIComponent(f.name)}`, { metodo: 'POST', arquivo: f }));
        visao = 'interativo';
        m.fechar();
        aviso(doc.status === 'publicado' ? 'Cronograma atualizado. O cliente já vê a nova versão.' : 'Cronograma enviado. Confira e clique em “Liberar para o cliente”.');
        avisarLeitura(doc, trilha);
        ctx.atualizarContadores();
        desenhar();
      } catch (err) {
        falhou(err);
        ev.target.disabled = false;
      }
    };
  }

  function cartaoPlanilha() {
    const pl = planilhaDaTrilha();
    if (!pl || (!admin && !pl.pasta)) return '';
    const outros = pl.outrosMeses?.length ? ` <b>${pl.foraDoMes} ${pl.foraDoMes === 1 ? 'conteúdo é' : 'conteúdos são'} de ${pl.outrosMeses.map((m) => nomeDoMes(m).toLowerCase().replace(' ', ' de ')).join(' e ')}:</b> ligue a mesma planilha também ${pl.outrosMeses.length === 1 ? 'nesse mês' : 'nesses meses'}.` : '';
    return `
      <div class="cartao cartao-planilha">
        <div style="flex:1;min-width:220px">
          <span class="mono">${admin ? 'Planilha do Drive' : 'Conteúdo no Drive'}</span>
          <p class="muted" style="font-size:13.5px;margin-top:4px">${admin
            ? `${pl.lidaEm ? `${esc(pl.nome || 'Planilha')} · ${pl.total} ${pl.total === 1 ? 'conteúdo lido' : 'conteúdos lidos'} em ${esc(quando(pl.lidaEm))}. ` : ''}${pl.link ? 'Mudou algo na planilha? Clique em “Atualizar da planilha”: o que já foi aprovado continua aprovado.' : pl.lidaEm ? 'Enviada como arquivo: para atualizar, envie a versão nova.' : ''}${outros}`
            : 'As artes e vídeos deste mês também estão na pasta do Drive.'}</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${admin && pl.link ? '<button class="btn acc peq" data-planilha-atualizar>Atualizar da planilha</button>' : ''}
          ${admin && pl.link ? `<a class="btn claro peq" href="${esc(pl.link)}" target="_blank" rel="noopener">${icones.link}Abrir planilha</a>` : ''}
          ${pl.pasta ? `<a class="btn claro peq" href="${esc(pl.pasta)}" target="_blank" rel="noopener">${icones.link}Abrir pasta no Drive</a>` : ''}
          ${admin ? `<button class="btn-icone" data-planilha-remover title="Desligar planilha">${icones.lixo}</button>` : ''}
        </div>
      </div>`;
  }

  function avisarPlanilha() {
    const pl = planilhaDaTrilha();
    if (!pl?.lidaEm) return;
    aviso(`${pl.total} ${pl.total === 1 ? 'conteúdo lido' : 'conteúdos lidos'} da planilha. ${doc.status === 'publicado' ? 'Os novos já estão com o cliente para aprovar.' : 'Libere o mês para o cliente aprovar.'}`);
    if (pl.outrosMeses?.length) aviso(`${pl.foraDoMes} ${pl.foraDoMes === 1 ? 'conteúdo é' : 'conteúdos são'} de ${pl.outrosMeses.map((m) => nomeDoMes(m).toLowerCase().replace(' ', ' de ')).join(' e ')}: ligue a mesma planilha também ${pl.outrosMeses.length === 1 ? 'nesse mês' : 'nesses meses'}.`);
  }

  function ligarPlanilha() {
    const pl = planilhaDaTrilha() || {};
    const m = abrirCamada(`
      <h2>Planilha do Drive<small class="muted" style="display:block;font-size:14px;margin-top:4px">${nomeTrilha[trilha]} · ${esc(nomeDoMes(mes))}</small></h2>
      <p class="muted">O portal lê a planilha do cronograma e cria um conteúdo por linha, com a arte ou o vídeo do link da coluna <b>Imagem</b>. ${esc(cliente.nome)} aprova ou pede ajuste em cada um.</p>
      <label class="campo"><span>Link da planilha (Google Planilhas ou .xlsx no Drive)</span><input class="entrada" name="link" placeholder="https://docs.google.com/spreadsheets/d/…" value="${esc(pl.link || '')}"></label>
      <label class="campo"><span>Link da pasta do mês no Drive (opcional, vira o botão “Abrir pasta no Drive”)</span><input class="entrada" name="pasta" placeholder="https://drive.google.com/drive/folders/…" value="${esc(pl.pasta || '')}"></label>
      <p class="muted" style="font-size:13px">A planilha e as artes precisam estar compartilhadas como <b>“Qualquer pessoa com o link”</b> (Leitor). Prefere enviar o arquivo? <label class="link-arquivo">Escolher .xlsx, .csv ou .html<input type="file" accept=".xlsx,.csv,.html,.htm" hidden></label> <span data-arquivo-nome></span></p>
      <div class="rodape-modal"><button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>Ler planilha</button></div>`);
    const campoArquivo = m.el.querySelector('input[type=file]');
    campoArquivo.onchange = () => { m.el.querySelector('[data-arquivo-nome]').textContent = campoArquivo.files[0]?.name || ''; };
    m.el.querySelector('[data-ok]').onclick = async (ev) => {
      const link = m.el.querySelector('[name=link]').value.trim();
      const pasta = m.el.querySelector('[name=pasta]').value.trim();
      const arquivo = campoArquivo.files[0];
      if (!link && !arquivo && !pasta) return aviso('Cole o link da planilha ou escolha o arquivo.', { erro: true });
      ev.target.disabled = true;
      ev.target.textContent = 'Lendo…';
      try {
        // A pasta (e o link) ficam salvos antes, para o envio do arquivo usar a mesma pasta.
        if (link || pasta) atualizar(await api(`cronograma?cliente=${id}&mes=${mes}`, { metodo: 'POST', corpo: { acao: 'planilha-link', link: arquivo ? '' : link, pasta, trilha } }));
        if (arquivo) atualizar(await api(`cronograma?cliente=${id}&mes=${mes}&planilha=1&trilha=${trilha}&nome=${encodeURIComponent(arquivo.name)}`, { metodo: 'POST', arquivo }));
        m.fechar();
        visao = visaoInicial();
        desenhar();
        avisarPlanilha();
        ctx.atualizarContadores();
      } catch (err) {
        falhou(err);
        ev.target.disabled = false;
        ev.target.textContent = 'Ler planilha';
      }
    };
  }

  function interativo() {
    const arquivo = arquivoDaTrilha();
    const src = `/api/cronograma?cliente=${id}&mes=${mes}&interativo=1&trilha=${trilha}&v=${encodeURIComponent(arquivo.enviadoEm)}`;
    const conversa = doc.conversa || [];
    const l = leituraDaTrilha();
    const outros = admin && l?.outrosMeses?.length ? ` <b>${l.foraDoMes} ${l.foraDoMes === 1 ? 'conteúdo é' : 'conteúdos são'} de ${l.outrosMeses.map((m) => nomeDoMes(m).toLowerCase().replace(' ', ' de ')).join(' e ')}:</b> para ${l.foraDoMes === 1 ? 'ele entrar' : 'eles entrarem'} no acompanhamento, suba o mesmo arquivo também ${l.outrosMeses.length === 1 ? 'nesse mês' : 'nesses meses'}.` : '';
    const marcarTexto = admin ? 'O que for marcado no cronograma (Feito, Publicado, Gravado ou Usada) atualiza a visão geral.'
      : trilha === 'vie' ? 'A equipe Vie marca aqui o que já foi publicado.'
        : 'Marque aqui no cronograma o que já foi feito (Feito, Publicado ou Gravado): a equipe Vie acompanha pela visão geral.';
    return `
      <div class="cartao" style="margin-bottom:16px;display:grid;gap:14px">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <span class="muted" style="font-size:13px">Versão enviada em ${esc(quando(arquivo.enviadoEm))}${admin && l ? ` · ${l.total} ${l.total === 1 ? 'conteúdo lido' : 'conteúdos lidos'} para o acompanhamento` : ''}${admin && !l ? ' · os posts ainda não foram lidos para o acompanhamento' : ''}. ${marcarTexto}${outros}</span>
          <span style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
            ${admin ? `<button class="btn claro peq" data-reler-html>${l ? 'Ler os posts de novo' : 'Ler os posts do HTML'}</button>` : ''}
            <a class="btn claro peq" href="${src}" target="_blank" rel="noopener">${icones.link}Abrir em tela cheia</a>
            ${admin ? `<button class="btn-icone" data-remover-html title="Remover arquivo">${icones.lixo}</button>` : ''}
          </span>
        </div>
        ${conversa.length ? `<div style="display:grid;gap:8px">${conversa.slice(-3).map((c) => `
          <div class="comentario${c.admin ? ' vie' : ''}"><div class="quem"><b>${esc(c.nome)}</b>${c.admin ? '<span>· Vie</span>' : ''}<span style="margin-left:auto">${esc(quando(c.em))}</span></div><p>${esc(c.texto)}</p></div>`).join('')}</div>` : ''}
        <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
          <textarea class="entrada" data-comentario-mes rows="1" placeholder="Comentário sobre o cronograma do mês…" style="flex:1;min-width:220px;min-height:44px"></textarea>
          <button class="btn claro" data-comentar-mes>Enviar</button>
        </div>
      </div>
      <iframe class="quadro-interativo" data-html-cronograma src="${src}&portal=1" title="${separado ? nomeTrilha[trilha] : 'Cronograma interativo'} de ${esc(nomeDoMes(mes))}"
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-downloads"></iframe>`;
  }

  function chip(p) {
    return `<button class="chip-post" data-post="${p.id}" style="--cor:${corDoPilar(pilares, p.pilarId)}">
      <span class="l1">${esc(FORMATOS[p.formato]?.curto || '')}${p.horario ? ` · <span class="hora">${esc(p.horario)}</span>` : ''}<span class="ponto" style="--cor:var(--s-${p.status})" title="${esc(p.status)}"></span></span>
      <span class="t">${p.titulo ? esc(p.titulo) : '<span class="sem-titulo">Sem título</span>'}</span>
    </button>`;
  }

  function calendario(posts) {
    const [ano, m] = mes.split('-').map(Number);
    const total = new Date(ano, m, 0).getDate();
    const inicio = (new Date(ano, m - 1, 1).getDay() + 6) % 7;
    const hoje = hojeISO();
    let html = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((d) => `<div class="sem">${d}</div>`).join('');
    for (let i = 0; i < inicio; i++) html += '<div class="cel fora"></div>';
    for (let d = 1; d <= total; d++) {
      const iso = `${mes}-${String(d).padStart(2, '0')}`;
      const doDia = posts.filter((p) => p.data === iso);
      html += `<div class="cel${iso === hoje ? ' hoje' : ''}${doDia.length ? '' : ' vazia-mobile'}">
        <div class="num"><b>${d}</b><span class="mobile-dia muted" style="font-size:11px">${diaSemanaCurto(iso)}</span>${admin ? `<button class="add" data-add="${iso}" title="Adicionar conteúdo">+</button>` : ''}</div>
        ${doDia.map(chip).join('')}
      </div>`;
    }
    const resto = (7 - ((inicio + total) % 7)) % 7;
    for (let i = 0; i < resto; i++) html += '<div class="cel fora"></div>';
    return `<div class="calendario">${html}</div>`;
  }

  function lista(posts) {
    const semanas = {};
    posts.forEach((p) => {
      const d = dataObj(p.data);
      const seg = new Date(d);
      seg.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const chave = seg.toISOString().slice(0, 10);
      (semanas[chave] ||= []).push(p);
    });
    const planejado = pilares.map((p) => ({ ...p, real: posts.filter((x) => x.pilarId === p.id).length }));
    const totalComPilar = planejado.reduce((s, p) => s + p.real, 0) || 1;
    return `
      ${pilares.length ? `
        <div class="cartao" style="margin-bottom:22px">
          <div class="cab"><h3>Distribuição por pilar</h3><span class="mono">Mês × linha editorial</span></div>
          <div class="distribuicao">
            ${planejado.map((p) => {
              const pct = Math.round((p.real / totalComPilar) * 100);
              return `<div class="linha"><span>${esc(p.nome)}</span><span class="trilho" style="--cor:${corDoPilar(pilares, p.id)}"><span style="width:${pct}%"></span>${p.percentual ? `<i style="left:${Math.min(99, p.percentual)}%" title="Planejado: ${p.percentual}%"></i>` : ''}</span><span class="muted">${pct}%${p.percentual ? ` / ${p.percentual}%` : ''}</span></div>`;
            }).join('')}
          </div>
          <p class="muted" style="font-size:12.5px;margin-top:10px">A barra mostra o mês; o traço preto marca o percentual planejado na linha editorial.</p>
        </div>` : ''}
      ${Object.entries(semanas).map(([, ps], i) => `
        <div class="semana-lista">
          <span class="mono">Semana ${i + 1} · ${esc(dataCurta(ps[0].data))} a ${esc(dataCurta(ps.at(-1).data))}</span>
          ${ps.map((p) => `
            <button class="linha-post" data-post="${p.id}">
              <span class="dia"><b>${Number(p.data.slice(8))}</b><small>${esc(diaSemanaCurto(p.data))}${p.horario ? ` · ${esc(p.horario)}` : ''}</small></span>
              <span class="tags">${etiquetaFormato(p.formato)}${etiquetaPilar(pilares, p.pilarId)}</span>
              <span style="min-width:0">
                <span class="titulo" style="display:block">${p.titulo ? esc(p.titulo) : '<span class="sem-titulo">Sem título</span>'}</span>
                ${p.gancho ? `<span class="gancho">“${esc(p.gancho)}”</span>` : ''}
              </span>
              ${etiquetaStatus(p.status)}
            </button>`).join('')}
        </div>`).join('')}`;
  }

  function previaFeed(posts) {
    const feed = posts.filter((p) => p.formato !== 'story').slice().reverse();
    return `
      <div class="previa-feed">
        <div class="perfil">
          <span class="avatar">${esc(iniciais(cliente.nome))}</span>
          <div style="min-width:0">
            <b>${esc(cliente.instagram ? `@${cliente.instagram}` : cliente.nome)}</b>
            <span class="muted" style="font-size:13px">${feed.length} posts planejados em ${esc(nomeDoMes(mes))}</span>
            ${editorial.bio?.texto ? `<p class="bio">${esc(editorial.bio.texto)}</p>` : ''}
          </div>
        </div>
        <div class="grade-feed">
          ${feed.map((p) => `
            <button class="bloco-feed${p.midia?.length ? ' com-arte' : ''}" data-post="${p.id}" style="--cor:${corDoPilar(pilares, p.pilarId)}${p.midia?.length ? `;background-image:url('${capaDrive(p.midia[0].id, 500)}')` : ''}">
              <span class="icone">${icones[p.formato] || ''}</span>
              <span class="capa">${esc(p.formato === 'carrossel' || p.formato === 'estatico' ? p.gancho || p.titulo : p.titulo || p.gancho) || 'Sem título'}</span>
              <span class="rodape-bloco"><span>${esc(dataCurta(p.data))}</span><span>${esc(FORMATOS[p.formato]?.curto || '')}</span></span>
            </button>`).join('')}
        </div>
      </div>
      <p class="muted" style="text-align:center;font-size:13px;margin-top:12px">Simulação da grade: o post mais recente aparece primeiro, como no Instagram.</p>`;
  }

  function stories(posts) {
    const plano = editorial.stories;
    const avulsos = posts.filter((p) => p.formato === 'story');
    return `
      ${plano?.resumo ? `<div class="objetivo" style="margin-bottom:16px"><div><span class="mono">Todos os dias</span><p class="serif">${esc(plano.resumo)}</p></div></div>` : ''}
      ${plano?.dias?.length ? `<div class="grade-stories">${plano.dias.map((d) => `
        <div class="cartao">
          <span class="mono" style="color:var(--acc);font-size:10px">${esc(d.dia)}</span>
          <h3 class="serif" style="font-size:20px;margin-top:6px">${esc(d.titulo)}</h3>
          <ul>${(d.itens || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
        </div>`).join('')}</div>` : '<div class="vazio">A rotina de stories ainda não foi definida na linha editorial.</div>'}
      ${avulsos.length ? `<div class="secao-titulo"><h2>Stories programados</h2></div><div class="lista-conteudos">${avulsos.map((p) => `
        <button class="linha-post" data-post="${p.id}">
          <span class="dia"><b>${Number(p.data.slice(8))}</b><small>${esc(diaSemanaCurto(p.data))}</small></span>
          <span class="tags">${etiquetaPilar(pilares, p.pilarId)}</span>
          <span class="titulo">${esc(p.titulo || 'Sem título')}</span>
          ${etiquetaStatus(p.status)}
        </button>`).join('')}</div>` : ''}`;
  }

  desenhar();
}
