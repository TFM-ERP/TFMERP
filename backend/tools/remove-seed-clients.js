#!/usr/bin/env node
/**
 * remove-seed-clients.js  (v2 — cascade)
 *
 * Removes the demo clients seeded while the system was being built, together
 * with everything hanging off them.
 *
 *   DRY RUN (default — reports the whole graph, deletes nothing):
 *     node "C:\Projects\TFM-System\backend\tools\remove-seed-clients.js"
 *
 *   APPLY:
 *     node "C:\Projects\TFM-System\backend\tools\remove-seed-clients.js" --apply
 *
 * THE TEN TARGETS  (confirmed as example data)
 *   MBC Group                  cl-mbc     / client-mbc
 *   Rotana Studios             cl-rotana  / client-rotana
 *   Abu Dhabi Film Commission  cl-adfilm  / client-adfc
 *   BBC Studios Middle East    cl-bbc     / client-bbc
 *   Netflix MENA               cl-netflix / client-netflix
 *
 * HOW THE CASCADE IS BUILT
 *   Nothing is hard-coded. It walks the Prisma datamodel from Client outwards,
 *   following real foreign-key names (so Invoice.bookingId -> RentalBooking is
 *   followed, not missed), collecting row ids level by level to a depth of 4.
 *   Deletion runs deepest level first, so no foreign key is ever left dangling.
 *
 * THE TRIPWIRE
 *   If the graph turns up an Invoice, Payment, Expense, CreditNote or
 *   JournalEntry, the script ABORTS and prints them. Those are money records.
 *   A seeded client should not own any, and if one does, the assumption that
 *   this is all example data is wrong and I want to know before anything goes.
 *
 * SAFETY
 *   Backs up every row to tools/_seed-cascade-backup-<stamp>.json before
 *   deleting. One transaction — any failure rolls the whole thing back.
 *   Localhost only.
 */

const { PrismaClient, Prisma } = require('@prisma/client');

// --- load backend/.env regardless of the current working directory -----------
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

const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const TARGET_IDS = [
  'cl-mbc', 'client-mbc',
  'cl-rotana', 'client-rotana',
  'cl-adfilm', 'client-adfc',
  'cl-bbc', 'client-bbc',
  'cl-netflix', 'client-netflix',
];

/** Touch one of these and the assumption behind this script is wrong. */
const MONEY_MODELS = new Set(['Invoice', 'InvoiceItem', 'Payment', 'Expense', 'CreditNote', 'JournalEntry', 'JournalLine']);

const MAX_DEPTH = 4;

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

function describe(row) {
  const bits = [];
  const label = pick(row, 'companyName', 'tradeName', 'name', 'title', 'bookingNumber', 'invoiceNumber',
    'projectName', 'reference', 'code', 'email');
  if (label) bits.push(cut(label, 40));
  if (row.status != null) bits.push(String(row.status));
  for (const k of ['total', 'totalAmount', 'amount']) {
    if (row[k] != null) { bits.push(Number(row[k]).toFixed(2)); break; }
  }
  if (!bits.length) bits.push(cut(row.id, 28));
  return bits.join('  ');
}

