/**
 * The sweep's threshold and the ledger view's vocabulary.
 *
 * THE 18 REAL STUCK ROWS ARE NOT THE FIXTURE (§59). The first boot after this lands consumes them,
 * and every run afterwards would pass against an empty table — a test that stops testing the moment
 * it succeeds. They were evidence that the threshold separates the populations; these tests seed
 * their own values and assert against the pure functions.
 *
 * A2 (a live call survives the sweep) can pass for the wrong reason — a predicate that reaps nothing
 * at all passes it too. The inversion control below is what makes it mean something.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ABANDONED, ABANDONED_AFTER_MS, abandonedBefore, runResult } from './ai-run-reaper.util';

const NOW = new Date('2026-09-15T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);
/** What the sweep's WHERE clause decides, expressed once so the tests exercise the real rule. */
const wouldReap = (createdAt: Date, afterMs = ABANDONED_AFTER_MS) => createdAt < abandonedBefore(NOW, afterMs);

test('A1: a RUNNING row older than the threshold is reaped', () => {
  assert.equal(wouldReap(ago(2 * 60 * 60 * 1000)), true);
});

test('A2: a RUNNING row inside the threshold is left alone — a live call survives its own boot', () => {
  assert.equal(wouldReap(NOW), false);
  assert.equal(wouldReap(ago(59 * 60 * 1000)), false);
  // The longest timeout in the codebase is the register check's 900,000ms ceiling. A call that has
  // been running for its entire permitted lifetime must still not be reaped.
  assert.equal(wouldReap(ago(900000)), false, 'a register check at its full 15-minute ceiling was reaped');
});

test('A6 THE INVERSION CONTROL: the threshold is what does the work', () => {
  // Same row that A2 protects, swept with a 1-second threshold: it IS reaped. If A2 were passing
  // because the query matches nothing, this would pass too — and it does not.
  assert.equal(wouldReap(ago(5000), 1000), true, 'with a 1s threshold a 5s-old row must be reaped');
  assert.equal(wouldReap(ago(5000)), false, 'with the real threshold the same row must survive');
});

test('the threshold clears the slowest call this ledger has ever completed', () => {
  // Measured 15 Sep: max 591s, p99.9 526s. The margin is the point — a threshold that merely beat
  // the p99 would reap the tail.
  assert.ok(ABANDONED_AFTER_MS > 591000 * 6, 'the threshold is no longer 6x the slowest completed call');
  assert.equal(wouldReap(ago(591000)), false, 'the slowest call ever completed would have been reaped');
});

test('A5b: ALL THREE READERS know the word, not just the one behind runResult()', () => {
  // runResult() only governs the API. Two React components carry their own copy of the same ternary
  // — `r.result === 'error' ? 'red' : r.result === 'running' ? 'amber' : 'green'` — and their
  // implicit else paints anything unrecognised GREEN, the success colour. So the sweep would have
  // turned 18 stuck amber rows into 18 green ones reading ABANDONED. The shared mapper cannot reach
  // them: it does not cross the API boundary.
  //
  // WHAT THIS TEST IS, SAID PLAINLY: a presence check on source text. It proves the branch exists,
  // not that the colour is right — presence is not correctness. It is here because the type system
  // stops at the API and nothing else would notice the day a third component is written.
  const { readFileSync } = require('fs');
  const { join } = require('path');
  const web = join(__dirname, '..', '..', '..', 'frontend', 'src', 'components', 'scripton');
  for (const f of ['ScriptOnSettings.tsx', join('studio', 'ScriptonStudio.tsx')]) {
    const src = readFileSync(join(web, f), 'utf8');
    assert.match(src, /r\.result === 'abandoned'/, f + ' renders an abandoned run through its implicit else — green, the success colour');
    assert.match(src, /\.badge\.grey\{/, f + ' selects a badge class it does not define');
  }
});

test('A5: the ledger view knows the word — ABANDONED is not rendered as running', () => {
  assert.equal(runResult(ABANDONED), 'abandoned');
  assert.equal(runResult('DONE'), 'success');
  assert.equal(runResult('ERROR'), 'error');
  assert.equal(runResult('RUNNING'), 'running');
  // The defect this guards: an implicit else renders every unrecognised status as 'running', which
  // would turn stuck rows into lying ones. Anything genuinely unknown may still fall through.
  assert.equal(runResult('SOMETHING_NEW'), 'running');
});
