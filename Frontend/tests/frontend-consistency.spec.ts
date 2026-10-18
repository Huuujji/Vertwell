import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {managementServer} from './fixtures/management-server';
import {checkoutFixture,checkoutAs} from '../../backend/scripts/checkout-checks';
import {stockRecord,productRecord} from '../../backend/scripts/inventory-checks';

test.describe.configure({mode:'serial'});
let api:Awaited<ReturnType<typeof managementServer>>,f:Awaited<ReturnType<typeof checkoutFixture>>;
const sizes=[[1440,900],[820,1180],[390,844],[320,568],[820,400]];
const output=fileURLToPath(new URL('../../../.review/october-18-consistency/visuals/',import.meta.url));
test.beforeAll(async()=>{api=await managementServer();await api.db.query('begin');f=await checkoutFixture(api.db);await api.db.query('commit');await api.db.query('reset role');await mkdir(output,{recursive:true});});
test.afterAll(()=>api?.close());
async function nav(page:Page,title:string){const button=page.getByRole('navigation').getByRole('button',{name:title,exact:true}).first();if(!await button.isVisible())await page.getByRole('button',{name:'Open navigation',exact:true}).click();await button.click();}
async function live(page:Page,role:'Owner'|'Admin'|'Staff'='Owner'){await api.setup(page.context(),role);await api.restore(page,role);await expect(page.getByRole('heading',{name:role==='Staff'?'Point of Sale':'Dashboard',exact:true})).toBeVisible();}
async function capture(page:Page,name:string){
  await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0);});await expect(page.locator('main p[role=status]:visible').filter({hasText:/^Loading/})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  for(const dialog of await page.getByRole('dialog').all())expect(await dialog.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,overflow:[...el.querySelectorAll('*')].filter(child=>child.getBoundingClientRect().right>el.getBoundingClientRect().right+1).map(child=>child.tagName+'.'+child.className)}))).toMatchObject({overflow:[]});
  if(name.includes('-details-')||name.includes('-selection-'))await page.locator('.details-panel').screenshot({path:`${output}/${name}.png`});else await page.screenshot({path:`${output}/${name}.png`,fullPage:true});
}

test('all fourteen permitted destinations use the frontend presentation with their own legitimate data at five sizes',async({browser})=>{
  test.setTimeout(300000);const errors:string[]=[];
  for(const role of ['Owner','Admin','Staff'] as const){
    const realContext=await browser.newContext(),previewContext=await browser.newContext(),real=await realContext.newPage(),preview=await previewContext.newPage();
    real.on('pageerror',e=>errors.push(e.message));preview.on('pageerror',e=>errors.push(e.message));await live(real,role);
    await preview.goto('/');await preview.getByLabel('Preview role').selectOption(role);await preview.getByRole('button',{name:'Open preview',exact:true}).click();
    if(role!=='Staff'){
      const realDates=await real.getByLabel('Sales from', {exact:true}).inputValue(),previewDates=await preview.getByLabel('Sales from',{exact:true}).inputValue();expect(realDates).toEqual(previewDates);
      await expect(real.locator('.report-summary')).toHaveCount(0);
    }
    for(const [width,height] of sizes){
      await real.setViewportSize({width,height});await preview.setViewportSize({width,height});
      for(const title of role==='Staff'?['POS','Today’s Sales History']:['Dashboard','Inventory','POS','Reports','Audit Trail','Users']){
        for(const [mode,page] of [['real',real],['preview',preview]] as const){
          await nav(page,title);await expect(page.locator('main h1:visible')).toHaveCount(1);await expect(page.getByRole('button',{name:/^Refresh/})).toHaveCount(0);
          if(title==='POS')await expect(page.locator('.total-row:visible')).toContainText('₱0.00');
          if(title==='Reports'){
            await expect(page.getByRole('button',{name:'Export report',exact:true})).toBeEnabled();
            const before=await page.getByRole('region',{name:'Transactions',exact:true}).evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('.ingredient-balances')!)&Node.DOCUMENT_POSITION_FOLLOWING));expect(before).toBe(true);
            await expect(page.locator('.ingredient-balances .record-count')).toContainText('balances available');
          }
          await capture(page,`${role}-${title.replaceAll(' ','-')}-${width}x${height}-${mode}`);
          if(title==='Reports'){
            await page.getByRole('button',{name:'Export report',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.locator('.export-facts')).toContainText('Combined');
            await expect(dialog.getByRole('heading',{name:'Sales summary',exact:true})).toBeVisible();await expect(dialog.getByRole('heading',{name:'Inventory summary',exact:true})).toBeVisible();await expect(dialog.locator('table')).toHaveCount(0);
            await capture(page,`${role}-export-${width}x${height}-${mode}`);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
          }
        }
        if(title==='POS'){
          const realHeading=await real.locator('.pos-title-row').boundingBox(),previewHeading=await preview.locator('.pos-title-row').boundingBox();
          expect(realHeading).not.toBeNull();expect(previewHeading).not.toBeNull();
          expect(Math.abs(realHeading!.height-previewHeading!.height),`${role} POS heading at ${width}×${height}`).toBeLessThan(1);
        }
      }
    }
    await realContext.close();await previewContext.close();
  }
  expect(errors).toEqual([]);
});

