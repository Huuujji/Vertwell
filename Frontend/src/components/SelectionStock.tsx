export type SelectionStockRow={id:string;name:string;sku:string;needed:string;remaining:string;unit:string;short:boolean};
export default function SelectionStock({rows,note,status,error}:{rows:SelectionStockRow[];note:string;status?:string;error?:string}) {
  return <section className="customize-stock" aria-label="Stock needed for this customization"><h3>Stock for this selection</h3><p>{note}</p>
    {rows.length>0&&<ul>{rows.map(row=><li key={row.id}><span>{row.name}<small>{row.sku}</small></span><span>{row.needed} {row.unit} needed<small>{row.remaining} {row.unit} {row.short?'short for order':'usable after order'}</small></span></li>)}</ul>}
    {status&&<p role="status">{status}</p>}{error&&<p className="error" role="status">{error}</p>}
  </section>;
}
