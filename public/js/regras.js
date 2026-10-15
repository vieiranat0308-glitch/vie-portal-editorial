// Regras compartilhadas entre o navegador e as funções da API.

export const FORMATOS = {
  reel: { nome: 'Reels', curto: 'Reel', cor: 'var(--f-reel)' },
  carrossel: { nome: 'Carrosséis', curto: 'Carrossel', cor: 'var(--f-carrossel)' },
  estatico: { nome: 'Estáticos', curto: 'Estático', cor: 'var(--f-estatico)' },
  story: { nome: 'Stories', curto: 'Story', cor: 'var(--f-story)' },
};

// Ordem do fluxo de um conteúdo, do planejamento à publicação.
export const STATUS = {
  pauta: { nome: 'Planejado', cor: 'var(--s-pauta)' },
  aprovacao: { nome: 'Para aprovar', cor: 'var(--s-aprovacao)' },
  ajuste: { nome: 'Ajuste pedido', cor: 'var(--s-ajuste)' },
  aprovado: { nome: 'Aprovado', cor: 'var(--s-aprovado)' },
  gravado: { nome: 'Gravado', cor: 'var(--s-gravado)' },
  postado: { nome: 'Postado', cor: 'var(--s-postado)' },
};

// O que o próprio cliente pode marcar em um conteúdo.
export const STATUS_DO_CLIENTE = ['aprovado', 'ajuste', 'gravado', 'postado'];

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Cores de apoio para diferenciar os pilares (na ordem em que aparecem).
export const CORES_PILARES = ['#7f2a2e', '#b0813a', '#5f6f52', '#8a6a9a', '#3f5f7a', '#a65a3a'];

export function corDoPilar(pilares, pilarId) {
  const i = (pilares || []).findIndex((p) => p.id === pilarId);
  return i < 0 ? 'var(--muted)' : CORES_PILARES[i % CORES_PILARES.length];
}

export function nomeDoMes(mes, { curto = false } = {}) {
  const [a, m] = mes.split('-').map(Number);
  const nome = MESES[m - 1];
  return `${curto ? nome.slice(0, 3) : nome} ${a}`;
}

function idCurto() {
  return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

// Monta os conteúdos do mês a partir da frequência da linha editorial,
// puxando do banco as ideias ainda não usadas do mesmo pilar e formato.
export function gerarEsqueleto({ mes, frequencia = [], ideias = [], datasOcupadas = [] }) {
  const [ano, m] = mes.split('-').map(Number);
  const totalDias = new Date(ano, m, 0).getDate();
  const usadas = new Set(ideias.filter((i) => i.usadaEm).map((i) => i.id));
  const ocupadas = new Set(datasOcupadas);
  const contagem = frequencia.map(() => 0);
  const posts = [];

  for (let dia = 1; dia <= totalDias; dia++) {
    const semana = new Date(ano, m - 1, dia).getDay();
    const data = `${mes}-${String(dia).padStart(2, '0')}`;
    frequencia.forEach((slot, s) => {
      if (Number(slot.dia) !== semana) return;
      const pilares = slot.pilares?.length ? slot.pilares : [null];
      const pilarId = pilares[contagem[s]++ % pilares.length];
      if (ocupadas.has(`${data}|${slot.formato}`)) return;
      const ideia = ideias.find((i) => !usadas.has(i.id) && i.pilarId === pilarId && i.formato === slot.formato);
      if (ideia) usadas.add(ideia.id);
      posts.push({
        id: idCurto(),
        data,
        horario: slot.horario || '',
        formato: slot.formato || 'reel',
        pilarId,
        titulo: ideia?.titulo || '',
        gancho: ideia?.gancho || '',
        roteiro: ideia?.roteiro || '',
        legenda: '',
        referencias: ideia?.referencias || [],
        ideiaId: ideia?.id || null,
        status: 'pauta',
      });
    });
  }
  return posts;
}
