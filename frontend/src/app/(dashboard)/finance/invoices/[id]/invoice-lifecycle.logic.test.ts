import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVoidStamp, isLockoutMessage, parseLockoutMinutes, computeLockoutUntil,
  DELETABLE_STATUSES, isInvoiceDeletable,
} from './invoice-lifecycle.logic.ts';
import { INVOICE_STATUSES, WORKFLOW_TRANSITIONS } from '../../../../../lib/statusConfig.ts';
// Backend's own source of truth for which statuses may be deleted — imported directly (this
// file has zero imports of its own, so it is safe to pull into a frontend node:test run) so a
// change to either list breaks this test instead of the two silently drifting apart.
import { DELETABLE_STATUSES as BACKEND_DELETABLE_STATUSES } from '../../../../../../../backend/src/finance/invoices/invoice-lifecycle.rules.ts';

// ── parseVoidStamp ──────────────────────────────────────────────────────────

test('parseVoidStamp reads the date/reason/reversed flag off a normal stamp', () => {
  const r = parseVoidStamp('[VOIDED 2026-03-15] wrong client, duplicate invoice');
  assert.deepEqual(r, { date: '2026-03-15', reason: 'wrong client, duplicate invoice', reversed: false });
});

test('parseVoidStamp strips the "Reversed by journal ..." tail and flags reversed', () => {
  const r = parseVoidStamp(
    '[VOIDED 2026-03-15] wrong client, duplicate invoice. Reversed by journal JE-0045 against JE-0012.',
  );
  assert.deepEqual(r, { date: '2026-03-15', reason: 'wrong client, duplicate invoice.', reversed: true });
});

test('parseVoidStamp preserves a reason containing $& and $` untouched', () => {
  // A real hazard: String.prototype.replace's *string* replacement form treats $&/$`/$' as
  // special patterns. parseVoidStamp only matches/slices — it must hand the reason back exactly
  // as written, so a caller that (mis)uses it with a string-form replace doesn't get mangled text.
  const r = parseVoidStamp("[VOIDED 2026-01-01] client asked for $& refund instead of $` credit");
  assert.equal(r?.reason, 'client asked for $& refund instead of $` credit');
});

test('parseVoidStamp finds the stamp even after the user\'s own free text', () => {
  const r = parseVoidStamp('Called the client twice before this.\n[VOIDED 2026-02-10] confirmed duplicate');
  assert.deepEqual(r, { date: '2026-02-10', reason: 'confirmed duplicate', reversed: false });
});

test('parseVoidStamp returns null (not a fabricated or empty reason) when the notes have no stamp', () => {
  assert.equal(parseVoidStamp('Some unrelated internal note with no void stamp at all'), null);
  // Malformed date shape — still an honest null, not a best-effort guess.
  assert.equal(parseVoidStamp('[VOIDED] missing the date entirely'), null);
});

test('parseVoidStamp on empty/null/undefined notes returns null', () => {
  assert.equal(parseVoidStamp(''), null);
  assert.equal(parseVoidStamp(null), null);
  assert.equal(parseVoidStamp(undefined), null);
});

// ── isLockoutMessage ────────────────────────────────────────────────────────

test('isLockoutMessage recognizes the backend\'s actual lockout wording (plural and singular)', () => {
  // Verbatim from InvoicesService.assertPassword's ForbiddenException, backend/src/finance/invoices/invoices.service.ts.
  assert.equal(isLockoutMessage('Too many failed attempts. Try again in 15 minutes.'), true);
  assert.equal(isLockoutMessage('Too many failed attempts. Try again in 1 minute.'), true);
});

test('isLockoutMessage does NOT treat a permission refusal as a lockout', () => {
  // Verbatim from PermissionsGuard, backend/src/permissions/permissions.guard.ts — also a 403,
  // but not the password lockout, and must never be shown or handled as one.
  assert.equal(isLockoutMessage('Your role lacks permission for finance'), false);
  assert.equal(isLockoutMessage('Not authenticated'), false);
});

test('isLockoutMessage on empty/undefined is false', () => {
  assert.equal(isLockoutMessage(''), false);
  assert.equal(isLockoutMessage(undefined), false);
});

// ── parseLockoutMinutes / computeLockoutUntil ───────────────────────────────

test('parseLockoutMinutes reads the minute count out of the real backend message', () => {
  assert.equal(parseLockoutMinutes('Too many failed attempts. Try again in 15 minutes.'), 15);
  assert.equal(parseLockoutMinutes('Too many failed attempts. Try again in 1 minute.'), 1);
});

test('parseLockoutMinutes falls back to 15 when there is no message or no number', () => {
  assert.equal(parseLockoutMinutes(undefined), 15);
  assert.equal(parseLockoutMinutes('Too many failed attempts.'), 15);
});

test('computeLockoutUntil takes "now" as an argument instead of reading the clock itself', () => {
  const now = 1_000_000;
  assert.equal(
    computeLockoutUntil('Too many failed attempts. Try again in 5 minutes.', now),
    now + 5 * 60_000,
  );
  // No message at all still resolves through the 15-minute fallback.
  assert.equal(computeLockoutUntil(undefined, now), now + 15 * 60_000);
});

// ── Deletability ─────────────────────────────────────────────────────────────

test('isInvoiceDeletable allows only DRAFT and CANCELLED', () => {
  assert.equal(isInvoiceDeletable('DRAFT'), true);
  assert.equal(isInvoiceDeletable('CANCELLED'), true);
});

test('isInvoiceDeletable refuses SENT, PAID, VOIDED and every other invoice status', () => {
  const nonDeletable = Object.keys(INVOICE_STATUSES).filter(s => !DELETABLE_STATUSES.includes(s));
  // Sanity: this must actually include the statuses the task calls out, not an empty set.
  assert.ok(nonDeletable.includes('SENT'));
  assert.ok(nonDeletable.includes('PAID'));
  assert.ok(nonDeletable.includes('VOIDED'));
  for (const status of nonDeletable) {
    assert.equal(isInvoiceDeletable(status), false, `expected ${status} to be refused`);
  }
});

test('the frontend\'s DELETABLE_STATUSES does not drift from the backend\'s own list', () => {
  // Imports backend/src/finance/invoices/invoice-lifecycle.rules.ts directly (see the import at
  // the top of this file) rather than re-typing its values, so an edit to either list — adding a
  // status, removing one, reordering — fails this test instead of silently going out of sync.
  assert.deepEqual([...DELETABLE_STATUSES].sort(), [...BACKEND_DELETABLE_STATUSES].sort());
});

// ── The back door: VOIDED must never be a client-driven transition ─────────

test('WORKFLOW_TRANSITIONS.Invoice never offers VOIDED as a target from any status', () => {
  // Voiding posts a reversing journal entry and requires a password — it must only ever happen
  // through the dedicated void endpoint (VoidDialog), never through the generic Change Status
  // modal driven by this table. If VOIDED is ever added back to any status's transition list,
  // Change Status would let someone "void" an invoice with no reversing entry, leaving the
  // revenue sitting in the books. Checked across every status, not just SENT, so it can't be
  // reintroduced anywhere.
  const transitions = WORKFLOW_TRANSITIONS.Invoice;
  assert.ok(Object.keys(transitions).length > 0, 'sanity: table must not be empty');
  for (const [fromStatus, targets] of Object.entries(transitions)) {
    assert.ok(!targets.includes('VOIDED'), `${fromStatus} must not offer VOIDED as a transition`);
  }
});
