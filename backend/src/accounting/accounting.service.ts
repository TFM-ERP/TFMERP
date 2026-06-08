import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

type GlType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

// Standard UAE SME chart of accounts (seed)
const STANDARD_COA: { code: string; name: string; type: GlType; subtype?: string; isBank?: boolean }[] = [
  // Assets
  { code: '1000', name: 'Cash on Hand', type: 'ASSET', subtype: 'Current Asset', isBank: true },
  { code: '1010', name: 'Bank — Current Account', type: 'ASSET', subtype: 'Current Asset', isBank: true },
  { code: '1100', name: 'Accounts Receivable', type: 'ASSET', subtype: 'Current Asset' },
  { code: '1200', name: 'Input VAT (Recoverable)', type: 'ASSET', subtype: 'Current Asset' },
  { code: '1300', name: 'Prepaid Expenses', type: 'ASSET', subtype: 'Current Asset' },
  { code: '1500', name: 'Rental Fleet & Equipment', type: 'ASSET', subtype: 'Fixed Asset' },
  { code: '1510', name: 'Accumulated Depreciation', type: 'ASSET', subtype: 'Fixed Asset' },
  // Liabilities
  { code: '2000', name: 'Accounts Payable', type: 'LIABILITY', subtype: 'Current Liability' },
  { code: '2100', name: 'Output VAT (Payable)', type: 'LIABILITY', subtype: 'Current Liability' },
  { code: '2200', name: 'Accrued Expenses', type: 'LIABILITY', subtype: 'Current Liability' },
  { code: '2300', name: 'Employee End-of-Service', type: 'LIABILITY', subtype: 'Long-term Liability' },
  // Equity
  { code: '3000', name: 'Owner Capital', type: 'EQUITY', subtype: 'Equity' },
  { code: '3100', name: 'Retained Earnings', type: 'EQUITY', subtype: 'Equity' },
  { code: '3200', name: 'Owner Drawings', type: 'EQUITY', subtype: 'Equity' },
  // Income
  { code: '4000', name: 'Rental Revenue', type: 'INCOME', subtype: 'Operating Income' },
  { code: '4100', name: 'Production Services Revenue', type: 'INCOME', subtype: 'Operating Income' },
  { code: '4200', name: 'Other Income', type: 'INCOME', subtype: 'Other Income' },
  // Expenses
  { code: '5000', name: 'Cost of Services', type: 'EXPENSE', subtype: 'Cost of Sales' },
  { code: '5100', name: 'Fuel & Transport', type: 'EXPENSE', subtype: 'Cost of Sales' },
  { code: '5200', name: 'Maintenance & Repairs', type: 'EXPENSE', subtype: 'Cost of Sales' },
  { code: '5300', name: 'Freelance & Crew Costs', type: 'EXPENSE', subtype: 'Cost of Sales' },
  { code: '6000', name: 'Salaries & Wages', type: 'EXPENSE', subtype: 'Operating Expense' },
  { code: '6100', name: 'Rent & Utilities', type: 'EXPENSE', subtype: 'Operating Expense' },
  { code: '6200', name: 'Office & Admin', type: 'EXPENSE', subtype: 'Operating Expense' },
  { code: '6300', name: 'Marketing & Advertising', type: 'EXPENSE', subtype: 'Operating Expense' },
  { code: '6400', name: 'Insurance', type: 'EXPENSE', subtype: 'Operating Expense' },
  { code: '6500', name: 'Bank Charges', type: 'EXPENSE', subtype: 'Operating Expense' },
  { code: '6600', name: 'Depreciation Expense', type: 'EXPENSE', subtype: 'Operating Expense' },
  { code: '6900', name: 'Other Expenses', type: 'EXPENSE', subtype: 'Operating Expense' },
  // Fringe / employer-burden expense accounts (production labor)
  { code: '5600', name: 'Fringe Benefits (Pension/Health/Union)', type: 'EXPENSE', subtype: 'Cost of Sales' },
  { code: '5610', name: 'Employer Payroll Taxes', type: 'EXPENSE', subtype: 'Cost of Sales' },
  { code: '5615', name: 'Unemployment Insurance', type: 'EXPENSE', subtype: 'Cost of Sales' },
  { code: '5620', name: "Workers' Compensation", type: 'EXPENSE', subtype: 'Cost of Sales' },
  { code: '5630', name: 'End-of-Service / Gratuity Provision', type: 'EXPENSE', subtype: 'Cost of Sales' },
  { code: '5690', name: 'Other Labor Burden', type: 'EXPENSE', subtype: 'Cost of Sales' },
  // Employer-burden liability accounts
  { code: '2350', name: 'Benefits & Union Payable', type: 'LIABILITY', subtype: 'Current Liability' },
  { code: '2360', name: 'Payroll Taxes Payable', type: 'LIABILITY', subtype: 'Current Liability' },
];

