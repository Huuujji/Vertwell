# Backend database design — October 17, 2026

P1 design for the existing frontend; P2 supplies the local foundation. Backend work
stays local: no commit, push, GitHub save, or deployment until all backend tasks
are finished and the user authorizes the save. The frontend P0 checkpoint stands.

## Evidence and scope

Reviewed `Frontend/src/data/{demo,inventory,stock-movements,catalogue,modifiers,
audit,reporting,item-codes,business-date}.ts`, `App.tsx`, Inventory, Users,
Dashboard/AlertCenter and the Express auth/Supabase scaffold. The full original
October 17 request and earlier decisions in HandsOff.md govern this design.

This foundation is a single-business database. UUIDs identify records; SKU is the
only business-facing code. No Item Code or password column exists. Auth owns
email, credential hashes, sessions and recovery. Profiles reference `auth.users`
by its primary key. There is no automatic signup-to-Owner trigger.

The user-created Vertwell development project (`izdemgzdywtxhvgvsian`) now has
these migrations applied and verified on PostgreSQL 17.11. P3–P8 add
application services and transaction commands; table existence is not proof that
login, checkout, role permissions or reports work. All Data API access initially
denies reads/writes, including authenticated users; role policies come at P4.

## Relationships and frontend mapping

| Frontend workflow | Durable representation |
| --- | --- |
| Retail Item (`Stocked`) | Product links one Finished stock item in pieces; no POS listing is required for a standalone stock item. Product/stock may share one SKU identity. |
| Recipe (`Made to order`) | Product has recipe-item rows; no direct stock link. Inputs convert only g/kg, ml/L or identical counted units. Hobby cannot use Recipe. |
| Variants | Product has variant rows linked to distinct Finished stock items in pieces. Variant SKU comes from that stock item. The card's price range is derived from enabled variants, with product discounts applied. |
| Bundle | Component rows reference either direct Finished stock in pieces OR a configured product; an optional variant and fixed modifier-option join rows preserve each configuration. Nested recipes/bundles remain supported. Cycles are rejected at the database boundary. |
| Modifier library | A group with no product is a library entry. Attaching it creates new group/option/input IDs; optional source ID is provenance only. No propagation to product copies or receipt snapshots. |
| Negative modifier inputs | Nonzero signed quantities support omissions. Recipe quantities stay positive. Aggregate within a configured sale line, clamp its net demand to zero, then aggregate all lines; never cancel another line's stock. Variant/bundle negative inputs are forbidden by the later configuration command. |
| Receipts & batches | Batch rows carry manufacturing/expiry, unsellable state and archival state. Physical quantity is the sum of append-only movements, not an independently editable stock total. Batch labels are display positions, never IDs; removing empty archived rows from the display lets numbering restart. |
| Quantity/unit edits | Keep a canonical ledger in g, ml, pcs or bottles. UI units convert using inventory_units.factor; compatible display-unit changes cannot rewrite historical usage. Quantity correction appends the difference with a reason. |
| Stock condition | Derive physical, usable, low stock and expiry status on the Manila business date. Expiry day remains usable; expired/unsellable stock remains physical until an explicit removal. Product enabled is separate from computed stock availability. |
| Sale receipt | Sale/item/modifier/usage rows retain names, SKUs, prices, category, actor, configuration and consumption at purchase. JSON stores an immutable configuration snapshot, not mutable relational catalogue data. |
| Payment | A recorded Cash/GCash payment and optional external reference; recording is not provider verification. Payment, fulfilment, review and void states are separate. |
| Daily Sales Review | Review header plus explicit included-sale/receipt-verification rows. Expected/verified values, cash reconciliation, explanation and Owner snapshot survive later changes. Review never consumes stock again. |
| Voids | Every request has a row; a partial unique index permits only one pending request per sale. Decision and audit events retain attribution. Voids neither restore stock nor imply a refund. |
| Reports | Canonical stock ledger and purchased usage establish coverage. No opening movement means unknown earlier balance; never manufacture historical openings from current stock. Sale time is an instant; period stock balances cover full Manila days. |
| Alerts | Owner-only settings persist threshold/window. Detection is derived, human-reviewed evidence; no automatic void or account sanction. Read markers/notification delivery are later scope. |
| Edited by / edited at | Protected P5 catalogue commands write audit actor snapshots against entity_type/entity_id in the same transaction; editors obtain the latest relevant actor and updated_at rather than accepting a caller's attribution. |

