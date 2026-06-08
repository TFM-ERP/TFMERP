import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BudgetService } from '../budget/budget.service';
import { AiMappingService } from './ai-mapping.service';
import { DynamicContextService } from '../context/dynamic-context.service';

// xml2js is loaded lazily via require so the build stays green even before `npm install xml2js`.
function loadXml2js(): any {
  try { return require('xml2js'); }
  catch { throw new BadRequestException('Movie Magic sync needs the "xml2js" package. In the backend folder run:  npm install xml2js'); }
}

const arr = (x: any): any[] => (x == null ? [] : Array.isArray(x) ? x : [x]);
const num = (x: any, d = 0) => { const n = Number(x); return Number.isFinite(n) ? n : d; };
// Industry (AICP/MM) numbering: 1000s ATL · 2000–4999 BTL · 5000s POST · 6000+ OTHER
const tierOf = (code?: string): string => {
  if (!code) return 'OTHER';
  if (code.startsWith('1')) return 'ATL';
  if (['2', '3', '4'].includes(code[0])) return 'BTL';
  if (code.startsWith('5')) return 'POST';
  return 'OTHER';
};

type NormLine = {
  description: string; quantity: any; rate: any;
  fringeAmount?: any; fringePct?: any;                       // Fix 1: legacy fringe capture
  subDetails?: { name: string; qty: any; rate: any }[];      // Fix 2: 4th-level sub-details
};
type NormSection = { code: string; title: string; accounts: { code: string; title: string; lines: NormLine[] }[] };
type MergeStrategy = 'NEW_VERSION' | 'UPDATE_ACTIVE';

@Injectable()
export class MovieMagicService {
  constructor(
    private prisma: PrismaService,
    private budget: BudgetService,
    private aiMapping: AiMappingService,
    private dynamicContext: DynamicContextService,
  ) {}

  async initializeFromImports(projectId: string, mmbFile?: any, mmsFile?: any, mergeStrategy?: string) {
    const out: any = {};
    if (mmbFile) out.budget = await this.importBudget(projectId, mmbFile, mergeStrategy as MergeStrategy);
    if (mmsFile) out.schedule = await this.importSchedule(projectId, mmsFile);
    return out;
  }

  private fileText(file: any): string {
    if (file?.buffer) return Buffer.from(file.buffer).toString('utf8');
    if (file?.path) return readFileSync(file.path, 'utf8');
    throw new BadRequestException('Empty upload.');
  }

