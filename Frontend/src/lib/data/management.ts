import type { Account, ModifierGroup, Product, RecipeInput, StockItem } from '../../data/demo';
import type { InventorySnapshot, ManagedAccount } from './contracts';
import { decodeInventory, invalidResponse } from './contracts';
import { mapAccounts, mapInventory } from './mappers';
import { scaledDecimal } from './decimal';
import { ApiError, createApiClient } from '../api-client';

export interface InventoryChange { reason: string; automaticSku?: boolean; imageFile?: File; removeImage?: boolean; stockAction?: 'correct'|'receive'|'remove' }
type Request = ReturnType<typeof createApiClient>;
export type InventoryData = ReturnType<typeof mapInventory>;
export type AccountsData = { source: ManagedAccount[]; accounts: ReturnType<typeof mapAccounts> };
const factors: Record<string,number>={g:1,kg:1000,ml:1,L:1000,pcs:1,bottles:1};
function decimal(value: number, places=6, factor=1): string {
  if(!Number.isFinite(value) || !Number.isSafeInteger(Math.round(value*10**places))) throw new ApiError('This value is outside the supported range.','validation');
  const text=value.toFixed(places);
  if(Number(text)!==value) throw new ApiError(`Use at most ${places} decimal places.`,'validation');
  const scaled=scaledDecimal(text,places)*BigInt(factor), sign=scaled<0n?'-':'';
  if(scaled>BigInt(Number.MAX_SAFE_INTEGER)||scaled<BigInt(Number.MIN_SAFE_INTEGER)) throw new ApiError('This value exceeds display precision.','validation');
  const abs=scaled<0n?-scaled:scaled, unit=10n**BigInt(places);
  return `${sign}${abs/unit}.${(abs%unit).toString().padStart(places,'0')}`;
}
const inputs=(rows: RecipeInput[])=>rows.map(row=>({stockId:row.stockId,quantity:decimal(row.quantity),unit:row.unit}));
const group=(row: ModifierGroup)=>({id:row.id,name:row.name,min:String(row.min),max:String(row.max),
  sourceGroupId:row.sourceGroupId ?? null,options:row.options.map(option=>({id:option.id,name:option.name,price:decimal(option.price,2),
    defaultSelected:option.defaultSelected ?? false,inputs:inputs(option.inputs)}))});

