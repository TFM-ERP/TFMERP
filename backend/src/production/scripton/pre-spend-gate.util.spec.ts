/**
 * C2's acceptance: THREE FIXTURES, THREE DIFFERENT OUTPUTS.
 *
 * If (b) and (c) render the same, C2 has reproduced the defect it exists to end — so the decisive
 * assertions are the ones comparing the rendered text of a clean check against an absent one.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { preSpendGate, readCheck, gateText, markPreSpendRefusal, isPreSpendRefusal, errorTextForJob } from './pre-spend-gate.util';

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
