/* CABO PWA: cache versioned static assets only. Do not cache API, auth, exam submissions or HTML. */
const CACHE = 'cabo-static-v1';
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('cabo-static-') && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') ||
      req.mode === 'navigate' || req.destination === 'document') return;
  // Never cache dynamic user-uploaded images or authenticated content.\n  if (!url.pathname.startsWith('/assets/') && !url.pathname.startsWith('/icons/') && url.pathname !== '/favicon.svg') return;\n  if (!['script', 'style', 'font', 'image'].includes(req.destination)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(req);
      if (response.ok && response.type === 'basic' && !response.headers.has('set-cookie')) {
        await cache.put(req, response.clone());
      }
      return response;
    } catch (err) {
      const fallback = await cache.match(req);
      if (fallback) return fallback;
      throw err;
    }
  })());
});
