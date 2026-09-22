/**
 * Which accounts a payment posts to. Pure, so the rule is tested on its own
 * (payment-posting.util.spec.ts) and postAll only wires it in.
 *
 * A supplier payment relieves 2000 Accounts Payable and credits wherever the money
 * came from: the company bank (1010), cash on hand (1000), or the GM personally
 * (2400 Owner Account — the company then owes him). A fee on the slip (Tamara,
 * transfer charge) is its own debit to 6500 Bank Charges.
 *
 * Unresolved → null. postAll skips the payment and reports it rather than
 * assuming the bank, which is what it used to do for every payment.
 */
export type PostablePayment = {
  direction: 'RECEIPT' | 'PAYMENT';
  amount: number;
  feeAmount: number | null;
  method: string;
  paidFrom: 'COMPANY_BANK' | 'CASH_ON_HAND' | 'OWNER' | null;
  bankOwnership: 'COMPANY' | 'OWNER' | null; // of payment.bankAccount; null when none
};
export type PostLine = { code: string; debit?: number; credit?: number; desc: string };

const r2 = (n: number): number => Math.round(n * 100) / 100;

export function supplierPaymentCreditCode(p: PostablePayment): '1010' | '1000' | '2400' | null {
  if (p.paidFrom === 'COMPANY_BANK') return '1010';
  if (p.paidFrom === 'CASH_ON_HAND') return '1000';
  if (p.paidFrom === 'OWNER') return '2400';
  if (p.bankOwnership === 'OWNER') return '2400';
  if (p.bankOwnership === 'COMPANY') return '1010';
  if (p.method === 'CASH') return '1000';
  return null;
}

const CREDIT_DESC: Record<string, string> = { '1010': 'Bank', '1000': 'Cash on Hand', '2400': 'Owner Account — paid personally' };

export function paymentLines(p: PostablePayment): PostLine[] | null {
  if (p.direction !== 'PAYMENT') {
    return [
      { code: '1010', debit: p.amount, desc: 'Bank' },
      { code: '1100', credit: p.amount, desc: 'Accounts Receivable' },
    ];
  }
  const code = supplierPaymentCreditCode(p);
  if (!code) return null;
  const amount = r2(p.amount);
  const fee = p.feeAmount && p.feeAmount > 0 ? r2(p.feeAmount) : 0;
  const lines: PostLine[] = [{ code: '2000', debit: amount, desc: 'Accounts Payable' }];
  if (fee) lines.push({ code: '6500', debit: fee, desc: 'Bank / payment fee' });
  lines.push({ code, credit: r2(amount + fee), desc: CREDIT_DESC[code] });
  return lines;
}
