/* Fringe / Union / Statutory MASTER DATA seed (Phase 0)
 * Run from the backend folder:  node prisma/seed-labor.js
 * Idempotent: upserts geography, labor bodies, sources, agreements, classifications
 * and rate rules keyed by stable natural keys.
 *
 * IMPORTANT — DATA PROVENANCE & ACCURACY
 * Every rate below carries a source title + URL + effective date. Figures were
 * gathered from official guild / plan / government publications (June 2026).
 * Rates marked `isEstimate: true` are headline/approximate (tier or region
 * variations exist) and MUST be confirmed by your accountant before use.
 * Union agreements are copyrighted: we store rate FIGURES + CITATIONS only,
 * never republished agreement texts.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── helpers ───────────────────────────────────────────────────────────────────
async function upsertGeo(level, name, code, parentId) {
  const existing = await prisma.geoNode.findFirst({ where: { level, name, parentId: parentId || null } });
  if (existing) return existing;
  return prisma.geoNode.create({ data: { level, name, code: code || null, parentId: parentId || null } });
}
async function upsertBody(kind, name, shortName, countryId, website) {
  const existing = await prisma.laborBody.findFirst({ where: { name } });
  if (existing) return prisma.laborBody.update({ where: { id: existing.id }, data: { kind, shortName, countryId, website } });
  return prisma.laborBody.create({ data: { kind, name, shortName, countryId, website, isActive: true } });
}
async function upsertSource(laborBodyId, title, url, publisher) {
  const existing = await prisma.rateSource.findFirst({ where: { title } });
  if (existing) return prisma.rateSource.update({ where: { id: existing.id }, data: { url, publisher, laborBodyId, retrievedAt: new Date() } });
  return prisma.rateSource.create({ data: { laborBodyId, title, url, publisher, trusted: true, retrievedAt: new Date() } });
}
async function upsertAgreement(laborBodyId, name, productionTypes, effectiveDate, expirationDate, sourceId, tier) {
  const existing = await prisma.agreement.findFirst({ where: { laborBodyId, name } });
  const data = { laborBodyId, name, productionTypes, tier: tier || null, effectiveDate: new Date(effectiveDate), expirationDate: expirationDate ? new Date(expirationDate) : null, status: 'ACTIVE', sourceId: sourceId || null };
  if (existing) return prisma.agreement.update({ where: { id: existing.id }, data });
  return prisma.agreement.create({ data });
}
async function upsertClass(agreementId, code, title, riskClass) {
  const existing = await prisma.classification.findFirst({ where: { agreementId, code } });
  if (existing) return existing;
  return prisma.classification.create({ data: { agreementId, code, title, riskClass: riskClass || null } });
}
async function upsertRule(agreementId, r) {
  const existing = await prisma.rateRule.findFirst({ where: { agreementId, label: r.label, classificationId: r.classificationId || null } });
  const data = {
    agreementId,
    classificationId: r.classificationId || null,
    label: r.label, rateType: r.rateType, calcMethod: r.calcMethod,
    value: r.value, base: r.base || null, capPeriod: r.capPeriod || null,
    capAmount: r.capAmount ?? null, floorAmount: r.floorAmount ?? null, tiers: r.tiers ?? null,
    currency: r.currency || 'USD', glAccountCode: r.glAccountCode || null,
    sourceId: r.sourceId || null,
    effectiveDate: new Date(r.effectiveDate), expirationDate: r.expirationDate ? new Date(r.expirationDate) : null,
    isEstimate: r.isEstimate ?? false, notes: r.notes || null,
  };
  if (existing) return prisma.rateRule.update({ where: { id: existing.id }, data });
  return prisma.rateRule.create({ data });
}

async function upsertIncentive(d) {
  const existing = await prisma.incentiveProgram.findFirst({ where: { name: d.name } });
  const data = {
    geoNodeId: d.geoNodeId || null, name: d.name, authority: d.authority || null,
    incentiveType: d.incentiveType || 'TAX_CREDIT', ratePct: d.ratePct, basis: d.basis || 'QUALIFIED',
    minSpend: d.minSpend ?? null, capAmount: d.capAmount ?? null, upliftPct: d.upliftPct ?? null,
    transferable: d.transferable ?? false, refundable: d.refundable ?? false, currency: d.currency || 'USD',
    productionTypes: d.productionTypes ?? null, sourceTitle: d.sourceTitle || null, sourceUrl: d.sourceUrl || null,
    effectiveDate: d.effectiveDate ? new Date(d.effectiveDate) : null, expirationDate: d.expirationDate ? new Date(d.expirationDate) : null,
    isEstimate: d.isEstimate ?? true, isActive: true, notes: d.notes || null,
    complianceRules: d.complianceRules ?? null,
  };
  if (existing) return prisma.incentiveProgram.update({ where: { id: existing.id }, data });
  return prisma.incentiveProgram.create({ data });
}

const ALL_TYPES = ['FEATURE', 'TV_SERIES', 'SHORT', 'TVC', 'DOCUMENTARY', 'MUSIC_VIDEO', 'CORPORATE', 'OTHER'];
const SCRIPTED = ['FEATURE', 'TV_SERIES', 'SHORT'];

// GL fringe account codes (decision-support mapping)
// 6600-series — clear of the industry budget topsheet (5000s = post, 6300–6900 = other)
const GL = { PH: '6600', TAX: '6610', WC: '6620', GRAT: '6630', UNEMP: '6615' };

async function main() {
  console.log('Seeding fringe/union master data…');

  // ── Geography ───────────────────────────────────────────────────────────────
  const usa = await upsertGeo('COUNTRY', 'United States', 'US');
  const ca_st = await upsertGeo('STATE', 'California', 'US-CA', usa.id);
  const ny_st = await upsertGeo('STATE', 'New York', 'US-NY', usa.id);
  const ga_st = await upsertGeo('STATE', 'Georgia', 'US-GA', usa.id);
  await upsertGeo('CITY', 'Los Angeles', null, ca_st.id);
  await upsertGeo('CITY', 'New York City', null, ny_st.id);

  const canada = await upsertGeo('COUNTRY', 'Canada', 'CA');
  const ontario = await upsertGeo('STATE', 'Ontario', 'CA-ON', canada.id);
  const bc = await upsertGeo('STATE', 'British Columbia', 'CA-BC', canada.id);
  await upsertGeo('CITY', 'Toronto', null, ontario.id);
  await upsertGeo('CITY', 'Vancouver', null, bc.id);

  const uk = await upsertGeo('COUNTRY', 'United Kingdom', 'GB');
  await upsertGeo('CITY', 'London', null, uk.id);

  const uae = await upsertGeo('COUNTRY', 'United Arab Emirates', 'AE');
  await upsertGeo('STATE', 'Dubai', 'AE-DU', uae.id);
  await upsertGeo('STATE', 'Abu Dhabi', 'AE-AZ', uae.id);

  const ksa = await upsertGeo('COUNTRY', 'Saudi Arabia', 'SA');
  await upsertGeo('STATE', 'Riyadh', 'SA-01', ksa.id);
  const alula = await upsertGeo('STATE', 'AlUla', 'SA-ALULA', ksa.id);
  const qatar = await upsertGeo('COUNTRY', 'Qatar', 'QA');
  await upsertGeo('CITY', 'Doha', null, qatar.id);
  const jordan = await upsertGeo('COUNTRY', 'Jordan', 'JO');
  await upsertGeo('CITY', 'Amman', null, jordan.id);

  // ════════════════════════════════════════════════════════════════════════════
  // UNITED STATES
  // ════════════════════════════════════════════════════════════════════════════
  const sag = await upsertBody('UNION', 'SAG-AFTRA', 'SAG-AFTRA', usa.id, 'https://www.sagaftra.org');
  const dga = await upsertBody('GUILD', 'Directors Guild of America', 'DGA', usa.id, 'https://www.dga.org');
  const wga = await upsertBody('GUILD', 'Writers Guild of America', 'WGA', usa.id, 'https://www.wga.org');
  const iatse = await upsertBody('UNION', 'IATSE', 'IATSE', usa.id, 'https://iatse.net');
  const teamsters = await upsertBody('UNION', 'Teamsters Local 399', 'Teamsters 399', usa.id, 'https://ht399.org');
  const usGov = await upsertBody('STATUTORY', 'US Federal Payroll (IRS/DOL)', 'US Statutory', usa.id, 'https://www.irs.gov');

  const sSag = await upsertSource(sag.id, 'SAG-AFTRA Plans — Contribution Rates', 'https://www.sagaftraplans.org/employers', 'SAG-AFTRA Plans');
  const sDga = await upsertSource(dga.id, 'DGA-Producer Pension & Health — Rate Card 2024-2025', 'https://www.dgaplans.org', 'DGA-PPHP');
  const sWga = await upsertSource(wga.id, 'PWGA Pension & Health — Employer Obligations', 'https://www.wgaplans.org/contributions/employer_obligations.html', 'PWGA');
  const sIa = await upsertSource(iatse.id, 'Motion Picture Industry Pension & Health Plans (MPIPHP)', 'https://www.mpiphp.org', 'MPIPHP');
  const sIrs = await upsertSource(usGov.id, 'IRS Topic 751 / SSA Contribution & Benefit Base 2025', 'https://www.ssa.gov/oact/cola/cbb.html', 'IRS/SSA');

  // SAG-AFTRA theatrical agreement
  const pga = await upsertBody('GUILD', 'Producers Guild of America', 'PGA', usa.id, 'https://www.producersguild.org');
  const sPga = await upsertSource(pga.id, 'Producers Guild of America — Membership & Producing Standards', 'https://www.producersguild.org', 'PGA');
  const sPhbp = await upsertSource(pga.id, 'PHBP — Producers Health Benefits Plan (Employer Contributions)', 'https://www.phbp.org', 'PHBP');

  const sagAg = await upsertAgreement(sag.id, 'SAG-AFTRA Theatrical/Television 2023–2026', SCRIPTED, '2023-07-01', '2026-06-30', sSag.id, 'Theatrical');
  const sagPerf = await upsertClass(sagAg.id, 'PERFORMER', 'Principal Performer');
  const sagBg = await upsertClass(sagAg.id, 'BG', 'Background Actor');
  const sagStunt = await upsertClass(sagAg.id, 'STUNT', 'Stunt Performer', '7605');
  await upsertRule(sagAg.id, { classificationId: sagPerf.id, label: 'SAG-AFTRA Pension & Health', rateType: 'PENSION_HEALTH', calcMethod: 'PERCENT', value: 0.205, base: 'GROSS', currency: 'USD', glAccountCode: GL.PH, sourceId: sSag.id, effectiveDate: '2023-07-01', isEstimate: true, notes: 'Employer P&H contribution ~19.5–21% of gross depending on tier/year; confirm current rate with SAG-AFTRA Plans.' });
  await upsertRule(sagAg.id, { classificationId: sagBg.id, label: 'SAG-AFTRA Pension & Health (BG)', rateType: 'PENSION_HEALTH', calcMethod: 'PERCENT', value: 0.205, base: 'GROSS', currency: 'USD', glAccountCode: GL.PH, sourceId: sSag.id, effectiveDate: '2023-07-01', isEstimate: true, notes: 'Same P&H rate applied to background; confirm.' });

  // DGA Basic Agreement
  const dgaAg = await upsertAgreement(dga.id, 'DGA Basic Agreement 2023–2026', SCRIPTED, '2023-07-01', '2026-06-30', sDga.id, 'Basic');
  const dgaDir = await upsertClass(dgaAg.id, 'DIRECTOR', 'Director');
  const dgaAdsm = await upsertClass(dgaAg.id, 'ADSM', 'Associate Director / Stage Manager');
  await upsertRule(dgaAg.id, { classificationId: dgaDir.id, label: 'DGA Pension', rateType: 'PENSION', calcMethod: 'PERCENT', value: 0.085, base: 'GROSS', currency: 'USD', glAccountCode: GL.PH, sourceId: sDga.id, effectiveDate: '2024-07-01', isEstimate: true, notes: 'Pension ~8.5% of covered earnings (2024-2025 rate card); confirm tier.' });
  await upsertRule(dgaAg.id, { classificationId: dgaDir.id, label: 'DGA Health (incl. PPL)', rateType: 'HEALTH', calcMethod: 'PERCENT', value: 0.115, base: 'GROSS', currency: 'USD', glAccountCode: GL.PH, sourceId: sDga.id, effectiveDate: '2024-07-01', isEstimate: true, notes: 'Health ~11.5% incl. 0.5% paid parental leave; confirm.' });

  // WGA MBA
  const wgaAg = await upsertAgreement(wga.id, 'WGA Minimum Basic Agreement 2023–2026', SCRIPTED, '2023-05-02', '2026-05-01', sWga.id, 'MBA');
  const wgaWriter = await upsertClass(wgaAg.id, 'WRITER', 'Writer');
  await upsertRule(wgaAg.id, { classificationId: wgaWriter.id, label: 'WGA Pension (PWGA)', rateType: 'PENSION', calcMethod: 'PERCENT', value: 0.1125, base: 'GROSS', currency: 'USD', glAccountCode: GL.PH, sourceId: sWga.id, effectiveDate: '2024-05-02', isEstimate: true, notes: '~11.25% to Producer-Writers Guild Pension Plan; confirm.' });
  await upsertRule(wgaAg.id, { classificationId: wgaWriter.id, label: 'WGA Health Fund', rateType: 'HEALTH', calcMethod: 'PERCENT', value: 0.12, base: 'GROSS', currency: 'USD', glAccountCode: GL.PH, sourceId: sWga.id, effectiveDate: '2024-05-02', isEstimate: true, notes: '~12–13% to Industry Health Fund depending on service type; confirm.' });

  // IATSE / MPIPHP (hourly)
  const iaAg = await upsertAgreement(iatse.id, 'IATSE Basic Agreement (MPIPHP) 2024–2027', SCRIPTED, '2024-08-01', '2027-07-31', sIa.id, 'Basic');
  const iaCrew = await upsertClass(iaAg.id, 'IATSE-CREW', 'IATSE Crew');
  await upsertRule(iaAg.id, { classificationId: iaCrew.id, label: 'MPIPHP Pension & Health (hourly)', rateType: 'PENSION_HEALTH', calcMethod: 'FLAT_PER_HOUR', value: 17.514, base: 'WORKED_DAYS', currency: 'USD', glAccountCode: GL.PH, sourceId: sIa.id, effectiveDate: '2024-08-01', isEstimate: true, notes: 'MPIPHP "East Coast" hourly contribution USD 17.514/hr (2024). West Coast craft rates vary; confirm applicable rate.' });

  // Teamsters (use MPIPHP basis)
  const teamAg = await upsertAgreement(teamsters.id, 'Teamsters Local 399 Black Book 2024–2027', SCRIPTED, '2024-08-01', '2027-07-31', sIa.id, 'Black Book');
  const teamDriver = await upsertClass(teamAg.id, 'DRIVER', 'Transportation / Driver');
  await upsertRule(teamAg.id, { classificationId: teamDriver.id, label: 'Teamsters Pension & Health (hourly)', rateType: 'PENSION_HEALTH', calcMethod: 'FLAT_PER_HOUR', value: 17.514, base: 'WORKED_DAYS', currency: 'USD', glAccountCode: GL.PH, sourceId: sIa.id, effectiveDate: '2024-08-01', isEstimate: true, notes: 'Placeholder using MPIPHP hourly basis; confirm Local 399 schedule.' });

  // PGA — Producers Guild of America. NOTE: the PGA is a non-bargaining trade
  // association — there is NO collective agreement mandating producer fringes on
  // scripted work (US statutory employer taxes still apply via the rules below).
  // The explicit 0% rule documents this so producer lines aren't silently skipped.
  // On the commercial/TVC side the PHBP (Producers Health Benefits Plan) DOES
  // take an employer payroll contribution for eligible freelance producers.
  const pgaAg = await upsertAgreement(pga.id, 'PGA Producer Engagement Terms (non-CBA)', SCRIPTED, '2024-01-01', null, sPga.id, 'Non-CBA');
  const pgaProd = await upsertClass(pgaAg.id, 'PRODUCER', 'Producer (EP / Producer / Line Producer / Co-Producer)');
  await upsertRule(pgaAg.id, { classificationId: pgaProd.id, label: 'PGA — no mandated Pension & Health (non-CBA)', rateType: 'PENSION_HEALTH', calcMethod: 'PERCENT', value: 0.0, base: 'GROSS', currency: 'USD', glAccountCode: GL.PH, sourceId: sPga.id, effectiveDate: '2024-01-01', isEstimate: false, notes: 'The PGA has no collective bargaining agreement — no employer P&H contribution is mandated for producers on scripted work. US statutory payroll taxes (FICA/FUTA/SUTA/WC) still apply. Negotiated producer deals may include discretionary benefits — model those per deal memo.' });

  const phbpAg = await upsertAgreement(pga.id, 'PHBP — Commercial Producers Health (AICP)', ['TVC', 'MUSIC_VIDEO', 'CORPORATE'], '2024-01-01', null, sPhbp.id, 'PHBP');
  const phbpProd = await upsertClass(phbpAg.id, 'PRODUCER', 'Freelance Commercial Producer');
  await upsertRule(phbpAg.id, { classificationId: phbpProd.id, label: 'PHBP Health (employer, commercial)', rateType: 'HEALTH', calcMethod: 'PERCENT', value: 0.09, base: 'GROSS', currency: 'USD', glAccountCode: GL.PH, sourceId: sPhbp.id, effectiveDate: '2024-01-01', isEstimate: true, notes: 'PHBP employer contribution ~9% of freelance payroll for eligible commercial production staff (signatory AICP companies). Rate varies by plan year — confirm at phbp.org before reliance.' });

  // US statutory (applies to ALL classifications → classificationId null)
  const usStatAg = await upsertAgreement(usGov.id, 'US Employer Payroll Taxes 2025', ALL_TYPES, '2025-01-01', '2025-12-31', sIrs.id, 'Federal');
  await upsertRule(usStatAg.id, { label: 'Social Security (employer)', rateType: 'EMPLOYER_TAX', calcMethod: 'PERCENT_WITH_CAP', value: 0.062, base: 'TAXABLE', capPeriod: 'ANNUAL', capAmount: 176100, currency: 'USD', glAccountCode: GL.TAX, sourceId: sIrs.id, effectiveDate: '2025-01-01', isEstimate: false, notes: 'OASDI 6.2% on wages up to USD 176,100 (2025 wage base).' });
  await upsertRule(usStatAg.id, { label: 'Medicare (employer)', rateType: 'EMPLOYER_TAX', calcMethod: 'PERCENT', value: 0.0145, base: 'TAXABLE', currency: 'USD', glAccountCode: GL.TAX, sourceId: sIrs.id, effectiveDate: '2025-01-01', isEstimate: false, notes: '1.45% Medicare, no wage cap.' });
  await upsertRule(usStatAg.id, { label: 'FUTA (employer)', rateType: 'UNEMPLOYMENT', calcMethod: 'PERCENT_WITH_CAP', value: 0.006, base: 'TAXABLE', capPeriod: 'ANNUAL', capAmount: 7000, currency: 'USD', glAccountCode: GL.UNEMP, sourceId: sIrs.id, effectiveDate: '2025-01-01', isEstimate: false, notes: 'FUTA net 0.6% on first USD 7,000 (after state credit).' });
  await upsertRule(usStatAg.id, { label: 'State Unemployment (SUTA) — placeholder', rateType: 'UNEMPLOYMENT', calcMethod: 'PERCENT_WITH_CAP', value: 0.034, base: 'TAXABLE', capPeriod: 'ANNUAL', capAmount: 7000, currency: 'USD', glAccountCode: GL.UNEMP, sourceId: sIrs.id, effectiveDate: '2025-01-01', isEstimate: true, notes: 'SUTA varies by state & experience rating; set per state. Placeholder figure.' });
  await upsertRule(usStatAg.id, { label: "Workers' Compensation — placeholder", rateType: 'WORKERS_COMP', calcMethod: 'PERCENT', value: 0.03, base: 'GROSS', currency: 'USD', glAccountCode: GL.WC, sourceId: sIrs.id, effectiveDate: '2025-01-01', isEstimate: true, notes: "WC varies by risk class code per craft (stunts much higher). Placeholder; set per classification." });

  // ════════════════════════════════════════════════════════════════════════════
  // CANADA
  // ════════════════════════════════════════════════════════════════════════════
  const actra = await upsertBody('UNION', 'ACTRA', 'ACTRA', canada.id, 'https://www.actra.ca');
  const dgc = await upsertBody('GUILD', 'Directors Guild of Canada', 'DGC', canada.id, 'https://www.dgc.ca');
  const caGov = await upsertBody('STATUTORY', 'Canada Federal Payroll (CRA)', 'CA Statutory', canada.id, 'https://www.canada.ca');

  const sActra = await upsertSource(actra.id, 'ACTRA IPA 2025–2027 — Insurance & Retirement', 'https://actratoronto.com/ipa-tentative-agreement-notice/', 'ACTRA');
  const sDgc = await upsertSource(dgc.id, 'DGC National Agreement — Benefits', 'https://www.dgc.ca', 'DGC');
  const sCra = await upsertSource(caGov.id, 'CRA CPP & EI Rates 2025', 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions.html', 'CRA');

  const actraAg = await upsertAgreement(actra.id, 'ACTRA Independent Production Agreement 2025–2027', SCRIPTED, '2025-01-01', '2027-12-31', sActra.id, 'IPA');
  const actraPerf = await upsertClass(actraAg.id, 'PERFORMER', 'Performer');
  await upsertRule(actraAg.id, { classificationId: actraPerf.id, label: 'ACTRA Insurance (AFBS)', rateType: 'HEALTH', calcMethod: 'PERCENT', value: 0.05, base: 'GROSS', currency: 'CAD', glAccountCode: GL.PH, sourceId: sActra.id, effectiveDate: '2025-01-01', isEstimate: true, notes: 'Engager insurance 5% of gross fees (rising to 5.5% on 2026-01-01).' });
  await upsertRule(actraAg.id, { classificationId: actraPerf.id, label: 'ACTRA Retirement (producer)', rateType: 'PENSION', calcMethod: 'PERCENT', value: 0.07, base: 'GROSS', currency: 'CAD', glAccountCode: GL.PH, sourceId: sActra.id, effectiveDate: '2025-01-01', isEstimate: true, notes: 'Producer retirement contribution ~7% of gross fees; +0.5% phased from year 3.' });

  const dgcAg = await upsertAgreement(dgc.id, 'DGC National Commercial/Standard Agreement', SCRIPTED, '2024-01-01', null, sDgc.id, 'National');
  const dgcDir = await upsertClass(dgcAg.id, 'DIRECTOR', 'Director / DGC Member');
  await upsertRule(dgcAg.id, { classificationId: dgcDir.id, label: 'DGC Pension & Insurance — placeholder', rateType: 'PENSION_HEALTH', calcMethod: 'PERCENT', value: 0.10, base: 'GROSS', currency: 'CAD', glAccountCode: GL.PH, sourceId: sDgc.id, effectiveDate: '2024-01-01', isEstimate: true, notes: 'Placeholder ~10%; confirm DGC P&I from current national agreement.' });

  const caStatAg = await upsertAgreement(caGov.id, 'Canada Employer Payroll 2025', ALL_TYPES, '2025-01-01', '2025-12-31', sCra.id, 'Federal');
  await upsertRule(caStatAg.id, { label: 'CPP (employer)', rateType: 'EMPLOYER_TAX', calcMethod: 'PERCENT_WITH_CAP', value: 0.0595, base: 'TAXABLE', capPeriod: 'ANNUAL', capAmount: 71300, currency: 'CAD', glAccountCode: GL.TAX, sourceId: sCra.id, effectiveDate: '2025-01-01', isEstimate: true, notes: 'CPP employer 5.95% to YMPE CAD 71,300 (basic exemption CAD 3,500 ignored at line level).' });
  await upsertRule(caStatAg.id, { label: 'EI (employer 1.4×)', rateType: 'EMPLOYER_TAX', calcMethod: 'PERCENT_WITH_CAP', value: 0.02296, base: 'TAXABLE', capPeriod: 'ANNUAL', capAmount: 65700, currency: 'CAD', glAccountCode: GL.TAX, sourceId: sCra.id, effectiveDate: '2025-01-01', isEstimate: true, notes: 'EI employer 2.296% (1.4× employee 1.64%) to MIE ~CAD 65,700.' });

  // ════════════════════════════════════════════════════════════════════════════
  // UNITED KINGDOM
  // ════════════════════════════════════════════════════════════════════════════
  const equity = await upsertBody('UNION', 'Equity (UK)', 'Equity', uk.id, 'https://www.equity.org.uk');
  const bectu = await upsertBody('UNION', 'BECTU', 'BECTU', uk.id, 'https://bectu.org.uk');
  const ukGov = await upsertBody('STATUTORY', 'UK HMRC Employer (NI & Pension)', 'UK Statutory', uk.id, 'https://www.gov.uk');

  const sEquity = await upsertSource(equity.id, 'Equity/PACT Cinema Films Agreement', 'https://www.equity.org.uk', 'Equity');
  const sBectu = await upsertSource(bectu.id, 'BECTU/PACT Feature Film Agreement', 'https://bectu.org.uk', 'BECTU');
  const sHmrc = await upsertSource(ukGov.id, 'HMRC Rates & thresholds for employers 2025–2026', 'https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2025-to-2026', 'HMRC');

  const equityAg = await upsertAgreement(equity.id, 'Equity/PACT Cinema Films Agreement', SCRIPTED, '2024-04-06', null, sEquity.id, 'PACT');
  const eqPerf = await upsertClass(equityAg.id, 'PERFORMER', 'Performer');
  await upsertRule(equityAg.id, { classificationId: eqPerf.id, label: 'Equity Pension (employer)', rateType: 'PENSION', calcMethod: 'PERCENT', value: 0.06, base: 'GROSS', currency: 'GBP', glAccountCode: GL.PH, sourceId: sEquity.id, effectiveDate: '2024-04-06', isEstimate: true, notes: 'PACT/Equity employer pension contribution ~6% of fee (where pensionable); confirm.' });

  const bectuAg = await upsertAgreement(bectu.id, 'BECTU/PACT Feature Film Agreement', SCRIPTED, '2024-04-06', null, sBectu.id, 'PACT');
  const beCrew = await upsertClass(bectuAg.id, 'CREW', 'Production Crew');
  await upsertRule(bectuAg.id, { classificationId: beCrew.id, label: 'BECTU Pension (employer) — placeholder', rateType: 'PENSION', calcMethod: 'PERCENT', value: 0.05, base: 'GROSS', currency: 'GBP', glAccountCode: GL.PH, sourceId: sBectu.id, effectiveDate: '2024-04-06', isEstimate: true, notes: 'Placeholder; confirm crew pension % in current BECTU/PACT agreement.' });

  const ukStatAg = await upsertAgreement(ukGov.id, 'UK Employer NI & Auto-Enrolment 2025–2026', ALL_TYPES, '2025-04-06', '2026-04-05', sHmrc.id, 'Statutory');
  await upsertRule(ukStatAg.id, { label: 'Employer National Insurance (Class 1)', rateType: 'EMPLOYER_TAX', calcMethod: 'PERCENT', value: 0.15, base: 'GROSS', floorAmount: null, currency: 'GBP', glAccountCode: GL.TAX, sourceId: sHmrc.id, effectiveDate: '2025-04-06', isEstimate: true, notes: 'Secondary Class 1 NIC 15% on earnings above GBP 5,000/yr secondary threshold (threshold not netted at line level — slight over-estimate).' });
  await upsertRule(ukStatAg.id, { label: 'Workplace Pension (auto-enrolment, employer)', rateType: 'PENSION', calcMethod: 'PERCENT', value: 0.03, base: 'GROSS', currency: 'GBP', glAccountCode: GL.PH, sourceId: sHmrc.id, effectiveDate: '2025-04-06', isEstimate: true, notes: 'Statutory minimum employer 3% on qualifying earnings.' });

  // ════════════════════════════════════════════════════════════════════════════
  // UNITED ARAB EMIRATES (statutory only — no film unions)
  // ════════════════════════════════════════════════════════════════════════════
  const mohre = await upsertBody('STATUTORY', 'UAE MOHRE (End-of-Service & WPS)', 'UAE MOHRE', uae.id, 'https://u.ae');
  const sMohre = await upsertSource(mohre.id, 'UAE Federal Decree-Law No. 33 of 2021 — End-of-Service Benefits', 'https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector/end-of-service-benefits-for-employees-in-the-private-sector', 'UAE Government');

  const uaeAg = await upsertAgreement(mohre.id, 'UAE Statutory Employment Burden', ALL_TYPES, '2022-02-02', null, sMohre.id, 'Statutory');
  await upsertRule(uaeAg.id, { label: 'End-of-Service Gratuity (accrual)', rateType: 'STATUTORY_GRATUITY', calcMethod: 'PERCENT', value: 0.0575, base: 'STRAIGHT_TIME', currency: 'AED', glAccountCode: GL.GRAT, sourceId: sMohre.id, effectiveDate: '2022-02-02', isEstimate: true, notes: '21 days basic salary per year (first 5 yrs) ≈ 5.75% accrual of basic wage; 30 days/yr (~8.2%) thereafter. Allowances excluded. Most film crew are short-term; apply per engagement.' });
  await upsertRule(uaeAg.id, { label: 'Employee Visa & Work Permit (per engagement) — placeholder', rateType: 'OTHER', calcMethod: 'PERCENT', value: 0.0, base: 'GROSS', currency: 'AED', glAccountCode: GL.TAX, sourceId: sMohre.id, effectiveDate: '2022-02-02', isEstimate: true, notes: 'Visa/permit are flat per-person costs, not a % — model as a budget line. Placeholder rule at 0%.' });

  // ════════════════════════════════════════════════════════════════════════════
  // PRODUCTION INCENTIVES & TAX CREDITS (cited; figures are estimates — confirm)
  // ════════════════════════════════════════════════════════════════════════════
  await upsertIncentive({
    geoNodeId: ga_st.id, name: 'Georgia Film Tax Credit', authority: 'Georgia Dept. of Revenue',
    incentiveType: 'TAX_CREDIT', ratePct: 0.20, upliftPct: 0.10, basis: 'QUALIFIED', minSpend: 500000,
    transferable: true, currency: 'USD', productionTypes: ['FEATURE', 'TV_SERIES', 'SHORT'],
    sourceTitle: 'Georgia Film Tax Credits — DOR', sourceUrl: 'https://dor.georgia.gov/film-tax-credits',
    effectiveDate: '2025-07-01', isEstimate: true,
    notes: '20% base transferable credit + 10% GEP uplift (logo/marketing). USD 500k minimum spend. No annual cap. Confirm qualified-spend definition.',
    complianceRules: { auditRequired: true, auditorRequirement: 'GDOR itself or a GDOR-certified Eligible Auditor; GDOR reviews third-party audits before final certification', auditDeadlineDays: null, dedicatedBankAccount: false, localEntityRequired: false, eligibilityConditions: ['Mandatory audit for ALL projects since 2023-01-01 (first come, first served queue)', 'GA promotional logo for the 10% uplift', 'USD 500k minimum qualified spend'] },
  });
  await upsertIncentive({
    geoNodeId: ny_st.id, name: 'New York Film Production Credit', authority: 'NYS / Empire State Development',
    incentiveType: 'TAX_CREDIT', ratePct: 0.30, basis: 'QUALIFIED', refundable: true, currency: 'USD',
    productionTypes: ['FEATURE', 'TV_SERIES'], sourceTitle: 'NY Film Tax Credit Program', sourceUrl: 'https://esd.ny.gov/film-tax-credit-program-production',
    effectiveDate: '2025-01-01', isEstimate: true, notes: '~30% refundable credit on qualified production costs (uplifts available upstate). Confirm current rate & cap.',
    complianceRules: { auditRequired: false, auditorRequirement: 'Program application review by ESD; no mandatory independent CPA audit found — verify per allocation letter', auditDeadlineDays: null, dedicatedBankAccount: false, localEntityRequired: false, eligibilityConditions: ['Min spend USD 1M NYC metro / 250k upstate', 'Multi-year refund payout schedule'] },
  });
  await upsertIncentive({
    geoNodeId: ca_st.id, name: 'California Film & TV Tax Credit', authority: 'California Film Commission',
    incentiveType: 'TAX_CREDIT', ratePct: 0.20, basis: 'QUALIFIED', currency: 'USD',
    productionTypes: ['FEATURE', 'TV_SERIES'], sourceTitle: 'CA Film Commission — Tax Credit', sourceUrl: 'https://film.ca.gov/tax-credit/',
    effectiveDate: '2025-01-01', isEstimate: true, notes: '~20–25% non-transferable credit on qualified spend (uplifts apply). Allocation-capped program. Confirm current rate.',
    complianceRules: { auditRequired: true, auditorRequirement: 'CPA Agreed-Upon-Procedures (AUP) report; CPA must have attended CFC orientation and be INDEPENDENT — cannot be the production/post accountant', auditDeadlineDays: null, dedicatedBankAccount: false, localEntityRequired: false, eligibilityConditions: ['AUP + final documentation required before final tax credit certificate'] },
  });
  await upsertIncentive({
    geoNodeId: canada.id, name: 'Canada PSTC (federal)', authority: 'CRA / CAVCO',
    incentiveType: 'TAX_CREDIT', ratePct: 0.16, basis: 'LABOR', refundable: true, currency: 'CAD',
    productionTypes: ['FEATURE', 'TV_SERIES'], sourceTitle: 'Film or Video Production Services Tax Credit', sourceUrl: 'https://www.canada.ca/en/canadian-heritage/services/funding/cavco-tax-credits/production-services.html',
    effectiveDate: '2025-01-01', isEstimate: true, notes: '16% federal PSTC on qualified Canadian labour expenditure (provincial credits stack, e.g. ON/BC). Confirm provincial layer separately.',
    complianceRules: { auditRequired: true, auditorRequirement: 'Audited cost report required when production costs exceed CAD 500,000; CAVCO/CRA may request records and audit access', auditDeadlineDays: null, dedicatedBankAccount: false, localEntityRequired: true, eligibilityConditions: ['Canadian permanent establishment / eligible production corporation', 'Audited cost report > CAD 500k', 'Provincial credits have their own completion checklists'] },
  });
  await upsertIncentive({
    geoNodeId: uk.id, name: 'UK Audiovisual Expenditure Credit (AVEC) — Film', authority: 'HMRC / BFI',
    incentiveType: 'TAX_CREDIT', ratePct: 0.255, basis: 'QUALIFIED', currency: 'GBP',
    productionTypes: ['FEATURE', 'TV_SERIES'], sourceTitle: 'Claim Audio-Visual Expenditure Credits — GOV.UK', sourceUrl: 'https://www.gov.uk/guidance/claim-audio-visual-expenditure-credits-for-corporation-tax',
    effectiveDate: '2025-04-01', isEstimate: true, notes: '34% gross credit, taxable at 25% CT → ~25.5% net benefit on qualifying UK core expenditure (capped at lower of 80% of core spend or actual UK spend). Enhanced VFX rate available.',
    complianceRules: { auditRequired: true, auditorRequirement: "Accountant's report at BFI final certification (cultural-test sections C/D and all co-productions) by a Companies Act 2006 s.1212-eligible auditor; AVEC itself claimed via HMRC CT self-assessment", auditDeadlineDays: null, dedicatedBankAccount: false, localEntityRequired: true, eligibilityConditions: ['UK production company within CT', 'BFI cultural test certification (interim + final)', "Accountant's report verifies UK expenditure split and personnel residence"] },
  });
  await upsertIncentive({
    geoNodeId: uae.id, name: 'Abu Dhabi Film Rebate (35%++)', authority: 'Abu Dhabi Film Commission (ADFC)',
    incentiveType: 'CASH_REBATE', ratePct: 0.35, basis: 'QUALIFIED', refundable: true, currency: 'AED',
    capAmount: 36725000, // feature/IMAX/HETV cap (AED 36.725M ≈ USD 10M); lower for other formats
    productionTypes: ['FEATURE', 'TV_SERIES', 'SHORT', 'TVC', 'MUSIC_VIDEO', 'DOCUMENTARY'],
    sourceTitle: 'ADFC Rebate Guidelines 2025', sourceUrl: 'https://www.film.gov.ae/35-rebate',
    effectiveDate: '2025-01-01', isEstimate: true,
    notes: [
      'STANDARD 35% cash rebate of ADQPE (Abu Dhabi Qualifying Production Expenditure) — physical production & post incurred in Abu Dhabi (Clause 1.2/1.6). Discretionary, not automatic.',
      'ENHANCED rebate 2.5%–15% of ADQPE by Points Banding (Clause 6.10): 10–14 pts → 2.5%; 15–39 → 5%; 40–69 → 7.5%; 70–84 → 10%; 85+ → 15%. Max total Rebate 50%. ER criteria e.g. Featuring Abu Dhabi = 20 pts; Featuring UAE national history/culture/identity/values = 10 pts; UAE national in ATL role; full post in Abu Dhabi. Enhanced applies to narrative/animated Features, IMAX, TV programmes/series & HETV drama only — NOT short-form, entertainment shows or documentaries.',
      'CAPS (max Rebate payment, production or production+post): Feature/IMAX/HETV Drama AED 36,725,000 (USD 10M); TV Programme/Series & Entertainment Shows AED 7,345,000 (USD 2M); Short Form (shorts/TVCs/music videos) AED 1,836,250 (USD 500k). Post-only caps are lower.',
      'ADQPE = BTL UAE-resident crew (valid residence/freelancer/short-term permits) + Abu Dhabi-licensed production & post services.',
      'PROCESS (Clause 3): (1) Apply ≥30 business days before principal photography with itemised budget + ADQPE worksheet, executed financier agreement(s), production services agreement, insurance binder. (2) Interim Certificate within 30 business days of an approved application. (3) Principal photography within 90 days of Interim Certificate (extendable to 120). (4) Audited expenditure statement by an ADFC-approved auditor within 180 days of completing PP/post. (5) Final Certificate. (6) Payment to the Abu Dhabi-registered applicant within 30 business days of Final Certificate.',
      'Set the qualified-spend figure to ADQPE only (not the whole budget). Requires content approval (Media Council / CMA). Confirm current rules with ADFC.',
    ].join(' '),
    complianceRules: { auditRequired: true, auditorRequirement: 'Independent auditor with entertainment-industry experience, PRE-APPROVED by ADFC; delivers Audited Expenditure Statement + auditor working spreadsheets verifying ADQPE and disqualified expenses', auditDeadlineDays: 180, dedicatedBankAccount: true, localEntityRequired: true, qualifyingSpendRules: 'ADQPE = UAE-resident crew (valid permits) + Abu Dhabi-licensed production/post vendors; VAT excluded', eligibilityConditions: ['Abu Dhabi-registered applicant entity (rebate paid to it)', 'DEDICATED production bank account for the project (audit trail: bank ↔ books ↔ ADQPE)', 'Audited Expenditure Statement within 180 days of completing PP/post in Abu Dhabi', 'Apply ≥30 business days before principal photography', 'Content approval (Media Council/CMA)'] },
  });

  // ── KSA / Qatar / Jordan (researched & cited June 2026 — figures verified against
  //    official commission sites + ≥2 trade sources; confirm before reliance) ──────────
  await upsertIncentive({
    geoNodeId: ksa.id, name: 'Film Saudi Cash Rebate (up to 60%)', authority: 'Saudi Film Commission (Ministry of Culture) / Cultural Development Fund',
    incentiveType: 'CASH_REBATE', ratePct: 0.60, basis: 'QUALIFIED', refundable: true, currency: 'SAR',
    minSpend: 750000, // SAR 750,000 (~USD 200k) for feature films; docs/animation SAR 187,000
    productionTypes: ['FEATURE', 'DOCUMENTARY'],
    sourceTitle: 'Film Saudi — Incentive Program (film.sa)', sourceUrl: 'https://film.sa/incentive-programs/',
    effectiveDate: '2026-05-15', isEstimate: true,
    notes: [
      'UP TO 60% rebate on eligible IN-KINGDOM production expenses (raised from 40% at Cannes, 15 May 2026; uplift criteria not publicly itemised — set per incentive agreement).',
      'Minimum spend: SAR 750,000 (~USD 200k) feature films; SAR 187,000 (~USD 50k) feature documentaries & animation. Minimum 5 filming days with main unit. No published per-project cap.',
      'Eligible: feature films, feature documentaries, feature animation (TV eligibility unconfirmed officially). Requires KSA commercial register / local entity or official Saudi co-production partner; government entities excluded.',
      'Qualifying spend: ATL fees, BTL wages, location & equipment rental, services, set construction, accommodation, travel to KSA, post — ALL in-Kingdom with KSA suppliers only. VAT typically excluded from qualifying spend.',
      'PROCESS: pre-approval MANDATORY — incentive agreement signed before principal photography. Apply at film.sa (~15 documents incl. GCAM licence, script content clearance, shooting NOC, EN+AR script). Paid after Film Commission approval of final audit. Tax notes: KSA VAT 15%; WHT 5/15/20% on non-resident payments; ATA carnet accepted since 1 Jun 2024.',
      'Confirm current terms at film.sa — programme updated May 2026.',
    ].join(' '),
    complianceRules: { auditRequired: true, auditorRequirement: 'Final audit reviewed/approved by the Saudi Film Commission before payment; KSA-registered entity books auditable', auditDeadlineDays: null, dedicatedBankAccount: false, localEntityRequired: true, qualifyingSpendRules: 'In-Kingdom spend with KSA suppliers only; VAT typically excluded', eligibilityConditions: ['KSA commercial register or official Saudi co-production partner', 'Incentive agreement signed BEFORE principal photography (pre-approval mandatory)', 'Minimum 5 filming days; min spend SAR 750k features / 187k docs-animation', 'Paid after Film Commission approval of final audit'] },
  });
  await upsertIncentive({
    geoNodeId: alula.id, name: 'Film AlUla Enhanced Rebate (uplift to 50% + 10%)', authority: 'Film AlUla (Royal Commission for AlUla)',
    incentiveType: 'CASH_REBATE', ratePct: 0.40, upliftPct: 0.10, basis: 'QUALIFIED', refundable: true, currency: 'SAR',
    productionTypes: ['FEATURE', 'TV_SERIES', 'DOCUMENTARY', 'TVC'],
    sourceTitle: 'Film AlUla — Financial Incentives', sourceUrl: 'https://filming.experiencealula.com/financial-incentives',
    effectiveDate: '2024-01-01', isEstimate: true,
    notes: [
      'Layered on the national Film Saudi rebate for AlUla shoots: up to 40% on eligible local spend, rising to 50% when Saudi nationals fill key production roles, PLUS up to 10% additional for crew training, marketing, showcasing Saudi culture/landscapes/heritage, and inclusivity deliverables.',
      'Incentives pre-assessed and tailored per production against agreed deliverables; company must be KSA-registered or partnered with a Saudi entity. In-kind: AlUla Studios soundstages/backlot, visas/permits, accommodation support.',
      'NOTE: interaction with the new 60% national headline (May 2026) not yet published — confirm stacking directly with Film AlUla before budgeting.',
    ].join(' '),
    complianceRules: { auditRequired: true, auditorRequirement: 'Deliverables-based assessment against the pre-agreed incentive package; verification by Film AlUla', auditDeadlineDays: null, dedicatedBankAccount: false, localEntityRequired: true, eligibilityConditions: ['KSA-registered or Saudi-partnered company', 'Pre-assessed deliverables (training, marketing, culture, inclusivity) for uplifts'] },
  });
  await upsertIncentive({
    geoNodeId: qatar.id, name: 'Qatar Screen Production Incentive (QSPI, up to 50%)', authority: 'Film Committee at Media City Qatar',
    incentiveType: 'CASH_REBATE', ratePct: 0.40, upliftPct: 0.10, basis: 'QUALIFIED', refundable: true, currency: 'QAR',
    productionTypes: ['FEATURE', 'TV_SERIES', 'DOCUMENTARY', 'TVC', 'OTHER'],
    sourceTitle: 'DFI press release — Qatar launches QSPI (21 Nov 2025)', sourceUrl: 'https://www.dohafilm.com/en/press/press-releases/qatar-launches-qatar-screen-production-incentive-qspi-programme-one-worlds',
    effectiveDate: '2025-11-21', isEstimate: true,
    notes: [
      'Launched 21 Nov 2025 at Doha Film Festival: 40% base + up to 10% uplift (Qatari talent, local training, Qatari culture, tourism integration, global promotion, local spend) = up to 50% of qualifying expenditure. APPLICATIONS OPEN FROM Q2 2026.',
      'Up to 25% of total qualifying expenditure may be incurred in selected neighbouring Arab countries (per official application form: Egypt, Iraq, Jordan, Kuwait, Lebanon, Oman, Syria).',
      'Eligible: features, scripted/unscripted TV, documentaries, commercials, post/VFX-only. Applicable ONLY to Qatari entities (incl. SPVs) licensed by Media City Qatar — foreign producers need an MCQ-licensed local entity/SPV.',
      'CAPS / MINIMUM SPEND NOT YET PUBLISHED — detailed guidelines pending from the Film Committee; treat all figures as provisional. Apply via mediacity.qa (legal@mediacity.qa).',
      'Tax notes: NO VAT in Qatar (2026); 5% WHT on service payments to non-residents without a Qatar tax card; CIT 10% on Qatar-source income of foreign-owned entities. DFI grants (≤USD 100k, director-nationality-restricted) are separate and unchanged.',
    ].join(' '),
    complianceRules: { auditRequired: null, auditorRequirement: 'TBD — detailed guidelines pending from the Film Committee (applications from Q2 2026); SPV structure implies dedicated project accounting', auditDeadlineDays: null, dedicatedBankAccount: null, localEntityRequired: true, eligibilityConditions: ['Qatari entity or SPV licensed by Media City Qatar', 'Up to 25% of qualifying spend allowed in selected Arab countries', 'CONFIRM audit & bank rules when guidelines publish'] },
  });
  await upsertIncentive({
    geoNodeId: jordan.id, name: 'Jordan RFC Cash Rebate (25–45%)', authority: 'The Royal Film Commission — Jordan (RFC)',
    incentiveType: 'CASH_REBATE', ratePct: 0.25, upliftPct: 0.20, basis: 'QUALIFIED', refundable: true, currency: 'USD',
    minSpend: 250000, capAmount: 5250000, // USD; cap negotiable upward case-by-case
    productionTypes: ['FEATURE', 'TV_SERIES', 'DOCUMENTARY', 'TVC', 'MUSIC_VIDEO', 'OTHER'],
    sourceTitle: 'RFC — Cash Rebate (film.jo)', sourceUrl: 'https://www.film.jo/cash-rebate',
    effectiveDate: '2025-05-14', isEstimate: true,
    notes: [
      'Scalable 25%–45% of qualifying in-Jordan spend (approved May 2025), points-based: project size + Jordanian cultural content + artistic/economic value. Top 45% tier: spend > USD 10M + Jordanian cultural elements. Local Jordanian productions: 30% (> USD 500k).',
      'Minimum spend USD 250,000; per-project cap USD 5.25M (higher possible case-by-case); 10% advance (max USD 100k) against bank guarantee; rebate paid within 150 days of CPA-audited expenditure reports. Requires Jordanian tax-resident applicant / local production company.',
      'Qualifying: Jordanian crew/cast salaries, travel on Jordanian national carrier, equipment/facility rental, accommodation/catering/transport in Jordan, studio & set builds, up to 15% of post performed in Jordan.',
      'STACKS with RFC tax exemptions (separate approval, ≥30 days before principal photography; pre-production must start within 90 days of approval; "Filmed in Jordan" credit mandatory): GST 16% exemption on production purchases, customs duty exemption on imported equipment, income tax exemption on non-Jordanian cast/crew salaries (10% WHT). Combined savings marketed up to ~56%.',
      'Tax notes: Jordan GST 16%; WHT 10% on imported services from non-resident entities; NO ATA carnet — temporary import via customs procedures or the RFC exemption letter.',
    ].join(' '),
    complianceRules: { auditRequired: true, auditorRequirement: 'CPA-audited expenditure reports; rebate paid within 150 days of submission', auditDeadlineDays: null, dedicatedBankAccount: false, localEntityRequired: true, qualifyingSpendRules: 'In-Jordan spend incl. Jordanian crew/cast, national-carrier travel, ≤15% of post done in Jordan', eligibilityConditions: ['Jordanian tax-resident applicant / local production company', 'CPA-audited expenditure reports for payout', 'Tax exemptions need separate RFC approval ≥30 days before PP; pre-production within 90 days', '"Filmed in Jordan" credit mandatory'] },
  });

  // counts
  const counts = {
    geo: await prisma.geoNode.count(),
    bodies: await prisma.laborBody.count(),
    agreements: await prisma.agreement.count(),
    classifications: await prisma.classification.count(),
    rules: await prisma.rateRule.count(),
    sources: await prisma.rateSource.count(),
    incentives: await prisma.incentiveProgram.count(),
  };
  console.log('Done.', counts);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
