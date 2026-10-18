import type { ReactNode } from 'react';

export default function StockBalanceSection({start,end,known,total,partial,note,children,methodNotes,preview=false}:{
  start:string;end:string;known:number;total:number;partial:number;note:string;children:ReactNode;methodNotes?:ReactNode;preview?:boolean;
}) {
  return <section className="ingredient-balances" aria-label="Ingredient usage and remaining percentages">
    <div className="report-section-heading"><div><h2>Ingredient usage / remaining stock</h2><p>{start} to {end} · full business days · all inventory categories</p></div>
      <span className="record-count">{known} of {total} balances available{partial>0?` · ${partial} with partial history`:''}</span></div>
    <p className="report-note">{note}</p><ul className="balance-legend" aria-label="Stock balance legend">
      <li><span className="balance-swatch balance-remaining" aria-hidden="true"/>Green · remaining stock</li><li><span className="balance-swatch balance-used" aria-hidden="true"/>Gold · used in orders</li>
      <li><span className="balance-swatch balance-removed" aria-hidden="true"/>Red / burgundy · removed stock</li><li><span className="balance-swatch baseline-unavailable" aria-hidden="true"/>Striped gray · balance unavailable</li></ul>
    {children}
    <details className="report-method"><summary>How stock balances are calculated</summary>
      <p>Start with the stock you had at the beginning of the selected dates, then add deliveries received during those dates.</p>
      <p className="balance-formula">Starting stock + deliveries + other inflows − stock used − stock removed − other outflows = stock left</p>
      <p>Example: 10 bottles + 5 delivered − 4 used − 1 removed = 10 bottles left. Of the 15 available bottles, about 67% remain, 27% were used and 6% were removed.</p>
      <p>The stock balance bar splits available stock into green for remaining, gold for used in orders, and red / burgundy for removed stock and other outflows. Amounts below each bar show the same information in numbers.</p>
      <p>Expired stock is still physically on hand until you remove it. Usable stock excludes expired or unsellable items. A red stock warning means attention is needed; it does not mean that quantity has already been removed.</p>
      <p>The period closing balance is what was left at the end of your selected dates. Current remaining is what you have now. Time filters narrow sales and usage tables; balance bars cover full days.</p>
      <p>With partial history, the bar names the dates with reliable records; earlier stock is unknown. A striped gray bar means no reliable balance is available. A known period with no stock says so explicitly.{preview?' These sample records reset on refresh.':''}</p>
      {methodNotes}
    </details>
  </section>;
}
