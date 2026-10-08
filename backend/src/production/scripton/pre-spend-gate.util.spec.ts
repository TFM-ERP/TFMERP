/**
 * C2's acceptance: THREE FIXTURES, THREE DIFFERENT OUTPUTS.
 *
 * If (b) and (c) render the same, C2 has reproduced the defect it exists to end — so the decisive
 * assertions are the ones comparing the rendered text of a clean check against an absent one.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { preSpendGate, readCheck, gateText, markPreSpendRefusal, isPreSpendRefusal, errorTextForJob, isWaived } from './pre-spend-gate.util';
import { registerEntry } from './revision-checks.util';

/** The real stored shape, from STEP_OUTLINE on Jason Quick V3.2. */
const WITH_ITEMS = {
  at: '2026-09-18T13:19:23.977Z', ok: true, checked: 81, contradicted: 1, rate: 0.0123, invalid: 0, salvaged: false,
  summary: 'REGISTER CHECK: 1 of 81 lines contradicted (1.2%) — 29. Continuity foundations 1',
  items: [{ line: 39, section: '29. Continuity foundations', rule: 'After the MacRae murders, Thomas privately admits his role to Nora shortly before his Boston meeting with Jason.', draft: 'Cape Breton', why: 'staged at the rescue station, not Boston' }],
};
const ZERO_ITEMS = { at: '2026-09-18T13:19:23.977Z', ok: true, checked: 81, contradicted: 0, rate: 0, invalid: 0, items: [], summary: 'REGISTER CHECK: 0 of 81 lines contradicted (0%)' };
const ERRORED = { at: '2026-09-18T13:19:23.977Z', ok: false, checked: 81, contradicted: null, items: [], summary: 'register check failed' };

const gate = (data: any) => preSpendGate({ STEP_OUTLINE: 'v-1' }, [{ id: 'v-1', data }], { checks: ['registerCheck'] });

test('(a) stored check WITH items — the gate stops and NAMES THE LINE NUMBERS', () => {
  const r = gate({ registerCheck: WITH_ITEMS });
  assert.equal(r.stop, true);
  assert.equal(r.findings, 1);
  assert.deepEqual(r.reads[0].checks[0].lines, [39]);
  assert.match(r.text, /STOPPED/);
  assert.match(r.text, /Line\(s\): 39\./);
});

test('(b) stored check with ZERO items — clean, and it does not interrupt', () => {
  const r = gate({ registerCheck: ZERO_ITEMS });
  assert.equal(r.stop, false);
  assert.equal(r.clean, 1);
  assert.equal(r.notRun, 0);
  assert.match(r.text, /checked, clean/);
});

test('(c) NO stored check at all — NOT RUN, and it says it is not a pass', () => {
  const r = gate({});
  assert.equal(r.stop, false);
  assert.equal(r.notRun, 1);
  assert.equal(r.clean, 0);
  assert.match(r.text, /NOT RUN/);
  assert.match(r.text, /NOT a pass/);
});

/** THE DECISIVE ONE. */
test('(b) and (c) DO NOT RENDER THE SAME — the defect this exists to end', () => {
  const b = gate({ registerCheck: ZERO_ITEMS }).text;
  const c = gate({}).text;
  assert.notEqual(b, c, 'clean and never-ran rendered identically');
  assert.match(b, /checked, clean/);
  assert.doesNotMatch(b, /NOT RUN/);
  assert.match(c, /NOT RUN/);
  assert.doesNotMatch(c, /checked, clean/);
});

test('NEGATIVE CONTROL — deleting the stored registerCheck moves the output from (b) to (c)', () => {
  const stored: any = { registerCheck: ZERO_ITEMS };
  const before = gate(stored);
  assert.equal(before.clean, 1);
  assert.equal(before.notRun, 0);
  delete stored.registerCheck;                     // the break, applied
  const after = gate(stored);
  assert.equal(after.clean, 0, 'still reported clean after the check was deleted');
  assert.equal(after.notRun, 1);
  assert.notEqual(before.text, after.text);
});

test('a check that RAN AND FAILED is NOT_RUN, never clean', () => {
  const r = gate({ registerCheck: ERRORED });
  assert.equal(r.reads[0].checks[0].state, 'NOT_RUN');
  assert.equal(r.clean, 0);
  assert.match(r.text, /did not return a verdict/);
});

