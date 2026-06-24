# ScripON → Script OS · P0 Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the Script-OS kernel loop end-to-end — a bi-temporal **canon graph**, the **extract → inject → verify** generation loop, and a **Revision Pass → Render = commit** that writes canon + a decision record + a new version — on ScripON's *existing* version primitives, with **no CRDT** (deferred by decision).

**Architecture:** The kernel's hard logic is split into **pure, deterministic functions** (bi-temporal resolution, conflict detection, relevance-weighted inject) that are TDD'd with `node:test` exactly like `intake-levers.util.spec.ts`, plus **thin AI/DB wrappers** (`this.ai.raw` for prose→facts extraction and verify; Prisma for persistence). New Prisma models (`CanonFact`, `SceneRelation`, `DecisionRecord`, `RevisionPass`, `SceneChange`) are **additive** and land via the drift-reconcile flow on a backup/staging DB — one migration. The OS shell merges the already-built `GroupedRail` into the real dashboard layout. Render rides the existing `BuildVersion` model — CRDT branch/merge is a later, explicit decision.

**Tech Stack:** NestJS + Prisma/Postgres (backend), Next.js/React (frontend), `node:test` + `ts-node` for pure-logic unit tests (`npm run test:unit`), the existing `this.ai` LLM client.

## Global Constraints

- **Reuse-first.** Never rebuild the Builder/Brief (the Develop workspace) or the Reader (the Write canvas). Relocate/extend; build only the net-new kernel.  _(spec §2, §9.1)_
- **Non-destructive, always.** Staging never edits the script; Render creates a new version; the base draft/version is immutable; everything revertible.  _(spec §4.3, §9.2)_
- **Schema safety.** All schema changes land via `npm run db:reconcile` (dry-run → review SQL → `--apply`) on a **backup/staging** DB, **one migration per change**, never bare `db push`, never prod. After baseline: `npx prisma migrate dev --name <change>`.  _(spec §6, §9.4; `FOUNDATIONS.md`)_
- **Multi-tenancy stays separate.** Do not add tenant scoping in this plan.  _(spec §9.5)_
- **TDD the pure logic.** canon extract/verify, scene-graph, change-dependency ordering, continuity scoring all get failing-test-first cycles. `npm run test:unit` in `/backend`. Commit per slice.  _(spec §9.8)_
- **No CRDT in P0.** `Draft`/`Branch` CRDT substrate is explicitly deferred. Render uses `BuildVersion`.  _(user decision, 2026-06-24)_
- **Pure functions of input, fail-safe.** New kernel functions mirror `knowledgeDirective`: unknown/empty input → empty/neutral result, never throw.  _(spec §4.1; `knowledge/index.ts`)_
- **Respect intentional safety designs.** Type-only roles (no names/photos), no living-religion deities, representation-as-speaking-count.  _(spec §9.6)_
- **The story clock (foundation).** `validFrom`/`sceneOrder` is the **0-based index of the scene within its `ScriptRevision`'s ordered scene list** (the same order the Reader renders; `SxScene.sceneNumber` sequence). It is stamped onto `SceneChange.spec.sceneOrder` at staging time and onto `CanonFact.validFrom` at extract time. **Known limitation (deferred):** integer ordering shifts on scene inserts / A-pages; P0 accepts this — the canonical source must merely *exist and be stable within a render*. Revisit with stable scene IDs / fractional ordering in a later phase.
- **Supersession is coherent across the two pure cores.** `resolveCanonAt` (later `recordedAt` wins) and `detectConflicts` (overlap + different object = conflict) must not disagree. The rule: a re-rendered scene's *new* facts supersede that **same scene's** prior facts (never a conflict); they are checked for conflict only against canon from **other** scenes. Enforced via `factsExcludingScenes` (Task 2).

**Canonical types (every task shares these):**

```ts
// backend/src/production/scripton/canon/canon.types.ts
export type CanonKind = 'CHARACTER' | 'WORLD' | 'LORE' | 'TIMELINE' | 'RELATIONSHIP' | 'PLOT';

/** A single fact about the story world. predicate/object are the structured
 *  pair that powers deterministic conflict detection; statement is the human form. */
export interface CanonFactCore {
  kind: CanonKind;
  subject: string;        // canonical entity, upper-cased, e.g. "MARIAM"
  predicate: string;      // normalized relation, e.g. "status" | "alliance_with" | "location"
  object: string;         // value, e.g. "dead" | "KHALID" | "CAIRO"
  statement: string;      // human sentence, e.g. "Mariam is killed in the raid."
  validFrom: number;      // story-order index (scene order) the fact becomes true
  validTo: number | null; // null = still true at end of story
  status?: 'ACTIVE' | 'SUPERSEDED';
  recordedAt?: number;    // monotonically increasing write order (real-time tiebreak)
  sourceSceneId?: string | null;
  supersedesId?: string | null;
  id?: string;
}

export interface CanonConflict {
  a: CanonFactCore;
  b: CanonFactCore;
  reason: string;
}
```

---

### Task 1: Canon types + pure bi-temporal resolver (`resolveCanonAt`)

The heart of "memory": given all facts and a point in story time, return what is currently true. Pure, deterministic, no DB.

**Files:**
- Create: `backend/src/production/scripton/canon/canon.types.ts`
- Create: `backend/src/production/scripton/canon/canon-resolve.util.ts`
- Test: `backend/src/production/scripton/canon/canon-resolve.util.spec.ts`

**Interfaces:**
- Consumes: `CanonFactCore` (from `canon.types.ts`, see Global Constraints).
- Produces: `resolveCanonAt(facts: CanonFactCore[], at: number): CanonFactCore[]` — returns ACTIVE facts whose validity window `[validFrom, validTo)` contains `at`; when two ACTIVE facts share `subject+predicate`, the one with the highest `recordedAt` wins (later write supersedes). Fail-safe: `null`/`[]` → `[]`.

- [ ] **Step 1: Write `canon.types.ts`** (copy the `CanonFactCore`/`CanonKind`/`CanonConflict` block verbatim from Global Constraints above).

- [ ] **Step 2: Write the failing test**

