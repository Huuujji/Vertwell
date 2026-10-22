import CartSummary from './CartSummary';
import { reportOperationalEvent } from '../lib/operations';
import CartItem, { OrderItemCount } from './CartItem';
import OrderReceiptDetails from './OrderReceiptDetails';
import useCheckoutStock from './useCheckoutStock';
import CheckoutSummary from './CheckoutSummary';
import LiveProductOptions from './LiveProductOptions';
import { CashPaymentFields, GCashPaymentFields, GCashQr } from './PaymentFields';
import useDiscardChanges from './useDiscardChanges';
import PosHeading, { CatalogueCaption } from './PosHeading';
import type { Role } from '../data/demo';
import { manilaTime } from '../data/demo';
import CatalogueCard from './CatalogueCard';
import { Art } from './ui';
import { useCallback,useEffect,useRef,useState } from 'react';
import { apiRequest } from '../lib/api';
import { ApiError } from '../lib/api-client';
import { combineCheckoutLines,createCheckoutData,decodeQuote,type CheckoutCommand,type CheckoutLine,type CheckoutQuote,type CheckoutReceipt,type PosProduct } from '../lib/data/checkout';
import { displayDecimal } from '../lib/data/decimal';
import { useLiveResource } from '../lib/live-updates';
import { useViewState } from '../lib/view-state';
import { Actions,Modal } from './ui';
import SearchField from './SearchField';
const php=(value:string)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(displayDecimal(value,2));
const errorText=(cause:unknown)=>cause instanceof Error?cause.message:'Unable to complete this request.';
function componentSummary(values:unknown[]):string {
  return values.map(value=>{
    if(!value||typeof value!=='object')return 'Historical component details unavailable';
    const row=value as Record<string,unknown>,config=(row.configuration&&typeof row.configuration==='object'?row.configuration:row) as Record<string,unknown>;
    const options=Array.isArray(config.modifiers)?config.modifiers.map(value=>value&&typeof value==='object'?String((value as Record<string,unknown>).name??''):'').filter(Boolean):[];
    const nested=Array.isArray(config.components)?componentSummary(config.components):'';
    return `${String(row.quantity??1)}× ${String(config.name??'Included product')}${options.length?` (${options.join(', ')})`:''}${nested?` [${nested}]`:''}`;
  }).join('; ');
}

