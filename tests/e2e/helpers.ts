import type { Page } from "@playwright/test";

/** Wait until the SvelteKit app shell has finished its loading phase. */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForSelector("#app-shell:not(.loading)");
}
