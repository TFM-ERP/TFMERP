import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiService } from '../../ai/ai.service';

/**
 * TVC P0 — the creative brief (pre-script level). CRUD + an AI "intake" that reads the brief
 * text and fills the structured fields. Reuses the Anthropic call pattern; tolerant pre-db:push.
 */
@Injectable()
export class CreativeBriefService {
  constructor(private prisma: PrismaService, private ai: AiService) {}

  list(projectId: string) { return (this.prisma as any).creativeBrief.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }).catch(() => [] as any[]); }
  get(id: string) { return (this.prisma as any).creativeBrief.findUnique({ where: { id } }); }
  create(projectId: string, body: any, userId?: string) {
    return (this.prisma as any).creativeBrief.create({ data: { projectId, title: body?.title || null, sourceText: body?.sourceText || null, sourceDocUrl: body?.sourceDocUrl || null, status: 'RAW', createdById: userId || null } });
  }
  update(id: string, body: any) {
    const data: any = {};
    for (const k of ['title', 'sourceText', 'sourceDocUrl', 'sourceFiles', 'objective', 'keyMessage', 'audience', 'tone', 'mandatories', 'durations', 'aspectRatios', 'channels', 'budgetTier', 'references', 'treatmentDraft', 'scriptDraft', 'status']) if (body?.[k] !== undefined) data[k] = body[k];
    return (this.prisma as any).creativeBrief.update({ where: { id }, data });
  }
  remove(id: string) { return (this.prisma as any).creativeBrief.delete({ where: { id } }); }

  /** AI intake — structure the brief text into the fields the producer (and the compass) need. */
  async extract(id: string) {
    const b: any = await (this.prisma as any).creativeBrief.findUnique({ where: { id } });
    if (!b) throw new BadRequestException('Brief not found.');
    const text = String(b.sourceText || '').trim();
    const fromFiles = await this.filesText(b.sourceFiles).catch(() => '');
    const combined = [text, fromFiles].filter(Boolean).join('\n\n');
    if (!combined) throw new BadRequestException('Add brief text or attach a readable PDF / Word / text file, then extract.');
    let ai: any;
    try { ai = await this.callLLM(combined, b); }
    catch (e: any) { if (e instanceof BadRequestException) throw e; throw new BadRequestException('Extract failed: ' + String(e?.message || e).slice(0, 240)); }
    const data: any = {
      objective: ai.objective || null, keyMessage: ai.keyMessage || null, audience: ai.audience || null, tone: ai.tone || null,
      mandatories: Array.isArray(ai.mandatories) ? ai.mandatories : [], durations: Array.isArray(ai.durations) ? ai.durations.map((d: any) => Number(d) || 0).filter(Boolean) : [],
      aspectRatios: Array.isArray(ai.aspectRatios) ? ai.aspectRatios : [], channels: Array.isArray(ai.channels) ? ai.channels : [],
      budgetTier: ai.budgetTier || null, references: Array.isArray(ai.references) ? ai.references : [],
      extracted: ai, status: 'STRUCTURED',
    };
    return (this.prisma as any).creativeBrief.update({ where: { id }, data });
  }


  /** P1 — AI scaffold: from the structured brief, draft a director's treatment + a TVC script. */
  async scaffold(id: string) {
    try {
      const b: any = await (this.prisma as any).creativeBrief.findUnique({ where: { id } });
      if (!b) throw new BadRequestException('Brief not found.');
      if (!b.objective && !b.keyMessage && !String(b.sourceText || '').trim()) throw new BadRequestException('Extract or fill the brief first, then scaffold.');
      let out: any;
      try { out = await this.callScaffold(b); }
      catch (e: any) { if (e instanceof BadRequestException) throw e; throw new BadRequestException('Scaffold failed: ' + String(e?.message || e).slice(0, 240)); }
      const treatment = out?.treatment || null, script = out?.script || null;
      let saved: any;
      try {
        saved = await (this.prisma as any).creativeBrief.update({ where: { id }, data: { treatmentDraft: treatment, scriptDraft: script } });
      } catch {
        const merged = { ...(b.extracted && typeof b.extracted === 'object' ? b.extracted : {}), treatmentDraft: treatment, scriptDraft: script };
        try { const r = await (this.prisma as any).creativeBrief.update({ where: { id }, data: { extracted: merged } }); saved = { ...r, treatmentDraft: treatment, scriptDraft: script }; }
        catch { saved = { ...b, treatmentDraft: treatment, scriptDraft: script, extracted: merged }; }
      }
      await this.dbg(`OK id=${id} treatmentLen=${String(treatment || '').length} scriptLen=${String(script || '').length}`);
      return saved;
    } catch (e: any) {
      await this.dbg(`ERR id=${id} :: ${(e && (e.stack || e.message)) || e}`);
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('Scaffold error: ' + String(e?.message || e).slice(0, 240));
    }
  }

  /** TEMP diagnostic — append scaffold outcome to backend/scaffold-debug.log (dev-readable). */
  private async dbg(line: string): Promise<void> {
    try { const fsp = await import('fs/promises'); const { join } = await import('path'); await fsp.appendFile(join(process.cwd(), 'scaffold-debug.log'), `[${new Date().toISOString()}] ${line}` + '\n'); } catch { /* never break the request */ }
  }

  /** P1 — on-brief compass: how well the live downstream work covers the brief. Deterministic. */
  async alignment(projectId: string) {
    const briefs: any[] = await (this.prisma as any).creativeBrief.findMany({ where: { projectId }, orderBy: { updatedAt: 'desc' } }).catch(() => []);
    const brief: any = briefs.find((b) => b.status !== 'RAW') || briefs[0];
    if (!brief) return { hasBrief: false };
    const arr = (v: any) => Array.isArray(v) ? v : [];
    const parts: string[] = [brief.treatmentDraft, brief.scriptDraft, brief.objective].filter(Boolean) as string[];
    // active-revision script scenes
    const docs = await this.prisma.scriptDocument.findMany({ where: { projectId }, include: { revisions: { orderBy: { createdAt: 'desc' }, take: 1 } } }).catch(() => [] as any[]);
    const doc: any = (docs as any[]).find((d) => d.activeRevisionId) || (docs as any[])[0];
    const revId = doc ? (doc.activeRevisionId || doc.revisions?.[0]?.id) : null;
    const scenes = revId ? await this.prisma.scriptScene.findMany({ where: { revisionId: revId }, select: { slugline: true, description: true } }).catch(() => [] as any[]) : [];
    for (const sc of scenes as any[]) parts.push(`${sc.slugline || ''} ${sc.description || ''}`);
    const strips = await this.prisma.productionStrip.findMany({ where: { projectId, isBanner: false }, select: { setName: true, description: true, cast: true } }).catch(() => [] as any[]);
    for (const s of strips as any[]) parts.push(`${s.setName || ''} ${s.description || ''} ${Array.isArray(s.cast) ? s.cast.join(' ') : ''}`);
    const corpus = parts.join('  ').toLowerCase();
    const has = (phrase: any) => {
      const p = String(phrase || '').toLowerCase().trim(); if (!p) return false;
      if (corpus.includes(p)) return true;
      const toks = p.split(/\W+/).filter((w) => w.length > 3);
      if (!toks.length) return false;
      return toks.filter((t) => corpus.includes(t)).length / toks.length >= 0.6;
    };
    const items: any[] = [];
    for (const m of arr(brief.mandatories)) items.push({ type: 'mandatory', label: String(m), status: has(m) ? 'covered' : 'missing' });
    if (brief.keyMessage) {
      const toks = String(brief.keyMessage).toLowerCase().split(/\W+/).filter((w) => w.length > 3);
      const pct = toks.length ? toks.filter((t) => corpus.includes(t)).length / toks.length : 0;
      items.push({ type: 'message', label: `Key message: ${brief.keyMessage}`, status: pct >= 0.6 ? 'covered' : pct >= 0.3 ? 'partial' : 'missing' });
    }
    const dels: any[] = await (this.prisma as any).deliverable.findMany({ where: { projectId }, select: { durationSec: true, aspectRatio: true } }).catch(() => []);
    const haveDur = new Set(dels.map((d) => Number(d.durationSec)));
    const haveRatio = new Set(dels.map((d) => String(d.aspectRatio)));
    for (const d of arr(brief.durations)) items.push({ type: 'duration', label: `${d}s cutdown`, status: haveDur.has(Number(d)) ? 'covered' : 'missing', note: dels.length ? '' : 'no deliverables yet — generate from brief' });
    for (const r of arr(brief.aspectRatios)) items.push({ type: 'ratio', label: `${r}`, status: haveRatio.has(String(r)) ? 'covered' : 'missing', note: dels.length ? '' : 'no deliverables yet — generate from brief' });
    const scored = items.filter((i) => ['covered', 'missing', 'partial'].includes(i.status));
    const coveredN = scored.filter((i) => i.status === 'covered').length + 0.5 * scored.filter((i) => i.status === 'partial').length;
    const pct = scored.length ? Math.round((100 * coveredN) / scored.length) : null;
    return { hasBrief: true, brief: { id: brief.id, title: brief.title, status: brief.status }, pct, covered: scored.filter((i) => i.status === 'covered').length, total: scored.length, items, hasScript: scenes.length > 0 || !!brief.scriptDraft };
  }

  private async callScaffold(b: any): Promise<any> {
    const briefJson = JSON.stringify({ objective: b.objective, keyMessage: b.keyMessage, audience: b.audience, tone: b.tone, mandatories: b.mandatories, durations: b.durations, aspectRatios: b.aspectRatios, channels: b.channels, references: b.references, sourceText: String(b.sourceText || '').slice(0, 4000) });
    const system = "You are a commercial director and copywriter. From the structured TVC brief, produce ONLY a JSON object: {treatment, script}. treatment = a concise director's treatment (concept, approach, tone, visual world, and why it delivers the objective + key message). script = a TVC script in beats for the longest duration, each beat with VISUAL (action), AUDIO (VO/dialogue/SFX) and any on-screen SUPER, ending on the pack shot + tagline. Weave in EVERY mandatory. Production-real, on-brief. JSON only, both values are strings (use \\n for line breaks).";
    const out = await this.ai.json({ task: 'brief.scaffold', system, user: briefJson, maxTokens: 2500, projectId: b.projectId || null, refType: 'CreativeBrief', refId: b.id || null });
    return out || { treatment: '', script: '' };
  }


  /** Pull text out of attached brief files (PDF + Word + txt). .pages isn't auto-readable. */
  private async filesText(files: any): Promise<string> {
    if (!Array.isArray(files) || !files.length) return '';
    const { join, basename, extname } = await import('path');
    const { readFile } = await import('fs/promises');
    const out: string[] = [];
    for (const f of files) {
      try {
        const url = f?.url || ''; if (!url) continue;
        const abs = join(process.cwd(), 'uploads', basename(url));
        const ext = (extname(url) || extname(f?.name || '')).toLowerCase();
        let text = '';
        if (ext === '.pdf') {
          let pdfParse: any;
          try { const m: any = await import('pdf-parse/lib/pdf-parse.js'); pdfParse = m.default || m; }
          catch { const m: any = await import('pdf-parse'); pdfParse = m.default || m; }
          text = (await pdfParse(await readFile(abs))).text || '';
        } else if (ext === '.docx' || ext === '.doc') {
          const mammoth: any = await import('mammoth');
          text = (await mammoth.extractRawText({ path: abs })).value || '';
        } else if (ext === '.txt' || ext === '.md' || ext === '.rtf') {
          text = await readFile(abs, 'utf8');
        } else if (ext === '.pages' || ext === '.key' || ext === '.numbers') {
          const pdfBuf = await this.pagesPreviewPdf(abs).catch(() => null);
          if (!pdfBuf) continue; // no embedded preview — keep as attachment only
          let pdfParse: any;
          try { const m: any = await import('pdf-parse/lib/pdf-parse.js'); pdfParse = m.default || m; }
          catch { const m: any = await import('pdf-parse'); pdfParse = m.default || m; }
          text = (await pdfParse(pdfBuf)).text || '';
        } else { continue; }
        if (text.trim()) out.push(`--- ${f?.name || basename(url)} ---\n${text.trim().slice(0, 12000)}`);
      } catch { /* skip unreadable file */ }
    }
    return out.join('\n\n');
  }

  /** Pull the embedded QuickLook/Preview.pdf out of an Apple iWork (.pages/.key/.numbers) ZIP
   *  package using built-in zlib (no extra dependency). Returns the PDF buffer or null. */
  private async pagesPreviewPdf(abs: string): Promise<Buffer | null> {
    const { readFile } = await import('fs/promises');
    const zlib = await import('zlib');
    const buf = await readFile(abs);
    let eocd = -1;
    for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i--) { if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) return null;
    const cdCount = buf.readUInt16LE(eocd + 10);
    let off = buf.readUInt32LE(eocd + 16);
    for (let n = 0; n < cdCount; n++) {
      if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) break;
      const method = buf.readUInt16LE(off + 10);
      const compSize = buf.readUInt32LE(off + 20);
      const nameLen = buf.readUInt16LE(off + 28);
      const extraLen = buf.readUInt16LE(off + 30);
      const commentLen = buf.readUInt16LE(off + 32);
      const localOff = buf.readUInt32LE(off + 42);
      const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
      if (/quicklook\/preview\.pdf$/i.test(name) || /^preview\.pdf$/i.test(name)) {
        if (buf.readUInt32LE(localOff) !== 0x04034b50) return null;
        const lName = buf.readUInt16LE(localOff + 26);
        const lExtra = buf.readUInt16LE(localOff + 28);
        const dataStart = localOff + 30 + lName + lExtra;
        const comp = buf.subarray(dataStart, dataStart + compSize);
        if (method === 0) return Buffer.from(comp);
        if (method === 8) return zlib.inflateRawSync(comp);
        return null;
      }
      off += 46 + nameLen + extraLen + commentLen;
    }
    return null;
  }

  private async callLLM(brief: string, b?: any): Promise<any> {
    const system = 'You are an advertising strategist reading a client brief for a TV commercial (TVC). Return ONLY a JSON object: {objective, keyMessage, audience, tone, mandatories, durations, aspectRatios, channels, budgetTier, references}. keyMessage = the single-minded proposition. mandatories = array of must-includes (logo, legal supers, pack shot, tagline, claims). durations = array of spot lengths in seconds (numbers, e.g. [30,15,6]). aspectRatios = array like ["16:9","9:16","1:1"]. channels = array (TV, YouTube, Instagram, TikTok, OOH...). budgetTier = a short string. references = array of references/mood cues. Infer sensibly from the text; use [] or null when absent. No prose, JSON only.';
    const out = await this.ai.json({ task: 'brief.extract', system, user: brief.slice(0, 8000), maxTokens: 1500, projectId: b?.projectId || null, refType: 'CreativeBrief', refId: b?.id || null });
    return out || {};
  }
}
