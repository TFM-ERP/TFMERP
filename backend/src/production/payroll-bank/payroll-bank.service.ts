import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/** SYS-FIN — batched production PayrollRun (timecards → register + posted actuals) and a
 *  per-project bank reconciliation (clear PAID disbursements against a statement balance).
 *  (prisma cast to any so the new models/fields compile before db:push.) */
const n = (v: any) => Number(v) || 0;

@Injectable()
export class PayrollBankService {
  constructor(private prisma: PrismaService) {}
  private p() { return this.prisma as any; }

  // ── Payroll runs ────────────────────────────────────────────────────────────
  listRuns(projectId: string) { return this.p().productionPayrollRun.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }); }

  private async eligible(projectId: string, weekEnding?: string) {
    const where: any = { projectId, status: 'APPROVED' };
    if (weekEnding) where.weekEnding = new Date(weekEnding);
    const tcs = await this.p().timecard.findMany({ where });
    return tcs.filter((t: any) => !t.payrollRunId && t.status !== 'POSTED');
  }
  async previewRun(projectId: string, weekEnding?: string) {
    const tcs = await this.eligible(projectId, weekEnding);
    return {
      timecards: tcs.map((t: any) => ({ id: t.id, name: t.name, role: t.role, accountCode: t.accountCode, gross: n(t.gross), fringe: n(t.fringe), total: n(t.total) })),
      totals: { count: tcs.length, gross: tcs.reduce((s: number, t: any) => s + n(t.gross), 0), fringe: tcs.reduce((s: number, t: any) => s + n(t.fringe), 0), total: tcs.reduce((s: number, t: any) => s + n(t.total), 0) },
    };
  }
  /** Post a batch: each eligible timecard → APPROVED COST actual on its cost-center, marked POSTED + linked to the run. */
  async postRun(projectId: string, body: any, userId?: string) {
    let tcs: any[];
    if (Array.isArray(body.timecardIds) && body.timecardIds.length) {
      tcs = await this.p().timecard.findMany({ where: { id: { in: body.timecardIds } } });
      tcs = tcs.filter((t: any) => t.projectId === projectId && t.status !== 'POSTED' && !t.payrollRunId);
    } else {
      tcs = await this.eligible(projectId, body.weekEnding);
    }
    if (!tcs.length) throw new BadRequestException('No eligible (APPROVED, unposted) timecards to post.');
    const run = await this.p().productionPayrollRun.create({ data: {
      projectId, label: body.label || `Payroll ${new Date().toISOString().slice(0, 10)}`,
      weekEnding: body.weekEnding ? new Date(body.weekEnding) : null, status: 'DRAFT', createdById: userId || null,
    } });
    let g = 0, f = 0, t = 0, c = 0;
    for (const tc of tcs) {
      const txn = await this.p().projectTransaction.create({ data: {
        projectId, kind: 'COST', date: new Date(), accountCode: tc.accountCode || null, accountTitle: null,
        description: `Payroll — ${tc.name}${tc.role ? ` (${tc.role})` : ''}`, party: tc.name,
        amount: n(tc.total), taxAmount: 0, total: n(tc.total), currency: 'AED', status: 'APPROVED', createdById: userId || null,
      } });
      await this.p().timecard.update({ where: { id: tc.id }, data: { status: 'POSTED', postedTxnId: txn.id, payrollRunId: run.id } });
      g += n(tc.gross); f += n(tc.fringe); t += n(tc.total); c++;
    }
    return this.p().productionPayrollRun.update({ where: { id: run.id }, data: { status: 'POSTED', postedAt: new Date(), grossTotal: g, fringeTotal: f, total: t, timecardCount: c } });
  }
  async getRun(id: string) {
    const run = await this.p().productionPayrollRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Payroll run not found');
    const all = await this.p().timecard.findMany({ where: { projectId: run.projectId } });
    const timecards = all.filter((t: any) => t.payrollRunId === id).map((t: any) => ({ id: t.id, name: t.name, role: t.role, accountCode: t.accountCode, gross: n(t.gross), fringe: n(t.fringe), total: n(t.total) }));
    return { ...run, timecards };
  }

  // ── Per-project bank reconciliation ───────────────────────────────────────────
  listRecons(projectId: string) { return this.p().projectBankRecon.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }); }
  createRecon(data: any, userId?: string) {
    return this.p().projectBankRecon.create({ data: {
      projectId: data.projectId, label: data.label || null,
      statementDate: data.statementDate ? new Date(data.statementDate) : new Date(),
      statementBalance: n(data.statementBalance), openingBalance: n(data.openingBalance),
      clearedTxnIds: [], status: 'OPEN', notes: data.notes || null, createdById: userId || null,
    } });
  }
  async getRecon(id: string) {
    const r = await this.p().projectBankRecon.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Reconciliation not found');
    const txns = await this.p().projectTransaction.findMany({ where: { projectId: r.projectId, kind: 'COST', status: 'PAID' }, select: { id: true, date: true, party: true, description: true, total: true } });
    const cleared: string[] = Array.isArray(r.clearedTxnIds) ? r.clearedTxnIds : [];
    const set = new Set(cleared);
    const rows = txns.map((t: any) => ({ id: t.id, date: t.date, party: t.party, description: t.description, total: n(t.total), cleared: set.has(t.id) }))
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const clearedTotal = rows.filter((x: any) => x.cleared).reduce((s: number, x: any) => s + x.total, 0);
    const bookBalance = n(r.openingBalance) - clearedTotal;
    const difference = n(r.statementBalance) - bookBalance;
    return { ...r, rows, clearedTotal, bookBalance, difference, reconciled: Math.abs(difference) < 0.01 };
  }
  async toggleCleared(id: string, txnId: string) {
    const r = await this.p().projectBankRecon.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Reconciliation not found');
    const cur: string[] = Array.isArray(r.clearedTxnIds) ? r.clearedTxnIds : [];
    const next = cur.includes(txnId) ? cur.filter((x) => x !== txnId) : [...cur, txnId];
    return this.p().projectBankRecon.update({ where: { id }, data: { clearedTxnIds: next } });
  }
  finalizeRecon(id: string) { return this.p().projectBankRecon.update({ where: { id }, data: { status: 'RECONCILED' } }); }
  removeRecon(id: string) { return this.p().projectBankRecon.delete({ where: { id } }); }
}
