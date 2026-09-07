import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { excerptSource, excerptNote, sourceMaterialBlock, SOURCE_EXCERPT_CHARS, BOUNDARY_LOOKBACK } from './source-excerpt.util';

// The real shape: a long design document whose front is titles and taglines, and whose surnames,
// professions and relationships live thousands of characters further down.
const FRONT = 'JASON QUICK — a franchise bible.\n\nTAGLINE HIERARCHY\n"Quick" reads as both a name and a warning.\n\n';
const DEEP = 'Jason Richard Quick runs Quick Maritime Group. Moira MacRae is the station medic who taught him.\n';
const DOC = FRONT + 'x'.repeat(9000) + '\n\n' + DEEP;

test('a document under the cap is returned whole, and is NOT called an excerpt', () => {
  const ex = excerptSource('short enough');
  assert.equal(ex.text, 'short enough');
  assert.equal(ex.truncated, false);
  assert.equal(ex.sent, ex.total);
  assert.equal(excerptNote(ex), '', 'a note that fires on a complete document trains the reader to ignore it');
});

test('THE DEFECT: a long document is cut, and the material past the cut really is gone', () => {
  const ex = excerptSource(DOC);
  assert.equal(ex.truncated, true);
  assert.equal(ex.total, DOC.length);
  assert.ok(ex.sent <= SOURCE_EXCERPT_CHARS);
  assert.ok(ex.text.indexOf('TAGLINE HIERARCHY') >= 0, 'the front survives — which is the whole problem');
  assert.equal(ex.text.indexOf('Quick Maritime Group'), -1, 'and the surname and the company do not');
});

test('A CAP THAT FIRES SAYS SO — with the real numbers, not a vague warning', () => {
  const ex = excerptSource(DOC);
  const note = excerptNote(ex);
  assert.ok(/EXCERPT/.test(note));
  assert.ok(note.indexOf(String(ex.sent)) >= 0, 'says how much was sent');
  assert.ok(note.indexOf(String(ex.total)) >= 0, 'and out of how much');
  assert.ok(/invent/i.test(note), 'and names the failure mode it is trying to prevent');
});

test('the percentage is honest, and never rounds a real excerpt down to zero', () => {
  const tiny = excerptSource('y'.repeat(2_000_000));
  const note = excerptNote(tiny);
  assert.ok(/\(1%\)/.test(note), note.slice(0, 120));
});

test('the cut lands on a paragraph break when one is close, rather than mid-word', () => {
  const body = 'a'.repeat(500) + '\n\n' + 'b'.repeat(500);
  const ex = excerptSource(body, 800);   // 800 falls inside the b-run, 502 is the break
  assert.ok(ex.text.endsWith('a'), 'cut at the paragraph, not inside the second block');
  assert.equal(ex.text.indexOf('b'), -1);
});

test('...or a sentence end, when there is no paragraph break in reach', () => {
  const body = 'One sentence here. Another sentence here. ' + 'z'.repeat(500);
  const ex = excerptSource(body, 60);
  assert.ok(ex.text.endsWith('.'), JSON.stringify(ex.text));
});

test('the boundary walk is BOUNDED — it never discards real material to make a tidy seam', () => {
  // The only break sits far above the lookback, so the cut must stay at the cap.
  const body = 'q'.repeat(50) + '\n\n' + 'w'.repeat(5000);
  const cap = 3000;
  const ex = excerptSource(body, cap);
  assert.ok(ex.sent > cap - BOUNDARY_LOOKBACK, 'walking back to character 50 would throw away 2,950 characters');
  assert.ok(ex.text.endsWith('w'));
});

