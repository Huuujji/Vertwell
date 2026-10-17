-- P6: caller-scoped quotes and atomic checkout. Existing applied migrations stay frozen.
begin;

create table private.checkout_operations (
  operation_id uuid primary key, actor_id uuid not null, request jsonb not null,
  sale_id uuid not null, receipt jsonb not null, created_at timestamptz not null default now()
);
revoke all on private.checkout_operations from public,anon,authenticated,service_role;
create unique index checkout_operations_sale on private.checkout_operations(sale_id);
create table private.checkout_state(singleton boolean primary key check(singleton),enabled boolean not null default false);
insert into private.checkout_state values(true,false);
revoke all on private.checkout_state from public,anon,authenticated,service_role;

create function private.checkout_actor() returns public.profiles
language plpgsql stable set search_path = '' as $$
declare actor public.profiles;
begin
  select * into actor from public.profiles where id=auth.uid() and active;
  if actor.id is null then raise exception 'Checkout access is not permitted' using errcode='42501'; end if;
  return actor;
end $$;

create function private.checkout_price(base numeric,discount_type text,discount numeric) returns numeric
language sql immutable set search_path = '' as $$
  select round(case discount_type when 'Fixed' then greatest(0,base-discount)
    when 'Percentage' then base*(1-discount/100) else base end,2)
$$;

-- Resolve one configured unit recursively, retaining the purchased component tree.
-- Signed omissions are clamped inside each child before multiplying its quantity.
create function private.checkout_configuration(product uuid, variant uuid, options jsonb,
  trail uuid[] default array[]::uuid[]) returns jsonb
language plpgsql stable set search_path = '' as $$
declare p public.products; v public.product_variants; g public.modifier_groups; o public.modifier_options;
  c public.bundle_components; i record; input jsonb; child jsonb; children jsonb:='[]';
  selected uuid[]:=array[]::uuid[]; raw_usage jsonb:='[]'; usage jsonb; mods jsonb:='[]';
  sku text; title text; original numeric; unit_price numeric; n integer;
