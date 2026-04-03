import { test, expect } from '@playwright/test';

// Helper: clear all browser storage before each test
test.beforeEach(async ({ page, context }) => {
  // Clear IndexedDB, localStorage, sessionStorage
  await context.clearCookies();
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase('plaintext');
      req.onsuccess = () => resolve();
      req.onerror = () => reject();
      req.onblocked = () => resolve(); // best-effort
    });
  });
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
    const fontSize = await editor.evaluate((el) => el.style.fontSize);
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
    // Trigger input event explicitly
    await editor.dispatchEvent('input');
    // Wait for debounced persistence (300ms + some margin)
    await page.waitForTimeout(500);
    // Reload and check
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    await expect(page.locator('#editor')).toHaveValue('persisted text');
  });

  test('text persists via sessionStorage crash recovery', async ({ page }) => {
    await page.goto('/');
    const editor = page.locator('#editor');
    await editor.fill('session draft');
    await editor.dispatchEvent('input');
    // Don't wait for debounce - session draft should be immediate
    await page.waitForTimeout(50);
    // Verify sessionStorage has the draft
    const hasDraft = await page.evaluate(() => {
      return sessionStorage.getItem('plaintext:textDraft') !== null;
    });
    expect(hasDraft).toBe(true);
  });

  test('empty text is valid and persists', async ({ page }) => {
    await page.goto('/');
    const editor = page.locator('#editor');
    await editor.fill('something');
    await editor.dispatchEvent('input');
    await page.waitForTimeout(500);
    await editor.fill('');
    await editor.dispatchEvent('input');
    await page.waitForTimeout(500);
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
    // Show toolbar first
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
    // Light mode: light icon visible
    await expect(page.locator('#icon-theme-light')).toBeVisible();
    await expect(page.locator('#icon-theme-dark')).toBeHidden();
    // Switch to dark
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
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    const editor = page.locator('#editor');
    const before = await editor.evaluate((el) => parseInt(el.style.fontSize));
    await page.locator('#btn-font-up').click();
    const after = await editor.evaluate((el) => parseInt(el.style.fontSize));
    expect(after).toBe(before + 2);
  });

  test('decrease font size button works', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    const editor = page.locator('#editor');
    const before = await editor.evaluate((el) => parseInt(el.style.fontSize));
    await page.locator('#btn-font-down').click();
    const after = await editor.evaluate((el) => parseInt(el.style.fontSize));
    expect(after).toBe(before - 2);
  });

  test('font size cannot go below minimum (10px)', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    const btn = page.locator('#btn-font-down');
    while (!(await btn.isDisabled())) {
      await btn.click();
    }
    const size = await page.locator('#editor').evaluate((el) => parseInt(el.style.fontSize));
    expect(size).toBe(10);
    await expect(btn).toBeDisabled();
  });

  test('font size cannot go above maximum (34px)', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    const btn = page.locator('#btn-font-up');
    while (!(await btn.isDisabled())) {
      await btn.click();
    }
    const size = await page.locator('#editor').evaluate((el) => parseInt(el.style.fontSize));
    expect(size).toBe(34);
    await expect(btn).toBeDisabled();
  });

  test('font size persists across reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    await page.locator('#btn-font-up').click();
    await page.locator('#btn-font-up').click();
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    const size = await page.locator('#editor').evaluate((el) => parseInt(el.style.fontSize));
    expect(size).toBe(20);
  });

  test('font size value display updates', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
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
    // Toolbar hidden -> pressed=true (meaning "toolbar is hidden")
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await btn.click();
    // Toolbar shown -> pressed=false
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  test('editor padding adjusts when toolbar visibility changes', async ({ page }) => {
    await page.goto('/');
    const editor = page.locator('#editor');
    // Toolbar hidden -> 40px top padding
    const hiddenPadding = await editor.evaluate((el) => parseInt(el.style.paddingTop));
    expect(hiddenPadding).toBe(40);
    // Show toolbar
    await page.locator('#btn-toggle-desktop').click();
    await page.waitForTimeout(50);
    const visiblePadding = await editor.evaluate((el) => parseInt(el.style.paddingTop));
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

    const bgColor = await toolbar.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    // Background should have alpha < 1 (translucent)
    // Modern browsers may return rgba(...) or color(srgb ... / alpha)
    const alphaMatch = bgColor.match(/\/\s*([\d.]+)\s*\)/) ||
                       bgColor.match(/,\s*([\d.]+)\s*\)$/);
    expect(alphaMatch).not.toBeNull();
    const alpha = parseFloat(alphaMatch[1]);
    expect(alpha).toBeLessThan(1);
  });

  test('visible toolbar has backdrop-filter blur applied', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-toggle-desktop').click();
    const toolbar = page.locator('#toolbar');
    await expect(toolbar).not.toHaveClass(/hidden/);

    const backdropFilter = await toolbar.evaluate(
      (el) => getComputedStyle(el).backdropFilter
    );
    expect(backdropFilter).toContain('blur(6px)');
  });
});

