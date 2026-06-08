import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * DynamicContextService — RAG context builder for AI prompts.
 *
 * Compiles, per project: the jurisdiction tax rules (VAT rate + recovery rules,
 * resolved from the project's mandatory productionCountry with fallback up the
 * GeoNode tree) and the active enterprise CoA mappings (CoaMappingTable), and
 * serialises them into ONE minified JSON string for injection into Anthropic
 * system prompts (script breakdown, OCR invoice intake, Movie Magic import).
 *
 * Grounding the model in the real account codes stops it hallucinating codes
 * during imports. This service is strictly READ-ONLY — it never mutates data,
 * and its output is advisory context only (house rule: AI never writes live
 * numbers; everything it suggests stays approval-gated).
 */
@Injectable()
export class DynamicContextService {
  constructor(private prisma: PrismaService) {}

  /**
   * Build the minified JSON context string for a project.
   * Keys are deliberately short and stable to minimise prompt tokens.
   */
  async buildProjectContext(projectId: string): Promise<string> {
    const project = await this.prisma.productionProject.findUnique({
      where: { id: projectId },
      select: {
        id: true, projectNumber: true, title: true, projectType: true, currency: true,
        productionCountryId: true,
        productionCountry: { select: { id: true, name: true, code: true, level: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (!project.productionCountry) {
      throw new BadRequestException('Project has no productionCountry assigned — set it before building AI context.');
    }

    // ── 1. Jurisdiction tax rules: project geo node + ancestors (city → emirate → country) ──
    const geoIds = await this.geoAncestry(project.productionCountryId);
    const today = new Date();
    const taxRules = await this.prisma.jurisdictionTaxRule.findMany({
      where: {
        geoNodeId: { in: geoIds },
        isActive: true,
        OR: [{ effectiveDate: null }, { effectiveDate: { lte: today } }],
        AND: [{ OR: [{ expiryDate: null }, { expiryDate: { gte: today } }] }],
      },
      orderBy: [{ taxKind: 'asc' }, { effectiveDate: 'desc' }],
    });

    // ── 2. Active enterprise CoA mappings ──────────────────────────────────────────
    const mappings = await this.prisma.coaMappingTable.findMany({
      where: { isActive: true },
      orderBy: [{ sourceSystem: 'asc' }, { externalCode: 'asc' }],
    });

    // Distinct master accounts — the enterprise CoA surface the AI must target.
    const masterByCode = new Map<string, string | null>();
    for (const m of mappings) if (!masterByCode.has(m.masterCode)) masterByCode.set(m.masterCode, m.masterTitle);

    const ctx = {
      v: 1,
      gen: new Date().toISOString(),
      project: {
        id: project.id,
        no: project.projectNumber,
        title: project.title,
        type: project.projectType,
        cur: project.currency,
      },
      jurisdiction: {
        country: {
          id: project.productionCountry.id,
          name: project.productionCountry.name,
          code: project.productionCountry.code || null,
        },
        tax: taxRules.map((r) => ({
          kind: r.taxKind,
          name: r.name,
          ratePct: Number(r.ratePct),
          recoverable: r.recoverable,
          recoveryPct: r.recoveryPct != null ? Number(r.recoveryPct) : (r.recoverable ? 100 : 0),
          rules: r.rules ?? null,
          src: r.sourceUrl || null,
        })),
      },
      coa: {
        // every external→master mapping the importer may encounter
        map: mappings.map((m) => ({ src: m.sourceSystem, ext: m.externalCode, code: m.masterCode })),
        // the allowed target account codes — the AI must ONLY use codes from this list
        accounts: [...masterByCode.entries()].map(([code, title]) => ({ code, title })),
      },
    };

    return JSON.stringify(ctx); // minified — no whitespace
  }

  /**
   * Convenience wrapper: the context string framed as a system-prompt block,
   * ready to append to an existing Anthropic system prompt.
   */
  async systemPromptBlock(projectId: string): Promise<string> {
    const json = await this.buildProjectContext(projectId);
    return [
      'REAL-TIME PRODUCTION CONTEXT (authoritative — overrides your prior assumptions):',
      json,
      'Rules: use ONLY account codes listed in coa.accounts. Map external codes via coa.map.',
      'Apply jurisdiction.tax for any VAT/recovery computation. If a code or rate is not in this context, say so — do NOT invent one.',
    ].join('\n');
  }

  /** Walk the GeoNode tree upwards (max 6 levels) — city → state → country. */
  private async geoAncestry(geoNodeId: string): Promise<string[]> {
    const ids: string[] = [];
    let cur: string | null = geoNodeId;
    for (let i = 0; cur && i < 6; i++) {
      ids.push(cur);
      const node: { parentId: string | null } | null = await this.prisma.geoNode.findUnique({
        where: { id: cur },
        select: { parentId: true },
      });
      cur = node?.parentId ?? null;
    }
    return ids;
  }
}
