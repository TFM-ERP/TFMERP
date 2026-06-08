import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

// Crew lifecycle from contract dates vs today (V1.2 §5 foundation — no schema change).
// PRE_SHOOT: before start · ACTIVE: between start & end · WRAPPED: after end · UNDATED: no dates set.
function lifecycleState(start?: Date | null, end?: Date | null): 'PRE_SHOOT' | 'ACTIVE' | 'WRAPPED' | 'UNDATED' {
  if (!start && !end) return 'UNDATED';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (start && new Date(start) > today) return 'PRE_SHOOT';
  if (end) { const e = new Date(end); e.setHours(0, 0, 0, 0); if (e < today) return 'WRAPPED'; }
  return 'ACTIVE';
}

@Injectable()
export class CrewService {
  constructor(private prisma: PrismaService) {}

  async findByProject(projectId: string, requestUserId?: string) {
    const rows = await this.prisma.productionCrew.findMany({
      where: { projectId },
      include: {
        crewMember: {
          select: {
            id: true, name: true, department: true, role: true, nationality: true,
            isLocal: true, email: true, phone: true, photoUrl: true,
            dayRateAed: true, dayRateUsd: true, iban: true, swiftCode: true,
          },
        },
      },
      orderBy: { role: 'asc' },
    });
    // ── Field-level security (V1.2 §2): hide pay/PII per the requester's project role ──
    const hidden = await this.hiddenFieldsFor(projectId, requestUserId);
    return rows.map((r) => {
      const out: any = { ...r, lifecycleState: lifecycleState(r.startDate, r.endDate) };
      if (hidden.length) {
        const cm: any = { ...r.crewMember };
        for (const f of hidden) { if (f in cm) cm[f] = null; }
        out.crewMember = cm;
        if (hidden.includes('dayRateAed')) { out.dailyRate = null; out.weeklyRate = null; }
      }
      return out;
    });
  }

  /** Workforce lifecycle summary for a project (counts + the wrapped/upcoming lists). */
  async workforceStatus(projectId: string) {
    const rows = await this.prisma.productionCrew.findMany({
      where: { projectId },
      select: { id: true, name: true, role: true, startDate: true, endDate: true },
      orderBy: { startDate: 'asc' },
    });
    const counts: Record<string, number> = { PRE_SHOOT: 0, ACTIVE: 0, WRAPPED: 0, UNDATED: 0 };
    const people = rows.map((r) => {
      const state = lifecycleState(r.startDate, r.endDate);
      counts[state]++;
      return { id: r.id, name: r.name, role: r.role, startDate: r.startDate, endDate: r.endDate, lifecycleState: state };
    });
    return { counts, total: rows.length, people };
  }

  /** The field keys this requester's per-project role hides (empty = sees everything). */
  private async hiddenFieldsFor(projectId: string, userId?: string): Promise<string[]> {
    if (!userId) return [];
    const a = await this.prisma.projectRoleAssignment.findUnique({
      where: { projectId_userId: { projectId, userId } },
      include: { template: { select: { fieldLevelAccess: true } } },
    });
    return ((a?.template?.fieldLevelAccess as any) || []) as string[];
  }

  private clean(data: any) {
    const DATE_FIELDS = ['startDate', 'endDate'];
    const out: any = { ...data };
    delete out.projectId; delete out.id; delete out.crewMember; delete out.createdAt;
    // costTreatment is a controlled field — only the guarded override can change it.
    delete out.costTreatment;
    for (const f of DATE_FIELDS) {
      if (out[f] !== undefined) out[f] = out[f] ? new Date(out[f]) : null;
    }
    return out;
  }

  /**
   * Cost-treatment override (Team & Access). A crew member set to COMPANY_OVERHEAD is hard-blocked
   * from project payment (payroll guard). Only a Producer / Line Producer on that project may flip
   * the treatment — surfaced on the crew detail page.
   */
  async setCostTreatment(crewId: string, treatment: string, userId?: string) {
    const VALID = ['PROJECT_HIRE', 'COMPANY_OVERHEAD'];
    if (!VALID.includes(treatment)) throw new BadRequestException('Invalid cost treatment.');
    const crew = await this.prisma.productionCrew.findUnique({ where: { id: crewId }, select: { id: true, projectId: true } });
    if (!crew) throw new NotFoundException('Crew assignment not found.');
    if (!(await this.isProducer(crew.projectId, userId))) {
      throw new ForbiddenException('Only a Producer or Line Producer can change a crew member’s cost treatment.');
    }
    return this.prisma.productionCrew.update({ where: { id: crewId }, data: { costTreatment: treatment } });
  }

