import { test,expect,type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { managementServer } from './fixtures/management-server';
import { checkoutFixture,checkoutAs,checkoutValue } from '../../backend/scripts/checkout-checks';

test.describe.configure({mode:'serial',timeout:60000});
let api:Awaited<ReturnType<typeof managementServer>>, fixture:Awaited<ReturnType<typeof checkoutFixture>>;
const output=fileURLToPath(new URL('../../../memory/backend/supabase/major-adjustments-evidence/2026-10-27-adjustment10/live-updates/',import.meta.url));
test.beforeEach(async({context})=>{await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:5180'?route.fallback():route.abort('blockedbyclient'));api=await managementServer();await api.db.query('begin');fixture=await checkoutFixture(api.db);await api.db.query('commit');await api.db.query('reset role');await mkdir(output,{recursive:true});});
test.afterEach(()=>api?.close());
async function enter(page:Page,role:'Owner'|'Admin'|'Staff'='Owner'){
  await api.setup(page.context(),role);await api.restore(page,role);
  await expect(page.locator('.workspace')).toBeVisible();
  await expect(page.locator('.live-connection-status')).toHaveCount(0);
}
async function inventory(page:Page){await page.getByRole('button',{name:'Inventory',exact:true}).click();await page.getByRole('button',{name:'All inventory',exact:true}).click();await page.getByLabel('Inventory category',{exact:true}).selectOption('All');}
async function receive(page:Page,quantity='3'){
  await page.getByRole('button',{name:`Add stock to ${fixture.product.name}`,exact:true}).click();await page.getByLabel('Quantity Added').fill(quantity);await expect(page.getByLabel('Reason for receipt')).toHaveCount(0);await page.getByRole('button',{name:'Add Stock',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
}
test('private WebSocket inventory updates preserve filters and dirty draft revision across two sessions',async({page,browser})=>{
  await enter(page);await inventory(page);
  const other=await browser.newContext(),admin=await other.newPage();await enter(admin,'Admin');await inventory(admin);
  await page.getByLabel('Search inventory',{exact:true}).fill('P6');
  await receive(admin);await expect(page.getByRole('row').filter({hasText:'P6 retail'}).first()).toContainText('13');
  await expect(page.getByLabel('Search inventory',{exact:true})).toHaveValue('P6');
  await page.getByRole('button',{name:'Add Product',exact:true}).click();await page.getByLabel('Product Name',{exact:true}).fill('Unsaved socket draft');
  await expect(page.getByLabel('SKU',{exact:true})).toHaveCount(0);await page.getByLabel('Quantity',{exact:true}).fill('5');await page.getByLabel('Quantity Alert',{exact:true}).fill('2');await page.getByLabel('Price',{exact:true}).fill('12.50');await expect(page.getByLabel('Reason for stock change')).toHaveCount(0);
  await receive(admin,'2');await api.invalidate('vertwell:managers',['inventory']);
  await expect(page.getByLabel('Product Name',{exact:true})).toHaveValue('Unsaved socket draft');
  await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('alert')).toContainText(/changed|reload|review/i);
  await expect(page.getByLabel('Product Name',{exact:true})).toHaveValue('Unsaved socket draft');expect((await api.read()).tables.products.some((p:any)=>p.name==='Unsaved socket draft')).toBe(false);
  await other.close();
});
test('catalogue events keep the cart and payment fields; reconnect resynchronizes missed stock',async({page,browser})=>{
  const observations:string[]=[];
  page.on('request',request=>{if(request.url().endsWith('/api/operations/client-events'))observations.push(request.postDataJSON().event);});
  await enter(page,'Staff');await page.getByRole('button',{name:`Add ${fixture.product.name} to order`,exact:true}).click();await expect(page.locator('.cart-line')).toHaveCount(1);
  await page.getByRole('button',{name:'Pay',exact:true}).click();await page.getByRole('button',{name:'Cash payment',exact:true}).click();await page.getByLabel('Amount Given:',{exact:true}).fill('20');
  const other=await browser.newContext(),admin=await other.newPage();await enter(admin,'Admin');await inventory(admin);await receive(admin);
  await expect(page.getByLabel('Amount Given:',{exact:true})).toHaveValue('20');await expect(page.locator('.cart-line')).toHaveCount(1);
  api.disconnect();await api.invalidate('vertwell:catalogue',['catalogue']);await expect(page.locator('.live-connection-status')).toHaveCount(0,{timeout:15000});
  await expect.poll(()=>observations,{timeout:15000}).toContain('updates.offline');
  await expect.poll(()=>observations,{timeout:15000}).toContain('updates.recovered');
  await expect(page.getByLabel('Amount Given:',{exact:true})).toHaveValue('20');await expect(page.locator('.cart-line')).toHaveCount(1);await other.close();
});
test('an account role change resets private data scope and subscribes only to permitted topics',async({page})=>{
  await enter(page,'Admin');await page.getByRole('button',{name:'Users',exact:true}).click();await expect(page.getByRole('heading',{name:'User Management',exact:true})).toBeVisible();
  await api.db.transaction(async tx=>{await tx.query('reset role');const revision=(await tx.query<{updated_at:string}>('select updated_at::text from public.profiles where id=$1',[api.ids.Admin])).rows[0]!.updated_at;await checkoutAs(tx,api.ids.Owner);await checkoutValue(tx,'select public.update_account($1,$2,$3,$4,$5,$6) as value',[api.ids.Admin,revision,'Test Admin','admin','Staff',true]);});
  await api.flushUpdates();await expect(page.getByRole('button',{name:'Users',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Point of Sale',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Reports',exact:true})).toHaveCount(0);await expect(page.locator('.live-connection-status')).toHaveCount(0);
});
test('another cashier checkout and Owner review update Reports and Dashboard without repeating stock consumption',async({page,browser})=>{
  await enter(page);await page.getByRole('button',{name:'Reports',exact:true}).click();await expect(page.getByRole('button',{name:'Export report',exact:true})).toBeEnabled();
  const counterContext=await browser.newContext(),counter=await counterContext.newPage();await enter(counter,'Staff');
  const reviewContext=await browser.newContext(),review=await reviewContext.newPage();await enter(review);await review.getByRole('button',{name:'Dashboard',exact:true}).click();
  await counter.getByRole('button',{name:`Add ${fixture.product.name} to order`,exact:true}).click();await counter.getByRole('button',{name:'Pay',exact:true}).click();await counter.getByRole('button',{name:'Cash payment',exact:true}).click();await counter.getByLabel('Amount Given:',{exact:true}).fill('20');await counter.getByRole('button',{name:'Confirm payment received',exact:true}).click();
  await expect(page.getByRole('region',{name:'Transactions',exact:true})).toContainText('staff');await expect(review.getByRole('region',{name:'Notifications and review'})).toContainText('1 awaiting Owner review');
  await review.getByRole('button',{name:'Review daily sales',exact:true}).click();const dialog=review.getByRole('dialog',{name:'Daily Sales Review',exact:true});
  for(const box of await dialog.getByRole('checkbox').all())await box.check();await dialog.getByLabel('Cash counted for selected receipts').fill('14');await dialog.getByLabel('GCash verified for selected receipts').fill('0');await dialog.getByRole('button',{name:'Confirm reviewed sales',exact:true}).click();
  await expect(page.locator('.report-summary').first()).toContainText('₱14.00');await expect(review.getByRole('region',{name:'Notifications and review'})).toContainText('No sales awaiting review');
  const snapshot=await api.read();expect(snapshot.balances.reduce((sum:number,b:any)=>sum+Number(b.quantity_base),0)).toBe(9);await counterContext.close();await reviewContext.close();
});
test('account-only roles retain established components across desktop, tablet, phone and short screens',async({page,browser})=>{
  test.setTimeout(180000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  for(const role of ['Owner','Admin','Staff'] as const){
    const context=await browser.newContext(),live=await context.newPage();live.on('pageerror',error=>errors.push(error.message));await enter(live,role);
    for(const [width,height] of [[1440,900],[820,1180],[390,844],[320,568],[820,400]]){
      await live.setViewportSize({width,height});
      for(const destination of role==='Staff'?['POS','Today’s Sales History']:['Dashboard','Inventory','POS','Reports','Audit Trail','Users']){
        const nav=live.getByRole('button',{name:destination,exact:true}).first();
        if(!await nav.isVisible()){await live.getByRole('button',{name:/Open navigation/}).click();}
        await nav.click();await expect(live.getByRole('heading',{name:/Welcome,/})).toHaveCount(0);await expect(live.getByRole('button',{name:/^Refresh/})).toHaveCount(0);
        await live.screenshot({path:`${output}/${role}-${destination.replaceAll(' ','-')}-${width}x${height}.png`});
        expect(await live.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      }
    }
    await context.close();
  }
  expect(errors).toEqual([]);
});
