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
  EXPECTED_CHECKS, SUBJECT_OF, CAN_DETECT, LATIN_SHARE_FLOOR, latinShare, findingsEntry, sweepFailed,
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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// PLAN 01 TASK 1A — THE SHAPE: one EXPECTED_CHECKS, items on every entry, and a CLEAN that
// requires a detector which could have fired.
//
// House pattern holds: every rule below ships with the switch that falsifies it. The decisive
// tests are (a) [] and null are different facts, (b) an empty result from a blind detector is
// NOT_RUN and never CLEAN, and (c) echo can never render as a finding.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const AR = 'داس\n\nمشهد 3 - خارجي - سطح السفينة - نهار\n\nالقائد يقف فوق طاولة الخرائط.\n\nالشيخ محمد\nمن رأس الخيمة إلى أبوظبي.';
const EN = 'FADE IN:\n\nINT. CAPSULE - DAY\n\nMercer sets the pot down. Precisely.\n\nMERCER\nI am aware.';

test('TASK 1A — EXPECTED_CHECKS is the single list, planState is on it, fixedAttributes is not', () => {
  assert.deepEqual([...EXPECTED_CHECKS], [
    'ending', 'planEnding', 'planState',
    'nameDrift', 'ledger', 'writtenDeaths', 'clock', 'flashback', 'density', 'echo',
    'register',
  ]);
  assert.equal(EXPECTED_CHECKS.includes('fixedAttributes' as any), false,
    '5 of 5 false on the only measured run; re-adding it needs a fixture showing a true positive');
});

test('TASK 1A — every expected check declares the subject its sha is taken over', () => {
  assert.equal(SUBJECT_OF.ending, 'revision.pageText');
  assert.equal(SUBJECT_OF.planEnding, 'plan.tail', 'verifyPlanEnding judges the plan tail, not the page');
  assert.equal(SUBJECT_OF.planState, 'plan');
  assert.equal(SUBJECT_OF.register, 'revision.pageText');
  for (const k of EXPECTED_CHECKS) assert.ok(SUBJECT_OF[k], k + ' has no subject');
});

test('TASK 1A — findings carry structured items: scene, kind, detail', () => {
  const found = [
    { kind: 'REDISCOVERY', entityId: 'WARD', scenes: [12, 40], detail: 'WARD already learned this in scene 12.' },
    { kind: 'SPEAKS_AFTER_EXIT', sceneIndex: 57, heading: 'INT. HALL', names: ['CALLUM'], detail: 'CALLUM speaks after leaving.' },
  ];
  const e = findingsEntry('ledger', found, TEXT);
  assert.equal(e.state, 'FINDINGS');
  assert.equal(e.items!.length, 2);
  assert.deepEqual(Object.keys(e.items![0]).sort(), ['detail', 'kind', 'scene']);
  assert.equal(e.items![0].scene, 40, 'the LATER scene — where it goes wrong, not where it started');
  assert.equal(e.items![1].scene, 58, 'sceneIndex is 0-based; the item is 1-based');
  assert.ok(e.items!.some((i) => /WARD already learned/.test(i.detail)),
    'the detail line the log keyword filter dropped');
  assert.equal(/WARD already learned/.test(e.reason), false, 'the body is not packed into the sentence');
  assert.equal(e.sha256, fingerprint(TEXT));
  assert.equal(e.subject, 'revision.pageText');
  assert.equal(e.countsAsFinding, true);
});

test('TASK 1A — a finding that cannot be placed is scene null, not 0 and not omitted', () => {
  const e = findingsEntry('clock', [{ detail: 'the story clock runs backwards' }], TEXT);
  assert.equal(e.items!.length, 1);
  assert.equal(e.items![0].scene, null);
  assert.equal('scene' in e.items![0], true);
});

test('TASK 1A — a written death composes a detail, because it has none of its own', () => {
  const e = findingsEntry('writtenDeaths', [{ name: 'KANE', sceneIndex: 115, how: 'shot', evidence: 'Kane drops.' }], TEXT);
  assert.equal(e.state, 'FINDINGS');
  assert.equal(e.items![0].scene, 116);
  assert.match(e.items![0].detail, /KANE/);
  assert.match(e.items![0].detail, /Kane drops\./, 'the evidence is the part a person can weigh');
});

test('TASK 1A — [] from a sweep that RAN is CLEAN; null is NOT_RUN', () => {
  assert.equal(findingsEntry('flashback', [], EN).state, 'CLEAN');
  assert.equal(findingsEntry('flashback', null, EN).state, 'NOT_RUN');
  assert.match(findingsEntry('flashback', null, EN).reason, /did not run/);
  assert.equal(findingsEntry('flashback', undefined, EN).state, 'NOT_RUN');
});

