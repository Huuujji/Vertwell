# Database workspace — Backend phase

The October 17 database priority now has a verified hosted development foundation.
[DESIGN.md](DESIGN.md) contains the complete column dictionary, frontend mapping,
permission matrix, history rules and later transaction boundaries. HandsOff.md
records actual verification and the first unfinished priority.

## Verified development project

- Organization / project: **Vertwell** (user-created); project reference
  `izdemgzdywtxhvgvsian`, region Singapore (`ap-southeast-1`).
- [Project dashboard](https://supabase.com/dashboard/project/izdemgzdywtxhvgvsian)
  and API URL `https://izdemgzdywtxhvgvsian.supabase.co`.
- PostgreSQL **17.11**; three applied migrations match local content hashes.
- All 25 business tables have RLS and no application grants yet. Protected role
  policies, real accounts and API/frontend integration remain later priorities.
- Database password and administration connection settings are stored only in
  ignored `backend/.env.database.local`; the password variable is
  `VERTWELL_DEV_DATABASE_PASSWORD`. Do not put its value in this README,
  HandsOff.md, SQL files, examples, screenshots, logs or frontend variables.
- The project is the dashboard's main branch (labeled PRODUCTION by Supabase),
  intentionally used here for new-project **development**. No business data or
  real accounts existed at inspection; no deployment or production cutover occurred.

**Keep all backend work local until all backend tasks are finished. Do not commit,
push or save this phase to GitHub yet.** The earlier frontend P0 save remains the
remote checkpoint. Deployment and production data changes are separate work.

## Files and verification

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

No business data is exposed through the Data API yet, even to signed-in users or
the service role. P3 establishes real account/profile lifecycle; P4 adds explicit
Owner/Admin/Staff checks and caller-scoped RLS; P5 supplies protected aggregate
catalogue and inventory commands. Existing `createUserDatabaseClient` remains the
caller-token client. Never substitute unrestricted service credentials for it.
The administration password/pg connection is for development schema tooling only,
not the Express request data path. No frontend or runtime `.env` is enabled by
this step; real login/profile behavior remains P3.

Hosted verification: exact migration hashes, 25 RLS tables, zero application-table
or private-helper grants, zero unindexed foreign keys and 12 rollback smoke checks
passed. Security/performance advisors reported zero errors/warnings. Security's
25 no-policy notices reflect the deliberate P4 access boundary; performance's
unused-index notices reflect this empty development database. Full Auth login,
PostgREST requests and concurrent checkout remain outside these checks.

Balances are sums of canonical append-only movements. Inserting a movement locks
its batch, rejects negative physical stock and writes audit atomically. Updates,
deletions and truncation of historical rows are rejected; corrections append new
events. Canonical movement SKU/name/unit snapshots survive inventory edits.

This is the foundation, not an implemented checkout or inventory HTTP API.
Catalogue completeness/default validation, authorization, multi-batch allocation,
full-cart idempotency, payment reconciliation and real concurrent checkout still
need their later commands and live checks. Checkout must save the sale, purchased
snapshots, payments, all batch deductions and audit events in **one transaction**.
Independent SDK requests cannot provide that guarantee. Owner review never
deducts again; voids do not automatically return stock or refund a payment.

