import SelectionSummary from './SelectionSummary';
import OrderReceiptDetails from './OrderReceiptDetails';
import SalesHistoryHeader from './SalesHistoryHeader';
import TransactionTable from './TransactionTable';
import { useCallback,useEffect,useId,useRef,useState } from 'react';
import { apiRequest } from '../lib/api';
import { ApiError } from '../lib/api-client';
import { createSalesWorkflowData,restoreWorkflowCommand,workflowTarget,type WorkflowCommand,type WorkflowResult,type WorkflowSale } from '../lib/data/sales-workflow';
import { displayDecimal } from '../lib/data/decimal';
import { useLiveResource } from '../lib/live-updates';
import { useViewState } from '../lib/view-state';
import type { DailyReview,Role,Sale } from '../data/demo';
import { businessDate,manilaTime } from '../data/demo';
import DailySalesReview from './DailySalesReview';
import { Actions,Modal } from './ui';


import Pagination,{usePagination} from './Pagination';
import useDiscardChanges from './useDiscardChanges';
import type { ReactNode } from 'react';
import DailyReviewQueue from './DailyReviewQueue';
import type { AuditContext } from '../pages/SalesHistory';
import SaleAdjustmentDialog from './SaleAdjustmentDialog';
import { adjustmentReasons, meaningfulReasonNotes, stockConditions, describePhysicalFacts, laterReturnRemaining, type ReasonId } from '../lib/data/sale-adjustments';

const php=(value:string)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(displayDecimal(value,2));
const sum=(sales:WorkflowSale[])=>sales.reduce((n,s)=>n+displayDecimal(s.total,2),0).toFixed(2);
const awaiting=(sale:WorkflowSale)=>sale.status==='Pending'&&sale.reviewState==='Awaiting Owner review';
const pendingRequest=(sale:WorkflowSale)=>sale.requests.find(r=>r.status==='Pending');
function BundleContents({items}:{items:unknown[]}) {
  return <ul>{items.map((value,index)=>{
    if(!value||typeof value!=='object')return <li key={index}>Historical component details unavailable</li>;
    const item=value as Record<string,unknown>,c=(item.configuration&&typeof item.configuration==='object'?item.configuration:item) as Record<string,unknown>;
    return <li key={index}>{String(item.quantity??'')}× {String(c.name??'Included product')}{typeof c.sku==='string'&&<small>{c.sku}</small>}
      {Array.isArray(c.modifiers)&&c.modifiers.map((m,i)=><small key={i}>{m&&typeof m==='object'?String((m as Record<string,unknown>).name??''):''}</small>)}
      {Array.isArray(c.components)&&c.components.length>0&&<BundleContents items={c.components}/>}</li>;
  })}</ul>;
}
type VoidAction={kind:'void.request'|'void.decide'|'sale.void';sales:WorkflowSale[];approved?:boolean};

