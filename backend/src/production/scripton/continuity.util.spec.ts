import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  classifyLine, classifyScript, nextInSpeech, looksLikeCue, readScene,
  normaliseCharacterName, keyName, sameCharacter, splitCast,
  collectExits, unavailableAt, unavailableLine, stripExitedCast,
  checkScene, checkDraftContinuity, checkPlanCast,
  normaliseForCompare, jaccard, findDuplicateScenes, dedupeScenes,
  repairInstruction, summariseContinuity,
  exitsAsCanonFacts, findNameDrift, canonicalForm, canonicaliseNames, properCase, trimToSentence,
  DUPLICATE_ANYWHERE, DUPLICATE_SAME_PLACE,
  findSecondDocument, splitAtSecondDocument, isRecalledTime,
  CastExit,
  findMetaCommentary, stripMetaCommentary,
  findWrittenDeaths, collectWrittenDeaths, writtenDeathsAsExits,
  collectPronounEvidence, findPronounDrift, checkFixedAttributes,
} from './continuity.util';

// ── the classifier, lifted out of paginate() ────────────────────────────────────────────────

test('classifyLine reproduces the behaviour PAGE_BUDGET was calibrated against', () => {
  assert.equal(classifyLine('', false), 'blank');
  assert.equal(classifyLine('12  INT. BOATHOUSE - NIGHT', false), 'slug');
  assert.equal(classifyLine('EXT. HARBOUR - DAY', false), 'slug');
  assert.equal(classifyLine('FADE OUT.', false), 'trans');
  assert.equal(classifyLine('CUT TO:', false), 'trans');
  assert.equal(classifyLine('(quietly)', true), 'paren');
  assert.equal(classifyLine('JASON', false), 'cue');
  assert.equal(classifyLine("MOIRA (CONT'D)", false), 'cue');
  // inside a speech the same short uppercase line is dialogue, not a new cue
  assert.equal(classifyLine('NO', true), 'dialogue');
  assert.equal(classifyLine('He ties a bowline without looking.', false), 'action');
});

test('the speech state machine opens on a cue and closes on a blank', () => {
  assert.equal(nextInSpeech('cue', false), true);
  assert.equal(nextInSpeech('dialogue', true), true);
  assert.equal(nextInSpeech('paren', true), true);
  assert.equal(nextInSpeech('blank', true), false);
  assert.equal(nextInSpeech('action', true), false);
  assert.equal(nextInSpeech('slug', true), false);
});

test('an all-caps action beat is not a character — the refinement pagination never needed', () => {
  // "BANG" satisfies looksLikeCue, which is why the loose test alone cannot be trusted.
  assert.equal(looksLikeCue('BANG'), true);
  const lines = classifyScript('BANG\n\nThe door gives.\n\nJASON\nGet down.');
  const cues = lines.filter((l) => l.kind === 'cue');
  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, 'BANG');
  assert.equal(cues[0].speaks, false, 'BANG has no speech under it');
  assert.equal(cues[1].text, 'JASON');
  assert.equal(cues[1].speaks, true);
  assert.deepEqual(readScene('BANG\n\nThe door gives.\n\nJASON\nGet down.').speakers, ['JASON']);
});

test('readScene separates dialogue from action and counts parentheticals', () => {
  const s = readScene([
    'Rain hammers the wheelhouse glass.',
    '',
    'CALLUM',
    '(over the engine)',
    'Hold the line and count to ten.',
    '',
    'JASON',
    'Ten.',
  ].join('\n'));
  assert.deepEqual(s.speakers, ['CALLUM', 'JASON']);
  assert.equal(s.parentheticals, 1);
  assert.equal(s.actionWords, 5);
  assert.equal(s.dialogueWords, 8);
});

// ── names ───────────────────────────────────────────────────────────────────────────────────

test('cue suffixes and honorifics are not part of a character', () => {
  assert.equal(normaliseCharacterName("CALLUM (V.O.)"), 'CALLUM');
  assert.equal(normaliseCharacterName("Moira (CONT'D)"), 'MOIRA');
  assert.equal(keyName('DR MOIRA MACRAE'), 'MOIRA');
  assert.equal(keyName('CALLUM MACRAE'), 'CALLUM');
});

test('a shared surname is not a shared identity', () => {
  assert.equal(sameCharacter('CALLUM MACRAE', 'CALLUM'), true);
  assert.equal(sameCharacter('DR MOIRA MACRAE', 'MOIRA MACRAE'), true);
  assert.equal(sameCharacter('VEX MERCER', 'MERCER'), true);
  // the whole reason keyName exists: Nora survives her father
  assert.equal(sameCharacter('NORA BELL', 'THOMAS BELL'), false);
  assert.equal(sameCharacter('CALLUM MACRAE', 'MOIRA MACRAE'), false);
  assert.equal(sameCharacter('JASON', 'SOPHIE'), false);
});

test('a cast list survives commas, arrays and Arabic separators', () => {
  assert.deepEqual(splitCast('Jason, Sophie , Nora'), ['JASON', 'SOPHIE', 'NORA']);
  assert.deepEqual(splitCast(['Jason', 'Gideon']), ['JASON', 'GIDEON']);
  assert.deepEqual(splitCast('Jason؛ Sophie'), ['JASON', 'SOPHIE']);
  assert.deepEqual(splitCast(null), []);
});

// ── exits ───────────────────────────────────────────────────────────────────────────────────

