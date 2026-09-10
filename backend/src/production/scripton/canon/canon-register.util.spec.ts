import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { transcribeRegister } from './canon-register.util';
import { selectForStage } from './canon-select.util';
import { canonDirective, prohibitionDirective, registerDirective } from './canon-inject.util';
import type { CanonFactCore } from './canon.types';

/**
 * A REGISTER IS TRANSCRIBED, NOT EXTRACTED. §29 was 53 bullets; extraction kept 9 to 11 of them and
 * the ladder broke 23. These tests pin the three shapes as they appear in the real bible — a bullet
 * register, a line register with no bullets at all, and rules written mid-paragraph inside
 * character entries — and the one guarantee that matters: every line arrives, verbatim, and no
 * budget can reach it.
 */

const BULLETS_29 = [
  'Jason is thirty-four and disappeared at twenty-seven.',
  'Gideon organizes the attempted murder.',
  'His hand injury remains permanent.',
  'Nora and Jason do not share a reconciliation kiss.',
  'The feeder vessel is intercepted before the terminal climax.',
];

const DOC = [
  '# JASON QUICK',
  '## Unified World, Character, Story Bible and Builder Brief',
  'A short framing line.',
  '## 0. Instructions to the story builder',
  'Build from this document. Do not rename the hero Elias Rourke, replace QMG with Rourke Line, or substitute new parentage.',
  'Keep the timeline intact across every stage of development and every scene written from it.',
  'The builder should treat the continuity section as binding.',
  '## 9. Seven years out of sight',
  'His left hand retains nerve damage. Cold, fatigue, and sustained grip can make it unreliable.',
  '## 16. Nora Bell',
  '### Her ending',
  'They part changed. There is no reconciliation kiss, romantic declaration, confirmed reunion, or definitive breakup.',
  '## 20. Other essential characters',
  '### Musa Dabo',
  'Musa remains outside QMG custody after his escape. Do not introduce him again as an undiscovered captive in the Boston warehouse.',
  '## 23. FBI-led investigation and supporting agencies',
  '### Research grounding',
  '- FBI human trafficking overview: https://www.fbi.gov/investigate/violent-crime/human-trafficking',
  '- ICE forced labor enforcement: https://www.ice.gov/',
  '- RCMP human trafficking: https://www.rcmp-grc.gc.ca/',
  'Sources consulted for procedure only.',
  '## 24. Complete feature story',
  'Alexander waits. There is no demand that Jason call him “Dad.” He is allowed to preserve a life without granting intimacy.',
  '## 29. Continuity foundations',
  ...BULLETS_29.map((b) => '* ' + b),
  '## 31. Rules for keeping Jason distinctive',
  'Do not restart his story by repeatedly murdering someone he loves.',
  'Let him be wrong about people.',
  'Let joy recur. Preserve Jason’s audacity, social command, and decisive action.',
  'His growth should increase his capacity for relationships while making his life more complicated.',
  '## 32. Final creative north star',
  'Jason saves people.',
].join('\n');

const of = (facts: CanonFactCore[], section: string) => facts.filter((f) => f.sourceSection === section);

test('A BULLET REGISTER: every bullet becomes one fact, and the count is reported', () => {
  const { facts, report } = transcribeRegister(DOC);
  const got = of(facts, '29. Continuity foundations');
  assert.equal(got.length, BULLETS_29.length, 'bullets in == facts out, or the register was sampled');
  assert.deepEqual(got.map((f) => f.statement), BULLETS_29);
  assert.ok(got.every((f) => f.kind === 'REGISTER'));
  assert.match(report.summary, /29\. Continuity foundations: 5 bullets → 5 facts/);
});

test('VERBATIM means the source substring, character for character — curly quotes and all', () => {
  const { facts } = transcribeRegister(DOC);
  assert.ok(facts.length > 0);
  for (const f of facts) {
    assert.equal(DOC.slice(f.sourceOffset as number, (f.sourceOffset as number) + f.statement.length), f.statement,
      'not a paraphrase and not normalised: ' + f.statement);
  }
  assert.ok(facts.some((f) => f.statement.includes('Jason’s audacity')), 'the curly apostrophe survives');
});

test('A LINE REGISTER: §31 has no bullets and is still transcribed, every line of it', () => {
  const { facts, report } = transcribeRegister(DOC);
  const got = of(facts, '31. Rules for keeping Jason distinctive');
  assert.equal(got.length, 4);
  assert.ok(got.some((f) => /^His growth should/.test(f.statement)),
    'the one line that does not open with an imperative is part of the register too');
  assert.ok(report.registers.some((r) => r.section.startsWith('31.') && r.shape === 'lines'));
});

