/**
 * Does the APPLICATION disable buffer pooling — not the test runner?
 * Run: npm run test:unit
 *
 * The fixture-pad guard next door proves the SETTING matters: shrink the pad to 600 and the PDF tests
 * fail unless the pool is off. It proves nothing about how production gets that setting, because
 * `test:unit` supplies it itself with --require. Delete `import './common/buffer-pool'` from
 * app.module.ts and the whole suite still passes — which is the 4,300-character pad one level up: a
 * guard sitting on its own loading path.
 *
 * So this runs a CHILD with no preload, loads AppModule exactly as the server does, and asks the
 * child what Buffer.poolSize is. When the setting moves to main.ts, retarget the require below — and
 * this test is what forces that move to be deliberate rather than silent.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

test('APPMODULE DISABLES BUFFER POOLING — in a child process with no preload', () => {
  const backend = join(__dirname, '..', '..');
  const out = execFileSync(
    process.execPath,
    ['--require', 'ts-node/register', '-e', "require('./src/app.module'); console.log(Buffer.poolSize)"],
    // NODE_OPTIONS is cleared so an inherited --require cannot supply the setting this test is asking about.
    { encoding: 'utf8', cwd: backend, env: { ...process.env, NODE_OPTIONS: '' }, timeout: 180000 },
  );
  const last = out.trim().split('\n').pop();
  assert.equal(last, '0', 'AppModule no longer disables buffer pooling — pdf-parse will start losing files silently again');
});

test('the module says so itself, so the import is never read as dead code', async () => {
  const mod = await import('./buffer-pool');
  assert.equal(mod.BUFFER_POOL_DISABLED, true);
  assert.equal(Buffer.poolSize, 0, 'and importing it is what sets the value');
});
