import ReportTable from './ReportTable';
export default function ReportTransactions({rows,category,criteria}:{rows:string[][];category:string;criteria:string}) {
  return <ReportTable title="Transactions" description="Every matching order, including Pending and Voided. Completed orders contribute to revenue."
    headings={['Order ID / date','Cashier','Payment / review','Status',category==='All categories'?'Total':'Category amount']} numericColumns={[4]} rows={rows} criteria={criteria}/>;
}
