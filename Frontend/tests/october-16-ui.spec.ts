import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDemoData, type Product } from '../src/data/demo';
import { productStockError } from '../src/data/catalogue';
import { stockKind } from '../src/data/inventory';

const output = fileURLToPath(new URL('../../../.review/frontend/october-16/', import.meta.url));
async function enter(page: Page, role = 'Owner') { await page.clock.setFixedTime(new Date('2026-10-16T04:23:00Z')); await page.goto('/'); await page.getByLabel('Preview role').selectOption(role); await page.getByRole('button', { name: 'Open preview', exact: true }).click(); }
async function nav(page: Page, name: string) { if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click(); await page.getByRole('navigation').getByRole('button', { name, exact: true }).click(); }
async function outside(page: Page) { await page.mouse.click(3, 3); }
async function capture(page: Page, name: string) { await mkdir(output, { recursive: true }); const size = page.viewportSize()!; await page.screenshot({ path: `${output}/${size.width}x${size.height}-${name}.png` }); }
async function inventory(page: Page, query: string) { await nav(page, 'Inventory'); await page.getByRole('button', { name: 'All inventory', exact: true }).click(); await page.getByLabel('Inventory category').selectOption('All'); await page.getByLabel('Search inventory', { exact: true }).fill(query); }

test('Daily Sales Review keeps receipt checks, counts and notes through every close route', async ({ page }) => {
  await enter(page); await page.getByRole('button', { name: /Review daily sales/ }).first().click();
  const review = page.getByRole('dialog', { name: 'Daily Sales Review', exact: true });
  await review.getByRole('checkbox').first().check(); await review.getByLabel('Counted cash for included receipts').fill('400'); await review.getByLabel('Review notes / discrepancy decision').fill('Count in progress');
  for (const route of ['outside', 'escape', 'close', 'cancel']) {
    if (route === 'outside') await outside(page); else if (route === 'escape') await page.keyboard.press('Escape'); else await review.getByRole('button', { name: route === 'close' ? 'Close dialog' : 'Cancel', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: 'Discard unsaved changes?' }); await expect(confirm).toBeVisible(); await expect(confirm.getByRole('button', { name: 'Keep editing' })).toBeFocused();
    await confirm.getByRole('button', { name: 'Keep editing' }).click(); await expect(review.getByLabel('Counted cash for included receipts')).toHaveValue('400'); await expect(review.getByRole('checkbox').first()).toBeChecked(); await expect(review.getByLabel('Review notes / discrepancy decision')).toHaveValue('Count in progress');
  }
  await outside(page); await capture(page, 'daily-review-discard'); await page.getByRole('button', { name: 'Discard changes', exact: true }).click(); await expect(review).toHaveCount(0);
  await page.getByRole('button', { name: /Review daily sales/ }).first().click(); await expect(review.getByLabel('Counted cash for included receipts')).toHaveValue('');
});

