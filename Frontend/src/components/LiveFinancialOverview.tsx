import { useMemo } from 'react';
import type { ReportSnapshot } from '../lib/data/reports';
import { useViewState } from '../lib/view-state';
import { buildDurableReport,pesos,validReportFilters,type ReportFilters } from '../data/durable-reporting';
import SalesOverview from './SalesOverview';

export default function LiveFinancialOverview({snapshot,ready,category,onReports}:{snapshot:ReportSnapshot;ready:boolean;category:ReportFilters['category'];onReports:(filters:ReportFilters)=>void}) {
  const today=snapshot.businessDate;
  const [stored,setFilters]=useViewState<ReportFilters>('LiveDashboard.filters',{start:new Date(Date.parse(today)-8*86400000).toISOString().slice(0,10),end:today,startTime:'00:00',endTime:'23:59',category,scope:'Combined'});
  const filters={...stored,category};
  const criteria=JSON.stringify(filters),span=(Date.parse(filters.end)-Date.parse(filters.start))/86400000+1;
  const valid=validReportFilters(filters,today)&&span<=31;
  const result=useMemo(()=>{if(!valid)return;try{return {data:buildDurableReport(snapshot,filters)};}catch(cause){return {error:cause instanceof Error?cause.message:'Unable to load saved sales values.'};}},[snapshot,criteria,valid]);
  const data=result?.data,maximum=Math.max(1,...(data?.dailyTotals.map(day=>Number(day.total))??[]));
  const dates=valid?Array.from({length:span},(_,i)=>new Date(Date.parse(filters.start)+i*86400000).toISOString().slice(0,10)):[];
  return <section aria-label="Saved sales overview">
    {result?.error&&<p className="error" role="alert">{result.error}</p>}
    {data&&<p>Selected event period: payments received {pesos(data.receivedFunds)} · Manual refunds recorded {data.refundedFunds===null?'Unavailable: mixed-order allocation missing':pesos(data.refundedFunds)} · Received less payouts {data.netReceivedFunds===null?'Unavailable: payout allocation missing':pesos(data.netReceivedFunds)}. Completed-sales revenue below uses current receipt status.</p>}
    <SalesOverview {...filters} today={today} category={filters.category} hobby={filters.category==='Hobby'} valid={valid} canOpenReport={ready} total={pesos(data?.total??0n)}
      days={dates.map(date=>{const day=data?.dailyTotals.find(day=>day.date===date);return {date,count:Number(data?.dailyValues.find(row=>row[0]===date)?.[1]??0),amount:pesos(day?.total??0n),height:Number(day?.total??0n)/maximum*280};})}
      onChange={(key,value)=>setFilters({...filters,[key]:value})} onReports={()=>{if(ready)onReports({...filters,scope:'Combined'});}}/>
  </section>;
}
