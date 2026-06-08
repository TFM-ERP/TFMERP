import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FxService } from '../../fx/fx.service';
import { ProductionStatus } from '@prisma/client';

// ── Master Chart of Accounts (docs/production/13 + 15) ─────────────────────────────
// Line tuples: [code, description, fringeClassification?]
type SeedLineT = [string, string] | [string, string, string];
type SeedSection = { code: string; title: string; tier: string; sortOrder: number; color: string; accounts: { code: string; title: string; lines: SeedLineT[] }[] };

// Numbering follows the INDUSTRY-STANDARD Movie Magic / AICP topsheet exactly
// ("Master cost numbers" doc + docs/production/17). Existing projects keep the
// codes they were created with — this seed affects NEW projects only.
const MASTER_COA: SeedSection[] = [
  { code: '1000', title: 'Above The Line', tier: 'ATL', sortOrder: 1, color: '#7c3aed', accounts: [
    { code: '1100', title: 'Story, Rights & Continuity', lines: [['1101', 'Story Rights / Option'], ['1102', 'Screenplay Purchase', 'WRITER'], ['1103', 'Screenwriter / Revisions', 'WRITER'], ['1104', 'Research & Clearances'], ['1105', 'Translators / Subtitlers']] },
    { code: '1200', title: 'Producers Unit', lines: [['1201', 'Executive Producer', 'PRODUCER'], ['1202', 'Producer', 'PRODUCER'], ['1203', 'Line Producer', 'PRODUCER'], ['1204', 'Co-Producer / Associate Producer', 'PRODUCER'], ['1205', "Producers' Assistants"]] },
    { code: '1300', title: 'Directors Unit', lines: [['1301', 'Director', 'DIRECTOR'], ['1302', '2nd Unit Director', 'DIRECTOR'], ['1303', "Director's Assistant"], ['1304', 'Storyboard Artist']] },
    { code: '1400', title: 'Cast', lines: [['1401', 'Lead Actors', 'PERFORMER'], ['1402', 'Supporting Cast', 'PERFORMER'], ['1403', 'Day Players', 'PERFORMER'], ['1404', 'Voiceover / Narrator', 'PERFORMER'], ['1405', 'Casting Director & Expenses', 'CREW']] },
    { code: '1500', title: 'Bits & Stunts', lines: [['1501', 'Stunt Coordinator', 'STUNT'], ['1502', 'Stunt Performers / Doubles', 'STUNT'], ['1503', 'Stunt Adjustments', 'STUNT']] },
    { code: '1800', title: 'ATL Travel & Living', lines: [['1801', 'ATL Flights'], ['1802', 'ATL Hotels & Living'], ['1803', 'ATL Per Diem'], ['1804', 'Car Services']] },
  ]},
  { code: '2000', title: 'Production', tier: 'BTL', sortOrder: 2, color: '#0891b2', accounts: [
    { code: '2000', title: 'Production Staff', lines: [['2001', 'Unit Production Manager (UPM)', 'CREW'], ['2002', 'First Assistant Director (1st AD)', 'CREW'], ['2003', 'Second Assistant Director (2nd AD)', 'CREW'], ['2004', 'Production Coordinator', 'CREW'], ['2005', 'Production Accountant', 'CREW'], ['2006', 'Production Assistants (Office & Set)', 'CREW'], ['2007', 'Script Supervisor (Continuity)', 'CREW']] },
    { code: '2100', title: 'Extra Talent', lines: [['2101', 'Background Extras', 'BG'], ['2102', 'Stand-Ins', 'BG'], ['2103', 'Extras Casting', 'CREW'], ['2104', 'Minors Tutor / Studio Teacher']] },
    { code: '2200', title: 'Set Design (Art)', lines: [['2201', 'Production Designer', 'CREW'], ['2202', 'Art Director', 'CREW'], ['2203', 'Set Designers / Draughtspersons', 'CREW'], ['2204', 'Graphic / Concept Artist', 'CREW'], ['2211', 'Art Dept Purchases & Supplies']] },
    { code: '2300', title: 'Set Construction', lines: [['2301', 'Construction Coordinator', 'CREW'], ['2302', 'Carpenters & Laborers', 'CREW'], ['2303', 'Scenic Charge / Painters', 'CREW'], ['2308', 'Greens Purchased / Rented'], ['2309', 'Greensperson Labor', 'CREW'], ['2311', 'Construction Materials (Lumber, Paint)']] },
    { code: '2400', title: 'Set Striking', lines: [['2401', 'Strike Labor', 'CREW'], ['2402', 'Disposal & Site Restoration']] },
    { code: '2500', title: 'Set Operations', lines: [['2501', 'Key Grip', 'CREW'], ['2502', 'Best Boy Grip', 'CREW'], ['2503', 'Grip Day Players / Swing Gang', 'CREW'], ['2504', 'Dolly Grip', 'CREW'], ['2511', 'Grip Package Rental'], ['2521', 'Catering Staff & Truck', 'CREW'], ['2522', 'Craft Service & Meals']] },
    { code: '2600', title: 'Special Effects', lines: [['2601', 'SFX Coordinator', 'CREW'], ['2602', 'SFX Technicians', 'CREW'], ['2605', 'Mechanical Rigging'], ['2611', 'SFX Materials / Squibs / Pyro']] },
    { code: '2700', title: 'Set Dressing', lines: [['2701', 'Set Decorator', 'CREW'], ['2702', 'Leadperson', 'CREW'], ['2703', 'Set Dressers / Swing Gang', 'CREW'], ['2704', 'Buyer / Shopper', 'CREW'], ['2711', 'Set Dressing Purchases / Rentals']] },
    { code: '2800', title: 'Property (Props)', lines: [['2801', 'Propmaster', 'CREW'], ['2802', 'Assistant Propmasters', 'CREW'], ['2803', 'Weapons Master / Armourer', 'CREW'], ['2811', 'Prop Purchases / Rentals']] },
    { code: '2900', title: 'Wardrobe', lines: [['2901', 'Costume Designer', 'CREW'], ['2902', 'Wardrobe Supervisor', 'CREW'], ['2903', 'Key / Set Costumers', 'CREW'], ['2904', 'Tailor / Seamstress / Ager-Dyer', 'CREW'], ['2911', 'Costume Purchases / Rentals'], ['2912', 'Dry Cleaning & Laundry']] },
    { code: '3000', title: 'Picture Vehicles', lines: [['3001', 'Picture Car Purchases / Rentals'], ['3002', 'Picture Vehicle Coordinator', 'CREW'], ['3003', 'Picture Vehicle Fuel & Maintenance']] },
    { code: '3100', title: 'Makeup & Hairstyling', lines: [['3101', 'Head Makeup Artist', 'CREW'], ['3102', 'Key Hair Stylist', 'CREW'], ['3103', 'SFX Makeup / Prosthetics', 'CREW'], ['3111', 'Makeup & Hair Supplies']] },
    { code: '3200', title: 'Lighting / Electrical', lines: [['3201', 'Gaffer (Chief Lighting Technician)', 'CREW'], ['3202', 'Best Boy Electric', 'CREW'], ['3203', 'Set Electricians', 'CREW'], ['3204', 'Generator Operator', 'CREW'], ['3211', 'Lighting Package Rental'], ['3212', 'Generators & Fuel']] },
    { code: '3300', title: 'Camera', lines: [['3301', 'Director of Photography (DP)', 'CREW'], ['3302', 'Camera Operators (A/B)', 'CREW'], ['3303', '1st AC (Focus Puller)', 'CREW'], ['3304', '2nd AC (Clapper / Loader)', 'CREW'], ['3305', 'Steadicam / Specialty Operator', 'CREW'], ['3311', 'Camera Package Rental'], ['3313', 'Camera Crane Rental'], ['3314', 'Specialty Rigging'], ['3315', 'Drone Package']] },
    { code: '3400', title: 'Production Sound', lines: [['3401', 'Production Sound Mixer', 'CREW'], ['3402', 'Boom Operator', 'CREW'], ['3403', 'Sound Utility / Playback', 'CREW'], ['3413', 'Sound Package & Comms (Walkies)']] },
    { code: '3500', title: 'Transportation', lines: [['3501', 'Transportation Coordinator', 'DRIVER'], ['3502', 'Transportation Captain', 'DRIVER'], ['3503', 'Drivers (Vans, Trucks, Trailers)', 'DRIVER'], ['3511', 'Production Vehicle Rentals & Fuel']] },
    { code: '3600', title: 'Location', lines: [['3601', 'Location Manager', 'CREW'], ['3602', 'Assistant Location Manager', 'CREW'], ['3603', 'Location Scouts', 'CREW'], ['3611', 'Location Fees & Site Rentals'], ['3612', 'Government Permits'], ['3613', 'Waste Management & Cleaning'], ['3685', 'Trucks & Location Security'], ['3686', 'Off-Duty Police Details']] },
    { code: '3700', title: 'Production Film & Lab / Digital', lines: [['3701', 'Digital Imaging Technician (DIT)', 'CREW'], ['3702', 'Media, Cards & Storage'], ['3703', 'Dailies / Rushes Transfers']] },
    { code: '3800', title: 'Travel & Living (BTL)', lines: [['3801', 'Crew Flights'], ['3802', 'Crew Housing'], ['3803', 'Crew Per Diem']] },
    { code: '4000', title: 'Production Facilities', lines: [['4001', 'Stage / Studio Rentals'], ['4002', 'Production Office Rental'], ['4003', 'Utilities & Trash Removal'], ['4004', 'Office Equipment & Communications']] },
    { code: '4100', title: 'Animals', lines: [['4101', 'Head Wrangler', 'CREW'], ['4102', 'Wranglers / Animal Handlers', 'CREW'], ['4104', 'Animal Purchases / Rentals'], ['4105', 'Veterinary Services'], ['4116', 'Animal Food & Kennels']] },
    { code: '4200', title: 'Second Unit', lines: [['4201', 'Second Unit Crew', 'CREW'], ['4202', 'Second Unit Expenses']] },
    { code: '4400', title: 'Aerial Unit', lines: [['4401', 'Drone / Aerial Team', 'CREW'], ['4402', 'Helicopter & Aerial Rentals']] },
    { code: '4500', title: 'Marine Unit', lines: [['4501', 'Marine Crew & Safety Divers', 'CREW'], ['4502', 'Camera Boats & Marine Rentals']] },
    { code: '4600', title: 'Health & Safety', lines: [['4601', 'Set Medic / Paramedic', 'CREW'], ['4602', 'Health & Safety Supervisor', 'CREW'], ['4603', 'Intimacy Coordinator', 'CREW'], ['4604', 'Fire Watch']] },
    { code: '4800', title: 'Re-shoots', lines: [['4801', 'Re-shoot / Pickup Allocation']] },
  ]},
  { code: '5000', title: 'Post Production', tier: 'POST', sortOrder: 3, color: '#059669', accounts: [
    { code: '5000', title: 'Post Staff & Facilities', lines: [['5001', 'Post-Production Producer / Supervisor', 'CREW'], ['5002', 'Post Coordinator', 'CREW'], ['5003', 'Post Facility Fees']] },
    { code: '5100', title: 'Editing', lines: [['5101', 'Editor', 'CREW'], ['5102', 'Assistant Editors', 'CREW'], ['5111', 'Edit Suite, Hardware & Storage']] },
    { code: '5200', title: 'Music', lines: [['5201', 'Composer'], ['5202', 'Music Supervisor', 'CREW'], ['5203', 'Musicians / Scoring Mixer'], ['5211', 'Music Licensing, Sync & Master Rights']] },
    { code: '5300', title: 'Video Post Sound', lines: [['5301', 'Supervising Sound Editor / Designer', 'CREW'], ['5302', 'Re-recording Mixer', 'CREW'], ['5303', 'Foley Artist / ADR', 'CREW'], ['5311', 'ADR, Foley & Mix Studio Rental']] },
    { code: '5400', title: 'Visual Effects', lines: [['5401', 'VFX Supervisor', 'CREW'], ['5402', 'VFX Producers', 'CREW'], ['5403', 'Digital Asset Creation / CGI Artists', 'CREW'], ['5411', 'VFX Vendors & Render Costs']] },
    { code: '5500', title: 'Video Post Picture (DI)', lines: [['5501', 'Colorist (Digital Intermediate)', 'CREW'], ['5502', 'Online / Conform Editor', 'CREW'], ['5511', 'DI Suite & Mastering']] },
    { code: '5600', title: 'Titles', lines: [['5601', 'Title Design & Credits'], ['5602', 'Subtitles, CC & Audio Description']] },
    { code: '5700', title: 'Stock Footage & Deliverables', lines: [['5701', 'Archival / Stock Footage Licensing'], ['5702', 'Master Files, QC & LTO Deliverables']] },
    { code: '5800', title: 'Post Travel & Living', lines: [['5801', 'Post T&L']] },
  ]},
  { code: '6000', title: 'Other', tier: 'OTHER', sortOrder: 4, color: '#d97706', accounts: [
    { code: '6300', title: 'Tests', lines: [['6301', 'Screenings, Focus Groups & Surveys']] },
    { code: '6400', title: 'Studio Expenses', lines: [['6401', 'Production Overhead Charges']] },
    { code: '6500', title: 'Publicity / Marketing', lines: [['6501', 'Unit Publicist', 'CREW'], ['6502', 'Stills Photographer', 'CREW'], ['6503', 'EPK Crew (Behind The Scenes)', 'CREW'], ['6511', 'PR, Trailer & Poster Assets']] },
    { code: '6700', title: 'Insurance', lines: [['6701', 'Commercial General Liability (CGL)'], ['6702', 'Errors & Omissions (E&O)'], ['6703', 'Equipment & Production Package'], ['6704', 'Workers Comp / Employer Liability'], ['6705', 'Cast Insurance']] },
    { code: '6800', title: 'General Expense / Office', lines: [['6801', 'Legal Counsel (Production Attorney)'], ['6802', 'Bank Charges & Payroll Service Fees'], ['6803', 'Office Supplies & Courier'], ['6805', 'Miscellaneous / Petty Cash']] },
    { code: '6900', title: 'Contingency / Completion Bond', lines: [['6901', 'Production Contingency (10%)'], ['6902', 'Completion Guarantor Fees']] },
  ]},
];

