import { before,after,beforeEach,afterEach,test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { testRealtime } from '../../../backend/scripts/test-realtime';
import { workflowFixture } from '../../../backend/scripts/sales-workflow-checks';
import { checkoutValue,checkoutAs } from '../../../backend/scripts/checkout-checks';
import { stockRecord,productRecord } from '../../../backend/scripts/inventory-checks';
import { decodeReports } from '../../src/lib/data/reports';
import { buildDurableReport,validReportFilters,exact,type ReportFilters } from '../../src/data/durable-reporting';
import { dashboardSales } from '../../src/lib/data/dashboard';
import { duplicateGroups } from '../../src/data/audit';

const db=new PGlite();let f:Awaited<ReturnType<typeof workflowFixture>>;
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await testRealtime(db);
  const root=new URL('../../../backend/supabase/migrations/',import.meta.url);
  for(const file of (await readdir(root)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,root),'utf8'));
});
after(()=>db.close());beforeEach(async()=>{await db.query('begin');f=await workflowFixture(db);});afterEach(()=>db.query('rollback'));
async function snapshot(){await checkoutAs(db,f.actors.owner);return decodeReports(await checkoutValue(db,'select public.read_reports() as value'));}
const filters=(today:string,patch:Partial<ReportFilters>={}):ReportFilters=>({start:today,end:today,startTime:'00:00',endTime:'23:59',category:'All categories',scope:'Combined',...patch});

test('P8A duplicate alerts distinguish original same-priced modifiers and nested bundle configurations',async()=>{
  await f.buy('owner');await f.buy('owner');const s=await snapshot();
  const [a,b]=s.tables.sale_items;
  Object.assign(a,{configuration_snapshot:{components:[{quantity:1,configuration:{name:'Included drink',modifiers:[{id:'tea',name:'Tea',price:'0.00'}]}}]}});
  Object.assign(b,{configuration_snapshot:{components:[{quantity:1,configuration:{name:'Included drink',modifiers:[{id:'coffee',name:'Coffee',price:'0.00'}]}}]}});
  assert.equal(duplicateGroups(dashboardSales(s),2,60).length,0);
  // Independent JSONB reads may serialize keys differently. Equivalent original
  // configurations still count as a candidate, without consulting the catalogue.
  Object.assign(b,{configuration_snapshot:{components:[{configuration:{modifiers:[{price:'0.00',name:'Tea',id:'tea'}],name:'Included drink'},quantity:1}]}});
  assert.equal(duplicateGroups(dashboardSales(s),2,60).length,1);
  const base={id:crypto.randomUUID(),sale_item_id:a.id,option_id:'tea',name:'Tea',price:'0.00',created_at:s.generatedAt};
  s.tables.sale_item_modifiers.push(base,{...base,id:crypto.randomUUID(),sale_item_id:b.id,option_id:'coffee',name:'Coffee'});
  assert.equal(duplicateGroups(dashboardSales(s),2,60).length,0);
  assert.equal(dashboardSales(s).find(sale=>sale.id===a.sale_id)!.lines[0].modifiers?.[0].name,'Tea');
});

