import { test, expect } from './fixtures/legacy-preview';
import type { Page } from '@playwright/test';

async function enter(page: Page, role = 'Owner') {
  await page.goto('/');
  await page.getByLabel('Preview role').selectOption(role);
  await page.getByRole('button', { name: 'Open preview' }).click();
}

for (const width of [320, 390, 768, 820, 1024]) {
  test(`navigation drawer contains focus, dismisses and restores focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    await enter(page);
    const trigger = page.locator(width < 768 ? '.mobile-topbar button' : '.rail-menu');
    const drawer = page.getByRole('dialog', { name: 'Navigation' });
    await expect(trigger).toHaveAttribute('aria-controls', 'navigation-drawer');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer.getByRole('button', { name: 'Close navigation' })).toBeFocused();
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
    // Even scripted focus cannot move into the background of a modal drawer.
    await page.locator('.dashboard-tabs button').first().evaluate(button => (button as HTMLElement).focus());
    expect(await drawer.evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Shift+Tab');
    await expect(drawer.getByRole('button', { name: 'Log out' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(drawer.getByRole('button', { name: 'Close navigation' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
    await trigger.click();
    await page.mouse.click(width - 8, 100);
    await expect(drawer).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await drawer.getByRole('button', { name: 'Inventory', exact: true }).click();
    await expect(drawer).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(drawer.getByRole('button', { name: 'Inventory', exact: true })).toHaveAttribute('aria-current', 'page');
    for (const button of await drawer.getByRole('button').all()) {
      const box = await button.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await drawer.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('button', { name: 'Open preview' })).toBeVisible();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  });
}

test('open drawers close across breakpoints without stale modality or scroll locks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  for (const width of [768, 767, 1199, 1200, 1440, 1199, 390]) {
    const trigger = page.getByRole('button', { name: 'Open navigation', exact: true });
    if (await trigger.isVisible()) await trigger.click();
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('dialog', { name: 'Navigation' })).not.toBeVisible();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
    if (width < 768) await expect(page.locator('.mobile-topbar')).toBeVisible();
    else await expect(page.getByRole('navigation')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => !document.activeElement?.closest('dialog'))).toBe(true);
  }
});

test('tablet rail exposes keyboard tooltips and returns focus to the account opener', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await enter(page, 'Staff');
  const rail = page.getByRole('navigation', { name: 'Quick navigation' });
  await expect(rail.getByRole('button')).toHaveCount(2);
  const history = rail.getByRole('button', { name: 'Today’s Sales History' });
  await page.keyboard.press('Tab');
  await history.focus();
  await expect(history.locator('.nav-tooltip')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(history).toHaveAttribute('aria-current', 'page');
  const account = page.getByRole('button', { name: /Account: Raven/ });
  await account.click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button')).toHaveCount(2);
  await page.getByRole('button', { name: 'Close navigation' }).click();
  await expect(account).toBeFocused();
});

test('drawer stays scrollable on short screens and cart survives all owner destinations', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 400 });
  await enter(page);
  const trigger = page.getByRole('button', { name: 'Open navigation', exact: true });
  const drawer = page.getByRole('dialog', { name: 'Navigation' });
  async function navigate(name: string) {
    await trigger.click();
    await drawer.getByRole('button', { name, exact: true }).click();
  }
  await navigate('POS');
  await page.getByRole('button', { name: 'Add Mango Matcha Latte to order', exact: true }).click();
  for (const name of ['Dashboard', 'Inventory', 'Reports', 'Audit Trail', 'Users', 'POS']) await navigate(name);
  await expect(page.locator('.total-row')).toContainText('75.00');
  await trigger.click();
  await drawer.getByRole('button', { name: 'Log out' }).focus();
  expect(await drawer.evaluate(dialog => dialog.scrollTop)).toBeGreaterThan(0);
  const box = await drawer.getByRole('button', { name: 'Log out' }).boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(400);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Pay', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('84.00');
});