  // ── IMPORT: Movie Magic Budgeting (.mmb/.xml or .csv) ─────────────────────────────
  // mergeStrategy:
  //   NEW_VERSION   (default) — deactivate existing versions, create a fresh active one
  //   UPDATE_ACTIVE           — non-destructive departmental upsert into the active
  //                             unlocked version: sections/accounts matched by code,
  //                             line items replaced ONLY inside accounts present in the file.
  async importBudget(projectId: string, file: any, mergeStrategy: MergeStrategy = 'NEW_VERSION') {
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const name = (file.originalname || '').toLowerCase();
    const text = this.fileText(file);
    const sections: NormSection[] = name.endsWith('.csv') ? this.parseBudgetCsv(text) : await this.parseBudgetXml(text);
    if (!sections.length) throw new BadRequestException('No budget categories found in the file — export from Movie Magic as XML or CSV.');

    // Resolve the target version per strategy. Budget ESTIMATE writes never touch
    // ProjectTransaction, so this is correctly outside the assertOpen() period guard.
    let version: any;
    if (mergeStrategy === 'UPDATE_ACTIVE') {
      version = await this.prisma.budgetVersion.findFirst({ where: { projectId, isActive: true } });
      if (!version) throw new BadRequestException('No active budget version to update — import as a new version instead.');
      if (version.status === 'LOCKED') throw new BadRequestException('The active budget is LOCKED. Create a working copy first, or import as a new version.');
    } else {
      await this.prisma.budgetVersion.updateMany({ where: { projectId }, data: { isActive: false } });
      version = await this.prisma.budgetVersion.create({
        data: { projectId, versionName: 'Movie Magic Import', status: 'WORKING', isActive: true },
      });
    }

    // Fix 1 — legacy fringe holding tank: one FringeProfile per DISTINCT fringe %
    // found in the file ("MMB Legacy Fringe 18.5%"). Lines keep their own pct/amount,
    // so later edits recompute against the matching profile instead of wiping values,
    // and imported totals match the Movie Magic file to the penny.
    const legacyPcts = new Set<number>();
    for (const s of sections) for (const a of s.accounts) for (const l of a.lines) {
      const { fringePct } = this.resolveFringe(l, this.lineSubtotal(l));
      if (fringePct > 0) legacyPcts.add(fringePct);
    }
    const profileByPct = new Map<number, string>();
    for (const pct of legacyPcts) {
      const pname = `MMB Legacy Fringe ${pct}%`;
      let profile = await this.prisma.fringeProfile.findFirst({ where: { budgetVersionId: version.id, name: pname } });
      if (!profile) {
        profile = await this.prisma.fringeProfile.create({
          data: {
            budgetVersionId: version.id, name: pname, percentage: pct,
            description: 'Imported from Movie Magic — replace with statutory fringe rules when ready.',
          },
        });
      }
      profileByPct.set(pct, profile.id);
    }

    // Existing structure (UPDATE_ACTIVE matches by code instead of recreating)
    const existingSections = mergeStrategy === 'UPDATE_ACTIVE'
      ? await this.prisma.budgetSection.findMany({ where: { budgetVersionId: version.id }, include: { accounts: true } })
      : [];
    const sectionByCode = new Map(existingSections.map((s) => [s.code, s]));

    let created = 0, accountsTouched = 0;
    for (const s of sections) {
      const sCode = s.code || 'OTHER';
      let section: any = sectionByCode.get(sCode);
      if (!section) {
        section = await this.prisma.budgetSection.create({
          data: { budgetVersionId: version.id, code: sCode, title: s.title || 'Section', tier: tierOf(s.code) },
        });
        section.accounts = [];
      }
      const accountByCode = new Map((section.accounts || []).map((a: any) => [a.code, a]));
      let ao = (section.accounts || []).length;
      for (const a of s.accounts) {
        const aCode = a.code || sCode + '00';
        let account: any = accountByCode.get(aCode);
        if (!account) {
          account = await this.prisma.budgetAccount.create({
            data: { sectionId: section.id, code: aCode, title: a.title || 'Account', sortOrder: ao++ },
          });
        } else if (mergeStrategy === 'UPDATE_ACTIVE') {
          // departmental replace: only line items inside accounts present in the file
          await this.prisma.budgetLineItem.deleteMany({ where: { accountId: account.id } });
        }
        accountsTouched++;
        if (a.lines.length) {
          await this.prisma.budgetLineItem.createMany({
            data: a.lines.map((l, i) => {
              // Fix 2 — 4th-level sub-details flatten into the stages JSON; the line
              // subtotal becomes the sum of stage amounts (matching MMB's roll-up).
              const subs = (l.subDetails || []).filter((sd) => sd && (num(sd.qty, 0) || num(sd.rate, 0)));
              const stages = subs.length
                ? subs.map((sd) => {
                    const q = num(sd.qty, 1), r0 = num(sd.rate, 0);
                    // `qty` (not quantity) is the key budget.service's stagesSubtotal() reads
                    return { stage: sd.name || 'Sub-detail', qty: q, unit: 'unit', rate: r0, amount: Math.round(q * r0 * 100) / 100 };
                  })
                : null;
              const qty = num(l.quantity, 1), rate = num(l.rate, 0);
              const subtotal = stages ? stages.reduce((t, x) => t + x.amount, 0) : qty * rate;
              const { fringePct, fringeAmount } = this.resolveFringe(l, subtotal);
              return {
                accountId: account.id, sortOrder: i, description: l.description || 'Line item',
                quantity: qty, rate, units: 'unit', currency: project.currency as any, exchangeRate: 1,
                fringePct, fringeProfileId: fringePct > 0 ? profileByPct.get(fringePct) || null : null,
                origin: 'MOVIE_MAGIC_IMPORT' as any,
                ...(stages ? { stages: stages as any } : {}), // Json? fields reject plain null
                subtotal, fringeAmount, total: subtotal + fringeAmount,
              };
            }),
          });
          created += a.lines.length;
        }
      }
    }
    await this.recalc(projectId, version.id);
    return {
      versionId: version.id, strategy: mergeStrategy,
      sections: sections.length, accounts: accountsTouched, lineItems: created,
      legacyFringeProfiles: [...legacyPcts].map((p) => `MMB Legacy Fringe ${p}%`),
    };
  }

