import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSetList, parseHeading, setKeyOf, setListBrief, suggestMerges, type SceneRow } from './set-list.util';

const sc = (n: number, slugline: string, pages = 1, characters: string[] = []): SceneRow =>
  ({ sceneNumber: String(n), slugline, pages, characters });

test('THE BRIEF: one house written two ways gives the SAME set count', () => {
  // This is the whole argument. A slugline counter says 1 vs 4 for identical films.
  const asRooms = buildSetList([
    sc(1, 'INT. CHARLIE\'S HOUSE - KITCHEN - NIGHT'),
    sc(2, 'INT. CHARLIE\'S HOUSE - HALLWAY - NIGHT'),
    sc(3, 'INT. CHARLIE\'S HOUSE - BATHROOM - NIGHT'),
    sc(4, 'INT. CHARLIE\'S HOUSE - BEDROOM - NIGHT'),
  ]);
  assert.equal(asRooms.parentCount, 1, 'four rooms of one house are one parent set');
  assert.equal(asRooms.subSetCount, 4, 'and four things to dress');
  assert.equal(asRooms.distinctSluglines, 4, 'the raw count is kept as a diagnostic, not the headline');

  // the producer's number and the art department's number are both present and different
  assert.notEqual(asRooms.parentCount, asRooms.subSetCount);
});

test('THE REFUSAL: locations is null, always, and nothing can change that', () => {
  const empty = buildSetList([]);
  const full = buildSetList([sc(1, 'EXT. HARBOUR - DAY'), sc(2, 'INT. LIFEBOAT STATION - NIGHT')]);
  assert.equal(empty.locations, null);
  assert.equal(full.locations, null);
  // and the report says why, in words a producer reads rather than in a comment nobody opens
  assert.ok(full.caveats.some((c) => /SETS, not locations/i.test(c)));
  assert.ok(full.caveats.some((c) => /mini-slug/i.test(c)));
  assert.ok(full.caveats.some((c) => /watches on a screen|through a window/i.test(c)));
});

test('time of day is an ATTRIBUTE of a set, never a fork of it', () => {
  const r = buildSetList([
    sc(1, 'INT. HOUSE - DAY'),
    sc(2, 'INT. HOUSE - NIGHT'),
    sc(3, 'INT. HOUSE - DAWN'),
  ]);
  assert.equal(r.parentCount, 1, 'three times of day are one set');
  assert.deepEqual(r.parentSets[0].timesOfDay.sort(), ['DAWN', 'DAY', 'NIGHT']);
  assert.equal(r.parentSets[0].sceneCount, 3);
});

test('INT and EXT do not fork the set either — but both faces stay visible', () => {
  const r = buildSetList([sc(1, 'INT. HOUSE - DAY'), sc(2, 'EXT. HOUSE - DAY'), sc(3, 'INT./EXT. HOUSE - NIGHT')]);
  assert.equal(r.parentCount, 1);
  const s = r.parentSets[0];
  assert.equal(s.int, true);
  assert.equal(s.ext, true);
  assert.equal(s.hybrid, true, 'the INT./EXT. scene marks the set hybrid');
  // exterior pages are tallied because weather risk is priced, even though EXT does not fork the set
  assert.ok(r.extPages > 0);
});

test('a timeless heading inherits the previous time and SAYS it inherited', () => {
  // CONTINUOUS carries no time information. Silently choosing DAY would be inventing a fact.
  const r = buildSetList([
    sc(1, 'INT. WAREHOUSE - NIGHT'),
    sc(2, 'INT. WAREHOUSE - OFFICE - CONTINUOUS'),
  ]);
  const s = r.parentSets[0];
  assert.deepEqual(s.timesOfDay, ['NIGHT']);
  assert.equal(s.timeInherited, true, 'the inheritance must be visible to the reader');
});

test('vehicles are pulled out as a production-METHOD decision, not counted as places', () => {
  const r = buildSetList([
    sc(1, 'INT. CAR - MOVING'),
    sc(2, 'INT. CAR - DAY'),
    sc(3, 'EXT. HIGHWAY - DAY'),
  ]);
  const car = r.parentSets.find((s) => s.key === 'CAR')!;
  assert.ok(car, 'CAR is a set');
  assert.equal(car.sceneCount, 2, 'MOVING does not fork the car into two sets');
  assert.equal(car.vehicle, true);
  assert.deepEqual(r.vehicleSets, ['CAR']);
  assert.ok(r.caveats.some((c) => /production-method decision/i.test(c)));
  // a highway is not a vehicle
  assert.equal(r.parentSets.find((s) => s.key === 'HIGHWAY')!.vehicle, false);
});

