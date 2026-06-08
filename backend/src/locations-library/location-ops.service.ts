import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * SYS-07 slice 7 — shared operational records that work on EITHER a master library
 * location (standalone module) OR a project location (per-project). Covers the
 * permit-authority directory, security/marshals, and the location payment schedule.
 * Ledger posting (project-only) lives in the production LocationsService, which wraps
 * these CRUD methods — keeping this service free of a production-module dependency.
 */
type Scope = 'master' | 'project';

@Injectable()
export class LocationOpsService {
  constructor(private prisma: PrismaService) {}

  private owner(scope: Scope, id: string) {
    return scope === 'master' ? { masterLocationId: id } : { locationId: id };
  }
  private async assertOwner(scope: Scope, id: string) {
    const ok = scope === 'master'
      ? await this.prisma.masterLocation.findUnique({ where: { id }, select: { id: true } })
      : await this.prisma.location.findUnique({ where: { id }, select: { id: true } });
    if (!ok) throw new NotFoundException('Location not found');
  }
  private clean(data: any, dates: string[] = []) {
    const out: any = {};
    const SKIP = ['id', 'locationId', 'masterLocationId', 'location', 'masterLocation', 'createdAt', 'updatedAt', 'createdById', 'postedTxnId'];
    for (const [k, v] of Object.entries(data || {})) {
      if (SKIP.includes(k)) continue;
      if (v === '') { out[k] = null; continue; }
      if (dates.includes(k)) out[k] = v ? new Date(v as string) : null;
      else out[k] = v;
    }
    return out;
  }

  // ── Permit authority directory (standalone, company-wide) ───────────────────
  listAuthorities() { return this.prisma.permitAuthority.findMany({ orderBy: { name: 'asc' } }); }
  upsertAuthority(data: any) {
    if (!data?.name) throw new BadRequestException('name is required');
    const d = this.clean(data);
    return data.id
      ? this.prisma.permitAuthority.update({ where: { id: data.id }, data: d })
      : this.prisma.permitAuthority.create({ data: d });
  }
  removeAuthority(id: string) { return this.prisma.permitAuthority.delete({ where: { id } }); }

  // ── Security & marshals ─────────────────────────────────────────────────────
  listSecurity(scope: Scope, id: string) {
    return this.prisma.locationSecurity.findMany({ where: this.owner(scope, id), orderBy: { createdAt: 'desc' } });
  }
  async createSecurity(scope: Scope, id: string, data: any, userId?: string) {
    await this.assertOwner(scope, id);
    return this.prisma.locationSecurity.create({ data: { ...this.owner(scope, id), ...this.computeSecurity(data), createdById: userId || null } });
  }
  async updateSecurity(secId: string, data: any) {
    const e = await this.prisma.locationSecurity.findUnique({ where: { id: secId }, select: { id: true } });
    if (!e) throw new NotFoundException('Security record not found');
    return this.prisma.locationSecurity.update({ where: { id: secId }, data: this.computeSecurity(data) });
  }
  removeSecurity(secId: string) { return this.prisma.locationSecurity.delete({ where: { id: secId } }); }

  private computeSecurity(data: any) {
    const d = this.clean(data, ['shiftStart', 'shiftEnd']);
    const guards = Number(d.guards ?? 0), marshals = Number(d.marshals ?? 0);
    const days = Number(d.days ?? 1), rate = d.ratePerGuard != null ? Number(d.ratePerGuard) : null;
    if (rate != null && d.totalCost == null) d.totalCost = Math.round((guards + marshals) * rate * days * 100) / 100;
    return d;
  }

