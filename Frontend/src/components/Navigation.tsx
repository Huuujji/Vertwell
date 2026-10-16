import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { asset } from './ui';
import type { Role } from '../data/demo';

export type Page = 'Dashboard' | 'Inventory' | 'POS' | 'Reports' | 'Audit Trail' | 'Users';
export const pages: Page[] = ['Dashboard', 'Inventory', 'POS', 'Reports', 'Audit Trail', 'Users'];
type Layout = 'desktop' | 'tablet' | 'mobile';
type IconName = Page | 'menu' | 'close' | 'logout' | 'account';

const icons: Record<IconName, ReactNode> = {
  Dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  Inventory: <><path d="m12 3 9 5-9 5-9-5 9-5Z M3 8v9l9 5 9-5V8 M12 13v9 M7.5 5.5l9 5" /></>,
  POS: <><rect x="4" y="3" width="16" height="14" rx="2" /><path d="M8 21h8 M12 17v4 M8 7h8 M8 11h3 M15 11h1" /></>,
  Reports: <><path d="M4 3v18h17 M8 16v-5 M13 16V7 M18 16v-8" /></>,
  'Audit Trail': <><path d="M4 11a8 8 0 1 1 2 7 M4 5v6h6 M12 7v5l3 2" /></>,
  Users: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3 M16 4a3 3 0 0 1 0 6 M18 13a5 5 0 0 1 3 5v3" /></>,
  menu: <path d="M4 6h16 M4 12h16 M4 18h16" />,
  close: <path d="m6 6 12 12 M6 18 18 6" />,
  logout: <><path d="M10 4H4v16h6 M9 12h12 m-4-4 4 4-4 4" /></>,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
};
function Icon({ name }: { name: IconName }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}
function layoutForWidth(): Layout {
  return window.matchMedia('(min-width: 1200px)').matches ? 'desktop' : window.matchMedia('(min-width: 768px)').matches ? 'tablet' : 'mobile';
}
function Brand() {
  return <header className="nav-brand"><img src={asset('be809.png')} alt="Happy Hentie Hobbies" /><div><strong>Happy Hentie</strong><span>Café &amp; Hobby Shop</span><small>Sample data · resets on refresh</small></div></header>;
}
function Drawer({ children, open, onClose, trigger }: { children: ReactNode; open: boolean; onClose: () => void; trigger: RefObject<HTMLButtonElement | null> }) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const dialog = ref.current!;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      const target = trigger.current;
      if (target?.isConnected && target.getClientRects().length) target.focus();
      else document.querySelector<HTMLButtonElement>('.desktop-navigation [aria-current="page"]')?.focus();
    };
  }, [open, trigger]);
  return <dialog ref={ref} id="navigation-drawer" className="navigation-drawer" aria-labelledby="navigation-title" onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => {
    // Keep keyboard cycling inside the drawer, including the browser's Tab boundary.
    if (event.key !== 'Tab') return;
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }}>
    <div className="drawer-heading"><h2 id="navigation-title">Navigation</h2><button className="nav-control" aria-label="Close navigation" autoFocus onClick={onClose}><Icon name="close" /></button></div>
    {children}
  </dialog>;
}

export default function Navigation({ identity, destinations, activePage, onNavigate, onLogout }: {
  identity: { role: Role; name: string }; destinations: Page[]; activePage: Page; onNavigate: (page: Page) => void; onLogout: () => void;
}) {
  const [layout, setLayout] = useState<Layout>(layoutForWidth);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1200px)');
    const tablet = window.matchMedia('(min-width: 768px)');
    function update() { setOpen(false); setLayout(layoutForWidth()); }
    desktop.addEventListener('change', update);
    tablet.addEventListener('change', update);
    return () => { desktop.removeEventListener('change', update); tablet.removeEventListener('change', update); };
  }, []);
  const label = (page: Page) => identity.role === 'Staff' && page === 'Audit Trail' ? 'Today’s Sales History' : page;
  function navigate(page: Page) { onNavigate(page); setOpen(false); }
  const links = (compact = false) => <nav aria-label={compact ? 'Quick navigation' : 'Main navigation'} className="nav-destinations">{destinations.map(page => <button key={page} className={`nav-destination ${page === activePage ? 'active' : ''}`} aria-label={label(page)} aria-current={page === activePage ? 'page' : undefined} onClick={() => navigate(page)}>
    <Icon name={page} /><span className={compact ? 'nav-tooltip' : 'nav-label'}>{label(page)}</span>
  </button>)}</nav>;
  const account = <footer className="nav-account"><div className="nav-identity"><span className="nav-avatar"><Icon name="account" /></span><div><strong>{identity.name}</strong><span>{identity.role}</span></div></div><button className="nav-logout" onClick={() => { setOpen(false); onLogout(); }}><Icon name="logout" /><span>Log out</span></button></footer>;
  const fullNavigation = <><Brand /><p className="nav-section-label">{identity.role === 'Staff' ? 'Your workspace' : 'Manage your shop'}</p>{links()}{account}</>;
  if (layout === 'desktop') return <aside className="desktop-navigation">{fullNavigation}</aside>;
  return <>
    {layout === 'mobile' ? <header className="mobile-topbar" inert={open} aria-hidden={open || undefined}><button className="nav-control" aria-label="Open navigation" aria-expanded={open} aria-controls="navigation-drawer" onClick={event => { trigger.current = event.currentTarget; setOpen(true); }}><Icon name="menu" /></button><img src={asset('be809.png')} alt="Happy Hentie Hobbies" /><div><span>Happy Hentie</span><strong>{label(activePage)}</strong><small>Sample data · resets on refresh</small></div></header> :
      <aside className="tablet-navigation" inert={open} aria-hidden={open || undefined}><div className="rail-brand"><img className="rail-logo" src={asset('be809.png')} alt="Happy Hentie Hobbies" /><small>Sample data</small></div><button className="nav-control rail-menu" aria-label="Open navigation" aria-expanded={open} aria-controls="navigation-drawer" onClick={event => { trigger.current = event.currentTarget; setOpen(true); }}><Icon name="menu" /><span className="nav-tooltip">Open navigation</span></button>{links(true)}<button className="nav-control rail-account" aria-label={`Account: ${identity.name}. Open navigation`} aria-expanded={open} aria-controls="navigation-drawer" onClick={event => { trigger.current = event.currentTarget; setOpen(true); }}><Icon name="account" /><span className="nav-tooltip">{identity.name} · {identity.role}</span></button></aside>}
    <Drawer open={open} trigger={trigger} onClose={() => setOpen(false)}>{fullNavigation}</Drawer>
  </>;
}
