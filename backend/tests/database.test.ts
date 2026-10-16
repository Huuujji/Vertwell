import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, mkdir, mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const sqlRoot = new URL('../supabase/', import.meta.url);
const owner = '00000000-0000-4000-8000-000000000001';
let db: PGlite;
let migrations: string[];

async function initialize(database: PGlite) {
  // Only test-owned Auth/role stand-ins. Production uses Supabase's real objects.
  await database.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);`);
  for (const migration of migrations) await database.exec(migration);
}

before(async () => {
  const files = (await readdir(new URL('migrations/', sqlRoot))).filter(name => name.endsWith('.sql')).sort();
  migrations = await Promise.all(files.map(name => readFile(new URL(`migrations/${name}`, sqlRoot), 'utf8')));
  assert.equal(files.length, 3);
  db = new PGlite();
  await initialize(db);
});
after(async () => { await db?.close(); });
beforeEach(async () => { await db.exec('begin'); });
afterEach(async () => { await db.exec('rollback'); });

async function rejected(sql: string, message: RegExp, params: unknown[] = []) {
  await db.exec('savepoint invalid_operation');
  try { await assert.rejects(() => params.length ? db.query(sql, params) : db.exec(sql), message); }
  finally { await db.exec('rollback to savepoint invalid_operation; release savepoint invalid_operation'); }
}
async function scalar(sql: string, params: unknown[] = []) {
  const result = await db.query<Record<string, unknown>>(sql, params);
  return Object.values(result.rows[0]!)[0];
}
async function actor() {
  await db.query('insert into auth.users(id) values ($1)', [owner]);
  await db.query(`insert into public.profiles(id,full_name,username,role)
    values ($1,'Database Test Owner','db-test-owner','Owner')`, [owner]);
}
async function sku(value = `TEST-${randomUUID()}`) {
  return String(await scalar('insert into public.skus(value) values ($1) returning id', [value]));
}
async function stock(kind = 'Finished', category = 'Hobby', unit = 'pcs') {
  return String(await scalar(`insert into public.stock_items(sku_id,name,kind,category,unit_code)
    values ($1,'Test stock',$2,$3,$4) returning id`, [await sku(), kind, category, unit]));
}
async function batch(stockId: string, dated = false) {
  return String(await scalar(`insert into public.stock_batches(stock_item_id,manufactured_on,expires_on)
    values ($1,case when $2 then current_date-1 end,case when $2 then current_date+5 end) returning id`, [stockId, dated]));
}
async function product(model = 'Bundle', stockId: string | null = null, skuId?: string) {
  return String(await scalar(`insert into public.products(sku_id,name,category,stock_model,stock_item_id,base_price)
    values ($1,'Test product','Hobby',$2,$3,50) returning id`, [skuId ?? await sku(), model, stockId]));
}
async function sale(time = '2026-01-01T16:05:00Z') {
  return String(await scalar(`insert into public.sales(order_number,idempotency_key,request_hash,occurred_at,
    cashier_id,cashier_name,cashier_role,subtotal,tax_amount,total,review_state,status,stock_committed,usage_complete)
    values ($1,$2,'test-request',$3,$4,'Original Owner','Owner',50,6,56,'Owner checkout','Completed',true,true) returning id`,
  [`TEST-${randomUUID()}`, randomUUID(), time, owner]));
}
async function movement(batchId: string, kind: string, quantity: number, operationId = randomUUID(), itemId: string | null = null) {
  return db.query(`insert into public.stock_movements(batch_id,kind,quantity_base,actor_id,actor_name,
    actor_role,reason,operation_id,sale_item_id) values ($1,$2,$3,$4,'Original Owner','Owner','Database test',$5,$6)`,
  [batchId, kind, quantity, owner, operationId, itemId]);
}

test('fresh migrations expose no application tables/functions and seed no business identities or history', async () => {
  const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(`
    select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r'`);
  assert.equal(tables.rows.length, 25);
  assert.ok(tables.rows.every(row => row.relrowsecurity));
  assert.equal(await scalar('select count(*)::int from public.profiles'), 0);
  assert.equal(await scalar('select count(*)::int from public.sales'), 0);
  assert.equal(await scalar('select count(*)::int from public.stock_movements'), 0);
  const grants = await db.query(`select table_name from information_schema.role_table_grants
    where table_schema='public' and grantee in ('PUBLIC','anon','authenticated','service_role')`);
  assert.deepEqual(grants.rows, []);
  assert.equal(await scalar(`select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'`), 0);
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal(await scalar(`select has_schema_privilege($1,'private','USAGE')`, [role]), false);
    assert.equal(await scalar(`select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='private' and has_function_privilege($1,p.oid,'EXECUTE')`, [role]), 0);
    await db.exec(`set local role ${role}`);
    await rejected('select * from public.profiles', /permission denied/);
    await rejected("insert into public.skus(value) values ('UNAUTHORIZED')", /permission denied/);
    await db.exec('reset role');
  }
});

