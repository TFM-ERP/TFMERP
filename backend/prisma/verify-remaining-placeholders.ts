/** READ-ONLY. Lists the invoices still carrying a placeholder number. */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const rows = await prisma.invoice.findMany({
    where: { invoiceNumber: { startsWith: 'FILED-' } },
    include: { client: { select: { companyName: true } } },
    orderBy: { issueDate: 'asc' },
  });
  for (const inv of rows) {
    console.log(
      `${inv.invoiceNumber} | ${inv.issueDate.toISOString().slice(0, 10)} | ${
        inv.client?.companyName ?? '(none)'
      } | sub=${inv.subtotal} vat=${inv.vatAmount} tot=${inv.total} | ${inv.status}`,
    );
    console.log(`   ${inv.internalNotes ?? ''}`);
  }
  console.log(`\n(${rows.length} outstanding)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
