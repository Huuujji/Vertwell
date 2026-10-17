-- P5: narrowly scoped, caller-authenticated management commands. Applied SQL is immutable.
begin;

create table private.inventory_state (singleton boolean primary key check (singleton), revision bigint not null);
insert into private.inventory_state values (true,0);
create table private.inventory_operations (
  operation_id uuid primary key, actor_id uuid not null, request jsonb not null,
  entity_id uuid not null, created_at timestamptz not null default now()
);
revoke all on private.inventory_state, private.inventory_operations from public,anon,authenticated,service_role;

create table private.account_operations(operation_id uuid primary key,actor_id uuid not null,target_id uuid not null,details jsonb not null);
revoke all on private.account_operations from public,anon,authenticated,service_role;
create function private.record_account_operation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare command jsonb:=new.raw_app_meta_data->'vertwell_provision'; actor public.profiles; target public.profiles;
begin
  if command->>'operation_id' is null or exists(select 1 from private.account_operations where target_id=new.id) then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(171026,3);
  select * into actor from public.profiles where id=(command->>'actor_id')::uuid and active;
  select * into target from public.profiles where id=new.id;
  if actor.id is null or actor.role not in ('Owner','Admin') or target.id is null or
    actor.role='Admin' and target.role<>'Staff' then raise exception 'Account access is not permitted' using errcode='42501'; end if;
  insert into private.account_operations values((command->>'operation_id')::uuid,actor.id,target.id,
    jsonb_build_object('fullName',target.full_name,'username',target.username,'role',target.role,'email',new.email));
  return new;
