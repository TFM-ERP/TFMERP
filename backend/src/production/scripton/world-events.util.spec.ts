import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import {
  WORLD_EVENTS, datedWorldEvents, ambiguousEventNames, findWorldEvent, worldEventsInYear,
} from './world-events.util';
import { sweepEras, resolveEventAnchored } from './era.util';

const yearOf = (text: string, present = 2026): number | null => {
  const hits = resolveEventAnchored(text, sweepEras(text, present), datedWorldEvents(present));
  const o = hits[0] && hits[0].offset;
  return o ? present + Math.round(o.from / 365.25) : null;
};

test('the inventory is coherent, and every event says where it came from', () => {
  assert.equal(WORLD_EVENTS.length, 55);
  // The fingerprint below pins DATES. This pins the NAMES: add or drop an alias and it moves, so a
  // phrase silently ceasing to resolve shows up in review rather than in a script six months later.
  assert.equal(datedWorldEvents(2026).length, 206);
  const ids = new Set(WORLD_EVENTS.map((e) => e.id));
  assert.equal(ids.size, WORLD_EVENTS.length, 'two events share an id');
  for (const e of WORLD_EVENTS) {
    assert.ok(e.end === null || e.start <= e.end, e.id + ': start is after end');
    assert.ok(e.start <= 2026, e.id + ': starts in the future');
    assert.ok(e.basis.length > 40, e.id + ': no basis');
    assert.ok(['', 'disputed', 'unsound'].includes(e.flag), e.id + ': bad flag');
    assert.ok(['global', 'regional'].includes(e.scope), e.id + ': bad scope');
    assert.ok(e.scope === 'global' || e.regions.length > 0, e.id + ': regional but names no region');
    assert.ok(e.label.trim().length > 0 && e.ar.trim().length > 0, e.id + ': missing a label');
  }
});

test('a POINT event is one year wide, because a war that lasted six days did not last two years', () => {
  // The research pass was told every row needed start < end. That rule is right for a period and
  // wrong for an event, and it silently stretched every one-day event onto whatever aftermath could
  // be found - the Six-Day War came back as 1967-1968, with a basis explaining the Jarring Mission.
  const six = findWorldEvent('the Six-Day War')!;
  assert.equal(six.start, 1967);
  assert.equal(six.end, 1967);
  assert.equal(findWorldEvent('9/11')!.end, 2001);
  assert.equal(findWorldEvent('Chernobyl')!.end, 1986);
  // and the genuinely cross-year ones were NOT flattened to match
  assert.equal(findWorldEvent('the Gulf War')!.end, 1991);
  assert.equal(findWorldEvent('SARS')!.end, 2003);
});

test('an event anchors at its START, not its midpoint - the opposite of an era row', () => {
  // "three years before the war" means before it BEGAN. A midpoint would put it inside the war.
  assert.equal(yearOf('He left three years before the Second World War, and never wrote.'), 1936);
  assert.equal(yearOf('Vex bought the boy three years before the COVID-19 pandemic.'), 2016);
  assert.equal(yearOf('Two years before the Wall Street Crash, the yard was still busy.'), 1927);
});

test('A NAME MORE THAN ONE EVENT ANSWERS TO DATES NOTHING, and says so out loud', () => {
  // "the crash" is 1929, 1987, 2000 and 2008. Picking the longest match or the first row would be a
  // coin toss dressed as an answer, and the wrong one is 79 years out. So it refuses - and reports
  // itself, so the app can ask the writer which one rather than failing silently.
  const amb = ambiguousEventNames();
  assert.deepEqual(amb.map((a) => a.name), ['the crash', 'the pandemic', 'the war']);
  assert.ok(amb.find((a) => a.name === 'the crash')!.ids.length >= 3);
  assert.equal(yearOf('Three years before the pandemic, the shop was thriving.'), null);
  assert.equal(yearOf('Three years before the crash, the shop was thriving.'), null);
  assert.equal(yearOf('Three years before the war, the shop was thriving.'), null);
  // the unambiguous forms of the SAME events still date
  assert.equal(yearOf('Three years before the COVID-19 pandemic, the shop was thriving.'), 2016);
  assert.equal(yearOf('Three years before the Second World War, the shop was thriving.'), 1936);
  // and no ambiguous name reaches the dated list at all
  const dated = new Set(datedWorldEvents(2026).map((e) => e.name.toLowerCase()));
  for (const a of amb) assert.ok(!dated.has(a.name), a.name + ' leaked into the dated list');
});

test('an UNSOUND event contributes no anchor, exactly as an unsound era row refuses', () => {
  const unsound = WORLD_EVENTS.filter((e) => e.flag === 'unsound');
  assert.ok(unsound.length > 0, 'expected some unsound events');
  const dated = new Set(datedWorldEvents(2026).map((e) => e.name.toLowerCase()));
  for (const e of unsound) {
    assert.ok(!dated.has(e.label.toLowerCase()), e.id + ': an unsound event supplied an anchor');
    // but it is still listed as something that was going on
    assert.ok(worldEventsInYear(e.start, 2026).some((x) => x.id === e.id), e.id + ': not listed in its own start year');
  }
});

test('worldEventsInYear tells a writer what their setting was living through', () => {
  const ids = (y: number) => worldEventsInYear(y, 2026).map((e) => e.id);
  assert.ok(ids(1919).includes('spanish-flu'), '1919 was inside the influenza pandemic');
  assert.ok(ids(1942).includes('world-war-two'));
  assert.ok(ids(2020).includes('covid-19-pandemic'));
  // an open-ended event is closed on the caller's present, so it never goes stale
  assert.ok(worldEventsInYear(2025, 2026).some((e) => e.end === null));
  assert.deepEqual(worldEventsInYear(1200, 2026), []);   // a quiet year is honestly empty
});

test('findWorldEvent resolves a label or an alias, and refuses an ambiguous one', () => {
  assert.equal(findWorldEvent('the coronavirus pandemic')!.id, 'covid-19-pandemic');
  assert.equal(findWorldEvent('THE SIX-DAY WAR')!.id, 'six-day-war');
  assert.equal(findWorldEvent('the pandemic'), null);   // ambiguous: no single right answer
  assert.equal(findWorldEvent('the Battle of Nowhere'), null);
  assert.equal(findWorldEvent(''), null);
});

test('the table is pinned, so no date can drift without someone deciding to', () => {
  const fingerprint = createHash('sha256').update(
    WORLD_EVENTS.map((e) => [e.id, e.start, e.end, e.flag].join('|')).join('\n'),
  ).digest('hex').slice(0, 16);
  assert.equal(fingerprint, '31a77f0016ec0de5');
});

test('never throws, and a junk present year yields nothing rather than a list of zeroes', () => {
  // An offset of 0 would silently mean "this event is happening now" for all 55 of them.
  assert.deepEqual(datedWorldEvents(NaN), []);
  assert.deepEqual(datedWorldEvents(undefined as any), []);
  assert.deepEqual(datedWorldEvents(null as any), []);
  assert.deepEqual(worldEventsInYear(NaN, 2026), []);
  assert.deepEqual(worldEventsInYear(1990, NaN), []);
  assert.equal(findWorldEvent(null as any), null);
  assert.equal(findWorldEvent(undefined as any), null);
  assert.ok(datedWorldEvents(2026).every((e) => Number.isFinite(e.offset) && e.name.length > 0));
});
