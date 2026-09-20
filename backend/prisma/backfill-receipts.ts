/**
 * Customer receipts backfill — 19 September 2026.
 *
 * Until now not one customer receipt had ever been posted: accounts receivable
 * held 1,060,589.25 of debits and zero credits, the payments table was empty, and
 * the cash flow statement showed closing cash of -213,057.84 against a real bank
 * balance of 53,879.51 at 31 Dec 2025.
 *
 * This script builds the receipt register from two sources, and ONLY those two:
 *
 *   BANK  - read off an ADCB statement that opens without a password. Date, amount
 *           and the bank's own reference are recorded.
 *   GM    - confirmed directly by the General Manager where the statement covering
 *           it is password protected. The amount is his; the date is the best
 *           available and is marked uncertain in the note.
 *
 * Anything with neither becomes a genuine receivable. That is deliberate: the
 * General Manager chose the honest picture over the tidy one, so the gaps show.
 *
 * What it does, in one transaction:
 *   1. Deletes any RECEIPT payments and their journals from a previous run.
 *   2. Resets every invoice's amountPaid / amountDue / status from its own total.
 *   3. Creates a Payment row per receipt (direction RECEIPT, status CLEARED).
 *   4. Posts each one Dr 1010 Bank / Cr 1100 Accounts Receivable, using the same
 *      sourceType/sourceId keys as accounting.service.postAll() so that routine
 *      posting run treats them as already done and never doubles them.
 *   5. Recomputes each invoice's paid / due / status from its receipts.
 *
 * Re-runnable. Pass --dry to print the register and the resulting position
 * without writing anything.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

type Evidence = 'BANK' | 'GM';

interface Receipt {
  /** Invoice this receipt settles, by invoice number. */
  invoice: string;
  date: string;
  amount: number;
  method: 'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'CARD' | 'ONLINE';
  /** Bank reference, cheque number, or a short description of the source. */
  reference: string;
  evidence: Evidence;
  /** The narrative as it appears on the statement, or the confirmation given. */
  note: string;
}

/* ------------------------------------------------------------------------- */
/* The register                                                               */
/* ------------------------------------------------------------------------- */

