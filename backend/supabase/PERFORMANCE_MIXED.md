# Task 4 native mixed workload — October 22, 2026

The complete original requirements, exact workload approval and stop instruction
remain in [HandsOff.md](../../HandsOff.md). This completes the selected native
follow-up against approved **test assumptions**, not measured shop traffic:
three simultaneous cashiers, 500 receipts/day, five usual basket lines and twenty
large basket lines. The approved 95th-percentile targets are quote <= 1,000 ms,
checkout <= 2,000 ms and reports <= 5,000 ms. Hosted measurements remain Task 11.
The user requested a stop after Task 4; Task 5 has not been started by this work.

## Reproduction and isolation

From the repository root, using an existing PostgreSQL binaries directory:

```powershell
.\backend\scripts\profile-mixed.ps1 -PgBin 'C:\path\to\pgsql\bin'
```

The wrapper creates a unique cluster/database under ignored
`.review/task-4-performance/run-<random-id>`, binds a dynamic port to 127.0.0.1,
enables function timing only in that cluster, invokes
`npm run profile:mixed --workspace backend -- --confirm-disposable`, then stops
its cluster in `finally`. It retains evidence and installs no Windows service.
Trust authentication is for this disposable local fixture only.

`profile-mixed.ts` imports no dotenv, official database helper, hosted Auth or
Storage client. It requires an explicit disposable flag, a loopback-only URL,
a `vertwell_mixed_<hex>` database, an initially empty application schema, no
other application database/Supabase roles and an output directory under the
dedicated review root. Explicit guard checks rejected both a remote URL and an
ordinary local database **before connection**, without creating output.

All nineteen immutable migration sources are applied to the fresh database.
Auth and Realtime are test-owned stand-ins. Inventory commands create twenty
used products across Retail Item, Recipe, Variants and Bundle, with real recipe
inputs, optional modifiers, distinct variant stock and fixed bundle components.
Plentiful usable stock avoids treating artificial stock exhaustion as latency.
No original benchmark artifact, official data, migration or application command
is modified. No real payment or provider call occurs.

## Workload and correctness

- Three independent cashier connections (two Staff, one Admin) first quote the
  same revision and race: one genuine receipt commits and two return explicit
  `PT409` conflicts. This receipt is outside the 500 day-volume samples.
- They then complete 450 five-line and 50 twenty-line baskets, rotating models,
  variants and modifiers. Synthetic Cash/GCash payments use real receipt/payment
  SQL. GCash references are fixture values, not provider verification.
- A fourth Owner connection interleaves inventory, reports, sales workflow,
  notifications and catalogue reads. There are 327 successful manager reads:
  66 inventory, 66 reports and 65 each of the other three operations.
- The test driver explicitly simulates another user review/new quote/new
  operation after every stale revision. **653 day-workload conflicts** occurred
  among 1,153 attempts (56.63%). These are not successful checkouts. Production
  writes receive no automatic retry; the global revision contract stays intact.
- Twenty exact-operation retries return the original receipt with `replayed`.
  The day has exactly 500 distinct receipt/operation IDs, 500 payment and retry
  records, and 500 inventory revisions beyond the race anchor. Payment totals
  match; no stock batch is negative; purchased usage equals Consumption ledger
  quantities per sale item/stock. There are 501 genuine receipts including the
  separate race, with no synthetic history mixed into this reconciliation.

The compressed day workload lasted **67.65 seconds**. This is a contention burst,
not a simulation of a shop's real interarrival times or an end-user completion
time: manual review, network, browser rendering and human think time are absent.
The high conflict rate is a visible concurrency/usability limit under this
burst; it must not be presented as 1,153 successful sales or smooth cashier UX.

## Actual measurements

Successful run: ignored
`.review/task-4-performance/run-e41665e293bb4f158806e70f2f2bb8eb/`.
PostgreSQL 18.6 Windows x64, Node 24.18.0, 16 logical CPUs, 15.82 GiB RAM;
`track_functions=all`. No browser or root test suite ran during the measurement.
Durations include local driver, role/transaction setup and commit/rollback.
Percentiles use nearest rank. Raw outcome samples remain in `samples.json`.

