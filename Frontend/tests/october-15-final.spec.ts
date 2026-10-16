import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../../../.review/frontend/october-15/final/', import.meta.url));
async function enter(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-15T04:23:00Z')); await page.goto('/');
  await page.getByRole('button', { name: 'Open preview', exact: true }).click();
}
async function nav(page: Page, name: string) {
  if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
}
async function capture(page: Page, name: string) {
  await mkdir(output, { recursive: true }); const size = page.viewportSize()!;
  await page.screenshot({ path: `${output}/${size.width}x${size.height}-${name}.png` });
}
async function calendar(page: Page, label: string, name: string) {
  const opener = page.getByRole('button', { name: `Open ${label.toLowerCase()} calendar`, exact: true });
  await opener.click(); const panel = page.getByRole('dialog', { name: `${label} calendar`, exact: true });
  for (const action of ['Today', 'Clear', 'Close']) {
    const button = panel.getByRole('button', { name: action, exact: true }); await expect(button).toBeInViewport();
    const box = (await button.boundingBox())!; expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y).toBeGreaterThanOrEqual(8); expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height - 7);
    expect(await button.evaluate(element => { const r = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
  }
  await capture(page, name);
  await panel.getByRole('button', { name: 'Today', exact: true }).click(); await expect(page.getByLabel(label, { exact: true })).toHaveValue('2026-10-15'); await expect(opener).toBeFocused();
  await opener.click(); await panel.getByRole('button', { name: 'Clear', exact: true }).click(); await expect(page.getByLabel(label, { exact: true })).toHaveValue(''); await expect(opener).toBeFocused();
  await opener.click(); await panel.getByRole('button', { name: 'Close', exact: true }).click(); await expect(opener).toBeFocused();
  await opener.click(); await page.keyboard.press('Escape'); await expect(panel).not.toBeVisible(); await expect(opener).toBeFocused();
}

for (const [width, height] of [[1440, 900], [820, 1180], [390, 844], [320, 568], [820, 400]]) {
  test(`calendar footer, keyboard and focus work in Dashboard, receiving, editor and Audit at ${width}x${height}`, async ({ page }) => {
    test.setTimeout(60000); await page.setViewportSize({ width, height }); await enter(page);
    await calendar(page, 'Sales to', 'dashboard-calendar');
    await nav(page, 'Inventory'); await page.getByLabel('Search inventory', { exact: true }).fill('Oat Milk');
    await page.getByRole('button', { name: 'Add stock to Oat Milk', exact: true }).click();
    await calendar(page, 'New Manufacturing Date', 'receiving-calendar');
    await expect(page.getByRole('dialog', { name: 'Add Stock — Oat Milk', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('dialog', { name: 'Discard unsaved changes?' }).getByRole('button', { name: 'Discard changes', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Oat Milk', exact: true }).click();
    await calendar(page, 'Expiry On', 'editor-calendar');
    await page.getByRole('button', { name: 'Open expiry on calendar', exact: true }).click();
    const date = page.getByRole('dialog', { name: 'Expiry On calendar', exact: true }).locator('[data-date="2026-10-15"]');
    await expect(date).toBeFocused(); await date.press('PageUp');
    const previous = page.getByRole('dialog', { name: 'Expiry On calendar', exact: true }).locator('[data-date="2026-09-15"]');
    await expect(previous).toBeFocused(); await previous.press('ArrowRight'); await page.keyboard.press('Enter');
    await expect(page.getByLabel('Expiry On', { exact: true })).toHaveValue('2026-09-16');
    await page.getByRole('button', { name: 'Back to Inventory', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Discard/ }).click();
    await nav(page, 'Audit Trail'); await calendar(page, 'Filter sales by date', 'audit-calendar');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}

test('Products owns retail, variant and unlisted receipts; opening, receiving and batch editing keep unique rows', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory'); await page.getByRole('button', { name: 'Products', exact: true }).click();
  await page.getByLabel('Inventory category').selectOption('Hobby'); await page.getByLabel('Search inventory', { exact: true }).fill('Model Kit Editions');
  const button = page.getByRole('button', { name: 'Stock details for Model Kit Editions', exact: true });
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  const productRow = button.locator('xpath=ancestor::tr'); await productRow.getByText('Model Kit Editions', { exact: true }).click();
  await expect(productRow).toHaveClass('active-row'); await expect(button).toHaveAttribute('aria-expanded', 'false');
  await productRow.getByText('Model Kit Editions', { exact: true }).click(); await expect(productRow).not.toHaveClass('active-row');
  await button.click(); await expect(page.locator('#stock-HB004')).toBeVisible(); await expect(page.locator('#stock-HB005')).toBeVisible();
  await button.click(); await expect(page.locator('#stock-HB005')).toHaveCount(0);
  await button.click(); const initial = await page.locator('#stock-HB005').innerText();
  const before = Number(initial.match(/(\d+)pcs/)![1]);
  await page.getByRole('button', { name: 'Add stock to Model Kit (Deluxe)', exact: true }).click();
  await page.getByLabel('Quantity Added', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Add Stock', exact: true }).click(); await expect(page.locator('#stock-HB005')).toContainText(`${before + 3}pcs`);
  await page.getByRole('button', { name: 'Edit Model Kit (Deluxe)', exact: true }).click();
  const batch = page.getByRole('combobox', { name: 'Receipt batch to edit', exact: true }); await batch.fill('Batch 2');
  await page.getByRole('option', { name: /^Batch 2/ }).click(); await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('3');
  await page.getByLabel('Quantity', { exact: true }).fill('2'); await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('#stock-HB005')).toContainText(`${before + 2}pcs`);
  await page.getByLabel('Search inventory', { exact: true }).fill('Model Kit (Master)');
  await expect(page.locator('#stock-HB006')).toContainText('0pcs'); await expect(page.locator('.product-table')).toContainText('Not listed in POS');
  await capture(page, 'product-receipts');
  const duplicates = await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(element => element.id); return ids.filter((id, i) => ids.indexOf(id) !== i); });
  expect(duplicates).toEqual([]); await expect(page.getByRole('heading', { name: 'Product stock', exact: true })).toHaveCount(0);
});

test('fixed bundle variants and options are chosen in Inventory and consumed with standalone stock', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory'); await page.getByRole('button', { name: 'Add Product', exact: true }).click();
  await page.getByLabel('Product Name', { exact: true }).fill('Deluxe lunch bundle'); await page.getByLabel('SKU', { exact: true }).fill('PRB-FD-9001');
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Food');
  await page.getByRole('combobox', { name: 'Stock model', exact: true }).selectOption('Bundle');
  await page.getByLabel('Price', { exact: true }).fill('1200'); await page.getByLabel('Manufactured Date', { exact: true }).fill('2026-10-01'); await page.getByLabel('Expiry On', { exact: true }).fill('2026-12-31');
  for (const product of ['Model Kit Editions', 'Grilled Beef Sliders']) {
    await page.getByRole('button', { name: 'Add bundle component', exact: true }).click();
    const field = page.getByRole('combobox', { name: 'Available product', exact: true }).last(); await field.fill(product); await page.getByRole('option', { name: new RegExp(`^${product}`) }).click();
  }
  await page.getByRole('combobox', { name: 'Included variant', exact: true }).selectOption({ label: 'Deluxe' });
  await page.getByRole('checkbox', { name: 'Extra cheese', exact: true }).check(); await page.getByRole('button', { name: 'Save', exact: true }).click();
  await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Deluxe lunch bundle to order', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Included in Deluxe lunch bundle', exact: true });
  await expect(modal).toContainText('Model Kit Editions — Deluxe'); await expect(modal).toContainText('Extra cheese');
  await expect(modal.getByRole('checkbox')).toHaveCount(0); await modal.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Pay', exact: true }).click(); await page.getByRole('button', { name: 'CASH PAYMENT', exact: true }).click();
  await page.getByLabel('Amount Given:', { exact: true }).fill('2000'); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await nav(page, 'Inventory'); await page.getByRole('button', { name: 'All inventory', exact: true }).click(); await page.getByLabel('Inventory category').selectOption('All');
  await page.getByLabel('Search inventory', { exact: true }).fill('HB005'); await expect(page.locator('#stock-HB005')).toContainText('2pcs');
  await page.getByLabel('Search inventory', { exact: true }).fill('Cheese Slices'); await expect(page.locator('#stock-FD007')).toContainText('39pcs');
});
