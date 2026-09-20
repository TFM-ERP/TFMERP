#!/usr/bin/env node
/**
 * import-invoices.js
 *
 * Imports into tfm_erp:
 *   - suppliers   (vendors that billed The Film Makers FZ LLC)
 *   - clients     (matched against existing rows, created only when absent)
 *   - expenses    (37 invoices RECEIVED, 1 Apr - 19 Aug 2026, from Gmail)
 *   - invoices    (5 invoices ISSUED, Apr - Jun 2026, from Desktop\Commercials)
 *
 *   DRY RUN (default — reports every row it would create, writes nothing):
 *     cd C:\Projects\TFM-System\backend
 *     node tools/import-invoices.js
 *
 *   APPLY:
 *     node tools/import-invoices.js --apply
 *
 * SAFETY
 *   - Every expense lands as PENDING_APPROVAL with importSource = BULK_IMPORT,
 *     so nothing reaches the general ledger or the VAT return until reviewed.
 *   - Every issued invoice lands as DRAFT unless there is LPO evidence on file.
 *   - Idempotent: expenses are keyed on (supplierId, invoiceNumber) and invoices
 *     on invoiceNumber, so a second run updates nothing and creates nothing.
 *   - Refuses to run against anything but localhost.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const TENANT_ID = 'cmqkpt41b0000x6dptghz747j';
const CREATED_BY = 'user-admin';           // machine imports are attributed to the service account
const BATCH = 'gmail-backfill-2026-08-19';

// ---------------------------------------------------------------- SUPPLIERS
const SUPPLIERS = [
  { name: 'Google Cloud EMEA Limited', category: 'Software & Subscriptions', country: 'Ireland', currency: 'USD' },
  { name: 'Adobe Systems Software Ireland Limited', category: 'Software & Subscriptions', country: 'Ireland', currency: 'USD' },
  { name: 'Zoom Communications, Inc.', category: 'Software & Subscriptions', country: 'USA', currency: 'AED' },
  { name: 'Figma, Inc.', category: 'Software & Subscriptions', country: 'USA', currency: 'USD' },
  { name: 'Vercel Inc.', category: 'Software & Subscriptions', country: 'USA', currency: 'USD' },
  { name: 'Supabase Pte. Ltd.', category: 'Software & Subscriptions', country: 'Singapore', currency: 'USD' },
  { name: 'Eleven Labs Inc.', category: 'Software & Subscriptions', country: 'USA', currency: 'USD' },
  { name: 'Railway Corporation', category: 'Software & Subscriptions', country: 'USA', currency: 'USD' },
  { name: 'fal - Features & Labels, Inc.', category: 'Software & Subscriptions', country: 'USA', currency: 'USD' },
  { name: 'twofour54 FZ-LLC', category: 'Licence & Facilities', country: 'UAE', currency: 'AED', trn: '100300336300003' },
  { name: 'Macquip', category: 'Equipment', country: 'UAE', currency: 'AED' },
  { name: 'Music Licensing', category: 'Production Costs', country: null, currency: 'USD' },
];

// ---------------------------------------------------------------- CLIENTS
const CLIENTS = [
  { name: 'Al Falah Academy', trn: '100208375400003', address: 'Mohamed Bin Zayed City Campus, Abu Dhabi, UAE', email: 'amal.board@afacademy.ae' },
  { name: 'Khalifa Award for Education', trn: '100306210400003', address: 'Abu Dhabi, UAE', email: 'khadija@khaward.ae' },
  { name: 'Dubai Media Incorporated', trn: '100044983300003', address: 'Dubai, UAE', email: null },
  { name: 'Cinegate FZC', trn: '104027676600003', address: 'UAE', email: null },
  { name: 'PULSTRY L.L.C-FZ', trn: '104948153200003', address: 'UAE', email: null },
  { name: 'MACQUIP Commercial Equipment and Professional Machines Renting L.L.C', trn: '104961238300003', address: 'UAE', email: null },
  { name: 'Prestige Motorcycle Rentals LLC', trn: '100327728000003', address: 'UAE', email: null },
  { name: 'twofour54 FZ-LLC', trn: '100300336300003', address: 'Yas Island, Abu Dhabi, UAE', email: null },
];

// ---------------------------------------------------------------- EXPENSES
// supplier, invoiceNumber, date (YYYY-MM-DD), description, category, currency,
// net, vat, activity, threadId, note
const EXPENSES = [
  ['Google Cloud EMEA Limited', '5533070231', '2026-04-01', 'Google Workspace Business Starter - monthly, thefilmmakers.com', 'Software & Subscriptions', 'USD', 0, 0, 'BOTH', '19d4a39c872fcbb6', 'AMOUNT PENDING - figure is inside the attached PDF'],
  ['twofour54 FZ-LLC', '5168114320', '2026-04-13', 'Co-Create licence renewal 2026 - PROFORMA', 'Licence & Facilities', 'AED', 21000, 0, 'BOTH', '19d23d0d17c16627', 'PROFORMA not a tax invoice - input VAT not reclaimable until the final tax invoice is issued'],
  ['Google Cloud EMEA Limited', 'GW-PAY-2026-04-14', '2026-04-14', 'Google Workspace - payment received confirmation', 'Software & Subscriptions', 'USD', 55.04, 0, 'BOTH', '19d8bbdf90b45d83', ''],
  ['Music Licensing', 'DL-cjjo-c2wq375duy-1', '2026-04-18', "Music licence - Nyck Caution, 'Bad Guy' (Vault X)", 'Production Costs', 'USD', 0, 0, 'PRODUCTION', '19d9f900489e4a55', 'AMOUNT PENDING - figure is inside the attached PDF'],
  ['Music Licensing', 'DL-cj7m-c2xp0b4muk', '2026-04-18', "Music licence - Von Meyer, 'She Sways' (Vault X)", 'Production Costs', 'USD', 0, 0, 'PRODUCTION', '19d9f900489e4a55', 'AMOUNT PENDING - figure is inside the attached PDF'],
  ['Adobe Systems Software Ireland Limited', '3439077786', '2026-04-26', 'Creative Cloud subscription - VAT exempt', 'Software & Subscriptions', 'USD', 0, 0, 'BOTH', '19dca3e108cfc2b8', 'AMOUNT PENDING - inside PDF. Zero-rated because TFM VAT ID is on file - reverse charge applies'],

  ['Google Cloud EMEA Limited', '5554018167', '2026-05-01', 'Google Workspace Business Starter - monthly', 'Software & Subscriptions', 'USD', 0, 0, 'BOTH', '19de3789fc58d0c8', 'AMOUNT PENDING - figure is inside the attached PDF'],
  ['Zoom Communications, Inc.', 'INV351481331', '2026-05-04', 'Zoom subscription - account 5150447368', 'Software & Subscriptions', 'AED', 57.74, 0, 'BOTH', '19df0b98fae5ac5a', 'Paid by card 3 May 2026. Confirm whether UAE VAT was charged'],
  ['Macquip', 'MQ082', '2026-05-18', 'Document MQ082 - type unconfirmed', 'Equipment', 'AED', 0, 0, 'RENTAL', '19e3a4505d19207c', 'NEEDS REVIEW - arrived with no message body. Open the PDF and confirm this is an invoice'],
  ['Adobe Systems Software Ireland Limited', '3469557761', '2026-05-26', 'Creative Cloud subscription - VAT exempt', 'Software & Subscriptions', 'USD', 0, 0, 'BOTH', '19e64d786d1dd743', 'AMOUNT PENDING - inside PDF. Reverse charge applies'],
  ['Zoom Communications, Inc.', 'INV355707629', '2026-05-27', 'Zoom subscription - account 5150447368', 'Software & Subscriptions', 'AED', 57.74, 0, 'BOTH', '19e69cc27322f8df', 'Unpaid at period end. Re-notified 2 Jun - same invoice, counted once'],

  ['Google Cloud EMEA Limited', '5581472198', '2026-06-02', 'Google Workspace - monthly', 'Software & Subscriptions', 'USD', 0, 0, 'BOTH', '19e88e21d57d06e0', 'AMOUNT PENDING - figure is inside the attached PDF'],
  ['Google Cloud EMEA Limited', 'GW-PAY-2026-06-02', '2026-06-02', 'Google Workspace - payment received confirmation', 'Software & Subscriptions', 'USD', 73.32, 0, 'BOTH', '19e8752c22842df1', ''],
  ['Eleven Labs Inc.', 'FHDIJ4OX-0001', '2026-06-10', 'Creator subscription 10 Jun - 10 Jul 2026 (first month 50% off)', 'Software & Subscriptions', 'USD', 11.00, 0.55, 'BOTH', '19eb0d571631a72c', 'Reverse charge - foreign service'],
  ['Eleven Labs Inc.', 'FHDIJ4OX-0002', '2026-06-10', 'Pay-as-you-go credits top-up (20 credits)', 'Software & Subscriptions', 'USD', 20.00, 1.00, 'BOTH', '19eb3e4328a93895', 'Reverse charge - foreign service'],
  ['Adobe Systems Software Ireland Limited', '3500393885', '2026-06-26', 'Subscription transaction - VAT exempt', 'Software & Subscriptions', 'USD', 0, 0, 'BOTH', '19f04d7dc91efabe', 'AMOUNT PENDING - inside PDF. Reverse charge applies'],
  ['Railway Corporation', 'ORKET7SC-0001', '2026-06-27', 'Hobby plan 27 Jun - 27 Jul 2026', 'Software & Subscriptions', 'USD', 5.00, 0, 'BOTH', '19f0ae36644d7005', 'Reverse charge - foreign service'],
  ['fal - Features & Labels, Inc.', 'KZDXYZ-00001', '2026-06-28', 'fal usage - due 11 Jul 2026', 'Software & Subscriptions', 'USD', 20.00, 0, 'BOTH', '19f0eefb85f6b1b9', 'Reverse charge - foreign service'],

  ['Vercel Inc.', 'YAHTNS8W-0002', '2026-07-01', 'Domain purchases - filmos.me and filmos.cloud', 'Software & Subscriptions', 'USD', 50.99, 0, 'BOTH', '19f1def071e314f2', 'Reverse charge - foreign service'],
  ['fal - Features & Labels, Inc.', 'KZDXYZ-00002', '2026-07-02', 'fal usage - due 7 Jul 2026', 'Software & Subscriptions', 'USD', 0, 0, 'BOTH', '19f2518b016745f6', 'Zero value, cleared by credit note KZDXYZ-00002-CN-1'],
  ['fal - Features & Labels, Inc.', 'KZDXYZ-00002-CN-1', '2026-07-02', 'Credit note against invoice KZDXYZ-00002', 'Software & Subscriptions', 'USD', 0, 0, 'BOTH', '19f25191bc1c262a', 'CREDIT NOTE - reduces input VAT if the original was claimed'],
  ['Google Cloud EMEA Limited', '5610445395', '2026-07-02', 'Google Workspace - monthly', 'Software & Subscriptions', 'USD', 0, 0, 'BOTH', '19f2270e519e079f', 'AMOUNT PENDING - figure is inside the attached PDF'],
  ['Vercel Inc.', 'YAHTNS8W-0003', '2026-07-03', 'Pro plan 3 Jul - 2 Aug 2026', 'Software & Subscriptions', 'USD', 20.00, 0, 'BOTH', '19f2878c939f33e6', 'Reverse charge - foreign service'],
  ['Supabase Pte. Ltd.', 'MGALCR-00002', '2026-07-09', 'Supabase subscription - due 9 Jul 2026', 'Software & Subscriptions', 'USD', 25.00, 0, 'BOTH', '19f48674f77504ca', 'Reverse charge - foreign service'],
  ['Figma, Inc.', 'in_1TsivxIvcqWR3dFDL57IicOG', '2026-07-13', 'Professional team subscription 13 Jul - 13 Aug 2026', 'Software & Subscriptions', 'USD', 20.00, 0, 'BOTH', '19f5ba8a7f837c57', 'First charge failed; receipt reissued 3 Aug. Same invoice, counted once'],
  ['Vercel Inc.', 'KBSLB5U2-0001', '2026-07-16', 'Domain purchase - jason.family', 'Software & Subscriptions', 'USD', 9.99, 0, 'BOTH', '19f6b1298b71aa65', 'Reverse charge - foreign service'],
  ['Eleven Labs Inc.', 'FHDIJ4OX-0006', '2026-07-16', 'Pay-as-you-go credits top-up (20 credits)', 'Software & Subscriptions', 'USD', 20.00, 1.00, 'BOTH', '19f6cd32eb9240e5', 'Reverse charge - foreign service'],
  ['Eleven Labs Inc.', 'FHDIJ4OX-0004', '2026-07-17', 'Creator subscription 10 Jul - 10 Aug 2026 plus credits', 'Software & Subscriptions', 'USD', 22.00, 1.10, 'BOTH', '19f6ef4b21195a5b', 'Reverse charge - foreign service'],
  ['Adobe Systems Software Ireland Limited', '3530926152', '2026-07-26', 'Subscription transaction - VAT exempt', 'Software & Subscriptions', 'USD', 0, 0, 'BOTH', '19f9f0a306c1c0ad', 'AMOUNT PENDING - inside PDF. Reverse charge applies'],

  ['Google Cloud EMEA Limited', '5638184400', '2026-08-02', 'Google Workspace - monthly', 'Software & Subscriptions', 'USD', 0, 0, 'BOTH', '19fc3101e9aa6cfc', 'AMOUNT PENDING - figure is inside the attached PDF'],
  ['Vercel Inc.', 'YAHTNS8W-0005', '2026-08-03', 'Pro plan + team seat + Observability Plus, 3 Aug - 2 Sep 2026', 'Software & Subscriptions', 'USD', 40.00, 0, 'BOTH', '19fc958cde12923a', 'Reverse charge - foreign service'],
  ['Supabase Pte. Ltd.', 'MGALCR-00004', '2026-08-09', 'Supabase subscription - paid 9 Aug 2026', 'Software & Subscriptions', 'USD', 44.69, 0, 'BOTH', '19fe5979c5a8d717', 'Reverse charge - foreign service'],
  ['Eleven Labs Inc.', 'FHDIJ4OX-0008', '2026-08-10', 'Creator subscription 10 Aug - 10 Sep 2026 plus credits', 'Software & Subscriptions', 'USD', 22.00, 1.10, 'BOTH', '19feafaad09c50b4', 'Reverse charge - foreign service'],
  ['Figma, Inc.', 'in_1U3xhrIvcqWR3dFDlO0Ehx87', '2026-08-13', 'Professional team subscription 13 Aug - 13 Sep 2026', 'Software & Subscriptions', 'USD', 20.00, 0, 'BOTH', '19ffb4d9e9e32fe4', 'Reverse charge - foreign service'],
];

// ---------------------------------------------------------------- ISSUED INVOICES
// number, printedNumber, date, clientName, description, activity, net, vat,
// lpoReference, status, note
const ISSUED = [
  {
    number: '26035', printed: '26035', date: '2026-06-04', client: 'Al Falah Academy',
    description: 'Website development - stage billing', activity: 'WEB_DESIGN',
    net: 21000, vat: 1050, lpo: null, status: 'DRAFT',
    quotationRef: 'TFMQ205186',
    note: 'Line items total 70,000 but the totals block bills 21,000 - confirm the supply value. No LPO on file.',
  },
  {
    number: '26036', printed: '26035', date: '2026-06-04', client: 'Al Falah Academy',
    description: 'OTP implementation - current .NET registration system', activity: 'WEB_DESIGN',
    net: 7000, vat: 350, lpo: null, status: 'DRAFT',
    quotationRef: 'TFMQ206017',
    note: 'DOCUMENT PRINTS 26035, duplicating the invoice above. Filename says 26036 and that is used here. The source document must be renumbered and reissued.',
  },
  {
    number: '206010', printed: '206010', date: '2026-06-10', client: 'Khalifa Award for Education',
    description: 'Printing - 18 books', activity: 'BOOK_DESIGN',
    net: 50000, vat: 2500, lpo: '2025/LPO-69', status: 'SENT',
    quotationRef: '1i25620',
    note: 'LPO 2025/LPO-69 on file - award evidence, so this counts as revenue.',
  },
  {
    number: '206011', printed: '206010', date: '2026-06-10', client: 'Khalifa Award for Education',
    description: 'Printing - additional cost', activity: 'BOOK_DESIGN',
    net: 9000, vat: 450, lpo: null, status: 'DRAFT',
    quotationRef: '1i26020',
    note: 'DOCUMENT PRINTS 206010, duplicating the invoice above. Filename says 206011 and that is used here. Must be renumbered and reissued.',
  },
  {
    number: '26011', printed: '26011', date: '2026-05-18',
    client: 'MACQUIP Commercial Equipment and Professional Machines Renting L.L.C',
    description: 'Caravan rental - 1 day', activity: 'RENTAL',
    net: 2250, vat: 112.5, lpo: null, status: 'DRAFT',
    quotationRef: null,
    note: 'Rental period prints as Feb 2025, contradicting the invoice date - template error, confirm the supply date.',
  },
];

// ---------------------------------------------------------------- helpers
const created = { suppliers: [], clients: [], expenses: [], invoices: [] };
const skipped = { suppliers: [], clients: [], expenses: [], invoices: [] };
const failed = [];

function line(t) {
  console.log('\n' + '='.repeat(72));
  console.log(t);
  console.log('='.repeat(72));
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Loose match: one normalised name contains the other, min 6 chars. */
function nameMatches(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const short = x.length <= y.length ? x : y;
  const long = x.length <= y.length ? y : x;
  return short.length >= 6 && long.includes(short);
}

