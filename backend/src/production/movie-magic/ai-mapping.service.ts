import { Injectable, BadRequestException } from '@nestjs/common';
import { DynamicContextService } from '../context/dynamic-context.service';

/** One unmapped line as it comes off a Movie Magic import. */
export interface UnmappedLine {
  originalLineId: string; // caller-side id (import row id / BudgetLineItem id)
  externalCode?: string | null; // MM account code, if any
  description: string;
  amount?: number | null;
  category?: string | null; // MM category/section label, if any
}

/** The exact shape the AI must return for every line. */
export interface LineMappingSuggestion {
  originalLineId: string;
  suggestedMasterCode: string;
  confidenceScore: number; // 0..1
  reasoning: string;
  vatTreatment: string; // STANDARD_RECOVERABLE | STANDARD_NON_RECOVERABLE | ZERO_RATED | EXEMPT | OUT_OF_SCOPE | REVERSE_CHARGE
}

const VAT_TREATMENTS = ['STANDARD_RECOVERABLE', 'STANDARD_NON_RECOVERABLE', 'ZERO_RATED', 'EXEMPT', 'OUT_OF_SCOPE', 'REVERSE_CHARGE'];
const BATCH_SIZE = 50; // lines per Anthropic call — keeps outputs inside max_tokens
const MAX_LINES = 500; // hard cap per request

// Forced tool — Claude MUST answer through this schema, which guarantees parseable JSON.
const MAPPING_TOOL = {
  name: 'submit_line_mappings',
  description: 'Submit the account-code mapping for every imported budget line.',
  input_schema: {
    type: 'object',
    properties: {
      mappings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            originalLineId: { type: 'string' },
            suggestedMasterCode: { type: 'string', description: 'MUST be a code from coa.accounts in the context JSON' },
            confidenceScore: { type: 'number', description: '0..1' },
            reasoning: { type: 'string', description: 'One short sentence' },
            vatTreatment: { type: 'string', enum: VAT_TREATMENTS },
          },
          required: ['originalLineId', 'suggestedMasterCode', 'confidenceScore', 'reasoning', 'vatTreatment'],
        },
      },
    },
    required: ['mappings'],
  },
};

/**
 * AI-assisted CoA mapping for Movie Magic imports.
 *
 * SUGGESTIONS ONLY — this service never writes mappings, budget lines, or
 * transactions. The caller surfaces the suggestions for human review and only
 * an explicit user action persists anything (house rule: nothing auto-applies).
 */
@Injectable()
export class AiMappingService {
  constructor(private dynamicContext: DynamicContextService) {}

  private aiConfigured(): boolean { return !!process.env.ANTHROPIC_API_KEY; }
  private model(): string { return process.env.MM_AI_MODEL || process.env.LABOR_AI_MODEL || 'claude-sonnet-4-6'; }

  /**
   * Map unmapped imported budget lines onto the enterprise Master CoA, grounded
   * in the project's DynamicContext (jurisdiction VAT rules + CoaMappingTable).
   */
  async aiMapBudgetLines(projectId: string, lines: UnmappedLine[]) {
    if (!this.aiConfigured()) throw new BadRequestException('AI assistant not configured. Set ANTHROPIC_API_KEY in the backend .env.');
    if (!Array.isArray(lines) || !lines.length) throw new BadRequestException('Provide a non-empty array of unmapped lines.');
    if (lines.length > MAX_LINES) throw new BadRequestException(`Too many lines (${lines.length}). Send at most ${MAX_LINES} per request.`);
    for (const l of lines) {
      if (!l?.originalLineId || !l?.description) throw new BadRequestException('Every line needs originalLineId and description.');
    }

    // 1. Real-time context: jurisdiction tax rules + enterprise CoA (minified JSON)
    const contextJson = await this.dynamicContext.buildProjectContext(projectId);

    // Allowed codes — used to hard-validate whatever the model returns
    const allowedCodes = this.extractAllowedCodes(contextJson);
    if (!allowedCodes.size) {
      throw new BadRequestException('No active CoA mappings found (CoaMappingTable is empty) — seed the enterprise CoA mapping first.');
    }

    // 2 + 3. System prompt: persona + injected context + hard constraints
    const system = [
      'You are an expert film/TV production accountant doing chart-of-accounts mapping for an ERP import.',
      'REAL-TIME PRODUCTION CONTEXT (authoritative — overrides any prior assumption):',
      contextJson,
      'RULES:',
      '- Map EVERY input line to exactly one account code, chosen ONLY from coa.accounts in the context above. Codes not in that list are forbidden.',
      '- Use coa.map (external→master) as the primary signal when the line has an externalCode; otherwise classify from the description/category.',
      '- Apply jurisdiction.tax to decide vatTreatment: one of ' + VAT_TREATMENTS.join(' | ') + '.',
      '- confidenceScore is 0..1. Use ≤0.5 when you are guessing; never inflate.',
      '- reasoning: one short sentence per line.',
      '- Respond ONLY by calling the submit_line_mappings tool. No prose.',
    ].join('\n');

    // 4. Batched, forced-tool calls
    const suggestions: LineMappingSuggestion[] = [];
    const rejected: { originalLineId: string; problem: string }[] = [];
    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
      const batch = lines.slice(i, i + BATCH_SIZE);
      const raw = await this.callAnthropicTool(system, JSON.stringify({ lines: batch }));
      const ids = new Set(batch.map((l) => l.originalLineId));
      for (const m of raw) {
        const v = this.validate(m, ids, allowedCodes);
        if (v.ok) suggestions.push(v.value!);
        else rejected.push({ originalLineId: String(m?.originalLineId ?? '?'), problem: v.problem! });
      }
      // any batch line the model skipped
      for (const l of batch) {
        if (!suggestions.some((s) => s.originalLineId === l.originalLineId) && !rejected.some((r) => r.originalLineId === l.originalLineId)) {
          rejected.push({ originalLineId: l.originalLineId, problem: 'No mapping returned by the model.' });
        }
      }
    }

