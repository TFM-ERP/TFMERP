/**
 * The window, the budget, and the two branches that had no acceptance until they were asked for:
 * the floor (a budget too small to be worth a fragment) and the negative control.
 *
 * THE HOUSE PATTERN, stated here because this is where it was named: a presence assertion ships
 * with the switch that falsifies it. Every test below that asserts the ENDING is present is
 * accompanied by a run with headShare 1.0 — head-only, the old behaviour — which must turn that
 * same assertion red. An assertion never seen to fail is not evidence.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  windowKeepingEnd, allocate, elisionMarker, windowLabel,
  MIN_TAIL_CHARS, MIN_SIDE_CHARS, MIN_HEAD_CHARS, DEFAULT_HEAD_SHARE,
} from './excerpt-window.util';

/** A document whose end is unmistakable, shaped like a beat map: paragraphs, numbered. */
const doc = (paras: number, per = 500): string =>
  Array.from({ length: paras }, (_, i) =>
    '■ Beat ' + (i + 1) + ' — ' + 'x'.repeat(per) + (i === paras - 1 ? ' JASONS ENOUGH' : '')).join('\n\n');

const BODY = doc(20);

test('a body inside its budget is returned whole, with no marker', () => {
  const w = windowKeepingEnd(BODY, BODY.length + 10);
  assert.equal(w.complete, true);
  assert.equal(w.elided, 0);
  assert.equal(w.text, BODY);
  assert.equal(w.dropped, false);
  assert.doesNotMatch(w.text, /omitted here/);
});

test('THE ENDING SURVIVES a budget that cannot hold the body', () => {
  const w = windowKeepingEnd(BODY, 4000);
  assert.equal(w.complete, false);
  assert.match(w.text, /JASONS ENOUGH/);          // the document's true end
  assert.match(w.text, /Beat 1 /);                 // and its opening
  assert.match(w.text, /omitted here, from the MIDDLE/);
});

test('NEGATIVE CONTROL — head-only loses the ending, in the same run', () => {
  const headOnly = windowKeepingEnd(BODY, 4000, { headShare: 1, minTail: 0, minSide: 0 });
  assert.doesNotMatch(headOnly.text, /JASONS ENOUGH/);
  // and the real setting, immediately after, does not:
  assert.match(windowKeepingEnd(BODY, 4000).text, /JASONS ENOUGH/);
});

/**
 * WHY THE CONTROL ABOVE PASSES minSide: 0, AND WHAT HAPPENS WHEN IT DOES NOT.
 *
 * `headShare: 1` alone does NOT produce head-only output: the tail is clamped up to MIN_SIDE, so a
 * 400-character tail survives and still contains the document's end. The first integration-level
 * negative control written against buildSpine used headShare alone, and every ending stayed
 * PRESENT — a control that could not fail, which is the exact defect this pattern exists to catch,
 * reproduced inside the instrument checking for it. The honest falsifier at the call site is to
 * revert the caller to `body.slice(0, budget)`; the honest falsifier here is minSide 0.
 */
test('headShare 1 alone is NOT head-only — MIN_SIDE keeps a tail', () => {
  const clamped = windowKeepingEnd(BODY, 4000, { headShare: 1, minTail: 0 });
  assert.match(clamped.text, /JASONS ENOUGH/, 'MIN_SIDE should have preserved a tail');
  const truly = windowKeepingEnd(BODY, 4000, { headShare: 1, minTail: 0, minSide: 0 });
  assert.doesNotMatch(truly.text, /JASONS ENOUGH/);
});

test('the result never exceeds its budget — the marker is charged inside it', () => {
  for (const budget of [2200, 3000, 4000, 9000, 12000]) {
    const w = windowKeepingEnd(BODY, budget);
    assert.ok(w.text.length <= budget, 'budget ' + budget + ' produced ' + w.text.length);
  }
});