test('eraCheck and keepCheck keep their OWN state, never a merged verdict', () => {
  assert.equal(readCheck('eraCheck', { state: 'NO FINDINGS', findings: [] }).state, 'CLEAN');
  assert.equal(readCheck('eraCheck', { state: 'FINDINGS', findings: [1], summary: 'two datings' }).state, 'FINDINGS');
  assert.equal(readCheck('eraCheck', { state: 'NOT RUN', reason: 'engine not connected' }).state, 'NOT_RUN');
  assert.equal(readCheck('keepCheck', { state: 'NO MISSES' }).state, 'CLEAN');
  assert.equal(readCheck('keepCheck', { state: 'MISSES', items: [1, 2], misses: 2 }).state, 'FINDINGS');
  assert.equal(readCheck('keepCheck', { state: 'NOT RUN', reason: 'no direction row' }).state, 'NOT_RUN');
  assert.equal(readCheck('keepCheck', null).state, 'NOT_RUN');
  assert.equal(readCheck('eraCheck', { at: 'x' }).state, 'NOT_RUN', 'an unrecognisable verdict is not a pass');
});

/**
 * REWRITTEN, NOT WEAKENED. This asserted `SCENES — registerCheck: checked, clean` — the per-check
 * clean line. That rendering is exactly what buried the finding behind 299 characters on Jason
 * Quick, so clean is now one count line and this test pins the new contract: the clean checks are
 * still ACCOUNTED FOR (the count, and report.clean), they are simply no longer itemised.
 */
test('one FINDINGS among many CLEAN still stops, and the clean ones are counted not itemised', () => {
  const r = preSpendGate(
    { STEP_OUTLINE: 'v-1', SCENES: 'v-2' },
    [{ id: 'v-1', data: { registerCheck: WITH_ITEMS, eraCheck: { state: 'NO FINDINGS' } } },
     { id: 'v-2', data: { registerCheck: ZERO_ITEMS, eraCheck: { state: 'NO FINDINGS' } } }],
    { checks: ['registerCheck', 'eraCheck'] },
  );
  assert.equal(r.stop, true);
  assert.equal(r.findings, 1);
  assert.equal(r.clean, 3);
  assert.match(r.text, /^3 other check\(s\): checked, clean\.$/m, 'the three clean checks are counted on one line');
  assert.doesNotMatch(r.text, /SCENES — registerCheck/, 'a clean check is no longer itemised');
  assert.match(r.text, /STEP_OUTLINE — registerCheck/, 'but the FINDINGS one still names its stage');
});

test('a consumed version that cannot be found reads NOT_RUN for every check, not clean', () => {
  const r = preSpendGate({ STEP_OUTLINE: 'missing' }, [], { checks: ['registerCheck', 'eraCheck'] });
  assert.equal(r.notRun, 2);
  assert.equal(r.clean, 0);
  assert.equal(r.stop, false);
});

test('nothing consumed says so rather than implying a pass', () => {
  const r = preSpendGate({}, []);
  assert.equal(r.stop, false);
  assert.match(r.text, /nothing to read/);
  assert.doesNotMatch(gateText(r), /clean/);
});

// ── THE ORDER IS THE FIX (2 Oct, Jason Quick cmuqt6rki0007kn6r70s5ernv) ───────────────────────
//
// The writer saw 299 characters of a refusal: header, LOGLINE registerCheck clean, LOGLINE eraCheck
// clean, cut. The finding that caused the stop and the sentence saying what to do were both below
// the cut. These tests pin the two halves of the repair — what the text says first, and that the
// refusal is marked so it survives why()'s 300-character cap.

/** A refusal shaped like the real one: the finding is on a LATE stage, clean checks on early ones. */
const ladder = () => preSpendGate(
  { LOGLINE: 'v-1', SYNOPSIS: 'v-2', TREATMENT: 'v-3', BEATS: 'v-4', SCENES: 'v-5', STEP_OUTLINE: 'v-6' },
  [
    { id: 'v-1', data: { registerCheck: ZERO_ITEMS, eraCheck: { state: 'NO FINDINGS' }, keepCheck: { state: 'NO MISSES' } } },
    { id: 'v-2', data: { registerCheck: ZERO_ITEMS, eraCheck: { state: 'NO FINDINGS' }, keepCheck: { state: 'NO MISSES' } } },
    { id: 'v-3', data: { registerCheck: ZERO_ITEMS, eraCheck: { state: 'NO FINDINGS' }, keepCheck: { state: 'NO MISSES' } } },
    { id: 'v-4', data: { registerCheck: ZERO_ITEMS, eraCheck: { state: 'NO FINDINGS' } } },
    { id: 'v-5', data: { registerCheck: ZERO_ITEMS, eraCheck: { state: 'NO FINDINGS' } } },
    { id: 'v-6', data: { registerCheck: WITH_ITEMS, eraCheck: { state: 'NO FINDINGS' } } },
  ],
);

