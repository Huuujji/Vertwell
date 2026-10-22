# P6 atomic checkout — October 17, 2026

**October 22 Task 3:** bounded client observations report uncertain checkout and
receipt reconciliation without command/payment contents or account IDs. They do
not retry or authorize a business command; the original exact-operation recovery
and once-only deduction remain unchanged. See [OPERATIONS.md](OPERATIONS.md) for
operator response and the distinction between an HTTP failure and rollback.

**Current development scope (October 21, 2026):** P1–P9 and the newest frontend-priority implementation are complete within their recorded scopes on DualCounter, with eighteen immutable applied migrations and checkout enabled. The application now requires an account; old preview references and phase-specific counts below are historical. The Project Manager selected the seven final recommendations; see [release readiness and current acceptance](RELEASE_READINESS.md), [frontend-priority contract](FRONTEND_PRIORITY.md) and [HandsOff.md](../../HandsOff.md) for current evidence, browser permission and remaining dependencies. Keep the sample QR; actual shop QR/payment trial remains deferred. GitHub release/public deployment is not yet complete.

## October 18 stock-feedback acceptance — historical checkpoint

The user-approved `20261018020000_pos_stock_feedback.sql` adds two read-only
POS projections on DualCounter. All fifteen applied migration sources are now
immutable. `read_checkout_catalogue_stock` retains the existing catalogue and adds
linked retail availability; `read_checkout_stock` returns only stock referenced
by valid, enabled POS configurations, with usable, needed and remaining quantities
and whole-cart quantity limits. Expired/unsellable batches are excluded through
the existing checkout rules. No costs, batch records, unrelated inventory, direct
table grants or mutation permissions are exposed.

`POST /api/pos/stock` forwards the authenticated caller's token. Owner, Admin and
Staff share the established stock-selection rows and cart presentation. Feedback
refreshes on private catalogue events, preserves drafts and disables increments
at current limits. Feedback is advisory: Add/Update/Pay still obtain authoritative
quotes, and checkout retains its original atomic validation, tax, revision and
operation-recovery behavior. No stock is reserved or deducted by a feedback read.

The new migration changes no existing function or business row. The protected
catalogue endpoint uses its wrapper; existing catalogue/RPC callers remain valid.
See HandsOff.md for approval, hosted/disposable verification and evidence limits.

## Previous P6 checkpoint

**P6 is accepted in hosted development. Checkout is now enabled for the user's
own testing by their later explicit request.** P7 hosted acceptance also passes;
the earlier disabled-window state below is historical. P6 test accounts are
retired from Users with linked history retained. Leave checkout enabled unless
the user requests otherwise.

The user explicitly approved the reviewed
migration and verification on DualCounter `izdemgzdywtxhvgvsian`, then separately
approved temporary test activation followed by disablement. The migration is
applied and all ten hosted migration hashes match. **Checkout is disabled again
as requested.** P7 reviews/voids are next; P8/P9 remain later work. Keep Backend
changes local; no commit, push, PR, GitHub save or deployment.

Prior local acceptance passed **106/106 root tests**, both typechecks/builds and schema
equality, plus **26/26 scoped browser tests** (seven checkout, nine management,
ten authentication; 1.3 minutes). Screens at 1440×900, 820×400 and 320×568 have
no measured page overflow; selected cards/payment captures were visually reviewed.
Those browser tests use test-owned Auth/Storage transports. They were not rerun
for this hosted acceptance; no new hosted browser or physical-device claim is made.

The earlier automatic approval rejection was resolved by the user's exact-project
approval. `db:apply` applied only the new P6 source, preserving the nine earlier
hashes. All ten applied sources are now immutable. The P6 migration hash is
`dfbe81cbe9d8817be5880e8f9048c016a4dc5ab5ec1ab40d1559d81cfd74ca9a`.

Real Express/Auth/PostgREST/Storage verification passes ten acceptance groups.
Owner/Admin/Staff checkout, purchased receipt persistence in another real Auth
session after catalogue edits, actor/content-bound replay, Staff ownership,
private POS image access, all four stock models, unit conversion, GCash reference
uniqueness and disabled-service reconciliation were verified without mock
transports or service-role business writes.

Three concurrent tests each observed **two actual PostgREST requests waiting on
the exact account advisory lock** before releasing it. Identical commands return
one receipt and one replay; competing seven-of-ten orders produce one success
and one 409 with three pieces left; checkout versus count correction produces
one success and one 409 with one revision change. Sale/payment/item/usage/movement/
operation counts establish once-only commits and no losing-command residue.

