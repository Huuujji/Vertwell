import { useLayoutEffect, useRef } from 'react';
import { Art } from './ui';
export default function SearchField({ label, value, onChange, id, placeholder = 'Search by name or SKU' }: { id?: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const focusAfterClear = useRef(false);
  function clear() {
    focusAfterClear.current = true;
    onChange('');
  }
  useLayoutEffect(() => {
    if (focusAfterClear.current) {
      focusAfterClear.current = false;
      input.current?.focus();
      input.current?.parentElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [value]);
  return <div className="search-field"><Art file="da2ba.svg" /><input id={id} ref={input} aria-label={label} type="search" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />{value && <button type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={clear}>×</button>}</div>;
}
