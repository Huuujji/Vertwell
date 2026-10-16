import type { BundleComponent, Product, ProductVariant, StockItem } from '../data/demo';
import { finishedPieces } from '../data/catalogue';
import { usableQuantity } from '../data/inventory';
import SearchSelect from './SearchSelect';

export default function ProductConfigurations({ mode, items, products, productId, variants, bundle, onVariants, onBundle }: { mode: string; items: StockItem[]; products: Product[]; productId?: string; variants: ProductVariant[]; bundle: BundleComponent[]; onVariants: (value: ProductVariant[]) => void; onBundle: (value: BundleComponent[]) => void }) {
  const stock = finishedPieces(items), availableProducts = products.filter(product => product.available !== false && product.id !== productId);
  if (mode !== 'Variants' && mode !== 'Bundle') return null;
  return <section className="product-configurations"><h2>{mode === 'Variants' ? 'Product variants' : 'Bundle components'}</h2>
    <p className="subtitle">{mode === 'Variants' ? 'Each edition, size, or color has its own price and product stock. POS requires a variant choice.' : 'Choose the products included in each bundle. Retail items use their product stock; recipe items use their ingredients. Set any included variant and options here.'}</p>
    <p className="field-hint">Shared products use the same stock balance when sold separately or in a bundle.</p>
    {mode === 'Variants' ? variants.map((variant, index) => {
      const change = (updated: ProductVariant) => onVariants(variants.map(value => value.id === variant.id ? updated : value));
      return <fieldset key={variant.id}><legend>Variant {index + 1}</legend><div className="configuration-fields">
        <label>Variant name<input value={variant.name} maxLength={80} required onChange={event => change({ ...variant, name: event.target.value })} /></label>
        <SearchSelect label="Variant stock" value={variant.stockId} required choices={stock.map(item => ({ value: item.id, label: `${item.name} · ${item.sku ?? item.id} · ${usableQuantity(item)} pcs usable` }))} onChange={id => { const item = stock.find(value => value.id === id); change({ ...variant, stockId: id, sku: item?.sku ?? item?.id ?? '' }); }} />
        <label>Variant price<input type="number" min="0.01" step="0.01" required value={Number.isFinite(variant.price) ? variant.price : ''} onChange={event => change({ ...variant, price: event.target.value === '' ? NaN : Number(event.target.value) })} /></label>
        <label>Variant availability<select value={variant.available ? 'yes' : 'no'} onChange={event => change({ ...variant, available: event.target.value === 'yes' })}><option value="yes">Available</option><option value="no">Unavailable</option></select></label>
      </div><p className="field-hint">{stock.find(item => item.id === variant.stockId)?.name ?? 'Choose product stock'} · SKU: {variant.sku || '—'} · Receive and count this variant separately.</p><button type="button" className="danger-button" aria-label={`Remove variant ${index + 1}`} onClick={() => onVariants(variants.filter(value => value.id !== variant.id))}>Remove variant</button></fieldset>;
    }) : bundle.map((component, index) => {
      const child = products.find(product => product.id === component.productId);
      const change = (updated: BundleComponent) => onBundle(bundle.map((value, i) => i === index ? updated : value));
      // Preserve existing fixed SKU components while new choices use the product catalogue.
      const legacy = component.productId ? undefined : stock.find(item => item.id === component.stockId);
      const choices = availableProducts.map(product => ({ value: product.id, label: `${product.name} · ${product.sku ?? product.id} · ${product.mode === 'Made to order' ? 'Recipe' : product.mode === 'Stocked' ? 'Retail Item' : product.mode}` }));
      if (legacy) choices.unshift({ value: legacy.id, label: `${legacy.name} · ${legacy.sku ?? legacy.id}` });
      return <fieldset key={index}><legend>Component {index + 1}</legend><div className="configuration-fields">
        <SearchSelect label="Available product" value={component.productId ?? component.stockId} required choices={choices} onChange={id => { const product = availableProducts.find(value => value.id === id); change(product ? { ...component, productId: product.id, stockId: product.stockId ?? '', name: product.name, sku: product.sku ?? product.id, variantId: undefined, modifierIds: product.modifiers?.flatMap(group => group.options.filter(option => option.defaultSelected).map(option => option.id)) ?? [] } : { ...component, productId: undefined, stockId: id, name: legacy?.name ?? '', sku: legacy?.sku ?? id }); }} />
        <label>Quantity per bundle<input type="number" min="1" step="1" required value={Number.isFinite(component.quantity) ? component.quantity : ''} onChange={event => change({ ...component, quantity: event.target.value === '' ? NaN : Number(event.target.value) })} /></label>
        {child?.mode === 'Variants' && <label>Included variant<select value={component.variantId ?? ''} required onChange={event => { const variant = child.variants?.find(value => value.id === event.target.value); change({ ...component, variantId: variant?.id, name: `${child.name}${variant ? ` — ${variant.name}` : ''}`, sku: variant?.sku ?? child.sku ?? child.id }); }}><option value="">Choose a variant</option>{child.variants?.filter(variant => variant.available).map(variant => <option key={variant.id} value={variant.id}>{variant.name}</option>)}</select></label>}
      </div>{child?.modifiers?.map(group => <fieldset className="bundle-fixed-options" key={group.id}><legend>{group.name} · Choose {group.min}–{group.max}</legend>{group.options.map(option => <label key={option.id}><input type="checkbox" checked={component.modifierIds?.includes(option.id) ?? false} onChange={event => change({ ...component, modifierIds: event.target.checked ? [...(component.modifierIds ?? []), option.id] : component.modifierIds?.filter(id => id !== option.id) })} />{option.name}</label>)}</fieldset>)}<p className="field-hint">{component.name || 'Choose a product'} · {component.sku || '—'}</p><button type="button" className="danger-button" aria-label={`Remove component ${index + 1}`} onClick={() => onBundle(bundle.filter((_, i) => i !== index))}>Remove component</button></fieldset>;
    })}
    <button type="button" className="secondary" disabled={mode === 'Variants' ? !stock.length : !availableProducts.length} onClick={() => mode === 'Variants' ? onVariants([...variants, { id: crypto.randomUUID(), name: '', stockId: '', sku: '', price: NaN, available: true }]) : onBundle([...bundle, { stockId: '', name: '', sku: '', quantity: 1 }])}>{mode === 'Variants' ? 'Add variant' : 'Add bundle component'}</button>
  </section>;
}
