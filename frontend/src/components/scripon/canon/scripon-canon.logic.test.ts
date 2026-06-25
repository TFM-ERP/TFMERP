import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCanonAt, factsForTab, entityList, buildGraph, entityFacts, panelFacts, timelinePoints, type Fact,
} from './scripon-canon.logic.ts';

// Antarah-style canon: a rewrite-supersession (alliance enemy→ally, the old fact
// retired) AND a story-time change (status enslaved→freed, both ACTIVE).
const F: Fact[] = [
  { kind: 'RELATIONSHIP', subject: 'ANTARAH', predicate: 'loves', object: 'ABLA', statement: 'Antarah loves Abla.', validFrom: 5, validTo: null, recordedAt: 0 },
  { kind: 'RELATIONSHIP', subject: 'ANTARAH', predicate: 'alliance_with', object: 'AMALEKITES', statement: 'The Amalekites are enemies.', validFrom: 1, validTo: 30, status: 'SUPERSEDED', recordedAt: 4 },
  { kind: 'RELATIONSHIP', subject: 'ANTARAH', predicate: 'alliance_with', object: 'AMALEKITES', statement: 'Antarah allies with the Amalekites.', validFrom: 30, validTo: null, status: 'ACTIVE', recordedAt: 5 },
  { kind: 'CHARACTER', subject: 'ANTARAH', predicate: 'status', object: 'enslaved', statement: 'Antarah is enslaved.', validFrom: 1, validTo: 40, status: 'ACTIVE', recordedAt: 6 },
  { kind: 'CHARACTER', subject: 'ANTARAH', predicate: 'status', object: 'freed warrior', statement: 'Antarah is freed.', validFrom: 40, validTo: null, status: 'ACTIVE', recordedAt: 7 },
  { kind: 'WORLD', subject: 'ABS', predicate: 'is', object: 'desert tribe', statement: 'Abs is a tribe.', validFrom: 1, validTo: null, recordedAt: 8 },
];

test('resolveCanonAt honours the half-open window + supersession', () => {
  // At scene 10: enemy alliance + enslaved are live; ally/freed not yet.
  const at10 = resolveCanonAt(F, 10).filter((f) => f.subject === 'ANTARAH').map((f) => `${f.predicate}=${f.object}`).sort();
  assert.ok(at10.includes('alliance_with=AMALEKITES') || at10.includes('status=enslaved'));
  // SUPERSEDED rows are excluded → at 10 the alliance fact (SUPERSEDED) is NOT returned.
  assert.equal(resolveCanonAt(F, 10).some((f) => f.object === 'AMALEKITES'), false);
  // At scene 35: ally alliance is live (ACTIVE, validFrom 30).
  assert.equal(resolveCanonAt(F, 35).some((f) => f.predicate === 'alliance_with' && f.object === 'AMALEKITES'), true);
});

test('factsForTab filters by CanonKind', () => {
  assert.equal(factsForTab(F, 'Relationships').length, 3);
  assert.equal(factsForTab(F, 'Characters').length, 2);
  assert.equal(factsForTab(F, 'World').length, 1);
  assert.equal(factsForTab(F, 'Lore').length, 0);
});

test('entityList = distinct subjects by documentation', () => {
  const e = entityList(F);
  assert.equal(e[0].name, 'ANTARAH');
  assert.equal(e[0].count, 5);
  assert.ok(e.some((x) => x.name === 'ABS'));
});

test('buildGraph nodes + edges from RELATIONSHIP facts (SUPERSEDED dashed)', () => {
  const g = buildGraph(F);
  assert.deepEqual(g.nodes.map((n) => n.id).sort(), ['ABLA', 'AMALEKITES', 'ANTARAH']);
  assert.equal(g.edges.length, 3);
  const superseded = g.edges.filter((e) => e.superseded);
  assert.equal(superseded.length, 1);
  assert.equal(superseded[0].label, 'alliance with'); // humanised predicate
});

test('panelFacts flags superseded + new (superseding) facts', () => {
  const ant = entityFacts(F, 'ANTARAH');
  const pf = panelFacts(ant);
  assert.equal(pf.length, 5);
  assert.equal(pf.filter((f) => f.superseded).length, 1);     // the retired enemy alliance
  assert.equal(pf.filter((f) => f.isNew).length, 1);          // the ally fact (supersedes a retired one)
});

test('timelinePoints lists change scenes with transition captions', () => {
  const tl = timelinePoints(entityFacts(F, 'ANTARAH'));
  assert.deepEqual(tl.map((p) => p.at), [1, 5, 30, 40]);
  // the S30 point references the alliance
  const s30 = tl.find((p) => p.at === 30);
  assert.match(s30!.caption, /AMALEKITES/);
  // S40 shows enslaved → freed
  const s40 = tl.find((p) => p.at === 40);
  assert.match(s40!.caption, /enslaved → freed warrior/);
});
