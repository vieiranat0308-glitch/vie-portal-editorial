import crypto from 'node:crypto';
import { handler, metodo, exigirAdmin, HttpError, getRedis, keys, emailAdminMestre, texto } from '../lib/base.js';

const VALIDADE_CONVITE_DIAS = 7;

// Acessos: quem entra no portal de cada cliente (ou na equipe Vie, com cliente=vie).
export default handler(async (req, res, usuario) => {
  metodo(req, 'GET', 'POST');
  exigirAdmin(usuario);
  const redis = getRedis();
  const alvo = String(req.query.cliente || req.body?.cliente || '');
  if (!alvo) throw new HttpError(400, 'Informe o cliente.');
  const daEquipe = alvo === 'vie';
  if (!daEquipe && !(await redis.hget(keys.clientes, alvo))) throw new HttpError(404, 'Cliente não encontrado.');

  if (req.method === 'GET') {
    const usuarios = Object.values((await redis.hgetall(keys.usuarios)) || {})
      .filter((u) => (daEquipe ? u.role === 'admin' : u.clienteId === alvo))
      .map(({ email, nome, criadoEm }) => ({ email, nome, criadoEm }));
    if (daEquipe && emailAdminMestre()) {
      usuarios.unshift({ email: emailAdminMestre(), nome: process.env.ADMIN_NOME || 'Vie Company', mestre: true });
    }
    const agora = new Date();
    const convites = Object.entries((await redis.hgetall(keys.convites)) || {})
      .filter(([, c]) => (daEquipe ? c.role === 'admin' : c.clienteId === alvo) && new Date(c.expiraEm) > agora)
      .map(([token, c]) => ({ token, ...c }));
    return res.status(200).json({ usuarios, convites });
  }

  const corpo = req.body || {};
  switch (corpo.acao) {
    case 'convite': {
      const email = String(corpo.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Informe um e-mail válido.');
      if (email === emailAdminMestre()) throw new HttpError(400, 'Este e-mail já é a conta principal da Vie.');
      const existente = await redis.hget(keys.usuarios, email);
      if (existente && (existente.clienteId !== (daEquipe ? null : alvo) || existente.role !== (daEquipe ? 'admin' : 'cliente'))) {
        throw new HttpError(400, 'Este e-mail já tem acesso a outro portal. Remova o acesso antigo antes.');
      }
      const token = crypto.randomBytes(24).toString('hex');
      const convite = {
        email,
        nome: texto(corpo.nome, 120),
        role: daEquipe ? 'admin' : 'cliente',
        clienteId: daEquipe ? null : alvo,
        criadoPor: usuario.email,
        expiraEm: new Date(Date.now() + VALIDADE_CONVITE_DIAS * 864e5).toISOString(),
      };
      await redis.hset(keys.convites, { [token]: convite });
      return res.status(200).json({ token, ...convite });
    }

    case 'cancelar-convite':
      await redis.hdel(keys.convites, String(corpo.token || ''));
      return res.status(200).json({ ok: true });

    case 'remover': {
      const email = String(corpo.email || '').trim().toLowerCase();
      const conta = await redis.hget(keys.usuarios, email);
      if (!conta) throw new HttpError(404, 'Acesso não encontrado.');
      if (email === usuario.email) throw new HttpError(400, 'Você não pode remover o seu próprio acesso.');
      if ((daEquipe && conta.role !== 'admin') || (!daEquipe && conta.clienteId !== alvo)) {
        throw new HttpError(400, 'Este acesso não pertence a este portal.');
      }
      await redis.hdel(keys.usuarios, email);
      return res.status(200).json({ ok: true });
    }

    default:
      throw new HttpError(400, 'Ação desconhecida.');
  }
});
