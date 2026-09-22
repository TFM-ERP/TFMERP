/**
 * Records a supplier payment against an expense: the payment row, the slip, and the
 * ledger entry, in one transaction. Either all of it is saved or none of it is.
 *
 * The ledger entry uses the same rule as postAll (payment-posting.util), and is
 * linked to the payment (sourceType PAYMENT), so postAll will not post it again.
 *
 * Guard: a second payment with the same bank reference AND amount is refused —
 * the commonest way to book one slip twice.
 */
import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SlipReaderService } from './slip-reader.service';
import { paymentLines } from '../../accounting/payment-posting.util';

export type RecordPaymentDto = {
  paidFrom: 'COMPANY_BANK' | 'CASH_ON_HAND' | 'OWNER';
  bankAccountId?: string | null;
  method: 'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'CARD' | 'ONLINE';
  paymentDate: string; // yyyy-mm-dd
  amount: number;
  feeAmount?: number | null;
  currency?: 'AED' | 'USD' | 'EUR' | 'GBP';
  reference?: string | null;
  beneficiary?: string | null;
  beneficiaryAccount?: string | null;
  payerAccountRef?: string | null;
  notes?: string | null;
  uploadToken?: string | null; // from read-slip
  slipText?: string | null; // the OCR text, kept with the slip
};

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Pure, so the rules are tested on their own. Returns every problem, not just the first. */
export function validateRecordPayment(d: RecordPaymentDto, ctx: { bankOwnership: 'COMPANY' | 'OWNER' | null }): string[] {
  const e: string[] = [];
  if (!(Number(d.amount) > 0)) e.push('Amount must be more than zero.');
  if (d.feeAmount != null && Number(d.feeAmount) < 0) e.push('Fee cannot be negative.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.paymentDate || '') || isNaN(Date.parse(d.paymentDate)) || d.paymentDate.slice(0, 10) !== new Date(d.paymentDate).toISOString().slice(0, 10)) {
    e.push('Payment date must be a real date (yyyy-mm-dd).');
  }
  if (d.paidFrom === 'COMPANY_BANK' && ctx.bankOwnership !== 'COMPANY') e.push('A company bank payment needs a company bank account.');
  if (d.paidFrom === 'CASH_ON_HAND' && (d.bankAccountId || d.method !== 'CASH')) e.push('A cash payment has method Cash and no bank account.');
  if (d.paidFrom === 'OWNER' && ctx.bankOwnership === 'COMPANY') e.push('A payment you made personally cannot come from a company bank account.');
  if (d.method === 'CASH' && d.paidFrom !== 'CASH_ON_HAND') e.push('Method Cash is only for cash-on-hand payments.');
  if (d.payerAccountRef && /^\d{13,19}$/.test(d.payerAccountRef.replace(/[\s-]/g, ''))) e.push('Keep only the last 4 digits of a card.');
  return e;
}

@Injectable()
export class SupplierPaymentsService {
  constructor(private prisma: PrismaService) {}

  /** Payments against one expense, with their slips, entries, and what is still unpaid. */
  async list(expenseId: string) {
    const e = await this.prisma.expense.findUnique({ where: { id: expenseId }, select: { totalAmount: true, expenseNumber: true } });
    if (!e) throw new NotFoundException('Expense not found.');
    const payments = await this.prisma.payment.findMany({
      where: { expenseId, direction: 'PAYMENT' },
      orderBy: { paymentDate: 'asc' },
      include: { bankAccount: { select: { accountName: true, bankName: true, ownership: true } } },
    });
    const ids = payments.map((p) => p.id);
    const [slips, entries] = await Promise.all([
      this.prisma.documentAttachment.findMany({ where: { entityType: 'PAYMENT', entityId: { in: ids } }, select: { id: true, entityId: true, name: true, url: true } }),
      this.prisma.journalEntry.findMany({ where: { sourceType: 'PAYMENT', sourceId: { in: ids } }, select: { sourceId: true, entryNumber: true } }),
    ]);
    const entryBy = new Map(entries.map((x) => [x.sourceId, x.entryNumber]));
    const slipBy = new Map(slips.map((s) => [s.entityId, s]));
    const total = Number(e.totalAmount);
    const paid = r2(payments.reduce((s, p) => s + Number(p.amount), 0));
    return {
      expenseNumber: e.expenseNumber,
      payments: payments.map((p) => ({ ...p, entryNumber: entryBy.get(p.id) || null, slip: slipBy.get(p.id) || null })),
      total, paid, unpaid: r2(total - paid),
    };
  }

