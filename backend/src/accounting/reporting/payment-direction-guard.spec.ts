import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';

/**
 * A static guard, not a behavioural test.
 *
 * `Payment` used to be customer-only: `invoiceId` and `clientId` were required and
 * every row was a receipt, so a query could safely sum the whole table. Since
 * `direction` was added the table holds money going out as well, and any aggregate
 * that forgets to filter starts quietly including supplier payments in figures
 * labelled "cash received" or "collections".
 *
 * Nothing about that failure is loud. There is no type error, no exception, no
 * failing assertion anywhere — the dashboard simply overstates. That is precisely
 * the kind of defect a unit test cannot catch after the fact, so this reads the
 * source instead and fails the build if a query over `prisma.payment` omits the
 * filter.
 *
 * If a query legitimately wants both directions, add it to ALLOWED below with a
 * reason. Making the exception explicit is the point.
 */

const SRC = path.resolve(__dirname, '../..');

/** Queries that intentionally span both directions, each with its justification. */
const ALLOWED: { file: string; reason: string }[] = [
  {
    file: 'accounting/accounting.service.ts',
    reason:
      'postAll() posts every payment to the ledger and branches on direction itself. Filtering here would leave supplier payments unposted, which is the defect this whole change exists to fix.',
  },
  {
    file: 'finance/payments/payments.service.ts',
    reason:
      'findAll() defaults direction to RECEIPT in its own signature; findOne/update address a single row by id, where direction is a property of the row, not a filter.',
  },
  {
    file: 'finance/invoices/invoices.service.ts',
    reason: 'Creates a payment rather than querying; it sets direction explicitly.',
  },
];

/** Every .ts file under src, excluding tests and build output. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      sourceFiles(full, acc);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

/** The query verbs that read many rows and therefore need a direction filter. */
const AGGREGATING = ['aggregate', 'count', 'findMany', 'groupBy'];

describe('every aggregate over Payment filters by direction', () => {
  const allowedFiles = new Set(ALLOWED.map(a => a.file));

  test('no query sums or counts both directions by accident', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const rel = path.relative(SRC, file);
      if (allowedFiles.has(rel)) continue;

      const source = fs.readFileSync(file, 'utf8');
      for (const verb of AGGREGATING) {
        const needle = `prisma.payment.${verb}(`;
        let from = 0;
        for (;;) {
          const at = source.indexOf(needle, from);
          if (at === -1) break;
          from = at + needle.length;

          // The argument object runs to the matching brace; a 600-character window
          // comfortably covers the longest of these calls in the codebase.
          const window = source.slice(at, at + 600);
          if (!window.includes('direction')) {
            const line = source.slice(0, at).split('\n').length;
            offenders.push(`${rel}:${line} — prisma.payment.${verb}() has no direction filter`);
          }
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `\n\nPayment queries missing a direction filter:\n  ${offenders.join('\n  ')}\n\n` +
        'Add direction: \'RECEIPT\' (or \'PAYMENT\'), or add the file to ALLOWED in this spec with a reason.\n',
    );
  });

  test('the allow-list stays small and justified', () => {
    for (const entry of ALLOWED) {
      assert.ok(
        fs.existsSync(path.join(SRC, entry.file)),
        `ALLOWED names ${entry.file}, which no longer exists — remove the stale exception.`,
      );
      assert.ok(entry.reason.length > 40, `${entry.file} needs a real reason, not a placeholder.`);
    }
  });
});
