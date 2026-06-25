import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scorecardTiles, verdictBanner, sceneFlowBars, arcPoints, diagRows, letterFromScore, TRANSFORM_TILES,
} from './scripon-doctor.logic.ts';

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
