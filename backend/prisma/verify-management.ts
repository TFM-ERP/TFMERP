import { PrismaClient } from '@prisma/client';
import { StatementsService } from '../src/accounting/reporting/statements.service';
import { ManagementReportsService } from '../src/accounting/reporting/management-reports.service';

async function main() {
  const prisma = new PrismaClient() as any;
  const svc = new ManagementReportsService(prisma, new StatementsService(prisma));
  const at = new Date('2025-12-31');
  const ar = await svc.agedReceivables(at);
  console.log('AGED RECEIVABLES @31/12/2025');
  console.log('  buckets:', JSON.stringify(ar.byBucket));
  console.log('  total', ar.total, ' control 1100', ar.controlAccount, ' diff', ar.difference);
  const ap = await svc.agedPayables(at);
  console.log('\nAGED PAYABLES @31/12/2025');
  console.log('  buckets:', JSON.stringify(ap.byBucket));
  console.log('  total', ap.total, ' control 2000', ap.controlAccount, ' diff', ap.difference);
  if (ap.note) console.log('  note:', ap.note);
  console.log('\nEXECUTIVE SUMMARY 2025');
  console.log(JSON.stringify(await svc.executiveSummary(2025), null, 2));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
