import { createServer } from 'node:http';
import { readFile } from 'node:fs';
import { extname, resolve, sep } from 'node:path';

/** @type {number} */
const port = parseInt(process.argv[2] || '3000', 10);

/** @type {string} */
const publicDir = resolve('public');

// Mirror of SLUG_PATTERN + MAX_SLUG_LENGTH from public/shared.js. Kept inline
// to avoid pulling the browser module into the server's typecheck graph.
/** @type {RegExp} */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
/** @type {number} */
const MAX_SLUG_LENGTH = 64;

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
    "script-src 'self'",
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

    // SPA fallback: serve index.html for extensionless paths that match the
    // slug pattern. Invalid slugs 404 here instead of the client rendering its
    // own 404 UI — keeps dev behavior closer to how prod should be configured.
    if (!extname(url)) {
      const slug = url.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
      const slugIsValid = slug.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(slug);
      if (slugIsValid) {
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
    }

    res.writeHead(404, SECURITY_HEADERS);
    res.end();
  });
}

createServer(handleRequest).listen(port, () => console.log(`http://localhost:${port}`));
