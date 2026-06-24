# ScripON OS Rail — Flagged Cutover (rail-first)

_Design spec. Status: approved (2026-06-24). Replaces the PR #2 layout-shell approach (`feat/scripon-os-shell`, do NOT merge) after the double-chrome diagnosis. Phase 1 of the OS shell: the rail + brand-home, behind a flag. The unified full-width Figma top bar is **Phase 2** (separate plan, migrates the 13 per-page top bars). Visual authority: Figma `dqUr3nasAkQIdefXcGDSyi` + `design-tmp/scripon-tfm-brand-home.html`._

## 1. Background — why rail-first, not the layout shell

`/scripon/*` is wrapped by the `(dashboard)` FilmOS layout, so it already renders the **FilmOS rail (outer) + each ScripON page's own chrome (inner)** — a self-contained per-page shell. PR #2 added a *second* ScripON-styled rail at the layout layer → double-chrome ("flash → revert" on hard refresh: SSR shows the layout shell, then `SetupGate` client-gates the page, whose own chrome mounts over it). Root cause: the ScripON pages already carry their own shell via a **shared `SxRail`** (in `ScripOnStudio.tsx`, used by 13 pages) + a per-page top bar whose **TFM logo is already a back affordance** (`onClick={onBack}`, currently → `/home`).

So the fix is not a new layer — it's: get the FilmOS layout **out of the way** for `/scripon`, and **upgrade the existing shared `SxRail`** to the new look. The ScripON page's own (upgraded) chrome becomes the single shell.

## 2. The flag — `SCRIPON_OS_SHELL` ('new' default | 'old' fallback)

One flag gates two coordinated behaviors so the shell is never half-migrated:
- **`new` (default):** (a) `(dashboard)/layout.tsx` renders **children-only** for `/scripon` (suppresses the FilmOS rail, top bar, and sub-tabs); (b) the shared **`SxRail` renders the new Figma 9-workspace labeled rail** with RBAC; (c) the per-page **TFM-logo-back → `lastFilmosRoute()`** instead of `/home`.
- **`old` (instant fallback, code kept):** the exact current behavior — FilmOS chrome present, 74px icon `SxRail`, logo → `/home`.

### Flag resolution (the three correctness points)
1. **Resolution order:** a module constant `OS_SHELL_DEFAULT = 'new'` is the SSR + initial-render value. A `localStorage['scripon.osShell']` value (`'new'` | `'old'`) overrides it for QA.
2. **Read the override post-mount only.** A `useScriponShellFlag()` hook returns the constant default during render (SSR and first client render identical → **no hydration mismatch**), then applies the `localStorage` override inside a `useEffect` after mount. Never read `localStorage`/`window` during render.
3. **One resolved value gates both.** The layout suppression and the `SxRail` variant both consume the same `useScriponShellFlag()` result, so they can never disagree (no FilmOS-rail-hidden-but-old-SxRail state, or vice-versa). Because the override applies post-mount, a QA flip causes a single coherent re-render of both.

## 3. Components & files

- **Create `frontend/src/components/scripon/osShellFlag.ts`** — `OS_SHELL_DEFAULT = 'new'`, the `localStorage` key constant, and `useScriponShellFlag(): 'new' | 'old'` (constant on render; `localStorage` override via `useEffect` + `useState` post-mount). One source of truth for the flag.
- **Port from PR #2** (copy, since PR #2 isn't merged): `os-workspaces.ts` (the 9 workspaces + real routes + lucide icons + `perm` keys) and the last-route helpers `rememberFilmosRoute`/`lastFilmosRoute`. Land them under `frontend/src/components/scripon/` (next to `SxRail`) so the rail can import them directly.
- **Modify `frontend/src/components/scripon/ScripOnStudio.tsx`** (`SxRail`) — behind the flag, render either the existing 74px icon rail (`old`, `RAIL10`/`RAIL_ROUTES` unchanged) or the **new labeled 9-workspace rail** (`new`): the `OS_WORKSPACES` list, labels + icons, active state from the current route, RBAC filter (reuse the dashboard `perms` pattern — Studio gated, others fail-open), router.push to each workspace route. The rail's brand-home is delivered via the per-page top-bar logo (below), not a rail item.
- **Modify `frontend/src/app/(dashboard)/layout.tsx`** — two flag-aware additions, nothing else: (a) when `isScripon` AND flag `new`, render **children only** (no FilmOS `<aside>`/header/sub-tabs); when `old`, render the current FilmOS layout unchanged; (b) an always-on `useEffect` recording the last non-`/scripon` route via `rememberFilmosRoute(pathname)` so the brand-home has a target. (No OS rail/top bar is added to the layout — that was PR #2's mistake.)
- **Retarget the per-page brand-home** — the ~12 consistent `onBack={() => router.push('/home')}` (and `/scripon`) wirings in the `/scripon/*` `page.tsx` files → `lastFilmosRoute()` when the flag is `new`. Keep `/home` when `old`. (A small shared helper, e.g. `scriponBackHref(flag)`, keeps this DRY across the page files.)

## 4. Data flow

`useScriponShellFlag()` → consumed by the layout (suppress vs FilmOS chrome) and by `SxRail` (new vs old) and by the page-level back wiring (last-route vs `/home`). `rememberFilmosRoute` writes `sessionStorage` on every non-`/scripon` navigation (layout effect); `lastFilmosRoute()` reads it (fallback `/`) on brand-home click. RBAC reads the existing `perms` (however `SxRail` accesses it — confirmed during planning; likely via a prop or the same `permissionsApi` the layout uses).

## 5. Scope

**In (Phase 1):** the flag + hook; the new labeled 9-workspace `SxRail` (RBAC); suppress FilmOS chrome on `/scripon`; record + use last-FilmOS-route for the brand-home; keep `old` behind the flag for fallback.

**Out (Phase 2, separate plan):** the unified full-width Figma top bar (migrating the 13 per-page top bars + their pills into a shared bar); deleting the `old` SxRail + the flag (done on the user's "go" after the 13-page QA); continuity/version/collaborator widgets unification.

## 6. Testing & verification

No frontend test runner → `npx tsc --noEmit` + **`npx next build`** (must be clean — this is the gate that caught the prior `useSearchParams` regression) + a **dev-server SSR smoke** (GET `/scripon` shows the new labeled rail and NO FilmOS rail; GET a FilmOS route is unchanged; flag `old` restores the FilmOS rail) + the user's **live 13-page click-through** (the acceptance gate). The pure flag-resolution and last-route helpers can be reasoned/traced (no runner).

## 7. Risks

- **Hydration:** mitigated by point #2 (constant on render, override post-mount). The build + SSR smoke must confirm no hydration warning.
- **Layout suppression breadth:** the children-only branch for `/scripon` must not affect non-`/scripon` routes (gate strictly on `isScripon`); FilmOS path stays byte-identical when not `/scripon` or when flag `old`.
- **`perms` access in `SxRail`:** `SxRail` is a leaf component; confirm how it can read permissions (prop vs hook) during planning — fail-open if unavailable.
- **Rail width:** the new labeled rail is wider than 74px; confirm the per-page `.body` flex accommodates it (it's `flex:1; display:flex`, so it should) during the SSR smoke / click-through.
