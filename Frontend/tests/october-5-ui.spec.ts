import { chooseSearch } from './fixtures/search-select';
import { saveRecord } from './fixtures/save-record';
import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDemoData } from '../src/data/demo';
import { removalQuantity, stockKind, usableQuantity } from '../src/data/inventory';
import { stockCondition } from '../src/data/reporting';

const output = fileURLToPath(new URL('../../../.review/frontend/october-15/regression-october5/', import.meta.url));
async function enter(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-04T17:00:00Z')); await page.goto('/');
  await page.getByRole('button', { name: 'Open preview', exact: true }).click();
}
async function nav(page: Page, name: string) {
  if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
}

test('current catalogue separates removal first, products and urgency-sorted ingredients across every page', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory');
  await page.getByRole('button', { name: 'All inventory', exact: true }).click();
  await page.getByLabel('Inventory category').selectOption('All');
  await expect(page.locator('.inventory-section-title')).toHaveText(['Needed to Remove Stocks', 'Products', 'Ingredients']);
  const seed = createDemoData();
  const removal = page.getByRole('region', { name: 'Needed to Remove Stocks; scroll to see all columns', exact: true });
  for (const item of seed.stock.filter(item => removalQuantity(item) > 0)) await expect(removal.locator(`#stock-${item.id}`)).toContainText(`${removalQuantity(item)}${item.unit}`);
  const ingredients = page.getByRole('region', { name: 'Ingredients; scroll to see all columns', exact: true });
  const ids: string[] = [], priorities: number[] = [];
  while (true) {
    for (const row of await ingredients.locator('tbody tr:not(.batch-row)').all()) {
      const id = (await row.getAttribute('id'))!.replace(/^(usable-)?stock-/, ''); ids.push(id);
      const item = seed.stock.find(item => item.id === id)!; expect(stockKind(item)).toBe('Ingredient');
      expect(usableQuantity(item) > 0 || item.quantity === 0).toBeTruthy();
      const condition = stockCondition(item); priorities.push(condition === 'Expiring Soon' ? 0 : /Low|Out/.test(condition) ? 1 : 2);
    }
    const next = page.getByRole('navigation', { name: 'Ingredients pagination' }).getByRole('button', { name: 'Next', exact: true });
    if (await next.isDisabled()) break; await next.click();
  }
  expect(new Set(ids).size).toBe(seed.stock.filter(item => stockKind(item) === 'Ingredient' && (usableQuantity(item) > 0 || item.quantity === 0)).length);
  expect(priorities).toEqual([...priorities].sort());
  await page.getByRole('button', { name: 'Modifier groups', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Modifier groups', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Products', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('batch quantities edit independently and reject negative physical counts while preserving expiry', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory'); await page.getByRole('button', { name: 'All inventory', exact: true }).click();
  await page.getByLabel('Inventory category').selectOption('All'); await page.getByLabel('Search inventory', { exact: true }).fill('FD001');
  await page.locator('#stock-FD001').getByRole('button', { name: 'Edit Butter Cookie Pouch', exact: true }).click();
  await chooseSearch(page.getByLabel('Receipt batch to edit'), 'butter-cookie-2');
  await page.getByLabel('Quantity', { exact: true }).fill('-1'); await saveRecord(page);
  expect(await page.getByLabel('Quantity', { exact: true }).evaluate((field: HTMLInputElement) => field.validity.rangeUnderflow)).toBe(true);
  await page.getByLabel('Quantity', { exact: true }).fill('4'); await saveRecord(page);
  await expect(page.locator('#stock-butter-cookie-1')).toContainText('6pcs'); await expect(page.locator('#stock-butter-cookie-1')).toContainText('Expired');
  await expect(page.locator('#usable-stock-butter-cookie-2')).toContainText('4pcs');
  await page.locator('#stock-FD001').getByRole('button', { name: 'Edit Butter Cookie Pouch', exact: true }).click();
  await expect(page.locator('.add-product')).toContainText('Last edited by'); await expect(page.locator('main')).not.toContainText('Manila');
});

test('saved library dates and Staff receipt dates retain the local business date without a timezone suffix', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory');
  await page.getByRole('button', { name: 'Modifier groups', exact: true }).click();
  await page.getByRole('button', { name: 'Add library group', exact: true }).click();
  await page.getByLabel('Group name', { exact: true }).fill('Date-label review');
  await page.getByRole('button', { name: 'Add option', exact: true }).click();
  await page.getByLabel('Option name', { exact: true }).fill('Gift sleeve');
  await page.getByRole('button', { name: 'Save group', exact: true }).click();
  const group = page.getByRole('article', { name: 'Date-label review library group', exact: true });
  await expect(group).toContainText('Oct 5, 2026, 1:00 AM');
  await expect(group).not.toContainText('Manila');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByLabel('Preview role').selectOption('Staff'); await page.getByLabel('Preview person').selectOption('raven');
  await page.getByRole('button', { name: 'Open preview', exact: true }).click();
  await nav(page, 'Today’s Sales History'); await page.locator('.history-table tbody tr').first().click();
  await expect(page.locator('main')).toContainText('2026-10-05');
  await expect(page.locator('.sale-details')).toContainText('Oct 5, 2026');
  await expect(page.locator('main')).not.toContainText('Manila');
});

for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 820, 1180], ['phone', 390, 844], ['small', 320, 568], ['short', 820, 400]] as const) {
  test(`${name} current Reports, export summary, Inventory and modifiers remain readable and contained`, async ({ page }) => {
    test.setTimeout(60000); await page.setViewportSize({ width, height }); await enter(page); await mkdir(output, { recursive: true });
    const errors: string[] = [], checks: unknown[] = [];
    page.on('pageerror', error => errors.push(error.message));
    async function capture(state: string) {
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        dialogOverflow: [...document.querySelectorAll('dialog[open]')].some(e => e.scrollWidth > e.clientWidth),
        smallText: [...document.querySelectorAll('.workspace-main th, .workspace-main td, .workspace-main h2')].filter(e => e.getBoundingClientRect().height && parseFloat(getComputedStyle(e).fontSize) < 12).map(e => e.textContent),
        smallControls: [...document.querySelectorAll('.workspace-main button, .workspace-main input:not([type=checkbox]), .workspace-main select')].filter(e => e.getBoundingClientRect().height && e.getBoundingClientRect().height < 44).map(e => e.getAttribute('aria-label') || e.textContent),
      }));
      checks.push({ state, ...geometry }); expect(geometry).toEqual({ overflow: false, dialogOverflow: false, smallText: [], smallControls: [] });
      await expect(page.locator('main')).not.toContainText('Manila');
      if (!await page.locator('dialog[open]').count()) await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${output}/${name}-${state}.png`, fullPage: !await page.locator('dialog[open]').count(), animations: 'disabled' });
    }
    await capture('dashboard'); await page.getByRole('button', { name: 'Review daily sales', exact: true }).click(); await capture('daily-review'); await page.keyboard.press('Escape');
    await nav(page, 'Inventory'); await page.getByRole('button', { name: 'All inventory', exact: true }).click(); await page.getByLabel('Inventory category').selectOption('All');
    if (width >= 1200) {
      const bottoms = await page.locator('.inventory-controls').evaluate(e => [...e.querySelectorAll('.tabs button, .modifier-destination, select, input[type=search]')].map(control => control.getBoundingClientRect().bottom));
      expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(2);
    }
    await capture('inventory'); await page.getByRole('button', { name: 'Add Product', exact: true }).click();
    await page.getByRole('button', { name: 'Add modifier group', exact: true }).click(); await page.getByRole('button', { name: 'Add option', exact: true }).click();
    const colors = await page.locator('.modifier-editor').evaluate(e => ({ parent: getComputedStyle(e).backgroundColor, group: getComputedStyle(e.querySelector('fieldset')!).backgroundColor }));
    expect(colors.parent).not.toBe(colors.group); await capture('modifiers');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await nav(page, 'Audit Trail'); await page.getByLabel('Filter sales by date', { exact: true }).fill('2026-10-05');
    await page.locator('.history-table tbody tr').first().click(); await capture('audit-details');
    await nav(page, 'Reports'); await page.getByLabel('To', { exact: true }).fill('2026-10-05'); await page.getByLabel('From', { exact: true }).fill('2026-08-01'); await capture('reports');
    const readability = await page.locator('.reports').evaluate(root => {
      const splitText: string[] = [], clippedCells: string[] = [];
      for (const cell of root.querySelectorAll('.report-table th, .report-table td')) {
        if (!cell.getBoundingClientRect().height) continue;
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          // Headers can wrap between words; quantities/prices only at explicit newlines.
          const pieces = cell.tagName === 'TH' ? /\S+/g : cell.classList.contains('numeric-cell') ? /[^\n]+/g : /\p{L}{1,24}/gu;
          for (const match of (node.textContent ?? '').matchAll(pieces)) {
            const range = document.createRange(); range.setStart(node, match.index!); range.setEnd(node, match.index! + match[0].length);
            if (new Set([...range.getClientRects()].map(rect => Math.round(rect.y))).size > 1) splitText.push(match[0]);
          }
        }
        if (cell.scrollWidth > cell.clientWidth + 1) clippedCells.push(cell.textContent ?? '');
      }
      const subtitle = root.querySelector('.report-summary > div:first-child small')!;
      const luminance = (color: string) => {
        const [r, g, b] = color.match(/\d+/g)!.slice(0, 3).map(Number).map(value => {
          const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return r * 0.2126 + g * 0.7152 + b * 0.0722;
      };
      const text = luminance(getComputedStyle(subtitle).color), background = luminance(getComputedStyle(subtitle.parentElement!).backgroundColor);
      return { splitText, clippedCells, subtitleContrast: (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05) };
    });
    expect(readability.splitText).toEqual([]); expect(readability.clippedCells).toEqual([]); expect(readability.subtitleContrast).toBeGreaterThanOrEqual(4.5);
    checks.push({ state: 'report-readability', ...readability });
    for (const [index, table] of (await page.locator('.report-data-section .table-wrap').all()).entries()) {
      await table.evaluate(e => { e.scrollLeft = e.scrollWidth; });
      await table.screenshot({ path: `${output}/${name}-report-columns-${index + 1}.png`, animations: 'disabled' });
      await table.evaluate(e => { e.scrollLeft = 0; });
    }
    for (const scope of ['Combined', 'Sales', 'Inventory usage']) {
      await page.getByLabel('Report scope').selectOption(scope); await page.getByRole('button', { name: 'Export report' }).click();
      await expect(page.getByRole('dialog').getByRole('button', { name: 'Download PDF', exact: true })).toBeInViewport();
      await page.getByRole('dialog').locator('.modal-body').evaluate(e => { e.scrollTop = e.scrollHeight; });
      await expect(page.getByRole('dialog').getByRole('heading', { name: /^Export/ })).toBeInViewport();
      await expect(page.getByRole('dialog').getByRole('button', { name: 'Download PDF', exact: true })).toBeInViewport();
      await page.getByRole('dialog').locator('.modal-body').evaluate(e => { e.scrollTop = 0; });
      await capture(`export-${scope.toLowerCase().replaceAll(' ', '-')}`);
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    }
    expect(errors).toEqual([]); await writeFile(`${output}/${name}-checks.json`, JSON.stringify({ errors, checks }, null, 2));
  });
}
