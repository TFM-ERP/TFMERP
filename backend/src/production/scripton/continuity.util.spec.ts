import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadCapture, missingCapture } from './capture-fixture.util';
import {
  classifyLine, classifyScript, nextInSpeech, looksLikeCue, readScene, normaliseCharacterName, keyName, sameCharacter, splitCast, collectExits, unavailableAt, unavailableLine, stripExitedCast, checkScene, checkDraftContinuity, checkPlanCast, normaliseForCompare, jaccard, findDuplicateScenes, dedupeScenes, repairInstruction, summariseContinuity, exitsAsCanonFacts, findNameDrift, canonicalForm, canonicaliseNames, properCase, trimToSentence, DUPLICATE_ANYWHERE, DUPLICATE_SAME_PLACE, findSecondDocument, splitAtSecondDocument, isRecalledTime, CastExit, findMetaCommentary, stripMetaCommentary, findWrittenDeaths, collectWrittenDeaths, writtenDeathsAsExits, collectPronounEvidence, findPronounDrift, checkFixedAttributes, sceneDefectInstruction, checkSceneIntegrity, parseSpokenClock, findAllTimeTokens, checkClockRegression, findTimeTokens, checkPropContinuity, propStateAt, spineDirective, type PropEvent, findFlashbackMismatches, findFragmentRuns, findFalseSceneBreaks, findEchoedPhrases, headingKey, collectNameForms, tightenSpeakerCues, SLUG_RE, TRANS_RE,
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

// ── a scene that stops on a cue or a bracket ────────────────────────────────────────────────

test('the two truncations an external reader found and the gate did not', () => {
  // Scene 30 of the 2 Sep draft, verbatim at the cut.
  const sc30 = 'INT. QUICK MARITIME — BRIDGE (FLASHBACK) - DAY\n\n'
    + '                      ALEXANDER (CONT\'D)\n                That\'s all a route is. A promise.\n'
    + '                      JASON QUICK\n                   (not looking up)\n                So?\n'
    + '                      ALEXANDER\n                   (smi';
  const d30 = checkSceneIntegrity(29, 'INT. QUICK MARITIME — BRIDGE (FLASHBACK) - DAY', sc30);
  assert.ok(d30.some((d) => d.kind === 'DANGLING_CUE'), 'a scene may not end on a parenthetical');
  assert.ok(d30.some((d) => d.kind === 'UNCLOSED_PAREN'), 'and the bracket is never closed');

  // Scene 74, which stopped on a bare GI where GIDEON should have been.
  const sc74 = 'INT. STUDY, BEACON HILL - NIGHT\n\n'
    + '   He turns the decanter a quarter-turn. Squares it.\n'
    + '                      ALEXANDER (CONT\'D)\n                He\'s become structural.\n'
    + '   Gideon doesn\'t move.\n   GI';
  const d74 = checkSceneIntegrity(73, 'INT. STUDY, BEACON HILL - NIGHT', sc74);
  assert.ok(d74.some((d) => d.kind === 'DANGLING_CUE'), 'a scene may not end on a cue with no speech');
});

test('a well-formed scene is never flagged by either rule', () => {
  const good = 'INT. HARBOUR SHACK - DAY\n\n'
    + '   Steam off the kettle. ARLO deals three cards.\n'
    + '                      ARLO\n                   (not looking)\n                You\'re down eleven.\n'
    + '   Jason turns a card over. Says nothing.\n';
  assert.deepEqual(checkSceneIntegrity(2, 'INT. HARBOUR SHACK - DAY', good), []);
});

test('a bracket wrapped across two action lines still balances', () => {
  // Per-line balance would call this broken. Over the body it is fine, which is why the count is
  // taken over the whole scene.
  const wrapped = 'INT. BOATHOUSE - DAY\n\n'
    + '   He opens the case (the one he carried up from\n   the skiff) and lifts out a coil of line.\n';
  assert.deepEqual(checkSceneIntegrity(4, 'INT. BOATHOUSE - DAY', wrapped), []);
});

test('a scene ending on a transition is legal — only cues and brackets are not', () => {
  const trans = 'EXT. QUAYSIDE - DAY\n\n   The ship swings out toward open water.\n\n   CUT TO:';
  assert.deepEqual(checkSceneIntegrity(5, 'EXT. QUAYSIDE - DAY', trans), []);
});

test('both new defects explain themselves to the writer', () => {
  assert.match(sceneDefectInstruction({ kind: 'DANGLING_CUE', sceneIndex: 0, detail: '(smi' }),
    /no speech after it/);
  assert.match(sceneDefectInstruction({ kind: 'UNCLOSED_PAREN', sceneIndex: 0, detail: '(smi' }),
    /unclosed bracket/);
});

// ── clocks people say out loud ──────────────────────────────────────────────────────────────

test('every spoken clock in the MINUTEMEN draft parses to the right minute', () => {
  const cases: [string, number][] = [
    ['zero-eight-two-four', 8 * 60 + 24], ['zero-eight-two-six', 8 * 60 + 26],
    ['zero-eight-forty-one', 8 * 60 + 41], ['zero-eight-forty-two', 8 * 60 + 42],
    ['zero eight twenty-nine', 8 * 60 + 29], ['zero-nine-forty', 9 * 60 + 40],
    ['zero-nine-forty-one', 9 * 60 + 41], ['zero-nine-forty-four', 9 * 60 + 44],
    ['zero-nine-fifty', 9 * 60 + 50], ['zero-nine-fifty-five', 9 * 60 + 55],
    ['zero-nine-fourteen', 9 * 60 + 14], ['nine-fifty-five', 9 * 60 + 55],
    ['nine twenty-two', 9 * 60 + 22], ['zero six hundred', 6 * 60],
  ];
  for (const [phrase, want] of cases) assert.equal(parseSpokenClock(phrase), want, phrase);
});

test('a count is not a clock — the leading zero is what makes one unambiguous', () => {
  // "Twenty two" read as 20:02 is the false positive that would retire this rule on arrival.
  for (const p of ['twenty two', 'one two', 'nine', 'forty five', 'Bay nine section two', 'six seven eight nine ten']) {
    assert.equal(parseSpokenClock(p), null, p);
  }
});

test('the old reader did not merely miss the spoken clock — it mis-read it', () => {
  const scene = 'INT. CAPSULE - DAY\n\n   The clock reads 09:19.\n\n'
    + '                      CROSS\n                Window opens zero-nine-fifty. Closes zero-nine-fifty-five.\n';
  const digits = findTimeTokens(0, scene);
  const all = findAllTimeTokens(0, scene);
  const at = (list: any[], m: number) => list.some((t) => t.minutes === m);
  assert.ok(at(digits, 9 * 60 + 50), 'it did catch the opening time');
  assert.ok(!at(digits, 9 * 60 + 55),
    'but it read "nine-fifty" out of "zero-nine-fifty-five" and returned 09:50 for a 09:55 — a WRONG value, not a gap');
  assert.ok(at(all, 9 * 60 + 55), 'the full reader closes the window at the minute the scene says');
  assert.ok(all.length > digits.length);
});

test('a clock on the wall may not run backwards, but a character may say any time at all', () => {
  const toks = [
    { sceneIndex: 10, minutes: 9 * 60 + 15, source: 'shown' as const, raw: '09:15' },
    { sceneIndex: 12, minutes: 9 * 60 + 50, source: 'spoken' as const, raw: 'zero-nine-fifty' },  // a future window
    { sceneIndex: 14, minutes: 8 * 60 + 8, source: 'spoken' as const, raw: '08:08' },             // a past relief
    { sceneIndex: 20, minutes: 7 * 60 + 58, source: 'shown' as const, raw: '07:58' },             // the real fault
  ];
  const f = checkClockRegression(toks);
  assert.equal(f.length, 1, 'only the wall clock counts');
  assert.match(f[0].detail, /09:15 in scene 11 and 07:58 in scene 21/);
});

test('a flashback is exempt, and crossing midnight is not a regression', () => {
  const back = [
    { sceneIndex: 1, minutes: 9 * 60, source: 'shown' as const, raw: '09:00' },
    { sceneIndex: 2, minutes: 4 * 60, source: 'shown' as const, raw: '04:00' },
  ];
  assert.equal(checkClockRegression(back, [2]).length, 0, 'the earlier scene is a flashback');
  const midnight = [
    { sceneIndex: 1, minutes: 23 * 60 + 50, source: 'shown' as const, raw: '23:50' },
    { sceneIndex: 2, minutes: 10, source: 'shown' as const, raw: '00:10' },
  ];
  assert.equal(checkClockRegression(midnight).length, 0, 'past midnight is the next day, not a fault');
});

// ── the spine: prop lifecycle and the writer's directive ────────────────────────────────────

test('THE LAMINATED CARD: binned in scene 62, back on the panel in 72', () => {
  const f = checkPropContinuity([
    { scene: 31, name: 'the laminated card', state: 'PLACED', note: 'face-up on the panel' },
    { scene: 62, name: 'the laminated card', state: 'DESTROYED', note: 'Cross bins it' },
    { scene: 72, name: 'the laminated card', state: 'PLACED', note: 'back on the panel' },
  ]);
  assert.equal(f.length, 1);
  assert.match(f[0].detail, /destroyed in scene 62.*appears again in scene 72/);
});

test("THE PASSPORT: burned in 105, beside the filing in 117, buried in 137", () => {
  const f = checkPropContinuity([
    { scene: 105, name: "Jason's passport", state: 'DESTROYED', note: 'burned' },
    { scene: 117, name: "Jason's passport", state: 'PLACED' },
    { scene: 137, name: 'the passport', state: 'PLACED', note: 'buried at the graves' },
  ]);
  assert.equal(f.length, 1);
  assert.match(f[0].detail, /scenes 117, 137/, '"the passport" is the same object as "Jason\'s passport"');
});

test('two owners are two objects — the fold refuses to guess when both could match', () => {
  assert.deepEqual(checkPropContinuity([
    { scene: 10, name: "Jason's passport", state: 'DESTROYED' },
    { scene: 20, name: "Sophie's passport", state: 'PLACED' },
  ]), []);
});

test('only DESTROYED is terminal — putting a thing down and picking it up is ordinary staging', () => {
  assert.deepEqual(checkPropContinuity([
    { scene: 5, name: 'the ledger', state: 'HIDDEN' },
    { scene: 40, name: 'the ledger', state: 'TAKEN' },
    { scene: 90, name: 'the ledger', state: 'GIVEN' },
    { scene: 95, name: 'the ledger', state: 'PLACED' },
  ]), []);
});

test('propStateAt reports the object as the scene OPENS, not after it', () => {
  const evs: PropEvent[] = [
    { scene: 31, name: 'the card', state: 'PLACED' },
    { scene: 62, name: 'the card', state: 'DESTROYED' },
  ];
  assert.equal(propStateAt(evs, 62).get('card')!.state, 'PLACED', 'scene 62 has not happened yet');
  assert.equal(propStateAt(evs, 63).get('card')!.state, 'DESTROYED');
});

test('the directive tells the writer what it could contradict, and nothing else', () => {
  const d = spineDirective(72, 9 * 60 + 14, [
    { scene: 62, name: 'the laminated card', state: 'DESTROYED', note: 'Cross bins it' },
  ], ['SKYLINE', 'Sortie Four']);
  assert.match(d, /it is 09:14/);
  assert.match(d, /09:14 or later/);
  assert.match(d, /the laminated card is destroyed/);
  assert.match(d, /A destroyed object does not come back/);
  assert.match(d, /SKYLINE, Sortie Four/);
});

test('with nothing to say the directive says nothing — a prompt is not a state dump', () => {
  assert.equal(spineDirective(1, null, [], []), '');
  assert.equal(spineDirective(1, null, [{ scene: 5, name: 'x', state: 'PLACED' }], []), '',
    'an object whose scene has not happened yet is not yet in play');
});

// ── the unmarked flashback ──────────────────────────────────────────────────────────────────

test('a scene planned as a memory but unmarked on the page is reported', () => {
  const f = findFlashbackMismatches([
    { heading: 'INT. BOAT BARN - DAY', text: 'INT. BOAT BARN - DAY\n\n   Callum coils rope. Jason watches.' },
  ], [1]);
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'UNMARKED_ON_THE_PAGE');
  assert.match(f[0].detail, /A reader meets it as the present/);
});

