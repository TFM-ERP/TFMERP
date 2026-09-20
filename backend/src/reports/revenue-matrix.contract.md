# Report contract — Revenue matrix (client × revenue line)

Status: **agreed and implemented.** Written 2026-08-21, §3 settled and built
2026-08-22, per `.claude/skills/building-tfm-accounting-reports`.
Implementation: `revenue-matrix.util.ts` (calculation), `reports.service.ts`
(query + view model), `../accounting/revenue-mapping.util.ts` (the mapping both
the ledger and this report use). Tests: `revenue-matrix.util.spec.ts`,
`reports-authorization.spec.ts`.

## 1. Purpose and audience

Management and the accountant. Which clients generate revenue, split across the
three revenue lines the general ledger recognises. It is **not** an FTA artifact —
the VAT return remains the statutory output — but it must reconcile to the ledger,
so an accountant can use it as a substantiating schedule.

## 2. Source of truth

`Invoice`, not `JournalLine`. Layer A, per the two-ledger note in
`references/system-architecture.md`.

`JournalLine` gains **no client dimension**. The ledger stays a ledger; client
attribution lives on the sub-ledger document that already carries `clientId`.
The two are tied together by the invariant in §8 rather than by a schema change.

## 3. Column mapping — SETTLED

Columns are derived from `Invoice.activity` using the same mapping `postAll()`
uses for the GL revenue account. The `Activity` enum has **seven** values, not
three:

| `Activity` | GL account | Column | Settled? |
|---|---|---|---|
| `RENTAL` | 4000 | Rental | yes |
| `PRODUCTION` | 4100 | Production | yes |
| `PRODUCTION_SERVICE` | 4100 | Production | yes |
| `BOOK_DESIGN` | 4200 | Other | yes |
| `WEB_DESIGN` | 4200 | Other | yes |
| `EVENTS` | 4200 | Other | yes |
| **`BOTH`** | **4150** | **Rental + Production** | **yes** |

`BOTH` is **18 of the 19 posted invoices and AED 561,122.62 of AED 611,122.62 —
91.8% of all revenue.** Before this change `postAll()` sent it to 4200 Other
Income, which is why the ledger showed a single revenue line.

It cannot be split from data. `InvoiceItem` has no activity field; its only
proxy, `kind`, is `SERVICE` on **all 23 line items in the database** and has never
been varied. There is no field that substantiates an allocation, so any split
would be invention.

**Decision: `BOTH` gets its own revenue line, `4150 Rental & Production
(combined)`** — option (c) in §11. Nothing is allocated that cannot be
substantiated, the invariant stays exact, and the ambiguity is visible on the
face of the report rather than hidden inside Other. The account was added to
`STANDARD_COA`, and `postAll()` now calls `ensureAccounts()` for every revenue
line first — an install seeded before 4150 existed would otherwise have had
`je()` silently drop every `BOTH` invoice, since a missing code returns null with
no error.

Re-posted 2026-08-22: 19 invoice entries deleted and rebuilt under the new
mapping. Resulting balances — 4000: 0.00, 4100: 0.00, **4150: 561,122.62**,
4200: 50,000.00.

## 4. Date basis

`Invoice.issueDate`, inclusive of both bounds. Chosen because `postAll()` dates
each journal entry `inv.issueDate || inv.createdAt`, so the matrix and the ledger
select the same invoices for the same window. Accrual basis, matching UAE VAT and
a P&L; `paymentDate` is irrelevant here and `Payment` is empty regardless.

## 5. Status filter

`status IN (SENT, PARTIALLY_PAID, PAID, OVERDUE)`.

