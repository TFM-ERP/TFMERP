import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class EmailService {
  constructor(private prisma: PrismaService) {}

  async settings() {
    const p = await this.prisma.companyProfile.findFirst();
    return { profile: p, email: ((p as any)?.emailSettings as any) || {} };
  }

  async isConfigured() {
    const { email } = await this.settings();
    return !!email?.smtp?.host;
  }

  /** Send an email via the company's configured SMTP. Throws a clear error if not set up. */
  async send(to: string, subject: string, html: string) {
    const { email, profile } = await this.settings();
    const smtp = email?.smtp;
    if (!smtp?.host) throw new BadRequestException('Email/SMTP is not configured (Company Management → Email).');
    if (!to) throw new BadRequestException('No recipient email address on file.');
    let nodemailer: any;
    try { nodemailer = require('nodemailer'); } catch { throw new BadRequestException('Email library not installed on the server. Run: npm install nodemailer'); }
    const transport = nodemailer.createTransport({
      host: smtp.host, port: Number(smtp.port) || 587, secure: !!smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    });
    await transport.sendMail({ from: smtp.from || smtp.user || `no-reply@${smtp.host}`, to, subject, html });
    return { ok: true, to };
  }
}
