import { test, expect } from './fixtures/legacy-preview';
import type { Page } from '@playwright/test';
import type { Sale } from '../src/data/demo';
import { auditEvents, duplicateGroups, stockEffect } from '../src/data/audit';

async function enter(page: Page, role = 'Owner') {
  await page.clock.setFixedTime(new Date('2026-10-03T17:00:00Z'));
  await page.goto('/'); await page.getByLabel('Preview role').selectOption(role);
  await page.getByRole('button', { name: 'Open preview' }).click();
}
async function nav(page: Page, name: string) {
  if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
}
async function logout(page: Page) {
  if (page.viewportSize()!.width < 1200) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
}
async function cash(page: Page) {
  await page.getByRole('button', { name: 'Pay', exact: true }).click();
  await page.getByRole('button', { name: 'CASH PAYMENT', exact: true }).click();
  await page.getByLabel('Amount Given:', { exact: true }).fill('1000');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
}
const fixture = (id: string, seconds: number): Sale => ({ id, time: new Date(Date.parse('2026-10-04T01:00:00Z') + seconds * 1000).toISOString(), cashier: 'Angel', cashierId: 'angel', cashierRole: 'Owner', status: 'Completed', method: 'Cash', total: 100, lines: [{ name: 'Tea', category: 'Beverage', quantity: 1, price: 100 }] });

test('duplicate detection finds rolling bursts, merges overlapping evidence, and separates gaps', () => {
  const sales = [0, 90, 120, 130, 140, 150].map((seconds, i) => fixture(`burst-${i}`, seconds));
  expect(duplicateGroups(sales, 5, 2).map(group => group.map(sale => sale.id))).toEqual([['burst-1', 'burst-2', 'burst-3', 'burst-4', 'burst-5']]);
  expect(duplicateGroups([0, 30, 60, 90, 120, 150].map((seconds, i) => fixture(String(i), seconds)), 3, 1).map(group => group.length)).toEqual([6]);
  const groups = duplicateGroups([0, 10, 20, 300, 310, 320].map((seconds, i) => fixture(String(i), seconds)), 3, 1);
  expect(groups.map(group => group.map(sale => sale.id))).toEqual([['3', '4', '5'], ['0', '1', '2']]);
  expect(duplicateGroups([0, 90, 180, 270, 360].map((seconds, i) => fixture(String(i), seconds)), 5, 2)).toEqual([]);
});

test('duplicate evidence ignores basket order while retaining actor, price, modifiers and payment distinctions', () => {
  const sale = fixture('first', 0);
  sale.lines.push({ name: 'Cake', category: 'Food', quantity: 1, price: 50, modifiers: [{ id: 'a', name: 'Cream', price: 5 }, { id: 'b', name: 'Berry', price: 10 }] });
  const same = { ...sale, id: 'same', time: fixture('time', 10).time, lines: [...sale.lines].reverse().map(line => ({ ...line, modifiers: line.modifiers ? [...line.modifiers].reverse() : undefined })) };
  expect(duplicateGroups([sale, same], 2, 1)[0].map(value => value.id)).toEqual(['first', 'same']);
  for (const different of [{ ...same, cashierId: 'alex' }, { ...same, method: 'GCash' as const }, { ...same, total: 101 }, { ...same, status: 'Voided' as const }, { ...same, lines: same.lines.map(line => ({ ...line, price: line.price + 1 })) }]) expect(duplicateGroups([sale, different], 2, 1)).toEqual([]);
});

test('review chronology and stock explanations do not invent missing historical events', () => {
  const sale = fixture('review', 0);
  expect(stockEffect(sale)).toContain('not recorded');
  expect(stockEffect({ ...sale, stockCommitted: false })).toContain('no stock was deducted');
  expect(stockEffect({ ...sale, stockCommitted: true })).toContain('consumption is retained');
  expect(stockEffect({ ...sale, stockCommitted: true, usageComplete: false, usage: [] })).toContain('No configured stock usage was recorded');
  sale.voidRequest = { reason: 'Duplicate transaction', requestedBy: 'Staff', requestedRole: 'Staff', requestedAt: fixture('request', 10).time, status: 'Rejected', reviewedBy: 'Alex', reviewedRole: 'Admin', reviewedAt: fixture('review', 20).time };
  const events = auditEvents(sale);
  expect(events.map(event => event.title)).toEqual(['Order recorded', 'Void requested', 'Request rejected']);
  expect(events[2]).toMatchObject({ actor: 'Alex', role: 'Admin', time: sale.voidRequest.reviewedAt });
});

