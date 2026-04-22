/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = `plaintext-${version}`;

// Precache: app build chunks, all static files (fonts, icons, manifest), and
// the navigation fallback '/'. Everything here is versioned via CACHE_NAME —
// each deploy gets a fresh cache — so these URLs are safe to serve cache-first
// without any revalidation.
const PRECACHE_URLS = [...build, ...files, '/'];
const PRECACHE_SET = new Set(PRECACHE_URLS);

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

  const url = new URL(event.request.url);

  // Cache-first for anything we precached. These URLs are versioned by
  // CACHE_NAME, so revalidating them would just produce 304s on every load.
  if (url.origin === sw.location.origin && PRECACHE_SET.has(url.pathname)) {
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

  // Navigation/slug requests: fetch fresh so new deploys register the new SW,
  // fall back to cached '/' offline. All slugs share the same HTML shell —
  // the router reads the URL to load the right doc.
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

  // Anything else (unexpected same-origin assets): network-first, cache fallback.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) cachePut(event.request, response.clone());
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached ?? offlineFallback())
      )
  );
});
