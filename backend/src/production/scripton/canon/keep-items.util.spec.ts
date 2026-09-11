/**
 * The direction's KEEP list, split into the items a compliance check reports on.
 * Run: npm run test:unit
 *
 * The two real keep fields below are copied verbatim from build_directions (cmtwm0eka and
 * cmtvse1hu, 11 Sep 2026). The expected lists were declared in writing BEFORE the splitter
 * existed (Claude outputs/keep-items-DECLARED-2026-09-11.json); the splitter is correct only if it
 * reproduces them.
 *
 * COARSE AND TRUTHFUL. Semicolons are the only separator. A prose keep with none stays one item: a
 * sentence split would cut inside "'Smile. This is the part you're good at.'", and single quotes
 * cannot be tracked because they are also every apostrophe.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { splitKeep } from './keep-items.util';

const JASIN = "The full spine as written: the five-to-six-page betrayal prologue at the dock, evening clothes and the cheap winter coat, Adrian's car turning back toward the attackers; the hard cut to Musa's rescue near Cape Breton; the observable chain of Jason's call, Sophie's inquiry, Marcus's leak, Gideon's attack and the MacRae murders; Boston's service-door geography; the fish-market win, the gala lapel line 'Smile. This is the part you're good at,' and Celeste recognizing him over the bracelet clasp; the single Sequence Four flashback revealing the missing worker, the authorization Jason signed and the confrontation with Alexander; the father-son reckoning resolved before the terminal; the held Mercy, Gideon's accelerated destruction, the established escape launch used by Nora and the workers, Hale's boat and the post-evacuation reveal about Leah; 'You don't get to disappear'; Nora's unresolved ending and 'Monday. Nine.'";

const JASON = "The crime exactly as written: recruitment promises, withheld documents, diverted wages, transfers that record a man as repatriated while he cannot travel, and legitimate relief work that shelters the people abusing it. Keep Musa Dabo's genuine expertise — the compressors and reefer units he serviced, the confinement routines, the colleagues' names, the fragments of the transfer route — and keep the climax's dependence on his instructions being followed exactly. Keep Amara Ceesay, fitter, as the author and leader of the extraction plan. Keep Jason whole and dangerous: Prince and Ghost, the damaged hand, the wit, the seduction, the moral danger of a man who protects people by deciding for them. Keep the gala with Adrian forced to pose beside him and the line 'Smile. This is the part you're good at.' Keep the fish-market sequence as a clean, uninjured, pleasurable win. Keep Gideon's fatal misreading of dependency as loyalty, Sophie's costly delay, Ward's discipline about separating what a witness saw from what he was told, Lena's refusal, and the terminal-and-harbour climax where workers' local knowledge defeats a system.";

// Declared before the splitter was written.
const JASIN_LEAD = 'The full spine as written';
const JASIN_ITEMS = [
  "the five-to-six-page betrayal prologue at the dock, evening clothes and the cheap winter coat, Adrian's car turning back toward the attackers",
  "the hard cut to Musa's rescue near Cape Breton",
  "the observable chain of Jason's call, Sophie's inquiry, Marcus's leak, Gideon's attack and the MacRae murders",
  "Boston's service-door geography",
  "the fish-market win, the gala lapel line 'Smile. This is the part you're good at,' and Celeste recognizing him over the bracelet clasp",
  'the single Sequence Four flashback revealing the missing worker, the authorization Jason signed and the confrontation with Alexander',
  'the father-son reckoning resolved before the terminal',
  "the held Mercy, Gideon's accelerated destruction, the established escape launch used by Nora and the workers, Hale's boat and the post-evacuation reveal about Leah",
  "'You don't get to disappear'",
  "Nora's unresolved ending and 'Monday. Nine.'",
];

test('the real 926-char keep (cmtwm0eka) reproduces the list declared before the splitter existed', () => {
  assert.equal(JASIN.length, 926);
  const r = splitKeep(JASIN);
  assert.equal(r.lead, JASIN_LEAD);
  assert.deepEqual(r.items, JASIN_ITEMS);
});

test('the lapel line and the bracelet clasp stay in ONE item — reported whole, not mis-segmented', () => {
  const r = splitKeep(JASIN);
  const both = r.items.filter((i) => i.includes("'Smile. This is the part you're good at,'") && i.includes('bracelet clasp'));
  assert.equal(both.length, 1);
});

test('LOSSLESS: lead + ": " + items joined with "; " is the original, byte for byte', () => {
  const r = splitKeep(JASIN);
  assert.equal(r.lead + ': ' + r.items.join('; '), JASIN);
});

test('every item is a verbatim substring of the keep', () => {
  for (const k of [JASIN, JASON]) for (const i of splitKeep(k).items) assert.ok(k.includes(i), i.slice(0, 60));
});

test('a prose keep with no semicolons (cmtvse1hu, 1,136 chars) is ONE item, whole, with no lead taken off it', () => {
  assert.equal(JASON.length, 1136);
  const r = splitKeep(JASON);
  assert.equal(r.lead, null, '"The crime exactly as written" labels a sentence, not a list — it must stay in the item');
  assert.deepEqual(r.items, [JASON]);
});

test('a colon in a LATER item is not a lead', () => {
  const r = splitKeep('the dock; Jason whole: the hand, the wit; the gala');
  assert.equal(r.lead, null);
  assert.deepEqual(r.items, ['the dock', 'Jason whole: the hand, the wit', 'the gala']);
});

test('a first-segment colon after a long or comma-bearing prefix is not a lead', () => {
  assert.equal(splitKeep('the dock, the coat: both; the gala').lead, null);
  assert.equal(splitKeep('x'.repeat(61) + ': a; b').lead, null);
});

test('a semicolon inside double or curly quotes does not split', () => {
  assert.deepEqual(splitKeep('the line "wait; no" at the gate; the gala').items, ['the line "wait; no" at the gate', 'the gala']);
  assert.deepEqual(splitKeep('the line “wait; no” at the gate; the gala').items, ['the line “wait; no” at the gate', 'the gala']);
});

test('empty segments are dropped; ends are trimmed; nothing else is rewritten', () => {
  assert.deepEqual(splitKeep('  the dock ;; the gala ;  ').items, ['the dock', 'the gala']);
});

test('fail-safe: empty or non-string keep yields no items and throws nothing', () => {
  for (const k of ['', '   ', null, undefined, 42] as any[]) assert.deepEqual(splitKeep(k), { lead: null, items: [] });
});
