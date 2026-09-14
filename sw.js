const CACHE_NAME = 'qaime-v4';
const ASSETS = [
  './',
  './index.html',
  './offline.html',
  './style.css',
  './app.js',
  './firebase.js',
  './manifest.json',
  './favicon.png',
  './html2canvas.min.js'
];

// Quraşdırılma zamanı əsas faylları keşə yığır
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Aktivləşəndə köhnə keşləri təmizləyir
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Sorğuları idarə edir
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./offline.html');
        }
      });
    })
  );
});