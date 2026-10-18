import type { ReactNode } from 'react';

export interface TransactionRow {id:string;label:string;time:string;cashier:string;cashierRole:string;status:string;request:boolean;items:ReactNode}
export default function TransactionTable({rows,manager,selected,checked,onSelect,onCheck,empty}:{rows:TransactionRow[];manager:boolean;selected:string|null;checked:string[];onSelect:(id:string)=>void;onCheck:(id:string,value:boolean)=>void;empty?:ReactNode}) {
  return <div className="table-wrap" role="region" aria-label={manager?'Audit transactions; scroll to see all columns':'Today’s transactions; scroll to see all columns'} tabIndex={0}>
    <table className="history-table"><thead><tr>{manager&&<th scope="col">Select</th>}{['Date & Time','Order ID','Items','Status','Cashier'].map(title=><th scope="col" key={title}>{title}</th>)}</tr></thead><tbody>
      {rows.map(row=>{const active=checked.length?checked.includes(row.id):selected===row.id;return <tr key={row.id} className={active?'active-row':''} tabIndex={0} aria-label={`Order ${row.label}, ${row.cashier}, ${row.status}`} aria-selected={active}
        onClick={()=>onSelect(row.id)} onKeyDown={event=>{if(event.target===event.currentTarget&&['Enter',' '].includes(event.key)){event.preventDefault();onSelect(row.id);}}}>
        {manager&&<td onClick={event=>event.stopPropagation()}><input type="checkbox" aria-label={`Select order ${row.label}`} disabled={row.status==='Voided'} checked={checked.includes(row.id)} onChange={event=>onCheck(row.id,event.target.checked)}/></td>}
        <td><time dateTime={row.time}>{new Date(row.time).toLocaleString('en-PH',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Manila'})}</time></td><td><button className="order-link" onClick={event=>{event.stopPropagation();onSelect(row.id);}} aria-label={`View order ${row.label}`}>{row.label}</button></td>
        <td>{row.items}</td><td><span className={`${manager?'audit':'staff'}-sale-status ${row.status.toLowerCase()}`}>{row.status}</span>{row.request&&<small className="request-status">Void requested</small>}</td>
        <td><span>{row.cashier}</span><small className="audit-cashier-role">{row.cashierRole}</small></td>
      </tr>;})}</tbody></table>{!rows.length&&empty}
  </div>;
}
