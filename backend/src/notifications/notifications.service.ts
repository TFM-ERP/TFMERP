import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';
import { ComplianceService } from '../compliance/compliance.service';
import { PmService } from '../pm/pm.service';
import { EmailService } from '../collections/email.service';

export interface Notification {
  key: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  link: string;
  createdAt: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
    private compliance: ComplianceService,
    private pm: PmService,
    private email: EmailService,
  ) {}

  async list(role: string): Promise<Notification[]> {
    const perms = await this.permissions.forRole(role);
    const now = new Date().toISOString();
    const items: Notification[] = [];
    const add = (n: Omit<Notification, 'createdAt'>) => items.push({ ...n, createdAt: now });

    // ── Finance ──
    if ((perms.finance ?? 0) >= 1) {
      const [overdue, pendingInv, pendingExp] = await Promise.all([
        this.prisma.invoice.count({ where: { status: { in: ['SENT', 'PARTIALLY_PAID'] as any }, dueDate: { lt: new Date() } } }),
        this.prisma.invoice.count({ where: { status: 'DRAFT' as any } }).catch(() => 0),
        this.prisma.expense.count({ where: { status: 'PENDING_APPROVAL' as any } }).catch(() => 0),
      ]);
      if (overdue > 0) add({ key: 'fin-overdue', type: 'finance', severity: 'high', title: `${overdue} overdue invoice${overdue > 1 ? 's' : ''}`, message: 'Past due date and unpaid.', link: '/finance/invoices' });
      if (pendingExp > 0) add({ key: 'fin-exp-approval', type: 'finance', severity: 'medium', title: `${pendingExp} expense${pendingExp > 1 ? 's' : ''} awaiting approval`, message: 'Pending your review.', link: '/finance/expenses' });
      if (pendingInv > 0) add({ key: 'fin-draft-inv', type: 'finance', severity: 'low', title: `${pendingInv} draft invoice${pendingInv > 1 ? 's' : ''}`, message: 'Not yet sent.', link: '/finance/invoices' });
    }

    // ── Compliance / renewals ──
    if ((perms.compliance ?? 0) >= 1) {
      try {
        const { summary } = await this.compliance.renewals();
        if ((summary.expired || 0) > 0) add({ key: 'cmp-expired', type: 'compliance', severity: 'high', title: `${summary.expired} document${summary.expired > 1 ? 's' : ''} expired`, message: 'Licences / registrations / IDs past expiry.', link: '/compliance/renewals' });
        const soon = (summary.critical || 0);
        if (soon > 0) add({ key: 'cmp-soon', type: 'compliance', severity: 'medium', title: `${soon} document${soon > 1 ? 's' : ''} expiring ≤30 days`, message: 'Renew before they lapse.', link: '/compliance/renewals' });
      } catch {}
    }

    // ── Rentals / preventive maintenance ──
    if ((perms.rentals ?? 0) >= 1) {
      try {
        const due = await this.pm.due();
        const overdue = due.filter((d: any) => d.due?.status === 'overdue').length;
        const soon = due.filter((d: any) => d.due?.status === 'due-soon').length;
        if (overdue > 0) add({ key: 'pm-overdue', type: 'rentals', severity: 'high', title: `${overdue} asset${overdue > 1 ? 's' : ''} overdue for service`, message: 'Preventive maintenance past due.', link: '/rental/maintenance-schedule' });
        if (soon > 0) add({ key: 'pm-soon', type: 'rentals', severity: 'medium', title: `${soon} service${soon > 1 ? 's' : ''} due soon`, message: 'Schedule maintenance.', link: '/rental/maintenance-schedule' });
      } catch {}
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today.getTime() + 86_400_000);
        const deliveries = await this.prisma.rentalBooking.count({ where: { deliveryDate: { gte: today, lt: tomorrow }, status: { notIn: ['CANCELLED'] as any } } });
        if (deliveries > 0) add({ key: 'rent-deliv', type: 'rentals', severity: 'low', title: `${deliveries} delivery${deliveries > 1 ? 'ies' : ''} today`, message: 'Scheduled for dispatch.', link: '/rental/bookings/calendar' });
      } catch {}
    }

    // ── Approvals awaiting action ──
    if ((perms.finance ?? 0) >= 1) {
      try {
        const pending = await this.prisma.approvalRequest.count({ where: { status: 'PENDING' } });
        if (pending > 0) add({ key: 'appr-pending', type: 'finance', severity: 'medium', title: `${pending} item${pending > 1 ? 's' : ''} awaiting approval`, message: 'Invoices / purchase orders in the approval chain.', link: '/finance/approvals' });
      } catch {}
    }

    // ── Inventory low stock ──
    if ((perms.rentals ?? 0) >= 1) {
      try {
        const items2 = await this.prisma.inventoryItem.findMany({ where: { isActive: true }, select: { quantity: true, reorderLevel: true } });
        const low = items2.filter(i => Number(i.quantity) <= Number(i.reorderLevel)).length;
        if (low > 0) add({ key: 'inv-low', type: 'rentals', severity: 'medium', title: `${low} item${low > 1 ? 's' : ''} at/below reorder level`, message: 'Inventory needs restocking.', link: '/inventory' });
      } catch {}
    }

    // ── Production over budget ──
    if ((perms.production ?? 0) >= 1) {
      try {
        const versions = await this.prisma.budgetVersion.findMany({
          where: { isActive: true },
          select: { projectId: true, sections: { select: { accounts: { select: { code: true, lineItems: { select: { total: true } } } } } } },
        });
        const costs = await this.prisma.projectTransaction.groupBy({ by: ['projectId'], where: { kind: 'COST', status: { in: ['APPROVED', 'PAID'] } }, _sum: { total: true } });
        const costByProject: Record<string, number> = {};
        for (const c of costs) costByProject[c.projectId] = Number(c._sum.total || 0);
        let over = 0;
        for (const v of versions) {
          const budget = v.sections.reduce((s, sec) => s + sec.accounts.reduce((a, acc) => a + acc.lineItems.reduce((t, i) => t + Number(i.total), 0), 0), 0);
          if (budget > 0 && (costByProject[v.projectId] || 0) > budget) over++;
        }
        if (over > 0) add({ key: 'prod-over', type: 'production', severity: 'high', title: `${over} project${over > 1 ? 's' : ''} over budget`, message: 'Actual cost exceeds the active budget.', link: '/production/dashboard' });
      } catch {}
    }

    const order = { high: 0, medium: 1, low: 2 };
    return items.sort((a, b) => order[a.severity] - order[b.severity]);
  }

  /** Compose and email a digest of current alerts to a recipient. */
  async emailDigest(role: string, to?: string) {
    const items = await this.list(role || 'System Administrator');
    let recipient = to;
    if (!recipient) {
      const { email } = await this.email.settings();
      recipient = email?.digestTo || email?.smtp?.user;
    }
    if (!recipient) return { sent: 0, message: 'No recipient. Pass one or set Company → Email.' };
    if (items.length === 0) return { sent: 0, message: 'Nothing to report.' };

    const SEV: Record<string, string> = { high: '#b91c1c', medium: '#b45309', low: '#6b7280' };
    const rows = items.map(i => `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${SEV[i.severity]};margin-right:6px"></span><b>${i.title}</b><div style="color:#888;font-size:12px">${i.message}</div></td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#999;font-size:11px;text-transform:uppercase">${i.type}</td>
    </tr>`).join('');
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#222">
      <div style="border-top:4px solid #c3a56e;padding:14px 0"><div style="font-size:17px;font-weight:800;color:#1a1a2e">Daily Alerts Digest</div><div style="color:#888;font-size:12px">${items.length} item(s) need attention · ${new Date().toLocaleDateString('en-GB')}</div></div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">${rows}</table>
      <div style="border-top:1px solid #ddd;margin-top:18px;padding-top:8px;color:#999;font-size:11px">Automated digest from your ERP.</div></div>`;
    await this.email.send(recipient, `Daily Alerts — ${items.length} item(s)`, html);
    return { sent: 1, recipient, count: items.length };
  }
}
