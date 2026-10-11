/**
 * The clearance page has no login, so no Bearer and no file-pass cookie. The resolver that has
 * already checked the pack's token signs each document link it hands out.
 * Run: npm run test:unit
 *
 * The secret here is a fixed test string set in-process. Nothing in this file reads .env.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

process.env.JWT_SECRET = 'clearance-public-urls-spec-secret-not-a-real-one';

import { ClearancePacksService, signMemberDocs } from './clearance-packs.service';
import { verifyFileToken } from '../../files/files.module';

/** Split a signed path into the filename it names and its ?t= token. */
function parts(signed: string): { name: string; token: string } {
  const m = /^\/api\/v1\/uploads\/([^/?]+)\?t=([^&]+)$/.exec(signed);
  assert.ok(m, `not a signed upload path: ${signed}`);
  return { name: decodeURIComponent(m![1]), token: m![2] };
}

const member = (over: Record<string, unknown> = {}) => ({
  passportUrl: '/uploads/passport-1.pdf',
  emiratesIdUrl: '/uploads/eid-1.jpg',
  photoUrl: '/uploads/photo-1.png',
  otherDocs: [{ label: 'Visa', url: '/uploads/visa-1.pdf' }, { label: 'Permit', url: '/uploads/permit-1.pdf' }],
  ...over,
});

test('each stored upload path comes back signed, and the signature is for that file and no other', () => {
  const out = signMemberDocs(member(), 3600);
  for (const [field, name] of [['passportUrl', 'passport-1.pdf'], ['emiratesIdUrl', 'eid-1.jpg'], ['photoUrl', 'photo-1.png']] as const) {
    const p = parts(out[field] as string);
    assert.equal(p.name, name, field);
    assert.equal(verifyFileToken(name, p.token), true, `${field}: token does not open its own file`);
    assert.equal(verifyFileToken('someone-else.pdf', p.token), false, `${field}: token opens another file`);
  }
});

test('nothing is left pointing at the dead /uploads/<name> path', () => {
  assert.ok(!JSON.stringify(signMemberDocs(member(), 3600)).includes('"/uploads/'));
});

test('null stays null — a document withheld for consent never gains a link', () => {
  const out = signMemberDocs(member({ passportUrl: null, emiratesIdUrl: null, photoUrl: null, otherDocs: null }), 3600);
  assert.deepEqual(out, { passportUrl: null, emiratesIdUrl: null, photoUrl: null, otherDocs: null });
  const undef = signMemberDocs({}, 3600);
  assert.deepEqual([undef.passportUrl, undef.emiratesIdUrl, undef.photoUrl], [null, null, null]);
});

test('an external https value is returned as it is', () => {
  const ext = 'https://files.example.com/a/b/passport.pdf?x=1';
  const out = signMemberDocs(member({ passportUrl: ext, otherDocs: [{ label: 'Visa', url: ext }] }), 3600);
  assert.equal(out.passportUrl, ext);
  assert.equal((out.otherDocs as any[])[0].url, ext);
});

test('a value that is neither an upload nor http(s) is dropped, not passed through', () => {
  const out = signMemberDocs(member({ passportUrl: '/uploads/../.env', emiratesIdUrl: 'data:text/html,x', photoUrl: 'javascript:alert(1)' }), 3600);
  assert.deepEqual([out.passportUrl, out.emiratesIdUrl, out.photoUrl], [null, null, null]);
});

test('otherDocs keeps its labels and its order, and each url is signed for its own file', () => {
  const out = signMemberDocs(member(), 3600).otherDocs as any[];
  assert.deepEqual(out.map(d => d.label), ['Visa', 'Permit']);
  assert.deepEqual(out.map(d => parts(d.url).name), ['visa-1.pdf', 'permit-1.pdf']);
  for (const d of out) assert.equal(verifyFileToken(parts(d.url).name, parts(d.url).token), true);
});

