# plaintext.gg

Sometimes you just want plain text.

`plaintext.gg` is a small, static, open-source plain text editor designed to stay out of the way. It runs entirely in the browser, saves text locally with IndexedDB, keeps preferences in `localStorage`, and avoids accounts, backends, analytics, and formatting features.

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

No framework, no bundler, no build step. The project uses `pnpm` as its package manager:

```sh
git clone https://github.com/StarlightInsights/Plaintext.gg.git
cd Plaintext.gg
pnpm install
pnpm run dev
```

This starts a dev server at `http://localhost:3000`. Or serve the `public/` directory with any static file server.

## Tests

```sh
# Unit tests (no dependencies needed)
pnpm test

# E2E tests (Playwright's Chromium is installed automatically via postinstall)
pnpm run test:e2e

# Type checking
pnpm run typecheck

# Everything (typecheck + unit + e2e)
pnpm run check
```

## Deployment

The `public/` directory is the entire site. No build step. Deploy it to any static host.

On pushes to `main`, GitHub Actions runs type checking, unit tests, and e2e tests, then deploys to the CDN.

The CDN (Bunny Pull Zone) is responsible for setting response security headers in production: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`. The dev server in `server.js` emits the same CSP/nosniff/XFO/Referrer/Permissions headers so regressions surface locally; HSTS is intentionally not set by the dev server.

The `deploy_bunny_storage` job in `.github/workflows/ci.yml` runs under the `production` GitHub Environment. Configure that environment in the repository settings with required reviewer approval and limit it to the `main` branch so Bunny secrets cannot be exfiltrated via an unreviewed push.

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
- Font licenses: see [LICENSE-FONT](./public/fonts/LICENSE-FONT)
