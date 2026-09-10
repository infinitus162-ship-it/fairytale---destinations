const CACHE_NAME = 'storybook-atlas-v2';
// Change CACHE_NAME when publishing an update. All paths are subfolder-safe.
const APP_FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const SCOPE = new URL('./', self.location.href).href;
const CACHE_PREFIX = 'storybook-atlas-';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Leave server APIs and unrelated requests untouched. All app data is local.
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(SCOPE) || url.pathname.includes('/api/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        event.waitUntil(cache.put(request, response.clone()));
      }
      return response;
    } catch (error) {
      if (request.mode === 'navigate') {
        const page = await cache.match(new URL('./index.html', SCOPE).href);
        if (page) return page;
      }
      return new Response('This resource is not available offline.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
