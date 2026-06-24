import { Injectable, BadRequestException } from '@nestjs/common';
import { estimateEighthsPages } from '../pages.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { BreakdownService } from './breakdown.service';
import { ScriptService } from '../script/script.service';
import { ScriptProjectionService } from './script-projection.service';
import { join, basename, extname } from 'path';
import { readFile } from 'fs/promises';

// Categories the AI may assign (must match BreakdownCategory enum; CAST handled separately via cues)
const AI_CATEGORIES = [
  'BACKGROUND', 'STUNTS', 'VEHICLES', 'ANIMALS', 'ANIMAL_WRANGLER', 'PROPS', 'SET_DRESSING', 'WARDROBE',
  'MAKEUP_HAIR', 'SFX', 'MECHANICAL_FX', 'VFX', 'SPECIAL_EQUIPMENT', 'CAMERA', 'ADDITIONAL_LABOR',
  'SOUND_MUSIC', 'ART', 'GREENERY', 'SECURITY', 'OTHER',
];
const CATEGORY_SET = new Set(['CAST', ...AI_CATEGORIES]);

interface ParsedScene {
  sceneNumber?: string;
  intExt: 'INT' | 'EXT' | 'INT_EXT';
  dayNight: 'DAY' | 'NIGHT' | 'DUSK' | 'DAWN';
  setName: string;
  heading: string;
  body: string;
  cast: string[];
  pages: number; // in pages, e.g. 1.125
}

@Injectable()
export class ScriptImportService {
  constructor(
    private prisma: PrismaService,
    private scheduling: SchedulingService,
    private breakdown: BreakdownService,
    private script: ScriptService,
    private projection: ScriptProjectionService,
    private ai: AiService,
  ) {}

  /**
   * One-click: import the script, auto-schedule scenes (→ DOOD), and generate budget lines.
   * Pass `skipBudget: true` to stop BEFORE the budget step so the user can review/adjust the
   * breakdown→account mapping in the drag-and-drop UI, then call applyMapping() to create lines.
   */
  async fullSetup(projectId: string, body: { fileUrl: string; originalName?: string; pagesPerDay?: number; rateCard?: Record<string, number>; skipBudget?: boolean }) {
    const importRes = await this.importScript(projectId, { fileUrl: body.fileUrl, originalName: body.originalName, replace: true });
    let schedule: any = { scheduled: 0, days: 0 };
    try { schedule = await this.scheduling.autoSchedule(projectId, { pagesPerDay: body.pagesPerDay || 5, onlyUnscheduled: true }); } catch (e: any) { schedule.error = e?.message || 'schedule failed'; }

    if (body.skipBudget) {
      // Hand control to the visual mapping step instead of auto-generating the budget.
      return { import: importRes, schedule, budget: null, needsMapping: true };
    }
    let budget: any = { created: 0, unmapped: [], grandTotal: 0 };
    try { budget = await this.breakdown.budgetFromBreakdown(projectId, body.rateCard || {}); } catch (e: any) { budget.error = e?.message || 'budget failed'; }
    return { import: importRes, schedule, budget, needsMapping: false };
  }

