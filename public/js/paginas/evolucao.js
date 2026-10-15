// Evolução do perfil: perfil inicial do cliente e o acompanhamento mês a mês.
import { api, esc, aviso, falhou, abrirCamada, confirmar, hojeISO, dataObj, num, iniciais, icones } from '../ui.js';
import { MESES } from '../regras.js';
import { linhaSuave } from '../componentes/graficos.js';

const dataExtenso = (iso) => {
  const d = dataObj(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
};
const mesAno = (iso) => {
  const d = dataObj(iso);
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
};
const diferenca = (a, b) => (a != null && b != null ? a - b : null);
const sinal = (n, casas = 0) => (n == null ? '' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n), casas)}`);

export async function render(el, ctx) {
  const { cliente, admin } = ctx;
  const id = encodeURIComponent(cliente.id);
  const rota = `evolucao?cliente=${id}`;
  const urlImagem = (arquivoId) => `/api/evolucao?cliente=${id}&arquivo=${encodeURIComponent(arquivoId)}`;
  let registros = await api(rota);

  const acoes = ctx.topo('Acompanhamento', 'Evolução do perfil', admin ? `<button class="btn" data-novo><span>${registros.length ? 'Registrar mês' : 'Registrar perfil inicial'}</span><span class="mais">+</span></button>` : '');
  acoes.querySelector('[data-novo]')?.addEventListener('click', () => formulario());

  function desenhar() {
    acoes.querySelector('[data-novo] span') && (acoes.querySelector('[data-novo] span').textContent = registros.length ? 'Registrar mês' : 'Registrar perfil inicial');
    if (!registros.length) {
      el.innerHTML = `
        <section class="saudacao"><h1>Evolução do perfil</h1></section>
        <div class="vazio" style="margin-top:22px"><strong>Ainda sem registros</strong>${admin
          ? 'Comece pelo perfil inicial: suba o print do Instagram do cliente, confira os números e escreva o diagnóstico. Depois, registre o perfil a cada mês para acompanhar a evolução.'
          : 'A equipe Vie registra aqui como o seu perfil estava no início da consultoria e acompanha a evolução mês a mês.'}
          ${admin ? '<div style="margin-top:16px"><button class="btn acc" data-novo-vazio>Registrar perfil inicial</button></div>' : ''}</div>`;
      el.querySelector('[data-novo-vazio]')?.addEventListener('click', () => formulario());
      return;
    }

    const inicial = registros.find((r) => r.inicial) || registros[0];
    const atual = registros.at(-1);
    const cresc = diferenca(atual.seguidores, inicial.seguidores);
    const pct = cresc != null && inicial.seguidores ? (cresc / inicial.seguidores) * 100 : null;
    const postsNovos = diferenca(atual.posts, inicial.posts);
    const meses = Math.max(0, (dataObj(atual.data).getFullYear() - dataObj(inicial.data).getFullYear()) * 12 + dataObj(atual.data).getMonth() - dataObj(inicial.data).getMonth());
    const comSeguidores = registros.filter((r) => r.seguidores != null);

    el.innerHTML = `
      <section class="saudacao">
        <h1>Evolução do perfil</h1>
        <p>Acompanhamento de @${esc(cliente.instagram || cliente.nome)} desde ${esc(dataExtenso(inicial.data))}. ${registros.length} ${registros.length === 1 ? 'registro' : 'registros'}.</p>
      </section>

      <div class="resumo-vie">
        <div class="cartao"><div class="numero-grande">${num(atual.seguidores)}</div><div class="rot">Seguidores hoje</div></div>
        <div class="cartao"><div class="numero-grande" style="color:${cresc > 0 ? 'var(--s-aprovado)' : cresc < 0 ? 'var(--s-ajuste)' : 'inherit'}">${cresc == null ? '—' : sinal(cresc)}</div><div class="rot">Seguidores desde o início${pct != null && atual !== inicial ? ` · ${sinal(pct, 1)}%` : ''}</div></div>
        <div class="cartao"><div class="numero-grande">${postsNovos == null ? '—' : sinal(postsNovos)}</div><div class="rot">Posts publicados desde o início</div></div>
        <div class="cartao"><div class="numero-grande">${meses}</div><div class="rot">${meses === 1 ? 'Mês' : 'Meses'} de acompanhamento</div></div>
      </div>

      ${atual !== inicial ? `
        <div class="secao-titulo"><h2>Antes e agora</h2></div>
        <div class="duas antes-agora">
          ${cartaoPerfil(inicial, 'Perfil inicial', null)}
          ${cartaoPerfil(atual, 'Perfil atual', inicial)}
        </div>` : `
        <div class="secao-titulo"><h2>Perfil inicial</h2></div>
        <div class="duas antes-agora">${cartaoPerfil(inicial, 'Ponto de partida', null)}
          <div class="vazio" style="align-self:start">${admin ? 'No próximo acompanhamento, use “Registrar mês” para comparar com o ponto de partida.' : 'A comparação aparece aqui a partir do próximo acompanhamento.'}</div>
        </div>`}

      ${comSeguidores.length > 1 ? `
        <div class="cartao" style="margin-top:18px">
          <div class="cab"><h3>Seguidores</h3><span class="mono">A cada registro</span></div>
          <div style="color:var(--acc)">${linhaSuave(comSeguidores.map((r) => r.seguidores), { cor: 'currentColor', altura: 120, area: true })}</div>
          <div style="display:flex;justify-content:space-between;font:400 11px var(--mono);color:var(--muted);margin-top:6px">${comSeguidores.map((r) => `<span>${esc(mesAno(r.data).slice(0, 3))}</span>`).join('')}</div>
        </div>` : ''}

      <div class="secao-titulo"><h2>Linha do tempo</h2></div>
      <div style="display:grid;gap:12px">${registros.slice().reverse().map((r) => cartaoRegistro(r)).join('')}</div>`;

    el.querySelectorAll('[data-ver-print]').forEach((img) => {
      img.onclick = () => abrirCamada(`<img src="${img.dataset.verPrint}" alt="Print do perfil" style="width:100%;border-radius:12px"><div class="rodape-modal"><button class="btn claro" data-fechar>Fechar</button></div>`, { largo: true });
    });
    el.querySelectorAll('[data-editar]').forEach((b) => { b.onclick = () => formulario(registros.find((r) => r.id === b.dataset.editar)); });
    el.querySelectorAll('[data-excluir]').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmar('Este registro e os prints dele serão apagados.', { botao: 'Excluir', perigo: true }))) return;
        try { registros = await api(rota, { metodo: 'POST', corpo: { acao: 'excluir', id: b.dataset.excluir } }); desenhar(); } catch (err) { falhou(err); }
      };
    });
  }

  function numerosPerfil(r, base) {
    const item = (valor, rotulo, campo) => {
      const d = base ? diferenca(r[campo], base[campo]) : null;
      return `<div><b>${num(valor)}</b><span>${rotulo}</span>${d ? `<em class="${d > 0 ? 'sobe' : 'desce'}">${sinal(d)}</em>` : ''}</div>`;
    };
    return `<div class="numeros-ig">${item(r.posts, 'posts', 'posts')}${item(r.seguidores, 'seguidores', 'seguidores')}${item(r.seguindo, 'seguindo', 'seguindo')}</div>`;
  }

  function cartaoPerfil(r, titulo, base) {
    const bioMudou = base && r.bio && base.bio && r.bio.trim() !== base.bio.trim();
    return `
      <div class="cartao perfil-ig">
        <div class="cab"><h3>${titulo}</h3><span class="mono">${esc(dataExtenso(r.data))}</span></div>
        ${r.prints?.length ? `<img class="print-perfil" src="${urlImagem(r.prints[0])}" data-ver-print="${urlImagem(r.prints[0])}" alt="Print do perfil em ${esc(dataExtenso(r.data))}" loading="lazy">` : ''}
        <div class="cab-ig-mini"><span class="avatar">${esc(iniciais(cliente.nome))}</span><div><b>${esc(cliente.instagram || cliente.nome)}</b>${numerosPerfil(r, base)}</div></div>
        ${r.bio ? `<div><span class="mono muted" style="font-size:9.5px">Bio${bioMudou ? ' · <span style="color:var(--s-aprovado)">nova</span>' : ''}</span><p class="bio-ig">${esc(r.bio)}</p></div>` : ''}
        ${r.link ? `<p style="font-size:13px;color:var(--f-carrossel)">${icones.link.replace('<svg', '<svg style="width:13px;height:13px;vertical-align:-2px"')} ${esc(r.link)}</p>` : ''}
        ${r.destaques?.length ? `<div><span class="mono muted" style="font-size:9.5px">Destaques</span><div class="destaques-ig">${r.destaques.map((d) => `<span>${esc(d)}</span>`).join('')}</div></div>` : ''}
      </div>`;
  }

  function cartaoRegistro(r) {
    const i = registros.indexOf(r);
    const anterior = i > 0 ? registros[i - 1] : null;
    const dSeg = anterior ? diferenca(r.seguidores, anterior.seguidores) : null;
    const bioMudou = anterior && r.bio && anterior.bio && r.bio.trim() !== anterior.bio.trim();
    return `
      <article class="cartao registro-evolucao">
        <div class="cab" style="flex-wrap:wrap">
          <h3 class="serif" style="font-size:22px">${r.inicial ? 'Perfil inicial' : esc(mesAno(r.data))}</h3>
          <span class="muted" style="font-size:13px">${esc(dataExtenso(r.data))}</span>
          ${dSeg ? `<span class="etq cheia" style="--cor:${dSeg > 0 ? 'var(--s-aprovado)' : 'var(--s-ajuste)'}">${sinal(dSeg)} seguidores no período</span>` : ''}
          ${bioMudou ? '<span class="etq">Bio atualizada</span>' : ''}
          ${admin ? `<span style="margin-left:auto;display:flex;gap:6px"><button class="btn-icone" data-editar="${r.id}" title="Editar">${icones.editar}</button><button class="btn-icone" data-excluir="${r.id}" title="Excluir">${icones.lixo}</button></span>` : ''}
        </div>
        <div class="registro-corpo">
          ${r.prints?.length ? `<div class="prints-mini">${r.prints.map((p) => `<img src="${urlImagem(p)}" data-ver-print="${urlImagem(p)}" alt="Print" loading="lazy">`).join('')}</div>` : ''}
          <div style="display:grid;gap:10px;min-width:0">
            ${numerosPerfil(r, anterior)}
            ${r.analise ? `<div class="analise-vie"><span class="mono">Análise da Vie</span><p>${esc(r.analise)}</p></div>` : ''}
          </div>
        </div>
      </article>`;
  }

  function formulario(registro) {
    const ultimo = registros.at(-1);
    const r = registro || {
      data: hojeISO(),
      inicial: !registros.length,
      bio: ultimo?.bio || '',
      link: ultimo?.link || '',
      destaques: ultimo?.destaques || [],
      prints: [],
    };
    let prints = [...(r.prints || [])];
    const m = abrirCamada(`
      <h2>${registro ? 'Editar registro' : r.inicial ? 'Perfil inicial' : 'Registro do mês'}</h2>
      <div class="grade-campos" data-form>
        <div class="campo largo">
          <span>Print do perfil no Instagram</span>
          <div class="prints-form" data-prints></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <label class="btn claro peq" style="cursor:pointer">${icones.baixar}Adicionar print<input type="file" accept="image/png,image/jpeg,image/webp" hidden data-arquivo></label>
            <button class="btn claro peq" type="button" data-ler-print ${prints.length ? '' : 'disabled'}>Preencher pelo print</button>
            <span class="muted" style="font-size:12.5px">Lê os números, a bio e os destaques do print. Confira antes de salvar.</span>
          </div>
        </div>
        <label class="campo"><span>Data do registro</span><input class="entrada" type="date" name="data" value="${esc(r.data)}"></label>
        <label class="campo" style="align-self:end"><span><input type="checkbox" name="inicial" ${r.inicial ? 'checked' : ''}> Este é o perfil inicial (ponto de partida)</span></label>
        <label class="campo"><span>Posts</span><input class="entrada" name="posts" inputmode="numeric" value="${esc(r.posts ?? '')}"></label>
        <label class="campo"><span>Seguidores</span><input class="entrada" name="seguidores" inputmode="numeric" value="${esc(r.seguidores ?? '')}"></label>
        <label class="campo"><span>Seguindo</span><input class="entrada" name="seguindo" inputmode="numeric" value="${esc(r.seguindo ?? '')}"></label>
        <label class="campo"><span>Link da bio</span><input class="entrada" name="link" value="${esc(r.link || '')}"></label>
        <label class="campo largo"><span>Bio</span><textarea class="entrada" name="bio" rows="4">${esc(r.bio || '')}</textarea></label>
        <label class="campo largo"><span>Destaques (um por linha)</span><textarea class="entrada" name="destaques" rows="3">${esc((r.destaques || []).join('\n'))}</textarea></label>
        <label class="campo largo"><span>Análise da Vie (o cliente vê)</span><textarea class="entrada" name="analise" rows="5" placeholder="O que mudou no perfil, o que funcionou, próximos ajustes…">${esc(r.analise || '')}</textarea></label>
      </div>
      <div class="rodape-modal"><button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>Salvar registro</button></div>`, { largo: true });

    const campo = (n) => m.el.querySelector(`[name=${n}]`);
    const desenharPrints = () => {
      m.el.querySelector('[data-prints]').innerHTML = prints.length
        ? prints.map((p) => `<span class="print-form"><img src="${urlImagem(p)}" alt="Print"><button type="button" class="btn-icone" data-tirar="${p}" title="Remover">${icones.fechar}</button></span>`).join('')
        : '<p class="muted" style="font-size:13px">Nenhum print ainda.</p>';
      m.el.querySelectorAll('[data-tirar]').forEach((b) => { b.onclick = () => { prints = prints.filter((p) => p !== b.dataset.tirar); desenharPrints(); }; });
      m.el.querySelector('[data-ler-print]').disabled = !prints.length;
    };
    desenharPrints();

    m.el.querySelector('[data-arquivo]').onchange = async (ev) => {
      const f = ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      if (f.size > 4 * 1024 * 1024) return aviso('Imagem acima de 4 MB.', { erro: true });
      try {
        const { arquivoId } = await api(`${rota}&tipo=${encodeURIComponent(f.type)}&nome=${encodeURIComponent(f.name)}`, { metodo: 'POST', arquivo: f });
        prints.push(arquivoId);
        desenharPrints();
      } catch (err) { falhou(err); }
    };

    m.el.querySelector('[data-ler-print]').onclick = async (ev) => {
      ev.target.disabled = true;
      ev.target.textContent = 'Lendo o print…';
      try {
        const lido = await api(rota, { metodo: 'POST', corpo: { acao: 'ler-print', arquivoId: prints.at(-1) } });
        if (lido.posts != null) campo('posts').value = lido.posts;
        if (lido.seguidores != null) campo('seguidores').value = lido.seguidores;
        if (lido.seguindo != null) campo('seguindo').value = lido.seguindo;
        if (lido.bio) campo('bio').value = lido.bio;
        if (lido.link) campo('link').value = lido.link;
        if (lido.destaques?.length) campo('destaques').value = lido.destaques.join('\n');
        aviso('Dados preenchidos pelo print. Confira antes de salvar.');
      } catch (err) { falhou(err); }
      ev.target.textContent = 'Preencher pelo print';
      ev.target.disabled = !prints.length;
    };

    m.el.querySelector('[data-ok]').onclick = async () => {
      const corpo = {
        ...(registro ? { id: registro.id } : {}),
        data: campo('data').value,
        inicial: campo('inicial').checked,
        posts: campo('posts').value,
        seguidores: campo('seguidores').value,
        seguindo: campo('seguindo').value,
        link: campo('link').value,
        bio: campo('bio').value,
        destaques: campo('destaques').value.split('\n'),
        analise: campo('analise').value,
        prints,
      };
      try {
        registros = await api(rota, { metodo: 'POST', corpo: { acao: 'salvar', registro: corpo } });
        m.fechar();
        aviso('Registro salvo.');
        desenhar();
      } catch (err) { falhou(err); }
    };
  }

  desenhar();
}