const RECEIPTS: Receipt[] = [
  // ---- 2025, from the January statement ------------------------------------
  // The January 2025 statement was opened on 20 Sep 2026. It carries an opening
  // balance brought forward of 1,242.16 (which agrees with JE-2026-0435) and a
  // closing balance of 9,758.27.
  {
    invoice: 'TFMI25010',
    date: '2025-01-04',
    amount: 5775,
    method: 'BANK_TRANSFER',
    reference: '424512728',
    evidence: 'BANK',
    note:
      'B/O THE BRANDIZERS LLC - FZ — the first half of 11,550.00. The invoice is ' +
      'dated 31 Dec 2024, so this settles an opening receivable: the revenue belongs ' +
      'to 2024 and only the cash movement falls in 2025.',
  },
  {
    invoice: 'TFMI25010',
    date: '2025-01-09',
    amount: 5775,
    method: 'BANK_TRANSFER',
    reference: '426879061',
    evidence: 'BANK',
    note:
      'B/O THE BRANDIZERS LLC - FZ — the second half of 11,550.00. Invoice settled.',
  },

  // ---- 2025, from the February statement -----------------------------------
  {
    invoice: '251030',
    date: '2025-02-10',
    amount: 5250,
    method: 'BANK_TRANSFER',
    reference: '440581197',
    evidence: 'BANK',
    note: 'B/O WONDERFUL PRODUCTIONS FZ LLC — first half of 10,500.',
  },
  {
    invoice: '251030',
    date: '2025-02-13',
    amount: 5250,
    method: 'BANK_TRANSFER',
    reference: '441916440',
    evidence: 'BANK',
    note: 'B/O WONDERFUL PRODUCTIONS FZ LLC — second half of 10,500. Invoice settled.',
  },

  // ---- 2025, from the April statement --------------------------------------
  {
    invoice: '205135',
    date: '2025-04-05',
    amount: 26250,
    method: 'BANK_TRANSFER',
    reference: '465424761',
    evidence: 'BANK',
    note: 'B/O_THE BRANDIZERS L_465424761 — first half of 52,500.',
  },
  {
    invoice: '205135',
    date: '2025-04-10',
    amount: 26250,
    method: 'BANK_TRANSFER',
    reference: '467619313',
    evidence: 'BANK',
    note:
      'B/O_THE BRANDIZERS L_467619313 — second half. The invoice is settled in full. ' +
      'It had been carried as a 52,500.00 receivable until the April 2025 statement ' +
      'was opened on 20 Sep 2026.',
  },
  {
    invoice: '125036',
    date: '2025-04-15',
    amount: 5250,
    method: 'BANK_TRANSFER',
    reference: '469625285',
    evidence: 'BANK',
    note:
      'B/O_MEDIAMANI_EBIL_469625285_Freelan. Confirms the PAID stamp on the invoice ' +
      'face; previously rested on the General Manager’s word alone because the April ' +
      '2025 statement was locked.',
  },
  {
    invoice: 'TFMI250118',
    date: '2025-04-26',
    amount: 5250,
    method: 'BANK_TRANSFER',
    reference: '473981934',
    evidence: 'BANK',
    note:
      'B/O_/009/004 T_NRAK_473981934_Profess — Thirteen01. NOTE: a SECOND transfer of ' +
      '5,250.00 arrived the same day (ref 474239945). That one belongs to Thirteen01 ' +
      'invoice TFMI250120 of 26 Apr 2025, which exists in the Commercials folder but is ' +
      'NOT in the ledger — see the open items. It is deliberately not posted here.',
  },

  // ---- 2025, from the May statement ----------------------------------------
  {
    invoice: '2054045',
    date: '2025-05-01',
    amount: 10500,
    method: 'BANK_TRANSFER',
    reference: '76757685',
    evidence: 'BANK',
    note: 'B/O IY FILM LOCATIONS FZ LLC.',
  },
  {
    invoice: '2i2054045',
    date: '2025-05-02',
    amount: 11484.4,
    method: 'BANK_TRANSFER',
    reference: '477361155',
    evidence: 'BANK',
    note: 'B/O_KHALIFA AWARD FO_477361155 — Books 17, first 50%.',
  },
  {
    invoice: '2054046',
    date: '2025-05-07',
    amount: 19335,
    method: 'BANK_TRANSFER',
    reference: '80030079',
    evidence: 'BANK',
    note:
      'B/O IY FILM LOCATIONS FZ LLC. Invoice is 19,425.00; 90.00 less was received, ' +
      'consistent with an inbound transfer charge deducted in the chain.',
  },
  {
    invoice: '2i2054045',
    date: '2025-05-13',
    amount: 11484.4,
    method: 'BANK_TRANSFER',
    reference: '482342674',
    evidence: 'BANK',
    note:
      'B/O_KHALIFA AWARD FO_482342674 — Books 17, second 50%. The two halves come to ' +
      '22,968.80 against an invoice of 22,968.75; 0.05 over.',
  },

  // ---- 2025, from the June statement ---------------------------------------
  {
    invoice: '25111',
    date: '2025-06-04',
    amount: 6300,
    method: 'BANK_TRANSFER',
    reference: '493113051',
    evidence: 'BANK',
    note: 'B/O_GOVERNMENT_HSBC_493113051 — Dubai Media Incorporated.',
  },
  {
    invoice: '25120',
    date: '2025-06-05',
    amount: 3675,
    method: 'BANK_TRANSFER',
    reference: '493656357',
    evidence: 'BANK',
    note: 'B/O VERTIGO FILMS.',
  },

  // ---- 2025, from the July statement ---------------------------------------
  {
    invoice: 'TFMI25167',
    date: '2025-07-02',
    amount: 10000,
    method: 'CHEQUE',
    reference: '000025',
    evidence: 'BANK',
    note: 'In-house cheque deposit 000025 — Metafiction Studios, cheque 1 of 8.',
  },
  {
    invoice: 'TFMI25167',
    date: '2025-07-04',
    amount: 14000,
    method: 'CHEQUE',
    reference: '000026',
    evidence: 'BANK',
    note: 'In-house cheque deposit 000026 — Metafiction Studios, cheque 2 of 8.',
  },
  {
    invoice: 'TFMI25251',
    date: '2025-07-07',
    amount: 62390.25,
    method: 'BANK_TRANSFER',
    reference: '507030474',
    evidence: 'BANK',
    note: 'B/O_LES PRODUC_EBIL_507030474_/INV/VI — inbound wire.',
  },
  {
    invoice: 'TFMI25167',
    date: '2025-07-09',
    amount: 20000,
    method: 'CHEQUE',
    reference: '000037',
    evidence: 'BANK',
    note: 'In-house cheque deposit 000037 — Metafiction Studios, cheque 3 of 8.',
  },
  {
    invoice: 'TFMI25167',
    date: '2025-07-12',
    amount: 20000,
    method: 'CHEQUE',
    reference: '000041',
    evidence: 'BANK',
    note: 'In-house cheque deposit 000041 — Metafiction Studios, cheque 4 of 8.',
  },
  {
    invoice: 'TFMI25167',
    date: '2025-07-18',
    amount: 25000,
    method: 'CHEQUE',
    reference: '000043',
    evidence: 'BANK',
    note: 'In-house cheque deposit 000043 — Metafiction Studios, cheque 5 of 8.',
  },
  {
    invoice: 'TFMI25167',
    date: '2025-07-21',
    amount: 25000,
    method: 'CHEQUE',
    reference: '000044',
    evidence: 'BANK',
    note: 'In-house cheque deposit 000044 — Metafiction Studios, cheque 6 of 8.',
  },
  {
    invoice: 'TFMI25251',
    date: '2025-07-15',
    amount: 4692.48,
    method: 'ONLINE',
    reference: '510595674',
    evidence: 'BANK',
    note:
      'B/O_ZIINA PAYM_ARAB_510595674_COP/Com — the third part-settlement of this ' +
      'invoice, taken through Ziina. With the two wires this comes to 127,224.98 ' +
      'against 127,610.50; the 385.52 difference is inbound international transfer ' +
      'charges. NOTE: a separate 100.00 Ziina credit on 8 Jul 2025 was the owner ' +
      'testing the Ziina account, not a customer payment, and is deliberately excluded.',
  },
  {
    invoice: 'TFMI25251',
    date: '2025-07-22',
    amount: 60142.25,
    method: 'BANK_TRANSFER',
    reference: '512992087',
    evidence: 'BANK',
    note:
      'B/O_LES PRODUC_EBIL_512992087_/INV/VI — inbound wire. The two wires and the ' +
      'Ziina payment come to 127,224.98 against an invoice of 127,610.50, leaving ' +
      '385.52 of inbound transfer charges.',
  },

  // ---- 2025, from the September statement -----------------------------------
  {
    invoice: 'TFMI25278',
    date: '2025-09-22',
    amount: 101942.25,
    method: 'BANK_TRANSFER',
    reference: '540791112',
    evidence: 'BANK',
    note:
      'B/O_LES PRODUC_EBIL_540791112_/INV/ I — an advance against the second Athletic ' +
      'shoot, received before the invoice was raised on 8 Oct 2025. With the 40,637.25 ' +
      'of 10 Oct this comes to 142,579.50 against 142,695.00, the 115.50 difference ' +
      'being inbound international transfer charges. TAX POINT: the advance falls in Q3 ' +
      'while the invoice is dated in Q4 — the split between quarters is a question for ' +
      'the tax adviser.',
  },

  // ---- 2025, from the August statement -------------------------------------
  {
    invoice: '250120-AS',
    date: '2025-08-29',
    amount: 5880,
    method: 'CHEQUE',
    reference: '022938',
    evidence: 'BANK',
    note: 'Cheque deposit 022938, clearing ref 202620181 — Al Sayegh Media.',
  },

  // ---- 2025, from the October statement ------------------------------------
  {
    invoice: '2050152',
    date: '2025-10-02',
    amount: 31500,
    method: 'BANK_TRANSFER',
    reference: '46640148',
    evidence: 'BANK',
    note: 'B/O IY FILM LOCATIONS FZ LLC.',
  },
  {
    invoice: 'TFMI25278',
    date: '2025-10-10',
    amount: 40637.25,
    method: 'BANK_TRANSFER',
    reference: '550467754',
    evidence: 'BANK',
    note:
      'B/O_LES PRODUC_EBIL_550467754_/INV/ I — inbound wire against an invoice of ' +
      '142,695.00. The balance has not been traced in any statement that opens.',
  },
  {
    invoice: 'TFMI25167',
    date: '2025-10-17',
    amount: 35000,
    method: 'CHEQUE',
    reference: '000053',
    evidence: 'BANK',
    note: 'In-house cheque deposit 000053 — Metafiction Studios, cheque 7 of 8.',
  },

  // ---- 2025, from the November statement -----------------------------------
  {
    invoice: '25150',
    date: '2025-11-12',
    amount: 119700,
    method: 'BANK_TRANSFER',
    reference: '566715196',
    evidence: 'BANK',
    note:
      'B/O_MEDIA MANI_EBIL_566715196_Payment. Settles the Media Mania invoice in full ' +
      'and closes the long-standing question of how it was paid.',
  },
  {
    invoice: '25141',
    date: '2025-11-19',
    amount: 9187.5,
    method: 'BANK_TRANSFER',
    reference: '69715141',
    evidence: 'BANK',
    note: 'B/O TWOFOUR54 FZ LLC — against purchase order PO-25-TF54-00785.',
  },
  {
    invoice: 'TFMI25167',
    date: '2025-11-29',
    amount: 30000,
    method: 'CHEQUE',
    reference: '000054',
    evidence: 'BANK',
    note:
      'In-house cheque deposit 000054 — Metafiction Studios, cheque 8 of 8. The eight ' +
      'cheques come to 179,000.00 exactly, settling the invoice in full.',
  },

  // ---- 2026, from the February statement -----------------------------------
  {
    invoice: '26031',
    date: '2026-02-10',
    amount: 7350,
    method: 'BANK_TRANSFER',
    reference: '612704770',
    evidence: 'BANK',
    note: 'B/O cinegate fzc.',
  },
  {
    invoice: '25160',
    date: '2026-02-12',
    amount: 111877.5,
    method: 'BANK_TRANSFER',
    reference: '14039563',
    evidence: 'BANK',
    note:
      'B/O TWOFOUR54 FZ LLC — against purchase order PO-25-TF54-01138. A 2025 supply ' +
      'settled in February 2026. Bank evidence: ADCB 13328662820001, 12/02/2026, ref ' +
      '14039563, balance 16,746.66 -> 128,624.16. CONFIRMED by Fatima Wasim, Assistant ' +
      'Accountant at twofour54, by email of 14 Sep 2026: accounts payable paid in full ' +
      'with NO NET-OFF applied, so the company’s own arrears to twofour54 remain ' +
      'payable separately. Clears the 31 Dec 2025 trade receivable; no effect on the ' +
      '2025 result or VAT. This evidence was carried over from manual journal ' +
      'JE-2026-0431, which recorded the same receipt before the payments backfill ' +
      'existed and was retired on 20 Sep 2026 to stop the money being counted twice.',
  },
  {
    invoice: '26033',
    date: '2026-02-20',
    amount: 29400,
    method: 'BANK_TRANSFER',
    reference: '17539313',
    evidence: 'BANK',
    note: 'B/O AL FALAH ACADEMY - ABU DHABI — payment 1 of 3 on the website build.',
  },

  // ---- 2026, from the June statement ---------------------------------------
  {
    invoice: '206010',
    date: '2026-06-19',
    amount: 26250,
    method: 'BANK_TRANSFER',
    reference: '674996537',
    evidence: 'BANK',
    note:
      'Part of the single 35,700.00 receipt B/O_EDUCATION KHALIF_674996537 — this is ' +
      'half of the 52,500.00 Books 18 invoice. The remaining 26,250.00 is outstanding.',
  },
  {
    invoice: '206011',
    date: '2026-06-19',
    amount: 9450,
    method: 'BANK_TRANSFER',
    reference: '674996537',
    evidence: 'BANK',
    note:
      'The other part of the 35,700.00 receipt of 19 June 2026 — the Books 18 overage ' +
      'in full.',
  },
  {
    invoice: '26036',
    date: '2026-06-27',
    amount: 7350,
    method: 'BANK_TRANSFER',
    reference: '78882924',
    evidence: 'BANK',
    note: 'B/O AL FALAH ACADEMY - ABU DHABI — the OTP implementation invoice, in full.',
  },

  // ---- WITHDRAWN: The Creator Space FZ LLC, invoice 2510032, 25,200.00 -------
  //
  // A receipt was carried here on 19 Jan 2025 on the General Manager's
  // confirmation of 19 Sep 2026 ("creator space is 25,000 is a correct invoice
  // and was paid"), recorded at a time when the January to April 2025
  // statements were password protected and could not be opened.
  //
  // All twelve months of 2025 have since been read. No credit of 25,200.00, and
  // no pair of 12,600.00, appears anywhere in the year. The confirmation is
  // therefore not supported by the bank, so the receipt is withdrawn and the
  // invoice stands as a receivable at 31 December 2025.
  //
  // The invoice itself is NOT in question — the General Manager confirmed it is
  // correct and it remains posted. What is unresolved is how it was settled.
  // Three possibilities remain open and only he can close them: it was settled
  // in cash direct to him (as the Silver Frame balance was); it was settled in
  // 2026 and belongs in a month whose statement is still missing (May, August or
  // September 2026); or it was never in fact collected. Until one is confirmed,
  // the conservative treatment is to leave it outstanding.

  // ---- 2025, from the December statement ------------------------------------
  {
    invoice: '250655',
    date: '2025-12-10',
    amount: 15225,
    method: 'BANK_TRANSFER',
    reference: '580544105',
    evidence: 'BANK',
    note:
      'B/O_AL SAYEGH_EBIL_580544105_INV2506 — the first half. The supply was billed ' +
      'across two documents, 250655 "Payment 1 of 2" and 250656 "Payment 2 of 2", each ' +
      'requesting 15,225.00 against ONE supply of 30,450.00. The bank shows exactly two ' +
      'halves, which confirms the single-supply reading: 250656 must never be entered ' +
      'as a second invoice.',
  },
  {
    invoice: '250655',
    date: '2025-12-13',
    amount: 15225,
    method: 'BANK_TRANSFER',
    reference: '582034022',
    evidence: 'BANK',
    note: 'B/O_AL SAYEGH_EBIL_582034022_INV2506 — the second half. Invoice settled.',
  },
  {
    invoice: 'INV-2026-0005',
    date: '2025-12-18',
    amount: 50000,
    method: 'BANK_TRANSFER',
    reference: '84526955',
    evidence: 'BANK',
    note: 'B/O SILVER FRAME CINEMA PRODUCTION LLC SPC — first bank settlement.',
  },
  {
    invoice: 'INV-2026-0005',
    date: '2025-12-31',
    amount: 35250,
    method: 'BANK_TRANSFER',
    reference: '91406792',
    evidence: 'BANK',
    note:
      'B/O SILVER FRAME CINEMA PRODUCTION LLC SPC — second bank settlement, the last ' +
      'movement of the year. It takes the account to 53,879.51, which is the closing ' +
      'balance at 31 December 2025.',
  },
  {
    invoice: '206010',
    date: '2025-12-28',
    amount: 26250,
    method: 'BANK_TRANSFER',
    reference: '589200701',
    evidence: 'BANK',
    note:
      'B/O_EDUCATION KHALIF_589200701 — the FIRST half of the 52,500.00 Books 18 ' +
      'engagement, received 28 Dec 2025 against the tax invoice 1i25620 dated 16 Dec ' +
      '2025. The ledger carries that engagement under 206010, dated 10 Jun 2026, and ' +
      'the second half of 26,250.00 arrived 19 Jun 2026. So the invoice is settled in ' +
      'full and the 26,250.00 previously shown as outstanding was never owed. OPEN ' +
      'POINT: the supply was invoiced in December 2025 and the ledger dates it June ' +
      '2026, which straddles two tax years — one for the tax adviser.',
  },

  // ---- 2026, from the January statement -------------------------------------
  {
    invoice: '250640',
    date: '2026-01-09',
    amount: 7350,
    method: 'BANK_TRANSFER',
    reference: '596209201',
    evidence: 'BANK',
    note:
      'B/O AL SAYEGH MEDIA LLC — settles the 10 Nov 2025 invoice in full. It had been ' +
      'carried as a receivable until the January 2026 statement was opened on 20 Sep ' +
      '2026. NOTE: a separate 10,500.00 arrived from Prestige Motorcycle Rentals on ' +
      '15 Jan 2026, against invoices 260001/260002 which are not in the ledger.',
  },
  {
    invoice: 'INV-2026-0005',
    date: '2025-12-31',
    amount: 25000,
    method: 'CASH',
    reference: 'confirmed-cash-to-gm',
    evidence: 'GM',
    note:
      'Silver Frame Cinema Production — the balance, received IN CASH direct to the ' +
      'General Manager, per his confirmation. The invoice itself states amount settled ' +
      '110,250.00 and balance due nil, which agrees. This receipt is posted to 1000 Cash ' +
      'on Hand, not to the bank, because it never entered the bank account. THE GENERAL ' +
      'MANAGER HAS SEPARATELY STATED THERE WAS NO CASH ON HAND AT 31 DEC 2025, so a ' +
      'further entry is needed to clear it — owner drawings, or costs settled in cash. ' +
      'Until that entry is made, 1000 carries 25,000.00 that he says was not there.',
  },
  {
    invoice: '26035',
    date: '2026-07-28',
    amount: 22050,
    method: 'BANK_TRANSFER',
    reference: '93268120',
    evidence: 'BANK',
    note:
      'B/O AL FALAH ACADEMY - ABU DHABI — payment 2 of 3 on the website build. The ' +
      'General Manager recalled this as August 2026 and it was first recorded at an ' +
      'assumed 15 Aug; the July 2026 statement, opened 19 Sep 2026, shows it landing on ' +
      '28 July 2026 with bank reference 93268120. The statement is now the record.',
  },
];

