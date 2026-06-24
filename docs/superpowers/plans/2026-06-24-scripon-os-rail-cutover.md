# ScripON OS Rail Cutover (rail-first, flagged) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/scripon/*`, render a single ScripON shell — suppress the FilmOS chrome and upgrade the shared `SxRail` to the new Figma 9-workspace labeled rail with RBAC + a TFM brand-home that returns to the last FilmOS route — all behind one flag (`new` default, `old` instant fallback).

**Architecture:** One flag `SCRIPON_OS_SHELL` (resolved by `useScriponShellFlag()`) gates two coordinated behaviors: (1) `(dashboard)/layout.tsx` renders children-only for `/scripon` when `new` (kills the outer FilmOS rail that double-stacked); (2) the shared `SxRail` renders the new labeled 9-workspace rail when `new`, the existing 74px `RAIL10` when `old`. A tiny always-on layout effect records the last FilmOS route; the per-page TFM-logo-back reads it. No new layout-level shell (that was PR #2's double-chrome mistake). Reuses PR #2's `os-workspaces` config + last-route helpers (ported, since PR #2 is not merged).

**Tech Stack:** Next.js App Router client components, `lucide-react`, `usePathname`/`useRouter` from `next/navigation`, the existing `useLocale`/`SxRail`/`permissionsApi`. **No frontend test runner** → verification is `npx tsc --noEmit` + `npx next build` + a dev-server SSR smoke + the user's live 13-page click-through.

## Global Constraints

- **The flag gates BOTH layers from one resolved value.** Layout suppression and the `SxRail` variant both consume `useScriponShellFlag()`; they can never split (no FilmOS-hidden-but-old-rail). _(spec §2 point 3)_
- **Read `localStorage`/`window` POST-MOUNT only (`useEffect`), never during render.** Render uses the constant default `OS_SHELL_DEFAULT='new'` on SSR and first client render → no hydration mismatch. The `localStorage['scripon.osShell']` override and `tfm_perms` apply after mount. _(spec §2 point 2 — the user's explicit point; this is the bug class we already hit twice)_
- **Flag resolution order:** constant default `'new'` first; `localStorage['scripon.osShell']` (`'new'`|`'old'`) overrides post-mount. _(spec §2 point 1)_
- **FilmOS path byte-for-byte unchanged** when not `/scripon`, and when the flag is `old`. Everything new is gated on `isScripon` AND `flag==='new'`. _(spec §7)_
- **No bare `useSearchParams()` in any always-rendered component** — it breaks `next build` app-wide (`missing-suspense-with-csr-bailout`). Read the query post-mount via `window.location.search` if needed. _(prior regression)_
- **RBAC fail-open while perms unknown** (matches the dashboard's `canSee`): show a workspace unless its `perm` is set AND `perms[perm] < 1`. Read perms post-mount. _(spec §3, §7)_
- **Workspace order (Figma):** `Home · Write · Develop · Canon · Doctor · Versions · Room · Slate · Studio`; routes: Home `/scripon`, Write `/scripon/reader`, Develop `/scripon/studio?tab=builds`, Canon `/scripon/canon`, Doctor `/scripon/doctor`, Versions `/scripon/revisions`, Room `/scripon/notes`, Slate `/scripon/library`, Studio `/scripon/studio` (Studio `perm:'setup'`). _(spec §3)_
- **`old` keeps the EXACT current behavior** (FilmOS chrome + `RAIL10` 74px rail + logo→`/home`) — it is the fallback, not deleted, until the user's "go". _(spec §2, §5)_

---

### Task 1: The flag hook (`osShellFlag.ts`)

The single source of truth for the flag. Constant on render; `localStorage` override post-mount.

**Files:**
- Create: `frontend/src/components/scripon/osShellFlag.ts`

**Interfaces:**
- Produces: `OS_SHELL_DEFAULT: 'new' | 'old'` (= `'new'`); `SHELL_FLAG_KEY = 'scripon.osShell'`; `useScriponShellFlag(): 'new' | 'old'`.

- [ ] **Step 1: Write the file**

```ts
// frontend/src/components/scripon/osShellFlag.ts
'use client';
import { useState, useEffect } from 'react';

export type ShellFlag = 'new' | 'old';
export const OS_SHELL_DEFAULT: ShellFlag = 'new';
export const SHELL_FLAG_KEY = 'scripon.osShell';

/** Resolves the ScripON shell flag. Returns OS_SHELL_DEFAULT on SSR + first render
 *  (no hydration mismatch); applies a localStorage override post-mount for QA. */
export function useScriponShellFlag(): ShellFlag {
  const [flag, setFlag] = useState<ShellFlag>(OS_SHELL_DEFAULT);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(SHELL_FLAG_KEY);
      if (v === 'new' || v === 'old') setFlag(v);
    } catch { /* ignore */ }
  }, []);
  return flag;
}
```

- [ ] **Step 2: Typecheck** — `cd frontend && npx tsc --noEmit`. Expected exit 0; no error names `osShellFlag.ts`.

- [ ] **Step 3: Reasoning check** (record in commit body): render returns `'new'` (SSR + first client render identical → no mismatch); after mount, `localStorage['scripon.osShell']==='old'` flips it to `'old'`; an absent/garbage value leaves `'new'`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/scripon/osShellFlag.ts
git commit -m "feat(scripon): SCRIPON_OS_SHELL flag hook (constant default, post-mount localStorage override)"
```

---

### Task 2: Port the workspace config + last-route helpers

Bring PR #2's reusable, framework-agnostic logic to this branch, beside `SxRail`.

**Files:**
- Create: `frontend/src/components/scripon/os-workspaces.ts`

**Interfaces:**
- Produces: `OsWorkspace` type; `OS_WORKSPACES: OsWorkspace[]`; `activeWorkspaceKey(pathname, search): string | null`; `rememberFilmosRoute(pathname): void`; `lastFilmosRoute(): string`.

- [ ] **Step 1: Write the file** (ported from PR #2 `feat/scripon-os-shell`, relocated to `components/scripon/`)

```ts
// frontend/src/components/scripon/os-workspaces.ts
import type { ComponentType } from 'react';
import { Home, PenLine, Layers, Network, Stethoscope, GitBranch, MessagesSquare, FolderKanban, Settings } from 'lucide-react';

export type OsWorkspace = { key: string; label: string; href: string; icon: ComponentType<any>; perm?: string };

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

export function activeWorkspaceKey(pathname: string, search: string): string | null {
  const isBuildsTab = /(^|[?&])tab=builds(&|$)/.test(search || '');
  if (pathname === '/scripon/studio' || pathname.startsWith('/scripon/studio/')) {
    return isBuildsTab ? 'develop' : 'studio';
  }
  let bestKey: string | null = null;
  let bestLen = -1;
  for (const w of OS_WORKSPACES) {
    const p = pathOf(w.href);
    if (p === '/scripon/studio') continue;
    if (pathname === p || (p !== '/scripon' && pathname.startsWith(p + '/')) || (p === '/scripon' && pathname === '/scripon')) {
      if (p.length > bestLen) { bestKey = w.key; bestLen = p.length; }
    }
  }
  return bestKey;
}

const LS_KEY = 'tfm_last_filmos_route';
export function rememberFilmosRoute(pathname: string): void {
  if (!pathname || pathname.startsWith('/scripon')) return;
  try { sessionStorage.setItem(LS_KEY, pathname); } catch { /* ignore */ }
}
export function lastFilmosRoute(): string {
  try { return sessionStorage.getItem(LS_KEY) || '/'; } catch { return '/'; }
}
```

- [ ] **Step 2: Typecheck** — `cd frontend && npx tsc --noEmit`. Expected exit 0; no error names `os-workspaces.ts`. Confirm the lucide-react icon names resolve (build verifies too).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/scripon/os-workspaces.ts
git commit -m "feat(scripon): port OS workspace config + last-route helpers (beside SxRail)"
```

---

### Task 3: New `SxRail` variant behind the flag

`SxRail` renders the new labeled 9-workspace rail (RBAC) when `new`, the existing `RAIL10` when `old`.

**Files:**
- Modify: `frontend/src/components/scripon/ScripOnStudio.tsx` (the `SxRail` function ~247–262)

**Interfaces:**
- Consumes: `useScriponShellFlag` (Task 1), `OS_WORKSPACES`/`activeWorkspaceKey` (Task 2), existing `RAIL10`/`RAIL_ROUTES`, `useRouter`, `usePathname`, `useLocale`.
- Produces: the same `SxRail(props: { active: string; onNav?: (k: string) => void })` signature — `active` is still honored by the `old` branch; the `new` branch derives active from the route.

- [ ] **Step 1: Add imports** at the top of `ScripOnStudio.tsx`:

```ts
import { usePathname } from 'next/navigation';
import { useScriponShellFlag } from './osShellFlag';
import { OS_WORKSPACES, activeWorkspaceKey, type OsWorkspace } from './os-workspaces';
const lsGet = (k: string, fb: any) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
```

- [ ] **Step 2: Replace the `SxRail` function body** so it branches on the flag (the `old` branch is the current code verbatim):

```tsx
export function SxRail(props: { active: string; onNav?: (k: string) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, locale, setLocale } = useLocale();
  const flag = useScriponShellFlag();

  // RBAC perms — read post-mount only (no localStorage during render → no hydration mismatch). Fail-open while unknown.
  const [perms, setPerms] = useState<Record<string, number> | null>(null);
  useEffect(() => { setPerms(lsGet('tfm_perms', null)); }, []);
  // active workspace — resolve the studio?tab=builds case from a post-mount search read.
  const [osSearch, setOsSearch] = useState('');
  useEffect(() => { setOsSearch(typeof window !== 'undefined' ? window.location.search : ''); }, [pathname]);

  if (flag === 'new') {
    const canSee = (w: OsWorkspace) => !w.perm || !perms || (perms[w.perm] ?? 0) >= 1;
    const activeKey = activeWorkspaceKey(pathname, osSearch);
    return (
      <div className="rail">
        {OS_WORKSPACES.filter(canSee).map((w) => (
          <button key={w.key} className={'ritem' + (w.key === activeKey ? ' on' : '')} onClick={() => router.push(w.href)} title={t(w.label)} aria-label={t(w.label)}>
            <div className="box"><w.icon size={18} /></div><div className="lbl">{t(w.label)}</div>
          </button>
        ))}
        <button className="ritem" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')} style={{ marginTop: 'auto' }} title={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'} aria-label="Toggle language">
          <div className="box" style={{ fontWeight: 800, fontSize: 12, letterSpacing: '.5px' }}>{locale === 'ar' ? 'EN' : 'ع'}</div><div className="lbl">{locale === 'ar' ? 'English' : 'العربية'}</div>
        </button>
      </div>
    );
  }

  // ── old (fallback) — current behavior, unchanged ──
  const go = (k: string) => { const r = RAIL_ROUTES[k]; if (r) router.push(r); else if (props.onNav) props.onNav(k); };
  return (
    <div className="rail">
      {RAIL10.map((r) => (
        <button key={r.k} className={'ritem' + (r.k === props.active ? ' on' : '')} onClick={() => go(r.k)}>
          <div className="box"><svg className="ico" viewBox="0 0 24 24">{r.d}</svg></div><div className="lbl">{t(r.lbl)}</div>
        </button>
      ))}
      <button className="ritem" onClick={() => go('settings')} style={{ marginTop: 'auto' }}><div className="box"><svg className="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 13a7 7 0 000-2l2-1.5-2-3.4-2.3 1a7 7 0 00-1.7-1L15 3h-4l-.4 2.6a7 7 0 00-1.7 1l-2.3-1-2 3.4L6.6 11a7 7 0 000 2l-2 1.5 2 3.4 2.3-1a7 7 0 001.7 1L11 21h4l.4-2.6a7 7 0 001.7-1l2.3 1 2-3.4z" /></svg></div><div className="lbl">{t('Settings')}</div></button>
      <button className="ritem" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')} title={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'} aria-label="Toggle language"><div className="box" style={{ fontWeight: 800, fontSize: 12, letterSpacing: '.5px' }}>{locale === 'ar' ? 'EN' : 'ع'}</div><div className="lbl">{locale === 'ar' ? 'English' : 'العربية'}</div></button>
    </div>
  );
}
```

> Ensure `useState`/`useEffect` are imported in `ScripOnStudio.tsx` (add to the existing `react` import if missing). The `old` branch must remain byte-identical to today's behavior.

- [ ] **Step 3: Typecheck** — `cd frontend && npx tsc --noEmit`. Expected exit 0; no new error in `ScripOnStudio.tsx`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/scripon/ScripOnStudio.tsx
git commit -m "feat(scripon): SxRail renders new 9-workspace labeled rail (RBAC) under flag; old 74px rail as fallback"
```

---

### Task 4: Suppress FilmOS chrome on `/scripon` + record last route (layout)

The layout gets out of the way for `/scripon` when `new`, and always records the last FilmOS route.

**Files:**
- Modify: `frontend/src/app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `useScriponShellFlag` (Task 1), `rememberFilmosRoute` (Task 2), existing `pathname`, `SetupGate`.

- [ ] **Step 1: Add imports** to `layout.tsx`:

```ts
import { useScriponShellFlag } from '@/components/scripon/osShellFlag';
import { rememberFilmosRoute } from '@/components/scripon/os-workspaces';
```

- [ ] **Step 2: Add the flag + last-route effect** inside `DashboardLayout`, after `const pathname = usePathname()` (alongside the other hooks — unconditional, before any return):

```tsx
const shellFlag = useScriponShellFlag();
const isScripon = pathname.startsWith('/scripon');
useEffect(() => { rememberFilmosRoute(pathname); }, [pathname]);
```

- [ ] **Step 3: Add the children-only early return** for ScripON, ABOVE the existing FilmOS `return` (so the FilmOS path is untouched). The wrapper gives the ScripON page full viewport height (its `.sx` is `height:100%`):

```tsx
if (isScripon && shellFlag === 'new') {
  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: 'var(--page-bg)' }}>
      <SetupGate>{children}</SetupGate>
    </div>
  );
}
// ...existing FilmOS return unchanged below (also serves /scripon when shellFlag === 'old')
```

> Keep `<SetupGate>` (the ScripON pages depend on it). Do NOT render any rail/top-bar/sub-tabs in this branch. The existing FilmOS return below must remain byte-identical; when `shellFlag==='old'`, `/scripon` falls through to it (current behavior).

- [ ] **Step 4: Typecheck** — `cd frontend && npx tsc --noEmit`. Expected exit 0.

- [ ] **Step 5: Commit**

```bash
git add "frontend/src/app/(dashboard)/layout.tsx"
git commit -m "feat(scripon): suppress FilmOS chrome on /scripon (flag new) + record last FilmOS route"
```

---

### Task 5: Retarget the per-page TFM-logo-back to the last FilmOS route

The brand-home (the page's `onBack`) goes to the last FilmOS route when `new`, `/home` when `old`.

**Files:**
- Create: `frontend/src/components/scripon/useScriponBack.ts`
- Modify: the `/scripon/*` `page.tsx` files that wire `onBack` (~12: doctor, reader, revisions, breakdown, library, notes, reports, schedule, settings, greenlight, approvals, studio — confirm the full set by grepping `onBack` under `app/(dashboard)/scripon/*/page.tsx`).

**Interfaces:**
- Produces: `useScriponBack(): () => void` — returns an `onBack` that pushes `lastFilmosRoute()` when the flag is `new`, else `/home`.

- [ ] **Step 1: Create the shared hook**

```ts
// frontend/src/components/scripon/useScriponBack.ts
'use client';
import { useRouter } from 'next/navigation';
import { useScriponShellFlag } from './osShellFlag';
import { lastFilmosRoute } from './os-workspaces';

/** The ScripON brand-home action: last FilmOS route when the new shell is on, else /home (old). */
export function useScriponBack(): () => void {
  const router = useRouter();
  const flag = useScriponShellFlag();
  return () => router.push(flag === 'new' ? lastFilmosRoute() : '/home');
}
```

- [ ] **Step 2: Update each `/scripon/*` page** that wires `onBack: () => router.push('/home')` to use the hook. In each `page.tsx`: add `import { useScriponBack } from '@/components/scripon/useScriponBack';`, call `const onBack = useScriponBack();` near the other hooks, and replace the inline `onBack: () => router.push('/home')` with `onBack`. (Pages that route `onBack` to `/scripon` are sub-screens — leave those as-is.)

  Example (e.g. `doctor/page.tsx`): the `common` object's `onBack: () => router.push('/home')` becomes `onBack,` where `const onBack = useScriponBack()` is declared above.

- [ ] **Step 3: Typecheck** — `cd frontend && npx tsc --noEmit`. Expected exit 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/scripon/useScriponBack.ts "frontend/src/app/(dashboard)/scripon"
git commit -m "feat(scripon): TFM-logo-back returns to last FilmOS route under the new shell"
```

---

### Task 6: Verification (build + SSR smoke; hand off the 13-page QA)

No test runner — verify by build + server-rendered evidence, then the user's live click-through.

**Files:** none (verification only).

- [ ] **Step 1: Production build** — `cd frontend && npx next build`. Expected: `✓ Compiled successfully`, static pages generated, and `grep -ciE "useSearchParams|missing-suspense|prerender-error"` over the output = **0**. (Catches any hydration/Suspense regression, as before.)

- [ ] **Step 2: Dev-server SSR smoke** — start `npx next dev --port 3212`, then:
  - `GET /scripon` (flag default `new`): HTML contains the new workspace labels (`Canon`, `Versions`, `Slate`) and does NOT contain the FilmOS rail modules (`Logistics`, `Finance` caption) — i.e. the FilmOS chrome is suppressed and the new rail renders.
  - `GET /transport` (FilmOS route): unchanged — FilmOS rail present (`Transport`, `Finance`), no ScripON rail.
  - Record marker counts in the commit body. (Note: with the flag default `new`, SSR shows the new shell; the `old` fallback is a localStorage QA toggle, not the SSR default.)
  - Stop the dev server.

- [ ] **Step 3: Hand off the live 13-page click-through** (the human acceptance gate): on each `/scripon/*` page confirm — single shell (no double rail), the 9-workspace rail with the active item highlighted, RBAC (Studio hidden for a non-admin), the TFM logo returns to the last FilmOS route (dip in from a FilmOS page → back to it), and `localStorage['scripon.osShell']='old'` instantly restores the FilmOS-chrome + 74px rail fallback. Report results; any failure → fix the owning task and re-verify.

- [ ] **Step 4: Commit** (verification notes)

```bash
git commit --allow-empty -m "test(scripon): rail cutover build-clean + SSR smoke (new rail on /scripon, FilmOS untouched)"
```

---

## Self-Review

**Spec coverage:**
- §2 flag (default new / old fallback; 3 correctness points) → Task 1 (`useScriponShellFlag`, constant-then-post-mount) + the Global Constraints. One value gates both → Tasks 3 (SxRail) + 4 (layout) consume the same hook.
- §3 files: `osShellFlag.ts` → T1; `os-workspaces.ts` port → T2; `SxRail` upgrade → T3; layout suppress + record → T4; per-page back retarget → T5.
- §3 new labeled 9-workspace rail + RBAC → T3. §3 suppress FilmOS chrome → T4. §3 brand-home → last route → T5 (+ T4 records it).
- §4 data flow (flag → layout/SxRail/back; remember/last route) → T1/T2/T4/T5.
- §5 scope: rail-first only; `old` kept; Phase-2 top bar excluded → not in any task.
- §6 verification → T6 (build + SSR smoke + 13-page QA).
- §7 risks: hydration (post-mount reads, T1/T3); suppression breadth (gated on isScripon, T4); perms in SxRail (post-mount lsGet, T3); rail width (T6 smoke/QA).

**Placeholder scan:** No TBD/TODO. New code is shown in full; the `old` SxRail branch is the current code verbatim (DRY-preserved, not a placeholder). T5's "~12 page.tsx files" names the grep to enumerate them exactly at execution — a discovery step, not a missing value. No test runner fabricated.

**Type consistency:** `ShellFlag`/`useScriponShellFlag` (T1) consumed identically in T3/T4/T5. `OsWorkspace`/`OS_WORKSPACES`/`activeWorkspaceKey`/`rememberFilmosRoute`/`lastFilmosRoute` (T2) used consistently in T3/T4/T5. `SxRail(props:{active,onNav?})` signature preserved (T3). `useScriponBack(): () => void` (T5) matches the page `onBack` shape.

**Highest-risk task:** T4 (layout). Mitigation: the FilmOS return is untouched (new branch is an early return gated on `isScripon && flag==='new'`); the build + SSR smoke confirm FilmOS routes are unchanged and `/scripon` shows the single shell.
