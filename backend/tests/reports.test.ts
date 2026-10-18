import { before,after,test } from 'node:test';
import { readFile,readdir,mkdir,mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { testRealtime } from '../scripts/test-realtime.js';
import { reportScenarios } from '../scripts/report-checks.js';
import { workflowFixture } from '../scripts/sales-workflow-checks.js';
import { checkoutAs,checkoutValue } from '../scripts/checkout-checks.js';
async function initialize(db:PGlite){
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await testRealtime(db);
  const root=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(root)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,root),'utf8'));
}
const db=new PGlite();before(()=>initialize(db));after(()=>db.close());
for(const s of reportScenarios)test(s.name,async()=>{await db.query('begin');try{await s.run(db);}finally{await db.query('rollback');}});
test('P8 durable report tables survive disk close/reopen with unchanged original review/stock/payment history',async()=>{
  const parent=fileURLToPath(new URL('../../../.review/',import.meta.url));await mkdir(parent,{recursive:true});
  const path=await mkdtemp(`${parent}p8-database-`);let disk=new PGlite(path);
  try{
    await initialize(disk);await disk.query('begin');const f=await workflowFixture(disk),sale=await f.buy();await f.execute(await f.review([sale.saleId]));
    const saved=await checkoutValue(disk,'select public.read_reports() as value');await disk.query('commit');await disk.close();disk=new PGlite(path);
    await disk.query('begin');await checkoutAs(disk,f.actors.admin);const restored=await checkoutValue(disk,'select public.read_reports() as value');
    assert.deepEqual(restored.tables,saved.tables);await disk.query('rollback');
  }finally{await disk.close();}
});