test('TASK 1A — CONTROL: the lenient read makes a sweep that never ran look clean', () => {
  const lenient = (f: any) => ((f || []).length ? 'FINDINGS' : 'CLEAN');
  assert.equal(lenient(null), 'CLEAN', 'the defect this shape exists to end');
  assert.equal(findingsEntry('flashback', null, EN).state, 'NOT_RUN');
});

test('TASK 1A — an empty result from a detector that could not fire is NOT_RUN, never CLEAN', () => {
  assert.equal(findingsEntry('nameDrift', [], EN).state, 'CLEAN');
  const arabic = findingsEntry('nameDrift', [], AR);
  assert.equal(arabic.state, 'NOT_RUN');
  assert.match(arabic.reason, /cannot read names in this script/);
  assert.equal(arabic.countsAsFinding, false);
});

test('TASK 1A — CONTROL: without canDetect an Arabic draft reports clean sweeps', () => {
  const lenient = (f: any) => ((f || []).length ? 'FINDINGS' : 'CLEAN');
  assert.equal(lenient([]), 'CLEAN', 'the false all-clear');
  for (const k of ['nameDrift', 'ledger', 'writtenDeaths', 'clock', 'flashback']) {
    assert.equal(findingsEntry(k, [], AR).state, 'NOT_RUN', k + ' reported CLEAN on Arabic');
  }
});

test('TASK 1A — the detectors declare their own reach', () => {
  for (const k of ['nameDrift', 'ledger', 'writtenDeaths', 'clock', 'flashback']) {
    assert.equal(CAN_DETECT[k](AR), false, k + ' claims it can read Arabic');
    assert.equal(CAN_DETECT[k](EN), true, k + ' cannot read English');
  }
  for (const k of ['density', 'echo']) {
    assert.equal(CAN_DETECT[k](AR), true, k + ' should read any script');
    assert.equal(CAN_DETECT[k](EN), true);
  }
});

test('TASK 1A — the decision is a SHARE of letters, not the presence of a character', () => {
  assert.equal(LATIN_SHARE_FLOOR, 0.5);
  assert.equal(latinShare(EN), 1);
  assert.ok(latinShare(AR) < 0.05, 'measured on the real fixture: 1.6%');
});

test('TASK 1A — MIXED: an English page with one Arabic line stays readable', () => {
  const page = EN + '\nالشيخ محمد يقف عند الباب.\n';
  assert.ok(latinShare(page) > LATIN_SHARE_FLOOR);
  assert.equal(CAN_DETECT.nameDrift(page), true, 'one Arabic line must not blind the name check');
});

test('TASK 1A — MIXED: an Arabic page with a few Latin words does not become readable', () => {
  const page = AR + "\n(CONT'D)  INT. HARBOUR - DAY  SUPER: 1761\n";
  assert.ok(latinShare(page) < LATIN_SHARE_FLOOR);
  assert.equal(CAN_DETECT.nameDrift(page), false, 'that Latin is stage furniture, not names');
});

test('TASK 1A — CONTROL: presence-based detection gets both mixed cases wrong', () => {
  // A real Arabic screenplay is not pure Arabic. The measured 164-page fixture carries 2,404 Latin
  // letters — (CONT'D), SUPER:, transliterated names — at 1.6% of all its letters, so a presence
  // test on Latin passes it as readable. This control uses that realistic shape, not pure Arabic.
  const AR_REAL = AR + "\n(CONT'D)  SUPER: 1761\n";
  assert.ok(latinShare(AR_REAL) < LATIN_SHARE_FLOOR, 'still an Arabic script by share');

  const byArabicPresence = (t: string) => !/[؀-ۿ]/.test(t);
  assert.equal(byArabicPresence(EN + '\nالشيخ محمد يقف.'), false,
    'presence of Arabic would blind the name check on an English page');

  const byLatinPresence = (t: string) => /\p{Script=Latin}/u.test(t);
  assert.equal(byLatinPresence(AR_REAL), true,
    'presence of Latin would call this Arabic script readable');

  assert.equal(CAN_DETECT.nameDrift(AR_REAL), false, 'the share rule gets both right');
});

test('TASK 1A — echo is INFO: stored with its items, never FINDINGS, never counted', () => {
  const e = findingsEntry('echo', [{ phrase: "Doesn't look up.", scenes: [7, 19, 44], detail: '"Doesn\'t look up." in 3 scenes' }], EN);
  assert.equal(e.state, 'INFO');
  assert.equal(e.items!.length, 1);
  // 1C applies to echo too: the anchor is the most recent return, not the first. Every scene in the
  // span is in the detail either way.
  assert.equal(e.items![0].scene, 44);
  assert.equal(e.countsAsFinding, false);
  assert.notEqual(e.state as string, 'FINDINGS');
});

test('TASK 1A — echo that found nothing is still INFO, never a verdict', () => {
  assert.equal(findingsEntry('echo', [], EN).state, 'INFO');
});

