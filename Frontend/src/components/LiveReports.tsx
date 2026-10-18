import ReportTransactions from './ReportTransactions';
import ReportControls from './ReportControls';
import ExportReportReview from './ExportReportReview';
import StockBalanceSection from './StockBalanceSection';
import ReportSummary from './ReportSummary';
import StockBalanceCard from './StockBalanceCard';
import { useCallback,useMemo,useRef,useState } from 'react';
import { apiRequest } from '../lib/api';
import { createReportsData } from '../lib/data/reports';
import { scaledDecimal } from '../lib/data/decimal';
import { useLiveResource } from '../lib/live-updates';
import { useViewState } from '../lib/view-state';
import { businessDate } from '../data/business-date';
import { buildDurableReport,pesos,validReportFilters,type ReportFilters } from '../data/durable-reporting';
import { createPdf,downloadCsv,saveBlob } from '../lib/report-export';
import type { InventoryContext } from '../pages/Inventory';
import ReportTable from './ReportTable';
import Pagination,{usePagination} from './Pagination';

export default function LiveReports({scope,context,onInventory}:{scope:string;context?:ReportFilters;onInventory:(context:Omit<InventoryContext,'token'>)=>void}) {
  const [service]=useState(()=>createReportsData(apiRequest));
  const load=useCallback((signal:AbortSignal)=>service.read(signal),[service]);
  const [exporting,setExporting]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const resource=useLiveResource(`${scope}:reports`,load,['reports'],exporting||busy),today=resource.data?.businessDate??businessDate();
  const [filters,setFilters]=useViewState<ReportFilters>(context?'LiveReports.drilldown':'LiveReports.filters',context??{start:today,end:today,startTime:'00:00',endTime:'23:59',category:'All categories',scope:'Combined'});
  const [format,setFormat]=useViewState<'PDF'|'CSV'>('LiveReports.format','PDF');
  const cache=useRef<{key:string;promise:Promise<Blob>}|undefined>(undefined);
  const invalid=!validReportFilters(filters,today),criteria=JSON.stringify(filters);
  const result=useMemo(()=>{
    if(!resource.data||invalid)return undefined;
    try{return {data:buildDurableReport(resource.data,filters)};}catch(cause){return {error:cause instanceof Error?cause.message:'Unable to reconcile saved records.'};}
  },[resource.data,criteria,invalid]);
  const data=result?.data,report=data?.report,ready=resource.status==='ready'&&Boolean(report)&&!busy;
  const update=<K extends keyof ReportFilters>(key:K,value:ReportFilters[K])=>{setFilters({...filters,[key]:value});setExporting(false);setError('');};
  const ingredients=data?.balances.filter(b=>b.item.kind==='Ingredient')??[];
  const paging=usePagination(ingredients,criteria,4);
  const attention=(data?.balances??[]).filter(b=>b.attention);
  const attentionPaging=usePagination(attention,criteria,4);
  const balanceNote='Period balances use full business days. Opening + receipts + other inflows = available; closing = available − consumed − removed − other outflows. Percentages use available stock. Partial history covers only the dates shown. Expiry does not reduce physical closing stock; current usable stock is shown separately.';
  const table=(title:string)=>report?.sections.find(section=>section.title===title);
  const financial=report?.sections.filter(section=>section.title==='Purchased items and configurations')??[];
  const supplemental=report?.sections.filter(section=>!['Sales summary','Transactions','Purchased items and configurations','Ingredient period balances','Needs attention · current stock'].includes(section.title))??[];
  async function pdf(){
    if(!report)throw new Error('Load a valid report first.');const key=JSON.stringify(report);
    if(cache.current?.key!==key)cache.current={key,promise:createPdf(report)};
    try{return await cache.current.promise;}catch(cause){cache.current=undefined;throw cause;}
  }
  async function output(print=false){
    if(!ready||!report)return;setBusy(true);setError('');
    const viewer=print?window.open('about:blank','_blank'):null;
    if(print&&!viewer){setError('Allow a new browser tab to open the report for printing.');setBusy(false);return;}
    if(viewer){viewer.opener=null;viewer.document.title='Preparing report';viewer.document.body.textContent='Preparing report…';}
    try{
      const file=`happy-hentie-${filters.scope.toLowerCase().replaceAll(' ','-')}-${filters.start}-${filters.end}-${filters.category.toLowerCase().replaceAll(' ','-')}`;
      if(viewer)viewer.location.replace(URL.createObjectURL(await pdf()));
      else if(format==='PDF')saveBlob(await pdf(),`${file}.pdf`);else downloadCsv(report,`${file}.csv`);
      setExporting(false);
    }catch(cause){viewer?.close();setError(cause instanceof Error?cause.message:'Unable to prepare report.');}finally{setBusy(false);}
  }
  return <section className="reports">
    <div className="page-heading"><div><h1>Reports</h1><p className="subtitle">Review sales, consumption and stock balances.</p></div><div className="heading-actions">
      <button className="secondary" disabled={!ready} onClick={()=>void output(true)}>Print</button><button className="accent" disabled={!ready} onClick={()=>setExporting(true)}>Export report</button></div></div>
    <ReportControls filters={filters} today={today} format={format} busy={busy} onChange={update} onFormat={setFormat}/>
    {invalid&&<p className="error" role="alert">Choose a valid past or current date/time range; the end must be on or after the start.</p>}
    {resource.status==='loading'&&<p role="status">Loading saved report records…</p>}
    {resource.error&&<div className="error" role="alert"><p>{resource.error.message} Export is unavailable until loading succeeds.</p><button className="secondary" onClick={resource.reload}>Retry loading report</button></div>}
    {result?.error&&<p className="error" role="alert">{result.error}</p>}{error&&<p className="error" role="alert">{error}</p>}
    {report&&data&&<><p className="report-filter-summary" role="status">{filters.scope} · {report.range.replace(' · Asia/Manila','')} · {data.orderCount} matching orders</p>
      {resource.status!=='ready'&&<p className="report-note">Showing the last loaded snapshot. Loading must succeed before export.</p>}
      {filters.scope!=='Inventory usage'&&<ReportSummary total={pesos(data.total)} completed={data.completedCount} pending={data.pendingCount} voided={data.voidedCount}
        dailyAverage={pesos((data.total+BigInt(Math.floor(((Date.parse(filters.end)-Date.parse(filters.start))/86400000+1)/2)))/BigInt((Date.parse(filters.end)-Date.parse(filters.start))/86400000+1))}
        orderAverage={pesos(data.completedCount?(data.total+BigInt(Math.floor(data.completedCount/2)))/BigInt(data.completedCount):0n)} cash={pesos(data.cash)} gcash={pesos(data.digital)} pendingPaid={pesos(data.pendingPaid)} category={filters.category} taxLabel="recorded tax included"/>}
      {filters.scope!=='Inventory usage'&&<ReportTransactions category={filters.category} criteria={criteria} rows={(table('Transactions')?.rows??[]).map(row=>{const [status,...amount]=row[3].split('\n');return [row[0],row[1],row[2],status+(row[4]==='—'?'':'\n'+row[4]),amount.join('\n')];})}/>}{financial.map(section=><ReportTable key={section.title} {...section} criteria={criteria}/>)}<div className="stock-report-sections">
      {filters.scope!=='Sales'&&<StockBalanceSection start={filters.start} end={filters.end} known={ingredients.filter(b=>!b.issue).length} total={ingredients.length} partial={ingredients.filter(b=>b.partial&&!b.issue).length} note={balanceNote}
        methodNotes={report.notes.map(note=><p key={note}>{note}</p>)}>
        {paging.records.map(b=><StockBalanceCard key={b.item.id} name={b.item.name} sku={b.sku} remaining={b.remainingPercent} used={b.usedPercent} removed={b.removedPercent} zero={b.baseline===0n}
          partial={b.partial?`Partial history · ${b.coverageStart} to ${filters.end}. Earlier stock is unknown.`:undefined} issue={b.issue?`${b.issue}. Closing and percentages are unknown.`:undefined}
          values={[['Opening',`${b.display(b.opening)} ${b.unit}`],['Received',`${b.display(b.received)} ${b.unit}`],['Other inflows',`${b.display(b.otherIn)} ${b.unit}`],['Used',`${b.display(b.used)} ${b.unit}`],['Removed / other outflows',`${b.display(b.removed+b.otherOut)} ${b.unit}`],['Period closing',`${b.display(b.closing)} ${b.unit}`]]}
          current={`Current remaining: ${b.display(b.current)} ${b.unit} physical · ${b.display(b.usable)} usable as of ${today}`}/>)} <Pagination label="Ingredient balances" {...paging}/></StockBalanceSection>}
      {supplemental.map(s=><ReportTable key={s.title} {...s} criteria={criteria}/>)}
      {filters.scope!=='Sales'&&<section className="stock-attention" aria-label="Current stock needs attention"><h2>Needs attention</h2><p>Current usable quantities, reorder thresholds and batch expiry · {today}</p>
        {attentionPaging.records.map(b=><button className="attention-link" key={b.item.id} onClick={()=>onInventory({id:b.item.id,batchId:b.attentionBatch?.id})}><span>{b.item.name} · {b.sku}<small>{b.display(b.usable)} {b.unit} usable · Reorder {b.display(scaledDecimal(b.item.threshold_base,6))} {b.unit}</small><small>{b.attentionBatch?`Expiry: ${b.attentionBatch.expires_on??'Unrecorded'} · ${b.attentionBatch.unsellable?'Unsellable':'Check batch'}`:'Check usable stock'}</small></span><span>Open inventory →</span></button>)}
        {!attention.length&&<p className="empty-state">No current stock needs attention.</p>}<Pagination label="Stock attention" {...attentionPaging}/></section>}
    </div></>}
    {exporting&&report&&data&&<ExportReportReview scope={filters.scope} format={format} period={report.range.replace(' · Asia/Manila','')} source="saved business records" category={filters.category} busy={busy} ready={ready} error={error} onClose={()=>setExporting(false)} onDownload={()=>void output()}
      sales={filters.scope!=='Inventory usage'?{orders:data.orderCount,completed:data.completedCount,configurations:table('Purchased items and configurations')?.rows.length??0,revenue:pesos(data.total),pendingPaid:pesos(data.pendingPaid),cash:pesos(data.cash),gcash:pesos(data.digital)}:undefined}
      inventory={filters.scope!=='Sales'?<><p>{table('Ingredient usage by transaction')?.rows.length??0} transaction-linked ingredient rows · {table('Stocks used in the selected period')?.rows.length??0} stock-use rows · {data.balances.length} current stock records · {attention.length} need attention.</p><p>{ingredients.filter(b=>!b.issue).length} of {ingredients.length} ingredient period balances available{ingredients.some(b=>b.partial&&!b.issue)?' · partial history is labeled':''}. Current stock is separate from period closing stock.</p></>:undefined}
      balanceNote={filters.scope!=='Sales'?balanceNote:undefined}
      notes={<details className="report-method"><summary>Scope and missing-history notes</summary><p>{report.generated.replace(' · Asia/Manila','')}</p>{report.notes.map(note=><p key={note}>{note}</p>)}</details>}/>}
  </section>;
}
