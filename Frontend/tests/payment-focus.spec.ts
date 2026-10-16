import { test, expect } from './fixtures/legacy-preview';

for (const role of ['Owner', 'Admin', 'Staff']) {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 820, height: 400 },
    { width: 320, height: 568 },
  ]) {
    test(`${role} checkout retains keyboard focus at ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page.getByLabel('Preview role').selectOption(role);
      await page.getByRole('button', { name: 'Open preview', exact: true }).click();
      if (role !== 'Staff') {
        if (viewport.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
        await page.getByRole('navigation', { name: viewport.width >= 768 && viewport.width < 1200 ? 'Quick navigation' : 'Main navigation' })
          .getByRole('button', { name: 'POS', exact: true }).click();
      }
      await page.getByRole('button', { name: 'Add Mango Matcha Latte to order', exact: true }).click();
      const pay = page.getByRole('button', { name: 'Pay', exact: true });
      const checkHeader = async () => {
        const header = await page.locator('dialog[open] .modal-header').boundingBox();
        expect(header!.y).toBeGreaterThanOrEqual(0);
        expect(header!.y + header!.height).toBeLessThanOrEqual(viewport.height);
        const close = await page.getByRole('button', { name: 'Close dialog', exact: true }).boundingBox();
        expect(close!.y).toBeGreaterThanOrEqual(header!.y);
        expect(close!.y + close!.height).toBeLessThanOrEqual(header!.y + header!.height);
      };
      await pay.focus();
      await page.keyboard.press('Enter');
      const cash = page.getByRole('button', { name: 'CASH PAYMENT', exact: true });
      await expect(cash).toBeFocused();
      await checkHeader();
      await page.keyboard.press('Enter');
      await expect(page.getByLabel('Amount Given:')).toBeFocused();
      await checkHeader();
      await page.getByLabel('Amount Given:').fill('100');
      await page.getByRole('button', { name: 'Cancel', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(cash).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'QR PH', exact: true })).toBeFocused();
      await page.keyboard.press('Enter');
      const reference = page.getByLabel('GCash reference number');
      await expect(reference).toBeFocused();
      await checkHeader();
      await reference.fill('1234567890123');
      await page.keyboard.press('Tab');
      await expect(page.getByLabel('Amount received')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(cash).toBeFocused();
      await checkHeader();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await expect(reference).toBeFocused();
      await expect(reference).toHaveValue('');
      const box = await reference.boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(pay).toBeFocused();
      await expect(page.getByLabel('Mango Matcha Latte quantity')).toHaveText('1');
      await expect(page.locator('.toast')).toHaveCount(0);
    });
  }
}
