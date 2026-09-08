import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { selectForStage } from './canon-select.util';
import type { CanonFactCore, CanonKind } from './canon.types';

/**
 * THE RECORD AND THE STAGE BLOCK ARE DIFFERENT BUDGETS. At a cap of 120 the canon block reached
 * 26,651 bytes, riding all eight ladder stages and then every scene call. The record should hold
 * everything the source states; a stage prompt cannot. One number governing both meant the cost of
 * a complete record was paid on every call.
 */

const f = (kind: CanonKind, statement: string, section: string | null): CanonFactCore => ({
  kind, subject: 'S', predicate: 'p', object: 'o', statement,
  validFrom: 0, validTo: null, status: 'ACTIVE', sourceSection: section,
} as CanonFactCore);

const many = (kind: CanonKind, n: number, section: string) =>
  Array.from({ length: n }, (_, i) => f(kind, kind + ' ' + section + ' ' + i + ' ' + 'x'.repeat(60), section));

test('THE GUARANTEE HOLDS HERE TOO: rules are never trimmed to fit a stage budget', () => {
  const sel = selectForStage(
    [...many('CHARACTER', 200, '§1'), ...many('PROHIBITION', 92, '§29'), ...many('ORDERING', 20, '§24')],
    { budgetChars: 500 },   // far too small on purpose
  );
  assert.equal(sel.byKind.PROHIBITION.sent, 92, 'a budget that cannot fit the rules is too small, not a reason to drop them');
  assert.equal(sel.byKind.ORDERING.sent, 20);
  assert.ok(sel.byKind.CHARACTER.sent < 200, 'and the droppable kinds are the ones the budget governs');
});

test('ROUTED BY SECTION: every section is represented before any is represented twice', () => {
  const sel = selectForStage(
    [...many('CAUSATION', 10, '§5'), ...many('OUTCOME', 10, '§25'), ...many('ROLE', 10, '§31')],
    { budgetChars: 900 },
  );
  const sections = new Set(sel.facts.map((x: any) => x.sourceSection));
  assert.equal(sections.size, 3, 'a first-N selector would have taken §5 only: ' + Array.from(sections).join(', '));
});

test('it does NOT rank prohibitions by consequence — there is no validated order to rank by', () => {
  // The only ordering used is the document's own structure. Same input, same output, every time.
  const input = [...many('PROHIBITION', 5, '§29'), ...many('CHARACTER', 40, '§1')];
  const a = selectForStage(input, { budgetChars: 1200 });
  const b = selectForStage(input, { budgetChars: 1200 });
  assert.deepEqual(a.facts.map((x) => x.statement), b.facts.map((x) => x.statement));
});

test('THE ACCOUNT: it says what it sent, by kind, of how many exist', () => {
  const sel = selectForStage([...many('PROHIBITION', 92, '§29'), ...many('CHARACTER', 100, '§1')], { budgetChars: 1500 });
  assert.match(sel.note, /CANON SENT: \d+ of 192 facts/);
  assert.match(sel.note, /PROHIBITION all 92/, 'rules are complete, and the note says so');
  assert.match(sel.note, /CHARACTER \d+ of 100/);
  assert.equal(sel.complete, false);
});

test('a block that carried everything says COMPLETE rather than listing counts', () => {
  const sel = selectForStage(many('ROLE', 3, '§2'), { budgetChars: 100000 });
  assert.equal(sel.complete, true);
  assert.match(sel.note, /\(complete\)/);
  assert.equal(sel.sent, 3);
});

test('the budget is actually respected for the droppable kinds', () => {
  const sel = selectForStage(many('CHARACTER', 500, '§1'), { budgetChars: 2000 });
  const used = sel.facts.reduce((n, x) => n + String(x.statement).length + String(x.subject).length + 6, 0);
  assert.ok(used <= 2000, 'used ' + used);
  assert.ok(sel.sent > 0 && sel.sent < 500);
});

test('unplaced facts still take part — a locator miss must not exclude a fact from the prompt', () => {
  const sel = selectForStage([f('ROLE', 'x'.repeat(50), null), ...many('CHARACTER', 20, '§1')], { budgetChars: 3000 });
  assert.equal(sel.byKind.ROLE.sent, 1, 'sourceSection null is a reporting gap, not a reason to withhold');
});

test('junk in does not throw — this runs on every stage prompt', () => {
  for (const bad of [null, undefined, 42, {}, [null]]) {
    assert.doesNotThrow(() => selectForStage(bad as any));
  }
  assert.equal(selectForStage(null as any).sent, 0);
  assert.equal(selectForStage([]).complete, true);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE DEFECT THE A/B CAUGHT, PINNED.
//
// The budget first governed the WHOLE block. On the real bible the undroppable set alone is 12,746
// bytes against a 12,000 budget, so it consumed everything and ROLE, CRIME, CAUSATION and OUTCOME
// each got ZERO — "who the antagonist is" left the stage prompt entirely, and only an A/B against
// the named sentences showed it. A mandatory set inside a budget lets the budget silently decide
// how much of the rest survives.

test('THE STARVATION CASE: a large undroppable set must not consume the structural facts', () => {
  // proportions from the real extraction: 81 PROHIBITION + 21 ORDERING against the rest
  const sel = selectForStage([
    ...many('PROHIBITION', 81, '§29'), ...many('ORDERING', 21, '§24'),
    ...many('ROLE', 17, '§2'), ...many('CRIME', 13, '§5'), ...many('CAUSATION', 19, '§8'), ...many('OUTCOME', 20, '§25'),
  ]);
  for (const k of ['ROLE', 'CRIME', 'CAUSATION', 'OUTCOME']) {
    assert.ok(sel.byKind[k].sent > 0, k + ' got nothing — the rules ate the budget');
  }
  assert.equal(sel.byKind.PROHIBITION.sent, 81, 'and the rules are still whole');
  assert.equal(sel.byKind.ORDERING.sent, 21);
});

test('the budget governs the DROPPABLE portion, not the total', () => {
  const rules = many('PROHIBITION', 60, '§29');
  const withRules = selectForStage([...rules, ...many('CHARACTER', 50, '§1')], { budgetChars: 2000 });
  const without = selectForStage(many('CHARACTER', 50, '§1'), { budgetChars: 2000 });
  assert.equal(withRules.byKind.CHARACTER.sent, without.byKind.CHARACTER.sent,
    'adding rules must not reduce how much else rides');
});
