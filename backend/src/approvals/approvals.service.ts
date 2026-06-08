import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

// Approval ladder by amount (AED). Each tier defines the ordered approver roles.
function chainForAmount(amount: number): string[] {
  if (amount <= 5000) return ['Finance Manager'];
  if (amount <= 25000) return ['Finance Manager', 'General Manager'];
  return ['Finance Manager', 'General Manager', 'Director'];
}

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService) {}

  /** Build a routing chain for an expense (idempotent — won't duplicate an open request). */
  async routeExpense(expenseId: string, userId?: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense) throw new NotFoundException('Expense not found');

    const existing = await this.prisma.approvalRequest.findFirst({
      where: { entityType: 'EXPENSE', entityId: expenseId, status: 'PENDING' },
    });
    if (existing) return existing;

    const amount = Number(expense.totalAmount);
    const roles = chainForAmount(amount);

    const request = await this.prisma.approvalRequest.create({
      data: {
        entityType: 'EXPENSE',
        entityId: expenseId,
        title: `${expense.expenseNumber} — ${expense.description}`,
        amount,
        status: 'PENDING',
        currentStep: 0,
        createdById: userId || null,
        steps: { create: roles.map((role, i) => ({ stepOrder: i, approverRole: role })) },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    // Ensure the underlying expense reflects it's awaiting approval
    if (expense.status === 'DRAFT') {
      await this.prisma.expense.update({ where: { id: expenseId }, data: { status: 'PENDING_APPROVAL' } });
    }
    return request;
  }

  /** Build a routing chain for a purchase order. */
  async routePo(poId: string, userId?: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new NotFoundException('Purchase order not found');
    const existing = await this.prisma.approvalRequest.findFirst({ where: { entityType: 'PO', entityId: poId, status: 'PENDING' } });
    if (existing) return existing;
    const roles = chainForAmount(Number(po.total));
    return this.prisma.approvalRequest.create({
      data: {
        entityType: 'PO', entityId: poId,
        title: `${po.poNumber} — ${po.vendorName || ''} ${po.description}`.trim(),
        amount: Number(po.total), status: 'PENDING', currentStep: 0, createdById: userId || null,
        steps: { create: roles.map((role, i) => ({ stepOrder: i, approverRole: role })) },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  async listPending() {
    const requests = await this.prisma.approvalRequest.findMany({
      where: { status: 'PENDING' },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    return requests.map(r => ({
      ...r,
      currentApproverRole: r.steps.find(s => s.stepOrder === r.currentStep)?.approverRole,
      totalSteps: r.steps.length,
    }));
  }

  async getForEntity(entityType: string, entityId: string) {
    return this.prisma.approvalRequest.findFirst({
      where: { entityType, entityId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAll(status?: string) {
    return this.prisma.approvalRequest.findMany({
      where: status ? { status: status as any } : {},
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Approve/reject the CURRENT step of a request. */
  async act(requestId: string, decision: 'APPROVED' | 'REJECTED', data: { comment?: string }, user?: { id?: string; fullName?: string }) {
    const req = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!req) throw new NotFoundException('Approval request not found');
    if (req.status !== 'PENDING') throw new BadRequestException('This request is already closed.');

    const step = req.steps.find(s => s.stepOrder === req.currentStep);
    if (!step) throw new BadRequestException('No active step to act on.');

    await this.prisma.approvalStep.update({
      where: { id: step.id },
      data: {
        status: decision,
        comment: data.comment || null,
        decidedById: user?.id || null,
        decidedByName: user?.fullName || null,
        decidedAt: new Date(),
      },
    });

    if (decision === 'REJECTED') {
      await this.prisma.approvalRequest.update({ where: { id: requestId }, data: { status: 'REJECTED' } });
      await this.applyToEntity(req.entityType, req.entityId, 'REJECTED', user?.id);
      return this.getRequest(requestId);
    }

    // Approved — advance or finalize
    const isLast = req.currentStep >= req.steps.length - 1;
    if (isLast) {
      await this.prisma.approvalRequest.update({ where: { id: requestId }, data: { status: 'APPROVED' } });
      await this.applyToEntity(req.entityType, req.entityId, 'APPROVED', user?.id);
    } else {
      await this.prisma.approvalRequest.update({ where: { id: requestId }, data: { currentStep: req.currentStep + 1 } });
    }
    return this.getRequest(requestId);
  }

  private async getRequest(id: string) {
    return this.prisma.approvalRequest.findUnique({ where: { id }, include: { steps: { orderBy: { stepOrder: 'asc' } } } });
  }

  /** Reflect the final decision on the source document. */
  private async applyToEntity(entityType: string, entityId: string, decision: 'APPROVED' | 'REJECTED', userId?: string) {
    if (entityType === 'EXPENSE') {
      const exp = await this.prisma.expense.findUnique({ where: { id: entityId } });
      if (!exp) return;
      if (decision === 'APPROVED') {
        await this.prisma.expense.update({
          where: { id: entityId },
          data: { status: 'APPROVED', approvedById: userId || null, approvedAt: new Date() },
        });
      } else {
        await this.prisma.expense.update({
          where: { id: entityId },
          data: { status: 'REJECTED', approvedById: userId || null, approvedAt: new Date() },
        });
      }
    } else if (entityType === 'PO') {
      const po = await this.prisma.purchaseOrder.findUnique({ where: { id: entityId } });
      if (!po) return;
      await this.prisma.purchaseOrder.update({
        where: { id: entityId },
        data: { status: decision === 'APPROVED' ? 'APPROVED' : 'CANCELLED' },
      });
    }
  }
}
