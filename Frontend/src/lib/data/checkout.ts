import { array,record,invalidResponse,choice,date } from './contracts';
import { displayDecimal,scaledDecimal } from './decimal';
import type { createApiClient } from '../api-client';

type Transport=ReturnType<typeof createApiClient>;
export type CheckoutLine={productId:string;variantId:string|null;modifierIds:string[];quantity:string};
export function combineCheckoutLines(lines:CheckoutLine[]):CheckoutLine[] {
  const combined=new Map<string,CheckoutLine>();
  for(const line of lines){
    const key=JSON.stringify([line.productId,line.variantId,[...line.modifierIds].sort()]),existing=combined.get(key);
    if(existing)existing.quantity=String(Number(existing.quantity)+Number(line.quantity));
    else combined.set(key,{...line,modifierIds:[...line.modifierIds]});
  }
  return [...combined.values()];
}
export type PosOption={id:string;name:string;price:string;defaultSelected:boolean};
export type PosProduct={id:string;name:string;sku:string;category:string;model:string;basePrice:string;priceFrom:string|null;priceTo:string|null;discountType:string;discountValue:string;available:boolean|null;stockId?:string|null;usableQuantity?:string|null;imagePath:string|null;imageUrl?:string;
  variants:{id:string;name:string;price:string;sku:string}[];groups:{id:string;name:string;min:number;max:number;options:PosOption[]}[];
  components:{name:string;quantity:number;variant:string|null}[]};
export type QuotedLine={productId:string;variantId:string|null;name:string;sku:string;quantity:number;unitPrice:string;originalUnitPrice:string;
  modifiers:{id:string;name:string;price:string}[];components:unknown[]};
export type CheckoutQuote={version:1;revision:string;quoteToken:string;businessDate:string;lines:QuotedLine[];subtotal:string;tax:string;total:string};
export type CheckoutStock={maximums:number[];stocks:{stockId:string;name:string;sku:string;unit:string;usable:string;required:string;remaining:string;lineNeeds:string[]}[]};
export type CheckoutCommand={operationId:string;revision:string;quoteToken:string;lines:CheckoutLine[];
  payment:{method:'Cash';amount:string;cashTendered:string}|{method:'GCash';amount:string;reference:string}};
export type CheckoutReceipt=Omit<CheckoutQuote,'revision'|'quoteToken'>&{saleId:string;orderNumber:string;occurredAt:string;status:string;reviewState:string;
  stockCommitted:true;operationId:string;replayed:boolean;method:string;cashierName:string;cashierRole:string;reference:string|null;cashTendered:string|null;change:string|null;providerVerified:false};
