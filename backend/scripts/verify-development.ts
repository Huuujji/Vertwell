import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { developmentClient } from './database.js';

const {client,ref} = await developmentClient();
const checks: string[] = [];
async function counts() {
  const tables = await client.query<{relname:string}>(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' order by c.relname`);
  const result: Record<string,number> = {};
  for (const table of tables.rows) {
    const safeName = table.relname.replaceAll('"','""');
    result[table.relname] = (await client.query(`select count(*)::int as count from public."${safeName}"`)).rows[0].count;
  }
  result.auth_users = (await client.query('select count(*)::int as count from auth.users')).rows[0].count;
  return result;
}
async function reject(sql: string, params: unknown[], pattern: RegExp) {
  await client.query('savepoint invalid_operation');
  try { await assert.rejects(() => client.query(sql,params),pattern); }
  finally { await client.query('rollback to savepoint invalid_operation; release savepoint invalid_operation'); }
}
async function id(sql: string, params: unknown[] = []) {
  return String((await client.query(sql,params)).rows[0].id);
}

try {
  await client.connect();
  const before = await counts();
  await client.query('begin');
  try {
    await client.query('select pg_advisory_xact_lock(171026,3)');
    const actor = randomUUID();
    // Auth schema fixture exists only inside this rolled-back SQL transaction.
    // It is not an Auth API provisioning or real login/recovery verification.
    await client.query('insert into auth.users(id) values ($1)',[actor]);
    await client.query("insert into public.profiles(id,full_name,username,role) values ($1,'Rollback smoke fixture',$2,'Owner')",[actor,`smoke-${randomUUID()}`]);
    checks.push('Auth primary-key relationship accepts a transactional fixture');
    const skuName = `SMOKE-${randomUUID()}`;
    const sku = await id('insert into public.skus(value) values ($1) returning id',[skuName]);
    await reject('insert into public.skus(value) values ($1)',[skuName.toLowerCase()],/unique/);
    checks.push('case-insensitive SKU uniqueness');
    const stock = await id(`insert into public.stock_items(sku_id,name,kind,category,unit_code)
      values ($1,'Rollback stock','Finished','Hobby','pcs') returning id`,[sku]);
    const batch = await id('insert into public.stock_batches(stock_item_id) values ($1) returning id',[stock]);
    const product = await id(`insert into public.products(sku_id,name,category,stock_model,stock_item_id,base_price)
      values ($1,'Rollback product','Hobby','Retail Item',$2,50) returning id`,[sku,stock]);
    await client.query('set constraints all immediate');
    await reject("update public.products set stock_model='Bundle',stock_item_id=null where id=$1",[product],/SKU may be shared/);
    checks.push('Retail Item shares only its own linked stock SKU');
    const movementSQL = `insert into public.stock_movements(batch_id,kind,quantity_base,actor_id,actor_name,actor_role,reason,operation_id)
      values ($1,$2,$3,$4,'Rollback fixture','Owner','Development rollback smoke test',$5)`;
    const openingOperation = randomUUID();
    await client.query(movementSQL,[batch,'Opening',5,actor,openingOperation]);
    await reject(movementSQL,[batch,'Receipt',1,actor,openingOperation],/unique/);
    await reject(movementSQL,[batch,'Removal',-6,actor,randomUUID()],/negative/);
    await reject(movementSQL,[batch,'Removal',-0.5,actor,randomUUID()],/whole quantities/);
    checks.push('movement idempotency, negative-balance and whole-piece guards');
    await reject('update public.stock_movements set quantity_base=100 where batch_id=$1',[batch],/append-only/);
    await reject('delete from public.audit_events where operation_id=$1',[openingOperation],/append-only/);
    checks.push('immutable stock/audit history');
    const snapshot = (await client.query('select stock_sku,stock_name,unit_code from public.stock_movements where batch_id=$1',[batch])).rows;
    await client.query("update public.skus set value=$1 where id=$2",[`CHANGED-${randomUUID()}`,sku]);
    assert.deepEqual((await client.query('select stock_sku,stock_name,unit_code from public.stock_movements where batch_id=$1',[batch])).rows,snapshot);
    checks.push('movement snapshots survive SKU edits');
    await client.query('savepoint atomic_write');
    await client.query(movementSQL,[batch,'Removal',-2,actor,randomUUID()]);
    await assert.rejects(() => client.query("select 'invalid'::uuid"),/uuid/);
    await client.query('rollback to savepoint atomic_write; release savepoint atomic_write');
    assert.equal((await client.query('select sum(quantity_base) as quantity from public.stock_movements where batch_id=$1',[batch])).rows[0].quantity,'5.000000');
    assert.equal((await client.query('select count(*)::int as count from public.audit_events where operation_id=$1',[openingOperation])).rows[0].count,1);
    checks.push('stock movement plus audit roll back atomically');
    await reject('update public.stock_batches set archived_at=now() where id=$1',[batch],/Record batch removal/);
    checks.push('batch archival requires recorded physical removal');
    const sale = await id(`insert into public.sales(order_number,idempotency_key,request_hash,occurred_at,cashier_id,cashier_name,cashier_role,
      subtotal,tax_amount,total,review_state,status) values ($1,$2,'rollback-smoke','2026-01-01T16:00:00Z',$3,'Rollback fixture','Owner',50,6,56,'Owner checkout','Completed') returning id`,
      [`SMOKE-${randomUUID()}`,randomUUID(),actor]);
    assert.equal((await client.query('select business_date::text as day from public.sales where id=$1',[sale])).rows[0].day,'2026-01-02');
    await reject('update public.sales set total=1 where id=$1',[sale],/snapshots/);
    await client.query(`update public.sales set status='Voided',voided_at=now(),voided_by=$1,voided_name='Rollback fixture',
      voided_role='Owner',void_reason='Rollback test' where id=$2`,[actor,sale]);
    assert.equal((await client.query('select sum(quantity_base) as quantity from public.stock_movements where batch_id=$1',[batch])).rows[0].quantity,'5.000000');
    checks.push('Manila date, frozen sale values and void leaves stock unchanged');
    for (const role of ['anon','authenticated','service_role']) {
      await client.query(`set local role ${role}`);
      await reject('select * from public.profiles',[],/permission denied/);
      await reject("insert into public.skus(value) values ('DENIED')",[],/permission denied/);
      await client.query('reset role');
    }
    checks.push('anonymous, authenticated and service-role direct reads/writes denied');
    await client.query('grant select,insert on public.skus to authenticated; set local role authenticated');
    assert.equal((await client.query('select count(*)::int as count from public.skus')).rows[0].count,0);
    await reject("insert into public.skus(value) values ('DENIED-RLS')",[],/row-level security/);
    await client.query('reset role');
    checks.push('RLS still denies rows after an accidental privilege grant');
  } finally { await client.query('rollback'); }
  assert.deepEqual(await counts(),before);
  checks.push('rollback restores every application/Auth table count and temporary grants');
  console.log(JSON.stringify({project:ref,result:'passed',checks:checks.length,details:checks,
    durableTestRows:0,realAuthLoginVerified:false},null,2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Development smoke verification failed.');
  process.exitCode=1;
} finally { await client.end(); }
