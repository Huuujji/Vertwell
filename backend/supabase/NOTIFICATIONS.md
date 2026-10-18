# P9 — saved in-app notifications

Implemented October 18, 2026. Migration sixteen is applied and schema/role-verified
on DualCounter `izdemgzdywtxhvgvsian`, SHA-256
`163b44c5c6d3dbab6e4fc7fc699a234b2347763d5ca5359a123da7f9981c3e85`.
All existing business rows/Auth IDs/settings remain unchanged; checkout is enabled.
Root checks pass 160/160; 31 affected browser cases pass across broad/focused runs,
including final 5/5 notification acceptance and ten visually inspected captures.
The seventeenth migration `20261018040000_stable_notification_identity.sql` preserves
active alert identity/read state after formerly separate bursts merge; it changes
only a private lookup, without rewriting migration sixteen or stored rows/grants.
SHA-256: `c66acb91112e4e5b56f997d92deca7b7c9d4b33508600207ec34da4cf31fc32f`.
Final root checks again pass 160/160, focused browser cases 5/5, and both typechecks
and builds pass. Hosted schema/role/fingerprint checks pass with unchanged existing
business and notification records. All seventeen applied SQL sources are immutable.
The original scope, actual results,
earlier failed tests and hosted/disposable evidence limits are in HandsOff.md.

The user chose **in-app notifications only** for Owner/Admin, for pending void
requests and potential duplicate/unusual repeated sales. The existing Dashboard
cards, filters, evidence disclosure and Audit Trail links remain the interface.
Only Owner can load or change detection settings. Email, browser push and external
delivery providers are outside this agreed scope. GCash keeps manual QR/reference
recording; the user will replace `Frontend/public/assets/QR_gcash.svg` later.

## Data and delivery

`20261018030000_in_app_notifications.sql` adds three private, RLS-enabled tables:

- `review_notifications`: one current alert per request or overlapping duplicate
  burst, its receipt IDs, saved evidence, revision and closure reason/time.
- `notification_versions`: append-only evidence and lifecycle history, keyed by
  alert/revision. Previous receipt sets and rules survive later changes.
- `notification_reads`: the signed-in profile's explicit read/unread marker and
  evidence revision. No account can supply another recipient ID.

There are no new public tables, table grants, write policies or application grants
on private helpers. Two receive/marker RPCs are granted to authenticated callers;
both recheck current management access. Staff, inactive/unlinked accounts, anonymous
callers and Auth-administration service clients cannot use the feed. The existing
Owner-only settings permission and all business permissions remain unchanged.

Void-request inserts/decisions generate or close alerts in the same transaction.
Final checkout audit events run detection after purchased items, modifiers and
payment have been saved. There is no dependency on a manager keeping Dashboard
open, scheduler, polling job or external service. Exact checkout/request retries
reuse their original records and cannot create duplicate alerts. If the business
transaction rolls back, alert evidence and Broadcast messages roll back with it.

Duplicate detection retains the established sliding-window rule: at least the
configured number of identical baskets by the same cashier within the configured
minutes, merging overlapping qualifying windows and separating gaps. Defaults
remain five orders/two minutes until Owner saves settings. Exact prices, payment
method, product/variant/SKU identities, original nested configurations and purchased
modifiers distinguish baskets. Basket-line and JSON object-key order do not.
Actor/name/role, receipt IDs/numbers, times, trigger and rule are saved as evidence;
each original cashier snapshot stays on its receipt. Repeated sales are evidence
for human investigation, never proof of wrongdoing.

The migration backfills pending requests and matching saved receipts. It inserts
only notification records, without seeding an account or modifying any existing
business row. Detection runs for the affected cashier after checkout/void and for
all receipts after Owner changes thresholds. It currently scans that cashier's
saved receipts; a high-volume deployment should profile this query before adding
a maintained signature index/projection. This is not a background worker.

## Read state, closures and recovery

Read status persists across logout, login and other sessions of the same account.
Another manager's read status is independent. A changed receipt set or detection
rule advances the alert revision and makes its new evidence unread for everyone.
A read action requires the displayed revision. Changed/closed alerts return HTTP
409 and reload current evidence; they are never silently marked read.

Deciding a request removes its alert from the active feed. Duplicate alerts leave
the active feed when current receipts/settings no longer qualify; the stored
closure explicitly says this, and does not claim human review. Both retain their
previous evidence versions. A renewed request has a new identity and starts unread.
Marking read/unread never approves/rejects/voids a receipt, resolves a stock issue,
refunds a payment, consumes/restores stock or changes an account.

`GET /api/notifications?offset=0&limit=100` returns a caller-scoped page, total,
unread count and snapshot token. The frontend assembles only matching snapshot
pages, refusing partial/mixed evidence. `PATCH /api/notifications/:id/read` accepts
only `{revision, read}`. Requests use the caller token and normal strict API errors.
Failed/lost marker responses reload saved state; no automatic write retry occurs.
Load failures remain visible rather than appearing as an empty alert queue.

Existing private WebSocket topics carry only `notifications` invalidations.
Alert changes target managers; read changes target only the acting account's
private topic. Reconnect resynchronizes through the protected feed. Messages
contain no evidence, names, amounts, commands or recipient-supplied IDs.
The shared interface keeps filters and Owner's unsaved settings draft. New alerts
and read markers do not submit checkout, inventory, review or account commands.

## Verification

See the latest `HandsOff.md` checkpoint for actual final counts, hosted application
status and precise evidence limits. Local coverage uses disposable PostgreSQL,
real Express routes and test-owned browser sessions. It includes durable reopen,
role isolation, independent read state, exact retries, stale/lost responses,
rollback, original configuration identity, time-window boundaries, backfill,
private updates/reconnect, keyboard actions and five-size Owner/Admin layouts.
No new hosted business records or test accounts are required for acceptance.
