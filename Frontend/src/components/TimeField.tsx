import { useEffect, useId, useRef, useState } from 'react';

const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const normalizeTime = (value: string) => {
  const match = /^(\d{1,2}):?(\d{2})$/.exec(value.trim());
  const result = match ? `${match[1].padStart(2, '0')}:${match[2]}` : value;
  return validTime(result) ? result : value;
};

export default function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId(), popover = useRef<HTMLDivElement>(null), opener = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false), [draft, setDraft] = useState(validTime(value) ? value : '00:00');
  function close() { popover.current?.hidePopover(); opener.current?.focus(); }
  function pick(time: string) { onChange(time); close(); }
  function commit() { onChange(normalizeTime(value)); }
  useEffect(() => {
    if (!open) return;
    const position = () => {
      const box = opener.current!.parentElement!.getBoundingClientRect(), panel = popover.current!, width = Math.min(320, innerWidth - 16);
      panel.style.width = `${width}px`; panel.style.left = `${Math.max(8, Math.min(box.left, innerWidth - width - 8))}px`;
      panel.style.top = `${Math.max(8, Math.min(box.bottom + 6, innerHeight - panel.offsetHeight - 8))}px`;
    };
    position(); popover.current?.querySelector<HTMLSelectElement>('select')?.focus();
    window.addEventListener('resize', position); window.addEventListener('scroll', position, true);
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [open]);
  return <div className="date-field time-field"><label htmlFor={id}>{label}</label>
    <div className="date-input"><input id={id} type="text" inputMode="numeric" placeholder="HH:mm" maxLength={5} autoComplete="off" value={value} aria-invalid={!validTime(value)} aria-describedby={!validTime(value) ? `${id}-hint` : undefined} onChange={event => onChange(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit(); } }} />
      <button ref={opener} type="button" aria-label={`Open ${label.toLowerCase()} time picker`} aria-expanded={open} aria-controls={`${id}-picker`} onClick={() => { if (open) close(); else { setDraft(validTime(normalizeTime(value)) ? normalizeTime(value) : '00:00'); popover.current?.showPopover(); } }}><svg className="calendar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg></button>
    </div>{!validTime(value) && <small id={`${id}-hint`} className="error">Use 24-hour time, e.g. 09:30.</small>}
    <div id={`${id}-picker`} ref={popover} popover="auto" role="dialog" aria-label={`${label} time picker`} className="calendar-popover time-popover" onToggle={event => setOpen(event.newState === 'open')} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }} onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) popover.current?.hidePopover(); }}>
      <header><strong>Choose time</strong><span>24-hour clock</span></header><output className="time-preview">{draft}</output>
      <div className="time-columns"><label>Hour<select aria-label={`${label} hour`} value={draft.slice(0, 2)} onChange={event => setDraft(`${event.target.value}:${draft.slice(3)}`)}>{Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(hour => <option key={hour}>{hour}</option>)}</select></label><label>Minute<select aria-label={`${label} minute`} value={draft.slice(3)} onChange={event => setDraft(`${draft.slice(0, 2)}:${event.target.value}`)}>{Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(minute => <option key={minute}>{minute}</option>)}</select></label></div>
      <button className="time-apply" type="button" onClick={() => pick(draft)}>Set time</button><footer><button type="button" onClick={() => pick(new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }))}>Now</button><button type="button" onClick={() => pick('00:00')}>Clear</button><button type="button" onClick={close}>Close</button></footer>
    </div>
  </div>;
}
