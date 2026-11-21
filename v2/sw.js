// Scope is the v2 directory, including on project Pages sites.
const cachePrefix = 'star-theatre-' + self.registration.scope + '-';
const cacheName = cachePrefix + '2';
const cdn = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(cacheName);
  await cache.addAll(['./','./index.html','./src/styles.css','./src/engine.js','./src/ui.js','./src/loader.js','./src/storage.js','./sample/scenario.json','./sample/dawn.svg',cdn]);
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  // A nested Pages scope may share this origin and have its own player.
  const stale = (await caches.keys()).filter(name =>
    name.startsWith(cachePrefix) && /^\d+$/.test(name.slice(cachePrefix.length)) && name !== cacheName);
  await Promise.all(stale.map(name => caches.delete(name)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(event.request)) || fetch(event.request)));
});
