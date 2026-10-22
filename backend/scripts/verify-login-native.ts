import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import pg from 'pg';

// No dotenv or hosted database helper. Only a fresh, unique localhost cluster.
const raw = process.env.VERTWELL_LOGIN_TEST_DATABASE_URL;
if (!raw || !process.argv.includes('--confirm-disposable')) throw new Error('A local disposable URL and --confirm-disposable are required. No database contacted.');
const target = new URL(raw);
if (!['postgres:', 'postgresql:'].includes(target.protocol) || target.hostname !== '127.0.0.1'
  || !/^\/vertwell_login_[a-f0-9]+$/.test(target.pathname) || target.search || target.hash) throw new Error('Only a new localhost vertwell_login_* database is accepted.');
const config = { connectionString: raw, connectionTimeoutMillis: 10000, statement_timeout: 10000 };
const db = new pg.Client(config);
const workers: pg.Client[] = [];
const evidence: unknown[] = [];
try {
  await db.connect();
  const identity = (await db.query("select current_database() name,inet_server_addr()::text address,version() version,current_setting('is_superuser') superuser")).rows[0];
  assert.match(identity.name, /^vertwell_login_[a-f0-9]+$/); assert.equal(identity.address, '127.0.0.1/32'); assert.equal(identity.superuser, 'on');
  assert.equal((await db.query("select count(*)::int count from pg_database where not datistemplate and datname not in ('postgres',current_database())")).rows[0].count, 0);
  assert.equal((await db.query("select count(*)::int count from pg_roles where rolname in ('anon','authenticated','service_role')")).rows[0].count, 0);
  assert.equal((await db.query("select count(*)::int count from pg_tables where schemaname not in ('pg_catalog','information_schema')")).rows[0].count, 0);
  await db.query('create schema private; create role anon; create role authenticated; create role service_role bypassrls;');
  await db.query(await readFile(new URL('../supabase/migrations/20261022010000_shared_login_protection.sql', import.meta.url), 'utf8'));
  for (let i = 0; i < 24; i++) {
    const worker = new pg.Client(config); await worker.connect(); workers.push(worker);
    await worker.query('set role service_role');
  }
  const consume = async (worker: pg.Client, key: string) => (await worker.query('select public.consume_login_attempt($1) value', [key])).rows[0].value;
  const key = 'd'.repeat(64);
  const first = await Promise.all(workers.map(worker => consume(worker, key)));
  assert.equal(first.filter(value => value.allowed).length, 10);
  assert.equal(first.filter(value => !value.allowed).length, 14);
  assert.ok(first.every(value => Number.isInteger(value.retryAfter) && value.retryAfter >= 1 && value.retryAfter <= 60));
  assert.equal((await db.query('select attempts from private.login_rate_limits where client_key=$1', [key])).rows[0].attempts, 11);
  evidence.push({ scenario: '24 simultaneous independent PostgreSQL connections', admitted: 10, denied: 14, storedAttempts: 11 });
  await db.query("update private.login_rate_limits set window_ends_at=clock_timestamp()-interval '1 second' where client_key=$1", [key]);
  const reset = await Promise.all(workers.map(worker => consume(worker, key)));
  assert.equal(reset.filter(value => value.allowed).length, 10);
  assert.equal(reset.filter(value => !value.allowed).length, 14);
  evidence.push({ scenario: '24 connections after expiry', admitted: 10, denied: 14 });
  const distinct = await Promise.all(workers.map((worker, i) => consume(worker, i.toString(16).padStart(64, '0'))));
  assert.ok(distinct.every(value => value.allowed));
  evidence.push({ scenario: '24 independent client budgets', admitted: 24 });
  for (const role of ['anon', 'authenticated']) {
    await db.query(`set role ${role}`);
    await assert.rejects(() => db.query('select public.consume_login_attempt($1)', [key]), /permission denied/);
    await assert.rejects(() => db.query('select * from private.login_rate_limits'), /permission denied/);
    await db.query('reset role');
  }
  evidence.push({ scenario: 'anonymous/authenticated execution and table denial', passed: true });
  // Block the same row on an independent connection: the RPC must time out,
  // rather than admit without recording or leave an unbounded waiter.
  await db.query('begin'); await db.query('select * from private.login_rate_limits where client_key=$1 for update', [key]);
  try { await assert.rejects(() => consume(workers[0]!, key), (error: any) => error.code === '55P03'); }
  finally { await db.query('rollback'); }
  evidence.push({ scenario: 'contended row exceeds two-second lock timeout', failedClosed: true });
  const output = new URL('../../.review/task-1-login/', import.meta.url);
  await mkdir(output, { recursive: true });
  await writeFile(new URL('native-result.json', output), JSON.stringify({ version: identity.version, evidence }, null, 2));
  console.log(JSON.stringify({ passed: true, evidence }, null, 2));
} finally {
  await Promise.allSettled(workers.map(worker => worker.end()));
  await db.end();
}