test('qualifiers become flags and must NOT split a set in two', () => {
  // The over-count this file exists to prevent: FLASHBACK welded to a name makes one barn into two.
  const r = buildSetList([
    sc(1, 'INT. MACRAE BARN - DAY'),
    sc(2, 'INT. MACRAE BARN - FLASHBACK - DAY'),
    sc(3, 'INT. MACRAE BARN - DREAM - NIGHT'),
  ]);
  assert.equal(r.parentCount, 1, 'one barn, three scenes');
  assert.equal(r.parentSets[0].sceneCount, 3);
  assert.ok(r.parentSets[0].flags.indexOf('FLASHBACK') >= 0);
  assert.ok(r.parentSets[0].flags.indexOf('DREAM') >= 0);
});

test('dates and clock times are stripped out of set identity', () => {
  const r = buildSetList([
    sc(1, 'EXT. PORT OF BOSTON - 1997 - DAY'),
    sc(2, 'EXT. PORT OF BOSTON - 8:52 AM'),
    sc(3, 'EXT. PORT OF BOSTON - DAY'),
  ]);
  assert.equal(r.parentCount, 1, 'a stamped time must not invent a second port');
  assert.equal(r.parentSets[0].sceneCount, 3);
});

test('normalisation matches what a person would call the same set — and no further', () => {
  assert.equal(setKeyOf("JOHN'S APARTMENT"), setKeyOf('JOHNS APARTMENT'));
  assert.equal(setKeyOf('the House'), 'HOUSE');
  assert.equal(setKeyOf('  DINER.  '), 'DINER');
  assert.equal(setKeyOf('LIFEBOAT   STATION'), 'LIFEBOAT STATION');
  // and NOT further: these are different places and must stay apart
  assert.notEqual(setKeyOf('MOTEL ROOM'), setKeyOf('MOTEL ROOM 12'));
  assert.notEqual(setKeyOf('HOSPITAL - ICU'), setKeyOf('HOSPITAL - ER'));
});

test('near-matches are SUGGESTED, never merged — being wrong costs a producer a room', () => {
  const r = buildSetList([
    sc(1, "INT. JOHN'S APT - DAY"),
    sc(2, "INT. JOHN'S APARTMENT - NIGHT"),
    sc(3, 'INT. MOTEL ROOM - NIGHT'),
    sc(4, 'INT. MOTEL ROOM 12 - NIGHT'),
  ]);
  // nothing was merged behind the user's back
  assert.equal(r.parentCount, 4);
  const reasons = r.suggestedMerges.map((m) => m.reason).join(' | ');
  assert.match(reasons, /abbreviations/, 'APT/APARTMENT is offered');
  // and the numbered room is NOT offered, because those are two rooms
  const pair = r.suggestedMerges.find((m) => /MOTEL ROOM 12/.test(m.a + m.b));
  assert.equal(pair, undefined, 'MOTEL ROOM 12 must never be suggested as MOTEL ROOM');
});

test('a bare hyphen inside a name is part of the name, not a sub-set delimiter', () => {
  const r = buildSetList([sc(1, 'EXT. SAINT-DENIS MARKET - DAY'), sc(2, 'EXT. DRIVE-IN - NIGHT')]);
  assert.equal(r.parentCount, 2);
  assert.ok(r.parentSets.some((s) => s.key === 'SAINT-DENIS MARKET'));
  assert.ok(r.parentSets.some((s) => s.key === 'DRIVE-IN'));
  assert.equal(r.subSetCount, 0, 'neither name contains a sub-set');
});

test('pages, eighths, night and exterior tallies are the numbers that price a day', () => {
  const r = buildSetList([
    sc(1, 'EXT. HARBOUR - NIGHT', 2.5),
    sc(2, 'INT. STATION - DAY', 1.25),
    sc(3, 'EXT. HARBOUR - DAY', 0.5),
  ]);
  assert.equal(r.pages, 4.25);
  assert.equal(r.eighths, 34);
  assert.equal(r.nightPages, 2.5);
  assert.equal(r.extPages, 3);
  const harbour = r.parentSets.find((s) => s.key === 'HARBOUR')!;
  assert.equal(harbour.pages, 3);
  assert.equal(harbour.eighths, 24);
  // sets are ordered by page weight, so the expensive one is first
  assert.equal(r.parentSets[0].key, 'HARBOUR');
});

