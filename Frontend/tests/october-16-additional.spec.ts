import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { businessDate, createDemoData, type Product } from '../src/data/demo';
import { availableDefaultIds } from '../src/data/catalogue';
import { openingMovements, periodBalance } from '../src/data/stock-movements';
import { chooseSearch } from './fixtures/search-select';
import { saveRecord } from './fixtures/save-record';

const output = fileURLToPath(new URL('../../../.review/frontend/october-16-additional/', import.meta.url));
async function enter(page: Page, role = 'Owner') { await page.clock.setFixedTime(new Date('2026-10-16T04:23:00Z')); await page.goto('/'); await page.getByLabel('Preview role').selectOption(role); await page.getByRole('button', { name: 'Open preview', exact: true }).click(); }
async function nav(page: Page, name: string) { if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click(); await page.getByRole('navigation').getByRole('button', { name, exact: true }).click(); }
async function inventory(page: Page, query: string) { await nav(page, 'Inventory'); await page.getByRole('button', { name: 'All inventory', exact: true }).click(); await page.getByLabel('Inventory category').selectOption('All'); await page.getByLabel('Search inventory', { exact: true }).fill(query); }
async function capture(page: Page, name: string) { const dismiss = page.getByRole("button", { name: "Dismiss notification", exact: true }); if (await dismiss.isVisible() && !await page.getByRole("dialog").count()) await dismiss.click(); await mkdir(output, { recursive: true }); const size = page.viewportSize()!; await page.screenshot({ path: `${output}/${size.width}x${size.height}-${name}.png` }); }

test('default stock checks combine recipe, all default groups, omissions, quantity, variants and other cart lines', () => {
  const demo = createDemoData(), buns = demo.stock.find(item => item.id === 'IN-BUN')!;
  const stock = [{ ...buns, quantity: 4, batches: undefined }];
  const product: Product = { ...demo.products.find(item => item.id === 'PR-BEEF-SLIDERS')!, recipe: [{ stockId: buns.id, quantity: 3, unit: 'pcs' }], modifiers: [{ id: 'g', name: 'Extra buns', min: 0, max: 3, options: [3, 2, 1].map(quantity => ({ id: `plus-${quantity}`, name: `${quantity} extra`, price: 0, defaultSelected: quantity === 3, inputs: [{ stockId: buns.id, quantity, unit: 'pcs' }] })) }] };
  expect(availableDefaultIds(product, stock, [product], [])).toEqual([]);
  product.modifiers![0].options[0].defaultSelected = false; product.modifiers![0].options[2].defaultSelected = true;
  expect(availableDefaultIds(product, stock, [product], [])).toEqual(['plus-1']);
  expect(availableDefaultIds(product, stock, [product], [], 2)).toEqual([]);
  const other = { ...product, recipe: [{ stockId: buns.id, quantity: 1, unit: 'pcs' }], modifiers: [] };
  expect(availableDefaultIds(product, stock, [product], [{ product: other, quantity: 1 }])).toEqual([]);
  product.modifiers!.push({ id: 'second', name: 'Another bun', min: 0, max: 1, options: [{ ...product.modifiers![0].options[2], id: 'second-1' }] });
  expect(availableDefaultIds(product, stock, [product], [])).toEqual(['plus-1']);
  product.modifiers!.push({ id: 'omit', name: 'Omit bun', min: 0, max: 1, options: [{ id: 'omit-1', name: 'One less', price: 0, defaultSelected: true, inputs: [{ stockId: buns.id, quantity: -1, unit: 'pcs' }] }] });
  expect(availableDefaultIds(product, stock, [product], [])).toEqual(['plus-1', 'second-1', 'omit-1']);
  const variant = demo.products.find(item => item.mode === 'Variants')!;
  const configured = { ...variant, modifiers: [{ id: 'variant-extra', name: 'Extra bun', min: 0, max: 1, options: [product.modifiers![0].options[2]] }] };
  expect(availableDefaultIds(configured, demo.stock, demo.products, [])).toEqual([]);
  expect(availableDefaultIds(configured, demo.stock, demo.products, [], 1, variant.variants![0])).toEqual(['plus-1']);
  const bundle = { ...demo.products.find(item => item.mode === 'Bundle')!, modifiers: configured.modifiers };
  expect(availableDefaultIds(bundle, demo.stock, demo.products, [])).toEqual(['plus-1']);
});

