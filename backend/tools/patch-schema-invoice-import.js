#!/usr/bin/env node
/**
 * patch-schema-invoice-import.js
 *
 * Adds the fields the invoice import needs to backend/prisma/schema.prisma.
 * Purely a text patch on the schema file — it does NOT touch the database.
 *
 *   DRY RUN (default — shows exactly what it would change, writes nothing):
 *     cd C:\Projects\TFM-System\backend
 *     node tools/patch-schema-invoice-import.js
 *
 *   APPLY (backs the schema up first, then writes):
 *     node tools/patch-schema-invoice-import.js --apply
 *
 * After applying, generate and run the migration with the PROJECT's Prisma
 * (never a bare "npx prisma" — that resolves to 7.9.1 and rejects this schema):
 *
 *     node_modules\.bin\prisma migrate dev --name add_invoice_import_fields
 *
 * WHAT IT ADDS
 *   enum ImportSource                     — MANUAL / SCHEDULED_GMAIL / DOCUMENT_OCR / BULK_IMPORT
 *   enum Activity  + 4 values             — PRODUCTION_SERVICE, BOOK_DESIGN, WEB_DESIGN, EVENTS
 *   model Expense  + 11 nullable columns  — invoiceNumber, invoiceDate, dueDate, sourceUrl,
 *                                           sourceRef, importSource, importBatchId, importedAt,
 *                                           reviewedById, reviewedAt, rejectionReason
 *                  + @@unique([supplierId, invoiceNumber])  and an index for the review queue
 *   model Invoice  + 3 nullable columns   — lpoReference, lpoDocumentUrl, sourceQuotationRef
 *
 * Every added column is nullable and every enum change is additive, so nothing
 * existing breaks. The unique constraint cannot collide because invoiceNumber
 * is null on every current row and Postgres treats NULLs as distinct.
 */

const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const SCHEMA = path.join(__dirname, '..', 'prisma', 'schema.prisma');

const EXPENSE_FIELDS = `
  // --- invoice import (added by patch-schema-invoice-import.js) ---
  invoiceNumber   String?     // the supplier's own invoice number
  invoiceDate     DateTime?   // date on the supplier's document
  dueDate         DateTime?
  sourceUrl       String?     // Gmail thread link or local file path
  sourceRef       String?     // e.g. "gmail:19fc3101e9aa6cfc"

  importSource    ImportSource @default(MANUAL)
  importBatchId   String?      // groups one scheduled or bulk run
  importedAt      DateTime?
  reviewedById    String?      // who confirmed or rejected it
  reviewedAt      DateTime?
  rejectionReason String?
  // --- end invoice import ---
`;

const EXPENSE_ATTRS = `
  @@unique([supplierId, invoiceNumber])
  @@index([importSource, status])`;

const INVOICE_FIELDS = `
  // --- invoice import (added by patch-schema-invoice-import.js) ---
  lpoReference       String?  // client's LPO number - the award proof
  lpoDocumentUrl     String?
  sourceQuotationRef String?  // the TFMQ number this invoice came from
  // --- end invoice import ---
`;

const IMPORT_SOURCE_ENUM = `
enum ImportSource {
  MANUAL           // typed into the UI
  SCHEDULED_GMAIL  // filed by the daily invoice task
  DOCUMENT_OCR     // uploaded document, read by OCR
  BULK_IMPORT      // one-off backfill script
}
`;

const NEW_ACTIVITIES = ['PRODUCTION_SERVICE', 'BOOK_DESIGN', 'WEB_DESIGN', 'EVENTS'];

const changes = [];
const problems = [];

function ok(msg) {
  changes.push('  [+] ' + msg);
}
function skip(msg) {
  changes.push('  [=] ' + msg + ' — already present, left alone');
}
function fail(msg) {
  problems.push('  [!] ' + msg);
}

/** Find "model X {" ... matching "}" and return [start, end) of the block body. */
function findBlock(src, kind, name) {
  const re = new RegExp(`(^|\\n)\\s*${kind}\\s+${name}\\s*\\{`, 'm');
  const m = re.exec(src);
  if (!m) return null;
  const open = src.indexOf('{', m.index);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return { start: m.index, bodyStart: open + 1, close: i };
    }
  }
  return null;
}

let src = fs.readFileSync(SCHEMA, 'utf8');
const original = src;

