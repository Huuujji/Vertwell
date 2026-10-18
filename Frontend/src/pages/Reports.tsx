import ReportTransactions from '../components/ReportTransactions';
import ReportControls from '../components/ReportControls';
import type { ReportFilters } from '../data/durable-reporting';
import ExportReportReview from '../components/ExportReportReview';
import StockBalanceSection from '../components/StockBalanceSection';
import ReportSummary from '../components/ReportSummary';
import StockBalanceCard from '../components/StockBalanceCard';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useViewState } from '../lib/view-state';
import ReportTable from '../components/ReportTable';
import Pagination, { usePagination } from '../components/Pagination';
import type { InventoryContext } from './Inventory';
import { businessDate, manilaTime, money } from '../data/demo';
import type { Consumption, Sale, StockItem } from '../data/demo';
import { createPdf, downloadCsv, saveBlob } from '../lib/report-export';
import type { ReportDocument } from '../lib/report-export';
import { categoryAmount, matchesSalesCategory, stockCondition } from '../data/reporting';
import type { SalesCategory } from '../data/reporting';
import { usableQuantity, stockKind } from '../data/inventory';
import { periodBalance } from '../data/stock-movements';
import type { StockMovement } from '../data/stock-movements';
import { bundleDescription } from '../data/catalogue';

