import { before, after, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { inventoryScenarios } from '../scripts/inventory-checks.js';
const db=new PGlite();
async function initialize(database:PGlite) {
  await database.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  const root=new URL('../supabase/migrations/',import.meta.url);
  for(const name of (await readdir(root)).filter(n=>n.endsWith('.sql')).sort()) await database.exec(await readFile(new URL(name,root),'utf8'));
}
before(()=>initialize(db));
after(()=>db.close());
for(const scenario of inventoryScenarios) test(scenario.name,async()=>{
  await db.query('begin'); try {await scenario.run(db);} finally {await db.query('rollback');}
});
test('P5 aggregate and movement data survive closing and reopening a disk database',async()=>{
  const parent=fileURLToPath(new URL('../../../.review/',import.meta.url));await mkdir(parent,{recursive:true});
  const path=await mkdtemp(`${parent}p5-database-`);let disk=new PGlite(path);
  try {
    await initialize(disk);await disk.query('begin');await inventoryScenarios[1]!.run(disk);await disk.query('commit');
    const read=()=>disk.transaction(async tx=>{
      const owner=(await tx.query<{id:string}>("select id from public.profiles where role='Owner' limit 1")).rows[0]!.id;
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);await tx.query('set local role authenticated');
      return (await tx.query<{value:unknown}>('select public.read_inventory() as value')).rows[0]!.value;
    });
    const before=await read();await disk.close();disk=new PGlite(path);assert.deepEqual(await read(),before);
  } finally {await disk.close();}
});
