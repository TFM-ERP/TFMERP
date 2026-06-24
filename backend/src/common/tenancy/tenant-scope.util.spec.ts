/** Tenant-scoping core — pure-logic unit tests (node:test + ts-node). Run: npm run test:unit */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { isTenantScoped, scopeWhere, stampTenant, applyTenantToArgs, redirectsToFindFirst, tenantRowAllowed, TENANT_SCOPED_MODELS } from './tenant-scope.util';

test('only the declared root models are tenant-scoped', () => {
  assert.equal(isTenantScoped('User'), true);
  assert.equal(isTenantScoped('ProductionProject'), true);
  assert.equal(isTenantScoped('ScriptScene'), false);
  assert.equal(isTenantScoped(undefined), false);
  assert.ok(TENANT_SCOPED_MODELS.has('Supplier'));
});

test('scopeWhere injects tenantId, merging existing filters; leaves child models alone', () => {
  assert.deepEqual(scopeWhere('User', { email: 'a@b.com' }, 't1'), { email: 'a@b.com', tenantId: 't1' });
  assert.deepEqual(scopeWhere('Supplier', undefined, 't1'), { tenantId: 't1' });
  assert.deepEqual(scopeWhere('ScriptScene', { revisionId: 'r1' }, 't1'), { revisionId: 'r1' });
});

test('scopeWhere respects explicit tenantId + audited bypass, and fails closed', () => {
  assert.deepEqual(scopeWhere('User', { tenantId: 't2' }, 't1'), { tenantId: 't2' });
  assert.deepEqual(scopeWhere('User', { email: 'x' }, null), { email: 'x' });
  assert.throws(() => scopeWhere('User', {}, undefined), /Tenant context required/);
});

test('stampTenant sets tenantId on create (single + array), keeping explicit values; fails closed', () => {
  assert.deepEqual(stampTenant('Supplier', { name: 'A' }, 't1'), { name: 'A', tenantId: 't1' });
  assert.deepEqual(stampTenant('Supplier', [{ n: 1 }, { n: 2, tenantId: 't9' }], 't1'), [{ n: 1, tenantId: 't1' }, { n: 2, tenantId: 't9' }]);
  assert.deepEqual(stampTenant('ScriptScene', { n: 1 }, 't1'), { n: 1 });
  assert.throws(() => stampTenant('Supplier', { n: 1 }, undefined), /Tenant context required/);
});

test('applyTenantToArgs scopes reads and stamps creates per operation', () => {
  assert.deepEqual(applyTenantToArgs('Supplier', 'findMany', { where: { active: true } }, 't1'), { where: { active: true, tenantId: 't1' } });
  assert.deepEqual(applyTenantToArgs('Supplier', 'create', { data: { name: 'A' } }, 't1'), { data: { name: 'A', tenantId: 't1' } });
  const up = applyTenantToArgs('Supplier', 'upsert', { where: { id: 's1' }, create: { name: 'A' }, update: {} }, 't1');
  assert.equal(up.where.tenantId, 't1'); assert.equal(up.create.tenantId, 't1');
  assert.deepEqual(applyTenantToArgs('ScriptScene', 'findMany', { where: { revisionId: 'r' } }, 't1'), { where: { revisionId: 'r' } });
});

test('redirectsToFindFirst flags findUnique on scoped models', () => {
  assert.equal(redirectsToFindFirst('Supplier', 'findUnique'), 'findFirst');
  assert.equal(redirectsToFindFirst('Supplier', 'findUniqueOrThrow'), 'findFirstOrThrow');
  assert.equal(redirectsToFindFirst('ScriptScene', 'findUnique'), false);
});

test('tenantRowAllowed guards findUnique results (post-filter)', () => {
  assert.equal(tenantRowAllowed(null, 't1'), true);                       // nothing to leak
  assert.equal(tenantRowAllowed({ id: 'a', tenantId: 't1' }, 't1'), true); // same tenant
  assert.equal(tenantRowAllowed({ id: 'a', tenantId: 't2' }, 't1'), false);// cross tenant → blocked
  assert.equal(tenantRowAllowed({ id: 'a', tenantId: 't2' }, null), true); // audited bypass
  assert.equal(tenantRowAllowed({ id: 'a' }, 't1'), true);                 // tenantId not selected → can't check
});
