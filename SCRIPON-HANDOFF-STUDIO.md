# ScripON · Studio — Design Handoff (screen 3)

_For Claude Code. **Re-skin + consolidate** the existing Settings/Governance + Protected-Export surfaces into one cinematic **Studio** workspace, behind the `scripon.osShell` flag. Design authority: Figma `dqUr3nasAkQIdefXcGDSyi` node **38:198** (Studio frame). Reuse existing wiring; don't invent backends._

## ⚠️ First: fix the route (deliberate, one change)
Today the rail maps **Studio → `/scripon/studio`**, but `/scripon/studio` renders `ScripOnStudio` = the **Builder** (Develop/Adapt/Format). The real settings/export/governance content lives in **`ScripOnSettings` at `/scripon/settings`**. So:
- Repoint **`os-workspaces.ts` → Studio `href: '/scripon/settings'`** (keep `perm: 'setup'`).
- Simplify `activeWorkspaceKey`: `/scripon/studio*` always → `develop`; `/scripon/settings` → `studio`. (Drops the `/scripon/studio`-no-tab = studio special-case — Develop solely owns `/scripon/studio`.)
- Develop stays `/scripon/studio?tab=builds`. Verify both highlight correctly after the change.

## What already exists (reuse — do NOT rebuild)
- `ScripOnSettings.tsx` (`/scripon/settings`) — left **sub-nav** (Workspace · AI Governance · Review Protection · Members & roles · Companies & tenancy · Integrations · Billing); fully-wired sections today are **AI Governance** (`section='ai'`: model gateway, confidence, human-approval, runs table) and **Review Protection** (`section='protection'` → `ReviewProtectionPanel`: recipient-watermark, permission lock, audit log). Other sub-nav items currently route via `onAction('subnav')`.
- `ProtectedExportDialog.tsx` — the protected-export flow (per-recipient watermark + perms).
- `backend/.../protected-export.service.ts` — protected **PDF** (forensic watermark + access log); plus the true **.docx** export (commit 534228b) and FDX/Fountain/IDML interop.
- `ScripOnSettingsTablet.tsx` / `ScripOnSettingsMobile.tsx` — re-skin these, keep the breakpoint logic.

**Drop the embedded chrome:** `ScripOnSettings` currently renders its own old 74px `SxRail` + top bar in a `position:fixed` overlay. Remove that — the OS rail + shell now come from the cutover layout. Studio renders into the content area like Home/Doctor.

## Layout (desktop — matches frame 38:198, content area right of the rail)
1. **Title block:** `Studio` (Fraunces) + sub-line `Export · interop · security · access · settings`.
2. **Left sub-nav (≈226px column):** **Export & interop** (default) · **Security & distribution** · **Access & roles** · **Integrations** · **AI governance** · **Project settings** · **Danger zone** (red). Gold-tinted active item (existing `.sni.on` style).
3. **Main area — the active section.** Render these three to the Figma; they're the marquee:

   **Export & interop** (default view): intro line `Round-trip with the formats production actually uses. FDX is the credibility floor.` → a row of **4 format cards**:
   - **FDX** — "Final Draft XML", tag `round-trip ✓ · industry interchange`, **Export**.
   - **Fountain** — "plain-text", tag `round-trip ✓ · open format`, **Export**.
   - **PDF** — "Protected", tag `per-recipient watermark · perms`, **Export** (→ `ProtectedExportDialog`).
   - **Word** — "DOCX", tag `editable review copy`, **Export** (→ the .docx export).
   Footer: `Imports: FDX · Fountain · Celtx · Word · PDF (+OCR). The protected PDF carries the per-recipient forensic watermark + access log used in the Room.`

   **Security & distribution** panel: **Watermark mode** (Enhanced / Standard segmented) · **Permissions** chips (Copy ✗ · Extract ✗ · Print ✓ · Edit ✗) · **Sanitize metadata** (toggle) · **Per-recipient watermark + access log** (toggle) · guard note `No unprotected fallback — if protection fails, the export is blocked, never downgraded.` → wire to the existing `ReviewProtectionPanel` settings.

   **Access & roles** panel: a member list — `Qais · Owner` (Manage) · `Lina · Producer` (Review · approve) · `Nadia · Legal` (Compliance gate) · `Studio Vault · Distribution` (Read · watermarked); plus **SSO / SAML** (toggle) and **Audit log** (toggle) → wire to the existing Members & roles data.

   **AI governance** = the existing `section='ai'` content, re-skinned into a panel. **Integrations · Project settings · Danger zone** = render to the cinematic look; wire to the existing target if present, else keep the honest current behavior (`onAction('subnav')` / "coming soon") — **don't invent a backend.**

Cinematic dark + gold tokens (the `.sx` variables already in this file / `globals.css`).

## Data wiring (reuse — do NOT mock)
| Section | Source |
|---|---|
| Export cards (FDX/Fountain/PDF/Word) | existing export endpoints — protected PDF via `ProtectedExportDialog` + `protected-export.service`; `.docx` export; FDX/Fountain/IDML interop |
| Security & distribution | existing `ReviewProtectionPanel` / protection settings (watermark mode, perms, sanitize, per-recipient log) |
| Access & roles | existing Members & roles data + SSO/audit settings |
| AI governance | existing `section='ai'` props (`model`, `confidence`, `humanApproval`, `runs[]`, `companyName`) |
| Integrations / Project settings / Danger zone | existing `onAction` targets; honest stub where unbuilt |

## States
- **Loading:** skeleton the sub-nav + active panel.
- **Permission-gated:** Studio carries `perm:'setup'` — non-setup users shouldn't reach it (rail already filters by perm); if reached directly, show the existing access-denied/redirect, not a crash.
- **Unbuilt sub-sections:** render the panel to the design with the honest current behavior — never a fake success.

## Responsive (re-skin existing tablet/mobile)
`ScripOnSettingsTablet` / `ScripOnSettingsMobile` — re-skin, keep the logic. Tablet: sub-nav collapses to a top row of pills (or a select), panels stack. Mobile: sub-nav = a select/segmented control at top; one panel at a time, full width; export cards 2-up then 1-up.

## Acceptance (browser-verified, headless + my eyeball)
- Rail **Studio** opens the re-skinned settings workspace (route fix done); Develop still opens the Builder; both highlight correctly.
- Matches Figma **38:198**: title, 7-item sub-nav, the 4 export cards, Security & distribution panel, Access & roles panel.
- Real wiring: Export buttons open the real export flows (protected PDF / .docx at minimum); AI governance + Review Protection show real data; no fabricated backends.
- Old embedded 74px rail / fixed overlay is gone — single OS shell.
- **No console errors / no hydration flash** on hard refresh (Playwright) at desktop/tablet/mobile.
- Behind `scripon.osShell`; `old` restores the current `/scripon/settings`. Full-text rev/label pills (carry the Home/Doctor polish).

## Out of scope (this screen)
The unified top bar (TFM · breadcrumb · ⌘K · continuity ring · V-switcher · avatars · share) across the top of the frame is **Phase 2** — build the Studio content area only. The rail is already in place from the cutover.
