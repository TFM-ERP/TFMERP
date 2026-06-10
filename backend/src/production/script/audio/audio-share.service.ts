import { Injectable, NotFoundException, BadRequestException, ForbiddenException, GoneException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { MailService } from '../../mail/mail.service';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
// The API serves /uploads on :3001 by convention (mirrors mail.service link building).
const API_BASE = (process.env.API_URL || APP_URL.replace(/:3000$/, ':3001')).replace(/\/$/, '');
const absUrl = (u?: string | null) => (!u ? null : /^https?:\/\//i.test(u) ? u : `${API_BASE}${u.startsWith('/') ? '' : '/'}${u}`);

/**
 * SYS-13c — Share & deliver. Secure, time-limited links to a rendered AudioAsset so reviewers /
 * talent can listen without a TFM login. Gated by an unguessable token; optional passcode, expiry,
 * view cap, and a download toggle. Never exposes the project, voice config, or other assets.
 */
@Injectable()
export class AudioShareService {
  constructor(private prisma: PrismaService, private mail: MailService) {}

  listForAsset(assetId: string) {
    return this.prisma.audioShareLink.findMany({ where: { assetId }, orderBy: { createdAt: 'desc' } });
  }

  async create(b: any, userId?: string) {
    if (!b?.assetId) throw new BadRequestException('assetId is required.');
    const asset = await this.prisma.audioAsset.findUnique({ where: { id: b.assetId } });
    if (!asset) throw new NotFoundException('Audio asset not found.');
    const token = randomBytes(18).toString('base64url');
    const link = await this.prisma.audioShareLink.create({ data: {
      token,
      assetId: asset.id,
      projectId: asset.projectId || null,
      title: b.title || asset.title || 'Audio',
      note: b.note || null,
      passcode: b.passcode ? String(b.passcode) : null,
      allowDownload: !!b.allowDownload,
      expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
      maxViews: b.maxViews ? Number(b.maxViews) : null,
      createdById: userId || null,
    } });
    return { ...link, url: `${APP_URL}/listen/${token}` };
  }

  revoke(id: string) { return this.prisma.audioShareLink.update({ where: { id }, data: { revoked: true } }); }

  /** Public resolve — enforce gates, increment view count, return only what a listener needs. */
  async resolvePublic(token: string, passcode?: string) {
    const link = await this.prisma.audioShareLink.findUnique({ where: { token } });
    if (!link || link.revoked) throw new NotFoundException('This link is no longer available.');
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) throw new GoneException('This link has expired.');
    if (link.maxViews != null && link.views >= link.maxViews) throw new GoneException('This link has reached its view limit.');
    if (link.passcode) {
      if (!passcode) return { needsPasscode: true, title: link.title };
      if (passcode !== link.passcode) throw new ForbiddenException('Incorrect passcode.');
    }
    const asset = await this.prisma.audioAsset.findUnique({ where: { id: link.assetId } });
    if (!asset || asset.status === 'DELETED') throw new NotFoundException('The audio is no longer available.');
    await this.prisma.audioShareLink.update({ where: { id: link.id }, data: { views: { increment: 1 }, lastViewedAt: new Date() } });
    return {
      title: link.title || asset.title,
      note: link.note,
      audioUrl: absUrl(asset.url),
      format: asset.format,
      durationSec: asset.durationSec,
      allowDownload: link.allowDownload,
      generatedAt: asset.generatedAt,
    };
  }

  async email(id: string, b: { recipients?: any; message?: string }) {
    const link = await this.prisma.audioShareLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException('Share link not found.');
    if (link.revoked) throw new BadRequestException('This link has been revoked.');
    return this.mail.sendAudioShare(link.token, { title: link.title || 'Audio', ...b, projectId: link.projectId || undefined });
  }
}
