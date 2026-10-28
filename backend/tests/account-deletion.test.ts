import {before,after,beforeEach,afterEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import type {SupabaseClient} from '@supabase/supabase-js';
import {testRealtime} from '../scripts/test-realtime.js';
import {deleteManagedAccount,deletionInput} from '../src/lib/account-deletion.js';
import {accountInput} from '../src/lib/accounts.js';

// Real disposable SQL; Auth delete/session cascades below are provider simulation.
const db=new PGlite(),owner=randomUUID();
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text unique,
      raw_app_meta_data jsonb default '{}',email_confirmed_at timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
    create table auth.refresh_tokens(id uuid primary key,session_id uuid references auth.sessions(id) on delete cascade);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[],owner uuid,owner_id text);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text);
    alter table storage.objects enable row level security;`);
  await testRealtime(db);
  const root=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(root)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,root),'utf8'));
  await db.query('insert into auth.users(id,email) values($1,$2)',[owner,'owner@example.invalid']);
  await db.query("insert into public.profiles(id,full_name,username,role) values($1,'Original Owner','owner','Owner')",[owner]);
});
after(async()=>db.close());
beforeEach(async()=>{await db.exec('begin');});
afterEach(async()=>{await db.exec('rollback');});
async function attempt<T>(work:()=>Promise<T>):Promise<T>{
  await db.exec('savepoint attempt');
  try{const value=await work();await db.exec('release savepoint attempt');return value;}
  catch(error){await db.exec('rollback to savepoint attempt;release savepoint attempt');throw error;}
}
async function as(id:string,sql:string,args:unknown[]=[]){return attempt(async()=>{
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.exec('set local role authenticated');
  const result=await db.query<any>(sql,args);await db.exec('reset role');return result.rows;
});}
async function user(username='target',role='Staff',pending=false){
  const id=randomUUID();await db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)',[id,`${username}@example.invalid`,pending?' {"happyhentie_email_required":true}':'{}']);
  await db.query('insert into public.profiles(id,full_name,username,role) values($1,$2,$3,$4)',[id,`Original ${username}`,username,role]);
  return (await db.query<any>('select * from public.profiles where id=$1',[id])).rows[0];
}
const command=(target:any,operation_id=randomUUID())=>({target_id:target.id,expected_updated_at:target.updated_at,operation_id});
async function prepare(actor:string,c:ReturnType<typeof command>){return (await as(actor,'select public.prepare_account_deletion($1,$2,$3) as value',Object.values(c)))[0].value;}
const remove=(id:string)=>attempt(()=>db.query('delete from auth.users where id=$1',[id]));
async function exists(id:string){return (await db.query('select id from auth.users where id=$1',[id])).rows.length>0;}
async function snapshot(table:string){return (await db.query(`select to_jsonb(t) as value from ${table} t order by to_jsonb(t)::text`)).rows;}
const sqlCode=(code:string)=>(error:any)=>error.code===code;
function clients(actor:string,mode:'normal'|'reject'|'lost'|'ack-only'='normal'){
  let calls=0;
  const database={rpc(name:string,args:any){return {abortSignal:async()=>{
    try{return {data:(await as(actor,`select public.${name}($1,$2,$3) as value`,Object.values(args)))[0].value,error:null};}
    catch(error:any){return {data:null,error:{code:error.code}};}
  }};}} as unknown as SupabaseClient;
  const admin={auth:{admin:{async deleteUser(id:string,soft:boolean){calls++;assert.equal(soft,false);
    if(mode==='reject')return {error:{status:503}};
    if(mode==='ack-only')return {error:null};
    await remove(id);if(mode==='lost')throw Error('Simulated lost provider response');return {error:null};
  }}}} as unknown as SupabaseClient;
  return {database,admin,calls:()=>calls};
}

test('hard deletion preserves original profile and populated business history, removes sessions/challenges/listing, and permits username reuse',async()=>{
  const target=await user(),other=await user('unrelated');
  const sale=randomUUID(),sku=randomUUID(),stock=randomUUID(),batch=randomUUID(),session=randomUUID();
  await db.query(`insert into public.sales(id,order_number,idempotency_key,request_hash,cashier_id,cashier_name,cashier_role,subtotal,tax_amount,total,review_state,status)
    values($1,'Original Sale',$2,'original',$3,'Original target','Staff',10,0,10,'Awaiting Owner review','Completed')`,[sale,randomUUID(),target.id]);
  await db.query("insert into public.payments(sale_id,method,amount,cash_tendered,change_given) values($1,'Cash',10,10,0)",[sale]);
  await db.query("insert into public.skus(id,value) values($1,'ORIGINAL')",[sku]);
  await db.query("insert into public.stock_items(id,sku_id,name,kind,category,unit_code) values($1,$2,'Original stock','Finished','Hobby','pcs')",[stock,sku]);
  await db.query('insert into public.stock_batches(id,stock_item_id) values($1,$2)',[batch,stock]);
  await db.query("insert into public.stock_movements(batch_id,kind,quantity_base,actor_id,actor_name,actor_role,reason,operation_id) values($1,'Opening',5,$2,'Original target','Staff','Original receipt',$3)",[batch,target.id,randomUUID()]);
  await db.query('insert into auth.sessions values($1,$2)',[session,target.id]);
  await db.query('insert into auth.refresh_tokens values($1,$2)',[randomUUID(),session]);
  await db.query("insert into private.email_challenges(user_id,purpose,ticket,reserved_at,next_send_at,expires_at) values($1,'recovery',$2,now(),now(),now()+interval '10 minutes')",[target.id,randomUUID()]);
  const tables=['public.sales','public.payments','public.stock_movements','public.cash_movements','public.profiles','private.account_operations'];
  const old=await Promise.all(tables.map(snapshot)),audit=await snapshot('public.audit_events');
  assert.equal((await as(target.id,'select * from public.sales')).length,1);
  assert.equal((await as(target.id,"select public.authorize_business_action('pos.read') as value"))[0].value.profile.id,target.id);
  const c=command(target),transport=clients(owner,'lost');
  assert.equal((await deleteManagedAccount(transport.database,transport.admin,c)).status,'completed');
  assert.equal(await exists(target.id),false);assert.equal(await exists(other.id),true);
  assert.equal((await db.query('select * from auth.sessions')).rows.length,0);
  assert.equal((await db.query('select * from auth.refresh_tokens')).rows.length,0);
  assert.equal((await db.query('select * from private.email_challenges where user_id=$1',[target.id])).rows.length,0);
  assert.deepEqual(await Promise.all(tables.map(snapshot)),old);
  const after=await snapshot('public.audit_events');for(const row of audit)assert.ok(after.some(v=>JSON.stringify(v)===JSON.stringify(row)));
  assert.equal((await as(owner,'select public.read_managed_accounts() as value'))[0].value.some((a:any)=>a.id===target.id),false);
  await assert.rejects(()=>as(target.id,'select public.current_profile()'),sqlCode('42501'));
  await assert.rejects(()=>as(target.id,"select public.authorize_business_action('pos.read')"),sqlCode('42501'));
  assert.equal((await as(target.id,'select * from public.sales')).length,0);
  await assert.rejects(()=>attempt(()=>db.query("update public.profiles set full_name='Rewritten' where id=$1",[target.id])),sqlCode('23514'));
  const replacement=await user('target');assert.notEqual(replacement.id,target.id);
  assert.equal((await db.query<any>('select cashier_id from public.sales where id=$1',[sale])).rows[0].cashier_id,target.id);
  await deleteManagedAccount(transport.database,transport.admin,c);assert.equal(transport.calls(),1);
  assert.equal(await exists(replacement.id),true);
  await assert.rejects(()=>attempt(()=>db.query('insert into auth.users(id,email) values($1,$2)',[target.id,'revived@example.invalid'])),sqlCode('23514'));
});

test('current role, self, pending actor, last-accessible-Owner and retired-account safeguards are enforced',async()=>{
  const staff=await user(),admin=await user('admin','Admin'),pending=await user('pending-owner','Owner',true);
  await assert.rejects(()=>prepare(staff.id,command(admin)),sqlCode('42501'));
  const ownerProfile=(await db.query<any>('select * from public.profiles where id=$1',[owner])).rows[0];
  await assert.rejects(()=>prepare(admin.id,command(ownerProfile)),sqlCode('42501'));
  await assert.rejects(()=>prepare(owner,command(ownerProfile)),sqlCode('23514'));
  await assert.rejects(()=>prepare(pending.id,command(staff)),sqlCode('42501'));
  await assert.rejects(()=>as(owner,'select public.update_account($1,$2,$3,$4,$5)',[owner,ownerProfile.updated_at,ownerProfile.full_name,ownerProfile.username,'Staff']),sqlCode('23514'));
  await db.query('update public.profiles set active=false where id=$1',[staff.id]);
  await db.query("insert into private.retired_accounts(profile_id,reason) values($1,'Historical fixture')",[staff.id]);
  const retired=(await db.query<any>('select * from public.profiles where id=$1',[staff.id])).rows[0];
  await assert.rejects(()=>prepare(owner,command(retired)),sqlCode('42501'));
});

test('retained Admin profile cannot use old JWT claims against any protected read projection after Auth deletion',async()=>{
  const target=await user('former-admin','Admin');
  assert.equal((await as(target.id,'select public.business_access() as value'))[0].value.profile.id,target.id);
  await prepare(owner,command(target));await remove(target.id);
  for(const name of ['current_profile','business_access','read_managed_accounts','read_inventory','read_reports',
    'read_notifications','read_pos_catalogue','read_sales_workflow','read_checkout_catalogue'])
    await assert.rejects(()=>as(target.id,`select public.${name}()`),sqlCode('42501'),name);
});

test('manual inactive/reactivation requests are rejected in HTTP input and direct SQL; internal restrictions remain',async()=>{
  const target=await user();
  for(const active of [true,false])assert.throws(()=>accountInput({fullName:'Target',username:'target',role:'Staff',active,updatedAt:target.updated_at}));
  await assert.rejects(()=>as(owner,'select public.update_account($1,$2,$3,$4,$5,$6)',[target.id,target.updated_at,target.full_name,target.username,'Staff',false]),sqlCode('23514'));
  await db.query('update public.profiles set active=false where id=$1',[target.id]);
  const inactive=(await db.query<any>('select * from public.profiles where id=$1',[target.id])).rows[0];
  await assert.rejects(()=>as(owner,'select public.update_account($1,$2,$3,$4,$5,$6)',[target.id,inactive.updated_at,target.full_name,target.username,'Staff',true]),sqlCode('23514'));
  await assert.rejects(()=>as(target.id,'select public.current_profile()'),sqlCode('42501'));
});

test('stale or altered operations cannot authorize deletion; live authority is rechecked at provider commit',async()=>{
  const target=await user(),other=await user('other'),admin=await user('admin','Admin'),c=command(target);
  await prepare(admin.id,c);
  await assert.rejects(()=>prepare(admin.id,{...c,target_id:other.id}),sqlCode('PT409'));
  await assert.rejects(()=>prepare(owner,c),sqlCode('PT409'));
  await db.query("update public.profiles set role='Admin' where id=$1",[target.id]);
  await assert.rejects(()=>remove(target.id),sqlCode('42501'));assert.equal(await exists(target.id),true);
  const changed=(await db.query<any>('select * from public.profiles where id=$1',[target.id])).rows[0];
  const fresh=command(changed);await prepare(owner,fresh);await remove(target.id);
  assert.equal((await as(owner,'select public.account_deletion_result($1,$2,$3) as value',Object.values(fresh)))[0].value.status,'completed');
  assert.equal(await exists(other.id),true);
});

test('owned Storage, processing recovery and expired confirmation block deletion without changing records',async()=>{
  const target=await user(),c=command(target);
  await db.query("insert into storage.objects(bucket_id,name,owner_id) values('inventory-images','original.png',$1)",[target.id]);
  await assert.rejects(()=>prepare(owner,c),sqlCode('PT412'));assert.equal(await exists(target.id),true);
  await db.query('delete from storage.objects');
  await db.query("insert into private.email_challenges(user_id,purpose,ticket,reserved_at,next_send_at,expires_at,processing) values($1,'recovery',$2,now(),now(),now()+interval '10 minutes',true)",[target.id,randomUUID()]);
  await assert.rejects(()=>prepare(owner,c),sqlCode('PT409'));
  await db.query('update private.email_challenges set processing=false where user_id=$1',[target.id]);
  await prepare(owner,c);await db.query("update private.account_deletions set expires_at=now()-interval '1 second' where operation_id=$1",[c.operation_id]);
  await assert.rejects(()=>remove(target.id),sqlCode('42501'));assert.equal(await exists(target.id),true);
});

test('provider failures and acknowledgement-only responses never report success; explicit retry reconciles the same identity',async()=>{
  const target=await user(),c=command(target),failed=clients(owner,'reject');
  await assert.rejects(()=>deleteManagedAccount(failed.database,failed.admin,c));assert.equal(await exists(target.id),true);
  const ack=clients(owner,'ack-only');await assert.rejects(()=>deleteManagedAccount(ack.database,ack.admin,c));
  const ok=clients(owner);assert.equal((await deleteManagedAccount(ok.database,ok.admin,c)).status,'completed');
  await deleteManagedAccount(ok.database,ok.admin,c);assert.equal(ok.calls(),1);
});

test('audit/native cleanup failure rolls back Auth, challenge removal and completion receipt together',async()=>{
  const target=await user(),c=command(target);await prepare(owner,c);
  await db.query("insert into private.email_challenges(user_id,purpose,ticket,reserved_at,next_send_at,expires_at) values($1,'verification',$2,now(),now(),now()+interval '10 minutes')",[target.id,randomUUID()]);
  await db.exec(`create function private.fail_deletion_audit() returns trigger language plpgsql as $$begin
    if new.event_type='Account deleted' then raise exception 'Fixture audit failure';end if;return new;end$$;
    create trigger fixture_audit_failure before insert on public.audit_events for each row execute function private.fail_deletion_audit();`);
  await assert.rejects(()=>remove(target.id));assert.equal(await exists(target.id),true);
  assert.equal((await db.query('select * from private.email_challenges where user_id=$1',[target.id])).rows.length,1);
  assert.equal((await db.query<any>('select state from private.account_deletions where operation_id=$1',[c.operation_id])).rows[0].state,'ready');
  await db.exec('drop trigger fixture_audit_failure on public.audit_events');
  await db.exec(`create function private.fail_native_cleanup() returns trigger language plpgsql as $$begin raise exception 'Fixture native cleanup failure';end$$;
    create trigger zz_fixture_native_failure after delete on auth.users for each row execute function private.fail_native_cleanup();`);
  await assert.rejects(()=>remove(target.id));assert.equal(await exists(target.id),true);
  assert.equal((await db.query('select * from private.email_challenges where user_id=$1',[target.id])).rows.length,1);
});

test('provisioning receipts cannot resurrect a deleted account or match its replacement',async()=>{
  const target=await user(),op=randomUUID(),expected={fullName:target.full_name,username:target.username,role:target.role,email:'target@example.invalid'};
  await db.query('insert into private.account_operations values($1,$2,$3,$4)',[op,owner,target.id,JSON.stringify(expected)]);
  await prepare(owner,command(target));await remove(target.id);const replacement=await user('target');
  await assert.rejects(()=>as(owner,'select public.account_provisioning_result($1,$2)',[op,JSON.stringify(expected)]),sqlCode('PT410'));
  assert.equal(await exists(replacement.id),true);
});

test('lost completion receipt returns uncertainty and a retry recovers the committed result without another native call',async()=>{
  const target=await user(),c=command(target),transport=clients(owner);
  const database={rpc(name:string,args:any){
    if(name==='account_deletion_result')return {abortSignal:async()=>({data:null,error:{code:'PGRST000'}})};
    return transport.database.rpc(name,args);
  }} as unknown as SupabaseClient;
  await assert.rejects(()=>deleteManagedAccount(database,transport.admin,c));
  assert.equal(await exists(target.id),false);assert.equal(transport.calls(),1);
  assert.equal((await deleteManagedAccount(transport.database,transport.admin,c)).status,'completed');
  assert.equal(transport.calls(),1);
});

test('request validation and grants reject forged targets, credentials and direct receipt writes',async()=>{
  const target=await user();
  assert.throws(()=>deletionInput('target',{operationId:randomUUID(),updatedAt:target.updated_at}));
  assert.throws(()=>deletionInput(target.id,{operationId:randomUUID(),updatedAt:target.updated_at,email:'another@example.invalid'}));
  await assert.rejects(()=>as(owner,'delete from private.account_deletions'),sqlCode('42501'));
  await assert.rejects(()=>as(owner,'delete from auth.users where id=$1',[target.id]),sqlCode('42501'));
  await assert.rejects(()=>remove(target.id),sqlCode('42501'));
});
