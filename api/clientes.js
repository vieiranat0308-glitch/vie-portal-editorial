import {
  handler, metodo, exigirAdmin, exigirEquipeCompleta, exigirAcessoCliente, podeVerCliente, HttpError, getRedis, keys, slugify, texto, novoId,
} from '../lib/base.js';
import { temInterativo, garantirLeitura } from './cronograma.js';
import { exemploCliente, exemploEditorial, exemploIdeias, exemploMetricas, exemploEvolucao } from '../lib/exemplo.js';

export default handler(async (req, res, usuario) => {
  metodo(req, 'GET', 'POST', 'PUT', 'DELETE');
  const redis = getRedis();
  const id = String(req.query.id || '');

  // Serviços prestados pela Vie (as etiquetas dos clientes). Todos leem; só a Vie edita.
  if (req.query.servicos) {
    if (req.method === 'GET') return res.status(200).json(await listarServicos());
    exigirEquipeCompleta(usuario);
    metodo(req, 'PUT');
    const lista = (Array.isArray(req.body) ? req.body : []).slice(0, 30).map((s) => ({
      id: /^[a-z0-9-]{2,40}$/.test(s.id || '') ? s.id : slugify(s.nome),
      nome: texto(s.nome, 60).trim(),
      cor: /^#[0-9a-f]{6}$/i.test(s.cor || '') ? s.cor : '#8a391b',
      abas: (Array.isArray(s.abas) ? s.abas : []).filter((a) => ABAS.includes(a)),
      versao: VERSAO_ABAS,
    })).filter((s) => s.nome);
    if (!lista.length) throw new HttpError(400, 'Mantenha pelo menos um serviço.');
    if (new Set(lista.map((s) => s.id)).size !== lista.length) throw new HttpError(400, 'Há dois serviços com o mesmo nome.');
    await redis.set(keys.servicos, lista);
    return res.status(200).json(lista);
  }

  if (req.method === 'GET') {
    if (id) return res.status(200).json(comServicos(await exigirAcessoCliente(usuario, id)));
    exigirAdmin(usuario);
    const mes = /^\d{4}-\d{2}$/.test(req.query.mes || '') ? req.query.mes : new Date().toISOString().slice(0, 7);
    // Quem da equipe tem uma lista de clientes só vê os dela.
    const clientes = Object.values((await redis.hgetall(keys.clientes)) || {}).filter((c) => podeVerCliente(usuario, c.id));
    const lista = await Promise.all(clientes.map(async (c) => ({ ...comServicos(c), resumo: await resumo(c.id, mes) })));
    lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return res.status(200).json(lista);
  }

  exigirAdmin(usuario);
  const corpo = req.body || {};

  if (req.method === 'POST') {
    exigirEquipeCompleta(usuario);
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
    return res.status(200).json(comServicos(cliente));
  }

  const atual = await exigirAcessoCliente(usuario, id);

  if (req.method === 'PUT') {
    const cliente = { ...atual, ...limpar(corpo), id: atual.id };
    await redis.hset(keys.clientes, { [id]: cliente });
    return res.status(200).json(comServicos(cliente));
  }

  // DELETE: apaga o cliente e tudo o que foi entregue a ele.
  exigirEquipeCompleta(usuario);
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
  await Promise.all(crons.flatMap((c) => [c?.interativo, c?.interativoVie]).filter(Boolean).map((a) => apagarArquivo(a.arquivoId)));
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
    servicos: (Array.isArray(c.servicos) ? c.servicos : []).map((s) => texto(s, 40)).filter((s) => /^[a-z0-9-]{2,40}$/.test(s)).slice(0, 20),
  };
}

async function resumo(clienteId, mes) {
  const redis = getRedis();
  const [salvo, metricas] = await Promise.all([redis.get(keys.cronograma(clienteId, mes)), redis.get(keys.metricas(clienteId))]);
  const doc = salvo && await garantirLeitura(clienteId, salvo);
  const posts = doc?.posts || [];
  const vie = posts.filter((p) => p.trilha === 'vie').length;
  const porStatus = {};
  posts.forEach((p) => { porStatus[p.status] = (porStatus[p.status] || 0) + 1; });
  const ultimoMes = Object.keys(metricas || {}).sort().pop();
  return {
    mes,
    cronograma: doc ? doc.status : null,
    total: posts.length,
    totalVie: vie,
    totalCliente: posts.length - vie,
    interativo: temInterativo(doc),
    aprovacaoMes: temInterativo(doc) ? doc.aprovacaoMes?.status || 'aguardando' : null,
    porStatus,
    seguidores: ultimoMes ? metricas[ultimoMes].seguidores : null,
    metricasMes: ultimoMes || null,
  };
}

// Abas do portal que cada serviço libera para o cliente (Visão geral e Documentos aparecem sempre).
// `cronogramaVie` não é uma aba do menu: divide o Cronograma em “da Vie” e “do cliente”.
export const ABAS = ['linha', 'cronograma', 'cronogramaVie', 'aprovacao', 'ideias', 'evolucao', 'metricas'];
const ABAS_CONTEUDO = ['linha', 'cronograma', 'aprovacao', 'ideias', 'evolucao', 'metricas'];
// Sobe quando surge uma opção nova, para os serviços já salvos receberem o padrão dela.
const VERSAO_ABAS = 2;

export const SERVICOS_PADRAO = [
  { id: 'instagram', nome: 'Gestão de Instagram', cor: '#3f6a8a', abas: ['linha', 'cronograma', 'cronogramaVie', 'aprovacao', 'ideias', 'evolucao', 'metricas'] },
  { id: 'video', nome: 'Produção de vídeo', cor: '#b0813a', abas: ['cronograma', 'aprovacao', 'ideias'] },
  { id: 'trafego', nome: 'Gestão de tráfego', cor: '#4f7a52', abas: ['metricas', 'evolucao'] },
  { id: 'editorial', nome: 'Consultoria editorial', cor: '#8a391b', abas: ABAS_CONTEUDO },
];

async function listarServicos() {
  const salvos = await getRedis().get(keys.servicos);
  if (!salvos) return SERVICOS_PADRAO;
  // Serviços salvos antes das abas por serviço: usa o padrão do mesmo serviço ou todas.
  return salvos.map((s) => {
    const padrao = SERVICOS_PADRAO.find((p) => p.id === s.id)?.abas;
    if (!Array.isArray(s.abas)) return { ...s, abas: padrao || ABAS };
    // Salvos antes do cronograma separado: a Gestão de Instagram ganha a divisão.
    if (s.versao !== VERSAO_ABAS && padrao?.includes('cronogramaVie') && s.abas.includes('cronograma') && !s.abas.includes('cronogramaVie')) {
      return { ...s, abas: [...s.abas, 'cronogramaVie'] };
    }
    return s;
  });
}

// Clientes cadastrados antes das etiquetas eram todos da consultoria editorial.
function comServicos(c) {
  return { ...c, servicos: Array.isArray(c.servicos) ? c.servicos : ['editorial'] };
}