end $$;
create trigger vertwell_p5_account_operation after insert or update of raw_app_meta_data on auth.users
for each row execute function private.record_account_operation();
create function public.account_provisioning_result(operation_id uuid, expected jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor public.profiles; result private.account_operations; target public.profiles;
begin
  select * into actor from public.profiles where id=auth.uid() and active and role in ('Owner','Admin');
  if actor.id is null then raise exception 'Account access is not permitted' using errcode='42501'; end if;
  select * into result from private.account_operations o where o.operation_id=account_provisioning_result.operation_id;
  if result.operation_id is null then return null; end if;
  select * into target from public.profiles where id=result.target_id;
  if result.actor_id<>actor.id or result.details<>expected or actor.role='Admin' and target.role<>'Staff' then
    raise exception 'Account operation changed or is not permitted' using errcode='42501'; end if;
  return jsonb_build_object('id',target.id,'email',result.details->>'email');
end $$;

create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at:=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
  return new;
end $$;

-- Never round raw JSON into integer/numeric columns before checking its scale.
create function private.inventory_number(value jsonb, places integer, signed boolean default false) returns numeric
language plpgsql immutable set search_path = '' as $$
declare s text := value #>> '{}';
begin
  if jsonb_typeof(value) <> 'string' or s is null or
    s !~ ('^' || case when signed then '-?' else '' end || '[0-9]+(\.[0-9]{1,' || places || '})?$')
    or length(s) > 24 then
    raise exception 'Use an exact decimal string with valid precision' using errcode='22023';
  end if;
  return s::numeric;
end $$;
create function private.inventory_keys(value jsonb, allowed text[], required text[] default array[]::text[]) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(value) is distinct from 'object' or
    exists(select 1 from jsonb_object_keys(value) k where not k=any(allowed)) or not value ?& required then
    raise exception 'Missing or unexpected inventory field' using errcode='22023';
  end if;
end $$;
create function private.inventory_list(value jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(value) is distinct from 'array' or jsonb_array_length(value)>500 then
    raise exception 'Expected a bounded inventory list' using errcode='22023';
  end if;
  return value;
end $$;
create function private.inventory_text(value jsonb, maximum integer default 80) returns text
language plpgsql immutable set search_path = '' as $$
declare s text := value #>> '{}';
begin
  if jsonb_typeof(value) is distinct from 'string' or length(btrim(s)) not between 1 and maximum then
    raise exception 'Enter valid text' using errcode='22023';
  end if;
  return btrim(s);
end $$;
create function private.inventory_bool(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(value) is distinct from 'boolean' then raise exception 'Expected a boolean' using errcode='22023'; end if;
  return (value #>> '{}')::boolean;
end $$;
create function private.inventory_date(value jsonb) returns date
language plpgsql immutable set search_path = '' as $$
declare s text:=value #>> '{}'; result date;
begin
  if value='null'::jsonb then return null; end if;
  if jsonb_typeof(value) is distinct from 'string' or s !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Use an ISO calendar date' using errcode='22023'; end if;
  result:=s::date;
  if to_char(result,'YYYY-MM-DD')<>s then raise exception 'Invalid calendar date' using errcode='22023'; end if;
  return result;
end $$;
create function private.inventory_actor() returns public.profiles
language plpgsql stable set search_path = '' as $$
declare actor public.profiles;
begin
  select * into actor from public.profiles where id=auth.uid() and active and role in ('Owner','Admin');
  if actor.id is null then raise exception 'Inventory access is not permitted' using errcode='42501'; end if;
  return actor;
end $$;

-- All helpers are private; the table identifier is selected only by our fixed list.
create function private.inventory_rows(table_name text) returns jsonb
language plpgsql stable set search_path = '' as $$
declare overrides text; result jsonb;
begin
  select string_agg(format('%L,to_jsonb(r.%I::text)',a.attname,a.attname),',') into overrides
  from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname=table_name and a.attnum>0 and not a.attisdropped
    and (a.atttypid='numeric'::regtype or a.atttypid in ('public.money_amount'::regtype,'public.stock_quantity'::regtype));
  execute format('select coalesce(jsonb_agg(to_jsonb(r)%s order by to_jsonb(r)::text),''[]''::jsonb) from public.%I r',
    case when overrides is null then '' else ' || jsonb_build_object(' || overrides || ')' end, table_name) into result;
  return result;
end $$;
create function public.read_inventory() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare t text; tables jsonb := '{}'; balances jsonb; edits jsonb;
begin
  perform private.inventory_actor();
  foreach t in array array['inventory_units','skus','stock_items','stock_batches','products',
    'product_recipe_items','product_variants','modifier_groups','modifier_options','modifier_stock_inputs',
    'bundle_components','bundle_component_modifiers'] loop
    tables := tables || jsonb_build_object(t,private.inventory_rows(t));
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('batch_id',b.id,'quantity_base',
    (select coalesce(sum(m.quantity_base),0)::text from public.stock_movements m where m.batch_id=b.id)) order by b.id),'[]')
    into balances from public.stock_batches b;
  select coalesce(jsonb_agg(to_jsonb(e)),'[]') into edits from (
    select distinct on (entity_type,entity_id) entity_type,entity_id,actor_name,actor_role,occurred_at
    from public.audit_events where entity_type in ('product','stock_item','modifier_group')
    order by entity_type,entity_id,occurred_at desc,id desc
  ) e;
  return jsonb_build_object('version',1,'revision',(select revision::text from private.inventory_state),
    'businessDate',(statement_timestamp() at time zone 'Asia/Manila')::date,
    'tables',tables,'balances',balances,'edits',edits);
end $$;

create function public.read_managed_accounts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor public.profiles; result jsonb;
begin
  select * into actor from public.profiles where id=auth.uid() and active;
  if actor.id is null or actor.role not in ('Owner','Admin') then raise exception 'Account access is not permitted' using errcode='42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('email',coalesce(u.email,'')) order by lower(p.full_name),p.id),'[]') into result
  from public.profiles p join auth.users u on u.id=p.id
  where actor.role='Owner' or p.role='Staff' or p.id=actor.id;
  return result;
end $$;

-- Readiness comes from the applied database contract, not a server feature flag.
create or replace function public.business_access() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor public.profiles;
begin
  select * into actor from public.profiles where id=auth.uid() and active;
  if actor.id is null then raise exception 'Business access is not permitted' using errcode='42501'; end if;
  return jsonb_build_object('profile',to_jsonb(actor),'businessDate',(statement_timestamp() at time zone 'Asia/Manila')::date,
    'permissions',private.business_permissions(actor.role),'services',jsonb_build_object('inventoryCrud',true,'checkout',false,'salesReview',false,'reports',false));
end $$;

-- Same catalogue lock used by the foundation. Reserve generated SKUs including archives.
create function private.inventory_sku(value jsonb, existing_id uuid, prefix text) returns uuid
language plpgsql set search_path = '' as $$
declare sku_id uuid := existing_id; code text; i integer;
begin
  if value='null'::jsonb then
    for i in 1..9999 loop
      code:=prefix||'-'||lpad(i::text,4,'0');
      exit when not exists(select 1 from public.skus where lower(public.skus.value)=lower(code));
      if i=9999 then raise exception 'Generated SKU range is exhausted' using errcode='23505'; end if;
    end loop;
  else code:=private.inventory_text(value); end if;
  if sku_id is null then insert into public.skus(value) values(code) returning id into sku_id;
  else update public.skus set value=code where id=sku_id; end if;
  return sku_id;
end $$;

create function private.inventory_image(value jsonb) returns text
language plpgsql stable set search_path = '' as $$
declare path text := value #>> '{}'; present boolean;
begin
  if value='null'::jsonb then return null; end if;
  if jsonb_typeof(value) is distinct from 'string' or path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$' then
    raise exception 'Choose an uploaded inventory image' using errcode='22023';
  end if;
  if to_regclass('storage.objects') is null then raise exception 'Image storage is unavailable' using errcode='22023'; end if;
  execute 'select exists(select 1 from storage.objects where bucket_id=''inventory-images'' and name=$1)' into present using path;
  if not present then raise exception 'Image upload was not found' using errcode='22023'; end if;
  return path;
end $$;

create function private.inventory_stock(value jsonb, actor public.profiles, operation uuid, reason text, movement_kind text default 'Correction') returns uuid
language plpgsql set search_path = '' as $$
declare s public.stock_items; b public.stock_batches; row jsonb; sid uuid; sku_id uuid;
  qty numeric; balance numeric; threshold numeric; line integer:=0; factor numeric; new_category text; new_item boolean;
begin
  perform private.inventory_keys(value,array['id','sku','name','kind','category','unit','threshold','unsellable','imagePath','batches'],
    array['id','sku','name','kind','category','unit','threshold','unsellable','imagePath','batches']);
  sid:=(value->>'id')::uuid;
  if sid is null then raise exception 'Stock ID is required' using errcode='22023'; end if;
  select * into s from public.stock_items where id=sid;
  new_item:=s.id is null;
  if new_item and movement_kind='Removal' then raise exception 'Removal requires existing stock' using errcode='22023'; end if;
  if s.archived_at is not null then raise exception 'Stock is archived' using errcode='40001'; end if;
  select u.factor into factor from public.inventory_units u where code=value->>'unit';
  if factor is null then raise exception 'Invalid unit' using errcode='22023'; end if;
  threshold:=private.inventory_number(value->'threshold',6);
  new_category:=value->>'category';
  sku_id:=private.inventory_sku(value->'sku',s.sku_id,
    case when value->>'kind'='Ingredient' then 'IN' else 'PRR' end||'-'||case new_category when 'Food' then 'FD' when 'Beverage' then 'BV' else 'HB' end);
  if new_item then
    insert into public.stock_items(id,sku_id,name,kind,category,unit_code,threshold_base,unsellable,image_path)
    values(sid,sku_id,private.inventory_text(value->'name'),value->>'kind',new_category,value->>'unit',threshold,
      private.inventory_bool(value->'unsellable'),private.inventory_image(value->'imagePath')) returning * into s;
  else
    -- Validate changed dates before switching Hobby to Food/Beverage.
    if new_category='Hobby' then update public.stock_items set category='Hobby' where id=sid; end if;
    update public.stock_items set name=private.inventory_text(value->'name'),unit_code=value->>'unit',threshold_base=threshold,
      unsellable=private.inventory_bool(value->'unsellable'),image_path=private.inventory_image(value->'imagePath') where id=sid;
    if s.kind is distinct from value->>'kind' then raise exception 'Stock kind is stable' using errcode='22023'; end if;
  end if;
  if exists(select 1 from jsonb_array_elements(private.inventory_list(value->'batches')) x group by x->>'id' having count(*)>1) then
    raise exception 'Duplicate batch' using errcode='22023'; end if;
  for row in select * from jsonb_array_elements(value->'batches') loop
    perform private.inventory_keys(row,array['id','quantityBase','manufactured','expires','unsellable'],array['id','quantityBase','manufactured','expires','unsellable']);
    qty:=private.inventory_number(row->'quantityBase',6);
    select * into b from public.stock_batches where id=(row->>'id')::uuid;
    if b.id is not null and (b.stock_item_id<>sid or b.archived_at is not null) then raise exception 'Batch belongs to another record or is archived' using errcode='22023'; end if;
    if b.id is null then
      if movement_kind='Removal' then raise exception 'Removal cannot create a batch' using errcode='22023'; end if;
      if movement_kind='Receipt' and qty<=0 then raise exception 'A receipt quantity must be positive' using errcode='22023'; end if;
      insert into public.stock_batches(id,stock_item_id,manufactured_on,expires_on,unsellable)
      values((row->>'id')::uuid,sid,private.inventory_date(row->'manufactured'),private.inventory_date(row->'expires'),private.inventory_bool(row->'unsellable')) returning * into b;
      insert into public.stock_movements(batch_id,kind,quantity_base,actor_id,actor_name,actor_role,reason,operation_id,operation_line)
      values(b.id,'Opening',case when new_item and movement_kind<>'Receipt' then qty else 0 end,actor.id,actor.full_name,actor.role,reason,operation,line);
      line:=line+1;
      if (not new_item or movement_kind='Receipt') and qty>0 then
        insert into public.stock_movements(batch_id,kind,quantity_base,actor_id,actor_name,actor_role,reason,operation_id,operation_line)
        values(b.id,'Receipt',qty,actor.id,actor.full_name,actor.role,reason,operation,line); line:=line+1;
      end if;
    else
      select coalesce(sum(quantity_base),0) into balance from public.stock_movements where batch_id=b.id;
      if movement_kind='Receipt' and qty<>balance or movement_kind='Removal' and qty>balance then
        raise exception 'Receipts add new batches; removals cannot increase stock' using errcode='22023'; end if;
      if qty<>balance then
        insert into public.stock_movements(batch_id,kind,quantity_base,actor_id,actor_name,actor_role,reason,operation_id,operation_line)
        values(b.id,case when movement_kind='Removal' then 'Removal' else 'Correction' end,qty-balance,actor.id,actor.full_name,actor.role,reason,operation,line); line:=line+1;
      end if;
      update public.stock_batches set manufactured_on=private.inventory_date(row->'manufactured'),expires_on=private.inventory_date(row->'expires'),
        unsellable=private.inventory_bool(row->'unsellable') where id=b.id;
    end if;
  end loop;
  for b in select * from public.stock_batches where stock_item_id=sid and archived_at is null
    and id not in(select (x->>'id')::uuid from jsonb_array_elements(value->'batches') x) order by id loop
    if movement_kind='Receipt' then raise exception 'Receiving cannot remove existing batches' using errcode='22023'; end if;
    select coalesce(sum(quantity_base),0) into balance from public.stock_movements where batch_id=b.id;
    if balance>0 then
      insert into public.stock_movements(batch_id,kind,quantity_base,actor_id,actor_name,actor_role,reason,operation_id,operation_line)
      values(b.id,'Removal',-balance,actor.id,actor.full_name,actor.role,reason,operation,line); line:=line+1;
    end if;
    update public.stock_batches set archived_at=clock_timestamp() where id=b.id;
  end loop;
  update public.stock_items set category=new_category,updated_at=clock_timestamp() where id=sid;
  insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,operation_id)
  values(actor.id,actor.full_name,actor.role,'Inventory saved','stock_item',sid,reason,jsonb_build_object('record',value),operation);
  return sid;
end $$;

create function private.inventory_inputs(rows jsonb, parent uuid, recipe boolean) returns void
language plpgsql set search_path = '' as $$
declare row jsonb; qty numeric;
begin
  for row in select * from jsonb_array_elements(private.inventory_list(rows)) loop
    perform private.inventory_keys(row,array['stockId','quantity','unit'],array['stockId','quantity','unit']);
    qty:=private.inventory_number(row->'quantity',6,not recipe);
    if recipe then
      if not exists(select 1 from public.stock_items where id=(row->>'stockId')::uuid and kind='Ingredient' and archived_at is null) then
        raise exception 'Recipes use active ingredients' using errcode='22023'; end if;
      insert into public.product_recipe_items(product_id,stock_item_id,quantity,unit_code) values(parent,(row->>'stockId')::uuid,qty,row->>'unit');
    else
      insert into public.modifier_stock_inputs(option_id,stock_item_id,quantity,unit_code) values(parent,(row->>'stockId')::uuid,qty,row->>'unit');
    end if;
  end loop;
end $$;

create function private.inventory_group(value jsonb, product uuid) returns uuid
language plpgsql set search_path = '' as $$
declare gid uuid; oid uuid; row jsonb; old_group public.modifier_groups; old_option public.modifier_options;
  minimum numeric; maximum numeric; defaults integer; option_count integer;
begin
  perform private.inventory_keys(value,array['id','name','min','max','sourceGroupId','options'],array['id','name','min','max','options']);
  gid:=(value->>'id')::uuid;
  minimum:=private.inventory_number(value->'min',1); maximum:=private.inventory_number(value->'max',1);
  option_count:=jsonb_array_length(private.inventory_list(value->'options'));
  if gid is null or minimum<>trunc(minimum) or maximum<>trunc(maximum) or minimum<0 or maximum<minimum or maximum>option_count or option_count=0 then
    raise exception 'Check modifier choice limits and options' using errcode='22023'; end if;
  select * into old_group from public.modifier_groups where id=gid;
  if old_group.id is not null and (old_group.product_id is distinct from product or old_group.archived_at is not null) then
    raise exception 'Modifier group belongs to another record or is archived' using errcode='22023'; end if;
  if value->>'sourceGroupId' is not null and not exists(select 1 from public.modifier_groups where id=(value->>'sourceGroupId')::uuid and product_id is null) then
    raise exception 'Invalid library provenance' using errcode='22023'; end if;
  if product is null and exists(select 1 from public.modifier_groups where product_id is null and archived_at is null and id<>gid and lower(btrim(name))=lower(private.inventory_text(value->'name'))) then
    raise exception 'A library group already uses that name' using errcode='23505'; end if;
  insert into public.modifier_groups(id,product_id,source_group_id,name,min_choices,max_choices)
  values(gid,product,(value->>'sourceGroupId')::uuid,private.inventory_text(value->'name'),minimum,maximum)
  on conflict(id) do update set name=excluded.name,min_choices=excluded.min_choices,max_choices=excluded.max_choices;
  if exists(select 1 from jsonb_array_elements(value->'options') x group by x->>'id' having count(*)>1) then raise exception 'Duplicate option' using errcode='22023'; end if;
  for row in select * from jsonb_array_elements(value->'options') loop
    perform private.inventory_keys(row,array['id','name','price','defaultSelected','inputs'],array['id','name','price','defaultSelected','inputs']);
    oid:=(row->>'id')::uuid;
    select * into old_option from public.modifier_options where id=oid;
    if old_option.id is not null and (old_option.group_id<>gid or old_option.archived_at is not null) then raise exception 'Invalid option ownership' using errcode='22023'; end if;
    insert into public.modifier_options(id,group_id,name,price,default_selected)
    values(oid,gid,private.inventory_text(row->'name'),private.inventory_number(row->'price',2),private.inventory_bool(row->'defaultSelected'))
    on conflict(id) do update set name=excluded.name,price=excluded.price,default_selected=excluded.default_selected;
    delete from public.modifier_stock_inputs where option_id=oid;
    perform private.inventory_inputs(row->'inputs',oid,false);
  end loop;
  update public.modifier_options set archived_at=clock_timestamp() where group_id=gid and archived_at is null
    and id not in(select (x->>'id')::uuid from jsonb_array_elements(value->'options') x);
  select count(*) into defaults from public.modifier_options where group_id=gid and archived_at is null and default_selected;
  if defaults>maximum or defaults>0 and defaults<minimum then raise exception 'Defaults must meet choice limits or be empty' using errcode='22023'; end if;
  return gid;
end $$;

create function private.inventory_product(value jsonb, stock jsonb, actor public.profiles, operation uuid, reason text) returns uuid
language plpgsql set search_path = '' as $$
declare p public.products; pid uuid; sid uuid; sku_id uuid; row jsonb; variant public.product_variants; component uuid; option_id text; shared boolean;
  model text; variant_ids uuid[]:='{}'; group_ids uuid[]:='{}'; gid uuid; n numeric;
begin
  perform private.inventory_keys(value,array['id','sku','name','category','model','price','discountType','discountValue','enabled','imagePath','manufactured','expires','stockId','recipe','variants','groups','bundle'],
    array['id','sku','name','category','model','price','discountType','discountValue','enabled','imagePath','manufactured','expires','stockId','recipe','variants','groups','bundle']);
  pid:=(value->>'id')::uuid; model:=value->>'model';
  if pid is null then raise exception 'Product ID is required' using errcode='22023'; end if;
  select * into p from public.products where id=pid;
  if p.archived_at is not null then raise exception 'Product is archived' using errcode='40001'; end if;
  sid:=(value->>'stockId')::uuid;
  shared:=coalesce(p.sku_id=(select st.sku_id from public.stock_items st where st.id=sid),false)
    or p.id is null and not exists(select 1 from public.stock_items where id=sid) and stock is not null;
  if stock is not null and stock<>'null'::jsonb then
    if model<>'Retail Item' then raise exception 'Only Retail Items own direct stock' using errcode='22023'; end if;
    if shared then stock:=jsonb_set(stock,'{sku}',value->'sku'); end if;
    sid:=private.inventory_stock(stock,actor,operation,reason);
    if sid is distinct from (value->>'stockId')::uuid then raise exception 'Retail stock link mismatch' using errcode='22023'; end if;
  else sid:=(value->>'stockId')::uuid; end if;
  -- Existing shared SKU identities remain shared through SKU edits. A model change
  -- gets a new SKU identity; the old stock keeps its own reserved code.
  if model='Retail Item' and sid is not null and shared then
    select s.sku_id into sku_id from public.stock_items s where s.id=sid and s.archived_at is null;
    if stock is null or stock='null'::jsonb then
      sku_id:=private.inventory_sku(value->'sku',sku_id,'PRR-'||case value->>'category' when 'Food' then 'FD' when 'Beverage' then 'BV' else 'HB' end);
    end if;
  else
    sku_id:=private.inventory_sku(value->'sku',case when exists(select 1 from public.stock_items where public.stock_items.sku_id=p.sku_id) then null else p.sku_id end,
      case model when 'Recipe' then 'PRC' when 'Variants' then 'PRV' when 'Bundle' then 'PRB' else 'PRR' end||'-'||case value->>'category' when 'Food' then 'FD' when 'Beverage' then 'BV' else 'HB' end);
  end if;
  delete from public.product_recipe_items where product_id=pid;
  delete from public.bundle_component_modifiers where component_id in(select id from public.bundle_components where bundle_product_id=pid);
  delete from public.bundle_components where bundle_product_id=pid;
  update public.product_variants set archived_at=clock_timestamp() where product_id=pid and archived_at is null;
  insert into public.products(id,sku_id,name,category,stock_model,stock_item_id,base_price,discount_type,discount_value,enabled,image_path,manufactured_on,expires_on)
  values(pid,sku_id,private.inventory_text(value->'name'),value->>'category',model,sid,private.inventory_number(value->'price',2),
    value->>'discountType',private.inventory_number(value->'discountValue',2),private.inventory_bool(value->'enabled'),private.inventory_image(value->'imagePath'),
    private.inventory_date(value->'manufactured'),private.inventory_date(value->'expires'))
  on conflict(id) do update set sku_id=excluded.sku_id,name=excluded.name,category=excluded.category,stock_model=excluded.stock_model,
    stock_item_id=excluded.stock_item_id,base_price=excluded.base_price,discount_type=excluded.discount_type,discount_value=excluded.discount_value,
    enabled=excluded.enabled,image_path=excluded.image_path,manufactured_on=excluded.manufactured_on,expires_on=excluded.expires_on;
  if model='Recipe' then
    if jsonb_array_length(private.inventory_list(value->'recipe'))=0 then raise exception 'Add recipe ingredients' using errcode='22023'; end if;
    perform private.inventory_inputs(value->'recipe',pid,true);
  elsif jsonb_array_length(private.inventory_list(value->'recipe'))<>0 then raise exception 'Unexpected recipe' using errcode='22023'; end if;
  for row in select * from jsonb_array_elements(private.inventory_list(value->'variants')) loop
    if model<>'Variants' then raise exception 'Unexpected variants' using errcode='22023'; end if;
    perform private.inventory_keys(row,array['id','name','stockId','price','enabled'],array['id','name','stockId','price','enabled']);
    if (row->>'id')::uuid=any(variant_ids) then raise exception 'Duplicate variant' using errcode='22023'; end if;
    variant_ids:=array_append(variant_ids,(row->>'id')::uuid);
    select * into variant from public.product_variants where id=(row->>'id')::uuid;
    if variant.id is not null and variant.product_id<>pid then raise exception 'Invalid variant ownership' using errcode='22023'; end if;
    insert into public.product_variants(id,product_id,stock_item_id,name,price,enabled)
    values((row->>'id')::uuid,pid,(row->>'stockId')::uuid,private.inventory_text(row->'name'),private.inventory_number(row->'price',2),private.inventory_bool(row->'enabled'))
    on conflict(id) do update set stock_item_id=excluded.stock_item_id,name=excluded.name,price=excluded.price,enabled=excluded.enabled,archived_at=null;
  end loop;
  if model='Variants' and cardinality(variant_ids)=0 then raise exception 'Add variants' using errcode='22023'; end if;
  for row in select * from jsonb_array_elements(private.inventory_list(value->'groups')) loop
    gid:=private.inventory_group(row,pid);
    if gid=any(group_ids) then raise exception 'Duplicate modifier group' using errcode='22023'; end if;
    group_ids:=array_append(group_ids,gid);
  end loop;
  update public.modifier_groups set archived_at=clock_timestamp() where product_id=pid and archived_at is null and not id=any(group_ids);
  for row in select * from jsonb_array_elements(private.inventory_list(value->'bundle')) loop
    if model<>'Bundle' then raise exception 'Unexpected bundle' using errcode='22023'; end if;
    perform private.inventory_keys(row,array['productId','stockId','variantId','quantity','modifierIds'],array['productId','stockId','variantId','quantity','modifierIds']);
    n:=private.inventory_number(row->'quantity',1);
    if n<>trunc(n) then raise exception 'Use whole bundle quantities' using errcode='22023'; end if;
    insert into public.bundle_components(bundle_product_id,component_product_id,stock_item_id,variant_id,quantity,position)
    values(pid,(row->>'productId')::uuid,(row->>'stockId')::uuid,(row->>'variantId')::uuid,n,
      (select count(*) from public.bundle_components where bundle_product_id=pid)) returning id into component;
    for option_id in select jsonb_array_elements_text(private.inventory_list(row->'modifierIds')) loop
      insert into public.bundle_component_modifiers values(component,option_id::uuid);
    end loop;
  end loop;
  if model='Bundle' and jsonb_array_length(value->'bundle')=0 then raise exception 'Add bundle components' using errcode='22023'; end if;
  insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,operation_id)
  values(actor.id,actor.full_name,actor.role,'Inventory saved','product',pid,reason,jsonb_build_object('record',value),operation);
  return pid;
