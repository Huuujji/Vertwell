# P7 sales review, void decisions and event history

**Current development scope:** P1–P9 are implemented within their agreed scopes on DualCounter, with seventeen immutable applied migrations and checkout enabled. GCash uses a replaceable sample QR plus manual reference recording; Owner/Admin notifications are in-app only. See [current database status](README.md#current-development-status) and [HandsOff.md](../../HandsOff.md) for the current P9A/P9B/P10–P12 follow-ups and exact verification limits. Phase-specific test counts and migration totals below describe their historical acceptance; they are not current unfinished tasks. Release preparation, GitHub saving and deployment remain for later.

Implemented and accepted on hosted DualCounter `izdemgzdywtxhvgvsian` after the
user's exact-project approval. SQL connectivity recovered without changing saved
settings or certificate verification. Hosted rollback scenarios, real Auth/API/
PostgREST persistence and three forced-overlap races now pass. The user authorized
Huuujji for Owner tests; existing Jest/Aquino cover Admin/Staff. No new accounts,
password changes, mailed links or saved tokens were needed. Generated test sessions
were signed out locally; other sessions were preserved.

Checkout is now enabled for the user's use by a separate explicit request; leave
it enabled. The eight inactive P6 test identities are retired from Users while
retaining linked Auth/profile/history records. The retirement migration brings
the immutable applied source count to twelve, without changing P7's applied SQL.
No commit, push, PR, deployment or production cutover.

## Reviewable database change

`20261017150033_durable_sales_workflows.sql` was generated with the existing
Supabase CLI 2.121.0 in the workspace-parent review directory. Its UTC filename
`20261017070033` was normalized to Manila `20261017150033` before any application.
The ten previously applied migration files remain immutable.

- Two authenticated RPCs: `read_sales_workflow(integer,integer)` and
  `sales_workflow_command(jsonb)`. No new table grants, write policies, service-role
  business access or private helper execution grants.
- One inaccessible private, append-only operation receipt table. Existing public
  tables retain RLS. `cash_movements.review_id` links entered reconciliation
  evidence to the exact daily review. `audit_events.event_sequence` gives a
  durable order to events sharing a timestamp; its wire representation is text.
- Existing receipt reads now combine current workflow status with frozen
  purchased configurations and original `checkoutStatus`/`checkoutReviewState`.
  Checkout command replay still returns its immutable original receipt.
- Existing activation state, purchased/payment/stock records, catalogue,
  inventory revision, retained identities and settings are not rewritten.

## Exact commands and transaction rules

Every command contains a UUID `operationId`, a `kind` and one to 500 exact
`targets: [{saleId, token}]`. The SHA-256 token covers the complete sale snapshot,
every void request/decision and review linkage. Unknown fields, duplicate IDs,
invalid types, excess monetary precision and client-supplied actors/totals fail.
The database resolves the current active profile; API checks are not a substitute.

The account advisory lock `(171026,3)` precedes workflow lock `(171026,5)` and
deterministically ordered sale row locks. Checkout, inventory and account commands
already acquire the account lock, serializing conflicting workflows and role
changes. Staff ownership/date is checked again after waiting, using Asia/Manila.
Deliberate conflicts use `PT409`, avoiding provider serialization retries.

An identical actor/content-bound retry returns its saved result. Changing the
actor or any command content conflicts. Current roles/read scope still apply to
replay; inactive accounts and Staff's inaccessible historical receipts remain
denied. IDs cannot be reused across workflow, checkout, inventory and account
operation receipts. No automatic write retry occurs in the browser or API.

### Daily review

Only Owner can confirm. `review` contains the business date, `verifiedIds`,
`countedCash`, `verifiedGCash`, `openingCash`, `additions`, `removals`, `refunds`
and `explanation`. Money is exact nonnegative decimal text with at most two
places. Every included receipt must be verified once and remain paid, fulfilled,
Pending/Awaiting Owner review with recorded complete stock consumption on that
same nonfuture day. Historical unknown stock handling is never inferred.

Expected Cash/GCash are recalculated from the included persisted payments.
Verified cash = counted − opening − additions + removals + refunds. A negative
net fails. Any Cash or GCash discrepancy requires an explanation. Outcome,
expected/verified amounts, counts, all adjustments, Owner identity/time and
included receipt verification are immutable persisted records. Only the exact
included sales become Completed/Reviewed; later receipts await a separate review.
Any stale included receipt rejects the entire review without writes.

Each positive adjustment creates a cash movement linked by `review_id`, attributed
to the Owner with an explanation. These are explicitly entered reconciliation
facts, not automatically executed refunds or independently verified accounting.
Their timestamp records entry at review time; the linked review supplies the
reviewed business date. Historical movement occurrence times are not invented.
GCash remains manually checked reference evidence, not provider verification.

### Requests and voids

`void.request` accepts one receipt and a reason. Staff can request only their own
current-day sales; a second pending request conflicts. Rejection leaves the sale
unchanged and permits a later new request. Every original request and decision
remains, including the requester's role/time/reason and the actual reviewer,
reviewer role/time and separate decision reason.

`void.decide` requires Owner/Admin, one exact target, `requestId`, boolean
`approved` and a reason. Approval atomically resolves the request and voids the
sale; rejection only resolves the request. No Owner password is required for
Admin. `sale.void` directly voids one or multiple exact targets; matched pending
requests are approved without replacing their original reasons.

Single stale decisions fail with 409. Bulk void returns one outcome per exact
selected ID: `voided`, `stale` or `ineligible`. Only unchanged eligible receipts
are voided. Skips are durable in the operation result and aggregate audit event;
managers can reopen a successful sale's recorded bulk results, including skipped
IDs. Unexpected failures roll back ALL successful-looking updates, request
decisions, audits and operation storage. Successful bulk sales share the
operation ID as `bulk_action_id`. No later retry silently retries only the skips.

Reviews/voids never change inventory revision, batch balances, stock usage,
payments or purchased snapshots. Voids issue no refund and return no stock.
Actual returns, wastage and refunds require their own separately recorded facts.

## Connected UI and access

`GET /api/sales-workflow?offset=0&limit=100` returns coherent authorized pages,
business date and dataset fingerprint. The client rejects mixed-page revisions,
duplicate sales or malformed contracts. Owner/Admin see permitted business sales;
Staff see only their own current-day receipts/events. Staff review summaries omit
other receipt IDs, aggregate cash counts and bulk details. There is no sample-data
fallback after live errors.

`POST /api/sales-workflow/commands` is the common command endpoint. Existing
single-receipt void/request/decision and `/api/daily-sales-reviews` aliases enforce
the matching action and target. SQL repeats authorization in the transaction.
`business_access.services.salesReview` enables the integration only after the
schema exists. Review/history access also works if checkout is administratively disabled; current checkout is enabled.

Managers have a Dashboard review queue and View all requests link to Audit Trail.
Audit provides date/search/status/payment/request filters, six-row pagination,
cross-page selected receipt disclosure, single/bulk final void warnings,
all request/decision records, saved reviews/cash adjustments and event history.
The Owner's review captures its receipt set at opening. Admin can inspect it but
cannot verify/confirm. Errors retain the counts, checkboxes, explanations and
selected snapshots; refreshing/reopening is an explicit action.

The browser stores the exact account-scoped command in session storage BEFORE
sending, without passwords/tokens. A lost/malformed/server-error response blocks
other actions/navigation and restores the exact retry through refresh. Later
failed retries do not erase an earlier uncertain result. Session storage must be
available to start a mutation. Closing the tab can clear it: inspect recorded
history before recreating an uncertain action afterward. Dirty review/decision
forms protect backdrop, Escape, X, Cancel and workspace navigation.

P8 durable financial dashboards/reports/exports and P9 in-app notifications are
implemented in their separate protected services. The existing preview, Daily Sales Values and Print/export behavior stay
preserved. Figma comparison and physical printing verification remain excluded.

## Verification

Shared PostgreSQL scenarios cover roles, complete reconciliation evidence,
receipt checks, unknown/invalid inputs, all request/decision history, partial bulk
results, actor/content replay, coherent pages, cross-workflow operation IDs,
unchanged physical/payment facts and injected review/bulk rollback. Disk
close/reopen covers reviews, cash evidence, repeated request decisions, voids and
saved command replay. `npm run sales-workflow:verify --workspace backend` runs the
same scenarios in rolled-back hosted transactions and compares every pre-existing
public/private row and Auth fingerprint. This sequential command does not establish
real caller-token behavior or simultaneous connection contention.

The fourteen shared SQL scenarios pass on hosted development in rollback-only
transactions. The additional disk close/reopen scenario is local, making fifteen
P7 database cases altogether; earlier handoffs incorrectly called all fifteen
hosted rollback scenarios. Real-account acceptance checks exact reconciliation,
all positive adjustments, discrepancy explanation, new-session persistence,
role/receipt scope, repeated request decisions and exact bulk skips. The three
races observe both real PostgREST requests waiting on the same account lock before
release: identical void returns one commit/one replay; review versus void and
competing request decisions each produce one success/one stale rejection.

The first real acceptance helper queried a nonexistent stock-usage batch column
after two valid labeled checkouts. Its stock/catalogue cleanup succeeded, and its
receipts/evidence remain. Correcting the helper to use `stock_item_id` allowed the
full real acceptance run to pass without changing P7 runtime or frozen SQL.

The six browser scenarios use real Express and disposable PostgreSQL with
test-owned Auth/Storage transports. They cover cross-session roles, review
protection/persistence, rejected and renewed requests, Admin approval, exact bulk
skips, lost-response/refresh/later-failed-retry recovery and stale review drafts.
Captures cover 1440×900, 820×400 and 320×568. Actual devices, screen readers and
hosted browser interaction are not newly claimed. The real Auth/PostgREST and
concurrent-connection evidence described above comes from the separate HTTP
acceptance helper, not from those test-owned browser transports.

See HandsOff.md for final command results, hosted baseline, approval/application
status, exact migration hash and the next unfinished acceptance gate.
