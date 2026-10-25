import { test, expect } from '@playwright/test';
import { managementServer } from './fixtures/management-server';
import { checkoutFixture } from '../../backend/scripts/checkout-checks';

test.describe.configure({ mode: 'serial', timeout: 60000 });
let api: Awaited<ReturnType<typeof managementServer>>;
test.beforeEach(async () => { api = await managementServer(); });
test.afterEach(async () => { await api?.close(); });

test('production login defers business screens and rejects unrouted API access', async ({ page, request }) => {
  const scripts: string[] = [];
  page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()); });
  await api.setup(page.context());
  await page.goto('/Inventory');
  await expect(page).toHaveURL(/\/Login$/);
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  expect(scripts.some(url => /\/(AuthenticatedWorkspace|Inventory|Users|LiveReports|LiveDashboard)-/.test(url))).toBe(false);
  expect((await request.get('/api/health')).status()).toBe(503);
});

test('a failed production workspace download offers a successful explicit retry', async ({ page }) => {
  await api.setup(page.context());
  let attempts = 0;
  await page.route('**/assets/AuthenticatedWorkspace-*.js', route => {
    attempts++;
    return attempts === 1 ? route.fulfill({ status: 503, body: 'Temporary test outage' }) : route.continue();
  });
  await api.restore(page, 'Owner', '/Inventory');
  await expect(page.getByRole('alert')).toContainText('Unable to load workspace');
  await page.getByRole('button', { name: 'Retry loading workspace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
  expect(attempts).toBe(2);
  await expect(page.locator('.nav-identity')).toContainText('owner');
});

test('a delayed and failed Reports chunk keeps navigation and the POS cart through retry', async ({ page }) => {
  await api.db.query('begin');
  const fixture = await checkoutFixture(api.db);
  await api.db.query('commit');
  await api.db.query('reset role');
  await api.setup(page.context());
  let release!: () => void;
  const released = new Promise<void>(resolve => { release = resolve; });
  let attempts = 0;
  await page.route('**/assets/LiveReports-*.js', async route => {
    attempts++;
    if (attempts > 1) return route.continue();
    await released;
    await route.fulfill({ status: 503, body: 'Temporary test outage' });
  });
  await api.restore(page, 'Owner', '/POS');
  await page.getByRole('button', { name: `Add ${fixture.product.name} to order`, exact: true }).click();
  await expect(page.locator('.cart-line')).toHaveCount(1);
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Loading Reports…' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'POS', exact: true })).toBeEnabled();
  release();
  await expect(page.getByRole('alert')).toContainText('Unable to load Reports');
  await page.getByRole('button', { name: 'Retry loading Reports', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
  expect(attempts).toBe(2);
  await page.getByRole('button', { name: 'POS', exact: true }).click();
  await expect(page.locator('.cart-line')).toHaveCount(1);
  await expect(page.locator('.order-panel')).toContainText('₱14.00');
});