  /** True if the user holds a Producer / Line Producer project role on this project. */
  private async isProducer(projectId: string, userId?: string): Promise<boolean> {
    if (!userId) return false;
    const a = await this.prisma.projectRoleAssignment.findUnique({
      where: { projectId_userId: { projectId, userId } },
      include: { template: { select: { name: true, key: true } } },
    });
    const tag = `${a?.template?.key || ''} ${a?.template?.name || ''}`.toLowerCase();
    return tag.includes('producer'); // covers PRODUCER / LINE_PRODUCER (key or name)
  }

  async create(data: {
    projectId: string; name?: string; role?: any; crewMemberId?: string;
    isInternal?: boolean; userId?: string;
    email?: string; mobile?: string;
    startDate?: string; endDate?: string; location?: string;
    dailyRate?: number; weeklyRate?: number;
    totalDays?: number; totalPaid?: number; notes?: string;
    dealMemoStatus?: string; ndaStatus?: string; dealMemoUrl?: string; contractUrl?: string;
  }) {
    // If linked to the directory, prefill from the crew member where blank
    if (data.crewMemberId) {
      const m = await this.prisma.crewMember.findUnique({ where: { id: data.crewMemberId } });
      if (m) {
        data.name = data.name || m.name;
        data.email = data.email || m.email || undefined;
        data.mobile = data.mobile || m.phone || undefined;
        (data as any).department = (data as any).department || m.department || undefined;
        (data as any).roleTitle = (data as any).roleTitle || m.role || undefined;
        if (data.dailyRate === undefined && m.dayRateAed != null) data.dailyRate = Number(m.dayRateAed);
        if (data.weeklyRate === undefined && m.weeklyRateAed != null) data.weeklyRate = Number(m.weeklyRateAed);
      }
    }
    if (!data.name) data.name = 'Unnamed';
    // clean() strips projectId (it's shared with update, where projectId must never
    // change) — re-attach it here, create requires the FK.
    return this.prisma.productionCrew.create({ data: { ...this.clean(data), projectId: data.projectId } });
  }

  async findAssignment(id: string) {
    return this.prisma.productionCrew.findUnique({
      where: { id },
      include: {
        crewMember: true,
        project: { select: { id: true, title: true, projectNumber: true, projectType: true } },
      },
    });
  }

  async update(id: string, data: any) {
    return this.prisma.productionCrew.update({ where: { id }, data: this.clean(data) });
  }

  async remove(id: string) {
    return this.prisma.productionCrew.delete({ where: { id } });
  }

  // ── Schedule ──────────────────────────────────────────────────────────────

  async getSchedule(projectId: string) {
    return this.prisma.productionSchedule.findMany({
      where: { projectId },
      orderBy: { dayNumber: 'asc' },
    });
  }

  async upsertScheduleDay(projectId: string, data: {
    dayNumber: number; date: string;
    location?: string; callTime?: string; wrapTime?: string;
    scenes?: string; notes?: string;
  }) {
    return this.prisma.productionSchedule.upsert({
      where: { id: `${projectId}_${data.dayNumber}` }, // won't match, forces create
      update: { ...data, date: new Date(data.date) },
      create: { projectId, ...data, date: new Date(data.date) },
    });
  }

  async createScheduleDay(projectId: string, data: any) {
    return this.prisma.productionSchedule.create({
      data: { projectId, ...data, date: new Date(data.date) },
    });
  }

  async updateScheduleDay(dayId: string, data: any) {
    return this.prisma.productionSchedule.update({
      where: { id: dayId },
      data: { ...data, ...(data.date && { date: new Date(data.date) }) },
    });
  }

  async deleteScheduleDay(dayId: string) {
    return this.prisma.productionSchedule.delete({ where: { id: dayId } });
  }
}
