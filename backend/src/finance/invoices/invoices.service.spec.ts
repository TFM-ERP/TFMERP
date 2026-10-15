/**
 * THE EXACT FAILURE THIS CATCHES: 2,700.00 taken off INV-2026-0001 — 31% of gross — with no reason
 * and no audit row. The whole record of it was four columns on the invoice, one of them empty, all
 * four overwritten by the next change.
 *
 * The rule (batch 1b-iii, ruled by Qais 14 Oct 2026):
 *   1. a non-zero deduction needs a reason — missing, empty or whitespace is refused (create + update);
 *   2. every apply or change writes ONE 'DEDUCTION' audit row with old and new amount and reason,
 *      inside the same transaction, so a failed audit insert rolls the invoice write back;
 *   3. applying or changing a deduction needs finance:2. Creating an invoice WITHOUT one does not.
 *
 * No database: the service runs against an in-memory Prisma fake whose $transaction snapshots its
 * state and restores it when the callback throws — the rollback a real transaction gives.
 * Run: npm run test:unit
 */
import 'reflect-metadata';
import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { ValidationPipe, BadRequestException, ForbiddenException, type ArgumentMetadata } from '@nestjs/common';
import { InvoicesService, DEDUCTION_PERMISSION } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

// ── The DTO, through the real global pipe config from main.ts ────────────────

const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
const meta = (metatype: any): ArgumentMetadata => ({ type: 'body', metatype, data: undefined });
const ITEM = { description: 'Camera package', quantity: 1, unitPrice: 8700 };
const createBody = (extra: Record<string, unknown> = {}) => ({ clientId: 'client_1', items: [ITEM], ...extra });
const accepts = async (dto: any, body: any) => { await pipe.transform(body, meta(dto)); };
const refuses = async (dto: any, body: any) => {
  await assert.rejects(pipe.transform(body, meta(dto)), (e: any) => {
    assert.ok(e instanceof BadRequestException);
    const msg = JSON.stringify(e.getResponse());
    assert.match(msg, /deductionReason is required when a deduction is applied/, msg);
    return true;
  });
};

describe('THE DTO — a non-zero deduction needs a reason', () => {
  test('create: a deduction with no reason is refused', () => refuses(CreateInvoiceDto, createBody({ deductionAmount: 2700 })));
  test('create: an empty reason is refused', () => refuses(CreateInvoiceDto, createBody({ deductionAmount: 2700, deductionReason: '' })));
  test('create: a whitespace reason is refused', () => refuses(CreateInvoiceDto, createBody({ deductionAmount: 2700, deductionReason: ' \t\n ' })));
  test('create: a deduction with a reason is accepted', () => accepts(CreateInvoiceDto, createBody({ deductionAmount: 2700, deductionReason: 'Agreed rate' })));
  test('create: a zero deduction with no reason is accepted — the rule binds only when money moves', async () => {
    await accepts(CreateInvoiceDto, createBody({ deductionAmount: 0 }));
    await accepts(CreateInvoiceDto, createBody({ deductionAmount: 0, deductionReason: '' }));
    await accepts(CreateInvoiceDto, createBody());
  });
  test('update: a deduction with an empty or whitespace reason is refused', async () => {
    await refuses(UpdateInvoiceDto, { deductionAmount: 500, deductionReason: '' });
    await refuses(UpdateInvoiceDto, { deductionAmount: 500, deductionReason: '   ' });
  });
  test('update: a deduction with a reason is accepted; a body with no deduction is accepted', async () => {
    await accepts(UpdateInvoiceDto, { deductionAmount: 500, deductionReason: 'Agreed rate' });
    await accepts(UpdateInvoiceDto, { notes: 'changed' });
  });
  // On update the DTO cannot see the stored row, and PartialType makes every field optional, so an
  // update sending an amount and NO reason gets past the pipe. The service refuses it — see below.
  test('update: an amount with the reason ABSENT passes the pipe — the service is the check there', () =>
    accepts(UpdateInvoiceDto, { deductionAmount: 500 }));
});

// ── The service, against an in-memory Prisma ────────────────────────────────

