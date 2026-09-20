#!/usr/bin/env node
/**
 * import-history.js
 *
 * Loads the 2025 – Q1 2026 record into tfm_erp from tools/import-data.json:
 *
 *   - expensesFiled   163 input lines from the five filed VAT workbooks
 *   - invoicesFiled    18 output lines from the same workbooks
 *   - expensesGmail    72 invoices found in Gmail that are NOT in any filed return
 *
 *   DRY RUN (default):  node tools/import-history.js
 *   APPLY:              node tools/import-history.js --apply
 *
 * STATUS RULES — the important part
 *   Rows from a FILED RETURN land APPROVED. They were submitted to the FTA, so
 *   they belong in the ledger and in the VAT return for their quarter.
 *   Rows found only in GMAIL land PENDING_APPROVAL. They were never filed, so
 *   they stay out of the ledger until you decide what to do with them.
 *
 * FIDELITY
 *   Filed rows are imported EXACTLY as filed — including the duplicated lines in
 *   Jul-Sep 2025 and the rows dated outside their period. The notes field records
 *   each problem. This is a record of what was submitted, not a corrected set.
 *
 * Idempotent on (supplierId, invoiceNumber) and on invoiceNumber.
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

const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const TENANT_ID = 'cmqkpt41b0000x6dptghz747j';
const CREATED_BY = 'user-admin';
const prisma = new PrismaClient();

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'import-data.json'), 'utf8'));

const PERIOD_ACTIVITY = 'BOTH';
const created = { suppliers: 0, clients: 0, expenses: 0, invoices: 0 };
const skipped = { suppliers: 0, clients: 0, expenses: 0, invoices: 0 };
const failed = [];

function line(t) { console.log('\n' + '='.repeat(72)); console.log(t); console.log('='.repeat(72)); }
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function matches(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const s = x.length <= y.length ? x : y, l = x.length <= y.length ? y : x;
  return s.length >= 6 && l.includes(s);
}

function categoryFor(vendor) {
  const v = String(vendor).toLowerCase();
  if (/adnoc|enoc|emarat/.test(v)) return 'Fuel';
  if (/tires|auto|garage|spare parts|sdm|sport car|cars hub|bicycle|battery/.test(v)) return 'Maintenance';
  if (/twofour54|licence|license/.test(v)) return 'Licence & Facilities';
  if (/adobe|google|zoom|frame\.io|midjourney|koobrik|callaia|supabase|vercel/.test(v)) return 'Software & Subscriptions';
  if (/catering|hypermarket|choithrams|kango|royal catering/.test(v)) return 'Catering';
  if (/printing|publishing/.test(v)) return 'Printing';
  if (/hardware|trading|electronix|hongxi|q-tech|rsq|firefly|sheng da|ogaret|control|apex/.test(v)) return 'Office';
  if (/quinta|wyndham|hotel/.test(v)) return 'BTL Travel & Living';
  if (/media|film|cinema|epilogue|production/.test(v)) return 'Production Costs';
  return 'Miscellaneous General Exp';
}

async function main() {
  console.log('HISTORICAL IMPORT — 2025 to Q1 2026');
  console.log(`Mode : ${APPLY ? '*** APPLY ***' : 'DRY RUN (writes nothing)'}`);
  console.log(`Run  : ${new Date().toISOString()}`);

  try {
    const u = new URL(process.env.DATABASE_URL);
    console.log(`DB   : ${u.hostname}:${u.port || '5432'}/${(u.pathname || '').replace(/^\//, '')}`);
    if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname)) {
      console.log('\n  STOP: DATABASE_URL is not localhost. Refusing to run.');
      process.exitCode = 1; return;
    }
  } catch { console.log('DB   : cannot parse DATABASE_URL — aborting.'); process.exitCode = 1; return; }

  const owner = await prisma.user.findUnique({ where: { id: CREATED_BY } });
  if (!owner) { console.log(`\n  STOP: no User "${CREATED_BY}".`); process.exitCode = 1; return; }

  console.log(`\nPayload: ${DATA.expensesFiled.length} filed expenses, ${DATA.invoicesFiled.length} filed invoices, ` +
    `${DATA.expensesGmail.length} Gmail-only expenses, ${DATA.vendors.length} vendors, ${DATA.clients.length} clients.`);

  // ------------------------------------------------------------ suppliers
  line('SUPPLIERS');
  const existingSup = await prisma.supplier.findMany({ select: { id: true, name: true } });
  const supId = {};
  for (const name of DATA.vendors) {
    const hit = existingSup.find((e) => matches(e.name, name));
    if (hit) { supId[name] = hit.id; skipped.suppliers++; continue; }
    console.log(`  [+] ${name}`);
    if (!APPLY) continue;
    try {
      const row = await prisma.supplier.create({
        data: {
          tenantId: TENANT_ID, name, category: categoryFor(name), country: 'UAE',
          currency: 'AED', status: 'ACTIVE', isActive: true,
          trn: (DATA.vendorTrn || {})[name] || null,
          vatId: (DATA.vendorTrn || {})[name] || null,
          notes: ['Created by the 2025–Q1 2026 historical import.',
                  (DATA.vendorTrnNote || {})[name] || ''].filter(Boolean).join(' '),
        },
      });
      supId[name] = row.id; existingSup.push({ id: row.id, name }); created.suppliers++;
    } catch (err) { failed.push(`supplier ${name}: ${err.message.split('\n')[0]}`); }
  }
  console.log(`  ${created.suppliers} to create, ${skipped.suppliers} already present.`);

  // ------------------------------------------------------------ clients
  line('CLIENTS');
  const existingCli = await prisma.client.findMany({ select: { id: true, companyName: true, tradeName: true } });
  const cliId = {};
  for (const name of DATA.clients) {
    const hit = existingCli.find((e) => matches(e.companyName, name) || matches(e.tradeName, name));
    if (hit) { cliId[name] = hit.id; skipped.clients++; console.log(`  [=] ${name} -> "${hit.companyName}"`); continue; }
    console.log(`  [+] ${name}`);
    if (!APPLY) continue;
    try {
      const row = await prisma.client.create({
        data: {
          companyName: name, country: 'UAE', currency: 'AED', isActive: true,
          notes: 'Created by the 2025–Q1 2026 historical import.',
        },
      });
      cliId[name] = row.id; existingCli.push({ id: row.id, companyName: name, tradeName: null }); created.clients++;
    } catch (err) { failed.push(`client ${name}: ${err.message.split('\n')[0]}`); }
  }
  console.log(`  ${created.clients} to create, ${skipped.clients} already present.`);

  // ------------------------------------------------------------ expenses
  async function importExpenses(rows, label, status, source, batch) {
    line(`EXPENSES — ${label}  (${rows.length} rows, status ${status})`);
    let n = 0, made = 0, skippedHere = 0;
    for (const r of rows) {
      n++;
      const sid = supId[r.supplier];
      if (!sid) { failed.push(`expense ${r.invoiceNumber}: supplier "${r.supplier}" unresolved`); continue; }
      if (APPLY) {
        // Match on sourceRef where we have one: the workbook's own 'invoice no.'
        // column repeats the same handful of numbers across unrelated vendors,
        // so it cannot be a uniqueness key.
        const dupe = r.ref
          ? await prisma.expense.findFirst({ where: { sourceRef: r.ref }, select: { id: true } })
          : await prisma.expense.findFirst({ where: { supplierId: sid, invoiceNumber: r.invoiceNumber }, select: { id: true } });
        if (dupe) { skipped.expenses++; skippedHere++; continue; }
      }
      const notes = [];
      if (r.dateWasInferred) notes.push(`Date not usable in the workbook (cell read "${r.rawDate}") — set to the period end.`);
      if (r.workbookInvoiceNo) notes.push(`Workbook recorded supplier invoice no. "${r.workbookInvoiceNo}", but that column repeats the same numbers across unrelated vendors, so it is not used as the key.`);
      if (r.trnNote) notes.push(r.trnNote);
      else if (r.trnUnreliable) notes.push('Supplier TRN in the workbook was shared with an unrelated vendor, so it was not imported.');
      if (r.note) notes.push(r.note);
      if (source === 'FILED_RETURN') notes.push(`As filed in the ${r.period} VAT return. Imported verbatim, not corrected.`);
      else notes.push('Found in Gmail but NOT present in any filed VAT return — never claimed.');

      made++;
      if (!APPLY) continue;
      try {
        await prisma.expense.create({
          data: {
            expenseNumber: `${batch}-${String(n).padStart(4, '0')}`,
            activity: PERIOD_ACTIVITY,
            category: categoryFor(r.supplier),
            description: r.description,
            amount: r.net, currency: r.currency, vatAmount: r.vat,
            totalAmount: Number(r.net) + Number(r.vat),
            expenseDate: new Date(r.date + 'T00:00:00Z'),
            invoiceDate: new Date(r.date + 'T00:00:00Z'),
            status,
            vendorName: r.supplierRaw || r.supplier,
            supplierId: sid,
            supplierVatId: r.supplierTrn || null,
            invoiceNumber: r.invoiceNumber,
            sourceRef: r.ref || null,
            sourceUrl: r.threadId ? `https://mail.google.com/mail/u/0/#all/${r.threadId}` : null,
            importSource: 'BULK_IMPORT',
            importBatchId: batch,
            importedAt: new Date(),
            notes: notes.join(' '),
            createdById: CREATED_BY,
            ...(status === 'APPROVED' ? { approvedById: CREATED_BY, approvedAt: new Date() } : {}),
          },
        });
        created.expenses++;
      } catch (err) { failed.push(`expense ${r.invoiceNumber}: ${err.message.split('\n')[0]}`); }
    }
    console.log(`  ${made} to create, ${skippedHere} already present.`);
  }

  await importExpenses(DATA.expensesFiled, 'from filed VAT returns', 'APPROVED', 'FILED_RETURN', 'filed-2025-2026');
  await importExpenses(DATA.expensesGmail, 'found in Gmail, never filed', 'PENDING_APPROVAL', 'GMAIL', 'gmail-2025-2026');

  // ------------------------------------------------------------ invoices
  line(`INVOICES — from filed VAT returns (${DATA.invoicesFiled.length} rows, status PAID)`);
  for (const r of DATA.invoicesFiled) {
    const cid = cliId[r.client];
    if (!cid) { failed.push(`invoice ${r.invoiceNumber}: client "${r.client}" unresolved`); continue; }
    if (APPLY) {
      const dupe = await prisma.invoice.findFirst({ where: { invoiceNumber: r.invoiceNumber }, select: { id: true } });
      if (dupe) { skipped.invoices++; continue; }
    }
    const total = Number(r.net) + Number(r.vat);
    console.log(`  [+] ${r.date}  ${r.period}  ${String(r.client).padEnd(30).slice(0, 30)} net ${Number(r.net).toFixed(2).padStart(11)}  vat ${Number(r.vat).toFixed(2).padStart(9)}`);
    if (!APPLY) continue;
    try {
      await prisma.invoice.create({
        data: {
          invoiceNumber: r.invoiceNumber, clientId: cid, activity: PERIOD_ACTIVITY,
          invoiceType: 'TAX_INVOICE', status: 'PAID',
          issueDate: new Date(r.date + 'T00:00:00Z'),
          currency: 'AED', subtotal: r.net, vatAmount: r.vat, total,
          amountPaid: total, amountDue: 0,
          subject: r.description,
          internalNotes: `As filed in the ${r.period} VAT return.` +
            (r.dateWasInferred ? ` Date not usable in the workbook (cell read "${r.rawDate}") — set to the period end.` : '') +
            ` Client recorded in the workbook as "${r.clientRaw}".`,
          createdById: CREATED_BY,
          items: { create: [{ sortOrder: 0, kind: 'SERVICE', description: r.description, quantity: 1, unit: 'job', days: 1, unitPrice: r.net, lineTotal: r.net, taxAmount: r.vat }] },
        },
      });
      created.invoices++;
    } catch (err) { failed.push(`invoice ${r.invoiceNumber}: ${err.message.split('\n')[0]}`); }
  }

  // ------------------------------------------------------------ summary
  line('SUMMARY');
  if (!APPLY) {
    console.log('  DRY RUN — nothing written. Re-run with --apply.');
    if (failed.length) { console.log(`\n  ${failed.length} problem(s) that would occur:`); failed.slice(0, 20).forEach((f) => console.log('    ' + f)); }
    return;
  }
  console.log(`  Suppliers created : ${created.suppliers}  (skipped ${skipped.suppliers})`);
  console.log(`  Clients created   : ${created.clients}  (skipped ${skipped.clients})`);
  console.log(`  Expenses created  : ${created.expenses}  (skipped ${skipped.expenses})`);
  console.log(`  Invoices created  : ${created.invoices}  (skipped ${skipped.invoices})`);
  if (failed.length) { console.log(`\n  FAILURES (${failed.length}):`); failed.forEach((f) => console.log('    ' + f)); }

  line('NEXT');
  console.log('  The filed rows are APPROVED, so post them to the ledger:');
  console.log('    POST /api/v1/accounting/post-all');
  console.log('  Then each quarter should reproduce what you filed:');
  console.log('    GET /api/v1/finance/reports/vat-return?startDate=2025-10-01&endDate=2025-12-31');
  console.log('  The Gmail-only rows stay PENDING_APPROVAL — they were never claimed.');
}

main()
  .catch((e) => { console.error('\nIMPORT FAILED:', e.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
