/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from "$service-worker";

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = `plaintext-${version}`;

// Cache key under which a POST share-target payload is stashed for the client to
// pick up after the redirect. Must match the path read in AppShell.svelte.
const SHARE_STASH_PATH = "/__shared__";

// Precache: app build chunks, all static files (fonts, icons, manifest), and
// the navigation fallback '/'. Everything here is versioned via CACHE_NAME —
// each deploy gets a fresh cache — so these URLs are safe to serve cache-first
// without any revalidation.
const PRECACHE_URLS = [...build, ...files, "/"];
const PRECACHE_SET = new Set(PRECACHE_URLS);

function isNavigationRequest(url: string): boolean {
  const pathname = new URL(url).pathname;
  if (pathname.indexOf(".") !== -1) return false;
  if (pathname.startsWith("/fonts/")) return false;
  return true;
}

/**
 * Detect navigations that carry user-supplied data in the query string: the
 * Web Share Target (`?title=&text=&url=`, see manifest `share_target`) and the
 * `?action=new` app shortcut. These must be served from the cached shell so the
 * shared text is never forwarded to the server — the client reads the params
 * from `location.search` and then strips them. Keeps the "nothing is sent to
 * any server, ever" guarantee literally true for the share path.
 */
function isQueryBearingNavigation(url: string): boolean {
  const params = new URL(url).searchParams;
  return params.has("title") || params.has("text") || params.has("url") || params.has("action");
}

/**
 * Fire-and-forget cache write. A failed cache put (quota, private mode, etc.)
 * must never block the response returning to the client — we swallow the error
 * and let the next request re-fetch from the network.
 */
function cachePut(key: Request, response: Response): void {
  caches
    .open(CACHE_NAME)
    .then((c) => c.put(key, response))
    .catch(() => {});
}

function offlineFallback(): Response {
  return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
}

function formValue(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

/**
 * Web Share Target handler (POST). The shared payload arrives in the request
 * body, never the URL. We read it, stash it in the (same-origin, versioned)
 * cache, and redirect to a clean URL — so the shared text is consumed entirely
 * on-device and never forwarded to the server. The client reads the stash from
 * the Cache API and deletes it. Because it's a POST body, even if the SW were
 * somehow not in control, nginx would not write it to its access log.
 */
async function handleShareTarget(request: Request): Promise<Response> {
  try {
    const form = await request.formData();
    const payload = JSON.stringify({
      title: formValue(form, "title"),
      text: formValue(form, "text"),
      url: formValue(form, "url"),
    });
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      new Request(SHARE_STASH_PATH),
      new Response(payload, { headers: { "Content-Type": "application/json" } }),
    );
  } catch {
    /* even on failure, fall through to a clean shell rather than erroring */
  }
  return Response.redirect(`${sw.location.origin}/?share-target=1`, 303);
}

sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("[sw] precache failed for", url, err);
          }),
        ),
      ),
    ),
  );
  void sw.skipWaiting();
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))),
      ),
  );
  void sw.clients.claim();
});

sw.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Web Share Target (POST → action "/"): consume the payload in the SW so it
  // never reaches the network. See handleShareTarget.
  if (
    event.request.method === "POST" &&
    url.origin === sw.location.origin &&
    url.pathname === "/"
  ) {
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  if (event.request.method !== "GET") return;

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
          }),
      ),
    );
    return;
  }

  // Share-target / shortcut navigations carry user data in the query string.
  // Serve the cached shell directly (never hitting the network with the query)
  // so the shared text stays on the device. The browser keeps the original URL,
  // so the client still reads the params from `location.search`.
  if (isNavigationRequest(event.request.url) && isQueryBearingNavigation(event.request.url)) {
    event.respondWith(
      caches.match("/").then(
        (cached) =>
          cached ??
          fetch("/")
            .then((response) => {
              if (response.ok) cachePut(new Request("/"), response.clone());
              return response;
            })
            .catch(() => offlineFallback()),
      ),
    );
    return;
  }

  // Navigation/slug requests: fetch fresh so new deploys register the new SW,
  // fall back to cached '/' offline. All slugs share the same HTML shell —
  // the router reads the URL to load the right doc.
  if (isNavigationRequest(event.request.url)) {
    event.respondWith(
      fetch(event.request, { cache: "no-cache" })
        .then((response) => {
          if (response.ok) cachePut(new Request("/"), response.clone());
          return response;
        })
        .catch(() => caches.match("/").then((cached) => cached ?? offlineFallback())),
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
      .catch(() => caches.match(event.request).then((cached) => cached ?? offlineFallback())),
  );
});
