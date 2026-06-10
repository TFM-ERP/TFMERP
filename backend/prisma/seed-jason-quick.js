/* Full sample production — "JASON QUICK" (action feature, USA guilds)
 * Run from the backend folder:  node prisma/seed-jason-quick.js
 * Idempotent: deletes any existing "Jason Quick" project first, then recreates it.
 * Seeds: project, LOCKED baseline budget + WORKING revision, ledger actuals + income,
 *        vendors + purchase orders, crew, US guild cast (SAG-AFTRA/DGA/WGA), characters,
 *        script + revisions + scenes + script notes (annotations), scout assignments +
 *        locations, stripboard + breakdown (props/set dressing/vehicles/stunts),
 *        and call sheets for the first two shoot days (10 & 11 Jul 2026).
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// First shoot day = 10 July 2026 (day 1), 11 July 2026 (day 2)
const DAY1 = new Date('2026-07-10');
const DAY2 = new Date('2026-07-11');
const PREP_START = new Date('2026-05-18');
const SHOOT_START = DAY1;
const SHOOT_END = new Date('2026-09-18');
const LOCK_DATE = new Date('2026-06-15');

// ── Budget — [code, title, baseline (locked v1), current (working v2)] in USD ──
const SECTIONS = [
  { code: '1000', title: 'Above The Line', color: '#7c3aed', accounts: [
    ['1100', 'Story, Rights & Development', 1100000, 1200000],
    ['1200', 'Producers Unit', 3400000, 3500000],
    ['1300', 'Direction', 3800000, 4000000],
    ['1400', 'Cast', 11500000, 12400000],
    ['1500', 'ATL Travel & Living', 720000, 810000],
    ['1900', 'Fringes & Taxes (ATL)', 1320000, 1410000],
  ]},
  { code: '2000', title: 'Production (Below The Line)', color: '#0891b2', accounts: [
    ['2000', 'Production Staff', 1750000, 1820000],
    ['2100', 'Extra Talent & Atmosphere', 560000, 610000],
    ['2200', 'Set Design', 880000, 900000],
    ['2300', 'Set Construction', 2050000, 2250000],
    ['2500', 'Set Operations', 1080000, 1120000],
    ['2600', 'Special Effects (Practical)', 2900000, 3250000],
    ['2700', 'Set Dressing', 760000, 820000],
    ['2800', 'Property', 540000, 640000],
    ['2900', 'Wardrobe', 690000, 720000],
    ['3100', 'Make-up & Hairdressing', 470000, 520000],
    ['3200', 'Lighting & Electrical', 1240000, 1320000],
    ['3300', 'Camera Package', 2300000, 2450000],
    ['3400', 'Production Sound', 380000, 410000],
    ['3500', 'Transportation', 1900000, 2050000],
    ['3600', 'Locations', 1680000, 1820000],
    ['3700', 'Picture Vehicles & Armory', 2400000, 2650000],
    ['3800', 'Stunts', 2700000, 3050000],
    ['4000', 'Second Unit', 1350000, 1520000],
  ]},
  { code: '5000', title: 'Post Production', color: '#059669', accounts: [
    ['5000', 'Editorial', 1150000, 1220000],
    ['5100', 'Music', 950000, 1000000],
    ['5200', 'Post Production Sound', 860000, 900000],
    ['5400', 'Visual Effects', 5800000, 6500000],
    ['5500', 'Titles & Mastering', 180000, 220000],
  ]},
  { code: '6000', title: 'Other Costs', color: '#d97706', accounts: [
    ['6700', 'Insurance & Completion Bond', 880000, 920000],
    ['6800', 'Legal, Accounting & General', 1100000, 1240000],
  ]},
  { code: '7000', title: 'Finance & Contingency', color: '#dc2626', accounts: [
    ['7200', 'Contingency (10%)', 2800000, 3050000],
  ]},
];

// Cost-to-date (actuals) by account code → ledger COST entries (Budget vs Actual)
const ACTUALS = {
  '1100': 1200000, '1200': 2100000, '1300': 2400000, '1400': 6800000, '1500': 430000, '1900': 690000,
  '2000': 980000, '2100': 180000, '2200': 720000, '2300': 1450000, '2500': 540000, '2600': 1380000,
  '2700': 410000, '2800': 360000, '2900': 520000, '3100': 240000, '3200': 690000, '3300': 1310000,
  '3400': 190000, '3500': 980000, '3600': 1020000, '3700': 1480000, '3800': 1620000, '4000': 420000,
  '5000': 280000, '5400': 1150000, '6700': 870000, '6800': 540000,
};

const INCOME = [
  ['Equity financing — first tranche', 'Quickstrike Capital', 18000000, 'RECEIVED'],
  ['Equity financing — second tranche', 'Quickstrike Capital', 12000000, 'RECEIVED'],
  ['Pre-sale — North America (theatrical)', 'Apex Distribution', 9000000, 'INVOICED'],
  ['Pre-sale — International (ex-US)', 'Worldwide Sales Co.', 7500000, 'INVOICED'],
  ['Production incentive / rebate', 'State Film Commission', 4200000, 'INVOICED'],
];

// ── Crew (USA action unit) — [name, dept, roleLabel, email, country, isLocal, prodRole] ──
const CREW = [
  ['Marcus Vega', 'Production', 'Producer', 'marcus@quickstrike.com', 'USA', true, 'PRODUCER'],
  ['Dana Whitfield', 'Production', 'Executive Producer', 'dana@quickstrike.com', 'USA', true, 'EXECUTIVE_PRODUCER'],
  ['Owen Brecht', 'Production', 'Line Producer', 'owen.brecht@gmail.com', 'USA', true, 'LINE_PRODUCER'],
  ['Sofia Reyes', 'Production', 'Unit Production Manager', 'sofia.reyes@gmail.com', 'USA', true, 'PRODUCTION_COORDINATOR'],
  ['Cole Hammond', 'Direction', 'Director', 'cole@hammondfilms.com', 'USA', true, 'DIRECTOR'],
  ['Priya Nair', 'Direction', '1st Assistant Director', 'priya.nair.ad@gmail.com', 'USA', true, 'ASSISTANT_DIRECTOR'],
  ['Derek Olsson', 'Direction', '2nd Assistant Director', 'derek.olsson@gmail.com', 'USA', true, 'ASSISTANT_DIRECTOR'],
  ['Yuki Tanaka', 'Camera', 'Director of Photography', 'yuki.tanaka.dp@gmail.com', 'USA', true, 'DOP'],
  ['Ramon Diaz', 'Camera', 'A-Camera Operator', 'ramon.diaz.cam@gmail.com', 'USA', true, 'CAMERA_OPERATOR'],
  ['Tess Maguire', 'Camera', '1st Assistant Camera', 'tess.maguire@gmail.com', 'USA', true, 'CAMERA_OPERATOR'],
  ['Greg Salerno', 'Electric', 'Gaffer', 'greg.salerno.gaffer@gmail.com', 'USA', true, 'GAFFER'],
  ['Bo Carter', 'Grip', 'Key Grip', 'bo.carter.grip@gmail.com', 'USA', true, 'GRIP'],
  ['Helen Cho', 'Sound', 'Production Sound Mixer', 'helen.cho.sound@gmail.com', 'USA', true, 'SOUND'],
  ['Antoine Beck', 'Art', 'Production Designer', 'antoine.beck@gmail.com', 'USA', true, 'ART_DIRECTOR'],
  ['Nadia Petrov', 'Art', 'Set Decorator', 'nadia.petrov.art@gmail.com', 'USA', true, 'OTHER'],
  ['Wes Hollis', 'Art', 'Prop Master', 'wes.hollis.props@gmail.com', 'USA', true, 'OTHER'],
  ['Carla Mendez', 'Wardrobe', 'Costume Designer', 'carla.mendez.cd@gmail.com', 'USA', true, 'WARDROBE'],
  ['Joon Park', 'Hair & Make-up', 'Make-up Department Head', 'joon.park.mu@gmail.com', 'USA', true, 'MAKEUP'],
  ['Rex Donovan', 'Stunts', 'Stunt Coordinator', 'rex.donovan.stunts@gmail.com', 'USA', true, 'OTHER'],
  ['Mia Sokolova', 'Stunts', 'Assistant Stunt Coordinator', 'mia.sokolova@gmail.com', 'USA', true, 'OTHER'],
  ['Frank Russo', 'Transport', 'Transportation Coordinator', 'frank.russo.transpo@gmail.com', 'USA', true, 'DRIVER'],
  ['Lena Brooks', 'Locations', 'Location Manager', 'lena.brooks.lm@gmail.com', 'USA', true, 'OTHER'],
  ['Sam Okafor', 'Script', 'Script Supervisor', 'sam.okafor.script@gmail.com', 'USA', true, 'OTHER'],
  ['Iris Vandenberg', 'Post Production', 'Editor', 'iris.v.editor@gmail.com', 'USA', true, 'EDITOR'],
  ['Hank Mueller', 'VFX', 'VFX Supervisor', 'hank.mueller.vfx@gmail.com', 'USA', true, 'VFX_ARTIST'],
];

// ── Characters + the actors cast (SAG-AFTRA) — [char, actor, roleType, gender, ageMin, ageMax, days, dialoguePages, stuntDays, rate] ──
const CAST = [
  ['JASON QUICK', 'Ryan Castellano', 'LEAD', 'Male', 35, 45, 38, 42, 22, 5000000, 'Ex-Delta operative turned fugitive; relentless, wounded, principled.'],
  ['MAYA CRUZ', 'Daniela Frost', 'LEAD', 'Female', 30, 40, 30, 36, 12, 3200000, 'Interpol field agent hunting Quick who becomes his reluctant ally.'],
  ['VIKTOR DRACO', 'Aleksandr Volkov', 'SUPPORTING', 'Male', 45, 60, 18, 20, 4, 1800000, 'Arms-dealing kingpin; cold, theatrical, untouchable.'],
  ['AGENT ELLIS', 'Marcus Bell', 'SUPPORTING', 'Male', 38, 50, 14, 16, 2, 650000, 'Quick\'s former handler, now compromised.'],
  ['DR. SARA LIN', 'Grace Yoon', 'FEATURED', 'Female', 28, 38, 8, 9, 0, 240000, 'Black-market surgeon who patches Quick up.'],
  ['THE BROKER', 'Theo Marsh', 'FEATURED', 'Male', 40, 55, 6, 5, 0, 180000, 'Information dealer working both sides.'],
];

// ── Scenes across a 10-day shoot — [no, slugline, intExt, dayNight, pageStart, pageEnd, day, cast[]] ──
// Cast spread is deliberately non-contiguous so DOOD shows Start/Work/Finish + Hold/Drop.
const SCENES = [
  ['1',  'EXT. HARBOR WAREHOUSE - NIGHT', 'EXT', 'NIGHT', 1, 4, 1, ['JASON QUICK', 'VIKTOR DRACO']],
  ['2',  'INT. WAREHOUSE - CONTINUOUS', 'INT', 'NIGHT', 4, 9, 1, ['JASON QUICK', 'VIKTOR DRACO']],
  ['3',  'EXT. ROOFTOP - NIGHT', 'EXT', 'NIGHT', 9, 12, 1, ['JASON QUICK']],
  ['12', 'INT. SAFEHOUSE - NIGHT', 'INT', 'NIGHT', 24, 27, 2, ['JASON QUICK', 'MAYA CRUZ']],
  ['13', 'EXT. CITY STREET - DAY', 'EXT', 'DAY', 27, 33, 2, ['JASON QUICK', 'MAYA CRUZ']],
  ['14', 'INT. MOVING SUV - DAY', 'INT', 'DAY', 33, 36, 2, ['JASON QUICK', 'MAYA CRUZ']],
  ['15', 'EXT. UNDERPASS - DAY', 'EXT', 'DAY', 36, 41, 2, ['JASON QUICK', 'MAYA CRUZ']],
  ['4',  'INT. FBI FIELD OFFICE - DAY', 'INT', 'DAY', 12, 15, 3, ['AGENT ELLIS']],
  ['5',  'EXT. DESERT AIRSTRIP - DAY', 'EXT', 'DAY', 15, 18, 4, ['THE BROKER']],
  ['8',  'INT. BLACK-MARKET CLINIC - NIGHT', 'INT', 'NIGHT', 18, 21, 5, ['JASON QUICK', 'DR. SARA LIN']],
  ['7',  'EXT. ALLEY MARKET - DAY', 'EXT', 'DAY', 16, 19, 6, ['JASON QUICK', 'MAYA CRUZ']],
  ['18', 'INT. DRACO PENTHOUSE - NIGHT', 'INT', 'NIGHT', 44, 47, 7, ['VIKTOR DRACO']],
  ['16', 'INT. INTERPOL OPS ROOM - DAY', 'INT', 'DAY', 41, 44, 8, ['MAYA CRUZ', 'AGENT ELLIS']],
  ['20', 'EXT. DOCKS APPROACH - NIGHT', 'EXT', 'NIGHT', 47, 50, 9, ['JASON QUICK', 'VIKTOR DRACO']],
  ['22', 'EXT. FREIGHTER SEVASTOPOL - DAWN', 'EXT', 'DAWN', 50, 56, 10, ['JASON QUICK', 'MAYA CRUZ', 'VIKTOR DRACO']],
];

// Shoot-day calendar (Mon–Fri weeks from 10 Jul 2026)
const DAY_DATES = ['2026-07-10','2026-07-11','2026-07-13','2026-07-14','2026-07-15','2026-07-16','2026-07-17','2026-07-20','2026-07-21','2026-07-22'];
const DAY_INFO = [
  ['Harbor Warehouse 7, Long Beach', '17:00', '05:00', 'Night ext/int — marine + stunt units.'],
  ['Safehouse + 4th Street Corridor, LA', '06:00', '18:00', 'Day — street closure chase; Russian arm + drift car.'],
  ['FBI Field Office (stage 7)', '08:00', '18:00', 'Dialogue day, controlled stage.'],
  ['Desert Airstrip, Palmdale', '06:00', '17:00', 'Cargo plane; drone unit.'],
  ['Black-Market Clinic (Boyle Heights)', '16:00', '02:00', 'Night int; tight set.'],
  ['Alley Market, Downtown LA', '07:00', '18:00', 'Day ext, crowd atmosphere.'],
  ['Draco Penthouse (Sky Lobby)', '15:00', '01:00', 'Night int, high floor.'],
  ['Interpol Ops Room (stage 7)', '08:00', '18:00', 'Dialogue day.'],
  ['Docks Approach', '18:00', '04:00', 'Night ext, water FX.'],
  ['Freighter Sevastopol', '04:30', '15:00', 'Dawn climax; full unit + 2nd unit.'],
];

// Script notes (annotations) — [layer, page, tool, text, scene]
const NOTES = [
  ['Director Notes', 1, 'note', 'Quick enters from water — keep him silhouetted until the flare.', '1'],
  ['Director Notes', 10, 'note', 'Rooftop fight: 3 beats, end on the ledge stand-off.', '3'],
  ['Stunts', 4, 'note', 'Warehouse shootout — squib pass + 2 high falls. Rehearse Day -1.', '2'],
  ['Camera', 27, 'note', 'Street chase: Russian arm + drift car. Golden hour backlight.', '13'],
  ['Props', 4, 'tag', 'PROP: Hero Beretta M9 (rubber + live-fire doubles) ×3', '2'],
];

// Locations — [name, type, status, stage, city, fee/day, scenes, note]
const LOCATIONS = [
  ['Harbor Warehouse 7', 'EXT', 'CONFIRMED', 'CONFIRMED', 'Long Beach, CA', 12000, '1,2', 'Working dock; night shoot, marine unit standby.'],
  ['Eastside Rooftop (Tower B)', 'EXT', 'CONFIRMED', 'CONFIRMED', 'Los Angeles, CA', 8500, '3', 'Helipad rooftop; fall-arrest rigging approved.'],
  ['Safehouse Apartment', 'INT', 'CONFIRMED', 'CONFIRMED', 'Los Angeles, CA', 4200, '12', 'Practical apartment, controlled stairwell.'],
  ['4th Street Corridor', 'EXT', 'OPTION', 'PERMIT_APPLIED', 'Los Angeles, CA', 15000, '13,15', 'Street-closure chase; FilmLA permit pending.'],
];

// Scout assignments — [title, type, priority, status, scenes, note, candidate, candStatus]
const SCOUTS = [
  ['Climactic underpass for SUV chase', 'TECH_RECCE', 'HIGH', 'SUBMITTED', '15', 'Need 200m clear run + camera car turnaround.', '6th Street Viaduct', 'SHORTLISTED'],
  ['Antagonist lair — Draco penthouse', 'DIRECTOR', 'MEDIUM', 'IN_PROGRESS', '20-22', 'High-floor, glass, night skyline.', 'Wilshire Grand Sky Lobby', 'PENDING'],
  ['Black-market clinic', 'PHOTO', 'LOW', 'COMPLETED', '8', 'Gritty, tiled, low ceiling.', 'Boyle Heights Garage Unit', 'ACCEPTED'],
];

async function findLabor(name) {
  let b = await prisma.laborBody.findFirst({ where: { name: { contains: name } } });
  return b ? b.id : null;
}

async function ensureLabor(kind, name, shortName, website) {
  let b = await prisma.laborBody.findFirst({ where: { name: { contains: shortName } } });
  if (!b) b = await prisma.laborBody.create({ data: { kind, name, shortName, website: website || null, isActive: true } });
  return b.id;
}

// ── Crew rate card → detailed budget lines. accountCode → [subTitle, prepWk, shootWk, wrapWk, postWk, weeklyRate, fringePct] ──
const LABOR = {
  '1200': [
    ['Producer — Marcus Vega', 8, 11, 4, 0, 12000, 18],
    ['Executive Producer — Dana Whitfield', 2, 11, 1, 0, 15000, 18],
    ['Line Producer — Owen Brecht', 10, 11, 6, 0, 9000, 22],
    ['UPM — Sofia Reyes', 8, 11, 4, 0, 7000, 25],
  ],
  '1300': [['Director — Cole Hammond', 10, 11, 6, 0, 30000, 12]],
  '2000': [
    ['1st Assistant Director — Priya Nair', 4, 11, 2, 0, 6500, 25],
    ['2nd Assistant Director — Derek Olsson', 2, 11, 1, 0, 4500, 25],
    ['Production Coordinator', 8, 11, 4, 0, 4000, 25],
    ['Production Assistants (×2)', 0, 11, 0, 0, 3600, 18],
    ['Script Supervisor — Sam Okafor', 1, 11, 1, 0, 4200, 25],
  ],
  '2200': [['Production Designer — Antoine Beck', 8, 11, 2, 0, 8500, 22]],
  '2500': [['Key Grip — Bo Carter', 2, 11, 1, 0, 6000, 25], ['Best Boy Grip', 1, 11, 1, 0, 4200, 25]],
  '2700': [['Set Decorator — Nadia Petrov', 6, 11, 2, 0, 5500, 25], ['Prop Master — Wes Hollis', 4, 11, 1, 0, 5200, 25]],
  '2900': [['Costume Designer — Carla Mendez', 6, 11, 2, 0, 5500, 22]],
  '3100': [['Make-up Dept Head — Joon Park', 1, 11, 1, 0, 5000, 25]],
  '3200': [['Gaffer — Greg Salerno', 2, 11, 1, 0, 6000, 25], ['Best Boy Electric', 1, 11, 1, 0, 4200, 25]],
  '3300': [
    ['Director of Photography — Yuki Tanaka', 3, 11, 1, 0, 12000, 25],
    ['A-Camera Operator — Ramon Diaz', 1, 11, 0, 0, 6500, 25],
    ['1st Assistant Camera — Tess Maguire', 1, 11, 0, 0, 4500, 25],
  ],
  '3400': [['Production Sound Mixer — Helen Cho', 1, 11, 0, 0, 5500, 25]],
  '3800': [
    ['Stunt Coordinator — Rex Donovan', 6, 11, 2, 0, 9000, 25],
    ['Asst Stunt Coordinator — Mia Sokolova', 3, 11, 0, 0, 5000, 25],
  ],
  '5000': [['Editor — Iris Vandenberg', 0, 11, 0, 16, 7000, 22]],
};

function buildLaborLines(rows, classification) {
  return rows.map((r, idx) => {
    const [sub, prep, shoot, wrap, post, rate, pct] = r;
    const stages = [];
    let subtotal = 0;
    for (const [stage, wk] of [['PREP', prep], ['SHOOT', shoot], ['WRAP', wrap], ['POST', post]]) {
      if (!wk) continue;
      const amount = wk * rate;
      stages.push({ stage, qty: wk, unit: 'wk', rate, amount });
      subtotal += amount;
    }
    const weeks = prep + shoot + wrap + post;
    const fringeAmount = Math.round((subtotal * pct) / 100 * 100) / 100;
    const total = subtotal + fringeAmount;
    return {
      sortOrder: idx, subTitle: sub, description: sub, quantity: weeks, units: 'wk', rate,
      stages, fringePct: pct, classificationCode: classification, subtotal, fringeAmount, total,
    };
  });
}

// Cast (account 1400) — flat-fee performer lines on SAG-AFTRA fringe (~20%)
function buildCastLines() {
  return CAST.map((c, idx) => {
    const [, actor, roleType, , , , , , , fee] = c;
    const subtotal = fee;
    const fringeAmount = Math.round(fee * 0.20 * 100) / 100;
    return {
      sortOrder: idx, subTitle: `${c[0]} — ${actor}`, description: `${roleType} performer (SAG-AFTRA)`,
      quantity: 1, units: 'flat', rate: fee,
      stages: [{ stage: 'SHOOT', qty: 1, unit: 'flat', rate: fee, amount: fee }],
      fringePct: 20, classificationCode: 'PERFORMER', subtotal, fringeAmount, total: subtotal + fringeAmount,
    };
  });
}

async function buildBudget(projectId, versionName, status, isActive, amountIdx, opts = {}) {
  const detailed = !!opts.detailed;
  const version = await prisma.budgetVersion.create({
    data: {
      projectId, versionName, status, isActive,
      ...(opts.lockedAt ? { lockedAt: opts.lockedAt } : {}),
      ...(opts.notes ? { notes: opts.notes } : {}),
    },
  });
  if (isActive) {
    await prisma.budgetGlobal.createMany({ data: [
      { budgetVersionId: version.id, key: 'shoot_days', label: 'Shoot Days', value: 52, unit: 'days' },
      { budgetVersionId: version.id, key: 'prep_weeks', label: 'Prep Weeks', value: 8, unit: 'weeks' },
      { budgetVersionId: version.id, key: 'unit', label: 'Filming Location', value: 0, unit: 'Los Angeles, USA' },
      { budgetVersionId: version.id, key: 'fx_usd', label: 'USD base', value: 1, unit: '' },
    ]});
  }
  let grand = 0;
  const accountIds = {};
  for (let si = 0; si < SECTIONS.length; si++) {
    const sec = SECTIONS[si];
    const section = await prisma.budgetSection.create({
      data: { budgetVersionId: version.id, code: sec.code, title: sec.title, sortOrder: si, color: sec.color },
    });
    for (let ai = 0; ai < sec.accounts.length; ai++) {
      const a = sec.accounts[ai];
      const amount = a[2 + amountIdx];
      const account = await prisma.budgetAccount.create({
        data: { sectionId: section.id, code: a[0], title: a[1], sortOrder: ai },
      });
      accountIds[a[0]] = account.id;

      // Working copy gets rate-card detail (prep/shoot/wrap stages + fringes); the locked
      // baseline stays a clean top-sheet (one allowance line per account).
      let lines = null;
      if (detailed && a[0] === '1400') lines = buildCastLines();
      else if (detailed && LABOR[a[0]]) lines = buildLaborLines(LABOR[a[0]], a[0] === '1300' ? 'DIRECTOR' : 'IATSE-CREW');

      if (lines && lines.length) {
        for (const ln of lines) {
          await prisma.budgetLineItem.create({ data: {
            accountId: account.id, sortOrder: ln.sortOrder, subTitle: ln.subTitle, description: ln.description,
            quantity: ln.quantity, units: ln.units, rate: ln.rate, currency: 'USD', exchangeRate: 1,
            stages: ln.stages, classificationCode: ln.classificationCode,
            fringePct: ln.fringePct, subtotal: ln.subtotal, fringeAmount: ln.fringeAmount, total: ln.total,
          }});
          grand += ln.total;
        }
      } else {
        await prisma.budgetLineItem.create({ data: {
          accountId: account.id, sortOrder: 0, description: a[1],
          quantity: 1, units: 'allow', rate: amount, currency: 'USD', exchangeRate: 1,
          fringePct: 0, subtotal: amount, fringeAmount: 0, total: amount,
        }});
        grand += amount;
      }
    }
  }
  return { version, grand, accountIds };
}

async function main() {
  const existing = await prisma.productionProject.findFirst({ where: { title: 'Jason Quick' } });
  if (existing) { await prisma.productionProject.delete({ where: { id: existing.id } }); console.log('Removed existing "Jason Quick".'); }

  const user = await prisma.user.findFirst();
  const uid = user ? user.id : null;

  // 1. Project
  const year = 2026;
  const seq = await prisma.documentSequence.upsert({
    where: { prefix: 'PRD' }, update: { lastNumber: { increment: 1 } }, create: { prefix: 'PRD', lastNumber: 1, year },
  });
  const projectNumber = `PRD-${year}-${String(seq.lastNumber).padStart(4, '0')}`;
  const project = await prisma.productionProject.create({
    data: {
      projectNumber, title: 'Jason Quick', projectType: 'FEATURE', status: 'PRODUCTION', currency: 'USD',
      startDate: PREP_START, endDate: SHOOT_END, shootStartDate: SHOOT_START, shootEndDate: SHOOT_END,
      description: 'High-octane action feature. Principal photography in Los Angeles; first shoot day 10 Jul 2026.',
    },
  });
  console.log(`Project ${project.title} (${projectNumber}) created.`);

  // 2. Budgets — LOCKED baseline (v1) + WORKING revision (v2, active)
  const v1 = await buildBudget(project.id, 'Budget v1 — Approved Baseline (LOCKED)', 'LOCKED', false, 0,
    { lockedAt: LOCK_DATE, notes: 'Greenlight baseline locked 15 Jun 2026. Superseded by working copy v2.' });
  const v2 = await buildBudget(project.id, 'Budget v2 (Working Copy)', 'WORKING', true, 1,
    { detailed: true, notes: 'Working revision — VFX & stunts uplift; crew rate-card detail (prep/shoot/wrap + fringes).' });
  await prisma.productionProject.update({ where: { id: project.id }, data: { totalBudget: v2.grand } });
  console.log(`Budget: locked baseline $${v1.grand.toLocaleString()} + working $${v2.grand.toLocaleString()}.`);

  // 3. Ledger — actuals (COST) + income against the working version's accounts
  let costN = 0;
  for (const [code, amount] of Object.entries(ACTUALS)) {
    if (!amount) continue;
    const title = SECTIONS.flatMap(s => s.accounts).find(a => a[0] === code)?.[1] || code;
    await prisma.projectTransaction.create({ data: {
      projectId: project.id, kind: 'COST', date: new Date('2026-07-31'),
      accountCode: code, accountTitle: title, category: title,
      description: `Cost to date — ${title}`, amount, taxAmount: 0, total: amount,
      currency: 'USD', status: 'PAID', createdById: uid,
    }});
    costN++;
  }
  for (const [desc, party, amount, status] of INCOME) {
    await prisma.projectTransaction.create({ data: {
      projectId: project.id, kind: 'INCOME', date: new Date('2026-06-20'),
      description: desc, party, amount, taxAmount: 0, total: amount, currency: 'USD', status, createdById: uid,
    }});
  }
  console.log(`Ledger: ${costN} costs + ${INCOME.length} income entries.`);

  // 4. Vendors + purchase orders (committed spend) + mirror invoiced as ledger cost
  const VENDORS = [
    ['Panavision Hollywood', 'Camera', 'rentals@panavision.com'],
    ['ISS / Independent Studio Services', 'Props & Armory', 'orders@iss-props.com'],
    ['Quixote Studios', 'Grip, Electric & Trucks', 'bookings@quixote.com'],
    ['Stunts Unlimited', 'Stunts', 'office@stuntsunlimited.com'],
    ['Pixel Forge VFX', 'Visual Effects', 'bids@pixelforgevfx.com'],
    ['FilmLA', 'Permits', 'coordinator@filmla.com'],
  ];
  const vendorMap = {};
  for (const [name, category, email] of VENDORS) {
    const v = await prisma.productionVendor.create({ data: { projectId: project.id, name, category, email } });
    vendorMap[name] = v.id;
  }
  const POS = [
    ['Panavision Hollywood', '3300', 'Camera Package', 'Camera package — A/B/C cameras + lenses (16 wks)', 980000, 'PARTIALLY_INVOICED', 520000],
    ['Quixote Studios', '3200', 'Lighting & Electrical', 'Lighting & genny package + 10-ton trucks', 540000, 'PARTIALLY_INVOICED', 300000],
    ['ISS / Independent Studio Services', '3700', 'Picture Vehicles & Armory', 'Weapons, blanks & armorer; picture SUVs', 420000, 'APPROVED', 0],
    ['Stunts Unlimited', '3800', 'Stunts', 'Stunt team, high falls, car hits — block 1', 760000, 'PARTIALLY_INVOICED', 410000],
    ['Pixel Forge VFX', '5400', 'Visual Effects', 'VFX — 220 shots, milestone 1', 2200000, 'APPROVED', 0],
    ['FilmLA', '3600', 'Locations', 'Street-closure permits & monitors (chase block)', 95000, 'SUBMITTED', 0],
  ];
  let poN = 0;
  for (const [vendor, code, title, desc, amount, status, invoiced] of POS) {
    poN++;
    const poNumber = `PO-2026-${String(poN).padStart(4, '0')}`;
    await prisma.purchaseOrder.create({ data: {
      projectId: project.id, poNumber, vendorId: vendorMap[vendor] || null, vendorName: vendor,
      costCenterCode: code, costCenterTitle: title, description: desc, date: new Date('2026-06-25'),
      amount, taxAmount: 0, total: amount, invoicedAmount: invoiced, currency: 'USD', status,
    }});
    if (invoiced > 0) {
      await prisma.projectTransaction.create({ data: {
        projectId: project.id, kind: 'COST', date: new Date('2026-07-15'),
        accountCode: code, accountTitle: title, description: `Invoice — ${poNumber} (${desc})`,
        party: vendor, reference: poNumber, amount: invoiced, taxAmount: 0, total: invoiced,
        currency: 'USD', status: 'APPROVED', createdById: uid,
      }});
    }
  }
  console.log(`Purchasing: ${VENDORS.length} vendors + ${POS.length} purchase orders.`);

  // 5. Crew directory + project assignments
  let crewN = 0;
  for (const [name, dept, roleLabel, email, country, isLocal, prodRole] of CREW) {
    let member = await prisma.crewMember.findFirst({ where: { name } });
    if (!member) member = await prisma.crewMember.create({ data: {
      name, department: dept, role: roleLabel, email, baseCountry: country, isLocal, nationality: country, status: 'ACTIVE',
    }});
    await prisma.productionCrew.create({ data: {
      projectId: project.id, crewMemberId: member.id, name, role: prodRole, roleTitle: roleLabel,
      department: dept, email, startDate: PREP_START, endDate: SHOOT_END, location: 'Los Angeles, USA',
      dealMemoStatus: 'SIGNED', ndaStatus: 'SIGNED',
    }});
    crewN++;
  }
  console.log(`Crew: ${crewN} assignments.`);

  // 6. US guild labor bodies (look up; create if the labor seed hasn't run)
  const sag = await ensureLabor('UNION', 'SAG-AFTRA', 'SAG-AFTRA', 'https://www.sagaftra.org');
  await ensureLabor('GUILD', 'Directors Guild of America', 'DGA', 'https://www.dga.org');
  await ensureLabor('GUILD', 'Writers Guild of America', 'WGA', 'https://www.wga.org');
  await ensureLabor('UNION', 'IATSE', 'IATSE', 'https://www.iatse.net');
  await ensureLabor('UNION', 'Teamsters Local 399', 'Teamsters 399', 'https://ht399.org');

  // 7. Characters + cast (talent on SAG-AFTRA) + casting calls + confirmed submissions
  let castN = 0;
  for (const [charName, actor, roleType, gender, ageMin, ageMax, days, dialogue, stuntDays, rate, backstory] of CAST) {
    const character = await prisma.characterProfile.create({ data: {
      projectId: project.id, name: charName, backstory, shootDays: days, dialoguePages: dialogue,
      stuntDays, castingGender: gender, ageRangeMin: ageMin, ageRangeMax: ageMax,
      notes: `${roleType} role.`,
    }});
    const talent = await prisma.globalTalentProfile.create({ data: {
      fullName: actor, status: 'ACTIVE', consentStatus: 'GRANTED', gender, nationality: 'USA', baseCity: 'Los Angeles',
      unions: ['SAG-AFTRA'], unionStatus: 'Member', laborBodyId: sag, skills: roleType === 'LEAD' ? ['Stunts', 'Firearms', 'Driving'] : [],
    }});
    const call = await prisma.castingCall.create({ data: {
      projectId: project.id, characterProfileId: character.id, roleName: charName, roleType,
      status: 'CAST', currency: 'USD', gender, ageMin, ageMax, rateMin: rate, rateMax: rate, slotsToFill: 1,
    }});
    await prisma.submission.create({ data: {
      castingCallId: call.id, talentId: talent.id, status: 'CONFIRMED', source: 'AGENT',
      boardVerdict: 'APPROVED', proposedRate: rate, score: 95,
    }});
    castN++;
  }
  console.log(`Cast: ${castN} characters + SAG-AFTRA talent cast & confirmed.`);

  // 8. Script document + revisions (White shooting → Blue → Pink) + scenes on latest
  const doc = await prisma.scriptDocument.create({ data: {
    projectId: project.id, title: 'JASON QUICK — Shooting Script', kind: 'SHOOTING_SCRIPT', createdById: uid,
  }});
  const revWhite = await prisma.scriptRevision.create({ data: {
    documentId: doc.id, revisionLabel: 'White (Production Draft)', colorCode: 'WHITE', pdfUrl: '/uploads/jasonquick-white.pdf', pageCount: 112, uploadedById: uid,
  }});
  const revBlue = await prisma.scriptRevision.create({ data: {
    documentId: doc.id, revisionLabel: 'Blue Revision', colorCode: 'BLUE', pdfUrl: '/uploads/jasonquick-blue.pdf', pageCount: 113, uploadedById: uid,
  }});
  const revPink = await prisma.scriptRevision.create({ data: {
    documentId: doc.id, revisionLabel: 'Pink Revision (Current)', colorCode: 'PINK', pdfUrl: '/uploads/jasonquick-pink.pdf', pageCount: 114, uploadedById: uid,
  }});
  await prisma.scriptDocument.update({ where: { id: doc.id }, data: { activeRevisionId: revPink.id } });

  const sceneIdByNo = {};
  for (let i = 0; i < SCENES.length; i++) {
    const [no, slug, intExt, dn, ps, pe] = SCENES[i];
    const sc = await prisma.scriptScene.create({ data: {
      revisionId: revPink.id, projectId: project.id, sceneNumber: no, slugline: slug,
      intExt, dayNight: dn, pageStart: ps, pageEnd: pe, sortOrder: i,
    }});
    sceneIdByNo[no] = sc.id;
  }
  console.log(`Script: 3 revisions (White/Blue/Pink) + ${SCENES.length} scenes.`);

  // 9. Annotation layers + script notes; one PROP tag → a draft SCRIPT_TAG budget line
  const layerIds = {};
  for (const lname of ['Director Notes', 'Stunts', 'Camera', 'Props']) {
    const layer = await prisma.annotationLayer.create({ data: { documentId: doc.id, name: lname, department: lname, ownerUserId: uid } });
    layerIds[lname] = layer.id;
  }
  for (const [layer, page, tool, text, sceneNo] of NOTES) {
    const ann = await prisma.annotation.create({ data: {
      layerId: layerIds[layer], revisionId: revPink.id, documentId: doc.id, page, tool,
      payload: { text }, anchorText: text.slice(0, 40), x: 0.12, y: 0.2, w: 0.6, h: 0.05, createdById: uid,
    }});
    if (tool === 'tag') {
      // Stage the prop as a DRAFT line on the Property account (2800) — the procurement bridge
      const propAcct = v2.accountIds['2800'];
      if (propAcct) await prisma.budgetLineItem.create({ data: {
        accountId: propAcct, sortOrder: 1, description: text.replace(/^PROP:\s*/, ''),
        quantity: 3, units: 'ea', rate: 1500, currency: 'USD', exchangeRate: 1,
        fringePct: 0, subtotal: 4500, fringeAmount: 0, total: 4500,
        origin: 'SCRIPT_TAG', isDraft: true, sourceAnnotationId: ann.id,
      }});
    }
  }
  console.log(`Script notes: ${NOTES.length} annotations across 4 layers (+1 staged prop line).`);

  // 10. Stripboard (one strip per scene, with cast + shoot day) + 10-day schedule + breakdown
  const stripByScene = {};
  const dnMap = (dn) => (dn === 'NIGHT' ? 'NIGHT' : dn === 'DAWN' ? 'DAWN' : dn === 'DUSK' ? 'DUSK' : 'DAY');
  // strips ordered by shoot day then scene order
  for (let i = 0; i < SCENES.length; i++) {
    const [no, slug, intExt, dn, ps, pe, day, cast] = SCENES[i];
    const setName = slug.replace(/^(INT\.|EXT\.)\s*/, '').split(' - ')[0];
    const strip = await prisma.productionStrip.create({ data: {
      projectId: project.id, sceneNumber: no, setName, description: slug,
      intExt: intExt === 'INT' ? 'INT' : 'EXT', dayNight: dnMap(dn),
      pages: (pe - ps), cast, estMinutes: 90, shootDay: day, sortOrder: i,
    }});
    stripByScene[no] = strip.id;
    if (sceneIdByNo[no]) await prisma.scriptScene.update({ where: { id: sceneIdByNo[no] }, data: { productionStripId: strip.id } });
  }
  // 10 dated shoot days — DOOD day headers + call-sheet date mapping read these
  const scheduleRows = DAY_DATES.map((d, i) => {
    const dayNo = i + 1;
    const scenes = SCENES.filter((s) => s[6] === dayNo).map((s) => s[0]).join(', ');
    const [loc, call, wrap, note] = DAY_INFO[i];
    return { projectId: project.id, dayNumber: dayNo, date: new Date(d), location: loc, callTime: call, wrapTime: wrap, scenes, notes: note };
  });
  await prisma.productionSchedule.createMany({ data: scheduleRows });

  // Breakdown elements across categories & days → Elements view, By-Day rollup, per-category DOOD
  const bd = [
    ['1',  'WARDROBE', 'Quick tactical wet-suit (×3 doubles)', 3, '2900', 'Wardrobe', 9000],
    ['2',  'PROPS', 'Hero Beretta M9 (×3: rubber + live-fire)', 3, '2800', 'Property', 4500],
    ['2',  'SET_DRESSING', 'Shipping crates, contraband cases, work lights', 1, '2700', 'Set Dressing', 9000],
    ['2',  'STUNTS', 'Warehouse shootout — 2 high falls, squib pass', 1, '3800', 'Stunts', 38000],
    ['2',  'SFX', 'Squib rig + atmospheric haze', 1, '2600', 'Special Effects (Practical)', 22000],
    ['2',  'CAMERA', 'Technocrane + 2nd camera body', 1, '3300', 'Camera Package', 14000],
    ['3',  'STUNTS', 'Rooftop fight + ledge stand-off (fall-arrest)', 1, '3800', 'Stunts', 26000],
    ['5',  'VEHICLES', 'Cargo plane (picture) + ground crew', 1, '3700', 'Picture Vehicles & Armory', 40000],
    ['8',  'SET_DRESSING', 'Clinic dressing — surgical, tiled set', 1, '2700', 'Set Dressing', 6500],
    ['8',  'MAKEUP_HAIR', 'Prosthetic wound appliance + blood rig', 2, '3100', 'Make-up & Hairdressing', 4800],
    ['13', 'VEHICLES', 'Picture SUV (×2) + camera car + drift car', 4, '3700', 'Picture Vehicles & Armory', 32000],
    ['13', 'STUNTS', 'Stunt drivers (×3) + precision driver', 4, '3800', 'Stunts', 18000],
    ['13', 'CAMERA', 'Russian-arm camera car + insert car', 1, '3300', 'Camera Package', 21000],
    ['13', 'WARDROBE', 'Maya field costume (×2)', 2, '2900', 'Wardrobe', 3600],
    ['15', 'SET_DRESSING', 'Underpass set dressing + debris', 1, '2700', 'Set Dressing', 7000],
    ['15', 'VEHICLES', 'Hero SUV barrel-roll (gag double)', 1, '3700', 'Picture Vehicles & Armory', 55000],
    ['18', 'SET_DRESSING', 'Penthouse dressing — luxury package', 1, '2700', 'Set Dressing', 14000],
    ['20', 'SFX', 'Water FX + dock atmosphere', 1, '2600', 'Special Effects (Practical)', 17000],
    ['22', 'VEHICLES', 'Freighter (picture) + zodiac boats (×2)', 3, '3700', 'Picture Vehicles & Armory', 60000],
    ['22', 'SFX', 'Water FX + dawn smoke + fire bars', 1, '2600', 'Special Effects (Practical)', 48000],
    ['22', 'STUNTS', 'Container climb + 2nd unit stunt team', 1, '3800', 'Stunts', 52000],
  ];
  let bdN = 0;
  for (const [sc, cat, name, qty, code, title, est] of bd) {
    if (!stripByScene[sc]) continue;
    await prisma.breakdownElement.create({ data: {
      projectId: project.id, stripId: stripByScene[sc], category: cat, name, quantity: qty,
      costCenterCode: code, costCenterTitle: title, estCost: est,
    }});
    bdN++;
  }
  console.log(`Schedule: ${SCENES.length} strips + ${scheduleRows.length} shoot days + ${bdN} breakdown elements (DOOD-ready).`);

  // 11. Scout assignments + submissions + project locations
  for (const [title, type, priority, status, scenes, note, cand, candStatus] of SCOUTS) {
    const a = await prisma.scoutAssignment.create({ data: {
      projectId: project.id, title, type, priority, status, locationType: type === 'TECH_RECCE' ? 'EXT' : 'INT',
      description: note, sceneRefs: scenes, feeCurrency: 'USD', assignedToName: 'Lena Brooks',
    }});
    await prisma.scoutSubmission.create({ data: {
      assignmentId: a.id, candidateName: cand, status: candStatus, summary: note,
      ownerName: 'Location Owner', estFeePerDay: 9000, submittedByName: 'Lena Brooks',
    }});
  }
  for (const [name, type, status, stage, city, fee, scenes, note] of LOCATIONS) {
    await prisma.location.create({ data: {
      projectId: project.id, name, type, status, pipelineStage: stage, country: 'USA',
      area: city, fullAddress: city, locationFeePerDay: fee, currency: 'USD', permitRequired: true,
      scenes, ownerContactName: 'Site Manager',
      shootStart: SHOOT_START, shootEnd: SHOOT_END,
    }});
  }
  console.log(`Locations: ${SCOUTS.length} scout assignments + ${LOCATIONS.length} project locations.`);

  // 12. Call sheets for the first two shoot days
  await prisma.callSheet.create({ data: {
    projectId: project.id, shootDate: DAY1, status: 'PUBLISHED', dayNumber: 1, totalDays: 52,
    generalCall: '17:00', shootingCall: '18:30', estWrap: '05:00', weather: 'Clear, 19°C, light coastal wind',
    sunrise: '05:54', sunset: '20:06', goldenHourAm: '05:54–06:30', goldenHourPm: '19:30–20:06',
    locationName: 'Harbor Warehouse 7', locationAddress: 'Pier J, Long Beach, CA',
    hospitalName: 'Long Beach Memorial Medical Center',
    keyContacts: [
      { role: 'Director', name: 'Cole Hammond' }, { role: '1st AD', name: 'Priya Nair' },
      { role: 'UPM', name: 'Sofia Reyes' }, { role: 'Stunt Coord.', name: 'Rex Donovan' },
    ],
    scheduleItems: [
      { scene: '1', set: 'Harbor Warehouse - ext', dn: 'N', pages: '3', cast: 'Quick', est: '18:30' },
      { scene: '2', set: 'Warehouse - int', dn: 'N', pages: '5', cast: 'Quick, Draco', est: '21:00' },
      { scene: '3', set: 'Rooftop', dn: 'N', pages: '3', cast: 'Quick', est: '01:30' },
    ],
    castCalls: [
      { character: 'JASON QUICK', actor: 'Ryan Castellano', call: '16:00', makeup: '16:30', onSet: '18:00' },
      { character: 'VIKTOR DRACO', actor: 'Aleksandr Volkov', call: '19:00', makeup: '19:20', onSet: '20:30' },
    ],
    notes: 'Night shoot. Squib pass + 2 high falls (sc.2), high fall (sc.3). Safety meeting at general call.',
  }});
  await prisma.callSheet.create({ data: {
    projectId: project.id, shootDate: DAY2, status: 'PUBLISHED', dayNumber: 2, totalDays: 52,
    generalCall: '06:00', shootingCall: '07:30', estWrap: '18:00', weather: 'Sunny, 28°C',
    sunrise: '05:55', sunset: '20:05', goldenHourAm: '05:55–06:30', goldenHourPm: '19:30–20:05',
    locationName: 'Safehouse + 4th Street Corridor', locationAddress: 'Downtown, Los Angeles, CA',
    hospitalName: 'Dignity Health — California Hospital Medical Center',
    keyContacts: [
      { role: 'Director', name: 'Cole Hammond' }, { role: '1st AD', name: 'Priya Nair' },
      { role: 'Transpo', name: 'Frank Russo' }, { role: 'Stunt Coord.', name: 'Rex Donovan' },
    ],
    scheduleItems: [
      { scene: '12', set: 'Safehouse - int', dn: 'N', pages: '3', cast: 'Quick, Maya', est: '07:30' },
      { scene: '13', set: 'City Street', dn: 'D', pages: '6', cast: 'Quick, Maya', est: '10:00' },
      { scene: '14', set: 'Moving SUV - int', dn: 'D', pages: '3', cast: 'Quick, Maya', est: '14:00' },
      { scene: '15', set: 'Underpass', dn: 'D', pages: '5', cast: 'Quick, Maya', est: '15:30' },
    ],
    castCalls: [
      { character: 'JASON QUICK', actor: 'Ryan Castellano', call: '05:30', makeup: '06:00', onSet: '07:15' },
      { character: 'MAYA CRUZ', actor: 'Daniela Frost', call: '05:30', makeup: '06:00', onSet: '07:15' },
    ],
    notes: 'Street closure (FilmLA). Russian-arm camera car + drift unit. Precision drivers per stunt brief.',
  }});
  console.log('Call sheets: Day 1 (10 Jul 2026) + Day 2 (11 Jul 2026) published.');

  // 13. Lined script — coverage + take logs for the warehouse scene
  if (sceneIdByNo['2']) {
    const cov = await prisma.scriptCoverage.create({ data: {
      sceneId: sceneIdByNo['2'], revisionId: revPink.id, slate: '2A', cameraSetup: 'Master — wide, dolly in',
      description: 'Quick clears the warehouse; Draco reveal.', createdById: uid,
    }});
    await prisma.takeLog.createMany({ data: [
      { coverageId: cov.id, takeNumber: 1, status: 'NG', isCircleTake: false, notes: 'Boom in frame' },
      { coverageId: cov.id, takeNumber: 2, status: 'OK', isCircleTake: false, notes: 'Good for action' },
      { coverageId: cov.id, takeNumber: 3, status: 'PRINT', isCircleTake: true, notes: 'Circle — best performance' },
    ]});
  }
  console.log('Lining: coverage + 3 takes on the warehouse master.');

  console.log('\nDONE. Open Production → Projects → Jason Quick.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