test('THE FINDING COMES FIRST — before any clean line, and within the first 300 characters', () => {
  const t = ladder().text;
  const iFind = t.indexOf('FINDINGS (');
  const iClean = t.indexOf('other check(s): checked, clean');
  assert.ok(iFind > 0, 'the FINDINGS section must exist');
  assert.ok(iClean > iFind, 'a clean count line must never precede the findings');
  // The measured failure: 299 characters reached the screen. The finding has to be inside that.
  assert.ok(iFind < 300, 'the FINDINGS heading starts at ' + iFind + ' — it was off-screen at 299');
  assert.match(t.slice(0, 300), /STEP_OUTLINE — registerCheck/, 'the offending stage must be named in the first 300 chars');
});

test('the three states appear in order FINDINGS, NOT RUN, clean count', () => {
  const r = preSpendGate(
    { LOGLINE: 'v-1', BEATS: 'v-2', STEP_OUTLINE: 'v-3' },
    [
      { id: 'v-1', data: { registerCheck: ZERO_ITEMS } },
      { id: 'v-2', data: {} },
      { id: 'v-3', data: { registerCheck: WITH_ITEMS } },
    ],
    { checks: ['registerCheck'] },
  );
  const t = r.text;
  const a = t.indexOf('FINDINGS ('), b = t.indexOf('NOT RUN ('), c = t.indexOf('other check(s): checked, clean');
  assert.ok(a > 0 && b > a && c > b, 'order was FINDINGS@' + a + ' NOT RUN@' + b + ' clean@' + c);
});

test('the amend-or-waive sentence is the LAST line, so it survives a tail read', () => {
  const lines = ladder().text.trim().split('\n');
  assert.match(lines[lines.length - 1], /Amend the upstream stage, or re-run with the findings waived/);
});

test('ladder order is kept WITHIN a state, so a finding can still be placed', () => {
  const r = preSpendGate(
    { LOGLINE: 'v-1', SCENES: 'v-2' },
    [{ id: 'v-1', data: { registerCheck: WITH_ITEMS } }, { id: 'v-2', data: { registerCheck: WITH_ITEMS } }],
    { checks: ['registerCheck'] },
  );
  assert.ok(r.text.indexOf('LOGLINE — registerCheck') < r.text.indexOf('SCENES — registerCheck'));
});

test('NEGATIVE CONTROL — the OLD inline order buried the finding past 299 characters', () => {
  // The previous rendering, reconstructed: walk the reads in ladder order, print all three states
  // inline. This is what the writer actually saw truncated, and it must fail the 300-char assertion
  // that the new order passes.
  const r = ladder();
  const old = ['PRE-SPEND CHECK — STOPPED. The versions this stage is about to be written from carry stored findings:']
    .concat(r.reads.flatMap((rd) => rd.checks.map((c) =>
      '  ' + rd.kind + ' — ' + c.check + ': ' + (c.state === 'FINDINGS' ? 'FINDINGS. ' + c.detail
        : c.state === 'CLEAN' ? 'checked, clean. ' + c.detail
        : 'NOT RUN — ' + c.detail))))
    .join('\n');
  assert.ok(old.indexOf('FINDINGS') > 300,
    'the old order put the finding at ' + old.indexOf('FINDINGS') + ' — this control is the defect');
  assert.ok(r.text.indexOf('FINDINGS (') < 300, 'and the new order puts it at ' + r.text.indexOf('FINDINGS ('));
});

// ── the refusal is marked, so it is not cut ──────────────────────────────────────────────────

test('a marked refusal is recognised, and an ordinary error is not', () => {
  const refusal = markPreSpendRefusal(new Error(ladder().text));
  assert.equal(isPreSpendRefusal(refusal), true);
  assert.equal(isPreSpendRefusal(new Error('connection lost')), false);
  assert.equal(isPreSpendRefusal(null), false);
  assert.equal(isPreSpendRefusal({ message: 'PRE-SPEND CHECK — STOPPED' }), false,
    'recognition must not come from the text — a reworded header would silently stop matching');
});

/**
 * THE WHOLE POINT, as behaviour. why() is reproduced here exactly as the service has it, and the
 * two paths are run side by side on the same refusal: the capped one loses the finding and the
 * closing sentence AND the line breaks; the marked one keeps all three.
 */
