import { Injectable } from '@nestjs/common';
import { AiService } from '../../../ai/ai.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { CanonFactCore } from './canon.types';
import { mapAiFactsToCore } from './canon-map.util';

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
