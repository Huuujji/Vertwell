import { useState } from 'react';
import { Actions, Modal } from './ui';
import useDiscardChanges from './useDiscardChanges';
import { businessDate, money } from '../data/demo';
import type { DailyReview, Role, Sale } from '../data/demo';

export const awaitingReview = (sale: Sale) => sale.status === 'Pending' && sale.reviewState === 'Awaiting Owner review';
export default function DailySalesReview({ date, sales, role, owner, onClose, onConfirm }: { date: string; sales: Sale[]; role: Role; owner: string; onClose: () => void; onConfirm: (review: DailyReview) => boolean }) {
  const orders = sales.filter(sale => awaitingReview(sale) && businessDate(sale.time) === date);
  const [counted, setCounted] = useState('');
  const [digital, setDigital] = useState('');
  const [opening, setOpening] = useState('0'), [added, setAdded] = useState('0'), [removed, setRemoved] = useState('0'), [refunds, setRefunds] = useState('0');
  const [verified, setVerified] = useState<string[]>([]), [explanation, setExplanation] = useState(''), [error, setError] = useState('');
  const round = (value: number) => Math.round(value * 100) / 100;
  const expectedCash = round(orders.filter(sale => sale.method === 'Cash').reduce((sum, sale) => sum + sale.total, 0));
  const expectedGCash = round(orders.filter(sale => sale.method === 'GCash').reduce((sum, sale) => sum + sale.total, 0));
  const actualCash = round(Number(counted) - Number(opening) - Number(added) + Number(removed) + Number(refunds));
  const actualGCash = round(Number(digital));
  const discrepancy = actualCash !== expectedCash || actualGCash !== expectedGCash;
  const { requestClose, confirmation } = useDiscardChanges(Boolean(counted || digital || explanation || verified.length || [opening, added, removed, refunds].some(value => value !== '0')), onClose, 'daily sales review');
  return <><Modal title="Daily Sales Review" className="daily-review-modal" onClose={requestClose}><p>{date} · Business date · {orders.length} orders awaiting Owner review</p><p>Payments were received and orders fulfilled. Stock was consumed at checkout; confirming this review does not consume it again.</p><div className="review-order-list">{orders.map(sale => <label key={sale.id}><input type="checkbox" checked={verified.includes(sale.id)} onChange={event => setVerified(event.target.checked ? [...verified, sale.id] : verified.filter(id => id !== sale.id))} /><span>{sale.id} · {sale.cashier} ({sale.cashierRole}) · {sale.method} · {money(sale.total)}{sale.method === 'GCash' && <small className="item-code">Reference: {sale.reference ?? 'Not recorded'}</small>}<small className="item-code">Verify this receipt{sale.method === 'GCash' ? ' and digital reference' : ''}</small></span></label>)}</div>
    {role !== 'Owner' ? <p className="report-note">Only the Owner can count/verify receipts and confirm reviewed sales.</p> : <form onSubmit={event => {
      event.preventDefault();
      if (!orders.length || orders.some(sale => !verified.includes(sale.id))) { setError('Verify every included receipt before confirming.'); return; }
      if ([counted, digital, opening, added, removed, refunds].some(value => !value.trim() || !Number.isFinite(Number(value)) || Number(value) < 0) || actualCash < 0) { setError('Enter valid nonnegative amounts; cash adjustments cannot exceed counted cash receipts.'); return; }
      if (discrepancy && !explanation.trim()) { setError('Explain the discrepancy and your decision to accept it before completing these orders.'); return; }
      const saved = onConfirm({ id: crypto.randomUUID(), date, owner, role: 'Owner', time: new Date().toISOString(), orderIds: orders.map(sale => sale.id), expectedCash, expectedGCash, actualCash, actualGCash, countedCash: Number(counted), openingCash: Number(opening), additions: Number(added), removals: Number(removed), refunds: Number(refunds), explanation: explanation.trim(), outcome: discrepancy ? 'Reviewed with explained discrepancy' : 'Matched' });
      if (saved) onClose(); else setError('These orders changed. Reopen the daily review and verify the remaining receipts.');
    }}><div className="review-amounts"><label>Counted cash for included receipts<input type="number" min="0" step="0.01" required value={counted} onChange={event => setCounted(event.target.value)} /></label><label>Verified GCash receipts amount<input type="number" min="0" step="0.01" required value={digital} onChange={event => setDigital(event.target.value)} /></label></div><details><summary>Opening change, cash movements and refunds</summary><p>Enter only movements included in the cash count. These are manual review adjustments; the preview has no durable cash-movement ledger.</p><div className="review-amounts">{[['Opening change', opening, setOpening], ['Cash additions', added, setAdded], ['Cash removals', removed, setRemoved], ['Cash refunds', refunds, setRefunds]].map(([label, value, set]) => <label key={String(label)}>{String(label)}<input type="number" min="0" step="0.01" value={String(value)} onChange={event => (set as (value: string) => void)(event.target.value)} /></label>)}</div></details>
    <div className="review-comparison"><p>Expected Cash receipts: <strong>{money(expectedCash)}</strong> · Verified net receipts: <strong>{money(actualCash)}</strong> · Difference: <strong>{money(round(actualCash - expectedCash))}</strong></p><p>Expected GCash: <strong>{money(expectedGCash)}</strong> · Verified digital receipts: <strong>{money(actualGCash)}</strong> · Difference: <strong>{money(round(actualGCash - expectedGCash))}</strong></p><p>Cash receipts = counted − opening change − additions + removals + cash refunds. GCash is verified separately against digital receipts.</p></div>
    {counted !== '' && digital !== '' && discrepancy && <p className="report-note" role="status">Discrepancy requires an explained decision. The recorded expected totals stay unchanged.</p>}<label>Review notes / discrepancy decision<textarea value={explanation} onChange={event => setExplanation(event.target.value)} required={discrepancy} maxLength={1000} /></label>{error && <p className="error" role="alert">{error}</p>}<Actions><button type="button" className="secondary" onClick={requestClose}>Cancel</button><button className="primary" disabled={!orders.length || orders.some(sale => !verified.includes(sale.id))}>Confirm reviewed sales</button></Actions></form>}
  </Modal>{confirmation}</>;
}
