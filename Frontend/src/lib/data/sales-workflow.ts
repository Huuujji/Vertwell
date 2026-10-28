import { array,record,invalidResponse,choice,date,decodeRow } from './contracts';
import { displayDecimal,scaledDecimal } from './decimal';
import { decodeReceipt,type CheckoutReceipt } from './checkout';
import type { createApiClient } from '../api-client';
import type { Row } from './database.generated';
import { decodeAdjustments, decodeAdjustableItems, type AdjustmentEvidence, type AdjustableItem, type ReasonId, type DispositionInput, type RefundInput } from './sale-adjustments';

type Transport=ReturnType<typeof createApiClient>;
export type WorkflowTarget={saleId:string;token:string};
export type ReviewInput={date:string;countedCash:string;verifiedGCash:string;openingCash:string;additions:string;removals:string;refunds:string;explanation:string;verifiedIds:string[]};
export type WorkflowCommand={operationId:string;targets:WorkflowTarget[]} & (
  {kind:'review.confirm';review:ReviewInput}|{kind:'void.request'|'sale.void';reason?:string;reasonId?:ReasonId;notes?:string}|
  {kind:'void.decide';reason?:string;reasonId?:ReasonId;notes?:string;requestId:string;approved:boolean}|
  {kind:'stock.dispose';reasonId:ReasonId;notes:string;dispositions:DispositionInput[]}|
  {kind:'refund.record';reasonId:ReasonId;notes:string;refund:RefundInput});
export type WorkflowResult={version:1;operationId:string;kind:WorkflowCommand['kind'];replayed:boolean;reviewId?:string;
  results:{saleId:string;outcome:'reviewed'|'requested'|'rejected'|'voided'|'stale'|'ineligible'|'disposed'|'refunded'}[]};
export type WorkflowReview={id:string;owner:string;role:'Owner';time:string;outcome:string;
  details:(Row<'daily_sales_reviews'>&{orderIds:string[];cashMovements:Row<'cash_movements'>[]})|null};
export type WorkflowSale={id:string;orderNumber:string;token:string;businessDate:string;occurredAt:string;cashierId:string;cashierName:string;cashierRole:string;
  status:'Pending'|'Completed'|'Voided';reviewState:string;total:string;method:'Cash'|'GCash';reference:string|null;
  stockCommitted:boolean|null;usageComplete:boolean|null;voidedAt:string|null;voidedName:string|null;voidedRole:string|null;voidReason:string|null;bulkActionId:string|null;
  bulkAction:{operationId:string;reason:string;results:WorkflowResult['results']}|null;
  receipt:CheckoutReceipt|null;requests:Row<'void_requests'>[];events:Row<'audit_events'>[];review:WorkflowReview|null;
  refundBalance:{paymentId:string|null;received:string|null;method:'Cash'|'GCash'|null;receivedAt:string|null;refunded:string;remaining:string|null}|null;
  adjustmentsReady:boolean;adjustments:AdjustmentEvidence;adjustableItems:AdjustableItem[]};
