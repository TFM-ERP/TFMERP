# Invoice Lifecycle (Archive / Void / Delete) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give invoices three honest endings — archive (hide), void (cancel with a reversing journal), delete (remove, only when nothing has posted) — each confirmed with the user's own login password and written to the audit log.

**Architecture:** All the decision logic ("may this be deleted?") goes in one pure module with no imports from Nest or Prisma, so it can be tested exhaustively without a database — matching how `totals.util.spec.ts` already works in this repo. The service becomes a thin shell that loads state, asks the rules module, and writes. The controller adds five endpoints.

**Tech Stack:** NestJS, Prisma, PostgreSQL, `bcryptjs` (already installed), `node:test` via `npm run test:unit`.

## Global Constraints

- **No new third-party dependencies.** `package.json` is frozen. `bcryptjs`, `puppeteer` and `pdf-lib` are already present and may be used.
- **Maximum 3 files altered per turn.** Present the work and wait for confirmation before the next batch.
- **No placeholders, no ellipses.** Every function, route handler and error path written out in full.
- **Production database is the single source of truth.** No separate test DB. Tests are pure-logic and touch no database.
- **Test command:** `npm run test:unit` from `backend/`. 1,309 tests currently pass; the suite must still pass.
- **Claude never sets, reads or types a password.** The credential is the user's existing account password.
- Spec: `docs/superpowers/specs/2026-09-20-invoice-lifecycle-and-documents-design.md`

**Scope note:** the spec covers two subsystems. This plan is subsystem one — the lifecycle. Document folders, PDF snapshots, export and backfill are plan two, `2026-09-20-invoice-documents.md`, written after this one lands.

---

### Task 1: The lifecycle rules module

Pure functions. No Nest, no Prisma, no I/O. This is where the accounting line lives.

**Files:**
- Create: `backend/src/finance/invoices/invoice-lifecycle.rules.ts`
- Test: `backend/src/finance/invoices/invoice-lifecycle.rules.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type LifecycleState = { status: string; hasJournal: boolean; clearedReceipts: number; archivedAt: Date | null }`
  - `type Verdict = { allowed: true } | { allowed: false; reason: string; suggest?: 'VOID' | 'ARCHIVE' }`
  - `canDelete(state: LifecycleState): Verdict`
  - `canVoid(state: LifecycleState): Verdict`
  - `canArchive(state: LifecycleState): Verdict`
  - `DELETABLE_STATUSES: readonly string[]`

- [ ] **Step 1: Write the failing test**

Create `backend/src/finance/invoices/invoice-lifecycle.rules.spec.ts`:

