import { test, expect, type Page } from '@playwright/test';

/**
 * Wait until IndexedDB's 'documents' store has persisted the expected text
 * for the given slug. Replaces fixed timeouts around the 300ms persist debounce.
 */
async function waitForPersisted(page: Page, slug: string, expected: string | null) {
  await expect
    .poll(
      async () =>
        page.evaluate(
          (s) =>
            new Promise<string | null>((resolve) => {
              const req = indexedDB.open('plaintext', 1);
              req.onsuccess = () => {
                const db = req.result;
                const tx = db.transaction('documents', 'readonly');
                const r = tx.objectStore('documents').get(s);
                r.onsuccess = () => {
                  db.close();
                  resolve((r.result as { text: string } | undefined)?.text ?? null);
                };
                r.onerror = () => {
                  db.close();
                  resolve(null);
                };
              };
              req.onerror = () => resolve(null);
            }),
          slug
        ),
      { timeout: 3000 }
    )
    .toBe(expected);
}

test.beforeEach(async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/');
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        localStorage.clear();
        sessionStorage.clear();
        const req = indexedDB.deleteDatabase('plaintext');
        req.onsuccess = () => resolve();
        req.onerror = () => reject();
        req.onblocked = () => resolve();
      })
  );
});

// ============================================================
// 1. PAGE LOAD & INITIAL STATE
// ============================================================

test.describe('Page load', () => {
  test('renders the app shell and becomes visible', async ({ page }) => {
    await page.goto('/');
    const shell = page.locator('#app-shell');
    await expect(shell).toBeVisible();
    await expect(shell).not.toHaveClass(/loading/);
  });

  test('has correct title and meta description', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('plaintext.gg');
    const desc = page.locator('meta[name="description"]');
    await expect(desc).toHaveAttribute('content', /distraction-free writing tool/);
  });

  test('editor textarea is present and empty by default', async ({ page }) => {
    await page.goto('/');
    const editor = page.locator('#editor');
    await expect(editor).toBeVisible();
    await expect(editor).toHaveValue('');
  });

  test('editor has the correct placeholder', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#editor')).toHaveAttribute('placeholder', 'just plain text...');
  });

  test('default theme is light', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');
  });

  test('default font size is 16px', async ({ page }) => {
    await page.goto('/');
    const editor = page.locator('#editor');
    const fontSize = await editor.evaluate((el) => (el as HTMLElement).style.fontSize);
    expect(fontSize).toBe('16px');
  });

  test('toolbar is hidden by default (no stored value)', async ({ page }) => {
    await page.goto('/');
    const toolbar = page.locator('#toolbar');
    await expect(toolbar).toHaveClass(/hidden/);
  });
});

// ============================================================
// 2. TEXT EDITING & PERSISTENCE
// ============================================================

test.describe('Text editing', () => {
  test('typing updates the textarea', async ({ page }) => {
    await page.goto('/');
    const editor = page.locator('#editor');
    await editor.fill('hello world');
    await expect(editor).toHaveValue('hello world');
  });

  test('text persists across page reload via IndexedDB', async ({ page }) => {
    await page.goto('/');
    const editor = page.locator('#editor');
    await editor.fill('persisted text');
    await editor.dispatchEvent('input');
    await waitForPersisted(page, 'current', 'persisted text');
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    await expect(page.locator('#editor')).toHaveValue('persisted text');
  });

  test('text persists via sessionStorage crash recovery', async ({ page }) => {
    await page.goto('/');
    const editor = page.locator('#editor');
    await editor.fill('session draft');
    await editor.dispatchEvent('input');
    await page.waitForTimeout(50);
    const hasDraft = await page.evaluate(() => {
      return sessionStorage.getItem('plaintext:textDraft:current') !== null;
    });
    expect(hasDraft).toBe(true);
  });

  test('empty text is valid and persists', async ({ page }) => {
    await page.goto('/');
    const editor = page.locator('#editor');
    await editor.fill('something');
    await editor.dispatchEvent('input');
    await waitForPersisted(page, 'current', 'something');
    await editor.fill('');
    await editor.dispatchEvent('input');
    await waitForPersisted(page, 'current', null);
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    await expect(page.locator('#editor')).toHaveValue('');
  });
});

// ============================================================
// 3. THEME TOGGLE
// ============================================================

test.describe('Theme toggle', () => {
  test('clicking theme button toggles to dark', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    await page.locator('#btn-theme').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('clicking theme button twice returns to light', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    await page.locator('#btn-theme').click();
    await page.locator('#btn-theme').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('theme persists across reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    await page.locator('#btn-theme').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('theme toggle updates aria-pressed', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    const btn = page.locator('#btn-theme');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  test('dark theme shows dark icon, light theme shows light icon', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    await expect(page.locator('#icon-theme-light')).toBeVisible();
    await expect(page.locator('#icon-theme-dark')).toBeHidden();
    await page.locator('#btn-theme').click();
    await expect(page.locator('#icon-theme-light')).toBeHidden();
    await expect(page.locator('#icon-theme-dark')).toBeVisible();
  });

  test('theme color meta tags update with theme', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    await page.locator('#btn-theme').click();
    const metaContent = await page.locator('meta[name="theme-color"]').first().getAttribute('content');
    expect(metaContent).toBe('#38342e');
  });
});

