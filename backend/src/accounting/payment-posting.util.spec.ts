import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { supplierPaymentCreditCode, paymentLines, PostablePayment, PostLine } from './payment-posting.util';

const base: PostablePayment = { direction: 'PAYMENT', amount: 100, feeAmount: null, method: 'BANK_TRANSFER', paidFrom: null, bankOwnership: null };

describe('supplierPaymentCreditCode — where the money came from', () => {
  test('company bank → 1010', () => assert.equal(supplierPaymentCreditCode({ ...base, paidFrom: 'COMPANY_BANK' }), '1010'));
  test('cash on hand → 1000', () => assert.equal(supplierPaymentCreditCode({ ...base, paidFrom: 'CASH_ON_HAND', method: 'CASH' }), '1000'));
  test('owner → 2400', () => assert.equal(supplierPaymentCreditCode({ ...base, paidFrom: 'OWNER', method: 'CARD' }), '2400'));
  test('paidFrom wins over the bank account', () => assert.equal(supplierPaymentCreditCode({ ...base, paidFrom: 'OWNER', bankOwnership: 'COMPANY' }), '2400'));
  test('no paidFrom, owner bank account → 2400', () => assert.equal(supplierPaymentCreditCode({ ...base, bankOwnership: 'OWNER' }), '2400'));
  test('no paidFrom, company bank account → 1010', () => assert.equal(supplierPaymentCreditCode({ ...base, bankOwnership: 'COMPANY' }), '1010'));
  test('no paidFrom, no account, cash → 1000', () => assert.equal(supplierPaymentCreditCode({ ...base, method: 'CASH' }), '1000'));
  test('unresolved → null, never guessed as bank', () => assert.equal(supplierPaymentCreditCode({ ...base }), null));
});

describe('paymentLines', () => {
  test('supplier payment with fee: Dr 2000 + Dr 6500 = Cr source', () => {
    assert.deepEqual(paymentLines({ ...base, paidFrom: 'COMPANY_BANK', amount: 2476.86, feeAmount: 26.03 }), [
      { code: '2000', debit: 2476.86, desc: 'Accounts Payable' },
      { code: '6500', debit: 26.03, desc: 'Bank / payment fee' },
      { code: '1010', credit: 2502.89, desc: 'Bank' },
    ]);
  });
  test('owner payment credits 2400', () => {
    assert.deepEqual(paymentLines({ ...base, paidFrom: 'OWNER', amount: 500 }), [
      { code: '2000', debit: 500, desc: 'Accounts Payable' },
      { code: '2400', credit: 500, desc: 'Owner Account — paid personally' },
    ]);
  });
  test('cash payment credits 1000', () => {
    assert.deepEqual(paymentLines({ ...base, paidFrom: 'CASH_ON_HAND', method: 'CASH', amount: 1650 }), [
      { code: '2000', debit: 1650, desc: 'Accounts Payable' },
      { code: '1000', credit: 1650, desc: 'Cash on Hand' },
    ]);
  });
  test('zero fee adds no line', () => assert.equal(paymentLines({ ...base, paidFrom: 'COMPANY_BANK', feeAmount: 0 })!.length, 2));
  test('receipt unchanged: Dr 1010 / Cr 1100', () => {
    assert.deepEqual(paymentLines({ ...base, direction: 'RECEIPT', amount: 50 }), [
      { code: '1010', debit: 50, desc: 'Bank' },
      { code: '1100', credit: 50, desc: 'Accounts Receivable' },
    ]);
  });
  test('unresolved supplier payment → null', () => assert.equal(paymentLines({ ...base }), null));
  test('lines always balance', () => {
    const l = paymentLines({ ...base, paidFrom: 'OWNER', amount: 898.5, feeAmount: 9.43 })!;
    const d = l.reduce((s, x) => s + (x.debit || 0), 0); const c = l.reduce((s, x) => s + (x.credit || 0), 0);
    assert.equal(Math.round(d * 100), Math.round(c * 100));
  });
});

/**
 * THE EXACT FAILURE THIS CATCHES: a merchant fee posted with the supplier's sign. Every one of
 * these mistakes still balances, so only an explicit test of the direction can see it:
 *   - bank debited amount + fee (the fee added, as a supplier fee is) — the bank is overstated
 *   - 1100 credited amount − fee (the fee netted off the receipt) — the invoice never settles
 *   - the fee credited instead of debited
 * Spec: docs/superpowers/specs/2026-10-14-payment-links-and-merchant-fees.md, group ii.
 */