The preview's legacy `code`, inferred stock kinds, demo IDs, blob image URLs and
reconstructed movements are not migrated into real business data automatically.
Persistent images use a storage object reference; storage access/upload rules are
P5 work. No obsolete stock panel or shift-management entity is introduced.

## Types, keys and history rules

All timestamps are `timestamptz` (instants); business dates use
`(occurred_at AT TIME ZONE 'Asia/Manila')::date`. Receipt/calendar dates are SQL
`date`. Monetary values are exact `numeric(14,2)` PHP; stock/input quantities are
`numeric(20,6)` with NaN rejected. Counted units require whole quantities.
Business text is trimmed and nonblank. Case-insensitive SKU/username uniqueness
reserves archived identifiers too. Generated SKUs must reserve the SKU row in a
transaction and retry uniqueness conflicts; a browser preflight is insufficient.

Foreign keys default to RESTRICT. Referenced catalogue/profile rows are archived
or deactivated, never cascaded out of sales/history. IDs never follow a SKU edit.
Purchased snapshots, payments, stock/cash movements, completed review rows and
audit events are append-only. Later corrections use explicit compensating events,
not rewritten receipts. Sale financial/identity fields cannot be updated; only
the workflow state may change in a later protected transaction. Destructive
history deletion and TRUNCATE are blocked, including accidental privileged calls.

Food/Beverage products and batches require both dates; Hobby permits either to be
null. If both exist, expiry cannot precede manufacturing. Dates belong to each
batch; product dates are the existing catalogue editor's separate descriptive
dates. Changing category must revalidate existing batch dates.

## Permission matrix (design target, P4 implementation pending)

| Action | Owner | Admin | Staff |
| --- | --- | --- | --- |
| Dashboard / business reports / inventory management | Yes | Yes | No |
| Alert settings read or write | Yes | No | No |
| POS catalogue and checkout | Yes | Yes | Yes |
| Sales / audit | All business sales | All business sales | Own current Manila-day sales/requests |
| Direct void / review void requests | Yes, own identity | Yes, own identity | Request only, eligible own sale |
| Confirm Daily Sales Review | Yes | No | No |
| User management / provisioning | All roles | Staff only | No |
| Assign Owner or Admin | Yes | No | No |

Trusted profile data supplies current role/active status on every operation;
client role/name fields never authorize access. Actor ID plus name/role snapshots
record who acted at the event time. Protect the last active Owner under concurrent
changes and prevent deleting the signed-in account. P3/P4 will implement these
checks with a serialized account-management transaction, not row-count prechecks.
Until then no application role has table or function write access.

## Column dictionary

`!` means NOT NULL; `?` means nullable. Unless stated otherwise, each entity has
`id uuid! PK DEFAULT gen_random_uuid()` and `created_at timestamptz! DEFAULT now()`.
Mutable catalogue entities also have `updated_at timestamptz! DEFAULT now()` and
`archived_at timestamptz?`; touch triggers manage updated_at. Every column is
listed below, including these common columns by reference. SQL is authoritative
for exact checks and defaults. `money` and `quantity` below refer to the exact
numeric domains above; money is nonnegative unless explicitly signed.

