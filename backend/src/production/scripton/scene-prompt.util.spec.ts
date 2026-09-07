import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { SCENE_SYSTEM_PROMPT, sceneLengthRule } from './scene-prompt.util';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

// The real spread of page weights the allocator interleaves across a feature (§01 telemetry:
// 0.25 / 0.5 / 1.5 / 2 across 126 scenes). If the system prompt is going to vary, it varies here.
const BUDGETS = [
  { pages: 0.25, wordsAsk: 60, wordsMax: 90, target: 14, maxTokens: 311 },
  { pages: 0.5, wordsAsk: 120, wordsMax: 170, target: 28, maxTokens: 411 },
  { pages: 1, wordsAsk: 260, wordsMax: 330, target: 55, maxTokens: 800 },
  { pages: 1.5, wordsAsk: 390, wordsMax: 480, target: 83, maxTokens: 1100 },
  { pages: 2, wordsAsk: 520, wordsMax: 640, target: 110, maxTokens: 1400 },
] as any[];

test('THE REGRESSION: the system prompt is byte-identical across every budget and cast shape', () => {
  // Hashed, not read. This is the invariant that broke: the per-scene length rule was concatenated
  // into `system`, system sits ABOVE messages in the cache prefix, so the story-context breakpoint
  // below it was invalidated on every call — every scene wrote a new entry at 1.25x and read none.
  const hashes = new Set<string>();
  for (const b of BUDGETS) {
    for (const characters of ['NORA, JAMES', '', undefined as any]) {
      void sceneLengthRule(b, characters);   // building the per-scene half must not touch the constant
      hashes.add(sha(SCENE_SYSTEM_PROMPT));
    }
  }
  assert.equal(hashes.size, 1, 'the system prompt must hash identically on every call, or caching cannot work');
});

test('the system prompt carries no per-scene value — checked structurally, not by eye', () => {
  assert.ok(!/\d+\s*WORDS/i.test(SCENE_SYSTEM_PROMPT), 'a word budget leaked back into the role definition');
  assert.ok(!/approximately \d/.test(SCENE_SYSTEM_PROMPT));
  assert.ok(!/ONE full page|of a page|\d+ pages/.test(SCENE_SYSTEM_PROMPT), 'a page target leaked in');
  assert.ok(!/PACING:/.test(SCENE_SYSTEM_PROMPT), 'the pacing rule depends on the cast and must stay per-scene');
  assert.ok(!/LENGTH IS STRICT/.test(SCENE_SYSTEM_PROMPT));
});

test('it is still the screenwriter role, in full — the relocation moved text, it did not drop it', () => {
  assert.match(SCENE_SYSTEM_PROMPT, /professional screenwriter writing ONE scene/);
  assert.match(SCENE_SYSTEM_PROMPT, /FINAL DRAFT format/);
  assert.match(SCENE_SYSTEM_PROMPT, /Output ONLY the scene text/);
  assert.match(SCENE_SYSTEM_PROMPT, /Do NOT write the scene heading/);
  assert.ok(!/\s{2,}/.test(SCENE_SYSTEM_PROMPT), 'no double space left where the length rule was cut out');
});

test('the per-scene half really does vary — otherwise it did not need moving', () => {
  const rules = BUDGETS.map((b) => sceneLengthRule(b, 'NORA'));
  assert.equal(new Set(rules).size, BUDGETS.length, 'every budget must produce a different rule');
  assert.match(rules[0], /60 WORDS/);
  assert.match(rules[4], /520 WORDS/);
});

test('the pacing clause follows the cast, which is the second thing that was varying', () => {
  const withCast = sceneLengthRule(BUDGETS[2], 'NORA, JAMES');
  const without = sceneLengthRule(BUDGETS[2], '');
  assert.notEqual(withCast, without);
  assert.match(withCast, /at most THREE description paragraphs/);
  assert.match(without, /establishing beat/);
});

test('a short beat and a long scene get opposite instructions', () => {
  assert.match(sceneLengthRule(BUDGETS[0], 'NORA'), /SHORT beat/);
  assert.match(sceneLengthRule(BUDGETS[4], 'NORA'), /Fill the space with real dramatic content/);
});

test('the length rule is substantial enough to be worth keeping out of the cached prefix', () => {
  // If this were trivial the split would be pointless churn; it is ~1KB of per-scene instruction.
  assert.ok(sceneLengthRule(BUDGETS[2], 'NORA').length > 600);
});
