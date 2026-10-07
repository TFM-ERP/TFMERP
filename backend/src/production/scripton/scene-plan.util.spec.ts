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
import { scenePlanFor, PLANNER_FIELDS, scenePlanSubject, planStateNote, planStateFindings, clockBackwardPairs, CLOCK_PAIRS_SHOWN } from './scene-plan.util';
import { findingsEntry } from './revision-checks.util';
import { checkSurface, surfaceSummary } from './check-surface.util';

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

test('CLOSE-OUT 2 + 3 — the clock and the missing exits are FINDINGS; the counts are the note', () => {
  // RULED: as notes these could ride under a CLEAN state and an allClear summary. The division is
  // now findings for what was never checked, note for what is only provenance.
  const plan = scenePlanFor(PLAN_3.map((x: any) => ({ ...x, exits: undefined })), 'cards', { plannerCount: 7, cardsCount: 34 })!;
  const f = planStateFindings(plan, { clockDiscardedAt: 1 });
  const joined = f.map((x) => x.detail).join(' · ');
  assert.match(joined, /clock/i);
  assert.match(joined, /1 point/, 'how many points, not just that it happened');
  assert.match(joined, /discarded/i);
  assert.match(joined, /no exits/i);
  assert.match(joined, /cards/, 'and which list it came from');

  const note = planStateNote(plan, { clockDiscardedAt: 1 });
  assert.match(note, /7/); assert.match(note, /34/);
  assert.doesNotMatch(note, /clock/i, 'the clock is no longer a note');
});

test('CLOSE-OUT 2 — a clock that ran forwards says nothing about the clock', () => {
  const plan = scenePlanFor(PLAN_3, 'planner', { plannerCount: 3, cardsCount: 0 })!;
  assert.deepEqual(planStateFindings(plan, { clockDiscardedAt: 0 }), [],
    'silence is right when there is nothing to report');
  assert.doesNotMatch(planStateNote(plan, { clockDiscardedAt: 0 }), /no exits/i, 'PLAN_3 declares one');
});

test('CLOSE-OUT 2 — nothing to say at all is an empty note and no findings', () => {
  const plan = scenePlanFor(PLAN_3, 'planner')!;
  assert.equal(planStateNote(plan, { clockDiscardedAt: 0 }), '');
  assert.equal(planStateNote(null, { clockDiscardedAt: 0 }), '');
  assert.deepEqual(planStateFindings(plan, { clockDiscardedAt: 0 }), []);
});

