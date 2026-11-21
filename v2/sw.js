// Scope is the v2 directory, including on project Pages sites.
const cacheName = 'star-theatre-' + self.registration.scope + '-1';
const cdn = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(cacheName);
  await cache.addAll(['./','./index.html','./src/styles.css','./src/engine.js','./src/ui.js','./src/loader.js','./src/storage.js','./sample/scenario.json','./sample/dawn.svg',cdn]);
  await self.skipWaiting();
})()));
self.addEventListener('activate',event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(event.request)) || fetch(event.request)));
});
