# Superpowers — First Task

A ready-to-paste prompt for running the **Superpowers** plugin in Claude Code on this project for the first time.

It's a *take-stock-first* task: Superpowers will verify the real current state and propose the next step **before** changing any code. Safe to run anytime.

## How to run

1. Open PowerShell.
2. Go to the project folder:
   ```
   cd "C:\Projects\TFM-System"
   ```
3. Start Claude Code:
   ```
   claude
   ```
4. Copy the prompt below (everything inside the box) and paste it in.

## The prompt — copy from here

```
I'm working on the TFM ERP — a NestJS + Prisma + Next.js system for a film-production company (The Film Makers FZ LLC). Before writing ANY code, I want you to get your bearings and recommend the best next step. Use your brainstorming and test-driven-development skills, and ask me questions if anything is unclear.

Please:
1. Read FOUNDATIONS.md and README.md in the repo root — but treat FOUNDATIONS.md as possibly out of date (it's from June 19, and the code has moved on since).
2. Verify the ACTUAL current state — don't assume:
   - In /backend, run `npm run test:unit` and tell me what passes/fails.
   - Run `npx prisma migrate status` and report the result.
   - List which `src/**/*.util.ts` helpers already have matching `.spec.ts` tests, and note any that don't.
   - If a command needs the database and it isn't running, just say so and move on — do NOT start any services or change anything without asking me first.
3. Based on what you actually find, recommend the SINGLE highest-value, lowest-risk next improvement. Keep the riskiest work (multi-tenancy) for later.
4. Show me your recommendation as a short plan and WAIT for my go-ahead before changing any code.
```

## What to expect

- Superpowers will likely **ask you a few questions** first — that's by design. Answer in plain language.
- It **won't change any code** until you approve its plan.
- Once you approve, it works in small steps: write a failing test, make it pass, review, repeat (test-driven development).

## Notes from the initial review (2026-06-24)

- **Stack:** NestJS + TypeScript backend, PostgreSQL + Prisma, Next.js 14 + React + Tailwind frontend, JWT + 2FA auth.
- **Tests have grown** past the "8 unit tests" noted in FOUNDATIONS.md — every `*.util.ts` helper now appears to have a matching `*.spec.ts`.
- **Migrations:** the `prisma/migrations` folder appears to have no migration `.sql` files, while the schema is very large (~260 models). Reconciling this drift is *medium-risk* — do it on a backup/staging DB, after tests, before multi-tenancy.
- **Multi-tenancy:** scaffolding has started (`common/tenancy/`). Highest blast radius — keep it last, behind the test net and a clean migration baseline.
