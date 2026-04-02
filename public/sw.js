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
  '/fonts/commitmono/CommitMono-200-Regular.woff2',
  '/fonts/commitmono/CommitMono-250-Regular.woff2',
  '/fonts/commitmono/CommitMono-300-Regular.woff2',
];

/**
 * Check if a request URL points to a font file.
 * Fonts are immutable and safe to serve cache-first forever.
 * @param {string} url
 * @returns {boolean}
 */
function isFontRequest(url) {
  return new URL(url).pathname.endsWith('.woff2');
}

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

  if (isFontRequest(event.request.url)) {
    // Cache-first for fonts — immutable assets that never change between deploys.
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for app code (HTML, JS, CSS, icons, manifest).
  // Always fetch fresh content when online; fall back to cache when offline.
  // { cache: 'no-cache' } ensures the browser revalidates with the server
  // rather than serving a stale response from the HTTP cache.
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' }).then((response) => {
      if (response.ok) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() =>
      caches.match(event.request).then((cached) =>
        cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
      )
    )
  );
});
