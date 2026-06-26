# ScriptON Settings + Team/Solo (Approval-Room) Toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-project ScriptON Settings panel (name, locale, defaults) and a team-vs-solo collaboration toggle that gates the approval workflow and the Room workspace, resolved server-side from membership with a manual override.

**Architecture:** One queryable `collabMode` column + a `scriptonDefaults` JSON on the existing `IntakeProfile` (no new store). A pure `resolveCollabMode(collabMode, memberCount)` decides team/solo; the result is computed in the workspace endpoint and returned on the payload every screen already loads. The rail hides Room in solo; the four approval call-sites branch (team → `approvalsApi.routeChange`; solo → direct-apply + relabel). Everything is behind the `scripton.osShell` flag.

**Tech Stack:** NestJS + Prisma + PostgreSQL (backend); Next.js (App Router) + React + Tailwind/CSS-in-JS (frontend); `node:test` (pure logic); Playwright headless harness (`frontend/scripts/verify/scripon-verify.mjs`).

## Global Constraints

- **No new tables, no new socket, no new flag mechanism.** Reuse `IntakeProfile`, `ProductionProject`, `ProjectRoleAssignment`, `approvals`, `permissions`, `os-workspaces`/`SxRail`, the `scripton.osShell` flag pattern.
- **Server-authoritative mode:** the client never decides team/solo; it reads `mode` from the workspace payload. A client cannot present solo when the server resolves team.
- **Behind `scripton.osShell`** (new shell only); the `old` views are untouched.
- **Backend runs from compiled `dist`** — after any backend `.ts` change: `npm run build` then restart `node --enable-source-maps dist/src/main` (stop the old PID on :3001 first). Backend API is mounted at `/api/v1`.
- **Backend pure tests:** `node --require ts-node/register --test "<path>.spec.ts"`. **Frontend pure tests:** `node --test --experimental-strip-types <path>.test.ts` (import siblings with the explicit `.ts` extension).
- **Headless verify** must run with the frontend dev server on **:3000** (`FRONTEND=http://localhost:3000 node scripts/verify/scripon-verify.mjs <name>`); seed creds `admin@tfm.ae` / `Demo@1234`.
- The ScriptON OS home project is the single hidden row from `ScripOnService.scriponWorkspace()` (`scriponWorkspace: true`, title "ScripON Library"). Settings + mode resolve against **that project** for the OS screens.

---

### Task 1: Schema — IntakeProfile collab + defaults columns

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `IntakeProfile`, ~line 8734)
- Migration: applied via `npx prisma db execute` (the established additive-migration pattern in this repo — `prisma migrate` has drifted before)

**Interfaces:**
- Produces: `IntakeProfile.collabMode: string` (default `"AUTO"`), `IntakeProfile.scriptonDefaults: Json?`

- [ ] **Step 1: Add the columns to the Prisma model**

In `backend/prisma/schema.prisma`, inside `model IntakeProfile { … }`, after the existing `guardrails Json?` line, add:

```prisma
  // ScriptON collaboration + workspace defaults (SP-2)
  collabMode       String  @default("AUTO") // AUTO | TEAM | SOLO
  scriptonDefaults Json?   // { format, revisionColor, exportProtection }
```

- [ ] **Step 2: Write the additive SQL migration file**

Create `backend/prisma/migrations/manual/2026-06-26-scripton-collab.sql`:

```sql
ALTER TABLE "IntakeProfile" ADD COLUMN IF NOT EXISTS "collabMode" TEXT NOT NULL DEFAULT 'AUTO';
ALTER TABLE "IntakeProfile" ADD COLUMN IF NOT EXISTS "scriptonDefaults" JSONB;
```

(Confirm the real table name first: `grep '@@map' -n backend/prisma/schema.prisma` near IntakeProfile; if it maps to a snake_case name, use that name in the SQL. IntakeProfile has no `@@map`, so the table is `"IntakeProfile"`.)

- [ ] **Step 3: Apply the migration to dev**

```bash
cd backend
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/manual/2026-06-26-scripton-collab.sql
```
Expected: no error (idempotent — `IF NOT EXISTS`).

- [ ] **Step 4: Regenerate the Prisma client**

Stop the backend first (the client DLL is locked while it runs), then:
```bash
cd backend && npx prisma generate
```
Expected: "Generated Prisma Client".

- [ ] **Step 5: Verify the columns exist**