// ============================================================
// 4. FONT SIZE CONTROLS
// ============================================================

test.describe('Font size controls', () => {
  test('increase font size button works', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    const editor = page.locator('#editor');
    const before = await editor.evaluate((el) => parseInt((el as HTMLElement).style.fontSize));
    await page.locator('#btn-font-up').click();
    const after = await editor.evaluate((el) => parseInt((el as HTMLElement).style.fontSize));
    expect(after).toBe(before + 2);
  });

  test('decrease font size button works', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    const editor = page.locator('#editor');
    const before = await editor.evaluate((el) => parseInt((el as HTMLElement).style.fontSize));
    await page.locator('#btn-font-down').click();
    const after = await editor.evaluate((el) => parseInt((el as HTMLElement).style.fontSize));
    expect(after).toBe(before - 2);
  });

  test('font size cannot go below minimum (10px)', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    const btn = page.locator('#btn-font-down');
    while (!(await btn.isDisabled())) {
      await btn.click();
    }
    const size = await page.locator('#editor').evaluate((el) => parseInt((el as HTMLElement).style.fontSize));
    expect(size).toBe(10);
    await expect(btn).toBeDisabled();
  });

  test('font size cannot go above maximum (34px)', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    const btn = page.locator('#btn-font-up');
    while (!(await btn.isDisabled())) {
      await btn.click();
    }
    const size = await page.locator('#editor').evaluate((el) => parseInt((el as HTMLElement).style.fontSize));
    expect(size).toBe(34);
    await expect(btn).toBeDisabled();
  });

  test('font size persists across reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    await page.locator('#btn-font-up').click();
    await page.locator('#btn-font-up').click();
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    const size = await page.locator('#editor').evaluate((el) => parseInt((el as HTMLElement).style.fontSize));
    expect(size).toBe(20);
  });

  test('font size value display updates', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    await expect(page.locator('#font-size-value')).toHaveText('16px');
    await page.locator('#btn-font-up').click();
    await expect(page.locator('#font-size-value')).toHaveText('18px');
  });
});

// ============================================================
// 5. TOOLBAR VISIBILITY
// ============================================================

test.describe('Toolbar visibility', () => {
  test('desktop toggle shows the toolbar', async ({ page }) => {
    await page.goto('/');
    const toolbar = page.locator('#toolbar');
    await expect(toolbar).toHaveClass(/hidden/);
    await page.locator('#btn-toggle-desktop').click();
    await expect(toolbar).not.toHaveClass(/hidden/);
  });

  test('desktop toggle hides the toolbar', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    await expect(page.locator('#toolbar')).not.toHaveClass(/hidden/);
    await page.locator('#btn-toggle-desktop').click();
    await expect(page.locator('#toolbar')).toHaveClass(/hidden/);
  });

  test('toolbar visibility persists across reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    await expect(page.locator('#toolbar')).not.toHaveClass(/hidden/);
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    await expect(page.locator('#toolbar')).not.toHaveClass(/hidden/);
  });

  test('desktop toggle shows eye-open when toolbar visible', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    await expect(page.locator('#icon-eye-open')).toBeVisible();
    await expect(page.locator('#icon-eye-closed')).toBeHidden();
  });

  test('desktop toggle shows eye-closed when toolbar hidden', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#icon-eye-open')).toBeHidden();
    await expect(page.locator('#icon-eye-closed')).toBeVisible();
  });

  test('toggle updates aria-pressed', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#btn-toggle-desktop');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  test('editor padding adjusts when toolbar visibility changes', async ({ page }) => {
    await page.goto('/');
    const editor = page.locator('#editor');
    const hiddenPadding = await editor.evaluate((el) => parseInt((el as HTMLElement).style.paddingTop));
    expect(hiddenPadding).toBe(40);
    await page.locator('#btn-toggle-desktop').click();
    await page.waitForTimeout(50);
    const visiblePadding = await editor.evaluate((el) => parseInt((el as HTMLElement).style.paddingTop));
    expect(visiblePadding).toBeGreaterThan(0);
  });
});

// ============================================================
// 5b. TOOLBAR BLUR / TRANSPARENCY
// ============================================================

test.describe('Toolbar blur transparency', () => {
  test('visible toolbar has a translucent background', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    const toolbar = page.locator('#toolbar');
    await expect(toolbar).not.toHaveClass(/hidden/);
    const bgColor = await toolbar.evaluate((el) => getComputedStyle(el).backgroundColor);
    const alphaMatch = bgColor.match(/\/\s*([\d.]+)\s*\)/) || bgColor.match(/,\s*([\d.]+)\s*\)$/);
    expect(alphaMatch).not.toBeNull();
    const alpha = parseFloat(alphaMatch![1]);
    expect(alpha).toBeLessThan(1);
  });

  test('visible toolbar has backdrop-filter blur applied', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    const toolbar = page.locator('#toolbar');
    await expect(toolbar).not.toHaveClass(/hidden/);
    const backdropFilter = await toolbar.evaluate((el) => getComputedStyle(el).backdropFilter);
    expect(backdropFilter).toContain('blur(12px)');
  });
});

// ============================================================
// 6. DIALOGS
// ============================================================

