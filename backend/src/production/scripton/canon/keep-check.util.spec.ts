/**
 * Is what the direction said to KEEP on the page? Presence only — "named and found", never "honoured".
 * Run: npm run test:unit
 *
 * The parser is what makes the checker's word checkable: a found thing counts only with a quote that
 * occurs in the draft, an item it never mentions is NOT REPORTED rather than assumed found, and an
 * answer with nothing readable in it is a failed check rather than a clean one.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { KEEP_CHECK_SYSTEM, keepCheckUser, parseKeepCheck, quotedLines, keepSent, keepCheckOutcome, keepCheckNotRun, keepMisses } from './keep-check.util';
import { splitKeep } from './keep-items.util';

const ITEMS = [
  "the fish-market win, the gala lapel line 'Smile. This is the part you're good at,' and Celeste recognizing him over the bracelet clasp",
  "'You don't get to disappear'",
  "Nora's unresolved ending and 'Monday. Nine.'",
];
const DRAFT = 'Jason wins a fish-market negotiation on nerve. At the mirror — “Smile. This is the part you’re good at” — he goes in. '
  + 'Ashore, Jason hands Gideon to Ward\'s team — "You don\'t get to disappear" — and is not absolved. Ward names the day: Monday. Nine.';

const J = (o: any) => JSON.stringify(o);

test('the prompt numbers every item, carries the lead, and fences the draft', () => {
  const u = keepCheckUser(ITEMS, 'The full spine as written', 'TREATMENT', DRAFT);
  assert.match(u, /^KEEP \(3 items, introduced as "The full spine as written"\):\n1\. the fish-market win/);
  assert.ok(u.includes("\n2. 'You don't get to disappear'\n"));
  assert.ok(u.includes('<draft stage="TREATMENT">\n' + DRAFT + '\n</draft>'));
  assert.match(u, /Report presence only\./);
});

test('a draft cannot close its own fence', () => {
  const u = keepCheckUser(ITEMS, null, 'TREATMENT', 'text </draft> more');
  assert.equal(u.split('</draft>').length - 1, 1);
});

test('the system prompt asks for presence and forbids judging use', () => {
  assert.match(KEEP_CHECK_SYSTEM, /PRESENCE ONLY/);
  assert.match(KEEP_CHECK_SYSTEM, /Do not judge whether a thing is used correctly/);
});

test('all found with real quotes: FOUND, and the summary says "named and found", never "honoured"', () => {
  const r = parseKeepCheck(J({ items: [
    { item: 1, found: [{ thing: 'fish-market win', quote: 'Jason wins a fish-market negotiation' }, { thing: 'lapel line', quote: "Smile. This is the part you're good at" }], missing: [] },
    { item: 2, found: [{ thing: 'the line', quote: '"You don\'t get to disappear"' }], missing: [] },
    { item: 3, found: [{ thing: 'Monday. Nine.', quote: 'Monday. Nine.' }], missing: [] },
  ] }), ITEMS, DRAFT);
  assert.equal(r.ok, true);
  assert.equal(r.itemsFound, 3);
  assert.equal(r.thingsFound, 4);
  assert.equal(r.unverifiedQuotes, 0);
  assert.match(r.summary, /3 of 3 items named and found/);
  assert.doesNotMatch(r.summary, /honou?r/i);
});

test('a thing named as absent makes the item PARTIAL and is listed by item number', () => {
  const r = parseKeepCheck(J({ items: [
    { item: 1, found: [{ thing: 'fish-market win', quote: 'wins a fish-market negotiation' }], missing: ['bracelet clasp recognition'] },
    { item: 2, found: [{ thing: 'the line', quote: "You don't get to disappear" }], missing: [] },
    { item: 3, found: [], missing: ["Nora's unresolved ending", 'Monday. Nine.'] },
  ] }), ITEMS, DRAFT);
  assert.equal(r.items[0].status, 'PARTIAL');
  assert.equal(r.items[2].status, 'MISSING');
  assert.equal(r.thingsMissing, 3);
  assert.match(r.summary, /not found: #1 bracelet clasp recognition; #3 Nora's unresolved ending; #3 Monday\. Nine\./);
});

test('THE CHECKER\'S EVIDENCE IS CHECKED: a quote not in the draft is flagged and NOT counted as found', () => {
  const r = parseKeepCheck(J({ items: [
    { item: 1, found: [{ thing: 'bracelet clasp', quote: 'Celeste knows him by the clasp' }], missing: [] },
    { item: 2, found: [{ thing: 'the line', quote: "You don't get to disappear" }], missing: [] },
  ] }), ITEMS, DRAFT);
  assert.equal(r.items[0].found[0].quoteFound, false);
  assert.equal(r.items[0].status, 'UNPROVEN');
  assert.equal(r.thingsFound, 1);
  assert.equal(r.unverifiedQuotes, 1);
  assert.equal(r.thingsMissing, 0, 'claimed-and-unproven is not the same as named-as-absent');
  assert.match(r.summary, /1 quoted passage\(s\) NOT FOUND in the draft \(not counted as found\)/);
});

test('an unverified quote beside a verified one makes the item PARTIAL, not FOUND', () => {
  const r = parseKeepCheck(J({ items: [
    { item: 1, found: [{ thing: 'fish-market', quote: 'wins a fish-market negotiation' }, { thing: 'clasp', quote: 'over the bracelet clasp' }], missing: [] },
  ] }), ITEMS, DRAFT);
  assert.equal(r.items[0].status, 'PARTIAL');
});

test('curly quotes, dashes and ellipses in the draft do not make a true quote look invented', () => {
  const draft = 'He says, “You don’t get to disappear” — and leaves… for good.';
  const r = parseKeepCheck(J({ items: [
    { item: 2, found: [{ thing: 'line', quote: '"You don\'t get to disappear" - and leaves... for good' }], missing: [] },
  ] }), ITEMS, draft);
  assert.equal(r.items[1].found[0].quoteFound, true);
});

test('an empty quote is never verified', () => {
  const r = parseKeepCheck(J({ items: [{ item: 2, found: [{ thing: 'line', quote: '' }], missing: [] }] }), ITEMS, DRAFT);
  assert.equal(r.items[1].found[0].quoteFound, false);
});

test('an item the checker never mentions is NOT REPORTED — never read as found or missing', () => {
  const r = parseKeepCheck(J({ items: [{ item: 2, found: [{ thing: 'line', quote: "You don't get to disappear" }], missing: [] }] }), ITEMS, DRAFT);
  assert.equal(r.items[0].status, 'NOT REPORTED');
  assert.equal(r.items[2].status, 'NOT REPORTED');
  assert.equal(r.itemsNotReported, 2);
  assert.equal(r.itemsMissing, 0);
  assert.match(r.summary, /2 NOT REPORTED by the checker/);
});

test('an item row with neither found nor missing is NOT REPORTED', () => {
  const r = parseKeepCheck(J({ items: [{ item: 1, found: [], missing: [] }, { item: 2, found: [{ thing: 'l', quote: 'Monday. Nine.' }], missing: [] }] }), ITEMS, DRAFT);
  assert.equal(r.items[0].status, 'NOT REPORTED');
});

test('a row naming an item that does not exist is counted invalid', () => {
  const r = parseKeepCheck(J({ items: [{ item: 9, found: [], missing: ['x'] }, { item: 'one', found: [], missing: ['x'] }, { item: 3, found: [], missing: ['Monday. Nine.'] }] }), ITEMS, DRAFT);
  assert.equal(r.invalid, 2);
  assert.equal(r.itemsMissing, 1);
  assert.match(r.summary, /2 row\(s\) named no item/);
});

test('NO READABLE ANSWER IS A FAILED CHECK, NEVER "0 missing"', () => {
  for (const text of ['', 'I could not complete the review.', '{"notes": "none"}']) {
    const r = parseKeepCheck(text, ITEMS, DRAFT);
    assert.equal(r.ok, false, JSON.stringify(text));
    assert.equal(r.itemsMissing, null);
    assert.equal(r.thingsFound, null);
    assert.match(r.summary, /FAILED.*not a clean pass/);
  }
});

test('AN ANSWER THAT REPORTS NO ITEM IS A FAILED CHECK: {"items":[]} is not "nothing found"', () => {
  for (const text of ['{"items":[]}', J({ items: [{ item: 42, found: [], missing: ['x'] }] })]) {
    const r = parseKeepCheck(text, ITEMS, DRAFT);
    assert.equal(r.ok, false, text);
    assert.equal(r.itemsFound, null);
    assert.match(r.summary, /FAILED: the checker reported none of the 3 items/);
  }
});

test('a truncated answer keeps every COMPLETE row and says it was recovered', () => {
  const r = parseKeepCheck('{"items":[{"item":3,"found":[{"thing":"Monday","quote":"Monday. Nine."}],"missing":[]},{"item":1,"found":[{"thing":"fish","quo', ITEMS, DRAFT);
  assert.equal(r.ok, true);
  assert.equal(r.salvaged, true);
  assert.equal(r.items[2].status, 'FOUND');
  assert.equal(r.items[0].status, 'NOT REPORTED');
  assert.match(r.summary, /recovered from malformed JSON/);
});

test('fenced JSON parses', () => {
  const r = parseKeepCheck('```json\n' + J({ items: [{ item: 3, found: [{ thing: 'm', quote: 'Monday. Nine.' }], missing: [] }] }) + '\n```', ITEMS, DRAFT);
  assert.equal(r.ok, true);
  assert.equal(r.salvaged, false);
  assert.equal(r.itemsFound, 1);
});

// ── THE VERBATIM RULE ─────────────────────────────────────────────────────────────────────────────
// The two real keeps, verbatim from build_directions (cmtwm0eka, cmtvse1hu). The expected lines were
// declared before quotedLines existed (Claude outputs/keep-verbatim-ACCEPTANCE-2026-09-11.json).
const JASIN = "The full spine as written: the five-to-six-page betrayal prologue at the dock, evening clothes and the cheap winter coat, Adrian's car turning back toward the attackers; the hard cut to Musa's rescue near Cape Breton; the observable chain of Jason's call, Sophie's inquiry, Marcus's leak, Gideon's attack and the MacRae murders; Boston's service-door geography; the fish-market win, the gala lapel line 'Smile. This is the part you're good at,' and Celeste recognizing him over the bracelet clasp; the single Sequence Four flashback revealing the missing worker, the authorization Jason signed and the confrontation with Alexander; the father-son reckoning resolved before the terminal; the held Mercy, Gideon's accelerated destruction, the established escape launch used by Nora and the workers, Hale's boat and the post-evacuation reveal about Leah; 'You don't get to disappear'; Nora's unresolved ending and 'Monday. Nine.'";
const JASON = "The crime exactly as written: recruitment promises, withheld documents, diverted wages, transfers that record a man as repatriated while he cannot travel, and legitimate relief work that shelters the people abusing it. Keep Musa Dabo's genuine expertise — the compressors and reefer units he serviced, the confinement routines, the colleagues' names, the fragments of the transfer route — and keep the climax's dependence on his instructions being followed exactly. Keep Amara Ceesay, fitter, as the author and leader of the extraction plan. Keep Jason whole and dangerous: Prince and Ghost, the damaged hand, the wit, the seduction, the moral danger of a man who protects people by deciding for them. Keep the gala with Adrian forced to pose beside him and the line 'Smile. This is the part you're good at.' Keep the fish-market sequence as a clean, uninjured, pleasurable win. Keep Gideon's fatal misreading of dependency as loyalty, Sophie's costly delay, Ward's discipline about separating what a witness saw from what he was told, Lena's refusal, and the terminal-and-harbour climax where workers' local knowledge defeats a system.";

test('quotedLines reproduces the lines declared for the real cmtwm0eka keep, item by item', () => {
  const got = splitKeep(JASIN).items.map((t) => quotedLines(t));
  assert.deepEqual(got, [[], [], [], [], ["Smile. This is the part you're good at"], [], [], [], ["You don't get to disappear"], ['Monday. Nine']]);
});

test('the 1,136-char prose keep (cmtvse1hu) holds exactly one quoted line, through ten apostrophes', () => {
  assert.equal(JASON.length, 1136);
  assert.deepEqual(quotedLines(JASON), ["Smile. This is the part you're good at"]);
});

test('an apostrophe is never a delimiter; double and curly quotes pair; a one-word span is not a line', () => {
  assert.deepEqual(quotedLines("the colleagues' names and the workers' boat"), []);
  assert.deepEqual(quotedLines('the line "wait, no" at the gate and “not now, Jason” later'), ['wait, no', 'not now, Jason']);
  assert.deepEqual(quotedLines("Prince and 'Ghost' and ‘You don’t get to disappear’"), ['You don’t get to disappear']);
  assert.deepEqual(quotedLines("an unclosed 'line that never ends"), []);
  assert.deepEqual(quotedLines(null), []);
});

test('THE n1 #9 CASE: a paraphrase is not the quoted line — the "found" is not counted and the line is a miss', () => {
  const draft = "Jason delivers Gideon to Ward's team and tells him he does not get to disappear. Monday. Nine.";
  const r = parseKeepCheck(J({ items: [
    { item: 2, found: [{ thing: "'You don't get to disappear'", quote: "Jason delivers Gideon to Ward's team and tells him he does not get to disappear" }], missing: [] },
    { item: 3, found: [{ thing: 'Monday. Nine.', quote: 'Monday. Nine.' }], missing: ["Nora's unresolved ending"] },
  ] }), ITEMS, draft);
  const it = r.items[1];
  assert.equal(it.found[0].quoteFound, true, 'the paraphrase IS in the draft — the evidence check alone cannot catch this');
  assert.equal(it.found[0].notVerbatim, "You don't get to disappear");
  assert.equal(it.status, 'MISSING');
  assert.deepEqual(it.missing, ["'You don't get to disappear'"]);
  assert.deepEqual(it.lines, [{ line: "You don't get to disappear", verbatim: false }]);
  assert.equal(r.thingsFound, 1);
  assert.equal(r.notVerbatim, 1);
  assert.match(r.summary, /1 quoted line\(s\) claimed found whose words are not in the draft/);
});

test('a line the checker already named missing is not listed twice', () => {
  const r = parseKeepCheck(J({ items: [{ item: 1, found: [], missing: ["the gala lapel line 'Smile. This is the part you're good at,'", 'bracelet clasp'] }] }), ITEMS, 'Nothing here.');
  assert.deepEqual(r.items[0].missing, ["the gala lapel line 'Smile. This is the part you're good at,'", 'bracelet clasp']);
});

test('ONE-WAY: a line the checker calls missing that IS verbatim stays missing, with verbatim: true beside it', () => {
  const r = parseKeepCheck(J({ items: [{ item: 3, found: [], missing: ['Monday. Nine.'] }] }), ITEMS, DRAFT);
  assert.equal(r.items[2].status, 'MISSING');
  assert.deepEqual(r.items[2].lines, [{ line: 'Monday. Nine', verbatim: true }]);
});

test('a "found" naming the line without its words stays counted — but the verbatim miss is still added', () => {
  const r = parseKeepCheck(J({ items: [{ item: 2, found: [{ thing: 'the disappear line', quote: 'does not get to disappear' }], missing: [] }] }), ITEMS, 'He does not get to disappear.');
  assert.equal(r.items[1].found[0].notVerbatim, undefined);
  assert.equal(r.items[1].status, 'PARTIAL');
  assert.deepEqual(r.items[1].missing, ["'You don't get to disappear'"]);
});

test('the line matches through curly quotes and case in the draft', () => {
  const r = parseKeepCheck(J({ items: [{ item: 2, found: [{ thing: "'You don't get to disappear'", quote: 'YOU DON’T GET TO DISAPPEAR' }], missing: [] }] }), ITEMS, 'He says: “YOU DON’T GET TO DISAPPEAR.”');
  assert.equal(r.items[1].status, 'FOUND');
  assert.equal(r.notVerbatim, 0);
});

// ── WHAT IS STORED: THREE STATES, NEVER A SCORE ───────────────────────────────────────────────────
const SCORE = /\b\d+\s*(of|\/)\s*\d+\b/;
const COUNTS = ['itemsFound', 'itemsPartial', 'itemsMissing', 'itemsUnproven', 'itemsNotReported', 'thingsFound', 'thingsMissing', 'checked'];
const noScore = (o: any) => { const s = JSON.stringify(o); assert.doesNotMatch(s, SCORE); for (const k of COUNTS) assert.ok(!(k in o), k); };

test('MISSES: the stored result names what is missing and carries no count or fraction', () => {
  const rep = parseKeepCheck(J({ items: [
    { item: 1, found: [{ thing: 'fish-market win', quote: 'wins a fish-market negotiation' }], missing: ['bracelet clasp'] },
    { item: 2, found: [{ thing: 'the line', quote: "You don't get to disappear" }], missing: [] },
    { item: 3, found: [{ thing: 'Monday. Nine.', quote: 'Monday. Nine.' }], missing: [] },
  ] }), ITEMS, DRAFT);
  const o = keepCheckOutcome(rep, { at: 'T' });
  assert.equal(o.state, 'MISSES');
  assert.deepEqual(o.misses, ['bracelet clasp']);
  assert.equal(o.summary, 'KEEP CHECK — not found: bracelet clasp');
  assert.equal(o.at, 'T');
  noScore(o);
});

test('NO MISSES: said outright, with the presence-only qualifier, and no score', () => {
  const rep = parseKeepCheck(J({ items: [
    { item: 1, found: [{ thing: 'fish-market win', quote: 'wins a fish-market negotiation' }, { thing: 'lapel', quote: "Smile. This is the part you're good at" }], missing: [] },
    { item: 2, found: [{ thing: 'the line', quote: "You don't get to disappear" }], missing: [] },
    { item: 3, found: [{ thing: 'Monday. Nine.', quote: 'Monday. Nine.' }], missing: [] },
  ] }), ITEMS, DRAFT);
  const o = keepCheckOutcome(rep, {});
  assert.equal(o.state, 'NO MISSES');
  assert.deepEqual(o.misses, []);
  assert.match(o.summary, /presence only; not a judgment of how it is used/);
  noScore(o);
});

test('UNCONFIRMED IS LISTED, NEVER DROPPED: an unreported item and an unproven quote are misses, not a pass', () => {
  const rep = parseKeepCheck(J({ items: [
    { item: 1, found: [{ thing: 'bracelet clasp', quote: 'Celeste knows him by the clasp' }], missing: [] },
    { item: 2, found: [{ thing: 'the line', quote: "You don't get to disappear" }], missing: [] },
  ] }), ITEMS, DRAFT);
  assert.deepEqual(keepMisses(rep), ['bracelet clasp (the quoted words are not in the draft)', ITEMS[2] + ' (not checked)']);
  assert.equal(keepCheckOutcome(rep, {}).state, 'MISSES');
});

test('A FAILED CHECK IS STORED AS NOT RUN — never as NO MISSES, never with a score', () => {
  for (const text of ['I could not complete the review.', '{"items":[]}']) {
    const o = keepCheckOutcome(parseKeepCheck(text, ITEMS, DRAFT), { at: 'T' });
    assert.equal(o.state, 'NOT RUN', text);
    assert.match(o.reason, /^the check failed: /);
    assert.equal(o.misses, null);
    assert.match(o.summary, /^KEEP CHECK DID NOT RUN: the check failed/);
    noScore(o);
  }
});

test('keepCheckNotRun carries its reason and extra fields', () => {
  const o = keepCheckNotRun('started T; no result recorded', { startedAt: 'T' });
  assert.deepEqual(o, { state: 'NOT RUN', reason: 'started T; no result recorded', misses: null, summary: 'KEEP CHECK DID NOT RUN: started T; no result recorded', startedAt: 'T' });
});

test('keepSent: only a picked row with a non-blank keep sends one; every other case names why', () => {
  assert.deepEqual(keepSent('b', { legacyText: null, keep: JASIN }), { keep: JASIN, reason: null });
  assert.match(String(keepSent(null, null).reason), /no build/);
  assert.match(String(keepSent('b', null).reason), /no direction row/);
  assert.match(String(keepSent('b', { legacyText: 'old text', keep: null }).reason), /inherited project text/);
  assert.match(String(keepSent('b', { legacyText: 'old text', keep: JASIN }).reason), /inherited project text/, 'a legacy row sends legacyText, never its keep');
  assert.match(String(keepSent('b', { legacyText: null, keep: '  ' }).reason), /has no KEEP list/);
  assert.equal(keepSent('b', { legacyText: null, keep: '  ' }).keep, null);
});
