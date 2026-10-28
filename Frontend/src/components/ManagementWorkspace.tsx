import { useCallback, useEffect, useRef, useState } from 'react';
import type { IdentityResponse } from '../lib/auth-session';
import { apiRequest } from '../lib/api';
import { ApiError } from '../lib/api-client';
import { createManagementData, type AccountsData, type InventoryData } from '../lib/data/management';
import { useLiveResource, LiveConnectionStatus } from '../lib/live-updates';
import { ViewState } from '../lib/view-state';
import { signOut } from '../lib/auth';
import { pageFromPath, pagePaths } from '../lib/page-paths';
import Navigation, { type Page } from './Navigation';
import { lazySection } from './LazySection';
import { Actions, Modal } from './ui';
import LivePos from './LivePos';
import LiveSales from './LiveSales';
import type { ReportFilters } from '../data/durable-reporting';
import type { InventoryContext } from '../pages/Inventory';
import type { AuditContext } from '../pages/SalesHistory';

const Inventory = lazySection(() => import('../pages/Inventory'), 'Inventory');
const Users = lazySection(() => import('../pages/Users'), 'Users');
const LiveReports = lazySection(() => import('./LiveReports'), 'Reports');
const LiveDashboard = lazySection(() => import('./LiveDashboard'), 'Dashboard');

