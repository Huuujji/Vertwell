import { test, expect, type Page } from './fixtures/legacy-preview';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { businessDate, createDemoData } from './fixtures/legacy-demo';
import { consumeStock, convert, requirements, stockKind, usageFor, usableQuantity } from '../src/data/inventory';
import { stockCondition } from '../src/data/reporting';

const captures = fileURLToPath(new URL('../../../.review/frontend/legacy-mock-data/', import.meta.url));
async function nav(page: Page, name: string) {
  if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
}
async function person(page: Page, role: string, id: string) {
  await page.getByLabel('Preview role', { exact: true }).selectOption(role);
  await page.getByLabel('Preview person', { exact: true }).selectOption(id);
  await page.getByRole('button', { name: 'Open preview', exact: true }).click();
}
async function cash(page: Page) {
  await page.getByRole('button', { name: 'Pay', exact: true }).click();
  await page.getByRole('button', { name: 'CASH PAYMENT', exact: true }).click();
  await page.getByLabel('Amount Given:', { exact: true }).fill('10000');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
}
async function inventory(page: Page, id: string) {
  await nav(page, 'Inventory');
  await page.getByRole('button', { name: 'All inventory', exact: true }).click();
  await page.getByLabel('Inventory category', { exact: true }).selectOption('All');
  await page.getByLabel('Search inventory', { exact: true }).fill(id);
  return page.locator(`[id="usable-stock-${id}"], [id="stock-${id}"]`).filter({ has: page.locator("td") }).last();
}

test('all seed receipts reconcile actor, product, VAT, usage, batches and remaining stock', () => {
  const demo = createDemoData();
  expect(demo.accounts.map(account => account.role).sort()).toEqual(['Admin', 'Owner', 'Staff', 'Staff', 'Staff']);
  for (const key of ['id', 'name', 'username', 'email'] as const) expect(new Set(demo.accounts.map(account => account[key])).size).toBe(5);
  let remaining = structuredClone(demo.openingStock);
  for (const sale of [...demo.sales].sort((a, b) => a.time.localeCompare(b.time))) {
    const actor = demo.accounts.find(account => account.id === sale.cashierId)!;
    expect([sale.cashier, sale.cashierRole]).toEqual([actor.name, actor.role]);
    const lines = sale.lines.map(line => {
      const product = demo.products.find(product => product.name === line.name)!;
      expect(line.category).toBe(product.category);
      const modifiers = product.modifiers?.flatMap(group => group.options).filter(option => line.modifiers?.some(value => value.id === option.id)) ?? [];
      expect(line.price).toBe(product.price + modifiers.reduce((sum, option) => sum + option.price, 0));
      const result = usageFor([{ product, quantity: line.quantity, modifiers }], remaining, businessDate(sale.time));
      expect(result.error).toBeUndefined(); expect(line.usage).toEqual(result.usage);
      expect(line.recipe).toEqual(requirements(product, modifiers));
      return { product, quantity: line.quantity, modifiers };
    });
    const expected = usageFor(lines, remaining, businessDate(sale.time));
    expect(sale.usage).toEqual(expected.usage); expect(sale.stockCommitted).toBe(true); expect(sale.usageComplete).toBe(true);
    expect(sale.total).toBe(Math.round(sale.lines.reduce((sum, line) => sum + line.price * line.quantity, 0) * 1.12 * 100) / 100);
    if (sale.reference) expect(sale.reference).toMatch(/^\d{13}$/);
    if (sale.dailyReview) {
      expect(sale.dailyReview.owner).toBe('Angel'); expect(sale.dailyReview.orderIds).toContain(sale.id);
      expect(new Date(sale.dailyReview.time).getTime()).toBeGreaterThan(new Date(sale.time).getTime());
    }
    remaining = consumeStock(remaining, expected.usage, businessDate(sale.time));
  }
  for (const item of demo.stock) {
    const expected = remaining.find(value => value.id === item.id)!;
    const opening = demo.openingStock.find(value => value.id === item.id)!;
    const consumed = demo.sales.reduce((sum, sale) => sum + (sale.usage?.find(input => input.stockId === item.id)?.quantity ?? 0), 0);
    expect(item.quantity).toBeCloseTo(opening.quantity - consumed, 6);
    expect(item.quantity).toBe(expected.quantity); expect(item.batches).toEqual(expected.batches);
    expect(item.quantity).toBeGreaterThanOrEqual(0); expect(item.threshold).toBeGreaterThanOrEqual(0); expect(item.sku).toBe(item.id);
    for (const receipt of item.batches ?? [item]) {
      expect(receipt.manufactured <= businessDate()).toBe(true);
      if (receipt.expires) expect(receipt.manufactured <= receipt.expires).toBe(true);
    }
    if (item.batches) expect(item.batches.reduce((sum, batch) => sum + batch.quantity, 0)).toBeCloseTo(item.quantity, 6);
  }
  expect(demo.stock.find(item => item.id === 'FD001')?.batches?.map(batch => batch.quantity)).toEqual([6, 12]);
  expect(demo.stock.find(item => item.id === 'PT002')?.batches?.map(batch => batch.quantity)).toEqual([12, 20]);
  const current = demo.sales.filter(sale => businessDate(sale.time) === businessDate());
  expect(new Set(current.map(sale => sale.cashierId)).size).toBe(5);
  expect(current.filter(sale => sale.status === 'Pending')).toHaveLength(4);
  expect(current.filter(sale => sale.status === 'Completed')).toHaveLength(1);
  expect(current.find(sale => sale.cashierRole === 'Owner')?.reviewState).toBe('Owner checkout');
  expect(new Set(demo.sales.map(sale => sale.reference).filter(Boolean)).size).toBe(2);
});