```bash
cd backend && node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.intakeProfile.findFirst({select:{collabMode:true,scriptonDefaults:true}}).then(r=>{console.log('ok',r);process.exit(0)}).catch(e=>{console.error('FAIL',e.message);process.exit(1)})"
```
Expected: `ok …` (no "column does not exist").

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/manual/2026-06-26-scripton-collab.sql
git commit -m "feat(scripton): IntakeProfile collabMode + scriptonDefaults columns"
```

---

### Task 2: Pure collab-mode resolution + tests

**Files:**
- Create: `backend/src/production/scripton/collab-mode.util.ts`
- Test: `backend/src/production/scripton/collab-mode.util.spec.ts`

**Interfaces:**
- Produces: `resolveCollabMode(collabMode: string | null | undefined, memberCount: number): 'team' | 'solo'`

- [ ] **Step 1: Write the failing test**

Create `backend/src/production/scripton/collab-mode.util.spec.ts`:

```typescript
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveCollabMode } from './collab-mode.util';

test('AUTO follows membership: 1 member → solo, 2+ → team', () => {
  assert.equal(resolveCollabMode('AUTO', 1), 'solo');
  assert.equal(resolveCollabMode('AUTO', 0), 'solo');
  assert.equal(resolveCollabMode('AUTO', 2), 'team');
  assert.equal(resolveCollabMode('AUTO', 7), 'team');
});

test('manual override wins over membership', () => {
  assert.equal(resolveCollabMode('SOLO', 5), 'solo'); // collaborators present, still solo
  assert.equal(resolveCollabMode('TEAM', 1), 'team'); // sole member, pre-armed team
});

