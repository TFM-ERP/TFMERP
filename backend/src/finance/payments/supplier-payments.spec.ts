import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { validateRecordPayment, RecordPaymentDto } from './supplier-payments.service';

const ok: RecordPaymentDto = { paidFrom: 'COMPANY_BANK', bankAccountId: 'b1', method: 'BANK_TRANSFER', paymentDate: '2026-09-22', amount: 100 };

describe('validateRecordPayment', () => {
  test('a company transfer from a company account is valid', () => assert.deepEqual(validateRecordPayment(ok, { bankOwnership: 'COMPANY' }), []));

  test('amount must be more than zero', () => {
    assert.ok(validateRecordPayment({ ...ok, amount: 0 }, { bankOwnership: 'COMPANY' }).length);
    assert.ok(validateRecordPayment({ ...ok, amount: -5 }, { bankOwnership: 'COMPANY' }).length);
  });

  test('fee cannot be negative', () => assert.ok(validateRecordPayment({ ...ok, feeAmount: -1 }, { bankOwnership: 'COMPANY' }).length));

  test('company bank needs a company account', () => {
    assert.ok(validateRecordPayment({ ...ok, bankAccountId: null }, { bankOwnership: null }).length);
    assert.ok(validateRecordPayment(ok, { bankOwnership: 'OWNER' }).length);
  });

  test('cash: method Cash, no bank account', () => {
    assert.deepEqual(validateRecordPayment({ ...ok, paidFrom: 'CASH_ON_HAND', bankAccountId: null, method: 'CASH' }, { bankOwnership: null }), []);
    assert.ok(validateRecordPayment({ ...ok, paidFrom: 'CASH_ON_HAND', bankAccountId: null, method: 'BANK_TRANSFER' }, { bankOwnership: null }).length);
    assert.ok(validateRecordPayment({ ...ok, paidFrom: 'CASH_ON_HAND', method: 'CASH' }, { bankOwnership: 'COMPANY' }).length);
  });

  test('paid personally: an owner account or none, never a company one', () => {
    assert.deepEqual(validateRecordPayment({ ...ok, paidFrom: 'OWNER', method: 'CARD', bankAccountId: null }, { bankOwnership: null }), []);
    assert.deepEqual(validateRecordPayment({ ...ok, paidFrom: 'OWNER', method: 'CARD' }, { bankOwnership: 'OWNER' }), []);
    assert.ok(validateRecordPayment({ ...ok, paidFrom: 'OWNER', method: 'CARD' }, { bankOwnership: 'COMPANY' }).length);
  });

  test('method Cash only for cash on hand', () => assert.ok(validateRecordPayment({ ...ok, method: 'CASH' }, { bankOwnership: 'COMPANY' }).length));

  test('date must be yyyy-mm-dd and real', () => {
    assert.ok(validateRecordPayment({ ...ok, paymentDate: '22/09/2026' }, { bankOwnership: 'COMPANY' }).length);
    assert.ok(validateRecordPayment({ ...ok, paymentDate: '2026-13-45' }, { bankOwnership: 'COMPANY' }).length);
    assert.ok(validateRecordPayment({ ...ok, paymentDate: '' }, { bankOwnership: 'COMPANY' }).length);
  });

  test('a whole card number is refused; last 4 is fine', () => {
    assert.ok(validateRecordPayment({ ...ok, payerAccountRef: '4111 1111 1111 1111' }, { bankOwnership: 'COMPANY' }).length);
    assert.deepEqual(validateRecordPayment({ ...ok, payerAccountRef: '3825' }, { bankOwnership: 'COMPANY' }), []);
    assert.deepEqual(validateRecordPayment({ ...ok, payerAccountRef: 'AE070331234567890123456' }, { bankOwnership: 'COMPANY' }), []);
  });

  test('every problem is reported at once, not one at a time', () => {
    assert.ok(validateRecordPayment({ ...ok, amount: 0, paymentDate: 'nope' }, { bankOwnership: 'COMPANY' }).length >= 2);
  });
});
