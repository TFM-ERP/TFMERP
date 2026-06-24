import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-FIN — Project ledger → double-entry GL bridge. Mirrors each project ProjectTransaction
 * "actual" into a balanced, POSTED JournalEntry so the cost report reconciles to the trial
 * balance. Idempotent (links journalEntryId), reversible (void), period-safe. (prisma cast to
 * any for the new journalEntryId field so it compiles before db:push.)
 */
const COST_ACTUAL = ['APPROVED', 'PAID'];
const INCOME_ACTUAL = ['INVOICED', 'RECEIVED', 'PAID', 'APPROVED'];

@Injectable()
export class ProductionGlService {
  constructor(private prisma: PrismaService) {}

  private async acct(code: string, fb: { name: string; type: string; subtype?: string; isBank?: boolean }) {
    const p: any = this.prisma;
    let a = await p.glAccount.findUnique({ where: { code } });
    if (!a) a = await p.glAccount.create({ data: { code, name: fb.name, type: fb.type, subtype: fb.subtype || null, isBank: !!fb.isBank } });
    return a.id;
  }
  private async jeNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await (this.prisma as any).documentSequence.upsert({ where: { prefix: 'JE' }, update: { lastNumber: { increment: 1 } }, create: { prefix: 'JE', lastNumber: 1, year } });
    return `JE-${year}-${String(seq.lastNumber).padStart(4, '0')}`;
  }

  /** Mirror one ProjectTransaction to a balanced POSTED journal entry. Idempotent. */
  private async postOne(txn: any) {
    if (txn.journalEntryId) return null;
    const total = Number(txn.total) || 0;
    if (total <= 0) return null;
    const isCost = txn.kind === 'COST' || txn.kind === 'CORPORATE_OVERHEAD';
    const paid = txn.status === 'PAID';
    const lines: any[] = [];
    if (isCost) {
      const exp = await this.acct('5400', { name: 'Production Costs (WIP)', type: 'EXPENSE', subtype: 'Cost of Sales' });
      const credit = paid
        ? await this.acct('1010', { name: 'Bank — Current Account', type: 'ASSET', subtype: 'Current Asset', isBank: true })
        : await this.acct('2000', { name: 'Accounts Payable', type: 'LIABILITY', subtype: 'Current Liability' });
      lines.push({ accountId: exp, debit: total, credit: 0, sortOrder: 0, description: (txn.description || 'Production cost').slice(0, 180) });
      lines.push({ accountId: credit, debit: 0, credit: total, sortOrder: 1, description: paid ? 'Cash / bank' : 'Accounts payable' });
    } else {
      const rev = await this.acct('4100', { name: 'Production Services Revenue', type: 'INCOME', subtype: 'Operating Income' });
      const debit = paid
        ? await this.acct('1010', { name: 'Bank — Current Account', type: 'ASSET', subtype: 'Current Asset', isBank: true })
        : await this.acct('1100', { name: 'Accounts Receivable', type: 'ASSET', subtype: 'Current Asset' });
      lines.push({ accountId: debit, debit: total, credit: 0, sortOrder: 0, description: paid ? 'Cash / bank' : 'Accounts receivable' });
      lines.push({ accountId: rev, debit: 0, credit: total, sortOrder: 1, description: (txn.description || 'Production revenue').slice(0, 180) });
    }
    const entryNumber = await this.jeNumber();
    const entry = await (this.prisma as any).journalEntry.create({
      data: {
        entryNumber, date: txn.date || new Date(),
        memo: `[PROJ] ${txn.kind} ${txn.accountCode || ''} ${txn.party || ''}`.trim(),
        reference: txn.reference || txn.invoiceNumber || txn.id, source: 'PROJECT',
        status: 'POSTED', postedAt: new Date(), lines: { create: lines },
      },
    });
    await (this.prisma as any).projectTransaction.update({ where: { id: txn.id }, data: { journalEntryId: entry.id } as any });
    return entry;
  }

  /** Mirror all un-posted project actuals into the GL. */
  async syncProject(projectId: string) {
    const p: any = this.prisma;
    const txns = await p.projectTransaction.findMany({ where: { projectId } });
    let posted = 0, skipped = 0;
    for (const t of txns) {
      const isCost = t.kind === 'COST' || t.kind === 'CORPORATE_OVERHEAD';
      const actual = isCost ? COST_ACTUAL.includes(t.status) : INCOME_ACTUAL.includes(t.status);
      if (!actual || t.journalEntryId) { skipped++; continue; }
      const e = await this.postOne(t); if (e) posted++; else skipped++;
    }
    return { projectId, posted, skipped, ...(await this.reconcile(projectId)) };
  }

  /** Void the linked journal entry for a transaction (reversal). */
  async unpost(txnId: string) {
    const p: any = this.prisma;
    const t = await p.projectTransaction.findUnique({ where: { id: txnId } });
    if (!t?.journalEntryId) return { ok: true, voided: false };
    await p.journalEntry.update({ where: { id: t.journalEntryId }, data: { status: 'VOID' } });
    await p.projectTransaction.update({ where: { id: txnId }, data: { journalEntryId: null } as any });
    return { ok: true, voided: true };
  }

  /** Reconcile project actuals vs what's mirrored to the GL. */
  async reconcile(projectId: string) {
    const p: any = this.prisma;
    const txns = await p.projectTransaction.findMany({ where: { projectId } });
    let ledgerCost = 0, ledgerIncome = 0, postedCount = 0, unpostedCount = 0, unpostedAmount = 0;
    for (const t of txns) {
      const v = Number(t.total) || 0;
      const isCost = t.kind === 'COST' || t.kind === 'CORPORATE_OVERHEAD';
      const actual = isCost ? COST_ACTUAL.includes(t.status) : INCOME_ACTUAL.includes(t.status);
      if (!actual) continue;
      if (isCost) ledgerCost += v; else ledgerIncome += v;
      if (t.journalEntryId) postedCount++; else { unpostedCount++; unpostedAmount += v; }
    }
    return { ledgerCost, ledgerIncome, postedCount, unpostedCount, unpostedAmount, inBalance: unpostedCount === 0 };
  }
}
