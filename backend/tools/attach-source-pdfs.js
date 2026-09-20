#!/usr/bin/env node
/**
 * attach-source-pdfs.js  (v2.1 — quarter-aware matcher + manual overrides)
 *
 * Copies your invoice, quotation, LPO and receipt PDFs into backend/uploads/ so
 * the app can show them, and attaches a document row ONLY where the pairing is
 * provably right.
 *
 *   DRY RUN — shows every decision, copies nothing, writes nothing:
 *     node "C:\Projects\TFM-System\backend\tools\attach-source-pdfs.js"
 *
 *   APPLY:
 *     node "C:\Projects\TFM-System\backend\tools\attach-source-pdfs.js" --apply
 *
 * WHY v2 EXISTS
 *   v1 had a bucket called CONFIDENT that was not. It linked five different
 *   Khalifa documents to one record, linked both halves of a 50/50 instalment
 *   pair to the same invoice, and attached quotations and client LPOs to
 *   invoice records as if they were the invoice. v2 fixes that with three rules:
 *
 *   1. ONLY an INVOICE or TAX_INVOICE may auto-link. A quotation, an LPO or a
 *      receipt is not the source document of an invoice record, so it is never
 *      auto-attached to one. Those are copied and listed for you to place.
 *   2. ONE record takes ONE source document. If two documents both claim the
 *      same record, neither is linked — a 50% instalment pair genuinely has two
 *      invoices behind one ledger row, and guessing which is which is worse
 *      than leaving both for you.
 *   3. A match on the counterparty name and the amount must ALSO fall within 45
 *      days of the record's date, and must be unambiguous — if a second record
 *      scores nearly as well, the document goes to review.
 *
 * WHAT GETS WRITTEN
 *   LINK   — file copied into uploads/, DocumentAttachment row created and
 *            pointed at the record. kind = SOURCE.
 *   REVIEW — file copied into uploads/ so nothing is lost, but NO database row.
 *            Every one is listed in a CSV next to this script with the reason
 *            and my best guess, for you to confirm or correct.
 *
 *   No junk rows, no placeholder entity ids. Re-running skips what is done.
 *
 * WHAT v2.1 ADDS
 *   4. QUARTER-AWARE DATES. Rows imported from your filed VAT returns carry a
 *      period-end placeholder date (FILED-2025-Q4-I7 is stamped 31 Dec), so a
 *      genuine match can sit 50+ days from the document and v2's 45-day gate
 *      threw it away. For FILED-* records the test is now "same VAT quarter"
 *      instead of a day count. Real records keep the 45-day rule.
 *   5. NAME TOLERANCE, NARROWLY. When the amount is exact AND the quarter
 *      matches AND the record is a FILED-* row, the name only has to reach 0.5
 *      rather than 0.8 — your workbook shortens supplier names ("MAP Media Art
 *      Production FZ LLC" became "MAP Media Productions"). Plural forms now
 *      compare equal. Everywhere else the 0.8 threshold stands.
 *   6. MANUAL OVERRIDES. A manifest entry may carry:
 *        forceLinkRef : an invoice/expense number to attach to, no matching
 *        forceKind    : SOURCE | SUPPORTING | GENERATED
 *      A forceLinkRef is your decision, so it bypasses every gate including the
 *      document-type rule. It still refuses to invent a record that is absent.
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

const APPLY = process.argv.includes('--apply');
const MANIFEST = path.join(__dirname, 'attach-manifest.json');
const UPLOADS = path.join(__dirname, '..', 'uploads');

/** Only these may ever be auto-linked to an accounting record. */
const LINKABLE_TYPES = new Set(['INVOICE', 'TAX_INVOICE']);
/** SOURCE means "this IS the document behind the record". Everything else supports it. */
const KIND_FOR = { INVOICE: 'SOURCE', TAX_INVOICE: 'SOURCE', QUOTATION: 'SUPPORTING', LPO: 'SUPPORTING', RECEIPT: 'SUPPORTING' };

