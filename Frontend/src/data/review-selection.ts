import type { Sale } from './demo';
import { businessDate } from './business-date';

export function reviewSelection(sales:Sale[],date:string,verified:string[]) {
  const ids=new Set(verified);
  const selected=sales.filter(s=>ids.has(s.id)&&s.status==='Pending'&&s.reviewState==='Awaiting Owner review'&&businessDate(s.time)===date);
  const cents=(method:Sale['method'])=>selected.filter(s=>s.method===method).reduce((sum,s)=>sum+Math.round(s.total*100),0)/100;
  return {selected,expectedCash:cents('Cash'),expectedGCash:cents('GCash')};
}