end $$;

create or replace function private.check_catalogue_graph() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.products p join public.stock_items s on s.sku_id = p.sku_id
    where p.stock_model <> 'Retail Item' or p.stock_item_id is distinct from s.id) then
    raise exception 'A SKU may be shared only by a Retail Item and its linked stock' using errcode = '23514';
  end if;
  if exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id
    join public.stock_items s on s.id = v.stock_item_id
    where v.archived_at is null and (p.stock_model <> 'Variants' or s.kind <> 'Finished' or s.unit_code <> 'pcs'))
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

-- Validate the full active graph, including configurations that reference an edited
-- child. Old sale references remain attached to archived variants/options.
create function private.inventory_validate() returns void
language plpgsql set search_path = '' as $$
begin
  if exists(select 1 from public.products p where p.archived_at is null and (
    p.stock_model='Recipe' and not exists(select 1 from public.product_recipe_items where product_id=p.id) or
    p.stock_model='Variants' and not exists(select 1 from public.product_variants where product_id=p.id and archived_at is null) or
    p.stock_model='Bundle' and not exists(select 1 from public.bundle_components where bundle_product_id=p.id))) then
    raise exception 'Complete each active product configuration' using errcode='22023'; end if;
  if exists(select 1 from public.modifier_stock_inputs i join public.modifier_options o on o.id=i.option_id
    join public.modifier_groups g on g.id=o.group_id join public.products p on p.id=g.product_id
    where p.archived_at is null and g.archived_at is null and o.archived_at is null and i.quantity<0
      and (p.stock_model in ('Variants','Bundle') or p.stock_model='Retail Item' and i.stock_item_id=p.stock_item_id)) then
    raise exception 'Modifiers cannot omit fixed retail, variant or bundle stock' using errcode='22023'; end if;
  if exists(select 1 from public.modifier_groups g join public.products p on p.id=g.product_id
    where p.archived_at is null and g.archived_at is null and p.stock_model='Bundle' and g.min_choices>
      (select count(*) from public.modifier_options where group_id=g.id and archived_at is null and default_selected)) then
    raise exception 'Required bundle defaults must be fixed' using errcode='22023'; end if;
  if exists(select 1 from public.bundle_components c join public.products p on p.id=c.bundle_product_id
    left join public.products child on child.id=c.component_product_id
    left join public.product_variants v on v.id=c.variant_id
    left join public.stock_items s on s.id=c.stock_item_id
    where p.archived_at is null and (child.archived_at is not null or s.archived_at is not null or v.archived_at is not null)) then
    raise exception 'Active bundles require unarchived components' using errcode='23514'; end if;
  if exists(select 1 from public.bundle_component_modifiers cm join public.bundle_components c on c.id=cm.component_id
    join public.products p on p.id=c.bundle_product_id join public.modifier_options o on o.id=cm.option_id
    join public.modifier_groups g on g.id=o.group_id
    where p.archived_at is null and (o.archived_at is not null or g.archived_at is not null)) then
    raise exception 'Remove fixed bundle references before removing choices' using errcode='23514'; end if;
  if exists(select 1 from public.bundle_components c join public.products p on p.id=c.bundle_product_id
    join public.modifier_groups g on g.product_id=c.component_product_id and g.archived_at is null
    where p.archived_at is null and (select count(*) from public.bundle_component_modifiers cm join public.modifier_options o on o.id=cm.option_id
      where cm.component_id=c.id and o.group_id=g.id and o.archived_at is null) not between g.min_choices and g.max_choices) then
    raise exception 'Fixed component options must meet choice limits' using errcode='23514'; end if;
  if exists(select 1 from public.bundle_components c join public.products p on p.id=c.bundle_product_id where p.archived_at is null
    group by c.bundle_product_id,c.component_product_id,c.stock_item_id,c.variant_id,
      (select coalesce(array_agg(option_id order by option_id),'{}') from public.bundle_component_modifiers where component_id=c.id)
    having count(*)>1) then raise exception 'Combine duplicate bundle configurations' using errcode='22023'; end if;
