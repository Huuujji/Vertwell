import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { developmentClient } from './database.js';
import { reportScenarios } from './report-checks.js';
const {client,ref}=await developmentClient();
async function state(){
  const tables=(await client.query<{schema:string;name:string}>(`select n.nspname as schema,c.relname as name from pg_class c
    join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' order by 1,2`)).rows;
  const counts:Record<string,number>={},hashes:Record<string,string>={};
  for(const row of tables){
    const value=(await client.query(`select coalesce(jsonb_agg(v order by v::text),'[]') as value from (select to_jsonb(t) as v from "${row.schema}"."${row.name}" t) rows`)).rows[0].value;
    counts[`${row.schema}.${row.name}`]=value.length;hashes[`${row.schema}.${row.name}`]=createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
  const authIds=(await client.query('select id from auth.users order by id')).rows.map(row=>row.id);
  return {counts,hashes,authIds};
}
try{
  await client.connect();const before=await state(),passed:string[]=[];
  for(const s of reportScenarios){await client.query('begin');try{await s.run(client);passed.push(s.name);}finally{await client.query('rollback');}}
  assert.deepEqual(await state(),before,'Report verification must preserve every original row and checkout activation.');
  console.log(JSON.stringify({project:ref,result:'passed',checks:passed.length,details:passed,unchangedExistingRows:true,unchangedAccounts:true,unchangedCheckoutActivation:true,durableFixtureRows:0,realAuthAcceptance:false},null,2));
}catch(error){console.error(error instanceof Error?error.message:'Report verification failed.');process.exitCode=1;}finally{await client.end();}
