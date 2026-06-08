/* eslint-disable @typescript-eslint/no-var-requires */
// Seed & backfill for the V1.1 enhancement schema (run AFTER `prisma db push` + `prisma generate`):
//   node prisma/seed-jurisdiction.js
//
// Does four things, all idempotent (safe to re-run):
//   1. Finds (or creates) the UAE GeoNode — reuses the one from seed-labor.js.
//   2. Backfills ProductionProject.productionCountryId → UAE for every project missing it.
//   3. Seeds the UAE VAT JurisdictionTaxRule (5% standard, input tax recoverable).
//   4. Seeds CoaMappingTable with identity mappings for every Master CoA account code
//      (Movie Magic exports that use the same numbering map 1:1; anything else gets
//      AI-suggested or manual mapping in the review table).

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Master CoA account codes — INDUSTRY-STANDARD Movie Magic / AICP numbering
// (docs/production/17). Account level, the grain the AI mapper and the import
// confirm step both target. Identity mappings: external MM code = our code.
const MASTER_ACCOUNTS = [
  // ATL (1000s)
  ['1100', 'Story, Rights & Continuity'], ['1200', 'Producers Unit'], ['1300', 'Directors Unit'],
  ['1400', 'Cast'], ['1500', 'Bits & Stunts'], ['1800', 'ATL Travel & Living'],
  // BTL (2000–4999)
  ['2000', 'Production Staff'], ['2100', 'Extra Talent'], ['2200', 'Set Design (Art)'],
  ['2300', 'Set Construction'], ['2400', 'Set Striking'], ['2500', 'Set Operations'],
  ['2600', 'Special Effects'], ['2700', 'Set Dressing'], ['2800', 'Property (Props)'],
  ['2900', 'Wardrobe'], ['3000', 'Picture Vehicles'], ['3100', 'Makeup & Hairstyling'],
  ['3200', 'Lighting / Electrical'], ['3300', 'Camera'], ['3400', 'Production Sound'],
  ['3500', 'Transportation'], ['3600', 'Location'], ['3700', 'Production Film & Lab / Digital'],
  ['3800', 'Travel & Living (BTL)'], ['4000', 'Production Facilities'], ['4100', 'Animals'],
  ['4200', 'Second Unit'], ['4400', 'Aerial Unit'], ['4500', 'Marine Unit'],
  ['4600', 'Health & Safety'], ['4800', 'Re-shoots'],
  // POST (5000s)
  ['5000', 'Post Staff & Facilities'], ['5100', 'Editing'], ['5200', 'Music'],
  ['5300', 'Video Post Sound'], ['5400', 'Visual Effects'], ['5500', 'Video Post Picture (DI)'],
  ['5600', 'Titles'], ['5700', 'Stock Footage & Deliverables'], ['5800', 'Post Travel & Living'],
  // OTHER (6000s)
  ['6300', 'Tests'], ['6400', 'Studio Expenses'], ['6500', 'Publicity / Marketing'],
  ['6700', 'Insurance'], ['6800', 'General Expense / Office'], ['6900', 'Contingency / Completion Bond'],
  // Distribution / corporate (optional 7000–9000 ledger)
  ['7100', 'Creative Materials'], ['7200', 'Media Buy (Advertising)'], ['7300', 'Publicity & PR'],
  ['7400', 'Print & Logistics'], ['7510', 'Sales & Licensing'], ['8100', 'Cost of Goods Sold'],
  ['9100', 'Corporate SG&A'],
];

