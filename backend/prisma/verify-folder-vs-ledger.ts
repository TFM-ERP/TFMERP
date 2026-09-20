/**
 * READ-ONLY. Checks whether specific invoice numbers / amounts found in the
 * OneDrive Commercials folder are present in the ledger.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NUMBERS = [
  '20458',
  '20459',
  '204443',
  '250640',
  '26031',
  '26033',
  '26035',
  '26036',
  '2051001',
  '2i2054045',
  '2054045',
  '2054046',
  '250133',
  '25167',
  '250157',
  '250158',
  '250160',
  '250161',
  '25160',
  '250121',
  '25111',
  '250120',
  '251002',
  '25010',
  '205620',
  '1i25620',
  '205188',
  '26011',
  '260001',
  '260002',
  '26032',
  '25036',
];

const AMOUNTS = [17876.25, 17025, 22968.75, 73500, 52500, 29400, 29450];

async function main(): Promise<void> {
  console.log('=== NUMBERS PRESENT IN LEDGER ===');
  const found = await prisma.invoice.findMany({
    where: { invoiceNumber: { in: NUMBERS } },
    include: { client: { select: { companyName: true } } },
    orderBy: { issueDate: 'asc' },
  });
  for (const i of found) {
    console.log(
      `  ${i.invoiceNumber} | ${i.issueDate.toISOString().slice(0, 10)} | ${
        i.client?.companyName ?? ''
      } | ${i.total} | ${i.status}`,
    );
  }
  const foundSet = new Set(found.map((i) => i.invoiceNumber));
  console.log('\n=== NUMBERS NOT IN LEDGER ===');
  console.log('  ' + NUMBERS.filter((n) => !foundSet.has(n)).join(', '));

  console.log('\n=== AMOUNT MATCHES (any year) ===');
  for (const amt of AMOUNTS) {
    const hits = await prisma.invoice.findMany({
      where: { total: amt },
      include: { client: { select: { companyName: true } } },
    });
    console.log(
      `  ${amt}: ${
        hits.length === 0
          ? 'NONE'
          : hits
              .map(
                (h) =>
                  `${h.invoiceNumber} (${h.issueDate.toISOString().slice(0, 10)}, ${
                    h.client?.companyName ?? ''
                  })`,
              )
              .join('; ')
      }`,
    );
  }

  console.log('\n=== ALL INVOICES 2025 & 2026 (number | date | client | total) ===');
  const all = await prisma.invoice.findMany({
    where: { issueDate: { gte: new Date('2025-01-01T00:00:00Z') } },
    include: { client: { select: { companyName: true } } },
    orderBy: { issueDate: 'asc' },
  });
  for (const i of all) {
    console.log(
      `  ${i.invoiceNumber} | ${i.issueDate.toISOString().slice(0, 10)} | ${
        i.client?.companyName ?? ''
      } | ${i.total}`,
    );
  }
  console.log(`  (${all.length} invoices)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