type Row = Record<string, any>;
function fakePrisma(opts: { role?: string; failAudit?: boolean } = {}) {
  const state = { invoices: [] as Row[], audits: [] as Row[], seq: 0, writes: [] as string[] };
  // `via` names the client a write went through: 'tx' inside $transaction, 'root' outside it.
  const client = (via: 'tx' | 'root'): any => ({
    documentSequence: { upsert: async () => ({ lastNumber: ++state.seq }) },
    user: { findUnique: async ({ where }: any) => (opts.role ? { id: where.id, role: opts.role } : null) },
    invoiceItem: {
      deleteMany: async ({ where }: any) => {
        state.writes.push(`${via}:invoiceItem.deleteMany`);
        const inv = state.invoices.find((i) => i.id === where.invoiceId);
        if (inv) inv.items = [];
      },
    },
    invoice: {
      findUnique: async ({ where }: any) => {
        const inv = state.invoices.find((i) => i.id === where.id);
        return inv ? structuredClone(inv) : null;
      },
      create: async ({ data }: any) => {
        state.writes.push(`${via}:invoice.create`);
        const { items, ...rest } = data;
        const row = { id: `inv_${state.invoices.length + 1}`, ...rest, items: items?.create ?? [] };
        state.invoices.push(row);
        return structuredClone(row);
      },
      update: async ({ where, data }: any) => {
        state.writes.push(`${via}:invoice.update`);
        const inv = state.invoices.find((i) => i.id === where.id);
        if (!inv) throw new Error('not found');
        const { items, ...rest } = data;
        Object.assign(inv, rest);
        if (items?.create) inv.items = items.create;
        return structuredClone(inv);
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        state.writes.push(`${via}:auditLog.create`);
        if (opts.failAudit) throw new Error('audit insert failed');
        state.audits.push({ ...structuredClone(data), via });
        return data;
      },
    },
  });
  const db: any = {
    state,
    ...client('root'),
    $transaction: async (cb: (tx: any) => Promise<any>) => {
      const snapshot = structuredClone({ invoices: state.invoices, audits: state.audits });
      try {
        return await cb(client('tx'));
      } catch (e) {
        state.invoices = snapshot.invoices;
        state.audits = snapshot.audits;
        throw e;
      }
    },
  };
  return db;
}

/** PermissionsService.forRole, stubbed: the finance level each role holds. */
const permissionsStub = { forRole: async (role: string) => ({ finance: role === 'OWNER_LIKE' ? 3 : role === 'EDITOR' ? 2 : 1 }) };

function serviceWith(opts: { role?: string; failAudit?: boolean } = {}) {
  const prisma = fakePrisma({ role: 'OWNER_LIKE', ...opts });
  const svc = new InvoicesService(prisma, {} as any, {} as any, permissionsStub as any);
  return { svc, prisma, state: prisma.state };
}

/** A stored DRAFT invoice, as a row already in the database. */
function seed(state: any, row: Row = {}) {
  const inv = {
    id: 'inv_seed', invoiceNumber: 'INV-2026-0001', status: 'DRAFT',
    subtotal: 8700, discountAmount: 0, deductionAmount: 0, deductionReason: null,
    deductionAppliedById: null, deductionAppliedAt: null, vatAmount: 435, total: 9135,
    items: [{ description: 'Camera package', quantity: 1, days: 1, unitPrice: 8700, discountPct: 0, taxAmount: 435 }],
    ...row,
  };
  state.invoices.push(inv);
  return inv;
}
const deductionRows = (state: any) => state.audits.filter((a: Row) => a.action === 'DEDUCTION');