function VoidDialog({action,role,actor,onClose,onSave,onDirtyChange}:{action:VoidAction;role:Role;actor:string;onClose:()=>void;onSave:(command:WorkflowCommand)=>Promise<WorkflowResult>;onDirtyChange:(value:boolean)=>void}) {
  const [reason,setReason]=useState('');
  const [reasonId,setReasonId]=useState<ReasonId>('duplicate');
  const [final,setFinal]=useState(false),[error,setError]=useState(''),[saving,setSaving]=useState(false);const busy=useRef(false);
  const ReceiptContext=action.sales.length===1&&!final?'details':'div';
  const isVoid=action.kind==='sale.void'||action.approved===true;
  const formId=useId();
  const dirty=reasonId!=='duplicate'||reason!=='';const discard=useDiscardChanges(dirty,onClose,'void decision');
  useEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false);},[dirty,onDirtyChange]);
  const actions=<Actions><button className="secondary" type="button" disabled={saving} data-initial-focus onClick={()=>final?setFinal(false):discard.requestClose()}>{final?'Go back':'Cancel'}</button>
    <button form={formId} type="submit" className={isVoid&&final?'danger-button':'primary'} disabled={saving||(reasonId==='other'&&!meaningfulReasonNotes(reason))}>{saving?'Saving…':isVoid?(final?`Void ${action.sales.length===1?'order':`${action.sales.length} orders`}`:'Review void'):action.kind==='void.request'?(final?'Send void request':'Review request'):(final?'Reject request':'Review rejection')}</button></Actions>;
  return <><Modal title={final?(isVoid?(action.sales.length===1?'Void this order permanently?':'Void selected orders permanently?'):action.kind==='void.request'?'Confirm void request':'Confirm request rejection'):action.kind==='void.request'?'Request Void':action.approved===false?'Reject void request':action.sales.length>1?'Review Bulk Void':'VOID ORDER'}
    focusOnTitleChange plain={!final&&action.sales.length===1} className={`workflow-modal ${final?'bulk-final-modal':action.sales.length>1?'bulk-modal':'confirmation-modal'}`} onClose={()=>{if(!busy.current)discard.requestClose();}} footer={actions}>
    <form id={formId} inert={saving} onSubmit={async event=>{
      event.preventDefault();if(busy.current||(reasonId==='other'&&!meaningfulReasonNotes(reason)))return;
      if(!final){setFinal(true);return;}
      const base={operationId:crypto.randomUUID(),targets:action.sales.map(workflowTarget),reasonId,notes:reason.trim()};
      const command:WorkflowCommand=action.kind==='void.decide'?{...base,kind:'void.decide',requestId:pendingRequest(action.sales[0])!.id,approved:action.approved===true}:{...base,kind:action.kind};
      busy.current=true;setSaving(true);setError('');
      try{await onSave(command);onClose();}catch(cause){setError(cause instanceof Error?cause.message:'Unable to save. Your reason has been kept.');}
      finally{busy.current=false;setSaving(false);}
    }}>
      {(action.sales.length>1||final)&&<p>{action.sales.length} selected orders · {php(sum(action.sales))} · {actor} ({role})</p>}
      {final&&isVoid&&<p><strong>This action cannot be undone.</strong> The original transactions and all requests remain in Audit Trail. Stock remains deducted until a separate physical disposition is reviewed. This sale correction records no manual payout.</p>}
      {action.kind==='void.request'&&<p>The sale stays unchanged until an Owner or Admin decides your request.</p>}
      {action.sales.length>1&&<p>Only these exact receipts are submitted. Changed or already voided receipts are skipped and reported individually. An unexpected save failure rolls back the whole action.</p>}
      {!final&&action.sales.length===1&&<><p className="order-id">Order ID: {action.sales[0].orderNumber}</p><div className="receipt">{action.sales[0].receipt?.lines.map((line,i)=><p key={i}><strong>•{line.quantity}× {line.name}</strong><strong>{php((displayDecimal(line.unitPrice,2)*line.quantity).toFixed(2))}</strong></p>)}<p className="receipt-total"><strong>Total Due:</strong><strong>{php(action.sales[0].total)}</strong></p></div></>}
      <ReceiptContext className={action.sales.length>1?'bulk-order-list':'void-order-context'}>{action.sales.length===1&&!final&&<><summary>Recorded receipt details</summary><p>Decision recorded as {actor} ({role}).</p></>}{action.sales.map(s=><article key={s.id}><strong>{s.orderNumber}</strong><p>{s.cashierName} · {s.status} · {php(s.total)}</p><small>Receipt ID: {s.id}</small>{final&&<><p>Affected purchased items: {s.receipt?.lines.map(l=>l.quantity+'× '+l.name).join('; ')||'Historical item details unavailable'}</p><p>Stock restored by this action: 0. Existing consumption and physical classifications are retained. Manual payout recorded by this action: ₱0. Approval transfers no money.</p><p>Original stock quantities retained: {s.adjustableItems.flatMap(item=>item.usage.map(u=>item.name+' / '+u.name+': '+u.quantity+' '+u.unit)).join('; ')||'Detailed quantities unavailable in this authorized view; no stock change is inferred.'}</p>{s.adjustments.dispositions.map(d=><p key={d.id}>Historical classification retained: {stockConditions[d.condition]} · {d.quantity_base} original base units. This correction adds 0 restored and 0 newly wasted units.</p>)}{s.adjustments.refunds.map(r=><p key={r.id}>Already recorded manual payout: ₱{r.amount} ({r.method}) · {r.reference} · Paid {r.paid_at} · Recorded {r.recorded_at}</p>)}</>}
        {pendingRequest(s)&&<p>Original request: {pendingRequest(s)!.reason} · {pendingRequest(s)!.requested_name} ({pendingRequest(s)!.requested_role})</p>}
        <p>{s.stockCommitted===true?'Recorded stock consumption is retained.':'Historical stock handling is not assumed.'} No automatic refund or stock return.</p></article>)}</ReceiptContext>
      {final?<p>Decision reason: {adjustmentReasons[reasonId]} · {reason||'No extra notes'}</p>:<><label>{action.kind==='void.request'?'Reason for request':'Decision reason'}<select value={reasonId} onChange={e=>setReasonId(e.target.value as ReasonId)}>{Object.entries(adjustmentReasons).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Extra notes{reasonId==='other'?' (required)':' (optional)'}<textarea required={reasonId==='other'} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label></>}
      {reasonId==='refund_return'&&<p>A refund / return reason records the sale correction only. Review physical returns and any actual manual payout separately.</p>}
      {reasonId==='other'&&!meaningfulReasonNotes(reason)&&<p>Explain Other using words or numbers; spaces and punctuation alone are insufficient.</p>}
      {error&&<p className="error" role="alert">{error}</p>}
    </form>
  </Modal>{discard.confirmation}</>;
}

