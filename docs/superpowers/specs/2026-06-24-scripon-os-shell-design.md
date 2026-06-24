# ScripON OS Shell — Nested Workspace Rail + TFM Brand-Home

_Design spec. Status: approved (2026-06-24). Implements "Script OS" §5 shell for the ScripON area only — a nested OS shell that reuses the existing FilmOS dashboard scaffolding. Companion: the kernel PR (#1, `feat/scripon-script-os-p0`). Visual authority: `design-tmp/scripon-tfm-brand-home.html` + the Figma file `dqUr3nasAkQIdefXcGDSyi` (being updated so the "Sx" mark becomes the TFM logo + "ScripON")._

## 1. Goal

When the user is inside ScripON (`/scripon/*`), the dashboard presents a **nested OS shell**: the left rail shows the **9 ScripON workspaces** (not the FilmOS ERP modules), and the top-left brand becomes a **TFM-logo "home" affordance** that returns to FilmOS. Everywhere else, the existing FilmOS shell is untouched. No new responsive variants are hand-built — the existing responsive scaffolding carries tablet/mobile.

## 2. Approach (chosen: ① conditional shell in the existing layout)

Drive everything off `isScripon = pathname.startsWith('/scripon')` inside `frontend/src/app/(dashboard)/layout.tsx`. Reuse the layout's existing `<aside>` rail rendering, `railBtn`, responsive machinery (mobile drawer / tablet icon-strip / phone bottom-nav), theme palette, and permission system. Two things swap on `isScripon`:

1. **Rail data source:** FilmOS `MODULES` → the 9 ScripON workspaces.
2. **Top-bar brand cluster:** FilmOS brand → TFM-logo-as-home + "ScripON" + project name.

Rejected: ② a separate shell in `scripon/layout.tsx` (duplicates perms/theme/responsive — more code, higher risk); ③ dropping the literal `GroupedRail` component in (lacks the bespoke responsive drawer/tablet/bottom-nav — would re-implement responsive and leave two rail implementations). `GroupedRail` + `os-rail.config.ts` remain the `/nav-preview` demo only.

## 3. Files

- **Modify** `frontend/src/app/(dashboard)/layout.tsx` — the conditional rail data + brand cluster + last-route tracking. The single behavioral change; additive and reversible (the FilmOS branch is the untouched default).
- **Create** `frontend/src/app/(dashboard)/scripon/os-workspaces.ts` — the 9 ScripON workspaces in the SAME shape the bespoke rail consumes (the `Module`/group shape used by `MODULES`), each with `key`, `label`, `href`, `icon`, and an optional `perm` key. Single source of truth for the OS rail.
- **No change** to `scripon/layout.tsx` (keeps `ScripOnCmdK` + `ScriponBindBar`), the FilmOS `MODULES`, or any `/scripon/*` page.

## 4. The OS workspaces (rail data)

Order (Figma authority): `Home · Write · Develop · Canon · Doctor · Versions · Room · Slate · Studio`. Each entry: `{ key, label, href, icon, perm? }` matching the existing rail item shape. Hrefs: `/scripon`, `/scripon/write`, `/scripon/develop`, `/scripon/canon`, `/scripon/doctor`, `/scripon/versions`, `/scripon/room`, `/scripon/slate`, `/scripon/studio`. Icons from the same `lucide-react` set the layout already uses. (Routes that don't exist yet render as rail links to not-yet-built pages — acceptable; the rail is the shell, page existence is orthogonal and tracked separately.)

## 5. TFM brand-home affordance

Built to `design-tmp/scripon-tfm-brand-home.html`. Rendered in the top-bar left slot only when `isScripon` (FilmOS keeps its own brand placement).

- **Markup:** a `<button>` cluster = TFM mark (gold gradient rounded square, "TFM") + "ScripON" wordmark (Fraunces) + project name (plain text, separated by a hairline). The button wraps the mark + wordmark; the project name is outside the button (label, not link).
- **States:** resting = quiet; hover/focus = gold wash background + gold border + wordmark→gold; a tooltip "Back to FilmOS ↩" appears on hover AND on keyboard focus.
- **A11y:** `aria-label="Back to FilmOS"`, visible focus ring, tooltip is not the only affordance signal (focus ring + cursor pointer).
- **Behavior:** click → navigate to the **last FilmOS route** the user came from. No arrow, no exit rail item.

### Last-FilmOS-route tracking
A `useEffect` keyed on `pathname`: when `!isScripon`, write `pathname` to `sessionStorage['tfm_last_filmos_route']`. The brand-home click reads it (fallback `'/'` if absent — e.g. deep-link straight into ScripON). Using `sessionStorage` (not state) so it survives the in-app navigation into ScripON; per-tab scope is correct. Never store a `/scripon/*` path.

## 6. RBAC

The 9 workspaces filter through the **same** permission check the FilmOS rail already applies (the `perms` object from `permissionsApi.me()`, with the "show if perms not loaded yet, or role has ≥ view access" rule). Each workspace declares an optional `perm` key:
- Default (Home/Write/Develop/Canon/Doctor/Versions/Room/Slate): the ScripON base access permission (whatever gates entry to the ScripON area today).
- **Studio** (settings/security/export): gated on the settings/admin permission.

Exact permission keys are read from the real `perms` object during planning and matched to the existing rail's filter — no new permission system. An empty/over-filtered rail must still render the shell (never a blank rail crash).

## 7. Responsive

No new variants. The same `<aside>` + mobile drawer + tablet icon-strip + phone bottom-nav render the OS workspaces when `isScripon`. The TFM mark sits in the header/drawer at tablet/mobile and does the same home job. Verified at the existing breakpoints.

## 8. Scope

**In:** the nested rail (9 workspaces, RBAC), the TFM brand-home affordance (+ last-route tracking, a11y), responsive reuse.

**Out (follow-on):** the ScripON top-bar right side — continuity ring, version picker, collaborator avatars — needs current-script context/data and is deferred. The Figma top bar shows them; this pass keeps the existing top-bar right side (search/⌘K/theme/notifications) and only swaps the left brand cluster.

## 9. Testing & verification

- **Unit (where pure):** the last-route helper (store/read/fallback, never store `/scripon/*`) extracted as a pure function and tested.
- **Browser-verified (required — this is a layout change):** run the frontend, confirm at desktop/tablet/mobile: (a) `/scripon/*` shows the 9-workspace rail + TFM brand-home; (b) a non-ScripON route shows the unchanged FilmOS rail; (c) clicking the TFM mark from `/scripon/...` returns to the last FilmOS route (dip in from a FilmOS page → land back there); (d) deep-link to `/scripon/canon` → TFM mark falls back to `/`; (e) hover/focus shows the tooltip + focus ring; (f) RBAC hides Studio for a non-admin role. Capture screenshots.

## 10. Risks & mitigations

- **Global layout blast radius:** the change is gated entirely behind `isScripon`; the FilmOS branch is the untouched default. Reversible by removing the conditional.
- **Two sources of "which workspaces":** `os-workspaces.ts` (live) vs `os-rail.config.ts` (demo). Keep the demo as-is; the live shell uses `os-workspaces.ts`. Note the duplication in the file header so they don't silently diverge.
- **Permission key mismatch:** confirmed against the real `perms` object in the plan; fail-open to "show" while perms load (matches existing rail behavior) so the shell never blanks.
