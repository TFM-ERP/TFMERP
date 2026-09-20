# Invoice Lifecycle UI — Design

**Date:** 2026-09-20
**Backend:** complete and merged on `feat/invoice-lifecycle`. This spec covers only the
frontend, which spec §8 of the lifecycle design left unbuilt.

## Goal

Give the three lifecycle verbs a face in the Next.js dashboard: archive an invoice out of
the way, void one properly, delete one that never posted — with enough friction on the
dangerous two to stop a mistake and none on the safe one beyond a single confirm.

## What the backend gives us — fixed, do not change

All under `/api/v1/finance/invoices`:

| Route | Permission | Body | Effect |
|---|---|---|---|
| `POST :id/archive` | `finance:2` | — | Hides from the default list. Reversible. |
| `POST :id/unarchive` | `finance:2` | — | Puts it back. |
| `POST :id/void` | `finance:3` | `{ password, reason }` | Cancels it, posts a reversing journal entry. |
| `DELETE :id` | `finance:3` | `{ password, reason, confirmNumber }` | Removes it. Only when nothing posted. |

- An invoice with a posted journal entry or a cleared receipt can **never** be deleted,
  only voided. The API refuses with a plain-English reason and often a suggestion
  (`VOID` or `ARCHIVE`).
- Delete is permitted only for DRAFT and CANCELLED.
- `password` is the user's own login password, typed at the time. Five wrong ones lock
  that user out of these actions for fifteen minutes.
- `confirmNumber` is the invoice number, typed back by hand.
- `finance:3` is held only by SYSTEM_ADMIN and FINANCE_MANAGER.

## What the codebase already has

- **No row menu anywhere.** Every list row ends in `Open →`; all row-level flows are
  "open the record, then act." The detail page has a toolbar of `btn-secondary` /
  `btn-primary` buttons.
- **No shared Modal, Dialog, Toast or Confirm component.** Modals are written inline in
  the page that uses them (`PaymentModal`, `ShareModal` both live inside
  `invoices/[id]/page.tsx`). That is the house style, not an oversight. Convention:
  `fixed inset-0 bg-black/40 … rounded-2xl`, header with an `X`, footer with
  `btn-secondary` Cancel and a coloured confirm.
- **No password re-entry pattern exists.** This is new, and it should look deliberately
  unfamiliar — that is the point.
- **No client-side permission check on desktop.** `lib/mobileAccess.tsx` has `can()` for
  mobile only. On desktop every button renders for everyone and the server 403s on click.
- **i18n**: `lib/i18n.ts` gives `useLocale()` → `{ t, isRTL, dir }`, Arabic keyed by the
  English string, falling back to the English key when missing. The list page uses `t()`;
  the detail page does not yet.
- **`VOIDED` already exists** in `statusConfig.ts` with a badge and, critically, as a
  reachable target in `WORKFLOW_TRANSITIONS.Invoice.SENT`.

## The three decisions the owner made

1. **Close the back door.** `WORKFLOW_TRANSITIONS.Invoice.SENT` currently lists `VOIDED`,
   so the ordinary Change Status dialog can mark an invoice voided with a free-text note,
   no password, and **no reversing journal entry** — leaving the revenue in the books.
   Remove `VOIDED` from that transition list and from `REQUIRES_NOTES.Invoice`. After
   this, the only way to reach `VOIDED` is the new action.
2. **Archive gets a short confirm box** — "Archive invoice {number}?" with Cancel and
   Archive — rather than the undo-bar the research argued for. The owner's call.
3. **Hide Void and Delete** from anyone without `finance:3`, which means building the
   desktop permission check first.

## Where each action lives

Archive / Unarchive: a row button in the list beside `Open →`, plus a toolbar button on
the detail page, plus a `Show archived invoices` checkbox in the list filter bar next to
the existing `Overdue only`.

Void and Delete: detail page only, in a new `More ▾` dropdown beside `Change Status`.
Not in the list row — this app has no row menu, and both need multi-field confirmation
that does not belong in a table cell. Matches Xero's Options-on-the-record and Ignition's
More-actions-on-the-record.

```
Detail toolbar:  [Edit] [Change Status] [More ▾] [History] [Record Payment] [Print] [Share]

                                More ▾
                                ┌──────────────────────────────┐
                                │ Archive                       │  finance:2
                                │ Void Invoice                  │  finance:3 — hidden otherwise
                                │ Delete Invoice                │  finance:3, DRAFT/CANCELLED only
                                └──────────────────────────────┘
```

## Copy

Every string below goes through `t()`. Arabic entries are needed for all of them except
the free-text reason the user types and the `{number}` / `{date}` / `{user}` values.

