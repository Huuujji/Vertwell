import { useState } from 'react';
import { useViewState } from '../lib/view-state';
import type { Role, Sale } from '../data/demo';
import { awaitingReview } from './DailySalesReview';
import { businessDate, money, manilaTime } from '../data/demo';
import { duplicateGroups } from '../data/audit';
import type { AuditContext } from '../pages/SalesHistory';

export default function AlertCenter({ sales, role, onOpen, onDailyReview }: { sales: Sale[]; role: Role; onDailyReview: (date: string) => void; onOpen: (context: Omit<AuditContext, 'token'>) => void }) {
  const [read, setRead] = useViewState<string[]>('alerts.read', []); const [threshold, setThreshold] = useViewState('alerts.threshold', 5); const [minutes, setMinutes] = useViewState('alerts.minutes', 2); const [settings, setSettings] = useState(false);
  const [filter, setFilter] = useViewState('alerts.filter', 'All reviews');
  const daily = sales.filter(awaitingReview);
  const dates = [...new Set(daily.map(sale => businessDate(sale.time)))].sort().reverse();
  const pending = sales.filter(sale => sale.voidRequest?.status === 'Pending');
  const unusual = duplicateGroups(sales, threshold, minutes);
  const alerts = [
    ...pending.map(sale => ({ id: `void-${sale.id}-${sale.voidRequest!.requestedAt}`, kind: 'Void requests', title: 'Pending void review', reason: sale.voidRequest!.reason, actor: sale.voidRequest!.requestedBy, role: sale.voidRequest!.requestedRole ?? 'Role not recorded', time: sale.voidRequest!.requestedAt, orders: [sale.id], context: { selected: sale.id, requestsOnly: true, orderIds: [sale.id], investigation: `Pending void review · ${sale.voidRequest!.requestedBy} · ${sale.voidRequest!.reason}` } })),
    ...unusual.map(group => ({ id: `unusual-${JSON.stringify(group.map(sale => sale.id))}`, kind: 'Duplicate activity', title: 'Potential duplicate activity', reason: `${group.length} identical orders; at least ${threshold} within ${minutes} minutes. Human review required.`, actor: group[0].cashier, role: group[0].cashierRole ?? 'Role not recorded', time: group.at(-1)!.time, orders: group.map(sale => sale.id), context: { selected: group[0].id, orderIds: group.map(sale => sale.id), investigation: `Potential duplicate activity · ${group[0].cashier} · ${group.length} identical orders; at least ${threshold} within ${minutes} minutes. ${manilaTime(group[0].time)} – ${manilaTime(group.at(-1)!.time)}. Review before taking action.` } })),
  ].sort((a, b) => Number(read.includes(a.id)) - Number(read.includes(b.id)) || Number(a.kind !== 'Void requests') - Number(b.kind !== 'Void requests') || Date.parse(b.time) - Date.parse(a.time));
  const visible = alerts.filter(alert => filter === 'All reviews' || alert.kind === filter);
  return <section className="alert-center" aria-label="Notifications and review">
    <div className="page-heading"><div><h2>Needs your review <span className="alert-count">{alerts.length + dates.length}</span></h2><p role="status">{alerts.filter(alert => !read.includes(alert.id)).length} unread · sample alerts</p></div><div className="heading-actions">
      {role === 'Owner' && <button className="secondary" onClick={() => setSettings(!settings)} aria-expanded={settings} aria-controls="alert-settings">Alert settings</button>}
      <button className="secondary" onClick={() => onOpen({ allReviews: true })}>View all requests</button>
    </div></div>
    <div className="daily-review-cards">{(dates.length ? dates : [businessDate()]).map(date => {
      const orders = daily.filter(sale => businessDate(sale.time) === date);
      return <article key={date} className={`daily-review-card ${orders.length ? 'attention-required' : 'review-clear'}`}><div><strong>Daily Sales Review</strong><p>{date} · {orders.length} awaiting Owner review · {money(orders.reduce((sum, sale) => sum + sale.total, 0))}</p><small>{orders.length ? 'Payment received / fulfilled · Owner verification outstanding' : 'No sales awaiting review'}</small></div><button className="secondary" disabled={!orders.length} onClick={() => onDailyReview(date)}>Review daily sales</button></article>;
    })}</div><div className="alert-filters" aria-label="Review categories">{['All reviews', 'Void requests', 'Duplicate activity'].map(value => <button key={value} className="secondary" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value} <span>{value === 'All reviews' ? alerts.length : alerts.filter(alert => alert.kind === value).length}</span></button>)}</div>
    {role === 'Owner' && settings && <div className="alert-settings" id="alert-settings"><label>Similar order threshold<input type="number" min="2" max="100" step="1" value={threshold} onChange={event => setThreshold(Math.max(2, Math.min(100, Math.round(Number(event.target.value) || 2))))} /></label><label>Window (minutes)<input type="number" min="1" max="60" step="1" value={minutes} onChange={event => setMinutes(Math.max(1, Math.min(60, Math.round(Number(event.target.value) || 1))))} /></label><p>Preview detection only. Repeated orders can be legitimate; review the evidence. Settings and read markers last until logout. New orders or a new request make the affected alert unread again.</p></div>}
    {visible.length ? <div className="alert-list">{visible.map(alert => <article key={alert.id} className={read.includes(alert.id) ? 'read' : ''} aria-label={`${alert.title}, ${alert.actor}`}><div>
      <span className="alert-kind">{alert.kind === 'Void requests' ? 'Approval needed' : 'Investigation needed'}</span><strong>{alert.title}</strong><p>{alert.actor} · {alert.role} · {manilaTime(alert.time)}</p><p>{alert.reason}</p>
      <details className="alert-evidence"><summary>{alert.orders.length} affected {alert.orders.length === 1 ? 'order' : 'orders'}</summary><p>Orders: {alert.orders.join(', ')}</p></details>
      <small>{read.includes(alert.id) ? 'Read / unresolved' : 'Unread / unresolved'}</small></div><div className="row-actions">
      <button className="primary" onClick={() => onOpen(alert.context)}>Review orders</button><button className="secondary" onClick={() => setRead(current => current.includes(alert.id) ? current.filter(id => id !== alert.id) : [...current, alert.id])}>{read.includes(alert.id) ? 'Mark unread' : 'Mark read'}</button>
    </div></article>)}</div> : <p className="empty-state">{alerts.length ? `No ${filter.toLowerCase()} need review. Choose All reviews to see the other alerts.` : 'No pending void requests or unusual activity detected.'}</p>}
  </section>;
}
