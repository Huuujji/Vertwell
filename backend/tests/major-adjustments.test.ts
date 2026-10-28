import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { testRealtime } from '../scripts/test-realtime.js';
import { checkoutAs, checkoutValue } from '../scripts/checkout-checks.js';
import { workflowFixture, workflowRejects } from '../scripts/sales-workflow-checks.js';
import { stockRecord, productRecord } from '../scripts/inventory-checks.js';

const db=new PGlite();
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',email_confirmed_at timestamptz,confirmation_token text,confirmation_sent_at timestamptz,recovery_token text,recovery_sent_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await testRealtime(db);const root=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(root)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,root),'utf8'));
});
after(()=>db.close());

const manualPayout=(extra:Record<string,unknown>={})=>({amount:'4',method:'Cash',reference:randomUUID(),paidAt:new Date().toISOString(),evidence:'Disposable operator receipt evidence',paidConfirmed:true,...extra});
test('Adjustment 8 partial payouts cap original received money, link one Cash movement, retain reviews and never change stock or payments',()=>trial(async()=>{
 const f=await fixture(),before=await f.physical();await checkoutAs(db,f.actors.owner);
 const first=await f.command('refund.record',{refund:manualPayout()});await f.execute(first);assert.equal((await f.execute(first)).replayed,true);
 let s=await f.current();assert.equal(s.refundBalance.received,'14.00');assert.equal(s.refundBalance.refunded,'4.00');assert.equal(s.refundBalance.remaining,'10.00');assert.equal(s.adjustments.refunds[0].payment_id,s.refundBalance.paymentId);assert.ok(s.adjustments.refunds[0].cash_movement_id);
 const review=await f.review([s.id],{countedCash:'10',refunds:'4'});await f.execute(review);s=await f.current();assert.equal(s.review.details.refunds,'4.00');assert.equal(s.refundBalance.refunded,'4.00');assert.equal(s.refundBalance.remaining,'10.00');const savedReview=s.review;
 await f.execute(await f.command('refund.record',{refund:manualPayout({amount:'10'})}));s=await f.current();assert.equal(s.refundBalance.remaining,'0');assert.equal(s.adjustments.refunds.length,2);assert.deepEqual(s.review,savedReview);assert.equal(s.status,'Completed');assert.deepEqual(await f.physical(),before);
 await db.query('reset role');assert.equal(await checkoutValue(db,"select count(*)::int as value from public.cash_movements where kind='Refund' and sale_id=$1 and review_id is null",[s.id]),2);assert.equal(await checkoutValue(db,"select count(*)::int as value from public.cash_movements where kind='Refund' and review_id is not null"),1);
 await checkoutAs(db,f.actors.owner);await workflowRejects(db,async()=>f.execute(await f.command('refund.record',{refund:manualPayout({amount:'0.01'})})),'PT409');
}));
test('Adjustment 8 rejects invalid amounts, missing evidence, wrong method and payout times without mutation',()=>trial(async()=>{
 const f=await fixture();await checkoutAs(db,f.actors.owner);
 for(const patch of [{amount:'0'},{amount:'-1'},{amount:'14.01'},{amount:'0.001'},{amount:'NaN'},{amount:4},{method:'GCash'},{reference:'   '},{reference:'\t\n'},{evidence:''},{evidence:'\t\n'},{paidConfirmed:false},{paidAt:'2099-01-01T00:00:00Z'},{paidAt:'2020-01-01T00:00:00Z'}])await workflowRejects(db,async()=>f.execute(await f.command('refund.record',{refund:manualPayout(patch)})));
 assert.equal((await f.current()).adjustments.refunds.length,0);await db.query('reset role');assert.equal(await checkoutValue(db,"select count(*)::int as value from public.cash_movements where kind='Refund'"),0);
}));
test('Adjustment 8 changed IDs and formatted references cannot repeat a payout, even with refreshed tokens or changed notes',()=>trial(async()=>{
 const f=await fixture();await checkoutAs(db,f.actors.owner);const payout=manualPayout({reference:' Receipt-A 123 '});const c=await f.command('refund.record',{refund:payout});await f.execute(c);
 await workflowRejects(db,()=>f.execute({...c,operationId:randomUUID()}),'PT409');
 await workflowRejects(db,async()=>f.execute(await f.command('refund.record',{refund:{...payout,reference:'receipt-a123',paidAt:new Date().toISOString()}})),'23505');
 await workflowRejects(db,async()=>f.execute(await f.command('refund.record',{notes:'Different description',refund:{...payout,reference:randomUUID(),evidence:'Changed text'}})),'23505');
 assert.equal((await f.current()).adjustments.refunds.length,1);
 const other=await f.buy();await workflowRejects(db,async()=>f.execute({...await f.command('refund.record',{refund:manualPayout({reference:'RECEIPT-A123'})}),targets:[await f.target(other.saleId)]}),'23505');
}));
test('Adjustment 8 GCash and Admin records retain original method, evidence and history without Cash movements',()=>trial(async()=>{
 const f=await fixture(),sale=await f.buy('staff',true),before=await f.physical();await checkoutAs(db,f.actors.admin);
 const c={operationId:randomUUID(),kind:'refund.record',reasonId:'duplicate',notes:'Actual second payment evidence recorded separately',targets:[await f.target(sale.saleId)],refund:manualPayout({method:'GCash'})};await f.execute(c);
 const s=(await f.read()).items.find((s:any)=>s.id===sale.saleId);assert.equal(s.status,'Pending');assert.equal(s.adjustments.refunds[0].actor_role,'Admin');assert.equal(s.adjustments.refunds[0].providerVerified,false);assert.equal(s.adjustments.refunds[0].cash_movement_id,null);assert.equal(s.refundBalance.remaining,'10.00');assert.deepEqual(await f.physical(),before);
 await db.query('reset role');assert.equal(await checkoutValue(db,'select count(*)::int as value from public.cash_movements where sale_id=$1',[sale.saleId]),0);
 await checkoutAs(db,f.actors.staff);await workflowRejects(db,()=>f.execute(c),'42501');await workflowRejects(db,()=>db.query('select * from private.manual_refunds'),'42501');
}));
test('Adjustment 8 missing original payment fails closed and does not manufacture received-money evidence',()=>trial(async()=>{
 const f=await fixture();await db.query('reset role');await db.exec('alter table public.payments disable trigger user');await db.query('delete from public.payments where sale_id=$1',[f.sale.saleId]);await db.exec('alter table public.payments enable trigger user');await checkoutAs(db,f.actors.owner);
 assert.equal((await f.current()).refundBalance.received,null);assert.equal((await f.current()).refundBalance.remaining,null);await workflowRejects(db,async()=>f.execute(await f.command('refund.record',{refund:manualPayout()})),'PT409');assert.equal((await f.current()).adjustments.refunds.length,0);
}));
test('Adjustment 8 inconsistent payment amount fails closed and committed refund replay remains actor/content bound',()=>trial(async()=>{
 const f=await fixture();await checkoutAs(db,f.actors.owner);const c=await f.command('refund.record',{refund:manualPayout()});await f.execute(c);
 await workflowRejects(db,()=>f.execute({...c,notes:'Changed evidence context'}),'PT409');await checkoutAs(db,f.actors.admin);await workflowRejects(db,()=>f.execute(c),'PT409');
 await db.query('reset role');await db.exec('alter table public.payments disable trigger user');await db.query('update public.payments set amount=13,change_given=cash_tendered-13 where sale_id=$1',[f.sale.saleId]);await db.exec('alter table public.payments enable trigger user');await checkoutAs(db,f.actors.owner);
 assert.equal((await f.current()).refundBalance.received,null);await workflowRejects(db,async()=>f.execute(await f.command('refund.record',{refund:manualPayout()})),'PT409');assert.equal((await f.current()).adjustments.refunds.length,1);
}));
test('Adjustment 8 final audit failure rolls back payout, Cash movement and operation; exact retry commits once',()=>trial(async()=>{
 const f=await fixture();await db.query('reset role');await db.exec("create function public.fail_refund_audit() returns trigger language plpgsql as $$begin if new.details->>'manualRefund'='true' then raise exception 'Injected refund audit failure'; end if; return new; end$$;create trigger fail_refund_audit before insert on public.audit_events for each row execute function public.fail_refund_audit()");await checkoutAs(db,f.actors.owner);const c=await f.command('refund.record',{refund:manualPayout()});await workflowRejects(db,()=>f.execute(c),'P0001');
 await db.query('reset role');for(const table of ['private.manual_refunds','public.cash_movements','private.sale_adjustment_operations'])assert.equal(await checkoutValue(db,`select count(*)::int as value from ${table} where operation_id=$1`,[c.operationId]),0);await db.exec('drop trigger fail_refund_audit on public.audit_events');await checkoutAs(db,f.actors.owner);await f.execute(c);assert.equal((await f.execute(c)).replayed,true);
 await db.query('reset role');for(const table of ['private.manual_refunds','public.cash_movements','public.payments'])await workflowRejects(db,()=>db.query('delete from '+table));
}));
async function trial(run:()=>Promise<void>){await db.exec('begin');try{await run();}finally{await db.exec('rollback');}}
const factsFor=(condition:string)=>({foodOrBeverage:false,prepared:condition==='consumed',handedOver:['returned_sellable','returned_unsellable','consumed','not_returned'].includes(condition),returned:condition.startsWith('returned_'),physicallyPresent:['unused','returned_sellable','returned_unsellable'].includes(condition),sellable:['unused','returned_sellable'].includes(condition),additionalConsumption:false});
async function fixture(){
  const f=await workflowFixture(db);const sale=await f.buy();
  const current=async()=>(await f.read()).items.find((s:any)=>s.id===sale.saleId);
  const command=async(kind:string,extra:Record<string,unknown>={})=>({operationId:randomUUID(),kind,targets:[await f.target(sale.saleId)],reasonId:'refund_return',notes:'Disposable acceptance evidence',...extra});
  const dispose=async(condition:string,quantityBase='1',extra:Record<string,unknown>={})=>{const s=await current(),item=s.adjustableItems[0]!,usage=item.usage[0]!;
    return command('stock.dispose',{dispositions:[{itemId:item.id,stockId:usage.stockId,quantityBase,condition,facts:factsFor(condition),evidence:'Physical condition inspected in disposable fixture',resalePolicyConfirmed:condition==='returned_sellable',...extra}]});};
  const balance=async()=>{await db.query('reset role');const value=await f.balance();await checkoutAs(db,f.actors.owner);return value;};
  return {...f,sale,current,checkoutCommand:f.command,command,dispose,balance};
}
for(const condition of ['unused','returned_sellable','waste','consumed','not_returned','returned_unsellable'])test(`major adjustments: ${condition} follows actual condition without a second deduction`,()=>trial(async()=>{
  const f=await fixture(),before=Number(await f.balance());const c=await f.dispose(condition);await f.execute(c);
  await db.query('reset role');assert.equal(Number(await f.balance()),before+(['unused','returned_sellable'].includes(condition)?1:0));
  await checkoutAs(db,f.actors.owner);const s=await f.current();assert.equal(s.status,'Pending');assert.equal(s.adjustments.dispositions.length,1);
  assert.equal(s.adjustments.dispositions[0]!.condition,condition);assert.equal(s.adjustments.refunds.length,0);
  assert.equal((await f.execute(c)).replayed,true);await db.query('reset role');assert.equal(Number(await f.balance()),before+(['unused','returned_sellable'].includes(condition)?1:0));
}));
test('major adjustments: structured correction does not infer consumption or customer payout',()=>trial(async()=>{
  const f=await fixture(),before=Number(await f.balance());
  await f.execute(await f.command('sale.void',{reasonId:'duplicate',notes:''}));
  const s=await f.current();assert.equal(s.status,'Voided');assert.equal(s.adjustments.decisions[0]?.reasonId,'duplicate');assert.equal(s.adjustments.refunds.length,0);
  await db.query('reset role');assert.equal(Number(await f.balance()),before);
  await checkoutAs(db,f.actors.owner);await workflowRejects(db,()=>f.execute({...f.command,operationId:randomUUID(),kind:'sale.void',targets:[{saleId:s.id,token:s.token}],reason:'loose text'}),'22023');
}));
test('major adjustments: remaining original quantities, stale tokens, actor/content replay and rollback are enforced',()=>trial(async()=>{
  const f=await fixture(),first=await f.dispose('unused'),stale=await f.dispose('waste');await f.execute(first);
  await workflowRejects(db,()=>f.execute(stale),'PT409');
  await workflowRejects(db,()=>f.execute({...first,notes:'changed'}),'PT409');
  await workflowRejects(db,async()=>f.execute(await f.dispose('unused')),'PT409');
  const second=await f.buy();const fresh=(await f.read()).items.find((s:any)=>s.id===second.saleId),item=fresh.adjustableItems[0]!,u=item.usage[0]!;
  const bad={operationId:randomUUID(),kind:'stock.dispose',targets:[await f.target(second.saleId)],reasonId:'quality',notes:'Rollback check',dispositions:[
    {itemId:item.id,stockId:u.stockId,quantityBase:'1',condition:'unused',facts:factsFor('unused'),evidence:'unused quantity',resalePolicyConfirmed:false},
    {itemId:item.id,stockId:u.stockId,quantityBase:'1',condition:'unused',facts:factsFor('unused'),evidence:'excess quantity',resalePolicyConfirmed:false}]};
  const before=await f.physical();await checkoutAs(db,f.actors.owner);await workflowRejects(db,()=>f.execute(bad),'PT409');assert.deepEqual(await f.physical(),before);
}));
test('major adjustments: prepared recipe cannot be returned as sellable ingredients; unit and batch snapshots survive catalogue edits',()=>trial(async()=>{
  const f=await fixture();
  const stock=stockRecord({name:'Original flour',kind:'Ingredient',category:'Food',unit:'kg',batches:[{id:randomUUID(),quantityBase:'10000',manufactured:'2026-10-01',expires:'2099-12-31',unsellable:false}]});
  await f.save('stock.save',stock);
  const product=productRecord(stock,{sku:'RECIPE-'+randomUUID(),name:'Original meal',category:'Food',manufactured:'2026-10-01',expires:'2099-12-31',model:'Recipe',stockId:null,recipe:[{stockId:stock.id,quantity:'0.25',unit:'kg'}]});
  await f.save('product.save',product);const receipt=await f.checkout(await f.checkoutCommand([f.line(product,{quantity:'2'})]));
  await f.save('product.save',{...product,recipe:[{stockId:stock.id,quantity:'1',unit:'kg'}]});
  const current=(await f.read()).items.find((s:any)=>s.id===receipt.saleId),item=current.adjustableItems[0]!,u=item.usage[0]!;
  assert.equal(Number(u.quantity),500);assert.equal(u.unit,'g');
  const make=(condition:string)=>({operationId:randomUUID(),kind:'stock.dispose',targets:[{saleId:current.id,token:current.token}],reasonId:'cancellation',notes:'Prepared condition checked',dispositions:[{itemId:item.id,stockId:u.stockId,quantityBase:'250',condition,facts:factsFor(condition),evidence:'Actual half quantity checked',resalePolicyConfirmed:true}]});
  await workflowRejects(db,()=>f.execute(make('returned_sellable')),'22023');await f.execute(make('unused'));
  await db.query('reset role');assert.equal(Number(await checkoutValue(db,'select sum(quantity_base)::text as value from public.stock_movements where batch_id=$1',[stock.batches[0].id])),9750);
}));
test('major adjustments: manual refund limits and unique evidence do not void sales or change stock',()=>trial(async()=>{
  const f=await fixture(),before=await f.physical();await checkoutAs(db,f.actors.owner);
  const refund={amount:'7',method:'Cash',reference:'PAYOUT-'+randomUUID(),paidAt:new Date(Date.now()+1).toISOString(),evidence:'Manual cash receipt inspected',paidConfirmed:true};
  const c=await f.command('refund.record',{refund});await f.execute(c);assert.equal((await f.execute(c)).replayed,true);
  const s=await f.current();assert.equal(s.status,'Pending');assert.equal(s.adjustments.refunds.length,1);assert.equal(s.adjustments.refunds[0]!.amount,'7.00');
  await workflowRejects(db,async()=>f.execute(await f.command('refund.record',{refund:{...refund,amount:'8',reference:randomUUID()}})),'PT409');
  await workflowRejects(db,async()=>f.execute(await f.command('refund.record',{refund})),'23505');
  assert.deepEqual(await f.physical(),before);
}));
test('major adjustments: Staff cannot dispose stock/refund, Other requires notes, and report evidence is authorized',()=>trial(async()=>{
  const f=await fixture(),c=await f.dispose('unused');await checkoutAs(db,f.actors.staff);await workflowRejects(db,()=>f.execute(c),'42501');
  await workflowRejects(db,()=>checkoutValue(db,'select public.read_reports() as value'),'42501');await checkoutAs(db,f.actors.owner);
  await workflowRejects(db,()=>f.execute({...c,reasonId:'other',notes:''}),'22023');await f.execute(c);
  const snapshot=await checkoutValue(db,'select public.read_reports() as value');
  assert.equal(snapshot.adjustments.find((a:any)=>a.saleId===f.sale.saleId).evidence.dispositions.length,1);
}));
test('major email: native confirmation and recovery challenges are separate, limited, one-time and service-only',()=>trial(async()=>{
  const f=await fixture();await db.query('reset role');const email='challenge@example.invalid',id=f.actors.staff;
  await db.query('update auth.users set email=$2 where id=$1',[id,email]);
  const call=(c:any)=>checkoutValue(db,'select public.email_challenge($1::jsonb) as value',[JSON.stringify(c)]);
  await checkoutAs(db,f.actors.owner);await workflowRejects(db,()=>call({action:'reserve',purpose:'verification',email,ticket:randomUUID()}),'42501');
  await checkoutAs(db,'','service_role');const ticket=randomUUID();assert.equal((await call({action:'reserve',purpose:'verification',email,ticket})).allowed,true);
  assert.equal((await call({action:'reserve',purpose:'verification',email,ticket:randomUUID()})).allowed,false);
  await db.query('reset role');const hash=createHash('sha224').update(email+'12345678').digest('hex');
  await db.query('update auth.users set confirmation_token=$2,confirmation_sent_at=clock_timestamp() where id=$1',[id,hash]);
  await checkoutAs(db,'','service_role');assert.equal((await call({action:'activate',purpose:'verification',email,ticket,userId:id,tokenHash:hash})).allowed,true);
  assert.equal((await call({action:'consume',purpose:'recovery',tokenHash:hash})).allowed,false);
  assert.equal((await call({action:'consume',purpose:'verification',email,code:'00000000'})).allowed,false);
  assert.equal((await call({action:'consume',purpose:'verification',email,code:'12345678'})).allowed,true);
  assert.equal((await call({action:'consume',purpose:'verification',tokenHash:hash})).allowed,false);
}));

