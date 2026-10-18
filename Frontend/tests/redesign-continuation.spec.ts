import { chooseSearch } from './fixtures/search-select';
import { saveRecord } from './fixtures/save-record';
import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { businessDate, createDemoData } from '../src/data/demo';
import type { Sale, StockItem } from '../src/data/demo';
import { consumeStock, convert, removalQuantity, removeUnusableStock, usageFor, usableQuantity, validateStockUsage } from '../src/data/inventory';
import { openingMovements, periodBalance } from '../src/data/stock-movements';
import { stockCondition } from '../src/data/reporting';

const review = fileURLToPath(new URL('../../../.review/frontend/october-15/regression-pdfs/', import.meta.url));
async function nav(page: Page, name: string) {
  if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
}
async function person(page: Page, role = 'Owner', id = 'angel') {
  await page.getByLabel('Preview role').selectOption(role); await page.getByLabel('Preview person').selectOption(id);
  await page.getByRole('button', { name: 'Open preview', exact: true }).click();
}
async function enter(page: Page, role = 'Owner', id = 'angel') {
  await page.clock.setFixedTime(new Date('2026-10-04T17:00:00Z')); await page.goto('/'); await person(page, role, id);
}
async function stockSearch(page: Page, search: string) {
  await nav(page, 'Inventory'); await page.getByRole('button', { name: 'All inventory', exact: true }).click();
  await page.getByLabel('Inventory category').selectOption('All'); await page.getByLabel('Search inventory', { exact: true }).fill(search);
}
async function cash(page: Page) {
  await page.getByRole('button', { name: 'Pay', exact: true }).click(); await page.getByRole('button', { name: 'CASH PAYMENT', exact: true }).click();
  await page.getByLabel('Amount Given:', { exact: true }).fill('10000'); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
}
async function switchPerson(page: Page, role: string, id: string) {
  if (page.viewportSize()!.width < 1200) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click(); await person(page, role, id);
}

test('every current ingredient ledger reconciles seed consumption and unit conversions independently', () => {
  const demo = createDemoData(), movements = openingMovements(demo.openingStock), today = businessDate();
  for (const item of demo.stock.filter(item => item.kind === 'Ingredient')) {
    const opening = demo.openingStock.find(value => value.id === item.id)!;
    const used = demo.sales.reduce((sum, sale) => sum + (sale.usage ?? []).filter(input => input.stockId === item.id).reduce((sum, input) => sum + convert(input.quantity, input.unit, item.unit), 0), 0);
    const balance = periodBalance(item, demo.sales, movements, '2026-08-01', today)!;
    expect(balance).toBeDefined(); expect(balance.opening).toBe(opening.quantity); expect(balance.used).toBeCloseTo(used, 6);
    expect(balance.remaining).toBe(item.quantity); expect(balance.remainingPercent).toBeCloseTo(item.quantity / opening.quantity * 100, 6);
    if (item.unit === 'g' || item.unit === 'L') {
      const unit = item.unit === 'g' ? 'kg' : 'ml';
      const changed = { ...item, unit, quantity: convert(item.quantity, item.unit, unit) };
      const converted = periodBalance(changed, demo.sales, movements, '2026-08-01', today)!;
      expect(converted.remainingPercent).toBeCloseTo(balance.remainingPercent, 6); expect(converted.remaining).toBe(changed.quantity);
    }
  }
});

