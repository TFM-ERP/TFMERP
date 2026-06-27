import { Injectable } from '@nestjs/common';
import { AiService } from '../../../ai/ai.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { CanonConflict, CanonFactCore } from './canon.types';
import { mapAiFactsToCore } from './canon-map.util';
import { assessPass } from './canon-assess.util';
import { orderChanges } from './change-order.util';
import { canonDirective } from './canon-inject.util';
import { detectConflicts, factsExcludingScenes } from './canon-verify.util';
import { stagedCandidates } from './render-extract.util';
import { pickRenderedScriptId } from './top-version.util';

@Injectable()
export class CanonService {
  constructor(private prisma: PrismaService, private ai: AiService) {}

  /**
   * Send scene prose to the LLM and return normalized CanonFactCore[].
   * Returns [] on any LLM/parse failure (fail-safe).
   */
  async extractFactsAI(
    _scriptId: string,
    scene: { id: string; order: number; text: string },
    projectId: string,
  ): Promise<CanonFactCore[]> {
    const system =
      'You extract canonical story facts. Return ONLY JSON {facts:[{kind,subject,predicate,object,statement}]}. ' +
      'kind ∈ CHARACTER|WORLD|LORE|TIMELINE|RELATIONSHIP|PLOT. subject = the entity; predicate = a short relation ' +
      '(status|location|alliance_with|knows|owns|relation_to); object = the value; statement = one sentence. ' +
      'Only durable world facts a later scene must not contradict. No opinions.';
    let raw: any[] = [];
    try {
      const res: any = (await this.ai.json({
        task: 'scripton.canon.extract',
        system,
        user: String(scene.text || '').slice(0, 6000),
        maxTokens: 1200,
        projectId,
        refType: 'Project',
        refId: projectId,
      })) || {};
      raw = res?.facts ?? [];
    } catch {
      raw = [];
    }
    return mapAiFactsToCore(raw, scene);
  }

