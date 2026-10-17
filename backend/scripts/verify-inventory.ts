import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { developmentClient } from './database.js';
import { inventoryScenarios } from './inventory-checks.js';

const {client,ref}=await developmentClient();
async function state() {
  const tables=(await client.query<{schema:string;name:string}>(`select n.nspname as schema,c.relname as name
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' order by 1,2`)).rows;
  const counts:Record<string,number>={};
  for(const t of tables) counts[`${t.schema}.${t.name}`]=(await client.query(`select count(*)::int as value from "${t.schema}"."${t.name}"`)).rows[0].value;
  counts.auth_users=(await client.query('select count(*)::int as value from auth.users')).rows[0].value;
  const protectedRows=(await client.query(`select jsonb_build_object(
    'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),
    'auth',(select jsonb_agg(to_jsonb(u) order by id) from auth.users u),
    'settings',(select jsonb_agg(to_jsonb(s)) from public.alert_settings s),
    'revision',(select jsonb_agg(to_jsonb(r)) from private.inventory_state r)) as value`)).rows[0].value;
  const grants=(await client.query(`select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants
    where table_schema in ('public','private') and grantee in ('PUBLIC','anon','authenticated','service_role') order by 1,2,3,4`)).rows;
  return {counts,fingerprint:createHash('sha256').update(JSON.stringify(protectedRows)).digest('hex'),grants};
}
try {
  await client.connect();const before=await state(),passed:string[]=[];
  const bucket=(await client.query("select public,file_size_limit::text,allowed_mime_types from storage.buckets where id='inventory-images'")).rows[0];
  assert.deepEqual(bucket,{public:false,file_size_limit:'2097152',allowed_mime_types:['image/png','image/jpeg','image/webp']});
  const policies=(await client.query("select policyname,cmd,roles::text[] from pg_policies where schemaname='storage' and policyname like 'inventory_image_%' order by policyname")).rows;
  assert.deepEqual(policies,[{policyname:'inventory_image_insert',cmd:'INSERT',roles:['authenticated']},{policyname:'inventory_image_read',cmd:'SELECT',roles:['authenticated']}]);
  for(const scenario of inventoryScenarios) {
    await client.query('begin');try {await scenario.run(client);passed.push(scenario.name);}finally {await client.query('rollback');}
  }
  assert.deepEqual(await state(),before,'All original identities/settings, table counts, inventory revision and grants must be unchanged.');
  console.log(JSON.stringify({project:ref,result:'passed',checks:passed.length,details:passed,privateImageBucketVerified:true,
    unchangedExistingAccounts:true,unchangedSettings:true,unchangedInventory:true,durableFixtureRows:0,realAuthAccountsCreated:0},null,2));
}catch(error){console.error(error instanceof Error?error.message:'Inventory verification failed.');process.exitCode=1;}
finally {await client.end();}
