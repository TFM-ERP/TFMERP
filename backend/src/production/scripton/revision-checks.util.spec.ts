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
  shouldRecheckPlanEnding, registerEntry, sceneOfQuote,
} from './revision-checks.util';
import { findFalseSceneBreaks, findEchoedPhrases } from './continuity.util';
import { loadCapture, missingCapture, captureText } from './capture-fixture.util';

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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// PLAN 01 TASK 1 STEP 7 — THE SHAPE ON A DRAFT IT WAS NOT MEASURED ON (standing rule 1).
//
// MINUTEMEN is the right second story on merit, not availability: it is the draft the density and
// echo thresholds were calibrated against, so its findings are known-positive. Skips BY NAME when
// the capture is absent — the screenplay stays out of the repo.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const MM = loadCapture('MM-script.json');

test('MINUTEMEN — density is FINDINGS with its real count, and every kind lands in a valid state',
  MM ? {} : { skip: missingCapture('MM-script.json') }, () => {
    const c = MM!;
    const text = captureText(c);
    const heads = c.sceneRows.map((s) => String(s.slugline || ''));
    // The scene rows carry no page weights (the column is null on this revision), so this asserts on
    // findFalseSceneBreaks, which keys on repeated headings and does not need them. findFragmentRuns
    // would be reading zeros and is deliberately not asserted here.
    const pages = c.sceneRows.map(() => 0);
    const fake = findFalseSceneBreaks(heads, pages);
    assert.equal(fake.length, 10, 'the figure the density threshold was calibrated against');

    const e = findingsEntry('density', fake, text);
    assert.equal(e.state, 'FINDINGS');
    assert.equal(e.items!.length, 10);
    assert.equal(e.countsAsFinding, true);
    assert.equal(e.subject, 'revision.pageText');
    assert.equal(e.sha256, fingerprint(text));
    // located, not just counted
    assert.ok(e.items!.every((i) => i.scene === null || i.scene > 0));
    assert.ok(e.items!.some((i) => /same heading/i.test(i.detail)));
  });

test('MINUTEMEN — echo is INFO on a real draft, and does not count as a finding',
  MM ? {} : { skip: missingCapture('MM-script.json') }, () => {
    const c = MM!;
    const echo = findEchoedPhrases(c.pageText);
    assert.equal(echo.length, 1, 'measured: one phrase this draft returns to');
    const e = findingsEntry('echo', echo, captureText(c));
    assert.equal(e.state, 'INFO');
    assert.equal(e.countsAsFinding, false);
    assert.equal(e.items!.length, 1);
  });

test('MINUTEMEN — every expected check produces a valid entry, and the Latin detectors are not blind',
  MM ? {} : { skip: missingCapture('MM-script.json') }, () => {
    const text = captureText(MM!);
    for (const k of EXPECTED_CHECKS) {
      const ran = findingsEntry(k, [], text);
      assert.ok(['FINDINGS', 'CLEAN', 'INFO', 'NOT_RUN'].indexOf(ran.state) >= 0, k);
      assert.notEqual(ran.state, 'NOT_RUN', k + ' reads blind on a Latin draft');
      const absent = findingsEntry(k, null, text);
      assert.equal(absent.state, 'NOT_RUN', k + ' must distinguish no-result from empty');
    }
  });

// ─────────────────────────────────────────────────────────────────────────────────────────────
// PLAN 01 TASK 3B — THE REPEAT PLAN-ENDING CHECK.
//
// Measured on 2 Oct, two scripton.feature.coverage calls six seconds apart, both at ceiling 400:
//
//   12:42:39.881Z  out 310  stop end_turn    196 chars  A USABLE VERDICT
//   12:42:45.868Z  out 400  stop max_tokens   33 chars  cut off — and THIS is the one that stored
//
// The full log carries exactly ONE "no usable verdict" line, at 4:42:52 PM, immediately followed by
// recordRevisionCheck: planEnding = NOT_RUN. So the first call answered and logged nothing (success
// on that path is silent) and the unconditional final check overwrote it with an abstention.
//
// The rule is narrow on purpose: skip the repeat ONLY after a TYPED verdict. An abstention has not
// answered, and re-asking it is the one case where a second call earns its $0.017.
// ─────────────────────────────────────────────────────────────────────────────────────────────

