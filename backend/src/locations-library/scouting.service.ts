import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { LocationsLibraryService } from './locations-library.service';

/**
 * SYS-07 slice 2 — Scouting missions & field submissions.
 * Assignments brief a scout; submissions are field candidates; accepting a
 * submission promotes it into the Master Library (and optionally links a project).
 */
@Injectable()
export class ScoutingService {
  constructor(private prisma: PrismaService, private library: LocationsLibraryService) {}

  private readonly A_DATES = ['dueDate'];
  private readonly A_SKIP = ['id', 'createdAt', 'updatedAt', 'submissions'];

  private clean(data: any, dates: string[], skip: string[]) {
    const out: any = {};
    for (const [k, v] of Object.entries(data || {})) {
      if (skip.includes(k)) continue;
      if (v === '') { out[k] = null; continue; }
      if (dates.includes(k)) out[k] = v ? new Date(v as string) : null;
      else out[k] = v;
    }
    return out;
  }

  // ── Assignments ────────────────────────────────────────────────────────────
  listAssignments(q?: { projectId?: string; status?: string }) {
    const where: any = {};
    if (q?.projectId) where.projectId = q.projectId;
    if (q?.status) where.status = q.status;
    return this.prisma.scoutAssignment.findMany({
      where,
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { dueDate: 'asc' }],
      include: { _count: { select: { submissions: true } } },
    });
  }

  async getAssignment(id: string) {
    const a = await this.prisma.scoutAssignment.findUnique({
      where: { id },
      include: { submissions: { orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] } },
    });
    if (!a) throw new NotFoundException('Assignment not found');
    return a;
  }

  async createAssignment(data: any, userId?: string) {
    const d = this.clean(data, this.A_DATES, this.A_SKIP);
    if (!d.projectId) throw new BadRequestException('projectId is required');
    if (!d.title) throw new BadRequestException('title is required');
    return this.prisma.scoutAssignment.create({ data: { ...d, createdById: userId || null } });
  }

  async updateAssignment(id: string, data: any) {
    await this.assertAssignment(id);
    return this.prisma.scoutAssignment.update({ where: { id }, data: this.clean(data, this.A_DATES, this.A_SKIP) });
  }

  private async assertAssignment(id: string) {
    const e = await this.prisma.scoutAssignment.findUnique({ where: { id }, select: { id: true } });
    if (!e) throw new NotFoundException('Assignment not found');
  }

  // ── Submissions ──────────────────────────────────────────────────────────
  /** Idempotent create — reuse a client-minted id if the offline queue replays. */
  async createSubmission(assignmentId: string, data: any, userId?: string) {
    await this.assertAssignment(assignmentId);
    if (data?.clientId) {
      const existing = await this.prisma.scoutSubmission.findUnique({ where: { id: data.clientId } });
      if (existing) return existing;
    }
    if (!data?.candidateName) throw new BadRequestException('candidateName is required');
    const { clientId, ...rest } = data || {};
    const sub = await this.prisma.scoutSubmission.create({
      data: {
        id: clientId || undefined,
        assignmentId,
        candidateName: rest.candidateName,
        summary: rest.summary || null,
        notes: rest.notes || null,
        lat: rest.lat ?? null,
        lng: rest.lng ?? null,
        fullAddress: rest.fullAddress || null,
        googleMapsUrl: rest.googleMapsUrl || null,
        what3words: rest.what3words || null,
        media: rest.media || null,
        ownerName: rest.ownerName || null,
        ownerPhone: rest.ownerPhone || null,
        ownerEmail: rest.ownerEmail || null,
        evaluation: rest.evaluation || null,
        estFeePerDay: rest.estFeePerDay ?? null,
        submittedById: userId || null,
        submittedByName: rest.submittedByName || null,
      },
    });
    // first submission moves an OPEN assignment to SUBMITTED
    await this.prisma.scoutAssignment.updateMany({
      where: { id: assignmentId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      data: { status: 'SUBMITTED' },
    });
    return sub;
  }

  async setSubmissionStatus(id: string, status: string, reviewNotes?: string) {
    const sub = await this.prisma.scoutSubmission.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Submission not found');
    return this.prisma.scoutSubmission.update({
      where: { id },
      data: { status: status as any, reviewNotes: reviewNotes ?? sub.reviewNotes },
    });
  }

  /**
   * Accept a submission → promote it into the Master Library (dedup by name+geo),
   * optionally link the resulting master into the assignment's project.
   */
  async acceptSubmission(id: string, opts: { linkToProject?: boolean } = {}, userId?: string) {
    const sub = await this.prisma.scoutSubmission.findUnique({
      where: { id },
      include: { assignment: true },
    });
    if (!sub) throw new NotFoundException('Submission not found');

    // build a Location-shaped object the library dedup/create understands
    const master = await this.library.findOrCreateMaster({
      name: sub.candidateName,
      type: sub.assignment.locationType,
      country: null,
      emirate: null,
      area: null,
      fullAddress: sub.fullAddress,
      lat: sub.lat,
      lng: sub.lng,
      googleMapsUrl: sub.googleMapsUrl,
      what3words: sub.what3words,
      ownerContactName: sub.ownerName,
      ownerPhone: sub.ownerPhone,
      ownerEmail: sub.ownerEmail,
      locationFeePerDay: sub.estFeePerDay,
      currency: sub.assignment.feeCurrency,
      notes: sub.summary || sub.notes,
    }, userId);

    // carry field photos into the library media gallery
    const media = Array.isArray(sub.media) ? sub.media : [];
    for (const url of media) {
      if (typeof url === 'string' && url) {
        await this.library.addMedia(master.id, { url, type: 'PHOTO', caption: `Scout: ${sub.candidateName}` }, userId).catch(() => {});
      }
    }

    await this.prisma.scoutSubmission.update({
      where: { id },
      data: { status: 'ACCEPTED', acceptedMasterLocationId: master.id },
    });

    let linked = null;
    if (opts.linkToProject) {
      linked = await this.library.linkToProject(master.id, sub.assignment.projectId, {});
    }
    await this.prisma.scoutAssignment.update({ where: { id: sub.assignmentId }, data: { status: 'COMPLETED' } });

    return { masterLocationId: master.id, linkedProjectLocationId: linked?.id || null };
  }
}
