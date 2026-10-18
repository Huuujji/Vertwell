-- Read-only POS feedback. No business-table grants, mutations or receipt changes.
begin;

create function public.read_checkout_stock(lines jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare line jsonb; config jsonb; resolved jsonb:='[]'; quantities jsonb:='[]';
  qty numeric; demand record; input jsonb; own numeric; other numeric; usable numeric;
  maximum integer; limits jsonb:='[]'; stocks jsonb:='[]'; i integer;
begin
  perform private.checkout_actor();
  perform private.inventory_list(lines);
  if jsonb_array_length(lines) not between 1 and 100 then raise exception 'Use 1 to 100 cart lines' using errcode='22023'; end if;
  for line in select value from jsonb_array_elements(lines) loop
    perform private.inventory_keys(line,array['productId','variantId','modifierIds','quantity'],array['productId','variantId','modifierIds','quantity']);
    qty:=private.inventory_number(line->'quantity',1);
    if qty<>trunc(qty) or qty not between 1 and 10000 then raise exception 'Use a positive whole quantity' using errcode='22023'; end if;
    config:=private.checkout_configuration((line->>'productId')::uuid,(line->>'variantId')::uuid,line->'modifierIds');
    resolved:=resolved||jsonb_build_array(config);
    quantities:=quantities||to_jsonb(qty);
  end loop;
  -- Only stock referenced by valid, enabled POS configurations is returned.
  -- Batch dates, costs, accounts and unrelated inventory remain inaccessible.
  for demand in select (u->>'stockId')::uuid id,sum((u->>'quantity')::numeric*(quantities->>idx)::numeric) needed
    from jsonb_array_elements(resolved) with ordinality r(c,ord)
    cross join lateral (select (ord-1)::integer idx) p
    cross join lateral jsonb_array_elements(c->'usage') u group by 1
  loop
    select jsonb_build_object('stockId',s.id,'name',s.name,'sku',k.value,'unit',s.unit_code,
      'usable',(private.checkout_usable(s.id)/u.factor)::text,'required',(demand.needed/u.factor)::text,
      'remaining',((private.checkout_usable(s.id)-demand.needed)/u.factor)::text,
      'lineNeeds',(select jsonb_agg((coalesce((select (v->>'quantity')::numeric from jsonb_array_elements(c->'usage') v
        where v->>'stockId'=s.id::text),0)*(quantities->>(ord-1)::integer)::numeric/u.factor)::text order by ord)
        from jsonb_array_elements(resolved) with ordinality r(c,ord))) into input
      from public.stock_items s join public.skus k on k.id=s.sku_id join public.inventory_units u on u.code=s.unit_code where s.id=demand.id;
    stocks:=stocks||jsonb_build_array(input);
  end loop;
  for i in 0..jsonb_array_length(resolved)-1 loop
    maximum:=10000;
    for input in select value from jsonb_array_elements(resolved->i->'usage') loop
      own:=(input->>'quantity')::numeric;
      if own>0 then
        select coalesce(sum((u->>'quantity')::numeric*(quantities->>(ord-1)::integer)::numeric),0) into other
          from jsonb_array_elements(resolved) with ordinality r(c,ord) cross join lateral jsonb_array_elements(c->'usage') u
          where ord<>i+1 and u->>'stockId'=input->>'stockId';
        usable:=private.checkout_usable((input->>'stockId')::uuid);
        maximum:=least(maximum,greatest(0,floor((usable-other)/own)));
      end if;
    end loop;
    limits:=limits||to_jsonb(maximum);
  end loop;
  return jsonb_build_object('version',1,'maximums',limits,'stocks',stocks);
end $$;

create function public.read_checkout_catalogue_stock(page_offset integer default 0,page_size integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare catalogue jsonb;
begin
  -- Retain the established catalogue contract and its actor/pagination checks.
  catalogue:=public.read_checkout_catalogue(page_offset,page_size);
  return jsonb_set(catalogue,'{items}',(select coalesce(jsonb_agg(item||jsonb_build_object('stockId',case when item->>'model'='Retail Item' then p.stock_item_id else null end,'usableQuantity',
    case when item->>'model'='Retail Item' then private.checkout_usable(p.stock_item_id)::text else null end) order by ord),'[]')
    from jsonb_array_elements(catalogue->'items') with ordinality r(item,ord) join public.products p on p.id=(item->>'id')::uuid));
end $$;

revoke all on function public.read_checkout_stock(jsonb),public.read_checkout_catalogue_stock(integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.read_checkout_stock(jsonb),public.read_checkout_catalogue_stock(integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
