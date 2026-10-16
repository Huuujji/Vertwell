import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chooseSearch } from './fixtures/search-select';

const output = fileURLToPath(new URL('../../../.review/frontend/october-16-inventory/', import.meta.url));
const rows = (page: Page) => page.locator('.product-table > tbody > tr:not(.product-receipts)');
const model = (page: Page) => page.getByLabel('Inventory stock model', { exact: true });
const search = (page: Page) => page.getByLabel('Search inventory', { exact: true });
const removal = (page: Page) => page.getByRole('region', { name: 'Needed to Remove Stocks', exact: true });
const removalPaging = (page: Page) => page.getByRole('navigation', { name: 'Needed to Remove Stocks pagination', exact: true });
async function nav(page: Page, name: string) {
  if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
}
async function enter(page: Page, role = 'Owner') {
  await page.clock.setFixedTime(new Date('2026-10-16T04:23:00Z')); await page.goto('/');
  await page.getByLabel('Preview role').selectOption(role); await page.getByRole('button', { name: 'Open preview', exact: true }).click();
  await nav(page, 'Inventory'); await page.getByRole('button', { name: 'Products', exact: true }).click();
  await page.getByLabel('Inventory category', { exact: true }).selectOption('All');
}
async function capture(page: Page, name: string) {
  await mkdir(output, { recursive: true }); await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true, animations: 'disabled' });
}

test('all four stock models filter every product page and include unlisted retail SKUs', async ({ page }) => {
  await enter(page);
  await expect(model(page).locator('option')).toHaveText(['All stock models', 'Retail Item', 'Recipe', 'Variants', 'Bundle']);
  const paging = page.getByRole('navigation', { name: 'Sellable products pagination', exact: true });
  await paging.getByRole('button', { name: 'Next', exact: true }).click(); await expect(paging).toContainText('Page 2 of 4');
  for (const [value, label, total] of [['Stocked', 'Retail Item', 14], ['Made to order', 'Recipe', 3], ['Variants', 'Variants', 2], ['Bundle', 'Bundle', 2]] as const) {
    await model(page).selectOption(value); await expect(paging).toContainText(`of ${total} records · Page 1`);
    const names: string[] = [];
    while (true) {
      for (const row of await rows(page).all()) {
        await expect(row.locator(':scope > td').nth(3)).toHaveText(label);
        names.push(await row.locator(':scope > td').first().innerText());
      }
      if (await paging.getByRole('button', { name: 'Next', exact: true }).isDisabled()) break;
      await paging.getByRole('button', { name: 'Next', exact: true }).click();
    }
    expect(names).toHaveLength(total); expect(new Set(names).size).toBe(total);
    if (value === 'Stocked') expect(names.join(' ')).toContain('Collector Booster Pack');
  }
  await model(page).selectOption('All'); await expect(paging).toContainText('of 21 records · Page 1 of 4');
  await expect(page.locator('.inventory')).not.toContainText(/Inventory only/i);
});

