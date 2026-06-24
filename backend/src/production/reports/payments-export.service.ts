import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-FIN — Bank payment-file export (EXPORT ONLY; never initiates a transfer).
 * Builds a NACHA (ACH) file for US-routable payees, and a universal CSV batch for the rest
 * (IBAN/account — UAE/intl). Source = approved, unpaid vendor disbursements (AP payment run).
 */
import { n, padR, padL0, digits, abaCheckDigit } from './payments-export.util';

@Injectable()
export class PaymentsExportService {
  constructor(private prisma: PrismaService) {}

  /** Approved, unpaid COST transactions grouped by payee, with resolved banking + eligibility. */
  async eligible(projectId: string) {
    const txns = await this.prisma.projectTransaction.findMany({
      where: { projectId, kind: 'COST', status: 'APPROVED', paidDate: null },
      select: { id: true, vendorId: true, party: true, total: true, invoiceNumber: true, description: true },
    });
    const vendorIds = Array.from(new Set(txns.map(t => t.vendorId).filter(Boolean))) as string[];
    const suppliers = vendorIds.length ? await this.prisma.supplier.findMany({ where: { id: { in: vendorIds } } }) : [];
    const sup = new Map(suppliers.map((s: any) => [s.id, s]));

    const by = new Map<string, any>();
    for (const t of txns) {
      const key = t.vendorId || t.party || '—';
      const s: any = t.vendorId ? sup.get(t.vendorId) : null;
      const r = by.get(key) || by.set(key, {
        key, payee: (s?.name) || t.party || '—', vendorId: t.vendorId || null,
        amount: 0, count: 0, refs: [] as string[],
        bankName: s?.bankName || null, account: (s as any)?.bankAccount || null,
        iban: s?.iban || null, swift: s?.swiftCode || null, routing: (s as any)?.routingNumber || null,
      }).get(key);
      r.amount += n(t.total); r.count++; if (t.invoiceNumber) r.refs.push(t.invoiceNumber);
    }
    const rows = [...by.values()].map(r => ({
      ...r,
      achEligible: !!(digits(r.routing).length >= 8 && r.account),
      bankable: !!(r.account || r.iban),
    })).sort((a, b) => b.amount - a.amount);
    return {
      rows,
      totals: {
        payees: rows.length, amount: rows.reduce((t, r) => t + r.amount, 0),
        achEligible: rows.filter(r => r.achEligible).length,
        missingBank: rows.filter(r => !r.bankable).length,
      },
    };
  }

  // ABA check digit lives in payments-export.util.ts (abaCheckDigit) — pure + unit-tested.

  /** Generate a NACHA PPD credit file for ACH-eligible payees. Export only — upload to your bank. */
  async achFile(projectId: string, body: { odfiRouting?: string; companyName?: string; companyId?: string; effectiveDate?: string; entryDescription?: string } = {}) {
    const { rows } = await this.eligible(projectId);
    const elig = rows.filter(r => r.achEligible);
    const odfi = digits(body.odfiRouting).slice(0, 9).padStart(9, '0');
    const odfi8 = odfi.slice(0, 8);
    const companyName = padR(body.companyName || 'PRODUCTION CO', 16);
    const companyId = padR(body.companyId || ('1' + odfi8).slice(0, 10), 10);
    const now = new Date();
    const eff = body.effectiveDate ? new Date(body.effectiveDate) : new Date(now.getTime() + 86400000);
    const yymmdd = (d: Date) => `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const hhmm = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

    const lines: string[] = [];
    // 1 — File Header
    lines.push('101' + ' ' + odfi + ' ' + (companyId.trim().padStart(9, '0')).slice(0, 9) + yymmdd(now) + hhmm + 'A' + '094' + '10' + '1' + padR('RECEIVING BANK', 23) + padR(body.companyName || 'PRODUCTION CO', 23) + padR('', 8));
    // 5 — Batch Header (220 = credits only, PPD)
    lines.push('5' + '220' + companyName + padR('', 20) + companyId + 'PPD' + padR(body.entryDescription || 'VENDOR PAY', 10) + yymmdd(now) + yymmdd(eff) + padR('', 3) + '1' + odfi8 + padL0(1, 7));
    let hash = 0, totalCents = 0, seq = 0;
    for (const r of elig) {
      const rdfi9 = digits(r.routing).length >= 9 ? digits(r.routing).slice(0, 9) : (digits(r.routing).slice(0, 8) + abaCheckDigit(digits(r.routing)));
      const rdfi8 = rdfi9.slice(0, 8); const cd = rdfi9.slice(8, 9);
      const cents = Math.round(n(r.amount) * 100); totalCents += cents; hash += Number(rdfi8);
      seq++;
      const trace = odfi8 + padL0(seq, 7);
      lines.push('6' + '22' + rdfi8 + cd + padR(digits(r.account), 17) + padL0(cents, 10) + padR(r.vendorId || '', 15) + padR(r.payee, 22) + '  ' + '0' + trace);
    }
    const entryCount = elig.length;
    const hash10 = padL0(hash % 10000000000, 10);
    // 8 — Batch Control
    lines.push('8' + '220' + padL0(entryCount, 6) + hash10 + padL0(0, 12) + padL0(totalCents, 12) + companyId + padR('', 19) + padR('', 6) + odfi8 + padL0(1, 7));
    // 9 — File Control
    const batchCount = 1;
    let blockCount = Math.ceil((lines.length + 1) / 10);
    lines.push('9' + padL0(batchCount, 6) + padL0(blockCount, 6) + padL0(entryCount, 8) + hash10 + padL0(0, 12) + padL0(totalCents, 12) + padR('', 39));
    while (lines.length % 10 !== 0) lines.push('9'.repeat(94));

    const content = lines.join('\n') + '\n';
    return {
      format: 'NACHA-PPD', fileName: `ACH-${projectId.slice(-6)}-${yymmdd(now)}.ach`,
      content, included: entryCount, totalAmount: totalCents / 100,
      excluded: rows.filter(r => !r.achEligible).map(r => ({ payee: r.payee, amount: r.amount, reason: r.bankable ? 'no US routing (use CSV batch)' : 'no bank details' })),
    };
  }

  /** Universal CSV payment batch (IBAN/account) for payees the bank file can pay. */
  async csvBatch(projectId: string) {
    const { rows } = await this.eligible(projectId);
    const bankable = rows.filter(r => r.bankable);
    const esc = (v: any) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = ['Payee', 'Bank', 'IBAN', 'Account', 'SWIFT', 'Routing', 'Amount', 'Reference'];
    const out = [head.join(',')];
    for (const r of bankable) out.push([r.payee, r.bankName || '', r.iban || '', r.account || '', r.swift || '', r.routing || '', n(r.amount).toFixed(2), (r.refs || []).join(' ')].map(esc).join(','));
    return { format: 'CSV', fileName: `payments-${projectId.slice(-6)}.csv`, content: '﻿' + out.join('\n') + '\n', rows: bankable.length, totalAmount: bankable.reduce((t, r) => t + n(r.amount), 0) };
  }
}
