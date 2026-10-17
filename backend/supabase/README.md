# Database workspace — Backend phase

P7 is implemented/verified locally and its explicitly approved migration
`20261017150033_durable_sales_workflows.sql` is applied and schema/grant-verified
on DualCounter. All eleven applied sources are immutable. Broader hosted
acceptance is incomplete because later SQL connections stall during SSL
negotiation. The existing approval persists; checkout remains disabled.
[SALES_WORKFLOWS.md](SALES_WORKFLOWS.md) describes exact receipt reviews, recorded
cash adjustments, all void request/decision history, durable bulk results,
caller-scoped reads and uncertain-response recovery. It does not enable checkout.
See HandsOff.md for the final evidence and the precise next acceptance gate.

P6 is applied and accepted in hosted development after explicit exact-project
migration/verification approval. `20261017135332_atomic_checkout.sql` adds atomic
checkout, server quotes/configuration availability, purchased receipt retrieval
and scoped POS image reads. All ten applied hashes match and sources are frozen.
Real caller-token persistence, three forced-overlap races and final hosted
regressions pass. The separately approved temporary test activation ended
**disabled**; a future request is needed to leave checkout enabled for use.
See [CHECKOUT.md](CHECKOUT.md). P7 hosted acceptance is next. All Backend work
remains local and off GitHub.

The October 17 database priority now has a verified hosted development foundation.
[DESIGN.md](DESIGN.md) contains the complete column dictionary, frontend mapping,
permission matrix, history rules and later transaction boundaries. HandsOff.md
records actual verification and the first unfinished priority.

P3 real authentication/account lifecycle is implemented and live-tested. Hosted
Auth configuration is approved/saved, and email receipt plus successful same-browser
password change/login are user-confirmed. P3 is accepted. See
[AUTHENTICATION.md](AUTHENTICATION.md). P4 business permissions are accepted:
the user approved the exact DualCounter migration/verification, and hosted checks
pass. See [AUTHORIZATION.md](AUTHORIZATION.md). P5 protected CRUD is implemented;
its approved migrations, real browser/Auth/API/Storage acceptance and final
hosted regressions pass. See [CRUD.md](CRUD.md) and HandsOff.md for exact evidence.
P2A's contracts/mappings remain documented in
[INTEGRATION.md](INTEGRATION.md). Configured login resolves real profiles and
keeps the explicitly labeled sample preview separate.

## Verified development project

- Organization: **Vertwell**; project display name: **DualCounter** (originally
  Vertwell, renamed by explicit user request). Its read-only project reference is
  `izdemgzdywtxhvgvsian`, region Singapore (`ap-southeast-1`).
