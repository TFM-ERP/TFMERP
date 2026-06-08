// ─────────────────────────────────────────────────────────────────────────────
// FRINGE ENGINE — pure resolution + computation (Layer C)
// No DB, no side effects. Fully unit-testable.
// Given project parameters + an "as-of" date, return applicable rate rules,
// and given a wage base + quantities, compute the burden each rule produces.
// ─────────────────────────────────────────────────────────────────────────────

export type CalcMethod =
  | 'PERCENT'
  | 'FLAT_PER_DAY'
  | 'FLAT_PER_WEEK'
  | 'FLAT_PER_HOUR'
  | 'PERCENT_WITH_CAP'
  | 'TIERED';

export interface RuleLike {
  id?: string;
  label: string;
  rateType: string;
  calcMethod: CalcMethod;
  value: number; // 0.205 (=20.5%) or 38.50 ($/day)
  base?: string | null; // GROSS | STRAIGHT_TIME | TAXABLE | WORKED_DAYS
  capPeriod?: string | null; // WEEKLY | MONTHLY | ANNUAL | PER_PRODUCTION
  capAmount?: number | null; // wage base / ceiling per period
  floorAmount?: number | null;
  tiers?: { upTo: number | null; value: number }[] | null;
  currency?: string;
  glAccountCode?: string | null;
  isEstimate?: boolean;
}

export interface ResolveContext {
  productionType: string; // FEATURE | TV_SERIES | TVC | ...
  unionStatus: 'UNION' | 'NON_UNION' | 'MIXED';
  laborBodyIds: string[]; // selected unions/guilds/statutory bodies
  geoNodeId?: string | null;
  geoAncestorIds?: string[]; // chain of geo ids from node up to country
  asOf: Date;
}

// An agreement + its rules as loaded from master data
export interface AgreementLike {
  id: string;
  laborBodyId: string;
  laborBodyName: string;
  name: string;
  productionTypes: string[];
  effectiveDate: Date;
  expirationDate?: Date | null;
  status: string; // ACTIVE | SUPERSEDED | ...
  rules: (RuleLike & {
    classificationId?: string | null;
    classificationCode?: string | null;
    effectiveDate: Date;
    expirationDate?: Date | null;
    sourceTitle?: string | null;
    sourceUrl?: string | null;
  })[];
}

function withinWindow(asOf: Date, eff?: Date | null, exp?: Date | null): boolean {
  if (eff && asOf < new Date(eff)) return false;
  if (exp && asOf > new Date(exp)) return false;
  return true;
}

/**
 * Resolve which rate rules apply for a project configuration at a given date.
 * Pure: caller passes in the candidate agreements (already filtered to selected bodies if desired).
 */
export function resolveRules(ctx: ResolveContext, agreements: AgreementLike[]) {
  const selected = new Set(ctx.laborBodyIds || []);
  const out: {
    agreementId: string;
    agreementName: string;
    laborBodyId: string;
    laborBodyName: string;
    classificationCode: string | null;
    rule: AgreementLike['rules'][number];
  }[] = [];

  for (const ag of agreements) {
    // body must be selected (unless none selected → include all candidates, e.g. statutory)
    if (selected.size > 0 && !selected.has(ag.laborBodyId)) continue;
    // production type applicability
    if (
      Array.isArray(ag.productionTypes) &&
      ag.productionTypes.length > 0 &&
      !ag.productionTypes.includes(ctx.productionType)
    ) {
      continue;
    }
    // agreement temporal window
    if (ag.status === 'SUPERSEDED' || ag.status === 'EXPIRED') continue;
    if (!withinWindow(ctx.asOf, ag.effectiveDate, ag.expirationDate)) continue;

    for (const r of ag.rules) {
      if (!withinWindow(ctx.asOf, r.effectiveDate, r.expirationDate)) continue;
      out.push({
        agreementId: ag.id,
        agreementName: ag.name,
        laborBodyId: ag.laborBodyId,
        laborBodyName: ag.laborBodyName,
        classificationCode: r.classificationCode ?? null,
        rule: r,
      });
    }
  }
  return out;
}

export interface ComputeInput {
  // wage base for this line in project currency
  straightTime: number; // base wages (qty × rate)
  gross?: number; // gross incl. OT etc. (defaults to straightTime)
  taxable?: number; // taxable wages (defaults to gross)
  workedDays?: number; // for FLAT_PER_DAY
  weeks?: number; // for FLAT_PER_WEEK & weekly caps
  hours?: number; // for FLAT_PER_HOUR
  // For cap-aware percent: the per-period wage that the cap applies to.
  // Line-level estimate uses straightTime/weeks as the per-week wage.
  perPeriodWage?: number;
}

