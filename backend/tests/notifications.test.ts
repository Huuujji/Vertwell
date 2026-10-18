import { before,after,beforeEach,afterEach,test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir,mkdtemp,mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { testRealtime } from '../scripts/test-realtime.js';
import { workflowFixture,workflowRejects } from '../scripts/sales-workflow-checks.js';
import { checkoutAs,checkoutValue } from '../scripts/checkout-checks.js';

const db=new PGlite();
async function initialize(database:PGlite,includeNotifications=true){
  await database.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await testRealtime(database);
  const root=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(root)).filter(f=>f.endsWith('.sql')&&(includeNotifications||!f.includes('notifications')&&!f.includes('notification_identity'))).sort())await database.exec(await readFile(new URL(file,root),'utf8'));
}
before(()=>initialize(db));after(()=>db.close());beforeEach(()=>db.exec('begin'));afterEach(()=>db.exec('rollback'));
const feed=(database=db)=>checkoutValue(database,'select public.read_notifications(0,100) as value');
const mark=(item:any,read=true,database=db)=>checkoutValue(database,'select public.set_notification_read($1,$2,$3) as value',[item.id,item.revision,read]);
async function requested(){
  const f=await workflowFixture(db),sale=await f.buy();await checkoutAs(db,f.actors.staff);
  await f.execute(await f.request(sale.saleId));await checkoutAs(db,f.actors.owner);return {...f,sale};
}
test('void notifications save original evidence and per-account read markers without changing business state',async()=>{
  const f=await requested(),before=await f.physical();await checkoutAs(db,f.actors.owner);
  const item=(await feed()).items[0];assert.equal(item.kind,'Void requests');assert.equal(item.evidence.actor,'P6 staff');
  assert.deepEqual(item.orderIds,[f.sale.saleId]);assert.equal((await feed()).unread,1);
  await mark(item);assert.equal((await feed()).unread,0);assert.equal((await feed()).items[0].read,true);
  await checkoutAs(db,f.actors.admin);assert.equal((await feed()).unread,1);await mark(item);
  await checkoutAs(db,f.actors.owner);await mark(item,false);assert.equal((await feed()).unread,1);
  await checkoutAs(db,f.actors.admin);assert.equal((await feed()).unread,0);
  assert.deepEqual(await f.physical(),before);
  await checkoutAs(db,f.actors.owner);assert.equal((await f.read()).items[0].requests[0].status,'Pending');
});
test('five repeated checkouts create one alert; exact retries deduplicate and new evidence invalidates old read revisions',async()=>{
  const f=await workflowFixture(db);
  for(let i=0;i<4;i++)await f.buy();assert.equal((await feed()).total,0);
  await checkoutAs(db,f.actors.staff);const command=await f.command();await f.checkout(command);await checkoutAs(db,f.actors.owner);
  const item=(await feed()).items[0];assert.equal(item.orderIds.length,5);assert.equal(item.evidence.threshold,5);
  await mark(item);await checkoutAs(db,f.actors.staff);await f.checkout(command);await checkoutAs(db,f.actors.owner);
  assert.equal((await feed()).unread,0);assert.equal((await feed()).total,1);
  await f.buy();const next=(await feed()).items[0];assert.equal(next.id,item.id);assert.equal(next.orderIds.length,6);assert.equal(next.read,false);
  await workflowRejects(db,()=>mark(item),'PT409');await mark(next);assert.equal((await feed()).unread,0);
  await db.exec('reset role');assert.equal((await db.query('select * from private.notification_versions where notification_id=$1',[item.id])).rows.length,2);
});
test('request decisions close the notification while preserving evidence, and a new request has its own unread identity',async()=>{
  const f=await requested(),item=(await feed()).items[0],target=await f.target(f.sale.saleId);
  await f.execute({operationId:randomUUID(),kind:'void.decide',targets:[target],requestId:item.evidence.requestId,approved:false,reason:'Payment and receipt checked'});
  assert.equal((await feed()).total,0);await workflowRejects(db,()=>mark(item),'PT409');
  await db.exec('reset role');const history=(await db.query<any>('select * from private.notification_versions where notification_id=$1 order by revision',[item.id])).rows;
  assert.equal(history.length,2);assert.equal(history[1].resolution,'Rejected');assert.deepEqual(history[0].evidence,history[1].evidence);
  await checkoutAs(db,f.actors.staff);await f.execute(await f.request(f.sale.saleId,'Further receipt evidence'));await checkoutAs(db,f.actors.owner);
  assert.notEqual((await feed()).items[0].id,item.id);assert.equal((await feed()).unread,1);
});
test('Owner-only thresholds recompute alerts; settings changes and voids retain previous evidence versions',async()=>{
  const f=await workflowFixture(db);await f.buy();await f.buy();
  await checkoutValue(db,'select public.update_alert_settings(null,2,2) as value');
  const item=(await feed()).items[0];assert.equal(item.orderIds.length,2);await mark(item);
  await checkoutAs(db,f.actors.admin);assert.equal((await feed()).total,1);
  await workflowRejects(db,()=>checkoutValue(db,'select public.update_alert_settings(null,2,2) as value'),'42501');
  assert.deepEqual((await db.query('select * from public.alert_settings')).rows,[]);
  await checkoutAs(db,f.actors.owner);await f.execute(await f.voidCommand([item.orderIds[0]]));assert.equal((await feed()).total,0);
  await db.exec('reset role');assert.equal((await db.query<any>('select * from private.review_notifications where id=$1',[item.id])).rows[0].resolution,'No longer matches current receipts or detection settings');
});
test('notifications deny Staff, inactive, anonymous and service clients; private evidence and helper execution stay closed',async()=>{
  const f=await requested(),item=(await feed()).items[0];
  for(const actor of [f.actors.staff,f.actors.inactive]){
    await checkoutAs(db,actor);await workflowRejects(db,()=>feed(),'42501');await workflowRejects(db,()=>mark(item),'42501');
  }
  for(const role of ['anon','authenticated','service_role']){
    await checkoutAs(db,f.actors.owner,role);
    for(const table of ['review_notifications','notification_versions','notification_reads'])await workflowRejects(db,()=>db.query(`select * from private.${table}`),'42501');
    await workflowRejects(db,()=>db.query('select private.refresh_duplicate_notifications()'),'42501');
    if(role!=='authenticated')await workflowRejects(db,()=>feed(),'42501');
  }
  await checkoutAs(db,f.actors.owner);
  for(const [revision,state] of [[null,true],['0',true],['1',null],['-1',true]])await workflowRejects(db,()=>checkoutValue(db,'select public.set_notification_read($1,$2,$3) as value',[item.id,revision,state]),'22023');
  await workflowRejects(db,()=>mark({...item,id:randomUUID()}),'PT409');
});
test('rolled-back requests produce neither saved alerts nor WebSocket delivery; read updates target only the signed-in account',async()=>{
  const f=await workflowFixture(db),sale=await f.buy();await db.exec('reset role');
  const baseline=(await db.query('select * from realtime.messages')).rows;
  await db.exec('savepoint cancelled');await checkoutAs(db,f.actors.staff);await f.execute(await f.request(sale.saleId));
  await db.exec('reset role');assert.equal((await db.query('select * from private.review_notifications')).rows.length,1);
  await db.exec('rollback to savepoint cancelled');assert.deepEqual((await db.query('select * from realtime.messages')).rows,baseline);
  await checkoutAs(db,f.actors.staff);await f.execute(await f.request(sale.saleId));await checkoutAs(db,f.actors.owner);
  const item=(await feed()).items[0];await db.exec('reset role;delete from realtime.messages');await checkoutAs(db,f.actors.owner);await mark(item);
  await db.exec('reset role');const messages=(await db.query<any>('select * from realtime.messages')).rows;
  assert.equal(messages.length,1);assert.equal(messages[0].topic,`vertwell:user:${f.actors.owner}`);assert.deepEqual(messages[0].payload,{scopes:['notifications']});
});
test('notification evidence and read state survive database close/reopen',async()=>{
  const root=new URL('../../.review/p9-notifications/',import.meta.url);await mkdir(root,{recursive:true});
  const path=await mkdtemp(fileURLToPath(new URL('durable-',root)));let persistent=new PGlite(path);
  try{
    await initialize(persistent);await persistent.exec('begin');const f=await workflowFixture(persistent),sale=await f.buy();
    await checkoutAs(persistent,f.actors.staff);await f.execute(await f.request(sale.saleId));await checkoutAs(persistent,f.actors.owner);
    const item=(await feed(persistent)).items[0];await mark(item,true,persistent);await persistent.exec('commit');await persistent.close();
    persistent=new PGlite(path);await persistent.exec('begin');await checkoutAs(persistent,f.actors.owner);
    assert.equal((await feed(persistent)).items[0].read,true);assert.equal((await feed(persistent)).unread,0);await persistent.exec('rollback');
  }finally{await persistent.close();}
});

