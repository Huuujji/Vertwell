import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { PermissionDatabase } from './permission-checks.js';
import { checkoutAs,checkoutFixture,checkoutValue } from './checkout-checks.js';

type DB=PermissionDatabase;
export async function workflowRejects(db:DB,run:()=>Promise<unknown>,code?:string) {
  await db.query('savepoint invalid_workflow');
  try {await assert.rejects(run,(error:any)=>!code||error.code===code);}
  finally {await db.query('rollback to savepoint invalid_workflow');await db.query('release savepoint invalid_workflow');}
}
export async function workflowFixture(db:DB) {
  const f=await checkoutFixture(db);
  const read=()=>checkoutValue(db,'select public.read_sales_workflow(0,100) as value');
  const execute=(command:any)=>checkoutValue(db,'select public.sales_workflow_command($1::jsonb) as value',[JSON.stringify(command)]);
  const buy=async(role:'owner'|'admin'|'staff'|'other'='staff',gcash=false)=>{
    await checkoutAs(db,f.actors[role]);const c=await f.command();
    if(gcash)c.payment={method:'GCash',amount:c.payment.amount,reference:`1${String(Math.floor(Math.random()*1e12)).padStart(12,'0')}`};
    const r=await f.checkout(c);await checkoutAs(db,f.actors.owner);return r;
  };
  const target=async(id:string)=>{const sale=(await read()).items.find((s:any)=>s.id===id);return {saleId:id,token:sale.token};};
  const request=async(id:string,reason='Incorrect order entered')=>({operationId:randomUUID(),kind:'void.request',targets:[await target(id)],reason});
  const voidCommand=async(ids:string[],reason='Duplicate transaction')=>({operationId:randomUUID(),kind:'sale.void',targets:await Promise.all(ids.map(target)),reason});
  const review=async(ids:string[],overrides:any={})=>{
    const orders=(await read()).items.filter((s:any)=>ids.includes(s.id));
    return {operationId:randomUUID(),kind:'review.confirm',targets:await Promise.all(ids.map(target)),review:{date:orders[0].businessDate,
      countedCash:orders.filter((s:any)=>s.method==='Cash').reduce((sum:number,s:any)=>sum+Number(s.total),0).toFixed(2),
      verifiedGCash:orders.filter((s:any)=>s.method==='GCash').reduce((sum:number,s:any)=>sum+Number(s.total),0).toFixed(2),
      openingCash:'0',additions:'0',removals:'0',refunds:'0',explanation:'',verifiedIds:ids,...overrides}};
  };
  const physical=async()=>{await db.query('reset role');return checkoutValue(db,`select jsonb_build_object(
    'movements',(select jsonb_agg(to_jsonb(m) order by id) from public.stock_movements m),
    'payments',(select jsonb_agg(to_jsonb(p) order by id) from public.payments p),
    'batches',(select jsonb_agg(to_jsonb(b) order by id) from public.stock_batches b),
    'usage',(select jsonb_agg(to_jsonb(u) order by id) from public.sale_item_stock_usage u),
    'revision',(select revision::text from private.inventory_state where singleton),
    'activation',(select enabled from private.checkout_state where singleton)) as value`);};
  return {...f,read,execute,buy,target,request,voidCommand,review,physical};
}

