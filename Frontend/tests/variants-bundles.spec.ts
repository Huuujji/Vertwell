import { chooseSearch } from './fixtures/search-select';
import { saveRecord } from './fixtures/save-record';
import { test, expect } from './fixtures/legacy-preview';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { configurationError } from '../src/data/catalogue';
import { consumeStock, requirements, usageFor } from '../src/data/inventory';
import { cartKey, linePrice } from '../src/pages/Pos';
import type { Product, ProductVariant, StockItem } from '../src/data/demo';

const stock: StockItem[] = ['a', 'b'].map(id => ({ id, name: id, sku: id, category: 'Hobby', kind: 'Finished', quantity: 10, unit: 'pcs', manufactured: '', expires: '', status: 'In Stock' }));
const variants: ProductVariant[] = [{ id: 'standard', name: 'Standard', stockId: 'a', sku: 'a', price: 100, available: true }, { id: 'premium', name: 'Premium', stockId: 'b', sku: 'b', price: 200, available: true }];
const product: Product = { id: 'variants', name: 'Edition', category: 'Hobby', price: 100, image: '', icon: '', mode: 'Variants', variants };
const bundle: Product = { ...product, id: 'bundle', name: 'Bundle', mode: 'Bundle', variants: undefined, bundle: [{ stockId: 'a', name: 'A', sku: 'a', quantity: 2 }, { stockId: 'b', name: 'B', sku: 'b', quantity: 1 }], recipe: [{ stockId: 'a', quantity: 99, unit: 'pcs' }] };

test('variants and bundles aggregate shared stock once and reject absent choices, shortages and removals', () => {
  const lines = [{ product, variant: variants[0], quantity: 3 }, { product: bundle, quantity: 2 }];
  const result = usageFor(lines, stock);
  expect(result.error).toBeUndefined(); expect(result.usage.map(value => [value.stockId, value.quantity])).toEqual([['a', 7], ['b', 2]]);
  expect(consumeStock(stock, result.usage).map(value => value.quantity)).toEqual([3, 8]); expect(stock[0].quantity).toBe(10);
  expect(requirements(bundle)).toEqual([{ stockId: 'a', quantity: 2, unit: 'pcs' }, { stockId: 'b', quantity: 1, unit: 'pcs' }]);
  expect(usageFor([{ product, quantity: 1 }], stock).error).toContain('Choose a variant');
  expect(usageFor([...lines, { product, variant: variants[0], quantity: 4 }], stock).error).toContain('Not enough usable');
  expect(usageFor([{ product, variant: { ...variants[0], available: false }, quantity: 1 }], stock).error).toContain('unavailable');
  expect(usageFor([{ product: bundle, quantity: 1, modifiers: [{ id: 'remove', name: 'Remove', price: 0, inputs: [{ stockId: 'a', quantity: -2, unit: 'pcs' }] }] }], stock).error).toContain('cannot remove');
  expect(usageFor([{ product: bundle, quantity: 1 }], stock.map(value => ({ ...value, expires: '2000-01-01' }))).error).toContain('usable');
  expect(usageFor([{ product, variant: variants[0], quantity: 1 }], stock.map(value => ({ ...value, kind: 'Ingredient' }))).error).toContain('product stock in pieces');
});

test('configuration validation rejects duplicate names/SKUs, incompatible stock and invalid components', () => {
  expect(configurationError('Variants', [], [], stock)).toContain('at least one');
  expect(configurationError('Variants', [variants[0], { ...variants[1], name: ' standard ' }], [], stock)).toContain('names must be unique');
  expect(configurationError('Variants', [variants[0], { ...variants[1], stockId: 'a' }], [], stock)).toContain('different');
  expect(configurationError('Variants', [{ ...variants[0], price: 0 }], [], stock)).toContain('positive price');
  expect(configurationError('Variants', variants, [], stock.map(value => ({ ...value, unit: 'kg' })))).toContain('pieces');
  expect(configurationError('Bundle', [], [], stock)).toContain('at least one');
  expect(configurationError('Bundle', [], [{ ...bundle.bundle![0], quantity: 1.5 }], stock)).toContain('whole-number');
  expect(configurationError('Bundle', [], [bundle.bundle![0], bundle.bundle![0]], stock)).toContain('once');
  expect(configurationError('Bundle', [], bundle.bundle!, stock)).toBeUndefined();
});

