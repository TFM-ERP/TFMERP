import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import { CanonService } from './canon/canon.service';
import { computeFacts, parseJsonArray } from './scripton.util';
import { LORE_SEED } from './lore-seed.data';
import { knowledgeDirective, stageLadderFor, normalizeFamily } from './knowledge';
import { parseScenes } from '../script/scene-parse.util';
import { seriesSceneCount } from './series-scene-count.util';
import { buildPackageDocModel } from './package-docx.util';
import { packDocx } from './package-docx.renderer';
import { LEVER_KEYS, resolveLever } from './intake-levers.util';
import { resolveCollabMode } from './collab-mode.util';

// Placeholder a scene falls back to when the AI returns no prose. Shared so the
// generators can DETECT a wholesale-stub run (the all-"(The scene continues.)" bug)
// instead of silently filing it as a finished draft.
const SCENE_STUB = '(The scene continues.)';

/**
 * ScripON Doctor P0 — data-grounded coverage + scene diagnostics.
 * Numbers (scene/location/INT-EXT/DAY-NIGHT/page counts, per-character Scenes-%) are COMPUTED
 * from the scene model; the AI writes the prose around those facts. Governed via AiService.
 */
@Injectable()
export class ScripOnService {
  constructor(private prisma: PrismaService, private ai: AiService, private canon: CanonService) {}

  private async resolveRevision(opts: any): Promise<{ revisionId: string; projectId: string; documentId?: string; title?: string }> {
    if (opts?.revisionId) {
      const rev: any = await (this.prisma as any).scriptRevision.findUnique({ where: { id: opts.revisionId }, include: { document: true } }).catch(() => null);
      if (rev) return { revisionId: rev.id, projectId: rev.document?.projectId || opts.projectId, documentId: rev.documentId, title: rev.document?.title };
    }
    const docs: any[] = await (this.prisma as any).scriptDocument.findMany({ where: { projectId: opts.projectId }, include: { revisions: { orderBy: { createdAt: 'desc' }, take: 1 } } }).catch(() => [] as any[]);
    const doc: any = (opts?.documentId ? docs.find((d) => d.id === opts.documentId) : null) || docs.find((d) => d.activeRevisionId) || docs[0];
    if (!doc) throw new BadRequestException('No script found for this project. Upload or create a script first.');
    const revId = doc.activeRevisionId || doc.revisions?.[0]?.id;
    if (!revId) throw new BadRequestException('This script has no revision yet.');
    return { revisionId: revId, projectId: doc.projectId, documentId: doc.id, title: doc.title };
  }

  private facts(scenes: any[]) { return computeFacts(scenes); }

  async coverage(opts: any, userId?: string) {
    const r = await this.resolveRevision(opts);
    const scenes: any[] = await (this.prisma as any).scriptScene.findMany({ where: { revisionId: r.revisionId }, orderBy: { sortOrder: 'asc' }, select: { sceneNumber: true, slugline: true, intExt: true, dayNight: true, setName: true, description: true, pages: true } }).catch(() => []);
    if (!scenes.length) throw new BadRequestException('This script has no parsed scenes yet — import or break it down first.');
    const facts = this.facts(scenes);
    const sceneLines = scenes.map((s, i) => `${s.sceneNumber || i + 1}. ${s.slugline || ''}${s.description ? ' - ' + s.description : ''}`).join('\n').slice(0, 12000);
    const system = 'You are a professional studio script reader. From the scene list + computed facts, write coverage as ONLY a JSON object: {logline, genre, time, locale, synopsis, comments:{plot,characters,dialogue,theme,originality,marketability,production}, comps:[{title,reason}], characters:[{name,role,age,gender,ethnicity,nationality,description}], grades:{plot,characters,dialogue,structure,marketability}, scores:{premise,plot,characters,dialogue,structure,marketability,overall}, recommendation, writerRecommendation}. synopsis = 1-3 tight paragraphs. time = the period the story is set in (e.g. Present day, 1970s, 18th century); locale = where it takes place. Each character also needs age (e.g. 30s), gender, ethnicity (or Unspecified) and nationality. Each comments field = 2-4 specific, honest sentences. comps = 5 comparable titles each with a one-line reason. grades each = EXCELLENT|GOOD|FAIR|POOR (kept for back-compat). scores are integers 1-10; overall is a HOLISTIC viability judgement, NOT the average of the others. recommendation (the SCRIPT) and writerRecommendation (the WRITER, judged separately) each = PASS|CONSIDER|RECOMMEND; reserve RECOMMEND for the genuinely exceptional. Be SPECIFIC — cite exact scene numbers when flagging a problem or strength. Be HONEST, not flattering — surface the real weaknesses; coverage that only praises is a failure. Do NOT paper over plot holes in the synopsis. The Production note must reflect the real facts provided. No text outside the JSON.';
    const user = `FACTS: ${JSON.stringify(facts)}\nTITLE: ${r.title || ''}\nSCENES:\n${sceneLines}`;
    const ai: any = (await this.ai.json({ task: 'scripton.coverage', system, user, maxTokens: 3500, projectId: r.projectId, refType: 'ScriptRevision', refId: r.revisionId })) || {};
    const corpus = scenes.map((s) => `${s.slugline || ''} ${s.description || ''}`.toUpperCase());
    const chars = Array.isArray(ai.characters) ? ai.characters.map((c: any) => {
      const name = String(c?.name || '').toUpperCase().trim();
      const tok = name.split(/\s+/)[0];
      const n = tok ? corpus.filter((t) => t.includes(tok)).length : 0;
      return { name: c?.name || '', role: c?.role || '', age: c?.age || '', gender: c?.gender || '', ethnicity: c?.ethnicity || '', nationality: c?.nationality || '', description: c?.description || '', scenesCount: n, scenesPct: facts.sceneCount ? Math.round((100 * n) / facts.sceneCount) : 0 };
    }) : [];
    const report: any = { projectId: r.projectId, documentId: r.documentId || null, revisionId: r.revisionId, title: r.title || null, logline: ai.logline || null, genre: ai.genre || null, synopsis: ai.synopsis || null, comments: ai.comments || {}, comps: Array.isArray(ai.comps) ? ai.comps : [], characters: chars, grades: ai.grades || {}, scores: ai.scores || {}, recommendation: ai.recommendation || null, writerRecommendation: ai.writerRecommendation || null, facts: { ...facts, time: ai.time || null, locale: ai.locale || null }, status: 'DRAFT' };
    try { return await (this.prisma as any).coverageReport.create({ data: { ...report, createdById: userId || null } }); } catch { return report; }
  }

