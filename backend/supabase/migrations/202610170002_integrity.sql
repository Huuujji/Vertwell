begin;

-- Full FK indexes also cover archived rows; partial live-catalogue indexes do not.
create index stock_batches_stock_fk on public.stock_batches(stock_item_id);
create index recipe_items_stock_fk on public.product_recipe_items(stock_item_id);
create index variants_stock_fk on public.product_variants(stock_item_id);
create index modifier_groups_source_fk on public.modifier_groups(source_group_id);
create index modifier_inputs_stock_fk on public.modifier_stock_inputs(stock_item_id);
create index bundle_components_stock_fk on public.bundle_components(stock_item_id);
create index bundle_components_variant_fk on public.bundle_components(variant_id);
create index bundle_modifiers_option_fk on public.bundle_component_modifiers(option_id);
create index sales_voided_by_fk on public.sales(voided_by);
create index sale_items_product_fk on public.sale_items(product_id);
create index sale_items_variant_fk on public.sale_items(variant_id);
create index sale_modifiers_option_fk on public.sale_item_modifiers(option_id);
create index stock_movements_actor_fk on public.stock_movements(actor_id);
create index cash_movements_sale_fk on public.cash_movements(sale_id);
create index cash_movements_actor_fk on public.cash_movements(actor_id);
create index void_requests_requester_fk on public.void_requests(requested_by);
create index void_requests_reviewer_fk on public.void_requests(reviewed_by);
create index daily_reviews_owner_fk on public.daily_sales_reviews(owner_id);
create index alert_settings_actor_fk on public.alert_settings(updated_by);

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create function private.deny_history_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'History is append-only: %. Use archival or an explicit correcting event.', tg_table_name
    using errcode = '23514';
end $$;

create function private.guard_sale_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Generated columns are not populated in NEW until AFTER BEFORE triggers.
  -- occurred_at remains frozen, so its generated business date cannot change.
  if (to_jsonb(new) - array['business_date','status','review_state','voided_at','voided_by','voided_name','voided_role','void_reason','bulk_action_id'])
    is distinct from
    (to_jsonb(old) - array['business_date','status','review_state','voided_at','voided_by','voided_name','voided_role','void_reason','bulk_action_id'])
    or old.status = 'Voided'
    or (old.review_state in ('Reviewed','Owner checkout') and new.review_state <> old.review_state)
    or (old.status = 'Completed' and new.status = 'Pending') then
    raise exception 'Sale snapshots and completed workflow history cannot be rewritten' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger sales_update_guard before update on public.sales
for each row execute function private.guard_sale_update();

create function private.guard_void_request_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'Pending' or new.status = 'Pending'
    or (to_jsonb(new) - array['status','reviewed_by','reviewed_name','reviewed_role','reviewed_at','decision_reason'])
      is distinct from
      (to_jsonb(old) - array['status','reviewed_by','reviewed_name','reviewed_role','reviewed_at','decision_reason']) then
    raise exception 'Void requests retain their original request and final decision' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger void_requests_update_guard before update on public.void_requests
for each row execute function private.guard_void_request_update();

create function private.check_stock_item() returns trigger
language plpgsql set search_path = '' as $$
declare old_family text; new_family text;
begin
  select family into new_family from public.inventory_units where code = new.unit_code;
  if new_family in ('count','bottle') and new.threshold_base <> trunc(new.threshold_base) then
    raise exception 'Counted thresholds must be whole quantities' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    select family into old_family from public.inventory_units where code = old.unit_code;
    if new_family is distinct from old_family then
      raise exception 'Stock unit changes must stay in the same unit family' using errcode = '23514';
    end if;
    if new.kind <> old.kind then
      raise exception 'Stock kind is stable; create a separate stock record' using errcode = '23514';
    end if;
    if new.category <> 'Hobby' and exists (select 1 from public.stock_batches b
      where b.stock_item_id = new.id and (b.manufactured_on is null or b.expires_on is null)) then
      raise exception 'Food/Beverage receipt batches require both dates' using errcode = '23514';
    end if;
    if new.archived_at is not null and old.archived_at is null and (
      exists (select 1 from public.products p where p.stock_item_id = new.id and p.archived_at is null)
      or exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id
        where v.stock_item_id = new.id and v.archived_at is null and p.archived_at is null)
      or exists (select 1 from public.product_recipe_items r join public.products p on p.id = r.product_id
        where r.stock_item_id = new.id and p.archived_at is null)
      or exists (select 1 from public.modifier_stock_inputs i join public.modifier_options o on o.id = i.option_id
        join public.modifier_groups g on g.id = o.group_id where i.stock_item_id = new.id
          and o.archived_at is null and g.archived_at is null)
      or exists (select 1 from public.bundle_components c join public.products p on p.id = c.bundle_product_id
        where c.stock_item_id = new.id and p.archived_at is null)
    ) then
      raise exception 'Remove active catalogue dependencies before archiving stock' using errcode = '23514';
    end if;
    if new.archived_at is not null and exists (select 1 from public.stock_batches b
      join public.stock_movements m on m.batch_id = b.id where b.stock_item_id = new.id
      group by b.id having sum(m.quantity_base) <> 0) then
      raise exception 'Record physical removal before archiving stock' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger stock_items_integrity before insert or update on public.stock_items
