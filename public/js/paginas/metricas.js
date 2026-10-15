// Métricas mensais do Instagram, com evolução ao longo do acompanhamento.
import { api, esc, aviso, falhou, abrirCamada, confirmar, mesAtual, somarMes, num, compacto, icones } from '../ui.js';
import { nomeDoMes } from '../regras.js';

const CAMPOS = [
  ['seguidores', 'Seguidores'],
  ['novosSeguidores', 'Novos seguidores'],
  ['visualizacoes', 'Visualizações'],
  ['naoSeguidores', 'Visualizações de não seguidores (%)'],
  ['alcance', 'Contas alcançadas'],
  ['interacoes', 'Interações'],
  ['visitasPerfil', 'Visitas ao perfil'],
  ['toquesLink', 'Toques no link da bio'],
  ['pacientes', 'Novos pacientes vindos do Instagram'],
  ['reels', 'Reels publicados'],
  ['posts', 'Posts publicados'],
  ['stories', 'Stories publicados'],
];
const PRINCIPAIS = ['seguidores', 'visualizacoes', 'naoSeguidores', 'interacoes', 'visitasPerfil', 'toquesLink', 'pacientes'];
const rotulo = (k) => CAMPOS.find(([c]) => c === k)?.[1] || k;
const formatar = (k, v) => (v == null ? '—' : k === 'naoSeguidores' ? `${num(v, 1)}%` : num(v));

