// Servidor local para testar o portal sem a Vercel: `npm run dev`.
// Usa o banco em memória e uma conta de admin de teste (dados somem ao reiniciar).
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const porta = Number(process.env.PORT || 3000);
process.env.ADMIN_EMAIL ||= 'admin@vie.local';
process.env.ADMIN_PASSWORD ||= 'vie12345';
process.env.ADMIN_NOME ||= 'Natalia';

const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${porta}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const nome = url.pathname.slice(5).replace(/[^\w-]/g, '');
      const { default: fn } = await import(pathToFileURL(path.join(raiz, 'api', `${nome}.js`)).href);
      const partes = [];
      for await (const p of req) partes.push(p);
      const bruto = Buffer.concat(partes);
      req.query = Object.fromEntries(url.searchParams);
      const tipo = req.headers['content-type'] || '';
      req.body = tipo.startsWith('application/json') && bruto.length ? JSON.parse(bruto) : tipo.startsWith('application/octet-stream') ? bruto : undefined;
      res.status = (s) => { res.statusCode = s; return res; };
      res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
      res.send = (b) => res.end(b);
      return await fn(req, res);
    }
    const arquivo = path.join(raiz, 'public', path.normalize(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!arquivo.startsWith(path.join(raiz, 'public'))) throw new Error('fora');
    const conteudo = await fs.readFile(arquivo);
    res.setHeader('Content-Type', tipos[path.extname(arquivo)] || 'application/octet-stream');
    res.end(conteudo);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(err);
    res.statusCode = 404;
    res.end('Não encontrado');
  }
}).listen(porta, () => {
  console.log(`Portal em http://localhost:${porta}  ·  login: ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASSWORD}`);
});
