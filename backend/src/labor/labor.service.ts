import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  resolveRules,
  computeLineFringes,
  AgreementLike,
  ResolveContext,
  RuleLike,
} from './fringe-engine';

@Injectable()
export class LaborService {
  constructor(private prisma: PrismaService) {}

  // ════════════════════════════════════════════════════════════════════════════
  // A. MASTER DATA CRUD
  // ════════════════════════════════════════════════════════════════════════════

  // ── Geography ───────────────────────────────────────────────────────────────
  async geoTree() {
    const nodes = await this.prisma.geoNode.findMany({ orderBy: [{ level: 'asc' }, { name: 'asc' }] });
    const byParent: Record<string, any[]> = {};
    for (const n of nodes) {
      const k = n.parentId || '__root__';
      (byParent[k] = byParent[k] || []).push({ ...n, children: [] });
    }
    const attach = (list: any[]) => {
      for (const node of list) {
        node.children = byParent[node.id] || [];
        attach(node.children);
      }
    };
    const roots = byParent['__root__'] || [];
    attach(roots);
    return roots;
  }
  geoList() {
    return this.prisma.geoNode.findMany({ orderBy: [{ level: 'asc' }, { name: 'asc' }] });
  }
  createGeo(data: any) {
    return this.prisma.geoNode.create({
      data: { level: data.level, name: data.name, code: data.code || null, parentId: data.parentId || null },
    });
  }
  updateGeo(id: string, data: any) {
    const { id: _i, children, parent, createdAt, ...rest } = data || {};
    return this.prisma.geoNode.update({ where: { id }, data: rest });
  }
  removeGeo(id: string) { return this.prisma.geoNode.delete({ where: { id } }); }

  /** Walk parents up to the country to build an ancestor chain. */
  async geoAncestors(geoNodeId?: string | null): Promise<string[]> {
    const chain: string[] = [];
    let current = geoNodeId || null;
    let guard = 0;
    while (current && guard++ < 12) {
      chain.push(current);
      const node = await this.prisma.geoNode.findUnique({ where: { id: current }, select: { parentId: true } });
      current = node?.parentId || null;
    }
    return chain;
  }

  // ── Labor bodies ──────────────────────────────────────────────────────────────
  laborBodies(query: { kind?: string; countryId?: string } = {}) {
    const where: any = {};
    if (query.kind) where.kind = query.kind;
    if (query.countryId) where.countryId = query.countryId;
    return this.prisma.laborBody.findMany({
      where,
      include: { country: { select: { name: true, code: true } }, _count: { select: { agreements: true } } },
      orderBy: { name: 'asc' },
    });
  }
  createLaborBody(data: any) {
    return this.prisma.laborBody.create({
      data: {
        kind: data.kind, name: data.name, shortName: data.shortName || null,
        countryId: data.countryId || null, website: data.website || null,
        notes: data.notes || null, isActive: data.isActive ?? true,
      },
    });
  }
  updateLaborBody(id: string, data: any) {
    const { id: _i, country, agreements, sources, _count, createdAt, updatedAt, ...rest } = data || {};
    return this.prisma.laborBody.update({ where: { id }, data: rest });
  }
  removeLaborBody(id: string) { return this.prisma.laborBody.delete({ where: { id } }); }

  // ── Agreements ────────────────────────────────────────────────────────────────
  agreements(laborBodyId?: string) {
    const where: any = {};
    if (laborBodyId) where.laborBodyId = laborBodyId;
    return this.prisma.agreement.findMany({
      where,
      include: {
        laborBody: { select: { name: true, kind: true } },
        source: true,
        _count: { select: { rateRules: true, classifications: true } },
      },
      orderBy: { effectiveDate: 'desc' },
    });
  }
  agreement(id: string) {
    return this.prisma.agreement.findUnique({
      where: { id },
      include: {
        laborBody: true,
        source: true,
        classifications: { orderBy: { code: 'asc' } },
        rateRules: { include: { source: true, classification: true }, orderBy: [{ rateType: 'asc' }] },
      },
    });
  }
  createAgreement(data: any) {
    return this.prisma.agreement.create({
      data: {
        laborBodyId: data.laborBodyId,
        name: data.name,
        productionTypes: data.productionTypes || [],
        tier: data.tier || null,
        effectiveDate: new Date(data.effectiveDate),
        expirationDate: data.expirationDate ? new Date(data.expirationDate) : null,
        status: data.status || 'ACTIVE',
        sourceId: data.sourceId || null,
        notes: data.notes || null,
      },
    });
  }
  updateAgreement(id: string, data: any) {
    const { id: _i, laborBody, source, classifications, rateRules, _count, createdAt, updatedAt, ...rest } = data || {};
    if (rest.effectiveDate) rest.effectiveDate = new Date(rest.effectiveDate);
    if (rest.expirationDate) rest.expirationDate = new Date(rest.expirationDate);
    return this.prisma.agreement.update({ where: { id }, data: rest });
  }
  removeAgreement(id: string) { return this.prisma.agreement.delete({ where: { id } }); }

  // ── Classifications ─────────────────────────────────────────────────────────────
  createClassification(data: any) {
    return this.prisma.classification.create({
      data: { agreementId: data.agreementId, code: data.code, title: data.title, riskClass: data.riskClass || null },
    });
  }
  updateClassification(id: string, data: any) {
    const { id: _i, agreement, rateRules, createdAt, ...rest } = data || {};
    return this.prisma.classification.update({ where: { id }, data: rest });
  }
  removeClassification(id: string) { return this.prisma.classification.delete({ where: { id } }); }

  // ── Rate rules (versioned) ──────────────────────────────────────────────────────
  rateRules(agreementId: string) {
    return this.prisma.rateRule.findMany({
      where: { agreementId },
      include: { source: true, classification: true },
      orderBy: [{ rateType: 'asc' }, { effectiveDate: 'desc' }],
    });
  }
  createRateRule(data: any) {
    return this.prisma.rateRule.create({ data: this.rateRuleData(data) });
  }
  /**
   * Updating a rate creates a NEW version (previousId chain), supersedes the old.
   * Historical/project snapshots are untouched — they keep their frozen copy.
   */
  async updateRateRule(id: string, data: any, userId?: string) {
    const existing = await this.prisma.rateRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    // expire the old version the day before the new one's effective date
    const newEff = data.effectiveDate ? new Date(data.effectiveDate) : new Date();
    await this.prisma.rateRule.update({
      where: { id },
      data: { expirationDate: existing.expirationDate ?? new Date(newEff.getTime() - 86400000) },
    });
    return this.prisma.rateRule.create({
      data: {
        ...this.rateRuleData({ ...existing, ...data }),
        previousId: id,
        approvedById: userId || data.approvedById || null,
        approvedAt: new Date(),
      },
    });
  }
  removeRateRule(id: string) { return this.prisma.rateRule.delete({ where: { id } }); }