export default function LivePos({scope,active,role,name,onBusyChange,onUncertainChange,onSaved,onDirtyChange}:{onDirtyChange:(value:boolean)=>void;scope:string;active:boolean;role:Role;name:string;onBusyChange:(value:boolean)=>void;onUncertainChange:(value:boolean)=>void;onSaved:()=>void}) {
  const [service]=useState(()=>createCheckoutData(apiRequest,reportOperationalEvent));
  const load=useCallback((signal:AbortSignal)=>service.catalogue(signal),[service]);
  const catalogue=useLiveResource<PosProduct[]>(scope,load,['catalogue']);
  const [cart,setCart]=useState<CheckoutLine[]>([]),[quote,setQuote]=useState<CheckoutQuote|null>(null);
  const stock=useCheckoutStock(service,cart,catalogue.data,active);
  const [filter,setFilter]=useViewState('LivePos.filter','All Items'),[search,setSearch]=useViewState('LivePos.search','');
  const [editing,setEditing]=useState<PosProduct|null>(null),[variant,setVariant]=useState(''),[selected,setSelected]=useState<string[]>([]),[count,setCount]=useState('1');
  const [editingIndex,setEditingIndex]=useState<number|null>(null);
  const [stage,setStage]=useState<'order'|'Cash'|'GCash'|null>(null),[given,setGiven]=useState(''),[reference,setReference]=useState('');
  const [receipt,setReceipt]=useState<CheckoutReceipt|null>(null),[error,setError]=useState(''),[pending,setPending]=useState<CheckoutCommand|null>(null);
  const busy=useRef(false),[working,setWorking]=useState(false);
  const [optionsDirty,setOptionsDirty]=useState(false);
  const paymentDirty=Boolean(stage&&stage!=='order'&&(given||reference));
  useEffect(()=>{onDirtyChange(active&&(optionsDirty||paymentDirty));return()=>onDirtyChange(false);},[active,optionsDirty,paymentDirty,onDirtyChange]);
  useEffect(()=>{if(!active&&!busy.current){setEditing(null);setStage(null);}},[active]);
  const paymentDiscard=useDiscardChanges(paymentDirty,()=>{setStage(null);setError('');},'payment');
  const [uncertain,setUncertain]=useState(false);
  const [showHistory,setShowHistory]=useState(false),[historyOffset,setHistoryOffset]=useState(0),[viewing,setViewing]=useState<CheckoutReceipt|null>(null);
  const loadHistory=useCallback((signal:AbortSignal)=>service.sales(historyOffset,signal),[service,historyOffset]);
  const history=useLiveResource(showHistory?`${scope}:receipts:${historyOffset}`:null,loadHistory,['sales']);
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
    // Only deliberate cart edits combine identical selections. Restored pending
    // commands retain their original lines and exact quote for recovery.
    const combined=combineCheckoutLines(next);
    const nextQuote=await service.quote(combined);setQuote(nextQuote);setCart(combined);setReceipt(null);
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
  function closePayment(){if(!busy.current&&!uncertain)paymentDiscard.requestClose();}
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
        const saved=await service.checkout(command);
        if(pending||uncertain||saved.replayed)reportOperationalEvent('checkout.reconciled');
        setReceipt(saved);setPending(null);setUncertain(false);setCart([]);setQuote(null);setStage(null);setGiven('');setReference('');
        try{sessionStorage.removeItem(recoveryKey);}catch{/* A committed receipt stays successful. */}
        catalogue.reload();history.reload();onSaved();
      }catch(cause){
        // Only an explicit database rejection proves that nothing committed.
        const rejected=!pending&&cause instanceof ApiError&&['validation','conflict','forbidden','unauthorized'].includes(cause.kind);
        setUncertain(!rejected);if(rejected){setPending(null);sessionStorage.removeItem(recoveryKey);}
        if(!rejected)reportOperationalEvent('checkout.unconfirmed');
        throw cause;
      }
    });
  }
  const locked=working||uncertain||Boolean(pending);
  const products=catalogue.data??[];
  const shown=products.filter(p=>(filter==='All Items'||(filter==='F&B'?p.category!=='Hobby':p.category==='Hobby'))&&
    `${p.name} ${p.sku} ${p.variants.map(v=>`${v.name} ${v.sku}`).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
  const remaining=(product:PosProduct)=>product.usableQuantity==null?undefined:Math.max(0,Number(product.usableQuantity)-Number(stock.data?.stocks.find(row=>row.stockId===product.stockId)?.required??0));
  return <div className="live-pos" hidden={!active}>
    {showHistory&&<section aria-label="Recorded sales"><h2>Recorded sales</h2><p>Staff see their own sales for today. Managers see permitted business sales.</p>
      {history.status==='loading'&&<p role="status">Loading recorded sales…</p>}{history.error&&<p role="alert" className="error">{history.error.message}</p>}
      {Boolean(history.data?.items.length)&&<div className="table-wrap" role="region" aria-label="Recorded sales; scroll to see all columns" tabIndex={0}><table className="history-table receipt-history-table"><thead><tr>{['Order ID','Cashier','Status','Total','Receipt'].map(title=><th scope="col" key={title}>{title}</th>)}</tr></thead><tbody>
        {history.data?.items.map(sale=><tr key={sale.id}><td>{sale.orderNumber}</td><td>{sale.cashier}</td><td>{sale.status}</td><td className="numeric-cell">{php(sale.total)}</td><td><button className="secondary" disabled={working} onClick={()=>void run(async()=>setViewing(await service.receipt(sale.id)))}>View receipt</button></td></tr>)}
      </tbody></table></div>}
      {history.data?.items.length===0&&<p>No recorded sales in this scope.</p>}
      <Actions><button className="secondary" disabled={working||!historyOffset} onClick={()=>setHistoryOffset(value=>Math.max(0,value-20))}>Previous sales</button><button className="secondary" disabled={working||!history.data?.hasMore} onClick={()=>setHistoryOffset(value=>value+20)}>Next sales</button></Actions>
    </section>}
    {catalogue.status==='loading'&&<p role="status">Loading selling catalogue…</p>}
    {catalogue.error&&<div className="error" role="alert"><p>{catalogue.error.message}</p><button className="secondary" disabled={locked} onClick={catalogue.reload}>Retry loading POS</button></div>}
    {error&&!editing&&!stage&&<p role="alert" className="error">{error}</p>}
    {receipt&&<section className="inventory-editor-note" role="status"><strong>Order {receipt.orderNumber} recorded · {receipt.status}</strong><p>{receipt.reviewState} · stock consumed once · {php(receipt.total)}</p>
      <p>{receipt.method==='Cash'?`Cash received ${php(receipt.cashTendered!)} · Change ${php(receipt.change!)}`:`GCash reference ${receipt.reference} recorded. Provider verification is separate.`}</p></section>}
    {catalogue.data&&<section className="pos-layout"><div className="catalog"><PosHeading role={role} name={name} persistent action={<button className="secondary pos-history" aria-label="Recorded sales" title="Recorded sales" disabled={working} aria-expanded={showHistory} onClick={()=>setShowHistory(value=>!value)}><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg></button>}/>
      <div className="catalog-toolbar"><div className="tabs">{['All Items','F&B','Hobby Items'].map(value=><button key={value} className={filter===value?'selected':''} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value}</button>)}</div>
        <SearchField label="Search items" placeholder="Search Items" value={search} onChange={setSearch}/></div>
      {role==='Staff'&&<CatalogueCaption count={shown.length}/>}<div className="product-grid">{shown.map(product=><CatalogueCard key={product.id} name={product.name} image={product.imageUrl} icon={product.category==='Hobby'?'hobby-solid.svg':'a638b.svg'} disabled={locked} unavailable={product.available===false?'No usable stock':remaining(product)===0?'Not enough usable stock for this order':undefined} onClick={()=>open(product)}
        price={<><small>₱</small>{product.priceFrom===null?'No enabled variants':product.model==='Variants'?<><small>From </small>{Number(product.priceFrom).toLocaleString('en-PH')}<small> To </small>{Number(product.priceTo).toLocaleString('en-PH')}</>:Number(product.priceFrom).toLocaleString('en-PH')}</>}>
        {product.model==='Variants'&&<small className="stock-unlinked">Choose a variant · {product.variants.length} options</small>}{product.model==='Bundle'&&<small className="stock-unlinked">Bundle · {product.components.length} products</small>}
        {product.available===null&&<small className="stock-unlinked">Choose options to check availability</small>}
        {product.model==='Retail Item'&&remaining(product)!==undefined&&<small className="stock-unlinked">{remaining(product)} available for this order</small>}
      </CatalogueCard>)}{!shown.length&&<p className="empty-state">No items match your search.</p>}</div></div>
      <aside className="order-panel"><h2>Current Order{role==='Staff'&&<OrderItemCount count={cart.reduce((sum,line)=>sum+Number(line.quantity),0)}/>}</h2><div className="cart-lines">{!cart.length&&<div className="cart-empty"><strong>Your order starts here</strong><p>Select an item from the catalogue.</p></div>}
        {cart.map((line,index)=>{const price=quote?.lines[index];return <CartItem key={index} name={price?.name??'Item'} sku={price?.sku}
          modifiers={price?.modifiers.map(option=>({id:option.id,name:option.name,amount:php(option.price)}))}
          components={price?.components.length?componentSummary(price.components):undefined}
          editAction={(products.find(p=>p.id===line.productId)?.groups.length||products.find(p=>p.id===line.productId)?.model==='Variants'||products.find(p=>p.id===line.productId)?.model==='Bundle')?<button className="edit-customization" disabled={locked} onClick={()=>{const p=products.find(p=>p.id===line.productId);if(p)open(p,index);}}>{products.find(p=>p.id===line.productId)?.model==='Bundle'?'View bundle':'Edit options'}</button>:undefined}
          amount={price&&php((displayDecimal(price.unitPrice,2)*Number(line.quantity)).toFixed(2))}>
          <div className="quantity-control"><button aria-label={`Remove one ${price?.name}`} disabled={locked} onClick={()=>void run(()=>replace(cart.map((l,i)=>i===index?{...l,quantity:String(Number(l.quantity)-1)}:l).filter(l=>Number(l.quantity)>0)))}>−</button>
            <output aria-label={`${price?.name} quantity`}>{line.quantity}</output><button aria-label={`Add one ${price?.name}`} disabled={locked||!stock.data||Number(line.quantity)>=(stock.data.maximums[index]??0)} onClick={()=>void run(()=>replace(cart.map((l,i)=>i===index?{...l,quantity:String(Number(l.quantity)+1)}:l)))}>+</button></div></CartItem>;})}</div>
        <div className="cart-footer"><CartSummary role={role} subtotal={php(quote?.subtotal??'0')} tax={php(quote?.tax??'0')} total={php(quote?.total??'0')}/>
          {stock.error&&<p role="status" className="error">{stock.error} Payment still requires a current quote.</p>}
          <Actions><button className="clear-button" disabled={locked||!cart.length} onClick={()=>{setCart([]);setQuote(null);setError('');}}><Art file="6006e.svg" className="card-art"/><span>Clear</span></button>
            <button className="pay-button" disabled={locked||!cart.length} onClick={()=>void run(async()=>{const q=await service.quote(cart);setQuote(q);setStage('order');})}>Pay</button></Actions>
        </div></aside></section>}
    {editing&&<LiveProductOptions product={editing} initial={{productId:editing.id,variantId:variant||null,modifierIds:selected,quantity:count}}
      otherLines={editingIndex===null?cart:cart.filter((_,index)=>index!==editingIndex)} service={service} editing={editingIndex!==null}
      stockVersion={catalogue.data} working={working} error={error} onDirtyChange={setOptionsDirty} onClose={()=>{setEditing(null);setError('');}}
      onSave={line=>void run(async()=>{await replace(editingIndex===null?[...cart,line]:cart.map((current,index)=>index===editingIndex?line:current));setEditing(null);})}/>}
    {stage&&quote&&<Modal title={stage==='order'?'ORDER CONFIRMATION':stage==='Cash'?'CASH PAYMENT':'GCASH PAYMENT'} plain focusOnTitleChange className={`payment-modal ${stage==='order'?'confirmation-modal':''}`} onClose={closePayment}>
      {stage==='order'?<CheckoutSummary subtotal={php(quote.subtotal)} tax={php(quote.tax)} total={php(quote.total)} onCash={()=>setStage('Cash')} onGCash={()=>setStage('GCash')}
        lines={quote.lines.map((line,index)=>({key:index,name:line.name,quantity:line.quantity,amount:php((displayDecimal(line.unitPrice,2)*line.quantity).toFixed(2)),details:<><small className="receipt-modifier">SKU: {line.sku}</small>{line.components.length>0&&<small className="receipt-modifier">Includes: {componentSummary(line.components)}</small>}{line.modifiers.map(option=><small className="receipt-modifier" key={option.id}>{option.name} · +{php(option.price)}</small>)}</>}))}/>:
        <form className={stage==='GCash'?'qr-payment':undefined} onSubmit={event=>{event.preventDefault();void submitPayment();}}>
          {stage==='Cash'?<CashPaymentFields total={displayDecimal(quote.total,2)} given={given} disabled={locked} onChange={setGiven}/>:
          <><GCashQr /><p className="payment-total"><strong>Total Due:</strong><strong>{php(quote.total)}</strong></p><p>Check the received GCash payment, then enter its reference number.</p><GCashPaymentFields reference={reference} disabled={locked} onChange={setReference}/></>}
          {error&&<p role="alert" className="error">{error}</p>}{uncertain&&<p role="status">The result is uncertain. Retry this same checkout to retrieve its receipt before starting another order.</p>}
          <Actions><button className="secondary" type="button" disabled={locked} onClick={()=>{setStage('order');setError('');}}>Back</button>
            <button className="primary" disabled={working}>{working?'Recording…':uncertain?'Retry same checkout':'Confirm payment received'}</button></Actions>
          {!uncertain&&error&&<button className="secondary" type="button" disabled={working} onClick={()=>void run(async()=>{const q=await service.quote(cart);setQuote(q);setStage('order');})}>Review current quote</button>}
        </form>}
    </Modal>}
    {paymentDiscard.confirmation}
    {viewing&&<Modal title="Recorded receipt" className="payment-modal recorded-receipt-modal" onClose={()=>setViewing(null)} footer={<Actions><button className="primary" onClick={()=>setViewing(null)}>Close receipt</button></Actions>}>
      <OrderReceiptDetails id={viewing.orderNumber} cashier={viewing.cashierName} role={viewing.cashierRole} method={viewing.method} time={manilaTime(viewing.occurredAt)} status={viewing.status} total={php(viewing.total)} review={viewing.reviewState}
        lines={viewing.lines.map((line,index)=>({key:index,name:line.name,quantity:line.quantity,amount:php((displayDecimal(line.unitPrice,2)*line.quantity).toFixed(2)),details:<><small className="receipt-modifier">SKU: {line.sku} · {php(line.unitPrice)} each</small>{line.modifiers.map(option=><small className="receipt-modifier" key={option.id}>{option.name} · +{php(option.price)}</small>)}<ComponentList values={line.components}/></>}))}/>
      <p className="detail-line"><span>Subtotal</span><strong>{php(viewing.subtotal)}</strong></p><p className="detail-line"><span>VAT</span><strong>{php(viewing.tax)}</strong></p><p>Stock consumed at checkout. Review never deducts it again.</p>
      <p>{viewing.method==='Cash'?`Cash received ${php(viewing.cashTendered!)} · Change ${php(viewing.change!)}`:`GCash reference ${viewing.reference} · Provider verification is separate.`}</p>
    </Modal>}
  </div>;
}

function ComponentList({values}:{values:unknown[]}) {
  return <>{values.map((value,index)=>{
    if(!value||typeof value!=='object')return null;
    const row=value as Record<string,unknown>,configuration=row.configuration as Record<string,unknown>|undefined;
    return <span key={index} className="live-pos-component"><small>{String(row.quantity)}× {String(configuration?.name??row.name)} · {String(configuration?.sku??row.sku??'')}</small>
      {Array.isArray(configuration?.modifiers)&&configuration.modifiers.map((value,index)=>{const m=value as Record<string,unknown>;return <small key={index}>{String(m.name)}</small>;})}
      {Array.isArray(configuration?.components)&&<ComponentList values={configuration.components}/>}</span>;
  })}</>;
}
