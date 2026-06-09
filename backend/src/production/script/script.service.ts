import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-13 · D1 — Digital Script & Document Hub (document spine).
 * Handles script documents + revisions; on upload extracts per-page text (pdf-parse) and parses
 * sluglines into ScriptScene rows (the outline + the FK target for later annotations / lining).
 */
@Injectable()
export class ScriptService {
  constructor(private prisma: PrismaService) {}

  // INT. / EXT. / INT/EXT slugline, with an optional leading scene number.
  private readonly SLUG_RE = /^\s*(\d+[A-Z]?\.?\s+)?(INT\.?\/EXT\.?|I\/E\.?|INT\.?|EXT\.?)\s+(.+)$/i;

  // ── Documents ────────────────────────────────────────────────────────────────
  list(projectId: string) {
    return this.prisma.scriptDocument.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { revisions: { orderBy: { createdAt: 'desc' }, select: { id: true, revisionLabel: true, colorCode: true, pageCount: true, createdAt: true } } },
    });
  }

  async createDocument(projectId: string, body: any, userId?: string) {
    if (!body?.title) throw new BadRequestException('A script title is required.');
    return this.prisma.scriptDocument.create({
      data: { projectId, title: body.title, kind: body.kind || 'SCRIPT', createdById: userId || null },
    });
  }

  async getDocument(id: string) {
    const doc = await this.prisma.scriptDocument.findUnique({
      where: { id },
      include: { revisions: { orderBy: { createdAt: 'desc' } } },
    });
    if (!doc) throw new NotFoundException('Script document not found.');
    return doc;
  }

  removeDocument(id: string) { return this.prisma.scriptDocument.delete({ where: { id } }); }

  // ── Revisions ─────────────────────────────────────────────────────────────────
  /** Ingest an uploaded PDF as a new revision: extract per-page text + parse scenes, set active. */
  async addRevision(documentId: string, fileUrl: string, absPath: string, body: any, userId?: string) {
    const doc = await this.prisma.scriptDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Script document not found.');

    const { pages } = await this.extractPages(absPath);

    const revision = await this.prisma.scriptRevision.create({
      data: {
        documentId,
        revisionLabel: body?.revisionLabel || 'Draft',
        colorCode: body?.colorCode || null,
        pdfUrl: fileUrl,
        pageCount: pages.length,
        pageText: pages.map((text, i) => ({ page: i + 1, text })),
        uploadedById: userId || null,
      },
    });

    // Parse sluglines → ScriptScene rows.
    const scenes = this.parseScenes(pages);
    if (scenes.length) {
      await this.prisma.scriptScene.createMany({
        data: scenes.map((s, i) => ({ revisionId: revision.id, projectId: doc.projectId, sortOrder: i, ...s })),
      });
    }

    await this.prisma.scriptDocument.update({ where: { id: documentId }, data: { activeRevisionId: revision.id } });
    return this.getRevision(revision.id);
  }

  async getRevision(id: string) {
    const rev = await this.prisma.scriptRevision.findUnique({
      where: { id },
      include: { scenes: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!rev) throw new NotFoundException('Revision not found.');
    return rev;
  }

  async setActiveRevision(documentId: string, revisionId: string) {
    const rev = await this.prisma.scriptRevision.findUnique({ where: { id: revisionId } });
    if (!rev || rev.documentId !== documentId) throw new BadRequestException('Revision does not belong to this document.');
    return this.prisma.scriptDocument.update({ where: { id: documentId }, data: { activeRevisionId: revisionId } });
  }

  removeRevision(id: string) { return this.prisma.scriptRevision.delete({ where: { id } }); }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  /** Per-page plain text via pdf-parse's pagerender hook. */
  private async extractPages(absPath: string): Promise<{ pages: string[] }> {
    const fs = await import('fs');
    if (!fs.existsSync(absPath)) throw new BadRequestException('Uploaded file not found on disk.');
    let pdfParse: any;
    try {
      const mod: any = await import('pdf-parse/lib/pdf-parse.js');
      pdfParse = mod.default || mod;
    } catch {
      try { const mod: any = await import('pdf-parse'); pdfParse = mod.default || mod; }
      catch { throw new BadRequestException('PDF support needs the "pdf-parse" package (already a dependency).'); }
    }
    const buf = fs.readFileSync(absPath);
    const pages: string[] = [];
    await pdfParse(buf, {
      pagerender: async (pageData: any) => {
        const tc = await pageData.getTextContent();
        // Join with newlines on Y-shifts so sluglines land at line starts.
        let lastY: number | null = null;
        let text = '';
        for (const item of tc.items) {
          const y = item.transform?.[5];
          if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2) text += '\n';
          text += item.str;
          lastY = y ?? lastY;
        }
        pages.push(text);
        return text;
      },
    });
    return { pages };
  }

  /** Find sluglines across pages → scenes with page ranges. */
  private parseScenes(pages: string[]) {
    type Raw = { sceneNumber: string | null; slugline: string; intExt: string; dayNight: string | null; pageStart: number; charStart: number };
    const raw: Raw[] = [];
    pages.forEach((pageText, idx) => {
      const lines = pageText.split('\n');
      let cursor = 0;
      for (const line of lines) {
        const m = line.match(this.SLUG_RE);
        if (m) {
          const intExt = m[2].toUpperCase().replace(/\./g, '').replace('I/E', 'INT/EXT');
          const rest = m[3].trim();
          const dn = rest.match(/\b(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|CONTINUOUS|LATER)\b/i);
          raw.push({
            sceneNumber: m[1] ? m[1].replace(/[.\s]/g, '') : null,
            slugline: `${intExt}. ${rest}`.trim(),
            intExt,
            dayNight: dn ? dn[1].toUpperCase() : null,
            pageStart: idx + 1,
            charStart: cursor,
          });
        }
        cursor += line.length + 1;
      }
    });
    // pageEnd = (next scene's start page) - 1, else last page
    return raw.map((s, i) => ({
      sceneNumber: s.sceneNumber,
      slugline: s.slugline,
      intExt: s.intExt,
      dayNight: s.dayNight,
      pageStart: s.pageStart,
      pageEnd: i + 1 < raw.length ? Math.max(s.pageStart, raw[i + 1].pageStart) : pages.length || s.pageStart,
      charStart: s.charStart,
    }));
  }
}