test.describe('Dialogs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
  });

  test('info dialog opens and closes', async ({ page }) => {
    await page.locator('#btn-info').click();
    const dialog = page.locator('#dialog-info');
    await expect(dialog).toBeVisible();
    await dialog.locator('.dialog-close').click();
    await expect(dialog).not.toBeVisible();
  });

  test('info dialog has correct title', async ({ page }) => {
    await page.locator('#btn-info').click();
    await expect(page.locator('#dialog-info-title')).toHaveText('about');
  });

  test('dialog closes on backdrop click', async ({ page }) => {
    await page.locator('#btn-info').click();
    const dialog = page.locator('#dialog-info');
    await expect(dialog).toBeVisible();
    await page.mouse.click(2, 2);
    await page.waitForTimeout(200);
    const isOpen = await dialog.evaluate((el) => (el as HTMLDialogElement).open);
    expect(isOpen).toBe(false);
  });

  test('info dialog contains GitHub link', async ({ page }) => {
    await page.locator('#btn-info').click();
    const link = page.locator('#dialog-info-desc a[href*="github.com"]');
    await expect(link).toBeVisible();
    await expect(link).toContainText('GitHub');
  });

  test('info dialog contains Commit Mono link', async ({ page }) => {
    await page.locator('#btn-info').click();
    const link = page.locator('#dialog-info-desc a[href*="commitmono"]');
    await expect(link).toBeVisible();
  });

  test('info dialog contains Phosphor link', async ({ page }) => {
    await page.locator('#btn-info').click();
    const link = page.locator('#dialog-info-desc a[href*="phosphoricons"]');
    await expect(link).toBeVisible();
  });

  test('dialog has correct aria attributes', async ({ page }) => {
    const dialog = page.locator('#dialog-info');
    await expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-info-title');
    await expect(dialog).toHaveAttribute('aria-describedby', 'dialog-info-desc');
  });
});

// ============================================================
// 6b. DIALOG LAYOUT
// ============================================================

test.describe('Dialog layout', () => {
  test('about dialog is wider than settings dialog', async ({ page }) => {
    await page.goto('/');

    await page.locator('#dialog-info').evaluate((el) => (el as HTMLDialogElement).showModal());
    const aboutWidth = await page.locator('#dialog-info').evaluate((el) => (el as HTMLElement).offsetWidth);
    await page.locator('#dialog-info').evaluate((el) => (el as HTMLDialogElement).close());

    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    const settingsWidth = await page.locator('#dialog-settings').evaluate((el) => (el as HTMLElement).offsetWidth);
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).close());

    expect(aboutWidth).toBeGreaterThan(settingsWidth);
  });

  test('dialogs have equal left and right margins', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    await page.goto('/');

    for (const id of ['dialog-settings', 'dialog-info']) {
      await page.locator(`#${id}`).evaluate((el) => (el as HTMLDialogElement).showModal());
      await page.waitForTimeout(300);
      const box = await page.locator(`#${id}`).boundingBox();
      const rightGap = 480 - box!.x - box!.width;
      expect(box!.x).toBeCloseTo(rightGap, 0);
      await page.locator(`#${id}`).evaluate((el) => (el as HTMLDialogElement).close());
      await page.waitForTimeout(200);
    }
  });

  test('dialogs respect minimum margin on very small screens', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');

    for (const id of ['dialog-settings', 'dialog-info']) {
      await page.locator(`#${id}`).evaluate((el) => (el as HTMLDialogElement).showModal());
      await page.waitForTimeout(300);
      const box = await page.locator(`#${id}`).boundingBox();
      const leftGap = box!.x;
      const rightGap = 320 - box!.x - box!.width;
      expect(leftGap).toBeGreaterThanOrEqual(7);
      expect(rightGap).toBeGreaterThanOrEqual(7);
      expect(leftGap).toBeCloseTo(rightGap, 0);
      await page.locator(`#${id}`).evaluate((el) => (el as HTMLDialogElement).close());
      await page.waitForTimeout(200);
    }
  });

  test('font selector buttons fill the full width', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    await page.waitForTimeout(300);

    const groupWidth = await page
      .locator('#dialog-settings .setting-control--group:first-child')
      .evaluate((el) => (el as HTMLElement).offsetWidth);
    const parentWidth = await page
      .locator('#dialog-settings .setting-control--group:first-child')
      .evaluate((el) => ((el as HTMLElement).parentElement as HTMLElement).offsetWidth);
    expect(groupWidth).toBe(parentWidth);
  });

  test('weight buttons do not fill the full width', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    await page.waitForTimeout(300);

    const weightSetting = page.locator('.setting').filter({ hasText: 'weight' });
    const groupWidth = await weightSetting.locator('.setting-control--group').evaluate((el) => (el as HTMLElement).offsetWidth);
    const parentWidth = await weightSetting.evaluate((el) => (el as HTMLElement).offsetWidth);
    expect(groupWidth).toBeLessThan(parentWidth);
  });

  test('sans-serif button text does not wrap', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    await page.waitForTimeout(300);

    const btn = page.locator('#btn-font-sans');
    const height = await btn.evaluate((el) => (el as HTMLElement).offsetHeight);
    expect(height).toBeLessThan(40);
  });
});

// ============================================================
// 7. COPY BUTTON
// ============================================================

