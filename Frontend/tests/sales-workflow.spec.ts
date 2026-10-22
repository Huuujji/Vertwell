import { test,expect,type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { managementServer } from './fixtures/management-server';
import { checkoutFixture,checkoutAs,checkoutValue } from '../../backend/scripts/checkout-checks';
type Role='Owner'|'Admin'|'Staff';
test.describe.configure({mode:'serial'});
let api:Awaited<ReturnType<typeof managementServer>>,fixture:Awaited<ReturnType<typeof checkoutFixture>>;
test.beforeEach(async()=>{api=await managementServer();await api.db.query('begin');fixture=await checkoutFixture(api.db);await api.db.query('commit');await api.db.query('reset role');});
test.afterEach(async()=>api?.close());
async function buy(role:Role='Staff',digital=false){
  return api.db.transaction(async tx=>{
    await checkoutAs(tx,api.ids[role]);const lines=[fixture.line()],q=await checkoutValue(tx,'select public.quote_checkout($1::jsonb) as value',[JSON.stringify(lines)]);
    return checkoutValue(tx,'select public.checkout($1::jsonb) as value',[JSON.stringify({operationId:randomUUID(),revision:q.revision,quoteToken:q.quoteToken,lines,
      payment:digital?{method:'GCash',amount:q.total,reference:'1234567890123'}:{method:'Cash',amount:q.total,cashTendered:'20'}})]);
  });
}
async function state(){return api.db.transaction(async tx=>{await checkoutAs(tx,api.ids.Owner);return checkoutValue(tx,'select public.read_sales_workflow(0,100) as value');});}
async function command(saleId:string,kind='sale.void'){
  return api.db.transaction(async tx=>{
    await checkoutAs(tx,api.ids.Owner);const data=await checkoutValue(tx,'select public.read_sales_workflow(0,100) as value'),s=data.items.find((s:any)=>s.id===saleId);
    return checkoutValue(tx,'select public.sales_workflow_command($1::jsonb) as value',[JSON.stringify({operationId:randomUUID(),kind,targets:[{saleId:s.id,token:s.token}],reason:'Independent decision'})]);
  });
}
async function open(page:Page,role:Role='Owner'){
  await api.setup(page.context(),role);await api.restore(page,role);
  await page.getByRole('button',{name:role==='Staff'?'Today’s Sales History':'Audit Trail',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Sales History',exact:true})).toBeVisible();
  await expect(page.getByText('Loading saved sales history…',{exact:true})).toHaveCount(0);
}
async function details(page:Page,sale:any){await page.getByRole('button',{name:`View order ${sale.orderNumber}`,exact:true}).click();}
async function fillReview(page:Page,cash='14',digital='0'){
  await page.getByRole('button',{name:'Review daily sales',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Daily Sales Review',exact:true});
  for(const box of await dialog.getByRole('checkbox').all())await box.check();
  await dialog.getByLabel('Cash counted for selected receipts').fill(cash);await dialog.getByLabel('GCash verified for selected receipts').fill(digital);
  return dialog;
}

test('Owner exact receipt review protects the draft and persists adjustment evidence after refresh without stock changes',async({page})=>{
  const cash=await buy(),gcash=await buy('Admin',true),before=await api.read();await open(page);
  const dialog=await fillReview(page,'24','14');await dialog.getByText('Opening change, cash movements and refunds',{exact:true}).click();await dialog.getByLabel('Opening change',{exact:true}).fill('10');
  await dialog.getByLabel('Review notes (optional)').fill('Verified both original receipts');await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Discard unsaved changes?'})).toBeVisible();await page.getByRole('button',{name:'Keep editing',exact:true}).click();
  await expect(dialog.getByLabel('Cash counted for selected receipts')).toHaveValue('24');await dialog.getByRole('button',{name:'Confirm reviewed sales',exact:true}).click();
  await expect(page.getByRole('status',{name:'Sales action result'})).toContainText('2 saved');
  expect((await state()).items.every((s:any)=>s.status==='Completed')).toBe(true);expect(await api.read()).toEqual(before);
  await page.reload();await page.getByRole('button',{name:'Audit Trail',exact:true}).click();await details(page,cash);
  await expect(page.getByRole('region',{name:'Recorded Daily Sales Review'})).toContainText('Expected Cash / GCash: ₱14.00 / ₱14.00');
  await expect(page.getByRole('region',{name:'Recorded Daily Sales Review'})).toContainText(gcash.saleId);
  await expect(page.getByRole('region',{name:'Recorded Daily Sales Review'})).toContainText('1 saved reconciliation adjustments');
  const receipt=await api.db.transaction(async tx=>{await checkoutAs(tx,api.ids.Owner);return checkoutValue(tx,'select public.read_checkout_receipt($1) as value',[cash.saleId]);});
  expect(receipt.status).toBe('Completed');expect(receipt.reviewState).toBe('Reviewed');expect(receipt.checkoutStatus).toBe('Pending');
});

test('Staff request, Admin rejection, renewed request and Admin approval retain the full history and original reasons',async({page,browser})=>{
  const sale=await buy();await open(page,'Staff');await details(page,sale);await page.getByRole('button',{name:'Request Void',exact:true}).click();
  await page.getByLabel('Reason for request').fill('Original mistaken item');await page.getByRole('button',{name:'Send void request',exact:true}).click();
  await expect(page.getByRole('status',{name:'Sales action result'})).toContainText('1 saved');
  const context=await browser.newContext(),admin=await context.newPage();await open(admin,'Admin');
  await admin.getByRole('button',{name:'Review daily sales',exact:true}).click();await expect(admin.getByRole('button',{name:'Confirm reviewed sales'})).toHaveCount(0);
  await expect(admin.getByRole('dialog').getByRole('checkbox')).toBeDisabled();await admin.getByRole('dialog').getByRole('button',{name:'Close dialog',exact:true}).click();
  await details(admin,sale);await admin.getByRole('button',{name:'Reject Request',exact:true}).click();await admin.getByLabel('Decision reason').fill('Checked the original receipt');await admin.getByRole('button',{name:'Reject request',exact:true}).click();
  await expect(admin.getByRole('status',{name:'Sales action result'})).toContainText('1 saved');
  await api.flushUpdates();await page.getByRole('button',{name:'Request Void',exact:true}).click();await page.getByLabel('Reason for request').fill('New evidence found');await page.getByRole('button',{name:'Send void request',exact:true}).click();
  await expect(page.getByRole('region',{name:'Order items, payment and review timeline'})).toContainText('New evidence found');
  await api.flushUpdates();await admin.getByRole('button',{name:'Approve Void',exact:true}).click();await admin.getByLabel('Decision reason').fill('Approved after evidence check');await admin.getByRole('button',{name:'Review void',exact:true}).click();
  await expect(admin.getByRole('dialog')).toContainText('This action cannot be undone');await admin.getByRole('button',{name:'Void order',exact:true}).click();
  await expect(admin.getByRole('region',{name:'Order items, payment and review timeline'})).toContainText('Voided by admin (Admin)');
  const saved=(await state()).items[0];expect(saved.requests.map((r:any)=>r.status)).toEqual(['Rejected','Approved']);expect(saved.events.filter((e:any)=>e.event_type==='Void requested')).toHaveLength(2);
  await context.close();
});

test('bulk selection spans pages and reports exact stale skips without silently substituting receipts',async({page})=>{
  const sales:{saleId:string;orderNumber:string}[]=[];for(let i=0;i<8;i++)sales.push(await buy());const before=await api.read();await open(page);
  await page.getByRole('checkbox',{name:'Select all eligible orders on this page'}).check();await page.getByRole('navigation',{name:'Transactions pagination'}).getByRole('button',{name:'Next',exact:true}).click();
  await page.getByRole('checkbox',{name:'Select all eligible orders on this page'}).check();await expect(page.getByText(/6 selected orders are outside/)).toBeVisible();
  await page.getByRole('button',{name:'Bulk Void',exact:true}).click();await command(sales[0].saleId,'void.request');
  await page.getByLabel('Decision reason').fill('Reviewed the eight exact selections');await page.getByRole('button',{name:'Review void',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('No payment refund or stock return');await page.getByRole('button',{name:'Void 8 orders',exact:true}).click();
  await expect(page.getByRole('status',{name:'Sales action result'})).toContainText('7 saved · 1 skipped');await expect(page.getByRole('status',{name:'Sales action result'})).toContainText('stale');
  const current=await state();expect(current.items.filter((s:any)=>s.status==='Voided')).toHaveLength(7);expect(current.items.find((s:any)=>s.id===sales[0].saleId).requests[0].status).toBe('Pending');expect(await api.read()).toEqual(before);
});

test('lost committed response restores the exact saved request through refresh and later failed retries',async({page})=>{
  const sale=await buy();await open(page,'Staff');await details(page,sale);let drop=true;
  await page.route('**/api/sales-workflow/commands',async route=>{if(drop){drop=false;await route.fetch();await route.abort('failed');}else await route.continue();});
  await page.getByRole('button',{name:'Request Void',exact:true}).click();await page.getByLabel('Reason for request').fill('One durable request');await page.getByRole('button',{name:'Send void request'}).click();
  await expect(page.getByRole('dialog',{name:'Reconcile saved sales action'})).toBeVisible();const original=await page.evaluate(()=>sessionStorage.getItem(Object.keys(sessionStorage).find(k=>k.startsWith('vertwell-sales-workflow:'))!));
  await page.reload();const recovery=page.getByRole('dialog',{name:'Reconcile saved sales action'});await expect(recovery).toBeVisible();
  await page.route('**/api/sales-workflow/commands',async route=>route.fulfill({status:401,json:{error:{message:'Retry session expired'}}}));await recovery.getByRole('button',{name:'Retry saved action'}).click();await expect(recovery).toContainText('Retry session expired');
  expect(await page.evaluate(()=>sessionStorage.getItem(Object.keys(sessionStorage).find(k=>k.startsWith('vertwell-sales-workflow:'))!))).toBe(original);
  await page.unroute('**/api/sales-workflow/commands');await recovery.getByRole('button',{name:'Retry saved action'}).click();await expect(recovery).toHaveCount(0);
  const saved=(await state()).items[0];expect(saved.requests).toHaveLength(1);expect(saved.events.filter((e:any)=>e.event_type==='Void requested')).toHaveLength(1);
});

test('a stale daily review retains counts, verified receipts and notes after another session voids one included sale',async({page})=>{
  const sale=await buy();await open(page);const dialog=await fillReview(page);await dialog.getByLabel('Review notes (optional)').fill('Keep this review draft');
  await command(sale.saleId);await dialog.getByRole('button',{name:'Confirm reviewed sales'}).click();await expect(dialog.getByRole('alert')).toContainText('changed');
  await expect(dialog.getByLabel('Cash counted for selected receipts')).toHaveValue('14');await expect(dialog.getByLabel('Review notes (optional)')).toHaveValue('Keep this review draft');await expect(dialog.getByRole('checkbox')).toBeChecked();
  expect((await state()).items[0].review).toBeNull();
});

test('Dashboard includes the combined review queue; saved history and dialogs fit desktop, short tablet and small phone',async({page})=>{
  const sale=await buy();await open(page);await page.getByRole('button',{name:'Dashboard',exact:true}).click();await expect(page.getByRole('region',{name:'Notifications and review'})).toContainText('1 awaiting Owner review');
  await page.getByRole('button',{name:'View all requests',exact:true}).click();await details(page,sale);
  const root=fileURLToPath(new URL('../../../.review/october-17-p7-browser/',import.meta.url));await mkdir(root,{recursive:true});
  for(const [width,height] of [[1440,900],[820,400],[320,568]]){
    await page.setViewportSize({width:width!,height:height!});await page.evaluate(()=>window.scrollTo(0,0));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:`${root}history-${width}.png`,fullPage:true});
  }
  await page.getByRole('button',{name:'Review daily sales'}).click();await expect(page.getByRole('dialog').getByRole('heading',{name:'Daily Sales Review',exact:true})).toBeInViewport();await expect(page.getByRole('dialog').getByRole('button',{name:'Close dialog'})).toBeInViewport();
  expect(await page.getByRole('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.screenshot({path:`${root}review-320.png`});
});
