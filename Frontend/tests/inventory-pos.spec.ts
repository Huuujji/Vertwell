import { saveRecord } from './fixtures/save-record';
import { test, expect } from './fixtures/legacy-preview';
import type { Page } from '@playwright/test';

async function enter(page: Page, role = 'Owner') {
  await page.clock.setFixedTime(new Date('2026-10-03T17:00:00Z'));
  await page.goto('/'); await page.getByLabel('Preview role').selectOption(role);
  await page.getByRole('button', { name: 'Open preview' }).click();
}
async function nav(page: Page, name: string) {
  if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
  if (name === 'Inventory') { await page.getByRole('button', { name: 'All inventory', exact: true }).click(); await page.getByLabel('Inventory category', { exact: true }).selectOption('All'); }
}
async function customize(page: Page) { await page.getByRole('button', { name: 'Add Hamburger to order', exact: true }).click(); }
async function saveChoices(page: Page) { await page.getByRole('button', { name: /^(Add|Update item)$/, exact: true }).click(); }
async function editStock(page: Page, name: string) {
  await nav(page, 'Inventory'); await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill(name);
  await page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
}

test('customization checks the whole cart, preserves edited quantity, and refuses stock overcommit', async ({ page }) => {
  await enter(page); await nav(page, 'POS'); await customize(page);
  await page.getByLabel('Quantity', { exact: true }).fill('19'); await saveChoices(page);
  await customize(page); await page.getByLabel('Quantity', { exact: true }).fill('2');
  await expect(page.locator('.customize-stock')).toContainText('1 pcs short for order');
  await saveChoices(page); await expect(page.getByRole('alert')).toContainText('Not enough usable Burger buns');
  await expect(page.locator('.cart-line')).toHaveCount(1);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('.cart-line').getByRole('button', { name: 'Edit options' }).click();
  await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('19');
  await expect(page.locator('.customize-stock')).toContainText('1 pcs usable after order');
  await page.getByLabel('Quantity', { exact: true }).fill('20'); await saveChoices(page);
  await expect(page.locator('.quantity-control output')).toHaveText('20');
  await page.locator('.cart-line').getByRole('button', { name: 'Edit options' }).click();
  await page.getByLabel('Quantity', { exact: true }).fill('21'); await saveChoices(page);
  await expect(page.getByRole('alert')).toContainText('Not enough usable Burger buns');
});

test('customization rejects invalid quantities, updates prices and omissions, and leaves cancellation intact', async ({ page }) => {
  await enter(page); await nav(page, 'POS'); await customize(page);
  for (const value of ['', '0', '1.5', '-1']) {
    await page.getByLabel('Quantity', { exact: true }).fill(value); await saveChoices(page);
    await expect(page.getByRole('alert')).toContainText('whole-number quantity');
  }
  await page.getByLabel('Quantity', { exact: true }).fill('2');
  await page.getByRole('checkbox', { name: /Extra cheese/ }).check();
  await page.getByRole('checkbox', { name: /No onions/ }).check();
  await expect(page.locator('.customize-group-summary')).toContainText('2 selected');
  await expect(page.locator('.customize-price')).toContainText('270.00');
  await expect(page.locator('.customize-stock li').filter({ hasText: 'Onions' })).toContainText('0 g needed');
  await saveChoices(page); await expect(page.locator('.quantity-control output')).toHaveText('2');
  await page.locator('.cart-line').getByRole('button', { name: 'Edit options' }).click();
  await page.getByRole('button', { name: 'Increase customization quantity' }).click();
  await page.getByRole('checkbox', { name: /Extra cheese/ }).uncheck();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.cart-line')).toContainText('Extra cheese');
  await expect(page.locator('.quantity-control output')).toHaveText('2');
  await page.locator('.cart-line').getByRole('button', { name: 'Edit options' }).click();
  await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('2');
  await page.keyboard.press('Escape'); await expect(page.locator('.cart-line').getByRole('button', { name: 'Edit options' })).toBeFocused();
});

test('modifier stock availability includes existing customized lines rather than only one portion', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory');
  await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('Hamburger');
  await page.getByRole('button', { name: 'Edit product Hamburger', exact: true }).click();
  await page.locator('.modifier-option').first().getByLabel('Quantity', { exact: true }).fill('3');
  await saveRecord(page);
  await nav(page, 'POS'); await customize(page);
  await page.getByRole('checkbox', { name: /Extra cheese/ }).check();
  await page.getByLabel('Quantity', { exact: true }).fill('12'); await saveChoices(page);
  await customize(page); await page.getByLabel('Quantity', { exact: true }).fill('2');
  await expect(page.getByRole('checkbox', { name: /Extra cheese/ })).toBeDisabled();
  await expect(page.locator('.modifier-unavailable')).toContainText('Cheese Slices');
  await page.getByLabel('Quantity', { exact: true }).fill('1');
  await expect(page.getByRole('checkbox', { name: /Extra cheese/ })).toBeEnabled();
});