function baseAmount(rule: RuleLike, input: ComputeInput): number {
  const gross = input.gross ?? input.straightTime;
  switch (rule.base) {
    case 'GROSS':
      return gross;
    case 'TAXABLE':
      return input.taxable ?? gross;
    case 'WORKED_DAYS':
      return input.workedDays ?? 0;
    case 'STRAIGHT_TIME':
    default:
      return input.straightTime;
  }
}

/**
 * Compute the burden a single rule produces for a line.
 * Returns { amount, isEstimate, note }.
 */
export function computeRule(rule: RuleLike, input: ComputeInput): { amount: number; isEstimate: boolean; note?: string } {
  const v = Number(rule.value) || 0;
  let amount = 0;
  let isEstimate = !!rule.isEstimate;
  let note: string | undefined;

  switch (rule.calcMethod) {
    case 'PERCENT': {
      amount = baseAmount(rule, input) * v;
      break;
    }
    case 'FLAT_PER_DAY': {
      const days = input.workedDays ?? 0;
      amount = v * days;
      if (days === 0) { isEstimate = true; note = 'No worked-days on line; flat/day not applied'; }
      break;
    }
    case 'FLAT_PER_WEEK': {
      const weeks = input.weeks ?? 0;
      amount = v * weeks;
      if (weeks === 0) { isEstimate = true; note = 'No weeks on line; flat/week not applied'; }
      break;
    }
    case 'FLAT_PER_HOUR': {
      const hours = input.hours ?? 0;
      amount = v * hours;
      if (hours === 0) { isEstimate = true; note = 'No hours on line; flat/hour not applied'; }
      break;
    }
    case 'PERCENT_WITH_CAP': {
      const base = baseAmount(rule, input);
      const cap = rule.capAmount != null ? Number(rule.capAmount) : null;
      if (cap == null) {
        amount = base * v;
      } else if (rule.capPeriod === 'WEEKLY') {
        // Apply weekly cap across the number of weeks (line-level estimate).
        const weeks = input.weeks ?? 1;
        const perWeekWage = input.perPeriodWage ?? (weeks > 0 ? base / weeks : base);
        const cappedWeekly = Math.min(perWeekWage, cap);
        amount = cappedWeekly * v * weeks;
        isEstimate = true;
        note = 'Weekly cap applied at line level (estimate)';
      } else if (rule.capPeriod === 'ANNUAL' || rule.capPeriod === 'PER_PRODUCTION') {
        const capped = Math.min(base, cap);
        amount = capped * v;
        if (base > cap) note = `Capped at ${cap}`;
      } else {
        amount = base * v;
      }
      break;
    }
    case 'TIERED': {
      const base = baseAmount(rule, input);
      let remaining = base;
      let prev = 0;
      const tiers = rule.tiers || [];
      for (const t of tiers) {
        const ceil = t.upTo == null ? Infinity : Number(t.upTo);
        const band = Math.max(0, Math.min(remaining, ceil - prev));
        amount += band * Number(t.value);
        prev = ceil;
        remaining = base - prev;
        if (remaining <= 0) break;
      }
      break;
    }
    default:
      amount = 0;
  }

  if (rule.floorAmount != null && amount < Number(rule.floorAmount)) {
    amount = Number(rule.floorAmount);
  }
  return { amount: round2(amount), isEstimate, note };
}

export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Compute all applicable rules for a line and return a detail breakdown + total.
 */
export function computeLineFringes(
  rules: RuleLike[],
  input: ComputeInput,
): { total: number; anyEstimate: boolean; detail: { label: string; rateType: string; glAccountCode?: string | null; amount: number; isEstimate: boolean; note?: string }[] } {
  const detail = rules.map((r) => {
    const c = computeRule(r, input);
    return {
      label: r.label,
      rateType: r.rateType,
      glAccountCode: r.glAccountCode ?? null,
      amount: c.amount,
      isEstimate: c.isEstimate,
      note: c.note,
    };
  });
  const total = round2(detail.reduce((s, d) => s + d.amount, 0));
  const anyEstimate = detail.some((d) => d.isEstimate);
  return { total, anyEstimate, detail };
}
