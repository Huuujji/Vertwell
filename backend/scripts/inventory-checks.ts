import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { PermissionDatabase } from './permission-checks.js';

type DB = PermissionDatabase;
async function scalar(db: DB, sql: string, params: any[] = []) { return (await db.query(sql,params)).rows[0]?.value; }
async function as(db: DB, id: string, role='authenticated') {
  await db.query('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);
  await db.query(`set local role ${role}`);
}
async function reject(db: DB, run: ()=>Promise<unknown>, pattern=/./) {
  await db.query('savepoint invalid_inventory');
  try { await assert.rejects(run,pattern); }
  finally { await db.query('rollback to savepoint invalid_inventory'); await db.query('release savepoint invalid_inventory'); }
}
async function fixture(db: DB) {
  const actors = {owner:randomUUID(),admin:randomUUID(),staff:randomUUID(),inactive:randomUUID()};
  for (const [name,id] of Object.entries(actors)) {
    await db.query('insert into auth.users(id,email) values($1,$2)',[id,`${id}@example.invalid`]);
    await db.query('insert into public.profiles(id,full_name,username,role,active) values($1,$2,$3,$4,$5)',
      [id,`P5 ${name}`,`p5-${id}`,name==='owner'?'Owner':name==='admin'?'Admin':'Staff',name!=='inactive']);
  }
  await as(db,actors.owner);
  const read = () => scalar(db,'select public.read_inventory() as value');
  const command = async (kind: string, record: any, extras: any = {}) => {
    const revision=(await read()).revision;
    const request={operationId:randomUUID(),revision,kind,record,reason:'P5 verification',...extras};
    return {request,result:await scalar(db,'select public.inventory_command($1::jsonb) as value',[JSON.stringify(request)])};
  };
  return {actors,read,command};
}
export const stockRecord = (overrides: any={}) => ({id:randomUUID(),sku:`P5-${randomUUID()}`,name:`P5 stock ${randomUUID()}`,kind:'Finished',category:'Hobby',unit:'pcs',
  threshold:'2',unsellable:false,imagePath:null,batches:[{id:randomUUID(),quantityBase:'10',manufactured:null,expires:null,unsellable:false}],...overrides});
export const productRecord = (stock: any, overrides: any={}) => ({id:randomUUID(),sku:stock.sku,name:`P5 product ${randomUUID()}`,category:'Hobby',model:'Retail Item',price:'12.50',
  discountType:'None',discountValue:'0',enabled:true,imagePath:null,manufactured:null,expires:null,stockId:stock.id,recipe:[],variants:[],groups:[],bundle:[],...overrides});
const option = (overrides: any={}) => ({id:randomUUID(),name:'P5 choice',price:'1.00',defaultSelected:false,inputs:[],...overrides});
const group = (overrides: any={}) => ({id:randomUUID(),name:'P5 group',min:'0',max:'1',options:[option()],...overrides});

// Callers wrap every scenario in BEGIN/ROLLBACK; these never mutate real accounts.
export const inventoryScenarios: {name:string;run(db: DB):Promise<void>}[] = [
  {name:'Frontend priority: duplicate names require existing-stock receipts, zero starts/alerts fail, and positive measured fractions work',async run(db) {
    const f=await fixture(db),stock=stockRecord({name:'Priority stock'}),product=productRecord(stock,{name:'Priority product'});
    await f.command('product.save',product,{stock});const before=await f.read();
    await reject(db,()=>f.command('stock.save',stockRecord({name:'  PRIORITY   stock  '})),/already exists/);
    await reject(db,()=>f.command('product.save',productRecord(stock,{name:' priority PRODUCT '}),{stock}),/already exists/);
    await reject(db,()=>f.command('stock.save',stockRecord({threshold:'0'})),/positive/);
    await reject(db,()=>f.command('stock.save',stockRecord({batches:[{id:randomUUID(),quantityBase:'0',manufactured:null,expires:null,unsellable:false}]})),/positive/);
    assert.deepEqual(await f.read(),before);
    const measured=stockRecord({kind:'Ingredient',category:'Beverage',unit:'L',threshold:'500',batches:[{id:randomUUID(),quantityBase:'500',manufactured:'2026-10-01',expires:'2099-12-31',unsellable:false}]});
    const {result}=await f.command('stock.save',measured);
    assert.equal(Number(result.inventory.balances.find((b:any)=>b.batch_id===measured.batches[0].id).quantity_base),500);
    // A second delivery keeps the same SKU and identity and appends one batch.
    stock.batches.push({id:randomUUID(),quantityBase:'2',manufactured:null,expires:null,unsellable:false});
    const received=await f.command('stock.save',stock,{stockAction:'receive'});
    assert.equal(received.result.inventory.tables.stock_items.filter((s:any)=>s.id===stock.id).length,1);
    assert.equal(received.result.inventory.balances.filter((b:any)=>stock.batches.some((x:any)=>x.id===b.batch_id)).reduce((n:number,b:any)=>n+Number(b.quantity_base),0),12);
  }},
  {name:'Owner/Admin inventory snapshots and account lists are scoped; Staff/inactive/anon/service roles are denied',async run(db) {
    const f=await fixture(db);
    for (const id of [f.actors.owner,f.actors.admin]) {
      await as(db,id); const read=await f.read(); assert.equal(read.version,1); assert.ok(Array.isArray(read.tables.stock_items));
      const accounts=await scalar(db,'select public.read_managed_accounts() as value');
      assert.ok(accounts.some((a:any)=>a.id===f.actors.staff));
      if(id===f.actors.admin) assert.ok(!accounts.some((a:any)=>a.id===f.actors.owner));
      assert.ok(accounts.every((a:any)=>!('password' in a)));
    }
    for(const [id,role] of [[f.actors.staff,'authenticated'],[f.actors.inactive,'authenticated'],['','anon'],['','service_role']]) {
      await as(db,id!,role); await reject(db,f.read); await reject(db,()=>scalar(db,'select public.read_managed_accounts() as value'));
      await reject(db,()=>scalar(db,"select public.inventory_command('{}') as value"));
    }
  }},
  {name:'Retail aggregate reserves a shared SKU, canonical opening, coherent decimals and trusted audit atomically',async run(db) {
    const f=await fixture(db), stock=stockRecord(), product=productRecord(stock);
    const {result}=await f.command('product.save',product,{stock}); const read=result.inventory;
    assert.equal(read.tables.products.find((p:any)=>p.id===product.id).sku_id,read.tables.stock_items.find((s:any)=>s.id===stock.id).sku_id);
    assert.equal(read.balances.find((b:any)=>b.batch_id===stock.batches[0].id).quantity_base,'10.000000');
    assert.equal(read.tables.products.find((p:any)=>p.id===product.id).base_price,'12.50');
    await db.query('reset role');
    const audit=(await db.query('select actor_id,actor_name,actor_role from public.audit_events where operation_id=$1',[result.operationId])).rows;
    assert.ok(audit.length>=3); assert.ok(audit.every(a=>a.actor_id===f.actors.owner&&a.actor_role==='Owner'));
  }},
  {name:'Receipts, per-batch corrections and removals append movements; exact replay cannot deduct twice',async run(db) {
    const f=await fixture(db), stock=stockRecord(); await f.command('stock.save',stock);
    const second={id:randomUUID(),quantityBase:'7',manufactured:null,expires:null,unsellable:false};
    stock.batches.push(second); await f.command('stock.save',stock);
    stock.batches[0].quantityBase='4'; await f.command('stock.save',stock);
    stock.batches=stock.batches.filter((b:any)=>b.id!==second.id);
    const {request,result}=await f.command('stock.save',stock);
    const replay=await scalar(db,'select public.inventory_command($1) as value',[JSON.stringify(request)]);
    assert.equal(replay.replayed,true); assert.equal(replay.inventory.revision,result.inventory.revision);
    await db.query('reset role');
    assert.deepEqual((await db.query('select kind,quantity_base::text from public.stock_movements where batch_id=$1 order by created_at,id',[second.id])).rows.map(x=>`${x.kind}:${x.quantity_base}`).sort(),['Opening:0.000000','Receipt:7.000000','Removal:-7.000000'].sort());
    assert.ok((await db.query('select archived_at from public.stock_batches where id=$1',[second.id])).rows[0].archived_at);
  }},
  {name:'Revision conflicts, changed idempotency payloads and supplied actor metadata leave the snapshot unchanged',async run(db) {
    const f=await fixture(db), stock=stockRecord(); const {request}=await f.command('stock.save',stock); const before=await f.read();
    for(const bad of [{...request,reason:'Other'},{...request,operationId:randomUUID()},{...request,operationId:randomUUID(),revision:before.revision,actorRole:'Owner'}])
      await reject(db,()=>scalar(db,'select public.inventory_command($1) as value',[JSON.stringify(bad)]));
    assert.deepEqual(await f.read(),before);
  }},
  {name:'SQL rejects fractional counts, excess scale, invalid dates/units and case-insensitive SKU conflicts without residue',async run(db) {
    const f=await fixture(db), stock=stockRecord(); await f.command('stock.save',stock);
    const before=await f.read();
    const invalid=[stockRecord({sku:stock.sku.toLowerCase()}),stockRecord({threshold:'0.1'}),stockRecord({unit:'litres'}),
      stockRecord({category:'Food'}),stockRecord({batches:[{id:randomUUID(),quantityBase:'1.0000001',manufactured:null,expires:null,unsellable:false}]}),
      stockRecord({batches:[{id:randomUUID(),quantityBase:'1.5',manufactured:null,expires:null,unsellable:false}]})];
    for(const record of invalid) await reject(db,()=>f.command('stock.save',record));
    assert.deepEqual(await f.read(),before);
  }},
  {name:'Recipes and independent library/product copies preserve signed omissions, default limits and source provenance',async run(db) {
    const f=await fixture(db), ingredient=stockRecord({kind:'Ingredient',category:'Food',unit:'g',batches:[{id:randomUUID(),quantityBase:'1000',manufactured:'2026-01-01',expires:'2027-01-01',unsellable:false}]});
    await f.command('stock.save',ingredient);
    const library=group({options:[option({inputs:[{stockId:ingredient.id,quantity:'-1',unit:'g'}]})]});
    await f.command('library.save',library);
    const copy={...library,id:randomUUID(),sourceGroupId:library.id,options:library.options.map((o:any)=>({...o,id:randomUUID()}))};
    const product=productRecord(ingredient,{sku:`RECIPE-${randomUUID()}`,category:'Food',model:'Recipe',stockId:null,manufactured:'2026-01-01',expires:'2027-01-01',recipe:[{stockId:ingredient.id,quantity:'2',unit:'g'}],groups:[copy]});
    await f.command('product.save',product);
    library.name='Changed library'; await f.command('library.save',library); await f.command('library.archive',{id:library.id});
    const read=await f.read(); const saved=read.tables.modifier_groups.find((g:any)=>g.id===copy.id);
    assert.equal(saved.name,'P5 group'); assert.equal(saved.source_group_id,library.id);
    assert.equal(read.tables.modifier_stock_inputs.find((i:any)=>i.option_id===copy.options[0].id).quantity,'-1.000000');
    await reject(db,()=>f.command('library.save',group({min:'0.5'})));
    await reject(db,()=>f.command('library.save',group({min:'2',max:'2'})));
  }},
  {name:'Variants, nested bundles and fixed choices enforce ownership, completeness, whole quantities and cycle rejection',async run(db) {
    const f=await fixture(db), stock=stockRecord(); await f.command('stock.save',stock);
    const variant={id:randomUUID(),name:'Edition',stockId:stock.id,price:'9.50',enabled:true};
    const variants=productRecord(stock,{sku:`VAR-${randomUUID()}`,stockId:null,model:'Variants',variants:[variant]});
    await f.command('product.save',variants);
    const component={productId:variants.id,stockId:null,variantId:variant.id,quantity:'2',modifierIds:[]};
    const bundle=productRecord(stock,{sku:`BUN-${randomUUID()}`,stockId:null,model:'Bundle',bundle:[component]});
    await f.command('product.save',bundle);
    const nested=productRecord(stock,{sku:`NEST-${randomUUID()}`,stockId:null,model:'Bundle',bundle:[{...component,productId:bundle.id,variantId:null}]});
    await f.command('product.save',nested);
    variant.enabled=false;variants.enabled=false;await f.command('product.save',variants);
    let disabled=await f.read();assert.equal(disabled.tables.products.find((p:any)=>p.id===bundle.id).enabled,true);
    assert.equal(disabled.tables.product_variants.find((v:any)=>v.id===variant.id).enabled,false);
    variant.enabled=true;variants.enabled=true;await f.command('product.save',variants);
    const before=await f.read();
    for(const bad of [{...bundle,bundle:[{...component,variantId:null}]},{...bundle,bundle:[{...component,quantity:'1.5'}]},
      {...bundle,bundle:[component,component]},{...bundle,bundle:[{...component,productId:nested.id,variantId:null}]},
      {...variants,variants:[]},{...variants,variants:[{...variant,id:randomUUID()},{...variant,id:randomUUID()}]}])
      await reject(db,()=>f.command('product.save',bad));
    assert.deepEqual(await f.read(),before);
    await reject(db,()=>f.command('product.archive',{id:variants.id}));
  }},
  {name:'Stock archival checks dependencies atomically, preserves movement history, and never releases its SKU',async run(db) {
    const f=await fixture(db), stock=stockRecord(), product=productRecord(stock); await f.command('product.save',product,{stock});
    const before=await f.read(); await reject(db,()=>f.command('stock.archive',{id:stock.id})); assert.deepEqual(await f.read(),before);
    await f.command('product.archive',{id:product.id}); await f.command('stock.archive',{id:stock.id});
    const read=await f.read(); assert.equal(read.balances.find((b:any)=>b.batch_id===stock.batches[0].id).quantity_base,'0.000000');
    assert.ok(read.tables.stock_items.find((s:any)=>s.id===stock.id).archived_at);
    await reject(db,()=>f.command('stock.save',stockRecord({sku:stock.sku})));
  }},
  {name:'Audit failure rolls back stock, batches, namespace reservations, operation receipts and revision together',async run(db) {
    const f=await fixture(db), before=await f.read(); await db.query('reset role');
    await db.query(`create function private.p5_audit_failure() returns trigger language plpgsql as $$begin raise exception 'P5 audit failure'; end$$`);
    await db.query('create trigger p5_audit_failure before insert on public.audit_events for each row execute function private.p5_audit_failure()');
    await as(db,f.actors.owner); await reject(db,()=>f.command('stock.save',stockRecord()),/P5 audit failure/);
    assert.deepEqual(await f.read(),before);
  }},
  {name:'Role changes with the same identity immediately close command access; generated SKUs reserve unused archived-aware codes',async run(db) {
    const f=await fixture(db); const a=await f.command('stock.save',stockRecord({sku:null})); const b=await f.command('stock.save',stockRecord({sku:null}));
    const codes=b.result.inventory.tables.skus.filter((s:any)=>a.result.inventory.tables.skus.some((v:any)=>v.id===s.id) || s.value==='PRR-HB-0002').map((s:any)=>s.value);
    assert.ok(codes.includes('PRR-HB-0001')); assert.ok(codes.includes('PRR-HB-0002'));
    await db.query('reset role'); await db.query("update public.profiles set role='Staff' where id=$1",[f.actors.admin]);
    await as(db,f.actors.admin); await reject(db,f.read);
  }},
  {name:'Canonical unit changes and category date edits preserve ledger quantities and other batch identities',async run(db) {
    const f=await fixture(db), stock=stockRecord({kind:'Ingredient',category:'Food',unit:'g',batches:[{id:randomUUID(),quantityBase:'1250',manufactured:'2026-01-01',expires:'2027-01-01',unsellable:false}]});
    await f.command('stock.save',stock); stock.unit='kg'; await f.command('stock.save',stock);
    const read=await f.read();assert.equal(read.balances.find((b:any)=>b.batch_id===stock.batches[0].id).quantity_base,'1250.000000');
    await db.query('reset role');assert.equal(await scalar(db,'select count(*)::int as value from public.stock_movements where batch_id=$1',[stock.batches[0].id]),1);
    await as(db,f.actors.owner);
    const retail=stockRecord();await f.command('stock.save',retail);retail.category='Food';retail.batches[0].manufactured='2026-01-01';retail.batches[0].expires='2027-01-01';
    await f.command('stock.save',retail);retail.category='Hobby';retail.batches[0].manufactured=null;retail.batches[0].expires=null;await f.command('stock.save',retail);
  }},
  {name:'Account operation receipts reconcile only their creator and reject duplicate provisioning atomically',async run(db) {
    const f=await fixture(db), id=randomUUID(), op=randomUUID();
    const expected={fullName:'P5 provisioned',username:`p5-${id}`,role:'Staff',email:`${id}@example.invalid`};
    const metadata={vertwell_provision:{actor_id:f.actors.owner,full_name:expected.fullName,username:expected.username,role:'Staff',operation_id:op}};
    await db.query('reset role');await db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)',[id,expected.email,JSON.stringify(metadata)]);
    const before=await scalar(db,'select count(*)::int as value from auth.users');
    await reject(db,()=>db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)',[randomUUID(),`other-${expected.email}`,JSON.stringify({...metadata,vertwell_provision:{...metadata.vertwell_provision,username:`other-${id}`}})]));
    assert.equal(await scalar(db,'select count(*)::int as value from auth.users'),before);
    await as(db,f.actors.owner);assert.deepEqual(await scalar(db,'select public.account_provisioning_result($1,$2) as value',[op,JSON.stringify(expected)]),{id,email:expected.email});
    await as(db,f.actors.admin);await reject(db,()=>scalar(db,'select public.account_provisioning_result($1,$2) as value',[op,JSON.stringify(expected)]));
  }},
  {name:'Removing or reusing configuration IDs cannot hijack another product or fixed bundle choices',async run(db) {
    const f=await fixture(db), stock=stockRecord(), product=productRecord(stock,{groups:[group()]});await f.command('product.save',product,{stock});
    await reject(db,()=>f.command('product.save',{...product,groups:[group({options:[option({inputs:[{stockId:stock.id,quantity:'-1',unit:'pcs'}]})]})]}));
    const other=productRecord(stock,{sku:`OTHER-${randomUUID()}`,groups:product.groups});
    await reject(db,()=>f.command('product.save',other));
    const component={productId:product.id,stockId:null,variantId:null,quantity:'1',modifierIds:[product.groups[0].options[0].id]};
    const bundle=productRecord(stock,{sku:`BUN-${randomUUID()}`,model:'Bundle',stockId:null,bundle:[component]});await f.command('product.save',bundle);
    const before=await f.read();await reject(db,()=>f.command('product.save',{...product,groups:[]}));assert.deepEqual(await f.read(),before);
    await f.command('product.archive',{id:bundle.id});await f.command('product.archive',{id:product.id});await f.command('stock.archive',{id:stock.id});
  }},
  {name:'Explicit removal records Removal rather than a count correction; receipt commands cannot overwrite or remove existing batches',async run(db) {
    const f=await fixture(db),stock=stockRecord();await f.command('stock.save',stock);
    const before=await f.read();stock.batches[0].quantityBase='3';
    await reject(db,()=>f.command('stock.save',stock,{stockAction:'receive'}));assert.deepEqual(await f.read(),before);
    await reject(db,()=>f.command('stock.save',{...stock,batches:[]},{stockAction:'receive'}));
    await reject(db,()=>f.command('stock.save',{...stock,batches:[{...stock.batches[0],quantityBase:'10'},{id:randomUUID(),quantityBase:'0',manufactured:null,expires:null,unsellable:false}]},{stockAction:'receive'}));
    await f.command('stock.save',stock,{stockAction:'remove'});
    await db.query('reset role');
    assert.deepEqual((await db.query("select kind,quantity_base::text from public.stock_movements where batch_id=$1 and kind<>'Opening'",[stock.batches[0].id])).rows,[{kind:'Removal',quantity_base:'-7.000000'}]);
  }},
  {name:'Stale inventory revisions use nonretryable PT409 and leave the complete snapshot unchanged',async run(db) {
    const f=await fixture(db),stock=stockRecord();const {request}=await f.command('stock.save',stock);
    const before=await f.read();
    await db.query('savepoint stale_revision');
    try{
      await assert.rejects(()=>scalar(db,'select public.inventory_command($1::jsonb) as value',
        [JSON.stringify({...request,operationId:randomUUID()})]),(error:any)=>error.code==='PT409');
    }finally{await db.query('rollback to savepoint stale_revision');await db.query('release savepoint stale_revision');}
    assert.deepEqual(await f.read(),before);
  }},
];