async function main() {
  console.log('INVOICE IMPORT');
  console.log(`Mode  : ${APPLY ? '*** APPLY ***' : 'DRY RUN (writes nothing)'}`);
  console.log(`Run   : ${new Date().toISOString()}`);
  console.log(`Batch : ${BATCH}`);

  try {
    const u = new URL(process.env.DATABASE_URL);
    console.log(`DB    : ${u.hostname}:${u.port || '5432'}/${(u.pathname || '').replace(/^\//, '')}`);
    if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname)) {
      console.log('\n  STOP: DATABASE_URL is not localhost. Refusing to run.');
      process.exitCode = 1;
      return;
    }
  } catch {
    console.log('DB    : could not parse DATABASE_URL — aborting.');
    process.exitCode = 1;
    return;
  }

  // -------------------------------------------------------------- guard: user
  const owner = await prisma.user.findUnique({ where: { id: CREATED_BY } });
  if (!owner) {
    console.log(`\n  STOP: no User with id "${CREATED_BY}". Cannot set createdById.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Owner : ${owner.email} (${CREATED_BY})`);

  // -------------------------------------------------------------- suppliers
  line('SUPPLIERS');
  const existingSuppliers = await prisma.supplier.findMany({ select: { id: true, name: true } });
  const supplierIds = {};
  for (const s of SUPPLIERS) {
    const hit = existingSuppliers.find((e) => nameMatches(e.name, s.name));
    if (hit) {
      supplierIds[s.name] = hit.id;
      skipped.suppliers.push(`${s.name} -> existing "${hit.name}"`);
      console.log(`  [=] ${s.name}  (already exists as "${hit.name}")`);
      continue;
    }
    console.log(`  [+] ${s.name}  ${s.category} / ${s.country || '-'} / ${s.currency}`);
    if (APPLY) {
      try {
        const row = await prisma.supplier.create({
          data: {
            tenantId: TENANT_ID,
            name: s.name,
            category: s.category,
            country: s.country || 'UAE',
            currency: s.currency,
            trn: s.trn || null,
            vatId: s.trn || null,
            status: 'ACTIVE',
            isActive: true,
            notes: `Created by ${BATCH} from invoices received via Gmail.`,
          },
        });
        supplierIds[s.name] = row.id;
        existingSuppliers.push({ id: row.id, name: row.name });
        created.suppliers.push(s.name);
      } catch (err) {
        failed.push(`supplier ${s.name}: ${err.message.split('\n')[0]}`);
        console.log(`      FAILED: ${err.message.split('\n')[0]}`);
      }
    }
  }

  // -------------------------------------------------------------- clients
  line('CLIENTS');
  const existingClients = await prisma.client.findMany({
    select: { id: true, companyName: true, tradeName: true },
  });
  console.log(`  ${existingClients.length} client(s) already on file.`);
  const clientIds = {};
  for (const c of CLIENTS) {
    const hit = existingClients.find(
      (e) => nameMatches(e.companyName, c.name) || nameMatches(e.tradeName, c.name)
    );
    if (hit) {
      clientIds[c.name] = hit.id;
      const label = hit.companyName || hit.tradeName;
      skipped.clients.push(`${c.name} -> existing "${label}"`);
      console.log(`  [=] ${c.name}\n        matched existing "${label}"`);
      continue;
    }
    console.log(`  [+] ${c.name}  TRN ${c.trn}`);
    if (APPLY) {
      try {
        const row = await prisma.client.create({
          data: {
            companyName: c.name,
            trn: c.trn || null,
            vatId: c.trn || null,
            address: c.address || null,
            email: c.email || null,
            country: 'UAE',
            currency: 'AED',
            isActive: true,
            notes: `Created by ${BATCH} from issued invoices.`,
          },
        });
        clientIds[c.name] = row.id;
        existingClients.push({ id: row.id, companyName: row.companyName, tradeName: row.tradeName });
        created.clients.push(c.name);
      } catch (err) {
        failed.push(`client ${c.name}: ${err.message.split('\n')[0]}`);
        console.log(`      FAILED: ${err.message.split('\n')[0]}`);
      }
    }
  }

  // -------------------------------------------------------------- expenses
  line('EXPENSES (invoices received)');
  let seq = 0;
  for (const [supName, invNo, date, desc, cat, cur, net, vat, activity, thread, note] of EXPENSES) {
    const supplierId = supplierIds[supName] || null;

    if (APPLY && supplierId) {
      const dupe = await prisma.expense.findFirst({
        where: { supplierId, invoiceNumber: invNo },
        select: { id: true, expenseNumber: true },
      });
      if (dupe) {
        skipped.expenses.push(`${supName} ${invNo} -> ${dupe.expenseNumber}`);
        console.log(`  [=] ${date}  ${supName} ${invNo}  (already imported as ${dupe.expenseNumber})`);
        continue;
      }
    }

    seq += 1;
    const expenseNumber = `EXP-2026-${String(seq).padStart(4, '0')}`;
    const total = Number(net) + Number(vat);
    const flag = note.startsWith('AMOUNT PENDING') || note.startsWith('NEEDS REVIEW') ? ' <<' : '';
    console.log(
      `  [+] ${date}  ${expenseNumber}  ${supName.padEnd(38).slice(0, 38)} ${String(invNo).padEnd(30).slice(0, 30)} ${cur} ${total.toFixed(2).padStart(10)}${flag}`
    );

    if (!APPLY) continue;
    if (!supplierId) {
      failed.push(`expense ${invNo}: supplier "${supName}" has no id`);
      console.log(`      FAILED: supplier not resolved`);
      continue;
    }
    try {
      await prisma.expense.create({
        data: {
          expenseNumber,
          activity,
          category: cat,
          description: desc,
          amount: net,
          currency: cur,
          vatAmount: vat,
          totalAmount: total,
          expenseDate: new Date(date + 'T00:00:00Z'),
          invoiceDate: new Date(date + 'T00:00:00Z'),
          status: 'PENDING_APPROVAL',
          vendorName: supName,
          supplierId,
          invoiceNumber: invNo,
          sourceUrl: `https://mail.google.com/mail/u/0/#all/${thread}`,
          sourceRef: `gmail:${thread}`,
          importSource: 'BULK_IMPORT',
          importBatchId: BATCH,
          importedAt: new Date(),
          notes: note || null,
          createdById: CREATED_BY,
        },
      });
      created.expenses.push(`${expenseNumber} ${supName} ${invNo}`);
    } catch (err) {
      failed.push(`expense ${invNo}: ${err.message.split('\n')[0]}`);
      console.log(`      FAILED: ${err.message.split('\n')[0]}`);
    }
  }

  // -------------------------------------------------------------- issued invoices
  line('INVOICES (issued to clients)');
  for (const inv of ISSUED) {
    const clientId = clientIds[inv.client] || null;
    const total = inv.net + inv.vat;

    if (APPLY) {
      const dupe = await prisma.invoice.findFirst({
        where: { invoiceNumber: inv.number },
        select: { id: true },
      });
      if (dupe) {
        skipped.invoices.push(inv.number);
        console.log(`  [=] ${inv.date}  ${inv.number}  (already present)`);
        continue;
      }
    }

    const mark = inv.status === 'SENT' ? 'REVENUE' : 'DRAFT  ';
    console.log(
      `  [+] ${inv.date}  ${String(inv.number).padEnd(9)} ${mark}  ${inv.client.padEnd(34).slice(0, 34)} ${inv.activity.padEnd(12)} AED ${total.toFixed(2).padStart(10)}`
    );
    if (inv.printed !== inv.number) {
      console.log(`        !! source document prints "${inv.printed}" - needs renumbering and reissuing`);
    }

    if (!APPLY) continue;
    if (!clientId) {
      failed.push(`invoice ${inv.number}: client "${inv.client}" has no id`);
      console.log(`      FAILED: client not resolved`);
      continue;
    }
    try {
      await prisma.invoice.create({
        data: {
          invoiceNumber: inv.number,
          clientId,
          activity: inv.activity,
          invoiceType: 'TAX_INVOICE',
          status: inv.status,
          issueDate: new Date(inv.date + 'T00:00:00Z'),
          currency: 'AED',
          subtotal: inv.net,
          vatAmount: inv.vat,
          total,
          amountPaid: 0,
          amountDue: total,
          subject: inv.description,
          lpoReference: inv.lpo,
          sourceQuotationRef: inv.quotationRef,
          internalNotes: `${inv.note}\n\nImported by ${BATCH}.`,
          createdById: CREATED_BY,
          items: {
            create: [
              {
                sortOrder: 0,
                kind: 'SERVICE',
                description: inv.description,
                quantity: 1,
                unit: 'job',
                days: 1,
                unitPrice: inv.net,
                lineTotal: inv.net,
                taxAmount: inv.vat,
              },
            ],
          },
        },
      });
      created.invoices.push(inv.number);
    } catch (err) {
      failed.push(`invoice ${inv.number}: ${err.message.split('\n')[0]}`);
      console.log(`      FAILED: ${err.message.split('\n')[0]}`);
    }
  }

  // -------------------------------------------------------------- summary
  line('SUMMARY');
  if (!APPLY) {
    console.log(`  Would create: ${SUPPLIERS.length - skipped.suppliers.length} suppliers, ` +
      `${CLIENTS.length - skipped.clients.length} clients, ${EXPENSES.length} expenses, ${ISSUED.length} invoices.`);
    console.log('\n  DRY RUN — nothing was written. Re-run with --apply.');
    return;
  }
  console.log(`  Suppliers created : ${created.suppliers.length}   (skipped ${skipped.suppliers.length})`);
  console.log(`  Clients created   : ${created.clients.length}   (skipped ${skipped.clients.length})`);
  console.log(`  Expenses created  : ${created.expenses.length}   (skipped ${skipped.expenses.length})`);
  console.log(`  Invoices created  : ${created.invoices.length}   (skipped ${skipped.invoices.length})`);
  if (failed.length) {
    console.log(`\n  FAILURES (${failed.length}):`);
    for (const f of failed) console.log('    ' + f);
  }

  line('WHAT HAPPENS NEXT');
  console.log('  Every expense is PENDING_APPROVAL with importSource = BULK_IMPORT.');
  console.log('  Nothing is in the general ledger and nothing is in the VAT return yet.');
  console.log('  Review and approve them, then post:');
  console.log('    GET  /api/v1/finance/expenses?status=PENDING_APPROVAL');
  console.log('    PATCH /api/v1/finance/expenses/:id/approve');
  console.log('    POST /api/v1/accounting/post-all');
  console.log('    GET  /api/v1/finance/reports/vat-return?startDate=2026-04-01&endDate=2026-06-30');
}

main()
  .catch((err) => {
    console.error('\nIMPORT FAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
