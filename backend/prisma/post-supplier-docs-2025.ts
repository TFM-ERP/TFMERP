/**
 * post-supplier-docs-2025.ts
 *
 * Puts the Heartland, Dhabi One and Shory documents Qais supplied on 21 Sep 2026
 * into the ledger, settles the card and cash payments that paid them, moves the
 * caravan and trailer upgrades to the balance sheet, and attaches every source
 * document to its expense record.
 *
 * DECISIONS (General Manager, 21 Sep 2026)
 *   - Dhabi One DOIT011025-7: the stamped paper copy for 7,000.00 is the real one.
 *     It matches card payment 941513. The 7,450.00 PDF with the same number
 *     matches no payment; it is kept only as supporting evidence.
 *   - Solar panels, batteries and ACs went into the company's caravans and
 *     trailers. They are fleet upgrades: 1500 Rental Fleet & Equipment, not cost.
 *     Awning, fibreglass, shower and wiring work stays in repairs.
 *   - Shory 1,039.50 insured a company vehicle. It is a company cost. The invoice
 *     is in Qais's personal name, so no input VAT is claimed.
 *   - Heartland 2,898.00 (filed-2025-2026-0142, 20 Jan) is a DIFFERENT job from
 *     Toilet Trailer 1 (2,803.50, 19 Jan). Toilet Trailer 1 is added; 0142 is
 *     left exactly as filed and still unpaid.
 *   - Formula Tyres 9,990.00 (22 Dec 2025): tyres, balancing and alignment for the
 *     trailers and two pickup trucks. Already in the ledger as filed; repairs, stays
 *     in 5200. Only the card payment is added.
 *   - Five AC units in total for the caravans: four from Dhabi One, the fifth
 *     with installation from Abdullah S, Sharjah (3,500.00 + 5,600.00 by card, no
 *     invoice held). All capitalised to 1500.
 *   - Heartland 6,247.50 of 4 Aug 2025 (Freedom Express awning) was paid in cash.
 *
 * WHAT IS ALREADY IN THE LEDGER
 *   Dhabi One and five Heartland rows came in from the VAT returns as filed.
 *   Those rows are not recreated; they are corrected or reclassified by separate
 *   journals so the filed figure is still visible in the history.
 *
 * VAT
 *   Heartland's documents show 5% VAT but no TRN and no invoice number, and none
 *   is titled "Tax Invoice". New Heartland rows are therefore booked GROSS. The
 *   VAT already claimed on the filed Heartland rows is NOT touched here; that is
 *   a question for the tax adviser and is listed in the project notes.
 *   Dhabi One VAT on DOIT011025-7 falls from 354.76 (as filed) to 333.33; the
 *   21.43 difference goes on the VAT correction list.
 *
 * DEPRECIATION is left to the fixed asset register, as for the Chevrolet van.
 *
 * Idempotent: refuses to run twice (tag [SUPDOC2025]). Pass --dry for the plan.
 *
 *   npx ts-node --transpile-only prisma/post-supplier-docs-2025.ts --dry
 *   npx ts-node --transpile-only prisma/post-supplier-docs-2025.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { copyFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, extname } from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[SUPDOC2025]';

const DOCS_DIR =
  '/Users/qandil/Library/CloudStorage/OneDrive-Personal/Desktop/Commercials/TFM/2025/Supplier invoices';
const UPLOADS_DIR = join(__dirname, '..', 'uploads');

/* ------------------------------------------------------------------ types */

interface Line {
  code: string;
  debit?: number;
  credit?: number;
  description: string;
}

interface Journal {
  date: string;
  memo: string;
  lines: Line[];
  sourceType?: string;
  sourceKey?: string; // key into newExpenseIds, resolved at apply time
}

interface NewExpense {
  key: string;
  supplierName: string;
  vendorName: string;
  date: string;
  paidAt: string;
  category: string;
  description: string;
  total: number;
  invoiceNumber: string | null;
  supplierVatId: string | null;
  notes: string;
  debitCode: string;
}

interface Attach {
  expense: string; // an existing expenseNumber, or a NewExpense key prefixed "new:"
  file: string;
  name: string;
  kind: 'SOURCE' | 'SUPPORTING';
  notes: string;
}

/* ---------------------------------------------------------------- helpers */

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const r2 = (n: number): number => Math.round(n * 100) / 100;

