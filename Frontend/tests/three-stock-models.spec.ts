import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { businessDate, createDemoData } from './fixtures/demo';
import { consumeStock, convert, requirements, stockKind, usageFor, usableQuantity } from '../src/data/inventory';
import { configurationError, productStockError } from '../src/data/catalogue';

const captures = fileURLToPath(new URL('../../../.review/frontend/three-stock-models/', import.meta.url));
const oldNames = ['Mango Matcha Latte', 'Buttered Croissant', 'Iced Matcha Latte', 'Japanese Mochi', 'Matcha Cookie Pack', 'Card Pack', 'Yu-Gi-Oh! Card Set', 'Pokémon Collection Box', 'Pokémon Booster Pack', 'Hamburger'];
async function nav(page: Page, name: string) {
  if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
}
async function person(page: Page, role: string, id: string) {
  await page.getByLabel('Preview role').selectOption(role); await page.getByLabel('Preview person').selectOption(id);
  await page.getByRole('button', { name: 'Open preview', exact: true }).click();
}
async function enter(page: Page, role = 'Owner', id = 'angel') {
  await page.clock.setFixedTime(new Date('2026-10-03T17:00:00Z')); await page.goto('/'); await person(page, role, id);
}
async function cash(page: Page) {
  await page.getByRole('button', { name: 'Pay', exact: true }).click(); await page.getByRole('button', { name: 'CASH PAYMENT', exact: true }).click();
  await page.getByLabel('Amount Given:', { exact: true }).fill('10000'); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
}
async function stockRow(page: Page, id: string) {
  await nav(page, 'Inventory'); await page.getByRole('button', { name: 'All inventory', exact: true }).click();
  await page.getByLabel('Inventory category').selectOption('All'); await page.getByLabel('Search inventory', { exact: true }).fill(id);
  return page.locator(`#stock-${id}`);
}

test('Hobby uses three finished-stock models; Food uses all four with compatible recipes and SKUs', () => {
  const demo = createDemoData();
  expect(demo.products).toHaveLength(10);
  expect([...new Set(demo.products.filter(product => product.category === 'Hobby').map(product => product.mode))].sort()).toEqual(['Bundle', 'Stocked', 'Variants']);
  expect([...new Set(demo.products.filter(product => product.category === 'Food').map(product => product.mode))].sort()).toEqual(['Bundle', 'Made to order', 'Stocked', 'Variants']);
  expect(new Set(demo.products.map(product => product.id)).size).toBe(10);
  for (const name of oldNames) expect(demo.products.some(product => product.name === name)).toBe(false);
  for (const product of demo.products) {
    expect(productStockError(product, demo.stock)).toBeUndefined();
    expect(configurationError(product.mode, product.variants ?? [], product.bundle ?? [], demo.stock)).toBeUndefined();
    for (const variant of product.mode === 'Variants' ? product.variants! : [undefined]) {
      const inputs = requirements(product, [], variant); expect(inputs.length).toBeGreaterThan(0);
      expect(usageFor([{ product, quantity: 1, variant }], demo.stock).error).toBeUndefined();
      for (const input of inputs) {
        const item = demo.stock.find(item => item.id === input.stockId)!;
        expect(stockKind(item)).toBe(product.mode === 'Made to order' ? 'Ingredient' : 'Finished');
        expect(Number.isFinite(convert(input.quantity, input.unit, item.unit))).toBe(true); expect(input.quantity).toBeGreaterThan(0);
        if (product.mode !== 'Made to order') expect([input.unit, item.unit]).toEqual(['pcs', 'pcs']);
      }
    }
    for (const component of product.bundle ?? []) {
      const item = demo.stock.find(item => item.id === component.stockId)!;
      expect([component.name, component.sku]).toEqual([item.name, item.sku]);
    }
  }
  expect(demo.stock.some(item => usableQuantity(item) < item.quantity)).toBe(true);
  const fresh = createDemoData(); fresh.products.find(product => product.mode === 'Variants')!.variants![0].price = 1;
  fresh.products.find(product => product.mode === 'Bundle')!.bundle![0].quantity = 99;
  expect(demo.products.find(product => product.mode === 'Variants')!.variants![0].price).toBe(75);
  expect(demo.products.find(product => product.mode === 'Bundle')!.bundle![0].quantity).toBe(2);
});

