import { Injectable, NotFoundException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from './email.service';

const OPEN = ['SENT', 'PARTIALLY_PAID', 'OVERDUE'];
const fmt = (n: any) => Number(n ?? 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD = (d: any) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const DEFAULT_RULES = [
  { key: 'BEFORE_DUE', label: 'Reminder before due', offsetDays: -3, subject: 'Upcoming invoice {{invoiceNumber}} due {{dueDate}}' },
  { key: 'DUE', label: 'Due today', offsetDays: 0, subject: 'Invoice {{invoiceNumber}} is due today' },
  { key: 'OVERDUE_7', label: '7 days overdue', offsetDays: 7, subject: 'Overdue: invoice {{invoiceNumber}} ({{daysOverdue}} days)' },
  { key: 'OVERDUE_14', label: '14 days overdue', offsetDays: 14, subject: 'Second notice: invoice {{invoiceNumber}} overdue' },
  { key: 'OVERDUE_30', label: '30 days overdue', offsetDays: 30, subject: 'Final notice: invoice {{invoiceNumber}} overdue' },
];

@Injectable()
export class CollectionsService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(private prisma: PrismaService, private email: EmailService) {}

  onModuleInit() { this.timer = setInterval(() => this.scan().catch(() => {}), 6 * 60 * 60 * 1000); } // every 6h
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  // ── Settings ──
  async getSettings() {
    const p = await this.prisma.companyProfile.findFirst();
    const s = ((p as any)?.emailSettings as any) || {};
    return {
      smtp: s.smtp || { host: '', port: 587, user: '', pass: '', from: '', secure: false },
      remindersEnabled: !!s.remindersEnabled,
      rules: s.rules?.length ? s.rules : DEFAULT_RULES,
      statementFooter: s.statementFooter || '',
      configured: !!s.smtp?.host,
    };
  }
  async updateSettings(data: any) {
    const p = await this.prisma.companyProfile.findFirst();
    const cur = ((p as any)?.emailSettings as any) || {};
    const next = { ...cur, ...data };
    await this.prisma.companyProfile.update({ where: { id: p!.id }, data: { emailSettings: next } as any });
    return this.getSettings();
  }

  private rules(s: any) { return (s.rules?.length ? s.rules : DEFAULT_RULES).slice().sort((a: any, b: any) => a.offsetDays - b.offsetDays); }
  private daysOverdue(due: any) { return due ? Math.floor((Date.now() - new Date(due).getTime()) / 86_400_000) : 0; }
  private bucket(d: number) { return d <= 0 ? 'current' : d <= 30 ? 'd30' : d <= 60 ? 'd60' : d <= 90 ? 'd90' : 'd90plus'; }

  // ── Aging / collections list ──
  async aging() {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: { in: OPEN as any } },
      include: { client: { select: { id: true, companyName: true, email: true, status: true } } },
      orderBy: { dueDate: 'asc' },
    });
    const logs = await this.prisma.reminderLog.findMany({ where: { invoiceId: { in: invoices.map(i => i.id) } }, orderBy: { sentAt: 'desc' } });
    const lastByInv: Record<string, any> = {};
    for (const l of logs) if (!lastByInv[l.invoiceId]) lastByInv[l.invoiceId] = l;

    const summary: any = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0, total: 0, count: invoices.length };
    const items = invoices.map(inv => {
      const d = this.daysOverdue(inv.dueDate);
      const due = Number(inv.amountDue);
      const b = this.bucket(d);
      summary[b === 'd90plus' ? 'd90plus' : b] += due; summary.total += due;
      return {
        id: inv.id, invoiceNumber: inv.invoiceNumber, client: inv.client?.companyName, clientId: inv.client?.id,
        clientEmail: (inv.client as any)?.billingEmail || inv.client?.email, clientBlocked: inv.client?.status === 'BLOCKED',
        dueDate: inv.dueDate, total: Number(inv.total), amountDue: due, daysOverdue: d, bucket: b,
        lastReminder: lastByInv[inv.id] ? { level: lastByInv[inv.id].level, sentAt: lastByInv[inv.id].sentAt, status: lastByInv[inv.id].status } : null,
      };
    });
    return { items, summary };
  }

  reminderLogs(invoiceId: string) {
    return this.prisma.reminderLog.findMany({ where: { invoiceId }, orderBy: { sentAt: 'desc' } });
  }

  // ── Send a reminder ──
  private subjFor(rule: any, ctx: any) {
    return (rule?.subject || 'Invoice {{invoiceNumber}} reminder')
      .replace(/\{\{invoiceNumber\}\}/g, ctx.invoiceNumber).replace(/\{\{dueDate\}\}/g, ctx.dueDate).replace(/\{\{daysOverdue\}\}/g, String(ctx.daysOverdue));
  }
  private body(inv: any, company: string, daysOverdue: number, footer: string) {
    const line = daysOverdue > 0
      ? `Our records show invoice <b>${inv.invoiceNumber}</b> is <b>${daysOverdue} day(s) overdue</b>.`
      : `This is a friendly reminder about invoice <b>${inv.invoiceNumber}</b>.`;
    return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
      <p>Dear ${inv.client?.companyName || 'Customer'},</p>
      <p>${line}</p>
      <table style="border-collapse:collapse;margin:12px 0">
        <tr><td style="padding:3px 12px 3px 0;color:#666">Invoice</td><td><b>${inv.invoiceNumber}</b></td></tr>
        <tr><td style="padding:3px 12px 3px 0;color:#666">Issue date</td><td>${fmtD(inv.issueDate)}</td></tr>
        <tr><td style="padding:3px 12px 3px 0;color:#666">Due date</td><td>${fmtD(inv.dueDate)}</td></tr>
        <tr><td style="padding:3px 12px 3px 0;color:#666">Amount due</td><td><b>${inv.currency} ${fmt(inv.amountDue)}</b></td></tr>
      </table>
      <p>Kindly arrange payment at your earliest convenience. If payment has already been made, please disregard this notice.</p>
      <p>Thank you,<br/>${company}</p>
      ${footer ? `<hr style="border:none;border-top:1px solid #eee"/><p style="font-size:12px;color:#999">${footer}</p>` : ''}
    </div>`;
  }

  async sendReminder(invoiceId: string, levelKey: string | undefined, userId?: string) {
    const inv: any = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { client: true } });
    if (!inv) throw new NotFoundException('Invoice not found');
    const settings = await this.getSettings();
    const company = (await this.prisma.companyProfile.findFirst())?.legalName || 'The Film Makers';
    const to = inv.client?.billingEmail || inv.client?.email;
    const d = this.daysOverdue(inv.dueDate);
    const rule = this.rules(settings).find((r: any) => r.key === levelKey) || { key: levelKey || 'MANUAL' };
    const subject = this.subjFor(rule, { invoiceNumber: inv.invoiceNumber, dueDate: fmtD(inv.dueDate), daysOverdue: d });
    try {
      await this.email.send(to, subject, this.body(inv, company, d, settings.statementFooter));
      return this.prisma.reminderLog.create({ data: { invoiceId, clientId: inv.clientId, level: rule.key, to, subject, status: 'SENT', sentById: userId } });
    } catch (e: any) {
      await this.prisma.reminderLog.create({ data: { invoiceId, clientId: inv.clientId, level: rule.key, to, subject, status: 'FAILED', error: e?.message, sentById: userId } });
      throw e;
    }
  }

  // ── Automatic scan ──
  async scan() {
    const settings = await this.getSettings();
    if (!settings.remindersEnabled || !settings.configured) return { sent: 0, skipped: 'disabled or not configured' };
    const { items } = await this.aging();
    const rules = this.rules(settings);
    let sent = 0;
    for (const it of items) {
      if (it.clientBlocked || !it.clientEmail) continue;
      // highest-offset rule whose trigger day has passed and not yet sent for this invoice
      const applicable = rules.filter((r: any) => it.daysOverdue >= r.offsetDays);
      const target = applicable[applicable.length - 1];
      if (!target) continue;
      const already = await this.prisma.reminderLog.count({ where: { invoiceId: it.id, level: target.key, status: 'SENT' } });
      if (already > 0) continue;
      try { await this.sendReminder(it.id, target.key); sent++; } catch {}
    }
    return { sent };
  }

  // ── Statement of account ──
  async statement(clientId: string, from?: string, to?: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client not found');
    const end = to ? new Date(to) : new Date();
    const start = from ? new Date(from) : new Date(end.getFullYear(), 0, 1);

    const [invAll, payAll] = await Promise.all([
      this.prisma.invoice.findMany({ where: { clientId, status: { notIn: ['CANCELLED', 'DRAFT'] as any }, issueDate: { lte: end } }, orderBy: { issueDate: 'asc' } }),
      this.prisma.payment.findMany({ where: { clientId, status: 'CLEARED' as any, paymentDate: { lte: end } }, orderBy: { paymentDate: 'asc' } }),
    ]);

    const before = (d: any) => new Date(d) < start;
    const opening = invAll.filter(i => before(i.issueDate)).reduce((s, i) => s + Number(i.total), 0)
      - payAll.filter(p => before(p.paymentDate)).reduce((s, p) => s + Number(p.amount), 0);

    const entries: any[] = [];
    invAll.filter(i => !before(i.issueDate)).forEach(i => entries.push({ date: i.issueDate, ref: i.invoiceNumber, type: 'Invoice', debit: Number(i.total), credit: 0 }));
    payAll.filter(p => !before(p.paymentDate)).forEach(p => entries.push({ date: p.paymentDate, ref: p.paymentNumber, type: 'Payment', debit: 0, credit: Number(p.amount) }));
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let bal = opening;
    for (const e of entries) { bal += e.debit - e.credit; e.balance = Math.round(bal * 100) / 100; }

    // aging of open invoices
    const aging = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 } as any;
    for (const i of invAll) {
      const due = Number(i.amountDue); if (due <= 0) continue;
      const d = this.daysOverdue(i.dueDate);
      const b = this.bucket(d); aging[b] += due;
    }
    return {
      client: { id: client.id, companyName: client.companyName, trn: (client as any).trn, email: (client as any).billingEmail || (client as any).email },
      period: { from: start.toISOString(), to: end.toISOString() },
      openingBalance: Math.round(opening * 100) / 100,
      entries, closingBalance: Math.round(bal * 100) / 100, aging,
    };
  }

  async emailStatement(clientId: string, from?: string, to?: string) {
    const st = await this.statement(clientId, from, to);
    const company = (await this.prisma.companyProfile.findFirst())?.legalName || 'The Film Makers';
    const rows = st.entries.map((e: any) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee">${fmtD(e.date)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee">${e.ref}</td><td style="padding:4px 8px;border-bottom:1px solid #eee">${e.type}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${e.debit ? fmt(e.debit) : ''}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${e.credit ? fmt(e.credit) : ''}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right"><b>${fmt(e.balance)}</b></td></tr>`).join('');
    const html = `<div style="font-family:Arial,sans-serif;font-size:13px;color:#222">
      <h2>Statement of Account</h2>
      <p><b>${st.client.companyName}</b><br/>${fmtD(st.period.from)} – ${fmtD(st.period.to)}</p>
      <p>Opening balance: <b>${fmt(st.openingBalance)}</b></p>
      <table style="border-collapse:collapse;width:100%"><thead><tr style="background:#f5f5f5"><th style="padding:6px 8px;text-align:left">Date</th><th style="padding:6px 8px;text-align:left">Ref</th><th style="padding:6px 8px;text-align:left">Type</th><th style="padding:6px 8px;text-align:right">Debit</th><th style="padding:6px 8px;text-align:right">Credit</th><th style="padding:6px 8px;text-align:right">Balance</th></tr></thead><tbody>${rows}</tbody></table>
      <p style="margin-top:10px">Closing balance: <b>AED ${fmt(st.closingBalance)}</b></p>
      <p>Regards,<br/>${company}</p>
    </div>`;
    await this.email.send(st.client.email, `Statement of Account — ${st.client.companyName}`, html);
    return { ok: true, to: st.client.email };
  }

  testEmail(to: string) {
    return this.email.send(to, 'TFM ERP — test email', '<p>This is a test email from your TFM ERP collections module. SMTP is working.</p>');
  }
}