const text=(v:unknown)=>{if(typeof v!=='string')invalidResponse('checkout text');return v;};
const id=(v:unknown)=>{const s=text(v);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))invalidResponse('checkout ID');return s;};
const money=(v:unknown)=>{const s=text(v);if(scaledDecimal(s,2)<0n)invalidResponse('negative money');displayDecimal(s,2);return s;};
const bool=(v:unknown)=>{if(typeof v!=='boolean')invalidResponse('checkout boolean');return v;};
const integer=(v:unknown)=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)invalidResponse('checkout integer');return v;};
function options(v:unknown):PosOption[]{return array(v).map(value=>{const r=record(value);return {id:id(r.id),name:text(r.name),price:money(r.price),defaultSelected:bool(r.defaultSelected)};});}
export function decodePosProduct(value:unknown):PosProduct {
  const r=record(value);return {id:id(r.id),name:text(r.name),sku:text(r.sku),category:choice(text(r.category),['Food','Beverage','Hobby']),
    model:choice(text(r.model),['Retail Item','Recipe','Variants','Bundle']),basePrice:money(r.basePrice),priceFrom:r.priceFrom===null?null:money(r.priceFrom),priceTo:r.priceTo===null?null:money(r.priceTo),discountType:choice(text(r.discountType),['None','Fixed','Percentage']),discountValue:money(r.discountValue),available:r.available===null?null:bool(r.available),imagePath:r.imagePath===null?null:text(r.imagePath),
    usableQuantity:r.usableQuantity==null?null:text(r.usableQuantity),
    stockId:r.stockId==null?null:id(r.stockId),
    variants:array(r.variants).map(value=>{const v=record(value);return {id:id(v.id),name:text(v.name),price:money(v.price),sku:text(v.sku)};}),
    groups:array(r.groups).map(value=>{const g=record(value);return {id:id(g.id),name:text(g.name),min:integer(g.min),max:integer(g.max),options:options(g.options)};}),
    components:array(r.components).map(value=>{const c=record(value);return {name:text(c.name),quantity:integer(c.quantity),variant:c.variant===null?null:text(c.variant)};})};
}
function decodeTotals(value:unknown) {
  const r=record(value);if(r.version!==1)invalidResponse('checkout version');
  const subtotal=money(r.subtotal),tax=money(r.tax),total=money(r.total);
  if(scaledDecimal(subtotal,2)+scaledDecimal(tax,2)!==scaledDecimal(total,2))invalidResponse('checkout total');
  const lines=array(r.lines).map(value=>{const l=record(value);return {productId:id(l.productId),variantId:l.variantId===null?null:id(l.variantId),name:text(l.name),sku:text(l.sku),
    quantity:integer(l.quantity),unitPrice:money(l.unitPrice),originalUnitPrice:money(l.originalUnitPrice),
    modifiers:array(l.modifiers).map(value=>{const m=record(value);return {id:id(m.id),name:text(m.name),price:money(m.price)};}),components:array(l.components)};});
  if(!lines.length||lines.some(l=>l.quantity<1)||lines.reduce((sum,l)=>sum+scaledDecimal(l.unitPrice,2)*BigInt(l.quantity),0n)!==scaledDecimal(subtotal,2))invalidResponse('checkout line totals');
  return {version:1 as const,businessDate:date(r.businessDate),lines,subtotal,tax,total};
}
export function decodeQuote(value:unknown):CheckoutQuote {
  const r=record(value),revision=text(r.revision),quoteToken=text(r.quoteToken);
  if(!/^\d+$/.test(revision)||!/^[a-f0-9]{64}$/.test(quoteToken))invalidResponse('checkout quote');
  return {...decodeTotals(value),revision,quoteToken};
}
export function decodeReceipt(value:unknown):CheckoutReceipt {
  const r=record(value);if(r.stockCommitted!==true||r.providerVerified!==false)invalidResponse('checkout receipt state');
  const occurredAt=text(r.occurredAt);if(!Number.isFinite(Date.parse(occurredAt)))invalidResponse('receipt time');
  return {...decodeTotals(value),saleId:id(r.saleId),operationId:id(r.operationId),orderNumber:text(r.orderNumber),occurredAt,
    status:choice(text(r.status),['Completed','Pending','Voided']),reviewState:choice(text(r.reviewState),['Owner checkout','Awaiting Owner review','Reviewed']),
    stockCommitted:true,replayed:bool(r.replayed),method:choice(text(r.method),['Cash','GCash']),cashierName:text(r.cashierName),cashierRole:choice(text(r.cashierRole),['Owner','Admin','Staff']),
    reference:r.reference===null?null:text(r.reference),cashTendered:r.cashTendered===null?null:money(r.cashTendered),change:r.change===null?null:money(r.change),providerVerified:false};
}
export function createCheckoutData(request:Transport) {
  return {
    async catalogue(signal?:AbortSignal){
      const items:PosProduct[]=[];
      let revision:string|undefined,businessDay:string|undefined;
      for(let offset=0;offset<=1_000_000;offset+=100){
        const r=record(await request(`/api/pos/checkout-catalogue?limit=100&offset=${offset}`,{signal}));
        if(r.version!==1||r.checkoutReady!==true)invalidResponse('POS readiness');
        const current=text(r.revision),day=date(r.businessDate);
        if(!/^\d+$/.test(current)||(revision!==undefined&&(revision!==current||businessDay!==day)))invalidResponse('catalogue changed during loading; refresh');
        revision=current;businessDay=day;
        const page=array(r.items).map(decodePosProduct);
        const paths=[...new Set(page.map(p=>p.imagePath).filter((p):p is string=>p!==null))];
        if(paths.length)try{
          const signed=record(await request('/api/pos/image-urls',{method:'POST',body:JSON.stringify({paths}),signal}));
          const urls=new Map(array(signed.images).map(value=>{const i=record(value);const url=text(i.signedUrl);if(!/^https:\/\//.test(url))invalidResponse('image URL');return [text(i.path),url];}));
          page.forEach(p=>{p.imageUrl=p.imagePath?urls.get(p.imagePath):undefined;});
        }catch{/* Optional images do not prevent a sale; refresh retries signing. */}
        items.push(...page);
        if(r.hasMore===false) {if(new Set(items.map(p=>p.id)).size!==items.length)invalidResponse('duplicate POS products');return items;}
        if(r.hasMore!==true||page.length!==100)invalidResponse('POS pagination');
      }
      return invalidResponse('POS catalogue too large');
    },
    async quote(lines:CheckoutLine[],signal?:AbortSignal){return decodeQuote(await request('/api/pos/quote',{method:'POST',body:JSON.stringify({lines}),signal}));},
    async stock(lines:CheckoutLine[],signal?:AbortSignal):Promise<CheckoutStock>{
      const r=record(await request('/api/pos/stock',{method:'POST',body:JSON.stringify({lines}),signal}));
      if(r.version!==1)invalidResponse('stock feedback version');
      const maximums=array(r.maximums).map(integer);if(maximums.length!==lines.length||maximums.some(n=>n>10000))invalidResponse('stock feedback limits');
      const decimal=(v:unknown)=>{const s=text(v).replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');scaledDecimal(s,9);return s;};
      const stocks=array(r.stocks).map(value=>{const s=record(value),lineNeeds=array(s.lineNeeds).map(decimal);if(lineNeeds.length!==lines.length)invalidResponse('stock feedback lines');
        return {stockId:id(s.stockId),name:text(s.name),sku:text(s.sku),unit:choice(text(s.unit),['g','kg','ml','L','pcs','bottles']),usable:decimal(s.usable),required:decimal(s.required),remaining:decimal(s.remaining),lineNeeds};});
      return {maximums,stocks};
    },
    async availability(productId:string,lines:CheckoutLine[]){const r=record(await request('/api/pos/availability',{method:'POST',body:JSON.stringify({productId,lines})}));
      if(r.version!==1)invalidResponse('availability version');return r.available===null?null:bool(r.available);},
    async checkout(command:CheckoutCommand){return decodeReceipt(await request('/api/checkout',{method:'POST',body:JSON.stringify(command)}));},
    async sales(offset:number,signal?:AbortSignal){const r=record(await request(`/api/sales?limit=20&offset=${offset}`,{signal}));
      return {hasMore:bool(r.hasMore),items:array(r.items).map(value=>{const s=record(value);return {id:id(s.id),orderNumber:text(s.order_number),total:money(s.total),status:text(s.status),cashier:text(s.cashier_name)};})};},
    async receipt(id:string){return decodeReceipt(await request(`/api/sales/${id}/receipt`));},
  };
}
