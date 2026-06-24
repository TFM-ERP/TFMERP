import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CostingService } from '../costing/costing.service';

/** SYS-FIN — canonical production-accounting reports (the studio "report catalog" core). */
const n = (v: any) => Number(v) || 0;
const sum = (rows: any[], k: string) => rows.reduce((t, r) => t + (Number(r[k]) || 0), 0);
const OPEN_PO = ['APPROVED', 'PARTIALLY_INVOICED'];

@Injectable()
export class ProductionReportsService {
  constructor(private prisma: PrismaService, private costing: CostingService) {}

  /** Purchase Order Log — every PO with committed/invoiced/remaining + open-commitment total. */
  async poLog(projectId: string) {
    const pos = await this.prisma.purchaseOrder.findMany({ where: { projectId }, orderBy: { date: 'desc' } });
    const rows = pos.map(p => ({
      poNumber: p.poNumber, date: p.date, vendor: p.vendorName,
      costCenter: [p.costCenterCode, p.costCenterTitle].filter(Boolean).join(' · '),
      description: p.description, total: n(p.total), invoiced: n(p.invoicedAmount),
      remaining: n(p.total) - n(p.invoicedAmount), status: p.status,
    }));
    return { rows, totals: {
      count: rows.length, total: sum(rows, 'total'), invoiced: sum(rows, 'invoiced'),
      committed: rows.filter(r => OPEN_PO.includes(r.status)).reduce((t, r) => t + r.remaining, 0),
    } };
  }

  /** Payroll Register — posted/pending timecards with gross + fringe + burdened total. */
  async payrollRegister(projectId: string, period?: string) {
    const tcs = await this.prisma.timecard.findMany({ where: { projectId }, orderBy: [{ weekEnding: 'desc' }, { name: 'asc' }] });
    let rows = tcs.map(t => ({
      name: t.name, role: t.role, weekEnding: t.weekEnding, accountCode: t.accountCode,
      days: n(t.days), dailyRate: n(t.dailyRate), gross: n(t.gross), fringe: n(t.fringe), total: n(t.total), status: t.status,
    }));
    if (period) rows = rows.filter(r => r.weekEnding && new Date(r.weekEnding).toISOString().slice(0, 7) === period);
    return { rows, totals: {
      count: rows.length, gross: sum(rows, 'gross'), fringe: sum(rows, 'fringe'), total: sum(rows, 'total'),
      posted: rows.filter(r => r.status === 'POSTED').reduce((t, r) => t + r.total, 0),
      pending: rows.filter(r => r.status !== 'POSTED').reduce((t, r) => t + r.total, 0),
    } };
  }

  /** Petty Cash Reconciliation — each float's opening + top-ups − spends = balance. */
  async pettyCash(projectId: string) {
    const floats = await this.prisma.pettyCashFloat.findMany({ where: { projectId }, include: { transactions: true }, orderBy: { createdAt: 'desc' } });
    const rows = floats.map(f => {
      let topups = 0, spends = 0;
      for (const t of f.transactions) (t.type === 'TOPUP' ? (topups += n(t.amount)) : (spends += n(t.amount)));
      return { holder: f.holder, currency: f.currency, opening: n(f.openingAmount), topups, spends, balance: n(f.openingAmount) + topups - spends, txnCount: f.transactions.length, status: f.status };
    });
    return { rows, totals: { floats: rows.length, opening: sum(rows, 'opening'), topups: sum(rows, 'topups'), spends: sum(rows, 'spends'), balance: sum(rows, 'balance') } };
  }

  /** Vendor YTD (1099) — total approved/paid cost per vendor. */
  async vendorYtd(projectId: string) {
    const costs = await this.prisma.projectTransaction.findMany({ where: { projectId, kind: 'COST', status: { in: ['APPROVED', 'PAID'] } }, select: { vendorId: true, party: true, total: true, status: true } });
    const by: Record<string, any> = {};
    for (const c of costs) {
      const key = c.vendorId || c.party || '—';
      const r = by[key] || (by[key] = { vendor: c.party || '—', paid: 0, approved: 0, total: 0 });
      const v = n(c.total); r.total += v; if (c.status === 'PAID') r.paid += v; else r.approved += v;
    }
    const rows = Object.values(by).sort((a: any, b: any) => b.total - a.total);
    return { rows, totals: { vendors: rows.length, paid: sum(rows, 'paid'), approved: sum(rows, 'approved'), total: sum(rows, 'total') } };
  }


