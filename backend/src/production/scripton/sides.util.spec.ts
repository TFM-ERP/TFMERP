import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSides, foldDigits, pageSpans, sceneKey, type SidesScene } from './sides.util';

// A short script with known page arithmetic: eight scenes, one page each except where noted.
const SCRIPT: SidesScene[] = [
  { sceneNumber: '1', slugline: 'EXT. HARBOUR - DAY', pages: 1, characters: ['JASON', 'CALLUM'] },
  { sceneNumber: '2', slugline: 'INT. STATION - DAY', pages: 0.5, characters: ['CALLUM'] },
  { sceneNumber: '3', slugline: 'INT. STATION - NIGHT', pages: 0.5, characters: ['JASON', 'MOIRA'] },
  { sceneNumber: '4', slugline: 'EXT. SLIP - NIGHT', pages: 2, characters: ['JASON'] },
  { sceneNumber: '5', slugline: 'INT. BOAT - NIGHT', pages: 1, characters: ['JASON', 'NORA'] },
  { sceneNumber: '6', slugline: 'EXT. SEA - DAWN', pages: 0.25, characters: ['NORA'] },
  { sceneNumber: '7', slugline: 'EXT. SEA - DAY', pages: 0.75, characters: ['JASON', 'NORA'] },
  { sceneNumber: '8', slugline: 'INT. BARN - DAY', pages: 1, characters: ['CALLUM'] },
];

test('page spans come from the running total, and scenes sharing a page both know it', () => {
  const s = pageSpans(SCRIPT);
  assert.deepEqual(s.map((x) => [x.sceneNumber, x.first, x.last]), [
    ['1', 1, 1],   // 0.0 – 1.0
    ['2', 2, 2],   // 1.0 – 1.5   \ both on page 2
    ['3', 2, 2],   // 1.5 – 2.0   /
    ['4', 3, 4],   // 2.0 – 4.0   spans two pages
    ['5', 5, 5],   // 4.0 – 5.0
    ['6', 6, 6],   // 5.0 – 5.25  \ both on page 6
    ['7', 6, 6],   // 5.25 – 6.0  /
    ['8', 7, 7],   // 6.0 – 7.0
  ]);
});

test('THE RULE: master page numbers survive, and are never made sequential', () => {
  // Scenes 5 and 8 are pages 5 and 7. The packet must say 5 and 7 — not 1 and 2.
  const p = buildSides(SCRIPT, { sceneNumbers: ['5', '8'] });
  assert.deepEqual(p.pages.map((x) => x.page), [5, 7]);
  assert.equal(p.masterNumbersPreserved, true);
  // and the scene numbers are the script's own
  assert.deepEqual(p.order, ['5', '8']);
});

test('shooting order is honoured exactly and never re-sorted', () => {
  // A 1st AD put scene 8 first for a reason — daylight, an actor's availability, a location hold.
  // Sorting it back into story order silently throws that decision away.
  const p = buildSides(SCRIPT, { sceneNumbers: ['8', '1', '5'] });
  assert.deepEqual(p.order, ['8', '1', '5']);
  assert.deepEqual(p.pages.map((x) => x.page), [7, 1, 5]);
});

test('a page shared with material not shooting comes whole, with the rest marked to strike', () => {
  // Scene 2 shoots; scene 3 is on the same page and is not today's work.
  const p = buildSides(SCRIPT, { sceneNumbers: ['2'] });
  assert.equal(p.pages.length, 1);
  const page2 = p.pages[0];
  assert.equal(page2.page, 2);
  assert.equal(page2.hasStruck, true, 'the page needs the box-and-diagonal');
  assert.deepEqual(page2.scenes.map((s) => [s.sceneNumber, s.live]), [['2', true], ['3', false]]);
  assert.equal(p.sharedPages, 1);
});

test('a page whose scenes are ALL shooting needs no strike', () => {
  const p = buildSides(SCRIPT, { sceneNumbers: ['2', '3'] });
  assert.equal(p.pages.length, 1, 'one page, not two — an actor is not handed it twice');
  assert.equal(p.pages[0].hasStruck, false);
  assert.equal(p.sharedPages, 0);
});

test('a scene spanning two pages brings both', () => {
  const p = buildSides(SCRIPT, { sceneNumbers: ['4'] });
  assert.deepEqual(p.pages.map((x) => x.page), [3, 4]);
});

test('a scene number the script does not have is REPORTED, never dropped quietly', () => {
  // A typo in a day's schedule is exactly what a packet must not hide: the actor turns up
  // without the page and nobody knows why until the camera is waiting.
  const p = buildSides(SCRIPT, { sceneNumbers: ['5', '99', '8'] });
  assert.deepEqual(p.order, ['5', '8']);
  assert.ok(p.warnings.some((w) => /Not in this script: scene 99/.test(w)));
});

