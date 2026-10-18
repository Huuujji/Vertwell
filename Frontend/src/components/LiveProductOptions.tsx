import { useEffect, useRef, useState } from 'react';
import type { CheckoutLine, CheckoutQuote, PosProduct, createCheckoutData } from '../lib/data/checkout';
import { displayDecimal } from '../lib/data/decimal';
import ProductOptions from './ProductOptions';
import useDiscardChanges from './useDiscardChanges';
import SelectionStock from './SelectionStock';
import useCheckoutStock from './useCheckoutStock';

const php = (value: string) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(displayDecimal(value, 2));
export default function LiveProductOptions({ product, initial, otherLines, service, editing, working, error, stockVersion, onSave, onClose, onDirtyChange }: {
  product: PosProduct; initial: CheckoutLine; otherLines: CheckoutLine[]; service: ReturnType<typeof createCheckoutData>;
  editing: boolean; working: boolean; error: string; stockVersion:unknown; onSave: (line: CheckoutLine) => void; onClose: () => void; onDirtyChange: (value: boolean) => void;
}) {
  const [variant, setVariant] = useState(initial.variantId ?? ''), [selected, setSelected] = useState(initial.modifierIds), [count, setCount] = useState(initial.quantity);
  const [current, setCurrent] = useState<CheckoutQuote | null>(null), [quoteError, setQuoteError] = useState('');
  const defaultRequest=useRef(0);
  useEffect(()=>()=>{defaultRequest.current++;},[]);
  const valid = Number.isSafeInteger(Number(count)) && Number(count) > 0 && Number(count) <= 10000;
  const configured = valid && (product.model !== 'Variants' || Boolean(variant)) && product.groups.every(group => {
    const chosen = group.options.filter(option => selected.includes(option.id)).length; return chosen >= group.min && chosen <= group.max;
  });
  const line: CheckoutLine = { productId: product.id, variantId: variant || null, modifierIds: selected, quantity: count };
  const key = JSON.stringify(line), dirty = key !== JSON.stringify(initial);
  const orderKey=JSON.stringify(otherLines),stock=useCheckoutStock(service,[...otherLines,line],stockVersion,configured);
  const [unavailable,setUnavailable]=useState<Record<string,string>>({});
  const discard = useDiscardChanges(dirty, onClose, 'item options');
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    setCurrent(null); setQuoteError('');
    if (!configured) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void service.quote([...otherLines, line], controller.signal).then(value => { if (!controller.signal.aborted) setCurrent(value); }).catch(cause => {
        if (!controller.signal.aborted) setQuoteError(cause instanceof Error ? cause.message : 'Unable to check current availability.');
      });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, configured, service, orderKey,stockVersion]);
  useEffect(()=>{
    const controller=new AbortController();setUnavailable({});
    if(!valid)return;
    const candidates=product.groups.flatMap(group=>group.options.filter(option=>!selected.includes(option.id)).map(option=>({id:option.id,line:{...line,modifierIds:[...selected,option.id]}})))
      .concat(product.variants.map(value=>({id:value.id,line:{...line,variantId:value.id}})))
      .filter(candidate=>(product.model!=='Variants'||candidate.line.variantId)&&product.groups.every(group=>{
        const count=group.options.filter(option=>candidate.line.modifierIds.includes(option.id)).length;return count>=group.min&&count<=group.max;
      }));
    const timer=setTimeout(()=>{void Promise.all(candidates.map(async candidate=>{
      try{const feedback=await service.stock([...otherLines,candidate.line],controller.signal);return feedback.maximums.at(-1)!<Number(count)?[candidate.id,'Not enough usable stock for this quantity']:null;}
      catch{return null;}
    })).then(values=>{if(!controller.signal.aborted)setUnavailable(Object.fromEntries(values.filter((v):v is string[]=>v!==null)));});},200);
    return()=>{clearTimeout(timer);controller.abort();};
  },[key,valid,service,orderKey,stockVersion,product]);
  const quoted = current?.lines.at(-1);
  return <><ProductOptions name={product.name} bundle={product.model === 'Bundle'} editing={editing}
    variantId={variant} selected={selected} quantity={count} working={working} error={error}
    onVariant={value=>{const request=++defaultRequest.current;setVariant(value);if(!editing&&!variant&&!selected.length){const defaults=product.groups.flatMap(g=>g.options.filter(o=>o.defaultSelected).map(o=>o.id));if(defaults.length)void service.quote([...otherLines,{...line,variantId:value,modifierIds:defaults}]).then(()=>{if(defaultRequest.current===request)setSelected(defaults);}).catch(()=>{});}}} onToggle={value => {defaultRequest.current++;setSelected(selected.includes(value) ? selected.filter(id => id !== value) : [...selected, value]);}}
    onQuantity={value=>{defaultRequest.current++;setCount(value);}} onClose={() => { if (!working) discard.requestClose(); }} onSave={() => {
      // Deliberate Add/Update always obtains a fresh whole-order quote in LivePos.
      // A displayed quote, an incoming event or reconnect can never submit a sale.
      if (!working) onSave(line);
    }}
    canIncrease={configured&&Boolean(stock.data)&&Number(count)<(stock.data?.maximums.at(-1)??0)}
    variants={product.model === 'Variants' ? product.variants.map(value => ({ ...value, price: php(discounted(product, value.price)),unavailable:unavailable[value.id] })) : undefined}
    groups={product.groups.map(group => ({ ...group, options: group.options.map(option => ({ ...option, price: Number(option.price) ? '+' + php(option.price) : 'No charge',
      unavailable: !selected.includes(option.id) ? group.options.filter(o => selected.includes(o.id)).length >= group.max ? 'Maximum choices selected' : unavailable[option.id] : undefined })) }))}
    components={product.components.map((component, index) => <li key={index}><strong>{component.quantity} × {component.name}</strong>{component.variant && <small>{component.variant}</small>}</li>)}
    unitPrice={quoted ? php(quoted.unitPrice) : product.model === 'Variants' && !variant ? 'Choose a variant' : 'Awaiting current quote'}
    subtotal={quoted ? php((displayDecimal(quoted.unitPrice, 2) * Number(count)).toFixed(2)) : '—'} taxNote="VAT is added at checkout."
    stock={product.model !== 'Bundle' ? <SelectionStock note="Remaining quantities include the other items in your current order. Stock is reserved only when checkout succeeds."
      rows={(stock.data?.stocks??[]).filter(row=>Number(row.lineNeeds.at(-1))>0).map(row=>({id:row.stockId,name:row.name,sku:row.sku,unit:row.unit,needed:decimal(row.lineNeeds.at(-1)!),remaining:decimal(String(Math.abs(Number(row.remaining)))),short:Number(row.remaining)<0}))}
      status={!configured?'Choose the required options and a valid quantity to see stock requirements.':!stock.data&&!stock.error?'Checking current availability…':stock.data?.stocks.length===0?'No stock required by this selection.':undefined}
      error={stock.error||quoteError}/> : quoteError?<p className="error" role="status">{quoteError}</p>:undefined}/>
    {discard.confirmation}</>;
}
function decimal(value:string){return Number(value).toLocaleString('en-PH',{maximumFractionDigits:9});}

function discounted(product: PosProduct, price: string) {
  const original = displayDecimal(price, 2), value = displayDecimal(product.discountValue, 2);
  if (product.discountType === 'Percentage') return Math.max(0, original * (1 - value / 100)).toFixed(2);
  if (product.discountType === 'Fixed') return Math.max(0, original - value).toFixed(2);
  return price;
}