test('stock feedback explains selected ingredients, disables increments at whole-order limits and retains drafts after another session changes stock',async({page,browser})=>{
  test.setTimeout(120000);
  const ingredient=stockRecord({kind:'Ingredient',category:'Food',unit:'kg',name:'Consistency flour',batches:[{id:randomUUID(),quantityBase:'4000',manufactured:'2020-01-01',expires:'2090-01-01',unsellable:false}]});
  const option={id:randomUUID(),name:'Extra flour',price:'1.00',defaultSelected:true,inputs:[{stockId:ingredient.id,quantity:'3',unit:'kg'}]};
  const recipe=productRecord(ingredient,{name:'Consistency recipe',sku:`CR-${randomUUID()}`,model:'Recipe',category:'Food',stockId:null,manufactured:'2020-01-01',expires:'2090-01-01',
    recipe:[{stockId:ingredient.id,quantity:'3',unit:'kg'}],groups:[{id:randomUUID(),name:'Additions',min:'0',max:'1',options:[option]}]});
  await api.db.query('begin');await checkoutAs(api.db,f.actors.owner);await f.save('stock.save',ingredient);await f.save('product.save',recipe);await api.db.query('commit');await api.db.query('reset role');
  await live(page,'Staff');await page.getByRole('button',{name:'Add Consistency recipe to order',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:/Extra flour/})).not.toBeChecked();await expect(page.getByRole('checkbox',{name:/Extra flour/})).toBeDisabled();
  await expect(page.getByRole('region',{name:'Stock needed for this customization',exact:true})).toContainText('3 kg needed');await expect(page.getByRole('region',{name:'Stock needed for this customization',exact:true})).toContainText('1 kg usable after order');
  await expect(page.getByRole('button',{name:'Increase customization quantity',exact:true})).toBeDisabled();
  await page.getByLabel('Quantity',{exact:true}).fill('2');await expect(page.getByRole('region',{name:'Stock needed for this customization',exact:true})).toContainText('2 kg short for order');
  const otherContext=await browser.newContext(),other=await otherContext.newPage();await live(other,'Owner');await nav(other,'Inventory');await other.getByRole('button',{name:'All inventory',exact:true}).click();await other.getByLabel('Inventory category',{exact:true}).selectOption('All');
  await other.getByRole('button',{name:'Add stock to Consistency flour',exact:true}).click();await other.getByLabel('Quantity Added').fill('3');await other.getByLabel('Reason for receipt').fill('Independent stock delivery');
  await other.getByLabel('New Manufacturing Date',{exact:true}).fill('2020-01-01');await other.getByLabel('New Expiration Date',{exact:true}).fill('2090-01-01');
  await other.getByRole('button',{name:'Add Stock',exact:true}).click();await expect(other.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Quantity',{exact:true})).toHaveValue('2');await expect(page.getByRole('checkbox',{name:/Extra flour/})).not.toBeChecked();
  await expect(page.getByRole('region',{name:'Stock needed for this customization',exact:true})).toContainText('1 kg usable after order');
  for(const [width,height] of sizes){await page.setViewportSize({width,height});await capture(page,`Staff-stock-${width}x${height}-real`);}
  await page.getByRole('button',{name:'Add',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Add one Consistency recipe',exact:true})).toBeDisabled();await expect(page.locator('.total-row:visible')).toContainText('₱28.00');
  await page.getByRole('button',{name:'Pay',exact:true}).click();await expect(page.getByRole('dialog').locator('.receipt-total')).toContainText('₱28.00');
  await otherContext.close();expect((await api.db.query('select count(*)::int count from public.sales')).rows[0].count).toBe(0);
});

test('saved and preview order details, selection summaries and void review retain the established layout across roles and five sizes',async({browser})=>{
  test.setTimeout(180000);
  for(const role of ['Owner','Admin','Staff'] as const){await api.db.query('begin');await checkoutAs(api.db,api.ids[role]);await f.checkout(await f.command());await api.db.query('commit');await api.db.query('reset role');}
  for(const role of ['Owner','Admin','Staff'] as const){
    for(const mode of ['real','preview']){
      const context=await browser.newContext(),page=await context.newPage();
      if(mode==='real')await live(page,role);else{await page.goto('/');await page.getByLabel('Preview role').selectOption(role);await page.getByRole('button',{name:'Open preview',exact:true}).click();}
      if(mode==='real'){
        await nav(page,'POS');await page.getByRole('button',{name:'Recorded sales',exact:true}).click();await page.getByRole('button',{name:'View receipt',exact:true}).first().click();
        await expect(page.getByRole('dialog',{name:'Recorded receipt',exact:true}).locator('.detail-line').filter({hasText:'Total Due:'})).toContainText('₱14.00');
        for(const [width,height] of sizes){await page.setViewportSize({width,height});await expect(page.getByRole('button',{name:'Close receipt',exact:true})).toBeInViewport({ratio:1});await capture(page,`${role}-recorded-receipt-${width}x${height}-real`);}
        await page.getByRole('button',{name:'Close receipt',exact:true}).click();await page.setViewportSize({width:1440,height:900});
      }
      await nav(page,role==='Staff'?'Today’s Sales History':'Audit Trail');const rows=page.locator('.history-table:visible tbody tr');await expect(rows.first()).toBeVisible();await rows.first().getByRole('button',{name:/View order/}).click();
      const timestamp=rows.first().locator('time');
      await expect(timestamp).toHaveAttribute('datetime',/T/);await expect(timestamp).toHaveText(/\d+\/\d+\/\d+,? \d+:\d+ [AP]M/);
      await expect(page.locator('.details-panel .detail-line').filter({hasText:'Total Due:'})).toBeVisible();
      for(const [width,height] of sizes){await page.setViewportSize({width,height});await capture(page,`${role}-details-${width}x${height}-${mode}`);}
      await page.setViewportSize({width:1440,height:900});
      if(role!=='Staff'){
        await rows.first().getByRole('checkbox').check();await rows.nth(1).getByRole('checkbox').check();await expect(page.getByRole('region',{name:'Selection summary',exact:true})).toContainText('eligible for void');
        for(const [width,height] of sizes){await page.setViewportSize({width,height});await capture(page,`${role}-selection-${width}x${height}-${mode}`);}
        await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'Clear selection',exact:true}).click();
      }
      const button=page.locator('.details-footer .primary');if(await button.isEnabled()){
        await button.click();await expect(page.getByRole('dialog').locator('.receipt-total')).toContainText('Total Due:');
        for(const [width,height] of sizes){await page.setViewportSize({width,height});await capture(page,`${role}-void-${width}x${height}-${mode}`);}
        if(mode==='real'&&role!=='Staff'){
          await page.getByRole('button',{name:'Review void',exact:true}).click();await expect(page.getByRole('button',{name:'Go back',exact:true})).toBeFocused();
          for(const [width,height] of sizes){
            await page.setViewportSize({width,height});await expect(page.getByRole('button',{name:'Go back',exact:true})).toBeInViewport({ratio:1});await expect(page.getByRole('button',{name:'Void order',exact:true})).toBeInViewport({ratio:1});
            await capture(page,`${role}-final-void-${width}x${height}-${mode}`);
          }
        }
      }
      await context.close();
    }
  }
});

