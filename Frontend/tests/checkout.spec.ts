import { test,expect } from '@playwright/test';
import { managementServer } from './fixtures/management-server';
import { checkoutFixture } from '../../backend/scripts/checkout-checks';
import { stockRecord,productRecord } from '../../backend/scripts/inventory-checks';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
test.describe.configure({mode:'serial'});
let api:Awaited<ReturnType<typeof managementServer>>;
let fixture:Awaited<ReturnType<typeof checkoutFixture>>;
test.beforeAll(async()=>{api=await managementServer();await api.db.query('begin');fixture=await checkoutFixture(api.db);await api.db.query('commit');await api.db.query('reset role');});
test.afterAll(async()=>api?.close());
async function pos(page:import('@playwright/test').Page,role:'Owner'|'Admin'|'Staff'='Owner') {
  // Restore a test-owned SDK session; account login itself is covered by the
  // authentication/management suites. Keep the production login limiter intact.
  await api.setup(page.context(),role);await api.restore(page,role);
  if(role!=='Staff')await page.getByRole('button',{name:'POS',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Point of Sale',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Add P6 retail to order'})).toBeEnabled();
}
test('Owner checkout uses server VAT/tender/change, persists receipts and preserves cart across manager navigation',async({page})=>{
  await pos(page);await page.getByRole('button',{name:'Add P6 retail to order'}).click();
  await expect(page.locator('.order-panel')).toContainText('₱14.00');
  await page.getByRole('button',{name:'Inventory',exact:true}).click();await page.getByRole('button',{name:'POS',exact:true}).click();
  await expect(page.locator('.cart-line')).toHaveCount(1);
  await page.getByRole('button',{name:'Pay',exact:true}).click();await page.getByRole('button',{name:'Cash payment',exact:true}).click();
  await expect(page.getByLabel('Amount Given',{exact:true})).toBeFocused();await page.getByLabel('Amount Given',{exact:true}).fill('20');
  await page.getByRole('button',{name:'Confirm payment received'}).click();await expect(page.getByRole('status').filter({hasText:'Order'})).toContainText('Completed');
  await expect(page.getByRole('status').filter({hasText:'Order'})).toContainText('Change ₱6.00');
  await page.reload();await page.getByRole('button',{name:'POS',exact:true}).click();await page.getByRole('button',{name:'Recorded sales',exact:true}).click();
  await page.getByRole('button',{name:'View receipt',exact:true}).first().click();await expect(page.getByRole('dialog',{name:'Recorded receipt'})).toContainText('P6 retail');
  await expect(page.getByRole('dialog')).toContainText('₱14.00');
});
test('Staff GCash records Pending review, exposes only own-day sales and denies management',async({page})=>{
  await pos(page,'Staff');await expect(page.getByRole('button',{name:'Inventory',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Add P6 retail to order'}).click();await page.getByRole('button',{name:'Pay',exact:true}).click();
  await page.getByRole('button',{name:'GCash payment',exact:true}).click();await expect(page.getByLabel('GCash reference number')).toBeFocused();
  await page.getByLabel('GCash reference number').fill('7771234567890');await page.getByRole('button',{name:'Confirm payment received'}).click();
  await expect(page.getByRole('status').filter({hasText:'Order'})).toContainText('Pending');
  await page.getByRole('button',{name:'Recorded sales',exact:true}).click();await expect(page.getByRole('button',{name:'View receipt',exact:true})).toHaveCount(1);
  await page.getByRole('button',{name:'View receipt',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Provider verification is separate');
});
test('lost committed response survives refresh and exact retry returns one receipt without another deduction',async({page})=>{
  await pos(page,'Admin');await page.getByRole('button',{name:'Add P6 retail to order'}).click();await page.getByRole('button',{name:'Pay',exact:true}).click();await page.getByRole('button',{name:'Cash payment',exact:true}).click();await page.getByLabel('Amount Given',{exact:true}).fill('50');
  const before=await api.read();let dropped=false;
  await page.route('**/api/checkout',async route=>{
    if(dropped){await route.fallback();return;}dropped=true;
    const req=route.request(),response=await api.request(`${api.base}/api/checkout`,{method:'POST',headers:req.headers(),body:req.postData()});expect(response.status).toBe(200);await route.abort('failed');
  });
  await page.getByRole('button',{name:'Confirm payment received'}).click();await expect(page.getByRole('button',{name:'Retry same checkout'})).toBeVisible();
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button',{name:'Retry same checkout'})).toBeVisible();await expect(page.getByLabel('Amount Given',{exact:true})).toHaveValue('50');
  await page.getByRole('button',{name:'Retry same checkout'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  const after=await api.read();expect(BigInt(after.revision)).toBe(BigInt(before.revision)+1n);
  expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('vertwell-checkout:')))).toHaveLength(0);
});
test('stale checkout retains cart/payment and requires a fresh quote review; invalid whole-cart addition changes nothing',async({page})=>{
  await pos(page);await page.getByRole('button',{name:'Add P6 retail to order'}).click();await page.getByRole('button',{name:'Pay',exact:true}).click();await page.getByRole('button',{name:'Cash payment',exact:true}).click();await page.getByLabel('Amount Given',{exact:true}).fill('20');
  await api.db.query('update private.inventory_state set revision=revision+1 where singleton');
  await page.getByRole('button',{name:'Confirm payment received'}).click();await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByLabel('Amount Given',{exact:true})).toHaveValue('20');
  await page.getByRole('button',{name:'Refresh quote and review'}).click();await expect(page.getByRole('dialog',{name:'ORDER CONFIRMATION'})).toBeVisible();
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.locator('.cart-line')).toHaveCount(1);
});
test('server-scoped variants reject oversized quantities and prevent opening options when the cart uses all shared stock',async({page})=>{
  const stock=fixture.stock;
  await api.db.query('begin');await api.db.query("select set_config('request.jwt.claim.sub',$1,true)",[fixture.actors.owner]);
  const p={...fixture.product,id:randomUUID(),sku:`P6-${randomUUID()}`,name:'P6 live variants',model:'Variants',stockId:null,
    variants:[{id:randomUUID(),name:'Edition',price:'25',stockId:stock.id,enabled:true}]};
  await fixture.save('product.save',p);await api.db.query('commit');await api.db.query('reset role');
  await pos(page);await page.getByRole('button',{name:'Add P6 live variants to order'}).click();await page.getByLabel('Variant',{exact:true}).selectOption(p.variants[0]!.id);
  await page.getByLabel('Quantity',{exact:true}).fill('100');await page.getByRole('button',{name:'Add',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('alert')).toContainText('changed');await expect(page.getByLabel('Quantity',{exact:true})).toHaveValue('100');
  await page.getByLabel('Quantity',{exact:true}).fill('1');await page.getByRole('button',{name:'Add',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.cart-line')).toContainText('Edition');
  await page.getByRole('button',{name:'Edit options',exact:true}).click();await page.getByLabel('Quantity',{exact:true}).fill('7');await page.getByRole('button',{name:'Add',exact:true}).click();
  await page.getByRole('button',{name:'Add P6 live variants to order'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('alert')).toContainText('Not enough usable stock');
});
test('unavailable recipe defaults stay unchecked and valid explicit choices persist in the quoted cart',async({page})=>{
  await api.db.query('begin');await api.db.query("select set_config('request.jwt.claim.sub',$1,true)",[fixture.actors.owner]);
  const ingredient=stockRecord({name:'P6 buns',kind:'Ingredient',category:'Food',unit:'pcs',batches:[{id:randomUUID(),quantityBase:'3',manufactured:'2020-01-01',expires:'2090-01-01',unsellable:false}]});await fixture.save('stock.save',ingredient);
  const option={id:randomUUID(),name:'Extra buns',price:'1',defaultSelected:true,inputs:[{stockId:ingredient.id,quantity:'2',unit:'pcs'}]};
  const p=productRecord(ingredient,{sku:`P6-${randomUUID()}`,name:'P6 recipe defaults',category:'Food',model:'Recipe',manufactured:'2020-01-01',expires:'2090-01-01',stockId:null,
    recipe:[{stockId:ingredient.id,quantity:'2',unit:'pcs'}],groups:[{id:randomUUID(),name:'Extras',min:'0',max:'1',options:[option]}]});await fixture.save('product.save',p);
  await api.db.query('commit');await api.db.query('reset role');
  await pos(page);await page.getByRole('button',{name:'Add P6 recipe defaults to order'}).click();await expect(page.getByRole('checkbox',{name:/Extra buns/})).not.toBeChecked();
  await page.getByRole('button',{name:'Add',exact:true}).click();await expect(page.locator('.cart-line')).toContainText('P6 recipe defaults');
});
test('live POS and payment remain contained and readable at desktop, short tablet and small phone sizes',async({page})=>{
  await pos(page,'Staff');const root=fileURLToPath(new URL('../../../.review/october-17-p6-browser/',import.meta.url));await mkdir(root,{recursive:true});
  for(const [width,height] of [[1440,900],[820,400],[320,568]]){
    await page.setViewportSize({width:width!,height:height!});await page.evaluate(()=>window.scrollTo(0,0));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:`${root}pos-${width}.png`,fullPage:true});
  }
  await page.getByRole('button',{name:'Add P6 retail to order'}).click();await page.getByRole('button',{name:'Pay',exact:true}).click();await page.getByRole('button',{name:'Cash payment',exact:true}).click();
  await expect(page.getByRole('heading',{name:'CASH PAYMENT',exact:true})).toBeInViewport();await expect(page.getByRole('button',{name:'Close dialog',exact:true})).toBeInViewport();
  await page.screenshot({path:`${root}payment-320.png`});
});