test('every sellable seed and modifier has compatible linked stock and ordinary checkout availability', () => {
  const demo = createDemoData();
  expect(new Set(demo.products.map(product => product.id)).size).toBe(demo.products.length);
  expect(new Set(demo.stock.map(item => item.sku)).size).toBe(demo.stock.length);
  for (const product of demo.products) {
    expect(product.mode).toBeTruthy();
    const options = product.modifiers?.flatMap(group => group.options) ?? [];
    for (const input of [...requirements(product), ...options.flatMap(option => option.inputs)]) {
      const stock = demo.stock.find(item => item.id === input.stockId)!;
      expect(stock).toBeTruthy(); expect(Number.isFinite(convert(input.quantity, input.unit, stock.unit))).toBe(true);
      if (product.mode === 'Made to order') expect(stockKind(stock)).toBe('Ingredient');
      if (product.category === 'Hobby') expect(stockKind(stock)).toBe('Finished');
    }
    expect(usageFor([{ product, quantity: 1 }], demo.stock).error).toBeUndefined();
    for (const modifier of options) expect(usageFor([{ product, quantity: 1, modifiers: [modifier] }], demo.stock).error).toBeUndefined();
  }
  expect(demo.stock.some(item => stockCondition(item) === 'Low Stock')).toBe(true);
  expect(demo.stock.some(item => stockCondition(item) === 'Expiring Soon')).toBe(true);
  expect(demo.stock.some(item => usableQuantity(item) < item.quantity)).toBe(true);
  // Factory calls neither mutate a running session nor share nested fixture arrays.
  const fresh = createDemoData();
  fresh.stock[0].quantity = 0; fresh.products[0].recipe![0].quantity = 99; fresh.accounts[0].name = 'Changed';
  expect(demo.stock[0].quantity).toBe(20); expect(demo.products[0].recipe![0].quantity).toBe(4); expect(demo.accounts[0].name).toBe('Angel');
});