| Table | Columns beyond the common columns / exceptions |
| --- | --- |
| inventory_units | No common columns. `code text! PK`, `family text!`, `factor numeric(12,3)! >0`; fixed g/kg/ml/L/pcs/bottles rows. |
| skus | Common entity + mutable fields; `value text!` trimmed, unique ignoring case. Shared only by a Retail Item and its own linked stock; variant SKU is derived. |
| profiles | `id uuid! PK FK auth.users` (no generated default), `full_name text!`, `username text!` unique ignoring case, `role text!` Owner/Admin/Staff, `active boolean! DEFAULT true`, `created_at`, `updated_at`; no archive column, password or email. |
| stock_items | Common + mutable; `sku_id uuid! UNIQUE FK skus`, `name text!`, `kind text!` Ingredient/Finished, `category text!` Food/Beverage/Hobby, `unit_code text! FK inventory_units`, `threshold_base quantity! DEFAULT 0 >=0`, `image_path text?`, `unsellable boolean! DEFAULT false`. |
| stock_batches | Common + mutable; `stock_item_id uuid! FK stock_items`, `manufactured_on date?`, `expires_on date?`, `unsellable boolean! DEFAULT false`, `received_at timestamptz! DEFAULT now()`. No writable quantity or stock-status label. |
| products | Common + mutable; `sku_id uuid! UNIQUE FK skus`, `name text!`, `category text!`, `stock_model text!` Retail Item/Recipe/Variants/Bundle, `stock_item_id uuid? FK stock_items` iff Retail Item, `base_price money! >0`, `discount_type text! DEFAULT None`, `discount_value money! DEFAULT 0`, `enabled boolean! DEFAULT true`, `image_path text?`, `icon text?`, `manufactured_on date?`, `expires_on date?`. Fixed discount <= price; percentage <=100; None requires 0. |
| product_recipe_items | Common entity (no mutable/archival fields); `product_id uuid! FK products`, `stock_item_id uuid! FK stock_items`, `quantity quantity! >0`, `unit_code text! FK inventory_units`; unique product/stock/unit. |
| product_variants | Common + mutable; `product_id uuid! FK products`, `stock_item_id uuid! FK stock_items`, `name text!`, `price money! >0`, `enabled boolean! DEFAULT true`; unique name ignoring case and stock within product. |
| modifier_groups | Common + mutable; `product_id uuid? FK products` (null = library), `source_group_id uuid? FK modifier_groups`, `name text!`, `min_choices integer! DEFAULT 0 >=0`, `max_choices integer! DEFAULT 1 >=min`. |
| modifier_options | Common + mutable; `group_id uuid! FK modifier_groups`, `name text!`, `price money! DEFAULT 0`, `default_selected boolean! DEFAULT false`. |
| modifier_stock_inputs | Common entity; `option_id uuid! FK modifier_options`, `stock_item_id uuid! FK stock_items`, `quantity quantity! !=0` (signed), `unit_code text! FK inventory_units`; unique option/stock/unit. |
| bundle_components | Common entity; `bundle_product_id uuid! FK products`, `component_product_id uuid? FK products`, `stock_item_id uuid? FK stock_items` (exactly one source), `variant_id uuid? FK product_variants`, `quantity integer! >0`, `position integer! DEFAULT 0 >=0`. Variant must belong to the selected component product. |
| bundle_component_modifiers | No common columns; `component_id uuid! FK bundle_components`, `option_id uuid! FK modifier_options`; composite PK. Fixed option must belong to selected component product. |
| sales | Common entity; `order_number text! UNIQUE`, `idempotency_key uuid! UNIQUE`, `request_hash text!`, `occurred_at timestamptz! DEFAULT now()`, `business_date date! GENERATED` Manila date, `cashier_id uuid! FK profiles`, `cashier_name text!`, `cashier_role text!`, `subtotal money!`, `tax_amount money!`, `total money!`, `payment_state text! DEFAULT Received`, `fulfilment_state text! DEFAULT Fulfilled`, `review_state text!` Awaiting Owner review/Reviewed/Owner checkout, `status text!` Pending/Completed/Voided, `stock_committed boolean?`, `usage_complete boolean?`, `voided_at timestamptz?`, `voided_by uuid? FK profiles`, `voided_name text?`, `voided_role text?`, `void_reason text?`, `bulk_action_id uuid?`. Null stock flags preserve explicitly unknown imported history. Total=subtotal+tax. Void metadata is all present iff Voided. |
| sale_items | Common entity; `sale_id uuid! FK sales`, `product_id uuid? FK products`, `variant_id uuid? FK product_variants`, `name text!`, `sku text!`, `category text!`, `quantity integer! >0`, `unit_price money!`, `original_unit_price money!`, `configuration_snapshot jsonb! DEFAULT {}` (object). Snapshots survive catalogue changes. |
| sale_item_modifiers | Common entity; `sale_item_id uuid! FK sale_items`, `option_id uuid? FK modifier_options`, `name text!`, `price money!`. |
| sale_item_stock_usage | Common entity; `sale_item_id uuid! FK sale_items`, `stock_item_id uuid! FK stock_items`, `sku text!`, `name text!`, `kind text!`, `quantity_base quantity! >=0`, `unit_code text! FK inventory_units` (canonical). |
| payments | Common entity; `sale_id uuid! UNIQUE FK sales`, `method text!` Cash/GCash, `amount money!`, `reference text?` unique per method when present, `cash_tendered money?`, `change_given money?`, `recorded_at timestamptz! DEFAULT now()`. GCash requires reference; Cash requires tender/change matching amount. No provider-verified flag is inferred. |
| stock_movements | Common entity; `batch_id uuid! FK stock_batches`, `kind text!` Opening/Receipt/Consumption/Correction/Removal/Wastage/Return/Transfer, `quantity_base quantity!` signed, `sale_item_id uuid? FK sale_items` required iff Consumption, `actor_id uuid! FK profiles`, `actor_name text!`, `actor_role text!`, `reason text!`, `occurred_at timestamptz! DEFAULT now()`, `business_date date! GENERATED`, `operation_id uuid!`, `operation_line integer! DEFAULT 0 >=0`; unique operation/line; one Opening per batch. |
| cash_movements | Common entity; `kind text!` Opening/Addition/Removal/Refund, `amount money! >0`, `sale_id uuid? FK sales`, `actor_id uuid! FK profiles`, `actor_name text!`, `actor_role text!`, `reason text!`, `occurred_at timestamptz! DEFAULT now()`, `business_date date! GENERATED`, `operation_id uuid! UNIQUE`. Stored amount is magnitude; kind supplies direction. |
| void_requests | Common entity; `sale_id uuid! FK sales`, `reason text!`, `requested_by uuid! FK profiles`, `requested_name text!`, `requested_role text!`, `requested_at timestamptz! DEFAULT now()`, `status text! DEFAULT Pending`, `reviewed_by uuid? FK profiles`, `reviewed_name text?`, `reviewed_role text?`, `reviewed_at timestamptz?`, `decision_reason text?`. Pending has no decision metadata; Approved/Rejected require all decision fields, reviewer Owner/Admin. Resolved requests cannot be edited. |
| daily_sales_reviews | Common entity; `business_date date!`, `owner_id uuid! FK profiles`, `owner_name text!`, `owner_role text! DEFAULT Owner`, `reviewed_at timestamptz! DEFAULT now()`, `expected_cash`, `expected_gcash`, `verified_cash`, `verified_gcash`, `counted_cash`, `opening_cash`, `additions`, `removals`, `refunds` all `money!`; `explanation text! DEFAULT ''`, `outcome text!` Matched/Reviewed with explained discrepancy, `operation_id uuid! UNIQUE`. Discrepancy requires explanation; Matched requires matching expected/verified values. |
| daily_sales_review_items | No common columns; `review_id uuid! FK daily_sales_reviews`, `sale_id uuid! UNIQUE FK sales`, `receipt_verified boolean!`, `verified_amount money!`; composite PK. Multiple separate reviews per day are allowed, but a sale is included once. |
| audit_events | Common entity; `actor_id uuid! FK profiles`, `actor_name text!`, `actor_role text!`, `event_type text!`, `entity_type text!`, `entity_id uuid!`, `reason text!`, `details jsonb! DEFAULT {}` (object), `occurred_at timestamptz! DEFAULT now()`, `operation_id uuid!`. Entity reference is polymorphic evidence; no cascading FK. |
| alert_settings | No common ID/archival fields; `singleton boolean! PK DEFAULT true CHECK true`, `similar_order_threshold integer! DEFAULT 5` in 2..100, `window_minutes integer! DEFAULT 2` in 1..60, `updated_by uuid! FK profiles`, `updated_at timestamptz! DEFAULT now()`. No defaults seeded using a fake Owner. |

