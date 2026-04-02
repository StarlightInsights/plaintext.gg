# plaintext.gg

Sometimes you just want plain text.

`plaintext.gg` is a small, static, open-source plain text editor designed to stay out of the way. It runs entirely in the browser, saves text locally with IndexedDB, keeps preferences in `localStorage`, and avoids accounts, backends, analytics, and formatting features.

## What It Does

- Writes and edits plain text in a single full-page textarea
- Saves automatically to the browser with a short debounce
- Lets you copy text, download it as `plaintext.txt`, and adjust font size
- Supports light and dark themes
- Syncs text across open tabs with `BroadcastChannel`
- Syncs theme and font size across open windows through the browser `storage` event
- Uses self-hosted Commit Mono webfonts
- Works offline as an installable PWA

## Project Structure

```
public/                 # Deployable static site (no build step)
  index.html            # Single-page app shell with inline SVGs
  app.css               # Hand-written CSS with design tokens and themes
  app.js                # All application logic (persistence, sync, UI)
  sw.js                 # Service worker for offline support
  manifest.webmanifest  # PWA manifest
  fonts/                # Commit Mono (3 weights, Regular only)
  icon.svg, *.png       # App icons and favicon
tests/
  editor.test.js        # Unit tests for pure utility functions
  app.spec.js           # Playwright e2e tests (75 tests)
scripts/
  deploy-bunny-storage.mjs  # Zero-dependency Bunny CDN deploy script
.github/workflows/
  ci.yml                # CI pipeline and deploy on main
```

## Local Development

No framework, no bundler, no build step. Just serve the `public/` directory:

```sh
git clone https://github.com/StarlightInsights/Plaintext.gg.git
cd Plaintext.gg
node -e "
  const h=require('http'),f=require('fs'),p=require('path');
  const m={html:'text/html',css:'text/css',js:'text/javascript',json:'application/json',webmanifest:'application/manifest+json',svg:'image/svg+xml',png:'image/png',ico:'image/x-icon',woff2:'font/woff2',txt:'text/plain'};
  h.createServer((q,r)=>{let u=q.url.split('?')[0];if(u==='/')u='/index.html';f.readFile(p.join('public',u),(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':m[p.extname(u).slice(1)]||'application/octet-stream'});r.end(d)})}).listen(3000,()=>console.log('http://localhost:3000'));
"
```

Or use any static file server: `npx serve public`, `python3 -m http.server -d public`, etc.

## Tests

```sh
# Unit tests (no dependencies needed)
npm test

# E2E tests (one-time setup, then run)
npm install && npx playwright install chromium
npm run test:e2e

# Both
npm run test:all
```

## Deployment

The `public/` directory is the entire site. No build step. Deploy it to any static host.

On pushes to `main`, GitHub Actions:

1. Runs the unit test suite
2. Uploads the contents of `public/` to Bunny Storage
3. Removes stale files from the configured storage path
4. Purges the Bunny Pull Zone cache

Required GitHub Actions secrets:

- `BUNNY_API_KEY`: your Bunny account API key for cache purges
- `BUNNY_PULL_ZONE_ID`: the numeric Pull Zone ID for the CDN zone
- `BUNNY_STORAGE_ENDPOINT`: the storage hostname (e.g. `storage.bunnycdn.com`)
- `BUNNY_STORAGE_ZONE`: your Bunny Storage zone name
- `BUNNY_STORAGE_PASSWORD`: your storage zone password

## Privacy

`plaintext.gg` stores text in the browser's IndexedDB and keeps theme and font size in `localStorage`.

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