function balanced(j: Journal): boolean {
  const d = j.lines.reduce((t, l) => t + (l.debit ?? 0), 0);
  const c = j.lines.reduce((t, l) => t + (l.credit ?? 0), 0);
  return Math.abs(d - c) < 0.005;
}

async function nextNumber(tx: Prisma.TransactionClient, issued: Set<string>): Promise<string> {
  const prefix = `JE-${new Date().getFullYear()}-`;
  const last = await tx.journalEntry.findMany({
    where: { entryNumber: { startsWith: prefix } },
    select: { entryNumber: true },
    orderBy: { entryNumber: 'desc' },
    take: 1,
  });
  let n = last.length > 0 ? parseInt(last[0].entryNumber.slice(-4), 10) : 0;
  let candidate = '';
  do {
    n += 1;
    candidate = `${prefix}${String(n).padStart(4, '0')}`;
  } while (issued.has(candidate));
  issued.add(candidate);
  return candidate;
}

/* ------------------------------------------------------------------- data */

/** Filed rows that are corrected in place. `expect` guards against a changed row. */
const UPDATES: {
  expenseNumber: string;
  expect: number;
  set: Prisma.ExpenseUpdateInput;
  note: string;
}[] = [
  {
    expenseNumber: 'filed-2025-2026-0077',
    expect: 7450,
    set: {
      amount: 6666.67,
      vatAmount: 333.33,
      totalAmount: 7000,
      invoiceNumber: 'DOIT011025-7',
      paidAt: day('2025-10-01'),
    },
    note:
      'Corrected from 7,450.00 (7,095.24 + 354.76, as filed in 2025-Q4) to the stamped ' +
      'paper tax invoice DOIT011025-7 for 7,000.00 (6,666.67 + 333.33): 1 x LG 1-ton ' +
      'I12CGH + 2 x LG 2-ton I27TCP split ACs, fitted to company caravans. Paid by card ' +
      '3825, 01/10/2025, approval 941513, 7,000.00. The 7,450.00 PDF carrying the same ' +
      'number matches no payment. Input VAT over-claimed in Q4 by 21.43. Capitalised to ' +
      '1500.',
  },
  {
    expenseNumber: 'filed-2025-2026-0080',
    expect: 2750,
    set: { invoiceNumber: 'DOIT031125-1', paidAt: day('2025-11-03') },
    note:
      'Tax invoice DOIT031125-1: 1 x LG 2-ton I27TCP split AC, fitted to a company ' +
      'caravan. Paid by card 3825, 03/11/2025, approval 985268. Capitalised to 1500.',
  },
  {
    expenseNumber: 'filed-2025-2026-0141',
    expect: 2882.25,
    set: { paidAt: day('2025-04-06') },
    note:
      'Heartland Emirates RV job dated 2 Feb 2025, Freedom Express 287BHDS: 2 x 180W ' +
      'solar panels + 200A battery + Go Power 30A controller 2,650.00 (capitalised to ' +
      '1500); 7-way adapter 95.00 (repair, stays in cost). Document has no TRN and no ' +
      'invoice number. Paid inside card 3825, 06/04/2025, approval 5096BES4, 8,410.00.',
  },
  {
    expenseNumber: 'filed-2025-2026-0144',
    expect: 2724.75,
    set: { paidAt: day('2025-04-06') },
    note:
      'Heartland Emirates RV job dated 2 Feb 2025, Toilet Trailer 2: solar panels, 200A ' +
      'battery, controller, bracket, switch, shore inlet, lock belt. All 2,595.00 net ' +
      'capitalised to 1500. Document has no TRN and no invoice number. Paid inside card ' +
      '3825, 06/04/2025, approval 5096BES4, 8,410.00.',
  },
  {
    expenseNumber: 'filed-2025-2026-0145',
    expect: 682.5,
    set: { paidAt: day('2025-01-05') },
    note:
      'Card 3825, 05/01/2025, approval 006105, paid 650.00 against this row of 682.50; ' +
      '32.50 left open. No Heartland document for 650.00 has been found. Row ' +
      'filed-2025-2026-0148 (21 Jan, same 650.00 + 32.50) has no matching payment and ' +
      'may be a duplicate in the filed return.',
  },
  {
    expenseNumber: 'filed-2025-2026-0086',
    expect: 9990,
    set: { paidAt: day('2025-12-22') },
    note:
      'Formula Tyres, Dubai: tyres with wheel balancing and alignment for the company ' +
      'trailers and the two pickup trucks (GM, 21 Sep 2026). Repairs and maintenance, not ' +
      'capital. Paid by card 2528, 22/12/2025, approval 596746, 9,990.00. The supplier ' +
      'invoice is not held; the invoice number on this row repeats across unrelated vendors.',
  },
];

