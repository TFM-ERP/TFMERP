/**
 * Which accounts a payment posts to. Pure, so the rule is tested on its own
 * (payment-posting.util.spec.ts) and postAll only wires it in.
 *
 * A supplier payment relieves 2000 Accounts Payable and credits wherever the money
 * came from: the company bank (1010), cash on hand (1000), or the GM personally
 * (2400 Owner Account — the company then owes him). A fee on the slip (Tamara,
 * transfer charge) is its own debit to 6500 Bank Charges.
 *
 * A customer receipt can carry a fee too — the merchant fee on a payment-link or card
 * receipt — and it runs the OTHER WAY. A supplier fee is paid ON TOP of the amount; a
 * merchant fee is DEDUCTED from what arrives:
 *
 *   supplier:  Dr 2000 amount · Dr 6500 fee · Cr source amount + fee
 *   receipt:   Dr 1010 amount − fee · Dr 6500 fee · Cr 1100 amount
 *
 * `amount` on a receipt is the GROSS the customer paid, so 1100 is relieved in full and the
 * invoice settles; only the bank line is smaller. Either sign, reversed, still balances —
 * which is why the spec tests both directions explicitly.
 *
 * Unresolved → null. postAll skips the payment and reports it rather than
 * assuming the bank, which is what it used to do for every payment.
 */
import { r2 as r2Fils } from '../finance/money.util';

export type PostablePayment = {
  direction: 'RECEIPT' | 'PAYMENT';
  amount: number;
  feeAmount: number | null;
  method: string;
  paidFrom: 'COMPANY_BANK' | 'CASH_ON_HAND' | 'OWNER' | null;
  bankOwnership: 'COMPANY' | 'OWNER' | null; // of payment.bankAccount; null when none
};
export type PostLine = { code: string; debit?: number; credit?: number; desc: string };

// The supplier path keeps this older rule: on negatives it rounds a half differently from r2Fils, and the supplier path must not move.
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
  if (p.direction !== 'PAYMENT') return receiptLines(p);
  const code = supplierPaymentCreditCode(p);
  if (!code) return null;
  const amount = r2(p.amount);
  const fee = p.feeAmount && p.feeAmount > 0 ? r2(p.feeAmount) : 0;
  const lines: PostLine[] = [{ code: '2000', debit: amount, desc: 'Accounts Payable' }];
  if (fee) lines.push({ code: '6500', debit: fee, desc: 'Bank / payment fee' });
  lines.push({ code, credit: r2(amount + fee), desc: CREDIT_DESC[code] });
  return lines;
}

/**
 * A customer receipt. With no fee it is exactly what it always was: Dr 1010 / Cr 1100 for the
 * amount. With a merchant fee the bank gets the amount less the fee and 6500 the fee; 1100 is
 * still credited the full gross. A fee that is not less than the amount cannot be posted —
 * nothing would have reached the bank — so it returns null, and postAll reports the payment
 * instead of posting it.
 */
function receiptLines(p: PostablePayment): PostLine[] | null {
  const fee = p.feeAmount && p.feeAmount > 0 ? r2Fils(p.feeAmount) : 0;
  if (!fee) {
    return [
      { code: '1010', debit: p.amount, desc: 'Bank' },
      { code: '1100', credit: p.amount, desc: 'Accounts Receivable' },
    ];
  }
  const amount = r2Fils(p.amount);
  if (fee >= amount) return null;
  return [
    { code: '1010', debit: r2Fils(amount - fee), desc: 'Bank' },
    { code: '6500', debit: fee, desc: 'Merchant fee' },
    { code: '1100', credit: amount, desc: 'Accounts Receivable' },
  ];
}
