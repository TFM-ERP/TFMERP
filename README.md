# TFM ERP — The Film Makers FZ LLC

Unified ERP system for Rental Operations and Production Project Management.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Node.js + NestJS + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Frontend | Next.js 14 + React + TypeScript + Tailwind CSS |
| Auth | JWT + bcrypt + TOTP (2FA) |
| Charts | Recharts |

---

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ (running locally or via Docker)
- npm or pnpm

---

## Quick Start

### 1. Clone and install

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET
```

### 3. Set up the database

```bash
cd backend

# Create tables from schema
npx prisma migrate dev --name init

# Seed: admin user, VAT rates, bank account, sequences
npx ts-node prisma/seed.ts
```

### 4. Start development servers

```bash
# Terminal 1 — Backend (port 3001)
cd backend
npm run start:dev

# Terminal 2 — Frontend (port 3000)
cd frontend
npm run dev
```

### 5. Open the app

- **ERP Frontend**: http://localhost:3000
- **API Docs (Swagger)**: http://localhost:3001/api/docs
- **Default login**: admin@thefilmmakers.ae / Admin@TFM2024!

> ⚠️ Change the admin password immediately after first login.

---

## Project Structure

```
TFM System/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       ← Database schema (all models)
│   │   └── seed.ts             ← Initial data seed
│   └── src/
│       ├── auth/               ← JWT authentication + 2FA
│       ├── users/              ← User management
│       ├── clients/            ← CRM / client management
│       ├── finance/
│       │   ├── bank-accounts/  ← Company bank accounts
│       │   ├── quotations/     ← Quotations + conversion to invoice
│       │   ├── invoices/       ← Tax invoices + proforma
│       │   ├── payments/       ← Payment recording + clearing
│       │   ├── vat/            ← UAE VAT rates configuration
│       │   └── reports/        ← Finance dashboard + reports
│       └── common/prisma/      ← Prisma service (shared)
└── frontend/
    └── src/
        ├── app/(dashboard)/
        │   └── finance/        ← Finance module pages
        │       ├── page.tsx    ← Finance dashboard
        │       ├── quotations/ ← Quotations list
        │       └── invoices/   ← Invoices list
        ├── lib/
        │   ├── api.ts          ← API client (axios)
        │   └── utils.ts        ← Formatting helpers
        └── components/         ← Shared UI components
```

---

## API Endpoints

All endpoints are prefixed with `/api/v1`. Full interactive docs at `/api/docs`.

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | /auth/login | Login (email + password + optional 2FA) |
| GET | /auth/me | Get current user |
| POST | /auth/2fa/setup | Generate 2FA QR code |
| POST | /auth/2fa/enable | Enable 2FA with verification code |

### Finance
| Method | Endpoint | Description |
|---|---|---|
| GET | /finance/reports/dashboard | YTD KPIs + recent invoices |
| GET | /finance/quotations | List quotations (filterable + paginated) |
| POST | /finance/quotations | Create quotation |
| POST | /finance/quotations/:id/convert-to-invoice | Convert to invoice |
| GET | /finance/invoices | List invoices |
| POST | /finance/invoices/:id/payments | Record a payment |
| GET | /finance/invoices/aging-report | AR aging by bucket |
| GET | /finance/payments/summary | Cleared / pending / bounced totals |
| GET | /finance/bank-accounts | List bank accounts |
| GET | /finance/vat | List VAT rates |

---

## Development Roadmap

### Phase 1 — Core Finance (Current)
- [x] Auth & user management
- [x] Client (CRM) module
- [x] Bank account management
- [x] Quotations with line items
- [x] Tax invoices (with VAT)
- [x] Payment recording & aging report
- [x] Finance dashboard

### Phase 2 — Rental Operations
- [ ] Asset & caravan profiles
- [ ] Rental booking system
- [ ] Rental contracts
- [ ] Dispatch command center
- [ ] Driver mobile app (React Native)

### Phase 3 — Production
- [ ] Production project management
- [ ] Budget vs. actual tracking
- [ ] Crew & call sheets
- [ ] Location management

### Phase 4 — Integrations
- [ ] WhatsApp Business API (send quotations, invoices)
- [ ] Email notifications (SendGrid)
- [ ] OCR receipt scanning
- [ ] PDF invoice generation

---

## Docker (Optional)

```bash
# Start PostgreSQL only
docker run -d \
  --name tfm-postgres \
  -e POSTGRES_DB=tfm_erp \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15

# DATABASE_URL in .env:
# postgresql://postgres:postgres@localhost:5432/tfm_erp
```
