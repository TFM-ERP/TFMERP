# Supplier payments — paid-from, slip reading, record-payment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every supplier payment records where the money came from (company bank, cash, GM personally), can be entered from an attached slip that the system reads, and posts to the right ledger account.

**Architecture:** Additive Prisma migration (`Payment.paidFrom/feeAmount/beneficiary/beneficiaryAccount/payerAccountRef`, `BankAccount.ownership/cardLast4`). A pure `paymentCreditAccount()` decides the credit side in `postAll`. A pure `parseSlipText()` extracts fields from OCR text; a `SlipReaderService` wraps OCR (tesseract.js / pdf-parse, already installed) + AI fallback (`AiService.json`). A `SupplierPaymentsService` records a payment, its slip and its journal entry in one transaction. The expense screen gets a Payments block and a Record-payment drawer.

**Tech Stack:** NestJS 10, Prisma 5 (PostgreSQL), Next.js (app router), node:test via `npm test` (ts-node).

**Spec:** `docs/superpowers/specs/2026-09-22-supplier-payments-paid-from-and-slips-design.md`

## Global Constraints

- No new dependencies. Use tesseract.js, pdf-parse, pdfjs-dist already in backend/package.json.
- Max 3 files altered per step (per turn); present, wait for the GM's confirmation before the next task.
- Schema: hand-written migration under `backend/prisma/migrations/`; never `prisma db push`; apply only when the GM says "apply"; then `npx prisma generate`.
- Never start or restart the backend. Production DB is the single source of truth. Backup (`pg_dump -Fc`, 295 TABLE DATA) before every DB write.
- After every DB-writing step: trial balance 0.00; 2025 result (49,010.13) unchanged unless the step posts a new payment.
- Receipts (direction RECEIPT) keep posting exactly as today.
- Card numbers: last 4 digits only, never a full card number.
- The slip image never leaves the server; only OCR text may go to the AI, and only when amount, date or reference is missing.
- Commit trailer: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01HKpa2XEbVq7NwTMCAFyFXT`.

## File map

| File | Responsibility | Task |
|---|---|---|
| `backend/prisma/migrations/20260922100000_payment_paid_from_slips/migration.sql` | new enums + columns | 1 |
| `backend/prisma/schema.prisma` | mirror of the migration | 1 |
| `backend/src/accounting/payment-posting.util.ts` (+ `.spec.ts`) | pure credit-account + lines rule | 2 |
| `backend/src/accounting/accounting.service.ts` | postAll uses the util | 2 |
| `backend/src/common/ocr.util.ts` | shared OCR (moved from script-import) | 3 |
| `backend/src/finance/payments/slip-parse.util.ts` (+ `.spec.ts`) | pure text → fields | 3 |
| `backend/src/finance/payments/slip-reader.service.ts` | OCR + rules + AI fallback + suggestions | 4 |
| `backend/src/finance/payments/supplier-payments.service.ts` (+ `.spec.ts` for validation) | record payment transaction | 5 |
| `backend/src/finance/payments/payments.controller.ts`, `payments.module.ts` | routes | 4, 5 |
| `frontend/src/components/finance/ExpensePayments.tsx` | payments block + drawer | 6 |
| `frontend/src/app/(dashboard)/finance/expenses/page.tsx` (or the expense detail it opens) | mount the block | 6 |
| `backend/prisma/backfill-paid-from-2025.ts` | fill paidFrom/feeAmount on 64 rows | 7 |

---

### Task 1: Migration + schema (review, then apply on "apply")

**Files:**
- Create: `backend/prisma/migrations/20260922100000_payment_paid_from_slips/migration.sql`
- Modify: `backend/prisma/schema.prisma` (enums near `enum PaymentMethod`; `model Payment`; `model BankAccount`)

**Interfaces:** Produces `PaymentSource { COMPANY_BANK, CASH_ON_HAND, OWNER }`, `AccountOwnership { COMPANY, OWNER }`, `Payment.paidFrom?`, `Payment.feeAmount?`, `Payment.beneficiary?`, `Payment.beneficiaryAccount?`, `Payment.payerAccountRef?`, `BankAccount.ownership`, `BankAccount.cardLast4?`, index `payments(reference)`.

- [ ] **Step 1: Write the migration**

```sql
-- Supplier payments: where the money came from, fee, and what the slip printed.
CREATE TYPE "PaymentSource" AS ENUM ('COMPANY_BANK', 'CASH_ON_HAND', 'OWNER');
CREATE TYPE "AccountOwnership" AS ENUM ('COMPANY', 'OWNER');

ALTER TABLE "payments"
  ADD COLUMN "paidFrom" "PaymentSource",
  ADD COLUMN "feeAmount" DECIMAL(15,2),
  ADD COLUMN "beneficiary" TEXT,
  ADD COLUMN "beneficiaryAccount" TEXT,
  ADD COLUMN "payerAccountRef" TEXT;

CREATE INDEX "payments_reference_idx" ON "payments"("reference");

ALTER TABLE "bank_accounts"
  ADD COLUMN "ownership" "AccountOwnership" NOT NULL DEFAULT 'COMPANY',
  ADD COLUMN "cardLast4" TEXT;
```

- [ ] **Step 2: Mirror in schema.prisma**

```prisma
enum PaymentSource {
  COMPANY_BANK
  CASH_ON_HAND
  OWNER // paid personally by the GM — credits 2400 Owner Account
}

enum AccountOwnership {
  COMPANY
  OWNER // the GM's personal account; never offered on invoices/quotations
}
```
In `model Payment`, after `reference`/`notes`:
```prisma
  paidFrom           PaymentSource? // PAYMENT direction only
  feeAmount          Decimal?       @db.Decimal(15, 2) // fee on the slip → 6500
  beneficiary        String? // as printed on the slip
  beneficiaryAccount String? // IBAN / account as printed
  payerAccountRef    String? // payer IBAN or card last 4 as printed

  @@index([reference])
```
(keep the existing `@@map("payments")` as the last line). In `model BankAccount`, after `isDefaultReceiving`:
```prisma
  ownership AccountOwnership @default(COMPANY)
  cardLast4 String? // last 4 digits only
```

- [ ] **Step 3: Cross-check only (never use the output as the migration — `handoff/schema-coordination.md` rule 2)**

Run (from `backend/`): `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`
Expected before applying: the same statements as the hand-written file, plus a DROP of `script_revisions` "checks"/"consumed" — that belongs to the scripton branch and must NOT go into our migration. Also `npx prisma validate` passes.
Confirm with the GM that the scripton branch is not applying a migration at the same time (rule 5).

- [ ] **Step 4: Stop. Show the GM the SQL. Wait for "apply".**

- [ ] **Step 5 (after "apply"): backup, apply, generate**

```bash
cd /Users/qandil/Projects/TFM-System/backend
U=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | sed 's/?.*$//') && F=../backups/pre-paidfrom-$(date +%Y%m%d-%H%M%S).dump && pg_dump "$U" -Fc -f "$F" >/dev/null 2>&1; unset U; pg_restore -l "$F" | grep -c "TABLE DATA"
npx prisma migrate deploy
npx prisma generate
```
Expected: 295; "1 migration applied"; client generated. Re-run the diff: only the `script_revisions` drift remains.

- [ ] **Step 6: Commit** `feat(finance): payment paid-from, fee and slip fields; owner bank accounts`

### Task 2: Posting rule — credit the account the money came from

**Files:**
- Create: `backend/src/accounting/payment-posting.util.ts`
- Create: `backend/src/accounting/payment-posting.util.spec.ts`
- Modify: `backend/src/accounting/accounting.service.ts` (the `const pays = …` loop in `postAll`, ~line 482; the `payments` count in `postingStatus` stays as is)

**Interfaces:**
- Consumes: Task 1 fields `paidFrom`, `feeAmount`, `BankAccount.ownership`.
- Produces: `supplierPaymentCreditCode(p: PostablePayment): '1010' | '1000' | '2400' | null` and `paymentLines(p: PostablePayment): PostLine[] | null`.

- [ ] **Step 1: Write the failing test** (`payment-posting.util.spec.ts`)

```ts
import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { supplierPaymentCreditCode, paymentLines } from './payment-posting.util';

