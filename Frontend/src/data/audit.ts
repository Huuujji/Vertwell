import type { Sale } from './demo';

// JSONB object key order is not receipt identity. Preserve nested purchased
// configuration while comparing it consistently across independently read rows.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]));
  return value;
}

// Basket order does not change the evidence for potentially repeated submissions.
function signature(sale: Sale) {
  const lines = sale.lines.map(line => JSON.stringify([
    line.name, line.category, line.quantity, line.price,
    line.variant, line.bundle, canonical(line.purchasedConfiguration),
    (line.modifiers ?? []).map(option => [option.id, option.name, option.price]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  ])).sort();
  return JSON.stringify([sale.cashierId || sale.cashier, sale.method, sale.total, lines]);
}

export function duplicateGroups(sales: Sale[], threshold: number, minutes: number): Sale[][] {
  if (!Number.isInteger(threshold) || threshold < 2 || !Number.isFinite(minutes) || minutes <= 0) return [];
  const baskets = new Map<string, Sale[]>();
  for (const sale of sales) {
    if (sale.status === 'Voided' || !Number.isFinite(Date.parse(sale.time))) continue;
    const key = signature(sale);
    baskets.set(key, [...(baskets.get(key) ?? []), sale]);
  }
  const result: Sale[][] = [];
  for (const basket of baskets.values()) {
    basket.sort((a, b) => Date.parse(a.time) - Date.parse(b.time) || a.id.localeCompare(b.id));
    let left = 0;
    let active: { start: number; end: number } | undefined;
    for (let right = 0; right < basket.length; right++) {
      while (Date.parse(basket[right].time) - Date.parse(basket[left].time) > minutes * 60000) left++;
      if (right - left + 1 < threshold) continue;
      // Merge overlapping qualifying windows without claiming the whole burst fits one window.
      if (active && left <= active.end) active.end = right;
      else {
        if (active) result.push(basket.slice(active.start, active.end + 1));
        active = { start: left, end: right };
      }
    }
    if (active) result.push(basket.slice(active.start, active.end + 1));
  }
  return result.sort((a, b) => Date.parse(b.at(-1)!.time) - Date.parse(a.at(-1)!.time));
}

export function stockEffect(sale: Sale) {
  if (sale.stockCommitted === true) {
    if (sale.usageComplete === false) return sale.usage?.some(input => input.quantity > 0)
      ? 'Only recorded stock consumption is retained; some items have no usage snapshot. No automatic stock return.'
      : 'No configured stock usage was recorded for this checkout. No automatic stock return.';
    return 'Recorded stock consumption is retained. No automatic stock return.';
  }
  if (sale.stockCommitted === false) return 'Stock requirements only; no stock was deducted for this Pending checkout.';
  return 'Historical stock handling was not recorded; no stock return is assumed.';
}

export function auditEvents(sale: Sale) {
  const events = [{ title: 'Order recorded', actor: sale.cashier, role: sale.cashierRole, time: sale.time, detail: `${sale.method} payment · ${stockEffect(sale)}` }];
  if (sale.dailyReview) events.push({ title: 'Daily sales reviewed', actor: sale.dailyReview.owner, role: sale.dailyReview.role, time: sale.dailyReview.time, detail: `${sale.dailyReview.outcome} · ${sale.dailyReview.orderIds.length} included orders · ${sale.dailyReview.explanation || 'Receipts matched expected amounts.'}` });
  const request = sale.voidRequest;
  if (request) events.push({ title: 'Void requested', actor: request.requestedBy, role: request.requestedRole, time: request.requestedAt, detail: request.reason });
  if (request?.reviewedAt) events.push({ title: `Request ${request.status.toLowerCase()}`, actor: request.reviewedBy ?? 'Reviewer not recorded', role: request.reviewedRole, time: request.reviewedAt, detail: request.status === 'Rejected' ? 'Original sale retained.' : 'Void approved; external payment refund is not recorded.' });
  if (sale.voidedAt) events.push({ title: 'Sale voided', actor: sale.voidedBy ?? 'Actor not recorded', role: sale.voidedRole, time: sale.voidedAt, detail: `${sale.reason ?? 'Reason not recorded'}${sale.bulkActionId ? ` · Batch action: ${sale.bulkActionId}` : ''}` });
  return events.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}
