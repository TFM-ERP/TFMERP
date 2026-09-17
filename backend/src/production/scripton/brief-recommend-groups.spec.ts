/**
 * THE DURABLE HALF OF F0: a kind the prompt never asks about is a field that can never be filled.
 *
 * `boolean` was added to the shared field table and the analysis prompt's partition — which switches
 * on kind in a different file — was not updated. The fields would have been declared, validated,
 * coerced, and never once offered to the model, falling silently to the form's defaults. Every
 * acceptance written for F0 would still have passed: the row saves (nothing invalid is emitted any
 * more) and realPersonDirective emits LOOSE (from a different field). Green, and hollow.
 *
 * This is the same failure as the shared status mapper that did not cross the API boundary: the
 * table was extended, the consumer that switches on it was not.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { DECLARED_KINDS, promptGroup, recommendableFields, FIELD_SPECS } from './brief-recommend.util';

const GROUPS = ['options', 'free', 'boolean'];

test('every declared kind lands in exactly one prompt group', () => {
  assert.ok(DECLARED_KINDS.length >= 7, 'the kind table shrank — check this test still covers it');
  for (const kind of DECLARED_KINDS) {
    const g = promptGroup(kind);
    assert.ok(GROUPS.indexOf(g) >= 0, kind + ' is routed to "' + g + '", which no prompt block renders');
  }
  // Exactly one: the groups are the arms of a switch, so a kind cannot appear twice — but if the
  // partition is ever rewritten as three independent predicates, this is what catches the overlap.
  const counted = DECLARED_KINDS.map((k) => GROUPS.filter((g) => promptGroup(k) === g).length);
  assert.deepEqual(counted, DECLARED_KINDS.map(() => 1));
});

test('every recommendable field reaches a prompt block', () => {
  const missing = recommendableFields().filter((f) => GROUPS.indexOf(promptGroup(FIELD_SPECS[f].kind)) < 0);
  assert.deepEqual(missing, [], 'these fields are declared but never asked about: ' + missing.join(', '));
});

test('the two fields F0 exists for are actually asked about', () => {
  // Naming them, because they are the ones that were invisible. A generic test over the table would
  // still pass on the day someone quietly drops them from recommendableFields().
  for (const f of ['realBased', 'researchSubject']) {
    assert.ok(recommendableFields().indexOf(f) >= 0, f + ' is no longer offered to the analysis at all');
    assert.equal(promptGroup(FIELD_SPECS[f].kind), 'boolean');
  }
  assert.equal(promptGroup(FIELD_SPECS.realityLevel.kind), 'options', 'realityLevel must be offered with its three values');
  assert.equal(promptGroup(FIELD_SPECS.researchAmount.kind), 'free');
});

test('every YES/NO field is offered with the label the human sees, not just its name', () => {
  // A PRESENCE CHECK ACROSS THE API BOUNDARY, like the badge-class test — it proves a hint exists,
  // not that it is well worded. It is here because the field NAME is not the question: offered bare,
  // `realBased — true or false` invites a model to answer from the setting (real Boston, real Coast
  // Guard) rather than from the story (invented characters, invented company, invented case).
  const { readFileSync } = require('fs');
  const { join } = require('path');
  const form = readFileSync(join(__dirname, '..', '..', '..', '..', 'frontend', 'src', 'components', 'scripton', 'ScriptOnIntake.tsx'), 'utf8');
  const hints = form.slice(form.indexOf('const recHints'), form.indexOf('const recLog'));
  for (const f of recommendableFields().filter((x) => promptGroup(FIELD_SPECS[x].kind) === 'boolean')) {
    assert.match(hints, new RegExp('\\b' + f + '\\s*:'), f + ' reaches the prompt with no hint — the model must guess what the field means');
  }
});
