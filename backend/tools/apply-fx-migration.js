#!/usr/bin/env node
/**
 * apply-fx-migration.js
 *
 * Two steps, each behind its own flag so you can review in between.
 *
 *   STEP 1 — add the columns (skips prisma migrate dev, which wants to reset
 *            the database because of pre-existing db-push drift):
 *     node tools/apply-fx-migration.js --migrate
 *     node_modules\.bin\prisma generate
 *
 *   STEP 2 — convert every non-AED expense to AED, keeping the original:
 *     node tools/apply-fx-migration.js --convert            (dry run)
 *     node tools/apply-fx-migration.js --convert --apply
 *
 * HOW THE RATE IS CHOSEN
 *   USD  → 3.6725, the CBUAE peg. The dirham is pegged to the dollar, so this
 *          is exact for every date and needs no historical rate table.
 *   other → the current rate in fx_rates (FxService.refreshOnline populates it).
 *          Flagged in fxRateSource as a current rate, not a rate as at the
 *          invoice date — say so if it ever matters for a filing.
 *
 * Idempotent: a row that already has originalCurrency set is left alone.
 * Refuses to run against anything but localhost.
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

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const MIGRATE = process.argv.includes('--migrate');
const CONVERT = process.argv.includes('--convert');
const APPLY = process.argv.includes('--apply');
const MIGRATION_NAME = '20260820090000_add_expense_original_currency';
const USD_PEG = 3.6725;

const COLS = [
  ['originalAmount', 'DECIMAL(15,2)'],
  ['originalVatAmount', 'DECIMAL(15,2)'],
  ['originalTotalAmount', 'DECIMAL(15,2)'],
  ['fxRateToBase', 'DECIMAL(14,6)'],
  ['fxRateSource', 'TEXT'],
  ['fxConvertedAt', 'TIMESTAMP(3)'],
];

function line(t) { console.log('\n' + '='.repeat(72)); console.log(t); console.log('='.repeat(72)); }

async function columnsOf(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, table);
  return rows.map((r) => r.column_name);
}

async function guardDb() {
  try {
    const u = new URL(process.env.DATABASE_URL);
    console.log(`DB   : ${u.hostname}:${u.port || '5432'}/${(u.pathname || '').replace(/^\//, '')}`);
    if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname)) {
      console.log('\n  STOP: not localhost. Refusing to run.'); return false;
    }
    return true;
  } catch { console.log('DB   : cannot parse DATABASE_URL.'); return false; }
}

async function migrate() {
  line('STEP 1 — ADD COLUMNS');
  const have = await columnsOf('expenses');
  const stmts = [];
  for (const [c, t] of COLS) {
    if (have.includes(c)) console.log(`  [=] expenses.${c} already present`);
    else stmts.push(`ALTER TABLE "expenses" ADD COLUMN "${c}" ${t}`);
  }
  if (have.includes('originalCurrency')) console.log('  [=] expenses.originalCurrency already present');
  else stmts.push(`ALTER TABLE "expenses" ADD COLUMN "originalCurrency" "Currency"`);

  if (!stmts.length) { console.log('\n  Nothing to add.'); return; }
  for (const s of stmts) console.log('  [ddl] ' + s);

  if (!APPLY) { console.log('\n  DRY RUN — add --apply to execute.'); return; }

  await prisma.$transaction(async (tx) => { for (const s of stmts) await tx.$executeRawUnsafe(s); });
  console.log(`\n  ${stmts.length} statement(s) applied.`);

  const sql = stmts.map((s) => s + ';').join('\n');
  const dir = path.join(__dirname, '..', 'prisma', 'migrations', MIGRATION_NAME);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'migration.sql'), sql + '\n');
  const existing = await prisma.$queryRawUnsafe(
    `SELECT 1 AS x FROM _prisma_migrations WHERE migration_name=$1`, MIGRATION_NAME);
  if (!existing.length) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES ($1,$2,NOW(),$3,NULL,NULL,NOW(),1)`,
      crypto.randomUUID(), crypto.createHash('sha256').update(sql).digest('hex'), MIGRATION_NAME);
  }
  console.log(`  Recorded as ${MIGRATION_NAME}`);
  console.log('\n  NEXT: node_modules\\.bin\\prisma generate');
}

async function convert() {
  line('STEP 2 — CONVERT FOREIGN CURRENCY TO AED');

  const have = await columnsOf('expenses');
  if (!have.includes('originalCurrency')) {
    console.log('  STOP: the columns do not exist yet. Run --migrate --apply first.');
    process.exitCode = 1; return;
  }

  // make sure the peg is on file
  const usd = await prisma.fxRate.findUnique({ where: { currency: 'USD' } }).catch(() => null);
  if (!usd) {
    console.log(`  fx_rates has no USD row. ${APPLY ? 'Seeding' : 'Would seed'} it at the CBUAE peg ${USD_PEG}.`);
    if (APPLY) await prisma.fxRate.create({ data: { currency: 'USD', toBase: USD_PEG } });
  } else if (Number(usd.toBase) !== USD_PEG) {
    console.log(`  NOTE: fx_rates has USD at ${usd.toBase}; this script uses the peg ${USD_PEG} regardless.`);
  }

  const rateRows = await prisma.fxRate.findMany();
  const rates = {}; for (const r of rateRows) rates[r.currency] = Number(r.toBase);
  rates.USD = USD_PEG;

  const rows = await prisma.expense.findMany({
    where: { currency: { not: 'AED' }, originalCurrency: null },
    select: {
      id: true, expenseNumber: true, expenseDate: true, vendorName: true,
      amount: true, vatAmount: true, totalAmount: true, currency: true,
    },
    orderBy: { expenseDate: 'asc' },
  });

  console.log(`  ${rows.length} expense(s) not in AED and not yet converted.\n`);
  if (!rows.length) { console.log('  Nothing to do.'); return; }

  const missing = new Set();
  let sumFrom = 0, sumTo = 0;
  const plan = [];
  for (const r of rows) {
    const rate = rates[r.currency];
    if (!rate) { missing.add(r.currency); continue; }
    const src = r.currency === 'USD' ? 'CBUAE peg' : 'fx_rates (current rate, not the rate at the invoice date)';
    const net = Math.round(Number(r.amount) * rate * 100) / 100;
    const vat = Math.round(Number(r.vatAmount) * rate * 100) / 100;
    const tot = Math.round(Number(r.totalAmount) * rate * 100) / 100;
    plan.push({ r, rate, src, net, vat, tot });
    sumFrom += Number(r.totalAmount); sumTo += tot;
    console.log(`  ${r.expenseDate.toISOString().slice(0, 10)}  ${r.expenseNumber.padEnd(22)} ${String(r.vendorName).padEnd(30).slice(0, 30)} ${r.currency} ${Number(r.totalAmount).toFixed(2).padStart(9)} -> AED ${tot.toFixed(2).padStart(10)}  @${rate}`);
  }

  if (missing.size) {
    console.log(`\n  NO RATE for: ${[...missing].join(', ')} — those rows are skipped.`);
    console.log('  Populate them first: POST /api/v1/fx/refresh  (or PUT /api/v1/fx/rates)');
  }

  console.log(`\n  ${plan.length} row(s) convert. Totals: ${sumFrom.toFixed(2)} foreign -> AED ${sumTo.toFixed(2)}`);

  if (!APPLY) { console.log('\n  DRY RUN — nothing changed. Add --apply.'); return; }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const p of plan) {
      await tx.expense.update({
        where: { id: p.r.id },
        data: {
          originalAmount: p.r.amount,
          originalVatAmount: p.r.vatAmount,
          originalTotalAmount: p.r.totalAmount,
          originalCurrency: p.r.currency,
          fxRateToBase: p.rate,
          fxRateSource: p.src,
          fxConvertedAt: now,
          amount: p.net, vatAmount: p.vat, totalAmount: p.tot, currency: 'AED',
        },
      });
    }
  });
  console.log(`\n  ${plan.length} expense(s) converted to AED, originals preserved.`);

  const left = await prisma.expense.count({ where: { currency: { not: 'AED' } } });
  console.log(`  ${left} expense(s) still not in AED.`);
}

async function main() {
  console.log('EXPENSE CURRENCY CONVERSION');
  console.log(`Mode : ${APPLY ? '*** APPLY ***' : 'DRY RUN'}`);
  if (!(await guardDb())) { process.exitCode = 1; return; }
  if (!MIGRATE && !CONVERT) {
    console.log('\n  Pass --migrate (add columns) or --convert (convert rows).');
    return;
  }
  if (MIGRATE) await migrate();
  if (CONVERT) await convert();
}

main()
  .catch((e) => { console.error('\nFAILED:', e.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
