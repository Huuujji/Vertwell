import { Art } from './ui';
export default function ReportSummary({total,completed,pending,voided,dailyAverage,orderAverage,cash,gcash,pendingPaid,category,taxLabel}:{
  total:string;completed:number;pending:number;voided:number;dailyAverage:string;orderAverage:string;cash:string;gcash:string;pendingPaid:string;category:string;taxLabel:string;
}) {
  return <><div className="report-summary"><div><Art file="99dc7.svg" className="card-art"/><p>Completed sales total</p><strong>{total}</strong><small>{category} · {taxLabel}</small></div>
    <div><p>Completed orders</p><strong>{completed}</strong><small>{pending} Pending · {voided} Voided</small></div>
    <div><p>Average daily sales</p><strong>{dailyAverage}</strong><small>{orderAverage} average completed order</small></div></div>
    <p className="report-note">Completed revenue excludes Pending/Voided. Paid/fulfilled sales awaiting Owner review: {pendingPaid}. Received payment and Owner review are separate.</p>
    <div className="report-payment-split"><p><span>Cash</span><strong>{cash}</strong></p><p><span>GCash</span><strong>{gcash}</strong></p></div></>;
}
