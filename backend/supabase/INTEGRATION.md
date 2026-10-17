# P2A/P5 frontend integration — October 17, 2026

Database setup and P2A preparation are complete. P3 resolves real active profiles
and handles account/session/recovery lifecycle. Hosted Auth settings are configured
and the user confirmed emailed password change/login with a fresh same-browser
link. P3 is accepted. See [AUTHENTICATION.md](AUTHENTICATION.md). P4
business authorization is accepted after exact-project approval, migration
application and hosted verification; see [AUTHORIZATION.md](AUTHORIZATION.md). P5
Users/Inventory integration is implemented; its explicitly approved seventh
migration is applied and hosted SQL checks pass. See [CRUD.md](CRUD.md) and
HandsOff.md for pending signed-in acceptance and actual results. All
Backend work stays local until the Backend task list is finished.

## What runs today

`npm run dev` offers real account login separately from the labeled sample
application. Configured login opens the protected Inventory/Users workspace for managers and
a pending live-POS screen for Staff; it never enters a sample workspace. The new
P5 migration is now applied; unavailable live services show explicit errors. The five
sample people/catalogue/receipts remain preview data that resets on refresh.
P2A added no business API, RLS policy or runtime settings. P3 adds restricted
account endpoints, two migrations and the requested temporary Owner. `/api/auth/me`
returns the verified active profile/role plus Auth email. P4 adds protected sales,
access/settings and a limited POS selling-card API, with checkout unavailable.
`createManagementData` now supplies the protected management bridge; it never
substitutes sample data after a live error.
The remaining sections describe the prepared P2A contracts and their dependencies.

`Frontend/src/lib/api-client.ts` supplies caller-session transport, cancellation,
204 handling and typed network/access/validation/conflict/server errors. It strips
caller authorization headers, prevents redirected token requests, disables caching
and never automatically retries a mutation. `api.ts` connects that transport to the
existing Supabase session helper, using only the browser publishable-key client.
The database administration password/connection is never used by the frontend/API.

`pendingBusinessData` is the retained P2A preparation test boundary. Runtime P5 uses
`createManagementData` in `data/management.ts`, the caller-session transport and
`ManagementWorkspace`. There is no flag that bypasses SQL permissions and no
preview fallback. Checkout/review/report integration remains deferred.

## Contract derived from the migration sources

`backend/scripts/integration-schema.ts` applies the exact migration sources to a
disposable PGlite database, inspects PostgreSQL columns and generates
`Frontend/src/lib/data/database.generated.ts`. It includes all 25 tables,
nullability and LF-normalized migration hashes matching the administration tooling.
All seven sources, including P5, match the separately verified hosted migration
history. The contract generator itself does not prove hosted application and
does not connect to or change the hosted project. Unknown SQL types fail
generation. Regenerate after reviewed later migrations:

```powershell
npm run integration:schema --workspace backend
npm run integration:schema --workspace backend -- --check
npm run test:unit --workspace Frontend
npm run typecheck:integration --workspace Frontend
```

The generated types describe **read rows**, not writable SDK models or grants.
Money, numeric factors and quantities cross this prepared JSON boundary as decimal
strings. Integers/booleans keep their JSON types. A future server must explicitly
cast numeric projections and `SUM` results to text; default JSON serialization can
lose decimal precision before the browser receives it. Dates remain `YYYY-MM-DD`;
timestamps remain UTC-offset instants. IDs remain database UUIDs, independent of SKU.

`InventorySnapshot` version 1 contains a business date, twelve related table lists
and exactly one canonical balance for every included batch (including zero).
P5 constructs this complete coherent snapshot in one database statement, includes
all referenced configuration records and canonical balances, and carries an
inventory revision and trusted edit attribution. Do not assemble unrelated
SDK requests and present them as one consistent snapshot. This inventory shape is
for permitted inventory managers; Staff's later POS projection must be separately
scoped and must not expose the full management dataset.

| Existing frontend value/workflow | Prepared durable mapping |
| --- | --- |
| SKU / stable record identity | `skus.value` via `sku_id`; product/stock/variant IDs remain their original UUIDs. No Item Code. |
| Ingredients / unlisted retail stock | `stock_items.kind`, category and unit; Finished stock needs no POS product. No obsolete stock panel is added. |
| Receipt/batch quantities | `stock_batches` joined to canonical movement totals supplied in `balances`; never infer an opening balance from stock today. |
| Display units/reorder levels | Convert canonical `quantity_base` and `threshold_base` with fixed unit factors. Sum exact canonical decimals before converting. |
| Expiry / unsellable / physical stock | Null Hobby dates become blank display dates; expiry uses the response's Manila business date. Expired/unsellable stock stays physical and is excluded from usable stock. |
| Retail Item | `products.stock_model = Retail Item` maps to `Stocked`; only this model needs `stock_item_id`. |
| Recipe | `Recipe` maps to `Made to order`; relational recipe inputs retain stock IDs, units and quantities. |
| Variants | Variant rows retain IDs, enabled state and prices; their visible SKU comes from the linked stock record. |
| Bundles | Ordered components retain direct stock OR product links, selected variant IDs and fixed modifier-option IDs. Nested configuration resolution continues to use the existing frontend helpers. |
| Modifier library / attached copies | Product-null groups map to library entries; product groups/options/inputs retain separate IDs. Signed omission quantities survive; no library propagation. |
| Enablement / availability | `products.enabled` stays separate from usable stock and configuration availability. |
| User list | Authorized Auth email plus `profiles.id/full_name/username/role/active`; no password/hash, invented email or sample actor IDs. Inactive status is retained explicitly. |

