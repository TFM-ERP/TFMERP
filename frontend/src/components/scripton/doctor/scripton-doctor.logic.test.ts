import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scorecardTiles, verdictBanner, sceneFlowBars, arcPoints, diagRows, letterFromScore, TRANSFORM_TILES,
  tint, SX_HEX, CHECK_STATE, checkRowView, checkSummaryLine,
  isRevisionReady, solidColor,
} from './scripton-doctor.logic.ts';

test('scorecardTiles always returns the 5 fixed categories', () => {
  const tiles = scorecardTiles({ plot: 'GOOD', characters: 'EXCELLENT', dialogue: 'FAIR', structure: 'POOR' });
  assert.deepEqual(tiles.map((t) => t.label), ['Plot', 'Characters', 'Dialogue', 'Structure', 'Market']);
  assert.equal(tiles[0].grade, 'B');                 // GOOD
  assert.equal(tiles[1].grade, 'A');                 // EXCELLENT
  assert.equal(tiles[3].grade, 'D');                 // POOR
  assert.equal(tiles[4].grade, '—');                 // missing marketability -> neutral
  assert.equal(tiles[4].color, 'var(--faint)');
});

test('letterFromScore maps 0–10 to a letter chip', () => {
  assert.equal(letterFromScore(9), 'A');
  assert.equal(letterFromScore(7.6), 'B+');
  assert.equal(letterFromScore(6.2), 'B-');
  assert.equal(letterFromScore(0), '—');
});

test('verdictBanner degrades to neutral when there is no coverage', () => {
  const v = verdictBanner(null);
  assert.equal(v.hasData, false);
  assert.equal(v.grade, '—');
  assert.equal(v.rec, '');
  assert.deepEqual(v.comps, []);
});

test('verdictBanner builds grade/rec/logline/comps from a coverage report', () => {
  const v = verdictBanner({ recommendation: 'consider', scores: { overall: 7.6 }, logline: 'One night to move a witness.', comps: [{ title: 'Collateral' }, 'Drive'] });
  assert.equal(v.hasData, true);
  assert.equal(v.grade, 'B+');
  assert.equal(v.rec, 'CONSIDER');
  assert.equal(v.recColor, 'var(--amber)');
  assert.equal(v.logline, 'One night to move a witness.');
  assert.deepEqual(v.comps, ['Collateral', 'Drive']);
});

test('sceneFlowBars normalises to the peak and colors by health', () => {
  const bars = sceneFlowBars([10, 5, 1]);
  assert.equal(bars.length, 3);
  assert.equal(bars[0].pct, 100);
  assert.equal(bars[0].color, 'var(--green)');       // peak
  assert.equal(bars[2].color, 'var(--red)');         // low
  assert.deepEqual(sceneFlowBars(null), []);         // no data -> empty (no broken widget)
  assert.deepEqual(sceneFlowBars([]), []);
});

test('arcPoints returns an SVG polyline string or empty when too few points', () => {
  const pts = arcPoints([1, 2, 3], 220, 40);
  assert.match(pts, /^0\.0,/);                       // first x at 0
  assert.equal(pts.split(' ').length, 3);
  assert.equal(arcPoints([1], 220, 40), '');         // <2 points -> empty
  assert.equal(arcPoints(null), '');
});

test('diagRows map verdict to a KEEP/CONSIDER/CUT tag + color', () => {
  const rows = diagRows([
    { sceneNumber: '65', slugline: 'EXT. CLIFF', verdict: 'KEEP', objective: 'climb', obstacle: 'fear' },
    { sceneNumber: '12', verdict: 'cut' },
  ]);
  assert.equal(rows[0].scene, 'S65');
  assert.equal(rows[0].note, 'climb · fear');
  assert.equal(rows[0].tag, 'KEEP');
  assert.equal(rows[0].tagColor, 'var(--green)');
  assert.equal(rows[1].tag, 'CUT');
  assert.equal(rows[1].tagColor, 'var(--red)');
  assert.deepEqual(diagRows(null), []);
});

