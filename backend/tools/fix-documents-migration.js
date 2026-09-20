#!/usr/bin/env node
/**
 * fix-documents-migration.js
 *
 * Repairs a name collision I introduced: schema.prisma already had an
 * `enum AttachmentKind { IMAGE VIDEO AUDIO FILE }` belonging to the chat
 * `Attachment` model, and patch-schema-documents.js appended a second enum of
 * the same name. Prisma refuses to generate, and Postgres refused the CREATE
 * TABLE because the existing type has no 'SOURCE' value.
 *
 * This renames MY enum to DocumentKind and leaves the chat one untouched, then
 * creates the type and the table.
 *
 *   DRY RUN:  node "C:\Projects\TFM-System\backend\tools\fix-documents-migration.js"
 *   APPLY:    node "C:\Projects\TFM-System\backend\tools\fix-documents-migration.js" --apply
 *
 * Then:
 *   & "C:\Projects\TFM-System\backend\node_modules\.bin\prisma.cmd" generate --schema "C:\Projects\TFM-System\backend\prisma\schema.prisma"
 *   node "C:\Projects\TFM-System\backend\tools\apply-documents-migration.js" --backfill --apply
 *
 * Safe to re-run. Backs schema.prisma up before writing.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const SCHEMA = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const MIGRATION_NAME = '20260820120000_add_document_attachments';

const MY_ENUM = `enum DocumentKind {
  SOURCE      // the document as it arrived — a supplier PDF, a scan, an email
  GENERATED   // something this system produced, e.g. a rendered invoice PDF
  SUPPORTING  // an LPO, a delivery note, a proof of payment
}`;

function line(t) { console.log('\n' + '='.repeat(72)); console.log(t); console.log('='.repeat(72)); }

/** All top-level blocks of `kind name` in source order. */
function findBlocks(src, kind, name) {
  const out = [];
  const re = new RegExp(`(^|\\n)\\s*${kind}\\s+${name}\\s*\\{`, 'g');
  let m;
  while ((m = re.exec(src)) !== null) {
    const open = src.indexOf('{', m.index);
    let d = 0;
    for (let i = open; i < src.length; i++) {
      if (src[i] === '{') d++;
      else if (src[i] === '}') { d--; if (d === 0) { out.push({ start: m.index, end: i + 1 }); break; } }
    }
  }
  return out;
}

