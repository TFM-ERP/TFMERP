import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  normaliseForm, createRegistry, registerEntity, addAlias, renameEntity, mergeEntities,
  resolveEntity, livingId, nameAt, allForms,
  isLegalLifeTransition, closeSupersededFacts, stateAt,
  checkLifeTransitions, checkStateContradictions, checkRediscovery, checkUnresolved,
  checkIdentityHygiene, ledgerFindingInstruction, auditLedger,
  isTransitPlace, slugSaysContinuous, checkPlaceJumps,
  type StateFact, type PlaceObservation,
} from './entity-registry.util';

// Every fixture is drawn from the delivered 1 Sep "Jason Quick" white draft
// (RPC-IYC0O0-1C71F8, 103 pages, 139 scenes), quoted from the PDF.

// ─────────────────────────────────────────────────────────────────────────────
// IDENTITY
// ─────────────────────────────────────────────────────────────────────────────

test('normaliseForm strips everything a cue or a sentence puts around a name', () => {
  assert.equal(normaliseForm("JASON (CONT'D)"), 'JASON');
  assert.equal(normaliseForm('MOIRA (O.S.)'), 'MOIRA');
  assert.equal(normaliseForm('Mr. Halloran?'), 'HALLORAN');
  assert.equal(normaliseForm("Gideon Vale's office"), 'GIDEON VALE OFFICE');
  assert.equal(normaliseForm('  gideon   vale  '), 'GIDEON VALE');
  assert.equal(normaliseForm(null), '');
});

test('an id is assigned once and survives every later change to the name', () => {
  const reg = createRegistry();
  const father = registerEntity(reg, 'PERSON', 'Alexander Quick');
  assert.ok(father);
  // The rename a writer makes in draft four.
  assert.equal(renameEntity(reg, father, 'Richard Quick', 0), true);
  assert.equal(resolveEntity(reg, 'RICHARD QUICK'), father, 'the new name resolves to the same id');
  assert.equal(nameAt(reg, father, 0), 'RICHARD QUICK');
  assert.equal(resolveEntity(reg, 'ALEXANDER QUICK'), '', 'the retired name is out of force');
  assert.ok(allForms(reg, father).indexOf('ALEXANDER QUICK') >= 0, 'but it is never forgotten');
});

test('a rename mid-script leaves the scenes before it alone', () => {
  const reg = createRegistry();
  const id = registerEntity(reg, 'VESSEL', 'The Mercy');
  renameEntity(reg, id, 'The Cormorant', 90);          // renamed from scene 90 onward
  assert.equal(resolveEntity(reg, 'THE MERCY', 83), id, 'scene 83 still means the Mercy');
  assert.equal(resolveEntity(reg, 'THE MERCY', 120), '', 'and after the rename it does not');
  assert.equal(resolveEntity(reg, 'THE CORMORANT', 120), id);
  assert.equal(nameAt(reg, id, 83), 'THE MERCY');
  assert.equal(nameAt(reg, id, 120), 'THE CORMORANT');
});

test('a merge tombstones the loser and never breaks a stale reference', () => {
  const reg = createRegistry();
  // Scenes 68-70 rescue Eliot Parr. Scene 88 protects Neil Pryor. One witness.
  const parr = registerEntity(reg, 'PERSON', 'Eliot Parr');
  const pryor = registerEntity(reg, 'PERSON', 'Neil Pryor');
  assert.notEqual(parr, pryor);
  assert.equal(mergeEntities(reg, pryor, parr), true);
  assert.equal(livingId(reg, pryor), parr, 'the retired id still resolves onward, forever');
  assert.equal(resolveEntity(reg, 'NEIL PRYOR'), parr);
  assert.equal(resolveEntity(reg, 'ELIOT PARR'), parr);
  assert.ok(reg.entities.has(pryor), 'and it is never deleted');
});

test('a name that means two people resolves to neither', () => {
  const reg = createRegistry();
  // Scene 54: "BRANCH MANAGER REYES — early forties, over-pressed".
  // Scene 89 onward: "INT. FEDERAL BUILDING — AUSA REYES' OFFICE".
  const manager = registerEntity(reg, 'PERSON', 'Reyes');
  const ausa = registerEntity(reg, 'PERSON', 'Reyes');
  assert.equal(manager, ausa, 'the same form registers once — the collision is invisible at write time');

  const reg2 = createRegistry();
  const a = registerEntity(reg2, 'PERSON', 'Renata Okonjo');
  const b = registerEntity(reg2, 'PERSON', 'Branch Manager Reyes');
  addAlias(reg2, a, 'Reyes');
  addAlias(reg2, b, 'Reyes');
  assert.equal(resolveEntity(reg2, 'REYES'), '', 'ambiguous — the resolver refuses rather than guessing');
  const findings = checkIdentityHygiene(reg2);
  assert.equal(findings.filter((f) => f.kind === 'AMBIGUOUS_NAME').length, 1);
});

