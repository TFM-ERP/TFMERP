# ScripON OS Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inside `/scripon/*`, the dashboard presents a nested OS shell — the left rail shows the 9 ScripON workspaces (RBAC-filtered) and the top-left brand becomes a TFM-logo "home" affordance back to FilmOS — by conditionally swapping the rail's data and brand inside the existing `(dashboard)/layout.tsx`, reusing all its responsive/perms/theme scaffolding.

**Architecture:** One conditional (`isScripon = pathname.startsWith('/scripon')`) in `frontend/src/app/(dashboard)/layout.tsx` drives the ScripON shell. The rail's data source swaps (FilmOS `MODULES`/`GROUPS` → the 9 OS workspaces) inside the same `<aside>` scaffolding (Task 3). For the brand placement, the ScripON branch renders a **full-width OS top bar** (TFM brand-home at the left, spanning above the rail+content) and a restructured return — `[full-width top bar] / [rail | content]` — to match the Figma + spec (Task 4); the rail's own brand header is omitted for ScripON (the brand lives in the top bar). The shared rail `<aside>`, `<main>` content, and phone bottom-nav are extracted to reusable render expressions so **the FilmOS return path stays byte-for-byte identical**. The mobile drawer, tablet icon-strip, theme palette `pal`, and the `perms` filter are reused unchanged.

**Tech Stack:** Next.js (App Router) + React client component, `lucide-react` icons, `usePathname`/`useRouter`/`useSearchParams` from `next/navigation`, Tailwind + inline styles matching the existing layout. **No frontend test runner exists** — verification is `npx tsc --noEmit` + required browser checks.

## Global Constraints

