import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  sectionFor,
  presentedAmount,
  cashFlowClassFor,
  isAccumulatedDepreciation,
  round2,
  sum2,
} from './statement-lines.util';

describe('sectionFor — every seeded account lands somewhere sensible', () => {
  test('maps the subtypes STANDARD_COA actually uses', () => {
    assert.equal(sectionFor('ASSET', 'Current Asset'), 'CURRENT_ASSET');
    assert.equal(sectionFor('ASSET', 'Fixed Asset'), 'NON_CURRENT_ASSET');
    assert.equal(sectionFor('LIABILITY', 'Current Liability'), 'CURRENT_LIABILITY');
    assert.equal(sectionFor('LIABILITY', 'Long-term Liability'), 'NON_CURRENT_LIABILITY');
    assert.equal(sectionFor('EQUITY', 'Equity'), 'EQUITY');
    assert.equal(sectionFor('INCOME', 'Operating Income'), 'REVENUE');
    assert.equal(sectionFor('INCOME', 'Other Income'), 'OTHER_INCOME');
    assert.equal(sectionFor('EXPENSE', 'Cost of Sales'), 'COST_OF_SALES');
    assert.equal(sectionFor('EXPENSE', 'Operating Expense'), 'OPERATING_EXPENSE');
  });

  test('ignores case and surrounding space', () => {
    assert.equal(sectionFor('ASSET', '  FIXED ASSET '), 'NON_CURRENT_ASSET');
  });

  /**
   * A user-created account with no subtype must still appear on the statements.
   * Falling through to nothing would drop it silently, which is the one failure
   * that cannot be spotted by reading the output.
   */
  test('falls back to the account type rather than dropping the account', () => {
    assert.equal(sectionFor('ASSET', null), 'CURRENT_ASSET');
    assert.equal(sectionFor('EXPENSE', 'Something Nobody Classified'), 'OPERATING_EXPENSE');
    assert.equal(sectionFor('INCOME', ''), 'REVENUE');
  });
});

describe('presentedAmount — the figure as it should read', () => {
  test('assets and expenses read positive on a debit balance', () => {
    assert.equal(presentedAmount('ASSET', 1000, 0), 1000);
    assert.equal(presentedAmount('EXPENSE', 500, 100), 400);
  });

  test('liabilities, equity and income read positive on a credit balance', () => {
    assert.equal(presentedAmount('LIABILITY', 0, 1000), 1000);
    assert.equal(presentedAmount('INCOME', 0, 250), 250);
    assert.equal(presentedAmount('EQUITY', 100, 1100), 1000);
  });

  /**
   * Accumulated depreciation is an asset account carrying a credit balance. It
   * must read negative so it reduces the non-current asset total it sits in.
   */
  test('a contra asset reads negative', () => {
    assert.equal(presentedAmount('ASSET', 0, 30000), -30000);
  });
});

describe('cashFlowClassFor — where a balance sheet movement belongs', () => {
  test('cash and bank are the subject of the statement, not a movement in it', () => {
    assert.equal(cashFlowClassFor('CURRENT_ASSET', true, '1010'), 'CASH');
    assert.equal(cashFlowClassFor('CURRENT_ASSET', false, '1000'), 'CASH');
    assert.equal(cashFlowClassFor('CURRENT_ASSET', false, '1010'), 'CASH');
  });

  test('non-current assets are investing', () => {
    assert.equal(cashFlowClassFor('NON_CURRENT_ASSET', false, '1500'), 'INVESTING');
  });

  test('equity and long-term liabilities are financing', () => {
    assert.equal(cashFlowClassFor('EQUITY', false, '3000'), 'FINANCING');
    assert.equal(cashFlowClassFor('NON_CURRENT_LIABILITY', false, '2300'), 'FINANCING');
  });

  /**
   * The owner's loan account sits in current liabilities but is owner funding,
   * not a trading balance. Classifying it as operating would put the owner's
   * money into cash generated from trading.
   */
  test('the owner account is financing despite sitting in liabilities', () => {
    assert.equal(cashFlowClassFor('CURRENT_LIABILITY', false, '2400'), 'FINANCING');
  });

  test('working capital is operating', () => {
    assert.equal(cashFlowClassFor('CURRENT_ASSET', false, '1100'), 'OPERATING');
    assert.equal(cashFlowClassFor('CURRENT_LIABILITY', false, '2000'), 'OPERATING');
  });
});

describe('isAccumulatedDepreciation', () => {
  test('matches the standard code', () => {
    assert.equal(isAccumulatedDepreciation('1510', 'Accumulated Depreciation'), true);
  });

  test('matches a company-created account by name', () => {
    assert.equal(isAccumulatedDepreciation('1520', 'Accumulated Depreciation — Vehicles'), true);
    assert.equal(isAccumulatedDepreciation('1530', 'Accumulated Amortisation'), true);
  });

  test('does not match the depreciation expense account', () => {
    assert.equal(isAccumulatedDepreciation('6600', 'Depreciation Expense'), false);
  });
});

describe('rounding', () => {
  test('round2 does not drift', () => {
    assert.equal(round2(0.1 + 0.2), 0.3);
    assert.equal(round2(1.005), 1.01);
  });

  test('sum2 totals at two places', () => {
    assert.equal(sum2([0.1, 0.2, 0.3]), 0.6);
    assert.equal(sum2([]), 0);
  });
});
