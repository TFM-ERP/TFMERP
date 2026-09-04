import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { classifySteps, AGE_TOLERANCE_DAYS } from './age.util';
import { yearsToDays } from './era.util';

const y = yearsToDays;
/** Ages come back in days; the cases are written in years. */
const inYears = (r: Record<number, number | null>) => {
  const out: Record<number, number | null> = {};
  for (const k of Object.keys(r)) {
    const v = r[Number(k)];
    out[Number(k)] = v === null ? null : Math.round(v / 365.25);
  }
  return out;
};
const app = (pairs: [number, number][]) => pairs.map(([scene, yrs]) => ({ scene, era: y(yrs) }));
const stat = (o: Record<number, number>) => {
  const out: Record<number, number> = {};
  for (const k of Object.keys(o)) out[Number(k)] = y(o[Number(k)]);
  return out;
};

test('classifySteps consults the traveller flag and nothing else', () => {
  const a = app([[1, 0], [2, -20], [3, 0]]);
  assert.deepEqual(classifySteps(a, [], false), ['LIVED', 'LIVED']);
  assert.deepEqual(classifySteps(a, [], true), ['JUMP', 'AMBIGUOUS']);
  assert.deepEqual(classifySteps(a, [3], true), ['JUMP', 'JUMP']);
});

test('pending clears when he gets home, so ordinary years at home are ordinary again', () => {
  // home, jump back twenty years, jump home again, then live three years. Without the clearing,
  // he is still counted as displaced and that last ordinary step is refused as a possible return.
  const a = [
    { scene: 1, era: y(0) },
    { scene: 2, era: y(-20) },
    { scene: 3, era: y(0) },
    { scene: 4, era: y(3) },
  ];
  assert.deepEqual(classifySteps(a, [2, 3], true), ['JUMP', 'JUMP', 'LIVED']);
});

test('the age tolerance is one year, because a birthday inside the year is not drift', () => {
  assert.equal(AGE_TOLERANCE_DAYS, 366);
});

test('a stacked backward jump keeps the SHALLOWEST departure as the one still owed', () => {
  // Depart 0, jump to -30, jump deeper to -50, then step forward to -10. That last step is
  // ordinary years lived inside the excursion. Drop the Math.max and -10 is wrongly refused,
  // because the traveller would be measured against -50 instead of the 0 he actually left.
  const a = [
    { scene: 1, era: y(0) }, { scene: 2, era: y(-30) },
    { scene: 3, era: y(-50) }, { scene: 4, era: y(-10) },
  ];
  assert.deepEqual(classifySteps(a, [], true), ['JUMP', 'JUMP', 'LIVED']);
});

test('once he is home or past it he is no longer displaced, so later steps are ordinary', () => {
  const a = [
    { scene: 1, era: y(0) }, { scene: 2, era: y(-20) },
    { scene: 3, era: y(5) }, { scene: 4, era: y(10) }, { scene: 5, era: y(15) },
  ];
  assert.deepEqual(classifySteps(a, [2], true), ['JUMP', 'AMBIGUOUS', 'LIVED', 'LIVED']);
});

test('classifySteps refuses junk rather than throwing', () => {
  assert.deepEqual(classifySteps(null as any, [], true), []);
  assert.deepEqual(classifySteps(undefined as any, null as any, true), []);
  assert.deepEqual(classifySteps([{ scene: 1, era: 0 }], 5 as any, true), []);
  const a = [{ scene: 1, era: y(0) }, { scene: 2, era: y(-20) }];
  assert.deepEqual(classifySteps(a, 'nonsense' as any, true), ['JUMP']);
  assert.deepEqual(classifySteps(a, [], null as any), ['LIVED']);
});

import { ages } from './age.util';

test('1 non-traveller flashback, anchor first — age is a pure function of era', () => {
  const r = ages({ appearances: app([[3, -7], [5, 0], [9, -20], [12, 0]]), stated: stat({ 3: 27 }) });
  assert.deepEqual(inYears(r.ageByScene), { 3: 27, 5: 34, 9: 14, 12: 34 });
  assert.deepEqual(r.findings, []);
});

test('2 non-traveller, anchor in the middle — the walk runs backwards too', () => {
  const r = ages({ appearances: app([[5, 0], [9, -20], [12, 0]]), stated: stat({ 9: 14 }) });
  assert.deepEqual(inYears(r.ageByScene), { 5: 34, 9: 14, 12: 34 });
  assert.deepEqual(r.findings, []);
});

test('3 traveller, both jumps marked — a jump costs no life, so NOTHING fires', () => {
  const r = ages({ appearances: app([[5, 0], [9, -20], [12, 0]]), stated: stat({ 5: 34 }), traveller: true, jumpArrivals: [9, 12] });
  assert.deepEqual(inYears(r.ageByScene), { 5: 34, 9: 34, 12: 34 });
  assert.deepEqual(r.findings, []);
});

