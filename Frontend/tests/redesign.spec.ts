import { saveRecord } from './fixtures/save-record';
import { test, expect } from './fixtures/legacy-preview';
import type { Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
const review = fileURLToPath(new URL('../../../.review/frontend/redesign/', import.meta.url));
async function enter(page: Page, role = 'Owner') { await page.clock.setFixedTime(new Date('2026-10-03T17:00:00Z')); await page.goto('/'); await page.getByLabel('Preview role').selectOption(role); await page.getByRole('button', { name: 'Open preview' }).click(); }
async function nav(page: Page, name: string) { if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click(); await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
  if (name === 'Inventory') { await page.getByRole('button', { name: 'All inventory', exact: true }).click(); await page.getByLabel('Inventory category', { exact: true }).selectOption('All'); } }
async function cash(page: Page, amount = '1000') { await page.getByRole('button', { name: 'Pay', exact: true }).click(); await page.getByRole('button', { name: 'CASH PAYMENT', exact: true }).click(); await page.getByLabel('Amount Given:', { exact: true }).fill(amount); await page.getByRole('button', { name: 'Confirm', exact: true }).click(); }
async function burger(page: Page, option?: string) { await page.getByRole('button', { name: 'Add Hamburger to order', exact: true }).click(); if (option) await page.getByRole('checkbox', { name: new RegExp(option) }).check(); await page.getByRole('button', { name: /^(Add|Update item)$/ }).click(); }

test('one-character actor and partial-order searches update immediately and explain combined filters', async ({ page }) => {
  await enter(page); await nav(page, 'Audit Trail');
  const input = page.getByRole('searchbox', { name: 'Search sales', exact: true });
  await input.fill('j'); await expect(page.locator('tbody tr')).toHaveCount(4);
  await input.fill('J'); await expect(page.locator('tbody tr')).toHaveCount(4);
  await input.fill('0006'); await expect(page.locator('tbody tr')).toHaveCount(1);
  await input.fill('  rav  '); await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByLabel('Filter sales by date', { exact: true }).fill('2026-10-04'); await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('.filter-summary')).toContainText('2026-10-04');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click(); await expect(page.locator('tbody tr')).toHaveCount(6);
  await input.fill('0006'); await nav(page, 'Inventory'); await nav(page, 'Audit Trail'); await expect(input).toHaveValue('0006'); await expect(page.locator('tbody tr')).toHaveCount(1);
  await input.focus(); await expect(page.locator('.search-field')).toHaveCSS('outline-style', 'solid'); await expect(input).toHaveCSS('outline-style', 'none');
});

test('whole-row and keyboard order selection work without checkbox clicks selecting details', async ({ page }) => {
  await enter(page); await nav(page, 'Audit Trail');
  await page.getByLabel('Filter sales by date', { exact: true }).fill('2026-08-20');
  await page.locator('tbody tr').nth(1).getByText('Alex', { exact: true }).click(); await expect(page.locator('.sale-details')).toContainText('202608200002');
  await page.getByRole('checkbox', { name: 'Select order 202608200003', exact: true }).check(); await expect(page.locator('.sale-details')).toContainText('202608200003');
  await page.locator('tbody tr').nth(2).focus(); await page.keyboard.press('Enter'); await expect(page.locator('.sale-details')).toContainText('202608200003');
});

