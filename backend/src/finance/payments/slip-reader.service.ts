/**
 * Reads a payment slip and proposes the payment form's fields. Saves nothing but
 * the uploaded file, kept in uploads/tmp-slips until the payment is recorded
 * (supplier-payments) or it expires after 24 hours.
 *
 * Order (GM, 22 Sep 2026): text on this server first — PDF text layer or tesseract
 * OCR — then parseSlipText's rules. Only if amount, date or reference is still
 * missing is the slip's TEXT sent to the AI. The image never leaves the server,
 * which is why the costing module's vision extractor is not reused here.
 *
 * Also: the payer account is matched against saved bank accounts to suggest
 * "paid from", and warnings are raised for the checks the GM asked for. Warnings
 * inform; they never block (the duplicate guard that blocks is in record()).
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { promises as fs, mkdirSync } from 'fs';
import { join, basename, resolve } from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import { extractText } from '../../common/ocr.util';
import { parseSlipText, SlipField } from './slip-parse.util';

export const SLIP_TMP_DIR = join(process.cwd(), 'uploads', 'tmp-slips');
try { mkdirSync(SLIP_TMP_DIR, { recursive: true }); } catch { /* created on first upload by multer */ }

export const SLIP_FILE_RE = /^[0-9a-f-]{36}\.(pdf|png|jpe?g|webp|heic)$/i;
const TMP_TTL_MS = 24 * 60 * 60 * 1000;
const FIELDS: SlipField[] = ['date', 'amount', 'currency', 'reference', 'beneficiary', 'beneficiaryAccount', 'payerAccountRef', 'remark', 'fee'];
const KEY: SlipField[] = ['amount', 'date', 'reference'];
const STOP = new Set(['llc', 'l.l.c', 'fz', 'fze', 'fzco', 'fzc', 'trading', 'the', 'and', 'co', 'company', 'services', 'general', 'sole', 'proprietorship', 'est']);

export type SlipReadResult = {
  uploadToken: string;
  text: string;
  engine: 'text-layer' | 'ocr' | 'ocr+ai' | 'none';
  fields: Partial<Record<SlipField, { value: string; source: 'slip' | 'ai' }>>;
  suggestedPaidFrom?: 'COMPANY_BANK' | 'OWNER';
  suggestedBankAccountId?: string;
  warnings: string[];
};

/** Words of a name worth comparing ("MacGregor FZ LLE" → macgregor, lle). */
export function nameWords(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9؀-ۿ]+/).filter((w) => w.length > 2 && !STOP.has(w));
}

/** Does the slip's beneficiary look like any of the supplier's names? */
export function beneficiaryMatches(beneficiary: string, supplierNames: string[]): boolean {
  const b = new Set(nameWords(beneficiary));
  if (!b.size) return true; // nothing to compare — don't cry wolf
  return supplierNames.some((n) => nameWords(n).some((w) => b.has(w)));
}

@Injectable()
export class SlipReaderService {
  constructor(private prisma: PrismaService, private ai: AiService) {}

  /** `file` is the multer upload, already stored in SLIP_TMP_DIR under a uuid name. */
  async read(file: { path: string; mimetype: string; originalname: string }, expenseId?: string): Promise<SlipReadResult> {
    const token = basename(file.path);
    if (!SLIP_FILE_RE.test(token) || resolve(file.path) !== resolve(SLIP_TMP_DIR, token)) throw new BadRequestException('Unexpected upload location.');
    await this.pruneExpired();
    const warnings: string[] = [];

    let text = '';
    let engine: SlipReadResult['engine'] = 'none';
    try {
      const r = await extractText(await fs.readFile(file.path), file.mimetype);
      text = r.text;
      engine = r.engine;
    } catch (e: any) {
      warnings.push(`${String(e?.message || e).slice(0, 200)} You can fill the form by hand.`);
    }

    const fields: SlipReadResult['fields'] = {};
    const parsed = parseSlipText(text);
    for (const k of FIELDS) if (parsed[k]) fields[k] = { value: parsed[k]!, source: 'slip' };

    if (text.trim() && KEY.some((k) => !fields[k])) {
      const filled = await this.askAi(text, fields);
      if (filled === null) warnings.push('The AI could not help with this slip; the fields read from the slip are shown.');
      else if (filled > 0) engine = 'ocr+ai';
    }

    const out: SlipReadResult = { uploadToken: token, text, engine, fields, warnings };
    await this.suggestAccount(out);
    if (expenseId) warnings.push(...(await this.checks(expenseId, fields)));
    return out;
  }

