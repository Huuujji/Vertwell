import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { integrationSchemaSource } from '../../../backend/scripts/integration-schema';
import { createApiClient, ApiError } from '../../src/lib/api-client';
import { databaseSchema } from '../../src/lib/data/database.generated';
import { inventoryTables, pendingBusinessData } from '../../src/lib/data/contracts';
import { mapAccounts, mapInventory } from '../../src/lib/data/mappers';
import { displayDecimal } from '../../src/lib/data/decimal';
import { createManagementData } from '../../src/lib/data/management';
import { usableQuantity, requirements } from '../../src/data/inventory';

const database = new PGlite();
let snapshot: Record<string, any>;
const sqlRoot = new URL('../../../backend/supabase/', import.meta.url);
const bean = '20000000-0000-4000-8000-000000000001';
const sleeve = '20000000-0000-4000-8000-000000000002';
const coffee = '30000000-0000-4000-8000-000000000002';
let bundle: string, variantProduct: string, copyGroup: string, libraryGroup: string;
async function id(sql: string, values: unknown[] = []) {
  return (await database.query<{ id: string }>(sql, values)).rows[0]!.id;
}
before(async () => {
  await database.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key, email text, raw_app_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  for (const file of (await readdir(new URL('migrations/', sqlRoot))).filter(file => file.endsWith('.sql')).sort()) {
    await database.exec(await readFile(new URL(`migrations/${file}`, sqlRoot), 'utf8'));
  }
  await database.exec(`set vertwell.allow_development_seed = 'on'`);
  await database.exec(await readFile(new URL('seeds/development.sql', sqlRoot), 'utf8'));
  const actor = '00000000-0000-4000-8000-000000000001';
  await database.query('insert into auth.users values ($1)', [actor]);
  await database.query("insert into profiles(id,full_name,username,role) values ($1,'Test Owner','test-owner','Owner')", [actor]);
  await database.query("update stock_items set unit_code='kg' where id=$1", [bean]);
  await database.query("update stock_batches set manufactured_on='2026-01-01',expires_on='2100-01-01' where stock_item_id=$1", [bean]);
  for (const [stock, quantity] of [[bean, '1250.500000'], [sleeve, '10.000000']]) {
    await database.query(`insert into stock_movements(batch_id,kind,quantity_base,actor_id,actor_name,actor_role,reason,operation_id)
      select id,'Opening',$2,$3,'Test Owner','Owner','Disposable mapping test',gen_random_uuid() from stock_batches where stock_item_id=$1`, [stock, quantity, actor]);
  }
  const expired = await id("insert into stock_batches(stock_item_id,manufactured_on,expires_on) values ($1,'1999-01-01','2000-01-01') returning id", [bean]);
  await database.query(`insert into stock_movements(batch_id,kind,quantity_base,actor_id,actor_name,actor_role,reason,operation_id)
    values ($1,'Opening',500,$2,'Test Owner','Owner','Old stock fixture',gen_random_uuid())`, [expired, actor]);
  async function product(name: string, model: string) {
    const sku = await id('insert into skus(value) values ($1) returning id', [`TEST-${name}`]);
    return id('insert into products(sku_id,name,category,stock_model,base_price) values ($1,$2,\'Hobby\',$3,100) returning id', [sku, name, model]);
  }
  variantProduct = await product('Variant', 'Variants');
  const variant = await id('insert into product_variants(product_id,stock_item_id,name,price) values ($1,$2,\'Standard\',125.50) returning id', [variantProduct, sleeve]);
  libraryGroup = await id("insert into modifier_groups(name) values ('Omission library') returning id");
  copyGroup = await id("insert into modifier_groups(product_id,source_group_id,name) values ($1,$2,'Independent copy') returning id", [coffee, libraryGroup]);
  const option = await id("insert into modifier_options(group_id,name,price,default_selected) values ($1,'No beans',0,true) returning id", [copyGroup]);
  await database.query('insert into modifier_stock_inputs(option_id,stock_item_id,quantity,unit_code) values ($1,$2,-18,\'g\')', [option, bean]);
  bundle = await product('Bundle', 'Bundle');
  const component = await id('insert into bundle_components(bundle_product_id,component_product_id,quantity,position) values ($1,$2,2,1) returning id', [bundle, coffee]);
  await database.query('insert into bundle_component_modifiers values ($1,$2)', [component, option]);
  await database.query('insert into bundle_components(bundle_product_id,component_product_id,variant_id,quantity,position) values ($1,$2,$3,1,2)', [bundle, variantProduct, variant]);
  await database.query('insert into bundle_components(bundle_product_id,stock_item_id,quantity,position) values ($1,$2,1,3)', [bundle, sleeve]);
  const tables: Record<string, unknown> = {};
  for (const table of inventoryTables) {
    const columns = Object.entries(databaseSchema[table]).map(([name, [kind]]) => kind === 'decimal' ? `${name}::text as ${name}` : name).join(',');
    tables[table] = (await database.query(`select ${columns} from public.${table}`)).rows;
  }
  const balances = (await database.query(`select b.id as batch_id, coalesce(sum(m.quantity_base),0)::text as quantity_base
    from stock_batches b left join stock_movements m on m.batch_id=b.id group by b.id`)).rows;
  snapshot = JSON.parse(JSON.stringify({ version: 1, businessDate: '2026-10-17', tables, balances }));
});
after(async () => { await database.close(); });

