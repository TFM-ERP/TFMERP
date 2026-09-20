/**
 * READ-ONLY. Finds 2025 expenses that look duplicated: same supplier, same date,
 * same amount, more than one row. Reports the total value at stake.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const rows = await prisma.expense.findMany({
    where: {
      expenseDate: { gte: new Date('2025-01-01T00:00:00Z'), lt: new Date('2026-01-01T00:00:00Z') },
    },
    include: { supplier: { select: { name: true } } },
    orderBy: { expenseDate: 'asc' },
  });

  const groups = new Map<string, typeof rows>();
  for (const e of rows) {
    const key = [
      e.supplierId ?? e.vendorName ?? 'none',
      e.expenseDate.toISOString().slice(0, 10),
      e.amount.toString(),
    ].join('||');
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }

  let dupRows = 0;
  let dupNet = 0;
  let dupVat = 0;
  const printed: string[] = [];

  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const extra = list.length - 1;
    dupRows += extra;
    dupNet += Number(list[0].amount) * extra;
    dupVat += Number(list[0].vatAmount) * extra;
    const [, date] = key.split('||');
    printed.push(
      `  ${date} | ${list[0].supplier?.name ?? list[0].vendorName ?? '(none)'} | amt=${
        list[0].amount
      } vat=${list[0].vatAmount} | x${list.length} | ${list
        .map((l) => l.expenseNumber)
        .join(', ')}`,
    );
  }

  console.log(`=== 2025 EXPENSES: ${rows.length} rows, ${printed.length} duplicate groups ===`);
  for (const p of printed.slice(0, 60)) console.log(p);
  if (printed.length > 60) console.log(`  ... and ${printed.length - 60} more groups`);

  console.log('\n=== VALUE AT STAKE IF THE EXTRA ROWS ARE DUPLICATES ===');
  console.log(`  extra rows      : ${dupRows}`);
  console.log(`  net overstated  : ${dupNet.toFixed(2)}`);
  console.log(`  input VAT over  : ${dupVat.toFixed(2)}`);

  console.log('\n=== SAME SUPPLIER INVOICE NUMBER USED MORE THAN ONCE (2025) ===');
  const byNumber = new Map<string, typeof rows>();
  for (const e of rows) {
    if (!e.invoiceNumber) continue;
    const list = byNumber.get(e.invoiceNumber) ?? [];
    list.push(e);
    byNumber.set(e.invoiceNumber, list);
  }
  let any = false;
  for (const [num, list] of byNumber) {
    if (list.length < 2) continue;
    any = true;
    console.log(
      `  ${num}: ${list
        .map(
          (l) =>
            `${l.expenseDate.toISOString().slice(0, 10)} ${l.supplier?.name ?? ''} amt=${
              l.amount
            } vat=${l.vatAmount}`,
        )
        .join('  ||  ')}`,
    );
  }
  if (!any) console.log('  (none)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
