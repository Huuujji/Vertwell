-- Preserve the active identity/read markers when previously separate bursts merge.
-- Migration sixteen is already applied and remains immutable.
begin;
create or replace function private.save_duplicate_notification(ids uuid[], threshold integer, minutes integer, basket jsonb) returns uuid
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
    order by (resolved_at is not null),changed_at,id limit 1 for update;
  if saved.id is null then
    insert into private.review_notifications(source_key,kind,order_ids,evidence)
      values('duplicate:'||gen_random_uuid()::text,'Duplicate activity',ids,proof) returning * into saved;
  elsif saved.evidence is distinct from proof or saved.order_ids is distinct from ids or saved.resolved_at is not null then
    update private.review_notifications set order_ids=ids,evidence=proof,resolved_at=null,resolution=null where id=saved.id returning * into saved;
  end if;
  return saved.id;
end $$;
revoke all on function private.save_duplicate_notification(uuid[],integer,integer,jsonb) from public,anon,authenticated,service_role;
commit;
