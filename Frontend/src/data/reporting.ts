import type { Category, Sale, StockItem } from './demo';
import { businessDate } from './demo';
import { usableQuantity } from './inventory';

export type SalesCategory = 'All categories' | 'Food and Beverage' | 'Hobby';
export const matchesSalesCategory = (category: Category, filter: SalesCategory) => filter === 'All categories' || (filter === 'Hobby' ? category === 'Hobby' : category !== 'Hobby');

// Allocate the recorded total, including its existing tax/discount treatment.
// The two category amounts must add back to the original order, even at cent boundaries.
export function categoryAmount(sale: Sale, category: SalesCategory) {
  if (category === 'All categories') return sale.total;
  const subtotal = sale.lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const hobbySubtotal = sale.lines.filter(line => line.category === 'Hobby').reduce((sum, line) => sum + line.price * line.quantity, 0);
  const hobby = subtotal ? Math.round(sale.total * hobbySubtotal / subtotal * 100) / 100 : 0;
  return category === 'Hobby' ? hobby : Math.round((sale.total - hobby) * 100) / 100;
}

export function stockCondition(item: StockItem) {
  const usable = usableQuantity(item);
  if (item.quantity <= 0) return 'Out of Stock';
  if (item.status === 'Unsellable') return 'Unsellable';
  if (usable <= 0) return item.batches?.some(batch => batch.status === 'Unsellable' && batch.quantity > 0) ? 'Unsellable' : 'Expired / unusable';
  const today = businessDate();
  const soon = new Date(new Date(`${today}T00:00:00Z`).getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const expiring = item.batches ? item.batches.some(batch => batch.status !== 'Unsellable' && batch.quantity > 0 && batch.expires && batch.expires >= today && batch.expires <= soon) : Boolean(item.expires && item.expires >= today && item.expires <= soon);

  return expiring ? 'Expiring Soon' : usable <= (item.threshold ?? 5) ? 'Low Stock' : usable < item.quantity ? item.batches?.some(batch => batch.status === 'Unsellable' && batch.quantity > 0) ? 'Contains unsellable stock' : 'Contains expired stock' : 'In Stock';
}