export function createManagementData(request: Request) {
  // Keep the same payload/operation ID after an ambiguous response. No automatic
  // replay; an explicit retry reconciles the database's original operation receipt.
  let pending: { signature:string; command:Record<string,unknown> } | undefined;
  const uploaded=new WeakMap<File,string>();
  async function images(source: InventorySnapshot): Promise<InventoryData> {
    const mapped=mapInventory(source);
    const paths=[...new Set([...source.tables.products,...source.tables.stock_items].map(row=>row.image_path).filter((path):path is string=>Boolean(path)))];
    const urls=new Map<string,string>();
    for(let start=0;start<paths.length;start+=100) {
      const result=await request<{images:{path:string;signedUrl:string}[]}>('/api/inventory/image-urls',{method:'POST',body:JSON.stringify({paths:paths.slice(start,start+100)})});
      for(const row of result.images) urls.set(row.path,row.signedUrl);
    }
    for(const row of mapped.products) {const path=source.tables.products.find(p=>p.id===row.id)?.image_path; row.image=path?urls.get(path)??'':'';}
    for(const row of mapped.stock) {const path=source.tables.stock_items.find(p=>p.id===row.id)?.image_path; row.image=path?urls.get(path):undefined;}
    return mapped;
  }
  async function image(existing: string|null, change?: InventoryChange) {
    if(change?.removeImage) return null;
    const file=change?.imageFile;
    if(!file) return existing;
    const saved=uploaded.get(file); if(saved) return saved;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2097152) throw new ApiError('Choose a PNG, JPEG or WebP image up to 2 MB.','validation');
    const result=await request<{path:string}>('/api/inventory/images',{method:'POST',body:file,headers:{'Content-Type':file.type}});
    uploaded.set(file,result.path); return result.path;
  }
  async function stock(row: StockItem, source: InventorySnapshot, change?: InventoryChange) {
    const existing=source.tables.stock_items.find(item=>item.id===row.id);
    return {id:row.id,sku:change?.automaticSku?null:row.sku,name:row.name,kind:row.kind,category:row.category,unit:row.unit,
      threshold:decimal(row.threshold??0,6,factors[row.unit]),unsellable:row.status==='Unsellable',
      imagePath:await image(existing?.image_path??null,change),batches:(row.batches??[{id:crypto.randomUUID(),quantity:row.quantity,
        manufactured:row.manufactured,expires:row.expires,status:row.status}]).map(batch=>({id:batch.id,quantityBase:decimal(batch.quantity,6,factors[row.unit]),
        manufactured:batch.manufactured||null,expires:batch.expires||null,unsellable:batch.status==='Unsellable'}))};
  }
  async function command(source: InventorySnapshot, kind: string, record: unknown, reason: string, extra: Record<string,unknown>={}) {
    if(source.revision===undefined) invalidResponse('missing inventory revision');
    const body={kind,record,reason,...extra}, signature=JSON.stringify(body);
    if(!pending||pending.signature!==signature) pending={signature,command:{...body,operationId:crypto.randomUUID(),revision:source.revision}};
    let result: {inventory:unknown;entityId:string;operationId:string};
    try {result=await request('/api/inventory/commands',{method:'POST',body:JSON.stringify(pending.command)});}
    catch(cause) {
      // A definitive rejection did not commit. A refreshed, reviewed draft can
      // use its new revision; ambiguous transport/server failures keep the key.
      if(cause instanceof ApiError && cause.status && cause.status>=400 && cause.status<500) pending=undefined;
      throw cause;
    }
    // A saved inventory must still be accepted if signing its optional image fails.
    // Later refresh can obtain fresh URLs; never present a committed save as failed.
    const snapshot=decodeInventory(result.inventory);
    const data=await images(snapshot).catch(()=>mapInventory(snapshot));
    pending=undefined;
    return {data,entityId:result.entityId};
  }
  return {
    async inventory(signal?:AbortSignal) {return images(decodeInventory(await request('/api/inventory',{signal})));},
    async accounts(signal?:AbortSignal):Promise<AccountsData> {
      const result=await request<{accounts:ManagedAccount[]}>('/api/auth/accounts',{signal});
      return {source:result.accounts,accounts:mapAccounts(result.accounts)};
    },
    async saveStock(source:InventorySnapshot,row:StockItem,change?:InventoryChange) {
      return command(source,'stock.save',await stock(row,source,change),change?.reason??'Inventory correction',{stockAction:change?.stockAction??'correct'});
    },
    async saveProduct(source:InventorySnapshot,row:Product,item?:StockItem,change?:InventoryChange) {
      const record={id:row.id,sku:change?.automaticSku?null:row.sku,name:row.name,category:row.category,
        model:row.mode==='Stocked'?'Retail Item':row.mode==='Made to order'?'Recipe':row.mode,price:decimal(row.price,2),
        discountType:row.discountType??'None',discountValue:decimal(row.discountValue??0,2),enabled:row.available!==false,
        imagePath:await image(source.tables.products.find(p=>p.id===row.id)?.image_path??null,change),
        manufactured:row.manufactured||null,expires:row.expires||null,stockId:row.stockId??null,
        recipe:inputs(row.recipe??[]),variants:(row.variants??[]).map(v=>({id:v.id,name:v.name,stockId:v.stockId,price:decimal(v.price,2),enabled:v.available})),
        groups:(row.modifiers??[]).map(group),bundle:(row.bundle??[]).map(c=>({productId:c.productId??null,stockId:c.productId?null:c.stockId,
          variantId:c.variantId??null,quantity:String(c.quantity),modifierIds:c.modifierIds??[]}))};
      return command(source,'product.save',record,change?.reason??'Product configuration saved',item?{stock:await stock(item,source,change)}:{});
    },
    saveLibrary:(source:InventorySnapshot,row:ModifierGroup)=>command(source,'library.save',group(row),'Modifier library saved'),
    archive:(source:InventorySnapshot,kind:'product'|'stock'|'library',id:string,reason:string)=>command(source,`${kind}.archive`,{id},reason),
    async saveAccount(data:AccountsData,account:Account,password?:string,operationId?:string) {
      const current=data.source.find(row=>row.id===account.id);
      if(!current) {
        if(!password||!operationId) throw new ApiError('Enter an account password.','validation');
        await request('/api/auth/accounts',{method:'POST',body:JSON.stringify({fullName:account.name,username:account.username,
          role:account.role,email:account.email,password,operationId})});
      } else {
        try {
          const result=await request<{profile:ManagedAccount}>(`/api/auth/accounts/${account.id}`,{method:'PATCH',body:JSON.stringify({fullName:account.name,username:account.username,
            role:account.role,active:account.active??true,updatedAt:current.updated_at})});
          const source=data.source.map(row=>row.id===account.id?{...result.profile,email:row.email}:row);
          return {source,accounts:mapAccounts(source)};
        }
        catch(cause) {
          if(!(cause instanceof ApiError)||cause.kind!=='network') throw cause;
          const now=await this.accounts(), saved=now.accounts.find(a=>a.id===account.id);
          if(!saved||saved.name!==account.name||saved.username!==account.username||saved.role!==account.role||saved.active!==(account.active??true)) throw cause;
          return now;
        }
      }
      return this.accounts();
    },
  };
}
