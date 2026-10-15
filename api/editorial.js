import { handler, metodo, exigirAdmin, exigirAcessoCliente, HttpError, getRedis, keys, novoId } from '../lib/base.js';

// Linha editorial do cliente: posicionamento, tom de voz, pilares, frequência etc.
export default handler(async (req, res, usuario) => {
  metodo(req, 'GET', 'PUT');
  const clienteId = String(req.query.cliente || '');
  await exigirAcessoCliente(usuario, clienteId);
  const redis = getRedis();

  if (req.method === 'GET') {
    return res.status(200).json((await redis.get(keys.editorial(clienteId))) || {});
  }

  exigirAdmin(usuario);
  const editorial = req.body;
  if (!editorial || typeof editorial !== 'object' || Array.isArray(editorial)) throw new HttpError(400, 'Conteúdo inválido.');
  if (JSON.stringify(editorial).length > 300_000) throw new HttpError(413, 'A linha editorial ficou grande demais.');
  editorial.pilares = (editorial.pilares || []).map((p) => ({ ...p, id: p.id || novoId('p') }));
  const ids = new Set(editorial.pilares.map((p) => p.id));
  if (editorial.frequencia?.slots) {
    editorial.frequencia.slots = editorial.frequencia.slots.map((s) => ({ ...s, pilares: (s.pilares || []).filter((id) => ids.has(id)) }));
  }
  editorial.atualizadoEm = new Date().toISOString();
  await redis.set(keys.editorial(clienteId), editorial);
  res.status(200).json(editorial);
});
