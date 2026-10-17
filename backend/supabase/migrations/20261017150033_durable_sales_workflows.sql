-- P7. CLI-generated timestamp normalized to Asia/Manila before application.
-- No activation change, table write grants, stock movements or payment changes.
begin;

create table private.sales_workflow_operations (
  operation_id uuid primary key, actor_id uuid not null references public.profiles(id),
  request jsonb not null, result jsonb not null, created_at timestamptz not null default now()
);
revoke all on private.sales_workflow_operations from public,anon,authenticated,service_role;
create trigger workflow_receipt_immutable before update or delete on private.sales_workflow_operations
for each row execute function private.deny_history_change();

alter table public.cash_movements add column review_id uuid references public.daily_sales_reviews(id);
create index cash_movements_review_fk on public.cash_movements(review_id);
alter table public.audit_events add column event_sequence bigint generated always as identity;

-- All writers already hold the account lock. Prevent later P5/P6 commands from
-- reusing an operation ID that was first committed by P7 (and vice versa).
create function private.workflow_operation_namespace() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists(select 1 from private.sales_workflow_operations where operation_id=new.operation_id) then
    raise exception 'Operation ID already used' using errcode='PT409';
  end if;
  return new;
end $$;
create trigger workflow_operation_namespace before insert on private.inventory_operations
for each row execute function private.workflow_operation_namespace();
create trigger workflow_operation_namespace before insert on private.checkout_operations
for each row execute function private.workflow_operation_namespace();
create trigger workflow_operation_namespace before insert on private.account_operations
for each row execute function private.workflow_operation_namespace();

-- Content token includes EVERY request and the review linkage, so a rejected
-- request followed by another request cannot restore an earlier command token.
create function private.sales_workflow_token(sale uuid) returns text
language sql stable security definer set search_path = '' as $$
  select encode(sha256(convert_to(jsonb_build_object('sale',to_jsonb(s),
    'requests',(select coalesce(jsonb_agg(to_jsonb(v) order by v.requested_at,v.id),'[]') from public.void_requests v where v.sale_id=s.id),
    'review',(select to_jsonb(i) from public.daily_sales_review_items i where i.sale_id=s.id))::text,'UTF8')),'hex')
  from public.sales s where s.id=sale
$$;

create function private.sales_workflow_sale(sale uuid, manager boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',s.id,'orderNumber',s.order_number,'token',private.sales_workflow_token(s.id),
    'businessDate',s.business_date,'occurredAt',s.occurred_at,'cashierId',s.cashier_id,'cashierName',s.cashier_name,
    'cashierRole',s.cashier_role,'status',s.status,'reviewState',s.review_state,'total',s.total::text,
    'method',p.method,'reference',p.reference,'stockCommitted',s.stock_committed,'usageComplete',s.usage_complete,
    'voidedAt',s.voided_at,'voidedName',s.voided_name,'voidedRole',s.voided_role,'voidReason',s.void_reason,'bulkActionId',s.bulk_action_id,
    'bulkAction',case when manager then (select jsonb_build_object('operationId',o.operation_id,'reason',o.request->>'reason','results',o.result->'results')
      from private.sales_workflow_operations o where o.operation_id=s.bulk_action_id) else null end,
    'receipt',(select o.receipt from private.checkout_operations o where o.sale_id=s.id),
    'requests',(select coalesce(jsonb_agg(to_jsonb(v) order by v.requested_at,v.id),'[]') from public.void_requests v where v.sale_id=s.id),
    'events',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('event_sequence',a.event_sequence::text) order by a.occurred_at,a.event_sequence),'[]') from public.audit_events a where a.entity_type='sale' and a.entity_id=s.id),
    'review',(select jsonb_build_object('id',r.id,'owner',r.owner_name,'role',r.owner_role,'time',r.reviewed_at,'outcome',r.outcome,
      'details',case when manager then to_jsonb(r) || jsonb_build_object(
        'expected_cash',r.expected_cash::text,'expected_gcash',r.expected_gcash::text,
        'verified_cash',r.verified_cash::text,'verified_gcash',r.verified_gcash::text,'counted_cash',r.counted_cash::text,
        'opening_cash',r.opening_cash::text,'additions',r.additions::text,'removals',r.removals::text,'refunds',r.refunds::text,
        'orderIds',(select jsonb_agg(i.sale_id order by i.sale_id) from public.daily_sales_review_items i where i.review_id=r.id),
        'cashMovements',(select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('amount',c.amount::text) order by c.kind,c.id),'[]')
          from public.cash_movements c where c.review_id=r.id)) else null end)
      from public.daily_sales_review_items i join public.daily_sales_reviews r on r.id=i.review_id where i.sale_id=s.id))
  from public.sales s left join public.payments p on p.sale_id=s.id where s.id=sale