  async renderPass(
    passId: string,
    projectId: string,
    userId?: string,
  ): Promise<{ versionId: string; continuityScore: number; conflicts: CanonConflict[] }> {
    const pass: any = await (this.prisma as any).revisionPass.findUnique({
      where: { id: passId },
      include: { changes: true },
    });
    if (!pass) throw new Error('RevisionPass not found');
    await (this.prisma as any).revisionPass.update({ where: { id: passId }, data: { status: 'RENDERING' } });

    // Order staged changes deterministically (scene order is carried in spec.sceneOrder).
    const staged = (pass.changes || []).filter((c: any) => c.status === 'STAGED');
    const ordered = orderChanges(
      staged.map((c: any) => ({ id: c.id, sceneOrder: Number(c?.spec?.sceneOrder ?? 0) })),
    );

    // The scenes this pass rewrites — their OLD facts must not be verified against the NEW ones (coherence rule).
    const changedSceneIds: string[] = [...new Set<string>(staged.map((c: any) => c.sceneId as string).filter((s: any): s is string => !!s))];

    // Verify: extract candidate facts from each change's resulting text.
    const allFacts: CanonFactCore[] = (
      await (this.prisma as any).canonFact.findMany({ where: { scriptId: pass.scriptId, status: 'ACTIVE' } }).catch(() => [])
    ).map((r: any) => r as CanonFactCore);

    // Canon written by a render = the curated facts already continuity-checked at
    // stage time (spec.facts), anchored to each change's own scene. We do NOT
    // AI-extract from a change's prose here: that would bypass the stage-time gate
    // and let unvetted, contradicting facts into canon. A prose-only change (no
    // staged facts) writes a new version but no canon — non-destructive by design.
    const allCandidates: CanonFactCore[] = [];
    for (const o of ordered) {
      const ch = staged.find((c: any) => c.id === o.id);
      if (!ch) continue;
      allCandidates.push(...stagedCandidates(ch));
    }

    // The render loop's decision core — the exact logic proven in canon-assess.util.spec.ts.
    const { conflicts, continuityScore: score } = assessPass(
      allFacts, allCandidates, changedSceneIds, ordered.length,
    );

    // Commit: new BuildVersion (shape per scripton.service.ts:588). A missing build is a hard error — never
    // mark RENDERED without producing a version (non-destructive contract: Render = a real new version).
    const build: any = await (this.prisma as any).developmentBuild.findFirst({
      where: { linkedScriptId: pass.scriptId },
    });
    if (!build) {
      await (this.prisma as any).revisionPass.update({ where: { id: passId }, data: { status: 'OPEN' } });
      throw new Error('No DevelopmentBuild linked to script ' + pass.scriptId + '; cannot render a version.');
    }
    const agg: any = await (this.prisma as any).buildVersion.aggregate({
      where: { buildId: build.id },
      _max: { n: true },
    });
    const maxN: number = agg?._max?.n ?? 0;
    const ver: any = await (this.prisma as any).buildVersion.create({
      data: {
        buildId: build.id,
        n: maxN + 1,
        label: 'V' + (maxN + 1),
        briefSnapshot: build.brief ?? undefined,
        status: 'DRAFT',
      },
    });
    const versionId = ver.id;

    // Supersede the changed scenes' prior facts, then persist the new ones.
    if (changedSceneIds.length) {
      await (this.prisma as any).canonFact.updateMany({
        where: { scriptId: pass.scriptId, sourceSceneId: { in: changedSceneIds }, status: 'ACTIVE' },
        data: { status: 'SUPERSEDED' },
      });
    }
    await this.persistFacts(pass.scriptId, allCandidates);
    await (this.prisma as any).decisionRecord.create({
      data: {
        scriptId: pass.scriptId,
        title: 'Render pass ' + passId.slice(0, 8),
        status: 'ACCEPTED',
        context: ordered.length + ' staged change(s) rendered into a new version.',
        decision: 'Applied: ' + ordered.map((o) => o.id.slice(0, 6)).join(', '),
        consequences:
          conflicts.length === 0
            ? 'No canon conflicts detected.'
            : 'Continuity conflicts: ' + conflicts.map((c) => c.reason).join(' | '),
        createdBy: userId ?? null,
      },
    });
    await (this.prisma as any).sceneChange.updateMany({
      where: { passId, status: 'STAGED' },
      data: { status: 'APPLIED' },
    });
    await (this.prisma as any).revisionPass.update({
      where: { id: passId },
      data: { status: 'RENDERED', continuityScore: score, renderedVersionId: versionId || null },
    });

    return { versionId, continuityScore: score, conflicts };
  }

  /** All canon facts for a script (read model for the Canon screen). Fail-safe → []. */
  async listFacts(scriptId: string): Promise<CanonFactCore[]> {
    if (!scriptId) return [];
    try {
      const rows: any[] = await (this.prisma as any).canonFact.findMany({
        where: { scriptId },
        orderBy: [{ subject: 'asc' }, { validFrom: 'asc' }, { recordedAt: 'asc' }],
      });
      return rows as CanonFactCore[];
    } catch {
      return [];
    }
  }

