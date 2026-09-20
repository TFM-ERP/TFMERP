/**
 * Verification harness for the statutory statements service.
 *
 * Instantiates StatementsService against a bare PrismaClient and prints the 2025
 * statements, so the figures can be compared against the manually reconstructed
 * ones before the report is trusted. Read-only: it writes nothing.
 *
 *   npx ts-node prisma/verify-statements-2025.ts
 */
import { PrismaClient } from '@prisma/client';
import { StatementsService } from '../src/accounting/reporting/statements.service';

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(16);

async function main() {
  const prisma = new PrismaClient();
  const svc = new StatementsService(prisma as any);

  const set = await svc.fullSet({ year: 2025, comparative: false });

  console.log('\n================ INCOME STATEMENT 2025 ================');
  for (const g of set.incomeStatement.groups) {
    console.log(`\n${g.label.toUpperCase()}`);
    for (const l of g.lines) console.log(`  ${l.code}  ${l.name.padEnd(42)}${money(l.amount)}`);
    console.log(`  ${''.padEnd(48)}${money(g.total)}`);
  }
  console.log('\n  Revenue            ', money(set.incomeStatement.revenue));
  console.log('  Cost of sales      ', money(set.incomeStatement.costOfSales));
  console.log('  Gross profit       ', money(set.incomeStatement.grossProfit));
  console.log('  Operating expenses ', money(set.incomeStatement.operatingExpenses));
  console.log('  PROFIT/(LOSS)      ', money(set.incomeStatement.profitForThePeriod));

  console.log('\n============ STATEMENT OF FINANCIAL POSITION ============');
  for (const g of set.statementOfFinancialPosition.groups) {
    console.log(`\n${g.label.toUpperCase()}`);
    for (const l of g.lines) console.log(`  ${l.code}  ${l.name.padEnd(42)}${money(l.amount)}`);
    console.log(`  ${''.padEnd(48)}${money(g.total)}`);
  }
  const p = set.statementOfFinancialPosition;
  console.log('\n  Total assets                ', money(p.totalAssets));
  console.log('  Total liabilities           ', money(p.totalLiabilities));
  console.log('  Total equity                ', money(p.totalEquity));
  console.log('  Liabilities + equity        ', money(p.totalLiabilitiesAndEquity));
  console.log('  Difference                  ', money(p.difference));

  console.log('\n================== CASH FLOWS 2025 ==================');
  const c = set.statementOfCashFlows;
  console.log('  Profit for the period       ', money(c.operating.profitForThePeriod));
  for (const a of c.operating.adjustments) console.log(`  + ${a.name.padEnd(26)}${money(a.amount)}`);
  for (const w of c.operating.workingCapital) console.log(`    ${w.code} ${w.name.padEnd(24)}${money(w.amount)}`);
  console.log('  Net operating               ', money(c.operating.net));
  for (const i of c.investing.items) console.log(`    ${i.code} ${i.name.padEnd(24)}${money(i.amount)}`);
  console.log('  Net investing               ', money(c.investing.net));
  for (const f of c.financing.items) console.log(`    ${f.code} ${f.name.padEnd(24)}${money(f.amount)}`);
  console.log('  Net financing               ', money(c.financing.net));
  console.log('  Net movement                ', money(c.netMovement));
  console.log('  Opening cash                ', money(c.openingCash));
  console.log('  Closing cash                ', money(c.closingCash));
  console.log('  Actual movement             ', money(c.actualMovement));
  console.log('  Difference                  ', money(c.difference));

  console.log('\n===================== CHECKS =====================');
  console.log(JSON.stringify(set.checks, null, 2));

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
