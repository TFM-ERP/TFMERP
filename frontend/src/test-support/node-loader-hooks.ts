/**
 * Module resolution hook for running the frontend's node:test suite directly with `node --test`.
 *
 * WHY THIS EXISTS. Next.js's bundler resolves two kinds of specifiers that Node's own ESM loader
 * does not:
 *
 *   1. Extensionless relative imports, e.g. `import x from './rail-icons'` — webpack/Next tries a
 *      list of extensions on your behalf; Node's loader requires the extension to be explicit and
 *      throws ERR_MODULE_NOT_FOUND otherwise.
 *   2. The `@/*` path alias declared in tsconfig.json (`"@/*": ["./src/*"]`) — that alias is a
 *      TypeScript/webpack-only concept. Node's loader has never heard of it and resolves `@/lib/x`
 *      as if it were an npm package literally named `@/lib/x`.
 *
 * Our test files are plain `node:test` + `node:assert/strict`, run with the stock `node` binary and
 * no bundler, so both gaps are real here even though the app itself never hits them (Next's bundler
 * papers over both at build time). This hook closes both, using only Node's own `node:module` API —
 * no ts-node, no webpack, no new dependency.
 *
 * API CHOICE: `module.registerHooks()`. Node also ships an async `module.register()` API that runs
 * hooks off-thread on a dedicated Worker, meant for hooks that must stay ESM-only and non-blocking.
 * We use the *synchronous* `registerHooks()` instead — checked for availability below rather than
 * assumed — because our resolution logic is a handful of synchronous filesystem lookups, it applies
 * to both `require()` and `import()` without needing two separate code paths, and it skips the extra
 * worker thread `register()` spins up for every test run.
 *
 * WIRED IN VIA: `node --import ./src/test-support/node-loader-hooks.ts` in package.json's `test` and
 * `test:watch` scripts. It changes ONLY module *resolution*, never module *content*, so a specifier
 * that genuinely does not exist still fails with Node's own ERR_MODULE_NOT_FOUND — honestly, not
 * papered over.
 */

import { registerHooks } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Minimal ambient augmentation: the pinned @types/node (^20.14.0) predates Node 22.15/23.5, so it
// doesn't declare `module.registerHooks()` at all. This adds just the one missing member, reusing
// @types/node's own (already-correct) `ResolveHook` shape rather than redefining it — no new
// dependency, and since `registerHooks` itself isn't declared elsewhere it can't conflict with
// anything real.
declare module 'node:module' {
  function registerHooks(hooks: { resolve?: import('module').ResolveHook }): void;
}

if (typeof registerHooks !== 'function') {
  throw new Error(
    'module.registerHooks() is not available on this Node version. This hook requires the ' +
      'synchronous module-customization API shipped in Node 22.15+ / 23.5+ (see package.json ' +
      '"engines"). Upgrade Node, or rewrite this hook against module.register() instead.',
  );
}

// This file lives at <frontend>/src/test-support/node-loader-hooks.ts, so its own directory's
// parent is <frontend>/src — exactly the root tsconfig.json's "@/*": ["./src/*"] maps to.
const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EXTENSIONS = ['.ts', '.tsx'];

/**
 * Given an absolute path with no extension, try it as a file (in EXTENSIONS order) and then as a
 * directory's index file (also in EXTENSIONS order). Returns the absolute path that exists on disk,
 * or null when none of the candidates do.
 */
function resolveExtensionless(absPathNoExt: string): string | null {
  for (const ext of EXTENSIONS) {
    const candidate = absPathNoExt + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  for (const ext of EXTENSIONS) {
    const candidate = path.join(absPathNoExt, 'index' + ext);
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // '@/…' → <frontend>/src/… (the tsconfig path alias), then resolved for a missing extension.
    if (specifier.startsWith('@/')) {
      const absNoExt = path.join(SRC_ROOT, specifier.slice(2));
      const resolved =
        existsSync(absNoExt) && statSync(absNoExt).isFile() ? absNoExt : resolveExtensionless(absNoExt);
      if (resolved) {
        return nextResolve(pathToFileURL(resolved).href, context);
      }
      // Nothing on disk matches — fall through with the ORIGINAL specifier so Node raises its own
      // honest "not found" error instead of us inventing a misleading one.
      return nextResolve(specifier, context);
    }

    // Extensionless relative specifiers, e.g. './rail-icons'. Anything with an explicit extension,
    // or any non-relative specifier (bare packages, 'node:*', absolute file: URLs), is left alone.
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
      const parentPath = fileURLToPath(context.parentURL);
      const absNoExt = path.resolve(path.dirname(parentPath), specifier);
      if (!existsSync(absNoExt)) {
        const resolved = resolveExtensionless(absNoExt);
        if (resolved) {
          return nextResolve(pathToFileURL(resolved).href, context);
        }
      }
    }

    return nextResolve(specifier, context);
  },
});
