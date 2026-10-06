/**
 * Plan 01 task 5 — what a stored plan is.
 *
 * The decisive tests are (1) every planner field survives, `exits` above all; (2) no plan and an
 * empty plan are different facts; and (3) what is stored is the PLAN, not the materialised scenes.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scenePlanFor, PLANNER_FIELDS, scenePlanSubject, planStateNote } from './scene-plan.util';
import { findingsEntry } from './revision-checks.util';
import { checkSurface } from './check-surface.util';

/** The planner's own contract, from scripton.service.ts:3082's parse(). */
const PLAN_3 = [
  {
    intExt: 'INT', location: 'KITCHEN', dayNight: 'NIGHT',
    brief: 'She finds the drawer open.', characters: 'ALDER, BREE', pageWeight: 1,
  },
  {
    intExt: 'EXT', location: 'DOCK ROAD', dayNight: 'DAY',
    brief: 'The car does not stop.', characters: 'ALDER',
    exits: [{ name: 'BREE', how: 'killed in the collision' }], pageWeight: 2,
  },
  {
    intExt: 'INT', location: 'HALL', dayNight: 'DAY',
    brief: 'The hearing opens.', characters: 'ALDER, THE CHAIR', pageWeight: 0.5,
  },
];

test('every planner field survives, plus the derived heading', () => {
  const s = scenePlanFor(PLAN_3)!;
  assert.equal(s.count, 3);
  assert.equal(s.scenes.length, 3);
  assert.deepEqual(Object.keys(s.scenes[0]).sort(),
    ['brief', 'characters', 'dayNight', 'exits', 'heading', 'intExt', 'location', 'pageWeight']);
  assert.deepEqual([...PLANNER_FIELDS].sort(),
    ['brief', 'characters', 'dayNight', 'exits', 'intExt', 'location', 'pageWeight']);
});

test('exits survive — they are the reason the plan is worth storing at all', () => {
  const s = scenePlanFor(PLAN_3)!;
  const withExits = s.scenes.filter((x: any) => Array.isArray(x.exits) && x.exits.length);
  assert.equal(withExits.length, 1);
  assert.deepEqual(withExits[0].exits, [{ name: 'BREE', how: 'killed in the collision' }]);
  assert.deepEqual(Object.keys(withExits[0].exits[0]).sort(), ['how', 'name']);
});

test('CONTROL — a lossy projection drops exits and with them every exit finding', () => {
  const lossy = PLAN_3.map((x: any) => ({ heading: x.location, brief: x.brief, characters: x.characters }));
  assert.equal('exits' in lossy[1], false, 'the defect this task existed to avoid');
  assert.equal('exits' in scenePlanFor(PLAN_3)!.scenes[1], true);
});

test('a scene with no exits stores an empty list, not a missing field', () => {
  const s = scenePlanFor(PLAN_3)!;
  assert.deepEqual(s.scenes[0].exits, [],
    'absent and empty must not read the same on a field that decides who may speak again');
});

test('the heading is derived from the planner fields, not invented', () => {
  const s = scenePlanFor(PLAN_3)!;
  assert.equal(s.scenes[0].heading, 'INT. KITCHEN - NIGHT');
  assert.equal(s.scenes[1].heading, 'EXT. DOCK ROAD - DAY');
  // a plan missing its parts still produces something readable rather than "undefined. - undefined"
  assert.equal(scenePlanFor([{ brief: 'x' }])!.scenes[0].heading, '');
});

test('no plan is null; an empty plan is a stored empty plan', () => {
  assert.equal(scenePlanFor(null), null);
  assert.equal(scenePlanFor(undefined), null);
  assert.equal(scenePlanFor('nonsense' as any), null);
  const empty = scenePlanFor([])!;
  assert.notEqual(empty, null);
  assert.equal(empty.count, 0);
  assert.deepEqual(empty.scenes, []);
});

test('CONTROL — storing [] for a failed plan erases the distinction', () => {
  const lenient = (p: any) => ({ count: (p || []).length, scenes: p || [] });
  assert.equal(lenient(null).count, 0, 'the defect: a planning failure reads as an empty plan');
  assert.equal(scenePlanFor(null), null);
});