The first live pass completed three real sales before its test lock monitor
missed waiting requests and let them time out. Teardown disabled checkout and
archived/deactivated its fixtures. The corrected pass succeeded. History from
both passes is intentional: 11 sales/payments remain, identified by `P6 Acceptance`
cashier/product names. Eight generated test accounts are inactive; the four
original accounts remain active and unchanged. All test products/stock are
archived with zero balances. Test passwords/tokens were process-only. Final
cleanup of each test Owner used narrowly scoped trusted administration because
the application correctly rejects self-deactivation; normal stock/sales commands
all used real caller tokens. No retained Owner was signed in or password-tested.

Evidence is workspace-parent `.review/october-17-p6-{acceptance-*,live.mts,
live.json,live-lock-monitor-failed.json,final-*}`. The original local browser
captures and acceptance evidence remain historical and intact.

## Transaction and authorization

`20261017135332_atomic_checkout.sql` adds five authenticated public RPCs:
`read_checkout_catalogue`, `check_checkout_product`, `quote_checkout`, `checkout`, `read_checkout_receipt`.
It preserves the nine applied migration sources and every existing public table
grant/policy. No table writes or management reads are granted. A new private
checkout-operation table has no application grants. One read-only private helper
and a Storage SELECT policy let active POS users sign only images referenced by
currently enabled, unarchived products; archived/unattached images remain closed
to Staff. Existing manager image access is preserved.

The private activation singleton starts **disabled**. Applying the migration does
not enable hosted checkout. Application roles cannot change it. After acceptance,
the exact-project administration command can activate it; `--disable` closes new
sales while committed operation replay remains available. Do not activate merely
because local tests pass. Test fixtures enable it only in disposable/rolled-back
transactions. The CLI generated the new filename; its UTC timestamp was converted
to Manila time so it sorts after the nine frozen sources.

All requests use the caller-token database client. The transaction locks accounts
first, re-resolves the active profile, joins P5's catalogue advisory lock, locks
the singleton inventory revision and acquires affected batch locks in UUID order.
Checkout is deliberately serialized with account/catalogue/count-correction
commands. It increments the revision using an explicit `WHERE singleton`.
Deliberate conflicts use PT409, never PostgREST-retryable 40001.

The server resolves active product/variant/option ownership and choice limits,
recurses through fixed/nested bundles, converts stock to canonical units and
clamps signed omissions within each configured unit before multiplying its
quantity. One line cannot cancel another line's demand. Fixed Retail/Variant/
Bundle units cannot be omitted. Every cart line participates in the shared
demand check. Expired, unsellable and archived stock is excluded. Allocation
uses expiry first (undated last), then receipt time and batch ID.

Prices, selected modifier prices, fixed/percentage discounts, per-unit cent
rounding and the existing 12% VAT calculation are authoritative SQL numeric
arithmetic. The quote's fingerprint covers purchased configuration/usage,
prices and Manila business date; its inventory revision is checked separately.
A quote is a review checkpoint, not a stock reservation. Changed catalogue,
stock or business date requires another quote and review.

One transaction saves the sale, purchased item/modifier/configuration/usage
snapshots, payment, consumption movements, movement audits, final sale audit,
revision and immutable operation receipt. Any failure rolls everything back.
Owner sales complete immediately. Paid/fulfilled Admin/Staff sales consume once
and remain Pending / Awaiting Owner review. P7 review must never consume again;
voids must not infer a stock return or payment refund.

## HTTP and command contract

| Route | Purpose |
| --- | --- |
| `GET /api/pos/checkout-catalogue?offset=0&limit=100` | Scoped selling/configuration projection, discounted ranges and computed card availability. No recipes, stock-input quantities, batch records, physical balances or library drafts. |
| `POST /api/pos/image-urls` | Caller-scoped signing of up to 100 permitted image paths. |
| `POST /api/pos/quote` | `{lines}` → authoritative totals, purchased display lines, revision and quoteToken. No writes. |
| `POST /api/pos/availability` | Check whether a product has a feasible configuration alongside the whole current cart before opening options. |
| `POST /api/checkout` | One atomic checkout command. |
| `GET /api/sales/:id/receipt` | Immutable P6 purchased receipt, under the existing sale ownership/date permission. |

A cart line is `{productId,variantId,modifierIds,quantity}`. UUIDs identify choices;
quantity is a positive whole decimal string (1–10,000). A cart has 1–100 lines.
Client prices, identities, status, stock usage and unknown fields are rejected.

```text
{ operationId: UUID, revision: integer-string, quoteToken: SHA256,
  lines: [...],
  payment: { method: "Cash", amount: decimal-string, cashTendered: decimal-string }
        OR { method: "GCash", amount: decimal-string, reference: 13-digit-string } }
```