export interface ReportContext { start: string; end: string; category?: SalesCategory; startTime?: string; endTime?: string; token: number }
const percentage = (value: number) => `${Math.round(value * 10) / 10}%`;
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export default function Reports({ sales, stock, movements, context, onInventory }: { sales: Sale[]; stock: StockItem[]; movements: StockMovement[]; context?: ReportContext; onInventory: (context: Omit<InventoryContext, 'token'>) => void }) {
  const today = businessDate();
  const [format, setFormat] = useViewState<'PDF' | 'CSV'>('Reports.format', 'PDF');
  const [scope, setScope] = useViewState('Reports.scope', 'Combined');
  const [start, setStart] = useViewState('Reports.start', '2026-08-15'), [end, setEnd] = useViewState('Reports.end', '2026-08-21');
  const [startTime, setStartTime] = useViewState('Reports.startTime', '00:00'), [endTime, setEndTime] = useViewState('Reports.endTime', '23:59');
  const [category, setCategory] = useViewState<SalesCategory>('Reports.category', 'All categories');
  const [appliedToken, setAppliedToken] = useViewState('Reports.tsx.token', 0);
  const [exporting, setExporting] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pdfCache = useRef<{ key: string; promise: Promise<Blob> } | undefined>(undefined);
  useEffect(() => { if (context && context.token !== appliedToken) {
    setAppliedToken(context.token); setStart(context.start); setEnd(context.end); setCategory(context.category ?? 'All categories');
    setStartTime(context.startTime ?? '00:00'); setEndTime(context.endTime ?? '23:59'); setScope('Sales');
  } }, [context]);
  const invalid = !validDate(start) || !validDate(end) || start > end || start > today || end > today || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || `${start}T${startTime}` > `${end}T${endTime}`;
  const from = Date.parse(`${start}T${startTime}:00+08:00`), to = Date.parse(`${end}T${endTime}:59.999+08:00`);
  const filtered = invalid ? [] : sales.filter(sale => Date.parse(sale.time) >= from && Date.parse(sale.time) <= to);
  const categoryFiltered = filtered.filter(sale => sale.lines.some(line => matchesSalesCategory(line.category, category)));
  const amount = (sale: Sale) => categoryAmount(sale, category);
  const completed = categoryFiltered.filter(sale => sale.status === 'Completed'), revenue = completed.reduce((sum, sale) => sum + amount(sale), 0);
  const days = invalid ? 1 : Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1);
  const cash = completed.filter(sale => sale.method === 'Cash').reduce((sum, sale) => sum + amount(sale), 0), gcash = revenue - cash;
  const pendingPaid = categoryFiltered.filter(sale => sale.status === 'Pending' && sale.paymentState === 'Received').reduce((sum, sale) => sum + amount(sale), 0);
  const usageMap = new Map<string, Consumption>();
  filtered.filter(sale => sale.stockCommitted).forEach(sale => sale.usage?.forEach(input => { const key = `${input.stockId}-${input.unit}`; const current = usageMap.get(key) ?? { ...input, quantity: 0 }; current.quantity += input.quantity; usageMap.set(key, current); }));
  const usage = [...usageMap.values()].map(input => ({ ...input, quantity: Math.round(input.quantity * 1e6) / 1e6 }));
  const uncovered = filtered.filter(sale => !sale.usage || sale.usageComplete === false).length;
  const missingLinks = filtered.filter(sale => !sale.stockCommitted || sale.lines.some(line => !line.usage)).length;
  const criteria = JSON.stringify([start, end, startTime, endTime, scope, category]), period = `${start} ${startTime} to ${end} ${endTime}`;
  const attention = stock.filter(item => stockCondition(item) !== 'In Stock'), ingredients = stock.filter(item => stockKind(item) === 'Ingredient');
  const attentionPage = usePagination(attention, criteria, 4), ingredientPage = usePagination(ingredients, criteria, 4);
  // Movement dates have no time-of-day precision. Period balances use full days.
  const balances = ingredients.map(item => ({ item, balance: invalid ? undefined : periodBalance(item, sales, movements, start, end) }));
  const known = balances.filter(value => value.balance).length;
  const partial = balances.filter(value => value.balance?.partial).length;
  const configurations = { title: 'Purchased variants and bundles', headings: ['Order / item / status', 'Configuration / SKU', 'Quantity', 'Unit price'], rows: categoryFiltered.flatMap(sale => sale.lines.filter(line => matchesSalesCategory(line.category, category) && (line.variant || line.bundle?.length)).map(line => [`${sale.id}\n${line.name}\n${sale.status}`, line.variant ? `${line.variant.name} · ${line.variant.sku}` : bundleDescription(line.bundle), String(line.quantity), money(line.price)])) };
  const ingredientTransactions = { title: 'Ingredient usage by transaction', headings: ['Order / date / status', 'Product / category', 'Ingredient / SKU', 'Consumed', 'Unit'], rows: filtered.filter(sale => sale.stockCommitted).flatMap(sale => sale.lines.flatMap(line => (line.usage ?? []).filter(input => input.kind === 'Ingredient').map(input => [`${sale.id}\n${manilaTime(sale.time)}\n${sale.status}${sale.reviewState ? ` · ${sale.reviewState}` : ''}`, `${line.name}\n${line.category}${line.modifiers?.length ? ` · ${line.modifiers.map(option => option.name).join(', ')}` : ''}`, `${input.name}\n${input.sku ?? input.stockId}`, String(input.quantity), input.unit]))) };
  const stockUsed = { title: 'Stocks used in the selected period', headings: ['Stock item / SKU', 'Quantity', 'Unit'], rows: usage.map(input => [`${input.name}\n${input.sku ?? input.stockId}`, String(input.quantity), input.unit]) };
  const stockRemaining = { title: `Stocks remaining · current on hand (${today})`, headings: ['Item / SKU', 'On hand / usable', 'Unit', 'Reorder level / status'], rows: stock.map(item => [`${item.name}\n${item.sku ?? item.id}`, `${item.quantity} on hand\n${usableQuantity(item)} usable`, item.unit, `${item.threshold ?? '5 (preview default)'} / ${stockCondition(item)}`]) };
  const stockAttention = { title: `Needs attention · current stock (${today})`, headings: ['Item / SKU', 'Status / usable', 'Reorder threshold', 'Receipt batch expiry dates'], rows: attention.map(item => [`${item.name} / ${item.sku ?? item.id}`, `${stockCondition(item)} / ${usableQuantity(item)} ${item.unit}`, `${item.threshold ?? 5} ${item.unit}`, item.batches?.filter(batch => batch.quantity > 0).map(batch => `${batch.id}: ${batch.expires || 'No expiry recorded'}`).join('\n') || item.expires || 'No expiry recorded']) };
  const baselines = { title: 'Ingredient period balances', headings: ['Ingredient / SKU', 'Opening / received', 'Used / removed', 'Closing balance', 'Used / remaining'], rows: balances.map(({ item, balance }) => [`${item.name}\n${item.sku ?? item.id} · ${item.unit}`, balance ? `${balance.opening} opening\n${balance.added} received${balance.partial ? `\nPartial history: ${balance.coverageStart} to ${end}; earlier stock unknown` : ""}` : 'Baseline unavailable', balance ? `${balance.used} used\n${balance.removed} removed` : 'Incomplete movements', balance ? `${balance.remaining} ${item.unit}` : 'Unknown', balance ? `${percentage(balance.usedPercent)} used\n${percentage(balance.remainingPercent)} remaining` : 'Percentages unavailable']) };
  const balanceNote = `Period balances use full business days (${start} to ${end}). Opening + receipts = available; closing = available - consumed - removed. Percentages use available stock. For partial history, the opening and percentages cover only the dates shown on that item. Expiry does not reduce physical closing stock; current usable stock is shown separately.`;
  const baselineNote = 'Sample opening balances are dated August 1, 2026 and reconcile with seeded consumption. Session receipts, quantity edits and removals are recorded in memory. When the range starts before an item’s opening date, show the verified dates as partial history; earlier stock is unknown. A range entirely before records, incomplete movements or an unreconciled balance shows Baseline unavailable. Refresh resets this ledger.';
  const report = useMemo<ReportDocument>(() => ({ title: `Happy Hentie · ${scope} report`, range: `${period}${scope === 'Inventory usage' ? '' : ` · ${category}`}`, generated: `Generated ${manilaTime(new Date().toISOString())}`, notes: [
    'Frontend preview · sample data · resets on refresh.',
    ...(scope !== 'Inventory usage' ? [`Sales category: ${category}. Mixed-order amounts are the selected category share of the recorded total; orders can appear in both categories.`, 'Completed amounts include sample 12% VAT and exclude Pending/Voided. Paid Pending orders await Owner review.', `Paid sales awaiting Owner review: ${money(pendingPaid)}.`] : []),
    ...(scope !== 'Sales' ? ['Inventory covers all categories, independent of the sales category filter. On hand includes expired/unsellable stock; usable excludes it.', 'Consumption includes fulfilled Pending and voided sales; Owner review never consumes stock again.', `Current stock is as of ${today}; period closing balances are separate.`, balanceNote, baselineNote, `${missingLinks} orders have unavailable transaction/product ingredient snapshots. No current recipe is applied retrospectively.`, ...(uncovered ? [`${uncovered} orders have missing/incomplete stock snapshots; full usage is unknown.`] : [])] : []),
  ], sections: [
    ...(scope !== 'Inventory usage' ? [{ title: 'Sales summary', headings: ['Metric', 'Value'], rows: [['Completed total (incl. VAT)', money(revenue)], ['Completed orders', String(completed.length)], ['Average completed order', money(completed.length ? revenue / completed.length : 0)], ['Pending orders', String(categoryFiltered.filter(sale => sale.status === 'Pending').length)], ['Voided orders', String(categoryFiltered.filter(sale => sale.status === 'Voided').length)], ['Cash', money(cash)], ['GCash', money(gcash)]] }, { title: 'Transactions', headings: ['Order / date', 'Cashier / role', 'Payment / status', category === 'All categories' ? 'Amount' : 'Category amount', 'Void details'], rows: categoryFiltered.map(sale => [`${sale.id}\n${manilaTime(sale.time)}`, `${sale.cashier}\n${sale.cashierRole ?? 'Unrecorded'}`, `${sale.method}${sale.paymentState ? ' · Received / fulfilled' : ''}\n${sale.status}${sale.reviewState ? ` · ${sale.reviewState}` : ''}`, money(amount(sale)), [sale.reason, sale.voidedBy, sale.voidedRole].filter(Boolean).join(' · ')]) }, ...(configurations.rows.length ? [configurations] : [])] : []),
    ...(scope !== 'Sales' ? [baselines, ingredientTransactions, stockUsed, stockRemaining, stockAttention] : []),
  ] }), [sales, stock, movements, criteria, today]);
  const suffix = scope !== 'Inventory usage' && category !== 'All categories' ? `-${category.toLowerCase().replaceAll(' ', '-')}` : '';
  const filename = `happy-hentie-${scope.toLowerCase().replaceAll(' ', '-')}-${start}-to-${end}${suffix}`;
  async function pdf() {
    const key = JSON.stringify(report);
    if (pdfCache.current?.key !== key) pdfCache.current = { key, promise: createPdf(report) };
    try { return await pdfCache.current.promise; } catch (cause) { pdfCache.current = undefined; throw cause; }
  }
  async function download() {
    if (busy || invalid) return; setBusy(true); setError('');
    try { if (format === 'PDF') saveBlob(await pdf(), `${filename}.pdf`); else downloadCsv(report, `${filename}.csv`); setExporting(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Report export failed. Please try again.'); }
    finally { setBusy(false); }
  }
  async function printPreview() {
    if (busy || invalid) return; setBusy(true); setError('');
    const viewer = window.open('about:blank', '_blank');
    if (!viewer) { setError('Allow a new browser tab to open the report for printing.'); setBusy(false); return; }
    viewer.opener = null; viewer.document.title = 'Preparing report'; viewer.document.body.textContent = 'Preparing report…';
    // Keep this blob alive for the viewer tab, including after leaving Reports.
    // The browser releases document-owned URLs when the preview page unloads.
    try { const url = URL.createObjectURL(await pdf()); viewer.location.replace(url); }
    catch (cause) { viewer.close(); setError(cause instanceof Error ? cause.message : 'The report could not be prepared.'); }
    finally { setBusy(false); }
  }

  return <section className="reports">
    <div className="page-heading"><div><h1>Reports</h1><p className="subtitle">Review sales, consumption and stock balances.</p></div><div className="heading-actions"><button className="secondary" disabled={invalid || busy} onClick={printPreview}>{busy ? 'Preparing…' : 'Print'}</button><button className="accent" onClick={() => { setError(''); setExporting(true); }} disabled={invalid || busy}>Export report</button></div></div>
    <ReportControls filters={{start,end,startTime,endTime,scope:scope as ReportFilters['scope'],category}} today={today} format={format} busy={busy} onFormat={setFormat}
      onChange={(key,value)=>{({start:setStart,end:setEnd,startTime:setStartTime,endTime:setEndTime,scope:setScope,category:setCategory}[key] as (value:string)=>void)(value);}}/>
    <p className="report-filter-summary" role="status">{scope} · {period}{scope !== 'Inventory usage' ? ` · ${category} · ${categoryFiltered.length} matching orders` : ' · All inventory categories'}</p>
    {invalid && <p className="error" role="alert">Choose a valid past or current date/time range; the end must be on or after the start.</p>}{error && !exporting && <p className="error" role="alert">{error}</p>}
    {scope !== 'Inventory usage' && <><ReportSummary total={money(revenue)} completed={completed.length} pending={categoryFiltered.filter(sale=>sale.status==='Pending').length} voided={categoryFiltered.filter(sale=>sale.status==='Voided').length} dailyAverage={money(revenue/days)} orderAverage={money(completed.length?revenue/completed.length:0)} cash={money(cash)} gcash={money(gcash)} pendingPaid={money(pendingPaid)} category={category} taxLabel="includes sample VAT"/>{category !== 'All categories' && <p className="report-note">Mixed orders show this category’s share of the recorded total, including sample VAT. Category amounts add up to the original total.</p>}<ReportTransactions category={category} criteria={criteria} rows={categoryFiltered.map(sale => [`${sale.id}\n${manilaTime(sale.time)}`, sale.cashier, `${sale.method}${sale.paymentState ? ' · Received' : ''}${sale.reviewState ? ` · ${sale.reviewState}` : ''}`, sale.status, money(amount(sale))])} /></>}
    {scope !== 'Inventory usage' && configurations.rows.length > 0 && <ReportTable {...configurations} numericColumns={[2, 3]} criteria={criteria} />}
    {scope !== 'Sales' && <div className="stock-report-sections">
      <StockBalanceSection preview start={start} end={end} known={known} total={ingredients.length} partial={partial} note={balanceNote}>{balances.map(({item,balance},index)=><StockBalanceCard key={item.id} className={index<(ingredientPage.page-1)*ingredientPage.pageSize||index>=ingredientPage.page*ingredientPage.pageSize?'paged-out':''}
        name={item.name} sku={item.sku??item.id} remaining={balance?.remainingPercent??0} used={balance?.usedPercent??0} removed={balance?.baseline?balance.removed/balance.baseline*100:0} zero={balance?.baseline===0}
        partial={balance?.partial?`Partial history · ${balance.coverageStart} to ${end}. Earlier stock is unknown; percentages cover these recorded dates only.`:undefined}
        issue={!balance?'Used % / remaining % unavailable. These dates have no opening record, or the stock records are incomplete or do not match the current count.':undefined}
        values={balance?[['Opening',`${balance.opening} ${item.unit}`],['Received',`${balance.added} ${item.unit}`],[`Used · ${percentage(balance.usedPercent)}`,`${balance.used} ${item.unit}`],[`Removed · ${percentage(balance.baseline?balance.removed/balance.baseline*100:0)}`,`${balance.removed} ${item.unit}`],['Period closing',`${balance.remaining} ${item.unit}`]]:[]}
        current={`Current remaining: ${item.quantity} ${item.unit} · ${usableQuantity(item)} usable as of ${today}`}/>)} <Pagination label="Ingredient balances" {...ingredientPage} /></StockBalanceSection>
      <ReportTable {...ingredientTransactions} description="Recorded ingredient snapshots at checkout. Includes fulfilled Pending and Voided sales." numericColumns={[3]} criteria={criteria} empty="No transaction-linked ingredient consumption recorded in this range." />{missingLinks > 0 && <p className="report-note">{missingLinks} orders have unavailable transaction/product ingredient links. No current recipe is applied to past sales.</p>}
      <ReportTable {...stockUsed} numericColumns={[1]} criteria={criteria} />{uncovered > 0 && <p className="report-note">{uncovered} sample orders have missing/incomplete stock snapshots; full usage is unknown.</p>}
      <ReportTable {...stockRemaining} description="Current physical and usable quantities, separate from period closing balances." numericColumns={[1]} criteria={criteria} />
      <section className="stock-attention" aria-label="Current stock needs attention"><h2>Needs attention</h2><p>Current usable stock / reorder thresholds · expiration within 7 days or expired batches · {today}</p>{attention.map((item, index) => <button key={item.id} className={`attention-link ${index < (attentionPage.page - 1) * attentionPage.pageSize || index >= attentionPage.page * attentionPage.pageSize ? 'paged-out' : ''}`} onClick={() => onInventory({ id: item.id, batchId: item.batches?.find(batch => batch.quantity > 0 && batch.expires && batch.expires <= new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10))?.id })}><span>{item.name} · {item.sku ?? item.id}<small>{stockCondition(item)} · {usableQuantity(item)} {item.unit} usable · Reorder: {item.threshold ?? 5} {item.unit}</small><small>Expiry: {item.batches?.filter(batch => batch.quantity > 0).map(batch => batch.expires || 'Unrecorded').join(', ') || item.expires || 'Unrecorded'}</small></span><span>Open inventory →</span></button>)}{!attention.length && <p className="empty-state">No stock needs attention.</p>}<Pagination label="Stock attention" {...attentionPage} /></section>
    </div>}
    {exporting && <ExportReportReview scope={scope} format={format} period={period} source="sample data only" category={category} busy={busy} ready={!invalid} error={error} onClose={()=>setExporting(false)} onDownload={()=>void download()}
      sales={scope!=='Inventory usage'?{orders:categoryFiltered.length,completed:completed.length,configurations:configurations.rows.length,revenue:money(revenue),pendingPaid:money(pendingPaid),cash:money(cash),gcash:money(gcash)}:undefined}
      inventory={scope!=='Sales'?<><p>{ingredientTransactions.rows.length} transaction-linked ingredient rows · {usage.length} stock-use rows · {stock.length} current stock records · {attention.length} need attention · {missingLinks} orders missing ingredient links</p><p>{known} of {ingredients.length} ingredient period balances available. Current stock is separate from period closing stock.</p></>:undefined}
      balanceNote={scope!=='Sales'?balanceNote:undefined}/>}

  </section>;
}
