import { useId } from 'react';
import { money } from '../data/demo';
import { Art, asset } from './ui';

export function GCashQr({ preview = false }: { preview?: boolean }) {
  return <><h3>SCAN TO PAY</h3><div className="qr-code"><Art file="QR_gcash.jpg" label="GCash payment QR" /><strong>Happy Hentie Café & Hobby Shop</strong></div>{preview && <p className="qr-notice"><img src={asset('ad3e5.png')} alt="" />Preview QR · no payment collected</p>}</>;
}

export function CashPaymentFields({ total, given, disabled, onChange }: { total: number; given: string; disabled?: boolean; onChange: (value: string) => void }) {
  return <><p className="payment-total"><strong>Total Due:</strong><strong>{money(total)}</strong></p><label className="cash-amount">Amount Given:<input data-initial-focus type="number" min={total} step="0.01" value={given} disabled={disabled} onChange={event => onChange(event.target.value)} placeholder="0.00" required/></label><p className="payment-total change"><strong>Change Due:</strong><strong>{money(Math.max(0, Number(given) - total))}</strong></p></>;
}

export function GCashPaymentFields({ reference, disabled, onChange }: { reference?: string; disabled?: boolean; onChange?: (value: string) => void }) {
  const hintId = useId();
  return <><label>GCash reference number<input data-initial-focus name="reference" inputMode="numeric" pattern="[0-9]{13}" maxLength={13} placeholder="13 digits, no spaces" aria-describedby={hintId} required value={reference} disabled={disabled} onChange={onChange ? event => onChange(event.target.value) : undefined}/></label><p id={hintId} className="field-hint">Enter exactly 13 digits without spaces or dashes, e.g. 1234567890123.</p></>;
}