const base = { direction: 'PAYMENT' as const, amount: 100, feeAmount: null, method: 'BANK_TRANSFER', paidFrom: null, bankOwnership: null };

describe('supplierPaymentCreditCode', () => {
  test('company bank → 1010', () => assert.equal(supplierPaymentCreditCode({ ...base, paidFrom: 'COMPANY_BANK' }), '1010'));
  test('cash on hand → 1000', () => assert.equal(supplierPaymentCreditCode({ ...base, paidFrom: 'CASH_ON_HAND', method: 'CASH' }), '1000'));
  test('owner → 2400', () => assert.equal(supplierPaymentCreditCode({ ...base, paidFrom: 'OWNER', method: 'CARD' }), '2400'));
  test('no paidFrom, owner bank account → 2400', () => assert.equal(supplierPaymentCreditCode({ ...base, bankOwnership: 'OWNER' }), '2400'));
  test('no paidFrom, company bank account → 1010', () => assert.equal(supplierPaymentCreditCode({ ...base, bankOwnership: 'COMPANY' }), '1010'));
  test('no paidFrom, no account, cash → 1000', () => assert.equal(supplierPaymentCreditCode({ ...base, method: 'CASH' }), '1000'));
  test('unresolved → null, never guessed', () => assert.equal(supplierPaymentCreditCode({ ...base }), null));
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
  test('receipt unchanged', () => {
    assert.deepEqual(paymentLines({ ...base, direction: 'RECEIPT', amount: 50 }), [
      { code: '1010', debit: 50, desc: 'Bank' },
      { code: '1100', credit: 50, desc: 'Accounts Receivable' },
    ]);
  });
  test('unresolved supplier payment → null', () => assert.equal(paymentLines({ ...base }), null));
});
```

- [ ] **Step 2: Run** `cd backend && node --require ts-node/register --test src/accounting/payment-posting.util.spec.ts` — Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement** (`payment-posting.util.ts`)

```ts
/**
 * Which account a payment is posted against. Pure, so the rule is tested on its own.
 * A supplier payment relieves 2000 Accounts Payable and credits wherever the money came from:
 * the company bank (1010), cash on hand (1000), or the GM personally (2400 Owner Account).
 * Unresolved → null: postAll skips it and reports it rather than guessing the bank.
 */
export type PostablePayment = {
  direction: 'RECEIPT' | 'PAYMENT';
  amount: number;
  feeAmount: number | null;
  method: string;
  paidFrom: 'COMPANY_BANK' | 'CASH_ON_HAND' | 'OWNER' | null;
  bankOwnership: 'COMPANY' | 'OWNER' | null; // of payment.bankAccount, null when none
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
    return [{ code: '1010', debit: p.amount, desc: 'Bank' }, { code: '1100', credit: p.amount, desc: 'Accounts Receivable' }];
  }
  const code = supplierPaymentCreditCode(p);
  if (!code) return null;
  const fee = p.feeAmount && p.feeAmount > 0 ? r2(p.feeAmount) : 0;
  const lines: PostLine[] = [{ code: '2000', debit: r2(p.amount), desc: 'Accounts Payable' }];
  if (fee) lines.push({ code: '6500', debit: fee, desc: 'Bank / payment fee' });
  lines.push({ code, credit: r2(p.amount + fee), desc: CREDIT_DESC[code] });
  return lines;
}
```

- [ ] **Step 4: Run the test** — Expected: PASS (11 tests).

- [ ] **Step 5: Use it in postAll** — replace the `const pays = …` loop with:

```ts
    const pays = await this.prisma.payment.findMany({ include: { bankAccount: { select: { ownership: true } } } });
    const unresolved: string[] = [];
    for (const p of pays) {
      if (done.has(`PAYMENT:${p.id}`)) continue;
      const lines = paymentLines({
        direction: p.direction as 'RECEIPT' | 'PAYMENT',
        amount: Number(p.amount),
        feeAmount: p.feeAmount == null ? null : Number(p.feeAmount),
        method: p.method,
        paidFrom: (p.paidFrom as any) ?? null,
        bankOwnership: (p.bankAccount?.ownership as any) ?? null,
      });
      if (!lines) { unresolved.push(p.paymentNumber); continue; }
      const label = p.direction === 'PAYMENT' ? 'Supplier payment' : 'Payment';
      const memo = p.direction === 'PAYMENT' && p.reference ? `${label} ${p.paymentNumber} — ${p.reference}` : `${label} ${p.paymentNumber}`;
      if (await this.je(p.paymentDate || p.createdAt, memo, 'PAYMENT', p.id, lines, map)) payments++;
    }
```
and return `{ invoices, expenses, payments, unresolvedPayments: unresolved }`. Keep the existing comment block above the loop and add one line: "Where the money came from is `paidFrom` — see payment-posting.util.ts." Import `paymentLines` at the top. The `payment-direction-guard.spec.ts` allow-list already covers `postAll`'s unfiltered findMany (it posts both directions) — run the full suite to confirm.

- [ ] **Step 6: Run** `cd backend && npm test 2>&1 | tail -5` — Expected: all pass. Then `npx tsc --noEmit -p tsconfig.json` — no new errors in `src/accounting`.

- [ ] **Step 7: Verify nothing posts** — every existing payment is already linked, so a dry count: `postingStatus().payments` must be 0 (run via a read-only node script against the DB). Commit `fix(accounting): supplier payments credit bank, cash or owner account by paid-from`.

### Task 3: Shared OCR + slip text parser

**Files:**
- Create: `backend/src/common/ocr.util.ts` — `extractText(buf, mime)`, built from copies of `ocrImage`/`ocrPdf` in `production/breakdown/script-import.service.ts`. That service is not touched in this plan (it keeps its own copy); pointing it at the shared util is a separate later tidy-up.
- Create: `backend/src/finance/payments/slip-parse.util.ts`
- Create: `backend/src/finance/payments/slip-parse.util.spec.ts`

**Interfaces:**
- Produces: `extractText(buf: Buffer, mime: string): Promise<{ text: string; engine: 'text-layer' | 'ocr' }>`;
  `parseSlipText(text: string): SlipFields`; `type SlipField = 'date'|'amount'|'currency'|'reference'|'beneficiary'|'beneficiaryAccount'|'payerAccountRef'|'remark'|'fee'`; `type SlipFields = Partial<Record<SlipField, string>>`.
  Dates are returned ISO `yyyy-mm-dd`; amounts as plain decimals `"2887.50"`.

- [ ] **Step 1: Write the failing test** (`slip-parse.util.spec.ts`). Fixtures are the real formats seen in 2025; when real OCR outputs of the GM's slips are available (AVEC ProCash screenshot, personal-account slip), add each as a fixture with its expected fields.

```ts
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
  test('ADCB statement line O/W TRF', () => {
    const f = parseSlipText('07/04/2025 O/W TRF 465718721 65718721 07/04/2025 1,000.00');
    assert.equal(f.reference, '465718721');
    assert.equal(f.date, '2025-04-07');
    assert.equal(f.amount, '1000.00');
  });
  test('card slip with last 4 and fee', () => {
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
    assert.equal(f.date, '2025-09-30');
    assert.equal(f.beneficiary, 'AVEC EVENTS');
    assert.equal(f.reference, '545090663');
    assert.equal(f.fee, '5.25');
  });
  test('nothing recognisable → empty object, no throw', () => assert.deepEqual(parseSlipText('hello'), {}));
});
```

- [ ] **Step 2: Run** `cd backend && node --require ts-node/register --test src/finance/payments/slip-parse.util.spec.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `slip-parse.util.ts`

