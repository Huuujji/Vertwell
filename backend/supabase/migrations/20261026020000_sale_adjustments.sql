-- New policy for future explicit decisions only; no historical restock/backfill.
begin;
create table private.sale_adjustment_operations (
  operation_id uuid primary key, actor_id uuid not null references public.profiles(id), actor_name text not null, actor_role text not null, request jsonb not null,
  result jsonb not null, created_at timestamptz not null default clock_timestamp()
);
create table private.consumption_batch_snapshots (
  movement_id uuid primary key references public.stock_movements(id), batch jsonb not null
);
create table private.stock_dispositions (
  id uuid primary key default gen_random_uuid(), operation_id uuid not null references private.sale_adjustment_operations(operation_id) deferrable initially deferred,
  sale_id uuid not null references public.sales(id), sale_item_id uuid not null references public.sale_items(id),
  stock_item_id uuid not null references public.stock_items(id), quantity_base numeric(20,6) not null check(quantity_base>0),
  condition text not null check(condition in ('unused','returned_sellable','waste','consumed','not_returned','returned_unsellable')),
  evidence text not null check(length(btrim(evidence)) between 1 and 1000), resale_policy_confirmed boolean not null,
  actor_id uuid not null references public.profiles(id), actor_name text not null, actor_role text not null,
  occurred_at timestamptz not null default clock_timestamp()
);
create table private.stock_disposition_allocations (
  disposition_id uuid not null references private.stock_dispositions(id), source_movement_id uuid not null references public.stock_movements(id),
  quantity_base numeric(20,6) not null check(quantity_base>0), return_movement_id uuid references public.stock_movements(id),
  primary key(disposition_id,source_movement_id)
);
create table private.manual_refunds (
  id uuid primary key default gen_random_uuid(), operation_id uuid not null unique references private.sale_adjustment_operations(operation_id) deferrable initially deferred,
  sale_id uuid not null references public.sales(id), amount public.money_amount not null check(amount>0), method text not null check(method in ('Cash','GCash')),
  reference text not null check(length(btrim(reference)) between 1 and 100), evidence text not null,
  paid_at timestamptz not null, recorded_at timestamptz not null default clock_timestamp(),
  actor_id uuid not null references public.profiles(id), actor_name text not null, actor_role text not null,
  unique(method,reference)
);
do $$declare t text; begin
  foreach t in array array['sale_adjustment_operations','consumption_batch_snapshots','stock_dispositions','stock_disposition_allocations','manual_refunds'] loop
    execute format('alter table private.%I enable row level security',t);
    execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
    execute format('create trigger immutable_adjustment before update or delete on private.%I for each row execute function private.deny_history_change()',t);
    execute format('create trigger immutable_adjustment_truncate before truncate on private.%I for each statement execute function private.deny_history_change()',t);
  end loop;
end $$;
create function private.capture_consumption_batch() returns trigger language plpgsql set search_path='' as $$
begin
  if new.kind='Consumption' then
    insert into private.consumption_batch_snapshots(movement_id,batch) select new.id,to_jsonb(b) from public.stock_batches b where b.id=new.batch_id;
  end if;
  return new;
end $$;
create trigger capture_consumption_batch after insert on public.stock_movements for each row execute function private.capture_consumption_batch();

create function private.adjustment_namespace() returns trigger language plpgsql set search_path='' as $$
begin
  if exists(select 1 from private.sale_adjustment_operations o where o.operation_id=new.operation_id) then
    raise exception 'Operation ID already used' using errcode='PT409'; end if;
  return new;
end $$;
do $$declare t text; begin
  foreach t in array array['inventory_operations','checkout_operations','account_operations','sales_workflow_operations'] loop
    execute format('create trigger adjustment_namespace before insert on private.%I for each row execute function private.adjustment_namespace()',t);
  end loop;
end $$;

create function private.adjustment_reason(reason_id text) returns text language plpgsql immutable set search_path='' as $$
declare label text;
begin
  label:=case reason_id when 'duplicate' then 'Duplicate sale / transaction' when 'incorrect_order' then 'Incorrect order entered'
    when 'cancellation' then 'Customer cancellation' when 'refund_return' then 'Customer refund / return'
    when 'quality' then 'Damaged, spoiled or quality issue' when 'other' then 'Other' end;
  if label is null then raise exception 'Select a valid reason' using errcode='22023'; end if;
  return label;