const MAX_DAY_GAP = 45;      // name+amount match must also be near in time
const FILED_NAME_FLOOR = 0.5; // relaxed name bar, only for FILED-* rows in the same quarter
const AMOUNT_TOLERANCE = 0.02;
const AMBIGUITY_MARGIN = 0.05; // runner-up this close => ambiguous

function line(t) { console.log('\n' + '='.repeat(76)); console.log(t); console.log('='.repeat(76)); }
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function money(n) { return n == null ? '' : Number(n).toFixed(2); }
function cut(s, n) { return String(s == null ? '' : s).slice(0, n); }

/** 0..1 similarity on names: exact, containment, then token overlap. */
function nameScore(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const s = x.length <= y.length ? x : y;
  const l = x.length <= y.length ? y : x;
  if (s.length >= 5 && l.includes(s)) return 0.85;
  const stem = (t) => t.replace(/s$/, '');
  const toks = (v) => new Set(
    String(v).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 3).map(stem)
  );
  const ta = toks(a);
  const tb = toks(b);
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return (hit / Math.max(ta.size, tb.size)) * 0.8;
}

function dayGap(a, b) {
  if (!a || !b) return 99999;
  return Math.abs((new Date(a) - new Date(b)) / 86400000);
}

/** "2025-Q4" — the VAT period a date falls in. */
function quarterOf(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt)) return null;
  return `${dt.getUTCFullYear()}-Q${Math.floor(dt.getUTCMonth() / 3) + 1}`;
}

/**
 * True for rows imported from the filed VAT workbooks. Their dates are
 * period-end placeholders, not document dates, so a day-count comparison
 * against them is meaningless.
 */
function isFiledRow(r) {
  // The import wrote the workbook's own invoice-number column into
  // invoiceNumber where it had one, so that field alone does NOT identify a
  // filed row. sourceRef keeps the FILED- key in every case.
  return [r.sourceRef, r.invoiceNumber, r.expenseNumber]
    .some((v) => /^FILED-/i.test(String(v || '')));
}

/**
 * A synthetic key we minted during the VAT-workbook import (FILED-2025-Q4-I4)
 * is not a real invoice number, so a document number can never legitimately
 * equal it. Guard against treating it as a number match.
 */
