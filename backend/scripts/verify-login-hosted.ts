import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { developmentClient } from './database.js';

// Explicit target approval is required. All operational fixtures are rolled back;
// no Auth session, password exchange, mail or business command is performed.
const expected = process.argv[process.argv.indexOf('--project-ref') + 1];
if (!process.argv.includes('--project-ref') || !process.argv.includes('--confirm-operational-check')) {
  throw new Error('Requires --project-ref and --confirm-operational-check. No database contacted.');
}
const { client, ref } = await developmentClient();
if (expected !== ref) throw new Error('Project reference must match the configured database. No database contacted.');
const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;
const evidenceRoot = new URL('../../.review/task-1-login/', import.meta.url);
const snapshotFile = new URL('hosted-before.json', evidenceRoot);
async function fingerprint() {
  const tables = await client.query<{ schemaname: string; tablename: string }>(
    "select schemaname,tablename from pg_tables where schemaname in ('public','private','auth','storage') order by 1,2");
  const result = [];
  for (const { schemaname, tablename } of tables.rows) {
    const value = (await client.query(`select count(*)::int count,
      md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) digest
      from ${quote(schemaname)}.${quote(tablename)} t`)).rows[0];
    result.push({ schema: schemaname, table: tablename, ...value });
  }
  return result;
}
try {
  await client.connect();
  const before = await fingerprint();
  if (process.argv.includes('--capture-before')) {
    await mkdir(evidenceRoot, { recursive: true });
    await writeFile(snapshotFile, JSON.stringify({ project: ref, tables: before }, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ project: ref, captured: true, tables: before.length, values: 'counts and database-computed hashes only' }));
    process.exitCode = 0;
  } else {
  const baseline = JSON.parse(await readFile(snapshotFile, 'utf8'));
  assert.equal(baseline.project, ref);
  const retained = (rows: typeof before) => rows.filter(row => !(row.schema === 'private' && row.table === 'login_rate_limits'));
  assert.deepEqual(retained(before), retained(baseline.tables), 'Existing protected data differs from the pre-migration snapshot. Investigate before continuing.');
  const key = randomBytes(32).toString('hex');
  await client.query('begin');
  try {
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await client.query("select has_function_privilege($1,'public.consume_login_attempt(text)','execute') allowed", [role])).rows[0].allowed, false);
    }
    for (const role of ['anon', 'authenticated', 'service_role']) {
      for (const privilege of ['select', 'insert', 'update', 'delete']) {
        assert.equal((await client.query("select has_table_privilege($1,'private.login_rate_limits',$2) allowed", [role, privilege])).rows[0].allowed, false);
      }
    }
    await client.query('set local role service_role');
    for (let i = 0; i < 12; i++) {
      const result = (await client.query('select public.consume_login_attempt($1) value', [key])).rows[0].value;
      assert.equal(result.allowed, i < 10);
      assert.ok(Number.isInteger(result.retryAfter) && result.retryAfter >= 1 && result.retryAfter <= 60);
    }
    await client.query('reset role');
    assert.equal((await client.query('select attempts from private.login_rate_limits where client_key=$1', [key])).rows[0].attempts, 11);
    await client.query("update private.login_rate_limits set window_ends_at=clock_timestamp()-interval '1 second' where client_key=$1", [key]);
    await client.query('set local role service_role');
    assert.equal((await client.query('select public.consume_login_attempt($1) value', [key])).rows[0].value.allowed, true);
  } finally { await client.query('rollback'); }
  const after = await fingerprint();
  assert.deepEqual(after, before, 'A protected table changed during the verification window. Investigate; do not overwrite current data.');
  console.log(JSON.stringify({ project: ref, passed: true, checks: ['service-only execution', 'no direct table grants',
    'ten admissions then denial', 'expiry starts a fresh budget', 'all fixtures rolled back', 'public/private/Auth/Storage fingerprints unchanged'],
    preservedTables: before.length }));
  }
} finally { await client.end(); }