test.describe('Copy button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
  });

  test('copy button has correct initial aria-label', async ({ page }) => {
    await expect(page.locator('#btn-copy')).toHaveAttribute('aria-label', 'Copy plain text');
  });

  test('copy shows feedback icon on click', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#editor').fill('test copy');
    await page.locator('#editor').dispatchEvent('input');
    await page.locator('#btn-copy').click();
    await expect(page.locator('#icon-copy-feedback')).toBeVisible();
  });

  test('copy feedback clears on pointerleave', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#editor').fill('test');
    await page.locator('#editor').dispatchEvent('input');
    await page.locator('#btn-copy').click();
    await expect(page.locator('#icon-copy-feedback')).toBeVisible();
    await page.locator('#btn-copy').dispatchEvent('pointerleave');
    await expect(page.locator('#icon-copy')).toBeVisible();
  });

  test('copy feedback auto-clears after timeout', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#editor').fill('test');
    await page.locator('#editor').dispatchEvent('input');
    await page.locator('#btn-copy').click();
    await expect(page.locator('#icon-copy-feedback')).toBeVisible();
    await page.waitForTimeout(600);
    await expect(page.locator('#icon-copy')).toBeVisible();
  });
});

// ============================================================
// 8. SAVE BUTTON
// ============================================================

test.describe('Save button', () => {
  test('save button has correct aria-label', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    await expect(page.locator('#btn-save')).toHaveAttribute('aria-label', 'Save as plaintext file');
  });

  test('save triggers a download', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    await page.locator('#editor').fill('download me');
    await page.locator('#editor').dispatchEvent('input');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#btn-save').click(),
    ]);
    expect(download.suggestedFilename()).toBe('plaintext.txt');
  });
});

// ============================================================
// 9. ACCESSIBILITY
// ============================================================

test.describe('Accessibility', () => {
  test('all toolbar buttons have aria-labels', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    const buttons = page.locator('.toolbar button');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const label = await btn.getAttribute('aria-label');
      expect(label, `Button ${i} should have aria-label`).toBeTruthy();
    }
  });

  test('editor has accessible label', async ({ page }) => {
    await page.goto('/');
    const label = page.locator('label[for="editor"]');
    await expect(label).toHaveText('Plain text editor');
  });

  test('all SVG icons have aria-hidden', async ({ page }) => {
    await page.goto('/');
    const svgs = page.locator('svg.icon');
    const count = await svgs.count();
    for (let i = 0; i < count; i++) {
      await expect(svgs.nth(i)).toHaveAttribute('aria-hidden', 'true');
    }
  });

  test('nav has correct aria-label', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.toolbar-nav')).toHaveAttribute('aria-label', 'Info');
  });

  test('controls group has correct aria-label', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.toolbar-controls')).toHaveAttribute('aria-label', 'Editor controls');
  });

  test('settings dialog has aria-labelledby', async ({ page }) => {
    await page.goto('/');
    const dialog = page.locator('#dialog-settings');
    await expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-settings-title');
  });

  test('dialogs have aria-labelledby and aria-describedby', async ({ page }) => {
    await page.goto('/');
    for (const id of ['dialog-info']) {
      const dialog = page.locator(`#${id}`);
      await expect(dialog).toHaveAttribute('aria-labelledby', `${id}-title`);
      await expect(dialog).toHaveAttribute('aria-describedby', `${id}-desc`);
    }
  });
});

// ============================================================
// 10. BROWSER-QUIETING ATTRIBUTES
// ============================================================

test.describe('Browser-quieting attributes', () => {
  test('editor suppresses autocorrect', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#editor')).toHaveAttribute('autocorrect', 'off');
  });

  test('editor suppresses spellcheck', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#editor')).toHaveAttribute('spellcheck', 'false');
  });

  test('editor suppresses autocomplete', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#editor')).toHaveAttribute('autocomplete', 'off');
  });

  test('editor suppresses Grammarly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#editor')).toHaveAttribute('data-gramm', 'false');
  });

  test('editor suppresses 1Password', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#editor')).toHaveAttribute('data-1p-ignore', 'true');
  });

  test('editor suppresses LastPass', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#editor')).toHaveAttribute('data-lpignore', 'true');
  });
});

// ============================================================
// 11. CROSS-TAB SYNC VIA LOCALSTORAGE
// ============================================================

test.describe('Cross-tab localStorage sync', () => {
  // Wait for AppShell to finish mounting before dispatching events — the
  // <svelte:window onstorage> listener binds only after mount completes,
  // so early dispatches get dropped (flaky tests otherwise).
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#app-shell:not(.loading)');
  });

  test('theme syncs via storage event', async ({ page }) => {
    await page.evaluate(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'plaintext:theme',
        newValue: 'dark',
        storageArea: localStorage,
      }));
    });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('font size syncs via storage event', async ({ page }) => {
    await page.evaluate(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'plaintext:fontSize',
        newValue: '20',
        storageArea: localStorage,
      }));
    });
    await expect
      .poll(async () => page.locator('#editor').evaluate((el) => (el as HTMLElement).style.fontSize))
      .toBe('20px');
  });

  test('toolbar visibility syncs via storage event', async ({ page }) => {
    await page.evaluate(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'plaintext:toolbarIcons',
        newValue: 'visible',
        storageArea: localStorage,
      }));
    });
    await expect(page.locator('#toolbar')).not.toHaveClass(/hidden/);
  });

  test('font weight syncs via storage event', async ({ page }) => {
    await page.evaluate(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'plaintext:fontWeight',
        newValue: '600',
        storageArea: localStorage,
      }));
    });
    await expect
      .poll(async () => page.locator('#editor').evaluate((el) => (el as HTMLElement).style.fontWeight))
      .toBe('600');
  });

  test('font italic syncs via storage event', async ({ page }) => {
    await page.evaluate(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'plaintext:fontItalic',
        newValue: 'true',
        storageArea: localStorage,
      }));
    });
    await expect
      .poll(async () => page.locator('#editor').evaluate((el) => (el as HTMLElement).style.fontStyle))
      .toBe('italic');
  });
});