for(const reasonId of ['duplicate','incorrect_order','cancellation','refund_return','quality','other'])test(`Adjustment 5: ${reasonId} retains request and decision evidence without physical/payment changes`,()=>trial(async()=>{
  const f=await fixture(),before=await f.physical();await checkoutAs(db,f.actors.staff);
  const request=await f.command('void.request',{reasonId,notes:reasonId==='other'?'Unusual customer correction':''});await f.execute(request);assert.equal((await f.execute(request)).replayed,true);
  let s=await f.current();assert.equal(s.requests[0].requested_by,f.actors.staff);await checkoutAs(db,f.actors.admin);
  const decision=await f.command('void.decide',{requestId:s.requests[0].id,approved:true,reasonId:'incorrect_order',notes:''});await f.execute(decision);assert.equal((await f.execute(decision)).replayed,true);
  s=await f.current();assert.equal(s.requests[0].requested_by,f.actors.staff);assert.equal(s.requests[0].reviewed_by,f.actors.admin);
  assert.equal(s.adjustments.decisions.find((d:any)=>d.kind==='void.request').reasonId,reasonId);assert.equal(s.adjustments.decisions.find((d:any)=>d.kind==='void.decide').actorId,f.actors.admin);assert.deepEqual(await f.physical(),before);
}));
test('Adjustment 5: invalid IDs and meaningless Other explanations fail without mutation',()=>trial(async()=>{
  const f=await fixture(),before=await f.current();
  for(const reasonId of ['bogus','toString',null,{},5])await workflowRejects(db,async()=>f.execute(await f.command('sale.void',{reasonId,notes:'valid notes'})),'22023');
  for(const notes of ['', '   ', '\t\n', '...', '\u200b'])await workflowRejects(db,async()=>f.execute(await f.command('sale.void',{reasonId:'other',notes})),'22023');
  assert.deepEqual(await f.current(),before);
}));

