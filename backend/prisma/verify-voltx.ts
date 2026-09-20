/** READ-ONLY. Hunts for anything resembling the VoltX pilot receipts. */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('=== ANYTHING NAMED VOLT / PILOT ===');
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { companyName: { contains: 'volt', mode: 'insensitive' } },
        { tradeName: { contains: 'volt', mode: 'insensitive' } },
      ],
    },
    select: { id: true, companyName: true, tradeName: true },
  });
  console.log('  clients:', clients.length ? JSON.stringify(clients) : '(none)');

  const je = await prisma.journalEntry.findMany({
    where: {
      OR: [
        { memo: { contains: 'volt', mode: 'insensitive' } },
        { reference: { contains: 'volt', mode: 'insensitive' } },
        { memo: { contains: 'pilot', mode: 'insensitive' } },
      ],
    },
    select: { entryNumber: true, date: true, memo: true, status: true },
    orderBy: { date: 'asc' },
  });
  console.log('  journals:', je.length ? '' : '(none)');
  for (const j of je)
    console.log(`    ${j.entryNumber} | ${j.date.toISOString().slice(0, 10)} | ${j.status} | ${j.memo}`);

  const inv = await prisma.invoice.findMany({
    where: {
      OR: [
        { subject: { contains: 'volt', mode: 'insensitive' } },
        { notes: { contains: 'volt', mode: 'insensitive' } },
        { internalNotes: { contains: 'volt', mode: 'insensitive' } },
      ],
    },
    select: { invoiceNumber: true, issueDate: true, total: true },
  });
  console.log('  invoices:', inv.length ? JSON.stringify(inv) : '(none)');

  console.log('\n=== JOURNAL LINES HITTING BANK (1010) FOR 10,000 OR 20,000 ===');
  const lines = await prisma.journalLine.findMany({
    where: {
      OR: [
        { debit: { in: [10000, 20000] } },
        { credit: { in: [10000, 20000] } },
      ],
    },
    include: {
      entry: { select: { entryNumber: true, date: true, memo: true, status: true } },
      account: { select: { code: true, name: true } },
    },
    orderBy: { entry: { date: 'asc' } },
  });
  for (const l of lines) {
    console.log(
      `  ${l.entry.date.toISOString().slice(0, 10)} | ${l.entry.entryNumber} | ${
        l.account.code
      } ${l.account.name} | dr=${l.debit} cr=${l.credit} | ${l.entry.status} | ${
        l.entry.memo ?? ''
      }`,
    );
  }
  if (lines.length === 0) console.log('  (none)');

  console.log('\n=== OWNER ACCOUNT (2400) MOVEMENTS ===');
  const owner = await prisma.journalLine.findMany({
    where: { account: { code: '2400' } },
    include: {
      entry: { select: { entryNumber: true, date: true, memo: true, status: true } },
    },
    orderBy: { entry: { date: 'asc' } },
  });
  for (const l of owner) {
    console.log(
      `  ${l.entry.date.toISOString().slice(0, 10)} | ${l.entry.entryNumber} | dr=${
        l.debit
      } cr=${l.credit} | ${l.entry.memo ?? ''}`,
    );
  }
  console.log(`  (${owner.length} lines)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