test('new modifier price and stock snapshots never merge into an older cart configuration', async ({ page }) => {
  await enter(page); await nav(page, 'POS'); await customize(page);
  await page.getByRole('checkbox', { name: /Extra cheese/ }).check(); await saveChoices(page);
  await nav(page, 'Inventory'); await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('Hamburger');
  await page.getByRole('button', { name: 'Edit product Hamburger', exact: true }).click();
  await expect(page.locator('.product-form-grid select[name="unit"]')).toBeDisabled();
  await expect(page.getByLabel('Expiry On', { exact: true })).toHaveAttribute('required', '');
  await page.getByLabel('Price adjustment', { exact: true }).first().fill('30');
  await page.locator('.modifier-option').first().getByLabel('Quantity', { exact: true }).fill('2');
  await saveRecord(page);
  await nav(page, 'POS'); await customize(page); await page.getByRole('checkbox', { name: /Extra cheese/ }).check(); await saveChoices(page);
  await expect(page.locator('.cart-line')).toHaveCount(2); await expect(page.locator('.total-row')).toContainText('319.20');
  await page.getByRole('button', { name: 'Pay', exact: true }).click(); await page.getByRole('button', { name: 'CASH PAYMENT' }).click();
  await page.getByLabel('Amount Given:', { exact: true }).fill('400'); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await nav(page, 'Audit Trail'); await page.locator('tbody tr').first().click();
  await expect(page.locator('.sale-details')).toContainText('319.20');
  await expect(page.locator('.sale-details')).toContainText('Cheese Slices: 3 pcs');
});

test('Inventory shows derived usable stock and availability consistently with expiry and replenishment', async ({ page }) => {
  await enter(page); await editStock(page, 'Onions');
  await page.getByLabel('Expiry On', { exact: true }).fill('2026-10-02'); await saveRecord(page);
  await expect(page.locator('#stock-IN-ONION')).toContainText('0 g usable');
  await expect(page.locator('#stock-IN-ONION .status')).toHaveText('Expired / unsellable');
  await page.getByRole('button', { name: 'Add stock to Onions', exact: true }).click();
  await page.getByLabel('Quantity Added', { exact: true }).fill('50');
  await page.getByLabel('New Manufacturing Date', { exact: true }).fill('2026-10-04');
  await page.getByLabel('New Expiration Date', { exact: true }).fill('2027-10-04');
  await page.getByRole('button', { name: 'Add Stock', exact: true }).click();
  await expect(page.locator('#usable-stock-IN-ONION')).toContainText('550g');
  await expect(page.locator('#stock-IN-ONION')).toContainText('50 g usable');
  await expect(page.locator('#usable-stock-IN-ONION .status')).toHaveText('Low Stock');
  await page.getByRole('region', { name: 'Needed to Remove Stocks; scroll to see all columns', exact: true }).getByRole('button', { name: 'Expand Onions batches', exact: true }).click();
  await expect(page.locator('.batch-row .status').first()).toHaveText('Expired / unusable');
  await page.getByRole('button', { name: 'Products', exact: true }).click(); await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('Hamburger');
  await expect(page.locator('#stock-BURGER')).toContainText('Uses recipe ingredients');
  await nav(page, 'POS'); await customize(page); await page.getByLabel('Quantity', { exact: true }).fill('3');
  await saveChoices(page); await expect(page.getByRole('alert')).toContainText('Onions');
  await page.getByRole('checkbox', { name: /No onions/ }).check(); await saveChoices(page);
  await expect(page.locator('.quantity-control output')).toHaveText('3');
});

test('small-screen Staff customization remains keyboard-accessible and paid Pending stock is deducted once', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await enter(page, 'Staff'); await customize(page);
  await page.getByLabel('Quantity', { exact: true }).fill('2');
  await page.getByRole('checkbox', { name: /No onions/ }).focus(); await page.keyboard.press('Space');
  const dialog = page.getByRole('dialog');
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await saveChoices(page); await page.getByRole('button', { name: 'Pay', exact: true }).click();
  await page.getByRole('button', { name: 'CASH PAYMENT' }).click(); await page.getByLabel('Amount Given:', { exact: true }).fill('400');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await customize(page); await expect(page.locator('.customize-stock')).toContainText('17 pcs usable after order');
  await page.keyboard.press('Escape'); await nav(page, 'Today’s Sales History');
  await page.locator('tbody tr').first().click(); await expect(page.locator('.sale-details')).toContainText('Pending');
  await expect(page.locator('.sale-details')).toContainText('No onions');
});
