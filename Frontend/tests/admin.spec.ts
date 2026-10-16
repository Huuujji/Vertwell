import { test, expect } from './fixtures/legacy-preview';
import type { Page } from '@playwright/test';

async function navigate(page: Page, name: string) {
  const width = page.viewportSize()!.width;
  if (width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation', { name: width < 1200 && width >= 768 ? 'Quick navigation' : 'Main navigation' })
    .getByRole('button', { name, exact: true }).click();
}

test('admin pages retain readable text, touch controls and contained tables across sizes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open preview' }).click();
  for (const width of [320, 820, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const name of ['Dashboard', 'Inventory', 'POS', 'Audit Trail', 'Users', 'Reports']) {
      await navigate(page, name);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const failures = await page.locator('.workspace-main').evaluate(main => {
        const controls = [...main.querySelectorAll('button, input, select')].filter(element => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && box.height < 44;
        });
        const text = [...main.querySelectorAll('h1, th, td')].filter(element => parseFloat(getComputedStyle(element).fontSize) < 12);
        return [...controls, ...text].map(element => element.getAttribute('aria-label') || element.textContent);
      });
      expect(failures, `${name} at ${width}px`).toEqual([]);
      if (name === 'Inventory') {
        const wrapper = page.getByRole('region', { name: 'Ingredients; scroll to see all columns', exact: true });
        // Actions stay on one line; wide tables scroll inside their own region.
        expect(await wrapper.evaluate(element => getComputedStyle(element).overflowX)).toBe('auto');
        await wrapper.evaluate(element => { element.scrollLeft = element.scrollWidth; });
        await expect(page.getByRole('button', { name: 'Add stock to Oat Milk', exact: true })).toBeVisible();
      }
    }
  }
});

test('admin dialogs keep fields readable and keyboard actions reachable on short screens', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 400 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open preview' }).click();
  await navigate(page, 'Users');
  const opener = page.getByRole('button', { name: 'Add User', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Add New User' });
  await expect(page.getByLabel('Full Name')).toBeFocused();
  await page.getByLabel('Full Name').fill('Tablet User');
  await page.getByLabel('Username', { exact: true }).fill('tablet.user');
  await page.getByRole('button', { name: 'Next', exact: true }).focus();
  const box = await page.getByRole('button', { name: 'Next', exact: true }).boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(400);
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Email Address')).toBeFocused();
  await expect(page.getByLabel('Email Address')).toHaveCSS('font-size', '14px');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('shared POS and history use each role’s scoped presentation after role switching', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open preview' }).click();
  await navigate(page, 'POS');
  await expect(page.getByLabel('Search items', { exact: true })).toHaveCSS('font-size', '14px');
  await expect(page.locator('.cart-empty')).toBeVisible();
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByLabel('Preview role').selectOption('Staff');
  await page.getByRole('button', { name: 'Open preview' }).click();
  await expect(page.locator('.admin-workspace')).toHaveCount(0);
  await expect(page.locator('.staff-workspace')).toHaveCount(1);
  await expect(page.locator('.staff-payment-note')).toContainText('Pending');
  await expect(page.getByLabel('Search items', { exact: true })).toHaveCSS('font-size', '14px');
  await expect(page.locator('.cart-empty')).toBeVisible();
  await navigate(page, 'Today’s Sales History');
  await expect(page.getByRole('heading', { name: 'Sales History', exact: true })).toBeVisible();
  await expect(page.locator('.cart-empty')).toBeVisible();
});
