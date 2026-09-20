/**
 * QueryInvoiceDto — `archived` filter validation tests (node:test + ts-node).
 * Run: npm run test:unit
 *
 * Runs payloads through the REAL global ValidationPipe config from main.ts
 * (whitelist + transform + forbidNonWhitelisted) so it proves the actual
 * querystring shape (`?archived=true`) is accepted, and that a stray/garbled
 * value is rejected rather than silently coerced into showing archived rows.
 */
import 'reflect-metadata';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { QueryInvoiceDto } from './query-invoice.dto';

const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
const meta = (metatype: any): ArgumentMetadata => ({ type: 'query', metatype, data: undefined });

test('QueryInvoiceDto: archived is undefined when the query has no archived param', async () => {
  const out = await pipe.transform({}, meta(QueryInvoiceDto));
  assert.equal(out.archived, undefined);
});

test('QueryInvoiceDto: archived accepts the querystring values "true" and "false"', async () => {
  const a = await pipe.transform({ archived: 'true' }, meta(QueryInvoiceDto));
  assert.equal(a.archived, 'true');
  const b = await pipe.transform({ archived: 'false' }, meta(QueryInvoiceDto));
  assert.equal(b.archived, 'false');
});

test('QueryInvoiceDto: archived rejects a non-boolean-string value', async () => {
  await assert.rejects(() => pipe.transform({ archived: 'yes' }, meta(QueryInvoiceDto)), 'garbled archived value');
});
