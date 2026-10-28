import { PGlite } from '@electric-sql/pglite';
import { testRealtime } from '../../../backend/scripts/test-realtime';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import type { BrowserContext, Page, WebSocketRoute } from '@playwright/test';

// Real Express routes and PostgreSQL commands behind a test-owned Auth/Storage
// transport. No hosted credentials, mail or business rows are used.
export async function managementServer() {
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text unique,raw_app_meta_data jsonb default '{}',
      email_confirmed_at timestamptz,confirmation_token text,confirmation_sent_at timestamptz,recovery_token text,recovery_sent_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;`);
  await testRealtime(db);
  const root=new URL('../../../backend/supabase/migrations/',import.meta.url);
  for(const name of (await readdir(root)).filter(n=>n.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(name,root),'utf8'));
  // Disposable acceptance database only; hosted activation is a separate gate.
  await db.query('update private.checkout_state set enabled=true where singleton');
  const ids={Owner:randomUUID(),Admin:randomUUID(),Staff:randomUUID()};
  for(const [role,id] of Object.entries(ids)) {
    await db.query('insert into auth.users(id,email) values($1,$2)',[id,`${role.toLowerCase()}@example.invalid`]);
    await db.query('insert into public.profiles(id,full_name,username,role) values($1,$2,$3,$4)',[id,`Test ${role}`,role.toLowerCase(),role]);
  }
  const recipients=new Map<string,{email:string;app_metadata:Record<string,unknown>;email_confirmed_at?:string}>();
  const messages:{email:string;code:string;hash:string;purpose:string}[]=[];
  const passwords=new Map<string,string>();
  let generated=0;
  const loggedOut:string[]=[];
  let deliveryFails=false;
  let deleteMode:'normal'|'reject'|'lost'='normal',deleteCalls=0;
  function user(id:string) {return {id,email:`${Object.keys(ids).find(k=>ids[k as keyof typeof ids]===id)?.toLowerCase()??id}@example.invalid`,aud:'authenticated',role:'authenticated',
    app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-10-17T00:00:00Z',...recipients.get(id)};}
  function session(id:string) {
    const now=Math.floor(Date.now()/1000);
    const token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,exp:now+3600,iat:now,aud:'authenticated',role:'authenticated'})).toString('base64url')}.test`;
    return {access_token:token,refresh_token:`test-${id}`,expires_in:3600,expires_at:now+3600,token_type:'bearer',user:user(id)};
  }
  const originalFetch=globalThis.fetch;
  const actorsByToken=new Map<string,string>(Object.values(ids).map(id=>[session(id).access_token,id]));
  const sockets=new Map<WebSocketRoute,Map<string,string>>();
  async function flushUpdates(){
    const rows=await db.transaction(async tx=>{await tx.query('reset role');return (await tx.query<{topic:string;payload:unknown}>('delete from realtime.messages returning topic,payload')).rows;});
    for(const row of rows)for(const [socket,topics] of sockets){const join=topics.get(`realtime:${row.topic}`);if(join)socket.send(JSON.stringify([join,null,`realtime:${row.topic}`,'broadcast',{type:'broadcast',event:'invalidate',payload:row.payload}]));}
  }
  async function invalidate(topic:string,scopes:string[]){await db.query("select realtime.send($1::jsonb,'invalidate',$2,true)",[JSON.stringify({scopes}),topic]);await flushUpdates();}
  globalThis.fetch=async (input:RequestInfo|URL,init?:RequestInit):Promise<Response>=>{
    const url=String(input);if(!url.startsWith('https://management.test')) {
      if(new URL(url).hostname==='127.0.0.1')return originalFetch(input,init);
      throw new Error('External fixture transport blocked');
    }
    const target=new URL(url), headers=new Headers(init?.headers), token=headers.get('authorization')?.replace('Bearer ','')??'';
    const actor=actorsByToken.get(token), body=init?.body && headers.get('content-type')?.includes('json')?JSON.parse(String(init.body)):{};
    if(target.pathname==='/auth/v1/user') {
      if(actor&&!(await db.query('select id from auth.users where id=$1',[actor])).rows.length)return Response.json({message:'Invalid token'},{status:401});
      if(actor&&init?.method==='PUT')passwords.set(actor,body.password);
      return actor?Response.json(user(actor)):Response.json({message:'Invalid token'},{status:401});
    }
    if(target.pathname==='/auth/v1/token') {
      const id=[...Object.values(ids),...recipients.keys()].find(id=>user(id).email===body.email);
      if(id&&(await db.query('select id from auth.users where id=$1',[id])).rows.length&&body.password===(passwords.get(id)??'Test-password-123')) {const active=session(id);actorsByToken.set(active.access_token,id);return Response.json(active);}
      return Response.json({message:'Invalid credentials'},{status:400});
    }
    if(target.pathname==='/auth/v1/logout'){if(actor)loggedOut.push(actor);return new Response(null,{status:204});}
    if(target.pathname==='/auth/v1/admin/generate_link') {
      if(!['signup','recovery'].includes(body.type))throw new Error('Unexpected generate purpose');
      const row=(await db.query<{id:string}>('select id from auth.users where email=$1',[body.email])).rows[0];
      if(!row)return Response.json({});
      const code=String(12345670+(++generated)),hash=createHash('sha224').update(body.email+code).digest('hex');
      const column=body.type==='signup'?'confirmation':'recovery';
      await db.query(`update auth.users set ${column}_token=$2,${column}_sent_at=clock_timestamp() where id=$1`,[row.id,hash]);
      return Response.json({...user(row.id),email_otp:code,hashed_token:hash,verification_type:body.type,action_link:'https://management.test/unsafe-native-link',redirect_to:'https://management.test'});
    }
    if(target.pathname==='/auth/v1/verify') {
      if(!['signup','recovery'].includes(body.type))throw new Error('Unexpected verify purpose');
      const column=body.type==='signup'?'confirmation':'recovery';
      const row=(await db.query<{id:string}>(`select id from auth.users where ${column}_token=$1`,[body.token_hash])).rows[0];
      if(!row)return Response.json({message:'Invalid proof'},{status:403});
      await db.query(`update auth.users set email_confirmed_at=clock_timestamp(),${column}_token=null where id=$1`,[row.id]);
      recipients.get(row.id)!.email_confirmed_at=new Date().toISOString();
      await flushUpdates();const active=session(row.id);actorsByToken.set(active.access_token,row.id);return Response.json(active);
    }
    if(target.pathname==='/storage/v1/object/sign/inventory-images') return Response.json(body.paths.map((path:string)=>({path,signedURL:`/object/sign/inventory-images/${path}?token=test`,error:null})));
    if(target.pathname.startsWith('/storage/v1/object/inventory-images/')) {
      if(!actor)return Response.json({message:'denied'},{status:403});
      const path=target.pathname.slice('/storage/v1/object/inventory-images/'.length);
      await db.query("insert into storage.objects(bucket_id,name) values('inventory-images',$1)",[path]);return Response.json({Key:`inventory-images/${path}`,Id:randomUUID()});
    }
    if(target.pathname==='/auth/v1/admin/users') {
      try {
        if(body.email_confirm!==false||body.app_metadata.happyhentie_email_required!==true)throw new Error('Unconfirmed creation required');
        const id=randomUUID();await db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)',[id,body.email,JSON.stringify(body.app_metadata)]);
        recipients.set(id,{email:body.email,app_metadata:body.app_metadata});
        return Response.json({...user(id),email:body.email});
      } catch{return Response.json({message:'Creation rejected'},{status:422});}
    }
    const deleting=/^\/auth\/v1\/admin\/users\/([a-f0-9-]{36})$/.exec(target.pathname);
    if(deleting&&init?.method==='DELETE') {
      deleteCalls++;
      if(token!=='test-management-secret'||body.should_soft_delete!==false)throw new Error('Exact hard deletion required');
      if(deleteMode==='reject')return Response.json({message:'Synthetic provider unavailable'},{status:503});
      try {
        await db.query('delete from auth.users where id=$1',[deleting[1]]);
        if(deleteMode==='lost')throw new Error('Synthetic lost provider response');
        return Response.json({user:user(deleting[1])});
      } catch {return Response.json({message:'Synthetic deletion unconfirmed'},{status:503});}
    }
    if(target.pathname==='/rest/v1/alert_settings')return Response.json((await db.query('select * from public.alert_settings')).rows[0]??null);
    const rpc=/^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(target.pathname)?.[1];
    if(rpc) {
      try {
        const data=await db.transaction(async tx=>{
          await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actor??'']);
          await tx.query(`set local role ${token==='test-management-secret'?'service_role':'authenticated'}`);
          const keys=Object.keys(body);if(keys.some(key=>!/^[a-z_]+$/.test(key)))throw new Error('Invalid SQL argument');
          const args=keys.map((key,i)=>`${key} => $${i+1}`).join(',');
          const result=await tx.query<{value:unknown}>(`select public.${rpc}(${args}) as value`,keys.map(key=>body[key]!==null && typeof body[key]==='object'?JSON.stringify(body[key]):body[key]));
          return result.rows[0]?.value;
        });
        await flushUpdates();return Response.json(data??null);
      } catch(error) {return Response.json({code:(error as {code?:string}).code??'XX000',message:'Test database rejected request'},{status:400});}
    }
    throw new Error(`Unexpected test transport ${target.pathname}`);
  };
  process.env.CORS_ORIGINS='http://127.0.0.1:5180';process.env.SUPABASE_URL='https://management.test';process.env.SUPABASE_PUBLISHABLE_KEY='test-publishable';process.env.SUPABASE_SECRET_KEY='test-management-secret';
  const {createApp}=await import('../../../backend/src/app');
  const app=createApp({}, {origin:'https://management-app.test',async send(message){
    if(deliveryFails)return 'rejected';
    messages.push({...message,hash:message.linkProof});return 'accepted';
  }});
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address();if(!address||typeof address==='string')throw new Error('Test server missing');
  const base=`http://127.0.0.1:${address.port}`;
  async function setup(context:BrowserContext,role:keyof typeof ids='Owner') {
    const id=ids[role], active=session(id);actorsByToken.set(active.access_token,id);
    await context.routeWebSocket('wss://management.test/realtime/v1/websocket*',socket=>{
      const topics=new Map<string,string>();sockets.set(socket,topics);socket.onClose(()=>sockets.delete(socket));
      socket.onMessage(async raw=>{
        if(typeof raw!=='string')return;const [join,ref,topic,event,payload]=JSON.parse(raw);
        let allowed=true;
        if(event==='phx_join'){
          const actor=actorsByToken.get(payload.access_token??'');
          const profile=actor?(await db.query<{active:boolean;role:string}>('select active,role from public.profiles where id=$1',[actor])).rows[0]:null;
          const name=topic.replace(/^realtime:/,'');
          allowed=Boolean(payload.config?.private&&profile?.active&&(name==='vertwell:catalogue'||name===`vertwell:user:${actor}`||name==='vertwell:managers'&&profile.role!=='Staff'));
          if(allowed)topics.set(topic,join);
        }
        if(event==='phx_leave')topics.delete(topic);
        socket.send(JSON.stringify([join,ref,topic,'phx_reply',{status:allowed?'ok':'error',response:allowed?{postgres_changes:[]}:{reason:'Access denied'}}]));
      });
    });
    await context.route('**/src/lib/supabase.ts',async route=>{
      const response=await route.fetch();const source=(await response.text()).replace(/const url = .*?;/,'const url = "https://management.test";').replace(/const key = .*?;/,'const key = "test-publishable";');
      await route.fulfill({response,body:source,contentType:'application/javascript'});
    });
    await context.route('https://management.test/**',async route=>{
      if(route.request().url().includes('/storage/'))await route.fulfill({body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jaiUAAAAASUVORK5CYII=','base64'),contentType:'image/png'});
      else if(route.request().url().includes('/logout'))await route.fulfill({status:204});
      else if(route.request().url().includes('/token'))await route.fulfill({json:active});
      else if(route.request().url().includes('/user')) {
        const token=route.request().headers().authorization?.replace('Bearer ','')??'';
        const current=actorsByToken.get(token);
        await route.fulfill({status:current?200:401,json:current?user(current):{message:'Invalid token'}});
      } else await route.fulfill({status:400,json:{message:'Unexpected native request'}});
    });
    await context.route('**/api/**',async route=>{
      const req=route.request(), target=new URL(req.url());
      const response=await originalFetch(`${base}${target.pathname}${target.search}`,{method:req.method(),headers:req.headers(),body:['GET','HEAD'].includes(req.method())?undefined:(req.postDataBuffer()?Uint8Array.from(req.postDataBuffer()!).buffer:undefined)});
      await route.fulfill({status:response.status,body:await response.text(),contentType:'application/json'});
    });
  }
  async function login(page:Page,role:keyof typeof ids='Owner') {
    await page.goto('/');await page.getByLabel('Username or email').fill(`${role.toLowerCase()}@example.invalid`);
    await page.getByLabel('Password',{exact:true}).fill('Test-password-123');await page.getByRole('button',{name:'Log in',exact:true}).click();
  }
  async function read() {
    return db.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.Owner]);return (await tx.query<{value:any}>('select public.read_inventory() as value')).rows[0]!.value;});
  }
  async function restore(page:Page,role:keyof typeof ids='Owner',pathname='/') {
    const active=session(ids[role]);actorsByToken.set(active.access_token,ids[role]);
    await page.addInitScript(value=>localStorage.setItem('sb-management-auth-token',JSON.stringify(value)),active);
    await page.goto(pathname);
  }
  return {db,ids,setup,login,restore,read,base,request:originalFetch,flushUpdates,invalidate,messages,loggedOut,
    deletionMode(value:'normal'|'reject'|'lost'){deleteMode=value;},deletionCalls:()=>deleteCalls,
    failVerificationDelivery(value:boolean){deliveryFails=value;},
    recipientSession(id:string){const active=session(id);actorsByToken.set(active.access_token,id);return active;},
    subscriptionCount:()=>[...sockets.values()].reduce((sum,topics)=>sum+topics.size,0),disconnect(){for(const socket of sockets.keys())socket.close({code:1012,reason:'Test connection interrupted'});sockets.clear();},token:()=>{const active=session(ids.Owner);actorsByToken.set(active.access_token,ids.Owner);return active.access_token;},
    async close(){await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));globalThis.fetch=originalFetch;await db.close();}};
}