$$;

-- Caller-scoped coherent pages. Tokens cover the complete authorized dataset,
-- independent of page size, and the client must reject mixed-revision pages.
create function public.read_sales_workflow(page_offset integer default 0,page_size integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor public.profiles; today date:=(statement_timestamp() at time zone 'Asia/Manila')::date;
  items jsonb; revision text; more boolean;
begin
  actor:=private.checkout_actor();
  if page_offset is null or page_offset<0 or page_offset>1000000 or page_size is null or page_size<1 or page_size>100 then
    raise exception 'Invalid pagination' using errcode='22023'; end if;
  select encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_array(s.id,private.sales_workflow_token(s.id)) order by s.id),'[]')::text,'UTF8')),'hex')
    into revision from public.sales s where actor.role in ('Owner','Admin') or (s.cashier_id=actor.id and s.business_date=today);
  select coalesce(jsonb_agg(private.sales_workflow_sale(s.id,actor.role in ('Owner','Admin')) order by s.occurred_at desc,s.id desc),'[]')
    into items from (select * from public.sales s where actor.role in ('Owner','Admin') or (s.cashier_id=actor.id and s.business_date=today)
      order by s.occurred_at desc,s.id desc offset page_offset limit page_size) s;
  select exists(select 1 from public.sales s where actor.role in ('Owner','Admin') or (s.cashier_id=actor.id and s.business_date=today)
    offset page_offset+page_size limit 1) into more;
  return jsonb_build_object('version',1,'businessDate',today,'revision',revision,'items',items,'hasMore',more);
end $$;

