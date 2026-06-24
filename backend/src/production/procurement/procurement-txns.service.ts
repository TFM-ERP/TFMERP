import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-FIN — production-accounting transaction types: cash advances (float issue + clearing),
 * credit-card (P-card) transactions (code → post), and crew expense claims (submit → approve →
 * reimburse). "Post"/"reimburse"/"clear-with-post" create an APPROVED COST ProjectTransaction on
 * the coded cost-center so the spend lands as an actual (then mirrored to the GL by the bridge).
 * (prisma cast to any so the new models compile before db:push.)
 */
const n = (v: any) => Number(v) || 0;

@Injectable()
export class ProcurementTxnsService {
  constructor(private prisma: PrismaService) {}
  private p() { return this.prisma as any; }

  private async postCost(projectId: string, d: any) {
    return this.p().projectTransaction.create({ data: {
      projectId, kind: 'COST', date: d.date ? new Date(d.date) : new Date(),
      accountCode: d.accountCode || null, accountTitle: d.accountTitle || null,
      description: d.description || 'Cost', party: d.party || null,
      amount: n(d.total), taxAmount: 0, total: n(d.total), currency: d.currency || 'AED',
      status: 'APPROVED', createdById: d.userId || null,
    } });
  }
  private async seq(prefix: string) {
    const year = new Date().getFullYear();
    const s = await this.p().documentSequence.upsert({ where: { prefix }, update: { lastNumber: { increment: 1 } }, create: { prefix, lastNumber: 1, year } });
    return `${prefix}-${year}-${String(s.lastNumber).padStart(4, '0')}`;
  }

