# Frontend test runner

## Running the tests

```
cd frontend && npm test          # run once
cd frontend && npm run test:watch  # watch mode
```

Same shape on the backend:

```
cd backend && npm test
```

Both run on the stock `node` binary via `node --test`, using Node 22.15+/23.5+'s built-in
TypeScript type-stripping — no ts-node in the frontend, no bundler, no test framework
dependency (`node:test` + `node:assert/strict` only).

## Why there is a module resolution hook at all

Node's ESM loader is stricter than Next's bundler about how a specifier resolves:

- **Extensionless relative imports** (`import x from './rail-icons'`) — webpack/Next tries a
  list of extensions for you. Node's loader requires the extension explicitly and throws
  `ERR_MODULE_NOT_FOUND` otherwise.
- **The `@/*` path alias** from `tsconfig.json` (`"@/*": ["./src/*"]`) — a TypeScript/webpack-only
  concept. Node's loader has never heard of it and tries to resolve `@/lib/x` as an npm package
  literally named `@/lib/x`.

`node-loader-hooks.ts` closes both gaps with Node's own `node:module.registerHooks()` API — no
ts-node, no webpack, no new dependency. It changes only *resolution*, never module *content*: a
specifier that genuinely doesn't exist on disk still fails with Node's own
`ERR_MODULE_NOT_FOUND`, unmodified. It's wired in via `--import` in both `test` and `test:watch`.

## The JSX boundary

These tests cover **pure TypeScript logic** — nothing else. Node's built-in TypeScript support
strips type *annotations*; it is not a JSX transform, and Node ships no JSX transform of its own.
The moment a test's import chain reaches a `.tsx` file (or a `.ts` file containing JSX), it fails
with `ERR_UNKNOWN_FILE_EXTENSION` (or a TypeScript syntax error on the JSX itself) — no flag
changes this.

**The fix is always to separate the logic from the rendering, never to work around the loader.**
This project already does that in two places:

- `studio-view.logic.ts` / `studio-view.logic.test.ts` — the `*.logic.ts` / `*.logic.test.ts`
  pairing used throughout ScriptOn for pure view-state logic that a `.tsx` component consumes.
- `os-workspaces.data.ts` / `os-workspaces.ts` — the workspace records and their pure functions
  (`filterWorkspaces`, `activeWorkspaceKey`, `rememberFilmosRoute`, `lastFilmosRoute`) live in
  `os-workspaces.data.ts`, which has no React or `.tsx` in its import chain. `os-workspaces.ts`
  attaches the React icon components on top and re-exports everything under the same names, so
  every existing consumer (`ScriptOnStudio.tsx`, `shared/sx.tsx`, `(dashboard)/layout.tsx`,
  `useScriptonBack.ts`) is unaffected.

**Follow this convention for new logic you want covered here:** if it doesn't need to render
anything, put it in a JSX-free `*.data.ts` or `*.logic.ts` module and test that module directly.
If it does render something, the render itself is not something this runner can test — see below.

## Component and flow coverage: Playwright, not this runner

`node --test` intentionally stays scoped to pure logic. Anything that renders — a component
mounting, a click, an actual page flow — is out of scope here and belongs in Playwright, which is
already in `devDependencies` (`^1.61.1`). It isn't set up yet; getting started needs only a
one-time browser download:

```
cd frontend && npx playwright install chromium
```

**Why not add a JSX transform and a DOM library to this runner instead?** That's the obvious
alternative (esbuild/babel/swc for JSX, jsdom for a DOM) and it's deliberately not taken: this
project keeps `package.json` frozen — no new dependencies, in either app — and Playwright already
covers that ground without adding anything new to install.
