import { saveRecord } from './fixtures/save-record';
import { test, expect } from './fixtures/legacy-preview';
import type { Page } from '@playwright/test';
import { copyModifierGroup, modifierError } from '../src/data/modifiers';
import { initialStock, products } from './fixtures/legacy-demo';

async function enter(page: Page, role = 'Owner') {
  await page.clock.setFixedTime(new Date('2026-10-03T17:00:00Z'));
  await page.goto('/'); await page.getByLabel('Preview role').selectOption(role); await page.getByRole('button', { name: 'Open preview', exact: true }).click();
}
async function nav(page: Page, name: string) {
  if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
  if (name === 'Inventory') { await page.getByRole('button', { name: 'All inventory', exact: true }).click(); await page.getByLabel('Inventory category', { exact: true }).selectOption('All'); }
}
async function burger(page: Page) {
  await nav(page, 'Inventory'); await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('Hamburger');
  await page.getByRole('button', { name: 'Edit product Hamburger', exact: true }).click();
}
async function seedLibrary(page: Page) {
  await burger(page); await page.getByRole('checkbox', { name: 'Select Extra cheese by default', exact: true }).check();
  await page.getByRole('button', { name: 'Save copy to library', exact: true }).click();
  await saveRecord(page);
}
async function library(page: Page) {
  await nav(page, 'Inventory'); await page.getByRole('button', { name: 'Modifier groups', exact: true }).click();
}
async function customize(page: Page) { await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Hamburger to order', exact: true }).click(); }

test('library copies own IDs and inputs; defaults respect choice limits and stock units', () => {
  const source = structuredClone(products.find(product => product.id === 'BURGER')!.modifiers![0]);
  const first = copyModifierGroup(source), second = copyModifierGroup(source);
  expect(first.id).not.toBe(source.id); expect(first.id).not.toBe(second.id);
  expect(first.options[0].id).not.toBe(second.options[0].id);
  first.options[0].inputs[0].quantity = 9; expect(source.options[0].inputs[0].quantity).toBe(1);
  source.max = 1; source.options.forEach(option => { option.defaultSelected = true; });
  expect(modifierError(source, initialStock)).toContain('Default selections');
  source.max = 2; source.min = 2; source.options[1].defaultSelected = false;
  expect(modifierError(source, initialStock)).toContain('Default selections');
  source.options[0].defaultSelected = false; expect(modifierError(source, initialStock)).toBeUndefined();
  source.options[0].inputs[0].unit = 'kg'; expect(modifierError(source, initialStock)).toContain('stock units');
});

test('Admin creates a reusable group, validates defaults and duplicate names, and searches option names', async ({ page }) => {
  await enter(page, 'Admin'); await library(page); await page.getByRole('button', { name: 'Add library group' }).click();
  await expect(page.getByLabel('Group name', { exact: true })).toBeFocused();
  await page.getByLabel('Group name', { exact: true }).fill('Packaging');
  for (const name of ['Sleeve', 'Gift wrap']) {
    await page.getByRole('button', { name: 'Add option', exact: true }).click();
    await page.getByLabel('Option name', { exact: true }).last().fill(name);
    await page.getByRole('checkbox', { name: `Select ${name} by default`, exact: true }).check();
  }
  await page.getByRole('button', { name: 'Save group', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Default selections');
  await page.getByRole('checkbox', { name: 'Select Gift wrap by default' }).uncheck();
  await page.getByRole('button', { name: 'Save group', exact: true }).click();
  await expect(page.getByRole('article')).toContainText('Alex (Admin)');
  await page.getByRole('searchbox', { name: 'Search modifier groups' }).fill('gIfT');
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Add library group' }).click();
  await page.getByLabel('Group name', { exact: true }).fill(' PACKAGING ');
  await page.getByRole('button', { name: 'Add option', exact: true }).click(); await page.getByLabel('Option name', { exact: true }).fill('Option');
  await page.getByRole('button', { name: 'Save group', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('already exists');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('Card Pack');
  await page.getByRole('button', { name: 'Edit product Card Pack', exact: true }).click();
  // Card Pack already links a finished SKU; stock is received from its inventory row.
  await page.getByText('Reuse a library group', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Library group', exact: true }).selectOption({ label: 'Packaging' });
  await page.getByRole('button', { name: 'Attach group to product', exact: true }).click(); await saveRecord(page);
  await nav(page, 'POS'); await page.getByRole('button', { name: 'Add Card Pack to order', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Sleeve/ })).toBeChecked(); await expect(page.getByRole('checkbox', { name: /Gift wrap/ })).not.toBeChecked();
});

test('library edits and removal preserve product copies, default price and historical stock snapshots', async ({ page }) => {
  await enter(page); await seedLibrary(page);
  await customize(page); await expect(page.getByRole('checkbox', { name: /Extra cheese/ })).toBeChecked();
  await expect(page.locator('.customize-price')).toContainText('135.00');
  await page.getByRole('button', { name: /^(Add|Update item)$/ }).click();
  await library(page); await page.getByRole('button', { name: 'Edit library group Customize your burger', exact: true }).click();
  await page.getByLabel('Price adjustment', { exact: true }).first().fill('30');
  await page.getByRole('button', { name: 'Save group', exact: true }).click();
  await expect(page.getByRole('article')).toContainText('30.00');
  await page.getByRole('button', { name: 'Remove library group Customize your burger', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Keep group' })).toBeFocused(); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Remove library group Customize your burger', exact: true }).click();
  await page.getByRole('button', { name: 'Remove from library', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add library group' })).toBeFocused();
  await customize(page); await expect(page.locator('.customize-price')).toContainText('135.00'); await page.getByRole('button', { name: /^(Add|Update item)$/ }).click();
  await expect(page.locator('.cart-line')).toHaveCount(1); await expect(page.getByLabel('Hamburger quantity')).toHaveText('2');
  await page.getByRole('button', { name: 'Pay', exact: true }).click(); await page.getByRole('button', { name: 'CASH PAYMENT', exact: true }).click();
  await page.getByLabel('Amount Given:', { exact: true }).fill('400'); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await nav(page, 'Audit Trail'); await page.locator('tbody tr').first().click();
  await expect(page.locator('.sale-details')).toContainText('302.40'); await expect(page.locator('.sale-details')).toContainText('Cheese Slices: 2 pcs');
});

test('repeated imports have independent selections', async ({ page }) => {
  await enter(page); await seedLibrary(page); await burger(page);
  await page.getByRole('button', { name: 'Remove group', exact: true }).click();
  await page.getByText('Reuse a library group', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Library group', exact: true }).selectOption({ label: 'Customize your burger' });
  await page.getByRole('button', { name: 'Attach group to product', exact: true }).click(); await page.getByRole('button', { name: 'Attach group to product', exact: true }).click();
  await expect(page.locator('.modifier-editor fieldset')).toHaveCount(2);
  await saveRecord(page);
  await customize(page); const cheeses = page.getByRole('checkbox', { name: /Extra cheese/ });
  await expect(cheeses).toHaveCount(2); await cheeses.first().uncheck(); await expect(cheeses.last()).toBeChecked();
  await page.getByRole('button', { name: /^(Add|Update item)$/ }).click();
  await expect(page.locator('.cart-modifier')).toHaveCount(1);
});

test('saving a library copy is explicit and does not save or discard the product draft', async ({ page }) => {
  await enter(page); await burger(page);
  await page.getByRole('checkbox', { name: 'Select Extra cheese by default', exact: true }).check();
  await page.getByRole('button', { name: 'Save copy to library', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Discard inventory edits?' })).toBeVisible();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await page.getByRole('button', { name: 'Modifier groups', exact: true }).click();
  await expect(page.getByRole('article')).toContainText('Extra cheese · Default');
  await customize(page); await expect(page.getByRole('checkbox', { name: /Extra cheese/ })).not.toBeChecked();
});

test('cart edits retain removed defaults and unavailable defaults start unchecked', async ({ page }) => {
  await enter(page); await seedLibrary(page); await customize(page);
  await page.getByRole('checkbox', { name: /Extra cheese/ }).uncheck(); await page.getByRole('button', { name: /^(Add|Update item)$/ }).click();
  await page.getByRole('button', { name: 'Edit options', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Extra cheese/ })).not.toBeChecked(); await page.keyboard.press('Escape');
  await nav(page, 'Inventory'); await page.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('Cheese Slices');
  await page.getByRole('button', { name: 'Edit Cheese Slices', exact: true }).click();
  await page.getByLabel('Expiry On', { exact: true }).fill('2026-10-02'); await saveRecord(page);
  await page.setViewportSize({ width: 820, height: 400 });
  await customize(page); await expect(page.getByRole('checkbox', { name: /Extra cheese/ })).not.toBeChecked(); await expect(page.getByRole('checkbox', { name: /Extra cheese/ })).toBeDisabled();
  const dialog = page.getByRole('dialog');
  expect(await dialog.evaluate(element => element.querySelector('.modal-header')!.getBoundingClientRect().top >= element.getBoundingClientRect().top)).toBe(true);
  await expect(page.getByRole('button', { name: 'Close dialog', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: /^(Add|Update item)$/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByLabel('Hamburger quantity')).toHaveText('2');
});

test('small-screen library drafts survive cancelled navigation and defaults reach Staff POS', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await enter(page); await seedLibrary(page); await library(page);
  await page.getByRole('button', { name: 'Edit library group Customize your burger', exact: true }).click();
  await page.getByLabel('Group name', { exact: true }).fill('Burger draft'); await nav(page, 'Reports');
  await expect(page.getByRole('button', { name: 'Keep editing' })).toBeFocused(); await page.keyboard.press('Escape');
  await expect(page.getByLabel('Group name', { exact: true })).toHaveValue('Burger draft');
  await page.getByRole('button', { name: 'Back to modifier groups' }).click(); await page.getByRole('button', { name: 'Discard changes' }).click();
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click(); await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByLabel('Preview role').selectOption('Staff'); await page.getByRole('button', { name: 'Open preview', exact: true }).click();
  await page.getByRole('button', { name: 'Add Hamburger to order', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Extra cheese/ })).toBeChecked();
  await page.getByRole('button', { name: /^(Add|Update item)$/ }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.cart-modifier')).toContainText('Extra cheese');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
