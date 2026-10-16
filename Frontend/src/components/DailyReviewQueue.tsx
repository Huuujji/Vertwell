import { businessDate, money } from '../data/demo';
import type { Sale } from '../data/demo';
import { awaitingReview } from './DailySalesReview';

export default function DailyReviewQueue({ sales, date, onReview }: { sales: Sale[]; date?: string; onReview: (date: string) => void }) {
  const pending = sales.filter(sale => awaitingReview(sale) && (!date || businessDate(sale.time) === date));
  const dates = [...new Set(pending.map(sale => businessDate(sale.time)))].sort().reverse();
  return <section className="audit-daily-reviews" aria-label="Daily Sales Review queue"><h2>Daily Sales Review</h2><p className="subtitle">Verify received payments and complete sales awaiting Owner review.</p>{dates.length ? dates.map(day => {
    const orders = pending.filter(sale => businessDate(sale.time) === day);
    return <article className="daily-review-card attention-required" key={day}><div><strong>{day}</strong><p>{orders.length} awaiting Owner review · {money(orders.reduce((sum, sale) => sum + sale.total, 0))}</p></div><button className="secondary" onClick={() => onReview(day)}>Review daily sales</button></article>;
  }) : <p className="empty-state">No sales awaiting Owner review{date ? ` for ${date}` : ''}.</p>}</section>;
}
