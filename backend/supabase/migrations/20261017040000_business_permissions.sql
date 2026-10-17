-- P4 authorization. Read policies open only the documented scopes. Aggregate
-- inventory/checkout/review writes remain unavailable until P5/P6/P7 commands.
begin;

create function private.business_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create function private.business_permissions(account_role text) returns text[]
language sql immutable set search_path = '' as $$
  select case account_role
    when 'Owner' then array['dashboard.read','inventory.read','inventory.write','reports.read',
      'pos.read','checkout.create','sales.read','void.request','void.decide','sale.void',
      'review.confirm','accounts.read','accounts.create','accounts.update','alerts.read','alerts.write']
    when 'Admin' then array['dashboard.read','inventory.read','inventory.write','reports.read',
      'pos.read','checkout.create','sales.read','void.request','void.decide','sale.void',
      'accounts.read','accounts.create','accounts.update']
    when 'Staff' then array['pos.read','checkout.create','sales.read','void.request']
    else array[]::text[] end
$$;

-- Never trust JWT app/user metadata, a supplied actor or a caller's date/role.
-- This is authorization only: later mutations must recheck it in their own
-- transaction, under the account lock, and commit their own attributed audit.
create function public.authorize_business_action(action text, target_sale_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor public.profiles; target public.sales;
  today date := (statement_timestamp() at time zone 'Asia/Manila')::date;
begin
  select * into actor from public.profiles where id = auth.uid() and active;
  if actor.id is null or not coalesce(action = any(private.business_permissions(actor.role)),false) then
    raise exception 'Business access is not permitted' using errcode = '42501';
  end if;
  if action in ('void.request','void.decide','sale.void') and target_sale_id is null then
    raise exception 'A sale is required' using errcode = '22023';
  end if;
  if target_sale_id is not null then
    if action not in ('sales.read','void.request','void.decide','sale.void') then
      raise exception 'This action does not accept a sale' using errcode = '22023';
    end if;
    select * into target from public.sales where id = target_sale_id;
    if target.id is null or (actor.role = 'Staff' and
      (target.cashier_id <> actor.id or target.business_date <> today)) then
      -- Do not reveal whether an inaccessible sale exists.
      raise exception 'Business access is not permitted' using errcode = '42501';
    end if;
    if action <> 'sales.read' and target.status = 'Voided' then
      raise exception 'Sale is already voided' using errcode = '40001';
    end if;
  end if;
  return jsonb_build_object('profile',to_jsonb(actor),'businessDate',today);
end $$;

create function public.business_access() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor public.profiles;
begin
  select * into actor from public.profiles where id = auth.uid() and active;
  if actor.id is null then raise exception 'Business access is not permitted' using errcode = '42501'; end if;
  return jsonb_build_object('profile',to_jsonb(actor),
    'businessDate',(statement_timestamp() at time zone 'Asia/Manila')::date,
    'permissions',private.business_permissions(actor.role));
end $$;

-- Management-only tables include recipes, physical stock and stock usage.
-- Staff's POS projection below does not grant access to this management dataset.
do $$
declare t text;
begin
  foreach t in array array['inventory_units','skus','stock_items','stock_batches','products',
    'product_recipe_items','product_variants','modifier_groups','modifier_options','modifier_stock_inputs',
    'bundle_components','bundle_component_modifiers','sale_item_stock_usage','stock_movements',
    'cash_movements','daily_sales_reviews','daily_sales_review_items'] loop
    execute format('create policy management_read on public.%I for select to authenticated
      using ((select private.business_role()) in (''Owner'',''Admin''))',t);
  end loop;
end $$;

create policy profile_read on public.profiles for select to authenticated using (
  (select private.business_role()) = 'Owner' or
  ((select private.business_role()) = 'Admin' and (role = 'Staff' or id = (select auth.uid()))) or
  ((select private.business_role()) = 'Staff' and id = (select auth.uid()))
);
create policy sale_read on public.sales for select to authenticated using (
  (select private.business_role()) in ('Owner','Admin') or
  ((select private.business_role()) = 'Staff' and cashier_id = (select auth.uid()) and
    business_date = (statement_timestamp() at time zone 'Asia/Manila')::date)
);
create policy item_read on public.sale_items for select to authenticated using (
  exists (select 1 from public.sales s where s.id = sale_id)
);
create policy purchased_modifier_read on public.sale_item_modifiers for select to authenticated using (
  exists (select 1 from public.sale_items i where i.id = sale_item_id)
);
create policy payment_read on public.payments for select to authenticated using (
  exists (select 1 from public.sales s where s.id = sale_id)
);
create policy request_read on public.void_requests for select to authenticated using (
  (select private.business_role()) in ('Owner','Admin') or
  ((select private.business_role()) = 'Staff' and requested_by = (select auth.uid()) and
    exists (select 1 from public.sales s where s.id = sale_id))
);
create policy audit_read on public.audit_events for select to authenticated using (
  (select private.business_role()) = 'Owner' or
  ((select private.business_role()) = 'Admin' and entity_type <> 'alert_settings' and
    (entity_type <> 'profile' or exists (select 1 from public.profiles p where p.id = entity_id and p.role = 'Staff'))) or
  ((select private.business_role()) = 'Staff' and entity_type = 'sale' and
    exists (select 1 from public.sales s where s.id = entity_id))
);
create policy alert_settings_read on public.alert_settings for select to authenticated
  using ((select private.business_role()) = 'Owner');

-- The API read projection also runs as the caller, so direct RPC and table reads
-- have the same RLS scope. Money is text before JSON encoding, never a JS float.
create function public.read_business_sales(target_sale_id uuid default null,
  page_offset integer default 0, page_size integer default 50) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare scope jsonb; result jsonb; more boolean;
begin
  scope := public.authorize_business_action('sales.read',target_sale_id);
  if page_offset is null or page_offset < 0 or page_offset > 1000000 or
    page_size is null or page_size < 1 or page_size > 100 then
    raise exception 'Invalid pagination' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(to_jsonb(s) - 'request_hash' - 'idempotency_key' ||
    jsonb_build_object('subtotal',s.subtotal::text,'tax_amount',s.tax_amount::text,'total',s.total::text)
    order by s.occurred_at desc,s.id desc),'[]'::jsonb) into result
    from (select * from public.sales where target_sale_id is null or id = target_sale_id
      order by occurred_at desc,id desc offset page_offset limit page_size) s;
  select exists (select 1 from public.sales where target_sale_id is null or id = target_sale_id
    offset page_offset + page_size limit 1) into more;
  return jsonb_build_object('version',1,'businessDate',scope->'businessDate','items',result,'hasMore',more);
end $$;

-- A small selling-card projection, not a usable-stock promise or checkout API.
-- Recipe inputs, batch quantities, library drafts and physical stock are absent.
create function public.read_pos_catalogue(page_offset integer default 0, page_size integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; more boolean;
begin
  perform public.authorize_business_action('pos.read');
  if page_offset is null or page_offset < 0 or page_offset > 1000000 or
    page_size is null or page_size < 1 or page_size > 100 then
    raise exception 'Invalid pagination' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'sku',s.value,
    'category',p.category,'stockModel',p.stock_model,'basePrice',p.base_price::text,
    'discountType',p.discount_type,'discountValue',p.discount_value::text,
    'imagePath',p.image_path,'icon',p.icon) order by lower(p.name),p.id),'[]'::jsonb) into result
    from (select * from public.products where archived_at is null and enabled
      order by lower(name),id offset page_offset limit page_size) p join public.skus s on s.id=p.sku_id;
  select exists (select 1 from public.products where archived_at is null and enabled
    offset page_offset + page_size limit 1) into more;
  return jsonb_build_object('version',1,'checkoutReady',false,'items',result,'hasMore',more);