test('long ranges preserve verified balances and identify each item’s actual coverage; unknown and zero stay honest', () => {
  const demo = createDemoData(), movements = openingMovements(demo.openingStock);
  const tomorrow = businessDate(new Date(Date.now() + 86_400_000));
  for (const item of demo.stock.filter(item => item.kind === 'Ingredient')) {
    const full = periodBalance(item, demo.sales, movements, '2026-08-01', '2026-10-16')!;
    for (const start of ['2026-07-16', '2026-01-01']) expect(periodBalance(item, demo.sales, movements, start, '2026-10-16')).toEqual({ ...full, partial: true });
    expect(periodBalance(item, demo.sales, movements, '2026-06-01', '2026-07-31')).toBeUndefined();
    expect(periodBalance({ ...item, quantity: item.quantity + 1 }, demo.sales, movements, '2026-07-16', '2026-10-16')).toBeUndefined();
    expect(periodBalance(item, demo.sales, movements, '2026-07-16', tomorrow)).toBeUndefined();
  }
  const empty = { ...demo.stock[0], quantity: 0, batches: undefined };
  expect(periodBalance(empty, [], openingMovements([empty]), '2026-07-16', '2026-10-16')).toMatchObject({ partial: true, baseline: 0, usedPercent: 0, remainingPercent: 0, remaining: 0 });
  const late = movements.map(value => ({ ...value, date: '2026-09-01' }));
  expect(periodBalance(empty, [], [{ ...late[0], quantity: 0 }], '2026-07-16', '2026-10-16')).toMatchObject({ coverageStart: '2026-09-01', partial: true });
});

test('modifier prices accept blank drafts and only the checkbox or its fitted label toggles a default, in both editors', async ({ page }) => {
  await enter(page); await inventory(page, 'Grilled Beef Sliders'); await page.getByRole('button', { name: 'Edit product Grilled Beef Sliders' }).click();
  for (const library of [false, true]) {
    if (library) { await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.getByRole('button', { name: 'Discard changes', exact: true }).click(); await page.getByRole('button', { name: 'Modifier groups', exact: true }).click(); await page.getByRole('button', { name: 'Add library group', exact: true }).click(); await page.getByRole('button', { name: 'Add option', exact: true }).click(); }
    const option = page.locator('.modifier-option').first(), price = option.getByLabel('Price adjustment', { exact: true });
    await price.fill('0'); await price.press('Backspace'); await expect(price).toHaveValue(''); await price.press('Tab'); await expect(price).toHaveValue('0');
    await price.fill(''); await price.fill('12.50'); await price.press('Tab'); expect(Number(await price.inputValue())).toBe(12.5);
    const checkbox = option.getByRole('checkbox'); await checkbox.uncheck();
    const labelBox = await option.locator('.modifier-default-control').boundingBox(), optionBox = await option.boundingBox();
    expect(labelBox!.width).toBeLessThan(optionBox!.width - 20);
    await option.click({ position: { x: optionBox!.width - 5, y: labelBox!.y - optionBox!.y + labelBox!.height / 2 } }); await expect(checkbox).not.toBeChecked();
    await option.locator('.modifier-default-control span').click(); await expect(checkbox).toBeChecked(); await checkbox.click(); await expect(checkbox).not.toBeChecked();
  }
});

