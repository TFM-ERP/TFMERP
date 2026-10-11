import { Injectable, NotFoundException, BadRequestException, ForbiddenException, GoneException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { signedUploadPath, SERVER_MAX_TTL_SECONDS } from '../../../files/files.module';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
// Where a listener's browser reaches the API. Files are served by the guarded route
// /api/v1/uploads/<name> and nowhere else; there is no public /uploads.
const API_BASE = (process.env.API_URL || APP_URL.replace(/:3000$/, ':3001')).replace(/\/$/, '');

/** Length assumed for an audio whose duration was never recorded: two hours. */
const UNKNOWN_DURATION_SECONDS = 7200;
/** Slack on top of the audio's length, for pauses and a late start. */
const LISTEN_MARGIN_SECONDS = 3600;

/**
 * How long the listen page's audio link lives, in seconds. A feature table read runs 90-120
 * minutes, and the page cannot ask again — every resolve counts as a view — so the one link has
 * to last the whole play: the audio's length (two hours if unknown) plus an hour, at most
 * SERVER_MAX_TTL_SECONDS. And never past the share link's own expiry. At least 1.
 */
export function audioShareTtl(durationSec: unknown, shareExpiresAt: Date | null | undefined, nowMs: number): number {
  const known = typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec > 0;
  let ttl = Math.min(Math.floor(known ? (durationSec as number) : UNKNOWN_DURATION_SECONDS) + LISTEN_MARGIN_SECONDS, SERVER_MAX_TTL_SECONDS);
  const until = shareExpiresAt instanceof Date ? shareExpiresAt.getTime() : Number.NaN;
  if (Number.isFinite(until)) ttl = Math.min(ttl, Math.floor((until - nowMs) / 1000));
  return Math.max(ttl, 1);
}

/**
 * The absolute, signed link the listen page plays: apiBase + "/api/v1/uploads/<name>?t=...". The
 * page has no login, so the resolver that checked the share token signs it — under the 'server'
 * ceiling, since the TTL is one the server worked out. An external http(s) value passes through;
 * anything else that is not an upload is null.
 */
export function signAudioUrl(storedUrl: string | null | undefined, apiBase: string, ttl: number): string | null {
  if (!storedUrl) return null;
  if (/^https?:\/\//i.test(storedUrl)) return storedUrl;
  const path = signedUploadPath(storedUrl, ttl, 'server');
  return path ? `${apiBase}${path}` : null;
}

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
      passcode: b.passcode ? await bcrypt.hash(String(b.passcode), 10) : null,
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
      // Hashed (new) links verify via bcrypt; legacy plaintext links still compare directly.
      const ok = link.passcode.startsWith('$2')
        ? await bcrypt.compare(passcode, link.passcode)
        : passcode === link.passcode;
      if (!ok) throw new ForbiddenException('Incorrect passcode.');
    }
    const asset = await this.prisma.audioAsset.findUnique({ where: { id: link.assetId } });
    if (!asset || asset.status === 'DELETED') throw new NotFoundException('The audio is no longer available.');
    await this.prisma.audioShareLink.update({ where: { id: link.id }, data: { views: { increment: 1 }, lastViewedAt: new Date() } });
    return {
      title: link.title || asset.title,
      note: link.note,
      audioUrl: signAudioUrl(asset.url, API_BASE, audioShareTtl(asset.durationSec, link.expiresAt, Date.now())),
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
