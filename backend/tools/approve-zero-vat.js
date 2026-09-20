#!/usr/bin/env node
/**
 * approve-zero-vat.js
 *
 * Approves the imported expenses that are still PENDING_APPROVAL so they reach
 * the general ledger as costs.
 *
 * WHY THIS IS SAFE FOR VAT
 *   finance-reports getVatReturn() sums Expense.vatAmount where the status is
 *   APPROVED or PAID *and vatAmount > 0*. Every row targeted here carries
 *   vatAmount = 0 — foreign digital services under reverse charge, or documents
 *   with no UAE VAT. Approving them puts the cost in the ledger and leaves the
 *   VAT return untouched, which is exactly the treatment you asked for.
 *
 *   DRY RUN (default):  node tools/approve-zero-vat.js
 *   APPLY:              node tools/approve-zero-vat.js --apply
 *
 *   By default it skips rows whose amount is still 0 (the figures locked inside
 *   PDF attachments) — approving those would post an empty entry.
 *   Add --include-zero to approve them anyway.
 *
 * Refuses to run against anything but localhost. Never touches a row that
 * carries VAT, and never touches a row that is already APPROVED or PAID.
 */

const { PrismaClient } = require('@prisma/client');
// --- load backend/.env regardless of the current working directory -----------
// Prisma normally loads this for us, but only when it can resolve the path it
// baked in at generate time. Reading it here makes the script cwd-independent.
(function loadEnv() {
  const envPath = require('path').join(__dirname, '..', '.env');
  if (!require('fs').existsSync(envPath)) return;
  for (const raw of require('fs').readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    const eq = l.indexOf('=');
    if (eq === -1) continue;
    const k = l.slice(0, eq).trim();
    let v = l.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
})();

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const INCLUDE_ZERO = process.argv.includes('--include-zero');
const APPROVER = 'user-admin';

function line(t) { console.log('\n' + '='.repeat(72)); console.log(t); console.log('='.repeat(72)); }

async function main() {
  console.log('APPROVE ZERO-VAT EXPENSES INTO THE LEDGER');
  console.log(`Mode : ${APPLY ? '*** APPLY ***' : 'DRY RUN (writes nothing)'}`);
  console.log(`Zero-amount rows: ${INCLUDE_ZERO ? 'INCLUDED' : 'skipped (use --include-zero)'}`);

  try {
    const u = new URL(process.env.DATABASE_URL);
    console.log(`DB   : ${u.hostname}:${u.port || '5432'}/${(u.pathname || '').replace(/^\//, '')}`);
    if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname)) {
      console.log('\n  STOP: not localhost. Refusing to run.'); process.exitCode = 1; return;
    }
  } catch { console.log('DB   : cannot parse DATABASE_URL.'); process.exitCode = 1; return; }

  const rows = await prisma.expense.findMany({
    where: { status: 'PENDING_APPROVAL', vatAmount: 0 },
    select: {
      id: true, expenseNumber: true, expenseDate: true, vendorName: true,
      invoiceNumber: true, amount: true, currency: true, importBatchId: true, notes: true,
    },
    orderBy: { expenseDate: 'asc' },
  });

  const withVat = await prisma.expense.count({ where: { status: 'PENDING_APPROVAL', vatAmount: { gt: 0 } } });

  const zero = rows.filter((r) => Number(r.amount) === 0);
  const real = rows.filter((r) => Number(r.amount) !== 0);
  const target = INCLUDE_ZERO ? rows : real;

  line('WHAT WILL BE APPROVED');
  const byCur = {};
  for (const r of target) {
    byCur[r.currency] = (byCur[r.currency] || 0) + Number(r.amount);
    console.log(`  ${r.expenseDate.toISOString().slice(0, 10)}  ${r.expenseNumber.padEnd(22)} ${String(r.vendorName).padEnd(34).slice(0, 34)} ${r.currency} ${Number(r.amount).toFixed(2).padStart(10)}`);
  }
  console.log(`\n  ${target.length} rows. Totals by currency:`);
  for (const [c, v] of Object.entries(byCur)) console.log(`    ${c} ${v.toFixed(2)}`);

  line('LEFT ALONE');
  console.log(`  ${withVat} pending row(s) carry VAT — untouched, they need a real approval decision.`);
  if (!INCLUDE_ZERO) {
    console.log(`  ${zero.length} row(s) still have amount 0 (figure sits inside a PDF attachment):`);
    for (const r of zero) {
      console.log(`    ${r.expenseNumber.padEnd(22)} ${String(r.vendorName).padEnd(34).slice(0, 34)} ${r.invoiceNumber || ''}`);
    }
  }

  line('BEFORE YOU POST — CURRENCY');
  const foreign = target.filter((r) => r.currency !== 'AED');
  console.log(`  ${foreign.length} of these are not in AED.`);
  console.log('  post-all writes Expense.amount into the ledger with NO FX conversion,');
  console.log('  so a USD 23.10 subscription posts as 23.10 in an AED ledger — understating');
  console.log('  the cost by roughly a factor of 3.67. This is pre-existing system behaviour,');
  console.log('  not something this script introduces, but your P&L will read low until it');
  console.log('  is addressed. It does NOT affect the VAT return, which ignores zero-VAT rows.');

  if (!APPLY) {
    line('DRY RUN COMPLETE — nothing changed');
    console.log('  Re-run with --apply to approve the rows listed above.');
    return;
  }

  const res = await prisma.expense.updateMany({
    where: { id: { in: target.map((r) => r.id) } },
    data: { status: 'APPROVED', approvedById: APPROVER, approvedAt: new Date() },
  });

  line('DONE');
  console.log(`  ${res.count} expense(s) approved.`);
  const stillPending = await prisma.expense.count({ where: { status: 'PENDING_APPROVAL' } });
  console.log(`  ${stillPending} expense(s) remain PENDING_APPROVAL.`);
  console.log('\n  Now post them:');
  console.log('    POST /api/v1/accounting/post-all');
}

main()
  .catch((e) => { console.error('\nFAILED:', e.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
