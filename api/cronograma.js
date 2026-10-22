import {
  handler, metodo, exigirAdmin, exigirAcessoCliente, HttpError, getRedis, keys, texto, mesValido, novoId, lerCorpoBruto,
} from '../lib/base.js';
import { salvarArquivo, lerArquivo, apagarArquivo } from '../lib/arquivos.js';
import { lerCronogramaHtml, SCRIPT_PONTE, VERSAO_LEITURA } from '../lib/cronograma-html.js';
import { lerConteudosDoDrive, idDaPasta, ErroDrive } from '../lib/drive.js';
import { FORMATOS, STATUS, STATUS_DO_CLIENTE, gerarEsqueleto } from '../public/js/regras.js';

// Cronograma mensal: cada mês é um documento com os conteúdos (feed e stories).
// O cliente só enxerga o mês depois que a Vie publica.
// O mês também pode ter um "cronograma interativo": um arquivo HTML pronto,
// feito pela equipe, que aparece dentro do portal.
// Na Gestão de Instagram o mês tem duas trilhas: o cronograma da Vie (o que a
// equipe produz e publica) e o do cliente (o que ele grava e posta). Cada uma
// pode ter o próprio HTML; os posts guardam a trilha em `trilha`.
export const TRILHAS = {
  cliente: { arquivo: 'interativo', leitura: 'leituraHtml', prefixo: '', drive: 'drive' },
  vie: { arquivo: 'interativoVie', leitura: 'leituraHtmlVie', prefixo: 'vie:', drive: 'driveVie' },
};
const trilhaDe = (v) => (v === 'vie' ? 'vie' : 'cliente');
const naTrilha = (p, trilha) => (p.trilha === 'vie' ? 'vie' : 'cliente') === trilha;
export const temInterativo = (d) => !!(d?.interativo || d?.interativoVie);

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
      .map((d) => ({
        mes: d.mes,
        status: d.status,
        total: d.posts.length,
        porStatus: contar(d.posts),
        interativo: temInterativo(d),
        aprovacaoMes: temInterativo(d) ? d.aprovacaoMes?.status || 'aguardando' : null,
      }));
    return res.status(200).json(lista);
  }

  const mes = mesValido(req.query.mes);
  const chave = keys.cronograma(clienteId, mes);
  const doc = (await redis.get(chave)) || { mes, status: 'rascunho', foco: '', observacoes: '', posts: [] };
  const trilha = trilhaDe(req.query.trilha || (req.query.interativo ? '' : req.body?.trilha));
  const { arquivo: campoArquivo, leitura: campoLeitura, drive: campoDrive } = TRILHAS[trilha];

  if (req.method === 'GET' && req.query.interativo) {
    if (!admin && doc.status !== 'publicado') throw new HttpError(403, 'Este cronograma ainda não foi liberado.');
    if (!doc[campoArquivo]) throw new HttpError(404, 'Este mês não tem cronograma interativo.');
    const arquivo = await lerArquivo(doc[campoArquivo].arquivoId);
    let html = arquivo.conteudo;
    // Dentro do portal, liga as caixinhas Feito/Publicado/Usada do HTML ao andamento salvo.
    if (req.query.portal) {
      const t = html.toString('utf8');
      const fim = t.search(/<\/body>/i);
      html = Buffer.from(fim >= 0 ? t.slice(0, fim) + SCRIPT_PONTE + t.slice(fim) : t + SCRIPT_PONTE, 'utf8');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // O HTML roda isolado do portal: não acessa a sessão nem os dados de ninguém,
    // mesmo se for aberto direto numa aba.
    res.setHeader('Content-Security-Policy', 'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-downloads');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(html);
  }

  if (req.method === 'POST' && req.query.interativo) {
    exigirAdmin(usuario);
    const conteudo = await lerCorpoBruto(req);
    if (!conteudo.length) throw new HttpError(400, 'Arquivo vazio.');
    if (conteudo.length > 4 * 1024 * 1024) throw new HttpError(413, 'Arquivo acima de 4 MB. Deixe as imagens fora do HTML (com links) ou comprima-as.');
    if (!/<html|<!doctype html|<body|<div/i.test(conteudo.subarray(0, 5000).toString('utf8'))) {
      throw new HttpError(400, 'Envie o arquivo .html do cronograma.');
    }
    const nome = texto(req.query.nome || 'cronograma.html', 150).replace(/[^\w.\- ()À-ú]/g, '_');
    const arquivoId = await salvarArquivo(clienteId, nome, 'text/html', conteudo);
    if (doc[campoArquivo]) await apagarArquivo(doc[campoArquivo].arquivoId);
    doc[campoArquivo] = { arquivoId, nome, tamanho: conteudo.length, enviadoEm: new Date().toISOString(), enviadoPor: usuario.nome };
    doc.aprovacaoMes = null; // versão nova volta a esperar a aprovação do cliente
    const editorial = await redis.get(keys.editorial(clienteId));
    aplicarLeitura(doc, lerCronogramaHtml(conteudo.toString('utf8'), mes), editorial?.pilares || [], doc[campoArquivo].enviadoEm, trilha);
    doc.atualizadoEm = doc[campoArquivo].enviadoEm;
    await redis.set(chave, doc);
    await redis.sadd(keys.meses(clienteId), mes);
    return res.status(200).json(doc);
  }

  if (req.method === 'GET') {
    await garantirLeitura(clienteId, doc);
    await atualizarDoDrive(clienteId, doc);
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
        // Num HTML a aprovação é do mês inteiro; os demais conteúdos vão para aprovação um a um.
        doc.posts.forEach((p) => { if (p.status === 'pauta' && p.origem !== 'html') p.status = 'aprovacao'; });
      }
      break;

    case 'salvar-post': {
      exigirAdmin(usuario);
      const limpo = limparPost(corpo.post || {}, mes, trilha);
      salvoId = limpo.id;
      const i = doc.posts.findIndex((p) => p.id === limpo.id);
      if (i >= 0) {
        const anterior = doc.posts[i];
        // Editar um conteúdo lido do HTML mantém a ligação com a caixinha dele.
        const doHtml = Object.fromEntries(['chaveHtml', 'marcaHtml', 'chaveDrive', 'midia', 'origem'].filter((k) => anterior[k]).map((k) => [k, anterior[k]]));
        doc.posts[i] = { ...limpo, ...doHtml, comentarios: anterior.comentarios || [], statusPor: anterior.status === limpo.status ? anterior.statusPor : undefined };
      }
      else doc.posts.push({ ...limpo, comentarios: [] });
      break;
    }

    // Lê de novo os posts do cronograma em HTML que já está salvo.
    case 'ler-html': {
      exigirAdmin(usuario);
      if (!doc[campoArquivo]) throw new HttpError(400, 'Suba o cronograma em HTML antes.');
      const [arquivo, editorial] = await Promise.all([lerArquivo(doc[campoArquivo].arquivoId), redis.get(keys.editorial(clienteId))]);
      aplicarLeitura(doc, lerCronogramaHtml(arquivo.conteudo.toString('utf8'), mes), editorial?.pilares || [], assinatura.em, trilha);
      break;
    }

    // Caixinha Feito/Publicado/Usada marcada dentro do cronograma em HTML.
    case 'marcar-html': {
      if (!admin && doc.status !== 'publicado') throw new HttpError(403, 'Este cronograma ainda não foi liberado.');
      const bruta = texto(corpo.chave, 40);
      if (!/^[\w-]+$/.test(bruta)) throw new HttpError(400, 'Caixinha inválida.');
      const chave = TRILHAS[trilha].prefixo + bruta;
      // O cronograma da Vie é marcado pela equipe, que é quem publica.
      if (trilha === 'vie' && !admin) throw new HttpError(403, 'Este cronograma é marcado pela equipe Vie.');
      doc.marcasHtml = { ...(doc.marcasHtml || {}), [chave]: !!corpo.feito };
      const alvo = doc.posts.find((p) => p.chaveHtml === chave);
      if (alvo) {
        // Nos roteiros de gravação o botão marca "gravado"; no cronograma, "postado".
        const feito = statusDaMarca(alvo);
        const jaFeito = feito === 'gravado' ? ['gravado', 'postado'] : ['postado'];
        if (corpo.feito && !jaFeito.includes(alvo.status)) { alvo.status = feito; alvo.statusPor = assinatura; }
        if (!corpo.feito && alvo.status === feito) {
          alvo.status = doc.aprovacaoMes?.status === 'aprovado' ? 'aprovado' : 'pauta';
          alvo.statusPor = assinatura;
        }
      }
      break;
    }

    // Conteúdo pronto da Vie lido das pastas do Google Drive.
    case 'drive-ligar':
    case 'drive-atualizar': {
      exigirAdmin(usuario);
      const pasta = corpo.acao === 'drive-ligar' ? texto(corpo.pasta, 500).trim() : doc[campoDrive]?.pasta;
      if (!idDaPasta(pasta)) throw new HttpError(400, 'Cole o link de uma pasta do Google Drive (drive.google.com/drive/folders/…).');
      await lerDoDrive(doc, clienteId, trilha, pasta);
      break;
    }

    case 'drive-remover':
      exigirAdmin(usuario);
      // Os conteúdos (e as aprovações) continuam; só deixa de ler a pasta.
      delete doc[campoDrive];
      break;

    case 'remover-interativo':
      exigirAdmin(usuario);
      if (doc[campoArquivo]) await apagarArquivo(doc[campoArquivo].arquivoId);
      delete doc[campoArquivo];
      delete doc[campoLeitura];
      if (!temInterativo(doc)) doc.aprovacaoMes = null;
      break;

    // Aprovação do mês inteiro (usada no cronograma interativo).
    case 'aprovar-mes':
    case 'ajuste-mes': {
      if (!admin && doc.status !== 'publicado') throw new HttpError(403, 'Este cronograma ainda não foi liberado.');
      const comentario = String(corpo.comentario || '').trim();
      if (corpo.acao === 'ajuste-mes' && !comentario) throw new HttpError(400, 'Conte o que você gostaria de ajustar.');
      doc.aprovacaoMes = { status: corpo.acao === 'aprovar-mes' ? 'aprovado' : 'ajuste', ...assinatura };
      // Aprovar o cronograma aprova junto os conteúdos que ainda estavam esperando.
      if (corpo.acao === 'aprovar-mes') {
        doc.posts.forEach((p) => {
          if (['pauta', 'aprovacao'].includes(p.status)) { p.status = 'aprovado'; p.statusPor = assinatura; }
        });
      }
      if (comentario) doc.conversa = [...(doc.conversa || []), { id: novoId('c'), texto: texto(comentario, 2000), ...assinatura }];
      break;
    }

    case 'comentar-mes': {
      if (!admin && doc.status !== 'publicado') throw new HttpError(403, 'Este cronograma ainda não foi liberado.');
      if (!String(corpo.texto || '').trim()) throw new HttpError(400, 'Escreva o comentário.');
      doc.conversa = [...(doc.conversa || []), { id: novoId('c'), texto: texto(corpo.texto, 2000), ...assinatura }];
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
        datasOcupadas: doc.posts.filter((p) => naTrilha(p, trilha)).map((p) => `${p.data}|${p.formato}`),
      });
      doc.posts.push(...novos.map((p) => ({ ...p, ...(trilha === 'vie' ? { trilha } : {}), comentarios: [] })));
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
        // No cronograma da Vie quem grava e publica é a equipe; o cliente só aprova ou pede ajuste.
        if (post.trilha === 'vie' && ['gravado', 'postado'].includes(corpo.status)) throw new HttpError(403, 'Este conteúdo é publicado pela equipe Vie.');
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

