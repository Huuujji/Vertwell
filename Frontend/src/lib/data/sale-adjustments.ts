import { array, record, invalidResponse } from './contracts';
export const adjustmentReasons = {
  duplicate: 'Duplicate sale / transaction', incorrect_order: 'Incorrect order entered', cancellation: 'Customer cancellation',
  refund_return: 'Customer refund / return', quality: 'Damaged, spoiled or quality issue', other: 'Other',
} as const;
export const meaningfulReasonNotes = (notes: string) => /[\p{L}\p{N}]/u.test(notes);
export type ReasonId = keyof typeof adjustmentReasons;
export const stockConditions = {
  unused: 'Unused / never prepared or handed over; physically available',
  returned_sellable: 'Actually returned, inspected and approved for resale',
  waste: 'Prepared or damaged and discarded / unsellable loss',
  consumed: 'Prepared and consumed; keep deduction (not waste)',
  not_returned: 'Missing or not returned; keep deduction',
  returned_unsellable: 'Actually returned damaged / unsellable; keep out of sellable stock',
} as const;
export type StockCondition = keyof typeof stockConditions;
export const physicalFactLabels = { foodOrBeverage: 'This input represents Food/Beverage (including a bundle component)', prepared: 'Prepared for this order', handedOver: 'Handed to the customer', returned: 'Actually returned by the customer', physicallyPresent: 'Physically present in shop custody', sellable: 'Inspected and in sellable condition', additionalConsumption: 'Additional physical consumption occurred for this record' } as const;
export const packagedReturnLabels = { factorySealed: 'Unopened original factory seal is intact', shelfStable: 'Shelf-stable; no refrigeration or freezing required for safety', packagingSound: 'Packaging intact, clean and undamaged', uncontaminated: 'No contamination or unsafe storage concern', recallClear: 'No recall concern', expiryChecked: 'Original batch and expiry inspected and still eligible' } as const;
export type PhysicalFacts = Record<keyof typeof physicalFactLabels, boolean>;
export type DispositionInput = { itemId: string; stockId: string; sourceDispositionId?: string; quantityBase: string; condition: StockCondition; evidence: string; resalePolicyConfirmed: boolean; facts: PhysicalFacts; packagedReturn?: Record<keyof typeof packagedReturnLabels, boolean> };
export type RefundInput = { amount: string; method: 'Cash'|'GCash'; reference: string; paidAt: string; evidence: string; paidConfirmed: boolean };
export type AdjustableItem = { id: string; name: string; category: string; quantity: number; model: string|null;
  usage: { stockId: string; name: string; kind: string; unit: string; quantity: string; accountedQuantity: string }[] };
