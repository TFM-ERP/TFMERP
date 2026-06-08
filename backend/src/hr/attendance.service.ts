import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  private hoursBetween(inAt?: Date | null, outAt?: Date | null): number {
    if (!inAt || !outAt) return 0;
    const ms = new Date(outAt).getTime() - new Date(inAt).getTime();
    return ms > 0 ? Math.round((ms / 3600000) * 100) / 100 : 0;
  }

  async list(query: any = {}) {
    const where: any = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.from || query.to) {
      where.date = {};
      if (query.from) where.date.gte = new Date(query.from);
      if (query.to) where.date.lte = new Date(query.to);
    }
    return this.prisma.attendanceRecord.findMany({
      where,
      orderBy: { date: 'desc' },
      take: query.limit ? Number(query.limit) : 200,
    });
  }

  async clockIn(employeeId: string, at?: string) {
    const when = at ? new Date(at) : new Date();
    return this.prisma.attendanceRecord.create({
      data: { employeeId, date: when, clockIn: when, status: 'Present' },
    });
  }

  async clockOut(id: string, at?: string) {
    const rec = await this.prisma.attendanceRecord.findUnique({ where: { id } });
    const when = at ? new Date(at) : new Date();
    const hours = this.hoursBetween(rec?.clockIn, when);
    return this.prisma.attendanceRecord.update({
      where: { id },
      data: { clockOut: when, hours },
    });
  }

  /** Manual entry (HR adds a full row). */
  async create(data: any) {
    const hours =
      data.hours ?? this.hoursBetween(data.clockIn ? new Date(data.clockIn) : null, data.clockOut ? new Date(data.clockOut) : null);
    return this.prisma.attendanceRecord.create({
      data: {
        employeeId: data.employeeId,
        date: data.date ? new Date(data.date) : new Date(),
        clockIn: data.clockIn ? new Date(data.clockIn) : null,
        clockOut: data.clockOut ? new Date(data.clockOut) : null,
        hours,
        status: data.status || 'Present',
      },
    });
  }

  async remove(id: string) {
    return this.prisma.attendanceRecord.delete({ where: { id } });
  }

  /** Timesheet: total hours per employee for a month. */
  async timesheet(month: number, year: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    const records = await this.prisma.attendanceRecord.findMany({
      where: { date: { gte: start, lte: end } },
    });
    const employees = await this.prisma.employee.findMany({
      select: { id: true, displayName: true, firstName: true, lastName: true },
    });
    const map = new Map(employees.map((e) => [e.id, e]));
    const byEmp: Record<string, { employeeId: string; name: string; days: number; hours: number }> = {};
    for (const r of records) {
      const e = map.get(r.employeeId);
      const key = r.employeeId;
      if (!byEmp[key]) {
        byEmp[key] = {
          employeeId: key,
          name: e ? e.displayName || `${e.firstName} ${e.lastName || ''}`.trim() : 'Unknown',
          days: 0,
          hours: 0,
        };
      }
      if (r.status === 'Present') byEmp[key].days += 1;
      byEmp[key].hours += r.hours || 0;
    }
    return Object.values(byEmp).sort((a, b) => a.name.localeCompare(b.name));
  }
}
