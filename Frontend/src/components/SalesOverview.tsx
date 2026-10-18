import type { CSSProperties } from 'react';
import DateField from './DateField';
import TimeField from './TimeField';
import ChevronDown from './ChevronDown';
import { Art } from './ui';

export default function SalesOverview({ start,end,startTime,endTime,today,category,hobby=false,valid,preview=false,days,total,onChange,onReports,canOpenReport=true }:{
  start:string;end:string;startTime:string;endTime:string;today:string;category:string;hobby?:boolean;valid:boolean;preview?:boolean;
  days:{date:string;count:number;amount:string;height:number}[];total:string;canOpenReport?:boolean;
  onChange:(key:'start'|'end'|'startTime'|'endTime',value:string)=>void;onReports:()=>void;
}) {
  return <section className="sales-chart"><div className="page-heading"><h2>Sales Overview</h2><button className="secondary" disabled={!valid||!canOpenReport} onClick={onReports}>View filtered report</button></div>
    <div className="chart-date-controls"><DateField label="Sales from" value={start} onChange={v=>onChange('start',v)} max={end<today?end:today}/><TimeField label="From time" value={startTime} onChange={v=>onChange('startTime',v)}/><DateField label="Sales to" value={end} onChange={v=>onChange('end',v)} min={start} max={today}/><TimeField label="To time" value={endTime} onChange={v=>onChange('endTime',v)}/></div>
    {!valid&&<p className="error" role="alert">Choose a past or current date/time range of up to 31 days.</p>}
    <p className="chart-period">Completed sales · {start} {startTime} to {end} {endTime}</p>
    <div className="chart" role="img" aria-label={`${preview?'Sample ':''}${category} completed sales for the selected date and time range`}><Art file="6dfe8.svg" className="card-art"/>
      {!days.some(day=>day.height>0)&&<p className="chart-empty">No completed sales in this period.</p>}
      <div className="chart-bars" style={{gridTemplateColumns:`repeat(${Math.max(1,days.length)}, minmax(0, 1fr))`}}>{days.map((day,i)=><span key={day.date} className={`chart-bar bar-${i}`} title={`${day.date}: ${day.amount}`} style={{'--bar-height':day.height,'--bar-width':[140,157,152,199,164,158,155,147,124][i%9],'--mobile-bar-height':day.height*150/280} as CSSProperties}>
        {!hobby&&(i===0||i===2)&&<Art file={i===0?'aecc8.svg':'21548.svg'} className="card-art desktop-bar-art"/>}<Art file={['b96e8.svg','6835e.svg','e0c6a.svg','3cc8e.svg','0ea4c.svg','a76c0.svg','034fd.svg','3f2d8.svg','51660.svg'][i%9]} className="card-art mobile-bar-art"/>
      </span>)}</div></div>
    <div className="chart-labels" aria-hidden="true" style={{gridTemplateColumns:`repeat(${Math.max(1,days.length)}, minmax(0, 1fr))`}}>{days.map(day=><span key={day.date}>{day.date.slice(8)}/{day.date.slice(5,7)}</span>)}</div>
    <details className="daily-sales-values"><summary><ChevronDown/><span><span>Daily sales values</span><small>Review the exact amounts behind the chart</small></span><span className="daily-sales-total">{total}<small>{days.length} days · total</small></span></summary><div className="daily-values-scroll"><table><caption>{category} · Completed sales</caption><thead><tr><th scope="col">Date</th><th scope="col">Completed orders</th><th scope="col">Amount (incl. {preview?'sample VAT':'recorded tax'})</th></tr></thead><tbody>{days.map(day=><tr key={day.date}><th scope="row">{new Date(`${day.date}T12:00:00Z`).toLocaleDateString('en-PH',{month:'short',day:'numeric',weekday:'short',timeZone:'UTC'})}</th><td>{day.count}</td><td>{day.amount}</td></tr>)}</tbody></table>{!days.length&&<p className="empty-state">Choose a valid period to view daily values.</p>}</div></details>
  </section>;
}
