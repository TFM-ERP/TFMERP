/**
 * Calendar-anchoring engine — pure-logic unit tests (node:test + ts-node). Run: npm run test:unit
 * Characterizes the date-walk that maps abstract shoot-day numbers onto real calendar dates
 * (Prep → Shoot → Wrap → Strike), rippling out from the locked anchor.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { isoDate, addDays, isWorkingDay, buildProjectCalendar, shootDayForDate } from './calendar-anchoring.util';

const row = (days: any[], date: string) => days.find((d) => d.date === date);

// ---------------------------------------------------------------------------
// Pure date helpers
// ---------------------------------------------------------------------------
test('isoDate renders the UTC calendar date as YYYY-MM-DD', () => {
  assert.equal(isoDate(new Date('2026-06-24T00:00:00Z')), '2026-06-24');
  assert.equal(isoDate(new Date('2026-06-24T23:59:59Z')), '2026-06-24');
});

test('addDays steps forward and backward by whole days', () => {
  assert.equal(isoDate(addDays(new Date('2026-06-24'), 3)), '2026-06-27');
  assert.equal(isoDate(addDays(new Date('2026-06-24'), -1)), '2026-06-23');
  assert.equal(isoDate(addDays(new Date('2026-06-24'), 0)), '2026-06-24');
});

test('isWorkingDay classifies the UTC calendar date (weekday + holidays)', () => {
  // 2026-06-27 is a Saturday, 2026-06-29 a Monday (UTC).
  assert.equal(isWorkingDay(new Date('2026-06-27'), [6, 0], new Set()), false, 'Saturday is off');
  assert.equal(isWorkingDay(new Date('2026-06-29'), [6, 0], new Set()), true, 'Monday is working');
  // Holiday match is by UTC iso string.
  assert.equal(isWorkingDay(new Date('2026-06-29'), [], new Set(['2026-06-29'])), false, 'holiday is off');
  assert.equal(isWorkingDay(new Date('2026-06-30'), [], new Set(['2026-06-29'])), true, 'non-holiday is working');
});

test('isWorkingDay reads the weekday in UTC, independent of the host timezone', () => {
  // This instant is still Saturday in UTC, but on a positive-offset host (e.g. UTC+4) the *local*
  // weekday is already Sunday. Weekends must be decided by the UTC calendar date, so it stays a weekend.
  assert.equal(isWorkingDay(new Date('2026-06-27T21:00:00Z'), [6], new Set()), false, 'UTC Saturday is a weekend on any host');
});

// ---------------------------------------------------------------------------
// buildProjectCalendar — the core day-walk
// ---------------------------------------------------------------------------
test('buildProjectCalendar maps strips to consecutive days and ripples prep/wrap/strike out (no weekends)', () => {
  const cal = buildProjectCalendar({
    anchor: '2026-06-24', // Wednesday
    lengths: { prep: 2, shoot: 3, wrap: 1, strike: 1, source: 'test' },
    weekendDays: [],
    holidays: new Set(),
    strips: [
      { id: 'a', shootDay: 1, sceneNumber: '1', setName: 'OFFICE' },
      { id: 'b', shootDay: 1, sceneNumber: '2', setName: 'OFFICE' },
      { id: 'c', shootDay: 3, sceneNumber: '5', setName: 'PARK' },
      { id: 'd', shootDay: 0, sceneNumber: '9', setName: 'TBD' },   // unscheduled
      { id: 'e', shootDay: 5, sceneNumber: '12', setName: 'ROOF' }, // beyond shoot:3 → extends the window
    ],
  });

  assert.equal(cal.anchor, '2026-06-24');
  assert.equal(cal.unscheduledScenes, 1);

  // Effective shoot length stretches to cover the highest board day (5), not just lengths.shoot (3).
  assert.deepEqual(cal.phases, {
    prep: 2, shoot: 3, wrap: 1, strike: 1, source: 'test',
    shootEffective: 5, weekendDays: [], holidays: [],
  });

  // PREP counted backward from the day before the anchor, then re-ordered ascending.
  const prep = cal.days.filter((d) => d.phase === 'PREP');
  assert.deepEqual(prep.map((d) => d.date), ['2026-06-22', '2026-06-23']);

  // SHOOT: day N lands on the Nth working day; strips attach to their day.
  assert.equal(row(cal.days, '2026-06-24').shootDay, 1);
  assert.equal(row(cal.days, '2026-06-24').sceneCount, 2);
  assert.deepEqual(row(cal.days, '2026-06-24').strips.map((s: any) => s.id), ['a', 'b']);
  assert.equal(row(cal.days, '2026-06-25').shootDay, 2);
  assert.equal(row(cal.days, '2026-06-25').sceneCount, 0);
  assert.equal(row(cal.days, '2026-06-26').shootDay, 3);
  assert.equal(row(cal.days, '2026-06-26').sceneCount, 1);
  assert.equal(row(cal.days, '2026-06-28').shootDay, 5);
  assert.equal(row(cal.days, '2026-06-28').sceneCount, 1);

  // WRAP then STRIKE follow the last shoot day.
  assert.equal(row(cal.days, '2026-06-29').phase, 'WRAP');
  assert.equal(row(cal.days, '2026-06-30').phase, 'STRIKE');

  // Whole calendar, in order: 2 prep + 5 shoot + 1 wrap + 1 strike.
  assert.equal(cal.days.length, 9);
  assert.deepEqual([...cal.days].map((d) => d.date), [...cal.days].map((d) => d.date).sort());
});

test('buildProjectCalendar inserts holiday day-off rows that do NOT consume shoot-day numbers', () => {
  const cal = buildProjectCalendar({
    anchor: '2026-06-24',
    lengths: { prep: 0, shoot: 2, wrap: 0, strike: 0, source: 'test' },
    weekendDays: [],
    holidays: ['2026-06-25'], // accepts array too
    strips: [
      { id: 'a', shootDay: 1, sceneNumber: '1', setName: 'A' },
      { id: 'b', shootDay: 2, sceneNumber: '2', setName: 'B' },
    ],
  });
  assert.equal(row(cal.days, '2026-06-24').shootDay, 1);
  const off = row(cal.days, '2026-06-25');
  assert.equal(off.shootDay, null);
  assert.equal(off.dayOff, true);
  assert.equal(off.label, 'Holiday');
  assert.equal(row(cal.days, '2026-06-26').shootDay, 2); // shoot day 2 jumps the holiday
  assert.equal(cal.days.length, 3);
});

test('buildProjectCalendar skips weekends as labelled day-off rows', () => {
  // Anchor Friday 2026-06-26; Sat/Sun off. (Weekday read is tz-stable for non-negative UTC offsets.)
  const cal = buildProjectCalendar({
    anchor: '2026-06-26',
    lengths: { prep: 0, shoot: 3, wrap: 0, strike: 0, source: 'test' },
    weekendDays: [6, 0],
    holidays: new Set(),
    strips: [],
  });
  assert.equal(row(cal.days, '2026-06-26').shootDay, 1);
  assert.equal(row(cal.days, '2026-06-27').label, 'Day off');
  assert.equal(row(cal.days, '2026-06-27').shootDay, null);
  assert.equal(row(cal.days, '2026-06-28').label, 'Day off');
  assert.equal(row(cal.days, '2026-06-29').shootDay, 2);
  assert.equal(row(cal.days, '2026-06-30').shootDay, 3);
});

test('buildProjectCalendar places every shoot day even with a long (6-day) weekend', () => {
  const cal = buildProjectCalendar({
    anchor: '2026-06-27', // Saturday — the only working day here
    lengths: { prep: 0, shoot: 100, wrap: 0, strike: 0, source: 'test' },
    weekendDays: [0, 1, 2, 3, 4, 5], // Sun–Fri off; only Saturday works
    holidays: new Set(),
    strips: [],
  });
  const shoot = cal.days.filter((d) => d.phase === 'SHOOT' && d.shootDay !== null);
  assert.equal(shoot.length, 100, 'all 100 shoot days placed, not truncated by the loop guard');
  assert.equal(cal.phases.shootEffective, 100);
  assert.equal(shoot[0].date, '2026-06-27');
  assert.equal(shoot[1].date, '2026-07-04'); // one week apart
});

test('buildProjectCalendar with every weekday off yields an empty calendar (no garbage day-off rows)', () => {
  const cal = buildProjectCalendar({
    anchor: '2026-06-24',
    lengths: { prep: 2, shoot: 3, wrap: 1, strike: 1, source: 'test' },
    weekendDays: [0, 1, 2, 3, 4, 5, 6], // no working days exist
    holidays: new Set(),
    strips: [],
  });
  assert.deepEqual(cal.days, []);
});

// ---------------------------------------------------------------------------
// shootDayForDate — reverse lookup (date → shoot-day number)
// ---------------------------------------------------------------------------
test('shootDayForDate counts working days from the anchor', () => {
  const cfg = { anchor: '2026-06-24', weekendDays: [], holidays: new Set<string>() };
  assert.equal(shootDayForDate({ ...cfg, date: '2026-06-24' }), 1);
  assert.equal(shootDayForDate({ ...cfg, date: '2026-06-26' }), 3);
  assert.equal(shootDayForDate({ ...cfg, date: '2026-06-23' }), null, 'before the anchor');
});

test('shootDayForDate returns null on a day off and does not count it', () => {
  const cfg = { anchor: '2026-06-24', weekendDays: [], holidays: ['2026-06-25'] };
  assert.equal(shootDayForDate({ ...cfg, date: '2026-06-25' }), null, 'the holiday itself');
  assert.equal(shootDayForDate({ ...cfg, date: '2026-06-26' }), 2, 'holiday not counted');
});

test('shootDayForDate returns null when no anchor is set', () => {
  assert.equal(shootDayForDate({ anchor: null, weekendDays: [], holidays: [], date: '2026-06-24' }), null);
});

test('shootDayForDate is bounded by the shoot window — wrap/strike dates map to no shoot day', () => {
  const cfg = { anchor: '2026-06-24', weekendDays: [], holidays: new Set<string>(), shootLen: 2 };
  assert.equal(shootDayForDate({ ...cfg, date: '2026-06-25' }), 2, 'last shoot day is in-window');
  assert.equal(shootDayForDate({ ...cfg, date: '2026-06-26' }), null, 'first day past the shoot window');
  // Without a shootLen the lookup stays unbounded (back-compat).
  assert.equal(shootDayForDate({ anchor: '2026-06-24', weekendDays: [], holidays: new Set(), date: '2026-06-26' }), 3);
});
