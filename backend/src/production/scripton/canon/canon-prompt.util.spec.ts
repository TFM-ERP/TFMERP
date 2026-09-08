import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { canonSystemPrompt, SOURCE_CANON_SYSTEM, CANON_FACT_CAP, CANON_MAX_SOURCE_CHARS, CANON_EXTRACTOR_VERSION, SOURCE_CANON_MAXTOK } from './canon-prompt.util';
import { DEFAULT_FLOORS, selectCanonByQuota } from './canon-quota.util';
import type { CanonFactCore, CanonKind } from './canon.types';

/**
 * THE PROMPT AND THE ALLOCATOR MUST COUNT THE SAME POPULATION.
 *
 * The prompt said "At most 60 facts" while selectCanonByQuota budgeted 60 EXCLUDING prohibitions.
 * Two numbers, one word, different meanings — so the model was told to fit its rules inside a budget
 * the code had already exempted them from, and neither could be checked against the other. The cap
 * now names its population in both places, and these tests fail if they drift apart.
 */

const numbersIn = (s: string): number[] => (s.match(/\b\d+\b/g) || []).map(Number);

test('THE BOUNDARY IS STATED: the cap says it excludes prohibitions', () => {
  assert.match(SOURCE_CANON_SYSTEM, /NOT COUNTING PROHIBITIONS/,
    'a bare "at most N facts" leaves the model and the allocator counting different things');
  assert.match(SOURCE_CANON_SYSTEM, /return EVERY/i);
  assert.match(SOURCE_CANON_SYSTEM, /never part of this budget/);
});

test('the prompt states the cap the allocator actually uses', () => {
  assert.ok(SOURCE_CANON_SYSTEM.includes('At most ' + CANON_FACT_CAP + ' facts'),
    'the prompt must quote CANON_FACT_CAP, not a number typed beside it');
  // and the allocator's default budget is that same number
  const many = (kind: CanonKind, n: number): CanonFactCore[] => Array.from({ length: n }, (_, i) => ({
    kind, subject: 'S' + i, predicate: 'p', object: 'o', statement: kind + ' ' + i, validFrom: 0, validTo: null, status: 'ACTIVE',
  }));
  const r = selectCanonByQuota(many('CHARACTER', CANON_FACT_CAP + 40));
  assert.equal(r.facts.length, CANON_FACT_CAP, 'the allocator budgets exactly what the prompt asks for');
});

test('THE FLOORS IN THE PROMPT ARE THE FLOORS IN THE CODE', () => {
  // They were 4/3/4/3/3 in the prompt and 6/5/6/5/5 in the allocator — two sets of numbers for one
  // idea, so raising one silently left the other behind.
  const line = SOURCE_CANON_SYSTEM.split('\n').find((l) => /Aim for at least/.test(l)) || '';
  assert.ok(line, 'the prompt must state its floors');
  const stated = numbersIn(line);
  const code = [DEFAULT_FLOORS.ROLE, DEFAULT_FLOORS.CRIME, DEFAULT_FLOORS.CAUSATION, DEFAULT_FLOORS.OUTCOME, DEFAULT_FLOORS.ORDERING];
  assert.deepEqual(stated, code, 'prompt says ' + stated.join('/') + ', code says ' + code.join('/'));
});

test('the cap is parameterised, so it can be A/B tested rather than edited by hand', () => {
  assert.match(canonSystemPrompt(60), /At most 60 facts/);
  assert.match(canonSystemPrompt(120), /At most 120 facts/);
  assert.equal(canonSystemPrompt(CANON_FACT_CAP), SOURCE_CANON_SYSTEM, 'the shipped prompt is the default of the same function');
});

test('the cap is 120 — A/B measured, not chosen', () => {
  // cap 60 -> 72 facts, 19 prohibitions.  cap 120 -> 145 facts, 44 prohibitions.
  // The yield tracks the cap; it is the anchor, not a limit the model ignores.
  assert.equal(CANON_FACT_CAP, 120);
});

test('the ceiling still clears the measured output', () => {
  // cap=120 produced 18,604 output tokens on the real bible; the ceiling must sit above it with room.
  assert.ok(SOURCE_CANON_MAXTOK >= 24000, 'a cap of ' + CANON_FACT_CAP + ' needs headroom: ' + SOURCE_CANON_MAXTOK);
});

test('the source bound and extractor version are stated, and the version moved when the read did', () => {
  assert.equal(CANON_MAX_SOURCE_CHARS, 400000);
  assert.ok(CANON_EXTRACTOR_VERSION >= 2, 'v1 read a 60,000-character head slice and must never be served again');
});
