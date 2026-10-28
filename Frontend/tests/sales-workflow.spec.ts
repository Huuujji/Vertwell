import { test,expect,type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { managementServer } from './fixtures/management-server';
import { stockRecord,productRecord } from '../../backend/scripts/inventory-checks';
import { checkoutFixture,checkoutAs,checkoutValue } from '../../backend/scripts/checkout-checks';
type Role='Owner'|'Admin'|'Staff';
test.describe.configure({mode:'serial'});
let api:Awaited<ReturnType<typeof managementServer>>,fixture:Awaited<ReturnType<typeof checkoutFixture>>;
test.beforeEach(async()=>{api=await managementServer();await api.db.query('begin');fixture=await checkoutFixture(api.db);await api.db.query('commit');await api.db.query('reset role');});
test.afterEach(async()=>api?.close());
async function buy(role:Role='Staff',digital=false,quantity='1'){
  return api.db.transaction(async tx=>{
    await checkoutAs(tx,api.ids[role]);const lines=[fixture.line(fixture.product,{quantity})],q=await checkoutValue(tx,'select public.quote_checkout($1::jsonb) as value',[JSON.stringify(lines)]);
    return checkoutValue(tx,'select public.checkout($1::jsonb) as value',[JSON.stringify({operationId:randomUUID(),revision:q.revision,quoteToken:q.quoteToken,lines,
      payment:digital?{method:'GCash',amount:q.total,reference:'1234567890123'}:{method:'Cash',amount:q.total,cashTendered:quantity==='1'?'20':'100'}})]);
  });
}
async function state(){return api.db.transaction(async tx=>{await checkoutAs(tx,api.ids.Owner);return checkoutValue(tx,'select public.read_sales_workflow(0,100) as value');});}
async function command(saleId:string,kind='sale.void'){
  return api.db.transaction(async tx=>{
    await checkoutAs(tx,api.ids.Owner);const data=await checkoutValue(tx,'select public.read_sales_workflow(0,100) as value'),s=data.items.find((s:any)=>s.id===saleId);
    return checkoutValue(tx,'select public.sales_workflow_command($1::jsonb) as value',[JSON.stringify({operationId:randomUUID(),kind,targets:[{saleId:s.id,token:s.token}],reasonId:'other',notes:'Independent decision'})]);
  });
}
async function open(page:Page,role:Role='Owner'){
  await page.context().route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:5180'?route.fallback():route.abort('blockedbyclient'));

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

async function payoutHttp(saleId:string,patch:any={}){
 const s=(await state()).items.find((s:any)=>s.id===saleId);
 const c={operationId:randomUUID(),kind:'refund.record',targets:[{saleId:s.id,token:s.token}],reasonId:'refund_return',notes:'Disposable actual payout evidence',refund:{amount:'4',method:s.method,reference:randomUUID(),evidence:'Synthetic operator receipt',paidAt:new Date().toISOString(),paidConfirmed:true,...patch}};
 const send=(token=api.token(),value=c)=>api.request(`${api.base}/api/sales-workflow/commands`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(value)});
 return {c,send};
}
test('Adjustment 8 HTTP: partial limits, original method, permissions, normalized references and unchanged source',async()=>{
 const sale=await buy(),before=await api.read(),{c,send}=await payoutHttp(sale.saleId);
 expect((await send(api.recipientSession(api.ids.Staff).access_token)).status).toBe(403);
 for(const patch of [{amount:'0'},{amount:'14.01'},{amount:'0.001'},{method:'GCash'},{evidence:''},{paidConfirmed:false}])expect((await send(api.token(),{...c,operationId:randomUUID(),refund:{...c.refund,...patch}})).status).toBeGreaterThanOrEqual(400);
 expect((await send()).status).toBe(200);expect((await send()).status).toBe(200);expect((await send(api.token(),{...c,operationId:randomUUID()})).status).toBe(409);
 const duplicate=await payoutHttp(sale.saleId,{reference:c.refund.reference.toUpperCase()});expect((await duplicate.send()).status).toBeGreaterThanOrEqual(400);
 const rest=await payoutHttp(sale.saleId,{amount:'10'});expect((await rest.send()).status).toBe(200);expect((await (await payoutHttp(sale.saleId,{amount:'0.01'})).send()).status).toBe(409);
 const s=(await state()).items.find((s:any)=>s.id===sale.saleId);expect(s.refundBalance.remaining).toBe('0');expect(s.adjustments.refunds).toHaveLength(2);expect(s.adjustments.refunds.every((r:any)=>r.cash_movement_id&&r.payment_id)).toBe(true);expect(s.status).toBe('Pending');expect(await api.read()).toEqual(before);
});
test('Adjustment 8 browser: reviewed manual Cash payout, unsaved protection, lost response and exact account retry',async({page})=>{
 const sale=await buy(),before=await api.read();await open(page);await details(page,sale);await page.getByRole('button',{name:'Record manual refund',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Record an actual manual refund',exact:true});await expect(dialog).toContainText('Remaining refundable: ₱14.00');await expect(dialog).toContainText('matching the original received payment');await expect(dialog).toContainText(sale.saleId);
 await dialog.getByLabel('Amount actually paid back').fill('4');await dialog.getByLabel('Unique payout / refund receipt reference').fill('Cash-Payout-8');await dialog.getByLabel('Manual payout evidence').fill('Disposable signed cash receipt');
 await dialog.getByLabel('Actual payout time (Manila)').fill(new Date(Date.now()+8*3600000).toISOString().slice(0,19));await dialog.getByRole('checkbox').check();
 await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.getByRole('dialog',{name:'Discard unsaved changes?'})).toBeVisible();await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await dialog.getByRole('button',{name:'Review adjustment',exact:true}).click();const final=page.getByRole('dialog',{name:'Confirm reviewed adjustment',exact:true});await expect(final).toContainText('Proposed record (unsaved): ₱4');await expect(final).toContainText('Stock change: none. Sale status change: none.');
 await page.screenshot({path:fileURLToPath(new URL('../../../memory/backend/supabase/major-adjustments-evidence/2026-10-27-adjustment10/refund-review.png',import.meta.url))});
 let lost=true;await page.route('**/api/sales-workflow/commands',async route=>{if(lost){lost=false;await route.fetch();await route.abort('failed');}else await route.continue();});await final.getByRole('button',{name:'Confirm and record',exact:true}).click();
 const recovery=page.getByRole('dialog',{name:'Reconcile saved sales action'});await expect(recovery).toBeVisible();const saved=await page.evaluate(()=>sessionStorage.getItem(Object.keys(sessionStorage).find(k=>k.startsWith('vertwell-sales-workflow:'))!));await page.reload();await expect(recovery).toBeVisible();
 await page.route('**/api/sales-workflow/commands',route=>route.fulfill({status:401,json:{error:{message:'Retry session expired'}}}));await recovery.getByRole('button',{name:'Retry saved action'}).click();await expect(recovery).toContainText('Retry session expired');expect(await page.evaluate(()=>sessionStorage.getItem(Object.keys(sessionStorage).find(k=>k.startsWith('vertwell-sales-workflow:'))!))).toBe(saved);
 await page.unroute('**/api/sales-workflow/commands');await recovery.getByRole('button',{name:'Retry saved action'}).click();await expect(recovery).toHaveCount(0);await page.getByRole('button',{name:'Audit Trail',exact:true}).click();await details(page,sale);
 const evidence=page.getByRole('region',{name:'Recorded adjustments'});await expect(evidence).toContainText('Remaining refundable: ₱10.00');await expect(evidence).toContainText('Cash movement');await expect(evidence).toContainText('Provider transfer unverified');expect((await state()).items.find((s:any)=>s.id===sale.saleId).adjustments.refunds).toHaveLength(1);expect(await api.read()).toEqual(before);
 await page.getByRole('button',{name:'Record manual refund',exact:true}).click();await expect(page.getByRole('dialog',{name:'Record an actual manual refund'})).toContainText('Prior payout: ₱4.00');
});
test('Adjustment 8 browser: Admin GCash evidence stays manual and separate from review aggregates',async({page})=>{
 const sale=await buy('Staff',true);const prior=await payoutHttp(sale.saleId);expect((await prior.send(api.recipientSession(api.ids.Admin).access_token)).status).toBe(200);
 await open(page,'Admin');await details(page,sale);await expect(page.getByRole('region',{name:'Recorded adjustments'})).toContainText('GCash manual operator evidence only');await page.getByRole('button',{name:'Record manual refund',exact:true}).click();await expect(page.getByRole('dialog',{name:'Record an actual manual refund'})).toContainText('Refund method: GCash');await expect(page.getByRole('dialog')).toContainText('Remaining refundable: ₱10.00');
});
test('Adjustment 8 browser: daily aggregate reconciles an already recorded Cash payout without a second payout',async({page})=>{
 const sale=await buy(),payout=await payoutHttp(sale.saleId);expect((await payout.send()).status).toBe(200);await open(page);const dialog=await fillReview(page,'10','0');await expect(dialog.getByRole('region',{name:'Recorded manual payouts for selected receipts'})).toContainText(payout.c.refund.reference);
 await dialog.getByText('Opening change, cash movements and refunds',{exact:true}).click();await dialog.getByLabel('Cash refunds',{exact:true}).fill('4');await dialog.getByRole('button',{name:'Confirm reviewed sales',exact:true}).click();await expect(page.getByRole('status',{name:'Sales action result'})).toContainText('1 saved');await details(page,sale);
 await expect(page.getByRole('region',{name:'Recorded Daily Sales Review'})).toContainText('not additional payouts');const s=(await state()).items.find((s:any)=>s.id===sale.saleId);expect(s.refundBalance.refunded).toBe('4.00');expect(s.refundBalance.remaining).toBe('10.00');expect(s.adjustments.refunds).toHaveLength(1);expect(s.review.details.cashMovements).toHaveLength(1);expect(s.review.details.cashMovements[0].sale_id).toBeNull();
});

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
  await page.getByLabel('Extra notes (optional)').fill('Original mistaken item');await page.getByRole('button',{name:'Review request',exact:true}).click();await page.getByRole('button',{name:'Send void request',exact:true}).click();
  await expect(page.getByRole('status',{name:'Sales action result'})).toContainText('1 saved');
  const context=await browser.newContext(),admin=await context.newPage();await open(admin,'Admin');
  await admin.getByRole('button',{name:'Review daily sales',exact:true}).click();await expect(admin.getByRole('button',{name:'Confirm reviewed sales'})).toHaveCount(0);
  await expect(admin.getByRole('dialog').getByRole('checkbox')).toBeDisabled();await admin.getByRole('dialog').getByRole('button',{name:'Close dialog',exact:true}).click();
  await details(admin,sale);await admin.getByRole('button',{name:'Reject Request',exact:true}).click();await admin.getByLabel('Extra notes (optional)').fill('Checked the original receipt');await admin.getByRole('button',{name:'Review rejection',exact:true}).click();await admin.getByRole('button',{name:'Reject request',exact:true}).click();
  await expect(admin.getByRole('status',{name:'Sales action result'})).toContainText('1 saved');
  await api.flushUpdates();await page.getByRole('button',{name:'Request Void',exact:true}).click();await page.getByLabel('Extra notes (optional)').fill('New evidence found');await page.getByRole('button',{name:'Review request',exact:true}).click();await page.getByRole('button',{name:'Send void request',exact:true}).click();
  await expect(page.getByRole('region',{name:'Order items, payment and review timeline'})).toContainText('New evidence found');
  await api.flushUpdates();await admin.getByRole('button',{name:'Approve Void',exact:true}).click();await admin.getByLabel('Extra notes (optional)').fill('Approved after evidence check');await admin.getByRole('button',{name:'Review void',exact:true}).click();
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
  await page.getByLabel('Extra notes (optional)').fill('Reviewed the eight exact selections');await page.getByRole('button',{name:'Review void',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Stock remains deducted');await page.getByRole('button',{name:'Void 8 orders',exact:true}).click();
  await expect(page.getByRole('status',{name:'Sales action result'})).toContainText('7 saved · 1 skipped');await expect(page.getByRole('status',{name:'Sales action result'})).toContainText('stale');
  const current=await state();expect(current.items.filter((s:any)=>s.status==='Voided')).toHaveLength(7);expect(current.items.find((s:any)=>s.id===sales[0].saleId).requests[0].status).toBe('Pending');expect(await api.read()).toEqual(before);
});

test('lost committed response restores the exact saved request through refresh and later failed retries',async({page})=>{
  const sale=await buy();await open(page,'Staff');await details(page,sale);let drop=true;
  await page.route('**/api/sales-workflow/commands',async route=>{if(drop){drop=false;await route.fetch();await route.abort('failed');}else await route.continue();});
  await page.getByRole('button',{name:'Request Void',exact:true}).click();await page.getByLabel('Extra notes (optional)').fill('One durable request');await page.getByRole('button',{name:'Review request',exact:true}).click();await page.getByRole('button',{name:'Send void request'}).click();
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
  const root=fileURLToPath(new URL('../../../memory/backend/supabase/major-adjustments-evidence/2026-10-27-adjustment10/browser/',import.meta.url));await mkdir(root,{recursive:true});
  for(const [width,height] of [[1440,900],[820,400],[320,568]]){
    await page.setViewportSize({width:width!,height:height!});await page.evaluate(()=>window.scrollTo(0,0));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:`${root}history-${width}.png`,fullPage:true});
  }
  await page.getByRole('button',{name:'Review daily sales'}).click();await expect(page.getByRole('dialog').getByRole('heading',{name:'Daily Sales Review',exact:true})).toBeInViewport();await expect(page.getByRole('dialog').getByRole('button',{name:'Close dialog'})).toBeInViewport();
  expect(await page.getByRole('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.screenshot({path:`${root}review-320.png`});
});

test('six structured reasons and reason-only discard require review with the exact sale',async({page})=>{
  test.setTimeout(120_000);
  for(const reasonId of ['duplicate','incorrect_order','cancellation','refund_return','quality','other']){
    const sale=await buy();await open(page,'Staff');await details(page,sale);await page.getByRole('button',{name:'Request Void',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Request Void',exact:true});await expect(dialog.getByRole('combobox').locator('option')).toHaveCount(6);
    await dialog.getByRole('combobox').selectOption(reasonId);
    if(reasonId!=='duplicate'){
      await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('dialog',{name:'Discard unsaved changes?'})).toBeVisible();
      await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(dialog.getByRole('combobox')).toHaveValue(reasonId);
      await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Discard unsaved changes?'})).toBeVisible();await page.getByRole('button',{name:'Keep editing',exact:true}).click();
      await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.getByRole('dialog',{name:'Discard unsaved changes?'})).toBeVisible();await page.getByRole('button',{name:'Keep editing',exact:true}).click();
    }
    if(reasonId==='other'){
      await expect(dialog.getByRole('button',{name:'Review request',exact:true})).toBeDisabled();await dialog.getByLabel('Extra notes (required)').fill('...');
      await expect(dialog.getByRole('button',{name:'Review request',exact:true})).toBeDisabled();await dialog.getByLabel('Extra notes (required)').fill('Unusual customer correction');
    }
    const label=await dialog.getByRole('combobox').locator('option:checked').textContent();await dialog.getByRole('button',{name:'Review request',exact:true}).click();
    const final=page.getByRole('dialog',{name:'Confirm void request',exact:true});await expect(final).toContainText(label!);await expect(final).toContainText(sale.orderNumber);
    await final.getByRole('button',{name:'Send void request',exact:true}).click();await expect(page.getByRole('status',{name:'Sales action result'})).toContainText('1 saved');
    const saved=(await state()).items.find((s:any)=>s.id===sale.saleId);expect(saved.adjustments.decisions[0].reasonId).toBe(reasonId);expect(saved.adjustments.refunds).toHaveLength(0);
  }
});

test('direct manager correction validates reasons through HTTP and records no physical or payout action',async({page})=>{
  const sale=await buy(),snapshot=await state(),saved=snapshot.items.find((s:any)=>s.id===sale.saleId),before=await api.read();
  for(const [reasonId,notes] of [['invalid','explanation'],['other','...'],['other','   ']]){
    const response=await api.request(`${api.base}/api/sales-workflow/commands`,{method:'POST',headers:{authorization:`Bearer ${api.token()}`,'content-type':'application/json'},body:JSON.stringify({operationId:randomUUID(),kind:'sale.void',targets:[{saleId:saved.id,token:saved.token}],reasonId,notes})});
    expect(response.status).toBe(422);
  }
  await open(page);await details(page,sale);await page.getByRole('button',{name:'VOID',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'VOID ORDER',exact:true});await dialog.getByRole('combobox').selectOption('refund_return');
  await dialog.getByRole('button',{name:'Review void',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Customer refund / return');await expect(page.getByRole('dialog')).toContainText(sale.orderNumber);
  await page.screenshot({path:fileURLToPath(new URL('../../../memory/backend/supabase/major-adjustments-evidence/2026-10-27-adjustment10/reason-regression.png',import.meta.url))});
  await page.getByRole('button',{name:'Void order',exact:true}).click();await expect(page.getByRole('status',{name:'Sales action result'})).toContainText('1 saved');
  await expect(page.getByRole('region',{name:'Order items, payment and review timeline'})).toContainText('Customer refund / return');
  const current=(await state()).items.find((s:any)=>s.id===sale.saleId);expect(current.status).toBe('Voided');expect(current.adjustments.refunds).toHaveLength(0);expect(current.adjustments.dispositions).toHaveLength(0);expect(await api.read()).toEqual(before);
});

const physicalFacts=(condition:string,food=false)=>({foodOrBeverage:food,prepared:condition==='consumed'||condition==='waste',handedOver:['consumed','returned_sellable','returned_unsellable','not_returned'].includes(condition),returned:condition.startsWith('returned_'),physicallyPresent:['unused','returned_sellable','returned_unsellable'].includes(condition),sellable:['unused','returned_sellable'].includes(condition),additionalConsumption:false});
async function stockHttp(saleId:string,condition:string,food=false,extra:any={}){
 const s=(await state()).items.find((s:any)=>s.id===saleId),i=s.adjustableItems[0],u=i.usage[0];
 const c={operationId:randomUUID(),kind:'stock.dispose',reasonId:'refund_return',notes:'Disposable physical facts',targets:[{saleId:s.id,token:s.token}],dispositions:[{itemId:i.id,stockId:u.stockId,quantityBase:'1',condition,facts:physicalFacts(condition,food),evidence:'Quantity physically inspected',resalePolicyConfirmed:condition==='returned_sellable',...extra}]};
 const send=(token=api.token(),command=c)=>api.request(`${api.base}/api/sales-workflow/commands`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(command)});
 return {c,send};
}
test('Adjustment 6 HTTP: all stock conditions, packaged policy, role denials, invalid quantities and unchanged payments',async()=>{
 const paymentSnapshot=()=>api.db.transaction(async tx=>{await tx.query('reset role');return checkoutValue(tx,"select coalesce(jsonb_agg(to_jsonb(p) order by id),'[]') as value from public.payments p");});
 for(const condition of ['unused','returned_sellable','waste','consumed','not_returned','returned_unsellable']){
  const sale=await buy(),before=await paymentSnapshot(),{c,send}=await stockHttp(sale.saleId,condition);
  if(condition==='unused')c.reasonId='duplicate';
  const staff=api.recipientSession(api.ids.Staff).access_token;expect((await send(staff)).status).toBe(403);
  for(const quantityBase of ['0','2','1.5','-1'])expect((await send(api.token(),{...c,operationId:randomUUID(),dispositions:[{...c.dispositions[0],quantityBase}]})).status).toBeGreaterThanOrEqual(400);
  const response=await send();expect(response.status).toBe(200);expect((await send()).status).toBe(200);expect(await paymentSnapshot()).toEqual(before);
  const saved=(await state()).items.find((s:any)=>s.id===sale.saleId);expect(saved.adjustments.dispositions[0].physical_facts).toEqual(c.dispositions[0].facts);
 }
 const packaged=stockRecord({category:'Food',batches:[{id:randomUUID(),quantityBase:'10',manufactured:'2020-01-01',expires:'2099-12-31',unsellable:false}]});
 const product=productRecord(packaged,{sku:'PACKAGE-'+randomUUID(),category:'Food',manufactured:'2020-01-01',expires:'2099-12-31'});
 await api.db.query('begin');await checkoutAs(api.db,fixture.actors.owner);await fixture.save('stock.save',packaged);await fixture.save('product.save',product);await api.db.query('commit');await api.db.query('reset role');
 const foodBuy=()=>api.db.transaction(async tx=>{await checkoutAs(tx,api.ids.Owner);const lines=[fixture.line(product,{quantity:'2'})],q=await checkoutValue(tx,'select public.quote_checkout($1::jsonb) as value',[JSON.stringify(lines)]);return checkoutValue(tx,'select public.checkout($1::jsonb) as value',[JSON.stringify({operationId:randomUUID(),revision:q.revision,quoteToken:q.quoteToken,lines,payment:{method:'Cash',amount:q.total,cashTendered:'100'}})]);});
 for(const condition of ['unused','waste','consumed','returned_sellable']){
  const sale=await foodBuy(),before=await paymentSnapshot(),checks={factorySealed:true,shelfStable:true,packagingSound:true,uncontaminated:true,recallClear:true,expiryChecked:true};
  const {c,send}=await stockHttp(sale.saleId,condition,true,condition==='returned_sellable'?{packagedReturn:checks}:{});
  if(condition==='unused')c.reasonId='cancellation';
  if(condition==='returned_sellable')for(const key of Object.keys(checks))expect((await send(api.token(),{...c,operationId:randomUUID(),dispositions:[{...c.dispositions[0],packagedReturn:{...checks,[key]:false}}]})).status).toBe(422);
  expect((await send()).status).toBe(200);expect(await paymentSnapshot()).toEqual(before);
 }
});
test('Adjustment 6 browser: explicit physical facts, quantities and custody appear before confirmation and survive refresh',async({page})=>{
 const sale=await buy('Staff',false,'3');await open(page);await details(page,sale);await page.getByRole('button',{name:'Review stock disposition',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Review physical stock disposition',exact:true});
 await dialog.getByRole('button',{name:/Add quantity \/ condition/}).click();await dialog.getByLabel('Affected quantity (pcs)',{exact:true}).fill('1');await dialog.getByRole('combobox',{name:'Confirmed physical condition',exact:true}).selectOption('returned_unsellable');
 const f=physicalFacts('returned_unsellable');const labels={foodOrBeverage:'This input represents Food/Beverage (including a bundle component)',prepared:'Prepared for this order',handedOver:'Handed to the customer',returned:'Actually returned by the customer',physicallyPresent:'Physically present in shop custody',sellable:'Inspected and in sellable condition',additionalConsumption:'Additional physical consumption occurred for this record'};
 for(const [key,label] of Object.entries(labels))await dialog.getByRole('combobox',{name:label,exact:true}).selectOption(String(f[key as keyof typeof f]));
 await dialog.getByLabel('Physical evidence / inspection notes',{exact:true}).fill('One damaged Hobby unit returned and held in shop');
 await dialog.getByRole('button',{name:/Add quantity \/ condition/}).click();const second=dialog.getByRole('group',{name:'Quantity and physical facts',exact:true}).last();
 await second.getByLabel('Affected quantity (pcs)',{exact:true}).fill('1');await second.getByRole('combobox',{name:'Confirmed physical condition',exact:true}).selectOption('unused');const unused=physicalFacts('unused');
 for(const [key,label] of Object.entries(labels))await second.getByRole('combobox',{name:label,exact:true}).selectOption(String(unused[key as keyof typeof unused]));
 await second.getByLabel('Physical evidence / inspection notes',{exact:true}).fill('One different unit never handed over and physically available');

 await dialog.getByRole('button',{name:'Review adjustment',exact:true}).click();const final=page.getByRole('dialog',{name:'Confirm reviewed adjustment',exact:true});
 await expect(final).toContainText('Physical restoration: 0 pcs');await expect(final).toContainText('Physical restoration: 1 pcs');await expect(final).toContainText('Custody: Present in shop');await expect(final).toContainText('Waste classification: 0 pcs');await expect(final).toContainText(sale.orderNumber);
 await page.screenshot({path:fileURLToPath(new URL('../../../memory/backend/supabase/major-adjustments-evidence/2026-10-27-adjustment10/custody-review.png',import.meta.url))});
 await final.getByRole('button',{name:'Confirm and record',exact:true}).click();await expect(page.getByRole('status',{name:'Sales action result'})).toContainText('1 saved');
 await page.reload();await page.getByRole('button',{name:'Audit Trail',exact:true}).click();await details(page,sale);await expect(page.getByRole('region',{name:'Recorded adjustments'})).toContainText('Physically present in shop custody: Yes');
 const saved=(await state()).items.find((s:any)=>s.id===sale.saleId);expect(saved.adjustments.dispositions.map((d:any)=>d.condition).sort()).toEqual(['returned_unsellable','unused']);expect(saved.adjustments.refunds).toHaveLength(0);
});

test('Adjustment 6 browser: packaged resale policy is explicitly checked and reviewed',async({page})=>{
 const stock=stockRecord({category:'Beverage',batches:[{id:randomUUID(),quantityBase:'10',manufactured:'2020-01-01',expires:'2099-12-31',unsellable:false}]});const product=productRecord(stock,{sku:'PACKAGE-'+randomUUID(),category:'Beverage',manufactured:'2020-01-01',expires:'2099-12-31'});
 await api.db.query('begin');await checkoutAs(api.db,fixture.actors.owner);await fixture.save('stock.save',stock);await fixture.save('product.save',product);await api.db.query('commit');await api.db.query('reset role');
 const sale=await api.db.transaction(async tx=>{await checkoutAs(tx,api.ids.Staff);const lines=[fixture.line(product)],q=await checkoutValue(tx,'select public.quote_checkout($1::jsonb) as value',[JSON.stringify(lines)]);return checkoutValue(tx,'select public.checkout($1::jsonb) as value',[JSON.stringify({operationId:randomUUID(),revision:q.revision,quoteToken:q.quoteToken,lines,payment:{method:'Cash',amount:q.total,cashTendered:'100'}})]);});
 await open(page);await details(page,sale);await page.getByRole('button',{name:'Review stock disposition',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Review physical stock disposition',exact:true});
 await dialog.getByRole('button',{name:/Add quantity \/ condition/}).click();await dialog.getByLabel('Affected quantity (pcs)',{exact:true}).fill('1');await dialog.getByRole('combobox',{name:'Confirmed physical condition',exact:true}).selectOption('returned_sellable');
 const labels=['This input represents Food/Beverage (including a bundle component)','Prepared for this order','Handed to the customer','Actually returned by the customer','Physically present in shop custody','Inspected and in sellable condition','Additional physical consumption occurred for this record'];const values=['true','false','true','true','true','true','false'];
 for(let n=0;n<labels.length;n++)await dialog.getByRole('combobox',{name:labels[n]!,exact:true}).selectOption(values[n]!);
 await dialog.getByLabel('Physical evidence / inspection notes',{exact:true}).fill('Factory seal, shelf stability, packaging, recall status and original expiry inspected');
 for(const box of await dialog.getByRole('checkbox').all())await box.check();await dialog.getByRole('button',{name:'Review adjustment',exact:true}).click();const final=page.getByRole('dialog',{name:'Confirm reviewed adjustment',exact:true});
 await expect(final).toContainText('Physical restoration: 1 pcs');await expect(final).toContainText('Unopened original factory seal is intact: Yes');await expect(final).toContainText('Waste classification: 0 pcs');
 await page.setViewportSize({width:390,height:844});await expect(final.getByRole('heading')).toBeInViewport();expect(await final.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
 await page.screenshot({path:fileURLToPath(new URL('../../../memory/backend/supabase/major-adjustments-evidence/2026-10-27-adjustment10/packaged-review.png',import.meta.url))});
 await final.getByRole('button',{name:'Confirm and record',exact:true}).click();await expect(page.getByRole('status',{name:'Sales action result'})).toContainText('1 saved');const saved=(await state()).items.find((s:any)=>s.id===sale.saleId);expect(saved.adjustments.dispositions[0].physical_facts.packagedReturn.shelfStable).toBe(true);expect(saved.adjustments.refunds).toHaveLength(0);
});


test('Adjustment 7 browser: linked later return review, lost response, refresh and exact retry restore once',async({page})=>{
 const sale=await buy('Staff',false,'2');const initial=await stockHttp(sale.saleId,'not_returned');expect((await initial.send()).status).toBe(200);
 const prior=(await state()).items.find((s:any)=>s.id===sale.saleId).adjustments.dispositions[0];
 await open(page);await details(page,sale);await page.getByRole('button',{name:'Review stock disposition',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Review physical stock disposition',exact:true});await dialog.getByRole('button',{name:/Record later physical return/}).click();
 await dialog.getByLabel('Affected quantity (pcs)',{exact:true}).fill('1');await dialog.getByRole('combobox',{name:'Confirmed physical condition',exact:true}).selectOption('returned_sellable');
 const labels=['This input represents Food/Beverage (including a bundle component)','Prepared for this order','Handed to the customer','Actually returned by the customer','Physically present in shop custody','Inspected and in sellable condition','Additional physical consumption occurred for this record'];const values=['false','false','true','true','true','true','false'];
 for(let n=0;n<labels.length;n++)await dialog.getByRole('combobox',{name:labels[n]!,exact:true}).selectOption(values[n]!);
 await dialog.getByLabel('Physical evidence / inspection notes',{exact:true}).fill('Previously missing original Hobby unit returned and inspected');await dialog.getByRole('checkbox').check();
 await dialog.getByRole('button',{name:'Review adjustment',exact:true}).click();const final=page.getByRole('dialog',{name:'Confirm reviewed adjustment',exact:true});await expect(final).toContainText(prior.id);await expect(final).toContainText('Physical restoration: 1 pcs');
 await page.screenshot({path:fileURLToPath(new URL('../../../memory/backend/supabase/major-adjustments-evidence/2026-10-27-adjustment10/later-return-review.png',import.meta.url))});
 let lost=true;await page.route('**/api/sales-workflow/commands',async route=>{if(lost){lost=false;await route.fetch();await route.abort('failed');}else await route.continue();});
 await final.getByRole('button',{name:'Confirm and record',exact:true}).click();await expect(page.getByRole('dialog',{name:'Reconcile saved sales action'})).toBeVisible();
 const savedCommand=await page.evaluate(()=>sessionStorage.getItem(Object.keys(sessionStorage).find(k=>k.startsWith('vertwell-sales-workflow:'))!));
 await page.reload();const recovery=page.getByRole('dialog',{name:'Reconcile saved sales action'});await expect(recovery).toBeVisible();
 await page.route('**/api/sales-workflow/commands',route=>route.fulfill({status:401,json:{error:{message:'Retry session expired'}}}));await recovery.getByRole('button',{name:'Retry saved action'}).click();await expect(recovery).toContainText('Retry session expired');
 expect(await page.evaluate(()=>sessionStorage.getItem(Object.keys(sessionStorage).find(k=>k.startsWith('vertwell-sales-workflow:'))!))).toBe(savedCommand);
 await page.unroute('**/api/sales-workflow/commands');await recovery.getByRole('button',{name:'Retry saved action'}).click();await expect(recovery).toHaveCount(0);
 const current=(await state()).items.find((s:any)=>s.id===sale.saleId);expect(current.adjustments.dispositions).toHaveLength(2);expect(current.adjustments.dispositions.find((d:any)=>d.id===prior.id)).toEqual(prior);expect(current.adjustments.dispositions.find((d:any)=>d.source_disposition_id===prior.id).quantity_base).toBe('1.000000');
 const retry=await stockHttp(sale.saleId,'returned_sellable',false,{sourceDispositionId:prior.id});expect((await retry.send()).status).toBe(409);
 await page.getByRole('button',{name:'Audit Trail',exact:true}).click();await details(page,sale);await expect(page.getByRole('region',{name:'Recorded adjustments'})).toContainText('Later return linked to '+prior.id);
});
