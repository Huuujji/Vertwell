import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { cpus, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';
import pg from 'pg';
import { checkoutAs, checkoutFixture, checkoutValue } from './checkout-checks.js';
import { testRealtime } from './test-realtime.js';

// Deliberately no dotenv, developmentClient or hosted Auth/API imports.
// Use a new LOCAL cluster/database, never the shop's Supabase database.
if (process.argv.includes('--help')) {
  console.log('Set VERTWELL_FP5_DATABASE_URL to a fresh localhost PostgreSQL database named vertwell_fp5_<name>. Run with --confirm-disposable. See supabase/RELEASE_READINESS.md.');
  process.exit(0);
}
const raw = process.env.VERTWELL_FP5_DATABASE_URL;
if (!raw || !process.argv.includes('--confirm-disposable')) throw new Error('A dedicated local database URL and --confirm-disposable are required. No database was contacted.');
let target: URL;
try { target = new URL(raw); }
catch { throw new Error('The dedicated local database URL is invalid. No database was contacted.'); }
if (!['postgres:', 'postgresql:'].includes(target.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)
  || !/^\/vertwell_fp5_[a-z0-9_]+$/.test(target.pathname) || target.search || target.hash) {
  throw new Error('Only a direct localhost vertwell_fp5_* database URL without query options is accepted. No database was contacted.');
}
const configuration = { connectionString: raw, connectionTimeoutMillis: 10000, statement_timeout: 120000, application_name: 'vertwell-fp5-disposable' };
const db = new pg.Client(configuration);
const workers: pg.Client[] = [];
const measurements: unknown[] = [];
const output = new URL('../../.review/fp5-native/', import.meta.url);
const migrationRoot = new URL('../supabase/migrations/', import.meta.url);
const value = (sql: string, params: any[] = []) => checkoutValue(db, sql, params);
function distribution(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  return { samples: sorted.length, p50Ms: sorted[Math.ceil(sorted.length * .5) - 1], p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], maxMs: sorted.at(-1) };
}
async function transaction<T>(client: pg.Client, run: () => Promise<T>) {
  await client.query('begin');
  try { const result = await run(); await client.query('commit'); return result; }
  catch (error) { await client.query('rollback'); throw error; }
}
async function command(client: pg.Client, actor: string, lines: any[]) {
  return transaction(client, async () => {
    await checkoutAs(client, actor);
    const quote = await checkoutValue(client, 'select public.quote_checkout($1::jsonb) as value', [JSON.stringify(lines)]);
    return { operationId: randomUUID(), revision: quote.revision, quoteToken: quote.quoteToken, lines,
      payment: { method: 'Cash', amount: quote.total, cashTendered: '10000.00' } };
  });
}
async function submit(client: pg.Client, actor: string, request: unknown) {
  return transaction(client, async () => {
    await checkoutAs(client, actor);
    return checkoutValue(client, 'select public.checkout($1::jsonb) as value', [JSON.stringify(request)]);
  });
}
try {
  await db.connect();
  const identity = (await db.query('select current_database() database, inet_server_addr()::text address, version() version, current_setting(\'is_superuser\') superuser')).rows[0];
  assert.match(identity.database, /^vertwell_fp5_[a-z0-9_]+$/);
  assert.ok(['127.0.0.1/32', '127.0.0.1', '::1/128', '::1'].includes(identity.address), 'The server must itself be local.');
  assert.equal(identity.superuser, 'on', 'Test-owned Auth roles require a dedicated cluster superuser.');
  assert.equal(Number(await value("select count(*)::int as value from pg_database where not datistemplate and datname not in ('postgres',current_database())")), 0,
    'Use a new cluster without other application databases.');
  assert.equal(Number(await value("select count(*)::int as value from pg_namespace where nspname in ('auth','private','storage','realtime')")), 0, 'The database must be fresh.');
  assert.equal(Number(await value("select count(*)::int as value from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'")), 0, 'The database must be empty.');
  assert.equal(Number(await value("select count(*)::int as value from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'")), 0, 'The database must have no pre-existing public functions.');
  assert.equal(Number(await value("select count(*)::int as value from pg_roles where rolname in ('anon','authenticated','service_role')")), 0, 'Use a new cluster without existing Supabase roles.');
  await db.query(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await testRealtime({ exec: sql => db.query(sql) });
  const migrations = (await readdir(migrationRoot)).filter(file => file.endsWith('.sql')).sort();
  for (const file of migrations) await db.query(await readFile(new URL(file, migrationRoot), 'utf8'));
  for (let i = 0; i < 8; i++) { const client = new pg.Client(configuration); await client.connect(); workers.push(client); }

  // Real commands on independent connections: one stock unit, eight competing payments.
  const scarce = await transaction(db, async () => {
    const f = await checkoutFixture(db);
    f.stock.batches[0]!.quantityBase = '1';
    await f.save('stock.save', f.stock);
    return f;
  });
  const requests = await Promise.all(workers.map(client => command(client, scarce.actors.staff, [scarce.line()])));
  const started = performance.now();
  const attempts = await Promise.allSettled(workers.map((client, i) => submit(client, scarce.actors.staff, requests[i])));
  const accepted = attempts.filter(result => result.status === 'fulfilled');
  assert.equal(accepted.length, 1, 'Exactly one scarce-stock payment should commit.');
  for (const result of attempts) if (result.status === 'rejected') assert.equal(result.reason.code, 'PT409');
  assert.equal(Number(await scarce.balance()), 0);
  measurements.push({ scenario: 'one usable unit / eight competing commands', accepted: 1, explicitConflicts: 7, totalMs: performance.now() - started, oversold: false });

  // Simultaneous exact retries must return the same sale and consume only once.
  const replay = await transaction(db, () => checkoutFixture(db));
  const exact = await command(db, replay.actors.staff, [replay.line()]);
  const replayStarted = performance.now();
  const responses = await Promise.all(workers.map(client => submit(client, replay.actors.staff, exact)));
  assert.equal(new Set(responses.map(response => response.saleId)).size, 1);
  assert.equal(responses.filter(response => response.replayed).length, 7);
  assert.equal(Number(await replay.balance()), 9);
  measurements.push({ scenario: 'eight simultaneous exact retries', committedReceipts: 1, replays: 7, totalMs: performance.now() - replayStarted, repeatedConsumption: false });

  // Bounded real checkout contention, with one- and five-line baskets. Conflicts
  // are recorded, never silently retried as fresh business commands.
  for (const basketLines of [1, 5]) {
    const fixture = await transaction(db, async () => {
      const f = await checkoutFixture(db); f.stock.batches[0]!.quantityBase = '1000';
      await f.save('stock.save', f.stock); return f;
    });
    const times: number[] = [], successes: number[] = [], conflicts: number[] = [];
    const batchStarted = performance.now();
    await Promise.all(workers.slice(0, 4).map(async client => {
      for (let i = 0; i < 5; i++) {
        const begin = performance.now();
        try {
          const request = await command(client, fixture.actors.staff, Array.from({ length: basketLines }, () => fixture.line()));
          await submit(client, fixture.actors.staff, request); successes.push(1);
        } catch (error) {
          if ((error as { code?: string }).code !== 'PT409') throw error;
          conflicts.push(1);
        } finally { times.push(performance.now() - begin); }
      }
    }));
    const elapsedMs = performance.now() - batchStarted;
    assert.equal(Number(await fixture.balance()), 1000 - successes.length * basketLines);
    assert.equal(Number(await value('select count(*)::int as value from public.sales where cashier_id=$1', [fixture.actors.staff])), successes.length);
    measurements.push({ scenario: 'real checkout contention', clients: 4, attempts: 20, basketLines, successfulCommands: successes.length, explicitConflicts: conflicts.length,
      ...distribution(times), elapsedMs, successfulCommandsPerSecond: successes.length / (elapsedMs / 1000), stockAndReceiptCountsReconciled: true });
  }

  // Continue P12's identical synthetic detection shape on native PostgreSQL.
  // These projections intentionally do not claim payment/stock reconciliation.
  const f = await transaction(db, () => checkoutFixture(db));
  for (let i = 0; i < 5; i++) await submit(db, f.actors.staff, await command(db, f.actors.staff, [f.line()]));
  const burst = (await db.query("select id,revision::text from private.review_notifications where resolved_at is null and evidence->>'actorId'=$1 order by id", [f.actors.staff])).rows;
  assert.equal(burst.length, 1);
  const source = await value('select id as value from public.sales where cashier_id=$1 order by occurred_at,id limit 1', [f.actors.staff]);
  await db.query(`create temp table perf_rows(seq integer,sale_id uuid,actor_id uuid,occurred_at timestamptz,config integer);
    create temp table perf_actors(id uuid,n integer);`);
  for (const [i, actor] of [f.actors.staff, f.actors.other, f.actors.admin].entries()) await db.query('insert into perf_actors values($1,$2)', [actor, i]);
  let previous = 0;
  const plans: unknown[] = [];
  for (const size of [1000, 5000, 20000]) {
    await transaction(db, async () => {
      await db.query(`insert into perf_rows select g,gen_random_uuid(),a.id,timestamptz '2025-01-01 00:00:00+08'+g*interval '10 minutes',g%20
        from generate_series($1::integer+1,$2::integer) g join perf_actors a on a.n=g%3`, [previous, size]);
      await db.query(`insert into public.sales(id,order_number,idempotency_key,request_hash,occurred_at,cashier_id,cashier_name,cashier_role,subtotal,tax_amount,total,payment_state,fulfilment_state,review_state,status,stock_committed,usage_complete)
        select r.sale_id,'FP5-SYNTHETIC-'||r.seq,gen_random_uuid(),'disposable-performance-only',r.occurred_at,r.actor_id,a.full_name,a.role,s.subtotal,s.tax_amount,s.total,s.payment_state,s.fulfilment_state,s.review_state,s.status,s.stock_committed,s.usage_complete
        from perf_rows r join public.profiles a on a.id=r.actor_id cross join public.sales s where s.id=$1 and r.seq>$2`, [source, previous]);
      await db.query(`insert into public.payments(sale_id,method,amount,cash_tendered,change_given)
        select r.sale_id,'Cash',s.total,s.total,0 from perf_rows r cross join public.sales s where s.id=$1 and r.seq>$2`, [source, previous]);
      await db.query(`insert into public.sale_items(sale_id,product_id,variant_id,name,sku,category,quantity,unit_price,original_unit_price,configuration_snapshot)
        select r.sale_id,i.product_id,i.variant_id,i.name,i.sku,i.category,i.quantity,i.unit_price,i.original_unit_price,i.configuration_snapshot||jsonb_build_object('perfConfiguration',r.config)
        from perf_rows r cross join public.sale_items i where i.sale_id=$1 and r.seq>$2`, [source, previous]);
      await db.query(`insert into public.sale_item_modifiers(sale_item_id,name,price)
        select i.id,'FP5 option '||g,0 from public.sale_items i join perf_rows r on r.sale_id=i.sale_id cross join generate_series(1,2) g where r.seq>$1`, [previous]);
    });
    previous = size;
    await db.query('analyze public.sales;analyze public.payments;analyze public.sale_items;analyze public.sale_item_modifiers');
    for (const actor of [f.actors.staff, null]) {
      await db.query('select private.refresh_duplicate_notifications($1)', [actor]);
      const samples: number[] = [];
      for (let repeat = 0; repeat < 3; repeat++) {
        const start = performance.now(); await db.query('select private.refresh_duplicate_notifications($1)', [actor]); samples.push(performance.now() - start);
      }
      assert.deepEqual((await db.query("select id,revision::text from private.review_notifications where resolved_at is null and evidence->>'actorId'=$1 order by id", [f.actors.staff])).rows, burst);
      measurements.push({ scenario: 'P12 synthetic detection continuation', syntheticReceipts: size, scopedToAffectedCashier: actor !== null, samplesMs: samples, ...distribution(samples), qualifyingBurstIdentityAndRevisionStable: true });
    }
    if (size === 20000) {
      const sql = await readFile(new URL('20261018030000_in_app_notifications.sql', migrationRoot), 'utf8');
      const query = /for receipt in\s*([\s\S]*?)\s*loop\s*if basket/.exec(sql)?.[1]; assert.ok(query);
      for (const actor of [f.actors.staff, null]) plans.push({ scopedToAffectedCashier: actor !== null,
        plan: (await db.query('explain (analyze,buffers,format json) ' + query.replaceAll('target_actor', '$1::uuid'), [actor])).rows });
    }
  }
  await mkdir(output, { recursive: true });
  await writeFile(new URL('result.json', output), JSON.stringify({ result: 'passed', at: new Date().toISOString(),
    environment: { engine: identity.version, node: process.version, logicalCpus: cpus().length, memoryGiB: totalmem() / 1024 ** 3, migrations: migrations.length }, measurements,
    limits: ['Local native SQL timings; not hosted API latency or a production SLA.', 'Auth and Realtime are test-owned stand-ins.', 'Synthetic projections exercise detection only; real concurrency cases reconcile their own stock/receipts.', 'Four clients/twenty commands and one/five lines are bounded scenarios, not shop-approved workload targets.', 'The dedicated local database remains for inspection; no database or cluster is dropped by this script.'] }, null, 2));
  await writeFile(new URL('plans.json', output), JSON.stringify(plans, null, 2));
  console.log('Native checks passed. Results: .review/fp5-native/result.json; query plans: .review/fp5-native/plans.json');
} catch (error) {
  // Do not echo URLs, driver objects, credentials or row contents.
  console.error(`Native profile did not complete: ${error instanceof assert.AssertionError ? error.message : (error as { code?: string }).code ?? 'configuration or runtime error'}. No throughput claim is established.`);
  process.exitCode = 1;
} finally {
  await Promise.all(workers.map(client => client.end()));
  await db.end();
}