test('a scene marked on the page but missing from the plan is reported the other way', () => {
  const f = findFlashbackMismatches([
    { heading: 'INT. BOAT BARN — FLASHBACK - DAY', text: 'INT. BOAT BARN — FLASHBACK - DAY\n\n   Younger. Rope.' },
  ], []);
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'UNPLANNED_IN_THE_MAP');
  assert.match(f[0].detail, /counted it as present-day/);
});

test('agreement in either direction is silence', () => {
  assert.deepEqual(findFlashbackMismatches([
    { heading: 'INT. BARN — FLASHBACK - DAY', text: 'INT. BARN — FLASHBACK - DAY\n\n   Rope.' },
    { heading: 'EXT. DOCK - DAY', text: 'EXT. DOCK - DAY\n\n   Gulls.' },
  ], [1]), []);
});

test('a memory is told to announce itself, and told nothing about the present', () => {
  const d = spineDirective(94, 9 * 60 + 14, [
    { scene: 62, name: 'the card', state: 'DESTROYED' },
  ], ['SKYLINE'], true);
  assert.match(d, /THIS SCENE IS A MEMORY/);
  assert.match(d, /FLASHBACK in the slug line/);
  assert.match(d, /SKYLINE/);
});

// ─── scene density: fragment runs ───────────────────────────────────────────────────────────

