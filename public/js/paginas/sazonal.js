// Calendário sazonal: as próximas datas do ano com a ação de marketing de cada uma,
// para o cliente conferir e aprovar (ou pedir alteração).
import { api, esc, aviso, falhou, abrirCamada, confirmar, hojeISO, dataObj, icones } from '../ui.js';
import { nomeDoMes } from '../regras.js';
import { rotaPlanejamento, botoesAprovacao, faixaAprovarTodos, conversa, ultimoPedido, ligarAprovacao, etiquetaStatus } from '../componentes/planejamento.js';

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher).
function pascoa(ano) {
  const a = ano % 19; const b = Math.floor(ano / 100); const c = ano % 100;
  const d = Math.floor(b / 4); const e = b % 4; const f = Math.floor((b + 8) / 25); const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30; const i = Math.floor(c / 4); const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7; const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}
// N-ésimo dia da semana do mês (ex.: 2º domingo de maio).
function enesimo(ano, mes, diaSemana, n) {
  const d = new Date(ano, mes - 1, 1);
  d.setDate(1 + ((diaSemana - d.getDay() + 7) % 7) + (n - 1) * 7);
  return d;
}
const somarDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// Datas comemorativas e campanhas dos próximos 12 meses (comércio e saúde).
export function datasSugeridas(hoje = hojeISO()) {
  const ano = Number(hoje.slice(0, 4));
  const fim = iso(new Date(ano + 1, Number(hoje.slice(5, 7)) - 1, Number(hoje.slice(8, 10))));
  const lista = [];
  for (const a of [ano, ano + 1]) {
    const fixa = (mmdd, titulo) => lista.push({ data: `${a}-${mmdd}`, titulo });
    fixa('01-01', 'Ano Novo');
    fixa('01-01', 'Janeiro Branco (saúde mental)');
    fixa('02-04', 'Dia Mundial do Câncer');
    fixa('03-08', 'Dia Internacional da Mulher');
    fixa('03-15', 'Dia do Consumidor');
    fixa('04-07', 'Dia Mundial da Saúde');
    fixa('05-01', 'Dia do Trabalhador');
    fixa('05-12', 'Dia da Enfermagem');
    fixa('06-12', 'Dia dos Namorados');
    fixa('06-24', 'São João');
    fixa('07-26', 'Dia dos Avós');
    fixa('08-01', 'Agosto Dourado (amamentação)');
    fixa('08-27', 'Dia do Psicólogo');
    fixa('08-31', 'Dia do Nutricionista');
    fixa('09-01', 'Setembro Amarelo');
    fixa('09-15', 'Dia do Cliente');
    fixa('10-01', 'Outubro Rosa');
    fixa('10-12', 'Dia das Crianças');
    fixa('10-13', 'Dia do Fisioterapeuta');
    fixa('10-18', 'Dia do Médico');
    fixa('10-25', 'Dia do Dentista');
    fixa('11-01', 'Novembro Azul');
    fixa('12-25', 'Natal');
    fixa('12-31', 'Véspera de Ano Novo');
    const p = pascoa(a);
    lista.push({ data: iso(somarDias(p, -47)), titulo: 'Carnaval' });
    lista.push({ data: iso(p), titulo: 'Páscoa' });
    lista.push({ data: iso(enesimo(a, 5, 0, 2)), titulo: 'Dia das Mães' });
    lista.push({ data: iso(enesimo(a, 8, 0, 2)), titulo: 'Dia dos Pais' });
    lista.push({ data: iso(somarDias(enesimo(a, 11, 4, 4), 1)), titulo: 'Black Friday' });
  }
  return lista.filter((d) => d.data >= hoje && d.data < fim).sort((x, y) => x.data.localeCompare(y.data));
}