  /** The open (or rendering) RevisionPass for a script + its staged changes. Read model for Write. */
  async openPass(scriptId: string): Promise<any> {
    if (!scriptId) return null;
    try {
      return await (this.prisma as any).revisionPass.findFirst({
        where: { scriptId, status: { in: ['OPEN', 'RENDERING'] } },
        include: { changes: { orderBy: { createdAt: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      return null;
    }
  }

  /**
   * Stage a SceneChange into the open RevisionPass — NON-DESTRUCTIVE. The change's
   * candidate facts are continuity-checked against live canon (excluding this
   * scene's own facts) BEFORE it can join: a conflict blocks the stage and is
   * returned for the composer to surface. Creates the open pass if none exists.
   */
  async stageChange(body: any): Promise<{ staged?: any; conflict?: string; passId?: string }> {
    const scriptId = body?.scriptId;
    if (!scriptId || !body?.sceneId) return { conflict: 'Missing script or scene.' };
    const candidates: CanonFactCore[] = (Array.isArray(body.facts) ? body.facts : []).map((f: any) => ({ ...f, status: 'ACTIVE' }));
    // Continuity gate — never stage a change that contradicts established canon.
    if (candidates.length) {
      const all = await this.listFacts(scriptId);
      const established = factsExcludingScenes(all, [String(body.sceneId)]);
      const conflicts = detectConflicts(established, candidates);
      if (conflicts.length) return { conflict: conflicts[0].reason };
    }
    try {
      let pass: any = await (this.prisma as any).revisionPass.findFirst({
        where: { scriptId, status: { in: ['OPEN', 'RENDERING'] } }, orderBy: { createdAt: 'desc' },
      });
      if (!pass) pass = await (this.prisma as any).revisionPass.create({ data: { scriptId, baseVersionId: body.baseVersionId || 'V-base', status: 'OPEN', continuityScore: 1 } });
      const change = await (this.prisma as any).sceneChange.create({
        data: {
          passId: pass.id, sceneId: String(body.sceneId), kind: body.kind || 'revise', status: 'STAGED',
          // previewBefore/After carry the scene's prose delta for the Render→Compare diff
          // columns (display only — the render commit reads spec.facts for canon).
          previewBefore: body.before ?? null,
          previewAfter: body.after ?? null,
          spec: {
            sceneNumber: body.sceneNumber ?? null, label: body.label ?? '', tag: body.tag ?? '',
            summary: body.summary ?? null, before: body.before ?? null, after: body.after ?? null,
            sceneOrder: Number(body.sceneNumber) || 0, facts: candidates,
          },
        },
      });
      return { staged: change, passId: pass.id };
    } catch (e: any) {
      return { conflict: 'Could not stage — ' + (e?.message || 'kernel error') };
    }
  }

  /**
   * The Render→Compare read model — the single data source for the post-render
   * compare view, re-derived from a pass so it's refresh-safe (no in-memory state).
   * `canonWritten` comes from the applied changes' own `spec.facts` (what the commit
   * wrote) — NOT a re-query of CanonFact (rows carry no pass link), so it stays true
   * on refetch and matches the Canon screen by construction.
   */
  async renderResult(passId: string): Promise<any> {
    if (!passId) return null;
    let pass: any;
    try {
      pass = await (this.prisma as any).revisionPass.findUnique({
        where: { id: passId },
        include: { changes: { orderBy: { createdAt: 'asc' } } },
      });
    } catch {
      return null;
    }
    if (!pass) return null;
    const all = pass.changes || [];
    const applied = all.filter((c: any) => c.status === 'APPLIED');
    const changes = applied.length ? applied : all; // pre-render preview falls back to staged
    const build: any = await (this.prisma as any).developmentBuild
      .findFirst({ where: { linkedScriptId: pass.scriptId } })
      .catch(() => null);
    let version: any = null;
    let prevVersion: any = null;
    if (pass.renderedVersionId) {
      version = await (this.prisma as any).buildVersion
        .findUnique({ where: { id: pass.renderedVersionId }, select: { id: true, n: true, label: true } })
        .catch(() => null);
      if (version && build) {
        prevVersion = await (this.prisma as any).buildVersion
          .findFirst({ where: { buildId: build.id, n: version.n - 1 }, select: { id: true, n: true, label: true } })
          .catch(() => null);
      }
    }
    const lbl = (v: any) => (v ? { id: v.id, n: v.n, label: v.label || 'V' + v.n } : null);
    const appliedChanges = changes.map((c: any) => ({
      sceneId: c.sceneId,
      sceneNumber: c?.spec?.sceneNumber ?? null,
      label: c?.spec?.label ?? '',
      tag: c?.spec?.tag ?? '',
      kind: c.kind,
      before: c.previewBefore ?? c?.spec?.before ?? '',
      after: c.previewAfter ?? c?.spec?.after ?? '',
    }));
    const canonWritten = changes
      .flatMap((c: any) => (Array.isArray(c?.spec?.facts) ? c.spec.facts : []))
      .map((f: any) => ({
        kind: f.kind, subject: f.subject, predicate: f.predicate, object: f.object,
        statement: f.statement || '', validFrom: f.validFrom ?? null,
      }));
    // This pass's own decision (renderPass titles it 'Render pass <passId[:8]>'), not
    // merely the latest for the script — so a re-rendered script shows the right one.
    const decision = await (this.prisma as any).decisionRecord
      .findFirst({ where: { scriptId: pass.scriptId, title: { contains: passId.slice(0, 8) } }, orderBy: { createdAt: 'desc' }, select: { title: true, status: true, context: true } })
      .catch(() => null);
    return {
      passId, status: pass.status, scriptId: pass.scriptId, buildId: build?.id ?? null,
      version: lbl(version), prevVersion: lbl(prevVersion),
      continuity: typeof pass.continuityScore === 'number' ? Math.round(pass.continuityScore * 100) : null,
      changeCount: appliedChanges.length,
      applied: appliedChanges, canonWritten, decision,
    };
  }

  /**
   * The Versions screen read model (cold view of the Versions workspace): the real
   * BuildVersion timeline (each linked to the RevisionPass that rendered it, for
   * scenes-changed + the per-node diff deep-link), the open/pending pass (the dashed
   * "Rendering…" node), and the append-only DecisionRecord log. Latest `limit` of each.
   */
  async versionsView(scriptId: string, limit = 12): Promise<any> {
    if (!scriptId) return { versions: [], pending: null, decisions: [] };
    const build: any = await (this.prisma as any).developmentBuild
      .findFirst({ where: { linkedScriptId: scriptId } })
      .catch(() => null);
    let versions: any[] = [];
    if (build) {
      const all: any[] = await (this.prisma as any).buildVersion
        .findMany({ where: { buildId: build.id, NOT: { status: 'DISCARDED' } }, orderBy: { n: 'asc' }, select: { id: true, n: true, label: true, createdAt: true } })
        .catch(() => []);
      const recent = all.slice(-limit);
      const ids = recent.map((v) => v.id);
      // Batch the version→pass lookup (no N+1): one query for all backing passes.
      const passes: any[] = ids.length
        ? await (this.prisma as any).revisionPass
            .findMany({ where: { scriptId, renderedVersionId: { in: ids } }, select: { id: true, renderedVersionId: true, continuityScore: true, changes: { select: { status: true } } } })
            .catch(() => [])
        : [];
      const byVer = new Map(passes.map((pp) => [pp.renderedVersionId, pp]));
      versions = recent.map((v) => {
        const pp: any = byVer.get(v.id);
        return {
          id: v.id, n: v.n, label: v.label || 'V' + v.n, active: build.activeVersionId === v.id,
          date: v.createdAt, passId: pp?.id ?? null,
          changeCount: pp ? (pp.changes || []).filter((c: any) => c.status === 'APPLIED').length : 0,
          continuity: pp && typeof pp.continuityScore === 'number' ? Math.round(pp.continuityScore * 100) : null,
        };
      });
    }
    const open: any = await (this.prisma as any).revisionPass
      .findFirst({ where: { scriptId, status: { in: ['OPEN', 'RENDERING'] } }, orderBy: { createdAt: 'desc' }, include: { changes: true } })
      .catch(() => null);
    const pending = open
      ? { passId: open.id, changeCount: (open.changes || []).filter((c: any) => c.status === 'STAGED').length, rendering: open.status === 'RENDERING' }
      : null;
    const decisions: any[] = await (this.prisma as any).decisionRecord
      .findMany({ where: { scriptId }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, title: true, status: true, context: true, decision: true, consequences: true, supersedesId: true, createdAt: true } })
      .catch(() => []);
    return { versions, pending, decisions };
  }

  /**
   * The shared top bar's continuity ring + active version for a workspace. Resolves the SAME source
   * Develop uses — a build's linked kernel script — but selects it by "has a RENDERED pass" (not by
   * title/order: a ScriptON draft doc has no link to its rendered build, and one screenplay can have
   * several builds). So every script-scoped screen shows the identical %·V, and hides uniformly when
   * nothing has rendered. An explicit `scriptId` that itself has renders wins (e.g. Compare's result).
   * Returns the rendered script's active version: { scriptId, continuity (0–100|null), versionLabel, versions }.
   */
  async workspaceTopVersion(projectId: string, scriptId?: string): Promise<any> {
    const empty = { scriptId: null, continuity: null, versionLabel: null, versions: [] as any[] };
    const fromView = (sid: string, vv: any) => {
      const vs: any[] = vv?.versions || [];
      if (!vs.length) return null;
      const av = vs.find((v) => v.active) || vs[vs.length - 1];
      return {
        scriptId: sid,
        continuity: av && typeof av.continuity === 'number' ? av.continuity : null,
        versionLabel: av?.label || (av ? 'V' + av.n : null),
        versions: vs,
      };
    };
    // 1) If a concrete scriptId was supplied and it actually has rendered versions, prefer it.
    if (scriptId) {
      const hit = fromView(scriptId, await this.versionsView(scriptId).catch(() => null));
      if (hit && hit.continuity !== null) return hit;
    }
    // 2) Otherwise resolve the workspace's rendered build chain, selected by render — not title.
    if (!projectId) return empty;
    const builds: any[] = await (this.prisma as any).developmentBuild
      .findMany({
        where: { OR: [{ projectId }, { linkedProjectId: projectId }], linkedScriptId: { not: null } },
        select: { linkedScriptId: true },
      })
      .catch(() => []);
    const linkedScriptIds = [...new Set(builds.map((b) => b.linkedScriptId).filter(Boolean))];
    if (!linkedScriptIds.length) return empty;
    const passes: any[] = await (this.prisma as any).revisionPass
      .findMany({
        where: { scriptId: { in: linkedScriptIds }, status: 'RENDERED', continuityScore: { not: null } },
        select: { scriptId: true, createdAt: true },
      })
      .catch(() => []);
    const sid = pickRenderedScriptId(linkedScriptIds, passes);
    if (!sid) return empty;
    return fromView(sid, await this.versionsView(sid).catch(() => null)) || empty;
  }

  /** Live ACTIVE canon for a script, as a CANON steering block at a story point. '' on error/empty. */
  async directiveFor(scriptId: string, at: number, subjects?: string[]): Promise<string> {
    try {
      const rows: any[] = await (this.prisma as any).canonFact.findMany({
        where: { scriptId, status: 'ACTIVE' },
      });
      return canonDirective(rows as CanonFactCore[], { at, subjects });
    } catch {
      return '';
    }
  }

  /**
   * Persist CanonFactCore[] to the database. Each create is individually
   * catch-silenced so a constraint violation on one row does not abort the rest.
   */
  async persistFacts(scriptId: string, facts: CanonFactCore[]): Promise<void> {
    if (!facts?.length) return;
    const base = await (this.prisma as any).canonFact
      .count({ where: { scriptId } })
      .catch(() => 0);
    let i = 0;
    for (const fct of facts) {
      await (this.prisma as any).canonFact
        .create({
          data: {
            scriptId,
            kind: fct.kind,
            subject: fct.subject,
            predicate: fct.predicate,
            object: fct.object,
            statement: fct.statement,
            validFrom: fct.validFrom,
            validTo: fct.validTo ?? null,
            recordedAt: base + i++,
            status: 'ACTIVE',
            sourceSceneId: fct.sourceSceneId ?? null,
          },
        })
        .catch(() => {});
    }
  }
}
