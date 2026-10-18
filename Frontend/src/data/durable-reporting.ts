import type { ReportSnapshot } from '../lib/data/reports';
import type { ReportDocument,ReportSection } from '../lib/report-export';
import type { SalesCategory } from './reporting';
import { scaledDecimal } from '../lib/data/decimal';
import { invalidResponse } from '../lib/data/contracts';

export type ReportFilters={start:string;end:string;startTime:string;endTime:string;category:SalesCategory;scope:'Sales'|'Inventory usage'|'Combined'};
const sum=(values:bigint[])=>values.reduce((a,b)=>a+b,0n);
const n=(s:string)=>scaledDecimal(s,6),cents=(s:string)=>scaledDecimal(s,2);
export function exact(value:bigint,scale:number) {
  const sign=value<0n?'-':'';const digits=(value<0n?-value:value).toString().padStart(scale+1,'0');
  return scale?`${sign}${digits.slice(0,-scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/,'')||'0':`${sign}${digits}`;
}
export const pesos=(value:bigint)=>`₱${value<0n?'-':''}${(value<0n?-value:value)/100n}.${((value<0n?-value:value)%100n).toString().padStart(2,'0')}`;
const day=(s:string)=>{if(!Number.isFinite(Date.parse(s)))invalidResponse('report timestamp');return new Date(Date.parse(s)+8*3600000).toISOString().slice(0,10);};
const stamp=(s:string)=>new Date(Date.parse(s)+8*3600000).toISOString().replace('T',' ').replace(/\.\d{3}Z$/,'');
const isDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export function validReportFilters(f:ReportFilters,today:string) {
  return isDate(f.start)&&isDate(f.end)&&f.start<=f.end&&f.end<=today&&
    [f.startTime,f.endTime].every(s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s))&&`${f.start}T${f.startTime}`<=`${f.end}T${f.endTime}`&&
    ['Sales','Inventory usage','Combined'].includes(f.scope)&&['All categories','Food and Beverage','Hobby'].includes(f.category);
}
const section=(title:string,headings:string[],rows:string[][]):ReportSection=>({title,headings,rows});
function configuration(value:unknown,depth=0):string {
  if(!value||typeof value!=='object'||depth>30)return 'Purchased configuration unavailable';
  const v=value as Record<string,unknown>,c=(v.configuration&&typeof v.configuration==='object'?v.configuration:v) as Record<string,unknown>;
  const modifiers=Array.isArray(c.modifiers)?c.modifiers.map(m=>m&&typeof m==='object'?String((m as Record<string,unknown>).name??'Unrecorded option'):'Unrecorded option'):[];
  const components=Array.isArray(c.components)?c.components.map(child=>configuration(child,depth+1)):[];
  const variant=c.variant&&typeof c.variant==='object'?String((c.variant as Record<string,unknown>).name??'') : c.variantName;
  return [depth?`${v.quantity??''} × ${c.name??'Included product'}${c.sku?` / ${c.sku}`:''}`:'',variant?`Variant: ${variant}`:'',
    ...modifiers.map(m=>`Option: ${m}`),...components.map(child=>`Includes: ${child}`)].filter(Boolean).join('\n')||'No selected options';
}
export function buildDurableReport(snapshot:ReportSnapshot,f:ReportFilters) {
  if(!validReportFilters(f,snapshot.businessDate))invalidResponse('report filters');
  const t=snapshot.tables,from=Date.parse(`${f.start}T${f.startTime}:00+08:00`),to=Date.parse(`${f.end}T${f.endTime}:59.999+08:00`);
  const within=(s:string)=>Date.parse(s)>=from&&Date.parse(s)<=to;
  const onDays=(s:string)=>day(s)>=f.start&&day(s)<=f.end;
  const factors=new Map(t.inventory_units.map(u=>[u.code,scaledDecimal(u.factor,3)]));
  const qty=(base:bigint,unit:string)=>{
    const factor=factors.get(unit);if(!factor||factor<=0n)invalidResponse('stock unit');
    // Up to nine decimals preserve micro base-units displayed in kg/L.
    return exact(base*1000000n/factor,9);
  };
  const skus=new Map(t.skus.map(s=>[s.id,s.value])),stocks=new Map(t.stock_items.map(s=>[s.id,s]));
  const batches=new Map(t.stock_batches.map(b=>[b.id,b])),lines=new Map(t.sale_items.map(l=>[l.id,l]));
  const allSales=new Map(t.sales.map(s=>[s.id,s]));
  for(const m of t.stock_movements)if(!batches.has(m.batch_id))invalidResponse('movement batch');
  for(const b of t.stock_batches)if(!stocks.has(b.stock_item_id))invalidResponse('batch stock');
  for(const l of t.sale_items)if(!allSales.has(l.sale_id))invalidResponse('sale item');
  for(const u of t.sale_item_stock_usage)if(!lines.has(u.sale_item_id)||!stocks.has(u.stock_item_id))invalidResponse('purchased stock usage');
  const orderLines=(id:string)=>t.sale_items.filter(l=>l.sale_id===id);
  const matches=(category:string)=>f.category==='All categories'||(f.category==='Hobby'?category==='Hobby':category!=='Hobby');
  const timed=t.sales.filter(s=>within(s.occurred_at)).sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at)||a.id.localeCompare(b.id));
  const sales=timed.filter(s=>f.category==='All categories'||orderLines(s.id).some(l=>matches(l.category)));
  // Allocate rounded cents once to Hobby; the complementary share always adds back.
  const share=(s:typeof t.sales[number],value:string)=>{
    const total=cents(value);if(f.category==='All categories')return total;
    const own=orderLines(s.id),sub=sum(own.map(l=>cents(l.unit_price)*BigInt(l.quantity)));
    if(sub===0n)return f.category==='Hobby'?0n:total;
    const hobby=sum(own.filter(l=>l.category==='Hobby').map(l=>cents(l.unit_price)*BigInt(l.quantity)));
    const allocated=(total*hobby+sub/2n)/sub;return f.category==='Hobby'?allocated:total-allocated;
  };
  const completed=sales.filter(s=>s.status==='Completed'),pending=sales.filter(s=>s.status==='Pending'&&s.payment_state==='Received');
  const total=sum(completed.map(s=>share(s,s.total)));
  const payment=(id:string)=>t.payments.find(p=>p.sale_id===id);
  const cash=sum(completed.filter(s=>payment(s.id)?.method==='Cash').map(s=>share(s,s.total)));
  const digital=sum(completed.filter(s=>payment(s.id)?.method==='GCash').map(s=>share(s,s.total)));
  const allocatedSubtotal=(s:typeof t.sales[number])=>f.category==='All categories'?cents(s.subtotal):sum(orderLines(s.id).filter(l=>matches(l.category)).map(l=>cents(l.unit_price)*BigInt(l.quantity)));
  const exceptions:string[][]=[];
  for(const s of (f.scope==='Inventory usage'?timed:sales)) {
    if(!orderLines(s.id).length)exceptions.push([s.order_number,'Missing purchased items','Category allocation and product usage are unknown.']);
    if(s.stock_committed!==true||s.usage_complete!==true)exceptions.push([s.order_number,'Incomplete stock history','Consumption snapshots are incomplete or stock commitment is unknown.']);
    if(f.scope!=='Inventory usage') {
      const p=payment(s.id);
      if(!p||cents(p.amount)!==cents(s.total))exceptions.push([s.order_number,'Payment exception','Recorded payment is missing or differs from the receipt.']);
      if(s.review_state==='Awaiting Owner review'&&s.status!=='Voided')exceptions.push([s.order_number,'Awaiting Owner review','Received payment and review status are separate.']);
      if(p?.method==='GCash')exceptions.push([s.order_number,'Provider verification unavailable','Reference recorded; Owner verification is a manual receipt check.']);
      if(s.status==='Voided')exceptions.push([s.order_number,'Voided receipt','No automatic stock return or external payment refund. See recorded movements.']);
    }
  }
  const balances=t.stock_items.map(item=>{
    const ownBatches=t.stock_batches.filter(b=>b.stock_item_id===item.id),ids=new Set(ownBatches.map(b=>b.id));
    const moves=t.stock_movements.filter(m=>ids.has(m.batch_id));
    const dated=moves.map(m=>({...m,date:m.business_date??day(m.occurred_at),q:n(m.quantity_base)}));
    const openings=dated.filter(m=>m.kind==='Opening');
    const coverage=openings.map(m=>m.date).sort()[0];
    const coverageStart=coverage&&coverage>f.start?coverage:f.start;
    let issue='';
    if(!coverage||coverage>f.end)issue='No opening record within or before these dates';
    if(ownBatches.some(b=>openings.filter(m=>m.batch_id===b.id).length!==1))issue='A batch has no verified opening record';
    if(dated.some(m=>m.date>snapshot.businessDate||!isDate(m.date)))issue='Invalid or future movement date';
    for(const b of ownBatches){
      const opening=openings.find(m=>m.batch_id===b.id);
      if(opening&&dated.some(m=>m.batch_id===b.id&&m.date<opening.date))issue='Movements precede the opening record';
      if(sum(dated.filter(m=>m.batch_id===b.id).map(m=>m.q))<0n)issue='Negative batch balance';
    }
    const firstOpening=(m:typeof dated[number])=>m.kind==='Opening'&&m.date===coverageStart&&coverageStart===coverage;
    const opening=sum(dated.filter(m=>m.date<coverageStart||firstOpening(m)).map(m=>m.q));
    const during=dated.filter(m=>m.date>=coverageStart&&m.date<=f.end&&!firstOpening(m));
    const received=sum(during.filter(m=>m.kind==='Receipt').map(m=>m.q));
    const used=-sum(during.filter(m=>m.kind==='Consumption').map(m=>m.q));
    const removed=-sum(during.filter(m=>['Removal','Wastage'].includes(m.kind)).map(m=>m.q));
    const other=during.filter(m=>!['Receipt','Consumption','Removal','Wastage'].includes(m.kind));
    const otherIn=sum(other.filter(m=>m.q>=0n).map(m=>m.q)),otherOut=-sum(other.filter(m=>m.q<0n).map(m=>m.q));
    const closing=opening+received+otherIn-used-removed-otherOut,baseline=opening+received+otherIn;
    if(!issue&&(opening<0n||closing<0n))issue='Stock movements do not reconcile';
    const current=sum(dated.map(m=>m.q));
    const usable=sum(ownBatches.filter(b=>!item.archived_at&&!b.archived_at&&!item.unsellable&&!b.unsellable&&(!b.expires_on||b.expires_on>=snapshot.businessDate))
      .map(b=>sum(dated.filter(m=>m.batch_id===b.id).map(m=>m.q))));
    const percent=(v:bigint)=>baseline>0n?Number(v*1000n/baseline)/10:0;
    const sku=skus.get(item.sku_id)??invalidResponse('stock SKU');
    const soon=new Date(Date.parse(`${snapshot.businessDate}T00:00:00Z`)+7*86400000).toISOString().slice(0,10);
    const attentionBatch=ownBatches.find(b=>!b.archived_at&&sum(dated.filter(m=>m.batch_id===b.id).map(m=>m.q))>0n&&(b.unsellable||Boolean(b.expires_on&&b.expires_on<=soon)));
    if(issue)exceptions.push([`${item.name} / ${sku}`,'Baseline unavailable',issue]);
    return {item,sku,coverageStart,partial:Boolean(coverage&&coverage>f.start&&coverage<=f.end),issue,opening,received,otherIn,otherOut,used,removed,closing,baseline,current,usable,
      attention:!item.archived_at&&(usable<=n(item.threshold_base)||Boolean(attentionBatch)||item.unsellable),attentionBatch,
      remainingPercent:percent(closing),usedPercent:percent(used),removedPercent:percent(removed+otherOut),
      unit:item.unit_code,display:(v:bigint)=>qty(v,item.unit_code)};
  });
  // Compare actual deductions with immutable usage snapshots, never current recipes.
  for(const s of timed.filter(s=>s.stock_committed===true))for(const l of orderLines(s.id)){
    const stockIds=new Set([...t.sale_item_stock_usage.filter(u=>u.sale_item_id===l.id).map(u=>u.stock_item_id),
      ...t.stock_movements.filter(m=>m.sale_item_id===l.id).map(m=>batches.get(m.batch_id)!.stock_item_id)]);
    for(const id of stockIds){
      const recorded=sum(t.sale_item_stock_usage.filter(u=>u.sale_item_id===l.id&&u.stock_item_id===id).map(u=>n(u.quantity_base)));
      const deducted=-sum(t.stock_movements.filter(m=>m.sale_item_id===l.id&&batches.get(m.batch_id)!.stock_item_id===id).map(m=>n(m.quantity_base)));
      if(recorded!==deducted)exceptions.push([s.order_number,'Usage / movement mismatch',`${l.name}: purchased usage and recorded deduction differ for ${stocks.get(id)!.name}.`]);
    }
  }
  const selectedIds=new Set(sales.map(s=>s.id)),timedIds=new Set(timed.map(s=>s.id));
  const saleLabel=(id:string)=>allSales.get(id)?.order_number??id;
  const stockUsage=t.sale_item_stock_usage.filter(u=>{const l=lines.get(u.sale_item_id)!;return timedIds.has(l.sale_id)&&allSales.get(l.sale_id)!.stock_committed===true;});
  const usageRows=stockUsage.map(u=>{
    const l=lines.get(u.sale_item_id)!,s=allSales.get(l.sale_id)!;
    const modifiers=t.sale_item_modifiers.filter(m=>m.sale_item_id===l.id).map(m=>m.name).join(', ');
    return [`${s.order_number}\n${stamp(s.occurred_at)}\n${s.status} · ${s.review_state}`,`${l.name} / ${l.sku}\n${l.category}${modifiers?`\n${modifiers}`:''}`,
      `${u.name} / ${u.sku}\n${u.kind}`,qty(n(u.quantity_base),u.unit_code),u.unit_code];
  });
  const usageTotals=new Map<string,{name:string;sku:string;unit:string;q:bigint}>();
  for(const u of stockUsage){const key=`${u.stock_item_id}:${u.sku}:${u.unit_code}`,v=usageTotals.get(key)??{name:u.name,sku:u.sku,unit:u.unit_code,q:0n};v.q+=n(u.quantity_base);usageTotals.set(key,v);}
  const reviewIds=new Set(t.daily_sales_review_items.filter(i=>selectedIds.has(i.sale_id)).map(i=>i.review_id));
  const reviews=t.daily_sales_reviews.filter(r=>reviewIds.has(r.id));
  const financial:ReportSection[]=[
    section('Sales summary',['Metric','Value'],[
      ['Completed total (recorded tax included)',pesos(total)],['Completed subtotal (before recorded tax)',pesos(sum(completed.map(allocatedSubtotal)))],
      ['Recorded tax on completed receipts',pesos(sum(completed.map(s=>share(s,s.total)-allocatedSubtotal(s))))],['Completed orders',String(completed.length)],
      ['Average completed order',pesos(completed.length?(total+BigInt(completed.length)/2n)/BigInt(completed.length):0n)],
      ['Paid / awaiting Owner review',pesos(sum(pending.map(s=>share(s,s.total))))],['Pending orders',String(sales.filter(s=>s.status==='Pending').length)],
      ['Voided orders',String(sales.filter(s=>s.status==='Voided').length)],['Completed Cash',pesos(cash)],['Completed GCash',pesos(digital)]]),
    section('Transactions',['Order / date','Cashier / role','Payment / fulfilment / review','Status / amount','Void handling'],sales.map(s=>[
      `${s.order_number}\n${s.id}\n${stamp(s.occurred_at)}`,`${s.cashier_name} (${s.cashier_role})`,`${payment(s.id)?.method??'Missing payment'}\n${s.payment_state} / ${s.fulfilment_state}\n${s.review_state}`,
      `${s.status}\n${pesos(share(s,s.total))}`,s.status==='Voided'?`${s.voided_name} (${s.voided_role})\n${s.void_reason}\nNo automatic refund or stock return`:'—'])),
    section('Purchased items and configurations',['Order / product / SKU','Category / quantity','Original / sold unit price','Purchased configuration'],
      sales.flatMap(s=>orderLines(s.id).filter(l=>matches(l.category)).map(l=>[`${s.order_number}\n${l.name} / ${l.sku}`,`${l.category}\n${l.quantity}`,`${pesos(cents(l.original_unit_price))} / ${pesos(cents(l.unit_price))}`,configuration(l.configuration_snapshot)]))),
    section('Recorded payments',['Order / method','Amount','Reference / tendered / change','Verification'],t.payments.filter(p=>selectedIds.has(p.sale_id)).map(p=>[
      `${saleLabel(p.sale_id)}\n${p.method}`,pesos(cents(p.amount)),p.reference??`${pesos(cents(p.cash_tendered??'0'))} tendered\n${pesos(cents(p.change_given??'0'))} change`,
      p.method==='GCash'?'Reference recorded; provider verification unavailable':'Recorded cash receipt'])),
    section('Daily Sales Reviews · original receipt sets',['Review / business date / Owner','Original expected / verified','Counted / adjustments','Outcome / explanation / original included orders'],reviews.map(r=>[
      `${r.id}\n${r.business_date}\n${r.owner_name} (${r.owner_role})\n${stamp(r.reviewed_at)}`,`Cash ${pesos(cents(r.expected_cash))} / ${pesos(cents(r.verified_cash))}\nGCash ${pesos(cents(r.expected_gcash))} / ${pesos(cents(r.verified_gcash))}`,
      `Counted ${pesos(cents(r.counted_cash))}\nOpening ${pesos(cents(r.opening_cash))}\nAdded ${pesos(cents(r.additions))}\nRemoved ${pesos(cents(r.removals))}\nRefunds ${pesos(cents(r.refunds))}`,
      `${r.outcome}\n${r.explanation||'No discrepancy'}\n${t.daily_sales_review_items.filter(i=>i.review_id===r.id).map(i=>`${saleLabel(i.sale_id)} (${i.sale_id}); receipt verified: ${i.receipt_verified}; amount ${pesos(cents(i.verified_amount))}`).join('\n')}`])),
    section('Recorded cash adjustments',['Review / order','Type / amount','Actor / time','Reason'],t.cash_movements.filter(c=>c.review_id?reviewIds.has(c.review_id):c.sale_id?selectedIds.has(c.sale_id):within(c.occurred_at)).map(c=>[
      c.review_id??(c.sale_id?saleLabel(c.sale_id):'Independent movement'),`${c.kind}\n${pesos(cents(c.amount))}`,`${c.actor_name} (${c.actor_role})\n${stamp(c.occurred_at)}`,c.reason])),
    section('Void requests and decisions',['Order / status','Requester / time / reason','Decision actor / time','Decision reason'],t.void_requests.filter(v=>selectedIds.has(v.sale_id)).map(v=>[
      `${saleLabel(v.sale_id)}\n${v.status}`,`${v.requested_name} (${v.requested_role})\n${stamp(v.requested_at)}\n${v.reason}`,v.reviewed_at?`${v.reviewed_name} (${v.reviewed_role})\n${stamp(v.reviewed_at)}`:'Awaiting decision',v.decision_reason??'—'])),
  ];
  const inventory:ReportSection[]=[
    section('Needs attention · current stock',['Item / SKU','Usable / unit','Reorder threshold','Batch expiry / availability'],balances.filter(b=>b.attention).map(b=>[
      `${b.item.name} / ${b.sku}`,`${b.display(b.usable)} ${b.unit}`,`${b.display(n(b.item.threshold_base))} ${b.unit}`,
      b.attentionBatch?`${b.attentionBatch.id}\n${b.attentionBatch.expires_on??'Unrecorded'}\n${b.attentionBatch.unsellable?'Unsellable':'Check expiry'}`:b.item.unsellable?'Unsellable':b.usable===0n?'Out of usable stock':'Low Stock'])),
    section('Stock period balances · full business days',['Item / SKU / unit / coverage','Opening / receipts / other in','Consumed / removed / other out','Historical closing / percentages'],balances.map(b=>[
      `${b.item.name} / ${b.sku}\n${b.unit}${b.item.archived_at?' · Archived':''}\n${b.partial?`Partial history: ${b.coverageStart} to ${f.end}`:`${f.start} to ${f.end}`}`,
      b.issue?'Baseline unavailable':`${b.display(b.opening)} opening\n${b.display(b.received)} receipts\n${b.display(b.otherIn)} other in`,
      b.issue?b.issue:`${b.display(b.used)} consumed\n${b.display(b.removed)} removed / wasted\n${b.display(b.otherOut)} other out`,
      b.issue?'Closing / percentages unknown':`${b.display(b.closing)} ${b.unit}\n${b.usedPercent}% used / ${b.remainingPercent}% remaining${b.baseline===0n?'\nNo stock available':''}`])),
    section('Ingredient usage by transaction',['Order / consumed / status','Product / category / modifiers','Ingredient / SKU','Consumed','Unit'],usageRows.filter((_,i)=>stockUsage[i].kind==='Ingredient')),
    section('All purchased stock usage',['Order / consumed / status','Product / category / modifiers','Stock / SKU','Consumed','Unit'],usageRows),
    section('Stocks used in the selected period',['Item / SKU','Consumed','Unit'],[...usageTotals.values()].map(u=>[`${u.name} / ${u.sku}`,qty(u.q,u.unit),u.unit])),
    section(`Stocks remaining · current on hand (${snapshot.businessDate})`,['Item / SKU','Physical / usable','Unit','Threshold / availability'],balances.map(b=>[
      `${b.item.name} / ${b.sku}${b.item.archived_at?' · Archived':''}`,`${b.display(b.current)} physical\n${b.display(b.usable)} usable`,b.unit,
      `${b.display(n(b.item.threshold_base))} reorder\n${b.item.archived_at?'Archived':b.usable===0n?'Out of usable stock':b.usable<=n(b.item.threshold_base)?'Low Stock':'Available'}`])),
    section('Stock movements · full business days',['Date / batch / item / SKU','Movement / quantity / unit','Order / actor','Reason'],t.stock_movements.filter(m=>onDays(m.occurred_at)).map(m=>[
      `${stamp(m.occurred_at)}\n${m.batch_id}\n${m.stock_name} / ${m.stock_sku}`,`${m.kind}\n${qty(n(m.quantity_base),m.unit_code)} ${m.unit_code}`,
      `${m.sale_item_id?saleLabel(lines.get(m.sale_item_id)?.sale_id??''):''}\n${m.actor_name} (${m.actor_role})`,m.reason])),
    section('Current stock batches and expiry',['Item / SKU / batch','Physical / usable','Manufactured / expires','Availability'],t.stock_batches.map(b=>{
      const item=stocks.get(b.stock_item_id)!,q=sum(t.stock_movements.filter(m=>m.batch_id===b.id).map(m=>n(m.quantity_base)));
      const usable=!item.archived_at&&!b.archived_at&&!item.unsellable&&!b.unsellable&&(!b.expires_on||b.expires_on>=snapshot.businessDate);
      return [`${item.name} / ${skus.get(item.sku_id)}\n${b.id}`,`${qty(q,item.unit_code)} / ${qty(usable?q:0n,item.unit_code)} ${item.unit_code}`,`${b.manufactured_on??'Unrecorded'} / ${b.expires_on??'Unrecorded'}`,b.archived_at||item.archived_at?'Archived':!usable?'Expired / unsellable':'Usable'];
    })),
  ];
  const report:ReportDocument={title:`Happy Hentie · ${f.scope} report`,source:'Saved business records',
    range:`${f.start} ${f.startTime} to ${f.end} ${f.endTime} · ${f.scope==='Inventory usage'?'All inventory categories':f.category} · Asia/Manila`,generated:`Snapshot ${stamp(snapshot.generatedAt)} · Asia/Manila`,notes:[
      'Saved database snapshot. All filtered records across every page are included. Saved changes update automatically.',
      ...(f.scope!=='Inventory usage'?['Completed revenue excludes Pending / Voided receipts. Received payment and Owner review are separate. Totals use recorded prices and tax.',
        'Sales category applies to purchased parent products; mixed-category bundle components are not allocated separately. Mixed-order amounts allocate recorded cents by purchased line value.',
        'Payment rows and Daily Sales Review sets retain ORIGINAL receipt amounts and complete included orders, even when they span categories or the time filter. Do not add review totals to filtered revenue.',
        'GCash reference entry and manual Owner receipt checks are not payment-provider verification. A void does not return stock or refund a payment.']:[]),
      ...(f.scope!=='Sales'?[`Stock covers all categories and full business days ${f.start} to ${f.end}; sales and purchased usage use the selected times.`,
        'Opening + receipts + other inflows - consumption - removals / wastage - other outflows = period closing. Other movements include explicit corrections, returns, transfers and later batch openings.',
        'Percentages use verified opening plus inflows for each SKU/unit. Partial history names the covered dates; earlier stock is unknown. Missing openings show Baseline unavailable.',
        `Current physical / usable quantities are as of snapshot ${stamp(snapshot.generatedAt)}. Expired / unsellable stock remains physical until an explicit removal. Archived records remain in history.`,
        'Consumption includes paid / fulfilled Pending and voided sales with committed stock. Owner review never consumes stock again. No current recipe is applied to historical sales.']:[]),
    ],sections:[...(f.scope!=='Inventory usage'?financial:[]),...(f.scope!=='Sales'?inventory:[]),section('Exceptions and missing history',['Receipt / item','Exception','Explanation'],exceptions.filter(row=>f.scope!=='Sales'||!['Baseline unavailable','Usage / movement mismatch'].includes(row[1])))]};
  const dailyValues=[...new Set(sales.map(s=>s.business_date??day(s.occurred_at)))].sort().map(date=>{
    const orders=completed.filter(s=>(s.business_date??day(s.occurred_at))===date);
    return [date,String(orders.length),pesos(sum(orders.map(s=>share(s,s.total)))),
      pesos(sum(orders.filter(s=>payment(s.id)?.method==='Cash').map(s=>share(s,s.total)))),
      pesos(sum(orders.filter(s=>payment(s.id)?.method==='GCash').map(s=>share(s,s.total))))];
  });
  const dailyTotals=dailyValues.map(([date])=>({date,total:sum(completed.filter(s=>(s.business_date??day(s.occurred_at))===date).map(s=>share(s,s.total)))}));
  return {report,balances,total,cash,digital,orderCount:sales.length,completedCount:completed.length,dailyValues,dailyTotals,
    pendingCount:sales.filter(s=>s.status==='Pending').length,voidedCount:sales.filter(s=>s.status==='Voided').length,
    pendingPaid:sum(sales.filter(s=>s.status==='Pending'&&s.payment_state==='Received').map(s=>share(s,s.total)))};
}
