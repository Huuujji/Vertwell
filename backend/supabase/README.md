# Database workspace

Add reviewed, numbered PostgreSQL migrations to `migrations/` as the business schema is implemented.
No business tables or sample sales are created by this scaffold.

- Enable Row Level Security on every table exposed through Supabase's Data API.
- Define Owner/Admin/Staff policies explicitly; do not rely on hidden frontend buttons.
- Save a checkout, its inventory movements, and its audit event in a single transaction.
  Multiple separate Supabase SDK calls do not constitute one transaction. Use a PostgreSQL
  function called through RPC or a transactional database connection for this operation.
- Add unique constraints for payment references and idempotency keys, and protect stock
  updates against concurrent checkouts.
- Preserve historical sale prices and recipe deductions when products change.
- Use Supabase Auth for identity; business roles and shift approvals still need implementation.