for each row execute function private.check_stock_item();

create function private.check_batch() returns trigger
language plpgsql set search_path = '' as $$
declare category text;
begin
  select s.category into category from public.stock_items s where s.id = new.stock_item_id for update;
  if category <> 'Hobby' and (new.manufactured_on is null or new.expires_on is null) then
    raise exception 'Food/Beverage receipt batches require both dates' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if new.stock_item_id <> old.stock_item_id then
      raise exception 'A receipt batch cannot move to another stock record' using errcode = '23514';
    end if;
    if new.archived_at is not null and exists (select 1 from public.stock_movements
      where batch_id = new.id having coalesce(sum(quantity_base),0) <> 0) then
      raise exception 'Record batch removal before archiving it' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger stock_batches_integrity before insert or update on public.stock_batches
for each row execute function private.check_batch();

create function private.check_catalogue_link() returns trigger
language plpgsql set search_path = '' as $$
declare stock public.stock_items; product public.products; family text; stock_family text;
begin
  if tg_table_name = 'products' then
    if new.stock_item_id is not null then
      select * into stock from public.stock_items where id = new.stock_item_id;
      if stock.kind <> 'Finished' or stock.unit_code <> 'pcs' or stock.archived_at is not null then
        raise exception 'Retail Items require active Finished stock in pieces' using errcode = '23514';
      end if;
    end if;
  elsif tg_table_name = 'product_variants' then
    select * into stock from public.stock_items where id = new.stock_item_id;
    select * into product from public.products where id = new.product_id;
    if product.stock_model <> 'Variants' or stock.kind <> 'Finished' or stock.unit_code <> 'pcs'
      or stock.archived_at is not null then
      raise exception 'Variants require a Variants product and active Finished stock in pieces' using errcode = '23514';
    end if;
  else
    select * into stock from public.stock_items where id = new.stock_item_id;
    select u.family into stock_family from public.inventory_units u where code = stock.unit_code;
    select u.family into family from public.inventory_units u where code = new.unit_code;
    if stock_family is distinct from family or stock.archived_at is not null
      or (family in ('count','bottle') and new.quantity <> trunc(new.quantity)) then
      raise exception 'Stock inputs need compatible units and whole counted quantities' using errcode = '23514';
    end if;
    if tg_table_name = 'product_recipe_items' then
      select * into product from public.products where id = new.product_id;
      if product.stock_model <> 'Recipe' then
        raise exception 'Recipe inputs belong to Recipe products' using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger products_link_check before insert or update on public.products
for each row execute function private.check_catalogue_link();
create trigger variants_link_check before insert or update on public.product_variants
for each row execute function private.check_catalogue_link();
create trigger recipes_link_check before insert or update on public.product_recipe_items
for each row execute function private.check_catalogue_link();
create trigger modifier_inputs_link_check before insert or update on public.modifier_stock_inputs
for each row execute function private.check_catalogue_link();

create function private.check_usage_snapshot() returns trigger
language plpgsql set search_path = '' as $$
declare s public.stock_items; family text; canonical text;
begin
  select * into s from public.stock_items where id = new.stock_item_id;
  select u.family into family from public.inventory_units u where code = s.unit_code;
  canonical := case family when 'mass' then 'g' when 'volume' then 'ml'
    when 'count' then 'pcs' when 'bottle' then 'bottles' end;
  if new.unit_code is distinct from canonical or new.kind is distinct from s.kind
    or (family in ('count','bottle') and new.quantity_base <> trunc(new.quantity_base)) then
    raise exception 'Purchased usage requires the stock kind and canonical unit/quantity' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger sale_usage_snapshot_check before insert on public.sale_item_stock_usage