export default function LiveSales({scope,role,actor,active,dashboard,onBusyChange,onUncertainChange,onDirtyChange,dashboardContent,context}:{context?:AuditContext;dashboardContent?:(onReview:(date:string)=>void)=>ReactNode;scope:string;role:Role;actor:string;active:boolean;dashboard:boolean;onAudit:()=>void;onBusyChange:(value:boolean)=>void;onUncertainChange:(value:boolean)=>void;onDirtyChange:(value:boolean)=>void}) {
  const [service]=useState(()=>createSalesWorkflowData(apiRequest));
  const load=useCallback((signal:AbortSignal)=>service.read(signal),[service]);
  const resource=useLiveResource(scope,load,['sales']),manager=role!=='Staff';
  const [search,setSearch]=useViewState('LiveSales.search',''),[day,setDay]=useViewState('LiveSales.day','');
  const [status,setStatus]=useViewState('LiveSales.status','All statuses'),[method,setMethod]=useViewState('LiveSales.method','All payments');
  const [requestsOnly,setRequestsOnly]=useViewState('LiveSales.requestsOnly',false),[allRequests,setAllRequests]=useViewState('LiveSales.allRequests',false);
  const [selected,setSelected]=useViewState<string|null>('LiveSales.selected',null);
  const [checked,setChecked]=useState<Record<string,WorkflowSale>>({});
  const [review,setReview]=useState<{day:string;sales:WorkflowSale[]}|null>(null),[action,setAction]=useState<VoidAction|null>(null);
  const [adjustment,setAdjustment]=useState<{sale:WorkflowSale;kind:'stock.dispose'|'refund.record'}|null>(null);
  const [linkedIds,setLinkedIds]=useViewState<string[]|null>('LiveSales.linkedIds',null);
  const [appliedContext,setAppliedContext]=useState<number>();
  useEffect(()=>{if(!context)return;setSelected(context.selected??null);setDay(context.date??'');setSearch(context.search??'');setAllRequests(context.allReviews===true);setRequestsOnly(context.requestsOnly===true);setLinkedIds(context.linkedOnly?context.orderIds??[]:null);setStatus('All statuses');setMethod('All payments');setChecked({});setAppliedContext(context.token);},[context]);
  const recoveryKey=`vertwell-sales-workflow:${scope.split(':')[0]}`;
  const [pending,setPending]=useState<WorkflowCommand|null>(null),[recovery,setRecovery]=useState(false),[recoveryError,setRecoveryError]=useState('');
  const [results,setResults]=useState<WorkflowResult|null>(null),[error,setError]=useState(''),[working,setWorking]=useState(false);
  const busy=useRef(false),uncertain=useRef(false),dirty=useRef(false);
  const reportDirty=useCallback((value:boolean)=>{dirty.current=value;onDirtyChange(value);},[onDirtyChange]);
  useEffect(()=>{
    try{const saved=sessionStorage.getItem(recoveryKey);if(saved){setPending(restoreWorkflowCommand(JSON.parse(saved)));setRecovery(true);uncertain.current=true;}}
    catch{setRecovery(true);uncertain.current=true;setRecoveryError('Saved action could not be read. Keep this tab and ask an Owner to inspect recorded history before recreating the action.');}
  },[recoveryKey]);
  useEffect(()=>{onUncertainChange(recovery);return()=>onUncertainChange(false);},[recovery,onUncertainChange]);
  useEffect(()=>{if(!active&&!recovery&&!busy.current){setAction(null);setAdjustment(null);setReview(null);reportDirty(false);}},[active,recovery,reportDirty]);
  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>{if(dirty.current||uncertain.current||busy.current){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[]);
  // Recheck the day boundary even when a Staff tab stays open overnight.
  useEffect(()=>{
    const now=Date.now(),next=Math.floor((now+8*3600000)/86400000)*86400000+86400000-8*3600000;
    const timer=setTimeout(()=>resource.reload(),Math.max(1,next-now));return()=>clearTimeout(timer);
  },[resource.reload,resource.data?.businessDate]);
  async function save(command:WorkflowCommand) {
    if(busy.current)throw new Error('A sales action is already being saved.');
    busy.current=true;setWorking(true);onBusyChange(true);setError('');
    const hadUncertain=uncertain.current;
    try {
      try{sessionStorage.setItem(recoveryKey,JSON.stringify(command));}catch{throw new ApiError('Enable session storage before saving so this action can be recovered.','validation');}
      setPending(command);
      try{
        const result=await service.execute(command);
        setPending(null);setRecovery(false);uncertain.current=false;setRecoveryError('');sessionStorage.removeItem(recoveryKey);
        setResults(result);setAction(null);setAdjustment(null);setReview(null);reportDirty(false);
        setChecked(current=>Object.fromEntries(Object.entries(current).filter(([id])=>!result.results.some(r=>r.saleId===id&&!['stale','ineligible'].includes(r.outcome)))));
        resource.reload();return result;
      }catch(cause){
        const rejected=!hadUncertain&&cause instanceof ApiError&&['validation','conflict','forbidden','unauthorized','not-found'].includes(cause.kind);
        if(rejected){setPending(null);sessionStorage.removeItem(recoveryKey);}
        else{uncertain.current=true;setRecovery(true);setRecoveryError(cause instanceof Error?cause.message:'Response was lost. Retry the saved action.');}
        throw cause;
      }
    }finally{busy.current=false;setWorking(false);onBusyChange(false);}
  }
  const data=(resource.data?.items??[]).filter(s=>manager||s.businessDate===businessDate()),chosen=Object.values(checked);
  const filtered=data.filter(s=>(!day||s.businessDate===day)&&(!linkedIds||linkedIds.includes(s.id))&&(status==='All statuses'||s.status===status)&&(method==='All payments'||s.method===method)&&
    (!requestsOnly||pendingRequest(s))&&(!allRequests||pendingRequest(s)||awaiting(s))&&`${s.id} ${s.orderNumber} ${s.cashierName} ${s.reference??''} ${s.receipt?.lines.map(l=>`${l.name} ${l.sku}`).join(' ')??''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const paging=usePagination(filtered,JSON.stringify([day,status,method,search,requestsOnly,allRequests,linkedIds]));
  const selectedPage=useRef<number|undefined>(undefined);
  const selectAll=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    if(!context?.selected||appliedContext!==context.token||!resource.data||selectedPage.current===context.token)return;
    const index=filtered.findIndex(s=>s.id===context.selected);if(index>=0){paging.setPage(Math.floor(index/paging.pageSize)+1);selectedPage.current=context.token;}
  },[context,appliedContext,resource.data,filtered,paging]);
  const eligible=paging.records.filter(s=>s.status!=='Voided'),hidden=chosen.filter(s=>!paging.records.some(p=>p.id===s.id));
  useEffect(()=>{if(selectAll.current)selectAll.current.indeterminate=eligible.some(s=>Boolean(checked[s.id]))&&!eligible.every(s=>Boolean(checked[s.id]));});
  const sale=chosen.length>=2?undefined:chosen.length===1?chosen[0]:data.find(s=>s.id===selected);
  async function confirmReview(input:DailyReview) {
    if(!review)throw new Error('Reopen the receipt set before confirming.');
    await save({operationId:input.id,kind:'review.confirm',targets:review.sales.filter(s=>input.orderIds.includes(s.id)).map(workflowTarget),review:{date:input.date,
      countedCash:input.countedCash.toFixed(2),verifiedGCash:input.actualGCash.toFixed(2),openingCash:input.openingCash.toFixed(2),additions:input.additions.toFixed(2),removals:input.removals.toFixed(2),refunds:input.refunds.toFixed(2),explanation:input.explanation,verifiedIds:input.orderIds}});
    return true;
  }
  return <div className="live-sales" hidden={!active}>
    {resource.status==='loading'&&<p role="status">Loading saved sales history…</p>}
    {resource.error&&<div className="error" role="alert"><p>{resource.error.message} Your existing view is retained.</p><button className="secondary" onClick={resource.reload}>Retry loading sales</button></div>}
    {error&&<p className="error" role="alert">{error}</p>}
    {results&&<section className="inventory-editor-note" aria-label="Sales action result" role="status"><h2>Saved action result{results.replayed?' · reconciled retry':''}</h2>
      <p>{results.results.filter(r=>!['stale','ineligible'].includes(r.outcome)).length} saved · {results.results.filter(r=>['stale','ineligible'].includes(r.outcome)).length} skipped</p>
      <ul>{results.results.map(r=><li key={r.saleId}>{data.find(s=>s.id===r.saleId)?.orderNumber??r.saleId}: {r.outcome}{['stale','ineligible'].includes(r.outcome)?' — refresh, review and reselect before another action.':''}</li>)}</ul></section>}
    {dashboard&&dashboardContent?.(date=>{const orders=data.filter(s=>awaiting(s)&&s.businessDate===date);if(!working&&!recovery&&resource.status==='ready'&&orders.length)setReview({day:date,sales:orders.slice(0,500)});})}

    {!dashboard&&active&&<section className="history-layout"><div className="history-main"><SalesHistoryHeader role={role} orders={data.length} pending={data.filter(s=>s.status==='Pending').length} requests={data.filter(s=>Boolean(pendingRequest(s))).length} search={search} date={day} onSearch={setSearch} onDate={setDay} maxDate={businessDate()}/><div className="audit-filters">
      <label>Order status<select aria-label="Order status" value={status} onChange={e=>setStatus(e.target.value)}>{['All statuses','Pending','Completed','Voided'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Payment method<select aria-label="Payment method" value={method} onChange={e=>setMethod(e.target.value)}>{['All payments','Cash','GCash'].map(v=><option key={v}>{v}</option>)}</select></label>
      {manager&&<button className={`request-filter secondary ${data.some(s=>pendingRequest(s))?'attention-required':''}`} aria-pressed={requestsOnly} onClick={()=>{setRequestsOnly(!requestsOnly);setAllRequests(false);}}>{requestsOnly?'Show all sales':`Void requests (${data.filter(s=>pendingRequest(s)).length})`}</button>}
      {manager&&<button className="secondary" aria-pressed={allRequests} onClick={()=>{setAllRequests(!allRequests);setRequestsOnly(false);}}>All review requests</button>}
    </div><div className="filter-summary" role="status">{filtered.length} matching orders · {day||(manager?'All dates':'Current day')} · {allRequests?'Daily sales and void requests':requestsOnly?'Pending void requests':status} · {method}{search.trim()?` · Search: “${search.trim()}”`:''}{linkedIds?` · ${linkedIds.length} linked orders`:''}
      {(day||search||linkedIds||requestsOnly||allRequests||status!=='All statuses'||method!=='All payments')&&<button className="secondary" onClick={()=>{setSearch('');setDay('');setLinkedIds(null);setStatus('All statuses');setMethod('All payments');setRequestsOnly(false);setAllRequests(false);}}>Clear filters</button>}</div>
    {manager&&<DailyReviewQueue sales={data.map(s=>({id:s.id,time:s.occurredAt,total:displayDecimal(s.total,2),status:s.status,reviewState:s.reviewState,paymentState:'Received',fulfilmentState:'Fulfilled'} as Sale))} date={day} disabled={working||recovery||resource.status!=='ready'} onReview={date=>setReview({day:date,sales:data.filter(s=>awaiting(s)&&s.businessDate===date).slice(0,500)})}/>}
    {manager&&<div className="bulk-toolbar"><label><input ref={selectAll} type="checkbox" aria-label="Select all eligible orders on this page" disabled={!eligible.length} checked={eligible.length>0&&eligible.every(s=>Boolean(checked[s.id]))} onChange={e=>setChecked(current=>{
      const next={...current};for(const s of eligible){if(e.target.checked)next[s.id]=s;else delete next[s.id];}return next;
    })}/>Select all eligible orders on this page</label><p>{chosen.length} selected · {php(sum(chosen))}</p>
      {hidden.length>0&&<p className="selection-notice">{hidden.length} selected orders are outside the current page or filters. IDs: {hidden.map(s=>s.orderNumber).join(', ')}. <button className="secondary" onClick={()=>setChecked(Object.fromEntries(chosen.filter(s=>paging.records.some(p=>p.id===s.id)).map(s=>[s.id,s])))}>Keep visible selection only</button></p>}
      <button className="secondary" disabled={!chosen.length} onClick={()=>setChecked({})}>Clear selection</button><button className="primary" disabled={!chosen.length||chosen.some(s=>!s.adjustmentsReady)||chosen.length>500||working||recovery||resource.status!=='ready'} onClick={()=>setAction({kind:'sale.void',sales:chosen})}>Bulk Void</button>{chosen.length>500&&<p>Choose at most 500 receipts per action.</p>}</div>}
    <TransactionTable manager={manager} selected={selected} checked={Object.keys(checked)} onSelect={id=>{setChecked({});setSelected(!chosen.length&&selected===id?null:id);}} onCheck={(id,value)=>setChecked(current=>{const next={...current};if(value){const sale=data.find(s=>s.id===id);if(sale)next[id]=sale;}else delete next[id];return next;})}
      rows={paging.records.map(s=>({id:s.id,label:s.orderNumber,time:s.occurredAt,cashier:s.cashierName,cashierRole:s.cashierRole,status:s.status,request:Boolean(pendingRequest(s)),items:s.receipt?.lines.map((line,i)=><span className="sale-item" key={i}>•{line.quantity}× {line.name}</span>)??'Historical receipt'}))}
      empty={resource.data&&<p className="empty-state">No transactions match this view.</p>}/><Pagination label="Transactions" {...paging}/></div>
    <aside className="order-panel details-panel"><h2>{chosen.length>=2?'Selection summary':'Order Details'}</h2><div className="sale-details" role="region" aria-label="Order items, payment and review timeline" tabIndex={sale?0:undefined}>
      {chosen.length>=2&&<SelectionSummary count={chosen.length} total={php(sum(chosen))} cash={php(sum(chosen.filter(s=>s.method==='Cash')))} gcash={php(sum(chosen.filter(s=>s.method==='GCash')))} pending={chosen.filter(s=>s.status==='Pending').length} completed={chosen.filter(s=>s.status==='Completed').length} hidden={hidden.map(s=>s.orderNumber)}/>}
      {sale&&!filtered.some(s=>s.id===sale.id)&&<p className="selected-order-notice" role="status">This order is outside the current filters. Its details remain open for reference.</p>}
      {!sale?chosen.length<2&&<div className="cart-empty"><strong>Select a transaction</strong><p>Open an order to review its items, payment, and audit details.</p></div>:<><OrderReceiptDetails id={sale.orderNumber} cashier={sale.cashierName} role={sale.cashierRole} method={sale.method} time={manilaTime(sale.occurredAt)} status={sale.status} total={php(sale.total)} review={sale.reviewState}
        missing={!sale.receipt?'Purchased configuration details are unavailable for this historical receipt.':undefined}
        lines={sale.receipt?.lines.map((line,i)=>({key:i,name:line.name,quantity:line.quantity,amount:php((displayDecimal(line.unitPrice,2)*line.quantity).toFixed(2)),details:<><small className="receipt-modifier">SKU: {line.sku}</small>{line.modifiers.map(m=><small className="receipt-modifier" key={m.id}>{m.name} · +{php(m.price)}</small>)}{line.components.length>0&&<small className="receipt-modifier">Includes: <BundleContents items={line.components}/></small>}</>}))}/>
        {sale.reference&&<p>GCash reference: {sale.reference}. Recorded evidence; provider verification is separate.</p>}
        <p>{sale.stockCommitted===true?'Recorded stock consumption is retained.':sale.stockCommitted===false?'No stock deduction was recorded.':'Historical stock handling was not recorded.'} Review and void actions do not deduct or return stock. Voids do not refund payments.</p>
        {sale.review&&<section aria-label="Recorded Daily Sales Review"><h3>Daily Sales Review</h3><p>{sale.review.owner} ({sale.review.role}) · {manilaTime(sale.review.time)} · {sale.review.outcome}</p>
          {sale.review.details&&<><p>Expected Cash / GCash: {php(sale.review.details.expected_cash)} / {php(sale.review.details.expected_gcash)}</p><p>Verified Cash / GCash: {php(sale.review.details.verified_cash)} / {php(sale.review.details.verified_gcash)}</p>
            <p>Counted cash: {php(sale.review.details.counted_cash)}. Opening: {php(sale.review.details.opening_cash)} · Additions: {php(sale.review.details.additions)} · Removals: {php(sale.review.details.removals)} · Refund adjustments: {php(sale.review.details.refunds)}</p>
            <p>{sale.review.details.explanation||(sale.review.outcome==='Matched'?'Receipts matched expected amounts.':'The Owner accepted the difference without a review note.')}</p><p>Included receipt IDs: {sale.review.details.orderIds.join(', ')}</p><p>{sale.review.details.cashMovements.length} saved reconciliation adjustments. Entered at review time; no provider refund was issued. Aggregate Refund entries are reconciliation evidence, not additional payouts; do not add them to the manual-refund ledger.</p></>}
        </section>}
        {sale.adjustments.decisions.filter(d=>['void.request','void.decide','sale.void'].includes(d.kind)).map(d=><section className="void-request" key={d.operationId}><h3>{d.kind==='void.request'?'Recorded request reason':'Submitted decision reason'}</h3><p>{d.reasonLabel}</p><p>{d.notes||'No extra notes'}</p><p>{d.actorName} ({d.actorRole}) · {manilaTime(d.occurredAt)}</p><small>Actor: {d.actorId} · Operation: {d.operationId}</small></section>)}
        {sale.requests.map(r=><section className="void-request" key={r.id}><h3>Void request · {r.status}</h3><small>Request: {r.id} · Source actor: {r.requested_by} · Decision actor: {r.reviewed_by??'Awaiting decision'}</small><p>{r.reason}</p><p>{r.requested_name} ({r.requested_role}) · {manilaTime(r.requested_at)}</p>{r.reviewed_at&&<p>{r.reviewed_name} ({r.reviewed_role}) · {manilaTime(r.reviewed_at)} · {r.decision_reason}</p>}</section>)}
        {sale.voidedAt&&<p>Voided by {sale.voidedName} ({sale.voidedRole}) · {manilaTime(sale.voidedAt)} · {sale.voidReason}{sale.bulkActionId&&<> · Batch action: {sale.bulkActionId}</>}</p>}
        {sale.bulkAction&&<details><summary>Recorded bulk action results</summary><p>{sale.bulkAction.reason}</p><ul>{sale.bulkAction.results.map(r=><li key={r.saleId}>{r.saleId}: {r.outcome}</li>)}</ul></details>}
        <section className="audit-timeline" aria-label="Order review timeline"><h3>Order review timeline</h3><ol>{sale.events.map(e=><li key={e.id}><strong>{e.event_type}</strong><p>{e.actor_name} ({e.actor_role}) · {manilaTime(e.occurred_at)}</p><p>{e.reason}</p><small>Operation: {e.operation_id}</small></li>)}</ol></section>
      </>}
    </div><div className="details-footer">
      {sale&&!sale.adjustmentsReady&&<p role="alert">New sale adjustments require the reviewed additive database migrations. New decisions are unavailable until they are approved and applied.</p>}
      {manager&&sale&&<section aria-label="Recorded adjustments"><h3>Stock and manual refunds</h3><p>Source sale: {sale.orderNumber} · {sale.id}. Recorded received money: {sale.refundBalance?.received==null?'Unavailable / inconsistent':`₱${sale.refundBalance.received}`} · Prior manual refunds: ₱{sale.refundBalance?.refunded??'0.00'} · Remaining refundable: {sale.refundBalance?.remaining==null?'Unavailable':`₱${sale.refundBalance.remaining}`}.</p>
        {sale.adjustments.dispositions.map(d=><p key={d.id}>Historical disposition {d.id} · {sale.adjustableItems.find(i=>i.id===d.sale_item_id)?.name??d.sale_item_id} / {sale.adjustableItems.find(i=>i.id===d.sale_item_id)?.usage.find(u=>u.stockId===d.stock_item_id)?.name??d.stock_item_id}: {d.quantity_base} original base units · {stockConditions[d.condition]} · {d.sourceDispositionId&&<span>Later return linked to {d.sourceDispositionId}. </span>}{d.evidence} · {d.condition==='not_returned'&&<span>Current outstanding missing: {Number(laterReturnRemaining(d,sale.adjustments).toFixed(6))} original base units after linked returns. </span>}{d.condition==='returned_unsellable'&&<span>Custody at recording time only; current custody balance unavailable. Not sellable or newly reconciled warehouse stock. </span>}Physical facts: {describePhysicalFacts(d.physicalFacts)} · {d.actor_name} ({d.actor_role}) · {d.occurred_at} · Actor {d.actor_id??'Historical ID unavailable'} · Original consumption / return links: {d.allocations.map(a=>a.source_movement_id+(a.return_movement_id?' → '+a.return_movement_id:'')).join('; ')} · Operation {d.operation_id}</p>)}
        {sale.adjustments.refunds.map(r=><p key={r.id}>Manually paid refund ₱{r.amount} ({r.method}) · {r.reference} · Paid {r.paid_at} · Recorded {r.recorded_at} · {r.actor_name} ({r.actor_role}) · {r.evidence}. Provider transfer unverified. Source sale {r.sale_id??sale.id} · Payment {r.payment_id??'Historical link unavailable'} · {r.method==='Cash'?`Cash movement ${r.cash_movement_id??'Link unavailable'}`:'GCash manual operator evidence only'} · Actor {r.actor_id??'Historical ID unavailable'} · Operation {r.operation_id}.</p>)}
        {!sale.adjustments.refunds.length&&<p>No actual manual payout recorded for this receipt. A void alone does not establish money owed.</p>}
      </section>}
      {manager&&sale&&<><button className="secondary" disabled={!sale.adjustmentsReady||working||recovery||resource.status!=='ready'} onClick={()=>setAdjustment({sale,kind:'stock.dispose'})}>Review stock disposition</button><button className="secondary" disabled={!sale.adjustmentsReady||working||recovery||resource.status!=='ready'} onClick={()=>setAdjustment({sale,kind:'refund.record'})}>Record manual refund</button></>}
      {role==='Staff'&&<p className="staff-payment-note">Void requests need Owner or Admin approval. The original sale stays in your history.</p>}
      <button className="primary" disabled={!sale||!sale.adjustmentsReady||sale.status==='Voided'||working||recovery||resource.status!=='ready'||(!manager&&Boolean(sale&&pendingRequest(sale)))} onClick={()=>{if(sale)setAction({kind:manager?(pendingRequest(sale)?'void.decide':'sale.void'):'void.request',sales:[sale],approved:manager?true:undefined});}}>
        {manager?(sale&&pendingRequest(sale)?'Approve Void':'VOID'):(sale&&pendingRequest(sale)?'Request Pending':'Request Void')}</button>
      {manager&&sale&&pendingRequest(sale)&&<button className="secondary reject-void" disabled={working||recovery||resource.status!=='ready'} onClick={()=>setAction({kind:'void.decide',sales:[sale],approved:false})}>Reject Request</button>}
    </div></aside></section>}
    {review&&<DailySalesReview persistent date={review.day} role={role} owner={actor} onDirtyChange={reportDirty} onClose={()=>setReview(null)} onConfirm={confirmReview}
      refundEvidence={review.sales.flatMap(s=>s.adjustments.refunds.map(r=>({saleId:s.id,orderNumber:s.orderNumber,amount:r.amount,method:r.method,reference:r.reference,paidAt:r.paid_at,cashMovementId:r.cash_movement_id??null})))}
      sales={review.sales.map(s=>({id:s.id,time:s.occurredAt,cashier:s.cashierName,cashierRole:s.cashierRole as Role,total:displayDecimal(s.total,2),status:s.status,reviewState:s.reviewState,method:s.method,reference:s.reference??undefined,lines:[]} as Sale))}/>}
    {action&&<VoidDialog action={action} role={role} actor={actor} onSave={save} onClose={()=>setAction(null)} onDirtyChange={reportDirty}/>}
    {adjustment&&<SaleAdjustmentDialog {...adjustment} onSave={save} onClose={()=>setAdjustment(null)} onDirtyChange={reportDirty}/>}
    {recovery&&<Modal title="Reconcile saved sales action" onClose={()=>{}} className="bulk-modal"><p>The result of a saved action needs confirmation. Retry the exact saved action to retrieve its recorded result before creating another action.</p>
      {pending&&<><p>Action: {pending.kind} · Operation: {pending.operationId}</p><p>Included receipt IDs: {pending.targets.map(t=>t.saleId).join(', ')}</p></>}
      {recoveryError&&<p role="alert" className="error">{recoveryError}</p>}<p>Refreshing this tab keeps the saved action. Closing the tab can clear browser session storage; inspect recorded history before recreating it afterward.</p>
      <Actions><button className="primary" disabled={working||!pending} onClick={()=>{if(pending)void save(pending).catch(cause=>setRecoveryError(cause instanceof Error?cause.message:'Retry failed; saved action retained.'));}}>{working?'Reconciling…':'Retry saved action'}</button></Actions></Modal>}
  </div>;
}