const receipt = (amount: number, feeAmount: number | null): PostablePayment =>
  ({ direction: 'RECEIPT', amount, feeAmount, method: 'CARD', paidFrom: null, bankOwnership: null });
const line = (lines: any[], code: string) => {
  const found = lines.filter(l => l.code === code);
  assert.equal(found.length, 1, `expected one ${code} line, found ${found.length}`);
  return found[0];
};
const fils = (n: number | undefined) => Math.round((n || 0) * 100);

describe('paymentLines — the merchant fee on a RECEIPT is DEDUCTED', () => {
  test('the spec example: 5,250.00 paid on the link, 5,040.00 arrives — Dr 1010 5,040 · Dr 6500 210 · Cr 1100 5,250', () => {
    assert.deepEqual(paymentLines(receipt(5250, 210)), [
      { code: '1010', debit: 5040, desc: 'Bank' },
      { code: '6500', debit: 210, desc: 'Merchant fee' },
      { code: '1100', credit: 5250, desc: 'Accounts Receivable' },
    ]);
  });

  test('DIRECTION: the bank gets LESS than the amount — amount − fee, never amount + fee', () => {
    const l = paymentLines(receipt(5250, 210))!;
    assert.equal(line(l, '1010').debit, 5040);
    assert.notEqual(line(l, '1010').debit, 5460, 'the fee was added to the bank, as a supplier fee is');
    assert.ok(line(l, '1010').debit < 5250);
    assert.equal(line(l, '1010').credit, undefined);
  });

  test('DIRECTION: 1100 is relieved by the full GROSS, so the invoice settles — never amount − fee', () => {
    const l = paymentLines(receipt(5250, 210))!;
    assert.equal(line(l, '1100').credit, 5250);
    assert.notEqual(line(l, '1100').credit, 5040, 'the fee was netted off the receipt; the invoice would show 210 still owing');
    assert.equal(line(l, '1100').debit, undefined);
  });

  test('DIRECTION: the fee is a DEBIT to 6500 Bank Charges — a cost, never a credit', () => {
    const l = paymentLines(receipt(5250, 210))!;
    assert.equal(line(l, '6500').debit, 210);
    assert.equal(line(l, '6500').credit, undefined);
  });

  test('balances, and the three lines tie: bank + fee = receivable relieved', () => {
    for (const [amount, fee] of [[5250, 210], [100, 0.01], [0.02, 0.01], [12345.67, 493.83], [999999.99, 39999.99]]) {
      const l = paymentLines(receipt(amount, fee))!;
      const dr = l.reduce((s, x) => s + fils(x.debit), 0), cr = l.reduce((s, x) => s + fils(x.credit), 0);
      assert.equal(dr, cr, `${amount} / ${fee}`);
      assert.equal(fils(line(l, '1010').debit) + fils(line(l, '6500').debit), fils(line(l, '1100').credit), `${amount} / ${fee}`);
      assert.equal(fils(line(l, '1100').credit), fils(amount), `${amount} / ${fee}`);
    }
  });

  test('binary dust: 0.30 − 0.10 posts 0.20 to the bank, not 0.19999999999999998', () => {
    assert.equal(line(paymentLines(receipt(0.3, 0.1))!, '1010').debit, 0.2);
  });

  test('a fee equal to or larger than the amount cannot be posted → null, so postAll reports it', () => {
    assert.equal(paymentLines(receipt(210, 210)), null);
    assert.equal(paymentLines(receipt(210, 210.01)), null);
  });
});

