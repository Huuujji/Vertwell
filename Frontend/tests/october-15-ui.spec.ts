import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDemoData, type Product } from './fixtures/demo';
import { consumeStock, usageFor } from '../src/data/inventory';
import { generateItemCode } from '../src/data/item-codes';
import { configurationError } from '../src/data/catalogue';

const output = fileURLToPath(new URL('../../../.review/frontend/october-15/', import.meta.url));
async function enter(page: Page, role = 'Owner') { await page.clock.setFixedTime(new Date('2026-10-15T04:23:00Z')); await page.goto('/'); await page.getByLabel('Preview role').selectOption(role); await page.getByRole('button', { name: 'Open preview', exact: true }).click(); }
async function nav(page: Page, name: string) { if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click(); await page.getByRole('navigation').getByRole('button', { name, exact: true }).click(); }
async function choose(page: Page, label: string, query: string, match: string | RegExp) { const field = page.getByRole('combobox', { name: label, exact: true }); await field.fill(query); await page.getByRole('option', { name: match }).click(); }
async function dates(page: Page) { await page.getByLabel('Manufactured Date', { exact: true }).fill('2026-10-01'); await page.getByLabel('Expiry On', { exact: true }).fill('2026-12-31'); }
async function capture(page: Page, name: string) { await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/${name}.png`, fullPage: true }); await page.screenshot({ path: `${output}/${name}-viewport.png` }); }

test('Overall combines category totals and sends all categories and the selected times to Reports', async ({ page }) => {
  await enter(page); const total = async () => Number((await page.locator('.today-card strong').innerText()).replace(/[^\d.]/g, ''));
  const food = await total(); await page.getByRole('button', { name: 'Hobby', exact: true }).click(); const hobby = await total();
  await page.getByRole('button', { name: 'Overall', exact: true }).click(); expect(await total()).toBeCloseTo(food + hobby, 2);
  await page.getByText('Daily sales values', { exact: true }).click(); await expect(page.locator('.daily-sales-values')).toContainText('Completed orders'); await capture(page, 'dashboard-overall');
  await page.getByRole('button', { name: 'View filtered report' }).click(); await expect(page.getByLabel('Sales category')).toHaveValue('All categories');
});

test('zero drafts can be erased and restore on blur; stock selectors support typed search and keyboard selection', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory'); await page.getByRole('button', { name: 'Modifier groups', exact: true }).click();
  await page.getByRole('button', { name: 'Add library group', exact: true }).click();
  const minimum = page.getByLabel('Minimum choices'), maximum = page.getByLabel('Maximum choices');
  await minimum.fill(''); await expect(minimum).toHaveValue(''); await maximum.focus(); await expect(minimum).toHaveValue('0');
  await minimum.fill('2'); await expect(minimum).toHaveValue('2'); await maximum.fill(''); await minimum.focus(); await expect(maximum).toHaveValue('0');
  await page.getByRole('button', { name: 'Add option', exact: true }).click(); await page.getByRole('button', { name: 'Add modifier input', exact: true }).click();
  const stock = page.getByRole('combobox', { name: 'Stock item', exact: true }); await stock.fill('beans'); await expect(page.getByRole('listbox', { name: 'Stock item choices' }).getByRole('option')).toHaveCount(1); await stock.press('ArrowDown'); await stock.press('Enter'); await expect(stock).toHaveValue(/Espresso beans/);
  await capture(page, 'modifier-search');
});

test('batch editing loads only that batch quantity and dates, saves one batch and removes one batch', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory'); await page.getByLabel('Search inventory', { exact: true }).fill('Oat Milk');
  await page.getByRole('button', { name: 'Edit Oat Milk', exact: true }).click();
  await choose(page, 'Receipt batch to edit', 'Batch 2', /^Batch 2/);
  const quantity = page.getByLabel('Quantity', { exact: true }); const before = await quantity.inputValue(); expect(Number(before)).toBeLessThan(32);
  await expect(page.getByLabel('Expiry On', { exact: true })).toHaveValue('2026-11-14');
  await quantity.fill('15'); await page.getByLabel('Manufactured Date', { exact: true }).fill('2026-09-01'); await page.getByLabel('Expiry On', { exact: true }).fill('2026-12-31'); await capture(page, 'batch-editor');
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.getByLabel('Search inventory', { exact: true }).fill('Oat Milk');
  const first = page.locator('#stock-oat-1'), second = page.locator('#stock-oat-2'); await expect(second).toContainText('15L'); await expect(second).toContainText('Dec 31, 2026'); await expect(first).toContainText('Oct 18, 2026');
  await second.getByRole('button', { name: 'Remove Oat Milk batch 2', exact: true }).click(); await page.getByRole('button', { name: 'Confirm removal' }).click(); await expect(second).toHaveCount(0); await expect(first).not.toContainText('0L');
});

test('Inventory rows toggle highlighting without opening editors; product stock has no finished-stock disclosure', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory'); await page.getByLabel('Search inventory', { exact: true }).fill('Oat Milk'); const row = page.locator('#stock-PT002');
  await row.getByText('Oat Milk', { exact: true }).click(); await expect(row).toHaveClass('active-row'); await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
  await row.getByText('Oat Milk', { exact: true }).click(); await expect(row).not.toHaveClass('active-row'); await row.focus(); await row.press('Enter'); await expect(row).toHaveClass('active-row'); await row.press('Space'); await expect(row).not.toHaveClass('active-row');
  await page.getByRole('button', { name: 'Products', exact: true }).click(); await page.getByLabel('Inventory category').selectOption('All'); await page.getByLabel('Search inventory', { exact: true }).fill('');
  await expect(page.locator('.finished-stock-register')).toHaveCount(0); await expect(page.getByRole('heading', { name: 'Product stock', exact: true })).toHaveCount(0); await page.getByLabel('Search inventory', { exact: true }).fill('Butter Cookie Pouch'); await expect(page.getByRole('region', { name: 'Sellable products; scroll to see all columns', exact: true }).getByRole('button', { name: 'Add stock to Butter Cookie Pouch', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Stock details for Butter Cookie Pouch', exact: true })).toHaveCount(0);
});

test('recipe quantities restore zero and counted units step by whole numbers; F&B dates required and Hobby dates optional', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory'); await page.getByRole('button', { name: 'Add Product', exact: true }).click();
  await expect(page.getByLabel('Manufactured Date', { exact: true })).not.toHaveAttribute('required', '');
  await page.getByLabel('Category', { exact: true }).selectOption('Food'); await page.getByRole('combobox', { name: 'Stock model', exact: true }).selectOption('Made to order');
  await expect(page.getByLabel('Manufactured Date', { exact: true })).toHaveAttribute('required', ''); await expect(page.getByLabel('Expiry On', { exact: true })).toHaveAttribute('required', '');
  await page.getByRole('button', { name: 'Add ingredient', exact: true }).click(); const recipe = page.locator('.recipe-input').first(); const quantity = recipe.getByLabel('Quantity', { exact: true });
  await quantity.fill(''); await expect(quantity).toHaveValue(''); await recipe.getByRole('combobox', { name: 'Unit', exact: true }).focus(); await expect(quantity).toHaveValue('0');
  await expect(quantity).toHaveAttribute('step', '1'); await quantity.focus(); await quantity.press('ArrowUp'); await expect(quantity).toHaveValue('1');
  await recipe.getByRole('combobox', { name: 'Unit', exact: true }).selectOption('bottles'); await expect(quantity).toHaveAttribute('step', '1'); await recipe.getByRole('combobox', { name: 'Unit', exact: true }).selectOption('g'); await expect(quantity).toHaveAttribute('step', '0.001');
  await page.getByRole('combobox', { name: 'Stock model', exact: true }).selectOption('Bundle'); await expect(page.getByLabel('Manufactured Date', { exact: true })).toHaveAttribute('required', ''); await page.getByRole('combobox', { name: 'Stock model', exact: true }).selectOption('Variants'); await expect(page.getByLabel('Expiry On', { exact: true })).toHaveAttribute('required', '');
});

test('SKUs cover every category and stock model with four digits and avoid collisions', () => {
  const demo = createDemoData();
  for (const category of ['Hobby', 'Food', 'Beverage'] as const) for (const mode of ['Stocked', 'Variants', 'Bundle', 'Made to order'] as const) {
    if (category === 'Hobby' && mode === 'Made to order') continue;
    const categoryCode = category === 'Hobby' ? 'HB' : category === 'Food' ? 'FD' : 'BV'; const modelCode = { Stocked: 'PRR', Variants: 'PRV', Bundle: 'PRB', 'Made to order': 'PRC' }[mode];
    const code = generateItemCode('Product', category, mode, [...demo.stock, ...demo.products]); expect(code).toBe(`${modelCode}-${categoryCode}-0001`);
    expect(generateItemCode('Product', category, mode, [...demo.products, { ...demo.products[0], sku: code }])).toBe(`${modelCode}-${categoryCode}-0002`);
  }
  expect(generateItemCode('Ingredient', 'Food', 'Stocked', [])).toBe('IN-FD-0001'); expect(generateItemCode('Ingredient', 'Beverage', 'Stocked', [])).toBe('IN-BV-0001');
});

test('Food and Beverage cannot save without dates; Hobby can save without dates; Generate uses the chosen category', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory'); await page.getByRole('button', { name: 'Add Ingredient', exact: true }).click(); await page.getByLabel('Ingredient Name', { exact: true }).fill('Dated ingredient');
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Beverage'); await page.locator('.generate-field').first().getByRole('button', { name: 'Generate' }).click(); await expect(page.getByLabel('SKU', { exact: true })).toHaveValue('IN-BV-0001');
  await expect(page.getByLabel('Item Code', { exact: true })).toHaveCount(0); await page.getByLabel('Quantity', { exact: true }).fill('10'); await page.getByLabel('Quantity Alert', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Add Ingredient', exact: true })).toBeVisible(); expect(await page.getByLabel('Manufactured Date', { exact: true }).evaluate((field: HTMLInputElement) => field.validity.valueMissing)).toBe(true);
  await dates(page); await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.locator('#stock-IN-BV-0001')).toBeVisible();
  await page.getByRole('button', { name: 'Add Product', exact: true }).click(); await page.getByLabel('Product Name', { exact: true }).fill('Undated Hobby'); await page.locator('.generate-field').first().getByRole('button', { name: 'Generate' }).click(); await expect(page.getByLabel('SKU', { exact: true })).toHaveValue('PRR-HB-0001'); await page.getByLabel('Quantity', { exact: true }).fill('10'); await page.getByLabel('Quantity Alert', { exact: true }).fill('2'); await page.getByLabel('Price', { exact: true }).fill('50'); await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByRole('button', { name: 'Edit product Undated Hobby', exact: true })).toBeVisible();
});

test('library selection requires an explicit Attach action before the product has those modifiers', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory'); await page.getByRole('button', { name: 'Modifier groups', exact: true }).click(); await page.getByRole('button', { name: 'Add library group', exact: true }).click(); await page.getByLabel('Group name', { exact: true }).fill('Wrapping'); await page.getByRole('button', { name: 'Add option', exact: true }).click(); await page.getByLabel('Option name', { exact: true }).fill('Gift wrap'); await page.getByRole('button', { name: 'Save group', exact: true }).click(); await page.getByRole('button', { name: 'Back', exact: true }).click(); await page.getByLabel('Inventory category').selectOption('Hobby'); await page.getByLabel('Search inventory', { exact: true }).fill('Deck Sleeves'); await page.getByRole('button', { name: 'Edit product Deck Sleeves', exact: true }).click();
  await page.getByText('Reuse a library group', { exact: true }).click(); await page.getByRole('combobox', { name: 'Library group', exact: true }).selectOption({ label: 'Wrapping' }); await expect(page.getByRole('button', { name: 'Attach group to product', exact: true })).toBeEnabled(); await expect(page.locator('.modifier-editor > fieldset')).toHaveCount(0); await page.getByRole('button', { name: 'Save', exact: true }).click();
  await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Deck Sleeves to order', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await nav(page, 'Inventory'); await page.getByRole('button', { name: 'Edit product Deck Sleeves', exact: true }).click(); await page.getByText('Reuse a library group', { exact: true }).click(); await page.getByRole('combobox', { name: 'Library group', exact: true }).selectOption({ label: 'Wrapping' }); await page.getByRole('button', { name: 'Attach group to product', exact: true }).click(); await page.getByRole('button', { name: 'Save', exact: true }).click(); await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Deck Sleeves to order', exact: true }).click(); await expect(page.getByRole('checkbox', { name: /Gift wrap/ })).toBeVisible();
});

test('bundles can include recipe, variant and nested bundle products; shared usage, omissions, cycles and unavailable components are checked', () => {
  const demo = createDemoData(); const latte = demo.products.find(p => p.id === 'PR-CARAMEL-LATTE')!, kits = demo.products.find(p => p.id === 'PR-MODEL-KIT')!, starter = demo.products.find(p => p.id === 'PR-TABLETOP-STARTER')!;
  const bundle: Product = { id: 'new', name: 'Mixed bundle', category: 'Food', image: '', icon: '', mode: 'Bundle', price: 200, bundle: [latte, kits, starter].map(p => ({ productId: p.id, stockId: '', name: p.name, sku: p.sku!, quantity: 1, variantId: p.variants?.[1].id })) };
  expect(configurationError('Bundle', [], bundle.bundle!, demo.stock, demo.products, bundle.id)).toBeUndefined();
  const checked = usageFor([{ product: bundle, quantity: 2 }, { product: latte, quantity: 1 }], demo.stock, undefined, demo.products); expect(checked.error).toBeUndefined(); expect(checked.usage.find(i => i.stockId === 'PT001')!.quantity).toBe(0.054); expect(checked.usage.find(i => i.stockId === 'HB005')!.quantity).toBe(2); expect(checked.usage.find(i => i.stockId === 'HB009')!.quantity).toBe(4);
  const after = consumeStock(demo.stock, checked.usage); expect(after.find(i => i.id === 'HB009')!.quantity).toBe(demo.stock.find(i => i.id === 'HB009')!.quantity - 4);
  expect(usageFor([{ product: bundle, quantity: 1 }], demo.stock, undefined, demo.products.filter(p => p.id !== latte.id)).error).toContain('missing or unavailable');
  const cyclic = { ...bundle, bundle: [{ productId: bundle.id, stockId: '', name: bundle.name, sku: bundle.id, quantity: 1 }] }; expect(usageFor([{ product: cyclic, quantity: 1 }], demo.stock, undefined, [...demo.products, cyclic]).error).toContain('cannot include itself');
});

test('bundle product selector lists every available product; recipe bundle checkout records ingredients once', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory'); await page.getByRole('button', { name: 'Add Product', exact: true }).click(); await page.getByLabel('Category', { exact: true }).selectOption('Food'); await page.getByRole('combobox', { name: 'Stock model', exact: true }).selectOption('Bundle'); await page.getByLabel('Product Name', { exact: true }).fill('Latte Bundle'); await page.getByLabel('SKU', { exact: true }).fill('PRB-FD-9000'); await page.getByLabel('Price', { exact: true }).fill('150'); await dates(page);
  await page.getByRole('button', { name: 'Add bundle component' }).click(); await page.getByRole('combobox', { name: 'Available product' }).click(); await expect(page.getByRole('listbox', { name: 'Available product choices' }).getByRole('option')).toHaveCount(10); await choose(page, 'Available product', 'Latte', /Iced Caramel Latte/); await page.getByLabel('Quantity per bundle').fill('2'); await capture(page, 'recipe-bundle-editor'); await page.getByRole('button', { name: 'Save', exact: true }).click();
  await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Latte Bundle to order', exact: true }).click(); const dialog = page.getByRole('dialog'); await expect(dialog).toHaveAccessibleName('Included in Latte Bundle'); await expect(dialog).toContainText('2 × Iced Caramel Latte'); await expect(dialog.getByRole('button', { name: 'Save customization' })).toHaveCount(0); await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Pay', exact: true }).click(); await page.getByRole('button', { name: 'CASH PAYMENT' }).click(); await page.getByLabel('Amount Given:', { exact: true }).fill('1000'); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await nav(page, 'Reports'); await page.getByLabel('From', { exact: true }).fill('2026-10-15'); await page.getByLabel('To', { exact: true }).fill('2026-10-15'); await expect(page.getByRole('region', { name: 'Ingredient usage by transaction; scroll to see all columns' })).toContainText('Latte Bundle');
});

test('POS shows both variant prices and bundle information with quantity and Add', async ({ page }) => {
  await enter(page, 'Staff'); await expect(page.getByRole('button', { name: 'Add Model Kit Editions to order' })).toContainText(/From\s+750\s+To\s+1250/i);
  await page.getByRole('button', { name: 'Add Tabletop Starter Bundle to order' }).click(); await expect(page.getByRole('dialog')).toHaveAccessibleName('Included in Tabletop Starter Bundle'); await expect(page.getByRole('heading', { name: 'Included in each bundle' })).toBeFocused(); await page.getByRole('button', { name: 'Increase customization quantity' }).click(); await capture(page, 'staff-bundle'); await page.getByRole('button', { name: 'Add', exact: true }).click(); await expect(page.locator('.cart-line')).toContainText('Tabletop Starter Bundle');
});

test('Print opens the browser PDF viewer with the same document as Export and no app modal', async ({ page }) => {
  await enter(page); await nav(page, 'Reports'); await page.evaluate(() => { const original = URL.createObjectURL; URL.createObjectURL = function(blob) { const result = original.call(URL, blob); if (blob instanceof Blob && blob.type === 'application/pdf') (window as unknown as { printedPdf: string }).printedPdf = result; return result; }; });
  const popupPending = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Print', exact: true }).click(); const popup = await popupPending; await expect.poll(() => page.evaluate(() => (window as unknown as { printedPdf?: string }).printedPdf)).toBeTruthy(); await expect(page.getByRole('dialog')).toHaveCount(0);
  const source = await page.evaluate(() => (window as unknown as { printedPdf: string }).printedPdf); await expect.poll(() => popup.url()).toBe(source);
  const bytes = await page.evaluate(async url => Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())), source);
  await page.getByRole('button', { name: 'Export report', exact: true }).click(); const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download PDF', exact: true }).click(); const download = await pending; expect(Buffer.from(bytes).equals(await readFile((await download.path())!))).toBe(true); await popup.close();
});

for (const [width, height] of [[1440,900], [820,1180], [390,844], [320,568], [820,400]]) test(`shared date/time controls and four-row Reports remain usable at ${width}x${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height }); await enter(page); await page.getByRole('button', { name: 'Overall', exact: true }).click(); await page.getByText('Daily sales values', { exact: true }).click(); await capture(page, `${width}x${height}-dashboard`);
  await page.getByRole('button', { name: 'Open from time time picker' }).click(); const time = page.getByRole('dialog', { name: 'From time time picker' }); await expect(time).toBeVisible(); await capture(page, `${width}x${height}-time`); await time.getByRole('button', { name: 'Now', exact: true }).click(); await expect(page.getByLabel('From time', { exact: true })).toHaveValue('12:23');
  await page.getByRole('button', { name: 'Open from time time picker' }).click(); await time.getByRole('button', { name: 'Clear', exact: true }).click(); await expect(page.getByLabel('From time', { exact: true })).toHaveValue('00:00'); await page.getByRole('button', { name: 'Open from time time picker' }).click(); await time.getByLabel('From time hour').selectOption('00'); await time.getByLabel('From time minute').selectOption('00'); await time.getByRole('button', { name: 'Set time' }).click();
  await nav(page, 'Reports'); for (const table of await page.locator('.report-table').all()) expect(await table.locator('tbody tr:not(.paged-out)').count()).toBeLessThanOrEqual(4); await expect(page.getByRole('navigation', { name: 'Stocks remaining · current on hand (2026-10-15) pagination' })).toContainText('1–4 of 32');
  await page.getByRole('navigation', { name: 'Stocks remaining · current on hand (2026-10-15) pagination' }).getByRole('button', { name: 'Next' }).click(); await expect(page.getByRole('navigation', { name: 'Stocks remaining · current on hand (2026-10-15) pagination' })).toContainText('5–8 of 32');
  await page.getByText('How stock balances are calculated', { exact: true }).click(); await expect(page.locator('.report-method')).toContainText('10 bottles left'); await capture(page, `${width}x${height}-reports`);
  await page.getByRole('button', { name: 'Open from calendar' }).click(); const calendar = page.getByRole('dialog', { name: 'From calendar' }); await capture(page, `${width}x${height}-calendar`); await calendar.getByRole('button', { name: 'Clear', exact: true }).click(); await expect(page.getByLabel('From', { exact: true })).toHaveValue(''); await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
