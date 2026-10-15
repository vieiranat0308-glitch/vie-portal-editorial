import { handler, metodo, exigirAcessoCliente, HttpError, getRedis, keys, texto, novoId } from '../lib/base.js';
import { FORMATOS } from '../public/js/regras.js';

// Banco de ideias do cliente. A Vie cadastra e edita; o cliente pode sugerir novas.
export default handler(async (req, res, usuario) => {
  metodo(req, 'GET', 'POST');
  const clienteId = String(req.query.cliente || '');
  await exigirAcessoCliente(usuario, clienteId);
  const redis = getRedis();
  const chave = keys.ideias(clienteId);
  const ideias = (await redis.get(chave)) || [];
  const admin = usuario.role === 'admin';

  if (req.method === 'GET') return res.status(200).json(ideias);

  const corpo = req.body || {};
  let resultado = ideias;
  switch (corpo.acao) {
    case 'salvar': {
      const ideia = limpar(corpo.ideia || {});
      const i = ideias.findIndex((x) => x.id === ideia.id);
      if (i >= 0) {
        const anterior = ideias[i];
        if (!admin && !(anterior.origem === 'cliente' && anterior.autor === usuario.email)) {
          throw new HttpError(403, 'Só a equipe Vie edita as ideias do banco.');
        }
        resultado = ideias.map((x) => (x.id === ideia.id ? { ...anterior, ...ideia } : x));
      } else {
        const nova = { ...ideia, id: novoId('i'), origem: admin ? 'vie' : 'cliente', autor: usuario.email, autorNome: usuario.nome, criadoEm: new Date().toISOString() };
        resultado = [nova, ...ideias];
      }
      break;
    }
    case 'excluir': {
      const alvo = ideias.find((x) => x.id === corpo.id);
      if (!alvo) throw new HttpError(404, 'Ideia não encontrada.');
      if (!admin && !(alvo.origem === 'cliente' && alvo.autor === usuario.email)) throw new HttpError(403, 'Só a equipe Vie remove ideias do banco.');
      resultado = ideias.filter((x) => x.id !== corpo.id);
      break;
    }
    default:
      throw new HttpError(400, 'Ação desconhecida.');
  }
  await redis.set(chave, resultado);
  res.status(200).json(resultado);
});

function limpar(i) {
  if (!String(i.titulo || '').trim()) throw new HttpError(400, 'Dê um título para a ideia.');
  return {
    ...(i.id ? { id: String(i.id) } : {}),
    formato: FORMATOS[i.formato] ? i.formato : 'reel',
    pilarId: i.pilarId ? texto(i.pilarId, 40) : null,
    titulo: texto(i.titulo, 300).trim(),
    gancho: texto(i.gancho, 2000),
    roteiro: texto(i.roteiro, 10000),
    referencias: (Array.isArray(i.referencias) ? i.referencias : [])
      .filter((r) => /^https?:\/\//i.test(r?.url || ''))
      .slice(0, 20)
      .map((r) => ({ rotulo: texto(r.rotulo || 'Referência', 80), url: texto(r.url, 1000) })),
    usadaEm: /^\d{4}-\d{2}$/.test(i.usadaEm || '') ? i.usadaEm : null,
  };
}
