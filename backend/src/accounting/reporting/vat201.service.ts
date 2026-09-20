import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { COMPANY_PROFILE } from './company-profile';

/**
 * The UAE VAT return, in the fifteen-box shape of form VAT 201.
 *
 * Two things this service does that `finance-reports.getVatReturn()` does not.
 *
 * First, it produces every box of the actual form rather than a subset, so the
 * figures can be typed straight into EmaraTax without a human deciding which
 * number goes where.
 *
 * Second, it reconciles the return against the general ledger. The existing
 * report classifies supplies from `InvoiceItem.taxRate.vatType` while
 * `AccountingService.postAll()` credits account 2100 with `Invoice.vatAmount`
 * regardless of tax rate. A zero-rated invoice can therefore be reported as
 * zero-rated and still post output VAT, and nothing anywhere compares the two.
 * `reconciliation` in the payload below is that comparison. A non-zero difference
 * means the return and the books disagree, and it is shown rather than resolved
 * silently in favour of either.
 */

/** Emirates as the form lists them for the Box 1 breakdown. */
export const EMIRATES = [
  'Abu Dhabi',
  'Dubai',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah',
] as const;
export type Emirate = (typeof EMIRATES)[number];

/**
 * The emirate a supply is attributed to when the invoice does not record one.
 *
 * Taken from the company's own registered address on the FTA VAT registration
 * certificate — Khalifa Park, Abu Dhabi — because a fixed establishment
 * attributes its supplies to its own emirate by default. The caveat in the return
 * reports how much of box 1 rests on that default rather than on a recorded fact.
 */
export const DEFAULT_EMIRATE: Emirate = COMPANY_PROFILE.emirate;

/** The UAE standard rate, used to compute the reverse charge on both sides. */
export const STANDARD_RATE = 0.05;

export interface BoxAmount {
  box: string;
  label: string;
  amount: number;
  vat: number | null;
}

@Injectable()
export class Vat201Service {
  constructor(private prisma: PrismaService) {}

