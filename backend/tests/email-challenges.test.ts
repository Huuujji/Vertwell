import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { testRealtime } from '../scripts/test-realtime.js';
import type { Server } from 'node:http';
process.env.SUPABASE_URL='https://email.test';process.env.SUPABASE_PUBLISHABLE_KEY='test-public';process.env.SUPABASE_SECRET_KEY='test-private';
process.env.ACCOUNT_EMAIL_ORIGIN='https://email-app.test';process.env.BREVO_API_KEY='synthetic-brevo-key-only';
process.env.ACCOUNT_EMAIL_FROM='sender@example.invalid';process.env.ACCOUNT_EMAIL_REPLY_TO='reply@example.invalid';
const db=new PGlite(),owner=randomUUID(),original=globalThis.fetch;
let server:Server,base:string;const passwords=new Map<string,string>(),sessions=new Map<string,string>(),messages:{email:string;purpose:string;code:string;hash:string}[]=[],logouts:string[]=[];
let sequence=12345670,blockedProviderRequests=0;
let failDelivery=false,loseCreateResponse=false;
let nativeLoginUnconfirmed=false;
let verifyAs:string|undefined,failCleanup=false;
let overwriteGeneration=false,loseDelivery=false,updateFailure=false,loseUpdate=false,finishFailure=false;
let verifyGate:Promise<void>|undefined,enteredVerify:(()=>void)|undefined;
let ordinaryProof='';
let generatedCount=0,verifyCount=0,updateCount=0;
let otpDigits=8,badGeneration=false;
let brevoMode:'accepted'|'rejected'|'lost'|'malformed'='accepted',brevoRequests=0;
const cleanupScopes:string[]=[];
const delivery={origin:'https://email-app.test',async send(message:{email:string;purpose:'verification'|'recovery';code:string;tokenHash:string;linkProof:string;link:string}):Promise<'accepted'|'rejected'>{
  assert.equal(message.link,`https://email-app.test/auth/${message.purpose==='verification'?'verify':'recover'}#token_hash=${message.linkProof}`);
  if(failDelivery)return 'rejected';
  messages.push({...message,hash:message.linkProof});
  if(loseDelivery)throw new Error('Synthetic lost delivery response');
  return 'accepted';
}};
async function nativeUser(id:string){const u=(await db.query<any>('select * from auth.users where id=$1',[id])).rows[0];return {id,email:u.email,app_metadata:u.raw_app_meta_data,email_confirmed_at:u.email_confirmed_at,aud:'authenticated',role:'authenticated',created_at:new Date().toISOString(),user_metadata:{}};}
async function session(id:string){const user=await nativeUser(id),now=Math.floor(Date.now()/1000);const token=`e30.${Buffer.from(JSON.stringify({sub:id,exp:now+3600})).toString('base64url')}.test`;sessions.set(token,id);return {access_token:token,refresh_token:randomUUID(),expires_in:3600,token_type:'bearer',user};}
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create table auth.users(id uuid primary key,email text unique,raw_app_meta_data jsonb default '{}',email_confirmed_at timestamptz,confirmation_token text,confirmation_sent_at timestamptz,recovery_token text,recovery_sent_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await testRealtime(db);const root=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(root)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,root),'utf8'));
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[owner,'owner@example.invalid']);
  await db.query("insert into public.profiles(id,full_name,username,role) values($1,'Existing owner','existing-owner','Owner')",[owner]);sessions.set('manager',owner);
  globalThis.fetch=async(input,init)=>{
    const url=new URL(String(input));if(url.hostname==='127.0.0.1')return original(input,init);
    if(url.origin==='https://api.brevo.com') {
      brevoRequests++;assert.equal(url.pathname,'/v3/smtp/email');assert.equal(init?.redirect,'error');
      const headers=new Headers(init?.headers);assert.equal(headers.get('api-key'),'synthetic-brevo-key-only');assert.equal(headers.get('authorization'),null);
      const body=JSON.parse(String(init?.body));assert.deepEqual(body.sender,{name:'HappyHentie',email:'sender@example.invalid'});
      assert.deepEqual(body.replyTo,{email:'reply@example.invalid'});assert.equal(body.to.length,1);
      const purpose=body.subject==='HappyHentie — Verify your account email'?'verification':'recovery';
      const hash=body.htmlContent.match(/#token_hash=([a-f0-9]{56}\.[a-f0-9-]{36})"/)?.[1];
      const code=body.htmlContent.match(/>(\d{6,8})<\/p>/)?.[1];assert.ok(hash&&code);
      assert.ok(body.htmlContent.includes(`href="https://email-app.test/auth/${purpose==='verification'?'verify':'recover'}#token_hash=${hash}"`));
      if(brevoMode==='rejected')return Response.json({message:'synthetic-brevo-key-only private provider error'},{status:429});
      messages.push({email:body.to[0].email,purpose,code,hash});
      if(brevoMode==='lost')throw new Error('synthetic-brevo-key-only lost response '+hash);
      return brevoMode==='malformed'?Response.json({unexpected:'synthetic-brevo-key-only'},{status:201}):Response.json({messageId:'<synthetic-only@brevo.test>'},{status:201});
    }
    if(url.origin!=='https://email.test'){blockedProviderRequests++;throw new Error('External transport blocked');}
    const body=init?.body?JSON.parse(String(init.body)):{},token=new Headers(init?.headers).get('authorization')?.replace('Bearer ','')??'',actor=sessions.get(token);
    if(url.pathname==='/auth/v1/user'&&init?.method!=='PUT')return actor?Response.json(await nativeUser(actor)):Response.json({message:'invalid'},{status:401});
    if(url.pathname==='/auth/v1/admin/users'){
      assert.equal(body.email_confirm,false);assert.equal(body.app_metadata.happyhentie_email_required,true);
      const id=randomUUID();
      try { await db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)',[id,body.email,JSON.stringify(body.app_metadata)]); }
      catch { return Response.json({message:'Duplicate or rejected provisioning'},{status:422}); }
      passwords.set(id,body.password);
      if(loseCreateResponse) {loseCreateResponse=false;return Response.json({message:'Lost committed response'},{status:500});}
      return Response.json(await nativeUser(id));
    }
    if(url.pathname==='/auth/v1/token') {
      const row=(await db.query<any>('select id from auth.users where email=$1',[body.email])).rows[0];
      if(row&&passwords.get(row.id)===body.password) {
        if(nativeLoginUnconfirmed)return Response.json({code:'email_not_confirmed',message:'Email not confirmed'},{status:400,headers:{'x-supabase-api-version':'2024-01-01'}});
        return Response.json(await session(row.id)); // Deliberately issues pending tokens: app must still deny.
      }
      return Response.json({message:'invalid'},{status:400});
    }
    if(url.pathname==='/auth/v1/admin/generate_link'){
      generatedCount++;
      const user=(await db.query<any>('select id from auth.users where email=$1',[body.email])).rows[0];if(!user)return Response.json({});
      const purpose=body.type==='signup'?'verification':'recovery',code=otpDigits===6?String(++sequence%1_000_000).padStart(6,'0'):String(++sequence),hash=createHash('sha224').update(body.email+code).digest('hex');
      await db.query(`update auth.users set ${purpose==='verification'?'confirmation':'recovery'}_token=$2,${purpose==='verification'?'confirmation':'recovery'}_sent_at=clock_timestamp() where id=$1`,[user.id,hash]);
      if(overwriteGeneration){ordinaryProof=createHash('sha224').update(body.email+'99999999').digest('hex');await db.query('update auth.users set recovery_token=$2 where id=$1',[user.id,ordinaryProof]);}
      return Response.json({...await nativeUser(user.id),email_otp:code,hashed_token:badGeneration?'0'.repeat(56):hash,verification_type:body.type,action_link:'https://email.test/unsafe-native-link',redirect_to:'https://email.test'});
    }
    if(url.pathname==='/auth/v1/verify'){
      verifyCount++;enteredVerify?.();if(verifyGate)await verifyGate;
      assert.ok(['signup','recovery'].includes(body.type));const column=body.type==='signup'?'confirmation':'recovery';
      const row=(await db.query<any>(`select id from auth.users where ${column}_token=$1`,[body.token_hash])).rows[0];
      if(!row)return Response.json({message:'invalid expired'},{status:403});
      await db.query(`update auth.users set ${column}_token=null,email_confirmed_at=coalesce(email_confirmed_at,clock_timestamp()) where id=$1`,[row.id]);return Response.json(await session(verifyAs??row.id));
    }
    if(url.pathname==='/auth/v1/user'&&init?.method==='PUT'){
      updateCount++;
      if(updateFailure)return Response.json({message:'Synthetic password rejection'},{status:422});
      if(!actor)return Response.json({message:'invalid'},{status:401});passwords.set(actor,body.password);
      if(loseUpdate)throw new Error('Synthetic lost update response');
      return Response.json(await nativeUser(actor));
    }
    if(url.pathname==='/auth/v1/logout'){assert.ok(actor);logouts.push(actor!);cleanupScopes.push(url.searchParams.get('scope')??'global');return failCleanup?Response.json({message:'Synthetic cleanup failure'},{status:503}):new Response(null,{status:204});}
    if(url.pathname.startsWith('/rest/v1/rpc/')){
      const name=url.pathname.split('/').at(-1)!;if(!['current_profile','account_provisioning_result','email_challenge','consume_login_attempt'].includes(name))throw new Error('Unexpected RPC');
      if(finishFailure&&name==='email_challenge'&&body.command.action==='finish')return Response.json({message:'Synthetic completion receipt outage'},{status:503});
      try{const result=await db.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actor??'']);await tx.query(`set local role ${token==='test-private'?'service_role':'authenticated'}`);
        const keys=Object.keys(body);return (await tx.query<any>(`select public.${name}(${keys.map((k,i)=>`${k}=>$${i+1}`).join(',')}) as value`,keys.map(k=>typeof body[k]==='object'?JSON.stringify(body[k]):body[k]))).rows[0]?.value;});return Response.json(result??null);}
      catch(error){return Response.json({code:(error as any).code},{status:400});}
    }
    throw new Error('Unexpected test Auth request');
  };
  const {createApp}=await import('../src/app.js');server=createApp({},delivery).listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const addr=server.address();assert.ok(addr&&typeof addr!=='string');base=`http://127.0.0.1:${addr.port}`;
});