```ts
/** Pure: OCR text of a payment slip → fields. Never throws; unknown → field absent. */
export type SlipField = 'date' | 'amount' | 'currency' | 'reference' | 'beneficiary' | 'beneficiaryAccount' | 'payerAccountRef' | 'remark' | 'fee';
export type SlipFields = Partial<Record<SlipField, string>>;

const MONTHS: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
const num = (s: string): string | undefined => { const n = Number(s.replace(/[,\s]/g, '')); return Number.isFinite(n) && n > 0 ? n.toFixed(2) : undefined; };
const AMT = '([0-9]{1,3}(?:[,\\s][0-9]{3})*(?:\\.[0-9]{1,2})?|[0-9]+(?:\\.[0-9]{1,2})?)';

function labelled(text: string, labels: string[], value: string): RegExpMatchArray | null {
  for (const l of labels) { const m = text.match(new RegExp(`(?:${l})\\s*[:：-]?\\s*${value}`, 'i')); if (m) return m; }
  return null;
}

function toIso(s: string): string | undefined {
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3})[a-z]*[- ,]+(\d{4})$/); if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}`;
  return undefined;
}

export function parseSlipText(raw: string): SlipFields {
  const text = (raw || '').replace(/\r/g, '');
  const f: SlipFields = {};
  const line = (labels: string[]): string | undefined => { const m = labelled(text, labels, '([^\\n]+)'); return m ? m[1].trim() : undefined; };

  // Reference: ADCB O/W TRF first (full 9 digits), then labelled references, then approval codes.
  const owt = text.match(/O\/W TRF\s+(\d{8,9})\b/);
  const refL = labelled(text, ['Transaction Reference', 'Customer Reference', 'Reference No\\.?', 'Reference', 'Ref\\.? No\\.?', 'رقم المرجع', 'المرجع'], '([A-Z0-9-]{6,20})');
  const appr = labelled(text, ['Approval code', 'Auth(?:orisation|orization)? code', 'Approval'], '([0-9A-Z]{6,8})');
  const ref = owt?.[1] || refL?.[1] || appr?.[1]; if (ref) f.reference = ref;

  // Amount: labelled total/amount, else "AED x", else a trailing statement amount.
  const amtL = labelled(text, ['Total Amount', 'Total', 'Transfer Amount', 'Amount', 'المبلغ'], `(?:AED\\s*)?${AMT}`)
    || text.match(new RegExp(`AED\\s*${AMT}`, 'i')) || text.match(new RegExp(`\\s${AMT}\\s*$`));
  const amt = amtL ? num(amtL[1]) : undefined; if (amt) f.amount = amt;
  if (/\bAED\b|درهم/.test(text)) f.currency = 'AED'; else if (/\bUSD\b|\$/.test(text)) f.currency = 'USD';

  const feeL = labelled(text, ['Late fee', 'Charges', 'Fee', 'رسوم'], `(?:AED\\s*)?${AMT}`); const fee = feeL ? num(feeL[1]) : undefined; if (fee) f.fee = fee;

  const dateL = labelled(text, ['Value Date', 'Transaction Date', 'Date', 'التاريخ'], '(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/.]\\d{1,2}[/.]\\d{4}|\\d{1,2}[- ][A-Za-z]{3,9}[- ,]+\\d{4})');
  const dateAny = text.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
  const d = toIso((dateL?.[1] || dateAny?.[1] || '').trim()); if (d) f.date = d;

  const ben = line(['Beneficiary Name', 'Beneficiary', 'Paid to', 'اسم المستفيد', 'المستفيد']); if (ben) f.beneficiary = ben;
  const benAcc = labelled(text, ['Beneficiary (?:Account|IBAN)', 'Beneficiary A/C', 'IBAN'], '(AE\\d{21}|\\d{10,16})'); if (benAcc) f.beneficiaryAccount = benAcc[1];
  const payer = labelled(text, ['Debit Account', 'From Account', 'Debited from'], '(AE\\d{21}|\\d{10,16})') || text.match(/card (?:ending|no\.?)?\s*(?:[x*]+\s*)?(\d{4})\b/i);
  if (payer) f.payerAccountRef = payer[1];
  const rem = line(['Payment Remarks', 'Remarks', 'Purpose', 'Narration', 'الغرض']); if (rem) f.remark = rem;
  return f;
}
```

- [ ] **Step 4: Run the test** — Expected: PASS (5). If a fixture fails, fix the rule, not the fixture.

- [ ] **Step 5: Implement** `common/ocr.util.ts` — `extractText`: for `application/pdf` try `pdf-parse` first and return `{ engine: 'text-layer' }` if it yields ≥ 20 non-space characters; otherwise rasterise pages (≤ 5) and OCR exactly as `script-import.service.ts` `ocrPdf` does; images go straight to tesseract `eng+ara`. Copy the two private methods verbatim as exported functions (same dynamic `import(ts)` pattern, same error messages but mentioning "slip" instead of "script"). No unit test (it needs real binaries); covered by Task 4's manual check.

- [ ] **Step 6: Commit** `feat(finance): payment slip text parser + shared OCR util`

### Task 4: Slip reader service + `POST /finance/payments/read-slip`

**Files:**
- Create: `backend/src/finance/payments/slip-reader.service.ts`
- Modify: `backend/src/finance/payments/payments.controller.ts` (new route)
- Modify: `backend/src/finance/payments/payments.module.ts` (provider)

Note: `production/costing/costing.service.ts` already has an Anthropic **vision** extractor (`extractDocFields`). It is deliberately **not** reused: the GM's rule is that the slip image never leaves the server. Only OCR text goes to `AiService.json`.

**Interfaces:**
- Consumes: `extractText` (Task 3), `parseSlipText`, `SlipFields` (Task 3), `AiService.json<T>(opts: AiRunOpts)` (global `AiModule`), `PrismaService`.
- Produces: `SlipReaderService.read(file: { path: string; mimetype: string; originalname: string }, expenseId?: string): Promise<SlipReadResult>` where
  `SlipReadResult = { uploadToken: string; text: string; engine: 'text-layer' | 'ocr' | 'ocr+ai' | 'none'; fields: Partial<Record<SlipField, { value: string; source: 'slip' | 'ai' }>>; suggestedPaidFrom?: 'COMPANY_BANK' | 'OWNER'; suggestedBankAccountId?: string; warnings: string[] }`.
  `uploadToken` = the stored file name under `uploads/tmp-slips/` (uuid + ext).

- [ ] **Step 1: Implement the service**

```ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, extname, basename } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import { extractText } from '../../common/ocr.util';
import { parseSlipText, SlipField } from './slip-parse.util';

export const SLIP_TMP_DIR = join(process.cwd(), 'uploads', 'tmp-slips');
const FIELDS: SlipField[] = ['date', 'amount', 'currency', 'reference', 'beneficiary', 'beneficiaryAccount', 'payerAccountRef', 'remark', 'fee'];
const KEY: SlipField[] = ['amount', 'date', 'reference'];

export type SlipReadResult = {
  uploadToken: string; text: string; engine: 'text-layer' | 'ocr' | 'ocr+ai' | 'none';
  fields: Partial<Record<SlipField, { value: string; source: 'slip' | 'ai' }>>;
  suggestedPaidFrom?: 'COMPANY_BANK' | 'OWNER'; suggestedBankAccountId?: string; warnings: string[];
};

@Injectable()
export class SlipReaderService {
  constructor(private prisma: PrismaService, private ai: AiService) {}

