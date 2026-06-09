import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../collections/email.service';

/**
 * SYS-13 · D10 — Email-OTP PII reveal (no SMS gateway; uses the existing SMTP).
 * Masked fields (IBAN, passport…) decrypt only after a 6-digit code, emailed to the data
 * subject's address, is verified. Codes are hashed, short-lived (5 min) and rate-limited.
 * Field access is whitelisted per entity type so the endpoint can't be used to read arbitrary columns.
 */
@Injectable()
export class OtpService {
  constructor(private prisma: PrismaService, private email: EmailService) {}

  private readonly TTL_MS = 5 * 60 * 1000;
  private readonly RATE_WINDOW_MS = 10 * 60 * 1000;
  private readonly RATE_MAX = 3;

  // Only these fields may ever be revealed, per entity type.
  private readonly WHITELIST: Record<string, string[]> = {
    employee: ['passportNumber', 'passportExpiry', 'visaNumber', 'visaExpiry', 'emiratesId', 'emiratesIdExpiry', 'iban', 'swiftCode', 'homeAddress'],
    crewMember: ['passportNumber', 'passportExpiry', 'visaNumber', 'visaExpiry', 'iban', 'swiftCode'],
  };

  private hash(code: string) { return createHash('sha256').update(code).digest('hex'); }
  private maskEmail(e: string) { const [u, d] = e.split('@'); return `${u.slice(0, 2)}${'*'.repeat(Math.max(1, u.length - 2))}@${d || ''}`; }

  private async entityEmail(entityType: string, entityId: string): Promise<string | null> {
    if (entityType === 'employee') { const e = await this.prisma.employee.findUnique({ where: { id: entityId }, select: { email: true, personalEmail: true } }); return e?.email || e?.personalEmail || null; }
    if (entityType === 'crewMember') { const c = await this.prisma.crewMember.findUnique({ where: { id: entityId }, select: { email: true } }); return c?.email || null; }
    return null;
  }

  async request(body: any, userId?: string) {
    const { entityType, entityId } = body || {};
    const allowed = this.WHITELIST[entityType];
    if (!allowed) throw new BadRequestException('Unsupported entity type.');
    const fields: string[] = (body.fields || []).filter((f: string) => allowed.includes(f));
    if (!fields.length) throw new BadRequestException('No revealable fields requested.');

    const target = await this.entityEmail(entityType, entityId);
    if (!target) throw new BadRequestException('No email on file to send the verification code.');

    const since = new Date(Date.now() - this.RATE_WINDOW_MS);
    const recent = await this.prisma.otpChallenge.count({ where: { entityType, entityId, createdAt: { gte: since } } });
    if (recent >= this.RATE_MAX) throw new BadRequestException('Too many code requests — please wait a few minutes.');

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const challenge = await this.prisma.otpChallenge.create({
      data: { purpose: 'PII_REVEAL', entityType, entityId, fields, target, codeHash: this.hash(code), expiresAt: new Date(Date.now() + this.TTL_MS), requestedById: userId || null },
    });

    const html = `<div style="font-family:Arial,sans-serif;color:#222">
      <p>Your verification code to reveal protected details is:</p>
      <p style="font-size:28px;font-weight:800;letter-spacing:4px;color:#0f172a">${code}</p>
      <p style="color:#888;font-size:12px">This code expires in 5 minutes. If you didn't request it, ignore this email.</p></div>`;
    try { await this.email.send(target, 'Your verification code', html); }
    catch (e: any) { await this.prisma.otpChallenge.delete({ where: { id: challenge.id } }); throw new BadRequestException(e?.message || 'Could not send the code email — check the SMTP settings.'); }

    return { challengeId: challenge.id, target: this.maskEmail(target), expiresInSec: this.TTL_MS / 1000 };
  }

  async verify(challengeId: string, code: string) {
    const ch = await this.prisma.otpChallenge.findUnique({ where: { id: challengeId } });
    if (!ch) throw new NotFoundException('Challenge not found.');
    if (ch.verifiedAt) throw new BadRequestException('This code was already used.');
    if (new Date() > ch.expiresAt) throw new BadRequestException('Code expired — request a new one.');
    if (ch.attempts >= ch.maxAttempts) throw new BadRequestException('Too many attempts — request a new code.');

    await this.prisma.otpChallenge.update({ where: { id: challengeId }, data: { attempts: { increment: 1 } } });
    if (this.hash(String(code || '')) !== ch.codeHash) {
      const left = ch.maxAttempts - (ch.attempts + 1);
      throw new BadRequestException(`Invalid code${left > 0 ? ` — ${left} attempt${left === 1 ? '' : 's'} left.` : '.'}`);
    }
    await this.prisma.otpChallenge.update({ where: { id: challengeId }, data: { verifiedAt: new Date() } });

    const sel: any = {}; for (const f of ch.fields) sel[f] = true;
    let row: any = null;
    if (ch.entityType === 'employee') row = await this.prisma.employee.findUnique({ where: { id: ch.entityId }, select: sel });
    else if (ch.entityType === 'crewMember') row = await this.prisma.crewMember.findUnique({ where: { id: ch.entityId }, select: sel });
    return { fields: row || {} };
  }
}