test('4 traveller who STAYS five years in the past ages five years', () => {
  const r = ages({ appearances: app([[5, 0], [9, -20], [10, -15], [12, 0]]), stated: stat({ 5: 34 }), traveller: true, jumpArrivals: [9, 12] });
  assert.deepEqual(inYears(r.ageByScene), { 5: 34, 9: 34, 10: 39, 12: 39 });
  assert.deepEqual(r.findings, []);
});

test('5 an unmarked return is refused, not accused', () => {
  const r = ages({ appearances: app([[5, 0], [9, -20], [12, 0]]), stated: stat({ 5: 34 }), traveller: true, jumpArrivals: [9] });
  assert.deepEqual(inYears(r.ageByScene), { 5: 34, 9: 34, 12: null });
  assert.deepEqual(r.findings, []);
});

test('9 home again, then ordinary years at home — pending must CLEAR on the return', () => {
  const r = ages({ appearances: app([[1, 0], [2, -20], [3, 0], [4, 3]]), stated: stat({ 1: 34 }), traveller: true, jumpArrivals: [2, 3] });
  assert.deepEqual(inYears(r.ageByScene), { 1: 34, 2: 34, 3: 34, 4: 37 });
  assert.deepEqual(r.findings, []);
});

test('10 a twenty-year saga with nobody travelling ages everyone correctly', () => {
  const r = ages({ appearances: app([[1, 0], [2, 10], [3, 20]]), stated: stat({ 1: 30 }) });
  assert.deepEqual(inYears(r.ageByScene), { 1: 30, 2: 40, 3: 50 });
  assert.deepEqual(r.findings, []);
});

test('11 two co-equal eras that agree — the Godfather II case raises nothing', () => {
  const r = ages({ appearances: app([[1, 0], [2, -40], [3, 0]]), stated: stat({ 1: 65, 2: 25 }) });
  assert.deepEqual(inYears(r.ageByScene), { 1: 65, 2: 25, 3: 65 });
  assert.deepEqual(r.findings, []);
});

test('12 two co-equal eras that disagree — ONE finding, and no cascade after it', () => {
  const r = ages({ appearances: app([[1, 0], [2, -40], [3, 0]]), stated: stat({ 1: 65, 2: 30 }) });
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].code, 'ERA_AGE_DRIFT');
  assert.equal(r.findings[0].scene, 2);
  assert.deepEqual(inYears(r.ageByScene), { 1: 65, 2: 30, 3: 70 });
});

test('14 a character nobody dated is never reported', () => {
  const r = ages({ appearances: app([[1, 0], [2, -7]]), stated: {} });
  assert.deepEqual(r.ageByScene, { 1: null, 2: null });
  assert.deepEqual(r.findings, []);
});

test('15 stranded, living forward through his own present, stays honest', () => {
  const r = ages({ appearances: app([[1, 0], [2, -20], [3, -10], [4, 0]]), stated: stat({ 1: 34 }), traveller: true, jumpArrivals: [2] });
  assert.deepEqual(inYears(r.ageByScene), { 1: 34, 2: 34, 3: 44, 4: null });
  assert.deepEqual(r.findings, []);
});

test('the tolerance is one year, so a birthday inside the year is not drift', () => {
  assert.equal(AGE_TOLERANCE_DAYS, 366);
  const r = ages({ appearances: app([[1, 0], [2, 10]]), stated: { 1: y(30), 2: y(40) + 300 } });
  assert.deepEqual(r.findings, []);
});

test('never throws on junk', () => {
  assert.deepEqual(ages({ appearances: [], stated: {} }).ageByScene, {});
  assert.deepEqual(ages(null as any).ageByScene, {});
  assert.deepEqual(ages({ appearances: null as any, stated: null as any }).findings, []);
});

test('a duplicate scene with a stated age is unreadable input, so it refuses and accuses nobody', () => {
  // Two appearances share scene 5 and the age is stated on it: we cannot tell which self it means.
  // Treating both as anchors of the same value reported 20 for a 40-year-old and raised a drift
  // finding against a script that stated exactly one number.
  const r = ages({ appearances: [{ scene: 5, era: y(0) }, { scene: 9, era: y(10) }, { scene: 5, era: y(20) }], stated: stat({ 5: 20 }) });
  assert.deepEqual(r.ageByAppearance, [null, null, null]);
  assert.deepEqual(r.findings, []);
  // With the anchor somewhere else, the two selves are still told apart, which is the whole claim.
  const ok = ages({ appearances: [{ scene: 5, era: y(0) }, { scene: 9, era: y(10) }, { scene: 5, era: y(20) }], stated: stat({ 9: 30 }) });
  assert.deepEqual(inYears({ 0: ok.ageByAppearance[0], 1: ok.ageByAppearance[1], 2: ok.ageByAppearance[2] }), { 0: 20, 1: 30, 2: 40 });
  assert.deepEqual(ok.findings, []);
});

