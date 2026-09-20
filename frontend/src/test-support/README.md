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
already in `devDependencies` (`^1.61.1`). Getting started needs only a one-time browser download:

```
cd frontend && npx playwright install chromium
```

**Why not add a JSX transform and a DOM library to this runner instead?** That's the obvious
alternative (esbuild/babel/swc for JSX, jsdom for a DOM) and it's deliberately not taken: this
project keeps `package.json` frozen — no new dependencies, in either app — and Playwright already
covers that ground without adding anything new to install.

## Running the Playwright suite

The one suite that exists today is `frontend/e2e/invoice-lifecycle.spec.ts`, configured by
`frontend/playwright.config.ts` (`testDir: './e2e'` — kept well clear of this runner's own
`src/**/*.test.ts` glob so the two never pick up each other's files).

```
cd frontend
E2E_USER=you@thefilmmakers.com E2E_PASSWORD='...' npm run test:e2e
```

It needs the app already running the normal way (`npm run dev` in both `frontend` and
`backend` — the config has no `webServer` entry and never starts, stops or restarts either
server, since this machine's dev server may be shared with someone else) and three environment
variables, **which the person running the suite sets themselves**:

| Variable        | Required | Meaning                                              |
|------------------|----------|-------------------------------------------------------|
| `E2E_BASE_URL`   | no       | frontend origin; defaults to `http://localhost:3000`  |
| `E2E_USER`       | yes      | login email of an account on the running app          |
| `E2E_PASSWORD`   | yes      | that account's password                                |

If `E2E_USER` or `E2E_PASSWORD` is missing, every test skips cleanly with a message saying so —
it never falls through to the login form and hangs, and it never reads a credential from
anywhere else (a config file, `.env`, the shell's saved history) on its own.

**This suite performs no writes, on purpose.** The app it drives talks to this company's live
production accounting database — there is no test database to point it at instead. Voiding,
deleting, archiving, changing status or recording a payment through this suite would be a real
change to the real books, not a throwaway test fixture. Every test opens a dialog, checks what it
offers or refuses (a disabled Confirm button, a hidden menu, a missing status option), and closes
it with Cancel; none of them click a submit button that would actually mutate an invoice. Keep it
that way when adding to this file — if a write-path test is ever genuinely needed (e.g. proving a
void really does post a reversing journal entry), give it its own disposable draft invoice that
the test creates and tears down itself, gated behind an explicit opt-in environment variable, and
never let it run by default against whatever database `E2E_BASE_URL` happens to point at.