test('NEGATIVE CONTROL — why()\'s cap loses the finding, the sentence and the line breaks', () => {
  const why = (e: any) => String((e && (e.message || e)) || 'unknown').replace(/\s+/g, ' ').slice(0, 300);
  const text = ladder().text
    + '\n\nNothing has been generated and nothing has been spent. Amend the upstream stage, or'
    + ' re-run with waiveChecks to proceed on the record above.';
  const err = markPreSpendRefusal(new Error(text));

  const capped = why(err);
  assert.equal(capped.length, 300, 'the cap is what the writer saw');
  assert.ok(!capped.includes('waiveChecks'), 'the capped form loses the waiver sentence');
  assert.ok(!capped.includes('\n'), 'and every line break with it');

  const uncut = isPreSpendRefusal(err) ? String(err.message) : why(err);
  assert.ok(uncut.length > 300, 'the marked form is not capped');
  assert.ok(uncut.includes('waiveChecks'), 'it keeps the waiver sentence');
  assert.ok(uncut.includes('\n'), 'and its line breaks');
  assert.match(uncut, /STEP_OUTLINE — registerCheck/, 'and the finding itself');
});

/**
 * errorTextForJob IS THE LINE startStage RUNS. Tested here because a ternary inside a .catch in a
 * 6,000-line service is the one part of this repair nothing would have caught.
 */
test('errorTextForJob: a refusal is verbatim, everything else is capped', () => {
  const why = (e: any) => String((e && (e.message || e)) || 'unknown').replace(/\s+/g, ' ').slice(0, 300);
  const text = ladder().text + '\n\nAmend the upstream stage, or re-run with waiveChecks.';

  const refusal = markPreSpendRefusal(new Error(text));
  assert.equal(errorTextForJob(refusal, why), text, 'a refusal must arrive byte-for-byte');
  assert.ok(errorTextForJob(refusal, why).includes('\n'), 'with its line breaks');

  const ordinary = new Error(text);                      // same text, NOT marked
  const got = errorTextForJob(ordinary, why);
  assert.equal(got.length, 300, 'an unmarked error still gets the cap');
  assert.ok(!got.includes('\n'), 'and still gets its whitespace collapsed');
});

test('NEGATIVE CONTROL — forgetting to mark the refusal puts it back behind the cap', () => {
  const why = (e: any) => String((e && (e.message || e)) || 'unknown').replace(/\s+/g, ' ').slice(0, 300);
  const text = ladder().text + '\n\nAmend the upstream stage, or re-run with waiveChecks.';
  // The defect, reconstructed: the throw site omits markPreSpendRefusal.
  const unmarked = errorTextForJob(new Error(text), why);
  assert.ok(!unmarked.includes('waiveChecks'), 'unmarked loses the waiver sentence — the measured defect');
  // And marked does not.
  assert.ok(errorTextForJob(markPreSpendRefusal(new Error(text)), why).includes('waiveChecks'));
});

/**
 * THE WIRING, NOT JUST THE DECISION — and deliberately a source-level assertion.
 *
 * errorTextForJob is tested above, but nothing caught a throw site that forgets to mark its
 * refusal: removing markPreSpendRefusal from the DRAFT gate compiles and leaves every other test
 * green, which is exactly how this defect would come back. Reading metadata would be better; there
 * is none to read for a `throw` statement, and the alternative is no coverage at all. If the gate
 * throw sites are refactored, this test should be rewritten to match them — not deleted.
 */
