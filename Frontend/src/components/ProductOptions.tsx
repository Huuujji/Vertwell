import { useId, type ReactNode } from 'react';
import { Actions, Modal } from './ui';

type Option = { id: string; name: string; price: string; defaultSelected?: boolean; unavailable?: string };
type Variant = { id: string; name: string; sku: string; price: string; unavailable?: string };
export default function ProductOptions({ name, bundle, editing, variants, groups, components, selected, variantId, quantity, unitPrice, subtotal, taxNote, stock, error, working = false, canIncrease = true, onVariant, onToggle, onQuantity, onSave, onClose }: {
  name: string; bundle: boolean; editing: boolean; variants?: Variant[];
  groups: { id: string; name: string; min: number; max: number; options: Option[] }[];
  components?: ReactNode; selected: string[]; variantId: string; quantity: string | number;
  unitPrice: string; subtotal: string; taxNote: string; stock?: ReactNode; error: string;
  working?: boolean; canIncrease?: boolean; onVariant: (id: string) => void; onToggle: (id: string) => void;
  onQuantity: (value: string) => void; onSave: () => void; onClose: () => void;
}) {
  const id = useId(), count = Number(quantity), valid = Number.isSafeInteger(count) && count > 0;
  const actions = <Actions><button type="button" className="secondary" disabled={working} onClick={onClose}>Cancel</button><button type="button" className="primary" disabled={working} onClick={onSave}>{working ? 'Checking…' : editing ? bundle ? 'Update quantity' : 'Update item' : 'Add'}</button></Actions>;
  return <Modal title={bundle ? `Included in ${name}` : groups.length ? `Add modifiers — ${name}` : `Choose variant — ${name}`} className="customize-modal" footer={bundle ? actions : undefined} onClose={onClose}>
    <p className="subtitle">{bundle ? 'Review the products included in each bundle and choose how many bundles to add.' : editing ? 'Update this cart line. Its existing quantity is included below.' : 'Choose options and quantity before adding this item to your order.'}</p>
    {variants && <fieldset disabled={working} className="customize-group variant-choices"><legend>Choose a variant</legend><p className="field-hint">Each variant uses its own SKU. Prices below include this product’s discount, before add-ons and VAT.</p>{variants.map(value => <label className={`modifier-choice ${value.unavailable ? 'modifier-unavailable' : ''}`} key={value.id}><input type="radio" name={`${id}-variant`} value={value.id} checked={variantId === value.id} onChange={() => onVariant(value.id)}/><span>{value.name}<small>{value.sku}{value.unavailable ? ` · ${value.unavailable}` : ''}</small></span><strong>{value.price}</strong></label>)}</fieldset>}
    {bundle && <section className="bundle-summary" aria-label="Included in this bundle"><h3 tabIndex={-1} data-initial-focus>Included in each bundle</h3><ul>{components}</ul><small>Quantity below counts bundles. The included products and options are fixed.</small></section>}
    {!editing && groups.some(group => group.options.some(option => option.defaultSelected)) && <p className="field-hint">Default choices are selected only when stock is available for this quantity and the rest of your order.</p>}
    {!bundle && groups.map((group, index) => <fieldset disabled={working} className="customize-group" key={group.id} aria-describedby={`${id}-group-${index}`}><legend>{group.name}</legend><p id={`${id}-group-${index}`} className="customize-group-summary">{group.min ? 'Required' : 'Optional'} · Choose {group.min}–{group.max} · {group.options.filter(option => selected.includes(option.id)).length} selected</p>{group.options.map((option, optionIndex) => {
      const checked = selected.includes(option.id), reasonId = `${id}-option-${index}-${optionIndex}`;
      return <label className={`modifier-choice ${option.unavailable ? 'modifier-unavailable' : ''}`} key={option.id}><input type="checkbox" checked={checked} disabled={Boolean(option.unavailable)} aria-describedby={option.unavailable ? reasonId : undefined} onChange={() => onToggle(option.id)}/><span>{option.name}{option.defaultSelected && <small className="modifier-default-note">{option.unavailable ? 'Default choice · unavailable for this selection' : checked ? 'Default choice · you can change it' : 'Default choice · not selected'}</small>}{option.unavailable && <small id={reasonId}>{option.unavailable}</small>}</span><strong>{option.price}</strong></label>;
    })}</fieldset>)}
    <div className="customize-quantity"><label htmlFor={`${id}-quantity`}>Quantity</label><div className="quantity-control"><button aria-label="Decrease customization quantity" disabled={working || !valid || count <= 1} onClick={() => onQuantity(String(count - 1))}>−</button><input id={`${id}-quantity`} type="number" min="1" step="1" disabled={working} value={quantity} onChange={event => onQuantity(event.target.value)}/><button aria-label="Increase customization quantity" disabled={working || !valid || !Number.isSafeInteger(count + 1) || !canIncrease} onClick={() => onQuantity(String(count + 1))}>+</button></div></div>
    <div className="customize-price" aria-live="polite"><p><span>Final unit price</span><strong>{unitPrice}</strong></p><p><span>Line subtotal{valid ? ` · ${count} ${count === 1 ? 'item' : 'items'}` : ''}</span><strong>{subtotal}</strong></p><small>{taxNote}</small></div>
    {stock}{error && <p className="error" role="alert">{error}</p>}{!bundle && actions}
  </Modal>;
}