const JQ_PLAN = () => {
  const scenes: any[] = [];
  for (let i = 0; i < 130; i++) scenes.push({ brief: 'Scene ' + (i + 1) + ' of the story.', characters: 'Jason' });
  scenes[24] = { brief: 'Jason finds the house. Callum is dead.', characters: 'Jason, Callum', exits: [{ name: 'Callum', how: 'killed' }] };
  scenes[25] = { brief: 'Jason fails to save Moira. She dies.', characters: 'Jason, Moira', exits: [{ name: 'Moira MacRae', how: 'killed' }] };
  return scenes;
};

test('exits are read off the plan and the first one wins', () => {
  const ex = collectExits(JQ_PLAN());
  assert.equal(ex.length, 2);
  assert.equal(ex[0].name, 'CALLUM');
  assert.equal(ex[0].scene, 24);
  assert.equal(ex[0].how, 'killed');
  assert.equal(ex[1].name, 'MOIRA MACRAE');
  assert.equal(ex[1].scene, 25);
});

test('unavailability starts the scene AFTER the exit — they may still play their own death', () => {
  const ex = collectExits(JQ_PLAN());
  assert.equal(unavailableAt(ex, 24).length, 0, 'Callum is present in the scene he dies in');
  assert.equal(unavailableAt(ex, 25).length, 1);
  assert.equal(unavailableAt(ex, 26).length, 2);
  assert.match(unavailableLine(ex, 60), /CALLUM \(killed, sc 25\)/);
  assert.match(unavailableLine(ex, 60), /MOIRA MACRAE \(killed, sc 26\)/);
  assert.equal(unavailableLine(ex, 3), '');
});

test('the unavailable line stays bounded however high the body count', () => {
  const scenes: any[] = [];
  for (let i = 0; i < 30; i++) scenes.push({ brief: 'b', exits: [{ name: 'VICTIM' + i, how: 'killed' }] });
  const line = unavailableLine(collectExits(scenes), 29, 8);
  assert.ok(line.split('),').length <= 9, 'at most eight named');
  assert.match(line, /and \d+ more$/);
});

// ── the reported bug ────────────────────────────────────────────────────────────────────────

test('a dead man on the telephone is caught', () => {
  const ex = collectExits(JQ_PLAN());
  const scene58 = ['Jason presses the phone to his ear.', '', "CALLUM (V.O.)", 'Aye, son. Where are you?'].join('\n');
  const f = checkScene(59, '60  INT. HOTEL ROOM - NIGHT', scene58, ex);
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'SPEAKS_AFTER_EXIT');
  assert.deepEqual(f[0].names, ['CALLUM']);
  assert.equal(f[0].repairable, true);
  assert.match(f[0].detail, /killed in scene 25/);
});

test('naming the dead is not an error — grief is most of what a revenge film is', () => {
  const ex = collectExits(JQ_PLAN());
  const grief = ['Jason turns the wool cap over in his hands.', '', 'SOPHIE', 'Callum would have known what to do.',
    '', 'JASON', 'Moira would have told me to sit down first.'].join('\n');
  assert.deepEqual(checkScene(70, '71  INT. BOATHOUSE - NIGHT', grief, ex), []);
});

test('a character may speak in the scene that kills them', () => {
  const ex = collectExits(JQ_PLAN());
  const death = ['Moira presses his hand flat.', '', 'MOIRA', "Don't become what they came for."].join('\n');
  assert.deepEqual(checkScene(25, '26  INT. MACRAE HOUSE - NIGHT', death, ex), []);
});

test('the whole-draft sweep finds every resurrection and nothing else', () => {
  const ex = collectExits(JQ_PLAN());
  const written = JQ_PLAN().map((_, i) => ({ heading: (i + 1) + '  INT. SOMEWHERE - DAY', text: 'JASON\nKeep moving.' }));
  written[57] = { heading: '58  INT. HOTEL - NIGHT', text: "CALLUM (V.O.)\nAye, son." };
  written[75] = { heading: '76  EXT. PIER - DAY', text: 'CALLUM\nI told you to give them an exit.' };
  const found = checkDraftContinuity(written, ex);
  assert.equal(found.length, 2);
  assert.deepEqual(found.map((f) => f.sceneIndex), [57, 75]);
});

test('the plan-side check catches a dead character in the cast before a word is written', () => {
  const plan = JQ_PLAN();
  plan[59] = { brief: 'Jason calls Callum for help.', characters: 'Jason, Callum' };
  const found = checkPlanCast(plan, collectExits(plan));
  assert.equal(found.length, 1);
  assert.equal(found[0].sceneIndex, 59);
  assert.equal(found[0].repairable, false, 'the fix is the plan, not a rewrite');
});

test('stripping an exited character from a cast list only ever deletes something already wrong', () => {
  const plan = JQ_PLAN();
  plan[59] = { brief: 'Jason calls Callum for help.', characters: 'Jason, Callum' };
  const { scenes, removed } = stripExitedCast(plan, collectExits(plan));
  assert.equal(removed, 1);
  assert.equal(scenes[59].characters, 'JASON');
  assert.equal(scenes[24].characters, 'Jason, Callum', 'the death scene is untouched');
});

// ── duplicates ──────────────────────────────────────────────────────────────────────────────

test('token overlap ignores stopwords and repeats', () => {
  // stopwords, two-letter words and repeats all fall out; order of first appearance is kept
  assert.deepEqual(normaliseForCompare('The Gideon and the gideon at a courthouse'), ['gideon', 'courthouse']);
  assert.equal(jaccard(['a', 'b'], ['a', 'b']), 1);
  assert.equal(jaccard(['a'], ['b']), 0);
});

