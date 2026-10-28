-- LOCAL ONLY: strengthens new sale-correction explanations after exact committed replay.
-- Preserve existing locks, permissions, evidence and physical/payment paths.
begin;
create or replace function public.sales_workflow_command(command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
  notes:=btrim(command->>'notes'); if command->>'reasonId'='other' and (notes='' or (kind in ('void.request','void.decide','sale.void') and notes !~ '[[:alnum:]]')) then raise exception 'Explain Other' using errcode='22023'; end if;
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
notify pgrst,'reload schema';
commit;