test('RLS still denies authenticated access if a later grant is accidentally added without a policy', async () => {
  await sku('RLS-HIDDEN');
  await db.exec('grant select,insert,update,delete on public.skus to authenticated; set local role authenticated');
  assert.equal(await scalar('select count(*)::int from public.skus'), 0);
  await rejected("insert into public.skus(value) values ('ESCALATION')", /row-level security/);
  await db.exec('reset role');
});

test('SKU/username uniqueness ignores case and profiles cannot contain passwords or copied email', async () => {
  await actor();
  await sku('PRR-HB-0001');
  await rejected("insert into public.skus(value) values ('prr-hb-0001')", /unique/);
  await db.query('insert into auth.users(id) values ($1)', [randomUUID()]);
  await rejected(`insert into public.profiles(id,full_name,username,role)
    select id,'Second','DB-TEST-OWNER','Staff' from auth.users where id<>$1`, /unique/, [owner]);
  const columns = await db.query<{ column_name: string }>(`select column_name from information_schema.columns
    where table_schema='public' and table_name='profiles'`);
  assert.ok(columns.rows.every(row => !/password|email/.test(row.column_name)));
  assert.equal(await scalar(`select count(*)::int from information_schema.columns where table_schema='public'
    and column_name='item_code'`), 0);
  await rejected(`insert into public.profiles(id,full_name,username,role)
    values ('99999999-0000-4000-8000-000000000001','Orphan','orphan','Owner')`, /foreign key/);
});

test('a Retail Item can share its linked stock SKU while an unrelated product cannot', async () => {
  const stockId = await stock();
  const skuId = String(await scalar('select sku_id from public.stock_items where id=$1', [stockId]));
  const linked = await product('Retail Item', stockId, skuId);
  await db.exec('set constraints all immediate');
  await db.query('update public.skus set value=$1 where id=$2', ['RENAMED-SKU', skuId]);
  assert.equal(await scalar('select stock_item_id from public.products where id=$1', [linked]), stockId);
  await rejected(`update public.products set stock_model='Bundle',stock_item_id=null where id=$1`, /SKU may be shared/, [linked]);
});

test('stock links require the right stock model, kind and whole-piece unit', async () => {
  const ingredient = await stock('Ingredient', 'Beverage', 'g');
  await rejected(`insert into public.products(sku_id,name,category,stock_model,stock_item_id,base_price)
    values ($1,'Invalid','Hobby','Retail Item',$2,10)`, /Finished stock in pieces/, [await sku(), ingredient]);
  await rejected(`insert into public.products(sku_id,name,category,stock_model,base_price)
    values ($1,'Invalid','Hobby','Retail Item',10)`, /check constraint/, [await sku()]);
  await rejected(`insert into public.products(sku_id,name,category,stock_model,base_price)
    values ($1,'Invalid','Hobby','Recipe',10)`, /check constraint/, [await sku()]);
});

test('Food/Beverage require per-batch dates; Hobby permits missing dates and rejects reversed dates', async () => {
  const food = await stock('Ingredient', 'Food', 'kg');
  await rejected('insert into public.stock_batches(stock_item_id) values ($1)', /require both dates/, [food]);
  await batch(food, true);
  const hobby = await stock();
  await batch(hobby);
  await rejected(`insert into public.stock_batches(stock_item_id,manufactured_on,expires_on)
    values ($1,'2026-05-02','2026-05-01')`, /check constraint/, [hobby]);
  await rejected("update public.stock_items set category='Food' where id=$1", /require both dates/, [hobby]);
});