for (const role of ['Owner', 'Staff']) test(`four buns, a three-bun recipe and default three-bun add-on stays unchecked for ${role}`, async ({ page }) => {
  await enter(page); await inventory(page, 'Burger buns'); await page.getByRole('button', { name: 'Edit Burger buns', exact: true }).click(); await page.getByLabel('Quantity', { exact: true }).fill('4'); await saveRecord(page);
  await inventory(page, 'Grilled Beef Sliders'); await page.getByRole('button', { name: 'Edit product Grilled Beef Sliders' }).click();
  await page.locator('.recipe-editor').first().getByLabel('Quantity', { exact: true }).first().fill('3');
  while (await page.getByRole('button', { name: 'Remove option', exact: true }).count()) await page.getByRole('button', { name: 'Remove option', exact: true }).first().click();
  for (const quantity of [3, 2, 1]) {
    await page.getByRole('button', { name: 'Add option', exact: true }).click(); const option = page.locator('.modifier-option').last(); await option.getByLabel('Option name', { exact: true }).fill(`Add ${quantity} buns`);
    await option.getByRole('button', { name: 'Add modifier input', exact: true }).click(); await chooseSearch(option.getByRole('combobox', { name: 'Stock item', exact: true }), 'IN-BUN'); await option.getByLabel('Quantity', { exact: true }).fill(String(quantity));
    if (quantity === 3) await option.getByRole('checkbox').check();
  }
  await saveRecord(page);
  if (role === 'Staff') { await page.getByRole('button', { name: 'Log out', exact: true }).click(); await page.getByLabel('Preview role').selectOption('Staff'); await page.getByRole('button', { name: 'Open preview', exact: true }).click(); }
  await nav(page, 'POS'); const card = page.getByRole('button', { name: 'Add Grilled Beef Sliders to order', exact: true }); await expect(card).toBeEnabled(); await card.click();
  const dialog = page.getByRole('dialog', { name: 'Add modifiers — Grilled Beef Sliders' });
  for (const quantity of [3, 2]) { const option = dialog.getByRole('checkbox', { name: new RegExp(`Add ${quantity} buns`) }); await expect(option).not.toBeChecked(); await expect(option).toBeDisabled(); }
  const one = dialog.getByRole('checkbox', { name: /Add 1 buns/ }); await expect(one).toBeEnabled(); await expect(one).not.toBeChecked(); await one.check(); await capture(page, `${role}-four-buns`); await dialog.getByRole('button', { name: 'Add', exact: true }).click(); await expect(card).toBeDisabled();
  await page.getByRole('button', { name: 'Edit options', exact: true }).click(); await expect(page.getByRole('checkbox', { name: /Add 1 buns/ })).toBeChecked(); await page.getByRole('button', { name: 'Update item', exact: true }).click();
  await page.getByRole('button', { name: 'Pay', exact: true }).click(); await page.getByRole('button', { name: 'CASH PAYMENT', exact: true }).click(); await page.getByLabel('Amount Given:').fill('1000'); await page.getByRole('button', { name: 'Confirm', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(card).toBeDisabled();
});

for (const [width, height] of [[1440, 900], [820, 1180], [390, 844], [320, 568], [820, 400]]) test(`retail actions, stock details, long-range legend and final single void at ${width}x${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height }); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await enter(page, 'Admin');
  await inventory(page, 'Deck Sleeves'); const row = page.locator('.product-table > tbody > tr').first(); await expect(row.getByRole('button', { name: /Stock details/ })).toHaveCount(0); const actions = row.locator(':scope > td > .row-actions button'); await expect(actions).toHaveCount(3);
  expect(await actions.allTextContents()).toEqual(['Edit', '', 'Remove']); const tops = await actions.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top)); expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
  const quantity = await row.locator('.stock-availability-note').textContent(); await row.getByRole('button', { name: 'Add stock to Deck Sleeves', exact: true }).click(); await page.getByLabel('Quantity Added').fill('2'); await page.getByRole('dialog').getByRole('button', { name: 'Add Stock', exact: true }).click(); await expect(row.locator('.stock-availability-note')).not.toHaveText(quantity!); await capture(page, 'retail-actions');
  await page.getByLabel('Search inventory', { exact: true }).fill('Model Kit Editions'); const details = page.getByRole('button', { name: 'Stock details for Model Kit Editions', exact: true }); await expect(details).toHaveText('Stock Details'); if (await details.getAttribute('aria-expanded') !== 'true') await details.click(); await expect(page.locator('#stock-HB005')).toBeVisible();
  await nav(page, 'Reports'); await page.getByLabel('Report scope').selectOption('Inventory usage'); await page.getByLabel('To', { exact: true }).fill('2026-10-16'); await page.getByLabel('From', { exact: true }).fill('2026-07-16');
  await expect(page.locator('.ingredient-balances .record-count')).toContainText('13 of 13'); await expect(page.locator('.balance-coverage').first()).toContainText('2026-08-01 to 2026-10-16'); await expect(page.locator('.balance-track.baseline-unavailable')).toHaveCount(0);
  const legend = page.getByRole('list', { name: 'Stock balance legend' }); await expect(legend).toContainText('Red / burgundy'); await legend.scrollIntoViewIfNeeded(); await capture(page, 'long-range-balances');
  await page.getByText('How stock balances are calculated', { exact: true }).click(); await expect(page.locator('.report-method')).toContainText('partial history'); await expect(page.locator('.report-method')).toContainText('red / burgundy'); await page.locator('.report-method').scrollIntoViewIfNeeded(); await capture(page, 'balance-help');
  await page.getByLabel('From', { exact: true }).fill('2026-06-01'); await page.getByLabel('To', { exact: true }).fill('2026-07-31'); await expect(page.locator('.balance-track.baseline-unavailable')).toHaveCount(13); await expect(page.locator('.balance-track.baseline-unavailable').first()).toHaveText('Balance unavailable');
  await nav(page, 'Audit Trail'); await page.locator('.order-link').first().click(); const selected = await page.locator('.detail-id').textContent(); await page.getByRole('button', { name: 'VOID', exact: true }).click(); await page.getByLabel('Reason for Voiding of Sale:').selectOption('Customer cancelled order'); await page.getByRole('button', { name: 'Proceed', exact: true }).click(); await page.getByRole('button', { name: 'Confirm Void', exact: true }).click();
  const final = page.getByRole('dialog', { name: 'Void this order permanently?' }); await expect(final).toContainText('cannot be undone'); await expect(final).toContainText('Customer cancelled order'); await expect(final).toContainText('Alex (Admin)'); await expect(final.getByRole('button', { name: 'Go back' })).toBeFocused(); await expect(final.getByRole('heading')).toBeInViewport(); await capture(page, 'single-void-final');
  for (const close of ['Go back', 'Escape', 'Close dialog', 'outside']) {
    if (close === 'Escape') await page.keyboard.press('Escape'); else if (close === 'outside') await page.mouse.click(3, 3); else await final.getByRole('button', { name: close, exact: true }).click();
    await expect(page.locator('.detail-id')).toHaveText(selected!); await expect(page.locator('.sale-details')).not.toContainText('Status: Voided'); await page.getByRole('button', { name: 'Confirm Void', exact: true }).click();
  }
  await final.getByRole('button', { name: 'Void order', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.locator('.sale-details')).toContainText('Status: Voided'); await expect(page.locator('.sale-details')).toContainText('Alex · Admin');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); expect(errors).toEqual([]);
});

test('three-month report exports the verified coverage with the requested dates and all ingredient rows', async ({ page }) => {
  await enter(page); await nav(page, 'Reports'); await page.getByLabel('To', { exact: true }).fill('2026-10-16'); await page.getByLabel('From', { exact: true }).fill('2026-07-16'); await page.getByLabel('Report scope').selectOption('Inventory usage'); await page.getByLabel('Export format').selectOption('CSV');
  await page.getByRole('button', { name: 'Export report', exact: true }).click(); const pending = page.waitForEvent('download'); await page.getByRole('dialog').getByRole('button', { name: 'Export CSV', exact: true }).click(); const download = await pending; await mkdir(output, { recursive: true }); const path = `${output}/three-month-coverage.csv`; await download.saveAs(path); const csv = await readFile(path, 'utf8');
  expect(csv).toContain('2026-07-16'); expect(csv).toContain('Partial history: 2026-08-01 to 2026-10-16; earlier stock unknown'); for (const item of createDemoData().stock.filter(item => item.kind === 'Ingredient')) expect(csv).toContain(item.sku ?? item.id); expect(csv).not.toMatch(/NaN|Infinity/);
});
