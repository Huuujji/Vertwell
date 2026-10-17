import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Shared real-SQL scenarios for disposable PostgreSQL and the development server.
// Each caller MUST wrap a scenario in BEGIN/ROLLBACK. No real identity is edited.
export interface PermissionDatabase {
  query(sql: string, params?: any[]): Promise<{ rows: any[] }>;
}
async function value(db: PermissionDatabase, sql: string, params: any[] = []) {
  return (await db.query(sql, params)).rows[0]?.value;
}
async function denied(db: PermissionDatabase, sql: string, params: any[] = [], pattern = /not permitted|permission denied|row-level security/) {
  await db.query('savepoint denied_permission');
  try { await assert.rejects(() => db.query(sql, params), pattern); }
  finally { await db.query('rollback to savepoint denied_permission'); await db.query('release savepoint denied_permission'); }
}
async function identity(db: PermissionDatabase, id: string, role = 'authenticated') {
  await db.query('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  await db.query(`set local role ${role}`);
}
async function fixture(db: PermissionDatabase) {
  const actors = { owner: randomUUID(), admin: randomUUID(), staff: randomUUID(), other: randomUUID(), inactive: randomUUID(), unlinked: randomUUID() };
  for (const [name, id] of Object.entries(actors)) {
    await db.query('insert into auth.users(id) values ($1)', [id]);
    if (name !== 'unlinked') await db.query(`insert into public.profiles(id,full_name,username,role,active) values ($1,$2,$3,$4,$5)`,
      [id, `Permission ${name}`, `p4-${id}`, name === 'owner' ? 'Owner' : name === 'admin' ? 'Admin' : 'Staff', name !== 'inactive']);
  }
  async function sale(actor: string, offset: string, status = 'Pending') {
    const id = randomUUID(), item = randomUUID();
    await db.query(`insert into public.sales(id,order_number,idempotency_key,request_hash,occurred_at,cashier_id,cashier_name,cashier_role,
      subtotal,tax_amount,total,review_state,status) values ($1,$2,$3,'private-request-hash',
      (date_trunc('day',statement_timestamp() at time zone 'Asia/Manila') at time zone 'Asia/Manila') + $4::interval,
      $5,'Historical cashier','Staff',10,0,10,'Awaiting Owner review',$6)`, [id,`P4-${id}`,randomUUID(),offset,actor,status]);
    await db.query(`insert into public.sale_items(id,sale_id,name,sku,category,quantity,unit_price,original_unit_price)
      values ($1,$2,'Purchased item','P4-HISTORICAL','Hobby',1,10,10)`, [item,id]);
    await db.query(`insert into public.sale_item_modifiers(sale_item_id,name,price) values ($1,'Purchased option',0)`, [item]);
    await db.query(`insert into public.payments(sale_id,method,amount,cash_tendered,change_given) values ($1,'Cash',10,10,0)`, [id]);
    await db.query(`insert into public.void_requests(sale_id,reason,requested_by,requested_name,requested_role)
      values ($1,'Fixture request',$2,'Historical cashier','Staff')`, [id,actor]);
    await db.query(`insert into public.audit_events(actor_id,actor_name,actor_role,event_type,entity_type,entity_id,reason,operation_id)
      values ($1,'Historical cashier','Staff','Sale recorded','sale',$2,'Fixture',gen_random_uuid())`, [actor,id]);
    return id;
  }
  const sales = { own: await sale(actors.staff,'0 seconds'), yesterday: await sale(actors.staff,'-1 microsecond'),
    tomorrow: await sale(actors.staff,'1 day'), other: await sale(actors.other,'1 second') };
  const sku = randomUUID(), stock = randomUUID(), product = randomUUID();
  await db.query('insert into public.skus(id,value) values ($1,$2)', [sku,`P4-${sku}`]);
  await db.query(`insert into public.stock_items(id,sku_id,name,kind,category,unit_code)
    values ($1,$2,'Private physical stock','Finished','Hobby','pcs')`, [stock,sku]);
  await db.query(`insert into public.products(id,sku_id,name,category,stock_model,stock_item_id,base_price)
    values ($1,$2,'Selling card','Hobby','Retail Item',$3,123.45)`, [product,sku,stock]);
  return { actors, sales, stock, product };
}

const expected = {
  Owner: ['dashboard.read','inventory.read','inventory.write','reports.read','pos.read','checkout.create','sales.read','void.request','void.decide','sale.void','review.confirm','accounts.read','accounts.create','accounts.update','alerts.read','alerts.write'],
  Admin: ['dashboard.read','inventory.read','inventory.write','reports.read','pos.read','checkout.create','sales.read','void.request','void.decide','sale.void','accounts.read','accounts.create','accounts.update'],
  Staff: ['pos.read','checkout.create','sales.read','void.request'],
};
export const permissionScenarios: { name: string; run(db: PermissionDatabase): Promise<void> }[] = [
  { name: 'each role receives exactly its database permissions; unknown actions and forged metadata fail', async run(db) {
    const f = await fixture(db);
    for (const [name, role] of [['owner','Owner'],['admin','Admin'],['staff','Staff']] as const) {
      await identity(db,f.actors[name]);
      const access = await value(db,'select public.business_access() as value');
      assert.equal(access.profile.id,f.actors[name]); assert.equal(access.profile.role,role);
      assert.deepEqual(access.permissions,expected[role]);
      for (const action of expected.Owner) {
        const target = ['void.request','void.decide','sale.void'].includes(action) ? f.sales.own : null;
        if (expected[role].includes(action)) assert.equal((await value(db,'select public.authorize_business_action($1,$2) as value',[action,target])).profile.id,f.actors[name]);
        else await denied(db,'select public.authorize_business_action($1,$2)',[action,target]);
      }
      await denied(db,"select public.authorize_business_action('unlisted.action')");
    }
    await db.query(`select set_config('request.jwt.claims',$1,true)`, [JSON.stringify({role:'Owner',app_metadata:{role:'Owner'},user_metadata:{role:'Owner'}})]);
    await denied(db,"select public.authorize_business_action('alerts.write')");
  }},
  { name: 'Staff sales, items, purchased options, payments and requests are own current Manila day only', async run(db) {
    const f = await fixture(db); await identity(db,f.actors.staff);
    for (const [table, idColumn] of [['sales','id'],['sale_items','sale_id'],['payments','sale_id'],['void_requests','sale_id']]) {
      const rows = (await db.query(`select ${idColumn} as id from public.${table} order by ${idColumn}`)).rows;
      assert.deepEqual(rows,[{id:f.sales.own}],table);
    }
    assert.equal(await value(db,'select count(*)::int as value from public.sale_item_modifiers'),1);
    for (const id of [f.sales.other,f.sales.yesterday,f.sales.tomorrow,randomUUID()]) {
      assert.deepEqual((await db.query('select id from public.sales where id=$1',[id])).rows,[]);
      await denied(db,"select public.authorize_business_action('sales.read',$1)",[id]);
      await denied(db,"select public.authorize_business_action('void.request',$1)",[id]);
    }
    const wire = await value(db,'select public.read_business_sales() as value');
    assert.deepEqual(wire.items.map((row: any) => row.id),[f.sales.own]);
    assert.equal(wire.items[0].total,'10.00'); assert.equal(wire.items[0].request_hash,undefined);
    assert.equal(wire.items[0].idempotency_key,undefined);
    assert.equal(wire.businessDate,await value(db,"select (statement_timestamp() at time zone 'Asia/Manila')::date::text as value"));
  }},
  { name: 'Owners and Admins can read all sales and directly authorize voids under their own identity', async run(db) {
    const f = await fixture(db);
    for (const actor of [f.actors.owner,f.actors.admin]) {
      await identity(db,actor);
      for (const target of Object.values(f.sales)) {
        assert.equal((await value(db,"select public.authorize_business_action('sale.void',$1) as value",[target])).profile.id,actor);
        assert.equal((await value(db,'select public.read_business_sales($1) as value',[target])).items[0].id,target);
      }
    }
  }},
  { name: 'anonymous, inactive and unlinked identities cannot use business RPCs or scoped reads', async run(db) {
    const f = await fixture(db);
    for (const actor of [f.actors.inactive,f.actors.unlinked,randomUUID()]) {
      await identity(db,actor);
      for (const sql of ['select public.business_access()',"select public.authorize_business_action('pos.read')",'select public.read_pos_catalogue()','select public.read_business_sales()']) await denied(db,sql);
      for (const table of ['sales','sale_items','sale_item_modifiers','payments','void_requests','alert_settings']) {
        assert.equal(await value(db,`select count(*)::int as value from public.${table}`),0,table);
      }
    }
    for (const role of ['anon','service_role']) {
      await identity(db,f.actors.owner,role);
      await denied(db,'select public.business_access()');
      await denied(db,'select public.read_pos_catalogue()');
      await denied(db,'select * from public.sales');
    }
  }},
  { name: 'POS is available to all roles through a projection without physical stock, recipes or archive drafts', async run(db) {
    const f = await fixture(db);
    for (const actor of [f.actors.owner,f.actors.admin,f.actors.staff]) {
      await identity(db,actor);
      const catalogue = await value(db,'select public.read_pos_catalogue(0,100) as value');
      assert.equal(catalogue.checkoutReady,false);
      const card = catalogue.items.find((row: any) => row.id===f.product);
      assert.equal(card.basePrice,'123.45');
      assert.deepEqual(Object.keys(card).sort(),['basePrice','category','discountType','discountValue','icon','id','imagePath','name','sku','stockModel'].sort());
      await denied(db,'select * from public.stock_items'); await denied(db,'select * from public.products');
    }
    await db.query('reset role'); await db.query('update public.products set enabled=false where id=$1',[f.product]);
    await identity(db,f.actors.staff);
    assert.ok(!(await value(db,'select public.read_pos_catalogue(0,100) as value')).items.some((row: any)=>row.id===f.product));
  }},
  { name: 'P4 table grants are SELECT only; granting writes accidentally still cannot bypass RLS', async run(db) {
    const f = await fixture(db); await identity(db,f.actors.owner);
    for (const table of ['sales','sale_items','payments','void_requests','alert_settings','profiles','skus','stock_movements']) {
      for (const verb of ['INSERT','UPDATE','DELETE','TRUNCATE']) assert.equal(await value(db,'select has_table_privilege(current_user,$1,$2) as value',[`public.${table}`,verb]),false);
    }
    await denied(db,"update public.profiles set role='Owner' where id=$1",[f.actors.staff]);
    await db.query('reset role'); await db.query('grant select,insert,update,delete on public.skus to authenticated');
    await identity(db,f.actors.owner);
    await denied(db,"insert into public.skus(value) values ('P4-UNAUTHORIZED')");
    assert.equal((await db.query("update public.skus set value='P4-UNAUTHORIZED' returning id")).rows.length,0);
    assert.equal((await db.query('delete from public.skus returning id')).rows.length,0);
  }},
  { name: 'management, account and audit policies retain role scopes after temporary read grants', async run(db) {
    const f = await fixture(db);
    for (const table of ['profiles','stock_items','products','audit_events']) await db.query(`grant select on public.${table} to authenticated`);
    await identity(db,f.actors.staff);
    assert.deepEqual((await db.query('select id from public.profiles')).rows,[{id:f.actors.staff}]);
    assert.equal(await value(db,'select count(*)::int as value from public.stock_items'),0);
    assert.deepEqual((await db.query('select entity_id from public.audit_events')).rows,[{entity_id:f.sales.own}]);
    await identity(db,f.actors.admin);
    assert.ok(!(await db.query("select id from public.profiles where role='Owner'")).rows.length);
    assert.equal(await value(db,'select count(*)::int as value from public.stock_items where id=$1',[f.stock]),1);
    await identity(db,f.actors.owner);
    assert.equal(await value(db,'select count(*)::int as value from public.profiles where id=$1',[f.actors.admin]),1);
  }},
  { name: 'alert settings require Owner, detect stale revisions, and atomically attribute the actual actor', async run(db) {
    const f = await fixture(db);
    const prior = await value(db,'select updated_at::text as value from public.alert_settings');
    await identity(db,f.actors.owner);
    const saved = await value(db,'select public.update_alert_settings($1,7,3) as value',[prior ?? null]);
    assert.equal(saved.updated_by,f.actors.owner); assert.equal(saved.similar_order_threshold,7);
    const second = await value(db,'select public.update_alert_settings($1,8,4) as value',[saved.updated_at]);
    assert.notEqual(second.updated_at,saved.updated_at);
    await denied(db,'select public.update_alert_settings($1,9,4)',[saved.updated_at],/changed/);
    await denied(db,'select public.update_alert_settings($1,1,4)',[second.updated_at],/check constraint/);
    for (const actor of [f.actors.admin,f.actors.staff]) {
      await identity(db,actor); assert.equal(await value(db,'select count(*)::int as value from public.alert_settings'),0);
      await denied(db,'select public.update_alert_settings($1,10,5)',[second.updated_at]);
    }
    await db.query('reset role');
    const events = (await db.query(`select actor_id,actor_name,actor_role,details from public.audit_events
      where actor_id=$1 and entity_type='alert_settings' order by created_at,id`,[f.actors.owner])).rows;
    assert.equal(events.length,2);
    for (const event of events) { assert.equal(event.actor_name,'Permission owner'); assert.equal(event.actor_role,'Owner'); assert.equal(event.details.after.updated_by,f.actors.owner); }
    assert.equal(await value(db,'select similar_order_threshold as value from public.alert_settings'),8);
  }},
  { name: 'settings and audit roll back together when audit insertion fails', async run(db) {
    const f = await fixture(db), prior = (await db.query('select * from public.alert_settings')).rows;
    await db.query(`create function private.p4_reject_test_audit() returns trigger language plpgsql as $$
      begin if new.entity_type='alert_settings' then raise exception 'Synthetic audit failure'; end if; return new; end $$`);
    await db.query('create trigger p4_reject_test_audit before insert on public.audit_events for each row execute function private.p4_reject_test_audit()');
    await identity(db,f.actors.owner);
    await denied(db,'select public.update_alert_settings($1,7,3)',[prior[0]?.updated_at ?? null],/Synthetic audit failure/);
    await db.query('reset role'); assert.deepEqual((await db.query('select * from public.alert_settings')).rows,prior);
  }},
  { name: 'role changes and deactivation affect the same existing identity on its next operation', async run(db) {
    const f = await fixture(db); await identity(db,f.actors.admin);
    assert.equal((await value(db,"select public.authorize_business_action('sale.void',$1) as value",[f.sales.other])).profile.role,'Admin');
    await db.query('reset role'); await db.query("update public.profiles set role='Staff' where id=$1",[f.actors.admin]);
    await identity(db,f.actors.admin); await denied(db,"select public.authorize_business_action('sale.void',$1)",[f.sales.other]);
    assert.deepEqual((await db.query('select id from public.sales')).rows,[]);
    await db.query('reset role'); await db.query('update public.profiles set active=false where id=$1',[f.actors.staff]);
    await identity(db,f.actors.staff); await denied(db,'select public.business_access()');
    assert.deepEqual((await db.query('select id from public.sales')).rows,[]);
  }},
  { name: 'sale gates reject missing/irrelevant targets, already-voided sales and invalid pagination', async run(db) {
    const f = await fixture(db);
    await db.query(`update public.sales set status='Voided',voided_at=now(),voided_by=$1,voided_name='Permission owner',
      voided_role='Owner',void_reason='Test' where id=$2`,[f.actors.owner,f.sales.own]);
    await identity(db,f.actors.owner);
    await denied(db,"select public.authorize_business_action('sale.void')",[],/sale is required/);
    await denied(db,"select public.authorize_business_action('pos.read',$1)",[f.sales.own],/does not accept/);
    await denied(db,"select public.authorize_business_action('sale.void',$1)",[f.sales.own],/already voided/);
    for (const [offset,size] of [[-1,5],[0,0],[0,101],[1000001,5],[null,5]]) {
      await denied(db,'select public.read_business_sales(null,$1,$2)',[offset,size],/pagination/);
      await denied(db,'select public.read_pos_catalogue($1,$2)',[offset,size],/pagination/);
    }
    const page = await value(db,'select public.read_business_sales(null,0,1) as value');
    assert.equal(page.items.length,1); assert.equal(page.hasMore,true);
  }},
];
