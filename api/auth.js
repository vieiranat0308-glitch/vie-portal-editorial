import {
  handler, metodo, HttpError, getRedis, keys, buscarUsuario, criarSessao, encerrarSessao,
  conferirSenha, hashSenha, iguaisSeguro, emailAdminMestre, publicoUsuario, texto,
} from '../lib/base.js';

const MAX_TENTATIVAS = 8;

export default handler(async (req, res, usuario) => {
  metodo(req, 'GET', 'POST');
  const redis = getRedis();

  if (req.method === 'GET') {
    if (!usuario) throw new HttpError(401, 'Faça login para continuar.');
    const cliente = usuario.clienteId ? await redis.hget(keys.clientes, usuario.clienteId) : null;
    return res.status(200).json({ usuario, cliente });
  }

  const corpo = req.body || {};
  switch (corpo.acao) {
    case 'login': {
      const email = String(corpo.email || '').trim().toLowerCase();
      const chave = keys.tentativas(email);
      const tentativas = await redis.incr(chave);
      if (tentativas === 1) await redis.expire(chave, 15 * 60);
      if (tentativas > MAX_TENTATIVAS) throw new HttpError(429, 'Muitas tentativas. Aguarde 15 minutos e tente de novo.');

      const conta = await buscarUsuario(email);
      const ok = conta && (conta.hash
        ? conferirSenha(corpo.senha, conta.salt, conta.hash)
        : conta.mestre && iguaisSeguro(corpo.senha, process.env.ADMIN_PASSWORD));
      if (!ok) throw new HttpError(401, 'E-mail ou senha incorretos.');

      await redis.del(chave);
      await criarSessao(res, email);
      return res.status(200).json({ usuario: publicoUsuario(conta) });
    }

    case 'logout':
      await encerrarSessao(req, res);
      return res.status(200).json({ ok: true });

    case 'convite-info': {
      const convite = await conviteValido(corpo.token);
      const cliente = convite.clienteId ? await redis.hget(keys.clientes, convite.clienteId) : null;
      return res.status(200).json({ nome: convite.nome, email: convite.email, role: convite.role, cliente: cliente?.nome || null });
    }

    case 'convite-aceitar': {
      const convite = await conviteValido(corpo.token);
      const email = String(convite.email || '').trim().toLowerCase();
      if (String(corpo.senha || '').length < 8) throw new HttpError(400, 'A senha precisa ter pelo menos 8 caracteres.');
      if (email === emailAdminMestre()) throw new HttpError(400, 'Este e-mail já é a conta principal da Vie.');
      const { salt, hash } = hashSenha(corpo.senha);
      const conta = {
        email,
        nome: texto(corpo.nome || convite.nome, 120),
        role: convite.role === 'admin' ? 'admin' : 'cliente',
        clienteId: convite.role === 'admin' ? null : convite.clienteId,
        ...(convite.role === 'admin' && Array.isArray(convite.clientes) ? { clientes: convite.clientes } : {}),
        salt,
        hash,
        criadoEm: new Date().toISOString(),
      };
      await redis.hset(keys.usuarios, { [email]: conta });
      await redis.hdel(keys.convites, corpo.token);
      await criarSessao(res, email);
      return res.status(200).json({ usuario: publicoUsuario(conta) });
    }

    case 'senha': {
      if (!usuario) throw new HttpError(401, 'Faça login para continuar.');
      if (usuario.mestre) throw new HttpError(400, 'A senha da conta principal é definida na Vercel (ADMIN_PASSWORD).');
      const conta = await buscarUsuario(usuario.email);
      if (!conferirSenha(corpo.atual, conta.salt, conta.hash)) throw new HttpError(400, 'A senha atual não confere.');
      if (String(corpo.nova || '').length < 8) throw new HttpError(400, 'A nova senha precisa ter pelo menos 8 caracteres.');
      Object.assign(conta, hashSenha(corpo.nova));
      await redis.hset(keys.usuarios, { [conta.email]: conta });
      return res.status(200).json({ ok: true });
    }

    default:
      throw new HttpError(400, 'Ação desconhecida.');
  }
}, { publico: true });

async function conviteValido(token) {
  if (!/^[a-f0-9]{48}$/.test(String(token || ''))) throw new HttpError(404, 'Convite inválido.');
  const convite = await getRedis().hget(keys.convites, token);
  if (!convite || new Date(convite.expiraEm) < new Date()) {
    throw new HttpError(404, 'Este convite expirou ou já foi usado. Peça um novo link à equipe Vie.');
  }
  return convite;
}