test('RULE 1: the fixed facts come BEFORE the excerpt, always', () => {
  // Whatever is read last wins an argument in a prompt. The facts come from the whole document;
  // the excerpt comes from a tenth of it. The facts must not sit underneath.
  const block = sourceMaterialBlock('CANON (honour — do not contradict):\n- JASON — Jason Richard Quick.', excerptSource(DOC));
  const facts = block.indexOf('FIXED FACTS');
  const source = block.indexOf('SOURCE MATERIAL');
  assert.ok(facts >= 0 && source >= 0);
  assert.ok(facts < source, 'facts must precede the excerpt');
});

test('the facts block says it overrides, and says it is stated rather than inferred', () => {
  const block = sourceMaterialBlock('CANON:\n- JASON — Jason Richard Quick.', excerptSource(DOC));
  assert.ok(/WHOLE document/.test(block));
  assert.ok(/OVERRIDE/.test(block));
  assert.ok(/stated, not inferred/.test(block));
  assert.ok(block.indexOf('Jason Richard Quick') >= 0, 'the surname the generator invented over now reaches the prompt');
});

test('with no facts it degrades to exactly what shipped before, plus the honest note', () => {
  const block = sourceMaterialBlock('', excerptSource(DOC));
  assert.equal(block.indexOf('FIXED FACTS'), -1);
  assert.ok(/SOURCE MATERIAL \(the work to adapt/.test(block));
  assert.ok(/EXCERPT/.test(block), 'the note does not depend on there being facts');
});

test('an untruncated source carries the facts and NO excerpt note', () => {
  const block = sourceMaterialBlock('CANON:\n- X — y.', excerptSource('a complete short source'));
  assert.ok(/FIXED FACTS/.test(block));
  assert.ok(/SOURCE MATERIAL/.test(block));
  assert.equal(block.indexOf('EXCERPT'), -1);
});

test('no source and no facts is an EMPTY string, so a caller can concatenate unconditionally', () => {
  assert.equal(sourceMaterialBlock('', excerptSource('')), '');
  assert.equal(sourceMaterialBlock('', null), '');
  assert.equal(sourceMaterialBlock(null, undefined), '');
});

test('facts with no source still reach the model — the facts are the valuable half', () => {
  const block = sourceMaterialBlock('CANON:\n- JASON — Jason Richard Quick.', excerptSource(''));
  assert.ok(/FIXED FACTS/.test(block));
  // Matched on the distinctive opening, because the FACTS header itself contains the words
  // "SOURCE MATERIAL" — a bare indexOf finds it there and passes for the wrong reason.
  assert.equal(block.indexOf('SOURCE MATERIAL (the work to adapt'), -1);
});

test('PURE AND NEVER THROWS: junk in, a block out', () => {
  assert.doesNotThrow(() => excerptSource(null));
  assert.doesNotThrow(() => excerptSource(undefined, -5));
  assert.doesNotThrow(() => excerptSource({} as any, NaN));
  assert.doesNotThrow(() => excerptNote(null));
  assert.doesNotThrow(() => excerptNote({} as any));
  assert.doesNotThrow(() => sourceMaterialBlock({} as any, {} as any));
  assert.equal(excerptSource(null).total, 0);
  assert.equal(excerptSource(12345 as any).text, '12345');
  // a junk limit falls back to the shipped cap rather than to zero
  assert.equal(excerptSource('m'.repeat(9000), NaN).sent <= SOURCE_EXCERPT_CHARS, true);
  assert.ok(excerptSource('m'.repeat(9000), NaN).sent > 0, 'never silently sends nothing');
});

test('BREAK SWEEP: making the cap silent again fails this suite', () => {
  // The synopsis that renamed the protagonist was well-formed, internally consistent and passed
  // every gate. The only thing that would have caught it is the model knowing it held a fragment.
  const ex = excerptSource(DOC);
  const block = sourceMaterialBlock('', ex);
  assert.notEqual(excerptNote(ex), '', 'excerptNote went quiet on a truncated document');
  assert.ok(/EXCERPT/.test(block), 'the assembled block no longer admits to the cap');
  assert.ok(/NOT below/.test(block), 'it no longer says the rest is missing');
});
