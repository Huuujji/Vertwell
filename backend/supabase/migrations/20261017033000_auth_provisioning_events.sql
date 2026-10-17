-- GoTrue may apply trusted app metadata in an UPDATE after inserting the Auth user.
begin;
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
drop trigger vertwell_auth_profile on auth.users;
create trigger vertwell_auth_profile after insert or update of raw_app_meta_data on auth.users
for each row execute function private.provision_auth_profile();
revoke all on function private.provision_auth_profile() from public,anon,authenticated,service_role;
commit;
