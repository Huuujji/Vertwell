import { useId, useState } from 'react';
import { Actions, Modal } from './ui';
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
  const id = useId();
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
  const actions = <Actions><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" onClick={save}>{editing ? product.mode === 'Bundle' ? 'Update quantity' : 'Update item' : 'Add'}</button></Actions>;
  return <Modal title={product.mode === 'Bundle' ? `Included in ${product.name}` : product.modifiers?.length ? `Add modifiers — ${product.name}` : `Choose variant — ${product.name}`} className="customize-modal" footer={product.mode === 'Bundle' ? actions : undefined} onClose={onClose}>
    <p className="subtitle">{product.mode === 'Bundle' ? 'Review the products included in each bundle and choose how many bundles to add.' : editing ? 'Update this cart line. Its existing quantity is included below.' : 'Choose options and quantity before adding this item to your order.'}</p>
    {product.mode === 'Variants' && <fieldset className="customize-group variant-choices"><legend>Choose a variant</legend><p className="field-hint">Each variant uses its own SKU. Prices below include this product’s discount, before add-ons and VAT.</p>{product.variants?.map(value => {
      const result = usageFor([...otherLines, { ...candidate, variant: value, modifiers: [] }], stock, undefined, products);
      return <label className={`modifier-choice ${result.error ? 'modifier-unavailable' : ''}`} key={value.id}><input type="radio" name={`${id}-variant`} value={value.id} checked={variantId === value.id} onChange={() => { if (!editing && !variantId) setSelected(availableDefaultIds(product, stock, products, otherLines, validQuantity ? count : 1, value)); setVariantId(value.id); setError(''); }} /><span>{value.name}<small>{value.sku}{result.error ? ` · ${result.error}` : ''}</small></span><strong>{money(sellingPrice({ ...product, price: value.price }))}</strong></label>;
    })}</fieldset>}
    {product.mode === 'Bundle' && <section className="bundle-summary" aria-label="Included in this bundle"><h3 tabIndex={-1} data-initial-focus>Included in each bundle</h3><ul>{product.bundle?.map((component, index) => <li key={index}><strong>{component.quantity} × {component.name}</strong><small>{component.sku}</small>{products.find(value => value.id === component.productId)?.modifiers?.flatMap(group => group.options).filter(option => component.modifierIds?.includes(option.id)).map(option => <small key={option.id}>Included option: {option.name}</small>)}</li>)}</ul><small>Quantity below counts bundles. The included products and options are fixed.</small></section>}
    {!editing && product.modifiers?.some(group => group.options.some(option => option.defaultSelected)) && <p className="field-hint">Default choices are selected only when stock is available for this quantity and the rest of your order.</p>}
    {product.mode !== 'Bundle' && product.modifiers?.map((group, index) => {
      const chosen = group.options.filter(option => selected.includes(option.id)).length;
      return <fieldset className="customize-group" key={group.id} aria-describedby={`${id}-group-${index}`}><legend>{group.name}</legend>
        <p id={`${id}-group-${index}`} className="customize-group-summary">{group.min ? 'Required' : 'Optional'} · Choose {group.min}–{group.max} · {chosen} selected</p>
        {group.options.map((option, optionIndex) => {
          const checked = selected.includes(option.id);
          const result = usageFor([...otherLines, { ...candidate, modifiers: [...choices.filter(value => value.id !== option.id), option] }], stock, undefined, products);
          const unavailable = !checked && validQuantity && !needsVariant ? result.error : undefined;
          const reasonId = `${id}-option-${index}-${optionIndex}`;
          return <label className={`modifier-choice ${unavailable ? 'modifier-unavailable' : ''}`} key={option.id}>
            <input type="checkbox" checked={checked} disabled={Boolean(unavailable)} aria-describedby={unavailable ? reasonId : undefined} onChange={() => { setSelected(checked ? selected.filter(value => value !== option.id) : [...selected, option.id]); setError(''); }} />
            <span>{option.name}{option.defaultSelected && <small className="modifier-default-note">{unavailable ? "Default choice · unavailable for this selection" : checked ? "Default choice · you can change it" : "Default choice · not selected"}</small>}{unavailable && <small id={reasonId}>{unavailable}</small>}</span><strong>{option.price ? `+${money(option.price)}` : 'No charge'}</strong>
          </label>;
        })}</fieldset>;
    })}
    <div className="customize-quantity"><label htmlFor={`${id}-quantity`}>Quantity</label><div className="quantity-control">
      <button aria-label="Decrease customization quantity" disabled={!validQuantity || count <= 1} onClick={() => { setQuantity(count - 1); setError(''); }}>−</button>
      <input id={`${id}-quantity`} type="number" min="1" step="1" value={quantity} onChange={event => { setQuantity(event.target.value); setError(''); }} />
      <button aria-label="Increase customization quantity" disabled={!validQuantity || !Number.isSafeInteger(count + 1) || Boolean(usageFor([...otherLines, { ...candidate, quantity: count + 1 }], stock, undefined, products).error)} onClick={() => { setQuantity(count + 1); setError(''); }}>+</button>
    </div></div>
    <div className="customize-price" aria-live="polite"><p><span>Final unit price</span><strong>{needsVariant ? 'Choose a variant' : money(price)}</strong></p><p><span>Line subtotal{validQuantity ? ` · ${count} ${count === 1 ? 'item' : 'items'}` : ''}</span><strong>{validQuantity && !needsVariant ? money(Math.round(price * 100) * count / 100) : '—'}</strong></p><small>VAT is added at checkout using the existing preview calculation.</small></div>
    {product.mode !== 'Bundle' && <section className="customize-stock" aria-label="Stock needed for this customization"><h3>Stock for this selection</h3><p>Remaining quantities include the other items in your current order. This preview does not reserve stock.</p>
      {needsVariant ? <p>Choose a variant to see its stock requirements.</p> : !validQuantity ? <p>Enter a valid quantity to see stock requirements.</p> : ownUsage.usage.length ? <ul>{ownUsage.usage.map(input => {
        const item = stock.find(value => value.id === input.stockId)!;
        const totalNeeded = orderUsage.usage.find(value => value.stockId === input.stockId)?.quantity ?? 0;
        const remaining = Math.round((usableQuantity(item) - totalNeeded) * 1e6) / 1e6;
        return <li key={input.stockId}><span>{input.name}<small>{input.sku ?? input.stockId}</small></span><span>{input.quantity} {input.unit} needed<small>{orderUsage.error && !orderUsage.usage.length ? 'Order stock cannot be calculated.' : remaining < 0 ? `${Math.abs(remaining)} ${input.unit} short for order` : `${remaining} ${input.unit} usable after order`}</small></span></li>;
      })}</ul> : <p>{ownUsage.error ? 'Stock requirements could not be calculated.' : product.mode ? 'No stock required by this selection.' : 'Sample stock is not linked. Usage cannot be calculated.'}</p>}
      {!needsVariant && validQuantity && orderUsage.error && error !== orderUsage.error && <p className="error" role="status">{orderUsage.error}</p>}
    </section>}
    {product.mode === 'Bundle' && validQuantity && orderUsage.error && error !== orderUsage.error && <p className="error" role="status">{orderUsage.error}</p>}
    {error && <p className="error" role="alert">{error}</p>}{product.mode !== 'Bundle' && actions}
  </Modal>;
}