test('an ordinary cross-cut run of short scenes is not a finding', () => {
  // Four short scenes between two full ones. Both delivered drafts are full of these.
  assert.deepEqual(findFragmentRuns([1.2, 0.3, 0.4, 0.2, 0.35, 1.1]), []);
});

test('six or more fragments back to back is a stretch the film never lands in', () => {
  const runs = findFragmentRuns([1.5, 0.3, 0.3, 0.2, 0.4, 0.3, 0.25, 1.2]);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].from, 2);
  assert.equal(runs[0].to, 7);
  assert.equal(runs[0].scenes, 6);
  assert.match(runs[0].detail, /none of them reaching half a page/);
});

test('the run is measured, not guessed — pages are summed across it', () => {
  const runs = findFragmentRuns([0.25, 0.25, 0.25, 0.25, 0.25, 0.25]);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].pages, 1.5);
});

test('a run that reaches the end of the draft still closes', () => {
  // Jason Quick's stub tail: the last eight scenes, all fragments, nothing after them.
  const runs = findFragmentRuns([1, 1, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].to, 9);
  assert.equal(runs[0].scenes, 7);
});

test('a scene of zero pages is missing, not short, and never starts a run', () => {
  assert.deepEqual(findFragmentRuns([0, 0, 0, 0, 0, 0, 0]), []);
});

// ─── repetition: scene breaks that break nothing ────────────────────────────────────────────

test('the scene number is stripped from a heading, the time of day is not', () => {
  assert.equal(headingKey('12  INT. CAPSULE - DAY'), 'INT CAPSULE DAY');
  assert.equal(headingKey('INT. CAPSULE - DAY'), 'INT CAPSULE DAY');
  assert.notEqual(headingKey('7  INT. CAPSULE - DAY'), headingKey('8  INT. CAPSULE - LATER'));
});

test('returning to a location across the film is not a false break', () => {
  // The boathouse three times with different business. Not consecutive, so not a run.
  assert.deepEqual(findFalseSceneBreaks([
    '1  INT. BOATHOUSE - DAY', '2  EXT. DOCK - DAY', '3  INT. BOATHOUSE - NIGHT',
    '4  INT. OFFICE - DAY', '5  INT. BOATHOUSE - DAY',
  ]), []);
});

test('two consecutive scenes on one slug are left alone; three are not', () => {
  assert.deepEqual(findFalseSceneBreaks([
    '1  INT. CAPSULE - DAY', '2  INT. CAPSULE - DAY', '3  EXT. PLAIN - DAY',
  ]), []);
  const runs = findFalseSceneBreaks([
    '1  INT. CAPSULE - DAY', '2  INT. CAPSULE - DAY', '3  INT. CAPSULE - DAY', '4  EXT. PLAIN - DAY',
  ]);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].scenes, 3);
  assert.match(runs[0].detail, /A scene break that breaks nothing is a paragraph/);
});

test('LATER and CONTINUOUS are how the format says time moved, so they break the run', () => {
  assert.deepEqual(findFalseSceneBreaks([
    '1  INT. CAPSULE - DAY', '2  INT. CAPSULE - LATER', '3  INT. CAPSULE - CONTINUOUS',
    '4  INT. CAPSULE - DAY',
  ]), []);
});

test('the MINUTEMEN shape: one heading swallowing the film, reported with its page cost', () => {
  const heads: string[] = [];
  const pages: number[] = [];
  for (let i = 1; i <= 24; i++) { heads.push(i + '  INT. ECHO-01 LAUNCH CONTROL CAPSULE - DAY'); pages.push(0.6); }
  heads.push('25  EXT. FROZEN PLAINS - DAY'); pages.push(1);
  const runs = findFalseSceneBreaks(heads, pages);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].scenes, 24);
  assert.equal(runs[0].pages, 14.4);
  assert.equal(runs[0].heading, 'INT. ECHO-01 LAUNCH CONTROL CAPSULE - DAY');
});

test('a blank heading is never a run, however many of them there are', () => {
  assert.deepEqual(findFalseSceneBreaks(['', '', '', '', '']), []);
});

// ─── repetition: echoed phrases ─────────────────────────────────────────────────────────────

test('a phrase in four scenes is below the bar; the fifth brings it into view', () => {
  const four = [1, 2, 3, 4].map(() => ({ text: 'He waits.\n\nShe doesn\'t look up.\n\nThe door closes.' }));
  assert.deepEqual(findEchoedPhrases(four), []);
  const five = four.concat([{ text: 'Rain on the glass.\n\nShe doesn\'t look up.' }]);
  const echo = findEchoedPhrases(five);
  assert.equal(echo.length, 1);
  assert.equal(echo[0].scenes.length, 5);
  assert.match(echo[0].detail, /either a motif or a tic/);
});

test('short lines are the vocabulary of the genre, never an echo', () => {
  // "Copy that." recurs in every procedural ever written and means nothing.
  const scenes = [1, 2, 3, 4, 5, 6, 7].map(() => ({ text: 'Copy that.\n\nSilence.\n\nHe nods.' }));
  assert.deepEqual(findEchoedPhrases(scenes), []);
});

test('a repeat inside ONE scene is not a repeat across scenes', () => {
  const scenes = [{ text: 'His left hand trembles.\n\nHe waits.\n\nHis left hand trembles.\n\nHis left hand trembles.\n\nHis left hand trembles.\n\nHis left hand trembles.' }];
  assert.deepEqual(findEchoedPhrases(scenes), []);
});

test('slug lines and character cues are not prose and are never counted', () => {
  const scenes = [1, 2, 3, 4, 5, 6].map((i) => ({
    text: 'INT. LAUNCH CONTROL CAPSULE - DAY\n\n                    CROSS\n          Nothing yet.',
  }));
  assert.deepEqual(findEchoedPhrases(scenes), []);
});

test('the loudest echo is reported first', () => {
  const scenes = [
    { text: 'The room holds its breath.\n\nNobody moves toward it.' },
    { text: 'The room holds its breath.\n\nNobody moves toward it.' },
    { text: 'The room holds its breath.\n\nNobody moves toward it.' },
    { text: 'The room holds its breath.\n\nNobody moves toward it.' },
    { text: 'The room holds its breath.\n\nNobody moves toward it.' },
    { text: 'The room holds its breath.' },
  ];
  const echo = findEchoedPhrases(scenes);
  assert.equal(echo.length, 2);
  assert.equal(echo[0].scenes.length, 6);
  assert.match(echo[0].phrase, /holds its breath/);
});

// ── NAME DRIFT: THE FOUR MEASURED FALSE POSITIVES (2 Oct, Jason Quick) ────────────────────────
//
// verifyAndRepair logged "scene 30 — name corrected to ALEXANDER QUICK" and the page was left
// reading "A headline resolves: ALEXANDER QUICK —". The substitution is gone from the service; these
// pin the collector so the finding that drove it is not raised in the first place. Every fixture
// below is the real shape from revision cmuqy7say000bkn0guamrubkg.

