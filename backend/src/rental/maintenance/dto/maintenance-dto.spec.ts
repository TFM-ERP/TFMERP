/**
 * Maintenance DTOs — validation tests (node:test + ts-node). Run via main.ts pipe config.
 * Create payload matches the ScheduleModal form in rental/maintenance/page.tsx
 * (note the empty-string optional dates the spread sends).
 */
import 'reflect-metadata';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { CreateMaintenanceDto } from './create-maintenance.dto';
import { UpdateMaintenanceDto } from './update-maintenance.dto';

const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
const meta = (metatype: any): ArgumentMetadata => ({ type: 'body', metatype, data: undefined });

const realCreate = () => ({
  assetId: 'asset_1', maintenanceType: 'PREVENTIVE', scheduledDate: '2026-06-24',
  description: 'Oil change', vendorName: '', notes: '', nextServiceDate: '',
  cost: 500, nextServiceKm: 10000, downTimeDays: 1,
});

test('CreateMaintenanceDto accepts the schedule form payload (empty-string optional date ok)', async () => {
  const out = await pipe.transform(realCreate(), meta(CreateMaintenanceDto));
  assert.equal(out.assetId, 'asset_1');
  assert.equal(out.cost, 500);
});

test('CreateMaintenanceDto requires assetId + a valid scheduledDate + description; rejects extras', async () => {
  await assert.rejects(() => pipe.transform({ ...realCreate(), junk: 1 }, meta(CreateMaintenanceDto)), 'extra field');
  const { assetId, ...noAsset } = realCreate();
  await assert.rejects(() => pipe.transform(noAsset, meta(CreateMaintenanceDto)), 'assetId required');
  await assert.rejects(() => pipe.transform({ ...realCreate(), scheduledDate: 'nope' }, meta(CreateMaintenanceDto)), 'bad date');
});

test('UpdateMaintenanceDto accepts a partial edit and rejects unknown fields', async () => {
  const out = await pipe.transform({ description: 'Replaced filter', cost: 200 }, meta(UpdateMaintenanceDto));
  assert.equal(out.cost, 200);
  await assert.rejects(() => pipe.transform({ junk: 1 }, meta(UpdateMaintenanceDto)));
});
