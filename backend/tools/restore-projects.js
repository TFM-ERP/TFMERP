#!/usr/bin/env node
/**
 * restore-projects.js
 *
 * Puts "Home of Chaos" and "Yes My Name is Malik" back, with everything that
 * hung off them, from the cascade backup. The demo clients stay deleted.
 *
 *   DRY RUN (default — reports what it would restore, writes nothing):
 *     node "C:\Projects\TFM-System\backend\tools\restore-projects.js"
 *
 *   APPLY — attach the projects to one of your real clients:
 *     node "C:\Projects\TFM-System\backend\tools\restore-projects.js" --apply --client=<clientId>
 *
 *   APPLY — leave the client unset, if the column allows it:
 *     node "C:\Projects\TFM-System\backend\tools\restore-projects.js" --apply --no-client
 *
 * WHY IT ASKS
 *   Both projects were attached to client-netflix, a seeded demo row with a
 *   fabricated TRN. Recreating it to satisfy a foreign key would put the fake
 *   client straight back, so the new owner is your choice, not a default. The
 *   dry run prints your 18 real clients with their ids.
 *
 * WHAT IT RESTORES
 *   It reads the backup, finds the two projects by name, then walks outward
 *   through the Prisma datamodel exactly as the delete did — but inserts in the
 *   opposite order, parents first, so every foreign key resolves as it goes.
 *   Rows that already exist are skipped, so running it twice is safe.
 *
 * WHAT IT DOES NOT RESTORE
 *   Anything belonging to MBC, Rotana, BBC or Abu Dhabi Film Commission,
 *   including the DFGDSFG project and all six demo rental bookings.
 *
 * AFTERWARDS
 *   It scans the accounting side for any invoice, expense or journal entry
 *   pointing at either project and lists them, per your instruction to clear
 *   accounting records tied to these two.
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
const NO_CLIENT = process.argv.includes('--no-client');
const CLIENT_ARG = (process.argv.find((a) => a.startsWith('--client=')) || '').split('=')[1] || null;
const BACKUP_ARG = (process.argv.find((a) => a.startsWith('--backup=')) || '').split('=')[1] || null;

const KEEP_PROJECTS = ['home of chaos', 'yes my name is malik'];
const MONEY_MODELS = new Set(['Invoice', 'InvoiceItem', 'Payment', 'Expense', 'CreditNote', 'JournalEntry', 'JournalLine']);
const MAX_DEPTH = 5;

function line(t) { console.log('\n' + '='.repeat(78)); console.log(t); console.log('='.repeat(78)); }
function cut(s, n) { return String(s == null ? '' : s).slice(0, n); }
const pick = (r, ...names) => { for (const n of names) if (r && r[n] != null) return r[n]; return null; };
const delegateOf = (m) => m.charAt(0).toLowerCase() + m.slice(1);

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

/** Scalar fields only — relation objects cannot be passed to create(). */
function scalarFieldsOf(model) {
  const m = Prisma.dmmf.datamodel.models.find((x) => x.name === model);
  if (!m) return null;
  return new Set(m.fields.filter((f) => f.kind === 'scalar' || f.kind === 'enum').map((f) => f.name));
}

function isProjectClientNullable() {
  const m = Prisma.dmmf.datamodel.models.find((x) => x.name === 'ProductionProject');
  const f = m && m.fields.find((x) => x.name === 'clientId');
  return f ? !f.isRequired : false;
}

function findBackup() {
  if (BACKUP_ARG) return path.isAbsolute(BACKUP_ARG) ? BACKUP_ARG : path.join(__dirname, BACKUP_ARG);
  const files = fs.readdirSync(__dirname)
    .filter((f) => /^_seed-cascade-backup-.*\.json$/.test(f))
    .sort();
  return files.length ? path.join(__dirname, files[files.length - 1]) : null;
}

