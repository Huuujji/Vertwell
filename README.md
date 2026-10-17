# Vertwell
# System Fundamentals Project - BSCS 3A

> **Status:** P6 atomic checkout accepted in hosted development; checkout left disabled as requested
> Separate frontend and backend applications for Vertwell's inventory and sales management system.

## Current checkpoint — October 17 atomic checkout accepted

P6 now adds server quotes, whole-cart/configuration stock checks, atomic
sale/payment/purchased snapshots/FEFO consumption/audit, operation replay and a
protected live POS with refresh recovery and scoped receipt retrieval. The new
`20261017135332_atomic_checkout.sql` migration is applied to DualCounter after
explicit exact-project approval. All ten hosted hashes match. Real caller-token
Auth/API/PostgREST/Storage acceptance and three forced-overlap checkout races
pass: identical retries deduct once, competing orders cannot oversell, and
checkout/count correction allows one commit. See [CHECKOUT.md](backend/supabase/CHECKOUT.md).
The user separately approved temporary test activation followed by disablement;
**checkout is disabled again**. P7 durable review/void/audit workflows are next.
No Backend changes have been committed or pushed.

Labeled development history from both test passes remains: 11 sales/payments,
eight inactive test accounts and archived test stock with zero balances. The
four retained active accounts and settings are unchanged. Generated test
passwords/tokens were not saved. The prior 106 local tests and 26 scoped browser
checks remain historical; no new whole browser run is claimed.

P5 connects the existing Users and Inventory screens to protected transactional
services. Managers can save all four stock models, ingredients/batches, recipes,
modifier libraries/copies, variants and bundles; stock changes append attributed
movements and atomic audit. Accounts can be created, edited, deactivated and
reactivated under the existing role/last-Owner/self-account protections. Optional
raster images use a private Storage bucket. Failed requests retain their drafts;
operation receipts reconcile uncertain saves without duplicate stock changes.

The user explicitly approved the P5 migration and verification on DualCounter
`izdemgzdywtxhvgvsian`, resolving the earlier automatic approval rejection.
P5 ended with nine applied migrations, including two narrow live-path repairs: scope
the singleton revision UPDATE for the safe-update guard and return deliberate
business conflicts as PT409 instead of retryable SQLSTATE 40001. Applied SQL
sources remain immutable; permissions and transactional safeguards are preserved.
Real Owner browser and Admin/Staff Auth/API/PostgREST/Storage acceptance passes:
refresh/login/another authorized account, all four stock models, independent
copies, private images, denied/invalid writes and concurrent revision/retry checks.
Root tests pass **86/86**, and typechecks/builds pass. Final hosted regressions
and exact limits are recorded in HandsOff.md. Browser control became disabled
mid-acceptance; no new whole browser-suite result is claimed.

Both original Owners and settings remain unchanged. The user-requested **Jestine
Admin / @Jest** and **Aquino Staff / @Aquino** accounts were created and remain
active as explicitly requested. Passwords are Auth-managed and omitted from files.
Labeled acceptance catalogue records are archived with zero batch balances;
audit/movement/configuration/SKU/operation history and one private test image remain.
Read [CRUD.md](backend/supabase/CRUD.md) for the exact API, validation, archival,
image and verification boundaries. P6 acceptance is recorded above; P7 reviews,
P8 reports and P9 external integrations remain later work. Preview remains separate.
All Backend work stays local: no commit, push, PR, GitHub save or deployment.
Keep both original Owners unchanged and both new Admin/Staff accounts active.

## Previous accepted checkpoint — October 17 permissions

P4 now enforces the Owner/Admin/Staff matrix in caller-scoped API authorization
and the applied sixth database migration. Staff sale/request access is limited to their own
current Manila-day records; settings and Daily Sales Review confirmation are
Owner-only. Settings changes check revisions and atomically audit the real actor.
Unfinished CRUD/checkout/void/review/report services stay closed. The real frontend
continues to show the verified account screen while P5 integration is pending.

**P4 is accepted.** The user explicitly approved its migration and verification
on DualCounter (`izdemgzdywtxhvgvsian`), resolving the earlier automatic approval
rejection. The existing exact-target tool applied only the new migration; all
six applied source hashes match. Its 25 SELECT-only policies open only six
RLS-scoped read tables, with no table write grants; management/profile/ledger
grants remain closed. Both real Owner accounts and settings are unchanged. See
[authorization](backend/supabase/AUTHORIZATION.md) and [HandsOff.md](HandsOff.md).

Fresh validation: **67/67** root tests, typechecks/builds and generated-schema
verification pass. Hosted **11/11** permission scenarios and **12/12** database
smoke checks pass with all fixtures/grants rolled back. Before/after comparison
confirms both Owners, settings, every table count and zero sales/stock movements
are unchanged. Fixed verifier metadata decoding (`name[]` to `text[]`); its hosted
rerun and final backend typecheck pass. The previous **13/13** affected Auth/login
browser checks remain historical; no browser or real Auth/PostgREST test was
rerun, and simultaneous account-write contention remains unverified.
Evidence: workspace-parent `.review/october-17-p4-acceptance-*`.
P5 Users/Inventory persistence is next. No Backend commit/push/PR/deployment.

## Accepted P3 authentication checkpoint

P3 real email/username login, verified active profile/role, session restoration,
expiry/logout handling, protected account lifecycle and PKCE password changes are
implemented and live-tested. The hosted development project is now named
**DualCounter**; its API reference remains `izdemgzdywtxhvgvsian`. The organization
and repository remain Vertwell. The user-approved **Huuujji** Owner account is for
testing only. **Keep admin / @admin / admin@gmail.com active and unchanged.** This
explicit user correction supersedes the earlier temporary-account replacement plan.
Passwords stay in Supabase Auth and are not copied into source or documentation.

