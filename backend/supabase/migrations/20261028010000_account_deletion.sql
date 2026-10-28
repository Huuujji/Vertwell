-- Task 3 LOCAL DRAFT. Requires separate approval before official application.
-- Delete the Auth identity; retain immutable historical actors and business rows.
begin;

create table private.account_usernames (
  username text primary key,
  profile_id uuid not null unique references auth.users(id) on delete cascade
);
insert into private.account_usernames select lower(p.username),p.id
  from public.profiles p join auth.users u on u.id=p.id;
revoke all on private.account_usernames from public,anon,authenticated,service_role;

-- A live identity owns the reusable username. Historical profiles retain their
-- original spelling and UUID, and every existing business FK continues to work.
alter table public.profiles drop constraint profiles_id_fkey;
drop index public.profiles_username_ci;
create index profiles_username_history on public.profiles(lower(username));
create function private.bind_account_username() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and new.id<>old.id then
    raise exception 'An account identity cannot change' using errcode='23514';
  end if;
  if not exists(select 1 from auth.users where id=new.id) then
    if tg_op='INSERT' then raise exception 'Profile identity foreign key requires an Auth identity' using errcode='23503'; end if;
    raise exception 'Historical account evidence is immutable' using errcode='23514';
  end if;
  if tg_op='INSERT' then
    insert into private.account_usernames values(lower(new.username),new.id);
  elsif lower(new.username) is distinct from lower(old.username) then
    update private.account_usernames set username=lower(new.username) where profile_id=new.id;
    if not found then raise exception 'Live username binding is missing' using errcode='23514'; end if;
  end if;
  return new;
end $$;
create trigger profiles_live_username before insert or update on public.profiles
for each row execute function private.bind_account_username();

create function private.reject_actor_id_reuse() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.profiles where id=new.id) then
    raise exception 'A historical actor ID cannot be reused' using errcode='23514';
  end if;
  return new;
end $$;
create trigger vertwell_actor_id_guard before insert on auth.users
for each row execute function private.reject_actor_id_reuse();

create table private.account_deletions (
  operation_id uuid primary key,
  actor_id uuid not null references public.profiles(id),
  target_id uuid not null references public.profiles(id),
  expected_updated_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp()+interval '5 minutes',
  state text not null default 'ready' check(state in ('ready','superseded','completed')),
  completed_at timestamptz,
  check((state='completed')=(completed_at is not null)),
  check(actor_id<>target_id)
);
create unique index account_deletions_one_ready on private.account_deletions(target_id) where state='ready';
create index account_deletions_actor on private.account_deletions(actor_id);
create index account_deletions_target on private.account_deletions(target_id);
alter table private.account_deletions enable row level security;
revoke all on private.account_deletions from public,anon,authenticated,service_role;
create trigger account_deletions_no_delete before delete on private.account_deletions
for each row execute function private.deny_history_change();
create trigger account_deletions_no_truncate before truncate on private.account_deletions
for each statement execute function private.deny_history_change();

create function private.account_owns_storage(target uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare present boolean;
begin
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then
    raise exception 'Storage ownership verification is unavailable' using errcode='55000';
  end if;
  execute 'select exists(select 1 from storage.objects o where
    to_jsonb(o)->>''owner_id''=$1 or to_jsonb(o)->>''owner''=$1)
    or exists(select 1 from storage.buckets b where
    to_jsonb(b)->>''owner_id''=$1 or to_jsonb(b)->>''owner''=$1)' into present using target::text;
  return present;
end $$;

