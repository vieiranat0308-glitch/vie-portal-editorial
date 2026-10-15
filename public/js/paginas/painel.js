// Visão geral de um cliente: saudação, números do mês, calendário e próximos conteúdos.
import { api, esc, falhou, hojeISO, mesAtual, somarMes, saudacao, diaSemanaCurto, dataLonga, compacto, num, icones } from '../ui.js';
import { FORMATOS, STATUS, nomeDoMes, corDoPilar } from '../regras.js';
import { linhaSuave, miniCalendario } from '../componentes/graficos.js';
import { abrirPost, etiquetaFormato, etiquetaStatus } from '../componentes/post.js';
import { faixaAprovacaoMes, ligarAprovacaoMes } from '../componentes/aprovacao-mes.js';

export async function render(el, ctx) {
  const { cliente, admin } = ctx;
  const id = encodeURIComponent(cliente.id);
  let mes = mesAtual();
  let selecionado = hojeISO();
  ctx.topo('Geral', 'Visão geral', admin
    ? `<button class="btn" data-novo><span>Novo conteúdo</span><span class="mais">+</span></button>`
    : `<a class="btn claro" href="#${ctx.base}/ideias">${icones.ideia}Sugerir ideia</a>`);

  const [editorial, metricas] = await Promise.all([ctx.editorial(), api(`metricas?cliente=${id}`)]);
  const pilares = editorial.pilares || [];
  let doc = await api(`cronograma?cliente=${id}&mes=${mes}`);

  document.querySelector('[data-novo]')?.addEventListener('click', () => {
    abrirPost({ ctx, mes, post: { data: selecionado.startsWith(mes) ? selecionado : `${mes}-01`, formato: 'reel', status: 'pauta' }, aoMudar: (d) => { doc = d; desenhar(); } });
  });

  const nome = cliente.tratamento || (admin ? cliente.nome : ctx.usuario.nome).split(' ')[0];
  const mesesMetricas = Object.keys(metricas).sort();
  const ultimo = mesesMetricas.at(-1);
  const penultimo = mesesMetricas.at(-2);
  const m = ultimo ? metricas[ultimo] : null;

  function desenhar() {
    const disponivel = doc.status !== 'indisponivel';
    const posts = doc.posts || [];
    const hoje = hojeISO();
    const deHoje = posts.filter((p) => p.data === hoje);
    const paraAprovar = posts.filter((p) => p.status === 'aprovacao').length;
    const ajustes = posts.filter((p) => p.status === 'ajuste').length;

    const frases = [];
    if (mes === mesAtual()) frases.push(deHoje.length ? `Hoje ${deHoje.length === 1 ? 'tem 1 conteúdo' : `tem ${deHoje.length} conteúdos`} no cronograma` : 'Hoje não tem conteúdo de feed no cronograma');
    if (admin && ajustes) frases.push(`${ajustes} ${ajustes === 1 ? 'ajuste pedido' : 'ajustes pedidos'} pelo cliente`);
    if (!admin && paraAprovar && !doc.interativo) frases.push(`${paraAprovar} ${paraAprovar === 1 ? 'conteúdo esperando' : 'conteúdos esperando'} a sua aprovação`);
    const apMes = doc.interativo ? doc.aprovacaoMes?.status || 'aguardando' : null;
    if (!admin && apMes === 'aguardando') frases.push(`o cronograma de ${nomeDoMes(mes).split(' ')[0].toLowerCase()} está esperando a sua aprovação`);
    if (admin && doc.status === 'publicado' && apMes === 'ajuste') frases.push('o cliente pediu ajuste no cronograma do mês');
    if (admin && doc.status === 'rascunho') frases.push(posts.length || doc.interativo ? 'o cronograma deste mês ainda está em rascunho, o cliente não vê' : 'o cronograma deste mês ainda não foi montado');

    const porStatus = Object.fromEntries(Object.keys(STATUS).map((k) => [k, posts.filter((p) => p.status === k).length]));
    const porFormato = Object.fromEntries(Object.keys(FORMATOS).map((k) => [k, posts.filter((p) => p.formato === k).length]));
    const proximos = posts.filter((p) => p.data >= (mes === mesAtual() ? hoje : `${mes}-01`)).slice(0, 5);
    const doDia = posts.filter((p) => p.data === selecionado);

    const serieSeg = mesesMetricas.slice(-8).map((k) => metricas[k].seguidores);
    const maxSeg = Math.max(...serieSeg.filter((x) => x != null), 1);
    const deltaSeg = m && penultimo && metricas[penultimo].seguidores != null && m.seguidores != null
      ? m.seguidores - metricas[penultimo].seguidores
      : m?.novosSeguidores;

    el.innerHTML = `
      <section class="saudacao">
        <h1>${saudacao()}, ${esc(nome)}</h1>
        <p>${frases.length ? `${esc(frases.join(' e ').replace(/^./, (c) => c.toUpperCase()))}.` : ''} ${editorial.objetivo?.titulo ? `Foco da estratégia: ${esc(editorial.objetivo.titulo.charAt(0).toLowerCase() + editorial.objetivo.titulo.slice(1))}.` : ''}</p>
      </section>

      <div style="margin-top:20px">${faixaAprovacaoMes({ ctx, doc, mes })}</div>
      <div class="painel-grade" style="margin-top:4px">
        <div class="coluna">
          <div class="duas">
            <div class="cartao destaque">
              <div class="cab"><h3 style="color:#fff">Seguidores</h3><span class="mono" style="color:rgba(255,255,255,.7)">${ultimo ? esc(nomeDoMes(ultimo, { curto: true })) : 'sem dados'}</span></div>
              <div style="display:flex;gap:12px;align-items:center">
                <span class="numero-grande">${m?.seguidores != null ? num(m.seguidores) : '—'}</span>
                ${deltaSeg != null ? `<span class="delta">${deltaSeg >= 0 ? '+' : ''}${num(deltaSeg)} no mês</span>` : ''}
              </div>
              ${serieSeg.filter((v) => v != null).length > 1
                ? `<div class="barrinhas">${serieSeg.map((v, i) => `<span class="${i === serieSeg.length - 1 ? 'atual' : ''}" style="height:${v == null ? 4 : Math.max(8, (v / maxSeg) * 100)}%" title="${num(v)}"></span>`).join('')}</div>`
                : `<p style="margin-top:18px;font-size:13px;opacity:.8">${m ? `${esc(nomeDoMes(ultimo))} é a base de partida. A evolução aparece aqui a cada acompanhamento.` : 'Os números aparecem aqui depois do primeiro acompanhamento.'}</p>`}
            </div>
            <div class="cartao escuro">
              <div class="cab"><h3>Alcance do perfil</h3><span class="mono" style="color:var(--creme-2)">${ultimo ? esc(nomeDoMes(ultimo, { curto: true })) : ''}</span></div>
              ${m ? `
                <div class="numeros">
                  <div><div class="n">${compacto(m.visualizacoes)}</div><div class="rot">Visualizações</div></div>
                  <div><div class="n">${m.naoSeguidores != null ? `${num(m.naoSeguidores, 1)}%` : '—'}</div><div class="rot">Não seguidores</div></div>
                  <div><div class="n">${compacto(m.interacoes)}</div><div class="rot">Interações</div></div>
                </div>
                ${linhaSuave(mesesMetricas.map((k) => metricas[k].visualizacoes), { cor: '#efe2bd', altura: 70 }) || `<p style="margin-top:18px;font-size:13px;opacity:.65">O gráfico de evolução aparece a partir do segundo mês de acompanhamento.</p>`}
              ` : '<p style="opacity:.7">As métricas aparecem aqui depois do primeiro acompanhamento mensal.</p>'}
            </div>
          </div>

          <div class="duas">
            <div class="cartao">
              <div class="cab"><h3>Fluxo do mês</h3></div>
              <div class="fluxo">
                ${Object.entries(STATUS).map(([k, s]) => `<div><div class="n">${porStatus[k]}</div><div class="rot"><span class="ponto" style="--cor:${s.cor}"></span>${s.nome}</div></div>`).join('')}
              </div>
            </div>
            <div class="cartao">
              <div class="cab"><h3>Mês no feed</h3></div>
              <div class="fluxo">
                <div><div class="n">${posts.length}</div><div class="rot">Conteúdos</div></div>
                ${Object.entries(FORMATOS).map(([k, f]) => `<div><div class="n">${porFormato[k]}</div><div class="rot"><span class="ponto" style="--cor:${f.cor}"></span>${f.nome}</div></div>`).join('')}
              </div>
              ${posts.length && pilares.length ? `<div class="barra-empilhada" style="margin-top:18px" title="Distribuição por pilar">${pilares.map((p) => {
                const n = posts.filter((x) => x.pilarId === p.id).length;
                return n ? `<span style="flex:${n};--cor:${corDoPilar(pilares, p.id)}" title="${esc(p.nome)}: ${n}"></span>` : '';
              }).join('')}</div>` : ''}
            </div>
          </div>

          ${editorial.objetivo?.titulo ? `
            <div class="objetivo">
              <div style="flex:1">
                <span class="mono">Objetivo estratégico</span>
                <p class="serif">${esc(editorial.objetivo.titulo)}</p>
              </div>
              ${m?.pacientes != null ? `<div style="text-align:right"><div class="numero-grande">${num(m.pacientes)}</div><span class="mono muted" style="font-size:9.5px">Novos pacientes · ${esc(nomeDoMes(ultimo, { curto: true }))}</span></div>` : ''}
            </div>` : ''}

          <div class="cartao">
            <div class="cab"><h3>Próximos conteúdos</h3><a class="btn claro peq" style="margin-left:auto" href="#${ctx.base}/cronograma/${mes}">Ver mês</a></div>
            ${!disponivel ? `<div class="vazio"><strong>Em preparação</strong>O cronograma de ${esc(nomeDoMes(mes))} está sendo finalizado pela equipe Vie.</div>`
              : doc.interativo && !posts.length ? `
                <div class="objetivo" style="background:var(--acc-soft);border-color:transparent">
                  <div style="flex:1">
                    <span class="mono">Cronograma interativo</span>
                    <p class="serif">O cronograma de ${esc(nomeDoMes(mes).toLowerCase())} está pronto.</p>
                    <p class="muted" style="font-size:13.5px;margin-top:4px">${apMes === 'aprovado' ? 'Aprovado ✓' : apMes === 'ajuste' ? 'Ajuste pedido: a equipe Vie está revisando.' : admin ? 'Esperando a aprovação do cliente.' : 'Dê uma olhada e aprove ou peça ajuste.'}</p>
                  </div>
                  <a class="btn acc" href="#${ctx.base}/cronograma/${mes}">Abrir cronograma</a>
                </div>`
              : proximos.length ? `<div class="lista-conteudos">${proximos.map((p) => itemConteudo(p, hoje)).join('')}</div>`
              : `<div class="vazio">${posts.length ? 'Todos os conteúdos deste mês já passaram.' : 'Nenhum conteúdo neste mês ainda.'}</div>`}
          </div>
        </div>

        <div class="coluna">
          <div class="cartao" data-cal></div>
          <div class="cartao">
            <div class="cab"><h3>${selecionado === hoje ? 'Hoje' : esc(dataLonga(selecionado))}</h3><span class="mono">Feed e stories</span></div>
            ${doDia.length ? `<div class="lista-conteudos">${doDia.map((p) => itemConteudo(p, hoje, true)).join('')}</div>` : '<p class="muted" style="font-size:14px">Nada programado para este dia.</p>'}
            ${storiesDoDia(editorial, selecionado)}
          </div>
          <a class="btn bloco" href="#${ctx.base}/cronograma/${mes}">Ver calendário completo</a>
        </div>
      </div>`;

    ligarAprovacaoMes(el, { ctx, mes, aoMudar: (d) => { doc = d; desenhar(); } });
    miniCalendario(el.querySelector('[data-cal]'), {
      mes,
      posts,
      selecionado,
      aoEscolher: (d) => { selecionado = d; desenhar(); },
      aoMudarMes: async (delta) => {
        mes = somarMes(mes, delta);
        selecionado = mes === mesAtual() ? hojeISO() : `${mes}-01`;
        try { doc = await api(`cronograma?cliente=${id}&mes=${mes}`); } catch (err) { falhou(err); }
        desenhar();
      },
    });
    el.querySelectorAll('[data-post]').forEach((b) => {
      b.onclick = () => abrirPost({ ctx, mes, post: posts.find((p) => p.id === b.dataset.post), aoMudar: (d) => { doc = d; desenhar(); } });
    });
  }

  function itemConteudo(p, hoje, compacto = false) {
    return `
      <button class="item-conteudo${p.data === hoje ? ' hoje' : ''}${compacto ? ' compacto' : ''}" data-post="${p.id}">
        <span class="data"><b>${Number(p.data.slice(8))}</b><small>${esc(diaSemanaCurto(p.data))}</small></span>
        <span style="min-width:0">
          <span class="titulo" style="display:block">${p.titulo ? esc(p.titulo) : '<span class="sem-titulo">Sem título</span>'}</span>
          <span class="meta">${etiquetaFormato(p.formato)}${p.horario ? `<span>${esc(p.horario)}</span>` : ''}${pilares.find((x) => x.id === p.pilarId) ? `<span style="color:${corDoPilar(pilares, p.pilarId)}">● ${esc(pilares.find((x) => x.id === p.pilarId).nome)}</span>` : ''}</span>
          ${compacto ? `<span class="meta">${etiquetaStatus(p.status)}</span>` : ''}
        </span>
        ${compacto ? '' : etiquetaStatus(p.status)}
      </button>`;
  }

  desenhar();
}

// Mostra o roteiro de stories da linha editorial para o dia da semana escolhido.
export function storiesDoDia(editorial, iso) {
  const dias = editorial.stories?.dias || [];
  if (!dias.length) return '';
  const nomes = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const [a, m, d] = iso.split('-').map(Number);
  const semana = new Date(a, m - 1, d).getDay();
  const alvo = nomes[semana];
  const normal = (s) => s.toLowerCase();
  const plano = dias.find((x) => normal(x.dia).startsWith(alvo))
    || (semana === 0 || semana === 6 || semana === 5 ? dias.find((x) => /sexta a domingo|fim de semana/i.test(x.dia)) : null);
  if (!plano) return '';
  return `
    <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line)">
      <span class="mono muted" style="font-size:10px">Stories · ${esc(plano.dia)}</span>
      <p style="font:500 17px var(--serif);margin-top:4px">${esc(plano.titulo)}</p>
      <ul style="padding-left:16px;margin:8px 0 0;font-size:13.5px;color:var(--muted);display:grid;gap:4px">${(plano.itens || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    </div>`;
}

