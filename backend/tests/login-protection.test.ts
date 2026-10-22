import assert from 'node:assert/strict';
import { after, before, test, mock } from 'node:test';
import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { PGlite } from '@electric-sql/pglite';

process.env.SUPABASE_URL = 'https://login-protection.test';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-public';
process.env.SUPABASE_SECRET_KEY = 'test-server-secret';
const { createApp } = await import('../src/app.js');
const { env } = await import('../src/config/env.js');
const { loginNetwork, loginClientNetwork } = await import('../src/lib/login-protection.js');
const db = new PGlite();
const servers: Server[] = [];
let urls: string[];
let providerCalls = 0;
let failure = '';
let requestKeys: string[] = [];
let transport: ReturnType<typeof mock.method>;
const originalFetch = globalThis.fetch;
const migration = new URL('../supabase/migrations/20261022010000_shared_login_protection.sql', import.meta.url);

before(async () => {
  env.loginRateLimitMode = 'shared'; env.vercel = true;
  await db.exec('create schema private; create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(await readFile(migration, 'utf8'));
  urls = await Promise.all([createApp(), createApp()].map(async app => {
    const server = app.listen(0, '127.0.0.1'); servers.push(server);
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    return `http://127.0.0.1:${address.port}/api/auth/login`;
  }));
  transport = mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith('https://login-protection.test')) return originalFetch(input, init);
    if (url.endsWith('/rpc/consume_login_attempt')) {
      assert.equal(new Headers(init?.headers).get('apikey'), 'test-server-secret');
      if (failure === 'timeout') return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('Private timeout detail')), { once: true });
      });
      if (failure === 'throw') throw new Error('Private provider detail');
      if (failure === 'http') return Response.json({ message: 'Private provider detail' }, { status: 503 });
      if (failure === 'shape') return Response.json({ allowed: true, retryAfter: 0 });
      const { client_key } = JSON.parse(String(init?.body)); requestKeys.push(client_key);
      const result = await db.transaction(async tx => {
        await tx.exec('set local role service_role');
        return tx.query<{ value: unknown }>('select public.consume_login_attempt($1) value', [client_key]);
      });
      return Response.json(result.rows[0]!.value);
    }
    providerCalls++;
    if (url.includes('/auth/v1/token')) return Response.json({ access_token: 'test-access', refresh_token: 'test-refresh',
      token_type: 'bearer', expires_in: 3600, user: { id: '00000000-0000-4000-8000-000000000001' } });
    if (url.includes('/rpc/current_profile')) return Response.json({ id: '00000000-0000-4000-8000-000000000001',
      full_name: 'Test Owner', username: 'owner', role: 'Owner', active: true });
    throw new Error('Unexpected test provider call');
  });
});
after(async () => {
  transport?.mock.restore();
  await Promise.all(servers.map(server => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))));
  await db.close();
});
function login(index: number, address: string, body: unknown = {}, extra: Record<string, string> = {}) {
  return originalFetch(urls[index]!, { method: 'POST', headers: { 'Content-Type': 'application/json',
    'x-vercel-forwarded-for': address, ...extra }, body: JSON.stringify(body) });
}

test('identity uses socket locally, the Vercel-only header on Vercel, and canonical networks', () => {
  const request = { headers: { 'x-forwarded-for': '198.51.100.8', 'x-real-ip': '198.51.100.9',
    'x-vercel-forwarded-for': '198.51.100.10' }, socket: { remoteAddress: '::ffff:127.0.0.1' } };
  assert.equal(loginClientNetwork(request as any, false), '127.0.0.1');
  assert.equal(loginClientNetwork(request as any, true), '198.51.100.10');
  assert.equal(loginNetwork('::ffff:c000:201'), loginNetwork('192.0.2.1'));
  assert.equal(loginNetwork('2001:DB8:0:1::1'), loginNetwork('2001:db8:0000:0001:ffff:0:0:abcd'));
  assert.notEqual(loginNetwork('2001:db8:0:1::1'), loginNetwork('2001:db8:0:2::1'));
  for (const address of [undefined, '', '192.0.2.1, 192.0.2.2', '192.0.2.1:123', 'fe80::1%eth0', 'unknown']) {
    assert.throws(() => loginNetwork(address), /Login protection is unavailable/);
  }
});

