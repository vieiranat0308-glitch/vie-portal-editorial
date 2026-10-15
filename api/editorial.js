import {
  handler, metodo, exigirAdmin, exigirAcessoCliente, HttpError, getRedis, keys, novoId, texto, lerCorpoBruto,
} from '../lib/base.js';
import { salvarArquivo, lerArquivo, apagarArquivo } from '../lib/arquivos.js';

const LIMITE_PDF = 4 * 1024 * 1024; // limite de corpo das funções da Vercel (~4,5 MB)

// Linha editorial do cliente: posicionamento, tom de voz, pilares, frequência etc.
// Também pode ter o PDF pronto da estratégia (?pdf=1), que a Vie sobe e o cliente vê.
export default handler(async (req, res, usuario) => {
  metodo(req, 'GET', 'PUT', 'POST', 'DELETE');
  const clienteId = String(req.query.cliente || '');
  await exigirAcessoCliente(usuario, clienteId);
  const redis = getRedis();
  const chave = keys.editorial(clienteId);
  const atual = (await redis.get(chave)) || {};

  if (req.query.pdf) {
    if (req.method === 'GET') {
      if (!atual.pdf) throw new HttpError(404, 'Esta linha editorial ainda não tem PDF.');
      const arquivo = await lerArquivo(atual.pdf.arquivoId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${req.query.baixar ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(atual.pdf.nome)}`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.status(200).send(arquivo.conteudo);
    }
    exigirAdmin(usuario);
    if (req.method === 'POST') {
      const conteudo = await lerCorpoBruto(req);
      if (!conteudo.length) throw new HttpError(400, 'Arquivo vazio.');
      if (conteudo.length > LIMITE_PDF) throw new HttpError(413, 'PDF acima de 4 MB. No Canva, exporte como “PDF padrão” (não “para impressão”) ou comprima o arquivo.');
      if (conteudo.subarray(0, 5).toString('latin1') !== '%PDF-') throw new HttpError(400, 'Envie um arquivo PDF.');
      const nome = texto(req.query.nome || 'linha-editorial.pdf', 150).replace(/[^\w.\- ()À-ú]/g, '_');
      const arquivoId = await salvarArquivo(clienteId, nome, 'application/pdf', conteudo);
      if (atual.pdf) await apagarArquivo(atual.pdf.arquivoId);
      atual.pdf = { arquivoId, nome, tamanho: conteudo.length, enviadoEm: new Date().toISOString(), enviadoPor: usuario.nome };
    } else if (req.method === 'DELETE') {
      if (atual.pdf) await apagarArquivo(atual.pdf.arquivoId);
      delete atual.pdf;
    } else {
      throw new HttpError(405, 'Use GET, POST ou DELETE.');
    }
    await redis.set(chave, atual);
    return res.status(200).json(atual);
  }

  if (req.method === 'GET') return res.status(200).json(atual);
  metodo(req, 'PUT');

  exigirAdmin(usuario);
  const editorial = req.body;
  if (!editorial || typeof editorial !== 'object' || Array.isArray(editorial)) throw new HttpError(400, 'Conteúdo inválido.');
  if (JSON.stringify(editorial).length > 300_000) throw new HttpError(413, 'A linha editorial ficou grande demais.');
  editorial.pilares = (editorial.pilares || []).map((p) => ({ ...p, id: p.id || novoId('p') }));
  const ids = new Set(editorial.pilares.map((p) => p.id));
  if (editorial.frequencia?.slots) {
    editorial.frequencia.slots = editorial.frequencia.slots.map((s) => ({ ...s, pilares: (s.pilares || []).filter((id) => ids.has(id)) }));
  }
  // O PDF é gerenciado à parte (?pdf=1); salvar o formulário não mexe nele.
  if (atual.pdf) editorial.pdf = atual.pdf; else delete editorial.pdf;
  editorial.atualizadoEm = new Date().toISOString();
  await redis.set(chave, editorial);
  res.status(200).json(editorial);
});
