/**
 * Accounting journal DTOs — validation tests (node:test + ts-node). Run: npm run test:unit
 * Payloads run through the real main.ts ValidationPipe config (whitelist + transform +
 * forbidNonWhitelisted), matched to what components/accounting/JournalEditor.tsx sends.
 * (Balance/min-lines checks live in the service; the DTOs validate structure.)
 */
import 'reflect-metadata';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { CreateJournalDto } from './create-journal.dto';
import { UpdateJournalDto } from './update-journal.dto';

const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
const meta = (metatype: any): ArgumentMetadata => ({ type: 'body', metatype, data: undefined });

const realCreate = () => ({
  date: '2026-06-24', reference: 'REF-1', memo: 'Opening', post: false,
  lines: [
    { accountId: 'acc_cash', description: 'Cash', debit: 100, credit: 0 },
    { accountId: 'acc_rev', description: 'Revenue', debit: 0, credit: 100 },
  ],
});

test('CreateJournalDto accepts the editor payload (post flag + lines)', async () => {
  const out = await pipe.transform(realCreate(), meta(CreateJournalDto));
  assert.equal(out.lines.length, 2);
  assert.equal(out.post, false);
  assert.equal(out.lines[0].debit, 100);
});

test('CreateJournalDto accepts omitted optional reference/memo (UI sends undefined → dropped)', async () => {
  const { reference, memo, ...rest } = realCreate();
  const out = await pipe.transform(rest, meta(CreateJournalDto));
  assert.equal(out.date, '2026-06-24');
});

test('CreateJournalDto rejects unknown fields, a bad date, and a line missing accountId', async () => {
  await assert.rejects(() => pipe.transform({ ...realCreate(), junk: 1 }, meta(CreateJournalDto)), 'unknown field');
  await assert.rejects(() => pipe.transform({ ...realCreate(), date: 'nope' }, meta(CreateJournalDto)), 'bad date');
  const bad = realCreate();
  bad.lines = [{ description: 'x', debit: 1, credit: 0 } as any, { accountId: 'a', description: '', debit: 0, credit: 1 }];
  await assert.rejects(() => pipe.transform(bad, meta(CreateJournalDto)), 'line missing accountId');
});

test('UpdateJournalDto accepts a date+lines edit and rejects post (posting uses PATCH :id/post)', async () => {
  const out = await pipe.transform({ date: '2026-06-24', lines: realCreate().lines }, meta(UpdateJournalDto));
  assert.equal(out.lines.length, 2);
  await assert.rejects(() => pipe.transform({ date: '2026-06-24', lines: realCreate().lines, post: true }, meta(UpdateJournalDto)), 'post is not an update field');
});
