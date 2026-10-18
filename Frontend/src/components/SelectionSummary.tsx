export default function SelectionSummary({count,total,cash,gcash,pending,completed,hidden}:{count:number;total:string;cash:string;gcash:string;pending:number;completed:number;hidden:string[]}) {
  return <section className="selection-summary" aria-label="Selection summary"><strong>{count} selected orders · {total}</strong><p>Cash: {cash} · GCash: {gcash}</p>
    <p>{pending} Pending · {completed} Completed</p><p>{count} eligible for void · {hidden.length} outside the current page or filters.</p>
    {hidden.length>0&&<p>Hidden selected IDs: {hidden.join(', ')}</p>}<p>Use Bulk Void to review every affected order, or Clear selection to return to the single-order view.</p></section>;
}