test('nothing is cut mid-word', () => {
  const w = windowKeepingEnd(BODY, 4000);
  const [head, tail] = w.text.split(/\n\n---[\s\S]*?---\n\n/);
  assert.ok(!/\S$/.test(head) || /[\sx]$/.test(head), 'head ended mid-token: ' + JSON.stringify(head.slice(-20)));
  assert.ok(/^[■x]/.test(tail) || /^\S/.test(tail), 'tail began oddly: ' + JSON.stringify(tail.slice(0, 20)));
});

test('sent + elided always accounts for the whole document', () => {
  for (const budget of [2200, 4000, 9000]) {
    const w = windowKeepingEnd(BODY, budget);
    assert.equal(w.sent + w.elided, w.total);
  }
});

test('MIN_TAIL lifts a mid-size budget off the share, and is inert on a large one', () => {
  const mid = windowKeepingEnd(BODY, 4000);
  const tail = mid.text.split(/---\n\n/)[1] || '';
  assert.ok(tail.length >= MIN_TAIL_CHARS - 400, 'tail was ' + tail.length);
  // At 9,000 the share already exceeds MIN_TAIL, so overriding it changes nothing.
  assert.equal(windowKeepingEnd(BODY, 9000).sent, windowKeepingEnd(BODY, 9000, { minTail: 0 }).sent);
});

/**
 * THE HEAD HAS A FLOOR, and 2,200 is the budget that proved it was needed. With MIN_TAIL 1,600 and
 * no head floor, buildFeatureCtx's old beat-map budget produced a 477-character opening against a
 * 1,600-character ending: 81% of the end, 4% of the start. Now that budget is below the floor and
 * the part says it was not carried instead of pretending to be a window.
 */
test('MIN_HEAD — the tail may not eat the opening', () => {
  const w = windowKeepingEnd(BODY, 6000);
  const [head, tail] = w.text.split(/\n\n---[\s\S]*?---\n\n/);
  assert.ok(head.length >= MIN_HEAD_CHARS - 300, 'head was only ' + head.length);
  assert.ok(tail.length >= MIN_TAIL_CHARS - 300, 'tail was only ' + tail.length);
});

test('a budget that cannot give BOTH ends a floor is dropped, not degraded', () => {
  const w = windowKeepingEnd(BODY, 2200);          // the old buildFeatureCtx beat-map budget
  assert.equal(w.dropped, true, 'a 477-character head is not a window');
  assert.equal(w.text, '');
});

// ── THE FLOOR: the branch that had no acceptance until it was asked for ───────────────────────

test('FLOOR — a budget under marker + 2x MIN_SIDE is DROPPED, not emitted as a stub', () => {
  const w = windowKeepingEnd(BODY, 500);
  assert.equal(w.dropped, true);
  assert.equal(w.text, '');
  assert.equal(w.sent, 0);
  assert.equal(w.elided, w.total);
  assert.equal(w.complete, false);
});

test('FLOOR — just above it, a real window is produced instead', () => {
  const room = elisionMarker(BODY.length, BODY.length).length + 2 + MIN_HEAD_CHARS + MIN_TAIL_CHARS;
  const w = windowKeepingEnd(BODY, room + 50);
  assert.equal(w.dropped, false);
  assert.ok(w.sent > 0);
  assert.match(w.text, /JASONS ENOUGH/);
});

test('an empty body is complete and never dropped', () => {
  const w = windowKeepingEnd('', 100);
  assert.equal(w.complete, true);
  assert.equal(w.dropped, false);
  assert.equal(w.text, '');
});

// ── The seam and the face ─────────────────────────────────────────────────────────────────────

test('the seam claims exactly what snapping guarantees, and no more', () => {
  const m = elisionMarker(2996, 11996);
  assert.match(m, /2,996 of 11,996 characters omitted here, from the MIDDLE/);
  assert.match(m, /What follows runs to the end of the document, verbatim\./);
  // "complete" claims the ending is whole — a small budget can start the tail inside the final beat.
  assert.doesNotMatch(m, /complete/);
});