/** A cue and its speech, as the writer emits them: name, newline, line. */
const cueThen = (cue: string, line: string) => cue + '\n' + line;

test('(a) a capitalised run does NOT cross a line break — a cue is not part of its speech', () => {
  const sc = [{ text: '1  INT. CAR - NIGHT\n\n' + cueThen('JASON', 'Drive.') + '\n\nJASON QUICK grips the wheel.\n' }];
  const forms = collectNameForms(sc, ['JASON QUICK']);
  const got = (forms.get('JASON') || []).map((f) => f.form);
  assert.deepEqual(got, ['JASON QUICK'], 'got ' + JSON.stringify(got) + ' — "JASON DRIVE" is a cue plus a word');
});

test('(a) and it holds for the whole measured draft — no cue-plus-word forms survive', () => {
  // Three real pairs from the 2 Oct draft that produced phantom names.
  const sc = [{ text: [cueThen('JASON', "That's not what I said."), cueThen('SOPHIE', 'No.'),
    cueThen('ALEXANDER', 'You will sit down.')].join('\n\n') }];
  const all = [...collectNameForms(sc, ['JASON QUICK', 'SOPHIE QUICK', 'ALEXANDER QUICK']).values()]
    .reduce((a: any[], v: any[]) => a.concat(v), []).map((f: any) => f.form);
  assert.deepEqual(all, [], 'these runs are cue + first word of speech: ' + JSON.stringify(all));
});

test("(b) a possessive is the same name — ADRIAN COLE'S is ADRIAN COLE, both apostrophes", () => {
  for (const apo of ["'", '’']) {
    const sc = [{ text: '1  INT. DOCK - DAY\n\nADRIAN COLE' + apo + 'S launch idles.\n' },
                { text: '2  INT. DOCK - DAY\n\nADRIAN COLE steps off.\n' }];
    const forms = (collectNameForms(sc, ['ADRIAN COLE']).get('ADRIAN') || []).map((f) => f.form);
    assert.deepEqual(forms, ['ADRIAN COLE'], apo + ' produced ' + JSON.stringify(forms));
    assert.equal(findNameDrift(sc.map((x, i) => ({ heading: String(i), text: x.text })), ['ADRIAN COLE'], []).length, 0);
  }
});

test('(c) the presence test reads the SAME filtered prose as the collector, not the heading', () => {
  /*
   * This has to be built so the fix is actually exercised: a real drift must exist somewhere, and
   * the WRONG form must appear in a third scene ONLY inside its heading. Reading raw text there
   * reports a scene for a spelling the collector never saw in its prose. (A first version of this
   * test used a scene with no collected forms at all, so the presence test was never reached and
   * the test passed with the fix reverted — it proved nothing.)
   */
  const sc = [
    { heading: '1  INT. DOCK - DAY', text: '1  INT. DOCK - DAY\n\nADRIAN COLE steps off.\n' },
    { heading: '2  INT. DOCK - DAY', text: '2  INT. DOCK - DAY\n\nADRIAN COLSE waits.\n' },
    { heading: "3  INT. ADRIAN COLSE'S BOAT - DAY", text: "3  INT. ADRIAN COLSE'S BOAT - DAY\n\nRain on the glass.\n" },
  ];
  const f = findNameDrift(sc, ['ADRIAN COLE'], []);
  const scenes = f.map((x) => x.sceneIndex + 1);
  assert.deepEqual(scenes, [2], 'only scene 2 has the misspelling in its PROSE; got ' + JSON.stringify(scenes));
  // And the heading is not evidence either way for the collector.
  assert.deepEqual([...collectNameForms([sc[2]], ['ADRIAN COLE']).values()], [],
    'a heading is ours — it is never evidence of a character spelling');
});

test('(d) a run that STARTS with a registered name is that name plus words', () => {
  const sc = [{ heading: '1  INT. OFFICE - DAY',
    text: "1  INT. OFFICE - DAY\n\nA headline resolves: ALEXANDER QUICK'S SON ALIVE —\n\nALEXANDER QUICK stands.\n" }];
  const forms = (collectNameForms(sc, ['ALEXANDER QUICK']).get('ALEXANDER') || []).map((f) => f.form);
  assert.deepEqual(forms, ['ALEXANDER QUICK'], 'got ' + JSON.stringify(forms));
  assert.equal(findNameDrift(sc, ['ALEXANDER QUICK'], []).length, 0, 'the measured headline case');
});

test('(d) a run that IS a registered name entire is left alone', () => {
  const sc = [{ text: '1  INT. A - DAY\n\nALEXANDER QUICK signs.\n' }];
  assert.deepEqual((collectNameForms(sc, ['ALEXANDER QUICK']).get('ALEXANDER') || []).map((f) => f.form),
    ['ALEXANDER QUICK']);
});

test('(fifth rule) two REGISTERED names sharing a key are two people, not one misspelled', () => {
  // keyName reduces both to "ATTACKER". Scene 2 of the draft has both cues.
  const sc = [{ heading: '2  EXT. GATE - NIGHT',
    text: '2  EXT. GATE - NIGHT\n\nATTACKER ONE (O.S.) moves left.\n\nATTACKER TWO (O.S.) follows.\n' }];
  assert.equal(findNameDrift(sc, ['ATTACKER ONE', 'ATTACKER TWO'], []).length, 0);
  // But an UNregistered variant of a registered name is still drift.
  const sc2 = [{ heading: '1', text: '1  INT. A - DAY\n\nATTACKER ONE waits.\n' },
               { heading: '2', text: '2  INT. B - DAY\n\nATTACKER THREE waits.\n' }];
  assert.equal(findNameDrift(sc2, ['ATTACKER ONE'], []).length, 1, 'ATTACKER THREE is not on the cast');
});

test('THE CONTRACT THAT MUST SURVIVE — a genuine middle-name variant is still reported', () => {
  const sc = [{ heading: '1', text: '1  INT. A - DAY\n\nJASON ANDREW QUICK signs.\n' },
              { heading: '2', text: '2  INT. B - DAY\n\nJASON RICHARD QUICK signs again.\n' }];
  const f = findNameDrift(sc, ['JASON ANDREW QUICK'], []);
  assert.equal(f.length, 1, 'suppressing this would be the opposite defect');
  assert.equal(f[0].kind, 'NAME_DRIFT');
});

test('NEGATIVE CONTROL — the OLD collector produced the cue-plus-word name', () => {
  // The previous rule, reconstructed: match the run regex over the lines JOINED, so \s+ crosses
  // the newline between a cue and its speech.
  const RUN = /\b\p{Lu}[\p{Ll}\p{Lu}'’-]+(?:\s+\p{Lu}[\p{Ll}\p{Lu}'’-]+)+/gu;
  const joined = cueThen('JASON', 'Drive.');
  // The regex captures the newline inside the run; normaliseCharacterName then collapses \s+ to a
  // single space, which is where "JASON\nDRIVE" became the name "JASON DRIVE".
  const raw = joined.match(RUN) || [];
  assert.deepEqual(raw, ['JASON\nDrive'], 'the run crossed the line break: ' + JSON.stringify(raw));
  const old = raw.map((r) => normaliseCharacterName(r));
  assert.ok(old.indexOf('JASON DRIVE') >= 0, 'the old form is the defect: ' + JSON.stringify(old));
  // And the collector no longer yields it.
  const now = (collectNameForms([{ text: joined }], ['JASON QUICK']).get('JASON') || []).map((f) => f.form);
  assert.deepEqual(now, []);
});