end $$;

-- Settings are the one P4 business mutation. The current Owner, revision and
-- audit are checked/written atomically; a prior API permission check is insufficient.
create function private.touch_alert_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := greatest(clock_timestamp(),old.updated_at + interval '1 microsecond');
  return new;
end $$;
drop trigger touch_updated_at on public.alert_settings;
create trigger touch_updated_at before update on public.alert_settings
for each row execute function private.touch_alert_revision();

create function public.update_alert_settings(expected_updated_at timestamptz,
  similar_order_threshold integer, window_minutes integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor public.profiles; previous public.alert_settings; saved public.alert_settings;
begin
  perform pg_catalog.pg_advisory_xact_lock(171026,3);
  perform pg_catalog.pg_advisory_xact_lock(171026,4);
  perform public.authorize_business_action('alerts.write');
  select * into actor from public.profiles where id=auth.uid() and active;
  if actor.id is null or actor.role <> 'Owner' then
    raise exception 'Business access is not permitted' using errcode = '42501';
  end if;
  select * into previous from public.alert_settings where singleton;
  if previous.updated_at is distinct from expected_updated_at then
    raise exception 'Settings changed; reload before saving' using errcode = '40001';
  end if;
  insert into public.alert_settings(similar_order_threshold,window_minutes,updated_by)
    values (update_alert_settings.similar_order_threshold,update_alert_settings.window_minutes,actor.id)
    on conflict (singleton) do update set similar_order_threshold=excluded.similar_order_threshold,
      window_minutes=excluded.window_minutes,updated_by=excluded.updated_by returning * into saved;
  insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,operation_id)
    values (actor.id,actor.full_name,actor.role,'Alert settings updated','alert_settings','00000000-0000-0000-0000-000000000001',
      'Owner changed unusual-sales thresholds',jsonb_build_object('before',to_jsonb(previous),'after',to_jsonb(saved)),gen_random_uuid());
  return to_jsonb(saved);
end $$;

-- No INSERT/UPDATE/DELETE/TRUNCATE grants or policies. A service key cannot read
-- business tables either; it remains restricted to P3 Auth administration.
-- Only these P4 reads are reachable. Management/profile/ledger tables keep zero
-- table grants until their specific P5/P7/P8 services are implemented/reviewed.
-- Every reachable table has a SELECT-only policy above; Staff is own-day scoped.
grant select on public.sales,public.sale_items,public.sale_item_modifiers,
  public.payments,public.void_requests,public.alert_settings to authenticated;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public,anon,authenticated,service_role;
grant execute on function private.business_role() to authenticated;
revoke all on function public.business_access(), public.authorize_business_action(text,uuid),
  public.read_business_sales(uuid,integer,integer),public.read_pos_catalogue(integer,integer),
  public.update_alert_settings(timestamptz,integer,integer) from public,anon,service_role;
grant execute on function public.business_access(), public.authorize_business_action(text,uuid),
  public.read_business_sales(uuid,integer,integer),public.read_pos_catalogue(integer,integer),
  public.update_alert_settings(timestamptz,integer,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
