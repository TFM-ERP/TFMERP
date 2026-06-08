import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

// ── Formula Engine ────────────────────────────────────────────────────────────
// Safe arithmetic expression parser — supports +, -, *, /, (, ), numbers, identifiers
// Variables are substituted from a globals map before evaluation.

function tokenise(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    if (/\s/.test(expr[i])) { i++; continue; }
    if (/[0-9.]/.test(expr[i])) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) num += expr[i++];
      tokens.push(num);
    } else if (/[a-zA-Z_]/.test(expr[i])) {
      let id = '';
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) id += expr[i++];
      tokens.push(id);
    } else if ('+-*/()'.includes(expr[i])) {
      tokens.push(expr[i++]);
    } else {
      i++; // skip unknown chars
    }
  }
  return tokens;
}

class Parser {
  private tokens: string[];
  private pos = 0;
  private vars: Record<string, number>;

  constructor(tokens: string[], vars: Record<string, number>) {
    this.tokens = tokens;
    this.vars = vars;
  }

  private peek() { return this.tokens[this.pos]; }
  private consume() { return this.tokens[this.pos++]; }

  parse(): number { return this.parseExpr(); }

  private parseExpr(): number {
    let result = this.parseTerm();
    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.consume();
      const right = this.parseTerm();
      result = op === '+' ? result + right : result - right;
    }
    return result;
  }

  private parseTerm(): number {
    let result = this.parseFactor();
    while (this.peek() === '*' || this.peek() === '/') {
      const op = this.consume();
      const right = this.parseFactor();
      if (op === '/') result = right !== 0 ? result / right : 0;
      else result = result * right;
    }
    return result;
  }

  private parseFactor(): number {
    const t = this.peek();
    if (t === '(') {
      this.consume();
      const val = this.parseExpr();
      if (this.peek() === ')') this.consume();
      return val;
    }
    if (t === '-') {
      this.consume();
      return -this.parseFactor();
    }
    this.consume();
    if (!isNaN(Number(t))) return Number(t);
    if (t && t in this.vars) return this.vars[t];
    return 0; // unknown variable → 0
  }
}

