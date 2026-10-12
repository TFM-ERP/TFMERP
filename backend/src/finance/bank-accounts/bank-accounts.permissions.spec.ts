/**
 * THE EXACT FAILURE THIS CATCHES: two doors onto the same rows, at two different levels.
 *
 * finance/bank-accounts.controller.ts and company.controller.ts both write prisma.bankAccount —
 * the accounts whose IBAN is printed on every invoice. The company door's writes are at finance:3.
 * This door's writes sat at finance:2, so ACCOUNTANT and SALES, refused at one, could do the same
 * thing through the other. A level on one door alone is not a level.
 *
 * This reads the metadata the way Nest does, through Reflector:
 *   · each write carries exactly finance:3 — and the SAME level as the company door's write;
 *   · each read carries none of its own and inherits the class's finance:1;
 *   · and NO HANDLER IS UNACCOUNTED FOR, so a route added later cannot arrive unruled.
 * Run: npm run test:unit
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Reflector } from '@nestjs/core';
import { BankAccountsController } from './bank-accounts.controller';
import { CompanyController } from '../../company/company.controller';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { PERM_KEY } from '../../permissions/require-permission.decorator';

type Perm = { module: string; level: number };
const reflector = new Reflector();
const proto = BankAccountsController.prototype as any;
const own = (method: string) => reflector.get<Perm>(PERM_KEY, proto[method]);
/** What the guard actually enforces: the handler's requirement, else the class's. */
const effective = (method: string) => reflector.getAllAndOverride<Perm>(PERM_KEY, [proto[method], BankAccountsController]);
const classGuards = (): any[] => Reflect.getMetadata('__guards__', BankAccountsController) || [];

const WRITES: Record<string, string> = {
  create: 'createBankAccount',
  update: 'updateBankAccount',
  remove: 'deleteBankAccount',
};
const READS = ['findAll', 'getDefaults', 'findOne'];

test('the class runs both guards and sets the read floor at finance:1', () => {
  const names = classGuards().map((g: any) => (typeof g === 'function' ? g.name : g?.constructor?.name));
  assert.ok(names.includes('JwtAuthGuard'), names.join(', '));
  assert.ok(names.includes('PermissionsGuard'), names.join(', '));
  assert.deepEqual(reflector.get<Perm>(PERM_KEY, BankAccountsController), { module: 'finance', level: 1 });
});

test('EVERY WRITE IS finance:3 — create, update and remove', () => {
  for (const method of Object.keys(WRITES)) {
    assert.deepEqual(own(method), { module: 'finance', level: 3 }, method);
    assert.deepEqual(effective(method), { module: 'finance', level: 3 }, method);
  }
});

test('THE TWO DOORS AGREE: each write here is at the level of the same write on the company door', () => {
  for (const [method, companyMethod] of Object.entries(WRITES)) {
    const theirs = reflector.get<Perm>(PERM_KEY, (CompanyController.prototype as any)[companyMethod]);
    assert.ok(theirs, `company.${companyMethod} carries no requirement`);
    assert.deepEqual(own(method), theirs, `${method} here vs ${companyMethod} on the company door`);
  }
});

test('every read carries no requirement of its own and inherits finance:1 from the class', () => {
  for (const method of READS) {
    assert.equal(own(method), undefined, method);
    assert.deepEqual(effective(method), { module: 'finance', level: 1 }, method);
  }
});

test('NO HANDLER IS UNACCOUNTED FOR — a new route cannot arrive unruled', () => {
  const handlers = Object.getOwnPropertyNames(proto).filter((m) => m !== 'constructor' && typeof proto[m] === 'function');
  const known = [...Object.keys(WRITES), ...READS];
  assert.deepEqual(handlers.filter((m) => !known.includes(m)), [], 'decide a level for these');
  assert.deepEqual(known.filter((m) => !handlers.includes(m)), [], 'the spec names handlers the controller does not have');
});

// The guard itself, with a stub in place of PermissionsService.forRole — no database.
const guardWith = (map: Record<string, number>) => new PermissionsGuard(new Reflector(), { forRole: async () => map } as any);
const ctxFor = (method: string, role?: string): any => ({
  getHandler: () => proto[method],
  getClass: () => BankAccountsController,
  switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
});

test('ACCOUNTANT and SALES (finance:2) are REFUSED all three writes — this is the door that was open', async () => {
  for (const role of ['ACCOUNTANT', 'SALES']) {
    for (const method of Object.keys(WRITES)) {
      await assert.rejects(() => guardWith({ finance: 2 }).canActivate(ctxFor(method, role)) as any, (e: any) => {
        assert.equal(e.constructor.name, 'ForbiddenException', `${role} ${method}`);
        assert.match(String(e.message), /finance/);
        return true;
      });
    }
  }
});

test('— and still read: finance:2 passes every read', async () => {
  for (const method of READS) assert.equal(await guardWith({ finance: 2 }).canActivate(ctxFor(method, 'ACCOUNTANT')), true, method);
});

test('FINANCE_MANAGER (finance:3) holds all three writes', async () => {
  for (const method of Object.keys(WRITES)) assert.equal(await guardWith({ finance: 3 }).canActivate(ctxFor(method, 'FINANCE_MANAGER')), true, method);
});

test('finance:1 reads and cannot write; finance:0 cannot even read', async () => {
  for (const method of READS) assert.equal(await guardWith({ finance: 1 }).canActivate(ctxFor(method, 'RENTAL_MANAGER')), true, method);
  for (const method of Object.keys(WRITES)) await assert.rejects(() => guardWith({ finance: 1 }).canActivate(ctxFor(method, 'RENTAL_MANAGER')) as any, /finance/);
  for (const method of READS) await assert.rejects(() => guardWith({}).canActivate(ctxFor(method, 'DRIVER')) as any, /finance/);
});

test('an unauthenticated request is refused', async () => {
  await assert.rejects(() => guardWith({ finance: 3 }).canActivate(ctxFor('create')) as any, /Not authenticated/);
});
