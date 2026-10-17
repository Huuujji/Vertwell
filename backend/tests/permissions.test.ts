import { before, after, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { permissionScenarios } from '../scripts/permission-checks.js';

const db = new PGlite();
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key, email text, raw_app_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  const root = new URL('../supabase/migrations/',import.meta.url);
  for (const file of (await readdir(root)).filter(file=>file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,root),'utf8'));
});
after(async () => { await db.close(); });
for (const scenario of permissionScenarios) test(scenario.name,async () => {
  await db.query('begin');
  try { await scenario.run(db); }
  finally { await db.query('rollback'); }
});
