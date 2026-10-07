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
 *
 * AND THE SOURCE ASSERTIONS WERE NOT ENOUGH. The first version of this file only required the NAME
 * `scriptRules` to appear in the call. Replacing the resolver with
 *
 *     const scriptRules = scriptRegisterLines({ sourceChars: 9999, canonRead: true, facts: canonFacts })
 *
 * keeps that name, hardcodes a source length, asserts a canon was read, and feeds the EXITS — the
 * original fault in full — and all seven tests passed. So the assignment's SOURCE is now pinned,
 * and the resolver has behavioural tests of its own below: a source assertion can say what a method
 * is written as, never what it does.
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

test('CONTROL: scriptRules is assigned FROM the resolver, in both methods', () => {
  for (const m of FEATURE_PATHS) {
    const body = methodBody(m);
    assert.match(body, /const scriptRules = await this\.scriptRuleLinesFor\(bRow, projectId\)/,
      m + ' assigns scriptRules from something other than the resolver. Keeping the NAME while '
      + 'building the lines inline — hardcoding sourceChars, asserting canonRead, passing canonFacts '
      + '— is the original fault wearing the new variable, and it is what the earlier version of '
      + 'this test let through.');
    // and nothing else in the method may build lines directly
    assert.ok(!/scriptRegisterLines\(/.test(body),
      m + ' calls scriptRegisterLines directly; the decision belongs to the resolver alone');
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

/**
 * THE RESOLVER, EXERCISED — not read.
 *
 * scriptRuleLinesFor is private and reaches prisma, loadSourceCanon, the logger and this.why. It is
 * called through the prototype with a fake `this` carrying exactly those four, so the seven cases
 * below run the real body with no Nest module, no database and no model call.
 */
import { ScripOnService } from './scripton.service';

/** 420 characters — over CANON_MIN_SOURCE_CHARS, so the canon path is reached. Invented. */
const LONG_SOURCE = 'The ferry runs twice a day and the island has one shop. '.repeat(8);
const SHORT_SOURCE = 'A short premise about a ferry and a shop on a small island, not long enough to extract.';

interface Calls { canon: any[]; intake: any[]; warned: string[] }

function fakeThis(opts: {
  canon?: any;                       // what loadSourceCanon resolves to
  canonThrows?: Error;               // or throws
  intakeSource?: string | null;      // intakeProfile.sourceText
} = {}): { ctx: any; calls: Calls } {
  const calls: Calls = { canon: [], intake: [], warned: [] };
  const ctx: any = {
    prisma: {
      intakeProfile: {
        findUnique: (args: any) => {
          calls.intake.push(args);
          return Promise.resolve(opts.intakeSource == null ? null : { sourceText: opts.intakeSource });
        },
      },
    },
    loadSourceCanon: (projectId: string, src: string, o: any) => {
      calls.canon.push({ projectId, srcLen: src.length, opts: o });
      if (opts.canonThrows) return Promise.reject(opts.canonThrows);
      return Promise.resolve(opts.canon === undefined ? null : opts.canon);
    },
    log: { warn: (m: string) => calls.warned.push(m), log: () => {} },
    why: (e: any) => String((e && e.message) || e),
  };
  return { ctx, calls };
}

const resolve = (ctx: any, bRow: any, projectId: any) =>
  (ScripOnService.prototype as any).scriptRuleLinesFor.call(ctx, bRow, projectId);

const RULE_FACT = (kind: string, statement: string, sourceOffset?: number) =>
  ({ kind, subject: 'X', predicate: 'p', object: 'o', statement, validFrom: 0, validTo: null, sourceOffset });
const STORED = { facts: [RULE_FACT('PROHIBITION', 'Do not take the late ferry.', 10), RULE_FACT('ORDERING', 'The shop closes before the ferry leaves.', 60)] };

test('1 — a brief source with stored rules yields lines, and the canon is read READ-ONLY', async () => {
  const { ctx, calls } = fakeThis({ canon: STORED });
  const got = await resolve(ctx, { brief: { sourceText: LONG_SOURCE } }, 'proj-1');
  assert.equal(got.notRunReason, null);
  assert.equal(got.lines.length, 2);
  assert.deepEqual(got.lines.map((l: any) => l.kind), ['PROHIBITION', 'ORDERING']);
  assert.equal(calls.canon.length, 1);
  assert.deepEqual(calls.canon[0].opts, { extract: false },
    'a script run must never pay for a canon extraction nor wait for one');
  assert.equal(calls.canon[0].srcLen, LONG_SOURCE.trim().length, 'the canon is keyed on the TRIMMED source');
  assert.equal(calls.intake.length, 0, 'the brief answered, so the intake profile is not queried');
});

test('2 — no brief source falls through to the intake profile', async () => {
  const { ctx, calls } = fakeThis({ canon: STORED, intakeSource: LONG_SOURCE });
  const got = await resolve(ctx, { brief: {} }, 'proj-2');
  assert.equal(got.notRunReason, null);
  assert.equal(got.lines.length, 2);
  assert.equal(calls.intake.length, 1, 'a build whose source lives on the intake profile must be found');
  assert.deepEqual(calls.intake[0], { where: { projectId: 'proj-2' } });
});

test('3 — no source anywhere says so, and never reads a canon', async () => {
  const { ctx, calls } = fakeThis({ intakeSource: null });
  const got = await resolve(ctx, { brief: {} }, 'proj-3');
  assert.equal(got.lines.length, 0);
  assert.match(got.notRunReason, /^no source on this build/);
  assert.equal(calls.canon.length, 0, 'nothing to key a canon on');
});

test('4 — a 212-character source is a source, and says why it has no rules', async () => {
  const src = 'x'.repeat(212);
  const { ctx, calls } = fakeThis();
  const got = await resolve(ctx, { brief: { sourceText: src } }, 'proj-4');
  assert.match(got.notRunReason, /the source is 212 characters/);
  assert.match(got.notRunReason, /400/);
  assert.doesNotMatch(got.notRunReason, /^no source/);
  assert.equal(calls.canon.length, 1, 'the canon is still looked for; it is simply never there');
});

test('5 — a source whose canon was never extracted says the rules could not be read', async () => {
  const { ctx } = fakeThis({ canon: undefined });   // loadSourceCanon resolves null
  const got = await resolve(ctx, { brief: { sourceText: LONG_SOURCE } }, 'proj-5');
  assert.equal(got.lines.length, 0);
  assert.match(got.notRunReason, /^the rules could not be read/);
  assert.match(got.notRunReason, /no stored canon/);
});

test('6 — a canon read that THROWS is not a source without rules', async () => {
  const { ctx, calls } = fakeThis({ canonThrows: new Error('P1001 cannot reach the database') });
  const got = await resolve(ctx, { brief: { sourceText: LONG_SOURCE } }, 'proj-6');
  assert.equal(got.lines.length, 0);
  assert.match(got.notRunReason, /^the rules could not be read/);
  assert.match(got.notRunReason, /could not be loaded/, 'a failure names itself, not "no rule facts"');
  assert.match(got.notRunReason, /P1001/, 'and carries the reason it failed');
  assert.equal(calls.warned.length, 1, 'and is logged, because a run continues past it');
});

test('7 — no build row at all still resolves, via the project', async () => {
  const { ctx, calls } = fakeThis({ canon: STORED, intakeSource: LONG_SOURCE });
  const got = await resolve(ctx, null, 'proj-7');
  assert.equal(got.notRunReason, null, 'the legacy path has no build row but the project may still have a source');
  assert.equal(calls.intake.length, 1);
  // and with neither, it is the "no source" sentence, not a crash
  const bare = fakeThis({ intakeSource: null });
  assert.match((await resolve(bare.ctx, null, null)).notRunReason, /^no source on this build/);
  assert.equal(bare.calls.intake.length, 0, 'no projectId, so nothing to query');
});

test('CONTROL: extract:true would be a paid call on a read-only path', async () => {
  const { ctx, calls } = fakeThis({ canon: STORED });
  await resolve(ctx, { brief: { sourceText: LONG_SOURCE } }, 'proj-x');
  assert.equal(calls.canon[0].opts.extract, false);
  assert.ok(!('extract' in calls.canon[0].opts) || calls.canon[0].opts.extract === false);
});
