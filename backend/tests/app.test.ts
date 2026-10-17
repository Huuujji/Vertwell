import assert from 'node:assert/strict';
import { after, before, test, mock } from 'node:test';
import type { Server } from 'node:http';
process.env.SUPABASE_URL = 'https://auth.test';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable';
process.env.SUPABASE_SECRET_KEY = 'test-server-only';
const { default: app } = await import('../src/app.js');

let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('health works without a database connection and is not cached', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).status, 'ok');
});

test('protected endpoint rejects missing and malformed tokens', async () => {
  for (const authorization of ['', 'Basic abc', 'Bearer']) {
    const response = await fetch(`${baseUrl}/api/auth/me`, { headers: { authorization } });
    assert.equal(response.status, 401);
  }
});

test('unknown endpoints return JSON 404 responses', async () => {
  const response = await fetch(`${baseUrl}/api/missing`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.message, 'Endpoint not found.');
});

test('malformed JSON returns 400 rather than an internal error', async () => {
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(response.status, 400);
});

test('unlisted browser origins are rejected', async () => {
  const response = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://unlisted.example' } });
  assert.equal(response.status, 403);
});


test('identity rejects invalid tokens/inactive accounts and returns only the verified profile', async () => {
  const original = globalThis.fetch;
  let active = true;
  const actor = { id:'00000000-0000-4000-8000-000000000001',email:'owner@example.invalid' };
  const mocked = mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith('https://auth.test')) return original(input,init);
    const headers = new Headers(init?.headers);
    if (headers.get('authorization') !== 'Bearer valid') return Response.json({message:'invalid token'},{status:401});
    if (url.includes('/auth/v1/user')) return Response.json(actor);
    if (url.includes('/rest/v1/rpc/current_profile')) return active
      ? Response.json({id:actor.id,full_name:'Real Owner',username:'real-owner',role:'Owner',active:true,updated_at:'2026-10-17T00:00:00Z'})
      : Response.json({code:'42501'},{status:403});
    throw new Error('Unexpected provider request');
  });
  try {
    const valid = await original(`${baseUrl}/api/auth/me`,{headers:{authorization:'Bearer valid'}});
    assert.equal(valid.status,200);
    const identity = await valid.json();
    assert.equal(identity.profile.role,'Owner'); assert.equal(identity.user.id,identity.profile.id);
    assert.equal(identity.user.password,undefined);
    assert.equal((await original(`${baseUrl}/api/auth/me`,{headers:{authorization:'Bearer expired'}})).status,401);
    active=false;
    assert.equal((await original(`${baseUrl}/api/auth/me`,{headers:{authorization:'Bearer valid'}})).status,403);
  } finally { mocked.mock.restore(); }
});

