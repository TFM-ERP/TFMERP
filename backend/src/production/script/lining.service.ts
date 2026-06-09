import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-13 · D6 — Script-supervisor lining (coverage + takes) → Hot Cost.
 * The digital lining log replaces paper tramlines; "Wrap take" stamps an out-time, and the
 * day's final wrap drives a thin Hot Cost accrual (base + overtime + meal penalties). No full
 * payroll engine exists, so this is a reviewable ESTIMATE the accountant pushes, not an auto-post.
 */
@Injectable()
export class LiningService {
  constructor(private prisma: PrismaService) {}

  private readonly STD_HOURS = 12;       // standard shoot day
  private readonly OT_MULTIPLIER = 1.5;  // overtime rate factor
  private readonly DEFAULT_MEAL_PENALTY = 50; // per head, AED

  // ── Coverage ─────────────────────────────────────────────────────────────────
  listForRevision(revisionId: string) {
    return this.prisma.scriptCoverage.findMany({
      where: { revisionId },
      include: { takes: { orderBy: { takeNumber: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addCoverage(sceneId: string, body: any, userId?: string) {
    const scene = await this.prisma.scriptScene.findUnique({ where: { id: sceneId }, select: { revisionId: true } });
    if (!scene) throw new NotFoundException('Scene not found.');
    return this.prisma.scriptCoverage.create({
      data: {
        sceneId, revisionId: scene.revisionId,
        slate: body?.slate || null, cameraSetup: body?.cameraSetup || null, description: body?.description || null,
        isOffScreen: !!body?.isOffScreen, lineCoordinates: body?.lineCoordinates ?? null, createdById: userId || null,
      },
    });
  }

  updateCoverage(id: string, data: any) {
    const d: any = {};
    for (const k of ['slate', 'cameraSetup', 'description', 'lineCoordinates']) if (data?.[k] !== undefined) d[k] = data[k];
    if (data?.isOffScreen !== undefined) d.isOffScreen = !!data.isOffScreen;
    return this.prisma.scriptCoverage.update({ where: { id }, data: d });
  }
  removeCoverage(id: string) { return this.prisma.scriptCoverage.delete({ where: { id } }); }

  // ── Takes ─────────────────────────────────────────────────────────────────────
  async addTake(coverageId: string, body: any) {
    const max = await this.prisma.takeLog.aggregate({ where: { coverageId }, _max: { takeNumber: true } });
    return this.prisma.takeLog.create({
      data: {
        coverageId,
        takeNumber: Number(body?.takeNumber) || (max._max.takeNumber || 0) + 1,
        status: ['OK', 'REJECT', 'CIRCLE'].includes(body?.status) ? body.status : 'OK',
        isCircleTake: !!body?.isCircleTake,
        inAt: body?.inAt || null, outAt: body?.outAt || null, notes: body?.notes || null,
      },
    });
  }

  updateTake(id: string, data: any) {
    const d: any = {};
    if (data?.status !== undefined && ['OK', 'REJECT', 'CIRCLE'].includes(data.status)) { d.status = data.status; d.isCircleTake = data.status === 'CIRCLE'; }
    if (data?.isCircleTake !== undefined) d.isCircleTake = !!data.isCircleTake;
    for (const k of ['inAt', 'outAt', 'notes', 'takeNumber'] as const) if (data?.[k] !== undefined) d[k] = k === 'takeNumber' ? Number(data[k]) : data[k];
    return this.prisma.takeLog.update({ where: { id }, data: d });
  }

  /** Wrap a take — stamps the out time now (the Hot Cost out-time feed). */
  async wrapTake(id: string) {
    const now = new Date();
    return this.prisma.takeLog.update({ where: { id }, data: { wrapTimestamp: now, outAt: now.toTimeString().slice(0, 5) } });
  }
  removeTake(id: string) { return this.prisma.takeLog.delete({ where: { id } }); }

  // ── Hot Cost ────────────────────────────────────────────────────────────────────
  private toMin(t?: string | null): number | null {
    if (!t) return null;
    const m = String(t).match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }

  /** Compute the day's Hot Cost estimate from call/target/actual wrap + crew rate card. */
  async computeHotCost(projectId: string, body: any) {
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { currency: true } });
    const crew = await this.prisma.productionCrew.findMany({ where: { projectId }, select: { dailyRate: true } });
    const crewCount = Number(body?.crewCount) || crew.length;
    const rates = crew.map((c) => Number(c.dailyRate || 0)).filter((n) => n > 0);
    const avgDayRate = Number(body?.avgDayRate) || (rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0);

    let target = this.toMin(body?.targetWrap);
    let actual = this.toMin(body?.actualWrap);
    if (target == null || actual == null) {
      // best-effort: from call time + standard day, and the latest logged wrap
      const call = this.toMin(body?.callTime);
      if (target == null && call != null) target = call + this.STD_HOURS * 60;
    }
    let otMinutes = 0;
    if (target != null && actual != null) {
      if (actual < target) actual += 1440; // wrapped past midnight
      otMinutes = Math.max(0, actual - target);
    }

    const hourly = avgDayRate / this.STD_HOURS;
    const otAmount = Math.round(crewCount * hourly * this.OT_MULTIPLIER * (otMinutes / 60) * 100) / 100;
    const forcedCallCount = body?.forcedCallCount != null ? Number(body.forcedCallCount) : (otMinutes > 0 ? crewCount : 0);
    const mealRate = Number(body?.mealPenaltyPerHead) || this.DEFAULT_MEAL_PENALTY;
    const mealPenaltyAmount = Math.round(forcedCallCount * mealRate * 100) / 100;
    const baseAmount = Math.round(crewCount * avgDayRate * 100) / 100;

    return {
      currency: project?.currency || 'AED',
      crewCount, avgDayRate: Math.round(avgDayRate * 100) / 100,
      callTime: body?.callTime || null, targetWrap: body?.targetWrap || null, actualWrap: body?.actualWrap || null,
      otMinutes, otAmount, forcedCallCount, mealPenaltyAmount, baseAmount,
      total: Math.round((baseAmount + otAmount + mealPenaltyAmount) * 100) / 100,
    };
  }

  async pushAccrual(projectId: string, body: any, userId?: string) {
    const c = await this.computeHotCost(projectId, body);
    if (c.otMinutes === 0 && c.otAmount === 0 && !body?.force) {
      // still allow, but flag — an accrual with no OT is unusual
    }
    return this.prisma.hotCostAccrual.create({
      data: {
        projectId, shootDate: body?.shootDate ? new Date(body.shootDate) : null, dayNumber: body?.dayNumber != null ? Number(body.dayNumber) : null,
        callTime: c.callTime, targetWrap: c.targetWrap, actualWrap: c.actualWrap,
        otMinutes: c.otMinutes, crewCount: c.crewCount,
        baseAmount: c.baseAmount, otAmount: c.otAmount, mealPenaltyAmount: c.mealPenaltyAmount,
        forcedCallCount: c.forcedCallCount, currency: c.currency,
        status: 'PUSHED', pushedAt: new Date(), notes: body?.notes || null, createdById: userId || null,
      },
    });
  }

  listAccruals(projectId: string) { return this.prisma.hotCostAccrual.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }); }
  removeAccrual(id: string) { return this.prisma.hotCostAccrual.delete({ where: { id } }); }
}