/** Documents with no row in the ledger yet. Booked gross: none is a valid tax invoice. */
const NEW_EXPENSES: NewExpense[] = [
  {
    key: 'toilet1',
    supplierName: 'Heartland',
    vendorName: 'Heartland Emirates Recreational Vehicles',
    date: '2025-01-19',
    paidAt: '2025-04-06',
    category: 'Fleet equipment (capitalised)',
    description: 'Toilet Trailer 1 — solar panels, 200A battery, controller, fittings, tongue jack',
    total: 2803.5,
    invoiceNumber: null,
    supplierVatId: null,
    debitCode: '1500',
    notes:
      `${TAG} Heartland Emirates RV, Hameem Rd, Abu Dhabi. Job received 12 Jan, invoiced ` +
      '19 Jan 2025, Toilet Trailer 1: 2 solar panels + 200A battery + solar control 1,900.00; ' +
      'battery bracket, junction box, 12V jack connection 290.00; battery switch 200.00; ' +
      '32A shore inlet 55.00; battery belt and lock 150.00; front tongue jack 75.00. Net ' +
      '2,670.00 + VAT 133.50 = 2,803.50. Booked GROSS to 1500: the document has no TRN and ' +
      'no invoice number, so the VAT is not claimed. A different job from ' +
      'filed-2025-2026-0142 (GM, 21 Sep 2026). Paid inside card 3825, 06/04/2025, approval ' +
      '5096BES4, 8,410.00.',
  },
  {
    key: 'awning',
    supplierName: 'Heartland',
    vendorName: 'Heartland Emirates Recreational Vehicles',
    date: '2025-08-04',
    paidAt: '2025-08-04',
    category: 'Maintenance',
    description: 'Freedom Express — awning arms, awning fabric, fibreglass wall repair, exterior shower',
    total: 6247.5,
    invoiceNumber: null,
    supplierVatId: null,
    debitCode: '5200',
    notes:
      `${TAG} Heartland Emirates RV, job received 23 Jul, invoiced 4 Aug 2025, Freedom ` +
      'Express: 2 awning arms 3,600.00; awning fabric repair 290.00; fibreglass wall repair ' +
      '1,750.00; exterior shower set 310.00. Net 5,950.00 + VAT 297.50 = 6,247.50. Repairs, ' +
      'not an upgrade. PAID IN CASH (GM, 21 Sep 2026) — no matching ADCB debit. Booked GROSS: ' +
      'no TRN or invoice number on the document; a proper tax invoice would release 297.50.',
  },
  {
    key: 'shory',
    supplierName: 'Shory Insurance Brokers LLC',
    vendorName: 'Shory Insurance Brokers LLC',
    date: '2025-07-20',
    paidAt: '2025-07-20',
    category: 'Insurance',
    description: 'Third-party motor insurance, AWNIC policy 20/9017/90/2025/17441 — company vehicle',
    total: 1039.5,
    invoiceNumber: 'INV-MO-CI-200725-F59066',
    supplierVatId: '100442732200003',
    debitCode: '6400',
    notes:
      `${TAG} Shory Insurance Brokers LLC (TRN 100442732200003) for Al Wathba National ` +
      'Insurance (TRN 100061180400003). Third-party policy 20/9017/90/2025/17441 from ' +
      '20/07/2025. Net 990.00 + VAT 49.50 = 1,039.50. For a company vehicle (GM, 21 Sep ' +
      '2026). Booked GROSS: the tax invoice is addressed to QAIS MOHMD ISSA QANDIL, not the ' +
      'company, so the VAT is not claimed. Paid by card 3825, 20/07/2025, approval 144389.',
  },
];

