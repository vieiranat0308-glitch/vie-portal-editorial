// Notificações no celular (Web Push): ativar, desativar e testar neste aparelho.
import { api } from './ui.js';
import { jaInstalado } from './instalar.js';

const ehIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const suportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function inscricaoAtual() {
  if (!suportado()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

// 'ativo' | 'desligado' | 'bloqueado' | 'instalar' (iPhone só recebe com o app instalado) | 'sem-suporte'
export async function situacao() {
  if (ehIos() && !jaInstalado()) return 'instalar';
  if (!suportado()) return 'sem-suporte';
  if (Notification.permission === 'denied') return 'bloqueado';
  return Notification.permission === 'granted' && (await inscricaoAtual()) ? 'ativo' : 'desligado';
}

const chaveEmBytes = (base64) => {
  const b = atob((base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

export async function ativar() {
  if (await Notification.requestPermission() !== 'granted') throw new Error('As notificações foram bloqueadas neste aparelho. Libere nas configurações do celular ou do navegador.');
  const reg = await navigator.serviceWorker.ready;
  const { chavePublica } = await api('notificacoes');
  let inscricao = await reg.pushManager.getSubscription();
  if (!inscricao) inscricao = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(chavePublica) });
  await api('notificacoes', { metodo: 'POST', corpo: { acao: 'inscrever', inscricao: inscricao.toJSON() } });
}

export async function desativar() {
  const inscricao = await inscricaoAtual();
  if (!inscricao) return;
  await api('notificacoes', { metodo: 'POST', corpo: { acao: 'cancelar', endpoint: inscricao.endpoint } }).catch(() => {});
  await inscricao.unsubscribe();
}

export const testar = () => api('notificacoes', { metodo: 'POST', corpo: { acao: 'testar' } });