export default function ManagementWorkspace({identity}:{identity:IdentityResponse}) {
  const [service]=useState(()=>createManagementData(apiRequest));
  const role=identity.profile.role, manager=role==='Owner'||role==='Admin';
  const scope=`${identity.profile.id}:${role}`;
  const [page,updatePage]=useState<Page>(()=>pageFromPath(window.location.pathname,manager));
  function setPage(next:Page, replace=false) {
    updatePage(next);
    if(window.location.pathname!==pagePaths[next]) window.history[replace?'replaceState':'pushState'](null,'',pagePaths[next]);
  }
  const [inventoryContext,setInventoryContext]=useState<InventoryContext>();
  const [auditContext,setAuditContext]=useState<AuditContext>();
  const [reportContext,setReportContext]=useState<ReportFilters>();
  const views=useRef(new Map<string,unknown>());
  const dirty=useRef(false), busy=useRef(false);
  const checkoutBusy=useRef(false),checkoutUncertain=useRef(false);
  const workflowBusy=useRef(false),workflowUncertain=useRef(false);
  const [salesVersion,setSalesVersion]=useState(0);
  const [draftOpen,setDraftOpen]=useState(false);
  const [isDirty,setDirty]=useState(false), [isBusy,setBusy]=useState(false);
  const [pending,setPending]=useState<(()=>void)|null>(null);
  const [toast,setToast]=useState('');
  const loadInventory=useCallback((signal:AbortSignal)=>service.inventory(signal),[service]);
  const loadAccounts=useCallback((signal:AbortSignal)=>service.accounts(signal),[service]);
  const inventory=useLiveResource<InventoryData>(manager?`${scope}:inventory`:null,loadInventory,['inventory'],draftOpen||isDirty||isBusy);
  const accounts=useLiveResource<AccountsData>(manager?`${scope}:accounts`:null,loadAccounts,['accounts'],draftOpen||isDirty||isBusy);
  const loadAccess=useCallback((signal:AbortSignal)=>apiRequest<{services:{checkout:boolean;salesReview:boolean;reports:boolean}}>('/api/access',{signal}),[]);
  const access=useLiveResource(`${scope}:access`,loadAccess,['access']);
  const [hasRecovery]=useState(()=>{try{return Boolean(sessionStorage.getItem(`vertwell-checkout:${identity.profile.id}`));}catch{return false;}});
  const [hasWorkflowRecovery]=useState(()=>{try{return Boolean(sessionStorage.getItem(`vertwell-sales-workflow:${identity.profile.id}`));}catch{return false;}});
  const onCheckoutBusy=useCallback((value:boolean)=>{checkoutBusy.current=value;},[]);
  const onCheckoutUncertain=useCallback((value:boolean)=>{checkoutUncertain.current=value;if(value)setPage('POS');},[]);
  const onWorkflowBusy=useCallback((value:boolean)=>{workflowBusy.current=value;},[]);
  const onWorkflowUncertain=useCallback((value:boolean)=>{workflowUncertain.current=value;if(value)setPage('Audit Trail');},[]);
  const source=useRef(inventory.data), accountSource=useRef(accounts.data);
  source.current=inventory.data; accountSource.current=accounts.data;
  const onDirty=useCallback((value:boolean)=>{dirty.current=value;setDirty(value);},[]);
  function leave(action:()=>void) {if(busy.current||checkoutBusy.current||workflowBusy.current) return;
    if(checkoutUncertain.current){setToast('Retry the uncertain checkout to retrieve its receipt before leaving.');return;}
    if(workflowUncertain.current){setToast('Reconcile the saved sales action before leaving.');return;}
    if(dirty.current) setPending(()=>action);else action();}
  const leaveRef=useRef(leave);leaveRef.current=leave;
  useEffect(()=>{
    const pop=()=>{const next=pageFromPath(window.location.pathname,manager);let accepted=false;leaveRef.current(()=>{accepted=true;setPage(next,true);});if(!accepted)window.history.pushState(null,'',pagePaths[page]);};
    window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);
  },[manager,page]);
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
  const salesReady=access.data?.services?.salesReview===true||hasWorkflowRecovery;
  const reportsReady=manager&&access.data?.services?.reports===true;
  const effectivePage=manager && access.status==='ready' && !['Inventory','Users','POS',...(salesReady?['Dashboard','Audit Trail']:[]),...(reportsReady?['Reports']:[])].includes(page)?'Inventory':page;
  useEffect(()=>{setPage(effectivePage,true);},[effectivePage]);
  const managementPage=['Inventory','Users'].includes(effectivePage);
  const resource=effectivePage==='Users'?accounts:inventory;
  return <ViewState.Provider value={views.current}><div className={`workspace ${manager?'admin-workspace':'staff-workspace'}`}>
    <Navigation persistent identity={{name:identity.profile.username,role}} destinations={manager?[...(salesReady?['Dashboard' as const]:[]),'Inventory','POS',...(reportsReady?['Reports' as const]:[]),...(salesReady?['Audit Trail' as const]:[]),'Users']:(salesReady?['POS','Audit Trail']:['POS'])}
      activePage={effectivePage} onNavigate={next=>leave(()=>setPage(next))} onLogout={()=>leave(()=>{void logout();})} />
    <main className="workspace-main">
      <LiveConnectionStatus/>
      {manager && managementPage && resource.status==='loading' && <p role="status">Loading {effectivePage==='Users'?'accounts':'inventory'}…</p>}
      {manager && managementPage && resource.error && <div role="alert" className="error"><p>{resource.error.message}</p><button className="secondary" disabled={isBusy||isDirty} onClick={resource.reload}>Retry loading</button></div>}
      {manager && effectivePage==='Inventory' && inventory.data && <Inventory persistent onDraftOpenChange={setDraftOpen} context={inventoryContext}
        templates={inventory.data.modifierTemplates} items={inventory.data.stock} products={inventory.data.products}
        actor={`${identity.profile.username} (${role})`} onDirtyChange={onDirty} onLeave={leave}
        onSaveProduct={(product,item,change)=>saveInventory(()=>service.saveProduct(stockSource(),product,item,change))}
        onUpdate={(item,change)=>saveInventory(()=>service.saveStock(stockSource(),item,change))}
        onAddIngredient={(item,change)=>saveInventory(()=>service.saveStock(stockSource(),item,change))}
        onSaveTemplate={template=>saveInventory(()=>service.saveLibrary(stockSource(),template))}
        onRemoveTemplate={id=>saveInventory(()=>service.archive(stockSource(),'library',id,'Modifier library archived'))}
        onRemoveProduct={(id,reason)=>saveInventory(()=>service.archive(stockSource(),'product',id,reason??'Product archived'))}
        onRemoveStock={(id,reason)=>saveInventory(()=>service.archive(stockSource(),'stock',id,reason??'Stock archived'))} notify={setToast} />}
      {manager && effectivePage==='Users' && accounts.data && <Users persistent onDraftOpenChange={setDraftOpen} accounts={accounts.data.accounts} role={role} actorId={identity.profile.id}
        onDirtyChange={onDirty} onSave={(account,credentials)=>mutate(async()=>{
          if(!accountSource.current) throw new ApiError('Load accounts first.','unavailable');
          const saved=await service.saveAccount(accountSource.current,account,credentials?.password,credentials?.operationId);
          accountSource.current=saved;accounts.replace(saved);
          if(account.id===identity.profile.id) window.dispatchEvent(new Event('focus'));
        })}
        onDelete={(account,operationId)=>mutate(async()=>{const current=accountSource.current;if(!current)throw new ApiError('Load accounts first.','unavailable');
          const saved=await service.deleteAccount(current,account,operationId);accountSource.current=saved;accounts.replace(saved);
        })} notify={setToast} />}
      {(access.data?.services?.checkout===true||hasRecovery)&&<LivePos onDirtyChange={onDirty} role={role} name={identity.profile.username} scope={scope} active={effectivePage==='POS'} onBusyChange={onCheckoutBusy} onUncertainChange={onCheckoutUncertain} onSaved={()=>{inventory.reload();setSalesVersion(value=>value+1);}}/>}
      {salesReady&&<LiveSales scope={`${scope}:sales:${salesVersion}`} role={role} actor={identity.profile.username}
        active={effectivePage==='Audit Trail'||effectivePage==='Dashboard'} dashboard={effectivePage==='Dashboard'} onAudit={()=>leave(()=>setPage('Audit Trail'))}
        context={auditContext} onBusyChange={onWorkflowBusy} onUncertainChange={onWorkflowUncertain} onDirtyChange={onDirty}
        dashboardContent={onReview=><LiveDashboard scope={scope} stock={inventory.data?.stock??[]} role={role} owner={identity.profile.username} onDailyReview={onReview} onDirtyChange={onDirty}
          onAudit={context=>leave(()=>{setAuditContext({...context,token:Date.now()});setPage('Audit Trail');})}
          onInventory={context=>leave(()=>{setInventoryContext({...context,token:Date.now()});setPage('Inventory');})}
          onReports={filters=>leave(()=>{views.current.delete('LiveReports.drilldown');setReportContext(filters);setPage('Reports');})}/>}/>} 
      {reportsReady&&effectivePage==='Reports'&&<LiveReports scope={scope} context={reportContext} onInventory={context=>leave(()=>{setInventoryContext({...context,token:Date.now()});inventory.reload();setPage('Inventory');})}/>}
      {effectivePage==='POS'&&access.status==='loading'&&<p role="status">Checking POS availability…</p>}
      {effectivePage==='POS'&&access.error&&<div role="alert" className="error"><p>{access.error.message}</p><button onClick={access.reload}>Retry POS connection</button></div>}
      {effectivePage==='POS'&&access.data?.services?.checkout!==true&&access.status!=='loading'&&!access.error&&<section><h2>POS connection</h2><p>Your account is verified. Live checkout is not available yet.</p><button className="secondary" onClick={access.reload}>Check POS availability</button></section>}
    </main>
    {toast && <div className="toast" role="status">{toast}<button aria-label="Dismiss notification" onClick={()=>setToast('')}>×</button></div>}
    {pending && <Modal title="Discard unsaved changes?" onClose={()=>setPending(null)}><p>You have unsaved changes. Keep editing to save them, or discard them to continue.</p><Actions><button className="secondary" data-initial-focus onClick={()=>setPending(null)}>Keep editing</button><button className="danger-button" onClick={()=>{const action=pending;setPending(null);onDirty(false);action();}}>Discard changes</button></Actions></Modal>}
  </div></ViewState.Provider>;
}
