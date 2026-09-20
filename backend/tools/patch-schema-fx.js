#!/usr/bin/env node
/**
 * patch-schema-fx.js
 *
 * Adds original-currency fields to the Expense model so a foreign-currency
 * invoice can be stored in AED for the ledger while keeping a faithful copy of
 * what the supplier actually billed.
 *
 *   DRY RUN:  node tools/patch-schema-fx.js
 *   APPLY:    node tools/patch-schema-fx.js --apply     (backs up schema.prisma first)
 *
 * Touches schema.prisma only. It does NOT touch the database — run
 * apply-fx-migration.js for that.
 *
 * WHAT IT ADDS TO Expense
 *   originalAmount      the supplier's own net figure
 *   originalVatAmount   the supplier's own VAT figure
 *   originalTotalAmount the supplier's own total
 *   originalCurrency    e.g. "USD" — null means the row was always AED
 *   fxRateToBase        AED per 1 unit of the original currency
 *   fxRateSource        where the rate came from, e.g. "CBUAE peg"
 *   fxConvertedAt       when the conversion was applied
 *
 * After conversion, amount / vatAmount / totalAmount / currency hold the AED
 * values, so the ledger, the trial balance and the VAT return all read AED —
 * and the original invoice is still recoverable from the original* fields.
 */

const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const SCHEMA = path.join(__dirname, '..', 'prisma', 'schema.prisma');

const FIELDS = `
  // --- original currency (added by patch-schema-fx.js) ---
  originalAmount      Decimal?  @db.Decimal(15, 2)
  originalVatAmount   Decimal?  @db.Decimal(15, 2)
  originalTotalAmount Decimal?  @db.Decimal(15, 2)
  originalCurrency    Currency?
  fxRateToBase        Decimal?  @db.Decimal(14, 6)
  fxRateSource        String?
  fxConvertedAt       DateTime?
  // --- end original currency ---
`;

function findBlock(src, kind, name) {
  const re = new RegExp(`(^|\\n)\\s*${kind}\\s+${name}\\s*\\{`, 'm');
  const m = re.exec(src);
  if (!m) return null;
  const open = src.indexOf('{', m.index);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return { bodyStart: open + 1, close: i }; }
  }
  return null;
}

let src = fs.readFileSync(SCHEMA, 'utf8');
const original = src;

console.log('SCHEMA PATCH — original-currency fields on Expense');
console.log(`Mode : ${APPLY ? '*** APPLY ***' : 'DRY RUN (writes nothing)'}`);
console.log(`File : ${SCHEMA}\n`);

const exp = findBlock(src, 'model', 'Expense');
if (!exp) {
  console.log('  [!] model Expense not found — refusing to write.');
  process.exitCode = 1;
} else {
  const body = src.slice(exp.bodyStart, exp.close);
  if (/\boriginalCurrency\b/.test(body)) {
    console.log('  [=] Expense already has the original-currency fields — nothing to do.');
  } else {
    const mapAt = body.search(/\n\s*@@unique\(|\n\s*@@index\(|\n\s*@@map\(/);
    const insertAt = mapAt === -1 ? body.length : mapAt;
    const newBody = body.slice(0, insertAt) + '\n' + FIELDS + body.slice(insertAt);
    src = src.slice(0, exp.bodyStart) + newBody + src.slice(exp.close);
    console.log('  [+] Expense + originalAmount, originalVatAmount, originalTotalAmount,');
    console.log('      originalCurrency, fxRateToBase, fxRateSource, fxConvertedAt');
    console.log(`\n  +${src.length - original.length} bytes`);

    if (APPLY) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backup = SCHEMA + `.backup-${stamp}`;
      fs.writeFileSync(backup, original);
      fs.writeFileSync(SCHEMA, src);
      console.log(`\n  Backup : ${backup}`);
      console.log(`  Written: ${SCHEMA}`);
      console.log('\n  NEXT: node tools/apply-fx-migration.js --apply');
    } else {
      console.log('\n  DRY RUN — schema.prisma was NOT modified.');
    }
  }
}
