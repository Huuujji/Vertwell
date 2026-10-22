import type { Page } from '../components/Navigation';

export const pagePaths: Record<Page, string> = { Dashboard: '/Dashboard', Inventory: '/Inventory', POS: '/POS', Reports: '/Reports', 'Audit Trail': '/Audit-Trail', Users: '/Users' };
export function pageFromPath(path: string, manager: boolean): Page {
  const page = (Object.keys(pagePaths) as Page[]).find(page => pagePaths[page].toLowerCase() === path.replace(/\/$/, '').toLowerCase());
  return page && (manager || page === 'POS' || page === 'Audit Trail') ? page : manager ? 'Dashboard' : 'POS';
}