const packageChecks={factorySealed:true,shelfStable:true,packagingSound:true,uncontaminated:true,recallClear:true,expiryChecked:true};
async function foodFixture(recipe=false){
  const f=await fixture();
  const stock=stockRecord({category:'Food',kind:recipe?'Ingredient':'Finished',unit:recipe?'kg':'pcs',batches:[{id:randomUUID(),quantityBase:recipe?'10000':'10',manufactured:'2020-01-01',expires:'2099-12-31',unsellable:false}]});
  await f.save('stock.save',stock);
  const product=productRecord(stock,{sku:'FOOD-'+randomUUID(),category:'Food',model:recipe?'Recipe':'Retail Item',stockId:recipe?null:stock.id,recipe:recipe?[{stockId:stock.id,quantity:'0.001',unit:'kg'}]:[],manufactured:'2020-01-01',expires:'2099-12-31'});
  await f.save('product.save',product);const sale=await f.checkout(await f.checkoutCommand([f.line(product,{quantity:'2'})]));await checkoutAs(db,f.actors.owner);
  const current=async()=>(await f.read()).items.find((s:any)=>s.id===sale.saleId);
  const make=async(condition:string,quantityBase='2',extra:any={})=>{const s=await current(),i=s.adjustableItems[0],u=i.usage[0];return {operationId:randomUUID(),kind:'stock.dispose',reasonId:'cancellation',notes:'Physical acceptance',targets:[{saleId:s.id,token:s.token}],dispositions:[{itemId:i.id,stockId:u.stockId,quantityBase,condition,evidence:'Actual quantity individually inspected',resalePolicyConfirmed:condition==='returned_sellable',facts:{...factsFor(condition),foodOrBeverage:true},...extra}]};};
  const stockBalance=async()=>{await db.query('reset role');const value=Number(await checkoutValue(db,'select sum(quantity_base)::text as value from public.stock_movements where batch_id=$1',[stock.batches[0].id]));await checkoutAs(db,f.actors.owner);return value;};
  return {...f,hobbyProduct:f.product,stock,product,foodSale:sale,foodCurrent:current,make,stockBalance};
}
test('Adjustment 6 table: duplicate reversal preserves the legitimate sale consumption and original evidence',()=>trial(async()=>{
 const f=await fixture(),legitimate=await f.buy(),before=await f.physical();await checkoutAs(db,f.actors.owner);
 const c=await f.dispose('unused');c.reasonId='duplicate';await f.execute(c);
 const after=await f.physical();assert.deepEqual(after.payments,before.payments);assert.deepEqual(after.usage,before.usage);
 assert.deepEqual(after.movements.filter((m:any)=>m.kind==='Consumption'),before.movements.filter((m:any)=>m.kind==='Consumption'));
 assert.equal(after.movements.filter((m:any)=>m.kind==='Return').length,1);
 await checkoutAs(db,f.actors.owner);assert.equal((await f.read()).items.find((s:any)=>s.id===legitimate.saleId).adjustments.dispositions.length,0);
}));
for(const condition of ['unused','waste','consumed'])test(`Adjustment 6 table: food ${condition}, checkout 10 to 8 retains deduction unless actually unused`,()=>trial(async()=>{
 const f=await foodFixture(),before=await f.physical();await checkoutAs(db,f.actors.owner);assert.equal(await f.stockBalance(),8);
 const c=await f.make(condition);if(condition==='waste')c.dispositions[0].facts.prepared=true;
 await f.execute(c);assert.equal(await f.stockBalance(),condition==='unused'?10:8);
 const after=await f.physical();assert.deepEqual(after.payments,before.payments);assert.deepEqual(after.usage,before.usage);
 await checkoutAs(db,f.actors.owner);const saved=(await f.foodCurrent()).adjustments.dispositions[0];assert.equal(saved.condition,condition);assert.equal(saved.physical_facts.prepared,condition!=='unused');assert.equal(saved.actor_id,f.actors.owner);assert.ok(saved.occurred_at);assert.equal(saved.allocations.reduce((n:number,a:any)=>n+Number(a.quantity_base),0),2);
}));
test('Adjustment 6 table: mixed quantities of the same input retain damaged custody separately from sellable returns and missing goods',()=>trial(async()=>{
 const f=await fixture();const receipt=await f.checkout(await f.checkoutCommand([f.line(f.product,{quantity:'3'})]));await checkoutAs(db,f.actors.admin);
 const s=(await f.read()).items.find((s:any)=>s.id===receipt.saleId),i=s.adjustableItems[0],u=i.usage[0],before=await f.physical();await checkoutAs(db,f.actors.admin);
 const c={operationId:randomUUID(),kind:'stock.dispose',reasonId:'refund_return',notes:'One returned sellable, one damaged in shop, one missing',targets:[{saleId:s.id,token:s.token}],dispositions:['returned_sellable','returned_unsellable','not_returned'].map(condition=>({itemId:i.id,stockId:u.stockId,quantityBase:'1',condition,facts:factsFor(condition),evidence:'Each physical unit inspected separately',resalePolicyConfirmed:condition==='returned_sellable'}))};
 await f.execute(c);const after=await f.physical();assert.deepEqual(after.payments,before.payments);assert.equal(after.movements.filter((m:any)=>m.kind==='Return').length,1);
 await checkoutAs(db,f.actors.admin);const d=(await f.read()).items.find((s:any)=>s.id===s.id&&s.id===receipt.saleId).adjustments.dispositions;
 assert.equal(d.length,3);assert.equal(d.find((d:any)=>d.condition==='returned_unsellable').physical_facts.physicallyPresent,true);assert.ok(d.every((d:any)=>d.actor_role==='Admin'));
}));
test('Adjustment 6 table: packaged returns require every approved policy fact and retain original expiry restrictions',()=>trial(async()=>{
 const f=await foodFixture(),before=await f.physical();await checkoutAs(db,f.actors.owner);
 for(const key of Object.keys(packageChecks))await workflowRejects(db,async()=>f.execute(await f.make('returned_sellable','1',{packagedReturn:{...packageChecks,[key]:false}})),'22023');
 await workflowRejects(db,async()=>f.execute(await f.make('returned_sellable','1')),'22023');
 await workflowRejects(db,async()=>f.execute(await f.make('returned_sellable','1',{packagedReturn:packageChecks,facts:{...factsFor('returned_sellable'),foodOrBeverage:true,prepared:true}})),'22023');
 assert.deepEqual(await f.physical(),before);await checkoutAs(db,f.actors.owner);
 await f.execute(await f.make('returned_sellable','1',{packagedReturn:packageChecks}));assert.equal(await f.stockBalance(),9);
 const saved=(await f.foodCurrent()).adjustments.dispositions[0];assert.deepEqual(saved.physical_facts.packagedReturn,packageChecks);
}));
test('Adjustment 6 rejects invalid quantities, contradictory facts and fabricated historical evidence atomically',()=>trial(async()=>{
 const f=await fixture(),before=await f.physical();await checkoutAs(db,f.actors.owner);
 for(const q of ['0','-1','1.1','2','NaN','0.0000001'])await workflowRejects(db,async()=>f.execute(await f.dispose('unused',q)));
 for(const key of ['prepared','handedOver','returned','additionalConsumption'])await workflowRejects(db,async()=>f.execute(await f.dispose('unused','1',{facts:{...factsFor('unused'),[key]:true}})),'22023');
 for(const facts of [undefined,{}, {...factsFor('unused'),prepared:'false'}, {...factsFor('unused'),physicallyPresent:false}])await workflowRejects(db,async()=>f.execute(await f.dispose('unused','1',{facts})),'22023');
 await workflowRejects(db,async()=>f.execute(await f.dispose('returned_unsellable','1',{facts:{...factsFor('returned_unsellable'),physicallyPresent:false}})),'22023');
 assert.deepEqual(await f.physical(),before);
}));
test('Adjustment 6 mixed food recipe and Hobby lines classify each original input independently',()=>trial(async()=>{
 const f=await foodFixture(true),sale=await f.checkout(await f.checkoutCommand([f.line(f.hobbyProduct,{quantity:'2'}),f.line(f.product,{quantity:'2'})]));
 await checkoutAs(db,f.actors.owner);const data=(await f.read()).items.find((s:any)=>s.id===sale.saleId);assert.equal(data.adjustableItems.length,2);
 const before=await f.physical();await checkoutAs(db,f.actors.owner);
 const c={operationId:randomUUID(),kind:'stock.dispose',reasonId:'cancellation',notes:'Mixed actual physical conditions',targets:[{saleId:data.id,token:data.token}],dispositions:data.adjustableItems.map((i:any)=>({itemId:i.id,stockId:i.usage[0].stockId,quantityBase:'1',condition:i.category==='Hobby'?'unused':'waste',facts:{...factsFor(i.category==='Hobby'?'unused':'waste'),foodOrBeverage:i.category==='Food',prepared:i.category==='Food'},evidence:'One hobby unit unused; one meal discarded',resalePolicyConfirmed:false}))};
 await f.execute(c);assert.equal(await f.stockBalance(),9996);const after=await f.physical();assert.deepEqual(after.payments,before.payments);assert.equal(after.movements.filter((m:any)=>m.kind==='Return').length,1);
}));

