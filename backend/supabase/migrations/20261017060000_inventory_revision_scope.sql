-- P5 browser acceptance: PostgREST loads safeupdate, which requires a WHERE
-- clause even for this constrained singleton. Preserve the existing command,
-- locks, permissions, revision/idempotency checks and atomic audit; qualify only
-- its final revision UPDATE. Never edit the already-applied P5 migration.
begin;
create or replace function public.inventory_command(command jsonb) returns jsonb
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
  update private.inventory_state s set revision=s.revision+1 where s.singleton;
  insert into private.inventory_operations(operation_id,actor_id,request,entity_id) values(operation,actor.id,command,entity);
  saved:=public.read_inventory();
  return jsonb_build_object('operationId',operation,'entityId',entity,'replayed',false,'inventory',saved);
end $$;
notify pgrst, 'reload schema';
commit;