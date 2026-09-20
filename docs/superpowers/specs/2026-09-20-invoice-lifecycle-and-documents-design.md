# Invoice lifecycle and document folders — design

**Date:** 20 September 2026
**Author:** Claude, with Qais Qandil
**Status:** awaiting review before implementation

---

## 1. Why

Two requests, one afternoon:

> "I need a delete option for invoices with an admin password, also I need a
> folder for each invoice and document uploaded for each invoice and customer,
> and I need to sort all provided here into those folders — so if the invoice was
> manually provided it should be there, and if it is system generated to have a
> copy there."

Both arrive on the day a reconstruction of the 2025 accounts found **five sales
that existed on paper and nowhere in the ledger**. That context shapes the
design: the system should make things disappear *visibly*, and it should keep
every document that proves a number.

## 2. What already exists

Most of this is modelled and never wired up.

| | State |
|---|---|
| `DocumentAttachment` | **Exists, unused.** Polymorphic: `entityType` (`AttachmentEntity`: INVOICE, EXPENSE, PAYMENT, PURCHASE_ORDER, QUOTATION, CREDIT_NOTE), `entityId`, `kind` (`DocumentKind`: SOURCE, GENERATED, SUPPORTING), `name`, `provider`, `url`, `mimeType`, `sizeBytes`, `sourceRef`, `notes`, `uploadedById`. Indexed on `[entityType, entityId]` and on `sourceRef`. |
| `ClientDocument` | **Exists and is wired.** `clients.service.ts` has create and delete. This is the customer folder. |
| `AuditLog` | **Exists and is wired** via `src/audit/audit.interceptor.ts`. `userId`, `action`, `resource`, `resourceId`, `oldValue`, `newValue`, `ipAddress`. |
| `InvoiceStatus` | Already has `DRAFT`, `PENDING_APPROVAL`, `SENT`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `CANCELLED`, `VOIDED`, `REFUNDED`, `BAD_DEBT`. |
| Upload | `src/upload/upload.controller.ts` — `POST /upload`, multer `diskStorage` to `backend/uploads/`, UUID filenames, 15 MB, jpg/jpeg/png/pdf/webp/heic/fdx/docx/txt/fountain. |
| Delivery | `src/files/files.module.ts` — guarded: Bearer, or a short-lived HMAC `?t=` token for `<iframe>`/`<img>`. |
| Passwords | `bcryptjs`, `bcrypt.compare` already used in `src/auth/auth.service.ts`. `User.passwordHash`, `User.role`. |
| PDF | **`puppeteer` ^23.11.1 and `pdf-lib` ^1.17.1 already in `backend/package.json`.** |

**No new third-party dependency is required for any of this.**

Missing: any delete, void or archive endpoint on invoices; any use of
`DocumentAttachment`; an `archivedAt` column.

## 3. How other accounting systems handle deletion

| | Rule |
|---|---|
| Xero | Delete a draft. Once approved, **void**. Cannot void an invoice with payments until the payments are removed. |
| QuickBooks | Void keeps the number and the audit trail. Delete removes it. Void is the default advice. |
| Oracle JD Edwards | A posted invoice is **voided with a reversing entry**, never deleted. |
| Dynamics NAV | Posted documents **cannot be deleted**. Correct with a credit memo. |

Universal line: **delete a draft, void what has posted.** UAE reinforces it — the
FTA requires records to be kept **five years**, so a tax invoice that was issued
and declared cannot simply be removed.

## 4. Design — three verbs

One button was asked for; three are needed, because the four cases behind the
request pull in different directions.

### 4.1 Archive

Hides an invoice from the default list. Nothing else changes.

- New column `Invoice.archivedAt DateTime?`.
- List endpoints exclude `archivedAt != null` unless `?archived=true`.
- Reversible: unarchive clears the column.
- **No password.** It destroys nothing.
- Writes `AuditLog` with `action: 'ARCHIVE'` / `'UNARCHIVE'`.

### 4.2 Void

The invoice existed and is cancelled. The number and the document survive.

- `status` → `VOIDED`, `amountDue` → 0.
- Posts a **reversing journal** dated the void date, exactly mirroring the
  original: Dr 4150 (net), Dr 2100 (VAT), Cr 1100 (total). Memo names the
  original entry and the reason.
- **Refused if any `Payment` with `direction: RECEIPT` and `status: CLEARED`
  exists against it.** Those must be reversed or refunded first, as in Xero.
  The error names the receipts.
- Requires the user's **login password** and a **reason** (free text, stored on
  `internalNotes` and in the audit log).
- Writes `AuditLog` with `action: 'VOID'`, `oldValue` = full invoice snapshot.

### 4.3 Delete

The invoice should never have existed.

- Removes the invoice, its `InvoiceItem` rows, its journal entry and lines, and
  its `DocumentAttachment` rows. Uploaded files on disk are **kept** (they may be
  referenced elsewhere) and listed in the audit entry.