test("NEGATIVE CONTROL — without possessive folding, ADRIAN COLE'S reads as a second name", () => {
  const two = [{ form: "ADRIAN COLE'S", count: 1 }, { form: 'ADRIAN COLE', count: 1 }];
  assert.notEqual(two[0].form, two[1].form, 'unfolded they are two forms — the defect');
  const sc = [{ heading: '1', text: "1  INT. A - DAY\n\nADRIAN COLE'S launch idles.\n" },
              { heading: '2', text: '2  INT. B - DAY\n\nADRIAN COLE steps off.\n' }];
  assert.equal(findNameDrift(sc, ['ADRIAN COLE'], []).length, 0, 'folded, they are one name');
});

// ── ONE NAME WRITTEN LONG AND SHORT, AND WHO IS A DIFFERENT PERSON ───────────────────────────
//
// Commit A reported JASON QUICK against JASON ALEXANDER QUICK on the 2 Oct draft and argued it was
// a true positive. It is not: the bible's register names "Jason Alexander Quick" as his identity,
// and the finding count was an artefact of how the cast list happened to be spelled — the same text
// gave 0 findings spelled JASON, 2 spelled JASON QUICK, 1 spelled JASON ALEXANDER QUICK.

/** Scenes with a one-line body each, the shape findNameDrift is given in production. */
const body = (...bodies: string[]) => bodies.map((b, i) => ({
  heading: String(i + 1), text: (i + 1) + '  INT. ROOM - DAY\n\n' + b + '\n',
}));

test('(A2-a) a shorter spelling inside a longer one is ONE name, not drift', () => {
  assert.equal(findNameDrift(body('JASON QUICK waits.', 'JASON ALEXANDER QUICK signs.'), ['JASON QUICK'], []).length, 0);
  // and the other way round — which spelling is on the cast list must not change the answer
  assert.equal(findNameDrift(body('JASON QUICK waits.', 'JASON ALEXANDER QUICK signs.'), ['JASON ALEXANDER QUICK'], []).length, 0);
});

test('(A2-a) the count no longer flips with the cast spelling', () => {
  const scenes = body('JASON QUICK waits.', 'JASON ALEXANDER QUICK signs.', 'JASON ALEXANDER QUICK leaves.');
  const counts = ['JASON', 'JASON QUICK', 'JASON ALEXANDER QUICK']
    .map((cast) => findNameDrift(scenes, [cast], []).length);
  assert.deepEqual(counts, [0, 0, 0], 'spelled JASON / JASON QUICK / JASON ALEXANDER QUICK: ' + JSON.stringify(counts));
});

test('(A2-a) but a form that conflicts with a MORE-USED form is still reported', () => {
  // Both long forms are compatible with the canonical; they are not compatible with each other.
  const f = findNameDrift(body('JASON QUICK waits.', 'JASON ANDREW QUICK signs.',
    'JASON ANDREW QUICK signs again.', 'JASON RICHARD QUICK signs.'), ['JASON QUICK'], []);
  const forms = [...new Set(f.flatMap((x) => x.names.slice(1)))];
  assert.deepEqual(forms, ['JASON RICHARD QUICK'],
    'the rarer of two incompatible middle names is the one to report; got ' + JSON.stringify(forms));
});

test('(A2-b) two registered forms are different people only when the LAST token differs', () => {
  // Different last token: two people.
  assert.equal(findNameDrift(body('ATTACKER ONE moves.', 'ATTACKER TWO follows.'),
    ['ATTACKER ONE', 'ATTACKER TWO'], []).length, 0);
  // Same first and last, different middle: one person, still reported even though both are cast.
  assert.equal(findNameDrift(body('JASON ANDREW QUICK signs.', 'JASON RICHARD QUICK signs again.'),
    ['JASON ANDREW QUICK', 'JASON RICHARD QUICK'], []).length, 1,
    'the first version of this rule excused any registered form and hid this contradiction');
});

test('(A2) THE CONTRACT STILL HOLDS — spec :323 reports', () => {
  const f = findNameDrift(body('JASON ANDREW QUICK signs.', 'JASON RICHARD QUICK signs again.'),
    ['JASON ANDREW QUICK'], []);
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'NAME_DRIFT');
});

test('NEGATIVE CONTROL (A2-a) — without subsumption, the long form is reported as drift', () => {
  // The rule it replaced: anything that is not the canonical string is wrong.
  const forms = [{ form: 'JASON QUICK', count: 3 }, { form: 'JASON ALEXANDER QUICK', count: 2 }];
  const canonical = 'JASON QUICK';
  const oldWrong = forms.filter((f) => f.form !== canonical).map((f) => f.form);
  assert.deepEqual(oldWrong, ['JASON ALEXANDER QUICK'], 'the old rule reported it — the defect');
  // and the collector no longer does
  assert.equal(findNameDrift(body('JASON QUICK waits.', 'JASON ALEXANDER QUICK signs.'), ['JASON QUICK'], []).length, 0);
});

test('NEGATIVE CONTROL (A2-b) — the WIDE fifth rule hid a real middle-name contradiction', () => {
  const registered = ['JASON ANDREW QUICK', 'JASON RICHARD QUICK'];
  const canonical = 'JASON ANDREW QUICK';
  const other = 'JASON RICHARD QUICK';
  // The wide rule: any registered form is excused.
  assert.equal(registered.indexOf(other) >= 0, true, 'the wide rule would have excused it — the defect');
  // The narrow rule: excused only if the last token differs.
  const lastOf = (n: string) => n.split(' ').slice(-1)[0];
  assert.equal(lastOf(other) === lastOf(canonical), true, 'same last token, so one person');
  assert.equal(findNameDrift(body('JASON ANDREW QUICK signs.', 'JASON RICHARD QUICK signs again.'),
    registered, []).length, 1, 'and it is reported');
});

// ── THE TIE, AND NAMING THE RIVAL ─────────────────────────────────────────────────────────────
//
// A2 reported only a form that conflicted with a form used MORE often. On a tie that test has no
// answer, so two single-use middle names cancelled each other and the scene reported nothing —
// worse than the over-reporting it replaced, because two competing spellings is the ordinary case.
// At fcccee7 both were reported; at 56186e8 neither was.

