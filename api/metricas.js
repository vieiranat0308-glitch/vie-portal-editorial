import { handler, metodo, exigirAdmin, exigirAcessoCliente, getRedis, keys, texto, mesValido } from '../lib/base.js';

const CAMPOS = ['seguidores', 'novosSeguidores', 'visualizacoes', 'naoSeguidores', 'alcance', 'visitasPerfil', 'toquesLink', 'interacoes', 'reels', 'posts', 'stories', 'pacientes'];

// Métricas mensais do Instagram, preenchidas pela Vie no acompanhamento.
export default handler(async (req, res, usuario) => {
  metodo(req, 'GET', 'POST');
  const clienteId = String(req.query.cliente || '');
  await exigirAcessoCliente(usuario, clienteId);
  const redis = getRedis();
  const chave = keys.metricas(clienteId);
  const metricas = (await redis.get(chave)) || {};

  if (req.method === 'GET') return res.status(200).json(metricas);

  exigirAdmin(usuario);
  const corpo = req.body || {};
  const mes = mesValido(corpo.mes);
  if (corpo.acao === 'excluir') {
    delete metricas[mes];
  } else {
    const dados = {};
    CAMPOS.forEach((c) => {
      const n = Number(String(corpo.dados?.[c] ?? '').replace(',', '.'));
      dados[c] = corpo.dados?.[c] === '' || corpo.dados?.[c] == null || Number.isNaN(n) ? null : n;
    });
    dados.observacoes = texto(corpo.dados?.observacoes, 3000);
    metricas[mes] = dados;
  }
  await redis.set(chave, metricas);
  res.status(200).json(metricas);
});