```ts
// canon-resolve.util.spec.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveCanonAt } from './canon-resolve.util';
import type { CanonFactCore } from './canon.types';

const f = (p: Partial<CanonFactCore>): CanonFactCore => ({
  kind: 'CHARACTER', subject: 'MARIAM', predicate: 'status', object: 'alive',
  statement: '', validFrom: 0, validTo: null, status: 'ACTIVE', recordedAt: 0, ...p,
});

test('fact is live from validFrom onward when validTo is null', () => {
  const facts = [f({ object: 'alive', validFrom: 0 })];
  assert.equal(resolveCanonAt(facts, 5).length, 1);
  assert.equal(resolveCanonAt(facts, 5)[0].object, 'alive');
});

test('fact stops being live at validTo (half-open window)', () => {
  const facts = [f({ object: 'alive', validFrom: 0, validTo: 10 })];
  assert.equal(resolveCanonAt(facts, 9).length, 1);
  assert.equal(resolveCanonAt(facts, 10).length, 0);
});

test('later recordedAt wins for the same subject+predicate', () => {
  const facts = [
    f({ object: 'alive', validFrom: 0, recordedAt: 0 }),
    f({ object: 'dead',  validFrom: 0, recordedAt: 5 }),
  ];
  const live = resolveCanonAt(facts, 3);
  assert.equal(live.length, 1);
  assert.equal(live[0].object, 'dead');
});

test('SUPERSEDED facts are never live', () => {
  const facts = [f({ object: 'alive', status: 'SUPERSEDED' })];
  assert.equal(resolveCanonAt(facts, 1).length, 0);
});

test('null/empty input is fail-safe', () => {
  assert.deepEqual(resolveCanonAt(null as any, 1), []);
  assert.deepEqual(resolveCanonAt([], 1), []);
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `cd backend && npm run test:unit -- --test-name-pattern="canon"` (or `node --require ts-node/register --test "src/production/scripton/canon/canon-resolve.util.spec.ts"`)
Expected: FAIL — `resolveCanonAt is not a function` / cannot find module.

- [ ] **Step 4: Write minimal implementation**

```ts
// canon-resolve.util.ts
import type { CanonFactCore } from './canon.types';

/** Facts that are true at story-order point `at`. Half-open window [validFrom, validTo).
 *  Later recordedAt wins per subject+predicate. Pure, fail-safe. */
