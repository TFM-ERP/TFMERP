import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class OveragesService {
  constructor(private prisma: PrismaService) {}

  async list(projectId: string) {
    const items = await this.prisma.overage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    const totals = { all: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 } as Record<string, number>;
    for (const o of items) {
      const a = Number(o.amount);
      totals.all += a;
      totals[o.status] += a;
    }
    return { items, totals };
  }

  async create(data: {
    projectId: string; accountCode?: string; accountTitle?: string;
    description: string; amount?: number; reason?: string; notes?: string;
  }, userId?: string) {
    return this.prisma.overage.create({
      data: {
        projectId: data.projectId,
        accountCode: data.accountCode || null,
        accountTitle: data.accountTitle || null,
        description: data.description || 'Overage',
        amount: data.amount ?? 0,
        reason: data.reason || null,
        notes: data.notes || null,
        requestedById: userId || null,
      },
    });
  }

  async update(id: string, data: any) {
    const { id: _i, projectId, project, createdAt, updatedAt, ...rest } = data || {};
    return this.prisma.overage.update({ where: { id }, data: rest });
  }

  async setStatus(id: string, status: string, userId?: string) {
    const decided = status === 'APPROVED' || status === 'REJECTED';
    return this.prisma.overage.update({
      where: { id },
      data: {
        status: status as any,
        approvedById: decided ? (userId || null) : null,
        approvedAt: decided ? new Date() : null,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.overage.delete({ where: { id } });
  }
}
