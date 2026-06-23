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
import { UpdateBookingDto } from './update-booking.dto';
import { AddLocationDto, UpdateLocationDto } from './booking-location.dto';

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

test('UpdateBookingDto accepts a partial edit; rejects unknown fields and status (state machine only)', async () => {
  const out = await pipe.transform({ notes: 'updated', discountAmount: 50 }, meta(UpdateBookingDto));
  assert.equal(out.notes, 'updated');
  assert.equal(out.discountAmount, 50);
  await assert.rejects(() => pipe.transform({ bogus: 1 }, meta(UpdateBookingDto)), 'unknown field');
  await assert.rejects(() => pipe.transform({ status: 'ACTIVE' }, meta(UpdateBookingDto)), 'status must use the status endpoint');
});

test('AddLocationDto accepts the real add-location payload (null dates/crewCount, optional pin)', async () => {
  const real = { siteName: 'Base Camp', address: 'Dubai', locationUrl: '', fromDate: null, toDate: null, notes: '', crewCount: null, sequence: 0 };
  const out = await pipe.transform(real, meta(AddLocationDto));
  assert.equal(out.siteName, 'Base Camp');
  const withPin = await pipe.transform({ ...real, lat: 25.1, lng: 55.2 }, meta(AddLocationDto));
  assert.equal(withPin.lat, 25.1);
  await assert.rejects(() => pipe.transform({ ...real, junk: 1 }, meta(AddLocationDto)), 'extra field');
});

test('UpdateLocationDto accepts the status-only patch from the UI', async () => {
  const out = await pipe.transform({ status: 'ARRIVED' }, meta(UpdateLocationDto));
  assert.equal(out.status, 'ARRIVED');
});