test('a section with SOME imperatives is prose, not a register (§0 is 6 of 17 on the real bible)', () => {
  const { report } = transcribeRegister(DOC);
  assert.ok(!report.registers.some((r) => r.section.startsWith('0.')), JSON.stringify(report.registers));
});

test('RESEARCH CITATIONS ARE NOT A REGISTER: a bulleted subsection is excluded by level, not by count', () => {
  const { facts } = transcribeRegister(DOC);
  assert.ok(!facts.some((f) => /https?:\/\//.test(f.statement)), 'a URL list is research, not a rule about the film');
});

test('RULES WRITTEN MID-PARAGRAPH are found by sentence and carried by line, antecedent included', () => {
  const { facts } = transcribeRegister(DOC);
  const musa = facts.find((f) => f.sourceSection === 'Musa Dabo');
  assert.ok(musa, 'the §20 character-entry rule is found');
  assert.match(musa!.statement, /^Musa remains outside QMG custody after his escape\. Do not introduce him again/,
    '"Do not introduce HIM" is only usable next to the sentence that says who');
  assert.equal(musa!.object, 'Do not introduce him again as an undiscovered captive in the Boston warehouse.');
  assert.ok(facts.some((f) => f.statement.includes('There is no reconciliation kiss')), '§16');
  assert.ok(facts.some((f) => f.statement.includes('Do not rename the hero Elias Rourke')), '§0');
});

test('a sentence ending inside a closing quote still ends: “Dad.” He is… is two sentences', () => {
  const { facts } = transcribeRegister(DOC);
  const dad = facts.find((f) => f.statement.includes('call him “Dad.”'));
  assert.ok(dad);
  assert.equal(dad!.object, 'There is no demand that Jason call him “Dad.”');
});

test('PROSE IS NOT A REGISTER: "left hand" is a description in §9 and is not transcribed', () => {
  const { facts } = transcribeRegister(DOC);
  assert.ok(!facts.some((f) => /left hand/.test(f.statement)));
});

test('NO TRUNCATION: a 900-character bullet arrives whole', () => {
  const long = 'Jason keeps the ledger. ' + 'x'.repeat(876);
  const doc = '# T\n## A\nprose\n## 29. Continuity\n* ' + long + '\n* short\n';
  const { facts } = transcribeRegister(doc);
  assert.ok(facts.some((f) => f.statement === long), 'the extraction path slices statements to 400; this one must not');
});

test('a bullet that wraps onto the next line is ONE fact, not two halves', () => {
  const doc = '# T\n## A\nprose\n## 29. Continuity\n* first half of a bullet\n  that wraps here.\n* second bullet\n';
  const { facts, report } = transcribeRegister(doc);
  const got = of(facts, '29. Continuity');
  assert.equal(got.length, 2);
  assert.equal(got[0].statement, 'first half of a bullet\n  that wraps here.');
  assert.match(report.summary, /2 bullets → 2 facts/);
});

test('deterministic: the same source always yields the same register', () => {
  assert.deepEqual(transcribeRegister(DOC), transcribeRegister(DOC));
});

test('fail-safe: empty or non-string source yields nothing and throws nothing', () => {
  assert.equal(transcribeRegister('').facts.length, 0);
  assert.equal(transcribeRegister(null as any).facts.length, 0);
});

test('NO BUDGET CAN REACH THEM: a zero-character stage budget still carries every register line', () => {
  const { facts } = transcribeRegister(DOC);
  const extracted: CanonFactCore[] = Array.from({ length: 50 }, (_, i) => ({
    kind: 'CHARACTER', subject: 'JASON', predicate: 'p' + i, object: 'o', statement: 'x'.repeat(200),
    validFrom: 0, validTo: null, status: 'ACTIVE', sourceSection: '§' + i,
  } as CanonFactCore));
  const sel = selectForStage(extracted.concat(facts), { budgetChars: 0 });
  assert.equal(sel.byKind.REGISTER.sent, facts.length);
  assert.equal(sel.byKind.CHARACTER.sent, 0, 'the budget governs the droppable facts only');
});

test('THE DIRECTIVE renders every line verbatim, and the canon list and the prohibition list render none', () => {
  const { facts } = transcribeRegister(DOC);
  const block = registerDirective(facts);
  for (const f of facts) assert.ok(block.includes(f.statement.replace(/\s*\n\s*/g, ' ').trim()), f.statement);
  assert.match(block, /\[29\. Continuity foundations\]/);
  assert.equal(canonDirective(facts, { at: 0, max: 1000 }), '', 'resolveCanonAt would keep one line per section');
  assert.equal(prohibitionDirective(facts), '');
});
