import assert from 'node:assert/strict';
import type { PermissionDatabase } from './permission-checks.js';
import { checkoutAs,checkoutValue } from './checkout-checks.js';
import { workflowFixture,workflowRejects } from './sales-workflow-checks.js';

const read=(db:PermissionDatabase)=>checkoutValue(db,'select public.read_reports() as value');
export const reportScenarios:{name:string;run(db:PermissionDatabase):Promise<void>}[]=[
  {name:'P8 Owner/Admin coherent exact-decimal snapshots contain every saved sale, ledger and original review set',async run(db){
    const f=await workflowFixture(db),cash=await f.buy(),gcash=await f.buy('admin',true);
    await f.execute(await f.review([cash.saleId,gcash.saleId],{openingCash:'10',countedCash:'24'}));
    const before=await f.physical();await checkoutAs(db,f.actors.owner);const owner=await read(db);
    assert.equal(owner.version,1);assert.ok(Number.isFinite(Date.parse(owner.generatedAt)));
    const sale=owner.tables.sales.find((s:any)=>s.id===cash.saleId);assert.equal(sale.total,'14.00');assert.equal(sale.cashier_name,'P6 staff');
    assert.equal(typeof owner.tables.stock_movements[0].quantity_base,'string');
    const review=owner.tables.daily_sales_review_items.find((i:any)=>i.sale_id===cash.saleId);
    assert.deepEqual(owner.tables.daily_sales_review_items.filter((i:any)=>i.review_id===review.review_id).map((i:any)=>i.sale_id).sort(),[cash.saleId,gcash.saleId].sort());
    assert.ok(!Object.keys(owner.tables).some(k=>/profiles|auth|operations/.test(k)));
    await checkoutAs(db,f.actors.admin);assert.deepEqual((await read(db)).tables,owner.tables);
    assert.equal((await checkoutValue(db,'select public.business_access() as value')).services.reports,true);
    assert.deepEqual(await f.physical(),before);
  }},
  {name:'P8 Staff/inactive/anonymous/service and downgraded sessions cannot read report history or bypass direct ledger grants',async run(db){
    const f=await workflowFixture(db);
    for(const [id,role] of [[f.actors.staff,'authenticated'],[f.actors.inactive,'authenticated'],['','anon'],['','service_role']]){
      await checkoutAs(db,id!,role);await workflowRejects(db,()=>read(db),'42501');
    }
    await checkoutAs(db,f.actors.staff);assert.equal((await checkoutValue(db,'select public.business_access() as value')).services.reports,false);
    await db.query('reset role');await db.query("update public.profiles set role='Staff' where id=$1",[f.actors.admin]);await checkoutAs(db,f.actors.admin);
    await workflowRejects(db,()=>read(db),'42501');
    for(const table of ['stock_movements','daily_sales_reviews','cash_movements'])await workflowRejects(db,()=>db.query(`select * from public.${table}`),'42501');
  }},
  {name:'P8 reviewed and voided records retain purchased configurations, payments and deductions; reads append nothing',async run(db){
    const f=await workflowFixture(db),sale=await f.buy();await f.execute(await f.review([sale.saleId]));
    await f.execute(await f.request(sale.saleId,'Original report request'));await f.execute(await f.voidCommand([sale.saleId]));
    f.product.name='Renamed current catalogue';f.product.price='80';await f.save('product.save',f.product,{stock:{...f.stock,batches:f.stock.batches.map((b:any)=>({...b,quantityBase:'9'}))}});
    const before=await f.physical();await checkoutAs(db,f.actors.owner);const a=await read(db),b=await read(db);
    assert.deepEqual(a.tables,b.tables);const l=a.tables.sale_items.find((l:any)=>l.sale_id===sale.saleId);
    assert.equal(l.name,'P6 retail');assert.equal(l.unit_price,'12.50');
    assert.equal(a.tables.sales.find((s:any)=>s.id===sale.saleId).status,'Voided');
    assert.equal(a.tables.payments.find((p:any)=>p.sale_id===sale.saleId).amount,'14.00');
    assert.ok(a.tables.stock_movements.some((m:any)=>m.sale_item_id===l.id&&m.kind==='Consumption'));
    assert.deepEqual(await f.physical(),before);
  }},
  {name:'P8 complete snapshot does not inherit PostgREST row caps or workflow page limits',async run(db){
    const f=await workflowFixture(db);await db.query('reset role');
    // Test-owned rows within the caller's rollback transaction only.
    await db.query(`insert into public.stock_movements(batch_id,kind,quantity_base,actor_id,actor_name,actor_role,reason,operation_id)
      select $1,'Receipt',1,$2,'P8 owner','Owner','Complete report scope',gen_random_uuid() from generate_series(1,105)`,[f.stock.batches[0].id,f.actors.owner]);
    await checkoutAs(db,f.actors.owner);const r=await read(db);
    assert.equal(r.tables.stock_movements.filter((m:any)=>m.batch_id===f.stock.batches[0].id).length,106);
  }},
];
