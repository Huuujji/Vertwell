-- LOCAL UNAPPLIED Major Adjustment 9. Read projection only; no historical writes.
begin;
alter function private.sales_workflow_sale(uuid,boolean) rename to sales_workflow_sale_adjustment8;
create function private.sales_workflow_sale(sale uuid,manager boolean) returns jsonb language sql stable security definer set search_path='' as $$
 select case when manager then value else
   (value-'refundBalance'-'adjustableItems')||jsonb_build_object('events',(select coalesce(jsonb_agg(e),'[]') from jsonb_array_elements(value->'events') e where coalesce(e->'details'->>'kind','') not in ('stock.dispose','refund.record')),'adjustableItems','[]'::jsonb,'adjustments',jsonb_build_object(
    'decisions',(select coalesce(jsonb_agg(d),'[]') from jsonb_array_elements(value->'adjustments'->'decisions') d where d->>'kind' in ('void.request','void.decide','sale.void')),
    'dispositions','[]'::jsonb,'refunds','[]'::jsonb)) end
 from (select private.sales_workflow_sale_adjustment8(sale,manager) as value) projection
$$;
revoke all on function private.sales_workflow_sale_adjustment8(uuid,boolean),private.sales_workflow_sale(uuid,boolean) from public,anon,authenticated,service_role;
commit;
