#!/usr/bin/env node
/**
 * reset-accounting-testdata.js
 *
 * Clears TEST accounting data from tfm_erp so the real invoice import starts clean.
 *
 *   DRY RUN (default — reports only, deletes nothing):
 *     cd C:\Projects\TFM-System\backend
 *     node tools/reset-accounting-testdata.js
 *
 *   APPLY (deletes, inside a single transaction):
 *     node tools/reset-accounting-testdata.js --apply
 *
 * WHAT IT DELETES
 *   - every Expense
 *   - every JournalEntry + JournalLine (the GL postings those expenses produced)
 *   - every Invoice + InvoiceItem, Quotation + QuotationItem, Payment
 *   - every Supplier and its documents/contacts
 *   - resets the EXP / INV / QUO DocumentSequence counters to 0
 *
 * WHAT IT KEEPS
 *   - Chart of accounts, bank accounts, tax rates, cost centres  (setup, not test data)
 *   - Users, Clients                                             (master data)
 *   - ProjectTransaction and everything under production/        (different module)
 *
 * SAFETY
 *   Before deleting, it writes every row it is about to remove to
 *   tools/_reset-backup-<timestamp>.json. That is a data record, not a
 *   restore path — a pg_dump is still the only true rollback.
 *   All deletes run in one transaction: any failure rolls the whole thing back.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();

/** Ordered so children go before parents. */
const PLAN = [
  { model: 'journalLine', label: 'Journal lines' },
  { model: 'journalEntry', label: 'Journal entries' },
  { model: 'payment', label: 'Payments' },
  { model: 'invoiceItem', label: 'Invoice items' },
  { model: 'invoice', label: 'Invoices (AR)' },
  { model: 'quotationItem', label: 'Quotation items' },
  { model: 'quotation', label: 'Quotations' },
  { model: 'expense', label: 'Expenses' },
  { model: 'supplierDocument', label: 'Supplier documents' },
  { model: 'supplierContact', label: 'Supplier contacts' },
  { model: 'vendorRanking', label: 'Vendor rankings' },
  { model: 'supplier', label: 'Suppliers' },
];

const KEEP = [
  { model: 'account', label: 'Chart of accounts' },
  { model: 'bankAccount', label: 'Bank accounts' },
  { model: 'taxRate', label: 'Tax rates' },
  { model: 'costCenter', label: 'Cost centres' },
  { model: 'client', label: 'Clients' },
  { model: 'user', label: 'Users' },
  { model: 'projectTransaction', label: 'Project transactions (production module)' },
];

function line(t) {
  console.log('\n' + '='.repeat(72));
  console.log(t);
  console.log('='.repeat(72));
}

function has(model) {
  return prisma[model] && typeof prisma[model].count === 'function';
}

async function safeCount(model) {
  if (!has(model)) return null;
  try {
    return await prisma[model].count();
  } catch (err) {
    return `error: ${err.message.split('\n')[0]}`;
  }
}

async function report() {
  line('WILL DELETE');
  const counts = {};
  let total = 0;
  for (const step of PLAN) {
    const n = await safeCount(step.model);
    counts[step.model] = n;
    if (n === null) {
      console.log(`  ${step.label.padEnd(34)} model not in schema — skipped`);
    } else if (typeof n === 'string') {
      console.log(`  ${step.label.padEnd(34)} ${n}`);
    } else {
      console.log(`  ${step.label.padEnd(34)} ${n}`);
      total += n;
    }
  }
  console.log(`  ${'—'.repeat(34)}`);
  console.log(`  ${'TOTAL ROWS'.padEnd(34)} ${total}`);

  line('WILL KEEP (untouched)');
  for (const step of KEEP) {
    const n = await safeCount(step.model);
    console.log(`  ${step.label.padEnd(46)} ${n === null ? 'n/a' : n}`);
  }

  return { counts, total };
}

async function snapshot() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(__dirname, `_reset-backup-${stamp}.json`);
  const dump = {};
  for (const step of PLAN) {
    if (!has(step.model)) continue;
    try {
      dump[step.model] = await prisma[step.model].findMany();
    } catch (err) {
      dump[step.model] = { error: err.message.split('\n')[0] };
    }
  }
  fs.writeFileSync(
    file,
    JSON.stringify(dump, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)
  );
  return file;
}

async function resetSequences(tx) {
  if (!has('documentSequence')) return 'model not in schema';
  try {
    const seqs = await tx.documentSequence.findMany();
    const targets = seqs.filter((s) =>
      ['EXP', 'INV', 'QUO', 'PAY'].includes(String(s.prefix || '').toUpperCase())
    );
    for (const s of targets) {
      await tx.documentSequence.update({ where: { id: s.id }, data: { lastNumber: 0 } });
    }
    return `${targets.length} sequence(s) reset to 0`;
  } catch (err) {
    return `could not reset: ${err.message.split('\n')[0]}`;
  }
}

async function main() {
  console.log('ACCOUNTING TEST-DATA RESET');
  console.log(`Mode : ${APPLY ? '*** APPLY — WILL DELETE ***' : 'DRY RUN (nothing will be deleted)'}`);
  console.log(`Run  : ${new Date().toISOString()}`);

  const url = process.env.DATABASE_URL;
  try {
    const u = new URL(url);
    console.log(`DB   : ${u.hostname}:${u.port || '5432'}/${(u.pathname || '').replace(/^\//, '')}`);
    if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname)) {
      console.log('\n  STOP: DATABASE_URL is not localhost. You confirmed localhost is master.');
      console.log('  Refusing to run against a remote host.');
      process.exitCode = 1;
      return;
    }
  } catch {
    console.log('DB   : could not parse DATABASE_URL — aborting.');
    process.exitCode = 1;
    return;
  }

  const { total } = await report();

  if (!APPLY) {
    line('DRY RUN COMPLETE — nothing was deleted');
    console.log('  Re-run with --apply to delete the rows listed above.');
    return;
  }

  line('SNAPSHOT');
  const file = await snapshot();
  console.log(`  Wrote ${total} rows to:`);
  console.log(`  ${file}`);

  line('DELETING (single transaction)');
  const results = [];
  await prisma.$transaction(async (tx) => {
    for (const step of PLAN) {
      if (!has(step.model)) continue;
      const res = await tx[step.model].deleteMany({});
      results.push(`  ${step.label.padEnd(34)} ${res.count} deleted`);
    }
    const seq = await resetSequences(tx);
    results.push(`  ${'Document sequences'.padEnd(34)} ${seq}`);
  });
  console.log(results.join('\n'));

  line('VERIFY');
  for (const step of PLAN) {
    const n = await safeCount(step.model);
    if (n !== null) console.log(`  ${step.label.padEnd(34)} ${n} remaining`);
  }
  for (const step of KEEP) {
    const n = await safeCount(step.model);
    if (n !== null) console.log(`  KEPT ${step.label.padEnd(41)} ${n}`);
  }

  line('DONE');
  console.log('  Trial balance should now be empty and balanced.');
  console.log('  Check: GET /api/v1/accounting/trial-balance');
}

main()
  .catch((err) => {
    console.error('\nRESET FAILED (transaction rolled back):', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
