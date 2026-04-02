import { createServer } from 'node:http';
import { readFile } from 'node:fs';
import { join, extname } from 'node:path';

/** @type {number} */
const port = parseInt(process.argv[2] || '3000', 10);

/** @type {Record<string, string>} */
const TYPES = {
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  json: 'application/json',
  webmanifest: 'application/manifest+json',
  svg: 'image/svg+xml',
  png: 'image/png',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  txt: 'text/plain',
};

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
function handleRequest(req, res) {
  let url = /** @type {string} */ (req.url).split('?')[0];
  if (url === '/') url = '/index.html';

  readFile(join('public', url), (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    const ext = extname(url).slice(1);
    const cacheControl = ext === 'woff2'
      ? 'public, max-age=31536000, immutable'
      : 'no-cache';
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': cacheControl,
    });
    res.end(data);
  });
}

createServer(handleRequest).listen(port, () => console.log(`http://localhost:${port}`));