| Operation | Samples | p95 | Maximum | Target |
| --- | ---: | ---: | ---: | ---: |
| Quote, all sizes | 1,153 | 22.54 ms | 109.06 ms | 1,000 ms |
| Quote, five lines | 940 | 10.71 ms | 108.83 ms | 1,000 ms |
| Quote, twenty lines | 213 | 31.65 ms | 109.06 ms | 1,000 ms |
| Checkout, all outcomes including conflicts | 1,153 | 171.76 ms | 298.26 ms | 2,000 ms |
| Checkout, successful only | 500 | 188.62 ms | 298.26 ms | 2,000 ms |
| Successful checkout, five lines | 450 | 181.19 ms | 279.32 ms | 2,000 ms |
| Successful checkout, twenty lines | 50 | 272.91 ms | 298.26 ms | 2,000 ms |
| Reports | 66 | 1,169.06 ms | 1,290.60 ms | 5,000 ms |
| Exact replay | 20 | 3.67 ms | 4.10 ms | No separate target |

All selected timing gates and reconciliation assertions pass. Even the largest
measured duration in each targeted class is below its target; conflicts do not
dilute an otherwise failing successful-checkout result. Five-/twenty-line
successful subsets were also calculated from retained samples in
`.review/task-4-performance/successful-basket-summary.json`.

`plans.json` retains read-only `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` plans after
the coherent history is populated, plus function timing. The final report plan
took 1,030.24 ms and used 1,208/1,210 temporary read/write blocks. PL/pgSQL outer
plans are Result nodes; they are not an internal query-plan diagnosis. Cumulative
function observations identify `refresh_duplicate_notifications` (502 calls,
36.85 s total, 34.64 s self) and `read_reports` (67 calls including the final plan,
37.35 s total) as scaling candidates. Totals overlap nested calls and concurrent
activity; they are not additive wall time or a precise attribution of conflicts.

The largest measured serialized report is **7,696,561 bytes**. Report payload
growth and history-dependent duplicate detection remain important limits for
larger history/network use. These local targets do not establish their hosted
delivery/rendering time, long-history SLA or physical-device performance. No
runtime SQL/index optimization is justified solely by a passed bounded target;
no new migration or official database configuration change was made in Task 4.
Before high-volume use, select a larger coherent history/workload and measure
signature/projection or report pagination changes against it. Preserve behavior
and use a new additive migration if a later approved change requires SQL.

## Preserved baseline and validation

The accepted October 21 independent-connection oversell/exact-retry tests and
synthetic 1k/5k/20k detector measurements remain untouched in
`.review/fp5-native/`; [RELEASE_READINESS.md](RELEASE_READINESS.md) records them.
Their synthetic projections are separate from this genuine day-volume ledger.

Three fixture-preparation runs failed before performance measurements: reused
SKU (23505), missing Food product dates (23514), and two variants sharing a
product/stock pair (23505). The new fixture was corrected to honor the existing
contracts. These are fixture defects, not measured application failures. All
four scratch clusters have shutdown log records and no `postmaster.pid`.

After the successful native run: root checks pass **143 backend + 40 frontend =
183/183**, with no failures/skips; root typechecks (including scripts and unified
deployment entry) and both builds pass. The root suite's exact generated-schema
comparison passes. The existing 731.05 kB frontend chunk warning remains pending
Task 7's scope decision. No browser/HTTP test or hosted measurement was performed
for Task 4. This is not Task 9 final whole-system acceptance.

Method references read under Task 4 permission:
[PostgreSQL 18 EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html),
[function statistics](https://www.postgresql.org/docs/18/runtime-config-statistics.html)
and [pg_stat_statements](https://www.postgresql.org/docs/18/pgstatstatements.html).
No extension or statistics setting was enabled on the official database.
