import {
  handler, metodo, exigirAdmin, exigirAcessoCliente, HttpError, getRedis, keys, texto, mesValido, novoId,
} from '../lib/base.js';
import { FORMATOS, STATUS, STATUS_DO_CLIENTE, gerarEsqueleto } from '../public/js/regras.js';

// Cronograma mensal: cada mês é um documento com os conteúdos (feed e stories).
// O cliente só enxerga o mês depois que a Vie publica.
export default handler(async (req, res, usuario) => {
  metodo(req, 'GET', 'POST');
  const clienteId = String(req.query.cliente || '');
  await exigirAcessoCliente(usuario, clienteId);
  const redis = getRedis();
  const admin = usuario.role === 'admin';

  if (req.method === 'GET' && !req.query.mes) {
    const meses = (await redis.smembers(keys.meses(clienteId))).sort().reverse();
    const docs = await Promise.all(meses.map((m) => redis.get(keys.cronograma(clienteId, m))));
    const lista = docs.filter(Boolean)
      .filter((d) => admin || d.status === 'publicado')
      .map((d) => ({ mes: d.mes, status: d.status, total: d.posts.length, porStatus: contar(d.posts) }));
    return res.status(200).json(lista);
  }

  const mes = mesValido(req.query.mes);
  const chave = keys.cronograma(clienteId, mes);
  const doc = (await redis.get(chave)) || { mes, status: 'rascunho', foco: '', observacoes: '', posts: [] };

  if (req.method === 'GET') {
    if (admin) return res.status(200).json(doc);
    if (doc.status !== 'publicado') return res.status(200).json({ mes, status: 'indisponivel', posts: [] });
    return res.status(200).json(paraCliente(doc));
  }

  const corpo = req.body || {};
  const post = corpo.postId ? doc.posts.find((p) => p.id === corpo.postId) : null;
  let salvoId = null;
  const assinatura = { nome: usuario.nome, email: usuario.email, admin, em: new Date().toISOString() };

  switch (corpo.acao) {
    case 'salvar-mes':
      exigirAdmin(usuario);
      doc.status = corpo.status === 'publicado' ? 'publicado' : 'rascunho';
      doc.foco = texto(corpo.foco, 2000);
      doc.observacoes = texto(corpo.observacoes, 5000);
      if (doc.status === 'publicado' && !doc.publicadoEm) doc.publicadoEm = assinatura.em;
      if (doc.status === 'publicado' && corpo.pedirAprovacao) {
        doc.posts.forEach((p) => { if (p.status === 'pauta') p.status = 'aprovacao'; });
      }
      break;

    case 'salvar-post': {
      exigirAdmin(usuario);
      const limpo = limparPost(corpo.post || {}, mes);
      salvoId = limpo.id;
      const i = doc.posts.findIndex((p) => p.id === limpo.id);
      if (i >= 0) {
        const anterior = doc.posts[i];
        doc.posts[i] = { ...limpo, comentarios: anterior.comentarios || [], statusPor: anterior.status === limpo.status ? anterior.statusPor : undefined };
      }
      else doc.posts.push({ ...limpo, comentarios: [] });
      break;
    }

    case 'excluir-post':
      exigirAdmin(usuario);
      doc.posts = doc.posts.filter((p) => p.id !== corpo.postId);
      break;

    case 'esqueleto': {
      exigirAdmin(usuario);
      const [editorial, ideias] = await Promise.all([redis.get(keys.editorial(clienteId)), redis.get(keys.ideias(clienteId))]);
      const slots = editorial?.frequencia?.slots || [];
      if (!slots.length) throw new HttpError(400, 'Preencha a frequência do feed na linha editorial antes de gerar o mês.');
      const novos = gerarEsqueleto({
        mes,
        frequencia: slots,
        ideias: ideias || [],
        datasOcupadas: doc.posts.map((p) => `${p.data}|${p.formato}`),
      });
      doc.posts.push(...novos.map((p) => ({ ...p, comentarios: [] })));
      const usadas = new Set(novos.map((p) => p.ideiaId).filter(Boolean));
      if (usadas.size) {
        await redis.set(keys.ideias(clienteId), ideias.map((i) => (usadas.has(i.id) ? { ...i, usadaEm: mes } : i)));
      }
      break;
    }

    case 'status': {
      if (!post) throw new HttpError(404, 'Conteúdo não encontrado.');
      if (!STATUS[corpo.status]) throw new HttpError(400, 'Status inválido.');
      if (!admin) {
        if (doc.status !== 'publicado') throw new HttpError(403, 'Este cronograma ainda não foi liberado.');
        if (!STATUS_DO_CLIENTE.includes(corpo.status)) throw new HttpError(403, 'Este status é definido pela equipe Vie.');
        if (corpo.status === 'ajuste' && !String(corpo.comentario || '').trim()) {
          throw new HttpError(400, 'Conte o que você gostaria de ajustar.');
        }
      }
      post.status = corpo.status;
      post.statusPor = assinatura;
      if (String(corpo.comentario || '').trim()) {
        post.comentarios = [...(post.comentarios || []), { id: novoId('c'), texto: texto(corpo.comentario, 2000), ...assinatura }];
      }
      break;
    }

    case 'comentar': {
      if (!post) throw new HttpError(404, 'Conteúdo não encontrado.');
      if (!admin && doc.status !== 'publicado') throw new HttpError(403, 'Este cronograma ainda não foi liberado.');
      if (!String(corpo.texto || '').trim()) throw new HttpError(400, 'Escreva o comentário.');
      post.comentarios = [...(post.comentarios || []), { id: novoId('c'), texto: texto(corpo.texto, 2000), ...assinatura }];
      break;
    }

    default:
      throw new HttpError(400, 'Ação desconhecida.');
  }

  doc.posts.sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario));
  doc.atualizadoEm = assinatura.em;
  await redis.set(chave, doc);
  await redis.sadd(keys.meses(clienteId), mes);
  res.status(200).json({ ...(admin ? doc : paraCliente(doc)), salvoId });
});

function contar(posts) {
  const total = {};
  posts.forEach((p) => { total[p.status] = (total[p.status] || 0) + 1; });
  return total;
}

function paraCliente(doc) {
  return { ...doc, posts: doc.posts.map(({ notaInterna, ...p }) => p) };
}

function limparPost(p, mes) {
  if (!String(p.data || '').startsWith(`${mes}-`) || !/^\d{4}-\d{2}-\d{2}$/.test(p.data)) {
    throw new HttpError(400, 'A data do conteúdo precisa estar dentro do mês do cronograma.');
  }
  return {
    id: /^[\w-]{6,40}$/.test(p.id || '') ? p.id : novoId('p'),
    data: p.data,
    horario: texto(p.horario, 40),
    formato: FORMATOS[p.formato] ? p.formato : 'reel',
    pilarId: p.pilarId ? texto(p.pilarId, 40) : null,
    titulo: texto(p.titulo, 300),
    gancho: texto(p.gancho, 2000),
    roteiro: texto(p.roteiro, 10000),
    legenda: texto(p.legenda, 5000),
    referencias: (Array.isArray(p.referencias) ? p.referencias : [])
      .filter((r) => /^https?:\/\//i.test(r?.url || ''))
      .slice(0, 20)
      .map((r) => ({ rotulo: texto(r.rotulo || 'Referência', 80), url: texto(r.url, 1000) })),
    notaInterna: texto(p.notaInterna, 2000),
    status: STATUS[p.status] ? p.status : 'pauta',
    ideiaId: p.ideiaId ? texto(p.ideiaId, 40) : null,
  };
}
