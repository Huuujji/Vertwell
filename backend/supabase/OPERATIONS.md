# Task 3 — monitoring, health and recovery

The Project Manager is the monitoring operator, confirmed October 22, 2026.
This guide covers the existing account-only application and nineteen immutable
migrations. Vercel remains the last deployment phase. No external monitoring
subscription, account configuration, hosted fault injection or scheduled monitor
was created by this task. Task 2 backups/restore were explicitly deferred; no
verified disaster-recovery capability or four-hour recovery promise is implied.

## Signals available in the application

API responses have a server-generated `X-Request-ID` and `Cache-Control: no-store`.
Client-provided request IDs are ignored. The request observer emits JSON for
failed responses, slow requests, business writes, login responses and accepted
operational observations. Healthy routine reads are quiet. Records contain only
UTC timestamp, random request ID, allowlisted route template, bounded method,
HTTP status, elapsed milliseconds, slow flag, level and outcome; browser hints
may add one allowlisted event. No request body, account/receipt ID, IP, query,
header, email, password, payment reference, token, raw error or stack is recorded
by this observer. Unknown paths become `unmatched`; record IDs become `:id`.
Existing bounded SQL error-code logs remain generic.

The default slow warning is **2,000 ms**, configurable with server-only
`SLOW_REQUEST_MS` (integer 100–60000). This is an investigation threshold, not a
shop SLA. Request timing includes Auth, permission checks and command execution;
it does not isolate PostgreSQL duration. Agree workload/timings in Task 4.

The observer records interrupted/5xx business-command responses as **unconfirmed**,
not as proof of failure or rollback. Logging cannot retry a command or change a
response if its sink fails. These records go to local console output now; they
will go to the platform Function log sink after the reviewed deployment.

Authenticated clients may send only `{event}` to
`POST /api/operations/client-events`, using this closed event list:

| Event | Meaning / limitation |
| --- | --- |
| `checkout.unconfirmed` | The browser could not establish a checkout result. Preserve its original operation. |
| `checkout.reconciled` | The browser retrieved a receipt after a pending/uncertain operation or exact replay. |
| `updates.offline` | A private channel reported an error, timeout or closure. |
| `updates.recovered` | All required private topics rejoined after an observed interruption; existing protected reloads resynchronize data. |
| `storage.unavailable` | Optional POS image URL loading failed; the catalogue/sale remains usable. |

These are **client observations**, not trusted proof of service failure or a
database commit. The browser sends them best effort with a three-second timeout
and no retry, once per event per minute. The receiving app also suppresses
duplicates per active profile/event for a minute with bounded process memory;
that is not a global security rate limit. Absence of hints is not evidence of
health: an offline browser may be unable to report. No business payload is sent.

## Health probes and their limits

`GET /api/health` remains public process/configuration liveness. A 200 here cannot
establish a working database, Storage, private channel or checkout.

`GET /api/health/ready` requires a verified active **Owner**, rejects scope/query
overrides and returns a private read-only dependency report:

- Auth validates the actual caller token; the current profile is read from SQL.
  Auth requests and profile reads each have a five-second deadline. A provider
  outage/timeout returns generic 503; genuinely invalid/expired credentials stay
  401. No password exchange or email is performed by the probe.
- `business_access` executes through the caller's database client and verifies
  the same active Owner; the read has a three-second deadline.
- A one-entry private `inventory-images` listing executes through that caller's
  Storage client, with a three-second deadline. This proves listing reachability,
  not delivery of every image, upload permission or blob integrity.
- These last two checks run in parallel. Either failed/malformed/timed-out check
  yields `status: degraded` / HTTP 503 without provider details. This does not
  change any official data, grants, settings, files or shared-login counters.
- Private updates and checkout reconciliation are explicitly returned as
  `requires-client-observation` / `requires-receipt-review`. An HTTP read probe
  cannot prove either. No actual checkout is performed as a health check.

The worst-case sequence includes token verification, current-profile read and
parallel dependency reads; the individual deadlines are not a three-second
whole-probe SLA. A 200 has `scope: read-only-dependency-probe`, not a claim of
end-to-end readiness or verified recovery. Admin/Staff receive 403; anonymous or
expired callers cannot retrieve diagnostics.

An optional operator helper is prepared:

```powershell
npm run operations:check --workspace backend
```

Copy `backend/operations.env.example` to ignored
`backend/.env.operations.local`, and enter a current Owner session token privately
if using this helper. Never put it in command arguments, chat, source, screenshots
or logs. It expires normally; 401 means refresh that probe credential. No token
is generated or privilege widened by the helper. Without a token it reports
the private check **not run** and exits nonzero; liveness alone never passes the
whole check. The helper permits only loopback by default, refuses redirects and
bounds requests at fifteen seconds. Hosted use additionally requires the exact
approved HTTPS origin and `--allow-hosted`, only in Task 11's chosen scope.

