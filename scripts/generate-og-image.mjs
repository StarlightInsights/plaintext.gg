// Regenerates public/og-image.png (1200×630) using Playwright to render an
// HTML card with the site's palette and typography. Run manually when the
// branding changes: `node scripts/generate-og-image.mjs`.
// The output PNG is committed — this is not part of the build.

import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const fontsDir = join(publicDir, 'fonts', 'commitmono');

async function fontDataUrl(filename) {
  const bytes = await readFile(join(fontsDir, filename));
  return 'data:font/woff2;base64,' + bytes.toString('base64');
}

const [mono200, mono250, mono300] = await Promise.all([
  fontDataUrl('CommitMono-200-Regular.woff2'),
  fontDataUrl('CommitMono-250-Regular.woff2'),
  fontDataUrl('CommitMono-300-Regular.woff2'),
]);

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @font-face { font-family: "CommitMono"; src: url(${mono200}) format("woff2"); font-weight: 200; }
  @font-face { font-family: "CommitMono"; src: url(${mono250}) format("woff2"); font-weight: 250; }
  @font-face { font-family: "CommitMono"; src: url(${mono300}) format("woff2"); font-weight: 300; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 1200px;
    height: 630px;
    background: oklch(1 0 89.88);
    color: oklch(0.218 0 89.88);
    font-family: "CommitMono", ui-monospace, monospace;
    display: grid;
    grid-template-rows: 1fr auto;
    padding: 72px 80px;
    box-sizing: border-box;
  }
  .mark {
    font-size: 84px;
    font-weight: 250;
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .tag {
    font-size: 28px;
    font-weight: 200;
    line-height: 1.4;
    margin-top: 28px;
    color: oklch(0.5 0 89.88);
    max-width: 900px;
  }
  .foot {
    font-size: 20px;
    font-weight: 300;
    color: oklch(0.5 0 89.88);
    letter-spacing: 0.02em;
  }
  .rule {
    width: 56px;
    height: 2px;
    background: oklch(0.218 0 89.88);
    margin-top: 40px;
  }
</style>
</head>
<body>
  <div>
    <div class="mark">plaintext.gg</div>
    <div class="rule"></div>
    <div class="tag">the distraction-free writing tool that strips formatting and does not use AI.</div>
  </div>
  <div class="foot">sometimes you just want plain text.</div>
</body>
</html>`;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluateHandle('document.fonts.ready');

const outPath = join(publicDir, 'og-image.png');
await mkdir(publicDir, { recursive: true });
await page.screenshot({ path: outPath, type: 'png', fullPage: false });
await browser.close();

console.log('Wrote ' + outPath);