  async return201(args: { from: string; to: string }) {
    const from = new Date(args.from);
    const to = new Date(args.to);

    const [items, expenses, ledger] = await Promise.all([
      this.prisma.invoiceItem.findMany({
        where: {
          invoice: {
            issueDate: { gte: from, lte: to },
            status: { notIn: ['CANCELLED', 'VOIDED', 'DRAFT'] as any },
          },
        },
        include: {
          taxRate: true,
          invoice: {
            select: {
              invoiceNumber: true,
              issueDate: true,
              placeOfSupply: true,
              client: { select: { companyName: true, trn: true } },
            },
          },
        },
      }),
      this.prisma.expense.findMany({
        where: { expenseDate: { gte: from, lte: to }, status: { in: ['APPROVED', 'PAID'] as any } },
        select: {
          expenseNumber: true,
          expenseDate: true,
          amount: true,
          vatAmount: true,
          category: true,
          supplier: { select: { name: true, country: true } },
        },
      }),
      this.ledgerVat(from, to),
    ]);

    // ── Output side ────────────────────────────────────────────────────────────
    const byEmirate = new Map<Emirate, { amount: number; vat: number }>();
    let zeroRated = 0;
    let exempt = 0;
    let outOfScope = 0;
    let standardAmount = 0;
    let standardVat = 0;
    let unallocatedAmount = 0;

    for (const item of items) {
      const net = Number(item.lineTotal);
      const vat = Number(item.taxAmount);
      const kind = item.taxRate?.vatType ?? 'STANDARD';

      if (kind === 'ZERO_RATED') { zeroRated += net; continue; }
      if (kind === 'EXEMPT') { exempt += net; continue; }
      if (kind === 'OUT_OF_SCOPE') { outOfScope += net; continue; }

      standardAmount += net;
      standardVat += vat;

      // Use the emirate recorded on the invoice. Where none is recorded the
      // company's own emirate stands in, and the amount is counted so the caveat
      // below reports how much of box 1 rests on that assumption.
      const recorded = (item.invoice.placeOfSupply ?? '').trim();
      const emirate = (EMIRATES as readonly string[]).includes(recorded)
        ? (recorded as Emirate)
        : DEFAULT_EMIRATE;
      if (!recorded) unallocatedAmount += net;

      const cur = byEmirate.get(emirate) ?? { amount: 0, vat: 0 };
      cur.amount += net;
      cur.vat += vat;
      byEmirate.set(emirate, cur);
    }

    // ── Input side ─────────────────────────────────────────────────────────────
    /**
     * Boxes 3 and 10 are the reverse charge: services bought from a supplier
     * established outside the UAE, where the recipient accounts for the output VAT
     * and recovers the same amount as input VAT. The two boxes therefore net to
     * nil when the input is fully recoverable — but both must still be declared,
     * and omitting them understates the return on both sides.
     *
     * A supplier is treated as outside the UAE when `Supplier.country` is anything
     * other than UAE. That field already exists and is populated; the foreign
     * suppliers in this database are the software subscriptions — Adobe, Google
     * Cloud, Figma, Vercel, Zoom and the like — which is exactly the population
     * the reverse charge is for.
     *
     * Reverse-charge expenses are excluded from box 9 below. They are not standard
     * rated purchases and counting them in both places would overstate recoverable
     * input tax.
     */
    const isReverseCharge = (e: (typeof expenses)[number]) =>
      !!e.supplier?.country && e.supplier.country.trim().toUpperCase() !== 'UAE';

    const rcExpenses = expenses.filter(isReverseCharge);
    const domesticExpenses = expenses.filter(e => !isReverseCharge(e));

    const rcNet = r2(rcExpenses.reduce((s, e) => s + Number(e.amount), 0));
    const reverseCharge = { amount: rcNet, vat: r2(rcNet * STANDARD_RATE) };

    const expenseNet = r2(domesticExpenses.reduce((s, e) => s + Number(e.amount), 0));
    const expenseVat = r2(domesticExpenses.reduce((s, e) => s + Number(e.vatAmount), 0));

    const box1: BoxAmount[] = [...byEmirate.entries()].map(([emirate, v]) => ({
      box: '1',
      label: `Standard rated supplies — ${emirate}`,
      amount: r2(v.amount),
      vat: r2(v.vat),
    }));

    const totalOutputTax = r2(standardVat + reverseCharge.vat);
    const totalInputTax = r2(expenseVat + reverseCharge.vat);
    const netVatDue = r2(totalOutputTax - totalInputTax);

    return {
      period: { from: args.from, to: args.to },
      currency: 'AED',
      boxes: [
        ...box1,
        { box: '2', label: 'Tax refunds provided to tourists', amount: 0, vat: 0 },
        { box: '3', label: 'Supplies subject to the reverse charge', amount: reverseCharge.amount, vat: reverseCharge.vat },
        { box: '4', label: 'Zero rated supplies', amount: r2(zeroRated), vat: null },
        { box: '5', label: 'Exempt supplies', amount: r2(exempt), vat: null },
        { box: '6', label: 'Goods imported into the UAE', amount: 0, vat: 0 },
        { box: '7', label: 'Adjustments to goods imported into the UAE', amount: 0, vat: 0 },
        { box: '8', label: 'Totals', amount: r2(standardAmount + zeroRated + exempt + reverseCharge.amount), vat: totalOutputTax },
        { box: '9', label: 'Standard rated expenses', amount: expenseNet, vat: expenseVat },
        { box: '10', label: 'Supplies subject to the reverse charge — recoverable', amount: reverseCharge.amount, vat: reverseCharge.vat },
        { box: '11', label: 'Totals', amount: r2(expenseNet + reverseCharge.amount), vat: totalInputTax },
        { box: '12', label: 'Total value of due tax for the period', amount: null as any, vat: totalOutputTax },
        { box: '13', label: 'Total value of recoverable tax for the period', amount: null as any, vat: totalInputTax },
        { box: '14', label: netVatDue >= 0 ? 'Payable tax for the period' : 'Recoverable tax for the period', amount: null as any, vat: Math.abs(netVatDue) },
      ] as BoxAmount[],

      summary: { totalOutputTax, totalInputTax, netVatDue },

      /**
       * The return against the books. A difference means the source documents and
       * the ledger disagree about the same period's VAT.
       */
      reconciliation: {
        outputTaxPerReturn: totalOutputTax,
        outputTaxPerLedger: ledger.outputVat,
        outputDifference: r2(totalOutputTax - ledger.outputVat),
        inputTaxPerReturn: totalInputTax,
        inputTaxPerLedger: ledger.inputVat,
        inputDifference: r2(totalInputTax - ledger.inputVat),
        agrees:
          r2(totalOutputTax - ledger.outputVat) === 0 && r2(totalInputTax - ledger.inputVat) === 0,
      },

      /** Facts the preparer must know before signing the return. */
      caveats: [
        ...(unallocatedAmount > 0
          ? [{
              box: '1',
              issue: 'Place of supply not recorded on some invoices',
              detail: `Invoices without a recorded emirate are attributed to ${DEFAULT_EMIRATE}, the company's own. Set Place of Supply on those invoices to report box 1 on recorded fact rather than a default.`,
              amountAffected: r2(unallocatedAmount),
            }]
          : []),
        ...(rcExpenses.length > 0
          ? [{
              box: '3 and 10',
              issue: 'Reverse charge computed from supplier country',
              detail: `${rcExpenses.length} purchase(s) from suppliers outside the UAE — ${[...new Set(rcExpenses.map(e => e.supplier?.name).filter(Boolean))].slice(0, 6).join(', ')}. Output VAT is declared in box 3 and the same amount recovered in box 10, so the two net to nil. Confirm each is a service rather than imported goods, which belong in box 6.`,
              amountAffected: reverseCharge.amount,
            }]
          : [{
              box: '3 and 10',
              issue: 'No reverse charge purchases identified',
              detail: 'No expense in the period is linked to a supplier whose country is outside the UAE. If foreign software subscriptions were paid by card without a supplier record, they are missing from the return.',
              amountAffected: 0,
            }]),
        ...(outOfScope > 0
          ? [{
              box: 'n/a',
              issue: 'Out-of-scope supplies excluded',
              detail: 'Supplies marked out of scope appear on no box of the return, which is correct, but the amount is shown here so it is not mistaken for an omission.',
              amountAffected: r2(outOfScope),
            }]
          : []),
      ],

      invoiceCount: new Set(items.map(i => i.invoice.invoiceNumber)).size,
      expenseCount: expenses.length,
    };
  }

