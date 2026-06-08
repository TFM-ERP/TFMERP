/* TFM Production — service worker (app shell + offline navigation).
   Offline DATA is handled in-app via IndexedDB (see lib/offline-db.ts); this SW
   makes the app installable and keeps the shell available with no connection.
   It never caches non-GET requests, so offline writes always fall through to the queue. */
const CACHE = 'tfm-shell-v2';
const SHELL = ['/'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // never intercept writes
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api') || url.pathname.includes('/api/')) return; // API always hits network

  if (req.mode === 'navigate') {                          // pages: network-first → cached shell
    e.respondWith(fetch(req).catch(() => caches.match(req).then(r => r || caches.match('/'))));
    return;
  }

  // static assets: cache-first, populate on first fetch
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res.ok && (url.pathname.startsWith('/_next/') || /\.(css|js|png|jpe?g|svg|webp|woff2?)$/.test(url.pathname))) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => cached))
  );
});
