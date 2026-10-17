-- Deliberate revision/idempotency/archive conflicts are HTTP 409 responses,
-- not transient PostgreSQL serialization failures. PostgREST 14 retries 40001
-- internally, so use its PT409 application code without weakening rejection.
-- Preserve all applied sources, function bodies apart from the explicit error
-- code, security-definer/search-path settings, signatures and existing grants.
begin;
do $$
declare target regprocedure; source text;
begin
  foreach target in array array[
    'public.update_account(uuid,timestamp with time zone,text,text,text,boolean)'::regprocedure,
    'public.authorize_business_action(text,uuid)'::regprocedure,
    'public.update_alert_settings(timestamp with time zone,integer,integer)'::regprocedure,
    'private.inventory_stock(jsonb,public.profiles,uuid,text,text)'::regprocedure,
    'private.inventory_product(jsonb,jsonb,public.profiles,uuid,text)'::regprocedure,
    'public.inventory_command(jsonb)'::regprocedure
  ] loop
    source := pg_catalog.pg_get_functiondef(target);
    if position('40001' in source)=0 then
      raise exception 'Expected the reviewed business conflict code in %', target;
    end if;
    source := regexp_replace(source, 'errcode[[:space:]]*=[[:space:]]*''40001''', 'errcode=''PT409''', 'g');
    if position('40001' in source)>0 then
      raise exception 'An unexpected serialization code remains in %', target;
    end if;
    execute source;
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
