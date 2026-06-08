import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Categories that trigger auto-creation of a linked MaintenanceVendor */
const WORKSHOP_CATEGORIES = ['Maintenance Workshop', 'Spare Parts Supplier', 'Tire Supplier'];

/** Map supplier category → MaintenanceVendor vendorType */
const CATEGORY_TO_VENDOR_TYPE: Record<string, string> = {
  'Maintenance Workshop':  'AUTO_WORKSHOP',
  'Spare Parts Supplier':  'SPARE_PARTS_SUPPLIER',
  'Tire Supplier':         'TIRE_SUPPLIER',
};

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  // ── List / Search ────────────────────────────────────────────────────────────

  async findAll(query: {
    search?: string;
    category?: string;
    status?: string;
    isActive?: string;
    page?: number;
    limit?: number;
  }) {
    const page  = Math.max(1, Number(query.page)  || 1);
    const limit = Math.max(1, Number(query.limit) || 50);
    const skip  = (page - 1) * limit;

    const where: any = {};
    if (query.status)   where.status = query.status;
    else if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

    if (query.category) {
      where.OR = [
        { category:   { contains: query.category, mode: 'insensitive' } },
        { categories: { has: query.category } },
      ];
    }

    if (query.search) {
      where.OR = [
        { name:               { contains: query.search, mode: 'insensitive' } },
        { tradeName:          { contains: query.search, mode: 'insensitive' } },
        { supplierCode:       { contains: query.search, mode: 'insensitive' } },
        { trn:                { contains: query.search, mode: 'insensitive' } },
        { tradeLicenseNumber: { contains: query.search, mode: 'insensitive' } },
        { contactName:        { contains: query.search, mode: 'insensitive' } },
        { email:              { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        include: {
          _count: { select: { expenses: true, supplierContacts: true, documents: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // Quick search for dropdowns (returns minimal fields)
  async search(q: string) {
    const where: any = { status: 'ACTIVE' };
    if (q) {
      where.OR = [
        { name:         { contains: q, mode: 'insensitive' } },
        { tradeName:    { contains: q, mode: 'insensitive' } },
        { supplierCode: { contains: q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.supplier.findMany({
      where,
      select: {
        id: true, supplierCode: true, name: true, tradeName: true,
        category: true, categories: true, trn: true, vatId: true,
        paymentTermDays: true, currency: true,
        contactName: true, email: true, phone: true,
        bankName: true, iban: true,
        googleMapsUrl: true,
        vendorId: true,
      },
      orderBy: { name: 'asc' },
      take: 30,
    });
  }

  // ── Single Record ────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        supplierContacts: { orderBy: [{ isPrimary: 'desc' }, { fullName: 'asc' }] },
        documents:        { orderBy: { createdAt: 'desc' } },
        expenses: {
          orderBy: { expenseDate: 'desc' },
          take: 20,
          select: {
            id: true, expenseNumber: true, category: true,
            description: true, totalAmount: true, status: true,
            expenseDate: true, vatAmount: true,
          },
        },
        _count: { select: { expenses: true, supplierContacts: true, documents: true } },
      },
    });
    if (!supplier) throw new NotFoundException(`Supplier ${id} not found`);
    return supplier;
  }

  // ── Create ───────────────────────────────────────────────────────────────────

  async create(data: any) {
    const count = await this.prisma.supplier.count();
    const supplierCode = `SUP-${String(count + 1).padStart(4, '0')}`;

    const categories: string[] = Array.isArray(data.categories) ? data.categories : [];

    // Derive single legacy category from multi-select for backward compat
    const legacyCategory = categories[0] || data.category || undefined;

    const supplier = await (this.prisma.supplier as any).create({
      data: {
        supplierCode,
        name:                data.name,
        tradeName:           data.tradeName          || undefined,
        category:            legacyCategory,
        categories,
        googleMapsUrl:       data.googleMapsUrl      || undefined,
        gpsCoordinates:      data.gpsCoordinates     || undefined,
        status:              data.status             || 'ACTIVE',
        isActive:            data.status !== 'INACTIVE' && data.status !== 'BLACKLISTED',
        trn:                 data.trn                || undefined,
        vatId:               data.vatId || data.trn  || undefined,
        trnCertificateUrl:   data.trnCertificateUrl  || undefined,
        tradeLicenseNumber:  data.tradeLicenseNumber || undefined,
        tradeLicenseExpiry:  data.tradeLicenseExpiry  ? new Date(data.tradeLicenseExpiry)  : undefined,
        tradeLicenseUrl:     data.tradeLicenseUrl    || undefined,
        businessLicenseUrl:  data.businessLicenseUrl || undefined,
        insuranceDocUrl:     data.insuranceDocUrl    || undefined,
        insuranceExpiry:     data.insuranceExpiry     ? new Date(data.insuranceExpiry)     : undefined,
        contractExpiry:      data.contractExpiry      ? new Date(data.contractExpiry)      : undefined,
        contactName:         data.contactName        || undefined,
        email:               data.email              || undefined,
        phone:               data.phone              || undefined,
        address:             data.address            || undefined,
        city:                data.city               || undefined,
        country:             data.country            || 'UAE',
        website:             data.website            || undefined,
        bankName:            data.bankName           || undefined,
        bankAccount:         data.bankAccount        || undefined,
        iban:                data.iban               || undefined,
        swiftCode:           data.swiftCode          || undefined,
        bankBranch:          data.bankBranch         || undefined,
        bankAddress:         data.bankAddress        || undefined,
        currency:            data.currency           || 'AED',
        paymentTermDays:     data.paymentTermDays     ? Number(data.paymentTermDays)  : undefined,
        creditLimit:         data.creditLimit         ? Number(data.creditLimit)      : undefined,
        notes:               data.notes              || undefined,
        blacklistReason:     data.blacklistReason    || undefined,
      },
    });

    // Auto-create a linked MaintenanceVendor if any workshop category is selected
    await this._syncVendorLink(supplier.id, categories, data, supplier.name);

    return this.findOne(supplier.id);
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  async update(id: string, data: any) {
    const existing = await this.findOne(id);
    const d: any = {};

    const strFields = [
      'name','tradeName','category','trn','vatId','trnCertificateUrl',
      'tradeLicenseNumber','tradeLicenseUrl','businessLicenseUrl',
      'insuranceDocUrl','contactName','email','phone','address',
      'city','country','website','bankName','bankAccount','iban',
      'swiftCode','bankBranch','bankAddress','notes','blacklistReason',
      'googleMapsUrl','gpsCoordinates',
    ];
    for (const k of strFields) {
      if (data[k] !== undefined) d[k] = data[k] || null;
    }

    if (Array.isArray(data.categories)) {
      d.categories = data.categories;
      // Keep legacy field in sync
      if (!data.category) d.category = data.categories[0] || null;
    }

    if (data.status !== undefined) {
      d.status   = data.status;
      d.isActive = data.status === 'ACTIVE';
    }
    if (data.currency !== undefined) d.currency = data.currency;

    for (const k of ['tradeLicenseExpiry','insuranceExpiry','contractExpiry']) {
      if (data[k] !== undefined) d[k] = data[k] ? new Date(data[k]) : null;
    }
    for (const k of ['paymentTermDays','creditLimit']) {
      if (data[k] !== undefined) d[k] = data[k] !== '' ? Number(data[k]) : null;
    }
    if (data.trn && !data.vatId) d.vatId = data.trn;

    const updated = await (this.prisma.supplier as any).update({ where: { id }, data: d });

    // Sync vendor link if categories changed
    if (Array.isArray(data.categories)) {
      await this._syncVendorLink(id, data.categories, data, updated.name);
    }

    return this.findOne(id);
  }

  // ── Vendor Link Sync (private) ───────────────────────────────────────────────

  private async _syncVendorLink(supplierId: string, categories: string[], data: any, name: string) {
    // Guard: if db hasn't been pushed yet, the vendorId / supplierId columns won't exist.
    // We wrap this entire method so the rest of create/update still succeeds.
    try {
      const supplier = await (this.prisma.supplier as any).findUnique({
        where: { id: supplierId },
        select: { vendorId: true },
      });

      const needsVendor = categories.some(c => WORKSHOP_CATEGORIES.includes(c));

      if (needsVendor && !supplier?.vendorId) {
        const workshopCat = categories.find(c => WORKSHOP_CATEGORIES.includes(c));
        const vendorType  = workshopCat ? (CATEGORY_TO_VENDOR_TYPE[workshopCat] || 'AUTO_WORKSHOP') : 'AUTO_WORKSHOP';

        const vendor = await (this.prisma.maintenanceVendor as any).create({
          data: {
            name:            name,
            vendorType:      vendorType,
            contactPerson:   data.contactName  || undefined,
            mobile:          data.phone        || undefined,
            email:           data.email        || undefined,
            address:         data.address      || undefined,
            googleMapsUrl:   data.googleMapsUrl || undefined,
            trn:             data.trn          || undefined,
            currency:        data.currency     || 'AED',
            paymentTermDays: data.paymentTermDays ? Number(data.paymentTermDays) : 30,
            bankName:        data.bankName     || undefined,
            iban:            data.iban         || undefined,
            supplierId,
          },
        });

        await (this.prisma.supplier as any).update({
          where: { id: supplierId },
          data:  { vendorId: vendor.id },
        });

      } else if (!needsVendor && supplier?.vendorId) {
        await (this.prisma.supplier as any).update({
          where: { id: supplierId },
          data:  { vendorId: null },
        });
        await (this.prisma.maintenanceVendor as any).update({
          where: { id: supplier.vendorId },
          data:  { supplierId: null },
        });

      } else if (needsVendor && supplier?.vendorId) {
        await (this.prisma.maintenanceVendor as any).update({
          where: { id: supplier.vendorId },
          data: {
            name:          name,
            googleMapsUrl: data.googleMapsUrl || undefined,
            mobile:        data.phone         || undefined,
            email:         data.email         || undefined,
            address:       data.address       || undefined,
          },
        });
      }
    } catch (err: any) {
      // Silently skip if schema hasn't been pushed yet (vendorId column missing)
      console.warn('[Suppliers] _syncVendorLink skipped — run prisma db push to enable:', err?.message?.slice(0, 120));
    }
  }

  // ── Status Helpers ───────────────────────────────────────────────────────────

  async updateStatus(id: string, status: string, blacklistReason?: string) {
    await this.findOne(id);
    return this.prisma.supplier.update({
      where: { id },
      data: {
        status:          status as any,
        isActive:        status === 'ACTIVE',
        blacklistReason: blacklistReason || undefined,
      },
    });
  }

  async toggleActive(id: string) {
    const s = await this.findOne(id);
    const newStatus = s.isActive ? 'INACTIVE' : 'ACTIVE';
    return this.prisma.supplier.update({
      where: { id },
      data: { isActive: !s.isActive, status: newStatus as any },
    });
  }

  // ── Contacts ─────────────────────────────────────────────────────────────────

  async addContact(supplierId: string, data: any) {
    await this.findOne(supplierId);
    if (data.isPrimary) {
      await this.prisma.supplierContact.updateMany({
        where: { supplierId },
        data:  { isPrimary: false },
      });
    }
    return this.prisma.supplierContact.create({
      data: {
        supplierId,
        fullName:         data.fullName,
        role:             data.role             || 'OTHER',
        jobTitle:         data.jobTitle         || undefined,
        department:       data.department       || undefined,
        mobile:           data.mobile           || undefined,
        whatsapp:         data.whatsapp         || undefined,
        email:            data.email            || undefined,
        officePhone:      data.officePhone      || undefined,
        preferredContact: data.preferredContact || undefined,
        isPrimary:        !!data.isPrimary,
        notes:            data.notes            || undefined,
        globalContactId:  data.globalContactId  || undefined,
      },
    });
  }

  async updateContact(contactId: string, data: any) {
    const contact = await this.prisma.supplierContact.findUnique({ where: { id: contactId } });
    if (!contact) throw new NotFoundException(`Contact ${contactId} not found`);
    if (data.isPrimary) {
      await this.prisma.supplierContact.updateMany({
        where: { supplierId: contact.supplierId },
        data:  { isPrimary: false },
      });
    }
    return this.prisma.supplierContact.update({ where: { id: contactId }, data });
  }

  async removeContact(contactId: string) {
    await this.prisma.supplierContact.delete({ where: { id: contactId } });
  }

  // ── Documents ────────────────────────────────────────────────────────────────

  async addDocument(supplierId: string, data: any) {
    await this.findOne(supplierId);
    return this.prisma.supplierDocument.create({
      data: {
        supplierId,
        docType:    data.docType    || 'OTHER',
        name:       data.name,
        fileUrl:    data.fileUrl,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        notes:      data.notes      || undefined,
      },
    });
  }

  async removeDocument(docId: string) {
    await this.prisma.supplierDocument.delete({ where: { id: docId } });
  }

  // ── Financial Summary ────────────────────────────────────────────────────────

  async getFinancialSummary(id: string) {
    await this.findOne(id);

    const [totalSpend, pendingExpenses] = await Promise.all([
      this.prisma.expense.aggregate({
        where: { supplierId: id, status: { in: ['APPROVED', 'PAID'] } },
        _sum:   { totalAmount: true, vatAmount: true },
        _count: { id: true },
      }),
      this.prisma.expense.aggregate({
        where: { supplierId: id, status: { in: ['PENDING_APPROVAL'] } },
        _sum:   { totalAmount: true },
        _count: { id: true },
      }),
    ]);

    return {
      totalSpend:        totalSpend._sum.totalAmount      || 0,
      totalVatReclaimed: totalSpend._sum.vatAmount         || 0,
      expenseCount:      totalSpend._count.id,
      pendingAmount:     pendingExpenses._sum.totalAmount  || 0,
      pendingCount:      pendingExpenses._count.id,
    };
  }

  // ── Expiry Alerts ────────────────────────────────────────────────────────────

  async getExpiryAlerts() {
    const now      = new Date();
    const in60Days = new Date(now.getTime() + 60 * 86400000);

    const suppliers = await this.prisma.supplier.findMany({
      where: {
        status: { not: 'BLACKLISTED' },
        OR: [
          { tradeLicenseExpiry: { lte: in60Days } },
          { insuranceExpiry:    { lte: in60Days } },
          { contractExpiry:     { lte: in60Days } },
        ],
      },
      select: {
        id: true, name: true, supplierCode: true,
        tradeLicenseNumber: true, tradeLicenseExpiry: true,
        insuranceExpiry: true, contractExpiry: true,
      },
      orderBy: { tradeLicenseExpiry: 'asc' },
    });

    const docAlerts = await this.prisma.supplierDocument.findMany({
      where: {
        expiryDate: { lte: in60Days, gte: now },
        supplier: { status: { not: 'BLACKLISTED' } },
      },
      include: { supplier: { select: { id: true, name: true, supplierCode: true } } },
      orderBy: { expiryDate: 'asc' },
    });

    return { suppliers, documents: docAlerts };
  }

  async getCategories(): Promise<string[]> {
    const results = await this.prisma.supplier.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return results.map(r => r.category!).filter(Boolean);
  }
}
