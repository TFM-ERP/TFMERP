import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * SYS-07 slice 3 — Tech recces (per-department field notes) + weighted location
 * evaluation/scoring with project-level side-by-side comparison.
 */
@Injectable()
export class AssessmentService {
  constructor(private prisma: PrismaService) {}

  // The ten scoring criteria and their default (equal) weights.
  static readonly CRITERIA = [
    'visual', 'access', 'logistics', 'cost', 'safety',
    'productionValue', 'permitComplexity', 'feasibility', 'comfort', 'schedule',
  ];

  /** Weighted 1-5 score. permitComplexity is inverted (lower complexity = better). */
  private computeWeighted(scores: Record<string, number>, weights?: Record<string, number>) {
    let wsum = 0, total = 0;
    for (const c of AssessmentService.CRITERIA) {
      const raw = Number(scores?.[c]);
      if (!raw || raw < 1) continue;
      const score = c === 'permitComplexity' ? 6 - raw : raw; // invert: 5 complex → 1 good
      const w = Number(weights?.[c] ?? 1);
      total += score * w;
      wsum += w;
    }
    return wsum > 0 ? Math.round((total / wsum) * 1000) / 1000 : 0;
  }

  // Department concern checklists (SYS-07 V2 · Slice 5) — the HOD prompts captured per dept.
  // Generic items apply to every department; specific items extend per department.
  static readonly CHECKLIST_GENERIC = [
    ['access', 'Access & approach for unit/trucks'],
    ['parking', 'Parking & holding / basecamp'],
    ['hazards', 'Hazards & clearances'],
    ['hospital', 'Nearest hospital / medical'],
    ['restore', 'Set restoration / make-good'],
  ];
  static readonly CHECKLIST_BY_DEPT: Record<string, [string, string][]> = {
    DOP: [['light', 'Light direction & sun-path'], ['power', 'Power vs generator'], ['sightlines', 'Sightlines & camera positions']],
    GAFFER: [['power', 'Power vs generator + genny placement'], ['rig', 'Rig points & distribution'], ['light', 'Ambient / practical light']],
    GRIP: [['rig', 'Rig points & mounting'], ['craneTrack', 'Crane / track / dolly run']],
    SOUND: [['ambient', 'Ambient / background noise'], ['flightPath', 'Flight path / traffic / AC hum']],
    SFX: [['hazards', 'Pyro / atmos clearances'], ['water', 'Water / fire safety']],
    STUNTS: [['hazards', 'Stunt hazards & rigging'], ['safety', 'Safety perimeter & padding']],
    ART_PD: [['dressing', 'Set dressing scope'], ['restore', 'Restore / make-good']],
    FIRST_AD: [['holding', 'Holding / crowd / extras'], ['truckCount', 'Truck count & unit base']],
    TRANSPORT: [['truckCount', 'Truck count & turnaround'], ['parking', 'Parking & route']],
    SAFETY: [['hospital', 'Nearest hospital'], ['hazards', 'Hazard register'], ['fire', 'Fire / evac route']],
    LM: [['permit', 'Permit feasibility'], ['neighbours', 'Neighbours / noise window']],
  };

  /** Static checklist template for the UI (generic + per-department items). */
  checklistTemplate(department?: string) {
    const specific = department ? (AssessmentService.CHECKLIST_BY_DEPT[department] || []) : [];
    return { generic: AssessmentService.CHECKLIST_GENERIC, specific };
  }

  // ── Tech recces ────────────────────────────────────────────────────────────
  async listRecces(locationId: string) {
    return this.prisma.techRecce.findMany({
      where: { locationId },
      orderBy: { createdAt: 'desc' },
      include: { notes: { orderBy: { department: 'asc' } } },
    });
  }

  async createRecce(locationId: string, data: any, userId?: string) {
    await this.assertLocation(locationId);
    return this.prisma.techRecce.create({
      data: {
        locationId,
        reccedAt: data?.reccedAt ? new Date(data.reccedAt) : null,
        conductedBy: data?.conductedBy || null,
        attendees: data?.attendees || null,
        summary: data?.summary || null,
        status: data?.status || 'PLANNED',
        createdById: userId || null,
      },
    });
  }

  async updateRecce(id: string, data: any) {
    const e = await this.prisma.techRecce.findUnique({ where: { id }, select: { id: true } });
    if (!e) throw new NotFoundException('Recce not found');
    return this.prisma.techRecce.update({
      where: { id },
      data: {
        reccedAt: data?.reccedAt ? new Date(data.reccedAt) : undefined,
        conductedBy: data?.conductedBy,
        attendees: data?.attendees,
        summary: data?.summary,
        status: data?.status,
      },
    });
  }