test('a Dashboard investigation opens its intended receipt without a competing prior audit selection',async({page})=>{
  await live(page);await nav(page,'Audit Trail');await page.getByLabel('Order status',{exact:true}).selectOption('Pending');
  const rows=page.locator('.history-table tbody tr');await rows.first().getByRole('checkbox').check();await rows.nth(1).getByRole('checkbox').check();
  await expect(page.getByRole('region',{name:'Selection summary',exact:true})).toBeVisible();await nav(page,'Dashboard');await page.getByRole('button',{name:'Overall',exact:true}).click();
  await page.locator('.recent .attention-link').first().click();await expect(page.getByLabel('Order status',{exact:true})).toHaveValue('All statuses');
  await expect(page.getByRole('region',{name:'Selection summary',exact:true})).toHaveCount(0);await expect(page.locator('.details-panel')).toContainText('Total Due:');
  await expect(page.locator('.history-table tbody tr.active-row')).toHaveCount(1);
});

test('populated saved reports share the ingredient balance and export review presentation at five sizes',async({page})=>{
  test.setTimeout(90000);
  const ingredient=stockRecord({kind:'Ingredient',category:'Food',unit:'kg',name:'Report flour',batches:[{id:randomUUID(),quantityBase:'5000',manufactured:'2020-01-01',expires:'2090-01-01',unsellable:false}]}),
    recipe=productRecord(ingredient,{name:'Report recipe',sku:`RF-${randomUUID()}`,category:'Food',model:'Recipe',stockId:null,manufactured:'2020-01-01',expires:'2090-01-01',recipe:[{stockId:ingredient.id,quantity:'1',unit:'kg'}]});
  await api.db.query('begin');await checkoutAs(api.db,f.actors.owner);await f.save('stock.save',ingredient);await f.save('product.save',recipe);
  await checkoutAs(api.db,api.ids.Owner);await f.checkout(await f.command([f.line(recipe,{quantity:'2'})]));await api.db.query('commit');await api.db.query('reset role');
  await live(page);await nav(page,'Reports');await expect(page.getByRole('button',{name:'Export report',exact:true})).toBeEnabled();
  const section=page.getByRole('region',{name:'Ingredient usage and remaining percentages',exact:true}),card=section.locator('article').filter({hasText:'Report flour'});
  await expect(card.locator('.balance-heading')).toContainText('60% remaining');await expect(card.getByRole('img')).toHaveAttribute('aria-label',/40% used, 60% remaining/);
  await expect(card.locator('.balance-values')).toContainText('Period closing3 kg');await expect(card.locator('.current-balance')).toContainText('3 kg physical · 3 usable');
  for(const [width,height] of sizes){
    await page.setViewportSize({width,height});await section.evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+scrollY-90));
    await page.screenshot({path:`${output}/Owner-stock-report-${width}x${height}-real.png`});
    await card.evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+scrollY-90));await card.screenshot({path:`${output}/Owner-stock-card-${width}x${height}-real.png`});
    await page.getByRole('button',{name:'Export report',exact:true}).click();await expect(page.getByRole('dialog').locator('.export-review-totals')).toContainText('ingredient period balances available');
    await capture(page,`Owner-stock-export-${width}x${height}-real`);await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  }
});

