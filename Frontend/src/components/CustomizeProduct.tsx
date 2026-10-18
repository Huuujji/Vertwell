import SelectionStock from './SelectionStock';
import { useState } from 'react';
import ProductOptions from './ProductOptions';
import { money, sellingPrice } from '../data/demo';
import type { Modifier, Product, ProductVariant, StockItem } from '../data/demo';
import { usableQuantity, usageFor } from '../data/inventory';
import { availableDefaultIds, variantPrice } from '../data/catalogue';

interface OrderLine { product: Product; quantity: number; modifiers?: Modifier[]; variant?: ProductVariant }
interface Props {
  product: Product; stock: StockItem[]; products: Product[]; initial?: Modifier[]; initialQuantity?: number; initialVariant?: ProductVariant;
  otherLines: OrderLine[]; editing: boolean; onClose: () => void;
  onSave: (modifiers: Modifier[], quantity: number, variant?: ProductVariant) => void;
}
export default function CustomizeProduct({ product, stock, products, initial = [], initialQuantity = 1, initialVariant, otherLines, editing, onClose, onSave }: Props) {
  const [selected, setSelected] = useState(() => editing ? initial.map(option => option.id) : availableDefaultIds(product, stock, products, otherLines, initialQuantity, initialVariant)); const [error, setError] = useState('');
  const [quantity, setQuantity] = useState<number | string>(initialQuantity);
  const [variantId, setVariantId] = useState(initialVariant?.id ?? '');
  const variant = product.variants?.find(value => value.id === variantId);
  const count = Number(quantity);
  const validQuantity = Number.isSafeInteger(count) && count > 0;
  const choices = product.modifiers?.flatMap(group => group.options).filter(option => selected.includes(option.id)) ?? [];
  const price = sellingPrice({ ...product, price: variantPrice(product, variant) + choices.reduce((sum, option) => sum + option.price, 0) });
  const candidate = { product, variant, quantity: validQuantity ? count : 1, modifiers: choices };
  const needsVariant = product.mode === 'Variants' && !variant;
  const ownUsage = usageFor([candidate], stock, undefined, products);
  const orderUsage = usageFor([...otherLines, candidate], stock, undefined, products);
  function save() {
    if (!validQuantity) { setError('Enter a whole-number quantity greater than zero.'); return; }
    if (needsVariant) { setError('Choose a variant before adding this item.'); return; }
    const invalid = product.modifiers?.find(group => { const count = group.options.filter(option => selected.includes(option.id)).length; return count < group.min || count > group.max; });
    if (invalid) { setError(`Choose ${invalid.min}–${invalid.max} options in ${invalid.name}.`); return; }
    if (orderUsage.error) { setError(orderUsage.error); return; }
    onSave(choices, count, variant);
  }
  return <ProductOptions name={product.name} bundle={product.mode === 'Bundle'} editing={editing}
    selected={selected} variantId={variantId} quantity={quantity} error={error}
    onClose={onClose} onSave={save} onQuantity={value => { setQuantity(value); setError(''); }}
    onVariant={value => { if (!editing && !variantId) setSelected(availableDefaultIds(product, stock, products, otherLines, validQuantity ? count : 1, product.variants?.find(v => v.id === value))); setVariantId(value); setError(''); }}
    onToggle={value => { setSelected(selected.includes(value) ? selected.filter(id => id !== value) : [...selected, value]); setError(''); }}
    canIncrease={!usageFor([...otherLines, { ...candidate, quantity: count + 1 }], stock, undefined, products).error}
    variants={product.mode === 'Variants' ? product.variants?.map(value => ({ ...value, price: money(sellingPrice({ ...product, price: value.price })), unavailable: usageFor([...otherLines, { ...candidate, variant: value, modifiers: [] }], stock, undefined, products).error })) : undefined}
    groups={(product.modifiers ?? []).map(group => ({ ...group, options: group.options.map(option => ({ ...option,
      price: option.price ? '+' + money(option.price) : 'No charge',
      unavailable: !selected.includes(option.id) && validQuantity && !needsVariant ? usageFor([...otherLines, { ...candidate, modifiers: [...choices.filter(value => value.id !== option.id), option] }], stock, undefined, products).error : undefined })) }))}
    components={product.bundle?.map((component, index) => <li key={index}><strong>{component.quantity} × {component.name}</strong><small>{component.sku}</small>{products.find(value => value.id === component.productId)?.modifiers?.flatMap(group => group.options).filter(option => component.modifierIds?.includes(option.id)).map(option => <small key={option.id}>Included option: {option.name}</small>)}</li>)}
    unitPrice={needsVariant ? 'Choose a variant' : money(price)} subtotal={validQuantity && !needsVariant ? money(Math.round(price * 100) * count / 100) : '—'}
    taxNote="VAT is added at checkout using the existing preview calculation."
    stock={<>
{product.mode !== 'Bundle' && <SelectionStock note="Remaining quantities include the other items in your current order. This preview does not reserve stock."
      rows={!needsVariant&&validQuantity?ownUsage.usage.map(input=>{const item=stock.find(value=>value.id===input.stockId)!,needed=orderUsage.usage.find(value=>value.stockId===input.stockId)?.quantity??0,remaining=Math.round((usableQuantity(item)-needed)*1e6)/1e6;return {id:input.stockId,name:input.name,sku:input.sku??input.stockId,needed:String(input.quantity),remaining:String(Math.abs(remaining)),unit:input.unit,short:remaining<0};}):[]}
      status={needsVariant?'Choose a variant to see its stock requirements.':!validQuantity?'Enter a valid quantity to see stock requirements.':!ownUsage.usage.length?ownUsage.error?'Stock requirements could not be calculated.':product.mode?'No stock required by this selection.':'Sample stock is not linked. Usage cannot be calculated.':undefined}
      error={!needsVariant&&validQuantity&&orderUsage.error!==error?orderUsage.error:undefined}/>}
    {product.mode === 'Bundle' && validQuantity && orderUsage.error && error !== orderUsage.error && <p className="error" role="status">{orderUsage.error}</p>}
    </>}/>
}
