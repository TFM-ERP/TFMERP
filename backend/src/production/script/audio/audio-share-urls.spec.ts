/**
 * The listen page has no login, so no Bearer and no file-pass cookie. The resolver that has
 * already checked the share token signs the one audio link it hands out — for long enough to play
 * a read through, and never past the share link's own expiry.
 * Run: npm run test:unit
 *
 * The secret here is a fixed test string set in-process. Nothing in this file reads .env.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

process.env.JWT_SECRET = 'audio-share-urls-spec-secret-not-a-real-one';

import { AudioShareService, audioShareTtl, signAudioUrl } from './audio-share.service';
import { verifyFileToken, MAX_TTL_SECONDS, SERVER_MAX_TTL_SECONDS } from '../../../files/files.module';

const NOW = Date.UTC(2026, 9, 11, 12, 0, 0);
const inSeconds = (s: number) => new Date(NOW + s * 1000);

test('the two ceilings are what the ruling says: one hour for callers, four for the server', () => {
  assert.equal(MAX_TTL_SECONDS, 3600);
  assert.equal(SERVER_MAX_TTL_SECONDS, 14400);
});

test('a 90-minute read gets its length plus an hour: 5400 s -> 9000', () => {
  assert.equal(audioShareTtl(5400, null, NOW), 9000);
});

test('an unknown length is taken as two hours: null -> 10800', () => {
  assert.equal(audioShareTtl(null, null, NOW), 10800);
  assert.equal(audioShareTtl(undefined, null, NOW), 10800);
});

test('zero, negative, not finite and not a number are all "unknown": -> 10800', () => {
  for (const bad of [0, -30, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '5400', {}, true]) {
    assert.equal(audioShareTtl(bad, null, NOW), 10800, String(bad));
  }
});

test('the server ceiling holds: 20000 s -> 14400', () => {
  assert.equal(audioShareTtl(20000, null, NOW), 14400);
  assert.equal(audioShareTtl(10800, null, NOW), 14400, 'exactly at the cap');
  assert.equal(audioShareTtl(10799, null, NOW), 14399, 'one second under it');
});

test('A FILE LINK DOES NOT OUTLIVE ITS SHARE LINK: a share expiring in 600 s -> 600', () => {
  assert.equal(audioShareTtl(5400, inSeconds(600), NOW), 600);
  assert.equal(audioShareTtl(null, inSeconds(600), NOW), 600);
  assert.equal(audioShareTtl(20000, inSeconds(600), NOW), 600);
});

test('a share that expired a second ago floors at 1 s, never zero or negative', () => {
  assert.equal(audioShareTtl(5400, inSeconds(-1), NOW), 1);
  assert.equal(audioShareTtl(5400, inSeconds(0), NOW), 1);
  assert.equal(audioShareTtl(5400, inSeconds(-86400), NOW), 1);
});

test('a share expiring far off changes nothing: 30 days -> still 9000', () => {
  assert.equal(audioShareTtl(5400, inSeconds(30 * 86400), NOW), 9000);
});

test('part-seconds round down, on both the length and the time left', () => {
  assert.equal(audioShareTtl(5400.9, null, NOW), 9000);
  assert.equal(audioShareTtl(5400, new Date(NOW + 600_999), NOW), 600);
});

test('an unusable expiresAt is ignored rather than turned into a number', () => {
  assert.equal(audioShareTtl(5400, new Date(Number.NaN), NOW), 9000);
});

/** Split an absolute signed url into its base, the filename it names and its ?t= token. */
function parts(url: string): { base: string; name: string; token: string } {
  const m = /^(.*)\/api\/v1\/uploads\/([^/?]+)\?t=([^&]+)$/.exec(url);
  assert.ok(m, `not a signed upload url: ${url}`);
  return { base: m![1], name: decodeURIComponent(m![2]), token: m![3] };
}
const life = (url: string) => Number(parts(url).token.split('.')[0]) - Math.floor(Date.now() / 1000);
const near = (got: number, want: number) => got >= want - 1 && got <= want + 1;

test('the audio link is absolute — API base plus the signed path — and opens that file only', () => {
  const p = parts(signAudioUrl('/uploads/read-1.mp3', 'http://localhost:3001', 9000) as string);
  assert.equal(p.base, 'http://localhost:3001');
  assert.equal(p.name, 'read-1.mp3');
  assert.equal(verifyFileToken('read-1.mp3', p.token), true);
  assert.equal(verifyFileToken('read-2.mp3', p.token), false);
});

test('WITH TTL 9000 THE TOKEN EXPIRES IN 9000 s — not clamped to the one-hour caller ceiling', () => {
  const got = life(signAudioUrl('/uploads/read-1.mp3', 'http://localhost:3001', 9000) as string);
  assert.ok(near(got, 9000), `asked 9000, got ${got}`);
});

