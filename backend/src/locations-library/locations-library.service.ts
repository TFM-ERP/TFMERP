import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * SYS-07 — Master Location Library.
 * Standalone company asset above projects. Projects LINK to a MasterLocation via the
 * per-project Location record; usage history accretes back here.
 */
@Injectable()
export class LocationsLibraryService {
  constructor(private prisma: PrismaService) {}

  private readonly DATES = ['lastUsedAt', 'archivedAt'];
  private readonly SKIP = ['id', 'createdAt', 'updatedAt', 'media', 'usages',
    'timesUsed', 'lastUsedAt', 'totalSpentToDate', 'avgFeePerDay']; // history is system-managed

  private clean(data: any) {
    const out: any = {};
    for (const [k, v] of Object.entries(data || {})) {
      if (this.SKIP.includes(k)) continue;
      if (v === '') { out[k] = null; continue; }
      if (this.DATES.includes(k)) out[k] = v ? new Date(v as string) : null;
      else out[k] = v;
    }
    return out;
  }

  // ── Library browse / search ────────────────────────────────────────────────
  async list(q?: { search?: string; status?: string; country?: string; category?: string }) {
    const where: any = {};
    if (q?.status) where.status = q.status;
    if (q?.country) where.country = q.country;
    if (q?.category) where.category = q.category;
    if (q?.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { city: { contains: q.search, mode: 'insensitive' } },
        { region: { contains: q.search, mode: 'insensitive' } },
        { fullAddress: { contains: q.search, mode: 'insensitive' } },
        { summary: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.masterLocation.findMany({
      where,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: {
        media: { where: { isPrimary: true }, take: 1 },
        _count: { select: { usages: true, media: true } },
      },
    });
  }

  async get(id: string) {
    const loc = await this.prisma.masterLocation.findUnique({
      where: { id },
      include: {
        media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] },
        usages: {
          orderBy: { createdAt: 'desc' },
          include: { project: { select: { id: true, title: true, status: true } } },
        },
      },
    });
    if (!loc) throw new NotFoundException('Location not found in library');
    return loc;
  }

  async create(data: any, userId?: string) {
    const d = this.clean(data);
    if (!d.name) throw new BadRequestException('Name is required');
    return this.prisma.masterLocation.create({ data: { ...d, createdById: userId || null } });
  }

  async update(id: string, data: any) {
    await this.assertExists(id);
    return this.prisma.masterLocation.update({ where: { id }, data: this.clean(data) });
  }

  async archive(id: string) {
    await this.assertExists(id);
    return this.prisma.masterLocation.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
  }

  private async assertExists(id: string) {
    const e = await this.prisma.masterLocation.findUnique({ where: { id }, select: { id: true } });
    if (!e) throw new NotFoundException('Location not found in library');
  }

  // ── Media gallery ──────────────────────────────────────────────────────────
  async addMedia(id: string, body: any, userId?: string) {
    await this.assertExists(id);
    if (!body?.url) throw new BadRequestException('url is required');
    const isFirst = (await this.prisma.locationMedia.count({ where: { masterLocationId: id } })) === 0;
    return this.prisma.locationMedia.create({
      data: {
        masterLocationId: id,
        type: body.type || 'PHOTO',
        url: body.url,
        thumbnailUrl: body.thumbnailUrl || null,
        caption: body.caption || null,
        isPrimary: body.isPrimary ?? isFirst,
        sortOrder: body.sortOrder ?? 0,
        capturedAt: body.capturedAt ? new Date(body.capturedAt) : null,
        uploadedById: userId || null,
      },
    });
  }

  async setPrimaryMedia(mediaId: string) {
    const m = await this.prisma.locationMedia.findUnique({ where: { id: mediaId } });
    if (!m) throw new NotFoundException('Media not found');
    await this.prisma.locationMedia.updateMany({
      where: { masterLocationId: m.masterLocationId },
      data: { isPrimary: false },
    });
    return this.prisma.locationMedia.update({ where: { id: mediaId }, data: { isPrimary: true } });
  }

  async removeMedia(mediaId: string) {
    const m = await this.prisma.locationMedia.findUnique({ where: { id: mediaId } });
    if (!m) throw new NotFoundException('Media not found');
    return this.prisma.locationMedia.delete({ where: { id: mediaId } });
  }

