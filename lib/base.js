import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';
import { bancoEmMemoria } from './memoria.js';

// ---------- Redis ----------
let redis;
export function getRedis() {
  if (redis) return redis;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return (redis = new Redis({ url, token }));
  // Só para testar no computador (npm run dev): os dados somem ao reiniciar.
  if (process.env.DEV_MEMORIA === '1') return (redis = bancoEmMemoria());
  throw new HttpError(500, 'Banco de dados não conectado. Na Vercel, vá em Storage e conecte um banco Redis (Upstash) a este projeto.');
}

export const keys = {
  clientes: 'clientes',
  usuarios: 'usuarios',
  convites: 'convites',
  sessao: (token) => `sessao:${token}`,
  tentativas: (email) => `tentativas:${email}`,
  editorial: (clienteId) => `editorial:${clienteId}`,
  cronograma: (clienteId, mes) => `cron:${clienteId}:${mes}`,
  meses: (clienteId) => `meses:${clienteId}`,
  ideias: (clienteId) => `ideias:${clienteId}`,
  metricas: (clienteId) => `metricas:${clienteId}`,
  documentos: (clienteId) => `docs:${clienteId}`,
  arquivo: (id) => `arquivo:${id}`,
  evolucao: (clienteId) => `evolucao:${clienteId}`,
};

// ---------- Erros / resposta ----------
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Envolve um handler: carrega o usuário logado e trata erros num lugar só.
export function handler(fn, { publico = false } = {}) {
  return async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const usuario = await usuarioDaSessao(req);
      if (!publico && !usuario) throw new HttpError(401, 'Faça login para continuar.');
      await fn(req, res, usuario);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(err);
      res.status(status).json({ error: err.message || String(err) });
    }
  };
}

export function exigirAdmin(usuario) {
  if (usuario?.role !== 'admin') throw new HttpError(403, 'Apenas a equipe Vie pode fazer isso.');
}

// Admin acessa qualquer cliente; o cliente só acessa o próprio.
export async function exigirAcessoCliente(usuario, clienteId) {
  if (!clienteId) throw new HttpError(400, 'Informe o cliente.');
  if (usuario.role !== 'admin' && usuario.clienteId !== clienteId) {
    throw new HttpError(403, 'Você não tem acesso a este cliente.');
  }
  const cliente = await getRedis().hget(keys.clientes, clienteId);
  if (!cliente) throw new HttpError(404, 'Cliente não encontrado.');
  return cliente;
}

export function metodo(req, ...permitidos) {
  if (!permitidos.includes(req.method)) throw new HttpError(405, `Use ${permitidos.join(' ou ')}.`);
}

// ---------- Senhas ----------
export function hashSenha(senha, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(senha), salt, 64).toString('hex');
  return { salt, hash };
}

export function conferirSenha(senha, salt, hash) {
  const calculado = Buffer.from(hashSenha(senha, salt).hash, 'hex');
  const esperado = Buffer.from(hash || '', 'hex');
  return esperado.length === calculado.length && crypto.timingSafeEqual(esperado, calculado);
}

export function iguaisSeguro(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---------- Sessão ----------
const COOKIE = 'vie_sessao';
const DURACAO = 60 * 60 * 24 * 30;

function lerCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p.length === 2)
  );
}

export function emailAdminMestre() {
  return String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
}

export async function criarSessao(res, email) {
  const token = crypto.randomBytes(32).toString('hex');
  await getRedis().set(keys.sessao(token), { email }, { ex: DURACAO });
  const seguro = process.env.DEV_MEMORIA === '1' ? '' : ' Secure;';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly;${seguro} SameSite=Lax; Max-Age=${DURACAO}`);
}

export async function encerrarSessao(req, res) {
  const token = lerCookies(req)[COOKIE];
  if (token) await getRedis().del(keys.sessao(token));
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export async function buscarUsuario(email) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return null;
  const salvo = await getRedis().hget(keys.usuarios, email);
  if (salvo) return salvo;
  // A conta principal da Vie vem das variáveis de ambiente.
  if (email === emailAdminMestre()) {
    return { email, nome: process.env.ADMIN_NOME || 'Vie Company', role: 'admin', mestre: true };
  }
  return null;
}

async function usuarioDaSessao(req) {
  const token = lerCookies(req)[COOKIE];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const sessao = await getRedis().get(keys.sessao(token));
  if (!sessao) return null;
  const usuario = await buscarUsuario(sessao.email);
  return usuario ? publicoUsuario(usuario) : null;
}

export function publicoUsuario(u) {
  return { email: u.email, nome: u.nome, role: u.role, clienteId: u.clienteId || null, mestre: !!u.mestre };
}

// ---------- Utilidades ----------
export function novoId(prefixo = '') {
  return prefixo + crypto.randomBytes(6).toString('hex');
}

export function slugify(texto) {
  return String(texto)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 40) || novoId();
}

export function mesValido(mes) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes || ''))) throw new HttpError(400, 'Mês inválido (use AAAA-MM).');
  return mes;
}

export function texto(valor, max = 5000) {
  return String(valor ?? '').slice(0, max);
}

export async function lerCorpoBruto(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const partes = [];
  for await (const parte of req) partes.push(parte);
  return Buffer.concat(partes);
}