function isRealNumber(v) {
  const n = norm(v);
  return !!n && !/^filed/.test(n);
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function main() {
  console.log('ATTACH SOURCE PDFs  (v2.1)');
  console.log(`Mode : ${APPLY ? '*** APPLY ***' : 'DRY RUN (copies nothing, writes nothing)'}`);

  try {
    const u = new URL(process.env.DATABASE_URL);
    console.log(`DB   : ${u.hostname}:${u.port || '5432'}/${(u.pathname || '').replace(/^\//, '')}`);
    if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname)) {
      console.log('\n  STOP: DATABASE_URL is not localhost. Refusing to run.');
      process.exitCode = 1;
      return;
    }
  } catch {
    console.log('DB   : cannot parse DATABASE_URL — aborting.');
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(MANIFEST)) {
    console.log(`\n  STOP: ${MANIFEST} not found — it ships beside this script.`);
    process.exitCode = 1;
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  console.log(`Docs : ${manifest.length} in the manifest`);

  const missing = manifest.filter((m) => !fs.existsSync(m.source));
  if (missing.length) {
    console.log(`\n  ${missing.length} source file(s) not found on disk — skipped:`);
    for (const m of missing.slice(0, 8)) console.log('    ' + m.source);
    if (missing.length > 8) console.log(`    … and ${missing.length - 8} more`);
  }
  const present = manifest.filter((m) => fs.existsSync(m.source));

  const invoices = await prisma.invoice.findMany({
    select: {
      id: true, invoiceNumber: true, issueDate: true, total: true, subtotal: true,
      client: { select: { companyName: true, tradeName: true } },
    },
  });
  const expenses = await prisma.expense.findMany({
    select: {
      id: true, expenseNumber: true, invoiceNumber: true, expenseDate: true,
      totalAmount: true, amount: true, vendorName: true, sourceRef: true,
      originalTotalAmount: true, originalCurrency: true,
    },
  });
  console.log(`Recs : ${invoices.length} invoices, ${expenses.length} expenses to match against`);

  const already = await prisma.documentAttachment.findMany({
    where: { provider: 'UPLOAD' }, select: { url: true },
  });
  const haveUrl = new Set(already.map((a) => a.url));

  // ------------------------------------------------------------ score pass
  const rows = [];
  let skipped = 0;

  for (const m of present) {
    const url = '/uploads/' + m.target;
    if (haveUrl.has(url)) { skipped++; continue; }

    const row = {
      m, url,
      kind: m.forceKind || KIND_FOR[m.docType] || 'SUPPORTING',
      entityType: m.side === 'ISSUED' ? 'INVOICE' : 'EXPENSE',
      candidate: null, runnerUp: null, reason: null, decision: 'REVIEW',
    };

    // ---- manual override: your decision, so it skips every gate below -------
    if (m.forceLinkRef) {
      const pool = m.side === 'ISSUED' ? invoices : expenses;
      const want = norm(m.forceLinkRef);
      const target = pool.find(
        (r) => norm(r.invoiceNumber) === want || norm(r.expenseNumber) === want
      );
      if (target) {
        row.candidate = { r: target, via: 'manual', numHit: false,
          rName: m.side === 'ISSUED'
            ? (target.client?.companyName || target.client?.tradeName)
            : target.vendorName,
          rTotal: m.side === 'ISSUED' ? target.total : target.totalAmount };
        row.decision = 'LINK';
        row.manual = true;
        row.reason = m.note || `placed by hand against ${m.forceLinkRef}`;
      } else {
        row.reason = `forceLinkRef "${m.forceLinkRef}" matches no record — check the reference`;
      }
      rows.push(row);
      continue;
    }

    if (!LINKABLE_TYPES.has(m.docType)) {
      row.reason = `${m.docType} is not the source document of an accounting record — place it by hand`;
      rows.push(row);
      continue;
    }

    const pool = m.side === 'ISSUED' ? invoices : expenses;
    const scored = [];

    for (const r of pool) {
      const rName = m.side === 'ISSUED'
        ? (r.client?.companyName || r.client?.tradeName)
        : r.vendorName;
      const rTotal = m.side === 'ISSUED' ? r.total : (r.originalTotalAmount ?? r.totalAmount);
      const rDate = m.side === 'ISSUED' ? r.issueDate : r.expenseDate;

      const numHit = isRealNumber(r.invoiceNumber) && isRealNumber(m.docNumber) &&
        norm(r.invoiceNumber) === norm(m.docNumber);
      const ns = nameScore(m.counterparty, rName);
      const amtHit = m.total != null && rTotal != null &&
        Math.abs(Number(rTotal) - Number(m.total)) < AMOUNT_TOLERANCE;
      const gap = dayGap(m.date, rDate);

      let score = 0;
      if (numHit) score += 0.6;
      score += ns * 0.25;
      if (amtHit) score += 0.3;
      if (gap <= 3) score += 0.15;
      else if (gap <= MAX_DAY_GAP) score += 0.08;
      else if (gap > 400) score -= 0.15;

      // A pairing only qualifies at all if it clears one of the hard gates.
      const filed = isFiledRow(r);
      const sameQ = quarterOf(m.date) && quarterOf(m.date) === quarterOf(rDate);
      if (filed && sameQ) score += 0.1;
      const strict = amtHit && ns >= 0.8 && gap <= MAX_DAY_GAP;
      const quarterly = filed && sameQ && amtHit && ns >= FILED_NAME_FLOOR;
      const qualifies = numHit || strict || quarterly;
      const via = numHit ? 'number' : strict ? 'name+amount+date' : quarterly ? 'amount+quarter' : null;

      scored.push({ r, score, numHit, amtHit, ns, gap, rName, rTotal, qualifies, via, filed, sameQ });
    }

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0] || null;
    row.runnerUp = scored[1] || null;

    if (!best || !best.qualifies) {
      row.candidate = best && best.score > 0.3 ? best : null;
      row.reason = best && best.amtHit
        ? `amount agrees with "${cut(best.rName, 40)}" but the name or the date does not`
        : 'no record matches on number, or on name + amount + date';
      rows.push(row);
      continue;
    }

    const qualifying = scored.filter((s) => s.qualifies);
    if (qualifying.length > 1 && !best.numHit &&
        qualifying[1].score > best.score - AMBIGUITY_MARGIN) {
      row.candidate = best;
      row.reason = `two records fit equally well (${cut(best.rName, 30)} / ${cut(qualifying[1].rName, 30)})`;
      rows.push(row);
      continue;
    }

    row.candidate = best;
    row.decision = 'LINK';
    row.reason =
      best.via === 'number' ? 'invoice number matches exactly'
      : best.via === 'amount+quarter' ? 'exact amount in the same VAT quarter as the filed row'
      : 'client, amount and date all agree';
    rows.push(row);
  }

  // -------------------------------------------- rule 2: one record, one source
  const byRecord = new Map();
  for (const row of rows) {
    if (row.decision !== 'LINK') continue;
    if (row.manual) continue;              // you placed it; the matcher does not get a vote
    const id = row.candidate.r.id;
    if (!byRecord.has(id)) byRecord.set(id, []);
    byRecord.get(id).push(row);
  }
  let demoted = 0;
  for (const [, group] of byRecord) {
    if (group.length < 2) continue;
    const numberMatches = group.filter((g) => g.candidate.numHit);
    if (numberMatches.length === 1) {
      // The exact number wins; the rest fall to review.
      for (const g of group) {
        if (g === numberMatches[0]) continue;
        g.decision = 'REVIEW';
        g.reason = `another document (${numberMatches[0].m.docNumber}) matches this record by invoice number`;
        demoted++;
      }
      continue;
    }
    const others = group.map((g) => g.m.docNumber).join(', ');
    for (const g of group) {
      g.decision = 'REVIEW';
      g.reason = `${group.length} documents claim the same record (${others}) — likely an instalment split, needs your call`;
      demoted++;
    }
  }

  const toLink = rows.filter((r) => r.decision === 'LINK');
  const toReview = rows.filter((r) => r.decision === 'REVIEW');

  // ---------------------------------------------------------------- report
  const manualCount = toLink.filter((r) => r.manual).length;
  line(`LINK — ${toLink.length} document(s) will be attached to a record` +
       (manualCount ? `  (${manualCount} placed by hand)` : ''));
  if (!toLink.length) console.log('  (none)');
  for (const { m, candidate, kind } of toLink) {
    const rec = candidate.r.invoiceNumber || candidate.r.expenseNumber || candidate.r.id;
    console.log(
      `  ${m.side.padEnd(8)} ${cut(m.docType, 12).padEnd(13)} ${cut(m.docNumber, 14).padEnd(15)} ` +
      `${cut(m.counterparty, 26).padEnd(28)} ${money(m.total).padStart(11)}  ->  ${cut(rec, 22).padEnd(23)} ` +
      `[${candidate.via || 'match'}${kind === 'SOURCE' ? '' : ' / ' + kind}]`
    );
  }

  line(`REVIEW — ${toReview.length} copied to uploads, NOT linked`);
  const grouped = {};
  for (const r of toReview) (grouped[r.m.docType] ||= []).push(r);
  for (const type of Object.keys(grouped).sort()) {
    console.log(`\n  ${type} (${grouped[type].length})`);
    for (const { m, reason, candidate } of grouped[type]) {
      console.log(
        `    ${cut(m.docNumber, 14).padEnd(15)} ${cut(m.counterparty, 26).padEnd(28)} ` +
        `${money(m.total).padStart(11)}  ${reason}`
      );
      if (candidate) {
        const rec = candidate.r.invoiceNumber || candidate.r.expenseNumber || candidate.r.id;
        console.log(`      best guess: ${cut(rec, 26)}  ${cut(candidate.rName, 34)}  ${money(candidate.rTotal)}`);
      }
    }
  }

  line('SUMMARY');
  console.log(`  in manifest              ${manifest.length}`);
  console.log(`  missing on disk          ${missing.length}`);
  console.log(`  already attached         ${skipped}`);
  console.log(`  will link                ${toLink.length}`);
  console.log(`  held for review          ${toReview.length}`);
  console.log(`    of which demoted by the one-record-one-source rule: ${demoted}`);

  if (!APPLY) {
    line('DRY RUN — nothing copied, nothing written');
    console.log('  Read the LINK list. Every entry there should be a document you would');
    console.log('  yourself file against that record. If even one is wrong, say so and I');
    console.log('  will tighten it further before anything touches the database.');
    console.log('\n  Re-run with --apply.');
    return;
  }

  // ---------------------------------------------------------------- apply
  fs.mkdirSync(UPLOADS, { recursive: true });
  let copied = 0, created = 0;

  for (const row of [...toLink, ...toReview]) {
    const dest = path.join(UPLOADS, row.m.target);
    if (!fs.existsSync(dest)) { fs.copyFileSync(row.m.source, dest); copied++; }
    row.bytes = fs.statSync(dest).size;
  }

  for (const { m, url, kind, entityType, candidate, reason, bytes, manual } of toLink) {
    await prisma.documentAttachment.create({
      data: {
        entityType,
        entityId: candidate.r.id,
        kind,
        name: `${m.docType.replace('_', ' ')} ${m.docNumber} — ${m.counterparty || 'unknown'}`.trim(),
        provider: 'UPLOAD',
        url,
        mimeType: 'application/pdf',
        sizeBytes: bytes,
        sourceRef: `file:${m.target}`,
        notes: `${manual ? 'Placed by hand' : 'Auto-linked'}: ${reason}. Original: ${m.source}`,
      },
    });
    created++;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csvPath = path.join(__dirname, `_unlinked-documents-${stamp}.csv`);
  const header = ['side', 'docType', 'docNumber', 'date', 'counterparty', 'total', 'currency',
    'uploadedAs', 'url', 'suggestedKind', 'reason', 'bestGuessRecord', 'bestGuessName', 'bestGuessTotal'];
  const lines = [header.join(',')];
  for (const { m, url, kind, candidate, reason } of toReview) {
    lines.push([
      m.side, m.docType, m.docNumber, m.date, m.counterparty, money(m.total), m.currency,
      m.target, url, kind, reason,
      candidate ? (candidate.r.invoiceNumber || candidate.r.expenseNumber || candidate.r.id) : '',
      candidate ? candidate.rName : '',
      candidate ? money(candidate.rTotal) : '',
    ].map(csvCell).join(','));
  }
  fs.writeFileSync(csvPath, lines.join('\n') + '\n');

  line('DONE');
  console.log(`  ${copied} file(s) copied into ${UPLOADS}`);
  console.log(`  ${created} attachment(s) created and linked`);
  console.log(`  ${toReview.length} held for review, listed in:`);
  console.log(`  ${csvPath}`);
  console.log(`  Total attachments now: ${await prisma.documentAttachment.count()}`);
  console.log('\n  /uploads is currently served WITHOUT authentication (backend/src/main.ts).');
  console.log('  That is the next thing to close.');
}

main()
  .catch((e) => { console.error('\nFAILED:', e.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
