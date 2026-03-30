import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

const staticAssetGlob = 'client/**/*.{js,css,ico,png,svg,webp,avif,woff,woff2,ttf,otf,eot}';
const staticAssetMaxAgeSeconds = 60 * 60 * 24 * 365;

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
				globPatterns: [staticAssetGlob],
				runtimeCaching: [
					{
						urlPattern: ({ request, sameOrigin }) =>
							sameOrigin &&
							(request.destination === 'style' ||
								request.destination === 'script' ||
								request.destination === 'font' ||
								request.destination === 'image'),
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