test('and it stops at the server ceiling: asked 20000, the token lives 14400 s', () => {
  const got = life(signAudioUrl('/uploads/read-1.mp3', 'http://localhost:3001', 20000) as string);
  assert.ok(near(got, 14400), `asked 20000, got ${got}`);
});

test('a short TTL is honoured: a share with 600 s left gets a 600 s link', () => {
  const got = life(signAudioUrl('/uploads/read-1.mp3', 'http://localhost:3001', 600) as string);
  assert.ok(near(got, 600), `asked 600, got ${got}`);
});

test('null stays null, and an external http(s) value is returned as it is', () => {
  assert.equal(signAudioUrl(null, 'http://localhost:3001', 9000), null);
  assert.equal(signAudioUrl(undefined, 'http://localhost:3001', 9000), null);
  assert.equal(signAudioUrl('', 'http://localhost:3001', 9000), null);
  const ext = 'https://cdn.example.com/a/read.mp3?sig=abc';
  assert.equal(signAudioUrl(ext, 'http://localhost:3001', 9000), ext);
});

test('a value that is neither an upload nor http(s) is dropped, not glued onto the API base', () => {
  assert.equal(signAudioUrl('/uploads/../.env', 'http://localhost:3001', 9000), null);
  assert.equal(signAudioUrl('/etc/passwd', 'http://localhost:3001', 9000), null);
  assert.equal(signAudioUrl('data:audio/mpeg;base64,AAAA', 'http://localhost:3001', 9000), null);
});

test('a bare filename and an already-guarded path are signed the same as /uploads/<name>', () => {
  assert.equal(parts(signAudioUrl('read-1.mp3', 'http://x', 9000) as string).name, 'read-1.mp3');
  assert.equal(parts(signAudioUrl('/api/v1/uploads/read-1.mp3', 'http://x', 9000) as string).name, 'read-1.mp3');
});

// ---- the resolver itself, against a stub database: it must USE the two functions above ----

function service(link: Record<string, unknown>, asset: Record<string, unknown>) {
  const updates: any[] = [];
  const prisma: any = {
    audioShareLink: {
      findUnique: async () => ({ id: 'link1', token: 'tok', assetId: 'asset1', revoked: false, expiresAt: null, maxViews: null, views: 0, passcode: null, title: 'Read', note: null, allowDownload: false, ...link }),
      update: async (args: any) => { updates.push(args); return {}; },
    },
    audioAsset: { findUnique: async () => ({ id: 'asset1', status: 'READY', url: '/uploads/read-1.mp3', format: 'mp3', durationSec: 5400, title: 'Read', generatedAt: null, ...asset }) },
  };
  return { svc: new AudioShareService(prisma, {} as any), updates };
}

test('resolvePublic hands out a signed audio link that lasts the read plus an hour', async () => {
  const { svc } = service({}, { durationSec: 5400 });
  const out: any = await svc.resolvePublic('tok');
  const p = parts(out.audioUrl);
  assert.equal(p.name, 'read-1.mp3');
  assert.equal(verifyFileToken('read-1.mp3', p.token), true);
  assert.ok(near(life(out.audioUrl), 9000), `got ${life(out.audioUrl)}`);
  assert.match(out.audioUrl, /^https?:\/\/[^/]+\/api\/v1\/uploads\//, 'not an absolute link to the guarded route');
});

test('resolvePublic: unknown length -> three hours; a share with ten minutes left -> ten minutes', async () => {
  const unknown: any = await service({}, { durationSec: null }).svc.resolvePublic('tok');
  assert.ok(near(life(unknown.audioUrl), 10800), `got ${life(unknown.audioUrl)}`);
  const closing: any = await service({ expiresAt: new Date(Date.now() + 600_500) }, { durationSec: 5400 }).svc.resolvePublic('tok');
  assert.ok(near(life(closing.audioUrl), 600), `got ${life(closing.audioUrl)}`);
});

test('resolvePublic still counts exactly one view per call — the counter is untouched', async () => {
  const { svc, updates } = service({}, {});
  await svc.resolvePublic('tok');
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].where, { id: 'link1' });
  assert.deepEqual(updates[0].data.views, { increment: 1 });
});

test('resolvePublic signs nothing for a link that is refused: expired, revoked, or out of views', async () => {
  await assert.rejects(service({ expiresAt: new Date(Date.now() - 1000) }, {}).svc.resolvePublic('tok'));
  await assert.rejects(service({ revoked: true }, {}).svc.resolvePublic('tok'));
  await assert.rejects(service({ maxViews: 3, views: 3 }, {}).svc.resolvePublic('tok'));
});