test('status and payment filters preserve context and search matches recorded modifiers and references', async ({ page }) => {
  await enter(page); await nav(page, 'POS');
  await page.getByRole('button', { name: 'Add Hamburger to order', exact: true }).click();
  await page.getByRole('checkbox', { name: /Extra cheese/ }).check();
  await page.getByRole('button', { name: /^(Add|Update item)$/ }).click();
  await page.getByRole('button', { name: 'Pay', exact: true }).click();
  await page.getByRole('button', { name: 'QR PH', exact: true }).click();
  await page.getByLabel('GCash reference number').fill('1234567890123');
  await page.getByRole('button', { name: 'Record sample' }).click();
  await nav(page, 'Audit Trail'); await page.getByLabel('Payment method', { exact: true }).selectOption('GCash');
  await page.getByLabel('Order status', { exact: true }).selectOption('Completed');
  await page.getByLabel('Search sales', { exact: true }).fill('  extra cheese  ');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Search sales', { exact: true }).fill('7890123');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await nav(page, 'Dashboard'); await nav(page, 'Audit Trail');
  await expect(page.getByLabel('Payment method', { exact: true })).toHaveValue('GCash');
  await expect(page.locator('.filter-summary')).toContainText('Search: “7890123”');
  await page.getByLabel('Order status', { exact: true }).selectOption('Pending');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters' }).click(); await expect(page.locator('tbody tr')).toHaveCount(6); await expect(page.getByRole('navigation', { name: 'Transactions pagination' })).toContainText('of 12 records');
});

