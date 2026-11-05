import {
  handler, metodo, exigirAdmin, exigirAcessoCliente, HttpError, getRedis, keys, texto, novoId, lerCorpoBruto,
} from '../lib/base.js';
import { salvarArquivo, lerArquivo, apagarArquivo } from '../lib/arquivos.js';
import { avisarCliente, avisarEquipe } from '../lib/push.js';
import { emailConfigurado } from '../lib/email.js';

// Planejamento das produções de cada cliente, numa função só (a Vercel gratuita
// permite até 12): tipo=moodboard (roteiros de gravação em PDF/Word para aprovar),
// tipo=sazonal (datas do calendário sazonal com a ação de marketing, para aprovar)
// e tipo=producao (dias de produção de conteúdo, com lembrete na véspera).
const TIPOS = {
  moodboard: { chave: keys.moodboards, nome: 'moodboard', aba: 'moodboard' },
  sazonal: { chave: keys.sazonal, nome: 'data do calendário sazonal', aba: 'sazonal' },
  producao: { chave: keys.producoes, nome: 'produção', aba: '' },
};
const ARQUIVOS = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/msword': 'Word',
};
const LIMITE = 4 * 1024 * 1024;
const STATUS_CLIENTE = ['aprovado', 'ajuste'];
const dataValida = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