  // ── SYS-FIN parity reports (added for EP/Vista report-catalog parity) ────────────
  /** Cost to Complete — per account: revised budget, actual, committed, CTC (ETC), EFC. */
  async costToComplete(projectId: string) {
    const cr: any = await this.costing.costReport(projectId);
    const rows: any[] = [];
    for (const s of cr.sections || []) for (const a of s.accounts || []) rows.push({ code: a.code, title: a.title, section: s.title, revisedBudget: n(a.revisedBudget), actual: n(a.actual), committed: n(a.committed), ctc: n(a.etc), efc: n(a.efc) });
    return { rows, totals: { accounts: rows.length, revisedBudget: sum(rows, 'revisedBudget'), actual: sum(rows, 'actual'), committed: sum(rows, 'committed'), ctc: sum(rows, 'ctc'), efc: sum(rows, 'efc') }, currency: cr.currency };
  }

  /** Cost Overage — only accounts whose EFC exceeds the revised budget (variance < 0). */
  async costOverage(projectId: string) {
    const cr: any = await this.costing.costReport(projectId);
    const rows: any[] = [];
    for (const s of cr.sections || []) for (const a of s.accounts || []) if (n(a.variance) < -0.01) rows.push({ code: a.code, title: a.title, section: s.title, revisedBudget: n(a.revisedBudget), efc: n(a.efc), overage: -n(a.variance) });
    rows.sort((x, y) => y.overage - x.overage);
    return { rows, totals: { accounts: rows.length, overage: sum(rows, 'overage') }, currency: cr.currency };
  }

  /** Weekly Cost Report ("the Green") — account · revised budget · cost-to-date · CTC · EFC · variance, with section subtotals. */
  async weeklyGreen(projectId: string) {
    const cr: any = await this.costing.costReport(projectId);
    const rows: any[] = [];
    for (const s of cr.sections || []) {
      for (const a of s.accounts || []) rows.push({ code: a.code, account: a.title, revisedBudget: n(a.revisedBudget), costToDate: n(a.actual), ctc: n(a.etc), efc: n(a.efc), variance: n(a.variance) });
      rows.push({ code: '', account: `${s.title} — subtotal`, revisedBudget: n(s.revisedBudget), costToDate: n(s.actual), ctc: n(s.efc) - n(s.actual), efc: n(s.efc), variance: n(s.variance), subtotal: true });
    }
    return { rows, totals: { revisedBudget: n(cr.totals?.revisedBudget), costToDate: n(cr.totals?.actual), efc: n(cr.totals?.efc), variance: n(cr.totals?.variance) }, currency: cr.currency };
  }

  /** Check / Disbursement Register — every paid COST with payee, ref, account, amount. */
  async checkRegister(projectId: string) {
    const txns = await this.prisma.projectTransaction.findMany({ where: { projectId, kind: 'COST', paidDate: { not: null } }, orderBy: { paidDate: 'desc' } });
    const rows = txns.map((t: any) => ({ date: t.paidDate, payee: t.party || '—', reference: t.reference || t.invoiceNumber || '—', account: [t.accountCode, t.accountTitle].filter(Boolean).join(' · '), amount: n(t.paidAmount ?? t.total), posted: !!t.journalEntryId }));
    return { rows, totals: { checks: rows.length, amount: sum(rows, 'amount') } };
  }

  /** Fringe / Burden Detail — every budget line carrying employer burden (fringe). */
  async fringeDetail(projectId: string) {
    const version = await this.prisma.budgetVersion.findFirst({ where: { projectId, isActive: true }, include: { sections: { include: { accounts: { include: { lineItems: true } } } } } });
    const rows: any[] = [];
    for (const s of version?.sections || []) for (const a of s.accounts) for (const li of a.lineItems) if (n(li.fringeAmount) > 0) rows.push({ account: a.title, description: li.description, subtotal: n(li.subtotal), fringePct: n(li.fringePct), fringeAmount: n(li.fringeAmount), total: n(li.total) });
    return { rows, totals: { lines: rows.length, subtotal: sum(rows, 'subtotal'), fringeAmount: sum(rows, 'fringeAmount'), total: sum(rows, 'total') } };
  }

