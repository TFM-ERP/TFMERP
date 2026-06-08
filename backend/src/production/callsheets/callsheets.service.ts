import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SunPathService } from '../locations/sun-path.service';

const ROLE_LABEL: Record<string, string> = {
  DIRECTOR: 'Director', DOP: 'Director of Photography', PRODUCER: 'Producer',
  LINE_PRODUCER: 'Line Producer', ASSISTANT_DIRECTOR: '1st Assistant Director',
  CAMERA_OPERATOR: 'Camera Operator', GAFFER: 'Gaffer', GRIP: 'Grip', SOUND: 'Sound',
  ART_DIRECTOR: 'Art Director', EDITOR: 'Editor', COLORIST: 'Colorist',
  VFX_ARTIST: 'VFX Artist', PRODUCTION_COORDINATOR: 'Production Coordinator',
  DRIVER: 'Driver', OTHER: 'Crew',
};
const DEPT_OF: Record<string, string> = {
  DIRECTOR: 'Direction', ASSISTANT_DIRECTOR: 'Direction', PRODUCTION_COORDINATOR: 'Production',
  PRODUCER: 'Production', LINE_PRODUCER: 'Production',
  DOP: 'Camera', CAMERA_OPERATOR: 'Camera',
  GAFFER: 'Lighting', GRIP: 'Grip', SOUND: 'Sound',
  ART_DIRECTOR: 'Art', EDITOR: 'Post', COLORIST: 'Post', VFX_ARTIST: 'Post',
  DRIVER: 'Transport', OTHER: 'Crew',
};
const KEY_ROLES = ['DIRECTOR', 'PRODUCER', 'LINE_PRODUCER', 'ASSISTANT_DIRECTOR', 'DOP', 'PRODUCTION_COORDINATOR'];

@Injectable()
export class CallSheetsService {
  constructor(private prisma: PrismaService, private sunPath: SunPathService) {}

  /**
   * SYS-07 V2 · Slice 7 — autofill the call sheet's daylight block from its linked location's
   * coordinates + shoot date (sunrise/sunset/golden hour). No-op-safe if no coords.
   */
  async autofillDaylight(id: string, tzMin = 240) {
    const cs = await this.prisma.callSheet.findUnique({ where: { id } });
    if (!cs) throw new NotFoundException('Call sheet not found');
    if (!cs.locationId) throw new BadRequestException('Link a location to this call sheet first.');
    const loc = await this.prisma.location.findUnique({ where: { id: cs.locationId }, select: { lat: true, lng: true } });
    if (!loc || loc.lat == null || loc.lng == null) throw new BadRequestException('The linked location has no coordinates to compute sun-path.');
    const sun = this.sunPath.compute(Number(loc.lat), Number(loc.lng), cs.shootDate.toISOString(), tzMin);
    return this.prisma.callSheet.update({
      where: { id },
      data: { sunrise: sun.sunrise, sunset: sun.sunset, goldenHourAm: sun.goldenHourAm, goldenHourPm: sun.goldenHourPm },
    });
  }

  async list(projectId: string) {
    return this.prisma.callSheet.findMany({
      where: { projectId },
      orderBy: [{ shootDate: 'asc' }, { dayNumber: 'asc' }],
    });
  }

  async findOne(id: string) {
    const cs = await this.prisma.callSheet.findUnique({
      where: { id },
      include: { project: { select: { id: true, title: true, projectNumber: true, projectType: true } } },
    });
    if (!cs) throw new NotFoundException(`Call sheet ${id} not found`);
    return cs;
  }

