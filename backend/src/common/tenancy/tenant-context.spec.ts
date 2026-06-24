/** TenantContext (AsyncLocalStorage) — unit tests (node:test + ts-node). Run: npm run test:unit */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { TenantContext } from './tenant-context';

test('get() is undefined with no context (default-deny)', () => {
  assert.equal(TenantContext.get(), undefined);
});

test('run() puts a tenant in scope for the duration of the callback', () => {
  const seen = TenantContext.run('t1', () => TenantContext.get());
  assert.equal(seen, 't1');
  assert.equal(TenantContext.get(), undefined); // restored after
});

test('run(null) is an explicit bypass; nested runs override', () => {
  TenantContext.run(null, () => {
    assert.equal(TenantContext.get(), null);
    const inner = TenantContext.run('t2', () => TenantContext.get());
    assert.equal(inner, 't2');
    assert.equal(TenantContext.get(), null); // outer restored
  });
});
