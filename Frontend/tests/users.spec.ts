import { saveRecord } from './fixtures/save-record';
import { expect, test, type Page } from '@playwright/test';

async function nav(page: Page, name: string) {
  if ((page.viewportSize()?.width ?? 1440) < 768) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
}
async function enter(page: Page, role = 'Owner') {
  await page.goto('/'); await page.getByLabel('Preview role').selectOption(role);
  await page.getByRole('button', { name: 'Open preview' }).click(); await nav(page, 'Users');
}
async function beginAccount(page: Page, name = 'New Teammate', username = 'new.teammate') {
  await page.getByRole('button', { name: 'Add User', exact: true }).click();
  await page.getByLabel('Full Name', { exact: true }).fill(name);
  await page.getByLabel('Username', { exact: true }).fill(username);
}
async function verifyEmail(page: Page, email = 'new@example.com') {
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('Email Address', { exact: true }).fill(email);
  await page.getByLabel('Code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
}

test('user search and role filters remain visible and survive page navigation', async ({ page }) => {
  await enter(page);
  await page.getByRole('searchbox', { name: 'Search users', exact: true }).fill('R');
  await expect(page.locator('.user-row')).toHaveCount(1);
  await expect(page.locator('.user-row')).toContainText('Raven');
  await page.getByRole('searchbox').fill('@EXAMPLE');
  await expect(page.locator('.user-row')).toHaveCount(5);
  await page.getByRole('combobox', { name: 'Account role', exact: true }).selectOption('Staff');
  await expect(page.locator('.user-row')).toHaveCount(3);
  await nav(page, 'Dashboard'); await nav(page, 'Users');
  await expect(page.getByRole('searchbox')).toHaveValue('@EXAMPLE');
  await expect(page.getByRole('combobox', { name: 'Account role', exact: true })).toHaveValue('Staff');
  await page.getByRole('searchbox').fill('angel');
  await expect(page.getByRole('heading', { name: 'No matching accounts' })).toBeVisible();
  await expect(page.locator('.filter-summary')).toContainText('Staff');
  await page.getByRole('button', { name: 'Show all accounts' }).click();
  await expect(page.locator('.user-row')).toHaveCount(5);
  await expect(page.getByRole('group', { name: 'Angel account', exact: true })).toContainText('You');
});

test('wizard rejects blank names and duplicate identifiers and clears stale validation on Back', async ({ page }) => {
  await enter(page); await beginAccount(page, '   ', 'fresh.user');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Enter a name');
  await page.getByLabel('Full Name', { exact: true }).fill('New Teammate');
  await page.getByLabel('Username', { exact: true }).fill('ANGEL');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('username already exists');
  await page.getByLabel('Username', { exact: true }).fill('fresh.user');
  await verifyEmail(page, 'ANGEL@example.com');
  await expect(page.getByRole('alert')).toContainText('email already exists');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('Full Name', { exact: true })).toBeFocused();
  await verifyEmail(page);
  await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
  await expect(page.locator('.account-summary')).toContainText('fresh.user');
});

test('password review supports visibility, clears secrets on Back and cancel, and reveals created accounts', async ({ page }) => {
  await enter(page);
  await page.getByRole('combobox', { name: 'Account role', exact: true }).selectOption('Owner');
  await page.getByRole('searchbox').fill('angel');
  await beginAccount(page); await verifyEmail(page);
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm Password', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Show passwords' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await expect(page.getByRole('button', { name: 'Hide passwords' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByLabel('Email Address', { exact: true })).toHaveValue('new@example.com');
  await expect(page.getByLabel('Code', { exact: true })).toHaveValue('');
  await page.getByLabel('Code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Discard unsaved changes?' }).getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add User', exact: true })).toBeFocused();
  await beginAccount(page); await verifyEmail(page);
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm Password', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Add Account', exact: true }).dblclick();
  await expect(page.getByRole('group', { name: 'New Teammate account', exact: true })).toHaveCount(1);
  await expect(page.getByRole('combobox', { name: 'Account role', exact: true })).toHaveValue('All');
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await beginAccount(page, 'Second User', 'second.user'); await verifyEmail(page, 'second@example.com');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
});

