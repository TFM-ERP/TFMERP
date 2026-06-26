# ScriptON Settings + Team/Solo (Approval-Room) Toggle — Design

**Date:** 2026-06-26
**Sub-project:** SP-2 (of the ScriptON v1.1 / Phase-2 decomposition)
**Status:** Approved design → ready for implementation plan

## Goal

Give ScriptON a real per-project **Settings** panel (name, locale, defaults) and,
critically, a **team-vs-solo collaboration toggle** that gates the approval workflow
and the Room workspace:

- **Team mode:** the approval/sign-off workflow is live and the **Room** workspace is
  available.
- **Solo mode:** one person does everything — no sign-off gates, and the **Room is
  hidden from the rail entirely** ("you are the room").

The toggle is **per-project**, **defaults from membership (AUTO)**, and is **manually
overridable**. It must be **server-authoritative** so a client cannot fake solo to
skip approvals.

## Non-goals (YAGNI)

- A roles/permissions **editor** UI (inviting users, assigning roles) — that stays in
  the existing roles UI and is the separate "Access & roles" Feature 4.
- Per-scene / per-action approval granularity.
- Any new persistence store, new socket, or new flag mechanism.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Toggle scope | **Per-project**, hybrid |
| Default behavior | **AUTO**: solo while sole member; flips to **team automatically** when a 2nd member joins |
| Override | Manual **Team / Solo** override available (force team early, or stay solo despite collaborators) |
| Solo behavior (besides hiding Room) | Approval actions **direct-apply + relabel** ("Distribute"/"Approve"), no routing, no pending queue |
| Mode plumbing | **Server-resolved**, returned on the existing `GET …/scripton/workspace` payload (Approach A) |
| Persistence | Existing per-project `IntakeProfile` (no new store) |

## Data model (the delta)

On the existing **`IntakeProfile`** (per-project, `projectId @unique`):

```prisma
// additive to model IntakeProfile
collabMode      String  @default("AUTO")  // AUTO | TEAM | SOLO  (queryable — resolution reads it)
scriptonDefaults Json?                     // { format, revisionColor, exportProtection }
// locale reuses the existing `language` field
```

- **Project name** → `ProductionProject.name` (existing).
- **Locale** → `IntakeProfile.language` (existing).
- **Defaults** → `scriptonDefaults` JSON.

No other schema changes. `ProjectRoleAssignment(projectId, userId, template)` is the
existing per-project membership table the resolution counts.

## Mode resolution (server-authoritative)

A single pure function in the workspace service:

```
effectiveMode(project):
  ip = intakeProfile(project)
  if ip.collabMode == 'TEAM' → 'team'
  if ip.collabMode == 'SOLO' → 'solo'
  // AUTO
  members = count(ProjectRoleAssignment where projectId = project.id)
  return members > 1 ? 'team' : 'solo'
```

Served on the existing `GET /production/scripton/workspace` response as:

```json
{ "...": "...", "mode": "team|solo", "collabMode": "AUTO|TEAM|SOLO", "memberCount": 3 }
```

Every ScriptON screen already loads the workspace payload — no new fetch. `collabMode`
+ `memberCount` are returned so the settings UI can show the raw setting and the live
caption.

## Behavior matrix

| Surface | TEAM | SOLO |
|---|---|---|
| **Room** workspace (rail item + `/scripton/notes` route) | visible | **hidden** |
| Distribute sign-off (Doctor) | route via `approvalsApi.routeChange` | **direct-apply**, button reads "Distribute" |
| Greenlight routing | route for approval | **direct-apply**, "Greenlight" |
| Approve dev-stage (Studio/Versions) | route for approval | **direct-apply**, "Approve" |
| Room resolve / chain | n/a (Room hidden) | n/a |
| Write / Render / Export / Develop (non-approval) | unchanged | unchanged |

**Frontend mechanics:**
- `os-workspaces.ts` marks the `room` workspace `teamOnly: true`; `SxRail` filters it
  out when `mode === 'solo'` (same pattern as the existing `perm` gate).
- A small `useScriptonMode()` reads `mode` from the already-loaded workspace context
  (or the screens read it from the workspace payload they fetch).
- The approval action handlers branch on `mode`: team → `routeChange`; solo → perform
  the action directly + flash a confirmation, and relabel the button.

## Settings panel

Built into Studio's **Project settings** section (currently a "ships next phase"
stub), reusing the `ScriptOnSettings` form patterns:

- **Name** → `ProductionProject.name`
- **Locale** AR/EN → `IntakeProfile.language`; on workspace open the saved locale is
  applied; the rail ع/EN toggle still overrides per-session.
  - **Also fills the ~9 untranslated ScriptON rail labels in the AR i18n dictionary**
    so the Arabic switch is actually complete (the "missing Arabic rail labels" item).
- **Defaults** → `scriptonDefaults`: default **format** · default **revision color** ·
  default **export protection**. Read at build / revision / export creation time.
- **Collaboration** → a 3-way control: **Auto (follows membership)** · **Team** ·
  **Solo**, with a live caption: "Currently: Team — 3 members" / "Solo — just you".

## RBAC / governance

- Editing settings → existing `@RequirePermission('production', 2)` (write).
- The **collab override** (forcing TEAM/SOLO away from AUTO) is governance-sensitive
  (SOLO bypasses sign-offs) → restricted to the project **owner/admin** (highest role).
  AUTO requires nothing beyond write.
- SP-2 only **reads** `ProjectRoleAssignment`; it never creates/edits roles.

## Reuse (anti-duplication)

`IntakeProfile`, `ProductionProject`, `ProjectRoleAssignment`, the `approvals` +
`permissions` guard, the `ScriptOnSettings` form, `os-workspaces` / `SxRail`, the
existing `scripton.osShell` flag pattern. **No new tables, sockets, or flag
mechanisms.**

## Acceptance

- Settings persist + survive reload.
- Locale switch updates the UI, including the now-complete Arabic **rail labels**.
- Defaults apply to **new** builds / revisions / exports.
- **Solo** (1 member): Room hidden from the rail; the approval actions that remain
  (distribute · greenlight · approve-stage) direct-apply + relabel; no pending
  sign-offs. (Room-resolve is not applicable — the Room is hidden.)
- **Auto-flip:** adding a 2nd `ProjectRoleAssignment` flips the project to **team**
  with no manual step (Room appears, actions route).
- **Manual override:** owner can force TEAM (solo project, workflow pre-armed) or SOLO
  (collaborators present, still self-serve).
- **Server-authoritative:** a client cannot present solo when the server resolves team.
- Everything behind `scripton.osShell` (new shell only); `old` is unaffected.

## Open implementation notes (for the plan)

- Confirm `GET …/scripton/workspace` shape + the exact screens that read it, so `mode`
  threads through without prop-drilling (a small context/provider may be cleanest).
- Enumerate the exact approval call-sites to branch (Doctor distribute, Greenlight,
  Studio/Versions approve, any Room-resolve) — verified list in the plan.
- The owner/admin check for the override: identify the existing "highest role"
  predicate rather than inventing one.