export function evaluateFormula(formula: string, globals: Record<string, number>): number {
  try {
    const tokens = tokenise(formula);
    const parser = new Parser(tokens, globals);
    const result = parser.parse();
    return isFinite(result) ? Math.max(0, result) : 0;
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/** Sum a labour stage breakdown [{qty, rate}] → subtotal. */
function stagesSubtotal(stages: any): number | null {
  if (!Array.isArray(stages) || !stages.length) return null;
  return stages.reduce((s, x) => s + (Number(x.qty) || 0) * (Number(x.rate) || 0), 0);
}
/** Industry tier from an account/section code: 1xxx=ATL, 2xxx=BTL, 3xxx=POST, else OTHER. */
function tierOf(code?: string, explicit?: string | null): string {
  if (explicit) return explicit;
  const c = (code || '').trim();
  if (c.startsWith('1')) return 'ATL';
  if (c.startsWith('2')) return 'BTL';
  if (c.startsWith('3')) return 'POST';
  return 'OTHER';
}

@Injectable()
export class BudgetService {
  constructor(private prisma: PrismaService) {}

  // ── Budget Version CRUD ────────────────────────────────────────────────────

  async getVersion(versionId: string) {
    const version = await this.prisma.budgetVersion.findUnique({
      where: { id: versionId },
      include: {
        globals: { orderBy: { key: 'asc' } },
        fringes: { orderBy: { name: 'asc' } },
        sections: {
          orderBy: { sortOrder: 'asc' },
          include: {
            accounts: {
              orderBy: { sortOrder: 'asc' },
              include: {
                lineItems: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        },
      },
    });
    if (!version) throw new NotFoundException(`Budget version ${versionId} not found`);
    return version;
  }

  /** Throw if the version is LOCKED — locked budgets are read-only (create a working copy to change). */
  private async assertVersionEditable(versionId: string) {
    const v = await this.prisma.budgetVersion.findUnique({ where: { id: versionId }, select: { status: true } });
    if (v?.status === 'LOCKED') {
      throw new BadRequestException('This budget version is locked and read-only. Create a working copy to make changes, or move budget between lines via an approved transfer.');
    }
  }
  private async versionIdOfAccount(accountId: string) {
    const a = await this.prisma.budgetAccount.findUnique({ where: { id: accountId }, select: { section: { select: { budgetVersionId: true } } } });
    return a?.section.budgetVersionId;
  }
  private async versionIdOfSection(sectionId: string) {
    const s = await this.prisma.budgetSection.findUnique({ where: { id: sectionId }, select: { budgetVersionId: true } });
    return s?.budgetVersionId;
  }

  async createVersion(projectId: string, data: { versionName: string; notes?: string }) {
    return this.prisma.budgetVersion.create({
      data: { projectId, versionName: data.versionName, notes: data.notes, status: 'DRAFT', isActive: false },
    });
  }

  // ── Budget lifecycle state machine (DRAFT → REVIEW V1..Vn → APPROVED → LOCKED → WORKING) ──
  private static TRANSITIONS: Record<string, string[]> = {
    DRAFT: ['REVIEW'],
    REVIEW: ['APPROVED', 'DRAFT'],        // approve, or send back for changes
    APPROVED: ['LOCKED', 'REVIEW'],       // freeze as baseline, or reopen review
    LOCKED: [],                            // immutable — branch via Create Working Copy
    WORKING: ['REVIEW', 'LOCKED'],        // resubmit as next V, or direct legacy lock
  };
  private static LIFECYCLE_CREW_ROLES = ['EXECUTIVE_PRODUCER', 'PRODUCER', 'LINE_PRODUCER'];
  private static LIFECYCLE_SYSTEM_ROLES = ['SYSTEM_ADMIN', 'FINANCE_MANAGER'];

  private async logLifecycle(projectId: string, versionId: string, fromStatus: any, toStatus: any, nameSnap: string, userId?: string, role?: string, notes?: string) {
    await this.prisma.budgetLifecycleLog.create({
      data: {
        projectId, budgetVersionId: versionId,
        fromStatus, toStatus, versionNameSnap: nameSnap,
        changedById: userId || null, changedByRole: role || null, notes: notes || null,
      },
    }).catch(() => { /* audit log must never block the transition itself */ });
  }

  /**
   * Role-gated, validated lifecycle transition with sequential V-numbering and audit log.
   * Allowed actors: project crew with role EP / Producer / Line Producer, or a privileged
   * system role (System Admin / Finance Manager).
   */
  async executeStatusTransition(versionId: string, dto: { toStatus: string; notes?: string }, userId?: string, systemRole?: string) {
    const v = await this.prisma.budgetVersion.findUnique({ where: { id: versionId } });
    if (!v) throw new NotFoundException('Budget version not found');

    // RBAC — resolve the actor's authority on THIS project
    let actorRole = (systemRole || '').toUpperCase();
    if (!BudgetService.LIFECYCLE_SYSTEM_ROLES.includes(actorRole)) {
      const crew = userId
        ? await this.prisma.productionCrew.findFirst({ where: { projectId: v.projectId, userId } })
        : null;
      if (crew && BudgetService.LIFECYCLE_CREW_ROLES.includes(String(crew.role))) {
        actorRole = String(crew.role);
      } else {
        throw new ForbiddenException('Administrative authority required to alter budget lifecycle status (Executive Producer, Producer or Line Producer).');
      }
    }

    const to = String(dto.toStatus || '').toUpperCase();
    const allowed = BudgetService.TRANSITIONS[v.status as string] || [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(`Invalid transition ${v.status} → ${to}. Allowed: ${allowed.join(', ') || 'none — create a working copy instead'}.`);
    }

    const data: any = { status: to };
    if (to === 'REVIEW') {
      // sequential V-numbering: V1, V2, … per project
      const max = await this.prisma.budgetVersion.aggregate({ where: { projectId: v.projectId }, _max: { versionSequence: true } });
      const seq = (Number(max._max.versionSequence) || 0) + 1;
      data.versionSequence = seq;
      data.versionName = `Budget V${seq}`;
    }
    if (to === 'LOCKED') data.lockedAt = new Date();

    const updated = await this.prisma.budgetVersion.update({ where: { id: versionId }, data });
    await this.logLifecycle(v.projectId, v.id, v.status, to, updated.versionName, userId, actorRole, dto.notes);

    // ── Calendar anchor on LOCK ──────────────────────────────────────────────────
    // Locking the baseline fixes Principal Photography: derive the official shoot
    // window from THIS version's globals (shoot_days) anchored on the project's
    // shootStartDate. No hardcoded dates — everything reads from the data.
    if (to === 'LOCKED') await this.anchorProjectDates(v.projectId, versionId);

    return updated;
  }

  /** On lock: project.shootStartDate (anchor) + locked shoot_days global → shootEndDate. */
  private async anchorProjectDates(projectId: string, versionId: string) {
    try {
      const [project, globals] = await Promise.all([
        this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { shootStartDate: true, startDate: true } }),
        this.prisma.budgetGlobal.findMany({ where: { budgetVersionId: versionId } }),
      ]);
      const g = (key: string) => Number(globals.find((x) => x.key === key)?.value) || 0;
      const shootDays = g('shoot_days');
      const anchor = project?.shootStartDate || project?.startDate;
      if (!anchor || shootDays <= 0) return; // nothing to anchor — no guessing
      const end = new Date(anchor);
      end.setDate(end.getDate() + shootDays - 1); // Day 1 = anchor itself
      await this.prisma.productionProject.update({
        where: { id: projectId },
        data: { shootStartDate: new Date(anchor), shootEndDate: end },
      });
    } catch { /* anchoring must never block the lock itself */ }
  }

  /** Lifecycle audit trail for the project (newest first). */
  lifecycleHistory(projectId: string) {
    return this.prisma.budgetLifecycleLog.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  /**
   * Dual-column topsheet: Locked Baseline vs Current Working, per section, with variance.
   * variance = baseline − working  (negative ⇒ working copy is OVER the baseline).
   */
  async topsheetComparison(projectId: string, baselineId?: string, workingId?: string) {
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { currency: true } });
    if (!project) throw new NotFoundException('Project not found');

    const versions = await this.prisma.budgetVersion.findMany({
      where: { projectId }, orderBy: { createdAt: 'desc' },
      select: { id: true, versionName: true, status: true, versionSequence: true, isActive: true, lockedAt: true, createdAt: true, parentVersionId: true },
    });
    const byId = (id?: string) => (id ? versions.find((x) => x.id === id) : undefined);
    const baselineMeta = byId(baselineId)
      || versions.filter((x) => x.status === 'LOCKED')
        .sort((a, b) => new Date((b.lockedAt || b.createdAt) as any).getTime() - new Date((a.lockedAt || a.createdAt) as any).getTime())[0]
      || versions.find((x) => x.status === 'APPROVED')
      || null;
    const workingMeta = byId(workingId)
      || versions.find((x) => x.isActive)
      || versions.find((x) => x.status === 'WORKING')
      || null;

    const sectionTotals = async (vid?: string) => {
      const m = new Map<string, { title: string; total: number }>();
      if (!vid) return m;
      const full = await this.prisma.budgetVersion.findUnique({
        where: { id: vid },
        include: { sections: { orderBy: { sortOrder: 'asc' }, include: { accounts: { include: { lineItems: { select: { total: true } } } } } } },
      });
      for (const s of full?.sections || []) {
        let t = 0;
        for (const a of s.accounts) for (const i of a.lineItems) t += Number(i.total);
        m.set(s.code, { title: s.title, total: Math.round(t * 100) / 100 });
      }
      return m;
    };
    const [base, work] = await Promise.all([sectionTotals(baselineMeta?.id), sectionTotals(workingMeta?.id)]);

    const codes = Array.from(new Set([...base.keys(), ...work.keys()])).sort();
    let gb = 0, gw = 0;
    const topsheetGrid = codes.map((code) => {
      const b = base.get(code), w = work.get(code);
      gb += b?.total || 0; gw += w?.total || 0;
      return {
        sectionCode: code,
        sectionTitle: w?.title || b?.title || code,
        lockedBaseline: baselineMeta ? { versionName: baselineMeta.versionName, total: b?.total ?? 0 } : null,
        currentWorking: workingMeta ? { versionName: workingMeta.versionName, total: w?.total ?? 0 } : null,
        variance: Math.round(((b?.total ?? 0) - (w?.total ?? 0)) * 100) / 100,
      };
    });

    return {
      projectId,
      baseCurrency: project.currency,
      baseline: baselineMeta,
      working: workingMeta,
      topsheetGrid,
      grandTotals: { baseline: Math.round(gb * 100) / 100, working: Math.round(gw * 100) / 100, variance: Math.round((gb - gw) * 100) / 100 },
      versions,
    };
  }

  /**
   * Deep-copy a version into a new WORKING version ("create a working copy").
   * Clones globals, fringes, sections, accounts and every line item (including provenance).
   * Fringe-profile references on lines are remapped to the new profiles.
   */
  async cloneVersion(versionId: string, data?: { versionName?: string }) {
    const src = await this.prisma.budgetVersion.findUnique({
      where: { id: versionId },
      include: { globals: true, fringes: true, sections: { include: { accounts: { include: { lineItems: true } } } } },
    });
    if (!src) throw new NotFoundException('Source version not found');

    const copy = await this.prisma.budgetVersion.create({
      data: {
        projectId: src.projectId,
        versionName: data?.versionName || `${src.versionName} (Working Copy)`,
        notes: src.notes, status: 'WORKING', isActive: false,
        parentVersionId: src.id, // remembers which baseline this branched from
      },
    });
    await this.logLifecycle(src.projectId, copy.id, src.status, 'WORKING', copy.versionName, undefined, 'BRANCH', `Working copy created from "${src.versionName}"`);
    // globals
    if (src.globals.length) await this.prisma.budgetGlobal.createMany({
      data: src.globals.map(g => ({ budgetVersionId: copy.id, key: g.key, label: g.label, value: g.value, unit: g.unit })),
    });
    // fringes (keep old→new id map for line references)
    const fringeMap = new Map<string, string>();
    for (const f of src.fringes) {
      const nf = await this.prisma.fringeProfile.create({ data: { budgetVersionId: copy.id, name: f.name, percentage: f.percentage, description: f.description } });
      fringeMap.set(f.id, nf.id);
    }
    // sections → accounts → line items
    for (const s of src.sections) {
      const ns = await this.prisma.budgetSection.create({ data: { budgetVersionId: copy.id, code: s.code, title: s.title, tier: s.tier, sortOrder: s.sortOrder, color: s.color } });
      for (const a of s.accounts) {
        const na = await this.prisma.budgetAccount.create({ data: { sectionId: ns.id, code: a.code, title: a.title, sortOrder: a.sortOrder, etcAmount: a.etcAmount } });
        if (a.lineItems.length) await this.prisma.budgetLineItem.createMany({
          data: a.lineItems.map(li => ({
            accountId: na.id, sortOrder: li.sortOrder, code: li.code, subTitle: li.subTitle, description: li.description,
            quantityFormula: li.quantityFormula, quantity: li.quantity, units: li.units, rate: li.rate,
            currency: li.currency, exchangeRate: li.exchangeRate,
            fringeProfileId: li.fringeProfileId ? (fringeMap.get(li.fringeProfileId) || null) : null, fringePct: li.fringePct,
            classificationCode: li.classificationCode, fringeDetail: li.fringeDetail ?? undefined,
            crewMemberId: li.crewMemberId, stages: li.stages ?? undefined,
            origin: li.origin, aiSuggestedRate: li.aiSuggestedRate, aiSuggestedQuantity: li.aiSuggestedQuantity,
            subtotal: li.subtotal, fringeAmount: li.fringeAmount, total: li.total, notes: li.notes,
          })),
        });
      }
    }
    return copy;
  }

  async setActiveVersion(versionId: string) {
    const version = await this.prisma.budgetVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new NotFoundException();
    // Deactivate all other versions of this project
    await this.prisma.budgetVersion.updateMany({
      where: { projectId: version.projectId },
      data: { isActive: false },
    });
    return this.prisma.budgetVersion.update({ where: { id: versionId }, data: { isActive: true } });
  }

  async lockVersion(versionId: string, userId?: string) {
    const v = await this.prisma.budgetVersion.findUnique({ where: { id: versionId } });
    if (!v) throw new NotFoundException();
    const updated = await this.prisma.budgetVersion.update({
      where: { id: versionId },
      data: { status: 'LOCKED', lockedAt: new Date() },
    });
    await this.logLifecycle(v.projectId, v.id, v.status, 'LOCKED', v.versionName, userId, 'DIRECT_LOCK', 'Locked as baseline');
    return updated;
  }

  // ── Globals ────────────────────────────────────────────────────────────────

  async upsertGlobal(versionId: string, data: { key: string; label: string; value: number; unit?: string }) {
    const result = await this.prisma.budgetGlobal.upsert({
      where: { budgetVersionId_key: { budgetVersionId: versionId, key: data.key } },
      update: { label: data.label, value: data.value, unit: data.unit },
      create: { budgetVersionId: versionId, key: data.key, label: data.label, value: data.value, unit: data.unit },
    });
    // Recalculate all line items that use formulas
    await this.recalculateVersion(versionId);
    return result;
  }

  async deleteGlobal(globalId: string) {
    const g = await this.prisma.budgetGlobal.findUnique({ where: { id: globalId } });
    if (!g) throw new NotFoundException();
    await this.prisma.budgetGlobal.delete({ where: { id: globalId } });
    await this.recalculateVersion(g.budgetVersionId);
  }

  // ── Fringe Profiles ────────────────────────────────────────────────────────

  async createFringe(versionId: string, data: { name: string; percentage: number; description?: string }) {
    return this.prisma.fringeProfile.create({
      data: { budgetVersionId: versionId, name: data.name, percentage: data.percentage, description: data.description },
    });
  }

  async updateFringe(fringeId: string, data: { name?: string; percentage?: number; description?: string }) {
    return this.prisma.fringeProfile.update({ where: { id: fringeId }, data });
  }

  async deleteFringe(fringeId: string) {
    return this.prisma.fringeProfile.delete({ where: { id: fringeId } });
  }

  // ── Sections ───────────────────────────────────────────────────────────────

  async createSection(versionId: string, data: { code: string; title: string; tier?: string; sortOrder?: number; color?: string }) {
    await this.assertVersionEditable(versionId);
    return this.prisma.budgetSection.create({
      data: { budgetVersionId: versionId, code: data.code, title: data.title, tier: tierOf(data.code, data.tier), sortOrder: data.sortOrder || 0, color: data.color },
    });
  }

  async updateSection(sectionId: string, data: { code?: string; title?: string; sortOrder?: number; color?: string }) {
    const vId = await this.versionIdOfSection(sectionId);
    if (vId) await this.assertVersionEditable(vId);
    return this.prisma.budgetSection.update({ where: { id: sectionId }, data });
  }

  // ── Accounts ───────────────────────────────────────────────────────────────

  async createAccount(sectionId: string, data: { code: string; title: string; sortOrder?: number }) {
    const vId = await this.versionIdOfSection(sectionId);
    if (vId) await this.assertVersionEditable(vId);
    return this.prisma.budgetAccount.create({
      data: { sectionId, code: data.code, title: data.title, sortOrder: data.sortOrder || 0 },
    });
  }

  async updateAccount(accountId: string, data: { code?: string; title?: string; sortOrder?: number }) {
    const vId = await this.versionIdOfAccount(accountId);
    if (vId) await this.assertVersionEditable(vId);
    return this.prisma.budgetAccount.update({ where: { id: accountId }, data });
  }

  // ── Line Items ─────────────────────────────────────────────────────────────

  /**
   * Resolve the classificationCode for a cast performer from their union/guild.
   * The three performer bodies (SAG-AFTRA, ACTRA, Equity) all use 'PERFORMER';
   * resolved live so a project whose labor snapshot includes that union gets P&H.
   * Returns null when the talent has no union (no auto-fringe).
   */
  private async classificationForTalent(castTalentId: string): Promise<string | null> {
    const t = await this.prisma.globalTalentProfile.findUnique({
      where: { id: castTalentId },
      select: { laborBody: { select: { agreements: { select: { classifications: { select: { code: true } } } } } } },
    });
    const codes = (t?.laborBody?.agreements || []).flatMap((a: any) => a.classifications.map((c: any) => c.code));
    if (!codes.length) return null;
    return codes.includes('PERFORMER') ? 'PERFORMER' : codes[0];
  }

  async createLineItem(accountId: string, data: {
    description: string;
    code?: string;
    subTitle?: string;
    quantityFormula?: string;
    quantity?: number;
    units?: string;
    rate: number;
    currency?: string;
    exchangeRate?: number;
    fringeProfileId?: string;
    fringePct?: number;
    classificationCode?: string;
    crewMemberId?: string;
    castTalentId?: string;        // cast performer → auto-classifies the line by their union
    stages?: any[];
    notes?: string;
    sortOrder?: number;
    origin?: string;              // MANUAL | AI_GENERATED | SCRIPT_IMPORT | AUTO_BREAKDOWN
    aiSuggestedRate?: number;     // captured when the value came from AI/import
    aiSuggestedQuantity?: number;
  }) {
    // Get globals for formula resolution
    const account = await this.prisma.budgetAccount.findUnique({
      where: { id: accountId },
      include: { section: { include: { budgetVersion: { include: { globals: true, fringes: true } } } } },
    });
    if (!account) throw new NotFoundException(`Account ${accountId} not found`);
    if (account.section.budgetVersion.status === 'LOCKED') throw new BadRequestException('This budget version is locked and read-only. Create a working copy to make changes.');

    const globals = this.buildGlobalsMap(account.section.budgetVersion.globals);
    const fringes = account.section.budgetVersion.fringes;

    const qty = data.quantityFormula
      ? evaluateFormula(data.quantityFormula, globals)
      : (data.quantity ?? 1);

    const rate = data.rate ?? 0;
    const fxRate = data.exchangeRate ?? 1;
    const stages = Array.isArray(data.stages) ? data.stages : null;
    const stageSub = stagesSubtotal(stages);
    const subtotal = stageSub != null ? stageSub : (qty * rate) / fxRate;

    let fringePct = data.fringePct ?? 0;
    if (data.fringeProfileId) {
      const profile = fringes.find(f => f.id === data.fringeProfileId);
      if (profile) fringePct = Number(profile.percentage);
    }
    const fringeAmount = subtotal * (fringePct / 100);
    const total = subtotal + fringeAmount;

    // Cast performer → auto-classify the line by the talent's union (drives fringes).
    let classificationCode = data.classificationCode || null;
    if (data.castTalentId && !classificationCode) {
      classificationCode = await this.classificationForTalent(data.castTalentId);
    }

    const count = await this.prisma.budgetLineItem.count({ where: { accountId } });

    return this.prisma.budgetLineItem.create({
      data: {
        accountId,
        sortOrder: data.sortOrder ?? count,
        code: data.code || null,
        subTitle: data.subTitle || null,
        description: data.description,
        quantityFormula: data.quantityFormula,
        quantity: qty,
        units: data.units,
        rate,
        currency: (data.currency as any) ?? 'AED',
        exchangeRate: fxRate,
        fringeProfileId: data.fringeProfileId,
        fringePct,
        classificationCode,
        crewMemberId: data.crewMemberId || null,
        castTalentId: data.castTalentId || null,
        stages: stages || undefined,
        origin: (data.origin as any) || 'MANUAL',
        aiSuggestedRate: data.aiSuggestedRate ?? (data.origin && data.origin !== 'MANUAL' ? rate : null),
        aiSuggestedQuantity: data.aiSuggestedQuantity ?? (data.origin && data.origin !== 'MANUAL' ? qty : null),
        subtotal,
        fringeAmount,
        total,
        notes: data.notes,
      },
    });
  }

  async updateLineItem(lineItemId: string, data: any) {
    const item = await this.prisma.budgetLineItem.findUnique({
      where: { id: lineItemId },
      include: {
        account: {
          include: {
            section: { include: { budgetVersion: { include: { globals: true, fringes: true } } } },
          },
        },
      },
    });
    if (!item) throw new NotFoundException();
    if (item.account.section.budgetVersion.status === 'LOCKED') throw new BadRequestException('This budget version is locked and read-only. Create a working copy to make changes.');

    const globals = this.buildGlobalsMap(item.account.section.budgetVersion.globals);
    const fringes = item.account.section.budgetVersion.fringes;

    const quantityFormula = data.quantityFormula !== undefined ? data.quantityFormula : item.quantityFormula;
    const qty = quantityFormula
      ? evaluateFormula(quantityFormula, globals)
      : Number(data.quantity !== undefined ? data.quantity : item.quantity);

    const rate = data.rate !== undefined ? Number(data.rate) : Number(item.rate);
    const fxRate = data.exchangeRate !== undefined ? Number(data.exchangeRate) : Number(item.exchangeRate);
    const stages = data.stages !== undefined ? (Array.isArray(data.stages) ? data.stages : null) : (item.stages as any);
    const stageSub = stagesSubtotal(stages);
    const subtotal = stageSub != null ? stageSub : (qty * rate) / fxRate;

    let fringePct = data.fringePct !== undefined ? Number(data.fringePct) : Number(item.fringePct);
    const fringeProfileId = data.fringeProfileId !== undefined ? data.fringeProfileId : item.fringeProfileId;
    if (fringeProfileId) {
      const profile = fringes.find(f => f.id === fringeProfileId);
      if (profile) fringePct = Number(profile.percentage);
    }
    const fringeAmount = subtotal * (fringePct / 100);
    const total = subtotal + fringeAmount;

    // Provenance: if a human edits an AI/imported line's rate or quantity, flag it as an override
    // and preserve the original suggestion (once) for transparency.
    const AI_ORIGINS = ['AI_GENERATED', 'SCRIPT_IMPORT', 'AUTO_BREAKDOWN'];
    const rateChanged = data.rate !== undefined && Number(data.rate) !== Number(item.rate);
    const qtyChanged = (data.quantity !== undefined && Number(data.quantity) !== Number(item.quantity))
      || (data.quantityFormula !== undefined && data.quantityFormula !== item.quantityFormula)
      || (data.stages !== undefined);
    const provenance: any = {};
    if (AI_ORIGINS.includes(item.origin as any) && (rateChanged || qtyChanged)) {
      provenance.origin = 'MANUAL_OVERRIDE';
      if (item.aiSuggestedRate == null) provenance.aiSuggestedRate = Number(item.rate);
      if (item.aiSuggestedQuantity == null) provenance.aiSuggestedQuantity = Number(item.quantity);
    }
    // allow explicit origin set from importers (e.g. re-import)
    if (data.origin !== undefined) provenance.origin = data.origin;

    // Cast performer link → auto-classify when set (unless an explicit classification is given).
    let castClassification: string | null | undefined;
    if (data.castTalentId !== undefined) {
      castClassification = data.castTalentId ? await this.classificationForTalent(data.castTalentId) : null;
    }

    const updated = await this.prisma.budgetLineItem.update({
      where: { id: lineItemId },
      data: {
        ...provenance,
        ...(data.description !== undefined && { description: data.description }),
        ...(data.units !== undefined && { units: data.units }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.classificationCode !== undefined && { classificationCode: data.classificationCode || null }),
        ...(data.castTalentId !== undefined && { castTalentId: data.castTalentId || null }),
        ...(data.castTalentId !== undefined && data.classificationCode === undefined && castClassification != null && { classificationCode: castClassification }),
        ...(data.crewMemberId !== undefined && { crewMemberId: data.crewMemberId || null }),
        ...(data.stages !== undefined && { stages: Array.isArray(data.stages) ? data.stages : null }),
        quantityFormula,
        quantity: qty,
        rate,
        exchangeRate: fxRate,
        fringeProfileId,
        fringePct,
        subtotal,
        fringeAmount,
        total,
      },
    });

    await this.updateProjectTotal(item.account.section.budgetVersionId);
    return updated;
  }

  async deleteLineItem(lineItemId: string) {
    const item = await this.prisma.budgetLineItem.findUnique({
      where: { id: lineItemId },
      include: { account: { include: { section: true } } },
    });
    if (!item) throw new NotFoundException();
    await this.assertVersionEditable(item.account.section.budgetVersionId);
    await this.prisma.budgetLineItem.delete({ where: { id: lineItemId } });
    await this.updateProjectTotal(item.account.section.budgetVersionId);
  }

  // ── Calculation Engine ─────────────────────────────────────────────────────

  private buildGlobalsMap(globals: any[]): Record<string, number> {
    const map: Record<string, number> = {};
    for (const g of globals) map[g.key] = Number(g.value);
    return map;
  }

  async recalculateVersion(versionId: string) {
    const version = await this.prisma.budgetVersion.findUnique({
      where: { id: versionId },
      include: {
        globals: true,
        fringes: true,
        sections: { include: { accounts: { include: { lineItems: true } } } },
      },
    });
    if (!version) return;

    const globals = this.buildGlobalsMap(version.globals);

    for (const section of version.sections) {
      for (const account of section.accounts) {
        for (const item of account.lineItems) {
          if (!item.quantityFormula) continue;
          const qty = evaluateFormula(item.quantityFormula, globals);
          const subtotal = (qty * Number(item.rate)) / Number(item.exchangeRate);
          const fringeAmount = subtotal * (Number(item.fringePct) / 100);
          const total = subtotal + fringeAmount;
          await this.prisma.budgetLineItem.update({
            where: { id: item.id },
            data: { quantity: qty, subtotal, fringeAmount, total },
          });
        }
      }
    }

    await this.updateProjectTotal(versionId);
  }

  private async updateProjectTotal(versionId: string) {
    const version = await this.prisma.budgetVersion.findUnique({
      where: { id: versionId },
      include: { sections: { include: { accounts: { include: { lineItems: { select: { total: true } } } } } } },
    });
    if (!version) return;

    let grandTotal = 0;
    for (const section of version.sections) {
      for (const account of section.accounts) {
        for (const item of account.lineItems) {
          grandTotal += Number(item.total);
        }
      }
    }

    if (version.isActive) {
      await this.prisma.productionProject.update({
        where: { id: version.projectId },
        data: { totalBudget: grandTotal },
      });
    }
  }

  // ── Top Sheet ──────────────────────────────────────────────────────────────

  async getTopSheet(versionId: string) {
    const version = await this.getVersion(versionId);
    const topSheet = version.sections.map(section => {
      let sectionTotal = 0;
      const accounts = section.accounts.map(account => {
        let accountTotal = 0;
        for (const item of account.lineItems) accountTotal += Number(item.total);
        sectionTotal += accountTotal;
        return { code: account.code, title: account.title, total: accountTotal };
      });
      return { code: section.code, title: section.title, color: section.color, total: sectionTotal, accounts };
    });

    const grandTotal = topSheet.reduce((sum, s) => sum + s.total, 0);
    return { versionId, versionName: version.versionName, sections: topSheet, grandTotal };
  }

  // ── Budget vs Actual ─────────────────────────────────────────────────────────
  // Actuals come from approved/paid expenses tagged to this project (projectRef)
  // and matched to a budget account via productionAccountCode.

  async getBudgetVsActual(versionId: string) {
    const version = await this.getVersion(versionId);

    // Committed actuals for this project — from the project's own ledger (COSTs)
    const costs = await this.prisma.projectTransaction.findMany({
      where: {
        projectId: version.projectId,
        kind: 'COST',
        status: { in: ['APPROVED', 'PAID'] },
      },
      select: { accountCode: true, total: true, status: true },
    });

    const actualByCode: Record<string, number> = {};
    let totalActual = 0;
    for (const e of costs) {
      const amt = Number(e.total);
      totalActual += amt;
      const code = e.accountCode || '__unallocated__';
      actualByCode[code] = (actualByCode[code] || 0) + amt;
    }

    // Approved overages (budget changes) + line-to-line transfers → revised budget per code
    const [approvedOver, transfers] = await Promise.all([
      this.prisma.overage.findMany({ where: { projectId: version.projectId, status: 'APPROVED' as any }, select: { accountCode: true, amount: true } }),
      this.prisma.budgetTransfer.findMany({ where: { projectId: version.projectId, status: 'APPROVED' as any }, select: { fromCode: true, toCode: true, amount: true } }),
    ]);
    const approvedByCode: Record<string, number> = {};
    for (const o of approvedOver) { const c = o.accountCode || '__unallocated__'; approvedByCode[c] = (approvedByCode[c] || 0) + Number(o.amount); }
    const transferByCode: Record<string, number> = {};
    for (const tr of transfers) {
      const a = Number(tr.amount);
      transferByCode[tr.fromCode] = (transferByCode[tr.fromCode] || 0) - a;
      transferByCode[tr.toCode] = (transferByCode[tr.toCode] || 0) + a;
    }

    const matchedCodes = new Set<string>();
    const sections = version.sections.map(section => {
      let sectionBudget = 0;
      let sectionRevised = 0;
      let sectionActual = 0;
      const accounts = section.accounts.map(account => {
        let budget = 0;
        for (const item of account.lineItems) budget += Number(item.total);
        const actual = actualByCode[account.code] || 0;
        const transfer = transferByCode[account.code] || 0;
        const approvedChange = approvedByCode[account.code] || 0;
        const revisedBudget = budget + transfer + approvedChange;
        if (actualByCode[account.code] !== undefined) matchedCodes.add(account.code);
        sectionBudget += budget;
        sectionRevised += revisedBudget;
        sectionActual += actual;
        return {
          code: account.code,
          title: account.title,
          budget,
          transfer,
          approvedChange,
          revisedBudget,
          actual,
          variance: revisedBudget - actual,
          usedPct: revisedBudget > 0 ? Math.round((actual / revisedBudget) * 100) : (actual > 0 ? 999 : 0),
        };
      });
      return {
        code: section.code,
        title: section.title,
        color: section.color,
        budget: sectionBudget,
        revisedBudget: sectionRevised,
        actual: sectionActual,
        variance: sectionRevised - sectionActual,
        accounts,
      };
    });

    // Expenses whose code does not match any account (or have no code)
    const unallocated: { code: string; actual: number }[] = [];
    for (const [code, actual] of Object.entries(actualByCode)) {
      if (code === '__unallocated__') {
        unallocated.push({ code: 'Untagged', actual });
      } else if (!matchedCodes.has(code)) {
        unallocated.push({ code, actual });
      }
    }

    const grandBudget = sections.reduce((s, x) => s + x.budget, 0);
    const grandRevised = sections.reduce((s, x) => s + x.revisedBudget, 0);
    const grandActual = totalActual;

    return {
      versionId,
      versionName: version.versionName,
      sections,
      unallocated,
      grandBudget,
      grandRevised,
      grandActual,
      grandVariance: grandRevised - grandActual,
      generatedAt: new Date().toISOString(),
    };
  }
}