  // ── AI-REVIEWED IMPORT (two-step, approval-gated) ─────────────────────────────────
  // Step 1 (preview): parse the MMB file, run aiMapBudgetLines, return suggestions.
  //   WRITES NOTHING — the parsed lines + AI suggestions go to the frontend for review.
  // Step 2 (confirm): receive the human-approved lines, clone the active version
  //   (branching LOCKED baselines instead of touching them) and inject the lines
  //   into the new WORKING copy. The legacy direct import endpoints stay unchanged.

  /** Step 1 — parse + AI-map. No database writes. */
  async previewImportWithAi(projectId: string, file: any) {
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const name = (file.originalname || '').toLowerCase();
    const text = this.fileText(file);
    const sections: NormSection[] = name.endsWith('.csv') ? this.parseBudgetCsv(text) : await this.parseBudgetXml(text);
    if (!sections.length) throw new BadRequestException('No budget categories found in the file — export from Movie Magic as XML or CSV.');

    // Flatten to reviewable lines with stable ids the AI must echo back
    let n = 0;
    const lines: any[] = [];
    for (const s of sections) for (const a of s.accounts) for (const l of a.lines) {
      const subtotal = Math.round(this.lineSubtotal(l) * 100) / 100;
      const { fringePct, fringeAmount } = this.resolveFringe(l, subtotal);
      const subs = (l.subDetails || []).filter((sd) => sd && (num(sd.qty, 0) || num(sd.rate, 0)));
      lines.push({
        originalLineId: `L${++n}`,
        sectionCode: s.code || 'OTHER', sectionTitle: s.title || 'Section',
        externalCode: a.code || null, accountTitle: a.title || null,
        description: l.description || 'Line item',
        quantity: num(l.quantity, 1), rate: num(l.rate, 0),
        fringePct, fringeAmount, subtotal, total: Math.round((subtotal + fringeAmount) * 100) / 100,
        stages: subs.length ? subs.map((sd) => {
          const q = num(sd.qty, 1), r0 = num(sd.rate, 0);
          return { stage: sd.name || 'Sub-detail', qty: q, unit: 'unit', rate: r0, amount: Math.round(q * r0 * 100) / 100 };
        }) : null,
      });
    }
    if (!lines.length) throw new BadRequestException('The file parsed but contains no line items.');

    // AI mapping (suggestions only) + the master CoA list for the override dropdown
    const ai = await this.aiMapping.aiMapBudgetLines(
      projectId,
      lines.map((l) => ({ originalLineId: l.originalLineId, externalCode: l.externalCode, description: l.description, amount: l.total, category: `${l.sectionCode} ${l.sectionTitle}` })),
    );
    let masterAccounts: { code: string; title: string | null }[] = [];
    try { masterAccounts = JSON.parse(await this.dynamicContext.buildProjectContext(projectId))?.coa?.accounts || []; } catch { /* dropdown degrades gracefully */ }

    return { fileName: file.originalname || null, lines, ai, masterAccounts, note: 'Preview only — nothing has been imported yet.' };
  }

