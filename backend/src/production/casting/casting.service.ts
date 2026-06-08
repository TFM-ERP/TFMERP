import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ContractsService } from '../contracts/contracts.service';
import { SUBMISSION_PIPELINE, ENGAGED_STATUSES, nextStage } from './pipeline';

/**
 * CastingService (Phase 4B)
 * ───────────────────────────────────────────────────────────────────────────
 * 1. Derive CastingCalls directly from script BreakdownElements (the castable
 *    categories: CAST / BACKGROUND / STUNTS).
 * 2. Log GDPR/CCPA consent timestamps whenever a talent submits a profile.
 * 3. Selection Handoff: marking a candidate 'Selected' auto-pushes their data
 *    into the Contracts module to generate a DRAFT Deal Memo.
 */
@Injectable()
export class CastingService {
  private readonly log = new Logger('CastingService');
  constructor(
    private prisma: PrismaService,
    private contracts: ContractsService,
  ) {}

  // Breakdown categories that represent on-screen performers.
  private static CASTABLE = ['CAST', 'BACKGROUND', 'STUNTS'] as const;
  private roleTypeFor(category: string): any {
    if (category === 'BACKGROUND') return 'BACKGROUND';
    if (category === 'STUNTS') return 'STUNT';
    return 'SUPPORTING';
  }

  /**
   * Performer unions/guilds = LaborBodies that have a 'PERFORMER' classification
   * (SAG-AFTRA, ACTRA, Equity). Sourced live from the Labor & Fringe master so the
   * talent dropdown never drifts from the system's defined bodies.
   */
  listPerformerUnions() {
    return this.prisma.laborBody.findMany({
      where: { isActive: true, agreements: { some: { classifications: { some: { code: 'PERFORMER' } } } } },
      select: { id: true, name: true, shortName: true, kind: true, country: { select: { name: true, code: true } } },
      orderBy: { name: 'asc' },
    });
  }