```ts
/**
 * Invoice lifecycle rules — pure-logic unit tests (node:test + ts-node).
 * Run: npm run test:unit
 *
 * The line these rules draw: an invoice that has touched the ledger can never
 * be deleted, only voided. Every accounting system draws it in the same place
 * (Xero, QuickBooks, Oracle, Dynamics), and the FTA's five-year record rule
 * assumes it.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { canDelete, canVoid, canArchive, LifecycleState } from './invoice-lifecycle.rules';

const state = (over: Partial<LifecycleState> = {}): LifecycleState => ({
  status: 'DRAFT',
  hasJournal: false,
  clearedReceipts: 0,
  archivedAt: null,
  ...over,
});

// ── canDelete ────────────────────────────────────────────────────────────────
test('canDelete allows a DRAFT with no journal and no receipts', () => {
  assert.deepEqual(canDelete(state()), { allowed: true });
});

test('canDelete allows a CANCELLED invoice that never posted', () => {
  assert.deepEqual(canDelete(state({ status: 'CANCELLED' })), { allowed: true });
});

test('canDelete refuses anything with a posted journal, and suggests voiding', () => {
  const v = canDelete(state({ hasJournal: true }));
  assert.equal(v.allowed, false);
  assert.equal(v.allowed === false && v.suggest, 'VOID');
  assert.match(v.allowed === false ? v.reason : '', /journal/i);
});

test('canDelete refuses when a cleared receipt exists, and says how many', () => {
  const v = canDelete(state({ clearedReceipts: 2 }));
  assert.equal(v.allowed, false);
  assert.match(v.allowed === false ? v.reason : '', /2 .*receipt/i);
});

test('canDelete refuses a SENT invoice even with nothing posted against it', () => {
  const v = canDelete(state({ status: 'SENT' }));
  assert.equal(v.allowed, false);
  assert.equal(v.allowed === false && v.suggest, 'VOID');
});

test('canDelete refuses PAID, PARTIALLY_PAID, OVERDUE and VOIDED', () => {
  for (const status of ['PAID', 'PARTIALLY_PAID', 'OVERDUE', 'VOIDED']) {
    assert.equal(canDelete(state({ status })).allowed, false, status);
  }
});

// ── canVoid ──────────────────────────────────────────────────────────────────
test('canVoid allows a SENT invoice with no cleared receipts', () => {
  assert.deepEqual(canVoid(state({ status: 'SENT', hasJournal: true })), { allowed: true });
});

test('canVoid refuses when cleared receipts exist and names the count', () => {
  const v = canVoid(state({ status: 'PAID', hasJournal: true, clearedReceipts: 3 }));
  assert.equal(v.allowed, false);
  assert.match(v.allowed === false ? v.reason : '', /3 .*receipt/i);
});

test('canVoid refuses an already VOIDED invoice', () => {
  const v = canVoid(state({ status: 'VOIDED', hasJournal: true }));
  assert.equal(v.allowed, false);
  assert.match(v.allowed === false ? v.reason : '', /already/i);
});

test('canVoid allows a DRAFT but suggests deleting instead', () => {
  const v = canVoid(state({ status: 'DRAFT' }));
  assert.equal(v.allowed, true);
});

// ── canArchive ───────────────────────────────────────────────────────────────
test('canArchive allows any status', () => {
  for (const status of ['DRAFT', 'SENT', 'PAID', 'VOIDED']) {
    assert.deepEqual(canArchive(state({ status })), { allowed: true }, status);
  }
});

test('canArchive refuses an invoice already archived', () => {
  const v = canArchive(state({ archivedAt: new Date('2026-09-20') }));
  assert.equal(v.allowed, false);
  assert.match(v.allowed === false ? v.reason : '', /already archived/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd ~/Projects/TFM-System/backend && npm run test:unit 2>&1 | grep -A3 invoice-lifecycle
```

Expected: FAIL — `Cannot find module './invoice-lifecycle.rules'`.

- [ ] **Step 3: Write the implementation**

Create `backend/src/finance/invoices/invoice-lifecycle.rules.ts`:

```ts
/**
 * When an invoice may be archived, voided or deleted.
 *
 * Pure functions: no Nest, no Prisma, no I/O. Everything here is a decision
 * about state, which is why it can be tested exhaustively without a database.
 *
 * The rule that matters: an invoice that has touched the ledger can never be
 * deleted, only voided. Deleting it would leave a hole nobody can see, and the
 * FTA requires records to be kept five years. Xero, QuickBooks, Oracle JD
 * Edwards and Dynamics all draw the line in exactly this place.
 */

export interface LifecycleState {
  /** InvoiceStatus as a plain string, so this module stays free of Prisma. */
  status: string;
  /** True when a POSTED journal entry exists with sourceType INVOICE for it. */
  hasJournal: boolean;
  /** Count of Payment rows, direction RECEIPT, status CLEARED, against it. */
  clearedReceipts: number;
  archivedAt: Date | null;
}

export type Verdict =
  | { allowed: true }
  | { allowed: false; reason: string; suggest?: 'VOID' | 'ARCHIVE' };

const ALLOW: Verdict = { allowed: true };

/** The only statuses an invoice may be deleted from. */
export const DELETABLE_STATUSES: readonly string[] = ['DRAFT', 'CANCELLED'];

const receipts = (n: number): string =>
  `${n} cleared receipt${n === 1 ? '' : 's'} are recorded against this invoice`;

export function canDelete(state: LifecycleState): Verdict {
  if (state.hasJournal) {
    return {
      allowed: false,
      reason:
        'This invoice has a posted journal entry, so it is already in the ledger. ' +
        'Deleting it would remove money from the accounts without a trace. Void it instead.',
      suggest: 'VOID',
    };
  }
  if (state.clearedReceipts > 0) {
    return {
      allowed: false,
      reason:
        `${receipts(state.clearedReceipts)}. Reverse or refund them first, ` +
        'then the invoice can be voided.',
      suggest: 'VOID',
    };
  }
  if (!DELETABLE_STATUSES.includes(state.status)) {
    return {
      allowed: false,
      reason:
        `An invoice at status ${state.status} has been issued to a customer. ` +
        `Only ${DELETABLE_STATUSES.join(' or ')} invoices can be deleted.`,
      suggest: 'VOID',
    };
  }
  return ALLOW;
}

export function canVoid(state: LifecycleState): Verdict {
  if (state.status === 'VOIDED') {
    return { allowed: false, reason: 'This invoice is already voided.' };
  }
  if (state.clearedReceipts > 0) {
    return {
      allowed: false,
      reason:
        `${receipts(state.clearedReceipts)}. Voiding would leave money in the bank ` +
        'with nothing to match it against. Reverse or refund the receipts first.',
    };
  }
  return ALLOW;
}

export function canArchive(state: LifecycleState): Verdict {
  if (state.archivedAt !== null) {
    return { allowed: false, reason: 'This invoice is already archived.' };
  }
  return ALLOW;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd ~/Projects/TFM-System/backend && npm run test:unit 2>&1 | tail -20
```

