import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { developmentClient } from './database.js';
import { lockSalesReset,salesResetSnapshot,salesResetPreserved,salesResetToken,resetSalesInsideTransaction } from './sales-reset-data.js';

const args=process.argv.slice(2),apply=args.includes('--apply');
const option=(key:string)=>args[args.indexOf(key)+1];
const {client,ref}=await developmentClient();
if(option('--project-ref')!==ref) throw new Error('Specify --project-ref matching the configured development database.');
await client.connect();
try {
  await client.query('begin');
  await lockSalesReset(client);
  const snapshot=await salesResetSnapshot(client),preserved=await salesResetPreserved(client),token=salesResetToken(snapshot,preserved);
  const counts=Object.fromEntries(Object.entries(snapshot).map(([table,rows])=>[table,(rows as unknown[]).length]));
  if(apply && option('--confirm')!==token) throw new Error('Snapshot changed or confirmation is missing. Run the dry run and review its new token.');
  let backup:string|undefined;
  if(apply) {
    const directory=resolve(import.meta.dirname,'../../../.review/sales-reset');await mkdir(directory,{recursive:true});
    backup=resolve(directory,`${Date.now()}-${ref}.json`);
    await writeFile(backup,JSON.stringify({projectRef:ref,token,createdAt:new Date().toISOString(),preserved,snapshot}),{flag:'wx',mode:0o600});
  }
  await resetSalesInsideTransaction(client);
  await client.query(apply?'commit':'rollback');
  console.log(JSON.stringify({mode:apply?'committed':'dry-run rolled back',projectRef:ref,counts,confirmationToken:token,backup,accountsAndInventoryPreserved:true},null,2));
} catch(cause) {await client.query('rollback');throw cause;}
finally {await client.end();}
