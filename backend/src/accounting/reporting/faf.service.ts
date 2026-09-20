import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * The FTA Audit File (FAF).
 *
 * When the Federal Tax Authority opens a tax audit it asks for the records in a
 * prescribed format. Unlike the VAT return, which is summary level, the audit
 * file is produced at invoice level: every supply, every purchase and every
 * ledger line for the period, as a comma-separated file.
 *
 * Producing one is a requirement for software listed on the FTA's Tax Accounting
 * Software Register, and it is the requirement most small systems miss. It is
 * also the most useful thing this module can hand an auditor, because it is the
 * whole period in one file rather than a set of screens.
 *
 * The file has four sections, written in order: company information, the supply
 * (customer) listing, the purchase (supplier) listing, and the general ledger.
 */
@Injectable()
export class FafService {
  constructor(private prisma: PrismaService) {}

  /**
   * The audit file for a period as a CSV string.
   *
   * `company` carries the registration details the FTA header requires. Tax agent
   * fields are left blank when the company files its own returns, which is the
   * normal case for a small company.
   */
  async generate(args: {
    from: string;
    to: string;
    company: {
      nameEn: string;
      nameAr?: string;
      trn: string;
      taxAgencyName?: string;
      tan?: string;
      taxAgentName?: string;
      taan?: string;
    };
  }): Promise<{ filename: string; csv: string; counts: Record<string, number> }> {
    const from = new Date(args.from);
    const to = new Date(args.to);
    const rows: string[] = [];

    const c = args.company;

    // ── Section 1: company information ─────────────────────────────────────────
    rows.push('C,Taxable Person Name (English),Taxable Person Name (Arabic),TRN,Tax Agency Name,TAN,Tax Agent Name,TAAN,Period Start,Period End,Currency,Generated At');
    rows.push(
      [
        'C',
        q(c.nameEn),
        q(c.nameAr ?? ''),
        q(c.trn),
        q(c.taxAgencyName ?? ''),
        q(c.tan ?? ''),
        q(c.taxAgentName ?? ''),
        q(c.taan ?? ''),
        args.from,
        args.to,
        'AED',
        new Date().toISOString(),
      ].join(','),
    );

    // ── Section 2: supply (customer) listing, at line level ────────────────────
    const items = await this.prisma.invoiceItem.findMany({
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
            currency: true,
            client: { select: { companyName: true, trn: true } },
          },
        },
      },
      orderBy: [{ invoiceId: 'asc' }, { sortOrder: 'asc' }],
    });

    rows.push('');
    rows.push('S,Customer Name,Customer TRN,Invoice Date,Invoice Number,Line Number,Description,Tax Code,Amount (AED),VAT (AED),Currency,FC Amount,FC VAT');
    for (const [i, it] of items.entries()) {
      rows.push(
        [
          'S',
          q(it.invoice.client.companyName),
          q(it.invoice.client.trn ?? ''),
          d(it.invoice.issueDate),
          q(it.invoice.invoiceNumber),
          String(it.sortOrder ?? i),
          q(it.description),
          taxCode(it.taxRate?.vatType),
          n(it.lineTotal),
          n(it.taxAmount),
          q(it.invoice.currency),
          n(it.lineTotal),
          n(it.taxAmount),
        ].join(','),
      );
    }

    // ── Section 3: purchase (supplier) listing ─────────────────────────────────
    const expenses = await this.prisma.expense.findMany({
      where: { expenseDate: { gte: from, lte: to }, status: { in: ['APPROVED', 'PAID'] as any } },
      include: { supplier: { select: { name: true, trn: true } } },
      orderBy: { expenseDate: 'asc' },
    });

    rows.push('');
    rows.push('P,Supplier Name,Supplier TRN,Invoice Date,Invoice Number,Line Number,Description,Tax Code,Amount (AED),VAT (AED),Currency,FC Amount,FC VAT');
    for (const [i, e] of expenses.entries()) {
      const vat = Number(e.vatAmount ?? 0);
      rows.push(
        [
          'P',
          q(e.supplier?.name ?? e.vendorName ?? ''),
          // The supplier's own TRN is the one the FTA cross-matches. Fall back to
          // the VAT id captured on the expense when the supplier record has none.
          q(e.supplier?.trn ?? e.supplierVatId ?? ''),
          d(e.invoiceDate ?? e.expenseDate),
          // The supplier's own invoice number, not our internal expense number.
          q(e.invoiceNumber ?? e.expenseNumber),
          String(i),
          q(e.description ?? e.category ?? ''),
          vat > 0 ? 'SR' : 'OS',
          n(e.amount),
          n(vat),
          'AED',
          n(e.amount),
          n(vat),
        ].join(','),
      );
    }

    // ── Section 4: general ledger ──────────────────────────────────────────────
    const lines = await this.prisma.journalLine.findMany({
      where: { entry: { status: 'POSTED', date: { gte: from, lte: to } } },
      include: {
        account: { select: { code: true, name: true } },
        entry: { select: { entryNumber: true, date: true, memo: true, reference: true, sourceType: true } },
      },
      orderBy: [{ entry: { date: 'asc' } }, { sortOrder: 'asc' }],
    });

    rows.push('');
    rows.push('G,Transaction Date,Entry Number,Account Code,Account Name,Description,Reference,Source,Debit (AED),Credit (AED)');
    for (const l of lines) {
      rows.push(
        [
          'G',
          d(l.entry.date),
          q(l.entry.entryNumber),
          q(l.account.code),
          q(l.account.name),
          q(l.description ?? l.entry.memo ?? ''),
          q(l.entry.reference ?? ''),
          q(l.entry.sourceType ?? 'MANUAL'),
          n(l.debit),
          n(l.credit),
        ].join(','),
      );
    }

    const trn = c.trn.replace(/\D/g, '');
    const filename = `FAF_${trn}_${args.from.replace(/-/g, '')}_${args.to.replace(/-/g, '')}.csv`;

    return {
      filename,
      csv: rows.join('\n'),
      counts: { supplies: items.length, purchases: expenses.length, ledgerLines: lines.length },
    };
  }
}

/** Quote a CSV field, escaping embedded quotes. */
function q(v: string): string {
  const s = (v ?? '').toString().replace(/"/g, '""');
  return `"${s}"`;
}

/** A decimal as a plain two-place number, never with a thousands separator. */
function n(v: unknown): string {
  return Number(v ?? 0).toFixed(2);
}

/** A date as YYYY-MM-DD. */
function d(v: Date | string): string {
  return new Date(v).toISOString().slice(0, 10);
}

/**
 * The FTA tax code for a supply.
 *
 * SR standard rated, ZR zero rated, EX exempt, OS out of scope. These are the
 * codes the audit file expects, not the enum names used internally.
 */
function taxCode(vatType?: string | null): string {
  switch (vatType) {
    case 'ZERO_RATED': return 'ZR';
    case 'EXEMPT': return 'EX';
    case 'OUT_OF_SCOPE': return 'OS';
    default: return 'SR';
  }
}
