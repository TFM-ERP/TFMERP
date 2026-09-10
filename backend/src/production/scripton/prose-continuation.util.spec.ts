import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { continuationUser, joinContinuation, sceneHeadings, DRAFT_CONTINUATION_PASSES } from './prose-continuation.util';

// The v2.2 DRAFT's real last lines: cut mid-sentence, inside scene 40.
const WRITTEN = [
  'FADE IN:', '',
  '39  INT. BOSTON MEDICAL CENTER - TREATMENT BAY - MORNING', '',
  'Jason, hand in a splint. Sophie in the doorway.', '',
  '40  INT. FBI BOSTON FIELD OFFICE - CONFERENCE ROOM - DAY', '',
  'He turns a laptop so Sophie can see and puts a printed page beside it.', '',
  "DEV (CONT'D)",
  "This is the Mercy's charter ledger. Bottom right, tonnage line - declared cargo weight, sailing by sailing. Eleven hundred tonnes, eleven-forty, ten-eighty, eleven-ten. Beautiful. Consistent",
].join('\n');
const CUT = "This is the Mercy's charter ledger. Bottom right, tonnage line - declared cargo weight, sailing by sailing. Eleven hundred tonnes, eleven-forty, ten-eighty, eleven-ten. Beautiful. Consistent";

test('the scene headings are read, numbered, in order', () => {
  assert.deepEqual(sceneHeadings(WRITTEN).map((h) => h.n), [39, 40]);
});

test('the next piece is told what exists, where it stopped, the line to finish, and not to restart', () => {
  const u = continuationUser('STAGE: DRAFT ...\nWrite the screenplay now as plain text.', WRITTEN, 1);
  assert.match(u, /^STAGE: DRAFT/, 'the whole stage prompt still leads');
  assert.match(u, /this is piece 2/);
  assert.match(u, /part-way through scene 40/);
  assert.match(u, /SCENES ALREADY WRITTEN[\s\S]*39  INT\. BOSTON MEDICAL CENTER[\s\S]*40  INT\. FBI BOSTON/);
  assert.match(u, /Begin by writing its unfinished last line again, in full: "This is the Mercy's charter ledger/);
  assert.match(u, /Finish scene 40, then keep the scene numbering going from 41/);
  assert.match(u, /do not restart the screenplay/);
  assert.ok(u.includes('<written>\n' + WRITTEN.slice(0, 30)), 'a short draft goes in whole');
});

test('a long draft sends only its tail, starting on a whole line', () => {
  const long = Array.from({ length: 400 }, (_, i) => 'Line number ' + i + ' of a very long draft, padded out.').join('\n') + '\nhalf a li';
  const u = continuationUser('P', long, 1);
  const tail = u.slice(u.indexOf('<written>\n') + 10, u.indexOf('\n</written>'));
  assert.ok(tail.length <= 4000);
  assert.match(tail, /^Line number \d+ of a very long draft/);
  assert.ok(tail.endsWith('half a li'));
});

test('IT WROTE THE UNFINISHED LINE AGAIN: the half line goes, the whole one stays — once', () => {
  const next = CUT + '. Too consistent.\n\nSOPHIE\nMeaning?\n\n41  EXT. QMG TERMINAL - NIGHT\n\nRain.';
  const j = joinContinuation(WRITTEN, next);
  assert.equal(j.how, 'rewrote-line');
  assert.equal(j.restarted, null);
  assert.equal(j.text.split('Beautiful. Consistent').length - 1, 1, 'the cut line is not in twice');
  assert.match(j.text, /Beautiful\. Consistent\. Too consistent\.\n\nSOPHIE\nMeaning\?\n\n41  EXT\. QMG TERMINAL/);
});

test('it carried straight on from mid-sentence: joined onto the line, spaced correctly', () => {
  assert.equal(joinContinuation(WRITTEN, '. Too consistent.\n\nSOPHIE\nMeaning?').how, 'continued-line');
  assert.match(joinContinuation(WRITTEN, '. Too consistent.').text, /Beautiful\. Consistent\. Too consistent\.$/);
  assert.match(joinContinuation(WRITTEN, 'and far too neat.').text, /Beautiful\. Consistent and far too neat\.$/);
});

test('lines the piece repeats from the end of what exists are dropped', () => {
  const next = 'He turns a laptop so Sophie can see and puts a printed page beside it.\n\nDEV (CONT\'D)\n' + CUT + '. Too consistent.';
  const j = joinContinuation(WRITTEN, next);
  assert.equal(j.dropped, 2);
  assert.equal(j.text.split('He turns a laptop').length - 1, 1);
  assert.equal(j.how, 'rewrote-line');
});

test('IT REWROTE THE SCENE IT WAS CUT IN: the whole scene replaces the half one', () => {
  const next = '40  INT. FBI BOSTON FIELD OFFICE - CONFERENCE ROOM - DAY\n\nDev turns the laptop. The ledger, whole.\n\n41  EXT. QMG TERMINAL - NIGHT';
  const j = joinContinuation(WRITTEN, next);
  assert.equal(j.how, 'rewrote-scene');
  assert.equal(sceneHeadings(j.text).map((h) => h.n).join(','), '39,40,41');
  assert.ok(!j.text.includes('Beautiful. Consistent'), 'the cut half-scene is gone');
  assert.match(j.text, /Jason, hand in a splint/, 'scene 39 is untouched');
});

test('A PIECE THAT GOES BACK IS REFUSED — appending it would put the same film in twice', () => {
  for (const next of ['FADE IN:\n\n1  EXT. QMG PIER - NIGHT\n\nRain.', '12  INT. MACRAE KITCHEN - NIGHT\n\nMusa eats.']) {
    const j = joinContinuation(WRITTEN, next);
    assert.ok(j.restarted, next.slice(0, 20));
    assert.equal(j.text, WRITTEN, 'nothing is appended');
  }
});

test('a piece that adds nothing leaves the text unchanged (the caller stops on it)', () => {
  assert.equal(joinContinuation(WRITTEN, '').text, WRITTEN);
  assert.equal(joinContinuation(WRITTEN, "DEV (CONT'D)").text, WRITTEN);
});

test('a code fence around the piece is not written into the screenplay', () => {
  const j = joinContinuation(WRITTEN, '```\n. Too consistent.\n```');
  assert.ok(!j.text.includes('```'));
});

test('the bound is the one the array stages use', () => {
  assert.equal(DRAFT_CONTINUATION_PASSES, 4);
});