test('an age no reading of the worldline can reach is impossible, however far past the ambiguity', () => {
  // He jumps back twenty years, returns unmarked (ambiguous), then lives five more. Only 39 or 59
  // are reachable, so both bound every reading; the old check only looked at the scene directly
  // after the ambiguous step and saw none of this.
  const mk = (d: number) => ages({
    appearances: [{ scene: 1, era: y(0) }, { scene: 2, era: y(-20) }, { scene: 3, era: y(0) }, { scene: 4, era: y(5) }],
    stated: stat({ 1: 34, 4: d }), traveller: true, jumpArrivals: [2],
  });
  assert.equal(mk(20).findings[0].code, 'ERA_AGE_IMPOSSIBLE');
  assert.equal(mk(200).findings[0].code, 'ERA_AGE_IMPOSSIBLE');
  assert.deepEqual(mk(39).findings, []);   // he jumped home
  assert.deepEqual(mk(59).findings, []);   // he lived the twenty years
  assert.deepEqual(mk(45).findings, []);   // between the two: not proven impossible, so not accused
});

test('one defect raises one finding, even when both impossibility checks refute it', () => {
  const r = ages({ appearances: [{ scene: 5, era: y(0) }, { scene: 9, era: y(-20) }, { scene: 12, era: y(0) }],
    stated: stat({ 5: 34, 12: 200 }), traveller: true, jumpArrivals: [9] });
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].code, 'ERA_AGE_IMPOSSIBLE');
});

test('every reading is bracketed, so a real one is never called impossible', () => {
  // Two ambiguous excursions of different length with a travelCost between their gaps: jump one and
  // live the other and the total lies OUTSIDE both uniform readings. Resolving all ambiguities the
  // same way accused two genuine readings of being impossible.
  const app = [
    { scene: 1, era: y(0) }, { scene: 2, era: y(-30) }, { scene: 3, era: y(0) },
    { scene: 4, era: y(-5) }, { scene: 5, era: y(10) }, { scene: 6, era: y(20) },
  ];
  const mk = (totalYears: number) => ages({
    appearances: app, stated: { 1: y(30), 6: y(30 + totalYears) },
    traveller: true, jumpArrivals: [2, 4], travelCost: y(20),
  });
  for (const achievable of [85, 90, 95, 100]) {
    assert.deepEqual(mk(achievable).findings, [], `${achievable} is a real reading and must not be accused`);
  }
  assert.equal(mk(60).findings[0].code, 'ERA_AGE_IMPOSSIBLE');
  assert.equal(mk(130).findings[0].code, 'ERA_AGE_IMPOSSIBLE');
});

test('6 a stated age at the arrival resolves it as a jump', () => {
  const r = ages({ appearances: app([[5, 0], [9, -20], [12, 0]]), stated: stat({ 5: 34, 12: 34 }), traveller: true, jumpArrivals: [9] });
  assert.deepEqual(inYears(r.ageByScene), { 5: 34, 9: 34, 12: 34 });
  assert.deepEqual(r.findings, []);
});

test('7 ...or as twenty years lived', () => {
  const r = ages({ appearances: app([[5, 0], [9, -20], [12, 0]]), stated: stat({ 5: 34, 12: 54 }), traveller: true, jumpArrivals: [9] });
  assert.deepEqual(inYears(r.ageByScene), { 5: 34, 9: 34, 12: 54 });
  assert.deepEqual(r.findings, []);
});

test('8 ...and an age fitting NEITHER reading is a real finding', () => {
  const r = ages({ appearances: app([[5, 0], [9, -20], [12, 0]]), stated: stat({ 5: 34, 12: 41 }), traveller: true, jumpArrivals: [9] });
  assert.deepEqual(inYears(r.ageByScene), { 5: 34, 9: 34, 12: 41 });
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].code, 'ERA_AGE_IMPOSSIBLE');
  assert.equal(r.findings[0].scene, 12);
});

test('13 a character in a scene set before he was born', () => {
  const r = ages({ appearances: app([[1, 0], [2, -40]]), stated: stat({ 1: 30 }) });
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].code, 'ERA_SELF_REFUTING');
  assert.equal(r.findings[0].scene, 2);
});