  async read(file: { path: string; mimetype: string; originalname: string }, expenseId?: string): Promise<SlipReadResult> {
    await fs.mkdir(SLIP_TMP_DIR, { recursive: true });
    const token = `${randomUUID()}${extname(file.originalname).toLowerCase()}`;
    await fs.rename(file.path, join(SLIP_TMP_DIR, token));
    const buf = await fs.readFile(join(SLIP_TMP_DIR, token));
    const warnings: string[] = [];
    let text = ''; let engine: SlipReadResult['engine'] = 'none';
    try { const r = await extractText(buf, file.mimetype); text = r.text; engine = r.engine; }
    catch (e: any) { warnings.push(`Could not read the slip (${String(e?.message || e).slice(0, 120)}). Fill the form by hand.`); }

    const fields: SlipReadResult['fields'] = {};
    const parsed = parseSlipText(text);
    for (const k of FIELDS) if (parsed[k]) fields[k] = { value: parsed[k]!, source: 'slip' };

    if (text.trim() && KEY.some((k) => !fields[k])) {
      try {
        const j = await this.ai.json<Record<string, string | null>>({
          task: 'payment-slip-read', temperature: 0, maxTokens: 400,
          system: 'You read bank payment slips. Reply with JSON only: {"date":"yyyy-mm-dd"|null,"amount":"1234.56"|null,"currency":"AED"|null,"reference":string|null,"beneficiary":string|null,"beneficiaryAccount":string|null,"payerAccountRef":string|null,"remark":string|null,"fee":"12.34"|null}. Use only what the text says; null when absent. payerAccountRef is the payer IBAN/account or the last 4 card digits only.',
          user: text.slice(0, 6000),
        });
        for (const k of FIELDS) {
          const v = j?.[k]; if (fields[k] || v == null || String(v).trim() === '') continue;
          if (k === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) continue;
          if ((k === 'amount' || k === 'fee') && !(Number(v) > 0)) continue;
          if (k === 'payerAccountRef' && /^\d{13,19}$/.test(String(v))) continue; // never a full card number
          fields[k] = { value: k === 'amount' || k === 'fee' ? Number(v).toFixed(2) : String(v).trim(), source: 'ai' };
        }
        engine = 'ocr+ai';
      } catch { warnings.push('The AI could not help with this slip; the fields read from the slip are shown.'); }
    }

    const out: SlipReadResult = { uploadToken: token, text, engine, fields, warnings };
    const payer = fields.payerAccountRef?.value;
    if (payer) {
      const digits = payer.replace(/\s/g, '');
      const accts = await this.prisma.bankAccount.findMany({ where: { isActive: true }, select: { id: true, iban: true, accountNumber: true, cardLast4: true, ownership: true } });
      const hit = accts.find((a) => (a.iban && a.iban.replace(/\s/g, '') === digits) || a.accountNumber.replace(/\s/g, '') === digits || (digits.length === 4 && a.cardLast4 === digits));
      if (hit) { out.suggestedBankAccountId = hit.id; out.suggestedPaidFrom = hit.ownership === 'OWNER' ? 'OWNER' : 'COMPANY_BANK'; }
    }
    if (expenseId) warnings.push(...(await this.checks(expenseId, fields)));
    return out;
  }

  /** Warnings only — they inform, they never block. */
  private async checks(expenseId: string, fields: SlipReadResult['fields']): Promise<string[]> {
    const w: string[] = [];
    const e = await this.prisma.expense.findUnique({ where: { id: expenseId }, select: { totalAmount: true, supplier: { select: { name: true, tradeName: true } }, payments: { where: { direction: 'PAYMENT' }, select: { amount: true } } } });
    if (!e) return w;
    const unpaid = Number(e.totalAmount) - e.payments.reduce((s, p) => s + Number(p.amount), 0);
    const amt = Number(fields.amount?.value || 0);
    if (amt > unpaid + 0.005) w.push(`Amount ${amt.toFixed(2)} is more than the unpaid ${unpaid.toFixed(2)} on this invoice.`);
    const ben = (fields.beneficiary?.value || '').toLowerCase();
    const names = [e.supplier?.name, e.supplier?.tradeName].filter(Boolean).map((n) => String(n).toLowerCase());
    const word = (s: string) => s.split(/[^a-z0-9]+/).filter((x) => x.length > 2 && !['llc', 'fze', 'fzco', 'trading', 'the', 'and'].includes(x));
    if (ben && names.length && !names.some((n) => word(n).some((x) => ben.includes(x)))) w.push(`Beneficiary "${fields.beneficiary!.value}" does not look like the supplier (${names.join(' / ')}).`);
    const ref = fields.reference?.value;
    if (ref && amt) { const dup = await this.prisma.payment.findFirst({ where: { direction: 'PAYMENT', reference: ref, amount: amt }, select: { paymentNumber: true } }); if (dup) w.push(`Reference ${ref} for ${amt.toFixed(2)} is already recorded as ${dup.paymentNumber}.`); }
    return w;
  }

  /** Resolve a token from read() to its temp path; rejects path tricks. */
  static tmpPath(token: string): string {
    if (basename(token) !== token || !/^[0-9a-f-]{36}\.(pdf|png|jpe?g|webp|heic)$/i.test(token)) throw new BadRequestException('Invalid slip token.');
    return join(SLIP_TMP_DIR, token);
  }
}
```
Check `Expense` has a `payments` relation (it does: `Payment.expense` back-relation). If Prisma names it differently, use the name in schema.prisma.

- [ ] **Step 2: Route** in `payments.controller.ts` (the multer `diskStorage` pattern from `upload/upload.controller.ts`, destination `uploads/tmp-slips`):

```ts
  @Post('read-slip')
  @RequirePermission('finance', 2)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Read a payment slip (OCR, AI fallback). Saves nothing but the temporary file.' })
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({ destination: SLIP_TMP_DIR, filename: (_r, f, cb) => cb(null, `${randomUUID()}${extname(f.originalname).toLowerCase()}`) }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_r, f, cb) => /\.(pdf|png|jpe?g|webp|heic)$/i.test(f.originalname) ? cb(null, true) : cb(new BadRequestException('Slip must be a PDF or an image.'), false),
  }))
  readSlip(@UploadedFile() file: any, @Body('expenseId') expenseId?: string) {
    if (!file) throw new BadRequestException('Attach the slip.');
    return this.slips.read(file, expenseId || undefined);
  }
