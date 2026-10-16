import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';

// Keep the numeric model at zero while allowing an empty editing draft.
export default function NumberField({ value, onValue, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: number; onValue: (value: number) => void }) {
  const [empty, setEmpty] = useState(false);
  return <input {...props} type="number" value={empty && value === 0 ? '' : value} onChange={event => { setEmpty(event.target.value === ''); onValue(Number(event.target.value)); }} onBlur={event => { setEmpty(false); props.onBlur?.(event); }} />;
}
