/**
 * backfill-paid-from-2025.ts
 *
 * The 64 supplier payments created by backfill-supplier-payments-2025.ts ([PAYBACKFILL2025])
 * have no `paidFrom`, because the field did not exist then. Where the money came from is
 * read back from the evidence already in the ledger, in this order:
 *   1. the entry's own credit side: 1010 -> COMPANY_BANK · 1000 -> CASH_ON_HAND · 2400 -> OWNER;
 *   2. for an entry that re-points an earlier card line (it credits a cost account instead),
 *      the credit side of that card entry, which its memo names;
 *   3. failing both, the payment's bank account: ADCB means the company's own bank.
 * A 6500 debit in the same entry (a Tamara or transfer fee) is copied to `feeAmount`.
 *
 * No journal line is touched: trial balance and the 2025 result stay exactly as they are.
 * Guards: every payment must resolve to exactly one source, and the totals must be
 * 64 = 52 + 5 + 7; anything else throws before writing. Idempotent (only rows with
 * paidFrom still null). Pass --dry for the plan.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[PAYBACKFILL2025]';
const SOURCE: Record<string, 'COMPANY_BANK' | 'CASH_ON_HAND' | 'OWNER'> = {
  '1010': 'COMPANY_BANK',
  '1000': 'CASH_ON_HAND',
  '2400': 'OWNER',
};
const EXPECTED = { total: 64, COMPANY_BANK: 52, CASH_ON_HAND: 5, OWNER: 7 };
const r2 = (n: number): number => Math.round(n * 100) / 100;

async function main(): Promise<void> {
  const pays = await prisma.payment.findMany({
    where: { direction: 'PAYMENT', paidFrom: null, notes: { contains: TAG } },
    orderBy: { paymentNumber: 'asc' },
    select: { id: true, paymentNumber: true, amount: true, bankAccountId: true },
  });
  if (!pays.length) { console.log('Already applied.'); await prisma.$disconnect(); return; }

  const jes = await prisma.journalEntry.findMany({
    where: { sourceType: 'PAYMENT', sourceId: { in: pays.map((p) => p.id) } },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  const byPayment = new Map(jes.map((j) => [j.sourceId, j]));

  // Card entries that a re-point refers to, loaded in one go.
  const refNumbers = [...new Set(jes.flatMap((j) => (j.memo || '').match(/JE-\d{4}-\d{4}/g) || []))];
  const refs = await prisma.journalEntry.findMany({
    where: { entryNumber: { in: refNumbers } },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  const byNumber = new Map(refs.map((j) => [j.entryNumber, j]));
  const creditSources = (j: { lines: { credit: any; account: { code: string } }[] }): ('COMPANY_BANK' | 'CASH_ON_HAND' | 'OWNER')[] =>
    [...new Set(j.lines.filter((l) => Number(l.credit) > 0 && SOURCE[l.account.code]).map((l) => SOURCE[l.account.code]))];

  const plan = pays.map((p) => {
    const j = byPayment.get(p.id);
    if (!j) throw new Error(`${p.paymentNumber} has no ledger entry — nothing changed.`);

    let paidFrom = creditSources(j)[0];
    let basis = 'its own entry';
    if (!paidFrom) {
      // A re-point: the money left the bank on the card entry this one corrects.
      const ref = (j.memo || '').match(/JE-\d{4}-\d{4}/)?.[0];
      const card = ref ? byNumber.get(ref) : undefined;
      const fromCard = card ? creditSources(card)[0] : undefined;
      if (fromCard) { paidFrom = fromCard; basis = `card entry ${ref}`; }
    }
    if (!paidFrom && p.bankAccountId) { paidFrom = 'COMPANY_BANK'; basis = 'its bank account'; }
    if (!paidFrom) throw new Error(`${p.paymentNumber} (${j.entryNumber}): cannot tell where the money came from — nothing changed.`);
    if (creditSources(j).length > 1) throw new Error(`${p.paymentNumber} (${j.entryNumber}): the credit side names more than one source — nothing changed.`);

    const fee = r2(j.lines.filter((l) => l.account.code === '6500').reduce((s, l) => s + Number(l.debit), 0));
    return { id: p.id, no: p.paymentNumber, je: j.entryNumber, amount: Number(p.amount), paidFrom, basis, fee: fee > 0 ? fee : null };
  });

  const count = (v: string): number => plan.filter((x) => x.paidFrom === v).length;
  for (const x of plan) console.log(`  ${x.no}  ${x.je}  ${x.amount.toFixed(2).padStart(10)}  ${x.paidFrom.padEnd(12)} from ${x.basis}${x.fee ? `  ·  fee ${x.fee.toFixed(2)}` : ''}`);
  console.log(`  ${plan.length} payments — company bank ${count('COMPANY_BANK')} · cash ${count('CASH_ON_HAND')} · owner ${count('OWNER')} · with a fee ${plan.filter((x) => x.fee).length}`);
  if (plan.length !== EXPECTED.total || count('COMPANY_BANK') !== EXPECTED.COMPANY_BANK || count('CASH_ON_HAND') !== EXPECTED.CASH_ON_HAND || count('OWNER') !== EXPECTED.OWNER) {
    throw new Error(`Expected ${EXPECTED.total} = ${EXPECTED.COMPANY_BANK} + ${EXPECTED.CASH_ON_HAND} + ${EXPECTED.OWNER} — nothing changed.`);
  }

  if (DRY) { console.log('=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }
  await prisma.$transaction(plan.map((x) => prisma.payment.update({ where: { id: x.id }, data: { paidFrom: x.paidFrom, feeAmount: x.fee } })));
  console.log(`Updated ${plan.length} payments.`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e instanceof Error ? e.message : e); await prisma.$disconnect(); process.exit(1); });
