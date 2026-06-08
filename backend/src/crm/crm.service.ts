import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export const STAGES = ['QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
const OPEN_STAGES = ['QUALIFIED', 'PROPOSAL', 'NEGOTIATION'];

@Injectable()
export class CrmService {
  constructor(private prisma: PrismaService) {}

  // ── Leads ──
  leads(q: any = {}) {
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.search) where.OR = [{ companyName: { contains: q.search, mode: 'insensitive' } }, { contactName: { contains: q.search, mode: 'insensitive' } }];
    return this.prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' } });
  }
  createLead(data: any) {
    return this.prisma.lead.create({ data: { companyName: data.companyName, contactName: data.contactName, email: data.email, phone: data.phone, source: data.source, status: data.status || 'NEW', estimatedValue: data.estimatedValue ? Number(data.estimatedValue) : undefined, notes: data.notes } });
  }
  updateLead(id: string, data: any) {
    const patch: any = {};
    for (const k of ['companyName', 'contactName', 'email', 'phone', 'source', 'status', 'notes']) if (data[k] !== undefined) patch[k] = data[k];
    if (data.estimatedValue !== undefined) patch.estimatedValue = data.estimatedValue === '' ? null : Number(data.estimatedValue);
    return this.prisma.lead.update({ where: { id }, data: patch });
  }
  removeLead(id: string) { return this.prisma.lead.delete({ where: { id } }); }

  async convertLead(id: string, data: any) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    const opp = await this.prisma.opportunity.create({
      data: {
        title: data.title || `${lead.companyName || lead.contactName} — opportunity`,
        leadId: lead.id, clientId: data.clientId || null,
        stage: 'QUALIFIED', value: Number(data.value || lead.estimatedValue || 0),
        source: lead.source, expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
      },
    });
    await this.prisma.lead.update({ where: { id }, data: { status: 'CONVERTED' } });
    return opp;
  }

  // ── Opportunities ──
  opportunities(q: any = {}) {
    const where: any = {};
    if (q.stage) where.stage = q.stage;
    return this.prisma.opportunity.findMany({ where, orderBy: { updatedAt: 'desc' } });
  }
  async opportunitiesEnriched(q: any = {}) {
    const opps = await this.opportunities(q);
    const ids = opps.map(o => o.clientId).filter(Boolean) as string[];
    const clients = ids.length ? await this.prisma.client.findMany({ where: { id: { in: ids } }, select: { id: true, companyName: true } }) : [];
    const cmap = Object.fromEntries(clients.map(c => [c.id, c.companyName]));
    return opps.map(o => ({ ...o, clientName: o.clientId ? cmap[o.clientId] : null }));
  }
  createOpportunity(data: any) {
    if (!data.title) throw new BadRequestException('Title is required');
    return this.prisma.opportunity.create({
      data: {
        title: data.title, clientId: data.clientId || null, stage: data.stage || 'QUALIFIED',
        value: Number(data.value || 0), probability: data.probability != null ? Number(data.probability) : 50,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
        source: data.source, notes: data.notes,
      },
    });
  }
  updateOpportunity(id: string, data: any) {
    const patch: any = {};
    for (const k of ['title', 'clientId', 'stage', 'source', 'notes', 'lostReason']) if (data[k] !== undefined) patch[k] = data[k] || null;
    if (data.value !== undefined) patch.value = Number(data.value || 0);
    if (data.probability !== undefined) patch.probability = Number(data.probability);
    if (data.expectedCloseDate !== undefined) patch.expectedCloseDate = data.expectedCloseDate ? new Date(data.expectedCloseDate) : null;
    return this.prisma.opportunity.update({ where: { id }, data: patch });
  }
  setStage(id: string, stage: string, lostReason?: string) {
    if (!STAGES.includes(stage)) throw new BadRequestException('Invalid stage');
    return this.prisma.opportunity.update({ where: { id }, data: { stage, lostReason: stage === 'LOST' ? (lostReason || null) : null, probability: stage === 'WON' ? 100 : stage === 'LOST' ? 0 : undefined } });
  }
  removeOpportunity(id: string) { return this.prisma.opportunity.delete({ where: { id } }); }

  async pipeline() {
    const opps = await this.prisma.opportunity.findMany();
    const byStage: Record<string, { count: number; value: number; weighted: number }> = {};
    for (const s of STAGES) byStage[s] = { count: 0, value: 0, weighted: 0 };
    for (const o of opps) { const v = Number(o.value); byStage[o.stage] = byStage[o.stage] || { count: 0, value: 0, weighted: 0 }; byStage[o.stage].count++; byStage[o.stage].value += v; byStage[o.stage].weighted += v * (o.probability / 100); }
    const openValue = OPEN_STAGES.reduce((s, st) => s + byStage[st].value, 0);
    const weightedPipeline = OPEN_STAGES.reduce((s, st) => s + byStage[st].weighted, 0);
    const won = byStage['WON'], lost = byStage['LOST'];
    const winRate = (won.count + lost.count) ? Math.round((won.count / (won.count + lost.count)) * 100) : 0;
    return { byStage, openValue, weightedPipeline: Math.round(weightedPipeline), wonValue: won.value, winRate };
  }

  // Create a draft quotation from an opportunity
  async convertToQuotation(id: string, userId: string) {
    const opp = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!opp) throw new NotFoundException('Opportunity not found');
    if (!opp.clientId) throw new BadRequestException('Link a client to this opportunity before creating a quotation.');
    const year = new Date().getFullYear();
    const seq = await this.prisma.documentSequence.upsert({ where: { prefix: 'QT' }, update: { lastNumber: { increment: 1 } }, create: { prefix: 'QT', lastNumber: 1, year } });
    const quotationNumber = `QT-${year}-${String(seq.lastNumber).padStart(4, '0')}`;
    const q = await this.prisma.quotation.create({
      data: { quotationNumber, clientId: opp.clientId, status: 'DRAFT', subject: opp.title, createdById: userId },
    });
    await this.prisma.opportunity.update({ where: { id }, data: { quotationId: q.id, stage: opp.stage === 'QUALIFIED' ? 'PROPOSAL' : opp.stage } });
    return q;
  }
}
