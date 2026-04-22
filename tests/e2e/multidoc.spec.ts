import { test, expect, type Page } from '@playwright/test';

async function resetStorage(page: Page) {
  await page.goto('/');
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

test.beforeEach(async ({ page }) => {
  await resetStorage(page);
});

test.describe('Multi-document slug routing', () => {
  test('different slugs persist independent text', async ({ page }) => {
    await page.goto('/doc-a');
    await page.waitForSelector('#app-shell:not(.loading)');
    const editor = page.locator('#editor');
    await editor.fill('alpha content');
    await editor.dispatchEvent('input');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));

    await page.goto('/doc-b');
    await page.waitForSelector('#app-shell:not(.loading)');
    await expect(editor).toHaveValue('');
    await editor.fill('beta content');
    await editor.dispatchEvent('input');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));

    await page.goto('/doc-a');
    await page.waitForSelector('#app-shell:not(.loading)');
    await expect(editor).toHaveValue('alpha content');

    await page.goto('/doc-b');
    await page.waitForSelector('#app-shell:not(.loading)');
    await expect(editor).toHaveValue('beta content');
  });

  test('root path uses the "current" slug by default', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#app-shell:not(.loading)');
    const editor = page.locator('#editor');
    await editor.fill('root text');
    await editor.dispatchEvent('input');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));

    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    await expect(editor).toHaveValue('root text');

    const storedSlug = await page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const req = indexedDB.open('plaintext', 1);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('documents', 'readonly');
            const all = tx.objectStore('documents').getAll();
            all.onsuccess = () => {
              db.close();
              resolve((all.result as { id: string }[]).map((r) => r.id));
            };
          };
          req.onerror = () => resolve([]);
        })
    );
    expect(storedSlug).toContain('current');
  });

  test('invalid slug does not mount the editor', async ({ page }) => {
    // With adapter-static SPA fallback, invalid slugs serve index.html (200).
    // The client router fails the param matcher and renders SvelteKit's 404
    // state — the app shell / editor never mounts.
    await page.goto('/foo@bar');
    await expect(page.locator('#editor')).toHaveCount(0);
  });

  test('valid slug path returns the app shell', async ({ page }) => {
    const response = await page.goto('/my-notes');
    expect(response?.status()).toBe(200);
    await page.waitForSelector('#app-shell:not(.loading)');
    await expect(page.locator('#editor')).toBeVisible();
  });
});

test.describe('Documents picker slug validation', () => {
  async function openDocumentsDialog(page: Page) {
    await page.goto('/');
    await page.waitForSelector('#app-shell:not(.loading)');
    await page.evaluate(() => {
      localStorage.setItem('plaintext:toolbarIcons', 'visible');
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'plaintext:toolbarIcons',
          newValue: 'visible',
          storageArea: localStorage,
        })
      );
    });
    await page.locator('#btn-documents').click();
    await expect(page.locator('#dialog-documents')).toBeVisible();
  }

  test('reserved slug "current" shows an inline error and does not navigate', async ({ page }) => {
    await openDocumentsDialog(page);
    const input = page.locator('#documents-create-input');
    await input.fill('current');
    await page.locator('#documents-create button[type="submit"]').click();

    const err = page.locator('#documents-create-error');
    await expect(err).toBeVisible();
    await expect(err).toHaveText(/reserved/i);
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('error clears when the user edits the input', async ({ page }) => {
    await openDocumentsDialog(page);
    const input = page.locator('#documents-create-input');
    await input.fill('current');
    await page.locator('#documents-create button[type="submit"]').click();

    const err = page.locator('#documents-create-error');
    await expect(err).toBeVisible();

    await input.fill('notes');
    await expect(err).toBeHidden();
  });

  test('valid slug navigates to /slug', async ({ page }) => {
    await openDocumentsDialog(page);
    const input = page.locator('#documents-create-input');
    await input.fill('my-notes');
    await Promise.all([
      page.waitForURL('**/my-notes'),
      page.locator('#documents-create button[type="submit"]').click(),
    ]);
    expect(new URL(page.url()).pathname).toBe('/my-notes');
  });
});
