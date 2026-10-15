import { put, del, get } from '@vercel/blob';
import { getRedis, keys, novoId, HttpError } from './base.js';

// Arquivos entregues aos clientes (PDFs, imagens, cronogramas em HTML). Ficam no
// Vercel Blob e nunca são expostos direto: o download passa sempre pela API, que
// confere quem está pedindo. Sempre que o armazenamento permite, o arquivo é
// guardado como privado (sem link público nenhum).
//
// A Vercel conecta o Blob de dois jeitos: o antigo cria BLOB_READ_WRITE_TOKEN;
// o novo cria BLOB_STORE_ID e autentica sozinho (OIDC). A biblioteca aceita os dois.
const usaBlob = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

export async function salvarArquivo(clienteId, nome, tipo, conteudo) {
  const id = novoId('a');
  if (usaBlob()) {
    const caminho = `clientes/${clienteId}/${id}-${nome}`;
    const opcoes = { addRandomSuffix: true, contentType: tipo };
    let blob;
    let access = 'private';
    try {
      blob = await put(caminho, conteudo, { ...opcoes, access });
    } catch (errPrivado) {
      // Armazenamentos públicos não aceitam arquivos privados: guarda como público,
      // com endereço impossível de adivinhar e sem nunca entregar o link ao navegador.
      access = 'public';
      try {
        blob = await put(caminho, conteudo, { ...opcoes, access });
      } catch (errPublico) {
        console.error('Blob privado:', errPrivado.message, '| Blob público:', errPublico.message);
        throw new HttpError(500, `Não foi possível guardar o arquivo: ${errPublico.message}`);
      }
    }
    await getRedis().set(keys.arquivo(id), { url: blob.url, tipo, nome, access, clienteId });
  } else if (process.env.DEV_MEMORIA === '1') {
    await getRedis().set(keys.arquivo(id), { base64: conteudo.toString('base64'), tipo, nome, clienteId });
  } else {
    throw new HttpError(500, 'Armazenamento de arquivos não conectado. Na Vercel, vá em Storage e crie um Blob para este projeto.');
  }
  return id;
}

export async function lerArquivo(id) {
  const info = await getRedis().get(keys.arquivo(id));
  if (!info) throw new HttpError(404, 'Arquivo não encontrado.');
  if (info.base64) return { ...info, conteudo: Buffer.from(info.base64, 'base64') };
  if (info.access === 'private') {
    const resultado = await get(info.url, { access: 'private' });
    if (!resultado?.stream) throw new HttpError(404, 'Arquivo não encontrado.');
    return { ...info, conteudo: Buffer.from(await new Response(resultado.stream).arrayBuffer()) };
  }
  const resposta = await fetch(info.url);
  if (!resposta.ok) throw new HttpError(502, 'Não foi possível abrir o arquivo agora.');
  return { ...info, conteudo: Buffer.from(await resposta.arrayBuffer()) };
}

export async function apagarArquivo(id) {
  const info = await getRedis().get(keys.arquivo(id));
  if (info?.url && usaBlob()) await del(info.url).catch(() => {});
  await getRedis().del(keys.arquivo(id));
}