test('identical configured POS selections combine like preview while different choices remain separate and quotes preserve stock',async({page,browser})=>{
  test.setTimeout(120000);
  const a={id:randomUUID(),name:'Option A',price:'1.00',defaultSelected:false,inputs:[]},b={...a,id:randomUUID(),name:'Option B',price:'2.00'};
  const product=productRecord(f.stock,{name:'Merge options',sku:`MR-${randomUUID()}`,groups:[{id:randomUUID(),name:'Choose an extra',min:'0',max:'1',options:[a,b]}]});
  await api.db.query('begin');await checkoutAs(api.db,f.actors.owner);await f.save('product.save',product);await api.db.query('commit');await api.db.query('reset role');
  // Populated carts need the same readable purchased configuration as preview,
  // including long saved SKUs and Staff singular/plural counts at narrow widths.
  for(const role of ['Owner','Admin','Staff'] as const){
    const context=await browser.newContext(),cartPage=await context.newPage();await live(cartPage,role);await nav(cartPage,'POS');
    await cartPage.getByRole('button',{name:'Add Merge options to order',exact:true}).click();await cartPage.getByRole('checkbox',{name:/Option A/}).check();await cartPage.getByRole('button',{name:'Add',exact:true}).click();
    await expect(cartPage.getByRole('dialog')).toHaveCount(0);await expect(cartPage.locator('.cart-line')).toContainText(`SKU: ${product.sku}`);await expect(cartPage.locator('.cart-line')).toContainText('Option A · +₱1.00');
    if(role==='Staff')await expect(cartPage.locator('.order-count')).toHaveText('1 item');
    for(const [width,height] of sizes){await cartPage.setViewportSize({width,height});await capture(cartPage,`${role}-cart-${width}x${height}-real`);await cartPage.locator('.order-panel').screenshot({path:`${output}/${role}-cart-panel-${width}x${height}-real.png`});}
    await cartPage.getByRole('button',{name:'Add one Merge options',exact:true}).click();await expect(cartPage.locator('.cart-line output')).toHaveText('2');if(role==='Staff')await expect(cartPage.locator('.order-count')).toHaveText('2 items');
    await context.close();
  }
  const before=await api.read();await live(page);await nav(page,'POS');
  async function add(option:string){await page.getByRole('button',{name:'Add Merge options to order',exact:true}).click();await page.getByRole('checkbox',{name:new RegExp(option)}).check();await page.getByRole('button',{name:'Add',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
  await add('Option A');await add('Option A');await expect(page.locator('.cart-line')).toHaveCount(1);await expect(page.locator('.cart-line output')).toHaveText('2');await expect(page.locator('.total-row:visible')).toContainText('₱30.24');
  await add('Option B');await expect(page.locator('.cart-line')).toHaveCount(2);await page.locator('.cart-line').nth(1).getByRole('button',{name:'Edit options',exact:true}).click();
  await page.getByRole('checkbox',{name:/Option B/}).uncheck();await page.getByRole('checkbox',{name:/Option A/}).check();await page.getByRole('button',{name:'Update item',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.cart-line')).toHaveCount(1);await expect(page.locator('.cart-line output')).toHaveText('3');await expect(page.locator('.total-row:visible')).toContainText('₱45.36');
  await page.getByRole('button',{name:'Pay',exact:true}).click();await expect(page.getByRole('dialog').locator('.receipt-lines')).toContainText('3×');await expect(page.getByRole('dialog').locator('.receipt-total')).toContainText('₱45.36');
  expect(await api.read()).toEqual(before);
  const context=await browser.newContext(),preview=await context.newPage();await preview.goto('/');await preview.getByLabel('Preview role').selectOption('Owner');await preview.getByRole('button',{name:'Open preview',exact:true}).click();await nav(preview,'POS');
  await preview.getByRole('button',{name:'Add Butter Cookie Pouch to order',exact:true}).click();await preview.getByRole('button',{name:'Add Butter Cookie Pouch to order',exact:true}).click();await expect(preview.locator('.cart-line')).toHaveCount(1);await expect(preview.locator('.cart-line output')).toHaveText('2');await context.close();
});
