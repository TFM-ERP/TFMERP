/**
 * THE EXACT FAILURE THIS CATCHES: a path that returns the owner's personal bank account to a role
 * that may not see it.
 *
 * The rule: a COMPANY row needs finance 1, an OWNER row finance 2 — ON EVERY PATH THAT CAN RETURN
 * ONE. A rule on three paths out of four is not a rule; the fourth is how the row gets out. So
 * each path is driven here through its real controller handler, with services that return BOTH
 * kinds of row whatever they are asked, at every finance level.
 *
 *   1. GET /company                     — open to every role; the profile carries the bank list
 *   2. GET /company/bank-accounts       — ?includeOwner
 *   3. GET /finance/bank-accounts       — ?includeOwner
 *   4. GET /finance/bank-accounts/:id   — fetch by id, past all three lists
 * and the three other handlers that hand back bank rows: PUT /company, POST
 * /company/complete-setup (both return the profile) and GET /finance/bank-accounts/defaults.
 *
 * The services are stubs. The filter is at the controller boundary on purpose, so the controller
 * is what is under test; the services must keep returning everything.
 * Run: npm run test:unit
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { CompanyController } from '../../company/company.controller';
import { BankAccountsController } from './bank-accounts.controller';

const COMPANY = { id: 'c1', bankName: 'ADCB', iban: 'AE00-COMPANY', ownership: 'COMPANY' };
const OWNER = { id: 'o1', bankName: 'Personal', iban: 'AE00-OWNER', ownership: 'OWNER' };
const PROFILE = { id: 'p1', legalName: 'The Film Makers FZ LLC', setupComplete: true, locations: [{ id: 'l1' }], documents: [{ id: 'd1' }], bankAccounts: [COMPANY, OWNER] };

/** Stub services: they return BOTH rows regardless, and record what they were asked. */
function build(finance: number | undefined) {
  const calls: any[] = [];
  const permissions: any = { forRole: async (role: string) => { calls.push(['forRole', role]); return finance === undefined ? {} : { finance }; } };
  const companyService: any = {
    getProfile: async () => PROFILE,
    updateProfile: async (b: any) => { calls.push(['updateProfile', b]); return PROFILE; },
    completeSetup: async (b: any) => { calls.push(['completeSetup', b]); return PROFILE; },
    listBankAccounts: async (includeOwner: boolean) => { calls.push(['listBankAccounts', includeOwner]); return includeOwner ? [COMPANY, OWNER] : [COMPANY]; },
  };
  const bankService: any = {
    findAll: async (includeOwner: boolean) => { calls.push(['findAll', includeOwner]); return includeOwner ? [COMPANY, OWNER] : [COMPANY]; },
    findOne: async (id: string) => (id === 'o1' ? OWNER : COMPANY),
    getDefault: async () => ({ invoice: COMPANY, quotation: OWNER, receiving: null }),
  };
  return { calls, company: new CompanyController(companyService, permissions), bank: new BankAccountsController(bankService, permissions) };
}
const req = (role?: string): any => ({ user: role ? { id: 'u1', role } : undefined });
const ids = (rows: any[]) => rows.map((r) => r.id);
const leaks = (value: unknown) => JSON.stringify(value).includes('AE00-OWNER');

// ── 1. GET /company ──────────────────────────────────────────────────────────

test('1. GET /company — finance 0 (driver, crew): NO bank rows, and the rest of the profile intact', async () => {
  const out: any = await build(0).company.getProfile(req('DRIVER'));
  assert.deepEqual(out.bankAccounts, []);
  assert.equal(leaks(out), false);
  assert.equal(out.setupComplete, true, 'SetupGate reads this on every page — it must survive');
  assert.deepEqual([out.id, out.legalName, out.locations.length, out.documents.length], ['p1', 'The Film Makers FZ LLC', 1, 1]);
});

test('1. GET /company — finance 1: the company account, NOT the owner account', async () => {
  const out: any = await build(1).company.getProfile(req('PRODUCTION_MANAGER'));
  assert.deepEqual(ids(out.bankAccounts), ['c1']);
  assert.equal(leaks(out), false);
});

test('1. GET /company — finance 2 and 3: both', async () => {
  for (const level of [2, 3]) assert.deepEqual(ids((await build(level).company.getProfile(req('ACCOUNTANT')) as any).bankAccounts), ['c1', 'o1'], `finance ${level}`);
});

test('1. GET /company — a role with no finance entry, and a request with no user, get no bank rows', async () => {
  assert.deepEqual((await build(undefined).company.getProfile(req('HR_MANAGER')) as any).bankAccounts, []);
  assert.deepEqual((await build(3).company.getProfile(req()) as any).bankAccounts, []);
});

test('1. the profile object the service returned is not modified — internal callers keep the full list', async () => {
  await build(0).company.getProfile(req('DRIVER'));
  assert.deepEqual(ids(PROFILE.bankAccounts), ['c1', 'o1']);
});

// ── 2. GET /company/bank-accounts ────────────────────────────────────────────

