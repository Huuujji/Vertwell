-- P3 identity/account lifecycle only. Business tables remain closed.
begin;

create function private.lock_accounts() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(171026,3);
  return null;
end $$;
create trigger profiles_serialize before insert or update or delete on public.profiles
for each statement execute function private.lock_accounts();

create function private.protect_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.active and old.role = 'Owner' and
    (tg_op = 'DELETE' or not new.active or new.role <> 'Owner') and
    not exists (select 1 from public.profiles where id <> old.id and active and role = 'Owner') then
    raise exception 'The last active Owner must be retained' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger profiles_keep_owner before update or delete on public.profiles
for each row execute function private.protect_owner();

-- Only the Auth admin API can set raw_app_meta_data. User metadata is ignored.
-- Runs inside Auth's transaction: profile, Auth user and audit succeed together.
create function private.provision_auth_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  command jsonb := new.raw_app_meta_data -> 'vertwell_provision';
  actor public.profiles;
  target public.profiles;
begin
  if command is null then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(171026,3);
  if command ->> 'bootstrap' = 'true' then
    if exists (select 1 from public.profiles) or command ->> 'role' <> 'Owner' then
      raise exception 'Initial Owner already provisioned' using errcode = '42501';
    end if;
  else
    select * into actor from public.profiles where id = (command ->> 'actor_id')::uuid and active;
    if actor.id is null or actor.role = 'Staff' or
      (actor.role = 'Admin' and command ->> 'role' <> 'Staff') then
      raise exception 'Account creation is not permitted' using errcode = '42501';
    end if;
  end if;
  insert into public.profiles(id,full_name,username,role)
    values (new.id,command ->> 'full_name',command ->> 'username',command ->> 'role') returning * into target;
  if actor.id is null then actor := target; end if;
  insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,operation_id)
    values (actor.id,actor.full_name,actor.role,'Account created','profile',target.id,
      'Authorized account provisioning',jsonb_build_object('role',target.role,'bootstrap',command ->> 'bootstrap' = 'true'),gen_random_uuid());
  return new;
end $$;
create trigger vertwell_auth_profile after insert on auth.users
for each row execute function private.provision_auth_profile();

-- Service-only username lookup; no public email enumeration endpoint.
create function public.account_login_email(identifier text) returns text
language sql security definer set search_path = '' as $$
  select u.email from public.profiles p join auth.users u on u.id=p.id
  where lower(p.username)=lower(identifier) and p.active
$$;

create function public.current_profile() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare profile public.profiles;
begin
  select * into profile from public.profiles where id = auth.uid() and active;
  if profile.id is null then raise exception 'Account is inactive or has no application profile' using errcode = '42501'; end if;
  return to_jsonb(profile);
end $$;

create function public.update_account(target_id uuid, expected_updated_at timestamptz,
  full_name text, username text, account_role text, account_active boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor public.profiles; target public.profiles; saved public.profiles;
begin
  perform pg_catalog.pg_advisory_xact_lock(171026,3);
  select * into actor from public.profiles where id = auth.uid() and active;
  select * into target from public.profiles where id = target_id;
  if actor.id is null or actor.role = 'Staff' or target.id is null or
    (actor.role = 'Admin' and (target.role <> 'Staff' or account_role <> 'Staff')) then
    raise exception 'Account update is not permitted' using errcode = '42501';
  end if;
  if actor.id = target.id and not account_active then
    raise exception 'The signed-in account cannot be deactivated' using errcode = '23514';
  end if;
  if target.updated_at is distinct from expected_updated_at then
    raise exception 'Account changed; reload before saving' using errcode = '40001';
  end if;
  update public.profiles p set full_name=update_account.full_name, username=update_account.username,
    role=account_role, active=account_active where p.id=target_id returning * into saved;
  insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,operation_id)
    values (actor.id,actor.full_name,actor.role,'Account updated','profile',target.id,'Authorized account update',
      jsonb_build_object('before',to_jsonb(target),'after',to_jsonb(saved)),gen_random_uuid());
  return to_jsonb(saved);
end $$;

revoke all on all functions in schema private from public,anon,authenticated,service_role;
revoke all on function public.current_profile() from public,anon,service_role;
revoke all on function public.update_account(uuid,timestamptz,text,text,text,boolean) from public,anon,service_role;
grant execute on function public.current_profile() to authenticated;
grant execute on function public.update_account(uuid,timestamptz,text,text,text,boolean) to authenticated;
revoke all on function public.account_login_email(text) from public,anon,authenticated;
grant execute on function public.account_login_email(text) to service_role;
notify pgrst, 'reload schema';
commit;
