import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { cpus, totalmem } from 'node:os';
import { resolve, relative, isAbsolute } from 'node:path';
import { performance } from 'node:perf_hooks';
import pg from 'pg';
import { checkoutAs, checkoutFixture, checkoutValue } from './checkout-checks.js';
import { productRecord, stockRecord } from './inventory-checks.js';
import { testRealtime } from './test-realtime.js';

// Never load dotenv, the official database helper, hosted Auth or Storage.
const raw = process.env.VERTWELL_MIXED_DATABASE_URL;
if (!raw || !process.argv.includes('--confirm-disposable')) throw new Error('A dedicated local URL and --confirm-disposable are required. No database contacted.');
const target = new URL(raw);
if (!['postgres:', 'postgresql:'].includes(target.protocol) || target.hostname !== '127.0.0.1' || !/^\/vertwell_mixed_[a-f0-9]+$/.test(target.pathname)
  || target.search || target.hash) throw new Error('Only a fresh localhost vertwell_mixed_* database is accepted. No database contacted.');
const outputRoot = resolve(import.meta.dirname, '../../.review/task-4-performance');
const output = resolve(process.env.VERTWELL_MIXED_OUTPUT ?? '');
const suffix = relative(outputRoot, output);
if (!suffix || isAbsolute(suffix) || suffix.startsWith('..') || !/^run-[a-f0-9]+$/.test(suffix)) throw new Error('A new run directory inside .review/task-4-performance is required.');
const configuration = { connectionString: raw, connectionTimeoutMillis: 10000, statement_timeout: 60000, application_name: 'vertwell-task4-disposable' };
const db = new pg.Client(configuration), workers: pg.Client[] = [];
type Sample = { operation: string; ms: number; outcome: string; basketLines?: number; bytes?: number };
const samples: Sample[] = [];
const expected = { cashiers: 3, receipts: 500, usualLines: 5, largeLines: 20, largeEvery: 10, quoteP95Ms: 1000, checkoutP95Ms: 2000, reportP95Ms: 5000 };
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const value = (sql: string, params: any[] = []) => checkoutValue(db, sql, params);
async function transaction<T>(client: pg.Client, actor: string, run: () => Promise<T>): Promise<T> {
  await client.query('begin');
  try { await checkoutAs(client, actor); const result = await run(); await client.query('commit'); return result; }
  catch (error) { await client.query('rollback'); throw error; }
}
async function measure<T>(operation: string, run: () => Promise<T>, basketLines?: number) {
  const start = performance.now();
  try {
    const result = await run();
    samples.push({ operation, ms: performance.now() - start, outcome: 'success', ...(basketLines ? { basketLines } : {}),
      ...(operation === 'reports' ? { bytes: Buffer.byteLength(JSON.stringify(result)) } : {}) });
    return result;
  } catch (error) {
    samples.push({ operation, ms: performance.now() - start, outcome: (error as { code?: string }).code === 'PT409' ? 'explicit-conflict' : 'error', ...(basketLines ? { basketLines } : {}) });
    throw error;
  }
}
function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return { samples: sorted.length, p50Ms: sorted[Math.ceil(sorted.length * .5) - 1] ?? null,
    p95Ms: sorted[Math.ceil(sorted.length * .95) - 1] ?? null, maxMs: sorted.at(-1) ?? null };
}

