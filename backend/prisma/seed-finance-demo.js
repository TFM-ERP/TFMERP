/**
 * DEMO SEED — Finance build for project PRD-2026-0016.
 * Populates every new finance table so the whole production-accounting epic shows live data:
 *   • ProjectTransaction actuals (COST/INCOME, APPROVED/PAID, journalEntryId null → "Sync to GL")
 *   • PurchaseRequest (requisitions) in DRAFT/SUBMITTED/APPROVED
 *   • CashAdvance · CardTransaction · ExpenseClaim (various states)
 *   • Timecard (APPROVED, unposted → Payroll Run "eligible to post")
 *   • DailyProductionReport (+ hot costs)
 *   • ProjectBankRecon (open, with statement balance)
 *
 * Idempotent (tagged "DEMOFIN" / *-DEMO-* numbers). RUN AFTER `npm run db:push`:
 *   cd backend && node prisma/seed-finance-demo.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const PRJ = 'PRD-2026-0016';
const TAG = 'DEMOFIN';
const at = (days) => { const d = new Date(); d.setHours(9, 0, 0, 0); d.setDate(d.getDate() + days); return d; };
const r2 = (n) => Math.round(n * 100) / 100;

async function main() {
  // guard: schema must be migrated
  if (!prisma.cashAdvance || !prisma.purchaseRequest || !prisma.dailyProductionReport || !prisma.productionPayrollRun || !prisma.projectBankRecon) {
    console.error('✗ New finance models not found in the Prisma client. Run `npm run db:push` first, then re-run.'); process.exit(1);
  }
  const project = await prisma.productionProject.findUnique({ where: { projectNumber: PRJ } });
  if (!project) { console.error(`✗ Project ${PRJ} not found.`); process.exit(1); }
  const projectId = project.id, cur = project.currency || 'AED';
  console.log(`→ Seeding finance demo into ${project.title} (${PRJ})`);

  // cost-center codes from the active budget version (fallback to generic)
  const version = await prisma.budgetVersion.findFirst({ where: { projectId, isActive: true }, include: { sections: { include: { accounts: true } } } });
  let accts = (version?.sections || []).flatMap((s) => s.accounts.map((a) => ({ code: a.code, title: a.title })));
  if (!accts.length) accts = [{ code: '2000', title: 'Producers' }, { code: '3300', title: 'Camera' }, { code: '4500', title: 'Locations' }, { code: '6000', title: 'Post' }];
  const A = (i) => accts[i % accts.length];

  // ---- cleanup previous demo rows ----
  await prisma.projectTransaction.deleteMany({ where: { projectId, reference: { startsWith: 'DEMOFIN-' } } }).catch(() => {});
  await prisma.productionPayrollRun.deleteMany({ where: { projectId, label: { startsWith: 'DEMO ' } } }).catch(() => {});
  await prisma.timecard.deleteMany({ where: { projectId, name: { startsWith: '[DEMO] ' } } }).catch(() => {});
  await prisma.cashAdvance.deleteMany({ where: { projectId, notes: TAG } }).catch(() => {});
  await prisma.cardTransaction.deleteMany({ where: { projectId, notes: TAG } }).catch(() => {});
  await prisma.expenseClaim.deleteMany({ where: { projectId, claimNumber: { startsWith: 'EXP-DEMO-' } } }).catch(() => {});
  await prisma.purchaseRequest.deleteMany({ where: { projectId, prNumber: { startsWith: 'PR-DEMO-' } } }).catch(() => {});
  await prisma.dailyProductionReport.deleteMany({ where: { projectId, notes: TAG } }).catch(() => {});
  await prisma.projectBankRecon.deleteMany({ where: { projectId, label: { startsWith: 'DEMO ' } } }).catch(() => {});

  // ---- ProjectTransaction actuals (feed cost report + GL reconcile + vendor YTD + bank rec) ----
  const vendors = ['Filmquip Rental', 'Desert Catering Co', 'twofour54', 'Gulf Grip & Electric', 'Saadiyat Rotana', 'Oasis Fuel'];
  const txns = [
    { kind: 'COST', status: 'PAID', a: 0, total: 18500, party: vendors[0], desc: 'Camera & lens package — week 2' },
    { kind: 'COST', status: 'PAID', a: 3, total: 9200, party: vendors[1], desc: 'Crew catering — 3 days' },
    { kind: 'COST', status: 'APPROVED', a: 2, total: 5700, party: vendors[2], desc: 'Filming + drone permit fees' },
    { kind: 'COST', status: 'APPROVED', a: 1, total: 12400, party: vendors[3], desc: 'Grip & electric truck hire' },
    { kind: 'COST', status: 'PAID', a: 2, total: 7500, party: vendors[4], desc: 'Location fee deposit' },
    { kind: 'COST', status: 'PAID', a: 1, total: 3100, party: vendors[5], desc: 'Generator fuel' },
    { kind: 'COST', status: 'APPROVED', a: 3, total: 8800, party: vendors[0], desc: 'Additional camera day' },
    { kind: 'INCOME', status: 'RECEIVED', a: 0, total: 250000, party: 'Financier — Tranche 1', desc: 'Production funding tranche 1' },
  ];
  let ti = 0;
  for (const t of txns) {
    const acc = A(t.a);
    await prisma.projectTransaction.create({ data: {
      projectId, kind: t.kind, date: at(-10 + ti), accountCode: t.kind === 'COST' ? acc.code : null, accountTitle: t.kind === 'COST' ? acc.title : null,
      description: t.desc, party: t.party, reference: `DEMOFIN-${String(++ti).padStart(3, '0')}`,
      amount: t.total, taxAmount: 0, total: t.total, currency: cur, status: t.status,
      ...(t.status === 'PAID' ? { paidDate: at(-5 + ti) } : {}),
    } });
  }
  console.log(`  ✓ ${txns.length} ledger transactions (for cost report · GL reconcile · vendor YTD · bank rec)`);

  // ---- Purchase Requests (requisitions) ----
  const prs = [
    { st: 'DRAFT', a: 1, amt: 4200, v: 'Gulf Grip & Electric', d: 'Extra lighting package for night unit' },
    { st: 'SUBMITTED', a: 3, amt: 2600, v: 'Filmquip Rental', d: 'Additional matte box + filters' },
    { st: 'APPROVED', a: 2, amt: 5000, v: 'Al Dhafra Municipality', d: 'Site restoration bond' },
    { st: 'SUBMITTED', a: 0, amt: 1800, v: 'Desert Catering Co', d: 'VIP catering uplift' },
  ];
  let pi = 0;
  for (const p of prs) { const acc = A(p.a); await prisma.purchaseRequest.create({ data: { projectId, prNumber: `PR-DEMO-${String(++pi).padStart(3, '0')}`, description: p.d, costCenterCode: acc.code, costCenterTitle: acc.title, vendorName: p.v, amount: p.amt, currency: cur, status: p.st } }); }
  console.log(`  ✓ ${prs.length} purchase requests`);

  // ---- Cash advances ----
  const cas = [
    { holder: 'Marco Ferreira (1st AD)', amt: 5000, purpose: 'Petty cash float — set', cleared: 1800, status: 'PARTIALLY_CLEARED', a: 1 },
    { holder: 'Selma Cardoso (UPM)', amt: 8000, purpose: 'Location day expenses', cleared: 0, status: 'OUTSTANDING', a: 2 },
    { holder: 'Hassan Ali (LM)', amt: 3000, purpose: 'Site fees & access', cleared: 3000, status: 'CLEARED', a: 2 },
  ];
  for (const c of cas) { const acc = A(c.a); await prisma.cashAdvance.create({ data: { projectId, holderName: c.holder, purpose: c.purpose, amount: c.amt, clearedAmount: c.cleared, currency: cur, costCenterCode: acc.code, costCenterTitle: acc.title, dateIssued: at(-8), status: c.status, notes: TAG } }); }
  console.log(`  ✓ ${cas.length} cash advances`);

  // ---- Card transactions ----
  const cards = [
    { merchant: 'Carrefour — supplies', holder: 'L. Park', amt: 640, st: 'UNRECONCILED', a: null },
    { merchant: 'ENOC fuel', holder: 'R. Al Mansoori', amt: 410, st: 'CODED', a: 1 },
    { merchant: 'Jumbo Electronics', holder: 'A. Noor', amt: 1290, st: 'CODED', a: 3 },
    { merchant: 'Adobe (software)', holder: 'Production', amt: 320, st: 'POSTED', a: 0 },
  ];
  for (const c of cards) { const acc = c.a == null ? null : A(c.a); await prisma.cardTransaction.create({ data: { projectId, merchant: c.merchant, cardholderName: c.holder, amount: c.amt, currency: cur, txnDate: at(-6), costCenterCode: acc?.code || null, costCenterTitle: acc?.title || null, status: c.st, notes: TAG } }); }
  console.log(`  ✓ ${cards.length} card transactions`);

  // ---- Expense claims ----
  const claims = [
    { name: 'Henrik Larsson (DoP)', d: 'Taxi + meals on recce', amt: 380, st: 'SUBMITTED', a: 3 },
    { name: 'Fatima Yusuf (Costume)', d: 'Wardrobe sundries', amt: 220, st: 'APPROVED', a: 1 },
    { name: 'Pavel Novak (Key Grip)', d: 'Hardware store run', amt: 510, st: 'DRAFT', a: 1 },
    { name: 'Dana Haddad (LP)', d: 'Client lunch', amt: 640, st: 'REIMBURSED', a: 0 },
  ];
  let ci = 0;
  for (const c of claims) { const acc = A(c.a); await prisma.expenseClaim.create({ data: { projectId, claimNumber: `EXP-DEMO-${String(++ci).padStart(3, '0')}`, claimantName: c.name, description: c.d, amount: c.amt, currency: cur, costCenterCode: acc.code, costCenterTitle: acc.title, dateSubmitted: at(-4), status: c.st } }); }
  console.log(`  ✓ ${claims.length} expense claims`);

  // ---- Timecards (APPROVED, unposted → Payroll Run shows eligible) ----
  const crew = [['Henrik Larsson', 'DoP', 2500], ['Aisha Noor', '1st AC', 1200], ['Pavel Novak', 'Key Grip', 1400], ['Sami Rahman', 'Gaffer', 1400], ['Liang Wei', 'Sound Mixer', 1300], ['Nadia Costa', 'Prod Designer', 1800]];
  const laborAcc = accts.find((a) => /camera|crew|labor|grip|electric|6000|3/.test((a.code + a.title).toLowerCase())) || A(1);
  for (const [name, role, rate] of crew) {
    const days = 5, gross = days * rate, fringe = r2(gross * 0.18), total = r2(gross + fringe);
    await prisma.timecard.create({ data: { projectId, name: `[DEMO] ${name}`, role, accountCode: laborAcc.code, weekEnding: at(-3), days, dailyRate: rate, gross, fringe, total, status: 'APPROVED' } });
  }
  console.log(`  ✓ ${crew.length} approved timecards (eligible for a Payroll Run)`);

  // ---- Daily Production Reports (+ hot costs) ----
  const sheets = await prisma.callSheet.findMany({ where: { projectId }, orderBy: { shootDate: 'asc' }, take: 3 });
  const dprSeed = [
    { day: 12, scSched: 6, scShot: 5, pgSched: 4.25, pgShot: 3.75, ot: 2.5, meals: 1, est: 4200 },
    { day: 13, scSched: 5, scShot: 5, pgSched: 5.5, pgShot: 5.5, ot: 0, meals: 0, est: 1500 },
    { day: 14, scSched: 4, scShot: 3, pgSched: 3.0, pgShot: 2.25, ot: 4, meals: 3, est: 7800 },
  ];
  for (let i = 0; i < dprSeed.length; i++) {
    const s = dprSeed[i]; const cs = sheets[i];
    await prisma.dailyProductionReport.create({ data: {
      projectId, callSheetId: cs?.id || null, dayNumber: cs?.dayNumber || s.day, reportDate: cs?.shootDate || at(-3 + i), status: i < 2 ? 'APPROVED' : 'DRAFT',
      crewCall: cs?.generalCall || '05:30', firstShot: cs?.shootingCall || '07:00', unitWrap: cs?.estWrap || '19:30',
      weather: cs?.weather || 'Sunny', locationName: cs?.locationName || 'Abu Dhabi',
      scenesScheduled: s.scSched, scenesShot: s.scShot, pagesScheduled: s.pgSched, pagesShot: s.pgShot,
      otHours: s.ot, mealPenalties: s.meals, estimatedDayCost: s.est,
      hotCosts: [{ item: 'Overtime', category: 'Labor', amount: s.ot * 350 }, { item: 'Meal penalties', category: 'Labor', amount: s.meals * 200 }],
      castDays: [], incidents: [], scenesCompleted: [], notes: TAG,
    } });
  }
  console.log(`  ✓ ${dprSeed.length} daily production reports (+ hot costs)`);

  // ---- Bank reconciliation (open, statement = opening − paid disbursements, leaving a small diff) ----
  const paid = await prisma.projectTransaction.findMany({ where: { projectId, kind: 'COST', status: 'PAID' }, select: { total: true } });
  const paidTotal = paid.reduce((t, x) => t + Number(x.total), 0);
  await prisma.projectBankRecon.create({ data: { projectId, label: 'DEMO — Week 2 statement', statementDate: at(-1), openingBalance: 300000, statementBalance: r2(300000 - paidTotal + 1500), clearedTxnIds: [], status: 'OPEN', notes: TAG } });
  console.log(`  ✓ 1 bank reconciliation (open)`);

  console.log(`\n✅ Done. Open ${PRJ} → Cost Report (forecast + reports + financier pack), Purchasing (requisitions), Accounting (GL reconcile + payroll runs), Cash (advances/cards/claims + bank rec), Call Sheets (DPR).`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
