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
import { scenePlanFor, PLANNER_FIELDS } from './scene-plan.util';

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
  assert.equal(SERVICE.includes('await this.storeScenePlan(revId, scenes, planSource, startIdx);'), true);
  assert.equal(SERVICE.includes('await this.storeScenePlan(revId, scenes, planSource);'), true);
});