test('receiving protects typed quantities and calendar-picked dates; clean forms close directly', async ({ page }) => {
  await enter(page); await inventory(page, 'Oat Milk'); await page.getByRole('button', { name: 'Add stock to Oat Milk', exact: true }).click();
  await outside(page); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add stock to Oat Milk', exact: true }).click(); const receipt = page.getByRole('dialog', { name: 'Add Stock — Oat Milk', exact: true });
  await receipt.getByRole('button', { name: 'Open new manufacturing date calendar' }).click(); await page.getByRole('dialog', { name: 'New Manufacturing Date calendar' }).getByRole('button', { name: 'Today', exact: true }).click();
  await outside(page); await expect(page.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeVisible(); await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(receipt.getByLabel('New Manufacturing Date', { exact: true })).toHaveValue('2026-10-16'); await receipt.getByLabel('Quantity Added').fill('7'); await receipt.getByLabel('New Expiration Date', { exact: true }).fill('2026-12-31');
  await receipt.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.keyboard.press('Escape'); await expect(receipt.getByLabel('Quantity Added')).toHaveValue('7');
  await receipt.getByRole('button', { name: 'Add Stock', exact: true }).click(); await expect(receipt).toHaveCount(0); await expect(page.locator('.batch-row').last()).toContainText('7L');
});

test('step-three user wizard retains passwords and saves after Keep editing; discard resets the draft', async ({ page }) => {
  await enter(page); await nav(page, 'Users'); await page.getByRole('button', { name: 'Add User', exact: true }).click();
  const wizard = page.getByRole('dialog', { name: 'Add New User', exact: true });
  await wizard.getByLabel('Full Name').fill('Test October'); await wizard.getByLabel('Username', { exact: true }).fill('october16'); await wizard.getByRole('button', { name: 'Next', exact: true }).click();
  await wizard.getByLabel('Email Address').fill('october16@example.com'); await wizard.getByLabel('Code', { exact: true }).fill('123456'); await wizard.getByRole('button', { name: 'Confirm', exact: true }).click();
  await wizard.getByLabel('Password', { exact: true }).fill('Example123'); await wizard.getByLabel('Confirm Password', { exact: true }).fill('Example123'); await outside(page);
  await capture(page, 'user-discard'); await page.getByRole('button', { name: 'Keep editing', exact: true }).click(); await expect(wizard).toContainText('Step 3 of 3'); await expect(wizard.getByLabel('Password', { exact: true })).toHaveValue('Example123');
  await wizard.getByRole('button', { name: 'Add Account', exact: true }).click(); await expect(page.getByRole('group', { name: 'Test October account' })).toBeVisible();
  await page.getByRole('button', { name: 'Add User', exact: true }).click(); await wizard.getByLabel('Full Name').fill('Discard me'); await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await page.getByRole('button', { name: 'Add User', exact: true }).click(); await expect(wizard.getByLabel('Full Name')).toHaveValue('');
});

test('empty batches can be removed, remaining labels renumber and a fresh receipt restarts at Batch 1', async ({ page }) => {
  await enter(page); await inventory(page, 'Oat Milk');
  await page.getByRole('button', { name: 'Edit Oat Milk batch 1', exact: true }).click(); await page.getByLabel('Quantity', { exact: true }).fill('0'); await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByLabel('Search inventory', { exact: true }).fill('Oat Milk'); await page.getByRole('button', { name: 'Remove Oat Milk batch 1', exact: true }).click(); await page.getByRole('button', { name: 'Confirm removal' }).click();
  await expect(page.locator('#stock-oat-1')).toHaveCount(0); await expect(page.locator('#stock-oat-2')).toContainText('Batch 1');
  await page.getByRole('button', { name: 'Remove Oat Milk batch 1', exact: true }).click(); await page.getByRole('button', { name: 'Confirm removal' }).click();
  await page.getByRole('button', { name: 'Add stock to Oat Milk', exact: true }).click(); const receipt = page.getByRole('dialog', { name: 'Add Stock — Oat Milk' }); await receipt.getByLabel('Quantity Added').fill('5'); await receipt.getByLabel('New Manufacturing Date', { exact: true }).fill('2026-10-16'); await receipt.getByLabel('New Expiration Date', { exact: true }).fill('2026-12-31'); await receipt.getByRole('button', { name: 'Add Stock', exact: true }).click();
  await expect(page.locator('.batch-row')).toHaveCount(1); await expect(page.locator('.batch-row')).toContainText('Batch 1'); await expect(page.locator('#stock-PT002')).toContainText('5L');
});

test('exhausted recipe with modifiers is disabled before opening; restocking enables Add modifiers', async ({ page }) => {
  await enter(page); await inventory(page, 'Burger buns'); await page.getByRole('button', { name: 'Edit Burger buns', exact: true }).click(); await page.getByLabel('Quantity', { exact: true }).fill('0'); await page.getByRole('button', { name: 'Save', exact: true }).click();
  await nav(page, 'POS'); const product = page.getByRole('button', { name: 'Add Grilled Beef Sliders to order', exact: true }); await expect(product).toBeDisabled(); await expect(product).toContainText('Unavailable'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await inventory(page, 'Burger buns'); await page.getByRole('button', { name: 'Add stock to Burger buns', exact: true }).click(); const receipt = page.getByRole('dialog'); await receipt.getByLabel('Quantity Added').fill('1'); await receipt.getByLabel('New Manufacturing Date', { exact: true }).fill('2026-10-16'); await receipt.getByLabel('New Expiration Date', { exact: true }).fill('2026-12-31'); await receipt.getByRole('button', { name: 'Add Stock', exact: true }).click();
  await nav(page, 'POS'); await product.click(); await expect(page.getByRole('dialog', { name: 'Add modifiers — Grilled Beef Sliders' })).toBeVisible(); await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click(); await expect(product).toBeDisabled();
});

test('availability respects omissions, required choices, shared cart stock and variants', () => {
  const demo = createDemoData(), product = demo.products.find(value => value.id === 'PR-BEEF-SLIDERS')!;
  const stock = demo.stock.map(item => item.id === 'IN-ONION' ? { ...item, quantity: 0, batches: [] } : item);
  expect(productStockError(product, stock, demo.products)).toBeUndefined();
  const required: Product = { ...product, modifiers: [{ ...product.modifiers![0], min: 1, max: 1, options: [product.modifiers![0].options[0]] }] };
  expect(productStockError(required, stock, demo.products)).toContain('Onion');
  const empty = stock.map(item => item.id === 'IN-BUN' ? { ...item, quantity: 0, batches: [] } : item); expect(productStockError(product, empty, demo.products)).toContain('Burger buns');
  const oneBun = demo.stock.map(item => item.id === 'IN-BUN' ? { ...item, quantity: 1, batches: undefined } : item);
  expect(productStockError(product, oneBun, demo.products, [{ product, quantity: 1 }])).toContain('Burger buns');
  const variant = demo.products.find(value => value.mode === 'Variants')!; expect(productStockError(variant, demo.stock, demo.products)).toBeUndefined(); expect(productStockError(variant, demo.stock.map(item => variant.variants!.some(value => value.stockId === item.id) ? { ...item, quantity: 0, batches: [] } : item), demo.products)).toContain('Not enough');
});

test('bulk void requires an irreversible final dialog and going back changes no transaction', async ({ page }) => {
  await enter(page, 'Admin'); await nav(page, 'Audit Trail'); await page.getByRole('checkbox', { name: 'Select all eligible orders on this page' }).check();
  await page.getByRole('button', { name: 'Bulk Void', exact: true }).click(); await page.getByRole('button', { name: 'Review selected orders' }).click(); await page.getByRole('button', { name: 'Confirm Bulk Void', exact: true }).click();
  const final = page.getByRole('dialog', { name: 'Void selected orders permanently?' }); await expect(final).toContainText('cannot be undone'); await expect(final.getByRole('button', { name: 'Go back' })).toBeFocused(); await capture(page, 'bulk-final');
  await final.getByRole('button', { name: 'Go back' }).click(); await expect(page.locator('.bulk-toolbar')).toContainText('selected'); await page.getByRole('button', { name: 'Confirm Bulk Void', exact: true }).click(); await final.getByRole('button', { name: /^Void \d+ orders$/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.locator('.bulk-toolbar')).toContainText('0 selected'); await expect(page.locator('.toast')).toContainText('voided by Alex (Admin)');
});

for (const [width, height] of [[1440, 900], [820, 1180], [390, 844], [320, 568], [820, 400]]) test(`new inventory actions, disclosure and shared time controls at ${width}x${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height }); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await enter(page);
  await page.getByText('Daily sales values', { exact: true }).click(); await expect(page.locator('.daily-sales-values summary > svg')).toBeVisible(); expect(await page.locator('.daily-sales-values tbody th').first().evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)'); await page.locator('.daily-sales-values').scrollIntoViewIfNeeded(); await capture(page, 'daily-values');
  const field = page.getByLabel('From time', { exact: true }); await field.fill('930'); await field.press('Tab'); await expect(field).toHaveValue('09:30'); await page.getByRole('button', { name: 'Open from time time picker' }).click(); const picker = page.getByRole('dialog', { name: 'From time time picker' }); await capture(page, 'dashboard-time'); await picker.getByRole('button', { name: 'Clear', exact: true }).click(); await expect(field).toHaveValue('00:00');
  expect(await field.evaluate(element => getComputedStyle(element).borderTopWidth)).toBe('0px');
  await inventory(page, '');
  for (const [name, label, expected] of [['Grilled Beef Sliders', 'ingredients', 'Burger buns'], ['Cafe Snack Bundle', 'contents', 'Bottled Cold Brew'], ['Model Kit Editions', 'variants', 'Deluxe'], ['Deck Sleeves', '', '']]) {
    await page.getByLabel('Search inventory', { exact: true }).fill(name); const row = page.locator('.product-table > tbody > tr').filter({ has: page.getByText(name, { exact: true }) }).first(); const buttons = row.locator(':scope > td > .row-actions button'); await expect(buttons).toHaveCount(3);
    const tops = await buttons.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top)); expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
    if (label) { await row.getByRole('button', { name: `View ${label} for ${name}`, exact: true }).click(); await expect(page.getByRole('dialog')).toContainText(expected); await expect(page.getByRole('dialog').getByRole('heading')).toBeInViewport(); await expect(page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true })).toBeInViewport(); await capture(page, `details-${label}`); await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click(); }
  }
  await page.getByLabel('Search inventory', { exact: true }).fill('Oat Milk'); await expect(page.locator('.status.expiring')).toContainText('Expiring Soon'); expect(await page.locator('.status.expiring').first().evaluate(element => getComputedStyle(element).color)).toBe('rgb(154, 72, 11)');
  await nav(page, 'Reports'); await expect(page.getByRole('button', { name: 'Clear filters', exact: true })).toHaveCount(0); const from = page.getByLabel('From time', { exact: true }); await from.fill('13:42'); await from.press('Tab'); await expect(from).toHaveValue('13:42'); await page.getByRole('button', { name: 'Open from time time picker' }).click(); await capture(page, 'reports-time'); await page.getByRole('dialog', { name: 'From time time picker' }).getByRole('button', { name: 'Clear', exact: true }).click(); await expect(from).toHaveValue('00:00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); expect(errors).toEqual([]);
});

test('every inventory SKU offered for variants can be found under Products', async ({ page }) => {
  await enter(page); const demo = createDemoData(); await inventory(page, '');
  for (const item of demo.stock.filter(item => stockKind(item) === 'Finished' && item.unit === 'pcs')) {
    await page.getByLabel('Search inventory', { exact: true }).fill(item.sku ?? item.id); await expect(page.locator('.product-table > tbody > tr').first()).toBeVisible();
    const receipts = page.getByRole('button', { name: /^Stock details for / }).first(); if (await receipts.count() && await receipts.getAttribute('aria-expanded') !== 'true') await receipts.click(); await expect(page.locator(`[id="stock-${item.id}"], [id="usable-stock-${item.id}"]`).first()).toBeVisible();
  }
});

for (const [width, height] of [[320, 568], [820, 400]]) test(`draft confirmation headers and actions stay reachable at ${width}x${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height }); await enter(page);
  const confirm = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
  async function check(name: string) {
    await expect(confirm.getByRole('heading')).toBeInViewport();
    const keep = confirm.getByRole('button', { name: 'Keep editing', exact: true });
    const discard = confirm.getByRole('button', { name: 'Discard changes', exact: true });
    await expect(keep).toBeInViewport(); await expect(discard).toBeInViewport(); await capture(page, name);
    await keep.click();
  }
  await page.getByRole('button', { name: 'Review daily sales', exact: true }).first().click();
  const review = page.getByRole('dialog', { name: 'Daily Sales Review', exact: true });
  await review.getByLabel('Counted cash for included receipts').fill('123'); await outside(page); await check('daily-review-confirm');
  await expect(review.getByLabel('Counted cash for included receipts')).toHaveValue('123'); await outside(page); await confirm.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await inventory(page, 'Oat Milk'); await page.getByRole('button', { name: 'Add stock to Oat Milk', exact: true }).click();
  const receipt = page.getByRole('dialog', { name: 'Add Stock — Oat Milk' }); await receipt.getByLabel('Quantity Added').fill('8'); await outside(page); await check('receipt-confirm'); await expect(receipt.getByLabel('Quantity Added')).toHaveValue('8'); await outside(page); await confirm.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await nav(page, 'Users'); await page.getByRole('button', { name: 'Add User', exact: true }).click();
  const wizard = page.getByRole('dialog', { name: 'Add New User', exact: true }); await wizard.getByLabel('Full Name').fill('Keep this user'); await wizard.getByRole('button', { name: 'Close dialog' }).click(); await check('user-confirm'); await expect(wizard.getByLabel('Full Name')).toHaveValue('Keep this user');
});

