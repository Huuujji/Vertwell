import { useCallback, useEffect, useRef, useState } from 'react';
import { Actions, Modal } from './components/ui';
import { ViewState } from './lib/view-state';
import Navigation, { pages } from './components/Navigation';
import type { Page } from './components/Navigation';
import { businessDate, createDemoData } from './data/demo';
import type { Role, Sale, StockItem, Product, ModifierTemplate, DailyReview } from './data/demo';
import { consumeStock, convert, validateStockUsage } from './data/inventory';
import { openingMovements } from './data/stock-movements';
import type { StockMovement } from './data/stock-movements';
import Login from './pages/Login';
import { awaitingReview } from './components/DailySalesReview';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import type { InventoryContext } from './pages/Inventory';
import Pos from './pages/Pos';
import type { CartLine } from './pages/Pos';
import SalesHistory from './pages/SalesHistory';
import type { AuditContext } from './pages/SalesHistory';
import Users from './pages/Users';
import Reports from './pages/Reports';
import type { ReportContext } from './pages/Reports';
import { supabase } from './lib/supabase';
import { signOut } from './lib/auth';

export default function App() {
  const [demo] = useState(createDemoData);
  const contextSequence = useRef(0);
  const viewState = useRef(new Map<string, unknown>());
  const [identity, setIdentity] = useState<{ role: Role; name: string; id: string } | null>(null); const [page, setPage] = useState<Page>('Dashboard');
  const [stock, setStock] = useState(demo.stock); const [accounts, setAccounts] = useState(demo.accounts); const [sales, setSales] = useState(demo.sales); const [products, setProducts] = useState(demo.products); const [cart, setCart] = useState<CartLine[]>([]); const [toast, setToast] = useState('');
  const [inventoryContext, setInventoryContext] = useState<InventoryContext>(); const [auditContext, setAuditContext] = useState<AuditContext>(); const [reportContext, setReportContext] = useState<ReportContext>();
  const inventoryDirty = useRef(false);
  const [modifierTemplates, setModifierTemplates] = useState<ModifierTemplate[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>(() => openingMovements(demo.openingStock));
  const stockRef = useRef(stock);
  stockRef.current = stock;
  function updateStock(item: StockItem) {
    const previous = stockRef.current.find(value => value.id === item.id);
    const delta = item.quantity - (previous ? convert(previous.quantity, previous.unit, item.unit) : 0);
    if (delta || !previous) setMovements(current => [...current, { id: crypto.randomUUID(), stockId: item.id, date: businessDate(), unit: item.unit, quantity: delta, kind: previous ? delta > 0 ? 'Receipt' : 'Removal' : 'Opening' }]);
    const next = previous ? stockRef.current.map(value => value.id === item.id ? item : value) : [...stockRef.current, item];
    stockRef.current = next; setStock(next);
  }
  const [pendingLeave, setPendingLeave] = useState<{ action: () => void } | null>(null);
  const onInventoryDirty = useCallback((dirty: boolean) => { inventoryDirty.current = dirty; }, []);
  function leave(action: () => void) {
    if (inventoryDirty.current) setPendingLeave({ action }); else action();
  }
  const recordedIds = useRef(new Set(demo.sales.map(sale => sale.id))); const references = useRef(new Set(demo.sales.map(sale => sale.reference).filter(Boolean)));
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 5000); return () => window.clearTimeout(timer); }, [toast]);
  const productsRef = useRef(products);
  productsRef.current = products;
  useEffect(() => () => { productsRef.current.filter(product => product.image.startsWith('blob:')).forEach(product => URL.revokeObjectURL(product.image)); }, []);
  function enter(role: Role, name: string) { setIdentity({ role, name, id: `preview-${name.toLowerCase()}` }); setPage(role === 'Staff' ? 'POS' : 'Dashboard'); }
  function enterPreview(id: string) {
    const account = accounts.find(value => value.id === id);
    if (!account) return;
    setIdentity({ role: account.role, name: account.name, id: account.id });
    setPage(account.role === 'Staff' ? 'POS' : 'Dashboard');
  }
  async function logout() { try { if (supabase) await signOut(); setIdentity(null); setCart([]); viewState.current.clear(); setAuditContext(undefined); setInventoryContext(undefined); setReportContext(undefined); } catch (cause) { setToast(cause instanceof Error ? cause.message : 'Unable to sign out.'); } }
  function recordSale(sale: Sale) {
    if (recordedIds.current.has(sale.id) || sale.reference && references.current.has(sale.reference)) return false;
    const checked = sale.stockCommitted && sale.usage ? validateStockUsage(sale.usage, stockRef.current) : undefined;
    if (sale.stockCommitted && (!checked || checked.error)) { setToast(checked?.error ?? 'Stock changed. Review the available quantities before recording payment.'); return false; }
    if (checked) sale = { ...sale, usage: checked.usage };
    recordedIds.current.add(sale.id); if (sale.reference) references.current.add(sale.reference);
    setSales(current => [sale, ...current]); if (sale.stockCommitted && sale.usage) { const next = consumeStock(stockRef.current, sale.usage); stockRef.current = next; setStock(next); } return true;
  }
  function confirmDailyReview(review: DailyReview) {
    if (!identity || identity.role !== 'Owner' || review.owner !== identity.name || review.role !== 'Owner') return false;
    const included = sales.filter(sale => review.orderIds.includes(sale.id));
    if (!included.length || new Set(review.orderIds).size !== review.orderIds.length || included.length !== review.orderIds.length || included.some(sale => !awaitingReview(sale) || businessDate(sale.time) !== review.date)) return false;
    const amount = (method: Sale['method']) => Math.round(included.filter(sale => sale.method === method).reduce((sum, sale) => sum + sale.total, 0) * 100) / 100;
    if (amount('Cash') !== review.expectedCash || amount('GCash') !== review.expectedGCash || !Number.isFinite(review.actualCash) || !Number.isFinite(review.actualGCash) || review.actualCash < 0 || review.actualGCash < 0 || ((review.actualCash !== review.expectedCash || review.actualGCash !== review.expectedGCash) && !review.explanation.trim())) return false;
    setSales(current => current.map(sale => review.orderIds.includes(sale.id) && awaitingReview(sale) ? { ...sale, status: 'Completed', reviewState: 'Reviewed', dailyReview: { ...review, orderIds: [...review.orderIds] } } : sale));
    setToast(`Reviewed ${included.length} sales by ${identity.name} (Owner). ${review.outcome}. Stock unchanged.`);
    return true;
  }
  function saveProduct(product: Product, item?: StockItem) {
    setProducts(current => current.some(value => value.id === product.id) ? current.map(value => value.id === product.id ? product : value) : [...current, product]);
    if (item) updateStock(item);
  }
  function voidOrders(ids: string[], reason: string) {
    if (!identity || identity.role === 'Staff') return { voided: 0, skipped: ids.length };
    const eligible = sales.filter(sale => ids.includes(sale.id) && sale.status !== 'Voided'); const voidedAt = new Date().toISOString(), bulkActionId = ids.length > 1 ? crypto.randomUUID() : undefined;
    setSales(current => current.map(sale => eligible.some(value => value.id === sale.id) && sale.status !== 'Voided' ? { ...sale, status: 'Voided', reason, voidedBy: identity.name, voidedRole: identity.role, voidedAt, bulkActionId, voidRequest: sale.voidRequest?.status === 'Pending' ? { ...sale.voidRequest, status: 'Approved', reviewedBy: identity.name, reviewedRole: identity.role, reviewedAt: voidedAt } : sale.voidRequest } : sale));
    return { voided: eligible.length, skipped: ids.length - eligible.length };
  }
  function reviewVoid(id: string, approved: boolean) {
    if (!identity || identity.role === 'Staff') return;
    if (approved) { const sale = sales.find(value => value.id === id); if (sale?.voidRequest?.status === 'Pending') voidOrders([id], sale.voidRequest.reason); }
    else setSales(current => current.map(sale => sale.id === id && sale.voidRequest?.status === 'Pending' ? { ...sale, voidRequest: { ...sale.voidRequest, status: 'Rejected', reviewedBy: identity.name, reviewedRole: identity.role, reviewedAt: new Date().toISOString() } } : sale));
  }
  if (!identity) return <Login accounts={accounts} onPreview={enterPreview} onEnter={enter} />;
  const navigation = identity.role === 'Staff' ? pages.filter(p => p === 'POS' || p === 'Audit Trail') : pages;
  const effectivePage = navigation.includes(page) ? page : navigation[0];
  return <ViewState.Provider value={viewState.current}><div className={`workspace ${identity.role === 'Staff' ? 'staff-workspace' : 'admin-workspace'}`}>
    <Navigation identity={identity} destinations={navigation} activePage={effectivePage} onNavigate={destination => { if (destination !== effectivePage) leave(() => setPage(destination)); }} onLogout={() => leave(() => { void logout(); })} />
    <main className="workspace-main">
      {effectivePage === 'Dashboard' && <Dashboard sales={sales} stock={stock} role={identity.role} owner={identity.name} onConfirmReview={confirmDailyReview} onAudit={context => { setAuditContext({ ...context, token: ++contextSequence.current }); setPage('Audit Trail'); }} onInventory={context => { setInventoryContext({ ...context, token: ++contextSequence.current }); setPage('Inventory'); }} onReports={(start, end, category, startTime, endTime) => { setReportContext({ start, end, category, startTime, endTime, token: ++contextSequence.current }); setPage('Reports'); }} />}
      {effectivePage === 'Inventory' && <Inventory templates={modifierTemplates} onSaveTemplate={template => { setModifierTemplates(current => current.some(value => value.id === template.id) ? current.map(value => value.id === template.id ? template : value) : [...current, template]); setToast('Saved to sample modifier library. Product copies are unchanged.'); }} onRemoveTemplate={id => { setModifierTemplates(current => current.filter(value => value.id !== id)); setToast('Removed from sample library. Product copies are unchanged.'); }} items={stock} products={products} actor={`${identity.name} (${identity.role})`} context={inventoryContext} onDirtyChange={onInventoryDirty} onLeave={leave} onUpdate={updateStock} onRemoveProduct={id => setProducts(current => current.filter(value => value.id !== id))} onRemoveStock={id => { const next = stockRef.current.filter(value => value.id !== id); stockRef.current = next; setStock(next); }} onSaveProduct={saveProduct} onAddIngredient={updateStock} notify={setToast} />}
      {effectivePage === 'POS' && <Pos products={products} stock={stock} cart={cart} setCart={setCart} sales={sales} role={identity.role} name={identity.name} cashierId={identity.id} onSale={recordSale} notify={setToast} />}
      {effectivePage === 'Audit Trail' && <SalesHistory onConfirmReview={confirmDailyReview} sales={sales} actor={identity.name} context={auditContext} role={identity.role} cashierId={identity.id} onBulkVoid={voidOrders} onVoid={(id, reason) => voidOrders([id], reason)} onRequestVoid={(id, reason) => setSales(current => current.map(sale => sale.id === id && sale.status !== 'Voided' && sale.voidRequest?.status !== 'Pending' ? { ...sale, voidRequest: { reason, requestedBy: identity.name, requestedRole: identity.role, requestedAt: new Date().toISOString(), status: 'Pending' } } : sale))} onReviewVoid={reviewVoid} notify={setToast} />}
      {effectivePage === 'Users' && <Users accounts={accounts} role={identity.role} actorId={identity.id} onSave={account => { setAccounts(current => current.some(value => value.id === account.id) ? current.map(value => value.id === account.id ? account : value) : [...current, account]); if (account.id === identity.id) setIdentity({ ...identity, name: account.name, role: account.role }); }} onDelete={id => setAccounts(current => current.filter(account => account.id !== id))} notify={setToast} />}
      {effectivePage === 'Reports' && <Reports movements={movements} sales={sales} stock={stock} context={reportContext} onInventory={context => { setInventoryContext({ ...context, token: ++contextSequence.current }); setPage('Inventory'); }} />}<div className="preview-badge">Frontend preview · sample data · resets on refresh · recipes are illustrative</div></main>
    {toast && <div className="toast" role="status">{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification">×</button></div>}
    {pendingLeave && <Modal title="Discard inventory edits?" onClose={() => setPendingLeave(null)}><p>You have unsaved inventory changes. Keep editing to save them, or discard them to continue.</p><Actions><button className="secondary" data-initial-focus onClick={() => setPendingLeave(null)}>Keep editing</button><button className="danger-button" onClick={() => { const action = pendingLeave.action; setPendingLeave(null); action(); }}>Discard changes</button></Actions></Modal>}
  </div></ViewState.Provider>;
}