test('generated contract exactly matches every migration schema', async () => {
  assert.equal(await readFile(new URL('../../src/lib/data/database.generated.ts', import.meta.url), 'utf8'), await integrationSchemaSource());
  assert.equal(Object.keys(databaseSchema).length, 25);
});
test('real SQL rows map all four stock models, relationships, fixed bundle options and independent copies', () => {
  const result = mapInventory(snapshot);
  assert.deepEqual(new Set(result.products.map(row => row.mode)), new Set(['Stocked', 'Made to order', 'Variants', 'Bundle']));
  const recipe = result.products.find(row => row.id === coffee)!;
  assert.equal(recipe.stockId, undefined);
  assert.equal(recipe.recipe![0].stockId, bean);
  assert.equal(recipe.modifiers![0].id, copyGroup);
  assert.equal(recipe.modifiers![0].options[0].inputs[0].quantity, -18);
  assert.equal(result.modifierTemplates[0].id, libraryGroup);
  assert.equal(result.modifierTemplates[0].name, 'Omission library');
  const kit = result.products.find(row => row.id === bundle)!;
  assert.equal(kit.bundle![0].productId, coffee);
  assert.equal(kit.bundle![0].modifierIds!.length, 1);
  assert.equal(kit.bundle![1].variantId, result.products.find(row => row.id === variantProduct)!.variants![0].id);
  assert.equal(kit.bundle![2].stockId, sleeve);
  const inputs = requirements(kit, [], undefined, result.products);
  assert.equal(inputs.filter(input => input.stockId === sleeve).reduce((sum, input) => sum + input.quantity, 0), 2);
  assert.equal(inputs.filter(input => input.stockId === bean).reduce((sum, input) => sum + input.quantity, 0), 0);
  assert.equal(recipe.code, undefined);
});
test('canonical ledger balances convert to display units without treating expired stock as usable', () => {
  const item = mapInventory(snapshot).stock.find(row => row.id === bean)!;
  assert.equal(item.unit, 'kg');
  assert.equal(item.quantity, 1.7505);
  assert.equal(item.threshold, 0.1);
  assert.equal(usableQuantity(item, '2026-10-17'), 1.2505);
  assert.equal(item.batches!.length, 2);
  assert.equal(mapInventory(snapshot).stock.find(row => row.id === sleeve)!.batches![0].expires, '');
});
test('SKU changes preserve IDs, manual enablement is independent of stock, and unlisted stock remains accessible', () => {
  const changed = structuredClone(snapshot);
  changed.tables.skus[0].value = 'EDITED-SKU';
  changed.tables.products.find((row: any) => row.id === coffee).enabled = false;
  changed.tables.products = changed.tables.products.filter((row: any) => row.id !== '30000000-0000-4000-8000-000000000001');
  const result = mapInventory(changed);
  assert.ok(result.stock.find(row => row.id === bean));
  assert.ok(result.stock.find(row => row.id === sleeve));
  assert.equal(result.stock.find(row => row.id === bean)!.sku, 'EDITED-SKU');
  assert.equal(result.products.find(row => row.id === coffee)!.available, false);
  assert.equal(usableQuantity(result.stock.find(row => row.id === bean)!, '2026-10-17'), 1.2505);
  assert.equal(result.products.length, 3);
});
test('incomplete, duplicate, incompatible and malformed responses fail instead of manufacturing balances', () => {
  for (const mutate of [
    (v: any) => v.balances.pop(), (v: any) => v.balances.push(v.balances[0]),
    (v: any) => v.balances[0].quantity_base = '-1', (v: any) => v.balances[0].quantity_base = 'NaN',
    (v: any) => v.tables.stock_items[0].unit_code = 'oz',
    (v: any) => v.tables.products[0].base_price = 50,
    (v: any) => v.tables.products[0].sku_id = 'missing',
    (v: any) => v.tables.products[0].stock_model = 'Unknown',
    (v: any) => v.tables.products.push(v.tables.products[0]),
    (v: any) => v.businessDate = '2026-02-30',
  ]) { const value = structuredClone(snapshot); mutate(value); assert.throws(() => mapInventory(value), ApiError); }
});
test('money and quantity mapping rejects excess scale and unsafe precision', () => {
  assert.equal(displayDecimal('125.50', 2), 125.5);
  assert.equal(displayDecimal('-18.000000', 6), -18);
  for (const value of ['NaN', 'Infinity', '1e3', '1.234', '900719925474099.99']) assert.throws(() => displayDecimal(value, 2), ApiError);
});
test('authorized account projection preserves Auth IDs and inactive status without passwords', () => {
  const result = mapAccounts([{ id: 'auth-id', full_name: 'Account', username: 'account', role: 'Admin', active: false,
    created_at: '2026-10-17T00:00:00Z', updated_at: '2026-10-17T00:00:00Z', email: 'test@example.com', password: 'must-not-pass-through' }]);
  assert.equal(result[0].id, 'auth-id');
  assert.equal(result[0].active, false);
  assert.equal('password' in result[0], false);
  assert.throws(() => mapAccounts([{ id: 'incomplete' }]), ApiError);
});
test('business data remains unavailable without making network requests', async () => {
  await assert.rejects(pendingBusinessData.inventory, (error: ApiError) => error.kind === 'unavailable');
  await assert.rejects(pendingBusinessData.accounts, (error: ApiError) => error.kind === 'unavailable');
});

