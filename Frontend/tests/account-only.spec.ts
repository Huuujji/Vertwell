import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { managementServer } from './fixtures/management-server';
import { checkoutAs, checkoutFixture, checkoutValue } from '../../backend/scripts/checkout-checks';

test.describe.configure({ mode: 'serial', timeout: 60000 });
let api: Awaited<ReturnType<typeof managementServer>>;
test.beforeEach(async () => { api = await managementServer(); });
test.afterEach(async () => { await api?.close(); });

test('anonymous deep links require login and expose no preview workspace', async ({ page }) => {
  await api.setup(page.context());
  await page.goto('/Inventory');
  await expect(page).toHaveURL(/\/Login$/);
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /explore preview/i })).toHaveCount(0);
  await expect(page.locator('.workspace')).toHaveCount(0);
});

test('account navigation preserves direct paths, reload and browser history, and shows usernames', async ({ page }) => {
  await api.setup(page.context());
  await api.restore(page, 'Owner', '/Inventory');
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
  await expect(page.locator('.nav-identity')).toContainText('owner');
  await expect(page.locator('.nav-identity')).not.toContainText('Test Owner');
  await page.getByRole('button', { name: 'Users', exact: true }).click();
  await expect(page).toHaveURL(/\/Users$/);
  await expect(page.getByRole('group', { name: 'owner account', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/Inventory$/);
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'User Management', exact: true })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/Users$/);
  await expect(page.getByRole('heading', { name: 'User Management', exact: true })).toBeVisible();
});

test('Staff management deep links resolve to the permitted POS workspace', async ({ page }) => {
  await api.setup(page.context(), 'Staff');
  await api.restore(page, 'Staff', '/Users');
  await expect(page).toHaveURL(/\/POS$/);
  await expect(page.getByRole('heading', { name: 'Point of Sale', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Users', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Today’s Sales History', exact: true }).click();
  await expect(page).toHaveURL(/\/Audit-Trail$/);
  await expect(page.getByRole('heading', { name: 'Sales History', exact: true })).toBeVisible();
});

test('a duplicate product receives stock into the existing record and preserves its generated SKU', async ({ page }) => {
  await api.setup(page.context());
  await api.restore(page, 'Owner', '/Inventory');
  await page.getByRole('button', { name: 'Add Product', exact: true }).click();
  await expect(page.getByLabel('SKU', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Generate', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Reason for stock change')).toHaveCount(0);
  await page.getByLabel('Product Name', { exact: true }).fill('Acceptance retail');
  await page.getByLabel('Quantity', { exact: true }).fill('10');
  await page.getByLabel('Quantity Alert', { exact: true }).fill('2');
  await page.getByLabel('Price', { exact: true }).fill('12.50');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const before = await api.read();
  const product = before.tables.products.find((row: any) => row.name === 'Acceptance retail');
  const sku = before.tables.skus.find((row: any) => row.id === product.sku_id).value;
  expect(sku).toBeTruthy();
  expect(sku).not.toMatch(/^AUTO/);
  await page.getByRole('button', { name: 'Add Product', exact: true }).click();
  await page.getByLabel('Product Name', { exact: true }).fill('  ACCEPTANCE   RETAIL  ');
  await page.getByLabel('Quantity', { exact: true }).click();
  const duplicate = page.getByRole('dialog', { name: 'This item already exists', exact: true });
  await expect(duplicate).toBeVisible();
  await duplicate.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByLabel('Reason for receipt')).toHaveCount(0);
  await page.getByLabel('Quantity Added', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Add Stock', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const after = await api.read();
  expect(after.tables.products).toHaveLength(before.tables.products.length);
  const saved = after.tables.products.find((row: any) => row.id === product.id);
  expect(after.tables.skus.find((row: any) => row.id === saved.sku_id).value).toBe(sku);
  expect(after.tables.stock_batches).toHaveLength(before.tables.stock_batches.length + 1);
  expect(after.balances.reduce((sum: number, row: any) => sum + Number(row.quantity_base), 0)).toBe(13);
});

test('partial daily review uses only selected receipts, accepts an optional discrepancy note and leaves others pending', async ({ page }) => {
  await api.db.transaction(async tx => {
    const fixture = await checkoutFixture(tx);
    for (const method of ['Cash', 'GCash']) {
      await checkoutAs(tx, api.ids.Staff);
      const lines = [fixture.line()];
      const quote = await checkoutValue(tx, 'select public.quote_checkout($1::jsonb) as value', [JSON.stringify(lines)]);
      await checkoutValue(tx, 'select public.checkout($1::jsonb) as value', [JSON.stringify({
        operationId: randomUUID(), revision: quote.revision, quoteToken: quote.quoteToken, lines,
        payment: method === 'Cash' ? { method, amount: quote.total, cashTendered: '20' }
          : { method, amount: quote.total, reference: '1234567890123' },
      })]);
    }
  });
  await api.setup(page.context());
  await api.restore(page, 'Owner', '/Audit-Trail');
  await page.getByRole('button', { name: 'Review daily sales', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Daily Sales Review', exact: true });
  const totals = dialog.getByRole('region', { name: 'Selected receipt totals' });
  await expect(totals).toContainText('0 of 2 receipts selected');
  await expect(dialog.getByRole('button', { name: 'Confirm reviewed sales', exact: true })).toBeDisabled();
  const help = dialog.locator('summary[aria-label="How daily sales review works"]');
  const helpText = dialog.getByText('Check the receipts you want to review. The expected amounts below update to match your selection.', { exact: true });
  await expect(helpText).toBeHidden();
  await help.focus(); await help.press('Enter');
  await expect(helpText).toBeVisible();
  await dialog.locator('.review-order-list label').filter({ hasText: /· Cash ·/ }).getByRole('checkbox').check();
  await expect(totals).toContainText('1 of 2 receipts selected');
  await expect(totals.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Cash', exact: true }) })).toContainText('₱14.00');
  await expect(totals.getByRole('article').filter({ has: page.getByRole('heading', { name: 'GCash', exact: true }) })).not.toContainText('₱14.00');
  await dialog.getByLabel('Cash counted for selected receipts').fill('13');
  await dialog.getByLabel('GCash verified for selected receipts').fill('0');
  await expect(dialog.getByLabel('Review notes (optional)')).toHaveValue('');
  const before = await api.read();
  await dialog.getByRole('button', { name: 'Confirm reviewed sales', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Daily Sales Review queue' })).toContainText('1 awaiting Owner review');
  expect((await api.read()).balances).toEqual(before.balances);
  const sales = await api.db.transaction(async tx => {
    await checkoutAs(tx, api.ids.Owner);
    return checkoutValue(tx, 'select public.read_sales_workflow(0,100) as value');
  });
  expect(sales.items.filter((sale: any) => sale.reviewState === 'Reviewed')).toHaveLength(1);
  expect(sales.items.filter((sale: any) => sale.reviewState === 'Awaiting Owner review')).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Daily Sales Review queue' })).toContainText('1 awaiting Owner review');
});

test('empty review queues and single-page pagination stay hidden; Reports puts stock attention first', async ({ page }) => {
  await api.setup(page.context());
  await api.restore(page, 'Owner', '/Audit-Trail');
  await expect(page.getByRole('heading', { name: 'Sales History', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Daily Sales Review queue' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Transactions pagination' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  const attention = page.getByRole('region', { name: 'Current stock needs attention' });
  await expect(attention).toBeVisible();
  await expect(page.locator('.report-summary').first()).toBeVisible();
  expect(await attention.evaluate(element => Boolean(element.compareDocumentPosition(document.querySelector('.report-summary')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
});