```
Constructor becomes `constructor(private service: PaymentsService, private slips: SlipReaderService) {}`. Declare `read-slip` **before** `@Get(':id')` is irrelevant (different verb) but keep it above for readability. Ensure `SLIP_TMP_DIR` exists at module init (`fs.mkdirSync(SLIP_TMP_DIR, { recursive: true })` at top of the service file).

- [ ] **Step 3: Module** — add `SlipReaderService` to `providers` and `exports` in `payments.module.ts`.

- [ ] **Step 4: Typecheck** `cd backend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "finance/payments|common/ocr" || echo clean`. Run `npm test` — all pass.

- [ ] **Step 5: Manual check without starting the server** — a node script that constructs `SlipReaderService` with a PrismaClient and a stub AI (`json: async () => null`) and reads the AVEC ProCash screenshot and one ProCash PDF from `Commercials/TFM/2025/Supplier invoices/`; print `fields` and `engine`. Expected: reference 545090663 / 4336.50 read from the slip. Add each real OCR text to `slip-parse.util.spec.ts` as a fixture.

- [ ] **Step 6: Commit** `feat(finance): read payment slips — OCR, rules, AI text fallback, account suggestion`. (Deduplicating the OCR code out of `script-import.service.ts` is a later tidy-up in its own step; not required here.)

### Task 5: Record a supplier payment (one transaction)

**Files:**
- Create: `backend/src/finance/payments/supplier-payments.service.ts`
- Create: `backend/src/finance/payments/supplier-payments.spec.ts` (validation, pure)
- Modify: `backend/src/finance/payments/payments.controller.ts` (two routes) — module provider line goes in the same edit of `payments.module.ts` only if the 3-file budget allows; otherwise register it in Task 6's first step. Budget: service + spec + controller = 3; module edit is a one-line change done at the start of Task 6.

**Interfaces:**
- Consumes: `SlipReaderService.tmpPath` (Task 4), `paymentLines` (Task 2), `AccountingService` is NOT called (it is a separate module); the entry is written directly with the same numbering (`JE-YYYY-NNNN`, next after the last) inside the transaction.
- Produces:
  - `validateRecordPayment(dto: RecordPaymentDto, ctx: { bankOwnership: 'COMPANY' | 'OWNER' | null }): string[]` (pure, returns error messages)
  - `SupplierPaymentsService.record(expenseId: string, dto: RecordPaymentDto, userId?: string): Promise<{ payment: Payment; entryNumber: string }>`
  - `SupplierPaymentsService.list(expenseId: string): Promise<{ payments: any[]; slips: any[]; total: number; paid: number; unpaid: number }>`
  - Routes: `POST /finance/payments/expense/:expenseId` and `GET /finance/payments/expense/:expenseId` (permission finance 2 / 1).

```ts
export type RecordPaymentDto = {
  paidFrom: 'COMPANY_BANK' | 'CASH_ON_HAND' | 'OWNER';
  bankAccountId?: string | null; method: 'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'CARD' | 'ONLINE';
  paymentDate: string; amount: number; feeAmount?: number | null; currency?: 'AED' | 'USD' | 'EUR' | 'GBP';
  reference?: string | null; beneficiary?: string | null; beneficiaryAccount?: string | null;
  payerAccountRef?: string | null; notes?: string | null; uploadToken?: string | null; slipText?: string | null;
};
```

- [ ] **Step 1: Failing test** (`supplier-payments.spec.ts`)

```ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { validateRecordPayment } from './supplier-payments.service';

const ok = { paidFrom: 'COMPANY_BANK' as const, bankAccountId: 'b1', method: 'BANK_TRANSFER' as const, paymentDate: '2026-09-22', amount: 100 };
test('valid company transfer', () => assert.deepEqual(validateRecordPayment(ok, { bankOwnership: 'COMPANY' }), []));
test('amount must be positive', () => assert.ok(validateRecordPayment({ ...ok, amount: 0 }, { bankOwnership: 'COMPANY' }).length));
test('company bank needs a company account', () => assert.ok(validateRecordPayment({ ...ok, bankAccountId: null }, { bankOwnership: null }).length));
test('company bank cannot use an owner account', () => assert.ok(validateRecordPayment(ok, { bankOwnership: 'OWNER' }).length));
test('cash has no bank account and method CASH', () => {
  assert.deepEqual(validateRecordPayment({ ...ok, paidFrom: 'CASH_ON_HAND', bankAccountId: null, method: 'CASH' }, { bankOwnership: null }), []);
  assert.ok(validateRecordPayment({ ...ok, paidFrom: 'CASH_ON_HAND', method: 'BANK_TRANSFER', bankAccountId: null }, { bankOwnership: null }).length);
});
test('owner may use an owner account or none', () => {
  assert.deepEqual(validateRecordPayment({ ...ok, paidFrom: 'OWNER', method: 'CARD', bankAccountId: null }, { bankOwnership: null }), []);
  assert.ok(validateRecordPayment({ ...ok, paidFrom: 'OWNER', method: 'CARD' }, { bankOwnership: 'COMPANY' }).length);
});
test('CASH method only with cash on hand', () => assert.ok(validateRecordPayment({ ...ok, method: 'CASH' }, { bankOwnership: 'COMPANY' }).length));
test('bad date', () => assert.ok(validateRecordPayment({ ...ok, paymentDate: '22/09/2026' }, { bankOwnership: 'COMPANY' }).length));
test('full card number refused in payerAccountRef', () => assert.ok(validateRecordPayment({ ...ok, payerAccountRef: '4111111111111111' }, { bankOwnership: 'COMPANY' }).length));
```

- [ ] **Step 2: Run** — FAIL (module not found).

- [ ] **Step 3: Implement** `supplier-payments.service.ts`

```ts
import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SlipReaderService } from './slip-reader.service';
import { paymentLines } from '../../accounting/payment-posting.util';

export type RecordPaymentDto = { /* exactly as in Interfaces above */
  paidFrom: 'COMPANY_BANK' | 'CASH_ON_HAND' | 'OWNER'; bankAccountId?: string | null;
  method: 'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'CARD' | 'ONLINE'; paymentDate: string; amount: number;
  feeAmount?: number | null; currency?: 'AED' | 'USD' | 'EUR' | 'GBP'; reference?: string | null;
  beneficiary?: string | null; beneficiaryAccount?: string | null; payerAccountRef?: string | null;
  notes?: string | null; uploadToken?: string | null; slipText?: string | null;
};

