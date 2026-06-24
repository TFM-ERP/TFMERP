import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * SYS-UX Phase 3 — saved views (per-user table filters/sorts). Additive; route /me/saved-views.
 * `query` is opaque JSON owned by the client. NOTE: compiles once `prisma db:push` regenerates
 * the client with the SavedView model.
 */
@Injectable()
export class SavedViewsService {
  constructor(private prisma: PrismaService) {}

  list(userId: string, module?: string) {
    return this.prisma.savedView.findMany({
      where: { module: module || undefined, OR: [{ userId }, { shared: true }] },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(userId: string, data: { module: string; name: string; query?: any; shared?: boolean }) {
    return this.prisma.savedView.create({
      data: { userId, module: data.module, name: data.name, query: data.query ?? {}, shared: !!data.shared },
    });
  }

  async update(userId: string, id: string, data: { name?: string; query?: any; shared?: boolean }) {
    const v = await this.prisma.savedView.findUnique({ where: { id } });
    if (!v || v.userId !== userId) throw new ForbiddenException('Not your saved view');
    return this.prisma.savedView.update({ where: { id }, data: { name: data.name, query: data.query, shared: data.shared } });
  }

  async remove(userId: string, id: string) {
    const v = await this.prisma.savedView.findUnique({ where: { id } });
    if (!v || v.userId !== userId) throw new ForbiddenException('Not your saved view');
    return this.prisma.savedView.delete({ where: { id } });
  }
}