test('Adjustment 6 consumed refunded food remains consumption, never automatically waste',()=>trial(async()=>{
 const f=await foodFixture(),before=await f.physical();await checkoutAs(db,f.actors.owner);
 await f.execute({operationId:randomUUID(),kind:'refund.record',targets:[await f.target(f.foodSale.saleId)],reasonId:'refund_return',notes:'Disposable manual evidence only',refund:{amount:'1',method:'Cash',reference:randomUUID(),paidAt:new Date().toISOString(),evidence:'Synthetic payout evidence',paidConfirmed:true}});
 await f.execute(await f.make('consumed'));assert.equal(await f.stockBalance(),8);const s=await f.foodCurrent();assert.equal(s.adjustments.refunds.length,1);assert.equal(s.adjustments.dispositions[0].condition,'consumed');const after=await f.physical();assert.deepEqual(after.payments,before.payments);
}));
test('Adjustment 6 packaged expiry failure cannot restore sellable stock',()=>trial(async()=>{
 const f=await foodFixture();await f.save('stock.save',{...f.stock,batches:f.stock.batches.map((b:any)=>({...b,quantityBase:'8',expires:'2020-01-01'}))});
 await workflowRejects(db,async()=>f.execute(await f.make('returned_sellable','1',{packagedReturn:packageChecks})),'PT409');assert.equal(await f.stockBalance(),8);
}));