export function validateRecordPayment(d: RecordPaymentDto, ctx: { bankOwnership: 'COMPANY' | 'OWNER' | null }): string[] {
  const e: string[] = [];
  if (!(Number(d.amount) > 0)) e.push('Amount must be more than zero.');
  if (d.feeAmount != null && Number(d.feeAmount) < 0) e.push('Fee cannot be negative.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.paymentDate || '') || isNaN(Date.parse(d.paymentDate))) e.push('Payment date must be yyyy-mm-dd.');
  if (d.paidFrom === 'COMPANY_BANK' && ctx.bankOwnership !== 'COMPANY') e.push('Company bank payments need a company bank account.');
  if (d.paidFrom === 'CASH_ON_HAND' && (d.bankAccountId || d.method !== 'CASH')) e.push('Cash payments have method Cash and no bank account.');
  if (d.paidFrom === 'OWNER' && ctx.bankOwnership === 'COMPANY') e.push('A payment you made personally cannot use a company bank account.');
  if (d.method === 'CASH' && d.paidFrom !== 'CASH_ON_HAND') e.push('Method Cash is only for cash-on-hand payments.');
  if (d.payerAccountRef && /^\d{13,19}$/.test(d.payerAccountRef.replace(/\s/g, ''))) e.push('Store only the last 4 digits of a card.');
  return e;
}

@Injectable()
export class SupplierPaymentsService {
  constructor(private prisma: PrismaService) {}

  async list(expenseId: string) {
    const e = await this.prisma.expense.findUnique({ where: { id: expenseId }, select: { totalAmount: true } });
    if (!e) throw new NotFoundException('Expense not found.');
    const payments = await this.prisma.payment.findMany({ where: { expenseId, direction: 'PAYMENT' }, orderBy: { paymentDate: 'asc' }, include: { bankAccount: { select: { accountName: true, bankName: true, ownership: true } } } });
    const ids = payments.map((p) => p.id);
    const [slips, entries] = await Promise.all([
      this.prisma.documentAttachment.findMany({ where: { entityType: 'PAYMENT', entityId: { in: ids } } }),
      this.prisma.journalEntry.findMany({ where: { sourceType: 'PAYMENT', sourceId: { in: ids } }, select: { sourceId: true, entryNumber: true } }),
    ]);
    const entryBy = new Map(entries.map((x) => [x.sourceId, x.entryNumber]));
    const total = Number(e.totalAmount); const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
    return { payments: payments.map((p) => ({ ...p, entryNumber: entryBy.get(p.id) || null })), slips, total, paid, unpaid: Math.round((total - paid) * 100) / 100 };
  }

  async record(expenseId: string, d: RecordPaymentDto, userId?: string) {
    const exp = await this.prisma.expense.findUnique({ where: { id: expenseId }, select: { id: true, expenseNumber: true, supplierId: true, totalAmount: true, status: true } });
    if (!exp) throw new NotFoundException('Expense not found.');
    const bank = d.bankAccountId ? await this.prisma.bankAccount.findUnique({ where: { id: d.bankAccountId }, select: { ownership: true } }) : null;
    if (d.bankAccountId && !bank) throw new BadRequestException('Bank account not found.');
    const errors = validateRecordPayment(d, { bankOwnership: (bank?.ownership as any) ?? null });
    if (errors.length) throw new BadRequestException(errors.join(' '));
    const amount = Math.round(Number(d.amount) * 100) / 100;
    if (d.reference) {
      const dup = await this.prisma.payment.findFirst({ where: { direction: 'PAYMENT', reference: d.reference, amount }, select: { paymentNumber: true } });
      if (dup) throw new ConflictException(`Reference ${d.reference} for ${amount.toFixed(2)} is already recorded as ${dup.paymentNumber}.`);
    }
    const lines = paymentLines({ direction: 'PAYMENT', amount, feeAmount: d.feeAmount ?? null, method: d.method, paidFrom: d.paidFrom, bankOwnership: (bank?.ownership as any) ?? null });
    if (!lines) throw new BadRequestException('Cannot tell where this payment came from.');
    const accts = await this.prisma.glAccount.findMany({ where: { code: { in: lines.map((l) => l.code) } }, select: { id: true, code: true } });
    const acct = new Map(accts.map((a) => [a.code, a.id]));
    const missing = lines.filter((l) => !acct.has(l.code)).map((l) => l.code);
    if (missing.length) throw new BadRequestException(`Chart of accounts is missing ${missing.join(', ')}.`);

    let slipFinal: string | null = null;
    if (d.uploadToken) {
      const src = SlipReaderService.tmpPath(d.uploadToken);
      await fs.access(src).catch(() => { throw new BadRequestException('The slip upload expired — attach it again.'); });
      slipFinal = `payment-slip-${d.uploadToken}`;
      await fs.rename(src, join(process.cwd(), 'uploads', slipFinal));
    }
    const date = new Date(`${d.paymentDate}T00:00:00.000Z`);
    const year = d.paymentDate.slice(0, 4);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const lastPay = await tx.payment.findFirst({ where: { paymentNumber: { startsWith: `PAY-${year}-` } }, orderBy: { paymentNumber: 'desc' }, select: { paymentNumber: true } });
        const paymentNumber = `PAY-${year}-${String((lastPay ? parseInt(lastPay.paymentNumber.slice(-4), 10) : 0) + 1).padStart(4, '0')}`;
        const payment = await tx.payment.create({ data: {
          paymentNumber, direction: 'PAYMENT', expenseId, supplierId: exp.supplierId, bankAccountId: d.bankAccountId || null,
          amount, feeAmount: d.feeAmount ?? null, currency: d.currency || 'AED', paymentDate: date, method: d.method, status: 'CLEARED', clearedAt: date,
          paidFrom: d.paidFrom, reference: d.reference || null, beneficiary: d.beneficiary || null, beneficiaryAccount: d.beneficiaryAccount || null,
          payerAccountRef: d.payerAccountRef || null, notes: d.notes || null } });
        const jePrefix = `JE-${new Date().getFullYear()}-`;
        const lastJe = await tx.journalEntry.findFirst({ where: { entryNumber: { startsWith: jePrefix } }, orderBy: { entryNumber: 'desc' }, select: { entryNumber: true } });
        const entryNumber = `${jePrefix}${String((lastJe ? parseInt(lastJe.entryNumber.slice(-4), 10) : 0) + 1).padStart(4, '0')}`;
        await tx.journalEntry.create({ data: {
          entryNumber, date, memo: `Supplier payment ${paymentNumber}${d.reference ? ` — ${d.reference}` : ''} — ${exp.expenseNumber}`,
          source: 'SYSTEM', sourceType: 'PAYMENT', sourceId: payment.id, status: 'POSTED', postedAt: new Date(), createdById: userId || null,
          lines: { create: lines.map((l, i) => ({ accountId: acct.get(l.code)!, description: l.desc, debit: l.debit || 0, credit: l.credit || 0, sortOrder: i })) } } });
        if (slipFinal) {
          const name = `Payment slip ${paymentNumber}`;
          await tx.documentAttachment.create({ data: { entityType: 'PAYMENT', entityId: payment.id, kind: 'SUPPORTING', name, provider: 'UPLOAD', url: `/uploads/${slipFinal}`, notes: d.slipText ? d.slipText.slice(0, 20000) : null, uploadedById: userId || null } });
          await tx.documentAttachment.create({ data: { entityType: 'EXPENSE', entityId: expenseId, kind: 'SUPPORTING', name, provider: 'UPLOAD', url: `/uploads/${slipFinal}`, uploadedById: userId || null } });
          if (exp.supplierId) await tx.supplierDocument.create({ data: { supplierId: exp.supplierId, docType: 'OTHER', name, fileUrl: `/uploads/${slipFinal}`, notes: `${exp.expenseNumber}` } });
        }
        const paid = await tx.payment.aggregate({ where: { expenseId, direction: 'PAYMENT' }, _sum: { amount: true } });
        if (Number(paid._sum.amount || 0) + 0.005 >= Number(exp.totalAmount) && exp.status !== 'PAID')
          await tx.expense.update({ where: { id: expenseId }, data: { status: 'PAID', paidAt: date } });
        return { payment, entryNumber };
      });
    } catch (e) {
      if (slipFinal && d.uploadToken) await fs.rename(join(process.cwd(), 'uploads', slipFinal), SlipReaderService.tmpPath(d.uploadToken)).catch(() => undefined);
      throw e;
    }
  }
}
```
Check before writing: `Currency` enum values and `JournalEntry.createdById` exist (they do per schema read on 22 Sep); `payment-direction-guard.spec.ts` — both new `payment` queries filter `direction`; the `aggregate` does too.

- [ ] **Step 4: Routes** in `payments.controller.ts`:

```ts
  @Get('expense/:expenseId')
  listForExpense(@Param('expenseId') expenseId: string) { return this.supplier.list(expenseId); }

  @Post('expense/:expenseId')
  @RequirePermission('finance', 2)
  @ApiOperation({ summary: 'Record a supplier payment against an expense (payment + slip + journal entry, one transaction)' })
  record(@Param('expenseId') expenseId: string, @Body() dto: RecordPaymentDto, @Req() req: any) { return this.supplier.record(expenseId, dto, req.user?.id); }
```
Constructor adds `private supplier: SupplierPaymentsService`. Place both routes above `@Get(':id')`.

- [ ] **Step 5:** `npm test` (all pass), typecheck clean. No DB write in this task. Commit `feat(finance): record supplier payment with slip and journal entry in one transaction`.

### Task 6a: Register service, API client, payments component

**Files:**
- Modify: `backend/src/finance/payments/payments.module.ts` — `providers: [PaymentsService, SlipReaderService, SupplierPaymentsService]`, same in `exports`.
- Modify: `frontend/src/lib/api.ts` — inside `financeApi`, next to `expenses`:
```ts
  supplierPayments: {
    list: (expenseId: string) => api.get(`/finance/payments/expense/${expenseId}`),
    record: (expenseId: string, data: any) => api.post(`/finance/payments/expense/${expenseId}`, data),
    readSlip: (file: File, expenseId?: string) => { const fd = new FormData(); fd.append('file', file); if (expenseId) fd.append('expenseId', expenseId); return api.post('/finance/payments/read-slip', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); },
  },
