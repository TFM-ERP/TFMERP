import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { BreakdownService } from './breakdown.service';
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
      const res = await pdfParse(buf);
      return { text: res.text || '' };
    }
    if (ext === '.txt' || ext === '.fountain') {
      return { text: await readFile(filePath, 'utf8') };
    }
    throw new BadRequestException(`Unsupported file type "${ext}". Use .fdx, .pdf, .docx or .txt.`);
  }

  // ── Scene-heading parsing ──────────────────────────────────────────────────────
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

  private estimatePages(body: string): number {
    const eighths = Math.max(1, Math.round((body.length / 1400) * 8));
    return Math.round((eighths / 8) * 1000) / 1000;
  }

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
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new BadRequestException('AI breakdown not configured. Set ANTHROPIC_API_KEY in the backend .env.');
    const model = process.env.LABOR_AI_MODEL || 'claude-3-5-sonnet-20241022';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' } as any,
      body: JSON.stringify({ model, max_tokens: 3000, system, messages: [{ role: 'user', content: user }] }),
    } as any);
    if (!res.ok) { const t = await res.text().catch(() => ''); throw new BadRequestException(`AI request failed (HTTP ${res.status}). ${t.slice(0, 160)}`); }
    const data: any = await res.json();
    return data?.content?.[0]?.text || '';
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
  async importScript(projectId: string, body: { fileUrl: string; originalName?: string; replace?: boolean }) {
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
}