export async function render(el, ctx) {
  const { admin } = ctx;
  const rota = rotaPlanejamento(ctx, 'sazonal');
  const acoes = ctx.topo('Geral', 'Calendário sazonal', admin ? `
    <button class="btn claro" data-avisar>${icones.sino}Avisar o cliente</button>
    <button class="btn claro" data-sugestoes>${icones.sazonal}Sugestões de datas</button>
    <button class="btn" data-nova><span>Nova data</span><span class="mais">+</span></button>` : '');
  let lista = await api(rota);
  let anteriores = false;
  acoes.querySelector('[data-nova]')?.addEventListener('click', () => formulario());
  acoes.querySelector('[data-sugestoes]')?.addEventListener('click', sugestoes);
  acoes.querySelector('[data-avisar]')?.addEventListener('click', async () => {
    if (!(await confirmar('O cliente recebe no celular: “Tem calendário sazonal para você aprovar!”. Use quando as ações estiverem escritas.', { botao: 'Avisar agora' }))) return;
    try { lista = await api(rota, { metodo: 'POST', corpo: { acao: 'avisar-cliente' } }); aviso('Aviso enviado para o celular do cliente (se ele ativou as notificações).'); } catch (err) { falhou(err); }
  });

  function desenhar() {
    const hoje = hojeISO();
    const passadas = lista.filter((s) => s.data < hoje);
    const visiveis = anteriores ? lista : lista.filter((s) => s.data >= hoje);
    const porMes = {};
    visiveis.forEach((s) => { (porMes[s.data.slice(0, 7)] ||= []).push(s); });
    el.innerHTML = `
      <section class="saudacao"><h1>Calendário sazonal</h1><p>${admin
        ? 'As próximas datas importantes para o cliente, com a ação de marketing de cada uma. O cliente confere e aprova (ou pede alteração) por aqui.'
        : 'As datas importantes dos próximos meses e o que planejamos para cada uma. Confira e aprove, ou peça alteração.'}</p></section>
      ${faixaAprovarTodos(lista.filter((s) => s.data >= hoje), admin, 'datas')}
      ${passadas.length ? `<div style="margin-top:14px"><button class="btn fantasma peq" data-anteriores>${anteriores ? 'Esconder datas que já passaram' : `Ver ${passadas.length} ${passadas.length === 1 ? 'data que já passou' : 'datas que já passaram'}`}</button></div>` : ''}
      <div style="margin-top:12px">
        ${Object.keys(porMes).length ? Object.entries(porMes).map(([mes, itens]) => `
          <div class="secao-titulo"><h2>${esc(nomeDoMes(mes))}</h2><span class="etq">${itens.length}</span></div>
          <div style="display:grid;gap:12px">${itens.map((s) => cartao(s, hoje)).join('')}</div>`).join('')
          : `<div class="vazio"><strong>Nenhuma data no calendário</strong>${admin ? 'Use “Sugestões de datas” para escolher as datas do ano, ou “Nova data”.' : 'Quando a equipe montar o calendário sazonal, as datas aparecem aqui para você aprovar.'}</div>`}
      </div>`;

    ligarAprovacao(el, { ctx, tipo: 'sazonal', itens: () => lista.filter((s) => s.data >= hojeISO()), nome: 'datas', aoMudar: (l) => { lista = l; desenhar(); } });
    el.querySelector('[data-anteriores]')?.addEventListener('click', () => { anteriores = !anteriores; desenhar(); });
    el.querySelectorAll('[data-editar]').forEach((b) => { b.onclick = () => formulario(lista.find((s) => s.id === b.dataset.editar)); });
    el.querySelectorAll('[data-excluir]').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmar('Esta data sai do calendário do cliente.', { botao: 'Excluir', perigo: true }))) return;
        try { lista = await api(rota, { metodo: 'POST', corpo: { acao: 'excluir', id: b.dataset.excluir } }); desenhar(); } catch (err) { falhou(err); }
      };
    });
  }

  function cartao(s, hoje) {
    const d = dataObj(s.data);
    const passou = s.data < hoje;
    return `
      <article class="cartao cartao-sazonal${passou ? ' passou' : ''}">
        <span class="data-sazonal"><b>${d.getDate()}</b><small>${DIAS[d.getDay()]}</small></span>
        <div class="corpo-sazonal">
          <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">
            <h3 class="serif" style="font-size:21px;flex:1;min-width:180px">${esc(s.titulo)}</h3>
            ${etiquetaStatus(s.status)}
          </div>
          ${s.acao ? `<p class="texto-moodboard"><span class="mono" style="font-size:10px;display:block;margin-bottom:4px">Ação de marketing</span>${esc(s.acao)}</p>` : admin ? '<p class="muted" style="font-size:13.5px">Sem ação definida ainda. Clique no lápis para escrever a ação.</p>' : ''}
          ${admin && s.notaInterna ? `<p class="muted" style="font-size:12.5px">Nota interna: ${esc(s.notaInterna)}</p>` : ''}
          ${ultimoPedido(s)}
          ${passou && !admin ? '' : `<div class="botoes-aprovacao">${botoesAprovacao(s, admin)}
            ${admin ? `<span style="margin-left:auto;display:flex;gap:6px"><button class="btn-icone" data-editar="${esc(s.id)}" title="Editar">${icones.editar}</button><button class="btn-icone" data-excluir="${esc(s.id)}" title="Excluir">${icones.lixo}</button></span>` : ''}</div>`}
          ${conversa(s)}
        </div>
      </article>`;
  }

  function formulario(item) {
    const m = abrirCamada(`
      <h2>${item ? 'Editar data' : 'Nova data'}</h2>
      <div class="grade-campos">
        <label class="campo"><span>Data</span><input class="entrada" type="date" name="data" value="${esc(item?.data || '')}"></label>
        <label class="campo"><span>Nome da data</span><input class="entrada" name="titulo" placeholder="Ex.: Dia das Mães" value="${esc(item?.titulo || '')}"></label>
        <label class="campo largo"><span>Ação de marketing (o cliente vê)</span><textarea class="entrada" name="acao" rows="4" placeholder="Ex.: reels com depoimento de mães pacientes + stories com caixinha de perguntas">${esc(item?.acao || '')}</textarea></label>
        <label class="campo largo"><span>Nota interna (só a equipe vê)</span><input class="entrada" name="notaInterna" value="${esc(item?.notaInterna || '')}"></label>
      </div>
      ${item && item.status !== 'aprovacao' ? '<p class="muted" style="font-size:12.5px">Se mudar a data ou a ação, ela volta para a aprovação do cliente.</p>' : ''}
      <div class="rodape-modal"><button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>Salvar</button></div>`);
    m.el.querySelector('[data-ok]').onclick = async () => {
      const campo = (n) => m.el.querySelector(`[name=${n}]`).value;
      try {
        lista = await api(rota, { metodo: 'POST', corpo: { acao: 'salvar', item: { ...(item ? { id: item.id } : {}), data: campo('data'), titulo: campo('titulo'), acao: campo('acao'), notaInterna: campo('notaInterna') } } });
        m.fechar();
        aviso('Data salva.');
        desenhar();
      } catch (err) { falhou(err); }
    };
  }

  // Escolher várias datas do ano de uma vez; a ação de cada uma é escrita depois.
  function sugestoes() {
    const jaTem = new Set(lista.map((s) => `${s.data}|${s.titulo}`));
    const datas = datasSugeridas().filter((d) => !jaTem.has(`${d.data}|${d.titulo}`));
    const m = abrirCamada(`
      <h2>Sugestões de datas</h2>
      <p class="muted">Datas comerciais e da saúde dos próximos 12 meses. Marque as que fazem sentido para este cliente; depois escreva a ação de marketing de cada uma.</p>
      <div class="lista-sugestoes">${datas.map((d, i) => {
        const o = dataObj(d.data);
        return `<label><input type="checkbox" data-i="${i}"> <span class="mono">${String(o.getDate()).padStart(2, '0')}/${String(o.getMonth() + 1).padStart(2, '0')}/${String(o.getFullYear()).slice(2)}</span> ${esc(d.titulo)}</label>`;
      }).join('') || '<p class="muted">Todas as sugestões já estão no calendário.</p>'}</div>
      <div class="rodape-modal"><button class="btn claro" data-fechar>Cancelar</button><button class="btn acc" data-ok>Adicionar marcadas</button></div>`, { largo: true });
    m.el.querySelector('[data-ok]').onclick = async () => {
      const itens = [...m.el.querySelectorAll('[data-i]:checked')].map((c) => datas[Number(c.dataset.i)]);
      if (!itens.length) return aviso('Marque pelo menos uma data.', { erro: true });
      try {
        lista = await api(rota, { metodo: 'POST', corpo: { acao: 'adicionar-varios', itens } });
        m.fechar();
        aviso(`${itens.length} ${itens.length === 1 ? 'data adicionada' : 'datas adicionadas'}. Escreva a ação de cada uma no lápis e depois use “Avisar o cliente”.`);
        desenhar();
      } catch (err) { falhou(err); }
    };
  }

  desenhar();
}
