/**
 * F10's acceptance at the unit, with controls that can fail.
 *
 * House pattern: a presence assertion ships with the switch that falsifies it. The decisive tests
 * here are (1) an abstention must not read as a pass, and (3) a verdict must not survive the text
 * it judged.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  fingerprint, checkEntry, endingEntry, mergeChecks, readCheckEntry, readChecks, resolveSecondLook,
} from './revision-checks.util';

const TEXT = 'FADE IN:\n\nEXT. PIER - NIGHT\n\nHe files the shaft true.\n\nFADE OUT.';

test('ACCEPTANCE 1 — a stubbed fail-open is stored as NOT_RUN, never complete/CLEAN', () => {
  const e = endingEntry('ending', { complete: true, failOpen: true, note: 'no usable verdict — assuming the plan reaches the ending' }, TEXT);
  assert.equal(e.state, 'NOT_RUN');
  assert.notEqual(e.state as string, 'CLEAN');
  assert.match(e.reason, /no usable verdict/);
});

test('NEGATIVE CONTROL for 1 — without the failOpen flag the SAME verdict reads CLEAN', () => {
  const honest = endingEntry('ending', { complete: true, note: 'the ending was reached' }, TEXT);
  assert.equal(honest.state, 'CLEAN');
  const abstained = endingEntry('ending', { complete: true, failOpen: true, note: 'no usable verdict' }, TEXT);
  assert.notEqual(honest.state, abstained.state, 'a pass and an abstention must not produce the same state');
});

test('a NOT_RUN entry can never be reasonless', () => {
  assert.match(checkEntry('ending', 'NOT_RUN', '', TEXT).reason, /no reason was recorded/);
  assert.match(endingEntry('ending', { failOpen: true, note: '' }, TEXT).reason, /fail-open/);
  assert.match(endingEntry('ending', {}, TEXT).reason, /neither complete nor incomplete/);
});

test('ACCEPTANCE 2 — a clean verdict is CLEAN and its fingerprint matches the text judged', () => {
  const e = endingEntry('ending', { complete: true, note: 'reached' }, TEXT);
  assert.equal(e.state, 'CLEAN');
  assert.equal(e.sha256, fingerprint(TEXT));
  assert.equal(e.subject, 'revision.pageText');
  const read = readCheckEntry(e, TEXT)!;
  assert.equal(read.stale, false);
  assert.equal(read.display, 'CLEAN');
});

test('ACCEPTANCE 3 — NEGATIVE CONTROL: change the text after the check and the reader says STALE', () => {
  const e = endingEntry('ending', { complete: true, note: 'reached' }, TEXT);
  const before = readCheckEntry(e, TEXT)!;
  assert.equal(before.display, 'CLEAN');

  const repaired = TEXT.replace('files the shaft true', 'يبرد العمود');   // dialectRepairDoc, in place
  const after = readCheckEntry(e, repaired)!;
  assert.equal(after.stale, true);
  assert.equal(after.display, 'STALE', 'a verdict that outlived its text must not still read CLEAN');
  assert.equal(after.state, 'CLEAN', 'the STORED state is untouched; only the display changes');
});

test('an incomplete verdict is FINDINGS, and staleness outranks it too', () => {
  const e = endingEntry('ending', { complete: false, note: 'never dramatises the climax' }, TEXT);
  assert.equal(e.state, 'FINDINGS');
  assert.equal(readCheckEntry(e, TEXT)!.display, 'FINDINGS');
  assert.equal(readCheckEntry(e, TEXT + ' more')!.display, 'STALE');
});

test('a plan-tail verdict is never staleness-checked against pageText', () => {
  const e = endingEntry('planEnding', { complete: true, note: 'plan reaches the ending' }, 'the plan tail', 'plan.tail');
  assert.equal(e.subject, 'plan.tail');
  const read = readCheckEntry(e, TEXT)!;   // completely different text
  assert.equal(read.stale, false, 'comparing a plan fingerprint to pageText would report STALE forever');
  assert.equal(read.display, 'CLEAN');
});

test('merging keeps other kinds intact and replaces its own', () => {
  const a = endingEntry('ending', { complete: true }, TEXT);
  const b = endingEntry('planEnding', { complete: true }, 'plan', 'plan.tail');
  const merged = mergeChecks(mergeChecks(null, a), b);
  assert.deepEqual(Object.keys(merged).sort(), ['ending', 'planEnding']);
  const replaced = mergeChecks(merged, endingEntry('ending', { complete: false, note: 'second look' }, TEXT));
  assert.equal(replaced.ending.state, 'FINDINGS');
  assert.equal(replaced.planEnding.state, 'CLEAN', 'the other kind must survive the merge');
});

test('readChecks reads a whole blob, and junk degrades to NOT_RUN rather than to a pass', () => {
  const blob = { ending: endingEntry('ending', { complete: true }, TEXT), junk: { state: 'TOTALLY_FINE' } };
  const reads = readChecks(blob, TEXT);
  assert.equal(reads.length, 2);
  assert.equal(reads.find((r) => r.kind === 'junk')!.state, 'NOT_RUN', 'an unrecognised state is not a pass');
  assert.deepEqual(readChecks(null, TEXT), []);
  assert.deepEqual(readChecks([1, 2], TEXT), []);
});

test('fingerprint is stable, and distinguishes texts', () => {
  assert.equal(fingerprint(TEXT), fingerprint(TEXT));
  assert.notEqual(fingerprint(TEXT), fingerprint(TEXT + '\n'));
  assert.equal(fingerprint(null), fingerprint(''));
  assert.match(fingerprint(TEXT), /^[0-9a-f]{64}$/);
});


// ── THE SECOND LOOK: only a REAL pass may overturn a real failure ────────────────────────────

const REAL_FAIL = { complete: false, note: 'never dramatises the outlined climax', missing: ['climax'] };
const REAL_PASS = { complete: true, note: 'the resolution is on the page' };
const ABSTENTION = { complete: true, note: 'no usable verdict returned by the ending check', failOpen: true };

test('SECOND LOOK — a real pass overturns a real failure (the rescue this exists for)', () => {
  const r = resolveSecondLook(REAL_FAIL, REAL_PASS);
  assert.equal(r.complete, true);
  assert.equal(r.failOpen, undefined);
  assert.match(r.note, /resolution is on the page/);
});

test('SECOND LOOK — an ABSTENTION may NOT overturn a real failure', () => {
  const r = resolveSecondLook(REAL_FAIL, ABSTENTION);
  assert.equal(r.complete, false, 'a check that failed to look must not rescue a short script');
  assert.equal(r.failOpen, false);
  assert.match(r.note, /never dramatises/, 'the note kept is the REAL verdict\'s, not the abstention\'s');
  assert.doesNotMatch(r.note, /no usable verdict/);
});

test('NEGATIVE CONTROL — the OLD rule would have let the abstention through', () => {
  // The line this replaces: cov = wider.complete ? wider : {...}
  const old = (first: any, wider: any) => (wider.complete ? wider : { complete: false, note: wider.note || first.note });
  assert.equal(old(REAL_FAIL, ABSTENTION).complete, true, 'the old rule files it DONE');
  assert.equal(resolveSecondLook(REAL_FAIL, ABSTENTION).complete, false, 'the new rule does not');
  assert.notEqual(old(REAL_FAIL, ABSTENTION).complete, resolveSecondLook(REAL_FAIL, ABSTENTION).complete);
});

test('SECOND LOOK — two real failures stay a failure, keeping the wider note', () => {
  const r = resolveSecondLook(REAL_FAIL, { complete: false, note: 'the wider read agrees' });
  assert.equal(r.complete, false);
  assert.match(r.note, /wider read agrees/);
});

test('SECOND LOOK — a first-read pass needs no second look and is returned untouched', () => {
  assert.equal(resolveSecondLook(REAL_PASS, ABSTENTION).complete, true);
  assert.equal(resolveSecondLook(REAL_PASS, REAL_FAIL).complete, true);
});

test('SECOND LOOK — the verdict it returns records as the right state', () => {
  assert.equal(endingEntry('ending', resolveSecondLook(REAL_FAIL, ABSTENTION), 'T').state, 'FINDINGS');
  assert.equal(endingEntry('ending', resolveSecondLook(REAL_FAIL, REAL_PASS), 'T').state, 'CLEAN');
});

test('SECOND LOOK — null/garbage inputs do not produce a pass', () => {
  assert.equal(resolveSecondLook(null, null).complete, false);
  assert.equal(resolveSecondLook(REAL_FAIL, null).complete, false);
  assert.deepEqual(resolveSecondLook(REAL_FAIL, ABSTENTION).missing, ['climax']);
});
