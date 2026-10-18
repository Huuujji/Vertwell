import type { Role } from '../data/demo';

export default function CartSummary({role,subtotal,tax,total}:{role:Role;subtotal:string;tax:string;total:string}) {
  return <><div className="staff-order-breakdown"><p><span>Subtotal</span><span>{subtotal}</span></p><p><span>VAT (12%)</span><span>{tax}</span></p></div>
    <div className="total-row"><strong>Total due</strong><strong>{total}</strong></div>
    {role!=='Owner'&&<p className="staff-payment-note">New sales: Pending Owner review after payment is received and the order fulfilled.</p>}</>;
}
