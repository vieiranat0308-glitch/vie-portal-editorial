// Notificações push (Web Push, padrão aberto dos navegadores: grátis, sem serviço pago).
// Cada aparelho que ativa as notificações guarda a sua inscrição no Redis.
// As chaves VAPID vêm das variáveis VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY ou,
// sem elas, são criadas uma vez e guardadas no próprio banco.
import webpush from 'web-push';
import { getRedis, keys, emailAdminMestre } from './base.js';

const MAX_APARELHOS = 10;

export async function chavesVapid() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const redis = getRedis();
  const salvas = await redis.get(keys.vapid);
  if (salvas?.publicKey) return salvas;
  const novas = webpush.generateVAPIDKeys();
  // Duas funções ao mesmo tempo: fica a primeira que gravou.
  await redis.set(keys.vapid, novas, { nx: true });
  return (await redis.get(keys.vapid)) || novas;
}

export function inscricaoValida(i) {
  return i && typeof i.endpoint === 'string' && /^https:\/\/[\w.-]+(:\d+)?\//.test(i.endpoint) && i.endpoint.length < 1000
    && typeof i.keys?.p256dh === 'string' && typeof i.keys?.auth === 'string'
    && i.keys.p256dh.length < 200 && i.keys.auth.length < 100;
}

export async function inscrever(email, inscricao) {
  const redis = getRedis();
  const atuais = (await redis.get(keys.push(email))) || [];
  const limpa = { endpoint: inscricao.endpoint, keys: { p256dh: inscricao.keys.p256dh, auth: inscricao.keys.auth } };
  const lista = [limpa, ...atuais.filter((i) => i.endpoint !== limpa.endpoint)].slice(0, MAX_APARELHOS);
  await redis.set(keys.push(email), lista);
}

export async function cancelar(email, endpoint) {
  const redis = getRedis();
  const atuais = (await redis.get(keys.push(email))) || [];
  await redis.set(keys.push(email), atuais.filter((i) => i.endpoint !== endpoint));
}

// Envia para todos os aparelhos das pessoas. Nunca derruba quem chamou.
export async function avisar(emails, { titulo, corpo, url = '/', tag }) {
  try {
    const redis = getRedis();
    const { publicKey, privateKey } = await chavesVapid();
    const contato = emailAdminMestre() ? `mailto:${emailAdminMestre()}` : 'mailto:contato@viecompany.com.br';
    const carga = JSON.stringify({ titulo, corpo, url, tag });
    let enviados = 0;
    await Promise.all([...new Set(emails)].map(async (email) => {
      const inscricoes = (await redis.get(keys.push(email))) || [];
      if (!inscricoes.length) return;
      const vencidas = [];
      await Promise.all(inscricoes.map(async (i) => {
        try {
          await webpush.sendNotification(i, carga, { vapidDetails: { subject: contato, publicKey, privateKey }, TTL: 60 * 60 * 12, timeout: 8000 });
          enviados++;
        } catch (err) {
          // Aparelho que desinstalou o app ou tirou a permissão.
          if ([404, 410].includes(err.statusCode)) vencidas.push(i.endpoint);
          else console.error('Push falhou', email, err.statusCode || err.message);
        }
      }));
      if (vencidas.length) await redis.set(keys.push(email), inscricoes.filter((i) => !vencidas.includes(i.endpoint)));
    }));
    return enviados;
  } catch (err) {
    console.error('Push falhou', err.message);
    return 0;
  }
}

async function pessoas(filtro) {
  const usuarios = Object.values((await getRedis().hgetall(keys.usuarios)) || {});
  return usuarios.filter(filtro).map((u) => u.email);
}

export const emailsDoCliente = (clienteId) => pessoas((u) => u.clienteId === clienteId && u.role === 'cliente');
// Equipe que acompanha o cliente: quem vê todos ou tem o cliente na lista.
export const emailsDaEquipe = async (clienteId) => [
  ...(await pessoas((u) => u.role === 'admin' && (!clienteId || !Array.isArray(u.clientes) || u.clientes.includes(clienteId)))),
  emailAdminMestre(),
].filter(Boolean);

export async function avisarCliente(clienteId, aviso) {
  return avisar(await emailsDoCliente(clienteId), { url: `/#/c/${encodeURIComponent(clienteId)}`, ...aviso });
}

export async function avisarEquipe(aviso, clienteId) {
  return avisar(await emailsDaEquipe(clienteId), aviso);
}
