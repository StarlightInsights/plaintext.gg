import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 15_000,
  retries: process.env.CI ? 2 : 0,
  fullyParallel: true,
  reporter: process.env.CI ? 'dot' : 'list',
  use: {
    baseURL: 'http://localhost:3999',
    trace: 'on-first-retry',
  },
  // Reuse an already-running server on :3999 if present. CI starts the Docker
  // container before invoking Playwright, so this path takes that container.
  // Locally, if no server is up, we build + preview as fallback.
  webServer: {
    command: 'pnpm run build && pnpm run preview',
    port: 3999,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
