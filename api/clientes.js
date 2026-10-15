import {
  handler, metodo, exigirAdmin, exigirAcessoCliente, HttpError, getRedis, keys, slugify, texto, novoId,
} from '../lib/base.js';
import { exemploCliente, exemploEditorial, exemploIdeias, exemploMetricas, exemploEvolucao } from '../lib/exemplo.js';

export default handler(async (req, res, usuario) => {
  metodo(req, 'GET', 'POST', 'PUT', 'DELETE');
  const redis = getRedis();
  const id = String(req.query.id || '');

  if (req.method === 'GET') {
    if (id) return res.status(200).json(await exigirAcessoCliente(usuario, id));
    exigirAdmin(usuario);
    const mes = /^\d{4}-\d{2}$/.test(req.query.mes || '') ? req.query.mes : new Date().toISOString().slice(0, 7);
    const clientes = Object.values((await redis.hgetall(keys.clientes)) || {});
    const lista = await Promise.all(clientes.map(async (c) => ({ ...c, resumo: await resumo(c.id, mes) })));
    lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return res.status(200).json(lista);
  }

  exigirAdmin(usuario);
  const corpo = req.body || {};

  if (req.method === 'POST') {
    const base = corpo.exemplo ? exemploCliente : corpo;
    if (!String(base.nome || '').trim()) throw new HttpError(400, 'Informe o nome do cliente.');
    let novo = slugify(base.nome);
    if (await redis.hget(keys.clientes, novo)) novo = `${novo}-${novoId().slice(0, 4)}`;
    const cliente = { ...limpar(base), id: novo, criadoEm: new Date().toISOString() };
    await redis.hset(keys.clientes, { [novo]: cliente });
    if (corpo.exemplo) {
      await redis.set(keys.editorial(novo), exemploEditorial);
      await redis.set(keys.ideias(novo), exemploIdeias.map((i) => ({ ...i, id: novoId('i'), roteiro: i.roteiro || '', referencias: [], origem: 'vie', criadoEm: cliente.criadoEm })));
      await redis.set(keys.metricas(novo), exemploMetricas);
      await redis.set(keys.evolucao(novo), exemploEvolucao.map((r) => ({ ...r, id: novoId('r'), criadoEm: cliente.criadoEm })));
    }
    return res.status(200).json(cliente);
  }

  const atual = await exigirAcessoCliente(usuario, id);

  if (req.method === 'PUT') {
    const cliente = { ...atual, ...limpar(corpo), id: atual.id };
    await redis.hset(keys.clientes, { [id]: cliente });
    return res.status(200).json(cliente);
  }

  // DELETE: apaga o cliente e tudo o que foi entregue a ele.
  const meses = await redis.smembers(keys.meses(id));
  const docs = (await redis.get(keys.documentos(id))) || [];
  const usuarios = Object.values((await redis.hgetall(keys.usuarios)) || {}).filter((u) => u.clienteId === id);
  const { apagarArquivo } = await import('../lib/arquivos.js');
  await Promise.all(docs.filter((d) => d.arquivoId).map((d) => apagarArquivo(d.arquivoId)));
  const evolucao = (await redis.get(keys.evolucao(id))) || [];
  await Promise.all(evolucao.flatMap((r) => r.prints || []).map(apagarArquivo));
  const editorial = await redis.get(keys.editorial(id));
  if (editorial?.pdf) await apagarArquivo(editorial.pdf.arquivoId);
  const crons = await Promise.all(meses.map((m) => redis.get(keys.cronograma(id, m))));
  await Promise.all(crons.filter((c) => c?.interativo).map((c) => apagarArquivo(c.interativo.arquivoId)));
  await redis.del(
    keys.editorial(id), keys.ideias(id), keys.metricas(id), keys.documentos(id), keys.meses(id), keys.evolucao(id),
    ...meses.map((m) => keys.cronograma(id, m)),
  );
  if (usuarios.length) await redis.hdel(keys.usuarios, ...usuarios.map((u) => u.email));
  await redis.hdel(keys.clientes, id);
  res.status(200).json({ ok: true });
});

function limpar(c) {
  const cor = /^#[0-9a-f]{6}$/i.test(c.cor || '') ? c.cor : '#8a391b';
  return {
    nome: texto(c.nome, 120).trim(),
    tratamento: texto(c.tratamento, 60).trim(),
    especialidade: texto(c.especialidade, 120),
    instagram: texto(c.instagram, 60).replace(/^@/, '').trim(),
    cor,
    ativo: c.ativo !== false,
  };
}

async function resumo(clienteId, mes) {
  const redis = getRedis();
  const [doc, metricas] = await Promise.all([redis.get(keys.cronograma(clienteId, mes)), redis.get(keys.metricas(clienteId))]);
  const posts = doc?.posts || [];
  const porStatus = {};
  posts.forEach((p) => { porStatus[p.status] = (porStatus[p.status] || 0) + 1; });
  const ultimoMes = Object.keys(metricas || {}).sort().pop();
  return {
    mes,
    cronograma: doc ? doc.status : null,
    total: posts.length,
    interativo: !!doc?.interativo,
    aprovacaoMes: doc?.interativo ? doc.aprovacaoMes?.status || 'aguardando' : null,
    porStatus,
    seguidores: ultimoMes ? metricas[ultimoMes].seguidores : null,
    metricasMes: ultimoMes || null,
  };
}