test('delete review can be cancelled by Escape without losing edits and restores opener focus', async ({ page }) => {
  await enter(page);
  await page.getByRole('group', { name: 'Raven account', exact: true }).getByRole('button', { name: 'Manage' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Raven Revised');
  await page.getByRole('combobox', { name: 'Role', exact: true }).selectOption('Admin');
  await page.getByRole('button', { name: 'Delete Account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Keep account' })).toBeFocused();
  await expect(page.getByRole('dialog')).toContainText('Recorded sales and actor names remain');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Manage User', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete Account', exact: true })).toBeFocused();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Raven Revised');
  await expect(page.getByRole('combobox', { name: 'Role', exact: true })).toHaveValue('Admin');
  await saveRecord(page);
  const row = page.getByRole('group', { name: 'Raven Revised account', exact: true });
  await expect(row.getByRole('button', { name: 'Manage' })).toBeFocused();
  await row.getByRole('button', { name: 'Manage' }).click();
  await page.getByRole('button', { name: 'Delete Account', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Delete Account', exact: true }).click();
  await expect(row).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add User', exact: true })).toBeFocused();
});

test('Admin manages Staff only and account restrictions explain disabled actions', async ({ page }) => {
  await enter(page, 'Admin');
  await expect(page.getByRole('group', { name: 'Angel account', exact: true }).getByRole('button')).toBeDisabled();
  await expect(page.getByRole('group', { name: 'Alex account', exact: true })).toContainText('Owner manages this account');
  await page.getByRole('group', { name: 'Micah account', exact: true }).getByRole('button').click();
  await expect(page.getByRole('combobox', { name: 'Role', exact: true }).getByRole('option', { name: 'Admin', exact: true })).toHaveAttribute('disabled', '');
  await expect(page.locator('.account-access')).toContainText('POS');
  await page.getByRole('button', { name: 'Delete Account', exact: true }).click();
  await page.getByRole('button', { name: 'Keep account' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByLabel('Preview role').selectOption('Owner');
  await page.getByRole('button', { name: 'Open preview' }).click(); await nav(page, 'Users');
  await page.getByRole('group', { name: 'Angel account', exact: true }).getByRole('button').click();
  await expect(page.getByRole('button', { name: 'Delete Account', exact: true })).toBeDisabled();
  await expect(page.getByRole('dialog')).toContainText('cannot delete your signed-in account');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByLabel('Preview role').selectOption('Staff');
  await page.getByRole('button', { name: 'Open preview' }).click();
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Users', exact: true })).toHaveCount(0);
});

test('small-screen user dialogs contain long identity text and retain keyboard access', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await enter(page);
  await page.getByRole('group', { name: 'Raven account', exact: true }).getByRole('button').click();
  const longName = 'Raven with a very long account display name for team management';
  await page.getByLabel('Name', { exact: true }).fill(longName);
  await saveRecord(page);
  const opener = page.getByRole('group', { name: `${longName} account`, exact: true }).getByRole('button');
  await opener.click(); await page.getByRole('button', { name: 'Delete Account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Keep account' })).toBeFocused();
  const deleteDialog = await page.getByRole('dialog').boundingBox();
  const deleteHeader = await page.locator('dialog[open] .modal-header').boundingBox();
  expect(deleteHeader!.y).toBeGreaterThanOrEqual(deleteDialog!.y);
  await expect(page.getByRole('button', { name: 'Close dialog' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  await page.setViewportSize({ width: 820, height: 400 }); await beginAccount(page);
  await verifyEmail(page);
  await page.getByRole('button', { name: 'Add Account', exact: true }).focus();
  await expect(page.getByRole('button', { name: 'Close dialog' })).toBeInViewport();
  await expect(page.getByRole('heading', { name: 'Add New User', exact: true })).toBeInViewport();
  const box = await page.getByRole('button', { name: 'Add Account', exact: true }).boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(400);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Discard unsaved changes?' }).getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add User', exact: true })).toBeFocused();
});

