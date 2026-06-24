import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { pagesToEighthsLabel } from '../pages.util';
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

  /** SYS-LOC V2 — pull address/map/parking/basecamp/hospital + daylight from the linked
   *  (or name-matched) Location into an existing call sheet. */
  async autofillLocation(id: string, tzMin = 240) {
    const cs = await this.prisma.callSheet.findUnique({ where: { id } });
    if (!cs) throw new NotFoundException('Call sheet not found');
    let loc = cs.locationId ? await this.prisma.location.findUnique({ where: { id: cs.locationId } }) : null;
    if (!loc && cs.locationName) loc = await this.prisma.location.findFirst({ where: { projectId: cs.projectId, name: { equals: cs.locationName, mode: 'insensitive' } } });
    if (!loc) throw new BadRequestException('No matching location found. Set the location name or link a location first.');
    const data: any = {
      locationId: loc.id,
      locationAddress: loc.fullAddress || null,
      locationMapUrl: loc.googleMapsUrl || null,
      parkingNotes: loc.parkingNotes || null,
      basecampNotes: loc.basecampNotes || null,
      hospitalName: loc.nearestHospitalName || null,
      hospitalAddress: loc.nearestHospitalAddress || null,
      hospitalPhone: loc.nearestHospitalPhone || null,
    };
    if (loc.lat != null && loc.lng != null) {
      try {
        const sun = this.sunPath.compute(Number(loc.lat), Number(loc.lng), cs.shootDate.toISOString(), tzMin);
        data.sunrise = sun.sunrise; data.sunset = sun.sunset; data.goldenHourAm = sun.goldenHourAm; data.goldenHourPm = sun.goldenHourPm;
      } catch { /* sun-path optional */ }
    }
    return this.prisma.callSheet.update({ where: { id }, data });
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
    return { ...cs, ...((cs as any).extra || {}) };
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

    // SYS-LOC V2 — resolve the day's location string to a linked Location record and
    // auto-fill the call sheet's location + safety + daylight block (only what's available).
    let locExtra: any = {};
    if (sched?.location) {
      const loc = await this.prisma.location.findFirst({
        where: { projectId: data.projectId, name: { equals: sched.location, mode: 'insensitive' } },
      });
      if (loc) {
        locExtra = {
          locationId: loc.id,
          locationAddress: loc.fullAddress || null,
          locationMapUrl: loc.googleMapsUrl || null,
          parkingNotes: loc.parkingNotes || null,
          basecampNotes: loc.basecampNotes || null,
          hospitalName: loc.nearestHospitalName || null,
          hospitalAddress: loc.nearestHospitalAddress || null,
          hospitalPhone: loc.nearestHospitalPhone || null,
        };
        if (loc.lat != null && loc.lng != null) {
          try {
            const sun = this.sunPath.compute(Number(loc.lat), Number(loc.lng), new Date(data.shootDate).toISOString(), 240);
            locExtra.sunrise = sun.sunrise; locExtra.sunset = sun.sunset;
            locExtra.goldenHourAm = sun.goldenHourAm; locExtra.goldenHourPm = sun.goldenHourPm;
          } catch { /* sun-path optional */ }
        }
      }
    }

    return this.prisma.callSheet.create({
      data: {
        projectId: data.projectId,
        dayNumber,
        totalDays,
        shootDate: new Date(data.shootDate),
        generalCall: data.generalCall || sched?.callTime || null,
        estWrap: sched?.wrapTime || null,
        locationName: sched?.location || null,
        ...locExtra,
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

  private static CS_COLS = new Set(['dayNumber','totalDays','shootDate','status','generalCall','shootingCall','estWrap','weather','tempHigh','tempLow','sunrise','sunset','goldenHourAm','goldenHourPm','locationId','locationName','locationAddress','locationMapUrl','parkingNotes','basecampNotes','hospitalName','hospitalAddress','hospitalPhone','keyContacts','scheduleItems','castCalls','backgroundCalls','crewCalls','advanceSchedule','notes','safetyNotes']);
  async update(id: string, data: any) {
    const cur = await this.prisma.callSheet.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException(`Call sheet ${id} not found`);
    const { project, projectId, id: _id, createdAt, updatedAt, extra: incomingExtra, ...rest } = data || {};
    const real: any = {}; const extra: any = { ...(((cur as any).extra) || {}), ...(incomingExtra || {}) };
    for (const [k, v] of Object.entries(rest)) { if (CallSheetsService.CS_COLS.has(k)) real[k] = v; else extra[k] = v; }
    if (real.shootDate) real.shootDate = new Date(real.shootDate);
    try {
      return await this.prisma.callSheet.update({ where: { id }, data: { ...real, extra } as any });
    } catch {
      // `extra` column may not exist yet (before db:push) — persist real columns only
      return this.prisma.callSheet.update({ where: { id }, data: real });
    }
  }

  private pagesLabel(p: number) { return pagesToEighthsLabel(p); }

  /** Get From Schedule — pull everything available for this shoot day: scenes, cast, crew,
   *  advance (next day), the linked location + sun-path + weather + a suggested hospital.
   *  Only fills empty fields for manual-ish data (location/hospital/sun/weather) so user
   *  overrides persist; replaces schedule rows and merges cast/crew by name. */
  async pullFromSchedule(id: string) {
    const cs = await this.prisma.callSheet.findUnique({ where: { id } });
    if (!cs) throw new NotFoundException('Call sheet not found');
    const strips = await this.prisma.productionStrip.findMany({ where: { projectId: cs.projectId, shootDay: cs.dayNumber }, orderBy: { sortOrder: 'asc' } });

    const scheduleItems = strips.map(s => ({
      time: '', scene: s.sceneNumber || '', intExt: String(s.intExt).replace('_', '/'),
      description: [s.setName, s.description].filter(Boolean).join(' — '),
      pages: this.pagesLabel(Number(s.pages)),
      cast: (Array.isArray(s.cast) ? (s.cast as any[]) : []).join(', '),
      location: s.location || s.setName || '',
    }));

    // distinct cast across the day's strips, preserving existing call times
    const order: string[] = [];
    for (const s of strips) for (const n of (Array.isArray(s.cast) ? (s.cast as any[]) : [])) if (n && !order.includes(n)) order.push(n);
    const existing: any[] = Array.isArray(cs.castCalls) ? (cs.castCalls as any[]) : [];
    const byName: Record<string, any> = {};
    for (const c of existing) if (c?.cast) byName[c.cast] = c;
    const castCalls = order.map(n => byName[n] || { cast: n, character: '', callTime: cs.generalCall || '', hmw: '', onSet: '', remarks: '' });

    const data: any = { scheduleItems, castCalls };

    // advance schedule = next day's strips
    const next = await this.prisma.productionStrip.findMany({ where: { projectId: cs.projectId, shootDay: cs.dayNumber + 1 }, orderBy: { sortOrder: 'asc' } });
    if (next.length) data.advanceSchedule = next.map(s => ({ time: '', scene: s.sceneNumber || '', description: [s.setName, s.description].filter(Boolean).join(' — '), location: s.location || s.setName || '' }));

    // crew — refresh from project crew, preserving any per-name call times
    const project = await this.prisma.productionProject.findUnique({ where: { id: cs.projectId }, include: { crew: true } });
    if (project?.crew?.length) {
      const ct: Record<string, string> = {}; for (const c of (Array.isArray(cs.crewCalls) ? cs.crewCalls as any[] : [])) if (c?.name) ct[c.name] = c.callTime || '';
      data.crewCalls = project.crew.map((c: any) => ({ department: DEPT_OF[c.role] || 'Crew', name: c.name, role: ROLE_LABEL[c.role] || c.role, callTime: ct[c.name] || cs.generalCall || '' }));
    }

    // resolve the day's location → fill empty location/hospital/sun/weather (overrides preserved)
    let loc = cs.locationId ? await this.prisma.location.findUnique({ where: { id: cs.locationId } }) : null;
    if (!loc) {
      const nm = strips.map(s => s.location || s.setName).find(Boolean) || cs.locationName;
      if (nm) loc = await this.prisma.location.findFirst({ where: { projectId: cs.projectId, name: { equals: nm, mode: 'insensitive' } } });
    }
    let extraHospitalAlt: any = null;
    if (loc) {
      data.locationId = loc.id;
      if (!cs.locationName) data.locationName = loc.name;
      if (!cs.locationAddress) data.locationAddress = loc.fullAddress || null;
      if (!cs.locationMapUrl) data.locationMapUrl = loc.googleMapsUrl || null;
      if (!cs.parkingNotes) data.parkingNotes = loc.parkingNotes || null;
      if (!cs.basecampNotes) data.basecampNotes = loc.basecampNotes || null;
      if (!cs.hospitalName && loc.nearestHospitalName) { data.hospitalName = loc.nearestHospitalName; data.hospitalAddress = loc.nearestHospitalAddress; data.hospitalPhone = loc.nearestHospitalPhone; }
      if (loc.lat != null && loc.lng != null) {
        const lat = Number(loc.lat), lng = Number(loc.lng), iso = cs.shootDate.toISOString();
        try { const sun = this.sunPath.compute(lat, lng, iso, 240); if (!cs.sunrise) data.sunrise = sun.sunrise; if (!cs.sunset) data.sunset = sun.sunset; if (!cs.goldenHourAm) data.goldenHourAm = sun.goldenHourAm; if (!cs.goldenHourPm) data.goldenHourPm = sun.goldenHourPm; } catch { /* optional */ }
        try { if (!cs.weather || !cs.tempHigh) { const w: any = await this.sunPath.weatherForecast(lat, lng, iso, 240); if (w?.ok) { if (!cs.weather) data.weather = w.summary; if (!cs.tempHigh) data.tempHigh = `${w.tempHigh}\u00b0C`; if (!cs.tempLow) data.tempLow = `${w.tempLow}\u00b0C`; } } } catch { /* optional */ }
        if (!data.hospitalName && !cs.hospitalName) {
          try { const h: any = await this.sunPath.hospitalsNear(lat, lng); const items = h?.items || []; if (items[0]) { data.hospitalName = items[0].name; data.hospitalAddress = items[0].address; data.hospitalPhone = items[0].phone; } if (items[1]) extraHospitalAlt = { name: items[1].name, address: items[1].address, phone: items[1].phone }; } catch { /* optional */ }
        }
      }
    }

    try {
      const merged = { ...(((cs as any).extra) || {}), ...(extraHospitalAlt ? { hospitalAlt: extraHospitalAlt } : {}) };
      return await this.prisma.callSheet.update({ where: { id }, data: { ...data, extra: merged } as any });
    } catch {
      return this.prisma.callSheet.update({ where: { id }, data });
    }
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
