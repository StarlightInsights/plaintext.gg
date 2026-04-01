import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 15000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3999',
    headless: true,
  },
  webServer: {
    command: 'node server.js 3999',
    port: 3999,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