## Transaction and migration plan

1. `202610170001_foundation.sql`: types, units, identities, catalogue relationships,
   immutable receipt/ledger/review structures, indexes and default-deny access.
2. `202610170002_integrity.sql`: unit/model/date/link checks, deferred bundle cycle
   and SKU ownership checks, history guards, ledger row locking, atomic audit and
   full foreign-key indexes. `20261017015959_unit_reference_indexes.sql` supplies
   five additional unit indexes found by live verification. Applied files are frozen.
3. A separate `seeds/development.sql` is opt-in and guarded by a development-only
   session setting. It creates catalogue fixtures with empty batches, no Auth
   users, profiles, payments or sales. Tests create synthetic identities only in
   their disposable database bootstrap, never in a deployment migration.
4. Later P3–P5 migrations add account lifecycle and protected catalogue commands,
   RLS policies, configuration completeness checks and API routing. Catalogue
   changes are whole-aggregate transactions (including children and copies).
5. P6 locks all involved batches in stable ID order, checks one aggregated demand
   per SKU, selects usable batches by expiry then received_at/ID, recalculates
   prices and reserves idempotency key/hash. Receipt, payment, all deductions and
   audit commit together. A retry with the same key but changed hash must fail.
6. P7 locks included sales before review/void decisions. No stock movement occurs
   at review. Refunds/returns, when explicitly supported, get separate events.

