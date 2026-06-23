/**
 * Fringe engine — pure-logic unit tests (node:test + ts-node). Run: npm run test:unit
 * Characterizes employer-burden computation (computeRule / computeLineFringes) and
 * agreement/rule resolution (resolveRules). Every expected value is computed by hand.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeRule, computeLineFringes, resolveRules, round2 } from './fringe-engine';

const rule = (over: any = {}) => ({ label: 'L', rateType: 'PENSION', calcMethod: 'PERCENT', value: 0.1, ...over });

// ── round2 ──────────────────────────────────────────────────────────────────
test('round2 snaps to 2 decimals and clears float dust', () => {
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(round2(154.5), 154.5);
  assert.equal(round2(199.999), 200);
  assert.equal(round2(1.236), 1.24);
});

// ── computeRule: PERCENT + base selection ─────────────────────────────────────
test('PERCENT applies value to the selected wage base', () => {
  // default base = STRAIGHT_TIME
  assert.equal(computeRule(rule({ value: 0.205 }), { straightTime: 1000 }).amount, 205);
  // GROSS
  assert.equal(computeRule(rule({ base: 'GROSS' }), { straightTime: 1000, gross: 1200 }).amount, 120);
  // TAXABLE, and TAXABLE falling back to gross when taxable is absent
  assert.equal(computeRule(rule({ base: 'TAXABLE' }), { straightTime: 1000, gross: 1000, taxable: 800 }).amount, 80);
  assert.equal(computeRule(rule({ base: 'TAXABLE' }), { straightTime: 1000, gross: 1000 }).amount, 100);
  // WORKED_DAYS base feeds the day count in as the "amount base"
  assert.equal(computeRule(rule({ base: 'WORKED_DAYS', value: 10 }), { straightTime: 1000, workedDays: 5 }).amount, 50);
});

// ── computeRule: FLAT_PER_* with the "not applied" estimate flag ───────────────
test('FLAT_PER_DAY multiplies value by worked days; zero days flags an estimate', () => {
  assert.equal(computeRule(rule({ calcMethod: 'FLAT_PER_DAY', value: 38.5 }), { straightTime: 0, workedDays: 4 }).amount, 154);
  const zero = computeRule(rule({ calcMethod: 'FLAT_PER_DAY', value: 38.5 }), { straightTime: 0, workedDays: 0 });
  assert.equal(zero.amount, 0);
  assert.equal(zero.isEstimate, true);
  assert.equal(zero.note, 'No worked-days on line; flat/day not applied');
});

test('FLAT_PER_WEEK and FLAT_PER_HOUR follow the same shape', () => {
  assert.equal(computeRule(rule({ calcMethod: 'FLAT_PER_WEEK', value: 100 }), { straightTime: 0, weeks: 3 }).amount, 300);
  assert.equal(computeRule(rule({ calcMethod: 'FLAT_PER_WEEK', value: 100 }), { straightTime: 0, weeks: 0 }).isEstimate, true);
  assert.equal(computeRule(rule({ calcMethod: 'FLAT_PER_HOUR', value: 2.5 }), { straightTime: 0, hours: 40 }).amount, 100);
  assert.equal(computeRule(rule({ calcMethod: 'FLAT_PER_HOUR', value: 2.5 }), { straightTime: 0, hours: 0 }).isEstimate, true);
});

// ── computeRule: PERCENT_WITH_CAP ─────────────────────────────────────────────
test('PERCENT_WITH_CAP with no cap behaves like PERCENT', () => {
  assert.equal(computeRule(rule({ calcMethod: 'PERCENT_WITH_CAP', value: 0.1 }), { straightTime: 5000 }).amount, 500);
});

test('PERCENT_WITH_CAP ANNUAL caps the base before applying the rate', () => {
  const capped = computeRule(rule({ calcMethod: 'PERCENT_WITH_CAP', value: 0.062, capPeriod: 'ANNUAL', capAmount: 7000 }), { straightTime: 10000 });
  assert.equal(capped.amount, 434); // min(10000,7000) * 0.062
  assert.equal(capped.note, 'Capped at 7000');
  const under = computeRule(rule({ calcMethod: 'PERCENT_WITH_CAP', value: 0.062, capPeriod: 'ANNUAL', capAmount: 7000 }), { straightTime: 5000 });
  assert.equal(under.amount, 310); // base under cap → full base, no note
  assert.equal(under.note, undefined);
});

test('PERCENT_WITH_CAP WEEKLY caps the per-week wage then scales by rate × weeks (estimate)', () => {
  // base 6000 over 3 weeks → 2000/wk, capped to 1500/wk → 1500 * 0.1 * 3
  const r = computeRule(rule({ calcMethod: 'PERCENT_WITH_CAP', value: 0.1, capPeriod: 'WEEKLY', capAmount: 1500 }), { straightTime: 6000, weeks: 3 });
  assert.equal(r.amount, 450);
  assert.equal(r.isEstimate, true);
  // explicit perPeriodWage overrides the derived per-week wage
  const r2 = computeRule(rule({ calcMethod: 'PERCENT_WITH_CAP', value: 0.1, capPeriod: 'WEEKLY', capAmount: 1500 }), { straightTime: 6000, weeks: 3, perPeriodWage: 1000 });
  assert.equal(r2.amount, 300); // min(1000,1500) * 0.1 * 3
});

test('PERCENT_WITH_CAP MONTHLY caps the per-month wage then scales by rate × months (estimate)', () => {
  // base 30000 over 3 months → 10000/mo, capped to 5000/mo → 5000 * 0.1 * 3
  const r = computeRule(rule({ calcMethod: 'PERCENT_WITH_CAP', value: 0.1, capPeriod: 'MONTHLY', capAmount: 5000 }), { straightTime: 30000, months: 3 });
  assert.equal(r.amount, 1500);
  assert.equal(r.isEstimate, true);
  assert.equal(r.note, 'Monthly cap applied at line level (estimate)');
  // explicit perPeriodWage overrides the derived per-month wage
  const r2 = computeRule(rule({ calcMethod: 'PERCENT_WITH_CAP', value: 0.1, capPeriod: 'MONTHLY', capAmount: 5000 }), { straightTime: 30000, months: 3, perPeriodWage: 4000 });
  assert.equal(r2.amount, 1200); // min(4000,5000) * 0.1 * 3
  // default months=1 still APPLIES the cap (previously the cap was silently ignored → 1000)
  const r3 = computeRule(rule({ calcMethod: 'PERCENT_WITH_CAP', value: 0.1, capPeriod: 'MONTHLY', capAmount: 5000 }), { straightTime: 10000 });
  assert.equal(r3.amount, 500); // min(10000,5000) * 0.1 * 1
});

// ── computeRule: TIERED ───────────────────────────────────────────────────────
test('TIERED applies progressive bands across the base', () => {
  const tiers = [{ upTo: 1000, value: 0.1 }, { upTo: null, value: 0.05 }];
  // 1000@10% + 500@5% = 125
  assert.equal(computeRule(rule({ calcMethod: 'TIERED', tiers }), { straightTime: 1500 }).amount, 125);
  // base inside first band only
  assert.equal(computeRule(rule({ calcMethod: 'TIERED', tiers }), { straightTime: 800 }).amount, 80);
});

// ── computeRule: floor ────────────────────────────────────────────────────────
test('floorAmount lifts an amount that falls below the floor', () => {
  assert.equal(computeRule(rule({ value: 0.1, floorAmount: 50 }), { straightTime: 100 }).amount, 50); // 10 → 50
  assert.equal(computeRule(rule({ value: 0.1, floorAmount: 5 }), { straightTime: 100 }).amount, 10);  // above floor, untouched
});

// ── computeLineFringes ────────────────────────────────────────────────────────
test('computeLineFringes sums rule amounts and surfaces any estimate', () => {
  const rules = [
    rule({ label: 'Pension', rateType: 'PENSION', value: 0.1, glAccountCode: '5100' }),
    rule({ label: 'Health', rateType: 'HEALTH', calcMethod: 'FLAT_PER_DAY', value: 38.5, glAccountCode: '5200' }),
    rule({ label: 'Levy', rateType: 'LEVY', value: 0.02, isEstimate: true }),
  ];
  const res = computeLineFringes(rules, { straightTime: 1000, workedDays: 4 });
  assert.equal(res.total, 100 + 154 + 20); // 274
  assert.equal(res.anyEstimate, true); // Levy flagged
  assert.equal(res.detail.length, 3);
  assert.deepEqual(res.detail[0], { label: 'Pension', rateType: 'PENSION', glAccountCode: '5100', amount: 100, isEstimate: false, note: undefined });
});

// ── resolveRules ──────────────────────────────────────────────────────────────
const ag = (over: any = {}) => ({
  id: 'a', laborBodyId: 'b1', laborBodyName: 'Body', name: 'Agr', productionTypes: ['FEATURE'],
  effectiveDate: new Date('2026-01-01'), expirationDate: null, status: 'ACTIVE',
  rules: [{ label: 'r', rateType: 'PENSION', calcMethod: 'PERCENT', value: 0.1, effectiveDate: new Date('2026-01-01'), expirationDate: null, classificationCode: 'C1' }],
  ...over,
});
const ctx = (over: any = {}) => ({ productionType: 'FEATURE', unionStatus: 'UNION' as const, laborBodyIds: ['b1'], asOf: new Date('2026-06-24'), ...over });

test('resolveRules filters by selected body, production type, status and temporal window', () => {
  const agreements = [
    ag({ id: 'keep' }),                                                   // matches
    ag({ id: 'wrong-body', laborBodyId: 'b2' }),                         // body not selected
    ag({ id: 'wrong-type', productionTypes: ['TVC'] }),                  // production type mismatch
    ag({ id: 'superseded', status: 'SUPERSEDED' }),                      // inactive
    ag({ id: 'future', effectiveDate: new Date('2027-01-01') }),        // not yet effective
    ag({ id: 'any-type', productionTypes: [] }),                         // empty types → applies to all
  ];
  const out = resolveRules(ctx(), agreements);
  assert.deepEqual(out.map((o) => o.agreementId).sort(), ['any-type', 'keep']);
  assert.equal(out.find((o) => o.agreementId === 'keep')!.classificationCode, 'C1');
});

test('resolveRules with no bodies selected includes all candidates (e.g. statutory)', () => {
  const agreements = [ag({ id: 'b1', laborBodyId: 'b1' }), ag({ id: 'b2', laborBodyId: 'b2' })];
  const out = resolveRules(ctx({ laborBodyIds: [] }), agreements);
  assert.deepEqual(out.map((o) => o.agreementId).sort(), ['b1', 'b2']);
});

test('resolveRules excludes rules whose own window does not cover the as-of date', () => {
  const agreements = [ag({ rules: [
    { label: 'live', rateType: 'X', calcMethod: 'PERCENT', value: 0.1, effectiveDate: new Date('2026-01-01'), expirationDate: null },
    { label: 'future', rateType: 'X', calcMethod: 'PERCENT', value: 0.1, effectiveDate: new Date('2027-01-01'), expirationDate: null },
    { label: 'expired', rateType: 'X', calcMethod: 'PERCENT', value: 0.1, effectiveDate: new Date('2025-01-01'), expirationDate: new Date('2025-12-31') },
  ] })];
  const out = resolveRules(ctx(), agreements);
  assert.deepEqual(out.map((o) => o.rule.label), ['live']);
});

test('resolveRules treats the effective date as inclusive (boundary)', () => {
  const onBoundary = resolveRules(ctx({ asOf: new Date('2026-01-01') }), [ag()]);
  assert.equal(onBoundary.length, 1);
  const dayBefore = resolveRules(ctx({ asOf: new Date('2025-12-31') }), [ag()]);
  assert.equal(dayBefore.length, 0);
});
