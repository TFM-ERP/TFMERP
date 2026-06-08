import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { WorkflowService } from '../../workflow/workflow.service';
import { AmadeusService } from './integrations/amadeus.service';
import { ConcurService } from './integrations/concur.service';
import { PermissionsService } from '../../permissions/permissions.service';

// ── Visa SLA rules (hardcoded from the Executive Summary) ────────────────────
// slaDays = published processing window for the route. exempt = nationalities
// that need NO visa for that destination (own country + obvious visa-free blocs).
const SCHENGEN = ['AT','BE','HR','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','SK','SI','ES','SE','CH'];
const GCC = ['AE','SA','BH','KW','OM','QA'];
const EU_EEA = [...SCHENGEN, 'IE','RO','BG','CY'];

type VisaRule = { visaType: string; slaDays: number; exempt: string[] };
const VISA_RULES: Record<string, VisaRule> = {
  US: { visaType: 'US_O1', slaDays: 90, exempt: ['US'] },                       // O-1 ≈ 3–4 months
  GB: { visaType: 'UK_CREATIVE_WORKER', slaDays: 21, exempt: ['GB','IE'] },     // Creative Worker ≈ 3 weeks
  AE: { visaType: 'UAE_EMPLOYMENT', slaDays: 15, exempt: GCC },                 // MoL + e-visa ≈ 2–3 weeks
  IN: { visaType: 'INDIA_BUSINESS_EVISA', slaDays: 10, exempt: ['IN'] },        // e-Visa 8–10 days
};
// Every Schengen member resolves to the same C-visa rule (15-day decision window).
for (const c of SCHENGEN) VISA_RULES[c] = { visaType: 'SCHENGEN_C', slaDays: 15, exempt: EU_EEA };

// Loose label → ISO-2 resolver for free-text origin/destination/nationality.
const ALIAS: Record<string, string> = {
  usa: 'US', 'united states': 'US', america: 'US', 'new york': 'US', 'los angeles': 'US', la: 'US', atlanta: 'US',
  uk: 'GB', 'united kingdom': 'GB', england: 'GB', britain: 'GB', london: 'GB',
  uae: 'AE', 'united arab emirates': 'AE', 'abu dhabi': 'AE', dubai: 'AE', emirati: 'AE',
  india: 'IN', mumbai: 'IN', delhi: 'IN', indian: 'IN',
  france: 'FR', paris: 'FR', french: 'FR', germany: 'DE', berlin: 'DE', german: 'DE',
  spain: 'ES', madrid: 'ES', italy: 'IT', rome: 'IT', netherlands: 'NL', amsterdam: 'NL',
  saudi: 'SA', 'saudi arabia': 'SA', riyadh: 'SA', qatar: 'QA', doha: 'QA', jordan: 'JO', amman: 'JO',
};
function toIso(label?: string | null): string | null {
  if (!label) return null;
  const s = label.trim();
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  const low = s.toLowerCase();
  if (ALIAS[low]) return ALIAS[low];
  for (const [k, v] of Object.entries(ALIAS)) if (low.includes(k)) return v;
  return null;
}

