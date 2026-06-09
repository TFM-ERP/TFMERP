import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { join, basename } from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AnnotationsService } from './annotations.service';

/**
 * SYS-13 · D8 — Secure annotated export.
 * Burns the requester's *accessible* annotation layers onto the script PDF (highlights, pen,
 * text/sticky/tags) and stamps a diagonal name watermark for leak-tracing. IAM is respected:
 * only layers the user may see are flattened. Output PDF lands in /uploads. Uses pdf-lib
 * (dynamically imported).
 */
@Injectable()
export class ScriptExportService {
  constructor(private prisma: PrismaService, private annotations: AnnotationsService) {}

  private async lib() {
    const mod: any = await import('pdf-lib').catch(() => null);
    if (!mod) throw new BadRequestException('Export needs the "pdf-lib" package. Run: npm install pdf-lib (in backend/).');
    return mod;
  }
  private absPath(url: string) { return join(process.cwd(), 'uploads', basename(url)); }
  private hex(h?: string): [number, number, number] {
    const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
    if (!m) return [0.92, 0.7, 0.18];
    const n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  async exportPdf(revisionId: string, body: any, userId?: string, userName?: string) {
    const { PDFDocument, rgb, degrees, StandardFonts } = await this.lib();
    const fs = await import('fs');

    const rev = await this.prisma.scriptRevision.findUnique({ where: { id: revisionId } });
    if (!rev) throw new NotFoundException('Revision not found.');
    const srcPath = this.absPath(rev.pdfUrl);
    if (!fs.existsSync(srcPath)) throw new BadRequestException('Source script PDF not found on disk.');

    // Accessible annotations (IAM-filtered), then narrow to the chosen layers.
    const all = await this.annotations.listAnnotations(revisionId, userId);
    const layerIds: string[] = body?.layerIds || [];
    const annos = layerIds.length ? all.filter((a: any) => layerIds.includes(a.layerId)) : all;

    const out = await PDFDocument.load(fs.readFileSync(srcPath));
    const font = await out.embedFont(StandardFonts.Helvetica);
    const pages = out.getPages();

    for (const a of annos) {
      const pg = pages[(a.page || 1) - 1];
      if (!pg) continue;
      const { width: W, height: H } = pg.getSize();
      const x = a.x * W, w = a.w * W, hh = a.h * H;
      const yBottom = H * (1 - a.y - a.h);
      const [r, g, b] = this.hex((a.payload as any)?.color || (a.layer as any)?.color);
      if (a.tool === 'HIGHLIGHT') {
        pg.drawRectangle({ x, y: yBottom, width: w, height: hh, color: rgb(r, g, b), opacity: 0.35 });
      } else if (a.tool === 'PEN' && (a.payload as any)?.points) {
        const pts: number[][] = (a.payload as any).points;
        for (let i = 1; i < pts.length; i++) {
          const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
          pg.drawLine({ start: { x: x + ax * w, y: H - (a.y * H + ay * hh) }, end: { x: x + bx * w, y: H - (a.y * H + by * hh) }, thickness: 1.5, color: rgb(r, g, b) });
        }
      } else if (['TEXT', 'STICKY', 'TAG'].includes(a.tool)) {
        const text = (a.payload as any)?.text || '';
        pg.drawText(String(text).slice(0, 120), { x, y: H * (1 - a.y) - 9, size: a.tool === 'TAG' ? 8 : 9, font, color: rgb(r, g, b) });
      }
    }

    // Diagonal name watermark on every page.
    const mark = `${(userName || 'CREW').toUpperCase()}${userId ? ` · ${String(userId).slice(-4)}` : ''} · CONFIDENTIAL`;
    pages.forEach((pg: any) => {
      const { width: W, height: H } = pg.getSize();
      for (let gy = 80; gy < H; gy += 240) pg.drawText(mark, { x: 50, y: gy, size: 11, font, color: rgb(0.86, 0.86, 0.86), rotate: degrees(35), opacity: 0.5 });
    });

    const fn = `export-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.pdf`;
    fs.writeFileSync(this.absPath(`/uploads/${fn}`), await out.save());
    return { url: `/uploads/${fn}`, annotationCount: annos.length };
  }
}