describe('CREATE', () => {
  test('a deduction writes exactly one audit row carrying the amount and the reason', async () => {
    const { svc, state } = serviceWith();
    const inv = await svc.create({ clientId: 'c', items: [ITEM], deductionAmount: 2700, deductionReason: '  Agreed rate  ' } as any, 'user-admin');
    const rows = deductionRows(state);
    assert.equal(state.audits.length, 1);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].resource, 'Invoice');
    assert.equal(rows[0].resourceId, inv.id);
    assert.equal(rows[0].userId, 'user-admin');
    assert.deepEqual(rows[0].oldValue, { invoiceNumber: 'INV-2026-0001', deductionAmount: 0, deductionReason: null });
    assert.deepEqual(rows[0].newValue, { invoiceNumber: 'INV-2026-0001', deductionAmount: 2700, deductionReason: 'Agreed rate' });
    assert.equal(inv.deductionReason, 'Agreed rate', 'stored trimmed');
    assert.equal(inv.deductionAppliedById, 'user-admin');
  });

  test('no deduction writes no audit row and needs no finance:2', async () => {
    const { svc, state } = serviceWith({ role: 'VIEWER' }); // finance:1
    const inv = await svc.create({ clientId: 'c', items: [ITEM] } as any, 'u');
    assert.equal(state.audits.length, 0);
    assert.equal(inv.deductionReason, null);
    const zero = await svc.create({ clientId: 'c', items: [ITEM], deductionAmount: 0, deductionReason: '' } as any, 'u');
    assert.equal(zero.deductionReason, null);
    assert.equal(state.audits.length, 0);
  });

  test('a deduction with no reason, an empty or a whitespace one is refused by the service too, and nothing is written', async () => {
    for (const deductionReason of [undefined, '', '   ']) {
      const { svc, state } = serviceWith();
      await assert.rejects(
        svc.create({ clientId: 'c', items: [ITEM], deductionAmount: 2700, deductionReason } as any, 'u'),
        BadRequestException,
      );
      assert.equal(state.invoices.length, 0);
      assert.equal(state.audits.length, 0);
      assert.equal(state.seq, 0, 'a refused deduction must not take an invoice number');
    }
  });

  test('a deduction needs finance:2 — finance:1 is refused and nothing is written; finance:2 is enough', async () => {
    const low = serviceWith({ role: 'VIEWER' });
    await assert.rejects(
      low.svc.create({ clientId: 'c', items: [ITEM], deductionAmount: 100, deductionReason: 'r' } as any, 'u'),
      ForbiddenException,
    );
    assert.equal(low.state.invoices.length, 0);
    assert.equal(low.state.audits.length, 0);
    assert.equal(low.state.seq, 0, 'a refused deduction must not take an invoice number');
    const ok = serviceWith({ role: 'EDITOR' });
    await ok.svc.create({ clientId: 'c', items: [ITEM], deductionAmount: 100, deductionReason: 'r' } as any, 'u');
    assert.equal(deductionRows(ok.state).length, 1);
  });

  test('a user who cannot be found is refused a deduction', async () => {
    const prisma = fakePrisma(); // no role → user lookup returns null
    const svc = new InvoicesService(prisma, {} as any, {} as any, permissionsStub as any);
    await assert.rejects(svc.create({ clientId: 'c', items: [ITEM], deductionAmount: 100, deductionReason: 'r' } as any, 'ghost'), ForbiddenException);
  });

  test('A FORCED FAILURE OF THE AUDIT INSERT ROLLS THE INVOICE BACK', async () => {
    const { svc, state } = serviceWith({ failAudit: true });
    await assert.rejects(
      svc.create({ clientId: 'c', items: [ITEM], deductionAmount: 2700, deductionReason: 'Agreed rate' } as any, 'u'),
      /audit insert failed/,
    );
    assert.equal(state.invoices.length, 0, 'the invoice with the deduction must not survive without its audit row');
  });

  test('the invoice and its audit row are both written through the transaction client', async () => {
    const { svc, state } = serviceWith();
    await svc.create({ clientId: 'c', items: [ITEM], deductionAmount: 2700, deductionReason: 'Agreed rate' } as any, 'u');
    assert.deepEqual(state.writes, ['tx:invoice.create', 'tx:auditLog.create']);
  });

  test('the level is the one ruled: finance:2', () => {
    assert.deepEqual(DEDUCTION_PERMISSION, { module: 'finance', level: 2 });
  });
});

