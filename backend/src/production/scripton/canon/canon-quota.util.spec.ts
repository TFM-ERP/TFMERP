import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { selectCanonByQuota, quotaSummary, quotaShortfall, DEFAULT_FLOORS, PROHIBITION_LIMIT, UNDROPPABLE_KINDS } from './canon-quota.util';
import { prohibitionDirective, canonDirective } from './canon-inject.util';
import { mapAiFactsToCore } from './canon-map.util';
import type { CanonFactCore, CanonKind } from './canon.types';

// The predicate is derived from the kind, because canonDirective resolves supersession on
// subject+predicate: two facts about GIDEON sharing one predicate mean the later SUPERSEDES the
// earlier and only one reaches the prompt. The extraction prompt assigns a distinct predicate per
// kind (is_antagonist, is_crime, permitted, occurs_before) for exactly this reason — a fixture that
// reuses one predicate tests the resolver, not the quota. See the supersession test at the end.
const f = (kind: CanonKind, statement: string, subject = 'X', predicate?: string): CanonFactCore => ({
  kind, subject, predicate: predicate || ('p_' + kind.toLowerCase()), object: 'o', statement,
  validFrom: 0, validTo: null, status: 'ACTIVE',
});
const many = (kind: CanonKind, n: number) => Array.from({ length: n }, (_, i) => f(kind, kind + ' ' + i));

// THE MEASURED FAILURE: 30 facts came back as CHARACTER 21, RELATIONSHIP 6, TIMELINE 1, WORLD 1,
// PLOT 1. Structure got nothing, so four sentences the source states outright reached no stage.
const BIOGRAPHY_FLOOD = [...many('CHARACTER', 40), ...many('RELATIONSHIP', 15), ...many('TIMELINE', 10)];

test('THE REGRESSION: biography cannot crowd structure out of the budget', () => {
  const structural = [...many('ROLE', 4), ...many('CAUSATION', 4), ...many('CRIME', 2)];
  // Biography FIRST in the list — the order that starved structure under a flat slice.
  const r = selectCanonByQuota([...BIOGRAPHY_FLOOD, ...structural], { total: 30 });
  assert.equal(r.facts.filter((x) => x.kind === 'ROLE').length, 4, 'every ROLE fact survived: ' + quotaSummary(r.counts));
  assert.equal(r.facts.filter((x) => x.kind === 'CAUSATION').length, 4);
  assert.equal(r.facts.filter((x) => x.kind === 'CRIME').length, 2);
  const flat = [...BIOGRAPHY_FLOOD, ...structural].slice(0, 30);
  assert.equal(flat.filter((x) => x.kind === 'ROLE').length, 0, 'the old behaviour, pinned');
});

test('the total budget is respected', () => {
  const r = selectCanonByQuota(BIOGRAPHY_FLOOD, { total: 30 });
  assert.equal(r.facts.length, 30);
  assert.equal(r.dropped, BIOGRAPHY_FLOOD.length - 30);
});

test('a floor is a MINIMUM, not a maximum — spare room goes to structure, not more ages', () => {
  const r = selectCanonByQuota([...many('ROLE', 12), ...many('CHARACTER', 5)], { total: 30 });
  assert.equal(r.facts.filter((x) => x.kind === 'ROLE').length, 12, 'all twelve fit, floor of 6 notwithstanding');
  assert.equal(r.facts.filter((x) => x.kind === 'CHARACTER').length, 5);
});

test('a source with no structure still returns its biography — floors do not reserve empty space', () => {
  const r = selectCanonByQuota(many('CHARACTER', 20), { total: 30 });
  assert.equal(r.facts.length, 20, 'unused floors are not held back: ' + quotaSummary(r.counts));
});

test('PROHIBITIONS ARE NEVER IN THE FACT BUDGET and are never dropped for space', () => {
  const r = selectCanonByQuota([...BIOGRAPHY_FLOOD, ...many('PROHIBITION', 5)], { total: 10 });
  assert.equal(r.facts.length, 10, 'the fact budget is unchanged by them');
  assert.equal(r.undroppable.length, 5, 'all five rules survive a budget of ten');
  assert.equal(r.facts.filter((x) => x.kind === 'PROHIBITION').length, 0, 'and none leaked into the facts');
});

