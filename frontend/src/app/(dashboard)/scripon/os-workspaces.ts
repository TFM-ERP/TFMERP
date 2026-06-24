// frontend/src/app/(dashboard)/scripon/os-workspaces.ts
import type { ComponentType } from 'react';
import { Home, PenLine, Layers, Network, Stethoscope, GitBranch, MessagesSquare, FolderKanban, Settings } from 'lucide-react';

export type OsWorkspace = { key: string; label: string; href: string; icon: ComponentType<any>; perm?: string };

/** The 9 ScripON workspaces (Figma order). Routes are the real, user-confirmed surfaces.
 *  `perm` reuses the dashboard's perms keys; undefined = always shown (you're already inside ScripON). */
export const OS_WORKSPACES: OsWorkspace[] = [
  { key: 'home',     label: 'Home',     href: '/scripon',                    icon: Home },
  { key: 'write',    label: 'Write',    href: '/scripon/reader',             icon: PenLine },
  { key: 'develop',  label: 'Develop',  href: '/scripon/studio?tab=builds',  icon: Layers },
  { key: 'canon',    label: 'Canon',    href: '/scripon/canon',              icon: Network },
  { key: 'doctor',   label: 'Doctor',   href: '/scripon/doctor',             icon: Stethoscope },
  { key: 'versions', label: 'Versions', href: '/scripon/revisions',          icon: GitBranch },
  { key: 'room',     label: 'Room',     href: '/scripon/notes',              icon: MessagesSquare },
  { key: 'slate',    label: 'Slate',    href: '/scripon/library',            icon: FolderKanban },
  { key: 'studio',   label: 'Studio',   href: '/scripon/studio',             icon: Settings, perm: 'setup' },
];

const pathOf = (href: string) => href.split('?')[0];

/** Which workspace is active for the current pathname+search. Longest path match wins;
 *  /scripon/studio is Develop when ?tab=builds, else Studio. */
export function activeWorkspaceKey(pathname: string, search: string): string | null {
  const isBuildsTab = /(^|[?&])tab=builds(&|$)/.test(search || '');
  // Studio-vs-Develop share /scripon/studio — resolve by the tab first.
  if (pathname === '/scripon/studio' || pathname.startsWith('/scripon/studio/')) {
    return isBuildsTab ? 'develop' : 'studio';
  }
  let bestKey: string | null = null;
  let bestLen = -1;
  for (const w of OS_WORKSPACES) {
    const p = pathOf(w.href);
    if (p === '/scripon/studio') continue; // handled above
    if (pathname === p || (p !== '/scripon' && pathname.startsWith(p + '/')) || (p === '/scripon' && pathname === '/scripon')) {
      if (p.length > bestLen) { bestKey = w.key; bestLen = p.length; }
    }
  }
  return bestKey;
}

const LS_KEY = 'tfm_last_filmos_route';

/** Remember the last NON-ScripON route so the brand-home can return there. No-op for /scripon paths. */
export function rememberFilmosRoute(pathname: string): void {
  if (!pathname || pathname.startsWith('/scripon')) return;
  try { sessionStorage.setItem(LS_KEY, pathname); } catch { /* ignore */ }
}

/** The route the TFM brand-home returns to. Fallback '/' (e.g. deep-link straight into ScripON). */
export function lastFilmosRoute(): string {
  try { return sessionStorage.getItem(LS_KEY) || '/'; } catch { return '/'; }
}