  /** Upsert a department note on a recce (one note per department per recce). */
  async upsertNote(recceId: string, data: any) {
    const recce = await this.prisma.techRecce.findUnique({ where: { id: recceId }, select: { id: true } });
    if (!recce) throw new NotFoundException('Recce not found');
    if (!data?.department) throw new BadRequestException('department is required');
    const existing = await this.prisma.recceNote.findFirst({ where: { techRecceId: recceId, department: data.department } });
    const SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'BLOCKER'];
    const payload = {
      risks: data.risks || null, equipmentNeeds: data.equipmentNeeds || null, crewNeeds: data.crewNeeds || null,
      accessNotes: data.accessNotes || null, safetyNotes: data.safetyNotes || null, powerNotes: data.powerNotes || null,
      photos: data.photos || null,
      // S5 additions
      note: data.note ?? null,
      severity: SEVERITIES.includes(data.severity) ? data.severity : 'INFO',
      actionItem: data.actionItem ?? null,
      resolved: data.resolved ?? false,
      checklist: data.checklist ?? null,
    };
    if (existing) return this.prisma.recceNote.update({ where: { id: existing.id }, data: payload });
    return this.prisma.recceNote.create({ data: { techRecceId: recceId, department: data.department, ...payload } });
  }

  async removeNote(id: string) { return this.prisma.recceNote.delete({ where: { id } }); }

  /** Quick triage toggle — mark a department note's action item resolved/unresolved. */
  async toggleNote(id: string, resolved: boolean) {
    const e = await this.prisma.recceNote.findUnique({ where: { id }, select: { id: true } });
    if (!e) throw new NotFoundException('Note not found');
    return this.prisma.recceNote.update({ where: { id }, data: { resolved } });
  }

  /**
   * Roll every department note across a location's recces into one readiness view:
   * concerns grouped by department, severity tallies, open action items, and blockers.
   * This is the input the readiness gate (S8) and the location report (S6) consume.
   */
  async recceRollup(locationId: string) {
    const recces = await this.prisma.techRecce.findMany({
      where: { locationId },
      orderBy: { reccedAt: 'desc' },
      include: { notes: true },
    });
    const notes = recces.flatMap(r => r.notes.map(n => ({ ...n, reccedAt: r.reccedAt, recceId: r.id })));
    const sevTally: Record<string, number> = { INFO: 0, LOW: 0, MEDIUM: 0, HIGH: 0, BLOCKER: 0 };
    const byDept: Record<string, any[]> = {};
    const openActions: any[] = [];
    const blockers: any[] = [];
    for (const n of notes) {
      sevTally[n.severity ?? 'INFO'] = (sevTally[n.severity ?? 'INFO'] || 0) + 1;
      (byDept[n.department] ||= []).push(n);
      if (n.actionItem && !n.resolved) openActions.push({ id: n.id, department: n.department, actionItem: n.actionItem, severity: n.severity });
      if ((n.severity === 'BLOCKER' || n.severity === 'HIGH') && !n.resolved) blockers.push({ id: n.id, department: n.department, note: n.note, severity: n.severity, actionItem: n.actionItem });
    }
    return {
      recceCount: recces.length,
      noteCount: notes.length,
      departments: Object.keys(byDept).sort(),
      severityTally: sevTally,
      openActions,
      blockers,
      // ready when every recce note's action item is resolved and there are no open blockers
      readiness: blockers.length === 0 && openActions.length === 0 ? 'READY' : blockers.length > 0 ? 'BLOCKED' : 'OUTSTANDING',
      byDept,
    };
  }

  // ── Evaluations ──────────────────────────────────────────────────────────
  async listEvaluations(locationId: string) {
    return this.prisma.locationEvaluation.findMany({ where: { locationId }, orderBy: { createdAt: 'desc' } });
  }

  async upsertEvaluation(locationId: string, data: any, userId?: string) {
    await this.assertLocation(locationId);
    if (!data?.scores || typeof data.scores !== 'object') throw new BadRequestException('scores object is required');
    const weightedScore = this.computeWeighted(data.scores, data.weights);
    const recommendation = data.recommendation
      || (weightedScore >= 4 ? 'RECOMMENDED' : weightedScore >= 2.5 ? 'ACCEPTABLE' : 'NOT_RECOMMENDED');
    const base = {
      scores: data.scores, weights: data.weights || null, weightedScore,
      recommendation, notes: data.notes || null,
      evaluatedById: userId || null, evaluatedByName: data.evaluatedByName || null,
    };
    if (data.id) return this.prisma.locationEvaluation.update({ where: { id: data.id }, data: base });
    return this.prisma.locationEvaluation.create({ data: { locationId, ...base } });
  }

  // ── Project comparison ─────────────────────────────────────────────────────
  /** Rank every project location by its latest evaluation's weighted score. */
  async compareProject(projectId: string) {
    const locations = await this.prisma.location.findMany({
      where: { projectId },
      include: {
        evaluations: { orderBy: { createdAt: 'desc' }, take: 1 },
        techRecces: { select: { id: true } },
        masterLocation: { select: { id: true, name: true } },
      },
    });
    const rows = locations.map((l) => {
      const ev = l.evaluations[0];
      return {
        locationId: l.id,
        name: l.name,
        status: l.status,
        masterLocationId: l.masterLocationId,
        scenes: l.scenes,
        feePerDay: l.locationFeePerDay,
        currency: l.currency,
        recceCount: l.techRecces.length,
        evaluated: !!ev,
        weightedScore: ev ? Number(ev.weightedScore) : null,
        recommendation: ev?.recommendation || null,
        scores: ev?.scores || null,
      };
    });
    rows.sort((a, b) => (b.weightedScore ?? -1) - (a.weightedScore ?? -1));
    return { criteria: AssessmentService.CRITERIA, rows };
  }

  /** Assemble the full location pack for a project — everything for the printable book. */
  async packProject(projectId: string) {
    const project = await this.prisma.productionProject.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, status: true },
    });
    const locations = await this.prisma.location.findMany({
      where: { projectId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: {
        masterLocation: { include: { media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] } } },
        permits: { orderBy: { createdAt: 'desc' } },
        risks: { orderBy: { riskScore: 'desc' } },
        evaluations: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    return { project, generatedAt: new Date(), locations };
  }

  private async assertLocation(id: string) {
    const e = await this.prisma.location.findUnique({ where: { id }, select: { id: true } });
    if (!e) throw new NotFoundException('Project location not found');
  }
}
