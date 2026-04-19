var sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

/** @type {string} */
const CACHE_NAME = 'plaintext-v1';

/** @type {string[]} */
const PRECACHE_URLS = [
  '/',
  '/app.css',
  '/app.js',
  '/shared.js',
  '/theme-init.js',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  // Default font family (CommitMono) — all six variants reachable through the
  // weight + italic toolbar toggles. Precaching them means every toggle works
  // offline on first load, not just after the variant has been fetched once.
  '/fonts/commitmono/CommitMono-200-Regular.woff2',
  '/fonts/commitmono/CommitMono-200-Italic.woff2',
  '/fonts/commitmono/CommitMono-250-Regular.woff2',
  '/fonts/commitmono/CommitMono-300-Regular.woff2',
  '/fonts/commitmono/CommitMono-300-Italic.woff2',
  '/fonts/commitmono/CommitMono-600-Regular.woff2',
  '/fonts/commitmono/CommitMono-600-Italic.woff2',
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

/**
 * Check if a request is a navigation/slug request (not a static asset).
 * Returns true for paths without file extensions that are not under /fonts/.
 * @param {string} url
 * @returns {boolean}
 */
function isNavigationRequest(url) {
  var pathname = new URL(url).pathname;
  if (pathname.indexOf('.') !== -1) return false;
  if (pathname.startsWith('/fonts/')) return false;
  return true;
}

sw.addEventListener('install', /** @param {ExtendableEvent} event */ (event) => {
  // Per-URL add so one broken asset (e.g. a renamed font) doesn't throw out the
  // whole precache and leave the app with no offline support.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] precache failed for', url, err);
          })
        )
      )
    )
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

  // Navigation/slug requests: serve index.html (cached under '/').
  // All document slugs share the same HTML shell — the JS reads the URL to load the right doc.
  if (isNavigationRequest(event.request.url)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' }).then((response) => {
        if (response.ok) {
          var clone = response.clone();
          // Cache under the canonical '/' key so all slugs share the same cached HTML
          caches.open(CACHE_NAME).then((cache) => cache.put(new Request('/'), clone));
        }
        return response;
      }).catch(() =>
        caches.match('/').then((cached) =>
          cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
        )
      )
    );
    return;
  }

  // Network-first for app code (JS, CSS, icons, manifest).
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