  /** 1099 Box Totals — vendor cost grouped into the 1099 box (Rents vs Nonemployee comp). */
  async box1099(projectId: string) {
    const costs = await this.prisma.projectTransaction.findMany({ where: { projectId, kind: 'COST', status: { in: ['APPROVED', 'PAID'] } }, select: { party: true, vendorId: true, total: true, category: true, accountTitle: true } });
    const boxOf = (c: any) => /rent|lease|location fee/.test(`${c.category || ''} ${c.accountTitle || ''}`.toLowerCase()) ? 'Box 1 — Rents' : 'Box 1 — Nonemployee comp (NEC)';
    const by = new Map<string, any>();
    for (const c of costs) { const b = boxOf(c); const key = `${c.vendorId || c.party || '—'}|${b}`; const r = by.get(key) || by.set(key, { vendor: c.party || '—', box: b, total: 0 }).get(key); r.total += n(c.total); }
    const rows = [...by.values()].sort((a, b) => b.total - a.total);
    const byBox: Record<string, number> = {}; for (const r of rows) byBox[r.box] = (byBox[r.box] || 0) + r.total;
    return { rows, totals: { vendors: rows.length, total: sum(rows, 'total'), byBox } };
  }

  /** GL Trial Balance — posted journal lines for this project's GL entries, by account. */
  async trialBalance(projectId: string) {
    const txns = await this.prisma.projectTransaction.findMany({ where: { projectId, journalEntryId: { not: null } }, select: { journalEntryId: true } });
    let entryIds = Array.from(new Set(txns.map((t: any) => t.journalEntryId).filter(Boolean))) as string[];
    if (entryIds.length) { const posted = await this.prisma.journalEntry.findMany({ where: { id: { in: entryIds }, status: 'POSTED' as any }, select: { id: true } }); entryIds = posted.map((e: any) => e.id); }
    const lines = entryIds.length ? await this.prisma.journalLine.findMany({ where: { entryId: { in: entryIds } }, include: { account: true } }) : [];
    const by = new Map<string, any>();
    for (const l of lines as any[]) { const a = l.account; if (!a) continue; const r = by.get(a.code) || by.set(a.code, { code: a.code, name: a.name, type: a.type, debit: 0, credit: 0 }).get(a.code); r.debit += n(l.debit); r.credit += n(l.credit); }
    const rows = [...by.values()].sort((a, b) => String(a.code).localeCompare(String(b.code))).map((r) => ({ ...r, balance: r.debit - r.credit }));
    return { rows, totals: { accounts: rows.length, debit: sum(rows, 'debit'), credit: sum(rows, 'credit'), balanced: Math.abs(sum(rows, 'debit') - sum(rows, 'credit')) < 0.01 } };
  }


  /** AICP bid view — regroup the active budget into AICP lettered sections (indicative keyword map). */
  async aicpBid(projectId: string) {
    const cr: any = await this.costing.costReport(projectId).catch(() => null);
    const AICP: { letter: string; name: string; kw: string[] }[] = [
      { letter: 'A', name: 'Preproduction & wrap', kw: ['prep', 'pre-pro', 'preproduction', 'wrap', 'development'] },
      { letter: 'B', name: 'Shooting crew', kw: ['crew', 'grip', 'electric', 'gaffer', 'camera crew'] },
      { letter: 'D', name: 'Location', kw: ['location', 'permit', 'scout'] },
      { letter: 'E', name: 'Props / wardrobe / animals', kw: ['prop', 'wardrobe', 'costume', 'animal', 'makeup', 'hair', 'set dressing'] },
      { letter: 'F', name: 'Studio / stage', kw: ['studio', 'stage', 'set rental'] },
      { letter: 'G', name: 'Art department', kw: ['art', 'set design', 'scenic', 'construction', 'build'] },
      { letter: 'I', name: 'Equipment', kw: ['equipment', 'camera rental', 'lighting', 'grip package', 'lens', 'rental'] },
      { letter: 'K', name: 'Production / misc', kw: ['misc', 'office', 'petty', 'expendable', 'catering', 'transport', 'travel', 'accommodation', 'per diem'] },
      { letter: 'M', name: 'Director / creative fees', kw: ['director', 'creative fee', 'treatment', 'producer', 'markup', 'production company'] },
      { letter: 'N', name: 'Insurance', kw: ['insurance', 'bond'] },
      { letter: 'P', name: 'Talent', kw: ['talent', 'cast', 'actor', 'performer', 'voice', 'sag', 'buyout', 'usage', 'extras', 'background'] },
      { letter: 'T', name: 'Post / finishing', kw: ['post', 'edit', 'online', 'offline', 'grade', 'colour', 'color', 'vfx', 'finishing', 'mix', 'sound', 'music', 'conform'] },
    ];
    const bucket: Record<string, number> = {}; const names: Record<string, string> = {};
    for (const a of AICP) { bucket[a.letter] = 0; names[a.letter] = a.name; }
    let unmapped = 0;
    const classify = (title: string) => { const t = String(title || '').toLowerCase(); for (const a of AICP) if (a.kw.some((k) => t.includes(k))) return a.letter; return null; };
    for (const s of (cr?.sections || [])) for (const acc of (s.accounts || [])) {
      const amt = n(acc.revisedBudget);
      if (!amt) continue;
      const letter = classify(`${acc.title} ${s.title}`);
      if (letter) bucket[letter] += amt; else unmapped += amt;
    }
    const rows = AICP.filter((a) => bucket[a.letter] > 0).map((a) => ({ section: `${a.letter} — ${a.name}`, total: bucket[a.letter] }));
    if (unmapped > 0) rows.push({ section: 'Z — Unmapped', total: unmapped });
    const grand = rows.reduce((t, r) => t + r.total, 0);
    return { rows, totals: { sections: rows.length, total: grand }, currency: cr?.currency, note: 'Indicative AICP grouping by keyword — review before submitting to an agency.' };
  }

