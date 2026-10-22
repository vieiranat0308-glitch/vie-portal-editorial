// Service worker do app (PWA): deixa o portal instalável e abre uma tela
// de "sem internet" quando o celular está offline.
// Tudo vem primeiro da rede, para cada atualização do portal chegar na hora;
// o que fica guardado só é usado sem conexão. A API nunca é guardada.
const VERSAO = 'vie-v2';
const ESSENCIAIS = ['/offline.html', '/img/logo-creme.png', '/img/app-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }
  e.respondWith(
    fetch(request)
      .then((resposta) => {
        if (resposta.ok) {
          const copia = resposta.clone();
          caches.open(VERSAO).then((c) => c.put(request, copia));
        }
        return resposta;
      })
      .catch(() => caches.match(request).then((r) => r || Response.error())),
  );
});

// Notificações push do portal (aprovações, lembretes de gravação…).
self.addEventListener('push', (e) => {
  let dados = {};
  try { dados = e.data ? e.data.json() : {}; } catch { dados = { corpo: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(dados.titulo || 'Vie Company', {
    body: dados.corpo || '',
    icon: '/img/app-192.png',
    badge: '/img/app-192.png',
    tag: dados.tag || undefined,
    data: { url: dados.url || '/' },
  }));
});

// Tocar na notificação abre (ou traz para frente) o portal na página certa.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL(e.notification.data?.url || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
    const aberta = janelas.find((j) => new URL(j.url).origin === self.location.origin);
    if (aberta) return aberta.focus().then(() => aberta.navigate(destino)).catch(() => self.clients.openWindow(destino));
    return self.clients.openWindow(destino);
  }));
});