async function main() {
  console.log('REMOVE SEEDED DEMO CLIENTS  (v2 — cascade)');
  console.log(`Mode : ${APPLY ? '*** APPLY — WILL DELETE ***' : 'DRY RUN (deletes nothing)'}`);
  console.log(`Run  : ${new Date().toISOString()}`);

  try {
    const u = new URL(process.env.DATABASE_URL);
    console.log(`DB   : ${u.hostname}:${u.port || '5432'}/${(u.pathname || '').replace(/^\//, '')}`);
    if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname)) {
      console.log('\n  STOP: DATABASE_URL is not localhost. Refusing to run.');
      process.exitCode = 1; return;
    }
  } catch {
    console.log('DB   : cannot parse DATABASE_URL — aborting.');
    process.exitCode = 1; return;
  }

  const all = await prisma.client.findMany();
  const targets = all.filter((c) => TARGET_IDS.includes(c.id));
  console.log(`Rows : ${all.length} clients, ${targets.length} of the ${TARGET_IDS.length} targets present`);

  const missing = TARGET_IDS.filter((id) => !all.some((c) => c.id === id));
  if (missing.length) console.log(`       already gone: ${missing.join(', ')}`);
  if (!targets.length) { line('NOTHING TO DO — all targets already removed'); return; }

  line('TARGETS');
  for (const c of targets) {
    console.log(`  ${cut(nameOf(c), 40).padEnd(42)} TRN ${cut(pick(c, 'trn') || '—', 17).padEnd(18)} ${c.id}`);
  }

  // ------------------------------------------------------------ walk the graph
  // levels[0] is Client itself; each further level is one hop further out.
  const levels = [new Map([['Client', targets.map((c) => c.id)]])];
  const seen = new Set(targets.map((c) => `Client:${c.id}`));
  const rowCache = new Map();   // "Model:id" -> row
  for (const c of targets) rowCache.set(`Client:${c.id}`, c);

  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const next = new Map();
    for (const [model, ids] of levels[depth]) {
      for (const child of childrenOf(model)) {
        let rows = [];
        try { rows = await prisma[child.delegate].findMany({ where: { [child.fk]: { in: ids } } }); }
        catch { continue; }
        for (const r of rows) {
          const key = `${child.model}:${r.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rowCache.set(key, r);
          if (!next.has(child.model)) next.set(child.model, []);
          next.get(child.model).push(r.id);
        }
      }
    }
    if (!next.size) break;
    levels.push(next);
  }

  line(`THE GRAPH — ${levels.length} level(s) deep`);
  let totalRows = 0;
  for (let d = 0; d < levels.length; d++) {
    console.log(`\n  level ${d}`);
    for (const [model, ids] of levels[d]) {
      totalRows += ids.length;
      console.log(`    ${model.padEnd(24)} ${String(ids.length).padStart(4)} row(s)`);
      for (const id of ids.slice(0, 4)) {
        console.log(`         ${describe(rowCache.get(`${model}:${id}`))}`);
      }
      if (ids.length > 4) console.log(`         … and ${ids.length - 4} more`);
    }
  }

  // ------------------------------------------------------------- the tripwire
  const money = [];
  for (const lvl of levels) {
    for (const [model, ids] of lvl) if (MONEY_MODELS.has(model)) money.push({ model, ids });
  }
  if (money.length) {
    line('ABORTING — MONEY RECORDS FOUND IN THE GRAPH');
    for (const m of money) {
      console.log(`\n  ${m.model}  ${m.ids.length} row(s)`);
      for (const id of m.ids) console.log(`     ${describe(rowCache.get(`${m.model}:${id}`))}`);
    }
    console.log('\n  A seeded demo client should not own an invoice, payment or expense.');
    console.log('  One of these does, so "all example data" is not true of the whole graph.');
    console.log('  Nothing was deleted. Send me this list.');
    process.exitCode = 1;
    return;
  }

  line('SUMMARY');
  console.log(`  clients to delete   ${targets.length}`);
  console.log(`  rows in total       ${totalRows}`);
  console.log(`  money records       none  (tripwire clear)`);
  console.log(`  delete order        deepest level first, level ${levels.length - 1} -> 0`);

  if (!APPLY) {
    line('DRY RUN — nothing was deleted');
    console.log('  Re-run with --apply.');
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backup = path.join(__dirname, `_seed-cascade-backup-${stamp}.json`);
  const dump = {};
  for (const lvl of levels) {
    for (const [model, ids] of lvl) {
      dump[model] = (dump[model] || []).concat(ids.map((id) => rowCache.get(`${model}:${id}`)));
    }
  }
  fs.writeFileSync(backup, JSON.stringify(dump, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
  console.log(`\n  Backup of ${totalRows} row(s): ${backup}`);

  line('DELETING (single transaction, deepest first)');
  const log = [];
  await prisma.$transaction(async (tx) => {
    for (let d = levels.length - 1; d >= 0; d--) {
      for (const [model, ids] of levels[d]) {
        const res = await tx[delegateOf(model)].deleteMany({ where: { id: { in: ids } } });
        log.push(`  level ${d}  ${model.padEnd(24)} ${res.count} deleted`);
      }
    }
  });
  console.log(log.join('\n'));

  line('VERIFY');
  const after = await prisma.client.count();
  console.log(`  clients remaining : ${after}`);
  console.log(`  expected          : ${all.length - targets.length}`);
  console.log(`  ${after === all.length - targets.length ? 'MATCHES — clean' : 'MISMATCH — send me this output'}`);
  const left = await prisma.client.findMany();
  console.log('\n  Real clients still on file:');
  for (const c of left.sort((a, b) => String(nameOf(a)).localeCompare(String(nameOf(b))))) {
    console.log(`    ${cut(nameOf(c), 44).padEnd(46)} TRN ${pick(c, 'trn') || '—'}`);
  }

  line('DONE');
}

main()
  .catch((e) => { console.error('\nFAILED (transaction rolled back):', e.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
