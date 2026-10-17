import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { PermissionDatabase } from './permission-checks.js';
import { productRecord, stockRecord } from './inventory-checks.js';

type DB = PermissionDatabase;
export async function checkoutAs(db:DB,id:string,role='authenticated') {
  await db.query('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.query(`set local role ${role}`);
}
export async function checkoutValue(db:DB,sql:string,params:any[]=[]) {return (await db.query(sql,params)).rows[0]?.value;}
async function rejects(db:DB,run:()=>Promise<unknown>,code?:string) {
  await db.query('savepoint invalid_checkout');
  try {if(code)await assert.rejects(run,(error:any)=>error.code===code);else await assert.rejects(run);}
  finally {await db.query('rollback to savepoint invalid_checkout');await db.query('release savepoint invalid_checkout');}
}
export async function checkoutFixture(db:DB) {
  await db.query('reset role');
  await db.query('update private.checkout_state set enabled=true where singleton');
  const actors={owner:randomUUID(),admin:randomUUID(),staff:randomUUID(),other:randomUUID(),inactive:randomUUID()};
  for(const [name,id] of Object.entries(actors)) {
    await db.query('insert into auth.users(id,email) values($1,$2)',[id,`${id}@example.invalid`]);
    await db.query('insert into public.profiles(id,full_name,username,role,active) values($1,$2,$3,$4,$5)',
      [id,`P6 ${name}`,`p6-${id}`,name==='owner'?'Owner':name==='admin'?'Admin':'Staff',name!=='inactive']);
  }
  await checkoutAs(db,actors.owner);
  const save=async(kind:string,record:any,extra:any={})=>checkoutValue(db,'select public.inventory_command($1::jsonb) as value',
    [JSON.stringify({kind,record,...extra,revision:(await checkoutValue(db,'select public.read_inventory() as value')).revision,operationId:randomUUID(),reason:'P6 verification'})]);
  const stock=stockRecord({name:'P6 finished'}), product=productRecord(stock,{name:'P6 retail'});
  await save('product.save',product,{stock});
  const line=(p=product,overrides:any={})=>({productId:p.id,variantId:null,modifierIds:[],quantity:'1',...overrides});
  const quote=(lines=[line()])=>checkoutValue(db,'select public.quote_checkout($1::jsonb) as value',[JSON.stringify(lines)]);
  const command=async(lines=[line()],overrides:any={})=>{
    const q=await quote(lines);return {operationId:randomUUID(),revision:q.revision,quoteToken:q.quoteToken,lines,payment:{method:'Cash',amount:q.total,cashTendered:'10000.00'},...overrides};
  };
  const checkout=(request:any)=>checkoutValue(db,'select public.checkout($1::jsonb) as value',[JSON.stringify(request)]);
  const balance=()=>checkoutValue(db,'select coalesce(sum(quantity_base),0)::text as value from public.stock_movements where batch_id=$1',[stock.batches[0].id]);
  return {actors,save,stock,product,line,quote,command,checkout,balance};
}
export const checkoutScenarios:{name:string;run(db:DB):Promise<void>}[]=[
  {name:'P6 activation stays closed to application roles; disabled checkout can reconcile an already committed operation',async run(db){
    const f=await checkoutFixture(db),request=await f.command();
    await rejects(db,()=>db.query('update private.checkout_state set enabled=true where singleton'),'42501');
    await db.query('reset role');await db.query('update private.checkout_state set enabled=false where singleton');await checkoutAs(db,f.actors.owner);
    assert.equal((await checkoutValue(db,'select public.business_access() as value')).services.checkout,false);
    await rejects(db,()=>f.checkout(request),'55000');
    await db.query('reset role');await db.query('update private.checkout_state set enabled=true where singleton');await checkoutAs(db,f.actors.owner);
    const r=await f.checkout(request);await db.query('reset role');await db.query('update private.checkout_state set enabled=false where singleton');await checkoutAs(db,f.actors.owner);
    assert.equal((await f.checkout(request)).saleId,r.saleId);
  }},
  {name:'P6 Owner/Admin/Staff record authoritative receipts and consume exactly once under their real role',async run(db) {
    const f=await checkoutFixture(db);
    for(const role of ['owner','admin','staff'] as const) {
      await checkoutAs(db,f.actors[role]);const request=await f.command();const r=await f.checkout(request);
      assert.equal(r.status,role==='owner'?'Completed':'Pending');assert.equal(r.stockCommitted,true);
      assert.equal(Number(r.total),14);assert.equal(r.cashierId,f.actors[role]);
      assert.equal(r.reviewState,role==='owner'?'Owner checkout':'Awaiting Owner review');
      assert.equal(r.providerVerified,false);assert.equal(r.lines[0].unitPrice,'12.50');
      assert.ok(!('usage' in r.lines[0]));
      const replay=await f.checkout(request);assert.equal(replay.saleId,r.saleId);assert.equal(replay.replayed,true);
    }
    await db.query('reset role');assert.equal(Number(await f.balance()),7);
    assert.equal(await checkoutValue(db,'select count(*)::int as value from public.payments where sale_id in (select sale_id from private.checkout_operations where actor_id=any($1::uuid[]))',[Object.values(f.actors)]),3);
    assert.equal(await checkoutValue(db,"select count(*)::int as value from public.audit_events where event_type='Checkout recorded' and actor_id=any($1::uuid[])",[Object.values(f.actors)]),3);
  }},
  {name:'P6 inactive, anonymous and service roles cannot quote, browse configurations or checkout; spoofed actors are rejected',async run(db) {
    const f=await checkoutFixture(db),request=await f.command();
    for(const [id,role] of [[f.actors.inactive,'authenticated'],['','anon'],['','service_role']]) {
      await checkoutAs(db,id!,role);await rejects(db,()=>f.quote(),'42501');
      await rejects(db,()=>checkoutValue(db,'select public.read_checkout_catalogue() as value'),'42501');await rejects(db,()=>f.checkout(request),'42501');
    }
    await checkoutAs(db,f.actors.staff);await rejects(db,()=>f.checkout({...request,cashierId:f.actors.owner}),'22023');
    await db.query('reset role');assert.equal(Number(await f.balance()),10);
  }},
  {name:'P6 whole-cart shared demand rejects overselling without sales, payments, movements, receipts or revision residue',async run(db) {
    const f=await checkoutFixture(db);const before=await checkoutValue(db,'select public.read_inventory() as value');
    await rejects(db,()=>f.quote([f.line(f.product,{quantity:'6'}),f.line(f.product,{quantity:'5'})]),'PT409');
    for(const quantity of ['0','-1','1.5','10001',1])await rejects(db,()=>f.quote([f.line(f.product,{quantity})]));
    await rejects(db,()=>f.quote([f.line(f.product,{price:'0'})]),'22023');
    assert.deepEqual(await checkoutValue(db,'select public.read_inventory() as value'),before);
  }},
  {name:'P6 FEFO allocation spans batches and excludes expired, unsellable and archived stock',async run(db) {
    const f=await checkoutFixture(db);
    f.stock.batches=[{...f.stock.batches[0],quantityBase:'2',manufactured:'2020-01-01',expires:'2090-01-01'},
      {id:randomUUID(),quantityBase:'2',manufactured:'2020-01-01',expires:'2080-01-01',unsellable:false},
      {id:randomUUID(),quantityBase:'100',manufactured:'2020-01-01',expires:'2020-01-02',unsellable:false},
      {id:randomUUID(),quantityBase:'100',manufactured:null,expires:null,unsellable:true}];
    await f.save('stock.save',f.stock);await rejects(db,()=>f.quote([f.line(f.product,{quantity:'5'})]),'PT409');
    const r=await f.checkout(await f.command([f.line(f.product,{quantity:'3'})]));
    await db.query('reset role');const movements=(await db.query('select batch_id,quantity_base::text as quantity from public.stock_movements where operation_id=$1 order by operation_line',[r.operationId])).rows;
    assert.deepEqual(movements,[{batch_id:f.stock.batches[1].id,quantity:'-2.000000'},{batch_id:f.stock.batches[0].id,quantity:'-1.000000'}]);
  }},
  {name:'P6 recipe conversion and signed omissions clamp per line, never cancel another purchased line',async run(db) {
    const f=await checkoutFixture(db),ingredient=stockRecord({kind:'Ingredient',category:'Food',unit:'kg',name:'P6 flour',batches:[{id:randomUUID(),quantityBase:'5000',manufactured:'2020-01-01',expires:'2090-01-01',unsellable:false}]});
    await f.save('stock.save',ingredient);
    const option={id:randomUUID(),name:'Omit flour',price:'0',defaultSelected:false,inputs:[{stockId:ingredient.id,quantity:'-2',unit:'kg'}]};
    const p=productRecord(ingredient,{sku:`P6-${randomUUID()}`,name:'P6 recipe',model:'Recipe',category:'Food',manufactured:'2020-01-01',expires:'2090-01-01',stockId:null,
      recipe:[{stockId:ingredient.id,quantity:'1000',unit:'g'}],groups:[{id:randomUUID(),name:'Choice',min:'0',max:'1',options:[option]}]});
    await f.save('product.save',p);
    const cards=await checkoutValue(db,'select public.read_checkout_catalogue() as value');assert.equal(cards.items.find((c:any)=>c.id===p.id).available,true);
    const candidate=await checkoutValue(db,'select public.check_checkout_product($1,$2::jsonb) as value',[p.id,JSON.stringify([f.line(p,{quantity:'5'})])]);
    // A valid omission can still make one additional configured unit available.
    assert.equal(candidate.available,true);
    const r=await f.checkout(await f.command([f.line(p,{modifierIds:[option.id],quantity:'2'}),f.line(p)]));
    await db.query('reset role');const usage=await checkoutValue(db,'select sum(quantity_base)::text as value from public.sale_item_stock_usage where sale_item_id in (select id from public.sale_items where sale_id=$1)',[r.saleId]);
    assert.equal(Number(usage),1000);
  }},
  {name:'P6 variants, nested bundles, fixed options and shared component demand resolve and snapshot together',async run(db) {
    const f=await checkoutFixture(db),v={id:randomUUID(),name:'Large',stockId:f.stock.id,price:'25.50',enabled:true};
    const option={id:randomUUID(),name:'Extra piece',price:'2',defaultSelected:false,inputs:[{stockId:f.stock.id,quantity:'1',unit:'pcs'}]};
    const variants=productRecord(f.stock,{sku:`P6-${randomUUID()}`,stockId:null,model:'Variants',variants:[v],groups:[{id:randomUUID(),name:'Extras',min:'1',max:'1',options:[option]}]});
    await f.save('product.save',variants);
    const bundle=productRecord(f.stock,{sku:`P6-${randomUUID()}`,stockId:null,model:'Bundle',bundle:[{productId:variants.id,stockId:null,variantId:v.id,quantity:'2',modifierIds:[option.id]}]});
    await f.save('product.save',bundle);
    const nested=productRecord(f.stock,{sku:`P6-${randomUUID()}`,stockId:null,model:'Bundle',bundle:[{productId:bundle.id,stockId:null,variantId:null,quantity:'2',modifierIds:[]}]});
    await f.save('product.save',nested);
    await rejects(db,()=>f.quote([f.line(variants)]),'22023');await rejects(db,()=>f.quote([f.line(variants,{variantId:v.id,modifierIds:[randomUUID()]})]),'22023');
    const r=await f.checkout(await f.command([f.line(nested)]));
    assert.equal(r.lines[0].components[0].configuration.components[0].configuration.modifiers[0].name,'Extra piece');
    await db.query('reset role');assert.equal(Number(await f.balance()),2);
    await checkoutAs(db,f.actors.owner);v.enabled=false;await f.save('product.save',variants);
    await rejects(db,()=>f.quote([f.line(nested)]),'22023');
  }},
  {name:'P6 fixed and percentage discounts, modifier prices and VAT are recalculated to exact cents',async run(db) {
    const f=await checkoutFixture(db);f.product.price='0.05';f.product.discountType='Percentage';f.product.discountValue='10';await f.save('product.save',f.product);
    let q=await f.quote([f.line(f.product,{quantity:'3'})]);assert.equal(Number(q.subtotal),0.15);assert.equal(Number(q.tax),0.02);assert.equal(Number(q.total),0.17);
    f.product.price='12.50';f.product.discountType='Fixed';f.product.discountValue='2.50';await f.save('product.save',f.product);
    q=await f.quote();assert.equal(Number(q.total),11.20);
    const request=await f.command();await rejects(db,()=>f.checkout({...request,payment:{method:'Cash',amount:'0.01',cashTendered:'100'}}),'22023');
  }},
  {name:'P6 stale quotes, catalogue edits and checkout-versus-correction revisions conflict without residue',async run(db) {
    const f=await checkoutFixture(db),request=await f.command();f.product.price='20';await f.save('product.save',f.product);
    await rejects(db,()=>f.checkout(request),'PT409');
    const q=await f.quote();await rejects(db,()=>f.checkout({...request,revision:q.revision}),'PT409');
    const r=await f.checkout(await f.command());assert.equal(Number(r.total),22.4);
    const receipt=await f.checkout(await f.command());assert.notEqual(receipt.saleId,r.saleId);
  }},
  {name:'P6 idempotency binds actor and complete content; retry after price edits returns original purchased snapshot',async run(db) {
    const f=await checkoutFixture(db),request=await f.command(),r=await f.checkout(request);
    await rejects(db,()=>f.checkout({...request,payment:{...request.payment,cashTendered:'20000.00'}}),'PT409');
    await checkoutAs(db,f.actors.other);await rejects(db,()=>f.checkout(request),'PT409');
    await checkoutAs(db,f.actors.owner);f.product.name='Renamed';f.product.price='99';await f.save('product.save',f.product);
    const replay=await f.checkout(request);assert.equal(replay.lines[0].name,'P6 retail');assert.equal(replay.total,r.total);assert.equal(replay.saleId,r.saleId);
    await db.query('reset role');assert.equal(Number(await f.balance()),9);
  }},
  {name:'P6 receipt reads enforce Staff ownership/day and active profiles without exposing operation storage',async run(db){
    const f=await checkoutFixture(db);await checkoutAs(db,f.actors.staff);const request=await f.command(),r=await f.checkout(request);
    const read=()=>checkoutValue(db,'select public.read_checkout_receipt($1) as value',[r.saleId]);
    assert.equal((await read()).saleId,r.saleId);await rejects(db,()=>db.query('select * from private.checkout_operations'),'42501');
    await checkoutAs(db,f.actors.other);await rejects(db,read,'42501');await checkoutAs(db,f.actors.admin);assert.equal((await read()).saleId,r.saleId);
    await db.query('reset role');await db.query('update public.profiles set active=false where id=$1',[f.actors.staff]);await checkoutAs(db,f.actors.staff);
    await rejects(db,read,'42501');await rejects(db,()=>f.checkout(request),'42501');
  }},
  {name:'P6 large configuration spaces report unknown card availability while exact quotes remain usable',async run(db){
    const f=await checkoutFixture(db);const options=Array.from({length:13},(_,i)=>({id:randomUUID(),name:`Choice ${i}`,price:'0',defaultSelected:false,inputs:[]}));
    f.product.groups=[{id:randomUUID(),name:'Many choices',min:'0',max:'13',options}];await f.save('product.save',f.product);
    const catalogue=await checkoutValue(db,'select public.read_checkout_catalogue() as value');assert.equal(catalogue.items.find((p:any)=>p.id===f.product.id).available,null);
    assert.equal(Number((await f.quote([f.line(f.product,{modifierIds:[options[0]!.id]})])).total),14);
  }},
  {name:'P6 POS image helper permits only active selling-product references and revokes access after disablement',async run(db){
    const f=await checkoutFixture(db),path=`${f.actors.owner}/${randomUUID()}.png`;
    await db.query('reset role');await db.query('update public.products set image_path=$1 where id=$2',[path,f.product.id]);await checkoutAs(db,f.actors.staff);
    const allowed=()=>checkoutValue(db,'select private.pos_image_allowed($1) as value',[path]);assert.equal(await allowed(),true);
    assert.equal(await checkoutValue(db,'select private.pos_image_allowed($1) as value',[`${f.actors.owner}/${randomUUID()}.png`]),false);
    await db.query('reset role');await db.query('update public.products set enabled=false where id=$1',[f.product.id]);await checkoutAs(db,f.actors.staff);assert.equal(await allowed(),false);
    await checkoutAs(db,f.actors.inactive);assert.equal(await allowed(),false);
  }},
  {name:'P6 GCash references are unique recorded evidence; cash tender/change and field validation reject invalid payments',async run(db) {
    const f=await checkoutFixture(db);let request=await f.command();request.payment={method:'GCash',amount:'14.00',reference:'1234567890123'};
    const r=await f.checkout(request);assert.equal(r.providerVerified,false);assert.equal(r.reference,'1234567890123');
    request=await f.command();request.payment={method:'GCash',amount:'14.00',reference:'1234567890123'};await rejects(db,()=>f.checkout(request),'PT409');
    for(const payment of [{method:'Cash',amount:'14',cashTendered:'13'}, {method:'GCash',amount:'14',reference:'123'},
      {method:'Cash',amount:'14',cashTendered:'20',reference:'x'}, {method:'GCash',amount:'14',reference:'1234567890124',verified:true}])
      await rejects(db,()=>f.checkout({...request,operationId:randomUUID(),payment}),'22023');
    await db.query('reset role');assert.equal(Number(await f.balance()),9);
  }},
  {name:'P6 injected final audit failure rolls back receipt, payment, purchased snapshots, deductions and revision',async run(db) {
    const f=await checkoutFixture(db),request=await f.command(),before=await checkoutValue(db,'select public.read_inventory() as value');
    await db.query('reset role');await db.query(`create function private.p6_test_fail() returns trigger language plpgsql as $$begin
      if new.event_type='Checkout recorded' then raise exception 'P6 test audit failure';end if;return new;end$$;`);
    await db.query('create trigger p6_test_fail before insert on public.audit_events for each row execute function private.p6_test_fail()');
    await checkoutAs(db,f.actors.owner);await rejects(db,()=>f.checkout(request));assert.deepEqual(await checkoutValue(db,'select public.read_inventory() as value'),before);
    await db.query('reset role');assert.equal(await checkoutValue(db,'select count(*)::int as value from private.checkout_operations where operation_id=$1',[request.operationId]),0);
    assert.equal(await checkoutValue(db,'select count(*)::int as value from public.sales where idempotency_key=$1',[request.operationId]),0);
  }},
  {name:'P6 POS catalogue exposes choices and availability, including optional omissions, without recipes, batches or management data',async run(db) {
    const f=await checkoutFixture(db);await checkoutAs(db,f.actors.staff);
    let catalogue=await checkoutValue(db,'select public.read_checkout_catalogue() as value');let card=catalogue.items.find((r:any)=>r.id===f.product.id);
    assert.equal(card.available,true);assert.ok(!JSON.stringify(card).includes('stock_item_id'));assert.ok(!('usage' in card));assert.ok(!('batches' in card));
    await rejects(db,()=>db.query('select * from public.stock_items'),'42501');
    await f.checkout(await f.command([f.line(f.product,{quantity:'10'})]));
    catalogue=await checkoutValue(db,'select public.read_checkout_catalogue() as value');card=catalogue.items.find((r:any)=>r.id===f.product.id);assert.equal(card.available,false);
  }},
];