test('character mode says plainly that it is NOT sides', () => {
  const p = buildSides(SCRIPT, { character: 'nora' });
  assert.equal(p.mode, 'character');
  assert.deepEqual(p.order, ['5', '6', '7']);           // story order, not shooting order
  assert.ok(p.warnings.some((w) => /not shooting sides/i.test(w)),
    'calling a read-through packet "sides" on a call sheet is a lie a 1st AD catches immediately');
  // and it still preserves master pages
  assert.deepEqual(p.pages.map((x) => x.page), [5, 6]);
});

test('an unknown character returns empty and says why, rather than an empty packet with no reason', () => {
  const p = buildSides(SCRIPT, { character: 'GIDEON' });
  assert.deepEqual(p.order, []);
  assert.ok(p.warnings.some((w) => /does not appear/.test(w)));
});

test('with neither a schedule nor a character it REFUSES rather than inventing a day', () => {
  const p = buildSides(SCRIPT, {});
  assert.deepEqual(p.pages, []);
  assert.ok(p.warnings.some((w) => /invents a shooting day/.test(w)));
  assert.deepEqual(buildSides(SCRIPT, null).pages, []);
});

test('every packet carries the staleness warning, because every packet goes stale', () => {
  const p = buildSides(SCRIPT, { sceneNumbers: ['1'] });
  assert.ok(p.warnings.some((w) => /stale/.test(w) && /at wrap/.test(w)));
});

test('a real pagination pass overrides the derived arithmetic — but a defaulted one does not', () => {
  // Breakdown rows are routinely written with pageStart:1, pageEnd:1 on EVERY row. That is a
  // default, not a measurement, and trusting it would put the whole script on page 1.
  const defaulted = SCRIPT.map((s) => ({ ...s, pageStart: 1, pageEnd: 1 }));
  const d = pageSpans(defaulted);
  assert.deepEqual(d.map((x) => x.first), [1, 2, 2, 3, 5, 6, 6, 7], 'a defaulted column must be ignored');

  // A real pass, where positions actually vary, wins.
  const real = [
    { sceneNumber: '1', pages: 1, pageStart: 1, pageEnd: 1 },
    { sceneNumber: '2', pages: 1, pageStart: 4, pageEnd: 6 },
  ];
  const r = pageSpans(real);
  assert.deepEqual([r[1].first, r[1].last], [4, 6]);
});

test('PURE AND NEVER THROWS: junk in, a packet out', () => {
  const junk: any[] = [null, undefined, {}, { sceneNumber: null, pages: 'x' }, { pages: -3 }, { characters: 5 }];
  assert.doesNotThrow(() => buildSides(junk, { character: 'X' }));
  assert.doesNotThrow(() => buildSides(junk, { sceneNumbers: ['1'] }));
  assert.doesNotThrow(() => buildSides(null as any, { character: 'X' }));
  assert.doesNotThrow(() => pageSpans(null as any));
  assert.doesNotThrow(() => buildSides(SCRIPT, { sceneNumbers: [null as any, 3, '  '] }));
  const empty = buildSides([], { character: 'X' });
  assert.deepEqual(empty.pages, []);
  assert.ok(empty.warnings.some((w) => /No scenes/.test(w)));
});

test('BREAK SWEEP: renumbering the packet fails this suite', () => {
  // If someone "tidies" the output by numbering pages 1..n within the packet, the assertion
  // below is what stops them — and the reason is that an actor saying "page 12" to a director
  // holding a different page 12 is worse than having no sides at all.
  const p = buildSides(SCRIPT, { sceneNumbers: ['8', '5'] });
  const pages = p.pages.map((x) => x.page);
  assert.deepEqual(pages, [7, 5]);
  assert.notDeepEqual(pages, [1, 2], 'pages were renumbered — the packet is now unusable in a room');
  assert.ok(pages.some((n, i) => i > 0 && n < pages[i - 1]), 'issue order is allowed to run backwards through the script');
});

// ---------------------------------------------------------------------------------------------
// Digits. A scene number is a key, not a glyph — and the two spellings of one scene are one scene.
// ---------------------------------------------------------------------------------------------

// The same eight scenes, numbered the way an Arabic page prints them.
const ARABIC_SCRIPT: SidesScene[] = SCRIPT.map((s) => ({
  ...s,
  sceneNumber: String(s.sceneNumber).replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d))),
}));

test('THE DEFECT: a schedule typed 14 finds the scene the page prints as ١٤', () => {
  // The coordinator's stripboard is Latin. The script is Arabic. Before the fold this returned
  // "Not in this script" and the actor arrived without pages.
  const p = buildSides(ARABIC_SCRIPT, { sceneNumbers: ['5', '8'] });
  assert.deepEqual(p.pages.map((x) => x.page), [5, 7]);
  assert.ok(!p.warnings.some((w) => /Not in this script/.test(w)), p.warnings.join(' | '));
});

