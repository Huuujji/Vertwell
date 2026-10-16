import { chooseSearch } from './fixtures/search-select';
import { saveRecord } from './fixtures/save-record';
import { test, expect, type Page } from './fixtures/legacy-preview';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const reviewPath = fileURLToPath(new URL('../../../.review/frontend/priority-feedback/', import.meta.url));
async function enter(page: Page, role = 'Owner') {
  await page.clock.setFixedTime(new Date('2026-10-03T17:00:00Z'));
  await page.goto('/'); await page.getByLabel('Preview role').selectOption(role); await page.getByRole('button', { name: 'Open preview', exact: true }).click();
}
async function nav(page: Page, name: string) {
  if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
}
async function switchRole(page: Page, role: string) {
  if (page.viewportSize()!.width < 1200) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByLabel('Preview role').selectOption(role); await page.getByRole('button', { name: 'Open preview', exact: true }).click();
}
async function burger(page: Page, option?: string) {
  await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Hamburger to order', exact: true }).click();
  if (option) await page.getByRole('checkbox', { name: new RegExp(option) }).check();
  await page.getByRole('button', { name: /^(Add|Update item)$/, exact: true }).click();
}
async function pay(page: Page, digital = false) {
  await page.getByRole('button', { name: 'Pay', exact: true }).click();
  if (digital) {
    await page.getByRole('button', { name: 'QR PH', exact: true }).click(); await page.getByLabel('GCash reference number').fill('5555555555555'); await page.getByRole('button', { name: 'Record sample', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'CASH PAYMENT', exact: true }).click(); await page.getByLabel('Amount Given:', { exact: true }).fill('1000'); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  }
}
async function stockRow(page: Page, name: string) {
  await nav(page, 'Inventory'); await page.getByRole('button', { name: 'Ingredients', exact: true }).click(); await page.getByLabel('Inventory category', { exact: true }).selectOption('All'); await page.getByLabel('Search inventory', { exact: true }).fill(name);
  return page.getByRole('region', { name: 'Ingredients; scroll to see all columns', exact: true }).locator('tbody tr').first();
}