async function main() {
  // 1 ── UAE GeoNode (reuse seed-labor.js node if present)
  let uae = await prisma.geoNode.findFirst({
    where: { level: 'COUNTRY', OR: [{ code: 'AE' }, { name: 'United Arab Emirates' }] },
  });
  if (!uae) {
    uae = await prisma.geoNode.create({ data: { level: 'COUNTRY', name: 'United Arab Emirates', code: 'AE' } });
    console.log('Created UAE GeoNode.');
  } else {
    console.log('Found existing UAE GeoNode:', uae.id);
  }

  // 2 ── Backfill productionCountryId on all projects missing it
  const backfilled = await prisma.productionProject.updateMany({
    where: { productionCountryId: null },
    data: { productionCountryId: uae.id },
  });
  console.log(`Backfilled productionCountry → UAE on ${backfilled.count} project(s).`);

  // 3 ── UAE VAT rule (idempotent by geoNode + name)
  const vatName = 'UAE Standard VAT';
  const existingVat = await prisma.jurisdictionTaxRule.findFirst({ where: { geoNodeId: uae.id, name: vatName } });
  if (!existingVat) {
    await prisma.jurisdictionTaxRule.create({
      data: {
        geoNodeId: uae.id,
        taxKind: 'VAT',
        name: vatName,
        ratePct: 5.0,
        recoverable: true,
        recoveryPct: 100.0,
        rules: {
          registrationThresholdAED: 375000,
          zeroRated: ['Exports of services outside GCC', 'International transport'],
          blockedInputTax: ['Entertainment provided to non-employees', 'Personal-use motor vehicles'],
          reverseCharge: 'Imported services from abroad — reverse-charge mechanism applies',
          note: 'Confirm treatment with your tax adviser; this drives AI suggestions only.',
        },
        effectiveDate: new Date('2018-01-01'),
        sourceUrl: 'https://tax.gov.ae',
        isActive: true,
      },
    });
    console.log('Seeded UAE Standard VAT (5%, recoverable).');
  } else {
    console.log('UAE VAT rule already present — skipped.');
  }

  // 3b ── KSA / Qatar / Jordan tax rules (researched & cited June 2026)
  const countries = [
    { name: 'Saudi Arabia', code: 'SA' },
    { name: 'Qatar', code: 'QA' },
    { name: 'Jordan', code: 'JO' },
  ];
  const geoByCode = {};
  for (const c of countries) {
    let node = await prisma.geoNode.findFirst({ where: { level: 'COUNTRY', OR: [{ code: c.code }, { name: c.name }] } });
    if (!node) node = await prisma.geoNode.create({ data: { level: 'COUNTRY', name: c.name, code: c.code } });
    geoByCode[c.code] = node;
  }

  const taxRules = [
    {
      geo: 'SA', taxKind: 'VAT', name: 'KSA Standard VAT', ratePct: 15.0,
      recoverable: true, recoveryPct: 100.0,
      rules: {
        inForceSince: '2020-07-01',
        nonResidentRefund: 'Articles 70/72 VAT Implementing Regulations — refund scheme for non-residents WITHOUT a KSA establishment, subject to home-country RECIPROCITY (practical gatekeeper; US doubtful). Min claim SAR 1,000; file within 6 months of calendar year-end.',
        localEntity: 'A KSA-registered SPV/co-production entity (required for the Film Saudi rebate anyway) registers for VAT normally and deducts input VAT through returns.',
        filmSpecificRelief: 'NONE — no film zero-rating/exemption. VAT typically EXCLUDED from rebate qualifying spend.',
        wht: 'Withholding on payments to non-residents: 5% rent/technical services, 15% royalties/other, 20% management fees. Remit within 10 days of following month.',
        customs: 'ATA carnet accepted at all ports since 1 Jun 2024 (max 6 months, mandatory re-export).',
        note: 'Decision-support only — confirm with tax adviser.',
      },
      effectiveDate: new Date('2020-07-01'), sourceUrl: 'https://zatca.gov.sa/en/RulesRegulations/VAT/Pages/default.aspx',
    },
    {
      geo: 'QA', taxKind: 'VAT', name: 'Qatar — No VAT (2026)', ratePct: 0.0,
      recoverable: false, recoveryPct: 0.0,
      rules: {
        status: 'No VAT or sales tax as of 2026. GCC VAT framework (5%) signed but NOT implemented in Qatar — monitor.',
        wht: '5% final WHT on royalties, interest, commissions and service fees paid to non-residents without a Qatar tax card/PE. Remit by 16th of following month (Dhareeba).',
        cit: '10% corporate income tax on Qatar-source income of foreign-owned entities; PE risk from 183+ days of project/service presence.',
        customs: '5% GCC customs duty on non-GCC goods; ATA carnet via Qatar Chamber — routine acceptance for film gear UNCONFIRMED, verify before shipping.',
        note: 'Decision-support only — confirm with tax adviser.',
      },
      effectiveDate: new Date('2019-01-01'), sourceUrl: 'https://gta.gov.qa/en/taxes-info',
    },
    {
      geo: 'JO', taxKind: 'VAT', name: 'Jordan General Sales Tax (GST)', ratePct: 16.0,
      recoverable: true, recoveryPct: 100.0,
      rules: {
        rfcExemption: 'UPFRONT GST exemption via Royal Film Commission approval (Cabinet Resolution 5437/2014) on goods/services purchased in Jordan solely for the production — apply ≥30 days before principal photography; exemption letter within 30 days; expenses BEFORE the letter date NOT covered; pre-production must start within 90 days; "Filmed in Jordan" credit mandatory.',
        alsoExempt: 'Customs duties on imported production equipment + income tax on non-Jordanian cast/crew salaries (10% WHT) under the same RFC package.',
        wht: '10% WHT on imported services from non-resident entities; 5% resident natural persons.',
        customs: 'NO ATA carnet in Jordan — temporary import via customs procedures (serialised gear list, ~7 working days) or RFC exemption letter.',
        note: 'Recovery in practice = use the RFC exemption rather than refund claims. Decision-support only — confirm with tax adviser.',
      },
      effectiveDate: new Date('2014-09-03'), sourceUrl: 'https://film.jo/tax-exemption',
    },
  ];
  for (const t of taxRules) {
    const geoNode = geoByCode[t.geo];
    const exists = await prisma.jurisdictionTaxRule.findFirst({ where: { geoNodeId: geoNode.id, name: t.name } });
    if (exists) { console.log(`${t.name} already present — skipped.`); continue; }
    await prisma.jurisdictionTaxRule.create({
      data: {
        geoNodeId: geoNode.id, taxKind: t.taxKind, name: t.name, ratePct: t.ratePct,
        recoverable: t.recoverable, recoveryPct: t.recoveryPct, rules: t.rules,
        effectiveDate: t.effectiveDate, sourceUrl: t.sourceUrl, isActive: true,
      },
    });
    console.log(`Seeded ${t.name}.`);
  }

  // 4 ── Starter Movie Magic → Master CoA identity mappings
  let created = 0, kept = 0;
  for (const [code, title] of MASTER_ACCOUNTS) {
    const existing = await prisma.coaMappingTable.findUnique({
      where: { sourceSystem_externalCode: { sourceSystem: 'MOVIE_MAGIC', externalCode: code } },
    });
    if (existing) { kept++; continue; }
    await prisma.coaMappingTable.create({
      data: {
        sourceSystem: 'MOVIE_MAGIC',
        externalCode: code,
        externalLabel: title,
        masterCode: code,
        masterTitle: title,
        isActive: true,
        notes: 'Starter identity mapping (seed-jurisdiction.js)',
      },
    });
    created++;
  }
  console.log(`CoA mappings: ${created} created, ${kept} already present.`);

  console.log('\nDone. The AI import review is now fully operational.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
