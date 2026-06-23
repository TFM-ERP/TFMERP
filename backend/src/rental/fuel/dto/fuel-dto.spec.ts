/**
 * Fuel log DTO — validation tests (node:test + ts-node) via the main.ts pipe config.
 * No live frontend caller; the DTO encodes the service contract (it accepts both the
 * litres/liters and costPerLitre/pricePerLiter spellings the service reads).
 */
import 'reflect-metadata';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { CreateFuelLogDto } from './create-fuel-log.dto';

const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
const meta = (metatype: any): ArgumentMetadata => ({ type: 'body', metatype, data: undefined });

test('CreateFuelLogDto accepts the service contract (both litres/costPerLitre spellings)', async () => {
  const a = await pipe.transform({ assetId: 'a1', litres: 50, costPerLitre: 3.5, logDate: '2026-06-24', odometer: 12000, fuelStation: 'ENOC', notes: '' }, meta(CreateFuelLogDto));
  assert.equal(a.litres, 50);
  const b = await pipe.transform({ assetId: 'a1', liters: 50, pricePerLiter: 3.5, logDate: '2026-06-24' }, meta(CreateFuelLogDto));
  assert.equal(b.liters, 50);
});

test('CreateFuelLogDto requires assetId and rejects unknown fields', async () => {
  await assert.rejects(() => pipe.transform({ litres: 50, logDate: '2026-06-24' }, meta(CreateFuelLogDto)), 'assetId required');
  await assert.rejects(() => pipe.transform({ assetId: 'a1', logDate: '2026-06-24', junk: 1 }, meta(CreateFuelLogDto)), 'extra field');
});