end $$;

alter function private.sales_workflow_token(uuid) rename to sales_workflow_token_previous;
create function private.sales_workflow_token(sale uuid) returns text language sql stable security definer set search_path='' as $$
  select encode(sha256(convert_to(jsonb_build_object('previous',private.sales_workflow_token_previous(sale),
    'operations',(select coalesce(jsonb_agg(o.operation_id order by o.created_at,o.operation_id),'[]') from private.sale_adjustment_operations o
      where exists(select 1 from jsonb_array_elements(o.request->'targets') t where t->>'saleId'=sale::text)))::text,'UTF8')),'hex')
$$;
create function private.sale_adjustment_evidence(sale uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'decisions',(select coalesce(jsonb_agg(jsonb_build_object('operationId',o.operation_id,'kind',o.request->>'kind','reasonId',o.request->>'reasonId',
      'reasonLabel',case when o.request ? 'reasonId' then private.adjustment_reason(o.request->>'reasonId') end,'notes',o.request->>'notes',
      'actorId',o.actor_id,'actorName',o.actor_name,'actorRole',o.actor_role,'occurredAt',o.created_at) order by o.created_at,o.operation_id),'[]')
      from private.sale_adjustment_operations o
      where exists(select 1 from jsonb_array_elements(o.request->'targets') t where t->>'saleId'=sale::text)),
    'dispositions',(select coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object('quantity_base',d.quantity_base::text,'allocations',(
      select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('quantity_base',a.quantity_base::text,'batch',b.batch) order by a.source_movement_id),'[]')
      from private.stock_disposition_allocations a left join private.consumption_batch_snapshots b on b.movement_id=a.source_movement_id where a.disposition_id=d.id)) order by d.occurred_at,d.id),'[]')
      from private.stock_dispositions d where d.sale_id=sale),
    'refunds',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('amount',r.amount::text,'status','Manually paid; recorded evidence','providerVerified',false) order by r.recorded_at,r.id),'[]')
      from private.manual_refunds r where r.sale_id=sale))
$$;
alter function private.sales_workflow_sale(uuid,boolean) rename to sales_workflow_sale_previous;
create function private.sales_workflow_sale(sale uuid,manager boolean) returns jsonb language sql stable security definer set search_path='' as $$
  select private.sales_workflow_sale_previous(sale,manager)||jsonb_build_object('token',private.sales_workflow_token(sale),'adjustments',private.sale_adjustment_evidence(sale),
    'adjustableItems',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'category',i.category,'quantity',i.quantity,
      'model',i.configuration_snapshot->'configuration'->>'stockModel',
      'usage',(select coalesce(jsonb_agg(jsonb_build_object('stockId',u.stock_item_id,'name',u.name,'kind',u.kind,'unit',u.unit_code,'quantity',u.quantity_base::text,
        'accountedQuantity',(select coalesce(sum(d.quantity_base),0)::text from private.stock_dispositions d where d.sale_item_id=i.id and d.stock_item_id=u.stock_item_id)) order by u.id),'[]') from public.sale_item_stock_usage u where u.sale_item_id=i.id)) order by i.id),'[]') from public.sale_items i where i.sale_id=sale))
$$;

