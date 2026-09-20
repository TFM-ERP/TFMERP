/**
 * Generates the 2025 financial statements Word document from the live ledger.
 * Read-only against the database; writes the .docx to /tmp for inspection.
 *
 *   npx ts-node --transpile-only prisma/verify-statements-docx.ts [letterhead.png]
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { StatementsService } from '../src/accounting/reporting/statements.service';
import { StatementsDocxService } from '../src/accounting/reporting/statements-docx.service';

async function main() {
  const prisma = new PrismaClient() as any;
  const docx = new StatementsDocxService(new StatementsService(prisma));

  const letterhead = process.argv[2];
  const { filename, buffer } = await docx.build({
    year: 2025,
    entityName: 'The Film Makers FZ LLC',
    trn: '100600664500003',
    licence: 'Licensed by twofour54 — Creative Media Authority, Abu Dhabi  ·  B.L. 1019/21',
    letterheadPath: letterhead,
    draft: true,
  });

  const out = `/tmp/${filename}`;
  fs.writeFileSync(out, buffer);
  console.log('written', out, buffer.length, 'bytes');
  console.log('letterhead:', letterhead ? (fs.existsSync(letterhead) ? 'embedded' : 'PATH NOT FOUND — rendered without') : 'none supplied');

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
