import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../common/prisma/prisma.service';

const PURPOSE = 'vendor-onboarding';
const secret = () => process.env.JWT_SECRET || 'dev-secret-change-me';
const frontend = () => (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

@Injectable()
export class VendorOnboardingService {
  constructor(private prisma: PrismaService) {}

  // ── Invite (admin) ────────────────────────────────────────────────────────────
  async createInvite(projectId: string, hours = 72) {
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { id: true, title: true } });
    if (!project) throw new NotFoundException('Project not found');
    const ttl = Math.max(1, Math.min(720, Number(hours) || 72)); // 1h … 30d
    const token = jwt.sign({ projectId, purpose: PURPOSE }, secret(), { expiresIn: `${ttl}h` });
    const expiresAt = new Date(Date.now() + ttl * 3600 * 1000);
    return { token, url: `${frontend()}/vendor-onboarding/${token}`, expiresAt, projectTitle: project.title, hours: ttl };
  }

  // ── Token verification (public) ───────────────────────────────────────────────
  verify(token: string): { projectId: string } {
    try {
      const p: any = jwt.verify(token, secret());
      if (p?.purpose !== PURPOSE || !p?.projectId) throw new Error('bad');
      return { projectId: p.projectId };
    } catch {
      throw new BadRequestException('This onboarding link is invalid or has expired. Ask your contact for a new link.');
    }
  }

  /** Lightweight info to render the public form header. */
  async tokenInfo(token: string) {
    const { projectId } = this.verify(token);
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { title: true, projectNumber: true } });
    return { valid: true, projectTitle: project?.title || 'Production', projectNumber: project?.projectNumber || null };
  }

  // ── Public submission ─────────────────────────────────────────────────────────
  async submit(token: string, data: any, ip?: string) {
    const { projectId } = this.verify(token);
    if (!data?.name && !data?.tradeName) throw new BadRequestException('Company name is required.');
    return this.prisma.pendingVendor.create({
      data: {
        projectId,
        name: data.name || data.tradeName,
        tradeName: data.tradeName || null,
        category: data.category || null,
        contactName: data.contactName || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        city: data.city || null,
        country: data.country || 'United Arab Emirates',
        trn: data.trn || null,
        vatId: data.vatId || null,
        iban: data.iban || null,
        bankName: data.bankName || null,
        bankAccount: data.bankAccount || null,
        swiftCode: data.swiftCode || null,
        trnCertUrl: data.trnCertUrl || null,
        tradeLicenseUrl: data.tradeLicenseUrl || null,
        notes: data.notes || null,
        submittedIp: ip || null,
      },
      select: { id: true, name: true, status: true },
    });
  }

  // ── Admin review ──────────────────────────────────────────────────────────────
  listPending(projectId: string, status = 'PENDING') {
    return this.prisma.pendingVendor.findMany({
      where: { projectId, ...(status ? { status: status as any } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reject(id: string, userId?: string) {
    const pv = await this.prisma.pendingVendor.findUnique({ where: { id } });
    if (!pv) throw new NotFoundException('Submission not found');
    return this.prisma.pendingVendor.update({
      where: { id },
      data: { status: 'REJECTED', reviewedById: userId || null, reviewedAt: new Date() },
    });
  }

  /**
   * Approve a submission → create a Supplier master (holds banking) and a linked
   * ProductionVendor for the project, then mark the staging row APPROVED.
   * If a Supplier with the same TRN already exists, link to it instead of duplicating.
   */
  async approve(id: string, userId?: string) {
    const pv = await this.prisma.pendingVendor.findUnique({ where: { id } });
    if (!pv) throw new NotFoundException('Submission not found');
    if (pv.status === 'APPROVED') throw new BadRequestException('Already approved.');

    let supplier = pv.trn
      ? await this.prisma.supplier.findFirst({ where: { trn: pv.trn } })
      : null;

    if (!supplier) {
      supplier = await this.prisma.supplier.create({
        data: {
          name: pv.name,
          tradeName: pv.tradeName || null,
          category: pv.category || null,
          categories: pv.category ? [pv.category] : [],
          contactName: pv.contactName || null,
          email: pv.email || null,
          phone: pv.phone || null,
          address: pv.address || null,
          city: pv.city || null,
          country: pv.country || 'UAE',
          trn: pv.trn || null,
          vatId: pv.vatId || null,
          trnCertificateUrl: pv.trnCertUrl || null,
          tradeLicenseUrl: pv.tradeLicenseUrl || null,
          iban: pv.iban || null,
          bankName: pv.bankName || null,
          bankAccount: pv.bankAccount || null,
          swiftCode: pv.swiftCode || null,
          status: 'ACTIVE' as any,
          notes: pv.notes || `Self-onboarded ${new Date().toISOString().slice(0, 10)}`,
        },
      });
    }

    const vendor = await this.prisma.productionVendor.create({
      data: {
        projectId: pv.projectId, supplierId: supplier.id,
        name: pv.tradeName || pv.name, category: pv.category || null,
        contactName: pv.contactName || null, phone: pv.phone || null, email: pv.email || null,
        trn: pv.trn || null,
        notes: [pv.iban && `IBAN ${pv.iban}`, pv.bankName, pv.notes].filter(Boolean).join(' · ') || null,
      },
    });

    await this.prisma.pendingVendor.update({
      where: { id },
      data: { status: 'APPROVED', reviewedById: userId || null, reviewedAt: new Date(), productionVendorId: vendor.id, supplierId: supplier.id },
    });

    return { vendor, supplierId: supplier.id, supplierCreated: !pv.trn || true };
  }
}
