import {
  handler, metodo, exigirAdmin, exigirAcessoCliente, HttpError, getRedis, keys, texto, novoId, lerCorpoBruto,
} from '../lib/base.js';
import { salvarArquivo, lerArquivo, apagarArquivo } from '../lib/arquivos.js';

const TIPOS_IMAGEM = ['image/png', 'image/jpeg', 'image/webp'];
const LIMITE = 4 * 1024 * 1024;

// Evolução do perfil: o perfil inicial do cliente e os registros mês a mês
// (print, números, bio, destaques e a análise da Vie). O cliente só lê.
export default handler(async (req, res, usuario) => {
  metodo(req, 'GET', 'POST');
  const clienteId = String(req.query.cliente || '');
  await exigirAcessoCliente(usuario, clienteId);
  const redis = getRedis();
  const chave = keys.evolucao(clienteId);
  const registros = (await redis.get(chave)) || [];

  if (req.method === 'GET') {
    if (!req.query.arquivo) return res.status(200).json(ordenar(registros));
    const id = String(req.query.arquivo);
    // O cliente só abre prints que fazem parte de um registro dele.
    if (usuario.role !== 'admin' && !registros.some((r) => (r.prints || []).includes(id))) throw new HttpError(404, 'Imagem não encontrada.');
    const arquivo = await lerArquivo(id);
    if (arquivo.clienteId && arquivo.clienteId !== clienteId) throw new HttpError(404, 'Imagem não encontrada.');
    res.setHeader('Content-Type', arquivo.tipo);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.status(200).send(arquivo.conteudo);
  }

  exigirAdmin(usuario);

  // Envio do print (o navegador manda a imagem como octet-stream).
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
    const tipo = String(req.query.tipo || '');
    if (!TIPOS_IMAGEM.includes(tipo)) throw new HttpError(400, 'Envie o print como imagem (PNG, JPG ou WEBP).');
    const conteudo = await lerCorpoBruto(req);
    if (!conteudo.length) throw new HttpError(400, 'Imagem vazia.');
    if (conteudo.length > LIMITE) throw new HttpError(413, 'Imagem acima de 4 MB.');
    const arquivoId = await salvarArquivo(clienteId, texto(req.query.nome || 'print.png', 120).replace(/[^\w.\- ()À-ú]/g, '_'), tipo, conteudo);
    return res.status(200).json({ arquivoId });
  }

  const corpo = req.body || {};
  switch (corpo.acao) {
    case 'salvar': {
      const r = limpar(corpo.registro || {});
      const i = registros.findIndex((x) => x.id === r.id);
      if (i >= 0) {
        const removidos = (registros[i].prints || []).filter((p) => !r.prints.includes(p));
        await Promise.all(removidos.map(apagarArquivo));
        registros[i] = { ...registros[i], ...r, atualizadoEm: new Date().toISOString() };
      } else {
        registros.push({ ...r, id: novoId('r'), criadoEm: new Date().toISOString(), criadoPor: usuario.nome });
      }
      // Só um registro pode ser o perfil inicial.
      if (r.inicial) {
        const alvo = i >= 0 ? r.id : registros.at(-1).id;
        registros.forEach((x) => { if (x.id !== alvo) x.inicial = false; });
      }
      break;
    }

    case 'excluir': {
      const alvo = registros.find((x) => x.id === corpo.id);
      if (!alvo) throw new HttpError(404, 'Registro não encontrado.');
      await Promise.all((alvo.prints || []).map(apagarArquivo));
      registros.splice(registros.indexOf(alvo), 1);
      break;
    }

    default:
      throw new HttpError(400, 'Ação desconhecida.');
  }

  await redis.set(chave, registros);
  res.status(200).json(ordenar(registros));
});

function ordenar(registros) {
  return [...registros].sort((a, b) => a.data.localeCompare(b.data));
}

function numero(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function limpar(r) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data || '')) throw new HttpError(400, 'Informe a data do registro.');
  return {
    ...(r.id ? { id: String(r.id) } : {}),
    data: r.data,
    inicial: !!r.inicial,
    posts: numero(r.posts),
    seguidores: numero(r.seguidores),
    seguindo: numero(r.seguindo),
    bio: texto(r.bio, 1000),
    link: texto(r.link, 300),
    destaques: (Array.isArray(r.destaques) ? r.destaques : []).map((d) => texto(d, 60).trim()).filter(Boolean).slice(0, 30),
    analise: texto(r.analise, 5000),
    prints: (Array.isArray(r.prints) ? r.prints : []).filter((p) => /^a[a-f0-9]{12}$/.test(p)).slice(0, 6),
  };
}