test('bulk selection discloses hidden orders, supports a mixed checkbox and can keep only visible orders', async ({ page }) => {
  await enter(page, 'Admin'); await nav(page, 'Audit Trail');
  await page.getByLabel('Filter sales by date', { exact: true }).fill('2026-08-20');
  await page.getByRole('checkbox', { name: 'Select order 202608200001', exact: true }).check();
  const all = page.getByRole('checkbox', { name: 'Select all eligible orders on this page', exact: true });
  expect(await all.evaluate(input => (input as HTMLInputElement).indeterminate)).toBe(true);
  await page.getByRole('checkbox', { name: 'Select order 202608200002', exact: true }).check();
  await page.getByLabel('Search sales', { exact: true }).fill('Alex');
  await expect(page.locator('.selection-notice')).toContainText('1 selected orders are outside');
  await page.getByRole('button', { name: 'Bulk Void', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('2 selected orders');
  await expect(page.getByRole('dialog')).toContainText('202608200001');
  await expect(page.getByRole('dialog')).toContainText('Recorded stock consumption is retained');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Keep visible selection only' }).click();
  await expect(page.locator('.selection-notice')).toHaveCount(0);
  await expect(page.locator('.bulk-toolbar')).toContainText('1 selected');
  await page.getByRole('button', { name: 'Bulk Void', exact: true }).click();
  await page.getByRole('button', { name: 'Review selected orders' }).click();
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Confirm Bulk Void', exact: true }).click(); await page.getByRole('dialog', { name: 'Void selected orders permanently?' }).getByRole('button', { name: /^Void \d+ orders$/ }).click();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByLabel('Filter sales by date', { exact: true }).fill('2026-08-20');
  await expect(page.locator('tbody tr').first()).toContainText('Completed');
  await expect(page.locator('tbody tr').nth(1)).toContainText('Voided');
});

test('new duplicate evidence becomes unread and investigation overrides unrelated saved filters', async ({ page }) => {
  await enter(page); await nav(page, 'Audit Trail');
  await page.getByLabel('Payment method', { exact: true }).selectOption('GCash');
  await page.getByLabel('Order status', { exact: true }).selectOption('Voided');
  await nav(page, 'POS');
  for (let i = 0; i < 5; i++) { await page.getByRole('button', { name: 'Add Mango Matcha Latte to order', exact: true }).click(); await cash(page); }
  await nav(page, 'Dashboard');
  await page.getByRole('button', { name: 'Mark read', exact: true }).click();
  await expect(page.locator('.alert-center')).toContainText('0 unread');
  await page.getByRole('button', { name: 'Mark unread', exact: true }).click();
  await expect(page.locator('.alert-center')).toContainText('1 unread');
  await page.getByRole('button', { name: 'Mark read', exact: true }).click();
  await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Mango Matcha Latte to order', exact: true }).click(); await cash(page);
  await nav(page, 'Dashboard'); await expect(page.locator('.alert-center')).toContainText('1 unread');
  await page.getByRole('button', { name: 'Duplicate activity 1', exact: true }).click();
  await page.getByRole('button', { name: 'Review orders', exact: true }).click();
  await expect(page.locator('.investigation-context')).toContainText('6 identical orders');
  await expect(page.locator('tbody tr')).toHaveCount(6);
  await expect(page.getByLabel('Payment method', { exact: true })).toHaveValue('All payments');
  await nav(page, 'POS'); await nav(page, 'Audit Trail'); await expect(page.locator('.investigation-context')).toBeVisible();
  await page.getByRole('button', { name: 'Show all orders', exact: true }).click();
  await expect(page.locator('.investigation-context')).toHaveCount(0); await expect(page.locator('tbody tr')).toHaveCount(6); await expect(page.getByRole('navigation', { name: 'Transactions pagination' })).toContainText('of 17 records');
});

test('Pending void approval preserves the request reason and records Admin review without implying stock deduction', async ({ page }) => {
  await enter(page, 'Staff'); await page.getByRole('button', { name: 'Add Mango Matcha Latte to order', exact: true }).click(); await cash(page);
  await nav(page, 'Today’s Sales History'); await page.locator('tbody tr').first().click();
  await page.getByRole('button', { name: 'Request Void', exact: true }).click();
  await page.getByLabel('Reason for Voiding of Sale:').selectOption('Incorrect order entered');
  await page.getByRole('button', { name: 'Proceed', exact: true }).click();
  await logout(page); await page.getByLabel('Preview role').selectOption('Admin'); await page.getByRole('button', { name: 'Open preview' }).click();
  await expect(page.locator('.alert-center')).toContainText('Raven · Staff');
  await page.getByRole('button', { name: 'Review orders', exact: true }).click();
  await page.getByRole('button', { name: 'Approve Void', exact: true }).click();
  await expect(page.getByLabel('Reason for Voiding of Sale:')).toBeDisabled();
  await expect(page.getByLabel('Reason for Voiding of Sale:')).toHaveValue('Incorrect order entered');
  await page.getByRole('button', { name: 'Proceed', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Recorded stock consumption is retained');
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Confirm Void', exact: true }).click(); await page.getByRole('dialog', { name: 'Void this order permanently?' }).getByRole('button', { name: 'Void order', exact: true }).click();
  await expect(page.locator('.audit-timeline')).toContainText('Request approved');
  await expect(page.locator('.audit-timeline')).toContainText('Alex · Admin');
  await expect(page.locator('.audit-timeline time')).toHaveCount(4);
  await expect(page.locator('.sale-details')).toContainText('Void reason: Incorrect order entered');
  await nav(page, 'Dashboard'); await expect(page.locator('.alert-list article')).toHaveCount(0);
});

test('small-screen keyboard selection reaches details and explains a filtered-out selection', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await enter(page); await nav(page, 'Audit Trail');
  await page.getByLabel('Filter sales by date', { exact: true }).fill('2026-08-20');
  await page.locator('tbody tr').first().focus(); await page.keyboard.press('Enter');
  await expect(page.locator('tbody tr').first()).toBeFocused();
  await expect(page.locator('.sale-details')).toContainText('202608200001');
  await expect(page.getByRole('button', { name: 'View selected order', exact: true })).toHaveCount(0);
  await page.getByLabel('Order status', { exact: true }).selectOption('Voided');
  await expect(page.locator('.selected-order-notice')).toContainText('outside the current filters');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await logout(page); await page.getByLabel('Preview role').selectOption('Staff'); await page.getByRole('button', { name: 'Open preview' }).click();
  await nav(page, 'Today’s Sales History'); await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Bulk Void', exact: true })).toHaveCount(0);
  await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Mango Matcha Latte to order', exact: true }).click(); await cash(page);
  await nav(page, 'Today’s Sales History'); await page.locator('tbody tr').first().click();
  const details = page.getByRole('region', { name: 'Order items, payment and review timeline', exact: true });
  await details.focus(); await expect(details).toBeFocused();
  expect(await details.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true);
  await page.locator('.audit-timeline').scrollIntoViewIfNeeded();
  await expect(page.locator('.audit-timeline')).toContainText('Order recorded');
});
