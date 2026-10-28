import { before,after,beforeEach,afterEach,test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { testRealtime } from '../scripts/test-realtime.js';
import { workflowFixture } from '../scripts/sales-workflow-checks.js';
import { checkoutAs,checkoutValue } from '../scripts/checkout-checks.js';
import { randomUUID } from 'node:crypto';

const db=new PGlite();
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await testRealtime(db);
  const root=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(root)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,root),'utf8'));
});
after(()=>db.close());beforeEach(()=>db.exec('begin'));afterEach(()=>db.exec('rollback'));
async function visible(actor:string,topic:string){
  await checkoutAs(db,actor);await db.query("select set_config('request.realtime.topic',$1,true)",[topic]);await db.exec('set local role authenticated');
  try{return (await db.query<{topic:string}>('select topic from realtime.messages')).rows;}finally{await db.exec('reset role');}
}
test('private receive policies isolate managers, each cashier, inactive accounts and unknown topics',async()=>{
  const f=await workflowFixture(db);await f.buy();await db.exec('reset role');
  const topics=(await db.query<{topic:string}>('select distinct topic from realtime.messages')).rows.map(r=>r.topic);
  assert.ok(topics.includes('vertwell:managers'));assert.ok(topics.includes('vertwell:catalogue'));
  for(const actor of [f.actors.owner,f.actors.admin])assert.ok((await visible(actor,'vertwell:managers')).length);
  assert.equal((await visible(f.actors.staff,'vertwell:managers')).length,0);
  assert.ok((await visible(f.actors.staff,`vertwell:user:${f.actors.staff}`)).length);
  assert.equal((await visible(f.actors.staff,`vertwell:user:${f.actors.owner}`)).length,0);
  assert.equal((await visible(f.actors.staff,'unrelated')).length,0);
  await db.query('update public.profiles set active=false where id=$1',[f.actors.staff]);
  assert.equal((await visible(f.actors.staff,'vertwell:catalogue')).length,0);
  assert.equal((await visible(f.actors.staff,`vertwell:user:${f.actors.staff}`)).length,0);
});
test('checkout, review and void invalidations contain no records and cannot be published by clients',async()=>{
  const f=await workflowFixture(db),sale=await f.buy();await f.execute(await f.review([sale.saleId]));await db.exec('reset role');
  const messages=await db.query<{payload:Record<string,unknown>;private:boolean;event:string}>('select payload,private,event from realtime.messages');
  assert.ok(messages.rows.length>0);
  for(const row of messages.rows){assert.equal(row.private,true);assert.equal(row.event,'invalidate');assert.ok(Object.keys(row.payload).every(key=>['scopes','identity'].includes(key)));}
  await checkoutAs(db,f.actors.staff);await db.exec('set local role authenticated;savepoint denied');
  await assert.rejects(()=>db.query("select realtime.send('{}','invalidate','vertwell:managers',true)"),/permission|policy/i);
  await db.exec('rollback to savepoint denied;reset role');
  const grants=await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','private.broadcast_sales_change()','EXECUTE') as allowed");
  assert.equal(grants.rows[0]!.allowed,false);
});
test('a rolled-back inventory operation leaves no invalidation to announce a nonexistent change',async()=>{
  const f=await workflowFixture(db);await db.exec('reset role');const before=await db.query('select * from realtime.messages');
  await db.exec('savepoint cancelled');await db.query('update private.inventory_state set revision=revision+1 where singleton');
  assert.ok((await db.query('select * from realtime.messages')).rows.length>before.rows.length);
  await db.exec('rollback to savepoint cancelled');assert.deepEqual((await db.query('select * from realtime.messages')).rows,before.rows);
  assert.ok(f.actors.owner);
});

test('saved inventory, account, settings, checkout, request, decision, review, void and readiness changes invalidate every affected authorized view',async()=>{
  const f=await workflowFixture(db);
  async function clear(){await db.exec('reset role;delete from realtime.messages');await checkoutAs(db,f.actors.owner);}
  async function announced(topic:string,scopes:string[],identity=false){
    await db.exec('reset role');
    const rows=(await db.query<{payload:{scopes:string[];identity?:boolean}}> ('select payload from realtime.messages where topic=$1',[topic])).rows;
    assert.ok(rows.length,`Missing private event for ${topic}`);
    for(const scope of scopes)assert.ok(rows.some(row=>row.payload.scopes.includes(scope)),`Missing ${scope} invalidation`);
    if(identity)assert.ok(rows.some(row=>row.payload.identity===true));
    await checkoutAs(db,f.actors.owner);
  }
  await clear();await f.save('product.save',{...f.product,name:'Renamed saved product'});
  await announced('vertwell:managers',['inventory','reports']);await announced('vertwell:catalogue',['catalogue']);
  await clear();await db.exec('reset role');const revision=(await db.query<{updated_at:string}>('select updated_at::text from public.profiles where id=$1',[f.actors.staff])).rows[0]!.updated_at;await checkoutAs(db,f.actors.owner);
  await checkoutValue(db,'select public.update_account($1,$2,$3,$4,$5,$6) as value',[f.actors.staff,revision,'Renamed cashier',`p6-${f.actors.staff}`,'Staff',true]);
  await announced('vertwell:managers',['accounts']);await announced(`vertwell:user:${f.actors.staff}`,['access'],true);
  await clear();await checkoutValue(db,'select public.update_alert_settings(null,4,3) as value');await announced('vertwell:managers',['accounts']);
  await clear();const sale=await f.buy();await announced('vertwell:managers',['inventory','sales','reports']);await announced('vertwell:catalogue',['catalogue']);await announced(`vertwell:user:${f.actors.staff}`,['sales']);
  await clear();await checkoutAs(db,f.actors.staff);await f.execute(await f.request(sale.saleId));
  await announced('vertwell:managers',['sales','reports']);await announced(`vertwell:user:${f.actors.staff}`,['sales']);
  await clear();const request=(await f.read()).items.find((row:any)=>row.id===sale.saleId).requests[0];
  await f.execute({operationId:randomUUID(),kind:'void.decide',targets:[await f.target(sale.saleId)],requestId:request.id,approved:false,reasonId:'other',notes:'Checked original receipt'});
  await announced('vertwell:managers',['sales','reports']);await announced(`vertwell:user:${f.actors.staff}`,['sales']);
  await clear();await f.execute(await f.review([sale.saleId]));await announced('vertwell:managers',['sales','reports']);await announced(`vertwell:user:${f.actors.staff}`,['sales']);
  await clear();const physical=await f.physical();await checkoutAs(db,f.actors.owner);await f.execute(await f.voidCommand([sale.saleId]));
  await announced('vertwell:managers',['sales','reports']);await announced(`vertwell:user:${f.actors.staff}`,['sales']);assert.deepEqual(await f.physical(),physical);
  await clear();await db.exec('reset role;update private.checkout_state set enabled=false where singleton');await announced('vertwell:catalogue',['access']);
});
