import { useCallback,useEffect,useRef,useState } from 'react';
import { apiRequest } from '../lib/api';
import { ApiError } from '../lib/api-client';
import { createCheckoutData,decodeQuote,type CheckoutCommand,type CheckoutLine,type CheckoutQuote,type CheckoutReceipt,type PosProduct } from '../lib/data/checkout';
import { displayDecimal } from '../lib/data/decimal';
import { useResource } from '../lib/request-state';
import { useViewState } from '../lib/view-state';
import { Actions,Modal } from './ui';
import SearchField from './SearchField';
const php=(value:string)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(displayDecimal(value,2));
const errorText=(cause:unknown)=>cause instanceof Error?cause.message:'Unable to complete this request.';

export default function LivePos({scope,active,onBusyChange,onUncertainChange,onSaved}:{scope:string;active:boolean;onBusyChange:(value:boolean)=>void;onUncertainChange:(value:boolean)=>void;onSaved:()=>void}) {
  const [service]=useState(()=>createCheckoutData(apiRequest));
  const load=useCallback((signal:AbortSignal)=>service.catalogue(signal),[service]);
  const catalogue=useResource<PosProduct[]>(scope,load);
  const [cart,setCart]=useState<CheckoutLine[]>([]),[quote,setQuote]=useState<CheckoutQuote|null>(null);
  const [filter,setFilter]=useViewState('LivePos.filter','All Items'),[search,setSearch]=useViewState('LivePos.search','');
  const [editing,setEditing]=useState<PosProduct|null>(null),[variant,setVariant]=useState(''),[selected,setSelected]=useState<string[]>([]),[count,setCount]=useState('1');
  const [editingIndex,setEditingIndex]=useState<number|null>(null);
  const [stage,setStage]=useState<'order'|'Cash'|'GCash'|null>(null),[given,setGiven]=useState(''),[reference,setReference]=useState('');
  const [receipt,setReceipt]=useState<CheckoutReceipt|null>(null),[error,setError]=useState(''),[pending,setPending]=useState<CheckoutCommand|null>(null);
  const busy=useRef(false),[working,setWorking]=useState(false);
  const [uncertain,setUncertain]=useState(false);
  const [showHistory,setShowHistory]=useState(false),[historyOffset,setHistoryOffset]=useState(0),[viewing,setViewing]=useState<CheckoutReceipt|null>(null);
  const loadHistory=useCallback((signal:AbortSignal)=>service.sales(historyOffset,signal),[service,historyOffset]);
  const history=useResource(showHistory?`${scope}:receipts:${historyOffset}`:null,loadHistory);
  const recoveryKey=`vertwell-checkout:${scope.split(':')[0]}`;
  useEffect(()=>{
    try{
      const saved=sessionStorage.getItem(recoveryKey);if(!saved)return;
      const value=JSON.parse(saved) as {command:CheckoutCommand;quote:CheckoutQuote};
      const restored=decodeQuote(value.quote);
      if(!value.command||!Array.isArray(value.command.lines)||value.command.quoteToken!==restored.quoteToken||
        !['Cash','GCash'].includes(value.command.payment.method))throw new Error('Invalid checkout recovery');
      setPending(value.command);setQuote(restored);setCart(value.command.lines);setStage(value.command.payment.method);
      if(value.command.payment.method==='Cash')setGiven(value.command.payment.cashTendered);else setReference(value.command.payment.reference);
      setUncertain(true);
    }catch{setError('Checkout recovery could not be read. Review recorded sales before creating another order.');setUncertain(true);}
  },[recoveryKey]);
  useEffect(()=>{onUncertainChange(uncertain);return()=>onUncertainChange(false);},[uncertain,onUncertainChange]);
  useEffect(()=>{
    const protect=(event:BeforeUnloadEvent)=>{if(cart.length||pending){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);
  },[cart.length,pending]);
  async function run(action:()=>Promise<void>) {
    if(busy.current)return;busy.current=true;setWorking(true);onBusyChange(true);setError('');
    try{await action();}catch(cause){setError(errorText(cause));}finally{busy.current=false;setWorking(false);onBusyChange(false);}
  }
  async function replace(next:CheckoutLine[]) {
    if(!next.length){setCart([]);setQuote(null);return;}
    const nextQuote=await service.quote(next);setQuote(nextQuote);setCart(next);setReceipt(null);
  }
  function open(product:PosProduct,index:number|null=null) {
    if(busy.current||pending)return;
    void run(async()=>{
      const existing=index===null?undefined:cart[index];setEditingIndex(index);
      setVariant(existing?.variantId??'');setSelected(existing?.modifierIds??[]);setCount(existing?.quantity??'1');
      if(product.model==='Variants'||product.model==='Bundle'||product.groups.length){
        const available=await service.availability(product.id,index===null?cart:cart.filter((_,i)=>i!==index));
        if(available===false)throw new ApiError('Not enough usable stock to add this product to the current order.','conflict');
        // Defaults are selected only when the entire proposed cart is valid.
        const defaults=product.groups.flatMap(g=>g.options.filter(o=>o.defaultSelected).map(o=>o.id));
        if(!existing&&product.model!=='Variants'&&defaults.length){
          try{await service.quote([...cart,{productId:product.id,variantId:null,modifierIds:defaults,quantity:'1'}]);setSelected(defaults);}catch{/* Leave unavailable defaults unchecked. */}
        }
        setEditing(product);
      }else await replace([...cart,{productId:product.id,variantId:null,modifierIds:[],quantity:'1'}]);
    });
  }
  function closePayment(){if(!busy.current&&!uncertain){setStage(null);setError('');}}
  async function submitPayment() {
    if(!quote)return;
    await run(async()=>{
      const command=pending??{operationId:crypto.randomUUID(),revision:quote.revision,quoteToken:quote.quoteToken,lines:cart,
        payment:stage==='Cash'?{method:'Cash' as const,amount:quote.total,cashTendered:given}:{method:'GCash' as const,amount:quote.total,reference}};
      setPending(command);
      // Save the exact operation before sending. This contains no session token.
      try{sessionStorage.setItem(recoveryKey,JSON.stringify({command,quote}));}
      catch{setPending(null);throw new Error('Checkout recovery cannot be saved in this browser. Enable session storage before recording payment.');}
      try{
        const saved=await service.checkout(command);setReceipt(saved);setPending(null);setUncertain(false);setCart([]);setQuote(null);setStage(null);setGiven('');setReference('');
        try{sessionStorage.removeItem(recoveryKey);}catch{/* A committed receipt stays successful. */}
        catalogue.reload();history.reload();onSaved();
      }catch(cause){
        // Only an explicit database rejection proves that nothing committed.
        const rejected=!pending&&cause instanceof ApiError&&['validation','conflict','forbidden','unauthorized'].includes(cause.kind);
        setUncertain(!rejected);if(rejected){setPending(null);sessionStorage.removeItem(recoveryKey);}
        throw cause;
      }
    });
  }
  const locked=working||uncertain||Boolean(pending);
  const products=catalogue.data??[];
  const shown=products.filter(p=>(filter==='All Items'||(filter==='F&B'?p.category!=='Hobby':p.category==='Hobby'))&&
    `${p.name} ${p.sku} ${p.variants.map(v=>`${v.name} ${v.sku}`).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="live-pos" hidden={!active}>
    <button className="secondary" disabled={working} aria-expanded={showHistory} onClick={()=>setShowHistory(value=>!value)}>Recorded sales</button>
    {showHistory&&<section aria-label="Recorded sales"><h2>Recorded sales</h2><p>Staff see their own sales for today. Managers see permitted business sales.</p>
      {history.status==='loading'&&<p role="status">Loading recorded sales…</p>}{history.error&&<p role="alert" className="error">{history.error.message}</p>}
      {history.data?.items.map(sale=><p key={sale.id}><strong>{sale.orderNumber}</strong> · {sale.cashier} · {sale.status} · {php(sale.total)} <button className="secondary" disabled={working} onClick={()=>void run(async()=>setViewing(await service.receipt(sale.id)))}>View receipt</button></p>)}
      {history.data?.items.length===0&&<p>No recorded sales in this scope.</p>}
      <Actions><button className="secondary" disabled={working||!historyOffset} onClick={()=>setHistoryOffset(value=>Math.max(0,value-20))}>Previous sales</button><button className="secondary" disabled={working||!history.data?.hasMore} onClick={()=>setHistoryOffset(value=>value+20)}>Next sales</button><button className="secondary" disabled={working} onClick={history.reload}>Refresh sales</button></Actions>
    </section>}
    {catalogue.status==='loading'&&<p role="status">Loading selling catalogue…</p>}
    {catalogue.error&&<div className="error" role="alert"><p>{catalogue.error.message}</p><button className="secondary" disabled={locked} onClick={catalogue.reload}>Retry loading POS</button></div>}
    {error&&!editing&&!stage&&<p role="alert" className="error">{error}</p>}
    {receipt&&<section className="inventory-editor-note" role="status"><strong>Order {receipt.orderNumber} recorded · {receipt.status}</strong><p>{receipt.reviewState} · stock consumed once · {php(receipt.total)}</p>
      <p>{receipt.method==='Cash'?`Cash received ${php(receipt.cashTendered!)} · Change ${php(receipt.change!)}`:`GCash reference ${receipt.reference} recorded. Provider verification is separate.`}</p></section>}
    {catalogue.data&&<section className="pos-layout"><div className="catalog"><h1>Point of Sale</h1><p className="subtitle">Select items, review the order, then record received payment.</p>
      <div className="catalog-toolbar"><div className="tabs">{['All Items','F&B','Hobby Items'].map(value=><button key={value} className={filter===value?'selected':''} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value}</button>)}</div>
        <SearchField label="Search items" placeholder="Search Items" value={search} onChange={setSearch}/></div>
      <button className="secondary" disabled={locked} onClick={catalogue.reload}>Refresh catalogue</button>
      <div className="product-grid">{shown.map(product=><button className="product-card" key={product.id} disabled={locked||product.available===false} aria-label={`Add ${product.name} to order`} onClick={()=>open(product)}>
        {product.imageUrl?<img className="product-photo" src={product.imageUrl} alt={product.name}/>:<div className="product-placeholder"><span>No photo</span></div>}
        <strong>{product.name}</strong><span>{product.sku}</span><span>{product.model}</span><span>{product.priceFrom===null?'No enabled variants':product.model==='Variants'?`${php(product.priceFrom)} to ${php(product.priceTo!)}`:php(product.priceFrom)}</span>
        {product.available===false&&<small className="availability-note">Unavailable</small>}{product.available===null&&<small>Choose options to check availability</small>}</button>)}{!shown.length&&<p className="empty-state">No items match your search.</p>}</div></div>
      <aside className="order-panel"><h2>Current Order</h2><div className="cart-lines">{!cart.length&&<div className="cart-empty"><strong>Your order starts here</strong><p>Select an item from the catalogue.</p></div>}
        {cart.map((line,index)=>{const price=quote?.lines[index];return <div className="cart-line" key={index}><strong>{price?.name??'Item'}</strong><small>{price?.sku}</small>
          {price?.modifiers.map(option=><small key={option.id}>{option.name} · {php(option.price)}</small>)}
          {(products.find(p=>p.id===line.productId)?.groups.length||products.find(p=>p.id===line.productId)?.model==='Variants'||products.find(p=>p.id===line.productId)?.model==='Bundle')&&<button className="edit-customization" disabled={locked} onClick={()=>{const p=products.find(p=>p.id===line.productId);if(p)open(p,index);}}>Edit options</button>}
          <span>{price&&php((displayDecimal(price.unitPrice,2)*Number(line.quantity)).toFixed(2))}</span>
          <div className="quantity-control"><button aria-label={`Remove one ${price?.name}`} disabled={locked} onClick={()=>void run(()=>replace(cart.map((l,i)=>i===index?{...l,quantity:String(Number(l.quantity)-1)}:l).filter(l=>Number(l.quantity)>0)))}>−</button>
            <output>{line.quantity}</output><button aria-label={`Add one ${price?.name}`} disabled={locked} onClick={()=>void run(()=>replace(cart.map((l,i)=>i===index?{...l,quantity:String(Number(l.quantity)+1)}:l)))}>+</button></div></div>;})}</div>
        <div className="cart-footer">{quote&&<><p>Subtotal <strong>{php(quote.subtotal)}</strong></p><p>VAT (12%) <strong>{php(quote.tax)}</strong></p><div className="total-row"><strong>Total due</strong><strong>{php(quote.total)}</strong></div></>}
          <p className="staff-payment-note">Payment and fulfilment are recorded at checkout. Staff/Admin sales await Owner review.</p>
          <Actions><button className="secondary" disabled={locked||!cart.length} onClick={()=>{setCart([]);setQuote(null);setError('');}}>Clear</button>
            <button className="primary" disabled={locked||!cart.length} onClick={()=>void run(async()=>{const q=await service.quote(cart);setQuote(q);setStage('order');})}>Pay</button></Actions>
        </div></aside></section>}
    {editing&&<Modal title={editing.model==='Bundle'?`Included in ${editing.name}`:editing.model==='Variants'?`Choose ${editing.name}`:`Add modifiers · ${editing.name}`} onClose={()=>{if(!busy.current)setEditing(null);}}>
      {editing.components.map((component,index)=><p key={index}>{component.quantity}× {component.name}{component.variant?` · ${component.variant}`:''}</p>)}
      <form onSubmit={event=>{event.preventDefault();void run(async()=>{const line={productId:editing.id,variantId:variant||null,modifierIds:selected,quantity:count};await replace(editingIndex===null?[...cart,line]:cart.map((l,i)=>i===editingIndex?line:l));setEditing(null);});}}>
        {editing.model==='Variants'&&<label>Variant<select aria-label="Variant" required value={variant} disabled={working} onChange={event=>{setVariant(event.target.value);setSelected([]);}}><option value="">Choose a variant</option>{editing.variants.map(v=><option key={v.id} value={v.id}>{v.name} · {v.sku} · {php(v.price)}</option>)}</select></label>}
        {editing.groups.map(group=><fieldset key={group.id} disabled={working}><legend>{group.name} · choose {group.min}–{group.max}</legend>{group.options.map(option=><label key={option.id} className="live-pos-option"><input type="checkbox" checked={selected.includes(option.id)} disabled={!selected.includes(option.id)&&selected.filter(id=>group.options.some(o=>o.id===id)).length>=group.max}
          onChange={event=>setSelected(current=>event.target.checked?[...current,option.id]:current.filter(id=>id!==option.id))}/>{option.name} · +{php(option.price)}</label>)}</fieldset>)}
        <label>Quantity<input type="number" min="1" max="10000" step="1" required value={count} disabled={working} onChange={event=>setCount(event.target.value)}/></label>
        <p>Availability and prices are checked for the whole order when you add.</p>{error&&<p role="alert" className="error">{error}</p>}
        <Actions><button type="button" className="secondary" disabled={working} onClick={()=>setEditing(null)}>Cancel</button><button className="primary" disabled={working}>{working?'Checking…':'Add'}</button></Actions>
      </form></Modal>}
    {stage&&quote&&<Modal title={stage==='order'?'ORDER CONFIRMATION':stage==='Cash'?'CASH PAYMENT':'GCASH PAYMENT'} plain focusOnTitleChange className="payment-modal" onClose={closePayment}>
      {stage==='order'?<><div className="receipt">{quote.lines.map((line,index)=><p key={index}><strong>{line.quantity}× {line.name}</strong><span>{php((displayDecimal(line.unitPrice,2)*line.quantity).toFixed(2))}</span></p>)}<p>Subtotal <strong>{php(quote.subtotal)}</strong></p><p>VAT (12%) <strong>{php(quote.tax)}</strong></p><p>Total due <strong>{php(quote.total)}</strong></p></div>
        <div className="payment-methods"><button data-initial-focus className="primary" onClick={()=>setStage('Cash')}>Cash payment</button><button className="primary" onClick={()=>setStage('GCash')}>GCash payment</button></div></>:
        <form onSubmit={event=>{event.preventDefault();void submitPayment();}}><p className="payment-total">Total due <strong>{php(quote.total)}</strong></p>
          {stage==='Cash'?<><label>Amount Given<input data-initial-focus type="number" min={quote.total} step="0.01" required value={given} disabled={locked} onChange={event=>setGiven(event.target.value)}/></label><p>Change due: {new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Math.max(0,Number(given)-Number(quote.total)))}</p></>:
          <><p>Record a payment already received in your GCash account. A reference does not verify a provider payment.</p><label>GCash reference number<input data-initial-focus inputMode="numeric" pattern="[0-9]{13}" maxLength={13} required value={reference} disabled={locked} onChange={event=>setReference(event.target.value)}/></label></>}
          {error&&<p role="alert" className="error">{error}</p>}{uncertain&&<p role="status">The result is uncertain. Retry this same checkout to retrieve its receipt before starting another order.</p>}
          <Actions><button className="secondary" type="button" disabled={locked} onClick={()=>{setStage('order');setError('');}}>Back</button>
            <button className="primary" disabled={working}>{working?'Recording…':uncertain?'Retry same checkout':'Confirm payment received'}</button></Actions>
          {!uncertain&&error&&<button className="secondary" type="button" disabled={working} onClick={()=>void run(async()=>{const q=await service.quote(cart);setQuote(q);setStage('order');})}>Refresh quote and review</button>}
        </form>}
    </Modal>}
    {viewing&&<Modal title="Recorded receipt" onClose={()=>setViewing(null)}><p>{viewing.orderNumber} · {new Date(viewing.occurredAt).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</p>
      <p>{viewing.cashierName} ({viewing.cashierRole}) · {viewing.status} · {viewing.reviewState}</p>
      {viewing.lines.map((line,index)=><div key={index}><strong>{line.quantity}× {line.name} · {line.sku} · {php(line.unitPrice)} each</strong>
        {line.modifiers.map(option=><p key={option.id}>{option.name} · +{php(option.price)}</p>)}<ComponentList values={line.components}/></div>)}
      <p>Subtotal {php(viewing.subtotal)} · VAT {php(viewing.tax)} · Total {php(viewing.total)}</p><p>Stock consumed at checkout. Review never deducts it again.</p>
      <p>{viewing.method==='Cash'?`Cash received ${php(viewing.cashTendered!)} · Change ${php(viewing.change!)}`:`GCash reference ${viewing.reference} · Provider verification is separate.`}</p>
      <Actions><button className="primary" onClick={()=>setViewing(null)}>Close receipt</button></Actions></Modal>}
  </div>;
}

function ComponentList({values}:{values:unknown[]}) {
  return <>{values.map((value,index)=>{
    if(!value||typeof value!=='object')return null;
    const row=value as Record<string,unknown>,configuration=row.configuration as Record<string,unknown>|undefined;
    return <div key={index} className="live-pos-component"><p>{String(row.quantity)}× {String(configuration?.name??row.name)} · {String(configuration?.sku??row.sku??'')}</p>
      {Array.isArray(configuration?.modifiers)&&configuration.modifiers.map((value,index)=>{const m=value as Record<string,unknown>;return <p key={index}>{String(m.name)}</p>;})}
      {Array.isArray(configuration?.components)&&<ComponentList values={configuration.components}/>}</div>;
  })}</>;
}
