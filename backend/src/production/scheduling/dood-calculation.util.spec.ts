/**
 * Day-Out-of-Days engine — pure-logic unit tests (node:test + ts-node). Run: npm run test:unit
 * Characterizes the DOOD timeline: per element/cast row, classify every shoot day as
 * SW / W / WF / SWF / H (hold) / D (drop) / PU (pick-up) and roll up the totals.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildDoodMatrix } from './dood-calculation.util';

const rowOf = (m: any, name: string) => m.rows.find((r: any) => r.name === name);
const codes = (m: any, name: string) => {
  const r = rowOf(m, name);
  return m.days.map((d: any) => r.cells[d.day] ?? undefined);
};

test('buildDoodMatrix on empty input yields no rows and zeroed totals', () => {
  const m = buildDoodMatrix({ category: 'CAST', strips: [], elements: [] });
  assert.deepEqual(m.days, []);
  assert.deepEqual(m.rows, []);
  assert.deepEqual(m.totals, { elements: 0, workDays: 0, holdDays: 0, pickupDays: 0, shootDays: 0 });
  assert.equal(m.dropAfter, 4); // default
});

test('a single-day appearance is SWF (starts and finishes the same day)', () => {
  const m = buildDoodMatrix({
    category: 'CAST',
    strips: [{ id: 's1', shootDay: 1, cast: ['SOLO'] }],
    elements: [],
  });
  assert.deepEqual(codes(m, 'SOLO'), ['SWF']);
  const r = rowOf(m, 'SOLO');
  assert.equal(r.start, 1); assert.equal(r.finish, 1);
  assert.equal(r.totalWorkDays, 1);
  assert.equal(r.totalHoldDays, 0);
});

test('CAST legacy cast[] merges across strips into SW/W/WF with Hold for short gaps', () => {
  const m = buildDoodMatrix({
    category: 'CAST',
    strips: [
      { id: 's1', shootDay: 1, cast: ['ALICE', 'BOB'] },
      { id: 's2', shootDay: 2, cast: ['ALICE'] },
      { id: 's3', shootDay: 3, cast: ['BOB'] },
      { id: 's4', shootDay: 4, cast: ['ALICE', 'BOB'] },
    ],
    elements: [],
  });
  // ALICE works 1,2,4 → day 3 is a short (1-day) hold.
  assert.deepEqual(codes(m, 'ALICE'), ['SW', 'W', 'H', 'WF']);
  // BOB works 1,3,4 → day 2 is a short hold.
  assert.deepEqual(codes(m, 'BOB'), ['SW', 'H', 'W', 'WF']);
  // sorted by start then name; both start day 1.
  assert.deepEqual(m.rows.map((r: any) => r.name), ['ALICE', 'BOB']);
  assert.equal(rowOf(m, 'ALICE').quantity, 1); // cast entries default to quantity 1
  assert.deepEqual(m.totals, { elements: 2, workDays: 6, holdDays: 2, pickupDays: 0, shootDays: 4 });
});

test('a long idle stretch is Drop, and resuming work after a Drop is a Pick-up', () => {
  const m = buildDoodMatrix({
    category: 'CAST',
    dropAfter: 4,
    strips: [
      { id: 's1', shootDay: 1, cast: ['CARL'] },
      { id: 's2', shootDay: 2, cast: ['DAN'] },
      { id: 's3', shootDay: 3, cast: ['DAN'] },
      { id: 's4', shootDay: 4, cast: ['DAN'] },
      { id: 's5', shootDay: 5, cast: ['DAN'] },
      { id: 's6', shootDay: 6, cast: ['DAN'] },
      { id: 's7', shootDay: 7, cast: ['CARL'] },
      { id: 's8', shootDay: 8, cast: ['CARL'] },
    ],
    elements: [],
  });
  // CARL: day1 SW, days 2-6 a 5-day idle ≥ dropAfter → Drop, day7 resumes → Pick-up, day8 WF.
  assert.deepEqual(codes(m, 'CARL'), ['SW', 'D', 'D', 'D', 'D', 'D', 'PU', 'WF']);
  const carl = rowOf(m, 'CARL');
  assert.equal(carl.totalWorkDays, 3);
  assert.equal(carl.totalDropDays, 5);
  assert.equal(carl.totalPickupDays, 1);
  assert.equal(carl.totalHoldDays, 0);
  // DAN works the middle block; blanks before start and after finish.
  assert.deepEqual(codes(m, 'DAN'), ['', 'SW', 'W', 'W', 'W', 'WF', '', '']);
  assert.equal(m.totals.workDays, 8);
  assert.equal(m.totals.pickupDays, 1);
});

test('breakdown elements merge case-insensitively by name, taking max quantity, and ignore strip cast for non-CAST categories', () => {
  const m = buildDoodMatrix({
    category: 'vehicles', // lower-case is normalized
    strips: [
      { id: 's1', shootDay: 1, cast: ['SHOULD_BE_IGNORED'] },
      { id: 's2', shootDay: 2, cast: ['ALSO_IGNORED'] },
    ],
    elements: [
      { id: 'e1', name: 'Truck', quantity: 2, stripId: 's1' },
      { id: 'e2', name: 'truck', quantity: 3, stripId: 's2' }, // same name, different case → one row
    ],
    dateByDay: new Map<number, any>([[1, '2026-06-24'], [2, '2026-06-25']]),
  });
  assert.equal(m.category, 'VEHICLES');
  assert.deepEqual(m.rows.map((r: any) => r.name), ['Truck']); // cast not merged in for VEHICLES
  const truck = rowOf(m, 'Truck');
  assert.equal(truck.quantity, 3); // max(2,3)
  assert.deepEqual(truck.elementIds, ['e1', 'e2']);
  assert.deepEqual(codes(m, 'Truck'), ['SW', 'WF']);
  // day header carries the calendar dates from dateByDay
  assert.deepEqual(m.days, [{ day: 1, date: '2026-06-24' }, { day: 2, date: '2026-06-25' }]);
});

test('dropAfter is clamped to a floor of 2', () => {
  const base = { category: 'CAST', strips: [{ id: 's1', shootDay: 1, cast: ['X'] }], elements: [] };
  assert.equal(buildDoodMatrix({ ...base, dropAfter: 1 }).dropAfter, 2);
  assert.equal(buildDoodMatrix({ ...base, dropAfter: 6 }).dropAfter, 6);
  assert.equal(buildDoodMatrix(base).dropAfter, 4); // default
});
