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

    // FDX gives tagged scenes/characters/dialogue directly (plus a generated, viewable PDF);
    // PDF goes through text extraction.
    const parsed = await this.extractAndParse(absPath);
    const pages = parsed.pages;

    const revision = await this.prisma.scriptRevision.create({
      data: {
        documentId,
        revisionLabel: body?.revisionLabel || 'Draft',
        colorCode: body?.colorCode || null,
        pdfUrl: parsed.viewPdfUrl || fileUrl,
        pageCount: pages.length,
        pageText: pages.map((text, i) => ({ page: i + 1, text })),
        uploadedById: userId || null,
      },
    });

    const scenes = parsed.scenes;
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
  /** P5 — public reuse: extract per-page text + parse scenes (used by the master library).
   *  For .fdx uploads a screenplay-formatted PDF is generated next to the file and returned
   *  as viewPdfUrl, so the viewer/annotations work on a real document. */
  async extractAndParse(absPath: string): Promise<{ pages: string[]; scenes: any[]; viewPdfUrl?: string }> {
    if (/\.fdx$/i.test(absPath)) {
      const r = await this.parseFdx(absPath);
      let viewPdfUrl: string | undefined;
      if (r.pdf) {
        const fs = await import('fs');
        const { join, basename } = await import('path');
        const name = `${basename(absPath).replace(/\.fdx$/i, '')}-view.pdf`;
        try { fs.writeFileSync(join(process.cwd(), 'uploads', name), r.pdf); viewPdfUrl = `/uploads/${name}`; } catch { /* keep raw url */ }
      }
      return { pages: r.pages, scenes: r.scenes, viewPdfUrl };
    }
    const { pages } = await this.extractPages(absPath);
    return { pages, scenes: this.parseScenes(pages) };
  }

  /** Parse a Final Draft (.fdx) XML file → { pages, scenes, pdf }. Tagged paragraphs give clean
   *  scene headings / character cues / dialogue, laid out with screenplay indents and paginated;
   *  the SAME pagination drives both pageText and a generated Courier PDF for the viewer. */
  private async parseFdx(absPath: string): Promise<{ pages: string[]; scenes: any[]; pdf?: Uint8Array }> {
    const fs = await import('fs');
    if (!fs.existsSync(absPath)) throw new BadRequestException('Uploaded file not found on disk.');
    const xml = fs.readFileSync(absPath, 'utf8');
    const decode = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();

    type Para = { type: string; text: string; num?: string };
    const paras: Para[] = [];
    for (const b of xml.matchAll(/<Paragraph\b([^>]*)>([\s\S]*?)<\/Paragraph>/g)) {
      const attrs = b[1] || ''; const inner = b[2] || '';
      const type = (attrs.match(/Type="([^"]*)"/)?.[1]) || 'Action';
      const text = [...inner.matchAll(/<Text\b[^>]*>([\s\S]*?)<\/Text>/g)].map((t) => decode(t[1])).join(' ').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      paras.push({ type, text, num: attrs.match(/Number="([^"]*)"/)?.[1] || inner.match(/Number="([^"]*)"/)?.[1] });
    }

    // Screenplay layout in characters (12pt Courier ≈ 10 chars/inch; body starts at 1.5")
    const LAYOUT: Record<string, { indent: number; width: number }> = {
      'Scene Heading': { indent: 0, width: 61 }, Action: { indent: 0, width: 61 },
      Character: { indent: 22, width: 38 }, Parenthetical: { indent: 16, width: 28 },
      Dialogue: { indent: 10, width: 35 }, Transition: { indent: 42, width: 19 },
    };
    const wrap = (text: string, width: number): string[] => {
      const out: string[] = []; let line = '';
      for (const w of text.split(' ')) {
        if (!line) line = w;
        else if (line.length + 1 + w.length <= width) line += ' ' + w;
        else { out.push(line); line = w; }
      }
      if (line) out.push(line);
      return out.length ? out : [''];
    };
    // No blank line inside a speech block (CHARACTER → (paren) → dialogue); blank between everything else.
    const tight = (prev: string | null, curT: string) =>
      (prev === 'Character' && (curT === 'Dialogue' || curT === 'Parenthetical')) ||
      (prev === 'Parenthetical' && curT === 'Dialogue');

    const LPP = 55;
    type Placed = { type: string; lines: string[] };
    const pdfPages: Placed[][] = []; const textPages: string[][] = [];
    let curPdf: Placed[] = []; let curText: string[] = []; let lineCount = 0; let prevType: string | null = null;
    const scenes: any[] = []; let seq = 0;
    const pushPage = () => { pdfPages.push(curPdf); textPages.push(curText); curPdf = []; curText = []; lineCount = 0; prevType = null; };

    for (const p of paras) {
      const lay = LAYOUT[p.type] || LAYOUT.Action;
      let text = p.text;
      if (p.type === 'Character' || p.type === 'Transition' || p.type === 'Scene Heading') text = text.toUpperCase();
      if (p.type === 'Parenthetical' && !/^\(/.test(text)) text = `(${text})`;
      const lines = wrap(text, lay.width).map((l) => ' '.repeat(lay.indent) + l);
      if (lineCount + (curPdf.length && !tight(prevType, p.type) ? 1 : 0) + lines.length > LPP && curPdf.length) pushPage();
      if (curPdf.length && !tight(prevType, p.type)) { curText.push(''); curPdf.push({ type: 'Gap', lines: [''] }); lineCount += 1; }
      const page = pdfPages.length + 1;
      if (p.type === 'Scene Heading') {
        seq += 1;
        const num = p.num || String(seq);
        const ie = p.text.match(/^(INT\.?\/EXT\.?|I\/E\.?|INT\.?|EXT\.?)/i);
        const dn = p.text.match(/\b(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|CONTINUOUS|LATER)\b/i);
        scenes.push({ sceneNumber: num, slugline: p.text, intExt: ie ? ie[1].toUpperCase().replace(/\./g, '').replace('I/E', 'INT/EXT') : null, dayNight: dn ? dn[1].toUpperCase() : null, pageStart: page, pageEnd: page, charStart: 0 });
      }
      curPdf.push({ type: p.type, lines });
      curText.push(...lines);
      lineCount += lines.length;
      prevType = p.type;
    }
    if (curPdf.length) pushPage();
    if (!textPages.length) { textPages.push(['']); pdfPages.push([]); }
    for (let i = 0; i < scenes.length; i++) scenes[i].pageEnd = i + 1 < scenes.length ? Math.max(scenes[i].pageStart, scenes[i + 1].pageStart) : textPages.length;

    const pdf = await this.renderScreenplayPdf(pdfPages).catch(() => undefined);
    return { pages: textPages.map((ls) => ls.join('\n')), scenes, pdf };
  }

  /** Render paginated screenplay paragraphs to a Courier PDF — the viewable document for .fdx uploads. */
  private async renderScreenplayPdf(pages: { type: string; lines: string[] }[][]): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    const courier = await doc.embedFont(StandardFonts.Courier);
    const bold = await doc.embedFont(StandardFonts.CourierBold);
    const size = 12; const lh = 12.5; const left = 108; const top = 792 - 66;
    for (let pi = 0; pi < pages.length; pi++) {
      const pg = doc.addPage([612, 792]);
      pg.drawText(`${pi + 1}.`, { x: 540, y: 792 - 42, size: 10, font: courier });
      let y = top;
      for (const para of pages[pi]) {
        const f = para.type === 'Scene Heading' ? bold : courier;
        for (const ln of para.lines) {
          if (ln.trim()) pg.drawText(ln.slice(0, 80), { x: left, y, size, font: f });
          y -= lh;
        }
      }
    }
    return doc.save();
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
