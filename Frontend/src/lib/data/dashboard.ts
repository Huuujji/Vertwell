import type { Sale,Category,Role } from '../../data/demo';
import type { ReportSnapshot } from './reports';
import { displayDecimal } from './decimal';
import { choice } from './contracts';

// Display adapter only. Reports retain integer-cent calculations; historical
// receipts never use the current catalogue or current account names.
export function dashboardSales(snapshot:ReportSnapshot):Sale[] {
  const t=snapshot.tables;
  return t.sales.map((row):Sale=>{
    const payment=t.payments.find(p=>p.sale_id===row.id);
    const request=t.void_requests.filter(r=>r.sale_id===row.id).sort((a,b)=>b.requested_at.localeCompare(a.requested_at))[0];
    return {id:row.id,time:row.occurred_at,cashier:row.cashier_name,cashierId:row.cashier_id,cashierRole:choice(row.cashier_role,['Owner','Admin','Staff']) as Role,
      total:displayDecimal(row.total,2),status:choice(row.status,['Completed','Pending','Voided']),method:payment?choice(payment.method,['Cash','GCash']):'Unrecorded',
      paymentState:row.payment_state==='Received'?'Received':undefined,fulfilmentState:row.fulfilment_state==='Fulfilled'?'Fulfilled':undefined,
      reviewState:choice(row.review_state,['Owner checkout','Awaiting Owner review','Reviewed'] as const),stockCommitted:row.stock_committed===true,
      lines:t.sale_items.filter(i=>i.sale_id===row.id).map(i=>({name:i.name,category:choice(i.category,['Food','Beverage','Hobby']) as Category,quantity:i.quantity,price:displayDecimal(i.unit_price,2),
        purchasedConfiguration:structuredClone({productId:i.product_id,variantId:i.variant_id,sku:i.sku,configuration:i.configuration_snapshot}),
        modifiers:t.sale_item_modifiers.filter(m=>m.sale_item_id===i.id).map(m=>({id:m.option_id??m.name,name:m.name,price:displayDecimal(m.price,2)}))})),
      voidRequest:request?{reason:request.reason,requestedBy:request.requested_name,requestedAt:request.requested_at,requestedRole:choice(request.requested_role,['Owner','Admin','Staff'] as const),status:choice(request.status,['Pending','Approved','Rejected'])}:undefined};
  });
}
