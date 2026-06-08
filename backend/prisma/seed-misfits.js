/* Sample production seed — "The Misfits" (feature film)
 * Run from the backend folder:  node prisma/seed-misfits.js
 * Idempotent: deletes any existing "The Misfits" project first, then recreates it.
 * Crew directory members are matched by name (reused if already present).
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const DETAIL = require('./misfits-budget.json'); // per-account detailed line items

const SHOOT_START = new Date('2019-01-01');
const SHOOT_END = new Date('2019-03-01');

// ── Budget (from the Misfits top sheet) ───────────────────────────────────────
const SECTIONS = [
  { code: '1000', title: 'Above The Line', color: '#7c3aed', accounts: [
    ['1100', 'Story Rights & Continuity', 213000],
    ['1200', 'Producers Unit', 597000],
    ['1300', 'Direction', 365000],
    ['1400', 'Cast', 3275441],
    ['1500', 'ATL Travel & Living', 245971.03],
    ['1900', 'Fringes & Taxes (ATL)', 252690],
  ]},
  { code: '2000', title: 'Production (Below The Line)', color: '#0891b2', accounts: [
    ['2000', 'Production Staff', 287038],
    ['2100', 'Extra Talent & Atmosphere', 42940],
    ['2200', 'Set Design', 108199],
    ['2300', 'Set Construction', 50353],
    ['2500', 'Set Operations', 53316],
    ['2600', 'Special Effects', 90064],
    ['2700', 'Set Dressing', 96830.2],
    ['2800', 'Property', 32960],
    ['2900', 'Wardrobe', 114052],
    ['3100', 'Make-up & Hairdressing', 59651],
    ['3200', 'Lighting & Electrical', 67264],
    ['3300', 'Camera & G&E Package', 422909],
    ['3400', 'Production Sound', 62902],
    ['3500', 'Transportation', 300111],
    ['3600', 'Locations', 310577.9],
    ['3700', 'Picture Vehicles & Animals', 95800],
    ['3800', 'Digital Media', 26998],
    ['4000', 'Second Unit', 110991],
    ['4100', 'US Unit', 350000],
    ['4300', 'BTL Travel & Living', 233226.4],
  ]},
  { code: '5000', title: 'Post Production', color: '#059669', accounts: [
    ['5000', 'Editing & Projection', 227376],
    ['5100', 'Music', 77000],
    ['5200', 'Post Production Sound', 80000],
    ['5300', 'Post Prod Film & Lab', 145000],
    ['5400', 'VFX Package', 56000],
    ['5500', 'Titles', 5000],
    ['5600', 'Fringes & Taxes (Post)', 32611],
  ]},
  { code: '6000', title: 'Other Costs', color: '#d97706', accounts: [
    ['6500', 'Publicity & Promotion', 10000],
    ['6700', 'Insurance', 95490],
    ['6800', 'Miscellaneous General Exp', 258520],
  ]},
  { code: '7000', title: 'Finance & Contingency', color: '#dc2626', accounts: [
    ['7200', 'Contingency', 350000],
  ]},
];

// Cost-to-date (actuals) by account code → seeded as approved expenses for Budget vs Actual
const ACTUALS = {
  '1100': 234100, '1200': 427009.63, '1300': 411750, '1400': 3232054.35, '1500': 156205.45, '1900': 272000,
  '2000': 384316.84, '2100': 231145.98, '2200': 109056.45, '2300': 58982.8, '2500': 90962.82, '2600': 45600,
  '2700': 123636.3, '2900': 129724.64, '3100': 62457.85, '3200': 22883.42, '3300': 507874.8, '3400': 70672.67,
  '3500': 377156.77, '3600': 580615.5, '3700': 506725.08, '4000': 17590, '4100': 11525.26, '4300': 557547.39,
  '5000': 51023.31, '5500': 2750, '6500': 900, '6700': 89490, '6800': 237291.64, '7200': 33191.52,
};

// ── Crew (from the Misfits crew list) ─────────────────────────────────────────
// [name, department, roleLabel, email, phone, baseCountry, isLocal, assignRole]
const CREW = [
  // Production
  ['Kia Jam', 'Production', 'Producer', '', '', 'USA', false, 'PRODUCER'],
  ['Renny Harlin', 'Direction', 'Director', '', '', 'USA', false, 'DIRECTOR'],
  ['Angel Sun', 'Production', 'Assistant to Renny Harlin', '', '', 'UAE', true, 'OTHER'],
  ['Dean Altit', 'Production', 'Line Producer / Producer', 'dean@dnfpictures.com', '+971 58 530 3083', 'UAE', true, 'LINE_PRODUCER'],
  ['Qais Qandil', 'Production', 'Co-Producer / Exec Producer', 'qais@rngmedia.fi', '+971 50 811 6460', 'UAE', true, 'PRODUCER'],
  ['Prince Rami Jaber', 'Production', 'Executive Producer', 'rami@rngmedia.fi', '', 'UAE', true, 'PRODUCER'],
  ['Tony Schwager', 'Production', 'Assistant to Rami Jaber', 'tony.schwager@live.com', '+971 58 598 7511', 'UAE', true, 'OTHER'],
  ['Maxine De Vere', 'Production', 'Unit Production Manager', 'maxine.devere@gmail.com', '+971 58 553 2060', 'UAE', true, 'PRODUCTION_COORDINATOR'],
  ['Carole Prentice', 'Production', 'Production Manager', 'carole.misfitsmovie@gmail.com', '+971 55 328 2810', 'UAE', true, 'PRODUCTION_COORDINATOR'],
  ['Ramadan Zekirovski', 'Production', 'Travel Coordinator', 'ram@dnfpictures.com', '+971 58 530 3086', 'UAE', true, 'OTHER'],
  ['Tegan Zekirovski', 'Production', 'Production Coordinator', 'tegan@dnfpictures.com', '+971 58 530 3087', 'UAE', true, 'PRODUCTION_COORDINATOR'],
  ['Danielle Brodalka', 'Production', 'Production Assistant', 'daniellebrodalka@gmail.com', '+971 50 894 6365', 'UAE', true, 'OTHER'],
  ['Celeste Pillay', 'Production', 'Production Assistant', 'celestespillay@gmail.com', '+971 58 570 0350', 'UAE', true, 'OTHER'],
  ['Erishka Coutinho', 'Production', 'Production Assistant', 'erishka.coutinho@outlook.com', '+971 56 612 0236', 'UAE', true, 'OTHER'],
  // Assistant Directors
  ['Jesse Nye', 'Direction', '1st Assistant Director', 'jessefnye@gmail.com', '+1 973 851 5144', 'USA', false, 'ASSISTANT_DIRECTOR'],
  ['Jay (Jeremy) Williams', 'Direction', '2nd Assistant Director (Office)', 'jaywilliams2@mac.com', '+971 56 241 9963', 'UAE', true, 'ASSISTANT_DIRECTOR'],
  ['Jad Saabi', 'Direction', '2nd Assistant Director (Set)', 'jadsaabi@gmail.com', '+971 50 675 5877', 'UAE', true, 'ASSISTANT_DIRECTOR'],
  // Script
  ['Lisa Burling', 'Script', 'Script Supervisor', 'killerlisabee@icloud.com', '+1 416 882 3763', 'Canada', false, 'OTHER'],
  // Camera
  ['Denis Alarkon Ramires', 'Camera', 'Director of Photography', 'viracocha13@me.com', '+7 910 452 5955', 'Russia', false, 'DOP'],
  ['Anatolii Simchenko', 'Camera', 'Steadicam / 2nd Camera / 2nd Unit DOP', '1146216@gmail.com', '+7 916 114 6216', 'Russia', false, 'CAMERA_OPERATOR'],
  ['Anton Zaporozhets', 'Camera', '1st Assistant Camera', 'roots.levi@gmail.com', '+7 911 766 3898', 'Russia', false, 'CAMERA_OPERATOR'],
  ['Michele Nassuato', 'Camera', 'Focus Puller', 'michelenassuato@gmail.com', '+39 348 738 2532', 'Italy', false, 'CAMERA_OPERATOR'],
  ['Khamadi Khreytani', 'Camera', '2nd AC / DOP Assistant', 'hamadi1979@gmail.com', '+7 926 591 0054', 'Russia', false, 'CAMERA_OPERATOR'],
  ['Philipp Chudalla', 'Camera', 'DIT', 'philipp.chudalla@gmail.com', '+971 55 526 0439', 'UAE', true, 'OTHER'],
  // Grip & Electric
  ['Ibrahim Touma', 'Grip', 'Key Grip', 'bob.keygrip@gmail.com', '+971 55 337 7510', 'UAE', true, 'GRIP'],
  ['Andrej (Andrew) Arnautov Jr.', 'Electric', 'Gaffer', 'arnaut.a@gmail.com', '+971 50 253 4869', 'UAE', true, 'GAFFER'],
  // Sound
  ['Joseph Bartone', 'Sound', 'Production Sound Mixer', 'joebartone@gmail.com', '+1 818 321 0359', 'USA', false, 'SOUND'],
  ['Farhad Katrahmani', 'Sound', 'Production Sound Mixer', 'farhadkatrahmani@gmail.com', '+971 50 188 0063', 'UAE', true, 'SOUND'],
  // Art Department
  ['Preet Kalra', 'Art', 'Art Director', 'preetkalra08@gmail.com', '+971 50 228 8339', 'UAE', true, 'ART_DIRECTOR'],
  ['Dina El Geweli', 'Art', 'Assistant Art Director / Graphic Designer', 'dinaelgeweli@gmail.com', '+971 58 222 1428', 'UAE', true, 'OTHER'],
  ['Shams Ormam', 'Art', '3D Artist', 'cvshams@gmail.com', '+971 50 206 7570', 'UAE', true, 'OTHER'],
  ['Mostafa Rai', 'Art', 'Set Decorator', 'safiraiart@gmail.com', '+971 55 515 7173', 'UAE', true, 'OTHER'],
  ['Mohamed Ashraf', 'Art', 'Assistant Set Decorator', 'ashrafpak4@gmail.com', '+971 50 333 7271', 'UAE', true, 'OTHER'],
  ['Fares Rabah', 'Art', 'Set Dresser', 'rabah_fares@gmail.com', '+971 55 695 5678', 'UAE', true, 'OTHER'],
  ['Roshan Kumara', 'Art', 'Set Standby (Art Dept)', 'withanagedilush@gmail.com', '', 'UAE', true, 'OTHER'],
  ['Mark Atayde', 'Art', 'Set Standby (Art Dept)', 'pogingbagsik14@gmail.com', '+971 55 735 4972', 'UAE', true, 'OTHER'],
  ['Michael Coja', 'Art', 'Prop Master', '', '', 'UAE', true, 'OTHER'],
  ['John Larry', 'Art', 'Assistant Props', 'chokjacinto@yahoo.com', '+971 52 767 8370', 'UAE', true, 'OTHER'],
  ['Mohamed Ali Altaf', 'Art', 'Swing Crew', 'alialtaf66@gmail.com', '+971 55 644 7394', 'UAE', true, 'OTHER'],
  // Stunts
  ['Victor Ivanov', 'Stunts', 'Stunt Coordinator', 'ivanovfilm@yahoo.com', '+7 909 159 2200', 'Russia', false, 'OTHER'],
  // Locations
  ['Islam Yahia Ahmed', 'Locations', 'Location Manager', 'salem-am@live.com', '+971 50 888 4041', 'UAE', true, 'OTHER'],
  ['Mohamed (Mido) Okil', 'Locations', 'Location Assistant', 'mohamed.okil@gmail.com', '+971 50 377 0454', 'UAE', true, 'OTHER'],
  // Transport
  ['Christian Mallia', 'Transport', 'Transport Captain', 'cmallia@gmail.com', '+971 56 403 8583', 'UAE', true, 'DRIVER'],
  ['Muzafar Iqbal', 'Transport', 'Transport Dispatcher', 'muzafar@eman-services.com', '+971 55 380 1007', 'UAE', true, 'DRIVER'],
  // Hair & Make-up
  ['Zera Azmi', 'Hair & Make-up', 'Hair & Make-up Supervisor', 'zera.azmi@gmail.com', '+971 50 562 2730', 'UAE', true, 'OTHER'],
  // Wardrobe
  ['Angela Schnoeke Paasch', 'Wardrobe', 'Costume Designer', 'aspaasch@gmail.com', '+971 50 507 0320', 'UAE', true, 'OTHER'],
  ['Irma Lotosova', 'Wardrobe', 'Costumer (Key)', 'erma.lotosova@gmail.com', '+971 50 494 6240', 'UAE', true, 'OTHER'],
  ['Lisa Sass', 'Wardrobe', 'Costumer', 'sasscostume@gmail.com', '+971 55 378 0605', 'UAE', true, 'OTHER'],
  // Post Production
  ['Colleen Rafferty', 'Post Production', 'Film Editor', 'rafferty.colleen@gmail.com', '+1 314 620 8114', 'USA', false, 'EDITOR'],
  ['Jason Voss', 'Post Production', '1st Assistant Editor', 'jason.f.voss@gmail.com', '+1 781 720 9601', 'USA', false, 'OTHER'],
  ['Richard Weinman', 'Post Production', 'Post Production Supervisor', 'richzana@yahoo.com', '+1 818 694 9008', 'USA', false, 'OTHER'],
];

async function main() {
  // 1. Remove an existing Misfits project (cascade clears its budget/crew/etc.)
  const existing = await prisma.productionProject.findFirst({ where: { title: 'The Misfits' } });
  if (existing) {
    await prisma.productionProject.delete({ where: { id: existing.id } });
    console.log('Removed existing "The Misfits" project.');
  }

  // 2. Create the project
  const year = new Date().getFullYear();
  const seq = await prisma.documentSequence.upsert({
    where: { prefix: 'PRD' }, update: { lastNumber: { increment: 1 } }, create: { prefix: 'PRD', lastNumber: 1, year },
  });
  const projectNumber = `PRD-${year}-${String(seq.lastNumber).padStart(4, '0')}`;

  const project = await prisma.productionProject.create({
    data: {
      projectNumber,
      title: 'The Misfits',
      projectType: 'FEATURE',
      status: 'PRODUCTION',
      currency: 'USD',
      startDate: SHOOT_START,
      endDate: SHOOT_END,
      shootStartDate: SHOOT_START,
      shootEndDate: SHOOT_END,
      description: 'Feature film — sample production seeded from the Misfits budget & crew list.',
    },
  });
  console.log(`Created project ${project.title} (${projectNumber}).`);

  // 3. Budget version + sections + accounts + line items
  const version = await prisma.budgetVersion.create({
    data: { projectId: project.id, versionName: 'Approved Budget v16', status: 'WORKING', isActive: true },
  });
  await prisma.budgetGlobal.createMany({
    data: [
      { budgetVersionId: version.id, key: 'shoot_days', label: 'Shoot Days', value: 40, unit: 'days' },
      { budgetVersionId: version.id, key: 'prep_weeks', label: 'Prep Weeks', value: 8, unit: 'weeks' },
      { budgetVersionId: version.id, key: 'crew_count', label: 'Crew Count', value: 60, unit: 'people' },
      { budgetVersionId: version.id, key: 'fx_usd', label: 'USD to AED', value: 3.67, unit: '' },
    ],
  });

  let grand = 0, lineCount = 0;
  for (let si = 0; si < SECTIONS.length; si++) {
    const sec = SECTIONS[si];
    const section = await prisma.budgetSection.create({
      data: { budgetVersionId: version.id, code: sec.code, title: sec.title, sortOrder: si, color: sec.color },
    });
    for (let ai = 0; ai < sec.accounts.length; ai++) {
      const [code, title, amount] = sec.accounts[ai];
      const account = await prisma.budgetAccount.create({
        data: { sectionId: section.id, code, title, sortOrder: ai },
      });
      // Detailed line items from the budget file; fall back to a single line if none.
      let items = DETAIL[code] || [];
      if (items.length === 0) items = [{ description: title, quantity: 1, units: 'lump', rate: amount, total: amount }];
      for (let li = 0; li < items.length; li++) {
        const it = items[li];
        const total = Number(it.total) || 0;
        const qty = Number(it.quantity) || 1;
        const rate = Number(it.rate) || (qty ? total / qty : 0);
        await prisma.budgetLineItem.create({
          data: {
            accountId: account.id, sortOrder: li,
            code: it.code || null, subTitle: it.subTitle || null,
            description: it.description || title,
            quantity: qty, units: it.units || null, rate, currency: 'USD', exchangeRate: 1,
            fringePct: 0, subtotal: total, fringeAmount: 0, total,
          },
        });
        grand += total; lineCount++;
      }
    }
  }
  await prisma.productionProject.update({ where: { id: project.id }, data: { totalBudget: grand } });
  console.log(`Budget loaded: AED ${grand.toLocaleString()} — ${lineCount} line items across ${SECTIONS.length} sections.`);

  // 4. Actuals → project ledger COSTs tagged to each budget account (standalone production books)
  const user = await prisma.user.findFirst();
  const uid = user ? user.id : null;
  let n = 0;
  for (const [code, amount] of Object.entries(ACTUALS)) {
    if (!amount) continue;
    const title = SECTIONS.flatMap(s => s.accounts).find(a => a[0] === code)?.[1] || code;
    await prisma.projectTransaction.create({
      data: {
        projectId: project.id, kind: 'COST', date: new Date('2019-03-01'),
        accountCode: code, accountTitle: title, category: title,
        description: `Cost to date — ${title}`, amount, taxAmount: 0, total: amount,
        currency: 'USD', status: 'PAID', createdById: uid,
      },
    });
    n++;
  }
  // Sample income (financing / client billings) so the P&L shows revenue
  const INCOME = [
    ['Co-financing — first tranche', 'Studio Partner', 4000000, 'RECEIVED'],
    ['Co-financing — second tranche', 'Studio Partner', 3000000, 'RECEIVED'],
    ['Production incentive / rebate', 'Film Commission', 1200000, 'INVOICED'],
    ['Distribution MG advance', 'Distributor', 1500000, 'INVOICED'],
  ];
  for (const [desc, party, amount, status] of INCOME) {
    await prisma.projectTransaction.create({
      data: {
        projectId: project.id, kind: 'INCOME', date: new Date('2019-02-15'),
        description: desc, party, amount, taxAmount: 0, total: amount,
        currency: 'USD', status, createdById: uid,
      },
    });
  }
  console.log(`Seeded ${n} cost entries + ${INCOME.length} income entries into the project ledger.`);

  // 4b. Sample vendors + open purchase orders (committed money for the Cost Report)
  const VENDORS = [
    ['Gamma Engineering', 'Camera & Lighting', 'booking.ae@gamma-engineering.com'],
    ['DNF Pictures', 'Production Services', 'dean@dnfpictures.com'],
    ['Rotana / Etihad Towers', 'Hotels & Locations', ''],
    ['Eman Services', 'Transport', 'muzafar@eman-services.com'],
  ];
  const vendorMap = {};
  for (const [name, category, email] of VENDORS) {
    const v = await prisma.productionVendor.create({ data: { projectId: project.id, name, category, email: email || null } });
    vendorMap[name] = v.id;
  }
  const POS = [
    // [vendor, costCenterCode, costCenterTitle, description, amount, status, invoicedAmount]
    ['Gamma Engineering', '3300', 'Camera & G&E Package', 'Camera, grip & electric package — shoot', 120000, 'PARTIALLY_INVOICED', 60000],
    ['Gamma Engineering', '3200', 'Lighting & Electrical', 'Additional lighting crew & gear', 30000, 'APPROVED', 0],
    ['Rotana / Etihad Towers', '4300', 'BTL Travel & Living', 'Crew accommodation block', 45000, 'APPROVED', 0],
    ['Eman Services', '3500', 'Transportation', 'Unit transport & drivers', 28000, 'APPROVED', 0],
    ['DNF Pictures', '2000', 'Production Staff', 'Production office support', 18000, 'APPROVED', 0],
  ];
  let poN = 0;
  for (const [vendor, code, title, desc, amount, status, invoiced] of POS) {
    poN++;
    await prisma.purchaseOrder.create({
      data: {
        projectId: project.id, poNumber: `PO-2019-${String(poN).padStart(4, '0')}`,
        vendorId: vendorMap[vendor] || null, vendorName: vendor,
        costCenterCode: code, costCenterTitle: title, description: desc,
        date: new Date('2019-02-01'), amount, taxAmount: 0, total: amount, invoicedAmount: invoiced,
        currency: 'USD', status,
      },
    });
    // If partially invoiced, mirror the invoiced part as a ledger cost
    if (invoiced > 0) {
      await prisma.projectTransaction.create({
        data: {
          projectId: project.id, kind: 'COST', date: new Date('2019-02-20'),
          accountCode: code, accountTitle: title, description: `Invoice — PO ${String(poN).padStart(4, '0')} (${desc})`,
          party: vendor, reference: `PO-2019-${String(poN).padStart(4, '0')}`,
          amount: invoiced, taxAmount: 0, total: invoiced, currency: 'USD', status: 'APPROVED', createdById: uid,
        },
      });
    }
  }
  console.log(`Seeded ${VENDORS.length} vendors + ${POS.length} purchase orders.`);

  // 5. Crew directory (reuse by name) + project assignments
  let made = 0, assigned = 0;
  for (const [name, department, roleLabel, email, phone, baseCountry, isLocal, assignRole] of CREW) {
    let member = await prisma.crewMember.findFirst({ where: { name } });
    if (!member) {
      member = await prisma.crewMember.create({
        data: { name, department, role: roleLabel, email: email || null, phone: phone || null,
          baseCountry, isLocal, nationality: baseCountry, status: 'ACTIVE' },
      });
      made++;
    }
    await prisma.productionCrew.create({
      data: {
        projectId: project.id, crewMemberId: member.id, name, role: assignRole,
        email: email || null, mobile: phone || null,
        startDate: SHOOT_START, endDate: SHOOT_END, location: 'Abu Dhabi, UAE',
        dealMemoStatus: isLocal ? 'SIGNED' : 'SENT', ndaStatus: 'NOT_REQUIRED',
      },
    });
    assigned++;
  }
  console.log(`Crew: ${made} new directory members, ${assigned} project assignments.`);

  console.log('\\nDone. Open Production → Projects → The Misfits.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
