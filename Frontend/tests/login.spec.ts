import { test, expect } from './fixtures/legacy-preview';

test('password visibility supports keyboard input and preview entry explains account access', async ({ page }) => {
  await page.goto('/');
  const password = page.getByLabel('Password', { exact: true });
  await page.getByLabel('Username or email').fill('sample@example.com');
  await password.fill('sample-password');
  await page.getByRole('button', { name: 'Show password', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('sample-password');
  await expect(page.getByRole('button', { name: 'Hide password', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter');
  await expect(password).toHaveAttribute('type', 'password');
  await password.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText('no password is needed');
  await expect(page.getByRole('complementary', { name: 'Frontend preview' })).toContainText('No password needed');
  for (const role of ['Owner', 'Staff']) {
    await page.getByLabel('Preview role').selectOption(role);
    await page.getByRole('button', { name: 'Open preview' }).click();
    await expect(page.getByRole('heading', { name: role === 'Staff' ? 'Point of Sale' : 'Dashboard', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  }
});

test('recovery announces each stage, validates sample codes and clears password visibility', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeFocused();
  await page.getByLabel('Email', { exact: true }).fill('sample@example.com');
  await page.getByRole('button', { name: 'Send Code' }).click();
  await expect(page.getByRole('heading', { name: 'Check your code' })).toBeFocused();
  await expect(page.getByLabel('Verification code')).toHaveAttribute('autocomplete', 'one-time-code');
  await page.getByLabel('Verification code').fill('111111');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('123456');
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeFocused();
  await page.getByLabel('New password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm password', { exact: true }).fill('different123');
  await page.getByRole('button', { name: 'Show passwords', exact: true }).click();
  await expect(page.getByLabel('New password', { exact: true })).toHaveAttribute('type', 'text');
  await expect(page.getByLabel('Confirm password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Change Password' }).click();
  await expect(page.getByRole('alert')).toContainText('must match');
  await page.getByLabel('Confirm password', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Change Password' }).click();
  await expect(page.getByRole('status')).toContainText('No account was changed');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeFocused();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
});

test('login stays usable when resizing and preview remains reachable on short screens', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Password', { exact: true }).fill('keep-on-resize');
  for (const width of [1440, 1024, 900, 899, 820, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 568 });
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('keep-on-resize');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const control of await page.locator('.login-screen button, .login-screen select').all()) {
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: 'Open preview' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Open preview' })).toBeInViewport();
  }
  await page.getByLabel('Preview role').selectOption('Staff');
  await page.getByRole('button', { name: 'Open preview' }).click();
  await expect(page.getByRole('heading', { name: 'Point of Sale', exact: true })).toBeVisible();
});