test('THERE IS NO CAP ON PROHIBITIONS — 12 then 40 both moved the defect rather than retiring it', () => {
  // The 66k bible yielded 23. A denser one (~40 negative continuity bullets in one section alone,
  // plus more elsewhere) exceeds any figure worth guessing, and a dropped rule PERMITS what it
  // forbids. They are short strings and the cheapest thing in the prompt, so the right cap is none.
  assert.equal(PROHIBITION_LIMIT, Infinity);
  for (const n of [23, 40, 41, 200]) {
    const r = selectCanonByQuota(many('PROHIBITION', n), { total: 60 });
    assert.equal(r.undroppable.length, n, n + ' rules must all reach the prompt');
    assert.equal(r.capBound, false);
    assert.equal(quotaShortfall(r), '');
  }
});

test('a caller MAY cap them, but it can never bind quietly', () => {
  const r = selectCanonByQuota(many('PROHIBITION', 23), { total: 60, prohibitionLimit: 12 });
  assert.equal(r.undroppable.length, 12);
  assert.equal(r.droppedByKind.PROHIBITION, 11);
  assert.equal(r.capBound, true);
  assert.match(quotaShortfall(r), /11 of these are PROHIBITIONS/);
  assert.match(quotaShortfall(r), /permits what it forbids/);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// A QUOTA THAT SILENTLY TRUNCATES IS THE SAME DEFECT AS A CAP THAT DOES

test('THE ACCOUNT: every dropped fact is named by kind, never just totalled', () => {
  const r = selectCanonByQuota([...many('CHARACTER', 40), ...many('ROLE', 10)], { total: 20 });
  assert.equal(r.extracted, 50);
  assert.equal(r.kept, 20);
  assert.equal(r.dropped, 30);
  assert.equal(r.capBound, true);
  assert.ok(r.droppedByKind.CHARACTER > 0, 'a bare total says something was lost without saying what');
  assert.equal(r.kept + r.dropped, r.extracted, 'the account must balance');
});

test('a healthy run reports no shortfall and adds no noise', () => {
  const r = selectCanonByQuota([...many('ROLE', 3), ...many('CHARACTER', 4), ...many('PROHIBITION', 9)], { total: 60 });
  assert.equal(r.capBound, false);
  assert.equal(r.dropped, 0);
  assert.deepEqual(r.droppedByKind, {});
  assert.equal(quotaShortfall(r), '');
  assert.equal(r.kept, 16);
});

test('the shortfall sentence says what to do about it', () => {
  const r = selectCanonByQuota(many('CHARACTER', 100), { total: 10 });
  const msg = quotaShortfall(r);
  assert.match(msg, /extracted 100, kept 10, dropped 90/);
  assert.match(msg, /Raise the quota/);
});

test('no fact is emitted twice, however the floors overlap', () => {
  const r = selectCanonByQuota([...many('ROLE', 3), ...many('CHARACTER', 3)], { total: 60 });
  assert.equal(new Set(r.facts).size, r.facts.length);
  assert.equal(r.facts.length, 6);
});

test('junk in does not throw — this runs on every generation', () => {
  for (const bad of [null, undefined, 'x', 42, {}, [null, undefined]]) {
    assert.doesNotThrow(() => selectCanonByQuota(bad as any));
  }
  assert.deepEqual(selectCanonByQuota(null as any).facts, []);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// A PROHIBITION MUST REACH THE PROMPT AS A RULE, NOT AS A FACT

test('THE SHAPE THAT MATTERS: a prohibition never renders in the CANON list', () => {
  const facts = [f('CHARACTER', 'The hero is called Gideon Vance.'), f('PROHIBITION', 'Do not rename the hero.')];
  const canon = canonDirective(facts, { at: 0 });
  assert.match(canon, /Gideon Vance/);
  assert.doesNotMatch(canon, /Do not rename/, 'a rule listed as a fact is one the model can satisfy by writing about it');
});

test('and it renders as a constraint on the OUTPUT, in its own block', () => {
  const d = prohibitionDirective([f('PROHIBITION', 'Do not rename the hero.'), f('CHARACTER', 'He is 41.')]);
  assert.match(d, /rules about YOUR OUTPUT/);
  assert.match(d, /- Do not rename the hero\./);
  assert.doesNotMatch(d, /He is 41/, 'only prohibitions belong in the constraints block');
});

test('no prohibitions means no empty heading', () => {
  assert.equal(prohibitionDirective([f('CHARACTER', 'He is 41.')]), '');
  assert.equal(prohibitionDirective([]), '');
  assert.equal(prohibitionDirective(null as any), '');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE SCHEMA MUST BE ABLE TO HOLD THE NEW KINDS AT ALL

test('THE SILENT FAILURE: an unlisted kind collapses to PLOT — every new kind must be whitelisted', () => {
  const rows = [
    { kind: 'ROLE', subject: 'GIDEON', predicate: 'is_antagonist', object: 'true', statement: 'Gideon is the operational antagonist.' },
    { kind: 'CAUSATION', subject: 'ALEXANDER', predicate: 'permitted', object: 'the exceptional routes', statement: 'Alexander permitted the exceptional routes.' },
    { kind: 'CRIME', subject: 'GIDEON', predicate: 'is_crime', object: 'labor trafficking', statement: 'Gideon runs a concealed labor-trafficking operation.' },
    { kind: 'ORDERING', subject: 'CONFRONTATION', predicate: 'occurs_before', object: 'TERMINAL CLIMAX', statement: 'Resolve the father-son confrontation before the terminal climax.' },
    { kind: 'OUTCOME', subject: 'GIDEON', predicate: 'survives', object: 'true', statement: 'Gideon survives.' },
    { kind: 'PROHIBITION', subject: 'HERO', predicate: 'must_not', object: 'be renamed', statement: 'Do not rename the hero.' },
  ];
  const out = mapAiFactsToCore(rows, { id: 's', order: 0 });
  assert.equal(out.length, 6);
  assert.deepEqual(out.map((x) => x.kind), ['ROLE', 'CAUSATION', 'CRIME', 'ORDERING', 'OUTCOME', 'PROHIBITION'],
    'a kind missing from the whitelist arrives as PLOT and loses its quota slot silently');
});

test('THE ACCEPTANCE TEST: the four sentences that reached nothing now survive the budget', () => {
  const FOUR = [
    f('ROLE', 'Gideon is the operational antagonist. Alexander is the deepest personal betrayal.', 'GIDEON'),
    f('CAUSATION', 'Alexander permitted the exceptional routes; Gideon expanded the operation.', 'ALEXANDER'),
    f('CRIME', 'Gideon runs a concealed labor-trafficking operation.', 'GIDEON'),
    f('ORDERING', 'Resolve the major father-son confrontation before the terminal climax.', 'CONFRONTATION'),
  ];
  // buried under the same biography flood that starved them in the real run
  const r = selectCanonByQuota([...BIOGRAPHY_FLOOD, ...FOUR], { total: 30 });
  // ORDERING is undroppable now, so the rendered block is facts + undroppable — which is
  // exactly what the service concatenates before injecting.
  const rendered = canonDirective(r.facts.concat(r.undroppable), { at: 0, max: 1000 });
  for (const want of ['operational antagonist', 'permitted the exceptional routes', 'labor-trafficking', 'before the terminal climax']) {
    assert.ok(rendered.includes(want), 'MISSING FROM THE PROMPT: ' + want + ' — ' + quotaSummary(r.counts));
  }
});

test('THE TRAP THIS EXPOSED: same subject + same predicate means one silently supersedes the other', () => {
  // Found by the acceptance test above. ROLE and CRIME facts both about GIDEON, sharing a predicate,
  // resolve to ONE — so a structural fact can win its quota slot and still never reach the prompt.
  // This is why the extraction prompt names a distinct predicate per kind, and why that is not
  // cosmetic. If a future prompt edit collapses them, this test says what breaks.
  const shared = [
    f('ROLE', 'Gideon is the operational antagonist.', 'GIDEON', 'same'),
    f('CRIME', 'Gideon runs a labor-trafficking operation.', 'GIDEON', 'same'),
  ];
  const collapsed = canonDirective(shared, { at: 0, max: 60 });
  assert.equal(collapsed.split('\n').length - 1, 1, 'two facts, one line — the resolver treated them as one claim');

  const distinct = [
    f('ROLE', 'Gideon is the operational antagonist.', 'GIDEON', 'is_antagonist'),
    f('CRIME', 'Gideon runs a labor-trafficking operation.', 'GIDEON', 'is_crime'),
  ];
  const kept = canonDirective(distinct, { at: 0, max: 60 });
  assert.match(kept, /operational antagonist/);
  assert.match(kept, /labor-trafficking/);
});

test('the floors are the ones the categories were added for', () => {
  for (const k of ['ROLE', 'CRIME', 'CAUSATION', 'OUTCOME', 'ORDERING'] as CanonKind[]) {
    assert.ok((DEFAULT_FLOORS[k] || 0) >= 3, k + ' has no guaranteed slots, so biography can starve it again');
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ORDERING AND PROHIBITION ARE UNDROPPABLE — no budget of any kind may discard them.
//
// The first run at a cap of 120 reported: "CANON TRUNCATED: dropped 14 (ORDERING 12 · OUTCOME 2)".
// Reporting a loss beats hiding one, but neither of these can be thinned. A dropped prohibition
// PERMITS the thing it forbids; a dropped ordering constraint lets the confrontation land after the
// climax, and no later stage can tell the requirement ever existed.

test('THE GUARANTEE: a tiny budget cannot drop a single ORDERING or PROHIBITION', () => {
  const r = selectCanonByQuota(
    [...many('CHARACTER', 200), ...many('ORDERING', 30), ...many('PROHIBITION', 92)],
    { total: 5 },
  );
  assert.equal(r.undroppable.filter((x) => x.kind === 'ORDERING').length, 30, 'every ordering constraint survives');
  assert.equal(r.undroppable.filter((x) => x.kind === 'PROHIBITION').length, 92, 'every rule survives');
  assert.equal(r.facts.length, 5, 'only the droppable kinds feel the budget');
  assert.equal(r.droppedByKind.ORDERING, undefined, 'and neither appears in the dropped account');
  assert.equal(r.droppedByKind.PROHIBITION, undefined);
});

test('they are not counted against the fact budget at all', () => {
  const withRules = selectCanonByQuota([...many('CHARACTER', 50), ...many('ORDERING', 40), ...many('PROHIBITION', 40)], { total: 50 });
  const without = selectCanonByQuota(many('CHARACTER', 50), { total: 50 });
  assert.equal(withRules.facts.length, without.facts.length, 'rules must not displace facts');
  assert.equal(withRules.kept, 130);
});

test('THE REAL NUMBERS: the run that dropped 12 ORDERING facts now drops none', () => {
  // 226 extracted, of which 92 PROHIBITION and 20 ORDERING, against the shipped keep budget.
  const r = selectCanonByQuota([
    ...many('PROHIBITION', 92), ...many('ORDERING', 20), ...many('CAUSATION', 21),
    ...many('OUTCOME', 18), ...many('ROLE', 17), ...many('CHARACTER', 17), ...many('CRIME', 14),
    ...many('PLOT', 9), ...many('RELATIONSHIP', 5), ...many('WORLD', 5), ...many('LORE', 4), ...many('TIMELINE', 2),
  ]);
  assert.equal(r.dropped, 0, 'a future CANON TRUNCATED is a defect, not a state: ' + quotaShortfall(r));
  assert.equal(r.capBound, false);
  assert.equal(r.counts.ORDERING, 20);
  assert.equal(r.counts.PROHIBITION, 92);
});

test('an explicit prohibitionLimit still binds, and still says so', () => {
  const r = selectCanonByQuota([...many('PROHIBITION', 92), ...many('ORDERING', 20)], { prohibitionLimit: 10 });
  assert.equal(r.undroppable.filter((x) => x.kind === 'PROHIBITION').length, 10);
  assert.equal(r.droppedByKind.PROHIBITION, 82, 'deliberate, and loud');
  assert.equal(r.undroppable.filter((x) => x.kind === 'ORDERING').length, 20, 'ordering is untouched by it');
});
