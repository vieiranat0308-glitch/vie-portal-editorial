// Cronograma mensal: calendário, lista por semana, prévia do feed e stories.
import { api, esc, aviso, falhou, abrirCamada, confirmar, hojeISO, mesAtual, somarMes, dataObj, dataCurta, diaSemanaCurto, icones, iniciais } from '../ui.js';
import { FORMATOS, nomeDoMes, corDoPilar } from '../regras.js';
import { abrirPost, etiquetaFormato, etiquetaPilar, etiquetaStatus } from '../componentes/post.js';

let visaoSalva = 'calendario';

export async function render(el, ctx) {
  const { cliente, admin } = ctx;
  const id = encodeURIComponent(cliente.id);
  const mes = /^\d{4}-\d{2}$/.test(ctx.rota.extra || '') ? ctx.rota.extra : mesAtual();
  try { visaoSalva = localStorage.getItem('vie-visao') || visaoSalva; } catch { /* sem armazenamento */ }
  let visao = visaoSalva;

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

  const novo = (data) => abrirPost({ ctx, mes, post: { data, formato: 'reel', status: 'pauta' }, aoMudar: atualizar });
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
    const posts = doc.posts || [];
    el.innerHTML = `
      ${admin && doc.status !== 'publicado' ? `
        <div class="aviso-rascunho">
          <span><b>Rascunho.</b> ${esc(cliente.nome)} ainda não vê este mês. Revise os conteúdos e libere quando estiver pronto.</span>
          ${!posts.length ? '<button class="btn claro peq" data-esqueleto>Montar mês pela linha editorial</button>' : ''}
          <button class="btn acc peq" data-publicar ${posts.length ? '' : 'disabled'}>Liberar para o cliente</button>
        </div>` : ''}

      <div class="faixa-mes">
        <div>
          ${doc.foco ? `<p class="foco">${esc(doc.foco)}</p>` : admin ? '<p class="muted">Sem foco definido para o mês. Use “Foco e recados” para escrever a direção do mês para o cliente.</p>' : ''}
          ${doc.observacoes ? `<p class="obs">${esc(doc.observacoes)}</p>` : ''}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          ${admin ? `<button class="btn claro peq" data-foco>${icones.editar}Foco e recados</button>` : ''}
          ${admin && posts.length ? '<button class="btn claro peq" data-esqueleto>Completar pela linha editorial</button>' : ''}
          ${admin && doc.status === 'publicado' ? '<button class="btn fantasma peq" data-despublicar>Voltar para rascunho</button>' : ''}
          <button class="btn claro peq" onclick="window.print()">${icones.imprimir}Imprimir</button>
        </div>
      </div>

      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
        <div class="abas" role="tablist">
          ${[['calendario', 'Calendário'], ['lista', 'Lista'], ['feed', 'Prévia do feed'], ['stories', 'Stories']].map(([k, n]) => `<button data-visao="${k}" class="${visao === k ? 'ativo' : ''}">${n}</button>`).join('')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-left:auto">
          ${pilares.map((p) => `<span class="etq cheia" style="--cor:${corDoPilar(pilares, p.id)}"><span class="ponto"></span>${esc(p.nome)}</span>`).join('')}
        </div>
      </div>
      <div data-visao-corpo></div>`;

    const corpo = el.querySelector('[data-visao-corpo]');
    if (!posts.length && visao !== 'stories') {
      corpo.innerHTML = `<div class="vazio"><strong>Nenhum conteúdo neste mês</strong>${admin ? 'Use “Montar mês pela linha editorial” para criar os conteúdos a partir da frequência e do banco de ideias, ou adicione um por um.' : ''}</div>`;
    } else if (visao === 'calendario') corpo.innerHTML = calendario(posts);
    else if (visao === 'lista') corpo.innerHTML = lista(posts);
    else if (visao === 'feed') corpo.innerHTML = previaFeed(posts);
    else corpo.innerHTML = stories(posts);

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
        <label class="opcoes-check"><label><input type="checkbox" checked data-pedir> Pedir aprovação dos conteúdos “Planejados”</label></label>
        <p class="muted" style="font-size:13px">Com essa opção, os conteúdos ficam como “Para aprovar” e o cliente aprova ou pede ajuste em cada um.</p>
        <div class="rodape-modal"><button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>Liberar para o cliente</button></div>`);
      m.el.querySelector('[data-ok]').onclick = async () => {
        const pedirAprovacao = m.el.querySelector('[data-pedir]').checked;
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
          atualizar(await api(`cronograma?cliente=${id}&mes=${mes}`, { metodo: 'POST', corpo: { acao: 'esqueleto' } }));
          await ctx.ideias(true);
          aviso(`${doc.posts.length - antes} conteúdos criados. Revise e ajuste o que precisar.`);
        } catch (err) { falhou(err); }
      };
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
            <button class="bloco-feed" data-post="${p.id}" style="--cor:${corDoPilar(pilares, p.pilarId)}">
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