test('a traveller meeting himself is expressible — but a single stated age cannot say which self', () => {
  // Age is keyed by APPEARANCE, not by scene, so two entries for one character in one scene at two
  // personal ages are representable. What is NOT representable is a single stated age on that
  // shared scene: the script says "JASON, 34" and there are two Jasons in the room, one of whom is
  // fourteen. An earlier version made both appearances anchors of the same number, which reported
  // a wrong age for the second self and raised a drift finding nobody earned.
  const meeting = [
    { scene: 1, era: y(0) },
    { scene: 12, era: y(-20) },
    { scene: 12, era: y(-20) },
  ];
  const stated = ages({ appearances: meeting, stated: stat({ 1: 34, 12: 34 }), traveller: true, jumpArrivals: [12] });
  assert.deepEqual(stated.ageByAppearance, [y(34), null, null]);
  assert.deepEqual(stated.findings, []);

  // With the age stated away from the shared scene, both selves are carried independently — which
  // is the expressibility claim, and it holds.
  const anchored = ages({ appearances: meeting, stated: stat({ 1: 34 }), traveller: true, jumpArrivals: [12] });
  assert.equal(anchored.ageByAppearance.length, 3);
  assert.equal(inYears({ 0: anchored.ageByAppearance[1] })[0], 34);
  assert.equal(inYears({ 0: anchored.ageByAppearance[2] })[0], 34);
  assert.deepEqual(anchored.findings, []);   // v1 does not flag an undeclared duplicate
});

test('classifySteps drops a null entry and an entry with no usable scene or era — never throws', () => {
  // `scenes.map(s => sceneEra[s.id])` is exactly the shape that produces a null entry (no map hit)
  // or a NaN/null era (a scene the map has, but with no era of its own).
  const withHole = [
    { scene: 1, era: y(0) },
    null as any,
    { scene: 2, era: null as any },
    { scene: 3, era: NaN },
    { scene: 4, era: y(-20) },
  ];
  assert.doesNotThrow(() => classifySteps(withHole, [], true));
  // Once the holes are dropped, only scenes 1 and 4 remain — one step between them.
  assert.deepEqual(classifySteps(withHole, [], true), classifySteps([withHole[0], withHole[4]], [], true));
  // A non-numeric scene is dropped the same way, whatever its era.
  const badScene = [{ scene: 1, era: y(0) }, { scene: 'x' as any, era: y(-5) }, { scene: 2, era: y(-10) }];
  assert.deepEqual(classifySteps(badScene, [], true), classifySteps([badScene[0], badScene[2]], [], true));
});

test('an appearance with no era is not on the worldline — dropped, never mistaken for the present', () => {
  // A null entry, a missing era, a NaN era and a non-numeric scene must all be dropped before any
  // integration reaches them: none may throw, and none may be reported as though its era were 0
  // (the present) rather than simply absent.
  const withHoles = [
    { scene: 1, era: y(0) },        // kept — the first anchor
    null as any,                    // dropped: not even an object
    { scene: 2, era: null as any }, // dropped: no era — a scene with no era, spec §8
    { scene: 3, era: NaN },         // dropped: era did not come out finite
    { scene: 'x' as any, era: y(-20) }, // dropped: scene is not a usable number
    { scene: 4, era: y(-20) },      // kept — twenty years before scene 1
  ];
  let r: ReturnType<typeof ages>;
  assert.doesNotThrow(() => { r = ages({ appearances: withHoles, stated: stat({ 1: 34, 4: 14 }) }); });
  // ageByAppearance is positional and as long as the ORIGINAL appearances array, one entry per
  // index, so a caller's own indices into `appearances` still land on the right slot.
  assert.equal(r!.ageByAppearance.length, withHoles.length);
  assert.equal(r!.ageByAppearance[1], null);   // the null entry
  assert.equal(r!.ageByAppearance[2], null);   // no era
  assert.equal(r!.ageByAppearance[3], null);   // NaN era
  assert.equal(r!.ageByAppearance[4], null);   // non-numeric scene
  assert.equal(inYears({ 0: r!.ageByAppearance[0] })[0], 34);
  assert.equal(inYears({ 0: r!.ageByAppearance[5] })[0], 14);
  // ageByScene carries a null for a dropped appearance whose scene WAS a usable number (2 and 3),
  // never a value coerced from a null/NaN era treated as the present (0).
  assert.equal(r!.ageByScene[2], null);
  assert.equal(r!.ageByScene[3], null);
  assert.ok(!('x' in r!.ageByScene));
  assert.equal(inYears({ 0: r!.ageByScene[1] })[0], 34);
  assert.equal(inYears({ 0: r!.ageByScene[4] })[0], 14);
  // No finding accuses a dropped appearance of anything — it is not on the worldline to begin with.
  assert.deepEqual(r!.findings, []);
});
