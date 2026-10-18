import type { ReactNode } from 'react';

export function OrderItemCount({count}:{count:number}) {
  return <span className="order-count">{count} {count===1?'item':'items'}</span>;
}

export default function CartItem({name,sku,components,modifiers,amount,editAction,children}:{
  name:string;sku?:string;components?:ReactNode;modifiers?:{id:string;name:string;amount:string}[];
  amount:ReactNode;editAction?:ReactNode;children:ReactNode;
}) {
  return <div className="cart-line"><strong>{name}</strong>
    {sku&&<small className="cart-configuration">SKU: {sku}</small>}
    {components&&<small className="cart-configuration">Includes: {components}</small>}
    {modifiers?.map(option=><small className="cart-modifier" key={option.id}>{option.name} · +{option.amount}</small>)}
    {editAction}<span>{amount}</span>{children}
  </div>;
}
