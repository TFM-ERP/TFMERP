import { Injectable } from '@nestjs/common';
import { AiService } from '../../../ai/ai.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { CanonConflict, CanonFactCore } from './canon.types';
import { mapAiFactsToCore } from './canon-map.util';
import { assessPass } from './canon-assess.util';
import { orderChanges } from './change-order.util';
import { canonDirective } from './canon-inject.util';

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

    const allCandidates: CanonFactCore[] = [];
    for (const o of ordered) {
      const ch = staged.find((c: any) => c.id === o.id);
      const text = String(ch?.previewAfter ?? ch?.spec?.body ?? ch?.spec?.note ?? '');
      if (!text) continue;
      const facts = await this.extractFactsAI(
        pass.scriptId,
        { id: ch.sceneId, order: Number(ch?.spec?.sceneOrder ?? 0), text },
        projectId,
      );
      allCandidates.push(...facts);
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
