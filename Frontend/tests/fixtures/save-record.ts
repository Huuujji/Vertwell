import type { Page } from '@playwright/test';

// Older scenarios focus on stock/roles. Supply the newly required F&B dates
// explicitly while leaving their existing date-validation inputs unchanged.
export async function saveRecord(page: Page) {
  for (const [label, value] of [['Manufactured Date', '2026-08-01'], ['Expiry On', '2027-12-31']]) {
    const field = page.getByLabel(label, { exact: true });
    if (await field.count() && await field.getAttribute('required') !== null && !await field.inputValue()) await field.fill(value);
  }
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}