test('the courthouse climax written three times is caught', () => {
  const scenes = [
    { location: 'COURTHOUSE STEPS', brief: 'Jason confronts Gideon on the courthouse steps; Gideon is arrested as the archive goes public.' },
    { location: 'COURTHOUSE STEPS', brief: 'On the courthouse steps Jason confronts Gideon, who is arrested as the archive is made public.' },
    { location: 'COURTHOUSE', brief: 'Jason confronts Gideon at the courthouse; Gideon arrested, archive public.' },
  ];
  const d = findDuplicateScenes(scenes);
  assert.equal(d.length, 2);
  assert.deepEqual(d.map((x) => x.index), [1, 2]);
  assert.equal(d[0].duplicateOf, 0);
});

test('returning to the same location is not duplication', () => {
  const scenes = [
    { location: 'BOATHOUSE', brief: 'Sophie holds Jason at gunpoint until he names the music box.' },
    { location: 'BOATHOUSE', brief: 'Alexander collapses; Jason works on his father as Sophie calls it in.' },
    { location: 'BOATHOUSE', brief: 'Sophie refuses to let Jason put on another disguise before the port.' },
  ];
  assert.deepEqual(findDuplicateScenes(scenes), []);
});

test('a brief too thin to judge is never called a duplicate', () => {
  assert.deepEqual(findDuplicateScenes([{ location: 'PIER', brief: 'They talk.' }, { location: 'PIER', brief: 'They talk.' }]), []);
});

test('dedupe keeps the first occurrence and preserves order', () => {
  const scenes = [
    { location: 'A', brief: 'Jason boards the Mercy through the flooding ballast access.' },
    { location: 'B', brief: 'Sophie begins the timed release from the port control tower.' },
    { location: 'A', brief: 'Jason boards the Mercy via the flooding ballast access.' },
    { location: 'C', brief: 'Nora doubles back for Jason with the volunteer boat.' },
  ];
  const { scenes: kept, dropped } = dedupeScenes(scenes);
  assert.equal(kept.length, 3);
  assert.deepEqual(kept.map((s: any) => s.location), ['A', 'B', 'C']);
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].index, 2);
});

test('dedupe is a no-op on a clean plan, and returns the same array', () => {
  const scenes = [{ location: 'A', brief: 'Jason boards the Mercy through the ballast access.' }];
  const r = dedupeScenes(scenes);
  assert.equal(r.dropped.length, 0);
  assert.equal(r.scenes, scenes);
});

test('the duplicate thresholds are high, because dropping a real scene is the worse failure', () => {
  assert.ok(DUPLICATE_ANYWHERE >= 0.7);
  assert.ok(DUPLICATE_SAME_PLACE >= 0.5);
  assert.ok(DUPLICATE_SAME_PLACE < DUPLICATE_ANYWHERE, 'a matching location may lower the bar, never raise it');
});

// ── repair and reporting ────────────────────────────────────────────────────────────────────

test('the repair instruction forbids presence but protects memory', () => {
  const ex: CastExit[] = [{ name: 'CALLUM', scene: 24, how: 'killed' }];
  const f = checkScene(59, '60  INT. HOTEL - NIGHT', "CALLUM (V.O.)\nAye, son.", ex)[0];
  const ins = repairInstruction(f, ex);
  assert.match(ins, /CALLUM \(killed in scene 25\)/);
  assert.match(ins, /Remove every line they speak/);
  assert.match(ins, /may still name them, remember them, grieve them/);
  assert.match(ins, /roughly the same length/);
});

test('the summary never reports a repair that did not happen', () => {
  assert.match(summariseContinuity(0, 0, []), /no character appears after leaving/);
  assert.equal(summariseContinuity(3, 3, []), 'Continuity: 3 issues found, 3 repaired.');
  const left = [{ kind: 'SPEAKS_AFTER_EXIT' as const, sceneIndex: 77, heading: '', names: ['CALLUM'], detail: '', repairable: true }];
  assert.match(summariseContinuity(3, 2, left), /3 issues found, 2 repaired — still unresolved in scene 78\./);
});

// ── canon ───────────────────────────────────────────────────────────────────────────────────

test('exits become canon facts anchored to the scene AFTER the exit', () => {
  const f = exitsAsCanonFacts([
    { name: 'CALLUM', scene: 24, how: 'killed' },
    { name: 'ADRIAN COLE', scene: 90, how: 'flees to Geneva' },
  ]);
  assert.equal(f.length, 2);
  assert.equal(f[0].kind, 'CHARACTER');
  assert.equal(f[0].subject, 'CALLUM');
  assert.equal(f[0].predicate, 'status');
  assert.equal(f[0].object, 'dead');
  // validFrom is the scene after the exit: a character plays their own death
  assert.equal(f[0].validFrom, 25);
  assert.equal(f[0].validTo, null);
  assert.equal(f[0].status, 'ACTIVE');
  assert.match(f[0].statement, /cannot appear, speak or be contacted/);
  // leaving is not dying
  assert.equal(f[1].object, 'gone');
  assert.equal(f[1].validFrom, 91);
});

test('the exit fact window matches unavailableAt exactly, so both agree on who is gone', () => {
  const exits = [{ name: 'CALLUM', scene: 24, how: 'killed' }];
  const fact = exitsAsCanonFacts(exits)[0];
  // resolveCanonAt's half-open test is validFrom <= at; unavailableAt's is scene < at
  for (const at of [23, 24, 25, 60]) {
    const liveByCanon = fact.validFrom <= at && (fact.validTo == null || fact.validTo > at);
    const goneByCheck = unavailableAt(exits, at).length > 0;
    assert.equal(liveByCanon, goneByCheck, 'disagreement at scene ' + at);
  }
});