- **Refused unless all three hold:**
  1. no journal entry with `sourceType: 'INVOICE'` and `sourceId` = this invoice;
  2. no `Payment` rows against it;
  3. `status` is `DRAFT` or `CANCELLED`.
- If refused, the response says why and offers **void** instead.
- Requires the user's **login password**, the **invoice number typed back**, and
  a **reason**.
- Writes `AuditLog` with `action: 'DELETE'` and `oldValue` = the entire invoice
  with its items, journal and attachment list, so the row is reconstructable from
  the log.

**Posted invoices can never be deleted through the UI.** Bulk removal of posted
test data is a one-off script with a database backup, not a button.

### 4.4 The admin check

Chosen: **the user's own login password.** No new shared secret; the audit log
names the person, not "whoever knew the password".

- `POST` body carries `password`.
- Service loads `User.passwordHash` for `req.user.id` and calls `bcrypt.compare`.
- Failure → `401` with a generic message; the attempt is written to `AuditLog`
  with `action: 'DELETE_DENIED'` / `'VOID_DENIED'`.
- Rate limit: 5 failures per user per 15 minutes, then locked for 15 minutes.
  Held in memory — a restart clears it, which is acceptable for a single-tenant
  system and adds no dependency.
- **Claude never sets, reads or handles the password.** Qais's own account
  password is the credential; nothing is added to `.env`.

## 5. Design — document folders

### 5.1 The model

- **Invoice folder** = `DocumentAttachment` where `entityType = 'INVOICE'` and
  `entityId` = the invoice id.
- **Customer folder** = `ClientDocument` for that client, already working.

`DocumentKind` carries exactly the distinction that was asked for:

| Kind | Meaning | Example from today |
|---|---|---|
| `SOURCE` | The document as it arrived | The Action Filmz invoice 204460 PDF |
| `GENERATED` | Something this system produced | The system's own PDF of invoice 250655 |
| `SUPPORTING` | Evidence around it | Al Sayegh PO `AUH2025-1274`, cheque image 008539, the Emirates NBD payment advice |

### 5.2 PDF snapshots, deduplicated

A PDF of the invoice is rendered **whenever the invoice is viewed or printed**,
per the decision taken — but stored only when it differs from the last one.

- `invoice-pdf.service.ts` renders `/print/invoice/:id` with the already-installed
  `puppeteer`, A4, `printBackground: true`.
- SHA-256 of the PDF bytes → `sourceRef` as `sha256:<hex>`.
- Before writing, look for a `DocumentAttachment` on this invoice with that
  `sourceRef`. If one exists, **return it and store nothing.**
- Otherwise save to `uploads/` with a UUID name and create the attachment with
  `kind: 'GENERATED'`, `name: "<invoiceNumber> — <ISO date>.pdf"`.

Viewing an unchanged invoice fifty times therefore yields one file; the moment
the invoice changes, a new copy appears beside the old one. Intent preserved,
clutter avoided.

### 5.3 Export

A browsable tree, for OneDrive or an auditor:

```
Exports/
  Al Sayegh Media/
    250655/
      250655.pdf
      AUH2025-1274 purchase order.pdf
      bank advice 580544105.pdf
    250640/
      ...
  _customer-documents/
    Al Sayegh Media/
      trade licence.pdf
```

- Folder names sanitised: `[^A-Za-z0-9 ._-]` → `-`, trimmed to 80 characters,
  de-duplicated with a numeric suffix.
- Written under `backend/exports/<timestamp>/`. **Files are copied, not moved** —
  `uploads/` remains the store of record.
- **No zip.** `archiver`, `jszip` and `adm-zip` are all absent from
  `package.json` and adding one is out of bounds. The endpoint returns the
  absolute folder path and the file count; the user copies the folder to
  OneDrive or hands it over as it is. If a zip is wanted later it is a separate
  decision with its own dependency approval.
- Endpoint is admin-role only and writes `AuditLog` with `action: 'EXPORT'`.
- `backend/exports/` is added to `.gitignore`.

## 6. API surface

All under the existing `/api/v1` prefix, on the invoices controller, with
`@RequirePermission('finance', …)` matching the existing pattern.

| Method | Path | Body | Guard |
|---|---|---|---|
| `POST` | `/finance/invoices/:id/archive` | — | finance ≥ 2 |
| `POST` | `/finance/invoices/:id/unarchive` | — | finance ≥ 2 |
| `POST` | `/finance/invoices/:id/void` | `password`, `reason` | finance ≥ 3 |
| `DELETE` | `/finance/invoices/:id` | `password`, `reason`, `confirmNumber` | finance ≥ 3 |
| `GET` | `/finance/invoices/:id/documents` | — | finance ≥ 1 |
| `POST` | `/finance/invoices/:id/documents` | `url`, `name`, `kind`, `notes?` | finance ≥ 2 |
| `DELETE` | `/finance/invoices/:id/documents/:docId` | — | finance ≥ 2 |
| `POST` | `/finance/invoices/:id/snapshot` | — | finance ≥ 1 |
| `POST` | `/finance/documents/export` | `from?`, `to?`, `clientId?` | admin |

