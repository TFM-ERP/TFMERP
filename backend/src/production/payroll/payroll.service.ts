import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { computeLineFringes, RuleLike } from '../../labor/fringe-engine';

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService, private ledger: LedgerService) {}

  list(projectId: string) {
    return this.prisma.timecard.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
  }

  /** Sum the project's frozen fringe rules for a classification against the gross. */
  private async computeFringe(projectId: string, classificationCode: string | undefined, gross: number, days: number, otHours: number) {
    const rules = await this.prisma.projectRateRule.findMany({ where: { projectId, enabled: true } });
    const applicable = rules.filter((rr) => !rr.classificationCode || rr.classificationCode === classificationCode);
    if (!applicable.length) return { fringe: 0, detail: [] as any[] };
    const ruleLikes: RuleLike[] = applicable.map((rr) => ({
      id: rr.id, label: rr.label, rateType: rr.rateType, calcMethod: rr.calcMethod as any,
      value: Number(rr.value), base: rr.base, capPeriod: rr.capPeriod,
      capAmount: rr.capAmount != null ? Number(rr.capAmount) : null,
      floorAmount: rr.floorAmount != null ? Number(rr.floorAmount) : null,
      tiers: (rr.tiers as any) || null, currency: rr.currency, glAccountCode: rr.glAccountCode, isEstimate: rr.isEstimate,
    }));
    const weeks = days > 0 ? days / 5 : undefined;
    const c = computeLineFringes(ruleLikes, { straightTime: gross, workedDays: days, weeks, hours: otHours });
    return { fringe: c.total, detail: c.detail };
  }

  private grossOf(d: any) {
    const days = Number(d.days) || 0, dailyRate = Number(d.dailyRate) || 0;
    const ot = (Number(d.otHours) || 0) * (Number(d.otRate) || 0);
    const reimb = (Number(d.boxRental) || 0) + (Number(d.kitRental) || 0) + (Number(d.perDiemDays) || 0) * (Number(d.perDiemRate) || 0);
    return { gross: days * dailyRate + ot, reimb, ot };
  }

  /** Live computation (no save) — for the form preview. */
  async preview(projectId: string, data: any) {
    const { gross, reimb, ot } = this.grossOf(data);
    const { fringe, detail } = await this.computeFringe(projectId, data.classificationCode, gross, Number(data.days) || 0, Number(data.otHours) || 0);
    return { gross: r2(gross), ot: r2(ot), reimb: r2(reimb), fringe: r2(fringe), total: r2(gross + fringe + reimb), fringeDetail: detail };
  }

  private async withComputed(projectId: string, data: any) {
    const { gross, reimb } = this.grossOf(data);
    const { fringe } = await this.computeFringe(projectId, data.classificationCode, gross, Number(data.days) || 0, Number(data.otHours) || 0);
    return { gross: r2(gross), fringe: r2(fringe), total: r2(gross + fringe + reimb) };
  }

  async create(projectId: string, data: any) {
    const c = await this.withComputed(projectId, data);
    return this.prisma.timecard.create({
      data: {
        projectId,
        name: data.name || 'Crew', role: data.role || null,
        classificationCode: data.classificationCode || null,
        accountCode: data.accountCode || null, accountTitle: data.accountTitle || null,
        weekEnding: data.weekEnding ? new Date(data.weekEnding) : null,
        days: Number(data.days) || 0, dailyRate: Number(data.dailyRate) || 0,
        otHours: Number(data.otHours) || 0, otRate: Number(data.otRate) || 0,
        boxRental: Number(data.boxRental) || 0, kitRental: Number(data.kitRental) || 0,
        perDiemDays: Number(data.perDiemDays) || 0, perDiemRate: Number(data.perDiemRate) || 0,
        currency: data.currency || 'AED', notes: data.notes || null,
        status: data.status || 'DRAFT', ...c,
      },
    });
  }

  async update(id: string, data: any) {
    const existing = await this.prisma.timecard.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    if (existing.status === 'POSTED') throw new BadRequestException('Posted timecards cannot be edited. Reverse it first.');
    const merged = { ...existing, ...data };
    const c = await this.withComputed(existing.projectId, merged);
    const { id: _i, projectId, project, createdAt, updatedAt, postedTxnId, ...rest } = data || {};
    if (rest.weekEnding) rest.weekEnding = new Date(rest.weekEnding);
    return this.prisma.timecard.update({ where: { id }, data: { ...rest, ...c } });
  }

  async remove(id: string) {
    const tc = await this.prisma.timecard.findUnique({ where: { id } });
    if (tc?.status === 'POSTED') throw new BadRequestException('Reverse the posted cost before deleting.');
    return this.prisma.timecard.delete({ where: { id } });
  }

  /** Post the burdened timecard total as a coded production cost (through the ledger, so period locks apply). */
  async post(id: string, userId?: string) {
    const tc = await this.prisma.timecard.findUnique({ where: { id } });
    if (!tc) throw new NotFoundException();
    if (tc.status === 'POSTED') throw new BadRequestException('Already posted.');
    if (!tc.accountCode) throw new BadRequestException('Assign a budget account before posting.');
    const when = tc.weekEnding || new Date();
    const txn = await this.ledger.create({
      projectId: tc.projectId, kind: 'COST', date: when,
      accountCode: tc.accountCode, accountTitle: tc.accountTitle,
      category: 'Payroll',
      description: `Payroll — ${tc.name}${tc.weekEnding ? ` (w/e ${new Date(tc.weekEnding).toLocaleDateString()})` : ''}`,
      party: tc.name, amount: Number(tc.total), taxAmount: 0, status: 'APPROVED', currency: tc.currency,
    }, userId);
    return this.prisma.timecard.update({ where: { id }, data: { status: 'POSTED', postedTxnId: txn.id } });
  }

  /** Reverse a posted timecard: delete its ledger cost and set back to APPROVED. */
  async reverse(id: string) {
    const tc = await this.prisma.timecard.findUnique({ where: { id } });
    if (!tc) throw new NotFoundException();
    if (tc.status !== 'POSTED' || !tc.postedTxnId) throw new BadRequestException('Not posted.');
    try { await this.ledger.remove(tc.postedTxnId); } catch { /* txn may already be gone */ }
    return this.prisma.timecard.update({ where: { id }, data: { status: 'APPROVED', postedTxnId: null } });
  }
}
