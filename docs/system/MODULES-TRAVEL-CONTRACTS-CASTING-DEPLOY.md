# Deploy Checklist — Travel, Contracts & Casting Modules

Three new modules were built phase-by-phase (schema → backend → frontend). The code
is in the repo; this is the **merge & push** sequence to bring them live. Nothing
here auto-applies — run each step yourself.

> **Order matters:** schema first, then generate the client, then seed, then restart.
> API keys stay in `backend/.env`. Historical/locked projects are never touched.

---

## 0. Pre-flight

```bash
cd backend
git status            # review the new files below before pushing schema
```

New backend files (already written):

- `src/production/travel/*` — travel.service.ts, travel.controller.ts, integrations/{amadeus,concur}.service.ts
- `src/production/contracts/*` — contracts.service.ts, contracts.controller.ts
- `src/production/casting/*` — casting.service.ts, casting.controller.ts
- `src/production/ledger/ledger.service.ts` — added public `assertPeriodOpen()` guard
- `src/production/production.module.ts` — all three modules registered
- `prisma/seed-deal-memo-template.js` — default DEAL_MEMO template

New frontend files:

- `src/app/(dashboard)/travel/page.tsx`, `.../contracts/page.tsx`, `.../casting/page.tsx`
- `src/app/apply/[callId]/page.tsx` — public talent portal
- `src/lib/api.ts` — `travelApi`, `contractsApi`, `castingApi`
- `src/app/(dashboard)/layout.tsx` — Travel / Contracts / Casting nav entries

---

## 1. Merge the Prisma schema blocks

Paste the schema blocks I provided into `backend/prisma/schema.prisma`:

| Module    | New models | New enums |
|-----------|-----------|-----------|
| **Travel** (2A) | TravelerProfile, Trip, Itinerary, FlightBooking, HotelBooking, CarBooking, VisaApplication, TravelSupplier | TripStatus, BookingStatus, VisaStatus, VisaType, TravelSupplierType |
| **Contracts** (3A) | ContractTemplate, ClauseTemplate, ProjectContract, ContractParty, SignatureAuditLog | ContractType, ProjectContractStatus, ContractPartyRole, SignatureStatus, SignatureMethod, SignatureEvent |
| **Casting** (4A) | GlobalTalentProfile, CastingCall, Submission, Audition, ConsentLog | TalentStatus, CastingRoleType, CastingCallStatus, SubmissionStatus, SubmissionSource, AuditionType, AuditionStatus, ConsentType, ConsentStatus |

**Back-relations to add to existing models:**

```prisma
// ProductionProject
  trips        Trip[]
  contracts    ProjectContract[]
  castingCalls CastingCall[]
  consentLogs  ConsentLog[]

// PurchaseOrder
  itineraries  Itinerary[]
  contract     ProjectContract?

// BudgetLineItem
  contracts    ProjectContract[]

// ProductionCrew
  contracts    ProjectContract[]

// CrewMember
  travelerProfile TravelerProfile?

// BreakdownElement
  castingCalls CastingCall[]

// User
  contractTemplates  ContractTemplate[] @relation("ContractTemplateCreatedBy")
  contractsCreated   ProjectContract[]  @relation("ProjectContractCreatedBy")
  contractPartyLinks ContractParty[]    @relation("ContractPartyUser")
```

> Casting uses **soft string** User refs (createdById, reviewedById, etc.) — no User
> back-relations needed there.

### Optional — enable approval routing

Add to the `WorkflowEntity` enum so Travel/Contracts can route through the engine
(both already degrade gracefully if you skip this):

```prisma
enum WorkflowEntity {
  // ...existing...
  TRIP
  CONTRACT
}
```

---

## 2. Push schema + regenerate client

```bash
cd backend
npx prisma db push          # no migrations — matches project convention
npx prisma generate
```

This is what makes `prisma.contractTemplate`, `prisma.trip`, `prisma.castingCall`,
etc. exist. The new services won't type-check until this runs.

---

## 3. Seed the default Deal Memo template

Required for the Casting → Contracts selection handoff to have something to
generate against:

```bash
node prisma/seed-deal-memo-template.js
```

