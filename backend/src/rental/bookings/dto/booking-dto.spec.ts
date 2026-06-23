/**
 * Rental booking DTOs — validation tests (node:test + ts-node). Run: npm run test:unit
 *
 * Runs payloads through the REAL global ValidationPipe config from main.ts
 * (whitelist + transform + forbidNonWhitelisted) so we prove the actual frontend
 * payload is accepted and bad/extra-field payloads are rejected — the global pipe
 * is strict, so a DTO that omits a field the UI sends would 400 live requests.
 */
import 'reflect-metadata';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { CreateBookingDto } from './create-booking.dto';
import { CheckConflictsDto } from './check-conflicts.dto';

const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
const meta = (metatype: any): ArgumentMetadata => ({ type: 'body', metatype, data: undefined });

// Exactly what frontend rental/bookings/new sends (note the empty-string optional dates).
const realCreatePayload = () => ({
  clientId: 'client_1',
  startDate: '2026-06-24',
  endDate: '2026-06-30',
  deliveryDate: '',
  pickupDate: '',
  deliveryAddress: '',
  deliveryCity: '',
  deliveryNotes: '',
  pickupAddress: '',
  currency: 'AED',
  discountAmount: 0,
  poNumber: '',
  notes: '',
  internalNotes: '',
  allowConflicts: false,
  items: [{ assetId: 'asset_1', description: 'Star Trailer', quantity: 1, unitPrice: 1500, days: 5, taxAmount: 375, lineTotal: 7500 }],
});

test('CreateBookingDto accepts the exact frontend create payload (incl. empty-string optional dates)', async () => {
  const out = await pipe.transform(realCreatePayload(), meta(CreateBookingDto));
  assert.equal(out.clientId, 'client_1');
  assert.equal(out.items[0].unitPrice, 1500);
  assert.equal(out.allowConflicts, false);
});

test('CreateBookingDto rejects an undeclared field (forbidNonWhitelisted guard)', async () => {
  await assert.rejects(() => pipe.transform({ ...realCreatePayload(), sneaky: 'x' }, meta(CreateBookingDto)));
});

test('CreateBookingDto requires clientId and valid start/end dates', async () => {
  const { clientId, ...noClient } = realCreatePayload();
  await assert.rejects(() => pipe.transform(noClient, meta(CreateBookingDto)), 'missing clientId');
  await assert.rejects(() => pipe.transform({ ...realCreatePayload(), startDate: 'not-a-date' }, meta(CreateBookingDto)), 'bad startDate');
});

test('CreateBookingDto validates nested items (a line without unitPrice is rejected)', async () => {
  const bad = realCreatePayload();
  bad.items = [{ assetId: 'a', description: 'x', quantity: 1, days: 2 } as any];
  await assert.rejects(() => pipe.transform(bad, meta(CreateBookingDto)));
});

test('CheckConflictsDto accepts the frontend conflict-check payload and rejects extras/missing', async () => {
  const real = { assetIds: ['a1', 'a2'], startDate: '2026-06-24', endDate: '2026-06-30' };
  const out = await pipe.transform(real, meta(CheckConflictsDto));
  assert.deepEqual(out.assetIds, ['a1', 'a2']);
  await assert.rejects(() => pipe.transform({ startDate: '2026-06-24', endDate: '2026-06-30' }, meta(CheckConflictsDto)), 'missing assetIds');
  await assert.rejects(() => pipe.transform({ ...real, junk: 1 }, meta(CheckConflictsDto)), 'extra field');
});
