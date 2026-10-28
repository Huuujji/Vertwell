import pg from 'pg';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { testRealtime } from './test-realtime.js';
import { workflowFixture } from './sales-workflow-checks.js';
import { checkoutAs, checkoutValue } from './checkout-checks.js';

// No dotenv or hosted administration import. Refuse anything but a NEW local DB.
const raw=process.env.VERTWELL_ADJUSTMENTS_DATABASE_URL;
if(!raw||!process.argv.includes('--confirm-disposable'))throw new Error('A fresh local database and --confirm-disposable are required. No connection attempted.');
const target=new URL(raw);
if(!['postgres:','postgresql:'].includes(target.protocol)||!['127.0.0.1','localhost','[::1]'].includes(target.hostname)||!/^\/vertwell_adjustments_[a-z0-9_]+$/.test(target.pathname)||target.search||target.hash)throw new Error('Only a fresh localhost vertwell_adjustments_* database is permitted. No connection attempted.');
const configuration={connectionString:raw,connectionTimeoutMillis:5000,statement_timeout:20000};
const db=new pg.Client({...configuration,application_name:'major-adjustment-controller'}),workers=[0,1].map(i=>new pg.Client({...configuration,application_name:`major-adjustment-race-${i}`}));
async function transaction<T>(client:pg.Client,run:()=>Promise<T>){await client.query('begin');try{const r=await run();await client.query('commit');return r;}catch(e){await client.query('rollback');throw e;}}
try{
  await db.connect();assert.equal(await checkoutValue(db,"select count(*)::int as value from pg_namespace where nspname in ('auth','private','realtime')"),0,'Database must be fresh');
  assert.equal(await checkoutValue(db,"select count(*)::int as value from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'"),0);
  assert.equal(await checkoutValue(db,"select count(*)::int as value from pg_database where not datistemplate and datname not in ('postgres',current_database())"),0,'Use an isolated new cluster');
  await db.query(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await testRealtime({exec:sql=>db.query(sql)});const root=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(root)).filter(f=>f.endsWith('.sql')).sort())await db.query(await readFile(new URL(file,root),'utf8'));
  for(const w of workers)await w.connect();
  const f=await transaction(db,()=>workflowFixture(db));
  async function prepared(){
    return transaction(db,async()=>{await checkoutAs(db,f.actors.owner);const sale=await f.buy(),s=(await f.read()).items.find((s:any)=>s.id===sale.saleId),i=s.adjustableItems[0],u=i.usage[0];
      return {operationId:randomUUID(),kind:'stock.dispose',targets:[{saleId:s.id,token:s.token}],reasonId:'refund_return',notes:'Disposable forced-overlap concurrency',
        dispositions:[{itemId:i.id,stockId:u.stockId,quantityBase:'1',condition:'unused',evidence:'Confirmed physically unused',resalePolicyConfirmed:false,
          facts:{foodOrBeverage:false,prepared:false,handedOver:false,returned:false,physicallyPresent:true,sellable:true,additionalConsumption:false}}]};
    });
  }
  async function race(commands:any[]){
    await db.query('begin');await db.query('select pg_advisory_xact_lock(171026,3)');
    const pending=commands.map((command,index)=>transaction(workers[index]!,async()=>{await checkoutAs(workers[index]!,f.actors.owner);return checkoutValue(workers[index]!,'select public.sales_workflow_command($1::jsonb) as value',[JSON.stringify(command)]);}));
    // Attach handlers before releasing the lock, avoiding unhandled rejections.
    const settled=Promise.allSettled(pending);let waiting=0;
    for(let probe=0;probe<200;probe++){
      waiting=await checkoutValue(db,"select count(*)::int as value from pg_stat_activity where application_name like 'major-adjustment-race-%' and wait_event='advisory'");
      if(waiting===2)break;await new Promise(resolve=>setTimeout(resolve,20));
    }
    assert.equal(waiting,2,'Both independent connections must actually wait on the account lock');await db.query('commit');return settled;
  }
  const exact=await prepared(),same=await race([exact,exact]);assert.ok(same.every(r=>r.status==='fulfilled'));
  assert.equal(same.filter(r=>r.status==='fulfilled'&&r.value.replayed).length,1);
  const competing=await prepared(),different=await race([competing,{...competing,operationId:randomUUID()}]);
  assert.equal(different.filter(r=>r.status==='fulfilled').length,1);assert.ok(different.some(r=>r.status==='rejected'&&r.reason.code==='PT409'));
  const missing=await prepared();missing.dispositions[0]!.condition='not_returned';missing.dispositions[0]!.facts={foodOrBeverage:false,prepared:false,handedOver:true,returned:false,physicallyPresent:false,sellable:false,additionalConsumption:false};
  const later=await transaction(db,async()=>{await checkoutAs(db,f.actors.owner);await f.execute(missing);const sale=(await f.read()).items.find((s:any)=>s.id===missing.targets[0]!.saleId),d=sale.adjustments.dispositions[0];
    return {...missing,operationId:randomUUID(),targets:[{saleId:sale.id,token:sale.token}],dispositions:[{...missing.dispositions[0],sourceDispositionId:d.id,condition:'returned_sellable',resalePolicyConfirmed:true,facts:{foodOrBeverage:false,prepared:false,handedOver:true,returned:true,physicallyPresent:true,sellable:true,additionalConsumption:false}}]};});
  const snapshot=await checkoutValue(db,`select jsonb_build_object('payments',(select jsonb_agg(to_jsonb(p) order by id) from public.payments p),'usage',(select jsonb_agg(to_jsonb(u) order by id) from public.sale_item_stock_usage u),'consumption',(select jsonb_agg(to_jsonb(m) order by id) from public.stock_movements m where kind='Consumption')) as value`);
  const laterExact=await race([later,later]);assert.equal(laterExact.filter(r=>r.status==='fulfilled').length,2);assert.equal(laterExact.filter(r=>r.status==='fulfilled'&&r.value.replayed).length,1);
  const refreshed=await transaction(db,async()=>{await checkoutAs(db,f.actors.owner);return {...later,operationId:randomUUID(),targets:[await f.target(later.targets[0]!.saleId)]};});
  const exhausted=await race([refreshed,{...refreshed,operationId:randomUUID()}]);assert.ok(exhausted.every(r=>r.status==='rejected'&&r.reason.code==='PT409'));
  assert.deepEqual(await checkoutValue(db,`select jsonb_build_object('payments',(select jsonb_agg(to_jsonb(p) order by id) from public.payments p),'usage',(select jsonb_agg(to_jsonb(u) order by id) from public.sale_item_stock_usage u),'consumption',(select jsonb_agg(to_jsonb(m) order by id) from public.stock_movements m where kind='Consumption')) as value`),snapshot);
  assert.equal(await checkoutValue(db,'select count(*)::int as value from private.stock_dispositions'),4);
  assert.equal(await checkoutValue(db,"select count(*)::int as value from public.stock_movements where kind='Return'"),3);
  assert.equal(await checkoutValue(db,'select count(*)::int as value from private.manual_refunds'),0);
  assert.equal(await checkoutValue(db,`select count(*)::int as value from public.payments`),3);
  assert.equal(Number(await checkoutValue(db,`select sum(quantity_base)::text as value from public.stock_movements where kind='Return'`)),3);
  // Preserve the existing refund contention assertion as a regression only; no policy changes.
  const refundStock=await prepared();
  const refund={operationId:refundStock.operationId,kind:'refund.record',targets:refundStock.targets,reasonId:refundStock.reasonId,notes:refundStock.notes,
    refund:{amount:'10',method:'Cash',reference:randomUUID(),paidAt:new Date().toISOString(),evidence:'Disposable manual payout evidence',paidConfirmed:true}};
  const payout=await race([refund,{...refund,operationId:randomUUID(),refund:{...refund.refund,reference:randomUUID()}}]);
  assert.equal(payout.filter(r=>r.status==='fulfilled').length,1);assert.ok(payout.some(r=>r.status==='rejected'&&r.reason.code==='PT409'));
  assert.equal(Number(await checkoutValue(db,'select coalesce(sum(amount),0)::text as value from private.manual_refunds')),10);
  assert.equal(await checkoutValue(db,'select count(*)::int as value from private.stock_dispositions'),4);
  assert.equal(await checkoutValue(db,"select count(*)::int as value from public.stock_movements where kind='Return'"),3);
  async function preparedRefund(reference:string=randomUUID()){
    const source=await prepared();return {operationId:source.operationId,kind:'refund.record',targets:source.targets,reasonId:source.reasonId,notes:source.notes,
      refund:{amount:'4',method:'Cash',reference,paidAt:new Date().toISOString(),evidence:'Disposable concurrency payout evidence',paidConfirmed:true}};
  }
  const refundExact=await preparedRefund(),refundReplay=await race([refundExact,refundExact]);assert.ok(refundReplay.every(r=>r.status==='fulfilled'));assert.equal(refundReplay.filter(r=>r.status==='fulfilled'&&r.value.replayed).length,1);
  const sharedReference=randomUUID(),left=await preparedRefund(sharedReference),right=await preparedRefund(sharedReference.toUpperCase());
  const referenceRace=await race([left,right]);assert.equal(referenceRace.filter(r=>r.status==='fulfilled').length,1);assert.ok(referenceRace.some(r=>r.status==='rejected'&&r.reason.code==='23505'));
  const limit=await preparedRefund(),limitRace=await race([{...limit,refund:{...limit.refund,amount:'8'}},{...limit,operationId:randomUUID(),refund:{...limit.refund,amount:'8',reference:randomUUID()}}]);assert.equal(limitRace.filter(r=>r.status==='fulfilled').length,1);assert.ok(limitRace.some(r=>r.status==='rejected'&&r.reason.code==='PT409'));
  const freshLimit=await transaction(db,async()=>{await checkoutAs(db,f.actors.owner);return {...limit,operationId:randomUUID(),targets:[await f.target(limit.targets[0]!.saleId)],refund:{...limit.refund,amount:'8',reference:randomUUID()}};});
  const remainingRace=await race([freshLimit,{...freshLimit,operationId:randomUUID()}]);assert.ok(remainingRace.every(r=>r.status==='rejected'&&r.reason.code==='PT409'));
  const fingerprint=await transaction(db,async()=>{await checkoutAs(db,f.actors.owner);return {...refundExact,operationId:randomUUID(),targets:[await f.target(refundExact.targets[0]!.saleId)],refund:{...refundExact.refund,reference:randomUUID()}};});
  const fingerprintRace=await race([fingerprint,{...fingerprint,operationId:randomUUID(),refund:{...fingerprint.refund,reference:randomUUID()}}]);assert.ok(fingerprintRace.every(r=>r.status==='rejected'&&r.reason.code==='23505'));
  assert.equal(await checkoutValue(db,'select count(*)::int as value from private.manual_refunds'),4);assert.equal(Number(await checkoutValue(db,'select sum(amount)::text as value from private.manual_refunds')),26);
  assert.equal(await checkoutValue(db,"select count(*)::int as value from public.cash_movements where kind='Refund' and review_id is null"),4);
  assert.equal(await checkoutValue(db,"select count(*)::int as value from private.manual_refunds r join public.cash_movements c on c.operation_id=r.operation_id and c.sale_id=r.sale_id and c.amount=r.amount and c.occurred_at=r.paid_at where c.kind='Refund' and c.review_id is null"),4);
  console.log(JSON.stringify({passed:10,forcedWaitingConnectionsPerRace:2,scenarios:['identical disposition replay','changed-operation stale disposition','linked later-return replay','exhausted linked eligibility','changed-operation refund stale conflict','identical refund replay','cross-sale normalized reference conflict','competing partial refund stale conflict','fresh-token remaining limit conflict','changed-reference payout fingerprint conflict'],officialDatabaseContacted:false,refundPolicy:'original payment method',manualOperatorEvidenceOnly:true}));
}finally{
  await db.query('rollback').catch(()=>{});await Promise.allSettled(workers.map(w=>w.end()));await db.end().catch(()=>{});
}
