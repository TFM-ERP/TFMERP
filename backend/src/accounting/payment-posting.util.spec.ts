import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { supplierPaymentCreditCode, paymentLines, PostablePayment } from './payment-posting.util';

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