`DELETE` with a body is unusual but correct here: the password must not appear in
a URL or a server log. Nest supports `@Body()` on `@Delete()`.

`finance, 3` is not used anywhere in the codebase today, but level 3 exists and
is in use for `setup` and `production`. Void and delete are the first finance
actions to need it, which is the point: they should not be available to whoever
can raise an invoice.

## 7. Data changes

One column and one migration:

```prisma
model Invoice {
  // …
  archivedAt DateTime?
}
```

Nothing else. `DocumentAttachment`, `ClientDocument` and `AuditLog` are used as
they already stand.

## 8. Frontend

| File | Change |
|---|---|
| `lib/api.ts` | `invoices.archive/unarchive/void/remove`, `invoices.documents.list/attach/detach`, `invoices.snapshot`, `documents.export` |
| `finance/invoices/[id]/page.tsx` | **Documents** section (list by kind, upload, remove); **Archive**, **Void** and **Delete** in a menu; a confirm modal that takes password, reason and — for delete — the invoice number typed back; a `VOIDED` banner |
| `finance/invoices/page.tsx` | "Show archived" toggle; archived rows dimmed |
| `clients/[id]/page.tsx` | Documents tab beside the Transactions tab added earlier today |

The confirm modal is one shared component so delete and void cannot drift apart.

## 9. Testing

`node --test` as the project already runs it (1,309 tests currently pass). New
tests in `src/finance/invoices/*.spec.ts`:

- void posts a reversing journal whose lines are the exact negative of the
  original, and the trial balance still nets to zero;
- void is refused when a cleared receipt exists, and the error names it;
- delete is refused when a journal exists; refused when a payment exists;
  refused when the status is `SENT`;
- delete succeeds on a `DRAFT` with no journal, and removes items and attachments;
- a wrong password returns 401 and writes a `*_DENIED` audit row;
- the rate limiter locks after five failures;
- snapshot twice on an unchanged invoice creates **one** attachment; snapshot
  after an edit creates a second;
- archive hides from the default list and `?archived=true` shows it;
- export sanitises a client name containing `/` and does not escape its root.

## 10. Out of scope

- Credit notes. Voiding is enough for now; a credit note is a separate document
  with its own number series and belongs in its own spec.
- Bulk delete of posted test data — a script with a backup, not a button.
- Moving existing flat uploads into per-invoice storage. Files stay where they
  are; the folder is a view over them.
- Versioning uploaded source documents. A replacement is a new attachment.

## 11. Implementation order

Three files per batch, each shown before the next begins.

1. `schema.prisma` + migration · `invoices.service.ts` · `invoices.controller.ts` — archive, void, delete, password check, audit
2. `invoice-pdf.service.ts` · `invoices.service.ts` · `invoices.controller.ts` — documents and deduplicated snapshots
3. `lib/api.ts` · `finance/invoices/[id]/page.tsx` · `finance/invoices/page.tsx` — UI
4. `document-export.service.ts` · controller · `clients/[id]/page.tsx` — export and the customer tab
5. Backfill script — sort every document provided on 20 September into the right
   invoice and customer folders

## 12. Backfill inventory

Documents supplied during the 20 September session, and where each belongs:

| Document | Folder | Kind |
|---|---|---|
| Action Filmz invoice 204460 | invoice 204460 | SOURCE |
| Cheques 008539 and 008682 (images) | invoice 204460 | SUPPORTING |
| Thirteen01 invoices 250118 and 250120 | invoices 250118, 250120 | SOURCE |
| Al Sayegh 250655, 250656 | invoice 250655 | SOURCE |
| Al Sayegh PO `AUH2025-1274` | invoice 250655 | SUPPORTING |
| Al Sayegh 20458, quotation 204458 | invoice 20458 | SOURCE |
| Alter Films 204443 | invoice 204443 | SOURCE |
| Emirates NBD advice, Alter Films 2 Dec 2024 | invoice 204443 | SUPPORTING |
| Vertigo 25120 + RAKBANK receipt | invoice 25120 | SOURCE, SUPPORTING |
| Dubai Media quotation 22605 | invoice 26037 | SUPPORTING |
| Khalifa proformas, task order, delivery note 204723 | client Khalifa Award | — |
| MacGregor AJM501 | expense `EXP-2025-0001` | SOURCE |
| Senci INV#8322, INV#8548, SB25070034, repair form 2250 | client / expense records | SOURCE |
| Abu Dhabi Printing 114104 | expense `filed-2025-2026-0136` | SOURCE |
| Chevrolet registration card | fixed asset record | SUPPORTING |
| ADCB statements, 2025 and 2026 | company documents | SUPPORTING |

## 13. Open questions

None. Every decision above was taken with Qais on 20 September 2026.
