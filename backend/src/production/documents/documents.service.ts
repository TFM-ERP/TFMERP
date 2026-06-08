import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

// Detect provider from a pasted URL
function detectProvider(url: string): string {
  const u = (url || '').toLowerCase();
  if (u.includes('drive.google.com') || u.includes('docs.google.com')) return 'GDRIVE';
  if (u.includes('dropbox.com')) return 'DROPBOX';
  return 'LINK';
}

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  list(projectId: string, query: { entityType?: string; entityId?: string } = {}) {
    const where: any = { projectId };
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    return this.prisma.projectDocument.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  create(data: any, userId?: string) {
    const kind = data.kind || (data.url?.startsWith('http') ? 'LINK' : 'FILE');
    const provider = kind === 'LINK' ? detectProvider(data.url) : 'UPLOAD';
    return this.prisma.projectDocument.create({
      data: {
        projectId: data.projectId, name: data.name || 'Document', kind, provider,
        url: data.url, category: data.category || null, mimeType: data.mimeType || null,
        sizeBytes: data.sizeBytes ? Number(data.sizeBytes) : null,
        entityType: data.entityType || null, entityId: data.entityId || null,
        uploadedById: userId || null,
      },
    });
  }

  update(id: string, data: any) {
    const { id: _i, projectId, project, createdAt, ...rest } = data || {};
    return this.prisma.projectDocument.update({ where: { id }, data: rest });
  }

  remove(id: string) { return this.prisma.projectDocument.delete({ where: { id } }); }
}
