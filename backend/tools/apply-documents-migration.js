#!/usr/bin/env node
/**
 * apply-documents-migration.js   —  step 1 of the documents work
 *
 *   STEP 1  create the table:
 *     node tools/apply-documents-migration.js --migrate --apply
 *     node_modules\.bin\prisma generate
 *
 *   STEP 2  backfill an attachment for every record that already knows where
 *           its source document is:
 *     node tools/apply-documents-migration.js --backfill
 *     node tools/apply-documents-migration.js --backfill --apply
 *
 * WHAT GETS BACKFILLED
 *   - Expenses imported from Gmail: sourceUrl is the thread, sourceRef the id.
 *     Recorded as provider GMAIL, kind SOURCE — one click back to the email.
 *   - Expenses with a receiptUrl already set: provider UPLOAD.
 *   Nothing else is invented. Invoices issued from the Commercials folder have
 *   no file recorded in the database yet; those come in the next pass.
 *
 * Idempotent on (entityType, entityId, url). Refuses anything but localhost.
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
const BACKFILL = process.argv.includes('--backfill');
const APPLY = process.argv.includes('--apply');
const MIGRATION_NAME = '20260820120000_add_document_attachments';

function line(t) { console.log('\n' + '='.repeat(72)); console.log(t); console.log('='.repeat(72)); }

async function tableExists(name) {
  const r = await prisma.$queryRawUnsafe(
    `SELECT 1 AS x FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, name);
  return r.length > 0;
}
async function typeExists(name) {
  const r = await prisma.$queryRawUnsafe(`SELECT 1 AS x FROM pg_type WHERE typname=$1`, name);
  return r.length > 0;
}

async function guard() {
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
  line('CREATE document_attachments');
  const pre = [], main = [];

  if (await typeExists('AttachmentEntity')) console.log('  [=] type AttachmentEntity exists');
  else pre.push(`CREATE TYPE "AttachmentEntity" AS ENUM ('INVOICE','EXPENSE','PAYMENT','PURCHASE_ORDER','QUOTATION','CREDIT_NOTE')`);

  if (await typeExists('DocumentKind')) console.log('  [=] type DocumentKind exists');
  else pre.push(`CREATE TYPE "DocumentKind" AS ENUM ('SOURCE','GENERATED','SUPPORTING')`);

  if (await tableExists('document_attachments')) {
    console.log('  [=] table document_attachments exists');
  } else {
    main.push(`CREATE TABLE "document_attachments" (
  "id" TEXT NOT NULL,
  "entityType" "AttachmentEntity" NOT NULL,
  "entityId" TEXT NOT NULL,
  "kind" "DocumentKind" NOT NULL DEFAULT 'SOURCE',
  "name" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'UPLOAD',
  "url" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "sourceRef" TEXT,
  "notes" TEXT,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_attachments_pkey" PRIMARY KEY ("id")
)`);
    main.push(`CREATE INDEX "document_attachments_entityType_entityId_idx" ON "document_attachments"("entityType","entityId")`);
    main.push(`CREATE INDEX "document_attachments_sourceRef_idx" ON "document_attachments"("sourceRef")`);
  }

  if (!pre.length && !main.length) { console.log('\n  Nothing to create.'); return; }
  for (const s of [...pre, ...main]) console.log('  [ddl] ' + s.split('\n')[0].slice(0, 90));

  if (!APPLY) { console.log('\n  DRY RUN — add --apply to execute.'); return; }

  for (const s of pre) await prisma.$executeRawUnsafe(s);
  await prisma.$transaction(async (tx) => { for (const s of main) await tx.$executeRawUnsafe(s); });
  console.log(`\n  ${pre.length + main.length} statement(s) applied.`);

  const sql = [...pre, ...main].map((s) => s + ';').join('\n\n');
  const dir = path.join(__dirname, '..', 'prisma', 'migrations', MIGRATION_NAME);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'migration.sql'), sql + '\n');
  const seen = await prisma.$queryRawUnsafe(
    `SELECT 1 AS x FROM _prisma_migrations WHERE migration_name=$1`, MIGRATION_NAME);
  if (!seen.length) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES ($1,$2,NOW(),$3,NULL,NULL,NOW(),1)`,
      crypto.randomUUID(), crypto.createHash('sha256').update(sql).digest('hex'), MIGRATION_NAME);
  }
  console.log(`  Recorded as ${MIGRATION_NAME}`);
  console.log('\n  NEXT: node_modules\\.bin\\prisma generate');
}

async function backfill() {
  line('BACKFILL FROM WHAT THE RECORDS ALREADY KNOW');
  if (!(await tableExists('document_attachments'))) {
    console.log('  STOP: table does not exist. Run --migrate --apply first.');
    process.exitCode = 1; return;
  }

  const expenses = await prisma.expense.findMany({
    where: { OR: [{ sourceUrl: { not: null } }, { receiptUrl: { not: null } }] },
    select: {
      id: true, expenseNumber: true, vendorName: true, invoiceNumber: true,
      sourceUrl: true, sourceRef: true, receiptUrl: true,
    },
    orderBy: { expenseDate: 'asc' },
  });

  const plan = [];
  for (const e of expenses) {
    if (e.sourceUrl) {
      const gmail = /mail\.google\.com/.test(e.sourceUrl);
      plan.push({
        entityType: 'EXPENSE', entityId: e.id, kind: 'SOURCE',
        name: `${e.vendorName || 'Supplier'} ${e.invoiceNumber || ''}`.trim() + (gmail ? ' — email' : ''),
        provider: gmail ? 'GMAIL' : 'LINK',
        url: e.sourceUrl, sourceRef: e.sourceRef,
        notes: gmail ? 'The email this invoice arrived in.' : null,
        label: e.expenseNumber,
      });
    }
    if (e.receiptUrl) {
      plan.push({
        entityType: 'EXPENSE', entityId: e.id, kind: 'SOURCE',
        name: `${e.vendorName || 'Supplier'} receipt`, provider: 'UPLOAD',
        url: e.receiptUrl, sourceRef: e.sourceRef, notes: null, label: e.expenseNumber,
      });
    }
  }

  // drop anything already recorded
  const fresh = [];
  for (const p of plan) {
    const dupe = await prisma.documentAttachment.findFirst({
      where: { entityType: p.entityType, entityId: p.entityId, url: p.url }, select: { id: true },
    });
    if (!dupe) fresh.push(p);
  }

  const byProvider = {};
  for (const p of fresh) byProvider[p.provider] = (byProvider[p.provider] || 0) + 1;

  console.log(`  ${expenses.length} expense(s) carry a source URL or a receipt URL.`);
  console.log(`  ${plan.length} attachment(s) implied, ${fresh.length} not yet recorded.`);
  for (const [k, v] of Object.entries(byProvider)) console.log(`    ${k.padEnd(12)} ${v}`);

  for (const p of fresh.slice(0, 8)) {
    console.log(`    e.g. ${p.label.padEnd(22)} ${p.provider.padEnd(10)} ${p.name.slice(0, 46)}`);
  }
  if (fresh.length > 8) console.log(`    … and ${fresh.length - 8} more`);

  const invoices = await prisma.invoice.count();
  console.log(`\n  ${invoices} issued invoice(s) exist, but none has a file recorded in the`);
  console.log('  database — their PDFs live in Desktop\\Commercials. That is the next pass,');
  console.log('  and it needs the files copied into uploads/ so the app can serve them.');

  if (!APPLY) { console.log('\n  DRY RUN — nothing written. Add --apply.'); return; }
  if (!fresh.length) { console.log('\n  Nothing to write.'); return; }

  await prisma.$transaction(async (tx) => {
    for (const p of fresh) {
      await tx.documentAttachment.create({
        data: {
          entityType: p.entityType, entityId: p.entityId, kind: p.kind,
          name: p.name, provider: p.provider, url: p.url,
          sourceRef: p.sourceRef, notes: p.notes,
          mimeType: p.provider === 'GMAIL' ? null : 'application/pdf',
        },
      });
    }
  });
  console.log(`\n  ${fresh.length} attachment(s) created.`);
  console.log(`  Total now: ${await prisma.documentAttachment.count()}`);
}

async function main() {
  console.log('DOCUMENT ATTACHMENTS');
  console.log(`Mode : ${APPLY ? '*** APPLY ***' : 'DRY RUN'}`);
  if (!(await guard())) { process.exitCode = 1; return; }
  if (!MIGRATE && !BACKFILL) { console.log('\n  Pass --migrate or --backfill.'); return; }
  if (MIGRATE) await migrate();
  if (BACKFILL) await backfill();
}

main()
  .catch((e) => { console.error('\nFAILED:', e.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
