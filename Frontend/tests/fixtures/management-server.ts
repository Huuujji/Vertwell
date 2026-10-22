import { PGlite } from '@electric-sql/pglite';
import { testRealtime } from '../../../backend/scripts/test-realtime';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { BrowserContext, Page, WebSocketRoute } from '@playwright/test';

// Real Express routes and PostgreSQL commands behind a test-owned Auth/Storage
// transport. No hosted credentials, mail or business rows are used.
export async function managementServer() {
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
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
  function user(id:string) {return {id,email:`${Object.keys(ids).find(k=>ids[k as keyof typeof ids]===id)?.toLowerCase()??id}@example.invalid`,aud:'authenticated',role:'authenticated',
    app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-10-17T00:00:00Z'};}
  function session(id:string) {
    const now=Math.floor(Date.now()/1000);
    const token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,exp:now+3600,iat:now,aud:'authenticated',role:'authenticated'})).toString('base64url')}.test`;
    return {access_token:token,refresh_token:`test-${id}`,expires_in:3600,expires_at:now+3600,token_type:'bearer',user:user(id)};
  }
  const originalFetch=globalThis.fetch;
  const actorsByToken=new Map(Object.values(ids).map(id=>[session(id).access_token,id]));
  const sockets=new Map<WebSocketRoute,Map<string,string>>();
  async function flushUpdates(){
    const rows=await db.transaction(async tx=>{await tx.query('reset role');return (await tx.query<{topic:string;payload:unknown}>('delete from realtime.messages returning topic,payload')).rows;});
    for(const row of rows)for(const [socket,topics] of sockets){const join=topics.get(`realtime:${row.topic}`);if(join)socket.send(JSON.stringify([join,null,`realtime:${row.topic}`,'broadcast',{type:'broadcast',event:'invalidate',payload:row.payload}]));}
  }
  async function invalidate(topic:string,scopes:string[]){await db.query("select realtime.send($1::jsonb,'invalidate',$2,true)",[JSON.stringify({scopes}),topic]);await flushUpdates();}
  globalThis.fetch=async (input:RequestInfo|URL,init?:RequestInit):Promise<Response>=>{
    const url=String(input);if(!url.startsWith('https://management.test'))return originalFetch(input,init);
    const target=new URL(url), headers=new Headers(init?.headers), token=headers.get('authorization')?.replace('Bearer ','')??'';
    const actor=actorsByToken.get(token), body=init?.body && headers.get('content-type')?.includes('json')?JSON.parse(String(init.body)):{};
    if(target.pathname==='/auth/v1/user')return actor?Response.json(user(actor)):Response.json({message:'Invalid token'},{status:401});
    if(target.pathname==='/auth/v1/token') {
      const id=Object.values(ids).find(id=>user(id).email===body.email);
      if(id&&body.password==='Test-password-123') {const active=session(id);actorsByToken.set(active.access_token,id);return Response.json(active);}
      return Response.json({message:'Invalid credentials'},{status:400});
    }
    if(target.pathname==='/auth/v1/logout')return new Response(null,{status:204});
    if(target.pathname==='/storage/v1/object/sign/inventory-images') return Response.json(body.paths.map((path:string)=>({path,signedURL:`/object/sign/inventory-images/${path}?token=test`,error:null})));
    if(target.pathname.startsWith('/storage/v1/object/inventory-images/')) {
      if(!actor)return Response.json({message:'denied'},{status:403});
      const path=target.pathname.slice('/storage/v1/object/inventory-images/'.length);
      await db.query("insert into storage.objects(bucket_id,name) values('inventory-images',$1)",[path]);return Response.json({Key:`inventory-images/${path}`,Id:randomUUID()});
    }
    if(target.pathname==='/auth/v1/admin/users') {
      try {
        const id=randomUUID();await db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)',[id,body.email,JSON.stringify(body.app_metadata)]);
        return Response.json({...user(id),email:body.email});
      } catch{return Response.json({message:'Creation rejected'},{status:422});}
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
  const app=createApp();
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
      else await route.fulfill({json:user(id)});
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
  return {db,ids,setup,login,restore,read,base,request:originalFetch,flushUpdates,invalidate,subscriptionCount:()=>[...sockets.values()].reduce((sum,topics)=>sum+topics.size,0),disconnect(){for(const socket of sockets.keys())socket.close({code:1012,reason:'Test connection interrupted'});sockets.clear();},token:()=>{const active=session(ids.Owner);actorsByToken.set(active.access_token,ids.Owner);return active.access_token;},
    async close(){await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));globalThis.fetch=originalFetch;await db.close();}};
}
