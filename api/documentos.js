import {
  handler, metodo, exigirAdmin, exigirAcessoCliente, HttpError, getRedis, keys, texto, novoId, lerCorpoBruto,
} from '../lib/base.js';
import { salvarArquivo, lerArquivo, apagarArquivo } from '../lib/arquivos.js';

const LIMITE = 4 * 1024 * 1024; // limite de corpo das funções da Vercel (~4,5 MB)
const TIPOS = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// Documentos entregues: arquivos enviados (PDF/imagem) ou links (Drive, Canva…).
export default handler(async (req, res, usuario) => {
  metodo(req, 'GET', 'POST', 'DELETE');
  const clienteId = String(req.query.cliente || '');
  await exigirAcessoCliente(usuario, clienteId);
  const redis = getRedis();
  const chave = keys.documentos(clienteId);
  const docs = (await redis.get(chave)) || [];

  if (req.method === 'GET') {
    if (!req.query.baixar) return res.status(200).json(docs);
    const doc = docs.find((d) => d.id === req.query.baixar && d.arquivoId);
    if (!doc) throw new HttpError(404, 'Documento não encontrado.');
    const arquivo = await lerArquivo(doc.arquivoId);
    const nome = encodeURIComponent(arquivo.nome);
    res.setHeader('Content-Type', arquivo.tipo);
    res.setHeader('Content-Disposition', `${req.query.abrir ? 'inline' : 'attachment'}; filename*=UTF-8''${nome}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(arquivo.conteudo);
  }

  exigirAdmin(usuario);

  if (req.method === 'DELETE') {
    const doc = docs.find((d) => d.id === req.query.id);
    if (!doc) throw new HttpError(404, 'Documento não encontrado.');
    if (doc.arquivoId) await apagarArquivo(doc.arquivoId);
    await redis.set(chave, docs.filter((d) => d.id !== doc.id));
    return res.status(200).json({ ok: true });
  }

  const tipoCorpo = String(req.headers['content-type'] || '');
  let doc;
  if (tipoCorpo.startsWith('application/json')) {
    const corpo = req.body || {};
    if (!/^https?:\/\//i.test(corpo.url || '')) throw new HttpError(400, 'Informe um link começando com https://');
    doc = { url: texto(corpo.url, 1000) };
    Object.assign(doc, dadosDoDoc(corpo));
  } else {
    // O navegador envia o arquivo como application/octet-stream (a Vercel entrega
    // o corpo como Buffer) e informa o tipo real na URL.
    const tipo = String(req.query.tipo || '');
    if (!TIPOS.includes(tipo)) throw new HttpError(400, 'Envie um PDF ou uma imagem (PNG, JPG, WEBP).');
    const conteudo = await lerCorpoBruto(req);
    if (!conteudo.length) throw new HttpError(400, 'Arquivo vazio.');
    if (conteudo.length > LIMITE) throw new HttpError(413, 'Arquivo acima de 4 MB. Comprima o PDF ou envie como link do Drive.');
    const nomeArquivo = texto(req.query.arquivo || 'documento', 150).replace(/[^\w.\- ()À-ú]/g, '_');
    doc = { arquivoId: await salvarArquivo(clienteId, nomeArquivo, tipo, conteudo), tipo, tamanho: conteudo.length, arquivo: nomeArquivo };
    Object.assign(doc, dadosDoDoc(req.query));
  }
  doc = { id: novoId('d'), ...doc, criadoEm: new Date().toISOString() };
  await redis.set(chave, [doc, ...docs]);
  res.status(200).json(doc);
});

function dadosDoDoc(origem) {
  const categorias = ['linha-editorial', 'cronograma', 'relatorio', 'material', 'outro'];
  return {
    nome: texto(origem.nome || origem.arquivo || 'Documento', 150),
    descricao: texto(origem.descricao, 500),
    categoria: categorias.includes(origem.categoria) ? origem.categoria : 'outro',
    mes: /^\d{4}-\d{2}$/.test(origem.mes || '') ? origem.mes : '',
  };
}
