// Notificações no celular (Web Push): ativar, desativar e testar neste aparelho.
import { api } from './ui.js';
import { jaInstalado } from './instalar.js';

const ua = () => navigator.userAgent;
const ehIos = () => /iPhone|iPad|iPod/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// Navegadores dentro de outros apps (Instagram, Facebook, WhatsApp…) não recebem notificações.
const navegadorEmbutido = () => /Instagram|FBAN|FBAV|WhatsApp|Line\/|LinkedInApp|; wv\)/i.test(ua());
const versaoIos = () => {
  const m = ua().match(/OS (\d+)_(\d+)/);
  return m ? Number(m[1]) + Number(m[2]) / 100 : null;
};
export const suportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// Motivo para não dar, sem esperar nada (o pedido de permissão precisa sair no próprio toque).
// null | 'embutido' | 'instalar' | 'ios-antigo' | 'sem-suporte'
// "Bloqueado" não entra aqui: o aparelho só diz de verdade quando a permissão é pedida.
export function impedimento() {
  if (navegadorEmbutido()) return 'embutido';
  if (ehIos() && !jaInstalado()) return 'instalar';
  if (ehIos() && versaoIos() && versaoIos() < 16.04) return 'ios-antigo';
  if (!suportado()) return 'sem-suporte';
  return null;
}

export const MOTIVOS = {
  embutido: 'O portal está aberto por dentro de outro app (WhatsApp, Instagram…). Abra o link no Safari (iPhone) ou no Chrome (Android): toque nos três pontinhos e em “Abrir no navegador”.',
  instalar: 'No iPhone, as notificações só funcionam com o portal instalado na tela de início. Instale e ative pelo ícone da Vie.',
  'ios-antigo': 'Este iPhone precisa do iOS 16.4 ou mais novo para receber notificações. Atualize em Ajustes → Geral → Atualização de Software.',
  'sem-suporte': 'Este navegador não recebe notificações. No Android, use o Chrome; no iPhone, o portal instalado na tela de início.',
  bloqueado: 'As notificações do portal foram bloqueadas neste aparelho. iPhone: Ajustes → Notificações → Vie → Permitir. Android: toque no cadeado ao lado do endereço → Permissões → Notificações → Permitir.',
};

async function registroDoServiceWorker() {
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) reg = await navigator.serviceWorker.register('/sw.js');
  // Espera o service worker ficar ativo, mas não para sempre.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, falha) => setTimeout(() => falha(new Error('O app não terminou de carregar. Feche e abra o portal de novo e tente outra vez.')), 15000)),
  ]).then(() => reg);
}

async function inscricaoAtual() {
  if (!suportado()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

// 'ativo' | 'desligado' | 'bloqueado' | um dos impedimentos
export async function situacao() {
  const motivo = impedimento();
  if (motivo) return motivo;
  if (Notification.permission === 'granted' && (await inscricaoAtual())) return 'ativo';
  return Notification.permission === 'denied' ? 'bloqueado' : 'desligado';
}

const chaveEmBytes = (base64) => {
  const b = atob((base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

// Chamar direto no clique: a primeira linha já pede a permissão, sem esperar nada antes
// (o iPhone ignora o pedido se ele não sair no próprio toque).
export function ativar() {
  const motivo = impedimento();
  if (motivo) return Promise.reject(Object.assign(new Error(MOTIVOS[motivo]), { motivo }));
  const permissao = Notification.requestPermission();
  return (async () => {
    let etapa = 'permissão';
    try {
      if ((await permissao) !== 'granted') throw Object.assign(new Error(MOTIVOS.bloqueado), { motivo: 'bloqueado' });
      etapa = 'app';
      const reg = await registroDoServiceWorker();
      etapa = 'chave';
      const { chavePublica } = await api('notificacoes');
      etapa = 'inscrição';
      let inscricao = await reg.pushManager.getSubscription();
      if (!inscricao) inscricao = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(chavePublica) });
      etapa = 'cadastro';
      await api('notificacoes', { metodo: 'POST', corpo: { acao: 'inscrever', inscricao: inscricao.toJSON() } });
    } catch (err) {
      if (err.motivo) throw err;
      // Mensagem com a etapa e o erro técnico, para dar para mandar print à Vie.
      throw Object.assign(new Error(`Não consegui ativar (etapa: ${etapa}). ${err.message || err}`), { detalhe: `${etapa}: ${err.name || ''} ${err.message || err}` });
    }
  })();
}

export async function desativar() {
  const inscricao = await inscricaoAtual();
  if (!inscricao) return;
  await api('notificacoes', { metodo: 'POST', corpo: { acao: 'cancelar', endpoint: inscricao.endpoint } }).catch(() => {});
  await inscricao.unsubscribe();
}

export const testar = () => api('notificacoes', { metodo: 'POST', corpo: { acao: 'testar' } });
