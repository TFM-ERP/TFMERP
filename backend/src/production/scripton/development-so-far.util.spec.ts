/**
 * DEVELOPMENT SO FAR says what it holds. Run: npm run test:unit
 *
 * The golden test below is the whole point of this commit: it reproduces the OLD expression
 * (scripton.service.ts:1262, `b.slice(0, 2400)` joined under `--- KIND ---`, then a 14,000-character
 * tail cut) and asserts the new block is byte-for-byte identical once the header lines are
 * normalised away. The labels are the only change; no content and no cap moved.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { developmentSoFar, soFarLabel, SOFAR_PER_STAGE, SOFAR_BLOCK } from './development-so-far.util';

/** The rule exactly as it stood before this change. */
function oldBlock(stages: { kind: string; body: string }[]): string {
  let soFar = '';
  for (const st of stages) { const b = String(st.body || ''); if (b) soFar += '\n--- ' + st.kind + ' ---\n' + b.slice(0, 2400); }
  if (soFar.length > 14000) soFar = soFar.slice(soFar.length - 14000);
  return soFar;
}
const strip = (s: string) => s.replace(/\n--- [A-Z_]+ \((?:first [\d,]+ of [\d,]+ characters|complete, [\d,]+ characters)\) ---\n/g, (m) => '\n--- ' + (/--- ([A-Z_]+) /.exec(m) as RegExpExecArray)[1] + ' ---\n');
const body = (n: number, seed = 'x') => (seed + ' ').repeat(Math.ceil(n / 2)).slice(0, n);

// V2.6's real sizes at BEATS (11 Sep).
const V26 = [{ kind: 'LOGLINE', body: body(241) }, { kind: 'SYNOPSIS', body: body(5034, 'y') }, { kind: 'TREATMENT', body: body(9792, 'z') }];

test('THE LABELS ARE THE ONLY CHANGE: the block matches the old rule byte for byte once headers are normalised', () => {
  for (const stages of [V26,
    [{ kind: 'LOGLINE', body: body(270) }, { kind: 'SYNOPSIS', body: body(4477) }, { kind: 'TREATMENT', body: body(8915) }, { kind: 'BEATS', body: body(12463) }, { kind: 'SCENES', body: body(16974) }, { kind: 'STEP_OUTLINE', body: body(17166) }],
    [{ kind: 'LOGLINE', body: body(80) }],
  ]) {
    const got = developmentSoFar(stages);
    const head = got.block.indexOf('\n---');
    assert.equal(strip(got.block.slice(head)), oldBlock(stages), stages.map((s) => s.kind).join(','));
  }
});

test('V2.6 at BEATS: the three labels state the real numbers', () => {
  const r = developmentSoFar(V26);
  assert.ok(r.block.includes('--- LOGLINE (complete, 241 characters) ---'), 'LOGLINE');
  assert.ok(r.block.includes('--- SYNOPSIS (first 2,400 of 5,034 characters) ---'), 'SYNOPSIS');
  assert.ok(r.block.includes('--- TREATMENT (first 2,400 of 9,792 characters) ---'), 'TREATMENT');
  assert.deepEqual(r.parts, [
    { kind: 'LOGLINE', sent: 241, total: 241, complete: true },
    { kind: 'SYNOPSIS', sent: 2400, total: 5034, complete: false },
    { kind: 'TREATMENT', sent: 2400, total: 9792, complete: false },
  ]);
  assert.equal(r.frontCut, false, 'the 14,000 block cap does not bind at BEATS on any real build measured');
});

test('the header sentence is unchanged and opens the block', () => {
  assert.match(developmentSoFar(V26).block, /^\nDEVELOPMENT SO FAR \(everything already written - stay fully consistent with all of it; build directly on it\):\n--- LOGLINE/);
});

test('a stage shorter than the cap is labelled complete, never "first N of N"', () => {
  assert.equal(soFarLabel('LOGLINE', 241, 241), '--- LOGLINE (complete, 241 characters) ---');
  assert.equal(soFarLabel('TREATMENT', 2400, 9792), '--- TREATMENT (first 2,400 of 9,792 characters) ---');
  assert.equal(soFarLabel('SCENES', 2400, 2400), '--- SCENES (complete, 2,400 characters) ---');
});

test('when the block cap cuts the front, it says so — and a beheaded first entry is never silent', () => {
  const many = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((k) => ({ kind: 'STAGE_' + k, body: body(2400, k.toLowerCase()) }));
  const r = developmentSoFar(many);
  assert.equal(r.frontCut, true);
  assert.match(r.block, /\[The start of this block was cut to fit 14,000 characters: the first entry below may begin mid-sentence\.\]/);
  assert.match(r.block, /^\nDEVELOPMENT SO FAR \([^)]*\):\n\[The start of this block was cut[^\]]*\]\n/, 'the note sits between the header and the content');
  assert.ok(r.block.length <= SOFAR_BLOCK + 400, 'the content still obeys the block cap; only the header and note sit outside it');
});

test('empty in, empty out — no header, no note, and nothing throws', () => {
  for (const stages of [[], [{ kind: 'LOGLINE', body: '' }], null as any, undefined as any]) {
    const r = developmentSoFar(stages);
    assert.equal(r.block, '');
    assert.deepEqual(r.parts, []);
    assert.equal(r.frontCut, false);
  }
});

test('the caps are the ones the service used, and are overridable for tests only', () => {
  assert.equal(SOFAR_PER_STAGE, 2400);
  assert.equal(SOFAR_BLOCK, 14000);
  const r = developmentSoFar([{ kind: 'TREATMENT', body: body(500) }], 100, 14000);
  assert.ok(r.block.includes('--- TREATMENT (first 100 of 500 characters) ---'));
});