test('Admin bulk void needs no owner password and retains Admin identity and original transactions', async ({ page }) => {
  await enter(page, 'Admin'); await nav(page, 'Audit Trail');
  await page.getByLabel('Filter sales by date', { exact: true }).fill('2026-08-20');
  await page.getByRole('checkbox', { name: 'Select order 202608200005', exact: true }).isDisabled().then(disabled => expect(disabled).toBe(true));
  for (const id of ['202608200001', '202608200002']) await page.getByRole('checkbox', { name: `Select order ${id}`, exact: true }).check();
  await page.getByRole('button', { name: 'Bulk Void', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('2 selected orders');
  await page.getByRole('button', { name: 'Review selected orders' }).click(); await expect(page.getByLabel('Owner password')).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirm Bulk Void', exact: true }).click(); await page.getByRole('dialog', { name: 'Void selected orders permanently?' }).getByRole('button', { name: /^Void \d+ orders$/ }).click(); await expect(page.locator('tbody tr')).toHaveCount(6);
  await page.locator('tbody tr').first().click(); await expect(page.locator('.sale-details')).toContainText('Voided by Alex · Admin'); await expect(page.locator('.sale-details')).toContainText('Batch action:');
});

test('Inventory searches its explicit scope from the first character and shows expand controls only for multiple batches', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory');
  await expect(page.getByRole('button', { name: /Expand Expresso|Collapse Expresso/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Collapse Oat Milk batches' })).toBeVisible();
  await page.getByRole('button', { name: 'Products', exact: true }).click();
  const search = page.getByRole('searchbox', { name: 'Search inventory', exact: true }); await search.fill('o');
  await expect(page.locator('.filter-summary')).toContainText('Search within this scope'); await expect(page.getByRole('region', { name: 'Ingredients; scroll to see all columns', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'All inventory', exact: true }).click();
  await search.fill('pt001'); await expect(page.getByRole('region', { name: 'Ingredients; scroll to see all columns', exact: true }).locator('tbody > tr')).toHaveCount(1);
  await search.fill('NOT FOUND'); await expect(page.locator('.empty-state')).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Needed to Remove Stocks; scroll to see all columns', exact: true })).toHaveCount(0);
  for (const title of ['Sellable products', 'Ingredients']) await expect(page.getByRole('region', { name: `${title}; scroll to see all columns`, exact: true }).locator('.empty-state')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Product stock', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Products', exact: true }).click(); await page.getByRole('button', { name: 'Clear search inventory', exact: true }).click(); await expect(page.getByRole('button', { name: 'Products', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('ingredient and product creation accepts no photo; one receipt exposes its batch actions and editing can add/remove photos', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory'); await page.getByRole('button', { name: 'Add Ingredient', exact: true }).click();
  await page.getByLabel('Ingredient Name', { exact: true }).fill('Test flour'); await page.locator('.generate-field input').first().fill('IN-TEST'); await page.getByLabel('Quantity', { exact: true }).fill('0'); await page.getByLabel('Quantity Alert', { exact: true }).fill('2'); await saveRecord(page);
  await page.getByRole('button', { name: 'Add stock to Test flour', exact: true }).click(); await page.getByLabel('Quantity Added', { exact: true }).fill('10'); await page.getByLabel('New Manufacturing Date', { exact: true }).fill('2026-10-04'); await page.getByLabel('New Expiration Date', { exact: true }).fill('2027-10-04'); await page.getByRole('button', { name: 'Add Stock', exact: true }).click();
  await expect(page.getByRole('button', { name: /Expand Test flour|Collapse Test flour/ })).toHaveCount(1); await expect(page.locator('#stock-IN-TEST')).toContainText('Oct 4, 2027');
  await page.getByRole('button', { name: 'Edit Test flour', exact: true }).click(); await page.getByLabel('Ingredient photo', { exact: true }).setInputFiles(fileURLToPath(new URL('../public/assets/6f622.png', import.meta.url))); await saveRecord(page);
  await page.getByRole('button', { name: 'Edit Test flour', exact: true }).click(); await expect(page.getByAltText('Current photo')).toBeVisible(); await page.getByRole('button', { name: 'Remove photo', exact: true }).click(); await saveRecord(page);
  await page.getByRole('button', { name: 'Add Product', exact: true }).click(); await page.getByLabel('Product Name', { exact: true }).fill('Photo optional retail'); await page.locator('.generate-field input').first().fill('PR-TEST'); await page.getByLabel('Quantity', { exact: true }).fill('2'); await page.getByLabel('Quantity Alert', { exact: true }).fill('1'); await page.getByLabel('Price', { exact: true }).fill('20'); await saveRecord(page);
  await nav(page, 'POS'); await page.getByRole('searchbox', { name: 'Search items', exact: true }).fill('PR-TEST'); await expect(page.locator('.product-placeholder')).toBeVisible();
});

test('customized burgers remain distinct, consume actual configuration, and old orders retain edited price/recipe snapshots', async ({ page }) => {
  await enter(page); await nav(page, 'POS'); await burger(page, 'Extra cheese'); await burger(page, 'No onions'); await expect(page.locator('.cart-line')).toHaveCount(2); await expect(page.locator('.total-row')).toContainText('255.00'); await cash(page);
  await nav(page, 'Inventory'); await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('Onions'); await expect(page.getByRole('region', { name: 'Ingredients; scroll to see all columns', exact: true }).locator('tbody tr').first()).toContainText('480g');
  await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('Hamburger'); await page.getByRole('button', { name: 'Edit product Hamburger', exact: true }).click(); await page.getByLabel('Price', { exact: true }).fill('200'); await page.locator('.recipe-editor').first().getByLabel('Quantity', { exact: true }).first().fill('2'); await saveRecord(page);
  await nav(page, 'Audit Trail'); await page.locator('tbody tr').first().click(); await expect(page.locator('.sale-details')).toContainText('285.60'); await expect(page.locator('.sale-details')).toContainText('Extra cheese'); await expect(page.locator('.sale-details')).toContainText('No onions'); await expect(page.locator('.sale-details')).toContainText('Burger buns: 2 pcs');
  await nav(page, 'Reports'); await page.getByLabel('From', { exact: true }).fill('2026-10-04'); await page.getByLabel('To', { exact: true }).fill('2026-10-04'); await expect(page.locator('.stock-report-sections')).toContainText('Stocks used'); await expect(page.locator('.stock-report-sections')).toContainText('Onions');
});

test('unavailable ingredients disable modifier choices and paid Pending Staff checkout consumes configured stock', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory'); await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('Cheese Slices'); await page.getByRole('button', { name: 'Edit Cheese Slices', exact: true }).click(); await page.getByLabel('Expiry On', { exact: true }).fill('2026-10-02'); await saveRecord(page);
  await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Hamburger to order', exact: true }).click(); await expect(page.getByRole('checkbox', { name: /Extra cheese/ })).toBeDisabled(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click(); await page.getByLabel('Preview role').selectOption('Staff'); await page.getByRole('button', { name: 'Open preview' }).click(); await burger(page, 'No onions'); await cash(page);
  await page.getByRole('button', { name: 'Log out', exact: true }).click(); await page.getByRole('button', { name: 'Open preview' }).click(); await nav(page, 'Inventory'); await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('Burger buns'); await expect(page.getByRole('region', { name: 'Ingredients; scroll to see all columns', exact: true })).toContainText('19pcs');
});

test('Dashboard stock and pending-void alerts open affected records with usable filters', async ({ page }) => {
  await enter(page, 'Staff'); await page.getByRole('button', { name: 'Add Mango Matcha Latte to order', exact: true }).click(); await cash(page); await nav(page, 'Today’s Sales History'); await page.locator('tbody tr').first().click(); await page.getByRole('button', { name: 'Request Void', exact: true }).click(); await page.getByRole('button', { name: 'Proceed', exact: true }).click(); await page.getByRole('button', { name: 'Log out', exact: true }).click(); await page.getByLabel('Preview role').selectOption('Admin'); await page.getByRole('button', { name: 'Open preview' }).click();
  await expect(page.locator('.alert-center')).toContainText('Raven · Staff'); await page.getByRole('button', { name: 'Mark read', exact: true }).click(); await expect(page.locator('.alert-center')).toContainText('Read / unresolved'); await page.getByRole('button', { name: 'Review orders', exact: true }).click(); await expect(page.locator('tbody tr')).toHaveCount(1); await expect(page.locator('.sale-details')).toContainText('Mango Matcha Latte');
  await nav(page, 'Dashboard'); await page.locator('.attention-link').first().click(); await expect(page.locator('.inventory .active-row')).toBeVisible(); await expect(page.getByRole('button', { name: 'All inventory', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('potential duplicate alerts group evidence and only link to investigation', async ({ page }) => {
  await enter(page); await nav(page, 'POS'); for (let i = 0; i < 5; i++) { await page.getByRole('button', { name: 'Add Mango Matcha Latte to order', exact: true }).click(); await cash(page); } await nav(page, 'Dashboard');
  await expect(page.locator('.alert-center')).toContainText('5 identical orders'); await expect(page.locator('.alert-center')).toContainText('Angel · Owner'); await page.getByRole('button', { name: 'Review orders', exact: true }).click(); await expect(page.locator('tbody tr')).toHaveCount(5); await expect(page.locator('tbody')).not.toContainText('Voided');
});

test('Owner/Admin/Staff roles remain distinct and the last Owner cannot be removed or demoted', async ({ page }) => {
  await enter(page); await nav(page, 'Users'); const owner = page.locator('.user-row').filter({ hasText: 'Angel' }); await expect(owner).toContainText('Owner'); await owner.getByRole('button', { name: 'Manage' }).click(); await expect(page.getByRole('button', { name: 'Delete Account', exact: true })).toBeDisabled(); await page.getByRole('combobox', { name: 'Role', exact: true }).selectOption('Admin'); await saveRecord(page); await expect(page.getByRole('alert')).toContainText('at least one owner'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Log out', exact: true }).click(); await page.getByLabel('Preview role').selectOption('Admin'); await page.getByRole('button', { name: 'Open preview' }).click(); await nav(page, 'Users'); await expect(page.locator('.user-row').filter({ hasText: 'Angel' }).getByRole('button')).toBeDisabled(); await page.getByRole('button', { name: 'Add User', exact: true }).click(); expect(await page.getByRole('combobox', { name: 'Role', exact: true }).locator('option').allTextContents()).toEqual(['Staff', 'Admin', 'Owner']); await expect(page.getByRole('combobox', { name: 'Role', exact: true }).getByRole('option', { name: 'Owner', exact: true })).toHaveAttribute('disabled', '');
});

test('calendar stays in viewport, supports keyboard selection and restores its trigger on short screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 400 }); await enter(page); await nav(page, 'Reports'); await page.getByRole('button', { name: 'Open from calendar', exact: true }).click(); const calendar = page.getByRole('dialog', { name: 'From calendar', exact: true }); await expect(calendar).toBeVisible();
  const box = await calendar.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(320); expect(box!.y + box!.height).toBeLessThanOrEqual(400);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await expect(page.getByLabel('From', { exact: true })).toHaveValue('2026-08-16'); await expect(page.getByRole('button', { name: 'Open from calendar', exact: true })).toBeFocused();
});

test('PDF downloads directly, contains selected scope and data, and does not open print', async ({ page }) => {
  await enter(page); await nav(page, 'Reports'); await page.evaluate(() => { window.print = () => { throw new Error('Print should not be called'); }; }); await page.getByRole('button', { name: 'Export report', exact: true }).click(); await expect(page.locator('.export-bars')).toHaveCount(0); const promise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download PDF', exact: true }).click(); const result = await promise; await mkdir(review, { recursive: true }); await result.saveAs(`${review}/combined-report.pdf`); const stream = await result.createReadStream(); const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk)); const pdf = Buffer.concat(chunks); expect(pdf.subarray(0, 5).toString()).toBe('%PDF-'); expect(result.suggestedFilename()).toContain('combined-2026-08-15-to-2026-08-21.pdf');
});

test('required modifier groups validate limits and editing options combines only identical configurations', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory'); await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('Hamburger'); await page.getByRole('button', { name: 'Edit product Hamburger', exact: true }).click(); await page.getByLabel('Minimum choices').fill('1'); await page.getByLabel('Maximum choices').fill('1'); await saveRecord(page);
  await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Hamburger to order', exact: true }).click(); await page.getByRole('button', { name: /^(Add|Update item)$/ }).click(); await expect(page.getByRole('alert')).toContainText('Choose 1–1');
  await page.getByRole('checkbox', { name: /Extra cheese/ }).check(); await page.getByRole('checkbox', { name: /No onions/ }).check(); await page.getByRole('button', { name: /^(Add|Update item)$/ }).click(); await expect(page.getByRole('alert')).toContainText('Choose 1–1');
  await page.getByRole('checkbox', { name: /No onions/ }).uncheck(); await page.getByRole('button', { name: /^(Add|Update item)$/ }).click(); await burger(page, 'No onions'); await page.locator('.cart-line').first().getByRole('button', { name: 'Edit options' }).click(); await page.getByRole('checkbox', { name: /Extra cheese/ }).uncheck(); await page.getByRole('checkbox', { name: /No onions/ }).check(); await page.getByRole('button', { name: /^(Add|Update item)$/ }).click(); await expect(page.locator('.cart-line')).toHaveCount(1); await expect(page.locator('.quantity-control output')).toHaveText('2'); await expect(page.locator('.total-row')).toContainText('240.00');
});

test('double payment submission records one sale and deducts stock once', async ({ page }) => {
  await enter(page); await nav(page, 'POS'); await burger(page); await page.getByRole('button', { name: 'Pay', exact: true }).click(); await page.getByRole('button', { name: 'CASH PAYMENT', exact: true }).click(); await page.getByLabel('Amount Given:', { exact: true }).fill('200'); await page.getByRole('button', { name: 'Confirm', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await nav(page, 'Audit Trail'); await expect(page.locator('tbody tr')).toHaveCount(6); await expect(page.getByRole('navigation', { name: 'Transactions pagination' })).toContainText('of 12 records'); await nav(page, 'Inventory'); await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('Burger buns'); await expect(page.getByRole('region', { name: 'Ingredients; scroll to see all columns', exact: true })).toContainText('19pcs');
});