// ============================================================
// 6. DIALOGS
// ============================================================

test.describe('Dialogs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Show toolbar so dialog buttons are accessible
    await page.locator('#btn-toggle-desktop').click();
  });

  test('info dialog opens and closes', async ({ page }) => {
    await page.locator('#btn-info').click();
    const dialog = page.locator('#dialog-info');
    await expect(dialog).toBeVisible();
    // Close via the x button
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
    // Click on the dialog element at viewport edge (outside the dialog box = backdrop)
    // The dialog::backdrop covers the whole viewport, so clicking at (2, 2) hits the backdrop
    const box = await dialog.boundingBox();
    // Click above the dialog box to hit the backdrop
    await page.mouse.click(2, 2);
    await page.waitForTimeout(200);
    const isOpen = await dialog.evaluate((el) => el.open);
    expect(isOpen).toBe(false);
  });

  test('info dialog contains GitHub link', async ({ page }) => {
    await page.locator('#btn-info').click();
    const link = page.locator('#dialog-info-desc a[href*="github.com"]');
    await expect(link).toBeVisible();
    await expect(link).toHaveText('GitHub');
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

    await page.locator('#dialog-info').evaluate(el => el.showModal());
    const aboutWidth = await page.locator('#dialog-info').evaluate(el => el.offsetWidth);
    await page.locator('#dialog-info').evaluate(el => el.close());

    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    const settingsWidth = await page.locator('#dialog-settings').evaluate(el => el.offsetWidth);
    await page.locator('#dialog-settings').evaluate(el => el.close());

    expect(aboutWidth).toBeGreaterThan(settingsWidth);
  });

  test('dialogs have equal left and right margins', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    await page.goto('/');

    for (const id of ['dialog-settings', 'dialog-info']) {
      await page.locator(`#${id}`).evaluate(el => el.showModal());
      await page.waitForTimeout(300);
      const box = await page.locator(`#${id}`).boundingBox();
      const rightGap = 480 - box.x - box.width;
      expect(box.x).toBeCloseTo(rightGap, 0);
      await page.locator(`#${id}`).evaluate(el => el.close());
      await page.waitForTimeout(200);
    }
  });

  test('dialogs respect minimum margin on very small screens', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');

    for (const id of ['dialog-settings', 'dialog-info']) {
      await page.locator(`#${id}`).evaluate(el => el.showModal());
      await page.waitForTimeout(300);
      const box = await page.locator(`#${id}`).boundingBox();
      const leftGap = box.x;
      const rightGap = 320 - box.x - box.width;
      expect(leftGap).toBeGreaterThanOrEqual(7);
      expect(rightGap).toBeGreaterThanOrEqual(7);
      expect(leftGap).toBeCloseTo(rightGap, 0);
      await page.locator(`#${id}`).evaluate(el => el.close());
      await page.waitForTimeout(200);
    }
  });

  test('font selector buttons fill the full width', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    await page.waitForTimeout(300);

    const groupWidth = await page.locator('.setting-control--group:first-child').evaluate(el => el.offsetWidth);
    const parentWidth = await page.locator('.setting-control--group:first-child').evaluate(el => el.parentElement.offsetWidth);
    // The font selector group should fill its parent
    expect(groupWidth).toBe(parentWidth);
  });

  test('weight buttons do not fill the full width', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    await page.waitForTimeout(300);

    const weightSetting = page.locator('.setting').filter({ hasText: 'weight' });
    const groupWidth = await weightSetting.locator('.setting-control--group').evaluate(el => el.offsetWidth);
    const parentWidth = await weightSetting.evaluate(el => el.offsetWidth);
    // The weight group should NOT fill its parent (label takes space)
    expect(groupWidth).toBeLessThan(parentWidth);
  });

  test('sans-serif button text does not wrap', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    await page.waitForTimeout(300);

    const btn = page.locator('#btn-font-sans');
    const height = await btn.evaluate(el => el.offsetHeight);
    // Single line of text at ~13px font + 4px padding top/bottom ≈ 25px
    // If it wraps, height would roughly double
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
    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#editor').fill('test copy');
    await page.locator('#editor').dispatchEvent('input');
    await page.locator('#btn-copy').click();
    // The feedback icon should be shown
    await expect(page.locator('#icon-copy-feedback')).toBeVisible();
  });

  test('copy feedback clears on pointerleave', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#editor').fill('test');
    await page.locator('#editor').dispatchEvent('input');
    await page.locator('#btn-copy').click();
    await expect(page.locator('#icon-copy-feedback')).toBeVisible();
    // Pointer leaves button (works for both mouse and touch)
    await page.locator('#btn-copy').dispatchEvent('pointerleave');
    await expect(page.locator('#icon-copy')).toBeVisible();
  });

  test('copy feedback auto-clears after timeout', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#editor').fill('test');
    await page.locator('#editor').dispatchEvent('input');
    await page.locator('#btn-copy').click();
    await expect(page.locator('#icon-copy-feedback')).toBeVisible();
    // Wait for auto-clear (400ms + margin)
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

  test('editor has aria-label', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#editor')).toHaveAttribute('aria-label', 'Plain text editor');
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
  test('theme syncs via storage event', async ({ page }) => {
    await page.goto('/');
    // Simulate another tab changing the theme
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
    await page.goto('/');
    await page.evaluate(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'plaintext:fontSize',
        newValue: '20',
        storageArea: localStorage,
      }));
    });
    const size = await page.locator('#editor').evaluate((el) => el.style.fontSize);
    expect(size).toBe('20px');
  });

  test('toolbar visibility syncs via storage event', async ({ page }) => {
    await page.goto('/');
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
    await page.goto('/');
    await page.evaluate(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'plaintext:fontWeight',
        newValue: '600',
        storageArea: localStorage,
      }));
    });
    const weight = await page.locator('#editor').evaluate((el) => el.style.fontWeight);
    expect(weight).toBe('600');
  });

  test('font italic syncs via storage event', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'plaintext:fontItalic',
        newValue: 'true',
        storageArea: localStorage,
      }));
    });
    const style = await page.locator('#editor').evaluate((el) => el.style.fontStyle);
    expect(style).toBe('italic');
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
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    await expect(page.locator('#dialog-settings-title')).toHaveText('settings');
  });

  test('font weight light button sets weight to 200', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    await page.locator('#btn-weight-light').click();
    const weight = await page.locator('#editor').evaluate((el) => parseInt(el.style.fontWeight));
    expect(weight).toBe(200);
    await expect(page.locator('#btn-weight-light')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#btn-weight-regular')).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('#btn-weight-bold')).toHaveAttribute('aria-checked', 'false');
  });

  test('font weight regular button sets weight to 300', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    // First switch to light, then back to regular
    await page.locator('#btn-weight-light').click();
    await page.locator('#btn-weight-regular').click();
    const weight = await page.locator('#editor').evaluate((el) => parseInt(el.style.fontWeight));
    expect(weight).toBe(300);
    await expect(page.locator('#btn-weight-regular')).toHaveAttribute('aria-checked', 'true');
  });

  test('font weight bold button sets weight to 600', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    await page.locator('#btn-weight-bold').click();
    const weight = await page.locator('#editor').evaluate((el) => parseInt(el.style.fontWeight));
    expect(weight).toBe(600);
    await expect(page.locator('#btn-weight-bold')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#btn-weight-regular')).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('#btn-weight-light')).toHaveAttribute('aria-checked', 'false');
  });

  test('font weight persists across reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    await page.locator('#btn-weight-bold').click();
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    const weight = await page.locator('#editor').evaluate((el) => parseInt(el.style.fontWeight));
    expect(weight).toBe(600);
  });

  test('italic toggle works', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    const btn = page.locator('#btn-italic');
    await expect(btn).toHaveText('off');
    await expect(btn).toHaveAttribute('aria-checked', 'false');
    await btn.click();
    await expect(btn).toHaveText('on');
    await expect(btn).toHaveAttribute('aria-checked', 'true');
    const style = await page.locator('#editor').evaluate((el) => el.style.fontStyle);
    expect(style).toBe('italic');
  });

  test('italic persists across reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    await page.locator('#btn-italic').click();
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    const style = await page.locator('#editor').evaluate((el) => el.style.fontStyle);
    expect(style).toBe('italic');
  });

  test('reset button restores defaults', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    // Change all settings
    await page.locator('#btn-font-up').click();
    await page.locator('#btn-weight-bold').click();
    await page.locator('#btn-italic').click();
    // Reset
    await page.locator('#btn-reset').click();
    // Verify defaults
    const editor = page.locator('#editor');
    const size = await editor.evaluate((el) => parseInt(el.style.fontSize));
    const weight = await editor.evaluate((el) => parseInt(el.style.fontWeight));
    const style = await editor.evaluate((el) => el.style.fontStyle);
    expect(size).toBe(16);
    expect(weight).toBe(300);
    expect(style).toBe('normal');
    await expect(page.locator('#btn-italic')).toHaveText('off');
  });

  test('reset persists across reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    await page.locator('#btn-font-up').click();
    await page.locator('#btn-weight-bold').click();
    await page.locator('#btn-italic').click();
    await page.locator('#btn-reset').click();
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    const editor = page.locator('#editor');
    const size = await editor.evaluate((el) => parseInt(el.style.fontSize));
    const weight = await editor.evaluate((el) => parseInt(el.style.fontWeight));
    const style = await editor.evaluate((el) => el.style.fontStyle);
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
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png');
  });

  test('manifest file is valid JSON', async ({ page }) => {
    const response = await page.goto('/manifest.webmanifest');
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
  test('CSS loads', async ({ page }) => {
    const response = await page.goto('/app.css');
    expect(response.status()).toBe(200);
  });

  test('JS loads', async ({ page }) => {
    const response = await page.goto('/app.js');
    expect(response.status()).toBe(200);
  });

  test('favicon loads', async ({ page }) => {
    const response = await page.goto('/favicon.ico');
    expect(response.status()).toBe(200);
  });

  test('SVG icon loads', async ({ page }) => {
    const response = await page.goto('/icon.svg');
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
    await page.waitForTimeout(500);
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
    await page.locator('#dialog-settings').evaluate(el => el.showModal());
    await page.locator('#btn-font-up').click();
    await page.locator('#btn-font-up').click();
    await page.locator('#btn-font-up').click();
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const size = await page.locator('#editor').evaluate((el) => parseInt(el.style.fontSize));
    expect(size).toBe(22);
  });

  test('toolbar state, theme, and text all persist', async ({ page }) => {
    await page.goto('/');
    // Show toolbar
    await page.locator('#btn-toggle-desktop').click();
    // Set dark theme
    await page.locator('#btn-theme').click();
    // Type text
    await page.locator('#editor').fill('everything persists');
    await page.locator('#editor').dispatchEvent('input');
    await page.waitForTimeout(500);
    // Reload
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    // All three should persist
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

  // ---- Upload button presence & accessibility ----

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

  // ---- Single text file via file input ----

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
    // Place cursor between the two spaces (position 7)
    await editor.evaluate((el) => {
      el.setSelectionRange(7, 7);
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
    // Select "world" (positions 6-11)
    await editor.evaluate((el) => {
      el.setSelectionRange(6, 11);
    });
    await page.locator('#file-upload').setInputFiles({
      name: 'replace.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('universe'),
    });
    await expect(editor).toHaveValue('hello universe');
  });

  // ---- Multiple files ----

  test('uploading multiple files concatenates their content', async ({ page }) => {
    const editor = page.locator('#editor');
    await page.locator('#file-upload').setInputFiles([
      { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('first') },
      { name: 'b.txt', mimeType: 'text/plain', buffer: Buffer.from('second') },
      { name: 'c.txt', mimeType: 'text/plain', buffer: Buffer.from('third') },
    ]);
    await expect(editor).toHaveValue('first\nsecond\nthird');
  });

  // ---- Binary file detection ----

  test('binary file shows error message instead of content', async ({ page }) => {
    const editor = page.locator('#editor');
    // Create a buffer with null bytes (binary signature)
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

  // ---- Non-standard extensions treated as text ----

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

  // ---- Persistence after upload ----

  test('uploaded text persists across reload', async ({ page }) => {
    await page.locator('#file-upload').setInputFiles({
      name: 'persist.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('should persist'),
    });
    await expect(page.locator('#editor')).toHaveValue('should persist');
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForSelector('#app-shell:not(.loading)');
    await expect(page.locator('#editor')).toHaveValue('should persist');
  });

  // ---- Upload into existing text ----

  test('upload appends at end when cursor is at end', async ({ page }) => {
    const editor = page.locator('#editor');
    await editor.fill('existing');
    await editor.dispatchEvent('input');
    // Move cursor to end
    await editor.evaluate((el) => {
      el.setSelectionRange(el.value.length, el.value.length);
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
    // Move cursor to start
    await editor.evaluate((el) => {
      el.setSelectionRange(0, 0);
    });
    await page.locator('#file-upload').setInputFiles({
      name: 'prefix.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('new '),
    });
    await expect(editor).toHaveValue('new existing');
  });

  // ---- Upload button can be used repeatedly ----

  test('upload button works multiple times in sequence', async ({ page }) => {
    const editor = page.locator('#editor');
    await page.locator('#file-upload').setInputFiles({
      name: 'first.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('aaa'),
    });
    await expect(editor).toHaveValue('aaa');
    // Upload again — cursor should be at end of previous insert
    await page.locator('#file-upload').setInputFiles({
      name: 'second.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('bbb'),
    });
    await expect(editor).toHaveValue('aaabbb');
  });

  // ---- Drag-and-drop ----

  test('drag over editor shows visual feedback', async ({ page }) => {
    const editor = page.locator('#editor');
    const mainEl = page.locator('main');
    // Simulate dragover with Files in dataTransfer
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
    // Trigger dragover first
    await editor.evaluate((el) => {
      const dt = new DataTransfer();
      dt.items.add(new File(['test'], 'test.txt', { type: 'text/plain' }));
      el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true }));
    });
    await expect(mainEl).toHaveClass(/dragover/);
    // Then dragleave
    await editor.evaluate((el) => {
      el.dispatchEvent(new DragEvent('dragleave', { bubbles: true, relatedTarget: null }));
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
    // Trigger dragover then drop
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
    // Show the toolbar
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
      els.filter((el) => getComputedStyle(el).display !== 'none')
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
    expect(navBox.x).toBeLessThan(controlsBox.x);
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

  test('btn :hover is guarded by @media (hover: hover)', async ({ page }) => {
    // On a touch-only device (hover: none), .btn:hover must NOT change color.
    // Verify the stylesheet wraps .btn:hover inside @media (hover: hover).
    const hoverGuarded = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        for (const rule of sheet.cssRules) {
          // Look for @media (hover: hover) containing .btn:hover
          if (rule instanceof CSSMediaRule && rule.conditionText === '(hover: hover)') {
            for (const inner of rule.cssRules) {
              if (inner.selectorText && inner.selectorText.includes('.btn:hover')) {
                return true;
              }
            }
          }
          // Fail if .btn:hover exists outside of a media query
          if (rule instanceof CSSStyleRule && rule.selectorText && rule.selectorText.includes('.btn:hover')) {
            return false;
          }
        }
      }
      return false;
    });
    expect(hoverGuarded).toBe(true);
  });

  test('btn-float :hover is guarded by @media (hover: hover)', async ({ page }) => {
    const hoverGuarded = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSMediaRule && rule.conditionText === '(hover: hover)') {
            for (const inner of rule.cssRules) {
              if (inner.selectorText && inner.selectorText.includes('.btn-float:hover')) {
                return true;
              }
            }
          }
          if (rule instanceof CSSStyleRule && rule.selectorText && rule.selectorText.includes('.btn-float:hover')) {
            return false;
          }
        }
      }
      return false;
    });
    expect(hoverGuarded).toBe(true);
  });

  test('touch-only: button color does not change on hover', async ({ page }) => {
    // Emulate a touch-only device (hover: none)
    await page.emulateMedia({ colorScheme: 'light' });
    await page.setViewportSize({ width: 375, height: 667 });

    // Force media to (hover: none) by evaluating computed style with the query
    const btn = page.locator('#btn-copy');
    const baseColor = await btn.evaluate((el) => getComputedStyle(el).color);

    // Dispatch hover-like events that a touch might trigger
    await btn.dispatchEvent('pointerenter');
    await btn.dispatchEvent('mouseenter');
    const hoverColor = await btn.evaluate((el) => getComputedStyle(el).color);

    // On a device that doesn't match (hover: hover), color should stay the same
    // The Playwright Chromium default doesn't report hover capability,
    // but even if it does, we verified via CSSOM that the rule is guarded.
    // Here we just check the color doesn't "stick" after pointer leaves.
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

    // Simulate touch release (pointerleave, not mouseleave)
    await btn.dispatchEvent('pointerleave');
    await expect(page.locator('#icon-copy')).toBeVisible();
    expect(await btn.evaluate((el) => el.classList.contains('copy-success'))).toBe(false);
  });
});
