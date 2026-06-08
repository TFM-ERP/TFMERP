import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export const BASE_CURRENCY = process.env.BASE_CURRENCY || 'AED';

@Injectable()
export class FxService {
  constructor(private prisma: PrismaService) {}

  /** currency → value of 1 unit in base. Base maps to 1. */
  async rates(): Promise<Record<string, number>> {
    const rows = await this.prisma.fxRate.findMany().catch(() => [] as any[]);
    const map: Record<string, number> = { [BASE_CURRENCY]: 1 };
    for (const r of rows) map[r.currency] = Number(r.toBase);
    return map;
  }

  async convert(amount: number, currency: string, rates?: Record<string, number>): Promise<number> {
    const m = rates || (await this.rates());
    if (!currency || currency === BASE_CURRENCY) return amount;
    return amount * (m[currency] ?? 1);
  }

  listRates() { return this.prisma.fxRate.findMany({ orderBy: { currency: 'asc' } }); }

  async upsertRates(items: { currency: string; toBase: number }[]) {
    for (const it of items || []) {
      if (!it.currency || it.currency === BASE_CURRENCY) continue;
      await this.prisma.fxRate.upsert({
        where: { currency: it.currency.toUpperCase() },
        update: { toBase: it.toBase },
        create: { currency: it.currency.toUpperCase(), toBase: it.toBase },
      });
    }
    return { ok: true, base: BASE_CURRENCY };
  }

  async removeRate(currency: string) { await this.prisma.fxRate.deleteMany({ where: { currency } }); return { ok: true }; }

  // ── Online refresh ────────────────────────────────────────────────────────────
  // Pulls live mid-market rates from two independent free sources and, per currency,
  // keeps the quote MORE FAVOURABLE for the AED side (the higher AED value per
  // foreign unit — prudent when budgeting foreign-currency costs). USD is pinned to
  // the CBUAE peg (1 USD = 3.6725 AED). Optional extra prudence margin via
  // FX_MARGIN_PCT in backend/.env (e.g. 0.5 adds +0.5%).
  private static DEFAULT_CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'CAD', 'QAR', 'JOD'];
  private static USD_PEG = 3.6725;

  private async fetchJson(url: string, timeoutMs = 12000): Promise<any | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { signal: controller.signal } as any);
      clearTimeout(timer);
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  async refreshOnline() {
    // both sources quote 1 AED = X foreign → toBase(foreign) = 1 / X
    const [erApi, fawaz] = await Promise.all([
      this.fetchJson('https://open.er-api.com/v6/latest/AED'),
      this.fetchJson('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/aed.json'),
    ]);
    const src1: Record<string, number> = erApi?.rates || {};
    const src2raw: Record<string, number> = fawaz?.aed || {};
    const src2: Record<string, number> = {};
    for (const [k, v] of Object.entries(src2raw)) src2[k.toUpperCase()] = Number(v);
    if (!Object.keys(src1).length && !Object.keys(src2).length) {
      return { ok: false, message: 'Both rate sources unreachable — check the backend internet connection and try again.' };
    }

    const margin = Math.max(0, Number(process.env.FX_MARGIN_PCT) || 0) / 100;
    const existing = await this.prisma.fxRate.findMany({ select: { currency: true } });
    const wanted = [...new Set([...FxService.DEFAULT_CURRENCIES, ...existing.map((e) => e.currency)])]
      .filter((c) => c !== BASE_CURRENCY);

    const updated: { currency: string; toBase: number; source: string }[] = [];
    const skipped: string[] = [];
    for (const cur of wanted) {
      let toBase: number | null = null;
      let source = '';
      if (cur === 'USD') {
        toBase = FxService.USD_PEG; source = 'CBUAE peg';
      } else {
        const candidates: { v: number; s: string }[] = [];
        if (src1[cur] > 0) candidates.push({ v: 1 / src1[cur], s: 'open.er-api.com' });
        if (src2[cur] > 0) candidates.push({ v: 1 / src2[cur], s: 'currency-api' });
        if (candidates.length) {
          const best = candidates.reduce((a, b) => (b.v > a.v ? b : a)); // higher AED value = favourable/prudent
          toBase = best.v * (1 + margin);
          source = best.s + (margin ? ` +${(margin * 100).toFixed(2)}%` : '');
        }
      }
      if (toBase == null || !isFinite(toBase)) { skipped.push(cur); continue; }
      const rounded = Math.round(toBase * 1e6) / 1e6;
      await this.prisma.fxRate.upsert({
        where: { currency: cur },
        update: { toBase: rounded },
        create: { currency: cur, toBase: rounded },
      });
      updated.push({ currency: cur, toBase: rounded, source });
    }
    return { ok: true, base: BASE_CURRENCY, fetchedAt: new Date(), updated, skipped, marginPct: margin * 100 };
  }
}