test('all five people enter their own workspace; Staff histories isolate seeds and new receipts across role changes', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-03T17:00:00Z')); await page.goto('/');
  await mkdir(captures, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Preview role').selectOption('Staff');
  await expect(page.getByLabel('Preview person').locator('option')).toHaveText(['Raven (@raven)', 'Micah (@micah)', 'Jestine (@jestine)']);
  await page.screenshot({ path: `${captures}/preview-people-phone.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [id, product] of [['raven', 'Iced Matcha Latte'], ['micah', 'Card Pack'], ['jestine', 'Mango Matcha Latte']]) {
    await person(page, 'Staff', id); await nav(page, 'Today’s Sales History');
    await expect(page.locator('tbody tr')).toHaveCount(1); await expect(page.locator('tbody')).toContainText(product);
    await expect(page.locator('tbody tr')).toContainText(id[0].toUpperCase() + id.slice(1));
    await expect(page.locator('.staff-daily-summary strong')).toHaveText(['1', '1', '0']);
    await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Matcha Cookie Pack to order' }).click(); await cash(page);
    await nav(page, 'Today’s Sales History'); await expect(page.locator('tbody tr')).toHaveCount(2);
    await expect(page.locator('tbody tr').first()).toContainText('Matcha Cookie Pack');
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
  }
  await person(page, 'Owner', 'angel'); await nav(page, 'Users'); await expect(page.locator('.user-row')).toHaveCount(5);
  await expect(page.getByRole('group', { name: 'Angel account' })).toContainText('You');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await person(page, 'Admin', 'alex'); await nav(page, 'Users'); await expect(page.getByRole('group', { name: 'Alex account' })).toContainText('You');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await person(page, 'Staff', 'raven'); await nav(page, 'Today’s Sales History');
  await expect(page.locator('tbody tr')).toHaveCount(2); await expect(page.locator('tbody')).not.toContainText('Micah'); await expect(page.locator('tbody')).not.toContainText('Jestine');
  await page.reload(); await person(page, 'Staff', 'raven'); await nav(page, 'Today’s Sales History'); await expect(page.locator('tbody tr')).toHaveCount(1);
});

test('linked catalogue checkout, Owner receipt review, named Admin void and CSV agree on once-only consumption', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-03T17:00:00Z')); await page.goto('/'); await person(page, 'Admin', 'alex');
  await nav(page, 'POS'); await expect(page.locator('.product-grid')).not.toContainText('Sample stock not linked');
  for (const product of createDemoData().products) {
    await page.getByRole('button', { name: `Add ${product.name} to order`, exact: true }).click();
    if (product.id === 'BURGER') {
      await page.getByRole('checkbox', { name: /Extra cheese/ }).check(); await page.getByRole('checkbox', { name: /No onions/ }).check();
      await page.getByRole('button', { name: /^(Add|Update item)$/, exact: true }).click();
    }
  }
  await cash(page); await nav(page, 'Audit Trail'); await page.locator('tbody tr').first().click();
  const order = await page.locator('.detail-id').innerText();
  await expect(page.locator('.sale-details')).toContainText('Status: Pending'); await expect(page.locator('.sale-details')).toContainText('Extra cheese');
  await expect(await inventory(page, 'IN-BUN')).toContainText('19pcs'); await expect(await inventory(page, 'FD007')).toContainText('39pcs'); await expect(await inventory(page, 'IN-ONION')).toContainText('500g');
  await expect(await inventory(page, 'FD001')).toContainText('17pcs'); await expect(await inventory(page, 'HB001')).toContainText('44pcs');
  await page.getByRole('button', { name: 'Log out', exact: true }).click(); await person(page, 'Owner', 'angel');
  await page.getByRole('button', { name: 'Review daily sales', exact: true }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toContainText('5 orders awaiting Owner review');
  for (const checkbox of await dialog.getByRole('checkbox').all()) await checkbox.check();
  await page.getByLabel('Counted cash for included receipts').fill('3399.20'); await page.getByLabel('Verified GCash receipts amount').fill('168');
  await expect(page.getByLabel('Review notes / discrepancy decision')).not.toHaveAttribute('required', ''); await page.getByRole('button', { name: 'Confirm reviewed sales', exact: true }).click();
  await expect(await inventory(page, 'IN-BUN')).toContainText('19pcs');
  await nav(page, 'Reports'); await page.getByLabel('From', { exact: true }).fill('2026-10-04'); await page.getByLabel('To', { exact: true }).fill('2026-10-04');
  const ingredient = page.getByRole('region', { name: 'Ingredient usage by transaction; scroll to see all columns' });
  await expect(ingredient).toContainText('Mango Matcha Latte'); await expect(ingredient).toContainText('Matcha');
  await page.getByLabel('Export format').selectOption('CSV'); await page.getByRole('button', { name: 'Export report', exact: true }).click();
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export', exact: true }).click(); const download = await pending;
  const stream = await download.createReadStream(); const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString('utf8');
  expect(csv).toContain('Stocks used in the selected period'); expect(csv).toContain('Mango puree'); expect(csv).toContain('19 on hand'); expect(csv).toContain('39 on hand'); expect(csv).toContain('0 orders');
  await mkdir(captures, { recursive: true }); await download.saveAs(`${captures}/linked-checkout.csv`);
  await page.getByRole('button', { name: 'Log out', exact: true }).click(); await person(page, 'Admin', 'alex'); await nav(page, 'Audit Trail');
  await page.getByLabel('Search sales', { exact: true }).fill(order.replace('Order ID: ', '')); await page.locator('tbody tr').click();
  await page.getByRole('button', { name: 'VOID', exact: true }).click(); await page.getByRole('button', { name: 'Proceed', exact: true }).click(); await page.getByRole('button', { name: 'Confirm Void', exact: true }).click(); await page.getByRole('dialog', { name: 'Void this order permanently?' }).getByRole('button', { name: 'Void order', exact: true }).click();
  await expect(page.locator('.sale-details')).toContainText('Voided by Alex · Admin'); await expect(page.locator('.sale-details')).toContainText('Angel · Owner');
  await expect(await inventory(page, 'IN-BUN')).toContainText('19pcs'); await expect(await inventory(page, 'FD001')).toContainText('17pcs');
});
