import { useCallback, useEffect, useRef, useState } from 'react';
import type { IdentityResponse } from '../lib/auth-session';
import { apiRequest } from '../lib/api';
import { ApiError } from '../lib/api-client';
import { createManagementData, type AccountsData, type InventoryData } from '../lib/data/management';
import { useResource } from '../lib/request-state';
import { ViewState } from '../lib/view-state';
import { signOut } from '../lib/auth';
import Navigation, { type Page } from './Navigation';
import Inventory from '../pages/Inventory';
import Users from '../pages/Users';
import { Actions, Modal } from './ui';

export default function ManagementWorkspace({identity}:{identity:IdentityResponse}) {
  const [service]=useState(()=>createManagementData(apiRequest));
  const role=identity.profile.role, manager=role==='Owner'||role==='Admin';
  const scope=`${identity.profile.id}:${role}`;
  const [page,setPage]=useState<Page>(manager?'Inventory':'POS');
  const views=useRef(new Map<string,unknown>());
  const dirty=useRef(false), busy=useRef(false);
  const [isDirty,setDirty]=useState(false), [isBusy,setBusy]=useState(false);
  const [pending,setPending]=useState<(()=>void)|null>(null);
  const [toast,setToast]=useState('');
  const loadInventory=useCallback((signal:AbortSignal)=>service.inventory(signal),[service]);
  const loadAccounts=useCallback((signal:AbortSignal)=>service.accounts(signal),[service]);
  const inventory=useResource<InventoryData>(manager?`${scope}:inventory`:null,loadInventory);
  const accounts=useResource<AccountsData>(manager?`${scope}:accounts`:null,loadAccounts);
  const source=useRef(inventory.data), accountSource=useRef(accounts.data);
  source.current=inventory.data; accountSource.current=accounts.data;
  const onDirty=useCallback((value:boolean)=>{dirty.current=value;setDirty(value);},[]);
  function leave(action:()=>void) {if(busy.current) return; if(dirty.current) setPending(()=>action);else action();}
  async function mutate<T>(save:()=>Promise<T>):Promise<T> {
    if(busy.current) throw new ApiError('A save is already in progress.','conflict');
    busy.current=true;setBusy(true);
    try {return await save();} finally {busy.current=false;setBusy(false);}
  }
  function stockSource() {if(!source.current) throw new ApiError('Load inventory before saving.','unavailable');return source.current.source;}
  async function saveInventory(save:()=>Promise<{data:InventoryData;entityId:string}>) {
    await mutate(async()=>{const result=await save(); source.current=result.data;inventory.replace(result.data);});
  }
  async function logout() {try {await signOut();}catch(cause){setToast(cause instanceof Error?cause.message:'Unable to sign out.');}}
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),6000);return ()=>clearTimeout(timer);},[toast]);
  const effectivePage=manager && !['Inventory','Users'].includes(page)?'Inventory':page;
  const resource=effectivePage==='Users'?accounts:inventory;
  return <ViewState.Provider value={views.current}><div className={`workspace ${manager?'admin-workspace':'staff-workspace'}`}>
    <Navigation persistent identity={{name:identity.profile.full_name,role}} destinations={manager?['Inventory','Users']:['POS']}
      activePage={effectivePage} onNavigate={next=>leave(()=>setPage(next))} onLogout={()=>leave(()=>{void logout();})} />
    <main className="workspace-main">
      <div className="page-heading"><div><h1>Welcome, {identity.profile.full_name}</h1><p>Signed in as <strong>{role}</strong> · @{identity.profile.username}</p></div>
        {manager && <button className="secondary" disabled={isDirty||isBusy||resource.status==='loading'} onClick={()=>{inventory.reload();accounts.reload();}}>Refresh data</button>}</div>
      <p className="inventory-editor-note">Development workspace · inventory and team changes are saved and shared with permitted accounts.</p>
      {manager && resource.status==='loading' && <p role="status">Loading {effectivePage==='Users'?'accounts':'inventory'}…</p>}
      {manager && resource.error && <div role="alert" className="error"><p>{resource.error.message}</p><button className="secondary" disabled={isBusy||isDirty} onClick={resource.reload}>Retry loading</button></div>}
      {manager && effectivePage==='Inventory' && inventory.data && <Inventory persistent
        templates={inventory.data.modifierTemplates} items={inventory.data.stock} products={inventory.data.products}
        actor={`${identity.profile.full_name} (${role})`} onDirtyChange={onDirty} onLeave={leave}
        onSaveProduct={(product,item,change)=>saveInventory(()=>service.saveProduct(stockSource(),product,item,change))}
        onUpdate={(item,change)=>saveInventory(()=>service.saveStock(stockSource(),item,change))}
        onAddIngredient={(item,change)=>saveInventory(()=>service.saveStock(stockSource(),item,change))}
        onSaveTemplate={template=>saveInventory(()=>service.saveLibrary(stockSource(),template))}
        onRemoveTemplate={id=>saveInventory(()=>service.archive(stockSource(),'library',id,'Modifier library archived'))}
        onRemoveProduct={(id,reason)=>saveInventory(()=>service.archive(stockSource(),'product',id,reason??'Product archived'))}
        onRemoveStock={(id,reason)=>saveInventory(()=>service.archive(stockSource(),'stock',id,reason??'Stock archived'))} notify={setToast} />}
      {manager && effectivePage==='Users' && accounts.data && <Users persistent accounts={accounts.data.accounts} role={role} actorId={identity.profile.id}
        onDirtyChange={onDirty} onSave={(account,credentials)=>mutate(async()=>{
          if(!accountSource.current) throw new ApiError('Load accounts first.','unavailable');
          const saved=await service.saveAccount(accountSource.current,account,credentials?.password,credentials?.operationId);
          accountSource.current=saved;accounts.replace(saved);
          if(account.id===identity.profile.id) window.dispatchEvent(new Event('focus'));
        })}
        onDelete={id=>mutate(async()=>{const current=accountSource.current;if(!current)throw new ApiError('Load accounts first.','unavailable');
          const account=current.accounts.find(row=>row.id===id);if(!account)throw new ApiError('Account changed. Reload and review.','conflict');
          const saved=await service.saveAccount(current,{...account,active:false});accountSource.current=saved;accounts.replace(saved);
        })} notify={setToast} />}
      {!manager && <section><h2>POS connection</h2><p>Your account is verified. Live checkout is not available yet.</p></section>}
    </main>
    {toast && <div className="toast" role="status">{toast}<button aria-label="Dismiss notification" onClick={()=>setToast('')}>×</button></div>}
    {pending && <Modal title="Discard unsaved changes?" onClose={()=>setPending(null)}><p>You have unsaved changes. Keep editing to save them, or discard them to continue.</p><Actions><button className="secondary" data-initial-focus onClick={()=>setPending(null)}>Keep editing</button><button className="danger-button" onClick={()=>{const action=pending;setPending(null);onDirty(false);action();}}>Discard changes</button></Actions></Modal>}
  </div></ViewState.Provider>;
}
