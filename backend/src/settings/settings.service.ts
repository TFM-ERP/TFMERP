import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Settings has been consolidated into Company Management.
 * This service is now a thin COMPATIBILITY SHIM: it reads from / writes to the
 * single CompanyProfile record (plus its default bank account) and exposes the
 * legacy field names that invoices, quotations and print pages still consume.
 *
 * There is no separate Settings store anymore — Company Management is the
 * single source of truth.
 */
@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  private async profile() {
    let p = await this.prisma.companyProfile.findFirst({
      include: { bankAccounts: { orderBy: { isDefault: 'desc' } } },
    });
    if (!p) {
      p = await this.prisma.companyProfile.create({
        data: { legalName: 'The Film Makers FZ LLC' },
        include: { bankAccounts: { orderBy: { isDefault: 'desc' } } },
      });
    }
    return p;
  }

  /** Map a CompanyProfile (+ default bank) to the legacy settings shape. */
  private toLegacy(p: any) {
    const bank = (p.bankAccounts && p.bankAccounts[0]) || {};
    return {
      // Company identity
      name:     p.legalName,
      tradeName: p.tradeName,
      trn:      p.trn,
      address:  p.address,
      city:     p.city,
      country:  p.country,
      phone:    p.mainPhone,
      email:    p.mainEmail,
      billingEmail: p.billingEmail,
      website:  p.website,
      logoUrl:  p.logoUrl,
      documentSettings: p.documentSettings || null,
      emailSettings: (p as any).emailSettings || null,
      // Finance defaults
      defaultCurrency:        p.currency || 'AED',
      vatRate:                p.defaultVatRate ?? 5,
      defaultPaymentTermDays: p.defaultPaymentTermDays ?? 30,
      invoicePrefix:          p.invoicePrefix || 'INV',
      quotationPrefix:        p.quotationPrefix || 'QT',
      bookingPrefix:          p.bookingPrefix || 'RB',
      // Default bank (from the default CompanyBankAccount)
      defaultBankName:    bank.bankName || null,
      defaultBankAccount: bank.accountNumber || null,
      defaultBankIban:    bank.iban || null,
      defaultBankSwift:   bank.swift || null,
      defaultBankBranch:  bank.branch || null,
      defaultBankAddress: bank.bankAddress || null,
    };
  }

  async get() {
    return this.toLegacy(await this.profile());
  }

  /**
   * Backwards-compatible update — writes legacy field names through to
   * CompanyProfile. (The UI no longer calls this; Company Management writes
   * directly. Kept so any lingering integration keeps working.)
   */
  async update(data: any) {
    const p = await this.profile();
    const d: any = {};
    if (data.name !== undefined) d.legalName = data.name || undefined;
    if (data.tradeName !== undefined) d.tradeName = data.tradeName || undefined;
    if (data.trn !== undefined) d.trn = data.trn || undefined;
    if (data.address !== undefined) d.address = data.address || undefined;
    if (data.city !== undefined) d.city = data.city || undefined;
    if (data.country !== undefined) d.country = data.country || undefined;
    if (data.phone !== undefined) d.mainPhone = data.phone || undefined;
    if (data.email !== undefined) d.mainEmail = data.email || undefined;
    if (data.website !== undefined) d.website = data.website || undefined;
    if (data.logoUrl !== undefined) d.logoUrl = data.logoUrl || undefined;
    if (data.defaultCurrency !== undefined) d.currency = data.defaultCurrency || undefined;
    if (data.invoicePrefix !== undefined) d.invoicePrefix = data.invoicePrefix || undefined;
    if (data.quotationPrefix !== undefined) d.quotationPrefix = data.quotationPrefix || undefined;
    if (data.bookingPrefix !== undefined) d.bookingPrefix = data.bookingPrefix || undefined;
    if (data.vatRate !== undefined && data.vatRate !== null) d.defaultVatRate = Number(data.vatRate);
    if (data.defaultPaymentTermDays !== undefined && data.defaultPaymentTermDays !== null) {
      d.defaultPaymentTermDays = Number(data.defaultPaymentTermDays);
    }
    if (data.emailSettings !== undefined) d.emailSettings = data.emailSettings;
    await this.prisma.companyProfile.update({ where: { id: p.id }, data: d });
    return this.get();
  }
}
