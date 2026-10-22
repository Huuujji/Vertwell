import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Current account-only regressions and isolated component harnesses.
  // Preview-dependent files remain historical source, outside current acceptance.
  testMatch: [
    'accessibility.spec.ts',
    'account-only.spec.ts', 'authentication.spec.ts', 'management.spec.ts',
    'checkout.spec.ts', 'sales-workflow.spec.ts', 'reports-live.spec.ts',
    'live-updates.spec.ts', 'live-dialogs.spec.ts', 'notifications.spec.ts',
    'integration-preparation.spec.ts',
  ],
  fullyParallel: true,
  workers: 2,
  globalSetup: './tests/setup-server.ts',
  use: {
    baseURL: 'http://127.0.0.1:5180',
    channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    trace: 'retain-on-failure',
  },
});
