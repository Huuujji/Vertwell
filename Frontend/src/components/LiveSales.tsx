import { useCallback,useEffect,useRef,useState } from 'react';
import { apiRequest } from '../lib/api';
import { ApiError } from '../lib/api-client';
import { createSalesWorkflowData,restoreWorkflowCommand,workflowTarget,type WorkflowCommand,type WorkflowResult,type WorkflowSale } from '../lib/data/sales-workflow';
import { displayDecimal } from '../lib/data/decimal';
import { useResource } from '../lib/request-state';
import { useViewState } from '../lib/view-state';
import type { DailyReview,Role,Sale } from '../data/demo';
import { businessDate,manilaTime } from '../data/demo';
import DailySalesReview from './DailySalesReview';
import { Actions,Modal } from './ui';
import SearchField from './SearchField';
import DateField from './DateField';
import Pagination,{usePagination} from './Pagination';
import useDiscardChanges from './useDiscardChanges';

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
  const [reason,setReason]=useState(action.kind==='void.request'?'':pendingRequest(action.sales[0])?.reason??'Duplicate transaction');
  const [final,setFinal]=useState(false),[error,setError]=useState(''),[saving,setSaving]=useState(false);const busy=useRef(false);
  const isVoid=action.kind==='sale.void'||action.approved===true;
  const dirty=Boolean(reason.trim());const discard=useDiscardChanges(dirty,onClose,'void decision');
  useEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false);},[dirty,onDirtyChange]);
  return <><Modal title={final?'Void selected orders permanently?':action.kind==='void.request'?'Request Void':action.approved===false?'Reject void request':action.sales.length>1?'Review Bulk Void':'VOID ORDER'}
    className="bulk-modal" onClose={()=>{if(!busy.current)discard.requestClose();}}>
    <form inert={saving} onSubmit={async event=>{
      event.preventDefault();if(busy.current||!reason.trim())return;
      if(isVoid&&!final){setFinal(true);return;}
      const base={operationId:crypto.randomUUID(),targets:action.sales.map(workflowTarget),reason:reason.trim()};
      const command:WorkflowCommand=action.kind==='void.decide'?{...base,kind:'void.decide',requestId:pendingRequest(action.sales[0])!.id,approved:action.approved===true}:{...base,kind:action.kind};
      busy.current=true;setSaving(true);setError('');
      try{await onSave(command);onClose();}catch(cause){setError(cause instanceof Error?cause.message:'Unable to save. Your reason has been kept.');}
      finally{busy.current=false;setSaving(false);}
    }}>
      <p>{action.sales.length} selected orders · {php(sum(action.sales))} · {actor} ({role})</p>
      {final&&<p><strong>This action cannot be undone.</strong> The original transactions and all requests remain in Audit Trail. No payment refund or stock return is performed.</p>}
      {action.kind==='void.request'&&<p>The sale stays unchanged until an Owner or Admin decides your request.</p>}
      {action.sales.length>1&&<p>Only these exact receipts are submitted. Changed or already voided receipts are skipped and reported individually. An unexpected save failure rolls back the whole action.</p>}
      <div className="bulk-order-list">{action.sales.map(s=><article key={s.id}><strong>{s.orderNumber}</strong><p>{s.cashierName} · {s.status} · {php(s.total)}</p><small>Receipt ID: {s.id}</small>
        {pendingRequest(s)&&<p>Original request: {pendingRequest(s)!.reason} · {pendingRequest(s)!.requested_name} ({pendingRequest(s)!.requested_role})</p>}
        <p>{s.stockCommitted===true?'Recorded stock consumption is retained.':'Historical stock handling is not assumed.'} No automatic refund or stock return.</p></article>)}</div>
      {final?<p>Decision reason: {reason}</p>:<label>{action.kind==='void.request'?'Reason for request':'Decision reason'}<textarea required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>}
      {error&&<p className="error" role="alert">{error}</p>}
      <Actions><button className="secondary" type="button" data-initial-focus onClick={()=>final?setFinal(false):discard.requestClose()}>{final?'Go back':'Cancel'}</button>
        <button className={isVoid&&final?'danger-button':'primary'} disabled={saving||!reason.trim()}>{saving?'Saving…':isVoid?(final?`Void ${action.sales.length===1?'order':`${action.sales.length} orders`}`:'Review void'):action.kind==='void.request'?'Send void request':'Reject request'}</button></Actions>
    </form>
  </Modal>{discard.confirmation}</>;
}