test('(A3) A TIE IS BROKEN BY WHICHEVER APPEARED FIRST — the later one is reported', () => {
  const f = findNameDrift(body('JASON QUICK waits.', 'JASON ANDREW QUICK signs.',
    'JASON RICHARD QUICK signs again.'), ['JASON QUICK'], []);
  const forms = [...new Set(f.flatMap((x) => x.names.slice(1)))];
  assert.deepEqual(forms, ['JASON RICHARD QUICK'],
    'Andrew is in scene 2 and Richard in scene 3, both once; got ' + JSON.stringify(forms));
  assert.equal(f.length, 1);
});

test('(A3) and the tie-break follows the order of appearance, not the alphabet', () => {
  // Richard first this time: Andrew becomes the later one and is the one reported.
  const f = findNameDrift(body('JASON QUICK waits.', 'JASON RICHARD QUICK signs.',
    'JASON ANDREW QUICK signs again.'), ['JASON QUICK'], []);
  assert.deepEqual([...new Set(f.flatMap((x) => x.names.slice(1)))], ['JASON ANDREW QUICK']);
});

test('(A3) the detail names the form it ACTUALLY conflicts with', () => {
  const f = findNameDrift(body('JASON QUICK waits.', 'JASON ANDREW QUICK signs.',
    'JASON RICHARD QUICK signs again.'), ['JASON QUICK'], []);
  assert.match(f[0].detail, /written as "JASON RICHARD QUICK" here/);
  assert.match(f[0].detail, /but as "JASON ANDREW QUICK" elsewhere/,
    'it used to name the canonical — telling the reader to write JASON QUICK, which is not the conflict');
  assert.doesNotMatch(f[0].detail, /but as "JASON QUICK" elsewhere/);
});

test('(A3) a form that conflicts with the CANONICAL still names the canonical', () => {
  // Nothing subsumes anything here, so the canonical is the real counterpart.
  const f = findNameDrift(body('JASON ANDREW QUICK signs.', 'JASON RICHARD QUICK signs again.'),
    ['JASON ANDREW QUICK'], []);
  assert.match(f[0].detail, /but as "JASON ANDREW QUICK" elsewhere/);
});

test('NEGATIVE CONTROL (A3) — without the tie half, two single-use spellings cancel out', () => {
  // The A2 rule, reconstructed: a rival must be used strictly more often.
  const forms = [{ form: 'JASON QUICK', count: 1, firstScene: 0 },
    { form: 'JASON ANDREW QUICK', count: 1, firstScene: 1 },
    { form: 'JASON RICHARD QUICK', count: 1, firstScene: 2 }];
  const subseq = (a: string, b: string) => {
    const x = a.split(' '); const y = b.split(' '); let i = 0;
    for (const t of y) if (i < x.length && t === x[i]) i++;
    return i === x.length;
  };
  const compat = (a: string, b: string) => a === b || subseq(a, b) || subseq(b, a);
  const canonical = 'JASON QUICK';
  const oldWrong = forms.filter((f) => f.form !== canonical
    && (!compat(f.form, canonical) || forms.some((g) => g.count > f.count && !compat(f.form, g.form))));
  assert.deepEqual(oldWrong.map((f) => f.form), [], 'strictly-more-often reported nothing — the defect');
  // With the tie half, the later one is reported.
  const f = findNameDrift(body('JASON QUICK waits.', 'JASON ANDREW QUICK signs.',
    'JASON RICHARD QUICK signs again.'), ['JASON QUICK'], []);
  assert.deepEqual([...new Set(f.flatMap((x) => x.names.slice(1)))], ['JASON RICHARD QUICK']);
});

// ── THE GAP BETWEEN A SPEAKER AND THEIR SPEECH ────────────────────────────────────────────────
//
// nextInSpeech('blank') is false by design, so a cue, a blank, then the line made classifyLine read
// the line as ACTION with inSpeech false — a character's words rendered as stage direction.
// Measured on revision cmuqy7say000bkn0guamrubkg: 99 cues whose speech did not classify as
// dialogue, 112 gaps, in eight consecutive scenes.
//
// The first version acted under ANY line satisfying looksLikeCue whenever the next line held a
// lower-case letter — and every action paragraph holds one. It joined BANG to "The door flies
// open." Its own doc comment said beats were left alone; nothing had tested it. A line must NAME a
// speaker: a cue extension, or a match against the speakers the caller knows.

const SPEAKERS = ['JASON', 'NORA', 'MUSA', 'MOIRA', 'THE BOY', 'CALLUM', 'SOPHIE', 'MARCUS', 'GIDEON'];

test('(B2-1) THE FOUR PROBES — an all-caps beat is never a speaker, list or no list', () => {
  const probes = [
    'BANG\n\nThe door flies open.',
    'THE DOOR SLAMS OPEN\n\nJason turns.',
    'THE ELEVEN NAMES\n\nJason writes them.',
    'SUPER: SEVEN YEARS EARLIER\n\nRain.',
  ];
  for (const t of probes) {
    assert.equal(tightenSpeakerCues(t), t, 'no list: ' + JSON.stringify(t.split('\n')[0]));
    assert.equal(tightenSpeakerCues(t, SPEAKERS), t, 'with a cast: ' + JSON.stringify(t.split('\n')[0]));
  }
});

test("(B2-1) spec :35's own text survives both ways", () => {
  const t = 'BANG\n\nThe door gives.\n\nJASON\nGet down.';
  assert.equal(tightenSpeakerCues(t), t);
  assert.equal(tightenSpeakerCues(t, SPEAKERS), t, 'JASON is already adjacent to its speech');
  // and the classification spec :35 relies on is unchanged by the rewrite
  const cues = classifyScript(tightenSpeakerCues(t, SPEAKERS)).filter((l) => l.kind === 'cue');
  assert.equal(cues[0].text, 'BANG');
  assert.equal(cues[0].speaks, false, 'BANG still has no speech under it');
});

test('(B2-1i) a cue EXTENSION names a speaker with no list at all', () => {
  for (const ext of ["(CONT'D)", '(O.S.)', '(V.O.)', '(O.C.)']) {
    assert.equal(tightenSpeakerCues('SOMEONE ' + ext + '\n\nHold on.'), 'SOMEONE ' + ext + '\nHold on.', ext);
  }
  // (MORE) renders on the cue line but is a page-break artefact, not evidence of a speaker.
  assert.equal(tightenSpeakerCues('SOMEONE (MORE)\n\nHold on.'), 'SOMEONE (MORE)\n\nHold on.');
});

test('(B2-1ii) a known speaker names one; an unknown all-caps line does not', () => {
  assert.equal(tightenSpeakerCues('NORA\n\nComing round.', SPEAKERS), 'NORA\nComing round.');
  assert.equal(tightenSpeakerCues('NORA\n\nComing round.'), 'NORA\n\nComing round.', 'no list, no match');
  assert.equal(tightenSpeakerCues('THE ELEVEN NAMES\n\nJason writes them.', SPEAKERS),
    'THE ELEVEN NAMES\n\nJason writes them.', 'not in the cast');
});

