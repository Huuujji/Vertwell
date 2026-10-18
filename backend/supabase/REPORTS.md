# Durable reports and reconciliation — P8

P8 is accepted on DualCounter `izdemgzdywtxhvgvsian`. The thirteenth migration,
`20261017210000_durable_reports.sql`, has normalized SHA-256
`d38b737a66604f6722ebb5d06d083a69ee8b43662b9a0d91ded94667dc7ffca9`.
All thirteen applied SQL sources are immutable. Checkout remains enabled.
This is P8's historical acceptance. P9's selected in-app notification scope is now
implemented; see [NOTIFICATIONS.md](NOTIFICATIONS.md) and the current HandsOff.md
checkpoint. All seventeen currently applied migrations are immutable. Source/docs
remain local; no GitHub save or app deployment was performed.

## Access and snapshot

`GET /api/reports` requires a real active Owner or Admin. It forwards the caller's
token to `read_reports()`, which repeats the current database role check. Staff,
inactive accounts, anonymous callers and service-role execution cannot use the
RPC. The API rejects query/identity overrides and sends `Cache-Control: no-store`.
No table grants, write policies, business rows or activation settings are changed.

The stable security-definer function has an empty search path and assembles one
MVCC snapshot containing every authorized report record: units, SKUs, stock items,
batches and movements; sales, purchased items/modifiers/stock usage, payments,
Daily Sales Reviews and their exact item sets, cash adjustments and void requests.
It excludes profiles, Auth data and private operation commands. Exact decimal
columns are serialized as strings. Nested RPC JSON is not limited by a table's
PostgREST page size; the UI never silently truncates its export to a visible page.
This development implementation loads the complete authorized snapshot; very
large production datasets would need a separately specified snapshot/export job.

`business_access().services.reports` enables manager navigation. A failed read
never opens preview or invents an empty report. Refresh retains the last snapshot
and filters but disables export until loading succeeds. Navigation continues to
respect the workspace's existing dirty-form and uncertain-command protection.

## Calculations and scopes

`Frontend/src/data/durable-reporting.ts` produces one report document for screen,
CSV, PDF and Print. Sales, Inventory usage and Combined scopes use the same data.
Dates/times are interpreted in Asia/Manila; future and invalid ranges are rejected.
The timezone is retained in export metadata without repeating it on screen dates.

- Sales and purchased usage use the selected date/time interval, including the
  final minute. The sales category applies to purchased parent products. Inventory
  always covers all categories; mixed-category bundle revenue is not invented.
- Completed totals use recorded prices, tax and current workflow state. Received
  payments awaiting Owner review and voided receipts are separate. Money sums and
  complementary category allocations use integer cents; subtotals and allocated
  tax add back to the selected total. Payment rows retain original receipt amounts.
- Stock periods use full business days, independent of the time controls. Per
  SKU/unit, opening + receipts + other inflows - consumption - removals/wastage -
  other outflows = historical closing. Other movements retain their explicit
  correction, return, transfer or later batch-opening type, reason and actor.
- Every batch needs an explicit opening. A range before the first opening has
  named partial coverage; earlier stock is unknown. Missing openings, invalid
  chronology or unreconciled balances disclose unavailable baselines/percentages.
  Percentages use verified opening plus inflows, with exact quantities beside the
  colors. Zero available stock has an explicit empty state.
- Current physical stock sums recorded movements. Current usable stock excludes
  archived, expired and unsellable batches/items. Historical closing and current
  stock have separate dates. Expiry alone never changes physical quantities.
- Usage comes from immutable purchased snapshots; movement balances deduct actual
  consumption once. Recipe/modifier/variant/bundle edits never reconstruct past
  usage. Paid/fulfilled Pending and voided sales retain committed consumption.
  Usage/movement mismatches and incomplete history are disclosed.
- Reviews show their original expected/verified Cash/GCash, counted cash, all
  adjustments, explanation, outcome and complete original included receipts. A
  review spanning selected categories/times is context, not prorated revenue.
  Requests retain each original and decision reason/actor/time. Voids do not imply
  an external refund or stock return. GCash references/manual receipt checks do
  not imply payment-provider verification.

Screen tables show four records per page. Export review includes Cash/GCash,
item-level used/current stock quantities and units, coverage counts, section
totals and disclosures. Every export contains the complete filtered data. Print
opens the same cached generated PDF as Download PDF; CSV includes all sections
and scope notes. The live PDF footer identifies saved business records; preview
documents retain their sample labels. No native-print/paper verification is claimed.

Dashboard uses the same saved calculations, Overall/F&B/Hobby/date/time controls,
retained Daily Sales Values disclosure and a filter-preserving link to Reports.
Stock attention links open the corresponding Inventory item/batch.

## Verification

- Root tests: **142/142** (111 backend/API/PostgreSQL and 31 frontend unit).
  Typechecks, both builds and generated-schema equality pass.
- Five new database cases cover exact snapshots, role changes/access denial,
  unchanged purchased/payment/stock history, a 106-movement complete snapshot,
  and persistence across disk close/reopen. Nine calculation cases include an
  actual recipe/modifier purchase followed by catalogue edits and kg/g conversion.
- Scoped browser regression: **27/27** management/checkout/workflow/report cases,
  followed by **5/5** Reports checks after the final export-review/date-label
  refinement. This is not a whole-suite run or a new final-source 27-case rerun.
- Hosted `reports:verify`: **4/4**, all fixtures rolled back. `db:verify` confirms
  thirteen exact hashes, 25 RLS tables, the same six SELECT-only table grants,
  twenty restricted public function grants and two permitted private helpers.
- Real Huuujji/Jest/Aquino Auth acceptance proves identical Owner/Admin report
  tables, denied Staff API/direct RPC and anonymous/override requests, and another
  real Auth session retrieving the same data. The real Owner browser loads,
  exports PDF/CSV and reloads. No new account, sale, stock or review was created.
  Tokens/passwords were not saved and only created sessions were signed out.
- Saved-data browser views have no page errors or page overflow at 1440×900,
  820×400 and 320×568. Ten-page fixture and 36-page real combined PDFs were rendered
  and visually inspected, including review/adjustment/usage/exception tables.
  Download PDF and the observable Print viewer receive identical cached bytes.
- Before/after fingerprints confirm every existing public/private business row,
  all profiles and Auth IDs are unchanged. Checkout stays enabled and retired
  P6 account sessions remain zero. Credential fields were not read for this audit;
  normal authorized sign-in timestamps changed. No password/profile/settings
  update was requested or performed.

Local evidence is workspace-parent `.review/october-17-p8-*`. The first sandboxed
API test run failed on loopback EACCES, followed by a successful permitted run.
Early type/selector assertions were corrected; failed logs remain. Automatic
review rejected an unnecessary credential-field preservation read; the revised
audit uses only business rows, profiles and Auth IDs and passes. No rejected read
was executed. Existing bundle-size and pg queued-query warnings are nonblocking.

P9's October 18 clarification uses the shop's actual GCash QR and manual reference
recording; GCash API/payment-provider verification is not required. Manual reference
evidence and Owner reconciliation remain distinct from provider verification.
The user chose in-app-only notifications for Owner/Admin; these are implemented
with saved evidence and per-account read state in NOTIFICATIONS.md. Existing
private automatic updates remain. Unconfirmed accounting/production rules are
separate decisions; email/browser push are outside the selected scope.
See the current clarification and verbatim user message in HandsOff.md.