  /** P3 — unified ingest: Script-hub revision (canonical parser) → AI breakdown on its
   *  scenes → project to strips. This is the single pipeline; System-A's own parser is retired. */
  async importViaHub(projectId: string, body: { fileUrl: string; originalName?: string; revisionLabel?: string }) {
    if (!body?.fileUrl) throw new BadRequestException('No file provided.');
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId } });
    if (!project) throw new BadRequestException('Project not found.');
    let doc: any = await this.prisma.scriptDocument.findFirst({ where: { projectId }, orderBy: { createdAt: 'asc' } });
    if (!doc) doc = await this.script.createDocument(projectId, { title: (body.originalName || 'Main Script').replace(/\.[^.]+$/, '') });
    const fileName = basename(body.fileUrl);
    const absPath = join(process.cwd(), 'uploads', fileName);
    const ext = extname(fileName).replace('.', '').toUpperCase();
    const revision: any = await this.script.addRevision(doc.id, body.fileUrl, absPath, { revisionLabel: body.revisionLabel });
    let breakdown: any = {};
    try { breakdown = await this.breakdownRevision(revision.id, { force: true }); } catch (e: any) { breakdown = { error: e?.message || 'breakdown failed' }; }
    let projection: any = {};
    try { projection = await this.projection.apply(projectId, {}); } catch (e: any) { projection = { error: e?.message || 'projection failed' }; }
    const strips = (projection.created || 0) + (projection.updated || 0) + (projection.adopted || 0);
    return { revisionId: revision.id, documentId: doc.id, scenes: (revision.scenes || []).length, elements: breakdown.elements || 0, strips, format: ext, viaHub: true, breakdown, projection };
  }

  /** Legacy entry point — now routes through the unified hub pipeline (single parser). */
  async importScript(projectId: string, body: { fileUrl: string; originalName?: string; replace?: boolean }) {
    return this.importViaHub(projectId, { fileUrl: body.fileUrl, originalName: body.originalName });
  }

  // ── Text extraction by format ──────────────────────────────────────────────────
  private async extractText(filePath: string, ext: string): Promise<{ text: string; fdxParagraphs?: { type: string; text: string }[] }> {
    if (ext === '.fdx') {
      const xml = await readFile(filePath, 'utf8');
      const paras: { type: string; text: string }[] = [];
      const re = /<Paragraph\b([^>]*)>([\s\S]*?)<\/Paragraph>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(xml))) {
        const typeMatch = /Type="([^"]+)"/.exec(m[1]);
        const type = typeMatch ? typeMatch[1] : 'Action';
        const texts = [...m[2].matchAll(/<Text[^>]*>([\s\S]*?)<\/Text>/g)].map((t) => t[1]);
        const text = texts.join('').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).trim();
        if (text) paras.push({ type, text });
      }
      const text = paras.map((p) => p.text).join('\n');
      return { text, fdxParagraphs: paras };
    }
    if (ext === '.docx') {
      let mammoth: any;
      try { mammoth = await import('mammoth'); } catch { throw new BadRequestException('DOCX support needs the "mammoth" package. Run: npm install mammoth'); }
      const res = await mammoth.extractRawText({ path: filePath });
      return { text: res.value || '' };
    }
    if (ext === '.pdf') {
      let pdfParse: any;
      try {
        // import the lib directly to avoid pdf-parse's index.js debug-mode file read
        const mod: any = await import('pdf-parse/lib/pdf-parse.js');
        pdfParse = mod.default || mod;
      } catch {
        try { const mod: any = await import('pdf-parse'); pdfParse = mod.default || mod; }
        catch { throw new BadRequestException('PDF support needs the "pdf-parse" package. Run: npm install pdf-parse'); }
      }
      const buf = await readFile(filePath);
      const res = await pdfParse(buf).catch(() => ({ text: '' }));
      const ptext = String(res?.text || '');
      if (ptext.replace(/\s/g, '').length >= 40) return { text: ptext };
      return { text: await this.ocrPdf(buf) };
    }
    if (ext === '.txt' || ext === '.fountain') {
      return { text: await readFile(filePath, 'utf8') };
    }
    if (['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.bmp'].includes(ext)) {
      return { text: await this.ocrImage(await readFile(filePath)) };
    }
    throw new BadRequestException(`Unsupported file type "${ext}". Use .fdx, .pdf (incl. scanned), .docx, .txt, .fountain, or an image (.png/.jpg).`);
  }

  // ── Scene-heading parsing ──────────────────────────────────────────────────────
  /** OCR an image buffer (English + Arabic) via tesseract.js. Tolerant: clear message if the dep is absent. */
  private async ocrImage(buf: Buffer): Promise<string> {
    const ts = "tesseract.js";
    let T: any;
    try { T = await import(ts); } catch { throw new BadRequestException('OCR needs the "tesseract.js" package. Run: npm install tesseract.js'); }
    try { const out: any = await T.recognize(buf, 'eng+ara'); return String(out?.data?.text || ''); }
    catch (e: any) { throw new BadRequestException('OCR failed: ' + String(e?.message || e).slice(0, 160)); }
  }

  /** OCR a scanned/image-only PDF by rasterising pages (pdfjs-dist + canvas) then tesseract.js.
   *  Optional deps — degrades to a clear message so nothing breaks if they are not installed. */
  private async ocrPdf(buf: Buffer): Promise<string> {
    const p1 = "pdfjs-dist/legacy/build/pdf.mjs", p2 = "pdfjs-dist", cv = "canvas", ts = "tesseract.js";
    let pdfjs: any, canvasMod: any, T: any;
    try {
      try { pdfjs = await import(p1); } catch { pdfjs = await import(p2); }
      canvasMod = await import(cv);
      T = await import(ts);
    } catch {
      throw new BadRequestException('This PDF looks scanned/image-only. Install the OCR add-ons (npm install tesseract.js pdfjs-dist canvas) or upload the pages as images (.png/.jpg).');
    }
    try {
      const lib: any = pdfjs?.getDocument ? pdfjs : (pdfjs?.default || pdfjs);
      const createCanvas: any = canvasMod.createCanvas || (canvasMod.default && canvasMod.default.createCanvas);
      const doc: any = await lib.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false }).promise;
      const pages = Math.min(doc.numPages || 0, 30);
      let out = '';
      for (let i = 1; i <= pages; i++) {
        const page: any = await doc.getPage(i);
        const vp: any = page.getViewport({ scale: 2 });
        const canvas: any = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
        const ctx: any = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const png: any = canvas.toBuffer('image/png');
        const r: any = await T.recognize(png, 'eng+ara');
        out += String(r?.data?.text || '') + '\n';
      }
      return out.trim();
    } catch (e: any) {
      throw new BadRequestException('Scanned-PDF OCR failed: ' + String(e?.message || e).slice(0, 160) + '. You can upload the pages as images instead.');
    }
  }

  private parseHeading(line: string) {
    const raw = line.trim().replace(/^\d+[A-Z]?\s+/, ''); // strip leading scene numbers
    const up = raw.toUpperCase();
    let intExt: ParsedScene['intExt'] = 'INT';
    if (/^(INT\.?\/EXT|EXT\.?\/INT|I\/E)\b/.test(up)) intExt = 'INT_EXT';
    else if (/^EXT\b/.test(up)) intExt = 'EXT';
    else if (/^INT\b/.test(up)) intExt = 'INT';
    let dayNight: ParsedScene['dayNight'] = 'DAY';
    if (/\bNIGHT\b/.test(up)) dayNight = 'NIGHT';
    else if (/\bDUSK\b|\bSUNSET\b/.test(up)) dayNight = 'DUSK';
    else if (/\bDAWN\b|\bSUNRISE\b/.test(up)) dayNight = 'DAWN';
    // set name = between the INT/EXT prefix and the trailing - DAY/NIGHT
    let setName = raw.replace(/^(INT\.?\/EXT|EXT\.?\/INT|I\/E|INT|EXT)\.?\s*/i, '');
    setName = setName.replace(/\s*[-–—]\s*(DAY|NIGHT|DUSK|DAWN|CONTINUOUS|LATER|MORNING|EVENING|AFTERNOON|SUNSET|SUNRISE).*$/i, '').trim();
    return { intExt, dayNight, setName: setName || raw };
  }

  private isHeading(line: string): boolean {
    return /^(\d+[A-Z]?\s+)?(INT|EXT|INT\.?\/EXT|EXT\.?\/INT|I\/E)[\.\s]/i.test(line.trim());
  }

  private extractCast(body: string): string[] {
    const lines = body.split('\n');
    const cast = new Set<string>();
    const skip = /^(CUT TO|FADE|DISSOLVE|SMASH|MATCH CUT|CONTINUED|THE END|INTERCUT|MONTAGE|SERIES OF|TITLE|SUPER|OMITTED|BACK TO)/i;
    for (let i = 0; i < lines.length; i++) {
      let l = lines[i].trim();
      if (!l) continue;
      l = l.replace(/\s*\(.*\)$/, ''); // strip (CONT'D), (O.S.), (V.O.)
      if (l.length < 2 || l.length > 34) continue;
      if (skip.test(l)) continue;
      if (this.isHeading(l)) continue;
      // fully uppercase cue, letters present, followed by a non-empty (dialogue) line
      if (/^[A-Z][A-Z0-9 .,'\-/&]+$/.test(l) && /[A-Z]/.test(l)) {
        const next = (lines[i + 1] || '').trim();
        if (next && !this.isHeading(next)) cast.add(l.replace(/[.,]+$/, '').trim());
      }
    }
    return [...cast];
  }

  private estimatePages(body: string): number { return estimateEighthsPages(body); }

  private splitScenes(text: string, fdx?: { type: string; text: string }[]): ParsedScene[] {
    const scenes: ParsedScene[] = [];

    if (fdx && fdx.length) {
      let current: { heading: string; bodyLines: string[]; cast: Set<string> } | null = null;
      const push = () => {
        if (!current) return;
        const h = this.parseHeading(current.heading);
        const body = current.bodyLines.join('\n');
        scenes.push({ ...h, heading: current.heading, body, cast: [...current.cast], pages: this.estimatePages(body) });
      };
      for (const p of fdx) {
        if (p.type === 'Scene Heading') { push(); current = { heading: p.text, bodyLines: [], cast: new Set() }; continue; }
        if (!current) continue;
        if (p.type === 'Character') current.cast.add(p.text.replace(/\s*\(.*\)$/, '').replace(/[.,]+$/, '').trim());
        current.bodyLines.push(p.text);
      }
      push();
      return scenes;
    }

    // plain-text screenplay
    const lines = text.split(/\r?\n/);
    let current: { heading: string; bodyLines: string[] } | null = null;
    let sceneNo = 0;
    const push = () => {
      if (!current) return;
      const h = this.parseHeading(current.heading);
      const body = current.bodyLines.join('\n');
      scenes.push({ sceneNumber: String(++sceneNo), ...h, heading: current.heading, body, cast: this.extractCast(body), pages: this.estimatePages(body) });
    };
    for (const line of lines) {
      if (this.isHeading(line)) { push(); current = { heading: line.trim(), bodyLines: [] }; continue; }
      if (current) current.bodyLines.push(line);
    }
    push();
    return scenes;
  }

  // ── AI element extraction (required) ───────────────────────────────────────────
  private aiConfigured(): boolean { return !!process.env.ANTHROPIC_API_KEY; }

  private async callLLM(system: string, user: string): Promise<string> {
    return this.ai.complete({ task: 'scriptImport.breakdown', system, user, maxTokens: 3000 });
  }

  private parseJson(text: string): any {
    let t = (text || '').trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    const s = t.indexOf('['); const e = t.lastIndexOf(']');
    if (s >= 0 && e > s) t = t.slice(s, e + 1);
    try { return JSON.parse(t); } catch { return []; }
  }

  /** AI-extract elements for a batch of scenes. Returns map sceneIndex → elements[]. */
  private async aiElementsForBatch(batch: { idx: number; heading: string; body: string }[]): Promise<Record<number, { category: string; name: string; quantity: number }[]>> {
    const system = [
      'You are a 1st AD doing a script breakdown. For each scene, list physical production ELEMENTS by category.',
      `Categories: ${AI_CATEGORIES.join(', ')}.`,
      'Do NOT list speaking characters (handled separately) — but DO list BACKGROUND/extras, STUNTS, VEHICLES, ANIMALS, PROPS, SET_DRESSING, WARDROBE, MAKEUP_HAIR, SFX, VFX, SPECIAL_EQUIPMENT, SOUND_MUSIC, ART, GREENERY, SECURITY.',
      'Return ONLY a JSON array: [{sceneIndex, elements:[{category, name, quantity}]}]. quantity is an integer (default 1). Only include elements clearly implied by the text. Be concise; no duplicates.',
    ].join(' ');
    const scenesText = batch.map((s) => `--- SCENE INDEX ${s.idx} ---\n${s.heading}\n${s.body.slice(0, 2500)}`).join('\n\n');
    const raw = await this.callLLM(system, scenesText);
    const arr = this.parseJson(raw);
    const out: Record<number, any[]> = {};
    if (Array.isArray(arr)) {
      for (const item of arr) {
        const idx = Number(item?.sceneIndex);
        if (!isFinite(idx)) continue;
        const els = (item?.elements || []).filter((e: any) => e && e.category && e.name && CATEGORY_SET.has(String(e.category).toUpperCase()))
          .map((e: any) => ({ category: String(e.category).toUpperCase(), name: String(e.name).slice(0, 120), quantity: Math.max(1, parseInt(e.quantity) || 1) }));
        out[idx] = els;
      }
    }
    return out;
  }

  // ── Orchestration ──────────────────────────────────────────────────────────────
  // RETIRED (P3): superseded by importViaHub — kept for reference, no longer called.
  private async importScriptLegacy(projectId: string, body: { fileUrl: string; originalName?: string; replace?: boolean }) {
    if (!this.aiConfigured()) throw new BadRequestException('AI breakdown requires ANTHROPIC_API_KEY in the backend .env.');
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId } });
    if (!project) throw new BadRequestException('Project not found.');
    if (!body.fileUrl) throw new BadRequestException('No file provided.');

    const fileName = basename(body.fileUrl);
    const filePath = join(process.cwd(), 'uploads', fileName);
    const ext = extname(fileName).toLowerCase();

    const { text, fdxParagraphs } = await this.extractText(filePath, ext);
    if (!text || text.length < 50) throw new BadRequestException('Could not read script text from the file.');

    const scenes = this.splitScenes(text, fdxParagraphs).slice(0, 200); // safety cap
    if (!scenes.length) throw new BadRequestException('No scene headings (INT./EXT.) detected. Is this a screenplay?');

    // optional wipe of previously-imported strips
    const tag = `Imported: ${body.originalName || fileName}`;
    if (body.replace !== false) {
      await this.prisma.productionStrip.deleteMany({ where: { projectId, notes: { startsWith: 'Imported:' } } });
    }

    // AI element extraction in batches
    const elementsByScene: Record<number, { category: string; name: string; quantity: number }[]> = {};
    const BATCH = 8;
    for (let i = 0; i < scenes.length; i += BATCH) {
      const batch = scenes.slice(i, i + BATCH).map((s, j) => ({ idx: i + j, heading: s.heading, body: s.body }));
      try {
        const res = await this.aiElementsForBatch(batch);
        Object.assign(elementsByScene, res);
      } catch (e) {
        // continue without elements for this batch; scenes + cast still created
      }
    }

    // persist strips + elements
    let stripsCreated = 0, elementsCreated = 0;
    const baseOrder = await this.prisma.productionStrip.count({ where: { projectId } });
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const strip = await this.prisma.productionStrip.create({
        data: {
          projectId, sceneNumber: s.sceneNumber || String(i + 1),
          intExt: s.intExt as any, dayNight: s.dayNight as any,
          setName: s.setName || null, description: (s.body.split('\n').find((l) => l.trim()) || '').slice(0, 200) || null,
          pages: s.pages, cast: s.cast as any, sortOrder: baseOrder + i, shootDay: 0, notes: tag,
        },
      });
      stripsCreated++;
      // CAST elements from cues
      const rows: any[] = s.cast.map((name) => ({ projectId, stripId: strip.id, category: 'CAST' as any, name, quantity: 1, estCost: 0 }));
      // AI elements
      for (const e of (elementsByScene[i] || [])) rows.push({ projectId, stripId: strip.id, category: e.category as any, name: e.name, quantity: e.quantity, estCost: 0 });
      if (rows.length) { await this.prisma.breakdownElement.createMany({ data: rows }); elementsCreated += rows.length; }
    }

    return { scenes: stripsCreated, elements: elementsCreated, format: ext.replace('.', '').toUpperCase(), aiUsed: true };
  }
  /**
   * P1 — run the AI breakdown ONCE over a Script-hub revision's scenes (the master).
   * Reconstructs each scene's body text from the revision page text + scene boundaries,
   * AI-tags physical elements, derives CAST from cues, and writes BreakdownElement rows
   * bound to sceneId (+ revisionId, source:'AI'). Idempotent: only scenes without a
   * brokenDownAt stamp are processed unless force=true; MANUAL elements are preserved.
   */
  async breakdownRevision(revisionId: string, opts: { force?: boolean } = {}) {
    if (!this.aiConfigured()) throw new BadRequestException('AI breakdown requires ANTHROPIC_API_KEY in the backend .env.');
    const rev: any = await this.prisma.scriptRevision.findUnique({ where: { id: revisionId } });
    if (!rev) throw new BadRequestException('Revision not found.');
    const doc = await this.prisma.scriptDocument.findUnique({ where: { id: rev.documentId }, select: { projectId: true } });
    const allScenes: any[] = await this.prisma.scriptScene.findMany({ where: { revisionId }, orderBy: [{ pageStart: 'asc' }, { sortOrder: 'asc' }] });
    const projectId = doc?.projectId || allScenes.find((s) => s.projectId)?.projectId;
    if (!projectId) throw new BadRequestException('Revision is not attached to a project.');
    if (!allScenes.length) throw new BadRequestException('This revision has no parsed scenes — upload/parse the script first.');

    // reconstruct scene bodies from the revision page text + boundaries
    const pages: any[] = Array.isArray(rev.pageText) ? [...rev.pageText].sort((a, b) => (Number(a.page) || 0) - (Number(b.page) || 0)) : [];
    let full = ''; const pageIdx = new Map<number, number>();
    for (const pg of pages) { pageIdx.set(Number(pg.page), full.length); full += String(pg.text || '') + '\n'; }
    const startOf = (sc: any) => {
      const base = pageIdx.has(Number(sc.pageStart)) ? (pageIdx.get(Number(sc.pageStart)) as number) : 0;
      return Math.min(full.length, base + (Number(sc.charStart) || 0));
    };
    const ordered = [...allScenes].sort((a, b) => startOf(a) - startOf(b));
    const bodyOf = (i: number) => {
      if (!full) return String(ordered[i].slugline || '');
      const s = startOf(ordered[i]);
      const e = i + 1 < ordered.length ? startOf(ordered[i + 1]) : full.length;
      return full.slice(s, Math.max(s, e)).trim() || String(ordered[i].slugline || '');
    };

    const targets = ordered.filter((sc) => opts.force || !sc.brokenDownAt);
    if (!targets.length) return { revisionId, scenes: ordered.length, processed: 0, elements: 0, skipped: ordered.length, message: 'Already broken down — pass force to re-run.' };
    const targetWithBody = targets.map((sc) => ({ sc, body: bodyOf(ordered.indexOf(sc)) }));

    // AI element extraction in batches (idx is batch-local; echoed back by the model)
    const elementsByScene = new Map<string, { category: string; name: string; quantity: number }[]>();
    const BATCH = 8;
    for (let i = 0; i < targetWithBody.length; i += BATCH) {
      const slice = targetWithBody.slice(i, i + BATCH);
      const batch = slice.map((t, j) => ({ idx: j, heading: t.sc.slugline || '', body: t.body }));
      try {
        const res = await this.aiElementsForBatch(batch);
        slice.forEach((t, j) => { if (res[j]) elementsByScene.set(t.sc.id, res[j]); });
      } catch { /* keep CAST even if a batch fails */ }
    }

    // persist scene-bound elements; replace prior AI rows, preserve MANUAL
    const px: any = this.prisma as any;
    let processed = 0, elements = 0;
    for (const t of targetWithBody) {
      const sc = t.sc;
      await px.breakdownElement.deleteMany({ where: { sceneId: sc.id, source: 'AI' } }).catch(() => {});
      const rows: any[] = [];
      for (const name of this.extractCast(t.body)) rows.push({ projectId, sceneId: sc.id, revisionId, category: 'CAST', name, quantity: 1, estCost: 0, source: 'AI' });
      for (const e of (elementsByScene.get(sc.id) || [])) rows.push({ projectId, sceneId: sc.id, revisionId, category: e.category, name: e.name, quantity: e.quantity, estCost: 0, source: 'AI' });
      if (rows.length) { await px.breakdownElement.createMany({ data: rows }); elements += rows.length; }
      await px.scriptScene.update({ where: { id: sc.id }, data: { brokenDownAt: new Date(), breakdownStatus: 'AI' } });
      processed++;
    }
    return { revisionId, scenes: ordered.length, processed, elements, skipped: ordered.length - processed, aiUsed: true };
  }

}
