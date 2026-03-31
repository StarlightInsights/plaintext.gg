var sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

/** @type {string} */
const CACHE_NAME = 'plaintext-v1';

/** @type {string[]} */
const PRECACHE_URLS = [
  '/',
  '/app.css',
  '/app.js',
  '/shared.js',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/fonts/CommitMono-200-Regular.woff2',
  '/fonts/CommitMono-250-Regular.woff2',
  '/fonts/CommitMono-300-Regular.woff2',
];

sw.addEventListener('install', /** @param {ExtendableEvent} event */ (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  sw.skipWaiting();
});

sw.addEventListener('activate', /** @param {ExtendableEvent} event */ (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  sw.clients.claim();
});

sw.addEventListener('fetch', /** @param {FetchEvent} event */ (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
      return cached || network;
    })
  );
});