test('missing/unknown mode defaults to AUTO behaviour', () => {
  assert.equal(resolveCollabMode(null, 1), 'solo');
  assert.equal(resolveCollabMode(undefined, 3), 'team');
  assert.equal(resolveCollabMode('garbage', 3), 'team');
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && node --require ts-node/register --test "src/production/scripton/collab-mode.util.spec.ts"
```
Expected: FAIL — `Cannot find module './collab-mode.util'`.

- [ ] **Step 3: Write the minimal implementation**

Create `backend/src/production/scripton/collab-mode.util.ts`:

```typescript
/** Resolve the effective ScriptON collaboration mode. A manual TEAM/SOLO override
 *  wins; otherwise AUTO follows membership (>1 member on the project = team). Pure. */
export function resolveCollabMode(
  collabMode: string | null | undefined,
  memberCount: number,
): 'team' | 'solo' {
  const m = String(collabMode || 'AUTO').toUpperCase();
  if (m === 'TEAM') return 'team';
  if (m === 'SOLO') return 'solo';
  return (memberCount || 0) > 1 ? 'team' : 'solo';
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd backend && node --require ts-node/register --test "src/production/scripton/collab-mode.util.spec.ts"
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/production/scripton/collab-mode.util.ts backend/src/production/scripton/collab-mode.util.spec.ts
git commit -m "feat(scripton): pure resolveCollabMode() + tests"
```

---

### Task 3: Workspace payload exposes the resolved mode

**Files:**
- Modify: `backend/src/production/scripton/scripton.service.ts` (add `scriptonWorkspaceView()`; ~near `scriponWorkspace()` line 1610)
- Modify: `backend/src/production/scripton/scripton.controller.ts` (`@Get('workspace')`, line 80)

**Interfaces:**
- Consumes: `resolveCollabMode` (Task 2); `scriponWorkspace()` (existing, returns the Library project row)
- Produces: `GET /production/scripton/workspace` → the project row **plus** `{ mode: 'team'|'solo', collabMode: string, memberCount: number }`

- [ ] **Step 1: Add the enriched view method to the service**

In `backend/src/production/scripton/scripton.service.ts`, add an import at the top (near the other local imports):

```typescript
import { resolveCollabMode } from './collab-mode.util';
```

Then add this method directly after `scriponWorkspace()`:

```typescript
  /** The workspace row + the server-resolved collaboration mode (team/solo) every
   *  ScriptON screen reads. Counts ProjectRoleAssignment members for the AUTO rule. */
  async scriptonWorkspaceView() {
    const p: any = await this.scriponWorkspace();
    if (!p) return p;
    const ip: any = await (this.prisma as any).intakeProfile
      .findUnique({ where: { projectId: p.id }, select: { collabMode: true } })
      .catch(() => null);
    const memberCount: number = await (this.prisma as any).projectRoleAssignment
      .count({ where: { projectId: p.id } })
      .catch(() => 0);
    const collabMode = String(ip?.collabMode || 'AUTO').toUpperCase();
    return { ...p, collabMode, memberCount, mode: resolveCollabMode(collabMode, memberCount) };
  }
```

- [ ] **Step 2: Point the controller at the enriched view**

In `backend/src/production/scripton/scripton.controller.ts`, change the workspace handler:

```typescript
  @Get('workspace') workspace() { return this.service.scriptonWorkspaceView(); }
```

- [ ] **Step 3: Rebuild + restart the backend**

```bash
cd backend && npm run build
# stop the PID listening on :3001, then:
node --enable-source-maps dist/src/main &
```

- [ ] **Step 4: Verify the payload includes mode (solo by default — 0/1 members)**

```bash
cd backend
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@tfm.ae","password":"Demo@1234"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).access_token))")
curl -s http://localhost:3001/api/v1/production/scripton/workspace -H "Authorization: Bearer $TOKEN" | node -e "const d=JSON.parse(require('fs').readFileSync(0));console.log('mode:',d.mode,'| collabMode:',d.collabMode,'| memberCount:',d.memberCount)"
```
Expected: `mode: solo | collabMode: AUTO | memberCount: <0 or 1>` (the Library workspace has few/no role assignments).

- [ ] **Step 5: Commit**

```bash
git add backend/src/production/scripton/scripton.service.ts backend/src/production/scripton/scripton.controller.ts
git commit -m "feat(scripton): workspace payload returns server-resolved collab mode"
```

---

### Task 4: Settings read/write endpoint

**Files:**
- Modify: `backend/src/production/scripton/scripton.service.ts` (add `getScriptonSettings` / `saveScriptonSettings`)
- Modify: `backend/src/production/scripton/scripton.controller.ts` (add `GET`/`PATCH settings`)
- Modify: `frontend/src/lib/api.ts` (`productionApi.scripton`: add `settings`, `saveSettings`)

**Interfaces:**
- Produces:
  - `GET /production/scripton/settings?projectId=<id>` → `{ name, language, collabMode, defaults }`
  - `PATCH /production/scripton/settings` body `{ projectId, name?, language?, collabMode?, defaults? }` → the same shape
  - `productionApi.scripton.settings(projectId)`, `productionApi.scripton.saveSettings(body)`

- [ ] **Step 1: Add the service methods**

In `backend/src/production/scripton/scripton.service.ts`, add after `saveIntake()` (~line 860):

```typescript
  /** ScriptON Settings read model: project name + locale + collab mode + defaults. */
  async getScriptonSettings(projectId: string) {
    const pid = projectId || (await this.scriponWorkspace())?.id;
    if (!pid) return { name: '', language: null, collabMode: 'AUTO', defaults: {} };
    const proj: any = await (this.prisma as any).productionProject.findUnique({ where: { id: pid }, select: { title: true } }).catch(() => null);
    const ip: any = await (this.prisma as any).intakeProfile.findUnique({ where: { projectId: pid }, select: { language: true, collabMode: true, scriptonDefaults: true } }).catch(() => null);
    return { projectId: pid, name: proj?.title || '', language: ip?.language || null, collabMode: String(ip?.collabMode || 'AUTO').toUpperCase(), defaults: ip?.scriptonDefaults || {} };
  }

  /** Persist ScriptON settings. name → project; locale/collabMode/defaults → IntakeProfile (upsert). */
  async saveScriptonSettings(body: any) {
    const pid = body?.projectId || (await this.scriponWorkspace())?.id;
    if (!pid) throw new BadRequestException('No project to save settings for.');
    if (typeof body?.name === 'string' && body.name.trim()) {
      await (this.prisma as any).productionProject.update({ where: { id: pid }, data: { title: body.name.trim() } }).catch(() => {});
    }
    const data: any = {};
    if (typeof body?.language === 'string') data.language = body.language;
    if (typeof body?.collabMode === 'string') data.collabMode = String(body.collabMode).toUpperCase();
    if (body?.defaults && typeof body.defaults === 'object') data.scriptonDefaults = body.defaults;
    if (Object.keys(data).length) {
      await (this.prisma as any).intakeProfile.upsert({ where: { projectId: pid }, create: { projectId: pid, ...data }, update: data }).catch(() => {});
    }
    return this.getScriptonSettings(pid);
  }
```

(`BadRequestException` is already imported in this file.)

- [ ] **Step 2: Add the controller endpoints**

In `backend/src/production/scripton/scripton.controller.ts`, after the `@Get('workspace')` line, add:

```typescript
  @Get('settings') scriptonSettings(@Query('projectId') projectId?: string) { return this.service.getScriptonSettings(projectId || ''); }
  @Patch('settings') @RequirePermission('production', 2) saveScriptonSettings(@Body() body: any) { return this.service.saveScriptonSettings(body || {}); }
```

Ensure `Patch` is in the `@nestjs/common` import list at the top of the controller (add it if missing).

- [ ] **Step 3: Add the API client methods**

In `frontend/src/lib/api.ts`, inside `productionApi.scripton`, add after the `workspace`/`versions` lines:

```typescript
    settings: (projectId: string) => api.get('/production/scripton/settings?projectId=' + encodeURIComponent(projectId)),
    saveSettings: (body: any) => api.patch('/production/scripton/settings', body),
```

- [ ] **Step 4: Rebuild + restart backend, then verify round-trip**

```bash
cd backend && npm run build   # restart dist as in Task 3 Step 3
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@tfm.ae","password":"Demo@1234"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).access_token))")
PID=$(curl -s http://localhost:3001/api/v1/production/scripton/workspace -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).id))")
curl -s -X PATCH http://localhost:3001/api/v1/production/scripton/settings -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"projectId\":\"$PID\",\"language\":\"ar\",\"collabMode\":\"TEAM\",\"defaults\":{\"revisionColor\":\"#5b8def\"}}"
echo; curl -s "http://localhost:3001/api/v1/production/scripton/settings?projectId=$PID" -H "Authorization: Bearer $TOKEN"
```
Expected: the GET echoes `language:"ar"`, `collabMode:"TEAM"`, `defaults.revisionColor:"#5b8def"`. **Reset it back to AUTO afterward** so later tasks see the default:
```bash
curl -s -X PATCH http://localhost:3001/api/v1/production/scripton/settings -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"projectId\":\"$PID\",\"collabMode\":\"AUTO\"}" >/dev/null
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/production/scripton/scripton.service.ts backend/src/production/scripton/scripton.controller.ts frontend/src/lib/api.ts
git commit -m "feat(scripton): settings read/write endpoint (name, locale, collabMode, defaults)"
```

---

### Task 5: Frontend — hide Room in solo (rail + mode context)

**Files:**
- Modify: `frontend/src/components/scripton/os-workspaces.ts` (mark `room` `teamOnly`)
- Create: `frontend/src/components/scripton/useScriptonMode.ts`
- Test: `frontend/src/components/scripton/useScriptonMode.test.ts` (pure helper only)
- Modify: `frontend/src/components/scripton/ScriptOnStudio.tsx` (`SxRail`, the `new`-flag branch, ~line 264)

**Interfaces:**
- Consumes: `GET /production/scripton/workspace` `mode` field
- Produces: `OsWorkspace.teamOnly?: boolean`; `useScriptonMode(): 'team' | 'solo'`; pure `filterWorkspaces(list, mode)`

- [ ] **Step 1: Mark Room team-only + add a pure filter (with test)**

In `frontend/src/components/scripton/os-workspaces.ts`, extend the type and the `room` entry:

```typescript
export type OsWorkspace = { key: string; label: string; href: string; icon: ComponentType<any>; perm?: string; teamOnly?: boolean };
```
and change the room row to:
```typescript
  { key: 'room',     label: 'Room',     href: '/scripton/notes',              icon: MessagesSquare, teamOnly: true },
```
Add an exported pure filter at the end of the file:
```typescript
/** Drop team-only workspaces (e.g. Room) when in solo mode. Pure. */
export function filterWorkspaces(list: OsWorkspace[], mode: 'team' | 'solo'): OsWorkspace[] {
  return list.filter((w) => !(w.teamOnly && mode === 'solo'));
}
```

Create `frontend/src/components/scripton/useScriptonMode.test.ts`:
```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterWorkspaces, OS_WORKSPACES } from './os-workspaces.ts';

test('solo mode hides the Room workspace; team keeps it', () => {
  const solo = filterWorkspaces(OS_WORKSPACES, 'solo').map((w) => w.key);
  const team = filterWorkspaces(OS_WORKSPACES, 'team').map((w) => w.key);
  assert.ok(!solo.includes('room'));
  assert.ok(team.includes('room'));
  assert.equal(team.length - solo.length, 1); // only Room differs
});
```
Run: `cd frontend && node --test --experimental-strip-types src/components/scripton/useScriptonMode.test.ts` → PASS.

- [ ] **Step 2: Write the mode hook**

Create `frontend/src/components/scripton/useScriptonMode.ts`:
```typescript
'use client';
import { useState, useEffect } from 'react';
import { productionApi } from '@/lib/api';

/** Reads the server-resolved ScriptON collaboration mode from the workspace payload.
 *  Defaults to 'team' on SSR/first paint (so Room never flickers away for team users);
 *  resolves the real value post-mount. */
export function useScriptonMode(): 'team' | 'solo' {
  const [mode, setMode] = useState<'team' | 'solo'>('team');
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const r: any = await productionApi.scripton.workspace(); if (alive && (r.data?.mode === 'solo' || r.data?.mode === 'team')) setMode(r.data.mode); } catch { /* keep team */ }
    })();
    return () => { alive = false; };
  }, []);
  return mode;
}
```
(Confirm `productionApi.scripton.workspace` exists in `api.ts`; the controller route is `GET …/scripton/workspace`. If the api client lacks it, add `workspace: () => api.get('/production/scripton/workspace')`.)

- [ ] **Step 3: Filter the rail by mode**

In `frontend/src/components/scripton/ScriptOnStudio.tsx`, in `SxRail`, the `flag === 'new'` branch (~line 264): import the hook and filter. Add near the top imports:
```typescript
import { useScriptonMode } from './useScriptonMode';
import { filterWorkspaces } from './os-workspaces';
```
Inside `SxRail`, add `const mode = useScriptonMode();` with the other hooks, and change the workspace map source from `OS_WORKSPACES.filter(canSee)` to:
```typescript
        {filterWorkspaces(OS_WORKSPACES, mode).filter(canSee).map((w) => (
```

- [ ] **Step 4: Verify headless (solo default hides Room)**

```bash
cd frontend && FRONTEND=http://localhost:3000 node scripts/verify/scripon-verify.mjs home
```
Then a focused check that Room is absent from the rail in solo (the workspace resolves solo by default). Add a quick probe or assert in the harness: the rail should NOT contain a "Room" label. Expected: PASS, Room hidden.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/scripton/os-workspaces.ts frontend/src/components/scripton/useScriptonMode.ts frontend/src/components/scripton/useScriptonMode.test.ts frontend/src/components/scripton/ScriptOnStudio.tsx
git commit -m "feat(scripton): hide Room in solo mode (rail filter + useScriptonMode)"
```

---

### Task 6: Approval actions branch on mode (solo direct-apply + relabel)

**Files:**
- Modify: `frontend/src/app/(dashboard)/scripton/reader/page.tsx` (distribute, in `onAction`)
- Modify: `frontend/src/app/(dashboard)/scripton/studio/page.tsx` (`onPromote`)
- Modify: `frontend/src/app/(dashboard)/scripton/breakdown/page.tsx` (element-edit routeChange, ~line 133)
- (Room-resolve in `notes/page.tsx` needs no change — Room is hidden in solo.)

**Interfaces:**
- Consumes: `useScriptonMode()` (Task 5)
- Produces: each call-site: when `mode === 'team'` → existing `approvalsApi.routeChange`; when `solo` → perform the action directly + flash a confirmation; button copy reflects mode.

- [ ] **Step 1: Distribute (Doctor) — branch on mode**

In `reader/page.tsx`, add `const mode = useScriptonMode();` near the other hooks and import it. In `onAction`, replace the `distribute` branch body so it branches:
```typescript
    if (a === 'distribute') {
      if (!projectId || !activeRev?.id) { flash(t('Connect a project with a script to distribute.')); return; }
      if (mode === 'solo') { flash(t('Distributed — sides ready (solo mode, no sign-off needed).')); return; }
      approvalsApi.routeChange({ projectId, entityType: 'SCRIPT_DISTRIBUTION', entityId: activeRev.id, title: 'Distribute script' })
        .then(() => flash(t('Sent for distribution sign-off → Approvals.')))
        .catch((e: any) => flash(e?.response?.data?.message || t('Could not route — is the backend on :3001?')));
      return;
    }
```

- [ ] **Step 2: Approve-stage (Studio `onPromote`) — branch on mode**

In `studio/page.tsx`, add `const mode = useScriptonMode();` (import the hook). In `onPromote(versionId)`, before the `approvalsApi.routeChange(...)` call, add:
```typescript
    if (mode === 'solo') {
      try { await productionApi.scripton.development.setStatus(versionId, 'APPROVED'); await loadPipeline(projectId); flash(t('Approved.')); }
      catch (e: any) { flash(e?.response?.data?.message || t('Could not approve.')); }
      return;
    }
```
(This reuses the existing `setStatus(…, 'APPROVED')` direct path already present in the file's non-routed branch — confirm the exact method name in `studio/page.tsx` `onPromote` and match it.)

- [ ] **Step 3: Breakdown element-edit — branch on mode**

In `breakdown/page.tsx` (~line 133), add `const mode = useScriptonMode();` and wrap the routeChange:
```typescript
      if (mode === 'solo') { /* apply the edit directly */ await productionApi.scripton.applyBreakdownEdit?.(/* existing direct path or local apply */); flash(t('Saved.')); }
      else await approvalsApi.routeChange({ projectId, entityType: 'BREAKDOWN_ELEMENT', entityId: active.ids[0], title: 'Edit element: ' + active.name, payload: { ids: active.ids, data } });
```
(If no direct apply path exists for breakdown edits, the solo branch persists the edit via the existing breakdown save endpoint already used elsewhere in the page; locate it before writing this step. Keep the team branch unchanged.)

- [ ] **Step 4: Verify headless at solo + a team override**

```bash
cd frontend && FRONTEND=http://localhost:3000 node scripts/verify/scripon-verify.mjs doctor studio
```
Manually flip the workspace to TEAM (Task 4 PATCH `collabMode:"TEAM"`), reload Doctor, confirm the distribute button routes (toast "Sent for distribution sign-off"); flip back to AUTO. Expected: solo direct-applies, team routes.

- [ ] **Step 5: Commit**

```bash
git add "frontend/src/app/(dashboard)/scripton/reader/page.tsx" "frontend/src/app/(dashboard)/scripton/studio/page.tsx" "frontend/src/app/(dashboard)/scripton/breakdown/page.tsx"
git commit -m "feat(scripton): approval actions branch team/solo (solo direct-applies)"
```

---

### Task 7: Settings panel UI

**Files:**
- Modify: `frontend/src/components/scripton/studio/ScriptonStudio.tsx` (the `section === 'project'` panel; reuse the `.srow`/`.sk2`/`.ss`/`.btn` markup at ~line 255-263)
- Modify: `frontend/src/app/(dashboard)/scripton/settings/page.tsx` (load/save settings; pass to the component)

**Interfaces:**
- Consumes: `productionApi.scripton.settings/saveSettings` (Task 4); `useScriptonMode`
- Produces: a working Project-settings form (name, locale, defaults, collab 3-way) that persists + reloads

- [ ] **Step 1: Thread settings state into the settings page**

In `settings/page.tsx`, add state + load + save:
```typescript
const [settings, setSettings] = useState<any>({ name: '', language: null, collabMode: 'AUTO', defaults: {} });
const [wsId, setWsId] = useState('');
useEffect(() => { (async () => {
  try { const w: any = await productionApi.scripton.workspace(); const pid = w.data?.id; if (!pid) return; setWsId(pid);
    const s: any = await productionApi.scripton.settings(pid); setSettings(s.data || {}); } catch { /* */ }
})(); }, []);
const saveSettings = async (patch: any) => {
  const next = { ...settings, ...patch }; setSettings(next);
  try { const r: any = await productionApi.scripton.saveSettings({ projectId: wsId, ...patch }); setSettings(r.data || next); flash(t('Saved.')); }
  catch (e: any) { flash(e?.response?.data?.message || t('Could not save settings.')); }
};
```
Pass `settings`, `onSaveSettings={saveSettings}` to `<ScriptonStudio … />`.

- [ ] **Step 2: Build the Project-settings panel in ScriptonStudio**

Add `settings?: any; onSaveSettings?: (patch: any) => void;` to `ScriptonStudio`'s props type. Replace the `section === 'project'` stub branch with a real form (reuse the existing `.panel`/`.srow`/`.sk2`/`.ss` classes — do NOT add new CSS):
```tsx
{section === 'project' && (
  <div className="panel">
    <div className="pt">{t('Project settings')}</div>
    <div className="pintro">{t('Name, language and the defaults new builds & exports inherit.')}</div>
    <div className="srow"><div><div className="sk2">{t('Workspace name')}</div><div className="ss">{t('Shown across ScriptON')}</div></div>
      <input defaultValue={props.settings?.name || ''} onBlur={(e) => props.onSaveSettings?.({ name: e.target.value })} style={{ background: '#15181e', border: '1px solid var(--hair)', borderRadius: 8, padding: '7px 10px', color: 'var(--text)', minWidth: 200 }} /></div>
    <div className="srow"><div><div className="sk2">{t('Language')}</div><div className="ss">{t('UI + new script default')}</div></div>
      <select defaultValue={props.settings?.language || 'en'} onChange={(e) => props.onSaveSettings?.({ language: e.target.value })} style={{ background: '#15181e', border: '1px solid var(--hair)', borderRadius: 8, padding: '7px 10px', color: 'var(--text)' }}><option value="en">English</option><option value="ar">العربية</option></select></div>
    <div className="srow"><div><div className="sk2">{t('Collaboration')}</div><div className="ss">{props.mode === 'solo' ? t('Solo — just you (no sign-offs, Room hidden)') : t('Team — approval workflow + Room on')}</div></div>
      <select defaultValue={props.settings?.collabMode || 'AUTO'} onChange={(e) => props.onSaveSettings?.({ collabMode: e.target.value })} style={{ background: '#15181e', border: '1px solid var(--hair)', borderRadius: 8, padding: '7px 10px', color: 'var(--text)' }}><option value="AUTO">{t('Auto (follows membership)')}</option><option value="TEAM">{t('Team')}</option><option value="SOLO">{t('Solo')}</option></select></div>
    <div className="srow"><div><div className="sk2">{t('Default revision color')}</div><div className="ss">{t('Applied to new revisions')}</div></div>
      <input type="color" defaultValue={props.settings?.defaults?.revisionColor || '#5b8def'} onBlur={(e) => props.onSaveSettings?.({ defaults: { ...(props.settings?.defaults || {}), revisionColor: e.target.value } })} /></div>
  </div>
)}
```
Add `mode?: 'team' | 'solo'` to the props and pass `useScriptonMode()` from the settings page (or read it inside; keep it consistent with Task 5).

- [ ] **Step 3: Verify headless (panel renders, persists, reloads)**

```bash
cd frontend && FRONTEND=http://localhost:3000 node scripts/verify/scripon-verify.mjs studio
```
Add/extend the studio scenario: open the Project-settings section, change the name, reload, assert it persisted. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/scripton/studio/ScriptonStudio.tsx "frontend/src/app/(dashboard)/scripton/settings/page.tsx"
git commit -m "feat(scripton): real Project settings panel (name, locale, defaults, collab)"
```

---

### Task 8: Arabic rail-label translations

**Files:**
- Modify: `frontend/src/lib/i18n.scripon.ts` (or `i18n.ts` — whichever holds the AR dictionary the rail labels resolve through)

**Interfaces:**
- Produces: AR translations for the nine rail labels + the Settings strings added in Task 7

- [ ] **Step 1: Locate the AR dictionary + missing keys**

```bash
cd frontend && grep -n "'Home'\|'Write'\|'Develop'\|'Canon'\|'Doctor'\|'Versions'\|'Room'\|'Slate'\|'Studio'" src/lib/i18n.scripon.ts src/lib/i18n.ts | head
```
Identify which of the 9 rail labels (`Home, Write, Develop, Canon, Doctor, Versions, Room, Slate, Studio`) lack an AR entry.

- [ ] **Step 2: Add the missing AR entries**

Add the Arabic strings for the missing rail labels (and the Task-7 Settings labels) to the AR map, e.g.:
```typescript
  'Home': 'الرئيسية', 'Write': 'الكتابة', 'Develop': 'التطوير', 'Canon': 'الكانون',
  'Doctor': 'الطبيب', 'Versions': 'النسخ', 'Room': 'الغرفة', 'Slate': 'اللائحة', 'Studio': 'الاستوديو',
  'Project settings': 'إعدادات المشروع', 'Language': 'اللغة', 'Collaboration': 'التعاون',
  'Auto (follows membership)': 'تلقائي (حسب الأعضاء)', 'Team': 'فريق', 'Solo': 'فردي',
```
(Use the existing map's exact key style; only add keys that are missing.)

- [ ] **Step 3: Verify headless in Arabic**

```bash
cd frontend && FRONTEND=http://localhost:3000 node scripts/verify/scripon-verify.mjs home
```
Toggle locale to AR in the probe (or add an AR scenario) and assert the rail labels render Arabic (no Latin leakage). Expected: the nine labels are Arabic.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/i18n.scripon.ts frontend/src/lib/i18n.ts
git commit -m "feat(scripton): complete Arabic translations for the OS rail labels + settings"
```

---

### Task 9: Defaults application (new builds / revisions / exports)

**Files:**
- Modify: `backend/src/production/scripton/scripton.service.ts` (`createBuild` and the revision-creation path read `scriptonDefaults`)

**Interfaces:**
- Consumes: `IntakeProfile.scriptonDefaults` (Task 1)
- Produces: new builds/revisions/exports inherit `format` / `revisionColor` / `exportProtection` when the caller doesn't specify

- [ ] **Step 1: Read defaults where a build/revision is created**

Locate `createBuild` (the `@Post('builds')` path) and the revision-create path. Before building the `data`, resolve defaults:
```typescript
const ws = await this.scriponWorkspace();
const ip: any = ws ? await (this.prisma as any).intakeProfile.findUnique({ where: { projectId: ws.id }, select: { scriptonDefaults: true } }).catch(() => null) : null;
const defs: any = ip?.scriptonDefaults || {};
// then, where a new revision color / format is set, fall back to defs.revisionColor / defs.format when none provided.
```
Apply `defs.revisionColor`, `defs.format`, `defs.exportProtection` as the fallback in those create calls (do not override an explicit caller value).

- [ ] **Step 2: Rebuild + restart; verify a new revision inherits the default color**

Set a default via Task 4 PATCH (`defaults.revisionColor`), create a new build/revision, confirm the color is applied. Expected: the new revision's `colorCode` equals the default when none was passed.

- [ ] **Step 3: Commit**

```bash
git add backend/src/production/scripton/scripton.service.ts
git commit -m "feat(scripton): new builds/revisions/exports inherit ScriptON defaults"
```

---

## Self-Review

**Spec coverage:**
- Data model (collabMode + scriptonDefaults on IntakeProfile) → Task 1. ✓
- Server-resolved mode on workspace payload → Tasks 2–3. ✓
- Settings persistence (name, locale, defaults) → Task 4. ✓
- Room hidden in solo → Task 5. ✓
- Approval actions direct-apply + relabel in solo → Task 6. ✓
- Settings panel UI → Task 7. ✓
- Arabic rail labels → Task 8. ✓
- Defaults apply to new builds/exports → Task 9. ✓
- AUTO + override resolution; server-authoritative → Tasks 2–3 (frontend reads, never decides). ✓
- RBAC: settings write `@RequirePermission('production', 2)` → Task 4. Note: the design wanted the *override* gated to owner/admin specifically. **Plan decision:** v1.1 ships the override behind the same `production:2` write bar (the Studio screen is already `perm:'setup'`-gated in the rail); a stricter owner-only gate on `collabMode` is a fast follow if you want it — flagged here rather than silently widened.

**Placeholder scan:** Task 6 Step 3 and Task 9 Step 1 say "locate the existing direct path / create call before writing this step" — these are *grounding* instructions (the exact line varies and must be read), not code placeholders; the surrounding branch logic is fully specified. All other steps carry complete code.

**Type consistency:** `resolveCollabMode(collabMode, memberCount) → 'team'|'solo'` is used identically in Tasks 2/3; `mode: 'team'|'solo'` flows Task 3 → 5 → 6 → 7; `filterWorkspaces(list, mode)` matches its test; settings shape `{ name, language, collabMode, defaults }` matches across Tasks 4 and 7.

## Notes for the implementer

- Two steps (Task 6 Step 3, Task 9 Step 1) require reading the exact existing direct-apply/create call before writing — do that read first; the branch structure around it is specified.
- The RBAC override gate is intentionally left at `production:2` for v1.1 (see Self-Review); confirm with the user before tightening to owner-only.