export const workflowScenarios:{name:string;run(db:DB):Promise<void>}[]=[
  {name:'P7 matched Owner review persists exact receipts, verified payments and history without consuming or changing payments',async run(db){
    const f=await workflowFixture(db),cash=await f.buy(),digital=await f.buy('admin',true),before=await f.physical();
    await checkoutAs(db,f.actors.owner);const command=await f.review([cash.saleId,digital.saleId]);const result=await f.execute(command);
    assert.equal(result.results.length,2);assert.equal(result.results[0].outcome,'reviewed');
    const read=await f.read(),sale=read.items.find((s:any)=>s.id===cash.saleId);
    assert.equal(sale.status,'Completed');assert.equal(sale.reviewState,'Reviewed');assert.equal(sale.review.outcome,'Matched');
    assert.equal(Number(sale.review.details.expected_cash),14);assert.equal(Number(sale.review.details.expected_gcash),14);
    assert.deepEqual(sale.review.details.orderIds.sort(),[cash.saleId,digital.saleId].sort());
    assert.equal(sale.events.filter((e:any)=>e.event_type==='Daily sales reviewed').length,1);
    assert.deepEqual(await f.physical(),before);
    await checkoutAs(db,f.actors.owner);assert.equal((await f.execute(command)).replayed,true);
    assert.equal((await f.read()).items.find((s:any)=>s.id===cash.saleId).events.length,sale.events.length);
  }},
  {name:'P7 manual cash reconciliation saves all positive adjustment evidence, explained discrepancies and original expected totals',async run(db){
    const f=await workflowFixture(db),sale=await f.buy();
    const command=await f.review([sale.saleId],{countedCash:'22',openingCash:'10',additions:'5',removals:'3',refunds:'2',explanation:'Counted shortage accepted after receipt check'});
    await f.execute(command);const saved=(await f.read()).items.find((s:any)=>s.id===sale.saleId).review;
    assert.equal(saved.outcome,'Reviewed with discrepancy');assert.equal(Number(saved.details.verified_cash),12);
    assert.equal(Number(saved.details.expected_cash),14);assert.equal(saved.details.cashMovements.length,4);
    assert.deepEqual(saved.details.cashMovements.map((c:any)=>c.kind).sort(),['Addition','Opening','Refund','Removal']);
    assert.ok(saved.details.cashMovements.every((c:any)=>c.review_id===saved.id&&c.actor_id===f.actors.owner&&c.sale_id===null));
  }},
  {name:'P7 rejects forged roles, totals, unverified IDs, invalid exact money, future/mixed/stale receipts',async run(db){
    const f=await workflowFixture(db),sale=await f.buy(),command=await f.review([sale.saleId]);
    for(const patch of [{countedCash:'-1'},{countedCash:14},{countedCash:'14.001'},{verifiedGCash:null},
      {openingCash:'15'},{verifiedIds:[]},{verifiedIds:[sale.saleId,sale.saleId]},{date:'2099-12-31'},{date:'2026-02-30'},{expectedCash:'14'},{ownerId:f.actors.owner}])
      await workflowRejects(db,()=>f.execute({...command,review:{...command.review,...patch}}));
    await workflowRejects(db,()=>f.execute({...command,role:'Owner'}),'22023');
    await workflowRejects(db,()=>f.execute({...command,targets:[...command.targets,...command.targets]}),'22023');
    const ownerSale=await f.buy('owner');await workflowRejects(db,async()=>f.execute(await f.review([ownerSale.saleId])),'PT409');
    const changed=await f.request(sale.saleId);await f.execute(changed);await workflowRejects(db,()=>f.execute(command),'PT409');
    await db.query('reset role');assert.equal(await checkoutValue(db,'select count(*)::int as value from public.daily_sales_reviews where owner_id=$1',[f.actors.owner]),0);
  }},
  {name:'P7 rejected and renewed Staff requests preserve every request/decision and Admin attribution, with no Owner password',async run(db){
    const f=await workflowFixture(db),sale=await f.buy(),before=await f.physical();await checkoutAs(db,f.actors.staff);
    const first=await f.request(sale.saleId,'First mistaken entry');await f.execute(first);
    await checkoutAs(db,f.actors.admin);let current=(await f.read()).items.find((s:any)=>s.id===sale.saleId);
    await f.execute({operationId:randomUUID(),kind:'void.decide',targets:[await f.target(sale.saleId)],requestId:current.requests[0].id,approved:false,reason:'Receipt is correct'});
    await checkoutAs(db,f.actors.staff);const second=await f.request(sale.saleId,'Second supported request');await f.execute(second);
    await checkoutAs(db,f.actors.admin);current=(await f.read()).items.find((s:any)=>s.id===sale.saleId);
    await f.execute({operationId:randomUUID(),kind:'void.decide',targets:[await f.target(sale.saleId)],requestId:current.requests.find((r:any)=>r.status==='Pending').id,approved:true,reason:'Approved after checking receipt'});
    current=(await f.read()).items.find((s:any)=>s.id===sale.saleId);
    assert.equal(current.status,'Voided');assert.equal(current.voidedRole,'Admin');assert.equal(current.voidReason,'Approved after checking receipt');
    assert.deepEqual(current.requests.map((r:any)=>r.status),['Rejected','Approved']);
    assert.equal(current.requests[0].reason,'First mistaken entry');assert.equal(current.requests[1].reason,'Second supported request');
    assert.ok(current.requests.every((r:any)=>r.reviewed_by===f.actors.admin&&r.requested_by===f.actors.staff));
    assert.deepEqual(current.events.map((e:any)=>e.event_type),['Checkout recorded','Void requested','Void request rejected','Void requested','Void request approved','Sale voided']);
    assert.deepEqual(await f.physical(),before);
  }},
  {name:'P7 Staff reads only own current-day sales/events and no other receipt IDs or review cash counts',async run(db){
    const f=await workflowFixture(db),own=await f.buy(),other=await f.buy('other'),old=await f.buy();
    await f.execute(await f.review([own.saleId,other.saleId]));
    // Trusted fixture only, before history freeze: use a separate historical sale.
    await db.query('reset role');await db.query('alter table public.sales disable trigger sales_update_guard');
    await db.query("update public.sales set occurred_at=occurred_at-interval '2 days' where id=$1",[old.saleId]);await db.query('alter table public.sales enable trigger sales_update_guard');
    await checkoutAs(db,f.actors.staff);const read=await f.read();assert.equal(read.items.length,1);assert.equal(read.items[0].id,own.saleId);
    assert.equal(read.items[0].review.details,null);assert.ok(!JSON.stringify(read).includes(other.saleId));
    await workflowRejects(db,()=>f.execute({operationId:randomUUID(),kind:'void.request',targets:[{saleId:other.saleId,token:'a'.repeat(64)}],reason:'Cross account'}),'42501');
    await workflowRejects(db,()=>f.execute({operationId:randomUUID(),kind:'void.request',targets:[{saleId:old.saleId,token:'a'.repeat(64)}],reason:'Old date'}),'42501');
  }},
  {name:'P7 current roles, inactive/anonymous/service identities and direct table access cannot bypass commands',async run(db){
    const f=await workflowFixture(db),sale=await f.buy(),review=await f.review([sale.saleId]),voiding=await f.voidCommand([sale.saleId]);
    for(const role of ['admin','staff'] as const){await checkoutAs(db,f.actors[role]);await workflowRejects(db,()=>f.execute(review),'42501');}
    await workflowRejects(db,()=>f.execute(voiding),'42501');
    for(const [id,role] of [[f.actors.inactive,'authenticated'],['','anon'],['','service_role']]){
      await checkoutAs(db,id!,role);await workflowRejects(db,f.read,'42501');await workflowRejects(db,()=>f.execute(voiding),'42501');
    }
    await checkoutAs(db,f.actors.owner);
    for(const table of ['daily_sales_reviews','daily_sales_review_items','cash_movements','audit_events','private.sales_workflow_operations'])
      await workflowRejects(db,()=>db.query(`select * from ${table}`),'42501');
    await workflowRejects(db,()=>db.query("update public.sales set status='Voided' where id=$1",[sale.saleId]),'42501');
  }},
  {name:'P7 bulk void records exact successes and skipped stale/ineligible IDs, approving only matched pending requests',async run(db){
    const f=await workflowFixture(db),a=await f.buy(),b=await f.buy(),c=await f.buy(),before=await f.physical();await checkoutAs(db,f.actors.owner);
    const bulk=await f.voidCommand([a.saleId,b.saleId,c.saleId]);
    await f.execute(await f.request(a.saleId));await f.execute(await f.voidCommand([b.saleId]));
    const result=await f.execute(bulk);const outcomes=new Map(result.results.map((r:any)=>[r.saleId,r.outcome]));
    assert.equal(outcomes.get(a.saleId),'stale');assert.equal(outcomes.get(b.saleId),'ineligible');assert.equal(outcomes.get(c.saleId),'voided');
    const current=(await f.read()).items.find((s:any)=>s.id===c.saleId);assert.equal(current.bulkActionId,bulk.operationId);
    assert.deepEqual(current.bulkAction.results,result.results);
    assert.equal((await f.execute(bulk)).replayed,true);assert.deepEqual(await f.physical(),before);
  }},
  {name:'P7 bulk void approves pending requests with separate original and decision reasons and a shared action ID',async run(db){
    const f=await workflowFixture(db),a=await f.buy(),b=await f.buy();await f.execute(await f.request(a.saleId,'Keep original request reason'));
    await checkoutAs(db,f.actors.admin);const bulk=await f.voidCommand([a.saleId,b.saleId],'Reviewed duplicate receipts');await f.execute(bulk);
    const current=(await f.read()).items.find((s:any)=>s.id===a.saleId);
    assert.equal(current.requests[0].status,'Approved');assert.equal(current.requests[0].reason,'Keep original request reason');
    assert.equal(current.requests[0].decision_reason,'Reviewed duplicate receipts');assert.equal(current.bulkActionId,bulk.operationId);
  }},
  {name:'P7 actor/content-bound replay reconciles after void/review and disabled checkout without duplicate events',async run(db){
    const f=await workflowFixture(db),sale=await f.buy();await checkoutAs(db,f.actors.staff);
    const request=await f.request(sale.saleId);await f.execute(request);
    await checkoutAs(db,f.actors.admin);const voiding=await f.voidCommand([sale.saleId]);await f.execute(voiding);
    await workflowRejects(db,()=>f.execute({...voiding,reason:'Changed reason'}),'PT409');
    await checkoutAs(db,f.actors.owner);await workflowRejects(db,()=>f.execute(voiding),'PT409');
    await db.query('reset role');await db.query('update private.checkout_state set enabled=false where singleton');
    await checkoutAs(db,f.actors.staff);assert.equal((await f.execute(request)).replayed,true);
    await checkoutAs(db,f.actors.admin);assert.equal((await f.execute(voiding)).replayed,true);
    assert.equal((await checkoutValue(db,'select public.business_access() as value')).services.checkout,false);
    assert.equal((await checkoutValue(db,'select public.business_access() as value')).services.salesReview,true);
  }},
  {name:'P7 serial decision order makes the second stale review/void fail without changing the winner',async run(db){
    const f=await workflowFixture(db),sale=await f.buy(),review=await f.review([sale.saleId]),voiding=await f.voidCommand([sale.saleId]);
    await f.execute(review);await workflowRejects(db,()=>f.execute(voiding),'PT409');
    assert.equal((await f.read()).items.find((s:any)=>s.id===sale.saleId).status,'Completed');
    await f.execute(await f.voidCommand([sale.saleId]));
    const current=(await f.read()).items.find((s:any)=>s.id===sale.saleId);assert.equal(current.status,'Voided');assert.equal(current.reviewState,'Reviewed');assert.ok(current.review);
  }},
  {name:'P7 paginated reads use a coherent dataset fingerprint and reject unsupported bounds',async run(db){
    const f=await workflowFixture(db),a=await f.buy();await f.buy('admin');
    const first=await checkoutValue(db,'select public.read_sales_workflow(0,1) as value'),second=await checkoutValue(db,'select public.read_sales_workflow(1,1) as value');
    assert.equal(first.revision,second.revision);assert.equal(first.hasMore,true);assert.notEqual(first.items[0].id,second.items[0].id);
    await f.execute(await f.request(a.saleId));assert.notEqual((await f.read()).revision,first.revision);
    for(const args of [[-1,1],[0,0],[0,101],[1000001,1]])await workflowRejects(db,()=>db.query('select public.read_sales_workflow($1,$2)',args),'22023');
  }},
  {name:'P7 operation IDs cannot be reused across checkout/inventory/workflow receipts',async run(db){
    const f=await workflowFixture(db),sale=await f.buy(),request=await f.request(sale.saleId);await f.execute(request);
    const checkout=await f.command();await workflowRejects(db,()=>f.checkout({...checkout,operationId:request.operationId}),'PT409');
    await workflowRejects(db,async()=>f.execute({...await f.voidCommand([sale.saleId]),operationId:sale.operationId}),'PT409');
  }},
  {name:'P7 injected final audit failure rolls back all review/cash/link/status/operation writes',async run(db){
    const f=await workflowFixture(db),sale=await f.buy(),command=await f.review([sale.saleId],{countedCash:'24',openingCash:'10'}),before=await f.read();
    await db.query('reset role');
    const tables=['daily_sales_reviews','daily_sales_review_items','cash_movements','private.sales_workflow_operations'];
    const counts=new Map<string,number>();
    for(const table of tables)counts.set(table,await checkoutValue(db,`select count(*)::int as value from ${table}`));
    await db.query(`create function private.p7_fail() returns trigger language plpgsql as $$begin if new.event_type='Daily review recorded' then raise exception 'P7 injected failure';end if;return new;end$$`);
    await db.query('create trigger p7_fail before insert on public.audit_events for each row execute function private.p7_fail()');
    await checkoutAs(db,f.actors.owner);await workflowRejects(db,()=>f.execute(command));assert.deepEqual(await f.read(),before);
    await db.query('reset role');for(const table of tables)
      assert.equal(await checkoutValue(db,`select count(*)::int as value from ${table}`),counts.get(table),`${table}: preserve existing history`);
  }},
  {name:'P7 unexpected bulk failure rolls back every void, pending-request decision, audit and operation receipt',async run(db){
    const f=await workflowFixture(db),a=await f.buy(),b=await f.buy();await f.execute(await f.request(a.saleId));
    const command=await f.voidCommand([a.saleId,b.saleId]),before=await f.read();
    await db.query('reset role');await db.query(`create function private.p7_bulk_fail() returns trigger language plpgsql as $$begin if new.event_type='Sales action recorded' and new.operation_id='${command.operationId}'::uuid then raise exception 'P7 injected bulk failure';end if;return new;end$$`);
    await db.query('create trigger p7_bulk_fail before insert on public.audit_events for each row execute function private.p7_bulk_fail()');
    await checkoutAs(db,f.actors.owner);await workflowRejects(db,()=>f.execute(command));assert.deepEqual(await f.read(),before);
    await db.query('reset role');assert.equal(await checkoutValue(db,'select count(*)::int as value from private.sales_workflow_operations where operation_id=$1',[command.operationId]),0);
  }},
];
