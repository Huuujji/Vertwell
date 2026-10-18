import type { ReactNode } from 'react';
import { Art, asset } from './ui';

export default function CheckoutSummary({ lines, subtotal, tax, total, onCash, onGCash, preview = false }: {
  lines: { key: string | number; name: string; quantity: number; amount: string; details?: ReactNode }[];
  subtotal: string; tax: string; total: string; onCash: () => void; onGCash: () => void; preview?: boolean;
}) {
  return <><div className="receipt"><div className="receipt-lines">{lines.map(line => <p key={line.key}><strong>•{line.quantity > 1 ? `${line.quantity}× ` : ''}{line.name}{line.details}</strong><strong>{line.amount}</strong></p>)}</div><p><strong>Subtotal</strong><strong>{subtotal}</strong></p><p><strong>VAT (12%)</strong><strong>{tax}</strong></p><p className="receipt-total"><strong>Total Due:</strong><strong>{total}</strong></p></div><div className="payment-methods"><button data-initial-focus className="primary" onClick={onCash}><img src={asset('32ae9.png')} alt=""/><strong>{preview ? 'CASH PAYMENT' : 'Cash payment'}</strong></button><button className="primary qr-method" onClick={onGCash}><Art file="b2c8d.svg" className="card-art"/><Art file="1c129.svg" className="qr-icon"/><strong>{preview ? 'QR PH' : 'GCash payment'}</strong></button></div></>;
}