async function typeExists(n) {
  const r = await prisma.$queryRawUnsafe(`SELECT 1 AS x FROM pg_type WHERE typname=$1`, n);
  return r.length > 0;
}
async function tableExists(n) {
  const r = await prisma.$queryRawUnsafe(
    `SELECT 1 AS x FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, n);
  return r.length > 0;
}
async function enumValues(n) {
  const r = await prisma.$queryRawUnsafe(
    `SELECT e.enumlabel AS v FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
      WHERE t.typname=$1 ORDER BY e.enumsortorder`, n);
  return r.map((x) => x.v);
}

async function fixSchema() {
  line('1. SCHEMA — remove the duplicate enum, rename mine to DocumentKind');
  let src = fs.readFileSync(SCHEMA, 'utf8');
  const original = src;

  if (/enum\s+DocumentKind\s*\{/.test(src)) {
    console.log('  [=] enum DocumentKind already present.');
  } else {
    const dupes = findBlocks(src, 'enum', 'AttachmentKind');
    console.log(`  found ${dupes.length} enum AttachmentKind definition(s)`);
    if (dupes.length < 2) {
      console.log('  [!] expected two. Not touching the schema — send me the file.');
      return false;
    }
    // the one that contains SOURCE is mine
    const mine = dupes.find((b) => src.slice(b.start, b.end).includes('SOURCE'));
    if (!mine) { console.log('  [!] neither contains SOURCE. Stopping.'); return false; }
    const keep = dupes.find((b) => b !== mine);
    console.log(`  keeping the chat enum (${src.slice(keep.start, keep.end).match(/IMAGE|VIDEO|AUDIO|FILE/g) || []})`);
    console.log('  replacing mine with enum DocumentKind');
    src = src.slice(0, mine.start) + '\n' + MY_ENUM + src.slice(mine.end);
  }

  // point the model at the renamed enum
  const models = findBlocks(src, 'model', 'DocumentAttachment');
  if (!models.length) { console.log('  [!] model DocumentAttachment not found. Stopping.'); return false; }
  const m = models[0];
  let body = src.slice(m.start, m.end);
  if (/kind\s+AttachmentKind/.test(body)) {
    body = body.replace(/kind(\s+)AttachmentKind/, 'kind$1DocumentKind');
    src = src.slice(0, m.start) + body + src.slice(m.end);
    console.log('  DocumentAttachment.kind -> DocumentKind');
  } else if (/kind\s+DocumentKind/.test(body)) {
    console.log('  [=] DocumentAttachment.kind already DocumentKind');
  }

  if (src === original) { console.log('\n  Schema already correct.'); return true; }
  console.log(`\n  ${src.length - original.length >= 0 ? '+' : ''}${src.length - original.length} bytes`);
  if (!APPLY) { console.log('  DRY RUN — schema.prisma not modified.'); return true; }

  const backup = SCHEMA + `.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.writeFileSync(backup, original);
  fs.writeFileSync(SCHEMA, src);
  console.log(`  Backup : ${backup}`);
  console.log(`  Written: ${SCHEMA}`);
  return true;
}

async function fixDb() {
  line('2. DATABASE — create DocumentKind and the table');

  if (await typeExists('AttachmentKind')) {
    console.log(`  [=] existing AttachmentKind (${(await enumValues('AttachmentKind')).join(', ')}) — left alone`);
  }
  if (await typeExists('AttachmentEntity')) {
    console.log(`  [=] AttachmentEntity already created (${(await enumValues('AttachmentEntity')).length} values)`);
  }

  const pre = [], main = [];
  if (await typeExists('DocumentKind')) console.log('  [=] type DocumentKind exists');
  else pre.push(`CREATE TYPE "DocumentKind" AS ENUM ('SOURCE','GENERATED','SUPPORTING')`);

  if (!(await typeExists('AttachmentEntity'))) {
    pre.push(`CREATE TYPE "AttachmentEntity" AS ENUM ('INVOICE','EXPENSE','PAYMENT','PURCHASE_ORDER','QUOTATION','CREDIT_NOTE')`);
  }

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

  if (!pre.length && !main.length) { console.log('\n  Nothing to do.'); return; }
  for (const s of [...pre, ...main]) console.log('  [ddl] ' + s.split('\n')[0].slice(0, 88));

  if (!APPLY) { console.log('\n  DRY RUN — nothing executed.'); return; }

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
    console.log(`  Recorded as ${MIGRATION_NAME}`);
  }

  line('VERIFY');
  console.log(`  DocumentKind        : ${(await enumValues('DocumentKind')).join(', ')}`);
  console.log(`  AttachmentKind      : ${(await enumValues('AttachmentKind')).join(', ')}  (untouched)`);
  console.log(`  document_attachments: ${(await tableExists('document_attachments')) ? 'created' : 'MISSING'}`);
}

async function main() {
  console.log('REPAIR — DocumentAttachment enum collision');
  console.log(`Mode : ${APPLY ? '*** APPLY ***' : 'DRY RUN'}`);
  try {
    const u = new URL(process.env.DATABASE_URL);
    console.log(`DB   : ${u.hostname}:${u.port || '5432'}/${(u.pathname || '').replace(/^\//, '')}`);
    if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname)) {
      console.log('\n  STOP: not localhost.'); process.exitCode = 1; return;
    }
  } catch { console.log('DB   : cannot parse DATABASE_URL.'); process.exitCode = 1; return; }

  const ok = await fixSchema();
  if (!ok) { process.exitCode = 1; return; }
  await fixDb();

  line('NEXT');
  console.log('  & "C:\\Projects\\TFM-System\\backend\\node_modules\\.bin\\prisma.cmd" generate --schema "C:\\Projects\\TFM-System\\backend\\prisma\\schema.prisma"');
  console.log('  node "C:\\Projects\\TFM-System\\backend\\tools\\apply-documents-migration.js" --backfill --apply');
}

main()
  .catch((e) => { console.error('\nFAILED:', e.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
