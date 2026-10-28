-- LOCAL, UNAPPLIED. Exact generateLink binding; no applied migration is edited.
begin;
alter table private.email_challenges add column processing boolean not null default false;
alter table private.email_challenges add column outcome text check(outcome in ('completed','failed','uncertain'));
-- Older draft sends have no exact issuance binding. Invalidate, never adopt them.
update private.email_challenges set digest=null;

create or replace function public.email_challenge(command jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
<<challenge_scope>>
declare target uuid; purpose text:=command->>'purpose'; action text:=command->>'action';
  observed timestamptz; state private.email_challenges; native jsonb; hash text;
begin
  if purpose is null or purpose not in ('verification','recovery') then raise exception 'Invalid purpose' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(171026,8);
  observed:=clock_timestamp(); -- Evaluate expiry AFTER waiting for concurrent work.
  if action='consume' and command ? 'tokenHash' then
    select * into state from private.email_challenges c where c.purpose=challenge_scope.purpose
      and c.ticket::text=command->>'ticket';
    target:=state.user_id;
  else
    select u.id into target from auth.users u join public.profiles p on p.id=u.id and p.active
      where lower(u.email)=lower(btrim(command->>'email'));
    select * into state from private.email_challenges c where c.user_id=target and c.purpose=challenge_scope.purpose;
  end if;
  select to_jsonb(u) into native from auth.users u join public.profiles p on p.id=u.id and p.active where u.id=target;
  if target is null or native is null then return jsonb_build_object('allowed',false,'reason','invalid'); end if;
  if action='reserve' then
    if state.processing then return jsonb_build_object('allowed',false,'reason','processing'); end if;
    if (purpose='verification' and nullif(native->>'email_confirmed_at','') is not null)
      or (purpose='recovery' and nullif(native->>'email_confirmed_at','') is null)
      or state.next_send_at>observed then return jsonb_build_object('allowed',false); end if;
    insert into private.email_challenges as c(user_id,purpose,ticket,reserved_at,next_send_at,expires_at)
      values(target,purpose,(command->>'ticket')::uuid,observed,observed+interval '60 seconds',observed+interval '15 minutes')
      on conflict on constraint email_challenges_pkey do update set ticket=excluded.ticket,digest=null,reserved_at=excluded.reserved_at,
        next_send_at=excluded.next_send_at,expires_at=excluded.expires_at,attempts=0,used_at=null,processing=false,outcome=null;
    return jsonb_build_object('allowed',true,'userId',target,'email',native->>'email');
  elsif action='activate' then
    -- Bind ONLY the proof returned for THIS server generation, never auth.users' current token.
    hash:=command->>'tokenHash';
    if state.ticket is distinct from (command->>'ticket')::uuid or state.digest is not null or state.used_at is not null
      or state.expires_at<=observed or hash is null or hash !~ '^[a-f0-9]{56}$'
      or command->>'userId' is distinct from target::text then return jsonb_build_object('allowed',false); end if;
    update private.email_challenges c set digest=encode(sha256(convert_to(hash,'UTF8')),'hex')
      where c.user_id=target and c.purpose=challenge_scope.purpose;
    return jsonb_build_object('allowed',true);
  elsif action='cancel' then
    if state.ticket is distinct from (command->>'ticket')::uuid or state.used_at is not null then return jsonb_build_object('allowed',false); end if;
    update private.email_challenges c set digest=null where c.user_id=target and c.purpose=challenge_scope.purpose;
    return jsonb_build_object('allowed',true);
  elsif action='finish' then
    if state.ticket is distinct from (command->>'ticket')::uuid or not state.processing
      or command->>'outcome' is null or command->>'outcome' not in ('completed','failed','uncertain') then return jsonb_build_object('allowed',false); end if;
    update private.email_challenges c set outcome=command->>'outcome',processing=(command->>'outcome'='uncertain')
      where c.user_id=target and c.purpose=challenge_scope.purpose;
    return jsonb_build_object('allowed',true);
  elsif action='consume' then
    if state.user_id is null or state.digest is null then return jsonb_build_object('allowed',false,'reason','invalid'); end if;
    if state.used_at is not null then return jsonb_build_object('allowed',false,'reason',case when state.processing then 'processing' else 'used' end); end if;
    if state.expires_at<=observed then return jsonb_build_object('allowed',false,'reason','expired'); end if;
    if state.attempts>=5 then return jsonb_build_object('allowed',false,'reason','attempts'); end if;
    hash:=coalesce(command->>'tokenHash',encode(sha224(convert_to(lower(native->>'email')||(command->>'code'),'UTF8')),'hex'));
    update private.email_challenges c set attempts=c.attempts+1,
      used_at=case when c.digest=encode(sha256(convert_to(hash,'UTF8')),'hex') then observed else null end,
      processing=(c.digest=encode(sha256(convert_to(hash,'UTF8')),'hex'))
      where c.user_id=target and c.purpose=challenge_scope.purpose;
    if state.digest<>encode(sha256(convert_to(hash,'UTF8')),'hex') then return jsonb_build_object('allowed',false,'reason','invalid'); end if;
    return jsonb_build_object('allowed',true,'userId',target,'email',native->>'email','tokenHash',hash,'ticket',state.ticket);
  end if;
  raise exception 'Invalid challenge action' using errcode='22023';
end $$;
revoke all on function public.email_challenge(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.email_challenge(jsonb) to service_role;
notify pgrst,'reload schema';
commit;
