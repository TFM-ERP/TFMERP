# TFM ERP — The Film Makers FZ LLC

Unified ERP platform for a UAE film-production company, covering **finance & accounting, rental-fleet operations, and film-production management** (the "ScripON" production suite) in one system.

> **Scale (code-derived, not aspirational):** ~**280** Prisma models, **134** API controllers, **40+** backend feature modules, and a Next.js front end spanning a back-office dashboard, a mobile crew app, a driver app, printable documents, and public token-gated links.
>
> For the authoritative, code-generated map of every controller and its access level, see [`docs/SYSTEM-MAP.md`](docs/SYSTEM-MAP.md). For the release-readiness/hardening plan, see [`FOUNDATIONS.md`](FOUNDATIONS.md).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Node.js + **NestJS 11** + TypeScript |
| Database | **PostgreSQL** + **Prisma 6** ORM |
| Frontend | **Next.js 14** (App Router) + React 18 + TypeScript + Tailwind CSS |
| Auth | JWT (Passport) + bcrypt + **TOTP 2FA** (otplib) |
| Realtime / Audio | Socket.IO · LiveKit · ElevenLabs (production audio studio) |
| Front-end libs | TanStack Query · Jotai · React Hook Form + Zod · Recharts · Leaflet (maps) · pdf.js |
| API docs | Swagger / OpenAPI at `/api/docs` |

---

## What's in the system

The platform is organized into business domains. Each maps to one or more backend modules under `backend/src/` and screens under `frontend/src/app/`.

- **Finance & Accounting** — quotations, tax invoices (UAE VAT), payments & AR aging, bank accounts, expenses, suppliers, services; double-entry **accounting** (journals, ledger, bank reconciliation); **collections** (statements + reminders); multi-currency **FX**; spend **approvals**.
- **Rental Operations** — assets/fleet, bookings & calendar, contracts, drivers, fuel, damage & incidents, logistics/dispatch, utilization; **maintenance** (jobs, parts, tires, vendors, invoices); condition reports; inventory.
- **Production — "ScripON"** — script ingest & breakdown engines, casting, scheduling, call sheets, sun-path/locations, budgets & fringes, crew, deliverables, and an AI **audio studio** (voice render via ElevenLabs/LiveKit).
- **People & CRM** — HR (employees, attendance, leave, **payroll**), clients, CRM leads, contacts, company profile.
- **Platform & Admin** — auth + 2FA, users, **RBAC permissions**, settings/preferences, audit vault, database backups, notifications, saved views, workflows, integrations, compliance (UAE **e-invoicing**), comms, telemetry, dashboards & reports.

### Front-end surfaces (`frontend/src/app/`)

| Route group | Purpose |
|---|---|
| `(dashboard)/` | Main back-office application |
| `m/` | Mobile crew app (call sheets, schedule, recce, transport, travel, comms) |
| `driver/` | Driver app (dispatch, jobs) |
| `print/` | Printable PDFs — invoices, quotations, call sheets, budgets, breakdowns, credits, deal memos |
| `apply/` · `clearance/` · `listen/` · `vendor-onboarding/` · `a/` | Public, token-gated links (casting apply, clearance packs, audio share, vendor onboarding) |
| `login/` · `setup/` | Authentication and first-run setup |

---

## Access control (RBAC)

Authentication is enforced per-controller by `JwtAuthGuard`; authorization by `PermissionsGuard` + `@RequirePermission(module, level)`.

- **Modules:** `home`, `finance`, `crm`, `rentals`, `partners`, `production`, `hr`, `compliance`, `reports`, `setup`, `travel_pii`
- **Levels:** `0` none · `1` view · `2` edit · `3` manage
- `SYSTEM_ADMIN` bypasses all checks. Per-project roles *add* restrictions for assigned users.

> ⚠️ A controller with no `@RequirePermission` is reachable by **any authenticated user**. The current coverage and any open gaps are tracked in [`docs/SYSTEM-MAP.md`](docs/SYSTEM-MAP.md).

---

## Prerequisites

- **Node.js 20+**
- **PostgreSQL 15+** (local or via Docker)
- npm

---

## Quick Start

### 1. Install

```bash
cd backend  && npm install
cd ../frontend && npm install
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
```