export default function LiveSales({scope,role,actor,active,dashboard,onAudit,onBusyChange,onUncertainChange,onDirtyChange}:{scope:string;role:Role;actor:string;active:boolean;dashboard:boolean;onAudit:()=>void;onBusyChange:(value:boolean)=>void;onUncertainChange:(value:boolean)=>void;onDirtyChange:(value:boolean)=>void}) {
  const [service]=useState(()=>createSalesWorkflowData(apiRequest));
  const load=useCallback((signal:AbortSignal)=>service.read(signal),[service]);
  const resource=useResource(scope,load),manager=role!=='Staff';
  const [search,setSearch]=useViewState('LiveSales.search',''),[day,setDay]=useViewState('LiveSales.day','');
  const [status,setStatus]=useViewState('LiveSales.status','All statuses'),[method,setMethod]=useViewState('LiveSales.method','All payments');
  const [requestsOnly,setRequestsOnly]=useViewState('LiveSales.requestsOnly',false),[allRequests,setAllRequests]=useViewState('LiveSales.allRequests',false);
  const [selected,setSelected]=useViewState<string|null>('LiveSales.selected',null);
  const [checked,setChecked]=useState<Record<string,WorkflowSale>>({});
  const [review,setReview]=useState<{day:string;sales:WorkflowSale[]}|null>(null),[action,setAction]=useState<VoidAction|null>(null);
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
  useEffect(()=>{if(!active&&!recovery&&!busy.current){setAction(null);setReview(null);reportDirty(false);}},[active,recovery,reportDirty]);
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
        setResults(result);setAction(null);setReview(null);reportDirty(false);
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
  const filtered=data.filter(s=>(!day||s.businessDate===day)&&(status==='All statuses'||s.status===status)&&(method==='All payments'||s.method===method)&&
    (!requestsOnly||pendingRequest(s))&&(!allRequests||pendingRequest(s)||awaiting(s))&&`${s.id} ${s.orderNumber} ${s.cashierName} ${s.reference??''} ${s.receipt?.lines.map(l=>`${l.name} ${l.sku}`).join(' ')??''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const paging=usePagination(filtered,JSON.stringify([day,status,method,search,requestsOnly,allRequests]));
  const eligible=paging.records.filter(s=>s.status!=='Voided'),hidden=chosen.filter(s=>!paging.records.some(p=>p.id===s.id));
  const sale=data.find(s=>s.id===selected),dates=[...new Set(data.filter(s=>awaiting(s)&&(!day||s.businessDate===day)).map(s=>s.businessDate))].sort().reverse();
  async function confirmReview(input:DailyReview) {
    if(!review)throw new Error('Reopen the receipt set before confirming.');
    await save({operationId:input.id,kind:'review.confirm',targets:review.sales.map(workflowTarget),review:{date:input.date,
      countedCash:input.countedCash.toFixed(2),verifiedGCash:input.actualGCash.toFixed(2),openingCash:input.openingCash.toFixed(2),additions:input.additions.toFixed(2),removals:input.removals.toFixed(2),refunds:input.refunds.toFixed(2),explanation:input.explanation,verifiedIds:input.orderIds}});
    return true;
  }
  return <div className="live-sales" hidden={!active}>
    <div className="page-heading"><div><h1>{dashboard?'Daily Sales Review':manager?'Audit Trail':'Today’s Sales History'}</h1><p className="subtitle">{manager?'Recorded sales, receipt reviews and every void request/decision.':'Your own recorded sales and requests for today.'}</p></div>
      <button className="secondary" disabled={working||Boolean(review||action)||recovery} onClick={resource.reload}>Refresh sales history</button></div>
    {resource.status==='loading'&&<p role="status">Loading saved sales history…</p>}
    {resource.error&&<p className="error" role="alert">{resource.error.message} Your existing view is retained; refresh before making a new decision.</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {results&&<section className="inventory-editor-note" aria-label="Sales action result" role="status"><h2>Saved action result{results.replayed?' · reconciled retry':''}</h2>
      <p>{results.results.filter(r=>!['stale','ineligible'].includes(r.outcome)).length} saved · {results.results.filter(r=>['stale','ineligible'].includes(r.outcome)).length} skipped</p>
      <ul>{results.results.map(r=><li key={r.saleId}>{data.find(s=>s.id===r.saleId)?.orderNumber??r.saleId}: {r.outcome}{['stale','ineligible'].includes(r.outcome)?' — refresh, review and reselect before another action.':''}</li>)}</ul></section>}
    {manager&&<section className="audit-daily-reviews" aria-label="Daily Sales Review queue"><h2>Daily Sales Review</h2><p>Stock was consumed at checkout. Owner confirmation never deducts it again.</p>
      {dates.map(date=>{const orders=data.filter(s=>awaiting(s)&&s.businessDate===date);return <article className="daily-review-card attention-required" key={date}><div><strong>{date}</strong><p>{orders.length} awaiting Owner review · {php(sum(orders))}</p></div>
        <button className="secondary" disabled={working||recovery||resource.status!=='ready'} onClick={()=>setReview({day:date,sales:orders.slice(0,500)})}>{orders.length>500?'Review first 500 receipts':'Review daily sales'}</button></article>;})}
      {resource.data&&!dates.length&&<p className="empty-state">No sales awaiting Owner review{day?` for ${day}`:''}.</p>}
      {dashboard&&<><p>{data.filter(s=>pendingRequest(s)).length} pending void requests</p><button className="primary" onClick={()=>{setAllRequests(true);setRequestsOnly(false);onAudit();}}>View all requests</button></>}
    </section>}
    {!dashboard&&active&&<section className="history-layout"><div className="history-main"><div className="audit-filters">
      <SearchField label="Search transactions" value={search} onChange={setSearch} placeholder="Search receipt, cashier, item or reference"/>
      {manager&&<DateField label="Business date" value={day} onChange={setDay} max={businessDate()}/>}
      <label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>{['All statuses','Pending','Completed','Voided'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Payment<select value={method} onChange={e=>setMethod(e.target.value)}>{['All payments','Cash','GCash'].map(v=><option key={v}>{v}</option>)}</select></label>
      <button className="secondary" aria-pressed={requestsOnly} onClick={()=>{setRequestsOnly(!requestsOnly);setAllRequests(false);}}>Void requests ({data.filter(s=>pendingRequest(s)).length})</button>
      {manager&&<button className="secondary" aria-pressed={allRequests} onClick={()=>{setAllRequests(!allRequests);setRequestsOnly(false);}}>All review requests</button>}
    </div><p className="filter-summary" role="status">{filtered.length} matching orders · {day||(manager?'All dates':'Current day')}
      <button className="secondary" onClick={()=>{setSearch('');setDay('');setStatus('All statuses');setMethod('All payments');setRequestsOnly(false);setAllRequests(false);}}>Clear filters</button></p>
    {manager&&<div className="bulk-toolbar"><label><input type="checkbox" aria-label="Select all eligible orders on this page" disabled={!eligible.length} checked={eligible.length>0&&eligible.every(s=>Boolean(checked[s.id]))} onChange={e=>setChecked(current=>{
      const next={...current};for(const s of eligible){if(e.target.checked)next[s.id]=s;else delete next[s.id];}return next;
    })}/>Select all eligible orders on this page</label><p>{chosen.length} selected · {php(sum(chosen))}</p>
      {hidden.length>0&&<p className="selection-notice">{hidden.length} selected orders are outside the current page or filters. IDs: {hidden.map(s=>s.orderNumber).join(', ')}. <button className="secondary" onClick={()=>setChecked(Object.fromEntries(chosen.filter(s=>paging.records.some(p=>p.id===s.id)).map(s=>[s.id,s])))}>Keep visible selection only</button></p>}
      <button className="secondary" disabled={!chosen.length} onClick={()=>setChecked({})}>Clear selection</button><button className="primary" disabled={!chosen.length||chosen.length>500||working||recovery||resource.status!=='ready'} onClick={()=>setAction({kind:'sale.void',sales:chosen})}>Bulk Void</button>{chosen.length>500&&<p>Choose at most 500 receipts per action.</p>}</div>}
    <div className="table-wrap" role="region" aria-label={manager?'Audit transactions; scroll to see all columns':'Today’s transactions; scroll to see all columns'} tabIndex={0}><table className="history-table"><thead><tr>{manager&&<th scope="col">Select</th>}{['Date & Time','Order ID','Items','Status','Cashier'].map(t=><th scope="col" key={t}>{t}</th>)}</tr></thead><tbody>
      {paging.records.map(s=><tr key={s.id} className={selected===s.id||checked[s.id]?'active-row':''}>
        {manager&&<td><input type="checkbox" aria-label={`Select order ${s.orderNumber}`} disabled={s.status==='Voided'} checked={Boolean(checked[s.id])} onChange={e=>setChecked(current=>{const next={...current};if(e.target.checked)next[s.id]=s;else delete next[s.id];return next;})}/></td>}
        <td>{manilaTime(s.occurredAt)}</td><td><button className="order-link" onClick={()=>setSelected(selected===s.id?null:s.id)} aria-label={`View order ${s.orderNumber}`}>{s.orderNumber}</button></td>
        <td>{s.receipt?.lines.map((l,i)=><span className="sale-item" key={i}>{l.quantity}× {l.name}</span>)??'Historical receipt'}</td>
        <td><span className={`audit-sale-status ${s.status.toLowerCase()}`}>{s.status}</span>{pendingRequest(s)&&<small className="request-status">Void requested</small>}</td><td>{s.cashierName}<small className="audit-cashier-role">{s.cashierRole}</small></td></tr>)}
    </tbody></table>{resource.data&&!filtered.length&&<p className="empty-state">No transactions match this view.</p>}</div><Pagination label="Transactions" {...paging}/></div>
    <aside className="order-panel details-panel"><h2>Order Details</h2><div className="sale-details" role="region" aria-label="Order items, payment and review timeline" tabIndex={sale?0:undefined}>
      {!sale?<p className="empty-state">Select a transaction to see the recorded receipt and full event history.</p>:<><p className="detail-id"><strong>{sale.orderNumber}</strong></p><p>{sale.cashierName} ({sale.cashierRole}) · {manilaTime(sale.occurredAt)}</p><p>{sale.status} · {sale.reviewState}</p>
        {sale.receipt?.lines.map((line,i)=><div className="detail-line" key={i}><span>{line.quantity}× {line.name}<small>{line.sku}</small>{line.modifiers.map(m=><small key={m.id}>{m.name} · {php(m.price)}</small>)}{line.components.length>0&&<details><summary>Included products</summary><BundleContents items={line.components}/></details>}</span><strong>{php((displayDecimal(line.unitPrice,2)*line.quantity).toFixed(2))}</strong></div>)}
        {!sale.receipt&&<p>Purchased configuration details are unavailable for this historical receipt.</p>}<p>Total: <strong>{php(sale.total)}</strong> · {sale.method}</p>
        {sale.reference&&<p>GCash reference: {sale.reference}. Recorded evidence; provider verification is separate.</p>}
        <p>{sale.stockCommitted===true?'Recorded stock consumption is retained.':sale.stockCommitted===false?'No stock deduction was recorded.':'Historical stock handling was not recorded.'} Review and void actions do not deduct or return stock. Voids do not refund payments.</p>
        {sale.review&&<section aria-label="Recorded Daily Sales Review"><h3>Daily Sales Review</h3><p>{sale.review.owner} ({sale.review.role}) · {manilaTime(sale.review.time)} · {sale.review.outcome}</p>
          {sale.review.details&&<><p>Expected Cash / GCash: {php(sale.review.details.expected_cash)} / {php(sale.review.details.expected_gcash)}</p><p>Verified Cash / GCash: {php(sale.review.details.verified_cash)} / {php(sale.review.details.verified_gcash)}</p>
            <p>Counted cash: {php(sale.review.details.counted_cash)}. Opening: {php(sale.review.details.opening_cash)} · Additions: {php(sale.review.details.additions)} · Removals: {php(sale.review.details.removals)} · Refund adjustments: {php(sale.review.details.refunds)}</p>
            <p>{sale.review.details.explanation||'Receipts matched expected amounts.'}</p><p>Included receipt IDs: {sale.review.details.orderIds.join(', ')}</p><p>{sale.review.details.cashMovements.length} saved reconciliation adjustments. Entered at review time; no provider refund was issued.</p></>}
        </section>}
        {sale.requests.map(r=><section className="void-request" key={r.id}><h3>Void request · {r.status}</h3><p>{r.reason}</p><p>{r.requested_name} ({r.requested_role}) · {manilaTime(r.requested_at)}</p>{r.reviewed_at&&<p>{r.reviewed_name} ({r.reviewed_role}) · {manilaTime(r.reviewed_at)} · {r.decision_reason}</p>}</section>)}
        {sale.voidedAt&&<p>Voided by {sale.voidedName} ({sale.voidedRole}) · {manilaTime(sale.voidedAt)} · {sale.voidReason}{sale.bulkActionId&&<> · Batch action: {sale.bulkActionId}</>}</p>}
        {sale.bulkAction&&<details><summary>Recorded bulk action results</summary><p>{sale.bulkAction.reason}</p><ul>{sale.bulkAction.results.map(r=><li key={r.saleId}>{r.saleId}: {r.outcome}</li>)}</ul></details>}
        <section className="audit-timeline" aria-label="Order review timeline"><h3>Order review timeline</h3><ol>{sale.events.map(e=><li key={e.id}><strong>{e.event_type}</strong><p>{e.actor_name} ({e.actor_role}) · {manilaTime(e.occurred_at)}</p><p>{e.reason}</p><small>Operation: {e.operation_id}</small></li>)}</ol></section>
      </>}
    </div><div className="details-footer">
      {sale&&sale.status!=='Voided'&&<><button className="primary" disabled={working||recovery||resource.status!=='ready'||(!manager&&Boolean(pendingRequest(sale)))} onClick={()=>setAction({kind:manager?(pendingRequest(sale)?'void.decide':'sale.void'):'void.request',sales:[sale],approved:manager?true:undefined})}>
        {manager?(pendingRequest(sale)?'Approve Void':'VOID'):(pendingRequest(sale)?'Request Pending':'Request Void')}</button>
        {manager&&pendingRequest(sale)&&<button className="secondary" disabled={working||recovery||resource.status!=='ready'} onClick={()=>setAction({kind:'void.decide',sales:[sale],approved:false})}>Reject Request</button>}</>}
    </div></aside></section>}
    {review&&<DailySalesReview persistent date={review.day} role={role} owner={actor} onDirtyChange={reportDirty} onClose={()=>setReview(null)} onConfirm={confirmReview}
      sales={review.sales.map(s=>({id:s.id,time:s.occurredAt,cashier:s.cashierName,cashierRole:s.cashierRole as Role,total:displayDecimal(s.total,2),status:s.status,reviewState:s.reviewState,method:s.method,reference:s.reference??undefined,lines:[]} as Sale))}/>}
    {action&&<VoidDialog action={action} role={role} actor={actor} onSave={save} onClose={()=>setAction(null)} onDirtyChange={reportDirty}/>}
    {recovery&&<Modal title="Reconcile saved sales action" onClose={()=>{}} className="bulk-modal"><p>The result of a saved action needs confirmation. Retry the exact saved action to retrieve its recorded result before creating another action.</p>
      {pending&&<><p>Action: {pending.kind} · Operation: {pending.operationId}</p><p>Included receipt IDs: {pending.targets.map(t=>t.saleId).join(', ')}</p></>}
      {recoveryError&&<p role="alert" className="error">{recoveryError}</p>}<p>Refreshing this tab keeps the saved action. Closing the tab can clear browser session storage; inspect recorded history before recreating it afterward.</p>
      <Actions><button className="primary" disabled={working||!pending} onClick={()=>{if(pending)void save(pending).catch(cause=>setRecoveryError(cause instanceof Error?cause.message:'Retry failed; saved action retained.'));}}>{working?'Reconciling…':'Retry saved action'}</button></Actions></Modal>}
  </div>;
}
