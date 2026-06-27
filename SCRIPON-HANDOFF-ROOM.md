# ScripON · Room — Design Handoff (screen 4)

_For Claude Code. **Re-skin + consolidate** the existing Notes + Approvals + Distribution surfaces into one **Room** workspace, behind the `scripon.osShell` flag. Design authority: Figma `dqUr3nasAkQIdefXcGDSyi` node **6:156** (Room frame) + responsive frame **49:3** (mobile review). Route: `/scripon/notes` (no route change — Room renders here)._

## What already exists (reuse — do NOT rebuild)
- `ScripOnNotes.tsx` (`/scripon/notes`) — notes list + filters (`All · Open · Resolved · @ me · Story · Production`), the thread view, reply input, resolve. Data: `productionApi.scriptAnnotations.list(revId)` → notes (author, sceneNumber, body, resolved, createdAt). **Resolve is already wired** → `approvalsApi.routeChange({ entityType:'ANNOTATION_RESOLVE', … })` (routes a sign-off into Approvals). Replies are an honest next-phase stub.
- `ScripOnApprovals.tsx` (`/scripon/approvals`) — the approval-chain surface (`approvalsApi`). Its data feeds Room's right-column **Approval chain**.
- `ReviewProtectionPanel.tsx` / protected-export — per-recipient forensic watermark + access log; feeds Room's right-column **Distribution**.
- Tablet/mobile variants exist for Notes (`ScripOnNotesTablet/Mobile`) and Approvals — re-skin them, keep the breakpoint logic.

## Layout (desktop — matches frame 6:156, content area right of the rail)
1. **Title block:** `Room` (Fraunces) + sub-line `Notes, approvals & distribution — live and structured, never emailed PDFs.`
2. **Three columns:**
   - **Left — Notes** (`NOTES · {n} open`): a list of note cards. Each = colored avatar (initial) · `Scene {n} · {topic}` · `{author} · {role}` · `OPEN`/`RESOLVED` tag · the note text. Click selects → center. Keep the existing filters as a control.
   - **Center — the selected thread:** header `Scene {n} · {slug}` + sub `Open · {topic} · anchored to the scene (moves with it)`. The threaded conversation — each bubble = avatar · `{author} · {role} · {time}` · text. Keep the special **ScripON Doctor suggestion** bubble (gold) when present, and the **`↳ Revision Pass · Scene {n}`** chip that links a note to a staged pass. Bottom: a `Reply, or @mention…` input + a gold **`Resolve ✓`** button.
   - **Right — Approval chain + Distribution** (one column, two stacked sections):
     - **APPROVAL CHAIN:** ordered stages with status dots — `Writer` (Approved · {name}, green ✓) · `Producer` (Approved · {name}, green ✓) · `Director` (Reviewing now · {name}, amber) · `Legal / Compliance` (Pending · {note}, gray).
     - **DISTRIBUTION:** per-recipient rows — `{name} · {role}` · `watermarked · viewed {time}` (or `sent`), with a small lock/eye glyph. Footer: `Every copy is per-recipient forensic-watermarked and access-logged.`

Cinematic dark + gold tokens (same `.sx` set as the other screens).

## Data wiring (reuse — do NOT mock)
| Region | Source |
|---|---|
| Notes list + filters | `productionApi.scriptAnnotations.list(revId)` via the existing `ScripOnNotes` mapping; existing filter logic |
| Thread (note + bubbles) | the selected note; multi-reply threads + the Doctor-suggestion bubble are the existing sample/next-phase shape — keep replies as the honest stub until a comments endpoint exists |
| `Resolve ✓` | **real** — `approvalsApi.routeChange({ entityType:'ANNOTATION_RESOLVE', entityId, … })` (existing) |
| Approval chain (right) | the existing `ScripOnApprovals` / `approvalsApi` chain stages + statuses for the project |
| Distribution (right) | the protected-export per-recipient access log (watermark + viewed/sent) from `ReviewProtectionPanel`/protected-export; honest stub if the viewed-log isn't surfaced yet |
| `↳ Revision Pass` chip | the note→staged-pass link (kernel/Write) — degrade gracefully if the kernel is inert |
| Reply / @mention input | keep the existing honest behavior (next-phase) — don't fake a posted reply |

## States
- **Loading:** skeleton the three columns.
- **Empty (no notes):** left column shows "No notes yet"; center shows an empty prompt; the approval chain still renders its stage skeleton.
- **No approvals routed yet:** the chain shows stages in their pending state (not a blank panel).
- **Kernel inert:** the `↳ Revision Pass` chip simply doesn't render. Never a broken widget.

## Responsive (re-skin existing tablet/mobile)
- **Tablet:** two columns — Notes list + Thread; the Approval chain + Distribution move to a right drawer or a tab under the thread.
- **Mobile (frame 49:3, review-first):** notes list → tap → thread full-screen (Reply + Resolve pinned at bottom); Approval chain + Distribution as a sheet/section reachable from the thread. Keep reply/resolve reachable with one thumb.

## Acceptance (browser-verified, headless + my eyeball)
- Matches Figma **6:156**: three columns, note cards, threaded center with the Doctor-suggestion bubble + Revision-Pass chip, right-column Approval chain + Distribution.
- **Real data**: notes from `scriptAnnotations`; `Resolve ✓` actually routes via `approvalsApi`; approval chain shows the real stages. Honest stubs only where the spec says (replies, distribution-viewed) — never a fake success.
- `↳ Revision Pass` degrades cleanly when the kernel is inert.
- **No console errors / no hydration flash** on hard refresh (Playwright) at desktop/tablet/mobile.
- Behind `scripon.osShell`; `old` restores the current `/scripon/notes`. Full-text rev/label pills (carry the prior polish).

## Out of scope (this screen)
The unified top bar (Phase 2). Build the Room content area only; the rail is already in place from the cutover. The standalone `/scripon/approvals` page can stay reachable — Room is just its unified home.
