import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { ScripOnService } from './scripton.service';

/**
 * THE BUILD STEP AND THE STAGE GATE MUST ASK FOR THE SAME CANON.
 *
 * extractCanonForBuild passed the raw brief text; the gate passes asSourceText(), which trims. On a
 * bible with a trailing newline — 3 of 17 sourced builds — that is two sha256 digests for one
 * document: the canon was stored under one and looked up under the other, so the gate never found
 * it and re-fired "extracting again" on every stage click. The fake stores ONE row, keyed exactly as
 * Postgres would key it, and both callers' texts must find it.
 */

// Trimmed, as the real path stores it: extractSourceCanon only ever receives loadSourceCanon's src.
const BIBLE = ('# JASON QUICK\n## 1. The film\nA rescue thriller.\n## 29. Continuity foundations\n' + '* Ward is forty-four.\n'.repeat(40)).trim();
const sha = (t: string) => createHash('sha256').update(t).digest('hex');

function fakeStore() {
  const rows: any[] = [];
  const prisma: any = {
    sourceCanon: {
      findUnique: async ({ where }: any) => rows.find((r) =>
        r.digest === where.digest_extractorVersion.digest && r.extractorVersion === where.digest_extractorVersion.extractorVersion) || null,
      upsert: async ({ create }: any) => { rows.push({ id: 'r' + rows.length, ...create }); return rows[rows.length - 1]; },
      update: async () => ({}),
    },
  };
  return { prisma, rows };
}

test('a canon stored for the RAW text is found by the TRIMMED text, and the other way round', async () => {
  const { prisma, rows } = fakeStore();
  const svc: any = new ScripOnService(prisma, {} as any, {} as any);
  const wrapped = '\n' + BIBLE + '\n';
  await svc.writeStoredCanon(svc.canonKeyOf(BIBLE).digest, BIBLE, [], { extracted: 0 }, null);
  assert.equal(rows[0].digest, sha(BIBLE), 'stored under the digest of the trimmed text');

  for (const asked of [wrapped, BIBLE, '  ' + BIBLE + '\r\n']) {
    svc.sourceCanonCache.clear();
    const got = await svc.loadSourceCanon('p', asked, { extract: false });
    assert.ok(got, 'not found for ' + JSON.stringify(asked.slice(0, 3)) + '… — the gate would re-extract forever');
    assert.equal(got.from, 'stored');
  }
});

test('register offsets are taken on the same trimmed text, so they point at the right characters', async () => {
  const { prisma } = fakeStore();
  const svc: any = new ScripOnService(prisma, {} as any, {} as any);
  await svc.writeStoredCanon(svc.canonKeyOf(BIBLE).digest, BIBLE, [], {}, null);
  const got = await svc.loadSourceCanon('p', '\n\n' + BIBLE, { extract: false });
  const reg = got.facts.filter((f: any) => f.kind === 'REGISTER');
  assert.equal(reg.length, 40);
  for (const f of reg) assert.equal(BIBLE.slice(f.sourceOffset, f.sourceOffset + f.statement.length), f.statement);
});