test('period percentages track receipts, removals, Pending and Voided consumption without a second review deduction', () => {
  const item: StockItem = { id: 'x', name: 'Milk', category: 'Beverage', kind: 'Ingredient', quantity: 1.3, unit: 'L', threshold: 0, manufactured: '', expires: '', status: 'In Stock' };
  const movements = [
    { id: 'o', stockId: 'x', date: '2026-08-01', kind: 'Opening' as const, quantity: 1000, unit: 'ml' },
    { id: 'r', stockId: 'x', date: '2026-08-03', kind: 'Receipt' as const, quantity: 1, unit: 'L' },
    { id: 'd', stockId: 'x', date: '2026-08-04', kind: 'Removal' as const, quantity: -200, unit: 'ml' },
  ];
  const sale = (date: string, quantity: number, status: Sale['status']): Sale => ({ id: date, time: date + 'T12:00:00+08:00', cashier: 'Alex', status, method: 'Cash', total: 10, lines: [], stockCommitted: true, usageComplete: true, usage: [{ stockId: 'x', name: 'Milk', quantity, unit: 'ml' }] });
  const sales = [sale('2026-08-02', 200, 'Pending'), sale('2026-08-04', 300, 'Voided')];
  const first = periodBalance(item, sales, movements, '2026-08-01', '2026-08-02')!;
  expect(first).toMatchObject({ opening: 1, added: 0, used: .2, remaining: .8, remainingPercent: 80 });
  const second = periodBalance(item, sales, movements, '2026-08-03', '2026-08-04')!;
  expect(second).toMatchObject({ opening: .8, added: 1, used: .3, removed: .2, remaining: 1.3 });
  expect(second.remainingPercent).toBeCloseTo(1.3 / 1.8 * 100);
  expect(periodBalance(item, sales.map(value => ({ ...value, status: 'Completed' })), movements, '2026-08-03', '2026-08-04')).toEqual(second);
  for (const bad of [
    [...movements, { ...movements[0], id: 'duplicate' }],
    movements.map(value => value.kind === 'Receipt' ? { ...value, unit: 'g' } : value),
    movements.map(value => value.kind === 'Receipt' ? { ...value, quantity: -1 } : value),
    movements.map(value => value.kind === 'Removal' ? { ...value, date: '2026-02-30' } : value),
  ]) expect(periodBalance(item, sales, bad, '2026-08-01', '2026-08-04')).toBeUndefined();
  expect(periodBalance(item, sales, movements, '2026-07-31', '2026-08-04')).toMatchObject({ coverageStart: '2026-08-01', partial: true, remaining: 1.3 });
  expect(periodBalance(item, sales, movements, '2026-08-04', '2026-08-01')).toBeUndefined();
  expect(periodBalance(item, sales, movements, '2026-08-01', '2099-01-01')).toBeUndefined();
  expect(periodBalance({ ...item, quantity: 8 }, sales, movements, '2026-08-01', '2026-08-04')).toBeUndefined();
  expect(periodBalance(item, [{ ...sales[0], usage: undefined }, sales[1]], movements, '2026-08-01', '2026-08-04')).toBeUndefined();
  expect(periodBalance(item, [{ ...sales[0], usageComplete: false }, sales[1]], movements, '2026-08-01', '2026-08-04')).toBeUndefined();
  expect(periodBalance(item, [{ ...sales[0], time: 'invalid timestamp' }, sales[1]], movements, '2026-08-01', '2026-08-04')).toBeUndefined();
});

test('payment stock guard rejects incompatible, duplicate overdraw, nonfinite and invalid stock quantities', () => {
  const demo = createDemoData(), item = demo.stock.find(item => item.id === 'FD001')!, available = usableQuantity(item);
  const input = { stockId: item.id, name: item.name, unit: 'pcs', quantity: available };
  expect(validateStockUsage([input], demo.stock).error).toBeUndefined();
  for (const inputs of [[input, { ...input, quantity: 1 }], [{ ...input, unit: 'g' }], [{ ...input, quantity: NaN }], [{ ...input, quantity: Infinity }], [{ ...input, quantity: -1 }], [{ ...input, stockId: 'missing' }]]) {
    expect(validateStockUsage(inputs, demo.stock).error).toBeTruthy();
  }
  const product = demo.products.find(product => product.stockId === 'FD001')!;
  for (const quantity of [0, -1, .5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, 100]) expect(usageFor([{ product, quantity }], demo.stock).error).toBeTruthy();
  expect(usageFor([{ product, quantity: 1 }], [{ ...item, quantity: NaN }]).error).toBeTruthy();
});