test('TASK 3B — a typed pass is not re-asked; an abstention is', () => {
  assert.equal(shouldRecheckPlanEnding({ complete: true, failOpen: false }, { repaired: 0 }), false);
  assert.equal(shouldRecheckPlanEnding({ complete: true }, { repaired: 0 }), false, 'absent failOpen is a typed pass');
  assert.equal(shouldRecheckPlanEnding({ complete: true, failOpen: true }, { repaired: 0 }), true,
    'an abstention has not answered — it is the one case worth asking twice');
});

test('TASK 3B — a repair means the plan changed, so the verdict must be re-taken', () => {
  assert.equal(shouldRecheckPlanEnding({ complete: true, failOpen: false }, { repaired: 1 }), true,
    'a typed pass on a plan that has since been repaired is a verdict about different scenes');
  assert.equal(shouldRecheckPlanEnding({ complete: false, failOpen: false }, { repaired: 1 }), true);
});

test('TASK 3B — no verdict at all is always re-asked', () => {
  assert.equal(shouldRecheckPlanEnding(null, { repaired: 0 }), true);
  assert.equal(shouldRecheckPlanEnding(undefined, { repaired: 0 }), true);
  assert.equal(shouldRecheckPlanEnding({}, { repaired: 0 }), true, 'neither complete nor incomplete');
  assert.equal(shouldRecheckPlanEnding({ complete: false }, { repaired: 0 }), true);
});

test('TASK 3B — CONTROL: skipping on any complete:true makes an abstention permanent', () => {
  const naive = (v: any) => !v.complete;
  assert.equal(naive({ complete: true, failOpen: true }), false, 'the defect: never asks again');
  assert.equal(shouldRecheckPlanEnding({ complete: true, failOpen: true }, { repaired: 0 }), true);
});

test('TASK 3B — CONTROL: always re-asking is what destroyed the good answer', () => {
  // the 2 Oct sequence: a typed pass, then an unconditional repeat that was cut off
  const typed = { complete: true, failOpen: false };
  assert.equal(shouldRecheckPlanEnding(typed, { repaired: 0 }), false,
    'the repeat that overwrote a usable verdict no longer happens');
});

