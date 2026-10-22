# October 21 frontend priority contracts

The complete original request and follow-up remain verbatim in `../../HandsOff.md`. The two unfinished receipt requests are deferred at the user's explicit instruction. The later seven final recommendations have now been selected; `RELEASE_READINESS.md` and the newest HandsOff checkpoint record their current scope, evidence and unresolved release decisions.

## Application behavior

- Only database accounts can enter the application. Sample accounts, stock and sales live in test fixtures, with no preview entry or production fixture initialization.
- Pages use `/Login`, `/Dashboard`, `/Inventory`, `/POS`, `/Reports`, `/Audit-Trail` and `/Users`. Direct links retain role checks. The existing Vite and Vercel SPA fallback handles refreshes. Localhost remains the local address; no custom domain or hosting change is included.
- Navigation and new operational records use usernames. Account management still retains the full name for editing. Existing immutable historical attribution is preserved.
- Passwords continue to be managed by Supabase Auth. Password fields are masked by default, and account-creation retry signatures retain a digest rather than plaintext. Login returns only required session tokens. No stored password or password hash is exposed by account/profile APIs. A person controlling their own browser can inspect the password they type, session tokens and authentication subject IDs; hiding those through CSS or client hashing would not provide confidentiality. IDs remain necessary for verified sessions, role checks and live updates.
- Pagination appears only when there are at least two pages. Operational tables show newest records first, with stable ID tie breaks; inventory batches retain their original batch numbers. Creating a new batch does not alter FIFO consumption rules.
- SVG information disclosures reveal calculation explanations on demand. Daily review compares expected, verified and difference amounts in separate cash/GCash cards. Current stock attention appears before report totals and tables.

## Inventory

Creation assigns a SKU in the database while holding the existing catalogue lock. There is no editable SKU or Generate control. Existing SKU values are retained when editing. Matching active ingredient/product names are compared after trimming, collapsing whitespace and ignoring case. The user must confirm before receiving a new batch against existing stock. That flow preserves the existing SKU, configuration and other batches. Recipe/variant/bundle products direct deliveries to their underlying stock rather than creating another product. SQL repeats the name check under the shared command lock to prevent a concurrent duplicate.

Whole-unit starting quantities, receipts and alerts must be at least 1. Measured ingredients accept positive fractions. Existing stock corrections can still reach zero, and existing zero balances remain valid. Creation and receipt forms supply standard audit reasons; editing stock continues to ask for a reason. Stock dates, units, exact decimals, revision checks and idempotency protection remain enforced.

## Daily sales review and VAT

Only checked, eligible receipts for one business date are submitted as command targets and verified IDs. Expected cash and GCash totals are calculated from that selection. At least one receipt is required; unchecked receipts stay pending. SQL still requires the exact included receipt set, current content tokens, valid money and Owner authorization. Review notes are optional even when the Owner explicitly accepts a displayed difference. Matched reviews must still have equal amounts; historical explained-discrepancy outcomes remain valid. An empty review queue is hidden.

VAT remains the existing fixed 12% checkout rate. Quote and receipt decoding validates tax rounded once to cents against the subtotal, as well as line totals and total due; there is no user-editable VAT field.

The new migration `20261021010000_frontend_priority_contracts.sql` updates these contracts without modifying any previously applied migration. It preserves each installed function's later locking, security and retry changes.

## Maintenance sales reset

`backend/scripts/reset-sales.ts` is a privileged CLI, with no application endpoint or automatic startup/migration execution. Its default is a dry run with a transaction rollback:

```powershell
node --import tsx scripts/reset-sales.ts --project-ref izdemgzdywtxhvgvsian
```

A committed reset additionally requires `--apply --confirm <exact-dry-run-token>`. A changed snapshot rejects the token. Before commit, the command writes a complete backup of affected business rows to the ignored workspace `.review/sales-reset/` directory, outside the repository. Accounts and authentication credentials are not deleted or included in that backup.

The reset removes sales, payment/receipt rows, purchased configuration/usage snapshots, review and void history, sales retry receipts and sales notifications. Independent cash adjustments and unrelated account/inventory logs remain. Existing consumption movements become unlinked stock corrections with their exact original quantities retained. This is necessary to erase sale references while keeping each batch's present physical balance. It does not replenish sold stock.

The reset holds the shared writer locks and table locks, temporarily disables the affected user triggers inside the transaction, restores every original trigger state, verifies exact protected account/catalogue/settings hashes and every batch balance, then invalidates current views. Errors roll back the entire database operation. The backup includes the original movement and audit rows. The disposable tests verify deletion, preservation, guard restoration, rollback and a fresh checkout after reset.

## Verification boundary

Root unit/database/API checks, typechecks, builds and generated-schema verification cover this implementation. The later seven-recommendation task has explicit browser permission and adapts the current end-to-end suite; see `RELEASE_READINESS.md` and HandsOff for final results. Future tasks must always ask before browser navigation/detail entry under the user's updated rule. Historical preview-dependent browser tests are not acceptance for this account-only application. Actual-device/screen-reader verification remains distinct from desktop browser viewport tests.

### Easy manual checks

1. Restart the local app with `npm run dev` from the repository root, open `http://localhost:5173/Login`, and sign in with your real account. The preview picker should be gone and the navigation should show your username.
2. Open Inventory, Reports and Audit Trail. Their names should appear in the URL; try Back, Forward and Refresh. A table with one page should have no pagination controls.
3. In Add Ingredient or Add Product, type an existing name and move out of the name field. Confirm should open a new-batch receipt for existing stock; Cancel should keep your draft. You can cancel the receipt without saving anything. Creating an item should show automatic SKU assignment and no stock-change reason field; editing existing stock should still show its reason field.
4. When there are genuine pending staff sales, open Daily Sales Review. Check only one receipt, verify that expected cash/GCash updates, and use the information icons to expand the explanations. Notes should say optional. Confirm only when you intend to record that review.
5. In Reports, current Needs attention should appear above the summaries and tables. Inspect inventory action rows at your normal desktop/mobile size to check the shared right edge of Remove buttons.
