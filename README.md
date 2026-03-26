# plaintext.gg

Sometimes you just want plain text.

`plaintext.gg` is a small, static, open-source plain text editor designed to stay out of the way. It runs entirely in the browser, saves locally with `localStorage`, and avoids accounts, backends, analytics, and formatting features.

## What It Does

- Writes and edits plain text in a single full-page textarea
- Saves automatically to the browser with a short debounce
- Lets you copy text, download it as `plaintext.txt`, and adjust font size
- Supports light and dark themes
- Syncs text, theme, and font size across open windows through the browser `storage` event
- Uses self-hosted Commit Mono webfonts

## Project Structure

- `src/routes/+page.svelte`: the application page
- `src/lib/editor.ts`: small shared editor utilities covered by tests
- `src/app.css`: Tailwind import plus the app's global styles and local font faces
- `static/`: static assets served with the site, including the favicon, license file, and the full bundled Commit Mono font family
- `.github/workflows/ci.yml`: CI plus Bunny Storage deployment on `main`

## Local Development

This project uses SvelteKit, Tailwind CSS v4, TypeScript, `adapter-static`, Node 24, pnpm, and Vite+ for the dev/build pipeline.

```sh
git clone https://github.com/StarlightInsights/Plaintext.gg.git
cd Plaintext.gg
pnpm install
pnpm dev
```

## Commands

- `pnpm dev`: start the local development server through `vp dev`
- `pnpm build`: create the static production build through `vp build`
- `pnpm test`: run the Node test suite
- `pnpm run check`: run `svelte-check` with warnings treated as failures, then verify the Vite+ production build

## Deployment

This repo is intended to be deployed as a static site. The SvelteKit build uses `@sveltejs/adapter-static`, so the generated output in `build/` can be deployed to any static host.

On pushes to `main`, GitHub Actions now:

- runs the test and check pipeline
- rebuilds the static site
- deletes the current contents of the configured Bunny Storage zone root
- uploads the contents of `build/`

Required GitHub Actions secrets:

- `BUNNY_STORAGE_ENDPOINT`: the storage hostname for your zone region, for example `storage.bunnycdn.com` or `uk.storage.bunnycdn.com`
- `BUNNY_STORAGE_ZONE`: your Bunny Storage zone name
- `BUNNY_STORAGE_PASSWORD`: your storage zone password from the Bunny dashboard's FTP & API Access section

## Privacy

`plaintext.gg` stores text, theme, and font size in the browser's `localStorage`.

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
- edge-case handling for local persistence and multi-window use

If you make changes, keep the product intent intact: minimal UI, plain text first, and as little interference as possible.

## Licenses

- Project license: see [LICENSE](./LICENSE)
- Font license: see [OFL.txt](./static/OFL.txt)