test('exitsAsCanonFacts survives junk without inventing a fact', () => {
  assert.deepEqual(exitsAsCanonFacts([]), []);
  assert.deepEqual(exitsAsCanonFacts(null as any), []);
});

test('a character written under two full names is caught exactly', () => {
  const written = [
    { heading: '1  INT. BOAT - NIGHT', text: 'The manifest names JASON ANDREW QUICK as the beneficiary.' },
    { heading: '2  INT. OFFICE - DAY', text: 'Sophie reads it twice. Jason Richard Quick, presumed dead.' },
    { heading: '3  EXT. PIER - DAY', text: 'Jason ties a bowline.' },
  ];
  const facts = [{ kind: 'CHARACTER' as const, subject: 'JASON', predicate: 'full_name',
    object: 'Jason Andrew Quick', statement: 'His full name is Jason Andrew Quick.', validFrom: 0, validTo: null }];
  const d = findNameDrift(written, ['JASON'], facts);
  assert.equal(d.length, 1);
  assert.equal(d[0].kind, 'NAME_DRIFT');
  assert.equal(d[0].sceneIndex, 1, 'the scene that disagrees with canon, not the one that matches');
  assert.equal(d[0].names[0], 'JASON ANDREW QUICK');
  assert.match(d[0].detail, /written as "JASON RICHARD QUICK" here/);
});

test('one consistent spelling is not drift, and a bare first name never is', () => {
  const written = [
    { heading: '1', text: 'JASON ANDREW QUICK signs the manifest.' },
    { heading: '2', text: 'Jason Andrew Quick signs it again.' },
    { heading: '3', text: 'Jason. Just Jason.' },
  ];
  assert.deepEqual(findNameDrift(written, ['JASON'], []), []);
});

test('canon decides the spelling; without canon, frequency does', () => {
  const forms = [{ form: 'JASON RICHARD QUICK', count: 5, firstScene: 1 },
                 { form: 'JASON ANDREW QUICK', count: 2, firstScene: 0 }];
  assert.equal(canonicalForm(forms, [{ kind: 'CHARACTER', subject: 'JASON', predicate: 'full_name',
    object: 'Jason Andrew Quick', statement: '', validFrom: 0, validTo: null }]), 'JASON ANDREW QUICK',
    'a stated fact outranks a repeated mistake');
  assert.equal(canonicalForm(forms, []), 'JASON RICHARD QUICK', 'with nothing stated, the majority wins');
  const tie = [{ form: 'A B', count: 2, firstScene: 3 }, { form: 'C D', count: 2, firstScene: 1 }];
  assert.equal(canonicalForm(tie, []), 'C D', 'a tie goes to whichever came first');
});

test('name drift is repaired by substitution, in both cue and prose casing', () => {
  const scene = ['Sophie reads the file: Jason Richard Quick, presumed dead.', '',
    'JASON RICHARD QUICK', 'Not any more.'].join('\n');
  const fixed = canonicaliseNames(scene, ['JASON RICHARD QUICK'], 'JASON ANDREW QUICK');
  assert.match(fixed, /file: Jason Andrew Quick, presumed dead/);
  assert.match(fixed, /^JASON ANDREW QUICK$/m);
  assert.equal(fixed.indexOf('Richard'), -1);
  // everything else survives untouched
  assert.match(fixed, /Not any more\./);
});

test('canonicaliseNames is a no-op without a target, and never rewrites the canonical form', () => {
  assert.equal(canonicaliseNames('Jason Andrew Quick', ['JASON RICHARD QUICK'], ''), 'Jason Andrew Quick');
  assert.equal(canonicaliseNames('Jason Andrew Quick', ['JASON ANDREW QUICK'], 'JASON ANDREW QUICK'), 'Jason Andrew Quick');
});

test('properCase handles the hyphens and apostrophes screenplay names actually contain', () => {
  assert.equal(properCase('MOIRA MACRAE'), 'Moira Macrae');
  assert.equal(properCase("EVELYN O'NEILL"), "Evelyn O'Neill");
  assert.equal(properCase('JEAN-LUC VALE'), 'Jean-Luc Vale');
});

// ── message hygiene ─────────────────────────────────────────────────────────────────────────

test('a short note is returned unchanged, whitespace normalised', () => {
  assert.equal(trimToSentence('The script reaches its ending.'), 'The script reaches its ending.');
  assert.equal(trimToSentence('  spread   over\n lines '), 'spread over lines');
  assert.equal(trimToSentence(null), '');
});

test('the note that shipped mid-word is cut at a word instead', () => {
  const note = "The script delivers a mid-story resolution and a sequel-hook ending at the harbor, but never"
    + " dramatises the outline's final beats: Jason crossing into the US through a Baltimore freight"
    + " terminal using forged manifests, and the confrontation that follows.";
  const out = trimToSentence(note, 200);
  assert.ok(out.length <= 201, 'stays within the cap');
  assert.match(out, /…$/, 'the cut is marked');
  // the property that matters: whatever we kept ends where a word ends in the original
  const kept = out.slice(0, -1).trim();
  assert.ok(note.startsWith(kept), 'the kept text is a real prefix of the note');
  assert.equal(note.charAt(kept.length), ' ', 'and it stops at a word boundary, not mid-token');
});

test('a sentence end wins when there is one late enough to keep most of the note', () => {
  const two = 'The script reaches the climax but stops before the resolution. It then adds an unrelated epilogue that the outline never describes at any point whatsoever.';
  const out = trimToSentence(two, 120);
  assert.equal(out, 'The script reaches the climax but stops before the resolution.');
  assert.ok(!out.endsWith('…'), 'a clean sentence needs no ellipsis');
});

