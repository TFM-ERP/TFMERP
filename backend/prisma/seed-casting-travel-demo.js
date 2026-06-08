/**
 * DEMO SEED — Casting (SYS-10) + Travel Identity (SYS-11) test data.
 *
 * Populates project PRD-2026-0016 with a full casting → travel pipeline:
 *   Talent (fictional names, placeholder headshots) → Character Profiles →
 *   Casting Calls → Submissions → Auditions → Board verdicts → Negotiations →
 *   Deal Memos → Travel Identities (passports/visas/docs/trips/flights/hotels/
 *   arrivals/accompanying persons) → Ops checklists → Performance reviews.
 *
 * Photos: i.pravatar.cc (royalty-free placeholder faces). Names are fictional.
 * Idempotent: cleans its own demo rows first (tagged by email domain / notes).
 *
 * Run:  node prisma/seed-casting-travel-demo.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TAG = 'DEMO_SEED';
const email = (k) => `${k}@castingdemo.tfm`;
const avatar = (n) => `https://i.pravatar.cc/512?img=${n}`;
const PDF = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
const REEL = 'https://vimeo.com/76979871';
const d = (s) => new Date(s);
const daysFromNow = (n) => new Date(Date.now() + n * 864e5);

// GCC + visa-exempt-for-UAE nationalities (no visa required to shoot in AE).
const GCC = ['AE', 'SA', 'BH', 'KW', 'OM', 'QA'];

// ── Talent pool (fictional) ──────────────────────────────────────────────────
const TALENT = [
  { k: 'yusra',  name: 'Yusra Haddad',      g: 'Female', nat: 'AE', city: 'Abu Dhabi', home: ['AE', 'Abu Dhabi'], img: 5,  union: 'none',     skills: ['Horse riding', 'Stage combat'], langs: ['Arabic', 'English'] },
  { k: 'daniel', name: 'Daniel Okoro',      g: 'Male',   nat: 'GB', city: 'London',    home: ['GB', 'London'],    img: 12, union: 'Equity',   skills: ['Boxing', 'Accents'],             langs: ['English'] },
  { k: 'layla',  name: 'Layla Nasser',      g: 'Female', nat: 'JO', city: 'Amman',     home: ['JO', 'Amman'],     img: 9,  union: 'none',     skills: ['Dance', 'Singing'],              langs: ['Arabic', 'English', 'French'] },
  { k: 'marcus', name: 'Marcus Reeves',     g: 'Male',   nat: 'US', city: 'Los Angeles', home: ['US', 'Los Angeles'], img: 13, union: 'SAG', skills: ['Firearms', 'Driving'],          langs: ['English', 'Spanish'] },
  { k: 'aiko',   name: 'Aiko Tanaka',       g: 'Female', nat: 'JP', city: 'Tokyo',     home: ['JP', 'Tokyo'],     img: 16, union: 'none',     skills: ['Martial arts', 'Calligraphy'],   langs: ['Japanese', 'English'] },
  { k: 'omar',   name: 'Omar Farouk',       g: 'Male',   nat: 'AE', city: 'Dubai',     home: ['AE', 'Dubai'],     img: 11, union: 'none',     skills: ['Parkour'],                        langs: ['Arabic', 'English'] },
  { k: 'priya',  name: 'Priya Menon',       g: 'Female', nat: 'IN', city: 'Mumbai',    home: ['IN', 'Mumbai'],    img: 20, union: 'none',     skills: ['Classical dance', 'Singing'],    langs: ['Hindi', 'English', 'Tamil'] },
  { k: 'vince',  name: 'Vince Carter',      g: 'Male',   nat: 'CA', city: 'Toronto',   home: ['CA', 'Toronto'],   img: 14, union: 'ACTRA',    skills: ['Stunt driving', 'High falls', 'Wire work'], langs: ['English', 'French'] },
  { k: 'sara',   name: 'Sara Bianchi',      g: 'Female', nat: 'IT', city: 'Rome',      home: ['IT', 'Rome'],      img: 24, union: 'none',     skills: ['Fencing'],                        langs: ['Italian', 'English'] },
  { k: 'khalid', name: 'Khalid Mansour',    g: 'Male',   nat: 'SA', city: 'Riyadh',    home: ['SA', 'Riyadh'],    img: 18, union: 'none',     skills: ['Falconry'],                       langs: ['Arabic', 'English'] },
  { k: 'emma',   name: 'Emma Lawson',       g: 'Female', nat: 'US', city: 'New York',  home: ['US', 'New York'],  img: 26, union: 'SAG',      skills: ['Improv', 'Piano'],                langs: ['English'] },
  { k: 'noah',   name: 'Noah Bennett',      g: 'Male',   nat: 'GB', city: 'Manchester', home: ['GB', 'Manchester'], img: 33, union: 'Equity', skills: ['Swimming', 'Rowing'],            langs: ['English'] },
  { k: 'fatima', name: 'Fatima Al Suwaidi', g: 'Female', nat: 'AE', city: 'Abu Dhabi', home: ['AE', 'Abu Dhabi'], img: 31, union: 'none',     skills: ['Poetry recitation'],              langs: ['Arabic', 'English'] },
  { k: 'ravi',   name: 'Ravi Kapoor',       g: 'Male',   nat: 'IN', city: 'Delhi',     home: ['IN', 'Delhi'],     img: 51, union: 'none',     skills: ['Motorcycle stunts'],              langs: ['Hindi', 'English', 'Punjabi'] },
];

// ── Characters in PRD-2026-0016 ──────────────────────────────────────────────
const CHARACTERS = [
  { k: 'cap',   name: 'Captain Yusra Haddad', roleType: 'LEAD',       g: 'Female', ageMin: 30, ageMax: 42, shootDays: 28, dialoguePages: 45, stuntDays: 4, locations: 'Abu Dhabi, Liwa Desert', backstory: 'Decorated naval officer hiding a personal loss; the moral centre of the film.', arc: 'From duty-bound stoicism to open-hearted leadership.', requirements: 'Strong physical presence, Arabic & English, comfortable with weapons handling.' },
  { k: 'cross', name: 'Daniel Cross',          roleType: 'LEAD',       g: 'Male',   ageMin: 35, ageMax: 50, shootDays: 30, dialoguePages: 50, stuntDays: 2, locations: 'Abu Dhabi, Yas Island', backstory: 'Disgraced intelligence analyst seeking redemption.', arc: 'Cynic to reluctant hero.', requirements: 'Gravitas, dialogue-heavy, light combat.' },
  { k: 'layla', name: 'Layla',                 roleType: 'SUPPORTING', g: 'Female', ageMin: 24, ageMax: 34, shootDays: 14, dialoguePages: 20, stuntDays: 0, locations: 'Abu Dhabi', backstory: 'Local fixer with divided loyalties.', arc: 'Bystander to ally.', requirements: 'Arabic fluency, emotional range.' },
  { k: 'vane',  name: 'Marcus Vane',           roleType: 'SUPPORTING', g: 'Male',   ageMin: 40, ageMax: 55, shootDays: 12, dialoguePages: 18, stuntDays: 1, locations: 'Abu Dhabi', backstory: 'The antagonist — a private military contractor.', arc: 'Charm masking ruthlessness.', requirements: 'Commanding screen presence, firearms.' },
  { k: 'aiko',  name: 'Dr. Aiko',              roleType: 'FEATURED',   g: 'Female', ageMin: 28, ageMax: 40, shootDays: 6, dialoguePages: 8, stuntDays: 0, locations: 'Abu Dhabi', backstory: 'Brilliant scientist caught in the crossfire.', arc: 'Reluctant to resolute.', requirements: 'Technical dialogue, Japanese & English.' },
  { k: 'omar',  name: 'Omar (Driver)',         roleType: 'DAY_PLAYER', g: 'Male',   ageMin: 20, ageMax: 30, shootDays: 3, dialoguePages: 3, stuntDays: 0, locations: 'Abu Dhabi', backstory: 'Streetwise local driver.', arc: 'Comic relief with heart.', requirements: 'Local, energetic, light stunts.' },
  { k: 'op',    name: 'The Operative',         roleType: 'STUNT',      g: 'Male',   ageMin: 30, ageMax: 45, shootDays: 8, dialoguePages: 2, stuntDays: 8, locations: 'Liwa Desert', backstory: 'Silent enforcer.', arc: 'Pure threat.', requirements: 'Stunt-trained, wire work, high falls, driving.' },
  { k: 'priya', name: 'Priya',                 roleType: 'SUPPORTING', g: 'Female', ageMin: 25, ageMax: 35, shootDays: 10, dialoguePages: 14, stuntDays: 0, locations: 'Abu Dhabi', backstory: 'Investigative journalist.', arc: 'Outsider to insider.', requirements: 'Strong dialogue, Hindi & English.' },
];

// ── Casting plan: candidates per character, who is offered/confirmed ──────────
const PLAN = [
  { char: 'cap',   cands: ['yusra', 'fatima', 'layla'], offer: 'yusra',  confirmed: true,  rate: 9000 },
  { char: 'cross', cands: ['daniel', 'marcus', 'noah'],  offer: 'daniel', confirmed: true,  rate: 12000 },
  { char: 'layla', cands: ['layla', 'priya', 'aiko'],    offer: 'layla',  confirmed: false, rate: 4500 },
  { char: 'vane',  cands: ['marcus', 'vince'],           offer: 'marcus', confirmed: true,  rate: 8000 },
  { char: 'aiko',  cands: ['aiko', 'priya'],             offer: null,     confirmed: false, rate: 3500 },
  { char: 'omar',  cands: ['omar', 'khalid'],            offer: 'omar',   confirmed: true,  rate: 2200 },
  { char: 'op',    cands: ['vince'],                     offer: 'vince',  confirmed: true,  rate: 6000 },
  { char: 'priya', cands: ['priya', 'ravi', 'sara'],     offer: null,     confirmed: false, rate: 4000 },
];

const VISA_TYPE = { US: 'US_O1', GB: 'UK_CREATIVE_WORKER', IN: 'INDIA_BUSINESS_EVISA', CA: 'OTHER', JP: 'OTHER', IT: 'SCHENGEN_C', JO: 'OTHER' };

async function cleanup() {
  const ops = [
    prisma.travelerProfile.deleteMany({ where: { notes: TAG } }),
    prisma.projectContract.deleteMany({ where: { contractNumber: { startsWith: 'DEMO-CON-' } } }),
    prisma.globalTalentProfile.deleteMany({ where: { email: { endsWith: '@castingdemo.tfm' } } }),
    prisma.characterProfile.deleteMany({ where: { notes: TAG } }),
  ];
  for (const op of ops) { try { await op; } catch (e) { /* ignore */ } }
}

