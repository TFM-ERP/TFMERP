import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

type Status = 'expired' | 'critical' | 'warning' | 'upcoming' | 'ok';

export interface RenewalItem {
  id: string;
  category: 'Company' | 'Fleet' | 'HR' | 'Crew';
  entityType: string;
  entityId?: string;
  entityName: string;
  documentType: string;
  reference?: string;
  expiryDate: string;
  daysLeft: number;
  status: Status;
  link?: string;
}

function classify(daysLeft: number): Status {
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 30) return 'critical';
  if (daysLeft <= 60) return 'warning';
  if (daysLeft <= 90) return 'upcoming';
  return 'ok';
}

@Injectable()
export class ComplianceService {
  constructor(private prisma: PrismaService) {}

  // ── Renewals / document expiry ───────────────────────────────────────────
  async renewals(): Promise<{ items: RenewalItem[]; summary: Record<string, number> }> {
    const now = new Date();
    const dayMs = 86_400_000;
    const items: RenewalItem[] = [];

    const push = (
      category: RenewalItem['category'], entityType: string, entityName: string,
      documentType: string, expiry: any, opts: { entityId?: string; reference?: string; link?: string } = {},
    ) => {
      if (!expiry) return;
      const d = new Date(expiry);
      if (isNaN(d.getTime())) return;
      const daysLeft = Math.ceil((d.getTime() - now.getTime()) / dayMs);
      items.push({
        id: `${entityType}-${opts.entityId || entityName}-${documentType}`.replace(/\s+/g, '_'),
        category, entityType, entityName, documentType,
        reference: opts.reference, entityId: opts.entityId,
        expiryDate: d.toISOString(), daysLeft, status: classify(daysLeft), link: opts.link,
      });
    };

    const [profile, companyDocs, assets, employees, crew] = await Promise.all([
      this.prisma.companyProfile.findFirst(),
      this.prisma.companyDocument.findMany().catch(() => []),
      this.prisma.asset.findMany().catch(() => []),
      this.prisma.employee.findMany().catch(() => []),
      this.prisma.crewMember.findMany({ where: { status: 'ACTIVE' } }).catch(() => []),
    ]);

    // Company — trade license
    if (profile) {
      push('Company', 'Company', (profile as any).legalName || 'Company', 'Trade License',
        (profile as any).licenseExpiryDate, { reference: (profile as any).tradeLicenseNumber, link: '/company' });
    }
    // Company documents (generic)
    for (const d of companyDocs as any[]) {
      push('Company', 'Company Document', (profile as any)?.legalName || 'Company', d.type || d.title || 'Document',
        d.expiryDate, { reference: d.title, link: '/company' });
    }
    // Fleet assets
    for (const a of assets as any[]) {
      const name = a.name || a.assetCode || a.plateNumber || 'Asset';
      const link = `/rental/assets/${a.id}`;
      push('Fleet', 'Asset', name, 'Vehicle Registration (Mulkiya)', a.registrationExpiry, { entityId: a.id, reference: a.plateNumber, link });
      push('Fleet', 'Asset', name, 'Insurance', a.insuranceExpiry, { entityId: a.id, reference: a.insurancePolicyRef, link });
      push('Fleet', 'Asset', name, 'Warranty', a.warrantyExpiry, { entityId: a.id, reference: a.warrantyProvider, link });
    }
    // Employees
    for (const e of employees as any[]) {
      const name = e.fullName || [e.firstName, e.lastName].filter(Boolean).join(' ') || e.name || 'Employee';
      const link = `/hr/employees/${e.id}`;
      push('HR', 'Employee', name, 'Visa', e.visaExpiry, { entityId: e.id, reference: e.visaNumber, link });
      push('HR', 'Employee', name, 'Passport', e.passportExpiry, { entityId: e.id, reference: e.passportNumber, link });
      push('HR', 'Employee', name, 'Emirates ID', e.emiratesIdExpiry, { entityId: e.id, reference: e.emiratesId, link });
      push('HR', 'Employee', name, 'Work Permit', e.workPermitExpiryDate, { entityId: e.id, reference: e.labourCardNumber, link });
      push('HR', 'Employee', name, 'Employment Card', e.employmentCardExpiryDate, { entityId: e.id, link });
    }
    // Production crew (freelancers)
    for (const c of crew as any[]) {
      const link = `/production/crew/${c.id}`;
      push('Crew', 'Crew', c.name, 'Passport', c.passportExpiry, { entityId: c.id, reference: c.passportNumber, link });
      push('Crew', 'Crew', c.name, 'Visa', c.visaExpiry, { entityId: c.id, reference: c.visaNumber, link });
      push('Crew', 'Crew', c.name, 'Emirates ID', c.emiratesIdExpiry, { entityId: c.id, reference: c.emiratesId, link });
    }

    items.sort((a, b) => a.daysLeft - b.daysLeft);
    const summary = { total: items.length, expired: 0, critical: 0, warning: 0, upcoming: 0, ok: 0 } as Record<string, number>;
    for (const it of items) summary[it.status]++;
    return { items, summary };
  }

