import type { ReactNode } from 'react';
import type { Role } from '../data/demo';
export default function PosHeading({role,name,persistent=false,action}:{role:Role;name:string;persistent?:boolean;action?:ReactNode}) {
  return <div className="pos-heading">{role==='Staff'&&<p className="staff-eyebrow">Sales counter · {name}</p>}<div className="pos-title-row"><h1>Point of Sale</h1>{action}</div>
    <p className="subtitle">{role==='Staff'?'Select items, review the order, then choose a payment.':persistent?'Build an order and record received payment.':'Build an order and record a sample payment.'}</p></div>;
}
export function CatalogueCaption({count}:{count:number}){return <div className="catalog-caption"><span>{count} items in this view</span><span>Tap an item to add it</span></div>;}
