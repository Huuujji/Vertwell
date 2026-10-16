// Calendar-days from Lucide (ISC); see public/assets/lucide-calendar-LICENSE.txt.
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { businessDate } from '../data/demo';

const asDate = (value: string) => new Date(`${value}T12:00:00Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);
const shift = (value: string, days: number) => iso(new Date(asDate(value).getTime() + days * 86400000));
const shiftMonth = (value: string, months: number) => {
  const date = asDate(value), day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last)); return iso(date);
};
// One calendar for all workspace fields. The native date input still supports typed dates.
export default function DateField({ label, name, value, defaultValue, onChange, min, max, required }: { label: string; name?: string; value?: string; defaultValue?: string; onChange?: (value: string) => void; min?: string; max?: string; required?: boolean }) {
  const id = useId(); const popover = useRef<HTMLDivElement>(null); const opener = useRef<HTMLButtonElement>(null); const field = useRef<HTMLInputElement>(null);
  const [internal, setInternal] = useState(defaultValue ?? ''); const selected = value ?? internal;
  const [open, setOpen] = useState(false); const [focused, setFocused] = useState(selected || businessDate());
  const [month, setMonth] = useState((selected || businessDate()).slice(0, 7));
  const clamp = (date: string) => min && date < min ? min : max && date > max ? max : date;
  function focusDate(date: string) { const next = clamp(date); setFocused(next); setMonth(next.slice(0, 7)); }
  function close() { popover.current?.hidePopover(); opener.current?.focus(); }
  function pick(date: string) { setInternal(date); onChange?.(date); popover.current?.hidePopover(); opener.current?.focus(); }
  useEffect(() => {
    if (!open) return;
    const position = () => {
      const box = opener.current!.parentElement!.getBoundingClientRect(); const element = popover.current!;
      const width = Math.min(344, innerWidth - 16);
      element.style.width = `${width}px`; const height = element.offsetHeight;
      element.style.left = `${Math.max(8, Math.min(box.left, innerWidth - width - 8))}px`;
      element.style.top = `${Math.max(8, Math.min(box.bottom + 6, innerHeight - height - 8))}px`;
    };
    // Scrolling the day grid must not reposition the panel under the pointer.
    const scroll = (event: Event) => { if (!(event.target instanceof Node && popover.current?.contains(event.target))) position(); };
    position(); window.addEventListener('resize', position); window.addEventListener('scroll', scroll, true);
    popover.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', scroll, true); };
  }, [open, month, focused]);
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (delta !== undefined) { event.preventDefault(); focusDate(shift(date, delta)); }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); focusDate(shift(date, (event.key === 'Home' ? 0 : 6) - asDate(date).getUTCDay())); }
    if (event.key === 'PageUp' || event.key === 'PageDown') { event.preventDefault(); focusDate(shiftMonth(date, event.key === 'PageUp' ? -1 : 1)); }
  }
  const first = asDate(`${month}-01`); const start = shift(`${month}-01`, -first.getUTCDay());
  const previousEnd = shift(`${month}-01`, -1), nextStart = shiftMonth(`${month}-01`, 1);
  function changeMonth(delta: number) { focusDate(shiftMonth(focused, delta)); }
  return <div className="date-field"><label htmlFor={id}>{label}{required && <span className="required-mark" aria-hidden="true" title="Required"> *</span>}</label><div className="date-input"><input ref={field} id={id} aria-label={label} name={name} type="date" value={selected} onChange={event => { setInternal(event.target.value); onChange?.(event.target.value); }} min={min} max={max} required={required} /><button ref={opener} type="button" aria-label={`Open ${label.toLowerCase()} calendar`} aria-controls={`${id}-calendar`} aria-expanded={open} onClick={() => { if (open) close(); else { focusDate(selected || businessDate()); popover.current?.showPopover(); } }}><svg className="calendar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01"/></svg></button></div>
    <div ref={popover} id={`${id}-calendar`} className="calendar-popover" popover="auto" role="dialog" aria-label={`${label} calendar`} onToggle={event => setOpen(event.newState === 'open')} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }} onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) popover.current?.hidePopover(); }}><header><button type="button" aria-label="Previous month" disabled={Boolean(min && previousEnd < min)} onClick={() => changeMonth(-1)}>‹</button><strong aria-live="polite">{first.toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong><button type="button" aria-label="Next month" disabled={Boolean(max && nextStart > max)} onClick={() => changeMonth(1)}>›</button></header><div className="calendar-days">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <span key={day}>{day}</span>)}{Array.from({ length: 42 }, (_, index) => shift(start, index)).map(date => <button type="button" key={date} data-date={date} tabIndex={date === focused ? 0 : -1} aria-label={asDate(date).toLocaleDateString('en-PH', { dateStyle: 'full', timeZone: 'UTC' })} aria-pressed={date === selected} className={date.slice(0, 7) !== month ? 'other-month' : ''} disabled={Boolean(min && date < min || max && date > max)} onKeyDown={event => keyboard(event, date)} onClick={() => pick(date)}>{Number(date.slice(-2))}</button>)}</div><footer><button type="button" onClick={() => pick(businessDate())} disabled={Boolean(min && businessDate() < min || max && businessDate() > max)}>Today</button><button type="button" onClick={() => pick('')}>Clear</button><button type="button" onClick={close}>Close</button></footer></div>
  </div>;
}