test('2. GET /company/bank-accounts?includeOwner=true — finance 1 ASKS for the owner account and does not get it', async () => {
  const { company, calls } = build(1);
  const out = await company.listBankAccounts(req('RENTAL_MANAGER'), 'true');
  assert.deepEqual(ids(out), ['c1']);
  assert.equal(leaks(out), false);
  assert.deepEqual(calls.find((c) => c[0] === 'listBankAccounts'), ['listBankAccounts', true], 'the service is still asked for everything; the filter is on the way out');
});

test('2. — finance 2 asks and gets it; includeOwner still decides what the service is asked', async () => {
  for (const flag of ['true', '1']) assert.deepEqual(ids(await build(2).company.listBankAccounts(req('ACCOUNTANT'), flag)), ['c1', 'o1'], flag);
  const { company, calls } = build(3);
  assert.deepEqual(ids(await company.listBankAccounts(req('FINANCE_MANAGER'))), ['c1']);
  assert.deepEqual(calls.find((c) => c[0] === 'listBankAccounts'), ['listBankAccounts', false], 'includeOwner was dropped or forced on');
  assert.deepEqual(ids(await build(3).company.listBankAccounts(req('FINANCE_MANAGER'), 'false')), ['c1']);
});

// ── 3. GET /finance/bank-accounts ────────────────────────────────────────────

test('3. GET /finance/bank-accounts?includeOwner=true — finance 1 does not get the owner account', async () => {
  const { bank, calls } = build(1);
  const out = await bank.findAll(req('PRODUCTION_MANAGER'), 'true');
  assert.deepEqual(ids(out), ['c1']);
  assert.equal(leaks(out), false);
  assert.deepEqual(calls.find((c) => c[0] === 'findAll'), ['findAll', true]);
});

test('3. — finance 2 and 3 do; without includeOwner nobody is sent it', async () => {
  for (const level of [2, 3]) assert.deepEqual(ids(await build(level).bank.findAll(req('SALES'), '1')), ['c1', 'o1'], `finance ${level}`);
  assert.deepEqual(ids(await build(3).bank.findAll(req('FINANCE_MANAGER'))), ['c1']);
});

// ── 4. GET /finance/bank-accounts/:id ────────────────────────────────────────

test('4. GET /finance/bank-accounts/:id — finance 1 HOLDING THE ID of an owner account gets a 404, not the row', async () => {
  await assert.rejects(() => build(1).bank.findOne(req('RENTAL_MANAGER'), 'o1'), (e: any) => {
    assert.equal(e.constructor.name, 'NotFoundException');
    assert.equal(e.getStatus(), 404);
    assert.equal(leaks(e.getResponse()), false);
    return true;
  });
});

test('4. — the same role still fetches a company account by id; finance 2 fetches the owner account', async () => {
  assert.equal((await build(1).bank.findOne(req('RENTAL_MANAGER'), 'c1') as any).id, 'c1');
  assert.equal((await build(2).bank.findOne(req('ACCOUNTANT'), 'o1') as any).id, 'o1');
  assert.equal((await build(3).bank.findOne(req('FINANCE_MANAGER'), 'o1') as any).id, 'o1');
});

// ── the other handlers that hand back bank rows ──────────────────────────────

test('PUT /company and POST /company/complete-setup return the profile filtered the same way', async () => {
  for (const level of [0, 1]) {
    const { company } = build(level);
    for (const out of [await company.updateProfile(req('X'), { legalName: 'n' }), await company.completeSetup(req('X'), {})] as any[]) {
      assert.equal(leaks(out), false, `finance ${level}`);
      assert.deepEqual(ids(out.bankAccounts), level === 0 ? [] : ['c1']);
    }
  }
  const { company, calls } = build(3);
  assert.deepEqual(ids((await company.updateProfile(req('FINANCE_MANAGER'), { legalName: 'n' }) as any).bankAccounts), ['c1', 'o1']);
  assert.deepEqual(calls.find((c) => c[0] === 'updateProfile'), ['updateProfile', { legalName: 'n' }], 'the body must reach the service unchanged');
});

test('GET /finance/bank-accounts/defaults — a default slot holding an owner account is null below finance 2', async () => {
  assert.deepEqual(await build(1).bank.getDefaults(req('RENTAL_MANAGER')), { invoice: COMPANY, quotation: null, receiving: null });
  assert.deepEqual(await build(2).bank.getDefaults(req('ACCOUNTANT')), { invoice: COMPANY, quotation: OWNER, receiving: null });
});

test('every one of these asks the LIVE role map for the role on the request', async () => {
  const { company, bank, calls } = build(2);
  await company.getProfile(req('ACCOUNTANT'));
  await company.listBankAccounts(req('ACCOUNTANT'), 'true');
  await bank.findAll(req('ACCOUNTANT'), 'true');
  await bank.findOne(req('ACCOUNTANT'), 'o1');
  assert.deepEqual(calls.filter((c) => c[0] === 'forRole'), Array(4).fill(['forRole', 'ACCOUNTANT']));
});