test('recipe/modifier units stay compatible; signed omissions are retained and counted inputs are whole', async () => {
  const input = await stock('Ingredient', 'Food', 'kg');
  const p = String(await scalar(`insert into public.products(sku_id,name,category,stock_model,base_price,manufactured_on,expires_on)
    values ($1,'Recipe','Food','Recipe',10,current_date,current_date+1) returning id`, [await sku()]));
  await db.query(`insert into public.product_recipe_items(product_id,stock_item_id,quantity,unit_code)
    values ($1,$2,20,'g')`, [p, input]);
  await rejected(`insert into public.product_recipe_items(product_id,stock_item_id,quantity,unit_code)
    values ($1,$2,1,'ml')`, /compatible units/, [p, input]);
  const group = String(await scalar("insert into public.modifier_groups(product_id,name) values ($1,'Omissions') returning id", [p]));
  const option = String(await scalar("insert into public.modifier_options(group_id,name) values ($1,'No flour') returning id", [group]));
  await db.query(`insert into public.modifier_stock_inputs(option_id,stock_item_id,quantity,unit_code)
    values ($1,$2,-20,'g')`, [option, input]);
  assert.equal(await scalar('select quantity from public.modifier_stock_inputs where option_id=$1', [option]), '-20.000000');
  const pieces = await stock();
  await rejected(`insert into public.modifier_stock_inputs(option_id,stock_item_id,quantity,unit_code)
    values ($1,$2,0.5,'pcs')`, /whole counted/, [option, pieces]);
  await db.query("update public.stock_items set unit_code='g' where id=$1", [input]);
  await rejected("update public.stock_items set unit_code='ml' where id=$1", /same unit family/, [input]);
});

test('variants retain stable stock IDs, reject duplicate stock and reject incompatible model changes', async () => {
  const p = await product('Variants');
  const s = await stock();
  await db.query("insert into public.product_variants(product_id,stock_item_id,name,price) values ($1,$2,'Small',10)", [p,s]);
  await rejected("insert into public.product_variants(product_id,stock_item_id,name,price) values ($1,$2,'Large',20)", /unique/, [p,s]);
  await db.exec('set constraints all immediate');
  await rejected("update public.products set stock_model='Bundle' where id=$1", /incompatible configuration/, [p]);
});

test('nested bundles reject cycles and fixed variants/options must belong to the included product', async () => {
  const a = await product(), b = await product();
  await db.query('insert into public.bundle_components(bundle_product_id,component_product_id,quantity) values ($1,$2,1)', [a,b]);
  await db.exec('set constraints all immediate');
  await rejected('insert into public.bundle_components(bundle_product_id,component_product_id,quantity) values ($1,$2,1)', /recursive cycles/, [b,a]);
  const vProduct = await product('Variants'), otherProduct = await product('Variants');
  const variant = String(await scalar("insert into public.product_variants(product_id,stock_item_id,name,price) values ($1,$2,'One',10) returning id", [otherProduct,await stock()]));
  await rejected(`insert into public.bundle_components(bundle_product_id,component_product_id,variant_id,quantity)
    values ($1,$2,$3,1)`, /selected variant/, [a,vProduct,variant]);
  const component = String(await scalar('insert into public.bundle_components(bundle_product_id,component_product_id,quantity) values ($1,$2,1) returning id', [a,b]));
  const group = String(await scalar("insert into public.modifier_groups(name) values ('Library') returning id"));
  const option = String(await scalar("insert into public.modifier_options(group_id,name) values ($1,'Library option') returning id", [group]));
  await rejected('insert into public.bundle_component_modifiers(component_id,option_id) values ($1,$2)', /belong to the included product/, [component,option]);
});

test('modifier library copies remain independent after the library changes', async () => {
  const library = String(await scalar("insert into public.modifier_groups(name) values ('Original library') returning id"));
  const copy = String(await scalar("insert into public.modifier_groups(product_id,source_group_id,name) values ($1,$2,'Original library') returning id", [await product(),library]));
  await db.query("update public.modifier_groups set name='New library', archived_at=now() where id=$1", [library]);
  assert.equal(await scalar('select name from public.modifier_groups where id=$1', [copy]), 'Original library');
});