  /** Step 2 — approved lines → clone the active version → inject into the WORKING copy. */
  async confirmAiImport(projectId: string, body: { versionName?: string; lines: any[] }) {
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    const approved = (body?.lines || []).filter((l) => l?.masterCode && l?.description);
    if (!approved.length) throw new BadRequestException('No approved lines with a master account code were provided.');

    // Branch the baseline: LOCKED/APPROVED versions are never written — we clone.
    const active = await this.prisma.budgetVersion.findFirst({ where: { projectId, isActive: true } });
    let version: any;
    if (active) {
      version = await this.budget.cloneVersion(active.id, { versionName: body?.versionName || 'MM Import (AI-mapped)' });
    } else {
      version = await this.prisma.budgetVersion.create({
        data: { projectId, versionName: body?.versionName || 'MM Import (AI-mapped)', status: 'WORKING', isActive: false },
      });
    }
    await this.budget.setActiveVersion(version.id); // the new WORKING copy becomes the active budget

    // Resolve target accounts in the clone by master code
    const cloneSections = await this.prisma.budgetSection.findMany({
      where: { budgetVersionId: version.id }, include: { accounts: true },
    });
    const accountByCode = new Map<string, any>();
    for (const s of cloneSections) for (const a of s.accounts) accountByCode.set(a.code, a);

    let importSection: any = null; // lazy fallback for codes missing from the clone
    const ensureAccount = async (code: string) => {
      const hit = accountByCode.get(code);
      if (hit) return hit;
      if (!importSection) {
        importSection = cloneSections.find((s) => s.code === 'IMPORT')
          || await this.prisma.budgetSection.create({ data: { budgetVersionId: version.id, code: 'IMPORT', title: 'Imported (unmatched accounts)', tier: tierOf(code) } });
      }
      const created = await this.prisma.budgetAccount.create({ data: { sectionId: importSection.id, code, title: `Account ${code}`, sortOrder: accountByCode.size } });
      accountByCode.set(code, created);
      return created;
    };

    let createdCount = 0; const touched = new Set<string>(); const unmatched = new Set<string>();
    for (const l of approved) {
      const code = String(l.masterCode);
      if (!accountByCode.has(code)) unmatched.add(code);
      const account = await ensureAccount(code);
      const qty = num(l.quantity, 1), rate = num(l.rate, 0);
      const subtotal = l.stages?.length ? l.stages.reduce((t: number, x: any) => t + num(x.amount, 0), 0) : qty * rate;
      const fringeAmount = num(l.fringeAmount, 0);
      const sortOrder = await this.prisma.budgetLineItem.count({ where: { accountId: account.id } });
      await this.prisma.budgetLineItem.create({
        data: {
          accountId: account.id, sortOrder, description: l.description,
          quantity: qty, rate, units: 'unit', currency: project.currency as any, exchangeRate: 1,
          fringePct: num(l.fringePct, 0), origin: 'MOVIE_MAGIC_IMPORT' as any,
          ...(l.stages?.length ? { stages: l.stages as any } : {}),
          subtotal: Math.round(subtotal * 100) / 100, fringeAmount,
          total: Math.round((subtotal + fringeAmount) * 100) / 100,
          notes: [l.vatTreatment ? `VAT: ${l.vatTreatment}` : null, l.externalCode ? `MM code: ${l.externalCode}` : null].filter(Boolean).join(' · ') || null,
        },
      });
      createdCount++; touched.add(code);
    }
    await this.recalc(projectId, version.id);

    return {
      versionId: version.id, versionName: version.versionName,
      branchedFrom: active ? { id: active.id, name: active.versionName, status: active.status } : null,
      linesCreated: createdCount, accountsTouched: touched.size,
      unmatchedCodes: [...unmatched], // landed in the "IMPORT" section — review them
    };
  }

  /** Subtotal of a parsed line — sum of sub-detail amounts when present, else qty × rate. */
  private lineSubtotal(l: NormLine): number {
    const subs = (l.subDetails || []).filter((sd) => sd && (num(sd.qty, 0) || num(sd.rate, 0)));
    if (subs.length) return subs.reduce((t, sd) => t + Math.round(num(sd.qty, 1) * num(sd.rate, 0) * 100) / 100, 0);
    return num(l.quantity, 1) * num(l.rate, 0);
  }

  /** Normalise legacy fringe figures: derive pct from amount (and vice versa). */
  private resolveFringe(l: NormLine, subtotal?: number): { fringePct: number; fringeAmount: number } {
    let amount = Number(l.fringeAmount);
    let pct = Number(l.fringePct);
    const sub = subtotal ?? num(l.quantity, 1) * num(l.rate, 0);
    if (!Number.isFinite(amount) && Number.isFinite(pct)) amount = (sub * pct) / 100;
    if (!Number.isFinite(pct) && Number.isFinite(amount) && sub > 0) pct = (amount / sub) * 100;
    if (!Number.isFinite(amount)) amount = 0;
    if (!Number.isFinite(pct)) pct = 0;
    return { fringePct: Math.round(pct * 100) / 100, fringeAmount: Math.round(amount * 100) / 100 };
  }

