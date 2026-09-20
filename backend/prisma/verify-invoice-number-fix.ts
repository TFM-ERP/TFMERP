/**
 * READ-ONLY pre-check for the invoice-number replacement run.
 * Dumps the seven placeholder invoices with their client, dates, totals and
 * internalNotes (the [VAT2025:*] markers are load-bearing), plus the journal
 * entries that carry them, and confirms the target numbers are still free.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLACEHOLDERS = [
  'FILED-2025-Q1-I7',
  'FILED-2025-Q2-I6',
  'FILED-2025-Q2-I4',
  'FILED-2025-Q2-I7',
  'FILED-2025-Q3-I4',
  'FILED-2025-Q4-I5',
  'FILED-2025-Q4-I4',
];

const TARGETS = ['25150', '250655', '205135', '25120', 'TFMI250118', '2050152', '204442'];

async function main(): Promise<void> {
  const invoices = await prisma.invoice.findMany({
    where: { invoiceNumber: { in: PLACEHOLDERS } },
    include: { client: { select: { companyName: true, tradeName: true } } },
    orderBy: { issueDate: 'asc' },
  });

  console.log('=== PLACEHOLDER INVOICES ===');
  for (const inv of invoices) {
    console.log(
      [
        inv.invoiceNumber,
        inv.issueDate.toISOString().slice(0, 10),
        inv.client?.companyName ?? '(no client)',
        `sub=${inv.subtotal}`,
        `vat=${inv.vatAmount}`,
        `tot=${inv.total}`,
        `status=${inv.status}`,
      ].join(' | '),
    );
    console.log(`    notes: ${JSON.stringify(inv.internalNotes)}`);
  }
  console.log(`(found ${invoices.length} of ${PLACEHOLDERS.length})`);

  const taken = await prisma.invoice.findMany({
    where: { invoiceNumber: { in: TARGETS } },
    select: { id: true, invoiceNumber: true },
  });
  console.log('\n=== TARGET NUMBERS ALREADY IN USE ===');
  console.log(taken.length === 0 ? '(none - all free)' : JSON.stringify(taken, null, 2));

  console.log('\n=== JOURNALS REFERENCING THESE INVOICES ===');
  for (const inv of invoices) {
    const journals = await prisma.journalEntry.findMany({
      where: { OR: [{ sourceId: inv.id }, { reference: { contains: inv.invoiceNumber } }] },
      select: {
        id: true,
        entryNumber: true,
        date: true,
        sourceType: true,
        sourceId: true,
        reference: true,
        memo: true,
        status: true,
      },
    });
    for (const j of journals) {
      console.log(
        `${inv.invoiceNumber} -> ${j.entryNumber} | ${j.date
          .toISOString()
          .slice(0, 10)} | ${j.sourceType} | ${j.status} | ref=${j.reference ?? ''} | memo=${
          j.memo ?? ''
        }`,
      );
    }
    if (journals.length === 0) console.log(`${inv.invoiceNumber} -> (no journal found)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