create function public.sales_workflow_command(command jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
<<workflow>>
declare actor public.profiles; previous private.sales_workflow_operations; operation uuid; kind text; reason text;
  targets jsonb; target jsonb; sale public.sales; request public.void_requests; pending public.void_requests;
  happened timestamptz; today date; result jsonb; results jsonb:='[]'; ids uuid[]; review_id uuid:=gen_random_uuid();
  expected_cash numeric; expected_gcash numeric; counted numeric; digital numeric; opening numeric; additions numeric; removals numeric; refunds numeric; verified_cash numeric;
  explanation text; outcome text; review_date date; entry record; final_status text;
begin
  perform pg_catalog.pg_advisory_xact_lock(171026,3);
  actor:=private.checkout_actor();
  perform pg_catalog.pg_advisory_xact_lock(171026,5);
  perform private.inventory_keys(command,array['operationId','kind','targets','reason','requestId','approved','review'],array['operationId','kind','targets']);
  operation:=(command->>'operationId')::uuid; kind:=command->>'kind';
  if operation is null or kind is null or kind not in ('void.request','void.decide','sale.void','review.confirm') then
    raise exception 'Invalid workflow command' using errcode='22023'; end if;
  if (kind='review.confirm' and actor.role<>'Owner') or (kind in ('void.decide','sale.void') and actor.role not in ('Owner','Admin')) then
    raise exception 'Business access is not permitted' using errcode='42501'; end if;
  select * into previous from private.sales_workflow_operations o where o.operation_id=operation;
  if previous.operation_id is not null then
    if previous.actor_id<>actor.id or previous.request<>command then raise exception 'Workflow operation changed' using errcode='PT409'; end if;
    for target in select value from jsonb_array_elements(previous.request->'targets') loop
      perform public.authorize_business_action('sales.read',(target->>'saleId')::uuid);
    end loop;
    return previous.result||jsonb_build_object('replayed',true);
  end if;
  if exists(select 1 from private.inventory_operations where operation_id=operation) or
    exists(select 1 from private.checkout_operations where operation_id=operation) or
    exists(select 1 from private.account_operations where operation_id=operation) then
    raise exception 'Operation ID already used' using errcode='PT409'; end if;
  if kind='review.confirm' then
    perform private.inventory_keys(command,array['operationId','kind','targets','review'],array['operationId','kind','targets','review']);
  elsif kind='void.decide' then
    perform private.inventory_keys(command,array['operationId','kind','targets','reason','requestId','approved'],array['operationId','kind','targets','reason','requestId','approved']);
  else
    perform private.inventory_keys(command,array['operationId','kind','targets','reason'],array['operationId','kind','targets','reason']);
  end if;
  targets:=private.inventory_list(command->'targets');
  if jsonb_array_length(targets)<1 or (kind in ('void.request','void.decide') and jsonb_array_length(targets)<>1) then
    raise exception 'Choose an exact bounded receipt set' using errcode='22023'; end if;
  for target in select value from jsonb_array_elements(targets) loop
    perform private.inventory_keys(target,array['saleId','token'],array['saleId','token']);
    if jsonb_typeof(target->'saleId') is distinct from 'string' or (target->>'saleId')::uuid is null or
      jsonb_typeof(target->'token') is distinct from 'string' or target->>'token' !~ '^[a-f0-9]{64}$' then
      raise exception 'Invalid receipt identity or token' using errcode='22023'; end if;
    perform public.authorize_business_action('sales.read',(target->>'saleId')::uuid);
  end loop;
  select array_agg((t->>'saleId')::uuid order by (t->>'saleId')::uuid) into ids from jsonb_array_elements(targets) t;
  if cardinality(ids)<>(select count(distinct id) from unnest(ids) id) then
    raise exception 'Duplicate receipt IDs' using errcode='22023'; end if;
  perform s.id from public.sales s where s.id=any(ids) order by s.id for update;
  happened:=clock_timestamp(); today:=(happened at time zone 'Asia/Manila')::date;
  -- Recheck Staff day scope after any lock wait (including across midnight).
  if actor.role='Staff' and exists(select 1 from public.sales s where s.id=any(ids) and (s.cashier_id<>actor.id or s.business_date<>today)) then
    raise exception 'Business access is not permitted' using errcode='42501'; end if;

  if kind='review.confirm' then
    perform private.inventory_keys(command->'review',array['date','countedCash','verifiedGCash','openingCash','additions','removals','refunds','explanation','verifiedIds'],
      array['date','countedCash','verifiedGCash','openingCash','additions','removals','refunds','explanation','verifiedIds']);
    if jsonb_typeof(command->'review'->'date') is distinct from 'string' or command->'review'->>'date' !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Invalid review date' using errcode='22023'; end if;
    review_date:=(command->'review'->>'date')::date;
    if review_date>today or exists(select 1 from public.sales s where s.id=any(ids) and
      (s.business_date<>review_date or s.status<>'Pending' or s.review_state<>'Awaiting Owner review' or s.stock_committed is distinct from true or s.usage_complete is distinct from true)) or
      exists(select 1 from jsonb_array_elements(targets) t where private.sales_workflow_token((t->>'saleId')::uuid)<>t->>'token') then
      raise exception 'Receipts changed; verify a fresh exact set' using errcode='PT409'; end if;
    perform private.inventory_list(command->'review'->'verifiedIds');
    if jsonb_array_length(command->'review'->'verifiedIds')<>cardinality(ids) or
      (select array_agg(v::uuid order by v::uuid) from jsonb_array_elements_text(command->'review'->'verifiedIds') v) is distinct from ids then
      raise exception 'Verify every included receipt exactly once' using errcode='22023'; end if;
    counted:=private.inventory_number(command->'review'->'countedCash',2); digital:=private.inventory_number(command->'review'->'verifiedGCash',2);
    opening:=private.inventory_number(command->'review'->'openingCash',2); additions:=private.inventory_number(command->'review'->'additions',2);
    removals:=private.inventory_number(command->'review'->'removals',2); refunds:=private.inventory_number(command->'review'->'refunds',2);
    verified_cash:=counted-opening-additions+removals+refunds;
    if verified_cash<0 then raise exception 'Net verified cash cannot be negative' using errcode='22023'; end if;
    if jsonb_typeof(command->'review'->'explanation') is distinct from 'string' or length(command->'review'->>'explanation')>1000 then
      raise exception 'Invalid review explanation' using errcode='22023'; end if;
    explanation:=btrim(command->'review'->>'explanation');
    if (select count(*) from public.payments where sale_id=any(ids))<>cardinality(ids) or
      exists(select 1 from public.payments p join public.sales s on s.id=p.sale_id where s.id=any(ids) and p.amount<>s.total) then
      raise exception 'Receipt payments are incomplete' using errcode='PT409'; end if;
    select coalesce(sum(p.amount) filter(where p.method='Cash'),0),coalesce(sum(p.amount) filter(where p.method='GCash'),0)
      into expected_cash,expected_gcash from public.payments p where p.sale_id=any(ids);
    outcome:=case when expected_cash=verified_cash and expected_gcash=digital then 'Matched' else 'Reviewed with explained discrepancy' end;
    if outcome<>'Matched' and explanation='' then raise exception 'Explain the discrepancy decision' using errcode='22023'; end if;
    insert into public.daily_sales_reviews(id,business_date,owner_id,owner_name,reviewed_at,expected_cash,expected_gcash,verified_cash,verified_gcash,
      counted_cash,opening_cash,additions,removals,refunds,explanation,outcome,operation_id)
    values(review_id,review_date,actor.id,actor.full_name,happened,expected_cash,expected_gcash,verified_cash,digital,counted,opening,additions,removals,refunds,explanation,outcome,operation);
    insert into public.daily_sales_review_items(review_id,sale_id,receipt_verified,verified_amount)
      select review_id,p.sale_id,true,p.amount from public.payments p where p.sale_id=any(ids);
    -- These are explicitly entered reconciliation adjustments, not automatic
    -- refunds or invented historical occurrence times. review_id links the day.
    for entry in select * from (values ('Opening',opening),('Addition',additions),('Removal',removals),('Refund',refunds)) as e(kind,amount) where amount>0 loop
      insert into public.cash_movements(kind,amount,actor_id,actor_name,actor_role,reason,occurred_at,operation_id,review_id)
      values(entry.kind,entry.amount,actor.id,actor.full_name,actor.role,'Owner-recorded review adjustment: '||coalesce(nullif(explanation,''),'Matched reconciliation'),happened,gen_random_uuid(),review_id);
    end loop;
    update public.sales s set status='Completed',review_state='Reviewed' where s.id=any(ids);
    insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,occurred_at,operation_id)
      select actor.id,actor.full_name,actor.role,'Daily sales reviewed','sale',s.id,coalesce(nullif(explanation,''),'Owner verified receipt'),
        jsonb_build_object('reviewId',review_id,'receiptVerified',true,'verifiedAmount',p.amount::text,'outcome',outcome,'stockChanged',false,'providerVerified',false),happened,operation
      from public.sales s join public.payments p on p.sale_id=s.id where s.id=any(ids);
    insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,occurred_at,operation_id)
      values(actor.id,actor.full_name,actor.role,'Daily review recorded','daily_sales_review',review_id,coalesce(nullif(explanation,''),'Matched reconciliation'),
        jsonb_build_object('orderIds',to_jsonb(ids),'expectedCash',expected_cash::text,'expectedGCash',expected_gcash::text,
          'verifiedCash',verified_cash::text,'verifiedGCash',digital::text,'outcome',outcome,'stockChanged',false),happened,operation);
    result:=jsonb_build_object('version',1,'operationId',operation,'kind',kind,'reviewId',review_id,'replayed',false,'results',
      (select jsonb_agg(jsonb_build_object('saleId',id,'outcome','reviewed') order by id) from unnest(ids) id));
  else
    reason:=private.inventory_text(command->'reason',1000);
    if kind='void.decide' then
      if (command->>'requestId')::uuid is null then raise exception 'A request is required' using errcode='22023'; end if;
      perform private.inventory_bool(command->'approved');
    end if;
    for target in select value from jsonb_array_elements(targets) order by value->>'saleId' loop
      select * into sale from public.sales where id=(target->>'saleId')::uuid;
      if private.sales_workflow_token(sale.id)<>target->>'token' or sale.status='Voided' then
        if kind='sale.void' and cardinality(ids)>1 then
          results:=results||jsonb_build_array(jsonb_build_object('saleId',sale.id,'outcome',case when sale.status='Voided' then 'ineligible' else 'stale' end)); continue;
        end if;
        raise exception 'Receipt changed; review before deciding' using errcode='PT409';
      end if;
      select * into pending from public.void_requests v where v.sale_id=sale.id and v.status='Pending' for update;
      if kind='void.request' then
        if pending.id is not null then raise exception 'A request is already pending' using errcode='PT409'; end if;
        insert into public.void_requests(sale_id,reason,requested_by,requested_name,requested_role,requested_at)
          values(sale.id,reason,actor.id,actor.full_name,actor.role,happened) returning * into request;
        insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,occurred_at,operation_id)
          values(actor.id,actor.full_name,actor.role,'Void requested','sale',sale.id,reason,jsonb_build_object('requestId',request.id,'stockChanged',false),happened,operation);
        final_status:='requested';
      else
        if kind='void.decide' and (pending.id is null or pending.id<>(command->>'requestId')::uuid) then
          raise exception 'Request changed; review before deciding' using errcode='PT409'; end if;
        if pending.id is not null then
          update public.void_requests v set status=case when kind='void.decide' and not (command->>'approved')::boolean then 'Rejected' else 'Approved' end,
            reviewed_by=actor.id,reviewed_name=actor.full_name,reviewed_role=actor.role,reviewed_at=happened,decision_reason=workflow.reason where v.id=pending.id;
          insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,occurred_at,operation_id)
            values(actor.id,actor.full_name,actor.role,case when kind='void.decide' and not (command->>'approved')::boolean then 'Void request rejected' else 'Void request approved' end,
              'sale',sale.id,reason,jsonb_build_object('requestId',pending.id,'requestedBy',pending.requested_name,'requestedRole',pending.requested_role,
                'originalReason',pending.reason,'stockChanged',false),happened,operation);
        end if;
        if kind='void.decide' and not (command->>'approved')::boolean then final_status:='rejected';
        else
          update public.sales s set status='Voided',voided_at=happened,voided_by=actor.id,voided_name=actor.full_name,voided_role=actor.role,
            void_reason=reason,bulk_action_id=case when cardinality(ids)>1 then operation end where s.id=sale.id;
          insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,occurred_at,operation_id)
            values(actor.id,actor.full_name,actor.role,'Sale voided','sale',sale.id,reason,
              jsonb_build_object('requestId',pending.id,'bulkActionId',case when cardinality(ids)>1 then operation end,'stockChanged',false,'paymentRefunded',false),happened,operation);
          final_status:='voided';
        end if;
      end if;
      results:=results||jsonb_build_array(jsonb_build_object('saleId',sale.id,'outcome',final_status));
    end loop;
    result:=jsonb_build_object('version',1,'operationId',operation,'kind',kind,'replayed',false,'results',results);
  end if;
  insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,occurred_at,operation_id)
    values(actor.id,actor.full_name,actor.role,'Sales action recorded','sales_operation',operation,
      case when kind='review.confirm' then coalesce(nullif(explanation,''),'Matched reconciliation') else reason end,
      jsonb_build_object('kind',kind,'results',result->'results','stockChanged',false,'paymentRefunded',false),happened,operation);
  insert into private.sales_workflow_operations(operation_id,actor_id,request,result) values(operation,actor.id,command,result);
  return result;