| Element | Copy |
|---|---|
| List filter | `Show archived invoices` |
| Archive button | `Archive` |
| Archive confirm title | `Archive invoice {number}?` |
| Archive confirm body | `It disappears from your invoice list. Nothing about the invoice or your numbers changes, and you can put it back any time.` |
| Archive confirm button | `Archive` |
| Archived detail banner | `Archived on {date} by {user}. Hidden from the default list — nothing about the invoice or its numbers changed.` with `Unarchive` |
| Archived row tag | `Archived` |
| Void menu item | `Void Invoice — cancel it for good` |
| Void dialog title | `Void invoice {number}?` |
| Void dialog body | `This invoice has already gone out, or money has moved against it, so it can't simply be deleted. Voiding cancels it and posts a reversing entry in your books — the record stays, marked cancelled, for your audit trail. This cannot be undone.` |
| Void reason | Label `Why are you voiding this?` · placeholder `e.g. wrong client, duplicate invoice, job cancelled` |
| Void password | Label `Confirm it's you — type your login password` |
| Void confirm button | `Void This Invoice` (red) |
| Voided detail banner | `Voided on {date} by {user}. Reason: "{reason}". A reversing entry was posted to the ledger.` |
| Delete menu item | `Delete Invoice — erase it completely` |
| Delete menu item, disabled | tooltip `Can't delete — money has already moved against this invoice. Void it instead.` |
| Delete dialog title | `Permanently delete invoice {number}?` |
| Delete dialog body | `This removes the invoice completely — there will be no record of it anywhere, and this cannot be undone. It's only possible because nothing has posted to your books yet.` |
| Delete type-to-confirm | Label `Type the invoice number to confirm: {number}` |
| Delete password | Label `Confirm it's you — type your login password` |
| Delete confirm button | `Delete Permanently` (red, disabled until both fields valid) |
| Refusal, ledger touched | `Can't delete "{number}" — a journal entry has already posted against it. Void it instead to cancel it properly.` with a `Void Instead` button |
| Refusal, receipt cleared | `Can't delete "{number}" — a payment has been recorded and cleared against it. Void it instead.` |
| Lockout | `Too many wrong passwords. This is locked for 15 minutes. Try again after {time}.` |
| Network failure | `Something went wrong sending that — the invoice hasn't changed. Check your connection and try again.` |

## Dialog design

**Archive** — title, one sentence of body, Cancel and Archive. No password, no typing.

**Void** — reason first (required, minimum 5 characters), then password. That order is
deliberate: say *why* before proving *who*, so the reason is not an afterthought typed to
unlock a button. No type-to-confirm; that budget is spent on Delete.

**Delete** — invoice number typed back first, then password. Type-to-confirm belongs here
and only here, because delete is the one genuinely irreversible action. Reserving it keeps
it meaningful.

Both: confirm disabled until every field is valid, nothing pre-filled, red button with a
descriptive label — never "Yes" or "Confirm".

## After the action

**Voided**: existing `Voided` badge (swap its 🗑️ icon, which reads as deleted, for 🚫),
a red-tinted banner with reason, date and user, line items at reduced opacity, Edit /
Record Payment / Change Status removed, row stays in the list, `VOIDED` added to the list
page's status filter options.

**Archived**: no new status badge — archive is orthogonal to status, an invoice can be
SENT *and* archived. A muted `Archived` tag beside the existing badge, the banner above,
hidden from the default list, everything else unchanged.

## Permissions

`useCan('finance', 3)` — a new desktop hook, since none exists. Fetches the current user's
permissions once at layout level and exposes a synchronous check. Void and Delete are not
rendered at all without it. Archive follows `finance:2`.

While permissions are still loading, render nothing rather than flashing the items and
withdrawing them.

## API client

```ts
archive:   (id: string) => api.post(`/finance/invoices/${id}/archive`),
unarchive: (id: string) => api.post(`/finance/invoices/${id}/unarchive`),
voidInvoice: (id: string, data: { password: string; reason: string }) =>
               api.post(`/finance/invoices/${id}/void`, data),
remove:    (id: string, data: { password: string; reason: string; confirmNumber: string }) =>
               api.delete(`/finance/invoices/${id}`, { data }),
```

`DELETE` with a body needs axios's `{ data }` config form. Named `remove` to avoid the
reserved-word confusion with the existing bodyless `quotations.delete`.

## Failure handling

- **Lockout** — catch the specific response and replace the form with the lockout message.
  Do not let the user keep hammering the password field.
- **Refusal** — render the API's own reason, with a one-click `Void Instead` or
  `Archive Instead` that opens the right dialog, rather than a bare error string.
- **Wrong invoice number** — inline validation once they have typed something, confirm
  stays disabled, no separate error state.
- **Network failure** — assume nothing happened; both endpoints are single atomic calls.
  Keep the dialog open with the fields intact so nobody retypes a password.

## Build order

1. `useCan` — everything else depends on it.
2. Close the back door in `statusConfig.ts`.
3. API client methods.
4. Archive / Unarchive, the list toggle and the archived tag — proves the pattern end to end.
5. Void — the reason-plus-password dialog, refusal handling, the voided treatment.
6. Delete — reuses Void's dialog shell, adds type-to-confirm.

Deferred: bulk archive from the list, a separate Archived tab, a `VOID` watermark on the
printed PDF.

## Files

- `frontend/src/lib/permissions.ts` (new) — `useCan`
- `frontend/src/lib/api.ts` — four methods
- `frontend/src/lib/statusConfig.ts` — close the back door, swap the icon
- `frontend/src/lib/i18n.ts` — Arabic strings
- `frontend/src/app/(dashboard)/finance/invoices/page.tsx` — toggle, archive button, tag
- `frontend/src/app/(dashboard)/finance/invoices/[id]/page.tsx` — More menu, three dialogs, banners

## Sources

- [Xero void vs delete](https://www.saasant.com/blog/xero-void-vs-delete/)
- [Chargebee — delete vs void](https://www.chargebee.com/docs/billing/2.0/kb/billing/what-is-the-difference-between-deleting-and-voiding-an-invoice)
- [Ignition — void or delete invoices](https://support.ignitionapp.com/en/articles/13134076-void-or-delete-invoices-in-ignition)
- [QuickBooks — void vs delete](https://quickbooks.intuit.com/learn-support/en-au/manage-customers-and-income/understanding-the-difference-between-voiding-vs-deleting/00/1495904)
- [Zoho Books — other actions](https://www.zoho.com/us/books/help/invoice/other-actions.html)
- [UX Psychology — designing destructive-action modals](https://uxpsychology.substack.com/p/how-to-design-better-destructive)
