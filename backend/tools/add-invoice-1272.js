#!/usr/bin/env node
/**
 * add-invoice-1272.js
 *
 * Records one received tax invoice: AL Nafoorah AKA General Trading LLC #1272,
 * 20 Aug 2026, Apple MacBook M5 Pro, AED 19,430.00 + 971.50 VAT = 20,401.50.
 *
 *   DRY RUN:  node tools/add-invoice-1272.js
 *   APPLY:    node tools/add-invoice-1272.js --apply
 *
 * Transcribed from a photograph of the paper invoice. Every figure below was
 * read off the document; nothing is inferred. The arithmetic checks:
 * 19,430.00 x 5% = 971.50, and 19,430.00 + 971.50 = 20,401.50.
 *
 * Lands PENDING_APPROVAL like every other import — it is a proposal until you
 * approve it. Unlike most of your recent purchases this is a UAE supplier with
 * a valid TRN, so the VAT is genuine reclaimable input tax, not reverse charge.
 *
 * Idempotent on (supplierId, invoiceNumber). Refuses anything but localhost.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const TENANT_ID = 'cmqkpt41b0000x6dptghz747j';
const CREATED_BY = 'user-admin';

const SUPPLIER = {
  name: 'AL Nafoorah AKA General Trading LLC',
  trn: '100066614700003',
  category: 'Equipment',
  country: 'UAE',
  currency: 'AED',
  address: 'Office F89, 1st Floor, Souq Al Fahidi, Bur Dubai, UAE. PO Box 80733',
  phone: '04-3587363',
  email: 'sales@alnafoorahaka.ae',
  notes: 'Trading and services of new and used laptops, desktops, processors, mobile phones, home appliances.',
};

const INVOICE = {
  invoiceNumber: '1272',
  date: '2026-08-20',
  description: 'Apple MacBook M5 Pro Z1N20001A — 16.2", 18C CPU, 40C GPU, 64GB, 2TB',
  category: 'Equipment',
  activity: 'BOTH',
  currency: 'AED',
  net: 19430.00,
  vat: 971.50,
  total: 20401.50,
  notes:
    'UAE tax invoice with a valid supplier TRN — input VAT of AED 971.50 is reclaimable, ' +
    'unlike the foreign digital services which go through reverse charge. ' +
    'Falls in the Jul-Sep 2026 quarter (return due 28 Oct 2026). ' +
    'Billed to the FTA-registered address (Rotana Building No 6, Khalifa Park, Abu Dhabi), ' +
    'not the Yas Creative Hub address printed on your own invoices. ' +
    'Transcribed from a photograph of the paper original — attach the scan when you have it.',
};

function line(t) { console.log('\n' + '='.repeat(72)); console.log(t); console.log('='.repeat(72)); }
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

async function main() {
  console.log('ADD RECEIVED INVOICE — AL Nafoorah #1272');
  console.log(`Mode : ${APPLY ? '*** APPLY ***' : 'DRY RUN (writes nothing)'}`);

  try {
    const u = new URL(process.env.DATABASE_URL);
    console.log(`DB   : ${u.hostname}:${u.port || '5432'}/${(u.pathname || '').replace(/^\//, '')}`);
    if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname)) {
      console.log('\n  STOP: not localhost.'); process.exitCode = 1; return;
    }
  } catch { console.log('DB   : cannot parse DATABASE_URL.'); process.exitCode = 1; return; }

  // sanity-check the arithmetic before writing anything
  const expectedVat = Math.round(INVOICE.net * 0.05 * 100) / 100;
  const expectedTotal = Math.round((INVOICE.net + INVOICE.vat) * 100) / 100;
  line('CHECK THE DOCUMENT');
  console.log(`  net            AED ${INVOICE.net.toFixed(2)}`);
  console.log(`  VAT 5% printed AED ${INVOICE.vat.toFixed(2)}   computed ${expectedVat.toFixed(2)}   ${expectedVat === INVOICE.vat ? 'agrees' : '<<< DISAGREES'}`);
  console.log(`  total printed  AED ${INVOICE.total.toFixed(2)}   computed ${expectedTotal.toFixed(2)}   ${expectedTotal === INVOICE.total ? 'agrees' : '<<< DISAGREES'}`);
  if (expectedVat !== INVOICE.vat || expectedTotal !== INVOICE.total) {
    console.log('\n  STOP: the document does not add up. Not writing.');
    process.exitCode = 1; return;
  }

  // supplier
  line('SUPPLIER');
  const existing = await prisma.supplier.findMany({ select: { id: true, name: true, trn: true } });
  let hit = existing.find((s) => s.trn === SUPPLIER.trn)
        || existing.find((s) => norm(s.name).includes('nafoorah'));
  let supplierId;
  if (hit) {
    supplierId = hit.id;
    console.log(`  [=] already on file as "${hit.name}"`);
  } else {
    console.log(`  [+] ${SUPPLIER.name}   TRN ${SUPPLIER.trn}`);
    if (APPLY) {
      const row = await prisma.supplier.create({
        data: {
          tenantId: TENANT_ID, name: SUPPLIER.name, trn: SUPPLIER.trn, vatId: SUPPLIER.trn,
          category: SUPPLIER.category, country: SUPPLIER.country, currency: SUPPLIER.currency,
          address: SUPPLIER.address, phone: SUPPLIER.phone, email: SUPPLIER.email,
          status: 'ACTIVE', isActive: true, notes: SUPPLIER.notes,
        },
      });
      supplierId = row.id;
    }
  }

  // expense
  line('EXPENSE');
  if (APPLY && supplierId) {
    const dupe = await prisma.expense.findFirst({
      where: { supplierId, invoiceNumber: INVOICE.invoiceNumber },
      select: { expenseNumber: true },
    });
    if (dupe) {
      console.log(`  [=] already imported as ${dupe.expenseNumber} — nothing to do.`);
      return;
    }
  }

  const seq = (await prisma.expense.count({ where: { expenseNumber: { startsWith: 'EXP-2026-' } } })) + 1;
  const expenseNumber = `EXP-2026-${String(seq).padStart(4, '0')}`;
  console.log(`  [+] ${expenseNumber}  ${INVOICE.date}  ${SUPPLIER.name}`);
  console.log(`      ${INVOICE.description}`);
  console.log(`      AED ${INVOICE.net.toFixed(2)} + ${INVOICE.vat.toFixed(2)} VAT = ${INVOICE.total.toFixed(2)}`);
  console.log('      status PENDING_APPROVAL');

  if (!APPLY) {
    line('DRY RUN — nothing written');
    console.log('  Re-run with --apply.');
    return;
  }

  await prisma.expense.create({
    data: {
      expenseNumber,
      activity: INVOICE.activity,
      category: INVOICE.category,
      description: INVOICE.description,
      amount: INVOICE.net,
      currency: INVOICE.currency,
      vatAmount: INVOICE.vat,
      totalAmount: INVOICE.total,
      expenseDate: new Date(INVOICE.date + 'T00:00:00Z'),
      invoiceDate: new Date(INVOICE.date + 'T00:00:00Z'),
      status: 'PENDING_APPROVAL',
      vendorName: SUPPLIER.name,
      supplierId,
      supplierVatId: SUPPLIER.trn,
      invoiceNumber: INVOICE.invoiceNumber,
      importSource: 'MANUAL',
      importedAt: new Date(),
      notes: INVOICE.notes,
      createdById: CREATED_BY,
    },
  });

  line('DONE');
  console.log(`  ${expenseNumber} created, pending your approval.`);
  console.log('\n  This is reclaimable UAE input VAT of AED 971.50 in the Jul-Sep 2026 quarter.');
}

main()
  .catch((e) => { console.error('\nFAILED:', e.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