test('otherDocs that is not a list is handed back untouched; a malformed entry does not throw', () => {
  assert.equal(signMemberDocs(member({ otherDocs: undefined }), 3600).otherDocs, undefined);
  assert.deepEqual(signMemberDocs(member({ otherDocs: {} }), 3600).otherDocs, {});
  const out = signMemberDocs(member({ otherDocs: [null, 'x', { label: 'No url' }, { label: 'Ok', url: '/uploads/ok.pdf' }] }), 3600).otherDocs as any[];
  assert.equal(out.length, 4);
  assert.equal(out[2].label, 'No url');
  assert.equal(out[2].url, null);
  assert.equal(parts(out[3].url).name, 'ok.pdf');
});

test('the clearance links live one hour at most, whatever TTL is asked for', () => {
  const exp = (signed: string) => Number(parts(signed).token.split('.')[0]);
  const now = Math.floor(Date.now() / 1000);
  const hour = exp(signMemberDocs(member(), 3600).passportUrl as string) - now;
  assert.ok(hour >= 3599 && hour <= 3601, `asked 3600, got ${hour}`);
  const long = exp(signMemberDocs(member(), 14400).passportUrl as string) - now;
  assert.ok(long >= 3599 && long <= 3601, `asked 14400, got ${long} — the clearance page must stay under the one-hour ceiling`);
});

test('the input member is not modified', () => {
  const m = member();
  const before = JSON.stringify(m);
  signMemberDocs(m, 3600);
  assert.equal(JSON.stringify(m), before);
});

// ---- the resolver itself, against a stub database: it must USE signMemberDocs ----

function service(pack: Record<string, unknown>, members: any[]) {
  const prisma: any = {
    clearancePack: {
      findUnique: async () => ({ id: 'pack1', token: 'tok', title: 'Pack', status: 'SHARED', expiresAt: new Date(Date.now() + 86400000), projectId: null, purpose: null, recipientName: null, recipientOrg: null, message: null, members, ...pack }),
      update: async () => ({}),
    },
    clearancePackAccess: { create: async () => ({}) },
  };
  return new ClearancePacksService(prisma);
}

test('resolvePublic hands out signed links for a consenting member, and omits a member without consent', async () => {
  const out: any = await service({}, [
    { name: 'A', roleTitle: 'Gaffer', department: 'Electric', consentGiven: true, ...member() },
    { name: 'B', roleTitle: 'Grip', department: 'Grip', consentGiven: false, ...member({ passportUrl: '/uploads/secret.pdf' }) },
  ]).resolvePublic('tok');
  assert.equal(out.expired, false);
  assert.deepEqual(out.members.map((m: any) => m.name), ['A']);
  const a = out.members[0];
  assert.deepEqual([a.roleTitle, a.department], ['Gaffer', 'Electric']);
  for (const [field, name] of [['passportUrl', 'passport-1.pdf'], ['emiratesIdUrl', 'eid-1.jpg'], ['photoUrl', 'photo-1.png']] as const) {
    assert.equal(verifyFileToken(name, parts(a[field]).token), true, field);
  }
  assert.deepEqual(a.otherDocs.map((d: any) => [d.label, parts(d.url).name]), [['Visa', 'visa-1.pdf'], ['Permit', 'permit-1.pdf']]);
  assert.ok(!JSON.stringify(out).includes('secret.pdf'), 'a non-consenting member\'s document leaked');
  assert.ok(!JSON.stringify(out).includes('"/uploads/'), 'an unsigned /uploads path was handed out');
});

test('resolvePublic signs nothing for an expired or revoked pack', async () => {
  const m = [{ name: 'A', consentGiven: true, ...member() }];
  for (const pack of [{ expiresAt: new Date(Date.now() - 1000) }, { status: 'REVOKED' }]) {
    const out: any = await service(pack, m).resolvePublic('tok');
    assert.equal(out.expired, true);
    assert.equal(out.members, undefined);
    assert.ok(!JSON.stringify(out).includes('uploads'));
  }
});
