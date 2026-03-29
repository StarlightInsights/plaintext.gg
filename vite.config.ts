import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

const staticAssetGlob = 'client/**/*.{js,css,ico,png,svg,webp,avif,woff,woff2,ttf,otf,eot,webmanifest}';
const staticAssetMaxAgeSeconds = 60 * 60 * 24 * 365;
const offlineFallbackPath = '/offline.html';
const webManifestPath = 'manifest.webmanifest';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			injectRegister: null,
			registerType: 'autoUpdate',
			manifest: false,
			workbox: {
				clientsClaim: true,
				skipWaiting: true,
				cleanupOutdatedCaches: true,
				navigateFallback: null,
				// Keep the precache scoped to emitted client assets, but preserve the literal
				// offline HTML URL so Workbox doesn't rewrite it to `/offline`.
				modifyURLPrefix: {
					'client/': ''
				},
				globPatterns: [staticAssetGlob, 'client/offline.html'],
				manifestTransforms: [
					async (entries) => ({
						manifest: entries
							.map((entry) => ({
								...entry,
								url: entry.url.startsWith('client/') ? entry.url.slice(7) : entry.url
							}))
							.filter((entry) => entry.url !== webManifestPath)
					})
				],
				runtimeCaching: [
					{
						urlPattern: ({ request }) => request.mode === 'navigate',
						handler: 'NetworkOnly',
						options: {
							precacheFallback: {
								fallbackURL: offlineFallbackPath
							}
						}
					},
					{
						urlPattern: ({ request, sameOrigin }) =>
							sameOrigin &&
							(request.destination === 'style' ||
								request.destination === 'script' ||
								request.destination === 'font' ||
								request.destination === 'image' ||
								request.destination === 'manifest'),
						handler: 'CacheFirst',
						options: {
							cacheName: 'static-assets',
							cacheableResponse: {
								statuses: [0, 200]
							},
							expiration: {
								maxEntries: 256,
								maxAgeSeconds: staticAssetMaxAgeSeconds
							}
						}
					}
				]
				}
			})
		]
});