test('ledger rejects overselling, fractional pieces and duplicate operations without changing balance or audit', async () => {
  await actor();
  const b = await batch(await stock());
  await movement(b, 'Opening', 5);
  const operation = randomUUID();
  await movement(b, 'Removal', -2, operation);
  await rejected(`insert into public.stock_movements(batch_id,kind,quantity_base,actor_id,actor_name,actor_role,reason,operation_id)
    values ($1,'Removal',-4,$2,'Owner','Owner','too much',$3)`, /negative/, [b,owner,randomUUID()]);
  await rejected(`insert into public.stock_movements(batch_id,kind,quantity_base,actor_id,actor_name,actor_role,reason,operation_id)
    values ($1,'Receipt',0.5,$2,'Owner','Owner','fraction',$3)`, /whole quantities/, [b,owner,randomUUID()]);
  await rejected(`insert into public.stock_movements(batch_id,kind,quantity_base,actor_id,actor_name,actor_role,reason,operation_id)
    values ($1,'Removal',-1,$2,'Owner','Owner','retry',$3)`, /unique/, [b,owner,operation]);
  assert.equal(await scalar('select sum(quantity_base) from public.stock_movements where batch_id=$1', [b]), '3.000000');
  assert.equal(await scalar('select count(*)::int from public.audit_events'), 2);
});

test('opening coverage is explicit and balances/history cannot be silently rewritten or truncated', async () => {
  await actor();
  const b = await batch(await stock());
  await rejected(`insert into public.stock_movements(batch_id,kind,quantity_base,actor_id,actor_name,actor_role,reason,operation_id)
    values ($1,'Receipt',5,$2,'Owner','Owner','No opening',$3)`, /opening coverage/, [b,owner,randomUUID()]);
  await movement(b,'Opening',5);
  await rejected('update public.stock_movements set quantity_base=999', /append-only/);
  await rejected('delete from public.audit_events', /append-only/);
  await rejected('truncate public.audit_events', /append-only/);
  await rejected('update public.stock_batches set archived_at=now() where id=$1', /Record batch removal/, [b]);
  await movement(b,'Removal',-5);
  await db.query('update public.stock_batches set archived_at=now() where id=$1', [b]);
  assert.equal(await scalar('select count(*)::int from public.stock_movements'), 2);
});

test('stock movement and its audit event roll back together after a later transaction failure', async () => {
  await actor();
  const b = await batch(await stock());
  await movement(b,'Opening',5);
  await db.exec('savepoint checkout_boundary');
  await movement(b,'Removal',-2);
  await assert.rejects(() => db.exec("select 'invalid'::uuid"), /uuid/);
  await db.exec('rollback to savepoint checkout_boundary; release savepoint checkout_boundary');
  assert.equal(await scalar('select sum(quantity_base) from public.stock_movements where batch_id=$1', [b]), '5.000000');
  assert.equal(await scalar('select count(*)::int from public.audit_events'), 1);
});

test('expired and unsellable batches cannot be consumed; expiry-day consumption retains purchased usage', async () => {
  await actor();
  const s = await stock(), b = await batch(s), receipt = await sale();
  const item = String(await scalar(`insert into public.sale_items(sale_id,name,sku,category,quantity,unit_price,original_unit_price)
    values ($1,'Purchased item','SNAPSHOT','Hobby',1,50,50) returning id`, [receipt]));
  await db.query(`insert into public.sale_item_stock_usage(sale_item_id,stock_item_id,sku,name,kind,quantity_base,unit_code)
    values ($1,$2,'SNAPSHOT','Purchased stock','Finished',1,'pcs')`, [item,s]);
  await movement(b,'Opening',5);
  await db.query('update public.stock_batches set expires_on=current_date-1 where id=$1', [b]);
  const insert = `insert into public.stock_movements(batch_id,kind,quantity_base,actor_id,actor_name,actor_role,reason,operation_id,sale_item_id)
    values ($1,'Consumption',-1,$2,'Owner','Owner','checkout',$3,$4)`;
  await rejected(insert,/Expired\/unsellable/, [b,owner,randomUUID(),item]);
  await db.query("update public.stock_batches set expires_on=(now() at time zone 'Asia/Manila')::date,unsellable=true where id=$1", [b]);
  await rejected(insert,/Expired\/unsellable/, [b,owner,randomUUID(),item]);
  await db.query('update public.stock_batches set unsellable=false where id=$1', [b]);
  await movement(b,'Consumption',-1,randomUUID(),item);
  assert.equal(await scalar('select sum(quantity_base) from public.stock_movements where batch_id=$1', [b]), '4.000000');
});