  /** Report index — what the production-accounting module exposes, grouped. */
  catalog() {
    return { reports: [
      { key: 'cost-report', name: 'Cost Report (EFC)', group: 'Cost control', endpoint: '/production/costing/report/:projectId', status: 'live' },
      { key: 'forecast', name: 'Forecast — schedule/burn EFC', group: 'Cost control', endpoint: '/production/costing/forecast/:projectId', status: 'live' },
      { key: 'cashflow', name: 'Cash-Flow Forecast (weekly)', group: 'Cost control', endpoint: '/production/costing/cashflow/:projectId', status: 'live' },
      { key: 'finance-summary', name: 'Finance Summary', group: 'Cost control', endpoint: '/production/costing/finance-summary/:projectId', status: 'live' },
      { key: 'overspend', name: 'Overspend Suggestions', group: 'Cost control', endpoint: '/production/costing/overspend/:projectId', status: 'live' },
      { key: 'po-log', name: 'Purchase Order Log', group: 'Commitments', endpoint: '/production/reports/po-log/:projectId', status: 'live' },
      { key: 'payroll-register', name: 'Payroll Register', group: 'Payroll', endpoint: '/production/reports/payroll-register/:projectId', status: 'live' },
      { key: 'petty-cash', name: 'Petty Cash Reconciliation', group: 'Cash', endpoint: '/production/reports/petty-cash/:projectId', status: 'live' },
      { key: 'vendor-ytd', name: 'Vendor YTD (1099)', group: 'Vendors', endpoint: '/production/reports/vendor-ytd/:projectId', status: 'live' },
      { key: 'gl-reconcile', name: 'GL Reconciliation', group: 'General ledger', endpoint: '/production/gl/reconcile/:projectId', status: 'live' },
      { key: 'snapshots', name: 'Cost Report Snapshots (bond)', group: 'Cost control', endpoint: '/production/costing/snapshots/:projectId', status: 'live' },
      { key: 'cost-to-complete', name: 'Cost to Complete (by account)', group: 'Cost control', endpoint: '/production/reports/cost-to-complete/:projectId', status: 'live' },
      { key: 'cost-overage', name: 'Cost Overage', group: 'Cost control', endpoint: '/production/reports/cost-overage/:projectId', status: 'live' },
      { key: 'weekly-green', name: 'Weekly Cost Report (the Green)', group: 'Cost control', endpoint: '/production/reports/weekly-green/:projectId', status: 'live' },
      { key: 'check-register', name: 'Check / Disbursement Register', group: 'Cash', endpoint: '/production/reports/check-register/:projectId', status: 'live' },
      { key: 'fringe-detail', name: 'Fringe / Burden Detail', group: 'Payroll', endpoint: '/production/reports/fringe-detail/:projectId', status: 'live' },
      { key: 'box-1099', name: '1099 Box Totals', group: 'Vendors', endpoint: '/production/reports/box-1099/:projectId', status: 'live' },
      { key: 'trial-balance', name: 'GL Trial Balance', group: 'General ledger', endpoint: '/production/reports/trial-balance/:projectId', status: 'live' },
      { key: 'payments-ach', name: 'ACH / Payment Batch (NACHA + CSV)', group: 'Cash', endpoint: '/production/reports/payments/eligible/:projectId', status: 'live' },
      { key: 'aicp-bid', name: 'AICP Bid View (commercial)', group: 'Cost control', endpoint: '/production/reports/aicp-bid/:projectId', status: 'live' },
    ] };
  }
}
