/* Cache public app files only. Learner records, uploads and submissions stay online. */
const CACHE = 'cabo-static-v2';
const OFFLINE = '/offline.html';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([OFFLINE, '/favicon.svg', '/icons/cabo-180.png', '/icons/cabo-192.png', '/icons/cabo-512.png']);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('cabo-static-') && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    // Never save authenticated HTML. Show a public reconnect page on network failure.
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }
  const publicFile = /^\/assets\/[^/]+-[a-zA-Z0-9_-]+\.(js|css|woff2?)$/.test(url.pathname) ||
    /^\/icons\/cabo-(180|192|512)\.png$/.test(url.pathname) || url.pathname === '/favicon.svg';
  if (!publicFile || url.search || !['script', 'style', 'font', 'image'].includes(req.destination)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(req);
      if (response.ok && response.type === 'basic' && !response.headers.has('set-cookie') && !/no-store|private/i.test(response.headers.get('cache-control') || '')) {
        await cache.put(req, response.clone());
      }
      return response;
    } catch (error) {
      const fallback = await cache.match(req);
      if (fallback) return fallback;
      throw error;
    }
  })());
});
