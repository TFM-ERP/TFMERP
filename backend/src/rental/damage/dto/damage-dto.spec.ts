/**
 * Damage report DTO — validation tests (node:test + ts-node) via the main.ts pipe config.
 * The /rental/damage/new link is currently dead (no page), so the DTO encodes the service
 * contract, accepting both the chargeToClient/clientLiable and photoUrls/photos spellings.
 */
import 'reflect-metadata';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { CreateDamageDto } from './create-damage.dto';

const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
const meta = (metatype: any): ArgumentMetadata => ({ type: 'body', metatype, data: undefined });

test('CreateDamageDto accepts the service contract incl. both field-name spellings', async () => {
  const a = await pipe.transform({ bookingId: 'b1', assetId: 'a1', severity: 'MINOR', description: 'Scratch', repairCost: 200, chargeToClient: true, photoUrls: ['/uploads/x.jpg'], notes: '' }, meta(CreateDamageDto));
  assert.equal(a.repairCost, 200);
  assert.equal(a.chargeToClient, true);
  const b = await pipe.transform({ assetId: 'a1', description: 'Dent', clientLiable: false, photos: ['/uploads/y.jpg'] }, meta(CreateDamageDto));
  assert.equal(b.clientLiable, false);
});

test('CreateDamageDto rejects unknown fields and a non-number repairCost', async () => {
  await assert.rejects(() => pipe.transform({ assetId: 'a1', description: 'x', junk: 1 }, meta(CreateDamageDto)), 'extra field');
  await assert.rejects(() => pipe.transform({ assetId: 'a1', description: 'x', repairCost: 'lots' }, meta(CreateDamageDto)), 'repairCost must be a number');
});
