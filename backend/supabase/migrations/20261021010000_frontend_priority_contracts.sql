begin;

-- Existing history and migration sources remain unchanged. Optional notes do not
-- weaken exact receipt selection, Owner authorization or payment validation.
do $$
declare c record; removed integer := 0;
begin
  for c in select conname from pg_constraint where conrelid='public.daily_sales_reviews'::regclass
    and contype='c' and (pg_get_constraintdef(oid) like '%btrim(explanation)%' or conname='daily_sales_reviews_outcome_check') loop
    execute format('alter table public.daily_sales_reviews drop constraint %I',c.conname);
    removed:=removed+1;
  end loop;
  if removed<>2 then raise exception 'Unexpected daily review constraint baseline'; end if;
end $$;
alter table public.daily_sales_reviews add constraint daily_sales_reviews_outcome_check
  check(outcome in ('Matched','Reviewed with discrepancy','Reviewed with explained discrepancy'));

-- Replace only the attribution expression in installed function bodies. This
-- retains the latest versions of all earlier permission/locking/retry fixes and
-- preserves each function's signature, security settings, owner and grants.
do $$
declare f record; definition text;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prokind='f' and p.prosrc like '%actor.full_name%' loop
    definition:=replace(pg_get_functiondef(f.oid),'actor.full_name','actor.username');
    execute definition;
  end loop;
  definition:=pg_get_functiondef('public.sales_workflow_command(jsonb)'::regprocedure);
  if position('Explain the discrepancy decision' in definition)=0 then raise exception 'Unexpected review function baseline'; end if;
  definition:=replace(definition,
    'if outcome<>''Matched'' and explanation='''' then raise exception ''Explain the discrepancy decision'' using errcode=''22023''; end if;', '');
  definition:=replace(definition,'''Reviewed with explained discrepancy''','''Reviewed with discrepancy''');
  definition:=replace(definition,'''Matched reconciliation''','''Owner accepted reconciliation''');
  execute definition;
end $$;

-- Commands hold the shared catalogue lock before entering these helpers, so
-- concurrent same-name creates cannot pass this check together. No name merge
-- or stock receipt is performed until the user explicitly confirms a delivery.
do $$
declare definition text;
begin
  definition:=pg_get_functiondef('private.inventory_stock(jsonb,public.profiles,uuid,text,text)'::regprocedure);
  if position('new_item:=s.id is null;' in definition)=0 then raise exception 'Unexpected stock function baseline'; end if;
  definition:=replace(definition,'new_item:=s.id is null;', $guard$new_item:=s.id is null;
  if exists(select 1 from public.stock_items other where other.id<>sid and other.archived_at is null
    and other.kind=value->>'kind' and lower(regexp_replace(btrim(other.name),'\s+',' ','g'))=
      lower(regexp_replace(btrim(private.inventory_text(value->'name')),'\s+',' ','g'))) then
    raise exception 'An item with this name already exists. Receive a new batch instead' using errcode='PT409'; end if;
  $guard$);
  definition:=replace(definition,'threshold:=private.inventory_number(value->''threshold'',6);', $guard$threshold:=private.inventory_number(value->'threshold',6);
  if (new_item or threshold<>s.threshold_base) and threshold<=0 then
    raise exception 'Quantity alert must be positive' using errcode='22023'; end if;
  $guard$);
  definition:=replace(definition,'if b.id is null then', $guard$if b.id is null then
      if (new_item or movement_kind='Receipt') and qty<=0 then
        raise exception 'Starting and received quantities must be positive' using errcode='22023'; end if;
  $guard$);
  execute definition;

  definition:=pg_get_functiondef('private.inventory_product(jsonb,jsonb,public.profiles,uuid,text)'::regprocedure);
  if position('select * into p from public.products where id=pid;' in definition)=0 then raise exception 'Unexpected product function baseline'; end if;
  definition:=replace(definition,'select * into p from public.products where id=pid;', $guard$select * into p from public.products where id=pid;
  if exists(select 1 from public.products other where other.id<>pid and other.archived_at is null
    and lower(regexp_replace(btrim(other.name),'\s+',' ','g'))=
      lower(regexp_replace(btrim(private.inventory_text(value->'name')),'\s+',' ','g'))) then
    raise exception 'A product with this name already exists. Receive its existing stock instead' using errcode='PT409'; end if;
  $guard$);
  execute definition;

  definition:=pg_get_functiondef('public.read_managed_accounts()'::regprocedure);
  -- Apply the same order to all account pages, including inactive accounts.
  definition:=replace(definition,'order by lower(p.full_name),p.id','order by p.created_at desc,p.id desc');
  execute definition;
  definition:=pg_get_functiondef('public.read_checkout_catalogue(integer,integer)'::regprocedure);
  definition:=replace(definition,'order by lower(p.name),p.id','order by p.created_at desc,p.id desc');
  definition:=replace(definition,'order by lower(name),id','order by created_at desc,id desc');
  execute definition;
end $$;

commit;
