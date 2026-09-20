import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { expenseAccountCode, keywordAccount, CATEGORY_ACCOUNTS } from './expense-mapping.util';

/** The 30 accounts seeded by STANDARD_COA. No mapping may target anything else. */
const SEEDED = [
  '1000', '1010', '1100', '1200', '1300', '1500', '1510',
  '2000', '2100', '2200', '2300',
  '3000', '3100', '3200',
  '4000', '4100', '4150', '4200',
  '5000', '5100', '5200', '5300',
  '6000', '6100', '6200', '6300', '6400', '6500', '6600', '6900',
];

describe('expenseAccountCode — the categories that exist in the data', () => {
  const cases: [string, string][] = [
    ['Production Costs', '5000'],
    ['Licence & Facilities', '6100'],
    ['Office', '6200'],
    ['Fuel', '5100'],
    ['Maintenance', '5200'],
    ['Printing', '6200'],
    ['Catering', '6200'],
    ['Software & Subscriptions', '6200'],
    ['BTL Travel & Living', '5300'],
    ['Miscellaneous General Exp', '6900'],
    ['Equipment', '6900'],
  ];
  for (const [category, code] of cases) {
    test(`${category} -> ${code}`, () => assert.equal(expenseAccountCode(category), code));
  }

  test('matching is case- and whitespace-insensitive', () => {
    assert.equal(expenseAccountCode('  production costs  '), '5000');
    assert.equal(expenseAccountCode('PRODUCTION COSTS'), '5000');
  });
});

describe('exact match beats the substring heuristics', () => {
  test('Licence & Facilities is not decided by a keyword', () => {
    // No keyword matches it, so only the explicit entry keeps it out of 6900.
    assert.equal(keywordAccount('licence & facilities'), null);
    assert.equal(expenseAccountCode('Licence & Facilities'), '6100');
  });

  test('a category the heuristics would mis-file is protected by its exact entry', () => {
    // 'equipment rental' contains "rent", so the heuristic sends it to
    // 6100 Rent & Utilities. That is the hazard the explicit table exists for.
    assert.equal(keywordAccount('Equipment Rental'), '6100');
    assert.equal(expenseAccountCode('Equipment'), '6900');
  });
});

describe('unclassified categories', () => {
  test('an unseen category still gets a sensible guess from the heuristics', () => {
    assert.equal(expenseAccountCode('Crew Payments'), '5300');
    assert.equal(expenseAccountCode('Bank Charges'), '6500');
    assert.equal(expenseAccountCode('Marketing Spend'), '6300');
  });

  test('a genuinely unknown category falls to 6900 rather than throwing', () => {
    assert.equal(expenseAccountCode('Something Invented Later'), '6900');
    assert.equal(expenseAccountCode(''), '6900');
    assert.equal(expenseAccountCode(null), '6900');
    assert.equal(expenseAccountCode(undefined), '6900');
  });
});

describe('every mapping targets an account that actually exists', () => {
  test('no CATEGORY_ACCOUNTS value is outside the seeded chart', () => {
    for (const [category, code] of Object.entries(CATEGORY_ACCOUNTS)) {
      assert.ok(SEEDED.includes(code), `${category} maps to ${code}, which is not seeded`);
    }
  });

  test('no heuristic result is outside the seeded chart', () => {
    for (const c of ['fuel', 'maintenance', 'crew', 'salary', 'rent', 'office', 'marketing', 'insurance', 'bank']) {
      const code = keywordAccount(c);
      assert.ok(code === null || SEEDED.includes(code), `${c} -> ${code}`);
    }
  });

  test('every mapped account is an expense account (5xxx or 6xxx)', () => {
    // Posting an expense to an asset or liability account would unbalance the
    // P&L and silently move cost onto the balance sheet.
    for (const [category, code] of Object.entries(CATEGORY_ACCOUNTS)) {
      assert.ok(/^[56]/.test(code), `${category} maps to ${code}, not an expense account`);
    }
  });
});
