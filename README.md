# plaintext.gg

Sometimes you just want plain text.

`plaintext.gg` is a small, static, open-source plain text editor designed to stay out of the way. It runs entirely in the browser, saves text to IndexedDB, keeps preferences in `localStorage`, and has no accounts, backends, analytics, or formatting.

## What It Does

- Writes and edits plain text in a single full-page textarea
- Saves automatically to the browser with a short debounce
- Recovers unsaved text after a crash via `sessionStorage`
- Supports multiple documents through URL slugs (e.g. `plaintext.gg/notes`)
- Lets you copy text, download it as a file, or upload/drag-and-drop text files
- Offers four self-hosted font families: Commit Mono, Roboto, EB Garamond, and OpenDyslexic
- Adjustable font size, weight, and italic
- Supports light and dark themes
- Toolbar toggle for a distraction-free writing mode
- Syncs text across open tabs with `BroadcastChannel`
- Syncs preferences across open windows through the browser `storage` event
- Works offline as an installable PWA

## Local Development

Built with SvelteKit 2, Svelte 5, Tailwind v4, and Vite, using `pnpm` as the package manager and the static adapter to output a fully client-rendered SPA:

```sh
git clone https://github.com/StarlightInsights/plaintext.gg.git
cd plaintext.gg
pnpm install
pnpm run dev
```

This starts a dev server at `http://localhost:5173`. Run `pnpm run build` to produce the static site in `build/`, and `pnpm run preview` to serve it locally on port 3999.

## Tests

```sh
# Unit + e2e (default test command)
pnpm test

# Unit tests only (no dependencies needed)
pnpm run test:unit

# E2E tests only (Chromium auto-installs via postinstall)
pnpm run test:e2e

# Type checking
pnpm run typecheck

# Everything (typecheck + unit + e2e)
pnpm run check
```

## Deployment

The site ships as a Docker image built from the `Dockerfile`: a multi-stage build runs `pnpm run build` in a Node image, then copies the generated `build/` directory into an `nginx:alpine` image that serves it on port 80 using `nginx.conf`.

CI runs on every pull request and on pushes to `main`: type checking, unit tests, and an e2e suite that runs Playwright against the actual production Docker image so the real nginx config (security headers, cache rules, SPA fallback) is exercised.

Security response headers are split between nginx and SvelteKit: `nginx.conf` sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`, while SvelteKit injects the CSP as a `<meta>` tag at build time (`kit.csp` in `svelte.config.js`). HSTS is expected to be added by the upstream TLS terminator.

## Privacy

`plaintext.gg` stores text in the browser's IndexedDB and keeps preferences (theme, font family, font size, font weight, italic, and toolbar visibility) in `localStorage`.

- No accounts
- No analytics
- No cookies
- No server-side text storage

Your text stays on your device unless you explicitly copy it or download it. The site does not depend on external fonts, trackers, or third-party runtime resources.

## Open Source

This project is open source. Small, direct contributions are welcome, especially around:

- accessibility
- browser behavior
- typography and visual polish
- edge-case handling for local persistence and multi-tab use

If you make changes, keep the product intent intact: minimal UI, plain text first, and as little interference as possible.

## Licenses

- Project license: see [LICENSE](./LICENSE)
- Font licenses: see [LICENSE-FONT](./static/fonts/LICENSE-FONT)
