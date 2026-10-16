import type { Sale, StockItem } from './demo';
import { businessDate } from './business-date';
import { convert } from './inventory';

export interface StockMovement { id: string; stockId: string; date: string; quantity: number; unit: string; kind: 'Opening' | 'Receipt' | 'Removal' }
export const openingMovements = (stock: StockItem[]): StockMovement[] => stock.map(item => ({ id: `opening-${item.id}`, stockId: item.id, date: '2026-08-01', quantity: item.quantity, unit: item.unit, kind: 'Opening' }));
const round = (value: number) => Math.round(value * 1e6) / 1e6;
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

// Reconstruct the mock period from its opening records, recorded movements and
// committed consumption. Never use current stock as a fabricated 100% baseline.
export function periodBalance(item: StockItem, sales: Sale[], movements: StockMovement[], start: string, end: string) {
  const own = movements.filter(value => value.stockId === item.id);
  const opening = own.find(value => value.kind === 'Opening');
  // Reject broken timestamps before the business-date formatter can throw.
  if (sales.some(sale => sale.stockCommitted && !Number.isFinite(Date.parse(sale.time)))) return undefined;
  const consumed = sales.filter(sale => sale.stockCommitted).flatMap(sale => (sale.usage ?? []).filter(input => input.stockId === item.id).map(input => ({ date: businessDate(sale.time), quantity: convert(input.quantity, input.unit, item.unit) })));
  if (!validDate(start) || !validDate(end) || own.some(value => !validDate(value.date) || value.date > businessDate() || !['Opening', 'Receipt', 'Removal'].includes(value.kind) || (value.kind === 'Removal' ? value.quantity > 0 : value.quantity < 0)) || consumed.some(value => !validDate(value.date) || value.date > businessDate()) || !Number.isFinite(item.quantity) || item.quantity < 0) return undefined;
  if (!opening || own.filter(value => value.kind === 'Opening').length !== 1 || start > end || end > businessDate() || end < opening.date || opening.quantity < 0 || own.some(value => !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !Number.isFinite(convert(value.quantity, value.unit, item.unit)) || value.date < opening.date) || consumed.some(value => !Number.isFinite(value.quantity) || value.quantity < 0 || value.date < opening.date) || sales.some(sale => sale.stockCommitted && (!sale.usage || sale.usageComplete === false))) return undefined;
  // A wider filter may predate the ledger. Report only its verified overlap and
  // return that coverage explicitly; never invent an earlier opening balance.
  const coverageStart = start < opening.date ? opening.date : start;
  // If a quantity edit or missing event broke the session ledger, do not claim
  // that any historical percentage is verified merely because it is positive.
  const current = own.filter(value => value.date <= businessDate()).reduce((sum, value) => sum + convert(value.quantity, value.unit, item.unit), 0) - consumed.filter(value => value.date <= businessDate()).reduce((sum, value) => sum + value.quantity, 0);
  if (Math.abs(current - item.quantity) > 0.000001) return undefined;
  const before = own.filter(value => value.date < coverageStart || value.kind === 'Opening' && value.date === coverageStart).reduce((sum, value) => sum + convert(value.quantity, value.unit, item.unit), 0) - consumed.filter(value => value.date < coverageStart).reduce((sum, value) => sum + value.quantity, 0);
  const during = own.filter(value => value.kind !== 'Opening' && value.date >= coverageStart && value.date <= end);
  const added = during.filter(value => value.quantity >= 0).reduce((sum, value) => sum + convert(value.quantity, value.unit, item.unit), 0);
  const removed = -during.filter(value => value.quantity < 0).reduce((sum, value) => sum + convert(value.quantity, value.unit, item.unit), 0);
  const used = consumed.filter(value => value.date >= coverageStart && value.date <= end).reduce((sum, value) => sum + value.quantity, 0);
  const baseline = round(before + added), remaining = round(baseline - used - removed);
  if (before < -0.000001 || baseline < 0 || remaining < -0.000001) return undefined;
  return { coverageStart, partial: coverageStart !== start, opening: round(before), added: round(added), removed: round(removed), baseline, used: round(used), remaining: Math.max(0, remaining), usedPercent: baseline ? used / baseline * 100 : 0, remainingPercent: baseline ? Math.max(0, remaining) / baseline * 100 : 0 };
}
