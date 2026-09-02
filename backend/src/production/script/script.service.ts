import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-13 · D1 — Digital Script & Document Hub (document spine).
 * Handles script documents + revisions; on upload extracts per-page text (pdf-parse) and parses
 * sluglines into ScriptScene rows (the outline + the FK target for later annotations / lining).
 */
// WGA revision colour wheel (auto-advances on each new revision; round 1 = 'Double …')
import { nextRevisionColor } from './revision-wheel.util';
import { parseScenes as parseScenesUtil } from './scene-parse.util';
@Injectable()
export class ScriptService {
  constructor(private prisma: PrismaService) {}

  // ── Documents ────────────────────────────────────────────────────────────────
  list(projectId: string) {
    void this.purgeExpiredDocs();
    return this.prisma.scriptDocument.findMany({
      where: { projectId, deletedAt: null } as any,
      orderBy: { createdAt: 'desc' },
      include: { revisions: { orderBy: { createdAt: 'desc' }, select: { id: true, revisionLabel: true, colorCode: true, pageCount: true, createdAt: true } } },
    });
  }
  async purgeExpiredDocs() {
    const cutoff = new Date(Date.now() - 30 * 86400000);
    await (this.prisma as any).scriptDocument.deleteMany({ where: { deletedAt: { lt: cutoff } } }).catch(() => {});
  }
  binList(projectId: string) {
    return (this.prisma as any).scriptDocument.findMany({ where: { projectId, deletedAt: { not: null } }, orderBy: { deletedAt: 'desc' }, include: { revisions: { orderBy: { createdAt: 'desc' }, select: { id: true, revisionLabel: true, colorCode: true, pageCount: true, createdAt: true } } } }).catch(() => []);
  }
  async trashDocument(id: string) { await (this.prisma as any).scriptDocument.update({ where: { id }, data: { deletedAt: new Date() } }).catch(() => {}); return { ok: true }; }
  async restoreDocument(id: string) { await (this.prisma as any).scriptDocument.update({ where: { id }, data: { deletedAt: null } }).catch(() => {}); return { ok: true }; }

  async createDocument(projectId: string, body: any, userId?: string) {
    if (!body?.title) throw new BadRequestException('A script title is required.');
    return this.prisma.scriptDocument.create({
      data: { projectId, title: body.title, kind: body.kind || 'SCRIPT', createdById: userId || null },
    });
  }

  /**
   * The document plus its full draft history — METADATA ONLY on the revisions.
   *
   * This used to `include` whole revisions, which meant every caller pulled every draft's complete
   * `pageText` (the entire screenplay, as JSON) on every load. Eight 103-page drafts is megabytes on
   * the wire to render a list nobody had built yet. No caller reads page text from here — the reader
   * and the drafts panel both fetch it per-revision through `getRevision` — so the payload is scoped
   * to exactly the fields a draft list needs. Add a field here rather than dropping the select.
   */
  async getDocument(id: string) {
    const doc = await this.prisma.scriptDocument.findUnique({
      where: { id },
      include: {
        revisions: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, revisionLabel: true, colorCode: true, revisionColor: true, revisionRound: true,
            revisionDate: true, pageCount: true, changeSummary: true, supersedesId: true,
            isLocked: true, lockedAt: true, pdfUrl: true, uploadedById: true, createdAt: true,
          },
        },
      },
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
    // P3 — production-standard revision metadata: auto-advance the colour wheel, link the
    // superseded revision, mark changed scenes (asterisks), and A-page new scenes if prior was locked.
    try {
      const px: any = this.prisma as any;
      const prior: any = await px.scriptRevision.findFirst({ where: { documentId, id: { not: revision.id } }, orderBy: { createdAt: 'desc' } });
      const col = nextRevisionColor(prior?.revisionColor ?? null, prior?.revisionRound || 0);
      const round = col.round;
      await px.scriptRevision.update({ where: { id: revision.id }, data: { revisionColor: col.key, colorCode: body?.colorCode || col.hex, revisionRound: round, revisionDate: new Date(), supersedesId: prior?.id || null } });
      if (prior) {
        const priorScenes: any[] = await this.prisma.scriptScene.findMany({ where: { revisionId: prior.id }, select: { sceneNumber: true, slugline: true } });
        const priorMap = new Map(priorScenes.map((s) => [String(s.sceneNumber || '').toUpperCase(), s.slugline || '']));
        const newScenes: any[] = await this.prisma.scriptScene.findMany({ where: { revisionId: revision.id }, select: { id: true, sceneNumber: true, slugline: true, pageStart: true } });
        const locked = !!prior.isLocked; const aCount: Record<number, number> = {};
        for (const sc of newScenes) {
          const key = String(sc.sceneNumber || '').toUpperCase();
          const had = priorMap.has(key);
          const data: any = {};
          if (!had || priorMap.get(key) !== (sc.slugline || '')) data.revisionMark = true;
          if (locked && !had) { const pg = Number(sc.pageStart) || 0; const n = (aCount[pg] = (aCount[pg] || 0) + 1); data.pageLabel = `${pg}${String.fromCharCode(64 + n)}`; }
          if (Object.keys(data).length) await px.scriptScene.update({ where: { id: sc.id }, data }).catch(() => {});
        }
      }
    } catch { /* pre-db:push — colour/marks unavailable until pushed */ }
    return this.getRevision(revision.id);
  }