test('Adjustment 7 later partial returns are append-only, linked, cumulative and replay safe',()=>trial(async()=>{
 const f=await foodFixture(),before=await f.physical();await checkoutAs(db,f.actors.owner);
 await f.execute(await f.make('not_returned'));
 const missing=(await f.foodCurrent()).adjustments.dispositions[0];
 const later=async(condition='returned_sellable',q='1')=>f.make(condition,q,{sourceDispositionId:missing.id,packagedReturn:packageChecks});
 const c=await later();await f.execute(c);assert.equal((await f.execute(c)).replayed,true);assert.equal(await f.stockBalance(),9);
 await workflowRejects(db,()=>f.execute({...c,operationId:randomUUID()}),'PT409');
 await workflowRejects(db,async()=>f.execute(await later('returned_sellable','2')),'PT409');
 await f.execute(await later('returned_unsellable'));assert.equal(await f.stockBalance(),9);
 await workflowRejects(db,async()=>f.execute(await later()),'PT409');
 await workflowRejects(db,async()=>f.execute(await f.make('unused','1')),'PT409');
 const saved=(await f.foodCurrent()).adjustments.dispositions;assert.equal(saved.length,3);assert.deepEqual(saved.find((d:any)=>d.id===missing.id),missing);
 assert.ok(saved.filter((d:any)=>d.id!==missing.id).every((d:any)=>d.source_disposition_id===missing.id));
 assert.ok(saved.every((d:any)=>d.allocations.every((a:any)=>missing.allocations.some((m:any)=>m.source_movement_id===a.source_movement_id))));
 const after=await f.physical();assert.deepEqual(after.payments,before.payments);assert.deepEqual(after.usage,before.usage);
 assert.deepEqual(after.movements.filter((m:any)=>m.kind==='Consumption'),before.movements.filter((m:any)=>m.kind==='Consumption'));
}));
test('Adjustment 7 later return rejects unlinked, mismatched and altered preparation evidence atomically',()=>trial(async()=>{
 const f=await foodFixture();await f.execute(await f.make('not_returned'));const source=(await f.foodCurrent()).adjustments.dispositions[0];
 const before=await f.physical();await checkoutAs(db,f.actors.owner);
 for(const extra of [{sourceDispositionId:randomUUID()}, {sourceDispositionId:source.id,facts:{...factsFor('returned_sellable'),foodOrBeverage:true,prepared:true}}, {sourceDispositionId:source.id,facts:{...factsFor('returned_sellable'),foodOrBeverage:false}}])
 await workflowRejects(db,async()=>f.execute(await f.make('returned_sellable','1',{packagedReturn:packageChecks,...extra})));
 const bad=await f.make('returned_unsellable','1',{sourceDispositionId:source.id});bad.dispositions.push({...bad.dispositions[0],quantityBase:'2'});
 await workflowRejects(db,()=>f.execute(bad),'PT409');assert.deepEqual(await f.physical(),before);
}));
test('Adjustment 7 original multi-batch allocation is retained through separate partial requests',()=>trial(async()=>{
 const f=await fixture();const stock=stockRecord({batches:[{id:randomUUID(),quantityBase:'1',manufactured:'2020-01-01',expires:'2098-01-01',unsellable:false},{id:randomUUID(),quantityBase:'4',manufactured:'2020-01-01',expires:'2099-01-01',unsellable:false}]});
 await f.save('stock.save',stock);const product=productRecord(stock,{sku:'BATCH-'+randomUUID()});await f.save('product.save',product);
 const sale=await f.checkout(await f.checkoutCommand([f.line(product,{quantity:'3'})]));await checkoutAs(db,f.actors.owner);
 const make=async(q:string)=>{const s=(await f.read()).items.find((s:any)=>s.id===sale.saleId),i=s.adjustableItems[0],u=i.usage[0];return {operationId:randomUUID(),kind:'stock.dispose',reasonId:'duplicate',notes:'Original split batches',targets:[{saleId:s.id,token:s.token}],dispositions:[{itemId:i.id,stockId:u.stockId,quantityBase:q,condition:'unused',facts:factsFor('unused'),evidence:'Original unused units inspected',resalePolicyConfirmed:false}]};};
 await f.execute(await make('2'));await f.execute(await make('1'));await workflowRejects(db,async()=>f.execute(await make('1')),'PT409');
 await db.query('reset role');const balances=(await db.query("select batch_id,sum(quantity_base)::text quantity from public.stock_movements where batch_id=any($1::uuid[]) group by batch_id",[stock.batches.map((b:any)=>b.id)])).rows;
 assert.deepEqual(balances.map((b:any)=>Number(b.quantity)).sort(),[1,4]);
}));
for(const restriction of ['missing','archived','unsellable','extended','expired'])test(`Adjustment 7 batch ${restriction} cannot silently become usable`,()=>trial(async()=>{
 const f=await foodFixture();await db.query('reset role');
 if(restriction==='missing'){await db.query('alter table private.consumption_batch_snapshots disable trigger immutable_adjustment');await db.query('delete from private.consumption_batch_snapshots where movement_id in (select id from public.stock_movements where sale_item_id in (select id from public.sale_items where sale_id=$1))',[f.foodSale.saleId]);}
 else {if(restriction==='archived')await db.query("insert into public.stock_movements(batch_id,kind,quantity_base,actor_id,actor_name,actor_role,reason,operation_id,operation_line,occurred_at) values($1,'Removal',-8,$2,'Disposable Owner','Owner','Dispose remaining stock before archive',$3,0,clock_timestamp())",[f.stock.batches[0].id,f.actors.owner,randomUUID()]);await db.query(`update public.stock_batches set ${restriction==='archived'?"archived_at=clock_timestamp()":restriction==='unsellable'?'unsellable=true':restriction==='extended'?"expires_on='2100-01-01'":"expires_on='2020-01-01'"} where id=$1`,[f.stock.batches[0].id]);}
 await checkoutAs(db,f.actors.owner);await workflowRejects(db,async()=>f.execute(await f.make('returned_sellable','1',{packagedReturn:packageChecks})),'PT409');assert.equal(await f.stockBalance(),restriction==='archived'?0:8);
 if(restriction==='expired'){await f.execute(await f.make('unused','1'));assert.equal(await f.stockBalance(),9);await db.query('reset role');assert.equal(Number(await checkoutValue(db,'select private.checkout_usable($1) as value',[f.stock.id])),0);}
}));

