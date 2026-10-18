import type { ReactNode } from 'react';
export default function OrderReceiptDetails({id,cashier,role,method,time,status,total,review,lines,missing}:{
  id:string;cashier:string;role:string;method:string;time:string;status:string;total:string;review?:string;
  lines?:{key:string|number;name:string;quantity:number;details:ReactNode;amount:string}[];missing?:string;
}) {
  return <><p className="detail-id"><strong>Order ID: {id}</strong></p><p>{cashier} · {role} · {method}</p><p>{time}</p>
    {lines?.map(line=><p className="detail-line" key={line.key}><span>{line.quantity}× {line.name}{line.details}</span><strong>{line.amount}</strong></p>)}
    {missing&&<p>{missing}</p>}<p className="detail-line"><strong>Total Due:</strong><strong>{total}</strong></p><p>Status: {status}</p>
    {review&&<p>Payment received · Fulfilled · {review}</p>}</>;
}
