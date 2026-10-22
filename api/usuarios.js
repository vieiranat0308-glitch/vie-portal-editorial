import crypto from 'node:crypto';
import { handler, metodo, exigirAdmin, exigirEquipeCompleta, exigirAcessoCliente, HttpError, getRedis, keys, emailAdminMestre, texto } from '../lib/base.js';

const VALIDADE_CONVITE_DIAS = 7;

// Acessos: quem entra no portal de cada cliente (ou na equipe Vie, com cliente=vie).
export default handler(async (req, res, usuario) => {
  metodo(req, 'GET', 'POST');
  exigirAdmin(usuario);
  const redis = getRedis();
  const alvo = String(req.query.cliente || req.body?.cliente || '');
  if (!alvo) throw new HttpError(400, 'Informe o cliente.');
  const daEquipe = alvo === 'vie';
  // A equipe é gerida por quem vê todos os clientes; os acessos de um cliente, por quem cuida dele.
  if (daEquipe) exigirEquipeCompleta(usuario);
  else await exigirAcessoCliente(usuario, alvo);

  if (req.method === 'GET') {
    const usuarios = Object.values((await redis.hgetall(keys.usuarios)) || {})
      .filter((u) => (daEquipe ? u.role === 'admin' : u.clienteId === alvo))
      .map(({ email, nome, criadoEm, clientes }) => ({ email, nome, criadoEm, ...(daEquipe ? { clientes: Array.isArray(clientes) ? clientes : null } : {}) }));
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
        ...(daEquipe ? { clientes: await clientesEscolhidos(corpo.clientes) } : {}),
        criadoPor: usuario.email,
        expiraEm: new Date(Date.now() + VALIDADE_CONVITE_DIAS * 864e5).toISOString(),
      };
      await redis.hset(keys.convites, { [token]: convite });
      return res.status(200).json({ token, ...convite });
    }

    // Quais clientes uma pessoa da equipe enxerga (null = todos).
    case 'clientes-da-pessoa': {
      if (!daEquipe) throw new HttpError(400, 'Isso vale só para a equipe Vie.');
      const email = String(corpo.email || '').trim().toLowerCase();
      const conta = await redis.hget(keys.usuarios, email);
      if (!conta || conta.role !== 'admin') throw new HttpError(404, 'Pessoa da equipe não encontrada.');
      if (email === usuario.email) throw new HttpError(400, 'Peça para outra pessoa da equipe mudar o seu acesso.');
      const clientes = await clientesEscolhidos(corpo.clientes);
      const atualizada = { ...conta };
      if (clientes) atualizada.clientes = clientes; else delete atualizada.clientes;
      await redis.hset(keys.usuarios, { [email]: atualizada });
      return res.status(200).json({ ok: true });
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
      await redis.del(keys.push(email));
      return res.status(200).json({ ok: true });
    }

    default:
      throw new HttpError(400, 'Ação desconhecida.');
  }
});

// "todos" (ou nada) = todos os clientes, inclusive os que forem criados depois.
async function clientesEscolhidos(valor) {
  if (!Array.isArray(valor)) return null;
  const existentes = new Set(Object.keys((await getRedis().hgetall(keys.clientes)) || {}));
  const lista = [...new Set(valor.map(String))].filter((id) => existentes.has(id));
  if (!lista.length) throw new HttpError(400, 'Escolha pelo menos um cliente (ou “Todos os clientes”).');
  return lista;
}
