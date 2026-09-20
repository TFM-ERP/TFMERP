#!/usr/bin/env node
/**
 * inspect-seed-clients.js
 *
 * READ-ONLY. Shows every client on file, what hangs off each one, and the
 * actual contents of the rows blocking the seed-client deletion — so the call
 * on what is test data and what is real work is made on evidence.
 *
 *     node "C:\Projects\TFM-System\backend\tools\inspect-seed-clients.js"
 *
 * Writes nothing. Ever.
 *
 * Relationships are read from the Prisma datamodel, including the foreign-key
 * names, so a link like Invoice.bookingId -> RentalBooking is followed
 * correctly rather than guessed at from the model name.
 */

const { PrismaClient, Prisma } = require('@prisma/client');

(function loadEnv() {
  const envPath = require('path').join(__dirname, '..', '.env');
  if (!require('fs').existsSync(envPath)) return;
  for (const raw of require('fs').readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    const eq = l.indexOf('='); if (eq === -1) continue;
    const k = l.slice(0, eq).trim(); let v = l.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
})();

const prisma = new PrismaClient();

const TARGET_IDS = ['cl-mbc','client-mbc','cl-rotana','client-rotana','cl-adfilm','client-adfc','cl-bbc','client-bbc','cl-netflix'];
const PLACEHOLDER_TRN = /(0123456|1234567|2345678|3456789|4567890|5678901|6789012|1112223|3334445|5556667|0000000)/;

function line(t) { console.log('\n' + '='.repeat(78)); console.log(t); console.log('='.repeat(78)); }
function cut(s, n) { return String(s == null ? '' : s).slice(0, n); }
const pick = (r, ...names) => { for (const n of names) if (r && r[n] != null) return r[n]; return null; };
const nameOf = (c) => pick(c, 'companyName', 'tradeName', 'name', 'title') || '(unnamed)';
const delegateOf = (m) => m.charAt(0).toLowerCase() + m.slice(1);

/** Models holding a foreign key to `target`, with the real FK column name. */
function childrenOf(target) {
  const out = [];
  for (const m of Prisma.dmmf.datamodel.models) {
    if (m.name === target) continue;
    for (const f of m.fields) {
      if (f.kind !== 'object' || f.type !== target || f.isList) continue;
      const fk = (f.relationFromFields || [])[0];
      if (!fk) continue;
      const d = delegateOf(m.name);
      if (prisma[d] && typeof prisma[d].findMany === 'function') out.push({ model: m.name, delegate: d, fk });
    }
  }
  return out;
}

/** One-line summary of an arbitrary row. */
function describe(row) {
  const bits = [];
  const label = pick(row, 'companyName', 'tradeName', 'name', 'title', 'subject', 'reference', 'bookingNumber',
    'invoiceNumber', 'quotationNumber', 'projectName', 'projectCode', 'code', 'email', 'body');
  if (label) bits.push(cut(label, 44));
  for (const k of ['status', 'startDate', 'endDate', 'issueDate', 'createdAt']) {
    if (row[k] == null) continue;
    const v = row[k] instanceof Date ? new Date(row[k]).toISOString().slice(0, 10) : row[k];
    bits.push(`${k}=${cut(v, 22)}`);
  }
  for (const k of ['total', 'totalAmount', 'amount', 'dailyRate']) {
    if (row[k] != null) { bits.push(`${k}=${Number(row[k]).toFixed(2)}`); break; }
  }
  if (!bits.length) bits.push(cut(row.id, 30));
  return bits.join('  ');
}

async function main() {
  console.log('SEED CLIENT INSPECTION — read-only');
  console.log(`Run  : ${new Date().toISOString()}`);
  try {
    const u = new URL(process.env.DATABASE_URL);
    console.log(`DB   : ${u.hostname}:${u.port || '5432'}/${(u.pathname || '').replace(/^\//, '')}`);
  } catch { console.log('DB   : cannot parse DATABASE_URL'); process.exitCode = 1; return; }

  const clients = await prisma.client.findMany();
  const refs = childrenOf('Client');

  // ------------------------------------------------------------- inventory
  line(`ALL ${clients.length} CLIENTS — what hangs off each`);
  const counted = [];
  for (const c of clients) {
    const parts = [];
    let total = 0;
    for (const r of refs) {
      let n = 0;
      try { n = await prisma[r.delegate].count({ where: { [r.fk]: c.id } }); } catch { continue; }
      if (n > 0) { parts.push(`${r.model}:${n}`); total += n; }
    }
    const trn = pick(c, 'trn') || '';
    const flag = TARGET_IDS.includes(c.id) ? 'SEED' : PLACEHOLDER_TRN.test(trn) ? 'trn?' : '    ';
    counted.push({ c, total, parts, flag });
  }
  counted.sort((a, b) => (a.flag === b.flag ? b.total - a.total : a.flag < b.flag ? -1 : 1));
  for (const { c, parts, flag } of counted) {
    console.log(`  ${flag}  ${cut(nameOf(c), 38).padEnd(40)} ${cut(pick(c, 'trn') || '—', 17).padEnd(18)} ${cut(c.id, 16).padEnd(18)} ${parts.join(' ') || '(nothing attached)'}`);
  }
  console.log('\n  SEED = one of the nine I believe are demo rows.  trn? = placeholder-looking TRN.');

  // ------------------------------------------------ the blocking rows, in full
  line('THE ROWS BLOCKING DELETION — read these before deciding');
  for (const id of TARGET_IDS) {
    const c = clients.find((x) => x.id === id);
    if (!c) { console.log(`\n  ${id}  — not present`); continue; }
    console.log(`\n  ${nameOf(c)}   (${id})`);
    let any = false;
    for (const r of refs) {
      let rows = [];
      try { rows = await prisma[r.delegate].findMany({ where: { [r.fk]: c.id } }); } catch { continue; }
      if (!rows.length) continue;
      any = true;
      console.log(`    ${r.model}  (${rows.length})`);
      for (const row of rows.slice(0, 6)) console.log(`       ${describe(row)}`);
      if (rows.length > 6) console.log(`       … and ${rows.length - 6} more`);

      // one more level down — what hangs off those rows
      const grand = childrenOf(r.model);
      for (const g of grand) {
        let n = 0;
        try { n = await prisma[g.delegate].count({ where: { [g.fk]: { in: rows.map((x) => x.id) } } }); } catch { continue; }
        if (n > 0) console.log(`         └─ ${g.model}: ${n} row(s) hang off these`);
      }
    }
    if (!any) console.log('    (nothing attached — safe to delete)');
  }

  line('DONE — nothing was written');
  console.log('  Tell me which of these are test data and I will write the cascade.');
}

main()
  .catch((e) => { console.error('\nFAILED:', e.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
