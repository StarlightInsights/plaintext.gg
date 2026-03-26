/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { base, build, files, prerendered, version } from '$service-worker';

const sw = globalThis as unknown as ServiceWorkerGlobalScope;
const CACHE = `cache-${version}`;
const SHELL_URL = `${base}/`;
const PRECACHE_ASSETS = [...build, ...files];
const OFFLINE_FALLBACKS = prerendered.includes(SHELL_URL) ? [SHELL_URL] : [];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll([...PRECACHE_ASSETS, ...OFFLINE_FALLBACKS]);
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) {
					await caches.delete(key);
				}
			}

			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') {
		return;
	}

	event.respondWith(
		(async () => {
			const url = new URL(event.request.url);
			const isNavigationRequest =
				event.request.mode === 'navigate' ||
				(event.request.destination === 'document' &&
					url.origin === sw.location.origin);

			if (url.origin !== sw.location.origin) {
				return fetch(event.request);
			}

			if (PRECACHE_ASSETS.includes(url.pathname)) {
				const cache = await caches.open(CACHE);
				const cached = await cache.match(url.pathname);
				if (cached) {
					return cached;
				}
			}

			try {
				return await fetch(event.request);
			} catch (error) {
				if (isNavigationRequest) {
					const cache = await caches.open(CACHE);
					const shell = await cache.match(SHELL_URL);
					if (shell) {
						return shell;
					}
				}

				throw error;
			}
		})()
	);
});
