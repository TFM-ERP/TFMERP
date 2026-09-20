#!/usr/bin/env node
/**
 * apply-invoice-import-migration.js
 *
 * Applies the invoice-import schema changes to tfm_erp WITHOUT going through
 * `prisma migrate dev`, because migrate dev has detected pre-existing drift
 * (video_engines, video_routing_policies, video_runs and two intake_profiles
 * columns are in the database but not in the migration history — classic
 * `prisma db push` residue) and its only remedy is to DROP THE DATABASE.
 *
 * This script instead applies exactly the changes we want, then records them
 * in _prisma_migrations so the history stays coherent. It never drops anything.
 *
 *   DRY RUN (default — reports what it would do, changes nothing):
 *     cd C:\Projects\TFM-System\backend
 *     node tools/apply-invoice-import-migration.js
 *
 *   APPLY:
 *     node tools/apply-invoice-import-migration.js --apply
 *
 *   Afterwards, regenerate the Prisma client:
 *     node_modules\.bin\prisma generate
 *
 * It is idempotent: every statement is guarded, so running it twice is safe.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APPLY = process.argv.includes('--apply');
const MIGRATION_NAME = '20260819120000_add_invoice_import_fields';
const prisma = new PrismaClient();

const NEW_ACTIVITIES = ['PRODUCTION_SERVICE', 'BOOK_DESIGN', 'WEB_DESIGN', 'EVENTS'];

const EXPENSE_COLS = [
  ['invoiceNumber', 'TEXT'],
  ['invoiceDate', 'TIMESTAMP(3)'],
  ['dueDate', 'TIMESTAMP(3)'],
  ['sourceUrl', 'TEXT'],
  ['sourceRef', 'TEXT'],
  ['importBatchId', 'TEXT'],
  ['importedAt', 'TIMESTAMP(3)'],
  ['reviewedById', 'TEXT'],
  ['reviewedAt', 'TIMESTAMP(3)'],
  ['rejectionReason', 'TEXT'],
];

const INVOICE_COLS = [
  ['lpoReference', 'TEXT'],
  ['lpoDocumentUrl', 'TEXT'],
  ['sourceQuotationRef', 'TEXT'],
];

function line(t) {
  console.log('\n' + '='.repeat(72));
  console.log(t);
  console.log('='.repeat(72));
}

async function columnsOf(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1`,
    table
  );
  return rows.map((r) => r.column_name);
}

async function enumValues(typeName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT e.enumlabel AS v
       FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = $1
      ORDER BY e.enumsortorder`,
    typeName
  );
  return rows.map((r) => r.v);
}

async function typeExists(typeName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 AS x FROM pg_type WHERE typname = $1`,
    typeName
  );
  return rows.length > 0;
}

async function indexExists(name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 AS x FROM pg_indexes WHERE schemaname='public' AND indexname = $1`,
    name
  );
  return rows.length > 0;
}

async function build() {
  const pre = [];   // must run outside a transaction (enum changes)
  const main = [];  // safe inside a transaction
  const notes = [];

  // ---- enum ImportSource
  if (await typeExists('ImportSource')) {
    notes.push('type ImportSource already exists — skipped');
  } else {
    pre.push(`CREATE TYPE "ImportSource" AS ENUM ('MANUAL','SCHEDULED_GMAIL','DOCUMENT_OCR','BULK_IMPORT')`);
  }

  // ---- enum Activity additions
  if (!(await typeExists('Activity'))) {
    notes.push('!! type Activity NOT FOUND — cannot extend it');
  } else {
    const have = await enumValues('Activity');
    for (const v of NEW_ACTIVITIES) {
      if (have.includes(v)) notes.push(`Activity.${v} already present — skipped`);
      else pre.push(`ALTER TYPE "Activity" ADD VALUE IF NOT EXISTS '${v}'`);
    }
  }

  // ---- expenses columns
  const expCols = await columnsOf('expenses');
  if (!expCols.length) {
    notes.push('!! table expenses NOT FOUND');
  } else {
    for (const [col, type] of EXPENSE_COLS) {
      if (expCols.includes(col)) notes.push(`expenses.${col} already present — skipped`);
      else main.push(`ALTER TABLE "expenses" ADD COLUMN "${col}" ${type}`);
    }
    if (expCols.includes('importSource')) {
      notes.push('expenses.importSource already present — skipped');
    } else {
      main.push(`ALTER TABLE "expenses" ADD COLUMN "importSource" "ImportSource" NOT NULL DEFAULT 'MANUAL'`);
    }
  }

  // ---- invoices columns
  const invCols = await columnsOf('invoices');
  if (!invCols.length) {
    notes.push('!! table invoices NOT FOUND');
  } else {
    for (const [col, type] of INVOICE_COLS) {
      if (invCols.includes(col)) notes.push(`invoices.${col} already present — skipped`);
      else main.push(`ALTER TABLE "invoices" ADD COLUMN "${col}" ${type}`);
    }
  }

  // ---- indexes  (created after the columns exist)
  const uniqName = 'expenses_supplierId_invoiceNumber_key';
  const idxName = 'expenses_importSource_status_idx';
  if (await indexExists(uniqName)) notes.push(`index ${uniqName} already present — skipped`);
  else main.push(`CREATE UNIQUE INDEX "${uniqName}" ON "expenses"("supplierId","invoiceNumber")`);
  if (await indexExists(idxName)) notes.push(`index ${idxName} already present — skipped`);
  else main.push(`CREATE INDEX "${idxName}" ON "expenses"("importSource","status")`);

  return { pre, main, notes };
}

async function recordMigration(sql) {
  // Write the .sql so the folder matches what Prisma expects, then mark it applied.
  const dir = path.join(__dirname, '..', 'prisma', 'migrations', MIGRATION_NAME);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'migration.sql'), sql + '\n');

  const existing = await prisma.$queryRawUnsafe(
    `SELECT 1 AS x FROM _prisma_migrations WHERE migration_name = $1`,
    MIGRATION_NAME
  );
  if (existing.length) {
    console.log(`  _prisma_migrations already has ${MIGRATION_NAME} — not re-inserting`);
    return dir;
  }

  const checksum = crypto.createHash('sha256').update(sql).digest('hex');
  await prisma.$executeRawUnsafe(
    `INSERT INTO _prisma_migrations
       (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES ($1, $2, NOW(), $3, NULL, NULL, NOW(), 1)`,
    crypto.randomUUID(),
    checksum,
    MIGRATION_NAME
  );
  return dir;
}

async function main() {
  console.log('INVOICE IMPORT — SCHEMA MIGRATION');
  console.log(`Mode : ${APPLY ? '*** APPLY ***' : 'DRY RUN (changes nothing)'}`);
  console.log(`Run  : ${new Date().toISOString()}`);

  try {
    const u = new URL(process.env.DATABASE_URL);
    console.log(`DB   : ${u.hostname}:${u.port || '5432'}/${(u.pathname || '').replace(/^\//, '')}`);
    if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname)) {
      console.log('\n  STOP: DATABASE_URL is not localhost. Refusing to run.');
      process.exitCode = 1;
      return;
    }
  } catch {
    console.log('DB   : could not parse DATABASE_URL — aborting.');
    process.exitCode = 1;
    return;
  }

  const { pre, main: stmts, notes } = await build();

  line('STATEMENTS TO RUN');
  if (!pre.length && !stmts.length) {
    console.log('  (none — everything is already in place)');
  } else {
    for (const s of pre) console.log('  [enum] ' + s);
    for (const s of stmts) console.log('  [ddl ] ' + s);
  }

  if (notes.length) {
    line('ALREADY IN PLACE / NOTES');
    for (const n of notes) console.log('  ' + n);
  }

  if (!APPLY) {
    line('DRY RUN COMPLETE — nothing was changed');
    console.log('  Re-run with --apply to execute the statements above.');
    return;
  }

  if (!pre.length && !stmts.length) {
    line('NOTHING TO APPLY');
    return;
  }

  // Enum changes first, each on its own — ALTER TYPE ... ADD VALUE cannot be
  // used in the same transaction that later references the new value.
  line('APPLYING');
  for (const s of pre) {
    await prisma.$executeRawUnsafe(s);
    console.log('  ok  ' + s);
  }
  await prisma.$transaction(async (tx) => {
    for (const s of stmts) {
      await tx.$executeRawUnsafe(s);
      console.log('  ok  ' + s);
    }
  });

  const allSql = [...pre, ...stmts].map((s) => s + ';').join('\n');
  const dir = await recordMigration(allSql);
  console.log(`\n  Migration recorded as ${MIGRATION_NAME}`);
  console.log(`  SQL written to ${dir}\\migration.sql`);

  line('VERIFY');
  const expCols = await columnsOf('expenses');
  const want = [...EXPENSE_COLS.map((c) => c[0]), 'importSource'];
  for (const c of want) {
    console.log(`  expenses.${c.padEnd(18)} ${expCols.includes(c) ? 'present' : 'MISSING'}`);
  }
  const invCols = await columnsOf('invoices');
  for (const [c] of INVOICE_COLS) {
    console.log(`  invoices.${c.padEnd(18)} ${invCols.includes(c) ? 'present' : 'MISSING'}`);
  }
  console.log(`  Activity values: ${(await enumValues('Activity')).join(', ')}`);

  line('DONE — now regenerate the client');
  console.log('  node_modules\\.bin\\prisma generate');
}

main()
  .catch((err) => {
    console.error('\nFAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