test('unsellable and expired batches stay excluded; removal preserves usable stock and urgency', () => {
  const demo = createDemoData(), original = demo.stock.find(item => item.id === 'FD001')!;
  const item = { ...original, quantity: 20, threshold: 2, batches: [
    { id: 'expired', quantity: 10, manufactured: '', expires: '2000-01-01', status: 'Expired' },
    { id: 'unsellable', quantity: 7, manufactured: '', expires: '2099-01-01', status: 'Unsellable' },
    { id: 'fresh', quantity: 3, manufactured: '', expires: '2099-01-01', status: 'Fresh' },
  ] };
  expect(usableQuantity(item)).toBe(3); expect(removalQuantity(item)).toBe(17); expect(stockCondition(item)).toBe('Contains unsellable stock');
  expect(stockCondition({ ...item, threshold: 5 })).toBe('Low Stock');
  expect(stockCondition({ ...item, status: 'Unsellable' })).toBe('Unsellable');
  expect(stockCondition({ ...item, quantity: 7, batches: [item.batches[1]] })).toBe('Unsellable');
  const removed = removeUnusableStock(item); expect(removed.quantity).toBe(3); expect(removed.batches?.map(batch => batch.quantity)).toEqual([0, 0, 3]);
  expect(consumeStock([item], [{ stockId: item.id, name: item.name, quantity: 2, unit: 'pcs' }])[0].batches?.map(batch => batch.quantity)).toEqual([10, 7, 1]);
});

test('10 physical cookies reject 100 and permit only the four usable pieces; removing expired stock retains the cap', async ({ page }) => {
  await enter(page); await stockSearch(page, 'FD001');
  await page.getByRole('region', { name: 'Needed to Remove Stocks; scroll to see all columns', exact: true }).getByRole('button', { name: 'Edit Butter Cookie Pouch', exact: true }).click();
  await chooseSearch(page.getByLabel('Receipt batch to edit'), 'butter-cookie-2');
  await page.getByLabel('Quantity', { exact: true }).fill('4'); await saveRecord(page);
  await expect(page.locator('#stock-FD001')).toContainText('4 pcs usable');
  await nav(page, 'POS'); const card = page.getByRole('button', { name: 'Add Butter Cookie Pouch to order', exact: true });
  await card.click(); for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Add one Butter Cookie Pouch' }).click();
  await expect(page.getByLabel('Butter Cookie Pouch quantity', { exact: true })).toHaveText('4');
  await expect(card).toBeDisabled(); await expect(page.getByRole('button', { name: 'Add one Butter Cookie Pouch' })).toBeDisabled();
  await cash(page); await stockSearch(page, 'FD001'); await expect(page.locator('#stock-FD001')).toContainText('0 pcs usable');
  await page.getByRole('button', { name: 'Remove unusable stock from Butter Cookie Pouch' }).click();
  await page.getByRole('button', { name: 'Confirm removal' }).click(); await expect(page.locator('#stock-FD001')).toContainText('0pcs');
  await nav(page, 'POS'); await expect(card).toBeDisabled();
});

test('shared-SKU variant and bundle customization rejects 100 and respects other cart lines', async ({ page }) => {
  await enter(page); await stockSearch(page, 'FD010'); await page.getByRole('button', { name: 'Edit Cookie Box (Small)', exact: true }).click();
  await page.getByLabel('Quantity', { exact: true }).fill('2'); await saveRecord(page);
  await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Cookie Box Sizes to order' }).click();
  await page.getByRole('radio', { name: /^Small/ }).check(); await page.getByLabel('Quantity', { exact: true }).fill('100');
  await page.getByRole('button', { name: /^(Add|Update item)$/ }).click(); await expect(page.getByRole('alert')).toContainText('Not enough usable');
  await page.getByLabel('Quantity', { exact: true }).fill('1'); await page.getByRole('button', { name: /^(Add|Update item)$/ }).click();
  await page.getByRole('button', { name: 'Add Cafe Snack Bundle to order' }).click(); await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add one Cookie Box Sizes — Small' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Add one Cafe Snack Bundle' })).toBeDisabled(); await cash(page);
  await stockSearch(page, 'FD010'); await expect(page.locator('#stock-FD010')).toContainText('0pcs');
});

