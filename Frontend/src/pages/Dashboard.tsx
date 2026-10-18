import SalesOverview from '../components/SalesOverview';
import { useState } from 'react';
import DailySalesReview from '../components/DailySalesReview';
import { useViewState } from '../lib/view-state';
import type { ReactNode } from 'react';
import AlertCenter from '../components/AlertCenter';
import type { AuditContext } from './SalesHistory';
import type { InventoryContext } from './Inventory';
import { Art } from '../components/ui';
import { businessDate, money } from '../data/demo';
import type { Sale, StockItem, DailyReview, Role } from '../data/demo';
import { categoryAmount, stockCondition } from '../data/reporting';
import type { SalesCategory } from '../data/reporting';
import { usableQuantity, removalQuantity } from '../data/inventory';

export default function Dashboard({ sales, stock, role, owner, onConfirmReview, onAudit, onInventory, onReports, overview, persistent = false, onDailyReview, onDirtyChange }: { onDirtyChange?: (dirty:boolean)=>void; overview?: ReactNode | ((category:SalesCategory)=>ReactNode); persistent?: boolean; onDailyReview?: (day:string)=>void; sales: Sale[]; stock: StockItem[]; role: Role; owner: string; onConfirmReview: (review: DailyReview) => boolean; onAudit: (context: Omit<AuditContext, 'token'>) => void; onInventory: (context: Omit<InventoryContext, 'token'>) => void; onReports: (start: string, end: string, category: SalesCategory, startTime?: string, endTime?: string) => void }) {
  const [reviewDate, setReviewDate] = useState<string | null>(null);
  const [salesCategory, setSalesCategory] = useViewState<SalesCategory>('Dashboard.category', 'Food and Beverage');
  const hobby = salesCategory === 'Hobby';
  const matches = (category: string) => salesCategory === 'All categories' || (hobby ? category === 'Hobby' : category !== 'Hobby');
  const categoryStock = stock.filter(item => matches(item.category));
  const categorySales = sales.filter(sale => sale.lines.some(line => matches(line.category)));
  const categoryTotal = (sale: Sale) => categoryAmount(sale, salesCategory);
  const today = businessDate();
  const [chartStart, setChartStart] = useViewState('Dashboard.chartStart', new Date(new Date(`${today}T00:00:00Z`).getTime() - 8 * 86400000).toISOString().slice(0, 10));
  const [chartEnd, setChartEnd] = useViewState('Dashboard.chartEnd', today);
  const [startTime, setStartTime] = useViewState('Dashboard.startTime', '00:00');
  const [endTime, setEndTime] = useViewState('Dashboard.endTime', '23:59');
  const span = Math.round((new Date(chartEnd).getTime() - new Date(chartStart).getTime()) / 86400000) + 1;
  const validChart = Boolean(chartStart && chartEnd && startTime && endTime && span > 0 && span <= 31 && /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) && /^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) && chartEnd <= today && `${chartStart}T${startTime}` <= `${chartEnd}T${endTime}`);
  const chartSales = sales.filter(sale => sale.status === 'Completed' && Date.parse(sale.time) >= Date.parse(`${chartStart}T${startTime}:00+08:00`) && Date.parse(sale.time) <= Date.parse(`${chartEnd}T${endTime}:59+08:00`));
  const completed = categorySales.filter(sale => sale.status === 'Completed');
  const todaySales = completed.filter(sale => businessDate(sale.time) === today);
  const recent = [...categorySales].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 3);
  const attention = categoryStock.filter(item => stockCondition(item) !== 'In Stock' || removalQuantity(item) > 0).sort((a, b) => usableQuantity(a) - usableQuantity(b));
  const dates = validChart ? Array.from({ length: span }, (_, i) => new Date(new Date(`${chartStart}T00:00:00Z`).getTime() + i * 86400000).toISOString().slice(0, 10)) : [];
  const amounts = dates.map(date => chartSales.filter(sale => businessDate(sale.time) === date).reduce((sum, sale) => sum + categoryTotal(sale), 0));
  const maximum = Math.max(1, ...amounts);
  const heights = amounts.map(amount => amount / maximum * 280);
  return <section className="dashboard" data-node-id="1329:18007">
    <div className="dashboard-heading"><div><h1>Dashboard</h1><p className="subtitle">A daily view of your café and hobby shop.</p><div className="tabs dashboard-tabs" aria-label="Dashboard category"><button className={salesCategory === 'Food and Beverage' ? 'selected' : ''} onClick={() => setSalesCategory('Food and Beverage')} aria-pressed={salesCategory === 'Food and Beverage'}>Food and Beverage</button><button className={hobby ? 'selected' : ''} onClick={() => setSalesCategory('Hobby')} aria-pressed={hobby}>Hobby</button><button className={salesCategory === 'All categories' ? 'selected' : ''} onClick={() => setSalesCategory('All categories')} aria-pressed={salesCategory === 'All categories'}>Overall</button></div></div><div className="today-card"><Art file="51ace.svg" className="card-art" /><p>{salesCategory === 'All categories' ? 'Overall today' : hobby ? 'Hobby Today' : 'Food and beverage today'}</p><strong>{money(todaySales.reduce((sum, sale) => sum + categoryTotal(sale), 0))}</strong><small>{todaySales.length} transactions</small></div></div>
    <AlertCenter onDirtyChange={onDirtyChange} persistent={persistent} sales={sales} role={role} onOpen={onAudit} onDailyReview={onDailyReview ?? setReviewDate} />
    <div className="daily-metrics"><button onClick={() => onReports(today, today, salesCategory)}><span>Average completed order</span><strong>{money(todaySales.length ? todaySales.reduce((sum, sale) => sum + categoryTotal(sale), 0) / todaySales.length : 0)}</strong></button><button onClick={() => onReports(today, today, salesCategory)}><span>Cash / GCash today</span><strong>{money(todaySales.filter(sale => sale.method === "Cash").reduce((sum, sale) => sum + categoryTotal(sale), 0))} / {money(todaySales.filter(sale => sale.method === "GCash").reduce((sum, sale) => sum + categoryTotal(sale), 0))}</strong></button><button onClick={() => onAudit({ date: today, orderIds: categorySales.filter(sale => businessDate(sale.time) === today && sale.status !== 'Completed').map(sale => sale.id), linkedOnly: true })}><span>Today’s other statuses</span><strong>{categorySales.filter(sale => businessDate(sale.time) === today && sale.status === "Pending").length} Pending · {categorySales.filter(sale => businessDate(sale.time) === today && sale.status === "Voided").length} Voided</strong></button></div>
    <div className="stats"><div className="stat"><Art file="d1937.svg" className="card-art" /><p>Total stock {salesCategory === 'All categories' ? 'Overall' : hobby ? 'Hobby' : 'Food & Beverage'}</p><strong>{categoryStock.length} Items</strong></div><div className="stat low"><Art file="9bc9e.svg" className="card-art" /><p>Low or unusable stock</p><strong>{categoryStock.filter(item => /Low|Out|unusable|unsellable/i.test(stockCondition(item))).length} Items</strong></div><div className="stat voided"><Art file="43290.svg" className="card-art" /><p>Voided sales</p><strong>{categorySales.filter(sale => sale.status === 'Voided').length} Orders</strong></div></div>
    <div className="dashboard-lists"><section className="attention"><h2>Needs attention</h2><div className="list-card"><Art file="c9553.svg" className="card-art" />{attention.map(item => <button className="attention-link" key={item.id} onClick={() => onInventory({ id: item.id, batchId: item.batches?.find(batch => batch.quantity > 0 && batch.expires && batch.expires < today)?.id ?? item.batches?.find(batch => /Expiring/i.test(batch.status))?.id })}><span>{item.name}<small>{removalQuantity(item) > 0 ? `Needed to Remove Stocks · ${removalQuantity(item)} ${item.unit}` : stockCondition(item)} · {item.sku ?? item.id}</small></span><span>{usableQuantity(item)} {item.unit} usable →</span></button>)}{!attention.length && <p>No items need attention.</p>}</div></section><section className="recent"><h2>Recent sales</h2><div className="list-card"><Art file="48264.svg" className="card-art" />{recent.map(sale => <button className="attention-link" key={sale.id} onClick={() => onAudit({ selected: sale.id })}><span title={`${sale.id} · ${sale.status}`}>#{sale.id.slice(-5)} {sale.lines.find(line => matches(line.category))?.name}</span><span>{sale.status === 'Voided' ? 'Voided' : sale.status === 'Pending' ? 'Pending' : money(categoryTotal(sale))}</span></button>)}{!recent.length && <p>No sales in this category.</p>}</div></section></div>
    {(typeof overview==='function'?overview(salesCategory):overview) ?? <SalesOverview preview start={chartStart} end={chartEnd} startTime={startTime} endTime={endTime} today={today} category={salesCategory} hobby={hobby} valid={validChart}
      days={dates.map((date,i)=>({date,count:chartSales.filter(sale=>businessDate(sale.time)===date&&sale.lines.some(line=>matches(line.category))).length,amount:money(amounts[i]),height:heights[i]}))} total={money(amounts.reduce((sum,value)=>sum+value,0))}
      onChange={(key,value)=>({start:setChartStart,end:setChartEnd,startTime:setStartTime,endTime:setEndTime}[key])(value)} onReports={()=>onReports(chartStart,chartEnd,salesCategory,startTime,endTime)}/>} 
    {reviewDate && <DailySalesReview date={reviewDate} sales={sales} role={role} owner={owner} onConfirm={onConfirmReview} onClose={() => setReviewDate(null)} />}
  </section>;
}