test('the original slugline is kept for every set, forever', () => {
  const r = buildSetList([sc(1, 'INT. HOUSE - KITCHEN - DAY'), sc(2, 'INT. HOUSE - HALL - NIGHT')]);
  assert.deepEqual(r.parentSets[0].sluglines, ['INT. HOUSE - KITCHEN - DAY', 'INT. HOUSE - HALL - NIGHT']);
});

test('cast per set is collected, because consolidating a set can collide with an actor', () => {
  const r = buildSetList([
    sc(1, 'INT. STATION - DAY', 1, ['JASON', 'CALLUM']),
    sc(2, 'INT. STATION - NIGHT', 1, ['JASON', 'NORA']),
  ]);
  assert.deepEqual(r.parentSets[0].cast.sort(), ['CALLUM', 'JASON', 'NORA']);
});

test('PURE AND NEVER THROWS: junk rows produce a report, not an exception', () => {
  const junk: any[] = [
    null, undefined, {}, { slugline: null }, { slugline: '' }, { slugline: 'INT.' },
    { slugline: '   ' }, { slugline: 42 }, { slugline: 'no prefix at all' },
    { slugline: 'INT. X - DAY', pages: 'abc' }, { slugline: 'INT. Y - DAY', pages: -5 },
    { slugline: 'INT. Z - DAY', characters: 'JASON, NORA' },
  ];
  assert.doesNotThrow(() => buildSetList(junk));
  assert.doesNotThrow(() => buildSetList(null as any));
  assert.doesNotThrow(() => buildSetList(undefined as any));
  assert.doesNotThrow(() => parseHeading(null));
  assert.doesNotThrow(() => parseHeading({} as any));
  assert.doesNotThrow(() => suggestMerges(null as any));
  const r = buildSetList(junk);
  assert.equal(r.locations, null);
  assert.ok(r.pages >= 0, 'a negative page count never reaches the total');
  assert.ok(r.caveats.some((c) => /UNNAMED SET/.test(c)), 'unreadable headings are declared, not hidden');
  // a comma-separated cast string is parsed, not dropped
  assert.deepEqual(r.parentSets.find((s) => s.key === 'Z')!.cast.sort(), ['JASON', 'NORA']);
});

test('a heading with no INT/EXT prefix still yields a set from the row columns', () => {
  // Breakdown tables routinely store the set name without its prefix.
  const r = buildSetList([{ sceneNumber: '1', setName: 'LIFEBOAT STATION', intExt: 'INT', dayNight: 'NIGHT', pages: 1 }]);
  assert.equal(r.parentCount, 1);
  assert.equal(r.parentSets[0].key, 'LIFEBOAT STATION');
  assert.equal(r.parentSets[0].int, true);
  assert.deepEqual(r.parentSets[0].timesOfDay, ['NIGHT']);
});

test('BREAK SWEEP: the naive count and this one must actually disagree', () => {
  // If someone rewrites buildSetList to key on the raw slugline, every assertion above about
  // collapsing still passes trivially unless something asserts the two numbers differ. This does.
  const rows = [
    sc(1, 'INT. HOUSE - KITCHEN - DAY'),
    sc(2, 'INT. HOUSE - KITCHEN - NIGHT'),
    sc(3, 'INT. HOUSE - HALL - DAY'),
    sc(4, 'EXT. HOUSE - DAY'),
  ];
  const r = buildSetList(rows);
  assert.equal(r.distinctSluglines, 4, 'four distinct headings');
  assert.equal(r.parentCount, 1, 'one house');
  assert.equal(r.subSetCount, 2, 'kitchen and hall; the exterior is a face of the house, not a room');
  assert.ok(r.distinctSluglines > r.parentCount, 'the naive count and the honest one MUST differ here');
});

// ---------------------------------------------------------------------------------------------
// setListBrief — the one line of places a prompt is allowed to be handed.
// ---------------------------------------------------------------------------------------------

test('THE DAY/NIGHT DEFECT: one harbour, two lightings, ONE entry', () => {
  // This is the shape that was reaching the look-board prompt as two separate places.
  const r = buildSetList([
    { sceneNumber: '1', slugline: 'EXT. HARBOUR - DAY', pages: 2 },
    { sceneNumber: '2', slugline: 'EXT. HARBOUR - NIGHT', pages: 1 },
  ]);
  const brief = setListBrief(r);
  assert.equal(brief, 'HARBOUR (EXT, DAY/NIGHT)');
  assert.equal(brief.split(';').length, 1, 'the harbour must be named once, not twice');
});

