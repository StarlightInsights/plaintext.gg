import { test, expect, type BrowserContext, type Page } from '@playwright/test';

async function bootPage(context: BrowserContext, path = '/doc-sync'): Promise<Page> {
  const page = await context.newPage();
  await page.goto(path);
  await page.waitForSelector('#app-shell:not(.loading)');
  return page;
}

async function resetStorage(page: Page) {
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise<void>((resolve) => {
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

    await expect
      .poll(async () => pageB.locator('#editor').inputValue(), { timeout: 3000 })
      .toBe('sync me');

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

    await expect
      .poll(async () => pageB.locator('#editor').inputValue(), { timeout: 1500, intervals: [100] })
      .toBe('');

    await pageA.close();
    await pageB.close();
  });
});
