import { createServer } from 'node:http';
import { readFile } from 'node:fs';
import { join, extname } from 'node:path';

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

createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';

  readFile(join('public', url), (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    const ext = extname(url).slice(1);
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(3000, () => console.log('http://localhost:3000'));
