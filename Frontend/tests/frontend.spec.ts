import { saveRecord } from './fixtures/save-record';
import { test, expect } from './fixtures/legacy-preview';
import type { Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

async function enter(page: Page, role = 'Owner') {
  await page.goto('/');
  await page.getByLabel('Preview role').selectOption(role);
  await page.getByRole('button', { name: 'Open preview' }).click();
}
async function navigate(page: Page, title: string) {
  if (await page.getByRole('button', { name: 'Open navigation' }).isVisible()) await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation').getByRole('button', { name: title, exact: true }).click();
  if (title === 'Inventory') { await page.getByRole('button', { name: 'All inventory', exact: true }).click(); await page.getByLabel('Inventory category', { exact: true }).selectOption('All'); }
}
test('cash checkout records the sale with tax and retains it after a void', async ({ page }) => {
  await enter(page); await navigate(page, 'POS');
  await page.getByRole('button', { name: 'Add Mango Matcha Latte to order', exact: true }).click();
  await expect(page.locator('.total-row')).toContainText('84.00');
  await page.getByRole('button', { name: 'Pay', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('84.00');
  await page.getByRole('button', { name: 'CASH PAYMENT', exact: true }).click();
  await page.getByLabel('Amount Given:').fill('100');
  await expect(page.locator('.change')).toContainText('16.00');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await navigate(page, 'Audit Trail');
  await expect(page.locator('tbody tr').first()).toContainText('Mango Matcha Latte');
  await expect(page.locator('tbody tr').first()).toContainText('Completed');
  await page.locator('.order-link').first().click();
  await page.getByRole('button', { name: 'VOID', exact: true }).click();
  await page.getByRole('button', { name: 'Proceed', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Void', exact: true }).click(); await page.getByRole('dialog', { name: 'Void this order permanently?' }).getByRole('button', { name: 'Void order', exact: true }).click();
  await expect(page.locator('tbody tr').first()).toContainText('Voided');
  await expect(page.locator('.sale-details')).toContainText('Out-of-stock item mistakenly sold');
});
test('GCash checkout rejects a duplicate reference', async ({ page }) => {
  await enter(page); await navigate(page, 'POS');
  for (let iteration = 0; iteration < 2; iteration++) {
    await page.getByRole('button', { name: 'Add Mango Matcha Latte to order', exact: true }).click();
    await page.getByRole('button', { name: 'Pay', exact: true }).click();
    await page.getByRole('button', { name: 'QR PH', exact: true }).click();
    await page.getByLabel('GCash reference number').fill('1234567890123');
    await page.getByRole('button', { name: 'Record sample', exact: true }).click();
    if (iteration === 0) await expect(page.getByRole('dialog')).toHaveCount(0);
    else await expect(page.getByRole('alert')).toContainText('already recorded');
  }
});
test('restocking adds a batch and updates the total; Escape closes the dialog', async ({ page }) => {
  await enter(page); await navigate(page, 'Inventory');
  await page.getByRole('button', { name: 'Add stock to Oat Milk', exact: true }).click();
  await page.getByLabel('Quantity Added').fill('20');
  await page.getByLabel('New Manufacturing Date', { exact: true }).fill('2026-10-03');
  await page.getByLabel('New Expiration Date', { exact: true }).fill('2027-10-03');
  await page.getByRole('button', { name: 'Add Stock', exact: true }).click();
  await expect(page.locator('tr').filter({ hasText: 'Oat Milk' })).toContainText('52L');
  await expect(page.getByRole('region', { name: 'Ingredients; scroll to see all columns', exact: true }).locator('tbody')).toContainText('Batch 3');
  await page.getByRole('button', { name: 'Add stock to Oat Milk', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('user wizard validates the code and matching passwords', async ({ page }) => {
  await enter(page); await navigate(page, 'Users');
  await page.getByRole('button', { name: 'Add User', exact: true }).click();
  await page.getByLabel('Full Name', { exact: true }).fill('Sample User');
  await page.getByLabel('Username', { exact: true }).fill('sample.user');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('Email Address', { exact: true }).fill('sample@example.com');
  await page.getByLabel('Code', { exact: true }).fill('111111');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('123456');
  await page.getByLabel('Code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm Password', { exact: true }).fill('different123');
  await page.getByRole('button', { name: 'Add Account', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('must match');
  await page.getByLabel('Confirm Password', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Add Account', exact: true }).click();
  await expect(page.locator('.user-row').filter({ hasText: 'Sample User' })).toBeVisible();
});
test('staff preview limits navigation and records a pending sale', async ({ page }) => {
  await enter(page, 'Staff');
  await expect(page.getByRole('navigation').getByRole('button')).toHaveCount(2);
  await page.getByRole('button', { name: 'Add Mango Matcha Latte to order', exact: true }).click();
  await page.getByRole('button', { name: 'Pay', exact: true }).click();
  await page.getByRole('button', { name: 'CASH PAYMENT', exact: true }).click();
  await page.getByLabel('Amount Given:').fill('100');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await navigate(page, 'Today’s Sales History');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('tbody')).toContainText('Pending');
});
test('CSV export contains voided transactions for traceability', async ({ page }) => {
  await enter(page); await navigate(page, 'Reports');
  await page.getByLabel('Export format').selectOption('CSV');
  await page.getByRole('button', { name: 'Export report', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('2026-08-15-to-2026-08-21.csv');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString('utf8')).toContain('Voided');
});
test('mobile pages do not overflow horizontally and their assets load', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
  await enter(page);
  for (const title of ['Dashboard', 'Inventory', 'POS', 'Audit Trail', 'Users', 'Reports']) {
    await navigate(page, title);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect.poll(() => page.locator('img').evaluateAll(images => images.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('staff void request survives role switching and owner approval retains its audit details', async ({ page }) => {
  // Manila is already October 4 while UTC remains October 3.
  await page.clock.setFixedTime(new Date('2026-10-03T17:00:00Z'));
  await enter(page, 'Staff');
  await page.getByRole('button', { name: 'Add Mango Matcha Latte to order', exact: true }).click();
  await page.getByRole('button', { name: 'Pay', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('20261004');
  await page.getByRole('button', { name: 'CASH PAYMENT', exact: true }).click();
  await page.getByLabel('Amount Given:').fill('100');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await navigate(page, 'Today’s Sales History');
  await page.locator('.order-link').first().click();
  await page.getByRole('button', { name: 'Request Void', exact: true }).click();
  await page.getByRole('button', { name: 'Proceed', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Request Pending' })).toBeDisabled();
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByLabel('Preview role').selectOption('Owner');
  await page.getByRole('button', { name: 'Open preview' }).click();
  await navigate(page, 'Audit Trail');
  await page.getByRole('button', { name: 'Void requests (1)' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.locator('.order-link').click();
  await page.getByRole('button', { name: 'Approve Void' }).click();
  await page.getByRole('button', { name: 'Proceed', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Void' }).click(); await page.getByRole('dialog', { name: 'Void this order permanently?' }).getByRole('button', { name: 'Void order', exact: true }).click();
  await page.getByRole('button', { name: /^Void requests/ }).click();
  await expect(page.locator('.sale-details')).toContainText('Void request: Approved');
  await expect(page.locator('.sale-details')).toContainText('Requested by Raven');
  await expect(page.locator('.sale-details')).toContainText('Reviewed by Angel');
  await expect(page.locator('tbody tr').first()).toContainText('Voided');
});

test('recovery clears previous fields and uses the code/password icons at every width', async ({ page }) => {
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await page.getByLabel('Email', { exact: true }).fill('sample@example.com');
    await page.getByRole('button', { name: 'Send Code', exact: true }).click();
    await expect(page.getByLabel('Verification code')).toHaveValue('');
    await expect(page.locator('.code-icon')).toHaveCSS('background-image', /3e574\.svg/);
    await page.getByLabel('Verification code').fill('123456');
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByLabel('New password', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Confirm password', { exact: true })).toHaveValue('');
    await expect(page.locator('.password-icon').first()).toHaveCSS('background-image', /0153f\.svg/);
    await page.getByLabel('New password', { exact: true }).fill('new-password123');
    await page.getByLabel('Confirm password', { exact: true }).fill('different123');
    await page.getByRole('button', { name: 'Change Password', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('must match');
    await page.getByLabel('Confirm password', { exact: true }).fill('new-password123');
    await page.getByRole('button', { name: 'Change Password', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('No account was changed');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  }
});

test('product SKUs and fixed/percentage discounts carry through checkout, dashboard and reports', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-03T17:00:00Z'));
  await enter(page);
  for (const [index, type] of ['Fixed', 'Percentage'].entries()) {
    await navigate(page, 'Inventory');
    await page.getByRole('button', { name: 'Add Product', exact: true }).click();
    await page.getByLabel(/Product Name/).fill(`Discount sample ${index}`);
    await page.getByLabel(/Category/).selectOption('Hobby');
    await page.getByLabel('SKU', { exact: true }).fill(`TEST${index}`);
    await page.getByLabel(/Quantity/, { exact: false }).first().fill('10');
    await page.getByLabel('Product photo', { exact: true }).setInputFiles(fileURLToPath(new URL('../public/assets/6f622.png', import.meta.url)));
    await expect(page.getByLabel('Item Code', { exact: true })).toHaveCount(0);
    await page.getByLabel(/Quantity Alert/).fill('2');
    await page.getByLabel('Discount Type').selectOption(type);
    await page.getByLabel(/Price/).fill('10');
    await page.getByLabel('Discount Value', { exact: true }).fill(index ? '10' : '1');
    await saveRecord(page);
    await expect(page.locator('.product-table tbody')).toContainText(`TEST${index}`);
    await navigate(page, 'POS');
    await page.getByLabel('Search items', { exact: true }).fill(`TEST${index}`);
    await expect(page.locator('.product-card')).toHaveCount(1);
    await page.getByRole('button', { name: `Add Discount sample ${index} to order` }).click();
  }
  await expect(page.locator('.total-row')).toContainText('20.16');
  await page.getByRole('button', { name: 'Pay', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('20.16');
  await page.getByRole('button', { name: 'CASH PAYMENT', exact: true }).click();
  await page.getByLabel('Amount Given:').fill('30');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await navigate(page, 'Dashboard');
  await page.getByRole('button', { name: 'Hobby', exact: true }).click();
  await expect(page.locator('.today-card')).toContainText('20.16');
  await expect(page.locator('.today-card')).toContainText('1 transactions');
  await navigate(page, 'Reports');
  await page.getByLabel('From', { exact: true }).fill('2026-10-04');
  await page.getByLabel('To', { exact: true }).fill('2026-10-04');
  await page.getByLabel('Sales category').selectOption('Hobby');
  await expect(page.locator('.report-summary').first()).toContainText('20.16');
});