const text=(v:unknown)=>{if(typeof v!=='string')invalidResponse('sales text');return v;};
const id=(v:unknown)=>{const value=text(v);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))invalidResponse('sales ID');return value;};
const nullable=(v:unknown)=>v===null?null:text(v);
const boolean=(v:unknown)=>{if(typeof v!=='boolean')invalidResponse('sales boolean');return v;};
const instant=(v:unknown)=>{const value=text(v);if(!Number.isFinite(Date.parse(value)))invalidResponse('sales timestamp');return value;};
const token=(v:unknown)=>{const value=text(v);if(!/^[a-f0-9]{64}$/.test(value))invalidResponse('sales content token');return value;};
const money=(v:unknown)=>{const value=text(v);if(displayDecimal(value,2)<0)invalidResponse('negative sales amount');return value;};
export function decodeRefundBalance(value:unknown):WorkflowSale['refundBalance'] {
  if(value==null)return null;
  const b=record(value);
  const result={paymentId:b.paymentId===null?null:id(b.paymentId),received:b.received===null?null:money(b.received),method:b.method===null?null:choice(text(b.method),['Cash','GCash'] as const),receivedAt:b.receivedAt===null?null:instant(b.receivedAt),refunded:money(b.refunded),remaining:b.remaining===null?null:money(b.remaining)};
  if((result.received===null)!==(result.remaining===null))invalidResponse('incomplete received money');
  if(result.received!==null){
    const remainder=scaledDecimal(result.received,2)-scaledDecimal(result.refunded,2);
    if(!result.paymentId||!result.method||!result.receivedAt||scaledDecimal(result.remaining!,2)!==(remainder>0n?remainder:0n))invalidResponse('inconsistent refund balance');
  }
  return result;
}
export const workflowTarget=(sale:WorkflowSale):WorkflowTarget=>({saleId:sale.id,token:sale.token});
export function decodeWorkflowSale(value:unknown):WorkflowSale {
  const s=record(value);let review:WorkflowReview|null=null;
  const bulk=s.bulkAction===null?null:record(s.bulkAction);
  if(s.review!==null){const r=record(s.review);const d=r.details===null?null:record(r.details);
    review={id:id(r.id),owner:text(r.owner),role:choice(text(r.role),['Owner']),time:instant(r.time),outcome:choice(text(r.outcome),['Matched','Reviewed with discrepancy','Reviewed with explained discrepancy']),
      details:d===null?null:{...decodeRow('daily_sales_reviews',d),orderIds:array(d.orderIds).map(id),cashMovements:array(d.cashMovements).map(c=>decodeRow('cash_movements',c))}};
  }
  return {id:id(s.id),orderNumber:text(s.orderNumber),token:token(s.token),businessDate:date(s.businessDate),occurredAt:instant(s.occurredAt),
    cashierId:id(s.cashierId),cashierName:text(s.cashierName),cashierRole:choice(text(s.cashierRole),['Owner','Admin','Staff']),
    status:choice(text(s.status),['Pending','Completed','Voided']),reviewState:choice(text(s.reviewState),['Owner checkout','Reviewed','Awaiting Owner review']),
    total:money(s.total),method:choice(text(s.method),['Cash','GCash']),reference:nullable(s.reference),stockCommitted:s.stockCommitted===null?null:boolean(s.stockCommitted),usageComplete:s.usageComplete===null?null:boolean(s.usageComplete),
    voidedAt:s.voidedAt===null?null:instant(s.voidedAt),voidedName:nullable(s.voidedName),voidedRole:nullable(s.voidedRole),voidReason:nullable(s.voidReason),bulkActionId:s.bulkActionId===null?null:id(s.bulkActionId),
    bulkAction:bulk===null?null:{operationId:id(bulk.operationId),reason:text(bulk.reason),results:array(bulk.results).map(value=>{const r=record(value);return {saleId:id(r.saleId),outcome:choice(text(r.outcome),['voided','stale','ineligible'])};})},
    receipt:s.receipt===null?null:decodeReceipt(s.receipt),requests:array(s.requests).map(r=>decodeRow('void_requests',r)),events:array(s.events).map(e=>decodeRow('audit_events',e)),review,
    refundBalance:decodeRefundBalance(s.refundBalance),
    adjustmentsReady:s.adjustments!==undefined,adjustments:decodeAdjustments(s.adjustments??{decisions:[],dispositions:[],refunds:[]}),adjustableItems:decodeAdjustableItems(s.adjustableItems??[])};
}
export function decodeWorkflowResult(value:unknown,command:WorkflowCommand):WorkflowResult {
  const r=record(value);if(r.version!==1||r.operationId!==command.operationId||r.kind!==command.kind)invalidResponse('workflow operation result');
  const results=array(r.results).map(value=>{const item=record(value);return {saleId:id(item.saleId),outcome:choice(text(item.outcome),['reviewed','requested','rejected','voided','stale','ineligible','disposed','refunded'])};});
  if(results.length!==command.targets.length||new Set(results.map(r=>r.saleId)).size!==results.length||results.some(r=>!command.targets.some(t=>t.saleId===r.saleId)))invalidResponse('workflow result scope');
  const allowed=command.kind==='review.confirm'?['reviewed']:command.kind==='stock.dispose'?['disposed']:command.kind==='refund.record'?['refunded']:command.kind==='void.request'?['requested']:command.kind==='void.decide'?[command.approved?'voided':'rejected']:['voided','stale','ineligible'];
  if(results.some(r=>!allowed.includes(r.outcome)))invalidResponse('workflow result outcome');
  return {version:1,operationId:id(r.operationId),kind:command.kind,replayed:boolean(r.replayed),results,...(r.reviewId?{reviewId:id(r.reviewId)}:{})};
}
export function restoreWorkflowCommand(value:unknown):WorkflowCommand {
  const c=record(value);id(c.operationId);choice(text(c.kind),['review.confirm','void.request','void.decide','sale.void','stock.dispose','refund.record']);
  const targets=array(c.targets);if(!targets.length||targets.length>500)invalidResponse('workflow targets');
  targets.forEach(v=>{const t=record(v);id(t.saleId);token(t.token);});
  return c as WorkflowCommand; // Full command validation always runs in PostgreSQL.
}
export function createSalesWorkflowData(request:Transport) {
  return {
    async read(signal?:AbortSignal){
      const items:WorkflowSale[]=[];let revision:string|undefined,businessDay:string|undefined;
      for(let offset=0;offset<=1_000_000;offset+=100){
        const r=record(await request(`/api/sales-workflow?limit=100&offset=${offset}`,{signal}));
        if(r.version!==1)invalidResponse('sales workflow version');
        const current=token(r.revision),day=date(r.businessDate);
        if(revision!==undefined&&(current!==revision||day!==businessDay))invalidResponse('sales changed during loading; refresh');
        revision=current;businessDay=day;
        const page=array(r.items).map(decodeWorkflowSale);items.push(...page);
        if(r.hasMore===false){if(new Set(items.map(s=>s.id)).size!==items.length)invalidResponse('duplicate sales');return {items,businessDate:day,revision:current};}
        if(r.hasMore!==true||page.length!==100)invalidResponse('sales pagination');
      }
      return invalidResponse('sales dataset exceeds supported scope');
    },
    async execute(command:WorkflowCommand){return decodeWorkflowResult(await request('/api/sales-workflow/commands',{method:'POST',body:JSON.stringify(command)}),command);},
  };
}