-- The original implementation remains private for immutable legacy receipts and
-- its review/stale/bulk semantics. Only this validated contract is executable.
alter function public.sales_workflow_command(jsonb) set schema private;
alter function private.sales_workflow_command(jsonb) rename to sales_workflow_command_previous;
revoke all on function private.sales_workflow_command_previous(jsonb) from public,anon,authenticated,service_role;
create function public.sales_workflow_command(command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.profiles; operation uuid; kind text; saved private.sale_adjustment_operations; label text; notes text;
  legacy jsonb; result jsonb; target jsonb; plan jsonb; i public.sale_items; s public.sales; p public.payments;
  d_id uuid; q numeric; accounted numeric; condition text; evidence text; resale boolean; usage record; movement record;
  needed numeric; available numeric; taken numeric; returned uuid; line_no integer:=0; prior numeric; restored boolean:=false;
  happened timestamptz:=clock_timestamp(); paid timestamptz; amount numeric; refunded numeric; source_batch jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(171026,3); actor:=private.checkout_actor();
  perform pg_catalog.pg_advisory_xact_lock(171026,5);
  happened:=clock_timestamp();
  kind:=command->>'kind'; operation:=(command->>'operationId')::uuid;
  if kind='review.confirm' then return private.sales_workflow_command_previous(command); end if;
  if operation is null or kind is null or kind not in ('void.request','void.decide','sale.void','stock.dispose','refund.record') then raise exception 'Invalid adjustment command' using errcode='22023'; end if;
  if actor.role='Staff' and kind<>'void.request' then raise exception 'Manager decision required' using errcode='42501'; end if;
  -- Permit exact replay of already committed historical commands, never new
  -- loose-text decisions. No new physical/money behavior is applied to them.
  if exists(select 1 from private.sales_workflow_operations o where o.operation_id=operation and o.request=command and o.actor_id=actor.id) then
    return private.sales_workflow_command_previous(command); end if;
  select * into saved from private.sale_adjustment_operations o where o.operation_id=operation;
  if saved.operation_id is not null then
    if saved.actor_id<>actor.id or saved.request<>command then raise exception 'Adjustment operation changed' using errcode='PT409'; end if;
    for target in select value from jsonb_array_elements(command->'targets') loop perform public.authorize_business_action('sales.read',(target->>'saleId')::uuid); end loop;
    return saved.result||jsonb_build_object('replayed',true);
  end if;
  if exists(select 1 from private.checkout_operations where operation_id=operation) or exists(select 1 from private.inventory_operations where operation_id=operation)
    or exists(select 1 from private.account_operations where operation_id=operation) or exists(select 1 from private.sales_workflow_operations where operation_id=operation) then
    raise exception 'Operation ID already used' using errcode='PT409'; end if;
  perform private.inventory_keys(command,array['operationId','kind','targets','reasonId','notes','requestId','approved','dispositions','refund'],array['operationId','kind','targets','reasonId','notes']);
  label:=private.adjustment_reason(command->>'reasonId');
  if jsonb_typeof(command->'notes') is distinct from 'string' or length(command->>'notes')>1000 then raise exception 'Invalid notes' using errcode='22023'; end if;
  notes:=btrim(command->>'notes'); if command->>'reasonId'='other' and notes='' then raise exception 'Explain Other' using errcode='22023'; end if;
  perform private.inventory_list(command->'targets');
  if jsonb_array_length(command->'targets')<1 or jsonb_array_length(command->'targets')>500 or
    (kind<>'sale.void' and jsonb_array_length(command->'targets')<>1) then raise exception 'Choose an exact receipt set' using errcode='22023'; end if;
  if kind in ('stock.dispose','refund.record') then
    perform private.inventory_keys(command,case when kind='stock.dispose' then array['operationId','kind','targets','reasonId','notes','dispositions'] else array['operationId','kind','targets','reasonId','notes','refund'] end,
      case when kind='stock.dispose' then array['operationId','kind','targets','reasonId','notes','dispositions'] else array['operationId','kind','targets','reasonId','notes','refund'] end);
    target:=command->'targets'->0;
    perform private.inventory_keys(target,array['saleId','token'],array['saleId','token']);
    perform public.authorize_business_action('sales.read',(target->>'saleId')::uuid);
    select * into s from public.sales where id=(target->>'saleId')::uuid for update;
    if target->>'token' is distinct from private.sales_workflow_token(s.id) then raise exception 'Receipt changed; review again' using errcode='PT409'; end if;
    result:=jsonb_build_object('version',1,'operationId',operation,'kind',kind,'replayed',false,'results',jsonb_build_array(jsonb_build_object('saleId',s.id,'outcome',case when kind='stock.dispose' then 'disposed' else 'refunded' end)));
  else
    if command ? 'refund' or command ? 'dispositions' then raise exception 'Record stock disposition and actual manual refund as separate reviewed actions' using errcode='22023'; end if;
    legacy:=(command-'reasonId'-'notes')||jsonb_build_object('reason',case when command->>'reasonId'='other' then notes else label||case when notes<>'' then ': '||notes else '' end end);
    result:=private.sales_workflow_command_previous(legacy);
  end if;
  if kind='stock.dispose' then
    if s.stock_committed is distinct from true or s.usage_complete is distinct from true then raise exception 'Original stock usage is incomplete; do not fabricate restoration' using errcode='PT409'; end if;
    perform private.inventory_list(command->'dispositions');
    if jsonb_array_length(command->'dispositions')<1 or jsonb_array_length(command->'dispositions')>100 then raise exception 'Select affected items' using errcode='22023'; end if;
    perform 1 from private.inventory_state where singleton for update;
    perform b.id from public.stock_batches b join public.stock_movements m on m.batch_id=b.id join public.sale_items si on si.id=m.sale_item_id where si.sale_id=s.id order by b.id for update of b;
    for plan in select value from jsonb_array_elements(command->'dispositions') loop
      perform private.inventory_keys(plan,array['itemId','stockId','quantityBase','condition','evidence','resalePolicyConfirmed'],array['itemId','stockId','quantityBase','condition','evidence','resalePolicyConfirmed']);
      select * into i from public.sale_items where id=(plan->>'itemId')::uuid and sale_id=s.id;
      select * into usage from public.sale_item_stock_usage u where u.sale_item_id=i.id and u.stock_item_id=(plan->>'stockId')::uuid;
      q:=private.inventory_number(plan->'quantityBase',6); condition:=plan->>'condition'; evidence:=private.inventory_text(plan->'evidence',1000); resale:=private.inventory_bool(plan->'resalePolicyConfirmed');
      select coalesce(sum(d.quantity_base),0) into accounted from private.stock_dispositions d where d.sale_item_id=i.id and d.stock_item_id=usage.stock_item_id;
      if i.id is null or usage.id is null or q<=0 or q+accounted>usage.quantity_base or condition is null or condition not in ('unused','returned_sellable','waste','consumed','not_returned','returned_unsellable') then raise exception 'Disposition exceeds remaining original quantity or has invalid facts' using errcode='PT409'; end if;
      if usage.unit_code in ('pcs','bottles') and q<>trunc(q) then raise exception 'Counted stock requires whole units' using errcode='22023'; end if;
      if condition='returned_sellable' and (not resale or usage.kind<>'Finished') then raise exception 'Only inspected finished goods approved for resale can be returned as sellable' using errcode='22023'; end if;
      -- Demand must agree with original consumption for EACH stock snapshot.
      if not exists(select 1 from public.sale_item_stock_usage u where u.sale_item_id=i.id) or exists(
        select 1 from public.sale_item_stock_usage u where u.sale_item_id=i.id and u.quantity_base<>(select coalesce(-sum(m.quantity_base),0) from public.stock_movements m join public.stock_batches b on b.id=m.batch_id where m.kind='Consumption' and m.sale_item_id=i.id and b.stock_item_id=u.stock_item_id)) then
        raise exception 'Original usage and batch deductions do not reconcile' using errcode='PT409'; end if;
      insert into private.stock_dispositions(operation_id,sale_id,sale_item_id,stock_item_id,quantity_base,condition,evidence,resale_policy_confirmed,actor_id,actor_name,actor_role)
        values(operation,s.id,i.id,usage.stock_item_id,q,condition,evidence,resale,actor.id,actor.username,actor.role) returning id into d_id;
        needed:=q;
        for movement in select m.* from public.stock_movements m join public.stock_batches b on b.id=m.batch_id where m.kind='Consumption' and m.sale_item_id=i.id and b.stock_item_id=usage.stock_item_id order by m.occurred_at,m.id loop
          exit when needed=0;
          select coalesce(sum(a.quantity_base),0) into prior from private.stock_disposition_allocations a where a.source_movement_id=movement.id;
          available:=-movement.quantity_base-prior; taken:=least(needed,available); returned:=null;
          if taken>0 then
            if condition in ('unused','returned_sellable') then
              select batch into source_batch from private.consumption_batch_snapshots where movement_id=movement.id;
              if source_batch is null or exists(select 1 from public.stock_batches b where b.id=movement.batch_id and
                (b.archived_at is not null or b.unsellable or ((source_batch->>'expires_on') is not null and (b.expires_on is null or b.expires_on>(source_batch->>'expires_on')::date)))) then
                raise exception 'Original batch facts unavailable or less restrictive than the original expiry; retain as unsellable and review' using errcode='PT409'; end if;
              insert into public.stock_movements(batch_id,kind,quantity_base,actor_id,actor_name,actor_role,reason,operation_id,operation_line,occurred_at)
                values(movement.batch_id,'Return',taken,actor.id,actor.username,actor.role,label||': '||evidence,operation,line_no,happened) returning id into returned;
              line_no:=line_no+1; restored:=true;
            end if;
            insert into private.stock_disposition_allocations values(d_id,movement.id,taken,returned);
            needed:=needed-taken;
          end if;
        end loop;
        if needed<>0 then raise exception 'Eligible original batch quantities are exhausted' using errcode='PT409'; end if;
    end loop;
    if restored then update private.inventory_state st set revision=revision+1 where singleton; end if;
  elsif kind='refund.record' then
    perform private.inventory_keys(command->'refund',array['amount','method','reference','paidAt','evidence','paidConfirmed'],array['amount','method','reference','paidAt','evidence','paidConfirmed']);
    if not private.inventory_bool(command->'refund'->'paidConfirmed') then raise exception 'Confirm actual manual payout first' using errcode='22023'; end if;
    select * into p from public.payments where sale_id=s.id;
    amount:=private.inventory_number(command->'refund'->'amount',2);
    select coalesce(sum(r.amount),0) into refunded from private.manual_refunds r where r.sale_id=s.id;
    paid:=(command->'refund'->>'paidAt')::timestamptz;
    if amount<=0 or p.id is null or p.amount<>s.total or amount>p.amount-refunded or command->'refund'->>'method' is distinct from p.method or paid is null or paid>happened or paid<p.recorded_at then
      raise exception 'Refund exceeds remaining received money, has wrong method or invalid payout time' using errcode='PT409'; end if;
    insert into private.manual_refunds(operation_id,sale_id,amount,method,reference,evidence,paid_at,actor_id,actor_name,actor_role)
      values(operation,s.id,amount,p.method,private.inventory_text(command->'refund'->'reference',100),private.inventory_text(command->'refund'->'evidence',1000),paid,actor.id,actor.username,actor.role);
    if p.method='Cash' then insert into public.cash_movements(kind,amount,sale_id,actor_id,actor_name,actor_role,reason,occurred_at,operation_id)
      values('Refund',amount,s.id,actor.id,actor.username,actor.role,'Manual refund evidence: '||(command->'refund'->>'reference'),paid,operation); end if;
  end if;
  for target in select value from jsonb_array_elements(command->'targets') loop
    insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,operation_id,occurred_at)
      values(actor.id,actor.username,actor.role,'Sale adjustment recorded','sale',(target->>'saleId')::uuid,label||case when notes<>'' then ': '||notes else '' end,
        jsonb_build_object('kind',kind,'reasonId',command->>'reasonId','reasonLabel',label,'notes',notes,'stockRestored',restored,'manualRefund',kind='refund.record','providerVerified',false,'result',result),operation,clock_timestamp());
  end loop;
  insert into private.sale_adjustment_operations(operation_id,actor_id,actor_name,actor_role,request,result) values(operation,actor.id,actor.username,actor.role,command,result);
  return result;
end $$;
revoke all on function public.sales_workflow_command(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.sales_workflow_command(jsonb) to authenticated;

alter function public.read_reports() rename to read_reports_previous;
alter function public.read_reports_previous() set schema private;
revoke all on function private.read_reports_previous() from public,anon,authenticated,service_role;
create function public.read_reports() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  result:=private.read_reports_previous();
  return result||jsonb_build_object('adjustments',(select coalesce(jsonb_agg(jsonb_build_object('saleId',s.id,'evidence',private.sale_adjustment_evidence(s.id)) order by s.id),'[]') from public.sales s));
end $$;
revoke all on function public.read_reports() from public,anon,authenticated,service_role;
grant execute on function public.read_reports() to authenticated;
revoke all on function private.capture_consumption_batch(),private.adjustment_namespace(),private.adjustment_reason(text),private.sale_adjustment_evidence(uuid),private.sales_workflow_token(uuid),private.sales_workflow_sale(uuid,boolean) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