async function fixture(purpose:'verification'|'recovery') {
  const id=randomUUID(),email=`test-${id}@example.invalid`;
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[id,email,purpose==='recovery'?new Date():null]);
  await db.query("insert into public.profiles(id,full_name,username,role) values($1,'Challenge fixture',$2,'Staff')",[id,`test-${id}`]);
  passwords.set(id,'Original-test-123');
  const {sendAccountEmail,completeAccountEmail}=await import('../src/lib/email-challenges.js');
  const send=()=>sendAccountEmail(email,purpose,delivery);
  const fresh=async()=>{await db.query("update private.email_challenges set next_send_at=clock_timestamp()-interval '1 second' where user_id=$1",[id]);assert.equal(await send(),true);return messages.at(-1)!;};
  const complete=(m:typeof messages[number],link:boolean)=>completeAccountEmail({purpose,...(link?{tokenHash:m.hash}:{email,code:m.code}),...(purpose==='recovery'?{password:'Updated-test-123'}:{})});
  return {id,email,send,fresh,complete,completeAccountEmail};
}

for(const purpose of ['verification','recovery'] as const) for(const link of [false,true]) {
  test(`${purpose} ${link?'link':'code'}: once-only across concurrent alternatives, retries and wrong purpose`,async()=>{
    const f=await fixture(purpose),m=await f.fresh(),other=purpose==='verification'?'recovery':'verification';
    await assert.rejects(()=>f.completeAccountEmail({purpose:other,tokenHash:m.hash,...(other==='recovery'?{password:'Wrong-test-123'}:{})}),/invalid/);
    const before=verifyCount,results=await Promise.allSettled([f.complete(m,link),f.complete(m,!link),f.complete(m,link)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(verifyCount,before+1);
    await assert.rejects(()=>f.complete(m,!link),/already been used/);
    assert.equal(passwords.get(f.id),purpose==='recovery'?'Updated-test-123':'Original-test-123');
  });
}

for(const purpose of ['verification','recovery'] as const) test(`${purpose}: expiry, five attempts, cooldown, supersession and failed/lost delivery`,async()=>{
  const f=await fixture(purpose),m=await f.fresh(),before=generatedCount;
  assert.equal(await f.send(),false);assert.equal(generatedCount,before);
  for(let i=0;i<5;i++)await assert.rejects(()=>f.complete({...m,code:'00000000'},false),/invalid/);
  await assert.rejects(()=>f.complete(m,true),/attempt limit/);
  const newer=await f.fresh();await assert.rejects(()=>f.complete(m,true),/invalid/);
  await db.query("update private.email_challenges set expires_at=clock_timestamp()-interval '1 second' where user_id=$1",[f.id]);
  await assert.rejects(()=>f.complete(newer,false),/expired/);await assert.rejects(()=>f.complete(newer,true),/expired/);
  failDelivery=true;
  try {await db.query("update private.email_challenges set next_send_at=clock_timestamp()-interval '1 second' where user_id=$1",[f.id]);assert.equal(await f.send(),false);} finally {failDelivery=false;}
  assert.equal((await db.query<any>('select digest from private.email_challenges where user_id=$1',[f.id])).rows[0].digest,null);
  loseDelivery=true;
  try {await db.query("update private.email_challenges set next_send_at=clock_timestamp()-interval '1 second' where user_id=$1",[f.id]);await assert.rejects(f.send,/could not be confirmed/);} finally {loseDelivery=false;}
  await f.complete(messages.at(-1)!,true); // Lost sender response did not discard delivered proof.
});

test('overlapping ordinary magic-link token is never adopted for recovery; native supersession fails closed',async()=>{
  const f=await fixture('recovery');overwriteGeneration=true;
  let m:typeof messages[number];try {m=await f.fresh();} finally {overwriteGeneration=false;}
  await assert.rejects(()=>f.completeAccountEmail({purpose:'recovery',tokenHash:ordinaryProof+'.'+m!.hash.split('.')[1],password:'Wrong-test-123'}),/invalid/);
  await assert.rejects(()=>f.complete({...m!,code:'99999999'},false),/invalid/);
  await assert.rejects(()=>f.complete(m!,true),/invalid/);assert.equal(passwords.get(f.id),'Original-test-123');
  const fresh=await f.fresh();await f.complete(fresh,false);assert.equal(passwords.get(f.id),'Updated-test-123');
});

test('completion holds resend across provider wait; rejected update permits a fresh challenge',async()=>{
  const f=await fixture('recovery'),m=await f.fresh();let release!:()=>void;
  verifyGate=new Promise<void>(resolve=>{release=resolve;});const entered=new Promise<void>(resolve=>{enteredVerify=resolve;});
  const work=f.complete(m,true);
  try {await entered;await db.query("update private.email_challenges set next_send_at=clock_timestamp()-interval '1 second' where user_id=$1",[f.id]);assert.equal(await f.send(),false);}
  finally {enteredVerify=undefined;verifyGate=undefined;release();}
  await work;
  const next=await f.fresh();updateFailure=true;try {await assert.rejects(()=>f.complete(next,false),/could not be confirmed/);} finally {updateFailure=false;}
  await f.complete(await f.fresh(),true);
});

test('uncertain password update and failed completion receipt prevent replay and unsafe resend',async()=>{
  for(const failure of ['update','receipt']) {
    const f=await fixture('recovery'),m=await f.fresh(),before=updateCount;
    loseUpdate=failure==='update';finishFailure=failure==='receipt';
    try {await assert.rejects(()=>f.complete(m,true));} finally {loseUpdate=false;finishFailure=false;}
    assert.equal(updateCount,before+1);
    await assert.rejects(()=>f.complete(m,false),/processed/);
    await db.query("update private.email_challenges set next_send_at=clock_timestamp()-interval '1 second' where user_id=$1",[f.id]);assert.equal(await f.send(),false);
    assert.equal(passwords.get(f.id),'Updated-test-123');
  }
});

test('absent delivery adapter fails before generating native credentials',async()=>{
  const f=await fixture('recovery'),before=generatedCount;
  const {sendAccountEmail}=await import('../src/lib/email-challenges.js');
  await assert.rejects(()=>sendAccountEmail(f.email,'recovery'),/not configured/);assert.equal(generatedCount,before);
});

test('six-digit provider codes work for both purposes; inconsistent generation never activates or delivers',async()=>{
  otpDigits=6;
  try {for(const purpose of ['verification','recovery'] as const){const f=await fixture(purpose),m=await f.fresh();assert.equal(m.code.length,6);await f.complete(m,false);}}
  finally {otpDigits=8;}
  const f=await fixture('recovery'),before=messages.length;badGeneration=true;
  try {assert.equal(await f.send(),false);} finally {badGeneration=false;}
  assert.equal(messages.length,before);
  assert.equal((await db.query<any>('select digest from private.email_challenges where user_id=$1',[f.id])).rows[0].digest,null);
});

test('link proofs require an unpredictable challenge id and share the five-attempt budget with codes',async()=>{
  for(const purpose of ['verification','recovery'] as const){
    const f=await fixture(purpose),m=await f.fresh();
    await assert.rejects(()=>f.complete({...m,hash:m.hash.split('.')[0]!},true),/invalid/);
    const wrong={...m,hash:(m.hash[0]==='0'?'1':'0')+m.hash.slice(1)};
    for(let i=0;i<2;i++)await assert.rejects(()=>f.complete(wrong,true),/invalid/);
    for(let i=0;i<3;i++)await assert.rejects(()=>f.complete({...m,code:'00000000'},false),/invalid/);
    await assert.rejects(()=>f.complete(m,true),/attempt limit/);
    await assert.rejects(()=>f.complete(m,false),/attempt limit/);
  }
});
after(async()=>{globalThis.fetch=original;await new Promise<void>((resolve,reject)=>server?.close(e=>e?reject(e):resolve()));await db.close();assert.equal(blockedProviderRequests,0);});
async function post(path:string,body:any,manager=false){return original(base+'/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(manager?{Authorization:'Bearer manager'}:{})},body:JSON.stringify(body)});}
test('protected creation remains pending, replays safely and code verification never returns or replaces the manager session',async()=>{
  const body={operationId:randomUUID(),fullName:'Disposable recipient',username:'recipient',email:'recipient@example.invalid',role:'Staff',password:'Test-password-123'};
  const created=await post('accounts',body,true);assert.equal(created.status,201);const result=await created.json();assert.equal(result.verification,'pending');assert.equal(result.emailRequested,true);
  assert.equal((await post('accounts',body,true)).status,200);assert.equal(messages.filter(m=>m.email===body.email).length,1);
  const replay=await (await post('accounts',body,true)).json();assert.equal(replay.verification,'pending');assert.equal(replay.emailRequested,null);
  const pendingToken=(await session(result.user.id)).access_token;
  for(const path of ['/api/auth/me','/api/auth/accounts','/api/access','/api/inventory','/api/reports']) {
    assert.equal((await original(base+path,{headers:{Authorization:`Bearer ${pendingToken}`}})).status,403);
  }
  const expectedPending={error:{message:'Verify your account email before signing in.',fields:{accountEmail:'verification_required'}}};
  nativeLoginUnconfirmed=true;
  try {
    const denied=await post('login',{identifier:body.email,password:body.password});assert.equal(denied.status,403);assert.deepEqual(await denied.json(),expectedPending);
    const wrong=await post('login',{identifier:body.email,password:'Wrong-password-123'});assert.equal(wrong.status,401);assert.ok(!(await wrong.json()).error.fields);
  } finally {nativeLoginUnconfirmed=false;}
  const pendingLogin=await post('login',{identifier:body.email,password:body.password});assert.equal(pendingLogin.status,403);assert.deepEqual(await pendingLogin.json(),expectedPending);
  assert.equal(messages.filter(m=>m.email===body.email).length,1); // Neither login path sends another email.
  assert.equal((await post('email/complete',{purpose:'recovery',tokenHash:messages.find(m=>m.email==='recipient@example.invalid'&&m.purpose==='verification')!.hash,password:'New-password-123'})).status,422);
  const verified=await post('email/complete',{purpose:'verification',email:body.email,code:messages.find(m=>m.email==='recipient@example.invalid'&&m.purpose==='verification')!.code});assert.equal(verified.status,200);assert.deepEqual(await verified.json(),{verified:true,purpose:'verification'});
  assert.equal((await post('email/complete',{purpose:'verification',tokenHash:messages.find(m=>m.email==='recipient@example.invalid'&&m.purpose==='verification')!.hash})).status,422);assert.ok(logouts.every(id=>id!==owner));
  const pending=await db.query<any>('select email_confirmed_at from auth.users where id=$1',[result.user.id]);assert.ok(pending.rows[0].email_confirmed_at);
  const after=await (await post('accounts',body,true)).json();assert.equal(after.verification,'verified');assert.equal(after.emailRequested,null);
  assert.equal((await post('login',{identifier:body.email,password:body.password})).status,200);
  assert.equal((await original(base+'/api/auth/me',{headers:{Authorization:'Bearer manager'}})).status,200);
});

test('verification delivery failure and lost create response retain exactly one pending target and original receipt',async()=>{
  const body={operationId:randomUUID(),fullName:'Delivery retry',username:'delivery-retry',email:'delivery-retry@example.invalid',role:'Staff',password:'Test-password-123'};
  failDelivery=true;
  try {
    const created=await post('accounts',body,true);assert.equal(created.status,201);
    const result=await created.json();assert.equal(result.emailRequested,false);assert.equal(result.verification,'pending');
    for(let i=0;i<3;i++)assert.equal((await post('accounts',body,true)).status,200);
    assert.equal((await post('accounts',{...body,operationId:randomUUID()},true)).status,422);
    const users=(await db.query<any>('select id,email_confirmed_at from auth.users where email=$1',[body.email])).rows;
    assert.equal(users.length,1);assert.equal(users[0].id,result.user.id);assert.equal(users[0].email_confirmed_at,null);
    assert.equal((await db.query('select * from private.account_operations where target_id=$1',[result.user.id])).rows.length,1);
  } finally {failDelivery=false;}
  // Delivery failure reserves a cooldown, but a later explicit resend uses the same target.
  await db.query("update private.email_challenges set next_send_at=clock_timestamp()-interval '1 second' where user_id=(select id from auth.users where email=$1)",[body.email]);
  const before=messages.length;
  assert.equal((await post('email/request',{email:body.email,purpose:'verification'})).status,200);assert.equal(messages.length,before+1);
  loseCreateResponse=true;
  const lost={...body,operationId:randomUUID(),username:'lost-response',email:'lost-response@example.invalid'};
  const reconciled=await post('accounts',lost,true);assert.equal(reconciled.status,200);const result=await reconciled.json();assert.equal(result.verification,'pending');assert.equal(result.emailRequested,null);
  assert.equal((await post('accounts',lost,true)).status,200);
  assert.equal((await db.query('select * from auth.users where email=$1',[lost.email])).rows.length,1);
  assert.equal((await original(base+'/api/auth/me',{headers:{Authorization:'Bearer manager'}})).status,200);
});
test('recovery code or link authorizes a password update once and never accepts a verification hash or stored manager session',async()=>{
  const email='recipient@example.invalid';const requested=await post('email/request',{email,purpose:'recovery'});assert.equal(requested.status,200);const message=messages.at(-1)!;assert.equal(message.purpose,'recovery');
  assert.equal((await post('email/complete',{purpose:'recovery',tokenHash:messages.find(m=>m.email==='recipient@example.invalid'&&m.purpose==='verification')!.hash,password:'Wrong-purpose-123'})).status,422);
  const completed=await post('email/complete',{purpose:'recovery',tokenHash:message.hash,password:'Changed-password-123'});assert.equal(completed.status,200);assert.equal((await completed.json()).session,undefined);
  assert.equal((await post('email/complete',{purpose:'recovery',email,code:message.code,password:'Again-password-123'})).status,422);
  const recipient=(await db.query<any>('select id from auth.users where email=$1',[email])).rows[0].id;assert.equal(passwords.get(recipient),'Changed-password-123');assert.ok(logouts.every(id=>id!==owner));
});

test('unexpected recipient sessions are cleaned locally before rejecting recovery; cleanup failures never report success',async()=>{
  const recipient=(await db.query<any>('select id from auth.users where email=$1',['recipient@example.invalid'])).rows[0].id;
  await post('email/request',{email:'owner@example.invalid',purpose:'recovery'});
  const unexpected=messages.at(-1)!;
  verifyAs=recipient;
  try {
    const response=await post('email/complete',{purpose:'recovery',tokenHash:unexpected.hash,password:'Must-not-change-123'});
    assert.equal(response.status,422);
    assert.equal(passwords.get(recipient),'Changed-password-123');
    assert.equal(logouts.at(-1),recipient);assert.equal(cleanupScopes.at(-1),'local');
  } finally {verifyAs=undefined;}
  await db.query("update private.email_challenges set next_send_at=clock_timestamp()-interval '1 second' where user_id=$1",[recipient]);
  await post('email/request',{email:'recipient@example.invalid',purpose:'recovery'});
  const message=messages.at(-1)!;
  failCleanup=true;
  try {
    assert.equal((await post('email/complete',{purpose:'recovery',tokenHash:message.hash,password:'Cleanup-failed-123'})).status,503);
    assert.equal(passwords.get(recipient),'Cleanup-failed-123');
    assert.equal(cleanupScopes.at(-1),'global');
    assert.equal((await post('email/complete',{purpose:'recovery',email:message.email,code:message.code,password:'Retry-denied-123'})).status,422);
  } finally {failCleanup=false;}
  assert.equal((await original(base+'/api/auth/me',{headers:{Authorization:'Bearer manager'}})).status,200);
  assert.ok(logouts.every(id=>id!==owner));
});

test('unconfigured app factory fails closed and created accounts remain pending', async () => {
  const {createApp}=await import('../src/app.js');
  const appServer=createApp().listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>appServer.once('listening',resolve));
  const address=appServer.address();assert.ok(address&&typeof address!=='string');
  const origin=`http://127.0.0.1:${address.port}`;
  const beforeGenerated=generatedCount,beforeMessages=messages.length,beforeUpdates=updateCount;
  const postDefault=(path:string,body:unknown,manager=false)=>fetch(`${origin}/api/auth/${path}`,{method:'POST',headers:{'content-type':'application/json',...(manager?{authorization:'Bearer manager'}:{})},body:JSON.stringify(body)});
  try {
    for(const purpose of ['verification','recovery']) {
      const response=await postDefault('email/request',{email:'owner@example.invalid',purpose});
      assert.equal(response.status,503);assert.match((await response.json()).error.message,/delivery is not configured/);
    }
    const email=`no-sender-${randomUUID()}@example.invalid`;
    const response=await postDefault('accounts',{operationId:randomUUID(),fullName:'No sender fixture',username:`no-sender-${randomUUID()}`,email,role:'Staff',password:'Disposable-only-123'},true);
    assert.equal(response.status,201);const result=await response.json();assert.equal(result.emailRequested,false);assert.equal(result.verification,'pending');
    const user=(await db.query<any>('select * from auth.users where email=$1',[email])).rows[0];assert.equal(user.email_confirmed_at,null);
    const invalid=await postDefault('email/complete',{purpose:'verification',email,code:'00000000'});assert.equal(invalid.status,422);
    assert.equal((await db.query<any>('select email_confirmed_at from auth.users where id=$1',[user.id])).rows[0].email_confirmed_at,null);
    assert.equal(generatedCount,beforeGenerated);assert.equal(messages.length,beforeMessages);assert.equal(updateCount,beforeUpdates);
  } finally {await new Promise<void>((resolve,reject)=>appServer.close(error=>error?reject(error):resolve()));}
});

test('configured production default and API entry send rendered Brevo requests for both alternatives and isolate sessions',async()=>{
  const {default:app}=await import('../src/app.js');
  const {default:api}=await import(new URL('../../api/index.ts',import.meta.url).href);assert.equal(api,app);
  const local=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>local.once('listening',resolve));
  const address=local.address();assert.ok(address&&typeof address!=='string');const origin=`http://127.0.0.1:${address.port}`;
  const request=(path:string,body:unknown)=>original(origin+'/api/auth/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  try {
    for(const purpose of ['verification','recovery'] as const)for(const byLink of [true,false]) {
      const f=await fixture(purpose),before=brevoRequests;
      const response=await request('email/request',{email:f.email,purpose});assert.equal(response.status,200);assert.equal(brevoRequests,before+1);
      const m=messages.at(-1)!;assert.equal(m.email,f.email);assert.equal(m.purpose,purpose);
      const body={purpose,...(byLink?{tokenHash:m.hash}:{email:m.email,code:m.code}),...(purpose==='recovery'?{password:'Production-fixture-123'}:{})};
      const complete=await request('email/complete',body);assert.equal(complete.status,200);assert.deepEqual(await complete.json(),{verified:true,purpose});
      assert.equal((await request('email/complete',body)).status,422);
      assert.equal(passwords.get(f.id),purpose==='recovery'?'Production-fixture-123':'Original-test-123');
      assert.equal((await original(base+'/api/auth/me',{headers:{authorization:'Bearer manager'}})).status,200);
    }
    assert.ok(logouts.every(id=>id!==owner));
  } finally {await new Promise<void>((resolve,reject)=>local.close(error=>error?reject(error):resolve()));}
});

test('Brevo rejection cancels only its proof; lost and malformed acknowledgements retain usable exact proof',async()=>{
  const {createBrevoEmailDelivery}=await import('../src/lib/brevo-email-delivery.js');
  const sender=createBrevoEmailDelivery({origin:'https://email-app.test',apiKey:'synthetic-brevo-key-only',fromEmail:'sender@example.invalid',replyToEmail:'reply@example.invalid'})!;
  const {sendAccountEmail}=await import('../src/lib/email-challenges.js');
  try {
    for(const mode of ['rejected','lost','malformed'] as const) {
      const f=await fixture('recovery');brevoMode=mode;const before=brevoRequests;
      if(mode==='rejected') {
        assert.equal(await sendAccountEmail(f.email,'recovery',sender),false);
        assert.equal((await db.query<any>('select digest from private.email_challenges where user_id=$1',[f.id])).rows[0].digest,null);
      } else {
        await assert.rejects(sendAccountEmail(f.email,'recovery',sender),{message:'Email delivery could not be confirmed. If an email arrives, its code or link may still work. Wait before requesting another.'});
        assert.equal(await sendAccountEmail(f.email,'recovery',sender),false);assert.equal(brevoRequests,before+1);
        await f.complete(messages.at(-1)!,true);assert.equal(passwords.get(f.id),'Updated-test-123');
      }
      assert.equal(brevoRequests,before+1);
    }
  } finally {brevoMode='accepted';}
  assert.equal(blockedProviderRequests,0);
});