  // ── Two-way integration ──────────────────────────────────────────────────
  /** Master → Project: link a library location into a project (creates a per-project Location). */
  async linkToProject(masterId: string, projectId: string, body: any = {}) {
    const master = await this.prisma.masterLocation.findUnique({ where: { id: masterId } });
    if (!master) throw new NotFoundException('Master location not found');
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new NotFoundException('Project not found');

    // avoid duplicate link of the same master into the same project
    const existing = await this.prisma.location.findFirst({ where: { projectId, masterLocationId: masterId } });
    if (existing) return existing;

    return this.prisma.location.create({
      data: {
        projectId,
        masterLocationId: masterId,
        name: master.name,
        type: master.category,
        status: 'SCOUTING',
        // copy permanent attributes through to the project usage record (denormalized snapshot)
        country: master.country,
        emirate: master.region,
        area: master.district,
        fullAddress: master.fullAddress,
        lat: master.lat,
        lng: master.lng,
        googleMapsUrl: master.googleMapsUrl,
        what3words: master.what3words,
        ownerContactName: master.ownerName,
        ownerPhone: master.ownerPhone,
        ownerEmail: master.ownerEmail,
        parkingNotes: master.parkingNotes,
        basecampNotes: master.basecampNotes,
        accessNotes: master.accessNotes,
        restrictions: master.restrictions,
        nearestHospitalName: master.nearestHospitalName,
        nearestHospitalAddress: master.nearestHospitalAddress,
        nearestHospitalPhone: master.nearestHospitalPhone,
        locationFeePerDay: master.standardFee,
        currency: master.feeCurrency || 'AED',
        permitRequired: !!master.permitAuthority,
        // per-project specifics from the caller
        scenes: body.scenes || null,
        shootStart: body.shootStart ? new Date(body.shootStart) : null,
        shootEnd: body.shootEnd ? new Date(body.shootEnd) : null,
      },
    });
  }

  /** Project → Master: promote an existing project Location into the library and link it back. */
  async promoteFromProject(locationId: string, userId?: string) {
    const loc = await this.prisma.location.findUnique({ where: { id: locationId } });
    if (!loc) throw new NotFoundException('Project location not found');
    if (loc.masterLocationId) return this.get(loc.masterLocationId); // already linked

    const master = await this.findOrCreateMaster(loc, userId);
    await this.prisma.location.update({ where: { id: locationId }, data: { masterLocationId: master.id } });
    await this.recomputeHistory(master.id);
    return this.get(master.id);
  }

  /**
   * Dedupe-aware: find a master matching name + rough geo, else create one from a project Location.
   * Used by both promoteFromProject and the migration script.
   */
  async findOrCreateMaster(loc: any, userId?: string) {
    const candidates = await this.prisma.masterLocation.findMany({
      where: { name: { equals: loc.name, mode: 'insensitive' } },
    });
    const match = candidates.find((c) => this.sameGeo(c, loc));
    if (match) return match;

    return this.prisma.masterLocation.create({
      data: {
        name: loc.name,
        category: loc.type || 'EXT',
        status: 'LIBRARY',
        country: loc.country,
        region: loc.emirate,
        district: loc.area,
        fullAddress: loc.fullAddress,
        lat: loc.lat,
        lng: loc.lng,
        googleMapsUrl: loc.googleMapsUrl,
        what3words: loc.what3words,
        accessNotes: loc.accessNotes,
        parkingNotes: loc.parkingNotes,
        basecampNotes: loc.basecampNotes,
        restrictions: loc.restrictions,
        ownerName: loc.ownerContactName,
        ownerPhone: loc.ownerPhone,
        ownerEmail: loc.ownerEmail,
        permitAuthority: loc.permitRequired ? 'See project permit' : null,
        standardFee: loc.locationFeePerDay,
        feeCurrency: loc.currency || 'AED',
        nearestHospitalName: loc.nearestHospitalName,
        nearestHospitalAddress: loc.nearestHospitalAddress,
        nearestHospitalPhone: loc.nearestHospitalPhone,
        notes: loc.notes,
        createdById: userId || null,
      },
    });
  }

  private sameGeo(a: any, b: any): boolean {
    // exact GPS within ~150m, or same region+district when no GPS
    if (a.lat && a.lng && b.lat && b.lng) {
      const dLat = Math.abs(Number(a.lat) - Number(b.lat));
      const dLng = Math.abs(Number(a.lng) - Number(b.lng));
      return dLat < 0.0015 && dLng < 0.0015;
    }
    const reg = (x: string | null) => (x || '').trim().toLowerCase();
    return reg(a.region) === reg(b.emirate ?? b.region);
  }

  /** Recompute the accreted production-history aggregates for a master location. */
  async recomputeHistory(masterId: string) {
    const usages = await this.prisma.location.findMany({
      where: { masterLocationId: masterId },
      select: { id: true, projectId: true, createdAt: true },
    });
    const projectIds = [...new Set(usages.map((u) => u.projectId))];

    // sum of posted location costs across all projects that used this master
    const txns = await this.prisma.projectTransaction.aggregate({
      where: { projectId: { in: projectIds.length ? projectIds : ['__none__'] }, category: 'Location' },
      _sum: { amount: true },
    });
    const totalSpent = Number(txns._sum.amount || 0);
    const timesUsed = projectIds.length;
    const lastUsedAt = usages.length
      ? usages.reduce((max, u) => (u.createdAt > max ? u.createdAt : max), usages[0].createdAt)
      : null;

    return this.prisma.masterLocation.update({
      where: { id: masterId },
      data: {
        timesUsed,
        lastUsedAt,
        totalSpentToDate: totalSpent,
        avgFeePerDay: null,
      },
    });
  }

