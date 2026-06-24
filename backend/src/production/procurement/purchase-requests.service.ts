import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CostingService } from '../costing/costing.service';

/** SmartPO requisition gate — Purchase Requests (req → approve → convert to PO). */
@Injectable()
export class PurchaseRequestsService {
  constructor(private prisma: PrismaService, private costing: CostingService) {}
  private pr() { return (this.prisma as any).purchaseRequest; }

  list(projectId: string, status?: string) {
    const where: any = { projectId }; if (status) where.status = status;
    return this.pr().findMany({ where, orderBy: { createdAt: 'desc' } });
  }
  private async nextNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await (this.prisma as any).documentSequence.upsert({ where: { prefix: 'PR' }, update: { lastNumber: { increment: 1 } }, create: { prefix: 'PR', lastNumber: 1, year } });
    return `PR-${year}-${String(seq.lastNumber).padStart(4, '0')}`;
  }
  async create(data: any, userId?: string) {
    const prNumber = await this.nextNumber();
    return this.pr().create({ data: {
      projectId: data.projectId, prNumber, description: data.description || 'Purchase request',
      costCenterCode: data.costCenterCode || null, costCenterTitle: data.costCenterTitle || null,
      budgetLineItemId: data.budgetLineItemId || null, vendorId: data.vendorId || null, vendorName: data.vendorName || null,
      amount: Number(data.amount) || 0, taxAmount: Number(data.taxAmount) || 0, currency: data.currency || 'AED',
      neededBy: data.neededBy ? new Date(data.neededBy) : null, notes: data.notes || null,
      status: 'DRAFT', requestedById: userId || null,
    } });
  }
  async update(id: string, data: any) {
    const { id: _i, projectId, prNumber, poId, createdAt, updatedAt, ...rest } = data || {};
    if (rest.amount != null) rest.amount = Number(rest.amount);
    if (rest.taxAmount != null) rest.taxAmount = Number(rest.taxAmount);
    if (rest.neededBy) rest.neededBy = new Date(rest.neededBy);
    return this.pr().update({ where: { id }, data: rest });
  }
  setStatus(id: string, status: string, userId?: string) {
    const data: any = { status };
    if (status === 'APPROVED' || status === 'REJECTED') { data.approvedById = userId || null; data.approvedAt = new Date(); }
    return this.pr().update({ where: { id }, data });
  }
  remove(id: string) { return this.pr().delete({ where: { id } }); }

  /** Approve → convert a PR into a real PO (the procurement control gate). */
  async convertToPo(id: string, userId?: string) {
    const pr = await this.pr().findUnique({ where: { id } });
    if (!pr) throw new NotFoundException('Purchase request not found');
    if (pr.poId) throw new BadRequestException('This request was already converted to a PO.');
    if (pr.status === 'REJECTED' || pr.status === 'CANCELLED') throw new BadRequestException(`A ${pr.status} request cannot be converted.`);
    const po: any = await this.costing.createPo({
      projectId: pr.projectId, vendorId: pr.vendorId, vendorName: pr.vendorName,
      costCenterCode: pr.costCenterCode, costCenterTitle: pr.costCenterTitle, budgetLineItemId: pr.budgetLineItemId,
      description: pr.description, amount: Number(pr.amount), taxAmount: Number(pr.taxAmount), currency: pr.currency,
      notes: `From ${pr.prNumber}`,
    }, userId);
    await this.pr().update({ where: { id }, data: { status: 'CONVERTED', poId: po.id, approvedById: userId || null, approvedAt: new Date() } });
    return po;
  }
}