test('management commands preserve exact canonical quantities and the original operation after a lost response', async () => {
  const source={...snapshot,revision:'4'} as any, row=mapInventory(source).stock.find(item=>item.id===bean)!;
  const commands:any[]=[];
  const service=createManagementData(createApiClient({accessToken:async()=> 'verified-session',fetcher:async(_url,init)=>{
    assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer verified-session');
    const command=JSON.parse(String(init?.body));commands.push(command);
    if(commands.length===1)throw new TypeError('lost response');
    return Response.json({inventory:source,entityId:row.id,operationId:command.operationId});
  }}));
  await assert.rejects(()=>service.saveStock(source,row,{reason:'Counted physical stock'}),(error:ApiError)=>error.kind==='network');
  await service.saveStock(source,row,{reason:'Counted physical stock'});
  assert.deepEqual(commands[0],commands[1]);
  assert.equal(commands[0].record.batches.find((batch:any)=>batch.quantityBase==='1250.500000').quantityBase,'1250.500000');
  assert.equal('actor' in commands[0],false);assert.equal('quantity' in commands[0].record,false);
});
test('a definite conflict releases its operation so a reviewed fresh revision can save, while excess display precision never reaches the API',async()=>{
  const source={...snapshot,revision:'4'} as any,row=mapInventory(source).stock.find(item=>item.id===bean)!;
  const commands:any[]=[];
  const service=createManagementData(createApiClient({fetcher:async(_url,init)=>{
    const command=JSON.parse(String(init?.body));commands.push(command);
    return commands.length===1?Response.json({error:{message:'Inventory changed'}},{status:409}):Response.json({inventory:source,entityId:row.id});
  }}));
  await assert.rejects(()=>service.saveStock(source,row),(error:ApiError)=>error.kind==='conflict');
  await service.saveStock({...source,revision:'5'},row);assert.equal(commands[1].revision,'5');assert.notEqual(commands[0].operationId,commands[1].operationId);
  const calls=commands.length;
  await assert.rejects(()=>service.saveStock(source,{...row,threshold:0.0000001}),(error:ApiError)=>error.kind==='validation');
  assert.equal(commands.length,calls);
});
test('API transport uses the session token, supports 204, signals and disables cache/redirects', async () => {
  const controller = new AbortController();
  const request = createApiClient({ baseUrl: 'https://example.test/', accessToken: async () => 'session-token', fetcher: async (url, init) => {
    assert.equal(url, 'https://example.test/api/test');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer session-token');
    assert.equal(init?.signal, controller.signal);
    assert.equal(init?.cache, 'no-store');
    assert.equal(init?.redirect, 'error');
    return new Response(null, { status: 204 });
  } });
  assert.equal(await request('/api/test', { signal: controller.signal, headers: { authorization: 'Bearer caller-role' } }), undefined);
});
test('API errors preserve validation fields, access denials and conflict status without retries', async () => {
  for (const [status, kind] of [[400, 'validation'], [422, 'validation'], [401, 'unauthorized'], [403, 'forbidden'], [404, 'not-found'], [409, 'conflict'], [503, 'server']] as const) {
    let calls = 0;
    const request = createApiClient({ fetcher: async () => { calls++; return Response.json({ error: { message: 'Rejected', fields: { sku: 'Already used', ignored: 42 } } }, { status }); } });
    await assert.rejects(() => request('/api/test', { method: 'POST', body: '{}' }), (error: ApiError) => error.kind === kind && error.status === status && error.fields.sku === 'Already used' && !('ignored' in error.fields));
    assert.equal(calls, 1);
  }
});
test('API handles offline, cancellation, malformed success and HTML access denial responses', async () => {
  for (const [fetcher, kind] of [
    [async () => { throw new TypeError('offline'); }, 'network'],
    [async () => { throw new DOMException('aborted', 'AbortError'); }, 'cancelled'],
    [async () => new Response('<html>Vite</html>'), 'response'],
    [async () => new Response('<html>Forbidden</html>', { status: 403 }), 'forbidden'],
  ] as const) {
    await assert.rejects(() => createApiClient({ fetcher })('/api/test'), (error: ApiError) => error.kind === kind);
  }
});
