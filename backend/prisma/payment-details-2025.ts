/**
 * payment-details-2025.ts — adds detail to the supplier payment records made by
 * backfill-supplier-payments-2025.ts ([PAYBACKFILL2025]). No ledger change.
 *
 * 1. PAY-2024-0001..0005 (Heartland 2024, paid by the GM): he paid them on his personal card
 *    (GM, 21 Sep 2026). Method BANK_TRANSFER -> CARD; the "not recorded" note is replaced.
 * 2. Transfers with an ADCB ProCash "PAYMENT CREDITED BENEFICIARY" e-mail (Cash.Management@adcb.com,
 *    in qais@qandil.ae): the beneficiary and payment remark from that e-mail are added to the notes.
 *    Source: Claude outputs/TFM-2025-ADCB-wire-transfers.xlsx, sheet "Outgoing transfers", columns H-I.
 *    Transfers printed "TRF TO <name>" on the statement had no ProCash e-mail and are left as they are.
 * Idempotent (tag [PAYDETAIL2025]). Pass --dry for the plan.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[PAYDETAIL2025]';
const OLD = 'Paid personally by the GM (how he paid is not recorded)';
const NEW = 'Paid personally by the GM on his personal card (GM, 21 Sep 2026)';
// ADCB reference -> [beneficiary, remark] as printed in the ProCash e-mail.
const PROCASH: Record<string, [string, string | null]> = {
  '465718721': ['KADEM ALMSIKH', null],
  '509941946': ['ali Mohammed', null],
  '513119810': ['Epilogue Media LLC', 'INVOICE 202500683'],
  '515169203': ['MACGREGOR FZ LLE', 'ARTIST TRAILER 02072025'],
  '515612741': ['Transformer general trading', null],
  '516403361': ['RAMZIA A S ALMADI', null],
  '545090663': ['AVEC EVENTS', null],
  '569744688': ['MAP- Media Art Production FZ LLC', 'MAP DPC 24 335'],
  '575281527': ['Epilogue Media LLC', 'AUDIO RENTAL'],
  '582138253': ['ali Mohammed', null],
};

async function main(): Promise<void> {
  if (await prisma.payment.count({ where: { notes: { contains: TAG } } })) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const gm = await prisma.payment.findMany({ where: { paymentNumber: { startsWith: 'PAY-2024-' }, notes: { contains: OLD } }, orderBy: { paymentNumber: 'asc' } });
  if (gm.length !== 5) throw new Error(`Expected 5 Heartland 2024 GM payments, found ${gm.length} — nothing changed.`);
  const trf = await prisma.payment.findMany({ where: { direction: 'PAYMENT', method: 'BANK_TRANSFER', reference: { in: Object.keys(PROCASH) }, notes: { contains: '[PAYBACKFILL2025]' } }, orderBy: { paymentNumber: 'asc' } });
  if (trf.length !== Object.keys(PROCASH).length) throw new Error(`Expected ${Object.keys(PROCASH).length} transfers, found ${trf.length} — nothing changed.`);
  const updates: { id: string; no: string; method?: 'CARD'; notes: string }[] = [];
  for (const p of gm) updates.push({ id: p.id, no: p.paymentNumber, method: 'CARD', notes: `${(p.notes || '').replace(OLD, NEW)} ${TAG}` });
  for (const p of trf) {
    const [ben, rem] = PROCASH[p.reference as string];
    updates.push({ id: p.id, no: p.paymentNumber, notes: `${p.notes} ADCB ProCash "Payment credited beneficiary" e-mail: beneficiary "${ben}"${rem ? `, remark "${rem}"` : ', no remark'}. ${TAG}` });
  }
  for (const u of updates) console.log(`  ${u.no}${u.method ? '  method -> CARD' : ''}\n     ${u.notes}`);
  if (DRY) { console.log(`=== DRY RUN — ${updates.length} records, nothing written ===`); await prisma.$disconnect(); return; }
  await prisma.$transaction(async (tx) => {
    for (const u of updates) await tx.payment.update({ where: { id: u.id }, data: { notes: u.notes, ...(u.method ? { method: u.method } : {}) } });
  });
  console.log(`Updated ${updates.length} payment records.`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e instanceof Error ? e.message : e); await prisma.$disconnect(); process.exit(1); });