Set at least these in `backend/.env`:

| Key | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `PORT` | Backend port (default `3001`) |
| `FRONTEND_URL` | Allowed CORS origin (e.g. `http://localhost:3000`) |
| `COMPANY_NAME`, `COMPANY_TRN`, `DEFAULT_CURRENCY`, `VAT_RATE` | Company / tax defaults |

### 3. Set up the database

```bash
cd backend
npm run migrate        # apply migrations (prisma migrate dev)
npm run db:seed        # seed admin user, VAT rates, sequences, etc.
```

> **Note on schema drift:** the schema was grown largely via `prisma db push`, so migration history lags the live schema. For an existing database, reconcile with `npm run migrate:status` and `scripts/db-reconcile.sh` (see `FOUNDATIONS.md`) rather than running migrations blindly.

### 4. Run the dev servers

```bash
# Terminal 1 — backend (http://localhost:3001)
cd backend && npm run start:dev

# Terminal 2 — frontend (http://localhost:3000)
cd frontend && npm run dev
```

### 5. Open the app

- **Frontend:** http://localhost:3000
- **API docs (Swagger):** http://localhost:3001/api/docs
- **Default admin:** `admin@thefilmmakers.ae` (password as set in `backend/prisma/seed.ts`) — **change it immediately after first login.**

---

## Useful scripts

**Backend** (`backend/`)

| Command | Description |
|---|---|
| `npm run start:dev` | Start API in watch mode |
| `npm run build` | Production build (`nest build`) |
| `npm run db:seed` | Seed initial data |
| `npm run migrate` / `migrate:status` / `migrate:deploy` | Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run test:unit` / `test:watch` | Unit tests (Node test runner + ts-node) |
| `npm run lint` | ESLint (autofix) |

**Frontend** (`frontend/`): `npm run dev` · `npm run build` · `npm run start` · `npm run lint`

---

## Testing

Unit tests run on Node's built-in test runner via `ts-node` (no Jest required):

```bash
cd backend
npm run test:unit     # run once
npm run test:watch    # TDD loop
```

Pattern: pure logic is extracted into `*.util.ts` files and tested directly in `*.spec.ts`, avoiding the NestJS/Prisma/AI dependency chain. See `FOUNDATIONS.md` for the testing approach and high-value targets.

---

## Project layout

```
TFM-System/
├── backend/                 # NestJS API
│   ├── prisma/
│   │   ├── schema.prisma     # ~280 models
│   │   ├── migrations/       # migration history (lags schema — see FOUNDATIONS.md)
│   │   └── seed.ts           # initial data
│   └── src/
│       ├── auth/ users/ permissions/      # identity, RBAC
│       ├── finance/ accounting/ collections/ fx/   # money
│       ├── rental/ maintenance/ inventory/         # fleet ops
│       ├── production/ crew/ meetings/             # ScripON / production
│       ├── hr/ clients/ crm/ contacts/            # people & CRM
│       ├── integrations/ ai/ comms/ audit/ backups/  # platform
│       └── common/           # shared Prisma service, guards, tenancy helpers
├── frontend/                # Next.js 14 app (App Router)
│   └── src/app/             # (dashboard), m, driver, print, public routes
├── docs/SYSTEM-MAP.md       # code-derived controller + security inventory
└── FOUNDATIONS.md           # release-readiness / hardening plan
```

---

## Status & hardening priorities

The application is broad and largely functional across the domains above. The current focus is **hardening**, in risk-ascending order (details in `FOUNDATIONS.md` and `docs/SYSTEM-MAP.md`):

1. **Test coverage** — expand unit tests around money, VAT, payroll, and scheduling logic. *(Low risk.)*
2. **Migration baseline** — reconcile schema-vs-migration drift on a backup DB before further schema work. *(Medium risk.)*
3. **Security gates** — finish applying `@RequirePermission` to remaining auth-only controllers (the critical `/backups`, `/users`, `/hr/payroll` gaps are already closed). *(Ongoing.)*
4. **Multi-tenancy** — not yet implemented; highest blast radius, planned last behind the test net and a clean migration baseline.

---

_Internal system — The Film Makers FZ LLC. UNLICENSED / proprietary._
