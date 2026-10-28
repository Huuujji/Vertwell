import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {managementServer} from './fixtures/management-server';

test.describe.configure({mode:'serial'});
let api:Awaited<ReturnType<typeof managementServer>>;
test.beforeAll(async()=>{api=await managementServer();});
test.afterAll(async()=>{await api?.close();});
async function setup(context:BrowserContext,role:'Owner'|'Admin'|'Staff'='Owner'){
  await context.route('**/*',route=>['127.0.0.1','management.test'].includes(new URL(route.request().url()).hostname)?route.fallback():route.abort('blockedbyclient'));
  await api.setup(context,role);
}
async function users(page:Page){
  await expect(page.locator('.workspace')).toBeVisible();
  const menu=page.getByRole('button',{name:'Open navigation',exact:true});if(await menu.isVisible())await menu.click();
  await page.getByRole('button',{name:'Users',exact:true}).click();
  await expect(page.getByRole('heading',{name:'User Management',exact:true})).toBeVisible();
}
async function target(username:string,role='Staff'){
  const id=randomUUID();await api.db.query('insert into auth.users(id,email) values($1,$2)',[id,`${username}@example.invalid`]);
  await api.db.query('insert into public.profiles(id,full_name,username,role) values($1,$2,$3,$4)',[id,`Original ${username}`,username,role]);
  return id;
}
async function open(page:Page,username:string){await page.getByRole('group',{name:`${username} account`,exact:true}).getByRole('button',{name:'Manage',exact:true}).click();}
async function exists(id:string){return (await api.db.query('select id from auth.users where id=$1',[id])).rows.length>0;}
async function call(path:string,method:string,body:unknown,token=api.token()){
  return api.request(`${api.base}/api/auth${path}`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});
}

test('precise confirmation, cancel/focus, permanent deletion and refreshed managed listing',async({page})=>{
  const id=await target('delete-review');const original=(await api.db.query('select * from public.profiles where id=$1',[id])).rows;
  await setup(page.context());await api.login(page);await users(page);await open(page,'delete-review');
  await expect(page.getByLabel('Account status',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Deactivate Account',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Delete Account',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Original delete-review');
  await expect(dialog).toContainText('delete-review@example.invalid');await expect(dialog).toContainText('cannot be undone');
  await expect(page.getByRole('button',{name:'Keep account',exact:true})).toBeFocused();expect(await exists(id)).toBe(true);
  await page.getByRole('button',{name:'Keep account',exact:true}).click();
  await expect(page.getByRole('button',{name:'Delete Account',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Delete Account',exact:true}).click();
  const folder=process.env.VERTWELL_DELETION_EVIDENCE;
  if(folder){await mkdir(folder,{recursive:true});await page.screenshot({path:`${folder}/confirmation-desktop.png`,fullPage:true});}
  await page.getByRole('button',{name:'Confirm Delete Account',exact:true}).click();
  await expect(dialog).toHaveCount(0);await expect(page.getByRole('group',{name:'delete-review account',exact:true})).toHaveCount(0);
  expect(await exists(id)).toBe(false);expect((await api.db.query('select * from public.profiles where id=$1',[id])).rows).toEqual(original);
  await page.reload();await users(page);await expect(page.getByRole('group',{name:'delete-review account',exact:true})).toHaveCount(0);
});

test('lost API response reconciles the original receipt without a second provider deletion',async({page})=>{
  const id=await target('lost-response'),before=api.deletionCalls();await setup(page.context());await api.login(page);await users(page);await open(page,'lost-response');
  await page.route(`**/api/auth/accounts/${id}`,async route=>{
    if(route.request().method()!=='DELETE')return route.fallback();
    const request=route.request();const response=await api.request(`${api.base}/api/auth/accounts/${id}`,{
      method:'DELETE',headers:request.headers(),body:request.postData()!});
    expect(response.status).toBe(200);await route.abort('failed');
  });
  await page.getByRole('button',{name:'Delete Account',exact:true}).click();await page.getByRole('button',{name:'Confirm Delete Account',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);expect(await exists(id)).toBe(false);expect(api.deletionCalls()-before).toBe(1);
});

test('provider failure retains exact confirmation and manual retry; existing recipient token is denied after deletion',async({page})=>{
  const id=await target('retry-target'),recipient=api.recipientSession(id),bodies:string[]=[];
  await setup(page.context());await api.login(page);await users(page);await open(page,'retry-target');
  page.on('request',request=>{if(request.method()==='DELETE'&&request.url().endsWith(id))bodies.push(request.postData()!);});
  api.deletionMode('reject');await page.getByRole('button',{name:'Delete Account',exact:true}).click();
  await page.getByRole('button',{name:'Confirm Delete Account',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('not confirmed');expect(await exists(id)).toBe(true);
  await expect(page.getByRole('dialog')).toContainText('retry-target@example.invalid');
  api.deletionMode('lost');await page.getByRole('button',{name:'Confirm Delete Account',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);expect(bodies).toHaveLength(2);expect(bodies[1]).toBe(bodies[0]);
  expect(await exists(id)).toBe(false);
  const denied=await api.request(`${api.base}/api/auth/me`,{headers:{authorization:`Bearer ${recipient.access_token}`}});expect(denied.status).toBe(401);
  expect((await api.request(`${api.base}/api/auth/me`,{headers:{authorization:`Bearer ${api.token()}`}})).status).toBe(200);
  api.deletionMode('normal');
});

test('changed account is rejected without provider mutation; self and Admin/Staff permissions remain enforced',async({page})=>{
  const id=await target('stale-target');await setup(page.context());await api.login(page);await users(page);await open(page,'stale-target');
  await page.getByRole('button',{name:'Delete Account',exact:true}).click();const before=api.deletionCalls();
  await api.db.query("update public.profiles set full_name='Changed after review' where id=$1",[id]);
  await page.getByRole('button',{name:'Confirm Delete Account',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('changed');expect(await exists(id)).toBe(true);expect(api.deletionCalls()).toBe(before);
  await page.getByRole('button',{name:'Keep account',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await open(page,'owner');await expect(page.getByRole('button',{name:'Delete Account',exact:true})).toBeDisabled();
  const revision=(await api.db.query<{updated_at:string}>('select updated_at from public.profiles where id=$1',[api.ids.Owner])).rows[0].updated_at;
  const admin=api.recipientSession(api.ids.Admin),staff=api.recipientSession(api.ids.Staff);
  expect((await call(`/accounts/${api.ids.Owner}`,'DELETE',{operationId:randomUUID(),updatedAt:revision},admin.access_token)).status).toBe(403);
  expect((await call(`/accounts/${id}`,'DELETE',{operationId:randomUUID(),updatedAt:revision},staff.access_token)).status).toBe(403);
  expect(api.deletionCalls()).toBe(before);
});

test('320px confirmation keeps the exact target and actions readable',async({page})=>{
  await target('mobile-target');await page.setViewportSize({width:320,height:800});await setup(page.context());await api.login(page);await users(page);await open(page,'mobile-target');
  await page.getByRole('button',{name:'Delete Account',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('mobile-target@example.invalid');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const folder=process.env.VERTWELL_DELETION_EVIDENCE;if(folder){await mkdir(folder,{recursive:true});await page.screenshot({path:`${folder}/confirmation-mobile.png`,fullPage:true});}
  await page.getByRole('button',{name:'Keep account',exact:true}).click();
});