  // MMB XML: Budget → CategoryList/Category (Section) → AccountList/Account → DetailList/Detail
  private async parseBudgetXml(text: string): Promise<NormSection[]> {
    const xml2js = loadXml2js();
    const r = await new xml2js.Parser({ explicitArray: false }).parseStringPromise(text);
    const root = r.Budget || r.budget || r;
    const cats = arr(root?.CategoryList?.Category ?? root?.Categories?.Category ?? root?.Category);
    return cats.map((cat: any) => ({
      code: String(cat.Number ?? cat.Code ?? cat.Acct ?? ''),
      title: String(cat.Description ?? cat.Title ?? cat.Name ?? 'Section'),
      accounts: arr(cat?.AccountList?.Account ?? cat?.Accounts?.Account ?? cat?.Account).map((acc: any) => ({
        code: String(acc.Number ?? acc.Code ?? ''),
        title: String(acc.Description ?? acc.Title ?? 'Account'),
        lines: arr(acc?.DetailList?.Detail ?? acc?.Details?.Detail ?? acc?.Detail).map((det: any) => ({
          description: String(det.Description ?? det.Name ?? 'Detail'),
          quantity: det.Amount ?? det.Quantity ?? det.Units ?? 1,
          rate: det.Rate ?? det.X ?? det.Cost ?? 0,
          // Fix 1: legacy fringe figures travel with the line
          fringeAmount: det.Fringe ?? det.Fringes ?? det.FringeAmount ?? det.FringeTotal ?? null,
          fringePct: det.FringePct ?? det.FringePercent ?? det.FringeRate ?? null,
          // Fix 2: 4th-level sub-details (MMB allows details under details)
          subDetails: arr(det?.SubDetailList?.SubDetail ?? det?.SubDetails?.SubDetail ?? det?.DetailList?.Detail).map((sd: any) => ({
            name: String(sd.Description ?? sd.Name ?? 'Sub-detail'),
            qty: sd.Amount ?? sd.Quantity ?? sd.Units ?? 1,
            rate: sd.Rate ?? sd.X ?? sd.Cost ?? 0,
          })),
        })),
      })),
    }));
  }

