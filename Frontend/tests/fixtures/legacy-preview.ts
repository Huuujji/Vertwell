import { test as base } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';

// Older interaction regressions need their explicit recipe/modifier scenarios.
// Keep them as test-only fixtures, independent of the changing preview catalogue.
// Current catalogue acceptance uses Playwright directly, without this route.
const source = readFileSync(new URL('./legacy-demo.ts', import.meta.url), 'utf8')
  .replaceAll('../../src/data/inventory', '/src/data/inventory.ts')
  .replaceAll('../../src/data/business-date', '/src/data/business-date.ts');
const body = stripTypeScriptTypes(source);

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/src/data/demo.ts*', route => route.fulfill({ contentType: 'application/javascript', body }));
    await use(page);
  },
});