// ============================================================
// 11b. SETTINGS DIALOG
// ============================================================

test.describe('Settings dialog', () => {
  test('settings dialog opens and closes', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    await page.locator('#btn-settings').click();
    const dialog = page.locator('#dialog-settings');
    await expect(dialog).toBeVisible();
    await dialog.locator('.dialog-close').click();
    await expect(dialog).not.toBeVisible();
  });

  test('settings dialog has correct title', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    await expect(page.locator('#dialog-settings-title')).toHaveText('settings');
  });

  test('font weight light button sets weight to 200', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    await page.locator('#btn-weight-light').click();
    const weight = await page.locator('#editor').evaluate((el) => parseInt((el as HTMLElement).style.fontWeight));
    expect(weight).toBe(200);
    await expect(page.locator('#btn-weight-light')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#btn-weight-regular')).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('#btn-weight-bold')).toHaveAttribute('aria-checked', 'false');
  });

  test('font weight regular button sets weight to 300', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    await page.locator('#btn-weight-light').click();
    await page.locator('#btn-weight-regular').click();
    const weight = await page.locator('#editor').evaluate((el) => parseInt((el as HTMLElement).style.fontWeight));
    expect(weight).toBe(300);
    await expect(page.locator('#btn-weight-regular')).toHaveAttribute('aria-checked', 'true');
  });

  test('font weight bold button sets weight to 600', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    await page.locator('#btn-weight-bold').click();
    const weight = await page.locator('#editor').evaluate((el) => parseInt((el as HTMLElement).style.fontWeight));
    expect(weight).toBe(600);
    await expect(page.locator('#btn-weight-bold')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#btn-weight-regular')).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('#btn-weight-light')).toHaveAttribute('aria-checked', 'false');
  });

  test('font weight persists across reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    await page.locator('#btn-weight-bold').click();
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    const weight = await page.locator('#editor').evaluate((el) => parseInt((el as HTMLElement).style.fontWeight));
    expect(weight).toBe(600);
  });

  test('italic toggle works', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    const btn = page.locator('#btn-italic');
    await expect(btn).toHaveText('off');
    await expect(btn).toHaveAttribute('aria-checked', 'false');
    await btn.click();
    await expect(btn).toHaveText('on');
    await expect(btn).toHaveAttribute('aria-checked', 'true');
    const style = await page.locator('#editor').evaluate((el) => (el as HTMLElement).style.fontStyle);
    expect(style).toBe('italic');
  });

  test('italic persists across reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    await page.locator('#btn-italic').click();
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    const style = await page.locator('#editor').evaluate((el) => (el as HTMLElement).style.fontStyle);
    expect(style).toBe('italic');
  });

  test('reset button restores defaults', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    await page.locator('#btn-font-up').click();
    await page.locator('#btn-weight-bold').click();
    await page.locator('#btn-italic').click();
    await page.locator('#btn-reset').click();
    const editor = page.locator('#editor');
    const size = await editor.evaluate((el) => parseInt((el as HTMLElement).style.fontSize));
    const weight = await editor.evaluate((el) => parseInt((el as HTMLElement).style.fontWeight));
    const style = await editor.evaluate((el) => (el as HTMLElement).style.fontStyle);
    expect(size).toBe(16);
    expect(weight).toBe(300);
    expect(style).toBe('normal');
    await expect(page.locator('#btn-italic')).toHaveText('off');
  });

  test('reset persists across reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    await page.locator('#btn-font-up').click();
    await page.locator('#btn-weight-bold').click();
    await page.locator('#btn-italic').click();
    await page.locator('#btn-reset').click();
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    const editor = page.locator('#editor');
    const size = await editor.evaluate((el) => parseInt((el as HTMLElement).style.fontSize));
    const weight = await editor.evaluate((el) => parseInt((el as HTMLElement).style.fontWeight));
    const style = await editor.evaluate((el) => (el as HTMLElement).style.fontStyle);
    expect(size).toBe(16);
    expect(weight).toBe(300);
    expect(style).toBe('normal');
  });
});

// ============================================================
// 12. PWA MANIFEST
// ============================================================