test('Staff/Admin paid sales consume stock once; only Owner completes the exact receipt review with explained discrepancy', async ({ page }) => {
  await enter(page, 'Staff'); await burger(page, 'Extra cheese'); await pay(page);
  await nav(page, 'Today’s Sales History'); await page.locator('tbody tr').first().click();
  await expect(page.locator('.sale-details')).toContainText('Payment received · Fulfilled · Awaiting Owner review');
  await expect(page.locator('.sale-details')).toContainText('consumption is retained');
  await expect(page.locator('.staff-daily-summary strong')).toHaveText(['2', '2', '0']);
  await expect(page.locator('.workspace-main')).not.toContainText('shift');
  await switchRole(page, 'Admin'); await page.getByRole('button', { name: 'Review daily sales', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Only the Owner'); await expect(page.getByRole('button', { name: 'Confirm reviewed sales' })).toHaveCount(0); await page.keyboard.press('Escape');
  await burger(page, 'No onions'); await pay(page, true);
  await switchRole(page, 'Owner');
  await expect(await stockRow(page, 'Burger buns')).toContainText('18pcs');
  await nav(page, 'Reports'); await page.getByLabel('From', { exact: true }).fill('2026-10-04'); await page.getByLabel('To', { exact: true }).fill('2026-10-04');
  const linked = page.getByRole('region', { name: 'Ingredient usage by transaction; scroll to see all columns' });
  await expect(linked).toContainText('Extra cheese'); await expect(linked).toContainText('Cheese Slices'); await expect(linked).toContainText('Pending');
  await nav(page, 'Dashboard'); await page.getByRole('button', { name: 'Review daily sales', exact: true }).click();
  const modal = page.getByRole('dialog'); await expect(modal).toContainText('6 orders awaiting'); await expect(modal).toContainText('5555555555555');
  for (const checkbox of await modal.getByRole('checkbox').all()) await checkbox.check();
  await page.getByLabel('Counted cash for included receipts').fill('514.20'); await page.getByLabel('Verified GCash receipts amount').fill('302.40');
  await expect(modal).toContainText('Discrepancy requires an explained decision');
  await expect(page.getByLabel('Review notes / discrepancy decision')).toHaveAttribute('required', '');
  await page.getByLabel('Review notes / discrepancy decision').fill('Accepted PHP 1 cash shortage after checking both included receipts.');
  for (const [width, height] of [[320, 568], [820, 400]]) {
    await page.setViewportSize({ width, height }); await modal.getByRole('button', { name: 'Confirm reviewed sales', exact: true }).scrollIntoViewIfNeeded();
    await expect(modal.getByRole('heading', { name: 'Daily Sales Review', exact: true })).toBeInViewport(); await expect(modal.getByRole('button', { name: 'Close dialog' })).toBeInViewport();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Confirm reviewed sales', exact: true }).click();
  await expect(page.locator('.daily-review-card')).toContainText('0 awaiting Owner review'); await expect(page.getByRole('button', { name: 'Review daily sales' })).toBeDisabled();
  await expect(await stockRow(page, 'Burger buns')).toContainText('18pcs');
  await nav(page, 'Audit Trail'); await page.getByLabel('Search sales', { exact: true }).fill('Alex'); await page.locator('tbody tr').first().click();
  await expect(page.locator('.sale-details')).toContainText('Status: Completed'); await expect(page.locator('.sale-details')).toContainText('Angel · Owner'); await expect(page.locator('.sale-details')).toContainText('Reviewed with explained discrepancy');
  await expect(page.locator('.audit-timeline')).toContainText('Daily sales reviewed');
  await burger(page); await pay(page); await nav(page, 'Dashboard'); await expect(page.getByRole('button', { name: 'Review daily sales' })).toBeDisabled();
  await expect(await stockRow(page, 'Burger buns')).toContainText('17pcs');
});

test('Inventory scope persists and Hotdog with Rice base recipe can be created without modifiers or photo', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory');
  await page.getByRole('button', { name: 'Products', exact: true }).click(); await page.getByLabel('Inventory category', { exact: true }).selectOption('All');
  const productsPaging = page.getByRole('navigation', { name: 'Sellable products pagination' });
  await expect(productsPaging).toContainText('of 20 records'); while (await productsPaging.getByRole('button', { name: 'Next' }).isEnabled()) await productsPaging.getByRole('button', { name: 'Next' }).click(); await expect(productsPaging).toContainText('Page 4 of 4'); await expect(productsPaging.getByRole('button', { name: 'Next' })).toBeDisabled();
  await page.getByRole('button', { name: 'Products', exact: true }).click(); await page.getByLabel('Inventory category', { exact: true }).selectOption('Food');
  await expect(productsPaging).toContainText('Page 1 of 2'); await expect(productsPaging.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await page.getByLabel('Search inventory', { exact: true }).fill('burger'); await expect(page.locator('.product-table tbody tr')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Products', exact: true })).toHaveAttribute('aria-pressed', 'true'); await expect(page.getByLabel('Inventory category')).toHaveValue('Food');
  await page.getByRole('button', { name: 'Clear search inventory' }).click(); await expect(page.getByLabel('Inventory category')).toHaveValue('Food');
  await page.getByLabel('Search inventory', { exact: true }).fill('Oat Milk'); await expect(page.locator('.filter-summary')).toContainText('No matches in this view/category'); await expect(page.getByRole('region', { name: 'Ingredients; scroll to see all columns', exact: true })).toHaveCount(0);
  await expect(productsPaging).toContainText('0–0 of 0 records'); await expect(productsPaging.getByRole('button', { name: 'Next' })).toBeDisabled();
  for (const [name, sku, unit] of [['Test Hotdog', 'TEST-HOTDOG', 'pcs'], ['Test Rice', 'TEST-RICE', 'g']]) {
    await page.getByRole('button', { name: 'Add Ingredient', exact: true }).click(); await page.getByLabel('Ingredient Name', { exact: true }).fill(name); await page.locator('.generate-field input').first().fill(sku); await page.getByLabel(/^Unit/).selectOption(unit); await page.getByLabel('Quantity', { exact: true }).fill('1000'); await page.getByLabel('Quantity Alert', { exact: true }).fill('5'); await saveRecord(page);
  }
  await page.getByRole('button', { name: 'Add Product', exact: true }).click(); await page.getByLabel('Product Name', { exact: true }).fill('Test Hotdog with Rice'); await page.locator('.generate-field input').first().fill('TEST-MEAL'); await page.getByLabel(/^Category/).selectOption('Food'); await page.getByLabel('Stock model').selectOption({ label: 'Uses ingredients (recipe)' });
  await expect(page.locator('.recipe-editor')).toContainText('No base ingredients yet'); await page.getByLabel('Price', { exact: true }).fill('60');
  for (const [id, quantity] of [['TEST-HOTDOG', '1'], ['TEST-RICE', '150']]) {
    await page.getByRole('button', { name: 'Add ingredient', exact: true }).click(); const row = page.locator('.recipe-editor .recipe-input').last(); await chooseSearch(row.getByLabel('Stock item'), id); await row.getByLabel('Quantity').fill(quantity);
  }
  await saveRecord(page); await expect(page.getByRole('button', { name: 'Edit product Test Hotdog with Rice' })).toBeVisible();
  await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Test Hotdog with Rice to order' }).click(); await pay(page);
  await expect(await stockRow(page, 'Test Rice')).toContainText('850g'); await expect(await stockRow(page, 'Test Hotdog')).toContainText('999pcs');
});

test('Admin can void a paid Pending sale on the last page; paging clamps and consumed stock stays deducted', async ({ page }) => {
  await enter(page, 'Admin');
  for (let index = 0; index < 7; index++) { await burger(page); await pay(page); }
  await expect(await stockRow(page, 'Burger buns')).toContainText('13pcs');
  await nav(page, 'Audit Trail'); await page.getByLabel('Filter sales by date', { exact: true }).fill('2026-10-04'); await page.getByLabel('Order status', { exact: true }).selectOption('Pending'); await page.getByLabel('Search sales', { exact: true }).fill('Hamburger');
  const paging = page.getByRole('navigation', { name: 'Transactions pagination' });
  await expect(paging).toContainText('of 7 records'); await paging.getByRole('button', { name: 'Next' }).click(); await expect(paging).toContainText('Page 2 of 2');
  await page.locator('.history-table tbody tr').first().click(); await page.getByRole('button', { name: 'VOID', exact: true }).click();
  await page.getByRole('button', { name: 'Proceed', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('Alex'); await page.getByRole('button', { name: 'Confirm Void', exact: true }).click(); await page.getByRole('dialog', { name: 'Void this order permanently?' }).getByRole('button', { name: 'Void order', exact: true }).click();
  await expect(paging).toContainText('of 6 records · Page 1 of 1'); await expect(paging.getByRole('button', { name: 'Next' })).toBeDisabled();
  await expect(page.locator('.sale-details')).toContainText('Status: Voided'); await expect(page.locator('.audit-timeline')).toContainText('Alex · Admin');
  await expect(page.getByRole('button', { name: 'Void requests (0)', exact: true })).not.toHaveClass(/attention-required/);
  await expect(await stockRow(page, 'Burger buns')).toContainText('13pcs');
  await nav(page, 'Reports'); await page.getByRole('navigation', { name: 'Stock attention pagination' }).getByRole('button', { name: 'Next', exact: true }).click(); await page.getByRole('region', { name: 'Current stock needs attention', exact: true }).getByRole('button').filter({ hasText: 'Croissant' }).click();
  await expect(page.locator('#stock-FD001')).not.toHaveClass(/active-row/); await expect(page.locator('.batch-row.active-row')).toHaveCount(1);
});

test('Audit row toggle, checkbox summary, per-page selection and linked dashboard paging remain explicit', async ({ page }) => {
  await enter(page); await nav(page, 'POS');
  for (let index = 0; index < 7; index++) { await page.getByRole('button', { name: 'Add Mango Matcha Latte to order' }).click(); await pay(page); }
  await nav(page, 'Audit Trail'); const paging = page.getByRole('navigation', { name: 'Transactions pagination' });
  await expect(page.locator('.history-table tbody tr')).toHaveCount(6); await expect(paging).toContainText('of 18 records'); await expect(paging.getByRole('button', { name: 'Previous' })).toBeDisabled();
  const first = page.locator('.history-table tbody tr').first(); await first.focus(); await page.keyboard.press('Enter'); await expect(first).toBeFocused(); await expect(first).toHaveAttribute('aria-selected', 'true'); await page.keyboard.press('Space'); await expect(page.locator('.cart-empty')).toContainText('Select a transaction');
  await page.getByRole('checkbox', { name: 'Select all eligible orders on this page' }).check(); await expect(page.getByRole('heading', { name: 'Selection summary' })).toBeVisible(); await expect(page.locator('.selection-summary')).toContainText('6 selected orders'); await expect(page.locator('.audit-timeline')).toHaveCount(0);
  await paging.getByRole('button', { name: 'Next', exact: true }).click(); await expect(page.locator('.selection-summary')).toContainText('6 outside the current page'); await expect(page.locator('.selection-notice')).toContainText('IDs:');
  await page.getByRole('button', { name: 'Bulk Void', exact: true }).click(); await expect(page.getByRole('dialog').locator('.bulk-order-list > div')).toHaveCount(6); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click(); await paging.getByRole('button', { name: 'Next', exact: true }).click(); await expect(paging.getByRole('button', { name: 'Next' })).toBeDisabled();
  await page.getByLabel('Search sales', { exact: true }).fill('Alex'); await expect(paging).toContainText('Page 1 of 1'); await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await nav(page, 'Dashboard'); await page.locator('.recent .attention-link').last().click(); await expect(page.locator('.active-row')).toBeVisible(); await expect(page.locator('.sale-details')).toContainText('Order ID:');
});

test('Reports exports include all pages, date changes reset paging, disclose baselines and print every filtered record', async ({ page }) => {
  await enter(page); await nav(page, 'POS'); for (let index = 0; index < 7; index++) { await burger(page); await pay(page); }
  await nav(page, 'Reports'); await page.getByLabel('From', { exact: true }).fill('2026-10-04'); await page.getByLabel('To', { exact: true }).fill('2026-10-04');
  const transactions = page.getByRole('navigation', { name: 'Transactions pagination' }); await expect(transactions).toContainText('of 12 records'); await transactions.getByRole('button', { name: 'Next' }).click(); await expect(transactions).toContainText('Page 2 of 3');
  await expect(page.locator('.ingredient-balances .record-count')).toContainText('13 of 13 balances available'); await expect(page.locator('.balance-track.baseline-unavailable')).toHaveCount(0); await expect(page.locator('.balance-track')).toHaveCount(13); await expect(page.locator('.balance-track[role="progressbar"]')).toHaveCount(0);
  const attention = page.getByRole('region', { name: 'Current stock needs attention', exact: true }); const attentionPaging = page.getByRole('navigation', { name: 'Stock attention pagination' });
  await expect(attention.locator('button.attention-link:visible')).toHaveCount(4); await attentionPaging.getByRole('button', { name: 'Next' }).click(); await expect(attention.locator('button.attention-link:visible')).toHaveCount(4); await attentionPaging.getByRole('button', { name: 'Next' }).click(); await expect(attention.locator('button.attention-link:visible')).toHaveCount(4); await attentionPaging.getByRole('button', { name: 'Next' }).click(); await expect(attention.locator('button.attention-link:visible')).toHaveCount(1); await expect(attentionPaging.getByRole('button', { name: 'Next' })).toBeDisabled();
  await expect(page.locator('.ingredient-balances > article:visible')).toHaveCount(4);
  await page.getByLabel('Export format').selectOption('CSV'); await page.getByRole('button', { name: 'Export report', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('12 orders'); await expect(page.getByRole('dialog')).toContainText('26 transaction-linked ingredient rows');
  for (const [width, height] of [[320, 568], [820, 400]]) {
    await page.setViewportSize({ width, height }); await page.getByRole('dialog').getByRole('button', { name: 'Export', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Export combined report', exact: true })).toBeInViewport(); await expect(page.getByRole('dialog').getByRole('button', { name: 'Close dialog' })).toBeInViewport();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const downloading = page.waitForEvent('download'); await page.getByRole('dialog').getByRole('button', { name: 'Export', exact: true }).click(); const download = await downloading; await mkdir(reviewPath, { recursive: true }); await download.saveAs(`${reviewPath}/all-pages.csv`);
  const csv = await readFile(`${reviewPath}/all-pages.csv`, 'utf8'); expect(csv).toContain('Ingredient usage by transaction'); expect(csv).toContain('2026100400012'); expect(csv).toContain('2026100400018'); expect(csv).toContain('Baseline unavailable');
  await page.emulateMedia({ media: 'print' }); const table = page.getByRole('region', { name: 'Transactions; scroll to see all columns' }); await expect(table.locator('tbody tr:visible')).toHaveCount(12); await expect(attention.locator('button.attention-link:visible')).toHaveCount(13); await expect(page.locator('.ingredient-balances > article:visible')).toHaveCount(13); await expect(page.locator('.ingredient-transaction-table tbody tr:visible')).toHaveCount(26); await page.emulateMedia({ media: 'screen' });
  await expect(page.getByRole('button', { name: 'Clear filters', exact: true })).toHaveCount(0); await page.getByLabel('From', { exact: true }).fill('2026-08-15'); await page.getByLabel('To', { exact: true }).fill('2026-08-21'); await expect(transactions).toContainText('Page 1 of 2');
  await expect(attentionPaging).toContainText('Page 1 of 4'); await expect(attention.locator('button.attention-link:visible')).toHaveCount(4); await expect(page.getByLabel('Export format')).toHaveValue('CSV');
});

test('priority controls and calendar remain readable on desktop, tablet, phone and short screens', async ({ page }) => {
  await enter(page); await mkdir(reviewPath, { recursive: true }); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const [width, height] of [[1440, 900], [820, 1180], [390, 844], [320, 568], [820, 400]]) {
    await page.setViewportSize({ width, height });
    for (const name of ['Dashboard', 'Inventory', 'Audit Trail', 'Reports']) {
      await nav(page, name); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (name === 'Reports') expect(await page.locator('.ingredient-transaction-table th').evaluateAll(headers => headers.filter(header => header.scrollWidth > header.clientWidth).map(header => header.textContent))).toEqual([]);
      expect(await page.locator('.workspace-main').evaluate(main => [...main.querySelectorAll('button, select, input')].filter(element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0 && (box.height < 44 || parseFloat(getComputedStyle(element).fontSize) < 12); }).map(element => element.getAttribute('aria-label') || element.textContent))).toEqual([]);
      await page.screenshot({ path: `${reviewPath}/${name.replaceAll(' ', '-')}-${width}-${height}.png`, fullPage: true });
      await expect(page.locator('.workspace-main')).not.toContainText('Shift overview');
    }
    await page.getByRole('button', { name: 'Open from calendar' }).click(); await expect(page.locator('.calendar-icon').first()).toBeVisible(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await expect(page.getByRole('button', { name: 'Open from calendar' })).toBeFocused(); await page.getByLabel('From', { exact: true }).fill('2026-08-15');
  }
  expect(errors).toEqual([]);
});