test('cart keys and discount pricing preserve variant and bundle configuration snapshots', () => {
  const line = { product: { ...product, discountType: 'Percentage' as const, discountValue: 10 }, variant: variants[1], quantity: 1 };
  expect(linePrice(line)).toBe(180);
  expect(cartKey(line)).not.toBe(cartKey({ ...line, variant: variants[0] }));
  expect(cartKey(line)).not.toBe(cartKey({ ...line, variant: { ...variants[1], price: 250 } }));
  expect(cartKey(line)).toBe(cartKey({ ...line, product: { ...line.product, price: 150 } }));
  expect(cartKey({ product: bundle, quantity: 1 })).not.toBe(cartKey({ product: { ...bundle, bundle: [{ ...bundle.bundle![0], quantity: 3 }] }, quantity: 1 }));
});

async function enter(page: Page, role = 'Owner') {
  await page.clock.setFixedTime(new Date('2026-10-03T17:00:00Z')); await page.goto('/');
  await page.getByLabel('Preview role').selectOption(role); await page.getByRole('button', { name: 'Open preview', exact: true }).click();
}
async function nav(page: Page, name: string) {
  if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
  if (name === 'Inventory') { await page.getByRole('button', { name: 'All inventory', exact: true }).click(); await page.getByLabel('Inventory category', { exact: true }).selectOption('All'); }
}
async function startProduct(page: Page, mode: string, name: string, sku: string) {
  await nav(page, 'Inventory'); await page.getByRole('button', { name: 'Add Product', exact: true }).click();
  await page.getByLabel('Product Name', { exact: true }).fill(name); await page.locator('.generate-field input').first().fill(sku);
  await page.getByRole('combobox', { name: 'Stock model', exact: true }).selectOption(mode);
}
async function createVariants(page: Page) {
  await startProduct(page, 'Variants', 'Collector editions', 'EDITIONS');
  for (const [name, id, price] of [['Standard', 'HB001', '250'], ['Premium', 'HB002', '1200']]) {
    await page.getByRole('button', { name: 'Add variant', exact: true }).click();
    const row = page.locator('.product-configurations fieldset').last();
    await row.getByLabel('Variant name', { exact: true }).fill(name); await chooseSearch(row.getByRole('combobox', { name: 'Variant stock', exact: true }), id); await row.getByLabel('Variant price', { exact: true }).fill(price);
  }
  await saveRecord(page);
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
}
async function createBundle(page: Page) {
  await startProduct(page, 'Bundle', 'Collector bundle', 'BUNDLE'); await page.getByLabel('Price', { exact: true }).fill('1500');
  for (const [id, count] of [['PBP', '2'], ['PCB', '1']]) {
    await page.getByRole('button', { name: 'Add bundle component', exact: true }).click();
    const row = page.locator('.product-configurations fieldset').last();
    await chooseSearch(row.getByRole('combobox', { name: 'Available product', exact: true }), id); await row.getByLabel('Quantity per bundle', { exact: true }).fill(count);
  }
  await saveRecord(page);
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
}
async function choose(page: Page, name = 'Standard', quantity = '1') {
  await page.getByRole('button', { name: 'Add Collector editions to order', exact: true }).click();
  await page.getByRole('radio', { name: new RegExp(`^${name}`) }).check(); await page.getByLabel('Quantity', { exact: true }).fill(quantity); await page.getByRole('button', { name: /^(Add|Update item)$/, exact: true }).click();
}
async function cash(page: Page) {
  await page.getByRole('button', { name: 'Pay', exact: true }).click(); await page.getByRole('button', { name: 'CASH PAYMENT', exact: true }).click();
  await page.getByLabel('Amount Given:', { exact: true }).fill('10000'); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
}

