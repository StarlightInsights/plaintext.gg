import { test, expect } from '@playwright/test';

// Verifies BroadcastChannel-driven text sync between two tabs viewing the same
// slug. The existing storage-event tests cover preference sync; this covers
// the real text-sync path in production.

async function bootPage(context, path = '/doc-sync') {
  const page = await context.newPage();
  await page.goto(path);
  await page.waitForSelector('#app-shell:not(.loading)');
  return page;
}

async function resetStorage(page) {
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('plaintext');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
}

test.describe('Cross-tab BroadcastChannel text sync', () => {
  test('typing in tab A updates tab B on the same slug', async ({ context }) => {
    const pageA = await bootPage(context, '/doc-sync');
    await resetStorage(pageA);
    await pageA.reload();
    await pageA.waitForSelector('#app-shell:not(.loading)');

    const pageB = await bootPage(context, '/doc-sync');

    await pageA.locator('#editor').fill('sync me');
    await pageA.locator('#editor').dispatchEvent('input');

    // Persistence is debounced (300ms); BroadcastChannel fires after persist
    // completes. Poll rather than sleeping on a fixed timeout.
    await expect.poll(
      async () => pageB.locator('#editor').inputValue(),
      { timeout: 3000 },
    ).toBe('sync me');

    await pageA.close();
    await pageB.close();
  });

  test('tabs on different slugs do not cross-contaminate', async ({ context }) => {
    const pageA = await bootPage(context, '/doc-x');
    await resetStorage(pageA);
    await pageA.reload();
    await pageA.waitForSelector('#app-shell:not(.loading)');

    const pageB = await bootPage(context, '/doc-y');

    await pageA.locator('#editor').fill('only on x');
    await pageA.locator('#editor').dispatchEvent('input');

    // Wait long enough that any (mis-)broadcast would have arrived, then
    // assert tab B is still empty. We poll-with-timeout rather than sleeping
    // so a fast run doesn't get stalled.
    await expect
      .poll(async () => pageB.locator('#editor').inputValue(), { timeout: 1500, intervals: [100] })
      .toBe('');

    await pageA.close();
    await pageB.close();
  });
});
