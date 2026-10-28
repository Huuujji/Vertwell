-- Additive preparation only. Apply to the official project only after review/approval.
begin;
create table private.email_challenges (
  user_id uuid not null references auth.users(id), purpose text not null check(purpose in ('verification','recovery')),
  ticket uuid not null, digest text, reserved_at timestamptz not null, next_send_at timestamptz not null,
  expires_at timestamptz not null, attempts integer not null default 0, used_at timestamptz,
  primary key(user_id,purpose)
);
alter table private.email_challenges enable row level security;
revoke all on private.email_challenges from public,anon,authenticated,service_role;

-- Native Auth remains the ownership authority. Only newly provisioned targets
-- carry this marker; no existing account is silently made pending.
create function private.email_access_allowed(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((u.raw_app_meta_data->>'happyhentie_email_required') is distinct from 'true'
    or nullif(to_jsonb(u)->>'email_confirmed_at','') is not null,false) from auth.users u where u.id=target
$$;
create or replace function private.business_role() returns text
language sql stable security definer set search_path='' as $$
  select role from public.profiles where id=auth.uid() and active and private.email_access_allowed(id)
$$;
create or replace function public.current_profile() returns jsonb
language plpgsql security definer set search_path='' as $$
declare profile public.profiles;
begin
  select * into profile from public.profiles where id=auth.uid() and active and private.email_access_allowed(id);
  if profile.id is null then raise exception 'Account is inactive, has no application profile or email verification pending' using errcode='42501'; end if;
  return to_jsonb(profile);
end $$;
create or replace function private.protect_owner() returns trigger language plpgsql set search_path='' as $$
begin
  if old.active and old.role='Owner' and (tg_op='DELETE' or not new.active or new.role<>'Owner') and
    not exists(select 1 from public.profiles p where p.id<>old.id and p.active and p.role='Owner' and private.email_access_allowed(p.id)) then
    raise exception 'The last active Owner with account access must be retained' using errcode='23514'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create or replace function private.checkout_actor() returns public.profiles
language plpgsql stable set search_path='' as $$
declare actor public.profiles;
begin
  select * into actor from public.profiles where id=auth.uid() and active and private.email_access_allowed(id);
  if actor.id is null then raise exception 'Account access is not permitted' using errcode='42501'; end if;
  return actor;
end $$;

alter function public.read_managed_accounts() set schema private;
alter function private.read_managed_accounts() rename to read_managed_accounts_previous;
revoke all on function private.read_managed_accounts_previous() from public,anon,authenticated,service_role;
create function public.read_managed_accounts() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform public.current_profile();
  select coalesce(jsonb_agg(p||jsonb_build_object('emailVerification',case when nullif(to_jsonb(u)->>'email_confirmed_at','') is not null then 'verified'
    when u.raw_app_meta_data->>'happyhentie_email_required'='true' then 'pending' else 'existing' end) order by p->>'created_at' desc,p->>'id' desc),'[]') into result
    from jsonb_array_elements(private.read_managed_accounts_previous()) p join auth.users u on u.id=(p->>'id')::uuid;
  return result;
end $$;
revoke all on function public.read_managed_accounts() from public,anon,authenticated,service_role;
grant execute on function public.read_managed_accounts() to authenticated;

-- Service-only challenge coordination. No OTP/session/password is stored here.
-- The digest is SHA256 of the native token hash, never the usable native hash.
create function public.email_challenge(command jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
<<challenge_scope>>
declare target uuid; purpose text:=command->>'purpose'; action text:=command->>'action';
  observed timestamptz:=clock_timestamp(); state private.email_challenges; native jsonb; hash text; sent timestamptz;
begin
  if purpose not in ('verification','recovery') or purpose is null then raise exception 'Invalid purpose' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(171026,8);
  if action='consume' and command ? 'tokenHash' then
    select * into state from private.email_challenges c where c.purpose=challenge_scope.purpose
      and c.digest=encode(sha256(convert_to(command->>'tokenHash','UTF8')),'hex');
    target:=state.user_id;
  else
    select u.id into target from auth.users u join public.profiles p on p.id=u.id and p.active
      where lower(u.email)=lower(btrim(command->>'email'));
    select * into state from private.email_challenges c where c.user_id=target and c.purpose=challenge_scope.purpose;
  end if;
  select to_jsonb(u) into native from auth.users u where u.id=target;
  if target is null then return jsonb_build_object('allowed',false); end if;
  if action='reserve' then
    if (purpose='verification' and nullif(native->>'email_confirmed_at','') is not null)
      or (purpose='recovery' and nullif(native->>'email_confirmed_at','') is null)
      or state.next_send_at>observed then return jsonb_build_object('allowed',false); end if;
    insert into private.email_challenges as c(user_id,purpose,ticket,reserved_at,next_send_at,expires_at)
      values(target,purpose,(command->>'ticket')::uuid,observed,observed+interval '60 seconds',observed+interval '15 minutes')
      on conflict on constraint email_challenges_pkey do update set ticket=excluded.ticket,digest=null,reserved_at=excluded.reserved_at,
        next_send_at=excluded.next_send_at,expires_at=excluded.expires_at,attempts=0,used_at=null;
    return jsonb_build_object('allowed',true);
  elsif action='activate' then
    if state.ticket is distinct from (command->>'ticket')::uuid then return jsonb_build_object('allowed',false); end if;
    hash:=native->>case when purpose='verification' then 'confirmation_token' else 'recovery_token' end;
    sent:=nullif(native->>case when purpose='verification' then 'confirmation_sent_at' else 'recovery_sent_at' end,'')::timestamptz;
    if hash is null or hash='' or sent is null or sent<state.reserved_at-interval '2 seconds' then return jsonb_build_object('allowed',false); end if;
    update private.email_challenges c set digest=encode(sha256(convert_to(regexp_replace(hash,'^pkce_',''),'UTF8')),'hex'),
      expires_at=least(state.expires_at,sent+interval '15 minutes') where c.user_id=target and c.purpose=challenge_scope.purpose;
    return jsonb_build_object('allowed',true);
  elsif action='consume' then
    if state.user_id is null or state.used_at is not null or state.digest is null or state.expires_at<=observed or state.attempts>=5
      then return jsonb_build_object('allowed',false); end if;
    hash:=coalesce(command->>'tokenHash',encode(sha224(convert_to(lower(native->>'email')||(command->>'code'),'UTF8')),'hex'));
    update private.email_challenges c set attempts=c.attempts+1,
      used_at=case when c.digest=encode(sha256(convert_to(hash,'UTF8')),'hex') then observed else null end
      where c.user_id=target and c.purpose=challenge_scope.purpose;
    if state.digest<>encode(sha256(convert_to(hash,'UTF8')),'hex') then return jsonb_build_object('allowed',false); end if;
    return jsonb_build_object('allowed',true,'userId',target,'tokenHash',hash);
  end if;
  raise exception 'Invalid challenge action' using errcode='22023';
end $$;
revoke all on function private.email_access_allowed(uuid),public.email_challenge(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.email_challenge(jsonb) to service_role;
notify pgrst,'reload schema';
commit;