export type AdjustmentEvidence = {
  decisions: { operationId: string; kind: string; reasonId: string; reasonLabel: string; notes: string; actorId: string; actorName: string; actorRole: string; occurredAt: string }[];
  dispositions: { actor_id?: string; id: string; operation_id: string; sale_item_id: string; stock_item_id: string; quantity_base: string; condition: StockCondition; evidence: string; occurred_at: string; actor_name: string; actor_role: string;
    sourceDispositionId: string|null; physicalFacts: Record<string, unknown>|null; allocations: { source_movement_id: string; return_movement_id: string|null; quantity_base: string; batch: unknown }[] }[];
  refunds: { actor_id?: string; sale_id?: string; payment_id?: string|null; cash_movement_id?: string|null; id: string; operation_id: string; amount: string; method: string; reference: string; evidence: string; paid_at: string; recorded_at: string; actor_name: string; actor_role: string; status: string; providerVerified: false }[];
};
const text = (v:unknown) => { if (typeof v !== 'string') invalidResponse('adjustment text'); return v; };
const decimal = (v:unknown) => { const s=text(v); if (!/^\d+(\.\d{1,6})?$/.test(s)) invalidResponse('adjustment quantity'); return s; };
export function decodeAdjustments(value: unknown): AdjustmentEvidence {
  const v=record(value);
  const decisions=array(v.decisions).map(value=>{const r=record(value); return Object.fromEntries(['operationId','kind','reasonId','reasonLabel','notes','actorId','actorName','actorRole','occurredAt'].map(k=>[k,text(r[k])])) as AdjustmentEvidence['decisions'][number];});
  const dispositions=array(v.dispositions).map(value=>{const r=record(value); if (!(text(r.condition) in stockConditions)) invalidResponse('stock condition');
    const fields=Object.fromEntries(['id','operation_id','sale_item_id','stock_item_id','evidence','occurred_at','actor_name','actor_role','condition'].map(k=>[k,text(r[k])]));
    return {...fields, actor_id:r.actor_id===undefined?undefined:text(r.actor_id), sourceDispositionId:r.source_disposition_id==null?null:text(r.source_disposition_id), physicalFacts:r.physical_facts==null?null:record(r.physical_facts), quantity_base:decimal(r.quantity_base), allocations:array(r.allocations).map(value=>{const a=record(value);return {source_movement_id:text(a.source_movement_id),return_movement_id:a.return_movement_id===null?null:text(a.return_movement_id),quantity_base:decimal(a.quantity_base),batch:a.batch};})} as AdjustmentEvidence['dispositions'][number];
  });
  const refunds=array(v.refunds).map(value=>{const r=record(value); if(r.providerVerified!==false)invalidResponse('manual refund status');
    return {...Object.fromEntries(['id','operation_id','method','reference','evidence','paid_at','recorded_at','actor_name','actor_role','status'].map(k=>[k,text(r[k])])),actor_id:r.actor_id===undefined?undefined:text(r.actor_id),sale_id:r.sale_id===undefined?undefined:text(r.sale_id),payment_id:r.payment_id==null?null:text(r.payment_id),cash_movement_id:r.cash_movement_id==null?null:text(r.cash_movement_id),amount:decimal(r.amount),providerVerified:false} as AdjustmentEvidence['refunds'][number]; });
  return {decisions,dispositions,refunds};
}
export function decodeAdjustableItems(value: unknown): AdjustableItem[] {
  return array(value).map(value=>{const r=record(value);if(!Number.isInteger(r.quantity)||Number(r.quantity)<=0)invalidResponse('purchased quantity');
    return {id:text(r.id),name:text(r.name),category:text(r.category),quantity:Number(r.quantity),model:r.model===null?null:text(r.model),usage:array(r.usage).map(value=>{const u=record(value);return {stockId:text(u.stockId),name:text(u.name),kind:text(u.kind),unit:text(u.unit),quantity:decimal(u.quantity),accountedQuantity:decimal(u.accountedQuantity)};})};});
}

export function physicalPlanError(plan: DispositionInput, item: AdjustableItem): string | null {
  const f=plan.facts;
  if(Object.keys(physicalFactLabels).some(k=>typeof f[k as keyof PhysicalFacts]!=='boolean'))return 'Confirm every physical fact for this quantity.';
  if(!meaningfulReasonNotes(plan.evidence))return 'Describe the actual physical evidence.';
  const c=plan.condition;
  if((f.returned&&(!f.handedOver||!f.physicallyPresent))||
    (c==='unused'&&(f.prepared||f.handedOver||f.returned||!f.physicallyPresent||!f.sellable||f.additionalConsumption))||
    (c==='returned_sellable'&&(!f.handedOver||!f.returned||!f.physicallyPresent||!f.sellable))||
    (c==='returned_unsellable'&&(!f.handedOver||!f.returned||!f.physicallyPresent||f.sellable))||
    (c==='not_returned'&&(f.returned||f.physicallyPresent||f.sellable))||
    (c==='consumed'&&(!f.handedOver||f.returned||f.physicallyPresent||f.sellable||((item.category!=='Hobby'||f.foodOrBeverage)&&!f.prepared)))||
    (c==='waste'&&f.sellable))return 'Physical facts conflict with this quantity outcome.';
  if(c==='returned_sellable'&&(item.category!=='Hobby'||f.foodOrBeverage)&&f.prepared)return 'Food prepared for this order cannot be resold as a factory-sealed return.';
  if(c==='returned_sellable'&&(!plan.resalePolicyConfirmed||((item.category!=='Hobby'||f.foodOrBeverage)&&Object.keys(packagedReturnLabels).some(k=>plan.packagedReturn?.[k as keyof typeof packagedReturnLabels]!==true))))return 'Confirm inspection and every applicable resale-policy check.';
  return null;
}
export function describePhysicalFacts(facts: Record<string,unknown>|null): string {
  if(!facts)return 'Not captured in historical record';
  return Object.entries(physicalFactLabels).map(([key,label])=>`${label}: ${facts[key]===true?'Yes':facts[key]===false?'No':'Not recorded'}`).join(' · ');
}

export function laterReturnRemaining(d: AdjustmentEvidence['dispositions'][number], evidence: AdjustmentEvidence): number {
 return Number(d.quantity_base)-evidence.dispositions.filter(c=>c.sourceDispositionId===d.id).reduce((sum,c)=>sum+Number(c.quantity_base),0);
}