/** Corrections, reclassifications and payments. Expense postings for NEW_EXPENSES are built in main(). */
const JOURNALS: Journal[] = [
  {
    date: '2025-10-01',
    memo:
      `${TAG} Dhabi One DOIT011025-7 corrected to the stamped 7,000.00 tax invoice (filed as ` +
      '7,450.00) and the ACs capitalised as caravan equipment. filed-2025-2026-0077.',
    lines: [
      { code: '1500', debit: 6666.67, description: 'Rental Fleet — 3 LG split ACs for company caravans' },
      { code: '2000', debit: 450, description: 'Payable reduced to the 7,000.00 actually invoiced' },
      { code: '6200', credit: 7095.24, description: 'Reverse cost as filed (7,450.00 version)' },
      { code: '1200', credit: 21.43, description: 'Input VAT 354.76 as filed -> 333.33 per tax invoice' },
    ],
  },
  {
    date: '2025-11-03',
    memo: `${TAG} Dhabi One DOIT031125-1 — LG 2-ton AC capitalised as caravan equipment. filed-2025-2026-0080.`,
    lines: [
      { code: '1500', debit: 2619.05, description: 'Rental Fleet — LG 2-ton split AC for a company caravan' },
      { code: '6200', credit: 2619.05, description: 'Reclassified from Office & Admin' },
    ],
  },
  {
    date: '2025-02-02',
    memo:
      `${TAG} Heartland 2 Feb 2025, Freedom Express solar upgrade capitalised; 7-way adapter ` +
      '95.00 stays in cost. filed-2025-2026-0141.',
    lines: [
      { code: '1500', debit: 2650, description: 'Rental Fleet — Freedom Express solar panels, battery, controller' },
      { code: '6900', credit: 2650, description: 'Reclassified from Other Expenses' },
    ],
  },
  {
    date: '2025-03-31',
    memo: `${TAG} Heartland 2 Feb 2025, Toilet Trailer 2 solar/battery system capitalised. filed-2025-2026-0144.`,
    lines: [
      { code: '1500', debit: 2595, description: 'Rental Fleet — Toilet Trailer 2 solar and battery system' },
      { code: '6900', credit: 2595, description: 'Reclassified from Other Expenses' },
    ],
  },
  {
    date: '2025-01-07',
    memo:
      `[CARD2025][SETTLES filed-2025-2026-0145] ${TAG} PUR 05/01 HEARTLAND ABU DHABI 3825 ` +
      '006105 — 650.00 paid against a payable of 682.50; 32.50 left open.',
    lines: [
      { code: '2000', debit: 650, description: 'Heartland — filed-2025-2026-0145' },
      { code: '1010', credit: 650, description: 'Bank — card 3825, approval 006105' },
    ],
  },
  {
    date: '2025-04-06',
    memo:
      `[CARD2025][SETTLES filed-2025-2026-0141, filed-2025-2026-0144, new:toilet1] ${TAG} PUR ` +
      '06/04 HEARTLAND ABU DHA 3825 5096BES4 — 8,410.00 pays three Heartland jobs totalling ' +
      '8,410.50 (2,882.25 + 2,724.75 + 2,803.50); 0.50 rounded at the till.',
    lines: [
      { code: '2000', debit: 2882.25, description: 'Heartland — Freedom Express, filed-2025-2026-0141' },
      { code: '2000', debit: 2724.75, description: 'Heartland — Toilet Trailer 2, filed-2025-2026-0144' },
      { code: '2000', debit: 2803.5, description: 'Heartland — Toilet Trailer 1' },
      { code: '1010', credit: 8410, description: 'Bank — card 3825, approval 5096BES4' },
      { code: '6900', credit: 0.5, description: 'Rounding allowed by the supplier' },
    ],
  },
  {
    date: '2025-10-03',
    memo: `[CARD2025][SETTLES filed-2025-2026-0077] ${TAG} PUR 01/10 DHABI ONE ABUDHABI 3825 941513`,
    lines: [
      { code: '2000', debit: 7000, description: 'Dhabi One — DOIT011025-7' },
      { code: '1010', credit: 7000, description: 'Bank — card 3825, approval 941513' },
    ],
  },
  {
    date: '2025-11-05',
    memo: `[CARD2025][SETTLES filed-2025-2026-0080] ${TAG} PUR 03/11 DHABI ONE ABUDHABI 3825 985268`,
    lines: [
      { code: '2000', debit: 2750, description: 'Dhabi One — DOIT031125-1' },
      { code: '1010', credit: 2750, description: 'Bank — card 3825, approval 985268' },
    ],
  },
  {
    date: '2025-07-22',
    memo: `[CARD2025][SETTLES new:shory] ${TAG} PUR 20/07 TLR*SHORY ABU DHABI 3825 144389`,
    lines: [
      { code: '2000', debit: 1039.5, description: 'Shory — INV-MO-CI-200725-F59066' },
      { code: '1010', credit: 1039.5, description: 'Bank — card 3825, approval 144389' },
    ],
  },
  {
    date: '2025-08-04',
    memo: `${TAG} Heartland 4 Aug 2025, Freedom Express awning repair — paid in cash (GM, 21 Sep 2026).`,
    lines: [
      { code: '2000', debit: 6247.5, description: 'Heartland — Freedom Express awning repair' },
      { code: '1000', credit: 6247.5, description: 'Cash on Hand — paid in cash' },
    ],
  },
  {
    date: '2025-12-24',
    memo: `[CARD2025][SETTLES filed-2025-2026-0086] ${TAG} PUR 22/12 FORMULA TY DUBAI 2528 596746 — tyres, balancing and alignment for the trailers and two pickups`,
    lines: [
      { code: '2000', debit: 9990, description: 'Formula Tyres — filed-2025-2026-0086' },
      { code: '1010', credit: 9990, description: 'Bank — card 2528, approval 596746' },
    ],
  },
  {
    date: '2025-05-01',
    memo: `[CARD2025] ${TAG} PUR 29/04 ABDULLAH S Sharjah 3825 673693 — first payment for the 5th caravan AC unit and its installation (GM, 21 Sep 2026). No supplier invoice held; booked gross.`,
    lines: [
      { code: '1500', debit: 3500, description: 'Rental Fleet — caravan AC unit + installation (Abdullah S), part 1' },
      { code: '1010', credit: 3500, description: 'Bank — card 3825, approval 673693' },
    ],
  },
  {
    date: '2025-07-18',
    memo: `[CARD2025] ${TAG} PUR 16/07 ABDULLAH S Sharjah 3825 918767 — second payment for the 5th caravan AC unit and its installation (GM, 21 Sep 2026). No supplier invoice held; booked gross.`,
    lines: [
      { code: '1500', debit: 5600, description: 'Rental Fleet — caravan AC unit + installation (Abdullah S), part 2' },
      { code: '1010', credit: 5600, description: 'Bank — card 3825, approval 918767' },
    ],
  },
];