## Operator routine and incident response

Until a separately selected continuous monitor is active, this is an **operator
inspection workflow**. Check at shop opening, after a release and immediately
when a cashier reports an interruption or uncertain payment. During an incident,
keep logs open and sample dependency availability about once a minute. Do not
poll authenticated health from every cashier tab. Automated alert delivery and
long-term log export are not configured or claimed.

Use these initial investigation triggers; revisit against measured shop traffic:

| Signal | First response |
| --- | --- |
| Any uncertain checkout, interrupted command or checkout 5xx | Stop creating another order for that payment. Keep the same browser recovery record and use **Retry same checkout** to retrieve the original receipt. Confirm exactly one receipt/deduction. Do not clear session storage, change the command ID, submit another payment or manually restore stock to guess the outcome. Escalate unresolved cases to the operator for authorized receipt/stock/payment review. |
| Two consecutive degraded dependency probes, or repeated Auth 503s | Compare request ID/time, check the API and Supabase service logs/status, configuration and network. Do not replace an account, disable shared-login protection, widen grants or reset data. A real 401 calls for a fresh authorized session; 403 calls for permission review. |
| Three requests at/above the slow threshold in five minutes | Filter route/time and compare database/pooler/query/connection/CPU/IO indicators. Record contention and basket/history size. Avoid overlapping performance runs; optimization belongs to measured evidence in Task 4. |
| Repeated image errors or failed Storage listing | Check the private bucket and existing policies, signed-URL expiry and current session. Preserve drafts. Do not make the bucket public, remove images or broaden Staff access. A healthy listing does not prove all object reads. |
| Private updates remain interrupted for two minutes or affect multiple tabs | Preserve drafts/cart/payment; check network, session and required channel joins. Reconnection/focus triggers protected reloads. Compare a permitted saved change in another session when its browser/data scope is approved. Do not accept public channels or arbitrary broadcasts as a workaround. |
| Rising login 429s / login-protection 503s | Review login traffic/errors and shared-counter availability. Shared public IPs use the same budget. Use the existing fixed-window expiry; never fall back to memory in production. An operator may inspect counter size/expired counts read-only; do not publish HMAC digests or clear business tables. |

Record incident times in Manila time **and UTC**, request IDs, affected feature,
source/deployment revision, symptoms, investigation and recovery result in private
operational notes. Keep secrets and customer/payment content out. Logs are not
the financial/audit ledger; use authorized saved receipts/history for reconciliation.
After recovery, verify the affected protected read, image delivery, channel
reconnection and any pending exact-operation receipt before declaring it restored.
Business writes, real payments, database changes or production rollback require
their existing exact scope/approval. Preserve all immutable migration sources.

## Final environment activation — Task 11 only

The source emits per-request records; it does not accumulate authoritative
cross-instance totals in memory. Review them in the actual platform log sink.
[Vercel runtime logs](https://vercel.com/docs/logs/runtime) capture Function output;
retention and export capabilities depend on the selected plan. Confirm actual
retention/access at Task 8 and verify collection during Task 11. Preserve relevant
incident records before the platform's retention window expires; an unselected
paid log drain is not installed by this guide.

[Supabase service logs](https://supabase.com/docs/guides/observability/logs) expose
Auth, PostgREST, Storage, Realtime, database and pooler sources. Filter the exact
incident time/service; empty results may reflect filters/retention rather than
absence of activity. [Supabase metrics](https://supabase.com/docs/guides/observability/metrics)
can provide database saturation/query evidence. A separate collector/alerting
integration requires its selected account, retention, costs and destination.
[Realtime troubleshooting](https://supabase.com/docs/guides/realtime/troubleshooting)
provides provider guidance for channel errors and disconnections.

Before public cutover, verify the actual selected release/origin: request IDs and
logs are visible to the operator, Owner-only probes use the real environment,
real permitted private image reads and channel joins work, and the agreed
recovery/checkout workflows reach the intended evidence. Confirm the inspection
routine or separately chosen automated alerts. Do not cause a real failed
payment, alter live data or inject production faults without that exact approval.

## Local verification evidence

Task 3 tests use disposable/fake Auth, SQL and Storage; no official service data
or credentials are changed. The focused checks cover protected probes, safe
degradation/timeouts, bounded event input, privacy, request correlation, slow work
and monitoring-sink failure. Browser tests exercise actual private test channels
and an intentionally lost committed response, including the new observation
events and existing once-only receipt/stock reconciliation. Exact final counts
and preservation evidence are recorded in HandsOff.md and ignored
`.review/task-3-operations/`; they are not the Task 9 final system acceptance.
