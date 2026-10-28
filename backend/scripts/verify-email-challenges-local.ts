// Disposable native PostgreSQL contention only. NOT native Supabase Auth/mail.
import { Client } from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { testRealtime } from './test-realtime.js';

const connectionString=process.env.VERTWELL_CHALLENGE_DATABASE_URL??'';
const url=new URL(connectionString);
if(!process.argv.includes('--confirm-disposable')||!['127.0.0.1','localhost'].includes(url.hostname)||
  !/^\/vertwell_email_[a-z0-9_]+$/.test(url.pathname)||url.search)throw new Error('Fresh disposable localhost email database required.');
const admin=new Client({connectionString}),a=new Client({connectionString}),b=new Client({connectionString});
let checks=0;
try {
  await admin.connect();
  assert.equal((await admin.query("select count(*)::int n from information_schema.tables where table_schema in ('public','auth','private')")).rows[0].n,0,'Refusing a populated database');
  await admin.query(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create table auth.users(id uuid primary key,email text unique,raw_app_meta_data jsonb default '{}',email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await testRealtime({exec:sql=>admin.query(sql)});
  const root=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(root)).filter(f=>f.endsWith('.sql')).sort())await admin.query(await readFile(new URL(file,root),'utf8'));
  await Promise.all([a.connect(),b.connect()]);await Promise.all([a.query('set role service_role'),b.query('set role service_role')]);
  const call=async(client:Client,c:Record<string,unknown>)=>(await client.query('select public.email_challenge($1::jsonb) value',[JSON.stringify(c)])).rows[0].value;
  async function fixture(){
    const id=randomUUID(),email=`${id}@example.invalid`,ticket=randomUUID(),code='12345678',tokenHash=createHash('sha224').update(email+code).digest('hex');
    await admin.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,clock_timestamp())',[id,email]);
    await admin.query("insert into public.profiles(id,full_name,username,role) values($1,'Native SQL test',$2,'Staff')",[id,id]);
    const c={email,purpose:'recovery',ticket};
    assert.equal((await call(a,{...c,action:'reserve'})).allowed,true);
    assert.equal((await call(a,{...c,action:'activate',userId:id,tokenHash})).allowed,true);
    await admin.query("update private.email_challenges set next_send_at=clock_timestamp()-interval '1 second' where user_id=$1",[id]);
    return {id,email,ticket,code,tokenHash,c};
  }
  // Separate server connections contend inside the SQL command's actual lock.
  for(let i=0;i<12;i++){
    const f=await fixture();
    const results=await Promise.all([call(a,{action:'consume',purpose:'recovery',tokenHash:f.tokenHash,ticket:f.ticket}),call(b,{action:'consume',purpose:'recovery',email:f.email,code:f.code})]);
    assert.equal(results.filter(r=>r.allowed).length,1);checks++;
    assert.equal((await call(b,{...f.c,action:'reserve',ticket:randomUUID()})).allowed,false);checks++;
    assert.equal((await call(a,{...f.c,action:'finish',outcome:'completed'})).allowed,true);
  }
  for(let i=0;i<12;i++){
    const f=await fixture(),ticket=randomUUID();
    const [resend,consume]=await Promise.all([call(a,{...f.c,ticket,action:'reserve'}),call(b,{action:'consume',purpose:'recovery',tokenHash:f.tokenHash,ticket:f.ticket})]);
    assert.equal(Number(resend.allowed)+Number(consume.allowed),1);checks++;
    if(resend.allowed){
      assert.equal((await call(a,{...f.c,action:'activate',tokenHash:f.tokenHash,userId:f.id})).allowed,false);checks++;
    }else{
      assert.equal((await call(a,{...f.c,action:'reserve',ticket:randomUUID()})).allowed,false);checks++;
    }
  }
  console.log(JSON.stringify({checks,passed:true,evidence:'Native PostgreSQL multi-connection only; no native Auth, delivery or official data'}));
} finally {await Promise.allSettled([a.end(),b.end(),admin.end()]);}
