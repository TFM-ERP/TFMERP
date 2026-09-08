import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ScripOnService } from './scripton.service';

/**
 * THE REGENERATE CALL SENT NOTHING IT WAS GIVEN.
 *
 * adaptOne assigned `note` on one line and used it on none; `dir` was assigned and never sent
 * either; and `source` read intakeProfile.sourceText alone, which is 0 characters on every project
 * that has builds — the material lives on build.brief.sourceText. Measured in the ledger on a real
 * regenerate: scripton.adapt.one in=126 out=187. 126 input tokens is the system prompt plus the
 * literal string "TARGET FORMAT: feature\nSOURCE:". A 1,174-character steering note went nowhere,
 * and the "variation" was invented from nothing.
 *
 * It looked like it worked because the return falls back per field (out.change || dir.change), so a
 * near-empty answer silently hands back the ORIGINAL direction.
 */

const SOURCE = 'FADE IN. ' + 'The harbour at first light. '.repeat(400);   // > 400 chars, as the guard requires
const NOTE = 'Adrian provides a lead, not an archive. Keep "You don\'t get to disappear".';
const DIRECTION = { label: 'FAITHFUL', title: 'The Salt Ledger', logline: 'A presumed-dead heir returns.', keep: 'The dock betrayal.', change: 'Compress the institutional layer.', tone: 'Cold maritime realism.', risk: 'Too many witnesses.' };

function harness(opts: { buildSource?: string; intakeSource?: string } = {}) {
  const seen: any = { calls: [] };
  const prisma: any = {
    developmentBuild: {
      findUnique: async () => (opts.buildSource === undefined ? null : { brief: { sourceText: opts.buildSource } }),
    },
    intakeProfile: {
      findUnique: async () => (opts.intakeSource === undefined ? null : { sourceText: opts.intakeSource }),
    },
  };
  const ai: any = {
    run: async (o: any) => {
      seen.calls.push(o);
      return { json: { label: 'FAITHFUL', title: 'A New Title', logline: 'A new logline.', keep: 'k', change: 'A new change.', tone: 't', risk: 'r' }, text: '', usage: { input_tokens: 19616, output_tokens: 900 }, stopReason: 'end_turn' };
    },
    json: async (o: any) => { seen.calls.push(o); return {}; },
  };
  return { svc: new ScripOnService(prisma, ai, {} as any), seen };
}

test('THE REGRESSION: the writer note reaches the assembled prompt', async () => {
  const { svc, seen } = harness({ buildSource: SOURCE });
  await svc.adaptOne({ projectId: 'p1', buildId: 'b1', direction: DIRECTION, note: NOTE });
  const user = String(seen.calls[0].user || '');
  assert.ok(user.includes('Adrian provides a lead, not an archive'), 'the note was assigned and never sent');
  assert.ok(user.includes("You don't get to disappear"), 'every line of the note must survive, not a summary of it');
});

test('the direction being varied reaches the prompt', async () => {
  const { svc, seen } = harness({ buildSource: SOURCE });
  await svc.adaptOne({ projectId: 'p1', buildId: 'b1', direction: DIRECTION, note: NOTE });
  const user = String(seen.calls[0].user || '');
  assert.ok(user.includes('The Salt Ledger'), 'asked to vary THIS direction, it was never told which');
  assert.ok(user.includes('Compress the institutional layer.'), 'the fields it must stay close to');
});

test('the SOURCE comes from the build brief — intakeProfile.sourceText is 0 chars on real projects', async () => {
  const { svc, seen } = harness({ buildSource: SOURCE, intakeSource: '' });
  await svc.adaptOne({ projectId: 'p1', buildId: 'b1', direction: DIRECTION, note: NOTE });
  const user = String(seen.calls[0].user || '');
  assert.ok(user.length > 5000, 'the request was 126 tokens because the source never loaded: ' + user.length);
  assert.ok(user.includes('FADE IN.'), 'the build brief holds the material');
});

test('THE THROW IS COVERED: no source anywhere must refuse, not regenerate from nothing', async () => {
  const { svc, seen } = harness({ buildSource: '', intakeSource: '' });
  await assert.rejects(
    () => svc.adaptOne({ projectId: 'p1', buildId: 'b1', direction: DIRECTION, note: NOTE }),
    /no source material/i,
    'regenerating with an empty prompt invents a direction and then hides it behind the original',
  );
  assert.equal(seen.calls.length, 0, 'and it must not spend a call to do it');
});

test('it refuses when neither a build nor an intake row exists at all', async () => {
  const { svc } = harness({});
  await assert.rejects(() => svc.adaptOne({ projectId: 'p1', buildId: 'b1', direction: DIRECTION }), /no source material/i);
});

test('an explicit sourceText argument still wins, for callers that carry their own', async () => {
  const { svc, seen } = harness({});
  await svc.adaptOne({ projectId: 'p1', sourceText: SOURCE, direction: DIRECTION, note: NOTE });
  assert.ok(String(seen.calls[0].user || '').includes('FADE IN.'));
});

test('a note is optional — regenerate without one still sends the direction and source', async () => {
  const { svc, seen } = harness({ buildSource: SOURCE });
  await svc.adaptOne({ projectId: 'p1', buildId: 'b1', direction: DIRECTION });
  const user = String(seen.calls[0].user || '');
  assert.ok(user.includes('The Salt Ledger'));
  assert.doesNotMatch(user, /WRITER NOTE/, 'no empty heading when there is no note');
});

test('an empty answer is an ERROR, not a silent fallback to the original direction', async () => {
  const prisma: any = {
    developmentBuild: { findUnique: async () => ({ brief: { sourceText: SOURCE } }) },
    intakeProfile: { findUnique: async () => null },
  };
  const ai: any = { run: async () => ({ json: null, text: '', usage: { output_tokens: 6000 }, stopReason: 'max_tokens' }) };
  const svc = new ScripOnService(prisma, ai, {} as any);
  await assert.rejects(
    () => svc.adaptOne({ projectId: 'p1', buildId: 'b1', direction: DIRECTION }),
    /ceiling/i,
    'out.change || dir.change returned the ORIGINAL and called it a regeneration',
  );
});

test('the returned direction keeps the label and takes the new fields', async () => {
  const { svc } = harness({ buildSource: SOURCE });
  const r: any = await svc.adaptOne({ projectId: 'p1', buildId: 'b1', direction: DIRECTION, note: NOTE });
  assert.equal(r.direction.label, 'FAITHFUL', 'the label is the one thing that must not change');
  assert.equal(r.direction.change, 'A new change.', 'and the varied fields are the new ones');
});
