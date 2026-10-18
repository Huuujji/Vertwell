# P8A — shared frontend and private automatic updates

October 18, 2026. P8A implementation, hosted private transport, visual review and
regression are verified. Root tests pass 147/147; the full browser run passes
264/264. Final affected coverage is 18 passing cases plus a corrected 4/4 dialog
rerun, including the additional bundle case (265 distinct cases across runs).
HandsOff.md records exact evidence, the test-fixture correction and limits.
Backend work remains local: no commit, push, PR or application deployment.

## UI and saved data

Real accounts reuse the completed Navigation, Inventory, Users and Dashboard.
Preview and real-account adapters share `ProductOptions`, `CheckoutSummary`,
`CashPaymentFields`, `GCashPaymentFields`, `SalesOverview`, `PosHeading`,
`CatalogueCard`, `SalesHistoryHeader`, `TransactionTable`, `DailyReviewQueue`,
`ReportSummary`, `StockBalanceCard`, calendars, time fields, tables and dialogs.
The real-account wrapper adds no repeated Welcome/name heading or routine Refresh
control. Identity remains in the existing navigation and Staff counter heading.
Saved receipt recovery, current quote review and explicit error retry remain.

The live adapters retain protected services, exact decimal transport, purchased
snapshots, stock models, review/void semantics and complete report/export scopes.
Dashboard cards and their chart share one report snapshot and category selection.
Preview keeps its own labeled sample records; it never supplies real-account data.
Staff still sees only POS and its own current-day history. Admin cannot load or
change Owner-only alert settings. P9 now adds saved in-app alerts and per-account
read state using these private topics; see [NOTIFICATIONS.md](NOTIFICATIONS.md)
and the latest HandsOff.md checkpoint for acceptance.
Owner settings use the existing revision-protected API, without automatic saves.

## Hosted transport and access

`20261018010000_private_live_updates.sql`, normalized SHA-256
`4251947b6f0a74e55bc20af18373462091f2c2616f14bae66bb534480ffe13e3`,
is applied to DualCounter `izdemgzdywtxhvgvsian` after explicit user approval.
All fourteen applied SQL files are immutable. This migration adds no business
table, business row, public RPC, application write grant or identity.

Supabase Realtime provides the WebSocket connection directly, including when the
Express API is hosted in a request-based environment. No persistent Express
WebSocket process, public business-table publication or polling substitute is used.

| Private topic | Authorized subscriber | Payload |
| --- | --- | --- |
| `vertwell:managers` | Current active Owner/Admin | Changed resource scopes only |
| `vertwell:catalogue` | Current active application account | Catalogue/access invalidation only |
| `vertwell:user:<id>` | That current active account | Own sales/access invalidation; identity recheck flag |

The SELECT policy on `realtime.messages` checks the requested topic, row topic,
Broadcast extension, `auth.uid()` and existing database `business_role()` helper.
There is no application INSERT policy. Clients cannot publish database changes.
All trigger functions are security-definer, use an empty search path and have
execution revoked from PUBLIC, anon, authenticated and service_role.

Nine triggers cover inventory revision, profile changes, sales, void requests,
review receipt membership, payments, audit append, checkout readiness and alert
settings. Current protected inventory/checkout commands advance inventory revision
atomically with catalogue, batch, movement and sale changes. Sales events also
target the original cashier. Events contain no records, names, totals, credentials,
commands or historical snapshots. Database Broadcast messages commit/roll back with
their source transaction.

Every event reloads through the existing caller-scoped API/RPC. Its current active
role, ownership/day rules and narrow grants remain authoritative. Realtime join
authorization is cached by the service; an existing channel can briefly receive
metadata after a role change. The targeted identity event rechecks `/api/auth/me`,
remounts the new account/role scope and removes old channels. An old channel never
carries business data, and an old role cannot read it through the protected API.

## State, conflicts and recovery

`Frontend/src/lib/live-updates.tsx` subscribes only in real-account mode. It batches
related invalidations for 100 ms, resynchronizes on initial join/rejoin, reconnect,
online/focus/visibility resume, and removes subscriptions on logout or scope change.
Normal saved-business refresh is event driven. Failed reads retry with backoff;
authorization failures instead recheck identity. The existing Auth verification
timer is unchanged and is not the business synchronization transport.

`useLiveResource` updates an existing component; it never changes its React key to
announce an event. Drafts, filters, pages, selections, cart lines, modifier choices,
payment inputs and uncertain-command recovery therefore remain mounted. Inventory
and Users announce an open editor before paint. Their original source revision is
held, including cancellation of an already running background read. Pending data
is read after closing the editor. A concurrent save produces the existing explicit
conflict; it cannot silently rebase an old stock count or account edit.

Review/void dialogs retain their original receipt set and content tokens. A stale
decision still fails or reports exact stale skips. POS retains its cart/quote and
revalidates authoritatively on the next deliberate action. No event submits or
retries a stock, sale, account or review command.

Export review holds its snapshot. Closing it does not fetch a replacement unless
there is an actual pending event/interrupted read. Consequently Download PDF and
Print reuse the same cached PDF for unchanged filters/data. A real intervening saved
change produces a new, disclosed snapshot rather than rewriting an open review.

## Verification boundaries

The disposable PostgreSQL fixture supplies a test-owned Realtime schema; it is
never installed in Supabase. SQL tests verify active-role/topic isolation,
receive-only access, metadata-only payloads and rollback. Browser protocol fixtures
exercise SQL-triggered changes across independent contexts, drafts/conflicts,
cart/payment preservation, account role changes, checkout/review/report propagation
and reconnect. They are separate from hosted acceptance.

Hosted acceptance uses the previously authorized Huuujji Owner, Jest Admin and
Aquino Staff, with two independent Owner sessions. Real private subscriptions,
denied topics/anonymous access, real browser authoritative reloads, an unsaved draft
and actual disconnect/reconnect are checked. Broadcast test signals contain only
resource scopes. Existing business records are not changed to manufacture test
results. Sign-in links/tokens stay in memory; no email/reset/password change occurs;
only the created sessions are signed out locally. Before/after fingerprints cover
every public/private business row and all Auth IDs.

Real/preview screenshots use each mode's legitimate data at 1440×900, 820×1180,
390×844, 320×568 and 820×400. Geometry, browser errors and visual inspection are
reported separately from mocked browser transport and real hosted transport.
The hosted catalogue has no available configurable product; live option/variant/
bundle presentation is covered with disposable database/browser data, alongside
real hosted Cash/GCash/confirmation dialogs. Final read-only fingerprints match
all current business rows and Auth IDs. The pre-session baseline already included
newer activity than the prior handoff; those current records were preserved.
No physical-device, screen-reader, paper-printing or renewed Figma audit is claimed.

Transport references: [Supabase Database Broadcast](https://supabase.com/docs/guides/realtime/broadcast)
and [private channel authorization](https://supabase.com/docs/guides/realtime/authorization).
