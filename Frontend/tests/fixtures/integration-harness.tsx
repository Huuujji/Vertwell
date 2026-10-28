import { StrictMode, useCallback, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Users from '../../src/pages/Users';
import Inventory from '../../src/pages/Inventory';
import { createDemoData } from './demo';
import type { Account, Product, StockItem } from './demo';
import { ViewState } from '../../src/lib/view-state';
import { ApiError } from '../../src/lib/api-client';
import { useResource } from '../../src/lib/request-state';
import '../../src/frontend.css';
import '../../src/screens.css';
import '../../src/responsive.css';
import '../../src/navigation.css';
import '../../src/admin.css';
import '../../src/redesign.css';

// Loaded only through a Playwright route override. No application test-mode flag.
declare global {
  interface Window {
    integration: { calls: number; saved: number; dirty: boolean; aborted: number;
      finish: (message?: string) => void; resources: Record<string, (value: string, failure?: boolean) => void> };
  }
}
window.integration = { calls: 0, saved: 0, dirty: false, aborted: 0, finish: () => {}, resources: {} };
function gate() {
  window.integration.calls++;
  return new Promise<void>((resolve, reject) => {
    window.integration.finish = message => message ? reject(new ApiError(message, 'conflict', 409)) : resolve();
  });
}
function ResourceHarness() {
  const [scope, setScope] = useState('first');
  const load = useCallback((signal: AbortSignal) => new Promise<string>((resolve, reject) => {
    signal.addEventListener('abort', () => { window.integration.aborted++; });
    window.integration.resources[scope] = (value, failure) => failure ? reject(new ApiError(value, 'network')) : resolve(value);
  }), [scope]);
  const resource = useResource(scope === 'signed-out' ? null : scope, load);
  return <><p role="status">{resource.status}</p><output>{resource.data ?? 'No data'}</output>
    <button onClick={() => setScope('second')}>Switch account</button><button onClick={() => setScope('signed-out')}>Sign out</button>
    <button onClick={resource.reload}>Reload</button></>;
}
function Harness() {
  const [demo] = useState(createDemoData);
  const [accounts, setAccounts] = useState(demo.accounts), [products, setProducts] = useState(demo.products), [stock, setStock] = useState(demo.stock);
  const [notice, setNotice] = useState(''), [discard, setDiscard] = useState<(() => void) | null>(null);
  const state = useRef(new Map<string, unknown>());
  const dirty = useCallback((value: boolean) => { window.integration.dirty = value; }, []);
  const update = async (item: StockItem) => { await gate(); setStock(current => current.map(value => value.id === item.id ? item : value)); window.integration.saved++; };
  return <ViewState.Provider value={state.current}><div className="workspace admin-workspace"><main className="workspace-main">
    {location.search.includes('users') ? <Users accounts={accounts} role="Owner" actorId="angel"
      onSave={async (account: Account) => { await gate(); setAccounts(current => [...current.filter(row => row.id !== account.id), account]); window.integration.saved++; }}
      onDelete={async account => { await gate(); setAccounts(current => current.filter(row => row.id !== account.id)); window.integration.saved++; }} notify={setNotice} />
      : location.search.includes('resource') ? <ResourceHarness /> : <Inventory templates={[]} onSaveTemplate={() => {}} onRemoveTemplate={() => {}}
        items={stock} products={products} actor="Angel (Owner)" onDirtyChange={dirty}
        onLeave={action => { if (window.integration.dirty) setDiscard(() => action); else action(); }} onUpdate={update} onAddIngredient={update}
        onSaveProduct={async (product: Product) => { await gate(); setProducts(current => [...current.filter(row => row.id !== product.id), product]); window.integration.saved++; }}
        onRemoveProduct={async () => { await gate(); window.integration.saved++; }} onRemoveStock={async () => { await gate(); window.integration.saved++; }} notify={setNotice} />}
    {notice && <p role="status">{notice}</p>}
    {discard && <div role="dialog" aria-label="Discard inventory edits?"><button onClick={() => setDiscard(null)}>Keep editing</button><button onClick={() => { discard(); setDiscard(null); }}>Discard changes</button></div>}
  </main></div></ViewState.Provider>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Harness /></StrictMode>);
