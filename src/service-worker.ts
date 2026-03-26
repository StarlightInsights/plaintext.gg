/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { base, build, files, prerendered, version } from '$service-worker';

const sw = globalThis as unknown as ServiceWorkerGlobalScope;
const CACHE = `cache-${version}`;
const ASSETS = [...build, ...files, ...prerendered];
const SHELL_URL = `${base}/`;

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(ASSETS);
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
			const cache = await caches.open(CACHE);

			if (ASSETS.includes(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) {
					return cached;
				}
			}

			const isNavigationRequest =
				event.request.mode === 'navigate' ||
				(event.request.destination === 'document' &&
					url.origin === sw.location.origin);

			try {
				const response = await fetch(event.request);

				if (response instanceof Response && response.ok && url.origin === sw.location.origin) {
					await cache.put(event.request, response.clone());
				}

				return response;
			} catch (error) {
				const cached = await cache.match(event.request);
				if (cached) {
					return cached;
				}

				if (isNavigationRequest) {
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