test('public login validates requests and limits repeated attempts without exposing credential details', async () => {
  const first = await fetch(`${baseUrl}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:42,password:'test'})});
  assert.equal(first.status,401); assert.deepEqual(await first.json(),{error:{message:'Invalid login credentials.'}});
  for (let i=0;i<9;i++) await fetch(`${baseUrl}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal((await fetch(`${baseUrl}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,429);
});

const permissionMatrix = {
  Owner: ['dashboard.read','inventory.read','inventory.write','reports.read','pos.read','checkout.create','sales.read','void.request','void.decide','sale.void','review.confirm','accounts.read','accounts.create','accounts.update','alerts.read','alerts.write'],
  Admin: ['dashboard.read','inventory.read','inventory.write','reports.read','pos.read','checkout.create','sales.read','void.request','void.decide','sale.void','accounts.read','accounts.create','accounts.update'],
  Staff: ['pos.read','checkout.create','sales.read','void.request'],
};
const ids = { actor:'00000000-0000-4000-8000-000000000001', staff:'00000000-0000-4000-8000-000000000002',
  ownSale:'00000000-0000-4000-8000-000000000003',otherSale:'00000000-0000-4000-8000-000000000004' };
async function businessTransport(run: (request: (path: string, method?: string, body?: unknown) => Promise<Response>,
  state: {role:keyof typeof permissionMatrix;active:boolean;permissionRole?:keyof typeof permissionMatrix;calls:{path:string;body:any;token:string|null}[]})=>Promise<void>) {
  const original = globalThis.fetch;
  const state: {role:keyof typeof permissionMatrix;active:boolean;permissionRole?:keyof typeof permissionMatrix;calls:{path:string;body:any;token:string|null}[]} = {role:'Owner',active:true,calls:[]};
  const profile = (role = state.role) => ({id:ids.actor,full_name:'Verified actor',username:'verified',role,active:state.active,updated_at:'2026-10-17T00:00:00Z'});
  const fail = (code = '42501') => Response.json({code,message:'Private provider detail must not leak'}, {status:403});
  const mocked = mock.method(globalThis,'fetch',async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith('https://auth.test')) return original(input,init);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const token = new Headers(init?.headers).get('authorization');
    state.calls.push({path:url,body,token});
    if (url.includes('/auth/v1/user')) return Response.json({id:ids.actor,email:'verified@example.invalid'});
    if (url.includes('/rpc/current_profile')) return state.active ? Response.json(profile()) : fail();
    if (url.includes('/rpc/authorize_business_action')) {
      assert.equal(token,'Bearer session-token');
      const role = state.permissionRole ?? state.role;
      return permissionMatrix[role].includes(body.action) && !(role==='Staff' && body.target_sale_id && body.target_sale_id!==ids.ownSale)
        ? Response.json({profile:profile(role),businessDate:'2026-10-17'}) : fail();
    }
    if (url.includes('/rpc/business_access')) return Response.json({profile:profile(),permissions:permissionMatrix[state.role],businessDate:'2026-10-17'});
    if (url.includes('/rpc/read_inventory')) return Response.json({version:1,tables:{},balances:[],revision:'0'});
    if (url.includes('/rpc/read_managed_accounts')) return Response.json([]);
    if (url.includes('/rpc/read_business_sales')) return Response.json({version:1,items:[{id:ids.ownSale,total:'10.00'}],hasMore:false});
    if (url.includes('/rpc/read_pos_catalogue')) return Response.json({version:1,checkoutReady:false,items:[],hasMore:false});
    if (url.includes('/rpc/update_alert_settings')) return state.permissionRole === 'Admin' ? fail() : Response.json({similar_order_threshold:body.similar_order_threshold,updated_by:ids.actor});
    if (url.includes('/rpc/update_account')) return state.role === 'Admin' && (body.target_id!==ids.staff || body.account_role!=='Staff') ? fail() : Response.json({...profile(),id:body.target_id,role:body.account_role});
    if (url.includes('/void_requests')) return Response.json([]);
    if (url.includes('/alert_settings')) return Response.json(null);
    if (url.includes('/auth/v1/admin/users')) return Response.json({id:ids.staff,email:body.email});
    throw new Error('Unexpected provider request');
  });
  const request = (path: string,method = 'GET',body?:unknown) => original(`${baseUrl}/api${path}`,{
    method,headers:{authorization:'Bearer session-token','Content-Type':'application/json'},
    ...(body === undefined ? {} : {body:JSON.stringify(body)}),
  });
  try { await run(request,state); } finally { mocked.mock.restore(); }
}

test('every business route enforces the complete three-role matrix before returning data or a pending-service boundary', async () => {
  await businessTransport(async (request,state) => {
    const routes: [string,string,string,number][] = [
      ['GET','/dashboard','dashboard.read',501], ['GET','/inventory','inventory.read',200],
      ['POST','/inventory','inventory.write',501], ['PATCH',`/inventory/${ids.staff}`,'inventory.write',501],
      ['DELETE',`/inventory/${ids.staff}`,'inventory.write',501], ['GET','/reports','reports.read',501],
      ['POST','/checkout','checkout.create',501], ['POST',`/sales/${ids.ownSale}/void-requests`,'void.request',501],
      ['POST',`/sales/${ids.ownSale}/void`,'sale.void',501], ['POST',`/sales/${ids.ownSale}/void-decision`,'void.decide',501],
      ['POST','/daily-sales-reviews','review.confirm',501], ['GET','/sales','sales.read',200],
      ['GET',`/sales/${ids.ownSale}`,'sales.read',200], ['GET','/void-requests','sales.read',200],
      ['GET','/pos/catalogue','pos.read',200], ['GET','/alert-settings','alerts.read',200],
      ['GET','/auth/accounts','accounts.read',200],
    ];
    for (const role of ['Owner','Admin','Staff'] as const) {
      state.role=role;
      const access = await request('/access'); assert.equal(access.status,200);
      assert.deepEqual((await access.json()).permissions,permissionMatrix[role]);
      for (const [method,path,action,allowedStatus] of routes) {
        const response = await request(path,method);
        assert.equal(response.status,permissionMatrix[role].includes(action) ? allowedStatus : 403,`${role} ${method} ${path}`);
        assert.equal(response.headers.get('cache-control'),'no-store');
        assert.ok(!JSON.stringify(await response.json()).includes('Private provider detail'));
      }
    }
  });
});

test('Staff cannot widen sale scope or spoof identity; each business request uses the caller token', async () => {
  await businessTransport(async (request,state) => {
    state.role='Staff';
    for (const [method,path] of [['GET',`/sales/${ids.otherSale}`],['POST',`/sales/${ids.otherSale}/void-requests`]]) {
      assert.equal((await request(path!,method)).status,403);
    }
    for (const query of ['?role=Owner','?cashier_id=another','?date=2000-01-01','?offset=-1','?limit=0','?limit=101','?limit=2&limit=3']) {
      assert.equal((await request(`/sales${query}`)).status,422,query);
    }
    assert.equal((await request('/sales/not-a-uuid')).status,422);
    for (const path of ['/sales?offset=1&limit=2','/pos/catalogue?limit=1','/void-requests']) assert.equal((await request(path)).status,200);
    assert.ok(state.calls.filter(call=>call.path.includes('/rest/v1/')).every(call=>call.token==='Bearer session-token'));
  });
});

test('account creation and updates retain Owner-all/Admin-Staff restrictions and reject supplied actor fields', async () => {
  await businessTransport(async (request,state) => {
    const create = {fullName:'New Staff',username:'new-staff',role:'Staff',email:'staff@example.invalid',password:'Disposable-test-password'};
    const update = {fullName:'Updated',username:'updated',role:'Staff',active:true,updatedAt:'2026-10-17T00:00:00Z'};
    state.role='Staff';
    assert.equal((await request('/auth/accounts','POST',create)).status,403);
    assert.equal((await request(`/auth/accounts/${ids.staff}`,'PATCH',update)).status,403);
    state.role='Admin';
    assert.equal((await request('/auth/accounts','POST',{...create,role:'Owner'})).status,403);
    assert.equal((await request(`/auth/accounts/${ids.actor}`,'PATCH',update)).status,403);
    assert.equal((await request(`/auth/accounts/${ids.staff}`,'PATCH',{...update,role:'Admin'})).status,403);
    assert.equal((await request(`/auth/accounts/${ids.staff}`,'PATCH',update)).status,200);
    assert.equal((await request('/auth/accounts','POST',create)).status,201);
    const created = state.calls.find(call=>call.path.includes('/auth/v1/admin/users'))!;
    assert.equal(created.body.app_metadata.vertwell_provision.actor_id,ids.actor);
    assert.equal(created.body.app_metadata.vertwell_provision.role,'Staff');
    state.role='Owner';
    assert.equal((await request('/auth/accounts','POST',{...create,actorId:ids.staff})).status,422);
    assert.equal((await request(`/auth/accounts/${ids.staff}`,'PATCH',{...update,actorRole:'Owner'})).status,422);
    assert.equal((await request(`/auth/accounts/${ids.staff}`,'PATCH',{...update,role:'Admin'})).status,200);
  });
});

test('settings validate fields, preserve revision and derive attribution from the session', async () => {
  await businessTransport(async (request,state) => {
    const body = {updatedAt:null,similarOrderThreshold:7,windowMinutes:3};
    for (const role of ['Admin','Staff'] as const) { state.role=role; assert.equal((await request('/alert-settings','PATCH',body)).status,403); }
    state.role='Owner';
    for (const bad of [{...body,actorId:ids.staff},{...body,similarOrderThreshold:2.5},{...body,windowMinutes:'3'},{...body,updatedAt:undefined}]) assert.equal((await request('/alert-settings','PATCH',bad)).status,422);
    const response = await request('/alert-settings','PATCH',body); assert.equal(response.status,200);
    assert.equal((await response.json()).settings.updated_by,ids.actor);
    const sent = state.calls.find(call=>call.path.includes('/rpc/update_alert_settings'))!;
    assert.deepEqual(sent.body,{expected_updated_at:null,similar_order_threshold:7,window_minutes:3});
  });
});

test('a demotion between identity lookup and permission check takes effect immediately; inactive sessions close access', async () => {
  await businessTransport(async (request,state) => {
    state.role='Owner'; state.permissionRole='Staff';
    assert.equal((await request('/alert-settings')).status,403);
    assert.equal((await request('/sales')).status,200);
    state.active=false;
    for (const path of ['/access','/sales','/pos/catalogue','/auth/accounts']) assert.equal((await request(path)).status,403);
  });
});

test('all new business routes require authentication even when called directly', async () => {
  for (const [method,path] of [['GET','/access'],['GET','/sales'],['GET','/void-requests'],['GET','/pos/catalogue'],['GET','/inventory'],['GET','/reports'],['GET','/dashboard'],['PATCH','/alert-settings'],['POST','/checkout'],['POST','/daily-sales-reviews'],['POST',`/sales/${ids.ownSale}/void`],['GET','/auth/accounts']]) {
    assert.equal((await fetch(`${baseUrl}/api${path}`,{method})).status,401,`${method} ${path}`);
  }
});
