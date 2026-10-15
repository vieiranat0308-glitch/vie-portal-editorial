// Imitação mínima do cliente Upstash Redis, só para rodar o portal no computador
// (npm run dev). Guarda tudo em memória: os dados somem ao reiniciar.
export function bancoEmMemoria() {
  const dados = new Map();
  const expira = new Map();
  const copia = (v) => (v === undefined || v === null ? null : structuredClone(v));

  function vivo(chave) {
    const t = expira.get(chave);
    if (t && t < Date.now()) {
      dados.delete(chave);
      expira.delete(chave);
    }
    return dados.has(chave);
  }

  return {
    async get(k) { return vivo(k) ? copia(dados.get(k)) : null; },
    async set(k, v, opts = {}) {
      dados.set(k, copia(v));
      if (opts.ex) expira.set(k, Date.now() + opts.ex * 1000); else expira.delete(k);
      return 'OK';
    },
    async del(...ks) { ks.flat().forEach((k) => { dados.delete(k); expira.delete(k); }); return ks.length; },
    async incr(k) { const n = (vivo(k) ? dados.get(k) : 0) + 1; dados.set(k, n); return n; },
    async expire(k, s) { expira.set(k, Date.now() + s * 1000); return 1; },
    async hget(k, f) { return vivo(k) ? copia(dados.get(k)[f]) : null; },
    async hset(k, obj) {
      const h = vivo(k) ? dados.get(k) : {};
      Object.entries(obj).forEach(([f, v]) => { h[f] = copia(v); });
      dados.set(k, h);
      return Object.keys(obj).length;
    },
    async hdel(k, ...fs) { if (vivo(k)) fs.flat().forEach((f) => delete dados.get(k)[f]); return fs.length; },
    async hgetall(k) {
      if (!vivo(k) || !Object.keys(dados.get(k)).length) return null;
      return copia(dados.get(k));
    },
    async sadd(k, ...ms) { const s = new Set(vivo(k) ? dados.get(k) : []); ms.flat().forEach((m) => s.add(m)); dados.set(k, [...s]); return 1; },
    async srem(k, ...ms) { if (vivo(k)) dados.set(k, dados.get(k).filter((m) => !ms.flat().includes(m))); return 1; },
    async smembers(k) { return vivo(k) ? [...dados.get(k)] : []; },
  };
}
