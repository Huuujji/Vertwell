import { expect, test, type Page } from '@playwright/test';

async function nav(page: Page, name: string) {
  if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
}

const sizes = [
  { name: 'desktop', width: 1440, height: 900, action: 'Enter' },
  { name: 'short tablet', width: 820, height: 400, action: 'Space' },
  { name: 'small phone', width: 320, height: 568, action: 'click' },
];

for (const role of ['Owner', 'Admin', 'Staff']) for (const size of sizes) {
  test(`${role} clear search returns focus and accepts immediate typing on ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.clock.setFixedTime(new Date('2026-10-03T17:00:00Z'));
    await page.goto('/');
    await page.getByLabel('Preview role').selectOption(role);
    await page.getByRole('button', { name: 'Open preview', exact: true }).click();

    async function clear(label: string, results?: string) {
      const input = page.getByRole('searchbox', { name: label, exact: true });
      const count = results ? await page.locator(results).count() : undefined;
      await input.fill('zzzz-no-match');
      if (results) await expect(page.locator(results)).toHaveCount(0);
      const button = page.getByRole('button', { name: `Clear ${label.toLowerCase()}`, exact: true });
      if (size.action === 'click') await button.click();
      else {
        await input.focus();
        await page.keyboard.press('Tab');
        await expect(button).toBeFocused();
        await page.keyboard.press(size.action);
      }
      await expect(input).toBeFocused();
      await expect(input).toHaveValue('');
      await expect(button).toHaveCount(0);
      if (results) await expect(page.locator(results)).toHaveCount(count!);
      await expect.poll(() => input.evaluate(element => {
        const box = element.getBoundingClientRect();
        const topbar = document.querySelector('.mobile-topbar')?.getBoundingClientRect();
        return box.top >= Math.max(0, topbar?.bottom ?? 0) && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth;
      })).toBe(true);
      await expect(input.locator('..')).toHaveCSS('outline-style', 'solid');
      await page.keyboard.type('x');
      await expect(input).toHaveValue('x');
      // Clearing again proves the ref survives the conditional button's remount.
      await page.getByRole('button', { name: `Clear ${label.toLowerCase()}`, exact: true }).click();
      await expect(input).toBeFocused();
      await expect(input).toHaveValue('');
      await expect(input).toBeInViewport();
    }

    await nav(page, 'POS');
    await clear('Search items', '.product-card');
    await page.getByRole('button', { name: 'Hobby Items', exact: true }).click();
    await clear('Search items', '.product-card');
    await expect(page.getByRole('button', { name: 'Hobby Items', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await nav(page, role === 'Staff' ? 'Today’s Sales History' : 'Audit Trail');
    await clear('Search sales', '.history-table tbody tr');

    if (role !== 'Staff') {
      await nav(page, 'Inventory');
      await page.getByRole('button', { name: 'Products', exact: true }).click();
      await clear('Search inventory');
      await expect(page.getByRole('button', { name: 'Products', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: 'Modifier groups', exact: true }).click();
      await clear('Search modifier groups');
      await nav(page, 'Users');
      await page.getByRole('combobox', { name: 'Account role', exact: true }).selectOption('Staff');
      await clear('Search users', '.user-row');
      await expect(page.getByRole('combobox', { name: 'Account role', exact: true })).toHaveValue('Staff');
    } else {
      await expect(page.getByRole('navigation').getByRole('button', { name: 'Inventory', exact: true })).toHaveCount(0);
      await expect(page.getByRole('navigation').getByRole('button', { name: 'Users', exact: true })).toHaveCount(0);
    }
  });
}