begin
  if product=any(trail) or cardinality(trail)>=32 then raise exception 'Invalid bundle graph' using errcode='22023'; end if;
  select * into p from public.products where id=product and archived_at is null and enabled;
  if p.id is null then raise exception 'Product unavailable' using errcode='PT409'; end if;
  perform private.inventory_list(options);
  for input in select value from jsonb_array_elements(options) loop
    if jsonb_typeof(input)<>'string' or input#>>'{}' is null then raise exception 'Invalid modifier ID' using errcode='22023'; end if;
    if (input#>>'{}')::uuid=any(selected) then raise exception 'Duplicate modifier' using errcode='22023'; end if;
    selected:=array_append(selected,(input#>>'{}')::uuid);
  end loop;
  if exists(select 1 from unnest(selected) x where not exists(select 1 from public.modifier_options mo
    join public.modifier_groups mg on mg.id=mo.group_id where mo.id=x and mg.product_id=p.id
    and mo.archived_at is null and mg.archived_at is null)) then
    raise exception 'Modifier does not belong to product' using errcode='22023'; end if;
  for g in select * from public.modifier_groups where product_id=p.id and archived_at is null order by id loop
    select count(*) into n from public.modifier_options where group_id=g.id and id=any(selected) and archived_at is null;
    if n<g.min_choices or n>g.max_choices then raise exception 'Modifier choice limits' using errcode='22023'; end if;
  end loop;
  select value into sku from public.skus where id=p.sku_id; title:=p.name; original:=p.base_price;
  if p.stock_model='Variants' then
    select * into v from public.product_variants where id=variant and product_id=p.id and enabled and archived_at is null;
    if v.id is null then raise exception 'Choose an available variant' using errcode='22023'; end if;
    original:=v.price; title:=p.name||' — '||v.name;
    select s.value into sku from public.stock_items si join public.skus s on s.id=si.sku_id where si.id=v.stock_item_id;
    raw_usage:=jsonb_build_array(jsonb_build_object('stockId',v.stock_item_id,'quantity','1'));
  else
    if variant is not null then raise exception 'Unexpected variant' using errcode='22023'; end if;
    if p.stock_model='Retail Item' then
      raw_usage:=jsonb_build_array(jsonb_build_object('stockId',p.stock_item_id,'quantity','1'));
    elsif p.stock_model='Recipe' then
      select coalesce(jsonb_agg(jsonb_build_object('stockId',r.stock_item_id,'quantity',(r.quantity*u.factor)::text)),'[]')
        into raw_usage from public.product_recipe_items r join public.inventory_units u on u.code=r.unit_code where r.product_id=p.id;
      if jsonb_array_length(raw_usage)=0 then raise exception 'Recipe is incomplete' using errcode='22023'; end if;
    elsif p.stock_model='Bundle' then
      for c in select * from public.bundle_components where bundle_product_id=p.id order by position,id loop
        if c.component_product_id is not null then
          child:=private.checkout_configuration(c.component_product_id,c.variant_id,
            (select coalesce(jsonb_agg(option_id::text order by option_id),'[]') from public.bundle_component_modifiers where component_id=c.id),array_append(trail,p.id));
          children:=children||jsonb_build_array(jsonb_build_object('quantity',c.quantity,'configuration',child-'usage'));
          for input in select value from jsonb_array_elements(child->'usage') loop
            raw_usage:=raw_usage||jsonb_build_array(jsonb_build_object('stockId',input->>'stockId','quantity',((input->>'quantity')::numeric*c.quantity)::text));
          end loop;
        else
          raw_usage:=raw_usage||jsonb_build_array(jsonb_build_object('stockId',c.stock_item_id,'quantity',c.quantity::text));
          select si.name,s.value into i from public.stock_items si join public.skus s on s.id=si.sku_id where si.id=c.stock_item_id;
          children:=children||jsonb_build_array(jsonb_build_object('quantity',c.quantity,'stockId',c.stock_item_id,'name',i.name,'sku',i.value));
        end if;
      end loop;
      if jsonb_array_length(children)=0 then raise exception 'Bundle is incomplete' using errcode='22023'; end if;
    end if;
  end if;
  for o in select * from public.modifier_options where id=any(selected) order by id loop
    original:=original+o.price;
    mods:=mods||jsonb_build_array(jsonb_build_object('id',o.id,'name',o.name,'price',o.price::text));
    for i in select mi.stock_item_id,mi.quantity*u.factor as quantity from public.modifier_stock_inputs mi
      join public.inventory_units u on u.code=mi.unit_code where mi.option_id=o.id loop
      if p.stock_model in ('Variants','Bundle') and i.quantity<0 then raise exception 'Fixed stock cannot be omitted' using errcode='22023'; end if;
      -- Retail omissions can affect ingredient additions, never its finished unit.
      if p.stock_model='Retail Item' and i.stock_item_id=p.stock_item_id and i.quantity<0 then
        raise exception 'Fixed stock cannot be omitted' using errcode='22023'; end if;
      raw_usage:=raw_usage||jsonb_build_array(jsonb_build_object('stockId',i.stock_item_id,'quantity',i.quantity::text));
    end loop;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('stockId',x.id,'quantity',x.qty::text) order by x.id),'[]') into usage
  from (select (e->>'stockId')::uuid as id,greatest(0,sum((e->>'quantity')::numeric)) as qty from jsonb_array_elements(raw_usage) e group by 1) x;
  if exists(select 1 from jsonb_array_elements(usage) e where not exists(select 1 from public.stock_items s
    where s.id=(e->>'stockId')::uuid and s.archived_at is null and not s.unsellable)) then
    raise exception 'Stock unavailable' using errcode='PT409'; end if;
  unit_price:=private.checkout_price(original,p.discount_type,p.discount_value);
  return jsonb_build_object('productId',p.id,'variantId',v.id,'name',title,'sku',sku,'category',p.category,
    'quantity',1,'unitPrice',unit_price::text,'originalUnitPrice',original::text,'model',p.stock_model,
    'discountType',p.discount_type,'discountValue',p.discount_value::text,'modifiers',mods,'components',children,'usage',usage);
end $$;

create function private.checkout_usable(stock uuid) returns numeric
language sql stable set search_path = '' as $$
  select coalesce(sum(m.quantity_base),0) from public.stock_batches b join public.stock_items s on s.id=b.stock_item_id
  join public.stock_movements m on m.batch_id=b.id where s.id=stock and s.archived_at is null and not s.unsellable
    and b.archived_at is null and not b.unsellable and (b.expires_on is null or b.expires_on>=(statement_timestamp() at time zone 'Asia/Manila')::date)
$$;

create function private.checkout_resolve(lines jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare line jsonb; resolved jsonb; result jsonb:='[]'; demand jsonb; qty numeric; subtotal numeric:=0; tax numeric;
begin
  perform private.inventory_list(lines);
  if jsonb_array_length(lines) not between 1 and 100 then raise exception 'Use 1 to 100 cart lines' using errcode='22023'; end if;
  for line in select value from jsonb_array_elements(lines) loop
    perform private.inventory_keys(line,array['productId','variantId','modifierIds','quantity'],array['productId','variantId','modifierIds','quantity']);
    qty:=private.inventory_number(line->'quantity',1);
    if qty<>trunc(qty) or qty not between 1 and 10000 then raise exception 'Use a positive whole quantity' using errcode='22023'; end if;
    resolved:=private.checkout_configuration((line->>'productId')::uuid,(line->>'variantId')::uuid,line->'modifierIds');
    resolved:=jsonb_set(resolved,'{quantity}',to_jsonb(qty::integer));
    subtotal:=subtotal+(resolved->>'unitPrice')::numeric*qty;
    result:=result||jsonb_build_array(resolved);
  end loop;
  -- Clamp omissions per configured unit, then multiply and aggregate the whole cart.
  for demand in select jsonb_build_object('stockId',e->>'stockId','quantity',sum((e->>'quantity')::numeric*(r->>'quantity')::integer)::text)
    from jsonb_array_elements(result) r cross join lateral jsonb_array_elements(r->'usage') e group by e->>'stockId' loop
    if (demand->>'quantity')::numeric>private.checkout_usable((demand->>'stockId')::uuid) then
      raise exception 'Not enough usable stock for this order' using errcode='PT409'; end if;
  end loop;
  tax:=round(subtotal*0.12,2);
  -- Domain casts enforce total bounds before a quote can be accepted.
  perform (subtotal+tax)::public.money_amount;
  return jsonb_build_object('lines',result,'subtotal',subtotal::text,'tax',tax::text,'total',(subtotal+tax)::text,
    'businessDate',(statement_timestamp() at time zone 'Asia/Manila')::date);
end $$;

create function private.checkout_public_quote(resolved jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_set(resolved,'{lines}',(select jsonb_agg(r-'usage') from jsonb_array_elements(resolved->'lines') r))
$$;

create function public.quote_checkout(lines jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare resolved jsonb;
begin
  perform private.checkout_actor();
  resolved:=private.checkout_resolve(lines);
  return private.checkout_public_quote(resolved)||jsonb_build_object('version',1,
    'revision',(select revision::text from private.inventory_state where singleton),
    'quoteToken',encode(sha256(convert_to(resolved::text,'UTF8')),'hex'));
end $$;

-- Explore selections including optional omissions; a finite budget fails closed
-- for exceptionally large combination spaces rather than advertising unsafe stock.
create function private.checkout_available(product uuid,cart_lines jsonb default '[]') returns boolean
language plpgsql stable set search_path = '' as $$
declare candidate record; config jsonb; demand jsonb; ok boolean; tries integer:=0; cart jsonb:='[]';
begin
  perform private.inventory_list(cart_lines);
  if jsonb_array_length(cart_lines)>0 then cart:=private.checkout_resolve(cart_lines)->'lines'; end if;
  -- Larger choice spaces are explicitly unknown on a card. The customer can
  -- still select a configuration and obtain an exact whole-cart quote.
  if (select count(*) from public.modifier_options o join public.modifier_groups g on g.id=o.group_id
    where g.product_id=product and g.archived_at is null and o.archived_at is null)>12 then return null; end if;
  for candidate in
    with recursive groups as (
      select g.*,row_number() over(order by id) as pos from public.modifier_groups g where product_id=product and archived_at is null
    ), combos as (
      select g.id,g.pos,g.min_choices,g.max_choices,array[]::uuid[] ids,0 as idx from groups g
      union all
      select c.id,c.pos,c.min_choices,c.max_choices,c.ids||o.id,o.idx from combos c cross join lateral (
        select mo.id,(row_number() over(order by mo.id))::integer idx from public.modifier_options mo where group_id=c.id and archived_at is null
      ) o where o.idx>c.idx and cardinality(c.ids)<c.max_choices
    ), choices as (
      select 0::bigint pos,array[]::uuid[] ids
      union all select c.pos,s.ids||c.ids from choices s join combos c on c.pos=s.pos+1 and cardinality(c.ids) between c.min_choices and c.max_choices
    ) select v.id as variant,to_jsonb(c.ids) options from choices c cross join lateral (
      select pv.id from public.product_variants pv where pv.product_id=product and pv.archived_at is null and pv.enabled
      union all select null::uuid where not exists(select 1 from public.products p where p.id=product and p.stock_model='Variants')
    ) v where c.pos=(select count(*) from groups) limit 4096
  loop
    tries:=tries+1;
    begin
      config:=private.checkout_configuration(product,candidate.variant,candidate.options); ok:=true;
      for demand in select jsonb_build_object('stockId',e->>'stockId','quantity',sum((e->>'quantity')::numeric*(l->>'quantity')::integer)::text)
        from jsonb_array_elements(cart||jsonb_build_array(config)) l cross join lateral jsonb_array_elements(l->'usage') e group by e->>'stockId' loop
        if (demand->>'quantity')::numeric>private.checkout_usable((demand->>'stockId')::uuid) then ok:=false;exit; end if;
      end loop;
      if ok then return true; end if;
    exception when sqlstate 'PT409' or sqlstate '22023' then null;
    end;
  end loop;
  return case when tries>=4096 then null else false end;
end $$;

create function public.check_checkout_product(product_id uuid,lines jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.checkout_actor();
  return jsonb_build_object('version',1,'available',private.checkout_available(product_id,lines));
end $$;

create function public.read_checkout_catalogue(page_offset integer default 0,page_size integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.checkout_actor();
  if page_offset is null or page_offset<0 or page_offset>1000000 or page_size is null or page_size not between 1 and 100 then
    raise exception 'Invalid pagination' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'sku',s.value,'category',p.category,'model',p.stock_model,
    'basePrice',p.base_price::text,'discountType',p.discount_type,'discountValue',p.discount_value::text,'imagePath',p.image_path,
    'priceFrom',(case when p.stock_model='Variants' then (select min(private.checkout_price(v.price,p.discount_type,p.discount_value)) from public.product_variants v where v.product_id=p.id and v.enabled and v.archived_at is null)
      else private.checkout_price(p.base_price,p.discount_type,p.discount_value) end)::text,
    'priceTo',(case when p.stock_model='Variants' then (select max(private.checkout_price(v.price,p.discount_type,p.discount_value)) from public.product_variants v where v.product_id=p.id and v.enabled and v.archived_at is null)
      else private.checkout_price(p.base_price,p.discount_type,p.discount_value) end)::text,
    'available',private.checkout_available(p.id),
    'variants',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'price',v.price::text,'sku',vs.value) order by v.name,v.id),'[]')
      from public.product_variants v join public.stock_items si on si.id=v.stock_item_id join public.skus vs on vs.id=si.sku_id
      where v.product_id=p.id and v.enabled and v.archived_at is null),
    'groups',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'min',g.min_choices,'max',g.max_choices,
      'options',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'price',o.price::text,'defaultSelected',o.default_selected) order by o.name,o.id),'[]')
        from public.modifier_options o where o.group_id=g.id and o.archived_at is null)) order by g.name,g.id),'[]')
      from public.modifier_groups g where g.product_id=p.id and g.archived_at is null),
    'components',(select coalesce(jsonb_agg(jsonb_build_object('name',coalesce(cp.name,si.name),'quantity',c.quantity,'variant',pv.name) order by c.position,c.id),'[]')
      from public.bundle_components c left join public.products cp on cp.id=c.component_product_id
      left join public.stock_items si on si.id=c.stock_item_id left join public.product_variants pv on pv.id=c.variant_id where c.bundle_product_id=p.id)
    ) order by lower(p.name),p.id),'[]') into result from (
      select * from public.products where archived_at is null and enabled order by lower(name),id offset page_offset limit page_size
    ) p join public.skus s on s.id=p.sku_id;
  return jsonb_build_object('version',1,'checkoutReady',(select enabled from private.checkout_state where singleton),'revision',(select revision::text from private.inventory_state where singleton),
    'businessDate',(statement_timestamp() at time zone 'Asia/Manila')::date,'items',result,'hasMore',exists(select 1 from public.products
    where archived_at is null and enabled offset page_offset+page_size limit 1));