/* ------------------------------------------------------------------------- */
/* Machinery                                                                  */
/* ------------------------------------------------------------------------- */

function d(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

function money(n: number): string {
  return n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Status an invoice should carry given what has been received against it. */
function statusFor(total: number, paid: number): 'PAID' | 'PARTIALLY_PAID' | 'SENT' {
  if (paid <= 0) return 'SENT';
  // A shortfall of a few dirhams is a bank charge, not an unpaid balance.
  if (paid >= total - 0.05) return 'PAID';
  return 'PARTIALLY_PAID';
}

async function nextReceiptNumber(
  tx: Prisma.TransactionClient,
  taken: Set<string>,
  year: number,
): Promise<string> {
  const prefix = `RCP-${year}-`;
  const last = await tx.payment.findMany({
    where: { paymentNumber: { startsWith: prefix } },
    select: { paymentNumber: true },
    orderBy: { paymentNumber: 'desc' },
    take: 1,
  });
  let n = last.length ? parseInt(last[0].paymentNumber.slice(prefix.length), 10) : 0;
  let candidate = '';
  do {
    n += 1;
    candidate = `${prefix}${String(n).padStart(4, '0')}`;
  } while (taken.has(candidate));
  taken.add(candidate);
  return candidate;
}

async function nextEntryNumber(
  tx: Prisma.TransactionClient,
  taken: Set<string>,
): Promise<string> {
  const last = await tx.journalEntry.findMany({
    where: { entryNumber: { startsWith: 'JE-2026-' } },
    select: { entryNumber: true },
    orderBy: { entryNumber: 'desc' },
    take: 1,
  });
  let n = last.length ? parseInt(last[0].entryNumber.slice(-4), 10) : 0;
  let candidate = '';
  do {
    n += 1;
    candidate = `JE-2026-${String(n).padStart(4, '0')}`;
  } while (taken.has(candidate));
  taken.add(candidate);
  return candidate;
}

async function main(): Promise<void> {
  /* --- preconditions ----------------------------------------------------- */

  const invoices = await prisma.invoice.findMany({
    select: {
      id: true,
      invoiceNumber: true,
      clientId: true,
      issueDate: true,
      total: true,
      currency: true,
      client: { select: { companyName: true } },
    },
  });
  const byNumber = new Map(invoices.map((i) => [i.invoiceNumber, i]));

  const missing = [...new Set(RECEIPTS.map((r) => r.invoice))].filter((n) => !byNumber.has(n));
  if (missing.length) {
    throw new Error(`Receipts reference invoices that are not in the ledger: ${missing.join(', ')}`);
  }

  for (const r of RECEIPTS) {
    if (!(r.amount > 0)) throw new Error(`Receipt against ${r.invoice} has a non-positive amount.`);
  }

  const accounts = await prisma.glAccount.findMany({
    where: { code: { in: ['1000', '1010', '1100'] } },
    select: { id: true, code: true },
  });
  const acc = new Map(accounts.map((a) => [a.code, a.id]));
  for (const c of ['1010', '1100']) {
    if (!acc.has(c)) throw new Error(`GL account ${c} not found. Aborting.`);
  }
  // Cash received in hand never touched the bank, so it must not be posted there.
  const needsCash = RECEIPTS.some((r) => r.method === 'CASH');
  if (needsCash && !acc.has('1000')) {
    throw new Error('A cash receipt is in the register but GL account 1000 does not exist. Aborting.');
  }

  const bank = await prisma.bankAccount.findFirst({ select: { id: true } });

  /* --- the register, and what it implies ---------------------------------- */

  const receivedBy = new Map<string, number>();
  for (const r of RECEIPTS) {
    receivedBy.set(r.invoice, round2((receivedBy.get(r.invoice) ?? 0) + r.amount));
  }

  const bankTotal = RECEIPTS.filter((r) => r.evidence === 'BANK').reduce((s, r) => s + r.amount, 0);
  const gmTotal = RECEIPTS.filter((r) => r.evidence === 'GM').reduce((s, r) => s + r.amount, 0);

  console.log(DRY ? '=== DRY RUN — NOTHING WILL BE WRITTEN ===\n' : '=== APPLYING ===\n');
  console.log(`Receipt register: ${RECEIPTS.length} receipts`);
  console.log(`  evidenced by a bank statement : ${money(bankTotal)}`);
  console.log(`  confirmed by the GM only      : ${money(gmTotal)}`);
  console.log(`  total                         : ${money(bankTotal + gmTotal)}\n`);

  console.log('=== INVOICE POSITION AFTER THE BACKFILL ===');
  const rows = invoices
    .slice()
    .sort((a, b) => a.issueDate.getTime() - b.issueDate.getTime())
    .map((inv) => {
      const total = Number(inv.total);
      const paid = receivedBy.get(inv.invoiceNumber) ?? 0;
      const due = round2(Math.max(0, total - paid));
      return { inv, total, paid, due, status: statusFor(total, paid) };
    });

  let outstanding = 0;
  for (const r of rows) {
    if (r.status !== 'PAID') outstanding += r.due;
    console.log(
      `  ${r.inv.invoiceNumber.padEnd(12)} ${r.inv.issueDate.toISOString().slice(0, 10)} ` +
        `${(r.inv.client?.companyName ?? '').slice(0, 26).padEnd(26)} ` +
        `tot ${money(r.total).padStart(12)}  paid ${money(r.paid).padStart(12)}  ` +
        `due ${money(r.due).padStart(12)}  ${r.status}`,
    );
  }
  console.log(`\n  Receivable after the backfill: ${money(round2(outstanding))}`);

  console.log('\n=== INVOICES WITH NO RECEIPT AT ALL ===');
  const orphans = rows.filter((r) => r.paid === 0);
  for (const r of orphans) {
    console.log(
      `  ${r.inv.invoiceNumber.padEnd(12)} ${r.inv.issueDate.toISOString().slice(0, 10)} ` +
        `${(r.inv.client?.companyName ?? '').slice(0, 30).padEnd(30)} ${money(r.total).padStart(12)}`,
    );
  }
  console.log(`  (${orphans.length} invoices, ${money(round2(orphans.reduce((s, r) => s + r.total, 0)))})`);

  if (DRY) return;

  /* --- write -------------------------------------------------------------- */

  await prisma.$transaction(
    async (tx) => {
      // 1. Clear anything a previous run of this script left behind.
      const prior = await tx.payment.findMany({
        where: { direction: 'RECEIPT' },
        select: { id: true },
      });
      if (prior.length) {
        const ids = prior.map((p) => p.id);
        const priorEntries = await tx.journalEntry.findMany({
          where: { sourceType: 'PAYMENT', sourceId: { in: ids } },
          select: { id: true },
        });
        const entryIds = priorEntries.map((e) => e.id);
        if (entryIds.length) {
          await tx.journalLine.deleteMany({ where: { entryId: { in: entryIds } } });
          await tx.journalEntry.deleteMany({ where: { id: { in: entryIds } } });
        }
        await tx.payment.deleteMany({ where: { id: { in: ids } } });
        console.log(`cleared ${prior.length} receipt(s) and ${entryIds.length} journal(s) from a previous run`);
      }

      // 2. Reset every invoice to unpaid, from its own total.
      for (const inv of invoices) {
        await tx.invoice.update({
          where: { id: inv.id },
          data: { amountPaid: 0, amountDue: inv.total, status: 'SENT' },
        });
      }

      // 3 + 4. Create each receipt and post it.
      const receiptNumbers = new Set<string>();
      const entryNumbers = new Set<string>();

      for (const r of RECEIPTS) {
        const inv = byNumber.get(r.invoice)!;
        const when = d(r.date);
        const paymentNumber = await nextReceiptNumber(tx, receiptNumbers, when.getUTCFullYear());

        const payment = await tx.payment.create({
          data: {
            paymentNumber,
            direction: 'RECEIPT',
            invoiceId: inv.id,
            clientId: inv.clientId,
            bankAccountId: r.method === 'CASH' ? null : bank?.id ?? null,
            amount: r.amount,
            currency: inv.currency,
            paymentDate: when,
            method: r.method,
            status: 'CLEARED',
            clearedAt: when,
            reference: r.reference,
            notes: `[${r.evidence}] ${r.note}`,
          },
          select: { id: true },
        });

        const entryNumber = await nextEntryNumber(tx, entryNumbers);
        await tx.journalEntry.create({
          data: {
            entryNumber,
            date: when,
            memo: `Payment ${paymentNumber}`,
            source: 'SYSTEM',
            sourceType: 'PAYMENT',
            sourceId: payment.id,
            status: 'POSTED',
            postedAt: new Date(),
            lines: {
              create: [
                r.method === 'CASH'
                  ? { accountId: acc.get('1000')!, debit: r.amount, credit: 0, description: 'Cash on Hand' }
                  : { accountId: acc.get('1010')!, debit: r.amount, credit: 0, description: 'Bank' },
                { accountId: acc.get('1100')!, debit: 0, credit: r.amount, description: 'Accounts Receivable' },
              ],
            },
          },
        });
      }

      // 5. Recompute each invoice from its receipts.
      for (const row of rows) {
        await tx.invoice.update({
          where: { id: row.inv.id },
          data: {
            amountPaid: row.paid,
            amountDue: row.due,
            status: row.status,
          },
        });
      }
    },
    { timeout: 120000 },
  );

  /* --- verify ------------------------------------------------------------- */

  console.log('\n=== AFTER ===');
  const count = await prisma.payment.count({ where: { direction: 'RECEIPT' } });
  console.log(`receipts in the system: ${count}`);

  const ar = await prisma.journalLine.aggregate({
    where: { account: { code: '1100' }, entry: { status: 'POSTED' } },
    _sum: { debit: true, credit: true },
  });
  const arDr = Number(ar._sum.debit ?? 0);
  const arCr = Number(ar._sum.credit ?? 0);
  console.log(`1100 Accounts Receivable: debits ${money(arDr)}  credits ${money(arCr)}  balance ${money(round2(arDr - arCr))}`);

  const tb = await prisma.journalLine.aggregate({
    where: { entry: { status: 'POSTED' } },
    _sum: { debit: true, credit: true },
  });
  const dr = Number(tb._sum.debit ?? 0);
  const cr = Number(tb._sum.credit ?? 0);
  console.log(`trial balance: debits ${money(dr)}  credits ${money(cr)}  difference ${money(round2(dr - cr))}`);

  for (const year of [2025, 2026]) {
    const cash = await prisma.journalLine.aggregate({
      where: {
        account: { code: '1010' },
        entry: { status: 'POSTED', date: { lt: d(`${year + 1}-01-01`) } },
      },
      _sum: { debit: true, credit: true },
    });
    const cdr = Number(cash._sum.debit ?? 0);
    const ccr = Number(cash._sum.credit ?? 0);
    console.log(`1010 Bank to 31 Dec ${year}: in ${money(cdr)}  out ${money(ccr)}  balance ${money(round2(cdr - ccr))}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