**P3 is accepted:** the user approved the exact project/settings;
public signup is disabled, Site URL is `http://localhost:5173`, and the allowed
redirect is `http://localhost:5173/auth/callback`. A real recovery email was sent
to the testing account and its receipt was user-confirmed. After an initial
invalid/expired link, a fresh link requested/opened in the same browser let the
user change the password and log in as Huuujji. The user confirmed both steps;
the new password stays private. PKCE requires the requesting browser's storage.
Invalid callbacks can no longer reuse an older session as recovery proof.

At P3 acceptance configured login opened the verified account screen. P5 now
provides the separate protected management workspace; its hosted acceptance is
recorded above and in HandsOff.md. The labeled **Open preview** remains separate. Both real Owner accounts
and their audit history are retained. At P3 acceptance, five applied migrations
preserved 25 RLS tables, zero direct application grants and three narrow account
RPCs. The accepted P4 checkpoint above records the additional restricted reads.
See [authentication](backend/supabase/AUTHENTICATION.md) and
[HandsOff.md](HandsOff.md) for exact behavior, pending gates and evidence.

Historical P3 validation: **50/50** root checks, **13/13** affected Auth/login browser
cases and **10/10** live testing-account/provisioning checks pass. Real browser
login/restoration/logout, root typechecks/builds and schema verification pass.
The earlier **16/16** live lifecycle, **12/12** rollback database and **223/223**
broad browser runs remain historical; no newer broad browser run is claimed.
All seven original-message blocks and all ten currently applied SQL sources are preserved.

Backend changes stay local/uncommitted until all Backend tasks are finished.
No commit, push, PR, GitHub save or deployment was performed.

## Previous checkpoint — October 17 frontend integration preparation

The Backend phase is now authorized. Database design, permission rules and a
column dictionary are in [backend/supabase/DESIGN.md](backend/supabase/DESIGN.md).
Three numbered migrations implement the foundation with 25 restricted tables,
stock/history safeguards and a guarded development seed. They are applied and
verified in the user-created Vertwell Supabase development project. PostgreSQL
tests cover migration replay, constraints, access denial and persistence after
reopening; 12 rollback checks also pass against the hosted database.
See [database setup](backend/supabase/README.md) for commands and limitations.

**Keep backend work local until all backend tasks are finished: no commits,
pushes or GitHub saves for this phase yet.** P2 database setup is verified. P2A
frontend integration preparation is complete locally. P3 real authentication is
next; enforced role permissions, protected CRUD and checkout follow in
the order recorded in [HandsOff.md](HandsOff.md).

Schema-derived frontend contracts, inventory/account mappings and typed request
handling are prepared. Users and Inventory save flows retain drafts after rejected
requests and prevent duplicate submissions. The application still runs its labeled
sample preview; live authentication and persistent CRUD remain P3–P5 work. See
[the integration contract](backend/supabase/INTEGRATION.md) for boundaries and commands.

Validation: 38 backend/database/frontend-unit checks pass. The broad browser run
passes 219 cases; a final nine-case rerun verifies the subsequent removal-error
cleanup. Final root typechecks, both builds and schema-generation checks pass.
HandsOff.md records exact scope and verification limits.

## Previous checkpoint — October 17 GitHub save complete