test('TRANSFORM_TILES is the 2×4 grid wired to actions', () => {
  assert.equal(TRANSFORM_TILES.length, 8);
  assert.deepEqual(TRANSFORM_TILES.map((t) => t.name), [
    'Tighten', 'Punch-up', 'Genre transpose', 'Re-engineer ending',
    'Budget-fit', 'Emotion re-key', 'Humour injection', 'Add / remove character',
  ]);
  assert.equal(TRANSFORM_TILES.find((t) => t.key === 'budgetfit')!.action, 'budgetfit');
  assert.equal(TRANSFORM_TILES.find((t) => t.key === 'genre')!.action, 'format');
});

// ── PLAN 01 TASK 7 — the check rows and the summary line ────────────────────────────────────

test('tint produces a VALID colour, which var() concatenation does not', () => {
  assert.equal(tint('var(--red)'), '#e5635f29');
  assert.equal(tint('var(--green)'), '#57b36829');
  assert.equal(tint('#e5635f'), '#e5635f29');
  // the bug this replaces: a custom property cannot be concatenated into a colour
  assert.equal('var(--red)' + '29', 'var(--red)29');
  assert.notEqual(tint('var(--red)'), 'var(--red)29');
  // and anything unrecognised is still a colour, not an invisible tag
  assert.equal(tint('nonsense'), 'rgba(255,255,255,.06)');
  assert.equal(tint(''), 'rgba(255,255,255,.06)');
});

test('every tint is syntactically a colour', () => {
  const ok = (v: string) => /^#[0-9a-fA-F]{8}$/.test(v) || /^rgba\([\d.,\s]+\)$/.test(v);
  for (const k of Object.keys(SX_HEX)) assert.ok(ok(tint(k)), k + ' -> ' + tint(k));
  for (const s of Object.values(CHECK_STATE)) assert.ok(ok(tint(s.color)), s.color);
});

test('the six states are distinguished IN WORDS, not only in colour', () => {
  const words = Object.values(CHECK_STATE).map((s) => s.word);
  assert.equal(words.length, 6);
  assert.equal(new Set(words).size, 6, 'no two states may read the same');
  // the two amber states share a colour, so the words are the only thing separating them
  assert.equal(CHECK_STATE.NOT_RUN.color, CHECK_STATE.STALE.color);
  assert.notEqual(CHECK_STATE.NOT_RUN.word, CHECK_STATE.STALE.word);
  assert.match(CHECK_STATE.NOT_RUN.note, /NOT a pass/);
});

test('an unknown display degrades to NEVER RECORDED, never to clean', () => {
  assert.equal(checkRowView({ kind: 'ledger', display: 'TOTALLY_FINE' }).word, CHECK_STATE.ABSENT.word);
  assert.equal(checkRowView(null).word, CHECK_STATE.ABSENT.word);
  assert.notEqual(checkRowView({ display: 'nonsense' }).word, CHECK_STATE.CLEAN.word);
});

test('a row carries its label, its reason and its items', () => {
  const v = checkRowView({ kind: 'register', display: 'FINDINGS', reason: '1 of 105 contradicted', items: [{ scene: 41, kind: 'REGISTER', detail: 'register line 39' }] });
  assert.equal(v.label, 'Against the source register');
  assert.equal(v.reason, '1 of 105 contradicted');
  assert.equal(v.items.length, 1);
  assert.equal(v.bg, '#e5635f29');
  // a row with no reason of its own still says something
  assert.equal(checkRowView({ kind: 'ledger', display: 'NOT_RUN' }).reason, CHECK_STATE.NOT_RUN.note);
});

test('the summary line leads with what was NOT checked', () => {
  assert.equal(checkSummaryLine({ findings: 0, notRun: 10, allClear: false })!.text, '10 not checked');
  assert.equal(checkSummaryLine({ findings: 3, notRun: 2, allClear: false })!.text, '2 not checked · 3 finding(s)');
  assert.match(checkSummaryLine({ findings: 0, notRun: 10, allClear: false })!.text, /not checked/);
});

