/**
 * PaymentsExportService — integration-style tests: the REAL service driven by a fake Prisma (no DB).
 * Covers the I/O orchestration the pure util tests don't: vendor grouping, ACH/bankable classification,
 * and the end-to-end NACHA file assembly (record types, 94-char records, 10-line blocking). Run: npm run test:unit
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { PaymentsExportService } from './payments-export.service';

const SUPPLIERS = [
  { id: 'vA', name: 'Alpha Co', bankName: 'First Bank', bankAccount: '12345678', routingNumber: '121000358' },
  { id: 'vB', name: 'Beta Ltd', bankName: 'Gulf Bank', iban: 'AE070331234567890123456', swiftCode: 'GULFAEAD' },
];
const TXNS = [
  { id: 't1', vendorId: 'vA', party: null, total: 1000, invoiceNumber: 'INV1' },
  { id: 't2', vendorId: 'vA', party: null, total: 500, invoiceNumber: 'INV2' },
  { id: 't3', vendorId: 'vB', party: null, total: 2000, invoiceNumber: 'INV3' },
  { id: 't4', vendorId: null, party: 'Petty Cash', total: 50, invoiceNumber: null },
];
const fakePrisma = () => ({
  projectTransaction: { findMany: async () => TXNS.map(t => ({ ...t })) },
  supplier: { findMany: async ({ where }: any) => SUPPLIERS.filter((s) => where?.id?.in ? where.id.in.includes(s.id) : true) },
}) as any;

test('eligible() groups by vendor, classifies ACH/bankable, totals + sorts by amount', async () => {
  const svc = new PaymentsExportService(fakePrisma());
  const { rows, totals } = await svc.eligible('proj123');
  assert.equal(totals.payees, 3);
  assert.equal(totals.amount, 3550);
  assert.equal(totals.achEligible, 1);   // only Alpha (US routing + account)
  assert.equal(totals.missingBank, 1);   // Petty Cash has no bank at all
  assert.equal(rows[0].payee, 'Beta Ltd'); // highest amount first
  const alpha: any = rows.find((r: any) => r.vendorId === 'vA');
  assert.equal(alpha.amount, 1500);
  assert.equal(alpha.achEligible, true);
  assert.deepEqual(alpha.refs, ['INV1', 'INV2']);
});

test('achFile() emits a well-formed NACHA PPD file for eligible payees only', async () => {
  const svc = new PaymentsExportService(fakePrisma());
  const res: any = await svc.achFile('proj123', { odfiRouting: '021000021', companyName: 'TFM PROD', entryDescription: 'VENDOR PAY' });
  assert.equal(res.format, 'NACHA-PPD');
  assert.match(res.fileName, /\.ach$/);
  assert.equal(res.included, 1);
  assert.equal(res.totalAmount, 1500);
  const lines = res.content.replace(/\n$/, '').split('\n');
  assert.equal(lines.length % 10, 0, 'padded to a 10-line block');
  lines.forEach((l: string) => assert.equal(l.length, 94, 'every NACHA record is 94 chars'));
  assert.match(lines[0], /^101/);                                   // file header
  assert.match(lines[1], /^5220/);                                  // batch header (220 = credits/PPD)
  assert.equal(lines.filter((l: string) => l.startsWith('6')).length, 1); // exactly one entry detail
  assert.ok(lines.some((l: string) => l.startsWith('8220')));       // batch control
  assert.ok(lines.some((l: string) => l.startsWith('9')));          // file control
  assert.equal(res.excluded.length, 2);                             // Beta + Petty Cash, with reasons
});

test('csvBatch() includes only bankable payees', async () => {
  const svc = new PaymentsExportService(fakePrisma());
  const res: any = await svc.csvBatch('proj123');
  assert.equal(res.format, 'CSV');
  assert.equal(res.rows, 2);  // Alpha (account) + Beta (IBAN); Petty Cash excluded
  assert.match(res.content.split('\n')[0], /Payee,Bank,IBAN/);
});
