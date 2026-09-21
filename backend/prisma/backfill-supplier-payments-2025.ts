/**
 * backfill-supplier-payments-2025.ts
 *
 * Every supplier payment of 2024-25 is already in the ledger as a journal entry that
 * debits 2000 Accounts Payable, but none has a row in the `payments` table, so an
 * expense cannot show how and when it was paid. This creates one Payment
 * (direction PAYMENT) per such entry:
 *   - linked to its expense and supplier;
 *   - method / account from the credit side: 1010 bank (transfer or card),
 *     1000 cash on hand, 2400 paid personally by the GM (no bank account);
 *   - reference = the ADCB transfer number or card + approval code;
 *   - notes = the ADCB statement line, verbatim, found in ADCB-2025-all-transactions.csv.
 * Each existing entry then gets sourceType 'PAYMENT' / sourceId = the new payment, the
 * same link receipts use, so the posting routine sees it as already posted.
 * No journal line is added or changed: trial balance and 2025 result stay the same.
 * Skips JE-2026-1109 (Dhabi One correction, not a payment).
 * Idempotent (tag [PAYBACKFILL2025] in payment notes). Pass --dry for the plan.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[PAYBACKFILL2025]';
const BANK_ID = 'cmpuuwnu70000kvnaopp53bng'; // ADCB 13328662820001
const CSV = '/Users/qandil/Library/CloudStorage/OneDrive-Personal/Desktop/Commercials/TFM/2025/Claude outputs/ADCB-2025-all-transactions.csv';
const SKIP = new Set(['JE-2026-1109']);
// Entries whose memo names no expense number.
const EXP_OVERRIDE: Record<string, string> = { 'JE-2026-1065': 'EXP-2025-0001', 'JE-2026-1118': 'EXP-2025-0003' };
// Entries whose card approvals are not all caught by the pattern.
const TOKEN_OVERRIDE: Record<string, string[]> = { 'JE-2026-1176': ['3825 717705', '3825 718532'] };
const EXP_RE = /(EXP-\d{4}-\d{4}|filed-2025-2026-\d{4}|gmail-2025-2026-\d{4})/g;
const CARD_RE = /(3825|2528)[ ,]+(?:approval\s+)?([0-9A-Z]{6,8})\b/g;
const TRF_RE = /\b(\d{8,9})\b/g;
const r2 = (n: number): number => Math.round(n * 100) / 100;

type Row = { date: string; iso: string; dir: string; amount: number; narrative: string };

function parseCsv(text: string): Row[] {
  const out: Row[] = [];
  for (const raw of text.split(/\r?\n/).slice(1)) {
    if (!raw.trim()) continue;
    const f: string[] = []; let cur = ''; let q = false;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (q) { if (c === '"' && raw[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { f.push(cur); cur = ''; } else cur += c;
    }
    f.push(cur);
    const [dd, mm, yy] = f[1].split('/');
    out.push({ date: f[1], iso: `${yy}-${mm}-${dd}`, dir: f[2], amount: Number(f[3]), narrative: f.slice(6).join(',') });
  }
  return out;
}

type Plan = {
  je: string; jeId: string; jeDate: string; amount: number; kind: 'TRANSFER' | 'CARD' | 'CASH' | 'OWNER';
  method: 'BANK_TRANSFER' | 'CARD' | 'CASH'; bankAccountId: string | null; paymentDate: string;
  reference: string | null; notes: string; expenseId: string; supplierId: string | null; expNos: string[];
};

async function main(): Promise<void> {
  if ((await prisma.payment.count({ where: { notes: { contains: TAG } } })) > 0) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  if (await prisma.payment.count({ where: { paymentNumber: { startsWith: 'PAY-' } } })) throw new Error('PAY- numbers already exist — nothing changed.');
  const rows = parseCsv(fs.readFileSync(CSV, 'utf8')).filter((r) => r.dir === 'DEBIT');
  const ap = await prisma.glAccount.findFirst({ where: { code: '2000' }, select: { id: true } });
  if (!ap) throw new Error('2000 missing — nothing changed.');
  const jes = await prisma.journalEntry.findMany({
    where: { date: { gte: new Date('2024-01-01'), lt: new Date('2026-01-01') }, lines: { some: { accountId: ap.id, debit: { gt: 0 } } } },
    include: { lines: { include: { account: { select: { code: true } } } } }, orderBy: [{ date: 'asc' }, { entryNumber: 'asc' }] });
  const plans: Plan[] = []; const problems: string[] = [];
  for (const j of jes) {
    if (SKIP.has(j.entryNumber)) continue;
    if (j.sourceType || j.sourceId) { problems.push(`${j.entryNumber} already linked to ${j.sourceType}`); continue; }
    const memo = j.memo || '';
    const text = [memo, ...j.lines.map((l) => l.description || '')].join(' ');
    const amount = r2(j.lines.filter((l) => l.account.code === '2000').reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0));
    const cr = (code: string): number => r2(j.lines.filter((l) => l.account.code === code).reduce((s, l) => s + Number(l.credit), 0));
    const expNos = EXP_OVERRIDE[j.entryNumber] ? [EXP_OVERRIDE[j.entryNumber]] : [...new Set(memo.match(EXP_RE) || [])];
    if (!expNos.length) { problems.push(`${j.entryNumber} names no expense`); continue; }
    const exp = await prisma.expense.findUnique({ where: { expenseNumber: expNos[0] }, select: { id: true, supplierId: true } });
    if (!exp) { problems.push(`${j.entryNumber} expense ${expNos[0]} not found`); continue; }
    for (const n of expNos.slice(1)) if (!(await prisma.expense.count({ where: { expenseNumber: n } }))) problems.push(`${j.entryNumber} expense ${n} not found`);
    const jeDate = j.date.toISOString().slice(0, 10);
    const settles = `Settles ${expNos.join(', ')}${expNos.length > 1 ? ' (one card payment for all of them; linked here to the first)' : ''}. Ledger entry ${j.entryNumber}.`;
    const base = { je: j.entryNumber, jeId: j.id, jeDate, amount, expenseId: exp.id, supplierId: exp.supplierId, expNos };
    if (cr('2400') > 0) {
      const card = /tamara|card/i.test(memo);
      const paid = cr('2400');
      const extra = Math.abs(paid - amount) > 0.005 ? ` He paid ${paid.toFixed(2)} in total; ${r2(paid - amount).toFixed(2)} of it is booked in the same ledger entry to 6500 (Tamara fee).` : '';
      plans.push({ ...base, kind: 'OWNER', method: card ? 'CARD' : 'BANK_TRANSFER', bankAccountId: null, paymentDate: jeDate, reference: null,
        notes: `${TAG} Paid personally by the GM${card ? ' on his own card (Tamara)' : ' (how he paid is not recorded)'} — credited to 2400 Owner Account; the company owes him. Not on the company bank statement.${extra} ${settles}` });
      continue;
    }
    if (cr('1000') > 0) {
      plans.push({ ...base, kind: 'CASH', method: 'CASH', bankAccountId: null, paymentDate: jeDate, reference: null,
        notes: `${TAG} Paid in cash from cash on hand (1000). Not on the company bank statement. ${settles}` });
      continue;
    }
    // Bank: either this entry credits 1010, or it re-points an earlier card entry (credit to a cost account).
    let bankAmt = cr('1010'); let lookText = text; let lookDate = jeDate; let via = '';
    if (bankAmt === 0) {
      const ref = memo.match(/JE-2026-\d{4}/);
      if (ref) {
        const src = await prisma.journalEntry.findUnique({ where: { entryNumber: ref[0] }, include: { lines: { include: { account: { select: { code: true } } } } } });
        if (!src) { problems.push(`${j.entryNumber} card entry ${ref[0]} not found`); continue; }
        bankAmt = r2(src.lines.filter((l) => l.account.code === '1010').reduce((s, l) => s + Number(l.credit), 0));
        lookText = [src.memo || '', ...src.lines.map((l) => l.description || '')].join(' ');
        lookDate = src.date.toISOString().slice(0, 10); via = ` The card line was first booked as ${ref[0]} and re-pointed to the payable by ${j.entryNumber}.`;
      } else if (TOKEN_OVERRIDE[j.entryNumber]) {
        bankAmt = r2(j.lines.filter((l) => l.account.code !== '2000').reduce((s, l) => s + Number(l.credit), 0));
        via = ` The card lines were first booked as cost and re-pointed to the payable by ${j.entryNumber}.`;
      } else { problems.push(`${j.entryNumber} has no bank, cash or owner credit and names no card entry`); continue; }
    }
    const cards = TOKEN_OVERRIDE[j.entryNumber] || [...lookText.matchAll(CARD_RE)].map((m) => `${m[1]} ${m[2]}`);
    let hits: Row[] = []; let kind: 'TRANSFER' | 'CARD' = 'CARD';
    if (cards.length) {
      for (const t of [...new Set(cards)]) {
        const h = rows.filter((r) => r.narrative.includes(t));
        if (h.length !== 1) { problems.push(`${j.entryNumber} card ${t}: ${h.length} statement lines`); continue; }
        hits.push(h[0]);
      }
    } else {
      for (const t of [...new Set([...lookText.matchAll(TRF_RE)].map((m) => m[1]))]) {
        const h = rows.filter((r) => r.narrative.includes(t) && Math.abs(r.amount - bankAmt) < 0.005);
        if (h.length === 1) hits.push(h[0]);
      }
      if (hits.length) kind = 'TRANSFER';
      else {
        // Card line whose approval code was not kept in the ledger: same amount, statement date = entry date (else within 3 days).
        for (const span of [0, 1, 2, 3]) {
          const lo = new Date(`${lookDate}T00:00:00Z`).getTime() - span * 86400000; const hi = lo + 2 * span * 86400000;
          const h = rows.filter((r) => Math.abs(r.amount - bankAmt) < 0.005 && (() => { const t = new Date(`${r.iso}T00:00:00Z`).getTime(); return t >= lo && t <= hi; })());
          if (h.length === 1) { hits = h; break; }
          if (h.length > 1) { problems.push(`${j.entryNumber} ${bankAmt} on ${lookDate}: ${h.length} candidate lines`); break; }
        }
        if (hits.length && !/ PUR /.test(` ${hits[0].narrative}`)) kind = 'TRANSFER';
      }
    }
    if (!hits.length) { problems.push(`${j.entryNumber} ${bankAmt}: no statement line found`); continue; }
    hits = [...new Map(hits.map((h) => [h.narrative, h])).values()];
    const sum = r2(hits.reduce((s, h) => s + h.amount, 0));
    if (Math.abs(sum - bankAmt) > 0.005) { problems.push(`${j.entryNumber} statement ${sum} vs ledger bank ${bankAmt}`); continue; }
    const refs = hits.map((h) => {
      if (kind === 'CARD') { const m = h.narrative.match(/(3825|2528)\s*([0-9A-Z]{6,8})\s+\d{2}\/\d{2}\/\d{4}\s*$/); return m ? `${m[1]} ${m[2]}` : ''; }
      // "O/W TRF 465718721 65718721" — the full number follows O/W TRF; the second is ADCB's truncated copy.
      const o = h.narrative.match(/O\/W TRF (\d{8,9})\b/); if (o) return o[1];
      const m = h.narrative.match(/(\d{8,9})\s+\d{2}\/\d{2}\/\d{4}\s*$/); return m ? m[1] : '';
    });
    if (refs.some((x) => !x)) { problems.push(`${j.entryNumber} reference not readable from: ${hits.map((h) => h.narrative).join(' / ')}`); continue; }
    const fee = r2(j.lines.filter((l) => l.account.code === '6500').reduce((s, l) => s + Number(l.debit), 0));
    let part = ''; let payAmt = amount;
    if (sum > amount + 0.005) {
      const rest = r2(sum - amount);
      part = fee > 0 && Math.abs(rest - fee) < 0.005
        ? ` ${amount.toFixed(2)} of the ${sum.toFixed(2)} on the statement settles the invoice; the other ${rest.toFixed(2)} is booked in the same ledger entry to 6500.`
        : ` ${amount.toFixed(2)} of the ${sum.toFixed(2)} on the statement settles the invoice; the other ${rest.toFixed(2)} is another purchase on the same card line, booked separately as cost.`;
    } else if (sum < amount - 0.005) {
      payAmt = sum;
      part = ` The payables settled total ${amount.toFixed(2)}; the ${r2(amount - sum).toFixed(2)} difference was written off in the same ledger entry.`;
    }
    plans.push({ ...base, amount: payAmt, kind, method: kind === 'CARD' ? 'CARD' : 'BANK_TRANSFER', bankAccountId: BANK_ID, paymentDate: hits[0].iso,
      reference: refs.join(' / '),
      notes: `${TAG} ADCB ${kind === 'CARD' ? 'company card' : 'transfer'} — statement line${hits.length > 1 ? 's' : ''}: ${hits.map((h) => `"${h.narrative}"`).join('; ')}.${part}${via} ${settles}` });
  }
  if (problems.length) { problems.forEach((p) => console.log('  PROBLEM', p)); throw new Error(`${problems.length} problem(s) — nothing changed.`); }

  plans.sort((a, b) => (a.paymentDate + a.je).localeCompare(b.paymentDate + b.je));
  const seq: Record<string, number> = {};
  const numbered = plans.map((p) => { const y = p.paymentDate.slice(0, 4); seq[y] = (seq[y] || 0) + 1; return { ...p, no: `PAY-${y}-${String(seq[y]).padStart(4, '0')}` }; });
  const tally: Record<string, [number, number]> = {};
  for (const p of numbered) {
    const t = (tally[p.kind] = tally[p.kind] || [0, 0]); t[0]++; t[1] = r2(t[1] + p.amount);
    console.log(`  ${p.no}  ${p.paymentDate}  ${p.kind.padEnd(8)} ${p.amount.toFixed(2).padStart(10)}  ${p.expNos.join('+').padEnd(22)} ${p.je}  ref ${p.reference || '-'}`);
    console.log(`           ${p.notes.replace(TAG + ' ', '')}`);
  }
  console.log('  Totals:', JSON.stringify(tally), `— ${numbered.length} payments`);
  if (DRY) { console.log('=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }
  await prisma.$transaction(async (tx) => {
    for (const p of numbered) {
      const d = new Date(`${p.paymentDate}T00:00:00.000Z`);
      const pay = await tx.payment.create({ data: {
        paymentNumber: p.no, direction: 'PAYMENT', supplierId: p.supplierId, expenseId: p.expenseId, bankAccountId: p.bankAccountId,
        amount: p.amount, currency: 'AED', paymentDate: d, method: p.method, status: 'CLEARED', clearedAt: d, reference: p.reference, notes: p.notes } });
      const u = await tx.journalEntry.updateMany({ where: { id: p.jeId, sourceType: null, sourceId: null }, data: { sourceType: 'PAYMENT', sourceId: pay.id } });
      if (u.count !== 1) throw new Error(`${p.je} changed underneath — nothing changed.`);
    }
  }, { timeout: 120000 });
  console.log(`Created ${numbered.length} supplier payments and linked each to its ledger entry.`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e instanceof Error ? e.message : e); await prisma.$disconnect(); process.exit(1); });
