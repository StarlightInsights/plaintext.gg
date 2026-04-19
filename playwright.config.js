import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 15000,
  // Local runs fail fast on flakes; CI gets a small safety net for transient
  // browser/IO issues that would otherwise page a human unnecessarily.
  retries: process.env.CI ? 2 : 0,
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
    {
      name: 'chromium',
      testMatch: '**/*.spec.js',
      testIgnore: '**/*.sw.spec.js',
      use: { browserName: 'chromium', serviceWorkers: 'block' },
    },
    {
      // Separate project so SW-allowed tests don't slow down the main suite,
      // and so SW state from one file doesn't leak into unrelated specs.
      name: 'chromium-sw',
      testMatch: '**/*.sw.spec.js',
      use: { browserName: 'chromium', serviceWorkers: 'allow' },
    },
  ],
});