test.describe('PWA', () => {
  test('manifest link is present', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  });

  test('apple-touch-icon is present', async ({ page }) => {
    await page.goto('/');
    // Chromium canonicalizes apple-touch-icon href to an absolute URL in the
    // DOM, even when the source attribute is a root-relative path. Match on
    // the filename instead of the exact value.
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', /\/apple-touch-icon\.png$/);
  });

  test('manifest file is valid JSON', async ({ request }) => {
    // Use the request API rather than `page.goto` — browsers download files
    // with Content-Type application/manifest+json, which breaks navigation.
    const response = await request.get('/manifest.webmanifest');
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.name).toBe('plaintext.gg');
    expect(json.short_name).toBe('plaintext');
    expect(json.display).toBe('standalone');
    expect(json.icons.length).toBe(3);
  });
});

// ============================================================
// 13. STATIC ASSETS
// ============================================================

test.describe('Static assets', () => {
  test('favicon loads', async ({ request }) => {
    const response = await request.get('/favicon.ico');
    expect(response.status()).toBe(200);
  });

  test('SVG icon loads', async ({ request }) => {
    const response = await request.get('/icon.svg');
    expect(response.status()).toBe(200);
  });

  test('theme-init script loads', async ({ request }) => {
    const response = await request.get('/theme-init.js');
    expect(response.status()).toBe(200);
  });
});

// ============================================================
// 14. EDITOR BEHAVIOR ATTRIBUTES
// ============================================================

test.describe('Editor behavior', () => {
  test('editor has inputmode=text', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#editor')).toHaveAttribute('inputmode', 'text');
  });

  test('editor has enterkeyhint=enter', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#editor')).toHaveAttribute('enterkeyhint', 'enter');
  });

  test('editor has translate=no', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#editor')).toHaveAttribute('translate', 'no');
  });
});

// ============================================================
// 15. COMBINED FEATURE INTERACTIONS
// ============================================================

test.describe('Combined interactions', () => {
  test('text persists after theme change', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    const editor = page.locator('#editor');
    await editor.fill('before theme change');
    await editor.dispatchEvent('input');
    await waitForPersisted(page, 'current', 'before theme change');
    await page.locator('#btn-theme').click();
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    await expect(page.locator('#editor')).toHaveValue('before theme change');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('font size and theme persist together', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    await page.locator('#btn-theme').click();
    await page.locator('#dialog-settings').evaluate((el) => (el as HTMLDialogElement).showModal());
    await page.locator('#btn-font-up').click();
    await page.locator('#btn-font-up').click();
    await page.locator('#btn-font-up').click();
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const size = await page.locator('#editor').evaluate((el) => parseInt((el as HTMLElement).style.fontSize));
    expect(size).toBe(22);
  });

  test('toolbar state, theme, and text all persist', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    await page.locator('#btn-theme').click();
    await page.locator('#editor').fill('everything persists');
    await page.locator('#editor').dispatchEvent('input');
    await waitForPersisted(page, 'current', 'everything persists');
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    await expect(page.locator('#toolbar')).not.toHaveClass(/hidden/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('#editor')).toHaveValue('everything persists');
  });
});

// ============================================================
// 16. FILE UPLOAD
// ============================================================

