import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseSlipText } from './slip-parse.util';

describe('parseSlipText', () => {
  test('ProCash "payment credited beneficiary" e-mail', () => {
    const t = `Dear Customer,\nPayment Credited to Beneficiary\nTransaction Reference: 515169203\nValue Date: 26/07/2025\nAmount: AED 2,887.50\nBeneficiary Name: MACGREGOR FZ LLE\nBeneficiary Account: AE070331234567890123456\nDebit Account: 13328662820001\nPayment Remarks: ARTIST TRAILER 02072025`;
    const f = parseSlipText(t);
    assert.equal(f.reference, '515169203');
    assert.equal(f.date, '2025-07-26');
    assert.equal(f.amount, '2887.50');
    assert.equal(f.currency, 'AED');
    assert.equal(f.beneficiary, 'MACGREGOR FZ LLE');
    assert.equal(f.beneficiaryAccount, 'AE070331234567890123456');
    assert.equal(f.payerAccountRef, '13328662820001');
    assert.equal(f.remark, 'ARTIST TRAILER 02072025');
  });

  test('ADCB statement line O/W TRF — the full 9-digit reference, not the truncated copy', () => {
    const f = parseSlipText('07/04/2025 O/W TRF 465718721 65718721 07/04/2025 1,000.00');
    assert.equal(f.reference, '465718721');
    assert.equal(f.date, '2025-04-07');
    assert.equal(f.amount, '1000.00');
  });

  test('card slip: card last 4, fee, approval code', () => {
    const t = `TAMARA\nDate: 28-Jul-2025\nCard ending 3825\nTotal AED 2,502.89\nLate fee AED 26.03\nApproval code 993505`;
    const f = parseSlipText(t);
    assert.equal(f.date, '2025-07-28');
    assert.equal(f.amount, '2502.89');
    assert.equal(f.fee, '26.03');
    assert.equal(f.payerAccountRef, '3825');
    assert.equal(f.reference, '993505');
  });

  test('Arabic labels', () => {
    const t = `المبلغ: 4,336.50 درهم\nالتاريخ: 2025-09-30\nاسم المستفيد: AVEC EVENTS\nرقم المرجع: 545090663\nرسوم: 5.25`;
    const f = parseSlipText(t);
    assert.equal(f.amount, '4336.50');
    assert.equal(f.currency, 'AED');
    assert.equal(f.date, '2025-09-30');
    assert.equal(f.beneficiary, 'AVEC EVENTS');
    assert.equal(f.reference, '545090663');
    assert.equal(f.fee, '5.25');
  });

  test('a full card number is cut to its last 4 digits', () => {
    const f = parseSlipText('Card no 4111 2222 3333 4444\nAmount AED 10.00');
    assert.equal(f.payerAccountRef, '4444');
  });

  test('masked card number → last 4', () => {
    assert.equal(parseSlipText('Paid with card XXXX XXXX XXXX 2528\nAED 5.00').payerAccountRef, '2528');
  });

  // Real OCR output (tesseract eng+ara) of the ADCB ProCash app screenshot for AVEC, 30 Sep 2025.
  test('real: ProCash app screenshot (AVEC)', () => {
    const t = `10:10 & al TE\n‏بنك أبوظي التجاري‎ —\n> 4 PROCASH ‏08م‎ « & =\n© In Progress\n4,336.50 AED\nTO AVEC EVENTS\nON 30 SEP 2025\nFROM THE FILM MAKERS FZ LLC\nTransaction details A\nStatus IN PROGRESS\nCorporate reference MOB3009251010068791\nnumber 629\nBank reference number 545090663\nRemitting bank ABU DHABI\nname & address COMMERCIAL BANK\nDebit account title THE FILM MAKERS FZ LLC\nDebit account number 13328662820001\nDebit amount 4,336.50 AED\nTransfer fee SHA`;
    const f = parseSlipText(t);
    assert.equal(f.reference, '545090663');
    assert.equal(f.amount, '4336.50');
    assert.equal(f.currency, 'AED');
    assert.equal(f.date, '2025-09-30');
    assert.equal(f.beneficiary, 'AVEC EVENTS');
    assert.equal(f.payerAccountRef, '13328662820001');
    assert.equal(f.fee, undefined); // "SHA" is a charge option, not an amount
  });

  // Real OCR output of the saved-beneficiary screenshot for Tasawar (no amount or date on it).
  test('real: beneficiary screenshot (name line, then "To <IBAN>")', () => {
    const f = parseSlipText(`Tasawar Naveed Mubarik Ali\nTo AE080530000022186090001 ‏ص‎\n‎AL HILAL BANK`);
    assert.equal(f.beneficiary, 'Tasawar Naveed Mubarik Ali');
    assert.equal(f.beneficiaryAccount, 'AE080530000022186090001');
    assert.equal(f.amount, undefined);
  });

  test('nothing recognisable → empty object, no throw', () => {
    assert.deepEqual(parseSlipText('hello'), {});
    assert.deepEqual(parseSlipText(''), {});
  });
});
