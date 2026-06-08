import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-07 V2 · Slice 3 — Clearance pack.
 * Compiles a scout party's identity documents into a time-limited shareable link (or a
 * printable pack) to send venue management/security ahead of a visit. PII controls are
 * mandatory: only crew who flagged consent ("OK to share my ID with venues") are included,
 * every pack carries an expiry, and all share/view/revoke events are audited.
 */
@Injectable()
export class ClearancePacksService {
  constructor(private prisma: PrismaService) {}

  private async audit(packId: string, event: string, actor?: string, detail?: string, ip?: string) {
    await this.prisma.clearancePackAccess.create({ data: { packId, event, actor: actor || null, detail: detail || null, ip: ip || null } });
  }

  /** List packs for a scope (project, or master when projectId omitted). */
  list(projectId?: string) {
    return this.prisma.clearancePack.findMany({
      where: projectId ? { projectId } : { projectId: null },
      include: { members: true, accesses: { orderBy: { createdAt: 'desc' }, take: 20 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const pack = await this.prisma.clearancePack.findUnique({
      where: { id },
      include: { members: { orderBy: { name: 'asc' } }, accesses: { orderBy: { createdAt: 'desc' } } },
    });
    if (!pack) throw new NotFoundException('Clearance pack not found.');
    return { ...pack, expired: this.isExpired(pack) };
  }

  private isExpired(pack: { expiresAt: Date | null; status: string }) {
    if (pack.status === 'REVOKED') return true;
    return !!pack.expiresAt && pack.expiresAt.getTime() < Date.now();
  }

  /**
   * Build a pack from a scout visit's party. Pulls each member's crew identity docs and
   * consent flag; only consenting members' docs are snapshotted into the pack. Non-consenting
   * members are recorded too (consentGiven=false, no doc URLs) so the gap is visible.
   */
  async buildFromVisit(visitId: string, body: any) {
    const visit = await this.prisma.scoutVisit.findUnique({ where: { id: visitId }, include: { members: true } });
    if (!visit) throw new NotFoundException('Scout visit not found.');
    if (!visit.members.length) throw new BadRequestException('This visit has no party members to clear.');

    const crewIds = visit.members.map(m => m.crewId).filter(Boolean) as string[];
    const crew = crewIds.length
      ? await this.prisma.productionCrew.findMany({ where: { id: { in: crewIds } }, select: { id: true, name: true, roleTitle: true, department: true, idShareConsent: true, passportUrl: true, emiratesIdUrl: true, idPhotoUrl: true } })
      : [];
    const crewMap = new Map(crew.map(c => [c.id, c] as const));

    const days = Number(body?.expiryDays) > 0 ? Number(body.expiryDays) : 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const pack = await this.prisma.clearancePack.create({
      data: {
        projectId: visit.projectId || null,
        visitId,
        title: body?.title || `Clearance — ${visit.title}`,
        purpose: body?.purpose || null,
        recipientName: body?.recipientName || null,
        recipientOrg: body?.recipientOrg || null,
        recipientEmail: body?.recipientEmail || null,
        expiresAt,
        message: body?.message || null,
        createdById: body?.createdById || null,
        members: {
          create: visit.members.map(m => {
            const c = m.crewId ? crewMap.get(m.crewId) : null;
            const consent = !!c?.idShareConsent;
            return {
              crewId: m.crewId || null,
              name: m.name,
              roleTitle: m.roleTitle || c?.roleTitle || null,
              department: m.department || c?.department || null,
              consentGiven: consent,
              passportUrl: consent ? c?.passportUrl || null : null,
              emiratesIdUrl: consent ? c?.emiratesIdUrl || null : null,
              photoUrl: consent ? c?.idPhotoUrl || null : null,
            };
          }),
        },
      },
      include: { members: true },
    });
    await this.audit(pack.id, 'BUILT', body?.createdById, `${pack.members.length} members; ${pack.members.filter(m => m.consentGiven).length} consenting`);
    return { ...pack, expired: false, consentMissing: pack.members.filter(m => !m.consentGiven).map(m => m.name) };
  }

  updatePack(id: string, data: any) {
    const d: any = {};
    for (const k of ['title', 'purpose', 'recipientName', 'recipientOrg', 'recipientEmail', 'message']) if (data?.[k] !== undefined) d[k] = data[k];
    if (data?.expiryDays !== undefined) d.expiresAt = Number(data.expiryDays) > 0 ? new Date(Date.now() + Number(data.expiryDays) * 86400000) : null;
    return this.prisma.clearancePack.update({ where: { id }, data: d });
  }

  async remove(id: string) { return this.prisma.clearancePack.delete({ where: { id } }); }

  /** Re-pull the latest consent + docs from crew (e.g. after a member gives consent). */
  async refresh(id: string) {
    const pack = await this.prisma.clearancePack.findUnique({ where: { id }, include: { members: true } });
    if (!pack) throw new NotFoundException('Clearance pack not found.');
    const crewIds = pack.members.map(m => m.crewId).filter(Boolean) as string[];
    const crew = crewIds.length
      ? await this.prisma.productionCrew.findMany({ where: { id: { in: crewIds } }, select: { id: true, idShareConsent: true, passportUrl: true, emiratesIdUrl: true, idPhotoUrl: true } })
      : [];
    const crewMap = new Map(crew.map(c => [c.id, c] as const));
    for (const m of pack.members) {
      const c = m.crewId ? crewMap.get(m.crewId) : null;
      const consent = !!c?.idShareConsent;
      await this.prisma.clearancePackMember.update({
        where: { id: m.id },
        data: {
          consentGiven: consent,
          passportUrl: consent ? c?.passportUrl || null : null,
          emiratesIdUrl: consent ? c?.emiratesIdUrl || null : null,
          photoUrl: consent ? c?.idPhotoUrl || null : null,
        },
      });
    }
    return this.get(id);
  }

  async share(id: string, body: any) {
    const pack = await this.prisma.clearancePack.findUnique({ where: { id } });
    if (!pack) throw new NotFoundException('Clearance pack not found.');
    if (this.isExpired(pack)) throw new BadRequestException('This pack has expired or been revoked — refresh the expiry first.');
    const updated = await this.prisma.clearancePack.update({ where: { id }, data: { status: 'SHARED', sharedAt: new Date() } });
    await this.audit(id, 'SHARED', body?.actor, `to ${body?.recipientEmail || pack.recipientEmail || 'recipient'}`);
    return updated;
  }

  async revoke(id: string, actor?: string) {
    const pack = await this.prisma.clearancePack.update({ where: { id }, data: { status: 'REVOKED' } });
    await this.audit(id, 'REVOKED', actor);
    return pack;
  }

  /** Crew consent toggle — surfaced from the party UI; stamps the consent timestamp. */
  setConsent(crewId: string, consent: boolean) {
    return this.prisma.productionCrew.update({
      where: { id: crewId },
      data: { idShareConsent: consent, idShareConsentAt: consent ? new Date() : null },
    });
  }

  /** Public resolve by token (no auth) — venues open the link. Logs a VIEWED access. */
  async resolvePublic(token: string, ip?: string) {
    const pack = await this.prisma.clearancePack.findUnique({ where: { token }, include: { members: { orderBy: { name: 'asc' } } } });
    if (!pack) throw new NotFoundException('Link not found.');
    if (this.isExpired(pack)) {
      if (pack.status !== 'REVOKED' && pack.status !== 'EXPIRED') await this.prisma.clearancePack.update({ where: { id: pack.id }, data: { status: 'EXPIRED' } });
      return { expired: true, title: pack.title, status: pack.status === 'REVOKED' ? 'REVOKED' : 'EXPIRED' };
    }
    await this.audit(pack.id, 'VIEWED', 'venue link', undefined, ip);
    let projectName: string | null = null;
    if (pack.projectId) {
      const p = await this.prisma.productionProject.findUnique({ where: { id: pack.projectId }, select: { title: true } });
      projectName = p?.title || null;
    }
    return {
      expired: false,
      title: pack.title,
      purpose: pack.purpose,
      projectName,
      recipientName: pack.recipientName,
      recipientOrg: pack.recipientOrg,
      expiresAt: pack.expiresAt,
      message: pack.message,
      members: pack.members.filter(m => m.consentGiven).map(m => ({
        name: m.name, roleTitle: m.roleTitle, department: m.department,
        passportUrl: m.passportUrl, emiratesIdUrl: m.emiratesIdUrl, photoUrl: m.photoUrl, otherDocs: m.otherDocs,
      })),
    };
  }

  /** Log a download event (printable PDF/zip pull). */
  async logDownload(id: string, actor?: string) { await this.audit(id, 'DOWNLOADED', actor); return { ok: true }; }
}