test('CONTROL — it never prints "0 findings" over checks nobody ran', () => {
  const naive = (s: any) => s.findings + ' finding(s)';
  assert.equal(naive({ findings: 0, notRun: 10 }), '0 finding(s)', 'the defect');
  assert.notEqual(checkSummaryLine({ findings: 0, notRun: 10, allClear: false })!.text, '0 finding(s)');
});

test('the clean verdict is printed ONLY when the backend computed it', () => {
  assert.match(checkSummaryLine({ findings: 0, notRun: 0, allClear: true })!.text, /every check ran/);
  // zero findings and zero not-run but allClear withheld: do not invent the all-clear
  assert.doesNotMatch(checkSummaryLine({ findings: 0, notRun: 0, allClear: false })!.text, /every check ran/);
  assert.equal(checkSummaryLine({ findings: 0, notRun: 0, allClear: false })!.text, '0 finding(s)');
});

test('no record at all is null, which is not "nothing found"', () => {
  assert.equal(checkSummaryLine(null), null);
  assert.equal(checkSummaryLine(undefined), null);
  assert.equal(checkSummaryLine('x'), null);
});

test('isRevisionReady — with no expected id, whatever is active is the answer', () => {
  assert.equal(isRevisionReady({ revisionId: 'r1' }), true);
  assert.equal(isRevisionReady({ revisionId: 'r1' }, ''), true);
  assert.equal(isRevisionReady({ revisionId: 'r1' }, null), true);
});

test('isRevisionReady — a read describing the PREVIOUS revision is not ready', () => {
  assert.equal(isRevisionReady({ revisionId: 'old' }, 'new'), false,
    'DONE is reported before activeRevisionId switches, so this read is the old draft');
  assert.equal(isRevisionReady({ revisionId: 'new' }, 'new'), true);
});

test('isRevisionReady — a read with no revision at all is not ready either', () => {
  assert.equal(isRevisionReady(null, 'new'), false);
  assert.equal(isRevisionReady({}, 'new'), false);
  assert.equal(isRevisionReady({ revisionId: '' }, 'new'), false);
  assert.equal(isRevisionReady({ revisionId: null }, 'new'), false);
});

test('CONTROL — accepting any read shows the old revision’s result under the new pages', () => {
  const naive = (_s: any, _w: string) => true;
  assert.equal(naive({ revisionId: 'old' }, 'new'), true, 'the defect');
  assert.equal(isRevisionReady({ revisionId: 'old' }, 'new'), false);
});

test('solidColor resolves a .sx variable for surfaces that do not define it', () => {
  // .rdroot (the script page) defines --gold2 --goldink --hair --faint --mute and nothing else
  assert.equal(solidColor('var(--amber)'), '#e0a23b');
  assert.equal(solidColor('var(--red)'), '#e5635f');
  assert.equal(solidColor('var(--green)'), '#57b368');
  assert.equal(solidColor('#abcdef'), '#abcdef');
});

test('solidColor never returns an undefined custom property', () => {
  for (const s of Object.values(CHECK_STATE)) {
    assert.doesNotMatch(solidColor(s.color), /var\(/, s.color + ' stayed a variable');
    assert.match(solidColor(s.color), /^#[0-9a-fA-F]{6}$/);
  }
  // every colour the summary line can produce
  for (const sum of [{ allClear: true }, { findings: 0, notRun: 3 }, { findings: 2, notRun: 0 }, { findings: 0, notRun: 0 }]) {
    const line = checkSummaryLine(sum)!;
    assert.doesNotMatch(solidColor(line.color), /var\(/);
  }
});

test('CONTROL — passing var() straight through leaves the line colourless off .sx', () => {
  const line = checkSummaryLine({ findings: 0, notRun: 10, allClear: false })!;
  assert.match(line.color, /^var\(/, 'the module speaks in variables, which is right for the Doctor');
  assert.doesNotMatch(solidColor(line.color), /^var\(/, 'and the page must resolve them');
});

test('solidColor falls back to a literal, not to nothing', () => {
  assert.equal(solidColor('nonsense'), '#9aa1ab');
  assert.equal(solidColor(''), '#9aa1ab');
  assert.equal(solidColor('var(--not-a-colour)'), '#9aa1ab');
});
