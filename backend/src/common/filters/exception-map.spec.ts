/**
 * Exception → HTTP response mapping — pure unit tests (node:test + ts-node).
 * Drives the global exception filter so every module returns a consistent error shape
 * and Prisma errors become proper 4xx instead of leaky 500s.
 */
import 'reflect-metadata';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { mapError } from './exception-map';

test('HttpException keeps its status and message', () => {
  const r = mapError(new NotFoundException('Project not found'));
  assert.equal(r.status, 404);
  assert.equal(r.body.message, 'Project not found');
});

test('a ValidationPipe-style object response is preserved (array message)', () => {
  const r = mapError(new BadRequestException({ statusCode: 400, message: ['email must be an email'], error: 'Bad Request' }));
  assert.equal(r.status, 400);
  assert.deepEqual(r.body.message, ['email must be an email']);
  assert.equal(r.body.error, 'Bad Request');
});

test('Prisma known errors map to proper HTTP codes (duck-typed by name+code)', () => {
  const p = (code: string) => ({ name: 'PrismaClientKnownRequestError', code });
  assert.equal(mapError(p('P2002')).status, 409); // unique constraint
  assert.equal(mapError(p('P2025')).status, 404); // record not found
  assert.equal(mapError(p('P2003')).status, 400); // FK constraint
  assert.equal(mapError(p('P2999')).status, 400); // unknown Pxxxx → 400, not 500
  assert.equal(mapError(p('P2002')).body.error, 'P2002');
});

test('Prisma validation error → 400', () => {
  assert.equal(mapError({ name: 'PrismaClientValidationError', message: 'Invalid `prisma.x`' }).status, 400);
});

test('an unexpected error → generic 500 that does NOT leak internals', () => {
  const r = mapError(new Error('connect ECONNREFUSED 10.0.0.5:5432 secret'));
  assert.equal(r.status, 500);
  assert.equal(r.body.message, 'Internal server error');
  assert.ok(!JSON.stringify(r.body).includes('ECONNREFUSED'), 'must not leak the raw error');
});