`mappers.ts` validates unknown JSON against the generated schema, rejects duplicate
IDs, missing links/balances, unknown models/units, malformed decimals and loss of
display precision. It returns the original decoded source beside display models,
preserving revisions, image paths and source-group provenance for later commands.
It does not resolve storage objects or invent edited-by actors. P5 supplies private raster storage, caller-scoped signing and audit-derived edit attribution. The current numeric
UI cannot faithfully display the full SQL quantity range; unsupported values fail
explicitly. Supporting those extremes needs a decimal/string UI before P5 enables
them, rather than rounding them silently.

## Request state and draft ownership

`useResource` accepts a scope key and stable loader, exposes loading/ready/error,
supports explicit reload, aborts superseded loads and ignores stale responses even
if a transport ignores cancellation. A changed identity/scope immediately hides
previous data; a same-scope refresh can retain it. P3 must key it by authenticated
identity and clear it on logout/access changes. This loader is prepared and tested;
the real P5 pages now use it with identity/role-scoped keys; preview keeps its own sample state.

Users create/edit/delete, Inventory record saves, receiving and removals accept
asynchronous callbacks. While pending, their form controls/actions are disabled.
They show success/close/reset only after the callback resolves. A rejection keeps
the editor/wizard, passwords, quantities, dates, selections and dirty/discard guards
mounted, and permits a deliberate retry. A synchronous in-flight guard blocks
duplicate submissions. In persistent mode P5 passes the new-account password
separately to the protected Auth creation endpoint; it is never stored in the
profile/account object. Preview passwords remain unsaved sample inputs.

Error envelopes accept `{ error: { message, fields? } }`. Existing Express errors
already supply `message`; later protected validation services may add field paths.
401 requires reauthentication, 403 requires permission review, 409 requires a fresh
record review, and 400/422 requires correcting validation. Keep the draft in every
case. A lost response can follow a committed mutation: P5/P6 must reconcile the
original operation ID/outcome before retrying; a browser hook alone cannot provide
transactional idempotency. Do not automatically replay queued writes after login.

The implementation follows React's [effect cleanup guidance](https://react.dev/reference/react/useEffect)
and Fetch's [response/cancellation behavior](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch).

## Scheduled service and command mapping

Account services are implemented under P3 and management aggregate services under
P5. The entries below preserve the original integration requirements; CRUD.md
documents their current implementation and hosted acceptance boundary:

| Priority | Integration to complete |
| --- | --- |
| P3 | Complete: real profile/session/account services, configured Auth and user-confirmed emailed password change/login. Retain admin and the additional testing Owner. |
| P4 | Complete: exact-project approval, hosted migration/metadata verification, 11 permission scenarios and 12 rollback smoke checks pass. A client role is never authorization. See AUTHORIZATION.md for verification limits. |
| P5 Users | Integrate P3 creation/profile/deactivation commands into Users; add the authorized account-list/email projection and separately scoped email/invitation flows. Preserve Auth-owned credentials and serialized account protections. |
| P5 catalogue | Whole-aggregate product/recipe/variant/bundle/modifier commands. Select writable fields explicitly; preserve generated IDs, source provenance and storage metadata. Compare source revisions, reserve SKUs transactionally and return authoritative saved rows. |
| P5 stock | Separate receive, physical-count correction, removal and archive commands with operation ID, batch ID, exact canonical quantity, reason and expected revision. Derive actor from authentication; append movements/audit in one transaction. Never persist an edited UI `quantity` as a batch column. |
| P5 UI completion | Replace sample callbacks with protected services; handle library-copy/upload requests, field validation and stale-data reconciliation; route/loading/error states across all screens. Verify refresh/login/second-session persistence and failed writes. Existing preview remains selectable separately. |
| P6 | Checkout maps sale/items/modifiers/usage/payments plus stock movements atomically. Keep purchased snapshots and readable order numbers distinct from IDs. |
| P7 | Map all review items, void requests/decisions and audit events, rather than collapsing event history into a mutable UI row. No stock deduction at review or automatic return at void. |
| P8 | Map historical movements/coverage into existing reports and matching exports. Do not reconstruct historical openings or percentages from current balances. |
| P9 | External verification, notifications and any separately agreed synchronization. |

Verification uses disposable real PostgreSQL rows for schema/mapping, injected
transport responses for failures, and Playwright-only entry overrides for pending
and rejected saves. These checks establish preparation and preview regressions;
they do not establish email delivery or business CRUD acceptance. P3's separate
live Auth verification is recorded in AUTHENTICATION.md and HandsOff.md.