end $$;

create function public.inventory_command(command jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor public.profiles; operation uuid; previous private.inventory_operations; revision bigint;
  kind text; entity uuid; entity_type text; reason text; stock public.stock_items; b public.stock_batches;
  balance numeric; line integer:=0; saved jsonb;
begin
  -- Lock order is shared with account commands: identity first, catalogue second.
  perform pg_catalog.pg_advisory_xact_lock(171026,3);
  actor:=private.inventory_actor();
  perform pg_catalog.pg_advisory_xact_lock(171026,1);
  perform private.inventory_keys(command,array['operationId','revision','kind','reason','record','stock','stockAction'],array['operationId','revision','kind','reason','record']);
  operation:=(command->>'operationId')::uuid; kind:=command->>'kind'; reason:=private.inventory_text(command->'reason',500);
  if operation is null then raise exception 'Operation ID required' using errcode='22023'; end if;
  if command ? 'stockAction' and (kind<>'stock.save' or jsonb_typeof(command->'stockAction') is distinct from 'string'
    or command->>'stockAction' not in ('correct','receive','remove')) then raise exception 'Invalid stock action' using errcode='22023'; end if;
  select * into previous from private.inventory_operations where operation_id=operation;
  if previous.operation_id is not null then
    if previous.actor_id<>actor.id or previous.request<>command then raise exception 'Operation ID already used for another request' using errcode='40001'; end if;
    return jsonb_build_object('operationId',operation,'entityId',previous.entity_id,'replayed',true,'inventory',public.read_inventory());
  end if;
  select s.revision into revision from private.inventory_state s for update;
  if jsonb_typeof(command->'revision') is distinct from 'string' or command->>'revision'<>revision::text then
    raise exception 'Inventory changed. Reload and review your draft before saving' using errcode='40001'; end if;
  if kind='stock.save' then
    if command ? 'stock' then raise exception 'Unexpected stock field' using errcode='22023'; end if;
    entity:=private.inventory_stock(command->'record',actor,operation,reason,
      case command->>'stockAction' when 'remove' then 'Removal' when 'receive' then 'Receipt' else 'Correction' end); entity_type:='stock_item';
  elsif kind='product.save' then
    entity:=private.inventory_product(command->'record',command->'stock',actor,operation,reason); entity_type:='product';
  elsif kind='library.save' then
    if command ? 'stock' then raise exception 'Unexpected stock field' using errcode='22023'; end if;
    entity:=private.inventory_group(command->'record',null); entity_type:='modifier_group';
    insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,operation_id)
      values(actor.id,actor.full_name,actor.role,'Library saved',entity_type,entity,reason,jsonb_build_object('record',command->'record'),operation);
  elsif kind in ('product.archive','stock.archive','library.archive') then
    perform private.inventory_keys(command->'record',array['id'],array['id']);
    if command ? 'stock' then raise exception 'Unexpected stock field' using errcode='22023'; end if;
    entity:=(command->'record'->>'id')::uuid;
    if kind='product.archive' then
      update public.products set archived_at=clock_timestamp(),enabled=false where id=entity and archived_at is null;
      if not found then raise exception 'Product is unavailable' using errcode='40001'; end if;
      update public.modifier_groups set archived_at=clock_timestamp() where product_id=entity and archived_at is null;
      update public.product_variants set archived_at=clock_timestamp() where product_id=entity and archived_at is null;
      entity_type:='product';
    elsif kind='library.archive' then
      update public.modifier_groups set archived_at=clock_timestamp() where id=entity and product_id is null and archived_at is null;
      if not found then raise exception 'Library group is unavailable' using errcode='40001'; end if;
      entity_type:='modifier_group';
    else
      select * into stock from public.stock_items where id=entity and archived_at is null;
      if stock.id is null then raise exception 'Stock is unavailable' using errcode='40001'; end if;
      for b in select * from public.stock_batches where stock_item_id=entity and archived_at is null order by id loop
        select coalesce(sum(quantity_base),0) into balance from public.stock_movements where batch_id=b.id;
        if balance>0 then
          insert into public.stock_movements(batch_id,kind,quantity_base,actor_id,actor_name,actor_role,reason,operation_id,operation_line)
          values(b.id,'Removal',-balance,actor.id,actor.full_name,actor.role,reason,operation,line); line:=line+1;
        end if;
        update public.stock_batches set archived_at=clock_timestamp() where id=b.id;
      end loop;
      update public.stock_items set archived_at=clock_timestamp() where id=entity;
      entity_type:='stock_item';
    end if;
    insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,operation_id)
      values(actor.id,actor.full_name,actor.role,'Inventory archived',entity_type,entity,reason,'{}',operation);
  else raise exception 'Unsupported inventory command' using errcode='22023'; end if;
  perform private.inventory_validate();
  -- Flush deferred graph checks before returning a success response.
  set constraints all immediate;
  set constraints all deferred;
  update private.inventory_state s set revision=s.revision+1;
  insert into private.inventory_operations(operation_id,actor_id,request,entity_id) values(operation,actor.id,command,entity);
  saved:=public.read_inventory();
  return jsonb_build_object('operationId',operation,'entityId',entity,'replayed',false,'inventory',saved);
end $$;

-- Private, immutable raster objects. Upload and signing always use the caller token.
-- Disposable PostgreSQL has no Storage service; hosted verification checks this branch.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      values('inventory-images','inventory-images',false,2097152,array['image/png','image/jpeg','image/webp']);
    execute $policy$create policy inventory_image_read on storage.objects for select to authenticated
      using (bucket_id='inventory-images' and (select private.business_role()) in ('Owner','Admin'))$policy$;
    execute $policy$create policy inventory_image_insert on storage.objects for insert to authenticated
      with check (bucket_id='inventory-images' and (select private.business_role()) in ('Owner','Admin')
        and split_part(name,'/',1)=(select auth.uid())::text
        and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$')$policy$;
  end if;
end $$;

revoke all on all functions in schema private from public,anon,authenticated,service_role;
grant execute on function private.business_role() to authenticated;
revoke all on function public.read_inventory(), public.inventory_command(jsonb), public.read_managed_accounts() from public,anon,authenticated,service_role;
grant execute on function public.read_inventory(), public.inventory_command(jsonb), public.read_managed_accounts() to authenticated;
revoke all on function public.account_provisioning_result(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.account_provisioning_result(uuid,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