  /** Fills only the fields the rules left empty. Returns how many it filled, or null on failure. */
  private async askAi(text: string, fields: SlipReadResult['fields']): Promise<number | null> {
    try {
      const j = await this.ai.json<Record<string, unknown>>({
        task: 'payment-slip-read',
        temperature: 0,
        maxTokens: 400,
        system:
          'You read the OCR text of bank payment slips. Reply with JSON only, no prose: ' +
          '{"date":"yyyy-mm-dd"|null,"amount":"1234.56"|null,"currency":"AED"|null,"reference":string|null,' +
          '"beneficiary":string|null,"beneficiaryAccount":string|null,"payerAccountRef":string|null,"remark":string|null,"fee":"12.34"|null}. ' +
          'Use only what the text says; null when absent. "reference" is the bank reference number, not a corporate reference. ' +
          '"payerAccountRef" is the payer IBAN or account number, or only the last 4 digits of a card.',
        user: text.slice(0, 6000),
      });
      if (!j || typeof j !== 'object') return null;
      let n = 0;
      for (const k of FIELDS) {
        if (fields[k]) continue; // what the slip's own text gave is never overwritten
        const raw = j[k];
        if (raw == null) continue;
        let v = String(raw).trim();
        if (!v) continue;
        if (k === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v)))) continue;
        if (k === 'amount' || k === 'fee') { const x = Number(v.replace(/,/g, '')); if (!(x > 0)) continue; v = x.toFixed(2); }
        if (k === 'payerAccountRef' && /^\d{13,19}$/.test(v.replace(/\s/g, ''))) v = v.replace(/\s/g, '').slice(-4); // never a whole card number
        if (k === 'reference' && !text.includes(v)) continue; // a reference must appear in the slip, not be invented
        fields[k] = { value: v, source: 'ai' };
        n++;
      }
      return n;
    } catch {
      return null;
    }
  }

  /** Payer IBAN / account / card last 4 → a saved bank account → suggested "paid from". */
  private async suggestAccount(out: SlipReadResult): Promise<void> {
    const payer = out.fields.payerAccountRef?.value?.replace(/\s/g, '');
    if (!payer) return;
    const accts = await this.prisma.bankAccount.findMany({
      where: { isActive: true },
      select: { id: true, iban: true, accountNumber: true, cardLast4: true, ownership: true },
    });
    const hit = accts.find((a) =>
      (a.iban && a.iban.replace(/\s/g, '') === payer) ||
      a.accountNumber.replace(/\s/g, '') === payer ||
      (payer.length === 4 && a.cardLast4 === payer));
    if (!hit) return;
    out.suggestedBankAccountId = hit.id;
    out.suggestedPaidFrom = hit.ownership === 'OWNER' ? 'OWNER' : 'COMPANY_BANK';
  }

  /** Warnings only — they inform, they never block. */
  private async checks(expenseId: string, fields: SlipReadResult['fields']): Promise<string[]> {
    const w: string[] = [];
    const e = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      select: {
        totalAmount: true,
        vendorName: true,
        supplier: { select: { name: true, tradeName: true } },
        payments: { where: { direction: 'PAYMENT' }, select: { amount: true } },
      },
    });
    if (!e) return w;
    const unpaid = Math.round((Number(e.totalAmount) - e.payments.reduce((s, p) => s + Number(p.amount), 0)) * 100) / 100;
    const amt = Number(fields.amount?.value || 0);
    if (amt && amt > unpaid + 0.005) w.push(`Amount ${amt.toFixed(2)} is more than the ${unpaid.toFixed(2)} still unpaid on this invoice.`);

    const ben = fields.beneficiary?.value;
    const names = [e.supplier?.name, e.supplier?.tradeName, e.vendorName].filter((x): x is string => !!x);
    if (ben && names.length && !beneficiaryMatches(ben, names)) w.push(`Beneficiary "${ben}" does not look like this invoice's supplier (${names[0]}).`);

    const ref = fields.reference?.value;
    if (ref && amt) {
      const dup = await this.prisma.payment.findFirst({ where: { direction: 'PAYMENT', reference: ref, amount: amt }, select: { paymentNumber: true } });
      if (dup) w.push(`Reference ${ref} for ${amt.toFixed(2)} is already recorded as ${dup.paymentNumber}.`);
    }
    return w;
  }

  /** Temporary slips older than 24 hours are removed. */
  private async pruneExpired(): Promise<void> {
    try {
      const now = Date.now();
      for (const f of await fs.readdir(SLIP_TMP_DIR)) {
        if (!SLIP_FILE_RE.test(f)) continue;
        const p = join(SLIP_TMP_DIR, f);
        const st = await fs.stat(p);
        if (now - st.mtimeMs > TMP_TTL_MS) await fs.unlink(p).catch(() => undefined);
      }
    } catch { /* housekeeping only */ }
  }

  /** Resolve a token from read() to its temp path; rejects anything that is not one of our uuid names. */
  static tmpPath(token: string): string {
    if (!token || basename(token) !== token || !SLIP_FILE_RE.test(token)) throw new BadRequestException('Invalid slip token.');
    return join(SLIP_TMP_DIR, token);
  }
}