const ATTACHMENTS: Attach[] = [
  { expense: 'filed-2025-2026-0077', file: 'DhabiOne-DOIT011025-7-stamped-7000.jpg', kind: 'SOURCE', name: 'TAX INVOICE DOIT011025-7 (stamped, 7,000.00) — Dhabi One International Trading', notes: 'The copy that matches card payment 941513.' },
  { expense: 'filed-2025-2026-0077', file: 'DhabiOne-DOIT011025-7-PDF-7450-unmatched.pdf', kind: 'SUPPORTING', name: 'DOIT011025-7 PDF (7,450.00) — does NOT match any payment', notes: 'Same number, different items and total. Kept as evidence only; not the invoice relied on.' },
  { expense: 'filed-2025-2026-0080', file: 'DhabiOne-DOIT031125-1-2750.pdf', kind: 'SOURCE', name: 'TAX INVOICE DOIT031125-1 — Dhabi One International Trading', notes: 'Paid by card 985268.' },
  { expense: 'filed-2025-2026-0141', file: 'Heartland-2025-02-02-FreedomExpress-2882.25.pdf', kind: 'SOURCE', name: 'Heartland invoice 2 Feb 2025 — Freedom Express 287BHDS, 2,882.25', notes: 'No TRN or invoice number on the document.' },
  { expense: 'filed-2025-2026-0141', file: 'Heartland-2025-01-23-FreedomExpress-QUOTE.pdf', kind: 'SUPPORTING', name: 'Heartland quotation 23 Jan 2025 — Freedom Express', notes: 'Quotation for the same work.' },
  { expense: 'filed-2025-2026-0144', file: 'Heartland-2025-02-02-ToiletTrailer2-2724.75.pdf', kind: 'SOURCE', name: 'Heartland invoice 2 Feb 2025 — Toilet Trailer 2, 2,724.75', notes: 'No TRN or invoice number on the document.' },
  { expense: 'filed-2025-2026-0144', file: 'Heartland-2025-01-19-ToiletTrailer-DUPLICATE-2724.75.pdf', kind: 'SUPPORTING', name: 'Heartland 19 Jan 2025 "Toilet Trailer" — duplicate of Toilet Trailer 2', notes: 'Same work and total; not a separate supply. Never book it.' },
  { expense: 'new:toilet1', file: 'Heartland-2025-01-19-ToiletTrailer1-2803.50.pdf', kind: 'SOURCE', name: 'Heartland invoice 19 Jan 2025 — Toilet Trailer 1, 2,803.50', notes: 'No TRN or invoice number on the document.' },
  { expense: 'new:awning', file: 'Heartland-2025-08-04-FreedomExpress-awning-6247.50-CASH.pdf', kind: 'SOURCE', name: 'Heartland invoice 4 Aug 2025 — Freedom Express awning repair, 6,247.50', notes: 'Paid in cash.' },
  { expense: 'new:shory', file: 'Shory-INV-MO-CI-200725-F59066-1039.50.pdf', kind: 'SOURCE', name: 'TAX INVOICE INV-MO-CI-200725-F59066 — Shory Insurance Brokers', notes: 'Addressed to Qais personally, not the company.' },
];