describe('paymentLines — a RECEIPT with no fee posts exactly as it did before', () => {
  for (const fee of [null, 0, -5, 0.001]) {
    test(`fee ${fee}: Dr 1010 / Cr 1100 for the amount, two lines, no 6500`, () => {
      assert.deepEqual(paymentLines(receipt(5250, fee)), [
        { code: '1010', debit: 5250, desc: 'Bank' },
        { code: '1100', credit: 5250, desc: 'Accounts Receivable' },
      ]);
    });
  }
  test('the amount is passed through untouched, as before (not rounded)', () => {
    assert.deepEqual(paymentLines(receipt(0.1 + 0.2, null)), [
      { code: '1010', debit: 0.1 + 0.2, desc: 'Bank' },
      { code: '1100', credit: 0.1 + 0.2, desc: 'Accounts Receivable' },
    ]);
  });
  test('where the money went is not consulted for a receipt, as before', () => {
    for (const extra of [{ paidFrom: 'OWNER' as const }, { bankOwnership: 'OWNER' as const }, { method: 'CASH' }]) {
      assert.deepEqual(paymentLines({ ...receipt(50, null), ...extra }), [
        { code: '1010', debit: 50, desc: 'Bank' },
        { code: '1100', credit: 50, desc: 'Accounts Receivable' },
      ]);
    }
  });
});

/**
 * The supplier side must not move. This is the function as it was before the receipt fee,
 * copied verbatim, and every supplier input below must post identically under both.
 */
function supplierLinesBefore(p: PostablePayment): PostLine[] | null {
  const r2 = (n: number): number => Math.round(n * 100) / 100;
  const code = supplierPaymentCreditCode(p);
  if (!code) return null;
  const amount = r2(p.amount);
  const fee = p.feeAmount && p.feeAmount > 0 ? r2(p.feeAmount) : 0;
  const lines: PostLine[] = [{ code: '2000', debit: amount, desc: 'Accounts Payable' }];
  if (fee) lines.push({ code: '6500', debit: fee, desc: 'Bank / payment fee' });
  const CREDIT_DESC: Record<string, string> = { '1010': 'Bank', '1000': 'Cash on Hand', '2400': 'Owner Account — paid personally' };
  lines.push({ code, credit: r2(amount + fee), desc: CREDIT_DESC[code] });
  return lines;
}

describe('paymentLines — a SUPPLIER payment is unchanged: the fee is paid ON TOP', () => {
  test('DIRECTION: the source is credited amount + fee, never amount − fee', () => {
    const l = paymentLines({ ...base, paidFrom: 'COMPANY_BANK', amount: 5250, feeAmount: 210 })!;
    assert.equal(line(l, '1010').credit, 5460);
    assert.notEqual(line(l, '1010').credit, 5040, 'the fee was deducted, as a merchant fee is');
    assert.equal(line(l, '2000').debit, 5250);
    assert.equal(line(l, '6500').debit, 210);
  });

  test('every supplier input posts exactly as before the receipt fee existed', () => {
    let compared = 0;
    for (const paidFrom of ['COMPANY_BANK', 'CASH_ON_HAND', 'OWNER', null] as const)
      for (const bankOwnership of ['COMPANY', 'OWNER', null] as const)
        for (const method of ['BANK_TRANSFER', 'CASH', 'CARD', 'CHEQUE'])
          for (const amount of [0.01, 0.3, 100, 2476.86, 5250, 898.5, 0.1 + 0.2, 1e9 + 0.07])
            for (const feeAmount of [null, 0, -1, 0.004, 0.01, 26.03, 210, 9.43, 5250, 6000]) {
              const p: PostablePayment = { direction: 'PAYMENT', amount, feeAmount, method, paidFrom, bankOwnership };
              assert.deepEqual(paymentLines(p), supplierLinesBefore(p), JSON.stringify(p));
              compared++;
            }
    assert.equal(compared, 3840);
  });

  test('a supplier fee as large as the amount still posts, as before — the null rule is receipts only', () => {
    const l = paymentLines({ ...base, paidFrom: 'COMPANY_BANK', amount: 210, feeAmount: 210 })!;
    assert.equal(line(l, '1010').credit, 420);
  });
});

describe('the same fee, both directions, side by side', () => {
  test('5,250 with a 210 fee: the supplier\'s source pays 5,460; the receipt\'s bank receives 5,040', () => {
    const sup = paymentLines({ ...base, paidFrom: 'COMPANY_BANK', amount: 5250, feeAmount: 210 })!;
    const rec = paymentLines(receipt(5250, 210))!;
    assert.equal(line(sup, '1010').credit, 5460);
    assert.equal(line(rec, '1010').debit, 5040);
    assert.equal(line(sup, '6500').debit, line(rec, '6500').debit);
  });
});
