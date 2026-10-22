import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { managementServer } from './fixtures/management-server';
import { checkoutAs, checkoutFixture, checkoutValue } from '../../backend/scripts/checkout-checks';
import { productRecord, stockRecord } from '../../backend/scripts/inventory-checks';

test.describe.configure({ mode: 'serial', timeout: 60000 });
let api: Awaited<ReturnType<typeof managementServer>>, f: Awaited<ReturnType<typeof checkoutFixture>>;
test.beforeEach(async () => { api = await managementServer(); await api.db.query('begin'); f = await checkoutFixture(api.db); await api.db.query('commit'); await api.db.query('reset role'); });
test.afterEach(() => api?.close());
async function enter(page: Page, role: 'Owner' | 'Admin' | 'Staff' = 'Owner') { await api.setup(page.context(), role); await api.restore(page, role); await expect(page.locator('.live-connection-status')).toHaveCount(0); }
async function variants() {
  const alternate=stockRecord({name:'Alternate edition stock'});
  const option = { id: randomUUID(), name: 'Gift wrap', price: '1.00', defaultSelected: false, inputs: [] };
  const p = productRecord(f.stock, { sku: `P8A-${randomUUID()}`, name: 'Dialog variants', stockId: null, model: 'Variants',
    variants: [{ id: randomUUID(), name: 'Edition', stockId: f.stock.id, price: '25.00', enabled: true },{ id: randomUUID(), name: 'Alternate', stockId: alternate.id, price: '25.00', enabled: true }], groups: [{ id: randomUUID(), name: 'Extras', min: '0', max: '1', options: [option] }] });
  await api.db.query('begin'); await checkoutAs(api.db, f.actors.owner); await f.save('stock.save',alternate); await f.save('product.save', p); await api.db.query('commit'); await api.db.query('reset role'); await api.flushUpdates(); return p;
}

test('live options preserve drafts through events, Escape and navigation; shared dialog and payment layouts fit five sizes', async ({ page }) => {
  test.setTimeout(120000); await variants(); await enter(page, 'Staff');
  const output = fileURLToPath(new URL('../../../.review/october-18-p8a-resume-dialogs/', import.meta.url)); await mkdir(output, { recursive: true });
  await page.getByRole('button', { name: 'Add Dialog variants to order', exact: true }).click();
  await page.getByRole('radio', { name: /Edition/ }).check(); await page.getByRole('checkbox', { name: /Gift wrap/ }).check(); await page.getByLabel('Quantity', { exact: true }).fill('2');
  await api.invalidate('vertwell:catalogue', ['catalogue']);
  await expect(page.getByRole('radio', { name: /Edition/ })).toBeChecked(); await expect(page.getByRole('checkbox', { name: /Gift wrap/ })).toBeChecked(); await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('2');
  await page.getByRole('radio',{name:/Alternate/}).check();await expect(page.getByRole('checkbox',{name:/Gift wrap/})).toBeChecked();await expect(page.getByLabel('Quantity',{exact:true})).toHaveValue('2');
  await expect(page.locator('.customize-price')).toContainText('₱52.00');
  await page.keyboard.press('Escape'); const discard = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true }); await expect(discard).toBeVisible();
  await expect(discard.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused(); await discard.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('2');
  for (const [width, height] of [[1440,900],[820,1180],[390,844],[320,568],[820,400]]) {
    await page.setViewportSize({ width, height }); const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Add modifiers — Dialog variants', exact: true })).toBeInViewport();
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: `${output}/options-${width}x${height}.png` });
  }
  await page.getByRole('button', { name: 'Add', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.setViewportSize({width:1440,height:900}); await page.getByRole('button', {name:'Pay',exact:true}).click(); await page.getByRole('button',{name:'Cash payment',exact:true}).click();
  await expect(page.getByLabel('Amount Given:', {exact:true})).toBeFocused(); await page.getByLabel('Amount Given:',{exact:true}).fill('100');
  await api.invalidate('vertwell:catalogue',['catalogue']); await expect(page.getByLabel('Amount Given:',{exact:true})).toHaveValue('100');
  await page.getByRole('button',{name:'Close dialog',exact:true}).click(); await page.getByRole('button',{name:'Keep editing',exact:true}).click();
  for (const [width,height] of [[1440,900],[820,1180],[390,844],[320,568],[820,400]]) {
    await page.setViewportSize({width,height}); await expect(page.getByRole('heading',{name:'CASH PAYMENT',exact:true})).toBeInViewport();
    expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await page.screenshot({path:`${output}/cash-${width}x${height}.png`});
  }
  await page.getByRole('button',{name:'Back',exact:true}).click(); await page.getByRole('button',{name:'GCash payment',exact:true}).click();
  await expect(page.getByLabel('GCash reference number')).toBeFocused(); await page.getByLabel('GCash reference number').fill('1234567890123');
  await api.invalidate('vertwell:catalogue',['catalogue']); await expect(page.getByLabel('GCash reference number')).toHaveValue('1234567890123');
  await page.keyboard.press('Escape'); await page.getByRole('button',{name:'Discard changes',exact:true}).click(); await expect(page.locator('.cart-line')).toHaveCount(1);
  expect(await checkoutValue(api.db,'select count(*)::int as value from public.sales')).toBe(0);
});

