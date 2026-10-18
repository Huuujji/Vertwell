import { test,expect,type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir,readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { managementServer } from './fixtures/management-server';
import { checkoutFixture,checkoutAs,checkoutValue } from '../../backend/scripts/checkout-checks';
test.describe.configure({mode:'serial'});
let api:Awaited<ReturnType<typeof managementServer>>,fixture:Awaited<ReturnType<typeof checkoutFixture>>;
const output=fileURLToPath(new URL('../../..'+'/.review/october-17-p8-browser/',import.meta.url));
test.beforeEach(async()=>{api=await managementServer();await api.db.query('begin');fixture=await checkoutFixture(api.db);await api.db.query('commit');await api.db.query('reset role');await mkdir(output,{recursive:true});});
test.afterEach(()=>api?.close());
async function buy(role:'Owner'|'Admin'|'Staff'='Owner'){
  return api.db.transaction(async tx=>{await checkoutAs(tx,api.ids[role]);const lines=[fixture.line()],q=await checkoutValue(tx,'select public.quote_checkout($1::jsonb) as value',[JSON.stringify(lines)]);
    return checkoutValue(tx,'select public.checkout($1::jsonb) as value',[JSON.stringify({operationId:randomUUID(),revision:q.revision,quoteToken:q.quoteToken,lines,payment:{method:'Cash',amount:q.total,cashTendered:'20'}})]);});
}
async function open(page:Page,role:'Owner'|'Admin'='Owner'){
  await api.setup(page.context(),role);await api.restore(page,role);await page.getByRole('button',{name:'Reports',exact:true}).click();
  await expect(page.getByRole('button',{name:'Export report',exact:true})).toBeEnabled();
}
test('P8 Owner sees all saved receipts; complete scoped CSV and identical generated PDF/Print survive pagination',async({page})=>{
  const receipts:any[]=[];for(let i=0;i<7;i++)receipts.push(await buy());receipts.push(await buy('Staff'));
  const before=await api.read();await open(page);
  const transactions=page.getByRole('region',{name:'Transactions',exact:true});await expect(transactions.locator('tbody tr:visible')).toHaveCount(4);
  await page.getByRole('navigation',{name:'Transactions pagination'}).getByRole('button',{name:'Next',exact:true}).click();
  await expect(transactions.locator('tbody tr:visible')).toHaveCount(4);
  await page.getByLabel('Export format',{exact:true}).selectOption('CSV');await page.getByRole('button',{name:'Export report',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('8 matching orders');const csvEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();
  const csv=await csvEvent;await csv.saveAs(`${output}/combined.csv`);const text=await readFile(`${output}/combined.csv`,'utf8');
  for(const receipt of receipts)expect(text).toContain(receipt.orderNumber);expect(text).toContain('₱98.00');expect(text).not.toContain('sample data');
  await page.getByLabel('Export format',{exact:true}).selectOption('PDF');await page.getByRole('button',{name:'Export report',exact:true}).click();
  const pdfEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF',exact:true}).click();const pdf=await pdfEvent;await pdf.saveAs(`${output}/combined.pdf`);
  // Exercise the app's print branch with an observable viewer; physical printing is excluded.
  await page.evaluate(()=>{(window as any).__printBlob=null;window.open=(()=>({opener:null,document:{title:'',body:{textContent:''}},location:{replace:(url:string)=>{(window as any).__printBlob=url;}},close:()=>{}})) as any;});
  await page.getByRole('button',{name:'Print',exact:true}).click();await expect.poll(()=>page.evaluate(()=>Boolean((window as any).__printBlob))).toBe(true);
  const print=await page.evaluate(async()=>Array.from(new Uint8Array(await(await fetch((window as any).__printBlob)).arrayBuffer())));
  expect(Buffer.from(print)).toEqual(await readFile(`${output}/combined.pdf`));expect(await api.read()).toEqual(before);
});
test('P8 Admin inventory-only and sales/category filters keep scopes distinct and retain filters across navigation',async({page})=>{
  await buy('Admin');await open(page,'Admin');await page.getByLabel('Sales category',{exact:true}).selectOption('Food and Beverage');
  await expect(page.getByRole('region',{name:'Transactions',exact:true})).toContainText('No records in this scope.');
  await page.getByLabel('Report scope',{exact:true}).selectOption('Inventory usage');await expect(page.getByLabel('Sales category',{exact:true})).toBeDisabled();
  await expect(page.getByRole('region',{name:'Recorded payments',exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'All purchased stock usage',exact:true})).toContainText('P6 retail');
  await page.getByRole('button',{name:'Inventory',exact:true}).click();await page.getByRole('button',{name:'Reports',exact:true}).click();
  await expect(page.getByLabel('Report scope',{exact:true})).toHaveValue('Inventory usage');await expect(page.getByRole('button',{name:'Export report',exact:true})).toBeEnabled();
});
test('P8 Staff has no Reports or financial Dashboard and direct report scope/identity overrides are denied',async({page})=>{
  await api.setup(page.context(),'Staff');await api.restore(page,'Staff');await expect(page.getByRole('button',{name:'Today’s Sales History',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Reports',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Dashboard',exact:true})).toHaveCount(0);
  const status=await page.evaluate(async()=>{const session=JSON.parse(localStorage.getItem('sb-management-auth-token')!);return (await fetch('/api/reports',{headers:{Authorization:`Bearer ${session.access_token}`}})).status;});expect(status).toBe(403);
  const override=await api.request(`${api.base}/api/reports?actor=owner`,{headers:{Authorization:`Bearer ${api.token()}`}});expect(override.status).toBe(422);
});
test('P8 failed refresh keeps the saved report and filters but disables export without sample fallback',async({page})=>{
  const sale=await buy();await open(page);await page.getByLabel('Report scope',{exact:true}).selectOption('Sales');
  await page.route('**/api/reports',route=>route.fulfill({status:503,json:{error:{message:'Report source unavailable'}}}));await api.invalidate('vertwell:managers',['reports']);
  await expect(page.getByRole('alert')).toContainText('Report source unavailable');await expect(page.getByRole('button',{name:'Export report',exact:true})).toBeDisabled();
  await expect(page.getByRole('region',{name:'Transactions',exact:true})).toContainText(sale.orderNumber);await expect(page.getByLabel('Report scope',{exact:true})).toHaveValue('Sales');
  await page.unroute('**/api/reports');await api.invalidate('vertwell:managers',['reports']);await expect(page.getByRole('button',{name:'Export report',exact:true})).toBeEnabled();
});
test('P8 saved Dashboard retains Daily Sales Values and opens Reports with the same filters',async({page})=>{
  await buy();await api.setup(page.context());await api.restore(page);await page.getByRole('button',{name:'Dashboard',exact:true}).click();
  await page.getByRole('button',{name:'Overall',exact:true}).click();const overview=page.getByRole('region',{name:'Saved sales overview'});await expect(overview).toContainText('₱14.00');await overview.locator('summary').filter({hasText:'Daily sales values'}).click();
  await expect(overview.locator('.daily-values-scroll')).toContainText('₱14.00');await page.getByRole('button',{name:'Hobby',exact:true}).click();
  await overview.getByRole('button',{name:'View filtered report'}).click();await expect(page.getByLabel('Sales category',{exact:true})).toHaveValue('Hobby');
  await expect(page.getByRole('button',{name:'Export report',exact:true})).toBeEnabled();
  for(const [width,height] of [[1440,900],[820,400],[320,568]]){
    await page.setViewportSize({width,height});await page.screenshot({path:`${output}/reports-${width}x${height}.png`,fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});
