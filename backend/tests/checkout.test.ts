import { before,after,test } from 'node:test';
import { readFile,readdir,mkdir,mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { checkoutScenarios,checkoutFixture,checkoutValue } from '../scripts/checkout-checks.js';
async function initialize(db:PGlite) {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  const root=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(root)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,root),'utf8'));
}
const db=new PGlite();before(()=>initialize(db));after(()=>db.close());
for(const scenario of checkoutScenarios)test(scenario.name,async()=>{await db.query('begin');try{await scenario.run(db);}finally{await db.query('rollback');}});
test('P6 purchased receipt and stock ledger survive a disk database close/reopen',async()=>{
  const parent=fileURLToPath(new URL('../../../.review/',import.meta.url));await mkdir(parent,{recursive:true});
  const path=await mkdtemp(`${parent}p6-database-`);let disk=new PGlite(path);
  try {
    await initialize(disk);await disk.query('begin');const f=await checkoutFixture(disk);const r=await f.checkout(await f.command());
    await disk.query('commit');await disk.close();disk=new PGlite(path);
    const saved=await checkoutValue(disk,'select receipt as value from private.checkout_operations where sale_id=$1',[r.saleId]);
    assert.deepEqual(saved,r);assert.equal(Number(await checkoutValue(disk,'select sum(quantity_base)::text as value from public.stock_movements where batch_id=$1',[f.stock.batches[0].id])),9);
  } finally {await disk.close();}
});