test('replacement seed receipts reconcile actors, configuration snapshots, VAT and opening-minus-consumption', () => {
  const demo = createDemoData();
  expect(demo.accounts.map(account => account.role).sort()).toEqual(['Admin', 'Owner', 'Staff', 'Staff', 'Staff']);
  let remaining = structuredClone(demo.openingStock);
  for (const sale of [...demo.sales].sort((a, b) => a.time.localeCompare(b.time))) {
    const actor = demo.accounts.find(account => account.id === sale.cashierId)!;
    expect([sale.cashier, sale.cashierRole]).toEqual([actor.name, actor.role]);
    const lines = sale.lines.map(line => {
      const product = demo.products.find(product => line.name === product.name || line.name.startsWith(`${product.name} — `))!;
      expect(product).toBeTruthy(); expect(line.category).toBe(product.category); expect(line.price).toBe(line.variant?.price ?? product.price);
      expect(line.variant).toEqual(product.variants?.find(variant => variant.id === line.variant?.id)); expect(line.bundle).toEqual(product.bundle);
      expect(line.recipe).toEqual(requirements(product, [], line.variant));
      const candidate = { product, variant: line.variant, quantity: line.quantity };
      expect(line.usage).toEqual(usageFor([candidate], remaining, businessDate(sale.time)).usage); return candidate;
    });
    const expected = usageFor(lines, remaining, businessDate(sale.time));
    expect(expected.error).toBeUndefined(); expect(sale.usage).toEqual(expected.usage); expect(sale.stockCommitted).toBe(true);
    expect(sale.total).toBe(Math.round(sale.lines.reduce((sum, line) => sum + line.price * line.quantity, 0) * 112) / 100);
    remaining = consumeStock(remaining, expected.usage, businessDate(sale.time));
  }
  for (const item of demo.stock) {
    const opening = demo.openingStock.find(stock => stock.id === item.id)!;
    const consumed = demo.sales.reduce((sum, sale) => sum + (sale.usage?.find(input => input.stockId === item.id)?.quantity ?? 0), 0);
    expect(item.quantity).toBeCloseTo(opening.quantity - consumed, 6); expect(item.quantity).toBe(remaining.find(stock => stock.id === item.id)!.quantity);
    expect(item.batches).toEqual(remaining.find(stock => stock.id === item.id)!.batches);
    if (item.batches) expect(item.batches.reduce((sum, batch) => sum + batch.quantity, 0)).toBeCloseTo(item.quantity, 6);
  }
  expect(demo.sales.some(sale => sale.lines.some(line => line.variant))).toBe(true); expect(demo.sales.some(sale => sale.lines.some(line => line.bundle))).toBe(true);
  const current = demo.sales.filter(sale => businessDate(sale.time) === businessDate());
  expect(new Set(current.map(sale => sale.cashierId)).size).toBe(5);
  expect(current.filter(sale => sale.status === 'Pending').reduce((sum, sale) => sum + sale.total, 0)).toBe(582.4);
});

