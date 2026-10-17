# P5 protected Users and Inventory — October 17, 2026

Implementation is local and the reviewed P5 migration is applied in hosted
development. The user explicitly answered "Approve P5 migration and verification
on this exact project" for DualCounter `izdemgzdywtxhvgvsian`, resolving the
historical automatic approval rejection. The exact-target tool applied only
`20261017050000_inventory_commands.sql`; all seven applied hashes match and
sources are now immutable. Hosted SQL checks pass; real signed-in browser/
PostgREST/image persistence acceptance remains pending in HandsOff.md.
Do not infer that acceptance from local transports or rolled-back SQL scenarios.
Backend work remains uncommitted and off GitHub until the full Backend task list
is finished. Retain both real Owners.

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
Hosted acceptance currently records **14/14 inventory scenarios, 11/11 permission
scenarios and 12/12 database smoke checks**, plus schema/grant/hash verification.
An independent pre/post comparison confirms both retained Auth/profile Owners,
settings and all existing public/Auth table counts are unchanged. No real Auth
users, catalogue records, movements or image objects were created by these checks.
Five actual anonymous PostgREST checks also confirm permission denial for the
four new P5 RPCs and direct product SELECT. A fresh generated-schema check passes.
Simultaneous multi-connection writes and real signed-in hosted browser/PostgREST/
Storage round trips remain unverified. P6–P9 are not implemented here. P6 must join the account/catalogue lock and
inventory-revision discipline before enabling checkout; P5 tests do not establish
full-cart contention or pricing guarantees.

Implementation references: [Supabase functions](https://supabase.com/docs/guides/database/functions),
[private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals),
[Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
