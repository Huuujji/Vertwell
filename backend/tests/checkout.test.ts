import { before,after,test } from 'node:test';
import { readFile,readdir,mkdir,mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { testRealtime } from '../scripts/test-realtime.js';
import { checkoutScenarios,checkoutFixture,checkoutValue,checkoutAs } from '../scripts/checkout-checks.js';
import { stockRecord,productRecord } from '../scripts/inventory-checks.js';
import { randomUUID } from 'node:crypto';
async function initialize(db:PGlite) {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await testRealtime(db);
  const root=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(root)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,root),'utf8'));
}
const db=new PGlite();before(()=>initialize(db));after(()=>db.close());
for(const scenario of checkoutScenarios)test(scenario.name,async()=>{await db.query('begin');try{await scenario.run(db);}finally{await db.query('rollback');}});
test('POS stock feedback is read-only, whole-cart scoped and respects unit conversion, omissions and excluded stock',async()=>{
  await db.query('begin');try{
    const f=await checkoutFixture(db),ingredient=stockRecord({kind:'Ingredient',category:'Food',unit:'kg',name:'Feedback flour',batches:[
      {id:randomUUID(),quantityBase:'5000',manufactured:'2020-01-01',expires:'2090-01-01',unsellable:false},
      {id:randomUUID(),quantityBase:'10000',manufactured:'2020-01-01',expires:'2020-01-02',unsellable:false},
      {id:randomUUID(),quantityBase:'10000',manufactured:'2020-01-01',expires:'2090-01-01',unsellable:true}]}),
      unrelated=stockRecord({name:'Private unrelated stock'});
    await f.save('stock.save',ingredient);await f.save('stock.save',unrelated);
    const option={id:randomUUID(),name:'Omit flour',price:'0',defaultSelected:false,inputs:[{stockId:ingredient.id,quantity:'-2',unit:'kg'}]};
    const recipe=productRecord(ingredient,{sku:`FB-${randomUUID()}`,name:'Feedback recipe',model:'Recipe',category:'Food',stockId:null,manufactured:'2020-01-01',expires:'2090-01-01',
      recipe:[{stockId:ingredient.id,quantity:'1000',unit:'g'}],groups:[{id:randomUUID(),name:'Choice',min:'0',max:'1',options:[option]}]});
    await f.save('product.save',recipe);
    const before=await checkoutValue(db,'select public.read_inventory() as value');
    const feedback=async(lines:any[])=>checkoutValue(db,'select public.read_checkout_stock($1::jsonb) as value',[JSON.stringify(lines)]);
    for(const actor of [f.actors.owner,f.actors.admin,f.actors.staff]){
      await checkoutAs(db,actor);
      const data=await feedback([f.line(recipe,{quantity:'3'}),f.line(recipe,{quantity:'1'})]);
      assert.deepEqual(data.maximums,[4,2]);assert.equal(data.stocks.length,1);assert.equal(data.stocks[0].stockId,ingredient.id);
      assert.equal(Number(data.stocks[0].usable),5);assert.equal(Number(data.stocks[0].required),4);assert.equal(Number(data.stocks[0].remaining),1);
      assert.deepEqual(data.stocks[0].lineNeeds.map(Number),[3,1]);assert.equal(data.stocks[0].unit,'kg');assert.equal('batches' in data.stocks[0],false);
      const short=await feedback([f.line(recipe,{quantity:'6'})]);assert.equal(Number(short.stocks[0].remaining),-1);assert.deepEqual(short.maximums,[5]);
      const omitted=await feedback([f.line(recipe,{quantity:'100',modifierIds:[option.id]}),f.line(recipe)]);assert.deepEqual(omitted.maximums,[10000,5]);
      const catalogue=await checkoutValue(db,'select public.read_checkout_catalogue_stock() as value');assert.equal(Number(catalogue.items.find((p:any)=>p.id===f.product.id).usableQuantity),10);
    }
    await checkoutAs(db,f.actors.owner);assert.deepEqual(await checkoutValue(db,'select public.read_inventory() as value'),before);
    for(const [actor,role] of [[f.actors.inactive,'authenticated'],['','anon'],['','service_role']]){
      await checkoutAs(db,actor!,role);await db.query('savepoint denied_feedback');
      await assert.rejects(()=>feedback([f.line()]),(error:any)=>error.code==='42501');await db.query('rollback to savepoint denied_feedback');
      await assert.rejects(()=>checkoutValue(db,'select public.read_checkout_catalogue_stock() as value'),(error:any)=>error.code==='42501');await db.query('rollback to savepoint denied_feedback');
    }
    await checkoutAs(db,f.actors.staff);await db.query('savepoint invalid_feedback');
    await assert.rejects(()=>feedback([{stockId:unrelated.id,quantity:'1'}]));await db.query('rollback to savepoint invalid_feedback');
    await assert.rejects(()=>feedback([f.line(f.product,{quantity:'10001'})]));await db.query('rollback to savepoint invalid_feedback');
  }finally{await db.query('rollback');}
});
test('P6 purchased receipt and stock ledger survive a disk database close/reopen',async()=>{
  const parent=fileURLToPath(new URL('../../../.review/',import.meta.url));await mkdir(parent,{recursive:true});
  const path=await mkdtemp(`${parent}p6-database-`);let disk=new PGlite(path);
  try {
    await initialize(disk);await disk.query('begin');const f=await checkoutFixture(disk);const r=await f.checkout(await f.command());
    await disk.query('commit');await disk.close();disk=new PGlite(path);
    const saved=await checkoutValue(disk,'select receipt as value from private.checkout_operations where sale_id=$1',[r.saleId]);
    assert.deepEqual(saved,r);assert.equal(Number(await checkoutValue(disk,'select sum(quantity_base)::text as value from public.stock_movements where batch_id=$1',[f.stock.batches[0].id])),9);
  } finally {await disk.close();}
});