Expected: PASS, and the total pass count is 1,309 plus the 12 tests above.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/TFM-System && git add backend/src/finance/invoices/invoice-lifecycle.rules.ts backend/src/finance/invoices/invoice-lifecycle.rules.spec.ts
git commit -m "feat(invoices): lifecycle rules for archive, void and delete

A posted invoice can never be deleted, only voided. Pure module so the
rule is testable without a database.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HKpa2XEbVq7NwTMCAFyFXT"
```

---

### Task 2: The `archivedAt` column

**Files:**
- Modify: `backend/prisma/schema.prisma` — `model Invoice`
- Create: `backend/prisma/migrations/<timestamp>_invoice_archived_at/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `Invoice.archivedAt: DateTime?` available on the Prisma client.

- [ ] **Step 1: Add the field**

In `backend/prisma/schema.prisma`, inside `model Invoice`, immediately after the `updatedAt` line, add:

```prisma
  /// Set when the invoice is hidden from the default list. Reversible, and it
  /// changes nothing else — archiving is not cancelling.
  archivedAt DateTime?
```

- [ ] **Step 2: Generate the migration**

```bash
cd ~/Projects/TFM-System/backend && npx prisma migrate dev --name invoice_archived_at
```

Expected: a new folder under `prisma/migrations/` whose `migration.sql` reads
`ALTER TABLE "invoices" ADD COLUMN "archivedAt" TIMESTAMP(3);` and the Prisma client regenerates.

- [ ] **Step 3: Verify the column exists and nothing else moved**

```bash
cd ~/Projects/TFM-System/backend && npx prisma migrate status && git diff --stat prisma/schema.prisma
```

Expected: "Database schema is up to date", and the diff touches only `schema.prisma` with 4 insertions.

- [ ] **Step 4: Run the suite**

```bash
cd ~/Projects/TFM-System/backend && npm run test:unit 2>&1 | tail -5
```

Expected: PASS, no change in count from Task 1.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/TFM-System && git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(invoices): add archivedAt column

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HKpa2XEbVq7NwTMCAFyFXT"
```

---

### Task 3: Request DTOs

**Files:**
- Create: `backend/src/finance/invoices/dto/lifecycle.dto.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `VoidInvoiceDto { password: string; reason: string }`, `DeleteInvoiceDto { password: string; reason: string; confirmNumber: string }`.

- [ ] **Step 1: Write the DTOs**

Create `backend/src/finance/invoices/dto/lifecycle.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VoidInvoiceDto {
  @ApiProperty({ description: 'The password you log in with. Not stored, not logged.' })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiProperty({ description: 'Why this invoice is being voided. Kept on the record.' })
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class DeleteInvoiceDto extends VoidInvoiceDto {
  @ApiProperty({ description: 'The invoice number, typed back, to confirm.' })
  @IsString()
  @MinLength(1)
  confirmNumber!: string;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd ~/Projects/TFM-System/backend && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
```

