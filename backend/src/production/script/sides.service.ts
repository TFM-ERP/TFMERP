import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { join, basename } from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-13 · D5 — Automated Sides.
 * From a list of selected scenes: keep only their pages, cross out the non-scheduled scenes on
 * kept pages (faded box + diagonal), inject "Continues" when a scene splits a page, impose 2-up,
 * and stamp a per-recipient diagonal watermark for leak-tracing. Output PDFs land in /uploads.
 * Uses pdf-lib (dynamically imported so the build never breaks if it isn't installed yet).
 */
@Injectable()
export class SidesService {
  constructor(private prisma: PrismaService) {}

  private async lib() {
    const mod: any = await import('pdf-lib').catch(() => null);
    if (!mod) throw new BadRequestException('Sides generation needs the "pdf-lib" package. Run: npm install pdf-lib (in backend/).');
    return mod;
  }
  private absPath(url: string) { return join(process.cwd(), 'uploads', basename(url)); }
  private outName() { return `sides-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`; }

  list(projectId: string) { return this.prisma.sidesJob.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }); }
  remove(id: string) { return this.prisma.sidesJob.delete({ where: { id } }); }

  /** Build the sides for a revision's selected scenes + per-recipient watermarked copies. */
  async generate(revisionId: string, body: any, userId?: string) {
    const { PDFDocument, rgb, degrees, StandardFonts } = await this.lib();
    const fs = await import('fs');

    const rev = await this.prisma.scriptRevision.findUnique({ where: { id: revisionId }, include: { scenes: { orderBy: { sortOrder: 'asc' } } } });
    if (!rev) throw new NotFoundException('Revision not found.');
    const doc = await this.prisma.scriptDocument.findUnique({ where: { id: rev.documentId }, select: { projectId: true, title: true } });
    const srcPath = this.absPath(rev.pdfUrl);
    if (!fs.existsSync(srcPath)) throw new BadRequestException('Source script PDF not found on disk.');

    const selected: string[] = (body?.scenes || []).map((s: any) => String(s));
    if (!selected.length) throw new BadRequestException('Select at least one scene.');
    const selSet = new Set(selected);
    const pageText: { page: number; text: string }[] = (rev.pageText as any[]) || [];

    // Pages that contain a selected scene.
    const scenes = rev.scenes;
    const keep = new Set<number>();
    for (const s of scenes) if (selSet.has(String(s.sceneNumber))) for (let p = s.pageStart; p <= s.pageEnd; p++) keep.add(p);
    if (!keep.size) throw new BadRequestException('Selected scenes have no pages.');
    const keepPages = Array.from(keep).sort((a, b) => a - b);

    // 1) Pruned doc with cross-outs + "Continues".
    const srcBytes = fs.readFileSync(srcPath);
    const src = await PDFDocument.load(srcBytes);
    const pruned = await PDFDocument.create();
    const font = await pruned.embedFont(StandardFonts.Helvetica);
    const copied = await pruned.copyPages(src, keepPages.map((p) => p - 1));
    copied.forEach((pg: any, idx: number) => {
      pruned.addPage(pg);
      const pageNum = keepPages[idx];
      const { width: W, height: H } = pg.getSize();
      const len = (pageText.find((t) => t.page === pageNum)?.text || '').length || 1;

      // Scenes touching this page, ordered by their start position on the page.
      const onPage = scenes.filter((s) => s.pageStart <= pageNum && s.pageEnd >= pageNum);
      const segs = onPage.map((s) => ({ s, startFrac: s.pageStart === pageNum && s.charStart != null ? Math.min(0.98, (s.charStart || 0) / len) : 0 }))
        .sort((a, b) => a.startFrac - b.startFrac);
      segs.forEach((seg, i) => {
        const endFrac = i + 1 < segs.length ? segs[i + 1].startFrac : 1;
        if (!selSet.has(String(seg.s.sceneNumber))) {
          const yTop = H * (1 - seg.startFrac), bandH = H * (endFrac - seg.startFrac);
          pg.drawRectangle({ x: 0, y: yTop - bandH, width: W, height: bandH, color: rgb(1, 1, 1), opacity: 0.7 });
          pg.drawLine({ start: { x: 6, y: yTop - bandH + 4 }, end: { x: W - 6, y: yTop - 4 }, thickness: 1, color: rgb(0.6, 0.6, 0.6) });
        }
      });
      // "Continues" footer when a kept selected scene runs onto the next page.
      const splits = onPage.some((s) => selSet.has(String(s.sceneNumber)) && s.pageEnd > pageNum);
      if (splits) pg.drawText(`— Continues on page ${pageNum + 1} —`, { x: W / 2 - 70, y: 14, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
    });

    // 2) 2-up imposition (two pruned pages stacked on one portrait sheet).
    const prunedBytes = await pruned.save();
    const twoUp = await PDFDocument.create();
    const embed = await twoUp.embedPdf(prunedBytes, keepPages.map((_, i) => i));
    const SHEET_W = 595, SHEET_H = 842; // A4 portrait
    for (let i = 0; i < embed.length; i += 2) {
      const sheet = twoUp.addPage([SHEET_W, SHEET_H]);
      for (let j = 0; j < 2 && i + j < embed.length; j++) {
        const ep = embed[i + j];
        const scale = Math.min((SHEET_W - 40) / ep.width, (SHEET_H / 2 - 30) / ep.height);
        const w = ep.width * scale, h = ep.height * scale;
        const x = (SHEET_W - w) / 2;
        const y = j === 0 ? SHEET_H / 2 + (SHEET_H / 2 - h) / 2 : (SHEET_H / 2 - h) / 2;
        sheet.drawPage(ep, { x, y, width: w, height: h });
      }
    }
    const baseBytes = await twoUp.save();
    const baseName = this.outName();
    fs.writeFileSync(this.absPath(`/uploads/${baseName}`), baseBytes);

    // 3) Per-recipient watermark.
    const dateStr = (body?.shootDate ? new Date(body.shootDate) : new Date()).toLocaleDateString('en-GB');
    const recipientsIn: any[] = body?.recipients?.length ? body.recipients : [{ name: 'CREW', email: null }];
    const recipients: any[] = [];
    for (const r of recipientsIn) {
      const mark = `CONFIDENTIAL · ${(r.name || 'CREW').toUpperCase()}${r.crewId ? ` (${String(r.crewId).slice(-4)})` : ''} · ${doc?.title || ''} · ${dateStr}`;
      const wm = await PDFDocument.load(baseBytes);
      const wmFont = await wm.embedFont(StandardFonts.Helvetica);
      wm.getPages().forEach((pg: any) => {
        const { width: W, height: H } = pg.getSize();
        for (let gy = 60; gy < H; gy += 200) {
          pg.drawText(mark, { x: 40, y: gy, size: 12, font: wmFont, color: rgb(0.85, 0.85, 0.85), rotate: degrees(35), opacity: 0.5 });
        }
      });
      const fn = this.outName();
      fs.writeFileSync(this.absPath(`/uploads/${fn}`), await wm.save());
      recipients.push({ name: r.name || 'Crew', email: r.email || null, crewId: r.crewId || null, outputUrl: `/uploads/${fn}` });
    }

    return this.prisma.sidesJob.create({
      data: {
        projectId: doc?.projectId || '', documentId: rev.documentId, revisionId,
        shootDate: body?.shootDate ? new Date(body.shootDate) : null,
        scenes: selected, recipients, baseUrl: `/uploads/${baseName}`, pageCount: twoUp.getPageCount(),
        createdById: userId || null,
      },
    });
  }
}