for each row execute function private.check_usage_snapshot();

-- Serialize namespace/link writes before deferred cross-table ownership checks.
create function private.lock_catalogue_graph() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(171026, 1);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create function private.check_catalogue_graph() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.products p join public.stock_items s on s.sku_id = p.sku_id
    where p.stock_model <> 'Retail Item' or p.stock_item_id is distinct from s.id) then
    raise exception 'A SKU may be shared only by a Retail Item and its linked stock' using errcode = '23514';
  end if;
  if exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id
    join public.stock_items s on s.id = v.stock_item_id
    where p.stock_model <> 'Variants' or s.kind <> 'Finished' or s.unit_code <> 'pcs')
    or exists (select 1 from public.product_recipe_items r join public.products p on p.id = r.product_id
      where p.stock_model <> 'Recipe') then
    raise exception 'Remove incompatible configuration rows before changing the stock model' using errcode = '23514';
  end if;
  if exists (select 1 from public.bundle_components c
    join public.products p on p.id = c.bundle_product_id
    left join public.products child on child.id = c.component_product_id
    left join public.product_variants v on v.id = c.variant_id
    left join public.stock_items s on s.id = c.stock_item_id
    where p.stock_model <> 'Bundle'
      or (s.id is not null and (s.kind <> 'Finished' or s.unit_code <> 'pcs'))
      or (c.variant_id is not null and v.product_id is distinct from c.component_product_id)
      or (child.stock_model = 'Variants' and c.variant_id is null)) then
    raise exception 'Invalid bundle source, stock or selected variant' using errcode = '23514';
  end if;
  if exists (select 1 from public.bundle_component_modifiers cm
    join public.bundle_components c on c.id = cm.component_id
    join public.modifier_options o on o.id = cm.option_id
    join public.modifier_groups g on g.id = o.group_id
    where g.product_id is null or g.product_id is distinct from c.component_product_id) then
    raise exception 'Fixed bundle options must belong to the included product' using errcode = '23514';
  end if;
  if exists (
    with recursive paths as (
      select bundle_product_id as root, component_product_id as child,
        array[bundle_product_id] as visited, false as cycle
      from public.bundle_components where component_product_id is not null
      union all
      select p.root, c.component_product_id, p.visited || p.child,
        c.component_product_id = any(p.visited || p.child)
      from paths p join public.bundle_components c on c.bundle_product_id = p.child
      where c.component_product_id is not null and not p.cycle
    ) select 1 from paths where cycle
  ) then
    raise exception 'Bundles cannot contain recursive cycles' using errcode = '23514';
  end if;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['products','stock_items','product_variants','product_recipe_items',
    'bundle_components','bundle_component_modifiers','modifier_groups','modifier_options'] loop
    execute format('create trigger catalogue_graph_lock before insert or update or delete on public.%I
      for each statement execute function private.lock_catalogue_graph()', t);
    execute format('create constraint trigger catalogue_graph_check after insert or update or delete on public.%I
      deferrable initially deferred for each row execute function private.check_catalogue_graph()', t);
  end loop;
end $$;

create function private.record_stock_movement() returns trigger
language plpgsql set search_path = '' as $$
declare b public.stock_batches; s public.stock_items; unit_family text; balance numeric;
begin
  select * into b from public.stock_batches where id = new.batch_id for update;
  if not found then raise exception 'Unknown receipt batch' using errcode = '23503'; end if;
  select * into s from public.stock_items where id = b.stock_item_id for update;
  select family into unit_family from public.inventory_units where code = s.unit_code;
  -- Snapshots are derived from trusted stock rows, never supplied by a caller.
  select value into new.stock_sku from public.skus where id = s.sku_id;
  new.stock_name := s.name;
  new.unit_code := case unit_family when 'mass' then 'g' when 'volume' then 'ml'
    when 'count' then 'pcs' when 'bottle' then 'bottles' end;
  if s.archived_at is not null or b.archived_at is not null then
    raise exception 'Archived stock/batches cannot receive movements' using errcode = '23514';
  end if;
  if unit_family in ('count','bottle') and new.quantity_base <> trunc(new.quantity_base) then
    raise exception 'Counted movements must be whole quantities' using errcode = '23514';
  end if;
  if (new.occurred_at at time zone 'Asia/Manila')::date > (now() at time zone 'Asia/Manila')::date then
    raise exception 'Stock movements cannot be future-dated' using errcode = '23514';
  end if;
  if new.kind = 'Opening' and exists (select 1 from public.stock_movements where batch_id = b.id) then
    raise exception 'Opening must be the first movement for its batch' using errcode = '23514';
  end if;
  if new.kind <> 'Opening' and not exists (select 1 from public.stock_movements where batch_id = b.id) then
    raise exception 'Establish batch opening coverage before recording changes' using errcode = '23514';
  end if;
  if exists (select 1 from public.stock_movements where batch_id = b.id and occurred_at > new.occurred_at) then
    raise exception 'Backdated movements cannot rewrite established ledger coverage' using errcode = '23514';
  end if;
  if new.kind = 'Consumption' then
    if s.unsellable or b.unsellable or b.expires_on < (new.occurred_at at time zone 'Asia/Manila')::date then
      raise exception 'Expired/unsellable stock cannot be consumed' using errcode = '23514';
    end if;
    if not exists (select 1 from public.sale_item_stock_usage u where u.sale_item_id = new.sale_item_id
      and u.stock_item_id = s.id) then
      raise exception 'Consumption requires its purchased stock-usage snapshot' using errcode = '23514';
    end if;
  end if;
  select coalesce(sum(quantity_base),0) into balance from public.stock_movements where batch_id = b.id;
  if balance + new.quantity_base < 0 then
    raise exception 'Stock movement would make its batch negative' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger stock_movements_check before insert on public.stock_movements
for each row execute function private.record_stock_movement();

create function private.audit_stock_movement() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.audit_events(actor_id, actor_name, actor_role, event_type, entity_type,
    entity_id, reason, details, occurred_at, operation_id)
  values (new.actor_id, new.actor_name, new.actor_role, 'Stock ' || new.kind, 'stock_movement',
    new.id, new.reason, jsonb_build_object('batch_id',new.batch_id,'quantity_base',new.quantity_base,
      'sku',new.stock_sku,'name',new.stock_name,'unit',new.unit_code),
    new.occurred_at, new.operation_id);
  return new;
end $$;
create trigger stock_movements_audit after insert on public.stock_movements
for each row execute function private.audit_stock_movement();

do $$
declare t text;
begin
  foreach t in array array['skus','profiles','stock_items','stock_batches','products',
    'product_variants','modifier_groups','modifier_options','alert_settings'] loop
    execute format('create trigger touch_updated_at before update on public.%I
      for each row execute function private.touch_updated_at()', t);
  end loop;
  foreach t in array array['inventory_units','sale_items','sale_item_modifiers','sale_item_stock_usage',
    'payments','stock_movements','cash_movements','daily_sales_reviews','daily_sales_review_items','audit_events'] loop
    execute format('create trigger immutable_history before update or delete on public.%I
      for each row execute function private.deny_history_change()', t);
  end loop;
  foreach t in array array['skus','profiles','stock_items','stock_batches','products','product_variants',
    'modifier_groups','modifier_options','sales','void_requests'] loop
    execute format('create trigger preserve_references before delete on public.%I
      for each row execute function private.deny_history_change()', t);
  end loop;
  foreach t in array array['inventory_units','skus','profiles','stock_items','stock_batches','products',
    'product_recipe_items','product_variants','modifier_groups','modifier_options','modifier_stock_inputs',
    'bundle_components','bundle_component_modifiers','sales','sale_items','sale_item_modifiers','sale_item_stock_usage',
    'payments','stock_movements','cash_movements','void_requests','daily_sales_reviews',
    'daily_sales_review_items','audit_events','alert_settings'] loop
    execute format('create trigger prevent_truncate before truncate on public.%I
      for each statement execute function private.deny_history_change()', t);
  end loop;
end $$;

-- Trigger helpers are private and have no Data API entry point or public EXECUTE.
revoke all on all functions in schema private from public, anon, authenticated, service_role;
commit;