console.log('SCHEMA PATCH — invoice import fields');
console.log(`Mode  : ${APPLY ? '*** APPLY — will rewrite schema.prisma ***' : 'DRY RUN (writes nothing)'}`);
console.log(`File  : ${SCHEMA}`);
console.log(`Size  : ${(src.length / 1024).toFixed(1)} KB\n`);

// ---------------------------------------------------------------- 1. enum ImportSource
if (/enum\s+ImportSource\s*\{/.test(src)) {
  skip('enum ImportSource');
} else {
  src = src.trimEnd() + '\n' + IMPORT_SOURCE_ENUM;
  ok('enum ImportSource appended (4 values)');
}

// ---------------------------------------------------------------- 2. enum Activity
const act = findBlock(src, 'enum', 'Activity');
if (!act) {
  fail('enum Activity not found — cannot add the new business lines');
} else {
  const body = src.slice(act.bodyStart, act.close);
  const missing = NEW_ACTIVITIES.filter((v) => !new RegExp(`\\b${v}\\b`).test(body));
  if (!missing.length) {
    skip('enum Activity values');
  } else {
    const insert = '\n  ' + missing.join('\n  ') + '\n';
    src = src.slice(0, act.close) + insert + src.slice(act.close);
    ok(`enum Activity + ${missing.join(', ')}`);
  }
}

// ---------------------------------------------------------------- 3. model Expense
const exp = findBlock(src, 'model', 'Expense');
if (!exp) {
  fail('model Expense not found');
} else {
  const body = src.slice(exp.bodyStart, exp.close);
  if (/\binvoiceNumber\b/.test(body)) {
    skip('Expense.invoiceNumber and friends');
  } else {
    // insert the fields just before @@map, or at the end of the block if absent
    const mapRe = /\n\s*@@map\(/;
    const mapAt = body.search(mapRe);
    const insertAt = mapAt === -1 ? body.length : mapAt;
    const newBody =
      body.slice(0, insertAt) + '\n' + EXPENSE_FIELDS + EXPENSE_ATTRS + '\n' + body.slice(insertAt);
    src = src.slice(0, exp.bodyStart) + newBody + src.slice(exp.close);
    ok('Expense + 11 columns, @@unique([supplierId, invoiceNumber]), @@index([importSource, status])');
  }
}

// ---------------------------------------------------------------- 4. model Invoice
const inv = findBlock(src, 'model', 'Invoice');
if (!inv) {
  fail('model Invoice not found');
} else {
  const body = src.slice(inv.bodyStart, inv.close);
  if (/\blpoReference\b/.test(body)) {
    skip('Invoice.lpoReference and friends');
  } else {
    const mapAt = body.search(/\n\s*@@map\(/);
    const insertAt = mapAt === -1 ? body.length : mapAt;
    const newBody = body.slice(0, insertAt) + '\n' + INVOICE_FIELDS + body.slice(insertAt);
    src = src.slice(0, inv.bodyStart) + newBody + src.slice(inv.close);
    ok('Invoice + lpoReference, lpoDocumentUrl, sourceQuotationRef');
  }
}

// ---------------------------------------------------------------- report
console.log('CHANGES');
console.log(changes.length ? changes.join('\n') : '  (none — schema already patched)');

if (problems.length) {
  console.log('\nPROBLEMS');
  console.log(problems.join('\n'));
  console.log('\nRefusing to write while anything above is unresolved.');
  process.exitCode = 1;
  return;
}

if (src === original) {
  console.log('\nNothing to do — schema is already patched.');
  return;
}

console.log(`\nSize after patch: ${(src.length / 1024).toFixed(1)} KB (+${src.length - original.length} bytes)`);

if (!APPLY) {
  console.log('\nDRY RUN — schema.prisma was NOT modified.');
  console.log('Re-run with --apply to write the changes.');
  return;
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = SCHEMA + `.backup-${stamp}`;
fs.writeFileSync(backup, original);
fs.writeFileSync(SCHEMA, src);

console.log(`\nBackup written : ${backup}`);
console.log(`Schema updated : ${SCHEMA}`);
console.log('\nNEXT — generate and apply the migration with the PROJECT Prisma:');
console.log('  node_modules\\.bin\\prisma migrate dev --name add_invoice_import_fields');
console.log('\nDo NOT use a bare "npx prisma" — it resolves to 7.9.1 and rejects this schema.');
console.log('If migrate dev reports drift, stop and send me the output before continuing.');