// HTML enviado antes de a leitura entender o modelo dele: lê de novo e salva, uma vez só.
export async function garantirLeitura(clienteId, doc) {
  const pendentes = Object.entries(TRILHAS).filter(([, t]) => doc?.[t.arquivo] && doc[t.leitura]?.versao !== VERSAO_LEITURA);
  if (!pendentes.length) return doc;
  const redis = getRedis();
  const editorial = await redis.get(keys.editorial(clienteId));
  for (const [trilha, t] of pendentes) {
    try {
      const arquivo = await lerArquivo(doc[t.arquivo].arquivoId);
      aplicarLeitura(doc, lerCronogramaHtml(arquivo.conteudo.toString('utf8'), doc.mes), editorial?.pilares || [], new Date().toISOString(), trilha, { manterManuais: true });
    } catch (err) {
      console.error('Releitura do cronograma falhou', clienteId, doc.mes, trilha, err.message);
      return doc;
    }
  }
  await redis.set(keys.cronograma(clienteId, doc.mes), doc);
  return doc;
}

async function lerDoDrive(doc, clienteId, trilha, pasta) {
  let lido;
  try {
    lido = await lerConteudosDoDrive(idDaPasta(pasta), doc.mes);
  } catch (err) {
    throw new HttpError(err instanceof ErroDrive ? 400 : 502, err instanceof ErroDrive ? err.message : 'Não consegui ler a pasta do Drive agora. Tente de novo em instantes.');
  }
  if (!lido.posts.length) {
    throw new HttpError(400, lido.arquivos
      ? 'Encontrei arquivos, mas nenhum com data. Organize em subpastas com a data do post (ex.: 22.10) ou ponha a data no nome do arquivo.'
      : 'Não encontrei artes nem vídeos nessa pasta. Confira se é a pasta do mês e se ela está compartilhada como “Qualquer pessoa com o link”.');
  }
  aplicarDrive(doc, lido.posts, new Date().toISOString(), trilha, pasta);
}

