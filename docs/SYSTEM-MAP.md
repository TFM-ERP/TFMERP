# TFM ERP — System Map & Security-Coverage Inventory

_Generated from the code on 2026-06-24 (not from the README, which is badly out of date)._
_Source of truth: `backend/src/**/*.controller.ts`. Counts: **134 controller classes across 124 files.**_

> ⚠️ **The README describes ~4 finance modules with rental/production as unbuilt `[ ]` roadmap.**
> The actual system is a ~280-model ERP. This file is the real map. Treat the README's
> "Development Roadmap" as historical fiction.

## How access control works here
- **AuthN:** `JwtAuthGuard` (per-controller; there is no global guard).
- **AuthZ:** `PermissionsGuard` + `@RequirePermission(module, level)` — module ∈ {home, finance,
  crm, rentals, partners, production, hr, compliance, reports, setup, travel_pii}; level 0 none /
  1 view / 2 edit / 3 manage. `SYSTEM_ADMIN` always passes.
- **Per-project roles** (`ProjectRoleAssignment`) are **deliberately fail-open** — they *add*
  restrictions for assigned users only; project access itself is governed by global module RBAC.
- A controller with **no `@RequirePermission`** is reachable by **any authenticated user**.

## Coverage summary (class-level)
| Category | Count | Meaning |
|---|---|---|
| PUBLIC (no auth) | 4 | login, casting apply, contract webhook, integrations list |
| PUBLIC (throttled, token-gated) | 3 | vendor-onboarding, clearance, audio-share |
| AUTH-ONLY (no permission gate) | 54 | any logged-in user (some gate at method level — verify per controller) |
| PERMISSIONED | 73 | `@RequirePermission` present (finance / production / rentals / setup) |

> Caveat: the scan reads **class-level** decorators. Some "AUTH-ONLY" controllers gate sensitive
> actions at the **method** level (e.g. `/permissions` → `setup:3` on matrix edit). The gaps below
> were each verified by reading the controller.

---

## 🔴 VERIFIED security gaps (prioritized)

| Pri | Route | Controller | Issue (verified) |
|---|---|---|---|
| **CRITICAL** | `/backups` | BackupsController | `JwtAuthGuard` only — **any user can create / download / restore / delete DB backups** (full-DB exfiltration or destruction). Needs `setup:3` (admin). |
| **CRITICAL** | `/users` | UsersController | `JwtAuthGuard` only — any user can list/create/update users and **reset passwords** (account takeover / privilege escalation). Needs `setup:3` (and guard role changes). |
| **CRITICAL** | `/hr/payroll` | hr/PayrollController | `JwtAuthGuard` only, **no permission gate at all** — any user reads/generates payslips & salaries. Needs `finance` or `hr` perm (cf. the `/production/payroll` fix → `finance:1`). |
| **HIGH** | `/finance/collections` | CollectionsController | `JwtAuthGuard` only — AR/collections data + sends reminder/statement emails to clients. Missed in the finance sweep (it lives under `src/collections/`). Needs `finance:1` (+`:2` for the email/scan actions). |
| **HIGH** | `/maintenance` | maintenance/InvoicesController | `JwtAuthGuard` only — third-party maintenance invoices ($). Needs a permission gate (rentals or finance). |
| **MED** | `/hr`, `/hr/attendance` | HrController, AttendanceController | `JwtAuthGuard` only — HR/PII to any user. Gate with `hr:1`. |
| **MED** | `/integrations` `GET /` | IntegrationsController | List endpoint is public (unauthenticated). Confirm it exposes only provider names/connection status, not tokens. (Other integration routes are `JwtAuthGuard`-protected.) |
| **MED** | `/production/costing/chat-receipt` | ChatReceiptController | $ data, no permission gate. |
| **LOW/INFO** | many AUTH-ONLY (clients, contacts, crew, driver-app, settings, company, compliance, audit, notifications, status, fx, pm, crm, dashboard, reports …) | — | Reachable by any authenticated user. Some may be intentional; each should be confirmed and given an appropriate `@RequirePermission`. |

**Already fixed earlier this session:** the 9 `/finance/*` controllers (`finance:1`, money-state mutations `finance:2`), `/production/payroll` (`finance:1`), `/production/budget` (`production:2`), accounting bulk-ops (`finance:2`), public-endpoint throttling, hardcoded token secrets, constant-time login.

**Verified NOT a gap:** `/permissions` (matrix edit is `setup:3` at method level); `/integrations` disconnect/import (JwtAuthGuard); `/casting/public`, `/public/*` (intentionally token-gated, now throttled).

---

## Full controller inventory

### Public (no JwtAuthGuard)
- `/auth` — AuthController (login/2FA; login throttled 5/15min) ✓ intended
- `/casting/public` — CastingPublicController (actor apply; HMAC/token-gated) — review PII in responses
- `/contracts/webhooks` — ContractsWebhookController (external webhook) — verify signature check
- `/integrations` `GET /` — IntegrationsController (list) — see gap above

### Public, throttled + token-gated
- `/public/vendor-onboarding` — VendorOnboardingPublicController (30/min)
- `/public/clearance` — ClearancePacksPublicController (30/min)
- `/public/audio-share` — AudioSharePublicController (20/min; passcode now hashed)

### Authenticated, no class-level permission gate (verify each)
account, audit, backups⚠, clients, comms/* (channels, messages, search, signoffs), company,
compliance, condition-reports, contacts(PII), crew(PII), crm, dashboard, driver-app(PII),
finance/collections⚠($), fx, hr⚠(PII), hr/attendance(PII), hr/payroll⚠($+PII), labor,
logistics/captain, maintenance⚠($), maintenance/{jobs,parts,tires,vendors}, me/notifications,
me/saved-views, notifications, permissions(method-gated ✓), pm, production/costing/chat-receipt($),
production/documents, production/presence(PII), rental/{assets,bookings,contracts,damage,
drivers(PII),fuel,incidents,logistics,maintenance}, reports, security/otp, settings, status,
transport/telemetry, upload, users⚠, workflow

### Permissioned (has `@RequirePermission`)
- **finance:1** — accounting, finance/{approvals,bank-accounts,expenses,invoices,payments,
  quotations,reports,services,suppliers,vat} _(money-state mutations require finance:2)_
- **production:2** — production/budget($), production/gl($), production/audio (render/voice/layers/
  pronunciation/share), production/vendor-onboarding (admin)
- **production:1** — ~50 production controllers (script/scripton, casting, scheduling, breakdown,
  callsheets, costing($), ledger($), payroll($→finance:1 on reads), locations, travel(PII),
  crew(PII), deliverables, dpr, brief, sides, sun-path, movie-magic, …)
- **production:3** — comms/audit (AuditVaultController)
- **rentals:1** — inventory
- **setup:3** (method-level) — permissions/matrix

_To regenerate: `node` scan of `@Controller` + guard/`@RequirePermission` decorators per class._
