import { put, del } from '@vercel/blob';
import { getRedis, keys, novoId, HttpError } from './base.js';

// Arquivos entregues aos clientes (PDFs, imagens). Ficam no Vercel Blob com um
// endereço impossível de adivinhar e nunca são expostos direto: o download
// passa sempre pela API, que confere quem está pedindo.
const usaBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export async function salvarArquivo(clienteId, nome, tipo, conteudo) {
  const id = novoId('a');
  if (usaBlob()) {
    const blob = await put(`clientes/${clienteId}/${id}-${nome}`, conteudo, {
      access: 'public',
      addRandomSuffix: true,
      contentType: tipo,
    });
    await getRedis().set(keys.arquivo(id), { url: blob.url, tipo, nome });
  } else if (process.env.DEV_MEMORIA === '1') {
    await getRedis().set(keys.arquivo(id), { base64: conteudo.toString('base64'), tipo, nome });
  } else {
    throw new HttpError(500, 'Armazenamento de arquivos não conectado. Na Vercel, vá em Storage e crie um Blob para este projeto.');
  }
  return id;
}

export async function lerArquivo(id) {
  const info = await getRedis().get(keys.arquivo(id));
  if (!info) throw new HttpError(404, 'Arquivo não encontrado.');
  if (info.base64) return { ...info, conteudo: Buffer.from(info.base64, 'base64') };
  const resposta = await fetch(info.url);
  if (!resposta.ok) throw new HttpError(502, 'Não foi possível abrir o arquivo agora.');
  return { ...info, conteudo: Buffer.from(await resposta.arrayBuffer()) };
}

export async function apagarArquivo(id) {
  const info = await getRedis().get(keys.arquivo(id));
  if (info?.url && usaBlob()) await del(info.url).catch(() => {});
  await getRedis().del(keys.arquivo(id));
}