const TYPE_ORDER: Record<string, number> = { ASSET: 1, LIABILITY: 2, EQUITY: 3, INCOME: 4, EXPENSE: 5 };
const DEBIT_TYPES = ['ASSET', 'EXPENSE']; // normal debit balance

@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService) {}

  // ── Chart of Accounts ─────────────────────────────────────────────────────────

  async listAccounts(query: { type?: string; active?: string; bank?: string } = {}) {
    const where: any = {};
    if (query.active !== 'all') where.isActive = true;
    if (query.type) where.type = query.type;
    if (query.bank === 'true') where.isBank = true;
    const accounts = await this.prisma.glAccount.findMany({ where, orderBy: { code: 'asc' } });
    return accounts;
  }

  async getAccount(id: string) {
    const acc = await this.prisma.glAccount.findUnique({ where: { id } });
    if (!acc) throw new NotFoundException('Account not found');
    return acc;
  }

  async createAccount(data: { code: string; name: string; type: GlType; subtype?: string; description?: string; isBank?: boolean }) {
    if (!data.code || !data.name || !data.type) throw new BadRequestException('Code, name and type are required');
    const exists = await this.prisma.glAccount.findUnique({ where: { code: data.code } });
    if (exists) throw new BadRequestException(`Account code ${data.code} already exists`);
    return this.prisma.glAccount.create({ data: { ...data } });
  }

  async updateAccount(id: string, data: any) {
    await this.getAccount(id);
    const { id: _i, lines, bankAccount, createdAt, updatedAt, ...rest } = data || {};
    return this.prisma.glAccount.update({ where: { id }, data: rest });
  }

  async deleteAccount(id: string) {
    const used = await this.prisma.journalLine.count({ where: { accountId: id } });
    if (used > 0) throw new BadRequestException('Account has journal activity; deactivate it instead.');
    return this.prisma.glAccount.delete({ where: { id } });
  }

  async seedChartOfAccounts() {
    const count = await this.prisma.glAccount.count();
    if (count > 0) return { seeded: 0, message: 'Chart of accounts already has accounts.' };
    await this.prisma.glAccount.createMany({ data: STANDARD_COA });
    return { seeded: STANDARD_COA.length };
  }

  // ── Journal Entries ────────────────────────────────────────────────────────────

  private async nextEntryNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.prisma.documentSequence.upsert({
      where: { prefix: 'JE' },
      update: { lastNumber: { increment: 1 } },
      create: { prefix: 'JE', lastNumber: 1, year },
    });
    return `JE-${year}-${String(seq.lastNumber).padStart(4, '0')}`;
  }

  async listJournals(query: { status?: string; from?: string; to?: string } = {}) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.date = {};
      if (query.from) where.date.gte = new Date(query.from);
      if (query.to) where.date.lte = new Date(query.to);
    }
    const entries = await this.prisma.journalEntry.findMany({
      where,
      include: { lines: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    return entries.map(e => ({
      ...e,
      totalDebit: e.lines.reduce((s, l) => s + Number(l.debit), 0),
      totalCredit: e.lines.reduce((s, l) => s + Number(l.credit), 0),
    }));
  }

  async getJournal(id: string) {
    const e = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: { include: { account: { select: { code: true, name: true, type: true } } }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!e) throw new NotFoundException('Journal entry not found');
    return e;
  }

  private validateBalanced(lines: any[]) {
    if (!lines || lines.length < 2) throw new BadRequestException('A journal entry needs at least two lines.');
    const totalD = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalC = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    if (Math.round(totalD * 100) !== Math.round(totalC * 100)) {
      throw new BadRequestException(`Entry is out of balance: debits ${totalD.toFixed(2)} ≠ credits ${totalC.toFixed(2)}`);
    }
    if (totalD === 0) throw new BadRequestException('Entry total cannot be zero.');
  }

  async createJournal(data: { date: string; memo?: string; reference?: string; lines: any[]; post?: boolean }, userId?: string) {
    this.validateBalanced(data.lines);
    const entryNumber = await this.nextEntryNumber();
    return this.prisma.journalEntry.create({
      data: {
        entryNumber,
        date: new Date(data.date),
        memo: data.memo || null,
        reference: data.reference || null,
        status: data.post ? 'POSTED' : 'DRAFT',
        postedAt: data.post ? new Date() : null,
        createdById: userId || null,
        lines: {
          create: data.lines.map((l: any, i: number) => ({
            accountId: l.accountId,
            description: l.description || null,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            sortOrder: i,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async updateJournal(id: string, data: { date?: string; memo?: string; reference?: string; lines?: any[] }) {
    const e = await this.getJournal(id);
    if (e.status === 'POSTED') throw new BadRequestException('Posted entries cannot be edited. Void it instead.');
    if (data.lines) this.validateBalanced(data.lines);
    return this.prisma.$transaction(async (tx) => {
      if (data.lines) {
        await tx.journalLine.deleteMany({ where: { entryId: id } });
      }
      return tx.journalEntry.update({
        where: { id },
        data: {
          ...(data.date && { date: new Date(data.date) }),
          ...(data.memo !== undefined && { memo: data.memo }),
          ...(data.reference !== undefined && { reference: data.reference }),
          ...(data.lines && {
            lines: {
              create: data.lines.map((l: any, i: number) => ({
                accountId: l.accountId,
                description: l.description || null,
                debit: Number(l.debit) || 0,
                credit: Number(l.credit) || 0,
                sortOrder: i,
              })),
            },
          }),
        },
        include: { lines: true },
      });
    });
  }

  async postJournal(id: string) {
    const e = await this.getJournal(id);
    if (e.status === 'POSTED') return e;
    if (e.status === 'VOID') throw new BadRequestException('Voided entries cannot be posted.');
    this.validateBalanced(e.lines);
    return this.prisma.journalEntry.update({ where: { id }, data: { status: 'POSTED', postedAt: new Date() } });
  }

  async voidJournal(id: string) {
    const e = await this.getJournal(id);
    return this.prisma.journalEntry.update({ where: { id }, data: { status: 'VOID' } });
  }

  async deleteJournal(id: string) {
    const e = await this.getJournal(id);
    if (e.status === 'POSTED') throw new BadRequestException('Posted entries cannot be deleted. Void it instead.');
    return this.prisma.journalEntry.delete({ where: { id } });
  }

  // ── Reports ─────────────────────────────────────────────────────────────────────

  async trialBalance(query: { to?: string } = {}) {
    const where: any = { status: 'POSTED' };
    if (query.to) where.date = { lte: new Date(query.to) };
    const lines = await this.prisma.journalLine.findMany({
      where: { entry: where },
      include: { account: true },
    });
    const map: Record<string, any> = {};
    for (const l of lines) {
      const a = l.account;
      if (!map[a.id]) map[a.id] = { code: a.code, name: a.name, type: a.type, debit: 0, credit: 0 };
      map[a.id].debit += Number(l.debit);
      map[a.id].credit += Number(l.credit);
    }
    const rows = Object.values(map).map((r: any) => {
      const net = r.debit - r.credit;
      const debitBal = DEBIT_TYPES.includes(r.type) ? Math.max(net, 0) : Math.max(-net, 0);
      const creditBal = DEBIT_TYPES.includes(r.type) ? Math.max(-net, 0) : Math.max(net, 0);
      return { ...r, debitBalance: debitBal, creditBalance: creditBal };
    }).sort((a: any, b: any) => a.code.localeCompare(b.code));
    return {
      rows,
      totalDebit: rows.reduce((s: number, r: any) => s + r.debitBalance, 0),
      totalCredit: rows.reduce((s: number, r: any) => s + r.creditBalance, 0),
    };
  }

  async generalLedger(accountId: string, query: { from?: string; to?: string } = {}) {
    const account = await this.getAccount(accountId);
    const where: any = { accountId, entry: { status: 'POSTED' } };
    if (query.from || query.to) {
      where.entry.date = {};
      if (query.from) where.entry.date.gte = new Date(query.from);
      if (query.to) where.entry.date.lte = new Date(query.to);
    }
    const lines = await this.prisma.journalLine.findMany({
      where,
      include: { entry: { select: { entryNumber: true, date: true, memo: true, reference: true } } },
      orderBy: [{ entry: { date: 'asc' } }],
    });
    const isDebitAcct = DEBIT_TYPES.includes(account.type);
    let running = 0;
    const rows = lines.map(l => {
      running += isDebitAcct ? Number(l.debit) - Number(l.credit) : Number(l.credit) - Number(l.debit);
      return {
        date: l.entry.date, entryNumber: l.entry.entryNumber, memo: l.description || l.entry.memo,
        reference: l.entry.reference, debit: Number(l.debit), credit: Number(l.credit), balance: running,
      };
    });
    return { account, rows, closingBalance: running };
  }

  /** P&L + Balance-sheet style summary by type. */
  async financialSummary(query: { to?: string } = {}) {
    const tb = await this.trialBalance(query);
    const byType: Record<string, number> = { ASSET: 0, LIABILITY: 0, EQUITY: 0, INCOME: 0, EXPENSE: 0 };
    for (const r of tb.rows) {
      const net = DEBIT_TYPES.includes(r.type) ? r.debitBalance : r.creditBalance;
      byType[r.type] += net;
    }
    const netProfit = byType.INCOME - byType.EXPENSE;
    return { ...byType, netProfit };
  }

  // ── Bank Accounts + Reconciliation ──────────────────────────────────────────────

  async listBankAccounts() {
    const accts = await this.prisma.ledgerBankAccount.findMany({
      include: { glAccount: true },
      orderBy: { createdAt: 'asc' },
    });
    // attach current GL balance + uncleared count
    const out = [];
    for (const b of accts) {
      const gl = await this.generalLedger(b.glAccountId);
      const uncleared = await this.prisma.journalLine.count({
        where: { accountId: b.glAccountId, reconciled: false, entry: { status: 'POSTED' } },
      });
      out.push({ ...b, glBalance: gl.closingBalance, unclearedCount: uncleared });
    }
    return out;
  }

  async createBankAccount(data: { name: string; bankName?: string; accountNumber?: string; glAccountId: string }) {
    if (!data.name || !data.glAccountId) throw new BadRequestException('Name and GL account are required');
    const gl = await this.getAccount(data.glAccountId);
    await this.prisma.glAccount.update({ where: { id: gl.id }, data: { isBank: true } });
    return this.prisma.ledgerBankAccount.create({ data: { ...data } });
  }

  /** Lines available to clear for a bank GL account (posted, not yet reconciled). */
  async reconciliationWorkspace(bankAccountId: string) {
    const bank = await this.prisma.ledgerBankAccount.findUnique({ where: { id: bankAccountId }, include: { glAccount: true } });
    if (!bank) throw new NotFoundException('Bank account not found');
    const lines = await this.prisma.journalLine.findMany({
      where: { accountId: bank.glAccountId, entry: { status: 'POSTED' } },
      include: { entry: { select: { entryNumber: true, date: true, memo: true } } },
      orderBy: [{ entry: { date: 'asc' } }],
    });
    const isDebitAcct = DEBIT_TYPES.includes(bank.glAccount.type);
    const reconciledBalance = lines.filter(l => l.reconciled)
      .reduce((s, l) => s + (isDebitAcct ? Number(l.debit) - Number(l.credit) : Number(l.credit) - Number(l.debit)), 0);
    return {
      bank,
      reconciledBalance,
      lines: lines.map(l => ({
        id: l.id, date: l.entry.date, entryNumber: l.entry.entryNumber,
        memo: l.description || l.entry.memo, debit: Number(l.debit), credit: Number(l.credit),
        amount: isDebitAcct ? Number(l.debit) - Number(l.credit) : Number(l.credit) - Number(l.debit),
        reconciled: l.reconciled,
      })),
    };
  }

  async toggleClear(lineId: string, reconciled: boolean) {
    return this.prisma.journalLine.update({
      where: { id: lineId },
      data: { reconciled, reconciledAt: reconciled ? new Date() : null },
    });
  }

  async completeReconciliation(data: { bankAccountId: string; statementDate: string; statementBalance: number; clearedBalance: number }) {
    return this.prisma.bankReconciliation.create({
      data: {
        bankAccountId: data.bankAccountId,
        statementDate: new Date(data.statementDate),
        statementBalance: data.statementBalance,
        clearedBalance: data.clearedBalance,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }

  // ── Auto-posting to the GL ────────────────────────────────────────────────────
  private async accountMap() {
    const accts = await this.prisma.glAccount.findMany();
    const byCode: Record<string, string> = {};
    for (const a of accts) byCode[a.code] = a.id;
    return byCode;
  }

  private expenseAccountCode(category?: string): string {
    const c = (category || '').toLowerCase();
    if (c.includes('fuel') || c.includes('transport')) return '5100';
    if (c.includes('mainten') || c.includes('repair')) return '5200';
    if (c.includes('crew') || c.includes('freelan')) return '5300';
    if (c.includes('salar') || c.includes('wage') || c.includes('payroll')) return '6000';
    if (c.includes('rent') || c.includes('utilit')) return '6100';
    if (c.includes('office') || c.includes('admin')) return '6200';
    if (c.includes('market') || c.includes('advert')) return '6300';
    if (c.includes('insur')) return '6400';
    if (c.includes('bank')) return '6500';
    return '6900';
  }

  async postingStatus() {
    const map = await this.accountMap();
    const posted = await this.prisma.journalEntry.findMany({ where: { sourceType: { not: null } }, select: { sourceType: true, sourceId: true } });
    const done = new Set(posted.map(p => `${p.sourceType}:${p.sourceId}`));
    const [invoices, expenses, payments] = await Promise.all([
      this.prisma.invoice.findMany({ where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] as any } }, select: { id: true } }),
      this.prisma.expense.findMany({ where: { status: { in: ['APPROVED', 'PAID'] as any } }, select: { id: true } }),
      this.prisma.payment.findMany({ select: { id: true } }),
    ]);
    return {
      chartReady: Object.keys(map).length > 0,
      invoices: invoices.filter(i => !done.has(`INVOICE:${i.id}`)).length,
      expenses: expenses.filter(e => !done.has(`EXPENSE:${e.id}`)).length,
      payments: payments.filter(p => !done.has(`PAYMENT:${p.id}`)).length,
    };
  }

  private async je(date: Date, memo: string, sourceType: string, sourceId: string, lines: { code: string; debit?: number; credit?: number; desc?: string }[], map: Record<string, string>) {
    const resolved = lines.map(l => ({ ...l, accountId: map[l.code] }));
    if (resolved.some(l => !l.accountId)) return null;
    const totalD = resolved.reduce((s, l) => s + (l.debit || 0), 0);
    const totalC = resolved.reduce((s, l) => s + (l.credit || 0), 0);
    if (Math.round(totalD * 100) !== Math.round(totalC * 100) || totalD === 0) return null;
    const entryNumber = await this.nextEntryNumber();
    return this.prisma.journalEntry.create({
      data: {
        entryNumber, date, memo, source: 'SYSTEM', sourceType, sourceId, status: 'POSTED', postedAt: new Date(),
        lines: { create: resolved.map((l, i) => ({ accountId: l.accountId!, description: l.desc || null, debit: l.debit || 0, credit: l.credit || 0, sortOrder: i })) },
      },
    });
  }

  /** Generate journal entries for all unposted invoices, expenses and payments. Idempotent. */
  async postAll() {
    const map = await this.accountMap();
    if (Object.keys(map).length === 0) throw new BadRequestException('Seed the chart of accounts first.');
    const posted = await this.prisma.journalEntry.findMany({ where: { sourceType: { not: null } }, select: { sourceType: true, sourceId: true } });
    const done = new Set(posted.map(p => `${p.sourceType}:${p.sourceId}`));
    let invoices = 0, expenses = 0, payments = 0;

    const invs = await this.prisma.invoice.findMany({ where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] as any } } });
    for (const inv of invs) {
      if (done.has(`INVOICE:${inv.id}`)) continue;
      const total = Number(inv.total); const vat = Number(inv.vatAmount); const net = total - vat;
      const rev = inv.activity === 'PRODUCTION' ? '4100' : inv.activity === 'RENTAL' ? '4000' : '4200';
      if (await this.je(inv.issueDate || inv.createdAt, `Invoice ${inv.invoiceNumber}`, 'INVOICE', inv.id, [
        { code: '1100', debit: total, desc: 'Accounts Receivable' },
        { code: rev, credit: net, desc: 'Revenue' },
        { code: '2100', credit: vat, desc: 'Output VAT' },
      ], map)) invoices++;
    }

    const exps = await this.prisma.expense.findMany({ where: { status: { in: ['APPROVED', 'PAID'] as any } } });
    for (const e of exps) {
      if (done.has(`EXPENSE:${e.id}`)) continue;
      const amount = Number(e.amount); const vat = Number(e.vatAmount); const total = Number(e.totalAmount);
      if (await this.je(e.expenseDate || e.createdAt, `Expense ${e.expenseNumber}`, 'EXPENSE', e.id, [
        { code: this.expenseAccountCode(e.category), debit: amount, desc: e.category || 'Expense' },
        { code: '1200', debit: vat, desc: 'Input VAT' },
        { code: '2000', credit: total, desc: 'Accounts Payable' },
      ], map)) expenses++;
    }

    const pays = await this.prisma.payment.findMany();
    for (const p of pays) {
      if (done.has(`PAYMENT:${p.id}`)) continue;
      const amount = Number(p.amount);
      if (await this.je((p as any).paymentDate || p.createdAt, `Payment ${p.paymentNumber}`, 'PAYMENT', p.id, [
        { code: '1010', debit: amount, desc: 'Bank' },
        { code: '1100', credit: amount, desc: 'Accounts Receivable' },
      ], map)) payments++;
    }

    return { invoices, expenses, payments };
  }

  // ── Burden GL mapping ─────────────────────────────────────────────────────────
  private burdenExpenseCode(rateType: string): string {
    switch (rateType) {
      case 'EMPLOYER_TAX': case 'PAYROLL_TAX': return '5610';
      case 'UNEMPLOYMENT': return '5615';
      case 'WORKERS_COMP': return '5620';
      case 'STATUTORY_GRATUITY': return '5630';
      case 'PENSION': case 'HEALTH': case 'PENSION_HEALTH':
      case 'GUILD_CONTRIB': case 'UNION_DUES': case 'VACATION_PAY': case 'HOLIDAY_PAY':
        return '5600';
      default: return '5690';
    }
  }
  private burdenLiabilityCode(rateType: string): string {
    switch (rateType) {
      case 'EMPLOYER_TAX': case 'PAYROLL_TAX': case 'UNEMPLOYMENT': return '2360';
      case 'STATUTORY_GRATUITY': return '2300';
      default: return '2350';
    }
  }

  /** Ensure required GL accounts exist (for installs seeded before burden accounts were added). */
  private async ensureAccounts(codes: { code: string; name: string; type: GlType; subtype?: string }[]) {
    for (const c of codes) {
      const exists = await this.prisma.glAccount.findUnique({ where: { code: c.code } });
      if (!exists) await this.prisma.glAccount.create({ data: c as any });
    }
  }

  /**
   * Post employer-burden accrual journals for a budget version's frozen fringes.
   * One balanced entry: Dr burden-expense (by type) / Cr employer-liability (by type).
   * Idempotent & in-sync: replaces any prior FRINGE_BURDEN entry for this version.
   */
  async postProjectBurden(versionId: string) {
    await this.ensureAccounts([
      { code: '5600', name: 'Fringe Benefits (Pension/Health/Union)', type: 'EXPENSE' as GlType, subtype: 'Cost of Sales' },
      { code: '5610', name: 'Employer Payroll Taxes', type: 'EXPENSE' as GlType, subtype: 'Cost of Sales' },
      { code: '5615', name: 'Unemployment Insurance', type: 'EXPENSE' as GlType, subtype: 'Cost of Sales' },
      { code: '5620', name: "Workers' Compensation", type: 'EXPENSE' as GlType, subtype: 'Cost of Sales' },
      { code: '5630', name: 'End-of-Service / Gratuity Provision', type: 'EXPENSE' as GlType, subtype: 'Cost of Sales' },
      { code: '5690', name: 'Other Labor Burden', type: 'EXPENSE' as GlType, subtype: 'Cost of Sales' },
      { code: '2350', name: 'Benefits & Union Payable', type: 'LIABILITY' as GlType, subtype: 'Current Liability' },
      { code: '2360', name: 'Payroll Taxes Payable', type: 'LIABILITY' as GlType, subtype: 'Current Liability' },
    ]);

    const version = await this.prisma.budgetVersion.findUnique({
      where: { id: versionId },
      include: { project: { select: { projectNumber: true } }, sections: { include: { accounts: { include: { lineItems: { select: { fringeDetail: true } } } } } } },
    });
    if (!version) throw new BadRequestException('Budget version not found.');

    // Aggregate burden by GL expense/liability code from each line's fringeDetail
    const debits: Record<string, number> = {};
    const credits: Record<string, number> = {};
    for (const s of version.sections) {
      for (const a of s.accounts) {
        for (const li of a.lineItems) {
          const detail = (li.fringeDetail as any[]) || [];
          for (const d of detail) {
            const amt = Number(d.amount) || 0;
            if (amt <= 0) continue;
            const exp = d.glAccountCode || this.burdenExpenseCode(d.rateType);
            const liab = this.burdenLiabilityCode(d.rateType);
            debits[exp] = (debits[exp] || 0) + amt;
            credits[liab] = (credits[liab] || 0) + amt;
          }
        }
      }
    }
    const totalBurden = Object.values(debits).reduce((s, n) => s + n, 0);
    if (totalBurden <= 0) throw new BadRequestException('No burden to post. Apply fringes on the Fringe Detail tab first.');

    const map = await this.accountMap();
    // replace prior entry for this version
    const existing = await this.prisma.journalEntry.findFirst({ where: { sourceType: 'FRINGE_BURDEN', sourceId: versionId } });
    if (existing) await this.prisma.journalEntry.delete({ where: { id: existing.id } });

    const lines = [
      ...Object.entries(debits).map(([code, amt]) => ({ code, debit: Math.round(amt * 100) / 100, desc: 'Labor burden expense' })),
      ...Object.entries(credits).map(([code, amt]) => ({ code, credit: Math.round(amt * 100) / 100, desc: 'Employer burden payable' })),
    ];
    const entry = await this.je(new Date(), `Labor burden accrual — ${version.project.projectNumber} (${version.versionName})`, 'FRINGE_BURDEN', versionId, lines, map);
    if (!entry) throw new BadRequestException('Could not post — chart of accounts incomplete or entry unbalanced.');
    return { posted: true, totalBurden: Math.round(totalBurden * 100) / 100, byExpense: debits };
  }
}