  /** Output and input VAT for a period taken from the ledger accounts themselves. */
  private async ledgerVat(from: Date, to: Date) {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        entry: { status: 'POSTED', date: { gte: from, lte: to } },
        account: { code: { in: ['2100', '1200'] } },
      },
      include: { account: { select: { code: true } } },
    });

    let outputVat = 0;
    let inputVat = 0;
    for (const l of lines) {
      const net = Number(l.debit) - Number(l.credit);
      if (l.account.code === '2100') outputVat += -net; // liability: credit is positive
      else inputVat += net; // asset: debit is positive
    }
    return { outputVat: r2(outputVat), inputVat: r2(inputVat) };
  }

  /**
   * The company's tax periods.
   *
   * The VAT registration certificate sets them as 1 Jan–31 Mar, 1 Apr–30 Jun,
   * 1 Jul–30 Sep and 1 Oct–31 Dec — quarterly, aligned to the calendar. These are
   * not a convention chosen here; changing them would put the return out of step
   * with what the FTA expects to receive.
   */
  static quarters(year: number) {
    return [
      { quarter: 'Q1', from: `${year}-01-01`, to: `${year}-03-31` },
      { quarter: 'Q2', from: `${year}-04-01`, to: `${year}-06-30` },
      { quarter: 'Q3', from: `${year}-07-01`, to: `${year}-09-30` },
      { quarter: 'Q4', from: `${year}-10-01`, to: `${year}-12-31` },
    ];
  }

  /** All four quarterly returns for a year, plus the annual total. */
  async year(year: number) {
    const quarters = [];
    for (const q of Vat201Service.quarters(year)) {
      const r = await this.return201({ from: q.from, to: q.to });
      quarters.push({ quarter: q.quarter, ...r });
    }
    return {
      year,
      quarters,
      annual: {
        totalOutputTax: r2(quarters.reduce((s, q) => s + q.summary.totalOutputTax, 0)),
        totalInputTax: r2(quarters.reduce((s, q) => s + q.summary.totalInputTax, 0)),
        netVatDue: r2(quarters.reduce((s, q) => s + q.summary.netVatDue, 0)),
      },
    };
  }
}

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
