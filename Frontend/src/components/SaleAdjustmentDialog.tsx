import { useEffect, useRef, useState } from 'react';
import { Actions, Modal } from './ui';
import useDiscardChanges from './useDiscardChanges';
import { workflowTarget, type WorkflowCommand, type WorkflowResult, type WorkflowSale } from '../lib/data/sales-workflow';
import { adjustmentReasons, stockConditions, physicalFactLabels, packagedReturnLabels, physicalPlanError, meaningfulReasonNotes, laterReturnRemaining, type ReasonId, type StockCondition, type DispositionInput } from '../lib/data/sale-adjustments';
import { displayDecimal } from '../lib/data/decimal';

export default function SaleAdjustmentDialog({sale,kind,onSave,onClose,onDirtyChange}:{sale:WorkflowSale;kind:'stock.dispose'|'refund.record';onSave:(c:WorkflowCommand)=>Promise<WorkflowResult>;onClose:()=>void;onDirtyChange:(dirty:boolean)=>void}) {
  const [reasonId,setReason]=useState<ReasonId>('refund_return'),[notes,setNotes]=useState(''),[plans,setPlans]=useState<Record<string,DispositionInput>>({});
  const [amount,setAmount]=useState(''),[reference,setReference]=useState(''),[evidence,setEvidence]=useState(''),[paid,setPaid]=useState(false);
  const [paidAt,setPaidAt]=useState('');
  const [final,setFinal]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const lock=useRef(false);const discard=useDiscardChanges(true,onClose,'sale adjustment');
  useEffect(()=>{onDirtyChange(true);return()=>onDirtyChange(false);},[onDirtyChange]);
  const remaining=sale.refundBalance?.remaining??'0';
  const refundable=sale.refundBalance?.received!=null&&sale.refundBalance.method===sale.method;
  const selected=Object.values(plans);
  return <><Modal title={final?'Confirm reviewed adjustment':kind==='stock.dispose'?'Review physical stock disposition':'Record an actual manual refund'} className={kind==='stock.dispose'?'bulk-modal stock-disposition-modal':'bulk-modal'} onClose={()=>{if(!lock.current)discard.requestClose();}}>
    <form onSubmit={async event=>{
      event.preventDefault();if(lock.current)return;
      if(reasonId==='other'&&!meaningfulReasonNotes(notes)){setError('Explain Other.');return;}
      if(kind==='stock.dispose'&&!selected.length){setError('Select at least one original stock input.');return;}
      if(kind==='stock.dispose'){for(const plan of selected){const item=sale.adjustableItems.find(i=>i.id===plan.itemId)!,u=item.usage.find(u=>u.stockId===plan.stockId)!;const factError=physicalPlanError(plan,item);if(factError){setError(factError);return;}const total=selected.filter(p=>p.itemId===plan.itemId&&p.stockId===plan.stockId&&p.sourceDispositionId===plan.sourceDispositionId).reduce((sum,p)=>sum+Number(p.quantityBase),0);if(!Number.isFinite(total)||total<=0||total>(plan.sourceDispositionId?laterReturnRemaining(sale.adjustments.dispositions.find(d=>d.id===plan.sourceDispositionId)!,sale.adjustments):Number(u.quantity)-Number(u.accountedQuantity))){setError('Combined quantities exceed the remaining original usage.');return;}}}
      if(kind==='refund.record'&&!refundable){setError('Recorded received-money evidence is missing or inconsistent. No payout can be recorded.');return;}
      if(!final){setError('');setFinal(true);return;}
      const base={operationId:crypto.randomUUID(),targets:[workflowTarget(sale)],reasonId,notes:notes.trim()};
      const command:WorkflowCommand=kind==='stock.dispose'?{...base,kind,dispositions:selected}:{...base,kind,refund:{amount,method:sale.method,reference,paidAt:new Date(`${paidAt.length===16?`${paidAt}:00`:paidAt}+08:00`).toISOString(),evidence,paidConfirmed:paid}};
      lock.current=true;setBusy(true);setError('');
      try{await onSave(command);onClose();}catch(cause){setError(cause instanceof Error?cause.message:'Save failed; review retained.');}
      finally{lock.current=false;setBusy(false);}
    }}>
      <p><strong>{sale.orderNumber}</strong> · {sale.status} · Original sale total ₱{sale.total} ({sale.method}) · Source sale {sale.id}</p>
      <p>Sale correction, physical stock and money paid back are separate decisions. This action retains the original receipt and adds audit evidence.</p>
      {final?<p>Reason: {adjustmentReasons[reasonId]} · {notes||'No extra notes'}</p>:<>
        <label>Reason<select value={reasonId} onChange={e=>setReason(e.target.value as ReasonId)}>{Object.entries(adjustmentReasons).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <label>Extra notes{reasonId==='other'?' (required)':' (optional)'}<textarea required={reasonId==='other'} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
      </>}
      {kind==='stock.dispose'?<>
        <p>Confirm facts for each affected purchased stock input or bundle component. Quantities use the original canonical units shown. “Unused” means no physical consumption occurred for that quantity. Prepared food cannot become sellable ingredients.</p>
        {!final&&sale.adjustableItems.map(item=><fieldset key={item.id} disabled={busy}><legend>{item.quantity} × {item.name} ({item.category})</legend>
          {item.usage.map(u=>{const max=(displayDecimal(u.quantity,6)-displayDecimal(u.accountedQuantity,6)).toFixed(6);
            return <div className="adjustment-stock-input" key={u.stockId}>
              <p>{u.name} · {u.kind} · Original {u.quantity} {u.unit} · Already classified {u.accountedQuantity} {u.unit}</p>
              <button type="button" disabled={Number(max)<=0} onClick={()=>setPlans(current=>({...current,[crypto.randomUUID()]:{itemId:item.id,stockId:u.stockId,quantityBase:'',condition:'' as StockCondition,evidence:'',resalePolicyConfirmed:false,facts:{} as DispositionInput['facts']}}))}>Add quantity / condition for {u.name}</button>
              {sale.adjustments.dispositions.filter(d=>d.sale_item_id===item.id&&d.stock_item_id===u.stockId&&d.condition==='not_returned'&&!d.sourceDispositionId&&d.physicalFacts&&laterReturnRemaining(d,sale.adjustments)>0).map(d=><button key={d.id} type="button" onClick={()=>setPlans(current=>({...current,[crypto.randomUUID()]:{itemId:item.id,stockId:u.stockId,sourceDispositionId:d.id,quantityBase:'',condition:'' as StockCondition,evidence:'',resalePolicyConfirmed:false,facts:{} as DispositionInput['facts']}}))}>Record later physical return from {d.id} ({laterReturnRemaining(d,sale.adjustments)} {u.unit} outstanding)</button>)}
              {Object.entries(plans).filter(([,p])=>p.itemId===item.id&&p.stockId===u.stockId).map(([key,plan])=><fieldset key={key}><legend>Quantity and physical facts</legend>{plan.sourceDispositionId&&<p>Later return linked to {plan.sourceDispositionId}. Earlier missing facts remain recorded; preparation and original component identity must agree.</p>}
                <label>Affected quantity ({u.unit})<input type="number" required min={u.unit==='pcs'||u.unit==='bottles'?'1':'0.000001'} max={plan.sourceDispositionId?laterReturnRemaining(sale.adjustments.dispositions.find(d=>d.id===plan.sourceDispositionId)!,sale.adjustments):max} step={u.unit==='pcs'||u.unit==='bottles'?'1':'0.000001'} value={plan.quantityBase} onChange={e=>setPlans({...plans,[key]:{...plan,quantityBase:e.target.value}})}/></label>
                <label>Confirmed physical condition<select required value={plan.condition} onChange={e=>setPlans({...plans,[key]:{...plan,condition:e.target.value as StockCondition}})}><option value="">Select actual condition</option>{Object.entries(stockConditions).filter(([id])=>(!plan.sourceDispositionId||id==='returned_sellable'||id==='returned_unsellable')&&(id!=='returned_sellable'||u.kind==='Finished')).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
                {Object.entries(physicalFactLabels).map(([fact,label])=><label key={fact}>{label}<select required value={plan.facts[fact as keyof typeof physicalFactLabels]===undefined?'':String(plan.facts[fact as keyof typeof physicalFactLabels])} onChange={e=>setPlans({...plans,[key]:{...plan,facts:{...plan.facts,[fact]:e.target.value==='true'}}})}><option value="">Confirm actual fact</option><option value="true">Yes</option><option value="false">No</option></select></label>)}
                <label>Physical evidence / inspection notes<textarea required maxLength={1000} value={plan.evidence} onChange={e=>setPlans({...plans,[key]:{...plan,evidence:e.target.value}})}/></label>
                {plan.condition==='returned_sellable'&&<>
                  {(item.category!=='Hobby'||plan.facts.foodOrBeverage)&&Object.entries(packagedReturnLabels).map(([fact,label])=><label key={fact}><input type="checkbox" required checked={plan.packagedReturn?.[fact as keyof typeof packagedReturnLabels]??false} onChange={e=>setPlans({...plans,[key]:{...plan,packagedReturn:{...plan.packagedReturn,[fact]:e.target.checked} as DispositionInput['packagedReturn']}})}/>{label}</label>)}
                  <label><input type="checkbox" required checked={plan.resalePolicyConfirmed} onChange={e=>setPlans({...plans,[key]:{...plan,resalePolicyConfirmed:e.target.checked}})}/>I inspected this actual returned quantity and approve resale under the agreed policy and original expiry restrictions.</label>
                </>}
                <button type="button" onClick={()=>setPlans(current=>{const next={...current};delete next[key];return next;})}>Remove quantity entry</button>
              </fieldset>)}
            </div>;
          })}
        </fieldset>)}
        {final&&selected.map((plan,index)=>{const item=sale.adjustableItems.find(i=>i.id===plan.itemId)!,u=item.usage.find(u=>u.stockId===plan.stockId)!;
          return <article key={index}><strong>{item.name} / {u.name}: {plan.quantityBase} {u.unit}</strong><p>{stockConditions[plan.condition]}</p>{plan.sourceDispositionId&&<p>Linked later return from {plan.sourceDispositionId}; original missing evidence remains unchanged.</p>}<p>{['unused','returned_sellable'].includes(plan.condition)?'Restore eligible original batch quantity. Expired stock remains unusable.':plan.condition==='waste'?'Keep checkout deduction and classify as waste. No second deduction.':'Keep checkout deduction. No increase in sellable stock.'}</p><p>{Object.entries(physicalFactLabels).map(([key,label])=>`${label}: ${plan.facts[key as keyof typeof physicalFactLabels]?'Yes':'No'}`).join(' · ')}</p>{plan.packagedReturn&&<p>Packaged return: {Object.entries(packagedReturnLabels).map(([key,label])=>`${label}: ${plan.packagedReturn?.[key as keyof typeof packagedReturnLabels]?'Yes':'No'}`).join(' · ')}</p>}<p>Custody: {plan.facts.physicallyPresent?'Present in shop':'Not physically present'}. Physical restoration: {['unused','returned_sellable'].includes(plan.condition)?plan.quantityBase:'0'} {u.unit}. Sellable availability remains subject to original batch expiry and condition. Waste classification: {plan.condition==='waste'?plan.quantityBase:'0'} {u.unit}.</p><p>{plan.evidence}</p></article>;
        })}
        {final&&<p>Refund recorded by this action: ₱0. Missing batch evidence, exhausted original quantities or changed receipts stop the save.</p>}
      </>:<>
        <p>Recorded received money: {refundable?`₱${sale.refundBalance!.received}`:'Unavailable / inconsistent'}. Previously recorded refunds: ₱{sale.refundBalance?.refunded??'0.00'} · Remaining refundable: ₱{remaining}. No payment is transferred by this screen.</p>
        {sale.adjustments.refunds.map(r=><p key={r.id}>Prior payout: ₱{r.amount} ({r.method}) · {r.reference} · Paid {r.paid_at} · Recorded {r.recorded_at} · {r.actor_name} ({r.actor_role})</p>)}
        <p>A duplicate receipt does not prove a second payment. Correction without payout is available through the separate void action. No refund due is inferred.</p>
        {final?<><p>Proposed record (unsaved): ₱{amount} manually paid by {sale.method} at {paidAt} (Manila). Reference: {reference}.</p><p>Evidence: {evidence}</p><p>Stock change: none. Sale status change: none.</p></>:<>
          <label>Amount actually paid back<input type="number" required min="0.01" max={remaining} step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
          <p>Refund method: {sale.method}, matching the original received payment.</p>
          <label>Unique payout / refund receipt reference<input required maxLength={100} value={reference} onChange={e=>setReference(e.target.value)}/></label>
          <label>Actual payout time (Manila)<input required type="datetime-local" step="1" value={paidAt} onChange={e=>setPaidAt(e.target.value)}/></label>
          <label>Manual payout evidence<textarea required maxLength={1000} value={evidence} onChange={e=>setEvidence(e.target.value)}/></label>
          <label><input type="checkbox" required checked={paid} onChange={e=>setPaid(e.target.checked)}/>I confirm the customer was actually paid back manually and this reference has not already been recorded. A void or duplicate record alone does not prove money is owed.</label>
        </>}
      </>}
      {error&&<p className="error" role="alert">{error}</p>}
      <Actions><button type="button" className="secondary" disabled={busy} data-initial-focus onClick={()=>final?setFinal(false):discard.requestClose()}>{final?'Go back':'Cancel'}</button><button className="primary" disabled={busy||(kind==='refund.record'&&(!refundable||Number(remaining)<=0))}>{busy?'Saving…':final?'Confirm and record':'Review adjustment'}</button></Actions>
    </form>
  </Modal>{discard.confirmation}</>;
}
