/**
 * Plan 01 task 2 — the surface, at the unit.
 *
 * The decisive tests are (1) a check with no entry is a ROW saying ABSENT, not a missing row;
 * (2) staleness is judged against each entry's OWN subject; and (3) INFO is a pass but never a
 * finding. Each ships with the switch that falsifies it.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  checkSurface, findingsCount, notRunCount, surfaceSummary, UNCHECKED, type CheckRow,
} from './check-surface.util';
import { endingEntry, findingsEntry, fingerprint, EXPECTED_CHECKS } from './revision-checks.util';

const TEXT = 'FADE IN:\n\nEXT. PIER - NIGHT\n\nHe files the shaft true.\n\nFADE OUT.';
const PLAN_TAIL = '79. INT. HARBOUR - DAY\n80. EXT. DECK - NIGHT\n81. INT. ROOM - DAY';
const PLAN = '[{"heading":"INT. ROOM - DAY"}]';

const SUBJECTS = { 'revision.pageText': TEXT, 'plan.tail': PLAN_TAIL, plan: PLAN };
const row = (rows: CheckRow[], kind: string) => rows.find((r) => r.kind === kind)!;

// The measured 2 Oct revision: two entries, one of them an abstention.
const MEASURED = {
  ending: endingEntry('ending', { complete: true, note: 'the ending was reached' }, TEXT),
  planEnding: endingEntry('planEnding',
    { complete: true, failOpen: true, note: 'no usable verdict returned by the plan-ending check' },
    PLAN_TAIL, 'plan.tail'),
};

test('every expected check gets a row, and one with no entry says ABSENT', () => {
  const rows = checkSurface({ ending: MEASURED.ending }, SUBJECTS);
  assert.equal(rows.length, EXPECTED_CHECKS.length,
    'a check with no entry must be a row that says so, not a gap in the list');
  assert.equal(row(rows, 'ending').display, 'CLEAN');
  assert.equal(row(rows, 'planEnding').display, 'ABSENT');
  assert.equal(row(rows, 'register').display, 'ABSENT');
  assert.match(row(rows, 'register').reason, /no result .* ever recorded/,
    'an ABSENT row carries words, because they are the only content it has');
});

test('ABSENT, NOT_RUN and STALE are not passes; CLEAN and INFO are', () => {
  const rows = checkSurface({
    ending: MEASURED.ending,
    planEnding: MEASURED.planEnding,
    echo: findingsEntry('echo', [{ phrase: 'x', scenes: [3], detail: 'x in 1 scene' }], TEXT),
  }, SUBJECTS);
  assert.equal(row(rows, 'ending').isPass, true);
  assert.equal(row(rows, 'echo').isPass, true, 'INFO withholds nothing — it is not a verdict either way');
  assert.equal(row(rows, 'planEnding').isPass, false);
  assert.equal(row(rows, 'ledger').isPass, false, 'ABSENT is not a pass');
});

test('the measured revision renders NOT_RUN with its reason', () => {
  const rows = checkSurface(MEASURED, SUBJECTS);
  const pe = row(rows, 'planEnding');
  assert.equal(pe.display, 'NOT_RUN');
  assert.match(pe.reason, /no usable verdict/);
  assert.equal(pe.isPass, false);
});

test('CONTROL — treating an absent entry as clean loses the distinction', () => {
  const lenient = (checks: any, k: string) => (checks[k] ? checks[k].state : 'CLEAN');
  assert.equal(lenient({ ending: MEASURED.ending }, 'planEnding'), 'CLEAN', 'the defect');
  assert.equal(row(checkSurface({ ending: MEASURED.ending }, SUBJECTS), 'planEnding').display, 'ABSENT');
});

test('CONTROL — returning only the stored kinds hides every unwired check', () => {
  const lenient = Object.keys({ ending: 1 });
  assert.equal(lenient.length, 1, 'the defect: one row for eleven checks');
  assert.equal(checkSurface({ ending: MEASURED.ending }, SUBJECTS).length, EXPECTED_CHECKS.length);
});

// ── STALENESS IS PER SUBJECT ────────────────────────────────────────────────────────────────

test('each entry is compared against its OWN subject', () => {
  const fresh = checkSurface(MEASURED, SUBJECTS);
  assert.equal(row(fresh, 'ending').display, 'CLEAN');
  assert.equal(row(fresh, 'planEnding').display, 'NOT_RUN', 'not STALE');

  // the page is edited in place (dialectRepairDoc); the plan is not
  const edited = checkSurface(MEASURED, { ...SUBJECTS, 'revision.pageText': TEXT + ' edited' });
  assert.equal(row(edited, 'ending').display, 'STALE');
  assert.equal(row(edited, 'planEnding').display, 'NOT_RUN',
    'a page edit must not stale a verdict taken over the plan');
});

test('a plan-side entry DOES stale when its own subject changes', () => {
  const edited = checkSurface(MEASURED, { ...SUBJECTS, 'plan.tail': PLAN_TAIL + '\n82. EXT. ROAD - DAY' });
  assert.equal(row(edited, 'planEnding').display, 'STALE',
    'per-subject means per-subject in both directions, not "only pageText can stale"');
});

test('CONTROL — one subject for every entry stales the plan-side checks wrongly', () => {
  const naive = (e: any, text: string) => (e.sha256 === fingerprint(text) ? e.state : 'STALE');
  assert.equal(naive(MEASURED.planEnding, TEXT), 'STALE', 'the defect: STALE on every revision ever written');
  assert.equal(row(checkSurface(MEASURED, SUBJECTS), 'planEnding').display, 'NOT_RUN');
});

test('a subject that was not supplied is UNCHECKED staleness, never fresh', () => {
  const rows = checkSurface(MEASURED, { 'revision.pageText': TEXT });   // no plan.tail
  assert.equal(row(rows, 'planEnding').staleness, UNCHECKED);
  assert.equal(row(rows, 'ending').staleness, 'FRESH');
  assert.equal(row(rows, 'planEnding').display, 'NOT_RUN', 'unchecked staleness does not invent a display');
});

test("CONTROL — treating a missing subject as fresh claims a comparison nobody made", () => {
  const rows = checkSurface(MEASURED, {});
  assert.notEqual(row(rows, 'ending').staleness, 'FRESH');
  assert.equal(row(rows, 'ending').staleness, UNCHECKED);
});

// ── COUNTS ──────────────────────────────────────────────────────────────────────────────────

const WITH_FINDINGS = {
  ending: MEASURED.ending,
  planEnding: MEASURED.planEnding,
  ledger: findingsEntry('ledger', [{ kind: 'REDISCOVERY', scenes: [12, 40], detail: 'd' }], TEXT),
  echo: findingsEntry('echo', [{ phrase: 'x', scenes: [3], detail: 'x' }], TEXT),
  density: findingsEntry('density', [], TEXT),
};

test('the counts exclude INFO and count what did not run', () => {
  const rows = checkSurface(WITH_FINDINGS, SUBJECTS);
  assert.equal(findingsCount(rows), 1, 'the ledger finding only — echo is INFO, not a finding');
  // planEnding NOT_RUN + the six checks with no entry at all
  assert.equal(notRunCount(rows), 1 + (EXPECTED_CHECKS.length - Object.keys(WITH_FINDINGS).length),
    'ABSENT counts as "did not run" — nothing checked there either');
  const s = surfaceSummary(rows);
  assert.equal(s.findings, 1);
  assert.equal(s.info, 1);
  assert.equal(s.clean, 2, 'ending and density');
  assert.equal(s.allClear, false, 'six checks never ran — this is not an all-clear');
});

test('CONTROL — counting INFO as a finding makes every motif a defect', () => {
  const rows = checkSurface({ echo: WITH_FINDINGS.echo }, SUBJECTS);
  assert.equal(rows.filter((r) => r.display === 'INFO').length, 1);
  assert.equal(findingsCount(rows), 0, 'one INFO row, zero findings');
});

test('allClear is true ONLY when every expected check ran and found nothing', () => {
  const all: any = {};
  for (const k of EXPECTED_CHECKS) {
    all[k] = k === 'echo' ? findingsEntry(k, [], TEXT) : endingEntry(k, { complete: true, note: 'ok' }, TEXT);
  }
  // planEnding's subject is plan.tail, so it must be fingerprinted against the plan to read fresh
  all.planEnding = endingEntry('planEnding', { complete: true, note: 'ok' }, PLAN_TAIL, 'plan.tail');
  all.planState = endingEntry('planState', { complete: true, note: 'ok' }, PLAN, 'plan');
  const s = surfaceSummary(checkSurface(all, SUBJECTS));
  assert.equal(s.findings, 0);
  assert.equal(s.notRun, 0);
  assert.equal(s.allClear, true);
});

test('CONTROL — allClear must not survive a single unchecked check', () => {
  const all: any = {};
  for (const k of EXPECTED_CHECKS) all[k] = endingEntry(k, { complete: true, note: 'ok' }, TEXT);
  all.planEnding = endingEntry('planEnding', { complete: true, note: 'ok' }, PLAN_TAIL, 'plan.tail');
  all.planState = endingEntry('planState', { complete: true, note: 'ok' }, PLAN, 'plan');
  delete all.register;
  assert.equal(surfaceSummary(checkSurface(all, SUBJECTS)).allClear, false, 'one ABSENT check ends the all-clear');
});

// ── JUNK ────────────────────────────────────────────────────────────────────────────────────

test('junk in the column degrades to NOT_RUN rather than to a pass', () => {
  const rows = checkSurface({ ending: { state: 'TOTALLY_FINE' } as any }, SUBJECTS);
  assert.equal(row(rows, 'ending').display, 'NOT_RUN');
  assert.equal(row(rows, 'ending').isPass, false);
});

test('a stored kind nobody expects is still shown, flagged, and not counted clean', () => {
  const rows = checkSurface({ fixedAttributes: findingsEntry('fixedAttributes', [{ kind: 'PRONOUN', sceneIndex: 4, detail: 'd' }], TEXT) } as any, SUBJECTS);
  const extra = rows.find((r) => r.kind === 'fixedAttributes');
  assert.ok(extra, 'an unexpected stored entry must not vanish from the surface');
  assert.equal(extra!.unexpected, true);
  assert.equal(rows.length, EXPECTED_CHECKS.length + 1);
});

test('null, junk and arrays produce the full ABSENT list, never an empty one', () => {
  for (const bad of [null, undefined, 'x', 7, [1, 2]] as any[]) {
    const rows = checkSurface(bad, SUBJECTS);
    assert.equal(rows.length, EXPECTED_CHECKS.length, String(bad));
    assert.equal(rows.every((r) => r.display === 'ABSENT'), true);
    assert.equal(surfaceSummary(rows).allClear, false);
  }
});

test('the rows are in EXPECTED_CHECKS order, so a reader can place one in the run', () => {
  const rows = checkSurface(MEASURED, SUBJECTS);
  assert.deepEqual(rows.map((r) => r.kind), [...EXPECTED_CHECKS]);
});
