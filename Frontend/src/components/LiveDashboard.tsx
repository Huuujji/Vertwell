import { useCallback,useState } from 'react';
import Dashboard from '../pages/Dashboard';
import { apiRequest } from '../lib/api';
import { createReportsData } from '../lib/data/reports';
import { useLiveResource } from '../lib/live-updates';
import { dashboardSales } from '../lib/data/dashboard';
import type { StockItem,Role } from '../data/demo';
import type { AuditContext } from '../pages/SalesHistory';
import type { InventoryContext } from '../pages/Inventory';
import type { ReportFilters } from '../data/durable-reporting';
import LiveFinancialOverview from './LiveFinancialOverview';

export default function LiveDashboard({scope,stock,role,owner,onAudit,onInventory,onReports,onDailyReview,onDirtyChange}:{onDirtyChange:(dirty:boolean)=>void;scope:string;stock:StockItem[];role:Role;owner:string;
  onAudit:(context:Omit<AuditContext,'token'>)=>void;onInventory:(context:Omit<InventoryContext,'token'>)=>void;onReports:(filters:ReportFilters)=>void;onDailyReview:(date:string)=>void;
}) {
  const [service]=useState(()=>createReportsData(apiRequest)),load=useCallback((signal:AbortSignal)=>service.read(signal),[service]);
  const resource=useLiveResource(`${scope}:dashboard`,load,['reports']);
  return <>{resource.status==='loading'&&<p role="status">Loading Dashboard…</p>}{resource.error&&<div className="error" role="alert"><p>{resource.error.message}</p><button className="secondary" onClick={resource.reload}>Retry loading Dashboard</button></div>}
    {resource.data&&<Dashboard persistent onDirtyChange={onDirtyChange} sales={dashboardSales(resource.data)} stock={stock} role={role} owner={owner} onConfirmReview={()=>false} onDailyReview={onDailyReview}
      onAudit={onAudit} onInventory={onInventory} onReports={(start,end,category,startTime='00:00',endTime='23:59')=>onReports({start,end,category,startTime,endTime,scope:'Combined'})}
      overview={category=><LiveFinancialOverview snapshot={resource.data!} ready={resource.status==='ready'} category={category} onReports={onReports}/>}/>}</>;
}