test('an early full stop is NOT used, because it would discard the note', () => {
  const s = 'No. ' + 'x'.repeat(300);
  const out = trimToSentence(s, 100);
  assert.notEqual(out, 'No.', 'backing off to character 3 would throw the note away');
  assert.ok(out.length > 90);
});

test('trailing punctuation is not left dangling before the ellipsis', () => {
  const out = trimToSentence('The climax is missing, the resolution is missing, and the ending is ' + 'y'.repeat(300), 70);
  assert.ok(!/[,;:—-]…$/.test(out), 'no ", …" or "— …"');
  assert.match(out, /…$/);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// MECHANISM A — ONE SCENE, ONE STORY
// Built around the real contamination: page 44 of the 1 Sep Jason Quick draft.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const TRUMAN = 'He nods. Accepts the terms.\n\nSophie caps the marker.\n\n'
  + '                    SOPHIE (CONT\'D)\n               Thursday.\n\n'
  + '# The Truman Show ### FADE IN:\n\n'
  + '## EXT. SEAHAVEN — SUNRISE\n\n'
  + 'A brilliant orange sun rises over a picture-perfect town. Blue sky, white clouds, a manicured\n'
  + 'lawn. Everything is a little too clean, a little too bright.\n\n'
  + 'A TITLE CARD: TRUMAN.\n\n'
  + '## INT. BATHROOM — DAY\n\n'
  + 'TRUMAN BURBANK (30s), boyishly handsome, stares into the bathroom mirror.\n\n'
  + '### FADE OUT.';

test('the two pages of The Truman Show are found, at the line where they start', () => {
  const f = findSecondDocument(TRUMAN);
  assert.ok(f, 'the contamination must be detected');
  assert.equal(f!.kind, 'MARKDOWN_HEADING');
  assert.match(f!.line, /The Truman Show/);
  assert.equal(TRUMAN.slice(f!.index).startsWith('# The Truman Show'), true, 'the index points at the boundary');
  assert.equal(TRUMAN.slice(0, f!.index).indexOf('Truman'), -1, 'nothing foreign survives before it');
});

test('each door the contamination walked through is now shut', () => {
  const body = 'Jason crosses the yard.\n\n';
  assert.equal(findSecondDocument(body + '## EXT. SEAHAVEN - SUNRISE')!.kind, 'MARKDOWN_HEADING');
  assert.equal(findSecondDocument(body + 'FADE IN:\n\nEXT. SEAHAVEN - DAY\n\nThe sun rises.')!.kind, 'FADE_IN');
  assert.equal(findSecondDocument(body + '### FADE OUT.\n\nAnother film begins here.')!.kind, 'FADE_OUT',
    'a markdown-prefixed transition counts too, when something follows it');
  assert.equal(findSecondDocument(body + 'THE END\n\nAnd then more.')!.kind, 'FADE_OUT');
  assert.equal(
    findSecondDocument(body + 'INT. BATHROOM - DAY\n\nHe shaves.\n\nEXT. STREET - DAY\n\nHe walks.')!.kind,
    'EXTRA_SLUGS');
});

test('a transition with nothing after it is a formatting slip, not a second document', () => {
  // Measured against the delivered draft: a bare trailing "FADE OUT." closes scenes 16, 33 and 34,
  // and the caller appends one more to the end of every screenplay. Flagging those would have
  // discarded four good scenes in eighty to catch one real contamination. cleanSceneText strips them.
  assert.equal(findSecondDocument('Moira meets Callum\'s eyes.\n\nNeither smiles.\n\nFADE OUT.'), null);
  assert.equal(findSecondDocument('The horizon swallows the ship.\n\nFADE OUT.\n\n   \n'), null);
  assert.equal(findSecondDocument('He kills the light.\n\n### FADE OUT.'), null);
});

test('and a working scene is not thrown away for looking like prose', () => {
  assert.equal(findSecondDocument('Jason hauls net. The fog does not lift.\n\nHe waits.'), null);
  assert.equal(findSecondDocument(''), null);
  assert.equal(findSecondDocument(null as any), null);
  // A single interior sub-slug is real screenwriting, not a second document.
  assert.equal(findSecondDocument('He moves down the hall.\n\nINT. CORRIDOR\n\nThe door is open.'), null);
  // A hash inside prose is not a heading.
  assert.equal(findSecondDocument('The manifest reads LOT #4471. He photographs it.'), null);
  // Dialogue that mentions the end of something is not THE END.
  assert.equal(findSecondDocument('          JASON\n     That was the end of it.'), null);
});

test('the split keeps the scene that was finished before the model wandered off', () => {
  const r = splitAtSecondDocument(TRUMAN, 10);
  assert.match(r.kept, /Thursday\./, 'the beat plays out to its last line');
  assert.equal(/Truman|Seahaven|FADE|#/i.test(r.kept), false, 'and nothing of the other film comes with it');
  assert.match(r.dropped, /^# The Truman Show/);
  assert.equal(r.problem!.kind, 'MARKDOWN_HEADING');
});

test('at the real proportions of scene 32, the screenplay half is kept', () => {
  // The actual numbers from the delivered draft: 431 words in the scene, of which 233 were the
  // Jason/Sophie beat and 198 were The Truman Show. `minWords` comes from the scene's word budget
  // in writeScene — 40% of a ~364-word ask is ~146, and 233 clears it.
  const scene = 'She caps the marker. ' + 'He waits for her to say it. '.repeat(38);   // ~233 words
  const foreign = '\n\n# Another Film\n\n' + 'A brilliant orange sun rises. '.repeat(40);
  const r = splitAtSecondDocument(scene + foreign, 146);
  assert.equal(r.keep, true, 'a complete 233-word scene is not thrown away for what came after it');
  assert.equal(/Another Film|orange sun/.test(r.kept), false);
});

test('but a truncation is a repair, so too little left means throw the answer away', () => {
  const barely = 'He steps inside.\n\n# Another Film\n\n' + 'word '.repeat(400);
  const r = splitAtSecondDocument(barely);
  assert.equal(r.keep, false, 'three words is not a scene — retry instead of filing a fragment');
  assert.equal(splitAtSecondDocument(TRUMAN, 10).keep, false, 'nor is a twelve-word remainder');
  assert.equal(splitAtSecondDocument('A clean scene, no problem at all.').keep, true);
  assert.equal(splitAtSecondDocument('A clean scene, no problem at all.').problem, null);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// MECHANISM B — A CLOSED ENTITY VOCABULARY, AND REPAIRS THAT ARE CHECKED
// ─────────────────────────────────────────────────────────────────────────────────────────────

test('the exact input that renamed a company twenty times now resolves correctly', () => {
  const forms = [
    { form: 'VALE MERIDIAN', count: 40, firstScene: 5 },
    { form: 'VALE MAN', count: 1, firstScene: 60 },
  ];
  // The real canon fact. Normalised, it contains the LETTERS "VALE MAN" inside "VALE MANAGES".
  const facts: any[] = [{
    subject: 'GIDEON VALE', predicate: 'role', object: 'manager',
    statement: 'Gideon Vale manages the shipping arm of the group.',
    validFrom: 0, validTo: null, status: 'ACTIVE',
  }];
  assert.equal(canonicalForm(forms, facts), 'VALE MERIDIAN', 'a token run, never a substring');
  assert.equal(canonicalForm(forms, facts, ['VALE MERIDIAN', 'GIDEON VALE']), 'VALE MERIDIAN');
});

test('a repair may move a name toward one the project knows, and may never invent one', () => {
  const forms = [
    { form: 'BRENNAN HOLT', count: 9, firstScene: 2 },
    { form: 'BRENNAN HOLTE', count: 3, firstScene: 40 },
  ];
  assert.equal(canonicalForm(forms, [], ['BRENNAN HOLT']), 'BRENNAN HOLT', 'the registered spelling wins');
  assert.equal(canonicalForm(forms, [], []), '', 'no registered spelling means no repair, not a guess');
  assert.equal(canonicalForm(forms, []), 'BRENNAN HOLT', 'with no registry at all, the most-used form still wins');
});

test('the substitution is anchored — it cannot eat into a longer word or a longer name', () => {
  assert.equal(
    canonicaliseNames('Vale Meridian owns it. The Vale Meridians pier stands empty.', ['VALE MERIDIAN'], 'VALE MERIDIAN GROUP'),
    'Vale Meridian Group owns it. The Vale Meridians pier stands empty.');
  assert.equal(
    canonicaliseNames('JASON RICHARD QUICK signs.', ['JASON RICHARD QUICK'], 'JASON ANDREW QUICK'),
    'JASON ANDREW QUICK signs.');
  assert.equal(canonicaliseNames('anything', [], 'X'), 'anything');
  assert.equal(canonicaliseNames('anything', ['A B'], ''), 'anything', 'an empty target is never substituted');
});

test('a scene heading is a location, not evidence of a character misspelling itself', () => {
  const written = [{
    heading: '27  INT. VALE MERIDIAN EXECUTIVE FLOOR - DAY',
    text: '27  INT. VALE MERIDIAN EXECUTIVE FLOOR - DAY\n\nGideon Vale waits by the glass.',
  }];
  // Reading the slug line collected "VALE MERIDIAN EXECUTIVE FLOOR" as a spelling of a character —
  // which is how the repair came to rewrite every heading in the screenplay.
  const drift = findNameDrift(written, ['VALE MERIDIAN'], []);
  assert.equal(drift.length, 0, 'a location in a slug line is not a name form');
});

test('a character may speak in a flashback after they are killed', () => {
  const exits: CastExit[] = [{ name: 'CALLUM MACRAE', scene: 16, how: 'killed' }];
  const speech = '                    CALLUM\n               You hold the line, boy.';
  // The real scene 45 of the 1 Sep draft.
  assert.equal(checkScene(44, 'INT. MACRAE TRAINING BARN - FLASHBACK - DAY', speech, exits).length, 0);
  assert.equal(checkScene(44, 'INT. MACRAE TRAINING BARN - DAY', 'FLASHBACK - 1998\n\n' + speech, exits).length, 0,
    'the marker may be in the opening lines rather than the heading');
  assert.equal(checkScene(44, 'INT. BARN - THREE YEARS EARLIER - DAY', speech, exits).length, 0);
  // ...and the bug it exists to catch is untouched.
  assert.equal(checkScene(44, 'INT. WAREHOUSE - NIGHT', speech, exits).length, 1,
    'a dead man on the telephone is still a dead man on the telephone');
});

// ── model meta-commentary ───────────────────────────────────────────────────────────────────

test('the word count that reached page 2 of a delivered draft is stripped', () => {
  const scene = 'JASON pushes the door.\n\nWord count: approximately 66\n\nHe steps through.';
  assert.deepEqual(findMetaCommentary(scene), ['Word count: approximately 66']);
  assert.equal(stripMetaCommentary(scene), 'JASON pushes the door.\n\nHe steps through.');
});

test('every shape the model writes a count in', () => {
  for (const line of [
    'Word count: 66', 'Word count: approximately 66', '[Word count: ~66]', '(Words: 66)',
    'Total words = 1,240', 'Word count: about 66 words', 'Line count: 45', 'Page count: 1.5',
    'Estimated words: 300', '(Approximately 66 words)', '~1.5 pages', 'about 300 words.',
  ]) {
    assert.deepEqual(findMetaCommentary('ACTION.\n\n' + line), [line.trim()], line);
  }
});

test('prose that merely contains numbers is never stripped', () => {
  for (const line of [
    'He counts sixty-six words and stops.',
    'The ledger runs to 300 pages of nothing.',
    'JASON\n          Two pages. That\'s all she left me.',
    'A word count sits open on the screen behind him.',
    '66 WORDS is stencilled on the crate.',
  ]) {
    assert.deepEqual(findMetaCommentary(line), [], line);
    assert.equal(stripMetaCommentary(line), line, line);
  }
});

test('stripping is identity when there is nothing to strip', () => {
  const scene = 'VALE turns from the window.\n\n          VALE\n     You came anyway.';
  assert.equal(stripMetaCommentary(scene), scene);
});

// ── deaths the writer invented ──────────────────────────────────────────────────────────────

const CAST = ['KANE', 'GIDEON VALE', 'JASON QUICK', 'SOPHIE QUICK'];
const D = (text: string, heading = 'INT. SECURITY SUITE - NIGHT') => findWrittenDeaths(115, heading, text, CAST);

test('the Kane case — a death in the prose that the plan never declared', () => {
  const found = D('The round takes him high in the chest. KANE slumps dead against the console.');
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'KANE');
  assert.equal(found[0].sceneIndex, 115);
  assert.match(found[0].evidence, /slumps dead/);
});

test('every subject predicate in the closed list reads as a death', () => {
  for (const p of ['dies', 'is dead', 'lies dead', 'falls dead', 'drops dead', 'slumps dead', 'bleeds out', 'is killed', 'stops breathing']) {
    assert.equal(D('KANE ' + p + '.').length, 1, p);
  }
});

test('object and remains forms', () => {
  assert.equal(D('JASON QUICK kills KANE with the fire axe.')[0].name, 'KANE');
  assert.equal(D('KANE\'s body blocks the stairwell.')[0].name, 'KANE');
  assert.equal(D('The corpse of KANE is already cold.')[0].name, 'KANE');
});

test('dialogue is never evidence — characters lie, guess and grieve early', () => {
  assert.deepEqual(D('SOPHIE QUICK drops to her knees.\n\n          SOPHIE QUICK\n     KANE is dead. He\'s dead.'), []);
});

test('a hedge anywhere in the sentence voids the reading', () => {
  for (const s of [
    'KANE almost dies.', 'KANE nearly bleeds out.', 'KANE lies as if dead.',
    'KANE is presumed dead.', 'JASON QUICK thinks KANE is dead.',
    'KANE is not dead.', 'KANE doesn\'t die.', 'KANE plays dead.',
    'Is KANE dead?', 'KANE would have died here.',
  ]) {
    assert.deepEqual(D(s), [], s);
  }
});

test('being shot is not being dead — screenplays are full of survivors', () => {
  assert.deepEqual(D('JASON QUICK shoots KANE twice and runs.'), []);
});

test('the past tense is backstory, not a death in this scene', () => {
  assert.deepEqual(D('A photograph of the boy who died at sea.'), []);
  assert.deepEqual(D('The men who murdered GIDEON VALE are all in this room.'), []);
});

test('a name in one sentence and a death in the next is not a death', () => {
  assert.deepEqual(D('KANE steps back from the rail. The engine dies.'), []);
});

test('an unregistered name is never killed', () => {
  assert.deepEqual(findWrittenDeaths(115, 'INT. ROOM - NIGHT', 'THE COURIER dies on the step.', CAST), []);
});

test('a flashback death is not a death in the running order', () => {
  assert.deepEqual(D('GIDEON VALE dies in the wheelhouse.', 'INT. TRAWLER — FLASHBACK - DAY'), []);
});

test('collectWrittenDeaths keeps the first death per character', () => {
  const draft = [
    { heading: 'INT. A - DAY', text: 'JASON QUICK waits.' },
    { heading: 'INT. B - NIGHT', text: 'KANE slumps dead against the console.' },
    { heading: 'INT. C - NIGHT', text: 'KANE lies dead where he fell.' },
  ];
  const found = collectWrittenDeaths(draft, CAST);
  assert.equal(found.length, 1);
  assert.equal(found[0].sceneIndex, 1);
});

test('a death the planner already declared is not reported twice', () => {
  const deaths = collectWrittenDeaths([{ heading: 'INT. B - NIGHT', text: 'KANE slumps dead.' }], CAST);
  assert.equal(writtenDeathsAsExits(deaths, []).length, 1);
  assert.equal(writtenDeathsAsExits(deaths, [{ name: 'KANE', scene: 128, how: 'killed' }]).length, 0);
});

test('END TO END — Kane dies at 116 and speaks through 117', () => {
  const draft = [
    { heading: 'INT. SECURITY SUITE - NIGHT', text: 'KANE slumps dead against the console.' },
    { heading: 'INT. KANE\'S OFFICE - NIGHT', text: 'The room is quiet.\n\n          KANE\n     You were always going to come here.' },
  ];
  const exits = writtenDeathsAsExits(collectWrittenDeaths(draft, CAST), []);
  assert.equal(exits.length, 1);
  const findings = checkDraftContinuity(draft, exits);
  assert.equal(findings.length, 1, 'the contradiction the plan-only ledger could not see');
  assert.equal(findings[0].kind, 'SPEAKS_AFTER_EXIT');
  assert.deepEqual(findings[0].names, ['KANE']);
});

// ── fixed attributes: pronouns ──────────────────────────────────────────────────────────────

const PCAST = ['DARIA KANE', 'JASON QUICK', 'SOPHIE QUICK'];
const P = (i: number, text: string) => collectPronounEvidence(i, text, PCAST);

test('the Daria Kane case — a character written as both she and he', () => {
  const draft = [
    { heading: 'INT. A - DAY', text: 'DARIA KANE closes her laptop.' },
    { heading: 'INT. B - DAY', text: 'DARIA KANE reads the file to herself.' },
    { heading: 'INT. C - DAY', text: 'DARIA KANE turns her back on the window.' },
    { heading: 'INT. D - NIGHT', text: 'DARIA KANE straightens his tie and waits.' },
  ];
  const found = checkFixedAttributes(draft, PCAST);
  assert.equal(found.length, 1);
  assert.equal(found[0].kind, 'ATTRIBUTE_DRIFT');
  assert.equal(found[0].attribute, 'pronouns');
  assert.equal(found[0].name, 'DARIA KANE');
  assert.equal(found[0].settled, 'she');
  assert.equal(found[0].settledCount, 3);
  assert.equal(found[0].conflicting, 'he');
  assert.equal(found[0].conflictCount, 1);
  assert.deepEqual(found[0].scenes, [4], 'the operator is told which scene to open');
  assert.match(found[0].detail, /pronouns are not a story event/);
});

test('a consistently written character is never reported', () => {
  const draft = [
    { heading: 'INT. A - DAY', text: 'JASON QUICK checks his watch.' },
    { heading: 'INT. B - DAY', text: 'JASON QUICK pulls his collar up.' },
    { heading: 'INT. C - DAY', text: 'JASON QUICK keeps his eyes on the road.' },
  ];
  assert.deepEqual(checkFixedAttributes(draft, PCAST), []);
});

test('singular they is collected but never counts as a conflict', () => {
  const draft = [
    { heading: 'INT. A - DAY', text: 'SOPHIE QUICK sets their bag down.' },
    { heading: 'INT. B - DAY', text: 'SOPHIE QUICK takes their coat off.' },
    { heading: 'INT. C - DAY', text: 'SOPHIE QUICK opens her notebook.' },
  ];
  assert.deepEqual(checkFixedAttributes(draft, PCAST), [], 'they/them must never trip the he/she flip');
});

test('an unnamed person in the sentence can own the pronoun, so the sentence is discarded', () => {
  assert.deepEqual(P(0, 'DARIA KANE hands the guard his coat.'), []);
  assert.deepEqual(P(0, 'DARIA KANE watches the man take off his hat.'), []);
});

test('two named characters in one sentence is a coin toss, so it is discarded', () => {
  assert.deepEqual(P(0, 'DARIA KANE passes JASON QUICK his phone.'), []);
});

test('a pronoun BEFORE the name is not evidence about that name', () => {
  assert.deepEqual(P(0, 'His hand still on the rail, DARIA KANE waits.'), []);
});

test('dialogue is not evidence — people mis-gender each other out loud', () => {
  assert.deepEqual(P(0, '          JASON QUICK\n     She said he would come alone.'), []);
});

test('one against one is not drift — a single ambiguous possessive proves nothing', () => {
  const draft = [
    { heading: 'INT. A - DAY', text: 'DARIA KANE lifts her chin.' },
    { heading: 'INT. B - DAY', text: 'DARIA KANE lowers his voice.' },
  ];
  assert.deepEqual(checkFixedAttributes(draft, PCAST), [], 'the majority floor is two');
});

test('every conflicting scene is listed, deduplicated and in order', () => {
  const draft = [
    { heading: 'INT. A - DAY', text: 'DARIA KANE opens her case.' },
    { heading: 'INT. B - DAY', text: 'DARIA KANE reads her notes.' },
    { heading: 'INT. C - DAY', text: 'DARIA KANE buttons his jacket. DARIA KANE checks his cuffs.' },
    { heading: 'INT. D - DAY', text: 'DARIA KANE finishes her drink.' },
    { heading: 'INT. E - DAY', text: 'DARIA KANE sets his glass down.' },
  ];
  const found = checkFixedAttributes(draft, PCAST);
  assert.equal(found.length, 1);
  // Three against three: no majority, so the value the script ESTABLISHED FIRST is the settled one.
  assert.equal(found[0].settled, 'she');
  assert.equal(found[0].settledCount, 3);
  assert.equal(found[0].conflictCount, 3);
  assert.deepEqual(found[0].scenes, [3, 5]);
});

test('a tie is broken by which value the script established first, not by array order', () => {
  const heFirst = [
    { heading: 'INT. A - DAY', text: 'DARIA KANE buttons his jacket.' },
    { heading: 'INT. B - DAY', text: 'DARIA KANE checks his cuffs.' },
    { heading: 'INT. C - DAY', text: 'DARIA KANE opens her case.' },
    { heading: 'INT. D - DAY', text: 'DARIA KANE reads her notes.' },
  ];
  const found = checkFixedAttributes(heFirst, PCAST);
  assert.equal(found[0].settled, 'he');
  assert.deepEqual(found[0].scenes, [3, 4]);
});

test('findPronounDrift is fail-safe on junk', () => {
  assert.deepEqual(findPronounDrift([]), []);
  assert.deepEqual(findPronounDrift(null as any), []);
  assert.deepEqual(checkFixedAttributes([], PCAST), []);
  assert.deepEqual(checkFixedAttributes([{ heading: 'INT. A', text: 'Nothing happens.' }], []), []);
});