```
- Create: `frontend/src/components/finance/ExpensePayments.tsx`

**Interfaces:** Produces `<ExpensePayments expenseId={string} onChanged={() => void} />`.

- [ ] **Step 1: Component** (`ExpensePayments.tsx`) — styling follows the expenses page (Tailwind classes, `formatCurrency`, `formatDate`, `cn` from `@/lib/utils`):

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { financeApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

type Src = 'slip' | 'ai' | 'typed';
type Field = 'date' | 'amount' | 'currency' | 'reference' | 'beneficiary' | 'beneficiaryAccount' | 'payerAccountRef' | 'remark' | 'fee';
const FIELD_LABEL: Record<Field, string> = { date: 'Payment date', amount: 'Amount', currency: 'Currency', reference: 'Bank reference', beneficiary: 'Beneficiary', beneficiaryAccount: 'Beneficiary IBAN / account', payerAccountRef: 'Paid from account (IBAN or card last 4)', remark: 'Remark', fee: 'Fee' };
const TAG: Record<Src, string> = { slip: 'read from slip', ai: 'filled by AI', typed: 'you typed' };
const PAID_FROM = [{ v: 'COMPANY_BANK', l: 'Company bank' }, { v: 'CASH_ON_HAND', l: 'Cash on hand' }, { v: 'OWNER', l: 'Me personally' }] as const;
const METHODS = ['BANK_TRANSFER', 'CARD', 'ONLINE', 'CHEQUE', 'CASH'] as const;
const errText = (e: any) => e?.response?.data?.message ? [].concat(e.response.data.message).join(' ') : String(e?.message || e);

export function ExpensePayments({ expenseId, onChanged }: { expenseId: string; onChanged?: () => void }) {
  const [data, setData] = useState<any>(null);
  const [banks, setBanks] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ url: string; pdf: boolean } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [slipText, setSlipText] = useState<string>('');
  const [vals, setVals] = useState<Partial<Record<Field, string>>>({});
  const [src, setSrc] = useState<Partial<Record<Field, Src>>>({});
  const [paidFrom, setPaidFrom] = useState<'COMPANY_BANK' | 'CASH_ON_HAND' | 'OWNER'>('COMPANY_BANK');
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [method, setMethod] = useState<string>('BANK_TRANSFER');

  const load = useCallback(async () => {
    try { const [p, b] = await Promise.all([financeApi.supplierPayments.list(expenseId), financeApi.bankAccounts.list()]); setData(p.data); setBanks(b.data || []); }
    catch (e) { setError(errText(e)); }
  }, [expenseId]);
  useEffect(() => { load(); }, [load]);

  const reset = () => { setVals({}); setSrc({}); setWarnings([]); setError(null); setToken(null); setSlipText(''); setPreview(null); setPaidFrom('COMPANY_BANK'); setBankAccountId(''); setMethod('BANK_TRANSFER'); };
  const set = (k: Field, v: string) => { setVals((s) => ({ ...s, [k]: v })); setSrc((s) => ({ ...s, [k]: 'typed' })); };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setPreview({ url: URL.createObjectURL(f), pdf: f.type === 'application/pdf' });
    setReading(true); setError(null);
    try {
      const { data: r } = await financeApi.supplierPayments.readSlip(f, expenseId);
      setToken(r.uploadToken); setSlipText(r.text || ''); setWarnings(r.warnings || []);
      const v: any = {}; const s: any = {};
      Object.entries(r.fields || {}).forEach(([k, x]: any) => { v[k] = x.value; s[k] = x.source; });
      setVals(v); setSrc(s);
      if (r.suggestedPaidFrom) setPaidFrom(r.suggestedPaidFrom);
      if (r.suggestedBankAccountId) setBankAccountId(r.suggestedBankAccountId);
      if (/card/i.test(r.text || '') && !/O\/W TRF|transfer/i.test(r.text || '')) setMethod('CARD');
    } catch (e) { setError(`Could not read the slip: ${errText(e)}. You can fill the form by hand.`); }
    finally { setReading(false); }
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await financeApi.supplierPayments.record(expenseId, {
        paidFrom, bankAccountId: paidFrom === 'CASH_ON_HAND' ? null : bankAccountId || null, method: paidFrom === 'CASH_ON_HAND' ? 'CASH' : method,
        paymentDate: vals.date, amount: Number(vals.amount), feeAmount: vals.fee ? Number(vals.fee) : null, currency: vals.currency || 'AED',
        reference: vals.reference || null, beneficiary: vals.beneficiary || null, beneficiaryAccount: vals.beneficiaryAccount || null,
        payerAccountRef: vals.payerAccountRef || null, notes: vals.remark ? `Remark: ${vals.remark}` : null, uploadToken: token, slipText,
      });
      setOpen(false); reset(); await load(); onChanged?.();
    } catch (e) { setError(errText(e)); }
    finally { setSaving(false); }
  };

  const accountChoices = banks.filter((b) => b.isActive !== false && (paidFrom === 'OWNER' ? b.ownership === 'OWNER' : b.ownership !== 'OWNER'));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Payments</h3>
        <button className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm" onClick={() => { reset(); setOpen(true); }}>Record payment</button>
      </div>
      {error && !open && <p className="text-sm text-red-600">{error}</p>}
      {data && (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th>No.</th><th>Date</th><th>Paid from</th><th>Method</th><th className="text-right">Amount</th><th className="text-right">Fee</th><th>Reference</th><th>Beneficiary</th><th>Entry</th></tr></thead>
          <tbody>
            {data.payments.map((p: any) => (
              <tr key={p.id} className="border-t" title={p.notes || ''}>
                <td>{p.paymentNumber}</td><td>{formatDate(p.paymentDate)}</td>
                <td>{PAID_FROM.find((x) => x.v === p.paidFrom)?.l || '—'}{p.bankAccount ? ` · ${p.bankAccount.bankName}` : ''}</td>
                <td>{p.method}</td><td className="text-right">{formatCurrency(Number(p.amount))}</td>
                <td className="text-right">{p.feeAmount ? formatCurrency(Number(p.feeAmount)) : ''}</td>
                <td>{p.reference || ''}</td><td>{p.beneficiary || ''}</td><td>{p.entryNumber || ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t font-medium"><td colSpan={4}>Unpaid</td><td className="text-right">{formatCurrency(data.unpaid)}</td><td colSpan={4} /></tr></tfoot>
        </table>
      )}
      {data?.slips?.length > 0 && <div className="text-sm">Slips: {data.slips.map((s: any) => <a key={s.id} className="underline mr-3" href={s.url} target="_blank" rel="noreferrer">{s.name}</a>)}</div>}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => !saving && setOpen(false)}>
          <div className="w-full max-w-5xl h-full bg-background p-5 overflow-auto grid md:grid-cols-2 gap-5" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-3">
              <h3 className="font-semibold">Record payment</h3>
              <label className="block border-2 border-dashed rounded p-4 text-sm text-center cursor-pointer">
                {reading ? 'Reading slip…' : 'Attach slip (PDF, photo or screenshot) — optional'}
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              </label>
              <fieldset className="flex gap-4 text-sm">
                {PAID_FROM.map((o) => <label key={o.v} className="flex items-center gap-1"><input type="radio" checked={paidFrom === o.v} onChange={() => { setPaidFrom(o.v); setBankAccountId(''); if (o.v === 'CASH_ON_HAND') setMethod('CASH'); else if (method === 'CASH') setMethod('BANK_TRANSFER'); }} />{o.l}</label>)}
              </fieldset>
              {paidFrom !== 'CASH_ON_HAND' && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <select className="border rounded p-1.5" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
                    <option value="">{paidFrom === 'OWNER' ? 'Personal account (optional)' : 'Choose company account'}</option>
                    {accountChoices.map((b) => <option key={b.id} value={b.id}>{b.bankName} · {b.accountName} · …{String(b.accountNumber).slice(-4)}</option>)}
                  </select>
                  <select className="border rounded p-1.5" value={method} onChange={(e) => setMethod(e.target.value)}>
                    {METHODS.filter((m) => m !== 'CASH').map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                  </select>
                </div>
              )}
              {(Object.keys(FIELD_LABEL) as Field[]).map((k) => (
                <div key={k} className="text-sm">
                  <div className="flex justify-between"><span>{FIELD_LABEL[k]}</span>{src[k] && <span className={cn('text-xs', src[k] === 'ai' ? 'text-amber-600' : src[k] === 'slip' ? 'text-emerald-600' : 'text-muted-foreground')}>{TAG[src[k]!]}</span>}</div>
                  <input className="w-full border rounded p-1.5" type={k === 'date' ? 'date' : 'text'} value={vals[k] || ''} onChange={(e) => set(k, e.target.value)} />
                </div>
              ))}
              {warnings.map((w, i) => <p key={i} className="text-sm text-amber-700">⚠ {w}</p>)}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button disabled={saving || reading || !vals.amount || !vals.date} className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm disabled:opacity-50" onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
                <button disabled={saving} className="px-3 py-1.5 rounded border text-sm" onClick={() => { setOpen(false); reset(); }}>Cancel</button>
              </div>
            </div>
            <div className="border rounded min-h-[400px] flex items-center justify-center text-sm text-muted-foreground">
              {preview ? (preview.pdf ? <iframe title="slip" src={preview.url} className="w-full h-full min-h-[600px]" /> : <img alt="slip" src={preview.url} className="max-w-full" />) : 'The slip appears here'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2:** `cd frontend && npx tsc --noEmit 2>&1 | grep ExpensePayments || echo clean`; `cd backend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep finance/payments || echo clean`. Commit `feat(finance): payments block + record-payment drawer component`.

### Task 6b: Mount on the expenses screen; owner accounts in bank-account settings

**Files:**
- Modify: `frontend/src/app/(dashboard)/finance/expenses/page.tsx` — the page is a list with no detail view. Add a "Payments" action per row that opens a panel rendering `<ExpensePayments expenseId={row.id} onChanged={load} />` (reuse the page's own `load`/refresh callback name; read the file first and follow its existing row-action pattern).
- Modify: `backend/src/finance/bank-accounts/dto/create-bank-account.dto.ts` — add `@IsOptional() @IsIn(['COMPANY','OWNER']) ownership?: 'COMPANY' | 'OWNER';` and `@IsOptional() @Matches(/^\d{4}$/) cardLast4?: string;` (UpdateBankAccountDto extends it via PartialType — confirm; if not, add the same two lines there, which is then this task's third file instead of the company page).
- Modify: `frontend/src/app/(dashboard)/company/page.tsx` — in the bank-account form, a select "Account belongs to: Company / Owner (personal)" and a "Card last 4" input; show an "Owner" badge in the list. Invoice/quotation default checkboxes hidden when Owner is selected.

- [ ] Steps: implement each, typecheck both sides, commit `feat(finance): record payments from the expenses list; owner bank accounts`. The GM adds his personal account in Company → Bank accounts himself (IBAN typed by him).

### Task 7: Backfill `paidFrom` / `feeAmount` on the 64 existing payments

**Files:**
- Create: `backend/prisma/backfill-paid-from-2025.ts`

- [ ] **Step 1: Script** — for every payment with notes containing `[PAYBACKFILL2025]` and `paidFrom` null: load its journal entry (`sourceType 'PAYMENT'`, `sourceId`); credit 1010 → `COMPANY_BANK`, 1000 → `CASH_ON_HAND`, 2400 → `OWNER`; `feeAmount` = the entry's 6500 debit when present (Tamara entries), else null. Guards: every payment resolves to exactly one of the three, else throw "nothing changed"; counts must be 52 / 5 / 7. Idempotent (only rows with `paidFrom` null). `--dry` prints the table. Single `$transaction`. No journal change.

```ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const MAP: Record<string, 'COMPANY_BANK' | 'CASH_ON_HAND' | 'OWNER'> = { '1010': 'COMPANY_BANK', '1000': 'CASH_ON_HAND', '2400': 'OWNER' };
async function main(): Promise<void> {
  const pays = await prisma.payment.findMany({ where: { direction: 'PAYMENT', paidFrom: null, notes: { contains: '[PAYBACKFILL2025]' } }, orderBy: { paymentNumber: 'asc' } });
  if (!pays.length) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const jes = await prisma.journalEntry.findMany({ where: { sourceType: 'PAYMENT', sourceId: { in: pays.map((p) => p.id) } }, include: { lines: { include: { account: { select: { code: true } } } } } });
  const byId = new Map(jes.map((j) => [j.sourceId, j]));
  const plan = pays.map((p) => {
    const j = byId.get(p.id); if (!j) throw new Error(`${p.paymentNumber} has no entry — nothing changed.`);
    const src = [...new Set(j.lines.filter((l) => Number(l.credit) > 0 && MAP[l.account.code]).map((l) => MAP[l.account.code]))];
    if (src.length !== 1) throw new Error(`${p.paymentNumber} (${j.entryNumber}) credit side unclear — nothing changed.`);
    const fee = j.lines.filter((l) => l.account.code === '6500').reduce((s, l) => s + Number(l.debit), 0);
    return { id: p.id, no: p.paymentNumber, je: j.entryNumber, paidFrom: src[0], fee: fee > 0 ? Math.round(fee * 100) / 100 : null };
  });
  const count = (v: string) => plan.filter((x) => x.paidFrom === v).length;
  plan.forEach((x) => console.log(`  ${x.no}  ${x.je}  ${x.paidFrom}${x.fee ? `  fee ${x.fee.toFixed(2)}` : ''}`));
  console.log(`  COMPANY_BANK ${count('COMPANY_BANK')} · CASH_ON_HAND ${count('CASH_ON_HAND')} · OWNER ${count('OWNER')}`);
  if (plan.length !== 64 || count('COMPANY_BANK') !== 52 || count('CASH_ON_HAND') !== 5 || count('OWNER') !== 7) throw new Error('Counts differ from 64 = 52 + 5 + 7 — nothing changed.');
  if (DRY) { console.log('=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }
  await prisma.$transaction(plan.map((x) => prisma.payment.update({ where: { id: x.id }, data: { paidFrom: x.paidFrom, feeAmount: x.fee } })));
  console.log(`Updated ${plan.length} payments.`); await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e instanceof Error ? e.message : e); await prisma.$disconnect(); process.exit(1); });
