import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
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

  /** Stream a per-user watermarked copy of an uploaded PDF (leak-traceable share into chat). */
  async watermark(id: string, user: any) {
    const doc = await this.prisma.projectDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('document not found');
    if (doc.kind !== 'FILE' || !doc.url || doc.url.startsWith('http') || !/\.pdf(\?|$)/i.test(doc.url)) {
      throw new BadRequestException('Only uploaded PDF documents can be watermarked.');
    }
    const diskPath = join(process.cwd(), doc.url.replace(/^\/+/, ''));
    let bytes: Buffer;
    try { bytes = readFileSync(diskPath); } catch { throw new NotFoundException('file missing on disk'); }
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const who = user?.fullName || user?.email || user?.id || 'user';
    const stamp = `${who}  ·  ${user?.email || ''}`.trim();
    const when = new Date().toISOString().slice(0, 16).replace('T', ' ');
    for (const page of pdf.getPages()) {
      const { height } = page.getSize();
      for (let yy = 40; yy < height + 120; yy += 190) {
        page.drawText(stamp, { x: 24, y: yy, size: 15, font, color: rgb(0.5, 0.5, 0.58), opacity: 0.16, rotate: degrees(30) });
      }
      page.drawText(`CONFIDENTIAL · issued to ${who} · ${when} · do not distribute`, { x: 24, y: 14, size: 8, font, color: rgb(0.45, 0.45, 0.5), opacity: 0.7 });
    }
    return Buffer.from(await pdf.save());
  }
}