test('typed 100-cookie customization is refused after correcting physical stock to 10', async ({ page }) => {
  await enter(page); await stockSearch(page, 'PR-BUTTER-COOKIE');
  await page.getByRole('button', { name: 'Edit product Butter Cookie Pouch', exact: true }).click();
  await chooseSearch(page.getByLabel('Receipt batch to edit'), 'butter-cookie-2');
  await page.getByLabel('Quantity', { exact: true }).fill('4');
  // Configure an optional choice through the actual editor to exercise bulk entry.
  await page.getByRole('button', { name: 'Add modifier group', exact: true }).click();
  await page.getByLabel('Group name', { exact: true }).fill('Packaging');
  await page.getByRole('button', { name: 'Add option', exact: true }).click();
  await page.getByLabel('Option name', { exact: true }).fill('Gift wrap');
  await saveRecord(page);
  await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Butter Cookie Pouch to order', exact: true }).click();
  await page.getByLabel('Quantity', { exact: true }).fill('100');
  await page.getByRole('button', { name: /^(Add|Update item)$/ }).click();
  await expect(page.getByRole('alert')).toContainText('4 pcs available; 100 needed');
  await expect(page.getByRole('button', { name: 'Pay', exact: true })).toBeDisabled();
  await page.getByLabel('Quantity', { exact: true }).fill('4');
  await expect(page.getByRole('button', { name: 'Increase customization quantity' })).toBeDisabled();
  await page.getByRole('button', { name: /^(Add|Update item)$/ }).click(); await cash(page);
  await stockSearch(page, 'FD001'); await expect(page.locator('#stock-FD001')).toContainText('0 pcs usable');
});

for (const [fault, expression] of [
  ['incompatible units', "check.usage.map(input => ({ ...input, unit: 'g' }))"],
  ['duplicate overdraw', "[...check.usage, ...check.usage.map(input => ({ ...input, quantity: 12 }))]"],
  ['nonfinite quantity', "check.usage.map(input => ({ ...input, quantity: Infinity }))"],
] as const) test(`actual final-payment boundary refuses ${fault} without recording or consuming stock`, async ({ page }) => {
  // Fault injection only changes the outgoing checkout payload, after POS checks.
  await page.route('**/src/pages/Pos.tsx*', async route => {
    const response = await route.fetch(), body = await response.text();
    const patched = body.replace('usage: check.usage,', `usage: ${expression},`);
    expect(patched).not.toBe(body); await route.fulfill({ response, body: patched });
  });
  await enter(page); await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Butter Cookie Pouch to order', exact: true }).click();
  await cash(page); await expect(page.getByRole('alert')).toContainText('Payment could not be recorded');
  await page.keyboard.press('Escape'); await stockSearch(page, 'FD001');
  await expect(page.locator('#stock-FD001')).toContainText('12 pcs usable');
  await nav(page, 'Audit Trail'); await page.getByLabel('Filter sales by date', { exact: true }).fill('2026-10-05');
  await expect(page.locator('.history-table tbody tr')).toHaveCount(5);
});

