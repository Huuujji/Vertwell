import CartSummary from '../components/CartSummary';
import CartItem, { OrderItemCount } from '../components/CartItem';
import CheckoutSummary from '../components/CheckoutSummary';
import { CashPaymentFields, GCashPaymentFields, GCashQr } from '../components/PaymentFields';
import PosHeading, { CatalogueCaption } from '../components/PosHeading';
import CatalogueCard from '../components/CatalogueCard';
import { useViewState } from '../lib/view-state';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Actions, Art, Modal, asset } from '../components/ui';
import { businessDate, money, sellingPrice } from '../data/demo';
import SearchField from '../components/SearchField';
import CustomizeProduct from '../components/CustomizeProduct';
import { requirements, usageFor, usableQuantity } from '../data/inventory';
import { bundleDescription, catalogueMaximum, cataloguePrice, productStockError, variantPrice } from '../data/catalogue';
import type { Modifier, StockItem, Product, ProductVariant, Role, Sale } from '../data/demo';

export interface CartLine { product: Product; quantity: number; modifiers?: Modifier[]; variant?: ProductVariant }
export const cartKey = (line: CartLine) => JSON.stringify([line.product.id, variantPrice(line.product, line.variant), line.product.discountType, line.product.discountValue, line.product.mode, line.product.stockId, line.product.recipe, line.variant, line.product.bundle, line.modifiers?.map(option => ({ id: option.id, price: option.price, inputs: option.inputs })).sort((a, b) => a.id.localeCompare(b.id)) ?? []]);
export const lineName = (line: CartLine) => `${line.product.name}${line.variant ? ` — ${line.variant.name}` : ''}`;
export const linePrice = (line: CartLine) => sellingPrice({ ...line.product, price: variantPrice(line.product, line.variant) + (line.modifiers?.reduce((sum, option) => sum + option.price, 0) ?? 0) });
export default function Pos({ products, stock, cart, setCart, sales, role, name, cashierId, onSale, notify }: { products: Product[]; stock: StockItem[]; cart: CartLine[]; setCart: (cart: CartLine[]) => void; sales: Sale[]; role: Role; name: string; cashierId: string; onSale: (sale: Sale) => boolean; notify: (message: string) => void }) {
  const [filter, setFilter] = useViewState('Pos.filter', 'All Items'); const [search, setSearch] = useViewState('Pos.search', ''); const [payment, setPayment] = useState<'order' | 'cash' | 'qr' | null>(null); const [given, setGiven] = useState(''); const [error, setError] = useState('');
  const submitting = useRef(false);
  const [customizing, setCustomizing] = useState<{ product: Product; key?: string; initial?: Modifier[] } | null>(null);
  const subtotal = cart.reduce((sum, line) => sum + Math.round(linePrice(line) * 100) * line.quantity, 0) / 100;
  const vat = Math.round(subtotal * 12) / 100; const total = Math.round((subtotal + vat) * 100) / 100;
  const [orderId, setOrderId] = useState('');
  function checkCart(lines: CartLine[]) {
    if (lines.some(line => !products.some(product => product.id === line.product.id))) return { usage: [], error: 'A product in this order was removed. Clear or remove it before payment.' };
    if (lines.some(line => products.find(product => product.id === line.product.id)?.available === false)) return { usage: [], error: 'A product in this order is now unavailable. Remove it before payment.' };
    return usageFor(lines, stock, undefined, products);
  }
  function add(product: Product, modifiers: Modifier[] = [], editingKey?: string, quantity = 1, variant?: ProductVariant) {
    const candidate = { product, modifiers, variant, quantity: 1 }; const key = cartKey(candidate);
    const others = cart.filter(line => cartKey(line) !== editingKey);
    const existing = others.find(line => cartKey(line) === key);
    const next = existing ? others.map(line => cartKey(line) === key ? { ...line, quantity: line.quantity + quantity } : line) : [...others, { ...candidate, quantity }];
    const check = checkCart(next); if (check.error) { notify(check.error); return; }
    setCart(next); setCustomizing(null);
  }
  function quantity(key: string, delta: number) {
    const next = cart.map(line => cartKey(line) === key ? { ...line, quantity: line.quantity + delta } : line).filter(line => line.quantity > 0);
    const check = checkCart(next); if (delta > 0 && check.error) { notify(check.error); return; } setCart(next);
  }
  function checkout() {
    if (!cart.length) return; const check = checkCart(cart); if (check.error) { notify(check.error); return; }
    submitting.current = false; setOrderId(`${businessDate().replaceAll('-', '')}${String(sales.length + 1).padStart(5, '0')}`); setError(''); setPayment('order');
  }
  function finish(method: 'Cash' | 'GCash', reference?: string) {
    if (submitting.current) return;
    const check = checkCart(cart); if (check.error) { setError(check.error); return; }
    submitting.current = true;
    const saved = onSale({ id: orderId, time: new Date().toISOString(), cashier: name, cashierRole: role, cashierId, paymentState: 'Received', fulfilmentState: 'Fulfilled', reviewState: role === 'Owner' ? 'Owner checkout' : 'Awaiting Owner review', status: role === 'Owner' ? 'Completed' : 'Pending', method, reference,
      lines: cart.map(line => ({ name: lineName(line), variant: line.variant ? { ...line.variant } : undefined, bundle: line.product.bundle?.map(value => ({ ...value })), category: line.product.category, originalPrice: variantPrice(line.product, line.variant) + (line.modifiers?.reduce((sum, option) => sum + option.price, 0) ?? 0), quantity: line.quantity, price: linePrice(line), modifiers: line.modifiers?.map(({ id, name, price }) => ({ id, name, price })), recipe: requirements(line.product, line.modifiers, line.variant, products), usage: usageFor([line], stock, undefined, products).usage.map(input => ({ ...input })) })), usage: check.usage, usageComplete: cart.every(line => line.product.mode === 'Variants' ? Boolean(line.variant?.stockId) : line.product.mode === 'Bundle' ? Boolean(line.product.bundle?.length) : line.product.mode === 'Stocked' ? Boolean(line.product.stockId) : Boolean(line.product.recipe?.length)), stockCommitted: true, total });
    if (!saved) { submitting.current = false; setError('Payment could not be recorded. Check stock and duplicate references, then try again.'); return; }
    setCart([]); setGiven(''); setPayment(null); notify(`Sample order ${orderId} recorded (${role === 'Owner' ? 'Completed' : 'Pending · payment received · awaiting Owner review'}).`);
  }
  function submitCash(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (Number(given) < total || !Number.isFinite(Number(given))) { setError('Amount given must cover the total due.'); return; } finish('Cash'); }
  function submitQr(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const values = new FormData(event.currentTarget); const reference = String(values.get('reference')); if (!/^\d{13}$/.test(reference)) { setError('Enter a 13-digit GCash reference number.'); return; } if (sales.some(sale => sale.reference === reference)) { setError('This reference number is already recorded.'); return; } if (Number(values.get('amount')) !== total) { setError('Payment amount must equal the total due.'); return; } finish('GCash', reference); }
  const itemCount = cart.reduce((count, line) => count + line.quantity, 0);
  const filtered = products.filter(product => (filter === 'All Items' || (filter === 'F&B' ? product.category !== 'Hobby' : product.category === 'Hobby')) && `${product.name} ${product.sku ?? product.id} ${product.code ?? ''} ${product.variants?.map(value => `${value.name} ${value.sku}`).join(" ") ?? ""} ${bundleDescription(product.bundle)}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="pos-layout" data-node-id="1329:18851"><div className="catalog"><PosHeading role={role} name={name}/><div className="catalog-toolbar"><div className="tabs">{['All Items', 'F&B', 'Hobby Items'].map(value => <button key={value} className={filter === value ? 'selected' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}</div><SearchField label="Search items" placeholder="Search Items" value={search} onChange={setSearch} /></div>
    {role === 'Staff' && <CatalogueCaption count={filtered.length}/>}<div className="product-grid">{filtered.map(product => { const unavailable = productStockError(product, stock, products, cart); return <CatalogueCard key={product.id} name={product.name} image={product.image ? product.image.startsWith('blob:') ? product.image : asset(product.image) : undefined} icon={product.icon} unavailable={unavailable || undefined} onClick={() => { if (productStockError(product, stock, products, cart)) return; if (product.modifiers?.length || product.mode === 'Variants' || product.mode === 'Bundle') setCustomizing({ product }); else add(product); }} price={<><small>₱</small>{product.mode === 'Variants' && <small>From </small>}{cataloguePrice(product)}{product.mode === 'Variants' && <><small> To </small>{catalogueMaximum(product)}</>}{product.mode !== 'Variants' && sellingPrice(product) < product.price && <small className="original-price"><s>{money(product.price)}</s></small>}</>}>{product.mode === 'Variants' && <small className="stock-unlinked">Choose a variant · {product.variants?.length ?? 0} options</small>}{product.mode === 'Bundle' && <small className="stock-unlinked">Bundle · {product.bundle?.length ?? 0} SKUs</small>}{product.mode === 'Stocked' && product.stockId && <small className="stock-unlinked">{Math.max(0, (stock.find(item => item.id === product.stockId) ? usableQuantity(stock.find(item => item.id === product.stockId)!) : 0) - (checkCart(cart).usage.find(input => input.stockId === product.stockId)?.quantity ?? 0))} available for this order</small>}{!product.mode && <small className="stock-unlinked">Sample stock not linked</small>}</CatalogueCard>; })}{filtered.length === 0 && <p className="empty-state">No items match your search.</p>}</div></div>
    <aside className="order-panel"><h2>Current Order{role === 'Staff' && <OrderItemCount count={itemCount}/>}</h2><div className="cart-lines">{!cart.length && <div className="cart-empty"><strong>Your order starts here</strong><p>Select an item from the catalogue.</p></div>}{cart.map(line => <CartItem key={cartKey(line)} name={lineName(line)} sku={line.variant?.sku} components={line.product.bundle?.length ? bundleDescription(line.product.bundle) : undefined} modifiers={line.modifiers?.map(option=>({id:option.id,name:option.name,amount:money(option.price)}))} editAction={line.product.modifiers?.length || line.product.mode === 'Variants' || line.product.mode === 'Bundle' ? <button className="edit-customization" onClick={() => setCustomizing({ product: line.product, key: cartKey(line), initial: line.modifiers })}>{line.product.mode === 'Bundle' ? 'View bundle' : 'Edit options'}</button> : undefined} amount={money(linePrice(line) * line.quantity)}><div className="quantity-control"><button aria-label={`Remove one ${lineName(line)}`} onClick={() => quantity(cartKey(line), -1)}>−</button><output aria-label={`${lineName(line)} quantity`}>{line.quantity}</output><button aria-label={`Add one ${lineName(line)}`} disabled={Boolean(checkCart(cart.map(value => cartKey(value) === cartKey(line) ? { ...value, quantity: value.quantity + 1 } : value)).error)} onClick={() => quantity(cartKey(line), 1)}>+</button></div></CartItem>)}</div><div className="cart-footer"><CartSummary role={role} subtotal={money(subtotal)} tax={money(vat)} total={money(total)}/><Actions><button className="clear-button" onClick={() => setCart([])} disabled={!cart.length}><Art file="6006e.svg" className="card-art" /><span>Clear</span></button><button className="pay-button" disabled={!cart.length} onClick={checkout}>Pay</button></Actions></div></aside>
    {customizing && <CustomizeProduct product={customizing.product} stock={stock} products={products} initial={customizing.initial} initialVariant={cart.find(line => cartKey(line) === customizing.key)?.variant} initialQuantity={cart.find(line => cartKey(line) === customizing.key)?.quantity ?? 1} otherLines={cart.filter(line => cartKey(line) !== customizing.key)} editing={Boolean(customizing.key)} onClose={() => setCustomizing(null)} onSave={(options, count, variant) => add(customizing.product, options, customizing.key, count, variant)} />}
    {payment && <Modal title={payment === 'order' ? 'ORDER CONFIRMATION' : payment === 'cash' ? 'CASH PAYMENT' : 'QR PAYMENT'} plain focusOnTitleChange className={`payment-modal ${payment === 'order' ? 'confirmation-modal' : ''}`} onClose={() => setPayment(null)}>
      <p className="order-id">Order ID: {orderId}</p>{role === 'Staff' && <p className="staff-dialog-note">Preview payment · after checkout, payment is recorded as received and stock is consumed once. Owner review is separate.</p>}
      {payment === 'order' ? <CheckoutSummary preview subtotal={money(subtotal)} tax={money(vat)} total={money(total)}
        onCash={() => { setError(''); setPayment('cash'); }} onGCash={() => { setError(''); setPayment('qr'); }}
        lines={cart.map(line => ({key:cartKey(line),name:lineName(line),quantity:line.quantity,amount:money(linePrice(line)*line.quantity),details:<>{line.variant&&<small className="receipt-modifier">SKU: {line.variant.sku}</small>}{line.product.bundle?.length?<small className="receipt-modifier">Includes: {bundleDescription(line.product.bundle)}</small>:null}{line.modifiers?.map(option=><small className="receipt-modifier" key={option.id}>{option.name} · +{money(option.price)}</small>)}</>}))}/> : payment === 'cash' ? <form onSubmit={submitCash}><CashPaymentFields total={total} given={given} onChange={setGiven}/>{error && <p role="alert" className="error">{error}</p>}<Actions><button type="button" className="secondary" onClick={() => setPayment('order')}>Cancel</button><button className="primary">Confirm</button></Actions></form> : <form className="qr-payment" onSubmit={submitQr}><GCashQr preview/><GCashPaymentFields/><label>Amount received<input type="number" name="amount" defaultValue={total} min="0.01" step="0.01" required /></label>{error && <p role="alert" className="error">{error}</p>}<Actions><button className="secondary" type="button" onClick={() => setPayment('order')}>Cancel</button><button className="primary">Record sample</button></Actions></form>}
    </Modal>}
  </section>;
}