  async getRevision(id: string) {
    const rev = await this.prisma.scriptRevision.findUnique({
      where: { id },
      include: { scenes: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!rev) throw new NotFoundException('Revision not found.');
    return (await this.upgradeFdxView(rev)) || rev;
  }

  /** Self-heal revisions uploaded before FDX→PDF conversion existed: generate the
   *  viewable screenplay PDF from the original .fdx on first open and persist it. */
  private async upgradeFdxView(rev: any): Promise<any | null> {
    if (!rev?.pdfUrl || !/\.fdx$/i.test(rev.pdfUrl)) return null;
    try {
      const fs = await import('fs');
      const { join, basename } = await import('path');
      const abs = join(process.cwd(), 'uploads', basename(rev.pdfUrl));
      if (!fs.existsSync(abs)) return null; // original gone — keep the placeholder
      const parsed = await this.extractAndParse(abs);
      if (!parsed.viewPdfUrl) return null;
      await this.prisma.scriptRevision.update({ where: { id: rev.id }, data: { pdfUrl: parsed.viewPdfUrl } });
      return { ...rev, pdfUrl: parsed.viewPdfUrl };
    } catch { return null; }
  }

  async setActiveRevision(documentId: string, revisionId: string) {
    const rev = await this.prisma.scriptRevision.findUnique({ where: { id: revisionId } });
    if (!rev || rev.documentId !== documentId) throw new BadRequestException('Revision does not belong to this document.');
    return this.prisma.scriptDocument.update({ where: { id: documentId }, data: { activeRevisionId: revisionId } });
  }

  removeRevision(id: string) { return this.prisma.scriptRevision.delete({ where: { id } }); }

  /** P3 — lock the revision for production: freeze page numbering by stamping each scene's
   *  pageLabel from its current page, so later revisions create A-pages instead of renumbering. */
  async lockRevision(revisionId: string, lock = true) {
    const px: any = this.prisma as any;
    const rev: any = await this.prisma.scriptRevision.findUnique({ where: { id: revisionId } }).catch(() => null);
    if (!rev) throw new NotFoundException('Revision not found.');
    await px.scriptRevision.update({ where: { id: revisionId }, data: { isLocked: lock, lockedAt: lock ? new Date() : null } });
    let frozen = 0;
    if (lock) {
      const scenes = await this.prisma.scriptScene.findMany({ where: { revisionId }, select: { id: true, pageStart: true } }).catch(() => [] as any[]);
      for (const sc of scenes) { await px.scriptScene.update({ where: { id: sc.id }, data: { pageLabel: String((sc as any).pageStart || '') } }).catch(() => {}); frozen++; }
    }
    return { ok: true, locked: lock, frozen };
  }

  // ── P0 script-spine: single-source projection status + revision metadata ──────
  /** Read-only drift snapshot — how downstream modules line up with the active revision.
   *  Tolerant of pre-db:push (new columns/filters degrade to 0 rather than throwing). */
  async projectionStatus(projectId: string) {
    const docs = await this.prisma.scriptDocument.findMany({ where: { projectId }, include: { revisions: { orderBy: { createdAt: 'desc' } } } }).catch(() => [] as any[]);
    if (!docs.length) return { hasScript: false };
    const doc: any = docs.find((d: any) => d.activeRevisionId) || docs[0];
    const revs: any[] = doc.revisions || [];
    const rev: any = revs.find((r: any) => r.id === doc.activeRevisionId) || revs[0] || null;
    const revId = rev?.id;
    const scenes = revId ? await this.prisma.scriptScene.findMany({ where: { revisionId: revId }, select: { id: true, sceneNumber: true, productionStripId: true } }).catch(() => [] as any[]) : [];
    const strips = await this.prisma.productionStrip.findMany({ where: { projectId, isBanner: false }, select: { id: true } }).catch(() => [] as any[]);
    const stripIds = new Set(strips.map((s: any) => s.id));
    const linked = scenes.filter((sc: any) => sc.productionStripId && stripIds.has(sc.productionStripId)).length;
    const brokenDown = await (this.prisma as any).scriptScene.count({ where: { revisionId: revId, brokenDownAt: { not: null } } }).catch(() => 0);
    const changed = await (this.prisma as any).scriptScene.count({ where: { revisionId: revId, revisionMark: true } }).catch(() => 0);
    const elementsOnScenes = await (this.prisma as any).breakdownElement.count({ where: { projectId, sceneId: { not: null } } }).catch(() => 0);
    const elementsTotal = await this.prisma.breakdownElement.count({ where: { projectId } }).catch(() => 0);
    const budgetMapped = await this.prisma.breakdownElement.count({ where: { projectId, costCenterCode: { not: null } } }).catch(() => 0);
    const castingCalls = await this.prisma.castingCall.count({ where: { projectId, breakdownElementId: { not: null } } }).catch(() => 0);

    const st = (synced: boolean, none: boolean) => none ? 'none' : synced ? 'synced' : 'drift';
    const modules = [
      { key: 'scenes', label: 'Scenes parsed', count: scenes.length, status: st(scenes.length > 0, scenes.length === 0) },
      { key: 'breakdown', label: 'Breakdown tagged', count: brokenDown, of: scenes.length, status: st(scenes.length > 0 && brokenDown >= scenes.length, brokenDown === 0) },
      { key: 'strips', label: 'Strips linked', count: linked, of: scenes.length, status: st(scenes.length > 0 && linked >= scenes.length, scenes.length === 0 && linked === 0) },
      { key: 'budget', label: 'Budget-mapped elements', count: budgetMapped, of: elementsTotal, status: st(elementsTotal > 0 && budgetMapped >= elementsTotal, budgetMapped === 0) },
      { key: 'casting', label: 'Casting calls from breakdown', count: castingCalls, status: st(castingCalls > 0, castingCalls === 0) },
    ];
    return {
      hasScript: true,
      document: { id: doc.id, title: doc.title },
      revision: rev ? { id: rev.id, label: rev.revisionLabel, color: (rev as any).revisionColor || null, colorCode: rev.colorCode || null, isLocked: !!(rev as any).isLocked, round: (rev as any).revisionRound || 0, pageCount: rev.pageCount } : null,
      revisions: revs.map((r: any) => ({ id: r.id, label: r.revisionLabel, color: (r as any).revisionColor || null, isLocked: !!(r as any).isLocked, active: r.id === doc.activeRevisionId, createdAt: r.createdAt })),
      counts: { scenes: scenes.length, strips: strips.length, linked, unlinked: Math.max(0, scenes.length - linked), brokenDown, changed, elementsOnScenes, elementsTotal, budgetMapped, castingCalls },
      modules,
    };
  }

  /** Set production-standard revision metadata (colour wheel / lock). Writes only new fields. */
  async setRevisionMeta(revisionId: string, body: { revisionColor?: string; revisionRound?: number; isLocked?: boolean }) {
    const data: any = {};
    if (body?.revisionColor !== undefined) data.revisionColor = body.revisionColor || null;
    if (body?.revisionRound !== undefined) data.revisionRound = Number(body.revisionRound) || 0;
    if (body?.isLocked !== undefined) { data.isLocked = !!body.isLocked; data.lockedAt = body.isLocked ? new Date() : null; }
    return (this.prisma as any).scriptRevision.update({ where: { id: revisionId }, data });
  }


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

  /** Find sluglines across pages → scenes with page ranges (English + Arabic). */
  private parseScenes(pages: string[]) {
    return parseScenesUtil(pages);
  }
}