test('24 overlapping HTTP attempts across two app instances share exactly ten admissions', async () => {
  const responses = await Promise.all(Array.from({ length: 24 }, (_, i) => login(i % 2, '192.0.2.10', {}, {
    'x-forwarded-for': `198.51.100.${i}`, 'x-real-ip': `203.0.113.${i}`,
  })));
  assert.equal(responses.filter(response => response.status === 401).length, 10);
  assert.equal(responses.filter(response => response.status === 429).length, 14);
  for (const response of responses.filter(response => response.status === 429)) {
    assert.match(response.headers.get('retry-after')!, /^[1-9]\d?$/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(providerCalls, 0);
  assert.equal(new Set(requestKeys).size, 1);
  assert.match(requestKeys[0]!, /^[a-f0-9]{64}$/);
  assert.ok(!requestKeys[0]!.includes('192.0.2.10'));
  // Switching username/password does not create a new IP budget or call Auth.
  assert.equal((await login(0, '192.0.2.10', { identifier: 'another', password: 'anything' })).status, 429);
  assert.equal(providerCalls, 0);
  assert.equal((await login(1, '192.0.2.11')).status, 401);
});

test('successful logins consume the same budget without changing the token response', async () => {
  const body = { identifier: 'owner@example.invalid', password: 'Test-password' };
  for (let i = 0; i < 10; i++) {
    const response = await login(i % 2, '192.0.2.20', body);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { session: { access_token: 'test-access', refresh_token: 'test-refresh' } });
  }
  const calls = providerCalls;
  assert.equal((await login(0, '192.0.2.20', body)).status, 429);
  assert.equal(providerCalls, calls);
});

test('missing/ambiguous platform identity and a production memory override fail closed', async () => {
  for (const address of ['', 'not-an-ip', '192.0.2.30, 198.51.100.30']) {
    assert.equal((await login(0, address)).status, 503);
  }
  assert.equal((await originalFetch(urls[0]!, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 503);
  env.loginRateLimitMode = 'memory';
  try { assert.equal((await login(0, '192.0.2.30')).status, 503); }
  finally { env.loginRateLimitMode = 'shared'; }
  env.vercel = false; env.production = true; env.loginRateLimitMode = 'memory';
  try { assert.equal((await login(0, '192.0.2.30')).status, 503); }
  finally { env.vercel = true; env.production = false; env.loginRateLimitMode = 'shared'; }
});

test('unavailable, malformed and timed-out shared checks block Auth with a generic 503', async () => {
  const calls = providerCalls;
  try {
    for (failure of ['throw', 'http', 'shape', 'timeout']) {
      const response = await login(0, '192.0.2.40', { identifier: 'owner', password: 'anything' });
      assert.equal(response.status, 503, failure);
      assert.deepEqual(await response.json(), { error: { message: 'Login protection is unavailable. Try again shortly.' } });
    }
  } finally { failure = ''; }
  assert.equal(providerCalls, calls);
});

test('SQL counter expires, saturates at eleven and keeps a fixed server-clock window', async () => {
  const key = 'a'.repeat(64);
  const consume = async () => (await db.query<{ value: { allowed: boolean; retryAfter: number } }>('select public.consume_login_attempt($1) value', [key])).rows[0]!.value;
  assert.equal((await consume()).allowed, true);
  const start = (await db.query<{ window_ends_at: Date }>('select window_ends_at from private.login_rate_limits where client_key=$1', [key])).rows[0]!.window_ends_at;
  for (let i = 0; i < 9; i++) assert.equal((await consume()).allowed, true);
  for (let i = 0; i < 12; i++) assert.equal((await consume()).allowed, false);
  const row = (await db.query<{ attempts: number; window_ends_at: Date }>('select * from private.login_rate_limits where client_key=$1', [key])).rows[0]!;
  assert.equal(row.attempts, 11); assert.deepEqual(row.window_ends_at, start);
  await db.query("update private.login_rate_limits set window_ends_at=clock_timestamp()-interval '1 second' where client_key=$1", [key]);
  const reset = await consume(); assert.equal(reset.allowed, true); assert.equal(reset.retryAfter, 60);
  assert.equal((await db.query<{ attempts: number }>('select attempts from private.login_rate_limits where client_key=$1', [key])).rows[0]!.attempts, 1);
});

test('only service_role can consume; all client roles are denied table access and invalid keys', async () => {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(() => db.query('select * from private.login_rate_limits'), /permission denied/);
      if (role === 'service_role') {
        assert.equal((await db.query<{ value: any }>('select public.consume_login_attempt($1) value', ['b'.repeat(64)])).rows[0]!.value.allowed, true);
        for (const key of [null, 'raw-ip-address', 'a'.repeat(63)]) await assert.rejects(() => db.query('select public.consume_login_attempt($1)', [key]), /Invalid login limit key/);
      } else await assert.rejects(() => db.query('select public.consume_login_attempt($1)', ['b'.repeat(64)]), /permission denied/);
    } finally { await db.exec('reset role'); }
  }
});

test('cleanup removes at most 100 expired counters and leaves current budgets intact', async () => {
  await db.exec("insert into private.login_rate_limits select md5(i::text)||md5(i::text),1,clock_timestamp()-interval '1 hour' from generate_series(1,105) i");
  await db.query('select public.consume_login_attempt($1)', ['c'.repeat(64)]);
  assert.equal((await db.query<{ count: number }>("select count(*)::int count from private.login_rate_limits where window_ends_at<clock_timestamp()-interval '5 minutes'")).rows[0]!.count, 5);
  assert.ok((await db.query("select 1 from private.login_rate_limits where window_ends_at>clock_timestamp()")).rows.length > 0);
});
