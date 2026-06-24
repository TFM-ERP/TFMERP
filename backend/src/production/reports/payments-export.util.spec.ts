/** NACHA/ACH pure helpers — unit tests (node:test + ts-node). Run: npm run test:unit */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { n, padR, padL0, digits, abaCheckDigit } from './payments-export.util';

test('abaCheckDigit matches the 9th digit of real published routing numbers', () => {
  assert.equal(abaCheckDigit('12100035'), '8'); // 121000358 Bank of America
  assert.equal(abaCheckDigit('02100002'), '1'); // 021000021 JPMorgan Chase
  assert.equal(abaCheckDigit('12104288'), '2'); // 121042882 Wells Fargo
  assert.equal(abaCheckDigit('01100001'), '5'); // 011000015 FRB Boston
});

test('abaCheckDigit tolerates separators and short input (left-pads to 8)', () => {
  assert.equal(abaCheckDigit('1-2-1-0-0-0-3-5'), '8');
  assert.equal(abaCheckDigit('35'), abaCheckDigit('00000035'));
});

test('padR right-pads with spaces and truncates to the field width', () => {
  assert.equal(padR('abc', 5), 'abc  ');
  assert.equal(padR('abcdef', 3), 'abc');
  assert.equal(padR(null, 2), '  ');
});

test('padL0 zero-pads rounded amounts, keeping the rightmost width', () => {
  assert.equal(padL0(7, 4), '0007');
  assert.equal(padL0(1234567, 4), '4567');
  assert.equal(padL0(12.7, 3), '013');
});

test('digits strips non-numerics; n coerces safely', () => {
  assert.equal(digits('12-34 ab56'), '123456');
  assert.equal(n('5'), 5);
  assert.equal(n('abc'), 0);
  assert.equal(n(null), 0);
});