@Injectable()
export class TravelService {
  private readonly log = new Logger('TravelService');
  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
    private workflow: WorkflowService,
    private amadeus: AmadeusService,
    private concur: ConcurService,
    private perms: PermissionsService,
  ) {}

  // ── Privacy: who may see passport / visa / national-ID PII ──────────────────
  // Configurable in Settings → Roles & Permissions (the 'travel_pii' column).
  // Producers + admins see PII by default; grant other roles there as needed.
  private static SENSITIVE_DOC_TYPES = ['PASSPORT', 'VISA', 'NATIONAL_ID', 'EMIRATES_ID', 'DRIVERS_LICENSE', 'RESIDENCE_PERMIT', 'ENTRY_PERMIT'];
  private async canSeePII(role?: string): Promise<boolean> {
    if (!role) return false;
    const map = await this.perms.forRole(role);
    return (map['travel_pii'] ?? 0) >= 1;
  }

  /** Strip passport/visa/ID PII from a full dossier when `see` is false. */
  private maskTraveler(t: any, see: boolean): any {
    if (see) return { ...t, _access: 'FULL' };
    const masked = { ...t,
      passportNumber: null, passportPlaceOfIssue: null, passportIssueDate: null, passportExpiry: null,
      nationalId: null, dateOfBirth: null,
      passportFrontUrl: null, passportInfoUrl: null, passportAdditionalUrl: null, passportPdfUrl: null,
      passportPhotoUrl: null, additionalIdPhotoUrl: null, // headshot stays
      travelerVisas: [],
      documents: (t.documents || []).filter((d: any) => !TravelService.SENSITIVE_DOC_TYPES.includes(d.type)),
      companions: (t.companions || []).map((c: any) => this.maskTraveler(c, see)),
      _access: 'RESTRICTED',
    };
    if (masked.validation) masked.validation = [];
    return masked;
  }
  private maskRow(t: any, see: boolean): any {
    if (see) return t;
    return { ...t, passportNumber: null, passportExpiry: null, nationalId: null };
  }

  // ── Traveler identity (universal master) ────────────────────────────────────
  // Top-level travellers only (companions are nested under their host).
  async listTravelers(query: { personType?: string; includeCompanions?: string } = {}, role?: string, userId?: string) {
    const where: any = {};
    if (query.personType) where.personType = query.personType;
    if (query.includeCompanions !== 'true') where.accompaniesId = null;
    // TALENT_REP: only the talent they represent (and those talents' companions are nested).
    if (role === 'TALENT_REP') where.talentProfile = { representedById: userId || '__none__' };
    const rows = await this.prisma.travelerProfile.findMany({
      where, orderBy: { fullName: 'asc' },
      include: { _count: { select: { companions: true, trips: true, travelerVisas: true, documents: true } } },
    });
    const see = await this.canSeePII(role);
    return rows.map((r) => this.maskRow(r, see));
  }

  /** Full identity dossier — personal, photos, passport, visas, docs, companions, arrivals + readiness. */
  async getTraveler(id: string, role?: string, userId?: string) {
    const t = await this.prisma.travelerProfile.findUnique({
      where: { id },
      include: {
        companions: { orderBy: { fullName: 'asc' }, include: { _count: { select: { travelerVisas: true, documents: true } } } },
        travelerVisas: { orderBy: { expiryDate: 'asc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        arrivals: { orderBy: { arrivalTime: 'asc' } },
        visas: { select: { id: true, status: true, country: true, visaType: true } },
        trips: { select: { id: true, status: true, origin: true, destination: true, departDate: true } },
        talentProfile: { select: { id: true, fullName: true, stageName: true, representedById: true } },
      },
    });
    if (!t) throw new NotFoundException('Traveler not found');
    // TALENT_REP may only open the identity of talent they represent.
    if (role === 'TALENT_REP' && t.talentProfile?.representedById !== userId) {
      throw new ForbiddenException('You can only view talent you represent.');
    }
    const full = { ...t, validation: this.passportFlags(t), readiness: await this.readiness(id, t) };
    return this.maskTraveler(full, await this.canSeePII(role));
  }

  createTraveler(d: any) {
    if (!d?.fullName) throw new BadRequestException('fullName is required');
    return this.prisma.travelerProfile.create({ data: this.cleanTraveler(d) });
  }
  async updateTraveler(id: string, d: any) {
    await this.assertTraveler(id);
    return this.prisma.travelerProfile.update({ where: { id }, data: this.cleanTraveler(d) });
  }
  private cleanTraveler(d: any) {
    const DATES = ['passportExpiry', 'passportIssueDate', 'dateOfBirth', 'consentAt'];
    const SKIP = ['id', 'createdAt', 'updatedAt', 'trips', 'visas', 'travelerVisas', 'documents', 'arrivals',
      'companions', 'accompanies', 'talentProfile', 'crewMember', '_count', 'validation', 'readiness'];
    const out: any = {};
    for (const [k, v] of Object.entries(d || {})) {
      if (SKIP.includes(k)) continue;
      out[k] = v === '' ? null : DATES.includes(k) ? (v ? new Date(v as string) : null) : v;
    }
    return out;
  }
  private async assertTraveler(id: string) {
    const e = await this.prisma.travelerProfile.findUnique({ where: { id }, select: { id: true } });
    if (!e) throw new NotFoundException('Traveler not found');
  }

  // ── Accompanying persons (full linked identities) ───────────────────────────
  async addCompanion(hostId: string, d: any) {
    await this.assertTraveler(hostId);
    if (!d?.fullName) throw new BadRequestException('fullName is required');
    return this.prisma.travelerProfile.create({
      data: { ...this.cleanTraveler(d), personType: 'ACCOMPANYING', accompaniesId: hostId },
    });
  }

  // ── Standing person-level visas ─────────────────────────────────────────────
  addVisaRecord(travelerId: string, d: any) {
    return this.prisma.travelerVisa.create({ data: { travelerId, ...this.cleanVisa(d) } });
  }
  updateVisaRecord(id: string, d: any) {
    return this.prisma.travelerVisa.update({ where: { id }, data: this.cleanVisa(d) });
  }
  removeVisaRecord(id: string) { return this.prisma.travelerVisa.delete({ where: { id } }); }
  private cleanVisa(d: any) {
    const DATES = ['issueDate', 'expiryDate'];
    const SKIP = ['id', 'travelerId', 'traveler', 'createdAt', 'updatedAt'];
    const out: any = {};
    for (const [k, v] of Object.entries(d || {})) {
      if (SKIP.includes(k)) continue;
      out[k] = v === '' ? null : DATES.includes(k) ? (v ? new Date(v as string) : null) : v;
    }
    return out;
  }

  // ── Documents repository ────────────────────────────────────────────────────
  addDocument(travelerId: string, d: any) {
    if (!d?.fileUrl) throw new BadRequestException('fileUrl is required');
    return this.prisma.travelerDocument.create({
      data: { travelerId, type: d.type || 'OTHER', label: d.label || null, fileUrl: d.fileUrl, expiryDate: d.expiryDate ? new Date(d.expiryDate) : null, notes: d.notes || null, uploadedById: d.uploadedById || null },
    });
  }
  removeDocument(id: string) { return this.prisma.travelerDocument.delete({ where: { id } }); }

  // ── Meet & Greet ────────────────────────────────────────────────────────────
  upsertArrival(travelerId: string, d: any) {
    const data: any = {
      airport: d.airport || null, flightNumber: d.flightNumber || null,
      arrivalTime: d.arrivalTime ? new Date(d.arrivalTime) : null, terminal: d.terminal || null,
      driverAssigned: d.driverAssigned || null, coordinatorAssigned: d.coordinatorAssigned || null,
      tripId: d.tripId || null, notes: d.notes || null,
    };
    if (d.id) return this.prisma.travelArrival.update({ where: { id: d.id }, data });
    return this.prisma.travelArrival.create({ data: { travelerId, ...data } });
  }

  /** Arrival Photo Sheet data — host + companions with photo/name/flight for drivers & reps. */
  async arrivalSheet(travelerId: string) {
    const t = await this.prisma.travelerProfile.findUnique({
      where: { id: travelerId },
      include: { arrivals: { orderBy: { arrivalTime: 'asc' }, take: 1 }, companions: { include: { arrivals: { take: 1 } } } },
    });
    if (!t) throw new NotFoundException('Traveler not found');
    const row = (p: any) => ({ name: p.preferredName || p.fullName, photoUrl: p.headshotUrl || p.passportPhotoUrl, relationship: p.relationship || null, flight: p.arrivals?.[0]?.flightNumber || null, arrivalTime: p.arrivals?.[0]?.arrivalTime || null });
    return { host: row(t), companions: (t.companions || []).map(row) };
  }

  // ── Validation flags + Travel Readiness score ───────────────────────────────
  private passportFlags(t: any) {
    const flags: string[] = [];
    const now = Date.now();
    if (!t.passportNumber || !t.passportPdfUrl && !t.passportInfoUrl) flags.push('PASSPORT_MISSING');
    if (t.passportExpiry) {
      const exp = new Date(t.passportExpiry).getTime();
      if (exp < now) flags.push('PASSPORT_EXPIRED');
      else if (exp < now + 182 * 864e5) flags.push('PASSPORT_UNDER_6_MONTHS');
    }
    return flags;
  }

  /** 0–100 readiness across passport, visa, flight, hotel, transfer. */
  async readiness(id: string, preloaded?: any) {
    const t = preloaded || await this.prisma.travelerProfile.findUnique({
      where: { id },
      include: { travelerVisas: true, arrivals: true, trips: { include: { itineraries: { include: { flights: true, hotels: true } } } } },
    });
    if (!t) throw new NotFoundException();
    const flags = this.passportFlags(t);
    const passport = (t.passportNumber && (t.passportPdfUrl || t.passportInfoUrl) && !flags.includes('PASSPORT_EXPIRED')) ? 'COMPLETE' : (t.passportNumber ? 'PARTIAL' : 'MISSING');
    const visaRecs = t.travelerVisas || [];
    const visa = visaRecs.some((v: any) => v.status === 'APPROVED') ? 'APPROVED'
      : visaRecs.some((v: any) => ['IN_PROGRESS', 'SUBMITTED', 'REQUIRED'].includes(v.status)) ? 'PENDING'
      : (visaRecs.every((v: any) => v.status === 'NOT_REQUIRED') && visaRecs.length ? 'NOT_REQUIRED' : 'PENDING');
    const trips = t.trips || [];
    const hasFlight = trips.some((tr: any) => (tr.itineraries || []).some((it: any) => (it.flights || []).length));
    const hasHotel = trips.some((tr: any) => (tr.itineraries || []).some((it: any) => (it.hotels || []).length));
    const hasTransfer = (t.arrivals || []).some((a: any) => a.driverAssigned);

    const items = [
      { key: 'Passport', status: passport, ok: passport === 'COMPLETE' },
      { key: 'Visa', status: visa, ok: visa === 'APPROVED' || visa === 'NOT_REQUIRED' },
      { key: 'Flight', status: hasFlight ? 'Confirmed' : 'Pending', ok: hasFlight },
      { key: 'Hotel', status: hasHotel ? 'Confirmed' : 'Pending', ok: hasHotel },
      { key: 'Airport Transfer', status: hasTransfer ? 'Assigned' : 'Pending', ok: hasTransfer },
    ];
    const score = Math.round((items.filter((i) => i.ok).length / items.length) * 100);
    return { score, items, flags };
  }

  /**
   * Smart connection — ensure a Talent has a Travel Identity (creating one from
   * the casting profile if missing) so 'Will talent travel? → Yes' has no re-entry.
   */
  async ensureTalentIdentity(talentId: string) {
    const existing = await this.prisma.travelerProfile.findFirst({ where: { talentProfileId: talentId } });
    if (existing) return existing;
    const talent = await this.prisma.globalTalentProfile.findUnique({ where: { id: talentId } });
    if (!talent) throw new NotFoundException('Talent not found');
    return this.prisma.travelerProfile.create({
      data: {
        personType: 'TALENT', talentProfileId: talent.id,
        fullName: talent.fullName, preferredName: talent.stageName || null,
        gender: talent.gender || null, email: talent.email || null, phone: talent.phone || null,
        nationality: talent.nationality || null, dateOfBirth: talent.dateOfBirth || null,
        headshotUrl: (talent.headshotUrls || [])[0] || null,
        gdprConsent: talent.consentStatus === 'GRANTED', consentAt: talent.consentGivenAt || null,
      },
    });
  }

  /**
   * Smart connection — ensure a Crew member (ATL or BTL, from the Crew Directory)
   * has a Travel Identity, seeded from their directory record. Travel is not
   * talent-only: every flown-in crew needs passports/visas/readiness too.
   */
  async ensureCrewIdentity(crewMemberId: string) {
    const existing = await this.prisma.travelerProfile.findFirst({ where: { crewMemberId } });
    if (existing) return existing;
    const c = await this.prisma.crewMember.findUnique({ where: { id: crewMemberId } });
    if (!c) throw new NotFoundException('Crew member not found');
    const profile = await this.prisma.travelerProfile.create({
      data: {
        personType: 'CREW', crewMemberId: c.id,
        fullName: c.name, email: c.email || null, phone: c.phone || null,
        nationality: c.nationality || null,
        passportNumber: c.passportNumber || null, passportExpiry: c.passportExpiry || null,
        nationalId: c.emiratesId || null, headshotUrl: c.photoUrl || null,
        passportPdfUrl: c.passportDocUrl || null,
      },
    });
    // Carry over any directory document copies into the repository.
    const docs: any[] = [];
    if (c.visaDocUrl) docs.push({ travelerId: profile.id, type: 'VISA', label: 'Visa (from directory)', fileUrl: c.visaDocUrl });
    if (c.emiratesIdDocUrl) docs.push({ travelerId: profile.id, type: 'EMIRATES_ID', label: 'Emirates ID (from directory)', fileUrl: c.emiratesIdDocUrl });
    if (docs.length) await this.prisma.travelerDocument.createMany({ data: docs });
    return profile;
  }

  // ── Travel Requirement Engine (SYS-10 V2.0 §2) ──────────────────────────────
  // System-calculated: compares the person's home location vs the shoot location,
  // and derives visa need from the existing Visa SLA rules. Local talent → no
  // travel/visa/hotel, so readiness ignores those items.
  private norm(s?: string | null) { return (s || '').trim().toLowerCase(); }
  computeRequirements(
    person: { nationality?: string | null; homeCountry?: string | null; homeCity?: string | null },
    dest: { country?: string | null; city?: string | null },
  ) {
    const destC = this.norm(dest.country);
    if (!destC) return { resolved: false as const, reason: 'No destination country to evaluate.' };
    const homeC = this.norm(person.homeCountry);
    const isLocalTalent = !!homeC && homeC === destC;
    const crossBorder = !isLocalTalent;
    const homeCity = this.norm(person.homeCity);
    const destCity = this.norm(dest.city);
    const travelRequired = crossBorder || (!!homeCity && !!destCity && homeCity !== destCity);

    let visaRequired = false;
    if (crossBorder) {
      const destIso = toIso(dest.country);
      const nat = toIso(person.nationality);
      const rule = destIso ? VISA_RULES[destIso] : null;
      visaRequired = !!rule && !(nat && rule.exempt.includes(nat));
    }
    return {
      resolved: true as const,
      isLocalTalent, travelRequired, visaRequired,
      accommodationRequired: travelRequired,
      groundTransportRequired: travelRequired,
    };
  }

  /** Compute + persist requirement flags on the identity (and mirror to its talent). */
  async applyRequirements(travelerId: string, body: any = {}) {
    const t = await this.prisma.travelerProfile.findUnique({ where: { id: travelerId } });
    if (!t) throw new NotFoundException('Traveler not found');

    const dest: { country?: string | null; city?: string | null } = {
      country: body.destinationCountry || null, city: body.destinationCity || null,
    };
    if (body.projectId && !dest.country) {
      const p = await this.prisma.productionProject.findUnique({ where: { id: body.projectId }, include: { productionCountry: { select: { name: true } } } });
      dest.country = (p as any)?.productionCountry?.name || null;
    }

    const r = this.computeRequirements({ nationality: t.nationality, homeCountry: t.homeCountry, homeCity: t.homeCity }, dest);
    if (!r.resolved) return r;

    const flags = {
      isLocalTalent: r.isLocalTalent, travelRequired: r.travelRequired, visaRequired: r.visaRequired,
      accommodationRequired: r.accommodationRequired, groundTransportRequired: r.groundTransportRequired,
      workRegion: dest.country || t.workRegion || null,
    };
    await this.prisma.travelerProfile.update({ where: { id: travelerId }, data: flags });
    if (t.talentProfileId) await this.prisma.globalTalentProfile.update({ where: { id: t.talentProfileId }, data: flags });
    return { resolved: true, ...flags, destination: dest };
  }

  // ── Trips ───────────────────────────────────────────────────────────────────
  // scope: a projectId filters to one project; 'standalone' → project-less; else all (master view).
  listTrips(query: { projectId?: string; scope?: string } = {}) {
    const where: any = {};
    if (query.projectId) where.projectId = query.projectId;
    else if (query.scope === 'standalone') where.projectId = null;
    return this.prisma.trip.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        traveler: { select: { fullName: true, nationality: true } },
        project: { select: { title: true, isHouse: true } },
        _count: { select: { itineraries: true, visas: true } },
      },
    });
  }

  /** Master dashboard rollup — across all projects + standalone. */
  async dashboard() {
    const [byStatus, visaByStatus, standalone, upcoming, visasDue] = await Promise.all([
      this.prisma.trip.groupBy({ by: ['status'], _count: true }),
      this.prisma.visaApplication.groupBy({ by: ['status'], _count: true }),
      this.prisma.trip.count({ where: { projectId: null } }),
      this.prisma.trip.findMany({
        where: { departDate: { gte: new Date() }, status: { notIn: ['CANCELLED', 'COMPLETED'] } },
        orderBy: { departDate: 'asc' }, take: 10,
        include: { traveler: { select: { fullName: true } }, project: { select: { title: true, isHouse: true } } },
      }),
      this.prisma.visaApplication.findMany({
        where: { status: { in: ['REQUIRED', 'SUBMITTED', 'IN_PROCESS'] } },
        orderBy: { expectedDecisionAt: 'asc' }, take: 10,
        include: { traveler: { select: { fullName: true, nationality: true } } },
      }),
    ]);
    return { byStatus, visaByStatus, standalone, upcoming, visasDue };
  }
  getTrip(id: string) {
    return this.prisma.trip.findUnique({
      where: { id },
      include: { traveler: true, visas: true, itineraries: { include: { flights: true, hotels: true, cars: true } } },
    });
  }

  /** (#1) Create a trip request and route it through the universal approval engine. */
  async requestTrip(data: any, userId?: string) {
    if (!data?.travelerId) throw new BadRequestException('travelerId is required');
    await this.assertTraveler(data.travelerId);
    // projectId optional → null means a standalone trip (House/Corporate ledger).
    const trip = await this.prisma.trip.create({
      data: {
        projectId: data.projectId || null, travelerId: data.travelerId, purpose: data.purpose || null,
        origin: data.origin || null, destination: data.destination || null,
        destinationGeoNodeId: data.destinationGeoNodeId || null,
        departDate: data.departDate ? new Date(data.departDate) : null,
        returnDate: data.returnDate ? new Date(data.returnDate) : null,
        estimatedCost: data.estimatedCost != null ? Number(data.estimatedCost) : null,
        currency: data.currency || 'AED', status: 'REQUESTED', requestedById: userId || null, notes: data.notes || null,
      },
    });
    // Trigger approval. Needs WorkflowEntity.TRIP + a seeded TRIP_STANDARD chain;
    // if not configured, the trip still stands in REQUESTED for manual approval.
    let workflow: any = null;
    try {
      workflow = await this.workflow.start(
        { entityType: 'TRIP', entityId: trip.id, projectId: trip.projectId, label: `Trip — ${data.origin || ''}→${data.destination || ''}` },
        userId,
      );
    } catch (e: any) { this.log.warn(`Trip ${trip.id}: approval routing not configured (${e?.message}). Left REQUESTED.`); }
    return { trip, workflow };
  }

  /**
   * (#2) Approve a trip → run the Visa SLA engine. Call this from the approver
   * action (or wire the workflow completion effect to it).
   */
  async approveTrip(id: string, userId?: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id }, include: { traveler: true } });
    if (!trip) throw new NotFoundException('Trip not found');
    await this.prisma.trip.update({ where: { id }, data: { status: 'APPROVED', approvedById: userId || null, approvedAt: new Date() } });
    const visa = await this.runVisaSlaEngine(trip);
    return { approved: true, tripId: id, visa };
  }

  /** Visa SLA engine — nationality × destination → auto VisaApplication with the route's SLA. */
  async runVisaSlaEngine(trip: any) {
    const nat = toIso(trip.traveler?.nationality);
    const dest = toIso(trip.destination);
    if (!nat || !dest) return { required: null, reason: 'Could not resolve nationality and/or destination country.' };

    const rule = VISA_RULES[dest];
    if (!rule) return { required: false, reason: `No visa rule for ${dest}.` };
    if (rule.exempt.includes(nat)) return { required: false, reason: `${nat} is visa-exempt for ${dest}.` };

    // Already raised for this trip/country?
    const existing = await this.prisma.visaApplication.findFirst({ where: { tripId: trip.id, country: dest } });
    if (existing) return { required: true, visa: existing, note: 'Already raised.' };

    const submitBy = trip.departDate ? new Date(new Date(trip.departDate).getTime() - rule.slaDays * 864e5) : null;
    const visa = await this.prisma.visaApplication.create({
      data: {
        travelerId: trip.travelerId, tripId: trip.id, country: dest, destinationGeoNodeId: trip.destinationGeoNodeId || null,
        visaType: rule.visaType as any, status: 'REQUIRED', slaDays: rule.slaDays,
        requiredDocuments: this.docsFor(rule.visaType),
        notes: `Auto-generated by the SLA engine. ${rule.slaDays}-day processing window.` +
          (submitBy ? ` Submit by ${submitBy.toISOString().slice(0, 10)} to clear before departure.` : ''),
      },
    });
    return { required: true, visa };
  }

  private docsFor(visaType: string) {
    const base = [{ type: 'passport' }, { type: 'photo' }];
    if (visaType.startsWith('US_')) return [...base, { type: 'LOA' }, { type: 'petition' }];
    if (visaType.startsWith('UK_')) return [...base, { type: 'certificate_of_sponsorship' }];
    if (visaType.startsWith('UAE_')) return [...base, { type: 'LOA' }, { type: 'medical' }];
    if (visaType.startsWith('INDIA_')) return [...base, { type: 'LOA' }, { type: 'corporate_letter' }, { type: 'itinerary' }];
    if (visaType === 'SCHENGEN_C') return [...base, { type: 'itinerary' }, { type: 'sponsor_letter' }, { type: 'insurance' }];
    return base;
  }

  listVisas(status?: string) {
    return this.prisma.visaApplication.findMany({
      where: status ? { status: status as any } : {},
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { traveler: { select: { fullName: true, nationality: true } } },
    });
  }
  async updateVisa(id: string, d: any) {
    const e = await this.prisma.visaApplication.findUnique({ where: { id }, select: { id: true } });
    if (!e) throw new NotFoundException('Visa application not found');
    const DATES = ['submittedAt', 'expectedDecisionAt', 'decisionAt', 'expiryAt'];
    const data: any = {};
    for (const [k, v] of Object.entries(d || {})) {
      if (['id', 'createdAt', 'updatedAt', 'traveler', 'trip'].includes(k)) continue;
      data[k] = v === '' ? null : DATES.includes(k) ? (v ? new Date(v as string) : null) : v;
    }
    // When the application is submitted, lock in the SLA promise date.
    if (data.status === 'SUBMITTED' && !data.submittedAt) data.submittedAt = new Date();
    if (data.submittedAt) {
      const cur = await this.prisma.visaApplication.findUnique({ where: { id } });
      if (cur?.slaDays) data.expectedDecisionAt = new Date(new Date(data.submittedAt).getTime() + cur.slaDays * 864e5);
    }
    return this.prisma.visaApplication.update({ where: { id }, data });
  }

  // ── Itineraries & bookings ──────────────────────────────────────────────────
  async createItinerary(tripId: string, d: any) {
    const t = await this.prisma.trip.findUnique({ where: { id: tripId }, select: { id: true } });
    if (!t) throw new NotFoundException('Trip not found');
    return this.prisma.itinerary.create({
      data: { tripId, startDate: d?.startDate ? new Date(d.startDate) : null, endDate: d?.endDate ? new Date(d.endDate) : null, currency: d?.currency || 'AED' },
    });
  }
  private async recomputeItineraryTotal(itineraryId: string) {
    const it = await this.prisma.itinerary.findUnique({ where: { id: itineraryId }, include: { flights: true, hotels: true, cars: true } });
    if (!it) return;
    const sum = (arr: any[], f: string) => arr.reduce((a, x) => a + Number(x[f] || 0), 0);
    const total = sum(it.flights, 'fare') + sum(it.hotels, 'totalRate') + sum(it.cars, 'rate');
    await this.prisma.itinerary.update({ where: { id: itineraryId }, data: { totalCost: Math.round(total * 100) / 100 } });
  }

  /** Book a flight through Amadeus (mock) and attach it to the itinerary. */
  async bookFlight(itineraryId: string, offer: any) {
    const it = await this.prisma.itinerary.findUnique({ where: { id: itineraryId }, select: { id: true } });
    if (!it) throw new NotFoundException('Itinerary not found');
    const res = await this.amadeus.bookFlight(offer);
    const f = await this.prisma.flightBooking.create({
      data: {
        itineraryId, carrier: res.carrier || null, flightNumber: res.flightNumber || null,
        departAirport: res.departAirport || null, arriveAirport: res.arriveAirport || null,
        departureTime: res.departureTime ? new Date(res.departureTime) : null, arrivalTime: res.arrivalTime ? new Date(res.arrivalTime) : null,
        cabinClass: res.cabinClass || null, fare: res.fare != null ? Number(res.fare) : null, currency: (res.currency || 'AED') as any,
        pnr: res.pnr, status: 'CONFIRMED',
      },
    });
    await this.recomputeItineraryTotal(itineraryId);
    return f;
  }
  async addHotel(itineraryId: string, d: any) {
    const f = await this.prisma.hotelBooking.create({ data: { itineraryId, ...this.cleanBooking(d, ['checkIn', 'checkOut'], ['nightlyRate', 'totalRate']) } });
    await this.recomputeItineraryTotal(itineraryId); return f;
  }
  async addCar(itineraryId: string, d: any) {
    const f = await this.prisma.carBooking.create({ data: { itineraryId, ...this.cleanBooking(d, ['startTime', 'endTime'], ['rate']) } });
    await this.recomputeItineraryTotal(itineraryId); return f;
  }
  private cleanBooking(d: any, dates: string[], nums: string[]) {
    const out: any = {};
    for (const [k, v] of Object.entries(d || {})) {
      if (['id', 'itineraryId', 'createdAt', 'updatedAt'].includes(k)) continue;
      out[k] = v === '' ? null : dates.includes(k) ? (v ? new Date(v as string) : null) : nums.includes(k) && v != null ? Number(v) : v;
    }
    return out;
  }

  async searchFlights(p: any) { return this.amadeus.searchFlights(p); }

  // ── TWO-LEDGER ──────────────────────────────────────────────────────────────
  /** Commit an itinerary as an AP PurchaseOrder (encumbrance). */
  async commitItinerary(itineraryId: string, userId?: string) {
    const it = await this.prisma.itinerary.findUnique({ where: { id: itineraryId }, include: { trip: { include: { traveler: true } } } });
    if (!it) throw new NotFoundException('Itinerary not found');
    if (it.purchaseOrderId) return { committed: true, purchaseOrderId: it.purchaseOrderId, note: 'Already committed.' };
    const amount = Number(it.totalCost || 0);
    if (amount <= 0) throw new BadRequestException('Itinerary has no cost to commit.');
    // Standalone trip → commit against the House/Corporate project.
    const projectId = it.trip.projectId || (await this.ledger.getHouseProjectId());
    const po = await this.prisma.purchaseOrder.create({
      data: {
        projectId, poNumber: `TRV-${Date.now().toString(36).toUpperCase()}`,
        vendorName: 'Travel & Accommodation', description: `Travel — ${it.trip.traveler?.fullName || 'traveller'} (${it.trip.origin || ''}→${it.trip.destination || ''})`,
        amount, taxAmount: 0, total: amount, currency: (it.currency as any) || 'AED', status: 'DRAFT', createdById: userId || null,
      },
    });
    await this.prisma.itinerary.update({ where: { id: itineraryId }, data: { purchaseOrderId: po.id, status: 'CONFIRMED' } });
    return { committed: true, purchaseOrderId: po.id, poNumber: po.poNumber, amount };
  }

  /** Post the itinerary as an ACTUAL to the project ledger (period-locked via ledger.assertOpen). */
  async postItineraryActual(itineraryId: string, userId?: string) {
    const it = await this.prisma.itinerary.findUnique({ where: { id: itineraryId }, include: { trip: { include: { traveler: true } } } });
    if (!it) throw new NotFoundException('Itinerary not found');
    if (it.postedTxnId) return { posted: true, transactionId: it.postedTxnId, note: 'Already posted.' };
    const amount = Number(it.totalCost || 0);
    if (amount <= 0) throw new BadRequestException('Itinerary has no cost to post.');
    // Standalone trip → post to the House/Corporate project as CORPORATE_OVERHEAD.
    const standalone = !it.trip.projectId;
    const projectId = it.trip.projectId || (await this.ledger.getHouseProjectId());
    const txn = await this.ledger.create({
      projectId, kind: standalone ? 'CORPORATE_OVERHEAD' : 'COST', date: new Date(), category: 'Travel',
      description: `Travel — ${it.trip.traveler?.fullName || 'traveller'} (${it.trip.origin || ''}→${it.trip.destination || ''})${standalone ? ' [standalone]' : ''}`,
      party: 'Travel & Accommodation', amount, taxAmount: 0, status: 'APPROVED', currency: it.currency || 'AED',
    }, userId); // ledger.create runs assertOpen() internally → closed periods are blocked
    await this.prisma.itinerary.update({ where: { id: itineraryId }, data: { postedTxnId: txn.id } });
    return { posted: true, transactionId: txn.id, amount };
  }

  /** Push the trip's actuals to Concur (mock mirror — NOT the source of truth). */
  async pushExpenses(tripId: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId }, include: { traveler: true, itineraries: { include: { flights: true, hotels: true, cars: true } } } });
    if (!trip) throw new NotFoundException('Trip not found');
    const lines: any[] = [];
    for (const it of trip.itineraries) {
      for (const f of it.flights) if (f.fare) lines.push({ type: 'Airfare', amount: Number(f.fare), currency: f.currency, description: f.flightNumber });
      for (const h of it.hotels) if (h.totalRate) lines.push({ type: 'Lodging', amount: Number(h.totalRate), currency: h.currency, description: h.hotelName });
      for (const c of it.cars) if (c.rate) lines.push({ type: 'Car Rental', amount: Number(c.rate), currency: c.currency, description: c.carType });
    }
    return this.concur.pushExpense({ tripId, traveler: trip.traveler?.fullName, lines });
  }
}
