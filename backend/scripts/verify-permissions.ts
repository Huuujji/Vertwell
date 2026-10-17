import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { developmentClient } from './database.js';
import { permissionScenarios } from './permission-checks.js';

const { client, ref } = await developmentClient();
async function state() {
  const tables = (await client.query<{relname:string}>(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' order by c.relname`)).rows;
  const counts: Record<string,number> = {};
  for (const {relname} of tables) counts[relname] = (await client.query(`select count(*)::int as count from public."${relname.replaceAll('"','""')}"`)).rows[0].count;
  counts.auth_users = (await client.query('select count(*)::int as count from auth.users')).rows[0].count;
  // Compare fingerprints privately; never print profile/credential/provider data.
  const protectedRows = (await client.query(`select jsonb_build_object(
    'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),
    'auth',(select jsonb_agg(to_jsonb(u) order by id) from auth.users u),
    'settings',(select jsonb_agg(to_jsonb(s)) from public.alert_settings s)) as value`)).rows[0].value;
  const grants = (await client.query(`select table_name,grantee,privilege_type from information_schema.role_table_grants
    where table_schema='public' and grantee in ('PUBLIC','anon','authenticated','service_role') order by 1,2,3`)).rows;
  return { counts, fingerprint:createHash('sha256').update(JSON.stringify(protectedRows)).digest('hex'),grants };
}
try {
  await client.connect();
  const before = await state();
  const passed: string[] = [];
  for (const scenario of permissionScenarios) {
    await client.query('begin');
    try { await scenario.run(client); passed.push(scenario.name); }
    finally { await client.query('rollback'); }
  }
  assert.deepEqual(await state(),before,'Every table count, existing identity/settings row and grant must survive unchanged.');
  console.log(JSON.stringify({ project:ref,result:'passed',checks:passed.length,details:passed,
    unchangedExistingAccounts:true,unchangedSettings:true,durableFixtureRows:0,realAuthAccountsCreated:0 },null,2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Permission verification failed.');
  process.exitCode=1;
} finally { await client.end(); }
