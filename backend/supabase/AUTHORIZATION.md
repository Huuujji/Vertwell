# P4 business permissions — October 17, 2026

**P4 is accepted: implemented locally, applied and verified in hosted development.** The user explicitly
approved this P4 migration and its verification on DualCounter
(`izdemgzdywtxhvgvsian`), resolving the earlier automatic approval rejection.
The existing exact-target migration tool applied only the sixth migration;
the five earlier applied sources remain unchanged. All 11 hosted permission
scenarios and 12 database smoke checks pass. Final private fingerprints and
every table count confirm both retained real Owner accounts and settings are
unchanged. P5 protected Users/Inventory is now accepted; see CRUD.md and
HandsOff.md for nine immutable sources, additional narrow RPCs and real
browser/Auth/API/Storage acceptance. PT409 represents deliberate business
conflicts; 40001 is reserved for genuine database serialization failures.
No GitHub save, commit, push, PR or deployment is authorized for unfinished Backend.

## Trusted identity and role matrix

`requireAuth` verifies the access token with Supabase Auth and resolves the current
active database profile; its ID must match the verified Auth user. The new
`requirePermission` calls caller-scoped `authorize_business_action(...)` for
business operations. SQL owns the matrix and reads the current profile every
operation. JWT role metadata, names, dates, actor fields and frontend permissions
never authorize an action. Changed roles/deactivation take effect on the next
operation even with the same access token. Existing P3 account commands retain
their own in-transaction authorization and protections; they do not depend on
the new migration just to continue operating.

| Action | Owner | Admin | Staff |
| --- | --- | --- | --- |
| Dashboard, reports, inventory management | Yes | Yes | No |
| Alert settings read/write | Yes | No | No |
| POS catalogue / future checkout | Yes | Yes | Yes |
| Sales and requests | Business scope | Business scope | Own current Manila-day sales and own requests on those sales |
| Direct void / request decision | Own identity | Own identity, no Owner password | No |
| Submit void request | Yes | Yes | Eligible own current-day sale |
| Confirm Daily Sales Review | Yes | No | No |
| Account management | All roles | Staff only | No |

`authorize_business_action` is a permission check, **not a business mutation**.
Sale-specific checks require an actual permitted sale, reject already-voided
targets for void commands, and do not disclose whether inaccessible IDs exist.
Later P5–P7 mutations must recheck permissions while holding the account lock
inside the transaction that performs their actual work and writes audit evidence.
No standalone permission check can authorize a later transaction indefinitely.

## Database boundary

Applied `20261017040000_business_permissions.sql` follows the five immutable
applied migrations. It adds one authenticated SELECT policy to each of the 25
tables, but opens direct SELECT for **only six**: sales, sale items, purchased
modifiers, payments, void requests and alert settings. No table receives a write
grant or write policy. Anonymous and service-role business table access stays
revoked. Management, profile and ledger table grants stay closed for later services.

Policies check the active database role; Staff sale-child policies follow the
visible parent sale. Staff cannot select someone else's sale or a sale before or
after the current Asia/Manila day, including across UTC midnight. Requests also
require the signed-in requester. Physical stock and purchased stock-usage details
remain management-only; account policies limit Admin to Staff and their own
profile. Admin audit policies exclude alert settings and other privileged account
changes. Full Dashboard/report aggregates remain later services.

The only callable private helper is `private.business_role()`, returning the
caller's current active role. It has no caller-supplied ID and cannot mutate data.
Private-schema USAGE allows its policy evaluation, not access to the other helpers.
Five new public RPCs are authenticated-only: `business_access`,
`authorize_business_action`, `read_business_sales`, `read_pos_catalogue`, and
`update_alert_settings`. The existing three P3 RPC grants remain unchanged.

`read_business_sales` runs as the **invoker**, so its table reads obey the same
RLS as direct Supabase access. It omits request hashes/idempotency keys from the
HTTP projection and encodes monetary values as decimal strings. Pagination is
bounded, deterministic, and reports `hasMore` explicitly. `read_pos_catalogue`
is a narrowly projected definer function: active selling-card fields only, with
no recipes, physical quantities, batches, stock links or library drafts.
That P4 projection retains `checkoutReady: false`. P6 adds the separate protected
checkout catalogue and database activation contract; hosted/caller-token and
concurrent acceptance now pass. The approved test window ended disabled.
See CHECKOUT.md for the current readiness and receipt boundaries.

