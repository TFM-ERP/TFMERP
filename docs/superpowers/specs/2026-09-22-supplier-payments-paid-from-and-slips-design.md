# Supplier payments — "paid from", slip reading, record-payment form

**Date:** 22 Sep 2026 · **Status:** design approved by the GM (Qais), awaiting spec review
**Branch:** feat/invoice-lifecycle · **Stack:** NestJS + Prisma backend, Next.js frontend, node:test
**Constraints:** no new dependencies; max 3 files per step; schema changes hand-written as a migration and applied only on an explicit "apply"; never db push; never start/restart the backend; production DB is the single source of truth.

## Problem

1. The posting routine (`accounting.service.ts` postAll) posts every supplier payment Dr 2000 / Cr 1010.
   Cash payments should credit 1000 Cash on Hand; payments the GM made personally should credit
   2400 Owner Account (Loan). Nothing on a Payment says which.
2. There is no screen to record a supplier payment against an expense, and no place for the proof
   (bank slip, ProCash e-mail, card receipt, the GM's personal-account transfer slip).
3. Typing reference, IBAN and statement details by hand is slow and error-prone.

## Decisions (GM, 22 Sep 2026)

- One "Record payment" flow for **every** supplier payment, not only personal ones.
- Reading a slip: **OCR first, AI only if needed** — tesseract.js (eng+ara) on the server, then
  rules; if amount, date or reference is still missing, only the OCR text (never the image) is sent
  to the existing `AiService`.
- The GM's personal bank account is stored once as a **personal account** and picked like the company account.
- Heartland 2024 payments by the GM were on his personal card (already corrected in PAY-2024-0001..0005).

## 1. Data model (one migration, applied on "apply")

```prisma
enum PaymentSource { COMPANY_BANK  CASH_ON_HAND  OWNER }
enum AccountOwnership { COMPANY  OWNER }

model Payment {
  // … existing fields …
  paidFrom    PaymentSource?   // PAYMENT direction only; null on receipts
  feeAmount   Decimal?  @db.Decimal(15, 2) // bank / Tamara fee on the slip → 6500
  beneficiary String?          // as printed on the slip
  beneficiaryAccount String?   // IBAN / account as printed
  payerAccountRef    String?   // payer IBAN or card last 4 as printed
}

model BankAccount {
  // … existing fields …
  ownership AccountOwnership @default(COMPANY)
  cardLast4 String?          // for matching card slips; last 4 digits only, never a full card number
}
```

- Migration is additive (nullable columns, defaulted enum) — no existing row changes meaning.
- The GM's personal account is a BankAccount row with `ownership = OWNER`. It is excluded from
  invoice/quotation default-account pickers (they filter `ownership = COMPANY`).
- Backfill (step 6): the 64 `[PAYBACKFILL2025]` payments get `paidFrom` from their ledger credit —
  1010 → COMPANY_BANK (52), 1000 → CASH_ON_HAND (5), 2400 → OWNER (7). Fees already booked in the
  same entry are copied to `feeAmount`. No ledger change.

## 2. Posting rule (fix in `accounting.service.ts` postAll)

A pure helper `paymentCreditAccount(p)` decides the credit side, unit-tested on its own:

| Payment | Credit |
|---|---|
| direction PAYMENT, paidFrom COMPANY_BANK (or null with a company bankAccountId) | 1010 |
| paidFrom CASH_ON_HAND | 1000 |
| paidFrom OWNER (or bankAccount.ownership OWNER) | 2400 |
| paidFrom null, no bank account, method CASH | 1000 |
| anything else unresolved | skip, reported as "needs paid-from" — never guessed |

Entry: Dr 2000 `amount`, Dr 6500 `feeAmount` (if any), Cr the account above for `amount + fee`.
Memo: `Supplier payment PAY-… — <reference> — <expense number>`; sourceType PAYMENT, sourceId payment.id.
Receipts (direction RECEIPT) are unchanged. Payments already linked to an entry are never posted again (existing `done` set).

## 3. Slip reader (backend, `finance/payments/slip-reader`)

`POST /finance/payments/read-slip` (multipart, one file: png/jpg/pdf, ≤10 MB) → **reads only, saves nothing**
except the uploaded file in a temporary area keyed by an upload token. Returns:

```ts
{ uploadToken: string; text: string; engine: 'ocr' | 'ocr+ai' | 'none';
  fields: { [k in SlipField]?: { value: string; source: 'slip' | 'ai' } };
  suggestedPaidFrom?: 'COMPANY_BANK' | 'OWNER'; suggestedBankAccountId?: string;
  warnings: string[] }
// SlipField = date | amount | currency | reference | beneficiary | beneficiaryAccount
//           | payerAccountRef | remark | fee
```

- **Text:** PDF with a text layer → pdf-parse; otherwise tesseract.js `eng+ara` (image, or PDF pages
  rasterised as `script-import.service.ts` already does). Reuse that OCR code by moving it to a shared
  util rather than copying it.
- **Rules** (pure function `parseSlipText(text)`, unit-tested with real slip texts): UAE IBAN
  `AE\d{21}`; amounts near "AED"/"Amount"; dates dd/mm/yyyy, dd-MMM-yyyy, yyyy-mm-dd; ADCB
  `O/W TRF \d{9}`, ProCash "Customer Reference"/"Transaction Reference"; card "ending/xxxx \d{4}";
  "Beneficiary"/"المستفيد" lines; fee lines ("charges", "fee", "رسوم").
- **AI fallback:** only when amount, date or reference is missing after the rules. Sends the OCR text
  with a fixed JSON-only prompt via `AiService.complete` (task `payment-slip-read`); response is
  validated field by field; any field the rules already found is kept, not overwritten.
  If the AI is unavailable, the form still opens with what the rules found.
- **Suggestions:** payer IBAN / card last 4 matched against BankAccount (`iban`, `accountNumber`,
  `cardLast4`) → suggested account and paidFrom (COMPANY → COMPANY_BANK, OWNER → OWNER).
- **Warnings:** beneficiary does not resemble the expense's supplier name/trade name; amount above
  the expense's unpaid balance; reference + amount already on another payment.

## 4. Record payment (backend)

`POST /finance/expenses/:id/payments` body:
`{ paidFrom, bankAccountId?, method, paymentDate, amount, feeAmount?, currency, reference?,
   beneficiary?, beneficiaryAccount?, payerAccountRef?, notes?, uploadToken? }`

In one transaction:
1. Validate: amount > 0; paidFrom COMPANY_BANK needs a COMPANY bank account; OWNER allows an OWNER
   account or none; CASH_ON_HAND has no bank account; method consistent (CASH only with CASH_ON_HAND).
2. **Duplicate guard:** refuse if another PAYMENT has the same `reference` and `amount` (409 with the
   existing payment number).
3. Create the Payment (`PAY-YYYY-NNNN`, next number for the payment-date year, status CLEARED,
   clearedAt = paymentDate, supplierId from the expense). `notes` keeps the OCR text summary line.
4. If `uploadToken`: move the slip into uploads, create DocumentAttachment on the EXPENSE
   (kind SUPPORTING, title "Payment slip PAY-…") and a SupplierDocument (docType OTHER);
   store the raw OCR text with the attachment.
5. Post the entry with the section-2 rule.
6. Set the expense PAID / paidAt when payments ≥ totalAmount.

`GET /finance/expenses/:id/payments` → payments + slips + unpaid balance.
All errors are clean 4xx messages; nothing is written when any step fails.

## 5. Screen (frontend, expense detail)

- **Payments block:** table of payments (number, date, paid from, method, amount, fee, bank reference,
  beneficiary, slip link, ledger entry), then "Unpaid: X".
- **Record payment** drawer:
  1. Drop zone for the slip (optional) → spinner "Reading slip…" → form fills.
  2. Form fields as in section 4. Each field shows a tag: *read from slip* / *filled by AI* / *you typed*
     (a field changes to *you typed* when edited). Slip preview beside the form (image or first PDF page).
  3. Warnings shown above the Save button; they inform, they do not block (except the duplicate guard,
     which the server enforces).
  4. **Save** calls section 4; **Cancel** discards (temporary upload expires after 24 h).
- "Paid from" radio: Company bank · Cash on hand · Me personally. Bank-account picker shows company
  accounts for Company bank and personal accounts for Me personally.
- Settings → Bank accounts: add an "Account belongs to" choice (Company / Owner) and "Card last 4".

## 6. Build order (≤3 files each, each verified before the next)

1. Migration SQL + schema.prisma (review; applied only on "apply"); then `prisma generate`.
2. Posting rule helper + spec + postAll change.
3. Shared OCR util (moved from script-import) + `parseSlipText` + spec with real slip texts.
4. Slip-read endpoint with AI fallback + suggestions/warnings.
5. Record-payment endpoint (transaction, duplicate guard, attachments, posting).
6. Frontend payments block + Record payment drawer; bank-account settings fields.
7. Backfill `paidFrom` / `feeAmount` on the 64 existing payments (script, dry run first, backup).

## Testing

- node:test for `paymentCreditAccount`, `parseSlipText` (ADCB O/W TRF, ProCash e-mail, AVEC screenshot,
  a card slip, an Arabic slip) and the record-payment validation.
- After each DB step: trial balance 0.00 and 2025 result (49,010.13) unchanged unless the step posts a new payment.

## Out of scope

Matching slips to the bank-statement import automatically; reimbursing the GM (paying down 2400) — that
stays a normal owner-account transfer.
