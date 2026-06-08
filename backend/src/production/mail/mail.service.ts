import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../../collections/email.service';
import { CostingService } from '../costing/costing.service';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const GOLD = '#c3a56e', NAVY = '#1a1a2e';

function shell(title: string, bodyHtml: string, linkUrl?: string, linkLabel?: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#222">
    <div style="border-top:4px solid ${GOLD};padding:16px 0"><div style="font-size:18px;font-weight:800;color:${NAVY}">${title}</div></div>
    ${bodyHtml}
    ${linkUrl ? `<p style="margin:20px 0"><a href="${linkUrl}" style="background:${GOLD};color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600">${linkLabel || 'Open'}</a></p>` : ''}
    <div style="border-top:1px solid #ddd;margin-top:24px;padding-top:8px;color:#999;font-size:11px">Sent from the production system.</div>
  </div>`;
}
const toList = (r: any): string => Array.isArray(r) ? r.filter(Boolean).join(',') : (r || '');

@Injectable()
export class MailService {
  constructor(private prisma: PrismaService, private email: EmailService, private costing: CostingService) {}

  status() { return this.email.isConfigured().then(configured => ({ configured })); }

  // ── Production-specific email settings (separate sender) ──────────────────────
  async getSettings() {
    const p = await this.prisma.companyProfile.findFirst();
    const e: any = (p as any)?.emailSettings || {};
    return { production: e.production || { enabled: false, smtp: {} }, companyConfigured: !!e.smtp?.host };
  }

  async saveSettings(data: any) {
    const p = await this.prisma.companyProfile.findFirst();
    if (!p) throw new BadRequestException('No company profile.');
    const e: any = (p as any)?.emailSettings || {};
    e.production = { enabled: !!data.enabled, smtp: data.smtp || {} };
    await this.prisma.companyProfile.update({ where: { id: p.id }, data: { emailSettings: e } as any });
    return { ok: true };
  }

  // ── Per-project email settings ───────────────────────────────────────────────
  async getProjectSettings(projectId: string) {
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { emailSettings: true } });
    const prod = await this.getSettings();
    const e: any = (project as any)?.emailSettings || { enabled: false, smtp: {} };
    return { project: { enabled: !!e.enabled, smtp: e.smtp || {} }, productionEnabled: !!prod.production?.enabled, companyConfigured: prod.companyConfigured };
  }

  async saveProjectSettings(projectId: string, data: any) {
    await this.prisma.productionProject.update({ where: { id: projectId }, data: { emailSettings: { enabled: !!data.enabled, smtp: data.smtp || {} } as any } });
    return { ok: true };
  }

  private async sendVia(s: any, to: string, subject: string, html: string) {
    let nodemailer: any;
    try { nodemailer = require('nodemailer'); } catch { throw new BadRequestException('Email library not installed on the server. Run: npm install nodemailer'); }
    if (!s?.host) throw new BadRequestException('SMTP host is missing. Fill in the email sender settings first.');
    const port = Number(s.port) || 587;
    const transport = nodemailer.createTransport({
      host: s.host, port, secure: !!s.secure,
      requireTLS: !s.secure && port === 587 ? true : undefined,
      auth: s.user ? { user: s.user, pass: s.pass } : undefined,
      connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 20000,
    });
    try {
      await transport.sendMail({ from: s.from || s.user || `no-reply@${s.host}`, to, subject, html });
    } catch (err: any) {
      const detail = err?.response || err?.message || 'unknown error';
      let hint = '';
      if (/auth|535|credentials|username|password/i.test(detail)) hint = ' — for Gmail/Outlook, use an App Password (not your normal password) and make sure SMTP is enabled.';
      else if (/self signed|certificate/i.test(detail)) hint = ' — TLS certificate issue; try the SSL (465) option or check the host.';
      else if (/ECONN|ETIMEDOUT|timeout|ENOTFOUND|getaddrinfo/i.test(detail)) hint = ' — could not reach the SMTP host; check the host name and port.';
      throw new BadRequestException(`Email send failed: ${detail}${hint}`);
    }
  }

  /** Resolve sender: project → production → company, then send. */
  private async sendMail(to: string, subject: string, html: string, projectId?: string) {
    // 1. Project-specific sender
    if (projectId) {
      const project = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { emailSettings: true } });
      const pe: any = (project as any)?.emailSettings;
      if (pe?.enabled && pe?.smtp?.host) { await this.sendVia(pe.smtp, to, subject, html); return { ok: true, to, via: 'project' }; }
    }
    // 2. Production-wide sender
    const { production } = await this.getSettings();
    if (production?.enabled && production?.smtp?.host) { await this.sendVia(production.smtp, to, subject, html); return { ok: true, to, via: 'production' }; }
    // 3. Company SMTP fallback
    await this.email.send(to, subject, html);
    return { ok: true, to, via: 'company' };
  }

  async testSettings(to: string) {
    if (!to) throw new BadRequestException('Enter a recipient.');
    await this.sendMail(to, 'Production email test', '<p>Your production email sender is working. This is a test from the Production module.</p>');
    return { ok: true, to };
  }

  async testProjectSettings(projectId: string, to: string) {
    if (!to) throw new BadRequestException('Enter a recipient.');
    const r = await this.sendMail(to, 'Project email test', '<p>This project\'s email sender is working. Test message.</p>', projectId);
    return { ok: true, to, via: r.via };
  }

  private money(n: any, cur = 'AED') { return `${cur} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`; }

  async sendCallSheet(id: string, body: { recipients?: any; message?: string }) {
    const cs = await this.prisma.callSheet.findUnique({ where: { id }, include: { project: true } });
    if (!cs) throw new NotFoundException('Call sheet not found');
    let recipients = toList(body.recipients);
    if (!recipients) {
      const crew = await this.prisma.productionCrew.findMany({ where: { projectId: cs.projectId, email: { not: null } }, select: { email: true } });
      recipients = crew.map(c => c.email).filter(Boolean).join(',');
    }
    if (!recipients) throw new BadRequestException('No recipient emails. Add crew emails or enter recipients.');
    const date = cs.shootDate ? new Date(cs.shootDate).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '';
    const html = shell(`Call Sheet — Day ${cs.dayNumber}`,
      `<p>${body.message ? body.message + '<br/><br/>' : ''}<b>${cs.project?.title || ''}</b> — Day ${cs.dayNumber}${cs.totalDays ? ` of ${cs.totalDays}` : ''}</p>
       <table style="font-size:13px;color:#444">
         <tr><td style="padding:2px 10px 2px 0;color:#888">Date</td><td>${date}</td></tr>
         <tr><td style="padding:2px 10px 2px 0;color:#888">General call</td><td>${cs.generalCall || '—'}</td></tr>
         <tr><td style="padding:2px 10px 2px 0;color:#888">Location</td><td>${cs.locationName || '—'}</td></tr>
       </table>`,
      `${APP_URL}/print/callsheet/${id}`, 'View & print call sheet');
    await this.sendMail(recipients, `Call Sheet — ${cs.project?.title || ''} Day ${cs.dayNumber}`, html, cs.projectId);
    return { sent: recipients.split(',').length, recipients };
  }

  async sendCostReport(projectId: string, body: { recipients?: any; message?: string }) {
    const recipients = toList(body.recipients);
    if (!recipients) throw new BadRequestException('Enter at least one recipient email.');
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    const report = await this.costing.costReport(projectId);
    const t = report.totals; const cur = report.currency || 'AED';
    const html = shell(`Weekly Cost Report — ${project.title}`,
      `<p>${body.message ? body.message + '<br/><br/>' : ''}As of ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}.</p>
       <table style="font-size:13px;color:#444;border-collapse:collapse">
         <tr><td style="padding:3px 14px 3px 0;color:#888">Budget</td><td style="text-align:right;font-weight:700">${this.money(t.budget, cur)}</td></tr>
         <tr><td style="padding:3px 14px 3px 0;color:#888">Committed</td><td style="text-align:right">${this.money(t.committed, cur)}</td></tr>
         <tr><td style="padding:3px 14px 3px 0;color:#888">Actual</td><td style="text-align:right">${this.money(t.actual, cur)}</td></tr>
         <tr><td style="padding:3px 14px 3px 0;color:#888">Est. Final Cost</td><td style="text-align:right;font-weight:700">${this.money(t.efc, cur)}</td></tr>
         <tr><td style="padding:3px 14px 3px 0;color:#888">Variance</td><td style="text-align:right;font-weight:700;color:${t.variance < 0 ? '#b91c1c' : '#15803d'}">${t.variance < 0 ? '(' : ''}${this.money(Math.abs(t.variance), cur)}${t.variance < 0 ? ')' : ''}</td></tr>
       </table>`,
      `${APP_URL}/print/costreport/${projectId}`, 'View full cost report');
    await this.sendMail(recipients, `Cost Report — ${project.title}`, html, projectId);
    return { sent: recipients.split(',').length, recipients };
  }

  async sendDealMemo(assignmentId: string, body: { recipients?: any; message?: string }) {
    const a = await this.prisma.productionCrew.findUnique({ where: { id: assignmentId }, include: { project: true, crewMember: true } });
    if (!a) throw new NotFoundException('Assignment not found');
    const recipients = toList(body.recipients) || a.email || a.crewMember?.email || '';
    if (!recipients) throw new BadRequestException('No email for this crew member.');
    const html = shell(`Deal Memo — ${a.project?.title || ''}`,
      `<p>${body.message ? body.message + '<br/><br/>' : ''}Hi ${a.name},</p>
       <p>Please find your deal memo for <b>${a.project?.title || ''}</b> (${String(a.role).replace(/_/g, ' ')}).</p>`,
      `${APP_URL}/print/dealmemo/${assignmentId}`, 'View deal memo');
    await this.sendMail(recipients, `Deal Memo — ${a.project?.title || ''}`, html, a.projectId);
    // mark as sent if not already signed
    if (a.dealMemoStatus === 'NOT_SENT') await this.prisma.productionCrew.update({ where: { id: assignmentId }, data: { dealMemoStatus: 'SENT' } });
    return { sent: 1, recipients };
  }
}