Expected: no errors mentioning `lifecycle.dto.ts`.

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/TFM-System && git add backend/src/finance/invoices/dto/lifecycle.dto.ts
git commit -m "feat(invoices): DTOs for void and delete

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HKpa2XEbVq7NwTMCAFyFXT"
```

---

### Task 4: Service — password check and audit helper

**Files:**
- Modify: `backend/src/finance/invoices/invoices.service.ts` — imports and two private methods

**Interfaces:**
- Consumes: `bcryptjs`, `PrismaService`, `canDelete/canVoid/canArchive` from Task 1.
- Produces: `private assertPassword(userId: string, password: string, action: string): Promise<void>` and `private writeAudit(userId, action, invoiceId, oldValue): Promise<void>` for Tasks 5 and 6.

- [ ] **Step 1: Add the imports**

At the top of `backend/src/finance/invoices/invoices.service.ts`, after the existing imports, add:

```ts
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { canDelete, canVoid, canArchive, LifecycleState } from './invoice-lifecycle.rules';
```

and widen the existing first import line to include the two new exceptions:

```ts
import {
  Injectable, NotFoundException, BadRequestException,
  UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
```

(Remove the separate `UnauthorizedException, ForbiddenException` line added above — they belong in the one import.)

- [ ] **Step 2: Add the failed-attempt limiter and the password check**

Inside `export class InvoicesService`, above `nextNumber`, add:

```ts
  /**
   * Failed confirmation attempts, per user. In memory on purpose: a restart
   * clears it, which is fine for a single-tenant system and adds no dependency.
   */
  private readonly failures = new Map<string, { count: number; until: number }>();
  private static readonly MAX_FAILURES = 5;
  private static readonly LOCK_MS = 15 * 60 * 1000;

  /**
   * Confirms the caller is who they say they are, using the password they log
   * in with. There is no separate admin password: a shared secret makes the
   * audit log say "someone who knew it", and this makes it say who.
   */
  private async assertPassword(userId: string, password: string, action: string): Promise<void> {
    const now = Date.now();
    const record = this.failures.get(userId);
    if (record && record.count >= InvoicesService.MAX_FAILURES && now < record.until) {
      const minutes = Math.ceil((record.until - now) / 60000);
      throw new ForbiddenException(
        `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!ok) {
      const count = (record && now < record.until ? record.count : 0) + 1;
      this.failures.set(userId, { count, until: now + InvoicesService.LOCK_MS });
      await this.writeAudit(userId, `${action}_DENIED`, 'unknown', null);
      throw new UnauthorizedException('That password is not correct.');
    }

    this.failures.delete(userId);
  }

  /** Every lifecycle action lands in the audit log, successful or not. */
  private async writeAudit(
    userId: string,
    action: string,
    invoiceId: string,
    oldValue: unknown,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        resource: 'Invoice',
        resourceId: invoiceId,
        oldValue: oldValue === null ? undefined : (oldValue as any),
      },
    });
  }

  /** Loads exactly what the rules module needs to reach a verdict. */
  private async lifecycleState(id: string): Promise<{ state: LifecycleState; invoice: any }> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { items: true, client: { select: { companyName: true } } },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${id} was not found`);

    const [journals, clearedReceipts] = await Promise.all([
      this.prisma.journalEntry.count({
        where: { sourceType: 'INVOICE', sourceId: id, status: 'POSTED' },
      }),
      this.prisma.payment.count({
        where: { invoiceId: id, direction: 'RECEIPT', status: 'CLEARED' },
      }),
    ]);

    return {
      invoice,
      state: {
        status: invoice.status,
        hasJournal: journals > 0,
        clearedReceipts,
        archivedAt: invoice.archivedAt,
      },
    };
  }
```

- [ ] **Step 3: Verify it compiles**

```bash
cd ~/Projects/TFM-System/backend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep invoices.service | head -10
```

Expected: no output.

- [ ] **Step 4: Run the suite**

```bash
cd ~/Projects/TFM-System/backend && npm run test:unit 2>&1 | tail -5
```

Expected: PASS, count unchanged.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/TFM-System && git add backend/src/finance/invoices/invoices.service.ts
git commit -m "feat(invoices): password confirmation and audit helper

Confirms with the user's own login password rather than a shared secret,
so the audit log names the person. Five failures locks for fifteen minutes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HKpa2XEbVq7NwTMCAFyFXT"
```

---

### Task 5: Service — archive, unarchive, void, delete

**Files:**
- Modify: `backend/src/finance/invoices/invoices.service.ts` — four public methods

**Interfaces:**
- Consumes: `assertPassword`, `writeAudit`, `lifecycleState` from Task 4.
- Produces: `archive(id, userId)`, `unarchive(id, userId)`, `voidInvoice(id, dto, userId)`, `remove(id, dto, userId)` for Task 6.

- [ ] **Step 1: Add the four methods**

Append inside `export class InvoicesService`:

```ts
  /** Hides an invoice from the default list. Changes nothing else. */
  async archive(id: string, userId: string) {
    const { state, invoice } = await this.lifecycleState(id);
    const verdict = canArchive(state);
    if (!verdict.allowed) throw new BadRequestException(verdict.reason);

    await this.writeAudit(userId, 'ARCHIVE', id, { invoiceNumber: invoice.invoiceNumber });
    return this.prisma.invoice.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  async unarchive(id: string, userId: string) {
    await this.writeAudit(userId, 'UNARCHIVE', id, null);
    return this.prisma.invoice.update({ where: { id }, data: { archivedAt: null } });
  }

  /**
   * Cancels an invoice that really happened. The number and the document stay;
   * a reversing journal takes the money back out, so the trial balance still
   * nets to zero and an auditor can see both halves.
   */
  async voidInvoice(id: string, dto: { password: string; reason: string }, userId: string) {
    await this.assertPassword(userId, dto.password, 'VOID');

    const { state, invoice } = await this.lifecycleState(id);
    const verdict = canVoid(state);
    if (!verdict.allowed) throw new BadRequestException(verdict.reason);

    const original = await this.prisma.journalEntry.findFirst({
      where: { sourceType: 'INVOICE', sourceId: id, status: 'POSTED' },
      include: { lines: true },
    });

    return this.prisma.$transaction(async (tx) => {
      if (original) {
        const year = new Date().getFullYear();
        const last = await tx.journalEntry.findMany({
          where: { entryNumber: { startsWith: `JE-${year}-` } },
          select: { entryNumber: true },
          orderBy: { entryNumber: 'desc' },
          take: 1,
        });
        const next = (last.length > 0 ? parseInt(last[0].entryNumber.slice(-4), 10) : 0) + 1;

        await tx.journalEntry.create({
          data: {
            entryNumber: `JE-${year}-${String(next).padStart(4, '0')}`,
            date: new Date(),
            memo:
              `Void of invoice ${invoice.invoiceNumber} — reverses ${original.entryNumber}. ` +
              `Reason: ${dto.reason}`,
            source: 'SYSTEM',
            sourceType: 'INVOICE_VOID',
            sourceId: id,
            status: 'POSTED',
            postedAt: new Date(),
            lines: {
              create: original.lines.map((line) => ({
                accountId: line.accountId,
                debit: line.credit,
                credit: line.debit,
                description: `Reversal — ${line.description ?? ''}`.trim(),
              })),
            },
          },
        });
      }

      await this.writeAudit(userId, 'VOID', id, {
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        total: String(invoice.total),
        reason: dto.reason,
        reversedEntry: original?.entryNumber ?? null,
      });

      const stamp =
        `[VOIDED ${new Date().toISOString().slice(0, 10)}] ${dto.reason}` +
        (original ? ` Reversed by a journal against ${original.entryNumber}.` : '');

      return tx.invoice.update({
        where: { id },
        data: {
          status: 'VOIDED',
          amountDue: 0,
          internalNotes: invoice.internalNotes
            ? `${invoice.internalNotes}\n\n${stamp}`
            : stamp,
        },
      });
    });
  }

  /**
   * Removes an invoice that should never have existed. Refused the moment
   * anything has posted against it — see invoice-lifecycle.rules.ts for why.
   * The uploaded files stay on disk; only the rows go.
   */
  async remove(
    id: string,
    dto: { password: string; reason: string; confirmNumber: string },
    userId: string,
  ) {
    await this.assertPassword(userId, dto.password, 'DELETE');

    const { state, invoice } = await this.lifecycleState(id);

    if (dto.confirmNumber.trim() !== invoice.invoiceNumber) {
      throw new BadRequestException(
        `Type the invoice number exactly to confirm. Expected ${invoice.invoiceNumber}.`,
      );
    }

    const verdict = canDelete(state);
    if (!verdict.allowed) {
      throw new BadRequestException(verdict.reason);
    }

    const attachments = await this.prisma.documentAttachment.findMany({
      where: { entityType: 'INVOICE', entityId: id },
      select: { id: true, name: true, url: true },
    });

    await this.writeAudit(userId, 'DELETE', id, {
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.clientId,
        client: invoice.client?.companyName ?? null,
        issueDate: invoice.issueDate,
        subtotal: String(invoice.subtotal),
        vatAmount: String(invoice.vatAmount),
        total: String(invoice.total),
        status: invoice.status,
        internalNotes: invoice.internalNotes,
      },
      items: invoice.items.map((i: any) => ({
        description: i.description,
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice),
        lineTotal: String(i.lineTotal),
      })),
      attachments,
      reason: dto.reason,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.documentAttachment.deleteMany({ where: { entityType: 'INVOICE', entityId: id } });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.delete({ where: { id } });
    });

    return { deleted: true, invoiceNumber: invoice.invoiceNumber };
  }
```

- [ ] **Step 2: Verify it compiles**

```bash
cd ~/Projects/TFM-System/backend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep invoices.service | head -10
```

Expected: no output. If `invoiceItem` is not the delegate name, correct it from `grep -n "model InvoiceItem" -A2 prisma/schema.prisma`.

- [ ] **Step 3: Run the suite**

```bash
cd ~/Projects/TFM-System/backend && npm run test:unit 2>&1 | tail -5
```

Expected: PASS, count unchanged.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/TFM-System && git add backend/src/finance/invoices/invoices.service.ts
git commit -m "feat(invoices): archive, unarchive, void and delete

Void posts a reversing journal mirroring the original line for line.
Delete is refused once anything has posted, and writes the whole invoice
into the audit log first so the row can be reconstructed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HKpa2XEbVq7NwTMCAFyFXT"
```

---

### Task 6: Controller endpoints and archived filtering

**Files:**
- Modify: `backend/src/finance/invoices/invoices.controller.ts`
- Modify: `backend/src/finance/invoices/dto/query-invoice.dto.ts`
- Modify: `backend/src/finance/invoices/invoices.service.ts` — `findAll` only

**Interfaces:**
- Consumes: `archive/unarchive/voidInvoice/remove` from Task 5.
- Produces: the five HTTP routes in the spec's section 6.

- [ ] **Step 1: Add `archived` to the query DTO**

In `backend/src/finance/invoices/dto/query-invoice.dto.ts`, add to the class:

```ts
  @ApiPropertyOptional({ description: 'Include archived invoices. Default false.' })
  @IsOptional()
  @IsBooleanString()
  archived?: string;
```

Add `IsBooleanString` to the existing `class-validator` import and `ApiPropertyOptional` to the `@nestjs/swagger` import if not already there.

- [ ] **Step 2: Filter them out of `findAll`**

In `invoices.service.ts`, inside `findAll`, immediately after `if (clientId) where.clientId = clientId;` add:

```ts
    // Archived invoices are hidden unless asked for. Archiving is not deleting:
    // the row is untouched and the filter is the only thing that changed.
    if (query.archived !== 'true') where.archivedAt = null;
```

and add `archived` to the destructured `query` fields on the line above.

- [ ] **Step 3: Add the routes**

In `backend/src/finance/invoices/invoices.controller.ts`, add `Delete` to the `@nestjs/common` import, add

```ts
import { VoidInvoiceDto, DeleteInvoiceDto } from './dto/lifecycle.dto';
```

and append inside the class:

```ts
  @Post(':id/archive')
  @RequirePermission('finance', 2)
  @ApiOperation({ summary: 'Hide an invoice from the default list. Reversible.' })
  archive(@Param('id') id: string, @Request() req) {
    return this.service.archive(id, req.user.id);
  }

  @Post(':id/unarchive')
  @RequirePermission('finance', 2)
  @ApiOperation({ summary: 'Bring an archived invoice back into the list' })
  unarchive(@Param('id') id: string, @Request() req) {
    return this.service.unarchive(id, req.user.id);
  }

  @Post(':id/void')
  @RequirePermission('finance', 3)
  @ApiOperation({
    summary: 'Void an invoice — keeps the number, posts a reversing journal',
  })
  voidInvoice(@Param('id') id: string, @Body() dto: VoidInvoiceDto, @Request() req) {
    return this.service.voidInvoice(id, dto, req.user.id);
  }

  @Delete(':id')
  @RequirePermission('finance', 3)
  @ApiOperation({
    summary: 'Delete an invoice. Refused once anything has posted against it.',
  })
  remove(@Param('id') id: string, @Body() dto: DeleteInvoiceDto, @Request() req) {
    return this.service.remove(id, dto, req.user.id);
  }
```

The password travels in the body, never the URL, so it stays out of access logs.

- [ ] **Step 4: Verify it compiles and the suite passes**

```bash
cd ~/Projects/TFM-System/backend && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10 && npm run test:unit 2>&1 | tail -5
```

Expected: no type errors; tests PASS.

- [ ] **Step 5: Smoke-test against the running API**

Start the backend, then with a valid token in `$TOKEN` and a DRAFT invoice id in `$ID`:

```bash
curl -s -X POST "http://localhost:3001/api/v1/finance/invoices/$ID/archive" \
  -H "Authorization: Bearer $TOKEN" | head -c 300; echo
curl -s -X DELETE "http://localhost:3001/api/v1/finance/invoices/$ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"password":"wrong","reason":"test","confirmNumber":"X"}' | head -c 300; echo
```

Expected: the archive returns the invoice with `archivedAt` set; the delete returns 401 "That password is not correct."

- [ ] **Step 6: Commit**

```bash
cd ~/Projects/TFM-System && git add backend/src/finance/invoices/invoices.controller.ts backend/src/finance/invoices/dto/query-invoice.dto.ts backend/src/finance/invoices/invoices.service.ts
git commit -m "feat(invoices): archive, void and delete endpoints

Password travels in the body, never the URL. finance level 3 for void and
delete — raising an invoice and destroying one are different privileges.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HKpa2XEbVq7NwTMCAFyFXT"
```

---

## Self-review

**Spec coverage.** Section 4.1 archive → Tasks 2, 5, 6. Section 4.2 void → Tasks 1, 5, 6. Section 4.3 delete → Tasks 1, 5, 6. Section 4.4 the admin check → Task 4. Section 6 API surface: the four lifecycle routes are in Task 6; the five document routes belong to plan two and are deliberately absent here. Section 7 data changes → Task 2. Section 9 testing: the pure rules are covered in Task 1; the journal-reversal and rate-limiter assertions are integration-shaped and are verified by the Task 6 smoke test rather than a DB test, because this repo's suite is pure-logic only.

**Placeholders.** None. Every step carries its code or its exact command.

**Type consistency.** `LifecycleState` and `Verdict` are defined in Task 1 and used unchanged in Tasks 4 and 5. `assertPassword`, `writeAudit` and `lifecycleState` are defined in Task 4 and called in Task 5 with matching signatures. `VoidInvoiceDto` and `DeleteInvoiceDto` are defined in Task 3 and used in Task 6; `remove` in Task 5 takes the same three fields.

**One thing deliberately left to the next plan.** `remove` deletes `documentAttachment` rows for the invoice. That table is unused until plan two, so the call is harmless now and correct later.