test('retained carts recheck corrected stock, unavailable and removed products before checkout', async ({ page }) => {
  await enter(page); await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Deck Sleeves to order' }).click();
  await stockSearch(page, 'HB009'); await page.getByRole('button', { name: 'Edit product Deck Sleeves', exact: true }).click();
  await page.getByLabel('Quantity', { exact: true }).fill('0'); await saveRecord(page);
  await nav(page, 'POS'); await page.getByRole('button', { name: 'Pay', exact: true }).click(); await expect(page.locator('.toast')).toContainText('Not enough usable'); await expect(page.locator('dialog[open]')).toHaveCount(0);
  await stockSearch(page, 'PR-DECK-SLEEVES'); await page.getByRole('button', { name: 'Edit product Deck Sleeves', exact: true }).click();
  await page.getByRole('combobox', { name: 'Availability', exact: true }).selectOption('no'); await saveRecord(page);
  await nav(page, 'POS'); await page.getByRole('button', { name: 'Pay', exact: true }).click(); await expect(page.locator('.toast')).toContainText('now unavailable');
  await stockSearch(page, 'PR-DECK-SLEEVES'); await page.getByRole('button', { name: 'Remove product Deck Sleeves', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm removal' }).click(); await nav(page, 'POS');
  await page.getByRole('button', { name: 'Pay', exact: true }).click(); await expect(page.locator('.toast')).toContainText('was removed'); await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
});

test('ingredient deletion blocks live recipe dependencies; removal leaves historical snapshots accessible', async ({ page }) => {
  await enter(page); await stockSearch(page, 'IN-ONION'); await page.getByRole('button', { name: 'Remove Onions record', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Grilled Beef Sliders'); await expect(page.getByRole('button', { name: 'Confirm removal' })).toBeDisabled();
  await page.getByRole('button', { name: 'Keep record' }).click(); await stockSearch(page, 'PR-BEEF-SLIDERS');
  await page.getByRole('button', { name: 'Remove product Grilled Beef Sliders' }).click(); await page.getByRole('button', { name: 'Confirm removal' }).click();
  await stockSearch(page, 'IN-ONION'); await page.getByRole('button', { name: 'Remove Onions record' }).click(); await page.getByRole('button', { name: 'Confirm removal' }).click();
  await expect(page.locator('#stock-IN-ONION')).toHaveCount(0); await nav(page, 'Audit Trail');
  await page.getByLabel('Filter sales by date', { exact: true }).fill('2026-08-20'); await page.getByLabel('Search sales', { exact: true }).fill('Grilled Beef Sliders');
  await page.locator('.history-table tbody tr').first().click(); await expect(page.locator('.sale-details')).toContainText('Onions');
});

test('all requests includes daily review and voids; Admin reads, Owner confirms, Staff stays isolated', async ({ page }) => {
  await enter(page, 'Staff', 'raven'); await nav(page, 'Today’s Sales History'); await page.locator('.history-table tbody tr').first().click();
  await page.getByRole('button', { name: 'Request Void', exact: true }).click(); await page.getByRole('button', { name: 'Proceed', exact: true }).click();
  await expect(page.locator('.sale-details')).toContainText('Requested by');
  await expect(page.locator('main')).not.toContainText('Manila');
  await expect(page.getByRole('region', { name: 'Daily Sales Review queue' })).toHaveCount(0);
  await switchPerson(page, 'Admin', 'alex'); await page.getByRole('button', { name: 'View all requests' }).click();
  await expect(page.getByRole('button', { name: 'All review requests' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Daily Sales Review queue' })).toContainText('4 awaiting Owner review');
  await expect(page.locator('.history-table tbody tr')).toHaveCount(4); await expect(page.locator('.history-table')).toContainText('Void requested');
  await page.getByRole('button', { name: 'Review daily sales' }).click(); await expect(page.getByRole('dialog')).toContainText('Only the Owner');
  await expect(page.getByRole('button', { name: 'Confirm reviewed sales' })).toHaveCount(0); await page.keyboard.press('Escape');
  await switchPerson(page, 'Owner', 'angel'); await page.getByRole('button', { name: 'View all requests' }).click(); await page.getByRole('button', { name: 'Review daily sales' }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('Counted cash for included receipts').fill('414.40'); await dialog.getByLabel('Verified GCash receipts amount').fill('168');
  await expect(dialog).not.toContainText('Manila');
  for (const checkbox of await dialog.getByRole('checkbox').all()) await checkbox.check();
  await dialog.getByRole('button', { name: 'Confirm reviewed sales' }).click(); await expect(page.locator('.history-table tbody tr')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Daily Sales Review queue' })).toContainText('No sales awaiting');
  await page.locator('.history-table tbody tr').first().click();
  await expect(page.locator('.sale-details')).toContainText('Daily Sales Review:');
  await expect(page.locator('main')).not.toContainText('Manila');
  await stockSearch(page, 'FD001'); await expect(page.locator('#stock-FD001')).toContainText('12 pcs usable');
});

test('actual recipe purchases change period bars; date bounds reject typed future dates and calendar navigation', async ({ page }) => {
  await enter(page); await nav(page, 'Reports'); await page.getByLabel('Report scope').selectOption('Inventory usage');
  await page.getByLabel('To', { exact: true }).fill('2026-10-05'); await page.getByLabel('From', { exact: true }).fill('2026-10-05');
  const balance = page.locator('.ingredient-balances article').filter({ hasText: 'Espresso beans' });
  const before = await balance.locator('.balance-heading > span').textContent();
  await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Iced Caramel Latte to order' }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Add one Iced Caramel Latte' }).click(); await cash(page); await nav(page, 'Reports');
  await expect(balance.locator('.balance-heading > span')).not.toHaveText(before!); await expect(balance).toContainText('0.108 kg');
  await page.getByLabel('From', { exact: true }).fill('2026-10-04'); await page.getByLabel('To', { exact: true }).fill('2026-10-04');
  await expect(balance).toContainText('100% remaining');
  await page.getByLabel('To', { exact: true }).fill('2099-01-01'); await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Export report' })).toBeDisabled(); await expect(page.getByRole('alert')).toContainText('valid past or current');
  await page.getByRole('button', { name: 'Open to calendar' }).click(); const calendar = page.getByRole('dialog', { name: 'To calendar', exact: true });
  await expect(calendar.getByRole('button', { name: 'Next month' })).toBeDisabled(); await expect(calendar.locator('[data-date="2026-10-06"]')).toBeDisabled();
  await calendar.getByRole('button', { name: 'Today', exact: true }).click(); await expect(page.getByLabel('To', { exact: true })).toHaveValue('2026-10-05');
  await page.getByLabel('From', { exact: true }).fill('2026-07-31'); await expect(balance).toContainText('Partial history');
});

test('Browser PDF viewer and export share identical bytes across all scopes and export all records', async ({ page }) => {
  test.setTimeout(60000); await enter(page); await nav(page, 'Reports'); await mkdir(review, { recursive: true });
  await page.getByLabel('To', { exact: true }).fill('2026-10-05'); await page.getByLabel('From', { exact: true }).fill('2026-08-01');
  await page.evaluate(() => { const original = URL.createObjectURL; URL.createObjectURL = function(blob) { const result = original.call(URL, blob); if (blob instanceof Blob && blob.type === 'application/pdf') (window as unknown as { printedPdf: string }).printedPdf = result; return result; }; });
  for (const scope of ['Combined', 'Sales', 'Inventory usage']) {
    await page.getByLabel('Report scope').selectOption(scope);
    await page.evaluate(() => { (window as unknown as { printedPdf?: string }).printedPdf = undefined; });
    const popupPending = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Print', exact: true }).click(); const viewer = await popupPending;
    await expect.poll(() => page.evaluate(() => (window as unknown as { printedPdf?: string }).printedPdf)).toBeTruthy(); await expect(page.getByRole('dialog')).toHaveCount(0);
    const source = await page.evaluate(() => (window as unknown as { printedPdf: string }).printedPdf);
    const bytes = await page.evaluate(async url => Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())), source);
    const path = review + '/' + scope.toLowerCase().replaceAll(' ', '-') + '.pdf';
    await viewer.close(); await page.getByRole('button', { name: 'Export report', exact: true }).click();
    const pendingExport = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download PDF', exact: true }).click(); const exportDownload = await pendingExport; await exportDownload.saveAs(path);
    const stream = await exportDownload.createReadStream(), chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(Buffer.from(bytes)); expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-');
    await page.getByLabel('Export format').selectOption('CSV'); await page.getByRole('button', { name: 'Export report', exact: true }).click();
    const pendingCsv = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export CSV', exact: true }).click(); const csvDownload = await pendingCsv;
    await csvDownload.saveAs(path.replace('.pdf', '.csv')); const csv = await readFile(path.replace('.pdf', '.csv'), 'utf8');
    if (scope !== 'Inventory usage') {
      const sales = await page.evaluate(async () => (await import('/src/data/demo.ts')).createDemoData().sales);
      for (const sale of sales) expect(csv).toContain(sale.id);
    }
    if (scope !== 'Sales') for (const item of createDemoData().stock) expect(csv).toContain(item.sku ?? item.id);
    await page.getByLabel('Export format').selectOption('PDF');
  }
});