The completed frontend and existing backend scaffold are saved in
[`Huuujji/Vertwell`](https://github.com/Huuujji/Vertwell) on `main`, checkpoint
[`f08f7b7`](https://github.com/Huuujji/Vertwell/commit/f08f7b79932168954d670b5de9c2490a90db37db).
The push and exact remote SHA were independently verified. [HandsOff.md](HandsOff.md)
records the full save and validation scope. **P0 is complete.** The later user
request has now started Backend; deployment remains separate work. Older
uncommitted/no-commit statements below describe their historical checkpoints.

P0 validation: root typecheck/build pass for both workspaces; **5 API scaffold tests
pass**. The full frontend run passed 208 cases; two outdated test assumptions were
corrected and both passed the final focused rerun. This covers all **210 existing
cases across the two runs**, rather than a single clean full-suite run. Application
and backend source are unchanged by P0.

## Latest frontend changes — October 17 alert settings and Inventory SKU

Dashboard alert settings and its panel are available only to Owner. Admin retains
the existing review actions. Inventory uses SKU alone in its editors, rows and search;
the extra Item Code field, generator and duplicate-code check are removed. Existing
SKU generation, IDs, stock/batch links and legacy metadata survive edits.

Root typecheck, frontend production build and **37 selected existing browser checks
pass**. Additional Owner/Admin/Staff checks passed at five screen sizes, with 30
screenshots and no page errors or page overflow. [HandsOff.md](HandsOff.md) retains
the full original message and records validation scope and evidence. Everything
remains uncommitted and frontend-only.

## Previous frontend checkpoint — October 16 Inventory stock models and filters

The three latest Inventory requirements are implemented. Unlisted finished SKUs
now show **Retail Item**, with direct Edit, + and Remove actions and retained stock
and receipt links. Their separate **No POS listing** note preserves the distinction
between stock and a configured selling product.

Products and All inventory have a Stock model dropdown for Retail Item, Recipe,
Variants and Bundle. It combines with category/search and remembered navigation;
ingredients retain their own scope. Dashboard links and successful saves reveal
their target by resetting the model filter. Needed to Remove Stocks and its paging
appear only when matching unusable stock remains.

Root typecheck, frontend production build and **all 210 frontend browser checks
pass** (198 existing regressions and 12 new cases; one clean 6.5-minute run).
[HandsOff.md](HandsOff.md) preserves
the complete original message and records the implementation and evidence.
Everything remains uncommitted and frontend-only.

## Previous frontend checkpoint — additional October 16 fixes

**All eight additional October 16 requirements are implemented and verified.**
Inventory uses Stock Details for linked inventory; retail rows have Edit, + and
Remove with per-batch actions behind their expand arrow. Modifier prices support
blank zero drafts, and default checkboxes only toggle from the box or fitted label.
New POS defaults respect the recipe, other defaults, quantity and the whole cart;
the exact four-bun scenario is verified through Owner and Staff checkout.

Long report ranges show the verified overlap with actual coverage dates and
explicit partial-history notes in the UI, PDF and CSV. Earlier stock remains unknown.
A visible text/color legend includes red/burgundy removals, and clearer help explains
expiry, closing/current quantities and unavailable balances. Single-sale Owner/Admin
voids and approvals now require a separate final irreversible warning.

Validation: **187 existing regressions and 11 new cases verified across the broad
run and final focused rerun**. The broad run passed 196, with two screenshot-helper
failures; the corrected final focused run passed all 19 selected checks (53.1s),
including all 11 new cases. Root typecheck and final frontend production build pass.
The three-month Inventory PDF has nine reviewed pages, all 13 coverage notes and
identical Print/download bytes. [HandsOff.md](HandsOff.md) preserves both original
October 16 messages verbatim and records per-requirement evidence, research and limits.
All work remains uncommitted and frontend-only.

## Previous frontend checkpoint — earlier October 16 fixes

**All 19 October 16 frontend fixes are implemented and verified.** Daily Sales
Review, batch receiving and the add-user wizard ask before discarding unfinished
work. Daily Sales Values has a rotating chevron and a lighter table. Inventory
actions are Ingredients/Contents/Variants, Edit and Remove in one row; retail
actions remain Edit and Remove. Product inventory without a POS listing is
explicitly labeled Inventory only, and every variant SKU is reachable under
Products and Receipts & batches. Expiring Soon is orange. Empty batches can be
removed explicitly; after old batches are removed, receiving starts at Batch 1.

POS disables exhausted products before opening modifier/variant dialogs while
respecting valid omissions, required choices and shared cart stock. Modifier
dialogs say Add modifiers and Add. Reports removes Clear filters. Bulk void
requires a separate final irreversible confirmation. Shared dropdowns use
Lucide chevrons; time fields accept typing, Clear sets 00:00, and one border
encloses the time and clock icon. Product detail and confirmation dialogs retain
visible headers on short screens.

Final validation: **187 browser tests passed (5.7m), clean exit**; root
typecheck and a final frontend production build passed. Includes 15 new October
16 cases, five screen sizes, step-three preservation, depleted batch reset, POS
availability, inventory lookup, all three PDF/CSV scopes and prior regressions.
[HandsOff.md](HandsOff.md) preserves the complete original request and records
per-bullet evidence, source credits and limitations. Everything remains
uncommitted and frontend-only; backend integration and deployment are separate.

## Previous frontend checkpoint — October 15, 2026

**The full October 15 frontend request is implemented and verified.** Dashboard
adds Overall and an improved Daily Sales Values disclosure, retained for the user's
keep/remove review. Inventory has searchable stock/batch/product choices, independent
batch edits/removal, editable zero drafts, counted-unit steps, four-digit SKU/item
codes, explicit library attachment and required F&B/optional Hobby dates.

The obsolete Finished Stock section and separate bottom Product stock table are
removed. Each product owns its Receipts & batches controls; variants, shared bundle
components and product inventory without a POS listing remain accessible under
Products. Existing stock links and historical records are preserved.

POS shows variant price ranges and informational bundle contents with quantity/Add.
Fixed included variants/options are displayed, and short-screen bundle dialogs open
at the included list. Reports prints directly through the browser PDF viewer, uses
four records per table page, and explains stock balances with a plain formula and
example. Shared calendars include Today/Clear/Close with a reachable footer on short
screens; time pickers include Now/Clear. Audit and Users policies are preserved.

Final validation: **172 browser tests passed (5.7m), clean exit**;
root typecheck and a fresh frontend production build passed. Includes calendars in
Dashboard, receiving, editors and Audit at five sizes, product/variant receipt flows,
fixed bundle options, all three Print/export PDF byte comparisons and complete scoped
CSV coverage. Fifty broad UI captures and ten final Owner/Staff bundle openings were
captured; sampled visual review covered 1440×900, 820×1180, 390×844, 320×568 and 820×400.
Capture checks found no page overflow or browser/resource errors. Native PDF viewer
controls and OS/paper printing remain untested. Ports 5180/5181 are free.

[HandsOff.md](HandsOff.md) retains the full original message unchanged and records
every requirement's final acceptance, evidence paths and limitations. All work remains
uncommitted and frontend-only; backend integration and deployment are separate work.
The following checkpoints are historical.

## Previous frontend checkpoint — October 5, 2026

**All 18 October 5 frontend-preview priorities are implemented and verified.**
Daily Sales Review appears with void requests in Audit Trail; Sales Overview has
date/time controls; displayed timestamps omit the Manila suffix. Inventory controls
align, removal stock appears first, ingredients have their own urgency-sorted
table, products/ingredients can be removed with dependency protection, and nested
modifier panels are visually distinct. POS rejects quantities above current usable
stock, including the reported 100-cookie attempt and final-payment validation.

Reports has readable responsive tables and export summaries, date-specific stock
percentage bars, future-date rejection, and a shared PDF for Print/export.
Users behavior remains unchanged. The last saved body-word wrapping fix now passes
browser and visual checks. No additional application source fix was needed in this
resume; fresh evidence writes to a separate `ui-accepted/` directory.

Final validation: **148 browser tests passed (6.6 minutes), clean exit**, after
**23 focused checks passed (1.1 minutes)**. Root typecheck and frontend production
build passed. Reviewed Reports, Inventory, modifiers and all three export summaries
at five sizes, plus all 25 right-scrolled report-table captures. Print preview,
Print-download and exported PDFs are byte-identical in every scope; CSV covers all
scoped records. Native viewer/OS/paper printing remains untested. PDF generation
was unchanged; this resume did not repeat historical PDF page rendering.

[HandsOff.md](HandsOff.md) retains the original request verbatim, per-bullet
acceptance evidence, logs and verification boundaries. All work is uncommitted
and frontend-only; backend integration, commits and deployment remain separate.
The completed checkpoints below are history, not instructions to repeat work.

## Previous frontend checkpoint — October 4, 2026

**Highest-priority mock dataset implemented:** exactly five sample users — Angel
(Owner), Alex (Admin), Raven, Micah and Jestine (Staff). Choose both **Preview role**
and **Preview person** on the login screen; every person has a stable actor ID and
an independent current-Manila-day receipt. Staff histories include only that person's
sales for today. Account changes remain selectable after logout within the session.

The old ten-product sellable list has been replaced with ten new products.
**Hobby uses three stock models: Stocked/retail, Variants, and Bundle; Food/Beverage
also supports Uses ingredients (recipe).** Food demonstrates all four: Grilled Beef
Sliders uses a recipe and cheese/omission options, Butter Cookie Pouch uses finished
stock, Cookie Box Sizes has Small/Large SKUs, and Cafe Snack Bundle uses two finished
components. Iced Caramel Latte and Mango Oat Smoothie use illustrative recipes.
Hobby examples are Deck Sleeves, Trading Card Binder, Model Kit Editions with
Standard/Deluxe SKUs and prices, and Tabletop Starter Bundle. Bundle and standalone
sales share stock. Hobby's editor omits recipes and changes a selected recipe model
to Stocked when switching a Food/Beverage draft to Hobby. New products use existing
category SVG icons; optional photos and original artwork/license files are preserved.

The 32 stock records include 13 Ingredients and 19 finished SKUs, with explicit units,
reorder levels and receipt quantities. Six historical and five current-Manila-day
receipts now reference the replacement products, including variant and bundle
snapshots. Opening receipts minus all seeded consumption equal current stock;
voided sales retain consumption. Low-stock, expiring and partial-expiry examples
remain. Quantities, prices and bundle contents are illustrative mock assumptions.

Final validation: **125 browser checks passed (4.0 minutes), clean exit**, plus root
typecheck and frontend production build. This includes seven checks against the
actual replacement preview in `three-stock-models.spec.ts`, and 118 interaction
regressions using explicit test-only fixtures so prior recipe/modifier scenarios
remain covered. `HandsOff.md` records the current continuation and validation scope.
Work stays frontend-only; refresh resets the sample session. No backend work, commit
or deployment was performed.

### Previous acceptance — before the mock-data update

Frontend priority acceptance is complete. Daily Sales Review, scoped Inventory controls/recipe
guidance, six-record pagination, transaction-linked ingredient reporting, Audit
selection summaries and the Lucide calendar icon are saved in the uncommitted
preview. Owner checkout completes immediately; new paid Staff/Admin sales await
Owner review and consume stock once at checkout. Owner confirmation never consumes
stock again. Historical records retain their original behavior.

Final root typecheck and frontend production build passed. All six priority cases
passed (29.6 seconds), followed by the complete browser suite: **114 passed
(3.3 minutes), clean exit**. The final attention pagination, whole-dataset CSV/Print,
recipe creation/checkout, Admin void/page clamping, Owner review without duplicate
stock use, readable ingredient headings and visible short-screen dialog headers
are verified. No additional application source/test changes were needed to finish
this acceptance continuation.

Regenerated and visually reviewed 68 UI captures across desktop, tablet, phone and
short screens, including both attention pages and populated ingredient columns.
Three fresh PDF scopes (Combined 11 pages, Inventory usage 9, Sales 2) passed data
checks; all 22 matching rendered pages were visually reviewed. QA artifacts remain
in the workspace parent `.review/frontend/priority-feedback/`. Temporary browser
servers closed cleanly; ports 5180/5181 are free. Read **HandsOff.md** for the completed
checkpoint and updated continuation script. No backend work, commit or deployment
occurred. Durable integration, physical devices, screen readers, Safari/Firefox,
OS printing and exhaustive Figma comparisons remain separate, unverified work.

## Team Members

| Name             | Role / Focus Area                                       |
| :--------------- | :------------------------------------------------------ |
| **Aquino**       | Project Manager / Research Developer / Quality Assurance |
| **Alba**      | Lead Backend Developer / Frontend Dev                  |
| **Santiago**     | Lead Frontend Developer / UI/UX Designer                     |
| **Mejia**       | Backend Developer / Research Developer / Database Manager                     |
| **Yoingco**   | Frontend Developer / UI/UX Designer                      |

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | React, Vite, TypeScript |
| Backend | Node.js, Express.js, TypeScript |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Deployment | Vercel (separate frontend and backend projects) |

## Repository Structure

```text
repo/
  backend/
    src/
      config/         # Environment configuration
      lib/            # Supabase clients and HTTP errors
      middleware/     # Token verification and error responses
      routes/         # Health and authenticated user endpoints
      app.ts          # Express app exported for Vercel
      server.ts       # Local server entry point
    supabase/         # Database design, numbered migrations and guarded dev seed
    tests/            # API smoke and authentication-boundary tests
    .env.example
    package.json
  Frontend/
    src/
      lib/            # Auth/API helpers, remembered filters, and PDF/CSV export
      components/     # Artwork, dialogs, search fields, and shared calendars
      data/           # Typed sample inventory, products, accounts, and sales
      pages/          # Login, dashboard, inventory, POS, sales history, users, reports
      App.tsx         # Preview navigation and in-memory application state
      main.tsx
      frontend.css    # Tokens, shared layout, dashboard, and inventory
      screens.css     # POS, history, dialogs, reports, and authentication
      responsive.css  # Mobile and print layouts
      admin.css       # Scoped Admin workspace styles
      staff.css       # Scoped Staff POS, daily history, and dialog styles
      redesign.css    # Shared inventory, modifiers, alerts, and report refinements
    public/assets/    # Active artwork, report font, and license notices
    design-reference/ # Preserved unused artwork/style and relocation manifest
    tests/            # Browser checks for the frontend preview
    .env.example
    vercel.json
    package.json
  package.json        # npm workspaces and shared commands
  package-lock.json
```

Use the exact `Frontend` capitalization on Linux and Vercel.

Unused design files are preserved in `Frontend/design-reference`, outside Vite's
public output. The cleanup archived 41 unreferenced artwork files and the old
scaffold stylesheet, with original paths and SHA-256 hashes in its manifest.
Active artwork, fonts, license notices, and scoped workspace styles remain in place.

## Local Development

### Frontend preview

Run `npm run dev:frontend`, open the displayed local URL, and choose **Open preview**
on the login screen. Select **Owner**, **Admin**, or **Staff**, then the **Preview person**.
Owner and Admin can
review all six pages; Staff has POS and its current Manila-day sales history.
Preview data lives in React state and resets on refresh.
No backend or Supabase credentials are needed for the preview. The login screen's
**Explore the preview** panel explains this and provides the role/person selectors. Regular
account login has no default password and requires a configured Supabase account.

Login and recovery share the navigation's charcoal, cream, and gold style, with
visible field labels, password visibility controls, and readable touch targets.
They use a split card at 900px and up and a compact stacked layout below 900px.

Navigation uses a full sidebar at 1200px and up, a compact rail at 768–1199px,
and a mobile top bar below 768px. Tablet/mobile menus open a labeled modal drawer
with keyboard focus containment, Escape/backdrop dismissal, and focus restoration.

Admin and Staff workspaces share readable typography, charcoal/cream/gold colors,
white cards, visible keyboard focus, and controls at least 44px high. Staff POS shows
subtotal, VAT, and the same total due as checkout. Today’s sales history shows this
cashier’s current Manila-day counts, readable order details, and void-review status.
New Staff/Admin sample payments remain Pending Owner review after receipt/fulfilment; void requests require Owner or Admin review.

The frontend includes:

- Dashboard alerts for pending void requests and potentially repeated orders, with
  actor/role/time evidence and links to filtered Audit Trail. Rolling detection windows
  retain qualifying bursts within longer sequences and group overlapping evidence.
  Review categories, expandable order IDs, and reversible read markers keep alerts
  manageable; new orders or a new request reopen the affected alert as unread.
  Read markers and Owner-only alert settings last until logout. Stock attention links
  highlight the affected Inventory record or batch, including expired and partly unusable
  stock. Report links preserve the selected Food and Beverage/Hobby category; daily chart
  values also have a keyboard-accessible table. Sales Overview accepts date and time
  bounds and carries them into Reports. Daily Sales Review groups pending receipts
  by local business date with Owner verification; View all requests opens daily
  reviews and void requests together in Audit Trail. Displayed timestamps omit
  the Manila suffix while retaining Asia/Manila calculations.
- Separate Ingredients, Products, and All results views; immediate name/SKU search;
  stock receiving; batch-aware quantity corrections; and optional product photos.
  Needed to Remove Stocks appears first when matching unusable stock exists,
  followed by Products and a
  separate urgency-sorted Ingredients table. Products owns retail, variant and
  component receipts, including inventory without a separate POS listing. Product and ingredient removal retain historical sale
  snapshots; live recipe/modifier dependencies block ingredient deletion.
  Records with any receipt batches show expand controls, including a single
  batch, so each batch can be edited or removed even when empty. Compatible unit changes
  convert the displayed quantity, receipt batches, and reorder threshold together.
  Stock rows show physical and usable quantities, derived expiry/reorder status, and
  reorder levels using the same calculations as Dashboard and Reports. Scrollable tables
  have keyboard-focusable named regions; products disclose stock linkage and recipe shortages.
- Product recipes, stock models, availability, discounts, and modifier groups with
  required/minimum/maximum choices. POS customization, cart editing, and checkout
  preserve distinct configurations and snapshot their prices, modifiers, and recipe inputs.
  Customization includes whole-number quantity, selected-choice counts, final unit price,
  line subtotal, and ingredient requirements with usable stock remaining after the whole
  cart. Editing excludes the replaced line from stock checks and preserves its quantity.
  Changed modifier prices/stock inputs stay separate from older cart snapshots. Recipe
  editors explain the stock model and disable unrelated finished-stock fields.
- Inventory's Modifier groups library lets Owner/Admin create, search, edit, and remove
  reusable groups, or explicitly save a product group's copy to the library. Product
  editors add independent copies with their own option identifiers and stock inputs;
  library changes never silently update existing products, cart lines, or sales.
  Default choices are visible and editable at POS, included in price and stock checks,
  and applied only when starting a new customization. Cart edits retain their saved
  selections. Default sets must satisfy choice limits, or stay empty for an explicit
  required choice. New customizations leave stock-unavailable defaults unchecked. Cart edits preserve their recorded choices and still validate stock before saving.
  Back returns from the library to Products. Nested modifier groups use white
  cards with gold borders inside a cream parent panel and separate option panels.
  Library drafts use inventory's existing discard/refresh protection. Customization
  titles and close buttons remain visible while dialog bodies scroll on short screens.
- Product variants link edition/size/color choices to distinct finished-stock SKUs and
  prices. POS requires an explicit variant choice, displays its SKU and discounted price,
  and keeps different variants in separate cart lines. Bundles have a selling price and
  fixed whole-number quantities of finished SKUs. Their POS review lists the contents;
  checkout consumes those pieces without also consuming a bundle stock count or recipes.
  Shared SKUs use one cart-wide stock balance, including standalone sales and add-ons.
  Create a Stocked product to add a new finished SKU; receive stock from its Inventory row.
  Configuration editors reject duplicate variant names/SKUs and repeated bundle components,
  incompatible stock units, and invalid prices/quantities. These models support additive
  modifiers; removals of their fixed finished stock are rejected. Drafts retain inventory's
  discard/refresh protection. Cart edits retain the saved price, variant and component
  snapshot; later catalogue changes do not rewrite existing cart lines or past sales.
  Receipts, sales history and filtered report tables/PDF/CSV retain recorded configuration
  and SKU details. New configurations start empty; the replacement mock catalogue
includes two variant products and two bundles with illustrative configurations.
- Whole-row/keyboard Audit Trail selection, visible filters, Staff void requests, and
  confirmed single/bulk voids under the current Owner or Admin's name. No Owner password
  is needed for an Admin void. Status/payment filters and search include recorded
  modifiers, payment references, and review actors. Linked investigations retain their
  evidence and can restore all orders. Bulk selection shows amounts and warns about
  selected orders hidden by filters, with an action to retain only visible selections.
  Order details show a Manila-time review timeline based on recorded preview fields,
  disclose missing historical roles/stock handling, and remain keyboard-accessible.
  Mobile/tablet timelines scroll with the page. Original sales and review attribution
  remain visible; the timeline retains only the latest request, not a durable event ledger.
- Owner/Admin/Staff account choices and a three-step account wizard. The provisional
  preview policy lets Owner assign all roles and Admin manage Staff; the last Owner
  cannot be removed/demoted and the signed-in account cannot be deleted.
  Users supports immediate name/username/email search, remembered role filters,
  a signed-in account marker, and clear explanations for restricted actions.
  Manage dialogs show account identifiers and selected-role access. Deletion has
  a separate review with Keep account initially focused; cancelling preserves edits.
  The wizard provides field guidance, an account summary, and password visibility.
  Back/cancel clears password inputs; verification and creation remain sample-only.
- Sales, Inventory usage, and Combined reports with matching filtered PDF/CSV downloads
  and a Print preview that uses the same cached PDF as export. Future report dates
  are blocked in calendars and rejected when typed. Ingredient percentage bars
  reconstruct opening stock, receipts, consumption and removals for the selected
  business dates; current physical/usable stock remains separate. Missing snapshots
  or unavailable opening balances do not produce invented percentages.
  Tables retain readable headings, intact status words and aligned numeric values.
  Sales category filters allocate
  mixed orders' recorded totals consistently with Dashboard; Combined inventory sections
  explicitly cover all inventory categories independently of the sales category filter.
- Checkout focuses the payment choice and active Cash/QR field for every role;
  returning to confirmation restores the payment choice. Payment titles and close
  buttons stay visible while dialog bodies scroll. Escape restores Pay focus and
  retains the cart.
- Remembered page filters within a preview login, shared keyboard-accessible calendars,
  and inventory edit warnings for Cancel, Back, sidebar navigation, logout, and refresh.
  Clearing a shared search returns focus to its input after results restore and keeps
  the search visible on small screens, ready for immediate typing.

Password recovery and account verification use the sample code `123456` when Supabase
is unconfigured. Preview passwords are never saved. The QR artwork is a design example
and does not collect payments. The checkout uses the design's sample 12% VAT calculation.

New paid/fulfilled preview checkout for every role deducts stock in memory once: made-to-order products
consume their recipe/modifier inputs, and stocked products consume linked finished stock.
Variants consume the chosen finished SKU; bundles consume their listed finished pieces.
Usable batches are consumed in expiry order. New Staff/Admin Pending checkout records received payment/fulfilment and consumes stock before Owner review. Historical uncommitted Pending requirements remain unchanged. Owner review changes status only. Voids retain consumed stock and do not imply payment refunds.
All ten current catalogue fixtures link valid Ingredient recipes or finished stock.
Hobby uses only Stocked, Variants or Bundle configurations. Food/Beverage may also
use recipes; Grilled Beef Sliders demonstrates ingredient additions/omissions.
Recipes, quantities and configurations are illustrative; these are provisional
preview rules.

These interactions do not implement server role policies, durable daily sales reviews,
account provisioning, verified GCash payments, durable stock movements/audit events,
historical opening/closing balances, or real bulk-void concurrency/partial failures.
Durable variant/bundle records and live synchronization of library changes remain future work.
Bundle revenue uses the parent product's selling category; stock usage still lists every
component SKU. Nested bundles, recipe-based components, production batches, and
component-level mixed-category revenue allocation are not implemented.
Backend integration is a separate phase. The normal login can call
the protected credential exchange when configured; it resolves a real active profile
and opens the account screen. PKCE recovery/password changes are implemented, with
hosted redirect settings and emailed recovery acceptance complete. Business CRUD remains P5. Dashboard cards and the nine-day chart derive from the shared preview sales and inventory;
reports calculate from those same transactions. Manila business dates are used for order IDs,
report filters, and Staff history. Preview cashier IDs are client-side identifiers only; Staff history uses Manila business dates rather than shifts.

### Development setup

Install Node.js 24 LTS. From the repository root:

```powershell
npm install
Copy-Item backend/.env.example backend/.env
Copy-Item Frontend/.env.example Frontend/.env
npm run dev
```

The frontend runs at http://localhost:5173; the backend runs at http://localhost:3001.
Vite proxies `/api` requests to the backend locally. Leave `VITE_API_BASE_URL` blank for this setup.
If the backend port changes, also update `API_PROXY_TARGET` in `Frontend/.env`.

You can run the apps in separate terminals with `npm run dev:backend` and `npm run dev:frontend`.
Supabase credentials are optional for the frontend preview; normal authentication returns a
configuration error until credentials are added. The health response reports whether settings
are present, not whether a database connection has been tested.

## Supabase Setup

1. Create a Supabase project and obtain its project URL and **publishable** API key.
2. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `backend/.env`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `Frontend/.env`.
4. Configure Supabase Auth's Site URL and allowed redirects for your local and production frontend URLs.
5. Configure `SUPABASE_SECRET_KEY` on the backend only for username login and Auth account
   administration. The requested temporary Owner is already provisioned in development.
6. The approved local signup/redirect settings are configured; see AUTHENTICATION.md.
   Emailed recovery/password/login was user-verified using a fresh same-browser link.
7. Restart the development processes after editing environment variables.

The frontend includes real profile/session routing and PKCE recovery plus a separate
password-reset preview when unconfigured. Database and account commands are applied
and verified in development. P4 business policies are applied/verified; workflow commands remain pending.
The backend verifies access tokens with Supabase Auth rather than trusting client-provided identities.

Only publishable keys belong in `VITE_*` variables: Vite includes these values in the browser bundle.
Keep any future Supabase secret/service-role keys exclusively on the server. Username login and account provisioning require the server secret; browser code
rejects privileged keys. Enable Row Level Security and create access policies before exposing tables.
The backend's user-scoped database client forwards the caller's token so database policies apply.

## API Endpoints

| Method | Path | Access | Purpose |
| :--- | :--- | :--- | :--- |
| GET | `/api/health` | Public | API status and whether Supabase settings are present |
| POST | `/api/auth/login` | Public credentials | Verified active-account session; email or username |
| GET | `/api/auth/me` | Bearer access token | Verified ID/email and active profile/role |
| GET | `/api/auth/accounts` | Active Owner/Admin | Complete authorized profile/email list; Admin Staff plus self |
| GET | `/api/inventory` | Active Owner/Admin | One coherent catalogue/batch/balance snapshot |
| POST | `/api/inventory/commands` | Active Owner/Admin | Revisioned aggregate saves, movements and archival |
| POST | `/api/inventory/images` | Active Owner/Admin | Optional immutable raster upload |
| POST | `/api/inventory/image-urls` | Active Owner/Admin | Bounded private signed image URLs |
| POST | `/api/auth/accounts` | Active Owner/Admin | Create permitted accounts transactionally with Auth/profile/audit |
| PATCH | `/api/auth/accounts/:id` | Active Owner/Admin | Update permitted profiles/deactivate with revision and account protections |

`Frontend/src/lib/api.ts` attaches the current Supabase session token automatically.
Authentication enforces active profiles and account-management permissions. Broader
business permissions/review checks still precede POS or inventory endpoints. No sales
or stock movements have been seeded.

## Validation

```powershell
npm run typecheck
npm test
npm run build
npm run test:e2e --workspace Frontend
```

The API tests cover health, unauthorized requests, missing routes, malformed JSON, and CORS rejection.
Database tests execute the migrations in embedded PostgreSQL and verify constraints,
restricted access, ledger/audit rollback, immutable history and disk persistence.
They do not need live Supabase credentials. Actual login and Data API access require
a configured Supabase development project and the later role policies.

The frontend browser tests cover checkout and void traceability, duplicate GCash references,
stock batches, account-wizard validation, staff navigation, CSV export, mobile overflow,
void-request approval across role switching, recovery field/icon resets, and discounted
product checkout through dashboard/report totals. Eight additional navigation cases
check keyboard focus, dismissal/restoration, touch targets, breakpoint cleanup,
Staff rail tooltips, short-screen scrolling, and cart preservation. Three login cases
check keyboard password visibility, role entry/logout, recovery validation/focus,
and resize/short-screen access. Three Admin cases check responsive tables/controls,
short-screen account dialog focus, and role style isolation. Three Staff cases check
responsive totals/cart retention, payment validation/focus, and Manila daily summaries
with void review across roles. Fourteen redesign cases cover role distinctions,
inventory search/photos, customized checkout and snapshots, actionable alerts,
bulk voids, calendars, and direct PDF downloads. Two stock-model cases cover unit
conversion, modifier omissions, and expiry-aware consumption. Seven continuation
cases cover unsaved edit protection, category isolation, calendar dismissal/date
limits, and displayed stock/batch/threshold unit conversion. Five Dashboard/Reports cases
cover mixed-order category totals and CSV, empty linked-order filters, actionable expired
batches, mobile chart values/filter retention, and cent-level category reconciliation.
Eight Audit Trail/alert cases cover rolling duplicate windows and basket identity,
recorded review chronology and stock disclosures, status/payment/search filters,
hidden bulk selections, renewed unread evidence and linked context, Admin approval
attribution/reason preservation, and small-screen keyboard/Staff role isolation.
Six Inventory/POS cases cover cart-wide stock checks, quantity validation and cancellation,
modifier stock limits, edited-price/recipe cart snapshots, expiry/replenishment consistency,
and small-screen Staff keyboard access with Pending stock behavior.
The original suite had 108 tests, including Users search/filter retention, wizard identifier
validation and password clearing, deletion cancellation/focus, account restrictions,
and small-screen dialog header/keyboard access.
Seven modifier-library cases cover copy/identifier isolation, defaults and unit validation,
Admin library creation/search and Hobby-product reuse, library edit/removal isolation,
repeated imports, independent library/product saves, retained cart choices and unavailable
defaults, and mobile draft protection/Staff access. Stock-shortage review also checks that
the customization header and close action remain visible on short screens.
Nine checkout keyboard cases cover Owner/Admin/Staff Cash and QR stage focus,
return/cancellation, cleared QR drafts, Escape restoration and cart retention,
and visible payment headers at desktop, short-screen, and small-phone sizes.
Eight variant/bundle cases cover shared-SKU consumption, expiry and configuration validation,
snapshot identities/pricing, required POS selection, SKU search and CSV exports, component
deductions, old cart/sale snapshots after catalogue edits, mobile draft protection, and
Staff paid Pending checkout with once-only stock deduction.
Nine shared-search cases cover Owner/Admin/Staff at desktop, short-tablet, and
small-phone sizes. Clear supports Enter, Space, and pointer activation, restores
input focus after results update, keeps the field visible below mobile navigation,
and accepts immediate typing while retaining category, inventory-view, and role filters.
Six priority-feedback cases cover Staff/Admin paid checkout and Owner receipt review,
Inventory scope/recipe creation/paging, Admin void attribution/page clamping/stock
retention, Audit toggles and cross-page selections, whole-dataset CSV/Print exports
and filter reset, plus responsive headings/calendar/dialog access.
Four mock-data cases cover the five-account role distribution, per-person Staff
history and refresh reset, every product/modifier stock link, receipt/VAT/usage/batch
reconciliation, all-product checkout, Owner review, named Admin void and matching CSV.
On Windows they use the installed Microsoft Edge browser. On other systems, first run
`npx playwright install chromium` from `Frontend`. Set `PLAYWRIGHT_BROWSER_CHANNEL`
to override the browser channel. The test setup owns a Vite server on port 5180 and closes it directly at teardown.
This avoids Windows subprocess cleanup hangs; port 5180 must be free before running tests.

After building, run `npm run start --workspace backend` to serve the compiled API.
For `npm run preview --workspace Frontend`, set `VITE_API_BASE_URL` before building;
the development `/api` proxy is not included in the production build.

## Vercel Deployment

Create **two Vercel projects** connected to this repository:

| Setting | Backend project | Frontend project |
| :--- | :--- | :--- |
| Root directory | `backend` | `Frontend` |
| Framework | Express (auto-detected) | Vite |
| Build command | `npm run build` | `npm run build` |
| Output directory | Leave framework default | `dist` |
| Node.js version | 24.x | 24.x |

Allow each project to access files outside its root directory so Vercel can install from the
shared workspace lockfile. Use the framework's default install command. The backend's
`src/app.ts` default export is the Vercel entry point; `server.ts` is for local/compiled hosting.

Backend environment variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `CORS_ORIGINS`: exact frontend URL(s), comma-separated, without trailing slashes.

Frontend environment variables:

- `VITE_API_BASE_URL`: backend deployment origin, for example `https://vertwell-api.vercel.app`, without `/api`.
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Redeploy the frontend after changing `VITE_*` settings; they are embedded at build time.
Add preview frontend origins explicitly to backend CORS if using Vercel preview deployments.
The frontend rewrite supports client-side routes; production API requests use the backend origin.
No Vercel or Supabase resources are provisioned by this scaffold.

## Next Implementation Steps — Backend phase

- P0 is saved and verified on GitHub. Backend work now stays local until all backend tasks are finished. HandsOff.md preserves the complete original requests.
- P1/P2/P2A/P3/P4/P5/P6 acceptance is recorded in HandsOff.md. P6 hosted verification is complete; checkout was disabled after the approved test window.
- Preserve both original Owners, the two user-requested active Admin/Staff accounts and all acceptance history.
- Preserve disabled checkout until the user requests activation for use; do not repeat completed P6 acceptance without a new reason.
- Add P7 durable Owner daily-sales review, void decisions and audit workflows.
- Connect P8 reports and exports to durable sales/movement reconciliation.
- Define P9 payment verification, notifications and synchronization separately.

References: [Vercel Express](https://vercel.com/docs/frameworks/backend/express),
[Vercel Vite](https://vercel.com/docs/frameworks/frontend/vite),
[Supabase database](https://supabase.com/docs/guides/database/overview),
[Supabase Auth](https://supabase.com/docs/guides/auth).
