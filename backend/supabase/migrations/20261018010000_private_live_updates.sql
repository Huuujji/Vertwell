-- P8A: private, receive-only invalidations; business rows stay behind existing APIs.
begin;

create policy vertwell_receive_updates on realtime.messages for select to authenticated
using (extension = 'broadcast' and topic = realtime.topic() and (
  (realtime.topic() = 'vertwell:managers' and private.business_role() in ('Owner','Admin'))
  or (realtime.topic() = 'vertwell:catalogue' and private.business_role() is not null)
  or (realtime.topic() = 'vertwell:user:' || (select auth.uid())::text and private.business_role() is not null)
));
-- No INSERT policy: clients cannot publish invalidations or impersonate a change.

create function private.broadcast_inventory_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send('{"scopes":["inventory","reports"]}'::jsonb,'invalidate','vertwell:managers',true);
  perform realtime.send('{"scopes":["catalogue"]}'::jsonb,'invalidate','vertwell:catalogue',true);
  return null;
end $$;
create trigger broadcast_inventory_change after update on private.inventory_state
for each statement execute function private.broadcast_inventory_change();

create function private.broadcast_account_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send('{"scopes":["accounts"]}'::jsonb,'invalidate','vertwell:managers',true);
  perform realtime.send('{"scopes":["access"],"identity":true}'::jsonb,'invalidate','vertwell:user:' || new.id::text,true);
  return null;
end $$;
create trigger broadcast_account_change after insert or update on public.profiles
for each row execute function private.broadcast_account_change();

create function private.broadcast_sales_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare record jsonb := to_jsonb(new); sale uuid; cashier uuid;
begin
  sale := case when tg_table_name = 'sales' then (record->>'id')::uuid
    when tg_table_name = 'audit_events' and record->>'entity_type' = 'sale' then (record->>'entity_id')::uuid
    else (record->>'sale_id')::uuid end;
  perform realtime.send('{"scopes":["sales","reports"]}'::jsonb,'invalidate','vertwell:managers',true);
  if sale is not null then
    select cashier_id into cashier from public.sales where id = sale;
    if cashier is not null then
      perform realtime.send('{"scopes":["sales"]}'::jsonb,'invalidate','vertwell:user:' || cashier::text,true);
    end if;
  end if;
  return null;
end $$;
create trigger broadcast_sales_change after insert or update on public.sales
for each row execute function private.broadcast_sales_change();
create trigger broadcast_request_change after insert or update on public.void_requests
for each row execute function private.broadcast_sales_change();
create trigger broadcast_review_change after insert on public.daily_sales_review_items
for each row execute function private.broadcast_sales_change();
create trigger broadcast_payment_change after insert or update on public.payments
for each row execute function private.broadcast_sales_change();
create trigger broadcast_audit_change after insert on public.audit_events
for each row execute function private.broadcast_sales_change();

create function private.broadcast_access_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send('{"scopes":["access"]}'::jsonb,'invalidate','vertwell:catalogue',true);
  return null;
end $$;
create trigger broadcast_access_change after update on private.checkout_state
for each statement execute function private.broadcast_access_change();

create function private.broadcast_settings_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send('{"scopes":["accounts"]}'::jsonb,'invalidate','vertwell:managers',true);
  return null;
end $$;
create trigger broadcast_settings_change after insert or update on public.alert_settings
for each statement execute function private.broadcast_settings_change();

revoke all on function private.broadcast_inventory_change(), private.broadcast_account_change(),
  private.broadcast_sales_change(), private.broadcast_access_change(), private.broadcast_settings_change() from public,anon,authenticated,service_role;
commit;