create function private.check_account_deletion(actor_id uuid,target_id uuid,expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare actor public.profiles; target public.profiles;
begin
  select * into actor from public.profiles p where p.id=actor_id and p.active and private.email_access_allowed(p.id);
  select * into target from public.profiles p where p.id=target_id;
  if actor.id is null or actor.role not in ('Owner','Admin') or target.id is null
    or actor.role='Admin' and target.role<>'Staff'
    or exists(select 1 from private.retired_accounts where profile_id=target_id) then
    raise exception 'Account deletion is not permitted' using errcode='42501';
  end if;
  if actor.id=target.id then raise exception 'You cannot delete your signed-in account' using errcode='23514'; end if;
  if not exists(select 1 from auth.users where id=target.id)
    or target.updated_at is distinct from expected_updated_at then
    raise exception 'Account changed; reload and review before deleting' using errcode='PT409';
  end if;
  if target.active and target.role='Owner' and private.email_access_allowed(target.id)
    and not exists(select 1 from public.profiles p where p.id<>target.id and p.active
      and p.role='Owner' and private.email_access_allowed(p.id)) then
    raise exception 'The last accessible Owner must be retained' using errcode='23514';
  end if;
  if private.account_owns_storage(target.id) then
    raise exception 'This account owns stored files; review ownership before deletion' using errcode='PT412';
  end if;
  if exists(select 1 from private.email_challenges where user_id=target.id and processing) then
    raise exception 'Account email completion is in progress; finish its recovery observations first' using errcode='PT409';
  end if;
end $$;

create function public.account_deletion_result(target_id uuid,expected_updated_at timestamptz,operation_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor public.profiles; target public.profiles; receipt private.account_deletions;
begin
  select * into actor from public.profiles p where p.id=auth.uid() and p.active and private.email_access_allowed(p.id);
  select * into target from public.profiles where id=target_id;
  if actor.id is null or actor.role not in ('Owner','Admin') or target.id is null
    or actor.role='Admin' and target.role<>'Staff' then
    raise exception 'Account deletion is not permitted' using errcode='42501';
  end if;
  select * into receipt from private.account_deletions d where d.operation_id=account_deletion_result.operation_id;
  if receipt.operation_id is null then return null; end if;
  if receipt.actor_id<>actor.id or receipt.target_id<>target_id
    or receipt.expected_updated_at is distinct from expected_updated_at then
    raise exception 'Deletion request changed; do not replay it for another account' using errcode='PT409';
  end if;
  if (receipt.state='completed')=exists(select 1 from auth.users where id=target_id) then
    raise exception 'Deletion outcome is inconsistent; operator review required' using errcode='55000';
  end if;
  return jsonb_build_object('operationId',receipt.operation_id,'targetId',receipt.target_id,
    'status',case when receipt.state='ready' and
      (receipt.expires_at<=clock_timestamp() or target.updated_at is distinct from expected_updated_at)
      then 'stale' else receipt.state end);
end $$;

create function public.prepare_account_deletion(target_id uuid,expected_updated_at timestamptz,operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(171026,3);
  perform pg_catalog.pg_advisory_xact_lock(171026,8);
  if operation_id is null or expected_updated_at is null then
    raise exception 'An exact deletion request is required' using errcode='22023';
  end if;
  saved:=public.account_deletion_result(target_id,expected_updated_at,operation_id);
  if saved is not null then return saved; end if;
  perform private.check_account_deletion(auth.uid(),target_id,expected_updated_at);
  -- A fresh explicit confirmation supersedes an earlier uncompleted request.
  update private.account_deletions d set state='superseded' where d.target_id=prepare_account_deletion.target_id and state='ready';
  insert into private.account_deletions(operation_id,actor_id,target_id,expected_updated_at)
    values(operation_id,auth.uid(),target_id,expected_updated_at);
  return public.account_deletion_result(target_id,expected_updated_at,operation_id);
end $$;

-- This hook runs IN the provider's hard-delete transaction. A failure anywhere,
-- including native session cleanup, rolls back Auth, challenges, audit and receipt.
-- It never deletes profiles, business records, images or provisioning evidence.
create function private.commit_account_deletion() returns trigger
language plpgsql security definer set search_path='' as $$
declare target public.profiles; actor public.profiles; receipt private.account_deletions;
begin
  perform pg_catalog.pg_advisory_xact_lock(171026,3);
  perform pg_catalog.pg_advisory_xact_lock(171026,8);
  select * into target from public.profiles where id=old.id;
  if target.id is null then return old; end if;
  select * into receipt from private.account_deletions where target_id=old.id and state='ready' for update;
  if receipt.operation_id is null or receipt.expires_at<=clock_timestamp() then
    raise exception 'A current authorized deletion request is required' using errcode='42501';
  end if;
  perform private.check_account_deletion(receipt.actor_id,target.id,receipt.expected_updated_at);
  select * into actor from public.profiles where id=receipt.actor_id;
  delete from private.email_challenges where user_id=target.id;
  insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,operation_id)
    values(actor.id,actor.username,actor.role,'Account deleted','profile',target.id,'Authorized permanent account deletion',
      jsonb_build_object('historicalProfile',to_jsonb(target),'authenticationDeleted',true),receipt.operation_id);
  update private.account_deletions set state='completed',completed_at=clock_timestamp() where operation_id=receipt.operation_id;
  perform realtime.send('{"scopes":["accounts"]}'::jsonb,'invalidate','vertwell:managers',true);
  perform realtime.send('{"scopes":["access"],"identity":true}'::jsonb,'invalidate','vertwell:user:'||target.id::text,true);
  return old;
end $$;
create trigger vertwell_account_deletion before delete on auth.users
for each row execute function private.commit_account_deletion();

-- Remove manual access-state changes from the database contract, including the
-- previous callable signature. Preserve the existing state on ordinary edits.
create or replace function public.update_account(target_id uuid, expected_updated_at timestamptz,
  full_name text, username text, account_role text, account_active boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor public.profiles; target public.profiles; saved public.profiles;
begin
  perform pg_catalog.pg_advisory_xact_lock(171026,3);
  select * into actor from public.profiles where id=auth.uid() and active and private.email_access_allowed(id);
  select * into target from public.profiles where id=target_id;
  if actor.id is null or actor.role='Staff' or target.id is null
    or not exists(select 1 from auth.users where id=target.id)
    or actor.role='Admin' and (target.role<>'Staff' or account_role<>'Staff') then
    raise exception 'Account update is not permitted' using errcode='42501';
  end if;
  if account_active is distinct from target.active then
    raise exception 'Account access state is managed internally' using errcode='23514';
  end if;
  if target.updated_at is distinct from expected_updated_at then
    raise exception 'Account changed; reload before saving' using errcode='PT409';
  end if;
  update public.profiles p set full_name=update_account.full_name,username=update_account.username,
    role=account_role where p.id=target_id returning * into saved;
  insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,details,operation_id)
    values(actor.id,actor.username,actor.role,'Account updated','profile',target.id,'Authorized account update',
      jsonb_build_object('before',to_jsonb(target),'after',to_jsonb(saved)),gen_random_uuid());
  return to_jsonb(saved);
end $$;

create function public.update_account(target_id uuid,expected_updated_at timestamptz,
  full_name text,username text,account_role text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_active boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(171026,3);
  select active into current_active from public.profiles where id=target_id;
  return public.update_account(target_id,expected_updated_at,full_name,username,account_role,current_active);
end $$;
revoke all on function public.update_account(uuid,timestamptz,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.update_account(uuid,timestamptz,text,text,text) to authenticated;

-- A replay of old provisioning cannot claim an account that has been deleted.
create or replace function public.account_provisioning_result(operation_id uuid,expected jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor public.profiles; result private.account_operations; target public.profiles;
begin
  select * into actor from public.profiles where id=auth.uid() and active and private.email_access_allowed(id) and role in ('Owner','Admin');
  if actor.id is null then raise exception 'Account access is not permitted' using errcode='42501'; end if;
  select * into result from private.account_operations o where o.operation_id=account_provisioning_result.operation_id;
  if result.operation_id is null then return null; end if;
  select * into target from public.profiles where id=result.target_id;
  if result.actor_id<>actor.id or result.details<>expected or actor.role='Admin' and target.role<>'Staff' then
    raise exception 'Account operation changed or is not permitted' using errcode='42501';
  end if;
  if not exists(select 1 from auth.users where id=target.id) then
    raise exception 'The original account was deleted; start a new creation request' using errcode='PT410';
  end if;
  return jsonb_build_object('id',target.id,'email',result.details->>'email','emailVerification',
    (select case when nullif(to_jsonb(u)->>'email_confirmed_at','') is not null then 'verified'
      when u.raw_app_meta_data->>'happyhentie_email_required'='true' then 'pending' else 'existing' end
      from auth.users u where u.id=target.id));
end $$;

revoke all on function private.bind_account_username(),private.reject_actor_id_reuse(),
  private.account_owns_storage(uuid),private.check_account_deletion(uuid,uuid,timestamptz),private.commit_account_deletion()
  from public,anon,authenticated,service_role;
revoke all on function public.prepare_account_deletion(uuid,timestamptz,uuid),public.account_deletion_result(uuid,timestamptz,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.prepare_account_deletion(uuid,timestamptz,uuid),public.account_deletion_result(uuid,timestamptz,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
