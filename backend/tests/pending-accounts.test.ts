import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { testRealtime } from '../scripts/test-realtime.js';

const db = new PGlite();
const legacy = randomUUID(), pending = randomUUID();
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text unique,
      raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await testRealtime(db);
  const root = new URL('../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(root)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, root), 'utf8'));
  await db.query('insert into auth.users(id,email) values($1,$2)', [legacy, 'legacy@example.invalid']);
  await db.query("insert into public.profiles(id,full_name,username,role) values($1,'Legacy Owner','legacy','Owner')", [legacy]);
  await db.query(`insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values($1,$2,
    '{"happyhentie_email_required":true}','{"email_verified":true,"role":"Owner"}')`, [pending, 'pending@example.invalid']);
  await db.query("insert into public.profiles(id,full_name,username,role) values($1,'Pending Owner','pending','Owner')", [pending]);
});
after(async () => { await db.close(); });
async function as(id: string, sql: string, args: unknown[] = []) {
  return db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
    await tx.exec('set local role authenticated');
    return (await tx.query<any>(sql, args)).rows;
  });
}
const denied = (sql: string, args: unknown[] = []) => assert.rejects(() => as(pending, sql, args), (e: any) => e.code === '42501');

test('pending token cannot reach protected RPCs, populated protected tables or private realtime topics', async () => {
  await db.query('insert into public.alert_settings(similar_order_threshold,window_minutes,updated_by) values(2,5,$1)',[legacy]);
  assert.equal((await as(legacy,'select * from public.alert_settings')).length,1);
  const calls = [
    'select public.current_profile()', 'select public.business_access()',
    "select public.authorize_business_action('dashboard.read')", 'select public.read_managed_accounts()',
    'select public.read_inventory()', 'select public.read_reports()', 'select public.read_notifications()',
    'select public.read_pos_catalogue()', 'select public.read_checkout_catalogue()',
    "select public.quote_checkout('[]')", "select public.checkout('{}')",
    "select public.inventory_command('{}')", "select public.sales_workflow_command('{}')",
    'select public.read_sales_workflow()', "select public.update_alert_settings(null,2,5)",
    "select public.set_notification_read(gen_random_uuid(),'1',true)",
    "select public.update_account($1,null,'Changed','changed','Staff',true)",
    "select public.account_provisioning_result(gen_random_uuid(),'{}')",
  ];
  for (const sql of calls) await denied(sql, sql.includes('$1') ? [legacy] : []);
  const rows = await as(pending, 'select private.business_role() as role');
  assert.equal(rows[0].role, null);
  for (const table of ['sales','sale_items','sale_item_modifiers','payments','void_requests','alert_settings']) {
    assert.deepEqual(await as(pending, `select * from public.${table}`), []);
  }
  await db.query("select realtime.send('{}','invalidate','vertwell:managers',true)");
  await db.query("select realtime.send('{}','invalidate','vertwell:catalogue',true)");
  for (const topic of ['vertwell:managers','vertwell:catalogue',`vertwell:user:${pending}`]) {
    const messages = await db.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.realtime.topic',$2,true)", [pending,topic]);
      await tx.exec('set local role authenticated');
      return (await tx.query('select * from realtime.messages')).rows;
    });
    assert.deepEqual(messages, []);
  }
});

test('pending actor cannot provision through insert or delayed metadata; rejection rolls back identity and history', async () => {
  const command = { happyhentie_email_required:true, vertwell_provision:{actor_id:pending,full_name:'Blocked target',username:'blocked',role:'Staff',operation_id:randomUUID()} };
  const id=randomUUID();
  await assert.rejects(() => db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)', [id,'blocked@example.invalid',JSON.stringify(command)]), (e:any) => e.code==='42501');
  assert.equal((await db.query('select * from auth.users where id=$1',[id])).rows.length,0);
  await db.query('insert into auth.users(id,email) values($1,$2)', [id,'delayed@example.invalid']);
  await assert.rejects(() => db.query('update auth.users set raw_app_meta_data=$2 where id=$1',[id,JSON.stringify(command)]), (e:any) => e.code==='42501');
  assert.equal((await db.query('select * from public.profiles where id=$1',[id])).rows.length,0);
  assert.equal((await db.query('select * from public.audit_events where entity_id=$1',[id])).rows.length,0);
  assert.equal((await db.query('select * from private.account_operations where target_id=$1',[id])).rows.length,0);
});

test('pending Owner cannot replace the accessible Owner; legacy access/history and current-account protection survive', async () => {
  const snapshot=(await db.query<any>('select to_jsonb(p) as value from public.profiles p where id=$1',[legacy])).rows[0].value;
  await assert.rejects(()=>db.query("update public.profiles set role='Staff' where id=$1",[legacy]),(e:any)=>e.code==='23514');
  await assert.rejects(()=>db.query('update public.profiles set active=false where id=$1',[legacy]),(e:any)=>e.code==='23514');
  await assert.rejects(()=>as(legacy,"select public.update_account($1,$2,'Legacy Owner','legacy','Owner',false)",[legacy,snapshot.updated_at]),(e:any)=>e.code==='23514');
  assert.equal((await as(legacy,'select public.current_profile() as value'))[0].value.id,legacy);
  const listed=(await as(legacy,'select public.read_managed_accounts() as value'))[0].value;
  assert.equal(listed.find((p:any)=>p.id===legacy).emailVerification,'existing');
  assert.equal(listed.find((p:any)=>p.id===pending).emailVerification,'pending');
  assert.deepEqual((await db.query<any>('select to_jsonb(p) as value from public.profiles p where id=$1',[legacy])).rows[0].value,snapshot);
});

test('native confirmation alone unlocks access and invalidates Users without modifying profiles or prior audit', async () => {
  const profiles=(await db.query('select * from public.profiles order by id')).rows;
  const audit=(await db.query('select * from public.audit_events order by id')).rows;
  await db.exec('delete from realtime.messages');
  await db.query('update auth.users set email_confirmed_at=clock_timestamp() where id=$1',[pending]);
  assert.equal((await as(pending,'select public.current_profile() as value'))[0].value.id,pending);
  assert.equal((await as(pending,"select public.authorize_business_action('dashboard.read') as value"))[0].value.profile.id,pending);
  const listed=(await as(legacy,'select public.read_managed_accounts() as value'))[0].value;
  assert.equal(listed.find((p:any)=>p.id===pending).emailVerification,'verified');
  assert.ok((await db.query<any>('select payload from realtime.messages where topic=$1',['vertwell:managers'])).rows.some(r=>r.payload.scopes.includes('accounts')));
  assert.deepEqual((await db.query('select * from public.profiles order by id')).rows,profiles);
  assert.deepEqual((await db.query('select * from public.audit_events order by id')).rows,audit);
  // A genuinely confirmed successor is now eligible. Preserve both identities/history.
  await db.query("update public.profiles set role='Staff' where id=$1",[legacy]);
  assert.equal((await db.query('select * from auth.users where id in ($1,$2)',[legacy,pending])).rows.length,2);
});
