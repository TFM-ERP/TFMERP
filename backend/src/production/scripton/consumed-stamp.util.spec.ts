/**
 * C1's acceptance, at the unit where the three cases can be made to fail.
 *
 * The house pattern: a presence assertion ships with the switch that falsifies it.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { consumedStamp, hasConsumed } from './consumed-stamp.util';

/** Shaped like pipeline()'s output: `current` already resolved, `currentVersionId` still on the row. */
const stage = (kind: string, currentId: string | null, currentVersionId: string | null = currentId) =>
  ({ kind, currentVersionId, current: currentId ? { id: currentId } : null });

const STAGES = [
  stage('LOGLINE', 'v-log-1'),
  stage('SYNOPSIS', 'v-syn-2'),
  stage('TREATMENT', 'v-tre-3'),
  stage('BEATS', 'v-bea-4'),
];

test('ACCEPTANCE 1 — names every carried kind, and no others', () => {
  const s = consumedStamp(['LOGLINE', 'SYNOPSIS'], STAGES);
  assert.deepEqual(s, { LOGLINE: 'v-log-1', SYNOPSIS: 'v-syn-2' });
  assert.equal('TREATMENT' in s, false, 'a kind that did not reach the prompt must not be stamped');
  assert.equal('BEATS' in s, false);
});

test('a kind named as OMITTED by the budget is not carried, so it is not stamped', () => {
  // developmentSoFar returns parts[] (carried) and omitted[] separately; only parts are passed in.
  const carriedParts = [{ kind: 'BEATS' }];
  const s = consumedStamp(carriedParts, STAGES);
  assert.deepEqual(s, { BEATS: 'v-bea-4' });
});

/**
 * ACCEPTANCE 2 — THE FALLBACK CASE, and the reason the stamp is taken from pipeline()'s result.
 *
 * With currentVersionId NULL, :781 falls back to versions[versions.length - 1]. The resolved
 * `current` therefore names the LAST version while `currentVersionId` names nothing.
 */
test('ACCEPTANCE 2 — currentVersionId NULL: the stamp names the FALLBACK version', () => {
  const fallback = [stage('STEP_OUTLINE', 'v-last-9', null)];
  assert.equal(fallback[0].currentVersionId, null);
  assert.deepEqual(consumedStamp(['STEP_OUTLINE'], fallback), { STEP_OUTLINE: 'v-last-9' });
});

test('NEGATIVE CONTROL for acceptance 2 — a stamp read from currentVersionId would name nothing here', () => {
  const fallback = [stage('STEP_OUTLINE', 'v-last-9', null)];
  // The rejected implementation, written out so its failure is visible rather than argued:
  const wrong: Record<string, string> = {};
  for (const s of fallback) if (s.currentVersionId) wrong[s.kind] = s.currentVersionId;
  assert.deepEqual(wrong, {}, 'currentVersionId is null in the fallback case');
  assert.notDeepEqual(consumedStamp(['STEP_OUTLINE'], fallback), wrong, 'the real stamp must differ from it');
});

/**
 * ACCEPTANCE 3 — A STAMP THAT DOES NOT MOVE WHEN THE INPUT MOVES IS NOT A STAMP.
 */
test('ACCEPTANCE 3 — point the resolution at a different version and the stamp CHANGES', () => {
  const before = consumedStamp(['SCENES'], [stage('SCENES', 'v6')]);
  const after = consumedStamp(['SCENES'], [stage('SCENES', 'v9')]);
  assert.deepEqual(before, { SCENES: 'v6' });
  assert.deepEqual(after, { SCENES: 'v9' });
  assert.notDeepEqual(before, after, 'the stamp did not move when the consumed version moved');
});

test('a stage with no resolved version is skipped, not stamped as null', () => {
  const s = consumedStamp(['LOGLINE', 'GHOST'], [stage('LOGLINE', 'v-log-1'), stage('GHOST', null, null)]);
  assert.deepEqual(s, { LOGLINE: 'v-log-1' });
});

test('duplicates and junk do not produce duplicate or malformed entries', () => {
  assert.deepEqual(consumedStamp(['LOGLINE', 'LOGLINE', '', null as any], STAGES), { LOGLINE: 'v-log-1' });
  assert.deepEqual(consumedStamp([], STAGES), {});
  assert.deepEqual(consumedStamp(null as any, null as any), {});
});

test('hasConsumed gates the write, so an empty stamp is never stored', () => {
  assert.equal(hasConsumed({}), false);
  assert.equal(hasConsumed(null), false);
  assert.equal(hasConsumed({ LOGLINE: 'v1' }), true);
});
