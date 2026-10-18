# P5 protected Users and Inventory — October 17, 2026

P6 is now accepted in hosted development on top of the accepted P5 boundary. Its
checkout command joins the same account/catalogue locks and inventory revision,
so an old physical-count draft cannot overwrite sold stock. The protected POS
opens only after database activation. The user has since requested activation
for use; checkout is now enabled and P7 hosted acceptance passes.
See [CHECKOUT.md](CHECKOUT.md). Existing P5 evidence below is historical and intact.

Implementation is local and the reviewed P5 migration is applied in hosted
development. The user explicitly answered "Approve P5 migration and verification
on this exact project" for DualCounter `izdemgzdywtxhvgvsian`, resolving the
historical automatic approval rejection. The exact-target tool applied only
`20261017050000_inventory_commands.sql`. Real browser/PostgREST acceptance found
two issues repaired by new applied migrations: `20261017060000_inventory_revision_scope.sql`
scopes the singleton UPDATE for safe-update, and
`20261017070000_nonretryable_business_conflicts.sql` replaces only deliberate
business-conflict SQLSTATEs with PT409. PostgREST 14 retried 40001 indefinitely.
All nine applied sources are immutable. Real browser/Auth/API/Storage persistence,
role restrictions, failure rollback and inventory contention/retry acceptance now
pass; HandsOff.md records exact coverage and final hosted checks. Backend changes
stay local and off GitHub. Retain both original Owners unchanged and keep the
user-requested Jestine Admin / Jest and Aquino Staff / Aquino accounts active.

## Management boundary

Every read and mutation uses the caller-token Supabase client. SQL resolves the
current active profile again; Owner/Admin manage inventory, Owner manages all
accounts, Admin manages Staff, and Staff has no management access. No public table
write grants, management SELECT grants or service-role business access are added.
The private helpers have an empty search path and no application EXECUTE grants.
Only the existing role helper remains callable for RLS.

Four additional authenticated RPCs provide `read_inventory`, `inventory_command`,
`read_managed_accounts`, and `account_provisioning_result`. The account-list RPC
joins Auth email to profiles in one statement. Admin sees Staff plus its own
identity; only Staff accounts are writable. Passwords never enter these rows.
Existing P3 last-active-Owner, signed-in-account and revision protections remain.
The applied `20261017195000_retired_accounts.sql` adds trusted retirement of
inactive development accounts. `private.retired_accounts` records the identity,
time, database administrator and reason without changing its Auth/profile or
historical rows. Account locks serialize retirement with account/workflow changes;
retired profiles and retirement evidence cannot be edited through application
roles. `read_managed_accounts()` omits retired identities in SQL; ordinary inactive
accounts remain visible. The eight exact P6 fixture IDs were retired after checking
their evidence, inactivity and zero sessions. No name-prefix filter or profile
hard deletion was added.
The wizard now creates actual accounts with operator-supplied initial passwords.
It sends no invitation or verification email. Email remains read-only in Manage;
email-change/invitation workflows require their own confirmed-identity flow.

`private.account_operations` records only operation IDs, creator/target IDs and
noncredential account details. A provisioning trigger writes its receipt inside
Auth's profile/audit transaction. Retrying the same creation can reconcile its
original result; another creator or changed details cannot claim that result.
No password or derived password hash is recorded in operation receipts or metadata.
Profile updates return their authoritative revision; ambiguous lost responses are
reconciled against the authorized account list before the draft is discarded.

## Inventory reads and aggregate commands

`GET /api/inventory` returns one versioned PostgreSQL snapshot containing all twelve
catalogue/stock tables, every batch balance, a global revision and trusted latest
edit attribution. Numeric columns and SUM results are text before JSON encoding.
The snapshot includes archived relationship targets for resolution; display mapping
excludes archived records. There is no truncated multi-request SDK join or sample
fallback. SKU and UUID remain separate; Item Code is absent.

`POST /api/inventory/commands` accepts:

```text
{ operationId: UUID, revision: decimal-integer-string, kind, reason, record, stock?, stockAction? }
```

Kinds are `product.save`, `stock.save`, `library.save`, `product.archive`,
`stock.archive` and `library.archive`. Archive records contain only `id`.
`stock` is accepted only with a Retail Item product save. Stock saves explicitly
select `correct`, `receive` or `remove`; receiving cannot overwrite/remove an
existing batch, and removal cannot increase stock or create a batch. The frontend serializer
selects writable fields; SQL independently rejects unknown/missing fields at every
nested level, malformed decimal scale, fractional counted units, invalid dates,
duplicate/foreign configuration IDs and inconsistent relationships.

Commands lock accounts first and the catalogue second, recheck the current actor,
and compare the snapshot revision in the transaction that makes the actual changes.
This deliberately coarse revision rejects a save after any other inventory command;
it prevents a stale batch correction from overwriting a receipt. Refresh after
discarding/reviewing a conflict, then reopen the record. It is not per-field merging.
Deliberate conflicts raise **PT409**, mapped to HTTP 409 by PostgREST and Express.
Do not substitute 40001: the hosted PostgREST 14 transaction runner retries it.
Generated SKUs are reserved under the same catalogue lock, include archived codes,
and use IN/PRR/PRC/PRV/PRB plus FD/BV/HB and four digits. Stable internal IDs preserve
links and movement/receipt history through SKU edits.

