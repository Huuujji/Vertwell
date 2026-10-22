import { createHash } from 'node:crypto';
import type { PermissionDatabase } from './permission-checks.js';

const transactionTables = ['public.daily_sales_review_items','public.cash_movements','public.daily_sales_reviews',
  'public.void_requests','public.payments','public.sale_item_modifiers','public.sale_item_stock_usage','public.sale_items','public.sales',
  'private.checkout_operations','private.sales_workflow_operations','private.notification_reads','private.notification_versions','private.review_notifications'] as const;
const retainedTables = ['public.profiles','public.inventory_units','public.skus','public.stock_items','public.stock_batches','public.products',
  'public.product_variants','public.product_recipe_items','public.modifier_groups','public.modifier_options','public.modifier_stock_inputs',
  'public.bundle_components','public.bundle_component_modifiers','public.alert_settings','private.checkout_state'] as const;
const mutableTables = [...transactionTables,'public.stock_movements','public.audit_events'];

export async function lockSalesReset(db:PermissionDatabase) {
  await db.query('select pg_advisory_xact_lock(171026,3)');
  await db.query('select pg_advisory_xact_lock(171026,1)');
  await db.query(`lock table ${mutableTables.join(',')} in access exclusive mode`);
}
export async function salesResetSnapshot(db:PermissionDatabase) {
  const data:Record<string,unknown>={};
  for(const table of mutableTables) data[table]=(await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') as value from ${table} t`)).rows[0].value;
  return data;
}
export async function salesResetPreserved(db:PermissionDatabase) {
  const hashes:Record<string,string>={};
  for(const table of retainedTables) hashes[table]=(await db.query(`select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]')::text,'UTF8')),'hex') as value from ${table} t`)).rows[0].value;
  hashes.balances=(await db.query(`select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]')::text,'UTF8')),'hex') as value
    from (select b.id,coalesce(sum(m.quantity_base),0)::text as quantity from public.stock_batches b left join public.stock_movements m on m.batch_id=b.id group by b.id) t`)).rows[0].value;
  return hashes;
}
export function salesResetToken(snapshot:unknown,preserved:unknown) {
  return createHash('sha256').update(JSON.stringify({snapshot,preserved})).digest('hex');
}

// Only a privileged maintenance CLI calls this, inside its locked transaction.
// No public API, migration, startup path or application role can reset history.
export async function resetSalesInsideTransaction(db:PermissionDatabase) {
  const before=await salesResetPreserved(db);
  const triggers=(await db.query(`select n.nspname,c.relname,t.tgname,t.tgenabled from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname||'.'||c.relname=any($1::text[]) order by 1,2,3`,[mutableTables])).rows;
  const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"';
  for(const t of triggers) await db.query(`alter table ${quote(t.nspname)}.${quote(t.relname)} disable trigger ${quote(t.tgname)}`);
  // Keep each stock deduction and its exact amount, but remove the deleted sale
  // linkage. Its new kind excludes it from sales/ingredient-consumption reports.
  await db.query(`update public.stock_movements set kind='Correction',sale_item_id=null,
    reason='Sales reset: retained prior stock deduction' where sale_item_id is not null`);
  await db.query(`delete from public.audit_events where entity_type in ('sale','daily_sales_review','sales_operation')
    or operation_id in(select operation_id from private.checkout_operations union select operation_id from private.sales_workflow_operations)`);
  // Remove all sales-linked cash/review evidence. Independent cash adjustments
  // are retained; this reset does not erase unrelated inventory or account logs.
  await db.query('delete from public.cash_movements where sale_id is not null or review_id is not null');
  for(const table of transactionTables.filter(t=>t!=='public.cash_movements')) await db.query(`delete from ${table}`);
  for(const t of triggers) {
    const state=t.tgenabled==='D'?'disable':t.tgenabled==='A'?'enable always':t.tgenabled==='R'?'enable replica':'enable';
    await db.query(`alter table ${quote(t.nspname)}.${quote(t.relname)} ${state} trigger ${quote(t.tgname)}`);
  }
  const after=await salesResetPreserved(db);
  if(JSON.stringify(before)!==JSON.stringify(after)) throw new Error('Sales reset changed a protected account, catalogue, setting or stock quantity. Roll back.');
  await db.query('update private.inventory_state set revision=revision+1 where singleton');
  await db.query(`select realtime.send('{"scopes":["sales","reports","notifications"]}'::jsonb,'invalidate','vertwell:managers',true)`);
  return {preserved:after};
}