test('Adjustment 7 recipe modifiers, variant and nested bundle mixed lines retain canonical purchased usage after edits',()=>trial(async()=>{
 const f=await fixture();const flour=stockRecord({kind:'Ingredient',category:'Food',unit:'kg',batches:[{id:randomUUID(),quantityBase:'10000',manufactured:'2020-01-01',expires:'2099-01-01',unsellable:false}]});await f.save('stock.save',flour);
 const option={id:randomUUID(),name:'Omit some flour',price:'0',defaultSelected:false,inputs:[{stockId:flour.id,quantity:'-50',unit:'g'}]};
 const meal=productRecord(flour,{sku:'MEAL-'+randomUUID(),category:'Food',manufactured:'2020-01-01',expires:'2099-01-01',model:'Recipe',stockId:null,recipe:[{stockId:flour.id,quantity:'0.25',unit:'kg'}],groups:[{id:randomUUID(),name:'Flour choice',min:'0',max:'1',options:[option]}]});await f.save('product.save',meal);
 const variant={id:randomUUID(),name:'Large',stockId:f.stock.id,price:'12',enabled:true};const variants=productRecord(f.stock,{sku:'VAR-'+randomUUID(),stockId:null,model:'Variants',variants:[variant]});await f.save('product.save',variants);
 const bundle=productRecord(f.stock,{sku:'BUN-'+randomUUID(),stockId:null,model:'Bundle',bundle:[{productId:meal.id,stockId:null,variantId:null,quantity:'2',modifierIds:[option.id]},{productId:variants.id,stockId:null,variantId:variant.id,quantity:'1',modifierIds:[]}]});await f.save('product.save',bundle);
 const nested=productRecord(f.stock,{sku:'NEST-'+randomUUID(),stockId:null,model:'Bundle',bundle:[{productId:bundle.id,stockId:null,variantId:null,quantity:'1',modifierIds:[]}]});await f.save('product.save',nested);
 const sale=await f.checkout(await f.checkoutCommand([f.line(nested,{quantity:'2'}),f.line(meal,{modifierIds:[option.id]}),f.line(variants,{variantId:variant.id})]));
 await f.save('product.save',{...meal,recipe:[{stockId:flour.id,quantity:'1',unit:'kg'}],groups:[{...meal.groups[0],options:[{...option,inputs:[{stockId:flour.id,quantity:'-100',unit:'g'}]}]}]});await f.save('product.save',{...variants,variants:[{...variant,enabled:false}]});
 await checkoutAs(db,f.actors.owner);const current=(await f.read()).items.find((s:any)=>s.id===sale.saleId);assert.equal(current.adjustableItems.length,3);
 const input=current.adjustableItems.flatMap((i:any)=>i.usage);assert.deepEqual(input.filter((u:any)=>u.stockId===flour.id).map((u:any)=>Number(u.quantity)).sort((a:number,b:number)=>a-b),[200,800]);
 const before=await f.physical();await checkoutAs(db,f.actors.owner);
 const c={operationId:randomUUID(),kind:'stock.dispose',reasonId:'cancellation',notes:'Original mixed configurations',targets:[{saleId:current.id,token:current.token}],dispositions:current.adjustableItems.flatMap((i:any)=>i.usage.map((u:any)=>({itemId:i.id,stockId:u.stockId,quantityBase:u.quantity,condition:'unused',facts:{...factsFor('unused'),foodOrBeverage:u.stockId===flour.id},evidence:'Original inputs unused and physically inspected',resalePolicyConfirmed:false})))};
 await f.execute(c);assert.equal((await f.execute(c)).replayed,true);const after=await f.physical();assert.deepEqual(after.payments,before.payments);assert.deepEqual(after.usage,before.usage);
 await checkoutAs(db,f.actors.owner);await workflowRejects(db,async()=>f.execute({...c,operationId:randomUUID(),targets:[await f.target(sale.saleId)]}),'PT409');
}));