export default handler(async (req, res, usuario) => {
  metodo(req, 'GET', 'POST');
  const clienteId = String(req.query.cliente || '');
  const cliente = await exigirAcessoCliente(usuario, clienteId);
  const tipo = TIPOS[req.query.tipo] ? req.query.tipo : null;
  if (!tipo) throw new HttpError(400, 'Tipo inválido.');
  const { chave } = TIPOS[tipo];
  const redis = getRedis();
  const admin = usuario.role === 'admin';
  let lista = (await redis.get(chave(clienteId))) || [];
  const salvar = async () => {
    lista.sort((a, b) => String(a.data || a.criadoEm).localeCompare(String(b.data || b.criadoEm)));
    await redis.set(chave(clienteId), lista);
  };
  const paraQuem = (itens) => (admin ? itens : itens.map(({ notaInterna, ...i }) => i));
  const responder = () => res.status(200).json(tipo === 'producao' ? { itens: lista, emailConfigurado: emailConfigurado() } : paraQuem(lista));

  if (req.method === 'GET') {
    // Arquivo do moodboard: só se pertence a este cliente.
    if (req.query.arquivo) {
      const item = lista.find((i) => i.arquivo?.id === req.query.arquivo);
      if (!item) throw new HttpError(404, 'Arquivo não encontrado.');
      const arquivo = await lerArquivo(item.arquivo.id);
      const pdf = arquivo.tipo === 'application/pdf';
      res.setHeader('Content-Type', arquivo.tipo);
      res.setHeader('Content-Disposition', `${pdf && !req.query.baixar ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.status(200).send(arquivo.conteudo);
    }
    return responder();
  }

  const assinatura = { nome: usuario.nome, email: usuario.email, admin, em: new Date().toISOString() };

  // Envio de arquivo do moodboard (PDF ou Word), novo ou substituindo o de um moodboard.
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
    exigirAdmin(usuario);
    if (tipo !== 'moodboard') throw new HttpError(400, 'Só o moodboard recebe arquivo.');
    const mime = String(req.query.mime || '');
    if (!ARQUIVOS[mime]) throw new HttpError(400, 'Envie o moodboard em PDF ou Word (.docx).');
    const conteudo = await lerCorpoBruto(req);
    if (!conteudo.length) throw new HttpError(400, 'Arquivo vazio.');
    if (conteudo.length > LIMITE) throw new HttpError(413, 'Arquivo acima de 4 MB. Exporte o PDF em qualidade menor ou mande como link do Drive/Canva.');
    const nome = texto(req.query.nome || 'moodboard', 150).replace(/[^\w.\- ()À-ú]/g, '_');
    const arquivo = { id: await salvarArquivo(clienteId, nome, mime, conteudo), nome, tipo: mime, tamanho: conteudo.length };
    const existente = req.query.id ? lista.find((i) => i.id === req.query.id) : null;
    if (req.query.id && !existente) throw new HttpError(404, 'Moodboard não encontrado.');
    if (existente) {
      if (existente.arquivo) await apagarArquivo(existente.arquivo.id);
      Object.assign(existente, { arquivo, url: '', status: 'aprovacao', statusPor: assinatura, versao: (existente.versao || 1) + 1 });
    } else {
      lista.push({ id: novoId('m'), ...camposMoodboard(req.query), arquivo, url: '', status: 'aprovacao', versao: 1, comentarios: [], criadoEm: assinatura.em, enviadoPor: usuario.nome });
    }
    await salvar();
    await avisarCliente(clienteId, { titulo: 'Tem moodboard para você aprovar! 🎬', corpo: existente ? `Versão nova: ${existente.titulo}` : `${texto(req.query.titulo, 80) || 'Roteiro da próxima produção'}`, url: `/#/c/${encodeURIComponent(clienteId)}/moodboard` });
    return responder();
  }

  const corpo = req.body || {};
  const item = corpo.id ? lista.find((i) => i.id === corpo.id) : null;
  const base = `/#/c/${encodeURIComponent(clienteId)}`;

  switch (corpo.acao) {
    case 'salvar': {
      exigirAdmin(usuario);
      const dados = corpo.item || {};
      const atual = dados.id ? lista.find((i) => i.id === dados.id) : null;
      if (dados.id && !atual) throw new HttpError(404, 'Item não encontrado.');
      const limpo = tipo === 'moodboard' ? camposMoodboard(dados) : tipo === 'sazonal' ? camposSazonal(dados) : camposProducao(dados);
      if (atual) {
        // Ação sazonal mudada depois de aprovada volta para aprovação.
        const mudou = tipo === 'sazonal' && (atual.acao !== limpo.acao || atual.data !== limpo.data) && atual.status !== 'aprovacao';
        Object.assign(atual, limpo, mudou ? { status: 'aprovacao', statusPor: assinatura } : {});
        if (tipo === 'producao' && atual.lembrete && atual.lembrete !== limpo.data) delete atual.lembrete;
      } else {
        lista.push({ id: novoId(tipo[0]), ...limpo, ...(tipo === 'producao' ? {} : { status: 'aprovacao', comentarios: [] }), criadoEm: assinatura.em });
        if (tipo === 'moodboard' && limpo.url) await avisarCliente(clienteId, { titulo: 'Tem moodboard para você aprovar! 🎬', corpo: limpo.titulo, url: `${base}/moodboard` });
      }
      break;
    }

    // Várias datas sazonais de uma vez (sugestões do ano).
    case 'adicionar-varios': {
      exigirAdmin(usuario);
      if (tipo !== 'sazonal') throw new HttpError(400, 'Só para o calendário sazonal.');
      const novos = (Array.isArray(corpo.itens) ? corpo.itens : []).slice(0, 60).map(camposSazonal)
        .filter((n) => !lista.some((i) => i.data === n.data && i.titulo === n.titulo));
      lista.push(...novos.map((n) => ({ id: novoId('s'), ...n, status: 'aprovacao', comentarios: [], criadoEm: assinatura.em })));
      break;
    }

    // A equipe avisa no celular do cliente quando o calendário está pronto para aprovar.
    case 'avisar-cliente': {
      exigirAdmin(usuario);
      const n = lista.filter((i) => i.status === 'aprovacao').length;
      if (!n) throw new HttpError(400, 'Não há nada esperando a aprovação do cliente.');
      const enviados = await avisarCliente(clienteId, tipo === 'sazonal'
        ? { titulo: 'Tem calendário sazonal para você aprovar! 🗓️', corpo: `${n} ${n === 1 ? 'data com ação de marketing' : 'datas com ações de marketing'} esperando a sua aprovação.`, url: `${base}/sazonal` }
        : { titulo: 'Tem moodboard para você aprovar! 🎬', corpo: `${n} ${n === 1 ? 'moodboard esperando' : 'moodboards esperando'} a sua aprovação.`, url: `${base}/moodboard` });
      res.setHeader('X-Avisados', String(enviados));
      break;
    }

    case 'excluir':
      exigirAdmin(usuario);
      if (!item) throw new HttpError(404, 'Item não encontrado.');
      if (item.arquivo) await apagarArquivo(item.arquivo.id);
      lista = lista.filter((i) => i.id !== item.id);
      break;

    // Cliente aprova ou pede alteração (a equipe também pode registrar).
    case 'status': {
      if (tipo === 'producao') throw new HttpError(400, 'Produções não passam por aprovação.');
      if (!item) throw new HttpError(404, 'Item não encontrado.');
      const status = admin ? corpo.status : STATUS_CLIENTE.includes(corpo.status) ? corpo.status : null;
      if (!['aprovacao', 'aprovado', 'ajuste'].includes(status)) throw new HttpError(400, 'Status inválido.');
      const comentario = String(corpo.comentario || '').trim();
      if (status === 'ajuste' && !admin && !comentario) throw new HttpError(400, 'Conte o que você gostaria de alterar.');
      item.status = status;
      item.statusPor = assinatura;
      if (comentario) item.comentarios = [...(item.comentarios || []), { id: novoId('c'), texto: texto(comentario, 2000), ...assinatura }];
      if (!admin) {
        const rotulo = `${TIPOS[tipo].nome === 'moodboard' ? 'o moodboard' : 'a data'} “${String(item.titulo).slice(0, 60)}”`;
        await avisarEquipe(status === 'aprovado'
          ? { titulo: `${cliente.nome} aprovou ✓`, corpo: `${usuario.nome} aprovou ${rotulo}.`, url: `${base}/${TIPOS[tipo].aba}` }
          : { titulo: `${cliente.nome} pediu alteração`, corpo: `${rotulo}: ${comentario.slice(0, 120)}`, url: `${base}/${TIPOS[tipo].aba}` }, clienteId);
      }
      break;
    }

    // "Aprovar tudo": tudo o que está esperando aprovação deste tipo.
    case 'aprovar-todos': {
      if (tipo === 'producao') throw new HttpError(400, 'Produções não passam por aprovação.');
      const pendentes = lista.filter((i) => i.status === 'aprovacao');
      pendentes.forEach((i) => { i.status = 'aprovado'; i.statusPor = assinatura; });
      if (pendentes.length && !admin) {
        await avisarEquipe({ titulo: `${cliente.nome} aprovou ✓`, corpo: `${usuario.nome} aprovou ${pendentes.length} ${tipo === 'moodboard' ? (pendentes.length === 1 ? 'moodboard' : 'moodboards') : (pendentes.length === 1 ? 'data do calendário sazonal' : 'datas do calendário sazonal')}.`, url: `${base}/${TIPOS[tipo].aba}` }, clienteId);
      }
      break;
    }

    case 'comentar': {
      if (!item) throw new HttpError(404, 'Item não encontrado.');
      if (!String(corpo.texto || '').trim()) throw new HttpError(400, 'Escreva o comentário.');
      item.comentarios = [...(item.comentarios || []), { id: novoId('c'), texto: texto(corpo.texto, 2000), ...assinatura }];
      const aviso = { titulo: admin ? 'A equipe respondeu' : `Comentário de ${cliente.nome}`, corpo: `${String(item.titulo).slice(0, 60)}: ${String(corpo.texto).slice(0, 120)}`, url: `${base}/${TIPOS[tipo].aba}` };
      await (admin ? avisarCliente(clienteId, aviso) : avisarEquipe(aviso, clienteId));
      break;
    }

    default:
      throw new HttpError(400, 'Ação desconhecida.');
  }
  await salvar();
  return responder();
});

function camposMoodboard(d) {
  const url = texto(d.url, 1000).trim();
  if (url && !/^https:\/\//i.test(url)) throw new HttpError(400, 'O link precisa começar com https://');
  if (!String(d.titulo || '').trim()) throw new HttpError(400, 'Dê um título para o moodboard.');
  return {
    titulo: texto(d.titulo, 200).trim(),
    descricao: texto(d.descricao, 3000),
    data: dataValida(d.data) ? d.data : '',
    ...(url ? { url } : {}),
  };
}

function camposSazonal(d) {
  if (!dataValida(d.data)) throw new HttpError(400, 'Informe a data.');
  if (!String(d.titulo || '').trim()) throw new HttpError(400, 'Informe o nome da data (ex.: Dia das Mães).');
  return {
    data: d.data,
    titulo: texto(d.titulo, 150).trim(),
    acao: texto(d.acao, 3000),
    notaInterna: texto(d.notaInterna, 1000),
  };
}

function camposProducao(d) {
  if (!dataValida(d.data)) throw new HttpError(400, 'Informe a data da produção.');
  return {
    data: d.data,
    hora: /^\d{2}:\d{2}$/.test(d.hora || '') ? d.hora : '',
    local: texto(d.local, 200),
    observacoes: texto(d.observacoes, 2000),
  };
}