test('the resolver never guesses — which is the lesson "Vale Man" taught', () => {
  const reg = createRegistry();
  registerEntity(reg, 'ORG', 'Vale Meridian');
  assert.equal(resolveEntity(reg, 'VALE MAN'), '', 'an unregistered form resolves to nothing at all');
});

// ─────────────────────────────────────────────────────────────────────────────
// LIFE STATE
// ─────────────────────────────────────────────────────────────────────────────

test('the transition table permits this film and forbids the contradiction', () => {
  // Jason is thrown off a trawler at scene 23 and recovered at 25. Legally dead until 118.
  assert.equal(isLegalLifeTransition('ALIVE', 'PRESUMED_DEAD'), true);
  assert.equal(isLegalLifeTransition('PRESUMED_DEAD', 'ALIVE'), true, 'the premise of the entire screenplay');
  assert.equal(isLegalLifeTransition('ALIVE', 'DEAD'), true);
  assert.equal(isLegalLifeTransition('DEAD', 'ALIVE'), false);
  assert.equal(isLegalLifeTransition('DEAD', 'PRESUMED_DEAD'), false);
  assert.equal(isLegalLifeTransition('DEAD', 'DEAD'), true);
});

test('THE FATHER: ash in a cemetery at 89, dinner on Sunday at 83, walking at 127', () => {
  const reg = createRegistry();
  const father = registerEntity(reg, 'PERSON', 'Alexander Quick');
  const facts: StateFact[] = [
    { entityId: father, dimension: 'life', value: 'ALIVE', validFrom: 83, validTo: null, sourceScene: 83,
      statement: 'Alexander asked me to dinner. Sunday.' },
    { entityId: father, dimension: 'life', value: 'DEAD', validFrom: 89, validTo: null, sourceScene: 89,
      statement: "He's ash in a Boston cemetery." },
    { entityId: father, dimension: 'life', value: 'ALIVE', validFrom: 127, validTo: null, sourceScene: 127,
      statement: 'Alexander walks. You know that.' },
  ];
  const found = checkLifeTransitions(closeSupersededFacts(facts), reg);
  assert.equal(found.length, 1, 'ALIVE->DEAD is fine; DEAD->ALIVE is the defect');
  assert.equal(found[0].kind, 'LIFE_TRANSITION');
  assert.deepEqual(found[0].scenes, [89, 127]);
  assert.match(found[0].detail, /ALEXANDER QUICK/);
  assert.match(found[0].detail, /ash in a Boston cemetery/);
  assert.match(ledgerFindingInstruction(found[0]), /PRESUMED_DEAD, not DEAD/);
});

test('and the same three facts under one honest reading produce nothing', () => {
  const reg = createRegistry();
  const father = registerEntity(reg, 'PERSON', 'Alexander Quick');
  const facts: StateFact[] = [
    { entityId: father, dimension: 'life', value: 'ALIVE', validFrom: 83, validTo: null, sourceScene: 83 },
    { entityId: father, dimension: 'life', value: 'PRESUMED_DEAD', validFrom: 89, validTo: null, sourceScene: 89 },
    { entityId: father, dimension: 'life', value: 'ALIVE', validFrom: 127, validTo: null, sourceScene: 127 },
  ];
  assert.deepEqual(checkLifeTransitions(closeSupersededFacts(facts), reg), []);
});

