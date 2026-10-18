import type { ReactNode } from 'react';
import { Art } from './ui';

// The same catalogue card in preview and saved-account workspaces.
export default function CatalogueCard({name,image,icon,price,children,unavailable,disabled,onClick}:{
  name:string;image?:string;icon:string;price:ReactNode;children?:ReactNode;unavailable?:string;disabled?:boolean;onClick:()=>void;
}) {
  return <button className="product-card" disabled={disabled||Boolean(unavailable)} onClick={onClick} aria-label={`Add ${name} to order`}>
    {image?<img className="product-photo" src={image} alt={name}/>:<div className="product-placeholder"><Art file={icon}/><span>No photo</span></div>}
    <strong>{name}</strong><span className="product-card-bottom"><span>{price}</span><Art file={icon} className="product-type"/></span>
    {children}{unavailable&&<small className="availability-note" title={unavailable}>Unavailable</small>}
  </button>;
}