Payment must equal the recomputed total. Cash tender must cover it; SQL derives
change. GCash references are unique recorded evidence across sales, including
voided records. Neither reference entry nor this command verifies a payment
provider. The shared form displays the replaceable sample QR; it cannot establish
a real payment. The cashier checks received payment and records its reference.
The actual shop image/trial is deferred at the user's choice; provider API integration is not required.

An operation is bound to its actor and exact JSON command. Exact retries return
the stored receipt before stale-revision validation, without another deduction,
payment, audit or revision increment. Different content/actor receives conflict.
Receipt reads/replays also enforce Staff's own-current-Manila-day boundary.
Original receipts retain purchase-time names/prices/configurations through edits.
Readable order numbers use the Manila date plus a unique full UUID suffix;
they are separate from internal sale IDs.

## Frontend behavior

The existing protected workspace offers POS to all roles when the applied
`business_access` contract advertises checkout. A missing migration leaves the
live service closed. Preview remains separate and unchanged. The live POS uses
the established catalogue/order/modal styles, category/SKU search, variant and
modifier controls, fixed bundle disclosure, editable quantities, exact quoted
totals, Cash/GCash dialogs and scoped recorded-sales/receipt retrieval.

Adding/changing a cart line validates a whole-cart server quote. Failed changes
keep the previous cart and entered configuration. Defaults are preselected only
if the proposed whole cart quotes successfully. Card availability explores up to
4,096 configurations with at most twelve total options; larger/unresolved spaces
are explicitly labeled "Choose options to check availability", rather than
inventing availability or freezing the browser. Exact chosen configurations
still use the full server resolver. Multi-page catalogue loading requires the
same revision and business date on every page.

Pending controls suppress duplicate submits. Before sending payment the browser
stores the exact command and quote in account-scoped session storage, without a
token or password. A lost/server/malformed response keeps the cart, payment and
operation. Refresh restores the same retry; navigation to another order is
blocked until its outcome is resolved. A definite first-attempt validation or
conflict retains the draft and offers a fresh quote/review. A later failed replay
never erases an earlier uncertain outcome. Cart state survives manager page
navigation; refresh protection warns while the cart is open. Closing a browser
tab clears session storage by browser design; consult recorded sales before
recreating an uncertain checkout after closing the tab. Cross-tab inventory
changes are caught at quote/checkout; this is not P9 push synchronization.

## Verification

`npm test` runs shared checkout SQL scenarios plus a committed disk close/reopen
test. The SQL cases cover roles, denial, oversell aggregation, FEFO/excluded stock,
recipe conversion/omissions, variants/fixed/nested bundles, exact pricing/VAT,
stale revisions, actor/content-bound replay, payment validation/reference
uniqueness and injected final-audit rollback. The browser checkout suite uses
actual Express/SQL behind test-owned Auth/Storage transports; it checks persistent
receipts, role/status isolation, retained drafts, lost-response refresh/replay,
manager navigation and desktop/short-tablet/small-phone containment.

Hosted regression commands:

The final hosted rerun passes checkout **16/16**, inventory **15/15**, permissions
**11/11**, database smoke **12/12**, and schema/hash/grant/policy/index verification.
Independent final state checks confirm four unchanged active retained accounts,
eight inactive test accounts, zero test Auth sessions, nine archived test products,
seven archived test stock items with zero balances, one retained private image,
11 sales/payments/checkout receipts, 41 movements, 144 audits and inventory revision
62. No active/stuck checkout or inventory requests remain.

```powershell
npm run db:verify --workspace backend
npm run checkout:verify --workspace backend
npm run inventory:verify --workspace backend
npm run permissions:verify --workspace backend
npm run db:smoke --workspace backend
```

The separately reviewed activation command is
`npm run checkout:activate --workspace backend -- --project-ref izdemgzdywtxhvgvsian --enable`.
It verifies every migration hash and uses the account/catalogue lock order; it
does not change accounts or stock. Use `--disable` to close new checkout again.
The original P6 test window temporarily enabled checkout and ended disabled.
The later explicit request to leave checkout enabled was implemented and verified;
keep it enabled for the user's current use. Activation is an administration
operation, not an action automatically performed by ordinary verification commands.

`checkout:verify` runs each shared scenario in a rolled-back transaction and
compares all public/private counts, protected Auth/profile/settings fingerprints,
revision, receipts, grants and Storage policies before/after. It does not sign in
or edit retained real users, seed durable sales, or establish simultaneous
connection contention. Those claims require separately recorded real acceptance.
Keep both original Owners and the requested Jestine/Aquino accounts unchanged.

Implementation references: [PostgreSQL locking](https://www.postgresql.org/docs/17/explicit-locking.html),
[Supabase database functions](https://supabase.com/docs/guides/database/functions).