Exactly `postAll()`'s filter, and deliberately **not** the `notIn (CANCELLED,
DRAFT)` used by `/reports/revenue-by-client` — that admits `PENDING_APPROVAL`,
`VOIDED`, `REFUNDED` and `BAD_DEBT`, none of which are posted to the ledger. The
invariant in §8 cannot hold under any other filter.

## 6. Values

**Net of VAT**, as `total − vatAmount`, per row and per column.

Not `subtotal`. `subtotal` is struck *before* `discountAmount` and
`deductionAmount`, whereas `postAll()` credits revenue as `net = total − vat`.
The two coincide today only because every discount and deduction in the data is
zero — verified: 0 of 23 invoices where `subtotal − discount − deduction + vat ≠
total`. Using `subtotal` would silently break the invariant the first time
anyone applies a discount.

Arithmetic on `Prisma.Decimal` throughout; converted to `number` once, at the
JSON response boundary.

## 7. Credit notes, voids, currency, VAT, rounding

- **Credit notes** — `invoiceType = CREDIT_NOTE` is included and **subtracted**.
  Amounts are stored positive, so the calculation applies the sign; the query
  does not. This matches `postAll()`, which posts a credit note through the same
  path as an invoice.
- **Voided** — excluded by §5. `VOIDED`, `CANCELLED`, `REFUNDED` and `BAD_DEBT`
  are distinct states and none are revenue.
- **Currency** — AED only. `Invoice` carries no original-currency pair (only
  `Expense` does), and `FxRate` has no history, so a historical restatement is
  not derivable. Report is denominated in AED and says so on its face.
- **VAT** — excluded from every figure, per §6.
- **Rounding** — none. Values are exact `Decimal(15,2)` sums; rounding happens
  only in presentation. One boundary, stated: `.toNumber()` at the response.

## 8. Invariant — the test

> For any period, the matrix grand total equals GL revenue for the same period,
> to the fils.

GL revenue = sum of `JournalLine.credit − JournalLine.debit` over lines whose
`GlAccount.type = REVENUE`, on `JournalEntry` with `status = POSTED` and
`date` within the period.

Expressed as an assertion:

```
matrix.grandTotal === glRevenue(from, to)     // exact Decimal equality, not epsilon
```

Per-column invariant:

```
matrix.column[Rental]              === glAccountBalance('4000', from, to)
matrix.column[Production]          === glAccountBalance('4100', from, to)
matrix.column[Rental + Production] === glAccountBalance('4150', from, to)
matrix.column[Other]               === glAccountBalance('4200', from, to)
```

Verified against live data 2026-08-22: matrix grand total 611,122.62, GL revenue
611,122.62, variance **0.00**.

Known precondition: this holds only while every eligible invoice is posted.
`GET /accounting/posting-status` must report 0 unposted invoices, or the
invariant fails legitimately and the report must say so rather than appear to
reconcile. The report surfaces an explicit variance row if it does not tie.

## 9. States

- **Empty** — full frame, column headers, one "No invoices for this period" row,
  filters still shown.
- **Loading** — skeleton rows at final column widths.
- **Error** — what failed and the filters attempted; never a partial matrix.
- **Not reconciled** — the matrix renders with a visible variance row stating the
  difference and the unposted count. Never silently balanced.
- **Forbidden** — message only, no data shape leaked.

## 10. Outputs and authorization

Screen and print, sharing `DocumentLayout`'s print foundation. CSV only if asked;
no XLSX (no spreadsheet library exists on either side — that is a dependency
decision, not an assumption).

`@UseGuards(JwtAuthGuard, PermissionsGuard)` + `@RequirePermission('finance', 1)`.
`ReportsController` currently has no permission guard at all; this endpoint does
not inherit that defect.

## 11. The decision, as taken

Where does `BOTH` belong? It is 91.8% of revenue. **Option (c) was chosen.**

- **(a) Other (4200)** — status quo. Truthful, no re-post needed, but the matrix
  is ~92% one column and tells you little.
- **(b) Production (4100)** — if "both" in practice means production jobs that
  include kit hire. Makes Production dominant and Rental near-empty.
- **(c) A fourth line, 4150 "Rental & Production (combined)"** — CHOSEN. Keeps the
  invariant exact, allocates nothing that cannot be substantiated, and makes the
  ambiguity visible on the face of the report instead of hiding it in Other.
  Costs one GL account, a fourth column, and a re-post.
- **(d) Split by a fixed ratio** — not recommended. No field substantiates it and
  it would misstate both lines.

Re-posting after any mapping change means deleting the affected journal entries
first: `postAll()` is idempotent and skips anything already posted. Cheapest now,
at 182 entries.
