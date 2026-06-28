# ScriptON · One Chrome, Every Screen — the real fix for "every screen is different"

_For Claude Code. Root cause confirmed in the code: **two different rails are live at once**, plus the rail CSS is duplicated per screen. This is why the chrome looks different as you navigate. Fix = a single source of truth for the rail + top bar that every route renders._

## What's actually wrong
1. **Two rail implementations:**
   - **New unified screens** — each scopes its *own copy*: `.sx.<screen> .rail { width:76px; flex:0 0 76px; background:#0c0d11; border-inline-end:1px solid var(--hair); … overflow-y:auto }` in `home/ScriptonHome`, `canon/ScriptonCanon`, `doctor/ScriptonDoctor`, `develop/ScriptonDevelop`, `compare/ScriptonCompare`, `room/ScriptonRoom`, `studio/ScriptonStudio`, `write/ScriptonWrite`, `versions/ScriptonVersions` (~9 duplicates of the same rule).
   - **Legacy screens still rendering on some routes** — use the OLD rail: `.sx .rail { width:74px; flex:0 0 74px; background:#0e1015; border-right:1px solid var(--hair); … }` (no `overflow-y`, different width/colour/border) in `ScriptOnLibrary` (**Slate · /scripton/library**), `ScriptOnReader`, `ScriptOnNotes`, `ScriptOnRevisions`, `ScriptOnSettings`, `ScriptOnStudio`, `ScriptOnDashboard`, `ScriptOnGreenlight`, `ScriptOnReports`, `ScriptOnSchedule`, `ScriptOnApprovals`, `ScriptOnBreakdown`, `ScriptOnDoctor`.
   → Navigating from a new screen (76px) to a legacy-rendered route like **Slate** (74px) makes the rail visibly jump. Same divergence risk on the top bar.

## The fix — single source of truth
1. **One rail rule.** Define the rail's CSS **once** — co-locate it inside the shared `SxRail` component (it already renders the markup for every screen), or as one shared `.sx .rail` / `.sx .ritem` / active-state rule in the shared `.sx` layer. **Canonical values = the new 76px set** (`width:76px; flex:0 0 76px; background:#0c0d11; border-inline-end:1px solid var(--hair); display:flex; flex-direction:column; align-items:center; padding:14px 0; gap:6px; overflow-y:auto`). **Delete** all ~9 `.sx.<screen> .rail` copies **and** all the legacy 74px `.sx .rail` blocks.
2. **Every route renders the unified chrome.** Audit the routes that still mount a legacy component and show the old rail — **Slate (`/scripton/library` → `ScriptOnLibrary`)** is the obvious one, plus Reader / Notes / Revisions / Settings. Point each at the new unified screen component (or wrap it in the same `.sx` shell + `SxRail` + `ScriptonTopBar`) so **no route renders the 74px rail**.
3. **Top bar = one shared style too.** Ensure `ScriptonTopBar` carries its own styles (or one shared `.sx .topbar` rule); remove any per-screen bar copies.

## Verify — proof, not a vibe
- **Grep proof:** zero `.sx.<screen> .rail` copies and zero `width:74px` `.sx .rail` blocks remain — only the single shared rule.
- **Navigation proof:** at 1440, walk Home → Write → Build → Canon → Doctor → Versions → Room → **Slate** → Studio. The rail + top bar are **pixel-identical** on every one — rail width is 76 everywhere, no jump, same background. Overlay any two screens' top-left → zero difference.
- Matches Figma rail `6:111` / bar `6:80` (Develop omits search). Behind `scripton.osShell`; 0 console errors. Commit + push.

## Already done (don't redo)
The rail **icons** are fixed — `os-workspaces.ts` imports the exact Figma SVGs from `./rail-icons`. This task is only about collapsing the duplicated/diverged **chrome CSS** to one source so every screen is identical.
