-- P8: one read-only MVCC snapshot. No ledger writes or additional table grants.
begin;
create function public.read_reports() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor public.profiles; t text; tables jsonb := '{}';
begin
  actor := private.inventory_actor(); -- resolves current active Owner/Admin, never JWT metadata
  foreach t in array array['inventory_units','skus','stock_items','stock_batches',
    'stock_movements','sales','sale_items','sale_item_modifiers','sale_item_stock_usage',
    'payments','daily_sales_reviews','daily_sales_review_items','cash_movements','void_requests'] loop
    tables := tables || jsonb_build_object(t,private.inventory_rows(t));
  end loop;
  return jsonb_build_object('version',1,'generatedAt',statement_timestamp(),
    'businessDate',(statement_timestamp() at time zone 'Asia/Manila')::date,'tables',tables);
end $$;
revoke all on function public.read_reports() from public,anon,authenticated,service_role;
grant execute on function public.read_reports() to authenticated;

create or replace function public.business_access() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor public.profiles;
begin
  actor := private.checkout_actor();
  return jsonb_build_object('profile',to_jsonb(actor),'businessDate',(statement_timestamp() at time zone 'Asia/Manila')::date,
    'permissions',private.business_permissions(actor.role),'services',jsonb_build_object('inventoryCrud',true,
      'checkout',(select enabled from private.checkout_state where singleton),'salesReview',true,'reports',actor.role in ('Owner','Admin')));
end $$;
notify pgrst, 'reload schema';
commit;