try {
  await db.connect();
  const identity = (await db.query("select current_database() database,inet_server_addr()::text address,version() version,current_setting('is_superuser') superuser,current_setting('track_functions') function_tracking")).rows[0];
  assert.match(identity.database, /^vertwell_mixed_[a-f0-9]+$/); assert.equal(identity.address, '127.0.0.1/32'); assert.equal(identity.superuser, 'on');
  assert.equal(await value("select count(*)::int value from pg_database where not datistemplate and datname not in ('postgres',current_database())"), 0);
  assert.equal(await value("select count(*)::int value from pg_namespace where nspname in ('auth','private','storage','realtime')"), 0);
  assert.equal(await value("select count(*)::int value from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'"), 0);
  assert.equal(await value("select count(*)::int value from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'"), 0);
  assert.equal(await value("select count(*)::int value from pg_roles where rolname in ('anon','authenticated','service_role')"), 0);
  await db.query(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await testRealtime({ exec: sql => db.query(sql) });
  const migrationRoot = new URL('../supabase/migrations/', import.meta.url);
  const migrations = (await readdir(migrationRoot)).filter(name => name.endsWith('.sql')).sort();
  const hashes = [];
  for (const name of migrations) {
    const sql = await readFile(new URL(name, migrationRoot), 'utf8'); await db.query(sql);
    hashes.push({ name, sha256: createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex') });
  }
  console.log('Task 4: fresh local database initialized; building four-model fixture.');
  const fixture = await transaction(db, '', async () => {
    const f = await checkoutFixture(db);
    const retail: any[] = [], recipe: any[] = [], variants: any[] = [], bundles: any[] = [];
    const ingredient = stockRecord({ name: 'Task4 ingredient', kind: 'Ingredient', category: 'Food', unit: 'g',
      batches: [{ id: randomUUID(), quantityBase: '10000000', manufactured: '2020-01-01', expires: '2099-12-31', unsellable: false }] });
    await f.save('stock.save', ingredient);
    for (let i = 0; i < 5; i++) {
      const stock = stockRecord({ name: `Task4 stock ${i}`, batches: [{ id: randomUUID(), quantityBase: '100000', manufactured: null, expires: null, unsellable: false }] });
      const r = productRecord(stock, { name: `Task4 retail ${i}` }); await f.save('product.save', r, { stock }); retail.push(r);
      const option = { id: randomUUID(), name: `Extra ingredient ${i}`, price: '1.00', defaultSelected: false,
        inputs: [{ stockId: ingredient.id, quantity: '25', unit: 'g' }] };
      const p = productRecord(ingredient, { sku: `TASK4-RECIPE-${i}`, name: `Task4 recipe ${i}`, category: 'Food', model: 'Recipe', stockId: null,
        manufactured: '2020-01-01', expires: '2099-12-31',
        recipe: [{ stockId: ingredient.id, quantity: '100', unit: 'g' }], groups: [{ id: randomUUID(), name: 'Extras', min: '0', max: '1', options: [option] }] });
      await f.save('product.save', p); recipe.push(p);
      const variantStock = stockRecord({ name: `Task4 large-variant stock ${i}`, batches: [{ id: randomUUID(), quantityBase: '100000', manufactured: null, expires: null, unsellable: false }] });
      await f.save('stock.save', variantStock);
      const v = productRecord(stock, { sku: `TASK4-VARIANTS-${i}`, name: `Task4 variants ${i}`, model: 'Variants', stockId: null,
        variants: [{ id: randomUUID(), name: 'Standard', stockId: stock.id, price: '15', enabled: true }, { id: randomUUID(), name: 'Large', stockId: variantStock.id, price: '18', enabled: true }] });
      await f.save('product.save', v); variants.push(v);
      const b = productRecord(stock, { sku: `TASK4-BUNDLE-${i}`, name: `Task4 bundle ${i}`, model: 'Bundle', stockId: null,
        bundle: [{ productId: r.id, stockId: null, variantId: null, quantity: '1', modifierIds: [] },
          { productId: p.id, stockId: null, variantId: null, quantity: '1', modifierIds: [option.id] }] });
      await f.save('product.save', b); bundles.push(b);
    }
    return { ...f, products: retail.flatMap((p, i) => [p, recipe[i], variants[i], bundles[i]]) };
  });
  const actors = [fixture.actors.staff, fixture.actors.other, fixture.actors.admin];
  for (let i = 0; i < 4; i++) { const client = new pg.Client(configuration); await client.connect(); workers.push(client); }
  function basket(seq: number) {
    return Array.from({ length: seq % expected.largeEvery === 0 ? expected.largeLines : expected.usualLines }, (_, j) => {
      const p = fixture.products[(seq + j) % fixture.products.length];
      return fixture.line(p, { variantId: p.model === 'Variants' ? p.variants[seq % 2].id : null,
        modifierIds: p.model === 'Recipe' && seq % 3 === 0 ? [p.groups[0].options[0].id] : [] });
    });
  }
  const quote = (client: pg.Client, actor: string, lines: any[]) => transaction(client, actor,
    () => checkoutValue(client, 'select public.quote_checkout($1::jsonb) value', [JSON.stringify(lines)]));
  function command(q: any, lines: any[], seq: number) {
    return { operationId: randomUUID(), revision: q.revision, quoteToken: q.quoteToken, lines,
      payment: seq % 3 === 0 ? { method: 'GCash', amount: q.total, reference: `4${String(seq).padStart(12, '0')}` }
        : { method: 'Cash', amount: q.total, cashTendered: '10000.00' } };
  }
  const submit = (client: pg.Client, actor: string, request: any) => transaction(client, actor,
    () => checkoutValue(client, 'select public.checkout($1::jsonb) value', [JSON.stringify(request)]));

  // A synchronized three-cashier race is separate from the day-volume samples.
  const raceLines = basket(1);
  const raceCommands = await Promise.all(actors.map(async (actor, i) => command(await quote(workers[i]!, actor, raceLines), raceLines, 1000 + i)));
  const race = await Promise.allSettled(actors.map((actor, i) => submit(workers[i]!, actor, raceCommands[i])));
  assert.equal(race.filter(result => result.status === 'fulfilled').length, 1);
  for (const result of race) if (result.status === 'rejected') assert.equal(result.reason.code, 'PT409');
  console.log('Task 4: synchronized race reconciled (one committed receipt, two explicit revision conflicts).');
  const initialRevision = BigInt(await value('select revision::text value from private.inventory_state where singleton'));
  const initialSales = Number(await value('select count(*)::int value from public.sales'));
  const receipts: { id: string; operationId: string; actor: string; request: any }[] = [];
  let completed = 0, reviews = 0, replays = 0, stopped = false, managerReads = 0;
  const start = performance.now();
  const manager = async () => {
    const operations = ['inventory', 'reports', 'sales-workflow', 'notifications', 'catalogue'] as const;
    const sql = { inventory: 'select public.read_inventory() value', reports: 'select public.read_reports() value',
      'sales-workflow': 'select public.read_sales_workflow(0,100) value', notifications: 'select public.read_notifications(0,50) value',
      catalogue: 'select public.read_checkout_catalogue_stock(0,100) value' };
    while (!stopped || managerReads < 30) {
      const operation = operations[managerReads % operations.length]!;
      await measure(operation, () => transaction(workers[3]!, fixture.actors.owner, () => checkoutValue(workers[3]!, sql[operation])));
      managerReads++; await delay(50);
    }
  };
  const cashiers = actors.map(async (actor, index) => {
    const client = workers[index]!;
    for (let seq = index; seq < expected.receipts; seq += actors.length) {
      const lines = basket(seq);
      let committed = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const q = await measure('quote', () => quote(client, actor, lines), lines.length);
        const request = command(q, lines, seq);
        try {
          const receipt = await measure('checkout', () => submit(client, actor, request), lines.length);
          receipts.push({ id: receipt.saleId, operationId: request.operationId, actor, request }); completed++; committed = true;
          if (seq % 25 === 0) {
            const replay = await measure('exact-replay', () => submit(client, actor, request), lines.length);
            assert.equal(replay.saleId, receipt.saleId); assert.equal(replay.replayed, true); replays++;
          }
          if (completed % 100 === 0) console.log(`Task 4: ${completed}/500 committed receipts; ${reviews} explicit conflicts requiring a simulated fresh review.`);
          break;
        } catch (error) {
          if ((error as { code?: string }).code !== 'PT409') throw error;
          reviews++;
          // Test driver explicitly models another user review and fresh quote.
          // No production command or SQL function receives an automatic retry.
          await delay(25 + index * 20 + Math.min(attempt * 10, 200));
        }
      }
      assert.ok(committed, 'A simulated cashier exhausted its explicit-review attempt bound.');
      await delay(5 + seq % 35);
    }
  });
  const cashierTask = Promise.allSettled(cashiers).then(results => {
    const failed = results.find(result => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  }).finally(() => { stopped = true; });
  const workload = await Promise.allSettled([cashierTask, manager()]);
  const failed = workload.find(result => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
  const elapsedMs = performance.now() - start;
  assert.equal(completed, expected.receipts); assert.equal(replays, 20);
  assert.equal(new Set(receipts.map(receipt => receipt.id)).size, 500);
  assert.equal(new Set(receipts.map(receipt => receipt.operationId)).size, 500);
  assert.equal(Number(await value('select count(*)::int value from public.sales')), initialSales + 500);
  assert.equal(Number(await value('select count(*)::int value from public.payments')), initialSales + 500);
  assert.equal(Number(await value('select count(*)::int value from private.checkout_operations')), initialSales + 500);
  assert.equal(BigInt(await value('select revision::text value from private.inventory_state where singleton')), initialRevision + 500n);
  assert.equal(Number(await value(`select count(*)::int value from public.sales s left join public.payments p on p.sale_id=s.id where p.id is null or p.amount<>s.total`)), 0);
  assert.equal(Number(await value(`select count(*)::int value from (select batch_id from public.stock_movements group by batch_id having sum(quantity_base)<0) negative`)), 0);
  assert.equal(Number(await value(`select count(*)::int value from (
    select u.sale_item_id,u.stock_item_id,sum(u.quantity_base) expected,
      (select -coalesce(sum(m.quantity_base),0) from public.stock_movements m join public.stock_batches b on b.id=m.batch_id
        where m.sale_item_id=u.sale_item_id and b.stock_item_id=u.stock_item_id and m.kind='Consumption') actual
    from public.sale_item_stock_usage u group by u.sale_item_id,u.stock_item_id) reconciliation where expected<>actual`)), 0);

  // Plans/read timings use the fully populated coherent fixture; no synthetic
  // receipt projections are mixed into the stock/payment reconciliation above.
  const plans = [];
  for (const [label, sql, params] of [
    ['quote-five', 'select public.quote_checkout($1::jsonb)', [JSON.stringify(basket(1))]],
    ['quote-twenty', 'select public.quote_checkout($1::jsonb)', [JSON.stringify(basket(0))]],
    ['reports', 'select public.read_reports()', []],
  ] as const) {
    plans.push({ label, plan: await transaction(db, fixture.actors.owner, async () =>
      (await db.query(`explain (analyze,buffers,format json) ${sql}`, [...params])).rows) });
  }
  for (const client of workers) await client.query('select pg_stat_force_next_flush()');
  await db.query('select pg_stat_force_next_flush()');
  const functions = (await db.query("select schemaname,funcname,calls,total_time,self_time from pg_stat_user_functions where calls>0 order by total_time desc limit 25")).rows;
  const summaries = Object.fromEntries([...new Set(samples.map(sample => sample.operation))].map(operation => [operation,
    { all: distribution(samples.filter(sample => sample.operation === operation).map(sample => sample.ms)),
      successful: distribution(samples.filter(sample => sample.operation === operation && sample.outcome === 'success').map(sample => sample.ms)),
      explicitConflicts: samples.filter(sample => sample.operation === operation && sample.outcome === 'explicit-conflict').length }]));
  const baskets = Object.fromEntries([5, 20].map(size => [size, Object.fromEntries(['quote', 'checkout'].map(operation => [operation,
    distribution(samples.filter(sample => sample.operation === operation && sample.basketLines === size).map(sample => sample.ms))]))]));
  const gates = { quote: summaries.quote!.all.p95Ms! <= expected.quoteP95Ms && [5, 20].every(size => baskets[size]!.quote!.p95Ms! <= expected.quoteP95Ms),
    checkout: summaries.checkout!.all.p95Ms! <= expected.checkoutP95Ms && summaries.checkout!.successful.p95Ms! <= expected.checkoutP95Ms,
    reports: summaries.reports!.all.p95Ms! <= expected.reportP95Ms };
  gates.checkout &&= [5, 20].every(size => baskets[size]!.checkout!.p95Ms! <= expected.checkoutP95Ms);
  await mkdir(output, { recursive: true });
  const result = { result: Object.values(gates).every(Boolean) ? 'passed' : 'timing-target-missed', at: new Date().toISOString(),
    environment: { engine: identity.version, node: process.version, logicalCpus: cpus().length, memoryGiB: totalmem() / 1024 ** 3, functionTracking: identity.function_tracking },
    agreedTestAssumptions: expected, sourceMigrations: hashes, summaries, baskets, gates,
    correctness: { synchronizedRace: { admitted: 1, explicitConflicts: 2 }, dayReceipts: completed, usualBaskets: 450, largeBaskets: 50,
      cashierRoles: ['Staff', 'Staff', 'Admin'], exactReplays: replays, simulatedFreshReviews: reviews, managerReads,
      newInventoryRevisions: 500, stockPaymentReceiptReconciliation: 'passed', elapsedMs },
    limits: ['Native SQL plus local driver/transaction overhead, not hosted API/browser latency.', 'Test-owned Auth/Realtime; no network Auth/Storage or real payment.',
      'One coherent 500-receipt day plus one separate race receipt; no long-history mixed-load SLA is established.',
      'Time-compressed concurrent burst; 500/day is a test assumption, not measured shop traffic.',
      'Every stale revision and simulated fresh user review is reported; production writes are not silently retried.',
      'Earlier bounded native and synthetic 1k/5k/20k detector evidence is preserved separately.'] };
  await writeFile(resolve(output, 'result.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
  await writeFile(resolve(output, 'samples.json'), JSON.stringify(samples, null, 2), { flag: 'wx' });
  await writeFile(resolve(output, 'plans.json'), JSON.stringify({ plans, functions }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ result: result.result, summaries, baskets, gates, correctness: result.correctness }, null, 2));
  if (!Object.values(gates).every(Boolean)) process.exitCode = 2;
} catch (error) {
  console.error(`Task 4 profile incomplete: ${error instanceof assert.AssertionError ? error.message : (error as { code?: string }).code ?? 'configuration or runtime error'}. No performance pass claimed.`);
  process.exitCode = 1;
} finally {
  await Promise.allSettled(workers.map(client => client.end())); await db.end();
}