test.describe('File upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
  });

  test('upload button is present and has correct aria-label', async ({ page }) => {
    const btn = page.locator('#btn-upload');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('aria-label', 'Upload text file');
  });

  test('upload button sits between save and copy', async ({ page }) => {
    const controls = page.locator('.toolbar-controls');
    const buttons = controls.locator('> button.btn-icon');
    const ids = await buttons.evaluateAll((els) => els.map((el) => el.id));
    const saveIdx = ids.indexOf('btn-save');
    const uploadIdx = ids.indexOf('btn-upload');
    const copyIdx = ids.indexOf('btn-copy');
    expect(saveIdx).toBeGreaterThanOrEqual(0);
    expect(uploadIdx).toBe(saveIdx + 1);
    expect(copyIdx).toBe(uploadIdx + 1);
  });

  test('hidden file input exists with multiple attribute', async ({ page }) => {
    const input = page.locator('#file-upload');
    await expect(input).toHaveAttribute('multiple', '');
    await expect(input).toBeHidden();
  });

  test('uploading a single text file inserts its content', async ({ page }) => {
    const editor = page.locator('#editor');
    await page.locator('#file-upload').setInputFiles({
      name: 'hello.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello from file'),
    });
    await expect(editor).toHaveValue('hello from file');
  });

  test('uploaded text is inserted at cursor position', async ({ page }) => {
    const editor = page.locator('#editor');
    await editor.fill('before  after');
    await editor.dispatchEvent('input');
    await editor.evaluate((el) => {
      (el as HTMLTextAreaElement).setSelectionRange(7, 7);
    });
    await page.locator('#file-upload').setInputFiles({
      name: 'insert.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('MIDDLE'),
    });
    await expect(editor).toHaveValue('before MIDDLE after');
  });

  test('uploaded text replaces current selection', async ({ page }) => {
    const editor = page.locator('#editor');
    await editor.fill('hello world');
    await editor.dispatchEvent('input');
    await editor.evaluate((el) => {
      (el as HTMLTextAreaElement).setSelectionRange(6, 11);
    });
    await page.locator('#file-upload').setInputFiles({
      name: 'replace.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('universe'),
    });
    await expect(editor).toHaveValue('hello universe');
  });

  test('uploading multiple files concatenates their content', async ({ page }) => {
    const editor = page.locator('#editor');
    await page.locator('#file-upload').setInputFiles([
      { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('first') },
      { name: 'b.txt', mimeType: 'text/plain', buffer: Buffer.from('second') },
      { name: 'c.txt', mimeType: 'text/plain', buffer: Buffer.from('third') },
    ]);
    await expect(editor).toHaveValue('first\nsecond\nthird');
  });

  test('binary file shows error message instead of content', async ({ page }) => {
    const editor = page.locator('#editor');
    const binaryBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00]);
    await page.locator('#file-upload').setInputFiles({
      name: 'image.png',
      mimeType: 'image/png',
      buffer: binaryBuffer,
    });
    await expect(editor).toHaveValue('image.png is not a text file');
  });

  test('mix of text and binary files handles each correctly', async ({ page }) => {
    const editor = page.locator('#editor');
    const binaryBuffer = Buffer.from([0x00, 0x01, 0x02]);
    await page.locator('#file-upload').setInputFiles([
      { name: 'readme.txt', mimeType: 'text/plain', buffer: Buffer.from('readable') },
      { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: binaryBuffer },
    ]);
    await expect(editor).toHaveValue('readable\nphoto.jpg is not a text file');
  });

  test('files with non-standard extensions are read as text', async ({ page }) => {
    const editor = page.locator('#editor');
    await page.locator('#file-upload').setInputFiles({
      name: 'config.yaml',
      mimeType: 'application/x-yaml',
      buffer: Buffer.from('key: value'),
    });
    await expect(editor).toHaveValue('key: value');
  });

  test('extensionless files are read as text', async ({ page }) => {
    const editor = page.locator('#editor');
    await page.locator('#file-upload').setInputFiles({
      name: 'Makefile',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('all: build'),
    });
    await expect(editor).toHaveValue('all: build');
  });

  test('uploaded text persists across reload', async ({ page }) => {
    await page.locator('#file-upload').setInputFiles({
      name: 'persist.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('should persist'),
    });
    await expect(page.locator('#editor')).toHaveValue('should persist');
    await waitForPersisted(page, 'current', 'should persist');
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    await expect(page.locator('#editor')).toHaveValue('should persist');
  });

  test('upload appends at end when cursor is at end', async ({ page }) => {
    const editor = page.locator('#editor');
    await editor.fill('existing');
    await editor.dispatchEvent('input');
    await editor.evaluate((el) => {
      const ta = el as HTMLTextAreaElement;
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
    await page.locator('#file-upload').setInputFiles({
      name: 'more.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(' content'),
    });
    await expect(editor).toHaveValue('existing content');
  });

  test('upload prepends when cursor is at start', async ({ page }) => {
    const editor = page.locator('#editor');
    await editor.fill('existing');
    await editor.dispatchEvent('input');
    await editor.evaluate((el) => {
      (el as HTMLTextAreaElement).setSelectionRange(0, 0);
    });
    await page.locator('#file-upload').setInputFiles({
      name: 'prefix.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('new '),
    });
    await expect(editor).toHaveValue('new existing');
  });

  test('upload button works multiple times in sequence', async ({ page }) => {
    const editor = page.locator('#editor');
    await page.locator('#file-upload').setInputFiles({
      name: 'first.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('aaa'),
    });
    await expect(editor).toHaveValue('aaa');
    await page.locator('#file-upload').setInputFiles({
      name: 'second.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('bbb'),
    });
    await expect(editor).toHaveValue('aaabbb');
  });

  test('drag over editor shows visual feedback', async ({ page }) => {
    const editor = page.locator('#editor');
    const mainEl = page.locator('main');
    await editor.evaluate((el) => {
      const dt = new DataTransfer();
      dt.items.add(new File(['test'], 'test.txt', { type: 'text/plain' }));
      const event = new DragEvent('dragover', { dataTransfer: dt, bubbles: true });
      el.dispatchEvent(event);
    });
    await expect(mainEl).toHaveClass(/dragover/);
  });

  test('drag leave removes visual feedback', async ({ page }) => {
    const editor = page.locator('#editor');
    const mainEl = page.locator('main');
    await editor.evaluate((el) => {
      const dt = new DataTransfer();
      dt.items.add(new File(['test'], 'test.txt', { type: 'text/plain' }));
      el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true }));
    });
    await expect(mainEl).toHaveClass(/dragover/);
    await editor.evaluate((el) => {
      el.dispatchEvent(new DragEvent('dragleave', { bubbles: true, relatedTarget: null } as DragEventInit));
    });
    await expect(mainEl).not.toHaveClass(/dragover/);
  });

  test('dropping a text file inserts its content', async ({ page }) => {
    const editor = page.locator('#editor');
    await editor.evaluate((el) => {
      const dt = new DataTransfer();
      dt.items.add(new File(['dropped content'], 'drop.txt', { type: 'text/plain' }));
      el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
    await expect(editor).toHaveValue('dropped content');
  });

  test('dropping removes dragover feedback', async ({ page }) => {
    const editor = page.locator('#editor');
    const mainEl = page.locator('main');
    await editor.evaluate((el) => {
      const dt = new DataTransfer();
      dt.items.add(new File(['test'], 'test.txt', { type: 'text/plain' }));
      el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true }));
    });
    await expect(mainEl).toHaveClass(/dragover/);
    await editor.evaluate((el) => {
      const dt = new DataTransfer();
      dt.items.add(new File(['test'], 'test.txt', { type: 'text/plain' }));
      el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
    await expect(mainEl).not.toHaveClass(/dragover/);
  });

  test('dropping a binary file shows error message', async ({ page }) => {
    const editor = page.locator('#editor');
    await editor.evaluate((el) => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]);
      const file = new File([bytes], 'image.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
    await expect(editor).toHaveValue('image.png is not a text file');
  });

  test('dropping multiple files concatenates their content', async ({ page }) => {
    const editor = page.locator('#editor');
    await editor.evaluate((el) => {
      const dt = new DataTransfer();
      dt.items.add(new File(['alpha'], 'a.txt', { type: 'text/plain' }));
      dt.items.add(new File(['beta'], 'b.txt', { type: 'text/plain' }));
      el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
    await expect(editor).toHaveValue('alpha\nbeta');
  });
});

// ============================================================
// TOOLBAR RESPONSIVE LAYOUT
// ============================================================

test.describe('Toolbar responsive layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    await expect(page.locator('#toolbar')).not.toHaveClass(/hidden/);
  });

  test('mobile: toolbar-nav and toolbar-controls use display:contents', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const nav = page.locator('.toolbar-nav');
    const controls = page.locator('.toolbar-controls');
    const navDisplay = await nav.evaluate((el) => getComputedStyle(el).display);
    const controlsDisplay = await controls.evaluate((el) => getComputedStyle(el).display);
    expect(navDisplay).toBe('contents');
    expect(controlsDisplay).toBe('contents');
  });

  test('mobile: all toolbar buttons sit in a single row', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const buttons = page.locator('.toolbar button.btn-icon');
    const tops = await buttons.evaluateAll((els) =>
      els
        .filter((el) => getComputedStyle(el).display !== 'none')
        .map((el) => el.getBoundingClientRect().top)
    );
    expect(tops.length).toBeGreaterThan(1);
    const firstTop = tops[0];
    for (const top of tops) {
      expect(top).toBe(firstTop);
    }
  });

  test('mobile: toolbar uses justify-content start', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const toolbar = page.locator('#toolbar');
    const justify = await toolbar.evaluate((el) => getComputedStyle(el).justifyContent);
    expect(justify).toBe('start');
  });

  test('desktop: toolbar-nav and toolbar-controls are flex containers', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    const nav = page.locator('.toolbar-nav');
    const controls = page.locator('.toolbar-controls');
    const navDisplay = await nav.evaluate((el) => getComputedStyle(el).display);
    const controlsDisplay = await controls.evaluate((el) => getComputedStyle(el).display);
    expect(navDisplay).toBe('flex');
    expect(controlsDisplay).toBe('flex');
  });

  test('desktop: toolbar uses justify-content space-between', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    const toolbar = page.locator('#toolbar');
    const justify = await toolbar.evaluate((el) => getComputedStyle(el).justifyContent);
    expect(justify).toBe('space-between');
  });

  test('desktop: info button is on the left, controls on the right', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    const navBox = await page.locator('.toolbar-nav').boundingBox();
    const controlsBox = await page.locator('.toolbar-controls').boundingBox();
    expect(navBox!.x).toBeLessThan(controlsBox!.x);
  });
});