test('account events update other sessions while open account edits retain their original revision', async ({page,browser}) => {
  await enter(page); await page.getByRole('button',{name:'Users',exact:true}).click();
  const context=await browser.newContext(),other=await context.newPage(); await enter(other); await other.getByRole('button',{name:'Users',exact:true}).click();
  await page.getByRole('group',{name:'staff account',exact:true}).getByRole('button',{name:'Manage',exact:true}).click(); await page.getByLabel('Name',{exact:true}).fill('Unsaved staff name');
  await other.getByRole('group',{name:'staff account',exact:true}).getByRole('button',{name:'Manage',exact:true}).click(); await other.getByLabel('Name',{exact:true}).fill('Saved staff name'); await other.getByRole('button',{name:'Save',exact:true}).click();
  await other.getByRole('group',{name:'staff account',exact:true}).getByRole('button',{name:'Manage',exact:true}).click(); await expect(other.getByLabel('Name',{exact:true})).toHaveValue('Saved staff name'); await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Unsaved staff name');
  await page.getByRole('button',{name:'Save',exact:true}).click(); await expect(page.getByRole('alert')).toContainText(/changed|reload|review/i); await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Unsaved staff name'); await context.close();
});

test('logout removes private subscriptions and a new Staff session cannot retain manager data', async ({page}) => {
  await enter(page); await page.getByRole('button',{name:'Reports',exact:true}).click(); await expect(page.getByRole('button',{name:'Export report',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Log out',exact:true}).click(); await expect(page.getByRole('heading',{name:'Welcome back',exact:true})).toBeVisible();
  await expect.poll(()=>api.subscriptionCount()).toBe(0);
  await api.setup(page.context(),'Staff'); await api.restore(page,'Staff'); await expect(page.getByRole('heading',{name:'Point of Sale',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Reports',exact:true})).toHaveCount(0); await expect(page.locator('.report-summary')).toHaveCount(0);
  await api.invalidate('vertwell:managers',['reports','inventory','accounts']); await expect(page.getByRole('button',{name:'Users',exact:true})).toHaveCount(0);
});

test('live bundle contents, footer actions and quantity use the shared preview presentation with authoritative quotes',async({page})=>{
  const p=productRecord(f.stock,{sku:`P8A-${randomUUID()}`,name:'Dialog bundle',model:'Bundle',stockId:null,
    bundle:[{productId:f.product.id,stockId:null,variantId:null,quantity:'2',modifierIds:[]}]});
  await api.db.query('begin');await checkoutAs(api.db,f.actors.owner);await f.save('product.save',p);await api.db.query('commit');await api.db.query('reset role');
  await enter(page,'Staff');await page.getByRole('button',{name:'Add Dialog bundle to order',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Included in Dialog bundle',exact:true});await expect(dialog.getByRole('heading',{name:'Included in each bundle',exact:true})).toBeFocused();
  await expect(dialog.getByRole('region',{name:'Included in this bundle',exact:true})).toContainText('2 × P6 retail');
  await page.getByLabel('Quantity',{exact:true}).fill('2');await expect(dialog.locator('.customize-price')).toContainText('₱25.00');
  const output=fileURLToPath(new URL('../../../.review/october-18-p8a-resume-dialogs/',import.meta.url));await mkdir(output,{recursive:true});
  for(const [width,height] of [[1440,900],[820,1180],[390,844],[320,568],[820,400]]){
    await page.setViewportSize({width,height});await expect(dialog.locator('.modal-footer').getByRole('button',{name:'Add',exact:true})).toBeInViewport();
    expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await page.screenshot({path:`${output}/bundle-${width}x${height}.png`});
  }
  await dialog.getByRole('button',{name:'Add',exact:true}).click();await expect(page.locator('.cart-line')).toContainText('Dialog bundle');await expect(page.locator('.quantity-control output')).toHaveText('2');
  await expect(page.locator('.cart-line')).toContainText('Includes: 2× P6 retail');await page.getByRole('button',{name:'Pay',exact:true}).click();await expect(page.getByRole('dialog',{name:'ORDER CONFIRMATION',exact:true})).toContainText('Includes: 2× P6 retail');
  expect(await checkoutValue(api.db,'select count(*)::int as value from public.sales')).toBe(0);
});