test('TASK 3B — a ceiling stop is its own NOT_RUN reason, not the generic one', () => {
  const e = endingEntry('planEnding', {
    complete: true, failOpen: true,
    note: 'the plan-ending check was cut off at its 400-token ceiling',
  }, 'tail', 'plan.tail');
  assert.equal(e.state, 'NOT_RUN');
  assert.match(e.reason, /cut off at its 400-token ceiling/);
  assert.equal(/no usable verdict/.test(e.reason), false,
    'the measured run stored the generic reason, so the cause was unreadable from the row');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// PLAN 01 TASK 6 — THE REGISTER CHECK AGAINST THE FINISHED SCRIPT.
//
// The check that found the Cape Breton contradiction in STEP_OUTLINE step 13 on 20 Sep — the
// finding 79 scenes were then written on top of — has never been pointed at the finished script,
// which is where a contradiction finally lands on a page.
//
// A register ITEM is { line, section, rule, draft, why } and `line` is a REGISTER line number, not
// a script line and not a scene. The only thing locating it on the page is `draft`, an exact quote.
// So the scene must be FOUND, and null when the quote is not there.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const SCRIPT_WITH_QUOTE = [
  'FADE IN:', '', '1  INT. WARD - DAY', '', 'A chart on the wall.', '',
  '2  EXT. HARBOUR - DAY', '', 'He admitted it in Boston, not here.', '', 'FADE OUT.',
].join('\n');

const REG_ITEM = {
  line: 39, section: 'document', rule: 'Thomas is admitted in Boston.',
  draft: 'He admitted it in Boston, not here.', why: 'The draft places the admission in Cape Breton.',
};

test('TASK 6 — a register item becomes {scene, kind, detail} by locating its quote', () => {
  const e = findingsEntry('register', [REG_ITEM], SCRIPT_WITH_QUOTE);
  assert.equal(e.state, 'FINDINGS');
  assert.equal(e.items!.length, 1);
  assert.equal(e.items![0].kind, 'REGISTER');
  assert.equal(e.items![0].scene, 2, 'the scene whose text contains item.draft');
  assert.match(e.items![0].detail, /register line 39/);
  assert.match(e.items![0].detail, /Cape Breton/, 'the why — not the line number alone');
  assert.match(e.items![0].detail, /Boston/, 'and the rule it contradicts');
});

test('TASK 6 — a quote that is not on the page is scene null, never guessed', () => {
  const e = findingsEntry('register', [REG_ITEM], 'FADE IN:\n\n1  INT. ROOM - DAY\n\nNothing matching.\n');
  assert.equal(e.items![0].scene, null);
  assert.match(e.items![0].detail, /register line 39/, 'the finding survives losing its location');
});

test('TASK 6 — CONTROL: guessing scene 1 sends the reader to the wrong page', () => {
  const e = findingsEntry('register', [REG_ITEM], 'FADE IN:\n\n1  INT. ROOM - DAY\n\nNothing matching.\n');
  assert.notEqual(e.items![0].scene, 1);
  assert.equal(e.items![0].scene, null);
});

test('TASK 6 — the error shape is NOT_RUN; zero items with a verdict is CLEAN', () => {
  const errored = { ok: false, checked: 105, contradicted: null, rate: null, items: [], error: 'timeout' };
  const zero = { ok: true, checked: 105, contradicted: 0, rate: 0, items: [] };
  assert.equal(registerEntry(errored, SCRIPT_WITH_QUOTE).state, 'NOT_RUN');
  assert.match(registerEntry(errored, SCRIPT_WITH_QUOTE).reason, /timeout/);
  assert.equal(registerEntry(zero, SCRIPT_WITH_QUOTE).state, 'CLEAN');
  assert.match(registerEntry(zero, SCRIPT_WITH_QUOTE).reason, /105/);
});

test('TASK 6 — CONTROL: the error shape read loosely becomes a pass', () => {
  const errored = { ok: false, checked: 105, contradicted: null, rate: null, items: [] };
  const lenient = (v: any) => (v.items.length ? 'FINDINGS' : 'CLEAN');
  assert.equal(lenient(errored), 'CLEAN',
    'ok:false / contradicted:null is byte-identical to a clean result but for those fields');
  assert.equal(registerEntry(errored, SCRIPT_WITH_QUOTE).state, 'NOT_RUN');
});

test('TASK 6 — NO BIBLE: zero register lines stores NOT_RUN "no bible", not nothing and not CLEAN', () => {
  const e = registerEntry(null, SCRIPT_WITH_QUOTE, { lines: 0 });
  assert.equal(e.state, 'NOT_RUN');
  assert.match(e.reason, /no bible/);
  assert.match(e.reason, /no register lines to check against/);
  assert.equal(e.countsAsFinding, false);
  assert.equal(e.subject, 'revision.pageText');
});

test('TASK 6 — CONTROL: no bible must not read as clean, and must not be absent', () => {
  const e = registerEntry(null, SCRIPT_WITH_QUOTE, { lines: 0 });
  assert.notEqual(e.state, 'CLEAN');
  assert.notEqual(e, null, 'a guard that skips the call must still leave a row behind');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// TASK 6 FIX — sceneOfQuote MUST READ THE PRINTED SCENE NUMBER, NOT COUNT HEADINGS.
//
// Measured on JQ2-FINAL-script.json: 85 slug lines, 81 of them numbered 1..81 (the plan had 81),
// and FOUR unnumbered "- CONTINUOUS" sub-headings. Counting all 85 inflates every answer by the
// number of CONTINUOUS headings above it, which is also why 85 ScriptScene rows came out of an
// 81-scene plan.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const JQ2 = loadCapture('JQ2-FINAL-script.json');
const jq2Text = (): string => {
  const pt: any = (JQ2 as any).pageText;
  return pt.map((p: any) => String((p && p.text) || '')).join('\n');
};

test('TASK 6 FIX — the printed scene number wins over the heading count',
  JQ2 ? {} : { skip: missingCapture('JQ2-FINAL-script.json') }, () => {
    const t = jq2Text();
    // counted / printed, measured on this capture before the fix: 45/41, 27/25, 80/76
    assert.equal(sceneOfQuote(t, "Dad would've buried it"), 41);
    assert.equal(sceneOfQuote(t, 'Have you tried the lamb?'), 25);
    assert.equal(sceneOfQuote(t, 'What day is it.'), 76);
  });

test('TASK 6 FIX — CONTROL: counting headings is wrong by the CONTINUOUS sub-headings above',
  JQ2 ? {} : { skip: missingCapture('JQ2-FINAL-script.json') }, () => {
    const t = jq2Text();
    for (const [q, counted] of [["Dad would've buried it", 45], ['Have you tried the lamb?', 27], ['What day is it.', 80]] as Array<[string, number]>) {
      assert.notEqual(sceneOfQuote(t, q), counted, 'the count must not be the answer for ' + q);
    }
  });

test('TASK 6 FIX — an unnumbered sub-heading belongs to the scene above', () => {
  const t = [
    '41  INT. KITCHEN - NIGHT', '', 'He opens the drawer.', '',
    'EXT. DOCK ROAD - CONTINUOUS', '', "Dad would've buried it in the yard.", '',
    '42  INT. CAR - DAY', '', 'She drives.',
  ].join('\n');
  assert.equal(sceneOfQuote(t, "Dad would've buried it"), 41, 'not 42, and not a count');
  assert.equal(sceneOfQuote(t, 'She drives'), 42);
  assert.equal(sceneOfQuote(t, 'He opens the drawer'), 41);
});

test('TASK 6 FIX — a script that prints NO numbers falls back to counting', () => {
  const t = [
    'INT. KITCHEN - NIGHT', '', 'He opens the drawer.', '',
    'INT. CAR - DAY', '', 'She drives.', '',
    'EXT. ROAD - DAY', '', 'The car turns.',
  ].join('\n');
  assert.equal(sceneOfQuote(t, 'He opens the drawer'), 1);
  assert.equal(sceneOfQuote(t, 'She drives'), 2);
  assert.equal(sceneOfQuote(t, 'The car turns'), 3);
});

test('TASK 6 FIX — a quote above the first numbered heading cannot be placed', () => {
  const t = ['FADE IN:', '', 'A title card.', '', '1  INT. ROOM - DAY', '', 'He waits.'].join('\n');
  assert.equal(sceneOfQuote(t, 'A title card'), null, 'before any scene — null, not 0 and not 1');
  assert.equal(sceneOfQuote(t, 'He waits'), 1);
});

test('TASK 6 FIX — a suffixed number reads as its scene', () => {
  const t = ['12A  INT. HALL - DAY', '', 'The door is ajar.'].join('\n');
  assert.equal(sceneOfQuote(t, 'The door is ajar'), 12);
});

test('TASK 6 FIX — empty script text says "no script text", not "no bible"', () => {
  const e = registerEntry(null, '', { lines: 105 });
  assert.equal(e.state, 'NOT_RUN');
  assert.match(e.reason, /no script text/);
  assert.equal(/no bible/.test(e.reason), false, 'there IS a bible — 105 register lines');
  // and the other way round still reads as no bible
  assert.match(registerEntry(null, 'FADE IN:', { lines: 0 }).reason, /no bible/);
});