test('Adjustment 7 final audit failure rolls back returns, links, operation and inventory revision; history stays immutable',()=>trial(async()=>{
 const f=await fixture();await f.execute(await f.dispose('not_returned'));const source=(await f.current()).adjustments.dispositions[0];const before=await f.physical();
 await db.exec(`create function public.fail_stock_audit() returns trigger language plpgsql as $$begin if new.event_type='Sale adjustment recorded' then raise exception 'Injected stock audit failure'; end if; return new; end$$;create trigger fail_stock_audit before insert on public.audit_events for each row execute function public.fail_stock_audit()`);
 await checkoutAs(db,f.actors.owner);const c=await f.dispose('returned_sellable','1',{sourceDispositionId:source.id});await workflowRejects(db,()=>f.execute(c),'P0001');assert.deepEqual(await f.physical(),before);
 await db.query('reset role');assert.equal(await checkoutValue(db,'select count(*)::int as value from private.sale_adjustment_operations where operation_id=$1',[c.operationId]),0);
 await db.query('drop trigger fail_stock_audit on public.audit_events');await checkoutAs(db,f.actors.owner);await f.execute(c);
 await db.query('reset role');for(const table of ['private.stock_dispositions','private.stock_disposition_allocations','public.sale_item_stock_usage','public.stock_movements'])await workflowRejects(db,()=>db.query('delete from '+table));
 await checkoutAs(db,f.actors.staff);await workflowRejects(db,()=>f.execute(c),'42501');
}));

