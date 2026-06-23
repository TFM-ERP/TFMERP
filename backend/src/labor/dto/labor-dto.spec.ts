/**
 * Labor rate-rule DTO — validation tests (node:test + ts-node) via the main.ts pipe config.
 * Matches the addRule payload in setup/labor/page.tsx: blankRule() fields + agreementId,
 * with null caps and possible empty-string dates. Feeds the (tested) fringe engine.
 */
import 'reflect-metadata';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { CreateRateRuleDto } from './create-rate-rule.dto';

const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
const meta = (metatype: any): ArgumentMetadata => ({ type: 'body', metatype, data: undefined });

const real = () => ({
  label: 'Pension', rateType: 'PENSION', calcMethod: 'PERCENT', value: 0.205, base: 'GROSS',
  capPeriod: null, capAmount: null, currency: 'USD', glAccountCode: '', classificationId: '',
  sourceId: '', effectiveDate: '2026-06-24', expirationDate: '', isEstimate: false, notes: '',
  agreementId: 'agr_1',
});

test('CreateRateRuleDto accepts the rate-rule form payload (null caps, empty-string dates)', async () => {
  const out = await pipe.transform(real(), meta(CreateRateRuleDto));
  assert.equal(out.label, 'Pension');
  assert.equal(out.value, 0.205);
  assert.equal(out.capAmount, null);
});

test('CreateRateRuleDto accepts a capped/tiered variant', async () => {
  const out = await pipe.transform({ ...real(), capPeriod: 'WEEKLY', capAmount: 1500, floorAmount: 10, tiers: [{ upTo: 1000, value: 0.1 }, { upTo: null, value: 0.05 }] }, meta(CreateRateRuleDto));
  assert.equal(out.capAmount, 1500);
  assert.equal(out.tiers.length, 2);
});

test('CreateRateRuleDto requires label + numeric value and rejects unknown fields', async () => {
  await assert.rejects(() => pipe.transform({ ...real(), junk: 1 }, meta(CreateRateRuleDto)), 'extra field');
  const { label, ...noLabel } = real();
  await assert.rejects(() => pipe.transform(noLabel, meta(CreateRateRuleDto)), 'label required');
  await assert.rejects(() => pipe.transform({ ...real(), value: 'lots' }, meta(CreateRateRuleDto)), 'value must be a number');
});
