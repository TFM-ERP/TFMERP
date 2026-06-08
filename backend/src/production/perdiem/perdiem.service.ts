import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PerDiemService {
  constructor(private prisma: PrismaService) {}

  async list(projectId: string) {
    const items = await this.prisma.perDiem.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    const totals = { all: 0, PENDING: 0, APPROVED: 0, PAID: 0 } as Record<string, number>;
    for (const p of items) {
      const t = Number(p.total);
      totals.all += t;
      totals[p.status] += t;
    }
    return { items, totals };
  }

  private compute(rate: any, days: any) {
    return (Number(rate) || 0) * (Number(days) || 0);
  }

  async create(data: {
    projectId: string; assignmentId?: string; crewName?: string; location?: string;
    ratePerDay?: number; days?: number; currency?: string;
    startDate?: string; endDate?: string; notes?: string; status?: any;
  }, userId?: string) {
    // Pull crew name / location from the assignment when linked
    if (data.assignmentId && !data.crewName) {
      const a = await this.prisma.productionCrew.findUnique({ where: { id: data.assignmentId } });
      if (a) { data.crewName = a.name; data.location = data.location || a.location || undefined; }
    }
    const total = this.compute(data.ratePerDay, data.days);
    return this.prisma.perDiem.create({
      data: {
        projectId: data.projectId,
        assignmentId: data.assignmentId || null,
        crewName: data.crewName || 'Unnamed',
        location: data.location || null,
        ratePerDay: data.ratePerDay ?? 0,
        days: data.days ?? 1,
        currency: (data.currency as any) || 'AED',
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        total,
        status: data.status || 'PENDING',
        notes: data.notes || null,
        createdById: userId || null,
      },
    });
  }

  async update(id: string, data: any) {
    const existing = await this.prisma.perDiem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Per diem not found');
    const rate = data.ratePerDay !== undefined ? data.ratePerDay : Number(existing.ratePerDay);
    const days = data.days !== undefined ? data.days : existing.days;
    const { id: _i, projectId, assignment, createdAt, updatedAt, ...rest } = data || {};
    return this.prisma.perDiem.update({
      where: { id },
      data: {
        ...rest,
        ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
        ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
        total: this.compute(rate, days),
      },
    });
  }

  async setStatus(id: string, status: string) {
    return this.prisma.perDiem.update({ where: { id }, data: { status: status as any } });
  }

  /** Generate per-diem entries from the stripboard's Day-Out-of-Days (cast work days). */
  async generateFromSchedule(projectId: string, data: { ratePerDay?: number; location?: string }, userId?: string) {
    const strips = await this.prisma.productionStrip.findMany({ where: { projectId, shootDay: { gt: 0 } } });
    const workDays: Record<string, Set<number>> = {};
    for (const s of strips) {
      const cast: string[] = Array.isArray(s.cast) ? (s.cast as any) : [];
      for (const n of cast) if (n) (workDays[n] = workDays[n] || new Set()).add(s.shootDay);
    }
    const rate = Number(data.ratePerDay) || 0;
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId } });
    const names = Object.keys(workDays);
    let created = 0;
    for (const name of names) {
      const days = workDays[name].size;
      await this.prisma.perDiem.create({
        data: {
          projectId, crewName: name, location: data.location || null,
          ratePerDay: rate, days, currency: (project?.currency as any) || 'AED',
          total: rate * days, status: 'PENDING', notes: 'Generated from schedule (DOOD)', createdById: userId || null,
        },
      });
      created++;
    }
    return { created };
  }

  async remove(id: string) {
    return this.prisma.perDiem.delete({ where: { id } });
  }
}