test('model combines with category and search, persists through navigation and leaves ingredients usable', async ({ page }) => {
  await enter(page); await model(page).selectOption('Variants'); await page.getByLabel('Inventory category').selectOption('Hobby');
  await search(page).fill('HB005'); await expect(rows(page)).toHaveCount(1); await expect(rows(page)).toContainText('Model Kit Editions');
  await expect(page.locator('#stock-HB005')).toBeVisible();
  await nav(page, 'POS'); await nav(page, 'Inventory'); await expect(model(page)).toHaveValue('Variants'); await expect(search(page)).toHaveValue('HB005');
  await page.getByRole('button', { name: 'Clear search inventory', exact: true }).click(); await expect(model(page)).toHaveValue('Variants');
  await page.getByLabel('Inventory category').selectOption('Food'); await expect(rows(page)).toHaveCount(1); await expect(rows(page)).toContainText('Cookie Box Sizes');
  await search(page).fill('HB005'); await expect(rows(page)).toHaveCount(0); await expect(page.locator('.filter-summary')).toContainText('0 records');
  await expect(removal(page)).toHaveCount(0); await expect(removalPaging(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Ingredients', exact: true }).click(); await expect(model(page)).toHaveCount(0);
  await search(page).fill('Burger buns'); await expect(page.locator('#stock-IN-BUN')).toBeVisible();
  await page.getByRole('button', { name: 'All inventory', exact: true }).click(); await expect(model(page)).toHaveValue('Variants');
  await expect(page.locator('#stock-IN-BUN')).toBeVisible(); await expect(rows(page)).toHaveCount(0);
  await expect(page.getByText('Stock model filters products. Ingredients use the category and search filters.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Modifier groups', exact: true }).click(); await expect(model(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click(); await expect(model(page)).toHaveValue('Variants');
});

for (const role of ['Owner', 'Admin']) test(`${role} can edit, receive and remove unlisted retail stock without creating a POS listing`, async ({ page }) => {
  await enter(page, role); await model(page).selectOption('Stocked'); await search(page).fill('HB001');
  await expect(rows(page)).toContainText('Retail Item'); await expect(rows(page)).toContainText('No POS listing');
  const actions = rows(page).locator(':scope > td > .row-actions button'); await expect(actions).toHaveText(['Edit', '', 'Remove']);
  await expect(page.getByRole('button', { name: 'Stock details for Collector Booster Pack', exact: true })).toHaveCount(0);
  await expect(page.locator('.product-receipts')).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Collector Booster Pack', exact: true }).click();
  await page.getByLabel('Quantity', { exact: true }).fill('6'); await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(model(page)).toHaveValue('All'); await search(page).fill('HB001'); await expect(rows(page)).toContainText('6pcs on hand');
  await page.getByRole('button', { name: 'Add stock to Collector Booster Pack', exact: true }).click();
  await page.getByLabel('Quantity Added').fill('2'); await page.getByRole('dialog').getByRole('button', { name: 'Add Stock', exact: true }).click();
  await expect(rows(page)).toContainText('8pcs on hand'); await expect(page.getByRole('button', { name: 'Remove Collector Booster Pack batch 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Collector Booster Pack batch 2', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm removal', exact: true }).click(); await expect(rows(page)).toContainText('6pcs on hand');
  await page.getByRole('button', { name: 'Remove Collector Booster Pack record', exact: true }).click();
  await page.getByRole('button', { name: 'Keep record', exact: true }).click(); await expect(rows(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove Collector Booster Pack record', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm removal', exact: true }).click(); await search(page).fill('HB001'); await expect(rows(page)).toHaveCount(0);
  await nav(page, 'POS'); await expect(page.locator('.product-card')).toHaveCount(10);
  await expect(page.getByRole('button', { name: 'Add Collector Booster Pack to order', exact: true })).toHaveCount(0);
});

test('removal section and pagination appear only for matching unusable quantities and disappear after final removal', async ({ page }) => {
  await enter(page); await search(page).fill('Butter Cookie Pouch'); await expect(removal(page)).toBeVisible();
  await expect(removalPaging(page)).toContainText('of 1 records'); await expect(removal(page)).toContainText('6pcs');
  await model(page).selectOption('Made to order'); await expect(removal(page)).toHaveCount(0); await expect(removalPaging(page)).toHaveCount(0);
  await model(page).selectOption('Stocked'); await expect(removal(page)).toBeVisible();
  const usable = await rows(page).locator('.stock-availability-note').textContent();
  await removal(page).getByRole('button', { name: 'Remove unusable stock from Butter Cookie Pouch', exact: true }).click();
  await page.getByRole('button', { name: 'Keep stocks', exact: true }).click(); await expect(removal(page)).toBeVisible();
  await removal(page).getByRole('button', { name: 'Remove unusable stock from Butter Cookie Pouch', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm removal', exact: true }).click();
  await expect(removal(page)).toHaveCount(0); await expect(removalPaging(page)).toHaveCount(0);
  await expect(rows(page).locator('.stock-availability-note')).toHaveText(usable!);
  await search(page).fill('FD004'); await expect(rows(page)).toContainText('0pcs on hand'); await expect(removal(page)).toHaveCount(0);
  await page.getByLabel('Inventory category').selectOption('Hobby'); await search(page).fill(''); await expect(removal(page)).toHaveCount(0);
});

test('Dashboard drill-down resets a restrictive stock model and reveals the affected removal batch', async ({ page }) => {
  await enter(page); await model(page).selectOption('Bundle'); await search(page).fill('impossible');
  await nav(page, 'Dashboard'); await page.getByRole('button', { name: 'Food and Beverage', exact: true }).click();
  await page.locator('.attention .attention-link').filter({ hasText: 'Butter Cookie Pouch' }).click();
  await expect(model(page)).toHaveValue('All'); await expect(search(page)).toHaveValue('');
  await expect(removal(page)).toBeVisible(); await expect(page.locator('#stock-butter-cookie-1')).toHaveClass(/active-row/);
  await model(page).selectOption('Made to order'); await nav(page, 'Dashboard');
  await page.locator('.attention .attention-link').filter({ hasText: 'Chicken Pesto Panini' }).click();
  await expect(model(page)).toHaveValue('All'); await expect(page.locator('#stock-FD004')).toBeVisible();
  await expect(page.locator('#stock-FD004')).toHaveClass(/active-row/); await expect(page.locator('#stock-FD004')).toHaveAttribute('aria-selected', 'true');
});

test('unlisted retail removal keeps live modifier dependencies and saving a new retail product clears a recipe filter', async ({ page }) => {
  await enter(page); await search(page).fill('Deck Sleeves'); await page.getByRole('button', { name: 'Edit product Deck Sleeves', exact: true }).click();
  await page.getByRole('button', { name: 'Add modifier group', exact: true }).click(); await page.getByLabel('Group name', { exact: true }).fill('Bonus pack');
  await page.getByRole('button', { name: 'Add option', exact: true }).click(); await page.getByLabel('Option name', { exact: true }).fill('Collector pack');
  await page.getByRole('button', { name: 'Add modifier input', exact: true }).click(); await chooseSearch(page.getByLabel('Stock item', { exact: true }), 'HB001');
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await search(page).fill('HB001');
  await page.getByRole('button', { name: 'Remove Collector Booster Pack record', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('This stock is used by Deck Sleeves'); await expect(page.getByRole('button', { name: 'Confirm removal', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Keep record', exact: true }).click();
  await model(page).selectOption('Made to order'); await page.getByRole('button', { name: 'Add Product', exact: true }).click();
  await page.getByLabel('Category', { exact: true }).selectOption('Hobby'); await page.getByLabel('Product Name', { exact: true }).fill('New Retail Item');
  await page.getByLabel('SKU', { exact: true }).fill('TEST-NEW-RETAIL'); await page.getByLabel('Quantity', { exact: true }).fill('3');
  await page.getByLabel('Quantity Alert', { exact: true }).fill('1'); await page.getByLabel('Price', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(model(page)).toHaveValue('All');
  await expect(page.getByRole('button', { name: 'Edit product New Retail Item', exact: true })).toBeVisible();
});

for (const [width, height] of [[1440, 900], [820, 1180], [390, 844], [320, 568], [820, 400]]) test(`stock model controls, retail actions and conditional removal at ${width}x${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height }); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await enter(page, 'Admin'); await page.getByRole('button', { name: 'All inventory', exact: true }).click();
  if (width >= 1200) {
    const bottoms = await page.locator('.inventory-controls').evaluate(element => [...element.querySelectorAll('.tabs button, .modifier-destination, select, input[type=search]')].map(control => control.getBoundingClientRect().bottom));
    expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(2);
  }
  await capture(page, `${width}x${height}-all-models`);
  await model(page).selectOption('Stocked'); await page.getByLabel('Inventory category').selectOption('Hobby'); await search(page).fill('HB001');
  await expect(removal(page)).toHaveCount(0); await expect(removalPaging(page)).toHaveCount(0); await expect(rows(page)).toContainText('Retail Item');
  const actions = rows(page).locator(':scope > td > .row-actions button'); const tops = await actions.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
  for (const control of [model(page), ...await actions.all()]) {
    const box = await control.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await capture(page, `${width}x${height}-retail-no-removal`);
  await page.getByRole('region', { name: 'Sellable products; scroll to see all columns', exact: true }).evaluate(element => { element.scrollLeft = element.scrollWidth; });
  await capture(page, `${width}x${height}-retail-actions`);
  await search(page).fill('no such SKU'); await expect(rows(page)).toHaveCount(0); await expect(page.locator('.filter-summary')).toContainText('0 records');
  await capture(page, `${width}x${height}-empty`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); expect(errors).toEqual([]);
});
