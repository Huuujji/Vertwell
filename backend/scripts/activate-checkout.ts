import { createHash } from 'node:crypto';
import { developmentClient,migrationFiles } from './database.js';
const {client,ref}=await developmentClient();
const expected=process.argv[process.argv.indexOf('--project-ref')+1];
const enable=process.argv.includes('--enable'),disable=process.argv.includes('--disable');
let connected=false;
try{
  if(expected!==ref||enable===disable)throw new Error('Specify the exact --project-ref and exactly one of --enable or --disable.');
  await client.connect();connected=true;await client.query('begin');
  await client.query('select pg_advisory_xact_lock(171026,3)');await client.query('select pg_advisory_xact_lock(171026,1)');
  const files=await migrationFiles();
  const history=(await client.query<{version:string;statements:string[]}>('select version,statements from supabase_migrations.schema_migrations order by version')).rows;
  if(enable&&(history.length!==files.length||files.some(file=>{
    const row=history.find(row=>row.version===file.version);
    return !row||row.statements.length!==1||createHash('sha256').update(row.statements[0]!.replace(/\r\n/g,'\n')).digest('hex')!==file.sha256;
  })))throw new Error('Every reviewed migration must match the hosted history before enabling checkout.');
  await client.query('update private.checkout_state set enabled=$1 where singleton',[enable]);
  await client.query('commit');console.log(JSON.stringify({project:ref,checkoutEnabled:enable,accountsChanged:false,stockChanged:false}));
}catch(error){if(connected)await client.query('rollback').catch(()=>undefined);console.error(error instanceof Error?error.message:'Activation failed.');process.exitCode=1;}
finally{await client.end();}