export async function render(el, ctx) {
  const { cliente, admin } = ctx;
  const id = encodeURIComponent(cliente.id);
  const acoes = ctx.topo('Acompanhamento', 'Métricas', admin ? `<button class="btn" data-novo><span>Registrar mês</span><span class="mais">+</span></button>` : '');
  let metricas = await api(`metricas?cliente=${id}`);
  let foco = 'visualizacoes';

  acoes.querySelector('[data-novo]')?.addEventListener('click', () => {
    const meses = Object.keys(metricas).sort();
    editar(meses.length ? somarMes(meses.at(-1), 1) : somarMes(mesAtual(), -1));
  });

  function desenhar() {
    const meses = Object.keys(metricas).sort();
    if (!meses.length) {
      el.innerHTML = `<div class="vazio"><strong>Sem métricas ainda</strong>${admin ? 'Registre o primeiro mês (a base de partida) para começar a acompanhar a evolução.' : 'A equipe Vie registra aqui os números do seu perfil a cada acompanhamento mensal.'}</div>`;
      return;
    }
    const ultimo = meses.at(-1);
    const anterior = meses.at(-2);
    const m = metricas[ultimo];
    const a = anterior ? metricas[anterior] : null;

    el.innerHTML = `
      <section class="saudacao"><h1>Métricas</h1><p>Números de ${esc(nomeDoMes(ultimo))}${anterior ? `, comparados com ${esc(nomeDoMes(anterior))}` : ''}. ${meses.length > 1 ? 'Clique em um indicador para ver a evolução.' : 'A comparação aparece a partir do segundo mês registrado.'}</p></section>
      ${m.observacoes ? `<div class="objetivo" style="margin-top:20px"><div><span class="mono">Leitura da Vie</span><p style="margin-top:4px;white-space:pre-wrap">${esc(m.observacoes)}</p></div></div>` : ''}
      <div class="grade-metricas" style="margin-top:20px">
        ${PRINCIPAIS.filter((k) => m[k] != null || (a && a[k] != null)).map((k) => {
          const d = a && m[k] != null && a[k] != null ? m[k] - a[k] : null;
          const pct = d != null && a[k] ? (d / a[k]) * 100 : null;
          return `<button class="cartao metrica" data-foco="${k}" style="text-align:left;cursor:pointer;${foco === k ? 'outline:2px solid var(--acc);' : ''}">
            <span class="rot">${esc(rotulo(k).replace(' (%)', ''))}</span>
            <div class="valor">${formatar(k, m[k])}</div>
            ${d != null ? `<span class="delta ${d >= 0 ? 'sobe' : 'desce'}">${d >= 0 ? '▲' : '▼'} ${k === 'naoSeguidores' ? `${num(Math.abs(d), 1)} p.p.` : `${pct != null ? `${num(Math.abs(pct), 1)}%` : num(Math.abs(d))}`}</span>` : '<span class="muted" style="font-size:12px">—</span>'}
          </button>`;
        }).join('')}
      </div>

      ${meses.length > 1 ? `
        <div class="cartao" style="margin-top:18px">
          <div class="cab"><h3>${esc(rotulo(foco))}</h3><span class="mono">Evolução mês a mês</span></div>
          ${grafico(meses, foco)}
        </div>` : ''}

      <div class="secao-titulo"><h2>Histórico</h2></div>
      <div class="cartao rolagem" style="padding:6px 10px">
        <table class="tabela">
          <thead><tr><th>Indicador</th>${meses.map((k) => `<th>${esc(nomeDoMes(k, { curto: true }))}${admin ? ` <button class="btn fantasma peq" data-editar="${k}" title="Editar">${icones.editar}</button>` : ''}</th>`).join('')}</tr></thead>
          <tbody>${CAMPOS.filter(([k]) => meses.some((mm) => metricas[mm][k] != null)).map(([k, n]) => `<tr><td>${esc(n)}</td>${meses.map((mm) => `<td>${formatar(k, metricas[mm][k])}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>`;
    el.querySelectorAll('[data-foco]').forEach((b) => { b.onclick = () => { foco = b.dataset.foco; desenhar(); }; });
    el.querySelectorAll('[data-editar]').forEach((b) => { b.onclick = () => editar(b.dataset.editar); });
  }

  function grafico(meses, k) {
    const valores = meses.map((mm) => metricas[mm][k]);
    const validos = valores.filter((v) => v != null);
    if (validos.length < 2) return '<p class="muted">Ainda não há dois meses com este indicador.</p>';
    const L = 720; const A = 220; const mx = 40; const my = 24;
    const min = Math.min(...validos); const max = Math.max(...validos);
    const x = (i) => mx + (i / (meses.length - 1)) * (L - mx * 2);
    const y = (v) => A - my - ((v - min) / (max - min || 1)) * (A - my * 2 - 10);
    const pontos = valores.map((v, i) => (v == null ? null : [x(i), y(v), v, meses[i]])).filter(Boolean);
    const d = pontos.map(([px, py], i) => `${i ? 'L' : 'M'}${px},${py}`).join(' ');
    return `<svg class="grafico" viewBox="0 0 ${L} ${A}" role="img" aria-label="Evolução de ${esc(rotulo(k))}">
      <path d="${d} L${pontos.at(-1)[0]},${A - my} L${pontos[0][0]},${A - my} Z" fill="var(--acc)" opacity=".07"/>
      <path d="${d}" fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round"/>
      ${pontos.map(([px, py, v, mm]) => `<circle cx="${px}" cy="${py}" r="4.5" fill="#fff" stroke="var(--acc)" stroke-width="2"/>
        <text x="${px}" y="${py - 12}" text-anchor="middle" font-size="12" fill="var(--ink)" font-family="Outfit">${esc(k === 'naoSeguidores' ? `${num(v, 1)}%` : compacto(v))}</text>
        <text x="${px}" y="${A - 4}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="DM Mono">${esc(nomeDoMes(mm, { curto: true }))}</text>`).join('')}
    </svg>`;
  }

  function editar(mes) {
    const dados = metricas[mes] || {};
    const m = abrirCamada(`
      <h2>Métricas do mês</h2>
      <div class="grade-campos">
        <label class="campo largo"><span>Mês de referência</span><input class="entrada" type="month" name="mes" value="${esc(mes)}"></label>
        ${CAMPOS.map(([k, n]) => `<label class="campo"><span>${esc(n)}</span><input class="entrada" inputmode="decimal" name="${k}" value="${esc(dados[k] ?? '')}"></label>`).join('')}
        <label class="campo largo"><span>Leitura da Vie (o cliente vê)</span><textarea class="entrada" name="observacoes" rows="4">${esc(dados.observacoes || '')}</textarea></label>
      </div>
      <div class="rodape-modal">
        ${metricas[mes] ? '<button class="btn perigo" data-excluir style="margin-right:auto">Excluir mês</button>' : ''}
        <button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>Salvar</button>
      </div>`, { largo: true });
    m.el.querySelector('[data-ok]').onclick = async () => {
      const campos = Object.fromEntries([...m.el.querySelectorAll('[name]')].map((c) => [c.name, c.value]));
      try {
        if (campos.mes !== mes && metricas[mes]) await api(`metricas?cliente=${id}`, { metodo: 'POST', corpo: { acao: 'excluir', mes } });
        metricas = await api(`metricas?cliente=${id}`, { metodo: 'POST', corpo: { mes: campos.mes, dados: campos } });
        m.fechar();
        aviso('Métricas salvas.');
        desenhar();
      } catch (err) { falhou(err); }
    };
    m.el.querySelector('[data-excluir]')?.addEventListener('click', async () => {
      if (!(await confirmar(`Excluir as métricas de ${nomeDoMes(mes)}?`, { botao: 'Excluir', perigo: true }))) return;
      try {
        metricas = await api(`metricas?cliente=${id}`, { metodo: 'POST', corpo: { acao: 'excluir', mes } });
        m.fechar();
        desenhar();
      } catch (err) { falhou(err); }
    });
  }

  desenhar();
}
