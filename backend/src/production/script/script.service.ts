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
  /** Ingest an uploaded PDF or Final Draft (.fdx) as a new revision: extract text + scenes, set active. */
  async addRevision(documentId: string, fileUrl: string, absPath: string, body: any, userId?: string) {
    const doc = await this.prisma.scriptDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Script document not found.');

    // FDX gives tagged scenes/characters/dialogue directly; PDF goes through text extraction.
    const parsed = /\.fdx$/i.test(absPath) ? await this.parseFdx(absPath) : { pages: (await this.extractPages(absPath)).pages, scenes: null as any };
    const pages = parsed.pages;

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

    // FDX scenes are parsed from tags; PDF scenes from sluglines.
    const scenes = parsed.scenes || this.parseScenes(pages);
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
  /** P5 — public reuse: extract per-page text + parse scenes (used by the master library). */
  async extractAndParse(absPath: string) {
    if (/\.fdx$/i.test(absPath)) return this.parseFdx(absPath);
    const { pages } = await this.extractPages(absPath);
    return { pages, scenes: this.parseScenes(pages) };
  }

  /** Parse a Final Draft (.fdx) XML file → { pages: string[], scenes }. Tagged paragraphs give
   *  clean scene headings / character cues / dialogue (no PDF text-extraction guesswork). */
  private async parseFdx(absPath: string): Promise<{ pages: string[]; scenes: any[] }> {
    const fs = await import('fs');
    if (!fs.existsSync(absPath)) throw new BadRequestException('Uploaded file not found on disk.');
    const xml = fs.readFileSync(absPath, 'utf8');
    const decode = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();
    const LPP = 55; // approx screenplay lines per page
    const pages: string[] = []; let cur: string[] = []; let lineCount = 0; const scenes: any[] = []; let seq = 0;
    const pushPage = () => { pages.push(cur.join('\n')); cur = []; lineCount = 0; };
    const blocks = [...xml.matchAll(/<Paragraph\b([^>]*)>([\s\S]*?)<\/Paragraph>/g)];
    for (const b of blocks) {
      const attrs = b[1] || ''; const inner = b[2] || '';
      const type = (attrs.match(/Type="([^"]*)"/)?.[1]) || 'Action';
      const text = [...inner.matchAll(/<Text\b[^>]*>([\s\S]*?)<\/Text>/g)].map((t) => decode(t[1])).join(' ').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const est = type === 'Action' ? Math.max(1, Math.ceil(text.length / 61)) : type === 'Dialogue' ? Math.max(1, Math.ceil(text.length / 35)) : type === 'Scene Heading' ? 2 : 1;
      if (lineCount + est > LPP && cur.length) pushPage();
      const page = pages.length + 1;
      if (type === 'Scene Heading') {
        seq += 1;
        const num = attrs.match(/Number="([^"]*)"/)?.[1] || inner.match(/Number="([^"]*)"/)?.[1] || String(seq);
        const ie = text.match(/^(INT\.?\/EXT\.?|I\/E\.?|INT\.?|EXT\.?)/i);
        const dn = text.match(/\b(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|CONTINUOUS|LATER)\b/i);
        scenes.push({ sceneNumber: num, slugline: text, intExt: ie ? ie[1].toUpperCase().replace(/\./g, '').replace('I/E', 'INT/EXT') : null, dayNight: dn ? dn[1].toUpperCase() : null, pageStart: page, pageEnd: page, charStart: 0 });
        cur.push(text);
      } else if (type === 'Character') { cur.push(text.toUpperCase()); }
      else if (type === 'Parenthetical') { cur.push(/^\(/.test(text) ? text : `(${text})`); }
      else if (type === 'Transition') { cur.push(text.toUpperCase()); }
      else { cur.push(text); }
      lineCount += est;
    }
    if (cur.length) pushPage();
    if (!pages.length) pages.push('');
    for (let i = 0; i < scenes.length; i++) scenes[i].pageEnd = i + 1 < scenes.length ? Math.max(scenes[i].pageStart, scenes[i + 1].pageStart) : pages.length;
    return { pages, scenes };
  }

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