  // ── Payment schedule (quote → deposit → balance → settled) ──────────────────
  listPayments(scope: Scope, id: string) {
    return this.prisma.locationPayment.findMany({ where: this.owner(scope, id), orderBy: [{ status: 'asc' }, { dueDate: 'asc' }] });
  }
  async paymentSummary(scope: Scope, id: string) {
    const rows = await this.listPayments(scope, id);
    const sum = (f: (r: any) => boolean) => rows.filter(f).reduce((a, r) => a + Number(r.amount || 0), 0);
    const quoted = sum((r) => r.kind === 'QUOTE');
    const scheduled = sum((r) => r.kind !== 'QUOTE' && r.kind !== 'REFUND');
    const paid = sum((r) => r.status === 'PAID' && r.kind !== 'REFUND');
    const refunded = sum((r) => r.kind === 'REFUND');
    return { currency: rows[0]?.currency || 'AED', quoted, scheduled, paid, refunded, outstanding: Math.round((scheduled - paid) * 100) / 100, count: rows.length };
  }
  async createPayment(scope: Scope, id: string, data: any, userId?: string) {
    await this.assertOwner(scope, id);
    return this.prisma.locationPayment.create({ data: { ...this.owner(scope, id), ...this.clean(data, ['dueDate', 'paidDate']), createdById: userId || null } });
  }
  async updatePayment(payId: string, data: any) {
    const e = await this.prisma.locationPayment.findUnique({ where: { id: payId }, select: { id: true } });
    if (!e) throw new NotFoundException('Payment not found');
    return this.prisma.locationPayment.update({ where: { id: payId }, data: this.clean(data, ['dueDate', 'paidDate']) });
  }
  removePayment(payId: string) { return this.prisma.locationPayment.delete({ where: { id: payId } }); }
  /** Mark paid WITHOUT ledger (master scope / manual). Project scope uses the ledger wrapper. */
  async markPaid(payId: string, txnId?: string) {
    return this.prisma.locationPayment.update({
      where: { id: payId },
      data: { status: 'PAID', paidDate: new Date(), postedTxnId: txnId || undefined },
    });
  }

  // ── Permits & documents on a MASTER location (standalone module) ─────────────
  listPermits(scope: Scope, id: string) {
    return this.prisma.locationPermit.findMany({ where: this.owner(scope, id), orderBy: { createdAt: 'desc' }, include: { authorityRef: true } });
  }
  async createPermit(scope: Scope, id: string, data: any, userId?: string) {
    await this.assertOwner(scope, id);
    return this.prisma.locationPermit.create({ data: { ...this.owner(scope, id), ...this.clean(data, ['applicationDate', 'approvalDate', 'expiryDate']), createdById: userId || null } });
  }
  async updatePermit(pid: string, data: any) {
    const e = await this.prisma.locationPermit.findUnique({ where: { id: pid }, select: { id: true } });
    if (!e) throw new NotFoundException('Permit not found');
    return this.prisma.locationPermit.update({ where: { id: pid }, data: this.clean(data, ['applicationDate', 'approvalDate', 'expiryDate']) });
  }
  removePermit(pid: string) { return this.prisma.locationPermit.delete({ where: { id: pid } }); }

  listDocuments(scope: Scope, id: string) {
    return this.prisma.locationDocument.findMany({ where: this.owner(scope, id), orderBy: [{ category: 'asc' }, { createdAt: 'desc' }] });
  }
  async createDocument(scope: Scope, id: string, data: any, userId?: string) {
    await this.assertOwner(scope, id);
    if (!data?.title) throw new BadRequestException('title is required');
    return this.prisma.locationDocument.create({ data: { ...this.owner(scope, id), ...this.clean(data, ['issueDate', 'signedDate', 'expiryDate']), createdById: userId || null } });
  }
  async updateDocument(did: string, data: any) {
    const e = await this.prisma.locationDocument.findUnique({ where: { id: did }, select: { id: true } });
    if (!e) throw new NotFoundException('Document not found');
    return this.prisma.locationDocument.update({ where: { id: did }, data: this.clean(data, ['issueDate', 'signedDate', 'expiryDate']) });
  }
  removeDocument(did: string) { return this.prisma.locationDocument.delete({ where: { id: did } }); }
}
