/**
 * Payment slip text → fields. Pure; never throws; a field it cannot find is left out.
 *
 * Input is the text of a slip — a ProCash "payment credited beneficiary" e-mail, a bank
 * app screenshot, a card receipt, the GM's personal-account transfer slip — after OCR
 * (or a PDF's text layer). English and Arabic labels. The record-payment form shows
 * every field for checking before anything is saved, so the rules aim to be right
 * when they answer rather than to answer everything.
 *
 * Dates come back as yyyy-mm-dd, amounts as plain decimals ("2887.50").
 * Card numbers are never kept whole: only the last 4 digits.
 */
export type SlipField = 'date' | 'amount' | 'currency' | 'reference' | 'beneficiary' | 'beneficiaryAccount' | 'payerAccountRef' | 'remark' | 'fee';
export type SlipFields = Partial<Record<SlipField, string>>;

const MONTHS: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
const AMT = '([0-9]{1,3}(?:[,\\s][0-9]{3})*(?:\\.[0-9]{1,2})?|[0-9]+(?:\\.[0-9]{1,2})?)';
const DATE = '(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/.]\\d{1,2}[/.]\\d{4}|\\d{1,2}[- ][A-Za-z]{3,9}[- ,]+\\d{4})';

const money = (s: string): string | undefined => {
  const n = Number(s.replace(/[,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : undefined;
};

function labelled(text: string, labels: string[], value: string): RegExpMatchArray | null {
  for (const l of labels) {
    const m = text.match(new RegExp(`(?:${l})\\s*[:：-]?\\s*${value}`, 'i'));
    if (m) return m;
  }
  return null;
}

function toIso(s: string): string | undefined {
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3})[A-Za-z]*[- ,]+(\d{4})$/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}`;
  return undefined;
}

/** Last 4 digits on a "card …" line, whether the number is masked or printed whole. */
function cardLast4(text: string): string | undefined {
  const line = text.match(/card[^\n]*/i)?.[0];
  if (!line) return undefined;
  const groups = line.match(/\d{4,}/g);
  if (!groups) return undefined;
  const last = groups[groups.length - 1];
  return last.slice(-4);
}

export function parseSlipText(raw: string): SlipFields {
  const text = (raw || '').replace(/\r/g, '');
  const f: SlipFields = {};
  if (!text.trim()) return f;
  const line = (labels: string[]): string | undefined => {
    const m = labelled(text, labels, '([^\\n]+)');
    return m ? m[1].trim() : undefined;
  };

  // Reference: ADCB "O/W TRF <9 digits>" first (the second number ADCB prints is a truncated copy),
  // then labelled references, then card approval codes.
  const owt = text.match(/O\/W TRF\s+(\d{8,9})\b/);
  // ProCash prints both a corporate reference and the bank reference; the bank's is the one on the statement.
  const refL = labelled(text, ['Bank reference number', 'Bank reference', 'Transaction Reference', 'Customer Reference', 'Reference No\\.?', 'Reference', 'Ref\\.? No\\.?', 'رقم المرجع', 'المرجع'], '([A-Z0-9-]{6,20})');
  const appr = labelled(text, ['Approval code', 'Auth(?:orisation|orization)? code', 'Approval'], '([0-9A-Z]{6,8})');
  const ref = owt?.[1] || refL?.[1] || appr?.[1];
  if (ref) f.reference = ref;

  // Amount: a labelled total or amount, else "AED x", else a trailing statement amount.
  const amtM = labelled(text, ['Total Amount', 'Total', 'Transfer Amount', 'Amount', 'المبلغ'], `(?:AED\\s*)?${AMT}`)
    || text.match(new RegExp(`AED\\s*${AMT}`, 'i'))
    || text.match(new RegExp(`\\s${AMT}\\s*$`));
  const amt = amtM ? money(amtM[1]) : undefined;
  if (amt) f.amount = amt;
  if (/\bAED\b|درهم/.test(text)) f.currency = 'AED';
  else if (/\bUSD\b|\$/.test(text)) f.currency = 'USD';

  const feeM = labelled(text, ['Late fee', 'Charges', 'Fee', 'رسوم'], `(?:AED\\s*)?${AMT}`);
  const fee = feeM ? money(feeM[1]) : undefined;
  if (fee) f.fee = fee;

  // Dates: labelled; ProCash's "ON 30 SEP 2025" line; any dd/mm/yyyy; any "30 Sep 2025".
  const dateL = labelled(text, ['Value Date', 'Transaction Date', 'Date', 'التاريخ'], DATE);
  const dateOn = text.match(/^ON\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\s*$/m);
  const dateAny = text.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/) || text.match(/\b(\d{1,2}[- ][A-Za-z]{3,9}[- ]\d{4})\b/);
  const d = toIso((dateL?.[1] || dateOn?.[1] || dateAny?.[1] || '').trim());
  if (d) f.date = d;

  // Beneficiary: labelled; ProCash's "TO <NAME>" line (not "TO <IBAN>"); or the name line above "To <IBAN>".
  const toIban = text.match(/(?:^|\n)([^\n]*)\n\s*To\s+(AE\d{21})\b/i) || text.match(/^\s*To\s+(AE\d{21})\b/im);
  const toName = text.match(/^TO\s+(?!AE\d{21})([A-Z0-9][^\n]{1,80})$/m);
  const ben = line(['Beneficiary Name', 'Beneficiary', 'Paid to', 'اسم المستفيد', 'المستفيد'])
    || toName?.[1].trim()
    || (toIban && toIban.length === 3 && toIban[1].trim() && !/\d{6,}/.test(toIban[1]) ? toIban[1].replace(/[\u200e\u200f]/g, '').trim() : undefined);
  if (ben) f.beneficiary = ben;
  const benAcc = labelled(text, ['Beneficiary (?:Account|IBAN)', 'Beneficiary A/C', 'IBAN'], '(AE\\d{21}|\\d{10,16})');
  if (benAcc) f.beneficiaryAccount = benAcc[1];
  else if (toIban) f.beneficiaryAccount = toIban[toIban.length - 1];

  const payer = labelled(text, ['Debit account number', 'Debit Account', 'From Account', 'Debited from'], '(AE\\d{21}|\\d{10,16})');
  const card = payer ? undefined : cardLast4(text);
  if (payer) f.payerAccountRef = payer[1];
  else if (card) f.payerAccountRef = card;

  const rem = line(['Payment Remarks', 'Remarks', 'Purpose', 'Narration', 'الغرض']);
  if (rem) f.remark = rem;
  return f;
}