```
Note on fees: for PAY-2025-0028/0030/0033/0037/0047 and PAY-2025-0012/0054 the fee sits in the same entry; `feeAmount` records it for display only — the entries already exist, so nothing is re-posted.

- [ ] **Step 2:** typecheck, backup (295), `--dry`, apply, re-run (expect "Already applied."), verify TB 0.00 and 2025 result (49,010.13). Commit `accounts: paid-from and fee on the 64 backfilled supplier payments`. Update `accounts/2025-invoice-register.md` (project doc).

---

## Self-review (22 Sep 2026)

- Spec §1 → Task 1, 7 · §2 → Task 2 · §3 → Tasks 3–4 · §4 → Task 5 · §5 → Tasks 6a–6b · §6 build order → Tasks 1–7 (6 split in two to respect the 3-file limit).
- The migration is additive and nullable; receipts untouched; `payment-direction-guard.spec.ts` stays green because every new payment query filters `direction`.
- Names used across tasks: `paymentLines`, `supplierPaymentCreditCode`, `parseSlipText`, `SlipField`, `extractText`, `SlipReaderService.read/tmpPath`, `SLIP_TMP_DIR`, `validateRecordPayment`, `SupplierPaymentsService.record/list`, `financeApi.supplierPayments.{list,record,readSlip}` — consistent.
- Deviation from spec, deliberate: the record endpoint is `POST /finance/payments/expense/:expenseId` (payments controller owns payment routes) instead of `/finance/expenses/:id/payments`; slips are also attached to the PAYMENT entity so the payments table can link them.
