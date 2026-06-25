import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toNoteCards, filterNotes, openCount, toChainStages, pickChainRequest, toDistribution, buildThread,
} from './scripton-room.logic.ts';

const NOW = new Date('2026-06-25T12:00:00Z').getTime();

test('toNoteCards maps annotations → cards with initials + status', () => {
  const cards = toNoteCards([
    { id: 'x1', author: 'Marcus Rao', sceneNumber: 14, body: 'Needs a beat.', resolved: false, createdAt: '2026-06-24T12:00:00Z' },
    { id: 'x2', createdBy: 'Lena Park', text: 'Merge days.', resolved: true },
    { id: 'x3' }, // no text -> dropped
  ], NOW);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].av, 'MR');
  assert.equal(cards[0].scene, 'Sc 14');
  assert.equal(cards[0].status, 'open');
  assert.match(cards[0].meta, /open · 1d/);
  assert.equal(cards[1].status, 'resolved');
});

test('filterNotes + openCount', () => {
  const notes = toNoteCards([
    { id: 'a', author: 'A', body: 'x', resolved: false },
    { id: 'b', author: 'B', body: 'y', resolved: true },
  ], NOW);
  assert.equal(openCount(notes), 1);
  assert.equal(filterNotes(notes, 'Open').length, 1);
  assert.equal(filterNotes(notes, 'Resolved').length, 1);
  assert.equal(filterNotes(notes, 'All').length, 2);
  assert.equal(filterNotes(notes, '@ me').length, 2); // advanced filters = all (honest)
});

test('toChainStages maps approval steps → ordered stages with state', () => {
  const stages = toChainStages({
    status: 'PENDING', currentStep: 1,
    steps: [
      { stepOrder: 0, approverRole: 'Producer', decidedByName: 'Lena', status: 'APPROVED' },
      { stepOrder: 1, approverRole: 'Director', decidedByName: null, status: 'PENDING' },
      { stepOrder: 2, approverRole: 'Legal', decidedByName: null, status: 'PENDING' },
    ],
  });
  assert.deepEqual(stages.map((s) => s.state), ['done', 'current', 'pending']);
  assert.equal(stages[0].by, 'Lena');
  assert.equal(stages[1].name, 'Director');
  // rejected
  const rej = toChainStages({ status: 'REJECTED', currentStep: 0, steps: [{ stepOrder: 0, approverRole: 'Producer', status: 'REJECTED' }] });
  assert.equal(rej[0].state, 'rejected');
  assert.deepEqual(toChainStages(null), []);
});

test('pickChainRequest prefers the selected note, then pending, then first', () => {
  const reqs = [
    { id: 'r1', status: 'APPROVED', entityId: 'other' },
    { id: 'r2', status: 'PENDING', entityId: 'noteX' },
  ];
  assert.equal(pickChainRequest(reqs, 'noteX').id, 'r2');     // by selected note
  assert.equal(pickChainRequest(reqs, 'none').id, 'r2');      // pending fallback
  assert.equal(pickChainRequest([{ id: 'r0', status: 'APPROVED' }]).id, 'r0'); // first
  assert.equal(pickChainRequest([]), null);
});

test('toDistribution maps exports → rows (viewed/sent); empty when none', () => {
  const rows = toDistribution([
    { copyId: 'C1', recipientName: 'Nadia', recipientRole: 'Legal', viewedAt: '2026-06-24T12:00:00Z' },
    { copyId: 'C2', recipient: { name: 'Vault', role: 'Distribution' }, createdAt: '2026-06-23T12:00:00Z' },
  ], NOW);
  assert.equal(rows[0].name, 'Nadia');
  assert.equal(rows[0].status, 'viewed');
  assert.equal(rows[0].watermarked, true);
  assert.equal(rows[1].name, 'Vault');
  assert.equal(rows[1].status, 'sent');
  assert.deepEqual(toDistribution([]), []);   // honest empty
  assert.deepEqual(toDistribution(null), []);
});

test('buildThread returns a single real bubble (replies are a stub)', () => {
  const [note] = toNoteCards([{ id: 'a', author: 'Marcus Rao · Director', sceneNumber: 14, body: 'Hi', resolved: false }], NOW);
  const th = buildThread(note);
  assert.ok(th);
  assert.equal(th!.badge, 'OPEN');
  assert.equal(th!.bubbles.length, 1);
  assert.equal(th!.bubbles[0].author, 'Marcus Rao'); // role split off
  assert.equal(buildThread(null), null);
});
