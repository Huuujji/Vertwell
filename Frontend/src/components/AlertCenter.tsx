import { useCallback,useEffect,useRef,useState } from 'react';
import { useLiveResource } from '../lib/live-updates';
import { apiRequest } from '../lib/api';
import type { Row } from '../lib/data/database.generated';
import useDiscardChanges from './useDiscardChanges';
import { useViewState } from '../lib/view-state';
import type { Role, Sale } from '../data/demo';
import { awaitingReview } from './DailySalesReview';
import { businessDate, money, manilaTime } from '../data/demo';
import { duplicateGroups } from '../data/audit';
import type { AuditContext } from '../pages/SalesHistory';
import { createNotificationsData,type SavedNotification } from '../lib/data/notifications';
import { ApiError } from '../lib/api-client';

type ReviewAlert={id:string;kind:string;title:string;reason:string;actor:string;role:string;time:string;orders:string[];context:Omit<AuditContext,'token'>};
function savedAlert(item:SavedNotification):ReviewAlert {
  const p=item.evidence,duplicate=item.kind==='Duplicate activity';
  const reason=duplicate?`${item.orderIds.length} identical orders; at least ${p.threshold} within ${p.minutes} minutes. Human review required.`:p.reason!;
  return {id:item.id,kind:item.kind,title:duplicate?'Potential duplicate activity':'Pending void review',reason,actor:p.actor,role:p.role,time:p.time,orders:item.orderIds,
    context:{selected:item.orderIds[0],orderIds:item.orderIds,...(!duplicate?{requestsOnly:true}:{}),
      investigation:duplicate?`Potential duplicate activity · ${p.actor} · ${reason} ${manilaTime(p.startTime!)} – ${manilaTime(p.time)}. Review before taking action.`:`Pending void review · ${p.actor} · ${reason}`}};
}

