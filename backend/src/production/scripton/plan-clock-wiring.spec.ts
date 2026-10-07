/**
 * THE CAPTURE HAPPENS BEFORE THE CLEAR — Plan 01 close-out 2, commit 3.2.
 * Run: npm run test:unit
 *
 * WHY A SOURCE ASSERTION, AND WHY IT IS BOUNDED.
 *
 * clockBackwardPairs is covered by its own logic tests. The one thing they cannot see is ORDER: a
 * capture moved below clock.clear() reads an empty map, returns two empty arrays, and produces a
 * perfectly well-formed finding that simply names no points — which is exactly the state this commit
 * exists to leave behind. Every format test still passes. So the order is asserted here.
 *
 * BOUNDED TO extractPlanState. An earlier wiring test in this series compared a store against the
 * next writeScene ANYWHERE in the file, and passed when the store moved to the end of its own
 * method. A file-wide index comparison would have the same hole: `clock.clear()` could move, or a
 * second clear could appear elsewhere, and the assertion would still find SOME clear after SOME
 * capture. Everything below is sliced to the enclosing method first.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, 'scripton.service.ts'), 'utf8');

/** The body of one private method, from its signature to the start of the next method at the same depth. */
function methodBody(name: string): string {
  const at = SRC.indexOf('private async ' + name + '(');
  assert.ok(at > 0, name + ' not found — this test is bounded to it and must be re-pointed, not deleted');
  const rest = SRC.slice(at);
  const next = rest.slice(1).search(/\n  (?:private|public|protected|async|[a-zA-Z_$][\w$]*\s*\()/);
  return next > 0 ? rest.slice(0, next + 1) : rest;
}

/**
 * CODE ONLY. The first draft of this test read the raw body and failed against a correct
 * implementation: the comment explaining the ordering says "clock.clear() on the next line", so
 * indexOf found the PROSE before the capture and the assertion inverted. An order assertion that a
 * comment can flip is not an order assertion. Comments are stripped before anything is indexed —
 * and that also means the explanation can name the call it is about without breaking its own test.
 */
const codeOnly = (t: string): string => t
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('extractPlanState keeps the planned clock BEFORE it clears the map', () => {
  const body = codeOnly(methodBody('extractPlanState'));
  const capture = body.indexOf('clockBackwards = clockBackwardPairs(');
  const clear = body.indexOf('clock.clear()');
  assert.ok(capture > 0, 'the capture is not in extractPlanState at all');
  assert.ok(clear > 0, 'clock.clear() is not in extractPlanState at all');
  assert.ok(capture < clear,
    'the capture must precede clock.clear(): after it, the map is empty and the finding names nothing');
});

test('exactly one clear in that method, so the ordering above is not satisfied by a different one', () => {
  const body = codeOnly(methodBody('extractPlanState'));
  assert.equal((body.match(/clock\.clear\(\)/g) || []).length, 1);
  assert.equal((body.match(/clockBackwards = clockBackwardPairs\(/g) || []).length, 1);
});

test('the planned points are read from the sorted list the count was taken from', () => {
  const body = codeOnly(methodBody('extractPlanState'));
  // `times` is what `backwards` is computed over; the capture must use the same array, not re-read
  // the map, or the two could disagree about order.
  assert.match(body, /clockPlanned = times\.map\(/);
  assert.match(body, /const backwards = times\.filter\(/);
});

test('both feature paths hand the pairs to the finding and the points to the note', () => {
  for (const m of ['generateFeatureAsync', 'extendFeatureAsync']) {
    const body = codeOnly(methodBody(m));
    assert.match(body, /clockBackwards: planState\.clockBackwards/, m + ' does not pass the pairs');
    assert.match(body, /clockPlanned: planState\.clockPlanned/, m + ' does not pass the planned points');
  }
});

test('CONTROL: the slice really is one method — it does not reach the next one', () => {
  const body = methodBody('extractPlanState');
  assert.ok(!body.includes('private async registerCheckOnScript('),
    'the bound leaked into another method, which is how the earlier wiring test went blind');
  assert.ok(body.length < SRC.length / 2, 'the slice is most of the file: the bound is not working');
});