// Quem abre o mês vê o que entrou no Drive depois (no máximo a cada 10 minutos).
async function atualizarDoDrive(clienteId, doc) {
  let mudou = false;
  for (const [trilha, t] of Object.entries(TRILHAS)) {
    const d = doc[t.drive];
    if (!d?.pasta || Date.now() - new Date(d.verificadoEm || d.lidaEm || 0).getTime() < 10 * 60 * 1000) continue;
    try {
      await lerDoDrive(doc, clienteId, trilha, d.pasta);
      mudou = true;
    } catch (err) {
      doc[t.drive] = { ...d, verificadoEm: new Date().toISOString(), erro: err.message };
      mudou = true;
    }
  }
  if (mudou) await getRedis().set(keys.cronograma(clienteId, doc.mes), doc);
}

// Troca os conteúdos do Drive nesta trilha, mantendo andamento e comentários de cada um.
// Arte trocada no Drive (depois de um ajuste, por exemplo) volta para aprovação.
function aplicarDrive(doc, lidos, quando, trilha, pasta) {
  const doDrive = (p) => naTrilha(p, trilha) && (p.origem === 'drive' || p.origem === 'planilha');
  const anteriores = new Map(doc.posts.filter(doDrive).map((p) => [p.chaveDrive || p.chavePlanilha, p]));
  const doMes = lidos.filter((p) => p.data.startsWith(`${doc.mes}-`));
  const publicado = doc.status === 'publicado';
  doc.posts = doc.posts.filter((p) => !doDrive(p)).concat(doMes.map((p) => {
    const antes = anteriores.get(p.chave);
    const midia = (p.midia || []).filter((m) => /^[\w-]{10,100}$/.test(m.id || '')).slice(0, 30)
      .map((m) => ({ id: m.id, tipo: ['imagem', 'video'].includes(m.tipo) ? m.tipo : 'imagem', nome: texto(m.nome, 150) }));
    const trocouArte = antes && (antes.midia || []).map((m) => m.id).join() !== midia.map((m) => m.id).join();
    let status = antes?.status || (publicado ? 'aprovacao' : 'pauta');
    if (trocouArte && ['aprovado', 'ajuste'].includes(status)) status = publicado ? 'aprovacao' : 'pauta';
    return {
      id: antes?.id || novoId('p'),
      chaveDrive: p.chave,
      data: p.data,
      horario: antes?.horario || '',
      formato: FORMATOS[p.formato] ? p.formato : 'reel',
      pilarId: antes?.pilarId || null,
      titulo: texto(p.titulo, 300),
      gancho: '',
      roteiro: '',
      legenda: texto(p.legenda, 5000),
      referencias: [],
      midia,
      notaInterna: antes?.origem === 'drive' ? antes.notaInterna || '' : '',
      status,
      statusPor: status === antes?.status ? antes?.statusPor : undefined,
      comentarios: antes?.comentarios || [],
      ideiaId: null,
      origem: 'drive',
      ...(trilha === 'vie' ? { trilha } : {}),
    };
  }));
  doc.posts.sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario));
  const outrosMeses = [...new Set(lidos.map((p) => p.data.slice(0, 7)).filter((m) => m !== doc.mes))].sort();
  doc[TRILHAS[trilha].drive] = { pasta, lidaEm: quando, verificadoEm: quando, total: doMes.length, foraDoMes: lidos.length - doMes.length, outrosMeses };
  delete doc[trilha === 'vie' ? 'planilhaVie' : 'planilha']; // a planilha deixou de ser usada
}

