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

  /** Send a breakdown / call-sheet report (HTML built client-side) to selected recipients via the project sender. */
  async sendBreakdown(projectId: string, body: { subject?: string; html?: string; recipients?: any; message?: string }) {
    const recipients = toList(body.recipients);
    if (!recipients) throw new BadRequestException('No recipients selected.');
    if (!body.html) throw new BadRequestException('Nothing to send.');
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { title: true } });
    const subject = body.subject || `Breakdown — ${project?.title || ''}`;
    const html = shell(subject, `${body.message ? `<p>${body.message}</p>` : ''}${body.html}`, `${APP_URL}/production/projects/${projectId}`, 'Open in TFM');
    await this.sendMail(recipients, subject, html, projectId);
    return { sent: recipients.split(',').filter(Boolean).length, recipients };
  }

  /**
   * SYS-07 V2 · Slice 3 — email a clearance pack to a venue/authority.
   * Sends the time-limited secure LINK only — identity docs are never embedded in the email.
   */
  async sendClearancePack(packId: string, body: { recipients?: any; message?: string } = {}) {
    const pack = await this.prisma.clearancePack.findUnique({ where: { id: packId } });
    if (!pack) throw new NotFoundException('Clearance pack not found');
    const recipients = toList(body.recipients) || pack.recipientEmail || '';
    if (!recipients) throw new BadRequestException('No recipient email for this clearance pack.');
    const expiry = pack.expiresAt ? new Date(pack.expiresAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'no expiry';
    const link = `${APP_URL}/clearance/${pack.token}`;
    const html = shell(pack.title || 'Crew Clearance Pack',
      `<p>${body.message ? body.message + '<br\><br\>' : ''}${pack.recipientName ? `Dear ${pack.recipientName},<br\><br\>` : ''}
       Please find the crew clearance pack for the upcoming visit${pack.recipientOrg ? ` to <b>${pack.recipientOrg}</b>` : ''}.</p>
       <p>The secure link below contains the scouting party's identity documents for pre-clearance.
       It is time-limited and access is logged.</p>
       <p style="color:#888;font-size:12px">Link expires: <b>${expiry}</b></p>`,
      link, 'Open secure clearance pack');
    await this.sendMail(recipients, pack.title || 'Crew Clearance Pack', html, pack.projectId || undefined);
    return { sent: recipients.split(',').filter(Boolean).length, recipients };
  }

  /** SYS-13c — email a secure listen link for a rendered audio mix (link only, never the file). */
  async sendAudioShare(token: string, body: { title?: string; recipients?: any; message?: string; projectId?: string } = {}) {
    const recipients = toList(body.recipients);
    if (!recipients) throw new BadRequestException('No recipient email for this share link.');
    const link = `${APP_URL}/listen/${token}`;
    const html = shell(body.title || 'Audio for review',
      `<p>${body.message ? body.message + '<br\><br\>' : ''}You have been sent audio to listen to.</p>
       <p>Use the secure link below — it opens an in-browser player and may be time-limited.</p>`,
      link, 'Listen now');
    await this.sendMail(recipients, body.title || 'Audio for review', html, body.projectId);
    return { sent: recipients.split(',').filter(Boolean).length, recipients };
  }

  /**
   * SYS-13 · D5 — email each recipient their watermarked sides. Each gets only their own
   * personalised PDF link (leak-tracing); recipients with no email are skipped.
   */
  async sendSides(jobId: string) {
    const job = await this.prisma.sidesJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Sides job not found');
    const project = await this.prisma.productionProject.findUnique({ where: { id: job.projectId }, select: { title: true } });
    const date = job.shootDate ? new Date(job.shootDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }) : '';
    let sent = 0;
    for (const r of (job.recipients as any[]) || []) {
      if (!r.email || !r.outputUrl) continue;
      const link = `${APP_URL.replace(/:3000$/, ':3001')}${r.outputUrl}`; // served by the API
      const html = shell(`Sides — ${project?.title || ''}${date ? ` · ${date}` : ''}`,
        `<p>Hi ${r.name || ''},</p><p>Your sides for the next shoot day are ready. This copy is watermarked to you and for your eyes only — please do not forward.</p>`,
        link, 'Open your sides (PDF)');
      await this.sendMail(r.email, `Sides — ${project?.title || ''}${date ? ` · ${date}` : ''}`, html, job.projectId);
      sent++;
    }
    await this.prisma.sidesJob.update({ where: { id: jobId }, data: { status: 'SHARED' } });
    return { sent };
  }
}