test('what is stored is the PLAN, not the materialised scenes', () => {
  // The 2 Oct run: 81 planned, 85 ScriptScene rows — four unnumbered CONTINUOUS sub-headings.
  const planned = Array.from({ length: 81 }, (_, i) => ({ intExt: 'INT', location: 'R' + i, dayNight: 'DAY', brief: 'b', characters: 'ALDER', pageWeight: 1 }));
  const s = scenePlanFor(planned)!;
  assert.equal(s.count, 81);
  assert.notEqual(s.count, 85, '85 is the row count from re-parsing the written pages — a different list');
});

test('junk inside a plan is carried as junk, not as a crash or a silent drop', () => {
  const s = scenePlanFor([null, { brief: 'real' }, 7] as any)!;
  assert.equal(s.count, 3, 'the count is what the planner returned, however poor');
  assert.equal(s.scenes[1].brief, 'real');
  assert.deepEqual(s.scenes[0].exits, []);
});

test('the projection never throws', () => {
  for (const bad of [null, undefined, 0, '', 'x', {}, [undefined], [[]]] as any[]) {
    assert.doesNotThrow(() => scenePlanFor(bad));
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// TASK 5 FIX — STORE THE LIST THE WRITER IS ACTUALLY HANDED, AND SAY WHICH IT WAS.
//
// `planned` is not what the writer gets. When the developed SCENES cards outnumber the planner's
// list the cards win (service :5170, :5739), and whichever list wins is then re-weighted
// (applyPageWeights) and cast-stripped (stripExitedCast) before a single scene is written. Storing
// `planned` recorded a list that may never have reached the writer at all — and said nothing about
// which one did.
// ─────────────────────────────────────────────────────────────────────────────────────────────

test('TASK 5 FIX — the source is recorded, and the stored scenes are the ones passed in', () => {
  const fromCards = scenePlanFor(PLAN_3, 'cards')!;
  assert.equal(fromCards.source, 'cards');
  assert.equal(fromCards.count, 3);
  const fromPlanner = scenePlanFor(PLAN_3, 'planner')!;
  assert.equal(fromPlanner.source, 'planner');
});

test('TASK 5 FIX — a stored plan always says where it came from', () => {
  for (const src of ['planner', 'cards'] as const) {
    assert.equal(scenePlanFor(PLAN_3, src)!.source, src);
  }
  // and the default is explicit rather than silently 'planner'
  assert.equal(scenePlanFor(PLAN_3)!.source, 'unknown',
    'a caller that does not say must not be recorded as the planner');
});

test('TASK 5 FIX — the extend path records the index it wrote from', () => {
  const s = scenePlanFor(PLAN_3, 'cards', { wroteFrom: 2 })!;
  assert.equal(s.wroteFrom, 2);
  assert.equal(scenePlanFor(PLAN_3, 'planner')!.wroteFrom, null,
    'a fresh run wrote from the top; null says "not an extend", which 0 would not');
  assert.equal(scenePlanFor(PLAN_3, 'cards', { wroteFrom: 0 })!.wroteFrom, 0,
    'an extend that found nothing written still says 0, not null');
});

test('TASK 5 FIX — re-weighting and cast-stripping are reflected, because the LIST is stored', () => {
  // what the writer is handed after applyPageWeights and stripExitedCast
  const handed = [
    { intExt: 'INT', location: 'KITCHEN', dayNight: 'NIGHT', brief: 'b', characters: 'ALDER', pageWeight: 1.5 },
    { intExt: 'EXT', location: 'DOCK ROAD', dayNight: 'DAY', brief: 'b', characters: '', exits: [{ name: 'BREE', how: 'killed' }], pageWeight: 2.5 },
  ];
  const s = scenePlanFor(handed, 'cards')!;
  assert.equal(s.scenes[0].pageWeight, 1.5, 'the re-weighted value, not the planner\'s 1');
  assert.equal(s.scenes[1].characters, '', 'the stripped cast, not the plan\'s');
  assert.deepEqual(s.scenes[1].exits, [{ name: 'BREE', how: 'killed' }]);
});

test('TASK 5 FIX — CONTROL: storing the planner list hides which list was written', () => {
  const planner = [{ intExt: 'INT', location: 'A', dayNight: 'DAY', brief: 'p', characters: 'X', pageWeight: 1 }];
  const cards = [
    { intExt: 'INT', location: 'A', dayNight: 'DAY', brief: 'p', characters: 'X', pageWeight: 1 },
    { intExt: 'EXT', location: 'B', dayNight: 'DAY', brief: 'c', characters: 'Y', pageWeight: 1 },
  ];
  // cards outnumber the plan, so the cards win and the writer never sees `planner`
  const stored = scenePlanFor(cards, 'cards')!;
  assert.equal(stored.count, 2);
  assert.notEqual(stored.count, scenePlanFor(planner, 'planner')!.count,
    'the two lists differ — which is why the stored one must say which it is');
  assert.equal(stored.source, 'cards');
});

test('TASK 5 FIX — null is still null, with a source and without one', () => {
  assert.equal(scenePlanFor(null, 'cards'), null);
  assert.equal(scenePlanFor(null, 'planner', { wroteFrom: 3 }), null);
});

// ── WHERE THE WRITE SITS. A wiring invariant, so it is tested as wiring. ─────────────────────
//
// The plan was written AFTER saveRev, at the end of the run: a run that died mid-script — a
// provider outage, a restart, the low-memory killer — lost the plan it had been writing from and
// left a half-written revision nothing could be compared against. The plan is known at planning
// time and revId exists there already, so there is no reason to wait for the last page.
//
// Nothing reachable from a unit can observe that ordering, and asserting it in prose is how it
// came back. These read the service and fail if the write moves.

const SERVICE = readFileSync(join(__dirname, 'scripton.service.ts'), 'utf8');
const lineOf = (i: number) => SERVICE.slice(0, i).split('\n').length;
const allOf = (re: RegExp) => [...SERVICE.matchAll(re)].map((m) => m.index as number);

/**
 * Method boundaries, so ordering is judged WITHIN a method. The first version of the test below
 * compared each store against the next writeScene anywhere in the file, which a store moved to the
 * end of its own method still satisfied — the next writeScene was simply the OTHER path's. A
 * control that fires nothing is a test that is not testing.
 */
const methodStarts = allOf(/\n  (?:private )?(?:async )?[a-zA-Z_][\w]*\(/g);
const methodAround = (i: number): [number, number] => {
  const start = methodStarts.filter((m) => m < i).pop() ?? 0;
  const end = methodStarts.filter((m) => m > i)[0] ?? SERVICE.length;
  return [start, end];
};

test('WIRING — the plan is stored BEFORE the first scene is written, in the SAME method', () => {
  const stores = allOf(/await this\.storeScenePlan\(/g);
  const writes = allOf(/await this\.writeScene\(/g);
  assert.equal(stores.length, 2, 'one write per feature path');
  for (const st of stores) {
    const [from, to] = methodAround(st);
    const inHere = writes.filter((w) => w > from && w < to);
    assert.ok(inHere.length > 0,
      'the store at line ' + lineOf(st) + ' is in a method that writes no scene — wrong method');
    assert.ok(st < inHere[0],
      'store at line ' + lineOf(st) + ' must precede this method\'s first writeScene at line ' + lineOf(inHere[0]));
  }
});

test('WIRING — a run that dies mid-script keeps its plan: nothing writes it after saveRev', () => {
  // the regression this replaces, verbatim
  assert.equal(SERVICE.includes('scenePlan: scenePlanFor(planned)'), false,
    'the end-of-run write is gone');
  // and the only write is the guarded one inside storeScenePlan
  const direct = allOf(/data: \{ scenePlan:/g);
  assert.equal(direct.length, 1, 'exactly one place writes the column');
  const def = SERVICE.indexOf('private async storeScenePlan');
  const defEnd = SERVICE.indexOf('\n  private async', def + 10);
  assert.ok(direct[0] > def && direct[0] < defEnd, 'and it is inside storeScenePlan');
});

test('WIRING — both paths go through the ONE function, and it decides the source itself', () => {
  assert.equal(SERVICE.match(/private async storeScenePlan/g)!.length, 1);
  assert.equal(SERVICE.match(/await this\.storeScenePlan\(revId, scenes, planSource/g)!.length, 2,
    'both call sites pass the list the writer is handed, not `planned`');
  assert.equal(SERVICE.match(/const planSource: 'planner' \| 'cards'/g)!.length, 2,
    'decided where the choice is made, before scenes is reassigned');
  assert.equal(SERVICE.includes('storeScenePlan(revId, planned'), false,
    'never the planner list, which the writer may never have seen');
});

test('WIRING — the extend path records the index it wrote from; the fresh path does not', () => {
  // The GUARANTEE, not the literal call text: an earlier version of this test pinned the exact
  // argument list and went red the moment a new argument was added, which says nothing about
  // whether the index is still passed. Each call site is read to its closing paren instead.
  const calls = allOf(/await this\.storeScenePlan\(/g).map((i) => {
    let depth = 0;
    for (let j = i; j < SERVICE.length; j++) {
      if (SERVICE[j] === '(') depth++;
      else if (SERVICE[j] === ')') { depth--; if (depth === 0) return SERVICE.slice(i, j + 1); }
    }
    return SERVICE.slice(i, i + 400);
  });
  assert.equal(calls.length, 2, 'one call per feature path');
  const withIndex = calls.filter((c) => /\bstartIdx\b/.test(c));
  assert.equal(withIndex.length, 1, 'exactly one path writes from an index — the extend path');
  // and both now carry the two counts, so "which list won" is checkable on either path
  assert.equal(calls.filter((c) => /plannerCount/.test(c) && /cardsCount/.test(c)).length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// CLOSE-OUT 1 — THE planState FINGERPRINT MUST BE OVER WHAT IS STORED.
//
// Run 1 proved it: the entry was stored CLEAN and read back STALE. The fingerprint was taken over
// JSON.stringify(scenes) — the RAW handed array — while the column stores the normalised
// projection, so no reader could reproduce the hash from anything available. A verdict that reads
// STALE forever means nothing, which is exactly why readCheckEntry refuses to staleness-check
// plan.tail. Making `plan` comparable and then hashing something unstorable was worse than leaving
// it uncomparable.
// ─────────────────────────────────────────────────────────────────────────────────────────────

test('CLOSE-OUT 1 — the subject is reproducible from the column', () => {
  const stored = scenePlanFor(PLAN_3, 'cards', { wroteFrom: null }, new Date('2026-10-06T07:44:50Z'))!;
  // a second store of the same list, a minute later: same content, different `at`
  const again = scenePlanFor(PLAN_3, 'cards', { wroteFrom: null }, new Date('2026-10-06T07:45:50Z'))!;
  assert.notEqual(stored.at, again.at);
  assert.equal(scenePlanSubject(stored), scenePlanSubject(again),
    'the subject must not depend on WHEN it was taken, or it cannot be reproduced');
});

test('CLOSE-OUT 1 — the subject changes when the plan changes', () => {
  const a = scenePlanFor(PLAN_3, 'cards')!;
  assert.notEqual(scenePlanSubject(a), scenePlanSubject(scenePlanFor(PLAN_3.slice(0, 2), 'cards')!), 'fewer scenes');
  assert.notEqual(scenePlanSubject(a), scenePlanSubject(scenePlanFor(PLAN_3, 'planner')!), 'a different source');
  assert.notEqual(scenePlanSubject(a), scenePlanSubject(scenePlanFor(PLAN_3, 'cards', { wroteFrom: 2 })!), 'a different index');
});

test('CLOSE-OUT 1 — no plan is an empty subject, not a crash', () => {
  assert.equal(scenePlanSubject(null), '');
  assert.equal(scenePlanSubject(undefined), '');
});

test('CLOSE-OUT 1 — FRESH against the column, STALE when the column changes', () => {
  const stored = scenePlanFor(PLAN_3, 'cards')!;
  const entry = findingsEntry('planState', [], scenePlanSubject(stored));
  assert.equal(entry.state, 'CLEAN');
  assert.equal(entry.subject, 'plan');

  // a reader with the column in hand
  const fresh = checkSurface({ planState: entry }, { plan: scenePlanSubject(stored) });
  const row = fresh.find((r) => r.kind === 'planState')!;
  assert.equal(row.staleness, 'FRESH');
  assert.equal(row.display, 'CLEAN', 'the run-1 defect: this read STALE on a clean verdict');

  // the column is rewritten with a different plan
  const changed = scenePlanFor(PLAN_3.slice(0, 2), 'cards')!;
  const after = checkSurface({ planState: entry }, { plan: scenePlanSubject(changed) });
  assert.equal(after.find((r) => r.kind === 'planState')!.display, 'STALE');
});

test('CLOSE-OUT 1 — CONTROL: hashing the raw handed list cannot be verified from the column', () => {
  const stored = scenePlanFor(PLAN_3, 'cards')!;
  const raw = findingsEntry('planState', [], JSON.stringify(PLAN_3));          // what run 1 did
  const read = checkSurface({ planState: raw }, { plan: scenePlanSubject(stored) });
  assert.equal(read.find((r) => r.kind === 'planState')!.display, 'STALE', 'the defect, reproduced');
  const fixed = findingsEntry('planState', [], scenePlanSubject(stored));
  assert.equal(checkSurface({ planState: fixed }, { plan: scenePlanSubject(stored) })
    .find((r) => r.kind === 'planState')!.display, 'CLEAN');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// CLOSE-OUT 2 + 3 — WHAT RUN 1 KNEW AND DID NOT WRITE DOWN.
//
// Run 1 logged "the planned clock runs backwards at 1 point(s) — dropping it" and nothing reached
// the revision: the whole planned clock was discarded and the row said the sweep "found nothing".
// And the plan it stored carried 0 exits across all 34 scenes — not because the planner declared
// none, but because sceneCards (:2949) maps five fields and no `exits` at all, so a cards-sourced
// plan structurally CANNOT declare one. Neither fact was anywhere a reader would find it.
// ─────────────────────────────────────────────────────────────────────────────────────────────

test('CLOSE-OUT 3 — the plan records both counts, so "cards won" is checkable', () => {
  const s = scenePlanFor(PLAN_3, 'cards', { plannerCount: 7, cardsCount: 34 })!;
  assert.equal(s.source, 'cards');
  assert.equal(s.plannerCount, 7);
  assert.equal(s.cardsCount, 34);
  // run 1: the planner's own list was never stored, and could only be INFERRED from output tokens
  assert.notEqual(s.plannerCount, s.cardsCount);
});

test('CLOSE-OUT 3 — unknown counts are null, never 0', () => {
  const s = scenePlanFor(PLAN_3, 'planner')!;
  assert.equal(s.plannerCount, null, 'a caller that did not say must not read as "the planner returned none"');
  assert.equal(s.cardsCount, null);
  assert.equal(scenePlanFor(PLAN_3, 'cards', { plannerCount: 0, cardsCount: 0 })!.plannerCount, 0,
    'a real zero is a real zero');
});

test('CLOSE-OUT 3 — a list that declares no exits says so', () => {
  const none = scenePlanFor(PLAN_3.map((x: any) => ({ ...x, exits: undefined })), 'cards')!;
  assert.equal(none.exitsDeclared, 0);
  assert.equal(scenePlanFor(PLAN_3, 'planner')!.exitsDeclared, 1, 'PLAN_3 has one');
});

test('CLOSE-OUT 2 + 3 — the planState note names the clock discard and the missing exits', () => {
  const plan = scenePlanFor(PLAN_3.map((x: any) => ({ ...x, exits: undefined })), 'cards', { plannerCount: 7, cardsCount: 34 })!;
  const note = planStateNote(plan, { clockDiscardedAt: 1 });
  assert.match(note, /clock/i);
  assert.match(note, /1 point/, 'how many points, not just that it happened');
  assert.match(note, /discarded/i);
  assert.match(note, /no exits/i);
  assert.match(note, /cards/, 'and which list it came from');
  assert.match(note, /7/); assert.match(note, /34/);
});

test('CLOSE-OUT 2 — a clock that ran forwards says nothing about the clock', () => {
  const plan = scenePlanFor(PLAN_3, 'planner', { plannerCount: 3, cardsCount: 0 })!;
  const note = planStateNote(plan, { clockDiscardedAt: 0 });
  assert.doesNotMatch(note, /clock/i, 'silence is right when there is nothing to report');
  assert.doesNotMatch(note, /no exits/i, 'PLAN_3 declares one');
});

test('CLOSE-OUT 2 — nothing to say at all is an empty note, not a sentence about nothing', () => {
  const plan = scenePlanFor(PLAN_3, 'planner')!;
  assert.equal(planStateNote(plan, { clockDiscardedAt: 0 }), '');
  assert.equal(planStateNote(null, { clockDiscardedAt: 0 }), '');
});

test('CLOSE-OUT 2 — CONTROL: logging the discard leaves the row saying "found nothing"', () => {
  const plan = scenePlanFor(PLAN_3, 'planner', { plannerCount: 3, cardsCount: 0 })!;
  const silent = '';   // what run 1 recorded
  assert.equal(silent, '', 'the defect: the whole planned clock went, and the row was clean');
  assert.match(planStateNote(plan, { clockDiscardedAt: 1 }), /clock/i);
});
