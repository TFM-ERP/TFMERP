import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ScripOnService } from './scripton.service';

/**
 * THE SESSION'S ROOT CAUSE, PINNED.
 *
 * saveIntake -> materialiseSources rewrites `sourceText` on ANY save that carries a `sources` array,
 * and it used to rebuild that field as `corpus || String(data.sourceText || '')`. Both fallbacks read
 * the REQUEST; neither read the RECORD. So a caller that never mentioned sourceText had it
 * reconstructed from nothing and the empty result written over the writer's material — no error, no
 * truncation marker, nothing left in any column to find afterwards.
 *
 * Measured consequence: intakeProfile.sourceText was 0 characters on every project that had sources,
 * while the two projects without sources kept theirs. generateStage read that column, found nothing,
 * and the develop ladder generated every stage of every build blind.
 *
 * The fake below stores a real row, so a regression writes an empty string into it exactly as it
 * would into Postgres. It is the scratch-project proof, made permanent and free to run.
 */

function fakeDb(row: Record<string, any> | null) {
  const db: { profile: Record<string, any> | null } = { profile: row ? { ...row } : null };
  const prisma: any = {
    intakeProfile: {
      findUnique: async ({ select }: any = {}) => {
        if (!db.profile) return null;
        if (!select) return { ...db.profile };
        const out: Record<string, any> = {};
        for (const k of Object.keys(select)) out[k] = (db.profile as any)[k];
        return out;
      },
      upsert: async ({ create, update }: any) => {
        db.profile = db.profile ? { ...db.profile, ...update } : { ...create };
        return { ...db.profile };
      },
    },
  };
  return { prisma, db };
}

const KNOWN = 'THE WRITER SOURCE — 66,128 characters of screenplay material that must survive.';
const svc = (prisma: any) => new ScripOnService(prisma, {} as any, {} as any);

test('THE REGRESSION: a save that never mentions sourceText must not erase it', async () => {
  const { prisma, db } = fakeDb({ projectId: 'p1', sourceText: KNOWN });
  // Exactly the call that destroyed 88 characters on a scratch project: one source, extracting to
  // nothing. A paste carries its content in `value`; `text` is the field extraction DERIVES from it.
  await svc(prisma).saveIntake('p1', { sources: [{ kind: 'paste', value: '' }] });
  assert.equal(db.profile!.sourceText, KNOWN, 'the writer material was rebuilt from a request that never carried it');
});

test('sources that DO carry text assemble into sourceText, as before', async () => {
  const { prisma, db } = fakeDb({ projectId: 'p1', sourceText: KNOWN });
  await svc(prisma).saveIntake('p1', { sources: [{ kind: 'paste', value: 'FADE IN: a new corpus.' }] });
  assert.match(String(db.profile!.sourceText), /FADE IN: a new corpus\./, 'a real corpus still wins');
  assert.notEqual(db.profile!.sourceText, KNOWN);
});

test('an EXPLICIT empty sourceText is honoured — clearing the box is a real instruction', async () => {
  const { prisma, db } = fakeDb({ projectId: 'p1', sourceText: KNOWN });
  await svc(prisma).saveIntake('p1', { sources: [{ kind: 'paste', value: '' }], sourceText: '' });
  assert.equal(db.profile!.sourceText, '', 'the record must not override a deliberate clear');
});

test('a save with NO sources array leaves sourceText and sources untouched', async () => {
  // A partial save — one field, no sources — must not disturb anything else.
  const { prisma, db } = fakeDb({ projectId: 'p1', sourceText: KNOWN, sources: [{ kind: 'paste', value: 'x' }] });
  await svc(prisma).saveIntake('p1', { genres: ['Thriller'] });
  assert.equal(db.profile!.sourceText, KNOWN);
  assert.deepEqual(db.profile!.sources, [{ kind: 'paste', value: 'x' }]);
  assert.deepEqual(db.profile!.genres, ['Thriller']);
});

test('THE DIRECTION IS NOT WRITTEN THROUGH THE INTAKE: any treatment is refused, and nothing is written', async () => {
  // On 10 Sep a tab running pre-change code posted { treatment } and replaced the project direction that
  // 25 builds read. Every shape is refused — a pick's text, a style label, and the form's empty default.
  const LEGACY = 'FAITHFUL - change: the direction the builds without their own still read';
  for (const treatment of ['REINVENTION - change: invert the point of view', 'Multi-POV', '']) {
    const { prisma, db } = fakeDb({ projectId: 'p1', sourceText: KNOWN, treatment: LEGACY });
    await assert.rejects(svc(prisma).saveIntake('p1', { treatment, tone: 'warm' }), /no longer accepts "treatment"/);
    assert.equal(db.profile!.treatment, LEGACY, 'treatment ' + JSON.stringify(treatment) + ' must not be written');
    assert.equal(db.profile!.tone, undefined, 'a refused save writes none of its other fields either');
    assert.equal(db.profile!.sourceText, KNOWN);
  }
});

test('the caller sending sourceText explicitly still wins over the record', async () => {
  const { prisma, db } = fakeDb({ projectId: 'p1', sourceText: KNOWN });
  await svc(prisma).saveIntake('p1', { sources: [{ kind: 'paste', value: '' }], sourceText: 'REPLACED' });
  assert.equal(db.profile!.sourceText, 'REPLACED');
});

test('a first save on a project with no row yet still works', async () => {
  const { prisma, db } = fakeDb(null);
  await svc(prisma).saveIntake('p-new', { sources: [{ kind: 'paste', value: 'first material' }] });
  assert.match(String(db.profile!.sourceText), /first material/);
  assert.equal(db.profile!.projectId, 'p-new');
});

test('other intake fields are merged, never wiped, by a partial save', async () => {
  const { prisma, db } = fakeDb({ projectId: 'p1', sourceText: KNOWN, tone: 'bleak', language: 'ar' });
  await svc(prisma).saveIntake('p1', { tone: 'warm' });
  assert.equal(db.profile!.tone, 'warm');
  assert.equal(db.profile!.language, 'ar', 'a field the caller never mentioned survives');
  assert.equal(db.profile!.sourceText, KNOWN);
});
