import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveTags, diffAnnotations, diffPairLabel } from './scripton-versions.logic.ts';

test('deriveTags: scene count + canon count, in order', () => {
  const tags = deriveTags([{ tag: 'Revise' }, { tag: 'Canon shift' }], [{ subject: 'A' }]);
  assert.deepEqual(tags.map((t) => t.kind), ['scenes', 'canon']);
  assert.equal(tags[0].label, '+2 scenes');
  assert.equal(tags[1].label, '1 canon change');
});

test('deriveTags: lifts a budget tag and a tone signal from the change tags', () => {
  const tags = deriveTags([{ tag: 'Re-ending · Budget −$140k' }, { tag: '+dread' }], []);
  const kinds = tags.map((t) => t.kind);
  assert.ok(kinds.includes('tone'));
  assert.ok(kinds.includes('budget'));
  assert.equal(tags.find((t) => t.kind === 'budget')?.label, 'budget −$140k');
});

test('deriveTags: empty inputs → no tags', () => {
  assert.deepEqual(deriveTags([], []), []);
  assert.deepEqual(deriveTags(null, null), []);
});

test('diffAnnotations: + bridge then ~ per canon fact with story-time', () => {
  const ann = diffAnnotations(
    [{ subject: 'AMALEKITES', object: 'allies', validFrom: 40 }, { subject: 'ANTARAH_FEAR', object: 'setup paid off', validFrom: 65 }],
    'DAWN time-bridge inserted (S64 night → S65 dawn)',
  );
  assert.equal(ann[0], '+ DAWN time-bridge inserted (S64 night → S65 dawn)');
  assert.equal(ann[1], '~ Amalekites → allies (canon S40)');
  assert.equal(ann[2], '~ Antarah_fear → setup paid off (canon S65)');
});

test('diffAnnotations: no bridge → only ~ lines; nothing → empty', () => {
  assert.deepEqual(diffAnnotations([{ subject: 'X', object: 'y', validFrom: 1 }], null), ['~ X → y (canon S1)']);
  assert.deepEqual(diffAnnotations([], null), []);
});

test('diffPairLabel: from position, not render-result fields; pending → "→ pending"', () => {
  assert.equal(diffPairLabel({ label: 'V20', n: 20 }, 'V19'), 'V19 → V20');
  assert.equal(diffPairLabel({ n: 2 }, null), '— → V2');
  assert.equal(diffPairLabel(null, 'V19', true), 'V19 → pending');
});