export function resolveCanonAt(facts: CanonFactCore[], at: number): CanonFactCore[] {
  if (!Array.isArray(facts) || !facts.length) return [];
  const live = facts.filter(
    (x) =>
      x &&
      (x.status ?? 'ACTIVE') === 'ACTIVE' &&
      x.validFrom <= at &&
      (x.validTo == null || x.validTo > at),
  );
  const winner = new Map<string, CanonFactCore>();
  for (const x of live) {
    const key = x.subject + ' ' + x.predicate;
    const prev = winner.get(key);
    if (!prev || (x.recordedAt ?? 0) >= (prev.recordedAt ?? 0)) winner.set(key, x);
  }
  return [...winner.values()];
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: same as Step 3.
Expected: PASS — 5/5.

- [ ] **Step 6: Commit**

```bash
git add backend/src/production/scripton/canon/
git commit -m "feat(scripon): canon types + pure bi-temporal resolver (resolveCanonAt)"
```

---

### Task 2: Pure conflict detector (`detectConflicts`) — the verify core

The "verify" half of the loop: given established canon + candidate facts, flag contradictions. This is what makes the AI *respect* canon. Pure, deterministic.

**Files:**
- Create: `backend/src/production/scripton/canon/canon-verify.util.ts`
- Test: `backend/src/production/scripton/canon/canon-verify.util.spec.ts`

**Interfaces:**
- Consumes: `CanonFactCore`, `CanonConflict`, `resolveCanonAt`.
- Produces:
  - `detectConflicts(established: CanonFactCore[], candidates: CanonFactCore[]): CanonConflict[]` — a candidate conflicts with an established fact when they share `subject + predicate`, differ in `object`, both are ACTIVE, their validity windows overlap, and neither supersedes the other. Fail-safe → `[]`.
  - `factsExcludingScenes(facts: CanonFactCore[], sceneIds: string[]): CanonFactCore[]` — drops facts whose `sourceSceneId` is in `sceneIds`. Used before verify so a re-rendered scene's NEW facts are checked only against canon from OTHER scenes (the supersession-coherence rule from Global Constraints). Fail-safe → `[]`.

- [ ] **Step 1: Write the failing test**

```ts
// canon-verify.util.spec.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { detectConflicts, factsExcludingScenes } from './canon-verify.util';
import type { CanonFactCore } from './canon.types';

const f = (p: Partial<CanonFactCore>): CanonFactCore => ({
  kind: 'CHARACTER', subject: 'MARIAM', predicate: 'status', object: 'alive',
  statement: '', validFrom: 0, validTo: null, status: 'ACTIVE', recordedAt: 0, sourceSceneId: null, ...p,
});

test('contradiction: dead character spoken of as alive later', () => {
  const established = [f({ object: 'dead', validFrom: 10, validTo: null })];
  const candidate = [f({ object: 'alive', validFrom: 20, statement: 'Mariam laughs at the table.' })];
  const conflicts = detectConflicts(established, candidate);
  assert.equal(conflicts.length, 1);
  assert.match(conflicts[0].reason, /MARIAM/);
});

test('no conflict when objects agree', () => {
  const established = [f({ object: 'dead', validFrom: 10 })];
  const candidate = [f({ object: 'dead', validFrom: 20 })];
  assert.equal(detectConflicts(established, candidate).length, 0);
});

test('no conflict when validity windows do not overlap', () => {
  const established = [f({ object: 'alive', validFrom: 0, validTo: 10 })];
  const candidate = [f({ object: 'dead', validFrom: 10, validTo: null })];
  assert.equal(detectConflicts(established, candidate).length, 0);
});

test('different predicate is not a conflict', () => {
  const established = [f({ predicate: 'status', object: 'dead' })];
  const candidate = [f({ predicate: 'location', object: 'CAIRO' })];
  assert.equal(detectConflicts(established, candidate).length, 0);
});

test('fail-safe on empty/null', () => {
  assert.deepEqual(detectConflicts(null as any, null as any), []);
  assert.deepEqual(detectConflicts([f({})], []), []);
});

test('factsExcludingScenes drops same-scene facts (re-render is not a self-conflict)', () => {
  const facts = [
    f({ object: 'alive', sourceSceneId: 'sc12' }),
    f({ object: 'dead',  sourceSceneId: 'sc40' }),
  ];
  const kept = factsExcludingScenes(facts, ['sc12']);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].sourceSceneId, 'sc40');
});

test('re-rendering scene 12 (alive→dead) is NOT a conflict once its old facts are excluded', () => {
  const established = [f({ object: 'alive', validFrom: 12, sourceSceneId: 'sc12' })];
  const candidate = [f({ object: 'dead', validFrom: 12, sourceSceneId: 'sc12' })];
  const checkAgainst = factsExcludingScenes(established, ['sc12']);
  assert.equal(detectConflicts(checkAgainst, candidate).length, 0);
});

test('factsExcludingScenes is fail-safe', () => {
  assert.deepEqual(factsExcludingScenes(null as any, ['x']), []);
});
```

- [ ] **Step 2: Run test, verify it fails** — Run the spec; Expected: FAIL (`detectConflicts is not a function`).

- [ ] **Step 3: Write minimal implementation**

```ts
// canon-verify.util.ts
import type { CanonFactCore, CanonConflict } from './canon.types';

const overlaps = (a: CanonFactCore, b: CanonFactCore): boolean => {
  const aTo = a.validTo ?? Number.POSITIVE_INFINITY;
  const bTo = b.validTo ?? Number.POSITIVE_INFINITY;
  return a.validFrom < bTo && b.validFrom < aTo;
};

/** Candidates that contradict established canon. Pure, fail-safe. */
export function detectConflicts(
  established: CanonFactCore[],
  candidates: CanonFactCore[],
): CanonConflict[] {
  if (!Array.isArray(established) || !Array.isArray(candidates)) return [];
  const out: CanonConflict[] = [];
  for (const c of candidates) {
    if (!c || (c.status ?? 'ACTIVE') !== 'ACTIVE') continue;
    for (const e of established) {
      if (!e || (e.status ?? 'ACTIVE') !== 'ACTIVE') continue;
      if (e.supersedesId === c.id || c.supersedesId === e.id) continue;
      if (e.subject !== c.subject || e.predicate !== c.predicate) continue;
      if (e.object === c.object) continue;
      if (!overlaps(e, c)) continue;
      out.push({
        a: e,
        b: c,
        reason: `${c.subject}.${c.predicate}: canon says "${e.object}" but the new draft asserts "${c.object}".`,
      });
    }
  }
  return out;
}

/** Drop facts sourced from any of `sceneIds` (a re-rendered scene supersedes its own prior facts). Pure, fail-safe. */
export function factsExcludingScenes(facts: CanonFactCore[], sceneIds: string[]): CanonFactCore[] {
  if (!Array.isArray(facts)) return [];
  const drop = new Set(sceneIds || []);
  return facts.filter((x) => x && !(x.sourceSceneId && drop.has(x.sourceSceneId)));
}
```

- [ ] **Step 4: Run test, verify it passes** — Expected: PASS 8/8.

- [ ] **Step 5: Commit**

```bash
git add backend/src/production/scripton/canon/canon-verify.util.*
git commit -m "feat(scripon): pure canon conflict detector (verify core)"
```

---

### Task 3: Pure relevance-weighted inject (`canonDirective`)

The "inject" half: turn live canon into a plain-text steering block, mirroring `knowledgeDirective`'s shape so it slots into the same generation channel.

**Files:**
- Create: `backend/src/production/scripton/canon/canon-inject.util.ts`
- Test: `backend/src/production/scripton/canon/canon-inject.util.spec.ts`

**Interfaces:**
- Consumes: `CanonFactCore`, `resolveCanonAt`.
- Produces: `canonDirective(facts: CanonFactCore[], opts: { at: number; subjects?: string[]; max?: number }): string` — resolves live canon at `opts.at`, optionally filters to `opts.subjects` (relevance), caps at `opts.max` (default 40), returns a `CANON (honour — do not contradict):` block of `- SUBJECT — statement` lines, or `''` when nothing applies.

- [ ] **Step 1: Write the failing test**

```ts
// canon-inject.util.spec.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { canonDirective } from './canon-inject.util';
import type { CanonFactCore } from './canon.types';

const f = (p: Partial<CanonFactCore>): CanonFactCore => ({
  kind: 'CHARACTER', subject: 'MARIAM', predicate: 'status', object: 'dead',
  statement: 'Mariam died in the raid.', validFrom: 10, validTo: null,
  status: 'ACTIVE', recordedAt: 0, ...p,
});

test('emits a CANON block with live facts at the point', () => {
  const out = canonDirective([f({})], { at: 20 });
  assert.match(out, /^CANON/);
  assert.match(out, /MARIAM — Mariam died in the raid\./);
});

test('omits facts not yet true at the point', () => {
  assert.equal(canonDirective([f({ validFrom: 30 })], { at: 20 }), '');
});

test('subjects filter keeps only relevant entities', () => {
  const facts = [f({ subject: 'MARIAM' }), f({ subject: 'KHALID', statement: 'Khalid rules the city.' })];
  const out = canonDirective(facts, { at: 20, subjects: ['KHALID'] });
  assert.match(out, /KHALID/);
  assert.doesNotMatch(out, /MARIAM/);
});

test('fail-safe → empty string', () => {
  assert.equal(canonDirective([], { at: 1 }), '');
  assert.equal(canonDirective(null as any, { at: 1 }), '');
});
```

- [ ] **Step 2: Run test, verify it fails.**

- [ ] **Step 3: Write minimal implementation**

```ts
// canon-inject.util.ts
import type { CanonFactCore } from './canon.types';
import { resolveCanonAt } from './canon-resolve.util';

export function canonDirective(
  facts: CanonFactCore[],
  opts: { at: number; subjects?: string[]; max?: number },
): string {
  if (!Array.isArray(facts) || !facts.length || !opts) return '';
  let live = resolveCanonAt(facts, opts.at);
  if (opts.subjects && opts.subjects.length) {
    const want = new Set(opts.subjects.map((s) => s.toUpperCase()));
    live = live.filter((x) => want.has(x.subject.toUpperCase()));
  }
  if (!live.length) return '';
  const max = opts.max ?? 40;
  const lines = live.slice(0, max).map((x) => `- ${x.subject} — ${x.statement}`.trim());
  return 'CANON (honour — do not contradict):\n' + lines.join('\n');
}
```

- [ ] **Step 4: Run test, verify it passes.**

- [ ] **Step 5: Commit**

```bash
git add backend/src/production/scripton/canon/canon-inject.util.*
git commit -m "feat(scripon): pure relevance-weighted canon inject (canonDirective)"
```

---

### Task 4: `CanonFact` + `SceneRelation` Prisma models (additive migration)

Persist the graph. Additive only; lands via drift-reconcile on staging.

**Files:**
- Modify: `backend/prisma/schema.prisma` (append two models near the other ScripON models, e.g. after `LoreElement`)
- Reference: `FOUNDATIONS.md`, `backend/scripts/db-reconcile.sh`

**Interfaces:**
- Produces: Prisma models `CanonFact` and `SceneRelation`. `CanonFact` columns mirror `CanonFactCore` plus `scriptId`. The service layer reads/writes these via `(this.prisma as any).canonFact`.

- [ ] **Step 1: Add the models to `schema.prisma`**

```prisma
enum CanonKind {
  CHARACTER
  WORLD
  LORE
  TIMELINE
  RELATIONSHIP
  PLOT
}

model CanonFact {
  id           String    @id @default(cuid())
  scriptId     String                          // ScriptDocument id (the story this canon belongs to)
  kind         CanonKind
  subject      String                          // canonical entity, upper-cased
  predicate    String                          // normalized relation
  object       String                          // value
  statement    String                          // human sentence
  validFrom    Int                             // story-order index it becomes true
  validTo      Int?                            // null = still true
  recordedAt   Int       @default(0)           // monotonic write order (real-time tiebreak)
  status       String    @default("ACTIVE")    // ACTIVE | SUPERSEDED
  sourceSceneId String?
  supersedesId String?
  createdAt    DateTime  @default(now())

  @@index([scriptId, subject, predicate])
  @@index([scriptId, validFrom])
}

model SceneRelation {
  id          String   @id @default(cuid())
  scriptId    String
  fromSceneId String
  toSceneId   String
  type        String                            // REFERENCE|SETUP_PAYOFF|RELATIONSHIP|LOCATION|LORE|CALLBACK|CAUSE_EFFECT
  strength    Float    @default(1)
  createdAt   DateTime @default(now())

  @@index([scriptId, fromSceneId])
  @@index([scriptId, toSceneId])
}
```

- [ ] **Step 2: Validate the schema (no DB write)**

Run: `cd backend && npx prisma validate && npx prisma format`
Expected: "The schema at prisma/schema.prisma is valid" and no formatting diff beyond the two new models.

- [ ] **Step 3: Apply additively on the backup/staging DB (one migration)**

> Confirm `DATABASE_URL` points at the **staging/backup** DB and a backup exists before running. Never prod.

Run: `cd backend && npx prisma migrate dev --name canon_graph_p0`
Expected: a single new migration folder `prisma/migrations/*_canon_graph_p0/` containing only `CREATE TABLE "CanonFact"`, `CREATE TABLE "SceneRelation"`, the `CanonKind` enum, and the indexes — **no ALTER/DROP on existing tables**. If the diff touches existing tables, STOP (drift) and run `npm run db:reconcile` first.

- [ ] **Step 4: Regenerate the client**

Run: `cd backend && npx prisma generate`
Expected: success; `canonFact`/`sceneRelation` delegates available.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(scripon): additive CanonFact + SceneRelation models (canon graph P0)"
```

---

### Task 5: AI extract wrapper (`extractFactsAI`) → persist `CanonFact`

Prose → candidate facts via the existing LLM client, then persist. Thin wrapper around the LLM; the structured logic was already tested in Tasks 1–3.

**Files:**
- Create: `backend/src/production/scripton/canon/canon.service.ts`
- Modify: `backend/src/production/scripton/scripton.module.ts` (register `CanonService` in `providers`)
- Test: `backend/src/production/scripton/canon/canon.service.spec.ts` (pure mapping test with a stubbed `ai`)

**Interfaces:**
- Consumes: the injected `ai` client (`ai.raw({ task, system, messages, maxTokens, projectId, refType, refId })`, as used at `scripton.service.ts:731`), `PrismaService`, `CanonFactCore`.
- Produces: `CanonService.extractFactsAI(scriptId: string, scene: { id: string; order: number; text: string }, projectId: string): Promise<CanonFactCore[]>` and `CanonService.persistFacts(scriptId: string, facts: CanonFactCore[]): Promise<void>`. `mapAiFactsToCore(raw, scene)` is the pure mapper that the spec test pins.

- [ ] **Step 1: Write the failing test** (pins the pure mapper, no real LLM)

```ts
// canon.service.spec.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mapAiFactsToCore } from './canon.service';

test('maps AI rows to CanonFactCore with story-order validFrom from the scene', () => {
  const scene = { id: 'sc1', order: 12, text: '' };
  const raw = [{ kind: 'CHARACTER', subject: 'mariam', predicate: 'status', object: 'dead', statement: 'Mariam dies.' }];
  const out = mapAiFactsToCore(raw, scene);
  assert.equal(out.length, 1);
  assert.equal(out[0].subject, 'MARIAM');         // upper-cased
  assert.equal(out[0].validFrom, 12);             // from scene.order
  assert.equal(out[0].validTo, null);
  assert.equal(out[0].sourceSceneId, 'sc1');
  assert.equal(out[0].status, 'ACTIVE');
});

test('drops malformed rows fail-safe', () => {
  const scene = { id: 'sc1', order: 1, text: '' };
  assert.deepEqual(mapAiFactsToCore(null as any, scene), []);
  assert.deepEqual(mapAiFactsToCore([{ subject: '' }], scene), []);
});
```

- [ ] **Step 2: Run test, verify it fails.**

- [ ] **Step 3: Write the implementation**

```ts
// canon.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiService } from '../../../ai/ai.service'; // confirm path matches the client used at scripton.service.ts:731
import type { CanonFactCore, CanonKind } from './canon.types';

const KINDS: CanonKind[] = ['CHARACTER', 'WORLD', 'LORE', 'TIMELINE', 'RELATIONSHIP', 'PLOT'];

/** Pure: normalize raw AI rows into CanonFactCore anchored to the scene's story order. */
export function mapAiFactsToCore(raw: any, scene: { id: string; order: number }): CanonFactCore[] {
  if (!Array.isArray(raw)) return [];
  const out: CanonFactCore[] = [];
  for (const r of raw) {
    if (!r || !r.subject || !r.predicate || !r.object) continue;
    out.push({
      kind: KINDS.includes(String(r.kind).toUpperCase() as CanonKind)
        ? (String(r.kind).toUpperCase() as CanonKind)
        : 'PLOT',
      subject: String(r.subject).trim().toUpperCase(),
      predicate: String(r.predicate).trim().toLowerCase(),
      object: String(r.object).trim(),
      statement: String(r.statement || '').slice(0, 400),
      validFrom: scene.order,
      validTo: null,
      status: 'ACTIVE',
      sourceSceneId: scene.id,
    });
  }
  return out;
}

@Injectable()
export class CanonService {
  constructor(private prisma: PrismaService, private ai: AiService) {}

  async extractFactsAI(
    scriptId: string,
    scene: { id: string; order: number; text: string },
    projectId: string,
  ): Promise<CanonFactCore[]> {
    const system =
      'You extract canonical story facts. Return ONLY JSON {facts:[{kind,subject,predicate,object,statement}]}. ' +
      'kind ∈ CHARACTER|WORLD|LORE|TIMELINE|RELATIONSHIP|PLOT. subject = the entity; predicate = a short relation ' +
      '(status|location|alliance_with|knows|owns|relation_to); object = the value; statement = one sentence. ' +
      'Only durable world facts a later scene must not contradict. No opinions.';
    let raw: any = [];
    try {
      const res: any = await this.ai.raw({
        task: 'scripton.canon.extract',
        system,
        messages: [{ role: 'user', content: String(scene.text || '').slice(0, 6000) }],
        maxTokens: 1200,
        projectId,
        refType: 'Project',
        refId: projectId,
      });
      const parsed = typeof res === 'string' ? JSON.parse(res) : res?.json ?? res;
      raw = parsed?.facts ?? [];
    } catch {
      raw = [];
    }
    return mapAiFactsToCore(raw, scene);
  }

  async persistFacts(scriptId: string, facts: CanonFactCore[]): Promise<void> {
    if (!facts?.length) return;
    const base = await (this.prisma as any).canonFact.count({ where: { scriptId } }).catch(() => 0);
    let i = 0;
    for (const fct of facts) {
      await (this.prisma as any).canonFact
        .create({
          data: {
            scriptId,
            kind: fct.kind,
            subject: fct.subject,
            predicate: fct.predicate,
            object: fct.object,
            statement: fct.statement,
            validFrom: fct.validFrom,
            validTo: fct.validTo,
            recordedAt: base + i++,
            status: 'ACTIVE',
            sourceSceneId: fct.sourceSceneId ?? null,
          },
        })
        .catch(() => {});
    }
  }
}
```

> At execution: confirm the exact import path/method name of the LLM client by reading `scripton.service.ts:731` and the service's constructor injection; adjust `AiService` import to match. `mapAiFactsToCore` (the tested part) is independent of that.

- [ ] **Step 4: Register the provider** — add `CanonService` to `providers` in `scripton.module.ts`.

- [ ] **Step 5: Run test, verify it passes** (mapper test is green regardless of the LLM).

- [ ] **Step 6: Commit**

```bash
git add backend/src/production/scripton/canon/canon.service.* backend/src/production/scripton/scripton.module.ts
git commit -m "feat(scripon): canon extract wrapper + persistence (AI prose→facts)"
```

---

### Task 6: `DecisionRecord` + `RevisionPass` + `SceneChange` models (additive migration)

The version/decision store — on top of `BuildVersion`, no CRDT.

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: `DecisionRecord`, `RevisionPass`, `SceneChange` Prisma models consumed by Task 7.

- [ ] **Step 1: Add the models**

```prisma
model DecisionRecord {
  id           String   @id @default(cuid())
  scriptId     String
  title        String
  status       String   @default("ACCEPTED")  // PROPOSED | ACCEPTED | SUPERSEDED
  context      String                          // why this came up
  decision     String                          // what was chosen
  consequences String                          // what it implies / rejected alternatives
  supersedesId String?
  createdBy    String?
  createdAt    DateTime @default(now())

  @@index([scriptId, createdAt])
}

model RevisionPass {
  id                String        @id @default(cuid())
  scriptId          String
  baseVersionId     String                         // BuildVersion id the pass branches from
  status            String        @default("OPEN") // OPEN | RENDERING | RENDERED | DISCARDED
  continuityScore   Float?
  renderedVersionId String?                        // new BuildVersion id on Render
  createdBy         String?
  createdAt         DateTime      @default(now())
  changes           SceneChange[]

  @@index([scriptId, status])
}

model SceneChange {
  id              String       @id @default(cuid())
  passId          String
  pass            RevisionPass @relation(fields: [passId], references: [id], onDelete: Cascade)
  sceneId         String
  kind            String                          // NOTE|REVISE|RE_ENDING|REGENERATE|BUDGET_FIT|EMOTION|CANON
  spec            Json
  previewBefore   String?
  previewAfter    String?
  status          String       @default("STAGED") // STAGED | APPLIED | DISCARDED
  relatedAffected Json?
  integrity       Json?
  createdAt       DateTime     @default(now())

  @@index([passId])
}
```

- [ ] **Step 2: Validate** — `cd backend && npx prisma validate && npx prisma format`. Expected: valid.

- [ ] **Step 3: Apply on staging (one migration)** — `npx prisma migrate dev --name version_decision_p0`. Expected: only `CREATE TABLE` for the three models + indexes; no ALTER on existing tables. STOP on drift.

- [ ] **Step 4: Generate** — `npx prisma generate`.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(scripon): additive DecisionRecord + RevisionPass + SceneChange models"
```

---

### Task 7: Pure change-dependency ordering (`orderChanges`)

Before Render applies staged changes, order them deterministically (earlier scenes first; stable for equal order). Pure, TDD'd — the apply step in Task 8 consumes it.

**Files:**
- Create: `backend/src/production/scripton/canon/change-order.util.ts`
- Test: `backend/src/production/scripton/canon/change-order.util.spec.ts`

**Interfaces:**
- Produces: `orderChanges(changes: { id: string; sceneOrder: number }[]): { id: string; sceneOrder: number }[]` — ascending by `sceneOrder`, stable on ties, fail-safe → `[]`.

- [ ] **Step 1: Write the failing test**

```ts
// change-order.util.spec.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { orderChanges } from './change-order.util';

test('orders by sceneOrder ascending', () => {
  const out = orderChanges([{ id: 'b', sceneOrder: 5 }, { id: 'a', sceneOrder: 2 }]);
  assert.deepEqual(out.map((c) => c.id), ['a', 'b']);
});

test('is stable for equal sceneOrder', () => {
  const out = orderChanges([{ id: 'x', sceneOrder: 3 }, { id: 'y', sceneOrder: 3 }]);
  assert.deepEqual(out.map((c) => c.id), ['x', 'y']);
});

test('fail-safe on null', () => {
  assert.deepEqual(orderChanges(null as any), []);
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement**

```ts
// change-order.util.ts
export function orderChanges<T extends { id: string; sceneOrder: number }>(changes: T[]): T[] {
  if (!Array.isArray(changes)) return [];
  return changes
    .map((c, i) => ({ c, i }))
    .sort((p, q) => p.c.sceneOrder - q.c.sceneOrder || p.i - q.i)
    .map((w) => w.c);
}
```

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Commit**

```bash
git add backend/src/production/scripton/canon/change-order.util.*
git commit -m "feat(scripon): pure change-dependency ordering for Render"
```

---

### Task 8: Render = commit — `renderPass` (the NOTE→Render proof loop)

The end-to-end kernel proof: an OPEN `RevisionPass` with a staged `NOTE` `SceneChange` → apply (ordered) → verify against canon → write a `DecisionRecord` + extracted `CanonFact`s + a **new `BuildVersion`** → mark pass RENDERED with a `continuityScore`. Non-destructive (base version untouched).

**Files:**
- Modify: `backend/src/production/scripton/canon/canon.service.ts` (add `renderPass`)
- Modify: `backend/src/production/scripton/scripton.controller.ts` (add `POST /production/scripton/revision-pass/:passId/render`)
- Test: `backend/src/production/scripton/canon/render-score.util.spec.ts` (pure continuity-score function)

**Interfaces:**
- Consumes: `detectConflicts`, `orderChanges`, `CanonService.extractFactsAI`/`persistFacts`, `(this.prisma as any).revisionPass | sceneChange | buildVersion | decisionRecord | canonFact`. The `BuildVersion.create` shape is confirmed at `scripton.service.ts:588` (`{ buildId, n, label, briefSnapshot, status }`).
- Produces: `CanonService.renderPass(passId: string, projectId: string, userId?: string): Promise<{ versionId: string; continuityScore: number; conflicts: CanonConflict[] }>` and the pure `continuityScore(conflictCount: number, changeCount: number): number`.

- [ ] **Step 1: Write the failing test (pure score)**

```ts
// render-score.util.spec.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { continuityScore } from './render-score.util';

test('perfect score when no conflicts', () => {
  assert.equal(continuityScore(0, 4), 1);
});

test('drops with conflicts, never below 0', () => {
  assert.ok(continuityScore(2, 4) < 1);
  assert.ok(continuityScore(99, 1) >= 0);
});

test('no changes → neutral 1', () => {
  assert.equal(continuityScore(0, 0), 1);
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement the pure score**

```ts
// render-score.util.ts
/** 1 = clean; each conflict subtracts proportionally to the pass size. Clamped [0,1]. */
export function continuityScore(conflictCount: number, changeCount: number): number {
  if (!changeCount) return 1;
  const penalty = conflictCount / (changeCount + conflictCount);
  return Math.max(0, Math.min(1, 1 - penalty));
}
```

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Write the failing test for `assessPass`** (the loop's decision core — the exact logic `renderPass` runs, made deterministic and assertable without the LLM/DB)

```ts
// canon-assess.util.spec.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { assessPass } from './canon-assess.util';
import type { CanonFactCore } from './canon.types';

const f = (p: Partial<CanonFactCore>): CanonFactCore => ({
  kind: 'CHARACTER', subject: 'MARIAM', predicate: 'status', object: 'dead',
  statement: 'Mariam is killed in the raid.', validFrom: 12, validTo: null,
  status: 'ACTIVE', recordedAt: 0, sourceSceneId: 'sc12', ...p,
});

test('THE LOOP: established dead@12 vs candidate alive@20 → caught, score < 1', () => {
  const established = [f({ object: 'dead', validFrom: 12, sourceSceneId: 'sc12' })];
  const candidates = [f({ object: 'alive', validFrom: 20, sourceSceneId: 'sc20',
                          statement: 'Mariam laughs at the table.' })];
  const r = assessPass(established, candidates, ['sc20'], 1);
  assert.equal(r.conflicts.length, 1);
  assert.ok(r.continuityScore < 1);
  assert.match(r.conflicts[0].reason, /MARIAM/);
});

test('re-rendering the SAME scene (alive→dead @sc12) is not a self-conflict, score 1', () => {
  const established = [f({ object: 'alive', validFrom: 12, sourceSceneId: 'sc12' })];
  const candidates = [f({ object: 'dead', validFrom: 12, sourceSceneId: 'sc12' })];
  const r = assessPass(established, candidates, ['sc12'], 1);
  assert.equal(r.conflicts.length, 0);
  assert.equal(r.continuityScore, 1);
});
```

- [ ] **Step 6: Run, verify fail.**

- [ ] **Step 7: Implement `assessPass`**

```ts
// canon-assess.util.ts
import { detectConflicts, factsExcludingScenes } from './canon-verify.util';
import { continuityScore } from './render-score.util';
import type { CanonConflict, CanonFactCore } from './canon.types';

/** The render loop's pure decision core: exclude changed-scene facts, detect conflicts vs the rest, score.
 *  renderPass() calls this so the wired path and this test exercise identical logic. */
export function assessPass(
  allFacts: CanonFactCore[],
  candidates: CanonFactCore[],
  changedSceneIds: string[],
  changeCount: number,
): { established: CanonFactCore[]; conflicts: CanonConflict[]; continuityScore: number } {
  const established = factsExcludingScenes(allFacts || [], changedSceneIds || []);
  const conflicts = detectConflicts(established, candidates || []);
  return { established, conflicts, continuityScore: continuityScore(conflicts.length, changeCount) };
}
```

- [ ] **Step 8: Run, verify pass** (2/2 — the loop is now proven on real conflict data).

- [ ] **Step 9: Add `renderPass` to `CanonService`** (it calls `assessPass`, so the wired path runs the tested core)

```ts
// canon.service.ts — add import + method
import { assessPass } from './canon-assess.util';
import { orderChanges } from './change-order.util';
import type { CanonConflict, CanonFactCore } from './canon.types';

// inside CanonService:
async renderPass(
  passId: string,
  projectId: string,
  userId?: string,
): Promise<{ versionId: string; continuityScore: number; conflicts: CanonConflict[] }> {
  const pass: any = await (this.prisma as any).revisionPass.findUnique({
    where: { id: passId },
    include: { changes: true },
  });
  if (!pass) throw new Error('RevisionPass not found');
  await (this.prisma as any).revisionPass.update({ where: { id: passId }, data: { status: 'RENDERING' } });

  // Order staged changes deterministically (scene order is carried in spec.sceneOrder).
  const staged = (pass.changes || []).filter((c: any) => c.status === 'STAGED');
  const ordered = orderChanges(
    staged.map((c: any) => ({ id: c.id, sceneOrder: Number(c?.spec?.sceneOrder ?? 0) })),
  );

  // The scenes this pass rewrites — their OLD facts must not be verified against the NEW ones (coherence rule).
  const changedSceneIds: string[] = [...new Set(staged.map((c: any) => c.sceneId).filter(Boolean))];

  // Verify: extract candidate facts from each change's resulting text.
  const allFacts: CanonFactCore[] = (
    await (this.prisma as any).canonFact.findMany({ where: { scriptId: pass.scriptId } }).catch(() => [])
  ).map((r: any) => r as CanonFactCore);

  const allCandidates: CanonFactCore[] = [];
  for (const o of ordered) {
    const ch = staged.find((c: any) => c.id === o.id);
    const text = String(ch?.previewAfter ?? ch?.spec?.body ?? ch?.spec?.note ?? '');
    if (!text) continue;
    const facts = await this.extractFactsAI(
      pass.scriptId,
      { id: ch.sceneId, order: Number(ch?.spec?.sceneOrder ?? 0), text },
      projectId,
    );
    allCandidates.push(...facts);
  }

  // The render loop's decision core — the exact logic proven in canon-assess.util.spec.ts.
  const { conflicts, continuityScore: score } = assessPass(
    allFacts, allCandidates, changedSceneIds, ordered.length,
  );

  // Commit: new BuildVersion (shape per scripton.service.ts:588). A missing build is a hard error — never
  // mark RENDERED without producing a version (non-destructive contract: Render = a real new version).
  const build: any = await (this.prisma as any).developmentBuild.findFirst({
    where: { linkedScriptId: pass.scriptId },
  });
  if (!build) {
    await (this.prisma as any).revisionPass.update({ where: { id: passId }, data: { status: 'OPEN' } });
    throw new Error('No DevelopmentBuild linked to script ' + pass.scriptId + '; cannot render a version.');
  }
  const agg: any = await (this.prisma as any).buildVersion.aggregate({
    where: { buildId: build.id },
    _max: { n: true },
  });
  const maxN: number = agg?._max?.n ?? 0;
  const ver: any = await (this.prisma as any).buildVersion.create({
    data: {
      buildId: build.id,
      n: maxN + 1,
      label: 'V' + (maxN + 1),
      briefSnapshot: build.brief ?? undefined,
      status: 'DRAFT',
    },
  });
  const versionId = ver.id;

  // Supersede the changed scenes' prior facts, then persist the new ones.
  if (changedSceneIds.length) {
    await (this.prisma as any).canonFact.updateMany({
      where: { scriptId: pass.scriptId, sourceSceneId: { in: changedSceneIds }, status: 'ACTIVE' },
      data: { status: 'SUPERSEDED' },
    });
  }
  await this.persistFacts(pass.scriptId, allCandidates);
  await (this.prisma as any).decisionRecord.create({
    data: {
      scriptId: pass.scriptId,
      title: 'Render pass ' + passId.slice(0, 8),
      status: 'ACCEPTED',
      context: ordered.length + ' staged change(s) rendered into a new version.',
      decision: 'Applied: ' + ordered.map((o) => o.id.slice(0, 6)).join(', '),
      consequences:
        conflicts.length === 0
          ? 'No canon conflicts detected.'
          : 'Continuity conflicts: ' + conflicts.map((c) => c.reason).join(' | '),
      createdBy: userId ?? null,
    },
  });
  await (this.prisma as any).sceneChange.updateMany({
    where: { passId, status: 'STAGED' },
    data: { status: 'APPLIED' },
  });
  await (this.prisma as any).revisionPass.update({
    where: { id: passId },
    data: { status: 'RENDERED', continuityScore: score, renderedVersionId: versionId || null },
  });

  return { versionId, continuityScore: score, conflicts };
}
```

> At execution: confirm the `developmentBuild` ↔ script link field (`linkedScriptId`) and the `buildVersion` max-`n` query against the real client; the structured logic (`detectConflicts`, `orderChanges`, `continuityScore`) is already covered by Tasks 2/7/8.

- [ ] **Step 10: Add the controller route**

```ts
// scripton.controller.ts — inside the controller class
@Post('revision-pass/:passId/render')
async renderRevisionPass(@Param('passId') passId: string, @Body() body: any, @Req() req: any) {
  return this.canon.renderPass(passId, body?.projectId, req?.user?.id);
}
```
(Inject `private canon: CanonService` into the controller constructor; import it.)

- [ ] **Step 11: Run unit tests** — `cd backend && npm run test:unit`. Expected: all canon specs pass (Tasks 1,2,3,7,8 pure cores + Task 5 mapper).

- [ ] **Step 12: Build to typecheck the service/controller** — `cd backend && npx tsc --noEmit` (or `npm run build`). Expected: no type errors in the new files.

- [ ] **Step 13: End-to-end smoke against the staging DB** (proves the *wired* path, not just the pure cores). Document the result in the commit body.

  1. Seed a contradicting canon fact for a real script:
     `MARIAM / status / dead / "Mariam is killed in the raid." / validFrom=12 / sourceSceneId=<a real early scene id>`.
  2. Open a `RevisionPass` on that script's active `BuildVersion`; stage one `SceneChange` (`kind: 'CANON'`) on a *later* scene whose `previewAfter` prose has Mariam speaking, with `spec.sceneOrder` ≈ 20.
  3. `POST /production/scripton/revision-pass/:passId/render` with `{ projectId }`.
  4. **Assert:** response `continuityScore < 1` and `conflicts[0].reason` mentions `MARIAM`; a new `BuildVersion` row exists (`renderedVersionId` set); a `DecisionRecord` row records the conflict; the pass is `RENDERED`; the base `BuildVersion` is unchanged (non-destructive).
  5. Re-run the same render on a NOTE-only change (no prose) → `continuityScore === 1`, version still created (plumbing path still green).

  > The deterministic decision logic is already locked by `canon-assess.util.spec.ts` (Step 5–8); this smoke confirms the AI-extract + DB-commit wiring around it.

- [ ] **Step 14: Commit**

```bash
git add backend/src/production/scripton/canon/ backend/src/production/scripton/scripton.controller.ts
git commit -m "feat(scripon): Render=commit — extract→verify→new version+canon+decision (P0 loop proof)"
```

---

### Task 9: Wire canon **inject** into generation (closes the loop)

Without this, `canonDirective` (Task 3) is dead code and §8's "extract → **inject** → verify *wired into generation*" is unmet. Add a thin DB-loading wrapper and compose it next to `knowledgeDirective` at a real generate call, so the model is *handed* canon before it writes.

**Files:**
- Modify: `backend/src/production/scripton/canon/canon.service.ts` (add `directiveFor`)
- Modify: `backend/src/production/scripton/scripton.service.ts` (compose `canonDirective` into one scene-generation directive — confirmed join points: `:1137`, `:1176`, `:1063`, alongside the existing `knowledgeDirective(brief)`)
- Test: `backend/src/production/scripton/canon/canon-directive-for.spec.ts` (pure: stub the prisma read, assert it returns `canonDirective`'s output)

**Interfaces:**
- Consumes: `(this.prisma as any).canonFact.findMany`, `canonDirective` (Task 3), `CanonFactCore`.
- Produces: `CanonService.directiveFor(scriptId: string, at: number, subjects?: string[]): Promise<string>` — loads ACTIVE facts for the script and returns `canonDirective(facts, { at, subjects })`, or `''` on any error/empty.

- [ ] **Step 1: Write the failing test** (inject the prisma read via a tiny seam so it stays a pure unit)

```ts
// canon-directive-for.spec.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildDirective } from './canon.service';
import type { CanonFactCore } from './canon.types';

const fact: CanonFactCore = {
  kind: 'CHARACTER', subject: 'MARIAM', predicate: 'status', object: 'dead',
  statement: 'Mariam died in the raid.', validFrom: 12, validTo: null,
  status: 'ACTIVE', recordedAt: 0, sourceSceneId: 'sc12',
};

test('buildDirective emits the CANON block for facts live at the point', () => {
  const out = buildDirective([fact], 20);
  assert.match(out, /^CANON/);
  assert.match(out, /MARIAM — Mariam died in the raid\./);
});

test('buildDirective is empty when no facts are live yet', () => {
  assert.equal(buildDirective([fact], 5), '');
  assert.equal(buildDirective([], 20), '');
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement `buildDirective` (pure) + `directiveFor` (thin DB wrapper) in `canon.service.ts`**

```ts
// canon.service.ts — add
import { canonDirective } from './canon-inject.util';

/** Pure: facts → CANON steering block at a story point. Separated so it is unit-tested without the DB. */
export function buildDirective(facts: CanonFactCore[], at: number, subjects?: string[]): string {
  return canonDirective(facts, { at, subjects });
}

// inside CanonService:
async directiveFor(scriptId: string, at: number, subjects?: string[]): Promise<string> {
  try {
    const rows: any[] = await (this.prisma as any).canonFact.findMany({
      where: { scriptId, status: 'ACTIVE' },
    });
    return buildDirective(rows as CanonFactCore[], at, subjects);
  } catch {
    return '';
  }
}
```

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Compose it into the generation directive** — at the confirmed scene-generation site (e.g. `scripton.service.ts:1137`), where the code currently builds:

```ts
const dir = [await this.langDirective(brief), knowledgeDirective(brief)].filter(Boolean).join('\n');
```
change it to inject canon for the scene about to be written (the scene's story-order index is `at`):

```ts
const canonDir = scriptId ? await this.canon.directiveFor(scriptId, at) : '';
const dir = [await this.langDirective(brief), knowledgeDirective(brief), canonDir].filter(Boolean).join('\n');
```
> At execution: inject `CanonService` into `Scripon` service (or pass canon facts through), and confirm the in-scope `scriptId` + the scene-order variable name at that call site by reading the surrounding method. Keep the change to the *single* scene-generation path for P0; broader wiring is P2.

- [ ] **Step 6: Typecheck** — `cd backend && npx tsc --noEmit`. Expected: no errors.

- [ ] **Step 7: Run unit tests** — `cd backend && npm run test:unit`. Expected: all canon specs green, including `buildDirective`.

- [ ] **Step 8: Commit**

```bash
git add backend/src/production/scripton/canon/canon.service.* backend/src/production/scripton/scripton.service.ts
git commit -m "feat(scripon): inject live canon into scene generation (closes extract→inject→verify loop)"
```

---

### Task 10: OS shell — merge `GroupedRail` as the workspace rail

Make the shell hold all workspaces. Reuse the already-built `GroupedRail`; do not rebuild the layout. The ⌘K palette already works — leave it; canon-object addressing comes in a later phase (recon §4).

**Files:**
- Modify: `frontend/src/app/(dashboard)/layout.tsx` (mount `GroupedRail` with the 9 workspaces; keep the existing top bar + ⌘K)
- Reference: `frontend/src/components/workspace/GroupedRail.tsx` (`RailGroup`/`RailModule`/`RailPage`)

**Interfaces:**
- Consumes: `GroupedRail` and its `RailGroup` type.
- Produces: a left rail exposing `Home · Develop · Write · Canon · Doctor · Versions · Room · Slate · Studio` (spec §5). Canon/Versions/Room/Slate may route to placeholder pages this phase.

- [ ] **Step 1: Define the workspace rail config** (in the layout or a colocated `os-rail.config.ts`)

```ts
import type { RailGroup } from '@/components/workspace/GroupedRail';

// Order matches the Figma design authority (file dqUr3nasAkQIdefXcGDSyi): Write before Develop
// ("Write = the hero"). Note: spec §5 prose lists Develop before Write — the rendered design wins.
export const OS_WORKSPACES: RailGroup[] = [
  { id: 'story', label: 'Story', modules: [
    { id: 'home', label: 'Home', href: '/scripon' },
    { id: 'write', label: 'Write', href: '/scripon/write' },
    { id: 'develop', label: 'Develop', href: '/scripon/develop' },
    { id: 'canon', label: 'Canon', href: '/scripon/canon' },
    { id: 'doctor', label: 'Doctor', href: '/scripon/doctor' },
    { id: 'versions', label: 'Versions', href: '/scripon/versions' },
    { id: 'room', label: 'Room', href: '/scripon/room' },
    { id: 'slate', label: 'Slate', href: '/scripon/slate' },
    { id: 'studio', label: 'Studio', href: '/scripon/studio' },
  ]},
];
```
(Match the exact `RailGroup`/`RailModule` field names to `GroupedRail.tsx` at execution — read it first. The rail's visual target is the rail already drawn in the Figma file's Canon/Versions/Home frames.)

- [ ] **Step 2: Mount `GroupedRail` in the layout**, passing `OS_WORKSPACES`, preserving the existing top bar and the ⌘K palette mount. Keep the current sidebar behind a flag if other (non-ScripON) routes still need it.

- [ ] **Step 3: Verify in the browser** — `cd frontend && npm run dev`, open the ScripON route. Expected: the rail shows all 9 workspaces; active highlighting works; ⌘K still opens; Develop and Write still render their existing screens.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/(dashboard)/layout.tsx frontend/src/components/workspace/
git commit -m "feat(scripon): merge GroupedRail as the OS workspace rail (Home·Develop·Write·Canon·Doctor·Versions·Room·Slate·Studio)"
```

---

## Self-Review

**Spec coverage (against §4 kernel + §8 P0 + §10):**
- §4.1 canon graph (bi-temporal) → Tasks 1, 4. Semantic index over prose (RAPTOR/embeddings) → **deferred** (P2 Living-Canon; P0 proves the loop with structured facts, not the full vector index — noted as a scope cut).
- §4.1 extract → **inject** → verify loop, *wired into generation* → Task 5 (extract), **Task 9 (inject — now wired into the scene-generation directive, not dead code)**, Tasks 2/8 (verify). The verify+score decision is proven on real conflict data by `assessPass` (Task 8 Steps 5–8) and exercised end-to-end by the Task 8 Step 13 smoke.
- §4.2 version/decision store (no CRDT) → Tasks 6, 8. CRDT drafts/branch/merge + semantic diff → **deferred by decision** (later phase).
- §4.3 Revision Pass as staging; Render = commit → Task 8.
- §5 OS shell (rail) → Task 10. ⌘K already exists (recon); canon-object addressing deferred.
- §8 P0 proof "stage a NOTE SceneChange → Render → new version" → Task 8 (NOTE = plumbing path, Step 13.5; the *loop* is proven by the canon-conflict path, Step 13.1–4).
- §6 additive Prisma via drift-reconcile, one migration each → Tasks 4, 6.

**Advisor-round fixes folded in:** (1) inject is now wired into generation (Task 9) — was dead code; (2) the loop is proven on real conflict data via `assessPass` + the Step 13 smoke — the NOTE path alone only proved plumbing; (3) the re-render self-conflict bug is fixed via `factsExcludingScenes` + SUPERSEDED-on-commit, reconciling `resolveCanonAt` and `detectConflicts`; (4) the story clock (`sceneOrder`) source is named in Global Constraints with its deferred limitation; (5) missing-build now throws instead of silently rendering no version; (6) the `maxN` query uses the established aggregate pattern.

**Known deferrals (call out to the user, not silent cuts):** RAPTOR/embedding semantic index; CRDT version substrate; semantic diff view; stable scene-ordering (inserts/A-pages); the Canon/Versions/Room workspace *screens* (rail routes to placeholders this phase). These are P1–P4 per the spec roadmap.

**Placeholder scan:** pure-logic tasks (1,2,3,7,8,9) carry full real test code; DB/AI/controller tasks carry real code with one explicit "confirm against the file at execution" note each (LLM client path, build↔script link field, scene-order variable, `GroupedRail` field names) — verification reminders, not missing content.

**Type consistency:** `CanonFactCore` (subject/predicate/object/statement/validFrom/validTo/recordedAt/status/sourceSceneId) is used identically across Tasks 1, 2, 3, 5, 8, 9. `resolveCanonAt`, `detectConflicts`, `factsExcludingScenes`, `canonDirective`, `orderChanges`, `continuityScore`, `assessPass`, `mapAiFactsToCore`, `buildDirective`, `directiveFor`, `renderPass` signatures match between their defining task and every consumption site.

---

## Execution Handoff

P0 plan saved. Per the master spec §10 step 4, **the next gate is your approval of recon + this plan before any code**, and per your choice the **Figma design of the P0 shell + Canon + Versions comes after plan approval**. Do not start coding until both are signed off.
