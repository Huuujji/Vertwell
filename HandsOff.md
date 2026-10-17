# Vertwell handoff

Updated October 17, 2026. This is the single handoff file, merged from the former HandsOff.md UI notes and HANDOFF.md technical/history notes. **The Backend phase has started by the user's explicit request. Database work is first. Keep all Backend code/documentation local; do not commit, push or save it to GitHub until all Backend tasks are finished.** P0 remains complete: the frontend and existing scaffold are saved and verified in https://github.com/Huuujji/Vertwell on `main`. **P1/P2/P2A/P3/P4/P5/P6 are accepted. P6 hosted migration, real caller-token persistence and simultaneous checkout acceptance pass. The user-approved temporary activation ended disabled. P7 is implemented and its approved migration is applied/schema-verified; broader hosted acceptance is incomplete after SQL connection failures. P8/P9 remain later work.** The hosted development project is DualCounter, reference `izdemgzdywtxhvgvsian`. Keep both original Owners unchanged and keep the user-requested Jestine Admin / Jest and Aquino Staff / Aquino accounts active. Original user messages and historical checkpoints remain preserved below.

## New — current state and continuation

### Current checkpoint — P7 approved, applied and schema-verified; broader hosted acceptance incomplete (October 17, 2026)

**The user explicitly answered "Approve P7 migration and verification on this exact
project" for DualCounter `izdemgzdywtxhvgvsian`. This approval persists; do not ask
for it again.** The earlier automatic approval rejection happened before execution
and is resolved. The normal exact-project `db:apply` then applied only
**`20261017150033_durable_sales_workflows.sql`**, SHA-256
`6cdb4de6334e0e9ecb4d7bf0558f084be1ea4f7fbd52dc29282c3a079b4f8475`.
All **eleven** applied SQL sources are now immutable. No commit, push, PR or
deployment was made; the user's `da020a5`/`e7bea06`/`91a043f` commits are preserved.

- Hosted **`db:verify` passes**: eleven exact migration hashes, all 25 RLS business
  tables, the existing six SELECT-only table grants, nineteen narrowly granted
  public functions, only two permitted private helpers, no table write grants,
  expected policies and FK indexes. The new private operation table is inaccessible
  to application roles. Application of P7 does not activate checkout.
- Real HTTPS/PostgREST denies both new functions to anonymous and service-role
  callers (**4/4 denial checks**). These are grant-denial checks, not authenticated
  Owner/Admin/Staff persistence or simultaneous-decision acceptance.
- **Hosted verification is incomplete because database connections stopped
  completing SSL negotiation after successful apply/schema verification.** The
  first `sales-workflow:verify` connection reset; a retry through the same project's
  previously verified transaction-pooler port 6543 and a later 5432 inspect timed
  out. All three DNS-resolved pooler addresses accept TCP but time out before SSL
  negotiation/authentication. Direct TLS negotiation also times out. This machine
  cannot route the project's DNS-confirmed direct IPv6 endpoint (`ENETUNREACH`).
  Certificate validation, pinned CA, saved connection settings and security policy
  were preserved. The browser tool also failed to create a dashboard tab; do not
  represent this as a successful dashboard inspection or a confirmed provider outage.
- No persistent P7 acceptance accounts or sales were created. No retained Owner
  was signed in, password-tested, reset or edited; Jestine Admin / Jest and Aquino
  Staff / Aquino remain retained. No explicit checkout activation was performed.
  Any attempted SQL regression fixture work is inside rollback-only transactions;
  no hosted P7 review/request/decision/void was accepted as a verified real write.
- The last successful hosted baseline/schema inspection records **12 Auth/profiles
  (four active), 11 sales/payments, 43 movements, 149 audits, inventory revision 64**,
  zero review/request/cash-movement records and **checkoutEnabled: false**. Preserve
  this newer baseline and all deliberate P5/P6 history. Do not revert it to older
  P6 counts. A fresh independent final SQL fingerprint could not be obtained during
  the connection problem, so it has not been claimed.
- Local implementation evidence below remains valid: **125/125 root tests**, final
  builds/typechecks/generated schema equality and **64/64 scoped browser checks**.
  Current code additionally handles a dropped verifier connection without an
  unhandled client error. Original messages, current Login wording and all eleven
  applied hashes remain protected by the final source audit. No files are staged.
- Evidence is workspace-parent `.review/october-17-p7-{approval.txt,apply.log,
  hosted-db-verify.log,hosted-sales-workflow-verify.log,
  hosted-final-sales-workflow-verify.log,hosted-reconnect.log,
  https-checks.mts,https-checks.json,https-checks.log,audit.cjs,audit.json}`.
  Read-only diagnostics use the `connectivity`, `pg-diagnostic`, `dns-diagnostic`,
  `direct-tls-diagnostic` and `ipv6-diagnostic` `.mts` helpers there. Keep their failed
  evidence; do not replay historical one-time mutation helpers.

**Next:** restore a certificate-verified SQL connection to this exact project, then
run the already approved `sales-workflow:verify` (15 rollback scenarios),
`checkout:verify`, `inventory:verify`, `permissions:verify`, `db:smoke` and final
`db:verify`. Inspect active/stuck requests if a connection permits it. Then finish
isolated real Auth/caller-token persistence/retry/scope tests and forced-overlap
duplicate/review-versus-void/competing-request-decision acceptance, retaining
labeled development history and proving all original rows/accounts are preserved.
Keep checkout disabled; do not enable it for use, edit/reapply frozen SQL, review
or void the retained P6 receipts as disposable fixtures, ask again for the resolved
P7 approval, start P8/P9 or save unfinished Backend work to GitHub. Daily Sales
Values remains kept; Figma comparison and physical printing remain excluded.

### Previous checkpoint — P7 implemented locally; hosted acceptance pending at that point (October 17, 2026)

Read all seven full original user messages and the carried-forward decisions below.
P7 implements durable Daily Sales Review, void requests/decisions and event history.
It is **not yet accepted against hosted/caller-token/concurrent requirements**.
All Backend work remains local. No commit, push, PR or deployment. The user's newer
`e7bea06` (P6 done) and `da020a5` (Login wording) commits are preserved, in addition
to the earlier `91a043f` snapshot. Current branch is `Backend_Phase`.

- CLI-generated, Manila-normalized **`20261017150033_durable_sales_workflows.sql`**,
  SHA-256 **`6cdb4de6334e0e9ecb4d7bf0558f084be1ea4f7fbd52dc29282c3a079b4f8475`**.
  The ten applied SQL sources/hashes are unchanged. See
  `backend/supabase/SALES_WORKFLOWS.md` for the complete reviewable contract.
- Two caller-token RPCs provide coherent authorized sales/history pages and exact
  receipt workflow commands. One private append-only operation receipt table,
  a cash-movement review FK/index and an audit event sequence support durable
  reconciliation/chronology. No new table grants, write policies or private-helper
  execution grants. App roles cannot alter checkout activation.
- Only Owner confirms an exact verified set of paid/fulfilled Pending receipts.
  SQL recalculates expected Cash/GCash, validates exact-cent amounts and records
  counted cash, opening/addition/removal/refund adjustments, verified amounts,
  explanation, outcome, all receipt verifications and Owner identity/time. Positive
  adjustments create explicitly entered reconciliation evidence linked to the review;
  they do not execute provider refunds or invent historical occurrence times.
- Staff requests remain own/current-day scoped. Owner/Admin can reject, approve
  or directly void using their actual identity, without an Owner password for Admin.
  Every original request and renewed request/decision survives with separate reasons.
  Single stale decisions reject without writes; bulk void records one exact result
  per selected receipt (`voided`, `stale`, `ineligible`) and a shared action ID.
  Managers can reopen persisted bulk results including skipped IDs. Unexpected
  failures roll back all updates, request decisions, audits and operation storage.
- Commands resolve current roles under account → workflow → ordered sale locks;
  they share the existing account serialization with checkout, inventory and role
  changes. Actor/content-bound replay returns one saved result. Current permissions
  and Staff day scope remain enforced on replay. PT409 avoids provider conflict loops.
  Reviews and voids do not change stock, inventory revision, purchased snapshots or
  payments. Voids never imply stock returns or refunds. GCash is recorded/manual
  receipt evidence, never provider verification.
- Connected live Dashboard review queue/View all requests and Audit Trail/Staff
  history preserve filters, pagination, cross-page selections, exact receipt sets,
  all request/decision chronology and final single/bulk void warnings. Admin can
  inspect daily receipts but cannot verify/confirm. Current receipt reads show
  reviewed/voided state alongside frozen purchased/original checkout state.
  Live failures never fall back to sample data. P8 financial/report integration
  remains deferred; the preview and Daily Sales Values stay preserved.
- Dirty review/decision forms protect backdrop/Escape/X/Cancel/navigation. Failed
  writes retain counts, checkboxes, explanations and selections. Before sending,
  account-scoped session storage saves the exact command without tokens/passwords.
  Lost responses block other actions and restore the same retry after refresh;
  later failed retries cannot erase an earlier uncertain result. Closing a tab can
  clear session storage, so inspect recorded history before recreating an action.
- Local root tests pass **125/125** (103 backend/API/PostgreSQL, 22 frontend unit),
  including fifteen shared workflow SQL scenarios and committed disk close/reopen.
  Final typechecks/builds and generated-schema equality pass. The combined scoped
  browser run passes **64/64 (3.2m), exit 0**, including six P7 cases, existing live
  checkout/auth/management and affected preview review/void/export checks. This is
  not a new full-suite run or proof of hosted Auth/PostgREST/concurrent acceptance.
  Initial P7 browser failures were test locators (status versus region and duplicate
  headings); test typing was corrected. Final captures at 1440×900, 820×400 and
  320×568 have no measured page/dialog overflow; sampled visual inspection confirms
  readable history and visible review headers. Physical devices/screen readers,
  Figma comparison and physical printing have not been newly verified.
- Read-only hosted preflight finds **ten matching hashes**, four active retained
  accounts, **11 sales/payments, 43 movements, 149 audits, inventory revision 64**,
  no review/request/cash-movement rows and **checkoutEnabled: false**. These counts
  are newer than the P6 checkpoint: preserve the current state rather than restoring
  historical 41/144/revision-62 values. Neither retained Owner was signed in,
  password-tested, reset or edited. Jestine Admin / Jest and Aquino Staff / Aquino
  remain active. Existing development history is not disposable test cleanup.
- Evidence: workspace-parent `.review/october-17-p7-{before.mts,before.json,
  before.log,unit-final.log,typecheck-final.log,build-final.log,
  browser-regression.log,browser/}`. Hosted apply/acceptance status is recorded here
  when resolved; do not infer acceptance from local tests or the read-only preflight.

**Next:** apply the reviewed P7 source only through the exact-project `db:apply`
workflow when authorized, verify hosted grants/schema and rolled-back regressions,
then verify real caller-token persistence/retries/role scope and simultaneous
review/void/request decisions. Keep checkout disabled: P7 acceptance does not
require enabling new sales or reusing retained-account credentials. Use separately
authorized isolated development fixtures and retain intentional labeled history.
Do not start P8/P9 or save unfinished Backend work to GitHub.

### Previous checkpoint — P6 accepted; hosted persistence and concurrency verified (October 17, 2026)

**P6 is complete and accepted in hosted development. Checkout finishes disabled
as the user requested.** Read all seven full original messages and carried-forward
decisions below. All Backend changes remain local; no commit, push, PR, GitHub save
or deployment. The user's existing `91a043f` snapshot and prior work are preserved.

- The user explicitly answered **"Approve P6 migration and verification on this
  exact project"** for DualCounter `izdemgzdywtxhvgvsian`. This resolves the previous
  automatic approval rejection. A separate answer, **"Approve temporary test
  activation, then disable"**, authorized only the real verification window with
  isolated test accounts and retained labeled development history. It does not
  authorize leaving checkout enabled for use.
- Read-only preflight matched the nine frozen migration hashes and recorded the
  four retained active accounts, zero sales/payments, 13 movements, 53 audits and
  revision 21. The existing exact-project `db:apply` applied only
  **`20261017135332_atomic_checkout.sql`**, SHA-256
  `dfbe81cbe9d8817be5880e8f9048c016a4dc5ab5ec1ab40d1559d81cfd74ca9a`.
  All **ten** applied sources are now immutable. No applied SQL or application
  runtime source needed modification for this acceptance.
- Hosted schema/grant/policy verification passes. Real Express requests used
  Supabase Auth, caller-token PostgREST and Storage without mock transports or
  service-role catalogue/checkout writes. Separate generated test accounts
  exercised Owner/Admin/Staff checkout, Cash, GCash, all four stock models,
  kg-to-g conversion, nested bundle/shared demand, persisted purchased receipts,
  new Auth sessions after catalogue edits, actor/content-bound retries and Staff
  receipt scope. Owner completes immediately; paid/fulfilled Admin/Staff consumes
  once and awaits Owner review. GCash remains recorded evidence, never provider
  verification. Real Staff can sign/download active POS images and cannot sign
  their archived/unattached image afterward or read management inventory.
- **Three simultaneous connection races pass.** A dedicated transaction held the
  exact account advisory lock; both real PostgREST requests were observed waiting
  on it before release. Identical checkout commands return one committed receipt
  and one replay, with one sale/payment/deduction/revision. Two seven-of-ten orders
  yield one 200 and one 409, leaving three pieces. Checkout versus a physical-count
  correction yields one 200 and one 409, with only the winner's ledger and one
  revision change. Snapshot/count checks find no losing-command residue.
- The first real pass saved three valid role-test sales, then its **test lock
  monitor** incorrectly filtered provider role/query metadata. The held requests
  timed out with 57014 and rolled back; teardown disabled checkout and archived/
  deactivated that pass's fixtures. The monitor now reads the exact `pg_locks`
  advisory key. The corrected run passes all **ten real acceptance groups** and
  all three overlap checks. Failed and successful evidence are both preserved.
- The exact-project activation command enabled checkout only for verification,
  then disabled it. A real committed retry still reconciles while disabled; a new
  checkout returns 503 without writes. Application roles cannot change readiness.
  Final state confirms **`checkoutEnabled: false`**. Do not enable for use without
  a later user request, and do not substitute preview data after live errors.
- All **eight** test accounts from both passes are inactive, with **zero Auth
  sessions** remaining. Generated passwords/tokens were process-only and were not
  saved. Managers/Staff were deactivated through caller-token account commands;
  each test Owner required narrowly scoped trusted administration for cleanup
  because self-deactivation is correctly denied. Cleanup is explicitly audited.
  Neither retained Owner was signed in, password-tested, reset or edited.
- An independent final fingerprint exactly matches the pre-apply Auth/profile/
  settings snapshot for **admin, Huuujji, Jest and Aquino**, all still active.
  Nine new acceptance products and seven stock items are archived, every new stock
  balance is zero, and the existing private PNG remains. Do not hard-delete the
  deliberate history: totals are **12 Auth/profiles (four active/eight inactive),
  11 sales/payments/checkout receipts, 13 purchased lines, 14 usage rows,
  41 stock movements, 144 audit events, 51 inventory operation receipts and
  inventory revision 62**. The two account receipts and existing settings remain
  unchanged. No review/void/cash-adjustment records were created.
- **Final hosted regressions pass:** `checkout:verify` **16/16**,
  `inventory:verify` **15/15**, `permissions:verify` **11/11**, `db:smoke` **12/12**,
  and `db:verify` confirms all ten hashes and narrow grants/policies/indexes.
  Rolled-back fixtures preserve the intentional live history. Final inspection
  finds no active/stuck checkout/inventory requests. The prior **106/106 local
  root tests, typechecks/builds/schema equality and 26/26 scoped browser tests**
  remain historical evidence for unchanged runtime source; they were not rerun in
  this hosted acceptance. No new browser/physical-device/Figma/printing claim.
- Final source audit preserves all **seven full original message blocks**, all
  **ten applied SQL hashes**, and the unchanged `91a043f` snapshot. No configured
  server/database secrets were found in 173 publishable text files; no files are
  staged. Audit evidence: `.review/october-17-p6-final-{audit.cjs,audit.json}`.
- Evidence is workspace-parent `.review/october-17-p6-acceptance-{approval.txt,
  before.mts,before.json,apply.log,db-verify.log,checkout.log}`;
  `.review/october-17-p6-{live.mts,live.json,live.log,
  live-lock-monitor-failed.json,live-lock-monitor-failed.log,final-state.mts,
  final-state.json,final-state.log}`; final regression logs use
  `.review/october-17-p6-final-{checkout-verify,inventory-verify,
  permissions-verify,db-smoke,db-verify}.log`.

**Next:** P7 durable Daily Sales Review, void requests/decisions and event history,
using the full original requirements and existing account/catalogue/revision/
idempotency discipline. Owner review must never deduct stock again. Voids must
not imply stock returns or refunds. Keep the user-requested disabled checkout
state, all four retained accounts, the labeled P6 development history, Daily
Sales Values and all original messages. Figma comparison and physical-printing
verification remain removed. P8/P9 and Backend GitHub saves stay deferred.

### Previous checkpoint — P6 local checkout implementation; hosted approval resolved above (October 17, 2026)

Read the full seven original user messages and carried-forward decisions below.
P6 builds on accepted P5; it is **not yet accepted against hosted/concurrent
requirements**. All Backend work remains local. No commit, push, PR or deployment.
The existing user snapshot `91a043f` and all pre-existing work are preserved.

- New CLI-generated, Manila-normalized migration
  **`20261017135332_atomic_checkout.sql`**, SHA-256
  `dfbe81cbe9d8817be5880e8f9048c016a4dc5ab5ec1ab40d1559d81cfd74ca9a`.
  All nine applied migration hashes are unchanged. No applied SQL was edited or
  raw-reapplied. See `backend/supabase/CHECKOUT.md` for the reviewable contract.
- Five caller-token RPCs provide scoped POS configuration cards, cart-aware
  configuration availability, authoritative quotes, atomic checkout and receipt
  reads. No public table write/management read grant changes. A private operation
  receipt table and disabled-by-default activation singleton have no app grants.
  One read-only private helper plus a restricted Storage SELECT policy permits
  active POS users to sign only enabled/unarchived product images; Staff still
  cannot sign archived/unattached inventory objects or browse management data.
- Checkout uses the existing account → catalogue → revision lock order and
  deterministic batch locks. It resolves current active actors/configurations,
  recalculates selected prices/discounts/cent rounding/12% VAT, converts units,
  clamps omissions within each configured line and aggregates all shared demand.
  Fixed stock cannot be omitted. Usable batches allocate by expiry, receipt time
  and ID; expired/unsellable/archived stock is excluded. Revision updates have
  `WHERE singleton`; deliberate conflicts use PT409, not retryable 40001.
- Sale, payment, immutable purchased item/modifier/configuration/usage snapshots,
  consumption movements, movement/final audits, revision and operation receipt
  commit in one transaction. An identical actor-bound command retry returns its
  stored receipt without another deduction. Changed actor/content conflicts.
  Owner checkout completes; paid/fulfilled Admin/Staff checkout consumes once and
  awaits Owner review. Review never deducts again; voids do not imply returns or
  refunds. GCash reference uniqueness is recorded evidence, not provider payment
  verification. No live collection QR or P7/P8/P9 service is introduced.
- Protected live POS reuses the established layouts with category/SKU search,
  discounted ranges, variants/modifiers/fixed bundle disclosure, editable cart,
  Cash/GCash payment, current-day Staff receipt scope and manager receipt access.
  Server checks prevent opening options when the cart already consumes usable
  stock. Unavailable defaults stay unchecked. Large choice spaces are explicitly
  labeled for an exact chosen-configuration check; they are not falsely declared
  available or unavailable. Catalogue pages must share revision/business date.
- Failed requests retain cart, configuration, payment fields and quote. Before
  sending checkout the account-scoped session storage records its exact command,
  without tokens/passwords. A lost response restores the same retry through
  refresh; another order/navigation remains blocked until reconciliation. Later
  failed retries cannot erase an earlier uncertain outcome. The cart survives
  manager navigation; refresh warns. Closing the tab can clear session storage:
  check recorded sales before recreating an uncertain Cash checkout afterward.
- Database readiness starts **disabled**, including after migration application.
  `checkout:activate -- --project-ref izdemgzdywtxhvgvsian --enable` is a separate
  reviewed administration step after acceptance. App roles cannot activate it.
  `--disable` closes new sales while committed command replay remains available.
  Preview remains separate; real service failure never falls back to sample data.
- Final local root tests pass **106/106** (87 backend/API/PostgreSQL, 19 frontend
  unit), including sixteen shared checkout SQL scenarios and committed disk
  close/reopen. Typechecks/builds and generated-schema equality pass. Browser
  checkout acceptance passes seven new scenarios; the final combined 26-case
  authentication/management/checkout run passes **26/26 (1.3m), exit 0**. Earlier failed
  combined runs exposed outdated enabled-POS/recovery expectations, a missing
  exact accessible Variant label, and test login-limit exhaustion. Production
  limits were preserved; checkout tests now restore test-owned SDK sessions.
  These local transports are not hosted Auth/PostgREST/Storage acceptance or
  simultaneous connection contention.
- Read-only hosted preflight confirms nine matching hashes, four active profiles
  (two Owners, one Admin, one Staff), zero sales/payments, 13 movements, 53 audit
  events and inventory revision 21. No real account sign-in/password test,
  modification or durable business write was used. Existing baseline/history is
  intact. Do not describe this as a new hosted checkout test.
- **Hosted apply was rejected before execution.** Automatic approval review
  requires explicit authorization for the P6 schema/RPC/private-table/Storage
  policy migration on DualCounter `izdemgzdywtxhvgvsian`. No workaround or indirect
  execution was attempted. The nine-migration hosted state is unchanged; the
  P6 RPCs/activation table/policy are not hosted. The user must approve this
  reviewed P6 migration and verification on that exact project. Keep new-sale
  activation closed; applying this migration alone starts it disabled.
- Source audit preserves all seven full original blocks and nine applied hashes,
  finds no configured server/database secrets in 173 publishable text files, no
  staged files, and the unchanged `91a043f` snapshot. Evidence is workspace-parent
  `.review/october-17-p6-{audit.cjs,audit.json,before.mts,before.json,browser/}`.
  Captures cover 1440×900, 820×400 and 320×568 with no page overflow; sampled
  visual review confirms readable cards/payment controls. Physical devices and
  screen readers are not newly verified. Figma comparison and physical printing
  remain removed; Daily Sales Values is preserved.

**Next:** obtain explicit exact-project P6 migration/verification approval, then
apply through the existing `db:apply` command and run rollback SQL regressions, real
caller-token persistence and simultaneous duplicate/competing checkout and
checkout-versus-correction acceptance. Keep activation closed until these gates
are resolved; record intentional development fixture sale/audit history rather
than claiming a clean zero-sales baseline after real checkout. Do not start P7
or save unfinished Backend work to GitHub.

### Previous checkpoint — P5 accepted; real persistence and final regressions pass (October 17, 2026)

**P5 is complete and accepted against its recorded requirements.** The full seven original request
blocks and all carried-forward business decisions remain authoritative. P6–P9
have not been implemented in this task. P6 atomic checkout is next.

- The user privately signed in as Huuujji. A stale local Node server on IPv6
  localhost initially returned 404 for the new routes; it was stopped after its
  listeners were identified. Current Vite/API routing restored the same browser
  session without resetting or password-testing either retained Owner.
- Real browser acceptance saved a labeled Retail Item with a private PNG image,
  refreshed/restored it, verified its signed image loaded, received a separate
  three-piece batch and corrected only the first batch from ten to nine pieces.
  Another browser tab restored the session and saw the saved data and real Users
  directory. The product also received an independent modifier-library copy.
- Two real API-only issues were found and fixed without editing any applied SQL:
  **`20261017060000_inventory_revision_scope.sql`** adds `WHERE s.singleton` to
  the revision UPDATE, satisfying the hosted safe-update guard; SHA-256
  `bc56df5ac87c86d92691efb15f233cf26ab7abe49fb043a2083e05bc3b1f0990`.
  **`20261017070000_nonretryable_business_conflicts.sql`** changes only explicit
  business-conflict raises in six existing functions from `40001` to `PT409`;
  SHA-256 `01eb62e5b42b8397df1a10590b6c9361a0d3da2d69f29d35e680701e869edeac`.
  PostgREST 14.18 retried deliberate `40001` conflicts indefinitely; the new code
  returns HTTP 409 promptly. Validation, locks, revisions, rollback, grants,
  signatures and search paths remain. All nine applied sources are frozen.
  The generated contract now includes all nine sources; API error mapping
  recognizes PT409 and still scrubs provider details.
- The stuck acceptance account statements were identified through sanitized
  activity metadata and narrowly cancelled; their transactions rolled back.
  The session-pooler port timed out during the loops. Same-project transaction
  pooler 6543 was used through a process-local override for recovery/verification;
  saved connection settings and TLS validation were not changed. Final activity
  inspection finds no active/stuck PostgREST requests.
- The user supplied exact new Admin/Staff identity details and initial passwords,
  then explicitly chose **"Keep both active for my use"**. Created **Jestine Admin
  / @Jest** (Admin, `3e89616e-13d0-4c87-94cf-1de959c9ae0a`) through the existing
  trusted Auth-admin provisioning trigger, attributed to the authorizing Owner.
  Created **Aquino Staff / @Aquino** (Staff,
  `c1326a52-8854-4883-851a-8fcdc8d26d21`) through the protected HTTP account
  endpoint using the real Admin token. No invitation/verification email was sent.
  Passwords were transient process inputs only; none is recorded here, in source,
  profiles, receipts, logs or test artifacts. Do not recreate or reset these users.
- Real username/email login, Admin account-list scope, Staff management denial,
  Admin promotion denial, account creation-operation reconciliation, deactivation
  affecting an existing Staff token, reactivation, and stale profile-revision
  rejection pass. Both new accounts end active with the requested names/roles.
  A separate real Admin login saw the product and unchanged nine/three batch
  balances created in the Owner browser session. Acceptance-owned API sessions
  were signed out; the user's Owner browser session was not globally revoked.
- Real caller-token API/Storage acceptance passes for all four stock models,
  recipes/configuration links, independent library copies, invalid/forged/Staff
  write denial with an identical before/after snapshot, denied direct management
  SELECT, private image signing/download and Staff signing denial, optional-image
  clearing, and durable logout/login persistence. Two real Auth sessions raced
  on one inventory revision: exactly one committed and the other received 409
  without residue. Concurrent identical receipt commands committed once and
  returned one stored replay; changed idempotency content returned 409.
- Only labeled P5 acceptance catalogue records were archived through the caller
  commands after verification. There are now four archived products, three
  archived stock items, five archived batches and one archived library (plus its
  independent product copy). All batch balances are zero. History intentionally
  remains: 21 inventory operation receipts, two account operation receipts,
  13 stock movements, 53 audit events and one private test PNG object. Six SKU
  reservations and configuration relationships remain; no hard deletion or
  speculative Storage cleanup was performed. There are no sales/payments/reviews.
- A final private fingerprint comparison confirms both original Owner profiles,
  roles, active states, credential/email metadata and alert settings are unchanged.
  Normal sign-in/session timestamps are excluded from the credential fingerprint.
  Four real Auth/profile accounts are active: both retained Owners and the new
  requested Admin/Staff. This real acceptance intentionally changed counts;
  do not reuse the earlier two-account/empty-catalogue baseline as current state.
- Final local root tests pass **86/86** (69 backend/API/PostgreSQL, 17 frontend
  unit). New regressions verify PT409 rollback and scrubbed single-response HTTP
  409 for account/inventory/settings writes. Root typechecks/builds pass. The
  schema generator replayed all nine migrations; its unit equality check passes.
  No new whole browser suite is claimed. Browser control became disabled in Work
  settings mid-acceptance; remaining live checks used the actual Express source
  in test-owned HTTP servers and real hosted Auth/PostgREST/Storage, not mocks.
  Previously captured browser results and verification boundaries stay historical.
- **Final hosted regressions pass:** `db:verify` confirms all nine hashes and
  unchanged narrow grants/policies/indexes; `inventory:verify` passes **15/15**,
  `permissions:verify` **11/11**, and `db:smoke` **12/12**. Each SQL checker restores
  its fixture rows/temporary grants and verifies unchanged existing accounts,
  settings and table counts. The inventory checker also compares revision/private
  receipts and bucket/policy metadata. These checks leave the intentional live
  acceptance history intact; they do not claim an empty hosted database.
- Evidence: workspace-parent `.review/october-17-p5-{browser/,browser-before.json,
  browser-repair-apply.log,conflict-apply.log,conflict-unit.log,live-accounts.json,
  live-accounts-accepted.log,live-inventory.json,live-inventory.log,final-state.log,
  live-typecheck-final.log,live-build-final.log}` and the final verification logs.
  Final hosted logs are `.review/october-17-p5-final-{db-verify,inventory-verify,
  permissions-verify,db-smoke}.log`; final source/secret audit is
  `.review/october-17-p5-final-audit.json`.
  This task performed no commit, push, PR, GitHub save or deployment. An existing
  local user snapshot `91a043f` was present when work resumed and was preserved;
  subsequent task changes remain local. Keep all unfinished Backend work off GitHub.

**Next:** proceed to P6 atomic checkout as the next implementation priority.
P6 must join the same account/
catalogue lock, revision, idempotency, stock-ledger and audit discipline. Existing
live checkout/review/report boundaries remain closed. Keep Daily Sales Values;
Figma comparison and physical printing remain removed.

### Previous checkpoint — P5 migration approved, applied and hosted SQL verified (October 17, 2026)

**The P5 migration/hosted SQL gate is complete. P5 remains pending real signed-in
browser/PostgREST/image persistence acceptance.** All seven full original request
blocks and carried-forward business decisions remain authoritative; P6–P9 stay deferred.

- The user explicitly answered **"Approve P5 migration and verification on this
  exact project"** for DualCounter `izdemgzdywtxhvgvsian`. This resolves the
  previous automatic approval rejection for the reviewed P5 database/security/
  Storage change. It does not authorize saving unfinished Backend work to GitHub.
- The existing exact-target transactional `db:apply` command applied ONLY
  `20261017050000_inventory_commands.sql`, SHA-256
  `146286def00fd69d56ec96dec5023ad4da6ede361dbc7aec5cf422bfb1ee2f03`.
  All six earlier sources were skipped as exact matches. All seven applied
  migration sources are now immutable; use a new migration for later SQL changes.
- Hosted `db:verify` passes: seven matching hashes, 25 RLS tables with one
  authenticated SELECT policy each, exactly six scoped SELECT table grants,
  twelve restricted public RPC grants, one callable private role helper and no
  unindexed foreign keys. Management/profile/ledger direct grants and table
  write grants stay closed. The new private operation/revision tables and the
  private `inventory-images` bucket with its two restricted policies are applied.
- **14/14 hosted inventory scenarios, 11/11 permission scenarios and 12/12 database
  smoke checks pass.** SQL fixtures and temporary grants were rolled back.
  Inventory verification also checks bucket limits/types/policies, private/public
  counts, inventory revision, grants and protected account/settings fingerprints.
- A final independent before/after comparison confirms all public/Auth table
  counts, both real Auth/profile accounts and settings are unchanged, with seven
  matching applied hashes. Both retained accounts remain active Owners; there
  are still two audit events, no configured settings, no sales/stock movements
  and no durable catalogue fixtures. Neither Owner was signed in, password-tested,
  demoted, deactivated, replaced or edited by these checks.
- The local browser was opened at `http://localhost:5173` and shows account login
  with no active signed-in session. A private Huuujji sign-in has been requested
  to finish browser acceptance; do not ask for the password in chat or obtain a
  session by resetting/password-testing either retained Owner. An existing Vite
  server already occupies 5173; reuse it. Only the local backend API was started
  for acceptance. No application source or applied SQL changed in this step.
- Five actual hosted anonymous PostgREST checks pass: all four new P5 RPCs and
  direct product SELECT return permission denial. No token/session or hosted
  data write was used. A fresh generated-schema `--check` also passes against
  all seven local migration sources.
- The preceding 84/84 local root tests, typechecks/builds and scoped browser
  results remain historical evidence; those suites were not rerun for this hosted
  apply/documentation step. Hosted SQL/anonymous checks do not establish a new signed-in
  Auth/PostgREST/Storage round trip or simultaneous multi-connection contention.
- Evidence: workspace-parent `.review/october-17-p5-acceptance-{approval.txt,
  before.json,before.log,apply.log,db-verify.log,inventory.log,permissions.log,
  db-smoke.log,after.log,http.log,schema.log,audit.json}` and
  `october-17-p5-acceptance-state.mts`.
  All Backend work remains local/uncommitted on `Backend_Phase`; no commit,
  push, PR, GitHub save or deployment was performed.

**Next:** finish real signed-in development-account Users/Inventory persistence,
refresh/login/another permitted session, denied/invalid requests and optional-image
acceptance. The approved migration must not be reapplied through raw SQL or edited.
Use caller-token services; keep both Owners unchanged. Record any intentional
development fixture rows/audit/storage artifacts rather than claiming a clean
before/after baseline after real CRUD. P5 remains pending until this is resolved;
only then begin P6. Keep Daily Sales Values; Figma comparison and physical printing
remain removed. Keep all Backend work off GitHub.

### Previous checkpoint — P5 local CRUD verified; hosted approval required (October 17, 2026; resolved above)

**P5 implementation and local verification are complete; hosted acceptance remains
unfinished.** Follow all seven full original request blocks and carried-forward
business decisions below. P6–P9 remain deferred. See `backend/supabase/CRUD.md`
for the command contract, safeguards and verification limits.

- NEW `20261017050000_inventory_commands.sql`, SHA-256
  `146286def00fd69d56ec96dec5023ad4da6ede361dbc7aec5cf422bfb1ee2f03`, adds a coherent
  inventory snapshot, protected aggregate commands, scoped Auth-email/account
  listing and account-creation operation receipts. The six applied migrations
  remain hash-identical; never edit an applied source.
- Commands use the caller token and resolve the current active profile in SQL.
  Owner/Admin manage inventory; Owner manages all accounts, Admin Staff only.
  No public table writes, management SELECT grants or service-role business access
  are added. Four narrow authenticated RPCs join the existing eight. Private
  operation/revision tables have no application grants. P5 service readiness is
  advertised by the applied database contract, not an optimistic server flag.
- Product/stock/batch/recipe/library/copy/variant/bundle saves commit together with
  actor-attributed audit. Exact decimals, counted units, ISO dates, SKU reservation,
  ID ownership, defaults/choice limits, duplicate configurations and nested cycles
  are checked. SKU-only inputs and stable relationships remain. Manual enablement
  stays separate from computed availability; disabled children make bundles
  unavailable. Fixed retail/variant/bundle stock cannot be omitted by a modifier.
- Receiving, count corrections and removals append distinct Receipt/Correction/
  Removal movements; no total quantity column overwrites stock history. Other
  batches retain their quantities/dates. Empty/removed records are archived;
  referenced configurations, sale snapshots and movement/audit history survive.
  Reasons are required for stock changes. Account/catalogue locks, a coarse global
  inventory revision and stored operation receipts reject stale writes and prevent
  an explicit retry after a lost receipt response from adding stock twice.
- Real manager routing now uses the existing Users/Inventory screens and protected
  services, with loading/errors, filters, dirty-navigation/refresh protection and
  pending controls. Failed saves retain fields, files, wizard passwords and library
  drafts. Background session checks keep an unchanged authenticated editor mounted.
  Actual access loss closes it; role changes clear its data scope. Preview remains
  separate, labeled and in memory, with no fallback after a real service failure.
- Users supports scoped listing, real password-based creation, profile/role edits,
  deactivation/reactivation and retained inactive rows. Auth owns credentials/email;
  no password/hash is copied into profiles, audit or operation receipts. Creation
  reconciles its original operation ID after uncertainty; profile updates use their
  returned revisions. The last active Owner and signed-in account remain protected.
  Email is read-only in Manage; creation sends no invitation/verification email.
- Optional PNG/JPEG/WebP images (2 MB maximum) use a NEW private Storage bucket.
  The proposed policies allow active managers to read/sign and insert immutable
  objects in their own UUID folder, with no update/delete policy. The API checks
  file signatures and SQL checks object references. Upload/signing uses the caller
  token. Removing an image clears the reference; uncertain/unattached uploads are
  retained rather than deleting a possibly committed image.
- **Final local checks:** root `npm test` passes **84/84** (67 backend/API/PostgreSQL,
  17 frontend unit), including **14** shared management SQL scenarios and a new
  command-based disk close/reopen test. Root typechecks/builds and generated-schema
  `--check` pass. The broad browser run was **235 passed / 1 failed (8.9m)**; the
  only failure was the preview deletion progress label, which was restored.
  The affected rerun then passed 72 cases, with a layout test hitting the unchanged
  login limiter and the following case skipped. That test now restores its test
  session. A fresh **18/18** management/request-state run passes (1.0m), followed
  by a final **9/9** management run (41.3s) after reason-field styling/clean captures.
  All **238** browser cases are covered across these runs; no single clean final
  238-case full run is claimed. Local HTTP/browser permissions required approved
  execution outside the sandbox; production limits were not weakened for tests.
- Six final captures at 1440×900, 820×400 and 320×568 cover saved Inventory and the
  retained stock editor. Geometry checks find no horizontal page overflow. Sampled
  visual review confirmed readable fields/actions; the new reason field was moved
  into the existing styled editor grid. Captures now scroll to zero before capture
  to avoid sticky-navigation stitching artifacts. Physical devices, real screen
  readers and other browsers are not newly verified. Figma comparison and physical
  printing remain removed; Daily Sales Values and existing exports stay preserved.
- **Hosted apply was rejected before execution.** Automatic approval review says
  applying this persistent migration changes a shared hosted database and its
  security/Storage boundary, and requires explicit authorization for DualCounter
  `izdemgzdywtxhvgvsian`. No workaround or indirect execution was attempted. The
  P4-specific approval is historical evidence, not approval of the new P5 migration.
  Obtain explicit exact-project P5 migration/verification approval; do not request
  a GitHub save. The new RPCs/private tables/bucket/policies are not hosted yet.
- A final **read-only hosted comparison passes**: exactly six matching applied
  hashes, unchanged Auth/profile/settings fingerprints and all application/Auth
  table counts. Both retained accounts remain active Owners; audit events remain
  two, settings unconfigured, sales/stock movements zero. Neither account was
  demoted, deactivated, replaced, signed in or password-tested. No hosted fixture
  users/catalogue/movements/uploads were created. Local browser tests use actual
  Express/PostgreSQL behind test-owned Auth/Storage transport; they are not proof
  of new hosted Auth/PostgREST/Storage round trips or multi-connection contention.
- Evidence: workspace-parent `.review/october-17-p5-{before.json,before.log,
  apply-rejection.txt,hosted-unchanged.log,unit-acceptance.log,typecheck-final.log,
  build-acceptance.log,browser-full.log,browser-final.log,browser-acceptance.log,
  browser-management-final.log,audit.json}` and `.review/october-17-p5/` captures.
  Final audit preserves all seven original request blocks and six applied sources,
  checks publishable text for saved server/database secrets, and confirms no staged
  files. Work remains local/uncommitted on `Backend_Phase`; no commit, push, PR,
  GitHub save or deployment was performed.

**Next:** approve/apply ONLY this reviewed P5 migration on the exact DualCounter
project, then run `db:verify`, `inventory:verify` (14 rolled-back SQL scenarios plus
private bucket/policy metadata), `permissions:verify` and `db:smoke`. Compare real
accounts/settings/counts before and after. Complete real development-account
browser/PostgREST/image persistence acceptance using a private signed-in session;
do not password-test or modify either retained Owner to obtain it. Keep P5 pending
until that acceptance is resolved; P6 checkout must join the same revision/lock
and stock-history discipline before it opens. Keep all Backend work off GitHub.

### Previous checkpoint — P4 accepted; hosted permissions verified (October 17, 2026)

**P4 is complete. P5 protected Users/Inventory persistence is the next unfinished
priority.** The full seven original request blocks and carried-forward decisions
remain the requirements reference; none was replaced with a continuation summary.

- The user explicitly answered **"Approve the P4 migration and verification on
  this exact project"** for DualCounter `izdemgzdywtxhvgvsian`. This resolves the
  previous automatic approval rejection. It authorizes this hosted database step;
  unfinished Backend code/documentation still stays local and off GitHub.
- The existing exact-target `db:apply` tool applied only
  `20261017040000_business_permissions.sql`, SHA-256
  `43d09db1222bd52083f248a4de5bccce95d58670868ea0e1e529939784102f87`.
  All five earlier sources and the newly applied sixth source are unchanged.
  Never edit any applied SQL; use a new migration for subsequent schema changes.
- Hosted `db:verify` passes: six matching migration hashes, 25 RLS tables with
  one authenticated SELECT policy each, exactly six authenticated SELECT table
  grants, one callable private role helper, eight restricted public RPC grants,
  no table write grants/policies and no unindexed foreign keys. Management,
  profile and ledger direct grants stay closed. The first verification attempt
  exposed node-postgres returning `pg_policies.roles` (`name[]`) as text. Fixed
  only the verifier query to select `roles::text[]`; the hosted rerun passes.
- **11/11 hosted permission scenarios pass** using synthetic SQL fixtures
  entirely within rolled-back transactions. They cover the full role matrix,
  Staff ownership/current Manila day and child rows, cross-account/day denial,
  forged metadata, inactive/unlinked/anonymous/service-role denial, scoped POS,
  denied writes, role changes, Owner-only settings/revisions/actual actor and
  settings/audit atomic failure. These checks do not provision real Auth users.
- **12/12 hosted database smoke checks pass.** Final before/after comparison
  confirms every application/Auth table count and private fingerprints of both
  real Auth/profile accounts and settings are unchanged. Both admin and Huuujji
  remain active Owners; settings remain unconfigured, audit events remain two,
  and sales/stock movements remain zero. No durable fixture rows or temporary
  grants remain. Neither real account was demoted, deactivated or password-tested.
- Fresh root tests pass **67/67** (52 backend/API/PostgreSQL, 15 frontend unit).
  Root typechecks/builds and generated schema `--check` pass. Backend typechecks
  pass again after the verifier fix. Local HTTP/DNS sandbox restrictions required
  approved reruns. No runtime UI changed or browser suite was rerun; the previous
  **13/13** affected Auth/login and older broad browser results remain historical.
  Hosted SQL checks do not establish new hosted Auth/PostgREST behavior or
  simultaneous account-write contention; sequential last-Owner mutation cases
  remain disposable-only. These limits are not claimed as passing checks.
- Evidence: workspace-parent `.review/october-17-p4-acceptance-{before.json,
  before.log,apply.log,policy-inspect.log,db-verify.log,permissions.log,
  db-smoke.log,after.log,unit.log,typecheck.log,typecheck-final.log,build.log,
  schema.log,audit.json}`. The final audit preserves all seven original-message
  blocks and all six migration hashes and checks publishable files for saved
  server/database secrets. Backend remains uncommitted on `Backend_Phase`;
  no commit, push, PR, GitHub save or deployment was performed.

**Next:** implement P5 against the existing protected services and durable schema:
Users account list/management plus Inventory products, ingredients/stock, batches,
recipes, modifier library/copies, variants and bundles. Preserve P2A request/draft
handling, SKU-only inputs, all stock relationships, optional images, existing
filters, preview isolation and test-owned Vite teardown. Archive referenced rows;
stock changes require attributed movements and atomic audit. Prove persistence
across refresh/login and another authorized session, plus unchanged data on
denied/invalid requests. P6–P9 remain later work. Keep Daily Sales Values; Figma
comparison and physical-printing verification remain removed.

### Previous checkpoint — P4 local permissions; hosted application awaiting approval (October 17, 2026; resolved above)

**P4 implementation and local verification are complete; hosted acceptance is
pending.** Follow all seven original request blocks, carried-forward decisions
and the accepted P3 checkpoint below. P5–P9 are still unfinished. See
`backend/supabase/AUTHORIZATION.md` for the exact matrix, routes, grants and limits.

- A NEW `20261017040000_business_permissions.sql` adds database-owned permissions,
  current active-profile checks, 25 authenticated SELECT policies, scoped sales
  reads, a selling-card POS projection and Owner-only revisioned alert settings.
  The five already-applied migrations are frozen. The generated frontend contract
  includes the new source hash; no columns or stock relationships were changed.
- API business authorization calls caller-scoped SQL; it never trusts client
  role/name/actor/date metadata. Staff can see only their own current Manila-day
  sales/items/options/payments and their own requests on those sales. Cross-account,
  yesterday/tomorrow and inactive/unlinked identities are denied. Role changes apply
  to the next request using the same token. Owner/Admin void/review permissions use
  their own identity, with no Owner password for Admin. Daily Sales Review confirmation
  and alert settings remain Owner-only. Existing P3 account commands retain their
  own transactional checks, last-active-Owner and signed-in-account protections.
- **Narrow grants:** an initial blanket SELECT grant was rejected by automatic
  approval review as too broad. It was replaced with six explicit authenticated
  SELECT grants for sales/items/purchased options/payments/requests/settings, each
  governed by its RLS policy. Management/profile/ledger tables keep zero direct
  grants. No table write grants or write policies; anon/service-role business
  access remains revoked. Only the current-role private helper is callable;
  five new authenticated RPCs join the three existing account RPCs.
- The settings RPC serializes with account changes and settings writers, rechecks
  active Owner, compares revisions, validates bounds and atomically records the
  actual actor/name/role plus before/after audit. Stale/invalid/denied/audit-failed
  writes change nothing. No fake setting/Owner is seeded. Alert delivery is P9.
- New API reads cover access capabilities, scoped sales/requests, POS selling
  cards and settings. Selling cards explicitly report `checkoutReady: false`;
  they expose no physical stock, batches, recipe inputs or library drafts.
  Dashboard/Inventory/Reports/checkout/void/review command boundaries return 403
  for denied roles and 501 for permitted roles until their actual services are
  implemented. Permission checks alone do not execute those workflows.
- **Hosted apply blocked:** the exact-target `db:apply` command was rejected
  before execution. Automatic approval review interpreted the Backend-local
  instruction as withholding authorization for persistent hosted database changes.
  No alternate route retried or bypassed this rejection. Ask for explicit approval
  to apply this reviewed P4 migration to DualCounter `izdemgzdywtxhvgvsian`; do not
  request a GitHub save. Until approval/application, hosted P4 policies/RPCs do not
  exist and hosted verification of this migration is not claimed. Existing P3
  login/profile/account lifecycle stays compatible with the five hosted sources.
- **Verification:** final root checks pass **67/67** (52 backend/API/PostgreSQL and
  15 frontend unit), including all **11/11** permission scenarios. Root
  typechecks/builds and schema `--check` pass. The
  sandbox initially blocked local HTTP test connections; the approved rerun passed.
  Affected authentication/login browser checks pass **13/13 (23.0s)**. No newer
  broad browser-suite run is claimed. Read-only hosted verification confirms the
  exact five applied hashes, two active Owners/profiles, zero sales/stock movements,
  zero direct business grants and zero business policies: P4 is still unapplied.
  Shared SQL scenarios are ready for hosted rollback verification via
  `npm run permissions:verify --workspace backend` after migration approval.
  These are not proof of hosted Auth/PostgREST P4 behavior or multi-connection
  account contention. Sequential last-Owner protections remain disposable-only;
  neither real Owner was demoted, deactivated, replaced or password-tested.
- Local evidence: workspace-parent `.review/october-17-p4-{before.json,unit-final.log,
  build.log,browser.log,db-before.log,hosted-status.log,audit.json}`. All seven full original-message blocks
  and five applied SQL hashes are preserved. Backend stays local/uncommitted on
  `Backend_Phase`; no commit, push, PR, GitHub save or deployment. P2A draft/error
  protection, SKU-only editors, all stock models/copies, optional images, assets,
  preview notices, Daily Sales Values and test-owned Vite teardown are preserved.
  Figma comparison and physical-printing verification stay removed.

**Next:** obtain exact-target hosted migration approval,
then apply/verify P4 (migration hashes, grants/policies, rollback permissions and
existing database smoke checks). Only then start P5 Users/Inventory persistence.

### Previous checkpoint — P3 accepted; DualCounter and both Owners retained (October 17, 2026)

**P3 acceptance is complete.** Hosted settings and real account/browser checks pass;
the user confirmed email receipt and the full same-browser password-change/login
round trip. **P4 enforced business permissions is next, followed by P5 CRUD.**
The following user decisions supersede the previous checkpoint's pending approvals
and temporary-account replacement plan:

- The user explicitly approved disabling public signup, Site URL
  `http://localhost:5173`, and exact redirect `http://localhost:5173/auth/callback`
  on this specific project, including its dashboard `main PRODUCTION` label.
  All three settings were saved and verified. The initial URL-setting rejection
  was resolved by that exact-target approval; no alternate method bypassed it.
- The user explicitly approved **Owner** access for the additional **Huuujji**
  testing account, ID `601ce4ed-8c72-49ed-83e0-294c3cdba2b4`. It has the supplied
  name/email in Auth/profile. Its password was passed only to a transient process
  and Supabase Auth, never saved in source, environment files or this handoff.
  Provisioning used the existing trusted administration boundary and retained
  account-creation audit. No sample person became a real identity.
- **Keep admin active and unchanged.** The user's correction explicitly says not
  to remove admin and to use the real account for testing only. The retained admin
  ID is `e84626ab-c64f-4945-b978-1cd743fcd954`. Do not deactivate, delete, demote,
  replace it, or change its password based on older replacement instructions.
  Ten live checks verify both email/username API login, Owner profile/restoration,
  unchanged admin, exactly two Auth users/profiles, and zero sales/stock movements.
  Real browser Huuujji login, refresh/restoration and logout were also verified.
- The live verification command now avoids real Owner demotion: that old probe
  could succeed after adding a second Owner. Last-Owner mutation coverage stays in
  disposable SQL tests. Recovery/password change is skipped unless explicitly
  opted into with `--allow-password-change`; normal verification logs out only its
  own session. This revised command has not been rerun on the user's account.
- Fixed a reproduced callback defect: invalid/expired codes could reuse an older
  signed-in session as recovery proof. Recovery now explicitly exchanges its PKCE
  code, requires the SDK's matching `PASSWORD_RECOVERY` event, then verifies the
  active application profile. Automatic SDK URL exchange is disabled. Empty/error
  callbacks, missing verifiers, expired exchanges and non-recovery codes cannot
  open the reset form. URL parameters are scrubbed immediately; StrictMode shares
  one exchange, and `sb_flow_id` selects the correct verifier slot.
- A real reset was first requested from the local **in-app browser** and inbox
  receipt was user-confirmed. The first opened link reported invalid/expired;
  PKCE requires the same browser storage that requested it. After instructions to
  request a fresh link at `http://localhost:5173` in the browser used to open email,
  the user confirmed **"Password change and login both worked"**. This final
  emailed round trip is human-verified in the user's browser, not an agent browser
  capture. The user entered/submitted the new password privately; its value was
  not requested, recorded or changed by the agent. Use a fresh same-browser link
  for future recovery; sample code remains unconfigured-preview-only.
- The user asked to rename the hosted project to **DualCounter**. The display name
  is saved and dashboard-verified. The read-only Project ID/API reference remains
  `izdemgzdywtxhvgvsian`; URLs, connection settings and migration history stay valid.
  The organization and repository remain Vertwell. This is a name change, not a
  project migration, domain purchase, deployment or whole-application rebrand.
- **Final checks:** 50/50 root unit/API/PostgreSQL tests; 13/13 affected
  Auth/login browser cases (22.6s), including six new callback cases; root
  typechecks/builds and schema `--check` pass. All five new invalid-callback checks
  failed before the fix and pass afterward. Windows browser/HTTP sandbox limits
  required approved reruns. The previous 223-case broad browser run remains
  historical; no new full-suite run is claimed. Hosted db:verify passes with all
  five migration hashes, 25 RLS tables, two Auth users/profiles, zero sales/stock
  movements and unchanged restricted grants. The final backend typecheck also
  covers the safer live-verification command; that command was not rerun on the
  user's account after the private password change.
- Evidence is in workspace-parent `.review/october-17-p3-acceptance-*`,
  `october-17-p3-callback-{before,after,final}.log`, and
  `.review/october-17-p3-acceptance/` screenshots. The ignored one-time provisioning
  script contains no credentials. The local Auth preview remains on 3001/5173 for
  the user's testing session; its owned process PID is 34800. The browser test
  runner closed its own 5180 server. Temporary agent tabs were closed after the
  emailed test; the user's regular browser/session was left alone.
- All seven original request blocks and five applied SQL sources are preserved.
  Backend work remains local/uncommitted on `Backend_Phase`; no commit, push, PR,
  GitHub save or deployment. P4/P5 and later business services remain closed.

### Previous checkpoint — P3 authentication/account lifecycle (October 17, 2026)

**P3 implementation and live token/password checks are complete; P3 acceptance is
partial until hosted Auth configuration and actual emailed recovery are verified.**
Finish these P3 gates before P4 business permissions and P5 CRUD. The full original
Backend-start message, all carried-forward decisions and original frontend
messages govern this work; P1/P2/P2A remain complete.

- Real email/username login resolves the active database profile/actual role.
  Restoration/refresh/logout, cross-tab events and focus/60-second revalidation
  are implemented. Configured login opens a verified account screen while P4/P5
  are closed; it never enters a sample Staff workspace. Open preview stays separate.
- Protected account creation/profile updates/deactivation enforce Owner all roles,
  Admin Staff-only and Staff denial. Current revisions, unsupported-field rejection,
  last-active-Owner and signed-in-account protections, serialized writes and atomic
  audit are implemented. Invitations/email changes and Users UI integration are P5.
- Auth/profile/audit creation is transactional. Live verification exposed Auth
  applying admin metadata after INSERT; a second NEW migration handles that UPDATE.
  The incomplete initial trusted bootstrap was explicitly repaired and verified.
  Real duplicate-profile creation now leaves no Auth residue. All five applied
  migrations are hash-verified; no applied source was edited.
- PKCE recovery verifies the active profile, changes the real password and globally
  logs out. Invalid/expired callbacks report an error and scrub URL parameters;
  StrictMode effect replay is covered. Sample 123456 stays unconfigured-preview-only.
  The real password-change confirmation survives the return to login.
- **Requested temporary Owner:** name `admin`, username `admin`, email
  `admin@gmail.com`, ID `e84626ab-c64f-4945-b978-1cd743fcd954`. The supplied
  replacement password is Auth-managed, never copied into source/profiles/handoff.
  Recovery checks restored and verified that requested password. Replace this
  temporary account after the real Owner's active account/login is verified:
  deactivate under the real Owner and retain history. Hard profile deletion and
  last-Owner removal remain blocked. No preview person became a real account.
- Ignored `backend/.env` now holds the existing server secret/publishable settings;
  ignored `Frontend/.env.local` contains only URL/publishable settings. The separate
  database administration password stays in `backend/.env.database.local`, outside
  request handlers. Browser regression tests ignore runtime credentials and preserve
  the test-owned Vite teardown. Direct application-table/private-helper grants remain
  zero; only the three documented account RPC grants exist. All 25 tables keep RLS.
- **Hosted acceptance pending:** signup is enabled, Site URL `http://localhost:3000`,
  and no redirect URLs exist. Automatic approval review rejected disabling signup
  because this persistent Auth-policy change lacked explicit authorization. No
  workaround changed it. Request approval to disable public signup, set Site URL
  `http://localhost:5173`, and allow exact redirect
  `http://localhost:5173/auth/callback`. Until configured, emailed recovery can
  return to the wrong local port. Actual email delivery/inbox receipt and complete
  emailed-link recovery remain unverified; no email was sent to admin@gmail.com.
- **Verification:** root tests pass 50/50 (35 backend/PostgreSQL + 15 frontend unit).
  **16/16** live lifecycle checks pass for username/profile/restoration, invalid
  credentials/tokens, denied self-deactivation/last-Owner demotion, rollback, real
  one-time recovery/password update, logout and revoked refresh denial. A separate
  live revoked-access-token probe returns 401 after global logout. The broad browser
  run passed **223/223 (9.2m)**. A subsequent recovery-success
  notice change is verified by the final **7/7 Auth/login rerun (15.2s)**; no newer
  full-suite run is claimed. Final root typechecks/builds and schema check pass.
  Real browser Owner login/refresh/logout is verified;
  desktop/320px account captures were inspected with no phone page overflow. Hosted
  counts: one Auth user/profile, zero sales/stock movements. db:verify and **12/12**
  rolled-back db:smoke checks pass. The audit confirms all seven original blocks
  match HEAD, the first three SQL hashes are unchanged, runtime files are ignored
  and 247 publishable files contain no saved database/server/Owner password.
  Evidence: `.review/october-17-p3-{audit.json,live-auth.log,browser.log,
  auth-browser-final.log,unit-final.log,db-verify.log,db-smoke.log}` and screenshots
  in `.review/october-17-p3/` (workspace parent). See AUTHENTICATION.md for boundaries.
  Temporary browser tabs and local servers were closed; ports 3001/5173/5180/5181
  were verified without listeners.
- **Save boundary:** work stays local/uncommitted on `Backend_Phase`. No commit,
  push, PR, GitHub save or deployment. Existing P2A changes, all seven original
  message blocks, SKU-only inputs, stock models/relationships, independent copies,
  Owner-only settings, assets/licenses and preview behavior are preserved.

### Previous checkpoint — P2A frontend integration preparation (October 17, 2026)

**P2A preparation is complete and verified locally. P3
Authentication is the next implementation priority, followed by P4 Roles and P5
protected Users/Inventory CRUD.** This follows the complete original Backend-start
message and the user's decision to place frontend integration after database setup.
It does not repeat completed frontend fixes or enable protected actions early.

- `backend/supabase/INTEGRATION.md` records actual schema-to-frontend mappings,
  existing versus future API boundaries, request/error contracts, command ownership,
  identifiers, decimal/date/unit handling and the remaining P3–P9 dependencies.
- `backend/scripts/integration-schema.ts` builds a disposable PostgreSQL database
  from the exact three migration sources and generates a 25-table read contract in
  `Frontend/src/lib/data/database.generated.ts`. Nullability, numeric strings and
  normalized content hashes are verified against SQL. No hosted schema changes.
- `Frontend/src/lib/data/{contracts,decimal,mappers}.ts` prepares versioned
  inventory/account decoding. All four stock models, independent library/product
  modifiers, signed omissions, fixed bundle variants/options, SKU relationships,
  unlisted retail stock, canonical batch balances and nullable Hobby dates map to
  the existing UI. The decoded source retains revisions, image paths and provenance.
  Incomplete/duplicate/malformed responses and unsafe decimal conversion fail
  explicitly. Email belongs to an authorized Auth projection; no password or hash
  is copied into a profile/account. No new Item Code or obsolete stock panel.
- `api-client.ts` and the existing `api.ts` supply session-token requests, typed
  validation/conflict/access/network errors, cancellation, no-content responses,
  disabled caching/redirects and no automatic write retries. The business bridge
  rejects reads before any request until P3–P5 are implemented; no runtime flag
  opens unfinished services or silently substitutes sample data after a live error.
- `request-state.ts` prepares scoped loading/reload/error states, cancellation,
  stale-response suppression and duplicate-save prevention. Users create/edit/delete
  and Inventory record saves/receiving/removals await callback success before
  clearing/closing. Rejected saves preserve the mounted draft, wizard passwords,
  batch quantity/dates, selections and dirty/discard protection; pending forms
  disable their controls. Modifier-library/upload service completion and global
  navigation/session reconciliation remain part of P5's actual integration.
- **Live boundary:** normal `npm run dev` still uses labeled sample data and resets
  on refresh. P2A is preparation, not real Auth, email delivery, HTTP CRUD or durable
  business persistence. Existing configured-login profile routing is still P3.
  Database application grants/RLS restrictions, hosted data, runtime settings and
  applied migration sources remain unchanged. No live credentials were needed.
- **Verification:** root `npm test` passes **38/38** (27 existing backend/database
  checks and 11 new SQL/transport/mapping checks). The broad browser run passes
  **219/219 (8.3m)**, covering all 210 existing cases plus nine new preparation
  cases. A small subsequent removal-dialog error reset is verified by the final
  **9/9 focused run (13.0s)**, including close/reopen/retry without a stale error;
  no newer full-suite run is claimed. Final root typechecks (including integration
  test/harness source), both builds and generated-schema `--check` pass. Playwright
  now explicitly collects `*.spec.ts`, keeping Node unit checks in `npm test`.
  The initial sandboxed browser launch was blocked by Windows; approved browser
  runs succeeded. Initial harness selectors were corrected to search paginated
  rows and distinguish the loading status from output; all final cases pass.
  Retained-error editor captures at 1440×900 and 320×568 were visually reviewed;
  they preserve readable controls and show no horizontal page overflow. Captures
  are in `.review/october-17-p2a/`; logs are `.review/october-17-p2a-*.log`.
  `.review/october-17-p2a-audit.json` confirms all seven full original-message
  blocks match HEAD after newline normalization, applied SQL/HEAD are unchanged,
  the saved credential file is ignored and 237 publishable files contain no saved
  database password. `git diff --check` passes.
- **Save boundary:** all work from this continuation remains local and uncommitted
  on the existing `Backend_Phase` branch. No commit, push, PR or deployment. Earlier
  repository checkpoints were present when this continuation started; they do not
  authorize a new Backend save. All original verbatim message blocks stay intact.

### Previous checkpoint — Backend database priority applied and verified (October 17, 2026)

**The new user request supersedes the P0 stop-for-review instruction.** Start with
the database, following the original messages and actual frontend behavior, not
just an older continuation script. **No Backend commits, pushes, PRs or GitHub
saves while Backend tasks remain unfinished.** The P0 save was a completed
frontend bridge; its one-time authorization does not carry into this phase.

#### Original October 17 Backend-start user message — verbatim

```text
Read HandsOff.md and implement the October 17 highest-priority. Follow my full original message, not just the continuation script.
now that the system is saved next thing we do is the database Priority task first

also now that we are in phase Backend we will not save it in the github unless we have finish all the task in the backend add this in the handsoff

we are now starting the phase Backend
```

#### Database checkpoint — implementation and hosted completion

- **P1 complete:** `backend/supabase/DESIGN.md` maps the actual frontend workflows,
  all four stock models, independent modifier copies, signed recipe omissions,
  fixed bundle options/nesting, SKU ownership, batch dates/units, preserved sale
  snapshots, every database column and the Owner/Admin/Staff permission matrix.
  Explicitly deferred accounting/refund/costing/revenue decisions remain open.
- **P2 foundation applied and verified:** three ordered transactional migrations under
  `backend/supabase/migrations/` create 25 tables, exact numeric domains, Auth-linked
  profiles without passwords/email, a case-insensitive SKU namespace, relational
  configurations, sales/payments/usage, stock/cash movements, reviews/requests,
  audit and alert settings. No Item Code, real Auth identities or sample sales.
- **Access remains restricted:** RLS on every application table; explicit revokes
  for PUBLIC/anon/authenticated/service_role; no public RPC or privileged helper
  execution. P3/P4 permissions and account protections are not yet implemented.
- **History/stock:** deferred SKU/bundle graph checks, compatible-unit and date
  checks, append-only history/delete/TRUNCATE guards, separate archive states and
  canonical stock snapshots. A movement locks its batch, rejects negative physical
  stock or expired/unsellable consumption, and appends its audit event atomically.
  Balances derive from movements; review/void do not implicitly restore/deduct.
  Full-cart checkout and real multi-connection concurrency remain P6 work.
- **Development data:** `seeds/development.sql` requires an explicit session opt-in
  and creates only catalogue examples/empty batches. No profiles, Auth credentials,
  payments, sales or invented opening balances. Test identities exist only in the
  disposable test bootstrap.
- **Verification tooling:** PGlite is a backend dev dependency, used to execute
  PostgreSQL SQL directly. `npm run test:database --workspace backend` runs the
  database suite; root `npm test` includes it plus the five existing API checks.
  Tests cover clean migrations/replay, durable close/reopen, access/RLS denial,
  keys/relationships, stock models/units/dates, independent copies, bundle cycles,
  idempotency/reference uniqueness, snapshots, ledger/audit rollback and reviews.
- **Live boundary / next unfinished priority:** the user-created Vertwell hosted
  development database is applied and verified; see the connection checkpoint
  below. Live checks cover schema/constraints, role/privilege denial, transactional
  rollback, exact migration history and advisors. Real Auth login/provisioning,
  PostgREST requests, API/frontend integration and simultaneous full-cart checkout
  are not verified. At this database checkpoint P2A was next; the current P2A
  checkpoint above now makes P3 → P4 → P5 the unfinished sequence.
- **Save boundary:** all changes remain local and uncommitted; no GitHub write or
  deployment. README and database README carry the same Backend no-save rule.

#### Supabase connection and hosted verification — October 17

**Hosted setup choice:** the user selected option **1 — new hosted Supabase
development project**, rather than reusing a project or installing local Supabase.
The user then connected and created the organization and project named **Vertwell**
(the earlier suggested `vertwell-dev` name was not used). This authorizes continuing
database setup in that new project. The no-GitHub-save rule still applies.

- **Organization:** Vertwell, ID `lhbospoeusmomtbxmwqk`.
- **Project:** Vertwell, reference `izdemgzdywtxhvgvsian`;
  [dashboard](https://supabase.com/dashboard/project/izdemgzdywtxhvgvsian),
  API URL `https://izdemgzdywtxhvgvsian.supabase.co`.
- **Environment:** Singapore / `ap-southeast-1`, PostgreSQL **17.11**, healthy,
  user-created Free project. Supabase labels its default main branch PRODUCTION;
  this new empty project is being used for **development**, with no production
  deployment/cutover. It has no GitHub repository connected.
- **Password saved locally:** the user supplied the database password and asked
  that it be retained for handoff. Its value is stored in the ignored
  `backend/.env.database.local` as `VERTWELL_DEV_DATABASE_PASSWORD`, with the
  project/session-pooler administration settings. This handoff records the location
  instead of copying the credential into a tracked file destined for a future
  GitHub save. Do not print it in logs, SQL, documentation or browser screenshots;
  never copy it to Frontend or any `VITE_*` variable. No passwords were changed.
- **Connection:** dashboard-confirmed session pooler host
  `aws-0-ap-southeast-1.pooler.supabase.com`, port 5432,
  username `postgres.izdemgzdywtxhvgvsian`. TLS certificate verification succeeds
  using the official dashboard CA in `backend/supabase/certs/`; no insecure TLS
  override or machine-wide certificate change was used.
- **Migration state:** three files applied and recorded in
  `supabase_migrations.schema_migrations`; repeated apply skips matching files
  and rejects hash drift. The original first two files remain unchanged after
  application. A CLI-generated third migration adds five unit-FK indexes found
  by verification; its generated timestamp was normalized to Manila before
  application to follow the initial legacy-numbered October 17 migrations.
  The dashboard lists all three versions. Its date cells show Unknown for the
  first two legacy 12-digit versions; their version/name/content hashes are
  verified. Do not rename applied migrations merely to change that display.
- **Applied hashes:** `202610170001_foundation.sql` =
  `e805402321cff17dacf4b419a558e361f3d65efe2bccef6741373c3218f5e821`;
  `202610170002_integrity.sql` =
  `ad3423675155db2bdfa594d67119e4d9a21d66eccc7e50df439ed8c93367c057`;
  `20261017015959_unit_reference_indexes.sql` =
  `a21203ea1a06a77f44b47e8e8b9f6423e1d28c3625ba4f24a1b32901975f2628`.
- **Live schema verification:** all **25** business tables have RLS; zero
  application table grants, zero private-helper execution grants, zero unindexed
  foreign keys. The six unit constants are the only reference data inserted.
  No development seed, illustrative sale, real account or opening stock was saved.
- **Live smoke verification:** **12 checks passed** using a single transaction
  rolled back afterward. Tests cover the real Auth PK relationship (synthetic
  SQL fixture only), SKU uniqueness/link ownership, stock limits/counts/idempotency,
  immutable snapshots/audit, atomic rollback, archival, Manila dates, void stock
  preservation, all three database-role denials and RLS after a temporary grant.
  All application/Auth row counts and temporary grants were restored. This is
  not evidence of real Auth login, email delivery or account provisioning.
- **Advisors:** security and performance each show **0 errors / 0 warnings**.
  Security has 25 informational RLS-enabled/no-policy notices: access is
  deliberately closed until P4. Performance has unused-index informational
  notices in this empty database; retain the relationship/query indexes and
  reassess with real workload later. Do not add permissive policies to hide notices.
- **Tooling:** `backend/scripts/database.ts` provides `db:inspect`, `db:apply`
  (requires matching `--project-ref`) and `db:verify`; `db:smoke` runs the rolled-back
  live checks. All use the ignored local settings and verified TLS. These privileged
  administration helpers are separate from the existing caller-scoped Express
  Supabase client. Runtime/frontend `.env` files remain unconfigured for P3.
- **Research:** current changelog and migration/connection docs were checked,
  including the PostgreSQL 17.11 and HTTP TLS deprecation notices. The schema uses
  none of the affected ltree/legacy encryption/custom-operator features; modern
  Node TLS is used. Supabase CLI **2.121.0** generated the follow-up migration.
- **Final-source validation after hosted setup:** root `npm test` **27/27 passed,
  exit 0 (9.7s)**, including replay of all three migrations; root typecheck and
  build passed for both workspaces, with administration scripts typechecked too.
  Final `db:verify` reconfirmed exact hashes, zero extra grants and zero users,
  profiles, sales or movements after smoke rollback. The credential-free report
  is in local `.review/october-17-hosted-verification.log`. Original-message audit
  passes; 225 publishable files were scanned without finding the saved password.
  The local password file and Supabase CLI temporary directory are Git-ignored.
  No existing frontend/Express runtime source changed; no commit/push occurred.

#### Database validation — local baseline (before hosted setup)

- Root `npm test`: **27/27 passed, exit 0 (11.6s)** — 22 PostgreSQL database
  checks and all five existing Express API scaffold checks. Database checks
  include two fresh migration applications and a durable close/reopen cycle.
- Root `npm run typecheck`: **passed, exit 0**, both workspaces, now also checking
  backend test source through `backend/tsconfig.tests.json`.
- Root `npm run build`: **passed, exit 0**, both workspaces. No existing frontend
  or Express runtime source changed; no new frontend browser acceptance is claimed.
- The first database run found that a BEFORE UPDATE sale guard compared the
  not-yet-populated generated business date. The guard now freezes the source
  timestamp and excludes its generated field; the void/history regression passes.
  Final added stock SKU/name/unit snapshots and canonical-usage checks also pass.
- A sandboxed whole backend run could not connect to its localhost API test server
  (`EACCES`); the approved full rerun passed. PGlite itself needed no sockets or
  live credentials. Initial dependency download was network-restricted; approved
  installation succeeded. No live-service verification is implied by either run.
- The six pre-existing full original-message blocks are checked against HEAD after
  newline normalization by the local `.review/october-17-backend-audit.mjs` helper;
  a seventh block preserves this Backend-start request. The audit JSON records
  hashes and confirms existing runtime source remains unchanged.

### Previous checkpoint — P0 GitHub save complete (October 17, 2026; historical)

**Historical status: P0 GitHub save complete and remotely verified.** The user explicitly supplied https://github.com/Huuujji/Vertwell and requested saving the whole current system there before moving to Backend. That task did only P0 and stopped for review. The completed frontend and existing backend scaffold were preserved; P0 did not implement backend code, create database tables, provision services or deploy anything. The later Backend-start request and current checkpoint above now govern work.

**Current focus rule:** P0 is complete and the user has now authorized Backend. Follow **P1 database design → P2 database setup → P2A frontend integration preparation → P3 Authentication → P4 Roles → P5 protected CRUD/integration completion** as the first backend milestone. The user explicitly places backend-dependent frontend integration after completed database setup. Begin its data/API mapping and request-state wiring at P2A; complete real identity routing in P3 and protected actions after P4. Agree the permission model while designing the database. P6 through P9 are subsequent work and must not displace the first milestone. Tests and verification belong to each priority, not only to a final phase. All Backend work stays local until the Backend task list is finished.

The Backend-start request supersedes old blanket frontend-only and stop-for-review continuation instructions. P0's explicitly requested commit/push was a completed one-time transition checkpoint; it does not authorize saving unfinished Backend changes. Older checkpoints remain evidence of their own completed scope. Deployment, real payment-provider integration and production data changes remain separate work.

#### Latest user decisions — frontend scope and transition

- **Keep Daily Sales Values.** The user has made the keep decision. Preserve the improved Dashboard disclosure; this is no longer an open keep/remove question.
- **Remove Figma comparison from the remaining task list.** Exhaustive Figma comparison is no longer required for frontend completion or the transition to backend. Preserve historical evidence without scheduling this review again.
- **Remove physical-printing verification from the remaining task list.** Native viewer/OS/paper printing verification is no longer a completion requirement. Keep the existing Print/export functionality and matching generated-PDF behavior; the user removed the verification task, not those features.
- **Place backend-dependent frontend integration after database setup.** P2 must finish before P2A starts. Authentication/profile routing and protected CRUD are completed with their P3–P5 dependencies; checkout/review/report integration follows its P6–P8 workflows.
- **GitHub bridge completed; Backend now stays local.** P0 saved the frontend and scaffold and stopped for review. The user's next request has now started Backend, database first. Do not repeat P0 or commit/push backend changes while Backend tasks remain unfinished.

#### P0 — top priority: save the frontend phase in GitHub before backend work

**Status: complete; checkpoint `f08f7b79932168954d670b5de9c2490a90db37db` was verified on `origin/main`.** The following historical save checklist is fulfilled. Its review stop was satisfied by the later Backend-start request:

1. Inspect the current repository, branch, remotes and all existing tracked/untracked changes. Identify the existing intended GitHub destination from the repository configuration; do not invent a destination or overwrite unrelated work. Preserve the current scaffold and frontend changes.
2. Review what will be saved: application source, tests, assets/licenses, configuration, lockfile and relevant documentation, including this handoff and README. Check ignore rules and the staged changes so `.env` credentials, dependency folders, generated builds and local `.review` artifacts are not accidentally published. Environment example files may be saved when they contain placeholders only.
3. Establish the final frontend checkpoint using the existing validation evidence and appropriate final checks. The latest recorded full run is 210 checks before October 17, followed by 37 selected checks and five-size role/editor verification for October 17. If final whole-suite acceptance is performed, record its actual result; do not represent the scoped run as a newer full run. Figma comparison and physical printing are excluded by the latest user decision.
4. Commit the reviewed frontend-phase checkpoint and push it to the existing intended GitHub repository/branch through the normal workflow. Preserve the history and current work; resolve ordinary conflicts carefully. Update the handoff's P0 status and checkpoint details as part of the saved documentation.
5. Verify the frontend checkpoint commit exists on the intended remote branch and record the commit SHA, remote repository/branch and validation scope. Do not mark P0 complete merely because a local commit was created; the requested result is saved in GitHub.

**Historical P0 completion gate (fulfilled):** the reviewed frontend snapshot is confirmed on GitHub with an identifiable commit and validation scope; stop for review until a later Backend request. That later request has now arrived. Do not repeat this save or apply it to unfinished Backend work.

#### P0 checkpoint — October 17 GitHub save

- **Scope:** P0 only, followed by a stop for user review. No backend implementation or deployment is part of this task.
- **Destination:** existing `origin` is `https://github.com/Huuujji/Vertwell.git`; existing local branch and remote default branch are `main`. Both started at `5eb122eec7ad570ed5aa307ff8de1b90c1eae9da`; the normal fast-forward push preserved that history.
- **Snapshot review:** 214 project files, approximately 14.8 MB, include the completed frontend, existing Express/Supabase scaffold, tests, assets/licenses, design-reference archive/manifest, workspace configuration, lockfile, README and this handoff. Both environment examples contain blank credentials. Credential-pattern review found no matches in the publishable text files. All 105 design-reference manifest entries match their recorded sizes and SHA-256 hashes. All six historical verbatim user-message blocks are hashed and preserved.
- **Ignore rules:** dependency folders, `.npm-cache`, builds, credentials, coverage, Playwright results/reports and logs remain excluded. Added `.review/` to exclude local QA artifacts inside the repository as well as the existing workspace-parent review directory.
- **Validation:** root `npm run typecheck` and root `npm run build` passed for both workspaces. Existing API scaffold tests passed, **5/5**, without live Supabase credentials. The first sandboxed API test attempt was blocked by localhost `EACCES`; the approved rerun passed without source changes. The complete frontend run finished with **208 passed and 2 failed (8.8m)**; both failures were outdated test assumptions. Final focused verification passed **2/2 (11.9s), exit 0**, covering both corrected tests. All 210 existing cases are therefore covered across the broad run and focused rerun; this is not a single clean 210-pass run.
- **Test-only corrections:** the older discount/checkout test now enters/searches/asserts SKU and verifies Item Code is absent, retaining all price/discount/checkout/report assertions. The long-range stock test now derives tomorrow in Asia/Manila instead of assuming October 17 is always in the future. No application or backend source changes were made. Historical October 17 role/editor checks at five sizes remain the direct evidence for Owner-only alert settings and SKU-only editors.
- **Verified remote checkpoint:** [`f08f7b79932168954d670b5de9c2490a90db37db`](https://github.com/Huuujji/Vertwell/commit/f08f7b79932168954d670b5de9c2490a90db37db), **Save completed frontend and existing system scaffold**, was pushed to `main`. An independent `git ls-remote origin refs/heads/main` returned that exact SHA; local `origin/main` matched, and the working tree was clean before this documentation-only completion update. The initial dry-run push failed with HTTP 403 under `Degenerate1456`. The user then explicitly selected `Huuujji`; its dry run and actual push succeeded. Repository-local GitHub username routing selects `Huuujji`, without changing global credentials or settings.
- **Historical stop point:** P0 completed and stopped. The user has since requested Backend; the current database checkpoint at the top supersedes that wait.
- **Local evidence:** workspace-parent `.review/october-17-p0-*` audit/baseline files and validation logs. These local files are excluded from the GitHub snapshot.

#### Decisions and intent carried forward from this chat

- **Remove Item Code from the new database design.** The user decided it was only a second code and is unnecessary. Use SKU as the business-facing code; do not add an `item_code` column or restore its frontend input. The October 17 frontend checkpoint below already records completed Item Code removal. Existing optional legacy metadata and linked IDs survive edits; do not destructively rewrite old data to remove historical metadata.
- **Keep internal record IDs and stock relationships.** SKU remains visible and searchable. `stock_item_id` is an automatically managed database relationship to the physical stock record, not another code the user must enter. A Retail Item uses its linked stock record/batches; Recipe products consume recipe inputs, Variants use the selected variant's stock link, and Bundles resolve their components. Do not require one direct stock link on every product model. SKU could technically be a unique relationship key, but the proposed design uses stable internal IDs so SKU edits do not break relationships or history.
- **Use Supabase Auth for credentials.** It manages password hashes and sessions. The application profile table must not contain a plaintext password, a copied password hash, or a password field exposed to the Users page. Link the application profile to the Auth user; retrieve email through an authorized backend response.
- **Use database relationships for repeated records.** One sale has multiple sale-item rows; one stock item can have multiple receipt batches; a modifier group has multiple options and stock inputs. Do not replace these relationships with comma-separated text in `items` or `modifiers` columns.
- **Keep the existing frontend model and history.** Internal tables support the existing Products/Ingredients/Modifiers interfaces; they do not authorize reintroducing an obsolete stock-management panel. Keep retail SKUs without a POS listing accessible. Separate manual product enablement from computed availability based on usable stock. Manufacturing/expiry/physical quantity belong to receipt batches; visible stock/expiry/reorder statuses are derived consistently.
- **The discussed proposal has now been refined in P1 and applied in P2.** `backend/supabase/DESIGN.md` contains the dictionary, frontend mapping, keys/constraints, archival rules and remaining business decisions. Three migrations are applied and verified in Vertwell development. Database setup is complete; live Auth, permissions, integration and checkout are still their later priorities.

#### Ordered bridge and backend priorities and completion criteria

| Priority | Task | Status | Completion criterion |
| --- | --- | --- | --- |
| **P0 — bridge** | Save the frontend phase in the existing GitHub repository | **Complete — verified on main** | Checkpoint `f08f7b79932168954d670b5de9c2490a90db37db` is committed, pushed and independently verified; user has since authorized Backend. No new GitHub save during unfinished Backend work. |
| **P1 — database first** | Finalize database design and role rules together | **Complete locally** | `backend/supabase/DESIGN.md` covers actual frontend relationships, every column, permissions, archival/history rules and deferred decisions. |
| **P2** | Implement the database foundation | **Complete — hosted development verified** | Three applied migrations match local hashes; 25 RLS tables, denied role access, indexed FKs, 12 rollback smoke checks and advisor review verified in Vertwell development. |
| **P2A — after database setup** | Begin backend-dependent frontend integration preparation | **Complete — prepared locally; live access remains gated** | Schema-derived contracts/mapping, typed transport and request states are implemented and tested; authenticated/protected operations remain dependent on P3–P5. |
| **P3** | Complete real authentication and account lifecycle | **Complete — live checks, configured Auth and user-confirmed emailed password change/login** | Login/logout, session restoration/expiry, protected identity lookup, account provisioning and complete emailed recovery work with real development accounts. |
| **P4** | Enforce Owner/Admin/Staff permissions | **Complete — approved migration applied; hosted verification passes** | Caller-scoped API checks, six restricted read grants, 25 SELECT policies, 11 hosted permission scenarios and 12 rollback smoke checks pass; both real Owners/settings remain unchanged. See current checkpoint for verification limits. |
| **P5 — first milestone** | Protected CRUD and Users/Inventory integration | Complete — real acceptance, nine hosted hashes and final regressions pass | Real browser and Auth/PostgREST/Storage changes persist across refresh/login and another authorized account; denied/invalid actions change nothing. Nine migrations include two hosted-path fixes. |
| **P6** | Transactional checkout, payments recorded and stock consumption | Complete — hosted/caller-token/concurrent acceptance passes; disabled after approved test window | Sale, purchased snapshots, batch deductions, movement records and audit events save together; duplicate/concurrent requests cannot oversell or deduct twice. |
| **P7 — current** | Durable Daily Sales Review, voids and audit history | Implemented; applied/schema-verified; broader hosted acceptance incomplete (SQL connectivity) | Reviews/requests/decisions and per-event attribution persist; Owner review never deducts stock again; single/bulk actions handle stale records, retries and partial failures. |
| **P8** | Database-backed reports and reconciliation | Pending | Screen/PDF/CSV/Print scopes derive from durable records with matching filters, correct historical/current balances and explicit missing-history disclosures. |
| **P9 — later** | External payment verification, notifications and additional integrations | Pending / details to define | Provider and notification scope, rules and verification are specified separately; existing sample QR/reference entry is not represented as payment verification. |

##### P1 — after the GitHub bridge, finalize the schema before writing migrations

Read `Frontend/src/data/demo.ts`, `inventory.ts`, `stock-movements.ts`, `catalogue.ts`, `modifiers.ts`, `audit.ts`, `reporting.ts`, the relevant App/page workflows, and the existing backend scaffold. Preserve the real relationships and historical behaviors rather than copying visible table headings directly into SQL.

Carry forward these proposed table groups:

| Area | Proposed tables and responsibilities |
| --- | --- |
| Identity and users | Supabase-managed `auth.users`; application `profiles` with linked ID, full name, username, role, active state and timestamps. Email/credentials are Auth-managed. |
| Catalogue and inventory | `products`, internal `stock_items`, `stock_batches`, `product_recipe_items`. Products hold selling/configuration information; stock items identify ingredients or stocked product SKUs; batches hold physical balances and dates. |
| Modifier library and product copies | `modifier_groups`, `modifier_options`, `modifier_stock_inputs`. Library groups can exist without a product; attaching one makes an independent product copy with an optional source reference. No silent propagation to existing products, carts or sales. |
| Variants and bundles | `product_variants`, `bundle_components`, `bundle_component_modifiers`. Preserve selected variants/fixed options, recursive recipe/nested-bundle behavior, cycle protection and shared-SKU aggregation already present in the frontend. |
| Sales and payment records | `sales`, `sale_items`, `payments`. Separate readable order numbers from internal IDs, identity snapshots from current profiles, and payment/fulfilment/review states from one another. Retain idempotency keys and applicable unique payment references. |
| Stock and cash history | `stock_movements`, `cash_movements`. Capture openings, receipts, consumption, corrections, removals, wastage and applicable returns/transfers as explicit movements; distinguish recorded cash movements from payment transactions. |
| Reviews and audit | `void_requests`, `daily_sales_reviews`, `daily_sales_review_items`, `audit_events`. Retain every relevant request/decision/event, included receipt and verification, actor/role/time/reason, totals/discrepancies and bulk-action linkage. |

Define UUID/internal keys, foreign keys, SKU/username uniqueness, exact decimal monetary values, valid quantities/units, indexes, timestamps, nullable Hobby dates and required Food/Beverage dates as applicable. Keep local business-date calculations consistent with Asia/Manila even though displayed dates omit the suffix. Define archival/deactivation and snapshot rules so removing a live record never erases historical sales or movements. Record unresolved business decisions explicitly; do not invent accounting, refund, costing or permission policies.

**P1 evidence:** reviewed schema/data dictionary, relationship mapping for all four stock models, explicit account/permission matrix, constraints and migration plan. Table design alone does not establish that persistence or security works.

##### P2 — implement the development database foundation

- Reuse Express/Supabase and the existing backend helpers. `backend/supabase/README.md` specifies numbered PostgreSQL migrations, protected tables, transactional checkout and uniqueness/concurrency requirements. Its older shift-approval wording does not reintroduce shift management.
- Add reproducible migrations and clearly separated development seed data. Do not silently copy preview actors into real Auth identities or seed illustrative sales into production.
- Enable Row Level Security on tables exposed through Supabase's Data API and default to restricted access while role policies are built. Keep privileged keys on the server and preserve caller-scoped database access where RLS applies.
- Establish immutable history/snapshots and the transaction boundaries needed for balance-plus-movement writes. Never treat multiple independent SDK calls as one atomic transaction.
- Verify migration application in a development/test database, relationships, uniqueness, unit/quantity rules, archive behavior and restricted access. State clearly if live database verification could not be performed.

##### P2A — frontend integration begins after completed database setup

- Start this work only after P2's database setup is complete and verified. Map the real table/API contracts, identifiers, relationships and validation responses to the existing frontend instead of building integration against an assumed schema.
- Prepare the data-access layer, data mapping, loading/saving/error states and handling of failed requests while preserving the existing working preview and unsaved-form protection.
- Implement actual authentication/profile routing with P3. Enable role-protected data access and mutations only after P4's authorization checks are in place, and verify persistent Users/Inventory CRUD in P5. Checkout, reviews and reports connect as P6–P8 are implemented.
- Track this as scheduled backend-dependent integration, not unfinished visual-design work. Do not use preparation or mock requests as proof that live persistence/authentication works.

##### P3 — real authentication and account lifecycle

- Build on the existing sign-in/sign-out helpers, token verification middleware and `/api/auth/me`; those currently establish identity, not business permissions. Normal configured login must resolve the real profile/role instead of opening a sample Staff identity.
- Implement login/logout, session restoration and expiry handling, active-account checks, and initial Owner provisioning through a trusted development/admin flow. Keep real login separate from the explicitly labeled preview.
- Implement authorized account creation/invitation, profile updates and deactivation with consistent Auth/profile outcomes. Public signup must not let someone assign themselves Owner/Admin permissions. Account management uses privileged server operations only where required.
- Complete reset-link callback handling and actual password changes. Sample verification code `123456` must remain sample-only.
- Verify valid/invalid login, expired/invalid tokens, inactive accounts, logout/restoration, provisioning failures and recovery with development accounts; do not claim email delivery or password updates from mock checks alone.

##### P4 — enforced roles and access boundaries

Use the current preview policy as the starting point, with any unresolved permission decisions made explicit in P1:

| Action | Owner | Admin | Staff |
| --- | --- | --- | --- |
| Dashboard/business reports and operational inventory management | Allowed | Allowed | Not allowed |
| Dashboard alert settings | Allowed | Not allowed | Not allowed |
| POS | Allowed | Allowed | Allowed |
| Sales/Audit access | All permitted business sales | All permitted business sales | Own permitted daily sales and requests |
| Void requests and direct voids | Review/direct void under own identity | Review/direct void under own identity, without Owner password/approval | Submit requests only |
| Confirm Daily Sales Review | Allowed | Not allowed | Not allowed |
| User administration | All roles | Staff accounts only | Not allowed |

- Enforce permissions in API operations and applicable database policies, not only hidden buttons. Obtain actor IDs/roles from trusted identity/profile data; reject client-supplied role escalation and unauthorized profile-role updates.
- Protect the last active Owner from deletion/deactivation/demotion and prevent deleting the signed-in account. Handle concurrent account changes so these protections remain true.
- Verify every role's allowed and denied routes, cross-account record access, Staff history ownership/date scope, direct API attempts, and role changes affecting active sessions.

##### P5 — protected CRUD and frontend integration

- CRUD means Create, Read, Update and Delete. Connect Users and Inventory's existing workflows to the protected backend: products, ingredients/stock, receipt batches, recipes, modifiers/library copies, variants, bundles and permitted account operations.
- Preserve dependency checks, SKU uniqueness/generation, optional images, valid dates/units, per-batch independence, shared stock, manual availability and product-copy behavior. Archive/deactivate referenced records; preserve their sale/audit snapshots.
- Receiving, physical-count corrections and removals must record stock movements with the actor/reason and update balances transactionally. An edit must not silently overwrite the stock history.
- Add the loading, saving, validation and failure handling needed for real requests while preserving unsaved-form protection and existing filters/navigation. Preserve edits appropriately if a request fails.
- Verify persistence after refresh/logout/login, visibility to another authorized session, role restrictions and unchanged balances/history after rejected requests. Run meaningful backend/database checks and affected frontend checks; record actual results.

**First-milestone acceptance:** after verified P0, P1–P5 including P2A are complete only when real development accounts can authenticate with enforced roles and perform permitted Users/Inventory CRUD against durable data, and the denied/invalid cases have been verified. Until then, keep P6–P9 deferred and record the precise next unfinished priority.

##### P6–P9 — follow-on behavior to preserve and complete later

- **P6:** Recalculate authoritative prices/configuration requirements and availability on the server. Aggregate all cart demand across recipe/modifier/variant/bundle inputs, convert units and use usable batches in expiry order. Enforce idempotency, applicable reference uniqueness and concurrent-stock safeguards. Save the sale, payment record, purchased price/configuration/usage snapshots, batch balances, movements and audit events in one transaction. Current confirmed policy: Owner checkout completes immediately; paid/fulfilled Staff/Admin checkout consumes stock once and awaits Owner review. Review never deducts again. Historical records retain their recorded stock-commit state. Recording a GCash reference is not verification by a payment provider.
- **P7:** Persist Owner receipt verification, expected/verified Cash and GCash, counted cash, opening/addition/removal/refund adjustments, explanations, outcome and included orders. Preserve Staff requests and Admin/Owner attribution, exact eligible single/bulk IDs, reasons and event history across requests/reviews/voids. Handle stale records, retries, concurrent decisions and partial failures explicitly. Voids do not automatically restore stock or refund payments; actual returns/wastage/refunds need their own recorded movements.
- **P8:** Replace preview-derived persistence assumptions with durable sales/movement-based reports. Reconcile opening + receipts/other valid movements - usage/removals to closing per SKU/unit; distinguish historical period closing from current physical/usable stock. Preserve full-day stock balances versus time-filtered sales/usage, partial/missing-history disclosures, matching PDF/Print content and complete scoped CSV. Include review/payment/stock exceptions and do not invent unverified opening balances or stock percentages.
- **P9:** Define and implement real payment verification/reconciliation and notification delivery as separately scoped integrations. Preserve alert evidence, configurable unusual-sales thresholds and human review; alerts must not automatically void orders or punish accounts. Define live synchronization without silently rewriting modifier copies or historical snapshots. Production batches, component-level mixed-category bundle revenue allocation, stock valuation/recipe costs/margins require explicit business rules and trustworthy source data before implementation. Shift management remains outside the current scope.

#### Remaining frontend verification and scheduled integration — latest user decisions applied

The October 17 fixes and the latest October 16 frontend requests are recorded as completed. Daily Sales Values is now confirmed to stay. Figma comparison and physical-printing verification have been removed from the remaining tasks by the user; historical references to those gaps are not instructions to perform them. Older stopped/partially completed sections do not create a new implementation backlog. The items below are verification coverage or scheduled integration, rather than confirmed unresolved preview bugs:

1. **Final frontend verification recorded under P0:** the new broad run passed 208 of 210 cases; two outdated test assumptions were corrected and both passed the final focused rerun. All 210 cases are covered across those runs, with no runtime source changes. The previous single clean full-suite run remains the October 16 210-pass result. October 17's earlier 37 selected checks and five-size role/editor verification remain historical evidence; see P0 above for exact final validation scope.
2. **Real-device/accessibility/browser verification:** actual phones/tablets, real screen readers, Safari and Firefox remain unverified; desktop Edge emulation does not establish these results. This remains a verification boundary and is not made a new P0 blocker by this documentation update.
3. **Frontend work dependent on the backend — after database setup:** P2A starts after completed P2; real authentication/profile routing and protected Users/Inventory persistence are completed with P3–P5. Real checkout/reviews/reports follow under P6–P8. Sample behavior is not live integration. This is scheduled integration work, not an unresolved preview-design task.

#### Previous continuation — P6 checkout after accepted P5; superseded by current P6 checkpoint

```text
Resume in C:/Users/ASUS/Documents/Personal/Vertwell/repo in phase Backend.
Read the FULL seven original user-message blocks, carried-forward decisions,
current P5 checkpoint, README.md and backend/supabase/
{README,DESIGN,INTEGRATION,AUTHENTICATION,AUTHORIZATION,CRUD}.md.
P1/P2/P2A/P3/P4/P5 are implemented and acceptance is recorded in the current
checkpoint. P6 atomic checkout is next; P7–P9 remain later work.
Nine migrations are applied to DualCounter izdemgzdywtxhvgvsian. Freeze every
applied source, including the P5 safe-update and PT409 follow-ups. Never edit or
raw-reapply them. Do not raise 40001 for deliberate business conflicts: it caused
actual PostgREST 14.18 retry loops. PT409 returns a conflict with rollback.
Keep the revision UPDATE explicitly scoped to WHERE singleton.
Use the latest verification evidence; older pending-approval and empty-catalogue
checkpoints are historical. Real Owner browser and Admin/Staff API/Auth/Storage
acceptance passes, including another authorized account, logout/login, denied
writes, independent copies, images, revision contention and once-only retries.
Browser control became disabled mid-acceptance. Do not claim browser coverage
beyond the captured Owner flow or bypass that setting. Check current processes
and sessions rather than assuming development servers survive later chats.
Keep admin ACTIVE AND UNCHANGED. Huuujji remains an additional Owner for testing.
Do not demote/deactivate/delete/replace or password-test either retained account.
Keep Jestine Admin / Jest and Aquino Staff / Aquino active for the user. They
supplied exact identities/passwords and explicitly chose to keep them active.
Never record passwords in files/logs/handoff or recreate/reset these accounts.
Acceptance catalogue fixtures are archived and every batch balance is zero.
History remains: 21 inventory receipts, two account receipts, 13 stock movements,
53 audit events, six SKU reservations, configurations and one private image.
Use caller-token access and the protected aggregate commands; no blanket table
grants or service-role business writes. Revisions/idempotency, attributed stock
movements, atomic audit and independent modifier copies are implemented. Keep
all four stock models, SKU-only inputs/IDs, valid units/dates, optional private
images, archive/deactivate history, filters and retained async editor/wizard drafts.
P5 UI opens Inventory/Users for managers; Staff live checkout stays pending.
Preview remains separate and cannot substitute for an unavailable real service.
Final root tests 86/86, typechecks/builds and generated-schema equality pass.
Final hosted regressions are recorded in the current checkpoint. Earlier broad/
focused browser results remain historical; no fresh whole-suite run is claimed.
P6 must aggregate/recalculate cart inputs/prices, allocate usable batches, prevent
overselling/double deduction, and save sale/payment/purchased snapshots/ledger/
audit atomically. Join P5's account/catalogue lock and inventory revision.
Owner checkout completes immediately; paid/fulfilled Admin/Staff consumes once
and awaits Owner review. Review never deducts again. GCash reference entry is
not provider verification. Keep live checkout closed until P6 passes.
Keep Daily Sales Values. Figma comparison and physical printing stay removed.
No commit/push/PR/GitHub save until ALL Backend tasks finish. No deployment.
Preserve all seven original blocks and record exact results and remaining gates.
```

#### Previous continuation — P4 permissions (historical; resolved by current checkpoint)

```text
Resume in C:/Users/ASUS/Documents/Personal/Vertwell/repo in phase Backend.
Read the FULL original Backend-start message and original frontend requests,
carried-forward decisions, latest P3 checkpoint, README.md and backend/supabase/
{README,DESIGN,INTEGRATION,AUTHENTICATION}.md. P1/P2/P2A are complete.
P3 is complete: account/session implementation is live-tested. The user approved
all hosted Auth changes, including this exact project despite main PRODUCTION.
Signup is disabled; Site URL is http://localhost:5173; exact redirect is
http://localhost:5173/auth/callback. The user confirmed email receipt, then a full
password change and Huuujji login after requesting a fresh same-browser link.
The initial cross-browser failure does not remain an open P3 gate. PKCE requires
the requesting browser's storage; the user enters/submits new credentials privately.
Keep admin / @admin / admin@gmail.com ACTIVE AND UNCHANGED. The user explicitly
corrected the earlier replacement plan: Huuujji is an additional Owner for testing
only, ID 601ce4ed-8c72-49ed-83e0-294c3cdba2b4. Never copy passwords/reset links into
source, environment files or handoff. Preserve both accounts and their audit.
The project display name is now DualCounter; reference izdemgzdywtxhvgvsian is
unchanged. Do not replace the reference with the name in URLs/environment settings.
The invalid-callback reuse bug is fixed and 13 affected browser checks pass.
Recovery uses explicit one-time PKCE exchange plus verified SDK recovery event;
preserve StrictMode replay and flow-specific verifier handling.
Five migrations are applied/hash-verified. Never edit applied SQL. All 25 tables
retain RLS and zero direct grants; only the documented account RPCs are exposed.
Keep server secrets in backend only; runtime and database admin files are ignored
and separate. Real login resolves the active profile/role, never sample Staff.
P4 business roles are implemented and tested locally. Read AUTHORIZATION.md and
the latest checkpoint. The new migration was NOT applied: automatic approval
review rejected the hosted action because it interpreted Backend-local as
withholding hosted authorization. Obtain explicit approval for this reviewed P4
migration on DualCounter izdemgzdywtxhvgvsian; do not bypass or indirectly retry.
Then use db:apply with the exact project reference, db:verify, permissions:verify
and db:smoke. Preserve both real accounts/settings and roll back all SQL fixtures.
P4 is not accepted until hosted application/verification is resolved. Local
allowed/denied API/database scopes, attribution, Staff own-day history and role
changes pass. The 501 command boundaries keep unfinished business work closed.
P5 Users/Inventory persistence, then P6 checkout,
P7 reviews and P8 reports remain unfinished. Preserve P2A request-state/draft protection,
SKU-only inputs, all stock models/relationships, copies, Owner-only settings,
assets/licenses, preview notices and test-owned Vite teardown. Keep Daily Sales
Values; Figma comparison and physical-printing work stay removed.
No commit/push/PR/GitHub save until ALL Backend tasks finish. No deployment.
Preserve all seven full original-message blocks; record exact results and limits.
```

### Last completed frontend priority — Dashboard alert settings and Inventory Item Code (October 17, 2026)

**Status: both requirements implemented and verified in the frontend preview.** The complete original message below remains unchanged. The October 17 checkpoint records this task's changes and validation; the October 16 checkpoints remain historical validation baselines.

#### Original October 17 user message — verbatim, not summarized

```text
okay\
I want you to add this in the Handsoff file a priority fixes for the Frontend, also when putting this in the handsoff file dont summarize it I want the intent to be in the message it is important that what I had in mind is passed on.

this will be another Task and by putting this in the handsoff I will start the task in a new chat

Dashboard

- the owner should only be able to see the alert settings, when in admin this button should be hidden



Inventory&#x20;

- remove the Item Code this is not needed as we already use the SKU
```

#### Completed checkpoint — October 17 frontend fixes

- **Dashboard:** Alert settings is rendered only for `Owner`. The settings panel
  independently checks the same role. Admin retains review notifications and View
  all requests; Staff retains its existing POS/Audit-only navigation. Owner settings
  still work and persist through navigation until logout.
- **Inventory:** Removed Item Code from Product, Ingredient and product-inventory
  editors, SKU cells in both table renderers, search and duplicate-code validation.
  SKU remains editable and generated with its existing uniqueness checks. New records
  no longer create an extra code. Existing optional legacy metadata is retained on
  edits without displaying or requiring it; IDs, linked stock and batches are preserved.
  The older October 15 editor regression now expects the removed field to be absent.

Validation on the final application source:

- Root `npm run typecheck`: passed, exit 0, both workspaces.
- `npm run build --workspace Frontend`: passed, exit 0.
- Selected existing browser suites (`audit-alerts`, `october-15-ui`,
  `october-16-inventory`): **37 passed (1.2m), exit 0**. Covers alert investigations,
  Admin void attribution, SKU generation/creation, batch edits, Inventory filters,
  stock dependencies, Dashboard stock links, responsive controls and matching Print/PDF.
  The full 210-test suite was not repeated for these scoped changes.
- Additional live browser verification: Owner/Admin dashboards and both add editors,
  plus Staff access, at 1440×900, 820×1180, 390×844, 320×568 and 820×400. Owner
  settings work and retain values; Admin has no button, panel or setting inputs;
  every editor has one SKU generator and no Item Code input. All checks passed with
  no page errors or page overflow. Thirty screenshots and `validation.json` are in
  workspace parent `.review/frontend/october-17/`; five screenshots were visually
  inspected, covering all five sizes, desktop/tablet editors, phone Ingredient
  editing, Admin phone Dashboard and Owner short-screen settings.

Logs: workspace parent `.review/october-17-typecheck.log`,
`october-17-build.log`, `october-17-focused-verified.log`. The sandboxed browser run
was stopped when Edge closed before page checks could execute; rerunning outside
the sandbox passed. An initial responsive helper assumed three SKU headers while
Inventory's retained Beverage filter showed two; its count check was corrected to
respect table visibility, then the complete responsive run passed. Neither attempt
required an application change. Test-owned Vite setup/teardown is unchanged.
Original-message hashes are preserved in `.review/october-17-before/` and checked
against the final handoff. All work remains uncommitted and frontend-only; backend
integration, deployment, physical devices, real screen readers and other browsers
remain outside this verification.

#### Previous continuation — after October 17 frontend fixes (historical; use backend priorities above)

```text
Resume in C:/Users/ASUS/Documents/Personal/Vertwell/repo from the user's next
concrete request. Read the entire verbatim October 17 message and its completed
checkpoint above, README.md and any applicable AGENTS.md. Both October 17 fixes
are implemented and verified. Keep alert settings Owner-only, including the panel.
Keep Inventory SKU-only in its forms, tables and search; preserve legacy metadata
and existing IDs/stock links when editing. Older checkpoints and continuation
scripts are historical; the 37-check result is scoped validation, not a new full run.
Preserve existing uncommitted work, role boundaries, historical snapshots, stock
links and safeguards, dirty-form protection, sample/reset notices, assets/licenses
and test-owned Vite teardown. Keep the new task frontend-only and record its actual
changes and validation when performed. Backend integration, commits and deployment
remain separate work.
```

### Previous completed priority — Inventory stock models and filters (October 16, 2026; completed)

**Status: all three requirements implemented and verified in the frontend preview.** The complete original message below remains unchanged. The checkpoint after it records this task's implementation and actual validation; older checkpoints are historical evidence.

#### Original Inventory user message — verbatim, not summarized

```text
okay
I want you to add this in the Handsoff file a priority fixes for the Frontend, also when putting this in the handsoff file dont summarize it I want the intent to be in the message it is important that what I had in mind is passed on.
this will be another Task and by putting this in the handsoff I will start the task in a new chat

Inventory
- I see a lot of data with Stock model: "Inventory Only" this is not scoped in the table only Retail Item, Recipe, Variants, Bundle. so just change those with inventory only into Retail Item since its only one product and it doesnt seem to use recipe tho.

- Add another Drop down Filter for Filtering Stock Model

- the Needed to Remove Stocks should be Invisible it will only show if there is any stocks that needed to remove
```

#### Completed checkpoint — Inventory stock models and filters

All three requirements in the full original Inventory message above are implemented.
The original message and all four earlier original-message blocks were compared
against the pre-task copy and remain identical after newline normalization.

| Original requirement / intent | Implementation and verification |
| --- | --- |
| Change Inventory Only single-product records to Retail Item | Every unlisted finished-stock row now has **Retail Item** in Stock model, physical/usable quantities and direct **Edit · + · Remove** actions. Its existing SKU, stock ID, receipts and dependencies remain intact. **No POS listing** is a separate availability note; no selling price or new POS product is invented. These items use the existing stock editor, receiving validation, dirty-form protection, dependency guard and per-batch actions. Items with no batches do not render an empty batch panel. |
| Add a Stock Model dropdown | **Stock model** offers All stock models, Retail Item, Recipe, Variants and Bundle in Products and All inventory. It combines with category/search, resets pagination on change and persists during navigation within the login. Finished removal rows follow their receipt-owning product model; unlisted SKUs are retail. Ingredients have no product stock model and retain their own category/search scope, explained visibly in All inventory. Dashboard stock links and successful saves reset the model filter so the affected/saved record stays reachable. Summary counts follow the filtered records. |
| Show Needed to Remove Stocks only when stock needs removal | The section, heading, table, empty state and pagination render only when matching expired/unsellable quantities are positive. They disappear for empty searches/categories/models and immediately after the last unusable quantity is removed. Cancellation preserves stock; usable quantities are unchanged by unusable-stock removal. A zero-stock retail item alone does not create a removal section. |

Final validation:

- Root `npm run typecheck`: **passed, exit 0**, both workspaces. Backend implementation unchanged.
- `npm run build --workspace Frontend`: **passed, exit 0** on the final application source.
- Final full frontend suite: **210 passed (6.5m), exit 0** — all 198 existing regressions and 12 new cases in one clean run.
- Final focused suite before that broad run: **26 passed (56.2s), exit 0**, including all 12 new cases and all 14 existing redesign cases.
- Existing matching Print/export PDF and scoped CSV regressions passed. Report generation was unchanged; historical PDF rendering was not repeated.
- Test-owned Vite closed normally; final checks found **no listeners on ports 5180 or 5181**.

New tests: `Frontend/tests/october-16-inventory.spec.ts`. They cover every model
across product pages; category/search composition; retained filters; ingredient
scope; Owner/Admin unlisted retail editing, receiving, batch removal and record
removal; live modifier dependency protection; saved products; Dashboard links to
both expired batches and unbatched retail records; removal visibility/cancellation/
final removal; and five responsive sizes.
Two older tests now expect the intentional No POS listing label and hidden empty
removal section. Test-owned Vite startup/teardown remains unchanged.

Evidence: workspace parent `.review/frontend/october-16-inventory/`; 20 screenshots
cover all models, a retail result without removal stock, empty results and the
retail actions at 1440×900, 820×1180, 390×844, 320×568 and 820×400. Original message
hashes are in `.review/october-16-inventory-original-message-hashes.json`.
Sampled visual inspection covers all five sizes, desktop alignment, absent removal
sections, empty results, and phone/tablet retail actions after table scrolling.
Automated checks cover containment, action alignment, minimum control heights and
browser page errors. Machine-readable results are in the evidence folder's
`validation.json`. Physical devices, real screen readers, Safari/Firefox, live
services and native OS printing remain unverified.
Logs: `.review/october-16-inventory-typecheck.log`,
`october-16-inventory-build.log`, `october-16-inventory-final-focused.log` and
`october-16-inventory-final-full.log`. The first broad diagnostic run is retained
as `october-16-inventory-full.log`.

The initial sandboxed browser attempt could not launch Edge. The first run with
Edge outside the sandbox passed ten checks and found one test-only assumption:
the preview has six expired cookie pieces after its historical consumption,
not the opening receipt's eight pieces. That expectation was corrected. Visual
review also removed empty retail batch panels for items with no receipt batches.
The first broad run passed 209 checks (6.3m) and exposed a missing highlight when
a Dashboard link opened an unbatched retail record. Retail rows now recognize
their stock ID as well as their row-selection key. Both the legacy Dashboard
regression and new expired-batch/unbatched-record links pass in the final focused
run; this fix does not change stock or historical snapshots.

All work remains uncommitted and frontend-only. Existing preview people, role
boundaries, historical snapshots, stock links, dirty-form protection, stock
safeguards, sample/reset notices and original assets/licenses are preserved.
No backend integration, commit or deployment occurred.

#### Previous continuation — after Inventory stock-model/filter completion

```text
The October 16 Inventory stock-model/filter request is complete. Read the entire
original message and its checkpoint above before continuing from the user's next
concrete request. Unlisted finished SKUs are Retail Item with direct stock actions;
No POS listing describes selling availability separately. Preserve existing SKU,
receipt and recipe/variant/bundle/modifier links rather than creating POS products.
Keep the stock-model filter scoped to products, combined with category/search and
reset for Dashboard drill-downs/saved records. Keep the removal section and its
pagination hidden when no matching unusable quantity remains.
Preserve all existing uncommitted work, role boundaries, historical snapshots,
sample/reset notices, assets/licenses, dirty-form protection, stock safeguards,
stock-aware modifier defaults and test-owned Vite teardown. Older continuation
scripts are historical. Backend integration, commits and deployment remain separate.
```

### Previous completed priorities — additional frontend fixes (October 16, 2026)

**Status: implemented and verified in the frontend preview on October 16, 2026.** This additional request follows the earlier completed October 16 frontend fixes below. The user's entire message is preserved verbatim, including the stock scenario and quoted report explanation. Read the full message before implementation; do not replace it with a summary.

The additional completed checkpoint below records all eight requirements, research, verification and limits. The earlier 187-check checkpoint is historical baseline evidence; the current acceptance covers those regressions plus 11 new cases. Earlier continuation scripts remain historical.

#### Original additional October 16 user message — verbatim, not summarized

```text
okay
I want you to add this in the Handsoff file a priority fixes for the Frontend, also when putting this in the handsoff file dont summarize it I want the intent to be in the message it is important that what I had in mind is passed on.
this will be another Task and by putting this in the handsoff I will start the task in a new chat

Inventory
- The Product that has Receipts & Batches this word is too technical and Misleading for the user so I need a better wording like "Stock Details" or if you got better wordings lets go with it.

- the Product that has Retail Stock model no longer need this Receipts & Batches because in itself is the Product so the action button should be Edit | + | Remove just like the Ingredients.

- when adding a product In the modifiers section when adding the price Im unable to backspace the 0 can you fix this just like what we did in the Minimum choices  and maximum choices when focused the user is able to backspace the 0 and when unfocused if there is no input made or the user leave it blank it will set automatically to 0.

- in the modifier section the Check box for Select this Option by default I should only be able to click the Check if I click the box or the Label beside it only, because it appears to be Im able to check it just by clicking the blank space on the same Row as the check box and it will enable the box. 

POS
- I found a bug so here is a scenario
with 4 buns available and there is a Product with Modifiers 
the Product itself Uses 3 buns and there is 3 options in modifiers

1st option additional 3 buns
2nd option additional 2 buns
3rd option additional 1 bun

in the inventory I set the first option the 3 buns as default and when I look up in the POS with this settings 4 buns available | 1st option set by default

when I look in the POS i see this Product and I am able to click it yes this should be fine but when I see the modifiers the 1st option is checked but this option is unavailable due to low stocks so can we do like un check it even if that option is the default because of the low stock so that the user no need to uncheck this because it should not check the default or any of the option if doesnt have enough stock.

Report
- there is a bug I found when I set the date by 3 months apart the calculation in the Ingredient usage / Remaining Stock section seems broken even the HP-Bar-Like or what can we call it became a blank bar with no green or gold color but if I set it to 1 or 2 months range it will be able to calculate normally.

- the tips in How Stock balances are calculated in this part the "Green is stock left, gold is stock used, and burgundy is stock removed. Expired stock stays in the physical count until removed; usable stock excludes it.

The period closing balance is what was left at the end of your selected dates. Current remaining is what you have now. Time filters narrow sales and usage tables; balance bars cover full days."
I think there is still a better way to improve this message also the red color is not mention in the text the legend should be described for the user to understand you should search an industry standard for this.

Audit Trail
- when voiding a single Sale add a final warning message as well just like in the bulk void
 
```

#### Completed checkpoint — additional October 16 frontend fixes

All eight requirements in the original additional October 16 message above are
implemented in the frontend preview. The original message remains unchanged;
its normalized-text SHA-256 is
`75d2e7e99541c45a04525d204bbbbd7a850aca23779ab75b836251cc5b64c3a6`.
The earlier October 16 original message also retains its recorded SHA-256.

| Original requirement / intent | Implementation and verification |
| --- | --- |
| Inventory — clearer Receipts & Batches wording | Linked variant, bundle-component and inventory-only controls now say **Stock Details**, including their accessible names. Existing stock/SKU/receipt links remain intact. |
| Inventory — retail actions Edit / + / Remove | Retail product rows have exactly **Edit · + · Remove** in one row. + receives into the linked stock record with existing date validation and dirty-form protection. A compact expand arrow exposes per-batch Edit/Remove, including empty batches, without a Stock Details button or a duplicate receiving row. Physical and usable counts remain visible. |
| Inventory — erase the modifier price zero while focused | Both product and reusable-library editors use the same numeric draft field as choice limits. Backspacing zero leaves a blank draft; leaving it blank restores zero on blur. Decimal prices still work. |
| Inventory — default checkbox must not toggle from empty row space | The checkbox label fits its checkbox and text. Clicking the empty area to its right leaves the value unchanged; the checkbox, text and keyboard interaction still toggle it. Both editors are tested. |
| POS — four buns / three-bun base / default three-bun add-on | New customizations preselect only a stock-feasible subset of configured defaults, checked against the base recipe, quantity and other cart lines together. In the exact reported scenario, the three-bun default and two-bun option start unchecked and disabled; the one-bun option remains selectable. Owner and Staff can add it and check out, consuming four buns once. Shared-SKU defaults, omissions, quantities and chosen variants are also checked. Existing cart edits retain their saved selections rather than applying defaults again. |
| Reports — three-month ranges must not produce unexplained blank bars | The failure was the August 1 sample opening date, not a month-count limit. A range overlapping recorded history now shows verified balances and colored segments, with **Partial history**, the actual covered dates and an explicit earlier-stock-unknown note on every affected ingredient. Exports carry the same coverage per row. Entirely earlier ranges, incomplete snapshots and unreconciled counts remain unavailable with visible text in the striped state. Known zero-stock periods say so explicitly and avoid nonfinite percentages. No earlier opening balances are invented. |
| Reports — improve calculation guidance and explain red | Added an always-visible swatch-and-text legend: green remaining, gold used in orders, **red / burgundy removed**, striped gray unavailable. Removed quantities also show percentages. Help explains the formula/example, expiry versus physical/usable stock, warning red versus actual removal, closing versus current balances, full-day bars versus time-filtered tables, and partial/missing history. |
| Audit Trail — final single-sale warning like bulk void | Owner/Admin direct voids and approvals now lead from Confirm Void to a separate **Void this order permanently?** dialog. It shows the irreversible-session warning, exact order/total, actor/role and reason, and retained-audit/payment/stock effects. Go back, Escape, X and backdrop preserve the review without changing the transaction. Only **Void order** mutates it; duplicate submission and stale/voided orders are guarded. Staff still submits a request for review. |

Research used the primary guidance in [W3C WCAG 2.2 — Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
and [IBM Design Language — Data visualization design](https://www.ibm.com/design/language/data-visualization/design/basics/),
accessed October 16, 2026. The applied design decision is to pair swatches with
plain labels and numeric values, and to explain every displayed color/state;
these sources do not prescribe a universal inventory color palette.

##### Validation and evidence

- Root `npm run typecheck`: **passed, exit 0**, both workspaces. Backend implementation unchanged.
- Final `npm run build --workspace Frontend`: **passed, exit 0**.
- **All 198 unique cases verified across runs: 187 existing regressions plus 11 new cases.** The broad run passed 196 (6.6m), with two failures in the screenshot cleanup helper, which tried to dismiss an inert background notification while a modal was open. After fixing that helper, the final focused run passed **19 tests (53.1s), exit 0**: all 11 new cases and all eight variant/bundle cases. This is not a claim of one clean 198-test execution. No broader rerun was needed for the helper fix; related bundle-default preservation also has final focused coverage.
- Existing three-scope Print/PDF byte comparisons and scoped CSV regressions passed. An additional three-month Inventory usage PDF has **9 pages, 13 per-ingredient coverage notes, and identical Print/download bytes**. Text checks passed; all nine Poppler renders were reviewed in a contact sheet, with enlarged first-page and section-transition inspection.
- Final logs: workspace parent `.review/october-16-additional-typecheck.log`, `october-16-additional-build.log`, `october-16-additional-final-full.log`, and `october-16-additional-final-focused.log`. Machine-readable results are in the evidence folder's `validation.json` and `pdf-checks.json`.
- Test-owned Vite closed normally. Final checks found **no listeners on ports 5180 or 5181**.

New coverage is in `Frontend/tests/october-16-additional.spec.ts`: 11 checks
cover the exact four-bun scenario through checkout for Owner/Staff, combined
stock defaults and omissions, both modifier editors, long/partial/unknown/zero
balances, scoped CSV coverage and five responsive Inventory/Reports/single-void
flows. Earlier tests were updated for the intentional public labels, retail
actions, partial-history behavior and additional single-void confirmation.

Evidence: workspace parent `.review/frontend/october-16-additional/` contains
22 UI captures at 1440×900, 820×1180, 390×844, 320×568 and 820×400, plus both
Owner/Staff modifier scenarios and the three-month CSV. Sampled visual review
covers desktop, phone and short-screen balances/help, retail actions and final
confirmation. Headers, action alignment, cancellation preservation and page
containment are also checked in the browser. Original-message hashes are in
`.review/october-16-additional-original-message-hashes.json`.

The first sandboxed browser attempt could not launch installed Edge. The first
unsandboxed focused run passed ten checks and exposed a test-only decimal-format
assumption; the price value was numerically correct. The broad diagnostic run
then identified two stale test expectations (duplicate receiving controls in
different named tables, and matching old help wording instead of actual balance
availability). These were corrected before the final run. Visual review also
corrected the retail expand arrow's inherited absolute positioning. The final focused run also corrected the screenshot-only notification helper; it now leaves notifications behind open dialogs alone.

The work remains uncommitted and frontend-only. Preview people, role boundaries,
stock links, historical snapshots, sample/reset notices, dirty-form protection,
assets/licenses and test-owned Vite teardown are preserved. No backend integration,
commit or deployment occurred. No claim is made about durable data, live payments,
physical devices, real screen readers, Safari/Firefox, or native OS printing.

#### Previous continuation — after additional October 16 completion (historical; use the pending Inventory request above)

```text
The additional October 16 frontend priorities are complete. Read the full original
message and completed checkpoint above; all eight requirements are accounted for.
Preserve stock-aware new defaults and saved cart choices, direct retail receiving
and per-batch actions, Stock Details labels, editable modifier prices and fitted
checkbox labels, explicit partial-history coverage in report UI/exports, the
text/color legend, and final single/bulk void confirmations.
Do not invent pre-opening stock history or bypass incomplete-ledger checks.
Earlier completed checkpoints and scripts remain historical. All work remains
uncommitted and frontend-only; backend integration and deployment are separate.
Continue from the user's next concrete request rather than replaying old helpers.
```

#### Previous continuation — additional October 16 task recorded for a new chat (historical)

```text
Resume in C:/Users/ASUS/Documents/Personal/Vertwell/repo when the user starts the
new task. Read the entire original additional October 16 message above first,
then the last completed October 16 checkpoint and original request below,
README.md and any applicable AGENTS.md.
This additional request has only been recorded. Its fixes, report legend research
and validation have not been performed. Preserve every example, wording preference
and qualification from the full original message when carrying out the task.
The last completed baseline recorded 187 passing browser checks, root typecheck
and frontend production build; those results predate this additional request.
Preserve the existing uncommitted scaffold, five preview people, role boundaries,
stock and receipt links, historical snapshots, sample/reset notices, assets/licenses,
dirty-form protection, stock safeguards and test-owned Vite teardown.
Keep the task frontend-only and record its actual changes and verification when
performed. Backend integration, commits and deployment remain separate work.
Older completed-task scripts are historical context for this new request.
```

### Previous completed priorities — October 16 frontend fixes

**Status: completed and verified in the frontend preview on October 16, 2026.** The full original message is preserved below, including every example and qualification. The completed checkpoint records implementation, evidence and verification limits for all 19 bullets.

Read the ENTIRE original message and its completed checkpoint before future work. October 15 is the previous completed baseline; earlier stopped checkpoints and continuation scripts remain historical.

#### Original October 16 user message — verbatim, not summarized

```text
okay
I want you to add this in the Handsoff file a priority fixes for the Frontend, also when putting this in the handsoff file dont summarize it I want the intent to be in the message it is important that what I had in mind is passed on.
this will be another Task and by putting this in the handsoff I will start the task in a new chat


Dashboard
- When Im doing the Daily Sales Review it shows as modal if I click outside of the modal there should be a confirmation message that my work will be lost or unsave because Im currently typing and checking the Sales and suddenly closing and restarting all over again is frustrating for the user

- for the Daily Sales Value I dont like the + sign it should be a drop down Icon you can just search for a Drop down Icon also the table when expanding the panel after clicking the + sign there shows the table its not looking good there is a lot of black color it should have a nice looking industry standard design not like that.

Inventory
- for Recipe Product Model in the Action there is Edit and Remove there should be a another button for "See Ingredients" or find a better wordings to make it short because I want all the buttons to align in 1 row 
for example
See Ingredients | Edit | Remove

- for Bundle product model also add the "See Included Products" make this word as well shorter so that all the Buttons wont get cramped in one row. see sample below
See Included Products | Edit | Remove 

- for Variants Product Model as well just like the other two "See Variants" here find better wordings as well. see example below
See Variants | Edit | Remove

- For Retail Item Product Model just no need for See something for this one. see sample below.
Edit | Remove

- next is when I click add the + button there is a modal shows for adding a batch but when I click outside it just closes the modal there should be a confirmation same as in the Daily sales Review that my progress will be lost if I continue closing.

- ensure all the buttons align in one row 

- I dont understand why there is an item labeled Stock. isnt all the items in the inventory called stock? when I added a Variants Product Model type I saw a lot of Products that didnt show in the inventory its like a hidden stock but when I check it is labeled stock so whats the difference of those items to the others this needs fixes

- about the label Expiring Soon it should be Orange not red it is misleading for the user

- also if the batch is already 0 stock or out of stock it is no longer needed there and when I add a new batch it should be batch 1 since the older batches that is out of stock is removed already or if not automatically remove I should be able to click the remove button to remove it you decide which is better for industry standard

POS
- for specifics I found this Bug when I used all the stocks available so I made a Product that Uses Recipe and has modifiers. when out of stock it should be Unavailable but it seems I can still select it and access the modal where I choose the Modifiers but when I click the button save customization it didnt proceed which is good but in the first place I should not be able to access this modal since it is out of stock. 

- also the modal that pops up for Product with Modifiers is Titled Customize {product Name}.
can we change the title into something that is easily Understandable by the user like "Adding Modifiers" or "Add Modifiers" and change the button as well into "Add" or something. 

Reports
- remove the button Clear Filters

Audit Trail
- when doing bulk void can you add one last modal for final Confirmation that this action is cannot be undone or something like that.

User
- the modal for creating or adding a user Im already on step 3 and accidentally clicking the area outside of the Modal and what I input is just gone and not save there should be a confirmation that what I input will be discarded or I should Keep going just like in the Inventory when adding an Product/ingredients or editing it.

Overall 
- the Drop down Icon for the Drop down boxes just search an icon that can be use for the drop down Icon

- the clock filter I should be able to type the time as well also when Clicking the Clear it will clear the Time instead just make the time 00:00 when clicking clear 

- the clock filter box can you fix the design there is 2 boxes the first box is the inside covering the Time and the other box is the outside box covering the Icon and the inside box. fix this. Actually you can see the Design of the clock box there in the Reports Tab the Clock Filter there looks great only one Box that covers the Time and Icon.
```

#### Completed checkpoint — October 16 frontend fixes

All 19 bullets in the original October 16 request above are implemented and
verified in the frontend preview. The full original message remains unchanged;
its normalized-text SHA-256 is
`807e288ea874ce109cc990e2a1d54c4bcc391a7325da04d2e4a7a7a1f62d8485`.

##### Acceptance against every original requirement

| Original requirement / intent | Implementation and verification |
| --- | --- |
| Dashboard — protect Daily Sales Review from accidental outside clicks | Dirty reviews ask **Discard unsaved changes?** on backdrop, Escape, X and Cancel. **Keep editing** retains receipt checkboxes, counts, movements and notes; **Discard changes** closes explicitly. Successful confirmation saves directly. The same component protects reviews opened from Audit Trail. |
| Dashboard — dropdown icon and a lighter Daily Sales Values table | Replaced the plus/minus with a Lucide chevron that rotates on expansion. Soft table headers, lighter row labels, subtle alternating rows, aligned numeric values and bounded scrolling replace the heavy black styling. Header text is at least 12px. The disclosure remains for the user's keep/remove decision. |
| Inventory — recipe details action in the same row | **Ingredients · Edit · Remove**. Ingredients opens a read-only per-serving ingredient list with quantities, units and SKUs. |
| Inventory — compact included-products action | **Contents · Edit · Remove**. Contents lists quantities, included products, variant names/SKUs and any fixed modifier options. |
| Inventory — compact variants action | **Variants · Edit · Remove**. Variants lists each variant, SKU, price, usable quantity and configured availability. |
| Inventory — retail actions only Edit and Remove | Retail action cells contain exactly **Edit · Remove**. Receipts & batches remains under the product name so receiving is accessible without crowding the action row. |
| Inventory — protect new receipt/batch progress | Dirty receiving forms ask before backdrop, Escape, X or Cancel dismissal. Typed quantities and calendar-picked dates remain mounted behind the confirmation. Clean forms close directly and successful receiving saves directly. |
| Inventory — all table action buttons align in one row | Product, ingredient, removal and batch action cells do not wrap. Each named table region contains its horizontal scrolling. Alignment is checked at all five sizes. |
| Inventory — clarify Stock labels and apparently hidden product inventory | The editor calls these records **Product inventory**; standalone rows say **Inventory only · no POS listing**, with a plain explanation. Products contains catalogue-linked retail/variant/component receipts and every unlisted product SKU, including unusable inventory. All 19 piece-based SKU choices offered to variants are independently found in Inventory. The preview has 10 POS products and 11 additional inventory-only rows; linked variant/component SKUs live under their owning product's Receipts & batches. No stock links or snapshots are recreated. |
| Inventory — Expiring Soon should be orange | Expiring Soon uses an orange badge. Expired, unsellable and out-of-stock states retain the danger treatment; low stock retains its warning treatment. |
| Inventory — remove exhausted batches and restart visible numbering | Chose explicit per-batch removal. Remove works at zero quantity, including a single remaining batch. Confirmation removes that receipt from the live batch list and renumbers the remaining display labels; persistent IDs and previous sale/movement snapshots remain unchanged. After all old batches are removed, the next receipt displays **Batch 1**. Nonzero removal still records the quantity reduction. |
| POS — unavailable recipe with modifiers must not open its dialog | Product cards check whether any valid configuration fits current usable stock after the whole cart. Exhausted products are disabled and labeled **Unavailable** before opening. Required choices, valid omissions, variant choices and shared SKU requirements are respected; optional unavailable add-ons do not block a valid plain item. Cart/save/payment safeguards remain in place. Actual exhaustion, restocking and cart reservation are tested. |
| POS — understandable modifier title and Add button | Modifier products show **Add modifiers — {product name}** and **Add**. Editing uses **Update item**. Variant-only products say Choose variant; bundle contents and Add/Update quantity wording are retained. |
| Reports — remove Clear Filters | Removed the button, handler and obsolete reset explanation. Date/time/category/scope controls and paging still work independently. |
| Audit Trail — one final irreversible bulk-void confirmation | Existing selection and reason review now leads to a separate **Void selected orders permanently?** dialog. It states that the action cannot be undone in the sample session, shows order count, total, actor/role and reason, and explains retained audit records/payment/stock effects. **Go back**, Escape or X keeps the review and changes no sale. Only the final red Void N orders button mutates records; duplicate submission is guarded. |
| Users — protect the add-user wizard, especially step 3 | Closing a dirty wizard asks before discarding. Keep editing retains the current step, account details, verification state and password fields. Explicit discard resets the next draft and successful Add Account saves directly. Step-three preservation and creation are tested. |
| Overall — use a searched dropdown icon | Shared native dropdowns and searchable selectors use Lucide chevron-down; calendars/time controls inherit the same treatment. The Daily Sales Values disclosure uses the matching inline SVG. Source credit and ISC notice are preserved in public/assets/lucide-calendar-LICENSE.txt. Forced-color mode retains the native select arrow. |
| Overall — type times and make Clear set 00:00 | Both Dashboard and Reports use the shared editable 24-hour field. Typing 09:30 or 930 works (930 normalizes on blur/Enter); invalid times show guidance and disable the filtered action. The popover retains hour/minute selection, Set time, Now and Close; **Clear sets 00:00**. |
| Overall — one box around time and clock icon | A single shared outer border encloses the text field and clock button; the inner input has no border or shadow in both contexts. Final desktop/mobile/short-screen captures and computed-border checks pass. |

Product detail, discard and final bulk-void dialogs keep their headers separate
from the scrolling body. Product details also keep Close in the visible footer.
Every Modal now has a unique accessible title ID, including stacked confirmations.
The original form stays mounted underneath its discard confirmation. Dirty forms
also register a browser refresh/close warning; native browser prompt presentation
depends on the browser.

##### Final validation and evidence

- Root npm run typecheck: **passed, exit 0**, both workspaces. Backend implementation unchanged.
- npm run build --workspace Frontend: **passed, exit 0** on the final application source.
- npm run test:e2e --workspace Frontend -- --workers=3: **187 passed (5.7m), exit 0**, with in-process Vite teardown. Includes the 15 October 16 cases and all 172 prior regressions with updated public labels/confirmation expectations.
- All three report scopes retain Print/export PDF byte comparisons and scoped CSV checks.
- Final logs: workspace parent .review/october-16-final-typecheck.log, october-16-final-build.log and october-16-final-full.log.
- Temporary test listeners on ports 5180 and 5181 were checked absent after the run.

Evidence is in workspace parent `.review/frontend/october-16/`. The final suite
captures Daily Sales Values, Dashboard/Reports time pickers and all three product
detail dialogs at 1440×900, 820×1180, 390×844, 320×568 and 820×400. It also captures
receipt, user and daily-review discard confirmations at 320×568 and 820×400, plus
the desktop step-three and bulk-void confirmations. Sampled visual inspection
covered desktop, phone and short-screen controls; title/footer visibility is also
asserted in the browser. Final captures overwrite the earlier diagnostic versions.
The light table intentionally scrolls within its own region on narrow screens.

The first sandboxed attempt could not launch Edge; its one model assertion also
found a test-only Burger buns capitalization mismatch. A subsequent complete
diagnostic run had 168 passes and 17 failures: the 12px minimum found the new table's
11px headings, while other cases expected immediate dirty-form dismissal, no
single-batch action, or names without the new inventory-only explanation. Those
findings were corrected. The focused refinement run then had 59 passes and one
remaining old assumption that Inventory would never scroll at 1024px; it now
asserts containment while retaining the user's single-row actions. These are
diagnostic counts, not the final acceptance result. Logs and initial error
contexts/traces remain in `.review/` and `diagnostic-errors/`.

The icon was checked against the official
[Lucide chevron-down page](https://lucide.dev/icons/chevron-down), which lists its
dropdown use and ISC license. The existing inventory model, stock links, compatible
units, FEFO consumption and movement ledger were inspected directly. Explicit
empty-batch removal is an implementation choice that gives the user control;
this task does not claim an external inventory standard mandates renumbering.

Everything remains uncommitted and frontend-only. Five preview people, role
restrictions, sample/reset notices, historical snapshots, catalogue links and
original assets/licenses are preserved. Backend integration, deployment, physical
devices, actual screen readers, Safari/Firefox and native OS/paper printing remain
outside this acceptance.


#### Previous continuation — after the earlier October 16 completion (historical; use the additional priority request above)

```text
The October 16 frontend priorities are complete. Read the full original message
and its completed checkpoint before future work. The previous October 15 and
October 5 tasks are completed history; do not replay their stopped scripts.
There is no pending implementation or repeated acceptance run for this task.
Preserve the dirty-form confirmations, inventory-only product visibility,
receipt/SKU links, manual empty-batch removal, valid POS omissions and shared
cart checks, irreversible bulk-void confirmation and shared time/dropdown UI.
The Daily Sales Values disclosure remains for the user's future keep/remove
decision. Preserve historical snapshots, five preview people, role boundaries,
assets/licenses, sample/reset notices and test-owned Vite teardown.
All work remains uncommitted and frontend-only. Backend integration, commits
and deployment remain separate work. Do not replay one-time edit helpers in
the workspace parent .review directory.
```

### Previous completed priorities — October 15 frontend fixes

**Status: completed and verified in the frontend preview on October 15, 2026.**
The latest completed checkpoint after the original message records final behavior,
per-requirement evidence and verification boundaries. The entire original user
message remains unchanged and authoritative, including examples and qualifications.

Read the ENTIRE October 15 original request before future work. Then read its
latest completed checkpoint. The stopped checkpoint, interrupted results and
stopped continuation script below are historical; their unresolved statuses are
superseded by the new final acceptance. October 5 is the previous baseline.

#### Original October 15 user message — verbatim, not summarized

```text
okay
I want you to add this in the Handsoff file a priority fixes for the Frontend, also when putting this in the handsoff file dont summarize it I want the intent to be in the message it is important that what I had in mind is passed on.
this will be another Task and by putting this in the handsoff I will start the task in a new chat

First in the 

Dashboard
- in the F&B and Hobby Filter Button lets add "Overall" Button that will show the F&B Plus Hobby.
- in the Sales Overview there is a Drop down panel Daily Sales Values I like it but there should be more improved version of it and also the UI is not looking good, improve this part and I will decide whether we keep this Drop down panel or remove it.

Inventory
- in the part where I add minimum Choices and Maximum Choices in the Modifier Group I should be able to Backspace the 0 and put the number of choice I want for example in a scenario

I focused on the Minimum Choices input box and I can backspace the 0 to put the Minimum Choices I want and if I changed my mind and decided not to input anything when I exit the focused on the input box it should still keep the 0

- next is the Modifier Stock Item Drop Down can I type as well in that drop down box so that I can also search the item I want and so that I wont be needing to browse all the items from the drop down

- in the lowest part you can see the Drop down Manage Usable Finished Stock Panel can we remove all this its not needed for the system. also whats with the Finished Stock there is only Products or Ingredients there so I dont think Finished Stock is needed
(Note this that you need to further increase the Research about the Inventory we have and further understand it)

- also in the part where I edit a batch Ingredient in the Receipt Batch To correct Drop down box 
change the Word "Correct" into "Edit" and also I see the data in the drop down there it has "SKU|Quantity|Expiration Date|Status" I want you to change the SKU into Batch Number for example
Batch 1 | 100 pcs | 2026-12-31 | In Stock

- also when selecting the specific Batch I want to align the Quantity number of that Specific Batch not the Quantity number of all the Batches because we are focusing on what we need to change in specific batch not all the batch, same goes with the Date and Expiry On when Selecting specific Batch.
Also I should be able to Type in the Drop Down Boxes so that I can also be able to search down which Batch is needed an edit.

- when there is a batch list the Remove button should be move in lined with the row of each Batches for example 
I have here Batch 1 and Batch 2 I should be able to have Remove Button for Each of this Batches 

- in the part where adding a Recipe the quantity there I should also be able to Backspace the 0 just like what I had discuss in the Modifiers Minimum Choices and Maximum Choices. also when Clicking the up button to increase quantity when In pcs unit it should go up as whole number not decimal only in pcs and bottles only.

- in the bundle part when selecting the Stock instead of Stock use the word Product or Available Product and also I should be able to choose all the Available Products not only the Retail Products. also when selecting stock model change the "Stocked/Retail Item" into "Retail Item".
then in the SKU and Item Code Part

in the SKU
the auto Generate should have a Code Format for example let X be the number of digit (XXXX = 4 digits)
in Product 
Hobby: 
Retail: PRR-HB-XXXX
Variants: PRV-HB-XXXX
Bundle: PRB-HB-XXXX


Food:
Retail: PRR-FD-XXXX
Variants: PRV-FD-XXXX
Bundle: PRB-FD-XXXX
Recipe: PRRC-FD-XXXX

Beverage:
Retail: PRR-BV-XXXX
Variants: PRV-BV-XXXX
Bundle: PRB-BV-XXXX
Recipe: PRRC-BV-XXXX

P.S. (In the Recipe part "PRRC" I kinda not like it and I think you can improve this Code better just make sure it wont get mixed up with the code in Retail, you can also change the code in retail if you can find some more improve version of what I made just to improve the Code in Recipe.)

also in ingredients
Food: IN-FD-XXXX
Beverages: IN-BV-XXXX

same goes with the Item

- the remove button can we make the color of it Red just like in the Needed to Remove Stocks where the button Remove Stocks Color

- when Selecting Date the UI I can see the "Today", and "Close" can you add there "Clear" so that I can clear the Date

- in the tables I want to be able to just Click and it will Highlight the Specific row of what I selected and Unselect it with clicking it again, no other functions just when clicking it will get highlighted. because the only time the row will get highlighted is when I select from Dashboard or Edit the row after that the highlighted row is still there and I cant Unselect that Row but the highlight will be gone after I select different tab for example I go to POS and Goes back to Inventory the Highlighted Row in the Table there is gone.

- in the part where I add Product in the Product Modifiers section there is a drop down Reuse a library Group. at first I got confused because I thought I only need to select from the drop down and the product will already have that group modifiers, but when I click save and I lookup at the POS I dont see the modifiers there and when I go back and edit it I then try to click the Add library copy and  then it works. this part is confusing so can you change the text of the Button "Add Library Copy" to make it more easily understandable for the user even me the developer got confused by this and I like it that it wont add the group modifiers that I choose from the library drop down without selecting the button but the button itself is misleading for me I think there is still room for improvement on this part.

- also in food and bev adding a product or ingredients must need or the user is required to input a manufacturing date and expiration date it is a must and in the Hobby we can just let the user ignore or not require the user to input Manufacturing Date and Expiration but dont remove these input boxes there will still be a time where the user will input it but it will be optional instead. 

POS
- in the part where the Variant Product shows there shows that "₱ FROM 750" can we change that into "₱ FROM {Lowest Price} TO {Highest Price}"
for example "₱ FROM 750 TO 1250"
- also whenever I select the Bundle there shows the  Modal titled "Customize {Product Name} Bundle", lets improve this modal instead of Customize title change this because the only thing you can do here is change the quantity so we gonna make this modal into information only and still keep the Quantity Adding there  but make the List of Included bundle in this way instead of the Modal titled Customized {Product Name} Bundle, it will be change into List something included in the bundle you can pick the title something that would fit with the contents of the modal. in this way we can make the Bundle Product shows a modal and inform the user the contents of that bundle and still be able to choose quantity and instead of "save customization" button change the word into "Add"
with this the misleading Title of the Modal will be change along with the Button Save Customization button.

Reports
- the Print Button it shows the Print Report I dont think it needs a UI for this part and also we already have the Export Report button for downloading the PDF|CVA of it so the button Download PDF in the Print Report Modal is not needed. we can also just remove the whole modal since this is only for printing no need UI modal for it, because we can just use the already built in PDF Viewer for Browsers.

- the Time selection here can we also have a nice UI for it for picking time just like in the Calendar also add there a instead of "Today" in calendar we use "Now" or if you can improve it do it, and add "Clear" as well. 

- there is a lot of table here so I think we can make that each pages of the table can only contain 4 rows to minimalyze the UI so the other rows will go to next page.

- in the Table Ingredient Usage / Remaining Stop I see here that there is a Drop Down Small Panel named "How Stock Balances are Calculated" I think its a nice way of explaining how the system calculates the remaining stock and its good but the way it explains it, is hard to understand. it needs improvement in explaining there for the User to easily understand.

Audit Trail
- no fixes needed

Users
- No fixes needed

Overall
- the fix for UI for Selecting Date in calendar should be implemented in all Date Selection Boxes the same goes with Time the new UI for time not only used in the Reports.
```

#### Completed checkpoint — October 15 frontend fixes (latest)

All October 15 requirements in the original message above are implemented and
verified in the frontend preview. This checkpoint supersedes the historical
stopped checkpoint and its continuation script below. The original message is
unchanged; its normalized-text SHA-256 remains
`3e79da57d313857ed9e5df2578788f34606dbaa46e59642492a98fcd017d6051`.

The remaining calendar and inventory-consolidation gaps are resolved. Receipt
and batch controls live inside each product's **Receipts & batches** row. Retail
products, variants and legacy bundle component SKUs retain their existing stock
links. Product inventory without a POS listing remains accessible in the same
Products table. There is no separate bottom Product stock table or Finished Stock
management disclosure. A stock search expands its matching receipts; the control
can close them again. Clicking a product row only toggles its highlight.

Calendar month navigation and Today/Clear/Close stay visible while only the days
scroll on short screens. Internal grid scrolling no longer repositions the panel.
The bundle dialog opens at its included-products list, including on short screens;
quantity remains editable and Add remains in the visible footer. Fixed variants
and included modifier choices are displayed as information.

##### Acceptance against every original requirement

| Original requirement / intent | Final status and evidence |
| --- | --- |
| Dashboard — Overall combines F&B and Hobby | Completed. Actual catalogue revenue reconciles with the two category totals; category/date/time drill-down reaches Reports. |
| Dashboard — improve Daily Sales Values, then let the user decide whether to keep it | Completed. The improved disclosure remains for review, with totals, dates, completed-order counts and a bounded table. It has not been removed; the user's future keep/remove decision is still open. |
| Inventory — erase Minimum/Maximum Choices zero, restore zero when leaving an empty field | Completed. Both fields accept empty drafts, replacement numbers, and zero restoration on blur. |
| Inventory — type/search Modifier Stock Item | Completed. Editable combobox filters name/SKU and supports pointer selection, arrows, Enter and Escape. Actual Espresso beans selection and library regressions pass. |
| Inventory — remove the whole obsolete Finished Stock panel and understand the inventory model | Completed. Products owns linked retail/variant/component receipts and unlisted product inventory. No separate management table/disclosure remains. Actual receive/count/batch flows, unique IDs, catalogue enumeration, stock reconciliation and shared-component sales pass. Internal accounting kinds are retained to preserve links and history. |
| Inventory — Correct becomes Edit; selector shows Batch Number, quantity, expiry and status | Completed. “Receipt batch to edit” displays stable Batch N labels; raw IDs remain internally searchable. Actual Oat Milk and cookie batch selections pass. |
| Inventory — selected batch quantity/manufacturing/expiry are independent | Completed. Selection loads that batch's values; save replaces only that batch and recomputes physical totals. Oat Milk, expired/usable cookie and newly received Deluxe variant batches pass, including negative-count and compatible-unit regressions. |
| Inventory — search receipt batches | Completed. Typed Batch 2 and actual pointer selection pass, using the saved combobox helper without selector ambiguity. |
| Inventory — per-batch aligned Remove action | Completed. Each expanded batch has Edit and red Remove actions. Removing Oat Milk batch 2 leaves batch 1 unchanged and records the movement. |
| Inventory — erase recipe zero; pcs/bottles arrows use whole numbers | Completed. Empty/blur/ArrowUp checks pass; counted units use step 1 and mass/volume uses 0.001. |
| Inventory — bundle selector says Available product and includes every product model | Completed. All ten actual catalogue products are available for selection. Recipe, fixed variant/options, nested bundle, omission, cycle, missing-product and shared-SKU cases pass. A recipe bundle and a Deluxe/cheese bundle check out against their actual inputs. |
| Inventory — Retail Item wording | Completed. Dropdown/table wording and the Hobby model-switch regression pass. Remaining user-facing validation messages now say product stock. |
| Inventory — category/model four-digit SKU and Item Code generation | Completed. PRR/PRV/PRB/PRC with HB/FD/BV; Ingredients IN-FD/IN-BV. PRC is the improved recipe prefix. Matrix/collision/UI tests pass; saved legacy identifiers are preserved. |
| Inventory — Remove controls are red | Completed. Record/product/batch, recipe/modifier/configuration/photo/library removals use the danger style; sampled final receipt/editor/library views are reviewed. |
| Inventory — calendars have Clear beside Today and Close | Completed. Actual pointer hit-testing verifies visible 44px footer controls at all five sizes, including 820×400. Today, Clear, Close, Escape and focus restoration work in Dashboard, receiving, editor and Audit; Reports Clear passes at every size. |
| Inventory — clicking a row only toggles its highlight | Completed. Ingredient, product and batch rows support click/Enter/Space; a second activation unselects. Product highlighting does not open receipts. Nested controls do not select parent rows. |
| Inventory — clear explicit library attachment action | Completed. “Attach group to product” and helper text explain the action. Selection alone saves no modifiers; explicit attachment makes Gift wrap available at POS. Copy/default/isolation regressions pass. |
| Inventory — F&B product/ingredient dates required; Hobby dates optional and visible | Completed. Actual missing-date rejection and successful dated creation pass; product-mode required attributes and undated Hobby creation/receiving pass. Both fields remain available. |
| POS — lowest TO highest variant price | Completed. Actual Model Kit Editions shows From 750 To 1250; pricing/discount regressions retain variant calculations. |
| POS — informational bundle contents, quantity, Add | Completed. “Included in …” shows fixed products/variants/options, with editable bundle quantity and Add (Update quantity for an existing line). Initial focus keeps the included list visible; Owner/Staff openings and footer access pass at all five sizes. Stock shortages still prevent overcommit. |
| Reports — direct browser PDF viewer, no Print modal/Download PDF there | Completed in app. Print opens the PDF viewer tab. Combined, Sales and Inventory usage Print/export PDFs are byte-identical; CSV contains every scoped sale/stock record. Export retains PDF/CSV downloading. Native viewer controls and OS/paper printing remain unverified. |
| Reports — time picker with Now/Clear | Completed. Shared 24-hour picker provides Set time, Manila Now, Clear, Close and Escape/focus handling. Actual interaction and sampled views pass at all five sizes. |
| Reports — four records per table page | Completed. Every report table, ingredient balances and attention list uses four records; paging/reset checks pass. CSV, PDF and print media still include every scoped record. Inventory and Audit retain six-record paging. |
| Reports — simpler stock balance explanation | Completed. Plain formula, 10 + 5 − 4 − 1 = 10 bottle example, colors, physical/usable, period/current and missing-baseline explanation are visible and readable at all five sizes. Calculations retain their regression coverage. |
| Audit Trail — no page-specific fixes | Preserved. Shared calendars improve; existing role/void/review/audit behavior passes. Owner confirmation does not deduct stock twice. |
| Users — no fixes | Preserved. Users application source/policies are unchanged; all identity, isolation, wizard/search/deletion/access regressions pass. |
| Overall — date/time improvements apply globally | Completed. All date fields use DateField; Dashboard/Reports time fields use TimeField. Full context/size checks and source sweep pass. |

##### Final validation and evidence

- Root `npm run typecheck`: **passed, exit 0** (both workspaces; backend implementation unchanged).
- `npm run build --workspace Frontend`: **passed, exit 0**, after the final bundle-focus refinement.
- `npm run test:e2e --workspace Frontend`: **172 passed (5.7m), exit 0**, on final unchanged source, with in-process Vite teardown.
- All 24 October 15 cases pass (17 original acceptance cases plus seven added context/receipt/fixed-option cases), alongside all prior regressions.
- Combined, Sales and Inventory usage PDF viewer/export byte comparisons and all-record CSV checks pass in the final suite.
- Logs in workspace parent `.review/`: `october-15-final-typecheck.log`, `october-15-final-build.log`, `october-15-final-full.log`, `october-15-final-visual.log`, `october-15-final-bundle-visual.log`.
- Temporary listeners on ports 5180 and 5181 were checked absent after completion.

Fresh evidence is under workspace parent `.review/frontend/october-15/`:
`final/` has calendar-context and product-receipt acceptance captures;
`final-visual/` has 50 broad captures and checks.json, plus ten final Owner/Staff
bundle openings in bundle-checks.json. The ten role-named bundle images supersede
the five earlier generic bundle images captured before the focus refinement.
Images use both width and height. Sampled visual inspection covers all five sizes:
1440×900, 820×1180, 390×844, 320×568 and 820×400, including receipt actions,
Dashboard values, balance explanations, date/time popovers and bundle contents.
The broad capture run reports no page overflow or browser/HTTP errors; intentional
table scrolling remains inside each table. Calendar-context tests additionally
check pointer hit targets, keyboard navigation and focus restoration.

The earlier 45/46 and 27/28 diagnostic runs, deliberately interrupted pre-focus
full run, and 170/172 run are retained as history. The latter found two stale
legacy expectations: four empty sections after a section was removed, and the old
“finished stock” validation wording. Both now assert the intended UI explicitly;
error contexts/traces are preserved in `resumed-regression-errors/`. These runs
are not final acceptance counts. The final full-suite run below is on unchanged
application/test source, with three browser workers selected for that run.

Inventory investigation covered seed stock/receipts, catalogue models, recursive
requirements, unit conversion, FEFO consumption, movement reconciliation and
historical snapshots. Background references were the
[W3C editable combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/),
official [Odoo lot guidance](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/product_management/product_tracking/lots.html),
[expiry guidance](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/product_management/product_tracking/expiration_dates.html)
and [kit guidance](https://www.odoo.com/documentation/saas-19.3/applications/inventory_and_mrp/manufacturing/advanced_configuration/kit_shipping.html).
Odoo search excerpts were available; some direct page opens failed. The preview's
concrete behavior is established by its code and tests, not assumed from Odoo.

Everything remains uncommitted and frontend-only. Sample data/reset notices,
assets/licenses, five preview people, role boundaries, stock history and once-only
checkout consumption are preserved. Backend integration, physical devices, actual
screen readers, Safari/Firefox and OS printing remain outside this acceptance.

##### Current continuation

```text
The October 15 frontend priorities are complete. Read the entire preserved
original message and the latest completed checkpoint before future changes.
The stopped checkpoint/continuation and October 5 notes below are historical.
No continuation implementation or repeated acceptance run is pending.
The improved Daily Sales Values disclosure remains for the user's later
keep/remove decision. Preserve product receipt links, batch-specific edits,
historical snapshots, role restrictions, original assets/licenses and sample
notices. New backend work, commits and deployment require a separate request.
Do not replay any one-time edit helpers in parent .review/.
```


#### Historical stopped checkpoint — October 15 implementation in progress

The user explicitly stopped implementation and requested this handoff update.
Application/test edits stopped. The running affected browser suite was interrupted
with Ctrl+C (exit 1), without a successful final summary. The subsequent listener
check found no listeners on ports 5180 or 5181. Only documentation and preservation
of existing failure evidence were performed after the stop. All work remains
uncommitted and frontend-only. No backend implementation, commit or deployment
occurred. README still describes the completed October 5 baseline; its new
checkpoint has not been written.

The original October 15 block above has normalized-newline SHA-256
`3e79da57d313857ed9e5df2578788f34606dbaa46e59642492a98fcd017d6051`.
Its wording, examples and qualifications were not edited. The original October 5
request and older history are also retained. **This priority task is incomplete.**

##### Status of each original requirement

“Completed” below means the specific behavior has implementation and targeted
evidence; it does not claim that the whole final-source suite or all visual states
passed. Wider regression gaps are recorded separately. “Partially completed” means
implementation exists but a requirement/verification gap remains. No original
bullet has been intentionally discarded.

| Original requirement / intent | Status at stop | Changes, evidence and remaining work |
| --- | --- | --- |
| Dashboard — Overall combines F&B and Hobby | Completed | Three category buttons; Overall uses All categories for stock, sales, metrics, chart and Reports drill-down. Latest acceptance verifies that Overall revenue equals the two category totals and carries All categories into Reports. |
| Dashboard — improve Daily Sales Values panel; user decides later whether to keep it | Completed | Retained the disclosure for review. Added a total/day summary, explanatory subtitle, completed-order counts, formatted dates, striped rows, sticky headings and a bounded scrolling table. Targeted opening/content checks and sampled visual review passed. The user's keep/remove decision remains open, as requested; do not remove it automatically. |
| Inventory — erase Minimum/Maximum Choices zero while editing; blank restores zero on blur | Completed | Shared NumberField keeps an empty draft and restores zero on blur. Latest acceptance checks both minimum and maximum, plus typing a replacement number. Library-copy/default regressions also passed in the affected run. |
| Inventory — type/search in Modifier Stock Item dropdown | Completed | Shared SearchSelect replaces recipe/modifier stock selects. Filters name/SKU and supports arrow keys, Enter, Escape and pointer selection. Latest acceptance searches Espresso beans and selects it with the keyboard. Small-screen legacy selector coverage is still part of unfinished overall regression acceptance. |
| Inventory — remove the entire Manage Usable Finished Stock panel; only Products/Ingredients are needed | Partially completed | Removed the finished-stock disclosure and user-facing Finished labels in the edited Inventory/configuration UI. However, its usable receipt records are still displayed in a separate bottom **Product stock** table in Products/All inventory. This is not full removal of the former management UI. Resume by reconciling the full original intent and placing necessary receipt/variant/bundle controls within Products without reintroducing the obsolete panel. Do not delete the internal stock records and orphan catalogue links. |
| Inventory — research and understand the inventory further | Partially completed | Audited demo data, stock kinds, catalogue models, requirements/usage, App updates, receipt batches and movement reconciliation. Researched editable-combobox and lot/kit guidance. The UI consolidation above still needs completion and verification; do not treat research as proof that the retained bottom table satisfies the request. |
| Inventory — Correct becomes Edit; batch selector shows Batch Number, quantity, expiry and status | Completed | “Receipt batch to edit”; options use `Batch N | quantity unit | expiry | status`, with stable batch numbering rather than raw receipt IDs. Source and actual Oat Milk selection are checked. Batch IDs remain searchable/internal for historical links. |
| Inventory — selecting a batch loads/saves that batch's quantity, manufacturing date and expiry, not aggregate values | Partially completed | Editor initializes from a batch, selection loads its three values, save replaces only that batch and recomputes aggregate physical quantity. Current-catalogue acceptance saves Oat Milk batch 2 with changed quantity/dates and verifies batch 1 is unchanged. Compatible-unit and negative-count regressions were adapted, but several batch regressions hit a test-selector ambiguity before stop; the last helper fix is saved but unverified. |
| Inventory — type/search which receipt batch needs an edit | Completed | SearchSelect filters visible Batch N/quantity/date/status and internal batch ID. Latest actual batch-2 typed-search acceptance passed. Broader adapted helper tests remain unverified as noted above. |
| Inventory — Remove button aligned with each batch row | Completed | Expanded batch rows have their own Edit and red Remove controls. Removal zeros only the selected batch, preserves other batches/history, and records the physical quantity change through App's movement ledger. Actual Oat Milk batch-2 removal passed while batch 1 stayed nonzero. |
| Inventory — recipe zero may be erased/restored; pcs/bottles arrows use whole numbers | Completed | Recipe quantity uses NumberField; step 1 for pcs/bottles, 0.001 for other units. Latest acceptance checks empty/blur restoration, pcs ArrowUp and step values for bottles and grams. Existing ingredient/omission calculations remain; no recipe data migration occurred. |
| Inventory — bundle selector says Product/Available Product and includes all available product models | Partially completed | New selections use the product catalogue, including recipes, variants and bundles. Fixed variant/options are chosen in Inventory. Recursive requirements aggregate actual ingredient/product usage, protect cycles/missing/unavailable components and share stock with standalone sales. All ten actual products appear; a recipe bundle checkout and model-level usage checks pass. Existing fixed-SKU components remain valid. Adapted variant/bundle/history regressions were not all reached or confirmed, and fixed-option edge cases need final acceptance. |
| Inventory — Stocked/Retail Item becomes Retail Item | Partially completed | Source dropdown and table labels are changed to “Retail Item.” Actual new retail creation passed, but the specifically updated Hobby-model-label regression had not been reached in the latest interrupted run. Confirm that rendered label in the next focused pass. |
| Inventory — requested four-digit SKU AND Item Code formats across category/model, including improved recipe prefix | Completed | Generator uses PRR/PRV/PRB and **PRC** for recipes, with HB/FD/BV and four digits; Ingredients use IN-FD/IN-BV. It skips IDs/SKUs/codes already in use and reports exhaustion. Model/category matrix and collision checks passed; UI Generate verifies ingredient SKU/code and Hobby retail SKU. PRC is the chosen improvement over PRRC; saved catalogue IDs/SKUs were not migrated. |
| Inventory — Remove buttons red like Remove Stocks | Completed | Removal controls for records, products, batches, recipe/modifier inputs/options/groups, variant/bundle components, photos and library removal use danger-button. Existing confirmation controls remain red. Source review and sampled batch/product-editor/library visuals covered the change; exhaustive color assertions were not added. |
| Inventory — add Clear alongside Today/Close in calendars | Partially completed | Shared DateField has Clear and required markers/labels; clear propagates an empty value. It passed several sizes and contexts. **Latest 820×400 calendar Clear failed**: footer is clipped/scroll-sensitive and another select intercepted the click before the popup closed. This is a real unresolved short-screen interaction, not grounds to weaken the test. |
| Inventory — row click only highlights; repeat click unselects | Completed | Stock, product and batch rows toggle a single highlight; Enter/Space are supported. Buttons do not trigger row selection. Latest direct ingredient-row click/keyboard acceptance passed. Dashboard batch context now selects the specific batch, rather than both parent and batch; older double-highlight expectations were updated, with some updated guards still needing rerun. |
| Inventory — clearer explicit action for library group attachment; selecting alone must not attach | Completed | Button is “Attach group to product”; helper text explains selection plus attachment and independent copies. Latest acceptance saves after selection alone (no POS modifiers), then attaches and saves (Gift wrap appears at POS). Library-copy/default/isolation checks passed in the affected run. |
| Inventory — Food/Beverage product and ingredient dates required; Hobby optional without removing fields | Completed | Dates remain visible for all product modes and stock/ingredient editors; required when category is not Hobby. Recipe/variant/bundle product metadata stores dates without inventing standalone stock. Stocked batch edits use batch dates. Latest checks cover Food mode required attributes, a Beverage ingredient blocked without dates then saved with them, and an undated Hobby retail saved successfully. Receiving still requires F&B dates. |
| POS — variant price shows lowest TO highest | Completed | Catalogue card shows discounted available-variant range, e.g. ₱ From 750 To 1250. Actual Staff Model Kit acceptance passed. |
| POS — informational included-bundle modal, quantity retained, Add action | Partially completed | Title “Included in {product name}”; individual included-product rows; fixed contents/options; quantity controls; persistent footer with Add (Update quantity when editing). Removed the bundle's technical stock list, while shortages still validate/show errors. Latest Staff visual/interaction and recipe-bundle checkout passed. Broader bundle regressions remain unverified; one adapted Add locator is too broad and must be corrected. |
| Reports — remove Print modal/Download PDF there; use browser's PDF viewer | Partially completed | Print opens a browser tab synchronously and navigates it to the generated PDF; no application Print modal/iframe/download action. Export retains PDF/CSV downloads. Blob remains available after leaving Reports. Latest Combined acceptance checks viewer URL and identical Print/export bytes. Updated all-scope regression passed the Combined PDF comparison but then failed a host-date/browser-date CSV expectation before Sales/Inventory usage scopes; final all-scope verification is pending. OS/paper printing is unverified. |
| Reports — time picker with Now/Clear | Completed | Shared TimeField has 24-hour hour/minute controls, Set time, Now (Asia/Manila), Clear, Close and Escape/focus handling. Latest checks exercise Now/Clear/Set at all five specified dimensions; the short-size composite test failed later on the calendar, not on TimeField. |
| Reports — four rows per table page | Completed | Pagination takes a pageSize; ReportTable, ingredient balances and attention use 4. Inventory/Audit retain 6. All-scope exports and print media still include all records. New checks assert every rendered report table has at most four visible rows and verify page 2 ranges. A legacy clear-filter assertion still expects one page for six records and must be updated to two pages; full final regression remains pending. |
| Reports — understandable stock balance explanation | Completed | Plain formula and a 10 + 5 − 4 − 1 = 10 bottle example explain denominator, colors, expired vs usable, period closing vs current stock, full-day bars/time-filtered sales and missing baselines. Latest responsive checks verify the example; calculations are unchanged. |
| Audit Trail — no fixes needed | Completed | No page-specific implementation edits. Existing audit, Owner review, Admin void, stock-retention and role-isolation cases passed in the running suites; final full-suite acceptance is still outstanding. Shared calendar improvements apply here too. |
| Users — no fixes needed | Completed | Users application source/policies were not edited. All six Users regression cases passed in the completed first broader run. Final whole-suite rerun is pending. |
| Overall — shared Date and Time UI everywhere, not only Reports | Partially completed | All existing date inputs use DateField; Dashboard/Reports time inputs use TimeField. Shared calendar/time controls and required-date semantics are implemented. The 820×400 calendar footer issue prevents global completion; other editor/receiving/Audit contexts need final responsive verification after its fix. |

##### Saved implementation and test changes

- New shared `Frontend/src/components/NumberField.tsx`, `SearchSelect.tsx`,
  `TimeField.tsx`; new `Frontend/src/data/item-codes.ts`.
- Updated `DateField.tsx`, `ModifierFields.tsx`, `ModifierLibrary.tsx`,
  `ProductConfigurations.tsx`, `CustomizeProduct.tsx`, `Pagination.tsx`,
  `ReportTable.tsx`; pages `Dashboard.tsx`, `Inventory.tsx`, `Pos.tsx`,
  `Reports.tsx`; `data/demo.ts`, `data/inventory.ts`, `data/catalogue.ts`;
  styling in `redesign.css`.
- Data additions: optional stable batch number; optional product dates; optional
  bundle product/variant/modifier references. Existing catalogue, five identities,
  seed/historical snapshots, fixed-SKU bundles and assets/licenses are retained.
  Consumption remains once per checkout; Owner review does not deduct again.
- `Frontend/tests/october-15-ui.spec.ts` now has **17 checks**, including actual
  preview flows, stock-model calculations, explicit library attachment, required
  dates, generation, PDF equality and five sizes. New test helpers:
  `tests/fixtures/save-record.ts` supplies newly required F&B dates to older
  scenarios; `tests/fixtures/search-select.ts` exercises actual option clicks.
  Affected older tests are being adapted for batch-specific quantities, new
  selectors/labels, four-row Reports and viewer-based Print. Assertions must not
  be weakened to get a passing count.
- Historical one-time edit helpers are saved in parent `.review/`:
  `october-15-edits.py`, `october-15-inventory-edits.py`,
  `october-15-regression-edits.py`, `october-15-print-test-edit.py`.
  **Do not replay them.** Some intentionally match only pre-edit source.

##### Validation actually performed, and its limits

- Final application-source root `npm run typecheck`: **passed, exit 0**;
  saved in parent `.review/october-15-typecheck.log`. Backend was typechecked
  only; its implementation was not changed.
- Frontend production build **passed earlier in this implementation**, before
  later bundle-footer, date-label and Print-URL refinements. A fresh build of
  the latest source is **pending**; do not claim final build acceptance.
- Initial sandboxed 15-check run: 2 model checks passed, 13 browser launches
  failed before interaction because Edge could not create its sandbox temporary
  profile. Subsequent authorized runs outside that sandbox launched Edge.
- First completed broader run: **134 passed, 29 failed, 163 total (9.6m),
  exit 1**. Log: `.review/october-15-first-full.log`. Source/test changes occurred
  while this run was active, so it is diagnostic evidence, not final-source
  acceptance. Fifteen October 15 checks passed there, before the suite expanded
  and the short-screen calendar failure was reproduced.
- Latest affected run requested 100 checks. It was **interrupted by the user's
  stop** after the log recorded **66 passed, 9 failed, 25 not reached**; exit 1
  without a successful suite summary. Log: `.review/october-15-focused.log`;
  parsed observed counts: `.review/october-15-interrupted-results.json`.
  Latest October 15 cases: **16 passed, 1 failed** (820×400 calendar Clear).
  These are observed case results, not a completed 100-check run.
- No successful final full-suite run, latest production build, complete final
  visual acceptance or all-scope Print/export verification exists. Do not reuse
  the October 5 baseline's 148-pass statement as proof of this task.

##### Known issues and interrupted work — resume here

1. **Real short-screen calendar issue:** `DateField.tsx` positions a popover whose
   calendar/footer can exceed a 400px viewport. In the latest 820×400 case the
   Clear button was clipped/scroll-sensitive; a report select intercepted its
   click and the popup disappeared. Inspect DateField positioning/focus/scroll
   handling and `.calendar-popover`, `.calendar-days`, footer CSS in
   `redesign.css`. Keep Today/Clear/Close reachable while retaining 44px targets,
   range bounds, arrow/month keyboard behavior, Escape and focus restoration.
   Do not use forced clicks or skip the test. Verify in receiving/editor/Audit
   as well as Reports/Dashboard.
2. **Panel removal is incomplete in intent:** the old disclosure is gone, but
   its bottom Product stock table remains. Finish the Product-side receipt/batch
   workflow so the obsolete management panel is actually removed. Internal
   Finished is still an accounting kind used by retail/variants/legacy bundles;
   deleting it blindly would break stock links. This was not resolved before stop.
3. **Batch helper fix saved but unverified:** `getByLabel('Receipt batch to edit')`
   also matched its Show choices button. `fixtures/search-select.ts` was changed
   during the run to intersect the locator with role combobox. Already-loaded
   tests still reported the old ambiguity. Re-run the batch cases with the saved
   helper; preserve the actual 6 expired + 4 usable cookie scenario and compatible
   unit/batch totals, using **4 for batch 2**, not aggregate 10.
4. **Paging test corrections saved but partly unverified:** an earlier replacement
   incorrectly changed Inventory/Audit Page 2 of 2 expectations to 2 of 3.
   `priority-feedback.spec.ts` was corrected during the affected run to retain
   six-row paging outside Reports; those corrections are unverified. Its Reports
   Clear filters assertion still says Page 1 of 1 although six records now occupy
   **two** four-row pages. Keep all-record CSV/print assertions intact.
5. **Bundle test locator:** `redesign-continuation.spec.ts` uses
   `getByRole('button', { name: 'Add' })` without exact matching in the Cafe Snack
   case, matching catalogue/Add-one buttons too. Scope it to the dialog or use
   exact matching; then verify shared-SKU shortages and retained snapshots.
6. **All-scope report test date mismatch:** updated
   `redesign-continuation.spec.ts` freezes the browser to October 5, while Node's
   `createDemoData()` uses the current host business date (October 15). The
   Combined PDF Print/export byte comparison succeeded, but CSV expected a
   `20261015…` seed ID outside the browser's recorded October 5 range. Make expected
   data deterministic for the browser date without removing scoped-record checks,
   then verify Combined, Sales and Inventory usage PDFs/CSVs. The later two scopes
   were not verified by the interrupted run.
7. Variant/bundle/Hobby-label and later redesign regressions were not all reached
   in the latest run. Finish the affected cases, then root typecheck, latest
   frontend build and the entire browser suite with a clean exit. Preserve
   test-owned Vite startup/teardown in `tests/setup-server.ts`.
8. **Evidence naming:** October 15 screenshots currently use width-only names,
   so the 820×1180 and 820×400 cases can overwrite each other's images in parallel.
   Use both width and height in future filenames. Full-page popup captures can
   alter scroll/viewport presentation; viewport PNGs were also added. Complete
   visual review of all five final states is pending.

Evidence is in workspace parent
`C:/Users/ASUS/Documents/Personal/Vertwell/.review/frontend/october-15/`:
full-page/viewport PNGs and sampled crops, `regression-october5/` captures,
`regression-pdfs/` partial report evidence, and `interrupted-errors/` copies of
the nine error contexts and traces. Do not lose those copies when Playwright
overwrites `Frontend/test-results`. Sampled views inspected include small-screen
calendar/time controls, the recipe-bundle editor and the final Staff bundle dialog.
The 820×400 calendar screenshot shows the clipped footer. This is not a claim
that every captured page/state has been visually accepted.

Research references: [W3C editable combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
was read for typing/list/keyboard behavior. Official Odoo
[expiration-date guidance](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/product_management/product_tracking/expiration_dates.html)
and [kit/component stock guidance](https://www.odoo.com/documentation/17.0/applications/inventory_and_mrp/manufacturing/management/kit_shipping.html)
were searched for lot expiry/FEFO and component-level inventory; some direct Odoo
page opens returned errors, so no full-page research/industry certification is
claimed. Existing inventory code, not external generic advice, establishes this
preview's concrete stock model. Physical devices, screen readers, Safari/Firefox,
OS/paper printing, durable backend/auth/payment integration remain unverified.

#### Historical continuation script — stopped October 15 task

```text
The user explicitly STOPPED implementation on October 15. Resume only when the
user authorizes it, in C:/Users/ASUS/Documents/Personal/Vertwell/repo.
Read the ENTIRE "Original October 15 user message — verbatim, not summarized"
above first. It is authoritative; preserve its scenarios, examples, formats and
qualifications. Do not substitute this script or the progress checklist for it.
Then read the October 15 stopped checkpoint, every requirement status, known issues,
README.md and applicable AGENTS.md. October 5's 148-pass checkpoint is historical.

The task is PARTIALLY COMPLETED. Application changes exist, root typecheck passed,
but latest build/full acceptance are pending. The affected 100-check run was stopped
after 66 logged passes, 9 failures and 25 not reached; no clean final summary.
Latest October 15 acceptance has 16 logged passes and a real 820x400 calendar Clear
failure. No Vite listener remained on 5180/5181 after interruption.

Start with the short-screen DateField footer/position/scroll problem described in
known issue 1. Keep Today/Clear/Close reachable and verify pointer/keyboard/focus in
Reports, Dashboard, receiving, record editors and Audit. Then finish removal of the
obsolete Finished Stock UI without orphaning internal retail/variant/bundle stock.
Check the saved, unverified search-select helper fix and Inventory/Audit paging
test corrections. Fix the remaining Reports reset-page expectation, broad bundle
Add locator and host-October15/browser-October5 report-fixture mismatch. Read the
preserved error contexts/traces before changing assertions. Do not weaken tests.

Run focused calendar, batch, bundle, library, four-row-report and all-scope viewer/
export checks; then root typecheck, a fresh Frontend build, and the full browser
suite with clean teardown. Edge launch required the authorized outside-sandbox
execution path in this environment. Do not mistake a launch failure for app evidence.
Use width AND height in new capture names, visually inspect final states at 1440x900,
820x1180, 390x844, 320x568 and 820x400, and preserve prior QA artifacts. Final visual
acceptance is pending. Do not replay any historical one-time edit helpers.

Keep all uncommitted work, actual catalogue/five preview people, source assets and
licenses, sample/reset notices, role restrictions, historical snapshots, batch/unit
handling and once-only checkout stock deduction. Owner review must not deduct again.
Keep tests/setup-server.ts's test-owned Vite with in-process teardown. Distinguish
actual current-preview acceptance from test-only legacy fixture regressions.
Keep the task frontend-only; backend integration, commit and deployment are separate.
The redesigned Daily Sales Values disclosure stays for the user's keep/remove review.
After actual completion, update this per-requirement checkpoint and README with real
final results. Do not mark the entire priority task complete until EVERY requirement
is implemented and verified, including the global calendar and panel-removal gaps.
```

### Previous completed checkpoint — October 5 frontend priorities verified

**All 18 original requirements are implemented and verified in the frontend
preview.** This checkpoint supersedes every older pause, incomplete status and
continuation script below. The full original six-section message remains verbatim
under **Highest priority — frontend fixes for a new chat (October 5, 2026)**.
Its normalized-text SHA-256 remains
`def4c1155a7213efff773dd478af43c9e3b1ae017e5bc167783cf73c0899c844`.

The saved implementation already contained the requested behaviors. This resume
completed the previously interrupted final-source browser and visual acceptance,
including the last Reports body-word wrapping refinement. No additional application
source change was necessary. `Frontend/tests/october-5-ui.spec.ts` now writes fresh
evidence to `ui-accepted/`, preserving earlier `ui/` and `ui-final/` captures.
README's stale investigation checkpoint is replaced with these actual results.
All work remains uncommitted and frontend-only; backend integration is a separate
phase. Users application source and policies are unchanged.

#### Status against EVERY ORIGINAL bullet

| Original requirement | Status | Final implementation and evidence |
| --- | --- | --- |
| Dashboard 1 — remove unnecessary Manila wording on dates | Completed | Shared suffix-free timestamps and local date labels retain Asia/Manila calculations. Source sweep and rendered Dashboard/review, Reports/export, Inventory edit/library, Staff receipt/request and Audit detail assertions pass. Users' current-Manila-day role-policy prose is unchanged; it is not a displayed date suffix. |
| Dashboard 2 — Daily Sales Review through View all requests / Audit | Completed | View all requests opens the combined daily/void queue. Current-catalogue role test passes: Admin reads, Owner verifies receipts and confirms, Staff stays isolated, stock stays at 12 usable cookies after review. |
| Dashboard 3 — Sales Overview date AND time picker | Completed | Date/time controls filter the chart and carry matching bounds/category into Reports. Dashboard/report/category/CSV and mobile keyboard regressions pass. |
| Inventory 1 — align category, search and filter controls | Completed | Desktop control bottoms are within 2px. Five-size containment, text and touch-target assertions pass; fresh Inventory captures reviewed. |
| Inventory 2 — Modifier Groups destination becomes Back | Completed | Current-catalogue test verifies Back replaces the repeated destination button and returns to Products; library regressions also pass. |
| Inventory 3 — Needed to Remove Stocks and Dashboard notification | Completed | Removal quantity and affected-record/batch drill-down appear in Dashboard Needs attention. Removal table excludes usable quantities; removing unusable batches preserves usable stock. Current and partial-expiry cases pass. |
| Inventory 4 — remove products AND ingredients | Completed | Both removal flows work. Live recipe/modifier dependencies block ingredient removal until dependent products are removed. Historical snapshots remain accessible; retained carts reject removed products. |
| Inventory 5 — separate tables; removal table first | Completed | Needed to Remove Stocks → Sellable products → Ingredients. Usable finished stock has a separate management disclosure. All-page membership/order/count checks and five-size visual review pass. |
| Inventory 6 — clearer nested Product Modifiers | Completed | Cream parent, white/gold-accent group cards, separate option panels and collapsed library reuse disclosure distinguish the hierarchy. Five-size color/containment checks, 16 visual panels and full library/configuration regressions pass. |
| Inventory 7 — Expiring Soon, Low Stock, then In Stock | Completed | Ingredient urgency is verified across every page; expired/Unsellable quantities are separated into removal stock. Batch/removal/unit/stock-condition regressions pass. |
| POS 1 — prevent 100 cookie pouches against 10 physical pieces | Completed | Actual physical correction leaves 6 expired + 4 usable pieces. Simple cart caps at 4. Typed customization quantity 100 is rejected with 4 available / 100 needed; Pay stays disabled and 4 succeeds. Shared-SKU demand, retained stock/catalogue changes and three actual final-payment fault injections pass. |
| Reports 1 — research/design whole page and Export Summary | Completed | Carbon table and Fluent dialog guidance reread. Consistent report sections, table titles/counts/pagination, intact body/header words and aligned numerics pass at all five sizes. Dark-card subtitle contrast is 10.22:1. All Reports/export-summary contact-sheet panels and rightmost columns reviewed. |
| Reports 2 — Export and Print match | Completed in app | Combined, Sales and Inventory usage Print iframe, Print-download and export PDFs are byte-identical; Open PDF to print points to that same blob. CSV includes all scoped records. Native viewer/OS/paper printing remains outside the verified scope. |
| Reports 3 — table design and date-specific stock reduction | Completed | Final body wrapping passes expanded text-range checks and visual review. Five new lattes plus the seed consume 0.108kg espresso and reduce the bar; switching to the previous day gives 100% remaining. Opening/receipt/removal/Pending/Voided/unit reconciliation passes; unavailable baselines disclose unknown percentages. |
| Reports 4 — prevent future report dates | Completed | Typed future dates show the range error and disable Export/Print. Future calendar days/next month are disabled; Today selects October 5. Calendar/range regressions pass. |
| Audit Trail 1 — include Daily Sales Review in All requests | Completed | Same combined-queue/role/Owner-confirmation/once-only-stock case as Dashboard 2 passes. Confirmed order details retain the recorded Daily Sales Review. |
| Audit Trail 2 — remove Manila from transaction dates | Completed | Selected order dates, request/approval/review timestamps and Staff receipt details pass suffix-free assertions; existing audit timeline/role/void regressions pass. |
| User — No Issues here | Preserved and verified | All five identities, Staff history isolation, Users wizard/search/deletion/access restrictions and small-screen keyboard regressions pass. No Users application change. |

#### Actual final-source validation

- `npm run test:e2e --workspace Frontend -- october-5-ui.spec.ts redesign-continuation.spec.ts`:
  **23 passed (1.1m), exit 0**, including the expanded body-word check and added
  date assertions. This is fresh evidence after the last application refinement.
- Root `npm run typecheck`: **passed, exit 0**. Both workspaces checked; no backend
  implementation occurred.
- `npm run build --workspace Frontend`: **passed, exit 0**.
- `npm run test:e2e --workspace Frontend`: **148 passed (6.6m), exit 0**.
  No interrupted counts reused, no assertions weakened, no fixtures substituted
  into the current-catalogue acceptance cases. Includes all-scope PDF equality,
  CSV coverage, date/percentage, stock/role and Users regressions.

Fresh logs in parent `.review/`: `october-5-resumed-focused.log`,
`october-5-resumed-typecheck.log`, `october-5-resumed-build.log` and
`october-5-resumed-full.log`. Earlier logs remain historical.

#### Visual evidence and research

Fresh evidence in parent `.review/frontend/october-5-redesign/ui-accepted/`:
45 state PNGs, 25 right-scrolled table PNGs, five geometry JSONs and 16 contact
sheets. Reviewed all 40 Reports panels, 15 Inventory panels, 16 modifier panels
and six panels for each export scope at 1440×900, 820×1180, 390×844, 320×568 and
820×400. No split ordinary/header words or numeric lines, clipped cells, page
overflow or undersized main controls found by the assertions. All 25 column
captures were individually reviewed. Some table-only captures had unrelated
sticky navigation/rail tooltips overlaid: `columns-clear/` contains 25 additional
captures with only that navigation chrome hidden during the screenshot. The 11
formerly overlaid captures were individually reviewed again, with intact rows,
headings and numerics. Application/table geometry and CSS were unchanged.
Full-page captures retain navigation.

Supporting helpers: parent `.review/october-5-accepted-contact-sheets.py` and
`.review/october-5-column-captures.mjs`. Evidence manifest:
`.review/october-5-resumed-evidence.json`. No historical one-time edit helpers
were replayed. The full suite refreshed raw captures using the same unchanged
application source; contact sheets originate from the focused run.

Research reread: [Carbon data tables](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines)
supports clear titles, readable space, consistent sizing and bottom pagination;
[Fluent dialogs](https://fluent2.microsoft.design/components/web/react/core/dialog/usage)
supports persistent titles/actions and scrolling body content. These inform the
saved design; they are not an industry certification claim.

#### Remaining boundaries and continuation

Native PDF-viewer Print UI, OS/paper printing, physical devices, screen readers
and browsers other than installed Edge were not exercised. PDF generation did
not change this resume; earlier all-page PDF renders remain historical layout
evidence, while fresh all-scope bytes/content are verified. Date checks cover the
specified and dynamically edited states plus a source sweep, not every possible
rendered state. Arbitrarily large modifier configurations were not visually
reviewed. These are verification boundaries, not known unresolved priority bugs.

The October 5 frontend-priority implementation is complete within the preview.
Do not replay old continuation scripts or repeat completed redesign phases.
Continue from the user's next request. Preserve the actual catalogue, five
identities, original assets/licenses, sample/reset notices, role restrictions,
historical snapshots, product/stock SKU separation, batch/unit handling and
once-only stock deduction. Backend integration, commits and deployment remain
separate work requiring the user's request.

### Latest pause — October 5 Reports readability fixes saved; final-source acceptance interrupted

**Latest user instruction:** "Let’s stop for now. Stop implementation and update HandsOff.md to save the current progress."
Implementation stopped immediately. The complete browser run was interrupted with
Ctrl+C; only documentation and read-only result/server checks followed.
**The October 5 priority task remains PARTIALLY COMPLETED and UNACCEPTED.**
Do not mark the whole task complete.

This checkpoint supersedes all earlier pause checkpoints and continuation scripts.
Read the COMPLETE **Highest priority — frontend fixes for a new chat (October 5,
2026)** section and its **Original user message — verbatim, not summarized** block.
The six sections / 18 original bullets remain untouched. The progress table below
is an annotation, never a substitute for the original requirements.

All work remains saved, uncommitted and frontend-only. No backend implementation,
commit, deployment, new chat or agent delegation occurred. README.md's top status
is still stale; this checkpoint is authoritative. No listeners remained on 5180/5181
in the read-only check after interruption.

#### Status of EVERY ORIGINAL requirement at this pause

IDs follow the original bullets within each section. Completed means the specified
behavior has focused verification; it does not establish whole-task acceptance.
The final Reports body-wrapping refinement has typecheck/build verification only.
The complete final browser run did not reach the October 5 UI/acceptance tests.

| Original requirement | Status | Current result, evidence and unverified work |
| --- | --- | --- |
| Dashboard 1 — remove unnecessary Manila wording on dates | Partially completed | Source sweep covered frontend pages, components and export/date formatters: displayed timestamps use shared suffix-free `manilaTime`, suffix-free local Intl formats, date-only labels or business dates; Asia/Manila calculations remain. New dynamic checks passed for edited stock, saved modifier dates, Staff receipt details, void requests and confirmed daily-review details. Earlier five-size current-page assertions also passed. Users' `current Manila-day` role-policy prose is unchanged; it is not a date suffix. An exhaustive rendered check of every timestamp-bearing state is not claimed; final-source UI suite remains pending. |
| Dashboard 2 — Daily Sales Review through View all requests / Audit | Completed | Current-catalogue combined daily/void queue, Admin read-only review, Owner confirmation, Staff isolation and once-only stock consumption passed in the 22-case run and again in the three-case date run. Confirmation retained 12 usable cookies. Final complete suite did not reach this case. |
| Dashboard 3 — Sales Overview date AND time picker | Completed | Saved date/time controls and matching report drill-down remain; existing dashboard/report/CSV and mobile keyboard cases passed again in the interrupted final run. |
| Inventory 1 — align category, search and filter controls | Completed | Current desktop bottoms within 2px, five-size containment/readability/touch checks passed in the 22-case run. All Inventory contact-sheet panels visually reviewed. Final complete run did not reach the new UI cases. |
| Inventory 2 — Modifier Groups destination button becomes Back | Completed | Current-catalogue Back label, absence of the repeated destination button and return to Products passed in the 22-case run. No navigation source changed this chat. |
| Inventory 3 — Needed to Remove Stocks and Dashboard notification | Completed | Saved removal-first table and Dashboard quantity/drill-down remain. Current physical removal/usable-stock preservation passed in the 22-case run; earlier partial-expiry Dashboard/report evidence remains. Final suite did not reach all associated cases. |
| Inventory 4 — remove products AND ingredients | Completed | Current live-recipe dependency block, product removal permitting ingredient deletion, historical snapshots and retained-cart removal rejection passed in the 22-case run. No deletion source changed this chat. |
| Inventory 5 — separate tables; removal table first | Completed | Needed to Remove Stocks → Sellable products → Ingredients, separate usable-finished-stock disclosure, all-page ingredient membership/counts passed. All 15 Inventory contact-sheet panels reviewed at five sizes. Final full-run new UI cases pending. |
| Inventory 6 — clearer nested Product Modifiers design | Completed | Cream parent, white/gold-accent group and separate option panel remain; different parent/group colors passed at five sizes. All 16 modifier contact-sheet panels reviewed. Captures use one new group/option; arbitrary large configurations are not visually accepted. Final library regressions were interrupted before completion. |
| Inventory 7 — Expiring Soon, Low Stock, then In Stock | Completed | All-page ingredient urgency/membership and expired/Unsellable separation passed in the 22-case run. Existing reporting/helper safeguards remain. No stock-order source changed this chat. |
| POS 1 — prohibit 100 Butter Cookie Pouches against 10 physical pieces | Completed | Current browser stock correction retains 6 expired + 4 usable pieces. Simple cart caps at 4; real editor-created optional packaging permits a typed 100 attempt, refused with 4 available / 100 needed; Pay disabled, 4 succeeds. Shared SKU demand, retained changes and three actual final-payment fault injections passed in the 22-case run. Related legacy stock/cart regressions passed in interrupted final run; current cases not yet reached there. |
| Reports 1 — research/design whole page and Export Summary | Partially completed | Carbon data-table and Fluent dialog guidance reread. Table layout now auto with contained minimum widths, intact headings/numerics and lighter dark-card subtitle. Five-size checks passed before the FINAL body-word refinement; measured subtitle contrast 10.22:1. All 16 generated contact sheets reviewed (40 Reports panels, 15 Inventory, 16 modifier, 6 per export scope). Review found body status `Completed` split inside a word; final `overflow-wrap: break-word`/normal word-break fix is saved but UNVERIFIED in browser and visual captures. Expanded body-word check has not run. |
| Reports 2 — Export and Print match | Partially completed | 22-case focused run passed byte-identical iframe PDF, Print-download PDF and exported PDF in Combined/Sales/Inventory usage, plus CSV all-record coverage and the shared Open PDF link. Persistent footer included. Final CSS refinement changes no PDF code/content; final full-suite byte case not reached. Native PDF-viewer Print UI and OS/paper printing remain unverified; no new PDF rendering was done this chat. |
| Reports 3 — table design and date-specific stock percentage reduction | Partially completed | Current five-latte test passed: seed plus purchases uses 0.108kg espresso, percent reduces, previous day gives 100%, before-baseline dates disclose unavailable. Ledger receipt/removal/Pending/Voided/unit assertions passed. Table header/numeric and contrast checks passed before final body-word refinement; final body readability test and recapture remain pending. Final complete run did not reach percentage case. |
| Reports 4 — prevent future report dates | Completed | Current typed-future/calendar case passed: Export/Print disabled, range error shown, future day and next month disabled, Today chooses Oct 5. Final CSS change does not affect date logic; full-run current acceptance case not reached. |
| Audit Trail 1 — include Daily Sales Review in All requests | Completed | Same current queue/role/confirmation/once-only-stock evidence as Dashboard 2. New post-confirmation detail assertion passed and displays recorded Daily Sales Review. |
| Audit Trail 2 — remove Manila from selected transaction dates | Completed | Shared formatter remains suffix-free; five-size current Audit detail assertions passed. New Staff receipt, request timestamp and Owner-confirmed daily-review detail assertions passed. Final complete run also passed legacy request/approval/timeline regressions. |
| User — No Issues here | Completed | Users application source/behavior unchanged. Five-person identity/isolation regression passed in interrupted final run. Full Users regression group was not reached. |

#### Changes made in THIS chat

- `Frontend/src/redesign.css`: scoped light `#e4d9c7` subtitle on the first dark
  Reports summary card. Reports tables use auto layout, 640px minimum width,
  720px ingredient-transaction minimum and 540px mobile remaining-stock minimum.
  Headers wrap between words. Numeric cells preserve explicit newlines and keep
  each numeric line intact with right alignment/tabular numerals. Long body text
  still wraps. The LAST edit changed body cells from `overflow-wrap: anywhere`
  to `break-word` with normal word-break after a screenshot showed `Completed`
  splitting. That last refinement has NOT had browser/visual acceptance.
- `Frontend/tests/october-5-ui.spec.ts`: screenshot output moved to separate
  `ui-final/` so prior `ui/` evidence stays intact. Added actual text-range geometry
  for intact header words/numeric lines, no clipped cells and measured subtitle
  contrast >=4.5. Added right-scrolled captures for each of five report tables at
  all five sizes. Added rendered edited-stock, saved-library and Staff receipt
  date checks. FINAL change expands readability checks to ordinary body words;
  this expanded assertion has NOT run.
- `Frontend/tests/redesign-continuation.spec.ts`: current role/review case now
  asserts request dates, review modal and confirmed order details have no Manila
  wording and retains original arithmetic/role checks.
- Parent `.review/october-5-final-contact-sheets.py`: separate copy of existing
  capture-sheet helper, points to `ui-final/`. It was run before final body edit.
  No old one-time edit helpers were replayed.

The previous chat's stock SKU separation, invalid timestamp/Unsellable guards,
modal footer and all payment safeguards remain unchanged by this chat. No Reports
export generation, backend or Users application source was changed.

#### Actual validation and interruption

1. `npm run test:e2e --workspace Frontend -- october-5-ui.spec.ts redesign-continuation.spec.ts`:
   **22 passed (1.2m), clean exit**. Includes five-size new header/numeric/contrast
   checks, stock/role/deletion/percentage/future-date and all-scope PDF/CSV cases.
   This PRECEDES both the added date assertions and final body-word refinement.
2. Focused date follow-up with `--grep 'physical corrections|saved library dates|all requests'`:
   **3 passed (9.7s), clean exit**. Includes new rendered date assertions.
   This PRECEDES the final body-word refinement.
3. AFTER final source/test edits: root `npm run typecheck` and frontend
   `npm run build --workspace Frontend`: **PASSED, clean exits**. Root typecheck
   checks both workspaces; no backend implementation occurred.
4. Final `npm run test:e2e --workspace Frontend` declared **148 tests**.
   **INTERRUPTED with Ctrl+C at the user's stop request**, process exit 1.
   Saved log has **46 completed passes, 0 completed failures**, no runner summary.
   Highest completed case number is 47; case 46 had not completed. Do not report
   47 passes or 148 passing tests. October 5 UI/current acceptance and later
   regressions were not reached. No application/test edits were made after stop.
5. Read-only cleanup check: no listeners on ports 5180/5181. No test server left
   running. No cleanup/reset of source, artifacts or uncommitted scaffold occurred.

New logs in parent `.review/`: `october-5-final-focused.log`,
`october-5-final-dates.log`, `october-5-final-typecheck.log`,
`october-5-final-build.log`, `october-5-final-full.log`.
All prior logs remain. New evidence is in
`.review/frontend/october-5-redesign/ui-final/`: 45 state PNGs, 25 right-scrolled
table PNGs, five geometry JSON files and 16 contact sheets. The artifacts named
`final` PRECEDE the last body-word edit; do not mistake the name for acceptance.
All generated sheets and tablet variant price capture were inspected; the other
24 right-scrolled table captures have NOT been individually visually reviewed.
The focused byte test refreshed the three PDF/CSV scope files in the parent
`october-5-redesign/` directory; it did not render PDFs. No new PDF layout claim.

#### Known remaining work and verification limits

- Browser-test the final body-word wrapping edit and expanded readability assertion.
  Recapture Reports at 1440x900, 820x1180, 390x844, 320x568 and 820x400, inspect
  every relevant numeric/right-scrolled table capture and all export scopes.
- Complete the final-source 148-case browser suite; do not reuse interrupted counts.
  Recheck current date/percentage and all-scope Print/export equality there.
- Date-source sweep and new dynamic cases passed, but exhaustive rendered coverage
  of every dated state is not claimed. Preserve timezone calculations and roles.
- Native PDF-viewer printing, physical/OS paper output, physical devices, screen
  readers and non-Edge browsers remain unverified. Prior PDF renders are historical
  evidence for unchanged generation, not fresh verification in this chat.
- README's top checkpoint remains stale. Update it with actual final results when
  the user resumes and acceptance completes. No new known behavioral defect was
  found this chat; final wrapping behavior is pending verification, not accepted.

Reports research actually reread:
https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines
and https://fluent2.microsoft.design/components/web/react/core/dialog/usage.
They support readable table labels/space and persistent dialog actions. This is
design rationale, not formal industry certification.

#### CURRENT continuation script — authoritative after this stop

```text
Resume ONLY when the user requests frontend work, in
C:/Users/ASUS/Documents/Personal/Vertwell/repo.
Read this newest October 5 Reports-readability pause, then the COMPLETE
"Highest priority — frontend fixes for a new chat (October 5, 2026)" section and
its "Original user message — verbatim, not summarized" block. Follow every
original six-section / 18-bullet requirement, not just this script/table.
The overall task is partial and UNACCEPTED. Implementation stopped at the user's
explicit request; no app/test work was done afterward. All work is uncommitted.
README's top checkpoint is stale. No listeners remained on 5180/5181.

START at Frontend/src/redesign.css report table body wrapping and
Frontend/tests/october-5-ui.spec.ts expanded readability check. The last edit
uses overflow-wrap: break-word and normal word-break to keep short status/body
words such as Completed intact while long descriptions wrap. Typecheck/build
passed AFTER that edit, but no browser or visual check reached it before stop.
The 22-case focused result and ui-final/ captures PRECEDE this last refinement.

Run october-5-ui.spec.ts and redesign-continuation.spec.ts with the existing
test-owned Vite setup. Fix real failures without weakening text/stock arithmetic,
role or PDF equality assertions. Recapture all five sizes and inspect intact
headings/status words/numerics, stock bars, right-scrolled table columns and all
three export summaries. Update contact sheets with the saved final helper only
after new captures; do not rerun historical one-time edit scripts. Individually
review all numeric/right-scrolled captures (only tablet variants inspected so far).

Preserve actual replacement catalogue, five identities, original assets/licenses,
sample/reset notices, Owner-only daily review, existing void roles, historical
snapshots, product/stock SKU separation, compatible units/batches, once-only stock
deduction and typed-100-cookie/final-payment guards. Users source remains unchanged;
its current Manila-day prose is role policy, not a rendered timestamp suffix.
Stay frontend-only; no backend work, commit or deployment authorized. Read any
applicable AGENTS.md if it appears; none was found. No agents were delegated.

Re-run final-source date/percentage and all-scope Print preview/download/export
PDF byte equality and CSV coverage. PDF generation was unchanged this chat;
repeat PDF rendering if output changes. Be explicit about native viewer/OS print
verification limits. New date cases passed and a source sweep found no visible
timestamp suffix; do not change timezone calculations to remove label wording.

Then complete root typecheck, frontend build and the FULL browser suite.
The interrupted latest run declared 148 tests and completed only 46 passes,
0 failures, exit 1; case numbers are not the pass count. Preserve old logs and
record exact new results. Update per-original-requirement statuses/unverified
work and README's stale checkpoint. Mark the entire October 5 task complete only
when EVERY original requirement is implemented AND verified, including final
body wrapping and complete suite. Do not treat prior focused completion labels
or filenames containing final as whole-task acceptance.
```



### Latest pause — October 5 frontend acceptance progressed; final visual findings and full suite unfinished

**User instruction:** "Let’s stop for now. Stop implementation and update HandsOff.md to save the current progress."
The user also explicitly requested preserving their full original requirements,
per-requirement status including unverified work, actual changes/results/issues,
and an exact continuation script. Implementation stopped immediately. The running
147-case browser suite was interrupted with Ctrl+C; only documentation and
read-only state checks followed. **The whole October 5 priority task remains
PARTIALLY COMPLETED and UNACCEPTED. Do not mark it complete.**

This checkpoint supersedes every earlier Latest pause and continuation script.
The original six-section / 18-bullet message in **Highest priority — frontend fixes
for a new chat (October 5, 2026)**, under **Original user message — verbatim, not
summarized**, remains unchanged. The table here is a progress annotation, never a
replacement for that full message. Resume only when the user requests it.

All application/test work is saved and uncommitted, frontend-only. No backend
implementation, deployment, commit, new chat, or agent delegation occurred.
README.md's top checkpoint is still stale; this HandsOff checkpoint is authoritative.

#### Status of EVERY ORIGINAL requirement at this pause

The IDs follow the original bullets in order within each original section.
Completed means the specific behavior has focused verification; it does not imply
that the entire redesign or complete browser suite has been accepted. Unverified
aspects are stated explicitly. No requirement is entirely absent/still pending,
but the remaining work under partially completed requirements is still pending.

| Original requirement | Status | Saved result, actual evidence, and unverified work |
| --- | --- | --- |
| Dashboard 1 — unnecessary Manila wording on dates | Partially completed | Current Dashboard, Daily Sales Review, Inventory, Audit detail and Reports/export captures passed rendered no-Manila assertions at five sizes. Shared formatters and the prior ModifierLibrary change keep Asia/Manila calculations without visible suffixes. A complete sweep of every date-bearing state is not done. Users still contains `current Manila-day` role-policy prose; this is not a timestamp suffix, and Users was deliberately left unchanged. |
| Dashboard 2 — Daily Sales Review through View All requests / Audit | Completed | The complete current-catalogue role case passed: Staff cannot see the Daily Review queue, Admin can read but not confirm, Owner confirms the exact receipts, combined daily/void requests remain correct, and cookie usable stock stays 12 pieces after review. This case passed again before full-suite interruption. |
| Dashboard 3 — Sales Overview date AND time picker | Completed | Saved date/time controls and matching report drill-down remain. Focused dashboard/report/CSV and mobile keyboard cases passed; fresh Dashboard screenshots at all five sizes reviewed by the capture checks. No source change to this feature in this chat. |
| Inventory 1 — category/search/filter alignment | Completed | Current desktop control bottoms agree within 2px in the new acceptance test. Five-size containment/readability/touch checks passed and desktop/tablet/phone/short-screen Inventory contact sheets were visually inspected. Narrow layouts stack controls and contain horizontal table scrolling. |
| Inventory 2 — Modifier Groups destination button becomes Back | Completed | New current-catalogue test explicitly verifies `Back`, absence of the repeated `Modifier groups` button in that destination, and return to Products. Library regressions passed in the interrupted full run. |
| Inventory 3 — Needed to Remove Stocks and Dashboard notification | Completed | Saved removal-first table and Dashboard quantity/drill-down remain. The formerly failing partial-expiry Dashboard/report case passed. Current removal quantity/table membership and physical removal retaining usable stock passed; the cookie cap persists after expired stock removal. |
| Inventory 4 — remove products AND ingredients | Completed | Complete current-catalogue deletion case passed: live recipe dependency blocks ingredient deletion, removing the product permits deletion, historical Audit ingredient snapshots stay accessible. Retained carts reject a removed product. Tests passed again before interruption. |
| Inventory 5 — separate tables; removal table first | Completed | Current-catalogue test checks Needed to Remove Stocks → Sellable products → Ingredients, with usable finished stock in its separate management disclosure. All ingredient pages were checked for membership/counts. Five-size Inventory screenshots inspected; source preserves scoped searches and independent pagination. |
| Inventory 6 — clearer nested Product Modifiers design | Completed | Cream parent, white bordered/gold-accent group cards, option panels and collapsed library reuse remain. Five-size captures and all modifier contact sheets inspected; new test checks parent/group colors differ. Library create/copy/default/independent-selection regressions passed before interruption. Visual review covers a new group with one option, not every possible large configuration. |
| Inventory 7 — Expiring Soon, Low Stock, then In Stock | Completed | Current-catalogue test checks all ingredient pages and ordered urgency ranks, including removal separation. Explicit wholly Unsellable batch labeling was fixed; helper assertions passed. Metadata preservation/expiry/unit behavior remains; arbitrary externally corrupted data is not browser acceptance scope. |
| POS 1 — prohibit 100 Butter Cookie Pouches against 10 physical pieces | Completed | Both current-catalogue browser scenarios pass. Correction from 18 physical to 10 selects `butter-cookie-2`, retaining 6 expired + 4 usable. Simple cart increments cap at 4. A real editor-configured optional packaging group exposes quantity entry; typing 100 is refused with `4 pcs available; 100 needed`, Pay remains disabled, 4 succeeds and usable stock reaches 0. Shared variant/bundle caps and retained stock/unavailable/removed changes pass. Three fault-injection browser cases exercise App's actual final-payment boundary and reject incompatible units, duplicate overdraw and Infinity without a sale or stock deduction. These cases passed again in the interrupted full run. |
| Reports 1 — research/design whole page and Export Summary | Partially completed | Official Carbon table/dashboard and Fluent dialog guidance read. Current Reports/all three export scopes were captured and visually inspected at five sizes; export/Print actions now stay in a persistent footer. Final-source footer viewport/scroll checks passed in the full run. Visual QA discovered unresolved wrapping of short headers/numeric values and weak dark-card subtitle contrast; see exact resume items below. No fix for those findings was made after the stop. |
| Reports 2 — Export and Print match | Partially completed | All three scopes passed byte-identical Print preview/preview download/export PDF and all-record CSV checks in the complete focused 22-case run, before the final footer relocation. Footer relocation changes no PDF content/generation. Its UI checks passed, but the final-source full-scope byte case had not been reached when the full run stopped. Native PDF viewer Print UI and physical/OS printing remain unverified. Prior 22-page PDF visual review remains historical evidence; no new PDF rendering in this chat. |
| Reports 3 — table design and stock percentage reduction for selected date | Partially completed | Complete focused current-catalogue five-latte test passed: today's seed plus five lattes uses 0.108kg espresso, percentage changes, changing to the previous day gives 100%, before-baseline dates disclose unavailable. Movement/unit/receipt/removal/Pending/Voided unit cases pass. Invalid committed timestamps now return unavailable instead of throwing. Report table header/value wrapping found in visual review is still unfixed; final-source date/percentage browser case was not reached before full-suite interruption. |
| Reports 4 — prevent future report dates | Completed | Focused typed-future/calendar-navigation case passed: future date disables Export/Print, displays range error, next-month/future-day controls are disabled and Today selects Oct 5. Existing calendar/range/keyboard cases passed again in the final interrupted run. Final footer changes do not touch date logic. |
| Audit Trail 1 — include Daily Sales Review in All requests | Completed | Same complete role/review/once-only-stock evidence as Dashboard 2. Combined queue, outstanding void after daily confirmation, Owner/Admin/Staff isolation passed twice (focused and interrupted full run). |
| Audit Trail 2 — remove Manila from selected transaction dates | Completed | Current Audit receipt details passed no-visible-Manila assertions at all five sizes. Date calculations remain Asia/Manila. Existing detail/timeline/role regressions passed before full-suite interruption. |
| User — No Issues here | Completed | Users behavior/source unchanged. Five preview identities and role policies retained; identity/isolation and role switching cases passed before full-suite interruption. |

#### Application changes saved in THIS chat

- `Frontend/src/data/stock-movements.ts`: guards invalid committed sale timestamps
  before `businessDate` conversion, returning unavailable period balances rather
  than throwing `RangeError`. Added meaningful regression assertion.
- `Frontend/src/data/reporting.ts`: a positive stock record with no usable pieces
  and an Unsellable receipt batch now explicitly reports Unsellable. Added wholly
  Unsellable-batch assertion alongside the existing partial/expiry cases.
- `Frontend/src/components/ui.tsx`: Unsellable status badges use the danger styling;
  added optional Modal footer rendered outside the scrolling body.
- `Frontend/src/pages/Inventory.tsx`: editing a product with existing linked stock
  now preserves that stock's own SKU and item code. A real defect was discovered
  by the stronger cookie test: product edits previously replaced FD001 with the
  PR-BUTTER-COOKIE SKU, so the existing stock became unsearchable by its actual SKU.
  Product SKU edits remain separate; new stock behavior remains unchanged. This
  fix is exercised by the successful typed-cookie/current-stock and retained-cart
  cases. Existing physical corrections, receipt dates/batches and unit conversions
  remain as saved by the prior chat.
- `Frontend/src/pages/Reports.tsx`: moved Export Cancel/Download and Print
  Download/Open PDF actions into the new persistent footer. Header and actions
  remain visible while the summary/preview body scrolls. PDF generation/cache/
  shared-blob logic was not changed.
- `Frontend/src/redesign.css`: styled the Reports footer with stable padding,
  border/background and nonshrinking layout. No new header/numeric wrapping or
  dark-card contrast fix was made; these were found immediately before stopping.

#### Tests and review artifacts saved

- `Frontend/tests/redesign-continuation.spec.ts`: deliberate `.toast` scoping and
  Availability combobox role lookup fix two selector failures. Added a real typed
  100-cookie browser attempt through actual product editor configuration, plus
  three actual final-payment fault-injection cases. The injection intercepts only
  the test's Vite POS module and changes the outgoing usage payload AFTER POS
  validation; no production test hook was added. Invalid timestamp and wholly
  Unsellable unit assertions added. Original arithmetic/role expectations retained.
- `Frontend/tests/october-5-ui.spec.ts`: seven current-catalogue cases. Table order,
  all-page ingredient scope/urgency, explicit Back navigation, required/negative
  batch correction, and five screen-size captures. Checks visible table/heading
  text >=12px, input/button/select height >=44px (checkboxes excluded), page/dialog
  containment, rendered no-Manila text in captured main states, modifier contrast,
  desktop control alignment and final Reports footer/header viewport behavior
  before and after scrolling. No physical-device or screen-reader assertion.
- Screens: 45 PNGs, nine states at each of 1440x900, 820x1180, 390x844, 320x568,
  820x400. Dashboard, Daily Review, Inventory, new modifier group, Audit details,
  Reports, and Combined/Sales/Inventory usage export summaries. Five JSON geometry
  files in parent `.review/frontend/october-5-redesign/ui/`; current full-run
  screenshots include the final persistent footer.
- Parent `.review/october-5-contact-sheets.py` creates review sheets from all pixels
  of Reports/Inventory/modifier/all-scope export captures, splitting long images.
  ALL 17 generated sheets were visually inspected (44 Reports panels, 15 Inventory,
  16 modifier, 6 panels for each of the three export scopes). Panels of mobile
  scrollable tables show their initially visible columns; they do not establish
  visual acceptance of every horizontally scrolled column or every paginated state.
- Logs in parent `.review/`: `october-5-focused.log`, `october-5-acceptance.log`,
  `october-5-ui.log`, `october-5-full.log`. Do not overwrite these before using them
  to distinguish actual completed results from interrupted output.

#### Actual validation and interruption

1. Initial focused Dashboard/Inventory/POS/current acceptance run: **21 passed,
   1 failed, 52.4s**, complete exit. The remaining failure was ambiguous status
   locator scoping in retained-cart checks. The three failures recorded by the
   previous chat (partial expiry, customization shortage display, replenishment)
   all passed in this run.
2. Expanded 15-case current acceptance: **13 passed, 2 failed, 49.7s**, complete
   exit. Real linked-stock SKU replacement bug and Availability label lookup were
   then corrected. These failures are resolved in later passing cases.
3. Corrected current acceptance + new UI cases: **22 passed, 1.1m**, clean exit.
   This includes typed-cookie refusal, actual final-payment guards, retained cart,
   role/review/deletion, percentage/date and all-scope PDF/CSV cases. It predates
   the final Reports persistent-footer change.
4. After the final footer edit, root `npm run typecheck` and
   `npm run build --workspace Frontend`: **PASSED**, clean exit. Root typecheck
   checks both workspaces; no backend implementation was made.
5. Final complete browser command declared **147 cases**. **INTERRUPTED with
   Ctrl+C at the user's stop request**. Saved output contains **96 completed
   passes, 0 completed failures**; no complete runner summary. Numbers reached 96.
   Do NOT call this 147 passing tests or a completed suite. Final-source seven
   new UI cases (including footer visibility), stock safeguards, typed-cookie,
   dependency deletion and role/review case passed before interruption. The later
   date/percentage and all-scope PDF cases, plus remaining regressions, were not
   reached/accepted in that final run. Runner returned exit code 1 on interruption.
6. Read-only stop checks found no listeners on ports 5180/5181. No test-owned
   preview server was left running. `git diff --check` still reports README.md's
   pre-existing extra blank line at EOF (line 473); frontend remains untracked,
   so that command is not complete source whitespace validation. No cleanup done.

#### Known unfinished visual findings — resume HERE

- Current `redesign.css` applies `overflow-wrap: anywhere` to all report headings
  and values. Visual review shows short `Cashier`/`Quantity` labels split inside
  words, and variant unit-price values split across lines at tablet/short widths
  (for example the final digit of PHP 750.00 wraps). Preserve useful wrapping of
  long order/product/configuration text, but give headings/numeric cells enough
  room and avoid splitting short words and numbers. Scope the fix to Reports;
  retain contained horizontal scrolling and numeric right alignment. This is a
  concrete unresolved UI issue, not an accepted intentional design.
- The dark first Reports summary card inherits muted `small` text (#70675b) from
  `redesign.css`; its category/VAT subtitle is hard to read against the dark card.
  Add a suitably light scoped subtitle color and verify actual contrast/rendering.
  No patch for this was made before or after the stop.
- Additional relevant completeness limits: comprehensive date-label sweep beyond
  captured states; native PDF-viewer Print UI/OS paper printing; final-source
  all-scope PDF byte check; complete final browser run. Prior chat's PDF renders
  remain evidence for unchanged output, not new rendering in this chat.

#### Reports research actually read in this chat

- Carbon current Data table guidance (titles/descriptions, consistent sizing,
  whitespace, readable column labels, hover and bottom pagination):
  https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines
- Carbon dashboard guidance (prioritize relevant summary information and provide
  context for exploration; this is older v10 design guidance):
  https://v10.carbondesignsystem.com/data-visualization/dashboards/
- Fluent 2 dialog guidance (focused task, clear title/actions, persistent header
  and footer around scrolling content, focus restoration):
  https://fluent2.microsoft.design/components/web/react/core/dialog/usage
The footer improvement follows that guidance. This is a design rationale, not
formal certification or a claim that every Reports table is accepted.

#### CURRENT continuation script — authoritative after this stop

```text
Resume ONLY when the user requests frontend work, in
C:/Users/ASUS/Documents/Personal/Vertwell/repo.
Read this newest October 5 frontend-acceptance pause, then the COMPLETE
"Highest priority — frontend fixes for a new chat (October 5, 2026)" section and
its "Original user message — verbatim, not summarized" block. Follow all original
six sections / 18 bullets, not just this script or its status annotations.
The overall task is partial and UNACCEPTED; earlier completed labels are specific
focused evidence, not whole-task acceptance. README's top checkpoint is stale.

Implementation stopped at the user's explicit request. Everything is saved and
uncommitted. No listeners remain on 5180/5181. Preserve actual replacement
catalogue, five identities, original assets/licenses, sample/reset notices,
Owner-only review, existing role/void rules, historical snapshots, product/stock
SKU separation, compatible unit/batch corrections and once-only stock deduction.
Keep frontend-only; no backend implementation, commit or deployment authorized.
No agents were delegated. Read applicable AGENTS.md if one appears (none found).
Do not replay old one-time edit helpers or the older completed phases.

START with the two known Reports screenshot findings above: headings/numeric
values wrap inside words/numbers, and the first dark summary card subtitle has
weak contrast. Inspect Frontend/src/redesign.css near report table rules and
report-summary small. Fix them without losing long text wrapping, numeric right
alignment, horizontal table containment or persistent report footer. Review the
saved actual-catalogue screenshots/contact sheets in parent
.review/frontend/october-5-redesign/ui/ as evidence of the exact issue.

Run october-5-ui.spec.ts and relevant report/current acceptance cases using the
existing test-owned Vite setup. Recapture final changed states at desktop/tablet/
phone/320px/short screen and inspect headers, values, stock bars and all-scope
export summaries. Include horizontally scrolled report table columns if needed
to verify the numeric issue. Complete the date-label sweep; keep Asia/Manila
calculations. Users was not edited; its current Manila-day policy prose is not
a rendered date suffix. Do not change role behavior to resolve label wording.

Keep new tests meaningful: typed 100 cookies uses a real optional packaging group
created through the editor, stock correction leaves 6 expired + 4 usable, shared
SKUs respect combined demand, and actual final-payment fault-injection intercepts
only a test module after normal POS checks. All those passed. Do not replace
current preview acceptance with legacy fixtures or silently weaken arithmetic.

Re-run final-source all-scope Print preview/Download/export PDF byte equality and
CSV coverage in redesign-continuation.spec.ts. PDF generation was unchanged by
the footer move. Prior 22-page PDF rendering is historical; repeat rendering if
output changes. Native viewer Print UI and OS paper-print behavior are unverified;
state the actual validation scope. Percentage/date case passed in the focused
run before the footer change but was not reached in the final interrupted run.

Then run final root typecheck, frontend build and the COMPLETE browser suite.
The interrupted final run declared 147 cases and observed only 96 completed
passes/0 completed failures; this is NOT a complete result. Final-source footer
UI checks did pass before interruption. Preserve logs and record exact new
results. Update each original requirement's completed/partially completed/pending
status and explicitly record unverified work. Mark the whole priority task
complete only after EVERY original requirement is implemented AND verified.
```

### Latest pause — October 5 stock safeguards implemented; acceptance interrupted

**User instruction:** "Let’s stop for now. Stop implementation and update HandsOff.md to save the current progress."
Implementation stopped immediately and the running browser suite was interrupted
with Ctrl+C. Only checkpoint documentation and read-only state checks followed.
This checkpoint supersedes all earlier Latest pause sections and continuation
scripts. Earlier checkpoints remain historical. **The full October 5 priority
task is PARTIALLY COMPLETED, UNACCEPTED, and must not be marked complete.**
The original six-section / 18-bullet priority message below is unchanged verbatim.
All work remains saved, uncommitted and frontend-only; no backend integration,
commit, deployment, new chat, or agent delegation was performed.

#### Requirement-by-requirement status against the ORIGINAL message

The IDs below follow each bullet's order within its original section. These are
status annotations, not replacements for the original wording. Read the entire
**Highest priority — frontend fixes for a new chat (October 5, 2026)** section and
its **Original user message — verbatim, not summarized** block before resuming.
"Partially completed" includes implemented work whose acceptance is unfinished.

| Original requirement | Status | Saved implementation, evidence, and remaining verification |
| --- | --- | --- |
| Dashboard 1 — unnecessary Manila wording on dates | Partially completed | Shared `manilaTime` already formats dates without a visible timezone suffix; Dashboard/Daily Review/Audit source uses business-date wording. This chat removed ModifierLibrary's remaining `(Manila)` timestamp suffix. No comprehensive rendered date-label sweep completed; Users still has `current Manila-day` policy wording, not a date suffix. Preserve the Asia/Manila calculation timezone. |
| Dashboard 2 — Daily Sales Review through View All requests / Audit | Partially completed | Dashboard all-requests routing and Audit daily queue are saved. The first targeted run reached and passed Admin read-only access, Owner confirmation, combined daily/void queue and Staff isolation checks, but the case failed on a wrong final stock expectation. Corrected expectation saved; complete case not rerun before stop. |
| Dashboard 3 — Sales Overview date AND time picker | Completed | Saved From/To date and time controls, range validation and date/time report drill-down. This run passed dashboard category/time report/CSV drill-down and mobile chart/control regressions. No new screenshot review in this chat. |
| Inventory 1 — category/search/filter alignment | Partially completed | Saved responsive CSS aligns control bottoms; this run passed the existing Admin readable/touch/contained-table geometry check across 320/820/1024/1440px. Exact visual alignment and current-catalogue screenshots remain unverified. |
| Inventory 2 — Modifier Groups destination button becomes Back | Partially completed | Source renders `Back` in the Modifier groups destination. Library interaction regressions passed, but no explicit current-catalogue acceptance assertion of this requested label was completed. |
| Inventory 3 — Needed to Remove Stocks and Dashboard notification | Partially completed | Removal-first table and Dashboard quantity/drill-down saved; partially-expired regression reached and passed the new Dashboard label and highlighted batch routing before failing later on an old Reports status assertion. Physical removal/cookie cap acceptance remains unrun after fixes. |
| Inventory 4 — remove products AND ingredients | Partially completed | Product removal, dependency-blocked stock deletion, confirmation and historical snapshots remain saved. First targeted run reached the ingredient dependency check and both deletions successfully, then failed on an ambiguous Audit date selector. Selector fixed; historical snapshot and complete corrected case not rerun. |
| Inventory 5 — separate tables; removal table first | Partially completed | Saved order is Needed to Remove Stocks, Sellable products, Ingredients; usable finished records remain in a separate management disclosure for receipts/variant/bundle stock. Region-specific legacy selectors updated. Actual catalogue ordering/scoping/counts and disclosure UX still need browser/visual acceptance. |
| Inventory 6 — clearer nested Product Modifiers design | Partially completed | Saved cream container, white bordered group cards, option panels and collapsed library disclosure. Reuse/import regressions passed after opening the disclosure. No new visual screenshot inspection of modifier contrast or information density completed. |
| Inventory 7 — Expiring Soon, Low Stock, then In Stock | Partially completed | Source sorts ingredient urgency; Expiring Soon precedes usable Low Stock. Explicit Unsellable records/partial batches are now identified, and Unsellable batches excluded from expiring-soon calculation. Direct stock-condition unit checks passed. Full current-catalogue table ordering/removal split not accepted. |
| POS 1 — prohibit 100 Butter Cookie Pouches against 10 physical pieces | Partially completed | Shared compatible-unit/finite/nonnegative/aggregated final-payment guard, current-product availability checks, batch-aware physical correction, and customization increment cap implemented. Guard unit checks passed. Exact corrected cookie UI case has NOT passed: first run stopped at Quantity label lookup, which is fixed; corrected scenario has 6 expired + 4 usable = 10 physical pieces. No claim that the originally reported bug is fully reproduced/resolved. |
| Reports 1 — research/design whole page and Export Summary | Partially completed | Re-read official Carbon table guidance, inspected saved table titles/descriptions/counts/numeric alignment/pagination and compact export summary. Generated all-scope PDFs visually reviewed, but current desktop/tablet/phone/short-screen Reports and export-summary screenshot QA is pending. |
| Reports 2 — Export and Print match | Partially completed | Targeted test PASSED: Combined, Sales and Inventory usage preview/Download PDF/export share byte-identical cached PDFs; viewer link points to same blob, CSV contains all scoped records. Rendered and visually inspected all 22 PDF pages. Native viewer Print control and OS paper-print behavior remain unverified; do not claim physical printing acceptance. |
| Reports 3 — table design and stock percentage reduction for selected date | Partially completed | Ledger/balance bars, full-day movement basis and current usable-stock separation saved. Seed reconciliation, conversions and receipts/removals/Pending/Voided unit checks passed. Actual five-latte purchase changed the percentage in the first browser run, but its later assertion used wrong units (108g is 0.108kg here). Corrected assertion saved; date-switch/before-baseline portions not rerun. |
| Reports 4 — prevent future report dates | Partially completed | DateField calendars have max=today; Reports rejects typed future/invalid/reversed ranges and disables export/Print. Existing calendar keyboard/range regression passed. New current-catalogue future-date test was not reached after the wrong-unit assertion and remains pending after its correction. |
| Audit Trail 1 — include Daily Sales Review in All requests | Partially completed | Same implementation and partial evidence as Dashboard 2; corrected full role/review/stock case must pass. |
| Audit Trail 2 — remove Manila from selected transaction dates | Partially completed | Shared formatter and Audit detail/timeline source have no visible Manila suffix. Existing Audit details/role regressions passed; targeted rendered no-Manila assertion and complete date-label sweep still pending. |
| User — No Issues here | Completed | No Users behavior or source changed this chat; preserve the five identities and existing role policies. |

No original bullet is being treated as a new feature that is entirely absent, but
substantial verification remains **pending**. Broad passing regressions do not
accept every requirement; the table above is the current acceptance state.

#### Application source changes made in THIS chat

- `Frontend/src/data/inventory.ts`: implemented `validateStockUsage`, normalizing
  quantities into each stock record's unit and aggregating duplicate inputs before
  checking finite/nonnegative quantities and usable availability. Invalid stock
  quantities/batches and missing/incompatible references are rejected. `usageFor`
  delegates to it; `consumeStock` uses its normalized/aggregated result and leaves
  stock unchanged on errors. Existing omission semantics and expiry exclusion stay.
  A discovered shortage-display regression initially returned empty usage; fixed
  before stopping so valid overdraw retains computed requirements with the error.
  That display fix has NOT been rerun in its failing browser case.
- `Frontend/src/App.tsx`: final `recordSale` boundary uses the shared guard and saves
  normalized usage before once-only deduction. Duplicate order/reference protection
  remains. `updateStock` now records zero-quantity Opening movements for new items.
- `Frontend/src/pages/Pos.tsx`: retained carts reject a current catalogue product
  marked unavailable, in addition to removed products and current stock shortages;
  historical cart price/recipe snapshots remain deliberate.
- `Frontend/src/components/CustomizeProduct.tsx`: increase button checks the whole
  candidate cart before adding one. Typed excessive quantities still reach the
  useful shortage validation on Save.
- `Frontend/src/pages/Inventory.tsx`: Quantity is now editable for physical stock
  corrections. Existing batches convert with compatible unit changes; a changed
  physical total must choose the affected receipt batch and cannot make it negative.
  Other batch dates/statuses remain; explicit Unsellable item status is preserved
  on metadata edits. Quantity and receipt-batch inputs have explicit accessible
  labels. Existing quantity/threshold unit-conversion regression passed. Complete
  multi-batch correction and cap tests remain unverified.
- `Frontend/src/data/stock-movements.ts`: added real calendar date checks, movement
  kind/sign guards, future movement/consumption checks, finite current on-hand and
  nonnegative opening-period checks. Unit reconciliation/period tests passed.
- `Frontend/src/data/reporting.ts`: explicit Unsellable labels, partial-unsellable
  label and exclusion of Unsellable batches from Expiring Soon; usable-low priority
  retained. Dashboard and Inventory low/unusable counts now include `unsellable`.
- `Frontend/src/components/ModifierLibrary.tsx`: removed visible `(Manila)` from
  saved-at timestamps. Users was not edited. No new redesign CSS/Reports source
  edits were made in this chat; those layouts remain from prior continuations.

#### Tests changed and what is STILL incomplete

- Updated the 11-case `Frontend/tests/redesign-continuation.spec.ts` draft to use
  `PR-DECK-SLEEVES`, actual review amount labels, checking every receipt, and
  `Confirm reviewed sales`. The helper it imported now EXISTS. Fixed exact Audit
  date label lookup, cookie arithmetic/usable cap, preserved review stock quantity
  (12 usable), and five-latte consumption in actual stock units (`0.108 kg`, which
  includes the seed's 0.018kg). These are saved corrections, not accepted cases.
- Corrected legacy selectors/intentional labels in `admin.spec.ts`,
  `continuation.spec.ts`, `frontend.spec.ts`, `dashboard-reports.spec.ts`,
  `inventory-pos.spec.ts`, `mock-data.spec.ts`, `modifiers.spec.ts`,
  `priority-feedback.spec.ts`, and `redesign.spec.ts`. Separate Ingredients/removal
  regions and `usable-stock-*` IDs now matter. Current and legacy previews remain
  separate; fixtures were not substituted into current-catalogue acceptance.
- Do not blindly accept the updated test assumptions. The cookie browser case
  checks increment caps after a physical correction; its title's "reject 100" is
  backed by a helper check rather than an actual typed 100-cookie browser attempt.
  `getByRole('status')` in retained-cart tests may need deliberate scoping because
  filter summaries/toasts are both statuses. Multi-batch edit/add controls may be
  duplicated across removal and usable rows; scope the intended region.
- No final-payment fault-injection integration test or new screenshot/visual QA
  test file was created. They were only considered before the stop request.

#### Actual validation, interrupted work, and remaining failures

- Root `npm run typecheck`: PASSED once after the main application patches, before
  later accessible-label/count/shortage-display edits. Re-run on the final source.
- No new frontend production build was run in this chat. Prior build success is
  historical and does not validate this final saved source.
- First focused 11-case run: **5 passed, 6 failed (1.4 minutes), clean runner exit**.
  Passing: four inventory/ledger/guard unit cases and all-scope Print/export PDF
  byte equality plus CSV contents. Six browser failures: three Quantity label
  lookups, ambiguous Audit date label, wrong review usable-stock expectation,
  and wrong latte-consumption display units. Corresponding corrections are saved;
  full corrected cases have not been accepted.
- Full 136-case browser suite was then started. **INTERRUPTED with Ctrl+C at the
  user's stop request; no complete runner summary.** Observed output contained
  **76 passing / 3 failing completed cases** (79 completed; numbering reached 80;
  case 76 and later browser acceptance were in progress or not reached). Treat
  these as observed partial output, NOT a finished 136-case result. Four new unit
  cases passed again. Existing Admin responsive geometry, compatible unit editing,
  dashboard/time drill-down, role/void, once-only consumption and library-copy
  regressions were among passes. The final PDF case was not rerun in the full suite.
- Three reached full-suite failures and saved follow-ups:
  1. `dashboard-reports.spec.ts` partial expiry: row status actually Expiring Soon,
     because a usable batch expires within seven days, ahead of partial expiry.
     Dashboard removal label/drill-down assertions had already passed. Saved test
     expectation now uses Expiring Soon; this correction has NOT been rerun.
  2. `inventory-pos.spec.ts` whole-cart customization: new shared guard returned
     empty usage on shortage, losing "1 pcs short for order". This was a real
     regression introduced here. Source now retains usage on a valid shortage;
     its failing case has NOT been rerun.
  3. `inventory-pos.spec.ts` expiry/replenishment: `#stock-IN-ONION` is the removal
     row (500g expired), while `#usable-stock-IN-ONION` has 550g physical and 50g
     usable/Low Stock. Saved quantity/status assertions and batch expansion scoped
     accordingly; they have NOT been rerun. Further duplicate controls may emerge.
- Diagnostics/traces for these reached failures remain in `Frontend/test-results/`.
  The full run overwrote first-focused-run diagnostics; the failures above preserve
  their cause/evidence. No test-owned preview server remains: after interruption,
  read-only checks found no listeners on 5180 or 5181. Runner exited with code 1
  on interruption; no implementation was continued afterward.
- Read-only `git diff --check` still reports README.md's pre-existing extra blank
  line at EOF (line 473 in this checkout); frontend remains untracked, so this is
  not complete source whitespace validation. No unrelated cleanup was performed.

#### Reports research and fresh PDF visual QA actually completed

- Read official Carbon Data table guidance: clear titles/descriptions, consistent
  sizing, readable aligned values, row hover, and table-specific bottom pagination:
  https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines
  This is design guidance, not a claim of formal industry-standard certification.
- Read PDF skill; artifact-start marker ran successfully once (create / 3 / pdf).
  Bundled Python/Poppler rendered the newly exported actual-catalogue PDFs. Visually
  inspected ALL pages via contact sheets: Combined **11**, Sales **3**, Inventory
  usage **8** (22 total). No clipping/overlap or broken wrapped headings observed.
  Byte equality and all-record CSV checks passed in the first focused browser run.
- Fresh QA artifacts: parent `.review/frontend/october-5-redesign/` (outside repo),
  `combined.pdf`, `sales.pdf`, `inventory-usage.pdf`, matching CSVs, per-page PNGs
  and `*-review-*.jpg` contact sheets. These are current-catalogue artifacts and
  are distinct from legacy test exports under older review directories.
- Preview iframe visibility and same-blob browser-viewer link were tested; actual
  native PDF-viewer Print UI / OS printing NOT exercised. No fresh desktop/tablet/
  phone/short-screen application screenshots were produced or inspected.

#### CURRENT continuation script — resume here, not older scripts

```text
Resume frontend-only work in C:/Users/ASUS/Documents/Personal/Vertwell/repo.
Read this newest October 5 stock-safeguards checkpoint, then the COMPLETE
"Highest priority — frontend fixes for a new chat (October 5, 2026)" section and
its "Original user message — verbatim, not summarized" block. Follow every
original requirement; the per-bullet status table here is evidence/remaining work,
not a rewritten substitute. The overall task is partial and UNACCEPTED.

All implementation is saved/uncommitted; no server remains on 5180/5181. Preserve
existing source/assets/licenses, actual replacement catalogue, five identities,
Owner-only Daily Review, role/void rules, historical snapshots, sample/reset
notices and once-only stock deductions. Read applicable AGENTS.md if any appears.
README's top checkpoint still describes the prior pause; this HandsOff checkpoint
is newer and authoritative. Do not rerun old one-time helpers or old completed phases.

Start with the THREE reached full-suite failures in Frontend/test-results/ and
review their saved fixes. Then run inventory-pos.spec.ts, dashboard-reports.spec.ts
and the corrected redesign-continuation.spec.ts using the test-owned Vite setup.
Fix remaining selectors/assumptions against actual UI; do not silently weaken
arithmetic or role assertions. Verify the physical 10-cookie correction selects
butter-cookie-2: current seed is 18 physical / 6 expired / 12 usable, so correcting
the physical total to 10 leaves 4 usable. Test quantity corrections, no negative
batches, compatible units, expired/Unsellable preservation, shared-SKU variants/
bundles, retained-cart stock/unavailable/removed changes, and actual final payment
guards for incompatible/duplicate inputs. Add meaningful boundary integration
coverage if needed; shared-helper checks alone are not the complete payment flow.

Finish current-catalogue Inventory order/scopes/status sorting/dependency deletion,
Daily Review + All requests across Owner/Admin/Staff, and no-visible-Manila checks.
Verify five new lattes plus today's seed consume 0.108 kg espresso; changing
periods changes bars; future typed dates and calendar navigation cannot export/
print. Handle unknown baselines without invented percentages. Review invalid sale
timestamps before businessDate conversion and wholly Unsellable batch labeling
if relevant; these are review concerns, not established accepted fixes.

Inspect desktop, tablet, phone and short-screen Reports/export-summary/Inventory/
modifier layouts, including exact control alignment and contrast. Fresh all-scope
PDFs and all 22 rendered pages were reviewed in this chat; repeat rendering only
if report output changes. Cached PDF byte equality passed, but actual PDF-viewer
Print UI / OS printing remains unverified. Keep Print/export tied to the same PDF.

Run final root typecheck, frontend production build and COMPLETE updated browser
suite with test-owned server/teardown after fixes. Record exact results, each
original bullet's implemented/verified state, and remaining limitations. Only mark
the whole priority task complete when EVERY original requirement is implemented
AND verified. No backend integration, commit or deployment is authorized.
```

### Latest pause — October 5 investigation and acceptance-test draft saved

**User instruction:** "lets stop for now save the progress to continue in the next chat".
Work stopped immediately. This checkpoint supersedes the prior Latest pause;
all earlier checkpoints and the FULL verbatim October 5 priority request below
remain preserved. The frontend redesign is still **partial and unaccepted**.

#### What happened in this chat

- Read the latest two checkpoints, the complete original priority message,
  relevant frontend source/tests, README, and the saved failure diagnostics.
  No applicable AGENTS.md was found in the workspace file search.
- Ran the existing complete 125-case browser suite against the saved source:
  **113 passed, 12 failed (5.4 minutes), clean runner exit**. This was an
  exploratory run, not acceptance. The test-owned Vite server closed; a read-only
  socket check after stopping found no listeners on ports 5180 or 5181.
- Added only **Frontend/tests/redesign-continuation.spec.ts**, a draft containing
  11 current-catalogue acceptance cases: ledger/conversion reconciliation,
  receipts/removals/periods, payment guard validation, expired/unsellable batches,
  cookie correction/stock cap, shared-SKU variants and bundles, retained carts,
  dependency-safe deletion, Audit review roles, changing recipe percentage bars,
  and Print/export byte equality with all-scope CSV/PDF output.
- **The new test file has NOT been run and is NOT ready.** It imports the proposed
  validateStockUsage helper, which DOES NOT EXIST yet, and expects an editable
  quantity/batch-correction UI that has NOT been implemented. A new full suite
  will fail discovery until the missing helper is implemented or that import is
  addressed. Fix its assumptions and selectors against the actual UI: use
  PR-DECK-SLEEVES (not PR-SLEEVES); DailySalesReview fields are Counted cash for
  included receipts / Verified GCash receipts amount, requires checking every
  receipt, and submits with Confirm reviewed sales. The period-bar assertion must
  include the existing seeded 18g espresso consumption (five new lattes add 90g).
  Do not count these draft cases as accepted coverage.
- Proposed implementation edits were attempted but the orchestration calls
  failed with JavaScript syntax errors before invoking apply_patch. **No frontend
  application source changes were applied in this chat.** The proposed temporary
  finish-redesign.cjs helper was also NOT created. Do not look for or rerun it.
- No new typecheck/build was run; prior passing results remain historical. The
  read-only git diff --check now reports README.md's existing extra blank line at
  EOF (line 458 before this documentation update); it is not a clean result.
  Frontend remains untracked, so tracked diff checks do not cover its source.

#### Exploratory failures and observed causes

Diagnostics/traces for all 12 reached failures are in Frontend/test-results/.
Inspect each rather than blindly changing expectations:

1. admin.spec.ts: readable/touch/contained tables — the single .stock-table-wrap
   locator now resolves to separate removal and Ingredients regions.
2. continuation.spec.ts: stock unit edit — the same multiple-region locator;
   saved quantity/batch/threshold conversion still needs actual acceptance.
3. dashboard-reports.spec.ts: partial expiry — Dashboard intentionally says
   Needed to Remove Stocks instead of Contains expired stock. Its later remaining
   stock table selector also needs review against ReportTable's current regions.
4. frontend.spec.ts: restocking — multiple .stock-table-wrap tbody regions.
5. inventory-pos.spec.ts: expiry/replenishment — removal row now says
   Expired / unsellable instead of Expired / unusable.
6. mock-data.spec.ts: once-only consumption — #stock-FD001 identifies the removal
   row (6 expired pieces in legacy fixture), not the 17-piece physical total.
   Scope the usable row/current-stock report deliberately; do not alter arithmetic.
7–8. modifiers.spec.ts: reusable group and repeated imports — Library group is
   inside the new collapsed Reuse a library group disclosure and must be opened.
9. priority-feedback.spec.ts: Inventory scope — multiple stock regions.
10. redesign.spec.ts: Inventory search — multiple stock regions; empty-section
    counts also need review because the tables are now separate.
11–12. redesign.spec.ts: unavailable ingredient checkout and double submission —
       multiple stock regions in the final quantity assertions.

#### Source review findings to implement next

- App.recordSale compares converted quantities directly to usableQuantity. An
  incompatible-unit conversion returns NaN, whose greater-than comparison is
  false. Duplicate consumption inputs also need aggregation before the final
  availability check, and consumeStock needs normalized quantities in stock units.
  Implement a shared finite/nonnegative/compatible-unit/aggregate guard and test
  the actual final payment boundary. Existing duplicate order/reference protection
  and once-only deduction must remain.
- POS retained-cart validation checks removed product IDs, but does not check a
  currently unavailable catalogue product. Add that validation while preserving
  deliberate historical cart price/recipe snapshots and existing regression intent.
- Inventory currently disables Quantity for existing records and tells users to
  receive stock. The reported set-to-10 / order-100 cookie scenario is STILL NOT
  reproduced. Consider explicit physical quantity corrections, preserving batch
  reconciliation/expiry: a multi-batch correction must select the affected batch
  and cannot make it negative. Compatible unit changes must convert the entered
  quantity and all batches/thresholds. Preserve Unsellable status on metadata edits.
  Do not claim the original POS bug's root cause was established from this review.
- App.updateStock fails to create an Opening movement for a newly added zero-stock
  record because it records only truthy deltas. Record the zero opening as well.
- periodBalance needs real-calendar-date validation, movement-kind/sign guards,
  future event checks, and negative opening checks in addition to its existing
  reconciliation/incomplete-snapshot guards. The new draft unit cases target these.
- stockCondition should explicitly identify Unsellable records/partial batches,
  exclude Unsellable batches from Expiring Soon calculation, and retain usable-low
  stock priority. Dashboard/Inventory counts must include explicit Unsellable.
- CustomizeProduct's increase button currently increments beyond available stock
  although Save refuses it. Consider disabling it using the whole candidate cart;
  typed excessive quantities must continue to show a useful shortage error.

#### Research and PDF state

- Re-read official Carbon Data table usage guidance (titles/descriptions, consistent
  sizing, readable columns, row hover, pagination at the bottom of its table):
  https://carbondesignsystem.com/components/data-table/usage/
- Read the PDF skill at
  C:/Users/ASUS/.codex/plugins/cache/openai-primary-runtime/pdf/26.909.12148/skills/pdf/SKILL.md.
  Its marker ran successfully ONCE in this chat with create / expected count 3 /
  pdf. No fresh current-catalogue scope PDFs or renders were produced. The existing
  regression suite did execute its legacy direct-PDF download test, which may
  overwrite the historical redesign combined-report.pdf; do not confuse it with
  current-catalogue Print/export acceptance. No byte equality/viewer/OS print QA.
- Bundled dependencies were located again. Python:
  C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe.
  Poppler: dependencies/native/poppler/Library/bin/pdftoppm.exe and pdfinfo.exe.
  Intended new QA directory: ../.review/frontend/october-5-redesign/ (the draft test
  creates it when run). No new responsive screenshots were inspected in this chat.

#### Next chat

Resume frontend-only with this checkpoint, the prior two checkpoints and the full
verbatim priority request. Implement the reviewed stock safeguards/correction and
ledger fixes, finish the draft tests, and adapt legacy selectors where intentional
UI changes warrant it. Then verify the actual catalogue cookie cap, retained cart,
shared SKUs, role/deletion paths, period bars and cached identical Print/export PDF.
Inspect desktop/tablet/phone/short-screen layouts; render fresh all-scope PDFs and
visually inspect them. Run root typecheck, frontend build and the COMPLETE updated
suite using test-owned server/teardown. Record exact results and remaining limits.
All source remains saved and uncommitted; no backend work, commit or deployment.

### Latest pause — October 5 continuation saved again at user request

**User instruction:** "lets stop for now save the progress to continue in the next chat".
Work stopped immediately at that instruction. This checkpoint supersedes the prior
Latest pause below; that prior checkpoint and the FULL verbatim October 5 priority
message are preserved as context. The redesign remains **partial and unaccepted**.
All source changes are saved and uncommitted. No backend work or deployment.

#### Changes saved during this continuation

- `Frontend/src/pages/Reports.tsx`: completed the `movements` prop wiring and
  rebuilt the report view. Daily ingredient balances now use `periodBalance`, with
  opening, receipts, used, removed, closing and percentage values; segmented bars
  distinguish remaining/consumed/removed stock. Current physical/usable stock and
  expiry remain separate. Disclosures identify the August 1, 2026 illustrative
  sample baseline and in-memory reset behavior. Unknown baselines remain explicit.
  Sales/usage tables have date AND time bounds; ingredient period balances use
  full business days because movement records have dates only, with visible notes.
  Future dates and invalid/reversed ranges disable export/Print. Both calendars
  receive a maximum of today. Native typed invalid dates remain visible with an
  explicit error; DateField itself has NOT been changed in this continuation.
- Reports export summary is now a compact scope/format/category/count/revenue
  review instead of repeating nested stock tables. All-filtered-record CSV/PDF
  behavior and sales-category versus all-inventory scope notes are retained.
  Visible Manila labels were removed from Reports; business timezone calculations
  still use Asia/Manila. No comprehensive remaining-label sweep was completed.
- `Frontend/src/lib/report-export.ts`: extracted `createPdf(): Promise<Blob>`;
  PDF table heading heights are calculated from wrapped heading content. Reports
  caches that generated Blob for its current document. Print opens a PDF preview
  dialog, with Download PDF and Open PDF to print (the same Blob in the browser
  PDF viewer). Export PDF uses that cached Blob as well. No webpage window.print
  call remains in Reports. The native viewer's Print control is the intended
  printing path. Byte identity, preview rendering, viewer behavior and OS printing
  are NOT yet verified; no new PDFs were exported or rendered before stopping.
- `Frontend/src/components/ReportTable.tsx`: added optional descriptions, record
  counts and numeric-column alignment; pagination stays with each table.
- `Frontend/src/data/stock-movements.ts`: guards now reject duplicate openings,
  missing/incomplete committed snapshots, invalid/incompatible quantities,
  consumption before opening, future/reversed ranges and a ledger that does not
  reconcile to current on-hand. An opening on the first selected day is included
  as opening rather than a receipt. These guards need meaningful tests, including
  conversions, receipts/removals, before-baseline dates and incomplete snapshots.
- `Frontend/src/data/reporting.ts`: restored usable-low-stock priority for partial
  expiry, while keeping Expiring Soon ahead of Low Stock. The existing direct
  stock-alert regression passed in the interrupted run. Explicit Unsellable label
  details and ingredient urgency ordering still need acceptance checks.
- `Frontend/src/pages/Inventory.tsx`: removal table now scopes Ingredients to
  Ingredient records and Products to Finished records; All inventory includes both.
  Zero-quantity finished records remain reachable in the finished stock register.
  Filter summary counts unique visible stock records plus products. Partial-stock
  batch expansion filters removal versus usable batches to avoid repeated active
  batch rows. Product modifier library picker is in an expandable disclosure and
  introductory copy is shorter. Review the new scoping/counts, partial batches,
  DOM IDs and dashboard drill-down pagination in browser before accepting.
- `Frontend/src/pages/Pos.tsx`: added cart validation against the current product
  list so a removed product retained in a cart cannot proceed to checkout. Existing
  stock safeguards from the prior pause remain. The exact reported 10-stock /
  100-cookie scenario is STILL NOT reproduced or verified. Final App stock guard
  still needs review for incompatible-unit NaN and aggregated inputs; do not claim
  the POS bug is resolved without current-catalogue acceptance.
- `Frontend/src/pages/Dashboard.tsx` and `App.tsx`: Dashboard's filtered-report
  callback now carries start/end times into Reports, as well as dates/category.
- `Frontend/src/redesign.css`: added aligned Inventory control bottoms, distinct
  cream modifier container / white group cards / option panels, responsive chart
  date/time fields, grid bars for variable day counts, Audit daily queue styles,
  report table section headers/hover/numeric alignment, ingredient balance cards,
  compact export summary and PDF preview dialog styles. Desktop/tablet/phone/short
  screen visual QA remains unfinished; some existing geometry checks are failing.

#### Actual validation and clean stop

- Root `npm run typecheck`: **passed** (frontend + backend).
- `npm run build --workspace Frontend`: **passed**, fresh Vite production build.
- Full `npm run test:e2e --workspace Frontend` was started with 125 existing tests
  and 2 workers. It was **interrupted via Ctrl+C at the user's stop request**.
  Output reached 25 cases: 22 passed and 3 failed; this is NOT a completed suite.
  Reached failures:
  1. `admin.spec.ts` — admin pages retain readable text, touch controls and contained
     tables across sizes.
  2. `continuation.spec.ts` — stock unit editing converts displayed quantity,
     batches and reorder threshold together.
  3. `dashboard-reports.spec.ts` — partially expired stock stays actionable and
     reports separate physical from usable quantities.
  Failure diagnostics/traces are in `Frontend/test-results/`; inspect them first.
  Some assertions reference changed labels/sections, but DO NOT assume all failures
  are stale expectations. Reached passing cases include report category/time
  drill-downs, mobile chart controls and the direct partial-expiry stock-status test.
- No tests were added or modified during this continuation. Current catalogue,
  inventory removal, percentage changes, cached PDF equality and new Audit queue
  acceptance tests still need to be written. The earlier 125-pass baseline remains
  historical and does not validate this source.
- `git diff --check`: passed for tracked changes (frontend scaffold is untracked).
- Test runner exited after Ctrl+C. Read-only socket checks found **no listeners on
  5180 or 5181** after stopping. No preview/test server was left running.
- The PDF skill was read again and its artifact-start marker ran successfully once
  with create / expected count 3 / pdf. No PDF artifacts were produced in this turn.
  Do not rerun old one-time edit helpers. QA remains under parent `.review/`, outside
  the repository. Bundled Python/Poppler paths are recorded in the prior checkpoint.

#### Research read during this continuation

Read official Carbon Data table guidelines and NN/g Data Tables: Four Major User
Tasks. Applied clear section titles/descriptions, consistent rows, aligned numbers,
hover and table-specific pagination as design guidance, without claiming compliance
with a formal industry standard:
https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines
https://www.nngroup.com/articles/data-tables/

#### Next-chat continuation

Resume frontend-only October 5 redesign in this repo. Read this Latest pause, the
prior pause and FULL verbatim priority message below. Preserve all saved source,
original artwork/licenses, replacement catalogue, five identities, role rules,
Owner-only confirmation, once-only stock deductions and sample/reset notices.
First inspect the three reached browser failures and review the saved Reports /
Inventory / CSS changes. Do not rerun older completed phases or claim acceptance
from the earlier 125-pass baseline. Add meaningful current-catalogue tests for the
reported POS limit, shared-SKU carts, expired/unsellable quantities, retained-cart
stock/product changes, final payment guards, Inventory removal/dependency handling,
Audit daily/all-review access and Owner/Admin/Staff permissions. Verify ingredient
balances with conversions/receipts/removals/period changes and reconcile the actual
seed. Verify Print and export use byte-identical cached PDFs, export all three
scopes, render and inspect fresh PDF pages. Inspect desktop/tablet/phone/short-screen
layouts, resolve genuine regressions, adapt intentional label changes in older
fixture tests, then run root typecheck, build and the complete browser suite with
the test-owned Vite server/teardown. Record exact acceptance and limitations in
README and this file. No commits, backend integration or deployment are authorized.


### Latest pause — October 5 frontend redesign started; save and continue next chat

**User instruction:** "lets stop for now save the progress to continue in the next chat".
Work stopped at that instruction. The October 5 request below remains the active
scope; its full original wording is retained unchanged. Implementation is partial
and **not accepted or browser-verified**. Do not replay older completed phases.

#### Source changes saved in this chat (partial, unverified)

- `Frontend/src/data/inventory.ts`: usable stock is capped by physical on-hand,
  explicit `Unsellable` records/batches are excluded, order quantities must be
  positive safe integers, shortage messages include available/needed quantities,
  and consumption skips unsellable batches. Added `removalQuantity` and
  `removeUnusableStock` helpers for expired/unsellable quantities only.
- `Frontend/src/App.tsx`: added a current-stock ref and final stock-availability
  guard before recording a sale; centralized `updateStock` records quantity
  additions/removals and updates stock. Added in-memory opening/receipt/removal
  movements, product/stock removal callbacks, Audit review callback, and passed
  movements to Reports. Existing Owner-only confirmation and stock-commit policy
  are retained. Reports has NOT yet been updated to accept that new prop.
- New `Frontend/src/data/stock-movements.ts`: `StockMovement`, `openingMovements`
  and `periodBalance` reconstruct a mock period using explicit opening quantities,
  movements and committed sale usage, with compatible-unit conversion and unknown
  baseline guards. Opening demo movements are provisionally dated August 1, 2026.
  New records get their actual creation business date. These assumptions need
  review/documentation and meaningful tests before presenting percentages.
- `Frontend/src/pages/Inventory.tsx`: partial table separation, with **Needed to
  Remove Stocks** first, Sellable products, then Ingredients in All inventory.
  Separate table pagination; Ingredients are sorted Expiring Soon, then low/out,
  then other stock. Usable finished stock is retained in an expandable management
  section so receiving/editing variants, bundles and unlinked SKUs remains possible.
  It opens for stock searches/drill-downs. Partial-expiry records can appear in both
  removal and usable sections, using separate DOM IDs. Added confirmed product and
  stock-record removal; referenced stock cannot be deleted until product links are
  removed. Removing a product retains stock and historical transactions. Added
  confirmed removal of only unusable quantities. Modifier library destination now
  shows **Back** while open. Modifier legends include the group name, but the
  requested panel-contrast/layout redesign is still unfinished.
- `Frontend/src/pages/Pos.tsx`: Stocked cards show remaining usable quantity after
  the cart. Plain-product cards and cart + buttons disable when another unit exceeds
  cart-wide usable stock. Existing add/customization/checkout checks remain. The
  reported 100-cookie scenario has NOT been reproduced or tested; do not claim its
  root cause is resolved just because guards were strengthened.
- New `Frontend/src/components/DailyReviewQueue.tsx` plus edits to
  `pages/SalesHistory.tsx`: Owner/Admin Audit includes a Daily Sales Review queue
  and opens the same review modal; Admin remains read-only for confirmation.
  Added `AuditContext.allReviews` and an All review requests filter which includes
  awaiting daily review OR pending void requests. `components/AlertCenter.tsx`
  sends that context from Dashboard **View all requests**. Existing explicit Void
  requests filtering remains separate. These role/filter paths need browser checks.
- `Frontend/src/pages/Dashboard.tsx`: Needs attention labels unusable quantities as
  Needed to Remove Stocks. Sales Overview now has date and time range fields,
  provisional 31-day maximum, completed-sale filtering, and a range-aware chart.
  Chart styles and variable-length labels/bars need review; the report drill-down
  currently carries dates/category but does NOT carry the new time bounds.
- Removed visible Manila suffixes from Dashboard, Inventory, Audit, AlertCenter,
  and DailySalesReview text. `Asia/Manila` business date/time calculations remain.
  Reports and any other remaining visible occurrences still need cleanup.
- `Frontend/src/data/reporting.ts`: moved expiry checking before the ordinary
  low-stock result. Partial expiry still returns Contains expired stock first;
  this may regress the previous partial-expiry + low-stock priority. Resolve with
  explicit tests rather than assuming all previous stock-status checks still pass.

#### Validation at the pause

Only `npm run typecheck --workspace Frontend` was run to record the pause state.
It **failed** with one reported error:

```text
src/App.tsx(108,48): TS2322: Property 'movements' does not exist on Reports props.
```

This is unfinished wiring: App passes `movements`, but `pages/Reports.tsx` still
has its old props. Fix by implementing the Reports movement/balance integration.
No production build, root typecheck, browser suite, responsive capture, PDF export,
PDF render or visual acceptance was performed after these edits. No tests were
added or changed in this chat. The old **125 passing** checks describe the October
4 baseline only. Current source is intentionally saved mid-implementation.
No dev/test server was started in this chat. No backend work, commit or deployment.

#### Reports research and unfinished work

Research was started using official Carbon Design System table guidance and
Nielsen Norman Group's data-table task guidance:

- https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines
- https://www.nngroup.com/articles/data-tables/

Use these as design references for clear table section titles/descriptions,
consistent row/control sizes, numeric alignment, readable wrapping, hover states,
and pagination belonging to its table. This is an implementation direction,
not a claim that the Reports redesign is finished or meets an industry mandate.

`Reports.tsx`, `ReportTable.tsx`, `lib/report-export.ts`, `DateField.tsx`, CSS files
and tests have NOT yet been edited in this chat. Remaining requested work:

1. Wire `movements` into Reports and use `periodBalance` for selected-period
   ingredient used/remaining percentages. Include opening/receipt/removal quantities,
   a dated sample baseline and closing balance; keep current usable stock and expiry
   distinct. Disclose unknown baselines before the opening date or with incomplete
   movement data. Make bars change with actual recipe/modifier purchases and dates.
2. Redesign Reports, all report tables, Ingredient usage / remaining stock and the
   Export Report summary. Keep all-filtered-record export behavior and the existing
   sales-category vs all-inventory scope disclosures.
3. Make Print and PDF export render the exact same generated PDF/document. No
   print approach has been implemented; currently Print still calls window.print
   on the webpage and export still generates its separate jsPDF layout. Choose and
   verify a browser PDF print/preview flow with matching cached document content;
   retain CSV as structured data. Do not claim actual OS printing was tested.
4. Prevent future report dates via both calendars, native typed dates and explicit
   validity handling. Clean up remaining visible Manila labels without changing
   timezone calculations. Review DateField bounds/clamping.
5. Finish Inventory control alignment (category/search/tabs/action), modifier group
   contrast and information hierarchy, and responsive styles for new Audit queue,
   Dashboard date/time controls, stock removal, and Reports. No CSS has changed yet.
6. Review removal-table view scoping/counts, zero/partly expired stocks, batch details
   and DOM IDs, dependency-safe removal, surviving cart snapshots of removed products,
   and Dashboard drill-down pagination. Preserve stock receiving/configuration access.
7. Reproduce the 100-cookie limit case against the actual replacement catalogue;
   test cart increases, customization quantities, shared-SKU variants/bundles,
   expired/unsellable stock, stock changes while a cart is retained, final checkout,
   review without a second deduction, and integer/finite validation.
8. Add meaningful current-catalogue browser checks, adapt older fixture assertions
   where labels/behavior intentionally changed, then run root typecheck, frontend
   production build and the complete suite with the owned Vite server/teardown.
   Historical tests expect old Stock records labels, combined stock regions, Manila
   text, partial-expiry labels and unavailable bars; inspect rather than blindly
   replacing assertions. Legacy data stays test-only; actual acceptance must exercise
   the real replacement catalogue.
9. Capture/review desktop, tablet, phone and short-screen layouts. Export fresh PDF
   scopes, render matching pages and inspect them; old PDFs/captures are historical.
   Update README and this handoff with exact accepted changes/results.

The PDF skill was read for later export QA:
`C:/Users/ASUS/.codex/plugins/cache/openai-primary-runtime/pdf/26.909.12148/skills/pdf/SKILL.md`.
Its artifact-start marker has NOT been run (no PDF authored/exported this chat).
Before PDF authoring run its `container_tools/mark_artifact_operation_started.mjs`
once as required. Bundled dependency paths were discovered:
Python: `C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`;
Poppler: `.../dependencies/native/poppler/Library/bin/pdftoppm.exe` and `pdfinfo.exe`.
QA belongs under `C:/Users/ASUS/Documents/Personal/Vertwell/.review/`, outside repo.

#### Ready-to-paste continuation

```text
Resume the October 5 frontend redesign in
C:/Users/ASUS/Documents/Personal/Vertwell/repo. Read the Latest pause checkpoint
at the top of HandsOff.md, then the FULL verbatim October 5 priority message below.
The user paused mid-implementation to continue in a new chat. Preserve all saved
uncommitted source and the original assets/licenses, five preview people, replacement
catalogue, role rules and sample/reset notices. Do not replay completed older work.
First inspect the saved edits and finish Reports movement props/balances; frontend
TypeScript currently fails because App passes movements to the unchanged Reports.
Reports styling, shared Print/PDF generation, future-date bounds, modifier contrast,
Inventory alignment and responsive QA remain unfinished. No new browser/build/PDF
validation has been performed. Reproduce and verify the reported POS limit bug.
Keep work frontend-only; no commits/deployment/backend integration. Preserve the
test-owned Vite server with in-process teardown. Real-catalogue tests must use the
actual preview; legacy fixtures remain explicitly test-only. Record exact results.
```

### Highest priority — frontend fixes for a new chat (October 5, 2026)

**Status: all 18 frontend-preview requirements implemented and verified October 5; see the Latest completed checkpoint above.** The user requested saving the full message without summarizing because preserving their intent is important. The entire original message below remains unchanged. Its intent remains the requirements reference; earlier October 4 results and interrupted October 5 runs are historical, superseded by the fresh 148-passing-test result above.

#### Original user message — verbatim, not summarized

```text
okay 
I want you to add this in the Handsoff file a priority fixes for the Frontend, also when putting this in the handsoff file dont summarize it I want the intent to be in the message it is important that what I had in mind is passed on.

this will be another Task and by putting this in the handsoff I will start the task in a new chat

Dashboard
- the Daily Sales Review part the Manila is not necessary actually in all the date the manila word is not necessary needed to be in there
- the Daily Sales Review should also be in the Audit Trail so when I click the View All requests it will include to show the daily sales Review there
- on the Sales Overview there should be a date time picker as well

Inventory
- the Category Drop Down is not aligned with the search bar and the filter buttons
- when I click the modifier groups it moved to the new  page and I see again the Modifier Groups button change the text of it into "Back" 
- there is also the Finished Stock in the Products, I want to change this into "Needed to Remove Stocks" also add this in the needs attention part in the dashboard so that the owner can get notified about this stocks that are still in the inventory.
- there should be a way to remove products and Ingredients on the inventory not only edit or add
- when I click all inventory in the filter it shows Sellable Product, Ingredient and finished stock. instead of combining ingredient and finished stock give the ingredients its own table and the finished stock changing to "Needed to Remove Stocks". now the Needed to remove stocks table should be the first table before the Sellable Product and Ingredient.
- when adding new Product the design on the Product Modifiers panel Is there any better design because when I click add modifier group it looked like the modifier group panel is the same color as the panel of the Product modifiers, I like it that the modifier group 1 is inside the main panel Product Modifiers but I need it to be more Visible it looked like there is too many info need to put its not looking good for the eyes 
- the ingredients table there should be status order for example the Expiring Soon should be at the top and next is the Low stock and last is the In stock in this way the priority is the Expiring Soon and Low stock, since the Expired / Unsellable Status is placed in another table which is "Needed to Remove Stocks"

POS
- I tried to Order like 100 butter cookie pouch even tho in the inventory I set the stock of it as 10pcs only and it still let me order the 100 butter cookie and proceed in Payment, this is a big bug. I need the POS to know the Current Stock available, I already see that it doesnt count the stock that are already flagged unsellable so that is a good thing but it still dont restrict the user for adding a lot of quantity in the POS.

Reports
- can you research more on how to make the UI/UX of the whole Report page look good in industry standards. this include the Export Report Summary
- Right now the Export Report and Print are different when I download the Export Report it didnt look the same with what I print this should be the same.
- I want you to include the UI Design in all the Table as well, specially in the Ingredient usage / remaining stock. I tried ordering a bunch of Items and the HP-Bar Like there didnt change, it should show the Percentage of Stock available and lessen it by the stock used in that specific Date.
- also the date time picker should not be able to pick the date of future since this is a report part

Audit Trail
- in the dashboard there is Daily Sales Review add it here as well so when I click the View All Requests in the Dashboard It can Show me all as well as the Dail Sales Review.
- Remove the Manila here are well when selecting a transaction it shows me the order details with Manila I dont think it is necessary because the shop is in the Philippines and not international.

User
- No Issues here.
```

#### Previous initial continuation script — historical; use Latest pause above

```text
Resume in C:/Users/ASUS/Documents/Personal/Vertwell/repo when the user starts the
new frontend-fixes task. Read the October 5 highest-priority section in HandsOff.md
and its entire verbatim user message first, then the last completed October 4
checkpoint below, README.md and any applicable AGENTS.md.
The October 5 request is recorded only: none of its fixes or Reports UI/UX research
has been performed or verified. Carry the full original intent into implementation;
do not substitute a shortened summary for the user's requirements.
Older completed acceptance statements and scripts describe previous work and do
not mark this new task complete. The last recorded baseline is 125 passing browser
checks plus root typecheck and frontend production build, before these new fixes.
Preserve the existing uncommitted scaffold, actual replacement catalogue, five
preview people, original assets/licenses, scoped role styles, sample/reset notices
and the test-owned Vite server with in-process teardown. Current-catalogue checks
must exercise the actual preview; older fixture regressions use test-only data.
Keep the new task frontend-only. Record its actual changes, validation and remaining
questions when it is performed. Backend integration, commits and deployment remain
separate work.
```

### Last completed implementation — replacement sellable catalogue; three Hobby stock models (October 4, 2026)

The user requested replacing all Inventory sellable mock products and removing the
old list. The user clarified that **Hobby uses Stocked/retail, Variants and Bundle**;
**Food/Beverage also retains Uses ingredients (recipe)**. This supersedes the earlier
ten-product catalogue below. Food's replacement examples demonstrate all four models.

- `Frontend/src/data/demo.ts` replaces every old sellable name and product ID with
  ten new products: three recipes (Iced Caramel Latte, Mango Oat Smoothie, Grilled
  Beef Sliders), three Stocked (Butter Cookie Pouch, Deck Sleeves, Trading Card Binder),
  two Variants (Cookie Box Sizes: Small FD010/PHP 75, Large FD009/PHP 150;
  Model Kit Editions: Standard HB004/PHP 750, Deluxe HB005/PHP 1,250),
  and two Bundles (Tabletop Starter Bundle: 2 HB009 + 1 HB010/PHP 500; Cafe Snack
  Bundle: 1 BV001 + 1 FD010/PHP 140). Bundle and standalone/variant sales share SKUs.
  Sliders use buns, patties and onions, with extra cheese/no-onions options. Latte
  uses 18g espresso beans, 200ml milk and 20ml caramel; smoothie uses 200ml oat milk
  and 60g mango puree. Recipes and prices are illustrative, not business specifications.
- Hobby's editor already excludes the recipe choice. Switching a recipe draft to
  Hobby now selects Stocked, so it cannot retain an invisible recipe model. Switching
  back to Food and selecting Recipe restores the draft recipe inputs.
- The session now has 32 stock records: 13 Ingredients and 19 finished SKUs. Finished
  stock names match new product/configuration links; bottled beverages have explicit
  finished SKUs BV001/BV002. The retained Ingredients support user-created recipes.
  New mock products use existing category icons instead of unrelated old photos.
  All original artwork and licenses remain preserved; no AI images were generated.
- All six historical and five current-day receipts are regenerated from the new
  catalogue. Seed sale creation snapshots selected variants, bundle contents, price,
  requirements and usage. Opening receipts reconcile with every consumed sale,
  including the historical void. Five accounts and their stable actor IDs remain;
  four current-day paid Pending receipts total PHP 582.40 (414.40 Cash + 168 GCash).
  Owner review/void stock handling and refresh/reset behavior remain in memory.
- Existing interaction regressions use `tests/fixtures/legacy-demo.ts` and an explicit
  Playwright-only module route in `tests/fixtures/legacy-preview.ts`. This preserves
  recipe, modifier, expiry and prior scenario coverage independently of changing
  demo products, without adding a test mode to application code. The legacy product
  list exists only in test fixtures and never ships in the app bundle. New actual
  preview acceptance is `tests/three-stock-models.spec.ts`, using plain Playwright
  without the fixture route. Do not describe older fixture captures as new-catalogue QA.
- Final validation: root typecheck and frontend production build passed; complete
  browser suite **125 passed (4.0 minutes), clean exit**. This includes 118 interaction
  regressions with explicit test-only fixtures and seven checks against the actual
  replacement catalogue. The seven current-data cases also passed separately
  (18.1 seconds), covering category model rules, compatible links, actor/VAT/receipt
  and batch reconciliation, desktop/mobile catalogue/editor/POS, shared-SKU checkout,
  modifiers and recipe usage, Owner review, named Admin void, CSV, independent Staff
  receipts/refresh reset, and recipe-to-Hobby category switching.
- Current captures/CSV are in `../.review/frontend/three-stock-models/`. Desktop and
  phone Inventory/POS captures were visually inspected; mobile table/catalogue
  regions intentionally scroll. Existing regression captures use their test fixture
  data. The interrupted 124-case run predated the user's clarification; the final
  125-case run verifies the clarified implementation. No backend work, commit or
  deployment was performed. Test-owned servers closed at teardown.

Previous completed-catalogue continuation script (historical; use the October 5 priority request above):

```text
Resume in C:/Users/ASUS/Documents/Personal/Vertwell/repo for the next user request.
Read this latest checkpoint and README first. The active sellable mock catalogue has
ten replacement products: Hobby uses Stocked, Variants and Bundle; Food/Beverage also
uses recipes. There are 32 stock records, six historical and five current-day
receipts. Old product names/IDs are removed
from runtime seeds. Food examples demonstrate all four models; Hobby excludes recipes.
Preserve the five preview people, optional photos, original assets/licenses,
scoped role styles, inventory editor workflows and sample/reset notices.
Preserve test-owned Vite port 5180 with in-process teardown. Legacy interaction
tests explicitly use test-only recipe/modifier fixtures; three-stock-models.spec.ts
tests the actual catalogue. Current QA is ../.review/frontend/three-stock-models/.
Final verification: 125 browser checks passed in 4.0 minutes, including seven actual
catalogue cases and 118 explicit fixture regressions; root typecheck/build passed.
Owner checkout completes immediately; paid Staff/Admin checkout consumes stock
once and awaits Owner review. Reviews/voids never deduct again or restore stock.
Keep work frontend-only; no backend integration, commit or deployment is included.
```

### Previous catalogue checkpoint (historical)

The user requested the highest-priority task in this file, resuming frontend work. **The coherent mock dataset is now implemented.** The earlier 114-test acceptance and PDF review below describe the previous dataset. Read the mock-data checkpoint first; older pause/stop instructions and unlinked-catalogue notes are historical. All existing scaffold files, artwork/licenses, scoped styles, variants/bundles, payment focus, modifier library and sample notices remain preserved and uncommitted.

Preserve all uncommitted files, exact `Frontend` capitalization, the scoped `admin.css`/`staff.css`, and sample-data notices. Backend integration, provisioning, deployment, and commits remain outside the authorized scope. No backend implementation, commit, or deployment was performed in this redesign.

### Highest priority implemented — coherent mock users and product inventory (October 4, 2026)

**Status: complete and verified.** All **118 browser tests passed (3.7 minutes), clean exit**, as did root typecheck and the frontend production build. This work supersedes the directions to leave the original catalogue unlinked. The original requirements are retained below, followed by the implementation checkpoint.

- Seed **exactly five users: one Owner, one Admin, and three Staff**. Keep distinct, stable IDs, names, usernames and sample emails. Preserve Angel as Owner and Alex as Admin where practical, retain the existing Staff identities, and add the missing third Staff. Before this phase, initialAccounts contained four users (Angel, Alex, Raven, Micah); Jestine is now the third Staff. These are sample identities, not real account provisioning or saved credentials.
- Make all five identities usable for preview testing so the user can test each Staff account independently, Owner daily review, Admin void attribution, and actor-specific daily history. Choosing only a role must not silently substitute the same Staff identity for every test. Keep existing role permissions and the Owner-account protections.
- Configure **every mock sellable product** with a valid stock model and existing stock links. Recipe-based Food/Beverage items must reference their actual mock Ingredients with clear quantities and compatible units per serving; modifiers must have matching stock inputs. Stocked/prepackaged products and Hobby items must reference finished-stock SKUs; do not impose food ingredients on retail/Hobby products. Variants/bundles, where present, must reference valid component SKUs. No routine catalogue item should remain "Sample stock not linked" after this phase.
- Reconcile the whole Ingredient/finished-stock dataset: names, SKUs, units, quantities, reorder levels, receipt batches, expiry dates and availability must agree. Recipe quantities are explicitly illustrative mock assumptions for testing, not confirmed business recipes. Include usable stock for normal checkout and clear low-stock/expiring examples for attention testing; avoid making the entire catalogue unavailable through stale fixture dates.
- Align seeded transactions with the five users and configured products: recorded actor IDs/names/roles, product names/categories, prices/modifiers, usage snapshots, dates, payment references and review states must be internally consistent. Make current-Manila-day examples usable for Staff history and Daily Sales Review. New paid Staff/Admin sales await Owner review and consume stock once; Owner sales complete immediately. Rebuilding initial demo fixtures must not rewrite sales already recorded during a preview session.
- Keep remaining quantities consistent with any seeded consumed stock. Opening/current-stock quantities or report percentages must not be fabricated from mismatched fixtures; a verified mock baseline may be shown only if its seed movements reconcile. Durable historical balances remain separate backend work.
- Reuse existing product images. If an added/replaced mock product needs imagery, find an existing internet image, or use an existing SVG/icon; **do not generate product images with AI**. Preserve optional-photo support and source/license notices.
- Acceptance: verify the 1 Owner / 1 Admin / 3 Staff count, preview access for each person and Staff history isolation, valid recipe/stock links for every product, checkout/modifier availability and once-only deductions, Owner review, named Admin voids, and matching ingredient usage/remaining-stock reports. Update meaningful tests and run appropriate typecheck/build/browser validation after the dataset changes. Refresh still resets the in-memory preview. No shifts, backend provisioning, deployment or commits are included.

#### Mock-data implementation and verification checkpoint

- `Frontend/src/data/demo.ts` defines five distinct sample accounts and all ten linked products. Mango Matcha Latte consumes 4g Matcha, 200ml Oat Milk and 40g Mango puree; Iced Matcha Latte consumes 4g Matcha and 200ml Milk. Hamburger retains buns/patties/onions, extra cheese and no-onions inputs. Croissant, Mochi, cookie/card packs, Yu-Gi-Oh! and Pokémon products consume matching finished SKUs. Existing images, optional photos and source/license notices are unchanged. Recipe quantities are explicitly illustrative.
- `createDemoData()` creates a fresh independent session once through App's lazy initializer. It defines 30 receipt/opening-stock records (13 Ingredients, 17 finished SKUs), explicit SKUs, compatible units and reorder levels. Six historical August 20 sales and five current-Manila-day sales use recorded actor IDs/names/roles, catalogue prices, sample 12% VAT, recipe and per-line/aggregate usage snapshots. Historical Staff/Admin completions have matched Angel/Owner review snapshots; the historical void records Alex/Admin attribution and retains consumed stock.
- Current-day seeds: Angel's completed Croissant receipt (₱84); Alex's Pending Mochi (₱84); Raven's Pending Iced Matcha (₱84, GCash `9000000000001`); Micah's Pending Card Pack (₱280 Cash); Jestine's Pending Mango Matcha (₱84, GCash `9000000000002`). Owner review begins with four paid Pending receipts: ₱364 Cash + ₱168 GCash = ₱532. Every Staff sees one independent seed receipt and only their own subsequently recorded sales.
- Opening receipt quantities are consumed exactly once by all fulfilled seed sales, including the voided sale. Each consumption uses that sale's Manila date and expiry order. Current Croissant stock is 18pcs: 6 expired + 12 usable; Oat Milk is 32L with 12L/20L batches; Matcha is 120g and low against a 150g threshold; Milk is 15L with an expiry in five days. Onions remain 500g and buns/patties 20pcs. All ten catalogue items are available for an ordinary checkout; independent low-stock, expiring, empty-stock and expired-batch attention examples remain.
- `business-date.ts` shares the Manila date helper without a runtime circular dependency. `inventory.ts` accepts an optional as-of date for seed reconciliation and rounds batch arithmetic to six decimal places. Normal checkout still uses today's date, retains expired stock, and consumes once. Reviews and voids do not deduct again or return stock.
- Login's labelled **Preview person** selector exposes names/usernames and the selected sample email/role. App resolves the selected stable ID against the live in-memory accounts, so edited, added or deleted accounts are reflected after logout. Role switching never rebuilds stock or transactions; refresh resets the session. Normal Supabase sign-in remains a separate Staff sample entry without claiming backend business permissions.
- `Frontend/tests/mock-data.spec.ts` adds four acceptance cases: full actor/product/VAT/usage/batch/remaining reconciliation; every product/modifier's stock linkage and normal availability; all five identities with isolated Staff seeds/new receipts and refresh reset; all-product Admin checkout followed by Owner review, named Admin void, unchanged once-only stock deductions, ingredient reporting and CSV. Existing tests are updated for five users, current-day seed sales, linked catalogue stock, partial expiry and the new report counts, retaining their original behavioral checks.
- Final complete `npm run test:e2e --workspace Frontend`: **118 passed (3.7 minutes), clean exit**, including all four new acceptance cases and the strengthened independent opening-minus-consumption/date checks. Root `npm run typecheck` and `npm run build --workspace Frontend` passed. The initial four-case targeted run also passed (15.1 seconds). The first exploratory full run reached 86 passes/28 old-fixture failures; the intermediate run reached 116 passes/two test expectation failures (retained Hobby category and Croissant's new attention page). All reached failures were corrected, and the final full run passed. No unresolved browser failure remains.
- QA output: `../.review/frontend/mock-data/preview-people-phone.png` (visually inspected), `linked-checkout.csv`, and `browser-suite.log` containing the final 118-case result. Existing responsive/priority tests regenerate 20 UI captures and current CSV/Print assertions in `../.review/frontend/priority-feedback/`; sampled new-data visual inspection covered phone login/Dashboard/Reports and desktop Ingredients. Report acceptance now covers 13 attention items across three pages, 13 ingredient balances, and 26 transaction-linked ingredient rows/12 current-day receipts after seven added burgers. The earlier 22 rendered PDFs and old review JSON remain evidence for the previous dataset, not verification of the new seed values; the PDF-download regression passed, but those old fixture-specific PDF checks were not rerun. Do not rerun old one-time helpers or assume the former 7-sale/12-ingredient/11-attention PDF verifier matches this dataset.
- Reports retain explicit **Baseline unavailable** disclosures; no percentages or historical closing balances are invented from the mock receipt baseline. No backend implementation, provisioning, shifts, deployment or commit is included.
- Final cleanup confirmed ports **5180 and 5181 are free**. No preview server was left running. `git diff --check` passed; the existing uncommitted scaffold remains intact.

#### Previous ready-to-paste continuation script (historical)

```text
Resume from C:/Users/ASUS/Documents/Personal/Vertwell/repo for the user's next request.
Read the highest-priority mock-data checkpoint at the top of HandsOff.md and README.md.
The coherent mock dataset is implemented: Angel/Owner, Alex/Admin and Raven, Micah,
Jestine/Staff; all five identities are selectable by Preview role and Preview person.
All ten products have recipes or finished-stock links. The session seeds 30 stock
records, six historical receipts and five current-Manila-day receipts. Every seeded
consumption reconciles opening receipts to current stock; role changes never reseed.
Review four paid Pending seeds with Angel: PHP 364 Cash + PHP 168 GCash = PHP 532.
Owner checkout completes immediately; Staff/Admin checkout deducts once and awaits
Owner review. Review never deducts again; Admin voids retain named attribution and
consumed stock. Staff history uses the stable cashier ID and today's Manila date.
Recipes and quantities are illustrative; refresh resets this in-memory preview.
Preserve all uncommitted files, exact Frontend capitalization, scoped role styles,
sample notices, existing assets/licenses, modifier library and variants/bundles.
Keep the test-owned Vite server on port 5180 with in-process teardown.
QA for this phase is in the workspace parent .review/frontend/mock-data/.
Final validation: all 118 browser cases passed (3.7 minutes), clean exit; root
typecheck and the frontend production build passed. No acceptance work is pending.
Earlier 114-case acceptance and 22 PDF renders are historical evidence for the old
dataset. Do not rerun dated one-time edit helpers or the old fixture-specific PDF
verifier. Reports still disclose unavailable percentage/historical closing baselines.
No further dataset implementation or validation is pending.
Backend provisioning/integration, durable stock/reviews/accounts, shifts, commits and
deployment need a separately requested phase. Start from the user's next concrete task.
```

### October 4 priority acceptance completed (previous dataset, historical)

The user requested continuation from this handoff. The saved final source/test changes were inspected and validated; **no additional application source or test changes were needed in this continuation**. Documentation and the local capture/contact-sheet helpers were updated. The previous stop instruction was superseded by the user's resume request.

**Historical stop instruction (superseded by this task's resume):** After the validation and visual review completed, the user said, “lets stop for now update the handsoff md script to save the current progress.” The acceptance results below describe that earlier completed phase. No preview/server was left running then.

#### Completed validation

- Expanded priority suite: **6 passed (29.6 seconds), clean exit**. The final screen-only attention hide rule is accepted: six visible buttons on page 1, five on page 2, disabled Next at the end, reset to page 1/six records while retaining CSV format. Print exposes all 11 attention records, 12 ingredient balances and 21 transaction-linked ingredient rows. Recipe creation/checkout, Owner receipt review without duplicate stock use, named Admin void/page clamping, Audit selections and responsive/calendar checks also passed.
- Final root `npm run typecheck` passed for both workspaces. Final `npm run build --workspace Frontend` passed. Backend behavior tests and root/backend production builds were outside this continuation.
- Final complete `npm run test:e2e --workspace Frontend`: **114 passed (3.3 minutes), clean exit**. This supersedes the interrupted full-suite attempts below. The test-owned Vite setup in `Frontend/tests/setup-server.ts` is unchanged.
- Regenerated **20 static page captures** through the priority browser tests, plus **48 review captures** through `../.review/priority-review.mjs`, across 1440×900, 820×1180, 390×844, 320×568 and 820×400. The review helper now includes Daily Sales Review body ends, left/right populated ingredient-table views and both attention pages at every size. Recorded checks found no page/dialog horizontal overflow, no clipped ingredient headings, visible modal headers in all 15 measured contexts, six/five attention records at all five sizes, and no browser/resource errors.
- Visually reviewed the regenerated Dashboard/Inventory/Audit/Reports views, selection summaries, Daily Sales Review and export scrolling/actions, all three export scopes, populated ingredient columns and both attention pages. No additional application layout fixes were required. Long attention captures are cropped from full-page images taken at scroll position zero; selection captures dismiss the temporary checkout notification and start at the page top. This corrects screenshot stitching artifacts without changing runtime navigation.
- Re-exported the three current-day PDF scopes and rendered the matching files with Poppler: **Combined 11 pages, Inventory usage 9 pages, Sales 2 pages**. `../.review/verify-priority-pdfs.py` passed repeated title/date/page-footers, scope sections, all seven sale IDs, all 28 ingredient rows and all 12 baseline disclosures in inventory scopes, ₱1,058.40 paid Pending versus ₱0.00 Completed, and recorded remaining stock (13 buns/patties, 360g onions, 33 cheese slices). **All 22 final rendered PDF pages were visually inspected** for readable rows, repeated headings/footers and page transitions.
- QA output remains outside the repository at `C:/Users/ASUS/Documents/Personal/Vertwell/.review/frontend/priority-feedback/`. `review-checks.json`, `pdf-checks.json`, PDFs, CSV, UI images, `pdf-renders/`, `capture-sources/` and `inspection/` contain the matching evidence. `priority-contact-sheets.py` now covers the 68 UI captures and all 22 PDF pages. Earlier one-time implementation helpers were not rerun.
- Both temporary ports **5180 and 5181 were checked free after completion**. No long-running preview, backend work, provisioning, commit, deployment, goal or automation was created.

#### Preserved behavior and remaining boundaries

Owner checkout completes immediately. Paid Staff/Admin checkout stays Pending until Owner review and consumes recorded stock once at checkout; Owner confirmation never consumes it again. Historical records remain unchanged. Staff history uses recorded cashier ID and the current Manila business date. Admin voids retain the actual Admin name/role without Owner approval and do not restore stock or refund payments. Inventory scope, record paging, selection disclosure, sample notices, licenses and the design-reference archive remain preserved.

The authorized frontend acceptance backlog is complete. The app is still an in-memory sample preview: durable receipts/stock movements/reviews, real roles/accounts, recovery callbacks, payment reconciliation and backend integration require a separately requested phase. Baseline percentages and historical closing stock remain unavailable without verified opening balances and a complete movement ledger. No shift-management phase is authorized. Physical devices, actual screen readers, Safari/Firefox, OS print output, live authentication/payment behavior and exhaustive Figma comparisons remain unverified; Edge browser emulation and Print media assertions do not establish those results.

Future work should begin from the user's next concrete request and this completed checkpoint. Do not replay resolved pause steps or rerun one-time edit helpers. Preserve the uncommitted scaffold and stay frontend-only unless a new request expands the scope.

### October 4 priority acceptance continuation — previous pause checkpoint (historical; superseded above)

**Stop instruction:** The user said, “lets stop for now update the handsoff md script to save the current progress.” The active targeted browser run was interrupted immediately; subsequent work only saved these notes and README. Ports 5180 and 5181 had no listeners after stopping. No goal/automation, backend implementation, provisioning, commit or deployment occurred. Resume only when requested.

#### Changes saved in this continuation

- Repaired `Frontend/tests/priority-feedback.spec.ts`: ingredient Unit and product Category now match their wrapping labels with anchored expressions; the baseline check asserts all 12 tracks exist and none exposes a fabricated progressbar. The formerly blocked **Hotdog with Rice recipe creation/checkout** and **all-page CSV/Print/reset** flows both passed.
- Extended Inventory coverage for empty, one-page and multiple-page product results, last-page boundaries and filter reset. Added a sixth priority case: Admin voids a paid Pending sale on page 2; the Pending list shrinks from seven to six records and clamps to page 1, records Alex/Admin attribution, keeps zero requests neutral, preserves the already-deducted stock, and follows a Report attention link to the highlighted expired Croissant batch. The suite now has **114 cases** (108 retained/adapted + six priority cases).
- Visual inspection exposed Daily Sales Review's title/close button disappearing when scrolling on short/mobile screens. Added scoped flex/scroll rules in `Frontend/src/redesign.css` for **Daily Sales Review and export report dialogs**, keeping the header visible while the body scrolls. Added short-phone and short-tablet header/close visibility checks; both passed in the complete six-case targeted run.
- Visual inspection exposed cramped/overlapping Ingredient usage by transaction headings on phones. `ReportTable.tsx` adds `ingredient-transaction-table`; scoped CSS sets a 720px minimum screen width within its existing named scrollable region. Print still uses the existing zero-minimum/full-width rule. Added a responsive heading-overflow assertion. These changes were typechecked and built successfully, but the complete browser run containing this new assertion was interrupted before final acceptance.
- **Last change before this pause:** Report stock-attention buttons with `.paged-out` were still displayed because the existing `.admin-workspace .attention-link` flex rule overrode the generic hide rule. Added a screen-only, more-specific hide rule in `redesign.css`; Print continues showing every filtered attention record. Expanded the Reports test to expect six visible attention buttons on page 1, five on page 2, disabled Next at the end, six after Clear filters, retained CSV format, and all 11 attention buttons / 12 ingredient balances / 21 ingredient rows under Print. **This final CSS fix and these expanded assertions have not completed validation.** Do not claim stock-attention screen pagination is finally accepted yet.

#### Verification completed, interrupted, and still outstanding

- First repaired five-case run: **5 passed (25.3 seconds)**. After adding the Admin void case and modal-header fix: **6 passed (31.6 seconds)**, clean teardown. Earlier exploratory failures were additional Category-label and VOID-button test selectors; both were repaired and passed.
- Root typecheck and frontend production build passed again **after the ingredient-table width fix**, before the last attention-hide rule/test expansion. No backend behavior tests were run.
- Two full 114-case attempts were deliberately interrupted for newly found visual fixes: the first had 92 reported passes before interruption; the next had 71 reported passes before interruption. Neither is a complete suite result; **no final full 114-case run has completed**.
- At the user's stop request, the expanded six-case targeted run was stopped after two reported passes (recipe flow and Staff/Admin→Owner review). The remaining cases were not completed in that run. This does not replace the earlier complete six-case result and does not validate the final attention assertions.
- `.review/priority-review.mjs` was read and run successfully with its owned temporary port 5181 and clean browser/server teardown. It now captures **23 UI images**: five populated Daily Sales Review views, five selection summaries, three scope export reviews, plus top/bottom export review at five sizes. Its recorded checks found no page/dialog horizontal overflow, visible modal headers in all ten measured contexts, and no page/resource errors. The priority responsive test generated another **20 page captures**. Sizes: 1440×900, 820×1180, 390×844, 320×568, 820×400. **These captures predate the last attention-hide CSS fix; several static page captures also predate the ingredient-table width fix. Regenerate them for final acceptance.**
- Current-day PDFs from that script: **Combined 11 pages, Inventory usage 9 pages, Sales 2 pages** for seven Admin paid/Pending Extra-cheese burger sales. `.review/verify-priority-pdfs.py` passed: repeated titles/date ranges/page footers, correct scope sections, all seven sales IDs, 28 ingredient rows in inventory scopes, 12 baseline disclosures, ₱1,058.40 paid Pending separated from ₱0.00 Completed, and recorded stock (13 buns/patties, 360g onions, 33 cheese slices). Matching Poppler renders and text/check JSON are saved under `.review/frontend/priority-feedback/`. All 22 PDF page layouts were visually reviewed; the final attention screen-only fix does not change PDF construction. Re-export/render if report data/source changes.
- UI visual inspection covered modal headers and actions across all sizes, selection summaries, Audit filters, Inventory controls, all PDF pages, and desktop/tablet/phone Report sections. **Final visual inspection remains incomplete:** the newly fixed ingredient table and stock-attention pagination need fresh captures, and the remaining short-tablet/static/export-scope captures need a final pass. Do not treat the presence of inspection contact sheets as proof every sheet was viewed.
- New read-only QA helpers outside the repository: `.review/verify-priority-pdfs.py` and `.review/priority-contact-sheets.py`. They use the bundled Python runtime (`C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`). Contact sheets are in `.review/frontend/priority-feedback/inspection/`; regenerate only after the current images/renders exist. Old one-time implementation edit helpers must not be rerun.

#### Next resume steps

1. Inspect the saved final source/test changes above. Run `npm run test:e2e --workspace Frontend -- priority-feedback.spec.ts` with port 5180 free. Resolve any actually reached failures in the expanded screen/Print attention paging assertions, then confirm all six priority cases pass. Preserve the test-owned Vite setup and clean teardown.
2. Run the final root `npm run typecheck`, frontend `npm run build --workspace Frontend`, and complete `npm run test:e2e --workspace Frontend` (**114 cases**). Record the actual complete result; interrupted attempts are historical evidence only.
3. Read/run `../.review/priority-review.mjs` from the repository root with port 5181 free. Regenerate final responsive captures through the priority test; inspect fresh ingredient table headers and both attention pages on phones/tablets, modal body/header/action scrolling, selection summaries, aligned filters and all export scopes. Re-render the three fresh PDFs with Poppler, run `../.review/verify-priority-pdfs.py`, and inspect matching pages as needed. QA output is in the **workspace parent `.review/`**, not `repo/.review/`.
4. Update README/current checkpoint/continuation script with exact final results and limitations. Keep in-memory sample restrictions, Owner immediate completion / Staff+Admin Owner-review policy, once-only checkout stock consumption, Admin void attribution and no stock restoration, historical records, Manila dates and role isolation.
5. Stay frontend-only. No backend implementation, provisioning, deployment or commits are authorized by this continuation. Physical devices, actual screen readers, Safari/Firefox, OS print output and exhaustive Figma comparisons remain unverified. Keep all earlier source/licensing archives and uncommitted scaffold files.

### October 4 priority feedback — previous pause checkpoint (historical; superseded above)

**Stop instruction:** The user said, “lets stop for now update the handsoff md script to save the current progress.” Implementation and validation stopped; only this handoff and README were updated afterward. Resume only when requested. No goal/automation was created, no backend work or commit/deployment occurred, and no long-running preview was left running.

#### Saved implementation

- **Confirmed policy:** The user explicitly selected **Complete Owner sales immediately; Staff/Admin await Owner review**. New checkout records payment **Received**, fulfilment **Fulfilled**, and a separate review state. New Staff/Admin sales are Pending / Awaiting Owner review; new Owner sales are Completed / Owner checkout. Historical sales are not relabeled or backfilled.
- **Stock dependency intentionally changed:** New paid/fulfilled checkout for every role consumes its recorded requirements once, even while Pending Owner review. `stockCommitted` is true for these new sales; Reports includes their consumption. Owner confirmation changes only status/review fields and never consumes stock again. Historical uncommitted Pending requirements remain untouched and excluded from consumption. Voids still do not restore stock or refund payments. Existing tests that assumed Staff never consumes stock were updated to the new policy.
- **Daily Sales Review:** Dashboard's Needs your review includes cards grouped by Manila business date, count/amount, outstanding treatment, and a neutral zero state. The modal shows every included order, cashier/role, amount, payment method, and GCash reference. Every receipt must be explicitly verified. Only Owner can confirm; App independently checks role, exact eligible IDs/date, expected totals and discrepancy explanation. The review stores Owner/role/time, included IDs, expected/verified Cash and GCash, counted cash, manual opening/addition/removal/refund adjustments, explanation and outcome. Discrepancies remain recorded; expected sales amounts are unchanged. Audit details/timeline show the review. Admin can still void without Owner approval. This remains in-memory sample behavior, with no durable receipt/cash-movement ledger.
- **Shifts removed from runtime scope:** Dashboard Shift overview removed; identity/POS no longer generate/pass shift IDs. Staff history scopes by recorded cashier ID and the current Manila business date. Staff daily-summary CSS retains the existing layout with a renamed class. Users access descriptions now say daily history; no unrelated Users/POS redesign was done.
- **Inventory:** Primary Products / Ingredients / All inventory controls, labeled Category dropdown, separate Modifier groups management action. Search keeps the selected view/category, explains scope and empty results, and clearing retains choices. Product and stock tables each paginate six top-level records with associated Previous/Next/result counts; batches remain attached to their record. Context/highlight selects the record's page. Saves clear stale search and highlight the saved record. Editor Stock model labels now expose Uses ingredients (recipe) and Stocked/retail item; Recipe has guidance/empty state and Add ingredient. New recipe rows start at zero so the user must supply their quantity; modifiers remain independent.
- **Reports:** New checkout line snapshots retain normalized per-product stock usage and stock kind, including selected modifiers/omissions. Ingredient usage by transaction displays recorded order/date/status, product/category/modifiers, ingredient/SKU, consumed quantity/unit. Older records without line-level usage are disclosed; current recipes are never applied retrospectively. Aggregated usage, current physical/usable stock, reorder/expiry attention and Inventory drill-downs remain separate. Expiring-soon detection now uses actual batch dates within seven days. Ingredient balance visuals show quantities and **Baseline unavailable** instead of fabricated percentages: no verified opening balance/complete stock movements exist. Sales summaries explicitly separate Completed revenue from paid Pending review amounts.
- **Report controls/exports:** Visible Clear filters restores Combined / Aug 15–21, 2026 / All categories and resets pagination; format stays selected. Each long report table and stock/balance list has associated six-record pagination. Tables retain all rows for Print while screen pages hide off-page rows. PDF/CSV document construction uses the entire filtered dataset and includes ingredient links, stock attention and baseline disclosures. Export review shows scope/filters and whole-dataset record counts alongside payments and inventory summaries. The full new CSV/Print acceptance case has not yet completed (see failures below).
- **Audit:** Search/date controls have aligned visible labels; status/payment/request controls align below. Nonzero Void requests has attention styling and an accessible count; zero is neutral. Removed View selected order. Row pointer/Enter/Space toggles single details without forcing focus; checkbox/button handling is separate. One checkbox shows that order; two or more show compact Selection summary with Cash/GCash totals, status mix, eligibility and hidden-page IDs. Select all is explicitly **this page**, selections survive paging, and bulk confirmation still lists every eligible affected order. Six-record pagination and linked-order page lookup are implemented. Review selection/void edge cases again before calling final acceptance complete.
- **Calendar:** Shared DateField uses the existing [Lucide calendar-days SVG](https://lucide.dev/icons/calendar-days), fetched from its official source; ISC source/license notice is saved in `Frontend/public/assets/lucide-calendar-LICENSE.txt`. Trigger naming, keyboard behavior and focus restoration remain. No new production product dataset/photo was added or AI-generated; browser tests create temporary optional-photo examples only.

New source files: `Frontend/src/components/Pagination.tsx`, `ReportTable.tsx`, `DailySalesReview.tsx`. Existing App, Inventory, POS, Dashboard, AlertCenter, SalesHistory, Reports, DateField, SearchField, ModifierFields, demo/inventory/reporting/audit data helpers, Staff styles and shared redesign styles are edited. Preserve exact Frontend capitalization, scoped admin.css/staff.css, existing uncommitted scaffold and `Frontend/design-reference` archive/manifest.

#### Verification actually completed at this pause

- Latest **root typecheck passed** before the 39-case targeted run; both workspaces typechecked, with no backend behavior tests.
- A **frontend production build passed** earlier in this continuation. Subsequent refinements to paging/selection/report labels and snapshots were typechecked, but **the final production build has not been rerun**.
- The first exploratory 108-case run was interrupted while superseded expectations were being adapted. The next **complete 108-case run: 100 passed / 8 failed (4.4 minutes)**. Those failures involved explicit filter scope, new page access, or the updated Void requests accessible name.
- After fixes/adaptations, **39 targeted cases: 37 passed / 2 failed (1.7 minutes), clean runner teardown**. All 34 existing cases in continuation, frontend, Inventory/POS, Staff and variants/bundles passed. Three of the five new priority cases passed: Staff/Admin → Owner review with an explained discrepancy and no duplicate stock use, Audit toggle/summary/cross-page selection, and responsive/calendar controls.
- Two new tests in `Frontend/tests/priority-feedback.spec.ts` are unfinished: (1) **Inventory scope / Hotdog with Rice** times out at `getByLabel('Unit', { exact: true })` while creating an ingredient; inspect its actual accessible name and repair the selector before continuing the recipe flow. (2) **Reports full-page exports / reset / Print** fails because `.balance-track` resolves to 12 elements in a single-element `not.toHaveAttribute` assertion. Use an appropriately scoped/all-elements assertion, then continue to the CSV/Print steps. **Do not claim recipe creation or full new CSV/Print acceptance has been verified.** Existing older export/configuration cases did pass in the targeted run.
- The suite now contains **113 tests** (108 retained/adapted + 5 priority tests). **No complete final 113-case run has occurred.** `tests/setup-server.ts` remains unchanged and owns port 5180 with in-process teardown.
- The passed responsive priority test saved **20 page captures** (Dashboard, Inventory, Audit Trail, Reports at 1440×900, 820×1180, 390×844, 320×568, 820×400) in `.review/frontend/priority-feedback/`. Its checks found no page overflow or measured workspace controls below 44px/12px, and calendar keyboard/focus checks passed. **These captures have not yet been visually inspected.** No physical-device, actual screen-reader or Safari/Firefox verification was performed.
- `.review/priority-review.mjs` is written but **has not been run**. It owns temporary port 5181, generates Daily Sales Review/selection/export captures and three current-day PDF scopes, and closes its browser/server in finally. **No new matching PDF renders or visual review have been completed for the final source.** Older PDF captures are historical and may no longer match PDFs overwritten by existing tests.

#### Next resume steps (highest priority)

1. Read this checkpoint and priority requirements below. Inspect saved source/test state first; do not rerun the implementation helper scripts blindly (`resume-priority.py`, `resume-audit.py`, `resume-review.py`, `resume-reports.py` are one-time local edit aids). The docs save helper is also not intended as a repeatable migration.
2. Fix the two new test selectors/assertions, then run the five priority tests and resolve any newly reached actual failures. Complete recipe, full-dataset CSV/Print, empty/one/multiple-page boundaries/reset/clamping, attention links and Admin void regression checks. Add coverage only for meaningful remaining gaps.
3. Run `.review/priority-review.mjs` after reading it and checking port 5181 is free. Inspect the saved UI captures, especially populated review modal on short/mobile screens, bulk summary, aligned Audit filters and export review. Render the matching fresh PDFs with Poppler, check text/data/headers/footers and visually inspect every relevant page; do not compare historical renders with overwritten PDFs.
4. Run final root typecheck, frontend production build, and the complete 113-case browser suite with port 5180 free. Record exact results, any failures and limitations; update README and this checkpoint. Do not claim all priority acceptance is complete until these checks finish.
5. Continue frontend-only. No provisioning, backend implementation, deployment or commits are authorized by this handoff. Preserve the source/licensing archive and sample-data limitations.

### Highest priority — new UI feedback recorded October 4, 2026

**Status: implementation resumed and is paused pending final acceptance; see the latest checkpoint above.** Address this entire priority list before the older remaining backlog. The user requested additions, removals, and modifications to Dashboard, Inventory, Reports, and Audit Trail. POS and Users have no requested visual changes. These requirements supersede conflicting earlier recommendations, including shift features and Inventory search automatically widening its filters. Preserve historical checkpoints as evidence of previous behavior, not as instructions to restore it. Backend work remains a separately authorized phase.

#### Dashboard — remove shifts and introduce Daily Sales Review

- **Remove Shift Overview and staff-shift functionality from system scope.** Staff schedules, attendance, shift management, and shift-based reconciliation are not part of Vertwell. Use Manila business dates and recorded cashier identities for the remaining sales review/history requirements; preserve role isolation when replacing current shift-dependent labels/filtering. Older future-work entries requesting live shifts are superseded.
- Keep the money-checking workflow, using **Daily Sales Review** as the proposed professional UI label instead of "Sales Reconciliation". Suggested action wording: **Review daily sales**, **Awaiting Owner review**, and **Confirm reviewed sales**. The accounting concept remains reconciliation; the latest checkpoint documents the implemented preview label/workflow.
- Add a **Daily Sales Review** entry/card under **Needs your review**, with pending-review count/amount and business date. It must open the corresponding review context, not just an unrelated destination. Visually distinguish outstanding work from a zero-count state.
- The requested workflow is: **Staff and Admin sales await Owner review; the Owner counts/verifies the receipts and can then mark the reviewed transactions Completed.** Record the Owner name, role, Manila review timestamp, explicitly included order IDs, expected amounts, actual verified amounts, discrepancies, and review outcome. A discrepancy must remain visible and require an explained decision rather than silently making the totals match. Confirmed during implementation: Owner checkout completes immediately; Staff/Admin await Owner review.
- **Pre-implementation correction (historical):** Staff checkout was Pending while Admin/Owner completed immediately, without money-counting review. The latest checkpoint supersedes this: new Admin sales await review and Owner confirmation is implemented in memory.
- **Reconciliation clarification:** compare expected Cash receipts with counted cash, accounting separately for opening change/cash additions/removals/refunds where relevant, and compare recorded GCash amounts/references with verified digital receipts. GCash is not physical cash to count. Reconciliation does not inherently require a paid sale to stay Pending; that is the user's requested approval policy. Make payment/fulfilment status and Owner review status explicit so a received payment is not presented as unpaid merely because it awaits review.
- Before changing checkout status handling, resolve the stock-commit point across Pending/Completed and the meaning of report totals. Paid/fulfilled orders must not disappear from ingredient-use reports merely because Owner review is pending, and Owner confirmation must never deduct already-consumed stock twice. Preserve the current stock behavior until this dependency is intentionally implemented; do not silently relabel existing Completed sales or rewrite historical records.

Reference for the reconciliation distinction: [Square cash reporting](https://developer.squareup.com/docs/cashdrawershift-api/reporting) exposes expected cash, closing cash, payments, refunds, and cash additions/removals separately. This supports the comparison concept; it does not impose Square's shift model or its status policy on Vertwell.

#### Inventory — clearer controls, scoped search, compact tables, discoverable recipes

- Replace the crowded two rows of equal-weight buttons with a clear hierarchy. Proposed design: primary **Products / Ingredients / All inventory** views, a compact labeled **Category** dropdown (All categories, Food, Beverage, Hobby), and search aligned within the toolbar. Keep modifier management available as a distinct **Modifier groups** management destination/action rather than presenting it as an equivalent ingredient/product category filter. Final responsive styling should follow the current design system and remain accessible.
- Search must **keep the selected view and category** and filter within their intersection. Example: Products + Food + "burger" keeps Products/Food selected and shows matching burgers. Do not automatically activate All or bypass the category when typing. Clearing search retains those choices. Display the current search/filter scope and explain empty results; an explicit Search all inventory action may be offered, but never widen silently.
- Add pagination with **6 top-level records per page** (within the requested 4–6 range), Previous/Next, page/result counts, and clear disabled states. Filter before pagination; reset to the first page when search/filter criteria change and clamp the page after edits/removal. Preserve single-batch details and multi-batch access. A dashboard record/batch drill-down must open the page containing the highlighted record. All-results tables need clearly associated pagination.
- Make adding a product's base ingredients/recipe easy to discover. The user could add modifiers but could not reproduce the sample Burger's Recipe section. Existing code supports recipes only for **Stock model = Made to order**; treat this as a discoverability/workflow issue and reproduce it in the UI before claiming the recipe feature is missing.
- Proposed setup language: **Uses ingredients (recipe)** versus **Stocked/retail item**, with existing Variants/Bundle choices retained. Expose the Recipe section clearly for recipe-based Food/Beverage creation and editing, with **Add ingredient**, existing Ingredient choices, quantity/unit per serving, guidance for creating a missing ingredient, and a usable empty state. Example: Hotdog with Rice uses recorded hotdog and rice quantities from their separate Ingredient stock records. Base recipe inputs must not require configuring a modifier group. Do not invent quantities for the user or recipes for the original unlinked fixtures.

#### Reports — transaction-linked ingredients and useful export review

- Add a separate **Ingredient usage by transaction** table linking Order/Transaction ID, product sold, product category/type, ingredient name/SKU, quantity, unit, and recorded consumption date/status. Show modifier-related ingredient usage from the purchased configuration too. Use recorded snapshots/consumption, not today's recipe multiplied by old sales. Missing usage must be disclosed.
- Provide a selected-day/period ingredient-usage summary and **Needs attention** stock information for low stock and expiring-soon batches, with dates/thresholds and actionable record links. Label current stock versus selected-period consumption clearly; historical closing stock is still unavailable without durable movement records.
- Redesign the **Export Report** summary modal as a useful review of the exact filtered report. Keep Cash/GCash summaries where the report scope contains sales, and give ingredient usage/remaining stock/attention comparable prominence. Include scope, date/category filters, record totals, and missing-data notices rather than making the modal a payment-only summary. Inventory-only scope should emphasize inventory information.
- Add per-ingredient **usage and remaining-stock percentages with an HP-bar-like visual**, backed by quantities, units, and a named/date-specific baseline. Example: a verified 100-unit baseline and 20 units consumed gives 20% used / 80% remaining only when other movements do not change that balance. Do not treat reorder threshold, current on-hand stock, or a mixture of units as a universal 100% baseline. Account for restocks/wastage/returns explicitly when available; show "Baseline unavailable" rather than fabricated percentages when the preview cannot establish one. Expiry/usable stock and reorder attention remain separate from usage percentage. Include text values so meaning does not depend on color.
- Add a visible **Clear filters** action. Disclose the default date range/scope/category restored and reset pagination; keep the resulting filter summary visible.
- Paginate long Reports tables at **6 records per page**, with consistent Previous/Next and page/result counts. Each table's controls must clearly belong to that table. Summaries and PDF/CSV/Print exports use the **entire filtered dataset**, not just the visible page.

#### Audit Trail — aligned controls, conditional attention, selection summaries

- Align Search and date-picker fields using consistent labels, heights, spacing, and responsive wrapping. Align the second-row status/payment dropdowns and Void requests control with clear visual hierarchy.
- Give **Void requests** a visible attention treatment when its count is greater than zero, including a readable count/accessibility label. With zero requests, retain a neutral style so it does not falsely signal work. Do not rely on color alone.
- Remove the redundant **View selected order** button. Clicking or using Enter/Space on a row selects its details immediately; activating that selected row again clears the single-order selection and restores the empty state. Checkbox/action clicks must remain separate. Preserve accessible selection state and focus without forcing focus away from the row on every click.
- When **two or more checkboxes are selected**, replace the full single-order details with a compact **Selection summary**: selected count, amount and Cash/GCash breakdown where relevant, status mix, void eligibility, hidden-page selections, and available bulk actions. Do not stack full receipts for every selected order. With one checkbox selection, show that order's detail context; after clearing all bulk selections, return to an explicit single-row/empty state. Keep the subsequent Bulk Void review/confirmation showing every affected eligible order before a destructive action.
- Proposed list pattern: row activation opens a single record; checkboxes select records for a contextual bulk toolbar/summary. This is consistent with [Shopify's resource-list guidance](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/resource-list), not a claim of one mandatory industry-wide layout. Make row versus checkbox state unambiguous.
- Paginate the transaction table at **6 records per page**, using the shared compact table design and Previous/Next/page/result counts. Define Select all as **this page** and disclose selected IDs on other pages; preserve explicit selections during paging, provide clear selection/reset actions, and never silently void all filtered orders. Linked alerts must open the page containing the relevant order and retain investigation context.
- Preserve the confirmed permission rule: Admins can void without an Owner password/approval, each void displays the actual Admin/Owner name and role, and Staff submit requests. Owner-only daily-sales completion is a separate review permission and does not revoke Admin void access.

#### Shared calendar icon and product-image sourcing

- **Calendar icon — priority UI fix:** replace the current date/date-time picker icon because the user finds it does not resemble a calendar. Find and use a recognizable calendar SVG/icon from the existing assets or a suitable icon library, with clear calendar-page/binding/date-grid features. Apply it consistently to the shared date picker and all pages using it, matching the site's size, stroke/weight, colors, alignment, and visible focus treatment. Preserve the accessible calendar-button name and keyboard behavior. The latest checkpoint implements this shared icon; sampled visual review remains unfinished.
- **New product datasets — sourcing rule:** when adding new product records/sample datasets, search for an appropriate existing image on the internet rather than generating one. **Do not use AI image generation for these product images.** If a suitable photo is unavailable, use an appropriate existing SVG/icon. Use assets suitable for reuse, retain their source/license/attribution as applicable, and keep the product imagery consistent with the existing catalogue. Optional-photo creation and default placeholders remain supported; do not replace existing product photos merely to apply this rule.

#### POS and Users

- **No requested visual changes.** Preserve their finished layouts and behavior except for necessary cross-page dependencies of Owner sales review, stock/usage status consistency, and removal of shift functionality. Record and verify those dependencies explicitly rather than treating "no issues" as authorization for unrelated redesigns.

#### Priority acceptance review

- Verify no shift-management UI or shift requirement is introduced; Staff sales remain scoped to their permitted actor/business dates. Verify Daily Sales Review drill-downs and the proposed Staff/Admin Pending → Owner-reviewed Completed path, attribution, discrepancies, and no duplicate stock deduction when that workflow is implemented.
- Verify Products + Food + burger search retains both filters; clearing retains them; recipe-based Hotdog with Rice can be created with base ingredients; modifier management is visually distinct.
- Verify empty/one-page/multiple-page tables, Previous/Next boundaries, filter reset/clamping, dashboard/alert record drill-downs, and exports containing every filtered record beyond the visible page.
- Verify transaction/product-linked ingredient usage, stock warnings, trustworthy percentage baselines, missing-baseline states, Reports Clear filters, and meaningful export summaries.
- Verify the date-picker icon is recognizably a calendar across pages and screen sizes, with accessible keyboard behavior preserved. Check that images for new product datasets are sourced existing photos or SVGs, not AI-generated images.
- Verify Audit filter alignment, zero/nonzero Void requests attention, row toggle/keyboard/checkbox isolation, single versus bulk summaries, cross-page selection disclosure, and retained named Admin voids. Review desktop/tablet/mobile/short screens and update meaningful tests when implementation begins. Existing 108 passing tests predate these new requirements.

### October 4 Preserved design-reference cleanup — latest saved checkpoint

- **Reference audit:** Checked filenames against frontend source, tests, configuration, and all existing local review scripts before relocating files. No current source/test references remain to the archived files. SVG dependency inspection found only internal fragment URL references. Runtime filename choices come from the existing literal artwork maps and product fixtures; user-uploaded photos remain data URLs.
- **Recoverable archive:** Moved 41 unreferenced original SVG/PNG files from `Frontend/public/assets/` to `Frontend/design-reference/assets/` and the unimported scaffold `Frontend/src/styles.css` to `Frontend/design-reference/styles.css`. No original file was deleted. Current style imports, scoped Admin/Staff styles, artwork, fonts, licenses/notices, sample data and workflows are unchanged.
- **Preservation and build:** `Frontend/design-reference/manifest.json` records original/current paths, byte counts, SHA-256 hashes, and found references for all 104 original public files plus the old stylesheet. All **105 hashes match** after relocation. All **63 remaining public files match their production copies**, and none of the 41 archived artwork files ship in the fresh build. This removes **47,646 bytes** of unused public artwork; the old stylesheet was already unimported. Archive README explains recovery/reuse. Root README now documents the archive.

Verification: root typecheck, frontend production build, and the full frontend browser suite **108 passed (2.8 minutes), clean exit**. No new application behavior or tests were added. No dangling archived-file references remain in source/tests. Preserve `tests/setup-server.ts` and its owned port 5180; its test-owned server closed at teardown. Backend behavior tests were not run. Audit/helper/check artifacts are `.review/asset-reference-audit.json`, `.review/cleanup-frontend.ps1`, and `.review/asset-cleanup-checks.json`. The relocation helper refuses an existing archive; inspect saved state before retrying it. No new visual-fidelity claim is made for this filesystem-only cleanup.

No backend implementation, provisioning, deployment, commit, or long-running preview server was started. Physical-device, actual screen-reader, Safari/Firefox and full-Figma verification remain open. Durable data/stock/event ledgers, payments, accounts/authorization, shifts/reconciliation, business-policy decisions and original unlinked catalogue fixtures remain separate scopes.

### October 4 Shared-search Clear focus — previous saved checkpoint

- **Clear activation:** The shared search control now returns focus to its input after React applies the cleared query and restores results. Enter, Space, and pointer activation support immediate continued typing. Only the Clear action requests focus; normal searches and navigation retain their existing behavior.
- **Visible focus:** Explicit nearest scrolling after restoration, with search-container scroll margins, keeps the focused field visible on short screens and below mobile navigation. The first review found that focusing before results restored could leave POS/Audit search offscreen; this is corrected in the final implementation. Existing focus-within styling and 44px Clear controls remain.
- **Coverage:** The same control serves POS, Inventory, Audit Trail/Staff history, Users, and the modifier library. Clearing retains POS category, Inventory view, Users role filter, and existing role access. No catalogue fixtures, recipes, stock, checkout, accounts, or backend behavior changed.

Verification: the initial Owner desktop regression failed on input focus as expected. Nine new cases in `Frontend/tests/search-focus.spec.ts` passed across Owner/Admin/Staff at 1440×900, 820×400, and 320×568; they exercise keyboard/pointer activation, result restoration, repeated clearing, immediate typing, retained filters and Staff role restrictions. The full frontend suite **108 passed (2.9 minutes), clean exit**. After final visibility refinements and strengthened full-viewport/mobile-header assertions, all **36 affected search/redesign/modifier/Users cases passed again (1.0 minute)**, with fresh passing root typecheck and frontend production build. Preserve `tests/setup-server.ts` and its owned port 5180. Backend behavior tests were not run.

Responsive review: **36 final captures** in `.review/frontend/search-focus/`, generated by `.review/search-focus-review.mjs`, cover every permitted role/page search at those three sizes. Final checks report no lost/out-of-viewport focus, missing container outline, page horizontal overflow, broken images, browser errors, or HTTP errors. Earlier captures were overwritten after the scroll correction. Sampled inspection includes small-phone Owner POS, short-screen Staff POS, and small-phone Admin Audit Trail. Review-owned servers closed at teardown. Physical-device, actual screen-reader, Safari/Firefox and full-Figma verification remain open.

The previous preview at http://127.0.0.1:5175/ was unavailable at the final check; no long-running server was started. No backend implementation, provisioning, deployment, or commit occurred. Original unlinked fixtures and durable data/ledger/payment/authorization work remain separate scopes.

### October 4 Product variants and bundles — previous saved checkpoint

The user explicitly selected **Product variants and bundles** for this continuation. All work remains frontend-only.

- **Inventory configuration:** Owner/Admin product editors now offer Variants and Bundle stock models. Variants have names, prices, availability, and distinct links to existing finished-stock SKUs in pieces. The editor displays a derived starting price; POS applies the product discount to the selected variant. Bundles have their own selling price and fixed whole-number piece quantities of existing finished SKUs. Selected stock names/SKUs remain readable below native selects. Create a Stocked product to add a new finished SKU, then receive against its stock row. Configuration changes use the existing discard/refresh guard and record the current actor and Manila edit time.
- **Validation:** Reject empty configurations, duplicate case-insensitive variant names, duplicate variant stock links, duplicate bundle components, missing/non-finished/non-piece stock, invalid prices and nonpositive/fractional component quantities. Add-ons may add stock; negative inputs that remove fixed variant/bundle stock are rejected. No variant or bundle fixture was silently added to the original catalogue. Bundles are explicit finished SKUs, with no nested product/recipe expansion or extra parent-stock deduction.
- **POS and stock:** Variants require an explicit radio choice; the price and whole-cart stock preview reflect that choice and quantity. Unavailable variants remain reviewable but cannot be saved. Bundles open a contents/quantity review and consume component pieces multiplied by bundle quantity. Standalone items, variants, bundles and additive modifiers share the same cart-wide stock totals. Completed Owner/Admin checkout deducts once using the existing expiry-aware consumption; Staff Pending records requirements without deduction. Cart editing/cancellation, checkout focus and visible customization/payment headers are retained.
- **Snapshots and reporting:** Cart identities include selected variant and bundle configuration snapshots. Matching variants/configurations merge using the selected variant price; a changed catalogue starting price does not split an otherwise matching line. Changed selected prices, SKUs or component quantities stay separate. Editing a saved cart line uses its recorded product/configuration instead of today's catalogue. Receipts and history show variant names/SKUs or included bundle pieces. Sales searches match recorded variant and component SKUs. Reports show a keyboard-scrollable Purchased variants and bundles table and include the same filtered snapshots/status/quantity/unit-price data in PDF/CSV. Stock usage is still recorded per SKU; bundle revenue belongs to its parent selling category, without component-level category revenue splitting. Duplicate-activity evidence distinguishes recorded variant/bundle configurations.

Verification: the full frontend suite **99 passed (2.5 minutes), clean exit**. Eight cases in `Frontend/tests/variants-bundles.spec.ts` cover stock aggregation, expiry/configuration validation, discount/cart identities, explicit choice and matching-SKU merging, SKU search/CSV export, component deductions and historical snapshots after edits, mobile duplicate/draft handling, changed variant stock/price snapshots, and Staff Pending/role isolation. After the final derived-price/readable-stock-label polish, all **28 affected variant/bundle/Inventory-POS/redesign cases passed again (50.1 seconds)**, with fresh root typecheck and frontend production build passing. Initial new-test timeouts came from exact implicit-label selects and using the Admin Audit Trail label for Staff's Today’s Sales History; selectors now use named comboboxes and the actual Staff navigation label. No application workaround was added for those test assumptions. Preserve `tests/setup-server.ts` and its owned port 5180. Backend behavior tests were not run.

Responsive review: **180 final captures** in `.review/frontend/variants-bundles/`, from `.review/variants-review.mjs`, cover Owner/Admin editors, catalogue, unselected/selected/shortage variant dialogs, bundle contents/shortages, full carts, editing, receipt, history and reports at 1440×900, 820×1180, 390×844, 320×568 and 820×400. Staff configurations are created through the Owner preview before role switching; Staff has no Inventory access. Final checks report no page/dialog horizontal overflow, clipped dialog headers, focus outside open dialogs, configuration fields/buttons/radio labels below 44px, broken images, browser errors or HTTP errors. The first 180 captures were overwritten by matching final captures after polish. Sampled visual inspection includes desktop variant price/editor, tablet bundle editor, small-phone variant stock error and Staff cart, and short-screen bundle contents. Capture helpers dismiss background toasts only when no modal is open and use full-page cart captures.

The final exported `variants-bundles-report.pdf` and matching `report-page-1.png` through `report-page-4.png` are in that same review directory. All four Poppler-rendered pages were inspected, including long variant names, fixed component SKU details, selected stock consumption, current stock, repeated headings and page numbers. The PDF exporter itself is unchanged. These are local QA artifacts, not production records. Physical-device, actual screen-reader, Safari/Firefox and full-Figma verification remain open.

The existing http://127.0.0.1:5175/ preview returned HTTP 200 and was reused; opening it in Codex was requested and queued. Test/review-owned servers closed at teardown; no backend implementation, provisioning, deployment or commit occurred. Durable variant/bundle records, nested/recipe-based bundles, component-level mixed-category revenue allocation, production batches, durable stock/event ledgers, live shifts/reconciliation, server roles and live library synchronization remain separate work.

An initial accessibility probe, before the user selected variant/bundle work, reproduced the existing shared-search Clear-button focus loss at desktop Owner POS: clearing removes the focused button without returning focus to the search input. No shared-search code was changed, and the temporary failing probe test was removed before continuing the selected scope. This is a concrete future frontend fix, separate from the passing current suite.

### October 4 Checkout keyboard focus and visible headers — previous saved checkpoint

- **Checkout stages:** Owner/Admin payment dialogs now opt into focus updates when their title/stage changes. Order confirmation focuses CASH PAYMENT; Cash focuses Amount Given; QR focuses GCash reference number. Returning from either payment form focuses CASH PAYMENT. This addresses the previously recorded BODY-focus gap and makes keyboard-only stage selection work for all three roles. The shared Modal retains existing behavior for other administrative dialogs and honors explicit initial-focus targets.
- **Small/short screens:** Payment dialogs keep their title and Close dialog visible while their bodies scroll, using the established customization/Users layout pattern. Focused fields and subsequent keyboard actions scroll inside the body. Escape closes checkout, restores Pay focus, and preserves the cart; returning from QR clears its unsubmitted reference as before. Payment calculations, recording, stock handling, and Staff Pending rules are unchanged.

Verification: The regression first reproduced missing Owner initial payment-choice focus. Nine new cases in `Frontend/tests/payment-focus.spec.ts` exercise Owner/Admin/Staff at 1440×900, 820×400, and 320×568 with keyboard Cash/QR entry, cancellation/return, empty QR re-entry, visible focused fields and headers, Escape restoration, and retained cart. The full frontend suite **91 passed (2.2 minutes), clean exit**. After the final header adjustment and stronger header assertions, all **22 affected checkout/frontend/Staff cases passed again**. Final root typecheck and frontend production build passed. An initial new-test assertion incorrectly expected no status roles, overlooking the cart quantity output's implicit status role; it now checks for no checkout notification directly. No application workaround was added. `tests/setup-server.ts` remains unchanged and owns port 5180. Backend behavior tests were not run.

Responsive review: **54 final captures** in `.review/frontend/payment-focus/`, generated by `.review/payment-focus-review.mjs`, cover confirmation, Cash, Cash return, QR, QR return, and closed checkout for all three roles at the three tested sizes. Automated checks reported no page/dialog horizontal overflow, clipped dialog headers, invisible/outside-dialog focus, broken images, browser errors, or HTTP errors. Sampled visual inspection covered desktop Admin confirmation, short-screen Owner QR, and small-phone Staff QR. The first review exposed the header clipping and was refreshed after correction; its screenshots were overwritten by matching final captures. This is sampled Edge review; physical-device, screen-reader, Safari/Firefox, and full-Figma verification remain open.

Review/test-owned temporary servers closed at teardown. The existing preview on http://127.0.0.1:5175/ was reused and requested in Codex. No backend implementation, provisioning, deployment, commit, or new long-running preview server occurred. Variants/bundles, durable data/ledgers, real account authorization, live shifts/reconciliation, live library synchronization, and unlinked original catalogue fixtures remain separate work.

### October 4 Reusable modifier groups and defaults — previous saved checkpoint

- **Library:** Inventory now has a Modifier groups view with remembered group/option-name search, counts, empty states, and Owner/Admin create/edit/remove controls. It starts empty, so no extra sample choices/defaults are silently assigned. Product editors can explicitly save a valid group copy to the library, then add independent library copies to products. Library saves show actor and Manila timestamp; group names reject case-insensitive duplicates. Removal has a Keep group-focused review, Escape cancellation, and focus restoration after confirmed removal.
- **Copy semantics:** Every imported/saved copy receives its own group/option IDs and cloned ingredient inputs. Library edits/removal never propagate to existing products, cart lines, or sale snapshots. Adding a group twice creates independent selections. Saving a copy to the library is an explicit separate save; cancelling the product editor still discards its unsaved product changes. Negative inputs retain existing per-product omission behavior; explanatory text asks the editor to check each product's recipe.
- **Defaults:** Product and library options have labeled default checkboxes. Nonempty default sets must meet the group's min/max limits; required groups may have no defaults for an explicit POS choice. Existing name/price/stock-unit/choice validation is shared by product and library editors. New POS customizations start with defaults selected and label them as changeable. Price and cart-wide stock previews include them; unavailable defaults stay visible and block saving until changed. Cart editing initializes the saved selections, including an explicitly empty selection, without reapplying defaults.
- **Drafts and dialogs:** Library drafts use the existing inventory Cancel/Back/sidebar/logout discard guard and refresh warning. Library editors focus Group name on entry and Add library group after save/cancel. Default checkbox labels have at least 44px hit areas. Customization dialogs now keep their title and close button visible while the body scrolls; outer overflow clipping prevents native focus scrolling from moving the header. Other dialogs retain their existing styles.

Verification: baseline **75 passed** before changes; the expanded full suite **82 passed (2.3 minutes), clean exit**. Seven cases in Frontend/tests/modifiers.spec.ts cover copy identity/input isolation, limit/unit/default validation, Admin library creation/search and Hobby-product reuse, edit/removal isolation and historical consumption, repeated imports, explicit library vs product saves, saved cart choices/unavailable defaults, and mobile dirty-state/Staff behavior. After the final checkbox/copy-label refinements, all seven cases passed again (18.1 seconds). After the final customization header correction, all **27 affected Modifier/Inventory-POS/redesign cases passed (54.4 seconds)**, with fresh root typecheck and frontend production build passing. The strengthened stock-shortage case asserts that the header and Close dialog remain in view. tests/setup-server.ts remains unchanged and owns port 5180. Backend behavior tests were not run.

Responsive review: **130 captures** in .review/frontend/modifiers-final/ at 1440×900, 820×1180, 390×844, 320×568, and 820×400, with Owner/Admin library/product views and Staff customization. Includes library empty/search/list/editor, long names and invalid defaults, discard/removal review, copied groups, default price/stock, retained empty cart choices, and expired-stock shortages. The initial run stopped after 38 captures because the helper looked for tablet logout outside its drawer; the helper now opens navigation below 1200px. That incomplete run remains in .review/frontend/modifiers/. Visual review corrected checkbox spacing, the group-search placeholder, and short-screen customization header scrolling. **40 final affected customization captures** in .review/frontend/modifiers-modal-final/ verify the final header behavior for both administrative roles and Staff at all five sizes. Both completed runs reported no browser/HTTP errors, page/dialog horizontal overflow, broken images, measured ordinary controls below 44px, heading text below 12px, or checkbox labels below 44px; the final 40 also assert no clipped customization header. Sampled inspection covered desktop library, tablet editor, mobile library, small-phone defaults, and final short-screen stock errors. Script: .review/modifiers-review.mjs (--customizations for the final 40). Earlier captures are retained; final customization captures supersede their earlier counterparts.

The existing http://127.0.0.1:5175/ preview returned HTTP 200 and was reused; opening it in Codex was requested and queued. No new long-running server was created. Test/review-owned temporary servers closed cleanly. README now documents the library/default rules and 82-case suite. No backend implementation, provisioning, deployment, or commit occurred. Preview state resets on refresh; live library synchronization, durable records, variants/bundles, physical-device/screen-reader/Safari/Firefox/full-Figma validation remain separate work.

An initial read-only payment-focus probe confirmed an unrelated existing gap: Owner/Admin focus falls to BODY when moving from order confirmation to QR payment and back; Staff focuses the payment choice/reference field correctly. No payment focus code was changed because the user selected modifier work. .review/payment-focus-probe.mjs reproduces it for a later frontend continuation.

### October 4 Users and account dialogs continuation — previous saved checkpoint

- **Team list:** Users has immediate case-insensitive name/username/email search, a role filter, visible matching counts/filter summary, clear empty results, and reset actions. Filters persist during navigation within the current preview login. Rows show usernames, the signed-in account marker, and an explanation when Owner must manage a protected account. Creating an account clears the list filters so the new record is visible.
- **Manage account:** Read-only username/email details and the selected role's workspace access accompany editable name/role. Current-account role changes disclose that saving changes current preview access. The existing policy remains: Owner assigns all roles, Admin manages Staff, last Owner cannot be deleted/demoted, and the signed-in account cannot be deleted. Disabled deletion explains the restriction. These remain client-side preview rules, not server authorization.
- **Deletion review:** A separate review shows the original account identity and role, explains sample-only removal and retained recorded actor names, and initially focuses Keep account. Keep account, Escape, close, and backdrop return to editing without losing name/role drafts; focus returns to Delete Account. Confirmed removal focuses Add User because the removed row no longer exists. Save/add/delete submissions have a synchronous repeated-submission guard.
- **Wizard:** Visible field labels, username/password guidance, step descriptions, selected-role access, final account summary, and a Show/Hide passwords toggle. Whitespace-only names and case-insensitive duplicate usernames/emails are rejected. Back clears stale errors and re-verification code/password fields; cancellation clears the draft and secrets. Passwords are never saved and no real email/account operation occurs. Existing code and password matching validation remain.
- **Dialog behavior:** Users dialogs retain a visible header/close button while their contents scroll at small/short sizes. The outer dialog uses overflow clipping to prevent browser focus scrolling from moving the header; its body owns vertical scrolling. Shared Modal prevents the native cancel default and lets its supplied close handler control state, allowing Escape to return from deletion review without silently closing the native dialog. Other dialogs retain their close behavior.

Verification: Full frontend suite **75 passed (1.8 minutes), clean exit**, retaining the prior 69 plus six meaningful cases in `Frontend/tests/users.spec.ts`. After the final Users header/focus refinements, all **nine affected Users/Admin cases passed again (18.8 seconds)**, and root `npm run typecheck` plus the frontend production build passed. Initial new-test lookup failures came from exact implicit-label text selection on the mapped role options; selectors now use the combobox's accessible name. No application workaround was added for those test assumptions. `tests/setup-server.ts` remains unchanged; port 5180 belongs to the runner. Backend behavior tests were not run.

Final responsive review: **125 fresh captures** in `.review/frontend/users/`, with `.review/users-review.mjs` and `checks.json`. Owner/Admin states cover 1440×900, 820×1180, 390×844, 320×568, and 820×400: list/filter/empty states, restrictions, manage/long names, deletion review, all wizard stages, and code/password validation. No browser/HTTP errors, page or dialog horizontal overflow, broken images, measured controls below 44px, heading/summary text below 12px, or clipped dialog headers. Sampled visual inspection included desktop list/password review, tablet Manage, mobile long names, small-phone restriction/name/deletion dialogs, and short-screen password validation; the final small-phone deletion and short-screen validation were inspected again after header clipping was fixed. Capture helpers scroll the page to the top before full-page list captures so sticky mobile navigation is pictured correctly.

The existing `http://127.0.0.1:5175/` preview returned HTTP 200 and was reused; opening it in Codex was requested and queued by the app. Review-owned temporary server 5181 and test-owned 5180 closed at teardown; no shared server was stopped or new long-running server created. Original captures for the earlier redesign phases are preserved. Reports/PDF behavior is unchanged. No backend implementation, provisioning, deployment, or commit occurred. Broader physical-device/screen-reader/Safari/Firefox/full-Figma checks remain unverified.

### October 4 Inventory and POS customization continuation — previous saved checkpoint

- **Customization with cart context:** `CustomizeProduct.tsx` now includes a whole-number quantity editor, selected-choice counts, final discounted unit price, line subtotal, and stock requirements by ingredient/SKU/unit. Remaining usable stock includes all other cart lines. Editing removes the original line from the calculation, initializes its existing quantity/options, and replaces it only after a valid save. Cancel/Escape preserves the cart and restores opener focus. Invalid/fractional/nonpositive quantities and insufficient stock prevent saving; modifier availability uses the full candidate quantity and other cart items. Stock shortages are shown once after confirmation rather than repeated as both a preview warning and an error.
- **Cart snapshots:** `cartKey` includes selected modifier prices and ingredient inputs plus stock model/linkage. New configurations after Inventory edits no longer merge into an older cart line with a different recorded price or consumption requirement. Matching configurations still merge; existing sale snapshots remain intact. Existing cart lines continue to carry the product/recipe/price snapshot they were added with; the preview does not automatically reprice drafts from today's catalogue.
- **Inventory clarity:** Main stock rows show physical quantity, usable quantity, reorder level, and the same derived stock condition as Dashboard/Reports. Overview counts use usable shortages; expired and empty receipt batches are labeled from actual dates/quantities. Product rows disclose unlinked sample stock, recipe/finished-stock usage, or a base stock problem requiring review of options. Availability is a one-portion base check, not an exhaustive search across every possible modifier combination; POS validates the chosen order.
- **Editors and keyboard access:** Made-to-order editing explains ingredient usage, disables unrelated finished-unit/quantity/threshold controls, and hides finished-stock receipt dates. Modifier groups show option counts and required/min/max guidance, with whole-number limit fields. Both Inventory tables have named, keyboard-focusable scrolling regions. Expired/unusable statuses use danger styling. All changes use the existing scoped workspaces and shared charcoal/cream/gold styling.

Latest verification:

- Full frontend suite: **69 passed (1.8 minutes), clean exit**. All prior 63 remain plus six cases in `Frontend/tests/inventory-pos.spec.ts` covering cart-wide stock checks, quantity validation/cancellation, modifier stock limits, changed modifier cart snapshots through checkout, expired-stock/replenishment consistency, and small-screen Staff keyboard/Pending behavior. Initial new-test failures were corrected fixture assumptions (Cheese Slices has 40 pcs) and a scoped disabled-field lookup; no application workaround was added for those test assumptions.
- Visual inspection subsequently removed a repeated stock-error message. After that final presentation change, all six Inventory/POS cases passed again (12.1 seconds), and root `npm run typecheck` plus frontend production build passed. Backend behavior tests were not run. `tests/setup-server.ts` remains unchanged and owns port 5180.
- Full responsive review: **195 captures**, Owner/Admin/Staff at 1440×900, 820×1180, 390×844, 320×568, and 820×400. Includes Inventory views, expiry/recipe availability, recipe/modifier editors, long names, quantity/options/stock preview, invalid quantities/shortages, cart/checkout, and recorded orders. No browser/HTTP errors, page overflow, broken images, measured visible ordinary controls below 44px, heading/table text below 12px, or horizontal dialog overflow. Checkbox hit areas and file-upload controls were not part of that ordinary-control geometry assertion. Sampled manual inspection included desktop customization/modifier editing, tablet product tables, small-phone Admin/Staff stock previews, and short-screen shortage presentation.
- Final affected-state review: **45 fresh captures** after the duplicate-warning refinement, covering options/shortage/invalid-quantity states for all three roles at all five sizes, with no automatic failures or browser/HTTP errors. Final short-screen shortage and small-phone Staff invalid-quantity captures were visually inspected. The earlier 195 captures are retained in `.review/frontend/inventory-pos/`; the final 45 and their `checks.json` are in `.review/frontend/inventory-pos-final/`. The script is `.review/inventory-pos-review.mjs` (`--confirmations` for the final affected states). A capture-helper attempt to dismiss a background toast through an open modal was corrected to skip that background action; the app's native modality was working as intended.
- Existing preview **http://127.0.0.1:5175/** returned HTTP 200 and served the current customization source. A duplicate start failed because the port was occupied; the existing preview was reused and opened in Codex. No new long-running preview server was created. Review/test-owned temporary servers close at teardown. PDF implementation is unchanged; the previous Dashboard/Reports rendering review remains relevant, and the full browser suite still exercised direct PDF download.

This is frontend preview work only. No backend implementation, provisioning, deployment, or commit occurred. Reusable modifier libraries/defaults, variants/bundles, durable stock/event ledgers, live shifts/reconciliation, backend role enforcement, and historical opening/closing stock remain separate work. Physical-device/screen-reader/Safari/Firefox/full-Figma validation remains unverified.

### October 4 Audit Trail and alerts continuation — previous saved checkpoint

- **Alert evidence and detection:** `data/audit.ts` detects qualifying rolling time windows rather than dropping a burst because its surrounding sequence spans longer than the window. Overlapping qualifying windows form one investigation; messages correctly say at least the threshold occurred within the configured window rather than claiming every grouped order fits it. Basket line/modifier ordering is normalized while actor, payment, total, quantities, prices, and actual modifier selections remain distinct. Voided orders stay excluded. These are potential duplicates requiring human review, not proof of misconduct.
- **Alert presentation:** All reviews / Void requests / Duplicate activity controls show counts; unread alerts precede read alerts and void requests are prioritized within that ordering. Affected order IDs expand separately. Mark read and Mark unread are reversible and never resolve the underlying issue. Read identities include the request timestamp or current affected order IDs, so renewed requests/new matching evidence appear unread. Settings use bounded integer values and, with read markers/category filters, last only within the current preview login. No persistent resolved-alert archive was added.
- **Linked investigations:** Alerts carry the reason, actor, affected IDs, and duplicate timeframe into an Audit Trail banner. Fresh drill-downs reset unrelated saved status/payment filters and bulk selections. Linked context remains when navigating away/back; Show all orders or Clear filters restores the full role-permitted view. A selected order outside the current filters is explicitly disclosed rather than appearing silently unrelated.
- **Audit filters and selection:** Added remembered Order status and Payment method controls plus a visible search summary. Search also covers recorded modifiers, GCash references, cashier roles, and void/request/review actor names. Named, keyboard-focusable table regions retain horizontal scrolling. Bulk selection shows selected amount, an indeterminate Select all state, hidden-selection warnings, and Keep visible selection only. Review lists every selected eligible order and its recorded stock handling; existing Staff bulk-action restrictions are preserved.
- **Order review timeline:** Original order, latest void request, request outcome, and void appear with recorded actor/role and Manila timestamps. `VoidRequest.requestedRole` is now snapshotted in App. Historical missing roles, void actors/timestamps, and stock handling remain disclosed. The timeline is derived from existing in-memory fields and retains only the latest request; it is not a durable per-event ledger. View selected order focuses the details heading, and the details region is keyboard-focusable. At widths below 1000px details/timelines scroll with the page rather than hiding events inside a second scroll area.
- **Void review:** Approval keeps the original request reason visible and read-only. Confirmation shows the selected total and distinguishes actual consumed stock, undeducted Pending requirements, missing/partial configured usage, and unknown historical stock handling. Cancel receives focus at the confirmation step. Single/bulk submissions are guarded against repeated confirmation. Original transactions, actor attribution, no automatic stock restoration, and no external refund behavior remain intact; no server concurrency/partial-failure guarantee was added.
- **Visual polish:** Owner/Admin statuses use readable Completed/Pending/Voided badges; badges and order IDs remain whole at narrow table widths. Review cards, investigation context, selection warnings, and timelines use the existing charcoal/cream/gold styling. Authentication/navigation and scoped Admin/Staff styles are preserved.

Latest verification:

- Final root `npm run typecheck` and `npm run build --workspace Frontend` passed after the last timeline/layout changes. Backend behavior tests were not run.
- Final full suite: **63 passed (1.9 minutes), clean runner exit.** The prior 55 remain and eight cases in `Frontend/tests/audit-alerts.spec.ts` cover rolling detection, canonical basket identity/false positives, recorded chronology/stock disclosures, status/payment/search retention, hidden bulk selection, new unread evidence/linked context, Admin approval reason/attribution, and mobile keyboard/Staff isolation. The small-screen case also verifies that Staff details are focusable and have no inner vertical scroll. `tests/setup-server.ts` is unchanged.
- Final responsive review: **90 screenshots** (85 geometry-checked states plus five additional timeline views) across 1440×900, 820×1180, 390×844, 320×568, and 820×400. Includes Owner/Admin/Staff Audit Trail, historical/linked/empty views, hidden bulk selection, both bulk stages, duplicate/read/request alerts, settings/evidence, and Staff/Admin review timelines/approval. No browser/HTTP errors, page overflow, broken images, visible measured controls below 44px, heading/table text below 12px, or horizontal dialog overflow were reported. Sampled visual inspection included final desktop linked context/stock disclosures, tablet selection/statuses, small-phone approval, short-screen bulk confirmation, and final mobile Staff timeline. Full physical-device/screen-reader/Safari/Firefox/Figma validation remains unverified.
- Visual review led to whole status/order-ID labels, correct unlinked-stock wording, and page-flow mobile/tablet details. The final suite, build/typecheck, and fresh review all ran after these corrections. Earlier new-test label lookup failures were resolved with explicit accessible names; no failing case remains.
- Test and review servers closed cleanly. The pre-existing `http://127.0.0.1:5175/` preview returned HTTP 200; it was reused. No new long-running preview server was started, and existing servers were not stopped. Report-export/PDF implementation was unchanged in this continuation; the prior Dashboard/Reports PDF verification remains the relevant rendering review.

Local artifacts: `.review/audit-alerts-review.mjs` and `.review/frontend/audit-alerts-final/` are the current responsive review. `.review/frontend/audit-alerts/` contains earlier captures from this continuation. Earlier Dashboard/Reports/PDF review artifacts are preserved. README describes the added behavior and 63-case suite. No backend implementation, provisioning, deployment, or commit occurred.

### October 4 Dashboard and Reports continuation — previous saved checkpoint

- **Category-preserving report links:** Dashboard average/payment/chart actions pass the selected Food and Beverage/Hobby category and Manila dates to Reports, opening Sales scope. Reports adds a remembered Sales category filter, visible filter summary, category-specific export filenames, and mixed-order explanations. `data/reporting.ts` allocates the recorded order total between categories using the existing discounted line prices; rounding leaves the category amounts summing to the original total. PDF/CSV transaction amounts, payment splits, averages, and Dashboard use this same calculation. This does not change the sample VAT/accounting policy.
- **Inventory scope remains explicit:** Combined reports may filter sales by category, while stock consumption/current-stock sections cover all inventory categories for the selected dates. Both the screen and exports explain this distinction; Inventory usage disables the Sales category control and omits payment summaries. Historical closing balances and incomplete snapshots remain disclosed. Export notes are specific to the selected report scope.
- **Expired-stock attention:** Dashboard now derives attention from usable quantities and expiry data rather than relying solely on saved status labels. It includes fully/partly expired stock, uses usable quantity for shortages, and shows all affected items in a scrolling card. Links highlight an affected expired batch where present. Reports show physical on-hand and usable quantities separately, derived stock condition, and reorder levels; missing thresholds disclose the existing five-unit preview fallback. Receiving/stock deduction policies remain unchanged.
- **Chart and status links:** Daily chart values have a keyboard-accessible table. Today's other-status action opens only the selected category's Pending/Voided orders. Audit Trail uses an explicit linked-only flag so an empty linked selection stays empty instead of revealing all orders. Clear filters restores the list; existing alert/recent-order links remain supported.
- **Responsive reports:** Three-column desktop/two-column tablet/one-column mobile filters. The expanded stock table scrolls horizontally on small phones to preserve readable units/statuses and has a named, keyboard-focusable region. Admin/Staff styles remain scoped.
- **Prior PDF inspection completed:** Visually checked `redesign-final/inventory-page-2.png` and `inventory-page-3.png`; a cropped rendering confirmed page 3's title/date/column header. Stock rows and footers were readable. These are previous exports; current exports are under the new review directory below.

Latest verification:

- Root `npm run typecheck` and frontend production build passed after the final export correction.
- Full browser suite: **55 passed (1.4 minutes), clean exit.** After the final PDF-only layout correction, the three affected category/expiry/direct-PDF browser cases passed again. The eight Dashboard/Reports/Admin cases also passed after the responsive table/filter refinement. `tests/setup-server.ts` is unchanged.
- Final focused responsive review: **65 captures** across 1440×900, 820×1180, 390×844, 320×568, and 820×400. Owner/Admin Dashboard, category reports, Combined/Inventory views, export dialogs, print-media inventory, and chart values are covered. No automatic browser/HTTP errors, page overflow, broken images, controls below 44px, heading/table text below 12px, or horizontal dialog overflow. Sampled visual inspection covered desktop Dashboard, tablet category reports, and small-phone reports/stock tables. This remains a sampled review, not physical-device/screen-reader/full-Figma validation.
- Current PDF scopes were exported for September 26–October 4 after one mixed Food/Beverage/Hobby order with a configured extra-cheese burger. **Sales Hobby: 1 page; Combined Hobby: 4 pages; Inventory usage: 3 pages.** All eight final pages were rendered with Poppler and visually inspected. `pypdf` checks passed for per-page titles/date range/numbered footers, included/excluded scope sections, Hobby's ₱280.00 share rather than the whole ₱515.20 order, recipe consumption, physical/usable stock, expired status, and preview fallback thresholds. On-screen/CSV category checks also passed.
- PDF review found an orphaned Stocks used heading at a page end. `report-export.ts` now reserves space for the section title, column headings, and first ordinary row together; long rows still continue with repeated headings. Fresh matching renders and extracted-content assertions confirmed the fix. The PDF verifier was corrected to normalize wrapped extracted status text and distinguish section titles from explanatory notes; no application workaround was added for those verifier assumptions.
- The existing preview at **http://127.0.0.1:5175/** responds and serves the current Reports source. An attempted duplicate start correctly failed because the port was already occupied; the existing server was reused, not stopped. No new long-running server was started. Review/test-owned servers closed cleanly.

No backend implementation, provisioning, deployment, or commit occurred. Existing scaffold and uncommitted work are preserved.

Local review artifacts: `.review/dashboard-reports-review.mjs`, `.review/verify-dashboard-reports.py`, and `.review/frontend/dashboard-reports/`. Preserve previous review captures as historical. README describes the current behavior and 55-test suite.

### October 4 resumed redesign — previous saved checkpoint

- **Unsaved inventory edits:** `App.tsx` now guards sidebar navigation and logout. Inventory Cancel/Back use the same styled **Discard inventory edits?** dialog with **Keep editing** initially focused; Escape cancels leaving and preserves the draft. Explicit **Discard changes** continues the requested action. `RecordEditor` registers dirty state and a browser `beforeunload` warning while edits are pending. Calendar selections also mark the editor dirty. Successful save clears the guard. This protects an active inventory editor; it is not a general draft persistence system or a guarantee that mobile browsers always show an unload prompt.
- **Category isolation:** the editor now initializes its Category with local `useState` from the actual product/stock record. It previously reused `Inventory.category` filter state, so opening a Food record through a Beverage view/search could silently change its category on save. The list filter still persists independently through `useViewState`.
- **Stock units:** compatible changes now immediately convert the displayed read-only quantity and editable reorder threshold, as well as converting saved quantity/batches. Examples checked: Onions 500 g / threshold 100 g becomes 0.5 kg / 0.1 kg; Oat Milk 32 L becomes 32,000 ml with 12,000/20,000 ml batches. Existing recipe quantities keep their own units. Incompatible saved unit changes remain rejected. Receiving stays separate from metadata editing.
- **Calendars:** `DateField.tsx` clamps its initial focus, Arrow keys, Home/End, and PageUp/PageDown to valid min/max dates; month movement preserves the day where possible and clamps month-end dates (January 31 → February 28). Previous/Next month buttons disable when that month is outside the range. Reports From now has `max={end}`, complementing To's `min={start}`. Escape closes the calendar and restores its trigger without dismissing its containing receiving dialog. Focus leaving the calendar dismisses it without stealing focus from the destination. Added trigger `aria-controls`, live month announcement, and disabled-button styling.
- **Shared modal focus:** `components/ui.tsx` accepts an optional `data-initial-focus` target before its existing editable-field focus behavior. The discard dialog uses it; existing Admin/Staff modal behavior remains.
- **Documentation:** README now describes the three roles, separate inventory views, recipes/modifiers, in-memory stock preview, named single/bulk voids, actionable alerts, direct PDF/CSV/Print, unsaved-edit protection, and current test count. It explicitly retains missing backend/durable ledger/historical balance/variant/bundle/reusable-library limitations.

Latest verification at this second pause:

- **Final root `npm run typecheck`: passed.** Both workspaces typechecked; backend behavior tests were not run.
- **Final `npm run build --workspace Frontend`: passed.** This includes the stock display/threshold conversion refinement.
- **Final full browser suite: 50 passed (1.2 minutes), clean runner exit.** This is the previous 43 plus seven new cases in `Frontend/tests/continuation.spec.ts`. They cover cancelled/discarded sidebar navigation, mobile logout/Back, saved category isolation and guard cleanup, calendar-only dirty changes and cancelled refresh, receiving-dialog Escape/light dismissal, report date bounds/month ends, and quantity/batch/threshold conversions. `tests/setup-server.ts` remains unchanged. All test and review runners completed and closed their own servers.
- **Fresh final visual review: 150 screens** at 1440×900, 820×1180, 390×844, 320×568, and 820×400. Includes all three actual role labels, product/ingredient views, final stock-unit editor and converted stock, long product/modifier names, customization/cart, discard dialog, Audit/bulk void, and report/export/calendar views. Automated checks found no browser/HTTP errors, page overflow, broken images, visible workspace controls below 44px, heading/table text below 12px, horizontal dialog overflow, or calendars outside the viewport. Sampled visual inspection included desktop stock-unit editing, mobile long-name customization, and small-screen report export. This is sampled visual review, not full Figma/physical-device/accessibility validation.
- **Revised PDF inspected:** the existing corrected padding/whole-row exporter was downloaded again and rendered with Poppler. The historical Combined sample is now four A4 pages; its pages were visually inspected, including a cropped continuation-header inspection. No PDF source change was needed in this resumed work. Initial concern about missing titles in the displayed full-page images was not a confirmed PDF defect; cropped rendering and extracted content confirmed the headers.
- **Current-day PDF scopes exercised:** Combined (4 pages), Inventory usage (3 pages), and Sales (1 page) were exported for October 4 after a configured customized burger sale. All were rendered. `pypdf` checks verified title/date range, headers/numbered footers on every page, correct included/excluded scope sections, ₱151.20 completed amount, and recorded ingredient usage/current quantities, including 0.02 kg onion consumption and 0.48 kg remaining. Visually inspected all four Combined pages, the Sales page, and the first Inventory usage page. **The last two Inventory usage pages have matching renders but have not yet been visually inspected at this second pause.** Unicode/peso text, table padding, and ordinary whole-row page breaks were readable in inspected pages.

Latest local review artifacts (outside the repository):

- `.review/redesign-final-review.mjs` — repository Playwright + installed Edge, own Vite server on port 5181; completed and closed.
- `.review/frontend/redesign-final/checks.json` — 150 final captures, no automatic failures.
- `.review/frontend/redesign-final/combined-current-day.pdf`, `inventory-current-day.pdf`, and `sales-current-day.pdf`, with `combined-page-*.png`, `inventory-page-*.png`, and `sales-page-1.png` matching renders.
- `.review/verify-final-pdfs.py`, extracted `*-current-day.txt`, and `pdf-checks.json` — scope/date/header/footer/recorded-data checks.
- `.review/frontend/redesign/combined-report.pdf` and `.review/frontend/redesign-final/verified-report-page-*.png` — the newly downloaded historical Combined sample and its matching four-page renders. Earlier `report-page-*.png` files in the original redesign directory are still historical and should not be compared with a newer PDF.

No long-running preview was started in this resumed work. If reviewing the app later, start the documented local preview on port 5175. Preserve the saved changes; no commit, deployment, provisioning, or backend implementation occurred.

### October 4 redesign checkpoint — saved work

- **Shared UI:** `components/SearchField.tsx` supplies immediate search, clear actions, and a focus outline around the whole container. `components/DateField.tsx` supplies typed date inputs with a shared calendar popover, month navigation, arrow-key selection, viewport positioning, and trigger focus restoration. Inventory receiving/editor, Audit Trail, and Reports use it; login/recovery have no date fields. `redesign.css`, imported after Staff styles, adds workspace refinements. `lib/view-state.tsx` preserves page filters across navigation within a preview login; logout clears those filters.
- **Three roles:** shared Role is now Owner / Admin / Staff. Angel is explicitly Owner, a new Alex sample account represents Admin, and preview entry offers all three. Navigation now displays the actual role. Owner and Admin retain operational pages and can void under their own name; Staff retains POS and current Manila-day shift history/request access. User forms offer all three roles. The provisional preview policy lets Owner assign Owner/Admin and lets Admin manage Staff only; the last Owner and the signed-in account cannot be deleted. Last-Owner demotion is blocked. Real role enforcement still needs the backend.
- **Inventory:** separate Ingredients / Products / All results views, explicit Add Ingredient / Add Product, case-insensitive search from the first character across name/SKU/code, and clear results context. Search temporarily covers all views/categories so ingredient matches are not silently hidden from Products; clearing restores the chosen view. Only records with two or more batches get an expand button. One-batch receipt/expiry details appear on the main row. Product and stock editing, optional photos, photo replacement/removal, default icons, prices, discounts, availability, recipe inputs, and product-specific modifier groups/options are saved. SKU is editable separately from stable record IDs. Compatible stock unit changes convert on-hand quantities and receipt batches. Receiving remains distinct from metadata editing. Editor records latest actor/time and warns when cancelling unsaved edits.
- **POS:** Inventory-defined groups open customization; products without groups retain quick add. Required/min/max groups validate. Cart lines show modifiers and allow edits; only matching configurations combine. Price adjustments use the existing discount and sample 12% VAT calculation. Sale lines snapshot prices, selected modifiers, and recipe inputs. Quantity/configuration checks include modifier stock inputs, unit conversions, expired stock, and availability. Payment has a submission guard plus order/reference deduplication in App.
- **Stock preview behavior:** new made-to-order products consume recipe inputs; stocked finished/retail products consume their linked stock. Completed sample checkout deducts in-memory stock from the nearest usable expiry first. Staff Pending checkout records requirements without deduction. Voids retain consumed stock and do not imply payment refunds. These are provisional frontend demonstrations, not agreed live accounting/approval policies. The original nine catalogue fixtures remain unlinked to recipes/stock to preserve their existing sample workflows; POS labels them “Sample stock not linked.” Reports flag missing/incomplete usage instead of inventing consumption. A Hamburger fixture with buns/patties/onions, extra cheese, and no onions demonstrates the configured workflow.
- **Dashboard:** a prominent review area shows pending void alerts and groups potentially identical repeated orders with actor, role, Manila timestamp, reason, and order IDs. The sample repeat threshold/window is configurable (defaults: 5 identical orders / 2 minutes). Mark read leaves the underlying issue unresolved. Alerts open filtered Audit Trail with relevant order details; stock attention links open and highlight the actual Inventory record/batch. Recent sales and sales summaries link to Audit Trail/filtered Reports. Added completed-order average, Cash/GCash, Pending/Voided summaries, and an honest unconnected-shift empty state.
- **Audit Trail:** whole-row click and Enter/Space select details; checkboxes do not trigger row selection. Search trims whitespace and matches one character, partial IDs, actor names, status, and item names. Active date/request/linked-order filters and Clear filters are visible. Single and bulk voids use a review/confirmation flow without an Owner password. Explicit eligible filtered-order selection, selected counts, amounts, reasons, retained transactions, actor/role/time, and bulk action IDs are shown. Staff requests retain review attribution. Backend concurrency, durable per-event logging, external refunds, and real partial failures remain future work.
- **Reports:** Sales / Inventory usage / Combined scopes, separate Print, CSV, and a direct Download PDF. Export summary has Cash/GCash amounts without decorative progress bars, then Stocks used / Stocks remaining with item/SKU, quantities, and units. Recorded consumption includes voided orders whose ingredients were not returned; Pending requirements do not count as consumed. Current stock has a current Manila-date label; historical period-end balances are explicitly unavailable. Missing/incomplete stock snapshots are disclosed. Added lazy `jspdf` dependency, a licensed embedded DejaVu Sans report font, multipage headers/footers, Unicode support, CSV formula escaping, and download errors. Vite pre-bundles jspdf to avoid a first-export development reload.

### Validation at the initial pause — historical, superseded by the latest checkpoint above

- **Latest root `npm run typecheck`: passed.** Backend and frontend types checked; no backend behavior tests were run.
- **Latest `npm run build --workspace Frontend`: passed.** This was after the final stock-unit/photo/report-table changes.
- The previous complete run was **36 passed / 3 failed out of 39**. Failures were a mistaken expected search count (“j” also matches Mejia), an ingredient test interrupted while App source changed, and exact Role label selection. The subsequent targeted run was **11 passed / 1 failed out of 12**; its remaining failure was a Playwright option-disabled matcher seeing `<option disabled>` as enabled. The test now checks the disabled attribute. No application workaround was added for that matcher.
- **Final full suite: 43 passed (1.2 minutes), clean runner exit.** The run was already underway when the user asked to pause and completed while this handoff was updated. It includes 27 adapted existing cases, 14 redesign cases, and two stock-model cases. No known failing test remains at this checkpoint. `tests/setup-server.ts` is unchanged and owns port 5180.
- A pre-final visual run captured **115 screens** at 1440×900, 820×1180, 390×844, 320×568, and 820×400. Its automatic checks reported no browser/HTTP errors, page overflow, broken images, controls under 44px high, heading/table text under 12px, horizontal dialog overflow, or out-of-viewport calendars. Sampled desktop/mobile/short-screen screenshots were visually inspected. These captures precede the final Navigation role label, stock-unit/photo refinements, compact stock-report tables, and PDF row-spacing correction; re-capture those changed views when resuming.
- Direct PDF download was exercised without `window.print`, inspected with pdfinfo, extracted with pypdf, and rendered with Poppler. The earlier sample is a readable three-page A4 file with Unicode/peso characters and repeated headings. Visual review found horizontal rules too close to subsequent row text and a stock row split across pages. The generator was corrected to add padding and keep ordinary rows together, **but the revised PDF has not yet been rendered/visually verified at this pause**.
- Single-letter search failure was **not reproduced** in the checked sample view. Current UI tests confirm immediate case-insensitive character/substring search and the visible impact of date/request filters. Do not claim the original user observation had a confirmed root cause.

Local review artifacts (outside the repository):
- `.review/redesign-review.mjs` — repository Playwright + Edge, own Vite server on port 5181.
- `.review/frontend/redesign/checks.json` and the 115 PNG captures.
- `.review/frontend/redesign/combined-report.pdf`, `report-page-1.png` through `report-page-3.png`, and `report-text.txt` are earlier export inspection artifacts. A later test can overwrite the PDF without re-rendering those PNGs; regenerate matching renders before comparison.

### Remaining work after the design-reference cleanup

**Priority override:** implement the new **Highest priority — new UI feedback** list above before this older backlog. Staff shifts are now explicitly out of scope; retain daily Owner sales review/reconciliation without shift management. The completed checkpoints below remain historical descriptions of the current preview.

1. The full **108-case suite** passed again after cleanup (2.8 minutes), with fresh root typecheck/frontend build and matching preservation/build hashes. The previous 36-case search recheck remains historical. Preserve in-process test teardown and port 5180 ownership; validate later changes appropriately.
2. Current shared-search review captures/checks are in `.review/frontend/search-focus/`. Variants/bundles UI captures and matching four-page PDF/renders are in `.review/frontend/variants-bundles/`. Earlier Dashboard/Reports, Audit Trail/alerts, modifiers and checkout captures remain historical. Do not compare old renders with overwritten PDFs.
3. Address the user's next frontend feedback. Shared-search Clear focus/visibility, Owner/Admin checkout stage focus, and unused artwork/stylesheet cleanup are now complete. Original design files remain recoverable in `Frontend/design-reference/`; restore a needed asset before referencing it. Physical-device, actual screen-reader, Safari/Firefox and full Figma fidelity review remain unverified.
4. Keep prototype limitations explicit: original unlinked catalogue fixtures, no durable stock/event ledger or historical opening/closing stock, no durable variants/bundles or live library synchronization, no nested/recipe-based bundles, production batches or component-level mixed-category revenue allocation, no live shifts/reconciliation, no server authorization or real bulk-void concurrency/partial failures. These gaps do not authorize backend work.
5. README and this handoff describe the current frontend. Preserve original requirements and earlier phase notes below.

### Requirements reference — user feedback recorded October 4, 2026

**Status: partially implemented in the October 4 frontend redesign above; this original requirements list is retained as the reference.** Do not read its earlier future-tense wording as the current implementation status. The checkpoint states what is saved and what remains. Backend dependencies and proposed business policies do not authorize backend implementation.

#### Dashboard — Owner and Admin

User requirements:

- Add a prominent alert/notification area for pending void requests and potential sales spam or unusual repeated sales. Include the responsible Staff, Admin, or Owner name, role, timestamp in Manila time, alert reason, and affected order(s).
- Clicking a void-request alert must open Audit Trail with the pending-request filter and relevant order selected. Clicking an unusual-sales alert must open the relevant actor/date/order view for investigation.
- Make each Needs attention entry actionable. Low-stock, out-of-stock, or expiring-item alerts must open Inventory at the corresponding Product/Ingredient view, SKU, and batch where applicable. A destination page alone is insufficient: the affected record should be visible or highlighted.

Recommended dashboard contents, in priority order:

1. Actionable alerts: pending void review, stock shortages, batches nearing expiry, and unusual transaction activity. Show urgency, unread/resolved state, count, and View all; combine repeat alerts rather than filling the dashboard with duplicates. Marking an alert read must not approve a void or resolve the underlying stock issue.
2. Today's completed sales amount, completed order count, average order value, and Cash/GCash split. Show Pending and Voided separately; define gross/net sales, discounts, and tax labels consistently with Reports before changing calculations.
3. Inventory health: low/out-of-stock ingredient and product counts, expiring batches, and prepared products unavailable because an ingredient is missing. Count records or show quantities with units; do not add kilograms, liters, and pieces into one stock total.
4. Sales trend with date/category filters, recent transactions with cashier/status, and best-selling products. Clicking summaries should open the relevant filtered Reports or Audit Trail view.
5. Shift overview: active staff/shift, transaction counts, pending orders, and cash reconciliation exceptions once real shifts/reconciliation exist. Show empty states rather than pretending live tracking exists in the current preview.

Alert behavior to design later:

- Treat “spam sales” as **potential duplicate/unusual activity**, not proof of misconduct. Proposed signals: many very similar orders by one actor within a short time, duplicate submissions, repeated voids, or abnormal activity compared with that shift. Thresholds/time windows must be configurable and agreed later; a busy cashier alone is not evidence of spam.
- Keep the evidence (actor ID/name/role at the time, order IDs, timing, trigger, review state). Alerts require human review; they must not automatically bulk-void sales or punish an account. Prevent duplicate checkout submissions separately from generating alerts.
- Preserve navigation context and filters when entering/leaving linked pages. All alert and attention actions must work with keyboard, desktop, tablet, and mobile navigation.

#### Inventory — separate ingredients, products, recipes, and modifiers

User requirements:

- Separate **Ingredients** from **Sellable Products** instead of mixing raw ingredients with menu/retail items. Food/Beverage/Hobby remain categories within appropriate views; provide clear Add Ingredient and Add Product actions. A modifier-management area may be a third view or live inside product editing.
- Allow editing existing products: name/SKU, selling price, ingredients/recipe, applicable modifiers, photo, and availability. Allow editing ingredients: name/SKU, stock unit, threshold, photo, and related stock metadata. Record who changed a price, recipe, or stock record and when.
- Product and ingredient photos must be optional at creation. Use a consistent default image/icon when absent; an Edit action must allow adding, replacing, or removing a photo later. Do not block ingredient creation because no photo was uploaded.
- Show a batch-expand dropdown only when the product/ingredient has **two or more batches**. Zero/one-batch rows must not display an inactive or misleading expand arrow. Keep the single batch's receipt/expiry details accessible through its row/details view.
- Add immediate, case-insensitive search from the first character by Product name, Ingredient name, or SKU. Make it clear whether the search covers all records or the selected view; offer an All results view or separate Product/Ingredient matches so searching an ingredient from Products is not a silent dead end. Clearing search restores the current view; provide a clear no-results state.
- Add modifiers to applicable products: e.g. Hamburger + cheese, extra vegetables, no onions. Hobby modifiers are optional; do not require a modifier group for every Hobby item.

Recommended inventory model and behavior:

- **Ingredient:** a stocked input with its own SKU, unit (g/kg, ml/L, pcs), reorder level, receipt batches, cost, and optional photo.
- **Made-to-order product:** a sellable item with a price and recipe specifying ingredient quantities per serving. Example only: one Hamburger consumes one bun, one patty, and defined vegetable quantities. Deduct recipe inputs, not a second independent Hamburger stock count, unless the product is intentionally pre-produced and tracked as finished stock.
- **Stocked finished/retail product:** a prepackaged food item or Hobby SKU tracked directly in pieces, with variants where needed. Pre-produced food may have production batches; its recipe inputs are consumed at production, and its finished units at sale. Avoid deducting the same inputs twice.
- **Modifier:** a product-linked option with a displayed price adjustment and, when applicable, ingredient additions/removals/substitutions. Extra cheese can consume an extra slice and add a surcharge; “no onions” can remove the onion requirement without automatically changing price. Offer reusable groups, required/optional selection, min/max choices, and sensible defaults.
- For Hobby, prefer stock-tracked variants for different editions/sizes/colors and explicit bundles for multiple SKUs. Extras such as a sleeve or gift wrapping can be optional add-ons if the business wants them; each stocked add-on must consume its own SKU. No compulsory food-style ingredient recipe for Hobby products.
- Normalize unit conversions before deducting stock. Perishable batches should be consumed using a defined expiry-aware policy (suggested: first-expiring usable batch first); do not sell expired or unavailable inputs. Keep receiving, wastage, stock adjustments, and physical counts distinct from product/recipe editing.
- Keep historical sale prices, recipes, modifier selections, and consumed stock as snapshots/events. Editing today's product price or recipe must not rewrite yesterday's transactions or reports. Archive referenced products/ingredients rather than removing their history.

Industry references support the distinction between ingredients linked to products and customizable product modifiers: [Lightspeed ingredient management](https://resto-support.lightspeedhq.com/hc/en-us/articles/226305427-About-ingredient-management), [Lightspeed product modifiers](https://o-series-support.lightspeedhq.com/hc/en-us/articles/31329505626651-Creating-and-selling-with-Product-Modifiers). The stock rules above are proposed Vertwell behavior, not a claim that every POS system implements modifiers identically.

#### POS — product modifiers and accurate stock usage

User requirements:

- Make the Inventory-defined product modifiers available while building an order. Products with applicable choices should open a clear customization view; products without modifiers keep quick add-to-cart behavior.
- Display selected modifiers and price adjustments beneath the cart item and on confirmation/receipt/history. Allow editing them before payment.

Recommended behavior:

- Keep differently customized versions of the same product as separate cart lines; combine quantities only when product, variants, and selected modifiers match.
- Validate required groups and limits. Show the final unit price and total before adding/confirming, with the existing discount/tax calculation policy applied consistently.
- Check base ingredients plus modifier requirements and disallow unavailable selections. Changing quantity/modifiers must recalculate price and ingredient requirements together.
- Record consumption from the actual purchased configuration. Prevent duplicate payment submissions and repeated stock deductions. Define the stock-commit point and the meaning of Pending/Completed before integrating real checkout; current Staff Pending sales do not yet deduct stock.

#### Reports — downloadable PDF, stock usage, and remaining inventory

User requirements:

- Provide **Download PDF** that saves a generated .pdf directly, without requiring the browser print dialog. Keep Print as a separate action and preserve CSV. Current PDF mode only invokes window.print(); this request needs an actual PDF export path later.
- Include stocks/ingredients used, not only sales and transaction totals.
- In the export summary modal, retain clear Cash/GCash amounts but remove the decorative/progress lines below them. Add a separate section below the payment summary for **Stocks used** and **Stocks remaining**, showing item name/SKU, quantity, and unit. If indicators are used, they should convey real item-level stock/reorder information rather than repeat payment totals.

Recommended report contents:

1. Sales summary: gross sales, discounts, net sales, separately labeled tax, completed/pending/voided order counts, average order value, Cash/GCash split, category/product quantities, and cashier/shift breakdown. Confirm accounting labels/policy before calculating new financial metrics.
2. Inventory movements for the selected period: opening stock, receipts/restocks, sales-related ingredient consumption and Hobby units sold, wastage/expired stock, returns/reversals, transfers if applicable, manual adjustments, and closing stock. Distinguish theoretical recipe usage from measured wastage or physical-count variance.
3. Stock remaining by ingredient/product, batch/expiry where useful, unit, reorder threshold, and low/out-of-stock state. Stock value/recipe cost/margin can follow once trustworthy purchasing costs and a costing method exist.
4. Void/review report: requests, outcomes, reasons, requester/reviewer, timestamps, affected amount, and corresponding payment/stock handling. Original transactions remain traceable.
5. Reconciliation/exception summary once integrated: cash expected vs counted, GCash references/reconciliation status, unexplained stock variance, and unresolved unusual-sales alerts.

Report rules:

- Offer Sales, Inventory usage, and Combined report scope; export the same filters/data shown on screen. Include date range, Manila timezone, generated timestamp, report scope, and readable multipage table headings. Retain empty states and sample-data labels while preview-only.
- For a historical date range, distinguish **stock at the end of that period** from **stock currently on hand**. Show both only with clear dates; today's quantities must not be mislabeled as a historical closing balance.
- Reconcile stock per SKU/unit: closing = opening + receipts + usable returns + transfers in − sales/production consumption − wastage − transfers out ± adjustments. Use durable movement records, not current recipes multiplied by old sales. Do not sum incompatible units into one “stocks left” number or generic bar.
- A void does not automatically make prepared ingredients usable again. Record whether stock was actually returned, food was wasted, or only a duplicate/unfulfilled transaction was reversed. Show these movements separately.

#### Audit Trail — whole-row selection, search, and exceptional bulk void

User requirements:

- Clicking anywhere on a transaction row should open/select its order details, rather than requiring the Order ID click. Retain an accessible keyboard equivalent and prevent clicks on row checkboxes/actions from accidentally selecting a different action.
- Search must filter immediately from **one letter or digit**, case-insensitively, including Order ID and Staff/Admin/Owner name. Prefix and substring matches should work; other filters must be visible so an active date/request filter does not silently hide an expected match. Clearing search restores the filtered list.
- Record the user's observed single-letter search failure for investigation. Current SalesHistory.tsx already uses controlled input plus case-insensitive .includes over order ID, cashier, status, and item names; do not add an artificial minimum length or declare the issue fixed without reproducing it in the UI. Check sample data, whitespace normalization, combined filters, role/shift scope, and immediate updates.
- Add **Bulk Void** for exceptional cases involving multiple selected sales, with clear checkboxes and a selected-count summary. Keep normal single-order void and Staff request/Owner-or-authorized-Admin review paths.
- An **Admin may void a sale without an Owner password or Owner approval**. Owners may also void sales. Each void must record and display the name and role of the signed-in Admin or Owner who performed it in the sale details and Audit Trail; do not attribute an Admin's action to the Owner. Staff continue to submit void requests for review.

Recommended bulk-void behavior (lower priority than correct single-order handling):

- Select explicit eligible order IDs; explain whether Select all covers the current page or all filtered results. Review the selected orders, total amount, reason, and payment/stock effect before confirmation. Do not include already-voided or ineligible orders silently.
- Apply real role permissions. Staff can submit requests; signed-in Admins and Owners can review requests and void sales under their own identity, without requiring an Owner password for Admin actions. Enforced role authorization must replace the current sample-password demonstration during backend integration.
- Preserve the original sale and a separate audit event per affected order, plus a batch-action reference, actor/reviewer, reason, and timestamps. Handle changed records, partial failures, retries, and duplicate submissions without voiding or restoring stock twice. Do not imply that a void automatically refunds an external payment.
- Suggested later Audit Trail expansion: price/recipe/modifier edits, stock receipts/adjustments/wastage, role/account changes, and alert reviews alongside sales/void events, with event-type/actor/date filters.

#### Users — three distinct roles

User requirements:

- Replace the combined employee role selection with **Owner**, **Admin**, and **Staff** in both Add User and Manage User. An ordinary administrator must be labeled Admin rather than Owner/Admin; the existing Angel owner account should become Owner when migrating the combined role.
- Keep the owner identity explicit. Do not automatically turn every existing Owner/Admin record into Owner without resolving whether it is actually the business owner or an administrator.

Recommended decisions for the implementation phase:

- Define a permission matrix across Dashboard, Inventory/price/recipe editing, POS, Reports, Audit Trail/void approval, and user administration. Proposed starting point: Owner has business/role control; Admin has delegated operational/review access; Staff has POS and its own permitted sales/request views.
- Offer all three role choices where the signed-in user is authorized to assign them. Suggested policy for confirmation later: only Owner may assign/revoke Owner or elevate Admin permissions. Preserve at least one active Owner and prevent accidental loss of the owner's access.
- Update the shared Role type, preview choices, navigation, labels, authorization checks, account forms, owner-preservation checks, and tests together. Current “not Staff” checks equate Owner/Admin access and are not a sufficient future permission model. Backend role enforcement remains necessary for live accounts.

#### Shared UI — calendars, search focus, and consistency

User requirements:

- Review every date picker across login/recovery where relevant, Inventory receiving/batches, Audit Trail, and Reports. The calendar popup should align with its field, stay inside the viewport, and fit the site's typography/colors on desktop/tablet/mobile.
- Current date fields use browser-native controls; evaluate a shared accessible calendar popover if the native calendar cannot meet the desired layout. Support typed dates, keyboard navigation, Escape/focus return, sensible month navigation, valid-range rules, and Manila business-date interpretation without off-by-one conversions. Do not mix several custom/native behaviors unintentionally.
- Fix search-field focus styling: the focus outline must wrap the **entire search container**, including its icon and text, instead of drawing a smaller rectangle over the placeholder/input. Use a consistent focus-within treatment and preserve a visible keyboard focus indicator across POS, Inventory, and Audit Trail.

Additional recommended polish:

- Visible labels or accessible names, clear-search actions, consistent placeholders, no-results/loading/error states, and accessible table row/alert actions. Maintain 44px touch controls, responsive table containment, and short-screen dialog scrolling.
- Explain disabled/unavailable actions, warn about unsaved product edits when appropriate, and preserve filters/navigation context across drill-downs. Use “Pending request”, “Voided sale”, and “Refunded payment” as distinct statuses when those workflows exist.

#### Suggested implementation order and decisions to confirm later

1. Shared search/calendar focus fixes, Inventory search/batch arrows/optional photos/editing, and clickable dashboard/Audit Trail navigation.
2. Separate Product/Ingredient/Recipe/Modifier data and the three-role permission design. This is a cross-page change; agree the model before changing POS or reports.
3. POS customization and price/recipe/modifier snapshots, followed by durable receiving/usage/wastage/void movement records when backend work is explicitly authorized.
4. Downloadable PDF plus sales/inventory/closing-stock report views; then real notification delivery/unusual-sales rules and lower-priority exceptional bulk void.

Keep these decisions open until that phase: paid-vs-approved stock deduction timing, usable stock return vs food wastage on void, required modifier groups and unit conversions, historical stock costing, alert thresholds, and remaining Owner/Admin permissions. Admin void access without an Owner password and named Admin/Owner attribution are confirmed requirements above. No user answer is needed just to preserve this backlog.

Acceptance review later should cover: single-letter/partial-ID/actor searches, zero/one/two-batch rows, creation without photos and later photo editing, two differently customized burgers, price/recipe edits preserving old sales, unavailable ingredients/modifiers, alert drill-downs with filters, period-end stock vs current stock, direct PDF download, row keyboard access, bulk-void partial failures, and Owner/Admin/Staff role isolation. Expand meaningful browser/backend checks as implementation warrants; the previous 27 passing tests are historical validation, not proof of these planned features.

### Review the current app

Local frontend preview: http://127.0.0.1:5175/. From the repository root, start it with:

```powershell
npm run dev --workspace Frontend -- --host 127.0.0.1 --port 5175 --strictPort
```

Choose **Owner**, **Admin**, or **Staff**, then **Open preview**. No credentials are needed. Staff opens POS and has today’s sales history; Owner and Admin have all six destinations. Role switching retains current in-memory sales and void requests; logging out clears the cart.

Preview data resets on refresh. Sample verification codes are `123456` when Supabase is unconfigured. QR payments, account creation, and void review are demonstrations. Voids are attributed to the current Owner/Admin without a sample approval password. The QR does not collect payments.

### Workspace and design

- Repository: `C:\Users\ASUS\Documents\Personal\Vertwell\repo`
- Stack: React 19, Vite 8, TypeScript 7; Express/Supabase backend scaffold; npm workspaces `Frontend` and `backend`.
- Preserve the exact `Frontend` capitalization.
- [Figma reference](https://www.figma.com/design/zO8rh8PzStsKOqS2iTJZYw/Prototype-Designing?node-id=236-804&t=8lbSPt1Qd0txfPAZ-1): file `zO8rh8PzStsKOqS2iTJZYw`, compilation node `236:804`.
- Scope so far: frontend first, with original Figma assets and interactive sample data.

### POS hobby icon update

- Replaced the outlined hobby PNG with `Frontend/public/assets/hobby-solid.svg`, Google's filled Material Icons **style** (stacked cards), colored `#161310` to match F&B. All four sample hobby products and newly created Hobby products use the same local SVG in both Admin and Staff POS.
- Original source and color modification are recorded in `Frontend/public/assets/material-icons-NOTICE.md`; the Apache 2.0 license is bundled in `material-icons-LICENSE.txt`. No icon-library dependency was added.
- Root typecheck, frontend production build, and all **27 browser tests passed**. A focused review captured eight All Items/Hobby Items views across both roles at 1440px and 390px; all four hobby icons loaded in each view, with no browser/HTTP errors or page overflow. Desktop All Items and mobile Hobby Items were visually inspected.
- Local focused captures/results: `C:/Users/ASUS/Documents/Personal/Vertwell/.review/frontend/hobby-icon/`; script: `.review/hobby-icon-review.mjs`. The earlier Staff captures predate this icon change.

### Staff workspace completed October 3, 2026

The user explicitly requested Staff redesign after the completed Admin phase. This supersedes the earlier Staff deferral. Navigation, login/recovery, and Admin retain their finished layouts.

- Added `Frontend/src/staff.css`, imported after admin.css and scoped to `.staff-workspace`. Reuses bundled Poppins, original product photos, charcoal/cream/gold, white cards, visible keyboard focus, stable text sizes, 44px minimum button heights, and 46px minimum field heights.
- Staff POS: cashier context, category/search controls, catalogue result count, readable product cards, item count, useful order empty state, larger quantity controls, and an explicit subtotal/VAT/total-due breakdown matching checkout. Admin keeps its existing subtotal presentation. Search, cart retention, quantities, discounts, and the original payment calculations remain.
- Staff history: Manila day/shift context, counts of this cashier’s recorded orders, Pending orders, and Pending void requests; readable scrollable table with keyboard access/status badges, helpful empty/search states, order/payment/reference details, and owner-review guidance. Summary counts remain independent of search/date filters. Existing cashier/shift/date restrictions remain; Staff display timestamps explicitly use Asia/Manila.
- Staff order confirmation, cash, QR, and void dialogs use stable field/text sizes and scroll on short screens. Shared Modal now captures/restores Staff opener focus as it already did for Admin; Staff payment stage changes focus their first field or payment choice. Native modality, Escape, and backdrop dismissal remain.
- Sample notices stay visible. Staff checkout still records Pending sales; QR does not collect payments, void requests still require owner review, and all preview state resets on refresh. No stock/payment/auth/backend integration, service provisioning, deployment, or commit was performed.

### Staff validation

- Root `npm run typecheck` and a fresh `npm run build --workspace Frontend` passed.
- Complete browser suite: **27 passed**, clean exit. All 24 existing cases remain; the Admin-to-Staff presentation test was updated for the newly authorized redesign while retaining role-isolation assertions. Three new `Frontend/tests/staff.spec.ts` cases cover responsive controls/totals/cart retention, short-screen payment focus/validation/QR recording, and Manila-day shift filtering/summary counts/void rejection across role changes. `tests/setup-server.ts` is unchanged.
- Final review run captured **221 screens across 13 sizes**: 1440×900, 768×1024, 820×1180, 1024×768, 390×844, 320×568, 767×900, 1199×900, 1200×900, 820×400, 320×400, 999×900, and 1000×900.
- Captures include Staff catalogue/category/search/empty/cart, confirmation/cash/QR/validation/keyboard actions, empty/populated/searched history, details, void dialog/keyboard actions/Pending request, and Admin POS after role switching. Both preview roles entered and logged out at every size.
- Automated capture checks reported no browser/HTTP errors, page-level horizontal overflow, broken img elements, visible controls below 44px high, measured headings/table/product-title text below 12px, or horizontal dialog overflow. Tables intentionally scroll inside their wrappers. Sampled visual inspection covered desktop, portrait/landscape tablets, mobile/small mobile, short-screen keyboard actions, and the 1000px split layout. This is not a full Figma pixel-fidelity claim.
- Local script: `C:/Users/ASUS/Documents/Personal/Vertwell/.review/staff-review.mjs`; captures/results: `.review/frontend/staff/`, including `checks.json`. Uses repository Playwright, installed Edge, and its own temporary Vite server on port 5181.
- Physical devices, screen readers, Safari/Firefox, live authentication/payment/stock behavior, backend tests, deployment, and OS print output were not tested in this Staff phase. The remaining integration gaps below are separate work.

### Work saved

- Login, password visibility, recovery preview, role selection, responsive sidebar and mobile drawer.
- Dashboard category views, needs-attention cards, recent transactions, and nine-day charts derive from shared sample sales/stock. Today's totals exclude Pending/Voided sales. Historical fixtures remain dated August 20, so today's chart starts empty until a sample checkout.
- Inventory categories, expandable batches, stock receiving, and product creation with image upload; item codes persist in preview state, and fixed/percentage discounts apply in POS, receipts, and recorded sales. POS search supports name, SKU, and item code.
- POS search/filtering, cart controls, checkout confirmation, cash/change preview, and GCash reference validation.
- Sales history, details, and void dialogs; saved Staff void requests with owner approval/rejection, requester/reviewer timestamps, and retained original sales. Staff history uses preview cashier/shift IDs and Manila business dates.
- User management and a three-step account creation preview.
- Reports with date filters, sample revenue calculations, CSV export, and print-to-PDF.
- Local Figma artwork and bundled Poppins/Roboto fonts.
- Browser tests and README documentation.

Primary files:

| Path | Purpose |
| --- | --- |
| `Frontend/src/App.tsx` | Preview identity and shared in-memory state |
| `Frontend/src/components/Navigation.tsx` | Desktop sidebar, tablet rail, mobile top bar and modal drawer |
| `Frontend/src/navigation.css` | Fixed-size navigation controls and responsive navigation layouts |
| `Frontend/src/staff.css` | Staff-only POS, shift history, table, and dialog styling |
| `Frontend/tests/staff.spec.ts` | Staff totals/responsiveness, payment focus/validation, shift summaries and void review |
| `Frontend/src/admin.css` | Admin-only page, form, table, card, and dialog styling |
| `Frontend/tests/admin.spec.ts` | Responsive Admin usability, dialog keyboard/focus, and role isolation |
| `Frontend/src/auth.css` | Login, preview entry, and password-recovery responsive styling |
| `Frontend/src/data/demo.ts` | Typed inventory, products, accounts, and sales fixtures |
| `Frontend/src/components/ui.tsx` | Artwork, status badges, actions, native dialog wrapper |
| `Frontend/src/pages/` | Login, Dashboard, Inventory, Pos, SalesHistory, Users, Reports |
| `Frontend/src/frontend.css` | Tokens, layout, dashboard, inventory |
| `Frontend/src/screens.css` | Authentication, POS, history, users, reports, dialogs |
| `Frontend/src/responsive.css` | Mobile and print styles |
| `Frontend/public/assets/` | Original downloaded Figma assets |
| `Frontend/tests/frontend.spec.ts` | Ten browser interaction checks |
| `Frontend/tests/navigation.spec.ts` | Eight responsive navigation/keyboard/state checks |
| `Frontend/tests/login.spec.ts` | Three account-access/recovery/resizing checks |
| `Frontend/playwright.config.ts` | Edge on Windows, test server on port 5180 |
| `Frontend/tests/setup-server.ts` | In-process Vite startup/cleanup, avoiding Windows taskkill hangs |

Existing backend scaffold and authentication helpers remain in place. Normal configured Supabase login opens the sample Staff interface; business authorization is not implemented.

### Remaining work and known gaps

This older checklist is historical. Its Staff stock/approval and shift-policy descriptions are superseded by the latest priority checkpoints: shifts are out of scope, new paid Staff/Admin checkout consumes stock once, and Owner daily review is implemented in memory. Durable integration gaps remain separate.

1. Further visual fidelity work can compare remaining Figma variants, particularly portrait tablet layouts, user-management dialogs, and typography. Desktop/tablet/mobile layout review was sampled, not exhaustive pixel comparison.
2. Preserve tests/setup-server.ts for clean Windows test teardown. Port 5180 must be free; do not fall back to a shared or stale server.
3. Preview state still resets on refresh. Void requests retain the latest request/review in memory; they are not a durable request or audit event ledger. Staff sales remain Pending until a future approval workflow is implemented; pending sales do not count toward revenue.
4. Preview cashier and daily shift identifiers improve frontend filtering only. Configured Completed checkout validates recipes/modifiers and deducts stock in memory; Staff Pending checkout records requirements without deduction. Original unlinked fixtures cannot report actual usage. Cash/QR payments remain unverified simulations. The 12% VAT calculation remains the existing prototype behavior; different Figma variants show different VAT presentations and need a confirmed accounting policy before integration.
5. Supabase recovery can send a reset link when configured, but recovery callback handling and actual password updating are unfinished. Preview account passwords are not saved, and real accounts are not provisioned.
6. Unused artwork/stylesheet cleanup is now complete in the latest October 4 checkpoint. Original files remain in `Frontend/design-reference/` with a path/hash manifest; current assets and license notices remain in `public/assets`.
7. Backend integration is a separate phase: durable roles/shift policies, owner-created accounts, stock/recipe transactions, payment reconciliation, void approval, and audit records need implementation when requested.

### Repository state

No commit or deployment was made. README is modified; `.gitignore`, `Frontend/`, `backend/`, and root package files are untracked. The scaffold was already uncommitted when this work began. Preserve it and all current changes; do not reset, overwrite, or assume every untracked file was created in this frontend session. Do not expose environment secrets.

### Previous continuation script (historical; use the current checkpoint above)

```text
Resume from C:/Users/ASUS/Documents/Personal/Vertwell/repo only when the user requests.
The next highest priority is the coherent mock dataset: exactly five users
(one Owner, one Admin, three Staff), individually testable preview identities,
and every mock product configured with ingredients/recipes or finished-stock links.
Read that new priority section first. It is recorded but not implemented; the
114-test completed checkpoint below predates the mock-data changes.
Read HandsOff.md New/current-state, especially the latest October 4 completed
acceptance checkpoint and stop instruction, plus README.md and applicable AGENTS.md.
The user stopped after final validation and visual review completed; only documents
were saved afterward. No application source/test changes were needed in that resume.
Preserve all uncommitted scaffold files, exact Frontend capitalization, scoped
admin.css/staff.css, sample notices, licenses and the design-reference archive/manifest.
Stay frontend-only unless a new request expands scope. No backend work, provisioning,
commit or deployment is authorized by this handoff. No server was left running.

Final validation is COMPLETE: all six expanded priority cases passed (29.6s), root
npm run typecheck passed, npm run build --workspace Frontend passed, and the complete
npm run test:e2e --workspace Frontend passed all 114 cases (3.3m), clean exit.
Earlier interrupted runs and pause tasks below are historical, not pending work.
Keep tests/setup-server.ts and its test-owned port 5180 with in-process teardown.

Owner checkout completes immediately. New paid Staff/Admin sales await Owner review
and consume recorded stock once at checkout. Owner confirmation never deducts stock
again. Historical records remain unchanged. Staff history uses recorded cashier ID
and current Manila business date; shift management remains outside runtime scope.
Admin voids require no Owner approval, record the actual actor/role, and do not restore
stock or refund payments. Preserve role isolation and the in-memory sample notices.

The final attention CSS rule and expanded screen/Print assertions passed: six records
on page 1, five on page 2, disabled Next, filter reset to page 1 with CSV format retained,
and all 11 attention items/12 ingredient balances/21 ingredient rows visible for Print.
Recipe creation/checkout, Inventory scope/paging, Audit toggles/cross-page selections,
Owner review, Admin void/page clamping and calendar/responsive checks passed.
Modal bodies scroll with visible headers; the ingredient table uses its named scrollable
region and 720px screen minimum width, with full-width Print rules.

QA lives in C:/Users/ASUS/Documents/Personal/Vertwell/.review/, NOT repo/.review/.
Final captures: 20 static page views plus 48 priority-review.mjs views across 1440x900,
820x1180, 390x844, 320x568 and 820x400. Responsive visual review is complete for these
captured states, including ingredient columns, both attention pages, selection summaries,
short-screen dialogs/actions and all export scopes. Recorded checks have no page/dialog
horizontal overflow, clipped ingredient headings or browser/resource errors; headers are
visible in all 15 measured modal contexts. Long attention images are cropped from full-page
sources taken at scroll zero to avoid sticky-navigation screenshot stitching artifacts.

Final current-day PDFs: Combined 11 pages, Inventory usage 9, Sales 2. Matching Poppler
renders and all 22 PDF layouts were reviewed. verify-priority-pdfs.py passed scope,
per-page titles/date ranges/footers, all seven orders, all 28 ingredient rows and all
12 baseline disclosures in inventory scopes, PHP 1,058.40 paid Pending vs PHP 0.00
Completed, and remaining stock (13 buns/patties, 360g onions, 33 cheese slices).
review-checks.json/pdf-checks.json, CSV, PDFs, captures, pdf-renders, capture-sources
and inspection sheets are in .review/frontend/priority-feedback/.
priority-contact-sheets.py covers all 68 current UI captures and 22 PDF pages.
The read-only capture helpers now create matching final evidence and cleanly close their
browser/server. Both ports 5180/5181 were checked free at completion.

No frontend acceptance task remains from the latest pause. Start future work from the
user's next concrete request; do not replay completed checks without a new change/reason.
Do not rerun one-time resume-*.py/edit helpers. Durable receipts, stock/event ledgers,
real roles/accounts/recovery, payment reconciliation and backend integration need a
separately requested phase. Baseline percentages and historical closing stock remain
unavailable without verified opening balances and complete stock movements. Physical
devices, real screen readers, Safari/Firefox, OS printing, live authentication/payment
behavior and exhaustive Figma comparisons remain unverified.
New product images must use sourced existing photos or SVG/icons with retained
sources/licenses; never generate production product photos with AI.
```

## Old — implementation and validation history

Historical phase notes follow. Earlier test counts (10, 18, 21, 24) and Admin-only/Staff-deferred scope describe those phases; the New section above states the completed October 4 frontend acceptance and latest validation status. Local screenshots in these historical sections predate the Staff and hobby-icon updates.

### Login and recovery completed

- Redesigned `Frontend/src/pages/Login.tsx` and added `Frontend/src/auth.css`, imported after navigation styles. Removed the previous authentication rules from `screens.css` and `responsive.css`.
- Reused the original logo, bundled Poppins, charcoal, cream, gold, and restrained burgundy field icons. Buttons and fields now have consistent padding, visible labels, and keyboard-focus states. Password visibility uses a consistent line icon and updates its accessible name/pressed state.
- Widths **>=900px** use a split brand/form card; **480–899px** use a compact stacked card; **<480px** use a full-width stacked layout. Fields remain readable and all buttons/selects are at least 44px. The brand header stays compact across recovery stages; short screens scroll naturally.
- The prominent **Explore the preview** panel explains **No password needed**, offers Owner/Admin or Staff, and identifies sample data/reset behavior. It replaces the tiny fixed preview footer.
- Account login still calls the existing Supabase helper when configured. With no provider configured, submitting the form shows a plain explanation directing the user to Open preview. No default password or simulated authenticated account was added.
- Recovery preserves email/code/password validation, the sample code `123456`, matching-password checks, and field resets. Stage headings receive focus to announce navigation. Both recovery password fields can be shown/hidden together. Unconfigured recovery clearly states that no email/account change occurs; configured recovery offers **Send reset link**.
- Successful preview entry was checked for both roles: Owner/Admin opens Dashboard, Staff opens POS, and logout returns to the new login. Real business-role authorization and live recovery callback/password updating remain separate integration work.

### Login validation

- Root typecheck and frontend production build passed.
- Full browser suite: **21 passed**, clean exit (the previous 18 plus three login cases). After the final stacked-header CSS correction, a fresh build and all four login/recovery cases passed again.
- New `Frontend/tests/login.spec.ts` covers keyboard password visibility, account-login guidance, both preview roles and logout, recovery focus/code/password validation, field clearing, resizing, and short-screen preview access.
- Captured 72 login/recovery screens at 1440×900, 768×1024, 820×1180, 1024×768, 390×844, 320×568, 320×400, 899×900, and 900×900. Both preview roles entered and logged out at all nine sizes. The review script found no browser/HTTP errors, page-level overflow, broken img elements, failed preview entries, or buttons/selects below 44px.
- Visually inspected selected desktop/tablet/mobile login, recovery, validation-error, and completion captures. This is sampled visual review, not a full Figma fidelity claim. Live Supabase sign-in, real recovery, physical devices, screen readers, Safari/Firefox, backend tests, and deployment were not tested.
- Local screenshots/results: `C:/Users/ASUS/Documents/Personal/Vertwell/.review/frontend/login/`; script: `.review/login-review.mjs` (repository Playwright + installed Edge).

### Admin workspace completed October 3, 2026

During this earlier phase, the user narrowed the work to **Admin only**. Staff was left for the later phase documented above. Login and navigation retained their finished layouts and breakpoints.

- Added `Frontend/src/admin.css`, imported last, with styles scoped to `.admin-workspace`. App.tsx assigns that class only to Owner/Admin. All six destinations—Dashboard, Inventory, POS, Reports, Audit Trail, Users—now share stable typography, charcoal/cream/gold colors, white cards, lighter table borders, consistent spacing, and visible keyboard focus. Buttons are at least 44px high and inputs/selects at least 46px.
- Dashboard: compact heading/category controls, daily revenue card, readable stock/void metrics, attention/recent-sales cards, and a simple nine-day chart with date labels and a clear empty state. Calculations remain derived from the shared data.
- Inventory: live product/low-stock/expiry counts, category controls, sticky table headings, readable rows/batches/status pills, 44px receiving/expand actions, and a cleaner product form. Tables scroll inside their containers; forms use three, two, or one columns as space permits.
- Admin POS: clearer catalogue/search/filter controls and product cards with the original photos; current-order empty state, larger quantity controls, consistent totals/actions, and redesigned order/cash/QR dialogs. Cart, discounts, item-code search, VAT, and payment validation remain intact.
- Admin Audit Trail: readable search/date/void-request controls, selectable transaction rows, an order-selection empty state, and cleaner order/void/approval details. The narrow layout now contains its table correctly.
- Users: account initials, names/emails/roles, compact Manage actions, redesigned account/danger-zone dialogs, and a compact three-step wizard with visible labels. No real accounts or passwords are provisioned/saved.
- Reports: date/format controls, revenue metrics, payment split, readable transaction table, and export summary dialog. Existing CSV and browser-print behavior remain.
- In components/ui.tsx, **Admin dialogs only** focus their first editable field after opening and explicitly return focus to the opener on close. Native modality/Escape/backdrop behavior remains. Dialogs scroll on short screens without reducing field text.
- In this earlier phase, shared POS/history additions were conditional on the Admin role. Staff retained its previous presentation and dialog behavior until the later Staff phase above. No backend integration, service provisioning, deployment, or commit was performed.

### Admin validation

- Final root typecheck and fresh frontend production build passed.
- Final complete browser suite: **24 passed**, clean exit. All 21 existing tests remain; three cases in `Frontend/tests/admin.spec.ts` cover four-width readability/touch targets/table containment, short-screen dialog keyboard access/focus restoration, and Admin-to-Staff presentation isolation. `tests/setup-server.ts` remains unchanged.
- Final capture/geometry results are recorded in `C:/Users/ASUS/Documents/Personal/Vertwell/.review/frontend/admin/checks.json`; script: `.review/admin-review.mjs`, using repository Playwright, installed Edge, and its own temporary Vite server on port 5181.
- Final capture run: **234 screens**, with no browser/HTTP errors, page-level horizontal overflow, broken images, controls below 44px, or heading/table text below 12px in the measured views. Visual inspection is sampled; geometry checks are automated across the captured views.
- Captures cover all six Admin destinations, dashboard categories, product creation/stock receiving, cart/order/cash/QR, audit details/empty/void/approval, account management/all wizard stages, long account names/emails, and print-media report layouts. Screen sizes: 1440×900, 768×1024, 820×1180, 1024×768, 390×844, 320×568, 767×900, 1199×900, 1200×900, and 820×400. Print-media previews use an 816×1056 page viewport.
- Both roles were entered and logged out at all ten screen sizes as regression checks. Sampled visual inspection covers all six destinations, desktop/portrait/landscape tablets/mobile, dialogs, and short screens. Full Figma pixel fidelity, physical-device/screen-reader/Safari/Firefox checks, live authentication/payment/stock policies, backend tests, and actual OS print output are unverified.

### Navigation completed previously

- `Frontend/src/components/Navigation.tsx` contains navigation and the modal drawer. `App.tsx` continues to own preview identity, page selection, cart, and shared data.
- `Frontend/src/navigation.css` provides fixed-size controls, consistent line icons, compact rows, cream/gold active states, and hover, pressed, and keyboard-focus states. It is imported after the existing responsive styles. The old sidebar and 37px mobile rail rules were removed.
- Desktop **>=1200px**: a 256px sticky sidebar with original logo/brand artwork and account/logout toward the bottom. It scrolls on short screens; long names and labels wrap.
- Tablet **768–1199px**: an 80px rail with direct destination access, keyboard/pointer tooltips, and triggers for the expanded labeled drawer. Rail scrolling supports short screens.
- Mobile **<768px**: a sticky top bar with a 48px menu button, original logo, current page, and sample-data label; no permanent narrow rail.
- Drawer: native modal dialog, initial close-button focus, explicit Tab/Shift+Tab wrapping, Escape/backdrop closing, return focus to its actual opener, background modality, body scroll lock with cleanup, scrolling, and safe-area padding. Changing navigation layout closes the drawer. Controls are at least 44px; reduced-motion preferences are respected.
- Sample-data labels remain visible in navigation. The full notice sits in normal page flow and cannot cover controls.
- Owner/Admin and Staff destinations, logout/role switching, cart preservation on page changes, checkout, discounts, void requests, inventory, dashboard, and reporting were preserved.

### Navigation validation completed previously

- Root `npm run typecheck` and `npm run build --workspace Frontend` passed before and after implementation.
- `npm run test:e2e --workspace Frontend`: **18 passed**, clean runner exit. The original ten tests were retained; eight focused navigation cases were added in `Frontend/tests/navigation.spec.ts`.
- After the final sample-label styling, root typecheck/build and all eight navigation cases passed again.
- The in-process Vite setup in `Frontend/tests/setup-server.ts` was preserved. Port 5180 must be free for tests.
- Captured **68** screens, covering all six Owner/Admin pages, checkout dialogs, drawer/account scrolling, Staff navigation, and temporary DOM stress checks for long labels/names.
- Dimensions: 1440×900, 768×1024, 820×1180, 1024×768, 390×844, 320×568, 767×900, 1199×900, 1200×900, and 820×400.
- The review script reported no browser/HTTP errors, page-level horizontal overflow, or broken img elements in its 65 measured captures. Mobile tables intentionally scroll within their wrappers.
- Visually inspected selected final screens spanning all six destinations, desktop/tablet/mobile navigation, short-screen drawers, long names/labels, and checkout. Full Figma pixel fidelity is not claimed.

Local artifacts (outside the repository):

- `C:/Users/ASUS/Documents/Personal/Vertwell/.review/frontend/navigation/`
- `checks.json` records geometry/assets/errors.
- `.review/navigation-review.mjs` is the local capture script, using repository Playwright and installed Microsoft Edge.

### Original frontend continuation validation

- Root npm run typecheck passed for frontend and backend.
- Fresh frontend production build passed.
- All ten Playwright cases passed with a clean runner exit, including recovery at three widths, staff-to-owner void approval, and fixed/percentage discounted product checkout through dashboard/reports.
- Windows cleanup hang reproduced with both npm and direct Vite subprocess commands. Playwright uses taskkill for that webServer teardown. The test setup now creates Vite in the runner and returns server.close() as teardown; the seven original cases and all added cases exit cleanly.
- Captured 48 screens at 1440×900, 1024×768, and 390×844, covering six pages, recovery stages, product creation, stock/account/payment/report dialogs, and audit details. No browser/HTTP errors or page-level horizontal overflow. Tables intentionally scroll horizontally on small screens.
- Visually inspected selected desktop/tablet/mobile captures; corrected recovery icon selectors, recovery input reuse, QR button overlap, chart empty state, and mobile chart caption size. Compared dashboard, recovery code field, and checkout artwork to Figma. Full pixel-level fidelity across every Figma variant remains unverified.
- All 62 referenced local raster/SVG assets exist and are non-empty. The corrected checkout QR icon is stored as Frontend/public/assets/1c129.svg.
- Backend tests, full root build, live authentication, and deployment were not run in this continuation.

Local review artifacts are outside the repository at `C:\Users\ASUS\Documents\Personal\Vertwell\.review\frontend\`. The smoke script is `.review\frontend-check.mjs`; it uses a machine-specific bundled Playwright path. These are local review aids, not portable project tooling. Latest captures and geometry/HTTP checks are in .review/frontend/continuation/; the continuation-review.mjs script uses the repository's Playwright dependency.

Commands from the repository root:

```powershell
npm install
npm run typecheck
npm run build --workspace Frontend
npm run test:e2e --workspace Frontend
```