test('(B2-1ii) sameCharacter does the matching, so a fuller cue still resolves', () => {
  assert.equal(tightenSpeakerCues('JASON QUICK\n\nSecond hook.', ['JASON']), 'JASON QUICK\nSecond hook.');
});

test('(B2-3) under a named speaker the speech is taken whatever its case', () => {
  assert.equal(tightenSpeakerCues('MUSA\n\nTHE MERCY.', SPEAKERS), 'MUSA\nTHE MERCY.',
    'an all-caps shout is still speech — this was the one bad cue left after commit B');
  const after = classifyScript(tightenSpeakerCues('MUSA\n\nTHE MERCY.', SPEAKERS));
  assert.equal(after[0].kind, 'cue');
  assert.equal(after[1].kind, 'dialogue');
});

test('(B2-3) but not when the next line is itself a cue, a slug or a transition', () => {
  assert.equal(tightenSpeakerCues('JASON\n\nNORA\n\nComing round.', SPEAKERS).split('\n')[1], '',
    'two cues in a row must stay apart');
  assert.equal(tightenSpeakerCues('JASON\n\nINT. BOAT - DAY', SPEAKERS), 'JASON\n\nINT. BOAT - DAY');
  assert.equal(tightenSpeakerCues('JASON\n\nCUT TO:', SPEAKERS), 'JASON\n\nCUT TO:');
});

test('(B2) a short SLUG is not a speaker — even when the cast shares a word with it', () => {
  assert.equal(looksLikeCue('EXT. DOCK ROAD - CONTINUOUS'), true, 'the trap');
  const slug = 'EXT. DOCK ROAD - CONTINUOUS\n\nHe comes out onto cracked tarmac.';
  assert.equal(tightenSpeakerCues(slug, SPEAKERS), slug);
  /*
   * The guard is NOT redundant, and this is the case that shows it. sameCharacter matches on token
   * overlap, so a cast entry of "BOAT" matches the slug "INT. BOAT - DAY" — nameTokens of the slug
   * contains BOAT. splitCast reads plan data, which can carry entries like that. Without the
   * slug/transition test the heading would qualify as a speaker and swallow the action beneath it.
   */
  assert.equal(sameCharacter('BOAT', 'INT BOAT DAY'), true, 'the overlap is real');
  const slugShared = 'INT. BOAT - DAY\n\nHe waits at the rail.';
  assert.equal(tightenSpeakerCues(slugShared, ['BOAT']), slugShared);
  const transShared = 'CUT TO:\n\nThe kettle is still whistling.';
  assert.equal(tightenSpeakerCues(transShared, ['CUT']), transShared);
});

test('(B2-a/b) the blanks close and a prose parenthetical splits — under a named speaker only', () => {
  assert.equal(tightenSpeakerCues('JASON\n\n\n\nSecond hook.', SPEAKERS), 'JASON\nSecond hook.');
  assert.equal(tightenSpeakerCues('NORA (at the helm, shouting back)\n\nComing round.', SPEAKERS),
    'NORA\n(at the helm, shouting back)\nComing round.');
  assert.equal(tightenSpeakerCues("NORA (CONT'D) (at the helm)\n\nComing round.", SPEAKERS),
    "NORA (CONT'D)\n(at the helm)\nComing round.");
  // Not a known speaker and no extension: left alone entirely.
  assert.equal(tightenSpeakerCues('THE ELEVEN NAMES (carved shallow)\n\nJason reads.'),
    'THE ELEVEN NAMES (carved shallow)\n\nJason reads.');
});

test('(B2) idempotent, with and without a list', () => {
  for (const t of ['JASON\n\nSecond hook.', 'NORA (at the helm)\n\nComing round.', 'BANG\n\nThe door gives.',
    'MUSA\n\nTHE MERCY.', 'EXT. DOCK - DAY\n\nHe waits.', '', '\n\n']) {
    for (const list of [undefined, SPEAKERS] as any[]) {
      const once = tightenSpeakerCues(t, list);
      assert.equal(tightenSpeakerCues(once, list), once, JSON.stringify(t));
    }
  }
});

test('NEGATIVE CONTROL (B2-1) — the loose rule joined every all-caps line to the next paragraph', () => {
  // The shipped-and-withdrawn rule: looksLikeCue, and a follower with a lower-case letter.
  const loose = (text: string) => {
    const lines = text.split('\n'); const out: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      out.push(lines[i]);
      const t = lines[i].trim();
      if (SLUG_RE.test(t) || TRANS_RE.test(t) || !looksLikeCue(t)) continue;
      let j = i + 1; while (j < lines.length && !lines[j].trim()) j++;
      if (j > i + 1 && j < lines.length && /\p{Ll}/u.test(lines[j].trim())) i = j - 1;
    }
    return out.join('\n');
  };
  assert.equal(loose('BANG\n\nThe door flies open.'), 'BANG\nThe door flies open.',
    'the defect: BANG speaks the action');
  assert.equal(tightenSpeakerCues('BANG\n\nThe door flies open.', SPEAKERS), 'BANG\n\nThe door flies open.');
});

