// Pequenos gráficos em SVG (sem bibliotecas) e o mini calendário do painel.
import { esc, hojeISO, icones } from '../ui.js';
import { FORMATOS, nomeDoMes } from '../regras.js';

// Linha suave com ponto destacado no último valor.
export function linhaSuave(valores, { altura = 90, cor = 'currentColor', area = false } = {}) {
  const v = valores.map((x) => (x == null ? null : Number(x)));
  const validos = v.filter((x) => x != null);
  if (validos.length < 2) return '';
  const largura = 300;
  const min = Math.min(...validos);
  const max = Math.max(...validos);
  const pts = v.map((x, i) => (x == null ? null : [
    (i / (v.length - 1)) * largura,
    altura - 8 - ((x - min) / (max - min || 1)) * (altura - 20),
  ])).filter(Boolean);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const [ux, uy] = pts[pts.length - 1];
  return `<svg class="grafico-linha" viewBox="0 0 ${largura} ${altura}" preserveAspectRatio="none" style="height:${altura}px">
    ${area ? `<path d="${d} L${ux},${altura} L${pts[0][0]},${altura} Z" fill="${cor}" opacity=".08"/>` : ''}
    <path d="${d}" fill="none" stroke="${cor}" stroke-width="2" vector-effect="non-scaling-stroke"/>
    <line x1="${ux}" x2="${ux}" y1="${uy}" y2="${altura}" stroke="${cor}" stroke-dasharray="3 3" opacity=".5" vector-effect="non-scaling-stroke"/>
    <circle cx="${ux}" cy="${uy}" r="4" fill="#e2766c" stroke="${cor}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

// Mini calendário com pontinhos por formato. `aoEscolher(dataISO)` e `aoMudarMes(delta)`.
export function miniCalendario(el, { mes, posts, selecionado, aoEscolher, aoMudarMes }) {
  const [ano, m] = mes.split('-').map(Number);
  const primeiro = new Date(ano, m - 1, 1);
  const total = new Date(ano, m, 0).getDate();
  const inicio = (primeiro.getDay() + 6) % 7; // semana começa na segunda
  const hoje = hojeISO();
  const porDia = {};
  posts.forEach((p) => { (porDia[p.data] ||= []).push(p); });

  let celulas = '';
  for (let i = 0; i < inicio; i++) celulas += '<span></span>';
  for (let d = 1; d <= total; d++) {
    const iso = `${mes}-${String(d).padStart(2, '0')}`;
    const semana = new Date(ano, m - 1, d).getDay();
    const pts = (porDia[iso] || []).slice(0, 3).map((p) => `<i style="--cor:${FORMATOS[p.formato]?.cor}"></i>`).join('');
    celulas += `<button class="dia${iso === hoje ? ' hoje' : ''}${iso === selecionado ? ' sel' : ''}${semana === 0 || semana === 6 ? ' fds' : ''}" data-dia="${iso}" aria-label="${d}">${d}<span class="pts">${pts}</span></button>`;
  }
  el.innerHTML = `
    <div class="mini-cal">
      <div class="cab-cal">
        <button class="seta" data-mes="-1" aria-label="Mês anterior">${icones.esquerda}</button>
        <span class="mes-pilula">${esc(nomeDoMes(mes))}</span>
        <button class="seta" data-mes="1" aria-label="Próximo mês">${icones.direita}</button>
      </div>
      <div class="grade">
        ${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((s) => `<span class="sem">${s}</span>`).join('')}
        ${celulas}
      </div>
    </div>`;
  el.querySelectorAll('[data-dia]').forEach((b) => { b.onclick = () => aoEscolher(b.dataset.dia); });
  el.querySelectorAll('[data-mes]').forEach((b) => { b.onclick = () => aoMudarMes(Number(b.dataset.mes)); });
}
