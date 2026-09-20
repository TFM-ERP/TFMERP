#!/usr/bin/env node
/**
 * duplicate-audit.js
 *
 * READ-ONLY. Finds duplicate rows in the live TFM-System accounting data.
 * Performs no writes of any kind — no inserts, no updates, no deletes.
 *
 *     node "C:\Projects\TFM-System\backend\tools\duplicate-audit.js"
 *
 * Optional: also write the findings to a CSV next to this script.
 *     node "C:\Projects\TFM-System\backend\tools\duplicate-audit.js" --csv
 *
 * WHAT IT LOOKS FOR
 *   1. Expenses  — same supplier + same net + same VAT + same date
 *   2. Expenses  — same supplier + same supplier invoice number
 *   3. Expenses  — same sourceRef (the same Gmail thread or file imported twice)
 *   4. Invoices  — same client + same total + same issue date
 *   5. Invoices  — same invoice number issued twice   (a UAE VAT defect)
 *   6. Suppliers / Clients — names that normalise to the same string
 *   7. Attachments — the same file URL attached more than once
 *
 * A duplicate on the EXPENSE side means input VAT may have been recovered
 * twice. A duplicate on the INVOICE side means output VAT may be overstated,
 * or the same number was issued on two different documents. Both matter.
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
const WRITE_CSV = process.argv.includes('--csv');

function line(t) { console.log('\n' + '='.repeat(78)); console.log(t); console.log('='.repeat(78)); }
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function money(n) { return n == null ? '—' : Number(n).toFixed(2); }
function day(d) { return d ? new Date(d).toISOString().slice(0, 10) : '—'; }
function cut(s, n) { return String(s == null ? '' : s).slice(0, n); }
function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const findings = [];
function record(check, severity, key, rows, note) {
  findings.push({ check, severity, key, count: rows.length, note, rows });
}

/** Group an array by a key function, keeping only groups of 2 or more. */
function groupDupes(arr, keyFn) {
  const map = new Map();
  for (const r of arr) {
    const k = keyFn(r);
    if (k == null) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return [...map.entries()].filter(([, g]) => g.length > 1);
}

async function main() {
  console.log('DUPLICATE AUDIT — read-only, writes nothing to the database');
  console.log(`Run  : ${new Date().toISOString()}`);

  try {
    const u = new URL(process.env.DATABASE_URL);
    console.log(`DB   : ${u.hostname}:${u.port || '5432'}/${(u.pathname || '').replace(/^\//, '')}`);
  } catch {
    console.log('DB   : cannot parse DATABASE_URL — aborting.');
    process.exitCode = 1;
    return;
  }

  // No `select` on purpose. Naming a column that does not exist is a hard
  // error, and this schema has surprised me three times (Supplier.name not
  // companyName, Invoice.vatAmount not taxAmount). Pulling every scalar and
  // picking fields at runtime removes that whole class of failure; at these
  // row counts the extra columns cost nothing.
  const expenses = await prisma.expense.findMany({ include: { supplier: true } });
  const invoices = await prisma.invoice.findMany({ include: { client: true } });

  /** First present, non-null value among the candidate field names. */
  const pick = (row, ...names) => {
    for (const n of names) if (row && row[n] != null) return row[n];
    return null;
  };
  const eNet = (e) => pick(e, 'amount', 'netAmount', 'subtotal');
  const eVat = (e) => pick(e, 'vatAmount', 'taxAmount');
  const eTot = (e) => pick(e, 'totalAmount', 'total');
  const eDate = (e) => pick(e, 'invoiceDate', 'expenseDate', 'date');
  const iNet = (i) => pick(i, 'subtotal', 'netAmount', 'amount');
  const iVat = (i) => pick(i, 'vatAmount', 'taxAmount');
  const iTot = (i) => pick(i, 'total', 'totalAmount');
  const iDate = (i) => pick(i, 'issueDate', 'invoiceDate', 'date');

  console.log(`Rows : ${expenses.length} expenses, ${invoices.length} invoices`);

  const vName = (e) => pick(e.supplier, 'name', 'companyName', 'tradeName') || e.vendorName || '';
  const cName = (i) => pick(i.client, 'companyName', 'tradeName', 'name') || '';

  // ------------------------------------------------------- 1. expense triples
  line('1. EXPENSES — same supplier, same amount, same date');
  let g = groupDupes(expenses, (e) =>
    `${norm(vName(e))}|${money(eNet(e))}|${money(eVat(e))}|${day(eDate(e))}`);
  if (!g.length) console.log('  none');
  let vatAtRisk = 0;
  for (const [k, rows] of g.sort((a, b) => Number(eVat(b[1][0]) || 0) - Number(eVat(a[1][0]) || 0))) {
    const extra = Number(eVat(rows[0]) || 0) * (rows.length - 1);
    vatAtRisk += extra;
    console.log(`\n  ${cut(vName(rows[0]), 40).padEnd(42)} net ${money(eNet(rows[0])).padStart(11)}  VAT ${money(eVat(rows[0])).padStart(9)}  ${day(eDate(rows[0]))}   x${rows.length}`);
    for (const r of rows) {
      console.log(`     ${cut(r.expenseNumber, 18).padEnd(20)} inv#${cut(r.invoiceNumber, 20).padEnd(22)} ${cut(r.status, 10).padEnd(11)} ${cut(r.description, 40)}`);
    }
    console.log(`     if duplicated, input VAT overclaimed by AED ${extra.toFixed(2)}`);
    record('expense_same_amount_date', 'HIGH', k, rows, `extra input VAT AED ${extra.toFixed(2)}`);
  }
  if (g.length) console.log(`\n  TOTAL input VAT at risk on this check: AED ${vatAtRisk.toFixed(2)}`);

  // -------------------------------------------- 2. expense supplier invoice no
  line('2. EXPENSES — same supplier, same supplier invoice number');
  g = groupDupes(expenses, (e) => {
    const n = norm(e.invoiceNumber);
    if (!n || n.startsWith('filed')) return null;   // synthetic keys are not real numbers
    return `${norm(vName(e))}|${n}`;
  });
  if (!g.length) console.log('  none');
  for (const [k, rows] of g) {
    console.log(`\n  ${cut(vName(rows[0]), 40).padEnd(42)} invoice no. ${rows[0].invoiceNumber}   x${rows.length}`);
    for (const r of rows) {
      console.log(`     ${cut(r.expenseNumber, 18).padEnd(20)} ${day(eDate(r))}  net ${money(eNet(r)).padStart(11)}  VAT ${money(eVat(r)).padStart(9)}  ${cut(r.status, 10)}`);
    }
    const sameAmt = new Set(rows.map((r) => money(eNet(r)))).size === 1;
    console.log(`     ${sameAmt ? 'amounts identical — likely a true duplicate' : 'amounts differ — likely a corrupted invoice-number column, not a duplicate'}`);
    record('expense_same_invoice_number', sameAmt ? 'HIGH' : 'LOW', k, rows, sameAmt ? 'identical amounts' : 'amounts differ');
  }

  // ------------------------------------------------------------ 3. sourceRef
  line('3. EXPENSES — same sourceRef (imported twice from one email or file)');
  g = groupDupes(expenses, (e) => (e.sourceRef ? norm(e.sourceRef) : null));
  if (!g.length) console.log('  none');
  for (const [k, rows] of g) {
    console.log(`\n  sourceRef ${rows[0].sourceRef}   x${rows.length}`);
    for (const r of rows) console.log(`     ${cut(r.expenseNumber, 18).padEnd(20)} ${day(eDate(r))}  ${money(eTot(r)).padStart(12)}  ${cut(vName(r), 34)}`);
    record('expense_same_source_ref', 'HIGH', k, rows, 'same source imported more than once');
  }

  // -------------------------------------------------------- 4. invoice triples
  line('4. INVOICES — same client, same total, same issue date');
  g = groupDupes(invoices, (i) => `${norm(cName(i))}|${money(iTot(i))}|${day(iDate(i))}`);
  if (!g.length) console.log('  none');
  for (const [k, rows] of g) {
    console.log(`\n  ${cut(cName(rows[0]), 40).padEnd(42)} total ${money(iTot(rows[0])).padStart(12)}  ${day(iDate(rows[0]))}   x${rows.length}`);
    for (const r of rows) console.log(`     ${cut(r.invoiceNumber, 24).padEnd(26)} ${cut(r.status, 12)}`);
    record('invoice_same_total_date', 'HIGH', k, rows, 'possible double-counted revenue');
  }

  // ---------------------------------------------------- 5. invoice number reuse
  line('5. INVOICES — the same invoice number issued more than once  (VAT defect)');
  g = groupDupes(invoices, (i) => {
    const n = norm(i.invoiceNumber);
    if (!n || n.startsWith('filed')) return null;
    return n;
  });
  if (!g.length) console.log('  none');
  for (const [k, rows] of g) {
    console.log(`\n  invoice number ${rows[0].invoiceNumber}   x${rows.length}`);
    for (const r of rows) console.log(`     ${day(iDate(r))}  ${money(iTot(r)).padStart(12)}  ${cut(cName(r), 40)}`);
    record('invoice_number_reused', 'HIGH', k, rows, 'a tax invoice number must be unique');
  }

  // ------------------------------------------------- 6. supplier / client names
  line('6. SUPPLIERS and CLIENTS — names that collapse to the same string');
  for (const [model, label] of [['supplier', 'Supplier'], ['client', 'Client']]) {
    let rows = [];
    try {
      rows = await prisma[model].findMany();
    } catch (e) {
      console.log(`  ${label}: could not read — ${e.message.split('\n')[0]}`);
      continue;
    }
    const nameOf = (r) => pick(r, 'name', 'companyName', 'tradeName') || '';
    const gg = groupDupes(rows, (r) => norm(nameOf(r)).slice(0, 18) || null);
    if (!gg.length) { console.log(`  ${label}: none`); continue; }
    for (const [k, group] of gg) {
      console.log(`\n  ${label} x${group.length}`);
      for (const r of group) console.log(`     ${cut(nameOf(r), 46).padEnd(48)} TRN ${r.trn || '—'}   ${r.id}`);
      record(`${model}_name_collision`, 'MEDIUM', k, group, 'merge before they accumulate their own transactions');
    }
  }

  // ------------------------------------------------------------ 7. attachments
  line('7. ATTACHMENTS — the same file attached more than once');
  try {
    const atts = await prisma.documentAttachment.findMany({
      select: { id: true, url: true, entityType: true, entityId: true, kind: true, name: true },
    });
    console.log(`  ${atts.length} attachment row(s) on file`);
    const gg = groupDupes(atts, (a) => norm(a.url) || null);
    if (!gg.length) console.log('  no duplicate URLs');
    for (const [k, group] of gg) {
      console.log(`\n  ${group[0].url}   x${group.length}`);
      for (const a of group) console.log(`     ${a.entityType}/${a.entityId}  ${a.kind}  ${cut(a.name, 44)}`);
      record('attachment_duplicate_url', 'LOW', k, group, 'same file attached twice');
    }
    const orphan = atts.filter((a) => !a.entityId || a.entityId === 'UNLINKED');
    if (orphan.length) {
      console.log(`\n  ${orphan.length} attachment(s) carry a placeholder entityId — these are junk rows from the v1 attacher.`);
      record('attachment_placeholder_entity', 'MEDIUM', 'UNLINKED', orphan, 'delete or link properly');
    }
  } catch (e) {
    console.log(`  documentAttachment not readable: ${e.message.split('\n')[0]}`);
  }

  // ---------------------------------------------------------------- summary
  line('SUMMARY');
  const bySev = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of findings) bySev[f.severity] = (bySev[f.severity] || 0) + 1;
  console.log(`  duplicate groups found : ${findings.length}`);
  console.log(`    HIGH   ${bySev.HIGH || 0}   money or compliance consequence`);
  console.log(`    MEDIUM ${bySev.MEDIUM || 0}   data hygiene, fix before it spreads`);
  console.log(`    LOW    ${bySev.LOW || 0}   noise, probably explainable`);
  if (!findings.length) console.log('\n  Clean. No duplicates on any check.');

  if (WRITE_CSV) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const file = path.join(__dirname, `_duplicate-audit-${stamp}.csv`);
    const out = [['check', 'severity', 'groupKey', 'rowsInGroup', 'note', 'rowId', 'ref', 'date', 'net', 'vat', 'total', 'counterparty', 'status'].join(',')];
    for (const f of findings) {
      for (const r of f.rows) {
        out.push([
          f.check, f.severity, f.key, f.count, f.note,
          r.id,
          r.expenseNumber || r.invoiceNumber || r.companyName || r.url || '',
          day(pick(r, 'invoiceDate', 'expenseDate', 'issueDate')),
          money(pick(r, 'amount', 'subtotal')),
          money(pick(r, 'vatAmount', 'taxAmount')),
          money(pick(r, 'totalAmount', 'total')),
          pick(r.supplier, 'name') || pick(r.client, 'companyName', 'tradeName') || r.vendorName || r.name || r.companyName || '',
          r.status || '',
        ].map(csvCell).join(','));
      }
    }
    fs.writeFileSync(file, out.join('\n') + '\n');
    console.log(`\n  CSV written: ${file}`);
  } else {
    console.log('\n  Re-run with --csv to get this as a spreadsheet.');
  }

  line('DONE — nothing was written to the database');
}

main()
  .catch((e) => { console.error('\nAUDIT FAILED:', e.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