test('Owner variants require selection, merge matching SKUs, retain edits and export their recorded configuration', async ({ page }) => {
  await enter(page); await createVariants(page); await nav(page, 'POS');
  await page.getByRole('searchbox', { name: 'Search items', exact: true }).fill('hb002');
  await expect(page.getByRole('button', { name: 'Add Collector editions to order', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search items', exact: true }).fill('');
  await page.getByRole('button', { name: 'Add Collector editions to order', exact: true }).click();
  await page.getByRole('button', { name: /^(Add|Update item)$/, exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Choose a variant');
  await page.getByRole('radio', { name: /^Premium/ }).check(); await page.getByLabel('Quantity', { exact: true }).fill('6');
  await page.getByRole('button', { name: /^(Add|Update item)$/, exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Not enough usable');
  await page.getByLabel('Quantity', { exact: true }).fill('1'); await page.getByRole('button', { name: /^(Add|Update item)$/, exact: true }).click();
  await choose(page); await choose(page); await expect(page.locator('.cart-line')).toHaveCount(2);
  const standard = page.locator('.cart-line').filter({ hasText: 'Standard' }); await expect(standard).toContainText('HB001'); await expect(standard.locator('output')).toHaveText('2');
  await standard.getByRole('button', { name: 'Edit options', exact: true }).click(); await expect(page.getByRole('radio', { name: /^Standard/ })).toBeChecked();
  await page.getByRole('radio', { name: /^Premium/ }).check(); await page.keyboard.press('Escape'); await expect(standard.locator('output')).toHaveText('2');
  await cash(page); await nav(page, 'Audit Trail'); await page.getByRole('searchbox', { name: 'Search sales', exact: true }).fill('HB002');
  await expect(page.locator('tbody tr')).toHaveCount(1); await page.locator('tbody tr').click(); await expect(page.locator('.sale-details')).toContainText('Collector editions — Premium');
  await expect(page.locator('.sale-details')).toContainText('HB002');
  await nav(page, 'Inventory'); await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('HB001'); await expect(page.locator('#stock-HB001')).toContainText('43pcs');
  await nav(page, 'Reports'); await page.getByLabel('To', { exact: true }).fill('2026-10-04'); await page.getByLabel('From', { exact: true }).fill('2026-10-04');
  await page.getByRole('combobox', { name: 'Export format', exact: true }).selectOption('CSV'); await page.getByRole('button', { name: 'Export report', exact: true }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export', exact: true }).click(); const downloaded = await download; const data = await readFile((await downloaded.path())!, 'utf8');
  expect(data).toContain('Purchased variants and bundles'); expect(data).toContain('Premium · HB002'); expect(data).toContain('Standard · HB001');
});

test('Admin bundles consume component quantities and retain old cart and sale snapshots after catalogue changes', async ({ page }) => {
  await enter(page, 'Admin'); await createBundle(page); await nav(page, 'POS');
  await page.getByRole('button', { name: 'Add Collector bundle to order', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Included in this bundle' })).toContainText('2 × Pokémon Booster Pack');
  await page.getByLabel('Quantity', { exact: true }).fill('6'); await page.getByRole('button', { name: 'Add', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Not enough usable');
  await page.getByLabel('Quantity', { exact: true }).fill('1'); await page.getByRole('button', { name: 'Add', exact: true }).click();
  await nav(page, 'Inventory'); await page.getByLabel('Search inventory', { exact: true }).fill('Collector bundle'); await page.getByRole('button', { name: 'Edit product Collector bundle', exact: true }).click();
  await page.getByLabel('Price', { exact: true }).fill('1700'); await page.getByLabel('Quantity per bundle', { exact: true }).first().fill('3'); await saveRecord(page);
  await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Collector bundle to order', exact: true }).click(); await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('.cart-line')).toHaveCount(2); await expect(page.locator('.cart-line').first()).toContainText('2× Pokémon'); await expect(page.locator('.cart-line').last()).toContainText('3× Pokémon');
  await cash(page); await nav(page, 'Inventory'); await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('HB001'); await expect(page.locator('#stock-HB001')).toContainText('40pcs');
  await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('Collector bundle'); await page.getByRole('button', { name: 'Edit product Collector bundle', exact: true }).click();
  await page.getByLabel('Quantity per bundle', { exact: true }).first().fill('4'); await saveRecord(page);
  await nav(page, 'Audit Trail'); await page.getByRole('searchbox', { name: 'Search sales', exact: true }).fill('Collector bundle'); await page.locator('tbody tr').click();
  await expect(page.locator('.sale-details')).toContainText('2× Pokémon'); await expect(page.locator('.sale-details')).toContainText('3× Pokémon'); await expect(page.locator('.sale-details')).not.toContainText('4× Pokémon');
});

test('small-screen configuration drafts validate duplicate SKUs and survive cancelled navigation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await enter(page); await createVariants(page);
  await page.getByRole('button', { name: 'Edit product Collector editions', exact: true }).click();
  await chooseSearch(page.getByRole('combobox', { name: 'Variant stock', exact: true }).last(), 'HB001'); await saveRecord(page);
  await expect(page.getByRole('alert')).toContainText('different product-stock SKU');
  await page.getByLabel('Variant name', { exact: true }).first().fill('A long edition name that stays readable on a narrow phone screen');
  await nav(page, 'Reports'); await expect(page.getByRole('dialog', { name: 'Discard inventory edits?' })).toBeVisible(); await page.keyboard.press('Escape');
  await expect(page.getByLabel('Variant name', { exact: true }).first()).toHaveValue('A long edition name that stays readable on a narrow phone screen');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await chooseSearch(page.getByRole('combobox', { name: 'Variant stock', exact: true }).last(), 'HB002'); await saveRecord(page);
  await createBundle(page); await page.getByRole('button', { name: 'Edit product Collector bundle', exact: true }).click();
  await chooseSearch(page.getByRole('combobox', { name: 'Available product', exact: true }).last(), 'PBP'); await saveRecord(page); await expect(page.getByRole('alert')).toContainText('each product configuration once');
});

test('variant stock and price edits preserve the existing cart selection and its sale snapshot', async ({ page }) => {
  await enter(page); await createVariants(page); await nav(page, 'POS'); await choose(page);
  await nav(page, 'Inventory'); await page.getByLabel('Search inventory', { exact: true }).fill('Collector editions'); await page.getByRole('button', { name: 'Edit product Collector editions', exact: true }).click();
  await chooseSearch(page.getByRole('combobox', { name: 'Variant stock', exact: true }).first(), 'HB003');
  await page.getByLabel('Variant price', { exact: true }).first().fill('300'); await saveRecord(page);
  await nav(page, 'POS'); await choose(page); await expect(page.locator('.cart-line')).toHaveCount(2);
  await expect(page.locator('.cart-line').first()).toContainText('HB001'); await expect(page.locator('.cart-line').first()).toContainText('250.00');
  await expect(page.locator('.cart-line').last()).toContainText('HB003'); await expect(page.locator('.cart-line').last()).toContainText('300.00');
  await page.locator('.cart-line').first().getByRole('button', { name: 'Edit options' }).click();
  await expect(page.getByRole('radio', { name: /^Standard/ })).toBeChecked(); await expect(page.locator('.customize-price')).toContainText('250.00'); await page.getByRole('button', { name: /^(Add|Update item)$/, exact: true }).click();
  await cash(page); await nav(page, 'Inventory'); await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('HB001'); await expect(page.locator('#stock-HB001')).toContainText('44pcs');
  await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('HB003'); await expect(page.locator('#stock-HB003')).toContainText('29pcs');
});

test('Staff variant and bundle checkout stays Pending and consumes shared component stock once', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 400 }); await enter(page); await createVariants(page); await createBundle(page);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click(); await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByLabel('Preview role').selectOption('Staff'); await page.getByRole('button', { name: 'Open preview', exact: true }).click();
  await choose(page, 'Standard', '2'); await page.getByRole('button', { name: 'Add Collector bundle to order', exact: true }).click(); await page.getByRole('button', { name: 'Add', exact: true }).click();
  await cash(page); await nav(page, 'Today’s Sales History'); await page.locator('tbody tr').first().click(); await expect(page.locator('.sale-details')).toContainText('Status: Pending');
  await expect(page.locator('.sale-details')).toContainText('consumption is retained'); await expect(page.locator('.sale-details')).toContainText('HB001');
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click(); await expect(page.getByRole('navigation').getByRole('button', { name: 'Inventory', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Log out', exact: true }).click(); await page.getByLabel('Preview role').selectOption('Owner'); await page.getByRole('button', { name: 'Open preview', exact: true }).click();
  await nav(page, 'Inventory'); await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('HB001'); await expect(page.locator('#stock-HB001')).toContainText('41pcs');
});