  async latestCoverage(projectId: string) {
    try { const list: any[] = await (this.prisma as any).coverageReport.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 1 }); return list[0] || null; } catch { return null; }
  }

  async coverageHistory(projectId: string) {
    try { return await (this.prisma as any).coverageReport.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 30 }); } catch { return []; }
  }

  async diagnostics(opts: any) {
    const r = await this.resolveRevision(opts);
    let scenes: any[] = await (this.prisma as any).scriptScene.findMany({ where: { revisionId: r.revisionId }, orderBy: { sortOrder: 'asc' }, select: { id: true, sceneNumber: true, slugline: true, description: true } }).catch(() => []);
    if (Array.isArray(opts?.sceneIds) && opts.sceneIds.length) scenes = scenes.filter((s) => opts.sceneIds.includes(s.id));
    scenes = scenes.slice(0, 40);
    if (!scenes.length) throw new BadRequestException('No scenes to diagnose.');
    const sceneLines = scenes.map((s, i) => `[${s.id}] ${s.sceneNumber || i + 1}. ${s.slugline || ''}${s.description ? ' - ' + s.description : ''}`).join('\n').slice(0, 12000);
    const system = "You are a script doctor. Return ONLY a JSON object {scenes:[{id, objective, obstacle, subtext, powerShift, verdict, fix}]} for the scenes given. objective = who wants what; obstacle = what blocks it; subtext = the real unspoken conflict; powerShift = how power/emotion changes start to end (or NONE if flat); verdict = KEEP|TIGHTEN|CUT; fix = one concrete suggestion. One sentence per field. Echo the id exactly.";
    const ai: any = (await this.ai.json({ task: 'scripton.diagnostics', system, user: sceneLines, maxTokens: 3500, projectId: r.projectId, refType: 'ScriptRevision', refId: r.revisionId })) || {};
    const byId: any = {}; for (const s of scenes) byId[s.id] = s;
    const out = (Array.isArray(ai.scenes) ? ai.scenes : []).map((d: any) => { const sc: any = byId[d?.id] || {}; return { id: d?.id || sc.id || null, sceneNumber: sc.sceneNumber || null, slugline: sc.slugline || null, objective: d?.objective || '', obstacle: d?.obstacle || '', subtext: d?.subtext || '', powerShift: d?.powerShift || '', verdict: d?.verdict || '', fix: d?.fix || '' }; });
    return { revisionId: r.revisionId, scenes: out };
  }

  /** Version compare — deterministic diff between two revisions + facts delta + an AI change summary. */
  async compare(opts: any) {
    const r = await this.resolveRevision(opts);
    const toId = opts?.toRevisionId || r.revisionId;
    const revs: any[] = await (this.prisma as any).scriptRevision.findMany({ where: { documentId: r.documentId }, orderBy: { createdAt: 'desc' }, select: { id: true, label: true, createdAt: true } }).catch(() => []);
    let fromId = opts?.fromRevisionId;
    if (!fromId) { const idx = revs.findIndex((x: any) => x.id === toId); fromId = idx >= 0 ? revs[idx + 1]?.id : revs[1]?.id; }
    if (!fromId) throw new BadRequestException('Need an earlier revision to compare against — this script has only one version.');
    const labelOf = (id: string) => { const x: any = revs.find((v: any) => v.id === id); return (x && (x.label || (x.createdAt ? new Date(x.createdAt).toISOString().slice(0, 10) : null))) || String(id).slice(0, 6); };
    const get = (rev: string) => (this.prisma as any).scriptScene.findMany({ where: { revisionId: rev }, orderBy: { sortOrder: 'asc' }, select: { sceneNumber: true, slugline: true, intExt: true, dayNight: true, setName: true, description: true, pages: true } }).catch(() => []);
    const pair: any[] = await Promise.all([get(fromId), get(toId)]);
    const from: any[] = pair[0] || []; const to: any[] = pair[1] || [];
    const key = (sc: any) => (String(sc.sceneNumber || '').toUpperCase().trim() || String(sc.slugline || '').toUpperCase().trim());
    const fromMap: any = {}; const toMap: any = {};
    for (const sc of from) fromMap[key(sc)] = sc;
    for (const sc of to) toMap[key(sc)] = sc;
    const changes: any[] = [];
    for (const k of Object.keys(toMap)) { const sc = toMap[k]; if (!(k in fromMap)) { changes.push({ type: 'ADDED', key: k, slugline: sc.slugline }); } else { const o = fromMap[k]; if ((o.slugline || '') !== (sc.slugline || '') || (o.description || '') !== (sc.description || '')) changes.push({ type: 'MODIFIED', key: k, slugline: sc.slugline, was: o.slugline }); } }
    for (const k of Object.keys(fromMap)) { if (!(k in toMap)) changes.push({ type: 'REMOVED', key: k, slugline: fromMap[k].slugline }); }
    const counts = { added: changes.filter((c) => c.type === 'ADDED').length, removed: changes.filter((c) => c.type === 'REMOVED').length, modified: changes.filter((c) => c.type === 'MODIFIED').length };
    const ff = this.facts(from); const ft = this.facts(to);
    const delta = { scenes: ft.sceneCount - ff.sceneCount, locations: ft.locations - ff.locations, pages: Math.round((ft.pages - ff.pages) * 10) / 10, int: ft.int - ff.int, ext: ft.ext - ff.ext, day: ft.day - ff.day, night: ft.night - ff.night };
    let narrative = '';
    try {
      if (changes.length) {
        const txt = changes.slice(0, 80).map((c: any) => c.type + ' ' + c.key + ' ' + (c.slugline || '') + (c.was ? ' (was: ' + c.was + ')' : '')).join(' / ');
        narrative = await this.ai.complete({ task: 'scripton.compare', system: 'You are a script supervisor. In 2-4 sentences, summarise what changed between two script revisions and the likely production impact (new or lost locations, scene-count change, scope or cost direction). Plain prose, no list.', user: 'FROM ' + labelOf(fromId) + ' -> TO ' + labelOf(toId) + ' | DELTA: ' + JSON.stringify(delta) + ' | CHANGES: ' + txt, maxTokens: 400, projectId: r.projectId, refType: 'ScriptRevision', refId: toId });
      }
    } catch { narrative = ''; }
    return { from: { id: fromId, label: labelOf(fromId) }, to: { id: toId, label: labelOf(toId) }, counts, delta, changes, narrative };
  }

  /** P1 — budget/location-fit: propose multi-variant rewrite strategies to hit a target, grounded in real scene facts. */
  async budgetFit(opts: any) {
    const r = await this.resolveRevision(opts);
    const scenes: any[] = await (this.prisma as any).scriptScene.findMany({ where: { revisionId: r.revisionId }, orderBy: { sortOrder: 'asc' }, select: { sceneNumber: true, slugline: true, intExt: true, dayNight: true, setName: true, description: true, pages: true } }).catch(() => []);
    if (!scenes.length) throw new BadRequestException('This script has no parsed scenes yet — import or break it down first.');
    const facts = this.facts(scenes);
    const target = { budget: opts?.targetBudget ?? null, currency: opts?.currency || 'USD', days: opts?.days ?? null, maxLocations: opts?.maxLocations ?? null, maxCast: opts?.maxCast ?? null, notes: opts?.notes || '' };
    const sceneLines = scenes.map((s, i) => (s.sceneNumber || (i + 1)) + '. ' + (s.slugline || '') + (s.description ? ' - ' + s.description : '')).join('\n').slice(0, 12000);
    const system = 'You are a line producer doing a budget-fit pass on a screenplay. Given the current scene facts and the target constraints, propose THREE distinct labelled strategies (conservative -> aggressive) to bring the production within target by consolidating locations, merging or cutting scenes, converting night to day, reducing cast, or swapping VFX for practical. Return ONLY JSON {variants:[{label, approach, savingPct, projectedScenes, projectedLocations, projectedNights, changes:[{type, target, detail}], tradeoffs}]}. type is one of CONSOLIDATE|CUT|MERGE|CONVERT|RECAST|VFX. Ground every number in the facts provided; savingPct (0-100) is a realistic estimate; one sentence per detail. No text outside the JSON.';
    const user = 'FACTS: ' + JSON.stringify(facts) + ' | TARGET: ' + JSON.stringify(target) + '\nSCENES:\n' + sceneLines;
    const ai: any = (await this.ai.json({ task: 'scripton.budgetFit', system, user, maxTokens: 3000, projectId: r.projectId, refType: 'ScriptRevision', refId: r.revisionId })) || {};
    return { facts, target, variants: Array.isArray(ai.variants) ? ai.variants : [] };
  }

  /** P1b — apply a chosen budget-fit strategy: AI-rewrite the scenes, branch a NEW (inactive) revision, return the re-cost delta. Non-destructive — the original revision stays active. */
  async applyBudgetFit(opts: any) {
    const variant = opts?.variant;
    if (!variant) throw new BadRequestException('Pick a budget-fit option to apply.');
    const r = await this.resolveRevision(opts);
    const srcRev: any = await (this.prisma as any).scriptRevision.findUnique({ where: { id: r.revisionId } }).catch(() => null);
    if (!srcRev) throw new BadRequestException('Source revision not found.');
    const src: any[] = await (this.prisma as any).scriptScene.findMany({ where: { revisionId: r.revisionId }, orderBy: { sortOrder: 'asc' }, select: { sceneNumber: true, slugline: true, intExt: true, dayNight: true, setName: true, description: true, pages: true } }).catch(() => []);
    if (!src.length) throw new BadRequestException('Source revision has no scenes.');
    const srcLines = src.map((s, i) => (s.sceneNumber || (i + 1)) + '. ' + (s.slugline || '') + (s.description ? ' - ' + s.description : '')).join('\n').slice(0, 16000);
    const system = 'You are a line producer applying a budget-fit strategy to a screenplay. Given the source scene list and the chosen strategy + change list, output the REVISED scene list as ONLY a JSON array of objects {sceneNumber, slugline, intExt, dayNight, setName, description, pages}. Apply the consolidations/cuts/merges/conversions; keep the story coherent and preserve any must-keeps; renumber sequentially from 1; intExt is INT|EXT|INT/EXT or null; dayNight is DAY|NIGHT or null; pages is a number. Output the FULL revised list (every scene that remains). JSON array only, no prose.';
    const user = 'STRATEGY: ' + (variant.label || '') + ' - ' + (variant.approach || '') + '\nCHANGES: ' + JSON.stringify(variant.changes || []) + '\nSOURCE SCENES:\n' + srcLines;
    const text = await this.ai.complete({ task: 'scripton.applyBudgetFit', system, user, maxTokens: 6000, projectId: r.projectId, refType: 'ScriptRevision', refId: r.revisionId });
    const arr = this.parseArray(text);
    if (!arr.length) throw new BadRequestException('Could not produce a revised scene list — try a different option.');
    const newRev: any = await (this.prisma as any).scriptRevision.create({ data: { documentId: r.documentId, revisionLabel: ('Budget-fit: ' + (variant.label || 'Option')).slice(0, 60), pdfUrl: srcRev.pdfUrl || '', pageCount: srcRev.pageCount || 0, revisionColor: 'GREEN', supersedesId: r.revisionId, changeSummary: String(variant.approach || 'Budget-fit pass').slice(0, 240) } });
    const rows = arr.slice(0, 400).map((s: any, i: number) => ({ revisionId: newRev.id, projectId: r.projectId || null, sceneNumber: String(s.sceneNumber || (i + 1)), slugline: s.slugline ? String(s.slugline).slice(0, 300) : null, intExt: s.intExt ? String(s.intExt).slice(0, 12) : null, dayNight: s.dayNight ? String(s.dayNight).slice(0, 12) : null, setName: s.setName ? String(s.setName).slice(0, 160) : null, description: s.description ? String(s.description).slice(0, 600) : null, pages: (s.pages != null && !isNaN(Number(s.pages))) ? Number(s.pages) : null, pageStart: 1, pageEnd: 1, sortOrder: i }));
    try { await (this.prisma as any).scriptScene.createMany({ data: rows }); } catch (e: any) { throw new BadRequestException('Branch created but scene write failed: ' + String(e?.message || e).slice(0, 160)); }
    const before = this.facts(src); const after = this.facts(arr);
    const delta = { scenes: after.sceneCount - before.sceneCount, locations: after.locations - before.locations, pages: Math.round((after.pages - before.pages) * 10) / 10, night: after.night - before.night };
    return { revisionId: newRev.id, label: newRev.revisionLabel, before, after, delta, applied: rows.length };
  }

  /** P2 — generic creative-transform pass: returns labelled approaches grounded in the real scenes. kind = tighten|punchup|genre|ending|humour|intensity. */
  async transform(opts: any) {
    const kind = String(opts?.kind || 'tighten');
    const r = await this.resolveRevision(opts);
    const scenes: any[] = await (this.prisma as any).scriptScene.findMany({ where: { revisionId: r.revisionId }, orderBy: { sortOrder: 'asc' }, select: { sceneNumber: true, slugline: true, intExt: true, dayNight: true, setName: true, description: true, pages: true } }).catch(() => []);
    if (!scenes.length) throw new BadRequestException('This script has no parsed scenes yet — import or break it down first.');
    const facts = this.facts(scenes);
    const opt = { intensity: opts?.intensity || null, targetGenre: opts?.targetGenre || null, endingType: opts?.endingType || null, humourStyle: opts?.humourStyle || null, notes: opts?.notes || '' };
    const sceneLines = scenes.map((s, i) => (s.sceneNumber || (i + 1)) + '. ' + (s.slugline || '') + (s.description ? ' - ' + s.description : '')).join('\n').slice(0, 12000);
    const briefs: Record<string, string> = {
      tighten: 'tighten pacing — find the slack: scenes, beats and lines to trim, cut or merge so the story moves, without losing meaning',
      punchup: 'punch up the dialogue — sharper, more specific, more in-character lines; remove on-the-nose exposition',
      genre: 'transpose the tone toward the target genre (' + (opt.targetGenre || 'the requested genre') + ') while keeping the same plot spine and characters',
      ending: 're-engineer the ending to a ' + (opt.endingType || 'new') + ' ending; set up the new payoff earlier with minimal, surgical changes',
      humour: 'inject humour in a ' + (opt.humourStyle || 'character-driven') + ' style, preserving each character voice; nothing that breaks tone',
      intensity: 'dial the scene intensity ' + (opt.intensity || 'up') + ' — adjust stakes, threat, urgency and subtext to match',
    };
    const system = 'You are a script doctor doing a "' + kind + '" rewrite pass. Goal: ' + (briefs[kind] || briefs.tighten) + '. Propose THREE distinct labelled approaches (light to bold). Return ONLY JSON {variants:[{label, approach, scope, changes:[{type, target, detail}], tradeoffs}]}. type is one of REWRITE|CUT|ADD|MERGE|RETONE|RECONNECT. scope is a short tag like "Act 2" or "whole script". Ground every change in the real scenes; one sentence per detail. No text outside the JSON.';
    const user = 'KIND: ' + kind + ' | OPTIONS: ' + JSON.stringify(opt) + ' | FACTS: ' + JSON.stringify(facts) + '\nSCENES:\n' + sceneLines;
    const ai: any = (await this.ai.json({ task: 'scripton.transform.' + kind, system, user, maxTokens: 3000, projectId: r.projectId, refType: 'ScriptRevision', refId: r.revisionId })) || {};
    return { facts, kind, options: opt, variants: Array.isArray(ai.variants) ? ai.variants : [] };
  }

  /** P2 — apply a chosen transform approach: AI-rewrite the scenes, branch a NEW (inactive) revision, return the delta. Non-destructive. */
  async applyTransform(opts: any) {
    const variant = opts?.variant;
    const kind = String(opts?.kind || 'rewrite');
    if (!variant) throw new BadRequestException('Pick an approach to apply.');
    const r = await this.resolveRevision(opts);
    const srcRev: any = await (this.prisma as any).scriptRevision.findUnique({ where: { id: r.revisionId } }).catch(() => null);
    if (!srcRev) throw new BadRequestException('Source revision not found.');
    const src: any[] = await (this.prisma as any).scriptScene.findMany({ where: { revisionId: r.revisionId }, orderBy: { sortOrder: 'asc' }, select: { sceneNumber: true, slugline: true, intExt: true, dayNight: true, setName: true, description: true, pages: true } }).catch(() => []);
    if (!src.length) throw new BadRequestException('Source revision has no scenes.');
    const srcLines = src.map((s, i) => (s.sceneNumber || (i + 1)) + '. ' + (s.slugline || '') + (s.description ? ' - ' + s.description : '')).join('\n').slice(0, 16000);
    const system = 'You are a script doctor applying a "' + kind + '" rewrite to a screenplay. Given the source scene list and the chosen approach + change list, output the REVISED scene list as ONLY a JSON array of objects {sceneNumber, slugline, intExt, dayNight, setName, description, pages}. Apply the changes faithfully; keep the story coherent; renumber sequentially from 1; intExt is INT|EXT|INT/EXT or null; dayNight is DAY|NIGHT or null; pages is a number. Output the FULL revised list. JSON array only, no prose.';
    const user = 'APPROACH: ' + (variant.label || '') + ' - ' + (variant.approach || '') + '\nCHANGES: ' + JSON.stringify(variant.changes || []) + '\nSOURCE SCENES:\n' + srcLines;
    const text = await this.ai.complete({ task: 'scripton.applyTransform.' + kind, system, user, maxTokens: 6000, projectId: r.projectId, refType: 'ScriptRevision', refId: r.revisionId });
    const arr = this.parseArray(text);
    if (!arr.length) throw new BadRequestException('Could not produce a revised scene list — try a different approach.');
    const prefixMap: Record<string, string> = { tighten: 'Tighten', punchup: 'Punch-up', genre: 'Genre', ending: 'Ending', humour: 'Humour', intensity: 'Intensity' };
    const prefix = prefixMap[kind] || 'Rewrite';
    const newRev: any = await (this.prisma as any).scriptRevision.create({ data: { documentId: r.documentId, revisionLabel: (prefix + ': ' + (variant.label || 'Option')).slice(0, 60), pdfUrl: srcRev.pdfUrl || '', pageCount: srcRev.pageCount || 0, revisionColor: 'GREEN', supersedesId: r.revisionId, changeSummary: String(variant.approach || (prefix + ' pass')).slice(0, 240) } });
    const rows = arr.slice(0, 400).map((s: any, i: number) => ({ revisionId: newRev.id, projectId: r.projectId || null, sceneNumber: String(s.sceneNumber || (i + 1)), slugline: s.slugline ? String(s.slugline).slice(0, 300) : null, intExt: s.intExt ? String(s.intExt).slice(0, 12) : null, dayNight: s.dayNight ? String(s.dayNight).slice(0, 12) : null, setName: s.setName ? String(s.setName).slice(0, 160) : null, description: s.description ? String(s.description).slice(0, 600) : null, pages: (s.pages != null && !isNaN(Number(s.pages))) ? Number(s.pages) : null, pageStart: 1, pageEnd: 1, sortOrder: i }));
    try { await (this.prisma as any).scriptScene.createMany({ data: rows }); } catch (e: any) { throw new BadRequestException('Branch created but scene write failed: ' + String(e?.message || e).slice(0, 160)); }
    const before = this.facts(src); const after = this.facts(arr);
    const delta = { scenes: after.sceneCount - before.sceneCount, locations: after.locations - before.locations, pages: Math.round((after.pages - before.pages) * 10) / 10, night: after.night - before.night };
    return { revisionId: newRev.id, label: newRev.revisionLabel, before, after, delta, applied: rows.length };
  }

  /** P3 — content rating estimate: descriptors + per-board cert estimates + (optional) minimal edits to hit a target. ESTIMATES only; boards decide. */
  async rating(opts: any) {
    const r = await this.resolveRevision(opts);
    const scenes: any[] = await (this.prisma as any).scriptScene.findMany({ where: { revisionId: r.revisionId }, orderBy: { sortOrder: 'asc' }, select: { sceneNumber: true, slugline: true, intExt: true, dayNight: true, description: true } }).catch(() => []);
    if (!scenes.length) throw new BadRequestException('This script has no parsed scenes yet — import or break it down first.');
    const facts = this.facts(scenes);
    const target = opts?.targetCert || null;
    const sceneLines = scenes.map((s, i) => (s.sceneNumber || (i + 1)) + '. ' + (s.slugline || '') + (s.description ? ' - ' + s.description : '')).join('\n').slice(0, 12000);
    const system = 'You are a content classifier estimating film certificates from a screenplay. First identify content DESCRIPTORS (categories: Violence, Language, Sexual content, Drugs/Alcohol, Frightening/Intense) each with a level (none|mild|moderate|strong) and a one-line evidence + the scene number it occurs in. Then ESTIMATE the certificate per board: MPA (G/PG/PG-13/R/NC-17), BBFC (U/PG/12/15/18), GCAM-KSA (G/PG12/PG15/R15/R18), UAE (G/PG13/PG15/15+/18+). If a target certificate is provided, list the MINIMAL edits to reach it. Ratings are ESTIMATES; the boards decide. Return ONLY JSON {descriptors:[{category, level, evidence, scene}], estimates:[{board, cert, why}], target:{cert, minimalEdits:[{type, scene, change}]}}. If no target, set target to null. No text outside the JSON.';
    const user = 'TARGET CERT: ' + JSON.stringify(target) + ' | FACTS: ' + JSON.stringify(facts) + '\nSCENES:\n' + sceneLines;
    const ai: any = (await this.ai.json({ task: 'scripton.rating', system, user, maxTokens: 3000, projectId: r.projectId, refType: 'ScriptRevision', refId: r.revisionId })) || {};
    return { facts, target, descriptors: Array.isArray(ai.descriptors) ? ai.descriptors : [], estimates: Array.isArray(ai.estimates) ? ai.estimates : [], targetPlan: ai.target || null };
  }

  /** P3 — culture & compliance screen for a target market: flagged scenes/dialogue/elements + verdict. Specific, fair, scene-cited. */
  async cultureScreen(opts: any) {
    const market = String(opts?.market || opts?.country || 'GCC / MENA');
    const r = await this.resolveRevision(opts);
    const scenes: any[] = await (this.prisma as any).scriptScene.findMany({ where: { revisionId: r.revisionId }, orderBy: { sortOrder: 'asc' }, select: { sceneNumber: true, slugline: true, intExt: true, dayNight: true, description: true } }).catch(() => []);
    if (!scenes.length) throw new BadRequestException('This script has no parsed scenes yet — import or break it down first.');
    const facts = this.facts(scenes);
    const sceneLines = scenes.map((s, i) => (s.sceneNumber || (i + 1)) + '. ' + (s.slugline || '') + (s.description ? ' - ' + s.description : '')).join('\n').slice(0, 12000);
    const system = 'You are a cultural and compliance reader screening a screenplay for a target market. Flag scenes, dialogue or elements that may conflict with the cultural, religious, legal or censorship norms of that market — each with a severity (low|med|high), a category (Religion|Sexuality|Violence|Politics|Substances|Family/Honour|Other), the scene number, the specific issue, and a constructive suggestion that addresses it without losing the story. Be specific and fair; do not over-flag; cite the scene. Then give an overall verdict (PASS|REVIEW|REWORK). Return ONLY JSON {market, verdict, flags:[{severity, category, scene, issue, suggestion}]}. No text outside the JSON.';
    const user = 'MARKET: ' + market + ' | FACTS: ' + JSON.stringify(facts) + '\nSCENES:\n' + sceneLines;
    const ai: any = (await this.ai.json({ task: 'scripton.cultureScreen', system, user, maxTokens: 3000, projectId: r.projectId, refType: 'ScriptRevision', refId: r.revisionId })) || {};
    return { facts, market, verdict: ai.verdict || 'REVIEW', flags: Array.isArray(ai.flags) ? ai.flags : [] };
  }

  /** P6 — Development ladder: generate the next rung (logline -> synopsis -> treatment -> beats -> scenes) from the agreed spine + premise. Proposal only; non-destructive. */
  async develop(opts: any) {
    const stage = String(opts?.stage || 'treatment');
    const spine = opts?.spine || {};
    const premise = String(opts?.premise || opts?.seed || '');
    const prior = String(opts?.prior || '');
    const briefs: Record<string, string> = {
      logline: 'Write ONE sharp logline (max 40 words): a protagonist with a clear goal, the opposing force, and the stakes.',
      synopsis: 'Write a 3-paragraph synopsis (setup / escalation / resolution) that honours the spine.',
      treatment: 'Write a tight prose treatment (about 10 beats across 3 acts) — present tense, scene-anchored, no dialogue.',
      beats: 'Break the story into 12-18 beats; return them as a beats array.',
      scenes: 'Break the story into a scene list (slugline + one-line action each); return a scenes array.',
    };
    const shape = stage === 'beats' ? '{output, beats:[{n, beat, purpose}]}' : stage === 'scenes' ? '{output, scenes:[{sceneNumber, slugline, intExt, dayNight, description}]}' : '{output}';
    const system = 'You are a development executive helping develop a story from its agreed spine. Task: ' + (briefs[stage] || briefs.treatment) + ' Stay true to the spine (format, protagonist goal vs need, opposing force, theme, ending). Return ONLY JSON ' + shape + '. output is the prose (or a one-line summary for array stages). No text outside the JSON.';
    const user = 'STAGE: ' + stage + ' | SPINE: ' + JSON.stringify(spine) + ' | PREMISE: ' + premise.slice(0, 3000) + (prior ? ('\nPRIOR:\n' + prior.slice(0, 6000)) : '');
    // Per-stage output ceilings (NOT targets). A flat 3500 truncated the scenes JSON
    // mid-array on long / token-dense (e.g. Arabic) scripts — dropping the later scenes
    // and the cliffhanger. Callers may override via opts.maxTokens.
    const MAXTOK: Record<string, number> = { logline: 2000, synopsis: 2000, treatment: 4000, beats: 6000, scenes: 16000 };
    const maxTokens = Number(opts?.maxTokens) > 0 ? Number(opts.maxTokens) : (MAXTOK[stage] || 4000);
    if (stage === 'scenes') return this.developSceneList({ system, user, spine, maxTokens, projectId: opts?.projectId });
    const ai: any = (await this.ai.json({ task: 'scripton.develop.' + stage, system, user, maxTokens, projectId: opts?.projectId, refType: 'Project', refId: opts?.projectId })) || {};
    return { stage, spine, output: ai.output || '', beats: Array.isArray(ai.beats) ? ai.beats : [], scenes: Array.isArray(ai.scenes) ? ai.scenes : [] };
  }

  /** The scenes stage with truncation-resilient continuation: one capped call can cut
   *  the JSON off mid-array, so we keep extending from the last few scenes until the
   *  output stops looking truncated (clean JSON + under the cap) or a pass adds nothing.
   *  Bounded passes + sequential renumber; never silently returns a partial outline —
   *  a `warning` is surfaced when it's still incomplete. Mirrors generateFeature()'s
   *  proven scene-map continuation. */
  private async developSceneList(p: { system: string; user: string; spine: any; maxTokens: number; projectId?: string }): Promise<any> {
    const { system, spine, maxTokens, projectId } = p;
    const parse = (r: any): any[] => {
      if (r && r.json && Array.isArray(r.json.scenes)) return r.json.scenes;
      const rec = this.recoverStage(String((r && r.text) || '')); // tolerant: salvage complete scene objects from a cut-off array
      return Array.isArray(rec.scenes) ? rec.scenes : [];
    };
    // Truncated if the model couldn't return clean parseable JSON, or it hit the cap.
    const truncated = (r: any): boolean => {
      if (!r) return true;
      const used = (r.usage && r.usage.output_tokens) || 0;
      const cleanJson = !!(r.json && Array.isArray(r.json.scenes));
      return !cleanJson || used >= maxTokens * 0.9;
    };
    const RUN = (extra: string) => this.ai.run({ task: 'scripton.develop.scenes', system, user: p.user + extra, maxTokens, stream: maxTokens >= 6000, timeoutMs: 600000, idleTimeoutMs: 120000, projectId, refType: 'Project', refId: projectId });

    let last: any = null; let scenes: any[] = []; let output = '';
    try { last = await RUN('\nMap the FULL scene list now, in order, all the way to the FINAL scene (the ending/cliffhanger). Return ONLY JSON {output, scenes:[...]}.'); scenes = parse(last); output = (last.json && last.json.output) || ''; } catch { last = null; }

    let passes = 0;
    while (last && scenes.length && truncated(last) && passes < 4) {
      passes++; const before = scenes.length;
      const tail = scenes.slice(-3).map((s) => '- ' + (s.sceneNumber != null ? s.sceneNumber + ' ' : '') + String(s.slugline || s.description || '')).join('\n');
      try { last = await RUN('\nYou have already mapped ' + scenes.length + ' scenes, ending with:\n' + tail + '\nContinue the scene list from the NEXT scene through the FINAL scene (the ending/cliffhanger) — do NOT repeat any earlier scene. Return ONLY JSON {scenes:[...]} for the REMAINING scenes only.'); } catch { break; }
      const more = parse(last); if (!more.length) break;
      scenes = scenes.concat(more);
      if (scenes.length <= before) break; // a pass added nothing → stop
    }

    scenes = scenes.map((s, i) => ({ ...s, sceneNumber: i + 1 })); // clean sequential numbering across concatenated passes
    const warning = !scenes.length
      ? 'Scene outline generation returned no scenes — re-run.'
      : (truncated(last) ? ('Scene outline may be incomplete — still truncating after ' + passes + ' continuation pass(es) (' + scenes.length + ' scenes). Re-run or raise the cap.') : undefined);
    return { stage: 'scenes', spine, output, beats: [], scenes, passes, warning };
  }

  /** P6 — Adaptation slate: book/source -> THREE distinct screen-adaptation directions, grounded in the supplied source. Proposal only. */
  async adapt(opts: any) {
    const source = String(opts?.sourceText || opts?.source || '');
    if (source.trim().length < 40) throw new BadRequestException('Paste a synopsis or excerpt of the source work to adapt (a few sentences minimum).');
    const targetFormat = String(opts?.targetFormat || 'feature');
    const system = 'You are a development executive proposing how to adapt a literary or source work for the screen. From the supplied source, propose THREE distinct adaptation directions, labelled in order FAITHFUL, RECONCEIVED, REINVENTION (faithful to bold reinvention). For each: a short evocative TITLE (3-6 words, e.g. "The Forge of the Legend"), a logline, what to keep, what to change or compress or cut, the tone, and the chief adaptation risk. Return ONLY JSON {directions:[{label, title, logline, keep, change, tone, risk}]}. Ground everything in the source provided. No text outside the JSON.';
    const user = 'TARGET FORMAT: ' + targetFormat + '\nSOURCE:\n' + source.slice(0, 12000);
    const ai: any = (await this.ai.json({ task: 'scripton.adapt', system, user, maxTokens: 3000, projectId: opts?.projectId, refType: 'Project', refId: opts?.projectId })) || {};
    return { targetFormat, directions: Array.isArray(ai.directions) ? ai.directions : [] };
  }

  /** Regenerate ONE adaptation direction into a CLOSE new variation (same label/spirit), optionally honouring a steering note. */
  async adaptOne(opts: any) {
    const dir = (opts && opts.direction) || {};
    const note = String((opts && opts.note) || '').trim();
    const targetFormat = String((opts && opts.targetFormat) || 'feature');
    let source = String((opts && (opts.sourceText || opts.source)) || '');
    if (!source && opts && opts.projectId) { const i: any = await (this.prisma as any).intakeProfile.findUnique({ where: { projectId: opts.projectId } }).catch(() => null); source = String((i && i.sourceText) || ''); }
    const system = 'You are a development executive. Regenerate ONE adaptation direction into a CLOSE new variation - the SAME label and spirit, just a fresh take (not a different direction). Keep the same label. Return ONLY JSON {label, title, logline, keep, change, tone, risk}. No text outside the JSON.';
    const user = 'TARGET FORMAT: ' + targetFormat + '\nKEEP THIS DIRECTION (label ' + String(dir.label || '') + '). Its current take:\n' + JSON.stringify({ title: dir.title, logline: dir.logline, keep: dir.keep, change: dir.change, tone: dir.tone, risk: dir.risk }) + (note ? '\nSTEERING NOTE (honour this in the new take): ' + note : '') + (source ? '\nSOURCE (excerpt):\n' + source.slice(0, 8000) : '') + '\nWrite a close new variation now.';
    const ai: any = (await this.ai.json({ task: 'scripton.adapt.one', system, user, maxTokens: 1200, projectId: opts && opts.projectId, refType: 'Project', refId: opts && opts.projectId })) || {};
    const out: any = (ai && (ai.direction || ai)) || {};
    return { direction: { label: out.label || dir.label, title: out.title || dir.title, logline: out.logline || dir.logline, keep: out.keep || dir.keep, change: out.change || dir.change, tone: out.tone || dir.tone, risk: out.risk || dir.risk } };
  }

  /** P4 — Format conversion: re-shape the current script into another format (series / vertical micro-drama / short / feature). Grounded in the real scenes. Proposal only. */
  async formatConvert(opts: any) {
    const target = String(opts?.targetFormat || 'series');
    const r = await this.resolveRevision(opts);
    const scenes: any[] = await (this.prisma as any).scriptScene.findMany({ where: { revisionId: r.revisionId }, orderBy: { sortOrder: 'asc' }, select: { sceneNumber: true, slugline: true, intExt: true, dayNight: true, description: true } }).catch(() => []);
    if (!scenes.length) throw new BadRequestException('This script has no parsed scenes yet — import or break it down first.');
    const facts = this.facts(scenes);
    const sceneLines = scenes.map((s, i) => (s.sceneNumber || (i + 1)) + '. ' + (s.slugline || '') + (s.description ? ' - ' + s.description : '')).join('\n').slice(0, 14000);
    const briefs: Record<string, string> = {
      series: 'Re-shape into a TV series: propose a season of episodes; for each give a title, the episode engine, and the act-out or cliffhanger.',
      vertical: 'Re-shape into vertical micro-drama: 60-90 second episodes built on the addiction loop. For each: a hook (first 3 seconds), the escalation, the sting, and the cliffhanger.',
      short: 'Compress into a single short film: the one essential through-line and what to cut; return a single episode entry.',
      feature: 'Condense or expand into a feature: a clean 3-act spine mapped across a few entries.',
    };
    const loop = target === 'vertical' ? '{episodes:[{ep, hook, escalation, sting, cliffhanger}]}' : '{episodes:[{ep, title, engine, cliffhanger}]}';
    const system = 'You are a format and development specialist converting a screenplay into another delivery format. Target: ' + target + '. ' + (briefs[target] || briefs.series) + ' Keep the same characters and core story; map from the real scenes provided; keep every episode on the central engine. Return ONLY JSON ' + loop + '. No text outside the JSON.';
    const user = 'TARGET: ' + target + ' | FACTS: ' + JSON.stringify(facts) + '\nSCENES:\n' + sceneLines;
    const ai: any = (await this.ai.json({ task: 'scripton.formatConvert.' + target, system, user, maxTokens: 3500, projectId: r.projectId, refType: 'ScriptRevision', refId: r.revisionId })) || {};
    return { targetFormat: target, facts, episodes: Array.isArray(ai.episodes) ? ai.episodes : [] };
  }

  /** P5 — Market forecast: comparables + windowed projection (P50 + 80% band) + greenlight probability. PROBABILISTIC, not a guarantee. Grounded in the script facts. */
  async marketForecast(opts: any) {
    const r = await this.resolveRevision(opts);
    const scenes: any[] = await (this.prisma as any).scriptScene.findMany({ where: { revisionId: r.revisionId }, orderBy: { sortOrder: 'asc' }, select: { sceneNumber: true, slugline: true, intExt: true, dayNight: true, description: true } }).catch(() => []);
    const facts = this.facts(scenes);
    const negative = opts?.negative ?? opts?.budget ?? null;
    const markets = opts?.markets || ['Theatrical', 'Streaming', 'International'];
    const genre = opts?.genre || null;
    const logline = String(opts?.logline || '').slice(0, 500);
    const sceneLines = scenes.slice(0, 120).map((s, i) => (s.sceneNumber || (i + 1)) + '. ' + (s.slugline || '')).join('\n').slice(0, 8000);
    const system = 'You are a film market analyst. From the project profile, name 3-5 genuine COMPARABLE titles (each with a similarity 0-100 and an approximate worldwide gross). Then FORECAST revenue per window (a P50 plus an 80 percent low-high band) and a GREENLIGHT PROBABILITY (0-100) with key drivers and risks. All figures are PROBABILISTIC ESTIMATES, never guarantees; be conservative and reasoned. Return ONLY JSON {comps:[{name, sim, gross}], forecast:[{window, p50, low, high}], probability, verdict, drivers:[string], risks:[string]}. verdict is GO|CONDITIONAL|HOLD. Money as short strings like "$118M". No text outside the JSON.';
    const user = 'NEGATIVE: ' + JSON.stringify(negative) + ' | GENRE: ' + JSON.stringify(genre) + ' | MARKETS: ' + JSON.stringify(markets) + ' | LOGLINE: ' + logline + ' | FACTS: ' + JSON.stringify(facts) + '\nSCENES (sample):\n' + sceneLines;
    const ai: any = (await this.ai.json({ task: 'scripton.marketForecast', system, user, maxTokens: 2500, projectId: r.projectId, refType: 'ScriptRevision', refId: r.revisionId })) || {};
    return { facts, negative, comps: Array.isArray(ai.comps) ? ai.comps : [], forecast: Array.isArray(ai.forecast) ? ai.forecast : [], probability: ai.probability ?? null, verdict: ai.verdict || 'CONDITIONAL', drivers: Array.isArray(ai.drivers) ? ai.drivers : [], risks: Array.isArray(ai.risks) ? ai.risks : [] };
  }

  /** P7 — Greenlight decision: GLP scorecard + audience quadrants + cost opportunities + ROI cases + verdict & memo. Decision-support, not a guarantee. */
  async greenlightDecision(opts: any) {
    const r = await this.resolveRevision(opts);
    const scenes: any[] = await (this.prisma as any).scriptScene.findMany({ where: { revisionId: r.revisionId }, orderBy: { sortOrder: 'asc' }, select: { sceneNumber: true, slugline: true, intExt: true, dayNight: true, description: true } }).catch(() => []);
    const facts = this.facts(scenes);
    const negative = opts?.negative ?? opts?.budget ?? null;
    const sceneLines = scenes.slice(0, 120).map((s, i) => (s.sceneNumber || (i + 1)) + '. ' + (s.slugline || '')).join('\n').slice(0, 8000);
    const system = 'You are the secretary of a studio greenlight committee. Produce a decision pack: (1) a weighted SCORECARD across Story, Cast-ability, Market, Budget-fit, Differentiation, Risk — each weight 0-1 (sum about 1), score 0-10, one-line note; (2) AUDIENCE quadrants (Younger/Older by Male/Female) with an appeal note each; (3) COST opportunities (specific savings on the negative); (4) ROI cases Base/High/Downside with revenue, margin, ROI; (5) an overall greenlight PROBABILITY (0-100), a VERDICT (GREENLIGHT|CONDITIONAL|PASS), and a 2-3 sentence decision MEMO. Decision-support estimates, not guarantees. Return ONLY JSON {scorecard:[{criterion, weight, score, note}], audience:[{quadrant, appeal}], costOps:[{item, saving, note}], roi:[{case, rev, margin, roi}], probability, verdict, memo}. Money as short strings. No text outside the JSON.';
    const user = 'NEGATIVE: ' + JSON.stringify(negative) + ' | FACTS: ' + JSON.stringify(facts) + '\nSCENES (sample):\n' + sceneLines;
    const ai: any = (await this.ai.json({ task: 'scripton.greenlightDecision', system, user, maxTokens: 3000, projectId: r.projectId, refType: 'ScriptRevision', refId: r.revisionId })) || {};
    return { facts, negative, scorecard: Array.isArray(ai.scorecard) ? ai.scorecard : [], audience: Array.isArray(ai.audience) ? ai.audience : [], costOps: Array.isArray(ai.costOps) ? ai.costOps : [], roi: Array.isArray(ai.roi) ? ai.roi : [], probability: ai.probability ?? null, verdict: ai.verdict || 'CONDITIONAL', memo: ai.memo || '' };
  }

  private parseArray(text: string): any[] { return parseJsonArray(text); }

  // ───────────────────────── Development pipeline (D1–D6) ─────────────────────────
  private readonly STAGE_ORDER = ['LOGLINE', 'SYNOPSIS', 'TREATMENT', 'BEATS', 'SCENES', 'STEP_OUTLINE', 'DRAFT', 'COVERAGE'];

  // The authoritative per-build brief (DevelopmentBuild.brief wins; else the shared IntakeProfile).
  private async briefFor(projectId: string, buildId?: string | null): Promise<any> {
    if (buildId) { const b: any = await (this.prisma as any).developmentBuild.findUnique({ where: { id: String(buildId) } }).catch(() => null); if (b && b.brief) return b.brief; }
    const i: any = await (this.prisma as any).intakeProfile.findUnique({ where: { projectId } }).catch(() => null);
    return i || {};
  }
  // The Format Engine ladder for this build (feature/series/vertical/documentary). Falls back to the classic feature ladder.
  private async ladderFor(projectId: string, buildId?: string | null): Promise<string[]> {
    try { const l = stageLadderFor(await this.briefFor(projectId, buildId)) as string[]; return (l && l.length) ? l : this.STAGE_ORDER.slice(); } catch { return this.STAGE_ORDER.slice(); }
  }
  private readonly WHEEL = ['#cfd3da', '#5b8def', '#d6649a', '#e0c14e', '#57b368', '#caa54a', '#c9b48a'];
  private readonly FRAMEWORKS: Record<string, { name: string; beats: string[] }> = {
    savecat: { name: 'Save the Cat (Snyder)', beats: ['Opening Image', 'Theme Stated', 'Set-Up', 'Catalyst', 'Debate', 'Break into Two', 'B Story', 'Fun and Games', 'Midpoint', 'Bad Guys Close In', 'All Is Lost', 'Dark Night of the Soul', 'Break into Three', 'Finale', 'Final Image'] },
    vogler: { name: "Hero's Journey (Vogler)", beats: ['Ordinary World', 'Call to Adventure', 'Refusal of the Call', 'Meeting the Mentor', 'Crossing the First Threshold', 'Tests Allies Enemies', 'Approach to the Inmost Cave', 'The Ordeal', 'Reward', 'The Road Back', 'The Resurrection', 'Return with the Elixir'] },
    harmon: { name: 'Story Circle (Harmon)', beats: ['You', 'Need', 'Go', 'Search', 'Find', 'Take', 'Return', 'Change'] },
    field: { name: 'The Paradigm (Field)', beats: ['Setup', 'Inciting Incident', 'Plot Point I', 'Midpoint', 'Plot Point II', 'Climax', 'Resolution'] },
    sequence8: { name: '8-Sequence Method', beats: ['Status Quo & Point of Attack', 'Predicament / Lock-In', 'First Obstacle', 'First Culmination (Midpoint)', 'Aftermath / Subplot', 'Second Culmination', 'New Tension', 'Resolution / Climax'] },
    tv_network: { name: 'TV network hour', beats: ['Teaser', 'Act One', 'Act Two', 'Act Three', 'Act Four', 'Act Five / Tag'] },
    limited: { name: 'Limited series', beats: ['Premise & World', 'Inciting Event (Ep 1)', 'Rising Complications', 'Midpoint Turn', 'Deepening Stakes', 'All Is Lost', 'Climax (Finale)', 'Resolution'] },
    three_act: { name: 'Three-Act (classic)', beats: ['Setup / Ordinary World', 'Inciting Incident', 'Plot Point One', 'Rising Action', 'Midpoint', 'Plot Point Two', 'Climax', 'Resolution'] },
    hauge: { name: 'Hauge Six-Stage', beats: ['Setup (the world before)', 'Turning Point 1 - Opportunity', 'New Situation', 'Turning Point 2 - Change of Plans', 'Progress', 'Turning Point 3 - Point of No Return', 'Complications & Higher Stakes', 'Turning Point 4 - Major Setback', 'Final Push', 'Turning Point 5 - Climax', 'Aftermath'] },
    freytag: { name: "Freytag's Pyramid", beats: ['Exposition', 'Inciting Incident', 'Rising Action', 'Climax', 'Falling Action', 'Resolution / Denouement'] },
    kishotenketsu: { name: 'Kishotenketsu (4-act)', beats: ['Ki - Introduction (characters & world)', 'Sho - Development (deepen, little conflict)', 'Ten - Twist (an unexpected turn or new angle)', 'Ketsu - Conclusion (reconcile the twist with the whole)'] },
    truby: { name: 'Truby 22 Steps', beats: ['Self-revelation, need & desire', 'Ghost & story world', 'Weakness & need', 'Inciting event', 'Desire', 'Ally(s)', 'Opponent and/or mystery', 'Fake-ally opponent', 'First revelation & decision', 'Plan', 'Opponent plan & counterattack', 'Drive', 'Attack by ally', 'Apparent defeat', 'Second revelation & decision', 'Audience revelation', 'Third revelation & decision', 'Gate, gauntlet, visit to death', 'Battle', 'Self-revelation', 'Moral decision', 'New equilibrium'] },
    story_spine: { name: 'Pixar Story Spine', beats: ['Once upon a time (status quo)', 'Every day (the routine)', 'Until one day (inciting change)', 'Because of that (consequence)', 'Because of that (escalation)', 'Until finally (climax)', 'And ever since (new normal)'] },
  };

  // ── Build script-language directive (P1: Arabic, diglossic) ───────────────────
  // Default (formal/no Arabic) returns '' so English/existing builds are byte-for-byte unchanged.
  private readonly AR_VARIETY: Record<string, { name: string; markers: string }> = {
    'ar-EG-cairene': { name: 'Egyptian (Cairene)', markers: 'عايز، مش، ده/دي، future ح/هـ' },
    'ar-EG-saidi': { name: 'Upper-Egyptian (Saʿidi)', markers: 'q→g, rural cadence' },
    'ar-LV-damascene': { name: 'Levantine (Syrian/Damascene)', markers: 'بدّي، رح، هيك، مو' },
    'ar-LV-lebanese': { name: 'Lebanese', markers: 'بدّي، عم، هلّق, imāla' },
    'ar-LV-palestinian': { name: 'Palestinian', markers: 'بدّي، هيك, urban q→ʔ' },
    'ar-LV-jordanian': { name: 'Jordanian', markers: 'بدّي/أبغى, Bedouin q→g' },
    'ar-GLF-emirati': { name: 'Gulf (Emirati)', markers: 'أبا/أبغى، مو، جذي' },
    'ar-GLF-kuwaiti': { name: 'Kuwaiti', markers: 'أبي، شلون، هاي' },
    'ar-GLF-qatari': { name: 'Qatari', markers: 'أبي/أبغى، مو' },
    'ar-GLF-bahraini': { name: 'Bahraini', markers: 'أبي، شفيك' },
    'ar-SA-najdi': { name: 'Najdi (central Saudi)', markers: 'أبغى/أبا, affrication ك→ts' },
    'ar-SA-hejazi': { name: 'Hejazi (western Saudi)', markers: 'أبغى، كده، q→g' },
    'ar-OM-omani': { name: 'Omani', markers: 'أبا/أبغي, conservative lexicon' },
    'ar-IQ-gelet': { name: 'Iraqi (Baghdadi/Gelet)', markers: 'أريد، هسّه، زين، ماكو، q→g' },
    'ar-IQ-qeltu': { name: 'Iraqi (Mosul/Qeltu)', markers: 'keeps q, northern urban' },
    'ar-MA-darija': { name: 'Moroccan (Darija)', markers: 'بغيت، غادي, vowel-dropping' },
    'ar-DZ-darja': { name: 'Algerian (Darja)', markers: 'راني، نحب، French loanwords' },
    'ar-TN-derja': { name: 'Tunisian (Derja)', markers: 'نحب، باش، برشة' },
    'ar-LY-libyan': { name: 'Libyan', markers: 'نبي/نحب' },
    'ar-SD-sudanese': { name: 'Sudanese', markers: 'داير، ج→g' },
    'ar-YE-sanaani': { name: 'Yemeni (Sanaani)', markers: 'أشتي، بش' },
  };
  // Shared MSA "tells" that must NOT leak into colloquial dialogue (where the model drifts).
  private readonly BANNED_MSA = 'سوف / سـ (future), ليس/ليست, الذي/التي/الذين, لقد, لم, لن, إنّ/أنّ as openers, قد+verb, full case endings (تنوين), the formal أ‑interrogative — use the dialect equivalents instead.';
  // Per-dialect contrastive feature cards — the grammar that actually distinguishes the dialect, not just words.
  private readonly AR_CARD: Record<string, any> = {
    'ar-EG-cairene': { name: 'Egyptian — Cairene', native: 'المصرية', neg: 'مش (predicate) · م...ش (verbal: مبيروحش)', fut: 'هـ/حـ (هيروح، حعمل)', prog: 'بـ (بيكتب)', want: 'عايز/عاوز', dem: 'ده، دي، دول (postposed)', gen: 'بتاع/بتاعة/بتوع', q: 'إيه، فين، إزاي، ليه، مين، إمتى، كام', part: 'يعني، طب/طيب، خلاص، يلا، بقى، أهو، ماشي، إيوه، لأ', phon: 'ج=g · ق→ء often', gloss: 'now=دلوقتي · good=كويس · a lot=أوي/كتير · guy=راجل · thing=حاجة · like-this=كده' },
    'ar-EG-saidi': { name: 'Upper Egyptian — Saʿidi', native: 'الصعيدية', neg: 'مش · م...ش', fut: 'هـ/حـ', prog: 'بـ', want: 'عايز', dem: 'ده، دي', gen: 'بتاع', q: 'إيه، فين، إزاي، ليه', part: 'يا واد، طيب، خلاص', phon: 'ق→g (gaal) · ج=g · rural cadence', gloss: 'a lot=كتير' },
    'ar-LV-damascene': { name: 'Levantine — Syrian/Damascene', native: 'الشامية', neg: 'ما (verbal) · مو (predicate)', fut: 'رح/حـ (رح روح)', prog: 'عم (عم يكتب)', want: 'بدّي، بدّك، بدّو', dem: 'هاد، هاي، هدول', gen: 'تبع/تاع', q: 'شو، وين، كيف، ليش، مين، إيمتى، قدّيش', part: 'يعني، طيب، خلص، يلا، هلق، لك، عنجد، إي، لأ', phon: 'ق→ء (hamza)', gloss: 'now=هلق · good=منيح · a lot=كتير · guy=زلمة · thing=شي · like-this=هيك' },
    'ar-LV-lebanese': { name: 'Lebanese', native: 'اللبنانية', neg: 'ما · مو', fut: 'رح/حـ', prog: 'عم', want: 'بدّي', dem: 'هيدا، هيدي، هودي', gen: 'تبع', q: 'شو، وين، كيف، ليه، مين، إيمتى', part: 'يعني، طيب، يلا، هلّق، كمان، أكيد، إي، لأ + French (مرسي/بونجور)', phon: 'imāla ē · ق→ء', gloss: 'now=هلّق · a lot=كتير · nice=حلو' },
    'ar-LV-palestinian': { name: 'Palestinian', native: 'الفلسطينية', neg: 'ما...ش · مش', fut: 'رح/حـ', prog: 'عم', want: 'بدّي، بدنا', dem: 'هاد، هاي، هدول', gen: 'تبع/تاع', q: 'شو/إيش، وين، كيف، ليش، مين، إمتى', part: 'يعني، طيب، يلا، هلأ، يا زلمة', phon: 'rural q→k · urban q→ء', gloss: 'now=هلأ · a lot=كتير' },
    'ar-LV-jordanian': { name: 'Jordanian', native: 'الأردنية', neg: 'ما...ش · مش', fut: 'رح/حـ', prog: 'عم', want: 'بدّي · أبغى (Bedouin)', dem: 'هاظا، هاي، هظول', gen: 'تبع/حق', q: 'شو/إيش، وين، كيف، ليش، مين', part: 'يعني، طيب، يلا، يا زلمة، يا خوي', phon: 'Bedouin q→g (گال)', gloss: 'now=هسّع · a lot=كثير' },
    'ar-GLF-emirati': { name: 'Gulf — Emirati', native: 'الإماراتية', neg: 'ما · مو', fut: 'بـ (بروح) · راح', prog: 'قاعد (قاعد يكتب)', want: 'أبا/أبغي/أبي', dem: 'هذا، هذي، هذولا · ذا', gen: 'حق/مال', q: 'شو/وش، وين، شلون/جي، ليش، منو، متى، كم/جم', part: 'يلا، زين، طيب، عاد، يا هلا، إي، لا · جذي (like-this)', phon: 'ق→g · ك→ch (چ) · ج→y sometimes', gloss: 'now=الحين · good=زين · a lot=وايد · guy=ريّال · thing=شي' },
    'ar-GLF-kuwaiti': { name: 'Kuwaiti', native: 'الكويتية', neg: 'ما · مو', fut: 'بـ · راح', prog: 'قاعد', want: 'أبي/أبا', dem: 'هذا، هاي، هذيلا', gen: 'حق/مال', q: 'شنو، وين، شلون، ليش، منو، شكثر', part: 'يلا، زين، انزين، عاد، شفيك، إي، لا · چذي', phon: 'ق→g · ك→ch', gloss: 'now=الحين · a lot=وايد' },
    'ar-GLF-qatari': { name: 'Qatari', native: 'القطرية', neg: 'ما · مو', fut: 'بـ · راح', prog: 'قاعد', want: 'أبي/أبغى', dem: 'هذا، هذي', gen: 'حق/مال', q: 'شو/وش، وين، شلون، ليش، منو', part: 'يلا، زين، عاد، إي، لا', phon: 'ق→g · ج→y', gloss: 'now=الحين · a lot=وايد' },
    'ar-GLF-bahraini': { name: 'Bahraini', native: 'البحرينية', neg: 'ما · مو', fut: 'بـ · راح', prog: 'قاعد', want: 'أبي', dem: 'هذا، هاي', gen: 'حق/مال', q: 'شنو، وين، شلون، ليش، منو', part: 'يلا، زين، عاد، شفيك', phon: 'ق→g · ك→ch', gloss: 'now=الحين · a lot=وايد' },
    'ar-SA-najdi': { name: 'Najdi (central Saudi)', native: 'النجدية', neg: 'ما · مو', fut: 'بـ · راح', prog: 'قاعد', want: 'أبغى/أبا', dem: 'هذا، هذي، ذولا', gen: 'حق/مال', q: 'وش، وين، كيف/وش، ليش/ليه، مين، متى، كم', part: 'يا ولد، زين، طيب، عاد، الحين، إي، لا', phon: 'ق→g · affrication ك→ts، ق→dz', gloss: 'now=الحين · good=زين · a lot=مرّة/كثير' },
    'ar-SA-hejazi': { name: 'Hejazi (western Saudi)', native: 'الحجازية', neg: 'ما · مو', fut: 'حـ · راح', prog: 'قاعد · عمّال', want: 'أبغى', dem: 'هذا، هاذي، هذيل', gen: 'حق/بتاع', q: 'إيش/وش، فين/وين، كيف، ليش، مين، إمتى، كم', part: 'يا أخي، طيب، خلاص، يلا، دحين، إي، لا', phon: 'ق→g (urban also ء)', gloss: 'now=دحّين · a lot=كثير/مرّة' },
    'ar-OM-omani': { name: 'Omani', native: 'العُمانية', neg: 'ما · مو', fut: 'بـ · راح', prog: 'قاعد', want: 'أبا/أبغي', dem: 'هذا، هذي', gen: 'حق/مال', q: 'شو، وين، كيف، ليش، منو', part: 'زين، عاد، يا أخي', phon: 'conservative; own lexicon', gloss: 'a lot=وايد/كثير' },
    'ar-IQ-gelet': { name: 'Iraqi — Baghdadi (Gelet)', native: 'العراقية', neg: 'ما · ماكو (there isn\'t)', fut: 'رح/حـ (راح أروح)', prog: 'دا/قاعد (دا يكتب)', want: 'أريد (آني أريد) · أبي (south)', dem: 'هذا، هاي، هذولة', gen: 'مال/حق', q: 'شنو/ش، وين، شلون، ليش، منو، شوكت، شكد/چم', part: 'هسّه، زين، خوش (good)، عاد، اكو/ماكو، يبه', phon: 'ق→g (گلت) · ك→ch (چ) sometimes', gloss: 'now=هسّه · good=زين/خوش · a lot=هواية' },
    'ar-IQ-qeltu': { name: 'Iraqi — Mosul (Qeltu)', native: 'الموصلية', neg: 'ما', fut: 'رح', prog: 'قاعد', want: 'أريد', dem: 'هاذا، هاي', gen: 'مال', q: 'شنو، وين، شلون، ليش', part: 'هسّة، زين', phon: 'keeps q · Moslawi ر→غ', gloss: 'now=هسّة' },
    'ar-MA-darija': { name: 'Moroccan — Darija', native: 'الدارجة المغربية', neg: 'ما...ش · ماشي (predicate)', fut: 'غادي (غادي نمشي)', prog: 'كا/تا (كنكتب، كايدير)', want: 'بغيت', dem: 'هاد، هادي، هدوك · داكشي', gen: 'ديال/د', q: 'آش/أشنو، فين، كيفاش، علاش، شكون، فوقاش، شحال', part: 'واخا (ok)، دابا (now)، بزاف (a lot)، صافي، يالاه، إيه، لا + French', phon: 'heavy vowel-drop · Amazigh/French', gloss: 'now=دابا · good=مزيان · a lot=بزاف · guy=راجل · thing=حاجة' },
    'ar-DZ-darja': { name: 'Algerian — Darja', native: 'الدارجة الجزائرية', neg: 'ما...ش · ماشي', fut: 'راح/غادي', prog: 'راني/راك + verb (راني نخدم)', want: 'حاب/راني نحب', dem: 'هذا، هذي، هذوك', gen: 'تاع/ديال', q: 'واش، وين، كيفاش، علاش/وعلاه، شكون، وقتاش، شحال', part: 'دروك (now)، بزاف، مليح (good)، صح، واه، لا + heavy French', phon: 'French-heavy', gloss: 'now=دروك · good=مليح · a lot=بزاف' },
    'ar-TN-derja': { name: 'Tunisian — Derja', native: 'الدارجة التونسية', neg: 'ما...ش · موش', fut: 'باش (باش نمشي)', prog: 'قاعد', want: 'نحب', dem: 'هاذا، هاذي، هاذوكم', gen: 'متاع', q: 'شنوة/آش، وين/فين، كيفاش، علاش، شكون، وقتاش، قدّاش', part: 'برشا (a lot)، توا (now)، باهي (ok)، ياخي، إيه، لا + French/Italian', phon: 'musical intonation', gloss: 'now=توا · good=باهي · a lot=برشا' },
    'ar-LY-libyan': { name: 'Libyan', native: 'الليبية', neg: 'ما...ش · مش', fut: 'بـ/حـ', prog: 'قاعد', want: 'نبي/نحب', dem: 'هذا، هذي', gen: 'متاع/حق', q: 'شن/شنو، وين، كيف، علاش/ليش، شكون', part: 'باهي، توا، هلبة (a lot)، إيه، لا + Italian', phon: 'Maghreb base + Egyptian/Gulf bridge', gloss: 'now=توّه · a lot=هلبة' },
    'ar-SD-sudanese': { name: 'Sudanese', native: 'السودانية', neg: 'ما', fut: 'حـ/رح', prog: 'قاعد', want: 'داير/عايز', dem: 'دا، دي، ديل', gen: 'بتاع/حق', q: 'شنو، وين، كيف، مالو/ليه، منو، متين', part: 'ساكت، خلاص، يا زول (guy)، دا، إيوة، لا', phon: 'ج→g · q→g often', gloss: 'now=هسّع · guy=زول · a lot=كتير' },
    'ar-YE-sanaani': { name: 'Yemeni — Sanaani', native: 'اليمنية', neg: 'ما...ش', fut: 'بـ/عا', prog: 'قاعد', want: 'أشتي/أبغي', dem: 'ذا، ذي، ذولا', gen: 'حق/بتاع', q: 'كيف/كيش، وين، ليش، متى، من، كم', part: 'عاد، بس، شوف، إي، لا', phon: 'ق→g', gloss: 'now=ذحين · a lot=كثير' },
  };
  // Seed exemplars (native-style) per dialect — few-shot. Merged with native-added rows from the exemplar bank.
  private readonly AR_EXEMPLARS: Record<string, string[]> = {
    'ar-EG-cairene': ['إنت رايح فين بالليل ده؟ لازم نتكلم.', 'مش هسيبك تمشي لحد ما تقوللي الحقيقة.', 'طب اهدا بقى، مفيش لزوم للعصبية دي.'],
    'ar-LV-damascene': ['وين رايح هلق؟ بدّي احكي معك.', 'ما تقلق، كلشي رح يصير تمام.', 'شو صار؟ ليش زعلان هيك؟'],
    'ar-LV-lebanese': ['وين رايح هلّق؟ بدّي احكي معك شي.', 'ما تقلق، كل شي رح يمشي تمام.'],
    'ar-GLF-emirati': ['وين رايح في هالليل؟ أبغى أعرف وش صاير.', 'لا تخاف، كل شي بيكون زين.', 'ليش ما قلت لي من قبل؟'],
    'ar-SA-najdi': ['وين رايح والوقت متأخر؟ أبغى أعرف وش صار.', 'لا تخاف، كل شي بيصير زين إن شاء الله.'],
    'ar-IQ-gelet': ['وين رايح بهالليل؟ أريد أعرف شصاير.', 'لا تخاف، كلشي راح يصير زين.', 'شبيك؟ ليش زعلان هيچي؟'],
    'ar-MA-darija': ['فين غادي فهاد الليل؟ بغيت نعرف آش وقع.', 'ما تخافش، كلشي غادي يكون مزيان.'],
    'ar-TN-derja': ['وين ماشي في هاد الليل؟ نحب نعرف شنوة صار.', 'ما تخافش، كل شيء باش يكون باهي.'],
    'ar-DZ-darja': ['وين رايح فهاد الليل؟ راني نحب نعرف واش صرا.', 'ما تخافش، كلش راح يكون مليح.'],
    'ar-SD-sudanese': ['ماشي وين بالليل دا؟ داير أعرف شنو حصل.', 'ما تخاف، كل حاجة حتبقى تمام.'],
  };
  private async exemplarsFor(variety: string): Promise<string[]> {
    const seed = this.AR_EXEMPLARS[variety] || [];
    let extra: string[] = [];
    try {
      const rows: any[] = await (this.prisma as any).dialectExemplar.findMany({ where: { variety }, orderBy: { createdAt: 'desc' }, take: 8 });
      extra = (rows || []).map((r: any) => String(r.dialect || '').trim()).filter(Boolean);
    } catch { /* table may not exist before db:push */ }
    return Array.from(new Set([...extra, ...seed])).slice(0, 8);
  }
  // Compose the diglossic language directive (async so it can fold in the native-editable exemplar bank).
  private async langDirective(brief: any): Promise<string> {
    const lang = String((brief && (brief.language || brief.scriptLanguage)) || '').toLowerCase();
    const variety = String((brief && brief.scriptVariety) || '');
    const register = String((brief && brief.dialogueRegister) || 'formal').toLowerCase();
    const isArabic = lang.indexOf('arab') >= 0 || lang === 'ar' || variety.indexOf('ar-') === 0;
    if (!isArabic) return '';
    // Applies to EVERY stage (synopsis/treatment/beats/scenes…), not just dialogue — stops English/Latin leaking into Arabic prose.
    const arOnly = ' EVERY stage of output — logline, synopsis, treatment, beats, step outline and scene text — must be written ENTIRELY in Arabic script. Do NOT use Latin letters or English words anywhere; render all names, places and terms in Arabic script (digits are fine), with no transliteration and no bilingual labels.';
    if (register !== 'colloquial' || !variety || variety === 'ar-MSA') {
      return '\n\nLANGUAGE — write the screenplay in Arabic: action, scene description AND dialogue all in Modern Standard Arabic (الفصحى). Sluglines use داخلي/خارجي and ليل/نهار. Natural, fluent فصحى — never stiff or translated-sounding.' + arOnly;
    }
    const c: any = this.AR_CARD[variety] || { name: variety, native: '' };
    const ex = await this.exemplarsFor(variety);
    const exBlock = ex.length ? ('\nAUTHENTIC ' + c.name + ' DIALOGUE — match this exact voice:\n' + ex.map((e) => '• ' + e).join('\n')) : '';
    const feat = [
      c.neg ? 'negation: ' + c.neg : '', c.fut ? 'future: ' + c.fut : '', c.prog ? 'continuous: ' + c.prog : '',
      c.want ? "'want': " + c.want : '', c.dem ? 'demonstratives: ' + c.dem : '', c.gen ? 'possessive: ' + c.gen : '',
      c.q ? 'question words: ' + c.q : '', c.part ? 'discourse particles: ' + c.part : '', c.phon ? 'sound→spelling: ' + c.phon : '',
    ].filter(Boolean).map((s) => '• ' + s).join('\n');
    return '\n\nLANGUAGE — DIGLOSSIC ARABIC. Action lines, scene description, sluglines (داخلي/خارجي · ليل/نهار) and parentheticals stay in Modern Standard Arabic (الفصحى). Write ALL character DIALOGUE in ' + c.name + ' colloquial (' + c.native + ') — real everyday speech.\nDialect grammar — apply CONSISTENTLY:\n' + feat + (c.gloss ? '\nPrefer these dialect words: ' + c.gloss : '') + '\nDo NOT let MSA leak into dialogue — avoid: ' + this.BANNED_MSA + exBlock + '\nWrite the dialect in natural Arabic spelling — never transliterate or phonetically distort.' + arOnly;
  }
  // Heuristic dialect-fidelity score (no AI): are the dialect's markers present, and do banned MSA tells leak in?
  dialectFidelity(text: string, variety: string): { score: number; present: string[]; missing: string[]; flags: string[] } {
    const c: any = this.AR_CARD[variety];
    const body = String(text || '');
    if (!c) return { score: 0, present: [], missing: [], flags: ['Unknown dialect'] };
    const firstTok = (s: string) => String(s || '').split(/[،,·/]/).map((x) => x.replace(/\(.*?\)/g, '').replace(/\.\.\./g, '').trim()).filter((x) => x && /[؀-ۿ]/.test(x))[0] || '';
    const wants = Array.from(new Set([firstTok(c.want), firstTok(c.neg), firstTok(c.fut), firstTok(c.part), firstTok(c.q)].filter(Boolean))) as string[];
    const present: string[] = []; const missing: string[] = [];
    for (const w of wants) { (body.indexOf(w) >= 0 ? present : missing).push(w); }
    const BANNED = ['سوف', 'ليس', 'الذي', 'التي', 'الذين', 'لقد', ' لن ', ' لم '];
    const flags: string[] = [];
    for (const b of BANNED) { if (body.indexOf(b) >= 0) flags.push('MSA tell in dialogue: "' + b.trim() + '"'); }
    let score = wants.length ? Math.round((present.length / wants.length) * 100) : 0;
    score = Math.max(0, score - flags.length * 12);
    return { score, present, missing, flags };
  }
  // Re-write dialogue into the chosen dialect (transcreation), keeping action فصحى & structure intact.
  async dialectRepair(opts: any): Promise<{ text: string }> {
    const variety = String((opts && opts.variety) || '');
    const text = String((opts && opts.text) || '');
    const projectId = String((opts && opts.projectId) || '');
    if (!text.trim() || !variety) return { text };
    const dir = await this.langDirective({ language: 'ar', scriptVariety: variety, dialogueRegister: 'colloquial' });
    const sys = 'You are an Arabic dialect script editor. Rewrite ONLY the DIALOGUE so it is authentic colloquial in the target dialect; keep ALL action/scene-description/sluglines/parentheticals in فصحى exactly as-is; keep every scene heading, character cue, parenthetical and the structure identical. Do not add, cut, merge or renumber scenes. Output ONLY the corrected screenplay as plain text.' + dir;
    try { const r: any = await this.ai.run({ task: 'scripton.dialect.repair', system: sys, user: text.slice(0, 24000), maxTokens: 15000, timeoutMs: 230000, projectId, refType: 'Project', refId: projectId }); const out = String((r && r.text) || '').trim(); return { text: out || text }; } catch { return { text }; }
  }

  // ── Dialect exemplar bank (native-editable few-shot) ──────────────────────────
  async listExemplars(variety?: string) {
    return (this.prisma as any).dialectExemplar.findMany({ where: variety ? { variety } : {}, orderBy: { createdAt: 'desc' }, take: 200 }).catch(() => []);
  }
  async saveExemplar(data: any, userId?: string) {
    const variety = String((data && data.variety) || ''); const dialect = String((data && data.dialect) || '').trim();
    if (!variety || !dialect) throw new BadRequestException('A variety and a dialect line are required.');
    if (data && data.id) return (this.prisma as any).dialectExemplar.update({ where: { id: String(data.id) }, data: { dialect, msa: data.msa || null, note: data.note || null } }).catch(() => null);
    return (this.prisma as any).dialectExemplar.create({ data: { variety, dialect, msa: data.msa || null, note: data.note || null, createdById: userId || null } });
  }
  async deleteExemplar(id: string) { return (this.prisma as any).dialectExemplar.delete({ where: { id: String(id) } }).catch(() => null); }
  // Which dialect a Library doc was developed in (typed IntakeProfile column first, build brief as fallback).
  private async varietyForDoc(docId: string): Promise<string> {
    const b: any = await (this.prisma as any).developmentBuild.findFirst({ where: { linkedScriptId: docId } }).catch(() => null);
    const prof: any = b && b.projectId ? await (this.prisma as any).intakeProfile.findUnique({ where: { projectId: b.projectId } }).catch(() => null) : null;
    return String(resolveLever(prof, b && b.brief, 'scriptVariety') || '');
  }
  private async docText(docId: string): Promise<string> {
    const doc: any = await (this.prisma as any).scriptDocument.findUnique({ where: { id: docId } }).catch(() => null);
    if (!doc || !doc.activeRevisionId) return '';
    const rv: any = await (this.prisma as any).scriptRevision.findUnique({ where: { id: doc.activeRevisionId }, select: { pageText: true } }).catch(() => null);
    const pt: any[] = (rv && Array.isArray(rv.pageText)) ? rv.pageText : [];
    return pt.map((p: any) => String(p.text || '')).join('\n');
  }
  // Doctor: score the bound script's dialect fidelity (resolves text + variety from the doc when not passed).
  async dialectCheck(opts: any) {
    const variety = String((opts && opts.variety) || '') || (opts && opts.docId ? await this.varietyForDoc(String(opts.docId)) : '');
    const text = String((opts && opts.text) || '') || (opts && opts.docId ? await this.docText(String(opts.docId)) : '');
    if (!variety) return { score: 0, present: [], missing: [], flags: ['No dialect set on this build (formal فصحى, or not Arabic).'] };
    return { variety, ...this.dialectFidelity(text, variety) };
  }
  // Doctor auto-repair: transcreate the doc's dialogue into its dialect and save back to the active revision.
  async dialectRepairDoc(opts: any, userId?: string) {
    const docId = String((opts && opts.docId) || '');
    if (!docId) throw new BadRequestException('A docId is required.');
    const doc: any = await (this.prisma as any).scriptDocument.findUnique({ where: { id: docId } }).catch(() => null);
    if (!doc || !doc.activeRevisionId) throw new BadRequestException('Script not found.');
    const variety = String((opts && opts.variety) || '') || await this.varietyForDoc(docId);
    if (!variety) throw new BadRequestException('No dialect to repair to — set Colloquial + a dialect on the build.');
    const text = await this.docText(docId);
    const fixed = (await this.dialectRepair({ variety, text, projectId: doc.projectId })).text;
    const pages = this.paginate(fixed);
    await (this.prisma as any).scriptRevision.update({ where: { id: doc.activeRevisionId }, data: { pageText: pages, pageCount: pages.length } }).catch(() => {});
    return { ok: true, score: this.dialectFidelity(fixed, variety) };
  }

  private stageBrief(kind: string, framework?: string): { system: string; shape: string } {
    const base = 'You are a development executive developing a story stage by stage. Stay true to the prior approved stages and the creative brief. Return ONLY JSON, no text outside it. Do NOT include any title, format, rating, episode count, or metadata header in the output - only the requested content. ';
    if (kind === 'LOGLINE') return { system: base + 'Write ONE logline (max 40 words): a protagonist with a clear goal, the opposing force, and the stakes.', shape: '{output}' };
    if (kind === 'SYNOPSIS') return { system: base + 'Write a 3-paragraph synopsis (setup / escalation / resolution) true to the logline.', shape: '{output}' };
    if (kind === 'TREATMENT') return { system: base + 'Write a tight prose treatment (~10 beats across 3 acts), present tense, scene-anchored, no dialogue.', shape: '{output}' };
    if (kind === 'BEATS') { const fw = this.FRAMEWORKS[framework || 'savecat'] || this.FRAMEWORKS.savecat; return { system: base + 'Map the story onto the ' + fw.name + ' framework using EXACTLY these beats in order: ' + fw.beats.join(' | ') + '. For each beat write what happens. output = a one-line summary. Return {output, beats:[{name, beat, purpose}]}.', shape: '{output, beats}' }; }
    if (kind === 'SCENES') return { system: base + 'Break the story into 24-40 SCENE CARDS (no more than 40). Each scene MUST turn a value (chargeOpen must differ from chargeClose). Keep each synopsis to 1-2 sentences. Return {output, scenes:[{sceneNumber, slugline, intExt, dayNight, location, synopsis, purpose, conflict, stakes, characters:[string], thread, chargeOpen, chargeClose, turnType}]}. thread is A|B|C; chargeOpen/chargeClose are + or -; turnType is action|revelation.', shape: '{output, scenes}' };
    if (kind === 'STEP_OUTLINE') return { system: base + 'Write a STEP OUTLINE: one SHORT numbered paragraph (2-4 sentences) per scene, present tense, the draft-ready roadmap. Return {output, steps:[{n, scene, text}]}.', shape: '{output, steps}' };
    if (kind === 'DRAFT') return { system: 'You are a professional screenwriter. Stay true to the prior approved stages and the creative brief. Write the screenplay in professional FINAL DRAFT format with NUMBERED scene headings (e.g. "1  EXT. DESERT CAMP - NIGHT", "2  INT. TENT - DAY"). Uppercase sluglines, present-tense action lines, centred CHARACTER cues with dialogue beneath, and (CONT\'D)/transitions where apt. Write a substantial continuous draft straight from the step outline - as many numbered scenes as fit in one pass. Output ONLY the screenplay text as plain text - no JSON, no metadata, no title page.', shape: '{output}' };
    if (kind === 'COVERAGE') return { system: base + 'Write a brief studio coverage read: logline, a one-paragraph synopsis, comments on plot/characters/dialogue/marketability, and a verdict PASS|CONSIDER|RECOMMEND.', shape: '{output}' };
    // ── Series ──
    if (kind === 'SEASON_ARC') return { system: base + 'Write the SEASON ARC: the season-long throughline — the central engine, the escalating turns across the episodes, the midpoint shift, and where the season lands. Prose, ~3-5 paragraphs. Honour the format’s episode count from the brief.', shape: '{output}' };
    if (kind === 'EPISODE_MAP') return { system: base + 'Write the EPISODE MAP: a numbered list covering EVERY episode in order (match the brief’s episode count). For each: "EP n — Title — one-line logline — ends on: the hook/cliffhanger." Cover the full ordered run through the finale.', shape: '{output}' };
    // ── Vertical micro-drama ──
    if (kind === 'PREMISE') return { system: base + 'Write the PREMISE for a vertical micro-drama: the pre-loaded conflict the series opens INTO (the explosion already in progress), the core relationship/power imbalance, the central secret, and the engine that will sustain dozens of 60-90 second episodes. 2-3 tight paragraphs.', shape: '{output}' };
    if (kind === 'STORY_ENGINE') return { system: base + 'Name and develop the STORY ENGINE — the repeatable conflict machine that generates an episode’s worth of friction every 60-90 seconds. State the recurring reversal, the escalating stakes, and how it keeps re-pricing the central secret. Reference the engines/templates in the brief.', shape: '{output}' };
    if (kind === 'BEAT_ENGINE') return { system: base + 'Write the per-episode BEAT ENGINE for the first ~10-15 episodes. For EACH episode, one block: Hook (0-15s) — the detonation; Friction — the filmable conflict; Spike (~1:00) — the jolt; Button (~0:55-1:08) — the cliffhanger it cuts on (never resolved). Number each episode.', shape: '{output}' };
    // ── Documentary (written in the edit; narration last) ──
    if (kind === 'THESIS') return { system: base + 'Write the THESIS: the argument the documentary makes, or the central question it investigates, plus why it matters now and what the audience should feel/understand by the end. No invented dialogue or scenes.', shape: '{output}' };
    if (kind === 'RESEARCH_PLAN') return { system: base + 'Write the RESEARCH & ARCHIVE PLAN: the footage, records, data, experts and access needed; what already exists vs must be shot or licensed. A clear, ordered plan — not prose drama.', shape: '{output}' };
    if (kind === 'RIGHTS_PLAN') return { system: base + 'Write the RIGHTS & ACCESS PLAN as a tracked checklist: life-rights, music sync/master licences, archive footage, location and interview releases — each with who/what and the risk if unsecured.', shape: '{output}' };
    if (kind === 'INTERVIEW_OUTLINE') return { system: base + 'Write the INTERVIEW / SHOOTING OUTLINE: the key subjects, the questions for each (grouped by theme), and the verite sequences to capture. No fabricated answers.', shape: '{output}' };
    if (kind === 'PAPER_EDIT') return { system: base + 'Write the PAPER EDIT (string-out): assemble the film’s spine from the anticipated interview/archive/verite material — the ordered sequence of beats and sequences the edit will follow, act by act.', shape: '{output}' };
    if (kind === 'NARRATION') return { system: 'You are a documentary writer. Stay true to the prior stages (thesis, paper edit) and the creative brief. Write the NARRATION SCRIPT to the assumed locked picture: the voice-over that carries the argument, timed to the paper edit’s sequences. Mark sequence headers, then the VO beneath. Written LAST. Output ONLY the narration script as plain text.', shape: '{output}' };
    return { system: base, shape: '{output}' };
  }

  // The currently-selected build version (null = unversioned build → single implicit run, today's behaviour).
  private async activeVersionId(buildId?: string | null): Promise<string | null> {
    if (!buildId) return null;
    const b: any = await (this.prisma as any).developmentBuild.findUnique({ where: { id: String(buildId) }, select: { activeVersionId: true } }).catch(() => null);
    return (b && b.activeVersionId) || null;
  }

  async pipeline(projectId: string, buildId?: string | null, buildVersionId?: string | null) {
    const bid = buildId || null;
    // Resolve the version: explicit arg wins; else the build's active version; else null (unversioned → no filter).
    const ver = bid ? (buildVersionId !== undefined ? (buildVersionId || null) : await this.activeVersionId(bid)) : null;
    const ladder = await this.ladderFor(projectId, bid);
    // Order by the format ladder; any legacy/extra kind sorts after, keeping its classic position as a tiebreak.
    const ord = (k: string) => { const i = ladder.indexOf(k); return i < 0 ? 900 + (this.STAGE_ORDER.indexOf(k) + 1) : i; };
    const baseWhere: any = { projectId, buildId: bid };
    if (ver) baseWhere.buildVersionId = ver;
    const ensure = async () => {
      const existing: any[] = await (this.prisma as any).developmentStage.findMany({ where: baseWhere }).catch(() => []);
      const have = new Set(existing.map((s: any) => s.kind));
      const missing = ladder.filter((k) => !have.has(k));
      if (missing.length) await (this.prisma as any).developmentStage.createMany({ data: missing.map((kind) => ({ projectId, buildId: bid, buildVersionId: ver || null, kind, order: ladder.indexOf(kind) })), skipDuplicates: true }).catch(() => {});
    };
    await ensure();
    const all: any[] = await (this.prisma as any).developmentStage.findMany({ where: baseWhere, include: { versions: { orderBy: { n: 'asc' } } } }).catch(() => []);
    all.sort((a, b) => ord(a.kind) - ord(b.kind));
    return all.map((s) => ({ ...s, current: (s.versions || []).find((v: any) => v.id === s.currentVersionId) || (s.versions || [])[(s.versions || []).length - 1] || null }));
  }

  // ── Build versions (V1/V2/V3) — each a full re-run with its own frozen brief snapshot + ladder + script. Opt-in. ──
  async listBuildVersions(buildId: string) {
    const build: any = await (this.prisma as any).developmentBuild.findUnique({ where: { id: buildId } }).catch(() => null);
    if (!build) return { versions: [], activeVersionId: null };
    const versions: any[] = await (this.prisma as any).buildVersion.findMany({ where: { buildId, NOT: { status: 'DISCARDED' } }, orderBy: { n: 'asc' } }).catch(() => []);
    return { versions, activeVersionId: build.activeVersionId || null };
  }

  // Discard a build version (non-destructive: the row is kept but hidden from the
  // version list; the active version is never touched). Used by Render→Compare's
  // "Discard V{new}" — refuses if the version is currently active.
  async discardBuildVersion(versionId: string) {
    const v: any = await (this.prisma as any).buildVersion.findUnique({ where: { id: versionId } }).catch(() => null);
    if (!v) throw new BadRequestException('Version not found.');
    const build: any = await (this.prisma as any).developmentBuild.findUnique({ where: { id: v.buildId } }).catch(() => null);
    if (build && build.activeVersionId === versionId) throw new BadRequestException('Cannot discard the active version — switch to another version first.');
    await (this.prisma as any).buildVersion.update({ where: { id: versionId }, data: { status: 'DISCARDED' } }).catch(() => {});
    return this.listBuildVersions(v.buildId);
  }

  // Snapshot the current work and start a FRESH re-run (the prior version stays intact). First call also retro-files V1.
  async newBuildVersion(buildId: string, label?: string) {
    const build: any = await (this.prisma as any).developmentBuild.findUnique({ where: { id: buildId } }).catch(() => null);
    if (!build) throw new BadRequestException('Build not found.');
    const existing: any[] = await (this.prisma as any).buildVersion.findMany({ where: { buildId }, orderBy: { n: 'asc' } }).catch(() => []);
    if (!existing.length) {
      // First versioning: file the current (untagged) work as V1, then open V2 as the fresh active run.
      const v1: any = await (this.prisma as any).buildVersion.create({ data: { buildId, n: 1, label: 'V1', briefSnapshot: build.brief ?? undefined, status: build.status || 'DRAFT' } });
      await (this.prisma as any).developmentStage.updateMany({ where: { buildId, buildVersionId: null }, data: { buildVersionId: v1.id } }).catch(() => {});
      if (build.linkedScriptId) await (this.prisma as any).scriptDocument.update({ where: { id: build.linkedScriptId }, data: { buildVersionId: v1.id } }).catch(() => {});
      const v2: any = await (this.prisma as any).buildVersion.create({ data: { buildId, n: 2, label: label || 'V2', briefSnapshot: build.brief ?? undefined, status: 'DRAFT' } });
      await (this.prisma as any).developmentBuild.update({ where: { id: buildId }, data: { activeVersionId: v2.id } }).catch(() => {});
      return this.listBuildVersions(buildId);
    }
    const maxN = existing.reduce((m: number, v: any) => Math.max(m, v.n || 0), 0);
    const vN: any = await (this.prisma as any).buildVersion.create({ data: { buildId, n: maxN + 1, label: label || ('V' + (maxN + 1)), briefSnapshot: build.brief ?? undefined, status: 'DRAFT' } });
    await (this.prisma as any).developmentBuild.update({ where: { id: buildId }, data: { activeVersionId: vN.id } }).catch(() => {});
    return this.listBuildVersions(buildId);
  }

  // Switch the active version — syncs the working brief + re-points the linked script so reader/package follow the version.
  async switchBuildVersion(buildId: string, versionId: string) {
    const v: any = await (this.prisma as any).buildVersion.findUnique({ where: { id: versionId } }).catch(() => null);
    if (!v || v.buildId !== buildId) throw new BadRequestException('Version not found for this build.');
    const data: any = { activeVersionId: versionId, brief: v.briefSnapshot ?? undefined };
    const doc: any = await (this.prisma as any).scriptDocument.findFirst({ where: { buildVersionId: versionId }, orderBy: { createdAt: 'desc' } }).catch(() => null);
    if (doc) data.linkedScriptId = doc.id;
    await (this.prisma as any).developmentBuild.update({ where: { id: buildId }, data }).catch(() => {});
    return this.listBuildVersions(buildId);
  }

  // Go back to the brief that produced a version (read-only reference). versionId optional → the active version.
  async buildVersionBrief(buildId: string, versionId?: string) {
    const vid = versionId || (await this.activeVersionId(buildId));
    if (vid) { const v: any = await (this.prisma as any).buildVersion.findUnique({ where: { id: vid } }).catch(() => null); if (v) return { versionId: v.id, n: v.n, label: v.label, brief: v.briefSnapshot || null }; }
    const build: any = await (this.prisma as any).developmentBuild.findUnique({ where: { id: buildId } }).catch(() => null);
    return { versionId: null, n: 0, label: null, brief: (build && build.brief) || null };
  }

  private recoverStage(raw: string): any {
    const t = String(raw || '').replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
    const out: any = {};
    const arrFor = (key: string): any[] | null => {
      const m = t.indexOf('"' + key + '"'); if (m < 0) return null;
      const lb = t.indexOf('[', m); if (lb < 0) return null;
      const items: any[] = []; let depth = 0, start = -1;
      for (let i = lb; i < t.length; i++) { const c = t[i];
        if (c === '{') { if (depth === 0) start = i; depth++; }
        else if (c === '}') { depth--; if (depth === 0 && start >= 0) { try { items.push(JSON.parse(t.slice(start, i + 1))); } catch { /* skip incomplete */ } start = -1; } }
        else if (c === ']' && depth === 0) break; }
      return items.length ? items : null;
    };
    const b = arrFor('beats'); if (b) out.beats = b;
    const s = arrFor('scenes'); if (s) out.scenes = s;
    const st = arrFor('steps'); if (st) out.steps = st;
    return out;
  }
  private salvageProse(raw: string): string {
    const t = String(raw || '');
    const keys = ['prose', 'synopsis', 'description', 'beat', 'purpose', 'output', 'text', 'name', 'anchor', 'slugline'];
    const re = new RegExp('"(' + keys.join('|') + ')"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"', 'g');
    const segs: string[] = []; let m: any;
    while ((m = re.exec(t))) { const k = m[1]; const v = String(m[2]).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '  ').replace(/\\r/g, '').replace(/\\\\/g, '\\').trim(); if (!v) continue; segs.push((k === 'name' || k === 'anchor' || k === 'slugline') ? ('■ ' + v) : v); }
    return segs.join('\n\n');
  }

  /** Truncation backstop for a long array stage (SCENES / STEP_OUTLINE): keep the
   *  stage's cap, but if one capped call cut the JSON off mid-array, continue from the
   *  last few items until the model stops truncating (clean JSON + under cap) or a pass
   *  adds nothing — bounded, sequentially renumbered. Returns the completed array + a
   *  warning when it's STILL truncating, so we never silently persist a partial outline.
   *  Mirrors generateFeature()'s scene-map continuation. */
  private async extendStageArray(o: { kind: string; arrKey: string; system: string; user: string; cap: number; firstRes: any; firstArr: any[]; projectId: string }): Promise<{ arr: any[]; passes: number; warning?: string }> {
    const { kind, arrKey, system, user, cap, projectId } = o;
    let arr: any[] = Array.isArray(o.firstArr) ? o.firstArr.slice() : [];
    const truncated = (r: any): boolean => { if (!r) return true; const used = (r.usage && r.usage.output_tokens) || 0; const clean = !!(r.json && Array.isArray(r.json[arrKey])); return !clean || used >= cap * 0.9; };
    const pull = (r: any): any[] => (r && r.json && Array.isArray(r.json[arrKey])) ? r.json[arrKey] : (this.recoverStage(String((r && r.text) || ''))[arrKey] || []);
    const desc = (x: any): string => kind === 'SCENES'
      ? ((x.sceneNumber != null ? x.sceneNumber + ' ' : '') + String(x.slugline || x.location || ''))
      : ((x.n != null ? x.n + ' ' : '') + String(x.text || x.scene || x.slugline || '').slice(0, 70));
    let last: any = o.firstRes; let passes = 0;
    while (last && arr.length && truncated(last) && passes < 4) {
      passes++; const before = arr.length;
      const tail = arr.slice(-3).map((x) => '- ' + desc(x)).join('\n');
      try {
        last = await this.ai.run({ task: 'scripton.develop.' + kind.toLowerCase() + '.cont', system, user: user + '\nYou have already produced ' + arr.length + ' items, ending with:\n' + tail + '\nContinue the list from the NEXT item through the FINAL one (the ending/cliffhanger) — do NOT repeat any earlier item. Return ONLY JSON {' + arrKey + ':[...]} for the REMAINING items only.', maxTokens: cap, stream: true, timeoutMs: 600000, idleTimeoutMs: 120000, projectId, refType: 'Project', refId: projectId });
      } catch { break; }
      const more = pull(last); if (!more.length) break;
      arr = arr.concat(more);
      if (arr.length <= before) break; // a pass added nothing → stop
    }
    if (kind === 'SCENES') arr = arr.map((s, i) => ({ ...s, sceneNumber: i + 1 }));
    if (kind === 'STEP_OUTLINE') arr = arr.map((s, i) => ({ ...s, n: i + 1 }));
    const warning = (arr.length && truncated(last)) ? (kind + ' outline may be incomplete — still truncating after ' + passes + ' continuation pass(es) (' + arr.length + ' items). Re-run.') : undefined;
    return { arr, passes, warning };
  }
  async generateStage(opts: any, userId?: string) {

    const projectId = String(opts?.projectId || '');
    const kind = String(opts?.kind || '').toUpperCase();
    const ladder = await this.ladderFor(projectId, opts?.buildId);
    if (!projectId || ladder.indexOf(kind) < 0) throw new BadRequestException('A project and a valid stage are required.');
    const stages = await this.pipeline(projectId, opts?.buildId);
    const stage: any = stages.find((s: any) => s.kind === kind);
    if (!stage) throw new BadRequestException('Stage not found.');
    const idx = ladder.indexOf(kind);
    const priorStage: any = idx > 0 ? stages.find((s: any) => s.kind === ladder[idx - 1]) : null;
    const priorApproved: any = priorStage ? ((priorStage.versions || []).find((v: any) => v.status === 'APPROVED' || v.status === 'LOCKED') || priorStage.current) : null;
    const intakeRow: any = await (this.prisma as any).intakeProfile.findUnique({ where: { projectId } }).catch(() => null);
    const sourceMat = String(opts?.seed || (intakeRow && intakeRow.sourceText) || '').slice(0, 6000);
    const srcBlock = (sourceMat && ['LOGLINE', 'SYNOPSIS', 'TREATMENT', 'BEATS', 'PREMISE', 'STORY_ENGINE', 'SEASON_ARC', 'THESIS'].indexOf(kind) >= 0) ? ('\nSOURCE MATERIAL (the work to adapt - stay faithful to it unless the brief overrides):\n' + sourceMat) : '';
    const research = String((intakeRow && intakeRow.researchNotes) || '').slice(0, 4000);
    const researchBlock = research ? ('\nRESEARCH FINDINGS (authentic facts, period & cultural detail to honour):\n' + research) : '';
    const earlier = stages.filter((s: any) => ladder.indexOf(s.kind) >= 0 && ladder.indexOf(s.kind) < idx).sort((a: any, b: any) => ladder.indexOf(a.kind) - ladder.indexOf(b.kind));
    let soFar = '';
    for (const st of earlier) { const b = String((st.current && st.current.body) || ''); if (b) soFar += '\n--- ' + st.kind + ' ---\n' + b.slice(0, 2400); }
    if (soFar.length > 14000) soFar = soFar.slice(soFar.length - 14000);
    const soFarBlock = soFar ? ('\nDEVELOPMENT SO FAR (everything already written - stay fully consistent with all of it; build directly on it):' + soFar) : '';
    const framework = opts?.framework || (intakeRow && intakeRow.spine && intakeRow.spine.framework) || undefined;
    const brief = this.stageBrief(kind, framework);
    const steer = await this.intakeSteer(projectId);
    const buildRow: any = opts?.buildId ? await (this.prisma as any).developmentBuild.findUnique({ where: { id: String(opts.buildId) } }).catch(() => null) : null;
    const langDir = await this.langDirective((buildRow && buildRow.brief) || intakeRow || {});
    const knowDir = knowledgeDirective((buildRow && buildRow.brief) || intakeRow || {});
    const knowBlock = knowDir ? ('\n\nFORMAT & WORLD ENGINE (honour precisely across this stage):\n' + knowDir) : '';
    const draftRaw = kind === 'DRAFT';
    const user = 'STAGE: ' + kind + (framework ? (' | FRAMEWORK: ' + framework) : '') + steer + researchBlock + srcBlock + soFarBlock + knowBlock + langDir + (draftRaw ? '\nWrite the screenplay now as plain text (no JSON, no metadata header).' : '\nReturn ONLY JSON ' + brief.shape + ' with NO title/format/rating/metadata fields.');
    // Generous ceilings (NOT targets) — the model stops when the stage is done; a high cap only prevents premature
    // truncation of long stages. Every "heavy" long-form stage (scene maps, treatments, beat maps, drafts, narration,
    // step outlines, season arcs) gets a 25,000-token ceiling, is STREAMED (no single long blocking request, and no
    // non-streaming long-request ceiling), and runs on a 600s overall + 120s idle budget — so a busy provider has time
    // to finish a big generation, while a true stall aborts in ~2 min and fails over to the next engine.
    const MAXTOK: any = { LOGLINE: 600, SYNOPSIS: 2400, TREATMENT: 25000, BEATS: 25000, SCENES: 25000, STEP_OUTLINE: 25000, DRAFT: 25000, COVERAGE: 2000, SEASON_ARC: 25000, EPISODE_MAP: 25000, PREMISE: 2400, STORY_ENGINE: 3500, BEAT_ENGINE: 25000, THESIS: 2400, RESEARCH_PLAN: 4000, RIGHTS_PLAN: 3000, INTERVIEW_OUTLINE: 5000, PAPER_EDIT: 25000, NARRATION: 25000 };
    const HEAVY = ['SCENES', 'STEP_OUTLINE', 'DRAFT', 'TREATMENT', 'BEATS', 'EPISODE_MAP', 'BEAT_ENGINE', 'PAPER_EDIT', 'NARRATION', 'SEASON_ARC'];
    const heavy = HEAVY.indexOf(kind) >= 0;
    // Keep the per-stage ceiling (25k for the long stages); opts.maxTokens only overrides for tests.
    const cap = Number(opts?.maxTokens) > 0 ? Number(opts.maxTokens) : (MAXTOK[kind] || 3000);
    const res: any = await this.ai.run({ task: 'scripton.develop.' + kind.toLowerCase(), system: brief.system, user, maxTokens: cap, stream: heavy, timeoutMs: heavy ? 600000 : undefined, idleTimeoutMs: heavy ? 120000 : undefined, projectId, refType: 'Project', refId: projectId }); const ai: any = (res && res.json) || {};
    if (kind === 'BEATS' && !Array.isArray(ai.beats)) { const r = this.recoverStage(String((res && res.text) || '')); if (r.beats) ai.beats = r.beats; }
    if (kind === 'SCENES' && !Array.isArray(ai.scenes)) { const r = this.recoverStage(String((res && res.text) || '')); if (r.scenes) ai.scenes = r.scenes; }
    if (kind === 'STEP_OUTLINE' && !Array.isArray(ai.steps)) { const r = this.recoverStage(String((res && res.text) || '')); if (r.steps) ai.steps = r.steps; }
    // Continuation backstop — if a long array stage cut off mid-array, extend it to the
    // ending instead of silently persisting the partial (salvage alone left no cliffhanger).
    const ARRKEY: Record<string, string> = { SCENES: 'scenes', STEP_OUTLINE: 'steps' };
    if (ARRKEY[kind] && Array.isArray(ai[ARRKEY[kind]]) && ai[ARRKEY[kind]].length) {
      const ext = await this.extendStageArray({ kind, arrKey: ARRKEY[kind], system: brief.system, user, cap, firstRes: res, firstArr: ai[ARRKEY[kind]], projectId });
      ai[ARRKEY[kind]] = ext.arr;
      if (ext.warning) ai.__warning = ext.warning;
    }
    const data: any = {};
    if (Array.isArray(ai.beats)) data.beats = ai.beats;
    if (Array.isArray(ai.scenes)) data.scenes = ai.scenes;
    if (Array.isArray(ai.steps)) data.steps = ai.steps;
    if (ai.__warning) data.warning = ai.__warning; // persisted so a still-truncated outline is never silent
    const maxN = (stage.versions || []).reduce((m: number, v: any) => Math.max(m, v.n || 0), 0);
    const n = maxN + 1;
    const META = new Set(['title', 'format', 'rating', 'totalScenes', 'type', 'genre']);
    const flat = (v: any): string => { if (v == null) return ''; if (typeof v === 'string') return v; if (typeof v === 'number' || typeof v === 'boolean') return ''; if (Array.isArray(v)) return v.map(flat).filter(Boolean).join('\n\n'); if (typeof v === 'object') return Object.keys(v).filter((k) => !META.has(k)).map((k) => flat(v[k])).filter(Boolean).join('\n\n'); return String(v); };
    const stripFence = (t: string) => t.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
    let body = '';
    if (kind === 'BEATS' && Array.isArray(data.beats) && data.beats.length) {
      body = data.beats.map((b: any) => ('■ ' + String(b.name || b.beatName || '') + (b.beat ? ' — ' + b.beat : '') + (b.purpose ? '\n   ' + b.purpose : '')).trim()).filter(Boolean).join('\n\n');
    } else if (kind === 'SCENES' && Array.isArray(data.scenes) && data.scenes.length) {
      body = data.scenes.map((sc: any) => ((sc.sceneNumber ? sc.sceneNumber + '. ' : '') + String(sc.slugline || sc.location || 'Scene') + (sc.synopsis ? '\n' + sc.synopsis : '') + (sc.purpose ? '\n   Purpose: ' + sc.purpose : '')).trim()).join('\n\n');
    } else if (kind === 'STEP_OUTLINE' && Array.isArray(data.steps) && data.steps.length) {
      body = data.steps.map((st: any, j: number) => ((st.n ?? j + 1) + '. ' + String(st.text || st.scene || '')).trim()).join('\n\n');
    } else if (draftRaw) {
      body = (typeof ai.output === 'string' && ai.output.trim()) ? ai.output.trim() : stripFence(String((res && res.text) || ''));
    } else {
      body = flat(ai.output ?? ai.logline ?? ai.synopsis ?? ai.treatment ?? ai.draft ?? ai.text ?? ai.content).trim();
      if (!body) body = this.salvageProse(String((res && res.text) || '')) || stripFence(String((res && res.text) || ''));
    }
    if (/^[\[{][\s\S]*"(output|scenes|steps|beats)"\s*:/.test(body)) { try { const j: any = JSON.parse(body); const re = flat(j.output ?? j).trim(); if (re) body = re; } catch { /* leave as-is */ } }
    if (/^[\[{]/.test(body.trim())) { const sv = this.salvageProse(body); if (sv) body = sv; }
    if (!body) body = stripFence(String((res && res.text) || '').trim());
    if (!body) throw new BadRequestException('The model returned an empty draft for ' + kind + '. Try again - the prompt may be too long or the model was rate-limited.');
    const created: any = await (this.prisma as any).stageVersion.create({ data: { stageId: stage.id, n, title: kind.charAt(0) + kind.slice(1).toLowerCase().replace('_', ' ') + ' V' + n, body, data: Object.keys(data).length ? data : undefined, framework: opts?.framework || null, colorCode: this.WHEEL[(n - 1) % this.WHEEL.length], status: 'DRAFT', createdById: userId || null } });
    await (this.prisma as any).developmentStage.update({ where: { id: stage.id }, data: { currentVersionId: created.id } }).catch(() => {});
    if (kind === 'SCENES') { void this.generateCharacterBible(projectId, userId, opts?.buildId).catch(() => {}); }   // auto character breakdown the moment scenes land
    if (ai.__warning) (created as any).warning = ai.__warning; // surface in the HTTP response too
    return created;
  }

  // Build-phase research — Claude web search (tolerant), stored as context for every stage. Site URLs are stripped (never surfaced).
  async research(projectId: string): Promise<{ notes: string }> {
    const i: any = await (this.prisma as any).intakeProfile.findUnique({ where: { projectId } }).catch(() => null);
    if (!i) return { notes: '' };
    const focus = [i.realBased ? 'a real subject/history' : null, (Array.isArray(i.genres) && i.genres.length) ? ('genre ' + i.genres.join(', ')) : null, i.cultureEra || null, (Array.isArray(i.settingPlace) ? i.settingPlace.join(', ') : (i.settingPlace || null)), i.settingEra || null, i.country ? ('market ' + i.country) : null].filter(Boolean).join(' - ');
    const src = String(i.sourceText || '').slice(0, 2000);
    const sys = 'You are a development researcher for a film/TV project. Research the subject, real history, setting, period, culture and comparable titles. Return a TIGHT factual brief of ~250-400 words: key facts, authentic period/cultural detail, sensitivities to honour, and 4-6 comparable titles each with a one-line reason. No preamble, no headers, no URLs.';
    const user = 'PROJECT FOCUS: ' + (focus || 'contemporary drama') + '\nSOURCE (excerpt):\n' + src;
    let notes = '';
    try {
      const r: any = await this.ai.raw({ task: 'scripton.research', system: sys, messages: [{ role: 'user', content: user }], tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }] as any, maxTokens: 1600, projectId, refType: 'Project', refId: projectId });
      notes = String((r && r.text) || '').trim();
    } catch (e) { /* web search unavailable - fall back to knowledge */ }
    if (!notes) { try { notes = String(await this.ai.complete({ task: 'scripton.research.kb', system: sys + ' Use your own knowledge; do not fabricate citations.', user, maxTokens: 1600, projectId, refType: 'Project', refId: projectId })).trim(); } catch { notes = ''; } }
    notes = notes.replace(/https?:\/\/\S+/g, '').replace(/[ \t]{2,}/g, ' ').slice(0, 6000);
    try { await (this.prisma as any).intakeProfile.update({ where: { projectId }, data: { researchNotes: notes } }).catch(() => {}); } catch { /* */ }
    return { notes };
  }

  async getIntake(projectId: string) {
    return (this.prisma as any).intakeProfile.findUnique({ where: { projectId } }).catch(() => null);
  }

  // Allowlist the IntakeProfile columns. Extra Brief fields (baseGenre, subgenre, tones, moods, settingCountry,
  // market, name, …) live only in DevelopmentBuild.brief and must NOT reach this fixed-column upsert.
  // The promoted levers (LEVER_KEYS: scriptVariety/dialogueRegister/accents/styleMix/conflict/conflictId/
  // politicalArc) now have typed columns, so they ARE persisted here; reads still fall back to brief.
  private static readonly INTAKE_COLS = ['mode', 'sourceText', 'sourceUrl', 'sourceFileUrl', 'realBased', 'realityLevel', 'researchSubject', 'researchAmount', 'genres', 'tone', 'fantasyOn', 'fantasyType', 'mythicalElements', 'mythologyCulture', 'blendLevel', 'format', 'language', 'country', 'rating', 'length', 'comps', 'spine', 'constraints', 'researchScope', 'researchDepth', 'blendLayers', 'treatment', 'settingPlace', 'settingEra', 'settingWorld', 'cultureEra', 'sensitivityTier', 'guardrails', 'projectIntent', 'budgetTier', 'sourceKind', 'buildId', 'sources', 'projectType', 'episodes', 'minutesPerEp', 'seasons', 'loreSelections', 'loreDensity', 'lorePolicy', 'researchNotes', 'characterBible', ...LEVER_KEYS];
  async saveIntake(projectId: string, data: any) {
    const d: any = {}; for (const k of ScripOnService.INTAKE_COLS) { if (data && data[k] !== undefined) d[k] = data[k]; }
    return (this.prisma as any).intakeProfile.upsert({ where: { projectId }, create: { projectId, ...d }, update: d });
  }

  /** ScriptON Settings read model: project name + locale + collab mode + defaults. */
  async getScriptonSettings(projectId: string) {
    const pid = projectId || (await this.scriponWorkspace())?.id;
    if (!pid) return { name: '', language: null, collabMode: 'AUTO', defaults: {} };
    const proj: any = await (this.prisma as any).productionProject.findUnique({ where: { id: pid }, select: { title: true } }).catch(() => null);
    const ip: any = await (this.prisma as any).intakeProfile.findUnique({ where: { projectId: pid }, select: { language: true, collabMode: true, scriptonDefaults: true } }).catch(() => null);
    return { projectId: pid, name: proj?.title || '', language: ip?.language || null, collabMode: String(ip?.collabMode || 'AUTO').toUpperCase(), defaults: ip?.scriptonDefaults || {} };
  }

  /** Persist ScriptON settings. name → project; locale/collabMode/defaults → IntakeProfile (upsert). */
  async saveScriptonSettings(body: any) {
    const pid = body?.projectId || (await this.scriponWorkspace())?.id;
    if (!pid) throw new BadRequestException('No project to save settings for.');
    if (typeof body?.name === 'string' && body.name.trim()) {
      await (this.prisma as any).productionProject.update({ where: { id: pid }, data: { title: body.name.trim() } }).catch(() => {});
    }
    const data: any = {};
    if (typeof body?.language === 'string') data.language = body.language;
    if (typeof body?.collabMode === 'string') data.collabMode = String(body.collabMode).toUpperCase();
    if (body?.defaults && typeof body.defaults === 'object') data.scriptonDefaults = body.defaults;
    if (Object.keys(data).length) {
      await (this.prisma as any).intakeProfile.upsert({ where: { projectId: pid }, create: { projectId: pid, ...data }, update: data }).catch(() => {});
    }
    return this.getScriptonSettings(pid);
  }

  private async ensureLoreSeeded(): Promise<void> {
    try {
      // Idempotent: insert only seed rows whose slug isn't already in the DB, so NEW lore
      // (e.g. the Amalekites/ʿAmāliqah) appears on the next call without a destructive re-seed or duplicates.
      const existing: any[] = await (this.prisma as any).loreElement.findMany({ select: { slug: true } }).catch(() => []);
      const have = new Set((existing || []).map((r: any) => String(r.slug)));
      const rows = (LORE_SEED || [])
        .filter((r: any) => !have.has(String(r.slug)))
        .map((r: any) => ({ slug: r.slug, name: r.name, culture: r.culture, region: r.region || null, genres: r.genres || [], archetypes: r.archetypes || [], tier: r.tier || 'FOLKLORE', blurb: r.blurb || '', origin: r.origin || null, variants: r.variants || undefined, hooks: r.hooks || undefined, aliases: r.aliases || undefined, sources: r.sources || undefined }));
      if (rows.length) await (this.prisma as any).loreElement.createMany({ data: rows, skipDuplicates: true });
    } catch (e) { /* tolerant */ }
  }

  async loreLibrary(opts: any = {}): Promise<any[]> {
    await this.ensureLoreSeeded();
    const where: any = { active: true };
    if (opts.culture) where.culture = String(opts.culture);
    const allowPantheon = opts.pantheon === '1' || opts.pantheon === 1 || opts.pantheon === true;
    if (!allowPantheon) where.tier = { not: 'HISTORICAL_PANTHEON' };
    let rows: any[] = await (this.prisma as any).loreElement.findMany({ where, orderBy: [{ culture: 'asc' }, { name: 'asc' }] }).catch(() => []);
    const inArr = (v: any, t: string) => Array.isArray(v) && v.map((x: any) => String(x).toLowerCase()).includes(t);
    if (opts.genre) { const g = String(opts.genre).toLowerCase(); rows = rows.filter((r: any) => inArr(r.genres, g)); }
    if (opts.archetype) { const a = String(opts.archetype).toLowerCase(); rows = rows.filter((r: any) => inArr(r.archetypes, a)); }
    const q = String(opts.q || '').trim().toLowerCase();
    if (q) rows = rows.filter((r: any) => [r.name, r.blurb, r.culture].concat(Array.isArray(r.aliases) ? r.aliases : [], Array.isArray(r.archetypes) ? r.archetypes : []).join(' ').toLowerCase().includes(q));
    return rows;
  }

  private async intakeSteer(projectId: string): Promise<string> {
    const i: any = await (this.prisma as any).intakeProfile.findUnique({ where: { projectId } }).catch(() => null);
    if (!i) return '';
    const parts: string[] = [];
    if (i.realBased) parts.push('Based on a real story/subject; reality level = ' + (i.realityLevel || 'INSPIRED') + ' (how faithful vs invented).');
    if (Array.isArray(i.genres) && i.genres.length) parts.push('Genres: ' + i.genres.join(', ') + (i.tone ? ' | tone: ' + i.tone : '') + '.');
    if (i.fantasyOn) parts.push('Add a ' + (i.fantasyType || 'fantasy') + ' layer' + (Array.isArray(i.mythicalElements) && i.mythicalElements.length ? ' with ' + i.mythicalElements.join(', ') : '') + (i.mythologyCulture ? ', drawing mythology from ' + i.mythologyCulture : '') + '; balance = ' + (i.blendLevel || 'BALANCED') + ' (realistic vs mythic).');
    if (i.projectType) { const SERIES = ['TV_SERIES', 'VERTICAL', 'LIMITED']; const isSeries = SERIES.indexOf(String(i.projectType).toUpperCase()) >= 0; const RUNTIME: any = { MOVIE: 'feature film, one continuous ~90-120 min story (NOT episodic - no episodes/seasons)', SHORT: 'short film, under ~40 min, single story', DOC: 'documentary feature' }; const pt = isSeries ? [i.projectType, (i.episodes ? i.episodes + ' ep' : null), (i.minutesPerEp ? i.minutesPerEp + ' min/ep' : null), (i.seasons ? i.seasons + ' season(s)' : null)].filter(Boolean).join(' \u00b7 ') : (RUNTIME[String(i.projectType).toUpperCase()] || String(i.projectType)); parts.push('Format: ' + pt + '.'); }
    if (Array.isArray(i.loreSelections) && i.loreSelections.length) {
      const DENS: any = { ACCENT: 'Density ACCENT: lore is decorative only; premise/midpoint/climax stay grounded; never resolve a plot turn with lore (~10-20% of scenes).', SUBPLOT: 'Density SUBPLOT: lore powers a B-story or recurring motif; the A-plot stays grounded (~25-35% of scenes).', WOVEN: 'Density WOVEN: lore is a world-rule; the midpoint is lore-driven; premise & climax stay grounded (~40-50% of scenes).', DRIVER: 'Density DRIVER: lore is the central engine; inciting + midpoint + climax are lore-driven; the protagonist goal is defined by it (~60-80% of scenes).', SATURATED: 'Density SATURATED: full mythic mode; the world runs on the lore end-to-end; realism is the contrast (~80-100% of scenes).' };
      parts.push('LORE LAYER (steers genre/texture only \u2014 the Work source drives the story):');
      for (const s2 of i.loreSelections) { const w = Number(s2 && s2.weight) >= 3 ? 'spine' : 'accent'; parts.push('\u00b7 ' + ((s2 && s2.name) || (s2 && s2.slug) || 'element') + (s2 && s2.culture ? ' (' + s2.culture + ')' : '') + (s2 && s2.role ? ' \u2014 role ' + String(s2.role).toLowerCase().replace(/_/g, ' ') : '') + ', ' + w + '.'); }
      const dens = String(i.loreDensity || 'ACCENT').toUpperCase(); if (dens !== 'OFF') parts.push(DENS[dens] || DENS.ACCENT);
      const tiers = new Set((i.loreSelections || []).map((x: any) => String((x && x.tier) || '').toUpperCase()));
      if (tiers.has('SACRED_AWARE')) parts.push('Guardrail \u00b7 sacred-aware: treat sacred-rooted beings as folklore only; never depict, name, or voice a deity, prophet, or scripture.');
      if (tiers.has('CARE')) parts.push('Guardrail \u00b7 represent-with-care: crime/custom elements are authentic references, not caricature; avoid stereotype.');
      if (tiers.has('HISTORICAL_PANTHEON')) parts.push('Historical-pantheon figures are enabled for this project (flagged); treat as classical myth, not living faith.');
    }
    const gint = (i.lorePolicy && i.lorePolicy.genreIntensity && typeof i.lorePolicy.genreIntensity === 'object') ? i.lorePolicy.genreIntensity : null;
    if (gint) { const ks = Object.keys(gint); if (ks.length) { parts.push('GENRE INTENSITY (honour these dials consistently across EVERY stage - concept, synopsis, treatment, beats, scenes and draft; influence % = how heavily each weighs on the whole script):'); for (const k of ks) { const g: any = gint[k] || {}; const st = Array.isArray(g.styles) && g.styles.length ? '; action styles: ' + g.styles.join(', ') : ''; parts.push('\u00b7 ' + (g.name || k) + ' \u2014 presence ' + (g.presenceLabel || 'balanced') + ', intensity ' + (g.intensityLabel || 'moderate') + ', influence ' + (g.inf != null ? g.inf : 50) + '%' + st + '. Only introduce it when justified by story, genre, character and world.'); } } }
    const tex = (i.lorePolicy && Array.isArray(i.lorePolicy.texture)) ? i.lorePolicy.texture : [];
    if (tex.length) { parts.push('GENRE & TEXTURE LAYERS (legacy):'); for (const t of tex) parts.push('\u00b7 ' + ((t && t.name) || 'texture') + (t && t.ins ? ' \u2014 ' + t.ins : '') + '.'); }
    const tgt = [i.format, i.language, i.country ? ('market ' + i.country) : null, i.rating ? ('rating ' + i.rating) : null, i.length].filter(Boolean);
    if (tgt.length) parts.push('Target: ' + tgt.join(' | ') + '.');
    if (i.spine && typeof i.spine === 'object') { const s: any = i.spine; const sp = [s.want ? ('want ' + s.want) : null, s.need ? ('need ' + s.need) : null, s.opposing ? ('opposing ' + s.opposing) : null, s.theme ? ('theme ' + s.theme) : null, s.ending ? ('ending ' + s.ending) : null].filter(Boolean); if (sp.length) parts.push('Spine: ' + sp.join('; ') + '.'); }
    if (i.constraints && typeof i.constraints === 'object') { const c: any = i.constraints; const cs = [c.budget ? ('budget ' + c.budget) : null, c.maxLocations ? ('max ' + c.maxLocations + ' locations') : null, c.castSize ? ('cast ' + c.castSize) : null].filter(Boolean); if (cs.length) parts.push('Keep it filmable: ' + cs.join(', ') + '.'); }
    if (i.treatment) parts.push('Narrative treatment/style: ' + i.treatment + '.');
    if (Array.isArray(i.blendLayers) && i.blendLayers.length) parts.push('Blend layers over the base genre: ' + i.blendLayers.join(', ') + '.');
    { const place = [Array.isArray(i.settingPlace) ? i.settingPlace.join(', ') : (i.settingPlace || ''), i.settingEra || '', Array.isArray(i.settingWorld) ? i.settingWorld.join(', ') : (i.settingWorld || '')].filter(Boolean); if (place.length) parts.push('Setting/world: ' + place.join(' | ') + '.'); }
    if (i.cultureEra) parts.push('Culture/era: ' + i.cultureEra + '.');
    if (i.projectIntent) parts.push('Project intent: ' + i.projectIntent + '.');
    if (i.budgetTier) parts.push('Budget scope: ' + i.budgetTier + ' — keep it filmable within this tier.');
    { const tier = String(i.sensitivityTier || '').trim(); const g: any = i.guardrails || {}; if (tier === '1' || g.sacred || g.tier1 || /SACRED|PROPHET|ISLAM/i.test(String(i.cultureEra || ''))) { parts.push('SACRED-CONTENT HARD RULES (never violate): do NOT depict, name, voice, or write dialogue for God, any deity, or any prophet (Muhammad, Jesus, Moses, Abraham) — convey via narration, POV, off-screen, or light/veil. No scripture as character speech (paraphrase and attribute, never alter sacred text). No mockery, desecration, or sexualisation of the sacred. Folklore beings (djinn, ghoul, ifrit, marid) are allowed. If a request would breach these, REDIRECT to the compliant alternative rather than refuse.'); } }
    return parts.length ? ('\nCREATIVE BRIEF (honour throughout):\n- ' + parts.join('\n- ')) : '';
  }

  async setStageVersion(stageId: string, versionId: string) {
    await (this.prisma as any).developmentStage.update({ where: { id: stageId }, data: { currentVersionId: versionId } });
    return { ok: true };
  }

  async duplicateVersion(versionId: string, userId?: string, label?: string) {
    const v: any = await (this.prisma as any).stageVersion.findUnique({ where: { id: versionId } });
    if (!v) throw new BadRequestException('Version not found.');
    const agg: any = await (this.prisma as any).stageVersion.aggregate({ where: { stageId: v.stageId }, _max: { n: true } }).catch(() => null);
    const n = (((agg && agg._max && agg._max.n) || v.n) as number) + 1;
    return (this.prisma as any).stageVersion.create({ data: { stageId: v.stageId, n, title: label || ((v.title || 'Version') + ' (copy)'), body: v.body, data: v.data ?? undefined, framework: v.framework, colorCode: this.WHEEL[(n - 1) % this.WHEEL.length], status: 'DRAFT', createdById: userId || null } });
  }

  async promoteVersion(versionId: string, status: string) {
    const s = String(status || 'APPROVED').toUpperCase();
    if (!['DRAFT', 'REVIEW', 'APPROVED', 'LOCKED'].includes(s)) throw new BadRequestException('Invalid status.');
    return (this.prisma as any).stageVersion.update({ where: { id: versionId }, data: { status: s } });
  }

  async compareVersions(a: string, b: string) {
    const [va, vb] = await Promise.all([
      (this.prisma as any).stageVersion.findUnique({ where: { id: a } }).catch(() => null),
      (this.prisma as any).stageVersion.findUnique({ where: { id: b } }).catch(() => null),
    ]);
    return { a: va || null, b: vb || null };
  }

  // Coverage-as-a-gate: a quick grounded read before a stage advances.
  async stageRead(versionId: string) {
    const v: any = await (this.prisma as any).stageVersion.findUnique({ where: { id: versionId } });
    if (!v) throw new BadRequestException('Version not found.');
    const system = 'You are a development executive giving a quick GATE READ before this development stage is approved. Be specific and honest. Return ONLY JSON {verdict, strengths:[string], concerns:[string], note}. verdict is GO|REVISE|HOLD.';
    const user = 'STAGE BODY:\n' + String(v.body || '').slice(0, 8000);
    const ai: any = (await this.ai.json({ task: 'scripton.develop.read', system, user, maxTokens: 1200, refType: 'StageVersion', refId: versionId })) || {};
    return { verdict: ai.verdict || 'REVISE', strengths: Array.isArray(ai.strengths) ? ai.strengths : [], concerns: Array.isArray(ai.concerns) ? ai.concerns : [], note: ai.note || '' };
  }

  // ── Production hand-off: hierarchical, scene-by-scene feature generation (async + live progress). ──
  private genProgress = new Map<string, { status: string; done: number; total: number; pageCount: number; error?: string; coverage?: string; coverageNote?: string }>();

  scriptProgress(documentId: string) {
    return this.genProgress.get(documentId) || { status: 'UNKNOWN', done: 0, total: 0, pageCount: 0 };
  }

  // Page estimate by VISUAL lines (action wraps ~58 chars) at ~55 lines/page — realistic screenplay paging.
  private paginate(text: string): { page: number; text: string }[] {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const per = 55; const pages: { page: number; text: string }[] = [];
    let cur: string[] = []; let count = 0;
    for (const ln of lines) {
      const vis = Math.max(1, Math.ceil((ln.length || 1) / 58));
      if (count + vis > per && cur.length) { pages.push({ page: pages.length + 1, text: cur.join('\n') }); cur = []; count = 0; }
      cur.push(ln); count += vis;
    }
    if (cur.length) pages.push({ page: pages.length + 1, text: cur.join('\n') });
    if (!pages.length) pages.push({ page: 1, text: '' });
    return pages;
  }

  // Render finished print HTML → a real A4 PDF via headless Chromium (server-side). Used for Arabic
  // (and any) one-click download where client-side pdf-lib can't shape the glyphs. Graceful if puppeteer absent.
  async renderPdf(html: string): Promise<Buffer> {
    if (!html || typeof html !== 'string') throw new BadRequestException('html is required');
    const pkg = 'pup' + 'peteer';
    let mod: any = null;
    try { mod = await import(pkg as any); } catch { mod = null; }
    const puppeteer: any = mod && (mod.default || mod);
    if (!puppeteer || !puppeteer.launch) { const e: any = new Error('PDF renderer not installed. In the backend folder run:  npm i puppeteer'); e.code = 'NO_PUPPETEER'; throw e; }
    // Prefer an already-installed, AV-trusted browser (Chrome / Edge) over puppeteer's downloaded Chrome-for-Testing
    // build, which Windows Defender frequently quarantines (folder present but chrome.exe deleted). Edge ships with
    // Windows so it is effectively always available; fall back to puppeteer's bundled browser if none is found.
    const fsx: any = require('fs');
    const candidates: string[] = [
      process.env.PUPPETEER_EXECUTABLE_PATH || '',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      (process.env.LOCALAPPDATA ? process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe' : ''),
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/microsoft-edge',
    ].filter(Boolean);
    let execPath = '';
    for (const c of candidates) { try { if (c && fsx.existsSync(c)) { execPath = c; break; } } catch { /* */ } }
    const launchOpts: any = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };
    if (execPath) launchOpts.executablePath = execPath;
    let browser: any;
    try { browser = await puppeteer.launch(launchOpts); }
    catch (le: any) {
      // No usable browser. Most often Defender removed puppeteer's downloaded Chromium — using installed Chrome/Edge avoids it.
      const e: any = new Error('The PDF renderer could not launch a browser. Install Google Chrome (recommended), or in the backend folder run:  npx puppeteer browsers install chrome');
      e.code = 'NO_CHROMIUM'; e.detail = le && le.message ? String(le.message).slice(0, 300) : undefined; throw e;
    }
    try {
      const page = await browser.newPage();
      // Don't wait for networkidle0 — webfonts (Amiri/Courier Prime via CDN) can hang headless and time out → 500.
      try { await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 20000 }); } catch { /* render whatever parsed */ }
      // Give webfonts a bounded chance (max ~2.5s), then proceed regardless; Arabic still shapes via system fallback.
      try { await page.evaluate('new Promise(function(res){var d=(document.fonts&&document.fonts.ready)||Promise.resolve();Promise.race([d,new Promise(function(r){setTimeout(r,2500);})]).then(function(){res();});})'); } catch { /* */ }
      const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
      return Buffer.from(pdf);
    } finally { try { await browser.close(); } catch { /* */ } }
  }

  // Is this build's SCRIPT language Arabic? (script language ≠ UI language)
  private isArabicBrief(brief: any): boolean {
    const s = String((brief && (brief.language || brief.scriptLanguage || brief.scriptVariety)) || '').toLowerCase();
    return s === 'ar' || s.startsWith('ar-') || s.startsWith('ar_') || s.includes('arabic') || /[؀-ۿ]/.test(s);
  }

  // Deterministic FINAL DRAFT slug line from a scene card (numbering/INT-EXT/day-night guaranteed, not left to the model).
  // Arabic builds get a NATIVE Arabic heading (داخلي/خارجي · ليل/نهار) so the source is clean Arabic, never bilingual.
  private slugOf(sc: any, ar = false): string {
    if (ar) {
      const ieR = String(sc.intExt || '').toLowerCase();
      const ie = /ext|خارج/.test(ieR) ? (/int|داخل/.test(ieR) ? 'داخلي/خارجي' : 'خارجي') : 'داخلي';
      const loc = String(sc.location || sc.setName || sc.where || 'الموقع').replace(/\s+/g, ' ').trim().slice(0, 60) || 'الموقع';
      const dnR = String(sc.dayNight || sc.dn || '').toLowerCase();
      const dn = /night|ليل/.test(dnR) ? 'ليل' : /dawn|فجر/.test(dnR) ? 'فجر' : /dusk|evening|غروب|مساء/.test(dnR) ? 'مساء' : /morning|صباح/.test(dnR) ? 'صباح' : 'نهار';
      return ie + ' - ' + loc + ' - ' + dn;
    }
    const ie = (String(sc.intExt || 'INT').toUpperCase().match(/INT\/EXT|I\/E|EXT|INT/) || ['INT'])[0].replace('I/E', 'INT/EXT');
    const loc = String(sc.location || sc.setName || sc.where || 'LOCATION').toUpperCase().replace(/\s+/g, ' ').trim().slice(0, 48) || 'LOCATION';
    const dn = (String(sc.dayNight || sc.dn || 'DAY').toUpperCase().match(/DAWN|DUSK|MIDDAY|NOON|AFTERNOON|MORNING|EVENING|NIGHT|CONTINUOUS|LATER|DAY/) || ['DAY'])[0];
    return ie + '. ' + loc + ' - ' + dn;
  }

  // Guarantee numbered sluglines in any draft text — so a feature is never filed without scene headings.
  private ensureSluglines(text: string): string {
    const t = String(text || '').trim();
    if (!t) return t;
    const ar = (t.match(/[؀-ۿ]/g) || []).length > (t.match(/[A-Za-z]/g) || []).length;
    const SLUG = /^\s*(?:\d+[A-Z]?[.)]?\s+)?(INT|EXT|INT\.?\/EXT|I\/E|EST)[.\s]/i;
    const AR_SLUG = /^\s*(?:\d+\s+)?(?:مشهد|المشهد|داخلي|خارجي)/;
    const ls = t.split('\n');
    if (!ls.some((ln) => SLUG.test(ln) || AR_SLUG.test(ln))) return (ar ? '1  داخلي - الموقع - نهار\n\n' : '1  INT./EXT. SCENE - DAY\n\n') + t;
    let n = 0;
    return ls.map((ln) => (SLUG.test(ln) || AR_SLUG.test(ln)) ? (++n) + '  ' + ln.trim().replace(/^\d+[A-Z]?[.)]?\s+/, '') : ln).join('\n');
  }

  // Normalised scene cards from the developed SCENES (preferred — carries INT/EXT, location, day/night) or STEP_OUTLINE.
  private sceneCards(stages: any[]): any[] {
    const find = (k: string) => stages.find((s: any) => s.kind === k);
    const sc: any = find('SCENES');
    const scenes: any[] = sc && sc.current && sc.current.data && Array.isArray(sc.current.data.scenes) ? sc.current.data.scenes : [];
    if (scenes.length) return scenes.map((s: any) => ({ intExt: s.intExt, location: s.location || s.setName, dayNight: s.dayNight, brief: [s.synopsis, s.purpose ? 'Goal: ' + s.purpose : '', s.conflict ? 'Conflict: ' + s.conflict : '', s.stakes ? 'Stakes: ' + s.stakes : ''].filter(Boolean).join(' '), characters: Array.isArray(s.characters) ? s.characters.join(', ') : String(s.characters || '') }));
    const st: any = find('STEP_OUTLINE');
    const steps: any[] = st && st.current && st.current.data && Array.isArray(st.current.data.steps) ? st.current.data.steps : [];
    if (steps.length) return steps.map((s: any) => ({ intExt: '', location: s.scene || '', dayNight: '', brief: String(s.text || s.scene || ''), characters: '' }));
    return [];
  }

  private async buildFeatureCtx(projectId: string, stages: any[], directive = ''): Promise<string> {
    const steer = await this.intakeSteer(projectId);
    const intakeRow: any = await (this.prisma as any).intakeProfile.findUnique({ where: { projectId } }).catch(() => null);
    const research = String((intakeRow && intakeRow.researchNotes) || '').slice(0, 2400);
    const bodyOf = (k: string) => { const x: any = stages.find((y: any) => y.kind === k); return String((x && x.current && x.current.body) || ''); };
    return (directive ? directive + '\n' : '') + (steer ? steer + '\n' : '') + (research ? '\nRESEARCH (honour for authenticity):\n' + research + '\n' : '') + '\nLOGLINE: ' + bodyOf('LOGLINE').slice(0, 400) + '\nSYNOPSIS:\n' + bodyOf('SYNOPSIS').slice(0, 1400) + '\nTREATMENT:\n' + bodyOf('TREATMENT').slice(0, 2600) + '\nBEAT MAP:\n' + bodyOf('BEATS').slice(0, 2200);
  }

  // The FULL developed outline, for scene PLANNING — generous limits so the planner sees the whole story
  // (incl. the finale). buildFeatureCtx is kept lean for per-scene writing; planning needs the complete spine.
  private buildSpine(stages: any[]): string {
    const bodyOf = (k: string) => { const x: any = stages.find((y: any) => y.kind === k); return String((x && x.current && x.current.body) || ''); };
    const parts = [
      bodyOf('SYNOPSIS') && ('SYNOPSIS:\n' + bodyOf('SYNOPSIS').slice(0, 4000)),
      bodyOf('TREATMENT') && ('TREATMENT:\n' + bodyOf('TREATMENT').slice(0, 9000)),
      bodyOf('BEATS') && ('BEAT MAP:\n' + bodyOf('BEATS').slice(0, 9000)),
      bodyOf('STEP_OUTLINE') && ('STEP OUTLINE:\n' + bodyOf('STEP_OUTLINE').slice(0, 9000)),
    ].filter(Boolean) as string[];
    return parts.join('\n\n').slice(0, 20000);
  }

  // How many beats the developed story has (so we can tell whether an existing SCENES list actually covers it).
  private countBeats(stages: any[]): number {
    const cur = (k: string) => { const x: any = stages.find((y: any) => y.kind === k); return x && x.current; };
    const b: any = cur('BEATS'); const so: any = cur('STEP_OUTLINE');
    const n = (b && b.data && Array.isArray(b.data.beats) && b.data.beats.length) || (so && so.data && Array.isArray(so.data.steps) && so.data.steps.length) || 0;
    if (n) return n;
    const txt = String((b && b.body) || (so && so.body) || '');
    const m = txt.match(/^\s*\d+[.)،]/gm); return m ? m.length : 0;   // numbered lines (Latin or Arabic comma)
  }

  // Plan the COMPLETE feature scene map by faithfully expanding the developed outline — every beat IN ORDER through
  // the climax AND resolution, never stopping mid-story. Tolerant JSON parse + a continuation pass if it comes short.
  // `episode` (#45): map ONE pilot episode at the format's per-episode scene density instead of a
  // full feature — so a series targets its real per-episode volume, not the 55-90 feature band.
  private async planScenes(ctx: string, projectId: string, spine = '', target = 55, episode = false): Promise<any[]> {
    const lo = episode ? target : Math.max(50, target); const hi = episode ? target + 6 : Math.max(70, target + 18);
    const sys = episode
      ? 'You are a screenwriter mapping the FIRST EPISODE (the pilot) of a series into ' + lo + '-' + hi + ' scenes. Open the series, establish the world / lead characters / central engine, and END on the episode hook or cliffhanger. Use the OPENING movement of the developed outline only — do NOT compress the whole season, and do NOT resolve the season arc. Return ONLY JSON {scenes:[{intExt, location, dayNight, brief, characters}]} — intExt is INT or EXT; dayNight DAY or NIGHT; brief = 1-2 sentences of what happens; characters = comma list. No prose outside the JSON.'
      : 'You are a screenwriter mapping a DEVELOPED story into a COMPLETE feature scene list for a ~100-120 page, 3-act script. Faithfully expand the GIVEN OUTLINE / BEAT MAP into ' + lo + '-' + hi + ' scenes that cover the ENTIRE story IN ORDER — from the opening beat through the midpoint, the climax AND the final resolution. EVERY numbered beat in the outline MUST be represented (1-3 scenes each), and the LAST few scenes MUST dramatise the final beats (the climax and ending). Never stop in the middle of the story. Return ONLY JSON {scenes:[{intExt, location, dayNight, brief, characters}]} — intExt is INT or EXT; dayNight DAY or NIGHT; brief = 1-2 sentences of what happens; characters = comma list. No prose outside the JSON.';
    const base = (extra: string) => ctx + (spine ? '\n\n' + (episode ? 'DEVELOPED OUTLINE (dramatise its OPENING as the pilot episode):\n' : 'FULL DEVELOPED OUTLINE TO COVER (expand every beat, in order, all the way to the end):\n') + spine : '') + extra;
    const parse = (r: any): any[] => {
      let arr: any[] = (r && r.json && Array.isArray(r.json.scenes)) ? r.json.scenes : [];
      if (!arr.length && r && typeof r.text === 'string') { try { const m = r.text.match(/\{[\s\S]*\}/); if (m) { const j = JSON.parse(m[0]); if (Array.isArray(j.scenes)) arr = j.scenes; } } catch { /* */ } }
      return arr.map((s: any) => ({ intExt: s.intExt, location: s.location, dayNight: s.dayNight, brief: String(s.brief || ''), characters: Array.isArray(s.characters) ? s.characters.join(', ') : String(s.characters || '') }));
    };
    let scenes: any[] = [];
    try {
      const r: any = await this.ai.run({ task: 'scripton.feature.plan', system: sys, user: base(episode ? '\nMap the PILOT episode now (' + lo + '-' + hi + ' scenes), ending on the episode cliffhanger.' : '\nMap the FULL story now (' + lo + '-' + hi + ' scenes), ending on the final beat.'), maxTokens: 15000, timeoutMs: 230000, projectId, refType: 'Project', refId: projectId });
      scenes = parse(r);
    } catch { /* fall through */ }
    // Continuation passes: a single call truncates at the token cap, so keep extending (from the last 3 scenes) until
    // the map reaches feature length AND the final beat — or a pass stops adding scenes — or we hit the ceiling.
    let passes = 0;
    while (spine && scenes.length && scenes.length < lo && passes < 5) {
      passes++; const before = scenes.length;
      try {
        const tail = scenes.slice(-3).map((s: any) => '- ' + String(s.brief || '')).join('\n');
        const cont: any = await this.ai.run({ task: 'scripton.feature.plan', system: sys, user: base('\nYou have already mapped ' + scenes.length + ' scenes, ending with:\n' + tail + (episode ? '\nContinue the SAME pilot episode toward ~' + lo + ' scenes, ending on the episode cliffhanger — do NOT repeat earlier scenes. Return ONLY JSON {scenes:[...]} for the REMAINING scenes.' : '\nContinue the scene map from the NEXT beat through the FINAL beat (climax + resolution) — do NOT repeat earlier scenes. Return ONLY JSON {scenes:[...]} for the REMAINING scenes.')), maxTokens: 15000, timeoutMs: 230000, projectId, refType: 'Project', refId: projectId });
        const more = parse(cont); if (more.length) scenes = scenes.concat(more);
      } catch { /* */ }
      if (scenes.length <= before) break;
    }
    return scenes.slice(0, 100);
  }

  // Coverage guard: did the finished script actually reach the outline's FINAL beats (climax + resolution)?
  // One small, tolerant AI check — any failure assumes complete, so it never raises a false alarm.
  private async verifyEnding(spine: string, scriptTail: string, projectId: string): Promise<{ complete: boolean; note: string }> {
    if (!spine || !scriptTail) return { complete: true, note: '' };
    try {
      const sys = 'You verify whether a screenplay reached its planned ENDING. Given a developed OUTLINE (whose FINAL beats are the intended climax and resolution) and the LAST pages of the generated script, decide whether the script actually dramatises those final beats. Return ONLY JSON {complete: true|false, note: "one short sentence"}.';
      const user = 'OUTLINE (its ending = the final beats):\n' + spine.slice(-3000) + '\n\nLAST PAGES OF THE GENERATED SCRIPT:\n' + scriptTail.slice(-3000) + '\n\nDoes the script reach the outline\'s final beats (the climax and resolution)?';
      const r: any = await this.ai.run({ task: 'scripton.feature.coverage', system: sys, user, maxTokens: 300, timeoutMs: 60000, projectId, refType: 'Project', refId: projectId });
      let j: any = (r && r.json) || null;
      if (!j && r && typeof r.text === 'string') { try { const m = r.text.match(/\{[\s\S]*\}/); if (m) j = JSON.parse(m[0]); } catch { /* */ } }
      if (j && typeof j.complete === 'boolean') return { complete: j.complete, note: String(j.note || '').slice(0, 200) };
    } catch { /* */ }
    return { complete: true, note: '' };
  }

  // Write ONE full scene (action + dialogue) — slug line is supplied, so the model focuses on dramatising.
  private async writeScene(ctx: string, sc: any, header: string, storySoFar: string, prevTail: string, projectId: string): Promise<string> {
    const sys = 'You are a professional screenwriter writing ONE scene of a feature film in industry-standard FINAL DRAFT format. Present-tense action lines; dialogue formatted as a centred UPPERCASE CHARACTER cue on its own line, an optional (parenthetical), then the spoken line beneath; use (V.O.)/(O.S.)/(CONT\'D) where apt. Give the scene real emotion, subtext and conflict, and a small turn. Write it IN FULL - about 1.5 to 2.5 pages - never a summary or outline. Do NOT write the scene heading/slug line (it is already provided) and do NOT add a scene number. Output ONLY the scene text.';
    const user = ctx + (storySoFar ? '\n\nSTORY SO FAR (continuity - do not repeat):' + storySoFar : '') + (prevTail ? '\n\nPREVIOUS SCENE ENDED WITH (continue naturally, do not repeat):\n' + prevTail : '') + '\n\nSCENE HEADING (already set, do not rewrite): ' + header + '\nWHAT HAPPENS: ' + (sc.brief || 'Advance the story with conflict and a turn.') + (sc.characters ? '\nCHARACTERS PRESENT: ' + sc.characters : '') + '\n\nWrite this scene in full now.';
    const clean = (raw: string) => raw
      .replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim()
      .replace(/^\s*\d*\s*(INT|EXT|INT\.?\/EXT|I\/E)[.\s][^\n]*\n?/i, '').trim()
      .replace(/^\s*(?:\d+\s+)?(?:مشهد|المشهد|داخلي|خارجي)[^\n]*\n?/u, '').trim()   // strip a leading Arabic slug the model may add on top of ours
      .replace(/^[ \t]*[-–—_=]{2,}[ \t]*$/gmu, '').replace(/\n{3,}/g, '\n\n').trim();   // drop "---" separator lines
    // Retry transient failures (timeout / rate-limit / empty return) before falling
    // back to the stub — a whole run of stubs is the bug we are hardening against.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r: any = await this.ai.run({ task: 'scripton.feature.scene', system: sys, user, maxTokens: 8000, temperature: 0.85, timeoutMs: 120000, projectId, refType: 'Project', refId: projectId });
        const txt = clean(String((r && r.text) || ''));
        if (txt) return txt;
      } catch { /* transient — retry */ }
    }
    return SCENE_STUB;
  }

  // Half-or-more scenes stubbed = the AI never returned prose (a transient outage),
  // not a real draft. Used to fail the run instead of silently filing stubs as DONE.
  private mostlyStub(stubs: number, total: number): boolean {
    return total > 0 && stubs / total >= 0.5;
  }

  // Mark a wholesale-stub generation as ERROR (not DONE) and replace the partial stub
  // pages with an honest, actionable placeholder. On regenerate the caller only swaps
  // the active revision on DONE, so the previous real draft (if any) survives untouched.
  private async failStubRun(docId: string, revId: string, stubs: number, total: number): Promise<void> {
    const p = this.genProgress.get(docId);
    if (p) { p.status = 'ERROR'; p.error = `Scene generation returned no prose for ${stubs} of ${total} scenes.`; }
    const text = 'FADE IN:\n\n(Scene generation did not return prose — ' + stubs + ' of ' + total + ' scenes came back empty. The draft was NOT filed as complete. Open the build in ScripON Studio and run "Generate script" again.)';
    await (this.prisma as any).scriptRevision.update({ where: { id: revId }, data: { pageText: [{ page: 1, text }], pageCount: 1 } }).catch(() => {});
  }

  private async generateFeatureAsync(docId: string, revId: string, projectId: string, stages: any[], existing: any[]): Promise<void> {
    try {
      const bRow: any = await (this.prisma as any).developmentBuild.findFirst({ where: { linkedScriptId: docId } }).catch(() => null);
      const featBrief = (bRow && bRow.brief) || {};
      const featDirective = [await this.langDirective(featBrief), knowledgeDirective(featBrief)].filter(Boolean).join('\n');
      const ctx = await this.buildFeatureCtx(projectId, stages, featDirective);
      const ar = this.isArabicBrief((bRow && bRow.brief) || {});
      // Build the scene list that drives the whole script. The old bug: it trusted any existing SCENES list of
      // >= 20 cards and stopped there — so a partial SCENES stage (e.g. 20 cards covering only the first ~2/3)
      // produced a script that ended mid-story. Now we plan the FULL feature from the complete developed outline,
      // and only reuse the existing SCENES cards when they actually cover the whole story (>= beat count).
      const spine = this.buildSpine(stages);
      const beatN = this.countBeats(stages);
      // ALWAYS plan the full feature from the COMPLETE developed outline (synopsis+treatment+beats+step-outline),
      // then take the LARGER of the plan vs the existing SCENES cards. The old "existing.length >= 30 = complete"
      // shortcut trusted a token-truncated ~35-card SCENES stage and skipped planning → scripts ended mid-story.
      // #45: a SERIES targets its per-episode scene density (the pilot episode), not the feature band.
      const isSeries = ['TV_SERIES', 'LIMITED'].indexOf(String(featBrief.projectType || '').toUpperCase()) >= 0;
      const ssc = isSeries ? seriesSceneCount(featBrief.episodes, featBrief.minutesPerEp) : null;
      const target = ssc ? ssc.scenesPerEp : Math.min(90, Math.max(55, beatN ? Math.round(beatN * 1.5) : 60));
      const planned = await this.planScenes(ctx, projectId, spine, target, !!ssc);
      // Series: use the planned pilot at episode density (don't let a full-season SCENES stage override it).
      let scenes: any[] = ssc ? planned : ((planned.length >= (existing ? existing.length : 0)) ? planned : existing);
      if (!scenes || !scenes.length) scenes = (existing && existing.length) ? existing : planned;
      const setP = (patch: any) => { const p = this.genProgress.get(docId); if (p) Object.assign(p, patch); };
      const saveRev = async (pages: any[]) => { await (this.prisma as any).scriptRevision.update({ where: { id: revId }, data: { pageText: pages, pageCount: pages.length } }).catch(() => {}); };
      if (!scenes.length) {
        const bodyOf = (k: string) => { const x: any = stages.find((y: any) => y.kind === k); return String((x && x.current && x.current.body) || ''); };
        const pages = this.paginate(this.ensureSluglines(bodyOf('DRAFT')) || 'No developed material to expand into a feature yet.');
        await saveRev(pages); setP({ status: 'DONE', total: pages.length, done: pages.length, pageCount: pages.length });
        return;
      }
      setP({ total: scenes.length });
      const out: string[] = ['FADE IN:'];
      let storySoFar = ''; let prevTail = ''; let stubs = 0;
      for (let i = 0; i < scenes.length; i++) {
        const sc = scenes[i];
        const header = (i + 1) + '  ' + this.slugOf(sc, ar);
        const body = await this.writeScene(ctx, sc, header, storySoFar.slice(-1600), prevTail.slice(-700), projectId);
        if (body === SCENE_STUB) stubs++;
        out.push(header + '\n\n' + body);
        prevTail = body.slice(-700);
        storySoFar = (storySoFar + '\n' + (i + 1) + '. ' + String(sc.brief || '').slice(0, 150)).slice(-2400);
        if (i % 3 === 0 || i === scenes.length - 1) { const pages = this.paginate(out.join('\n\n') + '\n\nFADE OUT.'); await saveRev(pages); setP({ done: i + 1, pageCount: pages.length }); }
        else setP({ done: i + 1 });
      }
      // Wholesale scene-writing failure: if half-or-more scenes came back as stubs, the AI
      // did not actually write prose (transient outage). Do NOT file an all-stub script as
      // DONE — mark ERROR so the bridge skips it and (on regenerate) the old draft survives.
      if (this.mostlyStub(stubs, scenes.length)) { await this.failStubRun(docId, revId, stubs, scenes.length); return; }
      out.push('FADE OUT.');
      const pages = this.paginate(out.join('\n\n'));
      await saveRev(pages);
      if (ssc) {
        // #45: a series build delivers the PILOT episode at its per-episode density; the full season
        // is episodes × per-ep. Don't run the feature ending-check (the pilot ends on a cliffhanger).
        setP({ status: 'DONE', done: scenes.length, pageCount: pages.length, coverage: 'COMPLETE', scenesPerEp: ssc.scenesPerEp, seasonScenes: ssc.seasonScenes, coverageNote: 'Pilot episode: ' + scenes.length + ' scenes at ~' + featBrief.minutesPerEp + ' min/ep · full season ≈ ' + ssc.seasonScenes + ' scenes (' + ssc.episodes + ' ep × ' + ssc.scenesPerEp + ').' });
      } else {
        // Belt-and-suspenders: confirm the finished feature actually reaches the outline's ending; flag it if not.
        const cov = await this.verifyEnding(spine, out.slice(-4).join('\n\n'), projectId);
        setP({ status: 'DONE', done: scenes.length, pageCount: pages.length, coverage: cov.complete ? 'COMPLETE' : 'SHORT', coverageNote: cov.note });
      }
    } catch (e: any) {
      const msg = String((e && e.message) || e).slice(0, 200);
      const p = this.genProgress.get(docId); if (p) { p.status = 'ERROR'; p.error = msg; }
      // Don't leave the misleading "being written…" placeholder forever — write an honest, actionable message.
      try { await (this.prisma as any).scriptRevision.update({ where: { id: revId }, data: { pageText: [{ page: 1, text: 'FADE IN:\n\n(The automatic feature generation did not finish:\n' + msg + '\n\nOpen this build in ScripON Studio and run "Generate script" again, or press Retry.)' }], pageCount: 1 } }); } catch { /* */ }
    }
  }

  // Dispatch the production hand-off writer by FORMAT: feature/series → scene-by-scene; vertical → episode-by-episode; documentary → narration.
  private async generateScriptAsync(docId: string, revId: string, projectId: string, stages: any[], existing: any[]): Promise<void> {
    const bRow: any = await (this.prisma as any).developmentBuild.findFirst({ where: { linkedScriptId: docId } }).catch(() => null);
    const brief = (bRow && bRow.brief) || {};
    const fam = normalizeFamily(brief);
    if (fam === 'VERTICAL') await this.generateVerticalAsync(docId, revId, projectId, stages, brief);
    else if (fam === 'DOCUMENTARY') await this.generateDocumentaryAsync(docId, revId, projectId, stages, brief);
    else await this.generateFeatureAsync(docId, revId, projectId, stages, existing);
    // Develop→ScriptScene bridge: only on a clean finish (a failed/short run wrote
    // an error placeholder into pageText — don't materialise scenes from that).
    if (this.genProgress.get(docId)?.status === 'DONE') await this.materialiseScenes(revId, projectId);
  }

  /**
   * Develop→ScriptScene bridge. The develop/render path writes the screenplay into
   * `ScriptRevision.pageText` (+ BuildVersion + CanonFacts) but creates no ScriptScene
   * rows — so developed scripts rendered empty (and used to fall back to a sample).
   * This parses the finished revision's pageText (the SAME parser the import path uses,
   * now Arabic-aware) into ScriptScene rows so the Reader/Doctor/Room see real scenes.
   * Idempotent (skips when scenes already exist) and parity with import (headings +
   * page boundaries; no body — scene bodies live in pageText, not ScriptScene). Also
   * used to backfill already-generated revisions.
   */
  async materialiseScenes(revisionId: string, projectId: string): Promise<number> {
    try {
      const existing = await (this.prisma as any).scriptScene.count({ where: { revisionId } });
      if (existing > 0) return 0;
      const rev: any = await (this.prisma as any).scriptRevision.findUnique({ where: { id: revisionId }, select: { pageText: true } });
      const pageText: any = rev && rev.pageText;
      const pages: string[] = Array.isArray(pageText) ? pageText.map((p: any) => String((p && p.text) || '')) : [];
      if (!pages.length) return 0;
      const scenes = parseScenes(pages);
      if (!scenes.length) return 0;
      await (this.prisma as any).scriptScene.createMany({ data: scenes.map((s, i) => ({ revisionId, projectId, sortOrder: i, ...s })) });
      return scenes.length;
    } catch { return 0; }
  }

  // Parse an EPISODE_MAP / BEAT_ENGINE prose body into ordered episode descriptors.
  private parseEpisodes(text: string): { n: number; title: string; text: string }[] {
    const out: { n: number; title: string; text: string }[] = [];
    for (const ln of String(text || '').replace(/\r/g, '').split('\n')) {
      const m = ln.match(/^\s*(?:EP|EPISODE|الحلقة|حلقة)?\s*(\d+)\s*[—:\-.)،]\s*(.+)$/u);
      if (m) { const rest = m[2].trim(); const title = (rest.split(/[—:\-]/)[0] || '').trim().slice(0, 80); out.push({ n: Number(m[1]), title, text: rest }); }
    }
    return out;
  }

  // Vertical micro-drama: write the first ~10-15 episodes (60-90s each) on the Beat Engine, each cutting on a cliffhanger.
  private async generateVerticalAsync(docId: string, revId: string, projectId: string, stages: any[], brief: any): Promise<void> {
    try {
      const canonDir = docId ? await this.canon.directiveFor(docId, Number.MAX_SAFE_INTEGER) : '';
      const dir = [await this.langDirective(brief), knowledgeDirective(brief), canonDir].filter(Boolean).join('\n');
      const bodyOf = (k: string) => { const x: any = stages.find((y: any) => y.kind === k); return String((x && x.current && x.current.body) || ''); };
      const ctx = dir + '\n\nPREMISE:\n' + bodyOf('PREMISE').slice(0, 1800) + '\n\nSTORY ENGINE:\n' + bodyOf('STORY_ENGINE').slice(0, 1800) + '\n\nEPISODE MAP:\n' + bodyOf('EPISODE_MAP').slice(0, 4000) + '\n\nBEAT ENGINE:\n' + bodyOf('BEAT_ENGINE').slice(0, 4000);
      let eps = this.parseEpisodes(bodyOf('EPISODE_MAP'));
      if (!eps.length) eps = this.parseEpisodes(bodyOf('BEAT_ENGINE'));
      if (!eps.length) eps = Array.from({ length: 12 }, (_, i) => ({ n: i + 1, title: '', text: '' }));
      const N = Math.min(eps.length, 15);   // the free-block deliverable: the first 10-15 episodes
      const setP = (patch: any) => { const p = this.genProgress.get(docId); if (p) Object.assign(p, patch); };
      const saveRev = async (pages: any[]) => { await (this.prisma as any).scriptRevision.update({ where: { id: revId }, data: { pageText: pages, pageCount: pages.length } }).catch(() => {}); };
      setP({ total: N });
      const out: string[] = []; let soFar = '';
      for (let i = 0; i < N; i++) {
        const ep = eps[i] || { n: i + 1, title: '', text: '' };
        const txt = await this.writeVerticalEpisode(ctx, ep, i + 1, soFar.slice(-1600), projectId);
        out.push('EPISODE ' + (i + 1) + (ep.title ? ' — ' + ep.title : '') + '\n\n' + txt);
        soFar = (soFar + '\nE' + (i + 1) + ': ' + String(ep.text || '').slice(0, 140)).slice(-2200);
        if (i % 2 === 0 || i === N - 1) { const pages = this.paginate(out.join('\n\n')); await saveRev(pages); setP({ done: i + 1, pageCount: pages.length }); } else setP({ done: i + 1 });
      }
      const pages = this.paginate(out.join('\n\n')); await saveRev(pages);
      setP({ status: 'DONE', done: N, pageCount: pages.length, coverage: 'COMPLETE', coverageNote: 'Vertical: first ' + N + ' episodes written (the free-block deliverable).' });
    } catch (e: any) {
      const msg = String((e && e.message) || e).slice(0, 200);
      const p = this.genProgress.get(docId); if (p) { p.status = 'ERROR'; p.error = msg; }
      try { await (this.prisma as any).scriptRevision.update({ where: { id: revId }, data: { pageText: [{ page: 1, text: '(Vertical episode generation did not finish:\n' + msg + '\n\nOpen the build and run Generate again.)' }], pageCount: 1 } }); } catch { /* */ }
    }
  }

  private async writeVerticalEpisode(ctx: string, ep: any, n: number, soFar: string, projectId: string): Promise<string> {
    const sys = 'You are writing ONE episode of a vertical micro-drama (9:16, 60-90 seconds, shot for phones). Follow the BEAT ENGINE precisely: HOOK (0-15s) detonates immediately; FRICTION (15-60s) is a filmable external conflict; SPIKE (~60s) re-prices everything; BUTTON (~55-68s) CUTS ON A CLIFFHANGER — never resolve the episode. Short, sharp, tactical dialogue with high emotional charge; face-first close-ups; props carry emotion. Format like a short screenplay: one slugline, present-tense action, UPPERCASE character cues with dialogue beneath. Keep it to ~150-260 words (one screen-minute). Output ONLY the episode text, ending on the cliffhanger.';
    const user = ctx + (soFar ? '\n\nSTORY SO FAR (continuity, do not repeat):' + soFar : '') + '\n\nWRITE EPISODE ' + n + (ep.title ? ' — ' + ep.title : '') + '.\nWHAT THIS EPISODE COVERS: ' + (ep.text || 'Advance the central conflict; open on a hook and cut on a cliffhanger.') + '\n\nWrite it now.';
    let txt = '';
    try { const r: any = await this.ai.run({ task: 'scripton.vertical.episode', system: sys, user, maxTokens: 1100, temperature: 0.85, projectId, refType: 'Project', refId: projectId }); txt = String((r && r.text) || ''); } catch { txt = ''; }
    txt = txt.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').replace(/^\s*EPISODE\s+\d+[^\n]*\n?/i, '').replace(/\n{3,}/g, '\n\n').trim();
    return txt || '(The episode continues.)';
  }

  // Documentary: assemble the NARRATION script to the locked paper edit (written last). No fictional scenes.
  private async generateDocumentaryAsync(docId: string, revId: string, projectId: string, stages: any[], brief: any): Promise<void> {
    try {
      const dir = [await this.langDirective(brief), knowledgeDirective(brief)].filter(Boolean).join('\n');
      const bodyOf = (k: string) => { const x: any = stages.find((y: any) => y.kind === k); return String((x && x.current && x.current.body) || ''); };
      const setP = (patch: any) => { const p = this.genProgress.get(docId); if (p) Object.assign(p, patch); };
      const saveRev = async (pages: any[]) => { await (this.prisma as any).scriptRevision.update({ where: { id: revId }, data: { pageText: pages, pageCount: pages.length } }).catch(() => {}); };
      setP({ total: 1 });
      let script = bodyOf('NARRATION').trim();   // if NARRATION was already developed, that IS the script
      if (!script) {
        const ctx = dir + '\n\nTHESIS:\n' + bodyOf('THESIS').slice(0, 2000) + '\n\nTREATMENT:\n' + bodyOf('TREATMENT').slice(0, 2500) + '\n\nINTERVIEW OUTLINE:\n' + bodyOf('INTERVIEW_OUTLINE').slice(0, 2500) + '\n\nPAPER EDIT (the locked spine to write to):\n' + bodyOf('PAPER_EDIT').slice(0, 6000);
        const sys = 'You are a documentary writer. Write the full NARRATION SCRIPT to the locked picture described by the PAPER EDIT. Go SEQUENCE BY SEQUENCE: a short uppercase SEQUENCE header (location/subject), the voice-over narration beneath, plus [bracketed] cues for key archive/interview moments. Carry the THESIS through. Do NOT invent dialogue or fictional scenes — this is non-fiction narration. Output ONLY the narration script as plain text.';
        const r: any = await this.ai.run({ task: 'scripton.documentary.narration', system: sys, user: ctx + '\n\nWrite the complete narration script now, sequence by sequence, from open to close.', maxTokens: 15000, timeoutMs: 230000, projectId, refType: 'Project', refId: projectId });
        script = String((r && r.text) || '').replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
      }
      if (!script) script = '(No developed documentary material yet — develop the Thesis and Paper edit first, then generate.)';
      const pages = this.paginate(script); await saveRev(pages);
      setP({ status: 'DONE', done: 1, pageCount: pages.length, coverage: 'COMPLETE', coverageNote: 'Documentary narration assembled to the paper edit.' });
    } catch (e: any) {
      const msg = String((e && e.message) || e).slice(0, 200);
      const p = this.genProgress.get(docId); if (p) { p.status = 'ERROR'; p.error = msg; }
      try { await (this.prisma as any).scriptRevision.update({ where: { id: revId }, data: { pageText: [{ page: 1, text: '(Documentary narration generation did not finish:\n' + msg + ')' }], pageCount: 1 } }); } catch { /* */ }
    }
  }

  // Re-run the feature writer for an EXISTING Library doc. NON-DESTRUCTIVE: write into a NEW revision and only make it
  // active when generation reaches DONE — a failed/short run never destroys the existing pages (the OLD revision stays
  // active throughout). mode 'extend' (default): keep all existing pages, write ONLY the scenes beyond where the script
  // stopped (through the finale) and append. mode 'rewrite': re-plan and re-write the whole feature from the outline.
  async regenerateFeature(docId: string, userId?: string, mode: 'extend' | 'rewrite' = 'extend') {
    const doc: any = await (this.prisma as any).scriptDocument.findUnique({ where: { id: docId } }).catch(() => null);
    if (!doc) throw new BadRequestException('Script not found.');
    const oldRev: any = doc.activeRevisionId ? await (this.prisma as any).scriptRevision.findUnique({ where: { id: doc.activeRevisionId } }).catch(() => null) : null;
    const existingPages: any[] = (oldRev && Array.isArray(oldRev.pageText)) ? oldRev.pageText : [];
    const build: any = await (this.prisma as any).developmentBuild.findFirst({ where: { linkedScriptId: doc.id } }).catch(() => null);
    const stages = await this.pipeline(doc.projectId, build ? build.id : null);
    const existing = this.sceneCards(stages);
    const doExtend = mode === 'extend' && existingPages.length > 1;
    // A fresh revision to write into; the OLD revision stays active until the new one finishes (non-destructive).
    const seed = doExtend ? existingPages : [{ page: 1, text: 'FADE IN:\n\nGenerating…' }];
    const regDefs = await this.scriptonDefs();
    const newRev: any = await (this.prisma as any).scriptRevision.create({ data: { documentId: doc.id, revisionLabel: doExtend ? 'White Draft (extended)' : 'White Draft (rewrite)', pdfUrl: '', pageCount: seed.length, pageText: seed, revisionColor: 'WHITE', colorCode: regDefs.revisionColor || null, uploadedById: userId || null } });
    const estTotal = existing.length >= 20 ? existing.length : 60;
    this.genProgress.set(doc.id, { status: 'GENERATING', done: doExtend ? existingPages.length : 0, total: estTotal, pageCount: existingPages.length });
    const run = doExtend
      ? this.extendFeatureAsync(doc.id, newRev.id, doc.projectId, stages, existing, existingPages)
      : this.generateScriptAsync(doc.id, newRev.id, doc.projectId, stages, existing);
    // Swap the active revision to the new one ONLY when generation finished cleanly. On ERROR the old pages remain.
    // Materialise scenes for the new revision first (extend path doesn't go through generateScriptAsync; idempotent for rewrite).
    void run.then(async () => {
      const p = this.genProgress.get(doc.id);
      if (p && p.status === 'DONE') {
        await this.materialiseScenes(newRev.id, doc.projectId);
        await (this.prisma as any).scriptDocument.update({ where: { id: doc.id }, data: { activeRevisionId: newRev.id } }).catch(() => {});
      }
    }).catch(() => {});
    return { documentId: doc.id, revisionId: newRev.id, total: estTotal, mode: doExtend ? 'extend' : 'rewrite' };
  }

  // EXTEND: keep every existing page, plan the FULL arc, write ONLY the scenes beyond where the script stopped, append.
  private async extendFeatureAsync(docId: string, revId: string, projectId: string, stages: any[], existing: any[], existingPages: any[]): Promise<void> {
    try {
      const bRow: any = await (this.prisma as any).developmentBuild.findFirst({ where: { linkedScriptId: docId } }).catch(() => null);
      const featBrief = (bRow && bRow.brief) || {};
      const featDirective = [await this.langDirective(featBrief), knowledgeDirective(featBrief)].filter(Boolean).join('\n');
      const ctx = await this.buildFeatureCtx(projectId, stages, featDirective);
      const ar = this.isArabicBrief(featBrief);
      const spine = this.buildSpine(stages);
      const beatN = this.countBeats(stages);
      // #45: a series extends only to its per-episode pilot density, not the feature band.
      const isSeries = ['TV_SERIES', 'LIMITED'].indexOf(String(featBrief.projectType || '').toUpperCase()) >= 0;
      const ssc = isSeries ? seriesSceneCount(featBrief.episodes, featBrief.minutesPerEp) : null;
      const target = ssc ? ssc.scenesPerEp : Math.min(90, Math.max(55, beatN ? Math.round(beatN * 1.5) : 60));
      const planned = await this.planScenes(ctx, projectId, spine, target, !!ssc);
      const scenes: any[] = ssc ? planned : ((planned.length >= existing.length) ? planned : existing);
      const setP = (patch: any) => { const p = this.genProgress.get(docId); if (p) Object.assign(p, patch); };
      const saveRev = async (pages: any[]) => { await (this.prisma as any).scriptRevision.update({ where: { id: revId }, data: { pageText: pages, pageCount: pages.length } }).catch(() => {}); };
      // How many scenes does the existing script already contain? Numbered headers "N␠␠SLUG"; fall back to a page-based estimate.
      const existingText = (existingPages || []).map((p: any) => String(p.text || '')).join('\n');
      const haveN = (existingText.match(/^\s*\d+\s{2,}\S/gmu) || []).length || Math.max(1, Math.round((existingPages.length || 1) / 1.7));
      const startIdx = Math.min(haveN, scenes.length);
      if (startIdx >= scenes.length) { setP({ status: 'DONE', done: scenes.length, total: scenes.length, pageCount: existingPages.length, coverage: 'COMPLETE', coverageNote: 'Script already covers the full planned scene list.' }); return; }
      setP({ total: scenes.length, done: startIdx });
      // Trim a trailing FADE OUT (EN or AR) so new scenes append seamlessly, then keep numbering from where it left off.
      const baseText = existingText.replace(/\n*FADE OUT\.?\s*$/i, '').replace(/\n*اختفاء تدريجي[.،]?\s*$/u, '').trimEnd();
      const out: string[] = [baseText];
      let storySoFar = baseText.slice(-2000); let prevTail = baseText.slice(-700); let stubs = 0;
      const newCount = scenes.length - startIdx;
      for (let i = startIdx; i < scenes.length; i++) {
        const sc = scenes[i];
        const header = (i + 1) + '  ' + this.slugOf(sc, ar);
        const body = await this.writeScene(ctx, sc, header, storySoFar.slice(-1600), prevTail.slice(-700), projectId);
        if (body === SCENE_STUB) stubs++;
        out.push(header + '\n\n' + body);
        prevTail = body.slice(-700);
        storySoFar = (storySoFar + '\n' + (i + 1) + '. ' + String(sc.brief || '').slice(0, 150)).slice(-2400);
        if (i % 3 === 0 || i === scenes.length - 1) { const pages = this.paginate(out.join('\n\n') + '\n\nFADE OUT.'); await saveRev(pages); setP({ done: i + 1, pageCount: pages.length }); }
        else setP({ done: i + 1 });
      }
      // Wholesale failure on the NEW scenes → don't file the extend as DONE (old draft stays active).
      if (this.mostlyStub(stubs, newCount)) { await this.failStubRun(docId, revId, stubs, newCount); return; }
      out.push('FADE OUT.');
      const pages = this.paginate(out.join('\n\n'));
      await saveRev(pages);
      if (ssc) {
        setP({ status: 'DONE', done: scenes.length, pageCount: pages.length, coverage: 'COMPLETE', scenesPerEp: ssc.scenesPerEp, seasonScenes: ssc.seasonScenes, coverageNote: 'Pilot episode: ' + scenes.length + ' scenes at ~' + featBrief.minutesPerEp + ' min/ep · full season ≈ ' + ssc.seasonScenes + ' scenes (' + ssc.episodes + ' ep × ' + ssc.scenesPerEp + ').' });
      } else {
        const cov = await this.verifyEnding(spine, out.slice(-4).join('\n\n'), projectId);
        setP({ status: 'DONE', done: scenes.length, pageCount: pages.length, coverage: cov.complete ? 'COMPLETE' : 'SHORT', coverageNote: cov.note });
      }
    } catch (e: any) {
      const msg = String((e && e.message) || e).slice(0, 200);
      const p = this.genProgress.get(docId); if (p) { p.status = 'ERROR'; p.error = msg; }
      // Non-destructive: leave the new revision as-is and DO NOT swap — the caller only activates it on DONE, so the old pages survive.
    }
  }

  // Promote: file the document immediately, then write it in the background by format (poll scriptProgress).
  async promoteToScript(versionId: string, userId?: string) {
    const v: any = await (this.prisma as any).stageVersion.findUnique({ where: { id: versionId } });
    if (!v) throw new BadRequestException('Version not found.');
    const stage: any = await (this.prisma as any).developmentStage.findUnique({ where: { id: v.stageId } });
    if (!stage) throw new BadRequestException('Stage not found.');
    const stages = await this.pipeline(stage.projectId, stage.buildId || null);
    const lg: any = stages.find((s: any) => s.kind === 'LOGLINE');
    const fromLog = String((lg && lg.current && lg.current.body) || '').split(/[.\n]/)[0].trim();
    const bld: any = stage.buildId ? await (this.prisma as any).developmentBuild.findUnique({ where: { id: stage.buildId } }).catch(() => null) : null;
    // Prefer the build's own name ("Try") for the document title — not a truncated logline.
    const title = ((bld && bld.name && !/^untitled/i.test(String(bld.name))) ? String(bld.name) : (v.title && !/^draft|^developed/i.test(v.title) ? v.title : (fromLog || 'Developed feature'))).slice(0, 80);
    const existing = this.sceneCards(stages);
    const estTotal = existing.length >= 20 ? existing.length : 45;
    const verId = stage.buildId ? await this.activeVersionId(stage.buildId) : null;
    const promoteDefs = await this.scriptonDefs();
    const doc: any = await (this.prisma as any).scriptDocument.create({ data: { projectId: stage.projectId, title, kind: 'SCRIPT', createdById: userId || null, buildVersionId: verId } });
    const rev: any = await (this.prisma as any).scriptRevision.create({ data: { documentId: doc.id, revisionLabel: 'White Draft (developed)', pdfUrl: '', pageCount: 0, pageText: [{ page: 1, text: 'FADE IN:\n\nYour feature is being written, scene by scene...' }], revisionColor: 'WHITE', colorCode: promoteDefs.revisionColor || null, uploadedById: userId || null } });
    await (this.prisma as any).scriptDocument.update({ where: { id: doc.id }, data: { activeRevisionId: rev.id } }).catch(() => {});
    await (this.prisma as any).stageVersion.update({ where: { id: versionId }, data: { status: 'LOCKED' } }).catch(() => {});
    // Generating the Library script links the doc to the build — it does NOT "promote to production".
    // (Real promotion sets linkedProjectId/PROMOTED via promoteBuild; setting them here falsely showed the build attached to a project.)
    if (stage.buildId) await (this.prisma as any).developmentBuild.update({ where: { id: stage.buildId }, data: { linkedScriptId: doc.id, promotedVersionId: versionId } }).catch(() => {});
    this.genProgress.set(doc.id, { status: 'GENERATING', done: 0, total: estTotal, pageCount: 0 });
    void this.generateScriptAsync(doc.id, rev.id, stage.projectId, stages, existing);
    return { documentId: doc.id, revisionId: rev.id, total: estTotal };
  }

  // ── Computed analytics (C1) — character network + dialogue + pacing, from scenes + script text. ──
  // ── Development Package: aggregate everything a promoted project produced (pitch/financing dossier) ──
  async developmentPackage(opts: any) {
    const docId = String((opts && opts.docId) || '');
    let projectId = String((opts && opts.projectId) || '');
    let doc: any = null;
    if (docId) { doc = await (this.prisma as any).scriptDocument.findUnique({ where: { id: docId } }).catch(() => null); if (doc) projectId = doc.projectId; }
    if (!projectId) throw new BadRequestException('A project or document is required.');
    if (!doc) doc = await (this.prisma as any).scriptDocument.findFirst({ where: { projectId }, orderBy: { createdAt: 'desc' } }).catch(() => null);
    let build: any = null;
    if (doc) build = await (this.prisma as any).developmentBuild.findFirst({ where: { linkedScriptId: doc.id, deletedAt: null } }).catch(() => null);
    if (!build && opts && opts.buildId) build = await (this.prisma as any).developmentBuild.findUnique({ where: { id: String(opts.buildId) } }).catch(() => null);
    // NO project-wide "latest build" fallback: the ScripON Library workspace hosts many builds under one projectId,
    // so "latest in project" would splice another build's data into this one. Resolve strictly by docId / buildId.
    const stages = await this.pipeline(projectId, build ? build.id : null);
    const byKind: any = {};
    for (const s of (stages || [])) { const v: any = s.current || (s.versions || [])[0]; if (v) byKind[s.kind] = { body: v.body || '', data: v.data || null, framework: v.framework || null, status: v.status || null }; }
    // Build-exact coverage: only coverage filed against THIS build's own script document — never the project's
    // "latest" (that is a different build in the shared workspace). No coverage yet → null, not someone else's.
    const coverage = doc ? await (this.prisma as any).coverageReport.findFirst({ where: { documentId: doc.id }, orderBy: { createdAt: 'desc' } }).catch(() => null) : null;
    let rev: any = null; if (doc && doc.activeRevisionId) rev = await (this.prisma as any).scriptRevision.findUnique({ where: { id: doc.activeRevisionId }, select: { id: true, pageCount: true, revisionLabel: true } }).catch(() => null);
    const proj: any = await (this.prisma as any).productionProject.findUnique({ where: { id: projectId }, select: { id: true, title: true, scriponWorkspace: true } }).catch(() => null);
    // Title comes from the build (e.g. "Try"), not the shared "ScripON Library" workspace project.
    const projTitle = (build && build.name) || (proj && !proj.scriponWorkspace && proj.title) || (doc && doc.title) || 'Project';
    // Auto character breakdown — generate once (cached on the build) whenever there are scenes but no bible yet. No manual step.
    let charBible: any = (build && Array.isArray(build.characterBible) && build.characterBible.length) ? build.characterBible : null;
    if (!charBible) {
      const scn: any = byKind.SCENES;
      const hasScenes = !!(scn && ((scn.data && Array.isArray(scn.data.scenes) && scn.data.scenes.length) || (scn.body && String(scn.body).length > 40)));
      if (hasScenes) { try { const r: any = await this.generateCharacterBible(projectId, undefined, build ? build.id : undefined); if (r && Array.isArray(r.characters) && r.characters.length) charBible = r.characters; } catch { /* tolerant — fall back to coverage characters */ } }
    }
    if (!charBible && coverage && Array.isArray(coverage.characters) && coverage.characters.length) charBible = coverage.characters;
    const briefObj: any = (build && build.brief) || null;
    return {
      project: { id: projectId, title: projTitle },
      build: build ? { id: build.id, name: build.name, status: build.status, brief: build.brief || null, characterBible: build.characterBible || null, promotedVersionId: build.promotedVersionId || null, linkedProjectId: build.linkedProjectId || null } : null,
      script: doc ? { docId: doc.id, title: doc.title, revisionId: rev ? rev.id : (doc.activeRevisionId || null), pageCount: rev ? rev.pageCount : null } : null,
      stages: byKind,
      coverage: coverage || null,
      brief: briefObj,
      ladder: stageLadderFor(briefObj || {}),
      characterBible: charBible,
    };
  }

  // ── Development Package → editable Word (.docx). Same model as the PDF dossier; client may pass
  // localized `labels` + `rtl` so the document matches the UI. A .docx cannot be hardened like the
  // protected review PDF, so this is explicitly an editable review copy (metadata is still neutral). ──
  async developmentPackageDocx(opts: any, labels?: any, rtl?: boolean): Promise<{ buffer: Buffer; fileName: string }> {
    const pkg = await this.developmentPackage(opts);
    const doc = buildPackageDocModel(pkg, labels || undefined);
    const buffer = await packDocx(doc, { rtl: !!rtl });
    const base = String(doc.title || 'package').replace(/[^\w؀-ۿ\-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'package';
    return { buffer, fileName: base + '.docx' };
  }

  // ── Character bible: enrich coverage characters into tagline/core-identity/traits/function/arc (cached) ──
  async generateCharacterBible(projectId: string, userId?: string, buildId?: string) {
    if (!projectId) throw new BadRequestException('A project is required.');
    // Resolve the EXACT build so the bible is built from THIS build's data — not "latest build in the shared workspace".
    const build: any = buildId
      ? await (this.prisma as any).developmentBuild.findUnique({ where: { id: buildId } }).catch(() => null)
      : await (this.prisma as any).developmentBuild.findFirst({ where: { OR: [{ projectId }, { linkedProjectId: projectId }], deletedAt: null }, orderBy: { updatedAt: 'desc' } }).catch(() => null);
    const stages = await this.pipeline(projectId, build ? build.id : null);
    const byKind: any = {}; for (const s of (stages || [])) { const v: any = s.current; if (v) byKind[s.kind] = v; }
    const cov: any = await this.latestCoverage(projectId).catch(() => null);
    const covChars: any[] = (cov && Array.isArray(cov.characters)) ? cov.characters : [];
    const scenes: any[] = (byKind.SCENES && byKind.SCENES.data && Array.isArray(byKind.SCENES.data.scenes)) ? byKind.SCENES.data.scenes : [];
    const sceneChars = Array.from(new Set(scenes.flatMap((s: any) => Array.isArray(s.characters) ? s.characters : []).map((c: any) => String(c)))).slice(0, 24);
    const draft = String((byKind.DRAFT && byKind.DRAFT.body) || '').slice(0, 9000);
    const sys = 'You are a development executive writing the CHARACTER BIBLE for a film/series pitch. Return ONLY JSON {characters:[{name, tagline, age, status, role, coreIdentity, traits:[string], function:[string], arc}]}. tagline = a 3-6 word essence (no surrounding quotes). age e.g. "30s". status = social/role status. role = dramatic role (Protagonist, Antagonist, Ally, Mentor, Love interest, Authority, ...). coreIdentity = ONE sentence. traits = 2-4 vivid traits, include one productive contradiction. function = 1-3 short bullets of what the character DOES for the story. arc = "State -> State -> State" then one sentence. 6-9 principals max, protagonist first. No text outside the JSON.';
    const user = 'COVERAGE CHARACTERS: ' + JSON.stringify(covChars).slice(0, 2500) + '\nSCENE CHARACTERS: ' + sceneChars.join(', ') + '\nLOGLINE: ' + String((byKind.LOGLINE && byKind.LOGLINE.body) || '').slice(0, 300) + '\nSYNOPSIS:\n' + String((byKind.SYNOPSIS && byKind.SYNOPSIS.body) || '').slice(0, 1300) + '\nDRAFT (excerpt, for voice):\n' + draft;
    const res: any = await this.ai.run({ task: 'scripton.character.bible', system: sys, user, maxTokens: 4000, timeoutMs: 200000, projectId, refType: 'Project', refId: projectId });
    const chars = (res && res.json && Array.isArray(res.json.characters)) ? res.json.characters : [];
    if (chars.length) {
      try { await (this.prisma as any).intakeProfile.upsert({ where: { projectId }, create: { projectId, characterBible: chars }, update: { characterBible: chars } }); } catch { /* */ }
      if (build) { try { await (this.prisma as any).developmentBuild.update({ where: { id: build.id }, data: { characterBible: chars } }).catch(() => {}); } catch { /* */ } }
    }
    return { characters: chars };
  }

  private cueParse(pageText: any): { speakers: Record<string, { lines: number; words: number }>; sceneSets: string[][]; dialogueWords: number; actionWords: number } {
    const speakers: Record<string, { lines: number; words: number }> = {};
    const sceneSets: string[][] = [];
    let dialogueWords = 0, actionWords = 0;
    const pages: any[] = Array.isArray(pageText) ? pageText : [];
    const isSlug = (t: string) => /^(INT|EXT|INT\.?\/EXT|I\/E)[\.\s]/i.test(t) || /^(FADE|CUT TO|DISSOLVE|SMASH)/i.test(t);
    const nameOf = (t: string) => t.replace(/\(.*?\)/g, '').replace(/[^A-Za-z0-9 .'\-]/g, '').trim();
    const looksUpper = (t: string) => { const L = t.replace(/[^A-Za-z]/g, ''); return L.length > 0 && t === t.toUpperCase(); };
    let budget = 120000;
    for (const pg of pages) {
      const lines = String((pg && pg.text) || '').split(/\r?\n/);
      for (let k = 0; k < lines.length; k++) {
        if (--budget < 0) break;
        const tt = (lines[k] || '').trim();
        if (!tt) continue;
        if (isSlug(tt)) { sceneSets.push([]); continue; }
        const candidate = looksUpper(tt) && tt.length <= 38 && !/[.:!?]$/.test(tt);
        const name = candidate ? nameOf(tt).toUpperCase() : '';
        if (candidate && name && name.length >= 2) {
          let j = k + 1, words = 0, dl = 0;
          while (j < lines.length) {
            const d = (lines[j] || '').trim();
            if (!d) break;
            if (isSlug(d)) break;
            if (looksUpper(d) && d.length <= 38 && !/[.:!?]$/.test(d)) break;
            words += d.split(/\s+/).filter(Boolean).length; dl += 1; j++;
          }
          if (dl > 0) {
            if (!speakers[name]) speakers[name] = { lines: 0, words: 0 };
            speakers[name].lines += dl; speakers[name].words += words; dialogueWords += words;
            if (!sceneSets.length) sceneSets.push([]);
            const cur = sceneSets[sceneSets.length - 1]; if (cur.indexOf(name) < 0) cur.push(name);
            k = j - 1; continue;
          }
        }
        actionWords += tt.split(/\s+/).filter(Boolean).length;
      }
      if (budget < 0) break;
    }
    return { speakers, sceneSets, dialogueWords, actionWords };
  }

  private gini(vals: number[]): number | null {
    const a = vals.filter((x) => x > 0).sort((x, y) => x - y);
    const n = a.length; if (!n) return null;
    let cum = 0; for (let i = 0; i < n; i++) cum += (i + 1) * a[i];
    const sum = a.reduce((x, y) => x + y, 0); if (!sum) return null;
    return Math.round((((2 * cum) / (n * sum)) - (n + 1) / n) * 1000) / 1000;
  }

  async analytics(opts: any, userId?: string) {
    const r = await this.resolveRevision(opts);
    const scenes: any[] = await (this.prisma as any).scriptScene.findMany({ where: { revisionId: r.revisionId }, orderBy: { sortOrder: 'asc' }, select: { id: true, sceneNumber: true, slugline: true, intExt: true, dayNight: true, setName: true, description: true, pages: true } }).catch(() => []);
    if (!scenes.length) throw new BadRequestException('This script has no parsed scenes yet — import or break it down first.');
    const facts = this.facts(scenes);

    const pageArr = scenes.map((s) => Number(s.pages) || 0);
    const totalPages = pageArr.reduce((a, b) => a + b, 0);
    const sorted = [...pageArr].sort((a, b) => a - b);
    const median = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : 0;
    const mean = pageArr.length ? totalPages / pageArr.length : 0;
    const longest = scenes.map((s, i) => ({ scene: s.sceneNumber || String(i + 1), slugline: s.slugline || '', pages: Number(s.pages) || 0 })).sort((a, b) => b.pages - a.pages).slice(0, 5);
    const pacing = { sceneCount: scenes.length, totalPages: Math.round(totalPages * 10) / 10, meanPagesPerScene: Math.round(mean * 100) / 100, medianPagesPerScene: Math.round(median * 100) / 100, longestScenes: longest, perScene: pageArr.slice(0, 250), intExt: { int: facts.int, ext: facts.ext }, dayNight: { day: facts.day, night: facts.night }, locations: facts.locations };

    const nsc = scenes.length;
    const at = (frac: number) => { const idx = Math.max(0, Math.min(nsc - 1, Math.round(frac * (nsc - 1)))); const sc: any = scenes[idx] || {}; return { atScene: sc.sceneNumber || String(idx + 1), slugline: sc.slugline || '' }; };
    const structure = { turningPoints: [ Object.assign({ name: 'Opportunity', pos: 0.1 }, at(0.1)), Object.assign({ name: 'Change of Plans', pos: 0.25 }, at(0.25)), Object.assign({ name: 'Point of No Return', pos: 0.5 }, at(0.5)), Object.assign({ name: 'Major Setback', pos: 0.75 }, at(0.75)), Object.assign({ name: 'Climax', pos: 0.9 }, at(0.9)) ], note: 'Expected turning-point positions (TRIPOD priors) mapped to your scene order — a structural reference, not a detector.' };

    const rev: any = await (this.prisma as any).scriptRevision.findUnique({ where: { id: r.revisionId }, select: { pageText: true } }).catch(() => null);
    const parsed = this.cueParse(rev && rev.pageText);
    const totW = parsed.dialogueWords + parsed.actionWords;
    const charList = Object.keys(parsed.speakers).map((k) => ({ name: k, lines: parsed.speakers[k].lines, words: parsed.speakers[k].words })).sort((a, b) => b.words - a.words);
    const dialogue: any = charList.length
      ? { source: 'script-text', characters: charList.slice(0, 40), dialogueWords: parsed.dialogueWords, actionWords: parsed.actionWords, dialogueActionRatio: totW ? Math.round((100 * parsed.dialogueWords) / totW) / 100 : null, giniLines: this.gini(charList.map((c) => c.lines)), note: 'Dialogue parsed from screenplay cues — reliable for principals, sparse for minor parts.' }
      : { source: 'none', characters: [], note: 'No parsed page text — upload or import the script so dialogue can be analysed.' };

    const castEls: any[] = await (this.prisma as any).breakdownElement.findMany({ where: { revisionId: r.revisionId, category: { in: ['CAST', 'BACKGROUND'] } }, select: { name: true, sceneId: true } }).catch(() => []);
    let sceneSets: string[][] = [];
    let netSource = 'none';
    if (castEls.length) {
      const byScene: Record<string, Set<string>> = {};
      for (const e of castEls) { const sid = e.sceneId || '_'; const nm = String(e.name || '').toUpperCase().trim(); if (!nm || sid === '_') continue; (byScene[sid] = byScene[sid] || new Set<string>()).add(nm); }
      sceneSets = Object.keys(byScene).map((sid) => Array.from(byScene[sid]));
      netSource = 'breakdown';
    }
    if (!sceneSets.length && parsed.sceneSets.length) { sceneSets = parsed.sceneSets.filter((x) => x.length); netSource = 'script-text'; }

    let network: any = { source: 'none', nodes: [], edges: [], note: 'Run a breakdown (tag cast) or import the script text to compute the character network.' };
    if (sceneSets.length) {
      const app: Record<string, number> = {}; const deg: Record<string, Set<string>> = {};
      for (const set of sceneSets) { const u = Array.from(new Set(set)); for (const a of u) { app[a] = (app[a] || 0) + 1; deg[a] = deg[a] || new Set<string>(); for (const b of u) if (a !== b) deg[a].add(b); } }
      const nodes = Object.keys(app).map((nm) => ({ name: nm, appearances: app[nm], degree: deg[nm] ? deg[nm].size : 0 })).sort((a, b) => b.degree - a.degree || b.appearances - a.appearances);
      const ew: Record<string, number> = {};
      for (const set of sceneSets) { const u = Array.from(new Set(set)); for (let a = 0; a < u.length; a++) for (let b = a + 1; b < u.length; b++) { const key = [u[a], u[b]].sort().join('|'); ew[key] = (ew[key] || 0) + 1; } }
      const edges = Object.keys(ew).map((key) => { const p = key.split('|'); return { a: p[0], b: p[1], weight: ew[key] }; }).sort((x, y) => y.weight - x.weight).slice(0, 120);
      network = { source: netSource, protagonist: (nodes[0] && nodes[0].name) || null, nodes: nodes.slice(0, 40), edges, ensemble: nodes.filter((x) => x.degree >= 2).length, isolated: nodes.filter((x) => x.degree === 0).map((x) => x.name).slice(0, 20), note: 'Co-occurrence network; degree centrality ranks importance (top node = protagonist).' };
    }

    const representation = { speakingCharacters: charList.length, note: 'Screen-time / Bechdel tallies need character demographics — added in a later pass.' };
    const payload: any = { projectId: r.projectId, documentId: r.documentId || null, revisionId: r.revisionId, network, dialogue, pacing, structure, representation };
    try { return await (this.prisma as any).scriptAnalytics.create({ data: payload }); } catch { return payload; }
  }

  // ── Named development builds (standalone; promoted into a project on maturity) ──
  async listBuilds(projectId?: string, bin?: boolean) {
    await this.purgeExpiredBuilds();
    const where: any = projectId ? { OR: [{ projectId }, { linkedProjectId: projectId }] } : {};
    where.deletedAt = bin ? { not: null } : null;
    return (this.prisma as any).developmentBuild.findMany({ where, orderBy: bin ? { deletedAt: 'desc' } : { updatedAt: 'desc' }, take: 100 }).catch(() => []);
  }
  async purgeExpiredBuilds() {
    const cutoff = new Date(Date.now() - 30 * 86400000);
    await (this.prisma as any).developmentBuild.deleteMany({ where: { deletedAt: { lt: cutoff } } }).catch(() => {});
  }
  async createBuild(data: any) {
    const name = String((data && data.name) || 'Untitled build').slice(0, 120);
    // No production project needed up front — develop lands in the hidden ScripON Library workspace.
    // (Build isolation is enforced at read-time: coverage by document, bible from the build, reader by doc id —
    //  so builds never splice each other's data even when they share the workspace projectId.)
    let projectId = (data && data.projectId) || null;
    if (!projectId) { const ws = await this.scriponWorkspace().catch(() => null); projectId = ws ? ws.id : null; }
    return (this.prisma as any).developmentBuild.create({ data: { name, projectId, status: 'DRAFT', brief: (data && data.brief) || undefined } });
  }

  // The hidden ScripON Library home (one row, flagged scriponWorkspace). Builds develop here so a
  // production project is never required to start; it is excluded from production project lists.
  async scriponWorkspace() {
    let p: any = await (this.prisma as any).productionProject.findFirst({ where: { scriponWorkspace: true } }).catch(() => null);
    if (!p) p = await (this.prisma as any).productionProject.create({ data: { projectNumber: 'SCRIPON-LIBRARY', title: 'ScripON Library', projectType: 'OTHER', scriponWorkspace: true } }).catch(() => null);
    return p;
  }

  /** Read scriptonDefaults from the workspace IntakeProfile. Returns {} when absent so callers can use `defs.x || fallback` safely. */
  private async scriptonDefs(): Promise<any> {
    const ws = await this.scriponWorkspace().catch(() => null);
    if (!ws) return {};
    const ip: any = await (this.prisma as any).intakeProfile.findUnique({ where: { projectId: ws.id }, select: { scriptonDefaults: true } }).catch(() => null);
    return ip?.scriptonDefaults || {};
  }

  /** The workspace row + the server-resolved collaboration mode (team/solo) every
   *  ScriptON screen reads. Counts ProjectRoleAssignment members for the AUTO rule. */
  async scriptonWorkspaceView() {
    const p: any = await this.scriponWorkspace();
    if (!p) return p;
    const ip: any = await (this.prisma as any).intakeProfile
      .findUnique({ where: { projectId: p.id }, select: { collabMode: true } })
      .catch(() => null);
    const memberCount: number = await (this.prisma as any).projectRoleAssignment
      .count({ where: { projectId: p.id } })
      .catch(() => 0);
    const collabMode = String(ip?.collabMode || 'AUTO').toUpperCase();
    return { ...p, collabMode, memberCount, mode: resolveCollabMode(collabMode, memberCount) };
  }

  async renameBuild(id: string, name: string) {
    return (this.prisma as any).developmentBuild.update({ where: { id }, data: { name: String(name || '').slice(0, 120) } });
  }
  async setBuildStatus(id: string, status: string) {
    const st = String(status || 'DRAFT').toUpperCase();
    if (['DRAFT', 'REVIEW', 'GREENLIT', 'PROMOTED'].indexOf(st) < 0) throw new BadRequestException('Invalid build status.');
    return (this.prisma as any).developmentBuild.update({ where: { id }, data: { status: st } });
  }
  async deleteBuild(id: string) {
    await (this.prisma as any).developmentBuild.update({ where: { id }, data: { deletedAt: new Date() } }).catch(() => {});
    return { ok: true };
  }
  async restoreBuild(id: string) {
    await (this.prisma as any).developmentBuild.update({ where: { id }, data: { deletedAt: null } }).catch(() => {});
    return { ok: true };
  }
  async purgeBuild(id: string) {
    await (this.prisma as any).developmentBuild.delete({ where: { id } }).catch(() => {});
    return { ok: true };
  }

  // Reset a development stage — clear its versions (and optionally everything downstream) so it regenerates clean.
  async resetStage(stageId: string, cascade?: boolean) {
    const stage: any = await (this.prisma as any).developmentStage.findUnique({ where: { id: stageId } });
    if (!stage) throw new BadRequestException('Stage not found.');
    const clearOne = async (sid: string) => { await (this.prisma as any).stageVersion.deleteMany({ where: { stageId: sid } }).catch(() => {}); await (this.prisma as any).developmentStage.update({ where: { id: sid }, data: { currentVersionId: null } }).catch(() => {}); };
    await clearOne(stageId);
    if (cascade) {
      const downstream: any[] = await (this.prisma as any).developmentStage.findMany({ where: { projectId: stage.projectId, buildId: stage.buildId ?? null, order: { gt: stage.order } } }).catch(() => []);
      for (const d of downstream) await clearOne(d.id);
    }
    return { ok: true, cascade: !!cascade };
  }

  // Promote a developed version into a project — existing or new — as a snapshot (provenance recorded; no live sync back).
  async promoteBuild(opts: any, userId?: string) {
    const build: any = (opts && opts.buildId) ? await (this.prisma as any).developmentBuild.findUnique({ where: { id: opts.buildId } }).catch(() => null) : null;
    let versionId = String((opts && opts.versionId) || '');
    if (!versionId && build && build.promotedVersionId) versionId = build.promotedVersionId; // Library promote = by build
    const v: any = versionId ? await (this.prisma as any).stageVersion.findUnique({ where: { id: versionId } }).catch(() => null) : null;
    if (!v && !(build && build.linkedScriptId)) throw new BadRequestException('Nothing to promote yet — generate the script first.');
    const stage: any = v ? await (this.prisma as any).developmentStage.findUnique({ where: { id: v.stageId } }).catch(() => null) : null;
    const srcProjectId = String((stage && stage.projectId) || (build && build.projectId) || '');

    // ── Snapshot transfer payload from the build brief + develop stages + coverage ──
    const brief: any = (build && build.brief) || (srcProjectId ? await this.getIntake(srcProjectId).catch(() => null) : null) || {};
    const coverage: any = srcProjectId ? await this.latestCoverage(srcProjectId).catch(() => null) : null;
    const stages: any[] = srcProjectId ? await this.pipeline(srcProjectId, build ? build.id : null).catch(() => []) : [];
    const lg: any = (stages || []).find((s: any) => s.kind === 'LOGLINE');
    const logline = String((lg && lg.current && lg.current.body) || (coverage && coverage.logline) || '').trim() || null;
    const genres: any[] = Array.isArray(brief.genres) ? brief.genres : [];
    const genre = genres.length ? genres.map((g: any) => String(g)).join(', ') : null;
    const title = String((opts && opts.name) || (build && build.name) || (v && v.title) || 'Developed project').slice(0, 120);
    const FMT: any = { MOVIE: 'FEATURE', FEATURE: 'FEATURE', FILM: 'FEATURE', SHORT: 'SHORT', TV_SERIES: 'OTHER', LIMITED: 'OTHER', VERTICAL: 'OTHER', TVC: 'TVC' };
    const projType = FMT[String(brief.projectType || '').toUpperCase()] || 'FEATURE';

    // ── WHITE-draft source: the build's generated Library script if present, else this version's body ──
    let pageText: any = [{ page: 1, text: String((v && v.body) || '') }];
    let pageCount = 0;
    if (build && build.linkedScriptId) {
      const ld: any = await (this.prisma as any).scriptDocument.findUnique({ where: { id: build.linkedScriptId } }).catch(() => null);
      if (ld && ld.activeRevisionId) { const lr: any = await (this.prisma as any).scriptRevision.findUnique({ where: { id: ld.activeRevisionId }, select: { pageText: true, pageCount: true } }).catch(() => null); if (lr && Array.isArray(lr.pageText) && lr.pageText.length) { pageText = lr.pageText; pageCount = lr.pageCount || lr.pageText.length; } }
    }

    // ── Resolve the target project (existing | new) and write the transfer fields onto it ──
    const target = String((opts && opts.target) || 'existing');
    let projectId = String((opts && opts.projectId) || '');
    const xfer: any = { logline, genre, creativeBrief: (brief && Object.keys(brief).length) ? brief : undefined, coverage: coverage || undefined, sourceBuildId: build ? build.id : null };
    if (target === 'new') {
      const proj: any = await (this.prisma as any).productionProject.create({ data: { projectNumber: 'DEV-' + Date.now().toString(36).toUpperCase(), title, projectType: projType, ...xfer } });
      projectId = proj.id;
    } else {
      if (!projectId) projectId = srcProjectId;
      if (!projectId) throw new BadRequestException('Pick an existing project or choose to start a new one.');
      await (this.prisma as any).productionProject.update({ where: { id: projectId }, data: xfer }).catch(() => {});
    }

    // ── File the WHITE master revision under the target project ──
    const promBuildDefs = await this.scriptonDefs();
    const doc: any = await (this.prisma as any).scriptDocument.create({ data: { projectId, title: title.slice(0, 80), kind: 'SCRIPT', createdById: userId || null } });
    const rev: any = await (this.prisma as any).scriptRevision.create({ data: { documentId: doc.id, revisionLabel: 'White Draft', pdfUrl: '', pageCount, pageText, revisionColor: 'WHITE', colorCode: promBuildDefs.revisionColor || null, uploadedById: userId || null } });
    await (this.prisma as any).scriptDocument.update({ where: { id: doc.id }, data: { activeRevisionId: rev.id } }).catch(() => {});
    if (versionId) await (this.prisma as any).stageVersion.update({ where: { id: versionId }, data: { status: 'LOCKED' } }).catch(() => {});
    if (build) await (this.prisma as any).developmentBuild.update({ where: { id: build.id }, data: { status: 'PROMOTED', linkedProjectId: projectId, linkedScriptId: build.linkedScriptId || doc.id, promotedVersionId: versionId || build.promotedVersionId || null, promotedAt: new Date() } }).catch(() => {});
    return { projectId, documentId: doc.id, revisionId: rev.id };
  }

  // ── Web ingestion (SSRF-guarded) — turn a URL or pasted HTML into readable source text for Adapt ──
  private isBlockedIp(ip: string): boolean {
    if (!ip) return true;
    let a = ip;
    if (a.indexOf('::ffff:') === 0) a = a.slice(7);
    if (a.indexOf(':') >= 0) { const l = a.toLowerCase(); return l === '::1' || l === '::' || l.indexOf('fc') === 0 || l.indexOf('fd') === 0 || l.indexOf('fe8') === 0 || l.indexOf('fe9') === 0 || l.indexOf('fea') === 0 || l.indexOf('feb') === 0; }
    const p = a.split('.').map((n) => parseInt(n, 10));
    if (p.length !== 4 || p.some((n) => isNaN(n))) return true;
    if (p[0] === 10 || p[0] === 127 || p[0] === 0) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;
    if (p[0] === 192 && p[1] === 0 && p[2] === 0) return true;
    if (p[0] === 198 && (p[1] === 18 || p[1] === 19)) return true;
    if (p[0] >= 224) return true;
    return false;
  }
  private htmlToText(html: string, max = 40000): { title: string; text: string } {
    const h = String(html || '');
    const tm = h.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = tm ? tm[1].replace(/\s+/g, ' ').trim().slice(0, 200) : '';
    let body = h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
    body = body.replace(/<(br|\/p|\/div|\/h[1-6]|\/li)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ');
    body = body.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
    body = body.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
    return { title, text: body.slice(0, max) };
  }
  async ingestHtml(html: string) {
    const r = this.htmlToText(html);
    return { source: 'html', title: r.title, text: r.text, chars: r.text.length };
  }
  async ingestUrl(url: string) {
    const u = String(url || '').trim();
    let parsed: any;
    try { parsed = new URL(u); } catch { throw new BadRequestException('Enter a valid URL.'); }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new BadRequestException('Only http/https URLs are allowed.');
    try {
      const dnsMod: any = require('dns').promises;
      const addrs: any[] = await dnsMod.lookup(parsed.hostname, { all: true });
      if (!addrs.length || addrs.some((x: any) => this.isBlockedIp(x.address))) throw new BadRequestException('That host is not allowed.');
    } catch (e: any) { if (e instanceof BadRequestException) throw e; throw new BadRequestException('Could not resolve that host.'); }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res: any = await fetch(u, { redirect: 'error', signal: ctrl.signal, headers: { 'User-Agent': 'ScripON-Ingest/1.0', Accept: 'text/html,text/plain' } } as any);
      const ct = String(res.headers.get('content-type') || '');
      if (!/text\/html|text\/plain|application\/xhtml/i.test(ct)) throw new BadRequestException('That URL did not return readable text.');
      const raw = await res.text();
      const r = this.htmlToText(raw.slice(0, 2500000));
      return { source: 'url', url: u, title: r.title, text: r.text, chars: r.text.length };
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('Could not fetch that URL (redirects blocked; size and time limits apply).');
    } finally { clearTimeout(timer); }
  }

  // C4 — character/role TYPE profiles (NO performer names or photos); grounded in scenes + Scenes-%.
  async roleProfiles(opts: any, userId?: string) {
    const r = await this.resolveRevision(opts);
    const scenes: any[] = await (this.prisma as any).scriptScene.findMany({ where: { revisionId: r.revisionId }, orderBy: { sortOrder: 'asc' }, select: { sceneNumber: true, slugline: true, description: true } }).catch(() => []);
    if (!scenes.length) throw new BadRequestException('This script has no parsed scenes yet — import or break it down first.');
    const sceneLines = scenes.map((sc, i) => (sc.sceneNumber || (i + 1)) + '. ' + (sc.slugline || '') + (sc.description ? ' - ' + sc.description : '')).join('\n').slice(0, 12000);
    const system = 'You are a casting director writing CHARACTER TYPE briefs — never naming real actors. Return ONLY JSON {roles:[{role, importance, ageRange, gender, physicality, energy, arc, wardrobeNote}]}. role = character name as written; importance = LEAD|SUPPORTING|MINOR; ageRange like 30s; physicality, energy, arc, wardrobeNote = one concrete phrase each describing the CHARACTER, not any performer. Do NOT suggest or name any actor. No text outside the JSON.';
    const ai: any = (await this.ai.json({ task: 'scripton.roleProfiles', system, user: sceneLines, maxTokens: 2500, projectId: r.projectId, refType: 'ScriptRevision', refId: r.revisionId })) || {};
    const corpus = scenes.map((sc) => ((sc.slugline || '') + ' ' + (sc.description || '')).toUpperCase());
    const roles = (Array.isArray(ai.roles) ? ai.roles : []).map((c: any) => {
      const nm = String((c && c.role) || '').toUpperCase().trim(); const tok = nm.split(/\s+/)[0];
      const cnt = tok ? corpus.filter((t) => t.indexOf(tok) >= 0).length : 0;
      return { role: (c && c.role) || '', importance: (c && c.importance) || '', ageRange: (c && c.ageRange) || '', gender: (c && c.gender) || '', physicality: (c && c.physicality) || '', energy: (c && c.energy) || '', arc: (c && c.arc) || '', wardrobeNote: (c && c.wardrobeNote) || '', scenesPct: scenes.length ? Math.round((100 * cnt) / scenes.length) : 0 };
    });
    try {
      await (this.prisma as any).roleProfile.deleteMany({ where: { revisionId: r.revisionId } }).catch(() => {});
      for (const rp of roles) await (this.prisma as any).roleProfile.create({ data: { projectId: r.projectId, revisionId: r.revisionId, role: String(rp.role).slice(0, 120), importance: rp.importance || null, ageRange: rp.ageRange || null, gender: rp.gender || null, physicality: rp.physicality || null, energy: rp.energy || null, arc: rp.arc || null, wardrobeNote: rp.wardrobeNote || null, scenesPct: rp.scenesPct } }).catch(() => {});
    } catch (e) { /* tolerant */ }
    return { revisionId: r.revisionId, roles };
  }

  // C4 — world/location/era look-board PLAN (no faces, no performers): descriptors + search queries; image binding is a later pass.
  async lookboardPlan(opts: any, userId?: string) {
    const r = await this.resolveRevision(opts);
    const scenes: any[] = await (this.prisma as any).scriptScene.findMany({ where: { revisionId: r.revisionId }, orderBy: { sortOrder: 'asc' }, select: { slugline: true, setName: true } }).catch(() => []);
    const intake: any = await (this.prisma as any).intakeProfile.findUnique({ where: { projectId: r.projectId } }).catch(() => null);
    const setCtx = intake ? ['era ' + (intake.settingEra || ''), 'culture ' + (intake.cultureEra || ''), 'tone ' + (intake.tone || '')].filter((x) => x.length > 6).join(' | ') : '';
    const locs = Array.from(new Set(scenes.map((sc) => sc.setName || (sc.slugline || '').replace(/^(INT|EXT)[^A-Za-z]*/i, '')).filter(Boolean))).slice(0, 30).join('; ');
    const system = 'You are an art director assembling a look-board for a film. Return ONLY JSON {boards:[{kind, caption, query}]} of 8-14 items. kind = LOCATION|WORLD|ERA|PALETTE|MOOD. caption = one phrase describing the visual reference. query = 3-6 search words for a stock-photo search. NEVER reference faces, actors, or specific people — locations, architecture, landscape, textures, colour, light only. No text outside the JSON.';
    const user = 'SETTING: ' + (setCtx || 'contemporary') + '\nKEY LOCATIONS: ' + (locs || 'n/a');
    const ai: any = (await this.ai.json({ task: 'scripton.lookboardPlan', system, user, maxTokens: 1500, projectId: r.projectId, refType: 'ScriptRevision', refId: r.revisionId })) || {};
    const boards = (Array.isArray(ai.boards) ? ai.boards : []).map((b: any) => ({ kind: String((b && b.kind) || 'MOOD').toUpperCase(), caption: (b && b.caption) || '', query: (b && b.query) || '' }));
    try {
      await (this.prisma as any).lookboardImage.deleteMany({ where: { projectId: r.projectId } }).catch(() => {});
      for (const b of boards) await (this.prisma as any).lookboardImage.create({ data: { projectId: r.projectId, kind: ['LOCATION', 'WORLD', 'ERA', 'PALETTE', 'MOOD'].indexOf(b.kind) >= 0 ? b.kind : 'MOOD', url: '', caption: String(b.caption).slice(0, 200), source: 'plan', provenance: { query: b.query } } }).catch(() => {});
    } catch (e) { /* tolerant */ }
    return { projectId: r.projectId, boards, note: 'Look-board plan generated (no faces). Image binding to licensed sources is a later pass.' };
  }

  // C5 — honest market read: budget-tier comps (by theme, not plot) + four-quadrant + low/mid/high ranges (estimates).
  async marketRead(opts: any, userId?: string) {
    const r = await this.resolveRevision(opts);
    const scenes: any[] = await (this.prisma as any).scriptScene.findMany({ where: { revisionId: r.revisionId }, orderBy: { sortOrder: 'asc' }, select: { sceneNumber: true, slugline: true, description: true } }).catch(() => []);
    if (!scenes.length) throw new BadRequestException('This script has no parsed scenes yet — import or break it down first.');
    const facts = this.facts(scenes);
    const intake: any = await (this.prisma as any).intakeProfile.findUnique({ where: { projectId: r.projectId } }).catch(() => null);
    const budgetTier = (opts && opts.budgetTier) || (intake && intake.budgetTier) || 'unspecified';
    const ctx = [intake && intake.genres ? ('genres ' + (Array.isArray(intake.genres) ? intake.genres.join(', ') : intake.genres)) : '', intake && intake.tone ? ('tone ' + intake.tone) : '', intake && intake.format ? ('format ' + intake.format) : '', intake && intake.country ? ('market ' + intake.country) : ''].filter(Boolean).join(' | ');
    const sceneLines = scenes.map((sc, i) => (sc.sceneNumber || (i + 1)) + '. ' + (sc.slugline || '') + (sc.description ? ' - ' + sc.description : '')).join('\n').slice(0, 8000);
    const system = 'You are a development and finance analyst producing an HONEST market read. Return ONLY JSON {comps:[{title, year, budgetTier, metric, rationale}], quadrant:{maleUnder25, maleOver25, femaleUnder25, femaleOver25, primary}, ranges:{basis, low, mid, high}, confidence, whyNow, disclaimer}. comps = 5-7 comparable titles chosen by THEME, tone, budget band and recency (last ~5 years), NOT plot similarity; metric = a short real-performance note if known. quadrant values = LOW|MEDIUM|HIGH reach; primary = the strongest quadrant. ranges = low/mid/high outcomes (P10/P50/P90 style) with a one-line basis; these are ESTIMATES with wide uncertainty. confidence = LOW|MEDIUM (never HIGH; no one can guarantee box office). disclaimer = a one-line honesty note. No text outside the JSON.';
    const user = 'CONTEXT: ' + (ctx || 'n/a') + ' | BUDGET TIER: ' + budgetTier + ' | FACTS: ' + JSON.stringify(facts) + '\nSCENES:\n' + sceneLines;
    const ai: any = (await this.ai.json({ task: 'scripton.marketRead', system, user, maxTokens: 2500, projectId: r.projectId, refType: 'ScriptRevision', refId: r.revisionId })) || {};
    const comps = Array.isArray(ai.comps) ? ai.comps : [];
    let mrId: string | null = null;
    try {
      await (this.prisma as any).comp.deleteMany({ where: { projectId: r.projectId } }).catch(() => {});
      for (const c of comps) await (this.prisma as any).comp.create({ data: { projectId: r.projectId, title: String((c && c.title) || '').slice(0, 160), year: (c && Number(c.year)) || null, budgetTier: (c && c.budgetTier) || null, metrics: { metric: (c && c.metric) || '' }, source: 'ai', rationale: (c && c.rationale) || '' } }).catch(() => {});
      const mr: any = await (this.prisma as any).marketRead.create({ data: { projectId: r.projectId, revisionId: r.revisionId, quadrant: ai.quadrant || {}, ranges: ai.ranges || {}, confidence: ai.confidence || 'LOW', notes: ai.whyNow || '' } });
      mrId = mr && mr.id;
    } catch (e) { /* tolerant */ }
    return { id: mrId, comps, quadrant: ai.quadrant || {}, ranges: ai.ranges || {}, confidence: ai.confidence || 'LOW', whyNow: ai.whyNow || '', disclaimer: ai.disclaimer || 'Estimates only — no one can guarantee commercial performance.' };
  }

  // C6 — living coverage: scene-anchored, resolvable notes.
  async addNote(opts: any, userId?: string) {
    const projectId = String((opts && opts.projectId) || ''); if (!projectId) throw new BadRequestException('Project required.');
    return (this.prisma as any).coverageNote.create({ data: { projectId, revisionId: (opts && opts.revisionId) || null, sceneId: (opts && opts.sceneId) || null, sceneNumber: (opts && opts.sceneNumber) || null, category: (opts && opts.category) || null, kind: String((opts && opts.kind) || 'NOTE').toUpperCase(), body: String((opts && opts.body) || '').slice(0, 4000), createdById: userId || null } });
  }
  async listNotes(projectId: string, revisionId?: string) {
    const where: any = { projectId }; if (revisionId) where.revisionId = revisionId;
    return (this.prisma as any).coverageNote.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 }).catch(() => []);
  }
  async resolveNote(id: string, resolved: boolean) {
    return (this.prisma as any).coverageNote.update({ where: { id }, data: { resolved: resolved !== false } });
  }
  async deleteNote(id: string) {
    await (this.prisma as any).coverageNote.delete({ where: { id } }).catch(() => {});
    return { ok: true };
  }
  // Seed scene-anchored notes from a quick diagnostic pass.
  async seedNotes(opts: any, userId?: string) {
    const diag: any = await this.diagnostics(opts);
    const created: any[] = [];
    for (const d of (diag.scenes || [])) {
      const verdict = String(d.verdict || '').toUpperCase();
      if (!d.fix && verdict !== 'CUT' && verdict !== 'TIGHTEN') continue;
      const kind = (verdict === 'CUT' || verdict === 'TIGHTEN') ? 'CONCERN' : 'NOTE';
      const body = d.fix || (d.objective ? ('Objective: ' + d.objective) : 'Review this scene.');
      try { const row: any = await (this.prisma as any).coverageNote.create({ data: { projectId: opts.projectId, revisionId: diag.revisionId || null, sceneId: d.id || null, sceneNumber: d.sceneNumber || null, category: 'structure', kind, body: String(body).slice(0, 4000), createdById: userId || null } }); created.push(row); } catch (e) { /* skip */ }
    }
    return { revisionId: diag.revisionId, created: created.length, notes: created };
  }
  // Flag notes whose anchored scene changed between the compared revisions (revision-aware coverage).
  async notesStale(opts: any) {
    const cmp: any = await this.compare(opts);
    const changed = new Set((cmp.changes || []).map((c: any) => String(c.key || '').toUpperCase()));
    const notes: any[] = await (this.prisma as any).coverageNote.findMany({ where: { projectId: opts.projectId } }).catch(() => []);
    const stale = notes.filter((n: any) => n.sceneNumber && changed.has(String(n.sceneNumber).toUpperCase()));
    return { from: cmp.from, to: cmp.to, changedScenes: Array.from(changed).slice(0, 200), staleNoteIds: stale.map((n: any) => n.id), staleCount: stale.length };
  }

  // C6 — assemble the full lookbook payload (coverage + roles + boards + comps + market) for the designed PDF.
  async lookbook(opts: any) {
    const r = await this.resolveRevision(opts);
    const out: any[] = await Promise.all([
      (this.prisma as any).coverageReport.findMany({ where: { projectId: r.projectId }, orderBy: { createdAt: 'desc' }, take: 1 }).catch(() => []),
      (this.prisma as any).roleProfile.findMany({ where: { revisionId: r.revisionId } }).catch(() => []),
      (this.prisma as any).lookboardImage.findMany({ where: { projectId: r.projectId } }).catch(() => []),
      (this.prisma as any).comp.findMany({ where: { projectId: r.projectId } }).catch(() => []),
      (this.prisma as any).marketRead.findMany({ where: { projectId: r.projectId }, orderBy: { createdAt: 'desc' }, take: 1 }).catch(() => []),
    ]);
    return { projectId: r.projectId, revisionId: r.revisionId, title: r.title || null, coverage: out[0][0] || null, roles: out[1] || [], boards: out[2] || [], comps: out[3] || [], market: out[4][0] || null, generatedAt: new Date().toISOString() };
  }



}