test('sale and purchased snapshots survive catalogue/profile edits and void does not restore stock', async () => {
  await actor();
  const s = await stock(), p = await product('Retail Item',s), b = await batch(s), receipt = await sale();
  await movement(b,'Opening',5);
  await movement(b,'Removal',-1);
  await db.query(`insert into public.sale_items(sale_id,product_id,name,sku,category,quantity,unit_price,original_unit_price)
    values ($1,$2,'Purchased name','PURCHASED-SKU','Hobby',1,50,50)`, [receipt,p]);
  await db.query("update public.products set name='Renamed',archived_at=now() where id=$1", [p]);
  await db.query("update public.profiles set full_name='Renamed Owner',active=false where id=$1", [owner]);
  await rejected('update public.sale_items set unit_price=1', /append-only/);
  await rejected('update public.sales set total=1', /snapshots/);
  await rejected('delete from public.products where id=$1', /append-only/, [p]);
  await db.query(`update public.sales set status='Voided',voided_at=now(),voided_by=$1,
    voided_name='Original Owner',voided_role='Owner',void_reason='Incorrect order' where id=$2`, [owner,receipt]);
  assert.equal(await scalar('select cashier_name from public.sales where id=$1', [receipt]), 'Original Owner');
  assert.equal(await scalar('select name from public.sale_items where sale_id=$1', [receipt]), 'Purchased name');
  assert.equal(await scalar('select sum(quantity_base) from public.stock_movements where batch_id=$1', [b]), '4.000000');
});

test('sale dates use Manila midnight and duplicate checkout/payment references fail', async () => {
  await actor();
  const first = await sale('2026-01-01T15:59:00Z'), second = await sale('2026-01-01T16:00:00Z');
  assert.equal(String(await scalar('select business_date::text from public.sales where id=$1', [first])), '2026-01-01');
  assert.equal(String(await scalar('select business_date::text from public.sales where id=$1', [second])), '2026-01-02');
  await rejected(`insert into public.sales(order_number,idempotency_key,request_hash,cashier_id,cashier_name,cashier_role,
    subtotal,tax_amount,total,review_state,status) select 'OTHER',idempotency_key,'test',$1,'Owner','Owner',50,6,56,'Owner checkout','Completed'
    from public.sales where id=$2`, /unique/, [owner,first]);
  await db.query("insert into public.payments(sale_id,method,amount,reference) values ($1,'GCash',56,'1234567890123')", [first]);
  await rejected("insert into public.payments(sale_id,method,amount,reference) values ($1,'GCash',56,'1234567890123')", /unique/, [second]);
  await rejected("insert into public.payments(sale_id,method,amount,cash_tendered,change_given) values ($1,'Cash',56,100,50)", /check constraint/, [second]);
  await rejected("update public.payments set reference='CHANGED'", /append-only/);
});

test('money and quantity reject NaN, negative prices, zero order counts and invalid percentages', async () => {
  await rejected("select 'NaN'::public.money_amount", /check constraint/);
  await rejected("select 'NaN'::public.stock_quantity", /check constraint/);
  await rejected("select '-1'::public.money_amount", /check constraint/);
  const p = await product();
  await rejected("update public.products set discount_type='Percentage',discount_value=101 where id=$1", /check constraint/, [p]);
  await actor();
  const receipt = await sale();
  await rejected(`insert into public.sale_items(sale_id,name,sku,category,quantity,unit_price,original_unit_price)
    values ($1,'Bad quantity','BAD','Hobby',0,1,1)`, /check constraint/, [receipt]);
  // PostgreSQL integer casts round decimals; API commands must reject fractional JSON counts before casting.
});

test('ledger snapshots retain original SKU/name/canonical unit after inventory edits', async () => {
  await actor();
  const s = await stock('Ingredient','Beverage','kg'), b = await batch(s,true);
  await movement(b,'Opening',1000);
  const before = await db.query<{ stock_sku: string; stock_name: string; unit_code: string }>('select stock_sku,stock_name,unit_code from public.stock_movements where batch_id=$1',[b]);
  await db.query("update public.stock_items set name='Changed stock',unit_code='g' where id=$1",[s]);
  await db.query("update public.skus set value='CHANGED-SKU' where id=(select sku_id from public.stock_items where id=$1)",[s]);
  const after = await db.query<{ stock_sku: string; stock_name: string; unit_code: string }>('select stock_sku,stock_name,unit_code from public.stock_movements where batch_id=$1',[b]);
  assert.deepEqual(after.rows,before.rows);
  assert.equal(after.rows[0]?.unit_code,'g');
  const receipt = await sale();
  const item = String(await scalar(`insert into public.sale_items(sale_id,name,sku,category,quantity,unit_price,original_unit_price)
    values ($1,'Recipe','RECIPE','Beverage',1,50,50) returning id`,[receipt]));
  await rejected(`insert into public.sale_item_stock_usage(sale_item_id,stock_item_id,sku,name,kind,quantity_base,unit_code)
    values ($1,$2,'INPUT','Input','Ingredient',1,'kg')`, /canonical unit/,[item,s]);
});

