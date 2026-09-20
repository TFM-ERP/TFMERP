#!/usr/bin/env node
/**
 * clean-placeholder-attachments.js
 *
 * Removes junk rows from document_attachments before real documents are attached.
 *
 *   DRY RUN (default — reports only, deletes nothing):
 *     node "C:\Projects\TFM-System\backend\tools\clean-placeholder-attachments.js"
 *
 *   APPLY:
 *     node "C:\Projects\TFM-System\backend\tools\clean-placeholder-attachments.js" --apply
 *
 * WHAT IT REMOVES
 *   A. PLACEHOLDER — entityId is 'UNLINKED', empty, or null. These come from the
 *      v1 attacher, which wrote a row for every unmatched PDF and parked it on a
 *      fake entity id. A financial record table should not contain rows that
 *      point at nothing.
 *   B. ORPHANED — entityId is a real-looking id, but no Invoice / Expense /
 *      Payment / Quotation with that id exists. The record was deleted after the
 *      attachment was made, or the id was wrong from the start.
 *
 * WHAT IT LEAVES ALONE
 *   Every attachment that resolves to a live record. The chat `Attachment` model
 *   is a different table and is never touched. Files already copied into
 *   uploads/ stay on disk — this only clears database rows, so nothing you
 *   scanned is lost.
 *
 * SAFETY
 *   Writes every row it is about to delete to tools/_attachment-cleanup-<stamp>.json
 *   first. Deletes run in one transaction. Localhost only.
 */

const { PrismaClient } = require('@prisma/client');

// --- load backend/.env regardless of the current working directory -----------
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

const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const PLACEHOLDERS = new Set(['UNLINKED', 'NONE', 'NULL', 'PENDING', '']);

/** entityType -> the Prisma model that should own that id. */
const OWNER = {
  INVOICE: 'invoice',
  EXPENSE: 'expense',
  PAYMENT: 'payment',
  PURCHASE_ORDER: 'purchaseOrder',
  QUOTATION: 'quotation',
  CREDIT_NOTE: 'creditNote',
};

function line(t) { console.log('\n' + '='.repeat(76)); console.log(t); console.log('='.repeat(76)); }
function cut(s, n) { return String(s == null ? '' : s).slice(0, n); }

