import { createServer } from 'node:http';
import { readFile } from 'node:fs';
import { extname, resolve, sep } from 'node:path';

/** @type {number} */
const port = parseInt(process.argv[2] || '3000', 10);

/** @type {string} */
const publicDir = resolve('public');

/** @type {Record<string, string>} */
const TYPES = {
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  json: 'application/json',
  webmanifest: 'application/manifest+json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  txt: 'text/plain',
};

// Baseline security headers. Production serves these from the CDN — kept in
// sync here so regressions show up locally.
/** @type {Record<string, string>} */
const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
};

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
function handleRequest(req, res) {
  let url = /** @type {string} */ (req.url).split('?')[0];
  if (url === '/') url = '/index.html';

  // Resolve and require the path to stay inside publicDir. Blocks traversal
  // (e.g. /../server.js) regardless of how path.join would normalize it.
  const filePath = resolve(publicDir, '.' + url);
  if (filePath !== publicDir && !filePath.startsWith(publicDir + sep)) {
    res.writeHead(403, SECURITY_HEADERS);
    res.end();
    return;
  }

  readFile(filePath, (err, data) => {
    if (!err) {
      const ext = extname(url).slice(1);
      const cacheControl = ext === 'woff2'
        ? 'public, max-age=31536000, immutable'
        : 'no-cache';
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': TYPES[ext] || 'application/octet-stream',
        'Cache-Control': cacheControl,
      });
      res.end(data);
      return;
    }

    // SPA fallback: serve index.html for extensionless paths (document slugs)
    if (!extname(url)) {
      readFile(resolve(publicDir, 'index.html'), (err2, html) => {
        if (err2) { res.writeHead(500, SECURITY_HEADERS); res.end(); return; }
        res.writeHead(200, {
          ...SECURITY_HEADERS,
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache',
        });
        res.end(html);
      });
      return;
    }

    res.writeHead(404, SECURITY_HEADERS);
    res.end();
  });
}

createServer(handleRequest).listen(port, () => console.log(`http://localhost:${port}`));