Creates **"Standard Talent Deal Memo"** (type `DEAL_MEMO`) + 4 standard clauses.
Idempotent — safe to re-run.

---

## 4. Type-check & restart

```bash
cd backend && npx tsc --noEmit       # expect clean now that the client is generated
npm run start:dev                    # or your usual restart

cd ../frontend && rm -rf .next       # clear stale bundle (new api exports)
npm run dev
```

---

## 5. Smoke test

| Flow | How |
|------|-----|
| **Travel** | Sidebar → *Travel & Visas* → Request Trip → pick a visa-required destination → the Visa Auto-Window demands doc uploads before submit. |
| **Contracts** | Sidebar → *Contracts* → pick the Deal Memo template → select a crew member → the **Rate Auto-Window** shows the frozen rate → Draft → Send → Simulate signatures → on full sign, a PO is auto-created and the budget line encumbered. |
| **Casting** | Sidebar → *Casting* → *From breakdown* generates calls → drag a submission onto a calendar slot to book an audition → *Select → Deal Memo* drafts a contract. |
| **Talent portal** | Open `/apply/<castingCallId>` (no login) → fill the form → the **GDPR Auto-Window** blocks submit until consent + right-to-be-forgotten are ticked. |

---

## Guardrails honoured

- **Two-Ledger:** every financial impact (travel actuals, contract commitments)
  goes through `ProjectTransaction` / `PurchaseOrder` under the `assertPeriodOpen()`
  period-lock guard. No direct money movement.
- **API keys** only in `backend/.env` (Amadeus/Concur run in mock mode until keys
  are set). **Video upload** is not enabled.
- **GDPR/CCPA:** talent consent is mandatory at submission and recorded as an
  append-only `ConsentLog`; right-to-be-forgotten flips the profile to
  `DO_NOT_CONTACT` + `erasureRequestedAt`.

---

# Part 2 — Dual-Target Refactor (Standalone Masters + Per-Project)

Each module now works two ways, mirroring the Locations module: a **standalone
master** (left sidebar) that owns project-less records and a cross-project
dashboard, **and** a **per-project tab** scoped to a single project. This is
additive on top of Part 1.

## A. Schema (Slice A)

- `Trip.projectId`, `ProjectContract.projectId`, `CastingCall.projectId` → **nullable**
  (`null` = standalone). Relations made optional.
- `ProductionProject.isHouse Boolean @default(false)` → the single corporate/house
  entity that owns standalone postings.

```bash
cd backend
npx prisma db push
npx prisma generate
node prisma/seed-house-project.js     # seeds the "House / Corporate" project (idempotent)
```

> The House project owns all standalone financial postings. Do not delete it.

## B. Backend (Slice B)

- `LedgerService.getHouseProjectId()` — cached lookup of the `isHouse` project.
- List endpoints take a scope: `?projectId=…` (one project) · `?scope=standalone`
  (project-less) · neither (all — the master view). Old `?projectId=` calls still work.
- Standalone money posts to the House project as **`CORPORATE_OVERHEAD`**, still
  through `assertPeriodOpen()` + `PurchaseOrder` (Two-Ledger intact).
- New rollup endpoints: `GET /travel/dashboard`, `/contracts/dashboard`, `/casting/dashboard`.

## C. Per-project tabs (Slice C)

New **Engagements** group in the project workspace (`production/projects/[id]`):
`TravelPanel`, `ContractsPanel`, `CastingPanel` — each locked to that project's id,
no project selector. Shared bits exported for reuse: `lib/visa-rules.ts`,
`RequestTripModal`, `ContractDrawer`, `CallSubmissions`.

## D. Standalone masters + sidebar (Slice D)

Three new top-level sidebar groups (the old flat Production entries were removed):

| Group | Pages |
|-------|-------|
| **Travel & Visas** | Dashboard (`/travel`) · Travelers (`/travel/travelers`) |
| **Contracts** | Dashboard (`/contracts`) · Templates (`/contracts/templates`) |
| **Casting** | Dashboard (`/casting`) · Talent Database (`/casting/talent`) |

Each dashboard shows the cross-project rollup + an **All / Standalone** toggle and
a "New standalone …" action.

## E. Smoke test (dual-target)

