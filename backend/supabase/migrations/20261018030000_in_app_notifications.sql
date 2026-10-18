-- P9: durable management notifications. No external delivery or business mutations.
begin;

create table private.review_notifications (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  kind text not null check (kind in ('Void requests','Duplicate activity')),
  order_ids uuid[] not null check (cardinality(order_ids)>0),
  evidence jsonb not null check (jsonb_typeof(evidence)='object'),
  revision bigint not null default 1 check (revision>0),
  changed_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz,
  resolution text
);
create index review_notifications_open on private.review_notifications(changed_at,id) where resolved_at is null;
create index review_notifications_orders on private.review_notifications using gin(order_ids);
create table private.notification_versions (
  notification_id uuid not null references private.review_notifications(id),
  revision bigint not null,
  evidence jsonb not null,
  order_ids uuid[] not null,
  recorded_at timestamptz not null,
  resolved_at timestamptz,
  resolution text,
  primary key(notification_id,revision)
);
create table private.notification_reads (
  profile_id uuid not null references public.profiles(id),
  notification_id uuid not null references private.review_notifications(id),
  revision bigint not null,
  is_read boolean not null,
  changed_at timestamptz not null default clock_timestamp(),
  primary key(profile_id,notification_id)
);
create index notification_reads_notification on private.notification_reads(notification_id);
alter table private.review_notifications enable row level security;
alter table private.notification_versions enable row level security;
alter table private.notification_reads enable row level security;
revoke all on private.review_notifications,private.notification_versions,private.notification_reads from public,anon,authenticated,service_role;

create function private.notification_revision() returns trigger
language plpgsql set search_path='' as $$
begin
  new.revision:=old.revision+1;
  new.changed_at:=clock_timestamp();
  return new;
end $$;
create trigger notification_revision before update on private.review_notifications
for each row execute function private.notification_revision();
create function private.notification_changed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into private.notification_versions values(new.id,new.revision,new.evidence,new.order_ids,new.changed_at,new.resolved_at,new.resolution);
  perform realtime.send('{"scopes":["notifications"]}'::jsonb,'invalidate','vertwell:managers',true);
  return null;
end $$;
create trigger notification_changed after insert or update on private.review_notifications
for each row execute function private.notification_changed();
create trigger immutable_history before update or delete on private.notification_versions
for each row execute function private.deny_history_change();