test('...and the reverse: a schedule typed ٥ finds a scene the script numbers 5', () => {
  const p = buildSides(SCRIPT, { sceneNumbers: ['٥', '٨'] });
  assert.deepEqual(p.pages.map((x) => x.page), [5, 7]);
  assert.deepEqual(p.order, ['5', '8'], 'the packet carries the SCRIPT’s own numbers, never the fold');
});

test('shooting order survives the fold — a day given in Arabic digits is not re-sorted', () => {
  const p = buildSides(SCRIPT, { sceneNumbers: ['٨', '١', '٥'] });
  assert.deepEqual(p.order, ['8', '1', '5']);
  assert.deepEqual(p.pages.map((x) => x.page), [7, 1, 5]);
});

test('Persian/Urdu shapes fold too — they are a second Unicode block, not a second language', () => {
  assert.equal(foldDigits('۱۴'), '14');   // arabext
  assert.equal(foldDigits('١٤'), '14');   // arab
  const p = buildSides(SCRIPT, { sceneNumbers: ['۵'] });
  assert.deepEqual(p.pages.map((x) => x.page), [5]);
});

test('ONLY DIGITS MOVE — a heading in Arabic letters is returned unchanged', () => {
  assert.equal(foldDigits('مشهد ١٤'), 'مشهد 14');
  assert.equal(foldDigits('INT. HARBOUR - DAY'), 'INT. HARBOUR - DAY');
});

test('a letter suffix matches whatever case and spacing it was typed in', () => {
  const withSuffix: SidesScene[] = [
    { sceneNumber: '12A', slugline: 'INT. LIFT - DAY', pages: 1 },
    { sceneNumber: '12B', slugline: 'INT. LOBBY - DAY', pages: 1 },
  ];
  assert.deepEqual(buildSides(withSuffix, { sceneNumbers: ['  12a  '] }).order, ['12A']);
  assert.deepEqual(buildSides(withSuffix, { sceneNumbers: ['12 b'] }).order, ['12B'], 'a space before the suffix is a typing accident');
});

test('A LEADING ZERO IS NOT STRIPPED — a scene number is a label, not an integer', () => {
  // 04 and 4 may well be the same scene, and deciding that is a reading. This file transcribes.
  const p = buildSides([{ sceneNumber: '04', slugline: 'INT. X - DAY', pages: 1 }], { sceneNumbers: ['4'] });
  assert.deepEqual(p.order, []);
  assert.ok(p.warnings.some((w) => /Not in this script: scene 4/.test(w)));
});

test('the missing warning names what the CALLER typed, not what the fold rewrote it to', () => {
  // A coordinator has to recognise their own typo to fix it.
  const p = buildSides(SCRIPT, { sceneNumbers: ['٩٩'] });
  assert.ok(p.warnings.some((w) => w.indexOf('٩٩') >= 0), p.warnings.join(' | '));
  assert.ok(!p.warnings.some((w) => /Not in this script: scene 99/.test(w)), 'the folded form must not be echoed back');
});

test('a script numbering two scenes alike is REPORTED, never silently resolved', () => {
  const muddled: SidesScene[] = [
    { sceneNumber: '14', slugline: 'INT. ONE - DAY', pages: 1 },
    { sceneNumber: '١٤', slugline: 'INT. TWO - DAY', pages: 1 },
  ];
  const p = buildSides(muddled, { sceneNumbers: ['14'] });
  assert.ok(p.warnings.some((w) => /numbers two scenes the same/.test(w)), p.warnings.join(' | '));
  assert.deepEqual(p.order, ['14'], 'the first is used');
  assert.equal(p.pages.length, 1);
});

test('sceneKey and foldDigits are PURE AND NEVER THROW', () => {
  assert.equal(foldDigits(null), '');
  assert.equal(foldDigits(undefined), '');
  assert.equal(foldDigits(14), '14');
  assert.equal(sceneKey(null), '');
  assert.equal(sceneKey('  '), '');
  assert.doesNotThrow(() => sceneKey({} as any));
  assert.doesNotThrow(() => foldDigits([1, 2] as any));
  // an empty scene number never becomes a matchable key
  assert.deepEqual(buildSides([{ sceneNumber: '   ', pages: 1 }], { sceneNumbers: ['1'] }).order, []);
});

test('BREAK SWEEP: deleting the fold fails this suite', () => {
  // If sceneKey stops folding, this is the assertion that catches it — an Arabic-numbered script
  // handed a Latin schedule is the entire case the change exists for.
  assert.notEqual(sceneKey('١٤'), '١٤', 'sceneKey no longer folds Arabic-Indic digits');
  assert.equal(sceneKey('١٤'), '14');
  const p = buildSides(ARABIC_SCRIPT, { sceneNumbers: ['4'] });
  assert.deepEqual(p.pages.map((x) => x.page), [3, 4], 'scene 4 spans two pages and both must come');
});
