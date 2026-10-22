-- Shared operational counters only. Existing business data and migrations stay intact.
begin;

create table private.login_rate_limits (
  client_key text primary key check (client_key ~ '^[0-9a-f]{64}$'),
  attempts smallint not null check (attempts between 1 and 11),
  window_ends_at timestamptz not null
);
create index login_rate_limits_expiry on private.login_rate_limits(window_ends_at);
alter table private.login_rate_limits enable row level security;
revoke all on private.login_rate_limits from public, anon, authenticated, service_role;

-- Server-only HMAC keys; no raw IP, identifier, password, session or business row.
-- One atomic upsert serializes attempts for the same client across all instances.
create function public.consume_login_attempt(client_key text) returns jsonb
language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare
  observed_at timestamptz := clock_timestamp();
  counter private.login_rate_limits;
begin
  if client_key is null or client_key !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid login limit key' using errcode = '22023';
  end if;

  -- Bounded opportunistic cleanup. Inactive keys can remain until later traffic;
  -- the one-minute enforcement window expires independently of physical cleanup.
  delete from private.login_rate_limits where login_rate_limits.client_key in (
    select old.client_key from private.login_rate_limits old
    where old.window_ends_at < observed_at - interval '5 minutes'
    order by old.window_ends_at limit 100 for update skip locked
  );
  insert into private.login_rate_limits as existing (client_key, attempts, window_ends_at)
    values (consume_login_attempt.client_key, 1, observed_at + interval '1 minute')
    on conflict on constraint login_rate_limits_pkey do update
    set attempts = case when existing.window_ends_at <= observed_at then 1 else least(existing.attempts + 1, 11) end,
        window_ends_at = case when existing.window_ends_at <= observed_at then observed_at + interval '1 minute' else existing.window_ends_at end
    returning * into counter;

  return jsonb_build_object('allowed', counter.attempts <= 10,
    'retryAfter', greatest(1, least(60, ceil(extract(epoch from counter.window_ends_at - observed_at))::int)));
end $$;
revoke all on function public.consume_login_attempt(text) from public, anon, authenticated, service_role;
grant execute on function public.consume_login_attempt(text) to service_role;

commit;
