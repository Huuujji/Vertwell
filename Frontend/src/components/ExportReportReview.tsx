import type { ReactNode } from 'react';
import { Actions,Modal } from './ui';

export default function ExportReportReview({scope,format,period,source,category,sales,inventory,balanceNote,notes,error,busy,ready,onClose,onDownload}:{
  scope:string;format:'PDF'|'CSV';period:string;source:string;category:string;sales?:{orders:number;completed:number;configurations:number;revenue:string;pendingPaid:string;cash:string;gcash:string};inventory?:ReactNode;balanceNote?:string;notes?:ReactNode;
  error:string;busy:boolean;ready:boolean;onClose:()=>void;onDownload:()=>void;
}) {
  return <Modal title={`Export ${scope.toLowerCase()} report`} className="report-modal" plain onClose={()=>{if(!busy)onClose();}}
    footer={<Actions><button className="secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="primary" disabled={busy||!ready} onClick={onDownload}>{busy?'Preparing…':format==='PDF'?'Download PDF':'Export CSV'}</button></Actions>}>
    <p className="export-period">{period}</p><p className="subtitle">Every filtered record across all pages · {source}.</p>
    <dl className="export-facts"><div><dt>Report</dt><dd>{scope}</dd></div><div><dt>Format</dt><dd>{format}</dd></div>
      <div><dt>Sales category</dt><dd>{scope==='Inventory usage'?'Not applied':category}</dd></div><div><dt>Inventory</dt><dd>{scope==='Sales'?'Not included':'All categories'}</dd></div></dl>
    <div className="export-review-totals">{sales&&<><h2>Sales summary</h2><p>{sales.orders} matching orders · {sales.completed} Completed · {sales.configurations} configuration records</p><strong>{sales.revenue} completed revenue</strong><p>{sales.pendingPaid} paid / awaiting Owner review</p><div className="report-payment-split"><p>Cash <strong>{sales.cash}</strong></p><p>GCash <strong>{sales.gcash}</strong></p></div></>}{inventory&&<><h2>Inventory summary</h2>{inventory}</>}</div>
    {balanceNote&&<p className="report-note">{balanceNote}</p>}
    <p className="report-note">PDF download and Print share the same generated document. CSV contains the structured data and scope notes.</p>
    {notes}
    {error&&<p className="error" role="alert">{error}</p>}
  </Modal>;
}