  // CSV: flat rows. Recognised headers (case-insensitive): Section/Category, Section Title,
  // Account/Acct/Number, Account Title, Description/Detail, Quantity/Amount, Rate/Cost.
  private parseBudgetCsv(text: string): NormSection[] {
    const rows = this.csvRows(text);
    if (rows.length < 2) return [];
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (names: string[]) => { for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; } return -1; };
    const ci = {
      sec: idx(['section', 'category', 'cat', 'section code']),
      secT: idx(['section title', 'category title', 'section name']),
      acc: idx(['account', 'acct', 'account code', 'number']),
      accT: idx(['account title', 'account name']),
      desc: idx(['detail', 'line', 'line description', 'item', 'description']),
      qty: idx(['quantity', 'qty', 'amount', 'units']),
      rate: idx(['rate', 'x', 'cost', 'unit cost', 'price']),
      fr: idx(['fringe', 'fringes', 'fringe amount', 'fringe total']),
      frPct: idx(['fringe %', 'fringe pct', 'fringepct', 'fringe percent', 'fringe rate']),
    };
    const order: NormSection[] = [];
    const secMap = new Map<string, any>();
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]; if (!row || row.every((c) => !String(c).trim())) continue;
      const get = (i: number) => (i >= 0 && row[i] != null ? String(row[i]).trim() : '');
      const secCode = get(ci.sec) || 'OTHER';
      const secTitle = get(ci.secT) || secCode;
      const accCode = get(ci.acc) || secCode + '00';
      const accTitle = get(ci.accT) || get(ci.desc) || accCode;
      const desc = get(ci.desc) || accTitle;
      let sec = secMap.get(secCode);
      if (!sec) { sec = { code: secCode, title: secTitle, _acc: new Map(), accounts: [] }; secMap.set(secCode, sec); order.push(sec); }
      let acc = sec._acc.get(accCode);
      if (!acc) { acc = { code: accCode, title: accTitle, lines: [] }; sec._acc.set(accCode, acc); sec.accounts.push(acc); }
      acc.lines.push({
        description: desc,
        quantity: ci.qty >= 0 ? row[ci.qty] : 1,
        rate: ci.rate >= 0 ? row[ci.rate] : 0,
        fringeAmount: ci.fr >= 0 ? row[ci.fr] : null,
        fringePct: ci.frPct >= 0 ? row[ci.frPct] : null,
      });
    }
    return order.map((s) => ({ code: s.code, title: s.title, accounts: s.accounts }));
  }

  // Minimal RFC-4180-ish CSV reader (handles quoted fields, escaped quotes, CRLF).
  private csvRows(text: string): string[][] {
    const rows: string[][] = []; let cur: string[] = []; let field = ''; let inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else if (c !== '\r') field += c;
    }
    if (field.length || cur.length) { cur.push(field); rows.push(cur); }
    return rows;
  }

  // ── IMPORT: Movie Magic Scheduling (.sex) ─────────────────────────────────────────
  async importSchedule(projectId: string, file: any) {
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new NotFoundException('Project not found');
    const xml2js = loadXml2js();
    const r = await new xml2js.Parser({ explicitArray: false }).parseStringPromise(this.fileText(file));
    const root = r.Schedule || r.schedule || r;
    const strips = arr(root?.Boneyard?.Strip ?? root?.Board?.Strip ?? root?.StripList?.Strip ?? root?.Strip);

    let stripCount = 0, elCount = 0, order = 0;
    for (const st of strips) {
      const ie = String(st.IntExt ?? st.IE ?? 'INT').toUpperCase();
      const dn = String(st.DayNight ?? st.DN ?? 'DAY').toUpperCase();
      const createdStrip = await this.prisma.productionStrip.create({
        data: {
          projectId,
          sceneNumber: st.SceneNumber != null ? String(st.SceneNumber) : (st.Scene != null ? String(st.Scene) : null),
          setName: st.Set ?? st.SetName ?? st.Setting ?? null,
          location: st.Location ?? null,
          description: st.Description ?? st.Synopsis ?? null,
          intExt: ie.includes('INT') && ie.includes('EXT') ? 'INT_EXT' : ie.startsWith('EXT') ? 'EXT' : 'INT',
          dayNight: dn.startsWith('NIGHT') ? 'NIGHT' : dn.startsWith('DUSK') ? 'DUSK' : dn.startsWith('DAWN') ? 'DAWN' : 'DAY',
          pages: this.parsePages(st.Pages ?? st.PageCount ?? st.Eighths),
          shootDay: num(st.ShootDay ?? st.Day, 0),
          sortOrder: order++,
          cast: arr(st?.CastList?.Cast ?? st?.Cast).map((c: any) => (typeof c === 'string' ? c : (c?.Name ?? c?._ ?? ''))).filter(Boolean),
        },
      });
      stripCount++;
      const els = arr(st?.ElementList?.Element ?? st?.Elements?.Element ?? st?.Element);
      if (els.length) {
        await this.prisma.breakdownElement.createMany({
          data: els.map((el: any) => ({
            projectId, stripId: createdStrip.id,
            category: this.mapMmsCategoryToInternal(String(el.Category ?? el.Type ?? 'OTHER')) as any,
            name: String(el.Name ?? el._ ?? el.Description ?? 'Element'),
            quantity: num(el.Quantity ?? el.Count, 1),
          })),
        });
        elCount += els.length;
      }
    }
    return { strips: stripCount, elements: elCount };
  }

  private parsePages(p: any): number {
    if (p == null) return 0;
    const s = String(p).trim();
    const frac = s.match(/^(\d+)?\s*(\d+)\/(\d+)$/); // "2 3/8"
    if (frac) return num(frac[1], 0) + num(frac[2]) / num(frac[3], 1);
    return num(s, 0);
  }

  // ── EXPORT: budget → MMB XML ──────────────────────────────────────────────────────
  async exportBudgetToMMB(projectId: string): Promise<string> {
    const version = await this.prisma.budgetVersion.findFirst({
      where: { projectId, isActive: true },
      include: { sections: { orderBy: { sortOrder: 'asc' }, include: { accounts: { orderBy: { sortOrder: 'asc' }, include: { lineItems: true } } } } },
    });
    if (!version) throw new BadRequestException('No active budget version to export.');
    const xml2js = loadXml2js();
    const builder = new xml2js.Builder({ rootName: 'Budget' });
    return builder.buildObject({
      CategoryList: {
        Category: version.sections.map((s) => ({
          Number: s.code, Description: s.title,
          AccountList: {
            Account: s.accounts.map((a) => ({
              Number: a.code, Description: a.title,
              DetailList: {
                Detail: a.lineItems.map((i) => ({
                  Description: i.description, Amount: Number(i.quantity), Rate: Number(i.rate),
                  Subtotal: Number(i.subtotal), Total: Number(i.total),
                })),
              },
            })),
          },
        })),
      },
    });
  }

  // ── EXPORT: schedule → .sex XML ─────────────────────────────────────────────────────
  async exportScheduleToSEX(projectId: string): Promise<string> {
    const strips = await this.prisma.productionStrip.findMany({
      where: { projectId }, orderBy: [{ shootDay: 'asc' }, { sortOrder: 'asc' }], include: { elements: true },
    });
    const xml2js = loadXml2js();
    const builder = new xml2js.Builder({ rootName: 'Schedule' });
    return builder.buildObject({
      Boneyard: {
        Strip: strips.map((st) => ({
          SceneNumber: st.sceneNumber || '', Set: st.setName || '', IntExt: st.intExt, DayNight: st.dayNight,
          Pages: Number(st.pages), ShootDay: st.shootDay,
          ElementList: { Element: st.elements.map((el) => ({ Category: this.mapInternalToMms(el.category), Name: el.name })) },
        })),
      },
    });
  }

  private async recalc(projectId: string, versionId: string) {
    const fresh = await this.prisma.budgetVersion.findUnique({
      where: { id: versionId },
      include: { sections: { include: { accounts: { include: { lineItems: { select: { total: true } } } } } } },
    });
    let grand = 0;
    for (const s of fresh!.sections) for (const a of s.accounts) for (const i of a.lineItems) grand += Number(i.total);
    await this.prisma.productionProject.update({ where: { id: projectId }, data: { totalBudget: grand } });
  }

  private mapMmsCategoryToInternal(c: string): string {
    const m: Record<string, string> = {
      cast: 'CAST', 'background actors': 'BACKGROUND', background: 'BACKGROUND', extras: 'BACKGROUND',
      stunts: 'STUNTS', vehicles: 'VEHICLES', 'picture vehicles': 'VEHICLES', animals: 'ANIMALS', props: 'PROPS',
      'set dressing': 'SET_DRESSING', wardrobe: 'WARDROBE', makeup: 'MAKEUP_HAIR', 'makeup/hair': 'MAKEUP_HAIR', hair: 'MAKEUP_HAIR',
      'special effects': 'SFX', sfx: 'SFX', 'visual effects': 'VFX', vfx: 'VFX', 'special equipment': 'SPECIAL_EQUIPMENT',
      sound: 'SOUND_MUSIC', music: 'SOUND_MUSIC', 'sound / music': 'SOUND_MUSIC', 'art department': 'ART', greenery: 'GREENERY', security: 'SECURITY',
      // full 22-category MMS standard (Master cost numbers doc)
      cameras: 'CAMERA', camera: 'CAMERA', 'additional labor': 'ADDITIONAL_LABOR', 'additional labour': 'ADDITIONAL_LABOR',
      'mechanical effects': 'MECHANICAL_FX', 'animal wrangler': 'ANIMAL_WRANGLER', 'animal wranglers': 'ANIMAL_WRANGLER',
      miscellaneous: 'OTHER', 'notes / scene notes': 'OTHER', notes: 'OTHER',
    };
    return m[String(c).trim().toLowerCase()] || 'OTHER';
  }
  private mapInternalToMms(c: string): string {
    const m: Record<string, string> = {
      CAST: 'Cast', BACKGROUND: 'Background Actors', STUNTS: 'Stunts', VEHICLES: 'Vehicles', ANIMALS: 'Animals',
      PROPS: 'Props', SET_DRESSING: 'Set Dressing', WARDROBE: 'Wardrobe', MAKEUP_HAIR: 'Makeup/Hair',
      SFX: 'Special Effects', MECHANICAL_FX: 'Mechanical Effects', VFX: 'Visual Effects', SPECIAL_EQUIPMENT: 'Special Equipment',
      CAMERA: 'Cameras', ADDITIONAL_LABOR: 'Additional Labor', ANIMAL_WRANGLER: 'Animal Wrangler', SOUND_MUSIC: 'Sound',
      ART: 'Art Department', GREENERY: 'Greenery', SECURITY: 'Security', OTHER: 'Miscellaneous',
    };
    return m[c] || 'Miscellaneous';
  }
}
