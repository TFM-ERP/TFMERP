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
import { KEEP_CHECK_SYSTEM, keepCheckUser, parseKeepCheck } from './keep-check.util';

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