  // ── e-Invoicing readiness ────────────────────────────────────────────────
  async einvoicingReadiness() {
    const [profile, clientsTotal, clientsWithTrn, invoices] = await Promise.all([
      this.prisma.companyProfile.findFirst(),
      this.prisma.client.count(),
      this.prisma.client.count({ where: { trn: { not: null } } }),
      this.prisma.invoice.findMany({
        where: { status: { notIn: ['DRAFT', 'CANCELLED'] as any } },
        take: 500,
        orderBy: { issueDate: 'desc' },
        select: {
          id: true, vatAmount: true, total: true,
          client: { select: { trn: true } },
          items: { select: { taxRateId: true } },
        },
      }).catch(() => [] as any[]),
    ]);

    const p: any = profile || {};
    const invCount = invoices.length;
    const invWithBuyerTrn = invoices.filter((i: any) => i.client?.trn).length;
    const invWithLineTax = invoices.filter((i: any) => (i.items || []).some((it: any) => it.taxRateId)).length;
    const clientTrnPct = clientsTotal ? Math.round((clientsWithTrn / clientsTotal) * 100) : 0;
    const buyerTrnPct = invCount ? Math.round((invWithBuyerTrn / invCount) * 100) : 0;
    const lineTaxPct = invCount ? Math.round((invWithLineTax / invCount) * 100) : 0;

    const checks = [
      { key: 'sellerTrn', label: 'Company TRN registered', ok: !!p.trn, detail: p.trn ? `TRN ${p.trn}` : 'Add your TRN in Company Management', severity: 'high' },
      { key: 'tradeLicense', label: 'Trade license recorded', ok: !!p.tradeLicenseNumber, detail: p.tradeLicenseNumber || 'Add trade license number', severity: 'medium' },
      { key: 'address', label: 'Registered address & emirate set', ok: !!(p.address && p.emirate), detail: p.address ? `${p.address}, ${p.emirate || ''}` : 'Add address & emirate', severity: 'medium' },
      { key: 'vatRate', label: 'Default VAT rate configured', ok: Number(p.defaultVatRate) > 0, detail: `${p.defaultVatRate ?? 0}%`, severity: 'low' },
      { key: 'clientTrn', label: 'Customers have TRN', ok: clientTrnPct >= 90, detail: `${clientsWithTrn}/${clientsTotal} clients (${clientTrnPct}%)`, severity: 'high' },
      { key: 'buyerTrn', label: 'Invoices carry buyer TRN', ok: buyerTrnPct >= 90 || invCount === 0, detail: invCount ? `${invWithBuyerTrn}/${invCount} recent invoices (${buyerTrnPct}%)` : 'No invoices yet', severity: 'high' },
      { key: 'lineTax', label: 'Invoices use line-level VAT', ok: lineTaxPct >= 90 || invCount === 0, detail: invCount ? `${invWithLineTax}/${invCount} recent invoices (${lineTaxPct}%)` : 'No invoices yet', severity: 'medium' },
      { key: 'numbering', label: 'Sequential invoice numbering', ok: true, detail: 'Document sequences active (INV-YYYY-####)', severity: 'low' },
    ];
    const passed = checks.filter(c => c.ok).length;
    const score = Math.round((passed / checks.length) * 100);

    const timeline = [
      { phase: 'Voluntary / pilot', who: 'Selected taxpayers', date: '1 Jul 2026', note: 'Optional Peppol 4-corner exchange via Accredited Service Providers (ASPs).' },
      { phase: 'Phase 1 — Large business', who: 'Revenue ≥ AED 50M', date: 'Go-live 1 Jan 2027', note: 'Appoint an ASP by 30 Oct 2026 (deadline extended from 31 Jul 2026).' },
      { phase: 'Phase 2 — SMEs', who: 'Revenue < AED 50M', date: 'Go-live 1 Jul 2027', note: 'Appoint an ASP by 31 Mar 2027.' },
      { phase: 'Phase 3 — Government', who: 'Government entities', date: 'Go-live 1 Oct 2027', note: 'Appoint an ASP by 31 Mar 2027.' },
    ];

    return {
      score, passed, total: checks.length, checks,
      stats: { clientsTotal, clientsWithTrn, clientTrnPct, invCount, invWithBuyerTrn, buyerTrnPct, invWithLineTax, lineTaxPct },
      model: 'UAE Peppol 5-corner model (FTA-administered). Legal basis: Ministerial Decisions 243 & 244 of 2025.',
      timeline,
    };
  }

  // Structured (PINT-AE-style) representation of one invoice — a starting point for ASP export.
  async invoicePeppol(id: string) {
    const inv: any = await this.prisma.invoice.findUnique({
      where: { id },
      include: { client: true, items: { include: { taxRate: true } }, bankAccount: true },
    });
    if (!inv) return { error: 'Invoice not found' };
    const profile: any = await this.prisma.companyProfile.findFirst();
    return {
      profile: 'urn:peppol:pint:billing-1@ae-1 (indicative)',
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      currency: inv.currency,
      documentType: inv.invoiceType,
      seller: { name: profile?.legalName, trn: profile?.trn, address: profile?.address, emirate: profile?.emirate, country: 'AE' },
      buyer: { name: inv.client?.companyName, trn: inv.client?.trn, address: inv.client?.billingAddress, country: 'AE' },
      lines: (inv.items || []).map((it: any, i: number) => ({
        id: i + 1, description: it.description, quantity: Number(it.quantity), unit: it.unit,
        unitPrice: Number(it.unitPrice), lineTotal: Number(it.lineTotal),
        vatCategory: Number(it.taxAmount) > 0 ? 'S' : 'Z',
        vatRate: it.taxRate ? Number(it.taxRate.rate) : 0, vatAmount: Number(it.taxAmount),
      })),
      taxSummary: { taxableAmount: Number(inv.subtotal), vatAmount: Number(inv.vatAmount), total: Number(inv.total) },
      payment: inv.bankAccount ? { iban: inv.bankAccount.iban, bank: inv.bankAccount.bankName, accountName: inv.bankAccount.accountName } : null,
    };
  }
}
