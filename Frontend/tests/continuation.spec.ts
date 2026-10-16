import { saveRecord } from './fixtures/save-record';
import { test, expect } from './fixtures/legacy-preview';
import type { Page } from '@playwright/test';

async function enter(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-03T17:00:00Z'));
  await page.goto('/'); await page.getByRole('button', { name: 'Open preview' }).click();
}
async function nav(page: Page, name: string) {
  if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
  if (name === 'Inventory') { await page.getByRole('button', { name: 'All inventory', exact: true }).click(); await page.getByLabel('Inventory category', { exact: true }).selectOption('All'); }
}
async function editBurger(page: Page) {
  await nav(page, 'Inventory');
  await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('Hamburger');
  await page.getByRole('button', { name: 'Edit product Hamburger', exact: true }).click();
}

test('unsaved inventory edits survive cancelled sidebar navigation and discard only after confirmation', async ({ page }) => {
  await enter(page); await editBurger(page);
  await page.getByLabel('Product Name', { exact: true }).fill('Burger draft');
  await nav(page, 'Reports');
  const dialog = page.getByRole('dialog', { name: 'Discard inventory edits?' });
  await expect(dialog).toBeVisible(); await expect(page.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Product Name', { exact: true })).toHaveValue('Burger draft');
  await nav(page, 'Reports'); await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
  await editBurger(page); await expect(page.getByLabel('Product Name', { exact: true })).toHaveValue('Hamburger');
});

test('mobile logout and editor back actions share a safe discard flow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await enter(page); await editBurger(page);
  await page.getByRole('button', { name: 'Add modifier group', exact: true }).click();
  await page.getByRole('button', { name: 'Back to Inventory', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.locator('.modifier-editor fieldset')).toHaveCount(2);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Discard inventory edits?' })).toBeVisible();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page.getByRole('button', { name: 'Open preview' })).toBeVisible();
});

test('saving keeps the record category independent of filters and clears the navigation warning', async ({ page }) => {
  await enter(page); await editBurger(page);
  await expect(page.getByRole('combobox', { name: /^Category/ })).toHaveValue('Food');
  await page.getByLabel('Product Name', { exact: true }).fill('Hamburger updated');
  await saveRecord(page);
  await expect(page.getByLabel('Inventory category', { exact: true })).toHaveValue('Food');
  await nav(page, 'Reports'); await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Discard inventory edits?' })).toHaveCount(0);
  await nav(page, 'Inventory'); await page.getByLabel('Search inventory', { exact: true }).fill('Hamburger updated'); await page.getByRole('button', { name: 'Edit product Hamburger updated', exact: true }).click();
  await expect(page.getByRole('combobox', { name: /^Category/ })).toHaveValue('Food');
});

test('calendar selections mark the editor dirty and refresh prompts protect unsaved edits', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory'); await page.getByRole('button', { name: 'Add Ingredient', exact: true }).click();
  await page.getByRole('button', { name: 'Open manufactured date calendar', exact: true }).click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByLabel('Manufactured Date', { exact: true })).toHaveValue('2026-10-04');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Discard inventory edits?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  const dismissed = page.waitForEvent('dialog').then(async dialog => { expect(dialog.type()).toBe('beforeunload'); await dialog.dismiss(); });
  await Promise.all([page.reload({ timeout: 2000 }).catch(() => {}), dismissed]);
  await expect(page.getByLabel('Manufactured Date', { exact: true })).toHaveValue('2026-10-04');
});

test('calendar Escape dismisses only the calendar inside a native receiving dialog', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 400 }); await enter(page); await nav(page, 'Inventory');
  await page.getByRole('button', { name: 'Add stock to Oat Milk', exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Open new manufacturing date calendar', exact: true });
  await trigger.click(); await expect(page.getByRole('dialog', { name: 'New Manufacturing Date calendar' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await expect(page.getByRole('dialog', { name: 'New Manufacturing Date calendar' })).toBeHidden();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await page.setViewportSize({ width: 820, height: 1180 });
  await trigger.click(); await page.getByLabel('Quantity Added', { exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'New Manufacturing Date calendar' })).toBeHidden();
  await expect(page.getByLabel('Quantity Added', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('calendar keyboard and month controls stay within report range and preserve month-end dates', async ({ page }) => {
  await enter(page); await nav(page, 'Reports');
  await page.getByLabel('From', { exact: true }).fill('2026-08-21');
  const toTrigger = page.getByRole('button', { name: 'Open to calendar', exact: true });
  await toTrigger.click(); const toCalendar = page.getByRole('dialog', { name: 'To calendar', exact: true });
  await expect(toCalendar.locator('[data-date="2026-08-21"]')).toBeFocused();
  await page.keyboard.press('ArrowLeft'); await expect(toCalendar.locator('[data-date="2026-08-21"]')).toBeFocused();
  await page.keyboard.press('Home'); await expect(toCalendar.locator('[data-date="2026-08-21"]')).toBeFocused();
  await expect(toCalendar.getByRole('button', { name: 'Previous month' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open from calendar', exact: true }).click();
  const fromCalendar = page.getByRole('dialog', { name: 'From calendar', exact: true });
  await page.keyboard.press('ArrowRight'); await expect(fromCalendar.locator('[data-date="2026-08-21"]')).toBeFocused();
  await expect(fromCalendar.getByRole('button', { name: 'Next month' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByLabel('To', { exact: true }).fill('2026-01-31');
  await page.getByLabel('From', { exact: true }).fill('2026-01-01');
  await toTrigger.click(); await page.keyboard.press('PageDown');
  await expect(toCalendar.locator('[data-date="2026-02-28"]')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.getByLabel('To', { exact: true })).toHaveValue('2026-02-28');
});

test('stock unit editing converts displayed quantity, batches and reorder threshold together', async ({ page }) => {
  await enter(page); await nav(page, 'Inventory');
  await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('Onions');
  await page.getByRole('button', { name: 'Edit Onions', exact: true }).click();
  await page.getByRole('combobox', { name: /^Unit/ }).selectOption('kg');
  await expect(page.locator('input[name="quantity"]')).toHaveValue('0.5');
  await expect(page.getByLabel('Quantity Alert', { exact: true })).toHaveValue('0.1');
  await saveRecord(page);
  await expect(page.getByRole('region', { name: 'Ingredients; scroll to see all columns', exact: true })).toContainText('0.5kg');
  await expect(page.getByRole('region', { name: 'Ingredients; scroll to see all columns', exact: true })).toContainText('In Stock');
  await page.getByRole('button', { name: 'Edit Onions', exact: true }).click();
  await expect(page.getByLabel('Quantity Alert', { exact: true })).toHaveValue('0.1');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByLabel('Inventory category', { exact: true }).selectOption('Beverage'); await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('Oat Milk');
  await page.getByRole('button', { name: 'Edit Oat Milk', exact: true }).click();
  await page.getByRole('combobox', { name: /^Unit/ }).selectOption('ml');
  await expect(page.locator('input[name="quantity"]')).toHaveValue('12000');
  await expect(page.getByLabel('Quantity Alert', { exact: true })).toHaveValue('5000');
  await saveRecord(page);
  await expect(page.getByRole('region', { name: 'Ingredients; scroll to see all columns', exact: true })).toContainText('32000ml');
  await expect(page.getByRole('region', { name: 'Ingredients; scroll to see all columns', exact: true })).toContainText('12000ml');
  await expect(page.getByRole('region', { name: 'Ingredients; scroll to see all columns', exact: true })).toContainText('20000ml');
});
