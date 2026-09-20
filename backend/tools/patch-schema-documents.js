#!/usr/bin/env node
/**
 * patch-schema-documents.js   —  step 1 of the documents work
 *
 * Adds a finance-wide DocumentAttachment model so any record — an issued
 * invoice, a received expense, a payment, a purchase order — can carry the
 * source document it came from, plus anything generated from it.
 *
 *   DRY RUN:  node tools/patch-schema-documents.js
 *   APPLY:    node tools/patch-schema-documents.js --apply
 *
 * Touches schema.prisma only. Run apply-documents-migration.js for the database.
 *
 * WHY A NEW MODEL
 *   ProjectDocument already has this shape but its projectId is a required FK to
 *   ProductionProject, so finance records cannot use it. Loosening that FK would
 *   weaken the production module; a sibling table keeps both honest.
 */

const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const SCHEMA = path.join(__dirname, '..', 'prisma', 'schema.prisma');

const MODEL = `
enum AttachmentEntity {
  INVOICE
  EXPENSE
  PAYMENT
  PURCHASE_ORDER
  QUOTATION
  CREDIT_NOTE
}

enum AttachmentKind {
  SOURCE      // the document as it arrived — a supplier PDF, a scan, an email
  GENERATED   // something this system produced, e.g. a rendered invoice PDF
  SUPPORTING  // an LPO, a delivery note, a proof of payment
}

model DocumentAttachment {
  id           String           @id @default(cuid())
  entityType   AttachmentEntity
  entityId     String
  kind         AttachmentKind   @default(SOURCE)

  name         String                     // what to show the user
  provider     String           @default("UPLOAD") // UPLOAD | GMAIL | LOCAL_PATH | LINK
  url          String                     // /uploads/<file>, a Gmail thread URL, or a path
  mimeType     String?
  sizeBytes    Int?

  sourceRef    String?                    // e.g. "gmail:19fc3101e9aa6cfc"
  notes        String?

  uploadedById String?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  @@index([entityType, entityId])
  @@index([sourceRef])
  @@map("document_attachments")
}
`;

let src = fs.readFileSync(SCHEMA, 'utf8');
const before = src.length;

console.log('SCHEMA PATCH — DocumentAttachment');
console.log(`Mode : ${APPLY ? '*** APPLY ***' : 'DRY RUN (writes nothing)'}`);
console.log(`File : ${SCHEMA}\n`);

if (/model\s+DocumentAttachment\s*\{/.test(src)) {
  console.log('  [=] DocumentAttachment already present — nothing to do.');
} else {
  src = src.trimEnd() + '\n' + MODEL;
  console.log('  [+] enum AttachmentEntity  (6 values)');
  console.log('  [+] enum AttachmentKind    (SOURCE, GENERATED, SUPPORTING)');
  console.log('  [+] model DocumentAttachment');
  console.log(`\n  +${src.length - before} bytes`);

  if (APPLY) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = SCHEMA + `.backup-${stamp}`;
    fs.writeFileSync(backup, fs.readFileSync(SCHEMA));
    fs.writeFileSync(SCHEMA, src);
    console.log(`\n  Backup : ${backup}`);
    console.log(`  Written: ${SCHEMA}`);
    console.log('\n  NEXT: node tools/apply-documents-migration.js --migrate --apply');
  } else {
    console.log('\n  DRY RUN — schema.prisma was NOT modified.');
  }
}
