import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { managementServer } from './fixtures/management-server';
import { checkoutAs, checkoutFixture, checkoutValue } from '../../backend/scripts/checkout-checks';

test.describe.configure({ mode: 'serial', timeout: 90000 });
let api: Awaited<ReturnType<typeof managementServer>>;
test.beforeEach(async () => { api = await managementServer(); });
test.afterEach(async () => { await api?.close(); });
async function contained(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
async function capture(page: Page, name: string) {
  const output = fileURLToPath(new URL('../../../.review/task5-20261022/', import.meta.url));
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: `${output}/${name}.png` });
}
async function navigate(page: Page, name: string) {
  const opener = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await opener.isVisible()) {
    await opener.focus(); await page.keyboard.press('Enter');
    const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true });
    await expect(drawer.getByRole('button', { name: 'Close navigation', exact: true })).toBeFocused();
    await drawer.getByRole('button', { name, exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(drawer).not.toBeVisible();
  } else {
    await page.getByRole('button', { name, exact: true }).focus(); await page.keyboard.press('Enter');
  }
}

test('login and recovery preserve keyboard order, password state, named fields and alert errors', async ({ page }) => {
  await api.setup(page.context()); await page.goto('/Login');
  await page.keyboard.press('Tab'); await expect(page.getByLabel('Username or email')).toBeFocused();
  await page.keyboard.type('owner'); await page.keyboard.press('Tab');
  await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
  await page.keyboard.type('incorrect-password'); await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Show password', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await expect(page.getByRole('button', { name: 'Hide password', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space');
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Forgot password?', exact: true })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Verify account email with code or link', exact: true })).toHaveCount(0);
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.workspace')).toHaveCount(0);
  await page.getByRole('button', { name: 'Forgot password?', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Reset your password', exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByLabel('Account email', { exact: true })).toBeFocused();
  await page.setViewportSize({ width: 320, height: 568 }); await contained(page);
});

test('manager pages reflow at narrow content widths and navigation traps and restores keyboard focus', async ({ page }) => {
  await api.setup(page.context()); await api.restore(page, 'Owner', '/Inventory');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Reflow only: real browser zoom, OS scaling and physical devices need manual evidence.
  for (const [width, height] of [[1440, 900], [640, 360], [320, 568]]) {
    await page.setViewportSize({ width, height });
    for (const [name, heading] of [['Dashboard', 'Dashboard'], ['Inventory', 'Inventory'], ['POS', 'Point of Sale'], ['Reports', 'Reports'], ['Audit Trail', 'Sales History'], ['Users', 'User Management']]) {
      await navigate(page, name);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible(); await contained(page);
      await capture(page, `${name.replaceAll(' ', '-')}-${width}x${height}`);
    }
    if (width < 1200) {
      const opener = page.getByRole('button', { name: 'Open navigation', exact: true });
      await opener.focus(); await page.keyboard.press('Enter');
      const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true });
      const close = drawer.getByRole('button', { name: 'Close navigation', exact: true });
      await expect(close).toBeFocused(); await page.keyboard.press('Shift+Tab');
      await expect(drawer.getByRole('button', { name: 'Log out', exact: true })).toBeFocused();
      await page.keyboard.press('Tab'); await expect(close).toBeFocused();
      await page.keyboard.press('Escape'); await expect(opener).toBeFocused();
    }
  }
});

test('short-screen inventory, payment and receipt review support named controls, keyboard dismissal and retained selection', async ({ page }) => {
  await api.db.transaction(async tx => {
    const f = await checkoutFixture(tx); await checkoutAs(tx, api.ids.Staff);
    const lines = [f.line()];
    const q = await checkoutValue(tx, 'select public.quote_checkout($1::jsonb) as value', [JSON.stringify(lines)]);
    await checkoutValue(tx, 'select public.checkout($1::jsonb) as value', [JSON.stringify({ operationId: randomUUID(), revision: q.revision, quoteToken: q.quoteToken, lines, payment: { method: 'Cash', amount: q.total, cashTendered: '20' } })]);
  });
  await api.setup(page.context()); await api.restore(page, 'Owner', '/Inventory');
  await page.setViewportSize({ width: 640, height: 360 });
  await page.getByRole('button', { name: 'Add Product', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByLabel('Product Name', { exact: true })).toBeFocused(); await contained(page);
  await page.getByRole('button', { name: 'Back to Inventory', exact: true }).focus(); await page.keyboard.press('Enter');
  await navigate(page, 'POS');
  await page.getByRole('button', { name: /^Add P6 retail .* to order$/ }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Pay', exact: true }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Cash payment', exact: true }).focus(); await page.keyboard.press('Enter');
  const cash = page.getByRole('dialog', { name: 'CASH PAYMENT', exact: true });
  await expect(page.getByLabel('Amount Given:', { exact: true })).toBeFocused();
  expect(await cash.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await capture(page, 'cash-640x360');
  await page.keyboard.press('Escape'); await expect(cash).toHaveCount(0);
  await navigate(page, 'Audit Trail');
  const review = page.getByRole('button', { name: 'Review daily sales', exact: true });
  await review.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Daily Sales Review', exact: true });
  await dialog.locator('summary[aria-label="How daily sales review works"]').focus(); await page.keyboard.press('Enter');
  await expect(dialog.getByText('Check the receipts you want to review. The expected amounts below update to match your selection.', { exact: true })).toBeVisible();
  const receipt = dialog.getByRole('checkbox'); await receipt.focus(); await page.keyboard.press('Space'); await expect(receipt).toBeChecked();
  await expect(dialog.getByRole('region', { name: 'Selected receipt totals' })).toContainText('1 of 1 receipts selected');
  await expect(dialog.getByLabel('Review notes (optional)')).toBeVisible();
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await capture(page, 'review-640x360');
  await page.keyboard.press('Escape');
  const discard = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
  await expect(discard.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(receipt).toBeChecked();
  await page.keyboard.press('Escape'); await discard.getByRole('button', { name: 'Discard changes', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(review).toBeFocused();
  expect(await checkoutValue(api.db, 'select count(*)::int as value from public.sales')).toBe(1);
});
