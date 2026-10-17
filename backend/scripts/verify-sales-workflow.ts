import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { developmentClient } from './database.js';
import { workflowScenarios } from './sales-workflow-checks.js';
// Sequential rollback verification. Real Auth/PostgREST and simultaneous
// connection contention require separate acceptance and are never implied here.
const {client,ref}=await developmentClient();
let connectionError:Error|undefined;
client.on('error',error=>{connectionError=error;});
async function state(){
  if(connectionError)throw new Error('Development database connection was interrupted.');
  const tables=(await client.query<{schema:string;name:string}>(`select n.nspname as schema,c.relname as name from pg_class c
    join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' order by 1,2`)).rows;
  const counts:Record<string,number>={},hashes:Record<string,string>={};
  for(const row of tables){
    const source=(await client.query(`select coalesce(jsonb_agg(v order by v::text),'[]') as value from (select to_jsonb(t) as v from "${row.schema}"."${row.name}" t) rows`)).rows[0].value;
    counts[`${row.schema}.${row.name}`]=source.length;
    hashes[`${row.schema}.${row.name}`]=createHash('sha256').update(JSON.stringify(source)).digest('hex');
  }
  const auth=(await client.query('select coalesce(jsonb_agg(to_jsonb(a) order by id),\'[]\') as value from auth.users a')).rows[0].value;
  return {counts,hashes,authFingerprint:createHash('sha256').update(JSON.stringify(auth)).digest('hex')};
}
try{
  await client.connect();const before=await state(),passed:string[]=[];
  for(const scenario of workflowScenarios){await client.query('begin');try{await scenario.run(client);passed.push(scenario.name);}finally{await client.query('rollback');}}
  assert.deepEqual(await state(),before,'Workflow verification must preserve every pre-existing row and checkout activation.');
  console.log(JSON.stringify({project:ref,result:'passed',checks:passed.length,details:passed,durableFixtureRows:0,unchangedExistingRows:true,
    unchangedAccounts:true,unchangedCheckoutActivation:true,realAuthAcceptance:false,simultaneousContention:false},null,2));
}catch(error){console.error(error instanceof Error?error.message:'Workflow verification failed.');process.exitCode=1;}
finally{await client.end();}
