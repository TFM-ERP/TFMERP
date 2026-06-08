import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Query() q: any) {
    const where: any = {};
    if (q.entity) where.resource = { contains: q.entity, mode: 'insensitive' };
    if (q.resourceId) where.resourceId = q.resourceId; // per-record history (what auditors ask for)
    if (q.userId) where.userId = q.userId;
    if (q.action) where.action = q.action;
    const take = Math.min(Number(q.limit) || 100, 300);
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where, orderBy: { createdAt: 'desc' }, take, skip: Number(q.offset) || 0,
        include: { user: { select: { fullName: true, role: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}
