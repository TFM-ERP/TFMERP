/**
 * Accounting account/bank/reconciliation DTOs — validation tests (node:test + ts-node).
 * Payloads run through the real main.ts ValidationPipe config, matched to the
 * accounts and bank-rec pages. Both create services spread the body, so the DTOs
 * must whitelist exactly the persisted columns.
 */
import 'reflect-metadata';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { CreateAccountDto } from './create-account.dto';
import { CreateBankAccountDto } from './create-bank-account.dto';
import { CompleteReconciliationDto } from './complete-reconciliation.dto';

const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
const meta = (metatype: any): ArgumentMetadata => ({ type: 'body', metatype, data: undefined });

test('CreateAccountDto accepts the COA form payload; rejects extras, a bad GlType, and missing code', async () => {
  const real = { code: '5000', name: 'Office Supplies', type: 'EXPENSE', subtype: '', isBank: false };
  const out = await pipe.transform(real, meta(CreateAccountDto));
  assert.equal(out.code, '5000');
  assert.equal(out.isBank, false);
  await assert.rejects(() => pipe.transform({ ...real, junk: 1 }, meta(CreateAccountDto)), 'unknown field');
  await assert.rejects(() => pipe.transform({ ...real, type: 'BOGUS' }, meta(CreateAccountDto)), 'invalid GlType');
  const { code, ...noCode } = real;
  await assert.rejects(() => pipe.transform(noCode, meta(CreateAccountDto)), 'code required');
});

test('CreateBankAccountDto accepts the add-bank form payload and rejects extras', async () => {
  const real = { name: 'Main Operating', bankName: '', accountNumber: '', glAccountId: 'gl_1' };
  const out = await pipe.transform(real, meta(CreateBankAccountDto));
  assert.equal(out.glAccountId, 'gl_1');
  await assert.rejects(() => pipe.transform({ name: 'X', bankName: '', accountNumber: '' }, meta(CreateBankAccountDto)), 'glAccountId required');
  await assert.rejects(() => pipe.transform({ ...real, junk: 1 }, meta(CreateBankAccountDto)), 'extra field');
});

test('CompleteReconciliationDto accepts the finish-reconciliation payload; balances must be numbers', async () => {
  const real = { bankAccountId: 'b1', statementDate: '2026-06-24', statementBalance: 1000, clearedBalance: 950 };
  const out = await pipe.transform(real, meta(CompleteReconciliationDto));
  assert.equal(out.statementBalance, 1000);
  await assert.rejects(() => pipe.transform({ ...real, statementBalance: 'x' }, meta(CompleteReconciliationDto)), 'balance must be a number');
  await assert.rejects(() => pipe.transform({ ...real, junk: 1 }, meta(CompleteReconciliationDto)), 'extra field');
});