test('void history retains every request and resolved decisions cannot be replaced', async () => {
  await actor();
  const receipt = await sale();
  const insert = `insert into public.void_requests(sale_id,reason,requested_by,requested_name,requested_role)
    values ($1,'Wrong item',$2,'Original Owner','Owner') returning id`;
  const request = String(await scalar(insert, [receipt,owner]));
  await rejected(insert,/unique/, [receipt,owner]);
  await db.query(`update public.void_requests set status='Rejected',reviewed_by=$1,reviewed_name='Owner',
    reviewed_role='Owner',reviewed_at=now(),decision_reason='Keep receipt' where id=$2`, [owner,request]);
  await rejected("update public.void_requests set decision_reason='Changed' where id=$1", /final decision/, [request]);
  await db.query(insert,[receipt,owner]);
  assert.equal(await scalar('select count(*)::int from public.void_requests where sale_id=$1', [receipt]), 2);
});

test('review reconciliation requires explanation, records receipt verification once and remains immutable', async () => {
  await actor();
  const receipt = await sale();
  const insert = `insert into public.daily_sales_reviews(business_date,owner_id,owner_name,expected_cash,expected_gcash,
    verified_cash,verified_gcash,counted_cash,opening_cash,additions,removals,refunds,explanation,outcome,operation_id)
    values ('2026-01-02',$1,'Original Owner',56,0,$2,0,56,0,0,0,0,$3,$4,$5) returning id`;
  await rejected(insert,/check constraint/, [owner,50,'','Reviewed with explained discrepancy',randomUUID()]);
  await rejected(insert,/check constraint/, [owner,50,'Explained','Matched',randomUUID()]);
  const review = String(await scalar(insert, [owner,56,'','Matched',randomUUID()]));
  await db.query('insert into public.daily_sales_review_items values ($1,$2,true,56)', [review,receipt]);
  const other = String(await scalar(insert, [owner,56,'','Matched',randomUUID()]));
  await rejected('insert into public.daily_sales_review_items values ($1,$2,true,56)',/unique/,[other,receipt]);
  await rejected("update public.daily_sales_reviews set explanation='Rewritten'", /append-only/);
});

test('development seed is guarded and opt-in catalogue fixtures create no users, sales or pretend balances', async () => {
  const seed = await readFile(new URL('seeds/development.sql', sqlRoot),'utf8');
  // Strip only the transaction envelope so the fixture participates in this test's rollback.
  const seedBody = seed.replace(/^begin;$/m,'').replace(/^commit;$/m,'');
  await rejected(seedBody,/Development seed disabled/);
  await db.exec("set local vertwell.allow_development_seed='on'");
  await db.exec(seedBody);
  await db.exec('set constraints all immediate');
  assert.equal(await scalar('select count(*)::int from public.products'),2);
  assert.equal(await scalar('select count(*)::int from public.profiles'),0);
  assert.equal(await scalar('select count(*)::int from auth.users'),0);
  assert.equal(await scalar('select count(*)::int from public.sales'),0);
  assert.equal(await scalar('select count(*)::int from public.stock_movements'),0);
});

test('migrations reproduce a second database and durable records survive close/reopen', async () => {
  const reviewRoot = new URL('../../.review/', import.meta.url);
  await mkdir(reviewRoot,{recursive:true});
  const path = await mkdtemp(fileURLToPath(new URL('database-',reviewRoot)));
  let persistent = new PGlite(path);
  try {
    await initialize(persistent);
    await persistent.exec("insert into public.skus(value) values ('DURABLE-LOCAL-CHECK')");
    await persistent.close();
    persistent = new PGlite(path);
    const result = await persistent.query<{ value: string }>('select value from public.skus');
    assert.equal(result.rows[0]?.value,'DURABLE-LOCAL-CHECK');
    assert.equal((await persistent.query<{ count: number }>('select count(*)::int from public.inventory_units')).rows[0]?.count,6);
  } finally { await persistent.close(); }
  // Retain this disposable local verification artifact under ignored .review/.
});