/* ------------------------------------------------------------------- main */

async function main(): Promise<void> {
  console.log(DRY ? '=== DRY RUN, NOTHING WILL BE WRITTEN ===\n' : '=== APPLYING ===\n');

  const done = await prisma.journalEntry.count({ where: { memo: { contains: TAG } } });
  if (done > 0) {
    console.log(`Already applied (${done} entries tagged ${TAG}). Nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  // Accounts
  const codes = ['1000', '1010', '1200', '1500', '2000', '5200', '6200', '6400', '6900'];
  const accts = await prisma.glAccount.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  for (const c of codes) if (!acct.has(c)) throw new Error(`GL account ${c} missing — nothing changed.`);

  // Filed rows must still be exactly as measured
  const existing = new Map<string, { id: string; notes: string | null; createdById: string }>();
  console.log('--- 1. FILED ROWS CORRECTED ---\n');
  for (const u of UPDATES) {
    const e = await prisma.expense.findUnique({ where: { expenseNumber: u.expenseNumber } });
    if (!e) throw new Error(`${u.expenseNumber} not found — nothing changed.`);
    if (Math.abs(dec(e.totalAmount) - u.expect) > 0.005) {
      throw new Error(`${u.expenseNumber} total is ${dec(e.totalAmount)}, expected ${u.expect} — nothing changed.`);
    }
    if (e.paidAt) throw new Error(`${u.expenseNumber} already has paidAt — nothing changed.`);
    existing.set(u.expenseNumber, { id: e.id, notes: e.notes, createdById: e.createdById });
    console.log(`  ${u.expenseNumber}  ${money(u.expect).padStart(10)}  ${Object.keys(u.set).join(', ')}`);
  }
  const createdById = existing.get('filed-2025-2026-0077')!.createdById;

  // Suppliers
  const heartland = await prisma.supplier.findFirst({ where: { name: 'Heartland' } });
  const dhabi = await prisma.supplier.findFirst({ where: { name: 'Dhabi One International Trading' } });
  if (!heartland || !dhabi) throw new Error('Heartland or Dhabi One supplier missing — nothing changed.');
  const shory = await prisma.supplier.findFirst({ where: { name: { contains: 'Shory', mode: 'insensitive' } } });
  console.log(`\n  suppliers: Heartland ok, Dhabi One ok (TRN ${dhabi.trn ?? 'blank -> 100305810200003'}), ` +
    `Shory ${shory ? 'exists' : 'will be created'}`);

  // New expense numbers
  const lastExp = await prisma.expense.findMany({
    where: { expenseNumber: { startsWith: 'EXP-2025-' } },
    select: { expenseNumber: true },
    orderBy: { expenseNumber: 'desc' },
    take: 1,
  });
  let expSeq = lastExp.length ? parseInt(lastExp[0].expenseNumber.slice(-4), 10) : 0;
  const expNo = new Map<string, string>();
  for (const n of NEW_EXPENSES) expNo.set(n.key, `EXP-2025-${String(++expSeq).padStart(4, '0')}`);

  console.log('\n--- 2. NEW EXPENSE RECORDS (gross, no VAT claimed) ---\n');
  for (const n of NEW_EXPENSES) {
    console.log(`  ${expNo.get(n.key)}  ${n.date}  ${money(n.total).padStart(10)}  Dr ${n.debitCode} / Cr 2000  ${n.description}`);
  }

  console.log('\n--- 3. JOURNALS ---\n');
  for (const j of JOURNALS) {
    if (!balanced(j)) throw new Error(`Unbalanced journal: ${j.memo.slice(0, 80)} — nothing changed.`);
    console.log(`  ${j.date}  ${j.memo.slice(0, 110)}`);
    for (const l of j.lines) {
      const side = l.debit ? `Dr ${money(l.debit)}` : `Cr ${money(l.credit ?? 0)}`;
      console.log(`      ${l.code}  ${side.padStart(14)}  ${l.description}`);
    }
  }

  console.log('\n--- 4. DOCUMENTS ATTACHED ---\n');
  for (const a of ATTACHMENTS) {
    const path = join(DOCS_DIR, a.file);
    if (!existsSync(path)) throw new Error(`Missing document ${path} — nothing changed.`);
    const target = a.expense.startsWith('new:') ? expNo.get(a.expense.slice(4)) : a.expense;
    console.log(`  ${String(target).padEnd(22)} ${a.kind.padEnd(10)} ${a.file}`);
  }
  const already = await prisma.documentAttachment.findMany({
    where: { entityType: 'EXPENSE', entityId: { in: [...existing.values()].map((e) => e.id) } },
    select: { entityId: true, name: true, url: true },
  });
  if (already.length) {
    console.log('\n  already attached to these rows (left as they are):');
    for (const x of already) console.log(`    ${x.name}  ${x.url}`);
  }

  if (DRY) {
    console.log('\n=== DRY RUN — nothing written ===');
    await prisma.$disconnect();
    return;
  }

  // Copy documents into uploads first; rows reference them.
  mkdirSync(UPLOADS_DIR, { recursive: true });
  const uploaded = new Map<string, { url: string; size: number; mime: string }>();
  for (const a of ATTACHMENTS) {
    const ext = extname(a.file).toLowerCase();
    const stored = `supplier-2025-${a.file.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')}`;
    const dest = join(UPLOADS_DIR, stored);
    if (!existsSync(dest)) copyFileSync(join(DOCS_DIR, a.file), dest);
    uploaded.set(a.file, {
      url: `/uploads/${stored}`,
      size: statSync(dest).size,
      mime: ext === '.pdf' ? 'application/pdf' : 'image/jpeg',
    });
  }

  await prisma.$transaction(
    async (tx) => {
      const issued = new Set<string>();
      const post = async (j: Journal, sourceType?: string, sourceId?: string): Promise<void> => {
        await tx.journalEntry.create({
          data: {
            entryNumber: await nextNumber(tx, issued),
            date: day(j.date),
            memo: j.memo.slice(0, 480),
            source: 'SYSTEM',
            sourceType: sourceType ?? null,
            sourceId: sourceId ?? null,
            status: 'POSTED',
            postedAt: new Date(),
            lines: {
              create: j.lines.map((l) => ({
                accountId: acct.get(l.code)!,
                debit: l.debit ?? 0,
                credit: l.credit ?? 0,
                description: l.description,
              })),
            },
          },
        });
      };

      // Suppliers
      if (!dhabi.trn) await tx.supplier.update({ where: { id: dhabi.id }, data: { trn: '100305810200003' } });
      const shoryId =
        shory?.id ??
        (
          await tx.supplier.create({
            data: {
              name: 'Shory Insurance Brokers LLC',
              trn: '100442732200003',
              address: '20th Floor, Al Khatem Tower, Al Maryah Island',
              city: 'Abu Dhabi',
              email: 'support@shory.com',
              categories: ['Insurance'],
              category: 'Insurance',
            },
          })
        ).id;
      const supplierId = (name: string): string =>
        name === 'Heartland' ? heartland.id : name.startsWith('Shory') ? shoryId : dhabi.id;

      // 1. Filed rows
      const entityId = new Map<string, string>();
      for (const u of UPDATES) {
        const e = existing.get(u.expenseNumber)!;
        entityId.set(u.expenseNumber, e.id);
        await tx.expense.update({
          where: { id: e.id },
          data: { ...u.set, notes: `${e.notes ?? ''}\n[21 Sep 2026] ${TAG} ${u.note}`.trim() },
        });
      }

      // 2. New expenses, each with its own posting keyed EXPENSE:<id> so postAll() skips it
      for (const n of NEW_EXPENSES) {
        const e = await tx.expense.create({
          data: {
            expenseNumber: expNo.get(n.key)!,
            category: n.category,
            description: n.description,
            amount: n.total,
            vatAmount: 0,
            totalAmount: n.total,
            expenseDate: day(n.date),
            status: 'PAID',
            paidAt: day(n.paidAt),
            approvedAt: new Date(),
            vendorName: n.vendorName,
            supplierVatId: n.supplierVatId,
            supplierId: supplierId(n.supplierName),
            invoiceNumber: n.invoiceNumber,
            invoiceDate: day(n.date),
            sourceRef: `${TAG}:${n.key}`,
            notes: n.notes,
            createdById,
          },
        });
        entityId.set(`new:${n.key}`, e.id);
        await post(
          {
            date: n.date,
            memo: `Expense ${e.expenseNumber} ${TAG} ${n.vendorName} — ${n.description}`,
            lines: [
              { code: n.debitCode, debit: n.total, description: n.description.slice(0, 120) },
              { code: '2000', credit: n.total, description: `Accounts Payable — ${n.vendorName}` },
            ],
          },
          'EXPENSE',
          e.id,
        );
      }

      // 3. Corrections, reclassifications, payments. "new:<key>" in memos becomes the real number.
      for (const j of JOURNALS) {
        let memo = j.memo;
        for (const [k, no] of expNo) memo = memo.split(`new:${k}`).join(no);
        await post({ ...j, memo });
      }

      // 4. Attachments
      for (const a of ATTACHMENTS) {
        const up = uploaded.get(a.file)!;
        await tx.documentAttachment.create({
          data: {
            entityType: 'EXPENSE',
            entityId: entityId.get(a.expense)!,
            kind: a.kind,
            name: a.name,
            provider: 'UPLOAD',
            url: up.url,
            mimeType: up.mime,
            sizeBytes: up.size,
            sourceRef: `file:${a.file}`,
            notes: `${a.notes} Supplied by the GM 21 Sep 2026. Original: ${join(DOCS_DIR, a.file)}`,
          },
        });
      }
    },
    { timeout: 180000, maxWait: 30000 },
  );

  /* ---------------------------------------------------------------- verify */

  console.log('\n=== AFTER ===\n');
  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  const d = all.reduce((t, l) => t + dec(l.debit), 0);
  const c = all.reduce((t, l) => t + dec(l.credit), 0);
  console.log(`  trial balance: debits ${money(d)}  credits ${money(c)}  difference ${money(r2(d - c))}`);

  const types = await prisma.glAccount.findMany({ select: { id: true, code: true, type: true } });
  const byId = new Map(types.map((a) => [a.id, a]));
  const year = await prisma.journalLine.findMany({
    where: { entry: { date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') } } },
    select: { accountId: true, debit: true, credit: true },
  });
  let revenue = 0;
  let expense = 0;
  for (const l of year) {
    const a = byId.get(l.accountId);
    const net = dec(l.debit) - dec(l.credit);
    if (a?.type === 'INCOME') revenue -= net;
    if (a?.type === 'EXPENSE') expense += net;
  }
  console.log(`  2025 revenue ${money(revenue)}  expenses ${money(expense)}  PROFIT ${money(revenue - expense)}`);

  for (const code of ['1500', '1000', '2000', '1200']) {
    const lines = await prisma.journalLine.findMany({
      where: { account: { code } },
      select: { debit: true, credit: true },
    });
    const bal = lines.reduce((t, l) => t + dec(l.debit) - dec(l.credit), 0);
    console.log(`  ${code} balance (all dates) ${money(bal)}`);
  }
  const tagged = await prisma.journalEntry.count({ where: { memo: { contains: TAG } } });
  const att = await prisma.documentAttachment.count({ where: { sourceRef: { startsWith: 'file:' }, notes: { contains: 'Supplied by the GM 21 Sep 2026' } } });
  console.log(`  entries tagged ${TAG}: ${tagged}   documents attached: ${att}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