Settings updates are the sole new business mutation. The command serializes
against account changes and other settings writers, rechecks active Owner,
compares the current revision (null only for initial creation), validates database
bounds, and commits the settings plus actor/name/role audit together. Revisions
advance even within one transaction. The audit's `entity_type` is `alert_settings`
and its constant entity ID `00000000-0000-0000-0000-000000000001` identifies the
singleton; the authenticated actor has a separate `actor_id`. Denied, stale,
invalid or audit-failed writes change neither settings nor audit. No setting or
fake Owner is seeded; this does not implement P9 alert delivery/detection.

## HTTP routes

All new routes require verified Auth and use caller-token database access;
responses are `no-store`. The server-only Auth administration client and the
separate PostgreSQL administration connection do not serve business reads.

| Route | Behavior |
| --- | --- |
| `GET /api/access` | Current profile, business date, permissions and explicit service-readiness flags. |
| `GET /api/sales`, `GET /api/sales/:id` | RLS-scoped read projection; `offset`/`limit` only. |
| `GET /api/void-requests` | RLS-scoped requests, bounded pagination. |
| `GET /api/pos/catalogue` | Selling-card projection for all roles; checkout remains closed. |
| `GET /api/alert-settings` | Owner-only; null until explicitly configured. |
| `PATCH /api/alert-settings` | Owner-only revisioned settings/audit transaction. |
| `GET /api/auth/accounts` | Permission-checked boundary; account list/email integration is P5. |

Dashboard, Inventory reads/writes, Reports, checkout, direct voids/requests/decisions
and Daily Sales Review confirmation have explicit permission-checked boundaries.
Denied roles receive 403; permitted roles receive 501 until those services are
implemented. These 501 routes do not perform business work or write events.
P3 account creation/profile updates remain operational under their existing
trusted provisioning/update commands; no password is copied into a profile.

At P4 acceptance the real frontend remained on its verified account screen.
P5 now supplies the separate protected management workspace, with hosted
acceptance tracked in CRUD.md and HandsOff.md. P2A's closed bridge,
unsaved drafts, preview role isolation, SKU-only inputs and all inventory models
stay intact. P4 does not claim Users/Inventory persistence, checkout, review or
report integration. Those are P5–P8.

## Verification and hosted application

`npm test` covers the full API matrix and disposable PostgreSQL scenarios:
cross-account and yesterday/tomorrow denial, direct RPC/table access, forged
metadata, role changes with the same identity, last-Owner/self-account protections,
revision conflicts, atomic audit failure and accidental-grant RLS checks. The
shared permission scenarios never use real passwords or change real accounts.
PGlite executes actual PostgreSQL rules; it does not establish hosted PostgREST
behavior or multi-connection account contention.

The approved migration was applied through the existing exact-target tool:

```powershell
npm run db:apply --workspace backend -- --project-ref izdemgzdywtxhvgvsian
```

Verification commands:

```powershell
npm run db:verify --workspace backend
npm run permissions:verify --workspace backend
npm run db:smoke --workspace backend
```

The hosted schema verifier confirms the exact six SELECT grants, one private helper grant,
eight public function grants, 25 SELECT-only policies and six matching migration
hashes. Its first hosted run exposed PostgreSQL `name[]` metadata arriving as
text in node-postgres. The verifier now selects `roles::text[]`, preserving its
strict role check, and the hosted rerun passes. No applied SQL was edited.
`permissions:verify` uses synthetic
Auth rows inside **rolled-back SQL transactions**, not real Auth provisioning.
It compares all table counts, existing Auth/profile/settings fingerprints and
grants before/after, logging no credentials/provider objects.

Hosted permission verification passes **11/11**, and database smoke checks pass
**12/12**. Both roll back all fixtures/temporary grants. Before/after comparison
confirms two active Owners, unchanged Auth/profile/settings fingerprints, two
existing audit events, no configured settings, zero sales/stock movements and
unchanged counts for every application table. Fresh root tests pass **67/67**;
root typechecks/builds and schema `--check` pass, followed by a backend typecheck
after the verifier fix. Evidence is in workspace-parent
`.review/october-17-p4-acceptance-*`.

No runtime UI changed; no browser or real Auth/PostgREST checks were rerun during
this acceptance. Cross-connection account-write contention remains a verification
boundary; sequential last-Owner cases run only in disposable SQL. Keep admin and
Huuujji active and unchanged. P5 is next; unfinished business services remain closed.

Implementation references: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[PostgreSQL policies](https://www.postgresql.org/docs/17/ddl-rowsecurity.html),
[function privileges](https://supabase.com/docs/guides/database/functions).
