import { test,expect,type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { managementServer } from './fixtures/management-server';
import { workflowFixture } from '../../backend/scripts/sales-workflow-checks';
import { checkoutAs } from '../../backend/scripts/checkout-checks';

test.describe.configure({timeout:90000});
let api:Awaited<ReturnType<typeof managementServer>>,f:Awaited<ReturnType<typeof workflowFixture>>;
const output=fileURLToPath(new URL('../../.review/p9-notifications/visuals/',import.meta.url));
test.beforeEach(async()=>{api=await managementServer();await api.db.exec('begin');f=await workflowFixture(api.db);await api.db.exec('commit;reset role');});
test.afterEach(()=>api?.close());
async function enter(page:Page,role:'Owner'|'Admin'|'Staff'='Owner'){
  await api.setup(page.context(),role);await api.restore(page,role);await expect(page.locator('.live-connection-status')).toHaveCount(0);
  if(role!=='Staff')await expect(page.locator('.alert-center')).toContainText('saved alerts');
}
async function signIn(page:Page,role:'Owner'|'Admin'|'Staff'='Owner'){
  // Stay on the logged-out page: restore() deliberately seeds a session on navigation.
  await page.getByLabel('Username or email').fill(`${role.toLowerCase()}@example.invalid`);
  await page.getByLabel('Password',{exact:true}).fill('Test-password-123');
  await page.getByRole('button',{name:'Log in',exact:true}).click();
}
async function buy(count=1){await api.db.exec('begin');for(let i=0;i<count;i++)await f.buy();await api.db.exec('commit;reset role');await api.flushUpdates();}
async function request(){
  await api.db.exec('begin');const sale=await f.buy();await checkoutAs(api.db,f.actors.staff);await f.execute(await f.request(sale.saleId));await api.db.exec('commit;reset role');await api.flushUpdates();return sale;
}
test('saved alerts update through private WebSockets, sync across own sessions and keep other accounts unread after logout',async({page,browser})=>{
  await enter(page);const ownContext=await browser.newContext(),own=await ownContext.newPage();await enter(own);
  const adminContext=await browser.newContext(),admin=await adminContext.newPage();await enter(admin,'Admin');
  await request();for(const p of [page,own,admin])await expect(p.locator('.alert-list')).toContainText('P6 staff');
  await page.getByRole('button',{name:'Mark read',exact:true}).click();await expect(own.getByRole('button',{name:'Mark unread',exact:true})).toBeVisible();
  await expect(admin.getByRole('button',{name:'Mark read',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Log out',exact:true}).click();await expect(page.getByRole('button',{name:'Log in',exact:true})).toBeVisible();await signIn(page);
  await expect(page.getByRole('button',{name:'Mark unread',exact:true})).toBeVisible();
  await expect(admin.getByRole('button',{name:'Alert settings',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Review orders',exact:true}).click();await expect(page.locator('.sale-details')).toContainText('P6 staff');await expect(page.locator('tbody tr')).toHaveCount(1);
  await ownContext.close();await adminContext.close();
});
test('duplicate evidence becomes unread, stale marks recover explicitly and reconnect receives missed alerts',async({page})=>{
  await enter(page);await buy(5);await expect(page.locator('.alert-list')).toContainText('5 identical orders');
  await page.getByRole('button',{name:'Mark read',exact:true}).click();await expect(page.getByRole('button',{name:'Mark unread',exact:true})).toBeVisible();
  // Commit new evidence after the outgoing marker already captured its revision.
  await page.route('**/api/notifications/*/read',async route=>{
    await api.db.exec('begin');await f.buy();await api.db.exec('commit;reset role');
    const req=route.request(),response=await api.request(`${api.base}${new URL(req.url()).pathname}`,{method:'PATCH',headers:req.headers(),body:req.postData()});
    expect(response.status).toBe(409);await route.fulfill({status:response.status,body:await response.text(),contentType:'application/json'});
  },{times:1});
  await page.getByRole('button',{name:'Mark unread',exact:true}).click();await expect(page.locator('.alert-center .error')).toContainText('changed');
  await expect(page.locator('.alert-list')).toContainText('6 identical orders');await expect(page.getByRole('button',{name:'Mark read',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Mark read',exact:true}).click();await expect(page.getByRole('button',{name:'Mark unread',exact:true})).toBeVisible();
  api.disconnect();await buy();await expect(page.locator('.live-connection-status')).toHaveCount(0,{timeout:15000});
  await expect(page.locator('.alert-list')).toContainText('7 identical orders');await expect(page.getByRole('button',{name:'Mark read',exact:true})).toBeVisible();
});
test('failed or lost read responses recover saved state, and resolving a void removes its alert without changing stock again',async({page})=>{
  await enter(page);const sale=await request();
  await page.route('**/api/notifications/*/read',route=>route.fulfill({status:503,json:{error:{message:'Read marker temporarily unavailable'}}}),{times:1});
  await page.getByRole('button',{name:'Mark read',exact:true}).click();await expect(page.locator('.alert-center .error')).toContainText('temporarily unavailable');
  await expect(page.getByRole('button',{name:'Mark read',exact:true})).toBeEnabled();
  await page.route('**/api/notifications/*/read',async route=>{
    const req=route.request(),response=await api.request(`${api.base}${new URL(req.url()).pathname}`,{method:'PATCH',headers:req.headers(),body:req.postData()});
    expect(response.status).toBe(200);await route.abort('failed');
  },{times:1});
  await page.getByRole('button',{name:'Mark read',exact:true}).click();await expect(page.getByRole('button',{name:'Mark unread',exact:true})).toBeVisible();
  await expect(page.locator('.alert-center .error')).toHaveCount(0);
  await api.db.exec('begin');const before=await f.physical();await checkoutAs(api.db,f.actors.admin);await f.execute(await f.voidCommand([sale.saleId]));
  expect(await f.physical()).toEqual(before);await api.db.exec('commit;reset role');await api.flushUpdates();
  await expect(page.locator('.alert-list article')).toHaveCount(0);await expect(page.locator('.alert-center')).toContainText('No pending void requests');
});
test('notification failures stay visible and Staff cannot read or mark management alerts',async({page})=>{
  await request();await api.setup(page.context(),'Owner');
  await page.route('**/api/notifications?*',route=>route.fulfill({status:503,json:{error:{message:'Notification service unavailable'}}}));
  await api.restore(page);await expect(page.locator('.alert-center')).toContainText('Saved alerts could not be loaded');
  await expect(page.locator('.alert-center')).not.toContainText('No pending void requests');
  await page.unroute('**/api/notifications?*');await page.getByRole('button',{name:'Retry loading alerts',exact:true}).click();await expect(page.locator('.alert-list article')).toHaveCount(1);
  await page.getByRole('button',{name:'Log out',exact:true}).click();await signIn(page,'Staff');
  await expect(page.locator('.alert-center')).toHaveCount(0);await expect(page.getByRole('button',{name:'Dashboard',exact:true})).toHaveCount(0);
});
test('Owner/Admin notification cards retain the established responsive layout and keyboard actions at five sizes',async({browser})=>{
  test.setTimeout(180000);await request();await buy(5);await mkdir(output,{recursive:true});const errors:string[]=[];
  for(const role of ['Owner','Admin'] as const){
    const context=await browser.newContext(),view=await context.newPage();view.on('pageerror',error=>errors.push(error.message));await enter(view,role);
    for(const [width,height] of [[1440,900],[820,1180],[390,844],[320,568],[820,400]]){
      await view.setViewportSize({width,height});await expect(view.locator('.alert-list article')).toHaveCount(2);
      const mark=view.getByRole('button',{name:'Mark read',exact:true}).first();await mark.focus();await expect(mark).toBeFocused();await view.keyboard.press('Enter');
      await expect(view.getByRole('button',{name:'Mark unread',exact:true})).toHaveCount(1);await view.getByRole('button',{name:'Mark unread',exact:true}).click();
      await expect(view.getByRole('button',{name:'Mark read',exact:true})).toHaveCount(2);
      expect(await view.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await view.evaluate(()=>window.scrollTo(0,0));await expect.poll(()=>view.evaluate(()=>scrollY)).toBe(0);
      await view.screenshot({path:`${output}/${role}-${width}x${height}.png`,fullPage:true});
    }
    await context.close();
  }
  expect(errors).toEqual([]);
});