  /** Library-wide stats for the module dashboard. */
  async stats() {
    const [total, byStatus, media] = await Promise.all([
      this.prisma.masterLocation.count(),
      this.prisma.masterLocation.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.locationMedia.count(),
    ]);
    return {
      total,
      media,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    };
  }

  /** Richer analytics for the map/insights view. */
  async analytics() {
    const all = await this.prisma.masterLocation.findMany({
      select: { id: true, name: true, country: true, region: true, timesUsed: true, totalSpentToDate: true, status: true, lat: true, lng: true },
    });
    const byCountry: Record<string, number> = {};
    let totalSpent = 0, withGps = 0;
    for (const l of all) {
      const c = l.country || 'Unknown';
      byCountry[c] = (byCountry[c] || 0) + 1;
      totalSpent += Number(l.totalSpentToDate || 0);
      if (l.lat && l.lng) withGps++;
    }
    const topUsed = [...all].sort((a, b) => (b.timesUsed || 0) - (a.timesUsed || 0)).slice(0, 5)
      .map((l) => ({ id: l.id, name: l.name, timesUsed: l.timesUsed, totalSpent: Number(l.totalSpentToDate || 0) }));
    return { total: all.length, totalSpent, withGps, byCountry, topUsed };
  }

  /** Compliance expiry digest — expired + expiring documents (NOC/insurance/…) and permits, both scopes. */
  async expiringCompliance(days = 30) {
    const now = new Date();
    const horizon = new Date(now.getTime() + days * 864e5);
    const nameOf = (r: any) => r.location?.name || r.masterLocation?.name || 'Location';
    const scopeOf = (r: any) => (r.location ? 'project' : 'master');
    const projOf = (r: any) => r.location?.project?.title || null;

    const [docs, permits] = await Promise.all([
      this.prisma.locationDocument.findMany({
        where: { expiryDate: { not: null, lte: horizon } },
        include: { location: { select: { name: true, project: { select: { title: true } } } }, masterLocation: { select: { name: true } } },
        orderBy: { expiryDate: 'asc' },
      }),
      this.prisma.locationPermit.findMany({
        where: { expiryDate: { not: null, lte: horizon } },
        include: { location: { select: { name: true, project: { select: { title: true } } } }, masterLocation: { select: { name: true } } },
        orderBy: { expiryDate: 'asc' },
      }),
    ]);

    const mk = (r: any, kind: string, label: string) => {
      const exp = new Date(r.expiryDate);
      const daysLeft = Math.round((exp.getTime() - now.getTime()) / 864e5);
      return { id: r.id, kind, label, scope: scopeOf(r), locationName: nameOf(r), project: projOf(r), expiryDate: r.expiryDate, daysLeft, expired: exp <= now };
    };
    const items = [
      ...docs.map((d) => mk(d, 'document', `${String(d.category).replace(/_/g, ' ')} — ${d.title}`)),
      ...permits.map((p) => mk(p, 'permit', `Permit — ${String(p.permitType || p.type || 'permit').replace(/_/g, ' ')}`)),
    ];
    const expired = items.filter((i) => i.expired).sort((a, b) => +new Date(a.expiryDate) - +new Date(b.expiryDate));
    const expiring = items.filter((i) => !i.expired).sort((a, b) => a.daysLeft - b.daysLeft);
    return { days, generatedAt: now, expired, expiring, expiredCount: expired.length, expiringCount: expiring.length };
  }

  /** Map markers — only locations that carry coordinates. */
  async mapPoints() {
    const rows = await this.prisma.masterLocation.findMany({
      where: { lat: { not: null }, lng: { not: null }, NOT: { status: 'ARCHIVED' } },
      select: { id: true, name: true, status: true, category: true, lat: true, lng: true, city: true, region: true, country: true, timesUsed: true, media: { where: { isPrimary: true }, take: 1, select: { url: true } } },
    });
    return rows.map((r) => ({
      id: r.id, name: r.name, status: r.status, category: r.category,
      lat: Number(r.lat), lng: Number(r.lng),
      area: [r.city, r.region, r.country].filter(Boolean).join(', '),
      timesUsed: r.timesUsed, thumb: r.media[0]?.url || null,
    }));
  }
}
