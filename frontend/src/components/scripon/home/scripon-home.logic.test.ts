// Pure-logic tests for the ScripON Home screen. Node's built-in runner on
// native TS (Node 24): `node --test src/components/scripon/home`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  greeting,
  firstNameOf,
  relTime,
  subLine,
  buildSlate,
  pickContinue,
  deriveCounts,
  toActivity,
} from './scripon-home.logic.ts';

test('greeting splits the day by hour', () => {
  assert.equal(greeting(new Date('2026-06-25T06:00:00')), 'Good morning');
  assert.equal(greeting(new Date('2026-06-25T11:59:00')), 'Good morning');
  assert.equal(greeting(new Date('2026-06-25T12:00:00')), 'Good afternoon');
  assert.equal(greeting(new Date('2026-06-25T17:59:00')), 'Good afternoon');
  assert.equal(greeting(new Date('2026-06-25T18:00:00')), 'Good evening');
  assert.equal(greeting(new Date('2026-06-25T23:30:00')), 'Good evening');
});

test('firstNameOf prefers preferredName, falls back gracefully', () => {
  assert.equal(firstNameOf({ fullName: 'Admin User' }), 'Admin');
  assert.equal(firstNameOf({ fullName: 'Admin User', preferredName: 'Maya Q' }), 'Maya');
  assert.equal(firstNameOf({ fullName: '' }), 'there');
  assert.equal(firstNameOf(null), 'there');
  assert.equal(firstNameOf(undefined), 'there');
});

test('relTime humanises against a fixed now', () => {
  const now = new Date('2026-06-25T12:00:00Z').getTime();
  assert.equal(relTime('2026-06-25T09:00:00Z', now), 'today');
  assert.equal(relTime('2026-06-24T09:00:00Z', now), '1d');
  assert.equal(relTime('2026-06-22T09:00:00Z', now), '3d');
  assert.equal(relTime('2026-06-10T09:00:00Z', now), '2w');
  assert.equal(relTime('', now), '');
  assert.equal(relTime(undefined, now), '');
});

test('subLine composes counts and omits rendering when kernel inert', () => {
  assert.equal(subLine({ active: 3, rendering: 1, notes: 2 }),
    '3 active scripts · 1 rendering · 2 notes need you');
  // kernel inert -> no rendering segment
  assert.equal(subLine({ active: 3, notes: 0 }),
    '3 active scripts · 0 notes need you');
  // singular vs plural
  assert.equal(subLine({ active: 1, notes: 1 }),
    '1 active script · 1 note needs you');
});

test('buildSlate maps + dedups dev over master and sorts by recency', () => {
  const now = new Date('2026-06-25T12:00:00Z').getTime();
  const master = [
    { id: 'm1', title: 'The Pulpit', genre: 'Feature', status: 'DRAFT', updatedAt: '2026-06-20T00:00:00Z', coverageRecommendation: 'CONSIDER', pageCount: 119 },
    { id: 'shared', title: 'Old Master Copy', genre: 'Feature', updatedAt: '2026-06-01T00:00:00Z' },
  ];
  const dev = [
    { id: 'shared', title: 'Antarah', kind: 'SCRIPT', updatedAt: '2026-06-25T09:00:00Z', revisions: [{ revisionLabel: 'BLUE', colorCode: '#5b8def' }] },
  ];
  const { cards } = buildSlate({ master, dev, now });
  // dev 'shared' wins over master 'shared' (one card per id)
  assert.equal(cards.filter((c) => c.id === 'shared').length, 1);
  assert.equal(cards.find((c) => c.id === 'shared')!.title, 'Antarah');
  // sorted by recency: Antarah (today) before The Pulpit (5d)
  assert.equal(cards[0].id, 'shared');
  assert.equal(cards[0].updated, 'today');
  const pulpit = cards.find((c) => c.id === 'm1')!;
  assert.equal(pulpit.grade, 'CONSIDER');
  assert.equal(pulpit.pages, '119 pp');
});

test('pickContinue returns the most-recent script or null', () => {
  const now = new Date('2026-06-25T12:00:00Z').getTime();
  const empty = buildSlate({ master: [], dev: [], now });
  assert.equal(pickContinue(empty), null);

  const slate = buildSlate({
    master: [{ id: 'm1', title: 'The Pulpit', genre: 'Feature', updatedAt: '2026-06-20T00:00:00Z', pageCount: 119 }],
    dev: [{ id: 'd1', title: 'Antarah', kind: 'SCRIPT', updatedAt: '2026-06-25T09:00:00Z', revisions: [{ revisionLabel: 'BLUE v2', colorCode: '#5b8def' }] }],
    now,
  });
  const hero = pickContinue(slate);
  assert.ok(hero);
  assert.equal(hero!.id, 'd1');
  assert.equal(hero!.title, 'Antarah');
  assert.match(hero!.eyebrow, /CONTINUE WHERE YOU LEFT OFF/);
  // version comes through; continuity is absent (kernel inert) -> undefined
  assert.equal(hero!.continuity, undefined);
});

test('deriveCounts hides rendering when kernel inert', () => {
  assert.deepEqual(deriveCounts({ scriptCount: 4, notesCount: 2, kernelInert: true }),
    { active: 4, notes: 2 });
  assert.deepEqual(deriveCounts({ scriptCount: 4, notesCount: 2, rendering: 1, kernelInert: false }),
    { active: 4, notes: 2, rendering: 1 });
});

test('toActivity types + sorts items and skips empty sources', () => {
  const now = new Date('2026-06-25T12:00:00Z').getTime();
  const items = toActivity({
    revisions: [
      { revisionLabel: 'BLUE v2', createdAt: '2026-06-25T08:00:00Z', colorCode: '#5b8def', scriptTitle: 'Antarah' },
      { revisionLabel: 'WHITE', createdAt: '2026-06-21T08:00:00Z', scriptTitle: 'The Pulpit' },
    ],
    coverage: [{ recommendation: 'CONSIDER', createdAt: '2026-06-24T08:00:00Z', title: 'Antarah' }],
    now,
  });
  // newest first
  assert.equal(items[0].when, 'today');
  assert.match(items[0].text, /BLUE v2/);
  // coverage item present and typed
  const cov = items.find((i) => i.kind === 'coverage');
  assert.ok(cov);
  assert.match(cov!.text, /CONSIDER/);
  // an entirely empty source set yields no items (never a broken widget)
  assert.deepEqual(toActivity({ revisions: [], coverage: [], now }), []);
});