test('duplicate windows preserve exact boundaries, separate bursts and original nested configuration identity',async()=>{
  const f=await workflowFixture(db);await db.exec('reset role');
  await db.query('insert into public.alert_settings(similar_order_threshold,window_minutes,updated_by) values(3,1,$1)',[f.actors.owner]);
  const ids:string[]=[];
  for(const [index,seconds] of [0,30,60,240,270,300,360,370,380].entries()){
    const id=randomUUID();ids.push(id);
    await db.query(`insert into public.sales(id,order_number,idempotency_key,request_hash,occurred_at,cashier_id,cashier_name,cashier_role,subtotal,tax_amount,total,review_state,status)
      values($1::uuid,$1::uuid::text,$2,'historical-proof','2026-10-18T01:00:00Z'::timestamptz+make_interval(secs=>$3),$4,'Original Staff','Staff',10,0,10,'Awaiting Owner review','Pending')`,[id,randomUUID(),seconds,f.actors.staff]);
    const configuration=index>=6?{nested:[{optionId:'different-original-option'}]}:index%2?{b:2,a:1,nested:[{optionId:'original-option'}]}:{a:1,b:2,nested:[{optionId:'original-option'}]};
    for(const name of index%2?['B','A']:['A','B'])await db.query(`insert into public.sale_items(sale_id,name,sku,category,quantity,unit_price,original_unit_price,configuration_snapshot)
      values($1,$2,$2,'Hobby',1,5,5,$3)`,[id,name,JSON.stringify(configuration)]);
    await db.query(`insert into public.payments(sale_id,method,amount,cash_tendered,change_given) values($1,'Cash',10,10,0)`,[id]);
  }
  await db.query('select private.refresh_duplicate_notifications()');await checkoutAs(db,f.actors.owner);
  const result=await feed();assert.equal(result.total,3);
  assert.deepEqual(result.items.map((item:any)=>item.orderIds).sort((a:string[],b:string[])=>a[0]!.localeCompare(b[0]!)),[ids.slice(0,3),ids.slice(3,6),ids.slice(6,9)].sort((a,b)=>a[0]!.localeCompare(b[0]!)));
  await checkoutValue(db,'select public.update_alert_settings((select updated_at from public.alert_settings),3,5) as value');
  const merged=(await feed()).items.find((item:any)=>item.orderIds.length===6);assert.ok(merged);await mark(merged);
  await checkoutValue(db,'select public.update_alert_settings((select updated_at from public.alert_settings),3,6) as value');
  const revised=(await feed()).items.find((item:any)=>item.orderIds.length===6);assert.equal(revised.id,merged.id);await mark(revised);
  await db.exec('reset role');await db.query('select private.refresh_duplicate_notifications()');await checkoutAs(db,f.actors.owner);
  const stable=(await feed()).items.find((item:any)=>item.orderIds.length===6);assert.equal(stable.id,revised.id);assert.equal(stable.read,true);
  await db.exec('reset role');await workflowRejects(db,()=>db.query("update private.notification_versions set evidence='{}'"),'23514');
});

test('the additive migration backfills existing saved alerts without changing any business row or seeding an account',async()=>{
  const old=new PGlite();try{
    await initialize(old,false);await old.exec('begin');const f=await workflowFixture(old);
    const sale=await f.buy();await checkoutAs(old,f.actors.staff);await f.execute(await f.request(sale.saleId));
    for(let i=0;i<4;i++)await f.buy();await old.exec('reset role');
    const before=await f.physical(),profiles=(await old.query('select * from public.profiles order by id')).rows;
    await old.exec('commit');await old.exec(await readFile(new URL('../supabase/migrations/20261018030000_in_app_notifications.sql',import.meta.url),'utf8'));
    await old.exec(await readFile(new URL('../supabase/migrations/20261018040000_stable_notification_identity.sql',import.meta.url),'utf8'));
    await old.exec('begin');await checkoutAs(old,f.actors.owner);assert.equal((await feed(old)).total,2);
    assert.deepEqual(await f.physical(),before);assert.deepEqual((await old.query('select * from public.profiles order by id')).rows,profiles);
    await old.exec('rollback');
  }finally{await old.close();}
});