async function main() {
  let project = await prisma.productionProject.findFirst({ where: { projectNumber: 'PRD-2026-0016' } });
  if (!project) project = await prisma.productionProject.findFirst({ where: { isHouse: false }, orderBy: { createdAt: 'asc' } });
  if (!project) throw new Error('No project found. Create a production first.');
  console.log(`Seeding into project: ${project.projectNumber} — ${project.title}`);

  await cleanup();
  // demo casting calls reference characters via characterProfileId (SetNull), clean leftover demo calls by role name
  try { await prisma.castingCall.deleteMany({ where: { projectId: project.id, roleName: { in: CHARACTERS.map((c) => c.name) } } }); } catch {}

  // Unions
  const findBody = async (q) => (await prisma.laborBody.findFirst({ where: { name: { contains: q } } }))?.id || null;
  const unions = { SAG: await findBody('SAG'), ACTRA: await findBody('ACTRA'), Equity: await findBody('Equity') };

  // 1) Talent
  const talentId = {};
  for (const t of TALENT) {
    const created = await prisma.globalTalentProfile.create({
      data: {
        fullName: t.name, status: 'ACTIVE', email: email(t.k), phone: '+9715' + (1000000 + t.img),
        gender: t.g, nationality: t.nat, baseCity: t.city, languages: t.langs, skills: t.skills,
        headshotUrls: [avatar(t.img)], reelUrls: [REEL], unions: t.union !== 'none' ? [t.union] : [],
        unionStatus: t.union === 'none' ? 'Non-union' : t.union, laborBodyId: t.union === 'SAG' ? unions.SAG : t.union === 'ACTRA' ? unions.ACTRA : t.union === 'Equity' ? unions.Equity : null,
        consentStatus: 'GRANTED', consentGivenAt: new Date(), gdprConsentVersion: 'v1', lawfulBasis: 'consent',
        homeCountry: t.home[0], homeCity: t.home[1], workRegion: 'United Arab Emirates',
        isLocalTalent: t.home[0] === 'AE', travelRequired: t.home[0] !== 'AE',
        visaRequired: t.home[0] !== 'AE' && !GCC.includes(t.nat),
        accommodationRequired: t.home[0] !== 'AE', groundTransportRequired: t.home[0] !== 'AE',
      },
    });
    talentId[t.k] = created.id;
  }
  console.log(`  ✓ ${TALENT.length} talent`);

  // 2) Characters + Casting calls
  const charRec = {}, callRec = {};
  for (const c of CHARACTERS) {
    const ch = await prisma.characterProfile.create({
      data: { projectId: project.id, name: c.name, backstory: c.backstory, arc: c.arc, relationships: 'See script.', shootDays: c.shootDays, dialoguePages: c.dialoguePages, stuntDays: c.stuntDays, locations: c.locations, requirements: c.requirements, notes: TAG },
    });
    charRec[c.k] = ch;
    const plan = PLAN.find((p) => p.char === c.k);
    const call = await prisma.castingCall.create({
      data: {
        projectId: project.id, characterProfileId: ch.id, roleName: c.name, roleType: c.roleType,
        characterDescription: c.backstory, status: plan?.confirmed ? 'CAST' : plan?.offer ? 'OFFER' : 'OPEN',
        ageMin: c.ageMin, ageMax: c.ageMax, gender: c.g, specialSkills: (c.requirements || '').split(',').map((s) => s.trim()).slice(0, 3),
        rateMin: Math.round((plan?.rate || 4000) * 0.8), rateMax: Math.round((plan?.rate || 4000) * 1.2), currency: 'AED', slotsToFill: 1, isPublic: true,
      },
    });
    callRec[c.k] = call;
  }
  console.log(`  ✓ ${CHARACTERS.length} characters + calls`);

  // 3) Submissions + auditions + verdicts + negotiations + ops + contracts
  let conN = 1;
  for (const p of PLAN) {
    const call = callRec[p.char];
    for (const k of p.cands) {
      const isOffer = p.offer === k;
      const status = isOffer ? (p.confirmed ? 'CONFIRMED' : 'OFFERED') : (k === p.cands[0] ? 'SHORTLISTED' : 'UNDER_REVIEW');
      const verdict = isOffer ? 'APPROVED' : (k === p.cands[1] ? 'MAYBE' : k === p.cands[2] ? 'PASS' : null);
      const sub = await prisma.submission.create({
        data: {
          castingCallId: call.id, talentId: talentId[k], status, source: 'AGENT', boardVerdict: verdict,
          proposedRate: Math.round(p.rate * (isOffer ? 1 : 0.9)), availabilityNote: 'Available for shoot window',
          coverNote: 'Submitted by agency for consideration.', score: isOffer ? 90 : 70 + (call.id.charCodeAt(2) % 15),
        },
      });
      // audition for shortlisted/offered
      if (isOffer || status === 'SHORTLISTED') {
        await prisma.audition.create({ data: { submissionId: sub.id, type: isOffer ? 'CALLBACK' : 'SELF_TAPE', status: 'COMPLETED', scheduledAt: daysFromNow(-7), durationMins: 30, location: 'Abu Dhabi Studio', score: isOffer ? 9 : 7, decision: isOffer ? 'BOOK' : 'HOLD', panelNotes: 'Strong read.' } });
      }
      // negotiation + deal memo for offered/confirmed
      if (isOffer) {
        await prisma.talentNegotiation.create({
          data: {
            submissionId: sub.id, status: p.confirmed ? 'AGREED' : 'COUNTERED', currency: 'AED',
            initialOffer: Math.round(p.rate * 0.85), counterOffer: Math.round(p.rate * 1.05), finalRate: p.confirmed ? p.rate : null,
            travelClass: GCC.includes(TALENT.find((t) => t.k === k).nat) || TALENT.find((t) => t.k === k).home[0] === 'AE' ? null : 'BUSINESS',
            accommodationTier: 'EXECUTIVE', perDiem: 350, exclusivity: 'Theatrical window', marketingRequirements: '2 press days',
            rounds: [
              { at: daysFromNow(-10).toISOString(), type: 'INITIAL', amount: Math.round(p.rate * 0.85), note: 'Opening offer' },
              { at: daysFromNow(-6).toISOString(), type: 'COUNTER', amount: Math.round(p.rate * 1.05), note: 'Agent counter' },
              ...(p.confirmed ? [{ at: daysFromNow(-3).toISOString(), type: 'OFFER', amount: p.rate, note: 'Settled' }] : []),
            ],
          },
        });
        if (p.confirmed) {
          const t = TALENT.find((x) => x.k === k);
          await prisma.projectContract.create({
            data: {
              contractNumber: `DEMO-CON-${String(conN++).padStart(3, '0')}`, title: `Deal Memo — ${t.name} as ${charRec[p.char].name}`,
              type: 'DEAL_MEMO', status: 'ACTIVE', projectId: project.id, currency: 'AED', contractValue: p.rate,
              parties: { create: [
                { role: 'COMPANY', name: 'The Film Makers FZ LLC', signerOrder: 1, signatureStatus: 'SIGNED', signedAt: daysFromNow(-2) },
                { role: 'TALENT', name: t.name, email: email(t.k), signerOrder: 2, signatureStatus: 'SIGNED', signedAt: daysFromNow(-1) },
              ] },
            },
          });
          // ops checklist (mixed completion)
          await prisma.talentOpsChecklist.create({ data: { submissionId: sub.id, wardrobeComplete: true, measurementsComplete: true, fittingsComplete: false, makeupNotesComplete: true, bankingComplete: true, taxDocsComplete: false, vendorSetupComplete: true } });
        }
      }
    }
  }
  console.log('  ✓ submissions, auditions, verdicts, negotiations, deal memos, ops checklists');

  // 4) Travel identities for cast that are offered/confirmed (local + international)
  const travelCast = PLAN.filter((p) => p.offer).map((p) => ({ k: p.offer, confirmed: p.confirmed }));
  for (const { k, confirmed } of travelCast) {
    const t = TALENT.find((x) => x.k === k);
    const local = t.home[0] === 'AE';
    const needVisa = !local && !GCC.includes(t.nat);
    const tp = await prisma.travelerProfile.create({
      data: {
        personType: 'TALENT', talentProfileId: talentId[k], fullName: t.name, preferredName: t.name.split(' ')[0],
        gender: t.g, email: email(k), phone: '+9715' + (1000000 + t.img), nationality: t.nat, countryOfResidence: t.home[0],
        headshotUrl: avatar(t.img), passportPhotoUrl: avatar(t.img),
        passportNumber: `${t.nat}${1000000 + t.img}`, passportPlaceOfIssue: t.home[1], passportIssueDate: d('2021-03-15'), passportExpiry: daysFromNow(local ? 900 : (k === 'layla' ? 120 : 1500)),
        passportPdfUrl: PDF, passportInfoUrl: PDF,
        gdprConsent: true, consentAt: new Date(), notes: TAG,
        homeCountry: t.home[0], homeCity: t.home[1], workRegion: 'United Arab Emirates',
        isLocalTalent: local, travelRequired: !local, visaRequired: needVisa, accommodationRequired: !local, groundTransportRequired: !local,
        travelPrefs: { seat: 'Aisle', meal: 'No restrictions', hotel: 'King room' }, emergencyContactName: 'Family contact', emergencyContactPhone: '+10000000000',
      },
    });

    if (!local) {
      // standing visa
      await prisma.travelerVisa.create({ data: { travelerId: tp.id, visaType: VISA_TYPE[t.nat] || 'OTHER', country: 'United Arab Emirates', issueDate: confirmed ? daysFromNow(-20) : null, expiryDate: confirmed ? daysFromNow(160) : null, entriesAllowed: 'MULTIPLE', sponsor: 'The Film Makers FZ LLC', status: needVisa ? (confirmed ? 'APPROVED' : 'IN_PROGRESS') : 'NOT_REQUIRED', visaCopyUrl: confirmed ? PDF : null } });
      // documents
      await prisma.travelerDocument.createMany({ data: [
        { travelerId: tp.id, type: 'INSURANCE', label: 'Travel insurance', fileUrl: PDF },
        { travelerId: tp.id, type: 'INVITATION_LETTER', label: 'Invitation / LOA', fileUrl: PDF },
        ...(needVisa ? [{ travelerId: tp.id, type: 'WORK_PERMIT', label: 'Work permit', fileUrl: PDF }] : []),
      ] });
      // trip + itinerary + flight + hotel (only when confirmed → readiness lights up)
      if (confirmed) {
        const trip = await prisma.trip.create({ data: { projectId: project.id, travelerId: tp.id, purpose: 'Principal photography', origin: t.home[1], destination: 'Abu Dhabi', departDate: daysFromNow(14), returnDate: daysFromNow(50), estimatedCost: 18000, currency: 'AED', status: 'BOOKED' } });
        const itin = await prisma.itinerary.create({ data: { tripId: trip.id, startDate: daysFromNow(14), endDate: daysFromNow(50), currency: 'AED', totalCost: 17500, status: 'CONFIRMED' } });
        await prisma.flightBooking.create({ data: { itineraryId: itin.id, carrier: 'Etihad Airways', flightNumber: 'EY' + (100 + t.img), departAirport: t.home[1].slice(0, 3).toUpperCase(), arriveAirport: 'AUH', departureTime: daysFromNow(14), arrivalTime: daysFromNow(14), cabinClass: 'Business', fare: 9500, currency: 'AED', pnr: 'PNR' + t.img + 'XZ', status: 'CONFIRMED' } });
        await prisma.hotelBooking.create({ data: { itineraryId: itin.id, hotelName: 'Rosewood Abu Dhabi', roomType: 'Executive King', checkIn: daysFromNow(14), checkOut: daysFromNow(50), nightlyRate: 850, totalRate: 8000, currency: 'AED', confirmationNumber: 'HTL' + t.img, status: 'CONFIRMED' } });
        await prisma.travelArrival.create({ data: { travelerId: tp.id, tripId: trip.id, airport: 'AUH (Zayed Intl)', flightNumber: 'EY' + (100 + t.img), arrivalTime: daysFromNow(14), terminal: 'Terminal A', driverAssigned: 'Ahmed (Fleet #4)', coordinatorAssigned: 'Production Office' } });

        // accompanying person for the two leads
        if (k === 'daniel' || k === 'marcus') {
          await prisma.travelerProfile.create({ data: { personType: 'ACCOMPANYING', accompaniesId: tp.id, relationship: k === 'daniel' ? 'Spouse' : 'Personal Assistant', fullName: k === 'daniel' ? 'Grace Okoro' : 'Tom Bradley', nationality: t.nat, email: email(k + '.plus1'), headshotUrl: avatar(t.img + 20), passportNumber: `${t.nat}${2000000 + t.img}`, passportExpiry: daysFromNow(1400), passportPdfUrl: PDF, gdprConsent: true, consentAt: new Date(), notes: TAG, homeCountry: t.home[0], homeCity: t.home[1], isLocalTalent: false, travelRequired: true, visaRequired: needVisa, accommodationRequired: true, groundTransportRequired: true } });
        }
      }
    }
  }
  console.log('  ✓ travel identities (passports, visas, docs, trips, flights, hotels, arrivals, accompanying)');

  // 5) Performance reviews — a multi-production track record for a few veterans
  const REVIEWS = [
    { k: 'marcus', rows: [['DIRECTOR', 'performance', 9], ['AD', 'professionalism', 9], ['PRODUCTION', 'punctuality', 8], ['WARDROBE', 'cooperation', 9]] },
    { k: 'daniel', rows: [['DIRECTOR', 'performance', 8], ['AD', 'professionalism', 10], ['PRODUCTION', 'punctuality', 9], ['MAKEUP', 'preparedness', 9]] },
    { k: 'vince',  rows: [['PRODUCTION', 'punctuality', 10], ['AD', 'professionalism', 9], ['DIRECTOR', 'performance', 8]] },
    { k: 'priya',  rows: [['DIRECTOR', 'performance', 8], ['WARDROBE', 'cooperation', 8]] },
  ];
  for (const r of REVIEWS) {
    for (const [dept, metric, rating] of r.rows) {
      await prisma.talentPerformanceReview.create({ data: { talentId: talentId[r.k], projectId: project.id, department: dept, metric, rating, comments: 'Demo review — internal only.' } });
    }
  }
  console.log('  ✓ performance reviews');

  console.log('\nDemo seed complete. Open Casting → Talent Database and the project Engagements → Casting/Travel.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