const statusDaMarca = (p) => (p.marcaHtml === 'gravado' ? 'gravado' : 'postado');

function contar(posts) {
  const total = {};
  posts.forEach((p) => { total[p.status] = (total[p.status] || 0) + 1; });
  return total;
}

function paraCliente(doc) {
  return { ...doc, posts: doc.posts.map(({ notaInterna, ...p }) => p) };
}

function limparPost(p, mes, trilha) {
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
    ...(trilha === 'vie' ? { trilha } : {}),
  };
}

// Troca os conteúdos da trilha pelos lidos do HTML, mantendo o andamento já marcado.
// Os conteúdos da outra trilha ficam como estão.
// `manterManuais`: na releitura automática, o que a equipe criou no portal continua.
function aplicarLeitura(doc, lidos, pilares, quando, trilha = 'cliente', { manterManuais = false } = {}) {
  const anoMes = doc.mes;
  const { prefixo, leitura } = TRILHAS[trilha];
  const normal = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const pilarPorNome = new Map(pilares.map((p) => [normal(p.nome), p.id]));
  // A leitura do HTML nunca mexe nos conteúdos que vieram do Drive.
  const fica = (p) => !naTrilha(p, trilha) || ['drive', 'planilha'].includes(p.origem) || (manterManuais && p.origem !== 'html');
  const daTrilha = doc.posts.filter((p) => !fica(p));
  const outros = doc.posts.filter(fica);
  const anteriores = new Map(daTrilha.map((p) => [p.chaveHtml || `${p.data}|${p.formato}`, p]));
  const aprovado = doc.aprovacaoMes?.status === 'aprovado';
  const marcas = doc.marcasHtml || {};
  const doMes = lidos.filter((p) => p.data.startsWith(`${anoMes}-`)).map((p) => ({ ...p, chaveHtml: prefixo + p.chaveHtml }));
  doc.posts = outros.concat(doMes.map((p) => {
    const antes = anteriores.get(p.chaveHtml) || anteriores.get(`${p.data}|${p.formato}`);
    // O andamento já marcado (aprovado, gravado, postado) continua valendo na versão nova.
    const manter = antes && ['aprovado', 'gravado', 'postado'].includes(antes.status);
    let status = manter ? antes.status : (aprovado ? 'aprovado' : 'pauta');
    if (marcas[p.chaveHtml] && !(p.marca === 'gravado' && status === 'postado')) status = p.marca === 'gravado' ? 'gravado' : 'postado';
    return {
      id: antes?.id || novoId('p'),
      chaveHtml: p.chaveHtml,
      data: p.data,
      horario: texto(p.horario, 40),
      formato: FORMATOS[p.formato] ? p.formato : 'reel',
      pilarId: pilarPorNome.get(normal(p.pilar)) || null,
      titulo: texto(p.titulo, 300),
      gancho: texto(p.gancho, 2000),
      roteiro: texto(p.roteiro, 10000),
      legenda: texto(p.legenda, 5000),
      referencias: (p.referencias || []).slice(0, 20).map((r) => ({ rotulo: texto(r.rotulo, 80), url: texto(r.url, 1000) })),
      notaInterna: antes?.notaInterna || '',
      status,
      statusPor: status === antes?.status ? antes?.statusPor : undefined,
      comentarios: antes?.comentarios || [],
      ideiaId: null,
      origem: 'html',
      ...(p.marca ? { marcaHtml: p.marca } : {}),
      ...(trilha === 'vie' ? { trilha } : {}),
    };
  }));
  doc.posts.sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario));
  // Arquivo que passa da virada do mês: avisa quais meses precisam do mesmo arquivo.
  const outrosMeses = [...new Set(lidos.map((p) => p.data.slice(0, 7)).filter((m) => m !== anoMes))].sort();
  doc[leitura] = { em: quando, total: doMes.length, foraDoMes: lidos.length - doMes.length, outrosMeses, versao: VERSAO_LEITURA };
}
