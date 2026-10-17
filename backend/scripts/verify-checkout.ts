import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { developmentClient } from './database.js';
import { checkoutScenarios } from './checkout-checks.js';

// Sequential SQL acceptance, not a claim of simultaneous connection contention
// or real Auth/PostgREST payment recording. Every scenario is rolled back.
const {client,ref}=await developmentClient();
async function state(){
  const tables=(await client.query<{schema:string;name:string}>(`select n.nspname as schema,c.relname as name from pg_class c
    join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' order by 1,2`)).rows;
  const counts:Record<string,number>={};
  for(const row of tables)counts[`${row.schema}.${row.name}`]=(await client.query(`select count(*)::int as n from "${row.schema}"."${row.name}"`)).rows[0].n;
  const protectedRows=(await client.query(`select jsonb_build_object(
    'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),
    'auth',(select jsonb_agg(to_jsonb(a) order by id) from auth.users a),
    'settings',(select jsonb_agg(to_jsonb(s)) from public.alert_settings s),
    'revision',(select jsonb_agg(to_jsonb(r)) from private.inventory_state r),
    'activation',(select jsonb_agg(to_jsonb(s)) from private.checkout_state s),
    'operations',(select jsonb_agg(to_jsonb(o) order by operation_id) from private.checkout_operations o)) as value`)).rows[0].value;
  const grants=(await client.query(`select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants
    where table_schema in ('public','private') and grantee in ('PUBLIC','anon','authenticated','service_role') order by 1,2,3,4`)).rows;
  const policies=(await client.query("select policyname,cmd,roles::text[],qual,with_check from pg_policies where schemaname='storage' order by policyname")).rows;
  return {counts,grants,policies,fingerprint:createHash('sha256').update(JSON.stringify(protectedRows)).digest('hex')};
}
try{
  await client.connect();const before=await state(),passed:string[]=[];
  assert.ok(before.policies.some(p=>p.policyname==='checkout_image_read'&&p.cmd==='SELECT'&&JSON.stringify(p.roles)==='["authenticated"]'));
  for(const scenario of checkoutScenarios){await client.query('begin');try{await scenario.run(client);passed.push(scenario.name);}finally{await client.query('rollback');}}
  assert.deepEqual(await state(),before,'Checkout verification must preserve all original identities, settings, counts, revision, receipts and policies.');
  console.log(JSON.stringify({project:ref,result:'passed',checks:passed.length,details:passed,durableFixtureRows:0,unchangedAccounts:true,
    unchangedSettings:true,unchangedStockAndRevision:true,unchangedReceipts:true,realAuthAcceptance:false,simultaneousContention:false},null,2));
}catch(error){console.error(error instanceof Error?error.message:'Checkout verification failed.');process.exitCode=1;}
finally{await client.end();}
