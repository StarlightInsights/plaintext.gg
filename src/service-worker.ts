/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = `plaintext-${version}`;

// Precache: app build chunks, all static files (fonts, icons, manifest), and
// the navigation fallback '/'. One-per-URL adds so a single broken asset
// doesn't poison the whole precache.
const PRECACHE_URLS = [...build, ...files, '/'];

function isFontRequest(url: string): boolean {
  const pathname = new URL(url).pathname;
  return pathname.endsWith('.woff2') || pathname.endsWith('.otf') || pathname.endsWith('.ttf');
}

function isNavigationRequest(url: string): boolean {
  const pathname = new URL(url).pathname;
  if (pathname.indexOf('.') !== -1) return false;
  if (pathname.startsWith('/fonts/')) return false;
  return true;
}

/**
 * Fire-and-forget cache write. A failed cache put (quota, private mode, etc.)
 * must never block the response returning to the client — we swallow the error
 * and let the next request re-fetch from the network.
 */
function cachePut(key: Request, response: Response): void {
  caches.open(CACHE_NAME).then((c) => c.put(key, response)).catch(() => {});
}

function offlineFallback(): Response {
  return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
}

sw.addEventListener('install', (event) => {
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

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  sw.clients.claim();
});

sw.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Cache-first for fonts — immutable assets that never change between deploys.
  if (isFontRequest(event.request.url)) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ??
          fetch(event.request).then((response) => {
            if (response.ok) cachePut(event.request, response.clone());
            return response;
          })
      )
    );
    return;
  }

  // Navigation/slug requests: fetch fresh, fall back to cached '/' offline.
  // All slugs share the same HTML shell — the router reads the URL to load the right doc.
  if (isNavigationRequest(event.request.url)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((response) => {
          if (response.ok) cachePut(new Request('/'), response.clone());
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached ?? offlineFallback()))
    );
    return;
  }

  // Network-first for app code (JS, CSS, icons, manifest). Always prefer fresh,
  // fall back to cache when offline. { cache: 'no-cache' } forces revalidation.
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((response) => {
        if (response.ok) cachePut(event.request, response.clone());
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached ?? offlineFallback())
      )
  );
});
