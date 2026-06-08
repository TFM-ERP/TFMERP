import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class PmService {
  constructor(private prisma: PrismaService) {}

  private computeDue(plan: any, asset: any) {
    const now = new Date();
    const dayMs = 86_400_000;
    const bases: { metric: string; left: number; unit: string }[] = [];

    if (plan.intervalDays && plan.lastServiceDate) {
      const next = new Date(new Date(plan.lastServiceDate).getTime() + plan.intervalDays * dayMs);
      bases.push({ metric: 'date', left: Math.ceil((next.getTime() - now.getTime()) / dayMs), unit: 'days' });
    }
    if (plan.intervalKm && plan.lastServiceOdometer != null && asset?.currentOdometer != null) {
      bases.push({ metric: 'km', left: (plan.lastServiceOdometer + plan.intervalKm) - asset.currentOdometer, unit: 'km' });
    }
    if (plan.intervalHours && plan.lastServiceHours != null && asset?.currentEngineHours != null) {
      bases.push({ metric: 'hours', left: (plan.lastServiceHours + plan.intervalHours) - asset.currentEngineHours, unit: 'hrs' });
    }

    if (bases.length === 0) return { status: 'no-data', bases, soonest: null };

    // soonest = the most-due basis (smallest "left", normalized to urgency)
    const soonest = bases.reduce((a, b) => (b.left < a.left ? b : a));
    const isSoon = bases.some(b =>
      (b.metric === 'date' && b.left <= 14) ||
      (b.metric === 'km' && b.left <= 500) ||
      (b.metric === 'hours' && b.left <= 25),
    );
    const isOverdue = bases.some(b => b.left < 0);
    const status = isOverdue ? 'overdue' : isSoon ? 'due-soon' : 'ok';
    return { status, bases, soonest };
  }

  async listPlans(assetId?: string) {
    const plans = await this.prisma.maintenancePlan.findMany({
      where: { isActive: true, ...(assetId ? { assetId } : {}) },
      include: { asset: { select: { id: true, name: true, assetType: true, currentOdometer: true, currentEngineHours: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return plans.map(p => ({ ...p, due: this.computeDue(p, p.asset) }));
  }

  async due() {
    const all = await this.listPlans();
    return all.filter(p => p.due.status === 'overdue' || p.due.status === 'due-soon')
      .sort((a, b) => (a.due.soonest?.left ?? 0) - (b.due.soonest?.left ?? 0));
  }

  createPlan(data: any) {
    return this.prisma.maintenancePlan.create({
      data: {
        assetId: data.assetId,
        taskName: data.taskName,
        intervalDays: data.intervalDays ? Number(data.intervalDays) : null,
        intervalKm: data.intervalKm ? Number(data.intervalKm) : null,
        intervalHours: data.intervalHours ? Number(data.intervalHours) : null,
        lastServiceDate: data.lastServiceDate ? new Date(data.lastServiceDate) : null,
        lastServiceOdometer: data.lastServiceOdometer != null && data.lastServiceOdometer !== '' ? Number(data.lastServiceOdometer) : null,
        lastServiceHours: data.lastServiceHours != null && data.lastServiceHours !== '' ? Number(data.lastServiceHours) : null,
        notes: data.notes,
      },
    });
  }

  async updatePlan(id: string, data: any) {
    const patch: any = {};
    for (const k of ['taskName', 'notes']) if (data[k] !== undefined) patch[k] = data[k];
    for (const k of ['intervalDays', 'intervalKm', 'intervalHours', 'lastServiceOdometer', 'lastServiceHours'])
      if (data[k] !== undefined) patch[k] = data[k] === '' || data[k] == null ? null : Number(data[k]);
    if (data.lastServiceDate !== undefined) patch.lastServiceDate = data.lastServiceDate ? new Date(data.lastServiceDate) : null;
    if (data.isActive !== undefined) patch.isActive = !!data.isActive;
    return this.prisma.maintenancePlan.update({ where: { id }, data: patch });
  }

  deletePlan(id: string) {
    return this.prisma.maintenancePlan.update({ where: { id }, data: { isActive: false } });
  }

  // Mark serviced now — resets the cycle from current readings/date.
  async complete(id: string, data: any) {
    const plan = await this.prisma.maintenancePlan.findUnique({ where: { id }, include: { asset: true } });
    if (!plan) throw new NotFoundException('Plan not found');
    const odo = data.odometer != null && data.odometer !== '' ? Number(data.odometer) : (plan.asset as any)?.currentOdometer ?? null;
    const hrs = data.hours != null && data.hours !== '' ? Number(data.hours) : (plan.asset as any)?.currentEngineHours ?? null;
    return this.prisma.maintenancePlan.update({
      where: { id },
      data: {
        lastServiceDate: data.date ? new Date(data.date) : new Date(),
        lastServiceOdometer: odo,
        lastServiceHours: hrs,
      },
    });
  }

  updateReadings(assetId: string, data: any) {
    return this.prisma.asset.update({
      where: { id: assetId },
      data: {
        ...(data.currentOdometer !== undefined ? { currentOdometer: data.currentOdometer === '' ? null : Number(data.currentOdometer) } : {}),
        ...(data.currentEngineHours !== undefined ? { currentEngineHours: data.currentEngineHours === '' ? null : Number(data.currentEngineHours) } : {}),
      },
    });
  }
}
