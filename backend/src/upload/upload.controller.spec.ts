/**
 * THE EXACT FAILURE THIS CATCHES: DELETE /api/v1/upload/:filename behind JwtAuthGuard alone. Any
 * signed-in user of any role could unlink any file in uploads/ by name — a supplier invoice, a
 * passport scan, a rendered mix — with no ownership check, no role check and nothing that restores
 * the file. The frontend never called it (deleteUploadedFile had zero callers), so the route was
 * pure exposure. It is removed, not gated: nothing needs it.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { UploadController } from './upload.controller';

const proto = UploadController.prototype as any;
const routes = Object.getOwnPropertyNames(proto)
  .filter((m) => m !== 'constructor' && Reflect.getMetadata(PATH_METADATA, proto[m]) !== undefined);

test('the controller has no delete handler', () => {
  assert.equal(proto.deleteFile, undefined, 'deleteFile is back — any signed-in user can delete any upload');
  for (const m of routes) {
    assert.notEqual(Reflect.getMetadata(METHOD_METADATA, proto[m]), RequestMethod.DELETE, `${m} is a DELETE route`);
  }
});

test('the one route left is the upload itself, and it is a POST', () => {
  assert.deepEqual(routes, ['uploadFile']);
  assert.equal(Reflect.getMetadata(METHOD_METADATA, proto.uploadFile), RequestMethod.POST);
});