describe('UPDATE', () => {
  test('changing the amount writes one row with old and new', async () => {
    const { svc, state } = serviceWith();
    seed(state, { deductionAmount: 500, deductionReason: 'Agreed rate' });
    await svc.update('inv_seed', { deductionAmount: 700, deductionReason: 'Agreed rate' } as any, 'u');
    const rows = deductionRows(state);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].oldValue, { invoiceNumber: 'INV-2026-0001', deductionAmount: 500, deductionReason: 'Agreed rate' });
    assert.deepEqual(rows[0].newValue, { invoiceNumber: 'INV-2026-0001', deductionAmount: 700, deductionReason: 'Agreed rate' });
    assert.equal(state.invoices[0].deductionAmount, 700);
  });

  test('changing only the reason writes a row', async () => {
    const { svc, state } = serviceWith();
    seed(state, { deductionAmount: 500, deductionReason: 'Agreed rate' });
    await svc.update('inv_seed', { deductionAmount: 500, deductionReason: 'Loyalty' } as any, 'u');
    const rows = deductionRows(state);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].oldValue.deductionReason, 'Agreed rate');
    assert.equal(rows[0].newValue.deductionReason, 'Loyalty');
    assert.equal(rows[0].oldValue.deductionAmount, 500);
    assert.equal(rows[0].newValue.deductionAmount, 500);
    assert.equal(state.invoices[0].deductionReason, 'Loyalty');
  });

  test('changing neither writes none — and needs no finance:2 (the edit page resends both every save)', async () => {
    const { svc, state } = serviceWith({ role: 'VIEWER' });
    seed(state, { deductionAmount: 500, deductionReason: 'Agreed rate' });
    await svc.update('inv_seed', { deductionAmount: 500, deductionReason: 'Agreed rate', notes: 'n' } as any, 'u');
    await svc.update('inv_seed', { notes: 'again' } as any, 'u');
    await svc.update('inv_seed', { deductionAmount: 500, deductionReason: ' Agreed rate ' } as any, 'u'); // same once trimmed
    assert.equal(deductionRows(state).length, 0);
    assert.equal(state.invoices[0].notes, 'again');
  });

  test('an amount with no reason sent, onto a row with no stored reason, is refused — and the row does not move', async () => {
    const { svc, state } = serviceWith();
    seed(state);
    await assert.rejects(svc.update('inv_seed', { deductionAmount: 500 } as any, 'u'), BadRequestException);
    await assert.rejects(svc.update('inv_seed', { deductionAmount: 500, deductionReason: '  ' } as any, 'u'), BadRequestException);
    assert.equal(state.invoices[0].deductionAmount, 0);
    assert.equal(state.audits.length, 0);
  });

  test('an amount change with no reason sent keeps the stored reason, and is audited', async () => {
    const { svc, state } = serviceWith();
    seed(state, { deductionAmount: 500, deductionReason: 'Agreed rate' });
    await svc.update('inv_seed', { deductionAmount: 600 } as any, 'u');
    assert.equal(state.invoices[0].deductionReason, 'Agreed rate');
    assert.deepEqual(deductionRows(state)[0].newValue, { invoiceNumber: 'INV-2026-0001', deductionAmount: 600, deductionReason: 'Agreed rate' });
  });

  test('blanking the reason on a live deduction is refused', async () => {
    const { svc, state } = serviceWith();
    seed(state, { deductionAmount: 500, deductionReason: 'Agreed rate' });
    await assert.rejects(svc.update('inv_seed', { deductionReason: '' } as any, 'u'), BadRequestException);
    assert.equal(state.invoices[0].deductionReason, 'Agreed rate');
  });

  test('removing a deduction is a change: one row, the reason goes with it', async () => {
    const { svc, state } = serviceWith();
    seed(state, { deductionAmount: 500, deductionReason: 'Agreed rate' });
    await svc.update('inv_seed', { deductionAmount: 0 } as any, 'u');
    const rows = deductionRows(state);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].newValue, { invoiceNumber: 'INV-2026-0001', deductionAmount: 0, deductionReason: null });
    assert.equal(state.invoices[0].deductionReason, null);
  });

  test('changing a deduction needs finance:2 — finance:1 is refused and the row does not move', async () => {
    const { svc, state } = serviceWith({ role: 'VIEWER' });
    seed(state, { deductionAmount: 500, deductionReason: 'Agreed rate' });
    await assert.rejects(svc.update('inv_seed', { deductionAmount: 900, deductionReason: 'x' } as any, 'u'), ForbiddenException);
    await assert.rejects(svc.update('inv_seed', { deductionReason: 'Loyalty' } as any, 'u'), ForbiddenException);
    await assert.rejects(svc.update('inv_seed', { deductionAmount: 0 } as any, 'u'), ForbiddenException);
    assert.equal(state.invoices[0].deductionAmount, 500);
    assert.equal(state.invoices[0].deductionReason, 'Agreed rate');
    assert.equal(state.audits.length, 0);
  });

  test('HISTORY: a stored deduction with a null reason, left alone, can still be edited — no backfill is forced', async () => {
    const { svc, state } = serviceWith({ role: 'VIEWER' });
    seed(state, { deductionAmount: 2700, deductionReason: null }); // INV-2026-0001 as it stands
    // what the edit page sends on every save: the amount resent, an empty reason dropped to undefined
    await svc.update('inv_seed', { deductionAmount: 2700, notes: 'fixed a typo' } as any, 'u');
    assert.equal(state.invoices[0].deductionReason, null);
    assert.equal(state.invoices[0].notes, 'fixed a typo');
    assert.equal(state.audits.length, 0);
  });

  test('HISTORY: giving that row a reason is a change — audited, and it needs finance:2', async () => {
    const { svc, state } = serviceWith();
    seed(state, { deductionAmount: 2700, deductionReason: null });
    await svc.update('inv_seed', { deductionAmount: 2700, deductionReason: 'Agreed rate' } as any, 'u');
    const rows = deductionRows(state);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].oldValue.deductionReason, null);
    assert.equal(rows[0].newValue.deductionReason, 'Agreed rate');
  });

  test('editing lines so the deduction is clamped lower is a change of amount: it needs a reason and is audited', async () => {
    const { svc, state } = serviceWith();
    seed(state, { deductionAmount: 2700, deductionReason: 'Agreed rate' });
    await svc.update('inv_seed', { items: [{ description: 'Smaller', quantity: 1, unitPrice: 1000 }] } as any, 'u');
    const rows = deductionRows(state);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].oldValue.deductionAmount, 2700);
    assert.equal(rows[0].newValue.deductionAmount, 1000);
    assert.equal(state.invoices[0].deductionAmount, 1000);
  });

  test('appliedBy: a line edit that clamps the deduction re-stamps who applied it and when — the amount moved', async () => {
    const { svc, state } = serviceWith();
    const stampedAt = new Date('2026-01-01T00:00:00Z');
    seed(state, { deductionAmount: 2700, deductionReason: 'Agreed rate', deductionAppliedById: 'first-user', deductionAppliedAt: stampedAt });
    await svc.update('inv_seed', { items: [{ description: 'Smaller', quantity: 1, unitPrice: 1000 }] } as any, 'editor');
    const inv = state.invoices[0];
    assert.equal(inv.deductionAmount, 1000);
    assert.equal(inv.deductionAppliedById, 'editor');
    assert.ok(inv.deductionAppliedAt instanceof Date && inv.deductionAppliedAt > stampedAt);
  });

  test('appliedBy: an amount sent above the base that clamps back to the stored amount is no change — the stamp stays', async () => {
    const { svc, state } = serviceWith();
    const stampedAt = new Date('2026-01-01T00:00:00Z');
    seed(state, { deductionAmount: 8700, deductionReason: 'Agreed rate', deductionAppliedById: 'first-user', deductionAppliedAt: stampedAt });
    await svc.update('inv_seed', { deductionAmount: 9000, deductionReason: 'Agreed rate' } as any, 'editor');
    const inv = state.invoices[0];
    assert.equal(inv.deductionAmount, 8700);
    assert.equal(inv.deductionAppliedById, 'first-user');
    assert.equal(inv.deductionAppliedAt, stampedAt);
    assert.equal(deductionRows(state).length, 0);
  });

  test('A FORCED FAILURE OF THE AUDIT INSERT ROLLS THE CHANGE BACK — amount, reason AND the replaced lines', async () => {
    const { svc, state } = serviceWith({ failAudit: true });
    const before = structuredClone(seed(state, { deductionAmount: 500, deductionReason: 'Agreed rate' }));
    await assert.rejects(
      svc.update('inv_seed', {
        deductionAmount: 900, deductionReason: 'Loyalty',
        items: [{ description: 'Other', quantity: 2, unitPrice: 4000 }],
      } as any, 'u'),
      /audit insert failed/,
    );
    assert.deepEqual(state.invoices[0], before);
  });

  test('the line delete, the update and the audit row all go through the transaction client', async () => {
    const { svc, state } = serviceWith();
    seed(state, { deductionAmount: 500, deductionReason: 'Agreed rate' });
    await svc.update('inv_seed', { deductionAmount: 900, deductionReason: 'Loyalty', items: [ITEM] } as any, 'u');
    assert.deepEqual(state.writes, ['tx:invoiceItem.deleteMany', 'tx:invoice.update', 'tx:auditLog.create']);
  });

  test('an update that touches no deduction still commits when the audit table would fail — no audit is attempted', async () => {
    const { svc, state } = serviceWith({ failAudit: true });
    seed(state, { deductionAmount: 500, deductionReason: 'Agreed rate' });
    await svc.update('inv_seed', { notes: 'n' } as any, 'u');
    assert.equal(state.invoices[0].notes, 'n');
  });
});