async function main() {
  console.log('RESTORE PRODUCTION PROJECTS');
  console.log(`Mode : ${APPLY ? '*** APPLY ***' : 'DRY RUN (writes nothing)'}`);
  console.log(`Run  : ${new Date().toISOString()}`);

  try {
    const u = new URL(process.env.DATABASE_URL);
    console.log(`DB   : ${u.hostname}:${u.port || '5432'}/${(u.pathname || '').replace(/^\//, '')}`);
    if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname)) {
      console.log('\n  STOP: DATABASE_URL is not localhost. Refusing to run.');
      process.exitCode = 1; return;
    }
  } catch { console.log('DB   : cannot parse DATABASE_URL'); process.exitCode = 1; return; }

  const backupPath = findBackup();
  if (!backupPath || !fs.existsSync(backupPath)) {
    console.log('\n  STOP: no _seed-cascade-backup-*.json found beside this script.');
    console.log('  Pass one with --backup=<filename>.');
    process.exitCode = 1; return;
  }
  console.log(`File : ${backupPath}`);
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const totalInBackup = Object.values(backup).reduce((n, a) => n + (a ? a.length : 0), 0);
  console.log(`Rows : ${totalInBackup} in the backup across ${Object.keys(backup).length} model(s)`);

  const projects = (backup.ProductionProject || []).filter(
    (p) => KEEP_PROJECTS.includes(String(pick(p, 'name', 'title', 'projectName') || '').trim().toLowerCase())
  );
  if (!projects.length) {
    console.log('\n  STOP: neither project found in the backup. Names present:');
    for (const p of backup.ProductionProject || []) console.log(`    ${pick(p, 'name', 'title', 'projectName')}`);
    process.exitCode = 1; return;
  }

  line(`PROJECTS TO RESTORE — ${projects.length}`);
  for (const p of projects) {
    console.log(`  ${cut(pick(p, 'name', 'title', 'projectName'), 40).padEnd(42)} ${p.status || ''}  ${p.id}`);
    console.log(`    was attached to clientId = ${p.clientId}`);
  }

  // ------------------------------------------------- walk the subtree, in the backup
  const levels = [new Map([['ProductionProject', projects.map((p) => p.id)]])];
  const seen = new Set(projects.map((p) => `ProductionProject:${p.id}`));
  const rowOf = new Map();
  for (const p of projects) rowOf.set(`ProductionProject:${p.id}`, p);

  for (let d = 0; d < MAX_DEPTH; d++) {
    const next = new Map();
    for (const [model, ids] of levels[d]) {
      const idSet = new Set(ids);
      for (const child of childrenOf(model)) {
        for (const r of backup[child.model] || []) {
          if (!idSet.has(r[child.fk])) continue;
          const key = `${child.model}:${r.id}`;
          if (seen.has(key)) continue;
          seen.add(key); rowOf.set(key, r);
          if (!next.has(child.model)) next.set(child.model, []);
          next.get(child.model).push(r.id);
        }
      }
    }
    if (!next.size) break;
    levels.push(next);
  }

  line(`THE SUBTREE — ${levels.length} level(s), inserted parents first`);
  let toRestore = 0;
  for (let d = 0; d < levels.length; d++) {
    console.log(`\n  level ${d}`);
    for (const [model, ids] of levels[d]) {
      toRestore += ids.length;
      const flag = MONEY_MODELS.has(model) ? '   <-- accounting record' : '';
      console.log(`    ${model.padEnd(24)} ${String(ids.length).padStart(4)} row(s)${flag}`);
    }
  }

  const notRestored = totalInBackup - toRestore;
  console.log(`\n  ${toRestore} row(s) belong to these two projects.`);
  console.log(`  ${notRestored} row(s) in the backup stay deleted — the demo clients and their data.`);

  // -------------------------------------------------------------- the owner
  line('WHO OWNS THEM NOW');
  const clients = await prisma.client.findMany();
  const nullable = isProjectClientNullable();
  console.log(`  ProductionProject.clientId is ${nullable ? 'OPTIONAL — --no-client is available' : 'REQUIRED — a client must be named'}`);

  let newClientId = null;
  if (CLIENT_ARG) {
    const hit = clients.find((c) => c.id === CLIENT_ARG) ||
      clients.find((c) => String(pick(c, 'companyName', 'tradeName', 'name') || '').toLowerCase().includes(CLIENT_ARG.toLowerCase()));
    if (!hit) {
      console.log(`\n  STOP: --client=${CLIENT_ARG} matches no client.`);
      process.exitCode = 1; return;
    }
    newClientId = hit.id;
    console.log(`  chosen: ${pick(hit, 'companyName', 'tradeName', 'name')}  (${hit.id})`);
  } else if (NO_CLIENT && nullable) {
    console.log('  chosen: no client — clientId will be left empty for you to set in the app');
  } else {
    console.log('\n  Pick one and pass it as --client=<id>:');
    for (const c of clients.sort((a, b) => String(pick(a, 'companyName', 'tradeName', 'name')).localeCompare(String(pick(b, 'companyName', 'tradeName', 'name'))))) {
      console.log(`    ${cut(pick(c, 'companyName', 'tradeName', 'name'), 44).padEnd(46)} ${c.id}`);
    }
    if (nullable) console.log('\n  Or pass --no-client to leave it unset.');
  }

  if (!APPLY) {
    line('DRY RUN — nothing was written');
    console.log('  Re-run with --apply and either --client=<id> or --no-client.');
    return;
  }
  if (!newClientId && !(NO_CLIENT && nullable)) {
    line('STOP — no owner chosen');
    console.log('  Pass --client=<id>, or --no-client if the column is optional.');
    process.exitCode = 1; return;
  }

  // ---------------------------------------------------------------- restore
  line('RESTORING (single transaction, parents first)');
  const log = [];
  await prisma.$transaction(async (tx) => {
    for (let d = 0; d < levels.length; d++) {
      for (const [model, ids] of levels[d]) {
        const allowed = scalarFieldsOf(model);
        let made = 0, skipped = 0;
        for (const id of ids) {
          const raw = rowOf.get(`${model}:${id}`);
          const data = {};
          for (const [k, v] of Object.entries(raw)) if (!allowed || allowed.has(k)) data[k] = v;
          if (model === 'ProductionProject') {
            if (newClientId) data.clientId = newClientId;
            else delete data.clientId;
          }
          const exists = await tx[delegateOf(model)].findUnique({ where: { id } }).catch(() => null);
          if (exists) { skipped++; continue; }
          await tx[delegateOf(model)].create({ data });
          made++;
        }
        log.push(`  level ${d}  ${model.padEnd(24)} ${made} restored${skipped ? `, ${skipped} already present` : ''}`);
      }
    }
  });
  console.log(log.join('\n'));

  // ------------------------------------------- accounting records on these projects
  line('ACCOUNTING RECORDS POINTING AT THESE PROJECTS');
  const projIds = projects.map((p) => p.id);
  let anyMoney = false;
  for (const child of childrenOf('ProductionProject')) {
    if (!MONEY_MODELS.has(child.model)) continue;
    let rows = [];
    try { rows = await prisma[child.delegate].findMany({ where: { [child.fk]: { in: projIds } } }); } catch { continue; }
    if (!rows.length) continue;
    anyMoney = true;
    console.log(`\n  ${child.model}  (${rows.length})`);
    for (const r of rows) {
      console.log(`     ${cut(pick(r, 'invoiceNumber', 'expenseNumber', 'reference', 'id'), 26).padEnd(28)} ` +
        `${cut(r.status, 12).padEnd(13)} ${Number(pick(r, 'total', 'totalAmount', 'amount') || 0).toFixed(2)}`);
    }
  }
  if (!anyMoney) {
    console.log('  none — no invoice, expense, payment or journal entry points at either project.');
    console.log('  Nothing to clear on the accounting side.');
  } else {
    console.log('\n  You asked for these to be removed. I have NOT deleted them —');
    console.log('  send me this list and I will write it as its own step.');
  }

  line('VERIFY');
  const back = await prisma.productionProject.findMany();
  console.log(`  production projects on file : ${back.length}`);
  for (const p of back) {
    console.log(`    ${cut(pick(p, 'name', 'title', 'projectName'), 40).padEnd(42)} ${p.status || ''}  client=${p.clientId || '(none)'}`);
  }

  line('DONE');
}

main()
  .catch((e) => { console.error('\nFAILED (transaction rolled back):', e.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
