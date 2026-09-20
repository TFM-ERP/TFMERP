/**
 * Verification harness for the tax reporting services. Read-only.
 *
 *   npx ts-node --transpile-only prisma/verify-tax-2025.ts
 */
import { PrismaClient } from '@prisma/client';
import { StatementsService } from '../src/accounting/reporting/statements.service';
import { CorporateTaxService } from '../src/accounting/reporting/corporate-tax.service';
import { Vat201Service } from '../src/accounting/reporting/vat201.service';
import { FafService } from '../src/accounting/reporting/faf.service';
import { COMPANY_PROFILE } from '../src/accounting/reporting/company-profile';

const m = (n: number | null) =>
  n === null ? '        —' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(15);

async function main() {
  const prisma = new PrismaClient() as any;
  const statements = new StatementsService(prisma);
  const ct = new CorporateTaxService(prisma, statements);
  const vat = new Vat201Service(prisma);
  const faf = new FafService(prisma);

  console.log('\n============ VAT 201 — 2025 Q4 ============');
  const q4 = await vat.return201({ from: '2025-10-01', to: '2025-12-31' });
  for (const b of q4.boxes) {
    console.log(`  ${b.box.padStart(2)}  ${b.label.padEnd(52)}${m(b.amount)}${m(b.vat)}`);
  }
  console.log('\n  Reconciliation to the ledger:');
  console.log('   ', JSON.stringify(q4.reconciliation));
  console.log('\n  Caveats:');
  for (const c of q4.caveats) console.log(`   [box ${c.box}] ${c.issue} — ${m(c.amountAffected)}`);

  console.log('\n============ VAT 201 — 2025 full year ============');
  const year = await vat.year(2025);
  for (const q of year.quarters) {
    console.log(`  ${q.quarter}  output ${m(q.summary.totalOutputTax)}  input ${m(q.summary.totalInputTax)}  net ${m(q.summary.netVatDue)}  ${q.reconciliation.agrees ? 'ties' : 'DOES NOT TIE'}`);
  }
  console.log('  ANNUAL', JSON.stringify(year.annual));

  console.log('\n============ CORPORATE TAX — 2025 ============');
  const noRelief = await ct.computation({ year: 2025 });
  console.log(`  Filing deadline: ${noRelief.filingDeadline}`);
  console.log('\n  Without Small Business Relief:');
  for (const l of noRelief.computation) console.log(`    ${l.line.padEnd(56)}${m(l.amount)}`);

  const withRelief = await ct.computation({ year: 2025, electSmallBusinessRelief: true });
  console.log('\n  Electing Small Business Relief:');
  for (const l of withRelief.computation) console.log(`    ${l.line.padEnd(56)}${m(l.amount)}`);
  console.log('\n ', JSON.stringify(withRelief.smallBusinessRelief, null, 2));

  console.log('\n============ REVENUE RECONCILIATION ============');
  console.log(JSON.stringify(await ct.revenueReconciliation(2025), null, 2));

  console.log('\n============ FTA AUDIT FILE ============');
  const file = await faf.generate({
    from: '2025-01-01',
    to: '2025-12-31',
    company: { nameEn: COMPANY_PROFILE.nameEn, nameAr: COMPANY_PROFILE.nameAr, trn: COMPANY_PROFILE.trn },
  });
  console.log('  filename:', file.filename);
  console.log('  counts  :', JSON.stringify(file.counts));
  console.log('  first 6 lines:');
  for (const line of file.csv.split('\n').slice(0, 6)) console.log('   ', line.slice(0, 150));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
