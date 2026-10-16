import { test, expect } from './fixtures/legacy-preview';
import type { Page } from '@playwright/test';
import { categoryAmount, stockCondition } from '../src/data/reporting';
import type { Sale, StockItem } from '../src/data/demo';

async function enter(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-03T17:00:00Z'));
  await page.goto('/'); await page.getByRole('button', { name: 'Open preview' }).click();
}
async function nav(page: Page, name: string) {
  if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
}
async function mixedOrder(page: Page) {
  await nav(page, 'POS');
  await page.getByRole('button', { name: 'Add Mango Matcha Latte to order', exact: true }).click();
  await page.getByRole('button', { name: 'Add Card Pack to order', exact: true }).click();
  await page.getByRole('button', { name: 'Pay', exact: true }).click();
  await page.getByRole('button', { name: 'CASH PAYMENT', exact: true }).click();
  await page.getByLabel('Amount Given:', { exact: true }).fill('400');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
}

test('dashboard category totals and drill-downs match mixed-order report amounts and CSV', async ({ page }) => {
  await enter(page); await mixedOrder(page); await nav(page, 'Dashboard');
  await expect(page.locator('.today-card')).toContainText('168.00');
  await page.getByRole('button', { name: /Average completed order/ }).click();
  await expect(page.getByLabel('Report scope')).toHaveValue('Sales');
  await expect(page.getByLabel('Sales category')).toHaveValue('Food and Beverage');
  await expect(page.getByLabel('From', { exact: true })).toHaveValue('2026-10-04');
  await expect(page.locator('.report-summary')).toContainText('168.00');
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await expect(page.locator('tbody tr').first()).toContainText('84.00');
  await page.getByLabel('Export format').selectOption('CSV');
  await page.getByRole('button', { name: 'Export report' }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'Export', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toContain('food-and-beverage');
  const stream = await download.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString('utf8');
  expect(csv).toContain('Food and Beverage'); expect(csv).toContain('₱84.00'); expect(csv).not.toContain('₱364.00');
  await nav(page, 'Dashboard'); await page.getByRole('button', { name: 'Hobby', exact: true }).click();
  await expect(page.locator('.today-card')).toContainText('280.00');
  await page.getByRole('button', { name: 'View filtered report' }).click();
  await expect(page.getByLabel('Sales category')).toHaveValue('Hobby');
  await expect(page.locator('.report-summary')).toContainText('280.00');
  await page.getByLabel('Sales category').selectOption('All categories');
  await expect(page.locator('.report-summary')).toContainText('448.00');
  await nav(page, 'Dashboard');
  await page.getByRole('button', { name: /Today’s other statuses/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
});

test('empty category status drill-down stays empty and Clear filters restores all orders', async ({ page }) => {
  await enter(page);
  // Move to the next Manila day without rebuilding the in-memory seed receipts.
  await page.clock.setFixedTime(new Date('2026-10-04T17:00:00Z'));
  await page.getByRole('button', { name: 'Hobby', exact: true }).click();
  await page.getByRole('button', { name: /Today’s other statuses/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await expect(page.locator('.filter-summary')).toContainText('0 linked orders');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(6);
});

test('partially expired stock stays actionable and reports separate physical from usable quantities', async ({ page }) => {
  await enter(page);
  const alert = page.locator('.attention .attention-link').filter({ hasText: 'Croissant' });
  await expect(alert).toContainText('Needed to Remove Stocks'); await expect(alert).toContainText('12 pcs usable');
  await alert.click();
  await expect(page.locator('#stock-FD001')).not.toHaveClass(/active-row/);
  await expect(page.locator('.batch-row.active-row')).toHaveCount(1);
  await nav(page, 'Reports'); await page.getByLabel('Report scope').selectOption('Inventory usage');
  const stockPaging = page.getByRole('navigation', { name: /^Stocks remaining/ }); await stockPaging.getByRole('button', { name: 'Next' }).click();
  const row = page.getByRole('region', { name: /^Stocks remaining/ }).locator('tbody tr').filter({ hasText: 'Croissant' });
  await expect(row).toContainText('18'); await expect(row).toContainText('12 usable');
  await expect(row).toContainText('Expiring Soon');
  await page.getByRole('button', { name: 'Export report' }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Export inventory usage report');
  await expect(page.getByRole('dialog').locator('.report-payment-split')).toHaveCount(0);
});

test('mobile daily chart values and filtered report controls remain keyboard-accessible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await enter(page); await mixedOrder(page); await nav(page, 'Dashboard');
  await page.locator('.daily-sales-values summary').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.daily-sales-values table')).toBeVisible();
  await expect(page.locator('.daily-sales-values tbody tr')).toHaveCount(9);
  await expect(page.locator('.daily-sales-values tbody tr').last()).toContainText('168.00');
  await page.getByRole('button', { name: 'View filtered report' }).click();
  await expect(page.getByLabel('Sales category')).toHaveValue('Food and Beverage');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Sales category').focus(); await expect(page.getByLabel('Sales category')).toBeFocused();
  await nav(page, 'POS'); await nav(page, 'Reports');
  await expect(page.getByLabel('Sales category')).toHaveValue('Food and Beverage');
});

test('category allocations reconcile at cent boundaries and stock alerts use usable batch quantities', () => {
  const sale: Sale = { id: 'mixed', time: '2026-10-04', cashier: 'Owner', status: 'Completed', method: 'Cash', total: 0.05,
    lines: [{ name: 'Food', category: 'Food', quantity: 1, price: 0.01 }, { name: 'Hobby', category: 'Hobby', quantity: 1, price: 0.01 }] };
  const food = Math.round(categoryAmount(sale, 'Food and Beverage') * 100), hobby = Math.round(categoryAmount(sale, 'Hobby') * 100);
  expect(food + hobby).toBe(5);
  const stock: StockItem = { id: 'partial', name: 'Partial expiry', category: 'Food', quantity: 20, unit: 'pcs', threshold: 5, manufactured: '', expires: '', status: 'In Stock', batches: [
    { id: 'expired', quantity: 17, manufactured: '', expires: '2000-01-01', status: 'Fresh' },
    { id: 'usable', quantity: 3, manufactured: '', expires: '2099-01-01', status: 'Fresh' },
  ] };
  expect(stockCondition(stock)).toBe('Low Stock');
  expect(stockCondition({ ...stock, threshold: 1 })).toBe('Contains expired stock');
});