end $$;

create function public.checkout(command jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor public.profiles; operation uuid; previous private.checkout_operations; resolved jsonb; receipt jsonb;
  revision bigint; payment jsonb; method text; amount numeric; tender numeric; gcash_reference text;
  sale_id uuid:=gen_random_uuid(); item_id uuid; line jsonb; input jsonb; modifier jsonb; batch_row record; stock_row record;
  required numeric; balance numeric; taken numeric; movement_line integer:=0; happened timestamptz; order_number text;
begin
  -- Global lock order matches P3/P5: accounts, catalogue, revision, then batch IDs.
  perform pg_catalog.pg_advisory_xact_lock(171026,3);
  actor:=private.checkout_actor();
  perform pg_catalog.pg_advisory_xact_lock(171026,1);
  perform private.inventory_keys(command,array['operationId','revision','quoteToken','lines','payment'],array['operationId','revision','quoteToken','lines','payment']);
  operation:=(command->>'operationId')::uuid;
  if operation is null then raise exception 'Operation ID required' using errcode='22023'; end if;
  select * into previous from private.checkout_operations where operation_id=operation;
  if previous.operation_id is not null then
    if previous.actor_id<>actor.id or previous.request<>command then raise exception 'Checkout operation changed' using errcode='PT409'; end if;
    perform public.authorize_business_action('sales.read',previous.sale_id);
    return previous.receipt||jsonb_build_object('replayed',true);
  end if;
  if not (select enabled from private.checkout_state where singleton) then
    raise exception 'Checkout is awaiting activation' using errcode='55000'; end if;
  if exists(select 1 from private.inventory_operations where operation_id=operation) then
    raise exception 'Operation ID already used' using errcode='PT409'; end if;
  select s.revision into revision from private.inventory_state s where s.singleton for update;
  if jsonb_typeof(command->'revision') is distinct from 'string' or command->>'revision'<>revision::text then
    raise exception 'Inventory changed; review a fresh quote' using errcode='PT409'; end if;
  resolved:=private.checkout_resolve(command->'lines');
  if jsonb_typeof(command->'quoteToken') is distinct from 'string' or command->>'quoteToken'<>encode(sha256(convert_to(resolved::text,'UTF8')),'hex') then
    raise exception 'Price or configuration changed; review a fresh quote' using errcode='PT409'; end if;
  payment:=command->'payment'; method:=payment->>'method';
  perform private.inventory_keys(payment,array['method','amount','cashTendered','reference'],array['method','amount']);
  amount:=private.inventory_number(payment->'amount',2);
  if amount<>(resolved->>'total')::numeric then raise exception 'Payment must equal total' using errcode='22023'; end if;
  if method='Cash' then
    if payment ? 'reference' then raise exception 'Cash reference not allowed' using errcode='22023'; end if;
    tender:=private.inventory_number(payment->'cashTendered',2);
    if tender<amount then raise exception 'Cash tender must cover total' using errcode='22023'; end if;
  elsif method='GCash' then
    if payment ? 'cashTendered' or jsonb_typeof(payment->'reference') is distinct from 'string' or payment->>'reference' !~ '^[0-9]{13}$' then
      raise exception 'Use a 13 digit GCash reference' using errcode='22023'; end if;
    gcash_reference:=payment->>'reference';
    if exists(select 1 from public.payments where payments.method='GCash' and payments.reference=gcash_reference) then
      raise exception 'Payment reference already recorded' using errcode='PT409'; end if;
  else raise exception 'Invalid payment method' using errcode='22023'; end if;
  -- Acquire all affected batch locks in one stable order before any deduction.
  perform b.id from public.stock_batches b where b.stock_item_id in (
    select (e->>'stockId')::uuid from jsonb_array_elements(resolved->'lines') l cross join lateral jsonb_array_elements(l->'usage') e
  ) order by b.id for update;
  happened:=clock_timestamp();
  if (happened at time zone 'Asia/Manila')::date::text<>resolved->>'businessDate' then
    raise exception 'Business date changed; review a fresh quote' using errcode='PT409'; end if;
  order_number:=to_char(happened at time zone 'Asia/Manila','YYYYMMDD')||'-'||upper(replace(sale_id::text,'-',''));
  insert into public.sales(id,order_number,idempotency_key,request_hash,occurred_at,cashier_id,cashier_name,cashier_role,
    subtotal,tax_amount,total,review_state,status,stock_committed,usage_complete)
  values(sale_id,order_number,operation,encode(sha256(convert_to(command::text,'UTF8')),'hex'),happened,actor.id,actor.full_name,actor.role,
    (resolved->>'subtotal')::numeric,(resolved->>'tax')::numeric,(resolved->>'total')::numeric,
    case when actor.role='Owner' then 'Owner checkout' else 'Awaiting Owner review' end,
    case when actor.role='Owner' then 'Completed' else 'Pending' end,true,true);
  for line in select value from jsonb_array_elements(resolved->'lines') loop
    item_id:=gen_random_uuid();
    insert into public.sale_items(id,sale_id,product_id,variant_id,name,sku,category,quantity,unit_price,original_unit_price,configuration_snapshot)
    values(item_id,sale_id,(line->>'productId')::uuid,(line->>'variantId')::uuid,line->>'name',line->>'sku',line->>'category',
      (line->>'quantity')::integer,(line->>'unitPrice')::numeric,(line->>'originalUnitPrice')::numeric,line-'usage');
    for modifier in select value from jsonb_array_elements(line->'modifiers') loop
      insert into public.sale_item_modifiers(sale_item_id,option_id,name,price)
      values(item_id,(modifier->>'id')::uuid,modifier->>'name',(modifier->>'price')::numeric);
    end loop;
    for input in select value from jsonb_array_elements(line->'usage') order by value->>'stockId' loop
      select si.*,sku.value as sku,u.family into stock_row from public.stock_items si join public.skus sku on sku.id=si.sku_id
        join public.inventory_units u on u.code=si.unit_code where si.id=(input->>'stockId')::uuid;
      required:=(input->>'quantity')::numeric*(line->>'quantity')::integer;
      insert into public.sale_item_stock_usage(sale_item_id,stock_item_id,sku,name,kind,quantity_base,unit_code)
      values(item_id,stock_row.id,stock_row.sku,stock_row.name,stock_row.kind,required,case stock_row.family when 'mass' then 'g' when 'volume' then 'ml' when 'count' then 'pcs' else 'bottles' end);
      for batch_row in select * from public.stock_batches where stock_item_id=stock_row.id and archived_at is null and not unsellable
        and (expires_on is null or expires_on>=(happened at time zone 'Asia/Manila')::date) order by expires_on nulls last,received_at,id loop
        exit when required=0;
        select coalesce(sum(quantity_base),0) into balance from public.stock_movements where batch_id=batch_row.id;
        taken:=least(required,balance);
        if taken>0 then
          insert into public.stock_movements(batch_id,kind,quantity_base,sale_item_id,actor_id,actor_name,actor_role,reason,occurred_at,operation_id,operation_line)
          values(batch_row.id,'Consumption',-taken,item_id,actor.id,actor.full_name,actor.role,'Paid and fulfilled checkout',happened,operation,movement_line);
          movement_line:=movement_line+1; required:=required-taken;
        end if;
      end loop;
      if required<>0 then raise exception 'Stock changed during checkout' using errcode='PT409'; end if;
    end loop;
  end loop;
  insert into public.payments(sale_id,method,amount,reference,cash_tendered,change_given,recorded_at)
  values(sale_id,method,amount,gcash_reference,tender,case when method='Cash' then tender-amount end,happened);
  insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,occurred_at,operation_id)
  values(actor.id,actor.full_name,actor.role,'Checkout recorded','sale',sale_id,'Payment received and order fulfilled',
    jsonb_build_object('stockCommitted',true,'paymentMethod',method,'providerVerified',false,'total',amount::text),happened,operation);
  update private.inventory_state st set revision=st.revision+1 where st.singleton;
  receipt:=private.checkout_public_quote(resolved)||jsonb_build_object('version',1,'saleId',sale_id,'orderNumber',order_number,
    'occurredAt',happened,'cashierId',actor.id,'cashierName',actor.full_name,'cashierRole',actor.role,
    'status',case when actor.role='Owner' then 'Completed' else 'Pending' end,'stockCommitted',true,
    'reviewState',case when actor.role='Owner' then 'Owner checkout' else 'Awaiting Owner review' end,
    'method',method,'reference',gcash_reference,'cashTendered',tender::text,'change',case when method='Cash' then (tender-amount)::text end,
    'providerVerified',false,'operationId',operation,'replayed',false);
  insert into private.checkout_operations(operation_id,actor_id,request,sale_id,receipt) values(operation,actor.id,command,sale_id,receipt);
  return receipt;
