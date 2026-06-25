// frontend/src/components/scripton/os-workspaces.ts
import type { ComponentType } from 'react';
import { Home, PenLine, Layers, Network, Stethoscope, GitBranch, MessagesSquare, FolderKanban, Settings } from 'lucide-react';

export type OsWorkspace = { key: string; label: string; href: string; icon: ComponentType<any>; perm?: string };

export const OS_WORKSPACES: OsWorkspace[] = [
  { key: 'home',     label: 'Home',     href: '/scripton',                    icon: Home },
  { key: 'write',    label: 'Write',    href: '/scripton/reader',             icon: PenLine },
  { key: 'develop',  label: 'Develop',  href: '/scripton/studio?tab=builds',  icon: Layers },
  { key: 'canon',    label: 'Canon',    href: '/scripton/canon',              icon: Network },
  { key: 'doctor',   label: 'Doctor',   href: '/scripton/doctor',             icon: Stethoscope },
  { key: 'versions', label: 'Versions', href: '/scripton/revisions',          icon: GitBranch },
  { key: 'room',     label: 'Room',     href: '/scripton/notes',              icon: MessagesSquare },
  { key: 'slate',    label: 'Slate',    href: '/scripton/library',            icon: FolderKanban },
  { key: 'studio',   label: 'Studio',   href: '/scripton/settings',           icon: Settings, perm: 'setup' },
];

const pathOf = (href: string) => href.split('?')[0];

export function activeWorkspaceKey(pathname: string, _search?: string): string | null {
  // Develop solely owns /scripton/studio (incl. ?tab=builds and sub-routes).
  if (pathname === '/scripton/studio' || pathname.startsWith('/scripton/studio/')) return 'develop';
  // Everything else (including Studio → /scripton/settings) by longest path match.
  let bestKey: string | null = null;
  let bestLen = -1;
  for (const w of OS_WORKSPACES) {
    const p = pathOf(w.href);
    if (p === '/scripton/studio') continue; // Develop's path, handled above
    if (pathname === p || (p !== '/scripton' && pathname.startsWith(p + '/')) || (p === '/scripton' && pathname === '/scripton')) {
      if (p.length > bestLen) { bestKey = w.key; bestLen = p.length; }
    }
  }
  return bestKey;
}

const LS_KEY = 'tfm_last_filmos_route';
export function rememberFilmosRoute(pathname: string): void {
  if (!pathname || pathname.startsWith('/scripton')) return;
  try { sessionStorage.setItem(LS_KEY, pathname); } catch { /* ignore */ }
}
export function lastFilmosRoute(): string {
  try { return sessionStorage.getItem(LS_KEY) || '/home'; } catch { return '/home'; }
}
