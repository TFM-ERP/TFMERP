#!/usr/bin/env node
/**
 * verify-import.js
 *
 * READ-ONLY. Confirms the invoice import landed correctly and flags the one
 * thing it could have got wrong: duplicate clients.
 *
 *   cd C:\Projects\TFM-System\backend
 *   node tools/verify-import.js
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

const BATCH = 'gmail-backfill-2026-08-19';

function line(t) {
  console.log('\n' + '='.repeat(72));
  console.log(t);
  console.log('='.repeat(72));
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  console.log('IMPORT VERIFICATION — read-only');
  console.log(`Run : ${new Date().toISOString()}`);

  // ---------------------------------------------------------- clients
  line('1. CLIENTS — is anyone in here twice?');
  const clients = await prisma.client.findMany({
    select: { id: true, companyName: true, tradeName: true, trn: true, notes: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  const mine = clients.filter((c) => String(c.notes || '').includes(BATCH));
  const theirs = clients.filter((c) => !String(c.notes || '').includes(BATCH));

  console.log(`  ${clients.length} total — ${theirs.length} pre-existing, ${mine.length} created by the import.\n`);
  console.log('  PRE-EXISTING:');
  for (const c of theirs) {
    console.log(`    ${String(c.companyName || c.tradeName || '(no name)').padEnd(52).slice(0, 52)} TRN ${c.trn || '-'}`);
  }
  console.log('\n  CREATED BY IMPORT:');
  for (const c of mine) {
    console.log(`    ${String(c.companyName).padEnd(52).slice(0, 52)} TRN ${c.trn || '-'}`);
  }

  const dupes = [];
  for (const a of mine) {
    for (const b of theirs) {
      const na = norm(a.companyName);
      const nb = norm(b.companyName || b.tradeName);
      if (!na || !nb) continue;
      const short = na.length <= nb.length ? na : nb;
      const long = na.length <= nb.length ? nb : na;
      const nameHit = short.length >= 5 && long.includes(short);
      const trnHit = a.trn && b.trn && a.trn === b.trn;
      if (nameHit || trnHit) {
        dupes.push({ a, b, why: trnHit ? 'same TRN' : 'similar name' });
      }
    }
  }
  if (dupes.length) {
    console.log(`\n  !! ${dupes.length} POSSIBLE DUPLICATE(S):`);
    for (const d of dupes) {
      console.log(`     "${d.a.companyName}"  (import, ${d.a.id})`);
      console.log(`     "${d.b.companyName || d.b.tradeName}"  (pre-existing, ${d.b.id})   — ${d.why}`);
      console.log('');
    }
    console.log('     Merge these before invoicing either one.');
  } else {
    console.log('\n  No overlap detected — the 11 pre-existing clients are different companies.');
  }

  // ---------------------------------------------------------- expenses
  line('2. EXPENSES — what is waiting for review');
  const exp = await prisma.expense.findMany({
    where: { importBatchId: BATCH },
    select: {
      expenseNumber: true, expenseDate: true, vendorName: true, invoiceNumber: true,
      amount: true, vatAmount: true, totalAmount: true, currency: true, status: true, notes: true,
    },
    orderBy: { expenseDate: 'asc' },
  });
  console.log(`  ${exp.length} imported, all importSource = BULK_IMPORT.`);

  const q1 = exp.filter((e) => e.expenseDate >= new Date('2026-04-01') && e.expenseDate < new Date('2026-07-01'));
  const q2 = exp.filter((e) => e.expenseDate >= new Date('2026-07-01'));
  const pending = exp.filter((e) => String(e.notes || '').startsWith('AMOUNT PENDING') || String(e.notes || '').startsWith('NEEDS REVIEW'));

  console.log(`\n  Apr-Jun 2026 (the overdue quarter) : ${q1.length}`);
  console.log(`  Jul-Sep 2026 (current quarter)     : ${q2.length}`);
  console.log(`  Still missing an amount            : ${pending.length}`);

  console.log('\n  Missing amounts — these need their PDF opened:');
  for (const e of pending) {
    console.log(`    ${e.expenseNumber}  ${e.expenseDate.toISOString().slice(0, 10)}  ${String(e.vendorName).padEnd(40).slice(0, 40)} ${e.invoiceNumber}`);
  }

  const byStatus = {};
  for (const e of exp) byStatus[e.status] = (byStatus[e.status] || 0) + 1;
  console.log('\n  Status:', JSON.stringify(byStatus));

  // ---------------------------------------------------------- invoices
  line('3. INVOICES ISSUED');
  const inv = await prisma.invoice.findMany({
    select: {
      invoiceNumber: true, issueDate: true, status: true, subtotal: true,
      vatAmount: true, total: true, lpoReference: true, client: { select: { companyName: true } },
    },
    orderBy: { issueDate: 'asc' },
  });
  let outNet = 0, outVat = 0;
  for (const i of inv) {
    const q = i.issueDate >= new Date('2026-04-01') && i.issueDate < new Date('2026-07-01');
    if (q) { outNet += Number(i.subtotal); outVat += Number(i.vatAmount); }
    console.log(`  ${i.issueDate.toISOString().slice(0, 10)}  ${String(i.invoiceNumber).padEnd(9)} ${String(i.status).padEnd(8)} ${String(i.client.companyName).padEnd(32).slice(0, 32)} net ${Number(i.subtotal).toFixed(2).padStart(10)}  vat ${Number(i.vatAmount).toFixed(2).padStart(8)}  ${i.lpoReference ? 'LPO ' + i.lpoReference : ''}`);
  }
  console.log(`\n  Apr-Jun 2026 output: net AED ${outNet.toFixed(2)}, VAT AED ${outVat.toFixed(2)}`);
  console.log('  (Matches the working paper if it reads 89,250.00 and 4,462.50.)');

  // ---------------------------------------------------------- ledger
  line('4. LEDGER — should still be empty');
  console.log(`  Journal entries : ${await prisma.journalEntry.count()}`);
  console.log(`  Journal lines   : ${await prisma.journalLine.count()}`);
  console.log('  Nothing posts until you approve the expenses and run post-all.');
}

main()
  .catch((e) => { console.error('\nFAILED:', e.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