for (const [width, height] of [[1440, 900], [320, 568]]) {
  test(`Inventory and POS show replacement products and working configurations at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await enter(page); await nav(page, 'Inventory');
    await page.getByRole('button', { name: 'Products', exact: true }).click(); await page.getByLabel('Inventory category').selectOption('All');
    const paging = page.getByRole('navigation', { name: 'Sellable products pagination' });
    await expect(paging).toContainText('of 21 records'); await expect(page.locator('.product-table > tbody > tr')).toHaveCount(6);
    const names: string[] = []; const labels: string[] = [];
    while (true) {
      names.push(...(await page.locator('.product-table > tbody > tr > td > .record-name > span:last-child').allTextContents()).map(name => name.replace('No POS listing', '')));
      labels.push(await page.locator('.product-table').innerText());
      if (await paging.getByRole('button', { name: 'Next' }).isDisabled()) break;
      await paging.getByRole('button', { name: 'Next' }).click();
    }
    const seed = createDemoData();
    const linked = new Set(seed.products.flatMap(product => [product.stockId, ...(product.variants?.map(variant => variant.stockId) ?? []), ...(product.bundle?.map(component => component.stockId) ?? [])]));
    expect(names).toEqual([...seed.products.map(product => product.name), ...seed.stock.filter(item => item.kind === 'Finished' && !linked.has(item.id)).map(item => item.name)]);
    expect(labels.join(' ')).toContain('Variants'); expect(labels.join(' ')).toContain('Bundle');
    await mkdir(captures, { recursive: true }); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `${captures}/inventory-${width}.png`, fullPage: true });
    for (const [id, name, mode] of [['PR-MODEL-KIT', 'Model Kit Editions', 'Variants'], ['PR-CAFE-SNACK', 'Cafe Snack Bundle', 'Bundle']]) {
      await page.getByLabel('Search inventory', { exact: true }).fill(id); await page.getByRole('button', { name: `Edit product ${name}` }).click();
      await expect(page.getByLabel('Stock model')).toHaveValue(mode); await expect(page.locator('.product-configurations fieldset')).toHaveCount(2);
      await page.getByRole('button', { name: 'Back to Inventory' }).click();
    }
    await nav(page, 'POS'); await expect(page.locator('.product-card')).toHaveCount(10);
    for (const name of oldNames) await expect(page.getByRole('button', { name: `Add ${name} to order`, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Add Model Kit Editions to order' }).click();
    await page.getByRole('button', { name: /^(Add|Update item)$/ }).click(); await expect(page.getByRole('alert')).toContainText('Choose a variant');
    await page.getByRole('radio', { name: /^Deluxe/ }).check(); await page.getByRole('button', { name: /^(Add|Update item)$/ }).click();
    await expect(page.locator('.cart-line')).toContainText('HB005'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `${captures}/pos-${width}.png`, fullPage: true });
  });
}

test('three-model checkout shares SKUs; snapshots, Owner review, Admin void and CSV retain once-only consumption', async ({ page }) => {
  await enter(page, 'Admin', 'alex'); await nav(page, 'POS'); const demo = createDemoData();
  for (const product of demo.products) {
    await page.getByRole('button', { name: `Add ${product.name} to order`, exact: true }).click();
    if (product.mode === 'Variants') await page.getByRole('radio', { name: product.category === 'Hobby' ? /^Deluxe/ : /^Large/ }).check();
    if (product.modifiers?.length) {
      await page.getByRole('checkbox', { name: /Extra cheese/ }).check(); await page.getByRole('checkbox', { name: /No onions/ }).check();
    }
    if (product.mode === 'Variants' || product.mode === 'Bundle' || product.modifiers?.length) await page.getByRole('button', { name: 'Add', exact: true }).click();
  }
  const expectedStock = consumeStock(demo.stock, usageFor(demo.products.map(product => ({ product, quantity: 1, variant: product.variants?.[1], modifiers: product.modifiers?.flatMap(group => group.options) })), demo.stock).usage);
  const total = Math.round(demo.products.reduce((sum, product) => sum + (product.variants?.[1].price ?? product.price) + (product.modifiers?.flatMap(group => group.options).reduce((sum, option) => sum + option.price, 0) ?? 0), 0) * 112) / 100;
  await cash(page); await nav(page, 'Audit Trail'); await page.locator('tbody tr').first().click();
  const order = (await page.locator('.detail-id').innerText()).replace('Order ID: ', '');
  await expect(page.locator('.sale-details')).toContainText('Status: Pending'); await expect(page.locator('.sale-details')).toContainText('Model Kit Editions — Deluxe');
  await expect(page.locator('.sale-details')).toContainText('2× Deck Sleeves');
  for (const id of ['HB009', 'HB010', 'HB005', 'BV001', 'FD010', 'IN-BUN', 'FD007']) await expect(await stockRow(page, id)).toContainText(`${expectedStock.find(item => item.id === id)!.quantity}pcs`);
  await expect(await stockRow(page, 'IN-ONION')).toContainText('440g');
  await page.getByRole('button', { name: 'Log out', exact: true }).click(); await person(page, 'Owner', 'angel');
  await page.getByRole('button', { name: 'Review daily sales', exact: true }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toContainText('5 orders awaiting Owner review');
  for (const checkbox of await dialog.getByRole('checkbox').all()) await checkbox.check();
  await page.getByLabel('Counted cash for included receipts').fill(String(414.4 + total)); await page.getByLabel('Verified GCash receipts amount').fill('168');
  await expect(page.getByLabel('Review notes / discrepancy decision')).not.toHaveAttribute('required', '');
  await page.getByRole('button', { name: 'Confirm reviewed sales', exact: true }).click();
  await expect(await stockRow(page, 'HB009')).toContainText(`${expectedStock.find(item => item.id === 'HB009')!.quantity}pcs`);
  await nav(page, 'Reports'); await page.getByLabel('From', { exact: true }).fill('2026-10-04'); await page.getByLabel('To', { exact: true }).fill('2026-10-04');
  await expect(page.getByRole('region', { name: 'Ingredient usage by transaction; scroll to see all columns' })).toContainText('Iced Caramel Latte');
  await page.getByLabel('Export format').selectOption('CSV'); await page.getByRole('button', { name: 'Export report', exact: true }).click();
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export CSV', exact: true }).click(); const download = await pending;
  const stream = await download.createReadStream(); const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString('utf8'); expect(csv).toContain('Model Kit Editions — Deluxe'); expect(csv).toContain('HB005'); expect(csv).toContain('2× Deck Sleeves');
  expect(csv).toContain(`${expectedStock.find(item => item.id === 'HB009')!.quantity} on hand`); for (const name of oldNames) expect(csv).not.toContain(name);
  await mkdir(captures, { recursive: true }); await download.saveAs(`${captures}/checkout.csv`);
  await page.getByRole('button', { name: 'Log out', exact: true }).click(); await person(page, 'Admin', 'alex'); await nav(page, 'Audit Trail');
  await page.getByLabel('Search sales', { exact: true }).fill(order); await page.locator('tbody tr').click();
  await page.getByRole('button', { name: 'VOID', exact: true }).click(); await page.getByRole('button', { name: 'Proceed', exact: true }).click(); await page.getByRole('button', { name: 'Confirm Void', exact: true }).click(); await page.getByRole('dialog', { name: 'Void this order permanently?' }).getByRole('button', { name: 'Void order', exact: true }).click();
  await expect(page.locator('.sale-details')).toContainText('Voided by Alex · Admin');
  await expect(await stockRow(page, 'HB009')).toContainText(`${expectedStock.find(item => item.id === 'HB009')!.quantity}pcs`);
});

test('each Staff sees its own replacement receipt and refresh resets the independent session', async ({ page }) => {
  await enter(page, 'Staff', 'raven');
  for (const [id, product] of [['raven', 'Mango Oat Smoothie'], ['micah', 'Deck Sleeves'], ['jestine', 'Iced Caramel Latte']]) {
    if (id !== 'raven') await person(page, 'Staff', id);
    await nav(page, 'Today’s Sales History'); await expect(page.locator('tbody tr')).toHaveCount(1); await expect(page.locator('tbody')).toContainText(product);
    await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Butter Cookie Pouch to order' }).click(); await cash(page);
    await nav(page, 'Today’s Sales History'); await expect(page.locator('tbody tr')).toHaveCount(2); await page.getByRole('button', { name: 'Log out', exact: true }).click();
  }
  await person(page, 'Staff', 'raven'); await nav(page, 'Today’s Sales History'); await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.reload(); await person(page, 'Staff', 'raven'); await nav(page, 'Today’s Sales History'); await expect(page.locator('tbody tr')).toHaveCount(1);
});

test('Hobby editor excludes recipes and switching from a food recipe selects a valid retail model', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory'); await page.getByRole('button', { name: 'Products', exact: true }).click();
  await page.getByLabel('Inventory category').selectOption('All'); await page.getByLabel('Search inventory', { exact: true }).fill('PR-BEEF-SLIDERS');
  await page.getByRole('button', { name: 'Edit product Grilled Beef Sliders' }).click();
  const model = page.getByLabel('Stock model');
  await expect(model.locator('option')).toHaveCount(4); await expect(model).toHaveValue('Made to order');
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Hobby');
  await expect(model.locator('option')).toHaveText(['Retail Item', 'Variants', 'Bundle']);
  await expect(model).toHaveValue('Stocked'); await expect(page.locator('.recipe-editor h3').filter({ hasText: /^Recipe$/ })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Food'); await model.selectOption('Made to order');
  await expect(page.locator('.recipe-editor').first().locator('.recipe-input')).toHaveCount(3);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.getByRole('button', { name: 'Discard changes' }).click();
});
