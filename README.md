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

- [index.html](./index.html): the entire app
- [fonts](./fonts): self-hosted Commit Mono font assets
- [favicon.ico](./favicon.ico): site icon
- [OFL.txt](./OFL.txt): Commit Mono font license

## Local Development

This project has no build step.

Open it with a local static server instead of `file://` so fonts, favicon, and browser behavior are reliable.

Example:

```sh
git clone https://github.com/StarlightInsights/Plaintext.gg.git
cd Plaintext.gg
python3 -m http.server 8123
```

Then open:

```txt
http://127.0.0.1:8123/
```

## Deployment

This repo is intended to be deployed as a static site.

Deploy at minimum:

- `index.html`
- `favicon.ico`
- `fonts/`
- `OFL.txt`

The current setup is suitable for static hosting providers such as Bunny.net.

## Privacy

`plaintext.gg` stores text, theme, and font size in the browser's `localStorage`.

- No accounts
- No analytics
- No cookies
- No server-side text storage

Your text stays on your device unless you explicitly copy it or download it.

## Open Source

This project is open source. Small, direct contributions are welcome, especially around:

- accessibility
- browser behavior
- typography and visual polish
- edge-case handling for local persistence and multi-window use

If you make changes, keep the product intent intact: minimal UI, plain text first, and as little interference as possible.

## Licenses

- Project license: see [LICENSE](./LICENSE)
- Font license: see [OFL.txt](./OFL.txt)
