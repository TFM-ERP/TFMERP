import { Injectable, BadRequestException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * ScripON Review Protection — Phase 3 foundation.
 * Settings (project / org-default), reusable Profiles, Notice templates, recipient Copy-ID generation,
 * and the protected-export audit record. The PDF security pipeline (Phase 4) consumes the effective config.
 * Config is stored as JSON so the brief's rich ReviewProtectionSettings shape evolves without schema churn.
 */

// Default = the brief's "testing_protected_copy" secure configuration (section 31).
export const RP_DEFAULT_CONFIG: any = {
  mode: 'enhanced',
  watermarkText: 'TESTING COPY — PRIVATE REVIEW ONLY',
  watermarkSecondaryText: 'Issued to {recipient_name} • {copy_id}',
  watermarkPattern: 'single_diagonal',          // single_diagonal | repeated_diagonal | horizontal_center
  watermarkRotation: -35,
  watermarkOpacity: 0.10,
  watermarkScale: 0.92,
  watermarkEveryPage: true,
  traceFooterEnabled: true,
  traceFooterTemplate: '{copy_id} · {recipient_name} · {export_date} · Confidential — FilmOS / The Film Makers FZ LLC',
  noticeTemplateSlug: 'testing_environment',
  noticePlacement: 'dedicated_cover',            // dedicated_cover | first_page_top | first_page_bottom
  noticeRequired: true,
  requireRecipient: true,
  recipientOnEveryPage: true,
  recipientEmailDisplay: 'masked',               // hidden | masked | full
  printingPolicy: 'allow_protected',             // allow_protected | allow_low_resolution | blocked
  restrictCopying: true,
  restrictExtraction: true,
  restrictEditing: true,
  restrictAnnotations: false,
  restrictPageAssembly: true,
  restrictFormFilling: true,
  sanitizeMetadata: true,
  auditLogging: true,
  enhancedDpi: 220,
};

const SYSTEM_PROFILES: Array<{ slug: string; name: string; description: string; isDefault?: boolean; config: any }> = [
  { slug: 'testing_protected_copy', name: 'Testing — Protected Copy', description: 'Private-testing default: enhanced (non-selectable), watermark + recipient on every page, mandatory testing notice.', isDefault: true, config: { ...RP_DEFAULT_CONFIG } },
  { slug: 'standard_review', name: 'Standard Review', description: 'Watermark + recipient footer + notice, text stays selectable. Lighter protection for trusted reviewers.', config: { ...RP_DEFAULT_CONFIG, mode: 'standard', watermarkText: 'CONFIDENTIAL — REVIEW COPY', watermarkPattern: 'repeated_diagonal', restrictCopying: true, restrictExtraction: true, restrictEditing: true, restrictPageAssembly: false, restrictFormFilling: false, noticeTemplateSlug: 'confidential_review' } },
  { slug: 'enhanced_protection', name: 'Enhanced Protection', description: 'Non-selectable rasterised pages, all copy/extract/edit restrictions, recipient on every page.', config: { ...RP_DEFAULT_CONFIG, mode: 'enhanced', watermarkText: 'CONFIDENTIAL — DO NOT DISTRIBUTE', watermarkPattern: 'repeated_diagonal', restrictAnnotations: true } },
  { slug: 'investor_confidential', name: 'Investor / Producer Confidential', description: 'Enhanced + full trace footer + recipient required; for financier and producer review.', config: { ...RP_DEFAULT_CONFIG, mode: 'enhanced', watermarkText: 'CONFIDENTIAL — INVESTOR REVIEW', noticeTemplateSlug: 'no_external_ai', recipientEmailDisplay: 'full' } },
];

const SYSTEM_NOTICES: Array<{ slug: string; name: string; isDefault?: boolean; body: string }> = [
  {
    slug: 'testing_environment', name: 'Testing Environment', isDefault: true,
    body: [
      'TESTING ENVIRONMENT — CONTROLLED REVIEW COPY',
      '',
      'This screenplay was generated through ScripON, part of FilmOS V1, and is provided solely for private review, evaluation and feedback. It may not be copied, extracted, forwarded, uploaded, published, reproduced, adapted or shared, in whole or in part, without prior written permission from the authorized rights holder.',
      '',
      'This copy is not authorized for production, sale, public release, external AI processing or model training. Receipt of this document does not grant any ownership, licence or exploitation rights.',
      '',
      'Issued To:',
      '{recipient_name}',
      '{recipient_email}',
      '{recipient_company}',
      '{recipient_role}',
      '',
      'Project: {project_title}',
      'Script: {script_title}',
      'Script Version: {script_version}',
      'Exported By: {exported_by}',
      'Export Date: {export_datetime}',
      'Copy ID: {copy_id}',
      '',
      'Private review copy generated through ScripON — FilmOS V1',
    ].join('\n'),
  },
  { slug: 'confidential_review', name: 'Confidential Review', body: 'CONFIDENTIAL REVIEW COPY\n\nThis screenplay is confidential and supplied only to the named recipient for private review. No part may be copied, forwarded, published, uploaded or shared without prior written permission from the authorized rights holder.' },
  { slug: 'draft_not_for_production', name: 'Draft — Not for Production', body: 'DRAFT — NOT FOR PRODUCTION\n\nThis screenplay is an unfinished development draft. It is not approved for production, financing, casting, distribution, publication or public release.' },
  { slug: 'personalized_review', name: 'Recipient-Specific Copy', body: 'PERSONALIZED REVIEW COPY\n\nThis copy was prepared specifically for the named recipient. The visible recipient information and unique Copy ID are included on every page for identification and accountability.' },
  { slug: 'no_external_ai', name: 'No External AI Processing', body: 'NO EXTERNAL AI PROCESSING OR MODEL TRAINING\n\nThis screenplay may not be uploaded to external artificial-intelligence systems, datasets, model-training services, automated analysis tools or third-party processing platforms without prior written authorization.' },
];

@Injectable()
export class ReviewProtectionService {
  constructor(private prisma: PrismaService) {}

  // Idempotently install the system profiles + notice templates (runs lazily on first read).
  async ensureSeeds(): Promise<void> {
    for (const p of SYSTEM_PROFILES) {
      await (this.prisma as any).reviewProtectionProfile.upsert({
        where: { slug: p.slug },
        update: { name: p.name, description: p.description, isSystemProfile: true, isDefault: !!p.isDefault, config: p.config },
        create: { slug: p.slug, name: p.name, description: p.description, isSystemProfile: true, isDefault: !!p.isDefault, isActive: true, config: p.config },
      }).catch(() => {});
    }
    for (const n of SYSTEM_NOTICES) {
      await (this.prisma as any).noticeTemplate.upsert({
        where: { slug: n.slug },
        update: { name: n.name, body: n.body, isSystem: true, isDefault: !!n.isDefault },
        create: { slug: n.slug, name: n.name, body: n.body, isSystem: true, isDefault: !!n.isDefault },
      }).catch(() => {});
    }
  }

  // Effective, resolved settings for a project: project row → active profile → defaults, with project overrides on top.
  async getSettings(projectId?: string): Promise<any> {
    await this.ensureSeeds();
    const row: any = projectId
      ? await (this.prisma as any).reviewProtectionSettings.findUnique({ where: { projectId } }).catch(() => null)
      : await (this.prisma as any).reviewProtectionSettings.findFirst({ where: { projectId: null } }).catch(() => null);
    const profiles: any[] = await (this.prisma as any).reviewProtectionProfile.findMany({ where: { isActive: true } }).catch(() => []);
    const defaultProfile = profiles.find((p) => p.isDefault) || profiles.find((p) => p.slug === 'testing_protected_copy') || null;
    const activeProfile = (row && row.activeProfileId ? profiles.find((p) => p.id === row.activeProfileId) : null) || defaultProfile;
    const base = (activeProfile && activeProfile.config) || RP_DEFAULT_CONFIG;
    const config = { ...RP_DEFAULT_CONFIG, ...base, ...((row && row.config) || {}) };
    return {
      projectId: projectId || null,
      enabled: row ? !!row.enabled : true,                 // testing env defaults ON
      mode: (row && row.mode) || config.mode || 'enhanced',
      activeProfileId: (row && row.activeProfileId) || (activeProfile && activeProfile.id) || null,
      activeProfileSlug: activeProfile && activeProfile.slug,
      settingsVersion: (row && row.settingsVersion) || 1,
      config,
      profiles,
    };
  }

  async saveSettings(projectId: string | null, patch: any, userId?: string): Promise<any> {
    const data: any = {};
    if (typeof patch.enabled === 'boolean') data.enabled = patch.enabled;
    if (patch.mode) data.mode = String(patch.mode);
    if ('activeProfileId' in patch) data.activeProfileId = patch.activeProfileId || null;
    if (patch.config && typeof patch.config === 'object') data.config = patch.config;
    data.updatedBy = userId || null;
    const where = projectId ? { projectId } : { projectId: null as any };
    const existing: any = projectId
      ? await (this.prisma as any).reviewProtectionSettings.findUnique({ where: { projectId } }).catch(() => null)
      : await (this.prisma as any).reviewProtectionSettings.findFirst({ where: { projectId: null } }).catch(() => null);
    if (existing) {
      await (this.prisma as any).reviewProtectionSettings.update({ where: { id: existing.id }, data: { ...data, settingsVersion: (existing.settingsVersion || 1) + 1 } });
    } else {
      await (this.prisma as any).reviewProtectionSettings.create({ data: { projectId: projectId || null, ...data } });
    }
    return this.getSettings(projectId || undefined);
  }

  // ── Profiles ──
  async listProfiles(): Promise<any[]> { await this.ensureSeeds(); return (this.prisma as any).reviewProtectionProfile.findMany({ orderBy: [{ isSystemProfile: 'desc' }, { name: 'asc' }] }); }
  async saveProfile(data: any, userId?: string): Promise<any> {
    const name = String(data.name || '').trim(); if (!name) throw new BadRequestException('Profile name is required.');
    const config = { ...RP_DEFAULT_CONFIG, ...(data.config || {}) };
    if (data.id) {
      const cur: any = await (this.prisma as any).reviewProtectionProfile.findUnique({ where: { id: data.id } }).catch(() => null);
      if (cur && cur.isSystemProfile) throw new BadRequestException('System profiles cannot be edited — duplicate it instead.');
      return (this.prisma as any).reviewProtectionProfile.update({ where: { id: data.id }, data: { name, description: data.description || null, config, updatedById: userId || null } });
    }
    const slug = (data.slug || name).toLowerCase().replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) + '_' + randomBytes(2).toString('hex');
    return (this.prisma as any).reviewProtectionProfile.create({ data: { slug, name, description: data.description || null, isSystemProfile: false, isDefault: false, isActive: true, config, createdById: userId || null } });
  }
  async deleteProfile(id: string): Promise<{ ok: boolean }> {
    const cur: any = await (this.prisma as any).reviewProtectionProfile.findUnique({ where: { id } }).catch(() => null);
    if (cur && cur.isSystemProfile) throw new BadRequestException('System profiles cannot be deleted.');
    await (this.prisma as any).reviewProtectionProfile.delete({ where: { id } }).catch(() => {});
    return { ok: true };
  }

  // ── Notice templates ──
  async listNotices(): Promise<any[]> { await this.ensureSeeds(); return (this.prisma as any).noticeTemplate.findMany({ orderBy: [{ isSystem: 'desc' }, { name: 'asc' }] }); }
  async saveNotice(data: any, userId?: string): Promise<any> {
    const name = String(data.name || '').trim(); const body = String(data.body || '').trim();
    if (!name || !body) throw new BadRequestException('Notice name and body are required.');
    if (data.id) {
      const cur: any = await (this.prisma as any).noticeTemplate.findUnique({ where: { id: data.id } }).catch(() => null);
      if (cur && cur.isSystem) throw new BadRequestException('System notices cannot be edited — duplicate it instead.');
      return (this.prisma as any).noticeTemplate.update({ where: { id: data.id }, data: { name, body } });
    }
    const slug = (data.slug || name).toLowerCase().replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) + '_' + randomBytes(2).toString('hex');
    return (this.prisma as any).noticeTemplate.create({ data: { slug, name, body, isSystem: false, createdById: userId || null } });
  }
  async deleteNotice(id: string): Promise<{ ok: boolean }> {
    const cur: any = await (this.prisma as any).noticeTemplate.findUnique({ where: { id } }).catch(() => null);
    if (cur && cur.isSystem) throw new BadRequestException('System notices cannot be deleted.');
    await (this.prisma as any).noticeTemplate.delete({ where: { id } }).catch(() => {});
    return { ok: true };
  }
  async noticeBySlug(slug?: string): Promise<any> { if (!slug) return null; return (this.prisma as any).noticeTemplate.findUnique({ where: { slug } }).catch(() => null); }

  // ── Recipient-specific Copy ID (stamped on every page; traceable, non-guessable) ──
  generateCopyId(opts: { projectId?: string; recipientEmail?: string; recipientName?: string } = {}): string {
    const seed = [opts.projectId || '', opts.recipientEmail || opts.recipientName || '', Date.now(), randomBytes(6).toString('hex')].join('|');
    const h = createHash('sha256').update(seed).digest('hex').toUpperCase();
    return 'RPC-' + Date.now().toString(36).toUpperCase().slice(-6) + '-' + h.slice(0, 6);
  }

  // ── Protected-export audit records ──
  async recordExport(data: any): Promise<any> {
    return (this.prisma as any).protectedExportRecord.create({
      data: {
        projectId: data.projectId || null,
        scriptDocumentId: data.scriptDocumentId || null,
        revisionId: data.revisionId || null,
        copyId: data.copyId,
        mode: data.mode || 'standard',
        profileId: data.profileId || null,
        recipientName: data.recipientName || null,
        recipientEmail: data.recipientEmail || null,
        recipientNote: data.recipientNote || null,
        channel: data.channel || 'download',
        pageCount: data.pageCount || null,
        checksum: data.checksum || null,
        bytes: data.bytes || null,
        status: data.status || 'CREATED',
        failureReason: data.failureReason || null,
        settingsSnapshot: data.settingsSnapshot || null,
        createdById: data.createdById || null,
      },
    });
  }
  async markPrinted(copyId: string): Promise<void> { await (this.prisma as any).protectedExportRecord.updateMany({ where: { copyId }, data: { status: 'PRINTED', printedAt: new Date() } }).catch(() => {}); }
  async markFailed(copyId: string, reason: string): Promise<void> { await (this.prisma as any).protectedExportRecord.updateMany({ where: { copyId }, data: { status: 'FAILED', failureReason: String(reason || '').slice(0, 400) } }).catch(() => {}); }
  async listExports(projectId?: string, limit = 100): Promise<any[]> {
    return (this.prisma as any).protectedExportRecord.findMany({ where: projectId ? { projectId } : {}, orderBy: { createdAt: 'desc' }, take: Math.min(limit, 500) }).catch(() => []);
  }
}