test('Callum dies once and stays dead — and the check does not fire on the scene that kills him', () => {
  const reg = createRegistry();
  const callum = registerEntity(reg, 'PERSON', 'Callum MacRae');
  const facts: StateFact[] = [
    { entityId: callum, dimension: 'life', value: 'ALIVE', validFrom: 0, validTo: null, sourceScene: 1 },
    { entityId: callum, dimension: 'life', value: 'DEAD', validFrom: 31, validTo: null, sourceScene: 31 },
  ];
  assert.deepEqual(checkLifeTransitions(closeSupersededFacts(facts), reg), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// THE WINDOW-CLOSING FIX
// ─────────────────────────────────────────────────────────────────────────────

test('closeSupersededFacts is what canon-verify.util.ts asks for in its own header', () => {
  // "facts are stored open-ended (validTo: null), so two same-subject+predicate facts with
  //  different objects always overlap … the detector cannot distinguish death from resurrection."
  const facts: StateFact[] = [
    { entityId: 'p1', dimension: 'life', value: 'ALIVE', validFrom: 12, validTo: null },
    { entityId: 'p1', dimension: 'life', value: 'DEAD', validFrom: 30, validTo: null },
  ];
  const closed = closeSupersededFacts(facts);
  assert.equal(closed[0].validTo, 30, 'the earlier window now closes where the later one opens');
  assert.equal(closed[1].validTo, null);
  assert.equal(stateAt(closed, 20)[0].value, 'ALIVE');
  assert.equal(stateAt(closed, 40)[0].value, 'DEAD');
  assert.deepEqual(checkStateContradictions(closed), [], 'a legitimate state change is no longer a conflict');
});

test('closeSupersededFacts does not fragment one continuous state', () => {
  const facts: StateFact[] = [
    { entityId: 'p1', dimension: 'place', value: 'SKERRY ISLAND', validFrom: 1, validTo: null },
    { entityId: 'p1', dimension: 'place', value: 'SKERRY ISLAND', validFrom: 5, validTo: null },
  ];
  assert.equal(closeSupersededFacts(facts)[0].validTo, null);
});

test('a contradiction is two windows open at once, not a state changing', () => {
  const reg = createRegistry();
  const stamp = registerEntity(reg, 'OBJECT', 'Quick Maritime manifest stamp');
  // Scene 76: "QUICK MARITIME GROUP. 1997."   Scene 79: "Nineteen ninety-four."
  const facts: StateFact[] = [
    { entityId: stamp, dimension: 'physical', value: 'DIE YEAR 1997', validFrom: 76, validTo: null, sourceScene: 76,
      immutable: true, statement: 'QUICK MARITIME GROUP. 1997.' },
    { entityId: stamp, dimension: 'physical', value: 'DIE YEAR 1994', validFrom: 79, validTo: null, sourceScene: 79,
      immutable: true, statement: 'Nineteen ninety-four.' },
  ];
  const found = checkStateContradictions(facts, reg);
  assert.equal(found.length, 1);
  assert.equal(found[0].kind, 'STATE_CONTRADICTION');
  assert.match(found[0].detail, /1997/);
  assert.match(found[0].detail, /1994/);
  assert.match(found[0].detail, /does not change/);

  // The same two values on a MUTABLE dimension are a state change, not a contradiction.
  const mutable = facts.map((f) => ({ ...f, immutable: false }));
  assert.deepEqual(checkStateContradictions(closeSupersededFacts(mutable), reg), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE, PROMISES, CUES
// ─────────────────────────────────────────────────────────────────────────────

test('a discovery cannot be made twice', () => {
  const reg = createRegistry();
  const sophie = registerEntity(reg, 'PERSON', 'Sophie Quick');
  const facts: StateFact[] = [
    { entityId: sophie, dimension: 'knows', value: 'FATHER BUILT THE NETWORK', validFrom: 82, validTo: null, sourceScene: 82 },
    { entityId: sophie, dimension: 'knows', value: 'FATHER BUILT THE NETWORK', validFrom: 99, validTo: null, sourceScene: 99 },
  ];
  const found = checkRediscovery(facts, reg);
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].scenes, [82, 99]);
  assert.match(ledgerFindingInstruction(found[0]), /acts on the knowledge rather than acquiring it/);
});

test('THE MERCY: named once with a sailing day, then never again', () => {
  const reg = createRegistry();
  const mercy = registerEntity(reg, 'VESSEL', 'The Mercy');
  const facts: StateFact[] = [
    { entityId: mercy, dimension: 'open', value: 'SAILS THURSDAY', validFrom: 83, validTo: null, sourceScene: 83,
      statement: 'The Mercy sails Thursday.' },
  ];
  const found = checkUnresolved(facts, 139, reg);
  assert.equal(found.length, 1);
  assert.equal(found[0].kind, 'UNRESOLVED');
  assert.match(found[0].detail, /THE MERCY/);
  assert.match(found[0].detail, /never discharged/);
  // Paid off, or deliberately carried, and it goes quiet.
  assert.deepEqual(checkUnresolved([{ ...facts[0], validTo: 130 }], 139, reg), []);
  assert.deepEqual(checkUnresolved(facts, 139, reg, [mercy]), [], 'a sequel hook is a decision, not a defect');
});

test('one antagonist speaking under three cues is reported once', () => {
  const reg = createRegistry();
  const vale = registerEntity(reg, 'PERSON', 'Gideon Vale');
  addAlias(reg, vale, 'Vale');
  addAlias(reg, vale, 'Gideon');
  const cues = new Map<string, number>([['GIDEON VALE', 9], ['VALE', 12], ['GIDEON', 8]]);
  const found = checkIdentityHygiene(reg, cues).filter((f) => f.kind === 'SPLIT_IDENTITY');
  assert.equal(found.length, 1);
  assert.match(found[0].detail, /VALE \(12\)/);
  assert.match(found[0].detail, /three|3/i);
});

test('an alias nobody speaks under is not a split identity', () => {
  const reg = createRegistry();
  const vale = registerEntity(reg, 'PERSON', 'Gideon Vale');
  addAlias(reg, vale, 'Vale');
  const cues = new Map<string, number>([['GIDEON VALE', 29], ['VALE', 0]]);
  assert.deepEqual(checkIdentityHygiene(reg, cues).filter((f) => f.kind === 'SPLIT_IDENTITY'), []);
});

test('a rename is not a split identity — that is the whole point of renaming', () => {
  const reg = createRegistry();
  const id = registerEntity(reg, 'PERSON', 'Alexander Quick');
  renameEntity(reg, id, 'Richard Quick', 0);
  const cues = new Map<string, number>([['ALEXANDER QUICK', 0], ['RICHARD QUICK', 14]]);
  assert.deepEqual(checkIdentityHygiene(reg, cues).filter((f) => f.kind === 'SPLIT_IDENTITY'), []);
});

test('auditLedger runs every check and orders the father finding first', () => {
  const reg = createRegistry();
  const father = registerEntity(reg, 'PERSON', 'Alexander Quick');
  const mercy = registerEntity(reg, 'VESSEL', 'The Mercy');
  const facts: StateFact[] = [
    { entityId: father, dimension: 'life', value: 'DEAD', validFrom: 89, validTo: null, sourceScene: 89 },
    { entityId: father, dimension: 'life', value: 'ALIVE', validFrom: 127, validTo: null, sourceScene: 127 },
    { entityId: mercy, dimension: 'open', value: 'SAILS THURSDAY', validFrom: 83, validTo: null, sourceScene: 83 },
  ];
  const found = auditLedger(reg, facts, 139);
  assert.equal(found.length, 2);
  assert.equal(found[0].kind, 'LIFE_TRANSITION');
  assert.equal(found[1].kind, 'UNRESOLVED');
});

test('every check is fail-safe on junk', () => {
  const reg = createRegistry();
  assert.deepEqual(checkLifeTransitions(null as any), []);
  assert.deepEqual(checkStateContradictions(undefined as any), []);
  assert.deepEqual(checkRediscovery([] as any), []);
  assert.deepEqual(checkUnresolved(null as any, 10), []);
  assert.deepEqual(closeSupersededFacts(null as any), []);
  assert.deepEqual(auditLedger(reg, null as any, 0), []);
  assert.equal(resolveEntity(reg, undefined), '');
  assert.equal(nameAt(reg, 'nope'), '');
  assert.equal(mergeEntities(reg, 'a', 'b'), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// GEOGRAPHY
// ─────────────────────────────────────────────────────────────────────────────

test('isTransitPlace is deliberately narrow — a container terminal is a workplace', () => {
  assert.equal(isTransitPlace('EXT. FERRY SLIP, SKERRY ISLAND'), true);
  assert.equal(isTransitPlace('INT. LOGAN AIRPORT — DEPARTURES'), true);
  assert.equal(isTransitPlace('INT. CAR - MOVING'), true);
  // Scene 39 of the draft. Reads as travel, is not: treating it as one would suppress a real finding.
  assert.equal(isTransitPlace('INT. TERMINAL GATE — SECURITY CHECKPOINT'), false);
  assert.equal(isTransitPlace('EXT. SKERRY ISLAND HARBOUR DOCK'), false);
  assert.equal(isTransitPlace('EXT. BALTIMORE CONTAINER TERMINAL'), false);
  assert.equal(isTransitPlace(null), false);
});

test('slugSaysContinuous reads the slug rather than guessing', () => {
  assert.equal(slugSaysContinuous('EXT. PARKING LOT - CONTINUOUS'), true);
  assert.equal(slugSaysContinuous('INT. VAN — MOMENTS LATER'), true);
  assert.equal(slugSaysContinuous('INT. CHANDLERY LOFT - NIGHT'), false);
});

test('PLACE_JUMP fires only on the genuinely impossible', () => {
  const reg = createRegistry();
  const jason = registerEntity(reg, 'PERSON', 'Jason');
  const impossible: PlaceObservation[] = [
    { entityId: jason, scene: 10, region: 'BOSTON', elapsed: 'UNKNOWN' },
    { entityId: jason, scene: 11, region: 'TACOMA', elapsed: 'CONTINUOUS' },
  ];
  const found = checkPlaceJumps(impossible, [], { reg });
  assert.equal(found.length, 1);
  assert.equal(found[0].kind, 'PLACE_JUMP');
  assert.match(found[0].detail, /CONTINUOUS/);
  assert.match(ledgerFindingInstruction(found[0]), /Add the travel/);
});

test('a cut is allowed to cover a journey — only continuity forbids one', () => {
  const reg = createRegistry();
  const jason = registerEntity(reg, 'PERSON', 'Jason');
  // Scenes 74-79 of the draft: a Boston thread and a Portsmouth thread, cross-cut over days.
  // The first version of this rule reported six findings here. All six were ordinary screenwriting.
  const intercut: PlaceObservation[] = [
    { entityId: jason, scene: 74, region: 'BOSTON', elapsed: 'LATER' },
    { entityId: jason, scene: 75, region: 'PORTSMOUTH', elapsed: 'LATER' },
    { entityId: jason, scene: 76, region: 'BOSTON', elapsed: 'LATER' },
    { entityId: jason, scene: 77, region: 'PORTSMOUTH', elapsed: 'LATER' },
  ];
  assert.deepEqual(checkPlaceJumps(intercut, [], { reg }), []);
});

test('a travel beat anywhere in the span discharges the jump', () => {
  const reg = createRegistry();
  const jason = registerEntity(reg, 'PERSON', 'Jason');
  const obs: PlaceObservation[] = [
    { entityId: jason, scene: 37, region: 'NOVA SCOTIA', elapsed: 'UNKNOWN' },
    { entityId: jason, scene: 38, region: 'BALTIMORE', elapsed: 'CONTINUOUS' },
  ];
  assert.equal(checkPlaceJumps(obs, [], { reg }).length, 1, 'without the beat it is a finding');
  // Scene 37 IS the beat: Jason unties Bev's skiff and the fog takes it.
  assert.deepEqual(checkPlaceJumps(obs, [37], { reg }), [], 'the departure covers the crossing');
});

test('a flashback is not a place jump', () => {
  const reg = createRegistry();
  const jason = registerEntity(reg, 'PERSON', 'Jason');
  const obs: PlaceObservation[] = [
    { entityId: jason, scene: 17, region: 'NOVA SCOTIA', elapsed: 'UNKNOWN' },
    { entityId: jason, scene: 18, region: 'BOSTON', elapsed: 'CONTINUOUS', recalled: true },
  ];
  assert.deepEqual(checkPlaceJumps(obs, [], { reg }), [],
    'the Boston gala is seven years earlier — he is not there now');
});

test('a distant pair is not a jump however different the regions', () => {
  const reg = createRegistry();
  const jason = registerEntity(reg, 'PERSON', 'Jason');
  const obs: PlaceObservation[] = [
    { entityId: jason, scene: 10, region: 'BOSTON', elapsed: 'UNKNOWN' },
    { entityId: jason, scene: 40, region: 'TACOMA', elapsed: 'CONTINUOUS' },
  ];
  assert.deepEqual(checkPlaceJumps(obs, [], { reg }), []);
});

test('checkPlaceJumps is fail-safe and auditLedger threads it through', () => {
  const reg = createRegistry();
  assert.deepEqual(checkPlaceJumps(null as any), []);
  assert.deepEqual(checkPlaceJumps([], undefined), []);
  const jason = registerEntity(reg, 'PERSON', 'Jason');
  const found = auditLedger(reg, [], 40, {
    places: [
      { entityId: jason, scene: 10, region: 'BOSTON', elapsed: 'UNKNOWN' },
      { entityId: jason, scene: 11, region: 'TACOMA', elapsed: 'CONTINUOUS' },
    ],
  });
  assert.equal(found.filter((f) => f.kind === 'PLACE_JUMP').length, 1);
});
