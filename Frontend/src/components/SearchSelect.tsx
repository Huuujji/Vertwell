import { useEffect, useId, useRef, useState } from 'react';

import ChevronDown from './ChevronDown';

export interface SearchChoice { value: string; label: string; search?: string }
export default function SearchSelect({ label, value, choices, onChange, required, placeholder = 'Type to search or choose' }: { label: string; value: string; choices: SearchChoice[]; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  const id = useId(), field = useRef<HTMLInputElement>(null);
  const selected = choices.find(choice => choice.value === value)?.label ?? '';
  const [query, setQuery] = useState(selected), [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const filtered = choices.filter(choice => `${choice.label} ${choice.search ?? ''}`.toLowerCase().includes(query === selected ? '' : query.trim().toLowerCase()));
  useEffect(() => { setQuery(selected); }, [selected]);
  useEffect(() => { field.current?.setCustomValidity(required && (!value || query !== selected) ? 'Choose a matching option from the list.' : ''); }, [required, value, query, selected]);
  useEffect(() => { if (open && active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [open, active, id]);
  function pick(next: string) { onChange(next); setQuery(choices.find(choice => choice.value === next)?.label ?? ''); setOpen(false); setActive(-1); field.current?.focus(); }
  return <div className="search-select"><label htmlFor={id}>{label}</label><div className="search-select-control"><input ref={field} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} aria-activedescendant={open && active >= 0 && filtered[active] ? `${id}-option-${active}` : undefined} autoComplete="off" required={required} value={query} placeholder={placeholder} onFocus={() => { setOpen(true); setActive(-1); }} onChange={event => { setQuery(event.target.value); setOpen(true); setActive(-1); if (!event.target.value) onChange(''); }} onBlur={() => { setOpen(false); setQuery(selected); setActive(-1); }} onKeyDown={event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(current => Math.max(0, Math.min(filtered.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)))); }
    if (event.key === 'Enter' && open) { event.preventDefault(); if (filtered[active]) pick(filtered[active].value); }
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); setQuery(selected); setActive(-1); }
  }} /><button type="button" tabIndex={-1} aria-label={`Show ${label.toLowerCase()} choices`} onMouseDown={event => event.preventDefault()} onClick={() => { field.current?.focus(); setOpen(!open); }}><ChevronDown /></button></div>{open && <div className="search-select-options" id={`${id}-options`} role="listbox" aria-label={`${label} choices`}>{filtered.map((choice, index) => <div id={`${id}-option-${index}`} key={choice.value} role="option" data-value={choice.value} aria-selected={index === active} className={index === active ? 'focused-option' : ''} onMouseDown={event => event.preventDefault()} onClick={() => pick(choice.value)}>{choice.label}</div>)}{!filtered.length && <p role="status">No matching options.</p>}</div>}</div>;
}