test('EVERY pre-spend gate refusal in the service is marked', () => {
  const src = require('fs').readFileSync(
    require('path').join(__dirname, 'scripton.service.ts'), 'utf8');
  // Each gate's stop branch throws a BadRequestException built from its own gate text.
  const throwsOnGateText = src.match(/throw[^;]*?BadRequestException\(\s*(?:gate|featureGate)\.text/g) || [];
  assert.equal(throwsOnGateText.length, 2, 'expected the DRAFT and promote gates; found ' + throwsOnGateText.length);
  for (const t of throwsOnGateText) {
    assert.match(t, /markPreSpendRefusal\(/,
      'a gate refusal is thrown unmarked, so why() will cap it at 300 chars: ' + t.replace(/\s+/g, ' ').slice(0, 90));
  }
});

// ── WHAT IS WRONG, NOT ONLY WHERE (commit 3) ──────────────────────────────────────────────────
//
// The refusal said "2 of 105 lines contradicted … Line(s): 36, 52." A person asked to waive that
// has been told where to look and nothing about what is wrong. Each stored item carries a `why`.

const TWO_ITEMS = {
  ok: true, checked: 105, contradicted: 2,
  summary: 'REGISTER CHECK: 2 of 105 lines contradicted (1.9%) — 29. Continuity foundations 1',
  items: [
    { line: 36, rule: 'Thomas admits his role to Nora before the Boston meeting.', draft: 'Cape Breton', why: 'staged at the rescue station, not Boston' },
    { line: 52, rule: 'Nora never learns of the bracelet before the inquest.', draft: 'pier', why: 'she recognises the bracelet eleven scenes early' },
  ],
};

test('a register finding carries one item per contradiction — line AND why', () => {
  const c = readCheck('registerCheck', TWO_ITEMS);
  assert.equal(c.state, 'FINDINGS');
  assert.deepEqual(c.lines, [36, 52]);
  assert.deepEqual(c.items, [
    { line: 36, why: 'staged at the rescue station, not Boston' },
    { line: 52, why: 'she recognises the bracelet eleven scenes early' },
  ]);
});

test('gateText prints one line per contradiction, under its stage', () => {
  const t = gate({ registerCheck: TWO_ITEMS }).text;
  assert.match(t, /^ {6}line 36: staged at the rescue station, not Boston$/m);
  assert.match(t, /^ {6}line 52: she recognises the bracelet eleven scenes early$/m);
  // Under the stage line, not before it.
  assert.ok(t.indexOf('STEP_OUTLINE — registerCheck') < t.indexOf('line 36:'));
});

test('the reason is readable early — not pushed past where the old cut fell', () => {
  const t = gate({ registerCheck: TWO_ITEMS }).text;
  assert.ok(t.indexOf('staged at the rescue station') < 400,
    'the first reason starts at ' + t.indexOf('staged at the rescue station'));
});

test('why falls back to the rule, and an item with neither says so', () => {
  const noWhy = readCheck('registerCheck', { ok: true, contradicted: 1, items: [{ line: 7, rule: 'The bracelet is buried with Agnes.' }] });
  assert.deepEqual(noWhy.items, [{ line: 7, why: 'The bracelet is buried with Agnes.' }]);
  const neither = readCheck('registerCheck', { ok: true, contradicted: 1, items: [{ line: 9 }] });
  assert.deepEqual(neither.items, [{ line: 9, why: 'no reason recorded on this item' }],
    'silence here would read as "no reason to worry"');
  const noLine = readCheck('registerCheck', { ok: true, contradicted: 1, items: [{ why: 'contradicts the ending' }] });
  assert.deepEqual(noLine.items, [{ line: null, why: 'contradicts the ending' }]);
  assert.match(gate({ registerCheck: { ok: true, contradicted: 1, items: [{ why: 'contradicts the ending' }] } }).text,
    /^ {6}line \?: contradicts the ending$/m, 'a missing line number prints ? rather than being dropped');
});

test('a CLEAN or NOT_RUN check carries no items', () => {
  assert.deepEqual(readCheck('registerCheck', ZERO_ITEMS).items, []);
  assert.deepEqual(readCheck('registerCheck', null).items, []);
  assert.deepEqual(readCheck('eraCheck', { state: 'FINDINGS', findings: [1], summary: 'two datings' }).items, [],
    'only the register check stores per-item reasons today');
});

test('NEGATIVE CONTROL — the OLD summary-only rendering told the reader only where to look', () => {
  const c = readCheck('registerCheck', TWO_ITEMS);
  // What the line used to be, reconstructed.
  const old = '  STEP_OUTLINE — registerCheck: ' + c.detail + '  Line(s): ' + c.lines.join(', ') + '.';
  assert.ok(!old.includes('staged at the rescue station'), 'the old line carried no reason — the defect');
  assert.ok(!old.includes('eleven scenes early'));
  assert.match(gate({ registerCheck: TWO_ITEMS }).text, /staged at the rescue station/);
});

// ── the waiver is a boolean, not a truthy value ───────────────────────────────────────────────

test('isWaived: a waiver is boolean true and nothing else', () => {
  assert.equal(isWaived({ waiveChecks: true }), true);
  // Every one of these is reachable: generate-async spreads the raw request body into startStage.
  for (const v of ['0', 'false', 'true', 1, 0, {}, [], 'yes', null, undefined] as any[])
    assert.equal(isWaived({ waiveChecks: v }), false, JSON.stringify(v) + ' must not waive a gate');
  assert.equal(isWaived({}), false);
  assert.equal(isWaived(null), false);
  assert.equal(isWaived(undefined), false);
});

test('NEGATIVE CONTROL — the truthy form it replaced waived on values nobody meant', () => {
  const truthyForm = (opts?: any) => !!(opts && opts.waiveChecks);   // what both gates used to test
  for (const v of ['0', 'false', 1, 'no', {}, []] as any[]) {
    assert.equal(truthyForm({ waiveChecks: v }), true, JSON.stringify(v) + ' passed the old gate');
    assert.equal(isWaived({ waiveChecks: v }), false, 'and is refused now');
  }
  // Both agree on the only value that should ever waive.
  assert.equal(truthyForm({ waiveChecks: true }), true);
  assert.equal(isWaived({ waiveChecks: true }), true);
});

test('BOTH gates call isWaived — neither keeps its own condition', () => {
  const src = require('fs').readFileSync(
    require('path').join(__dirname, 'scripton.service.ts'), 'utf8');
  const stops = src.match(/if \((?:gate|featureGate)\.stop && [^)]*\)\)? \{/g) || [];
  assert.equal(stops.length, 2, 'expected the DRAFT and promote gate stop branches; found ' + stops.length);
  for (const line of stops) {
    assert.match(line, /!isWaived\(opts\)/, 'a gate still has its own waiver condition: ' + line);
    assert.doesNotMatch(line, /!opts\?\.waiveChecks/, 'the truthy form is the defect');
  }
});

/**
 * THE GATE LEARNS UNPROVEN, AND STOPS PRINTING FIVE ABSENCES THAT ARE STRUCTURAL.
 * Plan 01 close-out 2, commit 2A.2.
 *
 * Run 2's refusal was fourteen lines long. One was the finding. Five were "no keepCheck is stored on
 * this version" for LOGLINE, SYNOPSIS, BEATS, SCENES and STEP_OUTLINE — stages that never store one,
 * because the keep check runs on TREATMENT alone. Five lines of noise around the one line that
 * mattered, in a refusal whose whole purpose is to be read before a waiver.
 */
const KEEP_STAGES = { LOGLINE: 'v1', SYNOPSIS: 'v2', BEATS: 'v3', SCENES: 'v4', STEP_OUTLINE: 'v5', TREATMENT: 'v6' };
const CLEAN_TWO = { registerCheck: ZERO_ITEMS, eraCheck: { state: 'NO FINDINGS' } };
const keepVersions = (treatmentData: any) => [
  { id: 'v1', kind: 'LOGLINE', data: { ...CLEAN_TWO } },
  { id: 'v2', kind: 'SYNOPSIS', data: { ...CLEAN_TWO } },
  { id: 'v3', kind: 'BEATS', data: { ...CLEAN_TWO } },
  { id: 'v4', kind: 'SCENES', data: { ...CLEAN_TWO } },
  { id: 'v5', kind: 'STEP_OUTLINE', data: { ...CLEAN_TWO } },
  { id: 'v6', kind: 'TREATMENT', data: { ...CLEAN_TWO, ...(treatmentData === undefined ? {} : { keepCheck: treatmentData }) } },
];

const UNPROVEN_KEEP = {
  state: 'UNPROVEN',
  misses: [],
  unproven: ['the 3 a.m. arrival — the checker claimed this is in the draft but quoted words that are not: "7. 03:50 — THE THIRD DOOR."'],
  summary: 'KEEP CHECK — claimed but not shown: the 3 a.m. arrival — the checker claimed this is in the draft but quoted words that are not: "7. 03:50 — THE THIRD DOOR."',
};
const MISSES_KEEP = { state: 'MISSES', misses: ['the brass key'], unproven: [], summary: 'KEEP CHECK — not found: the brass key' };

test('UNPROVEN at the gate is a FINDINGS that stops, in its own words', () => {
  const r = readCheck('keepCheck', UNPROVEN_KEEP);
  assert.equal(r.state, 'FINDINGS', 'nothing was shown either way, and that is not a pass');
  assert.match(r.detail, /claimed but not shown/);
});

test('the five stages that never store a keepCheck no longer each print one', () => {
  const g = preSpendGate(KEEP_STAGES, keepVersions({ state: 'NO MISSES', summary: 'KEEP CHECK — nothing missing' }));
  const keepLines = g.text.split('\n').filter((l) => l.includes('keepCheck'));
  assert.equal(keepLines.length, 1, 'six keepCheck lines became one:\n' + g.text);
  assert.match(keepLines[0], /the keep check covers TREATMENT only/);
  assert.equal(g.notRun, 0, 'five structural absences are not five unran checks');
  assert.equal(g.stop, false);
});

test('a TREATMENT consumed with NO keepCheck stored still prints NOT RUN', () => {
  const g = preSpendGate(KEEP_STAGES, keepVersions(undefined));
  assert.match(g.text, /TREATMENT — keepCheck: no keepCheck is stored on this version/,
    'the collapse removes the five structural absences, never the one real one:\n' + g.text);
  assert.equal(g.notRun, 1);
});

test('an UNPROVEN keepCheck on the TREATMENT stops the gate', () => {
  const g = preSpendGate(KEEP_STAGES, keepVersions(UNPROVEN_KEEP));
  assert.equal(g.stop, true);
  assert.equal(g.findings, 1);
});

test('CONTROL: the text the gate PRINTS never says "not found" for an unproven claim', () => {
  const g = preSpendGate(KEEP_STAGES, keepVersions(UNPROVEN_KEEP));
  // This is the control that matters: the printed refusal is what stopped the build twice.
  assert.doesNotMatch(g.text, /not found/i, g.text);
  assert.match(g.text, /claimed but not shown/);
});

test('CONTROL: a genuinely named-absent thing still stops, and still says not found', () => {
  const g = preSpendGate(KEEP_STAGES, keepVersions(MISSES_KEEP));
  assert.equal(g.stop, true);
  assert.match(g.text, /not found: the brass key/);
});

test('CONTROL: the standing keepCheck line appears only when a stage was actually skipped', () => {
  const only = preSpendGate({ TREATMENT: 'v6' }, keepVersions(MISSES_KEEP));
  assert.doesNotMatch(only.text, /covers TREATMENT only/,
    'with TREATMENT the only consumed stage, nothing was skipped and the note would be noise');
});

/**
 * THE CUT-OFF RULE, AT THE GATE TOO — Plan 01 close-out 2, commit 1.2b.
 *
 * readCheck derives registerCheck's state itself, because the stored object publishes no `state`:
 * items -> FINDINGS, else ok === false || contradicted == null -> NOT_RUN, else CLEAN. A
 * truncated-empty reply stores ok: true, contradicted: 0, items: [] — so it reads CLEAN here, on
 * every ladder stage, and would clear a stage for spending. Same defect as 1.2, second place.
 *
 * ONE PREDICATE. registerReplyCutOff lives in register-check.util and is imported by registerEntry
 * and by readCheck, so the two cannot grow separate copies of the rule.
 */
const regStored = (over: Record<string, any> = {}) => ({
  at: '2026-10-07T06:00:00.000Z', ok: true, checked: 193, contradicted: 0, rate: 0, invalid: 0,
  items: [], salvaged: false, stopReason: 'end_turn',
  summary: 'REGISTER CHECK: 0 of 193 lines contradicted (0%)', ...over,
});
const regStoredItem = (line: number) => ({ line, section: null, rule: 'r' + line, draft: 'A line of script.', why: 'w' + line, quoteFound: true });

test('a reply cut off at the ceiling with nothing reported is NOT_RUN at the gate, not CLEAN', () => {
  const r = readCheck('registerCheck', regStored({ stopReason: 'max_tokens' }));
  assert.equal(r.state, 'NOT_RUN', 'contradicted 0 after a truncation cleared stages for spending');
  assert.match(r.detail, /cut off before it reported anything/);
});

test('a salvaged reply with nothing reported is NOT_RUN at the gate', () => {
  assert.equal(readCheck('registerCheck', regStored({ salvaged: true })).state, 'NOT_RUN');
});

test('cut off WITH contradictions is FINDINGS at the gate, and says the list is incomplete', () => {
  const r = readCheck('registerCheck', regStored({
    stopReason: 'max_tokens', contradicted: 2, items: [regStoredItem(7), regStoredItem(52)],
  }));
  assert.equal(r.state, 'FINDINGS');
  assert.match(r.detail, /at least 2/);
  assert.match(r.detail, /incomplete/);
  assert.deepEqual(r.lines, [7, 52], 'the line numbers still travel');
  assert.equal(r.items.length, 2, 'and so do the reasons');
});

test('CONTROL: an ordinary clean register check is still CLEAN', () => {
  const r = readCheck('registerCheck', regStored());
  assert.equal(r.state, 'CLEAN', 'the guard must not swallow every clean pass — that would stop every build');
});

test('CONTROL: readCheck and registerEntry agree on every cut-off shape', () => {
  const PAGES = 'A line of script.\n\nAnother line.';
  const shapes = [
    regStored(),
    regStored({ stopReason: 'max_tokens' }),
    regStored({ salvaged: true }),
    regStored({ stopReason: 'max_tokens', contradicted: 1, items: [regStoredItem(7)] }),
    regStored({ salvaged: true, contradicted: 1, items: [regStoredItem(7)] }),
    regStored({ contradicted: 1, items: [regStoredItem(7)] }),
    regStored({ ok: false, contradicted: null, error: 'boom' }),
  ];
  for (const st of shapes) {
    const gate = readCheck('registerCheck', st).state;
    const row = registerEntry(st, PAGES).state;
    assert.equal(gate, row, 'gate ' + gate + ' vs row ' + row + ' on ' + JSON.stringify({
      stopReason: st.stopReason, salvaged: st.salvaged, items: st.items.length, ok: st.ok,
    }));
  }
});

/**
 * WHEN THE ONLY STOP IS UNPROVEN, "AMEND THE UPSTREAM STAGE" IS NOT TRUE.
 * Plan 01 close-out 2, commit 2B.1a.
 *
 * Every stop ends "Amend the upstream stage, or re-run with the findings waived to proceed anyway."
 * On an UNPROVEN-only stop that is wrong twice over: nothing in the treatment is known to be wrong,
 * and amending it cannot change whether the checker quoted accurately. The reader's actual job is to
 * read the quote against the draft.
 *
 * WHICH SENTENCE IS TRUE DEPENDS ON THE ROW, NOT ON THE COMMIT. The plan had 2B.1a land the
 * pre-re-ask wording and 2B.2 replace it. But a stored keepCheck written before the re-ask existed
 * has not been asked twice and never will be, so after 2B.2 the gate would claim a second ask that
 * never happened for every row already on disk. The record itself says which is true: KeepReaskRecord
 * is absent when nobody asked twice, present when they did, and carries `failed` when the second
 * call did not land. Both sentences therefore ship here, chosen per row.
 */
const UNPROVEN_BASE = {
  state: 'UNPROVEN', misses: [],
  unproven: ['the 3 a.m. arrival — the checker claimed this is in the draft but quoted words that are not: "7. 03:50"'],
  summary: 'KEEP CHECK — claimed but not shown: the 3 a.m. arrival',
};
const AMEND = /Amend the upstream stage/;
const gateFor = (keep: any, extra?: any) => preSpendGate(
  { TREATMENT: 'v6', BEATS: 'v3' },
  [{ id: 'v6', kind: 'TREATMENT', data: { ...CLEAN_TWO, keepCheck: keep } },
   { id: 'v3', kind: 'BEATS', data: { ...CLEAN_TWO, ...(extra || {}) } }],
);

test('UNPROVEN alone, never asked twice: the gate says the evidence failed, not "amend"', () => {
  const g = gateFor(UNPROVEN_BASE);
  assert.equal(g.stop, true);
  assert.doesNotMatch(g.text, AMEND, 'nothing in the treatment is known to be wrong:\n' + g.text);
  assert.match(g.text, /its own evidence failed/);
  assert.match(g.text, /Read the quote above against the draft, then waive to proceed\./);
});

test('UNPROVEN alone, asked twice and still unproven: the gate says so', () => {
  const g = gateFor({ ...UNPROVEN_BASE, reask: { asked: 1, proved: 0, absent: 0, stillUnproven: 1 } });
  assert.doesNotMatch(g.text, AMEND);
  assert.match(g.text, /asked again and still could not quote the words/);
});

test('UNPROVEN alone, and the second call FAILED: no second ask is claimed', () => {
  const g = gateFor({ ...UNPROVEN_BASE, reask: { asked: 1, proved: 0, absent: 0, stillUnproven: 1, failed: 'timed out' } });
  assert.doesNotMatch(g.text, AMEND);
  assert.match(g.text, /its own evidence failed/, 'a failed second call settled nothing, so the first sentence still holds');
  assert.doesNotMatch(g.text, /asked again and still could not quote/);
});

test('CONTROL: a MISSES stop still says "Amend the upstream stage"', () => {
  const g = gateFor({ state: 'MISSES', misses: ['the brass key'], unproven: [], summary: 'KEEP CHECK — not found: the brass key' });
  assert.equal(g.stop, true);
  assert.match(g.text, AMEND, 'there amending IS the remedy');
});

test('CONTROL: a MIXED stop still says "Amend the upstream stage"', () => {
  const g = gateFor(UNPROVEN_BASE, {
    registerCheck: { ok: true, checked: 26, contradicted: 1, items: [{ line: 7, section: null, rule: 'r', draft: 'd', why: 'w', quoteFound: true }], summary: '1 of 26' },
  });
  assert.equal(g.findings, 2);
  assert.match(g.text, AMEND, 'something else IS wrong upstream, and amending is the remedy for it');
});

test('CONTROL: a gate that does not stop carries neither sentence', () => {
  const g = gateFor({ state: 'NO MISSES', summary: 'KEEP CHECK — nothing missing' });
  assert.equal(g.stop, false);
  assert.doesNotMatch(g.text, AMEND);
  assert.doesNotMatch(g.text, /waive to proceed/);
});

test('both UNPROVEN sentences point at the draft and never say "amend"', () => {
  for (const keep of [UNPROVEN_BASE, { ...UNPROVEN_BASE, reask: { asked: 1, proved: 0, absent: 0, stillUnproven: 1 } }]) {
    const t = gateFor(keep).text;
    assert.match(t, /Read the quote above against the draft/);
    assert.doesNotMatch(t, /amend/i);
  }
});