  /** Create a call sheet, pre-seeding contacts & crew calls from the project crew. */
  async create(data: { projectId: string; dayNumber?: number; shootDate: string; generalCall?: string }, userId?: string) {
    const project = await this.prisma.productionProject.findUnique({
      where: { id: data.projectId },
      include: { crew: true, schedules: { orderBy: { dayNumber: 'asc' } } },
    });
    if (!project) throw new NotFoundException('Project not found');

    const existing = await this.prisma.callSheet.count({ where: { projectId: data.projectId } });
    const dayNumber = data.dayNumber ?? existing + 1;
    const totalDays = project.schedules.length || null;

    // Seed key contacts from key crew roles
    const keyContacts = project.crew
      .filter(c => KEY_ROLES.includes(c.role))
      .sort((a, b) => KEY_ROLES.indexOf(a.role) - KEY_ROLES.indexOf(b.role))
      .map(c => ({ role: ROLE_LABEL[c.role] || c.role, name: c.name, phone: c.mobile || '' }));

    // Seed crew calls from all crew, grouped by department
    const crewCalls = project.crew.map(c => ({
      department: DEPT_OF[c.role] || 'Crew',
      name: c.name,
      role: ROLE_LABEL[c.role] || c.role,
      callTime: data.generalCall || '',
    }));

    // Try to pull location/scenes from a matching schedule day
    const sched = project.schedules.find(s => s.dayNumber === dayNumber);

    return this.prisma.callSheet.create({
      data: {
        projectId: data.projectId,
        dayNumber,
        totalDays,
        shootDate: new Date(data.shootDate),
        generalCall: data.generalCall || sched?.callTime || null,
        estWrap: sched?.wrapTime || null,
        locationName: sched?.location || null,
        keyContacts,
        crewCalls,
        scheduleItems: sched?.scenes ? [{ time: sched.callTime || '', scene: '', intExt: '', description: sched.scenes, pages: '', cast: '', location: sched.location || '' }] : [],
        castCalls: [],
        backgroundCalls: [],
        advanceSchedule: [],
        createdById: userId || null,
      },
    });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    const { project, projectId, id: _id, createdAt, updatedAt, ...rest } = data || {};
    return this.prisma.callSheet.update({
      where: { id },
      data: {
        ...rest,
        ...(data.shootDate && { shootDate: new Date(data.shootDate) }),
      },
    });
  }

  private pagesLabel(p: number) {
    const whole = Math.floor(p); const e = Math.round((p - whole) * 8);
    return `${whole || (e ? '' : '0')}${e ? ` ${e}/8` : ''}`.trim() || '0';
  }

  /** Pull scenes + cast for this call sheet's shoot day from the stripboard. */
  async pullFromSchedule(id: string) {
    const cs = await this.prisma.callSheet.findUnique({ where: { id } });
    if (!cs) throw new NotFoundException('Call sheet not found');
    const strips = await this.prisma.productionStrip.findMany({
      where: { projectId: cs.projectId, shootDay: cs.dayNumber },
      orderBy: { sortOrder: 'asc' },
    });

    const scheduleItems = strips.map(s => ({
      time: '', scene: s.sceneNumber || '', intExt: String(s.intExt).replace('_', '/'),
      description: [s.setName, s.description].filter(Boolean).join(' — '),
      pages: this.pagesLabel(Number(s.pages)),
      cast: (Array.isArray(s.cast) ? (s.cast as any[]) : []).join(', '),
      location: s.location || s.setName || '',
    }));

    // distinct cast across the day's strips, preserving any existing call times
    const order: string[] = [];
    for (const s of strips) for (const n of (Array.isArray(s.cast) ? (s.cast as any[]) : [])) if (n && !order.includes(n)) order.push(n);
    const existing: any[] = Array.isArray(cs.castCalls) ? (cs.castCalls as any[]) : [];
    const byName: Record<string, any> = {};
    for (const c of existing) if (c?.cast) byName[c.cast] = c;
    const castCalls = order.map(n => byName[n] || { cast: n, character: '', callTime: cs.generalCall || '', hmw: '', onSet: '', remarks: '' });

    return this.prisma.callSheet.update({ where: { id }, data: { scheduleItems, castCalls } });
  }

  async publish(id: string) {
    await this.findOne(id);
    return this.prisma.callSheet.update({ where: { id }, data: { status: 'PUBLISHED' } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.callSheet.delete({ where: { id } });
  }
}
