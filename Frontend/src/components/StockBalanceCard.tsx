export default function StockBalanceCard({name,sku,remaining,used,removed,zero,issue,partial,values,current,className}:{
  name:string;sku:string;remaining:number;used:number;removed:number;zero:boolean;issue?:string;partial?:string;values:[string,string][];current:string;className?:string;
}) {
  return <article className={className}><div className="balance-heading"><strong>{name} <small>{sku}</small></strong><span>{issue?'Baseline unavailable':`${Math.round(remaining*10)/10}% remaining`}</span></div>
    {partial&&<p className="balance-coverage">{partial}</p>}
    {issue?<><div className="balance-track baseline-unavailable">Balance unavailable</div><p>{issue}</p></>:<><div className="balance-track" role="img" aria-label={`${name}: ${Math.round(used*10)/10}% used, ${Math.round(remaining*10)/10}% remaining, ${Math.round(removed*10)/10}% removed`}>
      {zero&&<span className="balance-empty">No stock available in these dates</span>}<span className="balance-remaining" style={{width:`${remaining}%`}}/><span className="balance-used" style={{width:`${used}%`}}/><span className="balance-removed" style={{width:`${removed}%`}}/>
    </div><dl className="balance-values">{values.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></>}
    <p className="current-balance">{current}</p>
  </article>;
}
