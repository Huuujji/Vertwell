import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['chunk-loading.spec.ts', 'reports-live.spec.ts'],
  workers: 1,
  globalSetup: './tests/setup-production-server.ts',
  use: {
    baseURL: 'http://127.0.0.1:5180',
    channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    trace: 'retain-on-failure',
  },
});