test('CLOSE-OUT 2 — CONTROL: logging the discard leaves the row saying "found nothing"', () => {
  const plan = scenePlanFor(PLAN_3, 'planner', { plannerCount: 3, cardsCount: 0 })!;
  const silent = '';   // what run 1 recorded on the revision
  assert.equal(silent, '', 'the defect: the whole planned clock went, and the row was clean');
  const f = planStateFindings(plan, { clockDiscardedAt: 1 });
  assert.equal(f.length, 1);
  assert.match(f[0].detail, /clock/i);
  assert.equal(findingsEntry('planState', f, 'T').state, 'FINDINGS', 'and the state says so');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// CLOSE-OUT 1b — jsonb DOES NOT KEEP KEY ORDER, SO THE SUBJECT MUST NOT DEPEND ON IT.
//
// 70234b7 hashed the in-memory plan; a reader hashes the plan read back from the column. Postgres
// normalises jsonb key order, and on the real revision the two differ:
//
//   written     intExt,location,dayNight,brief,characters,exits,pageWeight,heading
//   read back   brief,exits,intExt,heading,dayNight,location,characters,pageWeight
//
// JSON.stringify follows insertion order, so the subjects differed and the row still read STALE on
// every revision — the same symptom as run 1, one layer further in. The subject is now built from
// POSITIONAL tuples, which have no key order to lose.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** What Postgres does to a jsonb document: same content, keys in its own order. */
const reorder = (v: any): any => {
  if (Array.isArray(v)) return v.map(reorder);
  if (v && typeof v === 'object') {
    const out: any = {};
    for (const k of Object.keys(v).sort((a, b) => (a.length - b.length) || a.localeCompare(b))) out[k] = reorder(v[k]);
    return out;
  }
  return v;
};

test('CLOSE-OUT 1b — the subject survives a round trip through jsonb key reordering', () => {
  const stored = scenePlanFor(PLAN_3, 'cards', { plannerCount: 7, cardsCount: 34 })!;
  const readBack = reorder(stored);
  assert.notDeepEqual(Object.keys(stored.scenes[0]), Object.keys(readBack.scenes[0]),
    'the probe must actually reorder, or it proves nothing');
  assert.equal(scenePlanSubject(stored), scenePlanSubject(readBack),
    'the subject must not depend on key order, because the column does not preserve it');
});

test('CLOSE-OUT 1b — exits survive reordering too', () => {
  const withExits = scenePlanFor(
    [{ intExt: 'EXT', location: 'ROAD', dayNight: 'DAY', brief: 'b', characters: 'A', pageWeight: 1, exits: [{ name: 'BREE', how: 'killed' }] }],
    'planner')!;
  const back = reorder(withExits);
  assert.deepEqual(Object.keys(back.scenes[0].exits[0]), ['how', 'name'], 'the probe reordered the exit');
  assert.equal(scenePlanSubject(withExits), scenePlanSubject(back));
});

test('CLOSE-OUT 1b — the real column key order is handled', () => {
  // the order Postgres actually returned on revision cmuwdflav001ykn1ym2dw69kl
  const stored = scenePlanFor(PLAN_3, 'cards')!;
  const asColumn = {
    at: stored.at, count: stored.count, scenes: stored.scenes.map((s: any) => ({
      brief: s.brief, exits: s.exits, intExt: s.intExt, heading: s.heading,
      dayNight: s.dayNight, location: s.location, characters: s.characters, pageWeight: s.pageWeight,
    })), source: stored.source, wroteFrom: stored.wroteFrom,
  };
  assert.equal(scenePlanSubject(stored), scenePlanSubject(asColumn as any));
});

test('CLOSE-OUT 1b — it still changes when the CONTENT changes', () => {
  const a = scenePlanFor(PLAN_3, 'cards')!;
  assert.notEqual(scenePlanSubject(a), scenePlanSubject(scenePlanFor(PLAN_3.slice(0, 2), 'cards')!));
  assert.notEqual(scenePlanSubject(a), scenePlanSubject(scenePlanFor(PLAN_3, 'planner')!));
  const edited = JSON.parse(JSON.stringify(PLAN_3)); edited[0].brief = 'different';
  assert.notEqual(scenePlanSubject(a), scenePlanSubject(scenePlanFor(edited, 'cards')!));
});

test('CLOSE-OUT 1b — CONTROL: a key-order-dependent subject reads STALE after the round trip', () => {
  const stored = scenePlanFor(PLAN_3, 'cards')!;
  const naive = (p: any) => JSON.stringify({ count: p.count, source: p.source, wroteFrom: p.wroteFrom, scenes: p.scenes });
  assert.notEqual(naive(stored), naive(reorder(stored)), 'the 70234b7 defect, reproduced');
  assert.equal(scenePlanSubject(stored), scenePlanSubject(reorder(stored)));
});

test('CLOSE-OUT 1b — EVERY field in the tuple is part of what is verified', () => {
  // Without this, dropping a field from the subject breaks no test: a plan could change in that
  // field and the verdict would still read FRESH. One probe per field, varied alone.
  const base = [{
    intExt: 'INT', location: 'KITCHEN', dayNight: 'NIGHT', brief: 'b', characters: 'A',
    exits: [{ name: 'BREE', how: 'killed' }], pageWeight: 1,
  }];
  const subject = scenePlanSubject(scenePlanFor(base, 'cards')!);
  const variants: Array<[string, any]> = [
    ['intExt', { intExt: 'EXT' }],
    ['location', { location: 'HALL' }],
    ['dayNight', { dayNight: 'DAY' }],
    ['brief', { brief: 'different' }],
    ['characters', { characters: 'B' }],
    ['pageWeight', { pageWeight: 2 }],
    ['exits.name', { exits: [{ name: 'ALDER', how: 'killed' }] }],
    ['exits.how', { exits: [{ name: 'BREE', how: 'drowned' }] }],
  ];
  for (const [field, patch] of variants) {
    const changed = scenePlanSubject(scenePlanFor([{ ...base[0], ...patch }], 'cards')!);
    assert.notEqual(changed, subject, field + ' is not part of the subject — a change there would read FRESH');
  }
  // heading is derived from intExt/location/dayNight, so it moves with them rather than alone
  assert.equal(scenePlanFor(base, 'cards')!.scenes[0].heading, 'INT. KITCHEN - NIGHT');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// CLOSE-OUT 2b — A DISCARDED CLOCK AND A MISSING EXIT GATE ARE FINDINGS, NOT NOTES.
//
// As notes they rode on the reason while the state stayed CLEAN, so surfaceSummary could report
// allClear over a draft written with NO planned clock and NO exit gate — an all-clear about a draft
// that two of its guards never covered. A planner-sourced zero stays a note: the planner looked and
// declared none, which is an answer. The two counts stay a note: provenance, not a defect.
// ─────────────────────────────────────────────────────────────────────────────────────────────

test('CLOSE-OUT 2b — a clock discarded in full is a FINDING', () => {
  const plan = scenePlanFor(PLAN_3, 'planner')!;
  const f = planStateFindings(plan, { clockDiscardedAt: 1 });
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'CLOCK_DISCARDED');
  assert.match(f[0].detail, /1 point/);
  assert.match(f[0].detail, /the writer was given no planned time/);
  // and NOT the claim that no time check ran: the page-side sweep reads the written pages and did
  assert.doesNotMatch(f[0].detail, /no time check had anything to read/);
  assert.match(f[0].detail, /page-side clock check still ran/);
  assert.equal(f[0].scenes.length, 0, 'the whole draft, not one scene');
});

test('CLOSE-OUT 2b — a cards-sourced plan that CANNOT declare exits is a FINDING', () => {
  const cards = scenePlanFor(PLAN_3.map((x: any) => ({ ...x, exits: undefined })), 'cards')!;
  const f = planStateFindings(cards, { clockDiscardedAt: 0 });
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'NO_EXIT_GATE');
  assert.match(f[0].detail, /no exits/i);
  assert.match(f[0].detail, /cards/);
});

test('CLOSE-OUT 2b — a PLANNER-sourced zero stays a note, not a finding', () => {
  const planner = scenePlanFor(PLAN_3.map((x: any) => ({ ...x, exits: undefined })), 'planner')!;
  assert.deepEqual(planStateFindings(planner, { clockDiscardedAt: 0 }), [],
    'the planner looked and declared none — that is an answer, not a gap');
  assert.match(planStateNote(planner, { clockDiscardedAt: 0 }), /no exits/i);
});

test('CLOSE-OUT 2b — the counts stay a note', () => {
  const plan = scenePlanFor(PLAN_3, 'cards', { plannerCount: 7, cardsCount: 34 })!;
  assert.deepEqual(planStateFindings(plan, { clockDiscardedAt: 0 }), []);
  assert.match(planStateNote(plan, { clockDiscardedAt: 0 }), /planner 7 vs cards 34/);
});

test('CLOSE-OUT 2b — both at once is two findings', () => {
  const cards = scenePlanFor(PLAN_3.map((x: any) => ({ ...x, exits: undefined })), 'cards', { plannerCount: 7, cardsCount: 34 })!;
  const f = planStateFindings(cards, { clockDiscardedAt: 3 });
  assert.deepEqual(f.map((x) => x.kind).sort(), ['CLOCK_DISCARDED', 'NO_EXIT_GATE']);
});

test('CLOSE-OUT 2b — a clean plan with a clock yields no findings at all', () => {
  const plan = scenePlanFor(PLAN_3, 'planner')!;   // PLAN_3 declares one exit
  assert.deepEqual(planStateFindings(plan, { clockDiscardedAt: 0 }), []);
  assert.deepEqual(planStateFindings(null, { clockDiscardedAt: 0 }), []);
});

test('CLOSE-OUT 2b — CONTROL: as notes, the summary could call it all clear', () => {
  const cards = scenePlanFor(PLAN_3.map((x: any) => ({ ...x, exits: undefined })), 'cards')!;
  // what 50f8bec did: the facts on the reason, state untouched
  const asNote = findingsEntry('planState', [], scenePlanSubject(cards));
  assert.equal(asNote.state, 'CLEAN');
  assert.equal(surfaceSummary(checkSurface({ planState: asNote }, { plan: scenePlanSubject(cards) })).findings, 0,
    'the defect: no planned clock, no exit gate, and nothing counted');
  // now, as findings
  const asFindings = findingsEntry('planState', planStateFindings(cards, { clockDiscardedAt: 1 }), scenePlanSubject(cards));
  assert.equal(asFindings.state, 'FINDINGS');
  assert.equal(asFindings.items.length, 2);
  assert.equal(surfaceSummary(checkSurface({ planState: asFindings }, { plan: scenePlanSubject(cards) })).allClear, false);
});

/**
 * CLOCK_DISCARDED NAMES ITS POINTS — Plan 01 close-out 2, commit 3.1.
 *
 * extractPlanState drops the WHOLE planned clock when it runs backwards at any point, on the sound
 * grounds that handing a broken timeline to a hundred scene prompts would spread the damage. Only
 * the COUNT survived clock.clear(), so the finding could say "2 points" and nothing more — and the
 * planning model's reply is not persisted either, so the read-out could not enumerate them from
 * anything. The pairs are kept before the map is cleared and travel onto the finding.
 *
 * `scenes` STAYS EMPTY. 26a53f5 ruled that CLOCK_DISCARDED carries no scene on purpose: it is a
 * property of the draft, and at a midnight crossing the scene it would name is not even at fault —
 * the scene is right and the rule reading it is wrong.
 *
 * A different story from the fixtures above, per the standing rule: an invented morning schedule.
 */
const MORNING = [
  { scene: 1, minutes: 7 * 60 + 30 },
  { scene: 2, minutes: 8 * 60 + 15 },
  { scene: 3, minutes: 9 * 60 },
];
const pairDetail = (pairs: any[], dropped = pairs.length) =>
  planStateFindings(null, { clockDiscardedAt: dropped, clockBackwards: pairs }).find((f) => f.kind === 'CLOCK_DISCARDED')!;

test('a monotonic schedule has no backward pair', () => {
  assert.deepEqual(clockBackwardPairs(MORNING), []);
});

test('one step backwards is one pair, with both scenes and both times', () => {
  const p = clockBackwardPairs([MORNING[0], MORNING[1], { scene: 3, minutes: 8 * 60 }]);
  assert.equal(p.length, 1);
  assert.deepEqual(p[0], { fromScene: 2, fromMinutes: 495, toScene: 3, toMinutes: 480 });
});

test('two steps backwards are two pairs, in scene order', () => {
  const p = clockBackwardPairs([
    { scene: 1, minutes: 600 }, { scene: 2, minutes: 540 },
    { scene: 3, minutes: 700 }, { scene: 4, minutes: 660 },
  ]);
  assert.equal(p.length, 2);
  assert.deepEqual(p.map((x) => x.toScene), [2, 4]);
});

test('equal adjacent times are not a step backwards', () => {
  assert.deepEqual(clockBackwardPairs([{ scene: 1, minutes: 480 }, { scene: 2, minutes: 480 }]), []);
});

test('the pairs are read in scene order whatever order they arrive in', () => {
  const shuffled = [{ scene: 3, minutes: 480 }, { scene: 1, minutes: 450 }, { scene: 2, minutes: 495 }];
  assert.deepEqual(clockBackwardPairs(shuffled), clockBackwardPairs([...shuffled].sort((a, b) => a.scene - b.scene)));
});

test('clockBackwardPairs().length is the count extractPlanState computes — six shapes', () => {
  const shapes = [
    [], [{ scene: 1, minutes: 60 }],
    MORNING,
    [{ scene: 1, minutes: 480 }, { scene: 2, minutes: 480 }],
    [{ scene: 1, minutes: 1380 }, { scene: 2, minutes: 0 }],
    [{ scene: 1, minutes: 600 }, { scene: 2, minutes: 540 }, { scene: 3, minutes: 700 }, { scene: 4, minutes: 660 }],
  ];
  for (const times of shapes) {
    const sorted = [...times].sort((a, b) => a.scene - b.scene).map((t) => [t.scene, t.minutes]);
    // the expression in extractPlanState, verbatim
    const backwards = sorted.filter((t, i) => i > 0 && t[1] < sorted[i - 1][1]).length;
    assert.equal(clockBackwardPairs(times).length, backwards, JSON.stringify(times));
  }
});

test('CONTROL: the finding NAMES the points — scene and time, both sides', () => {
  const f = pairDetail(clockBackwardPairs([MORNING[0], MORNING[1], { scene: 3, minutes: 8 * 60 }]));
  assert.match(f.detail, /scene 2 08:15 → scene 3 08:00/,
    'only the count used to survive clock.clear(); the pairs are the fact a reader needs');
});

test('CONTROL: scenes stays EMPTY on CLOCK_DISCARDED, pairs or none — 26a53f5', () => {
  assert.deepEqual(pairDetail(clockBackwardPairs([{ scene: 1, minutes: 600 }, { scene: 2, minutes: 540 }])).scenes, []);
  assert.deepEqual(pairDetail([], 2).scenes, [], 'a whole-draft finding says "the whole draft", never a scene');
});

test('more pairs than are shown: the first few, then a count', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ fromScene: i * 2 + 1, fromMinutes: 600, toScene: i * 2 + 2, toMinutes: 540 }));
  const f = pairDetail(many);
  assert.equal((f.detail.match(/scene \d+ \d\d:\d\d → scene \d+ \d\d:\d\d/g) || []).length, CLOCK_PAIRS_SHOWN);
  assert.match(f.detail, new RegExp('and ' + (9 - CLOCK_PAIRS_SHOWN) + ' more'));
});

test('the count still leads, and the loss is still named', () => {
  const f = pairDetail(clockBackwardPairs([{ scene: 1, minutes: 1380 }, { scene: 2, minutes: 0 }]));
  assert.match(f.detail, /ran backwards at 1 point and was discarded in full/);
  assert.match(f.detail, /the writer was given no planned time for any scene/);
  assert.match(f.detail, /the page-side clock check still ran/);
});

test('no pairs supplied: the finding is unchanged from before this commit', () => {
  const f = pairDetail([], 2);
  assert.match(f.detail, /ran backwards at 2 points and was discarded in full/);
  assert.doesNotMatch(f.detail, /→/, 'nothing to name, so nothing is claimed');
});

test('the full planned clock goes on the NOTE, with a count, not on the finding', () => {
  const note = planStateNote(null, { clockDiscardedAt: 1, clockPlanned: MORNING });
  assert.match(note, /planned clock: scene 1 07:30 · scene 2 08:15 · scene 3 09:00/);
  assert.match(note, /3 scenes timed/);
});