// ============================================================
// TOUCH DEVICE: BUTTONS MUST NOT STICK IN HOVER STATE
// ============================================================

test.describe('Touch device button hover', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    await expect(page.locator('#toolbar')).not.toHaveClass(/hidden/);
  });

  // Tailwind v4's `hover:` variant ships pre-wrapped in @media (hover: hover),
  // so scanning the stylesheet for a specific `.btn:hover` selector no longer
  // makes sense. Behavioral coverage comes from the "touch-only" test below.

  test('any hover:* utility rule is inside @media (hover: hover)', async ({ page }) => {
    const anyUnguarded = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSStyleRule && rule.selectorText?.includes('\\:hover')) {
              // A compiled Tailwind hover utility living outside a media query
              // is a regression — fail.
              return true;
            }
          }
        } catch {
          /* cross-origin stylesheets throw; ignore */
        }
      }
      return false;
    });
    expect(anyUnguarded).toBe(false);
  });

  test('touch-only: button color does not change on hover', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.setViewportSize({ width: 375, height: 667 });

    const btn = page.locator('#btn-copy');
    const baseColor = await btn.evaluate((el) => getComputedStyle(el).color);

    await btn.dispatchEvent('pointerenter');
    await btn.dispatchEvent('mouseenter');
    await btn.dispatchEvent('pointerleave');
    await btn.dispatchEvent('mouseleave');
    const afterColor = await btn.evaluate((el) => getComputedStyle(el).color);
    expect(afterColor).toBe(baseColor);
  });

  test('copy button feedback clears on pointerleave (touch-friendly)', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#editor').fill('touch test');
    await page.locator('#editor').dispatchEvent('input');

    const btn = page.locator('#btn-copy');
    await btn.click();
    await expect(page.locator('#icon-copy-feedback')).toBeVisible();
    expect(await btn.evaluate((el) => el.classList.contains('copy-success'))).toBe(true);

    await btn.dispatchEvent('pointerleave');
    await expect(page.locator('#icon-copy')).toBeVisible();
    expect(await btn.evaluate((el) => el.classList.contains('copy-success'))).toBe(false);
  });
});
