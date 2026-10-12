/**
 * The owner-account read rule, as a function: COMPANY rows need finance 1, OWNER rows finance 2.
 * Run: npm run test:unit
 *
 * No database: PermissionsService.forRole is a stub returning the map each test names.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  COMPANY_ACCOUNT_LEVEL, OWNER_ACCOUNT_LEVEL,
  mayReadBankAccount, filterBankAccounts, financeLevelOf, visibleBankAccounts, visibleBankAccount, visibleBankAccountOrNull,
} from './bank-account-visibility';

const COMPANY = { id: 'c1', bankName: 'ADCB', ownership: 'COMPANY' };
const OWNER = { id: 'o1', bankName: 'Personal', ownership: 'OWNER' };
const perms = (map: Record<string, number> | undefined) => ({ forRole: async () => map as any });

test('the two levels are what the rule says', () => {
  assert.equal(COMPANY_ACCOUNT_LEVEL, 1);
  assert.equal(OWNER_ACCOUNT_LEVEL, 2);
});

test('a COMPANY row: refused at 0, shown from 1', () => {
  assert.deepEqual([0, 1, 2, 3].map((l) => mayReadBankAccount(l, COMPANY)), [false, true, true, true]);
});

test('AN OWNER ROW: refused at 0 AND AT 1, shown from 2', () => {
  assert.deepEqual([0, 1, 2, 3].map((l) => mayReadBankAccount(l, OWNER)), [false, false, true, true]);
});

test('a row that does not say COMPANY is held to the owner level — unknown, missing or lower-case', () => {
  for (const ownership of [undefined, null, '', 'company', 'PERSONAL', 5]) {
    assert.equal(mayReadBankAccount(1, { ownership }), false, `finance 1 saw ownership=${String(ownership)}`);
    assert.equal(mayReadBankAccount(2, { ownership }), true, `finance 2 lost ownership=${String(ownership)}`);
  }
});

test('no row, or a level that is not a number, is never readable', () => {
  assert.equal(mayReadBankAccount(3, null), false);
  assert.equal(mayReadBankAccount(3, undefined), false);
  for (const bad of [Number.NaN, undefined as any, null as any, '3' as any]) assert.equal(mayReadBankAccount(bad, COMPANY), false, String(bad));
});

test('filtering a list keeps order, drops only what the level may not see, and does not touch the input', () => {
  const rows = [OWNER, COMPANY, { ...OWNER, id: 'o2' }, { ...COMPANY, id: 'c2' }];
  const before = JSON.stringify(rows);
  assert.deepEqual(filterBankAccounts(0, rows), []);
  assert.deepEqual(filterBankAccounts(1, rows).map((r) => r.id), ['c1', 'c2']);
  assert.deepEqual(filterBankAccounts(2, rows).map((r) => r.id), ['o1', 'c1', 'o2', 'c2']);
  assert.equal(JSON.stringify(rows), before);
  assert.deepEqual(filterBankAccounts(3, null), []);
  assert.deepEqual(filterBankAccounts(3, undefined), []);
});

test('the level comes from the live role map, and is 0 whenever it cannot be read', async () => {
  assert.equal(await financeLevelOf(perms({ finance: 2 }), { role: 'ACCOUNTANT' }), 2);
  assert.equal(await financeLevelOf(perms({ setup: 3 }), { role: 'HR_MANAGER' }), 0, 'a role with no finance entry');
  assert.equal(await financeLevelOf(perms(undefined), { role: 'X' }), 0, 'forRole returned nothing');
  assert.equal(await financeLevelOf(perms({ finance: 'high' as any }), { role: 'X' }), 0, 'a level that is not a number');
  for (const user of [undefined, null, {}, { role: '' }]) assert.equal(await financeLevelOf(perms({ finance: 3 }), user as any), 0, JSON.stringify(user));
});

test('the role asked about is the one on the request — never a level the request claims for itself', async () => {
  const asked: string[] = [];
  const p = { forRole: async (role: string) => { asked.push(role); return { finance: 1 }; } };
  const rows = await visibleBankAccounts(p, { role: 'RENTAL_MANAGER', finance: 3, level: 3 } as any, [OWNER, COMPANY]);
  assert.deepEqual(asked, ['RENTAL_MANAGER']);
  assert.deepEqual(rows.map((r) => r.id), ['c1'], 'a finance field on the user object must count for nothing');
});

test('visibleBankAccounts: finance 1 gets company rows only, finance 2 gets all, no role gets none', async () => {
  assert.deepEqual((await visibleBankAccounts(perms({ finance: 1 }), { role: 'PRODUCTION_MANAGER' }, [COMPANY, OWNER])).map((r) => r.id), ['c1']);
  assert.deepEqual((await visibleBankAccounts(perms({ finance: 2 }), { role: 'ACCOUNTANT' }, [COMPANY, OWNER])).map((r) => r.id), ['c1', 'o1']);
  assert.deepEqual(await visibleBankAccounts(perms({ finance: 3 }), undefined, [COMPANY, OWNER]), []);
});

test('visibleBankAccount: an owner row below finance 2 is a 404 worded exactly like a missing row', async () => {
  await assert.rejects(() => visibleBankAccount(perms({ finance: 1 }), { role: 'RENTAL_MANAGER' }, OWNER, 'o1'), (e: any) => {
    assert.equal(e.constructor.name, 'NotFoundException', 'a 403 would confirm the id is a personal account');
    assert.equal(e.message, 'Bank account o1 not found');
    return true;
  });
  assert.equal(await visibleBankAccount(perms({ finance: 2 }), { role: 'ACCOUNTANT' }, OWNER, 'o1'), OWNER);
  assert.equal(await visibleBankAccount(perms({ finance: 1 }), { role: 'RENTAL_MANAGER' }, COMPANY, 'c1'), COMPANY);
});

test('visibleBankAccountOrNull: absent stays null, hidden becomes null, visible comes back', async () => {
  assert.equal(await visibleBankAccountOrNull(perms({ finance: 3 }), { role: 'FINANCE_MANAGER' }, null), null);
  assert.equal(await visibleBankAccountOrNull(perms({ finance: 1 }), { role: 'RENTAL_MANAGER' }, OWNER), null);
  assert.equal(await visibleBankAccountOrNull(perms({ finance: 1 }), { role: 'RENTAL_MANAGER' }, COMPANY), COMPANY);
  assert.equal(await visibleBankAccountOrNull(perms({ finance: 2 }), { role: 'SALES' }, OWNER), OWNER);
});
