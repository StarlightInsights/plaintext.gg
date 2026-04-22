import { test, expect } from '@playwright/test';

/**
 * Tests that exercise the production Docker image (nginx) specifically.
 * Run them by setting TEST_DOCKER_HOSTING=1 — CI always does; `vite preview`
 * locally won't serve these headers so the suite is skipped then.
 */
const runDockerTests = !!process.env.TEST_DOCKER_HOSTING;

test.describe('Docker / nginx hosting', () => {
  test.skip(!runDockerTests, 'Set TEST_DOCKER_HOSTING=1 to run against the container');

  test('serves index.html for root with 200', async ({ request }) => {
    const r = await request.get('/');
    expect(r.status()).toBe(200);
    expect(r.headers()['content-type']).toContain('text/html');
    const body = await r.text();
    expect(body).toContain('plaintext.gg');
  });

  test('SPA fallback: unknown path returns index.html (200)', async ({ request }) => {
    const r = await request.get('/this-path-does-not-exist');
    expect(r.status()).toBe(200);
    const body = await r.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('plaintext.gg');
  });

  test('SPA fallback also applies to multi-segment paths', async ({ request }) => {
    // nginx serves index.html for any missing file. The client router then
    // decides what to render (a valid single-segment slug works; `/a/b/c`
    // falls to SvelteKit's 404).
    const r = await request.get('/a/b/c');
    expect(r.status()).toBe(200);
    const body = await r.text();
    expect(body).toContain('<!doctype html>');
  });

  test('security: X-Frame-Options DENY', async ({ request }) => {
    const r = await request.get('/');
    expect(r.headers()['x-frame-options']).toBe('DENY');
  });

  test('security: X-Content-Type-Options nosniff', async ({ request }) => {
    const r = await request.get('/');
    expect(r.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('security: Referrer-Policy strict-origin-when-cross-origin', async ({ request }) => {
    const r = await request.get('/');
    expect(r.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('security: Permissions-Policy restricts sensitive APIs', async ({ request }) => {
    const r = await request.get('/');
    const policy = r.headers()['permissions-policy'];
    expect(policy).toContain('geolocation=()');
    expect(policy).toContain('camera=()');
    expect(policy).toContain('microphone=()');
  });

  test('cache: hashed app chunks are immutable', async ({ request }) => {
    // Pick any file served from /_app/immutable/ — the index.html references
    // at least one hashed CSS/JS chunk.
    const html = await (await request.get('/')).text();
    const match = html.match(/\/_app\/immutable\/[^"]+\.(?:js|css)/);
    expect(match, 'no hashed chunk URL found in index.html').not.toBeNull();
    const r = await request.get(match![0]);
    expect(r.status()).toBe(200);
    expect(r.headers()['cache-control']).toContain('immutable');
  });

  test('cache: fonts are immutable', async ({ request }) => {
    const r = await request.get('/fonts/commitmono/CommitMono-300-Regular.woff2');
    expect(r.status()).toBe(200);
    expect(r.headers()['cache-control']).toContain('immutable');
  });

  test('cache: service worker revalidates on every request', async ({ request }) => {
    const r = await request.get('/service-worker.js');
    expect(r.status()).toBe(200);
    expect(r.headers()['cache-control']).toBe('no-cache');
  });

  test('cache: manifest revalidates on every request', async ({ request }) => {
    const r = await request.get('/manifest.webmanifest');
    expect(r.status()).toBe(200);
    expect(r.headers()['cache-control']).toBe('no-cache');
  });
});