create function private.save_duplicate_notification(ids uuid[], threshold integer, minutes integer, basket jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare saved private.review_notifications; proof jsonb; actor public.sales;
begin
  select * into actor from public.sales where id=ids[1];
  select jsonb_build_object('actorId',actor.cashier_id,'actor',actor.cashier_name,'role',actor.cashier_role,
    'time',max(s.occurred_at),'startTime',min(s.occurred_at),'threshold',threshold,'minutes',minutes,
    'basket',basket,'orders',jsonb_agg(jsonb_build_object('id',s.id,'number',s.order_number,'time',s.occurred_at,
      'actor',s.cashier_name,'role',s.cashier_role,'total',s.total::text) order by s.occurred_at,s.id))
    into proof from public.sales s where s.id=any(ids);
  select * into saved from private.review_notifications where kind='Duplicate activity' and order_ids && ids
    order by changed_at,id limit 1 for update;
  if saved.id is null then
    insert into private.review_notifications(source_key,kind,order_ids,evidence)
      values('duplicate:'||gen_random_uuid()::text,'Duplicate activity',ids,proof) returning * into saved;
  elsif saved.evidence is distinct from proof or saved.order_ids is distinct from ids or saved.resolved_at is not null then
    update private.review_notifications set order_ids=ids,evidence=proof,resolved_at=null,resolution=null where id=saved.id returning * into saved;
  end if;
  return saved.id;
end $$;

-- Same sliding-window/overlap grouping as the established frontend, using exact
-- purchased snapshots, canonical JSONB and sorted basket lines/modifiers.
create function private.refresh_duplicate_notifications(target_actor uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare threshold integer; minutes integer; receipt record; basket jsonb;
  ids uuid[]:='{}'; times timestamptz[]:='{}'; active uuid[]:='{}'; seen uuid[]:='{}'; order_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(171026,6);
  select similar_order_threshold,window_minutes into threshold,minutes from public.alert_settings where singleton;
  threshold:=coalesce(threshold,5);minutes:=coalesce(minutes,2);
  for receipt in
    select * from (select s.id,s.occurred_at,jsonb_build_array(s.cashier_id,p.method,s.total,
      (select jsonb_agg(line order by line::text) from (
        select jsonb_build_array(i.name,i.category,i.quantity,i.unit_price,i.product_id,i.variant_id,i.sku,i.configuration_snapshot,
          (select coalesce(jsonb_agg(jsonb_build_array(m.option_id,m.name,m.price) order by m.option_id,m.name,m.price),'[]')
            from public.sale_item_modifiers m where m.sale_item_id=i.id)) as line
        from public.sale_items i where i.sale_id=s.id) lines)) as signature
    from public.sales s join public.payments p on p.sale_id=s.id
    where s.status<>'Voided' and (target_actor is null or s.cashier_id=target_actor)
      and exists(select 1 from public.sale_items i where i.sale_id=s.id)) candidates
    order by signature::text,occurred_at,id
  loop
    if basket is distinct from receipt.signature then
      if cardinality(active)>0 then seen:=array_append(seen,private.save_duplicate_notification(active,threshold,minutes,basket)); end if;
      basket:=receipt.signature;ids:='{}';times:='{}';active:='{}';
    end if;
    ids:=array_append(ids,receipt.id);times:=array_append(times,receipt.occurred_at);
    while times[1]<receipt.occurred_at-make_interval(mins=>minutes) loop
      ids:=ids[2:cardinality(ids)];times:=times[2:cardinality(times)];
    end loop;
    if cardinality(ids)>=threshold then
      if cardinality(active)>0 and not(active && ids) then
        seen:=array_append(seen,private.save_duplicate_notification(active,threshold,minutes,basket));active:='{}';
      end if;
      foreach order_id in array ids loop
        if not(order_id=any(active)) then active:=array_append(active,order_id);end if;
      end loop;
    end if;
  end loop;
  if cardinality(active)>0 then seen:=array_append(seen,private.save_duplicate_notification(active,threshold,minutes,basket));end if;
  update private.review_notifications n set resolved_at=clock_timestamp(),resolution='No longer matches current receipts or detection settings'
    where kind='Duplicate activity' and resolved_at is null and not(n.id=any(seen))
      and (target_actor is null or n.evidence->>'actorId'=target_actor::text);
end $$;

create function private.refresh_void_notification(request public.void_requests) returns void
language plpgsql security definer set search_path='' as $$
declare proof jsonb; closed timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(171026,6);
  select jsonb_build_object('actorId',request.requested_by,'actor',request.requested_name,'role',request.requested_role,
    'time',request.requested_at,'reason',request.reason,'requestId',request.id,
    'orders',jsonb_build_array(jsonb_build_object('id',s.id,'number',s.order_number))) into proof from public.sales s where s.id=request.sale_id;
  closed:=case when request.status<>'Pending' then request.reviewed_at
    when exists(select 1 from public.sales where id=request.sale_id and status='Voided') then clock_timestamp() end;
  insert into private.review_notifications(source_key,kind,order_ids,evidence,resolved_at,resolution)
    values('void:'||request.id::text,'Void requests',array[request.sale_id],proof,closed,case when closed is not null then request.status end)
    on conflict(source_key) do update set resolved_at=excluded.resolved_at,resolution=excluded.resolution
      where private.review_notifications.resolved_at is distinct from excluded.resolved_at
        or private.review_notifications.resolution is distinct from excluded.resolution;
end $$;
create function private.notify_void_request() returns trigger
language plpgsql security definer set search_path='' as $$
begin perform private.refresh_void_notification(new);return null;end $$;
create trigger notify_void_request after insert or update on public.void_requests
for each row execute function private.notify_void_request();
create function private.notify_sale_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare request public.void_requests;
begin
  if new.entity_type='sale' and new.event_type in ('Checkout recorded','Sale voided') then
    perform private.refresh_duplicate_notifications((select cashier_id from public.sales where id=new.entity_id));
    for request in select * from public.void_requests where sale_id=new.entity_id loop
      perform private.refresh_void_notification(request);
    end loop;
  end if;
  return null;
end $$;
create trigger notify_sale_event after insert on public.audit_events
for each row execute function private.notify_sale_event();
create function private.notify_detection_settings() returns trigger
language plpgsql security definer set search_path='' as $$
begin perform private.refresh_duplicate_notifications();return null;end $$;
create trigger notify_detection_settings after insert or update on public.alert_settings
for each statement execute function private.notify_detection_settings();

create function public.read_notifications(page_offset integer default 0,page_size integer default 50) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; total integer; unread integer; snapshot text;
begin
  perform public.authorize_business_action('dashboard.read');
  if page_offset is null or page_offset<0 or page_offset>1000000 or page_size is null or page_size<1 or page_size>100 then
    raise exception 'Invalid pagination' using errcode='22023';end if;
  select count(*)::integer,count(*) filter(where not coalesce(r.is_read and r.revision=n.revision,false))::integer,
    md5(coalesce(jsonb_agg(jsonb_build_array(n.id,n.revision,coalesce(r.is_read and r.revision=n.revision,false)) order by n.id)::text,'[]'))
    into total,unread,snapshot
    from private.review_notifications n left join private.notification_reads r on r.notification_id=n.id and r.profile_id=auth.uid()
    where n.resolved_at is null;
  select coalesce(jsonb_agg(item order by changed_at desc,id),'[]') into result from (
    select n.id,n.changed_at,jsonb_build_object('id',n.id,'kind',n.kind,'revision',n.revision::text,'evidence',n.evidence,
      'orderIds',n.order_ids,'read',coalesce(r.is_read and r.revision=n.revision,false)) as item
    from private.review_notifications n left join private.notification_reads r on r.notification_id=n.id and r.profile_id=auth.uid()
    where n.resolved_at is null order by n.changed_at desc,n.id offset page_offset limit page_size) rows;
  return jsonb_build_object('version',1,'items',result,'total',total,'unread',unread,'snapshot',snapshot,'hasMore',page_offset+page_size<total);
end $$;
create function public.set_notification_read(notification_id uuid,expected_revision text,is_read boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved private.review_notifications;
begin
  perform pg_catalog.pg_advisory_xact_lock(171026,3);
  perform public.authorize_business_action('dashboard.read');
  if expected_revision is null or expected_revision!~'^[1-9][0-9]{0,18}$' or is_read is null then
    raise exception 'Invalid notification state' using errcode='22023';end if;
  select * into saved from private.review_notifications where id=notification_id for update;
  if saved.id is null or saved.resolved_at is not null or saved.revision::text<>expected_revision then
    raise exception 'Notification changed; review its current evidence' using errcode='PT409';end if;
  insert into private.notification_reads(profile_id,notification_id,revision,is_read) values(auth.uid(),saved.id,saved.revision,set_notification_read.is_read)
    on conflict on constraint notification_reads_pkey do update set revision=excluded.revision,is_read=excluded.is_read,changed_at=clock_timestamp();
  perform realtime.send('{"scopes":["notifications"]}'::jsonb,'invalidate','vertwell:user:'||auth.uid()::text,true);
  return jsonb_build_object('id',saved.id,'revision',saved.revision::text,'read',is_read);
end $$;

-- Backfill evidence from saved receipts only. Existing business data is untouched.
do $$ declare request public.void_requests;begin
  for request in select * from public.void_requests where status='Pending' loop perform private.refresh_void_notification(request);end loop;
  perform private.refresh_duplicate_notifications();
end $$;
revoke all on function private.notification_revision(),private.notification_changed(),
  private.save_duplicate_notification(uuid[],integer,integer,jsonb),private.refresh_duplicate_notifications(uuid),
  private.refresh_void_notification(public.void_requests),private.notify_void_request(),private.notify_sale_event(),private.notify_detection_settings()
  from public,anon,authenticated,service_role;
revoke all on function public.read_notifications(integer,integer),public.set_notification_read(uuid,text,boolean) from public,anon,service_role;
grant execute on function public.read_notifications(integer,integer),public.set_notification_read(uuid,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