- [Project dashboard](https://supabase.com/dashboard/project/izdemgzdywtxhvgvsian)
  and API URL `https://izdemgzdywtxhvgvsian.supabase.co`.
- PostgreSQL **17.11**; ten applied migrations match local content hashes.
- All 25 business tables have RLS and authenticated SELECT-only policies. Exactly
  six tables have authenticated SELECT grants; no table write grants exist.
  Management/profile/ledger table grants remain closed. Twelve restricted public
  RPC grants and one private role helper were the P5 boundary. P6 now adds five
  restricted public RPC grants and one private read-only POS image helper;
  there are seventeen public grants and two private helpers in total.
  P5 adds protected aggregate Users/Inventory services and a private image bucket;
  real signed-in browser/Auth/PostgREST/Storage acceptance passes.
- Database password and administration connection settings are stored only in
  ignored `backend/.env.database.local`; the password variable is
  `VERTWELL_DEV_DATABASE_PASSWORD`. Do not put its value in this README,
  HandsOff.md, SQL files, examples, screenshots, logs or frontend variables.
- The project is the dashboard's main branch (labeled PRODUCTION by Supabase),
  intentionally used here for **development**. It now has two real Owner accounts:
  retained admin and user-approved Huuujji for testing only. Admin remains active
  and unchanged. The user-requested Jestine Admin / Jest and Aquino Staff / Aquino
  accounts also exist and remain active. Acceptance catalogue fixtures are
  archived with zero batch balances; their stock/audit history and one private
  image remain. P6 adds eleven labeled development sales/payments and eight
  inactive test accounts, with no test Auth sessions left. All four retained
  accounts remain active and exactly unchanged. No production cutover occurred.

**Keep all backend work local until all backend tasks are finished. Do not commit,
push or save this phase to GitHub yet.** The earlier frontend P0 save remains the
remote checkpoint. Deployment and production data changes are separate work.

## Files and verification

- Applied `migrations/20261017135332_atomic_checkout.sql` after exact-project user
  approval. Final `checkout:verify` passes **16/16**, `inventory:verify` **15/15**,
  `permissions:verify` **11/11**, `db:smoke` **12/12** and schema verification
  confirms ten hashes. Real Auth/API/PostgREST/Storage verification passes ten
  acceptance groups and three observed simultaneous connection races.
  The first test monitor's timeout and its retained fixtures are documented in
  CHECKOUT.md/HandsOff.md. Nine P6 products and seven stock items are archived
  with zero balances. Eleven sales/payments, 41 movements, 144 audits and revision
  62 are intentional history. Checkout ends disabled at the user's request.

- Applied `migrations/20261017060000_inventory_revision_scope.sql` scopes the
  revision UPDATE for the API safe-update guard.
  `migrations/20261017070000_nonretryable_business_conflicts.sql` changes only
  deliberate business-conflict raises to PT409, avoiding PostgREST 14's repeated
  40001 retries. Neither changes grants or relaxes rejection. All nine sources
  are frozen. API conflict mapping recognizes PT409.

- Applied `migrations/20261017050000_inventory_commands.sql`: four additional
  authenticated RPCs, private inventory revision/operation/account receipts,
  atomic catalogue/stock commands and private image-bucket policies. Exact-project
  user approval resolved the previous hosted-apply rejection. All nine applied
  sources remain immutable. Hosted inventory checks pass **14/14**, permission
  regressions **11/11** and smoke checks **12/12**, with rolled-back SQL fixtures.
  Existing real Owners/settings and public/Auth table counts remain unchanged.

- Applied `migrations/20261017040000_business_permissions.sql`: current
  role/action checks, 25 SELECT policies, six scoped read grants, narrow POS/sales
  projections and Owner-only audited settings command. Five prior sources stay
  immutable. Explicit exact-project user approval resolved the earlier hosted
  authorization rejection. The ban on unfinished Backend GitHub saves remains.
- `../tests/permissions.test.ts` and `../scripts/permission-checks.ts`: shared
  rolled-back PostgreSQL scenarios. Hosted `permissions:verify` passes **11/11**,
  and `db:smoke` passes **12/12**, leaving no durable fixture rows or changed grants.

- `migrations/202610170001_foundation.sql`: 25 tables, exact decimal types,
  Supabase Auth-linked profiles, SKU relationships, all four stock models,
  independent modifiers, receipt/usage/payment snapshots, movements, reviews,
  void requests, audit and alert settings. All tables enable RLS; no application
  role gets table privileges or policies yet.
- `migrations/202610170002_integrity.sql`: model/unit/date/link checks, deferred
  SKU and bundle-graph constraints, archival/history guards, batch locking,
  movement-derived balances and an audit event committed with each stock write.
- `migrations/20261017015959_unit_reference_indexes.sql`: five follow-up unit
  indexes. Generated with Supabase CLI 2.121.0; its timestamp was converted to
  Manila time before application to follow the two legacy October 17 versions.
- `seeds/development.sql`: explicitly guarded catalogue-only fixtures. No Auth
  identities, profiles, illustrative sales, payments or fabricated stock balances.
- `../tests/database.test.ts`: actual PostgreSQL execution using PGlite (dev-only
  dependency); includes a second clean migration replay and disk close/reopen.

From the repository root:

```powershell
npm run test:database --workspace backend
npm test
npm run typecheck
npm run build
npm run db:inspect --workspace backend
npm run db:verify --workspace backend
npm run db:smoke --workspace backend
```

The database tests use disposable Auth/role stand-ins and never contact Supabase.
Disk verification artifacts go under the ignored repository `.review/database-*`
directory. They are local test databases, not a configured application database.
Existing API tests in `npm test` need permission to connect to their localhost
test server. No production credentials are required for these checks.

The three `db:*` checks above use the configured development database; `db:smoke`
creates synthetic SQL fixtures only inside one rolled-back transaction. It does
not provision real Auth accounts, send emails or leave sample business records.
It verifies that all business/Auth table counts are restored afterward. Its
temporary privilege grant is rolled back too. Embedded tests remain credential-free.

## Administration tooling and TLS

`../scripts/database.ts` loads only the ignored administration settings and
requires a matching target project for schema changes:

```powershell
npm run db:apply --workspace backend -- --project-ref izdemgzdywtxhvgvsian
```

The current machine is configured. For a new machine, copy `admin.env.example`
to `backend/.env.database.local` and fill it privately using the project's
dashboard session-pooler connection details. The example has blank credentials.

It locks migration application, runs pending SQL and the Supabase-compatible
`supabase_migrations.schema_migrations` metadata in one transaction, skips exact
already-applied content, and rejects unknown history or changed hashes. Applied
SQL is immutable: add a new migration for later changes. New files must sort
after existing versions; generate with the CLI, review ordering/timezone before
application, and never rename an already applied file. For a new development
project, change the ignored settings and supply its explicit matching reference.
The two original 12-digit migration versions show Unknown date cells in the
dashboard; their exact version/name/content is verified. Keep that applied history.

The session-pooler endpoint is copied from the dashboard, never guessed from the
region. Connections verify TLS using `certs/supabase-prod-ca-2021.crt`, downloaded
from the dashboard's official
[certificate link](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt).
Certificate SHA-256:
`700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.
No certificate checking was disabled and no machine-wide trust settings changed.

## Apply to an empty Supabase development project

Use a confirmed development/test project with its existing Supabase-managed
`auth.users`, `anon`, `authenticated` and `service_role`. These migrations do not
create or replace Supabase Auth or its roles. Review the design and files first.
Using a PostgreSQL client as that project's migration owner, execute each file in
filename order with stop-on-error enabled, for example:

```powershell
psql --dbname $env:VERTWELL_DEV_DATABASE_URL --set ON_ERROR_STOP=1 --file backend/supabase/migrations/202610170001_foundation.sql
psql --dbname $env:VERTWELL_DEV_DATABASE_URL --set ON_ERROR_STOP=1 --file backend/supabase/migrations/202610170002_integrity.sql
```

`VERTWELL_DEV_DATABASE_URL` is a direct **development** database connection string
set privately in the local environment. Never put it in `VITE_*`, source control
or a report. `SUPABASE_URL`/publishable keys cannot execute DDL. Each file contains
its own transaction; stop on any failure. These are ordered one-time migrations,
not rerunnable seed scripts. Record applied filenames in the development
environment's migration history; do not partially reapply them to existing tables.
Future Supabase CLI use should adopt these exact files as migration history.

The current Vertwell development project is already applied and verified; do not
reapply it through raw psql. The administration command above tracks exact history
and provides safe repeated verification. This manual psql example is retained for
other empty reviewed development environments; record history consistently there.

For the optional fixture seed only, open a **disposable development** SQL session:

```sql
SET vertwell.allow_development_seed = 'on';
-- Execute seeds/development.sql in this same session.
RESET vertwell.allow_development_seed;
```

Fixtures deliberately have no users or opening ledger entries. Real opening
quantities need a trusted actor and the later inventory command. This seed is not
part of migrations or any deployment; it is intentionally not repeatable against
an already seeded database.

## Access and transaction boundaries

P3's narrow account RPCs establish real account/profile lifecycle. P4's approved,
applied migration adds Owner/Admin/Staff checks, caller-scoped sales reads and a
limited POS selling-card projection. Checkout remains unavailable. P5 supplies protected aggregate
catalogue and inventory commands. Existing `createUserDatabaseClient` remains the
caller-token client. Never substitute unrestricted service credentials for it.
The administration password/pg connection is for development schema tooling only,
not the Express request data path. P3 configures ignored runtime files separately.

Current hosted verification confirms ten exact migration hashes, 25 SELECT-only
policies, six restricted table grants, two private helpers, seventeen public RPC
grants, zero unindexed foreign keys, 16 checkout scenarios, 15 inventory scenarios,
11 permission scenarios and 12 rollback smoke checks. Private image-bucket
metadata/policies also pass. Final regression fixtures preserve all counts, while
real P6 acceptance intentionally adds the labeled history recorded above.
All four retained Auth/profiles and settings match the pre-P6 fingerprint exactly.
At P5, five anonymous hosted PostgREST denial checks and generated-schema
`--check` passed, with 86/86 local root tests. The subsequent P6 local checkpoint
passed 106/106 and 26/26 scoped browser tests; these were not rerun during hosted
acceptance. The
verifier casts policy role metadata to `text[]` for node-postgres decoding.
Evidence: workspace-parent `.review/october-17-p5-final-*` and the live
account/inventory JSON/logs and browser captures listed in HandsOff.md.

The earlier P2 security/performance advisor review reported zero errors/warnings;
its 25 no-policy notices described the historical restricted foundation. Advisors
were not rerun for P5/P6 acceptance. Separate real Auth/browser/API/Storage
acceptance and two-session inventory revision/receipt contention pass. P6 now
adds separately observed real concurrent checkout/retry/correction tests.
Rolled-back SQL checks alone do not establish those results. Simultaneous account
writes and a new whole-browser-suite run remain unverified.

Balances are sums of canonical append-only movements. Inserting a movement locks
its batch, rejects negative physical stock and writes audit atomically. Updates,
deletions and truncation of historical rows are rejected; corrections append new
events. Canonical movement SKU/name/unit snapshots survive inventory edits.

P5 now provides the protected inventory HTTP API and aggregate commands described
in CRUD.md. P6 now implements verified multi-batch checkout allocation,
authoritative pricing, full-cart idempotency and real concurrent checkout.
Provider payment verification/reconciliation remains P9. P6 saves the sale,
purchased snapshots, payments, all batch deductions and audit events in
**one transaction**. Independent SDK requests cannot provide that guarantee. Owner review never
deducts again; voids do not automatically return stock or refund a payment.