  async record(expenseId: string, d: RecordPaymentDto, userId?: string) {
    const exp = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      select: { id: true, expenseNumber: true, supplierId: true, totalAmount: true, status: true },
    });
    if (!exp) throw new NotFoundException('Expense not found.');

    const bank = d.bankAccountId
      ? await this.prisma.bankAccount.findUnique({ where: { id: d.bankAccountId }, select: { id: true, ownership: true } })
      : null;
    if (d.bankAccountId && !bank) throw new BadRequestException('Bank account not found.');

    const errors = validateRecordPayment(d, { bankOwnership: bank?.ownership ?? null });
    if (errors.length) throw new BadRequestException(errors.join(' '));

    const amount = r2(Number(d.amount));
    const fee = d.feeAmount == null ? null : r2(Number(d.feeAmount));
    const reference = d.reference?.trim() || null;

    if (reference) {
      const dup = await this.prisma.payment.findFirst({ where: { direction: 'PAYMENT', reference, amount }, select: { paymentNumber: true } });
      if (dup) throw new ConflictException(`Reference ${reference} for ${amount.toFixed(2)} is already recorded as ${dup.paymentNumber}.`);
    }

    const lines = paymentLines({ direction: 'PAYMENT', amount, feeAmount: fee, method: d.method, paidFrom: d.paidFrom, bankOwnership: bank?.ownership ?? null });
    if (!lines) throw new BadRequestException('Cannot tell where this payment came from.');
    const accts = await this.prisma.glAccount.findMany({ where: { code: { in: lines.map((l) => l.code) } }, select: { id: true, code: true } });
    const acct = new Map(accts.map((a) => [a.code, a.id]));
    const missing = lines.filter((l) => !acct.has(l.code)).map((l) => l.code);
    if (missing.length) throw new BadRequestException(`The chart of accounts is missing ${missing.join(', ')}.`);

    // The slip moves out of the temporary folder before the transaction; if anything
    // then fails it is moved back, so a retry can use the same upload.
    let slipFile: string | null = null;
    if (d.uploadToken) {
      const src = SlipReaderService.tmpPath(d.uploadToken);
      await fs.access(src).catch(() => { throw new BadRequestException('The slip upload has expired — attach it again.'); });
      slipFile = `payment-slip-${d.uploadToken}`;
      await fs.rename(src, join(process.cwd(), 'uploads', slipFile));
    }

    const date = new Date(`${d.paymentDate}T00:00:00.000Z`);
    const year = d.paymentDate.slice(0, 4);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const lastPay = await tx.payment.findFirst({
          where: { paymentNumber: { startsWith: `PAY-${year}-` } },
          orderBy: { paymentNumber: 'desc' }, select: { paymentNumber: true },
        });
        const paymentNumber = `PAY-${year}-${String((lastPay ? parseInt(lastPay.paymentNumber.slice(-4), 10) : 0) + 1).padStart(4, '0')}`;

        const payment = await tx.payment.create({
          data: {
            paymentNumber, direction: 'PAYMENT', expenseId, supplierId: exp.supplierId, bankAccountId: bank?.id || null,
            amount, feeAmount: fee, currency: d.currency || 'AED', paymentDate: date, method: d.method,
            status: 'CLEARED', clearedAt: date, paidFrom: d.paidFrom, reference,
            beneficiary: d.beneficiary?.trim() || null, beneficiaryAccount: d.beneficiaryAccount?.trim() || null,
            payerAccountRef: d.payerAccountRef?.trim() || null, notes: d.notes?.trim() || null,
          },
        });

        const prefix = `JE-${new Date().getFullYear()}-`;
        const lastJe = await tx.journalEntry.findFirst({
          where: { entryNumber: { startsWith: prefix } }, orderBy: { entryNumber: 'desc' }, select: { entryNumber: true },
        });
        const entryNumber = `${prefix}${String((lastJe ? parseInt(lastJe.entryNumber.slice(-4), 10) : 0) + 1).padStart(4, '0')}`;
        await tx.journalEntry.create({
          data: {
            entryNumber, date,
            memo: `Supplier payment ${paymentNumber}${reference ? ` — ${reference}` : ''} — ${exp.expenseNumber}`,
            source: 'SYSTEM', sourceType: 'PAYMENT', sourceId: payment.id, status: 'POSTED', postedAt: new Date(), createdById: userId || null,
            lines: { create: lines.map((l, i) => ({ accountId: acct.get(l.code)!, description: l.desc, debit: l.debit || 0, credit: l.credit || 0, sortOrder: i })) },
          },
        });

        if (slipFile) {
          const name = `Payment slip ${paymentNumber}`;
          const url = `/uploads/${slipFile}`;
          await tx.documentAttachment.create({ data: { entityType: 'PAYMENT', entityId: payment.id, kind: 'SUPPORTING', name, provider: 'UPLOAD', url, notes: d.slipText ? d.slipText.slice(0, 20000) : null, uploadedById: userId || null } });
          await tx.documentAttachment.create({ data: { entityType: 'EXPENSE', entityId: expenseId, kind: 'SUPPORTING', name: `${name} (${exp.expenseNumber})`, provider: 'UPLOAD', url, uploadedById: userId || null } });
          if (exp.supplierId) await tx.supplierDocument.create({ data: { supplierId: exp.supplierId, docType: 'OTHER', name, fileUrl: url, notes: `Proof of payment for ${exp.expenseNumber}` } });
        }

        const paid = await tx.payment.aggregate({ where: { expenseId, direction: 'PAYMENT' }, _sum: { amount: true } });
        if (Number(paid._sum.amount || 0) + 0.005 >= Number(exp.totalAmount) && exp.status !== 'PAID') {
          await tx.expense.update({ where: { id: expenseId }, data: { status: 'PAID', paidAt: date } });
        }
        return { payment, entryNumber, paidTotal: r2(Number(paid._sum.amount || 0)) };
      }, { timeout: 30000 });
    } catch (e) {
      if (slipFile && d.uploadToken) {
        await fs.rename(join(process.cwd(), 'uploads', slipFile), SlipReaderService.tmpPath(d.uploadToken)).catch(() => undefined);
      }
      throw e;
    }
  }
}
