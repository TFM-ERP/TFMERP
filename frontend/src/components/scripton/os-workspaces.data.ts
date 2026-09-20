// frontend/src/components/scripton/os-workspaces.data.ts
//
// Pure workspace data — deliberately free of any runtime import (no React, no lucide-react, and
// nothing that reaches a `.tsx` file), so this module can be loaded directly by plain
// `node --test` (see ../../test-support/node-loader-hooks.ts and README.md in that folder for
// why that boundary exists). The icon components are attached separately, in ./os-workspaces.ts,
// which every UI consumer (ScriptOnStudio.tsx, shared/sx.tsx, (dashboard)/layout.tsx,
// useScriptonBack.ts) continues to import unchanged.
//
// This is the same `*.logic.ts` convention used elsewhere in ScriptOn (e.g.
// studio-view.logic.ts): logic and data that don't need JSX live in a JSX-free module so they
// stay directly testable under Node; the JSX-touching wrapper stays a thin `.ts`/`.tsx` layer
// on top.

export type OsWorkspace = { key: string; label: string; href: string; perm?: string; teamOnly?: boolean };

export const OS_WORKSPACES: OsWorkspace[] = [
  { key: 'home',     label: 'Home',     href: '/scripton' },
  { key: 'write',    label: 'Write',    href: '/scripton/reader' },
  { key: 'develop',  label: 'Build',    href: '/scripton/studio?tab=builds' },
  { key: 'canon',    label: 'Canon',    href: '/scripton/canon' },
  { key: 'doctor',   label: 'Doctor',   href: '/scripton/doctor' },
  { key: 'versions', label: 'Versions', href: '/scripton/revisions' },
  { key: 'room',     label: 'Room',     href: '/scripton/notes', teamOnly: true },
  { key: 'slate',    label: 'Slate',    href: '/scripton/library' },
  { key: 'studio',   label: 'Settings', href: '/scripton/settings', perm: 'setup' },
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

/** Drop team-only workspaces (e.g. Room) when in solo mode. Pure. Generic over any record shape
 * that carries an optional `teamOnly`, so it works both for the plain data here and for the
 * icon-attached OS_WORKSPACES built on top of it in ./os-workspaces.ts. */
export function filterWorkspaces<T extends { teamOnly?: boolean }>(list: T[], mode: 'team' | 'solo'): T[] {
  return list.filter((w) => !(w.teamOnly && mode === 'solo'));
}
