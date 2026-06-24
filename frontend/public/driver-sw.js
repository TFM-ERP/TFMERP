/* TFM Driver PWA — minimal offline service worker (scope: /driver/ only).
 * App-shell + static-asset caching so a previously-loaded run screen opens offline.
 * Deliberately NEVER caches the API or POSTs — live data and the offline outbox
 * (localStorage, handled in the app) must pass straight through.
 * Separate from the production /sw.js; longest-scope match means this one wins for /driver/*. */
const CACHE = 'tfm-driver-v1';
const SHELL = '/driver/dispatch';
const PRECACHE = [SHELL, '/driver-manifest.webmanifest', '/icons/driver-192.png', '/icons/driver-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // writes (run actions, receipts) bypass the SW entirely → offline outbox
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch the API (different origin) or any cross-origin
  if (url.pathname.startsWith('/api')) return; // belt-and-suspenders if API is ever same-origin

  // App navigations: network-first (fresh runs), fall back to cache, then the dispatch shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match(SHELL))),
    );
    return;
  }

  // Static assets + icons + manifest: stale-while-revalidate.
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons') || url.pathname === '/driver-manifest.webmanifest') {
    event.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; }).catch(() => cached);
        return cached || net;
      }),
    );
  }
});
