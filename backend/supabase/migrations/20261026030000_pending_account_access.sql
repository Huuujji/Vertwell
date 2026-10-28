-- Major Adjustment 3 only. Additive LOCAL preparation; no hosted application authorized.
begin;

-- Keep checks inside the original account locks/transactions and preserve receipts/history.
create or replace function public.update_account(target_id uuid, expected_updated_at timestamptz,
  full_name text, username text, account_role text, account_active boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor public.profiles; target public.profiles; saved public.profiles;
begin
  perform pg_catalog.pg_advisory_xact_lock(171026,3);
  select * into actor from public.profiles where id = auth.uid() and active and private.email_access_allowed(id);
  select * into target from public.profiles where id = target_id;
  if actor.id is null or actor.role = 'Staff' or target.id is null or
    (actor.role = 'Admin' and (target.role <> 'Staff' or account_role <> 'Staff')) then
    raise exception 'Account update is not permitted' using errcode = '42501';
  end if;
  if actor.id = target.id and not account_active then
    raise exception 'The signed-in account cannot be deactivated' using errcode = '23514';
  end if;
  if target.updated_at is distinct from expected_updated_at then
    raise exception 'Account changed; reload before saving' using errcode = 'PT409';
  end if;
  update public.profiles p set full_name=update_account.full_name, username=update_account.username,
    role=account_role, active=account_active where p.id=target_id returning * into saved;
  insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,operation_id)
    values (actor.id,actor.username,actor.role,'Account updated','profile',target.id,'Authorized account update',
      jsonb_build_object('before',to_jsonb(target),'after',to_jsonb(saved)),gen_random_uuid());
  return to_jsonb(saved);
end $$;

create or replace function private.provision_auth_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  command jsonb := new.raw_app_meta_data -> 'vertwell_provision';
  actor public.profiles;
  target public.profiles;
begin
  if command is null or exists (select 1 from public.profiles where id = new.id) then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(171026,3);
  if command ->> 'bootstrap' = 'true' then
    if exists (select 1 from public.profiles) or command ->> 'role' <> 'Owner' then
      raise exception 'Initial Owner already provisioned' using errcode = '42501';
    end if;
  else
    select * into actor from public.profiles where id = (command ->> 'actor_id')::uuid and active and private.email_access_allowed(id);
    if actor.id is null or actor.role = 'Staff' or
      (actor.role = 'Admin' and command ->> 'role' <> 'Staff') then
      raise exception 'Account creation is not permitted' using errcode = '42501';
    end if;
  end if;
  insert into public.profiles(id,full_name,username,role)
    values (new.id,command ->> 'full_name',command ->> 'username',command ->> 'role') returning * into target;
  if actor.id is null then actor := target; end if;
  insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,operation_id)
    values (actor.id,actor.username,actor.role,'Account created','profile',target.id,
      'Authorized account provisioning',jsonb_build_object('role',target.role,'bootstrap',command ->> 'bootstrap' = 'true'),gen_random_uuid());
  return new;
end $$;

create or replace function public.authorize_business_action(action text, target_sale_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor public.profiles; target public.sales;
  today date := (statement_timestamp() at time zone 'Asia/Manila')::date;
begin
  select * into actor from public.profiles where id = auth.uid() and active and private.email_access_allowed(id);
  if actor.id is null or not coalesce(action = any(private.business_permissions(actor.role)),false) then
    raise exception 'Business access is not permitted' using errcode = '42501';
  end if;
  if action in ('void.request','void.decide','sale.void') and target_sale_id is null then
    raise exception 'A sale is required' using errcode = '22023';
  end if;
  if target_sale_id is not null then
    if action not in ('sales.read','void.request','void.decide','sale.void') then
      raise exception 'This action does not accept a sale' using errcode = '22023';
    end if;
    select * into target from public.sales where id = target_sale_id;
    if target.id is null or (actor.role = 'Staff' and
      (target.cashier_id <> actor.id or target.business_date <> today)) then
      -- Do not reveal whether an inaccessible sale exists.
      raise exception 'Business access is not permitted' using errcode = '42501';
    end if;
    if action <> 'sales.read' and target.status = 'Voided' then
      raise exception 'Sale is already voided' using errcode = 'PT409';
    end if;
  end if;
  return jsonb_build_object('profile',to_jsonb(actor),'businessDate',today);
end $$;

create or replace function private.inventory_actor() returns public.profiles
language plpgsql stable set search_path = '' as $$
declare actor public.profiles;
begin
  select * into actor from public.profiles where id=auth.uid() and active and private.email_access_allowed(id) and role in ('Owner','Admin');
  if actor.id is null then raise exception 'Inventory access is not permitted' using errcode='42501'; end if;
  return actor;
end $$;

create or replace function private.record_account_operation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare command jsonb:=new.raw_app_meta_data->'vertwell_provision'; actor public.profiles; target public.profiles;
begin
  if command->>'operation_id' is null or exists(select 1 from private.account_operations where target_id=new.id) then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(171026,3);
  select * into actor from public.profiles where id=(command->>'actor_id')::uuid and active and private.email_access_allowed(id);
  select * into target from public.profiles where id=new.id;
  if actor.id is null or actor.role not in ('Owner','Admin') or target.id is null or
    actor.role='Admin' and target.role<>'Staff' then raise exception 'Account access is not permitted' using errcode='42501'; end if;
  insert into private.account_operations values((command->>'operation_id')::uuid,actor.id,target.id,
    jsonb_build_object('fullName',target.full_name,'username',target.username,'role',target.role,'email',new.email));
  return new;
end $$;

create or replace function public.account_provisioning_result(operation_id uuid, expected jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor public.profiles; result private.account_operations; target public.profiles;
begin
  select * into actor from public.profiles where id=auth.uid() and active and private.email_access_allowed(id) and role in ('Owner','Admin');
  if actor.id is null then raise exception 'Account access is not permitted' using errcode='42501'; end if;
  select * into result from private.account_operations o where o.operation_id=account_provisioning_result.operation_id;
  if result.operation_id is null then return null; end if;
  select * into target from public.profiles where id=result.target_id;
  if result.actor_id<>actor.id or result.details<>expected or actor.role='Admin' and target.role<>'Staff' then
    raise exception 'Account operation changed or is not permitted' using errcode='42501'; end if;
  return jsonb_build_object('id',target.id,'email',result.details->>'email','emailVerification',
    (select case when nullif(to_jsonb(u)->>'email_confirmed_at','') is not null then 'verified'
      when u.raw_app_meta_data->>'happyhentie_email_required'='true' then 'pending' else 'existing' end
      from auth.users u where u.id=target.id));
end $$;

-- Confirmation changes Auth, not profiles. Publish only invalidations; readers reload
-- trusted status through the authorized projection. to_jsonb tolerates minimal test Auth schemas.
create function private.broadcast_email_verification() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (to_jsonb(old)->>'email_confirmed_at') is distinct from (to_jsonb(new)->>'email_confirmed_at') then
    perform realtime.send('{"scopes":["accounts"]}'::jsonb,'invalidate','vertwell:managers',true);
    perform realtime.send('{"scopes":["access"],"identity":true}'::jsonb,'invalidate','vertwell:user:'||new.id::text,true);
  end if;
  return null;
end $$;
create trigger broadcast_email_verification after update on auth.users
for each row execute function private.broadcast_email_verification();
revoke all on function private.broadcast_email_verification() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