  private rateRuleData(d: any) {
    return {
      agreementId: d.agreementId,
      classificationId: d.classificationId || null,
      label: d.label,
      rateType: d.rateType,
      calcMethod: d.calcMethod,
      value: d.value,
      base: d.base || null,
      capPeriod: d.capPeriod || null,
      capAmount: d.capAmount ?? null,
      floorAmount: d.floorAmount ?? null,
      tiers: d.tiers ?? null,
      currency: d.currency || 'USD',
      glAccountCode: d.glAccountCode || null,
      sourceId: d.sourceId || null,
      effectiveDate: d.effectiveDate ? new Date(d.effectiveDate) : new Date(),
      expirationDate: d.expirationDate ? new Date(d.expirationDate) : null,
      isEstimate: d.isEstimate ?? false,
      notes: d.notes || null,
    };
  }

  // ── Refresh engine (Tier 2) — allow-listed fetch → review proposals ───────────────
  // Fetches ONLY official/approved source domains, detects content changes, and files
  // a PENDING review proposal asking a human to confirm rates. It NEVER extracts or
  // guesses figures — unparseable/changed sources are flagged for manual entry.

  private static SOURCE_ALLOWLIST = [
    'sagaftra.org', 'sagaftraplans.org', 'dga.org', 'dgaplans.org', 'wga.org', 'wgaplans.org',
    'wgacontract.org', 'producersguild.org', 'phbp.org',
    'iatse.net', 'mpiphp.org', 'ht399.org', 'actra.ca', 'actratoronto.com',
    'actraottawa.ca', 'dgc.ca', 'equity.org.uk', 'bectu.org.uk', 'directors.uk.com',
    'gov.uk', 'canada.ca', 'ssa.gov', 'irs.gov', 'u.ae', 'mohre.gov.ae',
    'film.gov.ae', 'cma.gov.ae', 'mediaoffice.abudhabi', 'creativemedia.gov.ae',
    // KSA / Qatar / Jordan film commissions & tax authorities (official only)
    'film.sa', 'moc.gov.sa', 'experiencealula.com', 'zatca.gov.sa',
    'dohafilm.com', 'mediacity.qa', 'gta.gov.qa', 'film.jo',
  ];
  private hostAllowed(url?: string | null): boolean {
    if (!url) return false;
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return LaborService.SOURCE_ALLOWLIST.some((d) => host === d || host.endsWith('.' + d));
    } catch { return false; }
  }
  private async hashText(s: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(s).digest('hex').slice(0, 32);
  }

  /**
   * Refresh approved sources for the given labor bodies (or all if empty).
   * Returns a per-source result; files/updates a PENDING REFRESH proposal where a
   * source is unreachable or its content changed since the last check.
   */
  async refreshRates(laborBodyIds: string[] = []) {
    const where: any = { trusted: true, url: { not: null } };
    if (laborBodyIds.length) where.laborBodyId = { in: laborBodyIds };
    const sources = await this.prisma.rateSource.findMany({ where, include: { laborBody: { select: { name: true } } } });

    const results: any[] = [];
    for (const src of sources) {
      let status = 'OK';
      let changed = false;
      let hash: string | null = null;
      let note = '';

      if (!this.hostAllowed(src.url)) {
        status = 'NOT_ALLOWLISTED';
        note = 'Source URL is not on the approved official-source allow-list. Skipped — add it to the allow-list or enter rates manually.';
      } else {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 15000);
          const res = await fetch(src.url!, { signal: controller.signal, headers: { 'User-Agent': 'TFM-Labor-Refresh/1.0' } } as any);
          clearTimeout(timer);
          if (!res.ok) {
            status = 'ERROR';
            note = `Source returned HTTP ${res.status}. Review the source manually.`;
          } else {
            const text = (await res.text()).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            hash = await this.hashText(text);
            changed = !!src.lastHash && src.lastHash !== hash;
            note = src.lastHash
              ? (changed ? 'Source content CHANGED since last check — review for rate updates and propose changes.' : 'Source unchanged since last check.')
              : 'Baseline captured. Future refreshes will flag changes.';
          }
        } catch (e: any) {
          status = e?.name === 'AbortError' ? 'ERROR' : 'BLOCKED';
          note = 'Could not fetch the source (network/blocked). Review the source manually.';
        }
      }

      await this.prisma.rateSource.update({
        where: { id: src.id },
        data: { lastStatus: status, lastCheckedAt: new Date(), retrievedAt: status === 'OK' ? new Date() : src.retrievedAt, ...(hash ? { lastHash: hash } : {}) },
      });

      // File a review proposal when action is needed (changed, or could not verify)
      const needsReview = changed || ['ERROR', 'BLOCKED', 'NOT_ALLOWLISTED'].includes(status);
      if (needsReview) {
        const context = {
          review: true, sourceId: src.id, sourceTitle: src.title, sourceUrl: src.url,
          laborBodyName: src.laborBody?.name || null, status, note,
        };
        // dedupe: update an existing PENDING refresh proposal for this source
        const existing = await this.prisma.rateChangeProposal.findFirst({
          where: { status: 'PENDING', origin: 'REFRESH', sourceId: src.id },
        });
        if (existing) {
          await this.prisma.rateChangeProposal.update({ where: { id: existing.id }, data: { payload: { _context: context, note }, createdAt: new Date() } as any });
        } else {
          await this.prisma.rateChangeProposal.create({
            data: { origin: 'REFRESH', sourceId: src.id, status: 'PENDING', payload: { _context: context, note } },
          });
        }
      }

      results.push({ source: src.title, url: src.url, status, changed, note });
    }

    return { checked: results.length, changed: results.filter((r) => r.changed).length, results };
  }

  // ── AI research assistant (Tier 3) — extract cited candidates → proposals ─────────
  // Reads an approved/allow-listed source, asks an LLM to extract candidate rate
  // figures WITH a verbatim citation + confidence, sanity-checks them, and files
  // AI-origin PENDING proposals. It NEVER writes a live rule — a human approves.

  private aiConfigured(): boolean { return !!process.env.ANTHROPIC_API_KEY; }

  private async callLLM(system: string, user: string): Promise<string> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new BadRequestException('AI assistant not configured. Set ANTHROPIC_API_KEY in the backend .env to enable AI research.');
    const model = process.env.LABOR_AI_MODEL || 'claude-3-5-sonnet-20241022';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' } as any,
      body: JSON.stringify({ model, max_tokens: 2000, system, messages: [{ role: 'user', content: user }] }),
    } as any);
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new BadRequestException(`AI request failed (HTTP ${res.status}). ${t.slice(0, 200)}`);
    }
    const data: any = await res.json();
    return (data?.content?.[0]?.text) || '';
  }

  private parseJsonArray(text: string): any[] {
    if (!text) return [];
    let t = text.trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    const start = t.indexOf('['); const end = t.lastIndexOf(']');
    if (start >= 0 && end > start) t = t.slice(start, end + 1);
    try { const v = JSON.parse(t); return Array.isArray(v) ? v : []; } catch { return []; }
  }

  private sane(c: any): boolean {
    const v = Number(c?.value);
    if (!isFinite(v) || v <= 0) return false;
    const method = String(c?.calcMethod || '');
    if (method.startsWith('PERCENT')) return v < 1; // a fraction like 0.205
    return v < 100000; // flat amounts
  }

  /**
   * AI-extract candidate rates from a source for an agreement → file proposals.
   * data: { agreementId, sourceId?, url? }
   */
  async aiResearch(data: { agreementId: string; sourceId?: string; url?: string }) {
    if (!this.aiConfigured()) throw new BadRequestException('AI assistant not configured. Set ANTHROPIC_API_KEY in the backend .env.');
    const agr = await this.prisma.agreement.findUnique({
      where: { id: data.agreementId },
      include: { laborBody: true, classifications: true, rateRules: { include: { classification: true } } },
    });
    if (!agr) throw new NotFoundException('Agreement not found');

    // resolve + validate source URL
    let url = data.url || null;
    let sourceId = data.sourceId || null;
    if (sourceId && !url) {
      const s = await this.prisma.rateSource.findUnique({ where: { id: sourceId } });
      url = s?.url || null;
    }
    if (!url && agr.sourceId) {
      const s = await this.prisma.rateSource.findUnique({ where: { id: agr.sourceId } });
      url = s?.url || null; sourceId = sourceId || agr.sourceId;
    }
    if (!url) throw new BadRequestException('No source URL for this agreement. Add an approved source first.');
    if (!this.hostAllowed(url)) throw new BadRequestException('Source URL is not on the approved official-source allow-list.');

    // fetch source text
    let text = '';
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'TFM-Labor-AI/1.0' } } as any);
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = (await res.text()).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    } catch (e: any) {
      throw new BadRequestException(`Could not fetch the source (${e?.message || 'network/blocked'}). Try manual entry.`);
    }
    text = text.slice(0, 16000);

    const classCodes = agr.classifications.map((c) => c.code).join(', ') || '(none)';
    const system = [
      'You are an entertainment-payroll fringe analyst. Extract EMPLOYER-side contribution/burden rates from the provided official source text.',
      'Return ONLY a JSON array. Each item: {rateType, calcMethod, value, base, capPeriod, capAmount, currency, classificationCode, effectiveDate, quote, confidence}.',
      'rateType ∈ [PENSION, HEALTH, PENSION_HEALTH, PAYROLL_TAX, WORKERS_COMP, UNEMPLOYMENT, VACATION_PAY, HOLIDAY_PAY, EMPLOYER_TAX, UNION_DUES, GUILD_CONTRIB, STATUTORY_GRATUITY, OTHER].',
      'calcMethod ∈ [PERCENT, FLAT_PER_DAY, FLAT_PER_WEEK, FLAT_PER_HOUR, PERCENT_WITH_CAP, TIERED].',
      'value is a NUMBER: for PERCENT use a fraction (20.5% → 0.205); for flat methods use the amount.',
      'base ∈ [GROSS, STRAIGHT_TIME, TAXABLE, WORKED_DAYS] or null. capPeriod ∈ [WEEKLY, MONTHLY, ANNUAL, PER_PRODUCTION] or null.',
      'quote = a short verbatim excerpt from the source supporting the figure. confidence = 0..1.',
      'Only include figures explicitly supported by the text. If unsure, omit. Do NOT invent numbers. Return [] if none found.',
    ].join(' ');
    const user = `Agreement: ${agr.laborBody.name} — ${agr.name}\nKnown classifications: ${classCodes}\nSource URL: ${url}\n\nSOURCE TEXT:\n${text}`;

    const raw = await this.callLLM(system, user);
    const candidates = this.parseJsonArray(raw).filter((c) => this.sane(c));

    let filed = 0;
    const summary: any[] = [];
    for (const c of candidates) {
      // match an existing rule (same rateType + classification)
      const match = agr.rateRules.find((r) =>
        r.rateType === c.rateType &&
        ((r.classification?.code || null) === (c.classificationCode || null)));
      const note = `AI-extracted${c.quote ? `: “${String(c.quote).slice(0, 180)}”` : ''}`;
      const payload: any = {
        value: Number(c.value),
        base: c.base || null,
        capPeriod: c.capPeriod || null,
        capAmount: c.capAmount != null ? Number(c.capAmount) : null,
        currency: c.currency || 'USD',
        effectiveDate: c.effectiveDate || new Date().toISOString().slice(0, 10),
        sourceId,
        notes: note,
      };
      if (match) {
        await this.createProposal({ ruleId: match.id, origin: 'AI', confidence: Number(c.confidence) || null, payload });
      } else {
        await this.createProposal({
          origin: 'AI', confidence: Number(c.confidence) || null,
          payload: {
            ...payload, agreementId: agr.id,
            label: `${agr.laborBody.shortName || agr.laborBody.name} ${c.rateType}`,
            rateType: c.rateType, calcMethod: c.calcMethod || 'PERCENT',
            classificationCode: c.classificationCode || null,
          },
        });
      }
      filed++;
      summary.push({ rateType: c.rateType, value: c.value, confidence: c.confidence, matched: !!match });
    }

    return { filed, candidates: candidates.length, summary, note: 'Filed as PENDING proposals in Rate Approvals — review the cited figures before approving.' };
  }

  private parseJsonObject(text: string): any {
    let t = (text || '').trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    const s = t.indexOf('{'); const e = t.lastIndexOf('}');
    if (s >= 0 && e > s) t = t.slice(s, e + 1);
    try { return JSON.parse(t); } catch { return null; }
  }

  /** AI-check one incentive program's official source → file a review proposal with the finding. */
  private async aiCheckIncentive(p: any) {
    if (!this.hostAllowed(p.sourceUrl)) return false;
    let text = '';
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(p.sourceUrl, { signal: controller.signal, headers: { 'User-Agent': 'TFM-Labor-AI/1.0' } } as any);
      clearTimeout(timer);
      if (!res.ok) return false;
      text = (await res.text()).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 14000);
    } catch { return false; }

    const system = 'You are a film-incentive analyst. From the official source text, report the CURRENT headline cash rebate / tax credit. Return ONLY JSON: {ratePct, upliftMaxPct, capNote, effectiveDate, quote, confidence}. ratePct and upliftMaxPct are fractions (35% → 0.35). quote = short verbatim excerpt. Only what the text supports; omit unknowns.';
    const raw = await this.callLLM(system, `Program: ${p.name}\nSource: ${p.sourceUrl}\n\nSOURCE TEXT:\n${text}`);
    const c = this.parseJsonObject(raw);
    if (!c || c.ratePct == null) return false;

    const pct = (n: any) => (n != null ? `${(Number(n) * 100).toFixed(1)}%` : '');
    const note = `AI: base ${pct(c.ratePct)}${c.upliftMaxPct ? ` (up to ${pct(Number(c.ratePct) + Number(c.upliftMaxPct))})` : ''}${c.capNote ? ` · ${c.capNote}` : ''}${c.quote ? ` — “${String(c.quote).slice(0, 160)}”` : ''}`;
    const context = { review: true, incentive: true, programId: p.id, sourceTitle: p.name, sourceUrl: p.sourceUrl, status: 'OK', note };
    const existing = await this.prisma.rateChangeProposal.findFirst({ where: { status: 'PENDING', origin: 'AI', sourceId: null, payload: { path: ['_context', 'programId'], equals: p.id } as any } }).catch(() => null);
    if (existing) await this.prisma.rateChangeProposal.update({ where: { id: existing.id }, data: { payload: { _context: context, note }, confidence: Number(c.confidence) || null, createdAt: new Date() } as any });
    else await this.prisma.rateChangeProposal.create({ data: { origin: 'AI', status: 'PENDING', confidence: Number(c.confidence) || null, payload: { _context: context, note } } });
    return true;
  }

  /** One-click: AI-update ALL active agreements (US/CA/UK/UAE unions, guilds, statutory) + incentive programs. */
  async aiUpdateAll() {
    if (!this.aiConfigured()) throw new BadRequestException('AI assistant not configured. Set ANTHROPIC_API_KEY in the backend .env.');
    const agreements = await this.prisma.agreement.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true, sourceId: true } });
    let agreementsRun = 0, proposalsFiled = 0, skipped = 0;
    const errors: string[] = [];
    for (const a of agreements) {
      if (!a.sourceId) { skipped++; continue; }
      try { const r = await this.aiResearch({ agreementId: a.id }); agreementsRun++; proposalsFiled += r.filed || 0; }
      catch (e: any) { errors.push(`${a.name}: ${e?.message || 'failed'}`); }
    }
    const programs = await this.prisma.incentiveProgram.findMany({ where: { isActive: true } });
    let incentivesChecked = 0;
    for (const p of programs) {
      try { if (await this.aiCheckIncentive(p)) incentivesChecked++; } catch { /* skip */ }
    }
    return { agreementsRun, proposalsFiled, incentivesChecked, skipped, errors: errors.slice(0, 8), errorCount: errors.length };
  }

  // ── Rate-change proposals (approval-gated) ────────────────────────────────────────
  // Nothing reaches a live RateRule without an approver. Manual entry of a *new* rule
  // is allowed directly; CHANGING an existing rule's value is staged as a proposal.

  private static APPROVER_ROLES = ['SYSTEM_ADMIN', 'FINANCE_MANAGER', 'PRODUCTION_MANAGER'];
  private assertApprover(role?: string) {
    if (!role || !LaborService.APPROVER_ROLES.includes(role)) {
      throw new ForbiddenException('Only a Finance Manager, Line Producer (Production Manager) or System Admin can approve rate changes.');
    }
  }

  listProposals(status?: string) {
    const where: any = {};
    if (status) where.status = status;
    return this.prisma.rateChangeProposal.findMany({ where, orderBy: { createdAt: 'desc' } });
  }
  async pendingCount() {
    return this.prisma.rateChangeProposal.count({ where: { status: 'PENDING' } });
  }

  /** Stage a change. If payload.ruleId is set, builds a diff vs the live rule. */
  async createProposal(data: any, userId?: string) {
    let diff: any = null;
    let context: any = {};
    if (data.ruleId) {
      const rule = await this.prisma.rateRule.findUnique({ where: { id: data.ruleId }, include: { agreement: { include: { laborBody: true } } } });
      if (!rule) throw new NotFoundException('Rate rule not found');
      const fields = ['value', 'base', 'capPeriod', 'capAmount', 'currency', 'glAccountCode', 'effectiveDate', 'expirationDate'];
      diff = {};
      for (const f of fields) {
        const oldV = (rule as any)[f];
        const newV = data.payload?.[f];
        if (newV !== undefined && String(oldV ?? '') !== String(newV ?? '')) diff[f] = { from: oldV instanceof Date ? oldV.toISOString().slice(0, 10) : oldV, to: newV };
      }
      context = { ruleLabel: rule.label, agreementName: rule.agreement.name, laborBodyName: rule.agreement.laborBody.name, rateType: rule.rateType, currentValue: Number(rule.value) };
    } else if (data.payload?.agreementId) {
      context = { newRule: true, label: data.payload.label, rateType: data.payload.rateType };
    }
    return this.prisma.rateChangeProposal.create({
      data: {
        origin: data.origin || 'MANUAL',
        payload: { ruleId: data.ruleId || null, ...data.payload, _context: context },
        diff,
        sourceId: data.payload?.sourceId || null,
        confidence: data.confidence ?? null,
        status: 'PENDING',
      },
    });
  }

  /** Approve → writes a live RateRule (new version if changing, or brand-new rule). */
  async approveProposal(id: string, userId?: string, role?: string, notes?: string) {
    this.assertApprover(role);
    const p = await this.prisma.rateChangeProposal.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Proposal not found');
    if (p.status !== 'PENDING') throw new BadRequestException('Proposal already reviewed.');
    const payload: any = p.payload || {};
    const { ruleId, _context, ...fields } = payload;

    if (ruleId) {
      await this.updateRateRule(ruleId, fields, userId); // versions the rule (previousId chain)
    } else if (fields.agreementId) {
      await this.createRateRule({ ...fields, approvedById: userId, approvedAt: new Date() });
    }
    // else: a REFRESH/REVIEW proposal with no concrete target — approving just
    // acknowledges it (the human will enter/propose the actual rate separately).
    return this.prisma.rateChangeProposal.update({
      where: { id },
      data: { status: 'APPROVED', reviewedById: userId || null, reviewedAt: new Date(), reviewNotes: notes || null },
    });
  }

  async rejectProposal(id: string, userId?: string, role?: string, notes?: string) {
    this.assertApprover(role);
    const p = await this.prisma.rateChangeProposal.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Proposal not found');
    if (p.status !== 'PENDING') throw new BadRequestException('Proposal already reviewed.');
    return this.prisma.rateChangeProposal.update({
      where: { id },
      data: { status: 'REJECTED', reviewedById: userId || null, reviewedAt: new Date(), reviewNotes: notes || null },
    });
  }

  // ── Sources ─────────────────────────────────────────────────────────────────────
  sources(laborBodyId?: string) {
    const where: any = {};
    if (laborBodyId) where.laborBodyId = laborBodyId;
    return this.prisma.rateSource.findMany({ where, orderBy: { title: 'asc' } });
  }
  createSource(data: any) {
    return this.prisma.rateSource.create({
      data: {
        laborBodyId: data.laborBodyId || null, title: data.title, url: data.url || null,
        publisher: data.publisher || null, trusted: data.trusted ?? true,
        retrievedAt: data.retrievedAt ? new Date(data.retrievedAt) : null,
      },
    });
  }
  updateSource(id: string, data: any) {
    const { id: _i, laborBody, agreements, rateRules, createdAt, ...rest } = data || {};
    return this.prisma.rateSource.update({ where: { id }, data: rest });
  }
  removeSource(id: string) { return this.prisma.rateSource.delete({ where: { id } }); }

  // ════════════════════════════════════════════════════════════════════════════
  // C. RESOLUTION ENGINE
  // ════════════════════════════════════════════════════════════════════════════

  private async loadAgreements(): Promise<AgreementLike[]> {
    const agreements = await this.prisma.agreement.findMany({
      where: { status: 'ACTIVE' },
      include: {
        laborBody: { select: { name: true } },
        rateRules: { include: { classification: true, source: true } },
      },
    });
    return agreements.map((a) => ({
      id: a.id,
      laborBodyId: a.laborBodyId,
      laborBodyName: a.laborBody.name,
      name: a.name,
      productionTypes: (a.productionTypes as any) || [],
      effectiveDate: a.effectiveDate,
      expirationDate: a.expirationDate,
      status: a.status,
      rules: a.rateRules.map((r) => ({
        id: r.id,
        label: r.label,
        rateType: r.rateType,
        calcMethod: r.calcMethod as any,
        value: Number(r.value),
        base: r.base,
        capPeriod: r.capPeriod,
        capAmount: r.capAmount != null ? Number(r.capAmount) : null,
        floorAmount: r.floorAmount != null ? Number(r.floorAmount) : null,
        tiers: (r.tiers as any) || null,
        currency: r.currency,
        glAccountCode: r.glAccountCode,
        isEstimate: r.isEstimate,
        classificationId: r.classificationId,
        classificationCode: r.classification?.code || null,
        effectiveDate: r.effectiveDate,
        expirationDate: r.expirationDate,
        sourceTitle: r.source?.title || null,
        sourceUrl: r.source?.url || null,
      })),
    }));
  }

  /** Build a preview of rules that would apply, grouped by labor body. Pure read. */
  async resolvePreview(config: {
    productionType: string;
    unionStatus: 'UNION' | 'NON_UNION' | 'MIXED';
    laborBodyIds: string[];
    geoNodeId?: string | null;
    asOfDate?: string;
  }) {
    const asOf = config.asOfDate ? new Date(config.asOfDate) : new Date();
    const ctx: ResolveContext = {
      productionType: config.productionType,
      unionStatus: config.unionStatus,
      laborBodyIds: config.laborBodyIds || [],
      geoNodeId: config.geoNodeId,
      geoAncestorIds: await this.geoAncestors(config.geoNodeId),
      asOf,
    };
    const agreements = await this.loadAgreements();
    const resolved = resolveRules(ctx, agreements);

    const groups: Record<string, any> = {};
    for (const item of resolved) {
      const key = item.laborBodyName;
      if (!groups[key]) groups[key] = { laborBody: key, rules: [] };
      groups[key].rules.push({
        sourceRuleId: item.rule.id,
        agreementId: item.agreementId,
        agreementName: item.agreementName,
        classificationCode: item.classificationCode,
        label: item.rule.label,
        rateType: item.rule.rateType,
        calcMethod: item.rule.calcMethod,
        value: item.rule.value,
        base: item.rule.base,
        capPeriod: item.rule.capPeriod,
        capAmount: item.rule.capAmount,
        currency: item.rule.currency,
        glAccountCode: item.rule.glAccountCode,
        isEstimate: item.rule.isEstimate,
        sourceTitle: item.rule.sourceTitle,
        sourceUrl: item.rule.sourceUrl,
        effectiveDate: item.rule.effectiveDate,
        humanText: this.describeRule(item.rule),
      });
    }
    return { asOf, count: resolved.length, groups: Object.values(groups) };
  }

  private describeRule(r: any): string {
    const pct = (n: number) => `${(Number(n) * 100).toFixed(2)}%`;
    switch (r.calcMethod) {
      case 'PERCENT': return `${pct(r.value)} of ${(r.base || 'straight time').toLowerCase().replace('_', ' ')}`;
      case 'PERCENT_WITH_CAP': return `${pct(r.value)} of ${(r.base || 'gross').toLowerCase()} capped ${r.capPeriod?.toLowerCase() || ''} at ${r.capAmount}`;
      case 'FLAT_PER_DAY': return `${r.currency} ${r.value}/worked day`;
      case 'FLAT_PER_WEEK': return `${r.currency} ${r.value}/week`;
      case 'FLAT_PER_HOUR': return `${r.currency} ${r.value}/hour`;
      case 'TIERED': return `tiered rate`;
      default: return '';
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // D. PROJECT SNAPSHOT (immutable freeze)
  // ════════════════════════════════════════════════════════════════════════════

  async getProjectConfig(projectId: string) {
    const config = await this.prisma.projectLaborConfig.findUnique({
      where: { projectId },
      include: { geoNode: { select: { name: true, level: true } } },
    });
    const rules = await this.prisma.projectRateRule.findMany({
      where: { projectId },
      orderBy: [{ laborBodyName: 'asc' }, { rateType: 'asc' }],
    });
    let updatesAvailable = 0;
    if (rules.length) updatesAvailable = (await this.checkUpdates(projectId)).length;
    return { config, rules, updatesAvailable };
  }

  /** Save the wizard answers without freezing (draft). */
  async saveConfig(projectId: string, data: any) {
    return this.prisma.projectLaborConfig.upsert({
      where: { projectId },
      update: {
        geoNodeId: data.geoNodeId || null,
        productionType: data.productionType,
        unionStatus: data.unionStatus || 'NON_UNION',
        laborBodyIds: data.laborBodyIds || [],
        asOfDate: data.asOfDate ? new Date(data.asOfDate) : new Date(),
        notes: data.notes || null,
      },
      create: {
        projectId,
        geoNodeId: data.geoNodeId || null,
        productionType: data.productionType,
        unionStatus: data.unionStatus || 'NON_UNION',
        laborBodyIds: data.laborBodyIds || [],
        asOfDate: data.asOfDate ? new Date(data.asOfDate) : new Date(),
        notes: data.notes || null,
      },
    });
  }

  /**
   * Freeze the resolved rules into the project. Replaces any prior frozen set.
   * `selections` is an optional array of { sourceRuleId, enabled, overrideValue, overrideReason }.
   */
  async snapshot(projectId: string, data: any) {
    const cfg = data.config || (await this.prisma.projectLaborConfig.findUnique({ where: { projectId } }));
    if (!cfg) throw new BadRequestException('No labor configuration to snapshot.');

    await this.saveConfig(projectId, {
      geoNodeId: cfg.geoNodeId,
      productionType: cfg.productionType,
      unionStatus: cfg.unionStatus,
      laborBodyIds: cfg.laborBodyIds,
      asOfDate: cfg.asOfDate,
      notes: cfg.notes,
    });

    const preview = await this.resolvePreview({
      productionType: cfg.productionType,
      unionStatus: cfg.unionStatus,
      laborBodyIds: (cfg.laborBodyIds as any) || [],
      geoNodeId: cfg.geoNodeId,
      asOfDate: cfg.asOfDate ? new Date(cfg.asOfDate).toISOString() : undefined,
    });

    const overrides: Record<string, any> = {};
    for (const s of data.selections || []) overrides[s.sourceRuleId] = s;

    // wipe previous frozen rules and re-freeze
    await this.prisma.projectRateRule.deleteMany({ where: { projectId } });

    const rows: any[] = [];
    for (const g of preview.groups) {
      for (const r of g.rules) {
        const ov = overrides[r.sourceRuleId];
        if (ov && ov.enabled === false) continue;
        rows.push({
          projectId,
          sourceRuleId: r.sourceRuleId,
          laborBodyName: g.laborBody,
          agreementName: r.agreementName,
          classificationCode: r.classificationCode,
          label: r.label,
          rateType: r.rateType,
          calcMethod: r.calcMethod,
          value: ov?.overrideValue != null ? ov.overrideValue : r.value,
          base: r.base,
          capPeriod: r.capPeriod,
          capAmount: r.capAmount,
          floorAmount: null,
          tiers: null,
          currency: r.currency,
          glAccountCode: r.glAccountCode,
          isEstimate: r.isEstimate,
          overrideReason: ov?.overrideReason || null,
          enabled: true,
          sourceTitle: r.sourceTitle,
          sourceUrl: r.sourceUrl,
          effectiveDate: r.effectiveDate,
        });
      }
    }
    if (rows.length) await this.prisma.projectRateRule.createMany({ data: rows });

    await this.prisma.projectLaborConfig.update({
      where: { projectId },
      data: { snapshotAt: new Date() },
    });

    return { frozen: rows.length };
  }

  async toggleProjectRule(id: string, enabled: boolean) {
    return this.prisma.projectRateRule.update({ where: { id }, data: { enabled } });
  }

  /** Compare each frozen rule against master to detect a newer approved version. */
  async checkUpdates(projectId: string) {
    const frozen = await this.prisma.projectRateRule.findMany({
      where: { projectId, sourceRuleId: { not: null } },
    });
    const updates: any[] = [];
    for (const f of frozen) {
      // a newer master version points back to our source via previousId
      const newer = await this.prisma.rateRule.findFirst({
        where: { previousId: f.sourceRuleId! },
        orderBy: { effectiveDate: 'desc' },
        include: { source: true },
      });
      if (newer) {
        updates.push({
          projectRateRuleId: f.id,
          label: f.label,
          rateType: f.rateType,
          current: { value: Number(f.value), effectiveDate: f.effectiveDate },
          available: { sourceRuleId: newer.id, value: Number(newer.value), effectiveDate: newer.effectiveDate, sourceUrl: newer.source?.url },
        });
      }
    }
    return updates;
  }

  /** Apply selected master updates into the project (explicit, never automatic). */
  async applyUpdates(projectId: string, projectRateRuleIds: string[]) {
    const updates = await this.checkUpdates(projectId);
    let applied = 0;
    for (const u of updates) {
      if (projectRateRuleIds.length && !projectRateRuleIds.includes(u.projectRateRuleId)) continue;
      const master = await this.prisma.rateRule.findUnique({ where: { id: u.available.sourceRuleId }, include: { source: true } });
      if (!master) continue;
      await this.prisma.projectRateRule.update({
        where: { id: u.projectRateRuleId },
        data: {
          sourceRuleId: master.id,
          value: master.value,
          base: master.base,
          capPeriod: master.capPeriod,
          capAmount: master.capAmount,
          currency: master.currency,
          glAccountCode: master.glAccountCode,
          isEstimate: master.isEstimate,
          sourceTitle: master.source?.title || null,
          sourceUrl: master.source?.url || null,
          effectiveDate: master.effectiveDate,
        },
      });
      applied++;
    }
    return { applied };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BUDGET INTEGRATION — apply frozen rules to budget lines
  // ════════════════════════════════════════════════════════════════════════════

  private async projectRulesByClassification(projectId: string) {
    const rules = await this.prisma.projectRateRule.findMany({ where: { projectId, enabled: true } });
    const byClass: Record<string, any[]> = {};
    for (const r of rules) {
      const key = r.classificationCode || '__all__';
      (byClass[key] = byClass[key] || []).push(r);
    }
    return byClass;
  }

  private toRuleLike(r: any): RuleLike {
    return {
      id: r.id,
      label: r.label,
      rateType: r.rateType,
      calcMethod: r.calcMethod,
      value: Number(r.value),
      base: r.base,
      capPeriod: r.capPeriod,
      capAmount: r.capAmount != null ? Number(r.capAmount) : null,
      floorAmount: r.floorAmount != null ? Number(r.floorAmount) : null,
      tiers: (r.tiers as any) || null,
      currency: r.currency,
      glAccountCode: r.glAccountCode,
      isEstimate: r.isEstimate,
    };
  }

  /**
   * Recompute fringes for every line in a budget version using the project's
   * frozen rate rules, keyed by each line's classificationCode.
   * Lines with no classification keep their manual fringePct.
   */
  async applyFringesToVersion(versionId: string) {
    const version = await this.prisma.budgetVersion.findUnique({
      where: { id: versionId },
      include: { sections: { include: { accounts: { include: { lineItems: true } } } } },
    });
    if (!version) throw new NotFoundException();
    const byClass = await this.projectRulesByClassification(version.projectId);

    let linesTouched = 0;
    for (const section of version.sections) {
      for (const account of section.accounts) {
        for (const item of account.lineItems) {
          if (!item.classificationCode) continue;
          const rules = [...(byClass[item.classificationCode] || []), ...(byClass['__all__'] || [])];
          if (!rules.length) continue;
          const straightTime = Number(item.subtotal);
          const weeks = (item.units || '').toLowerCase().startsWith('week') ? Number(item.quantity) : undefined;
          const workedDays = (item.units || '').toLowerCase().startsWith('day') ? Number(item.quantity) : undefined;
          const hours = (item.units || '').toLowerCase().startsWith('hour') ? Number(item.quantity) : undefined;
          const computed = computeLineFringes(rules.map((r) => this.toRuleLike(r)), {
            straightTime, weeks, workedDays, hours,
          });
          const effPct = straightTime > 0 ? (computed.total / straightTime) * 100 : 0;
          await this.prisma.budgetLineItem.update({
            where: { id: item.id },
            data: {
              fringeAmount: computed.total,
              fringePct: Math.round(effPct * 100) / 100,
              total: straightTime + computed.total,
              fringeDetail: computed.detail as any,
            },
          });
          linesTouched++;
        }
      }
    }
    return { linesTouched };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PRODUCTION INCENTIVES & TAX CREDITS (Phase 5)
  // ════════════════════════════════════════════════════════════════════════════

  // ── Master programs ───────────────────────────────────────────────────────────
  incentivePrograms(geoNodeId?: string) {
    const where: any = {};
    if (geoNodeId) where.geoNodeId = geoNodeId;
    return this.prisma.incentiveProgram.findMany({
      where,
      include: { geoNode: { select: { name: true, level: true } } },
      orderBy: { name: 'asc' },
    });
  }
  createIncentiveProgram(data: any) {
    return this.prisma.incentiveProgram.create({ data: this.incentiveData(data) });
  }
  updateIncentiveProgram(id: string, data: any) {
    const { id: _i, geoNode, createdAt, updatedAt, ...rest } = data || {};
    if (rest.effectiveDate) rest.effectiveDate = new Date(rest.effectiveDate);
    if (rest.expirationDate) rest.expirationDate = new Date(rest.expirationDate);
    return this.prisma.incentiveProgram.update({ where: { id }, data: rest });
  }
  removeIncentiveProgram(id: string) { return this.prisma.incentiveProgram.delete({ where: { id } }); }

  private incentiveData(d: any) {
    return {
      geoNodeId: d.geoNodeId || null,
      name: d.name, authority: d.authority || null,
      incentiveType: d.incentiveType || 'TAX_CREDIT',
      ratePct: d.ratePct, basis: d.basis || 'QUALIFIED',
      minSpend: d.minSpend ?? null, capAmount: d.capAmount ?? null, upliftPct: d.upliftPct ?? null,
      transferable: d.transferable ?? false, refundable: d.refundable ?? false,
      currency: d.currency || 'USD',
      productionTypes: d.productionTypes ?? null,
      sourceTitle: d.sourceTitle || null, sourceUrl: d.sourceUrl || null,
      effectiveDate: d.effectiveDate ? new Date(d.effectiveDate) : null,
      expirationDate: d.expirationDate ? new Date(d.expirationDate) : null,
      isEstimate: d.isEstimate ?? true, isActive: d.isActive ?? true, notes: d.notes || null,
    };
  }

  // ── Qualified-spend computation from the active budget ──────────────────────────
  private async qualifiedSpend(projectId: string) {
    const version = await this.prisma.budgetVersion.findFirst({
      where: { projectId, isActive: true },
      include: { sections: { include: { accounts: { include: { lineItems: { select: { subtotal: true, total: true, classificationCode: true } } } } } } },
    });
    let total = 0, wages = 0, btl = 0, labor = 0;
    for (const s of version?.sections || []) {
      const isAtl = (s.code || '').startsWith('1');
      for (const a of s.accounts) {
        for (const li of a.lineItems) {
          const t = Number(li.total), sub = Number(li.subtotal);
          total += t; wages += sub;
          if (!isAtl) btl += t;
          if (li.classificationCode) labor += sub;
        }
      }
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    return { TOTAL: round(total), WAGES: round(wages), BTL: round(btl), LABOR: round(labor), QUALIFIED: round(total) };
  }

  private estimateFor(p: { ratePct: any; upliftPct?: any; minSpend?: any; capAmount?: any; basis: string }, bases: Record<string, number>, override?: number | null) {
    const spend = override != null ? Number(override) : (bases[p.basis] ?? bases.TOTAL ?? 0);
    const rate = Number(p.ratePct) + (p.upliftPct != null ? Number(p.upliftPct) : 0);
    const belowThreshold = p.minSpend != null && spend < Number(p.minSpend);
    let estimate = belowThreshold ? 0 : spend * rate;
    let capped = false;
    if (!belowThreshold && p.capAmount != null && estimate > Number(p.capAmount)) { estimate = Number(p.capAmount); capped = true; }
    return { qualifiedSpend: Math.round(spend * 100) / 100, effectiveRate: rate, estimate: Math.round(estimate * 100) / 100, belowThreshold, capped };
  }

  /** Applicable programs (by jurisdiction) + saved selections with live estimates + net. */
  async projectIncentives(projectId: string) {
    const project = await this.prisma.productionProject.findUnique({
      where: { id: projectId },
      select: { projectType: true, currency: true, productionCountryId: true, productionCountry: { select: { id: true, name: true, code: true } } },
    });
    const cfg = await this.prisma.projectLaborConfig.findUnique({ where: { projectId } });
    // Filming country (productionCountry) is the primary jurisdiction; the labor
    // wizard geo remains a fallback for projects created before V1.1.
    const ancestors = await this.geoAncestors(project?.productionCountryId || cfg?.geoNodeId || null);
    const bases = await this.qualifiedSpend(projectId);

    // applicable master programs: jurisdiction in ancestors (or global), active, type-matching
    const all = await this.prisma.incentiveProgram.findMany({
      where: { isActive: true },
      include: { geoNode: { select: { name: true } } },
    });
    const applicable = all.filter((p) => {
      const geoOk = !p.geoNodeId || ancestors.includes(p.geoNodeId);
      const types = (p.productionTypes as any) || null;
      const typeOk = !types || !Array.isArray(types) || types.length === 0 || (project?.projectType && types.includes(project.projectType));
      return geoOk && typeOk;
    }).map((p) => ({
      ...p,
      ...this.estimateFor({ ratePct: p.ratePct, upliftPct: p.upliftPct, minSpend: p.minSpend, capAmount: p.capAmount, basis: p.basis }, bases),
    }));

    const saved = await this.prisma.projectIncentive.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
    const savedWithEst = saved.map((s) => ({
      ...s,
      ...this.estimateFor({ ratePct: s.ratePct, upliftPct: s.upliftPct, minSpend: s.minSpend, capAmount: s.capAmount, basis: s.basis }, bases, s.qualifiedSpendOverride != null ? Number(s.qualifiedSpendOverride) : null),
    }));
    const totalIncentive = savedWithEst.reduce((t, s) => t + s.estimate, 0);

    return {
      currency: project?.currency || 'USD',
      filmingCountry: project?.productionCountry || null, // drives per-country UI (claim tracker etc.)
      bases,
      grossBudget: bases.TOTAL,
      applicable,
      saved: savedWithEst,
      totalIncentive: Math.round(totalIncentive * 100) / 100,
      netBudget: Math.round((bases.TOTAL - totalIncentive) * 100) / 100,
    };
  }

  async addProjectIncentive(projectId: string, data: any) {
    let p: any = null;
    if (data.programId) p = await this.prisma.incentiveProgram.findUnique({ where: { id: data.programId } });
    return this.prisma.projectIncentive.create({
      data: {
        projectId,
        programId: data.programId || null,
        name: data.name || p?.name || 'Incentive',
        incentiveType: data.incentiveType || p?.incentiveType || 'TAX_CREDIT',
        ratePct: data.ratePct ?? p?.ratePct ?? 0,
        basis: data.basis || p?.basis || 'QUALIFIED',
        capAmount: data.capAmount ?? p?.capAmount ?? null,
        minSpend: data.minSpend ?? p?.minSpend ?? null,
        upliftPct: data.upliftPct ?? p?.upliftPct ?? null,
        currency: data.currency || p?.currency || 'USD',
        qualifiedSpendOverride: data.qualifiedSpendOverride ?? null,
        sourceTitle: data.sourceTitle ?? p?.sourceTitle ?? null,
        sourceUrl: data.sourceUrl ?? p?.sourceUrl ?? null,
        notes: data.notes || null,
      },
    });
  }
  async updateProjectIncentive(id: string, data: any) {
    const { id: _i, project, projectId, createdAt, ...rest } = data || {};
    return this.prisma.projectIncentive.update({ where: { id }, data: rest });
  }
  removeProjectIncentive(id: string) { return this.prisma.projectIncentive.delete({ where: { id } }); }

  // ── Abu Dhabi rebate claim tracker (points → band → rebate + certificate stages) ──

  /** Enhanced-rebate % by ADFC Points Banding Scale (Clause 6.10). */
  private adEnhancedPct(points: number): number {
    if (points >= 85) return 0.15;
    if (points >= 70) return 0.10;
    if (points >= 40) return 0.075;
    if (points >= 15) return 0.05;
    if (points >= 10) return 0.025;
    return 0;
  }

  private adDefaultCriteria() {
    // Points marked (confirmed) are from ADFC Guidelines Clause 6.14; others are
    // indicative and editable. ADFC's official table & discretion govern.
    return [
      { key: 'featuring_ad', label: 'Featuring Abu Dhabi (story set & filmed in AD; landmarks; positive portrayal)', points: 20, selected: false, confirmed: true },
      { key: 'uae_culture', label: "Featuring UAE national history, culture, identity & values", points: 10, selected: false, confirmed: true },
      { key: 'uae_national_atl', label: 'UAE national in an above-the-line role (writer/director/lead/stunt) with on-screen credit', points: 20, selected: false, confirmed: false },
      { key: 'full_series_ad', label: 'Entire TV series filmed in Abu Dhabi', points: 20, selected: false, confirmed: false },
      { key: 'full_post_ad', label: 'Full post-production carried out in Abu Dhabi', points: 10, selected: false, confirmed: false },
      { key: 'local_talent', label: 'Uses / develops local Emirati talent (talent development)', points: 10, selected: false, confirmed: false },
    ];
  }

  private adCapForType(projectType?: string): number {
    const t = (projectType || '').toUpperCase();
    if (t === 'FEATURE' || t === 'TV_SERIES') return 36725000; // feature/IMAX/HETV drama (AED)
    if (t === 'DOCUMENTARY') return 7345000;
    return 1836250; // short-form (shorts/TVCs/music videos)
  }

  private adDefaultStages() {
    return [
      { key: 'eligibility', label: 'Confirm eligibility & content approval (Media Council / CMA)', status: 'PENDING', date: null, note: 'Min 1 Main Unit Shoot Day in Abu Dhabi; dedicated single-purpose AD bank account.' },
      { key: 'application', label: 'Submit Rebate Application', status: 'PENDING', date: null, note: 'At least 30 business days before principal photography. Include itemised budget + ADQPE worksheet, financier & production-services agreements, insurance binder.' },
      { key: 'interim_certificate', label: 'Receive Interim Certificate', status: 'PENDING', date: null, note: 'ADFC issues within 30 business days of an approved application.' },
      { key: 'principal_photography', label: 'Commence principal photography in Abu Dhabi', status: 'PENDING', date: null, note: 'Within 90 days of Interim Certificate (extendable to 120 for bona-fide delays).' },
      { key: 'audited_statement', label: 'Submit audited expenditure statement', status: 'PENDING', date: null, note: 'By an ADFC-approved auditor, within 180 days of completing PP/post in Abu Dhabi.' },
      { key: 'final_certificate', label: 'Receive Final Certificate', status: 'PENDING', date: null, note: 'Confirms final ADQPE and rebate amount.' },
      { key: 'payment', label: 'Receive payment', status: 'PENDING', date: null, note: 'To the Abu Dhabi-registered applicant within 30 business days of Final Certificate.' },
    ];
  }

  private recomputeClaim(c: any, projectType?: string) {
    const criteria = (c.criteria as any[]) || this.adDefaultCriteria();
    const totalPoints = criteria.filter((x) => x.selected).reduce((s, x) => s + (Number(x.points) || 0), 0);
    const standardPct = c.standardPct != null ? Number(c.standardPct) : 0.35;
    const enhancedPct = this.adEnhancedPct(totalPoints);
    const totalPct = standardPct + enhancedPct;
    const adqpe = c.adqpe != null ? Number(c.adqpe) : 0;
    const cap = c.capAmount != null ? Number(c.capAmount) : this.adCapForType(projectType);
    let estimatedRebate = adqpe * totalPct;
    const capped = cap != null && estimatedRebate > cap;
    if (capped) estimatedRebate = cap;
    return { criteria, totalPoints, standardPct, enhancedPct, totalPct, cap, estimatedRebate: Math.round(estimatedRebate * 100) / 100, capped };
  }

  async getClaim(projectId: string) {
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { projectType: true, currency: true } });
    let claim = await this.prisma.incentiveClaim.findFirst({ where: { projectId } });
    if (!claim) {
      // scaffold a default (unsaved) claim shape
      const c = this.recomputeClaim({}, project?.projectType);
      return {
        claim: null,
        scaffold: {
          programName: 'Abu Dhabi Film Rebate', currency: 'AED',
          standardPct: 0.35, criteria: this.adDefaultCriteria(),
          totalPoints: 0, enhancedPct: 0, totalPct: 0.35,
          adqpe: null, capAmount: c.cap, estimatedRebate: 0,
          stages: this.adDefaultStages(), notes: null,
        },
        computed: c,
      };
    }
    const c = this.recomputeClaim(claim, project?.projectType);
    return { claim, computed: c };
  }

  async saveClaim(projectId: string, data: any) {
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { projectType: true } });
    const c = this.recomputeClaim(data, project?.projectType);
    const payload: any = {
      programName: data.programName || 'Abu Dhabi Film Rebate',
      currency: data.currency || 'AED',
      standardPct: c.standardPct,
      criteria: c.criteria,
      totalPoints: c.totalPoints,
      enhancedPct: c.enhancedPct,
      totalPct: c.totalPct,
      adqpe: data.adqpe != null && data.adqpe !== '' ? Number(data.adqpe) : null,
      capAmount: data.capAmount != null && data.capAmount !== '' ? Number(data.capAmount) : c.cap,
      estimatedRebate: c.estimatedRebate,
      stages: data.stages || this.adDefaultStages(),
      notes: data.notes || null,
    };
    const existing = await this.prisma.incentiveClaim.findFirst({ where: { projectId } });
    if (existing) return this.prisma.incentiveClaim.update({ where: { id: existing.id }, data: payload });
    return this.prisma.incentiveClaim.create({ data: { projectId, ...payload } });
  }

  /** Fringe Detail report — burden per cost center broken down by rate type. */
  async fringeDetail(versionId: string) {
    const version = await this.prisma.budgetVersion.findUnique({
      where: { id: versionId },
      include: {
        project: { select: { title: true, projectNumber: true, currency: true } },
        sections: { orderBy: { sortOrder: 'asc' }, include: { accounts: { orderBy: { sortOrder: 'asc' }, include: { lineItems: true } } } },
      },
    });
    if (!version) throw new NotFoundException();

    const typeTotals: Record<string, number> = {};
    let grandWages = 0;
    let grandFringe = 0;

    const sections = version.sections.map((s) => {
      const accounts = s.accounts.map((a) => {
        let wages = 0;
        const burden: Record<string, number> = {};
        let anyEstimate = false;
        for (const li of a.lineItems) {
          wages += Number(li.subtotal);
          const detail = (li.fringeDetail as any[]) || [];
          for (const d of detail) {
            burden[d.rateType] = (burden[d.rateType] || 0) + Number(d.amount);
            typeTotals[d.rateType] = (typeTotals[d.rateType] || 0) + Number(d.amount);
            if (d.isEstimate) anyEstimate = true;
          }
        }
        const fringeTotal = Object.values(burden).reduce((x, y) => x + y, 0);
        grandWages += wages;
        grandFringe += fringeTotal;
        return {
          code: a.code, title: a.title, wages,
          burden, fringeTotal, anyEstimate,
          burdenPct: wages > 0 ? Math.round((fringeTotal / wages) * 1000) / 10 : 0,
        };
      }).filter((a) => a.fringeTotal > 0 || a.wages > 0);
      const sectionFringe = accounts.reduce((x, a) => x + a.fringeTotal, 0);
      return { code: s.code, title: s.title, accounts, fringeTotal: sectionFringe };
    });

    return {
      versionId,
      project: version.project,
      versionName: version.versionName,
      sections,
      typeTotals,
      grandWages,
      grandFringe,
      grandBurdenPct: grandWages > 0 ? Math.round((grandFringe / grandWages) * 1000) / 10 : 0,
      generatedAt: new Date().toISOString(),
    };
  }
}
