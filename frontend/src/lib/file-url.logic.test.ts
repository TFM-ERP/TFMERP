import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadPath } from './file-url.logic.ts';

// Uploaded files are served by ONE route, GET /api/v1/uploads/<name>, behind a guard. There is no
// public /uploads. uploadPath turns whatever a record stores into the path on that route.

const api = (path: string) => ({ kind: 'api', path });

test('nothing stored is "empty"', () => {
  for (const v of [null, undefined, '', '   ']) assert.deepEqual(uploadPath(v), { kind: 'empty' });
});

test('a stored /uploads/<name> points at the guarded route, not the dead public path', () => {
  assert.deepEqual(uploadPath('/uploads/poster-1.jpg'), api('/api/v1/uploads/poster-1.jpg'));
  assert.deepEqual(uploadPath('uploads/poster-1.jpg'), api('/api/v1/uploads/poster-1.jpg'));
});

test('a bare filename is an upload too', () => {
  assert.deepEqual(uploadPath('poster-1.jpg'), api('/api/v1/uploads/poster-1.jpg'));
});

test('a name is encoded once: a space becomes %20, and an already-encoded name is not encoded twice', () => {
  assert.deepEqual(uploadPath('/uploads/a b.pdf'), api('/api/v1/uploads/a%20b.pdf'));
  assert.deepEqual(uploadPath('/uploads/a%20b.pdf'), api('/api/v1/uploads/a%20b.pdf'));
  assert.deepEqual(uploadPath('/uploads/50%.pdf'), api('/api/v1/uploads/50%25.pdf'), 'a stray % that is not an escape');
});

test('http(s), data: and blob: values are external and come back untouched', () => {
  for (const u of ['https://cdn.example.com/a/b.jpg?x=1', 'http://example.com/uploads/x.jpg', 'HTTPS://EXAMPLE.COM/x', 'data:image/png;base64,AAAA', 'blob:http://localhost:3000/3f2b-preview']) {
    assert.deepEqual(uploadPath(u), { kind: 'external', url: u });
    assert.deepEqual(uploadPath(u, { download: true }), { kind: 'external', url: u }, 'download must not rewrite an external url');
  }
});

test('A SERVER-SIGNED PATH PASSES THROUGH BYTE FOR BYTE: same name, same ?t=, nothing re-encoded', () => {
  // The clearance page hands assetUrl links the server has already signed. Rebuilding one from
  // its filename would drop the ?t= and turn a working link into a 401.
  for (const signed of [
    '/api/v1/uploads/passport-1.pdf?t=1791800000.ab12cd34.Zm9vYmFyLV9zaWc',
    '/api/v1/uploads/a%20b.pdf?t=1791800000.ab12cd34.Zm9v-_',
    '/api/v1/uploads/x.mp3?t=1.2.3&other=1',
    '/api/v1/uploads/plain.jpg',
  ]) assert.deepEqual(uploadPath(signed), api(signed));
});

test('a signed path gains &dl=1 only when download is asked, and keeps its ?t= intact', () => {
  const signed = '/api/v1/uploads/passport-1.pdf?t=1791800000.ab12cd34.Zm9vYmFyLV9zaWc';
  assert.deepEqual(uploadPath(signed, { download: true }), api(`${signed}&dl=1`));
  assert.deepEqual(uploadPath(signed, { download: false }), api(signed));
  assert.deepEqual(uploadPath(signed, {}), api(signed));
});

test('a plain upload gains ?dl=1 when download is asked', () => {
  assert.deepEqual(uploadPath('/uploads/report.pdf', { download: true }), api('/api/v1/uploads/report.pdf?dl=1'));
  assert.deepEqual(uploadPath('report.pdf', { download: true }), api('/api/v1/uploads/report.pdf?dl=1'));
  assert.deepEqual(uploadPath('/api/v1/uploads/report.pdf', { download: true }), api('/api/v1/uploads/report.pdf?dl=1'));
});

test('dl=1 is not added twice, and goes before a #fragment', () => {
  assert.deepEqual(uploadPath('/api/v1/uploads/r.pdf?dl=1', { download: true }), api('/api/v1/uploads/r.pdf?dl=1'));
  assert.deepEqual(uploadPath('/api/v1/uploads/r.pdf?t=1.2.3&dl=1', { download: true }), api('/api/v1/uploads/r.pdf?t=1.2.3&dl=1'));
  assert.deepEqual(uploadPath('/uploads/r.pdf#page=2', { download: true }), api('/api/v1/uploads/r.pdf?dl=1#page=2'));
});

test('a query or fragment on a stored /uploads value is kept', () => {
  assert.deepEqual(uploadPath('/uploads/r.pdf?v=3'), api('/api/v1/uploads/r.pdf?v=3'));
  assert.deepEqual(uploadPath('/uploads/r.pdf#page=2'), api('/api/v1/uploads/r.pdf#page=2'));
  assert.deepEqual(uploadPath('/uploads/r.pdf?v=3', { download: true }), api('/api/v1/uploads/r.pdf?v=3&dl=1'));
});

test('any other server path is left as it was: resolved against the API host, not turned into an upload', () => {
  assert.deepEqual(uploadPath('/api/v1/company/logo/logo.png'), api('/api/v1/company/logo/logo.png'));
  assert.deepEqual(uploadPath('/uploads/nested/deep.jpg'), api('/uploads/nested/deep.jpg'), 'the guarded route serves one level; a nested value is not rewritten into a wrong name');
  assert.deepEqual(uploadPath('exports/report.pdf'), api('/exports/report.pdf'));
  assert.deepEqual(uploadPath('/exports/report.pdf', { download: true }), api('/exports/report.pdf'), 'dl=1 means something to the uploads route only');
});