test('TASK 1A — CONTROL: echo as FINDINGS makes every motif a defect', () => {
  const asFindings = (items: any[]) => (items.length ? 'FINDINGS' : 'CLEAN');
  assert.equal(asFindings([{ phrase: 'x' }]), 'FINDINGS', 'the defect');
  assert.notEqual(findingsEntry('echo', [{ phrase: 'x', scenes: [1], detail: 'x' }], EN).state, 'FINDINGS');
});

test('TASK 1A — a thrown sweep is NOT_RUN with the thrown reason', () => {
  const e = sweepFailed('ledger', new Error('audit skipped — boom'), TEXT);
  assert.equal(e.state, 'NOT_RUN');
  assert.match(e.reason, /boom/);
  assert.equal(e.countsAsFinding, false);
});

test('TASK 1A — an INFO entry survives a round trip through the reader', () => {
  const e = findingsEntry('echo', [{ phrase: 'x', scenes: [3], detail: 'x in 1 scene' }], EN);
  const back = readCheckEntry(e, EN)!;
  assert.equal(back.display, 'INFO', 'INFO must not degrade to NOT_RUN on read');
  assert.equal(back.stale, false);
});

test('TASK 1A — items survive mergeChecks beside the existing kinds', () => {
  const ending = endingEntry('ending', { complete: true, note: 'reached' }, TEXT);
  const ledger = findingsEntry('ledger', [{ kind: 'X', scenes: [2], detail: 'd' }], TEXT);
  const blob = mergeChecks(mergeChecks(null, ending), ledger);
  assert.deepEqual(Object.keys(blob).sort(), ['ending', 'ledger']);
  assert.equal((blob as any).ledger.items.length, 1);
  assert.equal((blob as any).ending.state, 'CLEAN');
});

// ── 1C — WHERE A MULTI-SCENE FINDING POINTS ──────────────────────────────────────────────────

test('TASK 1C — a finding spanning two scenes points at the LATER one', () => {
  // REDISCOVERY scenes [12, 40] reads "WARD already learned this in scene 12". Scene 12 is where
  // the knowledge was legitimately acquired; scene 40 is the page that is wrong. A reader sent to
  // 12 finds nothing to fix there.
  const e = findingsEntry('ledger', [{ kind: 'REDISCOVERY', scenes: [12, 40], detail: 'WARD already learned this in scene 12.' }], TEXT);
  assert.equal(e.items![0].scene, 40);
});

test('TASK 1C — the later scene, not the last element: the array need not be sorted', () => {
  const e = findingsEntry('ledger', [{ kind: 'REDISCOVERY', scenes: [40, 12], detail: 'd' }], TEXT);
  assert.equal(e.items![0].scene, 40, 'max, not scenes[scenes.length - 1]');
});

test('TASK 1C — one scene still points at itself, and junk still yields null', () => {
  assert.equal(findingsEntry('ledger', [{ kind: 'X', scenes: [7], detail: 'd' }], TEXT).items![0].scene, 7);
  assert.equal(findingsEntry('ledger', [{ kind: 'X', scenes: [], detail: 'd' }], TEXT).items![0].scene, null);
  assert.equal(findingsEntry('ledger', [{ kind: 'X', scenes: ['a', null], detail: 'd' }], TEXT).items![0].scene, null);
});

test('TASK 1C — CONTROL: scenes[0] sends the reader to the scene that is fine', () => {
  const f = { kind: 'REDISCOVERY', scenes: [12, 40], detail: 'd' };
  assert.equal(f.scenes[0], 12, 'the old rule');
  assert.equal(findingsEntry('ledger', [f], TEXT).items![0].scene, 40, 'the rule now');
});

test('TASK 1C — a null location is null, not scene 1: Number(null) is 0 and 0 + 1 is a lie', () => {
  assert.equal(findingsEntry('flashback', [{ sceneIndex: null, kind: 'X', detail: 'd' }], TEXT).items![0].scene, null);
  assert.equal(findingsEntry('flashback', [{ sceneIndex: undefined, kind: 'X', detail: 'd' }], TEXT).items![0].scene, null);
  assert.equal(findingsEntry('flashback', [{ sceneIndex: '', kind: 'X', detail: 'd' }], TEXT).items![0].scene, null);
  assert.equal(findingsEntry('flashback', [{ sceneIndex: true, kind: 'X', detail: 'd' }], TEXT).items![0].scene, null);
  assert.equal(findingsEntry('flashback', [{ sceneIndex: 0, kind: 'X', detail: 'd' }], TEXT).items![0].scene, 1,
    'a REAL index 0 is scene 1 — that one is not a lie');
});

test('TASK 1C — CONTROL: a bare Number() cast invents a location', () => {
  assert.equal(Number(null), 0, 'the defect');
  assert.equal(Number(''), 0);
  assert.equal(Number(true), 1);
  assert.equal(findingsEntry('flashback', [{ sceneIndex: null, kind: 'X', detail: 'd' }], TEXT).items![0].scene, null);
});