test('the block face matches developmentSoFar\'s convention', () => {
  const whole = windowKeepingEnd(BODY, BODY.length + 1);
  assert.equal(windowLabel('BEAT MAP', whole), 'BEAT MAP (complete, ' + BODY.length.toLocaleString('en-US') + ' characters)');
  const cut = windowKeepingEnd(BODY, 4000);
  assert.match(windowLabel('BEAT MAP', cut), /^BEAT MAP \(opening and ending - [\d,]+ of [\d,]+ characters; [\d,]+ omitted from the middle\)$/);
});

// ── allocate ──────────────────────────────────────────────────────────────────────────────────

const ASKS = [
  { kind: 'SYNOPSIS', body: 'x'.repeat(5625), cap: 4000 },
  { kind: 'TREATMENT', body: 'x'.repeat(8371), cap: 9000 },
  { kind: 'BEATS', body: 'x'.repeat(11996), cap: 9000 },
  { kind: 'STEP_OUTLINE', body: 'x'.repeat(14399), cap: 9000 },
];

test('every part is funded — the outline is never starved by arriving last', () => {
  const a = allocate(ASKS, 20000);
  for (const x of a) assert.ok(x.budget > 0, x.kind + ' got nothing');
  assert.ok(a.find((x) => x.kind === 'STEP_OUTLINE')!.budget > 5000);
});

test('ORDER-INDEPENDENT — the same asks in any order allocate identically', () => {
  const forward = allocate(ASKS, 20000);
  const reversed = allocate(ASKS.slice().reverse(), 20000);
  for (const f of forward) assert.equal(reversed.find((r) => r.kind === f.kind)!.budget, f.budget, f.kind);
});

test('NEGATIVE CONTROL for order-independence — arrival order DOES starve the tail', () => {
  // What the code did before: fund in arrival order until the budget runs out.
  let rem = 20000;
  const byArrival = ASKS.map((a) => { const take = Math.min(Math.min(a.body.length, a.cap), rem); rem -= take; return { kind: a.kind, budget: take }; });
  assert.equal(byArrival.find((x) => x.kind === 'STEP_OUTLINE')!.budget, 0);   // starved, as measured
  assert.ok(allocate(ASKS, 20000).find((x) => x.kind === 'STEP_OUTLINE')!.budget > 0);
});

test('a part wanting less than its share releases the surplus', () => {
  const a = allocate([{ kind: 'SMALL', body: 'x'.repeat(100) }, { kind: 'BIG', body: 'x'.repeat(50000) }], 10000);
  assert.equal(a.find((x) => x.kind === 'SMALL')!.budget, 100);
  assert.equal(a.find((x) => x.kind === 'BIG')!.budget, 9900);
});

test('the allocation never exceeds the total', () => {
  for (const total of [1000, 20000, 30500, 100000]) {
    const sum = allocate(ASKS, total).reduce((s, x) => s + x.budget, 0);
    assert.ok(sum <= total, 'total ' + total + ' allocated ' + sum);
  }
});

test('everything fits when the total is large enough, and nothing is over-funded', () => {
  const a = allocate(ASKS, 40000);
  assert.deepEqual(a.map((x) => x.budget), [4000, 8371, 9000, 9000]);
});

test('FLOOR — a part funded below the floor is dropped, not given a stub', () => {
  const a = allocate(ASKS, 2000, { floor: 1000 });
  assert.ok(a.some((x) => x.dropped), 'nothing was dropped at a 2,000 budget with a 1,000 floor');
  for (const x of a) assert.ok(x.dropped ? x.budget === 0 : x.budget >= 1000, x.kind);
});

test('empty and absent parts do not consume budget', () => {
  const a = allocate([{ kind: 'EMPTY', body: '' }, { kind: 'REAL', body: 'x'.repeat(5000) }], 10000);
  assert.equal(a.length, 1);
  assert.equal(a[0].kind, 'REAL');
  assert.equal(a[0].budget, 5000);
});

test('DEFAULT_HEAD_SHARE leaves the tail its 40%', () => {
  assert.equal(DEFAULT_HEAD_SHARE, 0.6);
});
