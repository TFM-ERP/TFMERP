import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import { CanonService } from './canon/canon.service';
import { computeFacts, parseJsonArray } from './scripton.util';
import { LORE_SEED } from './lore-seed.data';
import { knowledgeDirective, stageLadderFor, normalizeFamily } from './knowledge';
import { parseScenes } from '../script/scene-parse.util';
import { seriesSceneCount } from './series-scene-count.util';
import {
  planFeatureLength, applyPageWeights, lineBudgetFor, snapPageWeight, countVisualLines,
  expansionCandidates, isLengthComplete, isLengthOver, completionRatio,
  remainingBudgetScale, LINES_PER_PAGE, planSliceBudget, planSliceInstruction, MIN_PLANNED_SCENES,
  genreProfileTable,
  type FeatureLengthPlan, type LineBudget, type GenreOverride, type GenreProfileRow,
} from './feature-length.util';
import {
  classifyLine, nextInSpeech, checkScene, checkDraftContinuity, checkPlanCast, stripExitedCast,
  collectExits, unavailableLine, dedupeScenes, repairInstruction, summariseContinuity,
  exitsAsCanonFacts, findNameDrift, canonicaliseNames, splitCast, trimToSentence,
  classifyScript, normaliseCharacterName,
  splitAtSecondDocument,
  type LineKind, type CastExit, type ContinuityFinding,
  checkSceneIntegrity, sceneDefectInstruction, shortenSlugLocation,
  findTimeTokens, checkStatedTimeOrder,
  findAllTimeTokens, checkClockRegression, isRecalledTime,
  checkPropContinuity, spineDirective, isPropState, type PropEvent,
  findMetaCommentary, stripMetaCommentary,
  collectWrittenDeaths, writtenDeathsAsExits,
  checkFixedAttributes,
  findFlashbackMismatches,
  findFragmentRuns, findFalseSceneBreaks, findEchoedPhrases,
  type SceneDefect, type TimeToken,
} from './continuity.util';
import {
  createRegistry, registerEntity, resolveEntity, allForms, auditLedger, ledgerFindingInstruction,
  isTransitPlace, slugSaysContinuous,
  type EntityRegistry, type StateFact, type PlaceObservation,
} from './entity-registry.util';
import { mapAiFactsToCore } from './canon/canon-map.util';
import { canonDirective } from './canon/canon-inject.util';
import type { CanonFactCore } from './canon/canon.types';
import { excerptSource, sourceMaterialBlock, SOURCE_EXCERPT_CHARS } from './source-excerpt.util';
import { buildPackageDocModel } from './package-docx.util';
import { packDocx } from './package-docx.renderer';
import { LEVER_KEYS, resolveLever } from './intake-levers.util';
import { resolveCollabMode } from './collab-mode.util';
import { isProviderExhausted, isStubRunaway, isHalt, ScriptGenerationHalted, STUB_STREAK_ABORT, HaltKind } from './provider-health.util';
import { htmlToText as htmlToTextUtil, extractText, uploadBasename, assembleCorpus, canReuseExtraction, kindOf, kindFromContentType, MAX_REMOTE_BYTES } from './source-ingest.util';
import { segmentPassages, batchPassages, applyVerdicts, buildSourceBible, passageBody, residualPaste, SourceDoc, Passage, SourceBible } from './source-classify.util';
import { coerceRecommendations, recommendableFields, salvageRows, FIELD_SPECS, Recommendation } from './brief-recommend.util';
import { verdictFor, abandonedMessage } from './stage-jobs.util';
import { buildSetList, setListBrief } from './set-list.util';
import { readFile } from 'fs/promises';
import { join, resolve, sep } from 'path';

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
  /**
   * Generation-path logger. This service swallows failure by design — nearly every DB call is
   * `.catch(() => null)` and the AI calls fall through on error — which is deliberate (a broken
   * canon table must not 500 the Doctor) but means a real fault reads to the user as "empty result".
   * Everything on the generate/render path now says so out loud. Logging only: no control flow here
   * depends on it, so a logger failure can never change what the pipeline does.
   */
  private readonly log = new Logger(ScripOnService.name);
  private why(e: any): string { return String((e && (e.message || e)) || 'unknown').replace(/\s+/g, ' ').slice(0, 300); }
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
      const d = dedupeScenes(scenes.concat(more));
      if (d.dropped.length) this.log.warn('scene outline: continuation pass ' + passes + ' repeated '
        + d.dropped.length + ' scene(s) already mapped — dropped.');
      scenes = d.scenes;
      if (scenes.length <= before) break; // a pass added nothing new → stop
    }

    scenes = scenes.map((s, i) => ({ ...s, sceneNumber: i + 1 })); // clean sequential numbering across concatenated passes
    const warning = !scenes.length
      ? 'Scene outline generation returned no scenes — re-run.'
      : (truncated(last) ? ('Scene outline may be incomplete — still truncating after ' + passes + ' continuation pass(es) (' + scenes.length + ' scenes). Re-run or raise the cap.') : undefined);
    return { stage: 'scenes', spine, output, beats: [], scenes, passes, warning };
  }

  /** P6 — Adaptation slate: book/source -> THREE distinct screen-adaptation directions, grounded in the supplied source. Proposal only. */
  async adapt(opts: any) {
    // The gate reads the MATERIALISED corpus. It used to read opts.sourceText alone, which was the
    // paste boxes only — so a build with two uploaded files failed here saying "paste a synopsis".
    const fromSources = Array.isArray(opts?.sources)
      ? opts.sources.map((s: any) => String((s && s.text) || '')).filter((t: string) => t.trim()).join('\n\n')
      : '';
    // `||` short-circuits: a typed synopsis ALONE used to hide any uploaded files from this gate
    // entirely. Concatenate both, and — like adaptOne just below — fall back to the MATERIALISED
    // corpus already on the IntakeProfile when neither opts field carries enough on its own.
    let source = [String(opts?.sourceText || opts?.source || ''), fromSources].filter((t) => t.trim()).join('\n\n');
    if (source.trim().length < 40 && opts?.projectId) {
      const i: any = await (this.prisma as any).intakeProfile.findUnique({ where: { projectId: opts.projectId } }).catch(() => null);
      source = String((i && i.sourceText) || '') || source;
    }
    if (source.trim().length < 40) throw new BadRequestException('Add a synopsis, a file or a link to the source work (a few sentences minimum).');
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
    // ── AI video (vertical, ~5s text-to-video) ──
    if (kind === 'SHOT_LIST') return { system: base + 'Break the PREMISE into an ordered SHOT LIST for a short vertical (9:16) AI video. Each shot is ONE observable, physical action — no abstractions. Carry exact, consistent character/physical tags across shots, with a camera movement and the setting. Keep it tight (the whole piece is only a few seconds). Return {output, shots:[{index, action, characters, camera_movement, setting}]}.', shape: '{output, shots}' };
    if (kind === 'VIDEO_PROMPT') return { system: 'You are an elite AI Cinematic Director. Stay true to the prior PREMISE and SHOT_LIST and the creative brief. Break the story into a strict JSON array of visual shots. Each shot represents EXACTLY the requested video duration. Honour the FORMAT CRITICAL rules in the brief (observable physical motion only; exact character tags; ONE primary action per shot). Fill EVERY structured field of each shot (location, subject, wardrobe, facial_expression, body_language, shot_size, camera_angle, lens, camera_movement, zoom, lighting, color_style, audio_fx_ambiance) — these structured fields ARE the generation spec the engine relies on. Then write each "prompt" as a COMPLETE, self-contained cinematic description — Subject + Action + Camera move + Scene/Lighting + Style, ~40-120 words — with the camera move and lighting baked into the sentence so any text-to-video engine (local ComfyUI, Runway or ByteDance Seedance) renders it faithfully without reading the other fields. Describe camera and subject motion separately, and avoid the word "fast" (it causes jitter). Return ONLY JSON, no text outside it.', shape: 'Return ONLY JSON matching this exact structure:\n{\n  "format": "VERTICAL_AI_VIDEO",\n  "aspectRatio": "9:16",\n  "shots": [\n    {\n      "index": 0,\n      "durationSec": 5,\n      "location": "<set / environment + time of day + weather — the continuity lock>",\n      "subject": "<character: the stable identity phrase, repeated verbatim in every scene>",\n      "wardrobe": "<outfit / costume>",\n      "facial_expression": "<emotion tokens, e.g. micro-smile, eye glint, brows easing across the shot>",\n      "body_language": "<posture + the ONE primary physical action>",\n      "shot_size": "<CU | MCU | MS | WS | EWS>",\n      "camera_angle": "<eye-level | low | high | dutch | overhead>",\n      "lens": "<e.g. 24mm wide | 50mm natural | 85mm portrait | 135mm compressed>",\n      "camera_movement": "<e.g. slow push-in, pan right, dolly>",\n      "zoom": "<none | slow zoom-in | snap zoom>",\n      "lighting": "<key/fill/rim + direction + colour temp (3200K warm / 5600K cool) + quality (hard/diffused) + volumetrics>",\n      "color_style": "<palette + film look, e.g. amber-and-shadow, anamorphic, fine grain>",\n      "reading_dialogue": "<Character: line or None>",\n      "audio_fx_ambiance": "<ambient + sfx + music cue; Seedance synthesises native audio>",\n      "prompt": "<COMPLETE self-contained text-to-video prompt assembled from the fields above: front-load Subject + Action, then Camera (size/angle/lens/move), then Lighting/Style; ~40-120 words; observable physical motion only; keep the identity phrase verbatim>",\n      "negativePrompt": "<the exact negative prompt provided in the directive>",\n      "seed": <integer>\n    }\n  ]\n}' };
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
  /**
   * Measured duration per stage, in seconds — taken from real AiRun latencies on this install, not
   * guessed. The ladder previously told every stage "this can take a minute or two"; DRAFT actually
   * runs ~7 minutes because it is a single 25,000-token generation (roughly ten times the output of
   * any other stage). Telling the truth is half the fix.
   */
  private static readonly STAGE_ETA_SEC: Record<string, number> = {
    LOGLINE: 5, PREMISE: 15, THESIS: 20, SYNOPSIS: 30, STORY_ENGINE: 30, COVERAGE: 30,
    RIGHTS_PLAN: 30, RESEARCH_PLAN: 40, INTERVIEW_OUTLINE: 60,
    STEP_OUTLINE: 90, TREATMENT: 90, BEATS: 90, SCENES: 130,
    BEAT_ENGINE: 150, SHOT_LIST: 150, VIDEO_PROMPT: 150,
    SEASON_ARC: 180, EPISODE_MAP: 180, PAPER_EDIT: 180, NARRATION: 180,
    DRAFT: 420,
  };

  /**
   * In-flight ladder generations, keyed project:build:kind.
   *
   * WHY: generateStage() is synchronous and DRAFT takes ~7 minutes, so the ladder held one blocking
   * HTTP request open for that whole time with no heartbeat — a working generation and a dead one
   * looked identical, and any proxy, tunnel, sleep or backend restart killed the client's view of a
   * run that was actually succeeding. The work was never lost (the StageVersion is persisted before
   * generateStage returns) but the UI only discovered it on a manual refresh.
   *
   * This mirrors the feature writer's genProgress: start the work, return a handle, poll for the
   * result. Same caveat too — in-memory, so a restart loses the handle (not the work). Persisting it
   * is the same fix as persisting genProgress and they should land together.
   */
  private stageJobs = new Map<string, {
    key: string; kind: string; projectId: string; buildId?: string | null;
    status: 'RUNNING' | 'DONE' | 'ERROR'; startedAt: number; finishedAt?: number;
    elapsedSec: number; estimateSec: number; versionId?: string; versionN?: number;
    warning?: string; error?: string;
  }>();

  private stageJobKey(projectId: string, buildId: any, kind: string): string {
    return String(projectId) + ':' + String(buildId || '') + ':' + String(kind || '').toUpperCase();
  }

  /**
   * Sweep the job map: drop finished jobs past their readable window, and FAIL jobs that are still
   * marked RUNNING long after any plausible completion.
   *
   * The second half is the repair. The old rule was `status !== 'RUNNING' && finishedAt < cutoff`,
   * which never collected a running job at any age - so one generation that never settled left a
   * RUNNING entry in this map forever, and `startStage` returns the existing handle whenever it finds
   * one. That stage became permanently unclickable: no error, no warning, no new version, just a
   * valid-looking response describing work that was not happening. Only a restart cleared it, because
   * the map is in memory, which is why it presented as intermittence rather than as a lock.
   *
   * AN ABANDONED JOB IS MARKED ERROR, NOT DELETED. Deleting it would unblock the stage and say
   * nothing; the writer would click Generate and never learn that the previous run died. Marking it
   * ERROR unblocks the stage (the RUNNING guard stops matching), tells the poller exactly what
   * happened, and lets the normal 10-minute window collect the row afterwards. A silent lock becomes
   * a visible failure, which is the whole point.
   *
   * The thresholds live in stage-jobs.util.ts with their own tests, and are deliberately generous:
   * reaping a LIVE run would let the next click start a second expensive generation, which is the
   * exact thing the RUNNING guard exists to prevent.
   */
  private pruneStageJobs(): void {
    const now = Date.now();
    for (const [k, j] of this.stageJobs) {
      const verdict = verdictFor(j, now);
      if (verdict === 'expired') { this.stageJobs.delete(k); continue; }
      if (verdict !== 'abandoned') continue;
      j.status = 'ERROR';
      j.finishedAt = now;
      j.elapsedSec = Math.round((now - j.startedAt) / 1000);
      j.error = abandonedMessage(j.kind, j.startedAt, now);
      this.log.error('pruneStageJobs: ' + j.kind + ' for ' + j.projectId + ' never settled after '
        + j.elapsedSec + 's - marking ERROR so the stage is not blocked. The model call almost'
        + ' certainly hung; check that this stage passes a timeoutMs.');
    }
  }

  /**
   * Start a ladder stage in the background and return a handle immediately. Re-requesting a stage
   * that is already running returns the SAME job rather than starting a second generation — a
   * double-click on Generate used to buy two 7-minute Anthropic calls.
   */
  async startStage(opts: any, userId?: string) {
    const projectId = String(opts?.projectId || '');
    const kind = String(opts?.kind || '').toUpperCase();
    if (!projectId || !kind) throw new BadRequestException('A project and a stage are required.');
    this.pruneStageJobs();
    const key = this.stageJobKey(projectId, opts?.buildId, kind);
    const running = this.stageJobs.get(key);
    if (running && running.status === 'RUNNING') {
      this.log.log('startStage: ' + kind + ' already running for ' + key + ' — returning the existing job.');
      return this.stageJob(key);
    }
    const estimateSec = ScripOnService.STAGE_ETA_SEC[kind] || 60;
    const job = {
      key, kind, projectId, buildId: opts?.buildId || null,
      status: 'RUNNING' as const, startedAt: Date.now(), elapsedSec: 0, estimateSec,
    };
    this.stageJobs.set(key, job);
    this.log.log('startStage: ' + kind + ' for project ' + projectId + ' — running in the background, ETA ~' + estimateSec + 's.');
    // Fire and forget. generateStage persists the StageVersion itself, so the result survives even
    // if this handle is lost; the poll below is only how the client learns about it.
    void this.generateStage(opts, userId)
      .then((created: any) => {
        const j = this.stageJobs.get(key);
        if (!j) return;
        j.status = 'DONE'; j.finishedAt = Date.now();
        j.elapsedSec = Math.round((j.finishedAt - j.startedAt) / 1000);
        j.versionId = created && created.id; j.versionN = created && created.n;
        if (created && created.warning) j.warning = String(created.warning);
        this.log.log('startStage: ' + kind + ' DONE in ' + j.elapsedSec + 's (estimate was ' + estimateSec + 's) — version ' + j.versionId + '.');
      })
      .catch((e: any) => {
        const j = this.stageJobs.get(key);
        const msg = this.why(e);
        if (j) { j.status = 'ERROR'; j.finishedAt = Date.now(); j.elapsedSec = Math.round((j.finishedAt - j.startedAt) / 1000); j.error = msg; }
        this.log.error('startStage: ' + kind + ' FAILED for project ' + projectId + ' after ' + (j ? j.elapsedSec : '?') + 's — ' + msg);
      });
    return this.stageJob(key);
  }

  /**
   * Poll a stage job. `elapsedSec` and `progressPct` are computed on read so the client can render a
   * live bar without the server pushing anything. progressPct is an ESTIMATE against the measured
   * ETA — it is capped at 95% while RUNNING so it never claims to be finished before it is.
   */
  stageJob(key: string) {
    const j = this.stageJobs.get(String(key || ''));
    if (!j) return { key, status: 'UNKNOWN', elapsedSec: 0, estimateSec: 0, progressPct: 0 };
    const elapsedSec = j.status === 'RUNNING' ? Math.round((Date.now() - j.startedAt) / 1000) : j.elapsedSec;
    const progressPct = j.status === 'DONE' ? 100
      : j.status === 'ERROR' ? 0
      : Math.min(95, Math.round((elapsedSec / Math.max(1, j.estimateSec)) * 100));
    return {
      key: j.key, kind: j.kind, status: j.status, elapsedSec, estimateSec: j.estimateSec, progressPct,
      versionId: j.versionId || null, versionN: j.versionN || null,
      warning: j.warning || null, error: j.error || null,
      overdue: j.status === 'RUNNING' && elapsedSec > j.estimateSec * 2,
    };
  }

  /** Every in-flight or recently finished job for a project — lets the ladder restore state on reload. */
  stageJobsFor(projectId: string, buildId?: string) {
    this.pruneStageJobs();
    const out: any[] = [];
    for (const j of this.stageJobs.values()) {
      if (j.projectId !== String(projectId)) continue;
      if (buildId && String(j.buildId || '') !== String(buildId)) continue;
      out.push(this.stageJob(j.key));
    }
    return out;
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
    // ── The 6,000-character cap, and the two things that now travel with it ──────────────────────
    // The cap stays: 44,733 characters against eight ladder stages and then 130 scene calls is an
    // enormous bill for material mostly irrelevant to any one call. What changes is that the model
    // is no longer left to complete the missing 87% from imagination. It gets the FIXED FACTS
    // extracted from the whole document, and it is TOLD the source below is an excerpt.
    //
    // The facts come from sourceCanonFor, which reads the source and NOTHING ELSE. Using
    // extractCanon here would read the stage bodies too - and a synopsis written from this very
    // excerpt is exactly the document that must not be allowed to define the truth it was supposed
    // to be checked against. That circularity is how "Jason Vane" became canon (§21).
    const wantsSource = ['LOGLINE', 'SYNOPSIS', 'TREATMENT', 'BEATS', 'PREMISE', 'STORY_ENGINE', 'SEASON_ARC', 'THESIS'].indexOf(kind) >= 0;
    const rawSource = String(opts?.seed || (intakeRow && intakeRow.sourceText) || '');
    const excerpt = excerptSource(rawSource, SOURCE_EXCERPT_CHARS);
    // at 0: source facts are anchored at story order 0 by mapAiFactsToCore, so all of them are live.
    const sourceFacts = wantsSource && excerpt.truncated ? await this.sourceCanonFor(projectId, rawSource) : [];
    const srcBlock = wantsSource ? sourceMaterialBlock(canonDirective(sourceFacts, { at: 0, max: 30 }), excerpt) : '';
    if (wantsSource && excerpt.truncated) this.log.log('generateStage ' + kind + ': source is an excerpt - ' + excerpt.sent + ' of ' + excerpt.total + ' characters, with ' + sourceFacts.length + ' fixed fact(s) carried alongside it.');
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
    const jsonExact = kind === 'VIDEO_PROMPT'; // emit the exact JSON shape verbatim (format/aspectRatio are wanted output, not metadata to strip)
    const user = 'STAGE: ' + kind + (framework ? (' | FRAMEWORK: ' + framework) : '') + steer + researchBlock + srcBlock + soFarBlock + knowBlock + langDir + (draftRaw ? '\nWrite the screenplay now as plain text (no JSON, no metadata header).' : jsonExact ? '\n' + brief.shape : '\nReturn ONLY JSON ' + brief.shape + ' with NO title/format/rating/metadata fields.');
    // Generous ceilings (NOT targets) — the model stops when the stage is done; a high cap only prevents premature
    // truncation of long stages. Every "heavy" long-form stage (scene maps, treatments, beat maps, drafts, narration,
    // step outlines, season arcs) gets a 25,000-token ceiling, is STREAMED (no single long blocking request, and no
    // non-streaming long-request ceiling), and runs on a 600s overall + 120s idle budget — so a busy provider has time
    // to finish a big generation, while a true stall aborts in ~2 min and fails over to the next engine.
    const MAXTOK: any = { LOGLINE: 600, SYNOPSIS: 2400, TREATMENT: 25000, BEATS: 25000, SCENES: 25000, STEP_OUTLINE: 25000, DRAFT: 25000, COVERAGE: 2000, SEASON_ARC: 25000, EPISODE_MAP: 25000, PREMISE: 2400, STORY_ENGINE: 3500, BEAT_ENGINE: 25000, THESIS: 2400, RESEARCH_PLAN: 4000, RIGHTS_PLAN: 3000, INTERVIEW_OUTLINE: 5000, PAPER_EDIT: 25000, NARRATION: 25000, SHOT_LIST: 25000, VIDEO_PROMPT: 25000 };
    const HEAVY = ['SCENES', 'STEP_OUTLINE', 'DRAFT', 'TREATMENT', 'BEATS', 'EPISODE_MAP', 'BEAT_ENGINE', 'PAPER_EDIT', 'NARRATION', 'SEASON_ARC', 'SHOT_LIST', 'VIDEO_PROMPT'];
    const heavy = HEAVY.indexOf(kind) >= 0;
    // Keep the per-stage ceiling (25k for the long stages); opts.maxTokens only overrides for tests.
    const cap = Number(opts?.maxTokens) > 0 ? Number(opts.maxTokens) : (MAXTOK[kind] || 3000);
    // EVERY stage gets a timeout, not just the heavy ones. The light stages used to pass `undefined`,
    // which is what turned a stalled provider into a promise that never settled - the caller's job sat
    // at RUNNING forever and blocked that stage until the backend restarted (see pruneStageJobs). A
    // light stage's budget is derived from its own measured ETA rather than typed as a literal, so it
    // cannot drift away from STAGE_ETA_SEC, and it is floored at 2 minutes because the fastest stage
    // here has a 5-second ETA and a merely slow provider must not be cut off.
    const etaSec = ScripOnService.STAGE_ETA_SEC[kind] || 60;
    const callTimeoutMs = heavy ? 600000 : Math.max(120000, etaSec * 4000);
    const res: any = await this.ai.run({ task: 'scripton.develop.' + kind.toLowerCase(), system: brief.system, user, maxTokens: cap, stream: heavy, timeoutMs: callTimeoutMs, idleTimeoutMs: heavy ? 120000 : undefined, projectId, refType: 'Project', refId: projectId }); const ai: any = (res && res.json) || {};
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
    if (Array.isArray(ai.shots)) data.shots = ai.shots;
    if (kind === 'VIDEO_PROMPT' && ai && (ai.shots || ai.format)) data.videoPayload = { format: ai.format || 'VERTICAL_AI_VIDEO', aspectRatio: ai.aspectRatio || '9:16', shots: ai.shots || [] };
    if (ai.__warning) data.warning = ai.__warning; // persisted so a still-truncated outline is never silent
    const maxN = (stage.versions || []).reduce((m: number, v: any) => Math.max(m, v.n || 0), 0);
    const n = maxN + 1;
    const META = new Set(['title', 'format', 'rating', 'totalScenes', 'type', 'genre']);
    const flat = (v: any): string => { if (v == null) return ''; if (typeof v === 'string') return v; if (typeof v === 'number' || typeof v === 'boolean') return ''; if (Array.isArray(v)) return v.map(flat).filter(Boolean).join('\n\n'); if (typeof v === 'object') return Object.keys(v).filter((k) => !META.has(k)).map((k) => flat(v[k])).filter(Boolean).join('\n\n'); return String(v); };
    const stripFence = (t: string) => t.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
    // Recover complete shot objects from a (possibly token-cap-truncated) VIDEO_PROMPT array. Brace-matches each
    // top-level {…} inside "shots", string/escape aware, keeping every shot that parses; the cut-off trailing one
    // is dropped. Turns an unterminated 90 KB blob into a valid payload the render panel and persistence can use.
    const salvageVideoShots = (raw: string): { format: string; aspectRatio: string; shots: any[] } | null => {
      if (!raw) return null;
      const i = raw.indexOf('"shots"'); const lb = i >= 0 ? raw.indexOf('[', i) : -1;
      if (lb < 0) return null;
      const shots: any[] = []; let depth = 0, start = -1, inStr = false, esc = false;
      for (let p = lb + 1; p < raw.length; p++) {
        const ch = raw[p];
        if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
        if (ch === '"') { inStr = true; continue; }
        if (ch === '{') { if (depth === 0) start = p; depth++; }
        else if (ch === '}') { depth--; if (depth === 0 && start >= 0) { try { shots.push(JSON.parse(raw.slice(start, p + 1))); } catch { /* skip malformed */ } start = -1; } }
        else if (ch === ']' && depth === 0) break;
      }
      if (!shots.length) return null;
      const fmt = (raw.match(/"format"\s*:\s*"([^"]+)"/) || [])[1] || 'VERTICAL_AI_VIDEO';
      const ar = (raw.match(/"aspectRatio"\s*:\s*"([^"]+)"/) || [])[1] || '9:16';
      return { format: fmt, aspectRatio: ar, shots };
    };
    let body = '';
    if (kind === 'BEATS' && Array.isArray(data.beats) && data.beats.length) {
      body = data.beats.map((b: any) => ('■ ' + String(b.name || b.beatName || '') + (b.beat ? ' — ' + b.beat : '') + (b.purpose ? '\n   ' + b.purpose : '')).trim()).filter(Boolean).join('\n\n');
    } else if (kind === 'SCENES' && Array.isArray(data.scenes) && data.scenes.length) {
      body = data.scenes.map((sc: any) => ((sc.sceneNumber ? sc.sceneNumber + '. ' : '') + String(sc.slugline || sc.location || 'Scene') + (sc.synopsis ? '\n' + sc.synopsis : '') + (sc.purpose ? '\n   Purpose: ' + sc.purpose : '')).trim()).join('\n\n');
    } else if (kind === 'STEP_OUTLINE' && Array.isArray(data.steps) && data.steps.length) {
      body = data.steps.map((st: any, j: number) => ((st.n ?? j + 1) + '. ' + String(st.text || st.scene || '')).trim()).join('\n\n');
    } else if (kind === 'SHOT_LIST' && Array.isArray(data.shots) && data.shots.length) {
      body = data.shots.map((s: any, j: number) => ((s.index ?? j) + '. ' + String(s.action || s.prompt || 'Shot') + (s.camera_movement ? '  [' + s.camera_movement + ']' : '')).trim()).join('\n');
    } else if (kind === 'VIDEO_PROMPT') {
      let payload: any = (ai && (ai.shots || ai.format)) ? ai : (() => { try { return JSON.parse(stripFence(String((res && res.text) || ''))); } catch { return null; } })();
      // Token-cap truncation leaves the JSON unterminated → recover every complete shot so the stage stays usable.
      if (!payload || !Array.isArray(payload.shots) || !payload.shots.length) {
        const salv = salvageVideoShots(stripFence(String((res && res.text) || '')));
        if (salv && salv.shots.length) payload = salv;
      }
      if (payload && Array.isArray(payload.shots) && payload.shots.length) {
        payload = { format: payload.format || 'VERTICAL_AI_VIDEO', aspectRatio: payload.aspectRatio || '9:16', shots: payload.shots };
        data.shots = payload.shots;                 // reliable structured copy for the render panel + persistence
        data.videoPayload = payload;
        body = JSON.stringify(payload, null, 2);     // always valid JSON, never a truncated blob
      } else {
        body = stripFence(String((res && res.text) || ''));
      }
    } else if (draftRaw) {
      body = (typeof ai.output === 'string' && ai.output.trim()) ? ai.output.trim() : stripFence(String((res && res.text) || ''));
    } else {
      body = flat(ai.output ?? ai.logline ?? ai.synopsis ?? ai.treatment ?? ai.draft ?? ai.text ?? ai.content).trim();
      if (!body) body = this.salvageProse(String((res && res.text) || '')) || stripFence(String((res && res.text) || ''));
    }
    if (/^[\[{][\s\S]*"(output|scenes|steps|beats)"\s*:/.test(body)) { try { const j: any = JSON.parse(body); const re = flat(j.output ?? j).trim(); if (re) body = re; } catch { /* leave as-is */ } }
    if (/^[\[{]/.test(body.trim()) && kind !== 'VIDEO_PROMPT') { const sv = this.salvageProse(body); if (sv) body = sv; }
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

  /**
   * TURN EVERY SUBMITTED SOURCE INTO TEXT.
   *
   * The defect this fixes: ScriptOnIntake built its aggregate from paste boxes only
   * (`[f.sourceText].concat(pastes)`), so uploaded files and URLs were carried as URL strings that
   * nothing ever opened. A build with two PDFs and an empty paste box reached the adapt gate with an
   * empty source and was told to "paste a synopsis" — and when pushed through, invented a story.
   *
   * Runs at intake save, so every existing consumer (adapt, the ladder, sourceMat, the canon
   * extractor) sees real material without being changed.
   *
   * NEVER FATAL. A source that cannot be read is recorded with a note naming it, and the others go on.
   */
  private async materialiseSources(data: any, projectId?: string): Promise<any> {
    if (!data || !Array.isArray(data.sources) || !data.sources.length) return data;
    const uploadsDir = resolve(join(process.cwd(), 'uploads'));

    // I3: every intake save used to re-parse every file and re-fetch every URL, serially, through an
    // 8s-per-source timeout — so editing one unrelated field with several sources attached redid all
    // of that work on every save. Load what's already on record once, up front, and skip re-extracting
    // any source whose value hasn't changed since (canReuseExtraction is deliberately conservative:
    // no previous record, no positional match, or empty incoming text all fall through to re-extract).
    let prevSources: any[] = [];
    if (projectId) {
      try {
        const existing: any = await (this.prisma as any).intakeProfile.findUnique({ where: { projectId }, select: { sources: true } });
        prevSources = Array.isArray(existing?.sources) ? existing.sources : [];
      } catch { prevSources = []; }
    }

    const out: any[] = [];
    for (let idx = 0; idx < data.sources.length; idx++) {
      const s = data.sources[idx];
      const src: any = { ...(s || {}) };
      if (canReuseExtraction(src, prevSources[idx])) {
        src.chars = String(src.text || '').length;
        out.push(src);
        continue;
      }
      try {
        if (src.kind === 'paste') {
          src.text = String(src.value || '');
        } else if (src.kind === 'url') {
          const r: any = await this.ingestUrl(String(src.value || ''));
          src.text = String((r && r.text) || '');
          if (r && r.title && !src.name) src.name = r.title;
        } else if (src.kind === 'file') {
          const base = uploadBasename(src.value);
          const full = base ? resolve(join(uploadsDir, base)) : null;
          if (!full || (full !== uploadsDir && !full.startsWith(uploadsDir + sep))) {
            src.text = ''; src.note = 'this file could not be located';
          } else {
            const bytes = await readFile(full);
            // Type dispatch must key off the STORED name (`base`, e.g. "<uuid>.pdf") — a
            // client-supplied display name with no extension ("My Novel") would otherwise make a
            // real PDF decode as junk. `src.name` stays for the warning line below, unaffected.
            const ex = await extractText(bytes, base);
            src.text = ex.text;
            if (ex.note) src.note = ex.note;
          }
        } else {
          src.note = 'this source kind is not recognised';
        }
      } catch (e: any) {
        src.text = '';
        src.note = 'could not be read — ' + this.why(e);
      }
      src.chars = String(src.text || '').length;
      out.push(src);
    }
    const unreadable = out.filter((s) => s.note).map((s) => (s.name || s.kind) + ': ' + s.note);
    if (unreadable.length) this.log.warn('materialiseSources: ' + unreadable.length + ' source(s) could not be read — ' + unreadable.join(' · '));
    // The main paste box (data.sourceText) is a field separate from the extra paste boxes among
    // `out` — assembleCorpus folds it in explicitly so it survives alongside any files/URLs instead
    // of being silently dropped whenever a file source produces non-empty text of its own.
    const corpus = assembleCorpus(out, data.sourceText);
    this.log.log('materialiseSources: ' + out.length + ' source(s), ' + corpus.length + ' chars of material.');
    return { ...data, sources: out, sourceText: corpus || String(data.sourceText || '') };
  }

  /**
   * The per-build Source Bible cache. In-memory and per-process, deliberately: a build needs the
   * bible two or three times, and a restart mid-build is already a bigger problem than a lost
   * cache — the same reasoning `genProgress` runs on. Nothing is persisted in ②; ④ adds that when
   * the Brief page needs the evidence across a page load.
   */
  private readonly sourceBibles = new Map<string, { key: string; bible: SourceBible }>();

  /**
   * A cheap fingerprint of the corpus. Not a hash for security — a cache key that changes when the
   * material changes. Sampling every 97th character plus the total length is enough to catch an
   * edit, and costs nothing on a 300 KB corpus.
   */
  private static corpusKey(docs: SourceDoc[]): string {
    let h = 5381;
    let n = 0;
    for (const d of docs) {
      const t = String(d.text || '');
      n += t.length;
      for (let i = 0; i < t.length; i += 97) h = (((h << 5) + h) ^ t.charCodeAt(i)) >>> 0;
    }
    return docs.length + ':' + n + ':' + h.toString(36);
  }

  /**
   * The documents a build has, in a stable order.
   *
   * `paste` is the assembled corpus on `sourceText`, which after ① already contains the main paste
   * box AND every source's text. It therefore OVERLAPS the extra-paste-box source records. That is
   * deliberate and harmless: the overlapping passages classify identically and the distiller
   * deduplicates them. The clean fix — the intake form sending the main box as its own `kind:'paste'`
   * source instead of pre-merging (`ScriptOnIntake.tsx:253`) — belongs to (4), where that form is
   * already being changed. (2) must not need a frontend release to ship.
   */
  private sourceDocsFrom(intake: any): SourceDoc[] {
    const docs: SourceDoc[] = [];
    const sources: any[] = Array.isArray(intake && intake.sources) ? intake.sources : [];
    const pasted = residualPaste(intake && intake.sourceText, sources);
    if (pasted.trim()) docs.push({ id: 'paste', name: 'Pasted text', text: pasted });
    for (let i = 0; i < sources.length; i++) {
      const s: any = sources[i] || {};
      const text = String(s.text || '');
      if (!text.trim()) continue;
      docs.push({ id: String(i), name: String(s.name || s.kind || ('source ' + (i + 1))), text });
    }
    return docs;
  }

  /**
   * One classification call for one batch of passages from ONE document.
   *
   * The pass returns a role, subjects and a number. It does NOT summarise, rewrite or extract facts,
   * and nothing it emits is ever shown to a writer — which is why a hallucination here degrades into
   * a mis-sorted paragraph instead of contaminated prose.
   */
  private async classifyBatch(projectId: string, docs: SourceDoc[], batch: Passage[]): Promise<any[]> {
    if (!batch.length) return [];
    const docId = String(batch[0].docId);
    let name = docId;
    for (const d of docs) if (d.id === docId) { name = d.name; break; }
    const sys = 'You are sorting a filmmaker\'s submitted material before a screenplay is written from it.'
      + ' For EACH passage return exactly one role. Return ONLY JSON {passages:[{id,role,subjects,confidence}]}.'
      + '\nCANON - the story itself: treatment, outline, acts, plot, characters, relationships, setting,'
      + ' world rules, existing script pages. The film is MADE of this.'
      + '\nRESEARCH - factual or historical information about the real world. It informs the film; it is'
      + ' not the film.'
      + '\nREFERENCE - another work cited as a comparison or an example: a comp title, a scene from'
      + ' another film, "make it feel like X". Its text will never be used.'
      + '\nINSTRUCTION - a COMMAND ABOUT THE SCRIPT rather than material in it: "make the ending'
      + ' ambiguous", "keep it under twenty speaking roles", "no drone shots, we cannot afford them".'
      + ' If a passage tells the writer what to DO, it is INSTRUCTION and never CANON.'
      + '\nsubjects = up to 6 proper nouns or topic keys, each {name, kind} with kind one of'
      + ' CHARACTER|PLACE|RULE|EVENT|OTHER. confidence = 0..1.'
      + ' Do NOT summarise, rewrite or quote the passages. Return every id you were given, and no others.';
    // No quarantine is passed: nothing has a role yet, so nothing can be quarantined yet. This is the
    // one place passageBody is called on an unclassified passage, and it is correct here.
    const user = 'DOCUMENT: ' + name + '\n\n'
      + batch.map((p) => '[' + p.id + ']\n' + passageBody(docs, p)).join('\n\n');
    const r: any = await this.ai.json({
      task: 'scripton.source.classify', system: sys, user,
      maxTokens: 2000, timeoutMs: 90000, projectId, refType: 'Project', refId: projectId,
    });
    return Array.isArray(r && r.passages) ? r.passages : [];
  }

  /**
   * Classify this build's material and distil the Source Bible.
   *
   * REPORT-ONLY in (2): the result is logged and cached, and no consumer reads it until (3). Until a
   * real build's log shows the roles are right on real material, none should - a classifier that
   * called your treatment a reference would be strictly worse than no classifier.
   *
   * FAIL-OPEN at every level. One batch failing costs that batch; all of them failing costs nothing
   * at all, because an unclassified corpus behaves exactly as it does today.
   */
  private async sourceBibleFor(projectId: string): Promise<SourceBible | null> {
    if (!projectId) return null;
    try {
      const intake: any = await (this.prisma as any).intakeProfile
        .findUnique({ where: { projectId }, select: { sourceText: true, sources: true } })
        .catch(() => null);
      const docs = this.sourceDocsFrom(intake);
      if (!docs.length) return null;

      const key = ScripOnService.corpusKey(docs);
      const hit = this.sourceBibles.get(projectId);
      if (hit && hit.key === key) return hit.bible;

      const passages = segmentPassages(docs);
      const batches = batchPassages(passages);
      const verdicts: any[] = [];
      let failed = 0;
      for (const batch of batches) {
        try {
          const one = await this.classifyBatch(projectId, docs, batch);
          for (const v of one) verdicts.push(v);
        } catch (e) {
          failed++;
          this.log.warn('classify: a batch failed; its passages stay unclassified - ' + this.why(e));
        }
      }
      const stored = applyVerdicts(passages, verdicts);
      const bible = buildSourceBible(docs, stored);
      this.log.log('sourceBible: ' + docs.length + ' doc(s), ' + passages.length + ' passage(s), '
        + batches.length + ' call(s)' + (failed ? ' (' + failed + ' failed)' : '') + ' - '
        + Object.keys(bible.counts).map((k) => k.toLowerCase() + ' ' + bible.counts[k]).join(' | ')
        + (bible.references.length ? ' - QUARANTINED: ' + bible.references.map((r) => r.doc).join(', ') : '')
        + (bible.instructions.length ? ' - ' + bible.instructions.length + ' instruction(s)' : ''));
      this.sourceBibles.set(projectId, { key, bible });
      return bible;
    } catch (e) {
      this.log.warn('sourceBible: failed - continuing with the corpus unclassified. ' + this.why(e));
      return null;
    }
  }

  /** Material shorter than this says nothing worth pre-filling a form with. */
  private static readonly MIN_ANALYSE_CHARS = 200;
  /** What one analysis reads. The same ceiling fullSourceFor uses — a form is not a screenplay. */
  private static readonly MAX_ANALYSE_CHARS = 60000;

  /**
   * Read the attached material and pre-select the Brief.
   *
   * Runs when the user leaves the Work-source step, BEFORE anything is saved — so the sources arrive
   * in the request rather than off the intake row, and are materialised here through the same path a
   * save would use. Nothing is written; this is a read that returns suggestions.
   *
   * The form sends its OWN option lists with the request, and brief-recommend.util validates every
   * value against them. A value the picker cannot display can never come back, and the lists are not
   * duplicated on this side where they could drift.
   *
   * FAIL-OPEN. A failed analysis returns an empty field list and the Brief opens exactly as it would
   * have without one — every field the user's own to fill.
   */
  async recommendBrief(projectId: string, body: any) {
    const t0 = Date.now();
    const options: Record<string, string[]> = (body && body.options && typeof body.options === 'object') ? body.options : {};
    // Some option lists are IDS the form stores, not the words a reader thinks in — style packs and
    // ending types especially. `hints` carries the human rendering for the prompt only; the value the
    // model must copy is still the id, so nothing has to be mapped back on either side.
    const hints: Record<string, string> = (body && body.hints && typeof body.hints === 'object') ? body.hints : {};
    let sources: any[] = [];
    let corpus = '';
    try {
      const materialised: any = await this.materialiseSources(
        { sources: Array.isArray(body && body.sources) ? body.sources : [], sourceText: (body && body.sourceText) || '' },
        undefined,
      );
      sources = Array.isArray(materialised && materialised.sources) ? materialised.sources : [];
      corpus = String((materialised && materialised.sourceText) || '');
    } catch (e) {
      this.log.warn('recommendBrief: could not read the attached material — ' + this.why(e));
      return { fields: [], sources: [], chars: 0, note: 'The attached material could not be read.' };
    }
    // Report every source by name whether or not it was readable. This is the only place a user ever
    // finds out that a scanned PDF gave nothing — a backend log is not a user interface.
    const report = sources.map((x: any) => ({
      name: String((x && (x.name || x.kind)) || 'source'),
      chars: Number((x && x.chars) || 0),
      note: (x && x.note) ? String(x.note) : undefined,
    }));

    // ALWAYS log, before any early return. A paste-only request used to produce no log line at all:
    // `materialiseSources` returns early when `sources` is empty, and its log sits after that
    // return, so the entire pasted-text path was invisible. "It reads files but not pasted text"
    // was therefore unanswerable from the log — which is the actual defect, ahead of whatever
    // caused it. The opening characters are here because a corpus of the right LENGTH can still be
    // the wrong TEXT, and that distinction has cost this feature two debugging rounds already.
    this.log.log('recommendBrief: ' + report.length + ' source(s), ' + corpus.length + ' chars'
      + (corpus.trim()
        ? ' — opens: ' + JSON.stringify(corpus.slice(0, 140))
        : ' — NO MATERIAL REACHED THE ANALYSIS (the request carried none)'));

    if (corpus.trim().length < ScripOnService.MIN_ANALYSE_CHARS) {
      return { fields: [], sources: report, chars: corpus.length, note: 'Not enough material to suggest anything from.' };
    }

    const optsFor = (f: string): string[] => {
      const spec = FIELD_SPECS[f];
      const key = (spec && spec.options) || f;
      const v = options[key];
      return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : [];
    };
    const enumFields = recommendableFields().filter((f) => {
      const k = FIELD_SPECS[f].kind;
      return (k === 'enum' || k === 'enumList' || k === 'flags') && optsFor(f).length > 0;
    });
    const freeFields = recommendableFields().filter((f) => {
      const k = FIELD_SPECS[f].kind;
      return k === 'text' || k === 'textList' || k === 'number';
    });
    if (!enumFields.length && !freeFields.length) return { fields: [], sources: report, chars: corpus.length };

    // READ AND JUDGE — do not transcribe.
    //
    // The first version of this prompt said "return a field ONLY when the material actually EVIDENCES
    // it; do NOT infer". That is why it filled nothing: a 47,000-character creative brief is prose,
    // and it never says "genre: Thriller, tone: Grounded". The model obeyed and returned an empty
    // answer to a form it could have filled completely. A reader who will only repeat words already
    // on the page is not reading.
    //
    // The line that matters is NOT stated-versus-inferred. It is grounded-in-this-material versus
    // invented-from-convention, and `why` is what enforces it: an interpretation that can point at
    // the material is a judgement, and one that can only point at what such projects usually look
    // like is a guess. The option lists still do the rest of the work — a judgement can only ever
    // land on a value the picker actually offers.
    const sys = 'You are a development executive reading a filmmaker\'s material in order to fill in a'
      + ' project brief. Return ONLY JSON {fields:[{field,value,why}]}.'
      + '\nYou are READING, not transcribing. The material will almost never name its own genre, tone,'
      + ' mood, era or rating — work them out the way a reader would, from what actually happens in it:'
      + '\n· a missile-silo procedural on a countdown is a Thriller, even if the word never appears;'
      + '\n· sustained threat and deaths on the page is an adult rating, even if rating is never discussed;'
      + '\n· a story whose duty log is dated 1987 is set in 1987, and in that country.'
      + '\nFill in every field the material gives you a basis to judge. Nine well-founded fields are far'
      + ' more use than two literal ones.'
      + '\nOMIT a field only when the material gives you NO basis at all. An omitted field is left empty'
      + ' for the user to choose, which is correct and never a failure. What you must never do is answer'
      + ' from convention alone — from what a project like this usually looks like. Every field needs a'
      + ' basis in THIS material.'
      + '\n"why" is REQUIRED on every field: one short sentence naming what in the material led you'
      + ' there. An interpretation is fine ("reads as a thriller — a countdown, a locked room, and a'
      + ' chain of command that can kill"), but it must point at the material, never at convention.'
      + ' A field without one is discarded.'
      + '\nORCHESTRATION — the last part of the job is deciding what this particular story needs.'
      + ' `researchScope` is six research lanes and they arrive ALL ON. Not every story needs all six:'
      + ' switch on only the lanes this material actually calls for and leave the rest out.'
      + '\n· real people, a real place or a real event on the page needs `subject`;'
      + '\n· an invented world with its own rules needs `mythology`, and usually not `subject`;'
      + '\n· a story that names or leans on other films needs `craft`; a market-positioned pitch needs `comps`;'
      + '\n· regulated, religious, political or rights-sensitive material needs `legal`.'
      + '\nIf the material needs all six, say all six. Never return an empty list — that would switch'
      + ' research off altogether, which is not yours to decide.'
      + '\nRESTRAINT — three fields are CRAFT CHOICES, not facts about the material, and they are the'
      + ' writer\'s to make: `styles` (how the script is written), `spine.endingIds` (how it lands) and'
      + ' `subgenres`. Fill one ONLY when the material makes the choice for you — when it describes'
      + ' its own texture, states how it ends, or is plainly built on a sub-genre. If the material'
      + ' merely permits a choice, OMIT it. An unasked-for style is a note the writer has to undo.'
      + '\nFor any field listed with options, "value" MUST be copied EXACTLY from that field\'s option'
      + ' list — a value outside the list is discarded, so copy one or omit the field. Where an option'
      + ' list is ids with a description underneath, copy the ID.'
      + '\nNo text outside the JSON.';
    const user = 'Read the material at the end, then fill in what you can judge from it.\n\nFIELDS WITH FIXED OPTIONS — copy the value exactly:\n'
      + enumFields.map((f) => {
        const spec = FIELD_SPECS[f];
        const key = (spec && spec.options) || f;
        const shape = spec.kind === 'enumList' ? ' (array, up to ' + (spec.maxItems || 4) + ')'
          : (spec.kind === 'flags'
            ? ' (array — list ONLY the ones this story needs; every one you leave out is switched OFF)'
            : '');
        return '· ' + f + shape
          + ' — one of: ' + optsFor(f).join(' | ')
          + (hints[key] ? '\n    ' + hints[key] : '');
      }).join('\n')
      + '\n\nFREE-TEXT AND NUMERIC FIELDS:\n'
      + freeFields.map((f) => {
        const spec = FIELD_SPECS[f];
        if (spec.kind === 'number') return '· ' + f + ' — a number between ' + spec.min + ' and ' + spec.maxNum;
        return '· ' + f + (spec.kind === 'textList' ? ' (array, up to ' + (spec.maxItems || 6) + ')' : '')
          + ' — short text, under ' + spec.max + ' characters';
      }).join('\n')
      + '\n\nTHE MATERIAL:\n' + corpus.slice(0, ScripOnService.MAX_ANALYSE_CHARS);

    let raw: any = null;
    // `ai.json()` returns ONLY the parsed object and throws the reply text away, so a model that
    // answers with something unparseable is indistinguishable from a model that answers nothing:
    // both arrive here as null. `ai.run()` returns { text, json } — same call, same cost, but the
    // reply survives long enough to be reported. This is the third time in this feature that a
    // silent path has cost a debugging round.
    let replyText = '';
    try {
      const r: any = await this.ai.run({
        // OUTPUT BUDGET, MEASURED — not picked.
        //
        // 2500 was an invented number and it silently capped the feature: on 3 Sep a reply came
        // back 2,786 characters long, cut off mid-word inside the fifteenth row, and every field
        // was discarded. The arithmetic it should have had:
        //   · the reply carried 14 complete rows in 2,786 chars  →  ~199 chars per row
        //   · recommendableFields() is 33 fields                 →  ~6,570 chars for a full answer
        //   · 2,786 chars against a 2,500-token grant            →  ~1.1 chars per token on this
        //     path, far below the ~3.5 plain JSON would give, so the provider is spending a large
        //     part of the grant on something other than visible text (thinking tokens, which this
        //     codebase already handles for Gemini elsewhere)
        //   · 6,570 chars at that observed ratio                 →  ~6,000 tokens
        //
        // 6000 also crosses ai.service's streaming threshold, which is correct rather than
        // incidental: a 33-field answer IS a long generation, and streaming is what that threshold
        // exists to switch on. If the field list grows, redo the division above — do not nudge
        // this number. salvageRows() below is the independent second protection.
        task: 'scripton.brief.recommend', system: sys, user, maxTokens: 6000, timeoutMs: 120000,
        projectId, refType: 'Project', refId: projectId,
      });
      raw = r ? r.json : null;
      replyText = String((r && r.text) || '');
    } catch (e) {
      this.log.warn('recommendBrief: the analysis failed — the Brief opens empty. ' + this.why(e));
      return { fields: [], sources: report, chars: corpus.length, note: 'The material could not be analysed.' };
    }

    // A reply the parser rejected is not necessarily a reply with nothing in it. Recover the rows
    // that completed and put them through exactly the same gates — the option lists and the reason
    // rule still decide what survives, so salvaging can never admit a value a clean parse would
    // have refused. It only stops a cut-off tail from costing the whole answer.
    if (!raw && replyText) {
      const rescued = salvageRows(replyText);
      if (rescued.length) {
        this.log.warn('recommendBrief: the reply was cut off — ' + rescued.length
          + ' complete row(s) recovered from ' + replyText.length + ' chars.');
        raw = { fields: rescued };
      }
    }

    const fields: Recommendation[] = coerceRecommendations(raw, options);
    this.log.log('recommendBrief: ' + report.length + ' source(s), ' + corpus.length + ' chars -> '
      + fields.length + ' field(s) in ' + (Date.now() - t0) + 'ms'
      + (fields.length ? ' — ' + fields.map((f) => f.field).join(', ') : '')
      + (report.some((r) => r.note) ? ' | unreadable: ' + report.filter((r) => r.note).map((r) => r.name).join(', ') : ''));

    // Zero kept is a real outcome — the material may simply evidence nothing. But it is ALSO what a
    // malformed reply, an unparsed body and a wrong field vocabulary all look like from outside, and
    // those are indistinguishable without saying what actually came back. So when nothing survives,
    // say what arrived and which gate ate it. Diagnosis, not decoration: this is the difference
    // between "the analysis found nothing" and "the analysis has never once worked".
    if (!fields.length) {
      const rows: any[] = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.fields) ? raw.fields : []);
      const keys = (raw && typeof raw === 'object') ? Object.keys(raw).slice(0, 12).join(',') : String(typeof raw);
      const named = rows.map((r: any) => String((r && r.field) || '?')).slice(0, 24).join(', ');
      const known = rows.filter((r: any) => r && FIELD_SPECS[String(r.field)]).length;
      const withWhy = rows.filter((r: any) => r && String(r.why || '').trim().length >= 12).length;
      this.log.warn('recommendBrief: NOTHING KEPT. reply keys=[' + keys + '] rows=' + rows.length
        + ' known-field=' + known + ' with-reason=' + withWhy
        + ' optionLists=[' + Object.keys(options).map((k) => k + ':' + (Array.isArray(options[k]) ? options[k].length : 0)).join(' ') + ']'
        + (rows.length ? ' fieldsReturned=' + named : '')
        + (rows.length ? '' : ' rawSample=' + JSON.stringify(raw).slice(0, 400))
        // THE REPLY ITSELF. `raw` being null means extractJson could not parse the text — it does
        // not say why. The HEAD shows whether the model answered in JSON at all (a refusal, an
        // apology or a prose answer is obvious immediately); the TAIL shows whether it was cut off
        // mid-object, which is the signature of the output cap and nothing else.
        + (raw ? '' : ' | UNPARSED REPLY ' + replyText.length + ' chars'
          + ' head=' + JSON.stringify(replyText.slice(0, 220))
          + ' tail=' + JSON.stringify(replyText.slice(-140))));
    }
    return { fields, sources: report, chars: corpus.length };
  }

  async saveIntake(projectId: string, data: any) {
    const materialised = await this.materialiseSources(data, projectId);
    const d: any = {}; for (const k of ScripOnService.INTAKE_COLS) { if (materialised && materialised[k] !== undefined) d[k] = materialised[k]; }
    return (this.prisma as any).intakeProfile.upsert({ where: { projectId }, create: { projectId, ...d }, update: d });
  }

  /**
   * Read a stored genre-override list back into the shape `genreProfileTable` accepts.
   *
   * Everything here came out of a JSON column, which means it came from a database that a previous
   * version of this code - or a hand-edited row - could have written anything into. So each entry is
   * rebuilt field by field rather than cast: a key that is not a non-empty string is dropped, a
   * numeric field that is not a finite positive number is dropped rather than passed through as NaN,
   * and an entry left with nothing but its key is dropped entirely because it would produce an
   * `overridden` provenance badge over an unchanged number - a lie about the audit trail.
   *
   * The BAND is not checked here on purpose. `applyGenreOverrides` owns that rule and REFUSES a value
   * outside it; duplicating the bounds in a second place is how the two drift apart.
   */
  private static readGenreOverrides(raw: any): GenreOverride[] {
    if (!Array.isArray(raw)) return [];
    const out: GenreOverride[] = [];
    const seen = new Set<string>();
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const key = typeof item.key === 'string' ? item.key.trim().toUpperCase() : '';
      if (!key || seen.has(key)) continue;
      const entry: GenreOverride = { key };
      let touched = false;
      for (const field of ['sceneDensity', 'pagesPerMinute', 'defaultPages'] as const) {
        const v = (item as any)[field];
        if (typeof v === 'number' && isFinite(v) && v > 0) { (entry as any)[field] = v; touched = true; }
      }
      if (!touched) continue;
      if (typeof item.note === 'string' && item.note.trim()) entry.note = item.note.trim().slice(0, 500);
      seen.add(key);
      out.push(entry);
    }
    return out;
  }

  /**
   * ScriptON Settings read model: project name + locale + collab mode + defaults.
   *
   * `genreProfiles` is DERIVED, never stored. What the database holds is only the override list; the
   * table itself lives in feature-length.util.ts and is read-only there. Sending the resolved rows
   * means the settings screen never has to carry a second copy of the genre table - and can never
   * show one that has drifted from the one the planner actually uses.
   */
  async getScriptonSettings(projectId: string) {
    const pid = projectId || (await this.scriponWorkspace())?.id;
    if (!pid) return { name: '', language: null, collabMode: 'AUTO', defaults: {}, genreProfiles: genreProfileTable('PRODUCED', []) as GenreProfileRow[] };
    const proj: any = await (this.prisma as any).productionProject.findUnique({ where: { id: pid }, select: { title: true } }).catch(() => null);
    const ip: any = await (this.prisma as any).intakeProfile.findUnique({ where: { projectId: pid }, select: { language: true, collabMode: true, scriptonDefaults: true } }).catch(() => null);
    const defaults: any = ip?.scriptonDefaults || {};
    const genreOverrides = ScripOnService.readGenreOverrides(defaults.genreOverrides);
    return {
      projectId: pid,
      name: proj?.title || '',
      language: ip?.language || null,
      collabMode: String(ip?.collabMode || 'AUTO').toUpperCase(),
      defaults: { ...defaults, genreOverrides },
      genreProfiles: genreProfileTable('PRODUCED', genreOverrides) as GenreProfileRow[],
    };
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
    if (body?.defaults && typeof body.defaults === 'object') {
      // The column is replaced wholesale, so the override list is normalised on the way IN as well as
      // on the way out. A caller that never touched genres sends the list it read back unchanged and
      // it survives; a caller that sends rubbish gets it dropped here rather than at read time, when
      // there would be no one left to tell.
      const incoming: any = { ...body.defaults };
      if (incoming.genreOverrides !== undefined) incoming.genreOverrides = ScripOnService.readGenreOverrides(incoming.genreOverrides);
      data.scriptonDefaults = incoming;
    }
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
  /**
   * Why the last scene-plan call failed, so an empty plan can name its real cause.
   *
   * planScenes swallows the router error into a log line and returns []. The caller then threw "the
   * AI engine did not answer in time" whatever had actually happened — and on 2 Sep that sentence
   * was printed over "Your credit balance is too low", sending the operator to look for a timeout
   * that did not exist. Keyed by project, because two builds can plan at the same time.
   */
  private planFailure = new Map<string, { message: string; terminal: boolean }>();

  private genProgress = new Map<string, { status: string; done: number; total: number; pageCount: number; error?: string; coverage?: string; coverageNote?: string; phase?: string; lastActivityAt?: number; note?: string; cancelRequested?: boolean; scenesPerEp?: number; seasonScenes?: number; targetPages?: number | null; targetMinutes?: number | null; completionPct?: number }>();

  scriptProgress(documentId: string) {
    return this.genProgress.get(documentId) || { status: 'UNKNOWN', done: 0, total: 0, pageCount: 0 };
  }

  /**
   * Ask a running generation to stop.
   *
   * Cooperative, not forceful: this raises a flag that the scene loops check between scenes. The AI
   * call already in flight is allowed to finish (aborting it would mean plumbing an AbortController
   * through AiService into the provider layer), so a cancel lands within one scene — a few seconds
   * normally, up to the 120s scene timeout at worst. During PLANNING the whole scene map is one long
   * call, so a cancel there waits for it to return (up to ~4 minutes) before taking effect.
   *
   * Nothing is destroyed. saveRev has been persisting pages into the NEW revision as they land, and
   * the old revision stays active exactly as it does on failure — so the part that was written is
   * still in the revisions list, simply not promoted.
   *
   * Returns whether a live run was actually found, so the UI can tell "stopped" from "already over".
   */
  cancelGeneration(documentId: string): { cancelled: boolean; status: string; done: number; total: number } {
    const p = this.genProgress.get(documentId);
    if (!p || p.status !== 'GENERATING') {
      return { cancelled: false, status: (p && p.status) || 'UNKNOWN', done: (p && p.done) || 0, total: (p && p.total) || 0 };
    }
    p.cancelRequested = true;
    p.note = 'Stopping after the current scene…';
    p.lastActivityAt = Date.now();
    this.log.log('cancelGeneration: stop requested for script ' + documentId + ' at scene ' + p.done + '/' + p.total + '.');
    return { cancelled: true, status: p.status, done: p.done, total: p.total };
  }

  /** True once the operator has asked this run to stop. Checked between scenes, never mid-call. */
  private cancelled(documentId: string): boolean {
    return !!this.genProgress.get(documentId)?.cancelRequested;
  }

  /** Common landing for a stopped run: mark it, log it, leave the old revision active. */
  private finishCancelled(documentId: string, done: number, total: number, pageCount: number): void {
    const p = this.genProgress.get(documentId);
    if (p) {
      p.status = 'CANCELLED';
      p.done = done; p.pageCount = pageCount;
      // Says only what is true from the reader's side: the script they open is untouched, and the
      // partial was persisted rather than thrown away. There is no revisions browser to send them to.
      p.note = 'Stopped at scene ' + done + ' of ' + total + '. Your current script is unchanged, and the ' + pageCount + ' pages written so far have been saved, not discarded.';
      p.lastActivityAt = Date.now();
    }
    this.log.log('generation CANCELLED for script ' + documentId + ' at scene ' + done + '/' + total + ' (' + pageCount + ' pages written, revision NOT activated).');
  }

  /**
   * Page estimate, element-aware.
   *
   * This used to charge every line `ceil(len / 58)` and fit 55 of them, which treats a centred
   * dialogue line (max-width 48%, ~36 chars in print) as if it ran the full action measure — so
   * dialogue-heavy pages came out short. It also ignored the blank line that follows every paragraph.
   *
   * The costs below are the SAME ones the renderer uses in scriptPaper.tsx `tokLines()`, so the page
   * count the generator reports and the page count the reader shows come from one model. Both are
   * approximations of the print CSS, which is the real authority.
   *
   * Consecutive action (or dialogue) lines are costed as ONE paragraph, not one each. Charging the
   * paragraph's trailing blank line per LINE is the same error that rendered a 168-page script as a
   * 303-page PDF.
   *
   * PAGE_BUDGET — CALIBRATED AGAINST A REAL RENDER, NOT GUESSED.
   *
   * 48 agreed with the on-screen reader but disagreed with the PDF by 27%, and the PDF is what a
   * screenplay actually IS. The 31 Aug MINUTEMEN draft exported to 103 sheets — 102 script pages
   * plus the title page — while paginate() called it 131. That false 131 was filed as coverage
   * 'LONG' at 125% with a note claiming 128 minutes of screen time, for a draft that had landed on
   * its 105-page target. The generator was lying about its own output.
   *
   * Fitted on that draft, two independent criteria agree on 61:
   *
   *   budget   pages   mean chars/page   pages inside the 900-1,100 band
   *     48      131          837                    19%
   *     58      108         1016                    43%
   *     60      104         1055                    49%
   *     61      102         1075                    48%     <- matches the render exactly
   *     62      101         1086                    45%
   *
   * 900-1,100 characters is the verified density of a 12pt Courier screenplay page; at 48 the pages
   * were only ~840 characters, i.e. visibly under-filled. 61 hits the rendered page count on the
   * nose AND puts the median page inside the band.
   *
   * VALIDATED on a second, independent script (1 Sep). Jason Quick: paginate() 99, protected export
   * 100 sheets. MINUTEMEN: paginate() 102, protected export 103. Both within one page, on scripts with
   * very different texture — 35 scenes at 2.3 pages each versus 126 at 0.8. The constant generalises.
   *
   * MEASURE AGAINST THE PROTECTED EXPORT, NOT A BROWSER PRINT. The two produce different documents from
   * the same script: the protected export sets a 60-character measure (p95 = 59 chars, the industry
   * width for 12pt Courier at a 1.5in/1in margin), while a browser print-to-PDF of the reader page came
   * back at 81 characters — a third more per line, which collapsed a 100-page script to 81 sheets. If a
   * future fixture disagrees with paginate(), check the line width of the PDF before touching this.
   *
   * KNOWN, SEPARATE: the on-screen reader re-paginates by live measurement and showed 134 pages for
   * this same 103-sheet script. Screen and print geometry disagree by ~30%, so the reader's page
   * count is still wrong even after this fix. That is a scriptPaper.tsx CSS issue, not this one.
   *
   * ── 2 SEP: RE-FITTED FOR US LETTER ──────────────────────────────────────────────────────────
   *
   * Everything above was measured against an A4 export, and the export is now US Letter. The fit
   * scales with the usable text height and nothing else:
   *
   *     A4      297mm - 22mm - 22mm  = 253mm = 9.96in   ->  61 lines (measured)
   *     Letter  11in  -  1in -  1in  =   9in            ->  61 x (9 / 9.96) = 55.1
   *
   * 55 is also the industry figure for a 12pt Courier page and it is what LINES_PER_PAGE in
   * feature-length.util.ts has always said. Those two constants describe the SAME quantity and have
   * disagreed by 10% since the paginator was fitted — the line budget asked each scene for 55 lines
   * while the paginator packed 61, which is a large part of why drafts kept landing short of their
   * page target. They now agree.
   *
   * The consequence is intended: the same text paginates to ~11% more pages, so a 105-page target
   * finally means 105 Letter pages, which is the ~105 minutes `pagesPerMinute` has always assumed.
   * An A4 page was never a minute of screen time.
   *
   * WORDS_PER_PAGE moves with it — see feature-length.util.ts. Changing one without the other puts
   * the word budget and the page budget back out of step.
   */
  private static readonly PAGE_BUDGET = 55;
  private paginate(text: string): { page: number; text: string }[] {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const per = ScripOnService.PAGE_BUDGET; const pages: { page: number; text: string }[] = [];
    // Line classification moved to continuity.util so the page count and the continuity checker can
    // never disagree about what a line is. `cost` below stays here — it is page geometry, not
    // classification, and nothing outside pagination has any use for it. Behaviour is unchanged:
    // PAGE_BUDGET was calibrated against exactly these rules and a shifted page count is a regression.
    type Kind = LineKind;
    const classify = classifyLine;
    // Cost one line, given whether it CONTINUES the paragraph above it (a continuation pays only for
    // its own wrapped lines; the paragraph's trailing blank was already charged by its first line).
    const cost = (kind: Kind, len: number, continues: boolean): number => {
      switch (kind) {
        // 0, not 0.85 — the blank line that follows a paragraph is already charged by that
        // paragraph's own trailing unit below. Charging it twice is exactly the bug the print CSS
        // had with `.uvp-gap{height:1em}` on top of `margin-bottom:1em`.
        case 'blank': return 0;
        case 'slug': return Math.max(1, Math.ceil(len / 56)) + 1.6;
        case 'trans': return 1.8;
        case 'cue': return 1.6;
        case 'paren': return Math.max(1, Math.ceil(len / 24));
        case 'dialogue': return Math.max(1, Math.ceil(len / 36)) + (continues ? 0 : 0.6);
        default: return Math.max(1, Math.ceil(len / 56)) + (continues ? 0 : 1);
      }
    };
    let cur: string[] = []; let count = 0;
    let inSpeech = false; let prevKind: Kind | null = null;
    for (const ln of lines) {
      const t = ln.trim();
      const kind = classify(t, inSpeech);
      inSpeech = nextInSpeech(kind, inSpeech);
      const continues = (kind === 'action' || kind === 'dialogue') && prevKind === kind;
      const vis = cost(kind, t.length || 1, continues);
      prevKind = kind;
      if (count + vis > per && cur.length) { pages.push({ page: pages.length + 1, text: cur.join('\n') }); cur = []; count = 0; }
      cur.push(ln); count += vis;
    }
    if (cur.length) pages.push({ page: pages.length + 1, text: cur.join('\n') });
    if (!pages.length) pages.push({ page: 1, text: '' });
    return pages;
  }

  // Render finished print HTML → a real A4 PDF via headless Chromium (server-side). Used for Arabic
  // (and any) one-click download where client-side pdf-lib can't shape the glyphs. Graceful if puppeteer absent.
  async renderPdf(html: string, opts?: { footerHtml?: string; headerHtml?: string; format?: 'A4' | 'Letter'; margin?: { top?: string; right?: string; bottom?: string; left?: string } }): Promise<Buffer> {
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
      // Repeating footer/header (protected export) render in RESERVED page margins via Chromium's
      // native header/footer — so they can never overlap the script text. Otherwise honour @page.
      const hf = !!(opts && (opts.footerHtml || opts.headerHtml));
      /**
       * US LETTER for Latin, A4 for Arabic — read off the document rather than plumbed through.
       *
       * Every server-rendered PDF in the product came out A4 because this line said so, including
       * the protected exports that go to readers. Spec screenplays in the English-language market
       * are 8.5x11; an external coverage report on the 2 Sep draft listed the A4 page among the
       * reasons it would undermine professional confidence. Arabic manuscripts genuinely are A4.
       *
       * Detected from the HTML because the reader already marks it — `dir="rtl"` / `lang="ar"` —
       * and threading a format parameter through the controller, the API client and the caller
       * would be three more places for the two to disagree. An explicit opts.format still wins.
       */
      const looksArabic = /dir=["']rtl["']|lang=["']ar["']|@page\{size:A4/i.test(html);
      const format = (opts && (opts as any).format) || (looksArabic ? 'A4' : 'Letter');
      const pdfOpts: any = { format, printBackground: true };
      if (hf) {
        const m = (opts && opts.margin) || {};
        pdfOpts.displayHeaderFooter = true;
        pdfOpts.headerTemplate = (opts && opts.headerHtml) || '<span></span>';
        pdfOpts.footerTemplate = (opts && opts.footerHtml) || '<span></span>';
        pdfOpts.margin = { top: m.top || '22mm', right: m.right || '25mm', bottom: m.bottom || '16mm', left: m.left || '25mm' };
      } else {
        pdfOpts.preferCSSPageSize = true;
      }
      const pdf = await page.pdf(pdfOpts);
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
      const loc = shortenSlugLocation(String(sc.location || sc.setName || sc.where || 'الموقع'), 60) || 'الموقع';
      const dnR = String(sc.dayNight || sc.dn || '').toLowerCase();
      const dn = /night|ليل/.test(dnR) ? 'ليل' : /dawn|فجر/.test(dnR) ? 'فجر' : /dusk|evening|غروب|مساء/.test(dnR) ? 'مساء' : /morning|صباح/.test(dnR) ? 'صباح' : 'نهار';
      return ie + ' - ' + loc + ' - ' + dn;
    }
    const ie = (String(sc.intExt || 'INT').toUpperCase().match(/INT\/EXT|I\/E|EXT|INT/) || ['INT'])[0].replace('I/E', 'INT/EXT');
    // WAS: .slice(0, 48) — a hard cut that removed the tail of the location and then appended
    // ' - DAY' to the stump, so "MACRAE BARN — TRAINING SPACE (FLASHBACK, SIX YEARS AGO)"
    // shipped as "...(FLASHBACK, SIX YEA - DAY" and "RS AGO)" existed nowhere in the document.
    // Forty-one of the 1 Sep draft's 139 headings were damaged by this one expression.
    const loc = shortenSlugLocation(String(sc.location || sc.setName || sc.where || 'LOCATION').toUpperCase()) || 'LOCATION';
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
  private async planScenes(ctx: string, projectId: string, spine = '', target = 55, episode = false, onBeat?: () => void, plan?: FeatureLengthPlan | null): Promise<any[]> {
    this.planFailure.delete(projectId);   // this run's verdict only — never last run's
    // The band the planner is asked for. It used to be floored at 50-70 regardless of the film's real
    // length; it now tracks the page budget, so a 105-page feature asks for ~110 scenes, not ~60.
    // THE ASK NOW DESCENDS FROM A CEILING. It used to ascend from a quota — `target` up to
    // `target + 12%` — so a 131-scene target asked for 131-147 over 105 pages, which is an
    // instruction to fragment stated as arithmetic. `target` is now the most scenes the page budget
    // will carry, so it is the TOP of the ask and the planner is free to come in under it.
    // The old floor of 24 also had to go: on a twelve-page short it demanded twenty-four scenes.
    const lo = episode ? target : Math.max(MIN_PLANNED_SCENES, Math.round(target * 0.85));
    const hi = episode ? target + 6 : target;
    // Per-scene page allocation. Without it every scene comes back the same size, and a feature made of
    // uniform scenes is neither a feature nor readable.
    // Stated as a FLOOR on scene length, because that is what a reader experiences. A scene count is
    // an abstraction; "a scene has to last about a page and a quarter" is a craft instruction.
    const densityRule = (plan && !episode)
      ? ' SCENE LENGTH IS THE CONSTRAINT, not scene count: across this script a scene must average about '
        + plan.pagesPerScene + ' pages to play on screen, which is why ' + plan.targetScenes
        + ' is the MOST scenes ' + plan.targetPages + ' pages will carry. Fewer, fuller scenes are BETTER than more, thinner ones.'
        + (plan.beatsPerScene > 1.15
            ? ' The outline runs to roughly ' + plan.beatsPerScene + ' beats per scene at this length, so consecutive beats'
              + ' that happen in ONE place at ONE time MUST be written as ONE scene rather than split apart.'
            : '')
      : '';
    const weightRule = plan
      ? ' Also give every scene a "pageWeight" — the screenplay pages it should occupy, one of 0.25, 0.5, 1, 1.5, 2 or 3. Most scenes are 1. Use 0.25-0.5 for cutaways, beats and quick intercuts; 2-3 ONLY for genuine set pieces or the climax. The pageWeight values across all scenes MUST add up to about '
        + plan.targetPages + ' (the film is a ' + plan.targetPages + '-page feature, roughly ' + plan.targetMinutes + ' minutes).'
      : '';
    const sys = episode
      ? 'You are a screenwriter mapping the FIRST EPISODE (the pilot) of a series into ' + lo + '-' + hi + ' scenes. Open the series, establish the world / lead characters / central engine, and END on the episode hook or cliffhanger. Use the OPENING movement of the developed outline only — do NOT compress the whole season, and do NOT resolve the season arc. Return ONLY JSON {scenes:[{intExt, location, dayNight, brief, characters, exits, pageWeight}]} — intExt is INT or EXT; dayNight DAY or NIGHT; brief = 1-2 sentences of what happens; characters = comma list; exits = ONLY the characters who DIE or leave the story permanently in this scene, as [{name, how}] (omit the field entirely otherwise) - getting this right is what stops a murdered character answering a telephone eighty pages later, so do not guess and do not list a character who merely walks out of the room; No prose outside the JSON.' + weightRule
      : 'You are a screenwriter mapping a DEVELOPED story into a COMPLETE feature scene list for a ' + (plan ? plan.targetPages : 105) + '-page, 3-act script. Faithfully expand the GIVEN OUTLINE / BEAT MAP into ' + lo + '-' + hi + ' scenes that cover the ENTIRE story IN ORDER — from the opening beat through the midpoint, the climax AND the final resolution. EVERY numbered beat in the outline MUST be COVERED, and the LAST few scenes MUST dramatise the final beats (the climax and ending). Covering a beat does NOT mean giving it its own scene: where consecutive beats share a place and a moment, carry them in ONE scene. Never stop in the middle of the story. Return ONLY JSON {scenes:[{intExt, location, dayNight, brief, characters, exits, pageWeight}]} — intExt is INT or EXT; dayNight DAY or NIGHT; brief = 1-2 sentences of what happens; characters = comma list; exits = ONLY the characters who DIE or leave the story permanently in this scene, as [{name, how}] (omit the field entirely otherwise) - getting this right is what stops a murdered character answering a telephone eighty pages later, so do not guess and do not list a character who merely walks out of the room; No prose outside the JSON.' + densityRule + weightRule;
    const base = (extra: string) => ctx + (spine ? '\n\n' + (episode ? 'DEVELOPED OUTLINE (dramatise its OPENING as the pilot episode):\n' : 'FULL DEVELOPED OUTLINE TO COVER (expand every beat, in order, all the way to the end):\n') + spine : '') + extra;
    const parse = (r: any): any[] => {
      let arr: any[] = (r && r.json && Array.isArray(r.json.scenes)) ? r.json.scenes : [];
      if (!arr.length && r && typeof r.text === 'string') { try { const m = r.text.match(/\{[\s\S]*\}/); if (m) { const j = JSON.parse(m[0]); if (Array.isArray(j.scenes)) arr = j.scenes; } } catch { /* */ } }
      return arr.map((s: any) => ({ intExt: s.intExt, location: s.location, dayNight: s.dayNight, brief: String(s.brief || ''), characters: Array.isArray(s.characters) ? s.characters.join(', ') : String(s.characters || ''), exits: Array.isArray(s.exits) ? s.exits : (s.exits ? [s.exits] : undefined), pageWeight: s.pageWeight }));
    };
    /**
     * Scenes asked for per planning call.
     *
     * One call cannot map a feature. On 1 Sep this asked for all 131 scenes at once, ran past the
     * 230-second ceiling, retried, ran past it again, and returned NOTHING — whereupon the writer
     * silently fell back to a stale 35-card SCENES stage and spent forty minutes producing a thin,
     * exit-less, un-gated draft. Forty scenes finishes comfortably inside the timeout, a failed pass
     * costs one slice instead of the whole plan, and the continuation loop below — which had never
     * once been reached, because it is gated on scenes.length — finally does the work it was written for.
     */
    const PLAN_CHUNK = 40;
    // Page target the slice budget reports against. Zero for a series pilot, which has no page plan;
    // planSliceInstruction drops the page clause rather than printing "0 pages".
    const planPages = plan ? plan.targetPages : 0;
    /** Pages the map accounts for so far, from the planner's own pageWeights. */
    const pagesMapped = (list: any[]) => list.reduce((a: number, x: any) => a + snapPageWeight(x && x.pageWeight), 0);
    const firstSlice = planSliceBudget(0, lo, PLAN_CHUNK, 0, planPages);
    let scenes: any[] = [];
    onBeat?.(); // planning heartbeat — a slice still takes a minute or two on a long story
    try {
      const r: any = await this.ai.run({ task: 'scripton.feature.plan', system: sys, user: base(episode
          ? '\nMap the PILOT episode now (' + lo + '-' + hi + ' scenes), ending on the episode cliffhanger.'
          : '\nMap the FIRST ' + firstSlice.ask + ' scenes now, in order from the opening beat. The finished map will run to '
            + lo + '-' + hi + ' scenes in total.\n' + planSliceInstruction(firstSlice)
            + '\nReturn ONLY JSON {scenes:[...]}.'), maxTokens: 15000, timeoutMs: 230000, projectId, refType: 'Project', refId: projectId });
      scenes = dedupeScenes(parse(r)).scenes;
      if (!scenes.length) {
        this.log.warn('planScenes: the model returned no parseable scenes on the first pass (project ' + projectId + ') — the draft will fall back to the existing SCENES cards.');
        this.planFailure.set(projectId, { message: 'the engine answered, but returned nothing that parsed as a scene list.', terminal: false });
      }
    } catch (e) {
      // The scene map is the spine of the whole feature. Losing it silently is how a run ends up
      // writing whatever stale SCENES stage happens to exist, at the wrong length.
      this.log.error('planScenes: first pass FAILED for project ' + projectId + ' — ' + this.why(e));
      this.planFailure.set(projectId, { message: this.why(e), terminal: isProviderExhausted(e) });
    }
    // Continuation passes: a single call truncates at the token cap, so keep extending (from the last 3 scenes) until
    // the map reaches feature length AND the final beat — or a pass stops adding scenes — or we hit the ceiling.
    let passes = 0;
    // A single unproductive pass used to end this loop outright, so a planner that stalled once
    // returned a third of a story and the run wrote it. Jason Quick came back with 35 scenes against
    // a target of 131 that way. Two consecutive empty passes now, not one.
    let barren = 0;
    // Passes raised with the slice size: 131 scenes at 40 a call is four calls, and a model that
    // returns short slices needs a few more. Each is cheap now, so the ceiling is generous.
    while (spine && scenes.length && scenes.length < lo && passes < 8 && barren < 2) {
      passes++; onBeat?.(); const before = scenes.length;
      try {
        // The continuation used to be shown THREE briefs and told not to repeat itself, which is not
        // an instruction anything can follow. It now sees every scene it has mapped, as numbered
        // headings — about 30 characters each, so a 130-scene map costs ~4k characters once per pass.
        // That is what the courthouse climax written three times actually cost us.
        const mapped = scenes.map((s: any, k: number) => (k + 1) + '. ' + this.slugOf(s)).join('\n');
        const tail = scenes.slice(-3).map((s: any) => '- ' + String(s.brief || '')).join('\n');
        // The slice budget, not a bare scene count. The old ask ended with "if the climax falls inside
        // this slice, dramatise it and stop there" — an invitation the planner accepted on slice two,
        // wrapping a 131-scene film up in 80 and then going barren because the story was over. Only
        // the slice that reaches the target may end the film now; every earlier one is told to stop
        // mid-story. `barren` feeds in as `stalled` so an empty pass provokes a correction instead of
        // quietly counting down to giving up.
        const slice = planSliceBudget(scenes.length, lo, PLAN_CHUNK, pagesMapped(scenes), planPages);
        const cont: any = await this.ai.run({ task: 'scripton.feature.plan', system: sys, user: base('\nYou have already mapped these ' + scenes.length + ' scenes:\n' + mapped + '\n\nThe last three, in full:\n' + tail
          + (episode
            ? '\nContinue the SAME pilot episode toward ~' + lo + ' scenes, ending on the episode cliffhanger — do NOT repeat earlier scenes. Return ONLY JSON {scenes:[...]} for the REMAINING scenes.'
            : '\nContinue from scene ' + slice.from + '. Return the NEXT ' + slice.ask + ' scenes only, in order, and do NOT repeat any scene listed above.\n'
              + planSliceInstruction(slice, barren > 0)
              + '\nReturn ONLY JSON {scenes:[...]}.')), maxTokens: 15000, timeoutMs: 230000, projectId, refType: 'Project', refId: projectId });
        const more = parse(cont);
        if (more.length) {
          const d = dedupeScenes(scenes.concat(more));
          if (d.dropped.length) this.log.warn('planScenes: continuation pass ' + passes + ' returned '
            + d.dropped.length + ' scene(s) the map already had — dropped before they could be written.');
          scenes = d.scenes;
        }
      } catch (e) { this.log.warn('planScenes: continuation pass ' + passes + ' failed at ' + scenes.length + '/' + lo + ' scenes — ' + this.why(e)); }
      barren = scenes.length <= before ? barren + 1 : 0;
    }
    // The old hard cap of 100 truncated any feature denser than a drama — an action script plans ~130.
    if (plan && scenes.length < Math.round(plan.targetScenes * 0.7)) {
      // A short plan is not a short film — the live budget controller stretches whatever it is given
      // to fill the page target, so 80 scenes over 105 pages is 1.31 pages per scene where the plan
      // wanted 0.80. Report the shape, because that is the number a reader will feel.
      const perScene = scenes.length > 0 ? (plan.targetPages / scenes.length).toFixed(2) : 'n/a';
      this.log.warn('planScenes: planned only ' + scenes.length + ' scenes against a target of ' + plan.targetScenes
        + ' (' + plan.targetPages + ' pages, genre ' + plan.genreKey + ') after ' + passes + ' continuation pass(es)'
        + ' — that is ' + perScene + ' pages per scene against a floor of ' + plan.pagesPerScene
        + ' (' + plan.texture + ' texture). Coming in UNDER the scene target is no longer a defect in itself:'
        + ' the target is a ceiling. Checking whether the ending survived.');
    }

    // Apply the runaway cap BEFORE the ending gate, not after it. Capping last meant the gate could
    // verify a 190-scene plan and then hand back its first 171 — decapitating the very ending it had
    // just checked. The gate now sees exactly the plan that will be written, and the scenes its repair
    // adds are kept rather than re-trimmed: the cap exists to catch a runaway planner, and overshooting
    // it by a few scenes is a smaller failure than losing the climax. Page count is unaffected either
    // way — the live budget controller scales each scene to the remaining page allowance.
    const hardCap = plan ? plan.planCap : 100;
    if (scenes.length > hardCap) {
      this.log.warn('planScenes: planner returned ' + scenes.length + ' scenes against a cap of ' + hardCap + ' — trimming to the cap before the ending check.');
      scenes = scenes.slice(0, hardCap);
    }

    // ── THE ENDING GATE ────────────────────────────────────────────────────────────────────────
    // A screenplay missing its climax is worth nothing, however well the rest is written. Both test
    // scripts filed at ~95% of page target with the outline's final beats undramatised: MINUTEMEN
    // "skips the dramatised climax beats", Jason Quick "never dramatising the outlined climax".
    //
    // The old design only caught this AFTER every scene was written and paid for (verifyEnding), and
    // did nothing with the verdict but write a label. Checking the PLAN costs one small call before
    // 35-130 expensive ones, and a repair that NAMES the missing beats works where "continue the scene
    // map" did not — the planner has been told twice, in the system prompt, that the last scenes must
    // dramatise the ending, and ignored it both times. Telling it what is missing is a different ask.
    if (spine && scenes.length && !episode) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const tail = scenes.slice(-6).map((x: any, i: number) => (scenes.length - 6 + i + 1) + '. ' + String(x.brief || '')).join('\n');
        const verdict = await this.verifyPlanEnding(spine, tail, projectId);
        if (verdict.complete) break;
        this.log.warn('planScenes: the plan does NOT reach the outline\'s ending (attempt ' + (attempt + 1) + '/2)'
          + (verdict.missing.length ? ' — missing: ' + verdict.missing.join('; ') : '') + '. Repairing.');
        onBeat?.();
        try {
          const askFor = verdict.missing.length
            ? 'These beats from the outline are NOT covered by the plan:\n- ' + verdict.missing.join('\n- ')
            : 'The plan stops before the outline\'s climax and resolution.';
          const fix: any = await this.ai.run({
            task: 'scripton.feature.plan', system: sys,
            user: base('\nThe scene map so far ends with:\n' + tail + '\n\n' + askFor
              + '\n\nAdd ONLY the scenes still needed to dramatise those final beats, in order, through the climax AND the resolution.'
              + ' Do NOT repeat or restate any scene already mapped. Return ONLY JSON {scenes:[...]} for the MISSING scenes.'),
            maxTokens: 15000, timeoutMs: 230000, projectId, refType: 'Project', refId: projectId,
          });
          const more = parse(fix);
          if (!more.length) { this.log.warn('planScenes: ending repair returned no scenes on attempt ' + (attempt + 1) + '.'); continue; }
          // Without this dedupe the repair pass is a duplicate-climax machine: whenever the ending
          // check false-negatives on a plan that already reaches its ending, "add the scenes still
          // needed" adds a second one — and it gets two attempts.
          const d = dedupeScenes(scenes.concat(more));
          if (d.dropped.length) this.log.warn('planScenes: ending repair returned ' + d.dropped.length
            + ' scene(s) the plan already had — dropped.');
          const added = d.scenes.length - scenes.length;
          scenes = d.scenes;
          if (added <= 0) { this.log.warn('planScenes: ending repair added nothing new on attempt ' + (attempt + 1) + '.'); continue; }
          this.log.log('planScenes: ending repair added ' + added + ' scenes — plan now ' + scenes.length + '.');
        } catch (e) {
          this.log.warn('planScenes: ending repair failed on attempt ' + (attempt + 1) + ' — ' + this.why(e));
        }
      }
      // Last check. Failing HERE costs three planning calls; failing after the write costs the whole
      // run, and hands over a headless script that reads as finished.
      const finalTail = scenes.slice(-6).map((x: any) => '- ' + String(x.brief || '')).join('\n');
      const last = await this.verifyPlanEnding(spine, finalTail, projectId);
      if (!last.complete) {
        // Actionable half FIRST, missing beats LAST: the caller's catch truncates at 200 characters, and
        // the fixed sentence is 195 — so a long beat list is what gets cut, never the instruction.
        throw new Error('The scene map does not reach the story\'s ending, so nothing was written — your current script is untouched.'
          + ' Try Generate again, or open the outline and check that its final beats are written out.'
          + (last.missing.length ? ' Missing: ' + last.missing.slice(0, 3).join('; ') : ''));
      }
    }
    return scenes;
  }

  // Ending gate, plan-side twin of verifyEnding(). Same tolerant contract: any failure of the CHECK
  // itself assumes complete, so an AI outage can never block a run — only a confident "no" does.
  private async verifyPlanEnding(spine: string, planTail: string, projectId: string): Promise<{ complete: boolean; missing: string[]; note: string }> {
    if (!spine || !planTail) return { complete: true, missing: [], note: '' };
    try {
      const sys = 'You check whether a SCENE MAP covers the ending of a developed outline. You are given the OUTLINE (its final beats are the intended climax and resolution) and the LAST scenes of the scene map. Decide whether those scenes dramatise the outline\'s final beats. Return ONLY JSON {complete: true|false, missing: ["short beat name", ...], note: "one short sentence"} — list in "missing" only outline beats that the scene map does not cover, at most 4.';
      const user = 'OUTLINE (its ending = the final beats):\n' + spine.slice(-3000)
        + '\n\nLAST SCENES OF THE SCENE MAP:\n' + planTail.slice(-2000)
        + '\n\nDoes the scene map reach the outline\'s climax AND resolution?';
      const r: any = await this.ai.run({ task: 'scripton.feature.coverage', system: sys, user, maxTokens: 400, timeoutMs: 60000, projectId, refType: 'Project', refId: projectId });
      let j: any = (r && r.json) || null;
      if (!j && r && typeof r.text === 'string') { try { const m = r.text.match(/\{[\s\S]*\}/); if (m) j = JSON.parse(m[0]); } catch { /* */ } }
      if (j && typeof j.complete === 'boolean') {
        const missing = Array.isArray(j.missing) ? j.missing.map((x: any) => String(x).slice(0, 120)).slice(0, 4) : [];
        return { complete: j.complete, missing, note: trimToSentence(j.note, 240) };
      }
      this.log.warn('verifyPlanEnding: no usable verdict — assuming the plan reaches the ending (fail-open).');
    } catch (e) {
      this.log.warn('verifyPlanEnding: check failed, assuming complete — ' + this.why(e));
    }
    return { complete: true, missing: [], note: '' };
  }

  // Coverage guard: did the finished script actually reach the outline's FINAL beats (climax + resolution)?
  // One small, tolerant AI check — any failure assumes complete, so it never raises a false alarm.
  private async verifyEnding(spine: string, scriptTail: string, projectId: string, tailChars = 3000): Promise<{ complete: boolean; note: string }> {
    if (!spine || !scriptTail) return { complete: true, note: '' };
    try {
      const sys = 'You verify whether a screenplay reached its planned ENDING. Given a developed OUTLINE (whose FINAL beats are the intended climax and resolution) and the LAST pages of the generated script, decide whether the script actually dramatises those final beats. Return ONLY JSON {complete: true|false, note: "one short sentence"}.';
      const user = 'OUTLINE (its ending = the final beats):\n' + spine.slice(-3000) + '\n\nLAST PAGES OF THE GENERATED SCRIPT:\n' + scriptTail.slice(-tailChars) + '\n\nDoes the script reach the outline\'s final beats (the climax and resolution)?';
      const r: any = await this.ai.run({ task: 'scripton.feature.coverage', system: sys, user, maxTokens: 300, timeoutMs: 60000, projectId, refType: 'Project', refId: projectId });
      let j: any = (r && r.json) || null;
      if (!j && r && typeof r.text === 'string') { try { const m = r.text.match(/\{[\s\S]*\}/); if (m) j = JSON.parse(m[0]); } catch { /* */ } }
      // Trimmed at a sentence, not a flat character count: this note is now shown to a writer as the
      // reason a finished draft was rejected, and the 200-char cut produced "...through a Baltimore
      // freight terminal using." on screen. See trimToSentence.
      if (j && typeof j.complete === 'boolean') return { complete: j.complete, note: trimToSentence(j.note, 240) };
      this.log.warn('verifyEnding: no usable verdict returned — assuming the ending is complete (fail-open).');
    } catch (e) {
      // Fail-open by design: a failed check must never raise a false alarm on a good script. But an
      // always-failing check means the coverage flag is meaningless, which is worth knowing.
      this.log.warn('verifyEnding: check failed, assuming complete — ' + this.why(e));
    }
    return { complete: true, note: '' };
  }

  // Write ONE full scene (action + dialogue) — slug line is supplied, so the model focuses on dramatising.
  /**
   * Normalise one scene of model output into screenplay text.
   *
   * Shared by the writer and the continuity repair pass: a repair that skipped any of these would
   * reintroduce, into an already-good scene, exactly the defects the writer strips out.
   */
  private cleanSceneText(raw: string): string {
    const cleaned = String(raw || '')
      .replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim()
      // The model occasionally emits markdown emphasis, which reached the page raw: a real draft
      // shipped `*(quietly)* I know.` under a MERCER cue. Screenplays have no markdown — strip it.
      .replace(/\*\*([^*\n]+?)\*\*/g, '$1')
      .replace(/(?<!\*)\*(?!\*)([^*\n]+?)\*(?!\*)/g, '$1')
      // A parenthetical belongs on its own line above the speech. When it arrives inline —
      // "(quietly) I know." — the renderer classifies the WHOLE line as a parenthetical and the
      // dialogue disappears into italics. Split it back out.
      .replace(/^[ \t]*(\([^)\n]{1,40}\))[ \t]+(\S.*)$/gmu, '$1\n$2')
      .replace(/^\s*\d*\s*(INT|EXT|INT\.?\/EXT|I\/E)[.\s][^\n]*\n?/i, '').trim()
      .replace(/^\s*(?:\d+\s+)?(?:مشهد|المشهد|داخلي|خارجي)[^\n]*\n?/u, '').trim()   // strip a leading Arabic slug the model may add on top of ours
      .replace(/^[ \t]*[-–—_=]{2,}[ \t]*$/gmu, '').replace(/\n{3,}/g, '\n\n').trim()   // drop "---" separator lines
      // A screenplay has ONE "FADE OUT.", at the very end, and the caller appends it. The 1 Sep draft
      // carried three more, closing individual scenes — harmless on the page but wrong, and enough to
      // make a second-document check fire on good scenes. Trailing only: a transition with a scene
      // after it is contamination, and findSecondDocument owns that.
      .replace(/\n\s*#{0,6}\s*(FADE\s+OUT|THE END)[.:]?\s*$/i, '').trim();
    // THE MACHINE SHOWING THROUGH THE PAGE. "Word count: approximately 66" was printed on page 2 of
    // a delivered draft — the model reporting on the scene instead of writing it. Removed here
    // rather than flagged for a rewrite: the removal is certain and free, and the integrity gate
    // re-reads the result, so a scene that was NOTHING but meta still fails as EMPTY_BODY.
    const stripped = stripMetaCommentary(cleaned);
    if (stripped !== cleaned) {
      this.log.warn('cleanSceneText: dropped model meta-commentary — ' + findMetaCommentary(cleaned).join(' | '));
    }
    return stripped;
  }

  /**
   * Everything the development ladder holds, UNTRUNCATED — for the one pass that needs the whole
   * document rather than a prefix.
   *
   * buildFeatureCtx caps the treatment at 2,600 characters because it rides on all 130 scene prompts.
   * That cap is right for a repeated prefix and disastrous as the only reading: a 66,000-character
   * design document reaches the scene writer as its first two sections. This is read ONCE, so it does
   * not cap the same way.
   */
  private async fullSourceFor(projectId: string, stages: any[]): Promise<string> {
    const bodyOf = (k: string) => { const x: any = stages.find((y: any) => y.kind === k); return String((x && x.current && x.current.body) || ''); };
    const intake: any = await (this.prisma as any).intakeProfile.findUnique({ where: { projectId } }).catch(() => null);
    return [
      String((intake && intake.sourceText) || ''),
      bodyOf('LOGLINE'), bodyOf('SYNOPSIS'), bodyOf('TREATMENT'), bodyOf('BEATS'), bodyOf('STEP_OUTLINE'),
    ].filter(Boolean).join('\n\n').slice(0, 60000);
  }

  /**
   * Extract the story's CANON once per generation: the handful of facts a scene could get wrong.
   *
   * The 1 Sep draft named its protagonist Jason Andrew Quick and later Jason Richard Quick, and put
   * him in the water for four minutes in one scene and twenty-two in another. Neither is a writing
   * failure — nothing ever told the writer either fact. One call here, carried on every scene prompt,
   * is the cheapest fix available and the same one DOC measured: state the constraint while drafting
   * instead of hunting violations afterwards.
   *
   * Fail-open. A canon that could not be extracted must never stop a generation — it only makes the
   * draft as good as it was yesterday.
   */
  /**
   * Facts extracted from the SOURCE MATERIAL ALONE, for the development ladder.
   *
   * WHY THIS IS NOT extractCanon. extractCanon reads fullSourceFor, which is the source PLUS the
   * bodies of LOGLINE, SYNOPSIS, TREATMENT, BEATS and STEP_OUTLINE. That is correct at feature
   * time - by then those stages are the story. It is exactly wrong DURING the ladder, and §21 of
   * the findings document records why: a synopsis written from a 6,000-character excerpt renamed
   * the protagonist, and fullSourceFor then read that synopsis back as evidence, so the invented
   * name entered the canon ledger as a stated full_name and every downstream mechanism enforced it
   * rigorously. Feeding stage bodies to the thing that is supposed to protect the stages would
   * launder the invention into fact. So this reads intake.sourceText and nothing else.
   *
   * Cached per project on a cheap hash of the source, because the ladder has eight stages and this
   * must cost one call per document, not one per stage. The hash means editing the source re-runs
   * it; a restart re-runs it too, which is the right trade for an in-memory map.
   *
   * FAIL-OPEN, like extractCanon. No facts is yesterday's behaviour; a thrown error would be worse
   * than the bug being fixed.
   */
  private sourceCanonCache = new Map<string, { key: string; facts: CanonFactCore[] }>();

  private async sourceCanonFor(projectId: string, sourceText: string): Promise<CanonFactCore[]> {
    const src = String(sourceText || '');
    if (src.length < 400) return [];
    // Length plus a sampled fingerprint: enough to notice an edit, and it never copies the document.
    const key = src.length + ':' + src.slice(0, 120) + '|' + src.slice(Math.floor(src.length / 2), Math.floor(src.length / 2) + 120) + '|' + src.slice(-120);
    const hit = this.sourceCanonCache.get(projectId);
    if (hit && hit.key === key) return hit.facts;
    try {
      const sys = 'You are building the CANON for a screenplay going into production: the hard facts the script'
        + ' must never contradict. Return ONLY JSON {facts:[{kind,subject,predicate,object,statement}]}.'
        + ' kind is one of CHARACTER|WORLD|LORE|TIMELINE|RELATIONSHIP|PLOT. subject = the entity, upper-case.'
        + ' predicate = a short relation such as full_name|age|relation_to|occupation|duration|owns|located_in.'
        + ' object = the value. statement = one sentence a writer can read. Include ONLY facts the material'
        + ' actually STATES and that a later writer could plausibly get wrong: full names exactly as written,'
        + ' ages, family and professional relationships (who is whose sister, father, employer, mentor), how'
        + ' long things took, dates and years, and place / company / vessel names. Do NOT invent or infer'
        + ' anything: a missing fact is harmless, an invented one is a bug. At most 30 facts. No text outside'
        + ' the JSON.';
      const r: any = await this.ai.run({ task: 'scripton.develop.canon', system: sys, user: 'SOURCE MATERIAL:\n' + src.slice(0, 60000), maxTokens: 2400, timeoutMs: 180000, projectId, refType: 'Project', refId: projectId });
      let j: any = (r && r.json) || null;
      if (!j && r && typeof r.text === 'string') { try { const m = r.text.match(/\{[\s\S]*\}/); if (m) j = JSON.parse(m[0]); } catch { /* */ } }
      const facts = mapAiFactsToCore((j && j.facts) || [], { id: '', order: 0 }).slice(0, 30);
      this.sourceCanonCache.set(projectId, { key, facts });
      this.log.log('sourceCanonFor: ' + facts.length + ' fixed fact(s) from ' + src.length + ' characters of SOURCE (stage bodies deliberately excluded).');
      return facts;
    } catch (e) {
      this.log.warn('sourceCanonFor: failed - the ladder continues without a facts block. ' + this.why(e));
      return [];
    }
  }

  private async extractCanon(projectId: string, stages: any[]): Promise<CanonFactCore[]> {
    try {
      // ② runs REPORT-ONLY here: classify the material and log what it found, while the extractor
      // keeps reading the unchanged corpus below. This is the call site ③ will flip — fullSourceFor
      // becomes bible.canonText — but not until a real build's log shows the roles are right on real
      // material. A classifier that called a treatment a reference would be worse than none.
      await this.sourceBibleFor(projectId).catch(() => null);
      const src = await this.fullSourceFor(projectId, stages);
      if (src.length < 400) return [];
      const sys = 'You are building the CANON for a screenplay going into production: the hard facts the script'
        + ' must never contradict. Return ONLY JSON {facts:[{kind,subject,predicate,object,statement}]}.'
        + ' kind is one of CHARACTER|WORLD|LORE|TIMELINE|RELATIONSHIP|PLOT. subject = the entity, upper-case.'
        + ' predicate = a short relation such as full_name|age|relation_to|occupation|duration|owns|located_in.'
        + ' object = the value. statement = one sentence a writer can read. Include ONLY facts the material'
        + ' actually STATES and that a scene could plausibly get wrong: full names exactly as written, ages,'
        + ' family and professional relationships (who is whose sister, father, employer), how long things'
        + ' took, dates and years, and place / company / vessel names. Do NOT invent or infer anything: a'
        + ' missing fact is harmless, an invented one is a bug. At most 30 facts. No text outside the JSON.';
      const r: any = await this.ai.run({ task: 'scripton.feature.canon', system: sys, user: 'DEVELOPMENT MATERIAL:\n' + src, maxTokens: 2400, timeoutMs: 180000, projectId, refType: 'Project', refId: projectId });
      let j: any = (r && r.json) || null;
      if (!j && r && typeof r.text === 'string') { try { const m = r.text.match(/\{[\s\S]*\}/); if (m) j = JSON.parse(m[0]); } catch { /* */ } }
      // mapAiFactsToCore is the canon module's own normaliser — reused rather than reimplemented, so
      // source facts are shaped exactly like the ones a render pass extracts. Anchored at story order 0
      // with no source scene: these are true from the first page, and belong to no single scene.
      const facts = mapAiFactsToCore((j && j.facts) || [], { id: '', order: 0 }).slice(0, 30);
      this.log.log('extractCanon: ' + facts.length + ' fixed fact(s) from ' + src.length + ' characters of source material.');
      return facts;
    } catch (e) {
      this.log.warn('extractCanon: failed — continuing without a canon block. ' + this.why(e));
      return [];
    }
  }

  /**
   * Rewrite ONE scene to clear a continuity constraint, preserving everything else.
   *
   * Temperature is well below the writer's 0.85: this is a correction, not an invention, and every
   * degree of freedom here is a chance to lose a scene that was already working.
   */
  private async repairScene(ctx: string, sc: any, header: string, prevTail: string, projectId: string, budget: LineBudget, instruction: string, current: string, canon = ''): Promise<string> {
    const sys = 'You are a professional screenwriter REVISING one scene of a finished screenplay to correct a'
      + ' continuity error. Return the corrected scene in the same industry-standard format: present-tense'
      + ' action; dialogue = a centred UPPERCASE CHARACTER cue on its own line, an optional (parenthetical),'
      + ' then the line. Preserve everything that is not the error — the same beats, the same turn, the same'
      + ' location, roughly the same length. Do NOT write the scene heading and do NOT add a scene number.'
      + ' Output ONLY the corrected scene text.';
    const user = ctx
      + (canon ? '\n\n' + canon : '')
      + '\n\nSCENE HEADING (already set, do not rewrite): ' + header
      + '\nWHAT THIS SCENE IS FOR: ' + String((sc && sc.brief) || 'Advance the story with conflict and a turn.')
      + (prevTail ? '\n\nPREVIOUS SCENE ENDED WITH (continue naturally):\n' + prevTail : '')
      + '\n\n' + instruction
      + '\n\nTHE SCENE AS WRITTEN:\n' + current
      + '\n\nRewrite it now, corrected.';
    try {
      const r: any = await this.ai.run({ task: 'scripton.feature.repair', system: sys, user, maxTokens: budget.maxTokens, temperature: 0.6, timeoutMs: 120000, projectId, refType: 'Project', refId: projectId });
      const fixed = this.cleanSceneText(String((r && r.text) || ''));
      // A repair can start a second document exactly as a first draft can, and this one is handed
      // the scene as written — which is a document boundary in the prompt itself.
      const cut = splitAtSecondDocument(fixed);
      if (cut.problem) {
        this.log.warn('repairScene: the rewrite of "' + header + '" carried a second document ('
          + cut.problem.kind + ') — ' + (cut.keep ? 'trimmed it off.' : 'rejecting the rewrite.'));
        return cut.keep ? cut.kept : '';
      }
      return fixed;
    } catch (e) {
      this.log.warn('repairScene: rewrite failed for "' + header + '" — ' + this.why(e));
      return '';
    }
  }

  /** Never spend a whole run's budget repairing. Past this, the residue is reported instead. */
  private static readonly MAX_CONTINUITY_REPAIRS = 25;

  /**
   * THE FINAL VERIFICATION PASS — deterministic detection, targeted repair, deterministic re-check.
   *
   * The shape matters more than the checks. Detection contains no model: the plan declares who exits
   * and when, the classifier extracts who actually speaks, and membership is not a judgement call.
   * Repair is the only model call, it is given the exact violated constraint, and the SAME rule that
   * flagged the scene decides whether the rewrite survives. That is the external feedback the
   * self-correction literature says a repair loop needs; without it, the measured result is that
   * models asked to fix their own work sometimes make it worse.
   *
   * Monotonic by construction: a rewrite is kept only if it clears the check AND did not gut the
   * scene to do it. Otherwise the original stands. A draft with a known flaw beats a draft quietly
   * replaced by something worse.
   *
   * `startIdx` is where newly-written scenes begin — 0 for a fresh generation, the resume point for
   * an extend, whose out[0] holds all the pre-existing pages as one blob. Scenes before it are not
   * checked: they were written by an earlier run and are not this run's to rewrite.
   */
  /**
   * MECHANISM D — seed the registry and the state ledger from the PLAN, before a word is written.
   *
   * The plan is the only place in this pipeline that declares a change instead of describing one.
   * Its `exits` field says who leaves the story and when, which is a life fact with a real
   * `validFrom` — the exact anchor `canon-verify.util.ts` records as its missing input ("without a
   * declared change point, a death at scene 30 is indistinguishable from a resurrection").
   *
   * Two things come out of this and both are used below: a closed vocabulary of every proper noun
   * the film is allowed to contain, which is what the label-leak rule matches against; and a
   * ledger the whole-draft audit can run on at the end.
   */
  /** How many times each character cue actually speaks, read off the written pages.
   *  This is what turns "one entity, several aliases" into "one entity, several SPOKEN cues" —
   *  an alias nobody speaks under is a synonym, not a split identity. */
  /**
   * MECHANISM D · THE ONE MODEL CALL, AT PLAN TIME.
   *
   * Three of the ledger's dimensions cannot be derived from the plan's own fields. `knows` is who
   * learns what and when; `open` is a promise the story makes; `region` is the judgement that
   * "ATLANTIC WATERS OFF SKERRY ISLAND, NOVA SCOTIA" and "EXT. FERRY SLIP, SKERRY ISLAND" are the
   * same place. None of those is lexical, so a model supplies them — once, over the plan's briefs,
   * before a single scene is written.
   *
   * WHY PLAN TIME AND NOT AFTER. DOC measured +22.5% plot coherence from moving this burden to
   * planning rather than editing afterwards, and ConWriter's transition operators — preconditions,
   * postconditions, and a memory that holds UNRESOLVED FUTURE CONSTRAINTS — cut consistency error
   * density 78% while output length went UP. The Mercy is precisely an unresolved future
   * constraint: a named vessel with a sailing day, established at scene 83 and never mentioned
   * again in 103 pages. Nothing can notice that after the fact except a reader.
   *
   * WHAT THIS CALL IS NOT ALLOWED TO DO. It proposes facts. It never repairs, never renames, and
   * never registers a person it invented: a `who` that does not resolve to an entity already in the
   * registry is dropped on the floor. That is the "Vale Man" rule — a repair may move a name toward
   * a form the project knows and may never mint one. A vessel or object under `opens` IS registered,
   * because declaring a new plot object is a different act from correcting an existing name.
   *
   * Fail-open in every direction. A refusal, a timeout or unparseable JSON costs the ledger its
   * knowledge and geography dimensions and costs the run nothing at all.
   */
  private async extractPlanState(
    scenes: any[], reg: EntityRegistry, projectId: string,
  ): Promise<{ facts: StateFact[]; places: PlaceObservation[]; transit: Set<number>; clock: Map<number, number>; props: PropEvent[]; designators: string[]; recalled: Set<number> }> {
    const empty = { facts: [] as StateFact[], places: [] as PlaceObservation[], transit: new Set<number>(), clock: new Map<number, number>(), props: [] as PropEvent[], designators: [] as string[], recalled: new Set<number>() };
    const list = Array.isArray(scenes) ? scenes : [];
    if (!list.length) return empty;

    const cast = Array.from(new Set(
      Array.from(reg.entities.values())
        .filter((e) => e.kind === 'PERSON' && !e.mergedInto)
        .flatMap((e) => allForms(reg, e.id)),
    )).slice(0, 120);
    if (!cast.length) return empty;

    const sys = 'You are a script supervisor reading a scene plan, not a writer. Return ONLY JSON: '
      + '{"scenes":[{"n":<scene number>,"region":"<city, island or country — NOT a room>",'
      + '"elapsed":"CONTINUOUS"|"SAME_DAY"|"LATER","travel":true|false,"recalled":true|false,'
      + '"learns":[{"who":"<EXACT NAME FROM THE CAST LIST>","fact":"<SHORT STABLE UPPERCASE KEY>"}],'
      + '"opens":[{"name":"<the thing named>","kind":"VESSEL"|"OBJECT"|"ORG"|"TIME_ANCHOR","promise":"<the constraint stated>"}],'
      + '"closes":["<name of a thing established earlier and settled here>"],'
      + '"clock":"<HH:MM the scene begins, ONLY if the story runs on a clock — otherwise omit>",'
      + '"props":[{"name":"<the object>","state":"CARRIED"|"PLACED"|"HIDDEN"|"TAKEN"|"GIVEN"|"RETURNED"|"DESTROYED","note":"<where it is or who has it>"}]}],'
      + '"designators":["<call signs, code names and unit designators the script must not vary>"]}\n'
      + 'RULES. "who" MUST be copied exactly from the CAST list — never invent a person, never abbreviate one. '
      + 'A scene with no discovery returns an empty "learns". '
      + '"fact" is a short key like FATHER_BUILT_THE_NETWORK, and the SAME discovery in two scenes MUST use the SAME key — that is the entire point of the field. '
      + '"opens" is ONLY for a named thing carrying a stated constraint: a vessel with a sailing day, a hearing with a date, a deadline. It is not for every prop. '
      + '"travel" is true when the scene SHOWS someone departing, arriving or journeying. '
      + '"recalled" is true for a flashback, dream, memory or archive/news footage. '
      + '"clock" is ONLY for a story that runs on a running clock — a countdown, a siege, one shift, one night. '
      + 'If the story spans weeks or is not clock-driven, omit it entirely rather than inventing times. '
      + 'When you do use it, the times must run FORWARD across the whole scene list and never repeat backwards. '
      + '"props" is ONLY for a physical object whose state CHANGES in this scene and that a later scene could contradict '
      + '— a document burned, a card discarded, a weapon handed over, a drive hidden. Not scenery, not clothing, not every object touched. '
      + 'Use the SAME name for the same object every time it appears; that is what makes the field usable. '
      + '"designators" is ONE list for the whole run, not per scene: call signs, code names, vessel names, unit numbers — the vocabulary the script must never vary. '
      + 'No prose outside the JSON.';

    const facts: StateFact[] = [];
    const places: PlaceObservation[] = [];
    const transit = new Set<number>();
    const clock = new Map<number, number>();
    const props: PropEvent[] = [];
    const recalledScenes = new Set<number>();
    const designators = new Set<string>();
    const openedAt = new Map<string, StateFact>();
    let recordedAt = 0;
    const CHUNK = 50;

    for (let start = 0; start < list.length; start += CHUNK) {
      const slice = list.slice(start, start + CHUNK);
      const lines = slice.map((sc: any, k: number) => {
        const n = start + k + 1;
        return n + '. ' + this.slugOf(sc || {}) + ' | ' + String((sc && sc.brief) || '').slice(0, 220)
          + ' | cast: ' + splitCast(sc && sc.characters).join(', ');
      }).join('\n');
      const user = 'CAST (the only names you may use):\n' + cast.join(', ')
        + '\n\nSCENES ' + (start + 1) + '-' + (start + slice.length) + ':\n' + lines;
      let rows: any[] = [];
      try {
        const r: any = await this.ai.run({
          task: 'scripton.feature.plan', system: sys, user,
          maxTokens: 16000, timeoutMs: 180000, projectId, refType: 'Project', refId: projectId,
        });
        const parsed = JSON.parse(String((r && r.text) || '{}').replace(/^[^{]*/, '').replace(/[^}]*$/, ''));
        rows = Array.isArray(parsed && parsed.scenes) ? parsed.scenes : [];
        for (const d of (Array.isArray(parsed && parsed.designators) ? parsed.designators : [])) {
          const name = String(d || '').trim();
          if (name && name.length <= 40) designators.add(name);
        }
      } catch (e: any) {
        this.log.warn('extractPlanState: scenes ' + (start + 1) + '-' + (start + slice.length)
          + ' returned nothing usable — the ledger loses knowledge and geography for this span. ' + this.why(e));
        continue;
      }

      for (const row of rows) {
        const n = Number(row && row.n);
        if (!Number.isFinite(n) || n < 1 || n > list.length) continue;
        const sc = list[n - 1] || {};
        const heading = this.slugOf(sc);
        const recalled = row.recalled === true;
        if (row.travel === true || isTransitPlace(heading)) transit.add(n);

        // The clock, when the story has one. A flashback's time is not the running clock.
        if (!recalled && typeof row.clock === 'string') {
          const t = /^\s*([01]?\d|2[0-3])\s*:\s*([0-5]\d)\s*$/.exec(row.clock);
          if (t) clock.set(n, Number(t[1]) * 60 + Number(t[2]));
        }
        if (recalled) recalledScenes.add(n);
        /**
         * A FLASHBACK'S OBJECTS ARE NOT THE RUNNING LIFECYCLE.
         *
         * Without this guard a memory at scene 130 showing the passport intact would record it as
         * PLACED at 130 — after it was burned at 105 — and the prop check would report a
         * contradiction in a story that has none. The same exemption the life-state ledger has
         * always had: the dead may speak in the past, and a burned thing may be whole there.
         */
        for (const pr of (recalled ? [] : (Array.isArray(row.props) ? row.props : []))) {
          const name = String((pr && pr.name) || '').trim();
          const state = String((pr && pr.state) || '').toUpperCase();
          if (!name || name.length > 60 || !isPropState(state)) continue;
          props.push({ scene: n, name, state: state as any, note: String((pr && pr.note) || '').trim().slice(0, 60) || undefined });
        }

        if (row.region) {
          places.push({
            entityId: '', scene: n, region: String(row.region).slice(0, 60),
            elapsed: slugSaysContinuous(heading) ? 'CONTINUOUS'
              : (['CONTINUOUS', 'SAME_DAY', 'LATER'].indexOf(String(row.elapsed)) >= 0 ? row.elapsed : 'UNKNOWN'),
            recalled,
          });
        }

        for (const l of (Array.isArray(row.learns) ? row.learns : [])) {
          const id = resolveEntity(reg, l && l.who, n, 'PERSON');
          const key = String((l && l.fact) || '').replace(/\s+/g, '_').toUpperCase().slice(0, 80);
          // A name the registry does not already hold is dropped. It is not registered by inference.
          if (!id || !key) continue;
          facts.push({ entityId: id, dimension: 'knows', value: key, validFrom: n, validTo: null, recordedAt: ++recordedAt, sourceScene: n });
        }

        if (recalled) continue;   // a promise made inside a memory is not a promise the film owes

        for (const o of (Array.isArray(row.opens) ? row.opens : [])) {
          const name = String((o && o.name) || '').trim();
          const promise = String((o && o.promise) || '').trim();
          if (!name || !promise) continue;
          const kind = (['VESSEL', 'OBJECT', 'ORG', 'TIME_ANCHOR'].indexOf(String(o.kind)) >= 0 ? o.kind : 'OBJECT');
          const id = registerEntity(reg, kind as any, name, { at: n });
          if (!id || openedAt.has(id)) continue;
          const f: StateFact = {
            entityId: id, dimension: 'open', value: promise.slice(0, 120),
            validFrom: n, validTo: null, recordedAt: ++recordedAt, sourceScene: n, statement: promise.slice(0, 160),
          };
          openedAt.set(id, f);
          facts.push(f);
        }
        for (const c of (Array.isArray(row.closes) ? row.closes : [])) {
          const id = resolveEntity(reg, c, n);
          const open = id ? openedAt.get(id) : null;
          if (open && open.validTo == null && n > open.validFrom) open.validTo = n;
        }
      }
    }

    // A region observation belongs to every character present in that scene.
    const expanded: PlaceObservation[] = [];
    for (const p of places) {
      const sc = list[p.scene - 1] || {};
      for (const raw of splitCast(sc.characters)) {
        const id = resolveEntity(reg, raw, p.scene, 'PERSON');
        if (id) expanded.push({ ...p, entityId: id });
      }
    }
    this.log.log('extractPlanState: ' + facts.filter((f) => f.dimension === 'knows').length + ' knowledge fact(s), '
      + facts.filter((f) => f.dimension === 'open').length + ' open promise(s), '
      + expanded.length + ' place observation(s), ' + transit.size + ' travel beat(s).');
    const hhmm = (m: number) => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    if (clock.size) {
      const times = Array.from(clock.entries()).sort((a, b) => a[0] - b[0]);
      const backwards = times.filter((t, i) => i > 0 && t[1] < times[i - 1][1]).length;
      if (backwards) {
        // The plan is the one place a running clock can still be fixed for free. If the PLANNER
        // cannot keep it straight, handing it to 139 scene prompts would only spread the damage.
        this.log.warn('extractPlanState: the planned clock runs backwards at ' + backwards
          + ' point(s) — dropping it rather than handing a broken timeline to the writer.');
        clock.clear();
      } else {
        this.log.log('extractPlanState: clock planned for ' + times.length + ' scene(s), '
          + hhmm(times[0][1]) + ' to ' + hhmm(times[times.length - 1][1]) + '.');
      }
    }
    if (props.length) {
      const bad = checkPropContinuity(props);
      this.log.log('extractPlanState: ' + props.length + ' prop state change(s) across '
        + new Set(props.map((x) => x.name.toLowerCase())).size + ' object(s).');
      for (const b of bad.slice(0, 10)) this.log.warn('  prop: ' + b.detail);
    }
    if (designators.size) this.log.log('extractPlanState: ' + designators.size + ' locked designator(s) — ' + Array.from(designators).slice(0, 12).join(', '));
    return { facts, places: expanded, transit, clock, props, designators: Array.from(designators), recalled: recalledScenes };
  }

  private cueCounts(view: { heading: string; text: string }[]): Map<string, number> {
    const out = new Map<string, number>();
    for (const v of (view || [])) {
      if (!v || !v.text) continue;
      for (const line of classifyScript(v.text)) {
        if (line.kind !== 'cue') continue;
        const name = normaliseCharacterName(line.text);
        if (!name) continue;
        out.set(name, (out.get(name) || 0) + 1);
      }
    }
    return out;
  }

  private buildEntityLedger(scenes: any[], exits: CastExit[]): { reg: EntityRegistry; facts: StateFact[] } {
    const reg = createRegistry();
    const facts: StateFact[] = [];
    let recordedAt = 0;
    const list = Array.isArray(scenes) ? scenes : [];

    for (let i = 0; i < list.length; i++) {
      const sc = list[i] || {};
      for (const raw of splitCast(sc.characters)) {
        const id = registerEntity(reg, 'PERSON', raw);
        if (!id) continue;
        // A person is alive from their first scene until something in the plan says otherwise.
        if (!facts.some((f) => f.entityId === id && f.dimension === 'life')) {
          facts.push({ entityId: id, dimension: 'life', value: 'ALIVE', validFrom: 0, validTo: null, recordedAt: ++recordedAt, sourceScene: i + 1 });
        }
      }
      const place = String(sc.location || sc.setName || sc.where || '').trim();
      if (place) registerEntity(reg, 'PLACE', place);
    }

    for (const e of (Array.isArray(exits) ? exits : [])) {
      if (!e || !e.name) continue;
      const id = registerEntity(reg, 'PERSON', e.name);
      if (!id) continue;
      // The window opens the scene AFTER the exit, exactly as `unavailableAt` does — a character
      // may play their own death. Only a death is a LIFE change; walking out of the story is not.
      const dies = /kill|die|died|dead|death|shot|murder|drown|execut|assassinat/i.test(String(e.how || ''));
      facts.push({
        entityId: id,
        dimension: dies ? 'life' : 'place',
        value: dies ? 'DEAD' : 'GONE',
        validFrom: (Number(e.scene) || 0) + 1,
        validTo: null,
        recordedAt: ++recordedAt,
        sourceScene: (Number(e.scene) || 0) + 1,
        statement: String(e.how || '').slice(0, 120) || undefined,
      });
    }
    return { reg, facts };
  }

  private async verifyAndRepair(
    docId: string, out: string[], scenes: any[], exits: CastExit[], facts: CanonFactCore[],
    ctx: string, projectId: string, ar: boolean, startIdx: number, setP: (patch: any) => void,
    ledger?: { reg: EntityRegistry; facts: StateFact[]; places?: PlaceObservation[]; transit?: Set<number> },
  ): Promise<{ found: number; repaired: number; residue: ContinuityFinding[] }> {
    const slot = (i: number) => i - startIdx + 1;
    const headOf = (i: number) => (i + 1) + '  ' + this.slugOf(scenes[i] || {}, ar);
    const view = () => scenes.map((_: any, i: number) => ({ heading: headOf(i), text: i < startIdx ? '' : String(out[slot(i)] || '') }));
    const tracked = Array.from(new Set(
      scenes.flatMap((sc: any) => splitCast(sc && sc.characters)).concat(exits.map((e) => e.name)),
    ));
    const sweep = () => checkDraftContinuity(view(), exits).concat(findNameDrift(view(), tracked, facts));

    setP({ phase: 'VERIFYING', note: 'Final checks — continuity.' });
    const findings = sweep();
    const found = findings.length;
    if (!found) {
      this.log.log('verifyAndRepair: continuity clean across ' + (scenes.length - startIdx) + ' written scene(s) — '
        + exits.length + ' exit(s) and ' + tracked.length + ' name(s) tracked.');
      setP({ note: '' });
      return { found: 0, repaired: 0, residue: [] };
    }
    this.log.warn('verifyAndRepair: ' + found + ' continuity issue(s) — '
      + findings.slice(0, 8).map((f) => 'sc ' + (f.sceneIndex + 1) + ' ' + f.kind).join('; '));
    setP({ phase: 'REPAIRING', note: found + ' continuity issue' + (found === 1 ? '' : 's') + ' found — repairing.' });

    let repaired = 0;
    for (const f of findings.slice(0, ScripOnService.MAX_CONTINUITY_REPAIRS)) {
      if (this.cancelled(docId)) break;
      const i = f.sceneIndex;
      const sc = scenes[i];
      if (!sc || i < startIdx) continue;
      const header = headOf(i);
      const current = String(out[slot(i)] || '');
      if (!current) continue;

      // A name is a substitution, not a rewrite. Sending a four-character correction to a language
      // model would risk an entire working scene to fix a middle name.
      if (f.kind === 'NAME_DRIFT') {
        // CONFIRMED LIKE EVERY OTHER REPAIR. This branch used to substitute and move on, on the
        // argument that "a name is a substitution, not a rewrite" — which is true, and was beside
        // the point. On 1 Sep it rewrote "Vale Meridian" to "Vale Man" twenty times, in prose AND
        // in every scene heading, and nothing downstream noticed. An unverified edit is not a safe
        // edit because it is small; it is an unobserved one.
        const bodyOnly = current.startsWith(header) ? current.slice(header.length).replace(/^\n+/, '') : current;
        const fixedBody = canonicaliseNames(bodyOnly, f.names.slice(1), f.names[0]);
        if (fixedBody === bodyOnly) { setP({ note: 'Repairing continuity — ' + repaired + ' of ' + found + ' fixed.' }); continue; }
        const candidate = current.startsWith(header) ? header + '\n\n' + fixedBody : fixedBody;
        // A name correction changes a handful of words. Anything larger is not a name correction.
        const wasW = (bodyOnly.match(/\S+/g) || []).length;
        const nowW = (fixedBody.match(/\S+/g) || []).length;
        const reshaped = wasW > 0 && Math.abs(nowW - wasW) > Math.max(6, wasW * 0.1);
        // And the check has to actually be cleared — re-run the same sweep on the corrected scene.
        const stillDrifting = findNameDrift(
          [{ heading: header, text: candidate }], tracked, facts,
        ).length > 0;
        if (reshaped || stillDrifting) {
          this.log.warn('verifyAndRepair: REJECTED the name correction in scene ' + (i + 1)
            + (reshaped ? ' — it changed ' + wasW + ' words to ' + nowW + '.' : ' — the drift is still there afterwards.'));
          setP({ note: 'Repairing continuity — ' + repaired + ' of ' + found + ' fixed.' });
          continue;
        }
        out[slot(i)] = candidate; repaired++;
        this.log.log('verifyAndRepair: scene ' + (i + 1) + ' — name corrected to ' + f.names[0] + '.');
        setP({ note: 'Repairing continuity — ' + repaired + ' of ' + found + ' fixed.' });
        continue;
      }

      const bodyNow = current.startsWith(header) ? current.slice(header.length).replace(/^\n+/, '') : current;
      const prevTail = String(out[Math.max(0, slot(i) - 1)] || '').slice(-700);
      const budget = lineBudgetFor(snapPageWeight(sc.pageWeight));
      const fixed = await this.repairScene(ctx, sc, header, prevTail, projectId, budget, repairInstruction(f, exits), bodyNow, await this.canon.directiveFor(docId, i));
      setP({ note: 'Repairing continuity — ' + repaired + ' of ' + found + ' fixed.' });
      if (!fixed || fixed === SCENE_STUB) continue;
      const stillWrong = checkScene(i, header, header + '\n\n' + fixed, exits).length > 0;
      const wasWords = (bodyNow.match(/\S+/g) || []).length;
      const nowWords = (fixed.match(/\S+/g) || []).length;
      const gutted = wasWords > 0 && nowWords < wasWords * 0.5;
      if (stillWrong || gutted) {
        this.log.warn('verifyAndRepair: REJECTED the rewrite of scene ' + (i + 1)
          + (stillWrong ? ' — it still violates the constraint.' : ' — it cut the scene from ' + wasWords + ' to ' + nowWords + ' words.'));
        continue;
      }
      out[slot(i)] = header + '\n\n' + fixed;
      repaired++;
      setP({ note: 'Repairing continuity — ' + repaired + ' of ' + found + ' fixed.' });
    }

    const residue = sweep();
    this.log.log('verifyAndRepair: ' + repaired + ' of ' + found + ' repaired, ' + residue.length + ' unresolved.');

    // MECHANISM D — the whole-draft ledger audit. REPORTED, never repaired.
    //
    // A life-state contradiction is not a scene that came back wrong; it is two scenes that cannot
    // both be true, and deciding which one survives is a writer's call about the story. Sending
    // either of them to a model to be "fixed" would pick one at random and destroy the other — the
    // exact failure the Vale Man bug taught. So this names the contradiction, quotes both scenes,
    // and stops there.
    try {
      const led = ledger || this.buildEntityLedger(scenes, exits);
      const found2 = auditLedger(led.reg, led.facts, scenes.length, {
        cueCounts: this.cueCounts(view()),
        places: (led as any).places || [],
        transitScenes: (led as any).transit || [],
      });
      if (found2.length) {
        this.log.warn('ledger: ' + found2.length + ' identity/state finding(s) across the draft —');
        for (const f of found2.slice(0, 20)) this.log.warn('  [' + f.kind + '] ' + ledgerFindingInstruction(f));
      } else {
        this.log.log('ledger: identity and state are consistent across ' + scenes.length + ' scene(s).');
      }
    } catch (e: any) {
      // The ledger is a report. It must never be able to fail a run that produced a script.
      this.log.warn('ledger: audit skipped — ' + this.why(e));
    }

    // DEATHS THE WRITER INVENTED. Every exit this system knows comes from the PLAN. On 1 Sep the
    // plan said KANE @ 129, the writer killed him in scene 116 on its own initiative, and he spoke
    // through the whole of 117 — invisible to every check, because nothing reads a death out of the
    // written prose. This reads it.
    //
    // REPORTED ONLY, AND DELIBERATELY NOT FED FORWARD. Feeding a written death into
    // `unavailableLine` would strike that character out of every later scene's prompt, so one false
    // positive costs a living lead the third act. The detector is timid by construction — action
    // lines, present tense, a closed predicate list, no hedged sentence, never in flashback — but
    // timid is not the same as proven, and PLACE_JUMP is the standing lesson about shipping an
    // unproven rule with teeth. Run it against real drafts first; when it reports nothing false,
    // promoting it is one line at the scene loop.
    try {
      const invented = collectWrittenDeaths(view(), tracked);
      const newExits = writtenDeathsAsExits(invented, exits);
      if (newExits.length) {
        this.log.warn('writtenDeaths: ' + newExits.length + ' character(s) die in the prose that the plan never declared —');
        for (const d of invented.filter((x) => newExits.some((n) => n.name === x.name))) {
          this.log.warn('  ' + d.name + ' — scene ' + (d.sceneIndex + 1) + ' ("' + d.evidence + '")');
        }
        const after = checkDraftContinuity(view(), newExits);
        if (after.length) {
          this.log.warn('writtenDeaths: ' + after.length + ' scene(s) contradict a death written on the page —');
          for (const f of after.slice(0, 20)) this.log.warn('  [' + f.kind + '] ' + f.detail);
        } else {
          this.log.log('writtenDeaths: no scene contradicts them — the deaths are simply undeclared, not broken.');
        }
      }
    } catch (e: any) {
      this.log.warn('writtenDeaths: check skipped — ' + this.why(e));
    }

    // FIXED ATTRIBUTES. The ledger's six dimensions — life, place, physical, knows, holds, open —
    // are all about what a character DOES or where they ARE. None of them covers what a character
    // irreducibly IS, which is why Daria Kane could be written with female pronouns through most of
    // a draft and male pronouns through the rest with nothing objecting. Pronouns are the first
    // extractor; the signature that turned from A.Q. into R. Quick is the next one, and plugs into
    // the same verdict.
    //
    // Reported, like everything else in this block. A pronoun is a one-word fix a writer makes in
    // seconds once they are told where to look — sending the scene to a model to be rewritten would
    // risk a page of prose to save a keystroke.
    try {
      const attrs = checkFixedAttributes(view(), tracked);
      if (attrs.length) {
        this.log.warn('fixedAttributes: ' + attrs.length + ' character(s) change a fixed property mid-draft —');
        for (const a of attrs.slice(0, 20)) this.log.warn('  [' + a.kind + '/' + a.attribute + '] ' + a.detail + ' e.g. "' + a.evidence + '"');
      }
    } catch (e: any) {
      this.log.warn('fixedAttributes: check skipped — ' + this.why(e));
    }

    /**
     * THE CLOCK. Reported, never repaired.
     *
     * The MINUTEMEN draft is a real-time thriller whose timeline collapses, and every check we own
     * sat silent through it. The reason was notation: of its 33 clock references, 9 are digits in
     * action, 7 are the written military form ("0947") and 17 are SPOKEN — "Window opens
     * zero-nine-fifty". findTimeTokens read the first group only, so it was auditing nine
     * references out of thirty-three, and worse, it read "nine-fifty" out of "zero-nine-fifty-five"
     * and returned the wrong minute. findAllTimeTokens reads all three notations.
     *
     * Only clocks the scene SHOWS are held to running forwards. A character may say any time at
     * any moment — a window that opens later, a relief that happened earlier — and treating those
     * as regressions produced fourteen findings on a draft with one.
     */
    try {
      const clocks: any[] = [];
      const recalled: number[] = [];
      const draft = view();
      const plannedRecalled = new Set<number>(
        ((ledger && (ledger as any).places) || []).filter((p: any) => p && p.recalled).map((p: any) => Number(p.scene)),
      );
      for (let i = 0; i < draft.length; i++) {
        if (!draft[i] || !draft[i].text) continue;
        // Two readings of "is this a memory": the planner's own verdict, which saw the brief, and
        // the slug/first-lines regex, which sees the written page. A scene either of them calls
        // recalled is exempt — a missed flashback produces a false regression, and a false
        // exemption only loses a finding.
        if (isRecalledTime(draft[i].heading, draft[i].text) || plannedRecalled.has(i + 1)) recalled.push(i);
        for (const t of findAllTimeTokens(i, draft[i].text)) clocks.push(t);
      }
      const back = checkClockRegression(clocks as any, recalled);
      if (back.length) {
        this.log.warn('clock: ' + back.length + ' regression(s) — the story clock runs backwards —');
        for (const b of back.slice(0, 10)) this.log.warn('  ' + b.detail);
      } else if (clocks.length >= 8) {
        this.log.log('clock: ' + clocks.length + ' time reference(s) across the draft, none of them backwards.');
      }
    } catch (e: any) {
      this.log.warn('clock: check skipped — ' + this.why(e));
    }

    /**
     * FLASHBACKS. Reported, never repaired.
     *
     * The same two verdicts the clock uses to EXEMPT a scene — the planner's `recalled` flag, set
     * while it could still see the brief, and the page's own marker in the slug or opening lines —
     * are here compared instead of combined. Their disagreement is the finding.
     *
     * Planned as a memory with nothing on the page to say so is the craft defect: the reader meets
     * a jump in time as the present and is left to infer it. Marked on the page but missing from
     * the plan is this engine's defect: the clock and the object ledger counted that scene as
     * present-day, so anything they said around it should be read with that in mind.
     */
    try {
      const draft = view();
      const plannedRecalled = new Set<number>(
        ((ledger && (ledger as any).places) || []).filter((p: any) => p && p.recalled).map((p: any) => Number(p.scene)),
      );
      const flash = findFlashbackMismatches(
        draft.map((d: any) => ({ heading: String((d && d.heading) || ''), text: String((d && d.text) || '') })),
        plannedRecalled,
      );
      if (flash.length) {
        const unmarked = flash.filter((f) => f.kind === 'UNMARKED_ON_THE_PAGE').length;
        this.log.warn('flashback: ' + flash.length + ' scene(s) where the plan and the page disagree about time — '
          + unmarked + ' unmarked on the page —');
        for (const f of flash.slice(0, 10)) this.log.warn('  [' + f.kind + '] ' + f.detail);
      } else if (plannedRecalled.size) {
        this.log.log('flashback: ' + plannedRecalled.size + ' planned memory scene(s), all of them marked on the page.');
      }
    } catch (e: any) {
      this.log.warn('flashback: check skipped — ' + this.why(e));
    }

    /**
     * SHAPE OF THE DRAFT — density and repetition. Reported, never repaired.
     *
     * The obvious check here is the wrong one. "Warn when the average scene runs under a page"
     * fails BOTH delivered drafts (MINUTEMEN 1.25 scenes/page, Jason Quick 1.35) and would fail
     * every produced cross-cut thriller; the genre profile in feature-length.util already says a
     * THRILLER runs 1.15 scenes per page, so 1.25 is inside its own tolerance. Scene COUNT was
     * never the defect, and a check that fires on a clean draft is worse than no check.
     *
     * What separates the two drafts cleanly, measured before any of this was written:
     *
     *   fragment runs        MINUTEMEN 1 (scenes 117–128)   Jason Quick 1 (132–139, the stub tail)
     *   false scene breaks   MINUTEMEN 10 runs, 104 scenes, 90 pages     Jason Quick ZERO
     *   echoed phrases       MINUTEMEN 1                    Jason Quick 2
     *
     * The middle line is the reviewer's "consolidate the 129 micro-scenes", stated as a fact rather
     * than a preference: 108 of those 129 scenes sit in a run of consecutive scenes carrying an
     * IDENTICAL slug — twenty-four in a row reading INT. ECHO-01 LAUNCH CONTROL CAPSULE - DAY. The
     * count is not the problem. The problem is that most of them are not scenes.
     */
    try {
      const draft = view();
      const pages = draft.map((d: any) => (d && d.text ? countVisualLines(String(d.text)) / LINES_PER_PAGE : 0));
      const written = pages.filter((p: number) => p > 0).length;

      const fake = findFalseSceneBreaks(draft.map((d: any) => String((d && d.heading) || '')), pages);
      if (fake.length) {
        const inRuns = fake.reduce((a, b) => a + b.scenes, 0);
        const cost = Math.round(fake.reduce((a, b) => a + b.pages, 0) * 10) / 10;
        this.log.warn('density: ' + fake.length + ' run(s) of consecutive scenes sharing one heading — '
          + inRuns + ' of ' + draft.length + ' scenes (' + cost + ' pages) are scene breaks that break nothing —');
        for (const f of fake.slice(0, 8)) this.log.warn('  ' + f.detail);
      }

      const frag = findFragmentRuns(pages);
      if (frag.length) {
        this.log.warn('density: ' + frag.length + ' stretch(es) where the film never lands —');
        for (const f of frag.slice(0, 6)) this.log.warn('  ' + f.detail);
      }

      if (!fake.length && !frag.length && written >= 40) {
        this.log.log('density: ' + written + ' written scene(s), no fragment stretches and no repeated headings.');
      }

      const echo = findEchoedPhrases(draft);
      if (echo.length) {
        this.log.log('echo: ' + echo.length + ' phrase(s) the draft returns to — motif or tic, the writer decides —');
        for (const e of echo.slice(0, 6)) this.log.log('  ' + e.detail);
      }
    } catch (e: any) {
      this.log.warn('density: check skipped — ' + this.why(e));
    }

    setP({ note: '' });
    return { found, repaired, residue };
  }

  private async writeScene(ctx: string, sc: any, header: string, storySoFar: string, prevTail: string, projectId: string, budget?: LineBudget, unavailable = '', canon = '', canonNames?: Iterable<string>, spine = ''): Promise<string> {
    // The length instruction used to read "MUST fit on ONE page — roughly 8 to 16 short lines", which is
    // self-contradictory: a 12pt Courier page is 55 lines (the same 55 paginate() counts). Every scene
    // therefore came back at about a fifth of a page, and 60 of them made a 16-page "feature". The budget
    // is now computed from the scene's own pageWeight, so a cutaway stays short and a set piece can breathe.
    const b = budget || lineBudgetFor(sc && sc.pageWeight);
    const pageWord = b.pages === 1 ? 'ONE full page' : (b.pages < 1 ? ('about ' + b.pages + ' of a page') : ('about ' + b.pages + ' pages'));
    // Instruct in WORDS. Asking for a LINE count missed by ~50% on every scene, because line breaks
    // depend on wrapping the model cannot see; word count is something it can actually track.
    const lengthRule = 'LENGTH IS STRICT AND MEASURED: this scene must run ' + pageWord + ' of a screenplay — '
      + 'approximately ' + b.wordsAsk + ' WORDS, and it must NOT exceed ' + b.wordsMax + ' words. '
      + '(For reference that is roughly ' + b.target + ' lines including blank ones.) Count as you write and stop when you reach the target. '
      + (b.pages <= 0.5
          ? 'This is a SHORT beat: one image or one exchange, in and out. Do not develop it.'
          : 'Fill the space with real dramatic content — action beats, behaviour, dialogue that turns. Do NOT pad with description.')
      + ' Running OVER ' + b.wordsMax + ' words is a failure — it makes the finished screenplay too long to be a feature. '
      + 'Coming in far under is also a failure. If the material wants more room than this, cut it to fit instead.'
      // Density, not style. The 31 Aug draft opened with FOURTEEN consecutive description paragraphs
      // before a human did anything — every line of it good, the stack of them unreadable. The fix is
      // NOT to ban atmosphere (a script is READ before it is shot, and mood on the page is the point);
      // it is to stop atmosphere from queueing up. Scoped to scenes that actually have people in them,
      // so an establishing sequence with no cast is left alone.
      + (sc.characters
          ? ' PACING: characters are present in this scene, so at most THREE description paragraphs may'
            + ' pass before one of them acts, moves or speaks. Atmosphere is welcome — stacked atmosphere'
            + ' is not. Let an image land on its own line, then cut to a person.'
          : ' PACING: no characters are listed for this scene, so it is an establishing beat — keep it to'
            + ' a handful of images and get out.')
      // The model was hard-wrapping mid-sentence, which the renderer then read as a paragraph break.
      // The renderer now rejoins those, but a paragraph that arrives as one line is simply correct.
      + ' FORMATTING: write each action paragraph and each character\'s speech as ONE continuous line —'
      + ' do NOT insert line breaks inside a paragraph to wrap it. Separate paragraphs and beats with a'
      + ' single blank line. The page layout does its own wrapping.';
    const sys = 'You are a professional screenwriter writing ONE scene of a feature film in industry-standard FINAL DRAFT format. Present-tense action; dialogue = a centred UPPERCASE CHARACTER cue on its own line, an optional (parenthetical), then the line; use (V.O.)/(O.S.)/(CONT\'D) where apt. Land real emotion, subtext, conflict and one turn. ' + lengthRule + ' Write in fragments and single-line action beats (only what the camera sees); keep dialogue clipped and oblique — no speeches, no exposition dumps, no small talk. Enter on the last possible moment and cut on the turn. No novelistic prose, no unfilmable inner thoughts, no restating the heading. Do NOT write the scene heading/slug line (it is already provided) and do NOT add a scene number. Output ONLY the scene text.';
    // Two blocks the writer never had. `canon` is the same handful of fixed facts on every scene —
    // full names, durations, relationships — because a 130-scene feature is 130 independent calls and
    // nothing else carries a fact from the scene that set it to the scene that contradicted it.
    // `unavailable` names who is dead or gone, which is what stops a murdered mentor answering the
    // telephone thirty scenes later. Both are small enough to ride on every prompt, and with prompt
    // caching they are a cache read after the first scene.
    const user = ctx
      + (canon ? '\n\n' + canon : '')
      + (storySoFar ? '\n\nSTORY SO FAR (continuity - do not repeat):' + storySoFar : '')
      + (prevTail ? '\n\nPREVIOUS SCENE ENDED WITH (continue naturally, do not repeat):\n' + prevTail : '')
      + '\n\nSCENE HEADING (already set, do not rewrite): ' + header
      + '\nWHAT HAPPENS: ' + (sc.brief || 'Advance the story with conflict and a turn.')
      + (sc.characters ? '\nCHARACTERS PRESENT: ' + sc.characters : '')
      + (unavailable
          ? '\nALREADY GONE - dead or departed by this point in the story: ' + unavailable
            + '. They CANNOT appear in this scene, speak, telephone, message or be met. The living may'
            + ' still name them, remember them, grieve them or argue about them.'
          : '')
      // THE SPINE. Decided at plan time, handed over here — the same device as ALREADY GONE above,
      // which is the one continuity mechanism in this system with a clean record across two drafts.
      // Telling the writer what is true costs one line; recovering it from the prose afterwards has
      // failed three times running.
      + (spine ? '\n' + spine : '')
      + '\nTARGET LENGTH: ' + b.target + ' lines (' + b.pages + ' page' + (b.pages === 1 ? '' : 's') + ').\n\nWrite this scene in full now.';
    const clean = (raw: string) => this.cleanSceneText(raw);
    // What the last attempt got wrong, in words, appended to the next attempt's prompt.
    //
    // The gate used to detect a broken scene and retry the IDENTICAL request, which asks the model
    // to be luckier rather than to fix anything. Naming the defect is what makes the retry a
    // repair — and because the same deterministic check re-runs on the result, it is a repair that
    // confirms itself, which is the rule the "Vale Man" bug was written to enforce.
    let lastDefect = '';
    // Retry transient failures (timeout / rate-limit / empty return) before falling
    // back to the stub — a whole run of stubs is the bug we are hardening against.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // maxTokens here is a RUNAWAY GUARD, not the length control — see CAP_HEADROOM in
        // lineBudgetFor. Length is controlled by wordsAsk (the budget divided by the model's measured
        // delivery factor), so the scene lands on target and closes itself. Never tighten this cap to
        // shorten a scene: max_tokens stops the stream mid-word, which files a truncated scene.
        const attemptUser = lastDefect
          ? user + '\n\nTHE PREVIOUS ATTEMPT AT THIS SCENE WAS REJECTED. ' + lastDefect
            + '\nWrite the scene again, in full, complete to its last line.'
          : user;
        const r: any = await this.ai.run({ task: 'scripton.feature.scene', system: sys, user: attemptUser, maxTokens: b.maxTokens, temperature: 0.85, timeoutMs: 120000, projectId, refType: 'Project', refId: projectId });
        let txt = clean(String((r && r.text) || ''));
        // ONE SCENE, ONE STORY. On 1 Sep a single return carried the Jason/Sophie scene followed by
        // two pages of THE TRUMAN SHOW, markdown headings and all, and it shipped in the PDF. The
        // split keeps the scene when what survives is still a scene, and throws the whole answer
        // away when it is not — a truncation is a repair, so it is confirmed before it is kept.
        if (txt) {
          // The surviving text has to be a plausible scene on this scene's OWN terms, so the floor
          // comes from the word budget rather than from a flat proportion.
          const cut = splitAtSecondDocument(txt, Math.max(40, Math.round(b.wordsAsk * 0.4)));
          if (cut.problem) {
            const words = (cut.dropped.match(/\S+/g) || []).length;
            if (cut.keep) {
              this.log.warn('writeScene: "' + header + '" came back with a SECOND DOCUMENT ('
                + cut.problem.kind + ' at "' + cut.problem.line + '") — dropped ' + words
                + ' foreign word(s) and kept the scene.');
              txt = cut.kept;
            } else {
              this.log.warn('writeScene: "' + header + '" came back with a SECOND DOCUMENT ('
                + cut.problem.kind + ' at "' + cut.problem.line + '") and too little of the scene'
                + ' survived it — discarding the whole answer (attempt ' + (attempt + 1) + '/3).');
              continue;
            }
          }
        }
        // MECHANISM C — INTEGRITY GATE. A scene that stops mid-word, or that promises itself
        // instead of being written, is not a scene. On 1 Sep five of them shipped inside a
        // 103-page protected PDF: three cut mid-sentence ("...thrashing, l", "But he stops
        // breath", "...the door swing shut") and two whose entire body was "(The scene
        // continues.)". mostlyStub() could not have caught them — five of 139 is a healthy run.
        // The check needs no model and no other scene, so it costs nothing to run every time.
        if (txt) {
          const defects = checkSceneIntegrity(0, header, txt, canonNames);
          if (defects.length) {
            const worst = defects[0];
            if (attempt < 2) {
              lastDefect = sceneDefectInstruction(worst);
              this.log.warn('writeScene: "' + header + '" failed the integrity gate ('
                + worst.kind + ': "' + worst.detail + '") — naming the fault and retrying (attempt '
                + (attempt + 1) + '/3).');
              continue;
            }
            // Last attempt. Keep the prose — a scene that stops one clause early is worth far
            // more than a stub — but say exactly what is wrong so the repair pass and the
            // export gate both see it, and so it can never be mistaken for a finished scene.
            this.log.error('writeScene: "' + header + '" STILL fails the integrity gate after 3 '
              + 'attempts (' + defects.map((d) => d.kind + ': "' + d.detail + '"').join('; ')
              + ') — filing it flagged. ' + sceneDefectInstruction(worst));
          }
        }
        if (txt) {
          // CALIBRATION DATA. DELIVERY_FACTOR is currently inferred from run totals because nothing
          // recorded what each scene was asked for. One line per scene fixes that: grep 'scene.len'
          // from a finished run, group by w=, and set the factor (or a curve) from real numbers.
          const delivered = (txt.match(/\S+/g) || []).length;
          this.log.log('scene.len w=' + b.pages + ' ask=' + b.wordsAsk + ' budget=' + b.wordsBudget
            + ' got=' + delivered + ' ratio=' + (b.wordsAsk > 0 ? (delivered / b.wordsAsk).toFixed(2) : 'n/a')
            + ' | ' + header.slice(0, 48));
          return txt;
        }
        this.log.warn('writeScene: empty text returned for "' + header + '" (attempt ' + (attempt + 1) + '/3).');
      } catch (e) {
        // TERMINAL vs TRANSIENT. A retry is a bet that the next call differs from the last one.
        // Against a timeout or a rate limit that bet is good. Against an empty wallet it is not a
        // bet at all: on 1 Sep the router answered "out of credit/quota" for every provider and this
        // loop spent sixty-three doomed requests turning the last twenty-one scenes — the whole
        // third act — into stubs, after which the run filed itself DONE. Unwind instead, and let the
        // caller keep the 116 scenes that are real.
        if (isProviderExhausted(e)) {
          this.log.error('writeScene: HALTING at "' + header + '" — every AI provider refused for a reason no retry can fix. ' + this.why(e));
          throw new ScriptGenerationHalted('PROVIDER_EXHAUSTED', this.why(e));
        }
        this.log.warn('writeScene: attempt ' + (attempt + 1) + '/3 failed for "' + header + '" — ' + this.why(e));
      }
    }
    // Three failures. The caller counts stubs and fails the run wholesale past 50%, but a handful of
    // stubs slips through into a filed draft — so name every one.
    this.log.error('writeScene: GAVE UP on "' + header + '" after 3 attempts — filing a stub.');
    return SCENE_STUB;
  }

  // Half-or-more scenes stubbed = the AI never returned prose across the whole run. Kept as a
  // BACKSTOP only. It is the wrong shape for the failure that actually happened: twenty-one dead
  // scenes at the end of a 139-scene draft is 15%, and 15% passes this gate cleanly. What sees that
  // run is the consecutive-stub guard (isStubRunaway) in the scene loops, which trips at five.
  /**
   * The one sentence the operator reads when a run produces nothing.
   *
   * It has to be true. "The AI engine did not answer in time" is a diagnosis, and printing it over
   * an empty balance costs an evening looking at timeouts and network settings. A terminal failure
   * is also told plainly that retrying is pointless — otherwise the button invites exactly that.
   */
  private whyThePlanWasEmpty(projectId: string): string {
    const f = this.planFailure.get(projectId);
    const tail = ' Nothing was written and your current script is untouched.';
    if (!f) {
      return 'The scene planner returned no scenes — the AI engine did not answer in time.' + tail
        + ' Check AI Engines & Routing, then run Generate again.';
    }
    if (f.terminal) {
      return 'The scene planner could not run — ' + f.message + tail
        + ' This is NOT a timeout and running Generate again will not help:'
        + ' fix the provider in AI Engines & Routing (top up the credit, or route planning to an engine that has quota), then try again.';
    }
    return 'The scene planner returned no scenes — ' + f.message + tail
      + ' Check AI Engines & Routing, then run Generate again.';
  }

  private mostlyStub(stubs: number, total: number): boolean {
    return total > 0 && stubs / total >= 0.5;
  }

  // Drop the trailing stubs a halted run leaves behind, so the saved partial ends on real prose
  // rather than on four repetitions of "(The scene continues.)". `floor` protects an extend run's
  // out[0], which holds the entire pre-existing draft and must never be popped.
  private trimTrailingStubs(out: string[], floor: number): string[] {
    while (out.length > floor && String(out[out.length - 1]).endsWith(SCENE_STUB)) out.pop();
    return out;
  }

  /**
   * Landing for a run stopped part-way ON PURPOSE — the providers are gone, or the writer has
   * stopped returning prose.
   *
   * ERROR, not DONE, for the reason spelled out on failHeadlessDraft: DONE is an action, not a
   * label. It swaps the new revision over the user's working script and materialises its scenes
   * onto the board. Neither may happen for a draft that stops at scene 116 of 139.
   *
   * And like failHeadlessDraft — unlike failStubRun, and unlike the catch-all at the bottom of
   * generateFeatureAsync — the pages already written are NOT overwritten with an apology. That
   * prose cost real money and is worth reading; it stays on its own revision row, visible in the
   * Drafts panel, while the user's current script is left exactly as it was.
   */
  private failPartialRun(docId: string, kind: HaltKind, written: number, total: number, pageCount: number, detail: string): void {
    const why = String(detail || '').trim().replace(/\.+$/, '');
    const cause = kind === 'PROVIDER_EXHAUSTED'
      ? 'no AI provider would accept the request, for a reason retrying cannot fix — an empty balance, a spend cap, or a bad key'
      : 'the writer stopped returning prose — ' + STUB_STREAK_ABORT + ' scenes in a row came back empty';
    const fix = kind === 'PROVIDER_EXHAUSTED'
      ? 'Top up or fix the provider in AI Engines & Routing, then run Full rewrite.'
      : 'Check AI Engines & Routing, then run Full rewrite.';
    const p = this.genProgress.get(docId);
    if (p) {
      p.status = 'ERROR';
      p.coverage = 'SHORT';
      p.done = written;
      p.pageCount = pageCount;
      p.error = 'Generation stopped at scene ' + written + ' of ' + total + ' — ' + cause
        + (why ? ' (' + why + ')' : '') + '. It was NOT filed as your script and your current pages are untouched. '
        + 'The ' + pageCount + ' pages already written have been saved as a draft, not discarded. ' + fix;
      p.lastActivityAt = Date.now();
    }
    this.log.error('failPartialRun[' + kind + ']: script ' + docId + ' stopped after ' + written + ' of ' + total
      + ' scenes (' + pageCount + ' pages saved) — filed as ERROR, revision NOT activated.' + (why ? ' Cause: ' + why : ''));
  }

  // Mark a wholesale-stub generation as ERROR (not DONE) and replace the partial stub
  // pages with an honest, actionable placeholder. On regenerate the caller only swaps
  // the active revision on DONE, so the previous real draft (if any) survives untouched.
  private async failStubRun(docId: string, revId: string, stubs: number, total: number): Promise<void> {
    const p = this.genProgress.get(docId);
    if (p) { p.status = 'ERROR'; p.error = `Scene generation returned no prose for ${stubs} of ${total} scenes.`; }
    const text = 'FADE IN:\n\n(Scene generation did not return prose — ' + stubs + ' of ' + total + ' scenes came back empty. The draft was NOT filed as complete. Open the build in ScripON Studio and run "Generate script" again.)';
    this.log.error('failStubRun: scene generation returned no prose for ' + stubs + ' of ' + total + ' scenes — the run is marked ERROR and NOT filed as complete.');
    await (this.prisma as any).scriptRevision.update({ where: { id: revId }, data: { pageText: [{ page: 1, text }], pageCount: 1 } }).catch((e: any) => { this.log.error('failStubRun: could not write the placeholder to revision ' + revId + '. ' + this.why(e)); });
  }

  /**
   * Landing for a draft that stopped before the outline's final beats.
   *
   * Why this is an ERROR and not a DONE carrying a SHORT badge: DONE is not a label, it is an action.
   * The regenerate call site swaps the new revision over the user's working script on `status === 'DONE'`,
   * and generateScriptAsync materialises its scenes onto the board on the same condition. A script with
   * no ending must trigger neither. Length misses are different in kind and still file as DONE — short
   * is recoverable by extending, long by trimming, and both are readable meanwhile. A missing climax and
   * resolution is recoverable by neither, because there is no story to read.
   *
   * Unlike failStubRun, the written pages are deliberately NOT overwritten with a placeholder: this prose
   * is real and worth reading. Every page stays exactly as saved on its revision row — the same contract
   * as a cancel, reached by a different route.
   */
  private failHeadlessDraft(docId: string, pageCount: number, sceneCount: number, coverageNote: string, reason: string, retry: string): void {
    const why = String(reason || '').trim().replace(/\.+$/, '');
    const p = this.genProgress.get(docId);
    if (p) {
      p.status = 'ERROR';
      p.coverage = 'SHORT';
      p.done = sceneCount;
      p.pageCount = pageCount;
      p.coverageNote = coverageNote || '';
      p.error = 'The draft stops before the story reaches its ending'
        + (why ? ' — ' + why : '')
        + '. It was not filed as your script — your current pages are untouched, and the ' + pageCount + ' pages that were written have been saved, not discarded. Run ' + retry + ' again to write through to the climax and resolution.';
      p.lastActivityAt = Date.now();
    }
    this.log.error('failHeadlessDraft: script ' + docId + ' wrote ' + sceneCount + ' scenes over ' + pageCount
      + ' pages but did NOT reach the outline\'s final beats — filed as ERROR, revision NOT activated.'
      + (why ? ' Verdict: ' + why : ''));
  }

  /**
   * Length gate + expansion. A draft can reach the outline's final beat and still be half a feature —
   * that is exactly the failure this whole budget exists to catch, and `verifyEnding` cannot see it
   * because the ending is present. So: measure the real page count, and while the draft is short,
   * rewrite the scenes that came in furthest UNDER their page allocation at a bigger budget. Scenes
   * that already hit their mark are left alone — a short draft is short because specific scenes
   * underdelivered, not because every scene needs to grow.
   *
   * `out[0]` is 'FADE IN:', so scene i lives at out[i + 1]. Bounded to two passes and 24 scenes each
   * so a stubborn model cannot spin here forever.
   */
  private async expandShortScenes(
    docId: string,
    out: string[], scenes: any[], ctx: string, projectId: string, ar: boolean,
    plan: FeatureLengthPlan,
    setP: (patch: any) => void,
    // An expansion is a rewrite, so it needs the same continuity state the first draft had —
    // otherwise the pass that lengthens a short scene is free to resurrect somebody in it.
    exits: CastExit[],
    save: (draft: string[]) => Promise<number>,
  ): Promise<{ pages: number; expanded: number }> {
    const OFFSET = 1; // out[0] === 'FADE IN:'
    let pages = await save(out);
    let expanded = 0;
    let halted = false;   // set when the writer goes away mid-sweep; see the catch below
    for (let pass = 0; pass < 2; pass++) {
      if (this.cancelled(docId)) break;
      if (isLengthComplete(pages, plan.targetPages)) break;
      const written = scenes.map((sc: any, i: number) => ({ text: String(out[i + OFFSET] || ''), pageWeight: sc && sc.pageWeight }));
      const candidates = expansionCandidates(written, 24);
      if (!candidates.length) break;
      setP({
        phase: 'EXPANDING',
        note: 'Draft is ' + pages + ' of ~' + plan.targetPages + ' pages — expanding ' + candidates.length + ' short scenes.',
      });
      for (const c of candidates) {
        if (this.cancelled(docId)) break;
        const sc = scenes[c.index];
        if (!sc) continue;
        const header = (c.index + 1) + '  ' + this.slugOf(sc, ar);
        // Ask for half a page more than the original allocation, capped at the largest allowed weight.
        const bumped = lineBudgetFor(Math.min(3, snapPageWeight(sc.pageWeight) * 1.5));
        const prevTail = String(out[c.index] || '').slice(-700);
        let body = '';
        try {
          body = await this.writeScene(ctx, sc, header, '', prevTail, projectId, bumped, unavailableLine(exits, c.index), await this.canon.directiveFor(docId, c.index));
        } catch (e) {
          // The same outage the scene loop guards. Expansion is optional work — abandon the sweep
          // rather than spend another forty doomed requests; the draft stands exactly as written.
          if (isHalt(e)) { this.log.warn('expandShortScenes: halted mid-pass — ' + this.why(e)); halted = true; break; }
          this.log.warn('expandShortScenes: rewrite failed for scene ' + (c.index + 1) + ' — ' + this.why(e)); body = '';
        }
        // Only accept a rewrite that is genuinely longer — never trade a good scene for a shorter one.
        if (body && body !== SCENE_STUB && countVisualLines(body) > c.wrote) {
          out[c.index + OFFSET] = header + '\n\n' + body;
          expanded++;
        }
        setP({ note: 'Expanding short scenes — ' + expanded + ' rewritten.' });
      }
      pages = await save(out);
      this.log.log('expandShortScenes: pass ' + (pass + 1) + ' rewrote ' + expanded + ' scenes — draft now ' + pages + ' of ~' + plan.targetPages + ' pages.');
      if (halted) break;
    }
    if (!isLengthComplete(pages, plan.targetPages)) {
      this.log.warn('expandShortScenes: draft still short at ' + pages + ' of ~' + plan.targetPages + ' pages after expansion.');
    }
    return { pages, expanded };
  }

  private async generateFeatureAsync(docId: string, revId: string, projectId: string, stages: any[], existing: any[]): Promise<void> {
    try {
      const bRow: any = await (this.prisma as any).developmentBuild.findFirst({ where: { linkedScriptId: docId } }).catch((e: any) => { this.log.warn('build lookup failed for script ' + docId + ' — falling back to an empty brief. ' + this.why(e)); return null; });
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
      // Feature length is budgeted from PAGES, not from a beat multiplier. The old
      // `Math.min(90, Math.max(55, beatN * 1.5))` defaulted to 60 scenes and capped at 90 — below the
      // average produced feature — and combined with the old per-scene length target it produced a
      // ~16-page document. beatN is now only a floor: every beat still has to be dramatised.
      const lenPlan: FeatureLengthPlan | null = ssc ? null : planFeatureLength(featBrief, beatN);
      const target = ssc ? ssc.scenesPerEp : (lenPlan as FeatureLengthPlan).targetScenes;
      // Heartbeat while PLANNING (planScenes runs minutes before the first scene is written, so the
      // page counter can't move — the frontend stall guard must watch this, not just `done`).
      const beat = () => { const p = this.genProgress.get(docId); if (p) { p.phase = 'PLANNING'; p.lastActivityAt = Date.now(); } };
      const planned = await this.planScenes(ctx, projectId, spine, target, !!ssc, beat, lenPlan);
      // An EMPTY plan is a planner failure, and writing a script from whatever happens to be lying in
      // the SCENES stage is not a recovery — it is how a timed-out planning call became a 95-page draft
      // with no page weights, no exits, no continuity gate and no error message. A SHORT plan may still
      // legitimately defer to richer developed cards; a plan of zero never can.
      if (!planned.length && !ssc) {
        throw new Error(this.whyThePlanWasEmpty(projectId));
      }
      // Series: use the planned pilot at episode density (don't let a full-season SCENES stage override it).
      let scenes: any[] = ssc ? planned : ((planned.length >= (existing ? existing.length : 0)) ? planned : existing);
      if (!scenes || !scenes.length) scenes = (existing && existing.length) ? existing : planned;
      // Normalise the per-scene page allocations so they add up to the page target. The planner is asked
      // for them, but models drift on arithmetic across a hundred items, so the totals are rescaled here
      // rather than trusted. A reused SCENES stage has no weights at all and gets a sane default.
      if (lenPlan && scenes.length) scenes = applyPageWeights(scenes, lenPlan.targetPages);
      // ── CONTINUITY STATE ──────────────────────────────────────────────────────────────────
      // Two things the writer has never had. `exits` says who is dead or gone and from which scene,
      // so a murdered mentor cannot answer a telephone thirty scenes later — and, expressed as canon
      // facts, it is the anchor `canon-verify.util.ts` records as its missing input: without a declared
      // change point, a death at scene 30 is indistinguishable from a resurrection. The canon directive
      // is the rest — full names, durations, relationships — resolved to each scene's story point by
      // `resolveCanonAt` rather than sent flat to all 130.
      const exits: CastExit[] = collectExits(scenes);
      // MECHANISM D — the closed vocabulary, built from the plan before the first scene is written.
      // Without it `checkSceneIntegrity`'s label-leak rule has no cast to match against and stays
      // silent, which is how YOUNG JASON became a passport, a police booking and an access log.
      const ledgerSeed = (() => {
        try { return this.buildEntityLedger(scenes, exits); }
        catch { return { reg: createRegistry(), facts: [] as StateFact[] }; }
      })();
      const castVocab = new Set<string>();
      for (const e of ledgerSeed.reg.entities.values()) {
        if (e.kind !== 'PERSON' || e.mergedInto) continue;
        for (const f of allForms(ledgerSeed.reg, e.id)) castVocab.add(f);
      }
      // The one model call. Knowledge, promises and geography — the three dimensions the plan's own
      // fields cannot carry. It mutates `ledgerSeed.reg` by registering the vessels and objects the
      // story declares, which is why it runs before the writer starts rather than beside it.
      const planState = await this.extractPlanState(scenes, ledgerSeed.reg, projectId)
        .catch((e: any) => { this.log.warn('extractPlanState: skipped — ' + this.why(e)); return { facts: [] as StateFact[], places: [] as PlaceObservation[], transit: new Set<number>(), clock: new Map<number, number>(), props: [] as PropEvent[], designators: [] as string[], recalled: new Set<number>() }; });
      /**
       * THE SPINE, handed to each scene as it is written.
       *
       * Everything this returns was decided once, at plan time, by a call that was already being
       * made. The writer is told the clock, the objects in play and the locked vocabulary, exactly
       * as it is already told who is dead — and for the same reason: a contradiction the writer is
       * warned about is one it does not have to be caught making afterwards.
       *
       * Empty when the plan has nothing to say, which is most stories. A film that does not run on
       * a clock gets no clock, and a prompt with nothing to add gets nothing added.
       */
      const spineFor = (sceneNumber: number): string => {
        try {
          // A scene set in the past is told the vocabulary and NOTHING ELSE. Handing a memory the
          // present-day clock, or the news that an object it is about to show was destroyed
          // eighty scenes later, is worse than telling it nothing.
          if (planState.recalled.has(sceneNumber)) return spineDirective(sceneNumber, null, [], planState.designators, true);
          return spineDirective(sceneNumber, planState.clock.get(sceneNumber) ?? null, planState.props, planState.designators, false);
        } catch { return ''; }
      };
      const ledger = { reg: ledgerSeed.reg, facts: ledgerSeed.facts.concat(planState.facts), places: planState.places, transit: planState.transit };
      if (exits.length) {
        const planIssues = checkPlanCast(scenes, exits);
        const strip = stripExitedCast(scenes, exits);
        scenes = strip.scenes;
        if (planIssues.length) this.log.warn('generateFeatureAsync: the plan itself lists characters who have already left the story in '
          + planIssues.length + ' scene(s) — ' + strip.removed + ' cast entries removed before writing.');
        this.log.log('generateFeatureAsync: tracking ' + exits.length + ' cast exit(s) — '
          + exits.map((e) => e.name + ' @ ' + (e.scene + 1)).join(', '));
      }
      // Still PLANNING as far as the UI is concerned — this is one call that can run a couple of
      // minutes on a long document, and a silent gap reads as a hang. The overlay never stall-checks
      // during PLANNING, so the heartbeat is what keeps the message honest rather than what keeps it alive.
      const beatCanon = this.genProgress.get(docId);
      if (beatCanon) { beatCanon.phase = 'PLANNING'; beatCanon.note = 'Reading the source for the story\'s fixed facts — names, dates, relationships.'; beatCanon.lastActivityAt = Date.now(); }
      // Everything goes into the canon graph in ./canon rather than a parallel store: it is bi-temporal,
      // so `resolveCanonAt` answers "what is true at scene N" without any special-casing here, and
      // `persistFacts` stamps a monotonic recordedAt so a rerun's facts supersede the previous run's.
      const canonFacts: CanonFactCore[] = exitsAsCanonFacts(exits).concat(await this.extractCanon(projectId, stages));
      if (canonFacts.length) await this.canon.persistFacts(docId, canonFacts).catch((e: any) => this.log.warn('persistFacts failed — the draft continues without stored canon. ' + this.why(e)));
      const setP = (patch: any) => { const p = this.genProgress.get(docId); if (p) Object.assign(p, patch, { lastActivityAt: Date.now() }); };
      const saveRev = async (pages: any[]) => { await (this.prisma as any).scriptRevision.update({ where: { id: revId }, data: { pageText: pages, pageCount: pages.length } }).catch((e: any) => { this.log.error('saveRev: could NOT persist ' + pages.length + ' pages to revision ' + revId + ' — generated work is being lost. ' + this.why(e)); }); };
      if (!scenes.length) {
        const bodyOf = (k: string) => { const x: any = stages.find((y: any) => y.kind === k); return String((x && x.current && x.current.body) || ''); };
        const pages = this.paginate(this.ensureSluglines(bodyOf('DRAFT')) || 'No developed material to expand into a feature yet.');
        await saveRev(pages); setP({ status: 'DONE', total: pages.length, done: pages.length, pageCount: pages.length });
        return;
      }
      setP({
        total: scenes.length, phase: 'WRITING', note: '',
        targetPages: lenPlan ? lenPlan.targetPages : null,
        targetMinutes: lenPlan ? lenPlan.targetMinutes : null,
      });
      const out: string[] = ['FADE IN:'];
      let storySoFar = ''; let prevTail = ''; let stubs = 0; let streak = 0;
      // Live page budget. Allocating up front and trusting the model does not hold — it ran ~50% over
      // on every scene, so a 105-page plan was heading for 190. After each scene we re-derive the
      // remaining allowance from what is ACTUALLY on the page and scale the next scene to fit.
      const plannedTotal = scenes.reduce((a: number, x: any) => a + snapPageWeight(x && x.pageWeight), 0);
      let plannedSoFar = 0;
      let linesSoFar = 1; // 'FADE IN:'
      for (let i = 0; i < scenes.length; i++) {
        // Cooperative cancel — checked between scenes so a stop never truncates one mid-write.
        if (this.cancelled(docId)) {
          const pages = this.paginate(out.join('\n\n'));
          await saveRev(pages);
          this.finishCancelled(docId, i, scenes.length, pages.length);
          return;
        }
        const sc = scenes[i];
        const header = (i + 1) + '  ' + this.slugOf(sc, ar);
        const baseWeight = snapPageWeight(sc && sc.pageWeight);
        const scale = lenPlan
          ? remainingBudgetScale((lenPlan as FeatureLengthPlan).targetPages, linesSoFar / LINES_PER_PAGE, plannedTotal - plannedSoFar)
          : 1;
        const budget = lineBudgetFor(baseWeight * scale);
        let body: string;
        try {
          body = await this.writeScene(ctx, sc, header, storySoFar.slice(-1600), prevTail.slice(-700), projectId, budget, unavailableLine(exits, i), await this.canon.directiveFor(docId, i), castVocab, spineFor(i + 1));
        } catch (e) {
          // Only a deliberate halt lands here; anything else is a real crash and belongs to the
          // catch-all below, which is allowed to replace pageText because there is nothing to keep.
          if (!isHalt(e)) throw e;
          const pages = this.paginate(this.trimTrailingStubs(out, 0).join('\n\n'));
          await saveRev(pages);
          this.failPartialRun(docId, e.kind, i, scenes.length, pages.length, e.message);
          return;
        }
        if (body === SCENE_STUB) { stubs++; streak++; } else streak = 0;
        // A RUNAWAY, NOT BAD LUCK. An empty return is ordinary and local — seven scenes came back
        // empty on 1 Sep and every one recovered on its own second or third attempt. Five in a row
        // is fifteen consecutive failed requests, which is not this scene being difficult; it is the
        // writer being gone. Stop, keep what is real, and say so.
        if (isStubRunaway(streak)) {
          const pages = this.paginate(this.trimTrailingStubs(out, 0).join('\n\n'));
          await saveRev(pages);
          this.failPartialRun(docId, 'STUB_STREAK', i + 1 - streak, scenes.length, pages.length, streak + ' consecutive empty scenes');
          return;
        }
        plannedSoFar += baseWeight;
        linesSoFar += countVisualLines(header + '\n\n' + body) + 2; // +2 for the blank-line join
        if (lenPlan && i > 0 && i % 25 === 0) {
          const lp = lenPlan as FeatureLengthPlan;
          this.log.log('generateFeatureAsync: scene ' + (i + 1) + '/' + scenes.length + ' — '
            + Math.round(linesSoFar / LINES_PER_PAGE) + ' pages of ~' + lp.targetPages
            + ' (planned ' + Math.round(plannedSoFar) + ') · budget scale ' + scale.toFixed(2) + '.');
        }
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
      // LENGTH GATE. Reaching the final beat is not the same as being a feature: the old configuration
      // could hit the ending at 16 pages and file DONE. Measure, and expand the scenes that came in
      // short before anything is called complete.
      let expandedCount = 0;
      if (lenPlan) {
        const res = await this.expandShortScenes(docId, out, scenes, ctx, projectId, ar, lenPlan, setP, exits, async (draft: string[]) => {
          const pg = this.paginate(draft.join('\n\n') + '\n\nFADE OUT.');
          await saveRev(pg);
          setP({ pageCount: pg.length });
          return pg.length;
        });
        expandedCount = res.expanded;
      }
      // ── FINAL VERIFICATION PASS ───────────────────────────────────────────────────────────
      // Runs after expansion (which rewrites scenes and can reintroduce a fault) and before anything
      // is filed. Deterministic detection, targeted repair, deterministic re-check.
      const contin = await this.verifyAndRepair(docId, out, scenes, exits, canonFacts, ctx, projectId, ar, 0, setP, ledger);
      const continNote = (exits.length || contin.found) ? summariseContinuity(contin.found, contin.repaired, contin.residue) : '';

      out.push('FADE OUT.');
      const pages = this.paginate(out.join('\n\n'));
      await saveRev(pages);
      if (ssc) {
        // #45: a series build delivers the PILOT episode at its per-episode density; the full season
        // is episodes × per-ep. Don't run the feature ending-check (the pilot ends on a cliffhanger).
        setP({ status: 'DONE', done: scenes.length, pageCount: pages.length, coverage: 'COMPLETE', scenesPerEp: ssc.scenesPerEp, seasonScenes: ssc.seasonScenes, coverageNote: 'Pilot episode: ' + scenes.length + ' scenes at ~' + featBrief.minutesPerEp + ' min/ep · full season ≈ ' + ssc.seasonScenes + ' scenes (' + ssc.episodes + ' ep × ' + ssc.scenesPerEp + ').' + (continNote ? ' · ' + continNote : '') });
      } else {
        // Two independent completeness checks, because they fail independently: verifyEnding asks whether
        // the story ARRIVED, the length gate asks whether the film is FEATURE-LENGTH. A draft can pass
        // either one alone and still not be deliverable.
        let cov = await this.verifyEnding(spine, out.slice(-4).join('\n\n'), projectId);
        // Second look before an incomplete verdict is allowed to fail the whole run. The first pass reads
        // 3,000 characters of tail; one long closing scene can push the resolution out of that window, and
        // a single false 'incomplete' would now throw away a finished script. Only a verdict that survives
        // a wider read is acted on — one extra cheap call, and only on the failure path.
        if (!cov.complete) {
          const wider = await this.verifyEnding(spine, out.slice(-8).join('\n\n'), projectId, 6000);
          if (wider.complete) this.log.warn('generateFeatureAsync: the ending check disagreed with itself — the 3k-tail read said incomplete, the 6k-tail read said complete. Taking the wider read.');
          cov = wider.complete ? wider : { complete: false, note: wider.note || cov.note };
        }
        const lp = lenPlan as FeatureLengthPlan;
        // Two bounds, not one. The gate used to test only "is it long enough", so a 190-page draft
        // filed as COMPLETE — a script that overshoots the feature band is no more deliverable than
        // one that undershoots it.
        const tooShort = !!lenPlan && !isLengthComplete(pages.length, lp.targetPages);
        const tooLong = !!lenPlan && isLengthOver(pages.length, lp.targetPages);
        const pct = lenPlan ? Math.round(completionRatio(pages.length, lp.targetPages) * 100) : 100;
        const notes: string[] = [];
        if (cov.note) notes.push(cov.note);
        if (continNote) notes.push(continNote);
        /**
         * FINAL SCENE-INTEGRITY SWEEP — the one the 2 Sep draft needed and did not have.
         *
         * The per-scene gate in `writeScene` retries three times and then files a stub rather than
         * abandoning a forty-minute run, which is the right trade. But it means a FINISHED draft can
         * still carry dead scenes, and nothing downstream said so: the 2 Sep export reported clean
         * and shipped four broken scenes — 53 and 124 containing only "(The scene continues.)", 30
         * stopping at `ALEXANDER (smi` and 74 at a bare `GI`. An external reader found all four in
         * minutes; the system that wrote them called the draft complete.
         *
         * So the draft counts them and says so in its own coverage note. Not a hard block — a
         * partial feature the writer can repair by hand beats no feature at all — but it can no
         * longer be presented as finished work.
         */
        const brokenScenes: number[] = [];
        try {
          for (let i = 0; i < out.length; i++) {
            const whole = String(out[i] || '');
            const nl = whole.indexOf('\n');
            const head = nl < 0 ? whole : whole.slice(0, nl);
            if (checkSceneIntegrity(i, head, whole, castVocab).length) brokenScenes.push(i + 1);
          }
        } catch (e: any) { this.log.warn('sceneIntegrity sweep skipped — ' + this.why(e)); }
        if (brokenScenes.length) {
          this.log.error('sceneIntegrity: ' + brokenScenes.length + ' scene(s) did NOT finish and are in the filed draft — '
            + brokenScenes.join(', '));
          notes.push(brokenScenes.length + ' scene(s) did not finish (' + brokenScenes.slice(0, 8).join(', ')
            + (brokenScenes.length > 8 ? '…' : '') + ') — rewrite them before circulating this draft.');
        }
        if (lenPlan) {
          notes.push(pages.length + ' of ~' + lp.targetPages + ' pages (' + pct + '%) · ≈ '
            + Math.round(pages.length / lp.pagesPerMinute) + ' min · ' + scenes.length + ' scenes'
            + (expandedCount ? ' · ' + expandedCount + ' scenes expanded' : ''));
          if (tooShort) notes.push('Short of feature length — run Regenerate (extend) to keep building, or lower the page target.');
          if (tooLong) notes.push('Longer than a feature — ' + Math.round(pages.length / lp.pagesPerMinute) + ' minutes of screen time. Trim scenes, or raise the page target if this length is intended.');
          if (tooLong) this.log.warn('generateFeatureAsync: draft is OVER length — ' + pages.length + ' pages against a target of ' + lp.targetPages + '.');
        }
        // ENDING GATE, post-write twin of the plan-side gate in planScenes. The plan gate stops a headless
        // scene map before a single scene is paid for; this one catches the case where the plan promised an
        // ending and the writing never arrived at it. Either way the run does not become the user's script.
        if (!cov.complete) { this.failHeadlessDraft(docId, pages.length, scenes.length, notes.join(' · '), cov.note, 'Generate script'); return; }
        setP({
          status: 'DONE', done: scenes.length, pageCount: pages.length,
          coverage: (!tooShort && !tooLong) ? 'COMPLETE' : tooLong ? 'LONG' : 'SHORT',
          coverageNote: notes.join(' · '),
          targetPages: lenPlan ? lp.targetPages : null,
          completionPct: pct,
        });
      }
    } catch (e: any) {
      const msg = String((e && e.message) || e).slice(0, 200);
      this.log.error('generateFeatureAsync: run FAILED for script ' + docId + ' — ' + this.why(e), (e && e.stack) || undefined);
      const p = this.genProgress.get(docId); if (p) { p.status = 'ERROR'; p.error = msg; }
      // Don't leave the misleading "being written…" placeholder forever — write an honest, actionable message.
      try { await (this.prisma as any).scriptRevision.update({ where: { id: revId }, data: { pageText: [{ page: 1, text: 'FADE IN:\n\n(The automatic feature generation did not finish:\n' + msg + '\n\nOpen this build in ScripON Studio and run "Generate script" again, or press Retry.)' }], pageCount: 1 } }); } catch { /* */ }
    }
  }

  // Dispatch the production hand-off writer by FORMAT: feature/series → scene-by-scene; vertical → episode-by-episode; documentary → narration.
  private async generateScriptAsync(docId: string, revId: string, projectId: string, stages: any[], existing: any[]): Promise<void> {
    const bRow: any = await (this.prisma as any).developmentBuild.findFirst({ where: { linkedScriptId: docId } }).catch((e: any) => { this.log.warn('build lookup failed for script ' + docId + ' — falling back to an empty brief. ' + this.why(e)); return null; });
    const brief = (bRow && bRow.brief) || {};
    const fam = normalizeFamily(brief);
    // The single most useful line in the log: which writer ran, and whether the brief actually arrived.
    // An empty brief silently defaults the genre profile AND the page target — see feature-length.util.
    this.log.log('generateScriptAsync: script ' + docId + ' · family ' + fam
      + ' · brief ' + (bRow ? (Object.keys(brief || {}).length + ' fields') : 'MISSING (no DevelopmentBuild linked)')
      + ' · genres ' + JSON.stringify((brief && brief.genres) || null)
      + ' · targetPages ' + ((brief && (brief.targetPages ?? brief.length)) ?? 'not set'));
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
      if (!pages.length) { this.log.warn('materialiseScenes: revision ' + revisionId + ' has no pageText — nothing to parse.'); return 0; }
      const scenes = parseScenes(pages);
      if (!scenes.length) { this.log.warn('materialiseScenes: parsed 0 scenes from ' + pages.length + ' pages of revision ' + revisionId + ' — sluglines are probably not in a recognised format.'); return 0; }
      await (this.prisma as any).scriptScene.createMany({ data: scenes.map((s, i) => ({ revisionId, projectId, sortOrder: i, ...s })) });
      this.log.log('materialiseScenes: wrote ' + scenes.length + ' ScriptScene rows for revision ' + revisionId + '.');
      return scenes.length;
    } catch (e) {
      // Returning 0 here is indistinguishable from "nothing to do" — and this is the bridge that makes
      // a developed script visible in Reader / Doctor / Room at all. Silence here reads to the user as
      // "the script generated but is empty".
      this.log.error('materialiseScenes: FAILED for revision ' + revisionId + ' — the script will render with no scenes. ' + this.why(e));
      return 0;
    }
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
      const saveRev = async (pages: any[]) => { await (this.prisma as any).scriptRevision.update({ where: { id: revId }, data: { pageText: pages, pageCount: pages.length } }).catch((e: any) => { this.log.error('saveRev: could NOT persist ' + pages.length + ' pages to revision ' + revId + ' — generated work is being lost. ' + this.why(e)); }); };
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
      const saveRev = async (pages: any[]) => { await (this.prisma as any).scriptRevision.update({ where: { id: revId }, data: { pageText: pages, pageCount: pages.length } }).catch((e: any) => { this.log.error('saveRev: could NOT persist ' + pages.length + ' pages to revision ' + revId + ' — generated work is being lost. ' + this.why(e)); }); };
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
  /**
   * How long a run may go silent before a new request is allowed to replace it.
   *
   * `lastActivityAt` is stamped on every scene, every planning pass and every repair, so a healthy
   * run touches it constantly. The only gap that approaches this is a single planning call at its
   * 230-second ceiling. Ten minutes is therefore "the process is wedged", not "the run is slow" —
   * and generous enough that a working run is never interrupted by an impatient second click.
   */
  private static readonly RUN_LOCK_MS = 10 * 60 * 1000;

  async regenerateFeature(docId: string, userId?: string, mode: 'extend' | 'rewrite' = 'extend') {
    const doc: any = await (this.prisma as any).scriptDocument.findUnique({ where: { id: docId } }).catch(() => null);
    if (!doc) throw new BadRequestException('Script not found.');
    // ONE RUN PER SCRIPT.
    //
    // A second click while a generation was in flight used to start an entire parallel run against
    // the same document: two writers stamping the same genProgress entry, two planning calls
    // competing for the same provider, and the loser throwing "the scene planner returned no
    // scenes" as a toast on top of a run that was working perfectly. On 1 Sep that happened twice
    // in one evening and both times it read as the run having failed.
    //
    // The second request is not an error and must not be reported as one — the writer asked for a
    // generation and there is one. Hand back the run already in flight and let the UI attach to it.
    const live = this.genProgress.get(docId);
    if (live && live.status === 'GENERATING' && !live.cancelRequested
        && Date.now() - (live.lastActivityAt || 0) < ScripOnService.RUN_LOCK_MS) {
      this.log.warn('regenerateFeature: script ' + docId + ' is already generating ('
        + (live.phase || 'RUNNING') + ', ' + live.done + '/' + live.total
        + ') — refusing to start a second run and returning the one in flight.');
      return {
        documentId: docId, revisionId: null, total: live.total,
        mode: mode === 'rewrite' ? 'rewrite' : 'extend',
        alreadyRunning: true, phase: live.phase || null, done: live.done, pageCount: live.pageCount,
      };
    }
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
    // The initial progress total the UI shows. 60 was the old short-film default; size it from the
    // build's own page budget so the bar is honest from the first poll.
    const regPlan = planFeatureLength((build && build.brief) || {}, this.countBeats(stages));
    const estTotal = Math.max(existing.length, regPlan.targetScenes);
    this.genProgress.set(doc.id, { status: 'GENERATING', phase: 'PLANNING', lastActivityAt: Date.now(), note: 'Planning the scenes — this can take a few minutes on long scripts.', done: doExtend ? existingPages.length : 0, total: estTotal, pageCount: existingPages.length });
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
      const bRow: any = await (this.prisma as any).developmentBuild.findFirst({ where: { linkedScriptId: docId } }).catch((e: any) => { this.log.warn('build lookup failed for script ' + docId + ' — falling back to an empty brief. ' + this.why(e)); return null; });
      const featBrief = (bRow && bRow.brief) || {};
      const featDirective = [await this.langDirective(featBrief), knowledgeDirective(featBrief)].filter(Boolean).join('\n');
      const ctx = await this.buildFeatureCtx(projectId, stages, featDirective);
      const ar = this.isArabicBrief(featBrief);
      const spine = this.buildSpine(stages);
      const beatN = this.countBeats(stages);
      // #45: a series extends only to its per-episode pilot density, not the feature band.
      const isSeries = ['TV_SERIES', 'LIMITED'].indexOf(String(featBrief.projectType || '').toUpperCase()) >= 0;
      const ssc = isSeries ? seriesSceneCount(featBrief.episodes, featBrief.minutesPerEp) : null;
      // Same page budget as a fresh generation — an extend that re-planned at 60 scenes would cap the
      // finished script at the very length this fix exists to escape.
      const lenPlan: FeatureLengthPlan | null = ssc ? null : planFeatureLength(featBrief, beatN);
      const target = ssc ? ssc.scenesPerEp : (lenPlan as FeatureLengthPlan).targetScenes;
      const beat = () => { const p = this.genProgress.get(docId); if (p) { p.phase = 'PLANNING'; p.lastActivityAt = Date.now(); } };
      const planned = await this.planScenes(ctx, projectId, spine, target, !!ssc, beat, lenPlan);
      // An EMPTY plan is a planner failure, and writing a script from whatever happens to be lying in
      // the SCENES stage is not a recovery — it is how a timed-out planning call became a 95-page draft
      // with no page weights, no exits, no continuity gate and no error message. A SHORT plan may still
      // legitimately defer to richer developed cards; a plan of zero never can.
      if (!planned.length && !ssc) {
        throw new Error(this.whyThePlanWasEmpty(projectId));
      }
      let scenes: any[] = ssc ? planned : ((planned.length >= existing.length) ? planned : existing);
      if (lenPlan && scenes.length) scenes = applyPageWeights(scenes, lenPlan.targetPages);
      // Same continuity state as a fresh run — an extend writes real scenes and can resurrect
      // somebody just as easily. See generateFeatureAsync for why these two exist.
      const exits: CastExit[] = collectExits(scenes);
      // MECHANISM D — the closed vocabulary, built from the plan before the first scene is written.
      // Without it `checkSceneIntegrity`'s label-leak rule has no cast to match against and stays
      // silent, which is how YOUNG JASON became a passport, a police booking and an access log.
      const ledgerSeed = (() => {
        try { return this.buildEntityLedger(scenes, exits); }
        catch { return { reg: createRegistry(), facts: [] as StateFact[] }; }
      })();
      const castVocab = new Set<string>();
      for (const e of ledgerSeed.reg.entities.values()) {
        if (e.kind !== 'PERSON' || e.mergedInto) continue;
        for (const f of allForms(ledgerSeed.reg, e.id)) castVocab.add(f);
      }
      // The one model call. Knowledge, promises and geography — the three dimensions the plan's own
      // fields cannot carry. It mutates `ledgerSeed.reg` by registering the vessels and objects the
      // story declares, which is why it runs before the writer starts rather than beside it.
      const planState = await this.extractPlanState(scenes, ledgerSeed.reg, projectId)
        .catch((e: any) => { this.log.warn('extractPlanState: skipped — ' + this.why(e)); return { facts: [] as StateFact[], places: [] as PlaceObservation[], transit: new Set<number>(), clock: new Map<number, number>(), props: [] as PropEvent[], designators: [] as string[], recalled: new Set<number>() }; });
      /**
       * THE SPINE, handed to each scene as it is written.
       *
       * Everything this returns was decided once, at plan time, by a call that was already being
       * made. The writer is told the clock, the objects in play and the locked vocabulary, exactly
       * as it is already told who is dead — and for the same reason: a contradiction the writer is
       * warned about is one it does not have to be caught making afterwards.
       *
       * Empty when the plan has nothing to say, which is most stories. A film that does not run on
       * a clock gets no clock, and a prompt with nothing to add gets nothing added.
       */
      const spineFor = (sceneNumber: number): string => {
        try {
          // A scene set in the past is told the vocabulary and NOTHING ELSE. Handing a memory the
          // present-day clock, or the news that an object it is about to show was destroyed
          // eighty scenes later, is worse than telling it nothing.
          if (planState.recalled.has(sceneNumber)) return spineDirective(sceneNumber, null, [], planState.designators, true);
          return spineDirective(sceneNumber, planState.clock.get(sceneNumber) ?? null, planState.props, planState.designators, false);
        } catch { return ''; }
      };
      const ledger = { reg: ledgerSeed.reg, facts: ledgerSeed.facts.concat(planState.facts), places: planState.places, transit: planState.transit };
      if (exits.length) {
        const strip = stripExitedCast(scenes, exits);
        scenes = strip.scenes;
        this.log.log('extendFeatureAsync: tracking ' + exits.length + ' cast exit(s); '
          + strip.removed + ' impossible cast entries removed before writing.');
      }
      // Still PLANNING as far as the UI is concerned — this is one call that can run a couple of
      // minutes on a long document, and a silent gap reads as a hang. The overlay never stall-checks
      // during PLANNING, so the heartbeat is what keeps the message honest rather than what keeps it alive.
      const beatCanon = this.genProgress.get(docId);
      if (beatCanon) { beatCanon.phase = 'PLANNING'; beatCanon.note = 'Reading the source for the story\'s fixed facts — names, dates, relationships.'; beatCanon.lastActivityAt = Date.now(); }
      // Everything goes into the canon graph in ./canon rather than a parallel store: it is bi-temporal,
      // so `resolveCanonAt` answers "what is true at scene N" without any special-casing here, and
      // `persistFacts` stamps a monotonic recordedAt so a rerun's facts supersede the previous run's.
      const canonFacts: CanonFactCore[] = exitsAsCanonFacts(exits).concat(await this.extractCanon(projectId, stages));
      if (canonFacts.length) await this.canon.persistFacts(docId, canonFacts).catch((e: any) => this.log.warn('persistFacts failed — the draft continues without stored canon. ' + this.why(e)));
      const setP = (patch: any) => { const p = this.genProgress.get(docId); if (p) Object.assign(p, patch, { lastActivityAt: Date.now() }); };
      const saveRev = async (pages: any[]) => { await (this.prisma as any).scriptRevision.update({ where: { id: revId }, data: { pageText: pages, pageCount: pages.length } }).catch((e: any) => { this.log.error('saveRev: could NOT persist ' + pages.length + ' pages to revision ' + revId + ' — generated work is being lost. ' + this.why(e)); }); };
      // How many scenes does the existing script already contain? Numbered headers "N␠␠SLUG"; fall back to a page-based estimate.
      const existingText = (existingPages || []).map((p: any) => String(p.text || '')).join('\n');
      const haveN = (existingText.match(/^\s*\d+\s{2,}\S/gmu) || []).length || Math.max(1, Math.round((existingPages.length || 1) / 1.7));
      const startIdx = Math.min(haveN, scenes.length);
      if (startIdx >= scenes.length) { setP({ status: 'DONE', done: scenes.length, total: scenes.length, pageCount: existingPages.length, coverage: 'COMPLETE', coverageNote: 'Script already covers the full planned scene list.' }); return; }
      setP({
        total: scenes.length, done: startIdx, phase: 'WRITING', note: '',
        targetPages: lenPlan ? lenPlan.targetPages : null,
        targetMinutes: lenPlan ? lenPlan.targetMinutes : null,
      });
      // Trim a trailing FADE OUT (EN or AR) so new scenes append seamlessly, then keep numbering from where it left off.
      const baseText = existingText.replace(/\n*FADE OUT\.?\s*$/i, '').replace(/\n*اختفاء تدريجي[.،]?\s*$/u, '').trimEnd();
      const out: string[] = [baseText];
      let storySoFar = baseText.slice(-2000); let prevTail = baseText.slice(-700); let stubs = 0; let streak = 0;
      const newCount = scenes.length - startIdx;
      // Same controller as a fresh run, seeded with the pages the existing draft already occupies —
      // an extend that ignores them would blow straight past the page target.
      const plannedTotal = scenes.reduce((a: number, x: any) => a + snapPageWeight(x && x.pageWeight), 0);
      let plannedSoFar = scenes.slice(0, startIdx).reduce((a: number, x: any) => a + snapPageWeight(x && x.pageWeight), 0);
      let linesSoFar = (existingPages.length || 0) * LINES_PER_PAGE;
      for (let i = startIdx; i < scenes.length; i++) {
        if (this.cancelled(docId)) {
          const pages = this.paginate(out.join('\n\n'));
          await saveRev(pages);
          this.finishCancelled(docId, i, scenes.length, pages.length);
          return;
        }
        const sc = scenes[i];
        const header = (i + 1) + '  ' + this.slugOf(sc, ar);
        const baseWeight = snapPageWeight(sc && sc.pageWeight);
        const scale = lenPlan
          ? remainingBudgetScale((lenPlan as FeatureLengthPlan).targetPages, linesSoFar / LINES_PER_PAGE, plannedTotal - plannedSoFar)
          : 1;
        let body: string;
        try {
          body = await this.writeScene(ctx, sc, header, storySoFar.slice(-1600), prevTail.slice(-700), projectId, lineBudgetFor(baseWeight * scale), unavailableLine(exits, i), await this.canon.directiveFor(docId, i), castVocab, spineFor(i + 1));
        } catch (e) {
          if (!isHalt(e)) throw e;
          // Floor 1: out[0] is the ENTIRE pre-existing draft, which must survive the trim.
          const pages = this.paginate(this.trimTrailingStubs(out, 1).join('\n\n'));
          await saveRev(pages);
          this.failPartialRun(docId, e.kind, i, scenes.length, pages.length, e.message);
          return;
        }
        if (body === SCENE_STUB) { stubs++; streak++; } else streak = 0;
        // A RUNAWAY, NOT BAD LUCK. An empty return is ordinary and local — seven scenes came back
        // empty on 1 Sep and every one recovered on its own second or third attempt. Five in a row
        // is fifteen consecutive failed requests, which is not this scene being difficult; it is the
        // writer being gone. Stop, keep what is real, and say so.
        if (isStubRunaway(streak)) {
          const pages = this.paginate(this.trimTrailingStubs(out, 1).join('\n\n'));
          await saveRev(pages);
          this.failPartialRun(docId, 'STUB_STREAK', i + 1 - streak, scenes.length, pages.length, streak + ' consecutive empty scenes');
          return;
        }
        plannedSoFar += baseWeight;
        linesSoFar += countVisualLines(header + '\n\n' + body) + 2;
        out.push(header + '\n\n' + body);
        prevTail = body.slice(-700);
        storySoFar = (storySoFar + '\n' + (i + 1) + '. ' + String(sc.brief || '').slice(0, 150)).slice(-2400);
        if (i % 3 === 0 || i === scenes.length - 1) { const pages = this.paginate(out.join('\n\n') + '\n\nFADE OUT.'); await saveRev(pages); setP({ done: i + 1, pageCount: pages.length }); }
        else setP({ done: i + 1 });
      }
      // Wholesale failure on the NEW scenes → don't file the extend as DONE (old draft stays active).
      if (this.mostlyStub(stubs, newCount)) { await this.failStubRun(docId, revId, stubs, newCount); return; }
      // Only the scenes THIS run wrote are checked — out[0] holds every pre-existing page as one blob,
      // and rewriting an earlier run's work is not this run's business.
      const contin = await this.verifyAndRepair(docId, out, scenes, exits, canonFacts, ctx, projectId, ar, startIdx, setP, ledger);
      const continNote = (exits.length || contin.found) ? summariseContinuity(contin.found, contin.repaired, contin.residue) : '';
      out.push('FADE OUT.');
      const pages = this.paginate(out.join('\n\n'));
      await saveRev(pages);
      if (ssc) {
        setP({ status: 'DONE', done: scenes.length, pageCount: pages.length, coverage: 'COMPLETE', scenesPerEp: ssc.scenesPerEp, seasonScenes: ssc.seasonScenes, coverageNote: 'Pilot episode: ' + scenes.length + ' scenes at ~' + featBrief.minutesPerEp + ' min/ep · full season ≈ ' + ssc.seasonScenes + ' scenes (' + ssc.episodes + ' ep × ' + ssc.scenesPerEp + ').' + (continNote ? ' · ' + continNote : '') });
      } else {
        // An extend writes every scene from where the draft stopped to the end of the plan, so a headless
        // result here is not 'still in progress' — it is a plan that reached the ending and writing
        // that did not. Same confirmation, same gate as a fresh run.
        let cov = await this.verifyEnding(spine, out.slice(-4).join('\n\n'), projectId);
        if (!cov.complete) {
          const wider = await this.verifyEnding(spine, out.slice(-8).join('\n\n'), projectId, 6000);
          if (wider.complete) this.log.warn('extendFeatureAsync: the ending check disagreed with itself — the 3k-tail read said incomplete, the 6k-tail read said complete. Taking the wider read.');
          cov = wider.complete ? wider : { complete: false, note: wider.note || cov.note };
        }
        const lp = lenPlan as FeatureLengthPlan;
        const tooShort = !!lenPlan && !isLengthComplete(pages.length, lp.targetPages);
        const tooLong = !!lenPlan && isLengthOver(pages.length, lp.targetPages);
        const pct = lenPlan ? Math.round(completionRatio(pages.length, lp.targetPages) * 100) : 100;
        const notes: string[] = [];
        if (cov.note) notes.push(cov.note);
        if (continNote) notes.push(continNote);
        if (lenPlan) {
          notes.push(pages.length + ' of ~' + lp.targetPages + ' pages (' + pct + '%) · ≈ '
            + Math.round(pages.length / lp.pagesPerMinute) + ' min · ' + scenes.length + ' scenes');
          if (tooShort) notes.push('Still short of feature length — extend again to keep building.');
          if (tooLong) notes.push('Longer than a feature — trim scenes, or raise the page target if this length is intended.');
        }
        // Not filed as DONE, so the extended revision is not swapped in and the shorter draft the user
        // already has stays active. The new pages are persisted on the revision, not discarded.
        if (!cov.complete) { this.failHeadlessDraft(docId, pages.length, scenes.length, notes.join(' · '), cov.note, 'Regenerate (extend)'); return; }
        setP({
          status: 'DONE', done: scenes.length, pageCount: pages.length,
          coverage: (!tooShort && !tooLong) ? 'COMPLETE' : tooLong ? 'LONG' : 'SHORT',
          coverageNote: notes.join(' · '),
          targetPages: lenPlan ? lp.targetPages : null,
          completionPct: pct,
        });
      }
    } catch (e: any) {
      const msg = String((e && e.message) || e).slice(0, 200);
      this.log.error('extendFeatureAsync: extend FAILED for script ' + docId + ' — ' + this.why(e), (e && e.stack) || undefined);
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
    // 45 was a short-film estimate. Size the progress bar from the build's real page budget so the
    // writer sees the true scene count from the first poll rather than a total that doubles mid-run.
    const promotePlan = planFeatureLength((bld && bld.brief) || {}, this.countBeats(stages));
    const estTotal = Math.max(existing.length, promotePlan.targetScenes);
    const verId = stage.buildId ? await this.activeVersionId(stage.buildId) : null;
    const promoteDefs = await this.scriptonDefs();
    const doc: any = await (this.prisma as any).scriptDocument.create({ data: { projectId: stage.projectId, title, kind: 'SCRIPT', createdById: userId || null, buildVersionId: verId } });
    const rev: any = await (this.prisma as any).scriptRevision.create({ data: { documentId: doc.id, revisionLabel: 'White Draft (developed)', pdfUrl: '', pageCount: 0, pageText: [{ page: 1, text: 'FADE IN:\n\nYour feature is being written, scene by scene...' }], revisionColor: 'WHITE', colorCode: promoteDefs.revisionColor || null, uploadedById: userId || null } });
    await (this.prisma as any).scriptDocument.update({ where: { id: doc.id }, data: { activeRevisionId: rev.id } }).catch(() => {});
    await (this.prisma as any).stageVersion.update({ where: { id: versionId }, data: { status: 'LOCKED' } }).catch(() => {});
    // Generating the Library script links the doc to the build — it does NOT "promote to production".
    // (Real promotion sets linkedProjectId/PROMOTED via promoteBuild; setting them here falsely showed the build attached to a project.)
    if (stage.buildId) await (this.prisma as any).developmentBuild.update({ where: { id: stage.buildId }, data: { linkedScriptId: doc.id, promotedVersionId: versionId } }).catch(() => {});
    this.genProgress.set(doc.id, { status: 'GENERATING', phase: 'PLANNING', lastActivityAt: Date.now(), note: 'Planning the scenes — this can take a few minutes on long scripts.', done: 0, total: estTotal, pageCount: 0 });
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
  /** Delegates to source-ingest.util. Kept as a method so ingestHtml and ingestUrl are untouched. */
  private htmlToText(html: string, max = 40000): { title: string; text: string } {
    return htmlToTextUtil(html, max);
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
      const res: any = await fetch(u, { redirect: 'error', signal: ctrl.signal, headers: { 'User-Agent': 'ScripON-Ingest/1.0', Accept: 'text/html,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document' } } as any);
      const ct = String(res.headers.get('content-type') || '');

      // NO COMPRESSED BODIES. Content-Length describes the WIRE bytes; undici decompresses after
      // that header is read, so the size cap below gates the wrong number entirely. Measured: a
      // response declaring 498 KB with Content-Encoding: gzip expanded to 500 MB and took RSS from
      // 61 MB to 1.6 GB — and the 8s abort bounds TIME, not memory, so a multi-GB allocation lands
      // before any byteLength check can run. undici only decompresses when this header says to (it
      // does not sniff magic bytes), so refusing the header closes the amplification for BOTH
      // branches below, including the textual one that predates this method's document support.
      const enc = String(res.headers.get('content-encoding') || '').trim().toLowerCase();
      if (enc && enc !== 'identity') throw new BadRequestException('That URL returned a compressed response, which cannot be read safely.');

      // TEXTUAL — unchanged, byte for byte. ingestHtml and the /ingest endpoint have always taken
      // this path and its 40000-char htmlToText default is calibrated for a web page. Nothing here
      // moves; the document branch below is purely additive.
      if (/text\/html|text\/plain|application\/xhtml/i.test(ct)) {
        const raw = await res.text();
        const r = this.htmlToText(raw.slice(0, 2500000));
        return { source: 'url', url: u, title: r.title, text: r.text, chars: r.text.length };
      }

      // DOCUMENTS. A link to a hosted PDF or Word file used to be refused as "not readable text",
      // which was true of the old code and false of the user's intention. Content-Type decides when
      // it is specific; the URL's own extension decides when the server says octet-stream — which is
      // how a .fdx arrives, since nothing serves Final Draft with a meaningful type.
      const byType = kindFromContentType(ct);
      const kind = byType !== 'unknown' ? byType : kindOf(parsed.pathname || '');
      if (kind !== 'pdf' && kind !== 'docx' && kind !== 'fdx') {
        throw new BadRequestException('That URL did not return readable text.');
      }
      // Cap on the DECLARED size first so an oversized file is refused before it is pulled into
      // memory, then on the real bytes because Content-Length is a claim, not a guarantee.
      const limitMb = Math.round(MAX_REMOTE_BYTES / (1024 * 1024));
      const declared = Number(res.headers.get('content-length') || 0);
      if (isFinite(declared) && declared > MAX_REMOTE_BYTES) throw new BadRequestException('That file is larger than ' + limitMb + ' MB.');
      const ab: ArrayBuffer = await res.arrayBuffer();
      if (ab.byteLength > MAX_REMOTE_BYTES) throw new BadRequestException('That file is larger than ' + limitMb + ' MB.');
      const ex = await extractText(Buffer.from(ab), String(parsed.pathname || 'source'), kind);
      if (!ex.chars) throw new BadRequestException('That URL returned a file that could not be read — ' + (ex.note || 'no readable text.'));
      return { source: 'url', url: u, title: '', text: ex.text, chars: ex.chars };
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
    const scenes: any[] = await (this.prisma as any).scriptScene.findMany({ where: { revisionId: r.revisionId }, orderBy: { sortOrder: 'asc' }, select: { sceneNumber: true, slugline: true, setName: true, intExt: true, dayNight: true, pages: true } }).catch(() => []);
    const intake: any = await (this.prisma as any).intakeProfile.findUnique({ where: { projectId: r.projectId } }).catch(() => null);
    const setCtx = intake ? ['era ' + (intake.settingEra || ''), 'culture ' + (intake.cultureEra || ''), 'tone ' + (intake.tone || '')].filter((x) => x.length > 6).join(' | ') : '';
    // A SET IS ONE LOCATION. Time of day is an attribute of it, never a second place: EXT. HARBOUR -
    // DAY and EXT. HARBOUR - NIGHT are one harbour an art director dresses once and lights twice, and
    // the board wants both times told about the one place. The line that used to be here stripped the
    // INT/EXT prefix and nothing else, so it sent that harbour in twice, spent two of its thirty slots
    // on it, and then truncated in script order - dropping the back of the film rather than the sets
    // it spends least time in. buildSetList collapses on the set, keeps I/E and TOD as attributes, and
    // setListBrief orders by pages and says out loud when the cap fired.
    const locs = setListBrief(buildSetList(scenes as any), { limit: 30 });
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