test('BREAK SWEEP: the naive derivation this replaced fails this assertion', () => {
  const rows = [
    { sceneNumber: '1', slugline: 'INT. HOUSE - DAY', pages: 1 },
    { sceneNumber: '2', slugline: 'INT. HOUSE - NIGHT', pages: 1 },
    { sceneNumber: '3', slugline: 'EXT. HOUSE - DUSK', pages: 1 },
  ];
  // What the old line in lookboardPlan did: strip the INT/EXT prefix, de-duplicate the remainder.
  const naive = Array.from(new Set(rows.map((s) => s.slugline.replace(/^(INT|EXT)[^A-Za-z]*/i, ''))));
  assert.equal(naive.length, 3, 'the naive derivation really does emit the same house three times');
  assert.equal(setListBrief(buildSetList(rows)), 'HOUSE (INT/EXT, DAY/NIGHT/DUSK)');
});

test('both faces of one set are one entry, not two', () => {
  const r = buildSetList([
    { sceneNumber: '1', slugline: 'INT. WAREHOUSE - NIGHT', pages: 1 },
    { sceneNumber: '2', slugline: 'EXT. WAREHOUSE - NIGHT', pages: 1 },
  ]);
  assert.equal(setListBrief(r), 'WAREHOUSE (INT/EXT, NIGHT)');
  // Deliberately NOT a boat: a vessel is a vehicle, and the brief says so. Writing this test with
  // INT./EXT. BOAT is what caught that — the util was right and the test was wrong.
  assert.ok(/vehicle/.test(setListBrief(buildSetList([{ sceneNumber: '1', slugline: 'INT. BOAT - NIGHT', pages: 1 }]))));
});

test('ordered by pages descending, so a cap drops the smallest set and never the last act', () => {
  const r = buildSetList([
    { sceneNumber: '1', slugline: 'INT. LOBBY - DAY', pages: 0.5 },
    { sceneNumber: '2', slugline: 'INT. VAULT - DAY', pages: 6 },
    { sceneNumber: '3', slugline: 'EXT. ROOF - NIGHT', pages: 3 },
  ]);
  const brief = setListBrief(r, { limit: 2 });
  assert.ok(brief.startsWith('VAULT'), 'the biggest set leads');
  assert.ok(brief.indexOf('ROOF') > 0);
  assert.equal(brief.indexOf('LOBBY'), -1, 'the half-page lobby is what gets dropped');
});

test('A CAP THAT FIRES SAYS SO — a silently shortened list reads as a complete one', () => {
  const rows = [];
  for (let i = 1; i <= 5; i++) rows.push({ sceneNumber: String(i), slugline: 'INT. ROOM ' + i + ' - DAY', pages: i });
  const brief = setListBrief(buildSetList(rows), { limit: 2 });
  assert.ok(/and 3 more sets not listed$/.test(brief), brief);
  // and the singular is not "1 more sets"
  assert.ok(/and 1 more set not listed$/.test(setListBrief(buildSetList(rows), { limit: 4 })));
});

test('a full list carries NO note, because nothing was dropped', () => {
  const r = buildSetList([{ sceneNumber: '1', slugline: 'INT. SHED - DAY', pages: 1 }]);
  assert.equal(setListBrief(r, { limit: 30 }), 'SHED (INT, DAY)');
  assert.equal(setListBrief(r).indexOf('not listed'), -1);
});

test('a vehicle is marked, because a car interior is a different kind of reference', () => {
  const r = buildSetList([{ sceneNumber: '1', slugline: 'INT. CAR - MOVING - NIGHT', pages: 1 }]);
  assert.ok(/vehicle/.test(setListBrief(r)), setListBrief(r));
});

test('it does not reorder the report it was handed', () => {
  const r = buildSetList([
    { sceneNumber: '1', slugline: 'INT. LOBBY - DAY', pages: 0.5 },
    { sceneNumber: '2', slugline: 'INT. VAULT - DAY', pages: 6 },
  ]);
  const before = r.parentSets.map((s) => s.name);
  setListBrief(r);
  assert.deepEqual(r.parentSets.map((s) => s.name), before, 'sorting must happen on a copy');
});

test('PURE AND NEVER THROWS: junk in, a string out', () => {
  assert.equal(setListBrief(null), '');
  assert.equal(setListBrief(undefined), '');
  assert.equal(setListBrief({} as any), '');
  assert.equal(setListBrief({ parentSets: null } as any), '');
  assert.equal(setListBrief({ parentSets: [null, undefined] } as any), '');
  assert.doesNotThrow(() => setListBrief(buildSetList([]), { limit: 0 }));
  assert.doesNotThrow(() => setListBrief(buildSetList([]), { limit: -5 } as any));
  assert.doesNotThrow(() => setListBrief(buildSetList([{ slugline: 'INT. X - DAY' }]), null));
});
