import { lockSalesReset, salesResetSnapshot, salesResetPreserved, resetSalesInsideTransaction } from '../scripts/sales-reset-data.js';
import { before,after,test } from 'node:test';
import { readFile,readdir,mkdir,mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { testRealtime } from '../scripts/test-realtime.js';
import { checkoutAs,checkoutValue } from '../scripts/checkout-checks.js';
import { workflowFixture,workflowScenarios } from '../scripts/sales-workflow-checks.js';
async function initialize(db:PGlite) {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await testRealtime(db);
  const root=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(root)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,root),'utf8'));
}
const db=new PGlite();before(()=>initialize(db));after(()=>db.close());
for(const scenario of workflowScenarios)test(scenario.name,async()=>{await db.query('begin');try{await scenario.run(db);}finally{await db.query('rollback');}});

test('P7 failure verification preserves retained reviews and cash evidence in a populated database',async()=>{
  await db.query('begin');
  try {
    const fixture=await workflowFixture(db),sale=await fixture.buy();
    await fixture.execute(await fixture.review([sale.saleId],{countedCash:'24',openingCash:'10'}));
    const before=await fixture.read();
    const scenario=workflowScenarios.find(scenario=>scenario.name.startsWith('P7 injected final audit failure'))!;
    await scenario.run(db);
    await checkoutAs(db,fixture.actors.owner);
    const after=await fixture.read();
    assert.deepEqual(after.items.find((row:any)=>row.id===sale.saleId),before.items.find((row:any)=>row.id===sale.saleId));
  } finally {await db.query('rollback');}
});
test('P7 reviews, adjustment evidence, repeated request decisions and operation replay survive disk close/reopen',async()=>{
  const parent=fileURLToPath(new URL('../../../.review/',import.meta.url));await mkdir(parent,{recursive:true});
  const path=await mkdtemp(`${parent}p7-database-`);let disk=new PGlite(path);
  try {
    await initialize(disk);await disk.query('begin');const f=await workflowFixture(disk),sale=await f.buy();
    const command=await f.review([sale.saleId],{countedCash:'24',openingCash:'10'});await f.execute(command);
    await f.execute(await f.request(sale.saleId,'Original request'));
    let current=(await f.read()).items.find((s:any)=>s.id===sale.saleId);
    await f.execute({operationId:crypto.randomUUID(),kind:'void.decide',targets:[await f.target(sale.saleId)],requestId:current.requests[0].id,approved:false,reason:'Original receipt checked'});
    await f.execute(await f.request(sale.saleId,'Renewed evidence'));await f.execute(await f.voidCommand([sale.saleId]));
    current=(await f.read()).items.find((s:any)=>s.id===sale.saleId);assert.deepEqual(current.requests.map((r:any)=>r.status),['Rejected','Approved']);
    const saved=await f.read();await disk.query('commit');await disk.close();disk=new PGlite(path);
    await disk.query('begin');await checkoutAs(disk,f.actors.owner);
    assert.deepEqual(await checkoutValue(disk,'select public.read_sales_workflow(0,100) as value'),saved);
    const replay=await checkoutValue(disk,'select public.sales_workflow_command($1::jsonb) as value',[JSON.stringify(command)]);assert.equal(replay.replayed,true);
    await disk.query('rollback');
  } finally {await disk.close();}
});

 test('frontend priority: reviewing one selected receipt with optional notes leaves other receipts pending',async()=>{
  await db.query('begin');try {
    const f=await workflowFixture(db),first=await f.buy(),second=await f.buy('admin',true);
    const result=await f.execute(await f.review([first.saleId],{countedCash:'13',explanation:''}));
    assert.equal(result.results.length,1);
    const sales=(await f.read()).items,review=sales.find((s:any)=>s.id===first.saleId).review;
    assert.equal(review.outcome,'Reviewed with discrepancy');assert.equal(review.details.explanation,'');
    assert.equal(Number(review.details.expected_cash),14);assert.equal(Number(review.details.expected_gcash),0);
    assert.equal(sales.find((s:any)=>s.id===second.saleId).status,'Pending');
  } finally {await db.query('rollback');}
 });
 test('sales reset removes transactions and retry receipts, preserves accounts/catalogue/balances, restores guards and rolls back',async()=>{
  await db.query('begin');try {
    const f=await workflowFixture(db),first=await f.buy(),second=await f.buy('admin',true);
    await f.execute(await f.review([first.saleId]));await f.execute(await f.request(second.saleId));
    await db.query('reset role');await lockSalesReset(db);
    const snapshot=await salesResetSnapshot(db),preserved=await salesResetPreserved(db);
    await db.query('savepoint reset_trial');await resetSalesInsideTransaction(db);
    assert.deepEqual(await salesResetPreserved(db),preserved);
    for(const table of ['public.sales','public.payments','public.sale_items','public.daily_sales_reviews','private.checkout_operations','private.sales_workflow_operations','private.review_notifications'])
      assert.equal((await db.query<{value:number}>('select count(*)::int as value from '+table)).rows[0]!.value,0);
    await db.query('savepoint guard_trial');await assert.rejects(()=>db.query("update public.stock_movements set reason='tampered'"),/append-only/);await db.query('rollback to guard_trial');
    const fresh=await f.buy();assert.equal(fresh.status,'Pending');
    await db.query('reset role');assert.equal((await db.query<{value:number}>('select count(*)::int as value from public.sales')).rows[0]!.value,1);
    await db.query('rollback to reset_trial');assert.deepEqual(await salesResetSnapshot(db),snapshot);
  } finally {await db.query('rollback');}
 });
