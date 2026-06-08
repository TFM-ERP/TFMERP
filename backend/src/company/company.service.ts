import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

const DATE_FIELDS = new Set([
  'licenseIssueDate',
  'licenseExpiryDate',
  'vatRegistrationDate',
  'corporateTaxRegistrationDate',
]);
const NUMBER_FIELDS = new Set(['defaultVatRate', 'defaultCorporateTaxRate', 'defaultPaymentTermDays']);

function sanitize(input: any): any {
  const out: any = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (v === '' || v === undefined) continue;
    if (v === null) { out[k] = null; continue; }
    if (DATE_FIELDS.has(k)) {
      const d = new Date(v as string);
      out[k] = isNaN(d.getTime()) ? undefined : d;
    } else if (NUMBER_FIELDS.has(k)) {
      const n = Number(v);
      out[k] = isNaN(n) ? undefined : n;
    } else {
      out[k] = v;
    }
  }
  return out;
}

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  async getProfile() {
    let profile = await this.prisma.companyProfile.findFirst({
      include: {
        locations: { orderBy: { createdAt: 'asc' } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!profile) {
      profile = await this.prisma.companyProfile.create({
        data: { legalName: 'The Film Makers FZ LLC' },
        include: { locations: true, documents: true },
      });
    }
    const bankAccounts = await this.listBankAccounts();
    return { ...profile, bankAccounts };
  }

  async updateProfile(data: any) {
    const current = await this.getProfile();
    const { bankAccounts, locations, documents, id, createdAt, updatedAt, ...rest } = data || {};
    await this.prisma.companyProfile.update({ where: { id: current.id }, data: sanitize(rest) });
    return this.getProfile();
  }

  async completeSetup(data: any) {
    const current = await this.getProfile();
    const { bankAccounts, locations, documents, id, createdAt, updatedAt, ...rest } = data || {};
    await this.prisma.companyProfile.update({
      where: { id: current.id },
      data: { ...sanitize(rest), setupComplete: true },
    });
    return this.getProfile();
  }

  private async companyId() {
    const p = await this.prisma.companyProfile.findFirst({ select: { id: true } });
    if (p) return p.id;
    const created = await this.prisma.companyProfile.create({
      data: { legalName: 'The Film Makers FZ LLC' },
      select: { id: true },
    });
    return created.id;
  }

  private mapBank(b: any) {
    return {
      id: b.id,
      accountName: b.accountName,
      bankName: b.bankName,
      branch: b.branch,
      accountNumber: b.accountNumber,
      iban: b.iban,
      swift: b.swiftCode,
      currency: b.currency,
      bankAddress: b.bankAddress,
      isDefault: b.isDefaultInvoice,
      isActive: b.isActive,
    };
  }

  private toFinance(data: any) {
    const out: any = {};
    for (const k of ['accountName', 'bankName', 'branch', 'accountNumber', 'iban', 'currency', 'bankAddress']) {
      if (data[k] !== undefined) out[k] = data[k] || undefined;
    }
    if (data.swift !== undefined) out.swiftCode = data.swift || undefined;
    return out;
  }

  async listBankAccounts() {
    const rows = await this.prisma.bankAccount.findMany({
      where: { isActive: true },
      orderBy: [{ isDefaultInvoice: 'desc' }, { bankName: 'asc' }],
    });
    return rows.map((b) => this.mapBank(b));
  }

  async createBankAccount(data: any) {
    if (data?.isDefault) {
      await this.prisma.bankAccount.updateMany({ data: { isDefaultInvoice: false, isDefaultQuotation: false } });
    }
    const created = await this.prisma.bankAccount.create({
      data: {
        ...this.toFinance(data),
        isDefaultInvoice: !!data.isDefault,
        isDefaultQuotation: !!data.isDefault,
        isDefaultReceiving: !!data.isDefault,
      },
    });
    return this.mapBank(created);
  }

  async updateBankAccount(id: string, data: any) {
    if (data?.isDefault) {
      await this.prisma.bankAccount.updateMany({ data: { isDefaultInvoice: false, isDefaultQuotation: false } });
    }
    const patch: any = this.toFinance(data);
    if (data.isDefault !== undefined) {
      patch.isDefaultInvoice = !!data.isDefault;
      patch.isDefaultQuotation = !!data.isDefault;
    }
    const updated = await this.prisma.bankAccount.update({ where: { id }, data: patch });
    return this.mapBank(updated);
  }

  async deleteBankAccount(id: string) {
    return this.prisma.bankAccount.update({ where: { id }, data: { isActive: false } });
  }

  async listLocations() {
    return this.prisma.companyLocation.findMany({
      where: { companyId: await this.companyId() },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createLocation(data: any) {
    const { id, companyId: _c, ...clean } = data || {};
    return this.prisma.companyLocation.create({ data: { ...clean, companyId: await this.companyId() } });
  }

  async updateLocation(id: string, data: any) {
    const { id: _i, companyId: _c, ...clean } = data || {};
    return this.prisma.companyLocation.update({ where: { id }, data: clean });
  }

  async deleteLocation(id: string) {
    return this.prisma.companyLocation.delete({ where: { id } });
  }

  async listDocuments() {
    return this.prisma.companyDocument.findMany({
      where: { companyId: await this.companyId() },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDocument(data: any) {
    const { id, companyId: _c, issueDate, expiryDate, ...rest } = data || {};
    const clean: any = { ...rest };
    if (issueDate) clean.issueDate = new Date(issueDate);
    if (expiryDate) clean.expiryDate = new Date(expiryDate);
    return this.prisma.companyDocument.create({ data: { ...clean, companyId: await this.companyId() } });
  }

  async updateDocument(id: string, data: any) {
    const { id: _i, companyId: _c, issueDate, expiryDate, ...rest } = data || {};
    const clean: any = { ...rest };
    if (issueDate) clean.issueDate = new Date(issueDate);
    if (expiryDate) clean.expiryDate = new Date(expiryDate);
    return this.prisma.companyDocument.update({ where: { id }, data: clean });
  }

  async deleteDocument(id: string) {
    return this.prisma.companyDocument.delete({ where: { id } });
  }

  async expiryAlerts(days = 60) {
    const profile = await this.getProfile();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + days);
    const docs = await this.prisma.companyDocument.findMany({
      where: { companyId: profile.id, expiryDate: { not: null, lte: horizon } },
      orderBy: { expiryDate: 'asc' },
    });
    const alerts: any[] = docs.map((d) => ({ type: 'Document', title: d.title, expiryDate: d.expiryDate }));
    if (profile.licenseExpiryDate && new Date(profile.licenseExpiryDate) <= horizon) {
      alerts.push({ type: 'Trade License', title: profile.tradeLicenseNumber || 'Trade License', expiryDate: profile.licenseExpiryDate });
    }
    return alerts.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }
}
