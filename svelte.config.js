import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: "build",
      assets: "build",
      fallback: "index.html",
      precompress: false,
      strict: false,
    }),
    // Panda's generated output. Aliased here (not in tsconfig paths, which would
    // clobber SvelteKit's generated $lib/$app paths) so both Vite and
    // svelte-check resolve `styled-system/*` imports.
    alias: {
      "styled-system": "./styled-system",
      "styled-system/*": "./styled-system/*",
    },
    // Don't let SvelteKit auto-register the service worker. Its default
    // registration runs in dev too, where the worker intercepts navigations and
    // serves a cached shell that collides with Vite's dev module graph — which
    // can render a raw JS module as the page. We register it ourselves in
    // +layout.svelte (production only) and tear down any dev-registered worker.
    serviceWorker: {
      register: false,
    },
    csp: {
      mode: "hash",
      directives: {
        "default-src": ["self"],
        "script-src": ["self"],
        "style-src": ["self", "unsafe-inline"],
        "img-src": ["self", "data:"],
        "font-src": ["self"],
        "connect-src": ["self"],
        "manifest-src": ["self"],
        "worker-src": ["self"],
        "frame-ancestors": ["none"],
        "base-uri": ["self"],
        "form-action": ["self"],
      },
    },
  },
};

export default config;