test('NEGATIVE CONTROL (B2-3) — refusing an all-caps follower leaves a shout as action', () => {
  // The commit-B guard: the follower had to contain a lower-case letter.
  const needsLower = /\p{Ll}/u.test('THE MERCY.');
  assert.equal(needsLower, false, 'so the gap stayed open and the shout classified as action');
  assert.equal(classifyScript('MUSA\n\nTHE MERCY.')[2].kind, 'action');
  assert.equal(classifyScript(tightenSpeakerCues('MUSA\n\nTHE MERCY.', SPEAKERS))[1].kind, 'dialogue');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// PLAN 01 TASK 0 STEP 2 — THE LANGUAGE CASE, ON REAL DRAFTS.
//
// The claim here is about real scripts, so it is made against real scripts. Both skip BY NAME when
// their capture is not on the machine; the screenplays stay out of the repo.
//
// What this pins: the Arabic blindness is the \p{Lu} RUN regex at collectNameForms, and NOTHING
// ELSE. The cast is real (looksLikeCue reads Arabic cues), the key names are real, the early return
// at the top of collectNameForms is NOT taken — and the result is still empty. Without this test the
// Arabic NOT_RUN rule would rest on an argument instead of a measurement.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const DAS_CAP = loadCapture('DAS-script.json');
const MM_CAP = loadCapture('MM-script.json');

test('ARABIC (داس) — a real cast, real key names, and still zero name forms',
  DAS_CAP ? {} : { skip: missingCapture('DAS-script.json') }, () => {
    const c = DAS_CAP!;
    assert.ok(c.script.arabicShare > 0.9, 'arabicShare=' + c.script.arabicShare);
    assert.ok(c.script.latin > 0, 'a real Arabic screenplay still carries Latin: ' + c.script.latin + ' letters');

    const cast = c.cueCast.map((x) => x.name);
    assert.equal(cast.length, 37, 'looksLikeCue found this many speakers in an Arabic draft');

    const keys = cast.map((n) => keyName(n)).filter((k) => k.length >= 3);
    assert.equal(keys.length, 36,
      'collectNameForms returns early only when NO key is >= 3 chars — it does not here, so the zero below is real');

    assert.equal(collectNameForms(c.pageText, cast).size, 0,
      'zero forms from a real cast: the blindness is the \\p{Lu} RUN regex, not an empty-cast shortcut');
  });

test('MINUTEMEN — the same call on a Latin draft finds forms',
  MM_CAP ? {} : { skip: missingCapture('MM-script.json') }, () => {
    const c = MM_CAP!;
    assert.equal(c.script.latinShare, 1);
    const cast = c.cueCast.map((x) => x.name);
    assert.equal(cast.length, 12);
    assert.equal(cast.map((n) => keyName(n)).filter((k) => k.length >= 3).length, 12);
    assert.equal(collectNameForms(c.pageText, cast).size, 4,
      'the contrast that makes the Arabic zero mean something');
  });

test('CONTROL — an empty cast returns an empty Map in EITHER language, which is why the tests above pass their own cast',
  (DAS_CAP && MM_CAP) ? {} : { skip: missingCapture('DAS-script.json / MM-script.json') }, () => {
    assert.equal(collectNameForms(DAS_CAP!.pageText, []).size, 0);
    assert.equal(collectNameForms(MM_CAP!.pageText, []).size, 0,
      'a Latin draft also returns 0 with no cast — so an empty-cast probe proves nothing about language');
  });

// ─────────────────────────────────────────────────────────────────────────────────────────────
// PLAN 01 TASK 8 — THE NAME CHECK'S TWO KNOWN BLIND SPOTS.
//
// Both were recorded as residue when A3 shipped and both were measured against the shipped code
// before these tests were written. Small invented names, per standing rule 1.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const SC = (...t: string[]) => t.map((text, i) => ({ heading: (i + 1) + '  INT. ROOM - DAY', text }));

test('TASK 8 LIMIT — one full form under a first-name cast stays silent, and must', () => {
  const f = findNameDrift(SC('ALDER VOSS walks in.', 'ALDER VOSS sits down.'), ['ALDER'], []);
  assert.equal(f.length, 0, 'one person, two compatible spellings — subsumes is doing its job');
});

test('TASK 8 — a first-name cast no longer hides a drift between two DIFFERENT full forms', () => {
  const f = findNameDrift(SC('ALDER VOSS walks in.', 'ALDER VANCE sits down.'), ['ALDER'], []);
  assert.equal(f.length, 1, 'measured 0 before this task');
  assert.match(f[0].detail, /ALDER VANCE/);
  assert.match(f[0].detail, /ALDER VOSS/, 'reported against the form it conflicts with');
});

test('TASK 8 CONTROL — the same pages already reported it when the longer form was cast', () => {
  const f = findNameDrift(SC('ALDER VOSS walks in.', 'ALDER VANCE sits down.'), ['ALDER VOSS'], []);
  assert.equal(f.length, 1, 'this path always worked — the registry just had to match a written form');
});

/**
 * HELD, NOT DROPPED. This expectation contradicts a shipped test twenty lines up —
 * "(fifth rule) two REGISTERED names sharing a key are two people, not one misspelled" — whose
 * second half asserts the opposite for the same shape:
 *
 *   cast ['ATTACKER ONE'], pages ATTACKER ONE + ATTACKER THREE  ->  1   ("not on the cast")
 *   cast ['WARDEN ONE'],   pages WARDEN ONE + TWO + THREE       ->  0   (task 8's ruling)
 *
 * Both are an unregistered enumerated extra beside a registered one, and there is no principled
 * difference between them — only the number of forms and whether the sequence has a gap, neither of
 * which anyone has ruled on. Making this pass means deciding that an unregistered variant of a
 * registered name is NOT drift, which is what the fifth rule exists to assert.
 *
 * So it is skipped by name, with the conflict in the reason, until Qais rules. Deleting it would
 * lose the blind spot; weakening the fifth rule to make it pass would be bending a shipped,
 * deliberate test to fit a new one.
 */
test('TASK 8 — extras sharing a role noun are not one person',
  { skip: 'HELD: contradicts "(fifth rule) two REGISTERED names sharing a key…", which requires an unregistered ATTACKER THREE beside a registered ATTACKER ONE to be reported as drift. Needs a ruling.' },
  () => {
    const f = findNameDrift(SC('WARDEN ONE opens.', 'WARDEN TWO closes.', 'WARDEN THREE waits.'), ['WARDEN ONE'], []);
    assert.equal(f.length, 0, 'measured 2 today — one finding per scene carrying a wrong form');
  });

test('TASK 8 CONTROL — without the role noun in the cast there is nothing to start red', () => {
  const f = findNameDrift(SC('WARDEN ONE opens.', 'WARDEN TWO closes.'), ['ALDER'], []);
  assert.equal(f.length, 0, 'collectNameForms keys on tracked names, so this probe proves nothing');
});

test('TASK 8 LIMIT — the enumerator exemption does NOT excuse a real surname drift', () => {
  const f = findNameDrift(SC('ALDER VOSS walks in.', 'ALDER VOSSE sits down.'), ['ALDER VOSS'], []);
  assert.equal(f.length, 1, 'VOSSE is not an enumerator — a misspelled surname is still a drift');
});

test('TASK 8 LIMIT — subsumption still protects a longer spelling of one registered person', () => {
  const f = findNameDrift(SC('ALDER VOSS walks in.', 'ALDER MARTIN VOSS sits down.'), ['ALDER VOSS'], []);
  assert.equal(f.length, 0, 'the JASON ALEXANDER QUICK ruling — one person, two compatible forms');
});

test('TASK 8 LIMIT — an unregistered name is still not acted on at all', () => {
  const f = findNameDrift(SC('BRENN HALE walks in.', 'BRENN VOSS sits down.'), ['ALDER'], []);
  assert.equal(f.length, 0, 'nothing in the registry recognises BRENN — guessing is the 1 Sep failure');
});

test('TASK 8 LIMIT — a registered name that is NOT a spelling of either written form vouches for neither', () => {
  // keyName('ALDER VOSS') is ALDER, so both forms are collected — they reach canonicalForm. But the
  // registry names ALDER VOSS, and neither ALDER HALE nor ALDER MARK is a spelling of it, so we do
  // not know which is right. '' means "no canonical", which means no report. Guessing here is the
  // 1 Sep failure.
  //
  // This is the probe that makes the `subsumes` constraint in `vouched` load-bearing: the earlier
  // BRENN test passes because collectNameForms never collects an unkeyed name at all, so it cannot
  // distinguish "vouched by containment" from "vouched by having any registry at all".
  const f = findNameDrift(SC('ALDER HALE walks in.', 'ALDER MARK sits down.'), ['ALDER VOSS'], []);
  assert.equal(f.length, 0);
});