// Optional studio-level ledger (P&A, Revenue, COGS, Corporate) — seeded only on request.
// Shifted to 7000+ so it can never collide with the industry topsheet's 6300–6900 range.
const DISTRIBUTION_COA: SeedSection[] = [
  { code: '7000', title: 'Prints & Advertising (P&A)', tier: 'OTHER', sortOrder: 6, color: '#db2777', accounts: [
    { code: '7100', title: 'Creative Materials', lines: [['7101', 'Trailer & Teaser Production'], ['7102', 'Key Art / Poster Design'], ['7103', 'TV & Radio Spots (Cutdowns)'], ['7104', 'Digital & Social Media Assets']] },
    { code: '7200', title: 'Media Buy (Advertising)', lines: [['7201', 'National / Local TV Buy'], ['7202', 'Digital Media (YouTube, Meta, TikTok)'], ['7203', 'Out-of-Home (OOH) (Billboards, Transit)'], ['7204', 'Print & Trade Publications']] },
    { code: '7300', title: 'Publicity & PR', lines: [['7301', 'PR Agency Retainers'], ['7302', 'Press Junkets & Talent Travel'], ['7303', 'Premiere Event Costs (Venue, Red Carpet)'], ['7304', 'Film Festival Fees & Expenses']] },
    { code: '7400', title: 'Print & Logistics', lines: [['7401', 'DCP (Digital Cinema Package) Creation'], ['7402', 'KDM Key Generation & Delivery'], ['7403', 'Localization (Dubbing & Subtitling)']] },
  ]},
  { code: '7500', title: 'Revenue', tier: 'OTHER', sortOrder: 7, color: '#16a34a', accounts: [
    { code: '7510', title: 'Sales & Licensing', lines: [['7511', 'Domestic Theatrical Box Office Revenue'], ['7512', 'International Territory Sales (MGs / Advances)'], ['7513', 'SVOD / AVOD Streaming Licensing'], ['7514', 'Airline / Non-Theatrical Sales'], ['7515', 'Product Placement & Brand Integration']] },
  ]},
  { code: '8000', title: 'Cost of Goods Sold', tier: 'OTHER', sortOrder: 8, color: '#9333ea', accounts: [
    { code: '8100', title: 'Cost of Goods Sold', lines: [['8101', 'Amortization of Production Cost'], ['8102', 'Residuals & Guild Participations'], ['8103', 'Talent Profit Participations (Back-end)'], ['8104', 'Sales Agent Fees / Distribution Commissions']] },
  ]},
  { code: '9000', title: 'Corporate Overhead', tier: 'OTHER', sortOrder: 9, color: '#64748b', accounts: [
    { code: '9100', title: 'Corporate SG&A', lines: [['9101', 'Executive Salaries'], ['9102', 'Studio / Corporate Office Rent'], ['9103', 'General & Administrative Expenses']] },
  ]},
];

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService, private fx: FxService) {}

  private async nextNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.prisma.documentSequence.upsert({
      where: { prefix: 'PRD' },
      update: { lastNumber: { increment: 1 } },
      create: { prefix: 'PRD', lastNumber: 1, year },
    });
    return `PRD-${year}-${String(seq.lastNumber).padStart(4, '0')}`;
  }

  async findAll(query: any) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.clientId) where.clientId = query.clientId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { projectNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const projects = await this.prisma.productionProject.findMany({
      where,
      include: {
        client: { select: { id: true, companyName: true } },
        budgetVersions: { where: { isActive: true }, select: { id: true, versionName: true, status: true } },
        _count: { select: { crew: true, schedules: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { items: projects, total: projects.length };
  }

  async findOne(id: string) {
    const project = await this.prisma.productionProject.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, companyName: true, tradeName: true } },
        budgetVersions: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, versionName: true, status: true, isActive: true, createdAt: true },
        },
        crew: { orderBy: { role: 'asc' } },
        schedules: { orderBy: { dayNumber: 'asc' } },
      },
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async create(data: {
    title: string;
    clientId?: string;
    projectType?: string;
    currency?: string;
    status?: ProductionStatus;
    startDate?: string;
    endDate?: string;
    shootStartDate?: string;
    shootEndDate?: string;
    description?: string;
    notes?: string;
    includeDistribution?: boolean; // seed the optional 6000–9000 P&A/Revenue/COGS/Corporate ledger
    productionCountryId?: string; // filming country (GeoNode) — drives tax rules, incentives, AI context
  }) {
    // Filming country: drives jurisdiction tax + rebate resolution. Falls back to
    // UAE when not supplied so existing API callers and imports keep working.
    let countryId = data.productionCountryId || null;
    if (countryId) {
      const node = await this.prisma.geoNode.findUnique({ where: { id: countryId } });
      if (!node) throw new BadRequestException('Unknown filming country (GeoNode not found).');
    } else {
      const uae = await this.prisma.geoNode.findFirst({ where: { level: 'COUNTRY', OR: [{ code: 'AE' }, { name: 'United Arab Emirates' }] } });
      countryId = uae?.id || null;
    }

    const projectNumber = await this.nextNumber();
    const project = await this.prisma.productionProject.create({
      data: {
        projectNumber,
        title: data.title,
        clientId: data.clientId || null,
        projectType: data.projectType || 'TVC',
        currency: (data.currency as any) || 'AED',
        status: data.status || 'DEVELOPMENT',
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        shootStartDate: data.shootStartDate ? new Date(data.shootStartDate) : null,
        shootEndDate: data.shootEndDate ? new Date(data.shootEndDate) : null,
        description: data.description,
        notes: data.notes,
        productionCountryId: countryId,
      },
    });

    // Auto-create initial budget version with default sections
    await this.createDefaultBudget(project.id, data.includeDistribution === true);

    return project;
  }

  /**
   * Convert ALL money in a project from its current currency to another by a factor
   * (1 current = factor target). Touches budget, transactions, per-diems, POs,
   * timecards, locations, incentives and crew rates, and sets the project currency.
   */
  async convertCurrency(projectId: string, toCurrency: string, factor: number) {
    const valid = ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'CAD'];
    const f = Number(factor);
    if (!valid.includes(toCurrency)) throw new BadRequestException('Unsupported target currency.');
    if (!isFinite(f) || f <= 0) throw new BadRequestException('Enter a valid conversion rate (> 0).');
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException();
    const r2 = (n: any) => Math.round((Number(n) || 0) * f * 100) / 100;
    const C = toCurrency as any;

    const versions = await this.prisma.budgetVersion.findMany({ where: { projectId }, select: { id: true } });
    const versionIds = versions.map((v) => v.id);

    const lines = await this.prisma.budgetLineItem.findMany({ where: { account: { section: { budgetVersionId: { in: versionIds } } } } });
    for (const li of lines) {
      let stages: any = li.stages;
      if (Array.isArray(stages)) stages = stages.map((s: any) => ({ ...s, rate: r2(s.rate), amount: r2(s.amount) }));
      await this.prisma.budgetLineItem.update({ where: { id: li.id }, data: { rate: r2(li.rate), subtotal: r2(li.subtotal), fringeAmount: r2(li.fringeAmount), total: r2(li.total), currency: C, ...(Array.isArray(stages) ? { stages } : {}) } });
    }
    const accts = await this.prisma.budgetAccount.findMany({ where: { section: { budgetVersionId: { in: versionIds } }, etcAmount: { not: null } } });
    for (const a of accts) await this.prisma.budgetAccount.update({ where: { id: a.id }, data: { etcAmount: r2(a.etcAmount) } });

    const txns = await this.prisma.projectTransaction.findMany({ where: { projectId } });
    for (const t of txns) await this.prisma.projectTransaction.update({ where: { id: t.id }, data: { amount: r2(t.amount), taxAmount: r2(t.taxAmount), total: r2(t.total), paidAmount: t.paidAmount != null ? r2(t.paidAmount) : null, currency: C } });

    const pds = await this.prisma.perDiem.findMany({ where: { projectId } });
    for (const p of pds) await this.prisma.perDiem.update({ where: { id: p.id }, data: { ratePerDay: r2(p.ratePerDay), total: r2(p.total), currency: C } });

    const pos = await this.prisma.purchaseOrder.findMany({ where: { projectId } });
    for (const po of pos) await this.prisma.purchaseOrder.update({ where: { id: po.id }, data: { amount: r2(po.amount), taxAmount: r2(po.taxAmount), total: r2(po.total), invoicedAmount: r2(po.invoicedAmount), currency: C } });

    const tcs = await this.prisma.timecard.findMany({ where: { projectId } });
    for (const tc of tcs) await this.prisma.timecard.update({ where: { id: tc.id }, data: { dailyRate: r2(tc.dailyRate), otRate: r2(tc.otRate), boxRental: r2(tc.boxRental), kitRental: r2(tc.kitRental), perDiemRate: r2(tc.perDiemRate), gross: r2(tc.gross), fringe: r2(tc.fringe), total: r2(tc.total), currency: toCurrency } });

    const locs = await this.prisma.location.findMany({ where: { projectId, locationFeePerDay: { not: null } } });
    for (const l of locs) await this.prisma.location.update({ where: { id: l.id }, data: { locationFeePerDay: r2(l.locationFeePerDay), currency: toCurrency } });

    const incs = await this.prisma.projectIncentive.findMany({ where: { projectId } });
    for (const i of incs) await this.prisma.projectIncentive.update({ where: { id: i.id }, data: { capAmount: i.capAmount != null ? r2(i.capAmount) : null, minSpend: i.minSpend != null ? r2(i.minSpend) : null, qualifiedSpendOverride: i.qualifiedSpendOverride != null ? r2(i.qualifiedSpendOverride) : null, currency: toCurrency } });
    const claims = await this.prisma.incentiveClaim.findMany({ where: { projectId } });
    for (const c of claims) await this.prisma.incentiveClaim.update({ where: { id: c.id }, data: { adqpe: c.adqpe != null ? r2(c.adqpe) : null, capAmount: c.capAmount != null ? r2(c.capAmount) : null, estimatedRebate: c.estimatedRebate != null ? r2(c.estimatedRebate) : null, currency: toCurrency } });

    const crew = await this.prisma.productionCrew.findMany({ where: { projectId } });
    for (const cw of crew) await this.prisma.productionCrew.update({ where: { id: cw.id }, data: { dailyRate: cw.dailyRate != null ? r2(cw.dailyRate) : null, weeklyRate: cw.weeklyRate != null ? r2(cw.weeklyRate) : null } });

    await this.prisma.productionProject.update({ where: { id: projectId }, data: { totalBudget: project.totalBudget != null ? r2(project.totalBudget) : null, currency: C } });

    return { converted: true, from: project.currency, to: toCurrency, factor: f, budgetLines: lines.length, transactions: txns.length };
  }

  /**
   * Guided workflow status — the standard production order with auto-detected
   * completion, so the Overview can show 'what to do next' and flag skipped steps.
   */
  async workflow(projectId: string) {
    const project = await this.prisma.productionProject.findUnique({
      where: { id: projectId }, select: { id: true, currency: true, status: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    const active = await this.prisma.budgetVersion.findFirst({
      where: { projectId, isActive: true }, select: { id: true, status: true },
    });
    const lineWhere = (extra: any = {}) => ({ account: { section: { budgetVersionId: active?.id || '__none__' } }, ...extra });
    const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [laborCfg, strips, scheduled, lineItems, fringed, incentives, pos, txns, openPay, period] = await Promise.all([
      this.prisma.projectLaborConfig.findUnique({ where: { projectId }, select: { snapshotAt: true } }),
      this.prisma.productionStrip.count({ where: { projectId } }),
      this.prisma.productionStrip.count({ where: { projectId, shootDay: { gt: 0 } } }),
      active ? this.prisma.budgetLineItem.count({ where: lineWhere() }) : Promise.resolve(0),
      active ? this.prisma.budgetLineItem.count({ where: lineWhere({ fringeAmount: { gt: 0 } }) }) : Promise.resolve(0),
      this.prisma.projectIncentive.count({ where: { projectId } }),
      this.prisma.purchaseOrder.count({ where: { projectId } }),
      this.prisma.projectTransaction.count({ where: { projectId } }),
      this.prisma.projectTransaction.findMany({ where: { projectId, kind: 'COST', status: 'APPROVED' }, select: { total: true, paidAmount: true } }),
      this.prisma.accountingPeriod.findUnique({ where: { projectId_period: { projectId, period: month } } }),
    ]);
    const openPayables = openPay.reduce((sum, t) => sum + (Number(t.total) - Number(t.paidAmount || 0)), 0);

    const d: Record<string, boolean> = {
      currency: !!project.currency,
      labor: !!laborCfg?.snapshotAt,
      breakdown: strips > 0,
      schedule: scheduled > 0,
      budget: lineItems > 0,
      fringes: fringed > 0,
      incentives: incentives > 0,
      locked: active?.status === 'LOCKED',
      production: pos > 0 || txns > 0,
    };

    const defs: { key: string; label: string; tab: string; prereq?: string; hint?: string }[] = [
      { key: 'currency', label: 'Set base currency', tab: 'overview', hint: `Currency: ${project.currency}` },
      { key: 'labor', label: 'Configure labor & freeze fringe snapshot', tab: 'labor' },
      { key: 'breakdown', label: 'Break down the script (scenes + elements)', tab: 'schedule' },
      { key: 'schedule', label: 'Schedule scenes → Day Out of Days', tab: 'schedule', prereq: 'breakdown' },
      { key: 'budget', label: 'Build the budget', tab: 'budget' },
      { key: 'fringes', label: 'Apply fringes (burdened budget)', tab: 'fringe', prereq: 'labor' },
      { key: 'incentives', label: 'Estimate incentives → net cost', tab: 'incentives', prereq: 'budget' },
      { key: 'locked', label: 'Lock the approved budget', tab: 'budget', prereq: 'budget' },
      { key: 'production', label: 'Run production (POs, cost report, cash)', tab: 'costreport', prereq: 'locked' },
    ];

    let next: string | null = null;
    const steps = defs.map((s) => {
      const done = !!d[s.key];
      const available = !s.prereq || !!d[s.prereq];
      if (!done && available && !next) next = s.key;
      return { ...s, done, available, blockedBy: available ? null : s.prereq };
    });
    return {
      steps, completed: steps.filter((s) => s.done).length, total: steps.length, next, stage: project.status,
      accounting: {
        currency: project.currency,
        openPayables: Math.round(openPayables * 100) / 100,
        openCount: openPay.length,
        currentPeriod: month,
        periodClosed: period?.status === 'CLOSED',
      },
    };
  }

  // ── Per-project authorization (V1.2 — doc system/05 §2) ─────────────────────────
  listPermissionTemplates() {
    return this.prisma.permissionTemplate.findMany({ orderBy: { name: 'asc' } });
  }

  /** All role assignments for a project (with user + template). */
  async projectTeam(projectId: string) {
    await this.findOne(projectId);
    return this.prisma.projectRoleAssignment.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
        template: { select: { key: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Assign (or re-assign) a user a per-project role. One role per user per project.
   * The cost question is captured here: COMPANY_OVERHEAD (access only, borne by the
   * company/HR — not payable on this project) vs PROJECT_HIRE (cost charged to a budget
   * line + rate → payable through the crew pipeline). The decision is mirrored onto a
   * ProductionCrew record so the person has a crew detail page where a Producer/LP can
   * later flip the treatment.
   */
  async assignProjectRole(projectId: string, data: { userId: string; templateId: string; notes?: string; costTreatment?: string; coaCode?: string; coaTitle?: string; roleTitle?: string; dailyRate?: number }) {
    await this.findOne(projectId);
    if (!data.userId || !data.templateId) throw new BadRequestException('userId and templateId are required.');
    const u = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!u || !u.isActive) throw new BadRequestException('Active parent user required.');
    const treatment = data.costTreatment === 'PROJECT_HIRE' ? 'PROJECT_HIRE' : 'COMPANY_OVERHEAD';
    if (treatment === 'PROJECT_HIRE' && !data.coaCode) throw new BadRequestException('A project hire needs a budget line (Master CoA account) to charge to.');

    const assignment = await this.prisma.projectRoleAssignment.upsert({
      where: { projectId_userId: { projectId, userId: data.userId } },
      update: { templateId: data.templateId, notes: data.notes || null, costTreatment: treatment },
      create: { projectId, userId: data.userId, templateId: data.templateId, notes: data.notes || null, costTreatment: treatment },
      include: { user: { select: { id: true, fullName: true, email: true } }, template: { select: { key: true, name: true } } },
    });

    // Mirror onto a ProductionCrew record (one per user per project).
    const existingCrew = await this.prisma.productionCrew.findFirst({ where: { projectId, userId: data.userId } });
    const crewData: any = {
      name: u.fullName, email: u.email, userId: u.id, isInternal: true, costTreatment: treatment,
      roleTitle: treatment === 'PROJECT_HIRE' ? (data.coaTitle || data.roleTitle || existingCrew?.roleTitle || null) : (existingCrew?.roleTitle || null),
      notes: treatment === 'PROJECT_HIRE' && data.coaCode ? `Charge to ${data.coaCode}${data.coaTitle ? ' · ' + data.coaTitle : ''}` : (existingCrew?.notes || null),
    };
    if (treatment === 'PROJECT_HIRE' && data.dailyRate != null) crewData.dailyRate = Number(data.dailyRate);
    if (existingCrew) await this.prisma.productionCrew.update({ where: { id: existingCrew.id }, data: crewData });
    else await this.prisma.productionCrew.create({ data: { projectId, ...crewData } });

    return assignment;
  }

  async removeProjectRole(projectId: string, userId: string) {
    await this.prisma.projectRoleAssignment.deleteMany({ where: { projectId, userId } });
    return { ok: true };
  }

  /**
   * Effective per-project authority for a user: the assigned template's permissions
   * + field-level hide list. Returns null if the user has no role on this project
   * (callers fall back to the global RBAC gate). This is the LAYER, not a replacement.
   */
  async projectAuthority(projectId: string, userId: string) {
    if (!userId) return null;
    const a = await this.prisma.projectRoleAssignment.findUnique({
      where: { projectId_userId: { projectId, userId } },
      include: { template: true },
    });
    if (!a) return null;
    return {
      templateKey: a.template.key,
      templateName: a.template.name,
      permissions: a.template.permissions as any,
      hiddenFields: (a.template.fieldLevelAccess as any) || [],
    };
  }

  // ── Dedicated production bank account (ADFC & co. audit chain) ──────────────────
  /** The project's dedicated account: invoicing detail + reconciliation side + rec status. */
  async projectBank(projectId: string) {
    const [detail, ledger] = await Promise.all([
      this.prisma.bankAccount.findFirst({ where: { projectId } }),
      this.prisma.ledgerBankAccount.findFirst({
        where: { projectId },
        include: { reconciliations: { orderBy: { statementDate: 'desc' }, take: 1 } },
      }),
    ]);
    const lastRec = ledger?.reconciliations?.[0] || null;
    // does any applied incentive demand a dedicated account?
    const applied = await this.prisma.projectIncentive.findMany({ where: { projectId }, select: { programId: true } });
    const programs = applied.length
      ? await this.prisma.incentiveProgram.findMany({ where: { id: { in: applied.map((a) => a.programId).filter(Boolean) as string[] } }, select: { name: true, complianceRules: true } })
      : [];
    const requiring = programs.filter((p) => (p.complianceRules as any)?.dedicatedBankAccount === true).map((p) => p.name);
    return {
      detail, // BankAccount (IBAN/SWIFT… for payments & invoices)
      ledger: ledger ? { id: ledger.id, name: ledger.name, bankName: ledger.bankName, currency: ledger.currency } : null,
      lastReconciliation: lastRec ? { statementDate: lastRec.statementDate, status: lastRec.status, statementBalance: lastRec.statementBalance, clearedBalance: lastRec.clearedBalance } : null,
      requiredByPrograms: requiring, // e.g. ["Abu Dhabi Film Rebate (35%++)"]
      compliant: requiring.length === 0 || (!!detail && !!ledger),
    };
  }

  /** Link/unlink the dedicated account (both halves). Pass null to unlink. */
  async linkProjectBank(projectId: string, data: { bankAccountId?: string | null; ledgerBankAccountId?: string | null }) {
    await this.findOne(projectId);
    if (data.bankAccountId !== undefined) {
      await this.prisma.bankAccount.updateMany({ where: { projectId }, data: { projectId: null } }); // one dedicated account per project
      if (data.bankAccountId) await this.prisma.bankAccount.update({ where: { id: data.bankAccountId }, data: { projectId } });
    }
    if (data.ledgerBankAccountId !== undefined) {
      await this.prisma.ledgerBankAccount.updateMany({ where: { projectId }, data: { projectId: null } });
      if (data.ledgerBankAccountId) await this.prisma.ledgerBankAccount.update({ where: { id: data.ledgerBankAccountId }, data: { projectId } });
    }
    return this.projectBank(projectId);
  }

  /** Bulk archive — batch status change to ARCHIVED (reversible, unlike delete). */
  async bulkArchive(projectIds: string[]) {
    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      throw new BadRequestException('Provide a non-empty array of projectIds.');
    }
    const found = await this.prisma.productionProject.findMany({
      where: { id: { in: projectIds } }, select: { id: true },
    });
    if (!found.length) throw new NotFoundException('None of the provided project IDs exist.');
    const res = await this.prisma.productionProject.updateMany({
      where: { id: { in: found.map((p) => p.id) } },
      data: { status: 'ARCHIVED' },
    });
    return { ok: true, archived: res.count, missing: projectIds.length - found.length };
  }

  /**
   * Delete a project and (via cascade) everything under it. Guarded: projects with a
   * LOCKED budget baseline or posted ledger transactions are protected — they require
   * the explicit force flag, keeping "historical projects never change" the default.
   */
  async remove(id: string, force = false) {
    const project = await this.prisma.productionProject.findUnique({
      where: { id },
      include: {
        budgetVersions: { where: { status: 'LOCKED' }, select: { id: true } },
        _count: { select: { transactions: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (!force && (project.budgetVersions.length > 0 || project._count.transactions > 0)) {
      throw new BadRequestException(
        `"${project.title}" has ${project.budgetVersions.length} locked baseline(s) and ${project._count.transactions} ledger transaction(s). ` +
        'This looks like a historical project — deletion is blocked by default. Pass force=true to delete anyway.',
      );
    }
    await this.prisma.productionProject.delete({ where: { id } });
    return { ok: true, deleted: project.title };
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.productionProject.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.clientId !== undefined && { clientId: data.clientId }),
        ...(data.projectType && { projectType: data.projectType }),
        ...(data.status && { status: data.status }),
        ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
        ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
        ...(data.shootStartDate !== undefined && { shootStartDate: data.shootStartDate ? new Date(data.shootStartDate) : null }),
        ...(data.shootEndDate !== undefined && { shootEndDate: data.shootEndDate ? new Date(data.shootEndDate) : null }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.totalBudget !== undefined && { totalBudget: data.totalBudget }),
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl || null }),
        ...(data.currency !== undefined && { currency: data.currency }),
      },
    });
  }

  /** Seed a fresh project with the standard Film budget structure */
  private async createDefaultBudget(projectId: string, includeDistribution = false) {
    const version = await this.prisma.budgetVersion.create({
      data: {
        projectId,
        versionName: 'Budget v1',
        status: 'DRAFT', // lifecycle: DRAFT → REVIEW (V1..Vn) → APPROVED → LOCKED → WORKING
        isActive: true,
      },
    });

    // Default globals — FX values come from the MASTER FX table (Setup ▸ Currencies & FX),
    // so every new project starts on the company-wide rate. Hardcoded numbers are only a
    // last-resort fallback when the master table is empty.
    const fxRates = await this.fx.rates();
    const fxUsd = Number(fxRates.USD) || 3.6725;
    const fxEur = Number(fxRates.EUR) || 4.0;
    await this.prisma.budgetGlobal.createMany({
      data: [
        { budgetVersionId: version.id, key: 'shoot_days', label: 'Shoot Days', value: 1, unit: 'days' },
        { budgetVersionId: version.id, key: 'prep_days', label: 'Prep Days', value: 1, unit: 'days' },
        { budgetVersionId: version.id, key: 'wrap_days', label: 'Wrap Days', value: 1, unit: 'days' },
        { budgetVersionId: version.id, key: 'prep_weeks', label: 'Prep Weeks', value: 1, unit: 'weeks' },
        { budgetVersionId: version.id, key: 'shoot_weeks', label: 'Shoot Weeks', value: 1, unit: 'weeks' },
        { budgetVersionId: version.id, key: 'crew_count', label: 'Crew Count', value: 10, unit: 'people' },
        { budgetVersionId: version.id, key: 'fx_usd', label: 'USD → AED Rate', value: fxUsd, unit: '' },
        { budgetVersionId: version.id, key: 'fx_eur', label: 'EUR → AED Rate', value: fxEur, unit: '' },
      ],
    });

    // Default fringe profiles
    await this.prisma.fringeProfile.createMany({
      data: [
        { budgetVersionId: version.id, name: 'UAE Crew', percentage: 0, description: 'UAE-based crew, no statutory fringe' },
        { budgetVersionId: version.id, name: 'Freelance', percentage: 0, description: 'Freelance / project-based' },
        { budgetVersionId: version.id, name: 'Expat Package', percentage: 12, description: 'Expat package with housing/benefits' },
      ],
    });

    // ── Master Chart of Accounts: module-level MASTER_COA / DISTRIBUTION_COA (top of file) ──
    await this.seedSections(version.id, MASTER_COA);
    if (includeDistribution) await this.seedSections(version.id, DISTRIBUTION_COA);

    return version;
  }

  /** Insert a COA block (sections → accounts → zero-value line items) into a budget version. */
  private async seedSections(versionId: string, coa: SeedSection[]) {
    for (const sec of coa) {
      const section = await this.prisma.budgetSection.create({
        data: { budgetVersionId: versionId, code: sec.code, title: sec.title, tier: sec.tier, sortOrder: sec.sortOrder, color: sec.color },
      });
      let aOrder = 1;
      for (const acc of sec.accounts) {
        const account = await this.prisma.budgetAccount.create({
          data: { sectionId: section.id, code: acc.code, title: acc.title, sortOrder: aOrder++ },
        });
        if (acc.lines.length) {
          await this.prisma.budgetLineItem.createMany({
            data: acc.lines.map((l, i) => ({
              accountId: account.id, sortOrder: i, code: l[0], description: l[1],
              quantity: 1, rate: 0, units: 'allow', exchangeRate: 1, fringePct: 0,
              classificationCode: l[2] || null,
              subtotal: 0, fringeAmount: 0, total: 0,
            })),
          });
        }
      }
    }
  }

  /**
   * Append the optional 6000–9000 distribution ledger (P&A / Revenue / COGS / Corporate)
   * to an existing project's ACTIVE budget version (the post-creation fallback).
   * Guards: the version must be unlocked and the 6000+ sections must not already exist.
   */
  async injectDistributionLedger(projectId: string) {
    const version = await this.prisma.budgetVersion.findFirst({
      where: { projectId, isActive: true },
      include: { sections: { select: { code: true } } },
    });
    if (!version) throw new NotFoundException('No active budget version on this project.');
    if (version.status === 'LOCKED') {
      throw new BadRequestException('The active budget is locked — create a working copy first, then add the distribution ledger.');
    }
    const existing = new Set(version.sections.map((s) => s.code));
    const dupes = DISTRIBUTION_COA.filter((s) => existing.has(s.code)).map((s) => s.code);
    if (dupes.length) throw new BadRequestException(`Distribution sections already exist on this budget: ${dupes.join(', ')}.`);

    await this.seedSections(version.id, DISTRIBUTION_COA);

    // standard recalculation: roll the version total onto the project
    const fresh = await this.prisma.budgetVersion.findUnique({
      where: { id: version.id },
      include: { sections: { include: { accounts: { include: { lineItems: { select: { total: true } } } } } } },
    });
    let grand = 0;
    for (const s of fresh!.sections) for (const a of s.accounts) for (const i of a.lineItems) grand += Number(i.total);
    await this.prisma.productionProject.update({ where: { id: projectId }, data: { totalBudget: grand } });

    return { injected: true, sections: DISTRIBUTION_COA.map((s) => `${s.code} ${s.title}`) };
  }

  /** Clone a project's setup (budget version + crew) as a new project.
   *  crewScope: 'all' | 'atl' | 'btl' | 'none' */
  async duplicate(id: string, crewScope: string = 'all') {
    const ATL_ROLES = ['DIRECTOR', 'PRODUCER', 'LINE_PRODUCER'];
    const src = await this.prisma.productionProject.findUnique({
      where: { id },
      include: {
        crew: true,
        budgetVersions: {
          where: { isActive: true },
          include: { globals: true, fringes: true, sections: { include: { accounts: { include: { lineItems: true } } } } },
        },
      },
    });
    if (!src) throw new NotFoundException('Project not found');

    const projectNumber = await this.nextNumber();
    const project = await this.prisma.productionProject.create({
      data: {
        projectNumber, title: `${src.title} (Copy)`, clientId: src.clientId,
        projectType: src.projectType, status: 'DEVELOPMENT', currency: src.currency,
        description: src.description, notes: src.notes,
      },
    });

    // Clone active budget version
    const sv = src.budgetVersions[0];
    if (sv) {
      const version = await this.prisma.budgetVersion.create({
        data: { projectId: project.id, versionName: sv.versionName, status: 'WORKING', isActive: true },
      });
      if (sv.globals.length) await this.prisma.budgetGlobal.createMany({ data: sv.globals.map(g => ({ budgetVersionId: version.id, key: g.key, label: g.label, value: g.value, unit: g.unit })) });
      if (sv.fringes.length) await this.prisma.fringeProfile.createMany({ data: sv.fringes.map(f => ({ budgetVersionId: version.id, name: f.name, percentage: f.percentage, description: f.description })) });
      for (const s of sv.sections) {
        const section = await this.prisma.budgetSection.create({ data: { budgetVersionId: version.id, code: s.code, title: s.title, sortOrder: s.sortOrder, color: s.color } });
        for (const a of s.accounts) {
          const account = await this.prisma.budgetAccount.create({ data: { sectionId: section.id, code: a.code, title: a.title, sortOrder: a.sortOrder, etcAmount: a.etcAmount } });
          if (a.lineItems.length) await this.prisma.budgetLineItem.createMany({
            data: a.lineItems.map(i => ({
              accountId: account.id, sortOrder: i.sortOrder, code: i.code, subTitle: i.subTitle, description: i.description,
              quantityFormula: i.quantityFormula, quantity: i.quantity, units: i.units, rate: i.rate, currency: i.currency,
              exchangeRate: i.exchangeRate, fringePct: i.fringePct, subtotal: i.subtotal, fringeAmount: i.fringeAmount, total: i.total, notes: i.notes,
            })),
          });
        }
      }
      await this.updateTotalFromVersion(version.id, project.id);
    }

    // Clone crew assignments per chosen personnel scope
    let crewToClone = src.crew;
    if (crewScope === 'none') crewToClone = [];
    else if (crewScope === 'atl') crewToClone = src.crew.filter(c => ATL_ROLES.includes(c.role));
    else if (crewScope === 'btl') crewToClone = src.crew.filter(c => !ATL_ROLES.includes(c.role));
    for (const c of crewToClone) {
      await this.prisma.productionCrew.create({
        data: {
          projectId: project.id, crewMemberId: c.crewMemberId, name: c.name, role: c.role, isInternal: c.isInternal,
          email: c.email, mobile: c.mobile, location: c.location, dailyRate: c.dailyRate, weeklyRate: c.weeklyRate,
          totalDays: c.totalDays, dealMemoStatus: 'NOT_SENT', ndaStatus: c.ndaStatus, notes: c.notes,
        },
      });
    }
    return project;
  }

  private async updateTotalFromVersion(versionId: string, projectId: string) {
    const v = await this.prisma.budgetVersion.findUnique({ where: { id: versionId }, include: { sections: { include: { accounts: { include: { lineItems: { select: { total: true } } } } } } } });
    let grand = 0;
    for (const s of v!.sections) for (const a of s.accounts) for (const i of a.lineItems) grand += Number(i.total);
    await this.prisma.productionProject.update({ where: { id: projectId }, data: { totalBudget: grand } });
  }

  async getDashboard(role?: string) {
    const [total, byStatus, recent] = await Promise.all([
      this.prisma.productionProject.count(),
      this.prisma.productionProject.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.productionProject.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        include: { client: { select: { companyName: true } } },
      }),
    ]);
    const base: any = { total, byStatus, recent, role: role || null };
    if (this.isFinanceRole(role)) return { ...base, view: 'finance', finance: await this.financeWidget() };
    if (this.isCoordRole(role)) return { ...base, view: 'coordination', coordination: await this.coordinationWidget() };
    return { ...base, view: 'general' };
  }

  private isFinanceRole(role?: string) {
    return ['LINE_PRODUCER', 'PRODUCER', 'EXECUTIVE_PRODUCER', 'FINANCE_MANAGER', 'FINANCE'].includes((role || '').toUpperCase());
  }
  private isCoordRole(role?: string) {
    return ['ASSISTANT_DIRECTOR', 'SECOND_AD', '2ND_AD', 'PRODUCTION_COORDINATOR', 'PRODUCTION_ASSISTANT', 'COORDINATOR'].includes((role || '').toUpperCase());
  }

  // ── Line Producer / Finance Manager view: EFC variance + pending transfers ────────
  private async financeWidget() {
    const projects = await this.prisma.productionProject.findMany({
      where: { status: { notIn: ['ARCHIVED', 'CANCELLED'] } },
      select: {
        id: true, title: true, projectNumber: true, currency: true,
        budgetVersions: { where: { isActive: true }, select: { sections: { select: { accounts: { select: { etcAmount: true, lineItems: { select: { total: true } } } } } } } },
      },
    });

    const rows: any[] = [];
    const totals = { budget: 0, actual: 0, committed: 0, efc: 0, variance: 0 };
    for (const p of projects) {
      const v = p.budgetVersions[0];
      if (!v) continue;
      let budget = 0, etcOverride = 0; let hasEtc = false;
      for (const s of v.sections) for (const a of s.accounts) {
        budget += a.lineItems.reduce((x, i) => x + Number(i.total), 0);
        if (a.etcAmount != null) { etcOverride += Number(a.etcAmount); hasEtc = true; }
      }
      const [costAgg, openPos] = await Promise.all([
        this.prisma.projectTransaction.aggregate({ where: { projectId: p.id, kind: 'COST', status: { in: ['APPROVED', 'PAID'] } }, _sum: { total: true } }),
        this.prisma.purchaseOrder.findMany({ where: { projectId: p.id, status: { in: ['APPROVED', 'PARTIALLY_INVOICED'] } }, select: { total: true, invoicedAmount: true } }),
      ]);
      const actual = Number(costAgg._sum.total || 0);
      const committed = openPos.reduce((x, o) => x + (Number(o.total) - Number(o.invoicedAmount)), 0);
      const etc = hasEtc ? etcOverride : committed;       // manual ETC override, else remaining commitments
      const efc = actual + etc;
      const variance = budget - efc;
      rows.push({ id: p.id, title: p.title, projectNumber: p.projectNumber, currency: p.currency, budget, actual, committed, efc, variance, overBudget: variance < -0.01 });
      totals.budget += budget; totals.actual += actual; totals.committed += committed; totals.efc += efc; totals.variance += variance;
    }
    rows.sort((a, b) => a.variance - b.variance); // worst (most over) first

    const pendingTransfers = await this.prisma.budgetTransfer.findMany({
      where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' },
      include: { project: { select: { title: true, projectNumber: true } } },
    });

    return { totals, projects: rows, pendingTransfers, pendingTransferCount: pendingTransfers.length };
  }

  // ── 2nd AD / Coordinator view: unsigned paperwork + latest call sheet ─────────────
  private async coordinationWidget() {
    const unsigned = await this.prisma.productionCrew.findMany({
      where: {
        OR: [{ dealMemoStatus: { in: ['NOT_SENT', 'SENT'] } }, { ndaStatus: 'SENT' }],
        project: { status: { notIn: ['ARCHIVED', 'CANCELLED', 'DELIVERED'] } },
      },
      select: {
        id: true, name: true, role: true, department: true, roleTitle: true, dealMemoStatus: true, ndaStatus: true,
        project: { select: { id: true, title: true, projectNumber: true } },
      },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
    const counts = { dealMemoNotSent: 0, dealMemoSent: 0, ndaUnsigned: 0 };
    for (const c of unsigned) {
      if (c.dealMemoStatus === 'NOT_SENT') counts.dealMemoNotSent++;
      else if (c.dealMemoStatus === 'SENT') counts.dealMemoSent++;
      if (c.ndaStatus === 'SENT') counts.ndaUnsigned++;
    }

    const latest = await this.prisma.callSheet.findFirst({
      where: { project: { status: { notIn: ['ARCHIVED', 'CANCELLED'] } } },
      orderBy: [{ shootDate: 'desc' }],
      select: {
        id: true, dayNumber: true, totalDays: true, shootDate: true, status: true,
        locationName: true, crewCalls: true, castCalls: true, backgroundCalls: true,
        project: { select: { title: true, projectNumber: true } },
      },
    });
    let callSheet: any = null;
    if (latest) {
      const len = (j: any) => (Array.isArray(j) ? j.length : 0);
      callSheet = {
        id: latest.id, project: latest.project, dayNumber: latest.dayNumber, totalDays: latest.totalDays,
        shootDate: latest.shootDate, status: latest.status, location: latest.locationName,
        crewCount: len(latest.crewCalls), castCount: len(latest.castCalls), backgroundCount: len(latest.backgroundCalls),
        published: latest.status === 'PUBLISHED',
      };
    }
    return { unsigned, counts, unsignedCount: unsigned.length, callSheet };
  }
}
