import DateField from './DateField';
import TimeField from './TimeField';
import type { ReportFilters } from '../data/durable-reporting';

export default function ReportControls({filters,today,format,busy=false,onChange,onFormat}:{filters:ReportFilters;today:string;format:'PDF'|'CSV';busy?:boolean;onChange:<K extends keyof ReportFilters>(key:K,value:ReportFilters[K])=>void;onFormat:(format:'PDF'|'CSV')=>void}) {
  return <fieldset disabled={busy} className="report-controls"><legend className="sr-only">Report filters</legend>
    <DateField label="From" value={filters.start} onChange={v=>onChange('start',v)} max={filters.end&&filters.end<today?filters.end:today} required/>
    <DateField label="To" value={filters.end} onChange={v=>onChange('end',v)} min={filters.start<=today?filters.start:undefined} max={today} required/>
    <TimeField label="From time" value={filters.startTime} onChange={v=>onChange('startTime',v)}/><TimeField label="To time" value={filters.endTime} onChange={v=>onChange('endTime',v)}/>
    <label>Report scope<select aria-label="Report scope" value={filters.scope} onChange={e=>onChange('scope',e.target.value as ReportFilters['scope'])}><option>Sales</option><option>Inventory usage</option><option>Combined</option></select></label>
    <label>Sales category<select aria-label="Sales category" value={filters.category} disabled={filters.scope==='Inventory usage'} onChange={e=>onChange('category',e.target.value as ReportFilters['category'])}><option>All categories</option><option>Food and Beverage</option><option>Hobby</option></select></label>
    <label>Export format<select aria-label="Export format" value={format} onChange={e=>onFormat(e.target.value as 'PDF'|'CSV')}><option>PDF</option><option>CSV</option></select></label>
  </fieldset>;
}
