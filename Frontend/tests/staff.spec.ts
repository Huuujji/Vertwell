import { test, expect } from './fixtures/legacy-preview';
import type { Page } from '@playwright/test';

async function enter(page: Page) {
  await page.goto('/');
  await page.getByLabel('Preview role').selectOption('Staff');
  await page.getByRole('button', { name: 'Open preview' }).click();
}
async function navigate(page: Page, name: string) {
  const width = page.viewportSize()!.width;
  if (width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation', { name: width >= 768 && width < 1200 ? 'Quick navigation' : 'Main navigation' })
    .getByRole('button', { name, exact: true }).click();
}
async function logout(page: Page) {
  if (page.viewportSize()!.width < 1200) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
}
async function checkGeometry(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const failures = await page.locator('.workspace-main').evaluate(main => [...main.querySelectorAll('button, input, select, h1, th, td, .product-card > strong')].filter(element => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && (parseFloat(getComputedStyle(element).fontSize) < 12 ||
      (element.matches('button, input, select') && box.height < 44));
  }).map(element => element.getAttribute('aria-label') || element.textContent));
  expect(failures).toEqual([]);
}

test('Staff counter and history keep readable controls and correct totals across layouts', async ({ page }) => {
  await enter(page);
  for (const width of [1440, 1024, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await navigate(page, 'POS');
    await expect(page.locator('.cart-empty')).toContainText('Your order starts here');
    await expect(page.getByRole('button', { name: 'Pay', exact: true })).toBeDisabled();
    await checkGeometry(page);
    await page.getByLabel('Search items', { exact: true }).fill('Mango Matcha');
    await expect(page.locator('.product-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Add Mango Matcha Latte to order', exact: true }).click();
    await page.getByRole('button', { name: 'Add one Mango Matcha Latte', exact: true }).click();
    await expect(page.locator('.order-count')).toHaveText('2 items');
    await expect(page.locator('.staff-order-breakdown')).toContainText('150.00');
    await expect(page.locator('.staff-order-breakdown')).toContainText('18.00');
    await expect(page.locator('.total-row')).toContainText('168.00');
    await checkGeometry(page);
    await navigate(page, 'Today’s Sales History');
    await expect(page.locator('.staff-daily-summary')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody')).toContainText('Iced Matcha Latte');
    await expect(page.locator('.sale-details')).toContainText('Select a transaction');
    await checkGeometry(page);
    await navigate(page, 'POS');
    await expect(page.getByLabel('Mango Matcha Latte quantity')).toHaveText('2');
    await page.getByRole('button', { name: 'Remove one Mango Matcha Latte', exact: true }).click();
    await expect(page.locator('.total-row')).toContainText('84.00');
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
  }
});

test('Staff payment dialogs keep keyboard focus, validation and short-screen actions', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 400 });
  await enter(page);
  await page.getByRole('button', { name: 'Add Mango Matcha Latte to order', exact: true }).click();
  const opener = page.getByRole('button', { name: 'Pay', exact: true });
  await opener.click();
  await expect(page.getByRole('button', { name: 'CASH PAYMENT', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Amount Given:')).toBeFocused();
  await expect(page.getByLabel('Amount Given:')).toHaveCSS('font-size', '22px');
  await page.getByLabel('Amount Given:').fill('100');
  await expect(page.locator('.change')).toContainText('16.00');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'QR PH', exact: true }).click();
  await expect(page.getByLabel('GCash reference number')).toBeFocused();
  await page.getByLabel('GCash reference number').fill('1234567890123');
  await page.getByLabel('Amount received').fill('1');
  await page.getByRole('button', { name: 'Record sample', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('must equal');
  await page.getByLabel('Amount received').fill('84.00');
  await page.getByRole('button', { name: 'Record sample', exact: true }).focus();
  const box = await page.getByRole('button', { name: 'Record sample', exact: true }).boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(400);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(page.getByLabel('Mango Matcha Latte quantity')).toHaveText('1');
  await opener.click();
  await page.getByRole('button', { name: 'QR PH', exact: true }).click();
  await page.getByLabel('GCash reference number').fill('1234567890123');
  await page.getByRole('button', { name: 'Record sample', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await navigate(page, 'Today’s Sales History');
  await page.locator('.order-link').first().click();
  await expect(page.locator('.sale-details')).toContainText('GCash reference: 1234567890123');
  await expect(page.locator('.staff-sale-status')).toHaveText(['Pending', 'Pending']);
});

test('Staff daily summaries and void requests retain only the cashier’s Manila-day sales', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-03T17:00:00Z'));
  await enter(page);
  await page.getByRole('button', { name: 'Add Mango Matcha Latte to order', exact: true }).click();
  await page.getByRole('button', { name: 'Pay', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('20261004');
  await page.getByRole('button', { name: 'CASH PAYMENT', exact: true }).click();
  await page.getByLabel('Amount Given:').fill('100');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await navigate(page, 'Today’s Sales History');
  await expect(page.locator('.staff-eyebrow')).toContainText('2026-10-04');
  await expect(page.locator('.staff-daily-summary strong')).toHaveText(['2', '2', '0']);
  await page.getByLabel('Search sales', { exact: true }).fill('missing order');
  await expect(page.locator('.empty-state')).toContainText('No matching transactions');
  await expect(page.locator('.staff-daily-summary strong')).toHaveText(['2', '2', '0']);
  await page.getByLabel('Search sales', { exact: true }).fill('');
  await page.locator('.order-link').first().click();
  const opener = page.getByRole('button', { name: 'Request Void', exact: true });
  await opener.click();
  await expect(page.getByLabel('Reason for Voiding of Sale:')).toBeFocused();
  await page.getByLabel('Reason for Voiding of Sale:').selectOption('Incorrect order entered');
  await page.getByRole('button', { name: 'Proceed', exact: true }).click();
  await expect(page.locator('.staff-daily-summary strong')).toHaveText(['2', '2', '1']);
  await expect(page.getByRole('button', { name: 'Request Pending', exact: true })).toBeDisabled();
  await logout(page);
  await page.getByLabel('Preview role').selectOption('Owner');
  await page.getByRole('button', { name: 'Open preview' }).click();
  await navigate(page, 'POS');
  await page.getByRole('button', { name: 'Add Mango Matcha Latte to order', exact: true }).click();
  await page.getByRole('button', { name: 'Pay', exact: true }).click();
  await page.getByRole('button', { name: 'CASH PAYMENT', exact: true }).click();
  await page.getByLabel('Amount Given:').fill('100');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await navigate(page, 'Audit Trail');
  await page.getByRole('button', { name: /^Void requests \(1\)/ }).click();
  await page.locator('.order-link').click();
  await page.getByRole('button', { name: 'Reject Request', exact: true }).click();
  await logout(page);
  await page.getByLabel('Preview role').selectOption('Staff');
  await page.getByRole('button', { name: 'Open preview' }).click();
  await navigate(page, 'Today’s Sales History');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('.staff-daily-summary strong')).toHaveText(['2', '2', '0']);
  await page.locator('.order-link').first().click();
  await expect(page.locator('.sale-details')).toContainText('Void request: Rejected');
  await expect(page.locator('.sale-details')).toContainText('Incorrect order entered');
  await expect(page.locator('.sale-details')).toContainText('Reviewed by Angel');
  await expect(page.getByRole('button', { name: 'Request Void', exact: true })).toBeEnabled();
});
