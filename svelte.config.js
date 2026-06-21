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
