import { before,after,test } from 'node:test';
import { readFile,readdir,mkdir,mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { checkoutAs,checkoutValue } from '../scripts/checkout-checks.js';
import { workflowFixture,workflowScenarios } from '../scripts/sales-workflow-checks.js';
async function initialize(db:PGlite) {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  const root=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(root)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,root),'utf8'));
}
const db=new PGlite();before(()=>initialize(db));after(()=>db.close());
for(const scenario of workflowScenarios)test(scenario.name,async()=>{await db.query('begin');try{await scenario.run(db);}finally{await db.query('rollback');}});
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