test('P8 money and stock reconcile from exact saved records; paid Pending / voided usage remains consumed once',async()=>{
  const a=await f.buy(),b=await f.buy('owner');await f.execute(await f.voidCommand([b.saleId]));
  const s=await snapshot(),r=buildDurableReport(s,filters(s.businessDate)),balance=r.balances[0];
  assert.equal(r.total,0n);assert.equal(r.orderCount,2);assert.equal(balance.opening,10000000n);assert.equal(balance.used,2000000n);assert.equal(balance.closing,8000000n);
  assert.equal(balance.current,8000000n);assert.equal(balance.remainingPercent,80);assert.equal(balance.usedPercent,20);
  assert.equal(r.report.sections.find(s=>s.title==='Stocks used in the selected period')!.rows[0][1],'2');
  assert.ok(r.report.sections.find(s=>s.title==='Transactions')!.rows.some(row=>row.join(' ').includes(a.orderNumber)));
});
test('P8 time filters narrow sales/usage while stock balances and movements cover full days',async()=>{
  await f.buy('owner');const s=await snapshot();Object.assign(s.tables.sales[0],{occurred_at:`${s.businessDate}T04:00:00Z`});
  const r=buildDurableReport(s,filters(s.businessDate,{startTime:'08:00',endTime:'09:00'}));
  assert.equal(r.orderCount,0);assert.equal(r.total,0n);assert.equal(r.balances[0].used,1000000n);
  assert.equal(r.report.sections.find(s=>s.title==='All purchased stock usage')!.rows.length,0);
  assert.equal(r.report.sections.find(s=>s.title==='Stock movements · full business days')!.rows.length,2);
});
test('P8 receipts, signed corrections, returns, transfers and wastage enter the stock equation without duplicate usage',async()=>{
  await f.buy();const s=await snapshot(),base=s.tables.stock_movements.find(m=>m.kind==='Opening')!;
  for(const [kind,q] of [['Receipt','5'],['Correction','-2'],['Correction','3'],['Return','2'],['Transfer','-1'],['Wastage','-1']] as const)
    s.tables.stock_movements.push({...base,id:crypto.randomUUID(),kind,quantity_base:q,sale_item_id:null});
  const b=buildDurableReport(s,filters(s.businessDate)).balances[0];
  assert.equal(b.opening,10000000n);assert.equal(b.received,5000000n);assert.equal(b.otherIn,5000000n);assert.equal(b.otherOut,3000000n);
  assert.equal(b.used,1000000n);assert.equal(b.removed,1000000n);assert.equal(b.closing,15000000n);assert.equal(b.current,15000000n);assert.equal(b.remainingPercent,75);
});
test('P8 historical closing differs from current quantities, partial dates are named and absent openings never produce percentages',async()=>{
  await f.buy();const s=await snapshot(),old='2026-08-01';
  for(const m of s.tables.stock_movements)Object.assign(m,{occurred_at:`${old}T01:00:00Z`,business_date:old});
  Object.assign(s.tables.sales[0],{occurred_at:`${old}T01:00:00Z`});
  const base=s.tables.stock_movements[0];s.tables.stock_movements.push({...base,id:crypto.randomUUID(),kind:'Receipt',quantity_base:'5',sale_item_id:null,occurred_at:`${s.businessDate}T01:00:00Z`,business_date:s.businessDate});
  const b=buildDurableReport(s,filters(s.businessDate,{start:'2026-07-01',end:'2026-08-02'})).balances[0];
  assert.equal(b.partial,true);assert.equal(b.coverageStart,old);assert.equal(b.closing,9000000n);assert.equal(b.current,14000000n);
  const beforeHistory=buildDurableReport(s,filters(s.businessDate,{start:'2026-06-01',end:'2026-06-02'})).balances[0];
  assert.equal(beforeHistory.partial,false);assert.match(beforeHistory.issue,/No opening/);
  s.tables.stock_movements=s.tables.stock_movements.filter(m=>m.kind!=='Opening');
  const r=buildDurableReport(s,filters(s.businessDate));assert.match(r.balances[0].issue,/opening/);
  assert.ok(r.report.sections.find(s=>s.title.startsWith('Stock period balances'))!.rows[0].includes('Closing / percentages unknown'));
});
test('P8 review / payment / void evidence retains original sets and reasons instead of being summed or reallocated',async()=>{
  const a=await f.buy(),b=await f.buy('admin',true);await f.execute(await f.review([a.saleId,b.saleId],{countedCash:'22',openingCash:'10',explanation:'Counted shortage'}));
  await f.execute(await f.request(a.saleId,'Original reason'));await f.execute(await f.voidCommand([a.saleId],'Confirmed duplicate'));
  const s=await snapshot(),r=buildDurableReport(s,filters(s.businessDate));assert.equal(r.total,1400n);assert.equal(r.digital,1400n);assert.equal(r.cash,0n);
  const review=r.report.sections.find(s=>s.title.startsWith('Daily Sales Reviews'))!;assert.equal(review.rows.length,1);
  assert.match(review.rows[0].join(' '),/Counted shortage/);assert.ok(review.rows[0].join(' ').includes(a.saleId));assert.ok(review.rows[0].join(' ').includes(b.saleId));
  assert.match(r.report.sections.find(s=>s.title==='Void requests and decisions')!.rows[0].join(' '),/Original reason/);
  assert.ok(r.report.sections.find(s=>s.title==='Exceptions and missing history')!.rows.some(row=>row[1]==='Provider verification unavailable'));
});
test('P8 scope/category isolation and exact cent allocations preserve complementary totals; stock covers all categories',async()=>{
  await f.buy('owner');const s=await snapshot();
  const row=s.tables.sale_items[0];Object.assign(row,{unit_price:'0.01',original_unit_price:'0.01'});
  s.tables.sale_items.push({...row,id:crypto.randomUUID(),category:'Food',unit_price:'0.02',original_unit_price:'0.02'});
  Object.assign(s.tables.sales[0],{total:'0.05',subtotal:'0.03',tax_amount:'0.02'});
  const hobby=buildDurableReport(s,filters(s.businessDate,{category:'Hobby'})),food=buildDurableReport(s,filters(s.businessDate,{category:'Food and Beverage'}));
  assert.equal(hobby.total+food.total,5n);assert.equal(hobby.balances[0].used,food.balances[0].used);
  const only=buildDurableReport(s,filters(s.businessDate,{scope:'Inventory usage'}));assert.ok(!only.report.sections.some(s=>s.title==='Recorded payments'||s.title==='Sales summary'));
  assert.ok(!only.report.notes.some(n=>n.includes('GCash')));
  const sales=buildDurableReport(s,filters(s.businessDate,{scope:'Sales'}));assert.ok(!sales.report.sections.some(s=>s.title.startsWith('Stock period')));
});
test('P8 current usable excludes expired / unsellable stock but historical physical closing is preserved; unit conversion is per SKU',async()=>{
  const s=await snapshot();Object.assign(s.tables.stock_items[0],{unit_code:'kg'});Object.assign(s.tables.stock_batches[0],{expires_on:'2020-01-01'});
  const b=buildDurableReport(s,filters(s.businessDate)).balances[0];assert.equal(b.display(b.current),'0.01');assert.equal(b.usable,0n);assert.equal(b.closing,10000000n);assert.equal(b.attention,true);
  assert.equal(exact(0n,6),'0');assert.equal(exact(-1500000n,6),'-1.5');
});
test('P8 invalid ranges, malformed decimal responses and incomplete purchased history are explicit failures/disclosures',async()=>{
  await f.buy();const s=await snapshot();assert.equal(validReportFilters(filters(s.businessDate,{end:'2099-01-01'}),s.businessDate),false);
  assert.equal(validReportFilters(filters(s.businessDate,{startTime:'25:00'}),s.businessDate),false);
  assert.throws(()=>buildDurableReport(s,filters(s.businessDate,{start:'2026-02-30'})));
  const broken=structuredClone(s);(broken.tables.sales[0] as any).total=14;assert.throws(()=>decodeReports(broken));
  Object.assign(s.tables.sales[0],{usage_complete:false});const r=buildDurableReport(s,filters(s.businessDate));assert.ok(r.report.sections.at(-1)!.rows.some(row=>row[1]==='Incomplete stock history'));
});
test('P8 historical recipe/modifier consumption and original names survive later catalogue changes with exact kg/g conversion',async()=>{
  const ingredient=stockRecord({kind:'Ingredient',category:'Food',unit:'kg',name:'Original flour',batches:[{id:crypto.randomUUID(),quantityBase:'10000',manufactured:'2020-01-01',expires:'2090-01-01',unsellable:false}]});
  await f.save('stock.save',ingredient);
  const option={id:crypto.randomUUID(),name:'Extra flour',price:'1.00',defaultSelected:false,inputs:[{stockId:ingredient.id,quantity:'50',unit:'g'}]};
  const product=productRecord(ingredient,{sku:`P8-${crypto.randomUUID()}`,name:'Original recipe',model:'Recipe',category:'Food',manufactured:'2020-01-01',expires:'2090-01-01',stockId:null,
    recipe:[{stockId:ingredient.id,quantity:'0.1',unit:'kg'}],groups:[{id:crypto.randomUUID(),name:'Extra',min:'0',max:'1',options:[option]}]});
  await f.save('product.save',product);await f.checkout(await f.command([f.line(product,{modifierIds:[option.id]})]));
  product.name='Changed recipe';product.recipe[0].quantity='2';option.name='Changed option';option.inputs[0].quantity='300';await f.save('product.save',product);
  const s=await snapshot(),r=buildDurableReport(s,filters(s.businessDate));const row=r.report.sections.find(s=>s.title==='Ingredient usage by transaction')!.rows[0];
  assert.match(row.join(' '),/Original recipe/);assert.match(row.join(' '),/Extra flour/);assert.match(row.join(' '),/Original flour/);assert.equal(row[3],'150');assert.equal(row[4],'g');
  const balance=r.balances.find(b=>b.item.id===ingredient.id)!;assert.equal(balance.display(balance.used),'0.15');assert.equal(balance.display(balance.closing),'9.85');
});
