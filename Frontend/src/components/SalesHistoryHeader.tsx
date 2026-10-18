import type { Role } from '../data/demo';
import { businessDate } from '../data/business-date';
import SearchField from './SearchField';
import DateField from './DateField';

export default function SalesHistoryHeader({role,orders,pending,requests,search,date,onSearch,onDate,searchLabel='Search sales',dateLabel='Filter sales by date',maxDate}:{
  role:Role;orders:number;pending:number;requests:number;search:string;date:string;onSearch:(value:string)=>void;onDate:(value:string)=>void;searchLabel?:string;dateLabel?:string;maxDate?:string;
}) {
  return <>{role==='Staff'&&<p className="staff-eyebrow">Today’s sales · {businessDate()}</p>}<h1>Sales History</h1>
    {role==='Staff'&&<div className="staff-daily-summary" aria-label="Current day summary"><div><span>Orders recorded</span><strong>{orders}</strong></div><div><span>Pending orders</span><strong>{pending}</strong></div><div><span>Void requests pending</span><strong>{requests}</strong></div></div>}
    <div className="history-toolbar"><p className="subtitle">{role==='Staff'?'Your recorded transactions for the current business date':'Investigate sales, review void requests, and retain the original transactions.'}</p>
      <div className="labeled-search"><label htmlFor="audit-search-label">Search</label><SearchField id="audit-search-label" label={searchLabel} placeholder="Order, person, item or reference" value={search} onChange={onSearch}/></div>
      <DateField label={dateLabel} value={date} onChange={onDate} max={maxDate}/>
    </div></>;
}