- **Gate everything behind `isScripon`.** The FilmOS (non-`/scripon`) branch must be byte-for-byte behaviorally unchanged; the conditional is purely additive and reversible. _(spec §2, §10)_
- **Reuse scaffolding, don't rebuild.** Use the existing `<aside>`, mobile drawer, tablet icon-strip, phone bottom-nav, `pal` palette, and `canSee`/`perms` filter. No new responsive variants. _(spec §2, §7; user decision)_
- **The four baked-in refinements:** (#1) Develop routes to the **real** Builder surface `/scripon/studio?tab=builds` (builds/intake are retired); (#2) on phones the 9 workspaces live in the **drawer**, the bottom-nav shows **≤4** + a "More" drawer button — never 9 tabs; (#3) RBAC reuses the existing `perms` object — Studio gated on the `setup` key, others fail-open while perms load; (#4) last-FilmOS-route tracking via `sessionStorage` (key `tfm_last_filmos_route`), fallback `/`, **never stores a `/scripon/*` path**. _(user, 2026-06-24)_
- **Brand-home a11y (verbatim from the visual spec):** `<button aria-label="Back to FilmOS">`, visible focus ring, hover/focus shows a "Back to FilmOS ↩" tooltip, gold-wash on hover/focus, wordmark→gold; no arrow, no rail exit item. It lives at the **left of the full-width OS top bar**. _(spec §5; `design-tmp/scripon-tfm-brand-home.html`)_
- **Full-width OS top bar (Figma authority).** On `/scripon`, the top bar spans the full width above the rail+content (not the FilmOS two-column `[rail | (header+content)]`). The ScripON return path is restructured; the FilmOS return path must remain byte-for-byte identical (extract shared rail/content/bottom-nav, don't duplicate-and-diverge). No FilmOS sub-tabs row on `/scripon`. _(spec §5; user, 2026-06-24)_
- **Workspace order (Figma authority):** `Home · Write · Develop · Canon · Doctor · Versions · Room · Slate · Studio`. _(spec §4)_
- **Resolved route map:** Home `/scripon` · Write `/scripon/reader` · Develop `/scripon/studio?tab=builds` · Canon `/scripon/canon` · Doctor `/scripon/doctor` · Versions `/scripon/revisions` · Room `/scripon/notes` · Slate `/scripon/library` · Studio `/scripon/studio`. _(user-confirmed)_
- **Deferred (out of scope this pass):** the ScripON top-bar right side — continuity ring, version picker, collaborator avatars — AND the project name in the brand cluster (all need current-script context). This pass keeps the existing top-bar right side and uses the static "ScripON" app label. _(spec §8; user-confirmed)_
- **Gold + tokens:** TFM gold `#b08d4f` / `#C6A463`–`#E6D2A2` for the mark; use the existing `pal` palette + CSS tokens for everything else. _(layout.tsx:181; visual spec)_

**Shared symbols already in `layout.tsx` (consume, don't redefine):** `pathname`, `router`, `perms`, `pal`, `expanded`, `isMobile`, `isPhone`, `mobileOpen`, `setMobileOpen`, `RAIL_W`, `t` (i18n), `GROUPS`, `MODULES`, `canSee(key)`, `railBtn(m)`, `bottomNav`, `activeMkey`, `activeModule`, the rail `<aside>` (lines ~460–533, brand header ~462–479, grouped `<nav>` ~482–493), the phone bottom-nav (~642–657). `Module = { key: string; label: string; icon: ComponentType; pages: { label: string; href: string; divider?: boolean }[] }`.

---

### Task 1: OS workspace data + pure helpers (`os-workspaces.ts`)

The single source of truth for the OS rail: the 9 workspaces (with real routes + icons + perm keys), the active-workspace resolver, and the last-FilmOS-route helpers. All pure — no React, no DOM beyond `sessionStorage`.

**Files:**
- Create: `frontend/src/app/(dashboard)/scripon/os-workspaces.ts`

**Interfaces:**
- Produces:
  - `type OsWorkspace = { key: string; label: string; href: string; icon: ComponentType<any>; perm?: string }`
  - `OS_WORKSPACES: OsWorkspace[]` — the 9, in order, with the resolved routes.
  - `activeWorkspaceKey(pathname: string, search: string): string | null` — longest-route match; disambiguates Develop (`/scripon/studio` + `tab=builds`) from Studio (`/scripon/studio` without it).
  - `rememberFilmosRoute(pathname: string): void` — store in `sessionStorage` only when `pathname` is NOT under `/scripon`.
  - `lastFilmosRoute(): string` — read it; fallback `'/'`.

- [ ] **Step 1: Write the file**

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0, no error referencing `os-workspaces.ts`. (If the repo has pre-existing unrelated tsc errors, confirm none name this file.)

- [ ] **Step 3: Reasoning check (no test runner)**

Trace by hand and record in the commit body: `activeWorkspaceKey('/scripon/studio','?tab=builds')==='develop'`; `activeWorkspaceKey('/scripon/studio','')==='studio'`; `activeWorkspaceKey('/scripon/reader','')==='write'`; `activeWorkspaceKey('/scripon','')==='home'`; `rememberFilmosRoute('/finance/invoices')` stores it; `rememberFilmosRoute('/scripon/canon')` is a no-op; `lastFilmosRoute()` returns `'/'` when unset.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/(dashboard)/scripon/os-workspaces.ts"
git commit -m "feat(scripon): OS workspace data + active-resolver + last-route helpers"
```

---

### Task 2: Canon stub page (`/scripon/canon`)

The rail links to `/scripon/canon`, which has no page yet. Add a minimal stub so the link isn't a 404. The real Canon screen (graph) is a later effort.

**Files:**
- Create: `frontend/src/app/(dashboard)/scripon/canon/page.tsx`

**Interfaces:**
- Produces: a default-exported page component at route `/scripon/canon`.

- [ ] **Step 1: Write the stub** (match the simple page conventions; tokens, not hardcoded colors)

```tsx
// frontend/src/app/(dashboard)/scripon/canon/page.tsx
'use client';
export default function ScripOnCanonStub() {
  return (
    <div style={{ padding: '40px 28px', maxWidth: 760 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--gold, #b08d4f)' }}>
        ScripON · Canon
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: '8px 0 6px' }}>Living Canon</h1>
      <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
        The story-memory graph — characters, world, lore, timeline and relationships, enforced on every
        generation. The Canon workspace UI is coming next; the canon kernel that powers it is already in place.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck** — `cd frontend && npx tsc --noEmit`. Expected: exit 0, no error naming `canon/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add "frontend/src/app/(dashboard)/scripon/canon/page.tsx"
git commit -m "feat(scripon): Canon workspace stub page (rail target)"
```

---

### Task 3: Conditional OS rail (data swap + RBAC + active) in the layout

When `isScripon`, the rail renders the 9 workspaces through the existing `<aside>`/drawer scaffolding instead of the FilmOS groups. FilmOS routes are untouched.

**Files:**
- Modify: `frontend/src/app/(dashboard)/layout.tsx` (the `<aside>` grouped `<nav>` ~482–493; add the `isScripon` flag, an `osRailBtn`, and the OS workspace filter near `canSee`/`bottomNav` ~447–451)

**Interfaces:**
- Consumes: `OS_WORKSPACES`, `activeWorkspaceKey` (Task 1); existing `pal`, `expanded`, `router`, `perms`, `t`, `useSearchParams`.
- Produces: the rail rendering the 9 workspaces on `/scripon/*`; an active workspace highlighted; Studio hidden without `setup` perm.

- [ ] **Step 1: Add imports + derived state** near the top of the component (after `const pathname = usePathname()`):

```tsx
import { useSearchParams } from 'next/navigation';
import { OS_WORKSPACES, activeWorkspaceKey, rememberFilmosRoute, lastFilmosRoute, type OsWorkspace } from './scripon/os-workspaces';
// ...inside the component:
const searchParams = useSearchParams();
const isScripon = pathname.startsWith('/scripon');
const osActiveKey = isScripon ? activeWorkspaceKey(pathname, searchParams?.toString() ?? '') : null;
const canSeeOs = (w: OsWorkspace) => !w.perm || !perms || (perms[w.perm] ?? 0) >= 1;
const osVisible = OS_WORKSPACES.filter(canSeeOs);
```

- [ ] **Step 2: Add `osRailBtn`** next to `railBtn` (~line 441). It mirrors `railBtn`'s styling but uses workspace active + `router.push(href)`:

```tsx
const osRailBtn = (w: OsWorkspace) => {
  const on = w.key === osActiveKey;
  return (
    <button key={w.key} onClick={() => router.push(w.href)} title={t(w.label)} aria-label={t(w.label)}
      className="relative flex items-center rounded-md mx-1.5 my-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2"
      style={{
        padding: expanded ? '7px 10px' : '10px 0',
        justifyContent: expanded ? 'flex-start' : 'center',
        gap: 10,
        background: on ? pal.activeBg : 'transparent',
        color: on ? pal.activeText : pal.item,
        fontWeight: on ? 500 : 400,
      }}
      onMouseEnter={e => { if (!on) { (e.currentTarget as HTMLElement).style.background = pal.itemHover; (e.currentTarget as HTMLElement).style.color = pal.itemHoverText; } }}
      onMouseLeave={e => { if (!on) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = pal.item; } }}
    >
      <w.icon size={18} style={{ flexShrink: 0 }} />
      {expanded && <span className="text-[13px] truncate">{t(w.label)}</span>}
    </button>
  );
};
```

- [ ] **Step 3: Branch the grouped `<nav>`** (~482–493) so it renders OS workspaces on `/scripon`:

```tsx
<nav className="flex-1 overflow-y-auto py-1.5" style={{ scrollbarWidth: 'none' }}>
  {isScripon ? (
    <div>
      {expanded && <div className="px-3.5 pt-3 pb-1 text-[10.5px]" style={{ color: pal.cap, letterSpacing: '.04em' }}>{t('Script OS')}</div>}
      {osVisible.map(osRailBtn)}
    </div>
  ) : (
    GROUPS.map(g => {
      const keys = g.keys.filter(canSee);
      if (!keys.length) return null;
      return (
        <div key={g.caption}>
          {expanded && <div className="px-3.5 pt-3 pb-1 text-[10.5px]" style={{ color: pal.cap, letterSpacing: '.04em' }}>{t(g.caption)}</div>}
          {keys.map(k => railBtn(MODULES.find(m => m.key === k)!))}
        </div>
      );
    })
  )}
</nav>
```

- [ ] **Step 4: Typecheck** — `cd frontend && npx tsc --noEmit`. Expected: exit 0; no new errors in `layout.tsx`.

- [ ] **Step 5: Commit**

```bash
git add "frontend/src/app/(dashboard)/layout.tsx"
git commit -m "feat(scripon): conditional OS workspace rail on /scripon (RBAC-filtered, reuses scaffolding)"
```

---

### Task 4: Full-width OS top bar + brand-home + layout restructure

On `/scripon`, render a **full-width OS top bar** (TFM brand-home at the left, spanning above the rail+content) by restructuring the component's return into shared pieces + two wrappers. The FilmOS return must stay behaviorally identical. The rail's own brand header is reduced to just the collapse toggle on ScripON (the brand now lives in the top bar). Also track the last FilmOS route.

**Files:**
- Modify: `frontend/src/app/(dashboard)/layout.tsx` (the return JSX ~453–690; the rail brand header ~462–479; add one `useEffect` + the shared consts just above the `return`)

**Interfaces:**
- Consumes: `rememberFilmosRoute`, `lastFilmosRoute` (Task 1); `isScripon`, `expanded`, `router`, `pal`, `isPhone`, `isMobile`, `mobileOpen`, `setPaletteOpen`, `setQuery`, `setLocale`, `isRTL`, `themeMenuOpen`/`setThemeMenuOpen`, `setThemeTo`, `theme`, `darkMode`, `THEME_MENU`, `NotificationBell`, `GOLD`, `t`, `SetupGate`, `PwaRegister`.

- [ ] **Step 1: Track the last FilmOS route** — add alongside the other `pathname` effects:

```tsx
useEffect(() => { rememberFilmosRoute(pathname); }, [pathname]);
```

- [ ] **Step 2: Reduce the rail brand header to toggle-only on ScripON.** In the rail brand header (~462–479), wrap the logo block (`logoSrc`/`fallbackLogo`, ~463–475) so it renders **only when `!isScripon`**; on ScripON the header shows just the existing collapse-toggle button (~476, unchanged). (The brand moves to the OS top bar in Step 4.) Example:

```tsx
{!isScripon && (expanded ? ( /* existing expanded logo block, unchanged */ ) : ( /* existing collapsed logo block, unchanged */ ))}
{/* the existing collapse-toggle <button> stays here, for both branches */}
```

- [ ] **Step 3: Extract the shared shell pieces into consts** just above the `return` — move the EXISTING JSX verbatim (no behavior change), so both wrappers reuse them:

```tsx
// Move the existing JSX blocks into these consts (cut from the current return, paste verbatim):
const scrimEl = isMobile && mobileOpen ? ( /* existing mobile-drawer scrim div (~457) */ ) : null;
const railAside = ( /* the existing <aside>…</aside> block (~460–533), unchanged */ );
const mainEl = (
  <main className="flex-1 overflow-y-auto" style={{ paddingBottom: isPhone ? 60 : undefined }}>
    <SetupGate>{children}</SetupGate>
  </main>
);
const bottomNavEl = isPhone ? ( /* the existing phone bottom-nav <nav>…</nav> (~642–658) */ ) : null;
const paletteEl = paletteOpen ? ( /* the existing ⌘K palette overlay (~664–689) */ ) : null;

// The right-side controls cluster — extract from the FilmOS header (~561–604) verbatim, reused by both bars:
const searchButton = (
  <button onClick={() => { setPaletteOpen(true); setQuery(''); }}
    className="flex items-center gap-2 text-sm rounded-lg px-3 h-8 transition-colors w-[230px] shrink-0"
    style={{ color: 'var(--text-3)', background: 'var(--surface-2)', border: '1px solid var(--border-1)' }}>
    <Search size={14} />
    <span className="text-[12.5px] truncate">{t('Search or jump…')}</span>
    <span className="ms-auto text-[11px] rounded px-1.5 py-0.5" style={{ color: 'var(--text-3)', border: '1px solid var(--border-1)' }}>⌘K</span>
  </button>
);
const topbarRightControls = ( /* the language button + theme menu + <NotificationBell/> from ~573–604, unchanged */ );
```

> The FilmOS `<header>` (~541–605) is then rewritten to use `{searchButton}` and `{topbarRightControls}` in place of its inline copies — same elements, same order, no visual change. Keep the FilmOS breadcrumb and sub-tabs exactly as they are.

- [ ] **Step 4: Build the full-width OS top bar** (`osTopBar`) — brand-home at the left, ⌘K centered, controls at the right. Add `const [brandHover, setBrandHover] = useState(false)` near the other `useState`s:

```tsx
const brandHome = (
  <div style={{ position: 'relative' }}>
    <button
      onClick={() => router.push(lastFilmosRoute())}
      aria-label="Back to FilmOS" title="Back to FilmOS"
      onMouseEnter={() => setBrandHover(true)} onMouseLeave={() => setBrandHover(false)}
      onFocus={() => setBrandHover(true)} onBlur={() => setBrandHover(false)}
      className="flex items-center gap-2.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2"
      style={{ padding: '6px 8px',
        background: brandHover ? 'rgba(198,164,99,0.10)' : 'transparent',
        border: `1px solid ${brandHover ? 'rgba(198,164,99,0.30)' : 'transparent'}` }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, flex: 'none', display: 'grid', placeItems: 'center',
        background: 'linear-gradient(155deg,#E6D2A2,#C6A463)', color: '#15120B', fontWeight: 800, fontSize: 11, letterSpacing: '.3px' }}>TFM</span>
      <span style={{ fontFamily: 'Fraunces, serif', fontSize: 16, fontWeight: 600, color: brandHover ? '#E6D2A2' : 'var(--text-1)' }}>ScripON</span>
    </button>
    {brandHover && (
      <div role="tooltip" style={{ position: 'absolute', top: 'calc(100% + 6px)', insetInlineStart: 6, zIndex: 70,
        background: 'var(--surface-1)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '6px 11px',
        fontSize: 11.5, color: 'var(--text-1)', whiteSpace: 'nowrap', boxShadow: '0 10px 24px -10px rgba(0,0,0,.5)' }}>
        Back to <b style={{ color: '#C6A463' }}>FilmOS</b> ↩
      </div>
    )}
  </div>
);
const osTopBar = (
  <header className="flex items-center gap-2 px-4 h-12 shrink-0" style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-1)' }}>
    {isMobile && <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="p-1 -ms-1 shrink-0" style={{ color: 'var(--text-2)' }}><Menu size={20} /></button>}
    {brandHome}
    <div className="flex-1" />
    {searchButton}
    <div className="flex-1" />
    {topbarRightControls}
  </header>
);
```

- [ ] **Step 5: Add the ScripON return path** (early return ABOVE the existing FilmOS `return`); the FilmOS `return` below reuses the same consts:

```tsx
if (isScripon) {
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--page-bg)' }}>
      {osTopBar}
      <div className="flex flex-1 min-h-0">
        {scrimEl}
        {railAside}
        <div className="flex-1 flex flex-col min-w-0">{mainEl}</div>
      </div>
      {bottomNavEl}
      <PwaRegister />
      {paletteEl}
    </div>
  );
}

return (
  <div className="flex h-screen overflow-hidden" style={{ background: 'var(--page-bg)' }}>
    {scrimEl}
    {railAside}
    <div className="flex-1 flex flex-col min-w-0">
      { /* existing FilmOS <header> (now using {searchButton}/{topbarRightControls}) */ }
      { /* existing sub-tabs row */ }
      {mainEl}
    </div>
    {bottomNavEl}
    <PwaRegister />
    {paletteEl}
  </div>
);
```

- [ ] **Step 6: Typecheck** — `cd frontend && npx tsc --noEmit`. Expected: exit 0, no new errors in `layout.tsx`.

- [ ] **Step 7: Commit**

```bash
git add "frontend/src/app/(dashboard)/layout.tsx"
git commit -m "feat(scripon): full-width OS top bar + TFM brand-home (→ last FilmOS route), FilmOS path unchanged"
```

> **Reviewer focus:** confirm the FilmOS return path renders the same elements in the same order as before the extraction (no visual/behavioral change off `/scripon`), and that `railAside` is the single shared `<aside>` (its nav already branches on `isScripon` from Task 3, its brand header is toggle-only on ScripON from Step 2).

---

### Task 5: Mobile drawer (9 workspaces) + bottom-nav stays ≤4 (#2)

On `/scripon`, the phone bottom-nav must NOT try to show 9 workspace tabs — the 9 live in the drawer (the `<aside>`, which is already the off-canvas drawer on mobile via Task 3). The bottom-nav shows ≤4 primary workspaces + the existing "More" button that opens the drawer.

**Files:**
- Modify: `frontend/src/app/(dashboard)/layout.tsx` (the `bottomNav` derivation ~451 and the phone bottom-nav render ~642–657)

**Interfaces:**
- Consumes: `OS_WORKSPACES`, `osVisible`, `osActiveKey`, `isScripon`; existing `bottomNav`, `isPhone`, `setMobileOpen`, `pal`, `GOLD`, `t`.

- [ ] **Step 1: Provide a ScripON bottom-nav source** — next to `bottomNav` (~451), add the ScripON variant (first 4 visible workspaces; the drawer holds all 9):

```tsx
const osBottomNav = osVisible.slice(0, 4); // primary 4: Home, Write, Develop, Canon (or fewer if RBAC-hidden)
```

- [ ] **Step 2: Branch the phone bottom-nav render** (~644) so it maps OS workspaces on `/scripon` (router.push) and FilmOS modules elsewhere (`goModule`). The trailing "More" button (opens the drawer) stays for both:

```tsx
{(isScripon ? osBottomNav.map(w => {
  const on = w.key === osActiveKey;
  return (
    <button key={w.key} onClick={() => router.push(w.href)} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2" style={{ color: on ? GOLD : pal.item }}>
      <w.icon size={19} />
      <span className="text-[9px] truncate max-w-[64px]">{t(w.label)}</span>
    </button>
  );
}) : bottomNav.map(m => {
  const on = m.key === activeMkey;
  return (
    <button key={m.key} onClick={() => goModule(m)} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2" style={{ color: on ? GOLD : pal.item }}>
      <m.icon size={19} />
      <span className="text-[9px] truncate max-w-[64px]">{t(m.label)}</span>
    </button>
  );
}))}
{/* existing "More" button unchanged — opens the drawer with all 9 */}
```

- [ ] **Step 3: Typecheck** — `cd frontend && npx tsc --noEmit`. Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/(dashboard)/layout.tsx"
git commit -m "feat(scripon): phone bottom-nav shows 4 primary workspaces + More-drawer (9 live in the drawer)"
```

---

### Task 6: Browser verification (the acceptance gate)

No test runner — this layout change is verified in a real browser at all breakpoints. Capture screenshots and record results.

**Files:** none (verification only).

- [ ] **Step 1: Build/serve the frontend.** Run the project's dev server (e.g. `cd frontend && npm run dev`) or use the `run` skill. Confirm it compiles with no errors.

- [ ] **Step 2: Desktop checks** (capture a screenshot each):
  - `/scripon` and `/scripon/reader`: rail shows the 9 workspaces in order; the active one is highlighted (`/scripon/reader` → Write active; `/scripon/studio?tab=builds` → Develop active; `/scripon/studio` → Studio active).
  - A non-ScripON route (e.g. `/finance/invoices`): rail is the **unchanged** FilmOS rail.
  - Top-left shows the **TFM mark + "ScripON"**; hover/focus → gold wash + "Back to FilmOS ↩" tooltip + focus ring (Tab to it).
  - From `/finance/invoices`, navigate into `/scripon/...`, click the TFM mark → lands back on `/finance/invoices`. Then hard-load `/scripon/canon` directly → TFM mark → lands on `/` (fallback).
  - With a non-admin role (no `setup` perm), Studio is hidden from the rail; with admin, it shows.

- [ ] **Step 3: Tablet/mobile checks:**
  - Tablet width: rail collapses to the icon-strip showing the 9 workspace icons (reused scaffolding).
  - Phone width: the bottom-nav shows ≤4 workspace tabs + "More"; tapping "More" opens the drawer listing all 9; the TFM mark in the drawer/header returns to FilmOS.

- [ ] **Step 4: Record results** in the commit body / report: which checks passed, with screenshot references. Any failure → fix the owning task and re-verify before declaring done.

- [ ] **Step 5: Commit** (verification notes / screenshots if stored in-repo; otherwise this is a no-op commit-free step and the gate is the recorded results):

```bash
git commit --allow-empty -m "test(scripon): OS shell browser-verified at desktop/tablet/mobile"
```

---

## Self-Review

**Spec coverage:**
- §2 nested shell in existing layout → Tasks 3 (rail), 4 (full-width top bar + restructure), 5 (mobile) — all gated on `isScripon`; FilmOS return path byte-identical via extracted shared consts.
- §3 files: `os-workspaces.ts` → Task 1; layout edits → Tasks 3–5; `scripon/layout.tsx`/`MODULES` untouched ✓; Canon stub (Task 2) added to avoid a 404 — justified.
- §4 the 9 workspaces + order → Task 1 `OS_WORKSPACES`.
- §5 TFM brand-home in the **full-width OS top bar** (markup, states, a11y, last-route, fallback, never-store-/scripon) → Tasks 1 (helpers) + 4 (top bar + brand-home + effect). Rail brand header is toggle-only on ScripON.
- §6 RBAC (reuse perms; Studio on `setup`; fail-open) → Tasks 1 (`perm` field) + 3 (`canSeeOs`).
- §7 responsive reuse → Tasks 3 (drawer/icon-strip via shared `railAside`) + 5 (bottom-nav ≤4).
- §8 scope: continuity/version/collaborators + project name deferred → noted in Global Constraints; not built (the OS top bar centers ⌘K + reuses the existing right controls only).
- §9 browser verification → Task 6 (now also: confirm FilmOS path unchanged after the restructure).
- The four refinements: #1 Develop→`/scripon/studio?tab=builds` (Task 1); #2 mobile drawer not 9 tabs (Task 5); #3 RBAC (Tasks 1/3); #4 last-route (Tasks 1/4). All first-class.

**Placeholder scan:** No TBD/TODO. No test-runner is fabricated — verification is `tsc` + browser (honest given no frontend test infra). New code (osTopBar, brandHome, searchButton, the return wrappers) is shown in full; "move the existing `<aside>`/bottom-nav/palette block verbatim into a const" references concrete existing code (a DRY extraction, not a placeholder) rather than re-pasting ~200 lines of unchanged JSX.

**Type consistency:** `OsWorkspace` (key/label/href/icon/perm?) is used identically in Tasks 1, 3, 5. `activeWorkspaceKey`/`rememberFilmosRoute`/`lastFilmosRoute` signatures match between Task 1 and their call sites (Tasks 3/4). `osRailBtn`/`canSeeOs`/`osVisible`/`osActiveKey`/`osBottomNav` (Task 3) and `scrimEl`/`railAside`/`mainEl`/`bottomNavEl`/`paletteEl`/`searchButton`/`topbarRightControls`/`osTopBar`/`brandHome`/`brandHover` (Task 4) are each defined once and consumed consistently.

**Risk note (restructure):** Task 4 restructures the component's return (extract shared pieces + two wrappers). This is the highest-risk task. Mitigation: the extraction moves existing JSX verbatim, the FilmOS wrapper renders identical children in identical order, and the reviewer + browser check explicitly verify no FilmOS regression.

**Known follow-ons (not silent cuts):** real Canon workspace screen (Task 2 is a stub); the deferred top-bar right side + project name; if you later want the exact Figma full-width top bar (brand spanning above rail+content) rather than the brand in the rail header, that's a structural follow-on.