export default function AlertCenter({ sales, role, onOpen, onDailyReview, persistent = false, onDirtyChange }: { onDirtyChange?: (dirty:boolean)=>void; persistent?: boolean; sales: Sale[]; role: Role; onDailyReview: (date: string) => void; onOpen: (context: Omit<AuditContext, 'token'>) => void }) {
  const [read, setRead] = useViewState<string[]>('alerts.read', []); const [threshold, setThreshold] = useViewState('alerts.threshold', 5); const [minutes, setMinutes] = useViewState('alerts.minutes', 2); const [settings, setSettings] = useState(false);
  const [filter, setFilter] = useViewState('alerts.filter', 'All reviews');
  const load=useCallback((signal:AbortSignal)=>apiRequest<{settings:Row<'alert_settings'>|null}>('/api/alert-settings',{signal}),[]);
  const saved=useLiveResource(persistent&&role==='Owner'?'alerts':null,load,['accounts'],settings);
  const baseline=useRef<Row<'alert_settings'>|null>(null),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const [notifications]=useState(()=>createNotificationsData(apiRequest)),[marking,setMarking]=useState<string|null>(null),[readError,setReadError]=useState('');
  const loadNotifications=useCallback((signal:AbortSignal)=>notifications.read(signal),[notifications]);
  const feed=useLiveResource(persistent?'notifications':null,loadNotifications,['notifications'],marking!==null);
  const uncertainRead=useRef<{id:string;revision:string;read:boolean}|null>(null);
  useEffect(()=>{
    const desired=uncertainRead.current;if(!desired||feed.status!=='ready')return;
    if(feed.data?.items.some(item=>item.id===desired.id&&item.revision===desired.revision&&item.read===desired.read)){
      uncertainRead.current=null;setReadError('');
    }
  },[feed.data,feed.status]);
  const isRead=(id:string)=>persistent?feed.data?.items.find(item=>item.id===id)?.read===true:read.includes(id);
  async function toggleRead(id:string){
    if(!persistent){setRead(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);return;}
    const item=feed.data?.items.find(item=>item.id===id);if(!item||marking||feed.status!=='ready')return;
    setMarking(id);setReadError('');uncertainRead.current=null;
    try{await notifications.mark(item,!item.read);feed.reload();}
    catch(cause){
      if(cause instanceof ApiError&&cause.kind==='network')uncertainRead.current={id:item.id,revision:item.revision,read:!item.read};
      setReadError(cause instanceof Error?cause.message:'Unable to save the read marker.');feed.reload();
    }
    finally{setMarking(null);}
  }
  const edited=persistent&&settings&&(threshold!==(baseline.current?.similar_order_threshold??5)||minutes!==(baseline.current?.window_minutes??2));
  const guard=useDiscardChanges(edited,()=>setSettings(false),'alert settings');
  useEffect(()=>{onDirtyChange?.(edited||saving);return()=>onDirtyChange?.(false);},[edited,saving,onDirtyChange]);
  useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(edited||saving){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[edited,saving]);
  function toggleSettings(){
    if(saving)return;
    if(settings){guard.requestClose();return;}
    if(!settings&&persistent){baseline.current=saved.data?.settings??null;setThreshold(baseline.current?.similar_order_threshold??5);setMinutes(baseline.current?.window_minutes??2);}
    setSettings(!settings);setError('');
  }
  const daily = sales.filter(awaitingReview);
  const dates = [...new Set(daily.map(sale => businessDate(sale.time)))].sort().reverse();
  const pending = sales.filter(sale => sale.voidRequest?.status === 'Pending');
  const detectionThreshold=persistent?saved.data?.settings?.similar_order_threshold??5:threshold;
  const detectionMinutes=persistent?saved.data?.settings?.window_minutes??2:minutes;
  const unusual = persistent?[]:duplicateGroups(sales,detectionThreshold,detectionMinutes);
  const previewAlerts:ReviewAlert[] = [
    ...pending.map(sale => ({ id: `void-${sale.id}-${sale.voidRequest!.requestedAt}`, kind: 'Void requests', title: 'Pending void review', reason: sale.voidRequest!.reason, actor: sale.voidRequest!.requestedBy, role: sale.voidRequest!.requestedRole ?? 'Role not recorded', time: sale.voidRequest!.requestedAt, orders: [sale.id], context: { selected: sale.id, requestsOnly: true, orderIds: [sale.id], investigation: `Pending void review · ${sale.voidRequest!.requestedBy} · ${sale.voidRequest!.reason}` } })),
    ...unusual.map(group => ({ id: `unusual-${JSON.stringify(group.map(sale => sale.id))}`, kind: 'Duplicate activity', title: 'Potential duplicate activity', reason: `${group.length} identical orders; at least ${detectionThreshold} within ${detectionMinutes} minutes. Human review required.`, actor: group[0].cashier, role: group[0].cashierRole ?? 'Role not recorded', time: group.at(-1)!.time, orders: group.map(sale => sale.id), context: { selected: group[0].id, orderIds: group.map(sale => sale.id), investigation: `Potential duplicate activity · ${group[0].cashier} · ${group.length} identical orders; at least ${detectionThreshold} within ${detectionMinutes} minutes. ${manilaTime(group[0].time)} – ${manilaTime(group.at(-1)!.time)}. Review before taking action.` } })),
  ];
  const alerts=(persistent?(feed.data?.items??[]).map(savedAlert):previewAlerts).sort((a,b)=>Number(isRead(a.id))-Number(isRead(b.id))||Number(a.kind!=='Void requests')-Number(b.kind!=='Void requests')||Date.parse(b.time)-Date.parse(a.time));
  const visible = alerts.filter(alert => filter === 'All reviews' || alert.kind === filter);
  return <><section className="alert-center" aria-label="Notifications and review">
    <div className="page-heading"><div><h2>Needs your review <span className="alert-count">{alerts.length + dates.length}</span></h2><p role="status">{persistent&&!feed.data?'Loading saved alerts…':`${alerts.filter(alert=>!isRead(alert.id)).length} unread · ${persistent?'saved alerts':'sample alerts'}`}</p></div><div className="heading-actions">
      {role === 'Owner' && <button className="secondary" disabled={persistent&&saved.status!=='ready'} onClick={toggleSettings} aria-expanded={settings} aria-controls="alert-settings">Alert settings</button>}
      <button className="secondary" onClick={() => onOpen({ allReviews: true })}>View all requests</button>
    </div></div>
    {persistent&&feed.error&&<div className="error" role="alert"><p>Saved alerts could not be loaded. {feed.error.message}</p><button className="secondary" onClick={feed.reload}>Retry loading alerts</button></div>}
    {readError&&<p className="error" role="alert">{readError}</p>}
    {persistent&&role==='Owner'&&saved.error&&<p className="error" role="alert">Saved alert settings could not be loaded. Existing detection rules remain active.</p>}<div className="daily-review-cards">{(dates.length ? dates : [businessDate()]).map(date => {
      const orders = daily.filter(sale => businessDate(sale.time) === date);
      return <article key={date} className={`daily-review-card ${orders.length ? 'attention-required' : 'review-clear'}`}><div><strong>Daily Sales Review</strong><p>{date} · {orders.length} awaiting Owner review · {money(orders.reduce((sum, sale) => sum + sale.total, 0))}</p><small>{orders.length ? 'Payment received / fulfilled · Owner verification outstanding' : 'No sales awaiting review'}</small></div><button className="secondary" disabled={!orders.length} onClick={() => onDailyReview(date)}>Review daily sales</button></article>;
    })}</div><div className="alert-filters" aria-label="Review categories">{['All reviews', 'Void requests', 'Duplicate activity'].map(value => <button key={value} className="secondary" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value} <span>{value === 'All reviews' ? alerts.length : alerts.filter(alert => alert.kind === value).length}</span></button>)}</div>
    {role === 'Owner' && settings && <div className="alert-settings" id="alert-settings"><label>Similar order threshold<input type="number" min="2" max="100" step="1" value={threshold} onChange={event => setThreshold(Math.max(2, Math.min(100, Math.round(Number(event.target.value) || 2))))} /></label><label>Window (minutes)<input type="number" min="1" max="60" step="1" value={minutes} onChange={event => setMinutes(Math.max(1, Math.min(60, Math.round(Number(event.target.value) || 1))))} /></label>{persistent&&<p>Saved detection settings. Repeated orders can be legitimate; review the evidence. Read status is saved to your account across logins. New evidence makes the alert unread again; marking read does not resolve it.</p>}{persistent&&<><button className="primary" disabled={saving||saved.status!=='ready'} onClick={async()=>{setSaving(true);setError('');try{const result=await apiRequest<{settings:Row<'alert_settings'>}>('/api/alert-settings',{method:'PATCH',body:JSON.stringify({updatedAt:baseline.current?.updated_at??null,similarOrderThreshold:threshold,windowMinutes:minutes})});saved.replace(result);baseline.current=result.settings;setSettings(false);}catch(cause){setError(cause instanceof Error?cause.message:'Unable to save alert settings.');}finally{setSaving(false);}}}>{saving?'Saving…':'Save alert settings'}</button>{error&&<p role="alert" className="error">{error}</p>}</>}<p hidden={persistent}>Preview detection only. Repeated orders can be legitimate; review the evidence. Settings and read markers last until logout. New orders or a new request make the affected alert unread again.</p></div>}
    {visible.length ? <div className="alert-list">{visible.map(alert => <article key={alert.id} className={isRead(alert.id) ? 'read' : ''} aria-label={`${alert.title}, ${alert.actor}`}><div>
      <span className="alert-kind">{alert.kind === 'Void requests' ? 'Approval needed' : 'Investigation needed'}</span><strong>{alert.title}</strong><p>{alert.actor} · {alert.role} · {manilaTime(alert.time)}</p><p>{alert.reason}</p>
      <details className="alert-evidence"><summary>{alert.orders.length} affected {alert.orders.length === 1 ? 'order' : 'orders'}</summary><p>Orders: {alert.orders.join(', ')}</p></details>
      <small>{isRead(alert.id) ? 'Read / unresolved' : 'Unread / unresolved'}</small></div><div className="row-actions">
      <button className="primary" onClick={() => onOpen(alert.context)}>Review orders</button><button className="secondary" disabled={persistent&&(marking!==null||feed.status!=='ready')} onClick={()=>void toggleRead(alert.id)}>{marking===alert.id?'Saving…':isRead(alert.id)?'Mark unread':'Mark read'}</button>
    </div></article>)}</div> : !(persistent&&!feed.data)&&<p className="empty-state">{alerts.length ? `No ${filter.toLowerCase()} need review. Choose All reviews to see the other alerts.` : 'No pending void requests or unusual activity detected.'}</p>}
  </section>{guard.confirmation}</>;
}
