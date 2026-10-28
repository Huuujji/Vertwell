import { array,record,decodeRow,date,invalidResponse } from './contracts';
import type { Row } from './database.generated';
import type { createApiClient } from '../api-client';
import { decodeAdjustments, type AdjustmentEvidence } from './sale-adjustments';

export const reportTables=['inventory_units','skus','stock_items','stock_batches','stock_movements','sales','sale_items',
  'sale_item_modifiers','sale_item_stock_usage','payments','daily_sales_reviews','daily_sales_review_items','cash_movements','void_requests'] as const;
export type ReportSnapshot={version:1;generatedAt:string;businessDate:string;tables:{[T in typeof reportTables[number]]:Row<T>[]};adjustments?:{saleId:string;evidence:AdjustmentEvidence}[]};
export function decodeReports(value:unknown):ReportSnapshot {
  const r=record(value),t=record(r.tables);
  if(r.version!==1||typeof r.generatedAt!=='string'||!Number.isFinite(Date.parse(r.generatedAt)))invalidResponse('report snapshot');
  const tables=Object.fromEntries(reportTables.map(name=>{
    const rows=array(t[name]).map(row=>decodeRow(name,row));
    const ids=rows.map(row=>{const v=record(row);return v.id??v.code??`${v.review_id}:${v.sale_id}`;});
    if(new Set(ids).size!==ids.length)invalidResponse('duplicate report rows');
    return [name,rows];
  })) as ReportSnapshot['tables'];
  const adjustments=r.adjustments===undefined?undefined:array(r.adjustments).map(value=>{const a=record(value);if(typeof a.saleId!=='string')invalidResponse('adjusted sale');return {saleId:a.saleId as string,evidence:decodeAdjustments(a.evidence)};});
  return {version:1,generatedAt:r.generatedAt,businessDate:date(r.businessDate),tables,adjustments};
}
export const createReportsData=(request:ReturnType<typeof createApiClient>)=>({
  async read(signal?:AbortSignal){return decodeReports(await request('/api/reports',{signal}));},
});
