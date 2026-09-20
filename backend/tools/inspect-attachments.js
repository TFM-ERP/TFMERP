#!/usr/bin/env node
/**
 * inspect-attachments.js
 *
 * READ-ONLY. Answers one question: where did the 106 rows in
 * document_attachments come from, and would attaching 74 more duplicate them?
 *
 *     node "C:\Projects\TFM-System\backend\tools\inspect-attachments.js"
 *
 * Performs no writes. Reads document_attachments, groups it by every field that
 * carries provenance, and cross-checks it against the manifest the v2 attacher
 * is about to apply.
 */

const { PrismaClient } = require('@prisma/client');

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

function line(t) { console.log('\n' + '='.repeat(76)); console.log(t); console.log('='.repeat(76)); }
function cut(s, n) { return String(s == null ? '' : s).slice(0, n); }
function tally(rows, fn, label) {
  const c = new Map();
  for (const r of rows) { const k = String(fn(r)); c.set(k, (c.get(k) || 0) + 1); }
  console.log(`\n  by ${label}:`);
  for (const [k, n] of [...c.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cut(k, 46).padEnd(48)} ${n}`);
  }
  return c;
}

async function main() {
  console.log('ATTACHMENT PROVENANCE — read-only');
  console.log(`Run  : ${new Date().toISOString()}`);
  try {
    const u = new URL(process.env.DATABASE_URL);
    console.log(`DB   : ${u.hostname}:${u.port || '5432'}/${(u.pathname || '').replace(/^\//, '')}`);
  } catch { console.log('DB   : cannot parse DATABASE_URL'); process.exitCode = 1; return; }

  const atts = await prisma.documentAttachment.findMany({
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Rows : ${atts.length}`);
  if (!atts.length) { line('EMPTY — nothing to explain'); return; }

  line('1. WHAT THESE ROWS ARE');
  tally(atts, (a) => a.provider, 'provider');
  tally(atts, (a) => a.kind, 'kind');
  tally(atts, (a) => a.entityType, 'entityType');
  tally(atts, (a) => {
    const u = String(a.url || '');
    if (u.startsWith('/uploads/')) return '/uploads/…';
    if (/^https?:/i.test(u)) return u.split('/').slice(0, 3).join('/') + '/…';
    if (/^[A-Z]:\\/i.test(u)) return u.split('\\').slice(0, 4).join('\\') + '\\…';
    return u ? cut(u, 30) + '…' : '(empty)';
  }, 'url shape');
  tally(atts, (a) => {
    const s = String(a.sourceRef || '');
    if (!s) return '(none)';
    const i = s.indexOf(':');
    return i > 0 ? s.slice(0, i) + ':…' : cut(s, 24);
  }, 'sourceRef prefix');

  line('2. WHEN THEY WERE CREATED');
  tally(atts, (a) => new Date(a.createdAt).toISOString().slice(0, 16).replace('T', ' '), 'creation minute');

  line('3. FIRST 12 ROWS, VERBATIM');
  for (const a of atts.slice(0, 12)) {
    console.log(`\n  ${a.id}`);
    console.log(`    ${a.entityType}/${a.entityId}   kind=${a.kind}  provider=${a.provider}`);
    console.log(`    name     ${cut(a.name, 66)}`);
    console.log(`    url      ${cut(a.url, 66)}`);
    console.log(`    srcRef   ${cut(a.sourceRef, 66)}`);
    if (a.notes) console.log(`    notes    ${cut(a.notes, 66)}`);
    console.log(`    created  ${new Date(a.createdAt).toISOString()}`);
  }

  line('4. WOULD THE v2 ATTACHER DUPLICATE THEM?');
  const manifestPath = path.join(__dirname, 'attach-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.log('  attach-manifest.json not found beside this script — cannot compare.');
  } else {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log(`  manifest holds ${manifest.length} document(s)`);

    const byUrl = new Set(atts.map((a) => String(a.url)));
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const bySrc = new Set(atts.map((a) => norm(a.sourceRef)).filter(Boolean));
    const byName = new Set(atts.map((a) => norm(a.name)).filter(Boolean));

    let urlHit = 0, srcHit = 0, nameHit = 0, noHit = 0;
    const collisions = [];
    for (const m of manifest) {
      const url = '/uploads/' + m.target;
      const u = byUrl.has(url);
      const s = bySrc.has(norm('file:' + m.target));
      // does an existing row already mention this document number + counterparty?
      const n = [...byName].some((x) => x.includes(norm(m.docNumber)) && norm(m.docNumber).length >= 4);
      if (u) urlHit++;
      else if (s) srcHit++;
      else if (n) { nameHit++; collisions.push(m); }
      else noHit++;
    }
    console.log(`\n    already present, same URL         ${urlHit}   v2 skips these`);
    console.log(`    already present, same sourceRef   ${srcHit}   v2 does NOT skip these`);
    console.log(`    an existing row names this number ${nameHit}   v2 does NOT skip these`);
    console.log(`    genuinely new                     ${noHit}`);

    if (collisions.length) {
      console.log('\n  Documents whose number already appears in an existing attachment name:');
      for (const m of collisions.slice(0, 25)) {
        console.log(`    ${m.side.padEnd(8)} ${cut(m.docType, 11).padEnd(12)} #${cut(m.docNumber, 14).padEnd(15)} ${cut(m.counterparty, 30)}`);
      }
      if (collisions.length > 25) console.log(`    … and ${collisions.length - 25} more`);
    }
  }

  line('5. ROWS PER RECORD — is any record already over-attached?');
  const per = new Map();
  for (const a of atts) {
    const k = `${a.entityType}/${a.entityId}`;
    if (!per.has(k)) per.set(k, []);
    per.get(k).push(a);
  }
  const heavy = [...per.entries()].filter(([, g]) => g.length > 1).sort((a, b) => b[1].length - a[1].length);
  console.log(`  ${per.size} distinct record(s) carry attachments`);
  if (!heavy.length) console.log('  every record has exactly one — clean');
  for (const [k, g] of heavy.slice(0, 15)) {
    console.log(`\n  ${k}   ${g.length} attachment(s)`);
    for (const a of g) console.log(`     ${cut(a.kind, 10).padEnd(11)} ${cut(a.name, 56)}`);
  }

  line('DONE — nothing was written');
}

main()
  .catch((e) => { console.error('\nFAILED:', e.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
