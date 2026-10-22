import { test, expect, type Page } from '@playwright/test';
import { managementServer } from './fixtures/management-server';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { stockRecord } from '../../backend/scripts/inventory-checks';
test.describe.configure({mode:'serial'});
let api:Awaited<ReturnType<typeof managementServer>>;
test.beforeAll(async()=>{api=await managementServer();});
test.afterAll(async()=>{await api?.close();});
async function openInventory(page:Page){await page.locator('.workspace').waitFor({state:'visible'});if(await page.getByRole('heading',{name:'Inventory',exact:true}).isVisible())return;if(await page.getByRole('button',{name:'Open navigation',exact:true}).isVisible())await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('button',{name:'Inventory',exact:true}).click();await expect(page.getByRole('heading',{name:'Inventory',exact:true})).toBeVisible();}
async function allInventory(page:Page) {
  await openInventory(page);
  await page.getByRole('button',{name:'All inventory',exact:true}).click();
  await page.getByLabel('Inventory category',{exact:true}).selectOption('All');
}
async function product(page:Page,name:string) {
  await openInventory(page);
  await page.getByRole('button',{name:'Add Product',exact:true}).click();
  await page.getByLabel('Product Name',{exact:true}).fill(name);
  await expect(page.getByLabel('SKU',{exact:true})).toHaveCount(0);
  await page.getByLabel('Quantity',{exact:true}).fill('10');await page.getByLabel('Quantity Alert',{exact:true}).fill('2');
  await page.getByLabel('Price',{exact:true}).fill('12.50');await expect(page.getByLabel('Reason for stock change',{exact:true})).toHaveCount(0);
}
test('real Express/PostgreSQL saves survive reload/login and are visible in a separate Admin session',async({page,browser})=>{
  await api.setup(page.context());await api.login(page);
  await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();await openInventory(page);
  await expect(page.getByRole('heading',{name:'Inventory',exact:true})).toBeVisible();
  await expect(page.getByText('Development workspace · saved business data is shared with permitted accounts.',{exact:true})).toHaveCount(0);
  await product(page,'Persistent Retail');await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByText('Persistent Retail',{exact:true}).first()).toBeVisible();
  await page.reload();await allInventory(page);await expect(page.getByText('Persistent Retail',{exact:true}).first()).toBeVisible();
  const context=await browser.newContext();await api.setup(context,'Admin');const other=await context.newPage();await api.login(other,'Admin');await allInventory(other);
  await expect(other.getByText('Persistent Retail',{exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Log out',exact:true}).click();await api.login(page);await allInventory(page);
  await expect(page.getByText('Persistent Retail',{exact:true}).first()).toBeVisible();
  const snapshot=await api.read();expect(snapshot.tables.products.some((p:any)=>p.name==='Persistent Retail')).toBe(true);
  await context.close();
});
test('lost receipt response keeps its draft and explicit retry records exactly one receipt',async({page})=>{
  await api.setup(page.context());await api.login(page);await allInventory(page);
  await page.getByRole('button',{name:'Add stock to Persistent Retail',exact:true}).click();
  await page.getByLabel('Quantity Added').fill('3');await expect(page.getByLabel('Reason for receipt')).toHaveCount(0);
  const before=await api.read();let lost=false;
  await page.route('**/api/inventory/commands',async route=>{
    if(lost){await route.fallback();return;}lost=true;
    const request=route.request();const response=await api.request(`${api.base}/api/inventory/commands`,{method:'POST',headers:request.headers(),body:request.postData()});
    expect(response.status).toBe(200);await route.abort('failed');
  });
  await page.getByRole('button',{name:'Add Stock',exact:true}).click();await expect(page.getByRole('alert')).toContainText('changes have been kept');
  await expect(page.getByLabel('Quantity Added')).toHaveValue('3');await page.getByRole('button',{name:'Add Stock',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const after=await api.read();expect(BigInt(after.revision)).toBe(BigInt(before.revision)+1n);
  const item=after.tables.stock_items.find((s:any)=>s.name==='Persistent Retail');
  const batches=after.tables.stock_batches.filter((b:any)=>b.stock_item_id===item.id&&b.archived_at===null);
  expect(batches).toHaveLength(2);expect(after.balances.filter((b:any)=>batches.some((x:any)=>x.id===b.batch_id)).reduce((sum:number,b:any)=>sum+Number(b.quantity_base),0)).toBe(13);
});
test('rejected product writes retain fields, session focus preserves drafts, and navigation asks before discarding',async({page})=>{
  await api.setup(page.context());await api.login(page);await product(page,'Retained Draft');
  const before=await api.read();await page.route('**/api/inventory/commands',route=>route.fulfill({status:409,json:{error:{message:'Inventory changed. Reload and review.'}}}));
  await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Inventory changed');
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByLabel('Product Name',{exact:true})).toHaveValue('Retained Draft');
  await expect(page.getByLabel('Reason for stock change')).toHaveCount(0);
  await page.getByRole('button',{name:'Users',exact:true}).click();await expect(page.getByRole('dialog',{name:'Discard unsaved changes?'})).toBeVisible();
  await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(page.getByLabel('Product Name',{exact:true})).toHaveValue('Retained Draft');
  expect(await api.read()).toEqual(before);
});
test('Users creates Auth/profile accounts, persists edits and deactivates with retained history; no preview code appears',async({page,browser})=>{
  await api.setup(page.context());await api.login(page);await page.getByRole('button',{name:'Users',exact:true}).click();
  await page.getByRole('button',{name:'Add User',exact:true}).click();await page.getByLabel('Full Name',{exact:true}).fill('Persistent Staff');
  await page.getByLabel('Username',{exact:true}).fill('persistent-staff');await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.getByLabel('Code',{exact:true})).toHaveCount(0);await page.getByLabel('Email Address',{exact:true}).fill('persistent-staff@example.invalid');
  await page.getByRole('button',{name:'Confirm',exact:true}).click();await page.getByLabel('Password',{exact:true}).fill('Test-password-456');await page.getByLabel('Confirm Password',{exact:true}).fill('Test-password-456');
  await page.getByRole('button',{name:'Add Account',exact:true}).click();await expect(page.getByRole('group',{name:'persistent-staff account',exact:true})).toBeVisible();
  await page.getByRole('group',{name:'persistent-staff account',exact:true}).getByRole('button',{name:'Manage',exact:true}).click();await page.getByLabel('Name',{exact:true}).fill('Updated Staff');
  await page.getByRole('button',{name:'Save',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Users',exact:true}).click();
  const row=page.getByRole('group',{name:'persistent-staff account',exact:true});await expect(row).toBeVisible();await row.getByRole('button',{name:'Manage',exact:true}).click();await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Updated Staff');
  await page.getByRole('button',{name:'Deactivate Account',exact:true}).click();await page.getByRole('button',{name:'Confirm deactivation',exact:true}).click();await expect(row).toContainText('Inactive');
  const context=await browser.newContext();await api.setup(context,'Admin');const other=await context.newPage();await api.login(other,'Admin');await other.getByRole('button',{name:'Users',exact:true}).click();
  await expect(other.getByRole('group',{name:'persistent-staff account',exact:true})).toContainText('Inactive');
  await context.close();
});
test('Staff cannot enter management and direct invalid/denied API writes change no inventory data',async({page})=>{
  await api.setup(page.context(),'Staff');await api.login(page,'Staff');await expect(page.getByRole('heading',{name:'Point of Sale',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Inventory',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Users',exact:true})).toHaveCount(0);
  const before=await api.read();
  const result=await page.evaluate(async()=>{
    const session=JSON.parse(localStorage.getItem('sb-management-auth-token')!);
    const response=await fetch('/api/inventory/commands',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${session.access_token}`},body:JSON.stringify({role:'Owner'})});
    return response.status;
  });expect(result).toBe(403);expect(await api.read()).toEqual(before);
});

test('library failures retain the draft; attached copies persist independently after library edits',async({page})=>{
  await api.setup(page.context());await api.login(page);await openInventory(page);await page.getByRole('button',{name:'Modifier groups',exact:true}).click();
  await page.getByRole('button',{name:'Add library group',exact:true}).click();await page.getByLabel('Group name',{exact:true}).fill('Persistent Library');
  await page.getByRole('button',{name:'Add option',exact:true}).click();await page.getByLabel('Option name',{exact:true}).fill('Original option');
  await page.route('**/api/inventory/commands',route=>route.fulfill({status:503,json:{error:{message:'Library service unavailable'}}}));
  await page.getByRole('button',{name:'Save group',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Library service unavailable');
  await expect(page.getByLabel('Group name',{exact:true})).toHaveValue('Persistent Library');
  await page.unroute('**/api/inventory/commands');await page.getByRole('button',{name:'Save group',exact:true}).click();
  await expect(page.getByRole('article',{name:'Persistent Library library group'})).toBeVisible();
  await page.getByRole('button',{name:'Back',exact:true}).click();await product(page,'Copy Product');
  await page.getByText('Reuse a library group',{exact:true}).click();await page.getByRole('combobox',{name:'Library group',exact:true}).selectOption({label:'Persistent Library'});
  await page.getByRole('button',{name:'Attach group to product',exact:true}).click();await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('button',{name:'Modifier groups',exact:true}).click();await page.getByRole('button',{name:'Edit library group Persistent Library',exact:true}).click();
  await page.getByLabel('Option name',{exact:true}).fill('Changed library option');await page.getByRole('button',{name:'Save group',exact:true}).click();
  const saved=await api.read(), parent=saved.tables.products.find((p:any)=>p.name==='Copy Product');
  const copy=saved.tables.modifier_groups.find((g:any)=>g.product_id===parent.id);expect(copy.source_group_id).toBeTruthy();
  expect(saved.tables.modifier_options.find((o:any)=>o.group_id===copy.id).name).toBe('Original option');
});
test('optional raster images upload, survive reload and can be removed without requiring a replacement',async({page})=>{
  await api.setup(page.context());await api.login(page);await product(page,'Photo Product');
  await page.getByLabel('Product photo',{exact:true}).setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jaiUAAAAASUVORK5CYII=','base64')});
  await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('heading',{name:'Inventory',exact:true})).toBeVisible();
  const saved=await api.read(), row=saved.tables.products.find((p:any)=>p.name==='Photo Product');expect(row.image_path).toMatch(/\.png$/);
  await page.reload();await allInventory(page);await page.getByLabel('Search inventory',{exact:true}).fill('Photo Product');
  await page.getByRole('button',{name:'Edit product Photo Product',exact:true}).click();
  await expect(page.getByAltText('Current photo')).toBeVisible();
  await expect.poll(()=>page.getByAltText('Current photo').evaluate(image=>(image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Remove photo',exact:true}).click();
  await page.getByLabel('Reason for stock change').fill('Update catalogue photo');await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Inventory',exact:true})).toBeVisible();
  expect((await api.read()).tables.products.find((p:any)=>p.id===row.id).image_path).toBeNull();
});
test('saved management screens and retained stock drafts stay contained on desktop, short tablet and small phone',async({page})=>{
  await api.setup(page.context());await api.restore(page);await page.getByRole('button',{name:'Inventory',exact:true}).click();await expect(page.getByRole('heading',{name:'Inventory',exact:true})).toBeVisible();
  const captures=new URL('../../../.review/october-17-p5/',import.meta.url);await mkdir(captures,{recursive:true});
  for(const viewport of [{width:1440,height:900},{width:820,height:400},{width:320,height:568}]) {
    await page.setViewportSize(viewport);await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:fileURLToPath(new URL(`inventory-${viewport.width}.png`,captures)),fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await product(page,'Responsive Draft');
  for(const viewport of [{width:1440,height:900},{width:820,height:400},{width:320,height:568}]) {
    await page.setViewportSize(viewport);await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:fileURLToPath(new URL(`draft-${viewport.width}.png`,captures)),fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByLabel('Product Name',{exact:true})).toHaveValue('Responsive Draft');
  }
});
test('unusable stock removal records the selected quantity and reason as a Removal movement',async({page})=>{
  const source=await api.read(),stock=stockRecord({name:'Expired verification stock'});
  stock.batches[0].manufactured='1999-01-01';stock.batches[0].expires='2000-01-01';
  const response=await api.request(`${api.base}/api/inventory/commands`,{method:'POST',headers:{authorization:`Bearer ${api.token()}`,'content-type':'application/json'},
    body:JSON.stringify({operationId:crypto.randomUUID(),revision:source.revision,kind:'stock.save',reason:'Disposable expired stock fixture',record:stock})});
  expect(response.status).toBe(200);
  await api.setup(page.context());await api.restore(page);await allInventory(page);
  await page.getByRole('button',{name:'Remove unusable stock from Expired verification stock',exact:true}).click();
  await page.getByLabel('Reason for removal',{exact:true}).fill('Expired stock physically removed');
  await page.getByRole('button',{name:'Confirm removal',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  const rows=(await api.db.query<{kind:string;quantity:string;reason:string}>("select kind,quantity_base::text as quantity,reason from public.stock_movements where batch_id=$1 and kind<>'Opening'",[stock.batches[0].id])).rows;
  expect(rows).toEqual([{kind:'Removal',quantity:'-10.000000',reason:'Expired stock physically removed'}]);
});