  // ── Cash advances ───────────────────────────────────────────────────────────
  cashAdvances(projectId: string) { return this.p().cashAdvance.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }); }
  createCashAdvance(data: any, userId?: string) {
    return this.p().cashAdvance.create({ data: {
      projectId: data.projectId, holderName: data.holderName || 'Holder', holderId: data.holderId || null,
      purpose: data.purpose || null, amount: n(data.amount), currency: data.currency || 'AED',
      costCenterCode: data.costCenterCode || null, costCenterTitle: data.costCenterTitle || null,
      dateIssued: data.dateIssued ? new Date(data.dateIssued) : new Date(), notes: data.notes || null,
      status: 'OUTSTANDING', createdById: userId || null,
    } });
  }
  async updateCashAdvance(id: string, data: any) {
    const { id: _i, projectId, createdAt, updatedAt, ...rest } = data || {};
    if (rest.amount != null) rest.amount = n(rest.amount);
    if (rest.dateIssued) rest.dateIssued = new Date(rest.dateIssued);
    return this.p().cashAdvance.update({ where: { id }, data: rest });
  }
  /** Clear part/all of an advance against receipts; post=true records the spend as an actual cost. */
  async clearCashAdvance(id: string, body: any, userId?: string) {
    const a = await this.p().cashAdvance.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Cash advance not found');
    const amt = n(body.amount);
    if (amt <= 0) throw new BadRequestException('Clearance amount must be > 0.');
    const cleared = n(a.clearedAmount) + amt;
    if (cleared + n(a.returnedAmount) > n(a.amount) + 0.01) throw new BadRequestException('Cleared + returned exceeds the advance.');
    if (body.post) await this.postCost(a.projectId, { accountCode: body.accountCode || a.costCenterCode, accountTitle: body.accountTitle || a.costCenterTitle, description: `Cash advance clearance — ${a.holderName}${body.description ? ` (${body.description})` : ''}`, party: a.holderName, total: amt, currency: a.currency, userId });
    const status = (cleared + n(a.returnedAmount) >= n(a.amount) - 0.01) ? 'CLEARED' : 'PARTIALLY_CLEARED';
    return this.p().cashAdvance.update({ where: { id }, data: { clearedAmount: cleared, status } });
  }
  async returnCashAdvance(id: string, body: any) {
    const a = await this.p().cashAdvance.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Cash advance not found');
    const returned = n(a.returnedAmount) + n(body.amount);
    const status = (n(a.clearedAmount) + returned >= n(a.amount) - 0.01) ? (n(a.clearedAmount) > 0 ? 'CLEARED' : 'RETURNED') : a.status;
    return this.p().cashAdvance.update({ where: { id }, data: { returnedAmount: returned, status } });
  }
  removeCashAdvance(id: string) { return this.p().cashAdvance.delete({ where: { id } }); }

  // ── Credit-card transactions ──────────────────────────────────────────────────
  cardTxns(projectId: string, status?: string) { const where: any = { projectId }; if (status) where.status = status; return this.p().cardTransaction.findMany({ where, orderBy: { txnDate: 'desc' } }); }
  createCardTxn(data: any, userId?: string) {
    return this.p().cardTransaction.create({ data: {
      projectId: data.projectId, cardLast4: data.cardLast4 || null, cardholderName: data.cardholderName || null,
      merchant: data.merchant || null, description: data.description || null, amount: n(data.amount), currency: data.currency || 'AED',
      txnDate: data.txnDate ? new Date(data.txnDate) : new Date(), costCenterCode: data.costCenterCode || null, costCenterTitle: data.costCenterTitle || null,
      statementRef: data.statementRef || null, status: data.costCenterCode ? 'CODED' : 'UNRECONCILED', notes: data.notes || null, createdById: userId || null,
    } });
  }
  async updateCardTxn(id: string, data: any) {
    const { id: _i, projectId, postedTxnId, createdAt, updatedAt, ...rest } = data || {};
    if (rest.amount != null) rest.amount = n(rest.amount);
    if (rest.txnDate) rest.txnDate = new Date(rest.txnDate);
    if (rest.costCenterCode && !rest.status) rest.status = 'CODED';
    return this.p().cardTransaction.update({ where: { id }, data: rest });
  }
  /** Post a coded card transaction as an actual cost. */
  async postCardTxn(id: string, userId?: string) {
    const c = await this.p().cardTransaction.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Card transaction not found');
    if (c.postedTxnId) throw new BadRequestException('Already posted.');
    if (!c.costCenterCode) throw new BadRequestException('Code the transaction to a cost center first.');
    const txn = await this.postCost(c.projectId, { accountCode: c.costCenterCode, accountTitle: c.costCenterTitle, description: `Card — ${c.merchant || c.description || 'purchase'}`, party: c.cardholderName || c.merchant, total: n(c.amount), currency: c.currency, userId });
    return this.p().cardTransaction.update({ where: { id }, data: { status: 'POSTED', postedTxnId: txn.id } });
  }
  removeCardTxn(id: string) { return this.p().cardTransaction.delete({ where: { id } }); }

  // ── Expense claims ────────────────────────────────────────────────────────────
  expenseClaims(projectId: string, status?: string) { const where: any = { projectId }; if (status) where.status = status; return this.p().expenseClaim.findMany({ where, orderBy: { createdAt: 'desc' } }); }
  async createExpenseClaim(data: any, userId?: string) {
    const claimNumber = await this.seq('EXP');
    return this.p().expenseClaim.create({ data: {
      projectId: data.projectId, claimNumber, claimantName: data.claimantName || 'Claimant', claimantId: data.claimantId || null,
      description: data.description || null, amount: n(data.amount), currency: data.currency || 'AED',
      costCenterCode: data.costCenterCode || null, costCenterTitle: data.costCenterTitle || null,
      dateSubmitted: data.dateSubmitted ? new Date(data.dateSubmitted) : new Date(), receiptUrl: data.receiptUrl || null,
      notes: data.notes || null, status: 'DRAFT', createdById: userId || null,
    } });
  }
  setExpenseStatus(id: string, status: string, userId?: string) {
    const data: any = { status };
    if (status === 'APPROVED' || status === 'REJECTED') { data.approvedById = userId || null; data.approvedAt = new Date(); }
    return this.p().expenseClaim.update({ where: { id }, data });
  }
  /** Reimburse an approved claim — posts the actual cost + marks REIMBURSED. */
  async reimburseExpenseClaim(id: string, userId?: string) {
    const c = await this.p().expenseClaim.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Expense claim not found');
    if (c.status !== 'APPROVED') throw new BadRequestException('Only an APPROVED claim can be reimbursed.');
    if (c.reimbursedTxnId) throw new BadRequestException('Already reimbursed.');
    const txn = await this.postCost(c.projectId, { accountCode: c.costCenterCode, accountTitle: c.costCenterTitle, description: `Expense claim ${c.claimNumber} — ${c.description || c.claimantName}`, party: c.claimantName, total: n(c.amount), currency: c.currency, userId });
    return this.p().expenseClaim.update({ where: { id }, data: { status: 'REIMBURSED', reimbursedTxnId: txn.id } });
  }
  removeExpenseClaim(id: string) { return this.p().expenseClaim.delete({ where: { id } }); }
}