    return {
      projectId,
      model: this.model(),
      requested: lines.length,
      mapped: suggestions.length,
      rejectedCount: rejected.length,
      suggestions,
      rejected,
      note: 'Suggestions only — nothing has been written. Review and apply explicitly.',
    };
  }

  // ── Anthropic call with forced tool use ──────────────────────────────────────────
  private async callAnthropicTool(system: string, user: string): Promise<any[]> {
    const key = process.env.ANTHROPIC_API_KEY!;
    let res: any;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' } as any,
        body: JSON.stringify({
          model: this.model(),
          max_tokens: 8000,
          system,
          tools: [MAPPING_TOOL],
          tool_choice: { type: 'tool', name: 'submit_line_mappings' }, // forces strict, schema-shaped JSON
          messages: [{ role: 'user', content: user }],
        }),
      });
    } catch (e: any) {
      throw new BadRequestException(`Anthropic API unreachable: ${e?.message || 'network error'}`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new BadRequestException(`Anthropic API error HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    const data: any = await res.json().catch(() => null);
    const toolUse = (data?.content || []).find((b: any) => b?.type === 'tool_use' && b?.name === 'submit_line_mappings');
    if (toolUse?.input?.mappings && Array.isArray(toolUse.input.mappings)) return toolUse.input.mappings;

    // Fallback: model answered with text — try to salvage a JSON array safely
    const text = (data?.content || []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('\n');
    return this.safeParseArray(text);
  }

  /** Tolerant array extraction: fenced block → first [...] span → []. Never throws. */
  private safeParseArray(text: string): any[] {
    if (!text) return [];
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidates = [fence?.[1], text, text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)];
    for (const c of candidates) {
      if (!c) continue;
      try {
        const parsed = JSON.parse(c.trim());
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed?.mappings)) return parsed.mappings;
      } catch { /* try next candidate */ }
    }
    return [];
  }

  // ── Validation of model output ───────────────────────────────────────────────────
  private validate(m: any, batchIds: Set<string>, allowedCodes: Set<string>): { ok: boolean; value?: LineMappingSuggestion; problem?: string } {
    if (!m || typeof m !== 'object') return { ok: false, problem: 'Not an object.' };
    if (!batchIds.has(String(m.originalLineId))) return { ok: false, problem: 'Unknown originalLineId (not in this batch).' };
    const code = String(m.suggestedMasterCode ?? '').trim();
    if (!allowedCodes.has(code)) return { ok: false, problem: `Code "${code}" is not in the enterprise CoA — hallucination blocked.` };
    const conf = Number(m.confidenceScore);
    const vat = String(m.vatTreatment ?? '').toUpperCase();
    return {
      ok: true,
      value: {
        originalLineId: String(m.originalLineId),
        suggestedMasterCode: code,
        confidenceScore: isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0,
        reasoning: String(m.reasoning ?? '').slice(0, 400),
        vatTreatment: VAT_TREATMENTS.includes(vat) ? vat : 'STANDARD_RECOVERABLE',
      },
    };
  }

  private extractAllowedCodes(contextJson: string): Set<string> {
    try {
      const ctx = JSON.parse(contextJson);
      return new Set<string>((ctx?.coa?.accounts || []).map((a: any) => String(a.code)));
    } catch { return new Set(); }
  }
}