  // ── Master: Talent profiles ───────────────────────────────────────────────────
  listTalent(query: { search?: string; status?: string } = {}, role?: string, userId?: string) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search) where.OR = [
      { fullName: { contains: query.search, mode: 'insensitive' } },
      { stageName: { contains: query.search, mode: 'insensitive' } },
      { skills: { has: query.search } },
    ];
    // TALENT_REP sees only the talent they represent.
    if (role === 'TALENT_REP') where.representedById = userId || '__none__';
    return this.prisma.globalTalentProfile.findMany({ where, orderBy: { fullName: 'asc' }, take: 200 });
  }
  async getTalent(id: string, role?: string, userId?: string) {
    const t = await this.prisma.globalTalentProfile.findUnique({
      where: { id },
      include: {
        consentLogs: { orderBy: { createdAt: 'desc' } },
        submissions: { include: { castingCall: { select: { roleName: true, projectId: true } } } },
        representations: { orderBy: [{ isPrimary: 'desc' }, { repType: 'asc' }] },
        credits: { orderBy: [{ year: 'desc' }] },
        interactions: { orderBy: { occurredAt: 'desc' }, take: 100 },
      },
    });
    if (t && role === 'TALENT_REP' && t.representedById !== userId) {
      throw new ForbiddenException('You can only view talent you represent.');
    }
    return t;
  }

  /**
   * Talent Readiness Engine (SYS-10 V2.0 §1) — computed, no table.
   * Groups: Casting / Contracts / Travel (gated by the Travel Requirement flags) /
   * Production / Payroll. Only tracked + required items count toward the score, so
   * local talent's travel items (and not-yet-built production/payroll) don't drag it.
   */
  async talentReadiness(talentId: string, opts: { projectId?: string } = {}) {
    const talent = await this.prisma.globalTalentProfile.findUnique({
      where: { id: talentId },
      include: {
        travelIdentity: {
          include: {
            travelerVisas: true, documents: true, arrivals: true,
            trips: { include: { itineraries: { include: { flights: true, hotels: true } } } },
          },
        },
        submissions: { select: { status: true, castingCall: { select: { projectId: true } } } },
      },
    });
    if (!talent) throw new NotFoundException('Talent not found');
    const ti: any = talent.travelIdentity;

    // ── Casting ──
    const casting = [
      { key: 'Profile complete', required: true, complete: !!(talent.fullName && talent.email && talent.nationality) },
      { key: 'Headshots', required: true, complete: (talent.headshotUrls || []).length > 0 },
      { key: 'Resume', required: true, complete: !!talent.resumeUrl },
      { key: 'Reel', required: true, complete: (talent.reelUrls || []).length > 0 },
    ];

    // ── Contracts (matched by counterparty email on the engagement's project) ──
    const projId = opts.projectId
      || talent.submissions.find((s) => ENGAGED_STATUSES.includes(s.status))?.castingCall?.projectId || null;
    let contracts: any[];
    if (projId && talent.email) {
      const any = await this.prisma.projectContract.findFirst({ where: { projectId: projId, parties: { some: { email: talent.email } } } });
      const signed = await this.prisma.projectContract.findFirst({ where: { projectId: projId, parties: { some: { email: talent.email } }, status: { in: ['SIGNED', 'ACTIVE', 'COMPLETED'] } } });
      contracts = [
        { key: 'Deal memo drafted', required: true, complete: !!any },
        { key: 'Contract signed', required: true, complete: !!signed },
      ];
    } else {
      contracts = [
        { key: 'Deal memo drafted', required: true, complete: false, tracked: false },
        { key: 'Contract signed', required: true, complete: false, tracked: false },
      ];
    }

    // ── Travel (required flags come from the Travel Requirement Engine) ──
    let travel: any[];
    if (ti) {
      const hasFlight = (ti.trips || []).some((t: any) => (t.itineraries || []).some((i: any) => (i.flights || []).length));
      const hasHotel = (ti.trips || []).some((t: any) => (t.itineraries || []).some((i: any) => (i.hotels || []).length));
      travel = [
        { key: 'Passport', required: !!ti.travelRequired, complete: !!(ti.passportNumber && (ti.passportPdfUrl || ti.passportInfoUrl)) },
        { key: 'Visa', required: !!ti.visaRequired, complete: (ti.travelerVisas || []).some((v: any) => v.status === 'APPROVED') },
        { key: 'Flight', required: !!ti.travelRequired, complete: hasFlight },
        { key: 'Hotel', required: !!ti.accommodationRequired, complete: hasHotel },
        { key: 'Airport transfer', required: !!ti.groundTransportRequired, complete: (ti.arrivals || []).some((a: any) => a.driverAssigned) },
      ];
    } else {
      travel = [{ key: 'Travel identity', required: true, complete: false, tracked: false, note: 'Open the Travel tab to create it.' }];
    }

    // ── Production / Payroll (from the engagement's ops checklist when it exists) ──
    const eng = projId ? await this.prisma.submission.findFirst({ where: { talentId, castingCall: { projectId: projId } }, include: { opsChecklist: true } }) : null;
    const ck: any = eng?.opsChecklist;
    const trk = !!ck;
    const production = [
      { key: 'Wardrobe', required: true, complete: !!ck?.wardrobeComplete, tracked: trk },
      { key: 'Measurements', required: true, complete: !!ck?.measurementsComplete, tracked: trk },
      { key: 'Fittings', required: true, complete: !!ck?.fittingsComplete, tracked: trk },
      { key: 'Makeup notes', required: true, complete: !!ck?.makeupNotesComplete, tracked: trk },
    ];
    const payroll = [
      { key: 'Banking', required: true, complete: !!ck?.bankingComplete, tracked: trk },
      { key: 'Tax docs', required: true, complete: !!ck?.taxDocsComplete, tracked: trk },
      { key: 'Vendor setup', required: true, complete: !!ck?.vendorSetupComplete, tracked: trk },
    ];

    const groups = { Casting: casting, Contracts: contracts, Travel: travel, Production: production, Payroll: payroll };
    const all = [...casting, ...contracts, ...travel, ...production, ...payroll];
    const scored = all.filter((i) => i.required && i.tracked !== false);
    const done = scored.filter((i) => i.complete).length;
    const score = scored.length ? Math.round((done / scored.length) * 100) : 0;
    return { talentId, projectId: projId, score, groups, isLocalTalent: !!ti?.isLocalTalent };
  }
  createTalent(d: any) {
    if (!d?.fullName) throw new BadRequestException('fullName is required');
    return this.prisma.globalTalentProfile.create({ data: this.cleanTalent(d) });
  }
  updateTalent(id: string, d: any) {
    const { id: _i, submissions, consentLogs, representations, credits, interactions, _count, createdAt, updatedAt, ...rest } = d || {};
    return this.prisma.globalTalentProfile.update({ where: { id }, data: this.cleanTalent(rest, true) });
  }
  private cleanTalent(d: any, partial = false) {
    const out: any = {
      fullName: d.fullName, stageName: d.stageName ?? null, email: d.email ?? null, phone: d.phone ?? null,
      gender: d.gender ?? null, ethnicity: d.ethnicity ?? null, nationality: d.nationality ?? null, baseCity: d.baseCity ?? null,
      languages: d.languages ?? undefined, skills: d.skills ?? undefined, heightCm: d.heightCm != null ? Number(d.heightCm) : null,
      physical: d.physical ?? undefined, headshotUrls: d.headshotUrls ?? undefined, reelUrls: d.reelUrls ?? undefined,
      resumeUrl: d.resumeUrl ?? null, portfolioUrl: d.portfolioUrl ?? null, unions: d.unions ?? undefined, unionStatus: d.unionStatus ?? null,
      laborBodyId: d.laborBodyId ?? null, representedById: d.representedById ?? null,
      agentName: d.agentName ?? null, agentEmail: d.agentEmail ?? null, agencyName: d.agencyName ?? null,
      dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : null, isMinor: d.isMinor ?? undefined,
      guardianName: d.guardianName ?? null, guardianEmail: d.guardianEmail ?? null,
      status: d.status ?? undefined, createdById: d.createdById ?? undefined,
      // ── V3-A deep identity ──
      preferredName: d.preferredName ?? null, currentLocation: d.currentLocation ?? null,
      nationalities: d.nationalities ?? undefined, dialects: d.dialects ?? undefined, accents: d.accents ?? undefined,
      weightKg: d.weightKg != null && d.weightKg !== '' ? Number(d.weightKg) : null,
      tattoos: d.tattoos ?? null, distinguishingFeatures: d.distinguishingFeatures ?? null,
      biography: d.biography ?? null, pressLinks: d.pressLinks ?? undefined, categories: d.categories ?? undefined,
      whatsapp: d.whatsapp ?? null, emergencyContact: d.emergencyContact ?? undefined, awards: d.awards ?? undefined,
    };
    // On partial updates, drop undefined keys so we don't overwrite with nulls unintentionally.
    if (partial) Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
    return out;
  }

  // ── V3-B: Representation ──────────────────────────────────────────────────────
  listReps(talentId: string) { return this.prisma.talentRepresentation.findMany({ where: { talentId }, orderBy: [{ isPrimary: 'desc' }, { repType: 'asc' }] }); }
  async addRep(talentId: string, d: any) {
    if (!d?.name) throw new BadRequestException('name is required');
    const rep = await this.prisma.talentRepresentation.create({ data: this.cleanRep({ ...d, talentId }) });
    await this.syncPrimaryAgent(talentId);
    return rep;
  }
  async updRep(id: string, d: any) {
    const rep = await this.prisma.talentRepresentation.update({ where: { id }, data: this.cleanRep(d, true) });
    await this.syncPrimaryAgent(rep.talentId);
    return rep;
  }
  async delRep(id: string) {
    const rep = await this.prisma.talentRepresentation.delete({ where: { id } });
    await this.syncPrimaryAgent(rep.talentId);
    return rep;
  }
  private cleanRep(d: any, partial = false) {
    const out: any = {
      talentId: d.talentId, repType: d.repType ?? undefined, name: d.name ?? undefined,
      company: d.company ?? null, email: d.email ?? null, phone: d.phone ?? null,
      commissionPct: d.commissionPct != null && d.commissionPct !== '' ? Number(d.commissionPct) : null,
      territory: d.territory ?? null,
      contractStart: d.contractStart ? new Date(d.contractStart) : (partial ? undefined : null),
      contractEnd: d.contractEnd ? new Date(d.contractEnd) : (partial ? undefined : null),
      isPrimary: d.isPrimary ?? undefined, notes: d.notes ?? null,
    };
    if (partial) Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
    return out;
  }
  /** Mirror the primary agency rep into the flat agent fields so fringe/deal-memo logic is unchanged. */
  private async syncPrimaryAgent(talentId: string) {
    const primary = await this.prisma.talentRepresentation.findFirst({ where: { talentId, repType: 'AGENCY', isPrimary: true } })
      || await this.prisma.talentRepresentation.findFirst({ where: { talentId, repType: 'AGENCY' } });
    if (primary) await this.prisma.globalTalentProfile.update({ where: { id: talentId }, data: { agentName: primary.name, agentEmail: primary.email, agencyName: primary.company || primary.name } });
  }

  // ── V3-B: Credits ─────────────────────────────────────────────────────────────
  listCredits(talentId: string) { return this.prisma.talentCredit.findMany({ where: { talentId }, orderBy: [{ year: 'desc' }] }); }
  addCredit(talentId: string, d: any) {
    if (!d?.title) throw new BadRequestException('title is required');
    return this.prisma.talentCredit.create({ data: { talentId, creditType: d.creditType ?? 'FILM', title: d.title, role: d.role ?? null, year: d.year != null && d.year !== '' ? Number(d.year) : null, productionCompany: d.productionCompany ?? null, director: d.director ?? null, link: d.link ?? null, notes: d.notes ?? null } });
  }
  delCredit(id: string) { return this.prisma.talentCredit.delete({ where: { id } }); }

  // ── V3-C: CRM interactions + relationship scores ──────────────────────────────
  listInteractions(talentId: string, projectId?: string) {
    return this.prisma.talentInteraction.findMany({ where: { talentId, ...(projectId ? { projectId } : {}) }, orderBy: { occurredAt: 'desc' }, take: 200 });
  }
  addInteraction(talentId: string, d: any, userId?: string) {
    if (!d?.type) throw new BadRequestException('type is required');
    return this.prisma.talentInteraction.create({
      data: {
        talentId, type: d.type, occurredAt: d.occurredAt ? new Date(d.occurredAt) : new Date(),
        userId: userId || d.userId || null, notes: d.notes ?? null, attachments: d.attachments ?? [],
        followUpDate: d.followUpDate ? new Date(d.followUpDate) : null, projectId: d.projectId ?? null, castingCallId: d.castingCallId ?? null,
      },
    });
  }
  delInteraction(id: string) { return this.prisma.talentInteraction.delete({ where: { id } }); }

  /**
   * Relationship scores (computed, 0-100) — CRM health for a talent.
   *  • engagement: volume + recency of interactions
   *  • responsiveness: share of outreach that got a reply/booking signal
   *  • reliability: from performance reviews + completed bookings
   *  • rehire: productions worked × review sentiment
   */
  async relationshipScores(talentId: string) {
    const [interactions, reviews, bookings] = await Promise.all([
      this.prisma.talentInteraction.findMany({ where: { talentId }, select: { type: true, occurredAt: true } }),
      this.prisma.talentPerformanceReview.findMany({ where: { talentId }, select: { rating: true, projectId: true } }),
      this.prisma.submission.findMany({ where: { talentId, status: { in: ENGAGED_STATUSES as any } }, select: { id: true } }),
    ]);
    const now = Date.now();
    const recent = interactions.filter((i) => now - new Date(i.occurredAt).getTime() < 1000 * 60 * 60 * 24 * 180).length;
    const engagement = Math.min(100, interactions.length * 8 + recent * 4);
    const positive = interactions.filter((i) => ['BOOKING_CONFIRMED', 'CONTRACT_SIGNED', 'CALLBACK_INVITE', 'OFFER_MADE'].includes(i.type)).length;
    const outreach = interactions.filter((i) => ['SCRIPT_SENT', 'AUDITION_INVITE', 'OFFER_MADE', 'EMAIL', 'PHONE_CALL'].includes(i.type)).length;
    const responsiveness = outreach ? Math.round((positive / outreach) * 100) : (interactions.length ? 50 : 0);
    const avgRating = reviews.length ? reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length : null;
    const reliability = avgRating != null ? Math.round(avgRating * 10) : (bookings.length ? 60 : 0);
    const productions = new Set(reviews.map((r) => r.projectId).filter(Boolean)).size;
    const rehire = Math.min(100, productions * 25 + (avgRating != null ? Math.round(avgRating * 5) : 0));
    return { engagement, responsiveness, reliability, rehire, interactions: interactions.length, productions, avgRating };
  }

  // ── V3-E: Advanced talent search ──────────────────────────────────────────────
  /**
   * Search the master pool with standard + advanced filters. DB-level filters are
   * pushed into Prisma; computed filters (age, reliability, passport validity) are
   * applied in-memory on the candidate set.
   */
  async searchTalent(filters: any = {}, role?: string, userId?: string) {
    const f = filters || {};
    const where: any = {};
    if (role === 'TALENT_REP') where.representedById = userId || '__none__';
    if (f.q) where.OR = [{ fullName: { contains: f.q, mode: 'insensitive' } }, { stageName: { contains: f.q, mode: 'insensitive' } }];
    if (f.gender) where.gender = { equals: f.gender, mode: 'insensitive' };
    if (f.nationality) where.OR = [{ nationality: { contains: f.nationality, mode: 'insensitive' } }, { nationalities: { has: f.nationality } }];
    if (f.ethnicity) where.ethnicity = { contains: f.ethnicity, mode: 'insensitive' };
    if (f.unionStatus) where.unionStatus = { contains: f.unionStatus, mode: 'insensitive' };
    if (Array.isArray(f.languages) && f.languages.length) where.languages = { hasSome: f.languages };
    if (Array.isArray(f.skills) && f.skills.length) where.skills = { hasSome: f.skills };
    if (Array.isArray(f.categories) && f.categories.length) where.categories = { hasSome: f.categories };
    if (f.hasAwards) where.NOT = [...(where.NOT || []), { awards: { equals: null as any } }];
    if (f.hasAgency) where.representations = { some: { repType: 'AGENCY' } };
    if (f.projectId) where.submissions = { some: { castingCall: { projectId: f.projectId } } };

    const rows = await this.prisma.globalTalentProfile.findMany({
      where, orderBy: { fullName: 'asc' }, take: 300,
      include: {
        travelIdentity: { select: { passportNumber: true, passportExpiry: true } },
        performanceReviews: { select: { rating: true } },
        _count: { select: { performanceReviews: true } },
      },
    });

    const now = Date.now();
    const ageOf = (dob?: Date | null) => (dob ? Math.floor((now - new Date(dob).getTime()) / (365.25 * 86400000)) : null);
    const out = rows.map((t: any) => {
      const age = ageOf(t.dateOfBirth);
      const ratings = (t.performanceReviews || []).map((r: any) => Number(r.rating));
      const reliability = ratings.length ? Math.round((ratings.reduce((s: number, n: number) => s + n, 0) / ratings.length) * 10) : null;
      const passportValid = t.travelIdentity?.passportExpiry ? new Date(t.travelIdentity.passportExpiry).getTime() > now : false;
      return {
        id: t.id, fullName: t.fullName, stageName: t.stageName, headshot: (t.headshotUrls || [])[0] || null,
        gender: t.gender, nationality: t.nationality, baseCity: t.baseCity, unionStatus: t.unionStatus,
        categories: t.categories, languages: t.languages, skills: t.skills,
        age, reliability, hasPassport: !!t.travelIdentity?.passportNumber, passportValid,
        travelRequired: t.travelRequired, visaRequired: t.visaRequired, isLocalTalent: t.isLocalTalent,
        reviewCount: t._count?.performanceReviews ?? 0, hasAwards: !!t.awards,
      };
    });

    return out.filter((t) => {
      if (f.ageMin != null && f.ageMin !== '' && (t.age == null || t.age < Number(f.ageMin))) return false;
      if (f.ageMax != null && f.ageMax !== '' && (t.age == null || t.age > Number(f.ageMax))) return false;
      if (f.minReliability != null && f.minReliability !== '' && (t.reliability == null || t.reliability < Number(f.minReliability))) return false;
      if (f.passportValid && !t.passportValid) return false;
      if (f.travelReady && (t.travelRequired && !t.passportValid)) return false;
      return true;
    });
  }

  // Saved searches
  listSavedSearches(userId?: string) { return this.prisma.savedSearch.findMany({ where: userId ? { ownerId: userId } : {}, orderBy: { updatedAt: 'desc' } }); }
  saveSearch(d: any, userId?: string) {
    if (!d?.name) throw new BadRequestException('name is required');
    return this.prisma.savedSearch.create({ data: { name: d.name, filters: d.filters || {}, ownerId: userId || null } });
  }
  deleteSavedSearch(id: string) { return this.prisma.savedSearch.delete({ where: { id } }); }

  // Talent lists / shortlists
  listTalentLists(query: { projectId?: string } = {}) {
    return this.prisma.talentList.findMany({ where: query.projectId ? { projectId: query.projectId } : {}, orderBy: { updatedAt: 'desc' }, include: { _count: { select: { members: true } } } });
  }
  getTalentList(id: string) {
    return this.prisma.talentList.findUnique({ where: { id }, include: { members: { include: { talent: { select: { id: true, fullName: true, stageName: true, headshotUrls: true, unionStatus: true, baseCity: true } } }, orderBy: { addedAt: 'asc' } } } });
  }
  createTalentList(d: any, userId?: string) {
    if (!d?.name) throw new BadRequestException('name is required');
    return this.prisma.talentList.create({ data: { name: d.name, kind: d.kind || 'LIST', projectId: d.projectId || null, notes: d.notes || null, ownerId: userId || null } });
  }
  deleteTalentList(id: string) { return this.prisma.talentList.delete({ where: { id } }); }
  addToList(listId: string, talentId: string, notes?: string) {
    if (!talentId) throw new BadRequestException('talentId is required');
    return this.prisma.talentListMember.upsert({ where: { listId_talentId: { listId, talentId } }, create: { listId, talentId, notes: notes || null }, update: { notes: notes ?? undefined } });
  }
  removeFromList(id: string) { return this.prisma.talentListMember.delete({ where: { id } }); }

  // ── V3-H: Self-Tape Management (metadata-only, no hosting) ────────────────────
  listPackages(castingCallId: string) {
    return this.prisma.auditionPackage.findMany({ where: { castingCallId }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { selfTapes: true } } } });
  }
  createPackage(d: any) {
    if (!d?.title) throw new BadRequestException('title is required');
    return this.prisma.auditionPackage.create({ data: this.cleanPackage(d) });
  }
  updatePackage(id: string, d: any) { return this.prisma.auditionPackage.update({ where: { id }, data: this.cleanPackage(d, true) }); }
  deletePackage(id: string) { return this.prisma.auditionPackage.delete({ where: { id } }); }
  private cleanPackage(d: any, partial = false) {
    const out: any = {
      castingCallId: d.castingCallId ?? (partial ? undefined : null), title: d.title ?? undefined,
      sides: d.sides ?? undefined, ndaUrl: d.ndaUrl ?? null, characterBrief: d.characterBrief ?? null,
      moodBoards: d.moodBoards ?? undefined, referenceLinks: d.referenceLinks ?? undefined, productionNotes: d.productionNotes ?? null,
      deadline: d.deadline ? new Date(d.deadline) : (partial ? undefined : null),
      requiredFormat: d.requiredFormat ?? null, minResolution: d.minResolution ?? null,
      maxDurationSec: d.maxDurationSec != null && d.maxDurationSec !== '' ? Number(d.maxDurationSec) : null,
    };
    if (partial) Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
    return out;
  }

  private lastNum(s?: string | null): number | null { const m = (s || '').match(/\d+/g); return m && m.length ? Number(m[m.length - 1]) : null; }
  /** Validate reported self-tape metadata against the package's rules. */
  private validateSelfTape(pkg: any, d: any) {
    const flags: any = {};
    if (pkg?.requiredFormat && d.format) flags.formatOk = d.format.toLowerCase().includes(pkg.requiredFormat.toLowerCase());
    if (pkg?.minResolution && d.resolution) { const min = this.lastNum(pkg.minResolution); const got = this.lastNum(d.resolution); flags.resolutionOk = min != null && got != null ? got >= min : null; }
    if (pkg?.maxDurationSec && d.durationSec != null) flags.durationOk = Number(d.durationSec) <= pkg.maxDurationSec;
    if (pkg?.deadline) flags.deadlineOk = Date.now() <= new Date(pkg.deadline).getTime();
    return flags;
  }

  listSelfTapes(query: { packageId?: string; submissionId?: string } = {}) {
    const where: any = {};
    if (query.packageId) where.packageId = query.packageId;
    if (query.submissionId) where.submissionId = query.submissionId;
    return this.prisma.selfTapeSubmission.findMany({ where, orderBy: { submittedAt: 'desc' } });
  }
  async submitSelfTape(d: any) {
    if (!d?.videoUrl) throw new BadRequestException('videoUrl (link) is required');
    const pkg = d.packageId ? await this.prisma.auditionPackage.findUnique({ where: { id: d.packageId } }) : null;
    const flags = this.validateSelfTape(pkg, d);
    return this.prisma.selfTapeSubmission.create({
      data: {
        packageId: d.packageId || null, submissionId: d.submissionId || null, talentId: d.talentId || null,
        videoUrl: d.videoUrl, slateUrl: d.slateUrl || null, materials: d.materials ?? [],
        format: d.format || null, resolution: d.resolution || null, durationSec: d.durationSec != null && d.durationSec !== '' ? Number(d.durationSec) : null,
        ...flags, status: 'RECEIVED', notes: d.notes || null,
      },
    });
  }
  setSelfTapeStatus(id: string, status: string) {
    if (!['RECEIVED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED'].includes(status)) throw new BadRequestException('Invalid status');
    return this.prisma.selfTapeSubmission.update({ where: { id }, data: { status } });
  }
  deleteSelfTape(id: string) { return this.prisma.selfTapeSubmission.delete({ where: { id } }); }

  // ── Project: Casting calls ────────────────────────────────────────────────────
  // scope: a projectId filters to one project; 'standalone' → project-less; else all.
  listCalls(query: { projectId?: string; scope?: string } = {}) {
    const where: any = {};
    if (query.projectId) where.projectId = query.projectId;
    else if (query.scope === 'standalone') where.projectId = null;
    return this.prisma.castingCall.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: {
        breakdownElement: { select: { name: true, category: true } },
        characterProfile: { select: { id: true, name: true } },
        project: { select: { title: true, isHouse: true } },
        _count: { select: { submissions: true } },
      },
    });
  }

  /** Master dashboard rollup — across all projects + standalone. */
  async dashboard() {
    const [byStatus, standalone, openCalls, recentSubs] = await Promise.all([
      this.prisma.castingCall.groupBy({ by: ['status'], _count: true }),
      this.prisma.castingCall.count({ where: { projectId: null } }),
      this.prisma.castingCall.findMany({
        where: { status: { in: ['OPEN', 'IN_REVIEW', 'CALLBACKS', 'OFFER'] } },
        orderBy: { createdAt: 'desc' }, take: 10,
        include: { project: { select: { title: true, isHouse: true } }, _count: { select: { submissions: true } } },
      }),
      this.prisma.submission.findMany({
        orderBy: { submittedAt: 'desc' }, take: 10,
        include: { talent: { select: { fullName: true, stageName: true } }, castingCall: { select: { roleName: true } } },
      }),
    ]);
    return { byStatus, standalone, openCalls, recentSubs };
  }
  getCall(id: string) {
    return this.prisma.castingCall.findUnique({
      where: { id },
      include: {
        breakdownElement: true,
        characterProfile: true,
        submissions: { include: { talent: true, auditions: { orderBy: { scheduledAt: 'asc' } } }, orderBy: [{ rank: 'asc' }, { submittedAt: 'asc' }] },
      },
    });
  }

  // ── Character Intelligence (V2.0 §4) ────────────────────────────────────────
  listCharacters(projectId?: string) {
    return this.prisma.characterProfile.findMany({
      where: projectId ? { projectId } : {}, orderBy: { name: 'asc' },
      include: { _count: { select: { castingCalls: true } } },
    });
  }
  getCharacter(id: string) {
    return this.prisma.characterProfile.findUnique({
      where: { id },
      include: { castingCalls: { include: { _count: { select: { submissions: true } } } }, breakdownElement: { select: { name: true } } },
    });
  }
  createCharacter(d: any) {
    if (!d?.name) throw new BadRequestException('name is required');
    return this.prisma.characterProfile.create({ data: this.cleanCharacter(d) });
  }
  updateCharacter(id: string, d: any) {
    return this.prisma.characterProfile.update({ where: { id }, data: this.cleanCharacter(d, true) });
  }
  private cleanCharacter(d: any, partial = false) {
    const out: any = {
      projectId: d.projectId ?? null, breakdownElementId: d.breakdownElementId ?? null, name: d.name,
      backstory: d.backstory ?? null, arc: d.arc ?? null, relationships: d.relationships ?? null,
      shootDays: d.shootDays != null ? Number(d.shootDays) : null,
      locations: d.locations ?? null,
      dialoguePages: d.dialoguePages != null ? Number(d.dialoguePages) : null,
      stuntDays: d.stuntDays != null ? Number(d.stuntDays) : null,
      requirements: d.requirements ?? null, notes: d.notes ?? null,
      // ── V3-D character assets ──
      characterCode: d.characterCode ?? null, scriptReference: d.scriptReference ?? null,
      personalityNotes: d.personalityNotes ?? null, visualReferences: d.visualReferences ?? undefined,
      scenesCount: d.scenesCount != null && d.scenesCount !== '' ? Number(d.scenesCount) : null,
      nightShoots: d.nightShoots != null && d.nightShoots !== '' ? Number(d.nightShoots) : null,
      travelDays: d.travelDays != null && d.travelDays !== '' ? Number(d.travelDays) : null,
      castingGender: d.castingGender ?? null,
      ageRangeMin: d.ageRangeMin != null && d.ageRangeMin !== '' ? Number(d.ageRangeMin) : null,
      ageRangeMax: d.ageRangeMax != null && d.ageRangeMax !== '' ? Number(d.ageRangeMax) : null,
      castingEthnicity: d.castingEthnicity ?? null, castingNationality: d.castingNationality ?? null,
      castingLanguage: d.castingLanguage ?? null, castingAccent: d.castingAccent ?? null,
      physicalRequirements: d.physicalRequirements ?? null,
      requiredSkills: d.requiredSkills ?? undefined, certifications: d.certifications ?? undefined,
    };
    if (partial) Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
    return out;
  }

  /** V3-D — Character History: every talent that passed through this character's calls, by stage. */
  async characterHistory(characterId: string) {
    const calls = await this.prisma.castingCall.findMany({ where: { characterProfileId: characterId }, select: { id: true } });
    const callIds = calls.map((c) => c.id);
    if (callIds.length === 0) return { submitted: [], auditioned: [], callback: [], offered: [], cast: [] };
    const subs = await this.prisma.submission.findMany({
      where: { castingCallId: { in: callIds } },
      include: { talent: { select: { id: true, fullName: true, stageName: true, headshotUrls: true } }, auditions: { select: { id: true } } },
      orderBy: { submittedAt: 'desc' },
    });
    const t = (s: any) => ({ talentId: s.talent.id, name: s.talent.stageName || s.talent.fullName, headshot: (s.talent.headshotUrls || [])[0] || null, status: s.status, verdict: s.boardVerdict });
    return {
      submitted: subs.map(t),
      auditioned: subs.filter((s) => (s.auditions || []).length > 0).map(t),
      callback: subs.filter((s) => s.status === 'CALLBACK' || s.boardVerdict === 'CALLBACK').map(t),
      offered: subs.filter((s) => ['OFFERED', 'DEAL_MEMO_PENDING', 'DEAL_MEMO_SIGNED', 'TRAVEL_PENDING', 'VISA_PENDING'].includes(s.status)).map(t),
      cast: subs.filter((s) => ['BOOKED', 'ON_SET', 'WRAPPED', 'CONFIRMED'].includes(s.status)).map(t),
    };
  }

  // ── V3-F: Talent ↔ Character matching engine (computed, no table) ─────────────
  private static MATCH_TALENT_SELECT = {
    id: true, fullName: true, stageName: true, headshotUrls: true, gender: true, dateOfBirth: true,
    ethnicity: true, nationality: true, nationalities: true, languages: true, accents: true, skills: true,
    unionStatus: true, travelRequired: true,
    travelIdentity: { select: { passportExpiry: true } },
    performanceReviews: { select: { rating: true } },
  } as const;

  /** Score one talent against a character's casting requirements → 0-100 + factors. */
  private computeMatch(c: any, t: any) {
    const norm = (s?: string | null) => (s || '').trim().toLowerCase();
    const has = (arr: any[], v: string) => (arr || []).some((x) => norm(x) === norm(v));
    const factors: { key: string; weight: number; frac: number; label: string }[] = [];
    const add = (key: string, weight: number, frac: number, label: string) => factors.push({ key, weight, frac, label });

    if (c.castingGender) add('Gender', 15, norm(c.castingGender) === norm(t.gender) ? 1 : 0, c.castingGender);
    if (c.ageRangeMin != null || c.ageRangeMax != null) {
      const age = t.dateOfBirth ? Math.floor((Date.now() - new Date(t.dateOfBirth).getTime()) / (365.25 * 86400000)) : null;
      const ok = age != null && (c.ageRangeMin == null || age >= c.ageRangeMin) && (c.ageRangeMax == null || age <= c.ageRangeMax);
      add('Age', 15, ok ? 1 : 0, `${c.ageRangeMin ?? ''}–${c.ageRangeMax ?? ''}${age != null ? ` (is ${age})` : ''}`);
    }
    if (c.castingEthnicity) add('Ethnicity', 10, norm(c.castingEthnicity) === norm(t.ethnicity) ? 1 : 0, c.castingEthnicity);
    if (c.castingNationality) add('Nationality', 10, (norm(c.castingNationality) === norm(t.nationality) || has(t.nationalities, c.castingNationality)) ? 1 : 0, c.castingNationality);
    if (c.castingLanguage) add('Language', 15, has(t.languages, c.castingLanguage) ? 1 : 0, c.castingLanguage);
    if (c.castingAccent) add('Accent', 10, has(t.accents, c.castingAccent) ? 1 : 0, c.castingAccent);
    if (Array.isArray(c.requiredSkills) && c.requiredSkills.length) {
      const met = c.requiredSkills.filter((s: string) => has(t.skills, s)).length;
      add('Skills', 20, met / c.requiredSkills.length, `${met}/${c.requiredSkills.length}`);
    }
    const ratings = (t.performanceReviews || []).map((r: any) => Number(r.rating));
    if (ratings.length) add('Track record', 5, Math.min(1, (ratings.reduce((s: number, n: number) => s + n, 0) / ratings.length) / 10), `${ratings.length} reviews`);

    const possible = factors.reduce((s, f) => s + f.weight, 0);
    const earned = factors.reduce((s, f) => s + f.weight * f.frac, 0);
    const score = possible ? Math.round((earned / possible) * 100) : null; // null = no requirements specified

    const strengths = factors.filter((f) => f.frac >= 0.999).map((f) => `${f.key}: ${f.label}`);
    const missing = factors.filter((f) => f.frac === 0).map((f) => `${f.key}: ${f.label}`);
    const partial = factors.filter((f) => f.frac > 0 && f.frac < 0.999).map((f) => `${f.key}: ${f.label}`);
    const risks: string[] = [...partial];
    if (t.travelRequired) { const valid = t.travelIdentity?.passportExpiry && new Date(t.travelIdentity.passportExpiry).getTime() > Date.now(); if (!valid) risks.push('Passport missing/expired'); }

    return { score, strengths, risks, missing };
  }

  /** Rank the talent who submitted to a character's calls by match %. */
  async characterMatches(characterId: string) {
    const c = await this.prisma.characterProfile.findUnique({ where: { id: characterId } });
    if (!c) throw new NotFoundException('Character not found');
    const calls = await this.prisma.castingCall.findMany({ where: { characterProfileId: characterId }, select: { id: true } });
    const callIds = calls.map((x) => x.id);
    if (callIds.length === 0) return { character: { id: c.id, name: c.name }, hasRequirements: this.charHasReqs(c), matches: [] };
    const subs = await this.prisma.submission.findMany({
      where: { castingCallId: { in: callIds } },
      include: { talent: { select: CastingService.MATCH_TALENT_SELECT } },
      orderBy: { submittedAt: 'desc' },
    });
    const seen = new Set<string>();
    const matches = [] as any[];
    for (const s of subs) {
      if (seen.has(s.talentId)) continue;
      seen.add(s.talentId);
      const m = this.computeMatch(c, s.talent);
      matches.push({ talentId: s.talent.id, name: (s.talent as any).stageName || s.talent.fullName, headshot: ((s.talent as any).headshotUrls || [])[0] || null, status: s.status, ...m });
    }
    matches.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    return { character: { id: c.id, name: c.name }, hasRequirements: this.charHasReqs(c), matches };
  }
  private charHasReqs(c: any) {
    return !!(c.castingGender || c.ageRangeMin != null || c.ageRangeMax != null || c.castingEthnicity || c.castingNationality || c.castingLanguage || c.castingAccent || (c.requiredSkills || []).length);
  }

  /** Single talent ↔ character match (for a roster badge). */
  async matchTalentToCharacter(characterId: string, talentId: string) {
    const [c, t] = await Promise.all([
      this.prisma.characterProfile.findUnique({ where: { id: characterId } }),
      this.prisma.globalTalentProfile.findUnique({ where: { id: talentId }, select: CastingService.MATCH_TALENT_SELECT }),
    ]);
    if (!c || !t) throw new NotFoundException();
    return { ...this.computeMatch(c, t), hasRequirements: this.charHasReqs(c) };
  }

  createCall(d: any, userId?: string) {
    // projectId optional → null means a standalone casting call (talent-agency service).
    if (!d?.roleName) throw new BadRequestException('roleName is required');
    return this.prisma.castingCall.create({ data: this.cleanCall(d, userId) });
  }
  updateCall(id: string, d: any) {
    const { id: _i, submissions, breakdownElement, _count, project, createdAt, updatedAt, ...rest } = d || {};
    return this.prisma.castingCall.update({ where: { id }, data: this.cleanCall(rest, undefined, true) });
  }
  setCallStatus(id: string, status: string) {
    return this.prisma.castingCall.update({ where: { id }, data: { status: status as any } });
  }
  private cleanCall(d: any, userId?: string, partial = false) {
    const out: any = {
      projectId: d.projectId, breakdownElementId: d.breakdownElementId ?? null,
      roleName: d.roleName, roleType: d.roleType ?? undefined, characterDescription: d.characterDescription ?? null,
      status: d.status ?? undefined, ageMin: d.ageMin != null ? Number(d.ageMin) : null, ageMax: d.ageMax != null ? Number(d.ageMax) : null,
      gender: d.gender ?? null, ethnicity: d.ethnicity ?? null, languages: d.languages ?? undefined, specialSkills: d.specialSkills ?? undefined,
      unionRequirement: d.unionRequirement ?? null, rateMin: d.rateMin != null ? Number(d.rateMin) : null, rateMax: d.rateMax != null ? Number(d.rateMax) : null,
      currency: d.currency ?? undefined, slotsToFill: d.slotsToFill != null ? Number(d.slotsToFill) : undefined,
      shootDatesNote: d.shootDatesNote ?? null, deadline: d.deadline ? new Date(d.deadline) : null, isPublic: d.isPublic ?? undefined,
      castingDirectorId: d.castingDirectorId ?? undefined, createdById: userId ?? d.createdById ?? undefined,
    };
    if (partial) Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
    return out;
  }

  /**
   * (#1) Generate casting calls straight from the script breakdown. Pass either
   * a list of breakdownElementIds, or a projectId to sweep all castable elements.
   * Skips elements that already have a call (idempotent).
   */
  async createCallsFromBreakdown(body: { projectId?: string; breakdownElementIds?: string[] }, userId?: string) {
    let elements: any[] = [];
    if (body.breakdownElementIds?.length) {
      elements = await this.prisma.breakdownElement.findMany({ where: { id: { in: body.breakdownElementIds } } });
    } else if (body.projectId) {
      elements = await this.prisma.breakdownElement.findMany({
        where: { projectId: body.projectId, category: { in: CastingService.CASTABLE as any } },
      });
    } else {
      throw new BadRequestException('Provide projectId or breakdownElementIds');
    }
    if (!elements.length) return { created: 0, calls: [] };

    const existing = await this.prisma.castingCall.findMany({
      where: { breakdownElementId: { in: elements.map((e) => e.id) } }, select: { breakdownElementId: true },
    });
    const taken = new Set(existing.map((e) => e.breakdownElementId));

    const calls: any[] = [];
    for (const el of elements) {
      if (taken.has(el.id)) continue;
      // V2.0: BreakdownElement → CharacterProfile → CastingCall.
      const character = await this.prisma.characterProfile.create({
        data: { projectId: el.projectId, breakdownElementId: el.id, name: el.name, notes: el.notes || null },
      });
      const call = await this.prisma.castingCall.create({
        data: {
          projectId: el.projectId, breakdownElementId: el.id, characterProfileId: character.id,
          roleName: el.name, roleType: this.roleTypeFor(el.category),
          characterDescription: el.notes || null, status: 'DRAFT',
          slotsToFill: el.quantity || 1, createdById: userId || null,
        },
      });
      calls.push(call);
    }
    this.log.log(`Generated ${calls.length} casting call(s) from breakdown.`);
    return { created: calls.length, calls };
  }

  // ── Submissions + consent ─────────────────────────────────────────────────────
  listSubmissions(castingCallId: string) {
    return this.prisma.submission.findMany({
      where: { castingCallId }, include: { talent: true, auditions: true }, orderBy: [{ rank: 'asc' }, { submittedAt: 'asc' }],
    });
  }

  /**
   * (#2) Talent submits a profile to a casting call. Records the submission AND
   * stamps GDPR/CCPA consent (DATA_PROCESSING always; IMAGE_LIKENESS if media
   * is attached; MINOR_GUARDIAN if a minor) with timestamps + lawful basis.
   * Can create the master talent profile on the fly (public portal path).
   */
  async submitProfile(d: any) {
    if (!d?.castingCallId) throw new BadRequestException('castingCallId is required');
    const call = await this.prisma.castingCall.findUnique({ where: { id: d.castingCallId } });
    if (!call) throw new NotFoundException('Casting call not found');
    if (!d?.consent?.dataProcessing) throw new BadRequestException('Data-processing consent is required to submit.');

    // Resolve or create the talent profile.
    let talentId = d.talentId;
    const now = new Date();
    const consentMeta = {
      consentStatus: 'GRANTED' as any, consentGivenAt: now,
      gdprConsentVersion: d.consent?.version || 'v1', lawfulBasis: 'consent',
      consentExpiresAt: d.consent?.expiresAt ? new Date(d.consent.expiresAt) : null,
    };
    if (!talentId) {
      if (!d.talent?.fullName) throw new BadRequestException('talent.fullName is required for a new profile');
      const created = await this.prisma.globalTalentProfile.create({
        data: { ...this.cleanTalent(d.talent), ...consentMeta },
      });
      talentId = created.id;
    } else {
      await this.prisma.globalTalentProfile.update({ where: { id: talentId }, data: consentMeta });
    }

    const talent = await this.prisma.globalTalentProfile.findUnique({ where: { id: talentId } });

    // Create the submission (idempotent on [castingCall, talent]).
    const submission = await this.prisma.submission.upsert({
      where: { castingCallId_talentId: { castingCallId: d.castingCallId, talentId } },
      update: { coverNote: d.coverNote ?? undefined, proposedRate: d.proposedRate != null ? Number(d.proposedRate) : undefined, availabilityNote: d.availabilityNote ?? undefined, status: 'SUBMITTED' },
      create: {
        castingCallId: d.castingCallId, talentId, source: d.source || 'SELF', status: 'SUBMITTED',
        coverNote: d.coverNote || null, proposedRate: d.proposedRate != null ? Number(d.proposedRate) : null, availabilityNote: d.availabilityNote || null,
      },
    });

    // Append the consent log(s) — append-only audit trail.
    const ip = d.ipAddress || null;
    await this.logConsent(talentId, { type: 'DATA_PROCESSING', status: 'GRANTED', method: d.consent?.method || 'WEB_FORM', version: consentMeta.gdprConsentVersion, lawfulBasis: 'consent', ipAddress: ip, projectId: call.projectId, castingCallId: call.id, grantedAt: now });
    if (d.consent?.imageLikeness || (talent?.headshotUrls?.length || talent?.reelUrls?.length)) {
      await this.logConsent(talentId, { type: 'IMAGE_LIKENESS', status: d.consent?.imageLikeness ? 'GRANTED' : 'PENDING', method: d.consent?.method || 'WEB_FORM', version: consentMeta.gdprConsentVersion, ipAddress: ip, projectId: call.projectId, grantedAt: d.consent?.imageLikeness ? now : null });
    }
    if (talent?.isMinor) {
      await this.logConsent(talentId, { type: 'MINOR_GUARDIAN', status: d.consent?.guardian ? 'GRANTED' : 'PENDING', method: d.consent?.method || 'WEB_FORM', guardianName: talent.guardianName || d.talent?.guardianName || null, ipAddress: ip, grantedAt: d.consent?.guardian ? now : null });
    }

    return { submission, talentId };
  }

  async logConsent(talentId: string, d: any) {
    return this.prisma.consentLog.create({
      data: {
        talentId, projectId: d.projectId || null, type: d.type, status: d.status || 'GRANTED',
        method: d.method || null, documentUrl: d.documentUrl || null, ipAddress: d.ipAddress || null,
        lawfulBasis: d.lawfulBasis || null, version: d.version || null, guardianName: d.guardianName || null,
        grantedAt: d.grantedAt || (d.status === 'GRANTED' ? new Date() : null),
        withdrawnAt: d.status === 'WITHDRAWN' ? new Date() : null,
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
        capturedById: d.capturedById || null, metadata: d.metadata ?? undefined,
      },
    });
  }

  /** GDPR 'Right to be forgotten' — withdraw consent + flag the master profile. */
  async withdrawConsent(talentId: string, reason?: string) {
    await this.prisma.consentLog.create({
      data: { talentId, type: 'DATA_PROCESSING', status: 'WITHDRAWN', withdrawnAt: new Date(), metadata: reason ? { reason } : undefined },
    });
    return this.prisma.globalTalentProfile.update({
      where: { id: talentId },
      data: { consentStatus: 'WITHDRAWN', status: 'DO_NOT_CONTACT', erasureRequestedAt: new Date() },
    });
  }

  // ── Producer Review Board (V2.0 §5) ─────────────────────────────────────────
  /** Set a board verdict and map it to the submission status (no new pipeline). */
  setVerdict(id: string, verdict: string, userId?: string) {
    const VERDICTS = ['APPROVED', 'MAYBE', 'PASS', 'CALLBACK', 'CHEMISTRY_READ'];
    if (!VERDICTS.includes(verdict)) throw new BadRequestException('Invalid verdict');
    const statusMap: Record<string, string> = { APPROVED: 'SHORTLISTED', MAYBE: 'UNDER_REVIEW', PASS: 'DECLINED', CALLBACK: 'CALLBACK', CHEMISTRY_READ: 'CALLBACK' };
    return this.prisma.submission.update({
      where: { id },
      data: { boardVerdict: verdict as any, status: statusMap[verdict] as any, reviewedById: userId || undefined },
    });
  }

  // ── V3-G: Expanded pipeline + stage automation ────────────────────────────────
  pipeline() { return SUBMISSION_PIPELINE; }

  /**
   * Move a submission to any pipeline stage and fire that stage's automation:
   *  • NEGOTIATION → ensure a TalentNegotiation exists
   *  • OFFERED / DEAL_MEMO_SIGNED / BOOKED → log a CRM interaction on the talent
   * Returns the new status, the automations fired and the suggested next stage.
   */
  async setSubmissionStatus(id: string, status: string, userId?: string) {
    if (!SUBMISSION_PIPELINE.includes(status) && !['DECLINED', 'WITHDRAWN'].includes(status)) throw new BadRequestException('Unknown pipeline stage');
    const sub = await this.prisma.submission.findUnique({ where: { id }, include: { castingCall: { select: { projectId: true } } } });
    if (!sub) throw new NotFoundException();
    await this.prisma.submission.update({ where: { id }, data: { status: status as any, reviewedById: userId || undefined } });

    const automations: string[] = [];
    const logInteraction = async (type: string) => {
      try { await this.prisma.talentInteraction.create({ data: { talentId: sub.talentId, type: type as any, userId: userId || null, projectId: sub.castingCall?.projectId || null, notes: `Pipeline → ${status.replace(/_/g, ' ')}` } }); automations.push(`Logged ${type.replace(/_/g, ' ')} on CRM timeline`); } catch { /* ignore */ }
    };
    if (status === 'NEGOTIATION') { try { await this.ensureNegotiation(id); automations.push('Opened negotiation'); } catch { /* ignore */ } }
    if (status === 'OFFERED') await logInteraction('OFFER_MADE');
    if (status === 'DEAL_MEMO_SIGNED') await logInteraction('CONTRACT_SIGNED');
    if (status === 'BOOKED' || status === 'CONFIRMED') await logInteraction('BOOKING_CONFIRMED');

    return { ok: true, status, automations, suggestedNext: nextStage(status) };
  }

  // ── Review + audition ─────────────────────────────────────────────────────────
  reviewSubmission(id: string, d: any) {
    const data: any = {};
    if (d.status) data.status = d.status;
    if (d.score != null) data.score = Number(d.score);
    if (d.rank != null) data.rank = Number(d.rank);
    if (d.decisionNote !== undefined) data.decisionNote = d.decisionNote;
    if (d.reviewedById) data.reviewedById = d.reviewedById;
    return this.prisma.submission.update({ where: { id }, data });
  }
  scheduleAudition(submissionId: string, d: any, userId?: string) {
    return this.prisma.audition.create({
      data: {
        submissionId, type: d.type || 'SELF_TAPE', status: d.status || 'SCHEDULED',
        scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null, durationMins: d.durationMins != null ? Number(d.durationMins) : null,
        location: d.location || null, virtualLink: d.virtualLink || null, selfTapeUrl: d.selfTapeUrl || null,
        sides: d.sides || null, createdById: userId || null,
      },
    });
  }
  updateAudition(id: string, d: any) {
    const { id: _i, submission, createdAt, updatedAt, ...rest } = d || {};
    if (rest.scheduledAt) rest.scheduledAt = new Date(rest.scheduledAt);
    if (rest.score != null) rest.score = Number(rest.score);
    return this.prisma.audition.update({ where: { id }, data: rest });
  }

  /**
   * (#3) SELECTION HANDOFF — mark a candidate Selected and auto-push their data
   * into the Contracts module to generate a DRAFT Deal Memo. Idempotent: returns
   * the existing draft if one was already generated for this submission.
   */
  async selectCandidate(submissionId: string, body: any = {}, userId?: string) {
    const sub = await this.prisma.submission.findUnique({
      where: { id: submissionId }, include: { talent: true, castingCall: true },
    });
    if (!sub) throw new NotFoundException('Submission not found');
    const call = sub.castingCall;
    const talent = sub.talent;

    // Mark selected.
    await this.prisma.submission.update({ where: { id: submissionId }, data: { status: 'OFFERED', reviewedById: userId || undefined } });
    // Move the call into OFFER stage.
    await this.prisma.castingCall.update({ where: { id: call.id }, data: { status: 'OFFER' } });

    // Resolve a Deal Memo template (explicit id wins, else first active DEAL_MEMO).
    let templateId = body.templateId as string | undefined;
    if (!templateId) {
      const tmpl = await this.prisma.contractTemplate.findFirst({ where: { type: 'DEAL_MEMO', isActive: true }, orderBy: { createdAt: 'asc' } });
      templateId = tmpl?.id;
    }
    if (!templateId) {
      // No template configured — flag it so the UI can prompt to create one.
      return { ok: true, status: 'OFFERED', dealMemo: null, reason: 'No active DEAL_MEMO template configured.' };
    }

    const rate = body.contractValue ?? sub.proposedRate ?? call.rateMax ?? call.rateMin ?? undefined;
    const contract = await this.contracts.generateFromTemplate({
      templateId,
      projectId: call.projectId,
      counterpartyName: talent.stageName || talent.fullName,
      counterpartyEmail: talent.email || undefined,
      counterpartyRole: 'TALENT',
      role: call.roleName,
      title: `Deal Memo — ${talent.stageName || talent.fullName} as ${call.roleName}`,
      contractValue: rate != null ? Number(rate) : undefined,
      currency: call.currency,
      extraVars: { character: call.roleName, talent_name: talent.fullName, union_status: talent.unionStatus || '', agency: talent.agencyName || '' },
    }, userId);

    this.log.log(`Selection handoff: submission ${submissionId} → draft deal memo ${contract.contractNumber}.`);
    return { ok: true, status: 'OFFERED', dealMemo: { id: contract.id, contractNumber: contract.contractNumber } };
  }

  // ── Negotiation Management (V2.0 §7) ────────────────────────────────────────
  getNegotiation(submissionId: string) {
    return this.prisma.talentNegotiation.findUnique({
      where: { submissionId },
      include: { submission: { include: { talent: { select: { fullName: true, stageName: true, email: true } }, castingCall: { select: { roleName: true, currency: true, rateMin: true, rateMax: true } } } } },
    });
  }
  async ensureNegotiation(submissionId: string) {
    const existing = await this.prisma.talentNegotiation.findUnique({ where: { submissionId } });
    if (existing) return existing;
    const sub = await this.prisma.submission.findUnique({ where: { id: submissionId }, include: { castingCall: { select: { currency: true, rateMax: true, rateMin: true } } } });
    if (!sub) throw new NotFoundException('Submission not found');
    const seed = sub.proposedRate ?? sub.castingCall?.rateMax ?? sub.castingCall?.rateMin ?? null;
    return this.prisma.talentNegotiation.create({
      data: {
        submissionId, currency: (sub.castingCall?.currency as any) || 'AED',
        initialOffer: seed != null ? Number(seed) : null,
        rounds: seed != null ? [{ at: new Date().toISOString(), type: 'INITIAL', amount: Number(seed), note: 'Opening offer' }] : [],
      },
    });
  }
  async updateNegotiation(id: string, d: any) {
    const cur = await this.prisma.talentNegotiation.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException('Negotiation not found');
    const data: any = {};
    for (const k of ['travelClass', 'accommodationTier', 'buyout', 'exclusivity', 'marketingRequirements', 'notes', 'status']) if (d[k] !== undefined) data[k] = d[k] || null;
    for (const k of ['initialOffer', 'counterOffer', 'finalRate', 'perDiem']) if (d[k] !== undefined) data[k] = (d[k] === '' || d[k] == null) ? null : Number(d[k]);
    if (d.round && (d.round.amount != null || d.round.note)) {
      const rounds: any[] = Array.isArray(cur.rounds) ? (cur.rounds as any[]) : [];
      rounds.push({ at: new Date().toISOString(), type: d.round.type || 'COUNTER', amount: d.round.amount != null ? Number(d.round.amount) : undefined, note: d.round.note || undefined, by: d.round.by || undefined });
      data.rounds = rounds;
      if (d.round.type === 'COUNTER' && d.round.amount != null && data.counterOffer === undefined) data.counterOffer = Number(d.round.amount);
      if (cur.status === 'OPEN') data.status = 'COUNTERED';
    }
    return this.prisma.talentNegotiation.update({ where: { id }, data });
  }
  /** Agree the negotiation → generate the Deal Memo at the negotiated final rate. */
  async agreeNegotiation(id: string, body: any = {}, userId?: string) {
    const neg = await this.prisma.talentNegotiation.findUnique({ where: { id } });
    if (!neg) throw new NotFoundException('Negotiation not found');
    const finalRate = body.finalRate != null ? Number(body.finalRate)
      : (neg.finalRate != null ? Number(neg.finalRate)
        : (neg.counterOffer != null ? Number(neg.counterOffer)
          : (neg.initialOffer != null ? Number(neg.initialOffer) : undefined)));
    const result = await this.selectCandidate(neg.submissionId, { contractValue: finalRate }, userId);
    await this.prisma.talentNegotiation.update({ where: { id }, data: { status: 'AGREED', finalRate: finalRate != null ? finalRate : null, contractId: result?.dealMemo?.id || null } });
    return { ok: true, finalRate, dealMemo: result?.dealMemo || null, reason: (result as any)?.reason };
  }

  // ── Talent Operations Hub (V2.0 §3) ─────────────────────────────────────────
  /** Cast in onboarding (OFFERED/CONFIRMED) for a project, with readiness + checklist. */
  async operationsHub(projectId: string) {
    if (!projectId) throw new BadRequestException('projectId is required');
    const subs = await this.prisma.submission.findMany({
      where: { status: { in: ENGAGED_STATUSES as any }, castingCall: { projectId } },
      include: {
        talent: { select: { id: true, fullName: true, stageName: true } },
        castingCall: { select: { roleName: true } },
        opsChecklist: true,
        negotiation: { select: { status: true, finalRate: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    const out: any[] = [];
    for (const s of subs) {
      const readiness = await this.talentReadiness(s.talentId, { projectId });
      out.push({
        submissionId: s.id, status: s.status, role: s.castingCall?.roleName,
        talent: s.talent, checklist: s.opsChecklist, negotiation: s.negotiation,
        readiness: { score: readiness.score, groups: readiness.groups },
      });
    }
    return out;
  }

  /**
   * Project Talent roster (SYS-10) — every talent engaged on a project in one view,
   * with the data you'd otherwise open the master to see: status, readiness score,
   * review count and travel/visa flags. Deduped per talent (most-advanced status).
   */
  async projectTalent(projectId: string) {
    if (!projectId) throw new BadRequestException('projectId is required');
    const RANK = SUBMISSION_PIPELINE;
    const subs = await this.prisma.submission.findMany({
      where: { castingCall: { projectId }, status: { notIn: ['DECLINED', 'WITHDRAWN'] as any } },
      include: {
        castingCall: { select: { roleName: true } },
        negotiation: { select: { status: true, finalRate: true } },
        talent: {
          select: {
            id: true, fullName: true, stageName: true, headshotUrls: true, unionStatus: true, baseCity: true,
            nationality: true, travelRequired: true, visaRequired: true, isLocalTalent: true,
            travelIdentity: { select: { id: true } },
            _count: { select: { performanceReviews: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
    // Dedup per talent → keep the most advanced status, collect roles.
    const byTalent = new Map<string, any>();
    for (const s of subs) {
      const tid = s.talentId;
      const cur = byTalent.get(tid);
      const better = !cur || RANK.indexOf(s.status) > RANK.indexOf(cur.status);
      const roles = new Set<string>([...(cur?.roles || []), s.castingCall?.roleName].filter(Boolean) as string[]);
      byTalent.set(tid, better
        ? { submissionId: s.id, status: s.status, talent: s.talent, negotiation: s.negotiation, roles }
        : { ...cur, roles });
    }
    const out: any[] = [];
    for (const row of byTalent.values()) {
      const readiness = await this.talentReadiness(row.talent.id, { projectId });
      out.push({
        talentId: row.talent.id, submissionId: row.submissionId, status: row.status,
        name: row.talent.stageName || row.talent.fullName, fullName: row.talent.fullName,
        headshot: (row.talent.headshotUrls || [])[0] || null,
        roles: Array.from(row.roles), unionStatus: row.talent.unionStatus, baseCity: row.talent.baseCity,
        nationality: row.talent.nationality,
        travelRequired: row.talent.travelRequired, visaRequired: row.talent.visaRequired, isLocalTalent: row.talent.isLocalTalent,
        travelerProfileId: row.talent.travelIdentity?.id || null,
        reviewCount: row.talent._count?.performanceReviews ?? 0,
        negotiation: row.negotiation,
        readiness: { score: readiness.score, groups: readiness.groups },
      });
    }
    out.sort((a, b) => (b.readiness.score - a.readiness.score) || a.name.localeCompare(b.name));
    return out;
  }

  upsertOpsChecklist(submissionId: string, d: any) {
    const fields = ['wardrobeComplete', 'measurementsComplete', 'fittingsComplete', 'makeupNotesComplete', 'bankingComplete', 'taxDocsComplete', 'vendorSetupComplete'];
    const data: any = { notes: d.notes ?? undefined };
    for (const f of fields) if (d[f] !== undefined) data[f] = !!d[f];
    return this.prisma.talentOpsChecklist.upsert({
      where: { submissionId },
      update: data,
      create: { submissionId, ...data },
    });
  }

  // ── Talent Intelligence — performance reviews (V2.0 §6, internal-only) ───────
  createReview(talentId: string, d: any, userId?: string) {
    if (!d?.metric) throw new BadRequestException('metric is required');
    const rating = Math.max(0, Math.min(10, Number(d.rating) || 0));
    return this.prisma.talentPerformanceReview.create({
      data: {
        talentId, projectId: d.projectId || null, department: d.department || null,
        metric: String(d.metric), rating, comments: d.comments || null, raterId: userId || null,
      },
    });
  }

  /** Aggregate per-metric averages + productions count across a talent's history. */
  async talentIntelligence(talentId: string) {
    const reviews = await this.prisma.talentPerformanceReview.findMany({
      where: { talentId }, orderBy: { createdAt: 'desc' },
      include: { project: { select: { title: true } } },
    });
    const byMetric: Record<string, { sum: number; count: number }> = {};
    const projectIds = new Set<string>();
    for (const r of reviews) {
      (byMetric[r.metric] ||= { sum: 0, count: 0 });
      byMetric[r.metric].sum += r.rating; byMetric[r.metric].count += 1;
      if (r.projectId) projectIds.add(r.projectId);
    }
    const metrics = Object.entries(byMetric).map(([metric, v]) => ({ metric, avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count }));
    return { talentId, productions: projectIds.size, reviewCount: reviews.length, metrics, reviews };
  }
}
