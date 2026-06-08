import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ENGAGED_STATUSES } from '../casting/pipeline';

/**
 * SYS-12.A — Accommodation master + assignment.
 * Properties + room inventory + assignments. The person is always a
 * TravelerProfile (the universal identity), so the same screens serve talent,
 * crew, accompanying, consultants and VIPs. Reuses the V2-A `accommodationRequired`
 * flag and the deal-memo `accommodationTier`.
 */
@Injectable()
export class AccommodationService {
  constructor(private prisma: PrismaService) {}

  // ── Properties ───────────────────────────────────────────────────────────────
  listProperties(query: { type?: string; q?: string } = {}) {
    const where: any = { isActive: true };
    if (query.type) where.type = query.type;
    if (query.q) where.name = { contains: query.q, mode: 'insensitive' };
    return this.prisma.accommodationProperty.findMany({
      where, orderBy: { name: 'asc' },
      include: { supplier: { select: { name: true, ranking: true } }, _count: { select: { rooms: true, assignments: true } } },
    });
  }
  getProperty(id: string) {
    return this.prisma.accommodationProperty.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, ranking: true } },
        rooms: { orderBy: { roomNumber: 'asc' }, include: { _count: { select: { assignments: true } } } },
      },
    });
  }
  createProperty(d: any) {
    if (!d?.name) throw new BadRequestException('name is required');
    return this.prisma.accommodationProperty.create({ data: this.cleanProperty(d) });
  }
  updateProperty(id: string, d: any) { return this.prisma.accommodationProperty.update({ where: { id }, data: this.cleanProperty(d, true) }); }
  removeProperty(id: string) { return this.prisma.accommodationProperty.update({ where: { id }, data: { isActive: false } }); }
  private cleanProperty(d: any, partial = false) {
    const out: any = {
      name: d.name, type: d.type ?? undefined, supplierId: d.supplierId ?? null,
      address: d.address ?? null, city: d.city ?? null, country: d.country ?? undefined, gpsCoordinates: d.gpsCoordinates ?? null,
      contactName: d.contactName ?? null, contactPhone: d.contactPhone ?? null, contactEmail: d.contactEmail ?? null, notes: d.notes ?? null,
    };
    if (partial) Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
    return out;
  }

  // ── Rooms ────────────────────────────────────────────────────────────────────
  addRoom(propertyId: string, d: any) {
    if (!d?.roomNumber) throw new BadRequestException('roomNumber is required');
    return this.prisma.roomInventory.create({ data: { propertyId, ...this.cleanRoom(d) } });
  }
  updateRoom(id: string, d: any) { return this.prisma.roomInventory.update({ where: { id }, data: this.cleanRoom(d, true) }); }
  removeRoom(id: string) { return this.prisma.roomInventory.delete({ where: { id } }); }
  private cleanRoom(d: any, partial = false) {
    const out: any = {
      roomNumber: d.roomNumber, type: d.type ?? undefined, capacity: d.capacity != null ? Number(d.capacity) : undefined,
      nightlyRate: d.nightlyRate != null && d.nightlyRate !== '' ? Number(d.nightlyRate) : null,
      currency: d.currency ?? undefined, status: d.status ?? undefined, notes: d.notes ?? null,
    };
    if (partial) Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
    return out;
  }

  // ── Assignments ──────────────────────────────────────────────────────────────
  listAssignments(query: { projectId?: string; scope?: string } = {}) {
    const where: any = {};
    if (query.projectId) where.projectId = query.projectId;
    else if (query.scope === 'standalone') where.projectId = null;
    return this.prisma.accommodationAssignment.findMany({
      where, orderBy: { checkIn: 'asc' },
      include: {
        traveler: { select: { id: true, fullName: true, personType: true, nationality: true } },
        property: { select: { name: true, type: true } },
        room: { select: { roomNumber: true, type: true } },
        project: { select: { title: true } },
      },
    });
  }
  async createAssignment(d: any, userId?: string) {
    if (!d?.travelerId) throw new BadRequestException('travelerId is required');
    const a = await this.prisma.accommodationAssignment.create({
      data: {
        travelerId: d.travelerId, propertyId: d.propertyId || null, roomId: d.roomId || null, projectId: d.projectId || null,
        accommodationClass: d.accommodationClass || 'STANDARD', status: d.status || 'RESERVED',
        checkIn: d.checkIn ? new Date(d.checkIn) : null, checkOut: d.checkOut ? new Date(d.checkOut) : null,
        notes: d.notes || null, createdById: userId || null,
      },
    });
    if (a.roomId) await this.prisma.roomInventory.update({ where: { id: a.roomId }, data: { status: 'OCCUPIED' } });
    return a;
  }
  async updateAssignment(id: string, d: any) {
    const cur = await this.prisma.accommodationAssignment.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException();
    const data: any = {};
    for (const k of ['propertyId', 'roomId', 'accommodationClass', 'status', 'notes']) if (d[k] !== undefined) data[k] = d[k] || null;
    for (const k of ['checkIn', 'checkOut']) if (d[k] !== undefined) data[k] = d[k] ? new Date(d[k]) : null;
    const a = await this.prisma.accommodationAssignment.update({ where: { id }, data });
    // keep room status in sync
    if (a.roomId) {
      const free = ['CHECKED_OUT', 'CANCELLED'].includes(a.status);
      await this.prisma.roomInventory.update({ where: { id: a.roomId }, data: { status: free ? 'AVAILABLE' : 'OCCUPIED' } });
    }
    return a;
  }
  async removeAssignment(id: string) {
    const a = await this.prisma.accommodationAssignment.findUnique({ where: { id } });
    if (a?.roomId) await this.prisma.roomInventory.update({ where: { id: a.roomId }, data: { status: 'AVAILABLE' } });
    return this.prisma.accommodationAssignment.delete({ where: { id } });
  }

  // ── Smart: who needs accommodation for a project (from V2-A flag) ────────────
  async needsAccommodation(projectId: string) {
    if (!projectId) throw new BadRequestException('projectId is required');
    const list = await this.prisma.travelerProfile.findMany({
      where: {
        accommodationRequired: true,
        accommodationAssignments: { none: { projectId } },
        OR: [
          { trips: { some: { projectId } } },
          { talentProfile: { submissions: { some: { status: { in: ENGAGED_STATUSES as any }, castingCall: { projectId } } } } },
        ],
      },
      select: { id: true, fullName: true, personType: true, nationality: true, homeCity: true, talentProfileId: true },
      orderBy: { fullName: 'asc' },
    });
    // Suggest a class from the talent's deal-memo negotiation tier (SYS-10 V2.0 §7).
    const VALID = ['STANDARD', 'BUSINESS', 'EXECUTIVE', 'VIP', 'ULTRA_VIP'];
    const out: any[] = [];
    for (const t of list) {
      let suggestedClass: string | null = null;
      if (t.talentProfileId) {
        const neg = await this.prisma.talentNegotiation.findFirst({ where: { submission: { talentId: t.talentProfileId, castingCall: { projectId } } }, select: { accommodationTier: true } });
        const tier = (neg?.accommodationTier || '').toUpperCase().replace(/ /g, '_');
        if (VALID.includes(tier)) suggestedClass = tier;
      }
      out.push({ ...t, suggestedClass });
    }
    return out;
  }

  /** Rooming list + simple occupancy summary for a project. */
  async roomingList(projectId: string) {
    const assignments = await this.listAssignments({ projectId });
    const byStatus: Record<string, number> = {};
    for (const a of assignments as any[]) byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    return { assignments, byStatus };
  }
}
