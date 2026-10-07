/**
 * THE SCRIPT'S REGISTER CHECK IS FED RULES, NOT EXITS — Plan 01 close-out 2, commit 1.3.
 * Run: npm run test:unit
 *
 * WHAT IS PROVED WHERE, SAID PLAINLY.
 *
 *   The RULE is scriptRegisterLines, and its control is a logic test in register-check.util.spec:
 *   handed exitsAsCanonFacts output and nothing else, it returns no lines and a reason. That control
 *   fails when the rule is removed, because the function IS the rule.
 *
 *   What a logic test cannot see is whether the CALLER still passes the exits. That is asserted
 *   here, from the source, and it is a weaker kind of evidence — so it is bounded to the enclosing
 *   method. An earlier wiring test in this series compared a store against the next writeScene
 *   ANYWHERE in the file and passed when the store moved to the end of its own method; a file-wide
 *   search here would have the same hole, since `canonFacts` legitimately appears in both methods
 *   for persistFacts.
 *
 *   The real proof is the dry run on a stored script (1.4), which feeds the lines through this exact
 *   helper and prints the verdict.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, 'scripton.service.ts'), 'utf8');

const codeOnly = (t: string): string => t
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

function methodBody(name: string): string {
  const at = SRC.indexOf('private async ' + name + '(');
  assert.ok(at > 0, name + ' not found — this test is bounded to it and must be re-pointed, not deleted');
  const rest = SRC.slice(at);
  const next = rest.slice(1).search(/\n  (?:private|public|protected|async|[a-zA-Z_$][\w$]*\s*\()/);
  return codeOnly(next > 0 ? rest.slice(0, next + 1) : rest);
}

const FEATURE_PATHS = ['generateFeatureAsync', 'extendFeatureAsync'];

/** The one call per method, with its arguments, as written. */
function registerCall(body: string): string {
  const m = body.match(/this\.registerCheckOnScript\([^;]*\)/);
  assert.ok(m, 'no registerCheckOnScript call in this method');
  return m![0];
}

test('both feature paths call the register check exactly once', () => {
  for (const m of FEATURE_PATHS) {
    const body = methodBody(m);
    assert.equal((body.match(/this\.registerCheckOnScript\(/g) || []).length, 1, m);
  }
});

test('CONTROL: neither path hands the exit facts to the register check', () => {
  for (const m of FEATURE_PATHS) {
    const call = registerCall(methodBody(m));
    assert.ok(!/canonFacts/.test(call),
      m + ' still passes canonFacts (kind CHARACTER) — registerLines keeps kind REGISTER, so the '
      + 'list would be empty by construction and the row would report an absence that is not real: ' + call);
  }
});

test('both paths hand it the rule lines resolved from the build', () => {
  for (const m of FEATURE_PATHS) {
    const call = registerCall(methodBody(m));
    assert.match(call, /scriptRules/, m + ': ' + call);
  }
});

test('the exits are still persisted as canon — that is a separate job and is untouched', () => {
  for (const m of FEATURE_PATHS) {
    const body = methodBody(m);
    assert.match(body, /exitsAsCanonFacts\(exits\)/, m);
    assert.match(body, /persistFacts\(docId, canonFacts\)/, m);
  }
});

test('the resolver reads the ladder\'s chain, not the brief alone', () => {
  const body = methodBody('scriptRuleLinesFor');
  // brief -> intake profile, through asSourceText, exactly as generateStage does at :1286-1288.
  assert.match(body, /asSourceText\(brief\.sourceText\)/);
  assert.match(body, /asSourceText\(intakeRow && intakeRow\.sourceText\)/,
    'a build whose source lives on the intake profile would read as having none');
  /**
   * THE FALLBACK MUST BE REACHABLE, NOT MERELY PRESENT.
   *
   * The first version of this assertion only looked for the string `intakeProfile` in the method.
   * Disabling the branch — `if (false)` around it — left the text in place and the test passed on
   * dead code. A presence check on a line inside a conditional proves nothing about the conditional,
   * so the GUARD is what is asserted: the intake read happens when, and only when, the brief gave
   * no source.
   */
  assert.match(body, /if \(!src && projectId\) \{[\s\S]*?intakeProfile/,
    'the intake read must be guarded on the brief having produced nothing — not disabled, not uncondi'
    + 'tional');
});

test('the resolver never triggers an extraction from the script path', () => {
  const body = methodBody('scriptRuleLinesFor');
  assert.match(body, /extract:\s*false/);
  assert.ok(!/extract:\s*true/.test(body), 'a script run must never pay for a canon extraction');
  assert.ok(!/extractCanonForBuild/.test(body), 'nor start one in the background');
});

test('CONTROL: the slice really is one method', () => {
  const body = methodBody('scriptRuleLinesFor');
  assert.ok(!body.includes('registerCheckOnScript('), 'the bound leaked into another method');
  assert.ok(body.length < SRC.length / 4);
});
