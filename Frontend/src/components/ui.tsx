import { useEffect, useId, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export const asset = (file: string) => `/assets/${file}`;
// SVG files retain their Figma root dimensions. The background slot scales their render.
export function Art({ file, className = '', style, label }: { file: string; className?: string; style?: CSSProperties; label?: string }) {
  return <span role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={`art ${className}`} style={{ backgroundImage: `url("${asset(file)}")`, ...style }} />;
}
export function Modal({ title, children, footer, onClose, className = '', plain = false, focusOnTitleChange = false }: { title: string; children: ReactNode; footer?: ReactNode; onClose: () => void; className?: string; plain?: boolean; focusOnTitleChange?: boolean }) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    const workspace = Boolean(dialog?.closest('.admin-workspace, .staff-workspace'));
    if (workspace && !opener.current && document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
    dialog?.showModal();
    // React mounts fields before showModal; focus editable workspace fields after opening.
    if (workspace) (dialog?.querySelector<HTMLElement>('[data-initial-focus]') ?? dialog?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled])'))?.focus();
    return () => { dialog?.close(); if (workspace && opener.current?.isConnected) opener.current.focus(); };
  }, []);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog?.closest('.staff-workspace') || (focusOnTitleChange && dialog?.closest('.admin-workspace'))) {
      (dialog.querySelector<HTMLElement>('[data-initial-focus]') ?? dialog.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), .modal-body button'))?.focus();
    }
  }, [title, focusOnTitleChange]);
  return <dialog ref={ref} className={`modal ${plain ? 'plain-modal' : ''} ${className}`} onCancel={event => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }} aria-labelledby={titleId}>
    <header className="modal-header"><h2 id={titleId}>{title}</h2><button className="close-button" onClick={onClose} aria-label="Close dialog">×</button></header>
    <div className="modal-body">{children}</div>
    {footer && <footer className="modal-footer">{footer}</footer>}
  </dialog>;
}
export function Actions({ children }: { children: ReactNode }) { return <div className="actions">{children}</div>; }
export function Status({ value }: { value: string }) { return <span className={`status ${/Expiring Soon/i.test(value) ? 'expiring' : /Low/i.test(value) ? 'warning' : /Out|Expir|unusable|unsellable|Voided/i.test(value) ? 'danger' : 'success'}`}>{value}</span>; }