Foundation stock writes append a movement while holding its batch row lock,
reject negative physical balances, reject consumption of archived/unsellable or
expired stock and append an audit event in the same statement/transaction.
Physical balances have a single source of truth. The foundation is not a checkout
RPC and does not promise concurrent full-cart checkout until P6 verification.
Do not use multiple independent Supabase SDK calls as an atomic transaction.

`stock_movements` also has `stock_sku text!`, `stock_name text!` and
`unit_code text! FK inventory_units`. The BEFORE INSERT trigger derives these
immutable snapshots from the stock record and canonical unit, ignoring supplied
snapshot values. They preserve receipt/removal history across SKU/name/unit edits.
Purchased usage likewise requires its stock kind and canonical unit.

API commands must validate raw decimal scale and whole-number counts before SQL
casts: PostgreSQL can round a fractional numeric value when casting to integer.
The integer/numeric column types alone do not validate incoming JSON syntax.

## Explicitly deferred decisions and limits

- No accounting policy, purchase-cost valuation, margin, production-batch system,
  external refund behavior or mixed-category bundle revenue allocation is invented.
- Preserve preview price/tax snapshots; no new tax policy is established here.
  Authoritative pricing/rounding is finalized and verified at P6.
- Historical importing requires documented coverage and actor/stock provenance;
  do not translate preview sample actors or illustrative receipts into real sales.
- Read-marker lifetime and alert-delivery preferences need P9 scope. Settings
  storage exists; notification delivery and automatic detection jobs do not.
- Recipe/group/variant/bundle minimum completeness, modifier default constraints,
  fixed-option selection bounds and duplicate full bundle configurations must be
  enforced by P5 aggregate commands before any role can edit catalogue data.
- Multi-connection contention and real Supabase Auth/PostgREST/policy behavior
  require a Supabase development environment. Embedded PostgreSQL tests verify
  migrations and constraints, not those live-service properties.

## Primary implementation references

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase user data](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase data security](https://supabase.com/docs/guides/database/secure-data)
- [PGlite API](https://pglite.dev/docs/api) — disposable PostgreSQL verification;
  not the production database or a replacement for Supabase.