end $$;

-- Purchased configuration stays frozen; a receipt read shows today's workflow
-- state alongside its original checkout state. Command replay remains immutable.
create or replace function public.read_checkout_receipt(target_sale_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare receipt jsonb; sale public.sales;
begin
  perform public.authorize_business_action('sales.read',target_sale_id);
  select * into sale from public.sales where id=target_sale_id;
  select o.receipt into receipt from private.checkout_operations o where o.sale_id=target_sale_id;
  if receipt is null then raise exception 'No P6 receipt is available for this sale' using errcode='22023'; end if;
  return receipt||jsonb_build_object('checkoutStatus',receipt->'status','checkoutReviewState',receipt->'reviewState',
    'status',sale.status,'reviewState',sale.review_state);
end $$;

create or replace function public.business_access() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor public.profiles;
begin
  actor:=private.checkout_actor();
  return jsonb_build_object('profile',to_jsonb(actor),'businessDate',(statement_timestamp() at time zone 'Asia/Manila')::date,
    'permissions',private.business_permissions(actor.role),'services',jsonb_build_object('inventoryCrud',true,
      'checkout',(select enabled from private.checkout_state where singleton),'salesReview',true,'reports',false));
end $$;

revoke all on function private.workflow_operation_namespace(),private.sales_workflow_token(uuid),private.sales_workflow_sale(uuid,boolean)
  from public,anon,authenticated,service_role;
revoke all on function public.read_sales_workflow(integer,integer),public.sales_workflow_command(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.read_sales_workflow(integer,integer),public.sales_workflow_command(jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