end $$;

create function public.read_checkout_receipt(target_sale_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare receipt jsonb;
begin
  perform public.authorize_business_action('sales.read',target_sale_id);
  select o.receipt into receipt from private.checkout_operations o where o.sale_id=target_sale_id;
  if receipt is null then raise exception 'No P6 receipt is available for this sale' using errcode='22023'; end if;
  return receipt;
end $$;

-- Staff can sign only images currently used by an enabled, active POS product.
-- This does not open the inventory image directory or archived/unattached objects.
create function private.pos_image_allowed(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.business_role() is not null and exists(select 1 from public.products p
    where p.image_path=object_name and p.enabled and p.archived_at is null)
$$;
revoke all on function private.pos_image_allowed(text) from public,anon,authenticated,service_role;
grant execute on function private.pos_image_allowed(text) to authenticated;
do $$begin
  if to_regclass('storage.objects') is not null then
    execute 'create policy checkout_image_read on storage.objects for select to authenticated using
      (bucket_id=''inventory-images'' and private.pos_image_allowed(name))';
  end if;
end $$;

create or replace function public.business_access() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor public.profiles;
begin
  actor:=private.checkout_actor();
  return jsonb_build_object('profile',to_jsonb(actor),'businessDate',(statement_timestamp() at time zone 'Asia/Manila')::date,
    'permissions',private.business_permissions(actor.role),'services',jsonb_build_object('inventoryCrud',true,'checkout',
      (select enabled from private.checkout_state where singleton),'salesReview',false,'reports',false));
end $$;

revoke all on function private.checkout_actor(),private.checkout_configuration(uuid,uuid,jsonb,uuid[]),
  private.checkout_price(numeric,text,numeric),private.checkout_usable(uuid),private.checkout_resolve(jsonb),private.checkout_public_quote(jsonb),private.checkout_available(uuid,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.quote_checkout(jsonb),public.read_checkout_catalogue(integer,integer),public.checkout(jsonb),public.read_checkout_receipt(uuid),public.check_checkout_product(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.quote_checkout(jsonb),public.read_checkout_catalogue(integer,integer),public.checkout(jsonb),public.read_checkout_receipt(uuid),public.check_checkout_product(uuid,jsonb) to authenticated;
commit;
