import { defineConfig } from '@playwright/test';
import base from './playwright.config';
const phase = process.env.VERTWELL_ACCEPTANCE_PHASE || 'complete';
export default defineConfig({ ...base,
  ...(phase === 'verification' ? { testMatch: ['verification.spec.ts'], workers: 1, fullyParallel: false } : {}),
  ...(phase === 'production' ? { testMatch: ['chunk-loading.spec.ts', 'reports-live.spec.ts'], workers: 1, fullyParallel: false, globalSetup: './tests/setup-adjustment10-production.ts' } : {}),
  outputDir: `../../memory/backend/supabase/major-adjustments-evidence/2026-10-27-adjustment10/results-${phase}`,
  use: { ...base.use, serviceWorkers: 'block', proxy: { server: 'http://127.0.0.1:9', bypass: '127.0.0.1,localhost' } },
});