test('Adjustment 9 Staff reads exclude manager stock/refund evidence while manager reports retain linked audit',()=>trial(async()=>{
 const f=await fixture();await db.query('reset role');await db.query('delete from realtime.messages');await checkoutAs(db,f.actors.owner);await f.execute(await f.command('refund.record',{refund:manualPayout()}));
 const manager=await f.current();assert.equal(manager.adjustments.refunds.length,1);
 await db.query('reset role');const signals=(await db.query<any>('select topic,payload from realtime.messages')).rows;assert.ok(signals.some((r:any)=>r.topic==='vertwell:managers'&&r.payload.scopes.includes('reports')));assert.ok(!JSON.stringify(signals).includes(manager.adjustments.refunds[0].reference));await checkoutAs(db,f.actors.owner);
 const report=await checkoutValue(db,'select public.read_reports() as value');assert.equal(report.adjustments.find((a:any)=>a.saleId===f.sale.saleId).evidence.refunds.length,1);
 await checkoutAs(db,f.actors.staff);const own=(await f.read()).items.find((s:any)=>s.id===f.sale.saleId);assert.ok(own);assert.deepEqual(own.adjustments.refunds,[]);assert.deepEqual(own.adjustments.dispositions,[]);assert.deepEqual(own.adjustableItems,[]);assert.equal(own.refundBalance,undefined);assert.ok(!own.events.some((e:any)=>['stock.dispose','refund.record'].includes(e.details?.kind)));assert.ok(!JSON.stringify(own).includes(manager.adjustments.refunds[0].reference));
 await workflowRejects(db,()=>db.query('select public.read_reports()'),'42501');
}));
