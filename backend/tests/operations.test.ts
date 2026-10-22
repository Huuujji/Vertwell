import assert from 'node:assert/strict';
import { after, before, test, mock } from 'node:test';
import type { Server } from 'node:http';
import type { OperationalRecord } from '../src/middleware/observe-requests.js';
process.env.SUPABASE_URL = 'https://operations.test';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-public';
process.env.SUPABASE_SECRET_KEY = 'test-private';
const { createApp } = await import('../src/app.js');
const { operationalRoute } = await import('../src/middleware/observe-requests.js');
const records: OperationalRecord[] = [];
const original = globalThis.fetch;
let server: Server, base: string;
let role = 'Owner', failure = '', delay = 0, storageCalls = 0;
let transport: ReturnType<typeof mock.method>;
const actorId = '00000000-0000-4000-8000-000000000001';
const profile = () => ({ id: actorId, role, active: true, full_name: 'Private real name', username: 'private-name' });
before(async () => {
  server = createApp({ sink: record => records.push(record), slowMs: 20 }).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string'); base = `http://127.0.0.1:${address.port}`;
  transport = mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith('https://operations.test')) return original(input, options);
    if (/\/auth\/v1\/|\/rpc\/business_access|\/storage\//.test(url)) assert.ok(options?.signal, 'Auth and readiness probes carry a bounded signal');
    if (url.includes('/auth/v1/user')) {
      if (failure === 'auth-timeout') return new Promise<Response>((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('Private Auth timeout')), { once: true }));
      if (failure === 'auth') return Response.json({ message: 'Private provider detail' }, { status: 503 });
      if (failure === 'auth-rate') return Response.json({ message: 'Private provider detail' }, { status: 429 });
      if (new Headers(options?.headers).get('authorization') === 'Bearer expired') return Response.json({ message: 'expired' }, { status: 401 });
      return Response.json({ id: actorId, email: 'private@example.invalid' });
    }
    if (url.includes('/auth/v1/token')) return Response.json({ message: 'Private provider detail' }, { status: 503 });
    if (url.includes('/rpc/current_profile')) {
      if (failure === 'profile-timeout') return new Promise<Response>((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('Private profile timeout')), { once: true }));
      return Response.json(profile());
    }
    if (url.includes('/rpc/business_access')) return failure === 'database' ? Response.json({ code: 'XX000', message: 'Private provider detail' }, { status: 503 })
      : Response.json({ profile: failure === 'shape' ? { role: 'Owner' } : profile() });
    if (url.includes('/storage/v1/object/list/inventory-images')) {
      storageCalls++;
      const body = JSON.parse(String(options?.body)); assert.equal(body.limit, 1); assert.equal(body.prefix, '');
      assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer valid');
      if (failure === 'timeout') return new Promise<Response>((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('Private timeout detail')), { once: true }));
      return failure === 'storage' ? Response.json({ message: 'Private storage detail' }, { status: 503 }) : Response.json([]);
    }
    if (url.includes('/rpc/authorize_business_action')) return Response.json({ profile: profile() });
    if (url.includes('/rpc/checkout')) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      return failure === 'checkout' ? Response.json({ code: 'XX000', message: 'Private SQL details' }, { status: 503 }) : Response.json({ replayed: false });
    }
    throw new Error('Unexpected fixture transport');
  });
});
after(async () => { transport?.mock.restore(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
const request = (path: string, method = 'GET', body?: unknown, token = 'valid') => original(`${base}${path}`, {
  method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

test('public liveness stays cheap while dependency diagnostics require a current Owner', async () => {
  assert.equal((await request('/api/health', 'GET', undefined, '')).status, 200);
  assert.equal((await request('/api/health/ready', 'GET', undefined, '')).status, 401);
  const count = storageCalls;
  for (role of ['Admin', 'Staff']) assert.equal((await request('/api/health/ready')).status, 403);
  assert.equal(storageCalls, count);
  role = 'Owner';
  assert.equal((await request('/api/health/ready?project=override')).status, 422);
  const response = await request('/api/health/ready'); assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'ok', scope: 'read-only-dependency-probe', checks: {
    authentication: 'passed', database: 'passed', storage: 'passed', privateUpdates: 'requires-client-observation', checkoutReconciliation: 'requires-receipt-review',
  } });
});

test('dependency failures, bad database responses and Storage timeouts return bounded generic degradation', async () => {
  try {
    for (failure of ['database', 'storage', 'shape', 'timeout']) {
      const response = await request('/api/health/ready'); assert.equal(response.status, 503, failure);
      const body = await response.json(); assert.equal(body.status, 'degraded');
      assert.ok(!JSON.stringify(body).includes('Private'));
      assert.equal(body.checks[failure === 'database' || failure === 'shape' ? 'database' : 'storage'], 'unavailable');
    }
  } finally { failure = ''; }
});

test('Auth provider outages are distinct from genuinely expired credentials', async () => {
  try {
    for (failure of ['auth', 'auth-rate', 'auth-timeout', 'profile-timeout']) {
      const response = await request('/api/health/ready'); assert.equal(response.status, 503);
      const body = await response.json(); assert.ok(!JSON.stringify(body).includes('Private'));
      assert.match(body.error.message, /unavailable/);
    }
  } finally { failure = ''; }
  assert.equal((await request('/api/auth/me', 'GET', undefined, 'expired')).status, 401);
  const login = await request('/api/auth/login', 'POST', { identifier: 'owner@example.invalid', password: 'Private-password' }, '');
  assert.equal(login.status, 503);
  assert.deepEqual(await login.json(), { error: { message: 'Authentication service is unavailable. Try again shortly.' } });
});

test('authenticated browser hints accept only allowlisted state without arbitrary data', async () => {
  for (const event of ['updates.offline', 'updates.recovered', 'checkout.unconfirmed', 'checkout.reconciled', 'storage.unavailable']) {
    const response = await request('/api/operations/client-events', 'POST', { event }); assert.equal(response.status, 204);
    assert.equal(records.at(-1)!.clientEvent, event);
  }
  const count = records.length;
  assert.equal((await request('/api/operations/client-events', 'POST', { event: 'updates.offline' })).status, 204);
  assert.equal(records.length, count, 'A duplicate observation does not add another log record.');
  for (const body of [{ event: 'checkout.unconfirmed', password: 'Private secret' }, { event: 'injected\nlog' }, {}, []]) {
    assert.equal((await request('/api/operations/client-events', 'POST', body)).status, 422);
  }
  assert.equal((await request('/api/operations/client-events', 'POST', null)).status, 400);
  assert.equal((await request('/api/operations/client-events', 'POST', { event: 'updates.offline' }, '')).status, 401);
});

test('request correlation, slow commands and unconfirmed checkout are recorded without credentials or business content', async () => {
  const forged = await original(`${base}/api/unknown/Private-name?password=Private-secret`, { headers: { 'X-Request-ID': 'Private-forged-id' } });
  assert.equal(forged.status, 404); assert.match(forged.headers.get('x-request-id')!, /^[a-f0-9-]{36}$/);
  assert.equal(records.at(-1)!.route, 'unmatched');
  assert.equal(records.at(-1)!.requestId, forged.headers.get('x-request-id'));
  delay = 45;
  try {
    assert.equal((await request('/api/checkout', 'POST', { operationId: actorId, payment: { reference: 'Private-payment-reference' } })).status, 200);
    assert.equal(records.at(-1)!.route, '/api/checkout'); assert.equal(records.at(-1)!.slow, true);
    failure = 'checkout';
    assert.equal((await request('/api/checkout', 'POST', { password: 'Private-body' })).status, 503);
    assert.equal(records.at(-1)!.outcome, 'unconfirmed'); assert.equal(records.at(-1)!.level, 'error');
  } finally { failure = ''; delay = 0; }
  const serialized = JSON.stringify(records);
  for (const secret of ['Private-', 'Private ', 'private-name', 'private@example.invalid', actorId, 'Bearer valid']) assert.ok(!serialized.includes(secret), secret);
  assert.equal(operationalRoute(`/api/sales/${actorId}/receipt?token=Private-query`), '/api/sales/:id/receipt');
});

test('a failing monitoring sink cannot change a successful response', async () => {
  const isolated = createApp({ sink: () => { throw new Error('sink failed'); }, slowMs: 0 }).listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => isolated.once('listening', resolve));
    const address = isolated.address(); assert.ok(address && typeof address !== 'string');
    assert.equal((await original(`http://127.0.0.1:${address.port}/api/health`)).status, 200);
  } finally { await new Promise<void>((resolve, reject) => isolated.close(error => error ? reject(error) : resolve())); }
});
