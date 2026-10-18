-- Remove retired development identities from account management without
-- deleting their Auth/profile foreign keys or rewriting attributed history.
begin;

create table private.retired_accounts (
  profile_id uuid primary key references public.profiles(id),
  retired_at timestamptz not null default now(),
  retired_by text not null default session_user,
  reason text not null check (length(btrim(reason)) between 1 and 500)
);
revoke all on private.retired_accounts from public,anon,authenticated,service_role;

create trigger retired_accounts_serialize before insert on private.retired_accounts
for each statement execute function private.lock_accounts();
create trigger retired_accounts_immutable before update or delete on private.retired_accounts
for each row execute function private.deny_history_change();

create function private.check_account_retirement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id=new.profile_id and not active) then
    raise exception 'Only inactive accounts can be retired' using errcode='23514';
  end if;
  return new;
end $$;
create trigger retired_accounts_check before insert on private.retired_accounts
for each row execute function private.check_account_retirement();

create function private.protect_retired_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from private.retired_accounts where profile_id=old.id) then
    raise exception 'Retired account history must be retained' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger profiles_retirement_guard before update or delete on public.profiles
for each row execute function private.protect_retired_account();

create or replace function public.read_managed_accounts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor public.profiles; result jsonb;
begin
  select * into actor from public.profiles where id=auth.uid() and active;
  if actor.id is null or actor.role not in ('Owner','Admin') then
    raise exception 'Account access is not permitted' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('email',coalesce(u.email,'')) order by lower(p.full_name),p.id),'[]') into result
  from public.profiles p join auth.users u on u.id=p.id
  where (actor.role='Owner' or p.role='Staff' or p.id=actor.id)
    and not exists (select 1 from private.retired_accounts r where r.profile_id=p.id);
  return result;
end $$;

revoke all on function private.check_account_retirement(),private.protect_retired_account()
from public,anon,authenticated,service_role;
notify pgrst, 'reload schema';
commit;