| Flow | How |
|------|-----|
| **Per-project** | Open a project → **Engagements** → Travel/Contracts/Casting are scoped to that project, no project picker. |
| **Master dashboard** | Sidebar → Travel/Contracts/Casting → dashboard loads; toggle All ↔ Standalone. |
| **Standalone posting** | Create a standalone contract → fully sign → confirm the PO lands on the **House/Corporate** project as `CORPORATE_OVERHEAD` (not a real production). |
| **Right to be forgotten** | Casting → Talent Database → trash icon → profile flips to `WITHDRAWN`/`DO_NOT_CONTACT`. |

> Run order for Part 2: `db push` → `generate` → `seed-house-project.js` → restart
> backend → clear `.next` → restart frontend.

---

# Part 3 — Universal Travel Identity (TI-1 → TI-4)

`TravelerProfile` becomes the single immigration/passport record for **all** person
types — Talent, Crew (ATL + BTL), Accompanying Persons, Consultants, VIP Guests —
linked from each master so there's no duplicate data.

## Schema (additive)

- `TravelerProfile` generalised: `personType` (TALENT/ACCOMPANYING/CREW/CONSULTANT/VIP),
  legal/preferred name, gender, country of residence, three photos, passport issue
  date + place + four uploads, travel prefs, emergency contact, `accompaniesId`
  self-relation + `relationship`, `talentProfileId` 1:1 link.
- New models: `TravelerVisa` (standing visas/permits), `TravelerDocument` (typed
  repository), `TravelArrival` (meet & greet → arrival sheet).
- `GlobalTalentProfile.representedById` → User (talent rep).
- `UserRole` enum: **`TALENT_REP`** (own talent only) + **`TRAVEL_COORDINATOR`**
  (travel desk with PII access).
- Permissions: new **`travel_pii`** column in the role matrix (configurable in
  Settings → Roles & Permissions); default ON for `SYSTEM_ADMIN`,
  `PRODUCTION_MANAGER`, `TRAVEL_COORDINATOR`.

```powershell
cd C:\Projects\TFM-System\backend
npx prisma db push
npx prisma generate
npm run start:dev
```

## Backend

- Identity dossier `GET /travel/travelers/:id` — personal/photos/passport/visas/docs/
  companions/arrivals + validation flags + Travel Readiness score.
- Accompanying (`/companions`), standing visas (`/visa-records`), documents
  (`/documents`), meet & greet (`/arrivals`), arrival-sheet data.
- Smart connect: `POST /travel/identities/from-talent/:id` and `/from-crew/:id`
  seed an identity from the casting/crew record (no re-entry).
- Privacy: passport/visa/ID masked unless the requester's role has `travel_pii`.
  `TALENT_REP` is filtered to talent they represent (403 otherwise) on both the
  casting and travel endpoints.

## Frontend

- Reusable `TravelIdentityPanel` opened from **Talent Database**, **Crew Directory**
  (every ATL/BTL crew row → Travel button) and **Travelers** master.
- Readiness widget, validation badges, photo tiles, passport uploads, standing
  visas, documents repository, accompanying mini-profiles, meet & greet.
- **Plan travel** (will-travel one-click) and **Arrival Photo Sheet** (printable).
- Restricted banner + hidden PII sections for non-privileged roles.
- Talent add **and edit** captures union, representative and consent.

## Smoke test

| Flow | How |
|------|-----|
| **Crew travel** | Crew Directory → any row → **Travel** → identity dossier opens (passport carried from directory). |
| **Talent travel** | Talent Database → **Travel** → same dossier; **Plan travel** creates a trip. |
| **Accompanying** | Open an identity → add an accompanying person → it becomes a clickable full sub-profile. |
| **Arrival sheet** | Identity → **Arrival sheet** → Print/PDF shows talent + companions with photos/flights. |
| **PII privacy** | Log in as a non-PII role → passport/visa/ID hidden + "Restricted view" banner. Grant `Travel PII` to a role in Settings → it appears. |
| **Talent rep** | A `TALENT_REP` user sees only the talent assigned to them (Represented by). |

> Run order for Part 3: `db push` → `generate` → restart backend → clear `.next`
> → restart frontend. No new seed scripts required.