Product saves include recipes, variants, modifier groups/options/stock inputs and
bundle configurations in one transaction. All four stock models remain distinct.
Library attachments have new IDs and retain their source reference; library changes
do not propagate into product copies. Signed ingredient omissions, modifier choice
limits/defaults, fixed bundle choices, nested bundles, duplicate configurations,
ownership and cycles are checked. Manual product/variant enablement stays separate from computed availability;
disabling a child makes its containing bundle unavailable. Removing a fixed option, variant or product that
an active bundle uses is rejected. Removed variant/group/option records are archived;
receipt snapshots and references survive. Changing away from a shared Retail SKU
requires a distinct product SKU because the old physical stock keeps its identity.

Stock has no writable total-quantity column. The command compares exact canonical
per-batch targets to the movement ledger. New stock gets explicit Opening coverage;
new receipts on existing stock get zero Opening coverage plus a Receipt movement.
Physical-count changes append Correction differences. Batch/record removal appends
Removal movements and archives only after the balance is zero. All movements derive
the real actor/name/role and current business time; audit and command receipts commit
together. Failed validation, dependencies, stale revisions, permission checks or audit
inserts roll back stock, configuration, SKU reservations, revision and operation receipt.

`private.inventory_operations` stores the original noncredential command and entity
ID. An identical retry by its creator returns the original outcome and the current
snapshot; it cannot apply the stock change twice. Different content or another actor
cannot reuse the key. The browser retains operation/batch IDs after ambiguous errors
and never automatically retries a write. Closing and reopening an editor is a new
intent; refresh/review the authoritative result before recreating an uncertain action.

## Optional images and UI behavior

The migration creates the private `inventory-images` Storage bucket with PNG/JPEG/
WebP and a 2 MB limit. Authenticated active Owners/Admins may read/sign images and
insert immutable objects in their own UUID folder. No update/delete policy is added;
old image references remain recoverable. `POST /api/inventory/images` also checks
the file signature, and uses the caller token. `POST /api/inventory/image-urls`
returns bounded batches of one-hour signed URLs. SQL verifies that a referenced
object exists. No image is required. Unattached uploads are retained; no speculative
cleanup deletes an image that an uncertain save may have committed.

Configured login opens Inventory/Users for managers and a clear pending POS screen
for Staff. Checkout/reviews/reports remain deferred. Preview stays explicitly separate.
Existing filters, searches, stock tables and editors are reused. Receiving and stock
edits/removals require reasons. Saves disable duplicate submissions and keep fields,
files, wizard passwords and library drafts after failure. Navigation/logout and
refresh protection cover unsaved inventory/account work. Background profile checks
do not unmount an unchanged authenticated editor. Actual access loss closes the
workspace; role changes reset its data scope.

## Verification and limits

`npm test` includes real SQL scenarios for all stock models, scoped account reads,
ID/decimal/date/default/dependency validation, once-only receipt retries, archival,
canonical units, account operation recovery, role changes and audit failure rollback.
A separate disk test saves through the new command, closes PostgreSQL and verifies
the complete snapshot after reopening. The browser management suite uses actual
Express routes and PostgreSQL commands behind test-owned Auth/Storage transports;
it checks refresh/login/another Admin session, rejected drafts, lost responses,
account creation/update/deactivation, independent library copies and optional images.
These local transports are not hosted Auth, email delivery or Storage acceptance.

The approved migration was applied with the exact-target command; the following
hosted verification commands all pass:

```powershell
npm run db:apply --workspace backend -- --project-ref izdemgzdywtxhvgvsian
npm run db:verify --workspace backend
npm run inventory:verify --workspace backend
npm run permissions:verify --workspace backend
npm run db:smoke --workspace backend
```

`inventory:verify` verifies the private bucket/policy metadata and runs the same
SQL scenarios in rolled-back transactions. It compares all public/private table
counts, real Auth/profile/settings fingerprints, revision and grants before/after.
It does not log in, password-test, demote or deactivate either retained real Owner,
create real Auth users, send mail, upload real objects or leave durable fixture rows.
The final hosted regression sequence includes **15 inventory scenarios, 11
permission scenarios and 12 database smoke checks**, plus schema/grant/hash
verification. Each rolled-back SQL checker preserves its before/after real
accounts/settings/counts; consult HandsOff.md for the final recorded outcome.
Five actual anonymous PostgREST checks also confirm permission denial for the
four new P5 RPCs and direct product SELECT. A fresh generated-schema check passes.
Separate real acceptance created the user-requested Admin/Staff accounts, left
both active, and verified actual account lifecycle/denials. Owner browser saves
survive refresh and a separate real Admin login. Hosted APIs cover all four
stock models, independent library copies, images, invalid/denied rollback,
logout/login, two-session revision contention and concurrent identical receipt
replay. Both original Owner credential/profile fingerprints and settings remain
unchanged. Acceptance sessions were signed out without globally revoking the
user's Owner browser session. Labeled catalogue fixtures were archived and all
batch balances are zero; movement/audit/operation/configuration history and one
private PNG are intentionally retained. No invitation email was sent.
Browser control was disabled mid-acceptance; the later live API checks used
actual Express source and hosted services without mocked transports. No new
whole browser-suite, physical-device or full-cart contention result is claimed.
The P5 tests above do not establish full-cart contention or pricing guarantees.
Separate P6 hosted/caller-token/concurrent acceptance now passes; see CHECKOUT.md.
P7–P9 remain later work.

Implementation references: [Supabase functions](https://supabase.com/docs/guides/database/functions),
[private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals),
[Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
