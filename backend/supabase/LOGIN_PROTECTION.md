# Shared public-login protection — October 22, 2026

Task 1 in the current HandsOff order is implemented and verified. With the Project
Manager's explicit approval, the additive migration
`20261022010000_shared_login_protection.sql` was applied to DualCounter
(`izdemgzdywtxhvgvsian`). All nineteen applied migration hashes and current grants
pass verification. The eighteen earlier sources were not edited or replayed.

## Enforcement and identity

`backend/src/lib/login-protection.ts` runs before the login route validates or
exchanges credentials. A shared fixed window allows ten attempts in one minute
per IPv4 address or IPv6 /64 network. All attempts, including successful logins,
consume that budget. A denied request returns 429, `Retry-After` (1–60 seconds)
and the existing generic message; API responses remain `no-store`. Changing
username/password does not create another budget. Other client networks have
independent budgets. People sharing a public IP also share this budget; confirm
that ten/minute is suitable when agreeing the shop workload in Task 4.

For direct local/Node servers, identity comes from `socket.remoteAddress`.
Express `trust proxy` remains disabled; arbitrary `Forwarded`, `X-Forwarded-For`,
`X-Real-IP` and Vercel-looking request headers are ignored. Only when the server
runtime sets `VERCEL=1` is its `x-vercel-forwarded-for` header used. It must contain
exactly one valid IP; missing/invalid/list/port/zone values fail closed with 503.
IPv4-mapped IPv6 is canonicalized to IPv4. IPv6 spelling is canonicalized before
grouping by /64. Do not set VERCEL manually on a directly reachable Node server.

This boundary relies on requests reaching a Vercel Function through Vercel's
controlled ingress. [Vercel documents its forwarded-IP
headers](https://vercel.com/docs/headers/request-headers), including its overwrite
behavior and the dedicated Vercel header. An additional proxy or alternative
hosting ingress requires a separately reviewed identity boundary. Never solve
this by globally enabling `trust proxy` or trusting a client-supplied leftmost IP.

## Shared storage and failure handling

The backend computes HMAC-SHA256 of the canonical network with a versioned login
context and its existing server-only `SUPABASE_SECRET_KEY`. Only this digest,
attempt count and expiry are stored in `private.login_rate_limits`. No raw IP,
username, password, session token or business data is stored there. All instances
must use the same backend secret/project; key rotation starts fresh budgets once.

Only `service_role` can call `public.consume_login_attempt(text)`. No anonymous,
authenticated or service role receives direct counter-table privileges. The
security-definer function has an empty search path and a two-second lock timeout.
The [atomic PostgreSQL upsert](https://www.postgresql.org/docs/current/sql-insert.html)
serializes concurrent attempts for the same key. Counts saturate at eleven;
denied requests do not extend the fixed server-clock window. Business table
grants, roles, accounts, settings, stock, receipts and history are unchanged.
[Supabase's function-privilege guidance](https://supabase.com/docs/guides/database/functions)
explains the explicit execution revocations used here.

Expiry is logical after sixty seconds. Each call opportunistically removes at
most 100 rows expired more than five minutes ago, using the expiry index and
`SKIP LOCKED`. Inactive digests can remain until later traffic; this is not a
guaranteed physical-deletion deadline or a backup-retention policy. The operational
table is outside business append-only history. Monitor its size in Task 3.

A missing/malformed/failed/timed-out RPC returns a generic 503 before username
lookup or Auth exchange. The application adds a three-second request timeout
and never falls back to a per-process limit in production. No credential/provider
details are returned or logged by this middleware. The limiter covers the app's
`/api/auth/login`; Supabase Auth's own direct endpoints retain their separate
provider protections and are not routed through this application middleware.

## Local development and final hosting activation

Nonproduction local development keeps a bounded per-app memory limiter. Set
`LOGIN_RATE_LIMIT_MODE=shared` privately to exercise the applied shared RPC from
a local server. `NODE_ENV=production` or `VERCEL=1` selects shared mode by default;
an explicit `memory` setting or unknown mode fails closed. There is no migration
or database administration connection in the request path. The server-only Auth
administration client makes the narrow operational RPC; business reads/writes
continue to use their existing caller-token clients.

During **Task 11, deployment last**, ensure the server has the selected project
URL, publishable key and secret key; leave mode unset or set `shared`, never
`memory`. No new external store, subscription or frontend secret is required.
Verify actual Vercel ingress with two distinct public client networks and spoofed
forwarding headers, ten admissions then 429 across Function invocations, expiry,
and safe unavailability. Use agreed test identities/scope; do not lock out the
shop during business hours. Platform verification remains pending until that
phase. A deployed outage must be investigated/restored; do not disable shared
protection to reopen login. Rollback application code only to a reviewed protected
revision; retain immutable migrations and business history.

## Evidence actually collected

- Focused local SQL/HTTP checks: **8/8 passed**. Two independent Express app
  instances share ten admissions from 24 overlapping requests. Tests cover
  successful-login counting, expiry, canonical identity, header spoof rejection,
  malformed identity, unsafe production mode, provider errors/timeouts, generic
  failures, grants, saturation and bounded cleanup.
- Native PostgreSQL 18.6 on Windows: 24 independent connections admit **10** and
  deny **14** both initially and after expiry; 24 different budgets admit all
  24. Anonymous/authenticated denial and forced two-second lock timeout pass.
  The unique loopback scratch cluster was stopped by its wrapper.
- Root checks **137 backend + 38 frontend = 175/175**; root typechecks, both builds
  and generated-schema consistency pass. Existing frontend chunk warning remains.
- Local Edge account/authentication regressions **17/17 pass in 44.5 seconds**,
  including new 429/503 rendering and explicit later retry. Auth and data are
  test-owned. This is affected coverage, not the Task 9 final system suite.
- Approved hosted migration and schema/grant verification pass. Rollback-only
  hosted checks pass service-only execution, no direct table grants, ten admits
  then denial and fresh budget after expiry. **All 70 pre-existing tables across
  public/private/Auth/Storage match pre-migration counts and database-computed
  fingerprints; all 71 tables including the counter match before/after the
  rolled-back tests.** No hosted login, password change, mail, payment or business
  command was performed. No Vercel deployment was made.

Ignored evidence: `.review/task-1-login/` contains logs, pre-task source hashes,
copied source baselines, `native-result.json` and aggregate hosted fingerprints.
Never commit/deploy these artifacts or the retained scratch cluster.

Native regression command (fresh unique local database only):

```powershell
.\backend\scripts\verify-login-native.ps1 -PgBin 'C:\path\to\pgsql\bin'
```

`verify-login-hosted.ts` is exact-project gated. It captures aggregate fingerprints
with `--capture-before` (exclusive file creation) and later verifies unchanged
existing data plus rolled-back counters. Its current capture is this migration's
evidence; do not overwrite it or replay hosted checks without the selected task's
database scope. No applied migration is rerunnable source.
