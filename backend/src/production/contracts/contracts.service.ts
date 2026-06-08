import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { WorkflowService } from '../../workflow/workflow.service';

/**
 * ContractsService (Phase 3B)
 * ───────────────────────────────────────────────────────────────────────────
 * 1. Generate a ProjectContract from a ContractTemplate, injecting {{variables}}
 *    by pulling from the FROZEN labor snapshot (ProductionCrew rate card — the
 *    system's stand-in for a ProjectRateRule snapshot).
 * 2. E-Sign & Budget Trigger: a webhook that listens for a 'Signed' status
 *    (DocuSign simulation). On full signature the service AUTOMATICALLY creates a
 *    PurchaseOrder (the Two-Ledger commitment) and encumbers the linked
 *    BudgetLineItem — guarded by LedgerService.assertPeriodOpen().
 */
@Injectable()
export class ContractsService {
  private readonly log = new Logger('ContractsService');
  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
    private workflow: WorkflowService,
  ) {}

  // ── Sequences ───────────────────────────────────────────────────────────────
  private async nextNumber(prefix: 'CON' | 'PO'): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.prisma.documentSequence.upsert({
      where: { prefix }, update: { lastNumber: { increment: 1 } }, create: { prefix, lastNumber: 1, year },
    });
    return `${prefix}-${year}-${String(seq.lastNumber).padStart(4, '0')}`;
  }

  // ── Masters: Templates & Clauses ──────────────────────────────────────────────
  listTemplates() {
    return this.prisma.contractTemplate.findMany({
      where: { isActive: true },
      include: { clauses: { orderBy: { orderIndex: 'asc' } }, _count: { select: { projectContracts: true } } },
      orderBy: { name: 'asc' },
    });
  }
  getTemplate(id: string) {
    return this.prisma.contractTemplate.findUnique({ where: { id }, include: { clauses: { orderBy: { orderIndex: 'asc' } } } });
  }
  createTemplate(d: any, userId?: string) {
    if (!d?.name || !d?.bodyMarkdown) throw new BadRequestException('name and bodyMarkdown are required');
    return this.prisma.contractTemplate.create({
      data: {
        name: d.name, type: d.type || 'OTHER', description: d.description || null,
        language: d.language || 'en', bodyMarkdown: d.bodyMarkdown, variables: d.variables ?? undefined,
        governingLaw: d.governingLaw || null, jurisdiction: d.jurisdiction || null, createdById: userId || null,
      },
    });
  }
  updateTemplate(id: string, d: any) {
    const { id: _i, clauses, projectContracts, createdBy, createdAt, updatedAt, _count, ...rest } = d || {};
    return this.prisma.contractTemplate.update({ where: { id }, data: rest });
  }
  listClauses() {
    return this.prisma.clauseTemplate.findMany({ where: { isActive: true }, orderBy: [{ category: 'asc' }, { orderIndex: 'asc' }] });
  }
  createClause(d: any) {
    if (!d?.code || !d?.title || !d?.bodyMarkdown) throw new BadRequestException('code, title and bodyMarkdown are required');
    return this.prisma.clauseTemplate.create({
      data: {
        code: d.code, title: d.title, category: d.category || null, bodyMarkdown: d.bodyMarkdown,
        language: d.language || 'en', isMandatory: !!d.isMandatory, riskLevel: d.riskLevel || null,
        templateId: d.templateId || null, orderIndex: d.orderIndex ?? 0,
      },
    });
  }

  // ── Project contracts ─────────────────────────────────────────────────────────
  // scope: a projectId filters to one project; 'standalone' → project-less; else all.
  listContracts(query: { projectId?: string; scope?: string } = {}) {
    const where: any = {};
    if (query.projectId) where.projectId = query.projectId;
    else if (query.scope === 'standalone') where.projectId = null;
    return this.prisma.projectContract.findMany({
      where,
      include: {
        parties: true, template: { select: { name: true } },
        project: { select: { title: true, isHouse: true } },
        productionCrew: { select: { name: true, role: true } },
        budgetLineItem: { select: { code: true, subTitle: true, description: true } },
        _count: { select: { auditLogs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Master dashboard rollup — across all projects + standalone. */
  async dashboard() {
    const soon = new Date(Date.now() + 30 * 864e5);
    const [byStatus, standalone, awaitingSignature, expiringSoon] = await Promise.all([
      this.prisma.projectContract.groupBy({ by: ['status'], _count: true }),
      this.prisma.projectContract.count({ where: { projectId: null } }),
      this.prisma.projectContract.findMany({
        where: { status: { in: ['SENT', 'PARTIALLY_SIGNED'] } },
        orderBy: { updatedAt: 'desc' }, take: 10,
        include: { project: { select: { title: true, isHouse: true } } },
      }),
      this.prisma.projectContract.findMany({
        where: { status: 'ACTIVE', expiryDate: { not: null, lte: soon } },
        orderBy: { expiryDate: 'asc' }, take: 10,
        include: { project: { select: { title: true, isHouse: true } } },
      }),
    ]);
    return { byStatus, standalone, awaitingSignature, expiringSoon };
  }
  getContract(id: string) {
    return this.prisma.projectContract.findUnique({
      where: { id },
      include: {
        parties: { orderBy: { signerOrder: 'asc' } },
        auditLogs: { orderBy: { createdAt: 'desc' } },
        template: true, productionCrew: true, budgetLineItem: true, purchaseOrder: true,
      },
    });
  }

  /**
   * (#1) GENERATE a contract from a template.
   * Pulls the rate from the crew member's frozen labor snapshot and injects it
   * into {{merge_variables}}, then freezes the resolved values onto the contract.
   */
  async generateFromTemplate(dto: any, userId?: string) {
    if (!dto?.templateId) throw new BadRequestException('templateId is required');

    const template = await this.prisma.contractTemplate.findUnique({
      where: { id: dto.templateId }, include: { clauses: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!template) throw new NotFoundException('Template not found');

    // projectId optional → null means a standalone contract (House/Corporate ledger).
    let project: any = null;
    if (dto.projectId) {
      project = await this.prisma.productionProject.findUnique({ where: { id: dto.projectId } });
      if (!project) throw new NotFoundException('Project not found');
    }

    // Frozen labor snapshot — the crew rate card stands in for ProjectRateRule.
    let crew: any = null;
    if (dto.productionCrewId) {
      crew = await this.prisma.productionCrew.findUnique({ where: { id: dto.productionCrewId } });
      if (!crew) throw new NotFoundException('Crew member not found');
      if (project && crew.projectId !== project.id) throw new BadRequestException('Crew member belongs to a different project');
    }

    // Optional budget line to encumber on signature.
    let line: any = null;
    if (dto.budgetLineItemId) {
      line = await this.prisma.budgetLineItem.findUnique({ where: { id: dto.budgetLineItemId } });
      if (!line) throw new NotFoundException('Budget line item not found');
    }

    const dailyRate = dto.dailyRate != null ? Number(dto.dailyRate) : (crew?.dailyRate != null ? Number(crew.dailyRate) : null);
    const weeklyRate = crew?.weeklyRate != null ? Number(crew.weeklyRate) : null;
    const currency = dto.currency || project?.currency || 'AED';

    // Build the merge-variable map (the snapshot frozen onto the contract).
    const vars: Record<string, string> = {
      project_title: project?.title || 'Standalone (Corporate)',
      project_code: (project as any)?.code || '',
      company_name: 'The Film Makers FZ LLC',
      counterparty_name: dto.counterpartyName || crew?.name || '',
      crew_name: crew?.name || dto.counterpartyName || '',
      role: crew?.roleTitle || crew?.role || dto.role || '',
      department: crew?.department || '',
      daily_rate: dailyRate != null ? this.fmt(dailyRate, currency) : '________',
      weekly_rate: weeklyRate != null ? this.fmt(weeklyRate, currency) : '________',
      currency,
      start_date: this.dstr(dto.startDate),
      end_date: this.dstr(dto.endDate),
      contract_value: dto.contractValue != null ? this.fmt(Number(dto.contractValue), currency) : '________',
      governing_law: template.governingLaw || 'UAE Federal Law',
      jurisdiction: template.jurisdiction || 'Abu Dhabi Courts',
      today: this.dstr(new Date()),
      ...(dto.extraVars || {}),
    };

    // Render the body: template + appended clauses, with {{tokens}} replaced.
    const clauseBlock = template.clauses.map((c) => `\n\n## ${c.title}\n\n${c.bodyMarkdown}`).join('');
    const rendered = this.inject(`${template.bodyMarkdown}${clauseBlock}`, vars);

    const contractNumber = await this.nextNumber('CON');
    const contract = await this.prisma.projectContract.create({
      data: {
        contractNumber,
        title: dto.title || `${template.name} — ${vars.counterparty_name || vars.project_title}`,
        type: template.type,
        status: 'DRAFT',
        language: template.language,
        projectId: project?.id || null,
        templateId: template.id,
        budgetLineItemId: line?.id || null,
        productionCrewId: crew?.id || null,
        bodyMarkdown: rendered,
        resolvedVars: vars,
        rateSnapshotId: crew?.id || null, // provenance of the frozen rate
        dailyRate: dailyRate != null ? dailyRate : undefined,
        contractValue: dto.contractValue != null ? Number(dto.contractValue) : undefined,
        currency: currency as any,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        createdById: userId || null,
        parties: {
          create: this.buildParties(dto, vars),
        },
      },
      include: { parties: true },
    });

    await this.audit(contract.id, null, 'CREATED', { actorName: 'System', metadata: { templateId: template.id } });
    return contract;
  }

  /** Default parties: COMPANY (issuer) + the counterparty, unless dto.parties given. */
  private buildParties(dto: any, vars: Record<string, string>) {
    if (Array.isArray(dto.parties) && dto.parties.length) {
      return dto.parties.map((p: any, i: number) => ({
        role: p.role || 'OTHER', name: p.name, email: p.email || null, organization: p.organization || null,
        title: p.title || null, signerOrder: p.signerOrder ?? i + 1, signatureMethod: p.signatureMethod || 'ESIGN',
      }));
    }
    return [
      { role: 'COMPANY' as any, name: vars.company_name, organization: 'The Film Makers FZ LLC', signerOrder: 1 },
      {
        role: (dto.counterpartyRole || (vars.crew_name ? 'CREW' : 'CONTRACTOR')) as any,
        name: vars.counterparty_name || 'Counterparty', email: dto.counterpartyEmail || null, signerOrder: 2,
      },
    ];
  }

  /** Replace {{ token }} (whitespace-tolerant). Unknown tokens become a blank line. */
  private inject(body: string, vars: Record<string, string>) {
    return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => (vars[key] != null ? vars[key] : '________'));
  }

  // ── Send for signature (DocuSign simulation) ──────────────────────────────────
  async sendForSignature(id: string, body: any = {}, userId?: string) {
    const c = await this.prisma.projectContract.findUnique({ where: { id }, include: { parties: true } });
    if (!c) throw new NotFoundException();
    if (['SIGNED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'TERMINATED'].includes(c.status))
      throw new BadRequestException(`Contract is ${c.status}; cannot re-send.`);

    const provider = body.provider || 'docusign';
    const envelopeId = c.esignEnvelopeId || `ENV-${provider.toUpperCase()}-${Date.now()}`;

    // Route through the approval engine if a CONTRACT chain is seeded; otherwise SENT directly.
    try {
      await this.workflow.start(
        { entityType: 'CONTRACT' as any, entityId: c.id, projectId: c.projectId, label: `Contract ${c.contractNumber}` },
        userId,
      );
    } catch (e: any) { this.log.warn(`Contract ${c.id}: approval routing not configured (${e?.message}).`); }

    await this.prisma.projectContract.update({
      where: { id }, data: { status: 'SENT', esignProvider: provider, esignEnvelopeId: envelopeId },
    });
    await this.prisma.contractParty.updateMany({ where: { contractId: id }, data: { signatureStatus: 'PENDING' } });
    await this.audit(id, null, 'SENT', { actorName: userId || 'System', metadata: { envelopeId, provider } });
    return { ok: true, envelopeId, webhookHint: `POST /contracts/webhooks/esign { envelopeId:"${envelopeId}", status:"signed", signerEmail }` };
  }

  /**
   * (#2) E-SIGN WEBHOOK — listens for a 'Signed' status (DocuSign simulation).
   * Idempotent per providerEventId. When the LAST party signs, the contract is
   * fully executed → auto-generate the PurchaseOrder and encumber the budget line.
   */
  async handleEsignWebhook(payload: any) {
    const envelopeId = payload?.envelopeId || payload?.data?.envelopeId;
    if (!envelopeId) throw new BadRequestException('envelopeId is required');

    const contract = await this.prisma.projectContract.findFirst({
      where: { esignEnvelopeId: envelopeId }, include: { parties: true, budgetLineItem: true, purchaseOrder: true },
    });
    if (!contract) throw new NotFoundException(`No contract for envelope ${envelopeId}`);

    // Idempotency: skip events we've already recorded.
    const eventId = payload.providerEventId || payload.eventId || null;
    if (eventId) {
      const seen = await this.prisma.signatureAuditLog.findFirst({ where: { contractId: contract.id, providerEventId: eventId } });
      if (seen) return { ok: true, deduped: true, status: contract.status };
    }

    const status = String(payload.status || payload.event || '').toLowerCase();
    const signerEmail = (payload.signerEmail || payload.email || '').toLowerCase();
    const now = payload.signedAt ? new Date(payload.signedAt) : new Date();

    // Mark the signing party (match by email, else the next pending in order).
    let party = contract.parties.find((p) => p.email && p.email.toLowerCase() === signerEmail) || null;
    if (!party && /sign/.test(status)) {
      party = contract.parties.filter((p) => p.signatureStatus !== 'SIGNED').sort((a, b) => a.signerOrder - b.signerOrder)[0] || null;
    }

    if (/decline/.test(status)) {
      if (party) await this.prisma.contractParty.update({ where: { id: party.id }, data: { signatureStatus: 'DECLINED' } });
      await this.prisma.projectContract.update({ where: { id: contract.id }, data: { status: 'CANCELLED' } });
      await this.audit(contract.id, party?.id || null, 'DECLINED', { actorEmail: signerEmail, ipAddress: payload.ip, providerEventId: eventId });
      return { ok: true, status: 'CANCELLED' };
    }

    if (party && /sign|complete/.test(status)) {
      await this.prisma.contractParty.update({
        where: { id: party.id }, data: { signatureStatus: 'SIGNED', signedAt: now, ipAddress: payload.ip || null },
      });
    }
    await this.audit(contract.id, party?.id || null, 'SIGNED', {
      actorEmail: signerEmail, ipAddress: payload.ip, userAgent: payload.userAgent,
      documentHash: payload.documentHash, providerEventId: eventId,
    });

    // Are all parties signed now?
    const fresh = await this.prisma.contractParty.findMany({ where: { contractId: contract.id } });
    const allSigned = fresh.length > 0 && fresh.every((p) => p.signatureStatus === 'SIGNED');
    if (!allSigned) {
      await this.prisma.projectContract.update({ where: { id: contract.id }, data: { status: 'PARTIALLY_SIGNED' } });
      return { ok: true, status: 'PARTIALLY_SIGNED' };
    }

    // ── FULLY EXECUTED → Two-Ledger commitment + budget encumbrance ──
    return this.executeSignedContract(contract.id, now);
  }

  /** Manual fallback to fully execute a contract (e.g. wet-ink) without the webhook. */
  async markSigned(id: string, userId?: string) {
    const c = await this.prisma.projectContract.findUnique({ where: { id } });
    if (!c) throw new NotFoundException();
    await this.prisma.contractParty.updateMany({ where: { contractId: id }, data: { signatureStatus: 'SIGNED', signedAt: new Date() } });
    await this.audit(id, null, 'SIGNED', { actorName: userId || 'System', method: 'WET_INK' });
    return this.executeSignedContract(id, new Date());
  }

  /**
   * Core Two-Ledger effect: on full execution create the PurchaseOrder commitment
   * against the linked budget line's cost center, link it to the contract, and
   * flip the contract to ACTIVE. Guarded by the period lock. Idempotent.
   */
  private async executeSignedContract(contractId: string, signedAt: Date) {
    const c = await this.prisma.projectContract.findUnique({ where: { id: contractId }, include: { budgetLineItem: true } });
    if (!c) throw new NotFoundException();
    if (c.purchaseOrderId) {
      // Already encumbered — just ensure status is consistent.
      await this.prisma.projectContract.update({ where: { id: contractId }, data: { status: 'ACTIVE', signedAt } });
      return { ok: true, alreadyEncumbered: true, purchaseOrderId: c.purchaseOrderId };
    }

    const amount = c.contractValue != null ? Number(c.contractValue) : (c.dailyRate != null ? Number(c.dailyRate) : 0);

    // Standalone contract → commit against the House/Corporate project.
    const standalone = !c.projectId;
    const projectId = c.projectId || (await this.ledger.getHouseProjectId());

    // Two-Ledger guard: the commitment must fall in an open accounting period.
    await this.ledger.assertPeriodOpen(projectId, signedAt);

    const poNumber = await this.nextNumber('PO');
    const po = await this.prisma.purchaseOrder.create({
      data: {
        projectId,
        poNumber,
        description: `Contract ${c.contractNumber} — ${c.title}${standalone ? ' [standalone/corporate]' : ''}`,
        // Encumber the EXACT budget line that was linked at drafting (project contracts only).
        costCenterCode: c.budgetLineItem?.code || null,
        costCenterTitle: c.budgetLineItem?.subTitle || c.budgetLineItem?.description || null,
        date: signedAt,
        amount, taxAmount: 0, total: amount,
        currency: c.currency as any,
        // A fully executed contract is a binding, authorised commitment.
        status: 'APPROVED',
        notes: `Auto-generated on full e-signature of ${c.contractNumber}.${standalone ? ' Corporate overhead (no project).' : ''}`,
      },
    });

    await this.prisma.projectContract.update({
      where: { id: contractId },
      data: { status: 'ACTIVE', signedAt, purchaseOrderId: po.id },
    });

    await this.audit(contractId, null, 'COMPLETED', {
      actorName: 'System', metadata: { purchaseOrderId: po.id, poNumber, encumbered: amount, costCenter: po.costCenterCode },
    });
    this.log.log(`Contract ${c.contractNumber} executed → PO ${poNumber} (${c.currency} ${amount}) on ${po.costCenterCode || 'no cost center'}.`);
    return { ok: true, status: 'ACTIVE', purchaseOrder: po, encumbered: amount };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  private async audit(contractId: string, partyId: string | null, event: string, extra: any = {}) {
    return this.prisma.signatureAuditLog.create({
      data: {
        contractId, partyId: partyId || null, event: event as any,
        method: extra.method || null, actorName: extra.actorName || null, actorEmail: extra.actorEmail || null,
        ipAddress: extra.ipAddress || null, userAgent: extra.userAgent || null, documentHash: extra.documentHash || null,
        providerEventId: extra.providerEventId || null, metadata: extra.metadata ?? undefined,
      },
    });
  }
  private fmt(n: number, ccy: string) { return `${ccy} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
  private dstr(d?: any) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '________'; }
}
