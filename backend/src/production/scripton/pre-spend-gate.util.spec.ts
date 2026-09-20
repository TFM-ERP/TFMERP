/**
 * C2's acceptance: THREE FIXTURES, THREE DIFFERENT OUTPUTS.
 *
 * If (b) and (c) render the same, C2 has reproduced the defect it exists to end — so the decisive
 * assertions are the ones comparing the rendered text of a clean check against an absent one.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { preSpendGate, readCheck, gateText } from './pre-spend-gate.util';

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

test('one FINDINGS among many CLEAN still stops, and the others are still reported', () => {
  const r = preSpendGate(
    { STEP_OUTLINE: 'v-1', SCENES: 'v-2' },
    [{ id: 'v-1', data: { registerCheck: WITH_ITEMS, eraCheck: { state: 'NO FINDINGS' } } },
     { id: 'v-2', data: { registerCheck: ZERO_ITEMS, eraCheck: { state: 'NO FINDINGS' } } }],
    { checks: ['registerCheck', 'eraCheck'] },
  );
  assert.equal(r.stop, true);
  assert.equal(r.findings, 1);
  assert.equal(r.clean, 3);
  assert.match(r.text, /SCENES — registerCheck: checked, clean/);
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
