import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type {} from './fixtures/integration-harness';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const captures = fileURLToPath(new URL('../../.review/october-17-p2a/', import.meta.url));

async function harness(page: Page, screen: string) {
  await page.route('**/src/main.tsx', route => route.fulfill({ contentType: 'application/javascript', body: "import '/tests/fixtures/integration-harness.tsx';" }));
  await page.goto(`/?${screen}`);
}

test('Users retains a rejected edit, blocks duplicate saves and closes only on success', async ({ page }) => {
  await harness(page, 'users');
  await page.getByRole('group', { name: 'Raven account' }).getByRole('button', { name: 'Manage' }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Retained request draft');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('dialog', { name: 'Manage User' })).toBeVisible();
  await page.locator('form').evaluate(form => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(await page.evaluate(() => window.integration.calls)).toBe(1);
  await page.evaluate(() => window.integration.finish('This account changed. Review before retrying.'));
  await expect(page.getByRole('alert')).toContainText('This account changed');
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Retained request draft');
  expect(await page.evaluate(() => window.integration.saved)).toBe(0);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.integration.calls)).toBe(2);
  await page.evaluate(() => window.integration.finish());
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('group', { name: 'raven account', exact: true }).getByRole('button', { name: 'Manage', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Retained request draft');
});

test('the add-user wizard preserves step-three passwords and fields after a rejected save', async ({ page }) => {
  await harness(page, 'users');
  await page.getByRole('button', { name: 'Add User', exact: true }).click();
  await page.getByLabel('Full Name', { exact: true }).fill('New sample person');
  await page.getByLabel('Username', { exact: true }).fill('new-person');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('Email Address', { exact: true }).fill('new@example.com');
  await page.getByLabel('Code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByLabel('Password', { exact: true }).fill('sample-password');
  await page.getByLabel('Confirm Password', { exact: true }).fill('sample-password');
  await page.getByRole('button', { name: 'Add Account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await page.evaluate(() => window.integration.finish('Email already exists.'));
  await expect(page.getByRole('alert')).toHaveText('Email already exists.');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('sample-password');
  await expect(page.getByRole('dialog')).toContainText('Step 3 of 3');
  await page.getByRole('button', { name: 'Add Account', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.integration.calls)).toBe(2);
  await page.evaluate(() => window.integration.finish());
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('group', { name: 'new-person account', exact: true }).getByRole('button', { name: 'Manage', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('New sample person');
});

test('failed account deletion keeps the account and permits a deliberate retry', async ({ page }) => {
  await harness(page, 'users');
  await page.getByRole('group', { name: 'Raven account' }).getByRole('button', { name: 'Manage' }).click();
  await page.getByRole('button', { name: 'Delete Account', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Delete Account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
  await page.evaluate(() => window.integration.finish('Deletion rejected.'));
  await expect(page.getByRole('alert')).toHaveText('Deletion rejected.');
  await expect(page.getByRole('group', { name: 'Raven account' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Confirm Delete Account', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.integration.calls)).toBe(2);
  await page.evaluate(() => window.integration.finish());
  await expect(page.getByRole('group', { name: 'Raven account' })).toHaveCount(0);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 568 }]) {
  test(`Inventory retains the complete draft and discard protection after failure at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await harness(page, 'inventory');
    await page.getByRole('searchbox', { name: 'Search inventory' }).fill('Espresso beans');
    await page.getByRole('button', { name: 'Edit Espresso beans', exact: true }).click();
    await page.getByRole('textbox', { name: 'Ingredient Name', exact: true }).fill('Request draft beans');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Back to Inventory', exact: true })).toBeDisabled();
    await page.evaluate(() => window.integration.finish('Stock changed. Your draft is retained.'));
    await expect(page.getByRole('alert')).toContainText('Stock changed');
    await expect(page.getByRole('textbox', { name: 'Ingredient Name', exact: true })).toHaveValue('Request draft beans');
    await mkdir(captures, { recursive: true });
    await page.screenshot({ path: `${captures}/inventory-retained-${viewport.width}.png`, fullPage: true });
    expect(await page.evaluate(() => window.integration.dirty)).toBe(true);
    await page.getByRole('button', { name: 'Back to Inventory', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Discard inventory edits?' })).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.integration.calls)).toBe(2);
    await page.evaluate(() => window.integration.finish());
    await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.integration.saved)).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('receiving failure retains batch quantity and dates without changing stock', async ({ page }) => {
  await harness(page, 'inventory');
  await page.getByRole('searchbox', { name: 'Search inventory' }).fill('Espresso beans');
  await page.getByRole('button', { name: 'Add stock to Espresso beans', exact: true }).click();
  await page.getByLabel('Quantity Added', { exact: true }).fill('2');
  // DateField's calendar inputs retain their normal implementation.
  await page.getByRole('button', { name: 'Add Stock', exact: true }).click();
  // Required dates prevent a request; fill via the date fields used by the actual page.
  expect(await page.evaluate(() => window.integration.calls)).toBe(0);
  await page.locator('input[name="manufactured"]').fill('2026-10-17');
  await page.locator('input[name="expires"]').fill('2026-12-17');
  await page.getByRole('button', { name: 'Add Stock', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await page.evaluate(() => window.integration.finish('Receipt rejected.'));
  await expect(page.getByRole('alert')).toHaveText('Receipt rejected.');
  await expect(page.getByLabel('Quantity Added', { exact: true })).toHaveValue('2');
  expect(await page.evaluate(() => window.integration.saved)).toBe(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeVisible();
});

test('product save and removal failures retain their editor/confirmation until successful retry', async ({ page }) => {
  await harness(page, 'inventory');
  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await page.getByLabel('Inventory category', { exact: true }).selectOption('Hobby');
  await page.getByRole('searchbox', { name: 'Search inventory' }).fill('Deck Sleeves');
  await page.getByRole('button', { name: 'Edit product Deck Sleeves', exact: true }).click();
  await page.getByLabel('Product Name', { exact: true }).fill('Retained sleeves');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await page.evaluate(() => window.integration.finish('Product validation failed.'));
  await expect(page.getByRole('alert')).toHaveText('Product validation failed.');
  await expect(page.getByLabel('Product Name', { exact: true })).toHaveValue('Retained sleeves');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.integration.calls)).toBe(2);
  await page.evaluate(() => window.integration.finish());
  await page.getByRole('button', { name: 'Remove product Retained sleeves', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm removal', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Removing…' })).toBeDisabled();
  await page.evaluate(() => window.integration.finish('Removal rejected.'));
  await expect(page.getByRole('alert')).toHaveText('Removal rejected.');
  await expect(page.getByRole('dialog', { name: 'Remove product?' })).toBeVisible();
  expect(await page.evaluate(() => window.integration.saved)).toBe(1);
  await page.getByRole('button', { name: 'Keep record', exact: true }).click();
  await page.getByRole('button', { name: 'Remove product Retained sleeves', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirm removal', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.integration.calls)).toBe(4);
  await page.evaluate(() => window.integration.finish());
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a failed same-scope reload exposes an error, retains data and supports explicit retry', async ({ page }) => {
  await harness(page, 'resource');
  await expect.poll(() => page.evaluate(() => Boolean(window.integration.resources.first))).toBe(true);
  await page.evaluate(() => window.integration.resources.first('Existing data'));
  await expect(page.locator('output')).toHaveText('Existing data');
  await page.getByRole('button', { name: 'Reload' }).click();
  await expect(page.locator('p[role="status"]')).toHaveText('loading');
  await page.evaluate(() => window.integration.resources.first('Offline', true));
  await expect(page.locator('p[role="status"]')).toHaveText('error');
  await expect(page.locator('output')).toHaveText('Existing data');
  await page.getByRole('button', { name: 'Reload' }).click();
  await expect(page.locator('p[role="status"]')).toHaveText('loading');
  await page.evaluate(() => window.integration.resources.first('Updated data'));
  await expect(page.locator('p[role="status"]')).toHaveText('ready');
  await expect(page.locator('output')).toHaveText('Updated data');
});

test('resource loading ignores out-of-order responses and clears data across identity/logout', async ({ page }) => {
  await harness(page, 'resource');
  await expect(page.locator('p[role="status"]')).toHaveText('loading');
  await expect.poll(() => page.evaluate(() => Boolean(window.integration.resources.first))).toBe(true);
  await page.getByRole('button', { name: 'Switch account' }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.integration.resources.second))).toBe(true);
  await page.evaluate(() => window.integration.resources.second('Second account data'));
  await expect(page.locator('output')).toHaveText('Second account data');
  await page.evaluate(() => window.integration.resources.first('Stale first account data'));
  await expect(page.locator('output')).toHaveText('Second account data');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.locator('p[role="status"]')).toHaveText('idle');
  await expect(page.locator('output')).toHaveText('No data');
  expect(await page.evaluate(() => window.integration.aborted)).toBeGreaterThan(0);
});