async function main() {
  console.log('ATTACHMENT CLEANUP');
  console.log(`Mode : ${APPLY ? '*** APPLY — WILL DELETE ROWS ***' : 'DRY RUN (deletes nothing)'}`);
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
    console.log('DB   : cannot parse DATABASE_URL — aborting.');
    process.exitCode = 1;
    return;
  }

  let atts;
  try {
    atts = await prisma.documentAttachment.findMany({
      select: {
        id: true, entityType: true, entityId: true, kind: true, name: true,
        provider: true, url: true, sourceRef: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  } catch (e) {
    console.log(`\n  Could not read document_attachments: ${e.message.split('\n')[0]}`);
    console.log('  If the table does not exist yet, there is nothing to clean.');
    process.exitCode = 1;
    return;
  }

  console.log(`Rows : ${atts.length} attachment row(s)`);

  if (!atts.length) {
    line('NOTHING TO CLEAN');
    console.log('  The table is empty. The v1 attacher was never applied, so no junk was written.');
    console.log('  Go straight to the v2 dry run.');
    return;
  }

  // ------------------------------------------------------------ A. placeholder
  const placeholder = atts.filter(
    (a) => a.entityId == null || PLACEHOLDERS.has(String(a.entityId).trim().toUpperCase())
  );

  // -------------------------------------------------------------- B. orphaned
  const rest = atts.filter((a) => !placeholder.includes(a));
  const byType = {};
  for (const a of rest) (byType[a.entityType] ||= []).push(a);

  const orphaned = [];
  const unknownType = [];
  for (const [type, group] of Object.entries(byType)) {
    const model = OWNER[type];
    if (!model || !prisma[model]) { unknownType.push(...group); continue; }
    const ids = [...new Set(group.map((a) => a.entityId))];
    let live = new Set();
    try {
      const found = await prisma[model].findMany({ where: { id: { in: ids } }, select: { id: true } });
      live = new Set(found.map((r) => r.id));
    } catch (e) {
      console.log(`  Could not verify ${type} ids: ${e.message.split('\n')[0]}`);
      continue;
    }
    for (const a of group) if (!live.has(a.entityId)) orphaned.push(a);
  }

  const doomed = [...placeholder, ...orphaned];
  const healthy = atts.length - doomed.length;

  // ---------------------------------------------------------------- report
  line(`A. PLACEHOLDER — ${placeholder.length} row(s) pointing at nothing`);
  if (!placeholder.length) console.log('  none');
  for (const a of placeholder.slice(0, 30)) {
    console.log(`  ${cut(a.entityType, 14).padEnd(15)} entityId="${a.entityId}"  ${cut(a.kind, 10).padEnd(11)} ${cut(a.name, 46)}`);
  }
  if (placeholder.length > 30) console.log(`  … and ${placeholder.length - 30} more`);

  line(`B. ORPHANED — ${orphaned.length} row(s) whose record no longer exists`);
  if (!orphaned.length) console.log('  none');
  for (const a of orphaned.slice(0, 30)) {
    console.log(`  ${cut(a.entityType, 14).padEnd(15)} ${cut(a.entityId, 26).padEnd(28)} ${cut(a.name, 42)}`);
  }
  if (orphaned.length > 30) console.log(`  … and ${orphaned.length - 30} more`);

  if (unknownType.length) {
    line(`NOT CHECKED — ${unknownType.length} row(s) of an entityType with no model mapping`);
    for (const a of unknownType.slice(0, 10)) console.log(`  ${a.entityType}  ${a.entityId}  ${cut(a.name, 40)}`);
    console.log('  These are left alone. Tell me the entityType and I will add it.');
  }

  line('SUMMARY');
  console.log(`  total rows        ${atts.length}`);
  console.log(`  placeholder       ${placeholder.length}`);
  console.log(`  orphaned          ${orphaned.length}`);
  console.log(`  to delete         ${doomed.length}`);
  console.log(`  healthy, kept     ${healthy}`);

  const uploads = path.join(__dirname, '..', 'uploads');
  const filesKept = doomed.filter((a) => {
    if (!a.url || !a.url.startsWith('/uploads/')) return false;
    return fs.existsSync(path.join(uploads, a.url.replace('/uploads/', '')));
  });
  if (filesKept.length) {
    console.log(`\n  ${filesKept.length} of those rows point at a file that is on disk.`);
    console.log('  The FILES are not deleted — only the database rows. Nothing you scanned is lost.');
  }

  if (!doomed.length) {
    line('NOTHING TO DELETE');
    console.log('  Every attachment resolves to a live record. Clear to attach.');
    return;
  }

  if (!APPLY) {
    line('DRY RUN — nothing was deleted');
    console.log('  Re-run with --apply to remove the rows listed above.');
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backup = path.join(__dirname, `_attachment-cleanup-${stamp}.json`);
  fs.writeFileSync(backup, JSON.stringify(doomed, null, 2));
  console.log(`\n  Backup of ${doomed.length} row(s): ${backup}`);

  line('DELETING (single transaction)');
  const ids = doomed.map((a) => a.id);
  let deleted = 0;
  await prisma.$transaction(async (tx) => {
    const res = await tx.documentAttachment.deleteMany({ where: { id: { in: ids } } });
    deleted = res.count;
  });
  console.log(`  ${deleted} row(s) deleted`);

  const after = await prisma.documentAttachment.count();
  line('VERIFY');
  console.log(`  attachments remaining : ${after}`);
  console.log(`  expected              : ${healthy}`);
  console.log(`  ${after === healthy ? 'MATCHES — clean' : 'MISMATCH — stop and send me this output'}`);

  line('DONE — clear to run the v2 attacher');
}

main()
  .catch((e) => { console.error('\nCLEANUP FAILED (transaction rolled back):', e.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
