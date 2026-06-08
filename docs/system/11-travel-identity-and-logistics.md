# SYS-11 — Travel, Visa & Identity

The Travel module is built around a single **universal Travel Identity**
(`TravelerProfile`) that is the primary source for all travel and immigration
documentation — for **Talent, Crew (above- and below-the-line), Accompanying
Persons, Consultants and VIP Guests**. Trips, itineraries, bookings, visas,
documents, readiness and meet-&-greet all hang off that one identity, so there is
no duplicate data entry across modules.

Financially it honours the **Two-Ledger** principle: commitments become
`PurchaseOrder`s and actuals become `ProjectTransaction`s, both through the
period-lock guard.

---

## 1. Where it lives

| Surface | Route | Purpose |
|---------|-------|---------|
| Master dashboard | `/travel` | Cross-project rollup (trips by status, visas due, upcoming, standalone) + **All / Standalone** toggle; "New standalone trip". |
| Travelers directory | `/travel/travelers` | The universal identity directory (Talent/Crew/Consultant/VIP). Add traveller, open the identity dossier. |
| Travel Identity dossier | drawer (reused everywhere) | Full per-person record — see §4. |
| Per-project panel | Project workspace → **Engagements → Travel & Visas** | Trips/approvals/visas for that project only. |
| From Talent | `/casting/talent` → **Travel** | Opens the talent's identity (created on first click). |
| From Crew | `/production/crew` → **Travel** | Opens the crew member's identity (ATL or BTL). |

Reusable component: `components/production/TravelIdentityPanel.tsx`. Per-project
panel: `components/production/TravelPanel.tsx`.

---

## 2. Data model

### The identity

**`TravelerProfile`** — the universal Travel Identity.
- `personType` (`TravelerPersonType`: TALENT / ACCOMPANYING / CREW / CONSULTANT / VIP)
- Personal: `fullName`, `legalName` (as per passport), `preferredName`, `gender`,
  `email`, `phone`, `nationality`, `countryOfResidence`
- Passport (PII): `passportNumber`, `passportPlaceOfIssue`, `passportIssueDate`,
  `passportExpiry`; `dateOfBirth`; `nationalId`
- Photos: `headshotUrl`, `passportPhotoUrl`, `additionalIdPhotoUrl`
- Passport uploads: `passportFrontUrl`, `passportInfoUrl`, `passportAdditionalUrl`,
  `passportPdfUrl`
- `travelPrefs` (Json: seat/meal/hotel/airline/per-diem notes),
  `emergencyContactName/Phone`, GDPR (`gdprConsent`, `consentAt`)
- **Links**: `crewMemberId` → `CrewMember` (1:1), `talentProfileId` →
  `GlobalTalentProfile` (1:1), and the self-relation `accompaniesId` +
  `relationship` for **accompanying persons** (each a full linked identity).
- Children: `trips[]`, `visas[]` (trip-driven), `travelerVisas[]` (standing),
  `documents[]`, `arrivals[]`.

### Supporting models

- **`TravelerVisa`** — standing person-level visa/residence permit (distinct from
  the trip-driven `VisaApplication`): `visaType`, `country`, `issueDate`,
  `expiryDate`, `entriesAllowed`, `sponsor`, `status` (`TravelerVisaStatus`), and
  upload URLs (`visaCopyUrl`, `evisaPdfUrl`, `entryPermitUrl`, `residencePermitUrl`).
- **`TravelerDocument`** — typed documents repository: `type` (`TravelerDocType`:
  PASSPORT/VISA/NATIONAL_ID/EMIRATES_ID/DRIVERS_LICENSE/RESIDENCE_PERMIT/
  ENTRY_PERMIT/VACCINATION/INSURANCE/FLIGHT_ITINERARY/HOTEL_VOUCHER/
  INVITATION_LETTER/WORK_PERMIT/PERMIT_APPROVAL/CUSTOMS/OTHER), `fileUrl`,
  `expiryDate`.
- **`TravelArrival`** — meet & greet: `airport`, `flightNumber`, `arrivalTime`,
  `terminal`, `driverAssigned`, `coordinatorAssigned`, optional `tripId`.

### Trip & booking stack

- **`Trip`** — `projectId` (nullable → **standalone** → House ledger),
  `travelerId`, origin/destination, dates, `estimatedCost`, `currency`,
  `status` (`TripStatus`). A trip routes through the approval engine
  (`WorkflowEntity.TRIP`) when configured.
- **`Itinerary`** — `tripId`, `currency`, `totalCost`, `status`
  (`TravelBookingStatus`), `purchaseOrderId` (Two-Ledger), `postedTxnId`.
- **`FlightBooking`** / **`HotelBooking`** / **`CarBooking`** — per-itinerary.
- **`VisaApplication`** — trip-driven visa with SLA (see §5).
- **`TravelSupplier`** — airlines/hotels/agencies directory.

---

## 3. Backend API

Service: `backend/src/production/travel/travel.service.ts`.
Controller: `travel.controller.ts` (`@RequirePermission('production', 1)`).

### Identity

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/travel/travelers?personType=&includeCompanions=` | Directory (top-level only by default; rep-filtered; PII-masked). |
| GET | `/travel/travelers/:id` | Full dossier + validation flags + readiness (PII-masked). |
| GET | `/travel/travelers/:id/readiness` | Readiness score only. |
| GET | `/travel/travelers/:id/arrival-sheet` | Arrival Photo Sheet data (host + companions). |
| POST | `/travel/travelers` | Create a traveller. |
| PUT | `/travel/travelers/:id` | Update identity / passport. |
| POST | `/travel/travelers/:id/companions` | Add an accompanying person (full identity). |
| POST | `/travel/travelers/:id/visa-records` | Add a standing visa. |
| PUT/DELETE | `/travel/visa-records/:id` | Update / remove a standing visa. |
| POST | `/travel/travelers/:id/documents` | Add a repository document. |
| DELETE | `/travel/documents/:id` | Remove a document. |
| POST | `/travel/travelers/:id/arrivals` | Upsert meet-&-greet arrival info. |
| POST | `/travel/identities/from-talent/:talentId` | **Smart connect** — create identity from a casting profile. |
| POST | `/travel/identities/from-crew/:crewMemberId` | **Smart connect** — create identity from a crew record. |

### Trips, itineraries, Two-Ledger, visas

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/travel/dashboard` | Cross-project rollup. |
| GET | `/travel/trips?projectId=&scope=` | List trips (`scope=standalone` or all). |
| GET | `/travel/trips/:id` | Trip + traveller + visas + itineraries. |
| POST | `/travel/trips` | Request a trip (project or standalone). |
| POST | `/travel/trips/:id/approve` | Approve → runs the Visa SLA engine. |
| POST | `/travel/trips/:id/expense-push` | Push actuals to Concur (mock). |
| POST | `/travel/trips/:id/itineraries` | Add an itinerary. |
| POST | `/travel/flights/search` | Amadeus search (mock). |
| POST | `/travel/itineraries/:id/flights\|hotels\|cars` | Add bookings. |
| POST | `/travel/itineraries/:id/commit` | **Commit** → PurchaseOrder (encumbrance). |
| POST | `/travel/itineraries/:id/post` | **Post** → ProjectTransaction (actual, period-locked). |
| GET | `/travel/visas?status=` | Trip-driven visa applications. |
| PATCH | `/travel/visas/:id` | Update a visa application. |

---

## 4. The Travel Identity dossier (UI)

`TravelIdentityPanel` (opened from Talent, Crew, or Travelers) shows, top to
bottom: a **Travel Readiness** widget (passport · visa · flight · hotel · transfer
→ a 0–100% score with status chips and red validation flags); **photos** (headshot
/ passport-style / additional ID); **identity & passport** (editable, with the
four passport uploads and auto validation badges); **visas & permits** (standing
`TravelerVisa` records); **documents repository** (typed uploads); **accompanying
persons** (clickable full sub-identities); and **meet & greet / arrival**. Header
actions: **Plan travel** (creates a trip from the identity — the "will travel?"
one-click) and **Arrival sheet** (printable Arrival Photo Sheet — talent +
companions with photo/name/relationship/flight, for drivers and airport reps).

### Validation flags
Computed from the passport: `PASSPORT_MISSING`, `PASSPORT_EXPIRED`,
`PASSPORT_UNDER_6_MONTHS`.

### Readiness scoring
Each of passport / visa / flight / hotel / airport-transfer is OK or not; the
score is the percentage of OK items.

---

## 5. Visa SLA engine

On trip approval, `runVisaSlaEngine` resolves **nationality × destination** and,
if a visa is required, auto-creates a `VisaApplication` with the route's processing
window and a document checklist:

| Destination | Visa type | SLA (days) | Exempt |
|-------------|-----------|------------|--------|
| United States | US O-1 | 90 | US |
| United Kingdom | UK Creative Worker | 21 | GB, IE |
| Schengen members | Schengen C | 15 | EU/EEA |
| United Arab Emirates | UAE Employment | 15 | GCC |
| India | India Business e-Visa | 10 | IN |

The same rules are mirrored client-side (`lib/visa-rules.ts`) so the **Visa
Requirement Auto-Window** in the Request-Trip form demands the right document
uploads (passport, photo, LOA, USCIS petition, certificate of sponsorship,
medical, etc.) before a trip can be submitted.

---

## 6. Two-Ledger & the House project

- **Commit** an itinerary → a `PurchaseOrder` (`TRV-…`) — the commitment.
- **Post** an itinerary → a `ProjectTransaction` (kind `COST`, category Travel),
  through `LedgerService` so the **period lock** (`assertOpen`) applies.
- **Standalone** trips (no project) resolve the single **House / Corporate**
  project (`ProductionProject.isHouse`) and post as `CORPORATE_OVERHEAD`. Seed it
  with `node prisma/seed-house-project.js`.

Amadeus (flights) and Concur (expenses) are mock integrations gated by env keys.

---

## 7. Smart connect (no duplicate entry)

| From | Action | Result |
|------|--------|--------|
| Talent (`/casting/talent`) | **Travel** button | `POST /travel/identities/from-talent/:id` → `TravelerProfile` (TALENT) seeded from the casting profile (name, photo, nationality, DOB, consent). |
| Crew (`/production/crew`) | **Travel** button | `POST /travel/identities/from-crew/:id` → `TravelerProfile` (CREW) seeded from the directory (passport, visa, Emirates ID, photo carried into the repository). |

Both are idempotent — the link is 1:1, so re-clicking opens the existing identity.

---

## 8. Privacy & roles

Passport / visa / national-ID PII is **masked** unless the requester's role has
the **`travel_pii`** permission (configurable in **Settings → Roles & Permissions**,
the "Travel PII" column).

| Tier | Sees |
|------|------|
| `SYSTEM_ADMIN`, `PRODUCTION_MANAGER`, `TRAVEL_COORDINATOR` (default ON) | Everything — passports, visas, IDs, documents. |
| Everyone else (RESTRICTED) | Headshot + basic info + readiness only; passport/visa/ID fields return `null`, sensitive document types filtered out; the dossier shows a "Restricted view" banner. |
| `TALENT_REP` | Only the travellers linked to talent they represent (403 otherwise). |

`TRAVEL_COORDINATOR` is the dedicated travel/logistics role (production-edit +
`travel_pii`). Grant `Travel PII` to any other role in Settings to extend access
without code changes.

---

## 9. Deploy / smoke

Covered in `MODULES-TRAVEL-CONTRACTS-CASTING-DEPLOY.md` (Part 3). Prerequisites:
`prisma db push` + `generate`; `seed-house-project.js` for standalone postings.

Smoke: Crew Directory or Talent → **Travel** → dossier opens (passport carried
in) → add an accompanying person (becomes a sub-identity) → **Plan travel** creates
a trip → approve to fire the Visa SLA engine → **Arrival sheet** prints. Log in as
a non-PII role to confirm the restricted view; grant `Travel PII` in Settings to
lift it.

---

## 10. Version 2.0 cross-reference 🔶 SPEC

The **Travel Requirement Engine** (specced in **SYS-10 V2.0 §2**) adds
system-calculated fields to `TravelerProfile` (and the mirrored
`GlobalTalentProfile`): `isLocalTalent`, `homeCountry`, `homeCity`, `workRegion`,
`travelRequired`, `visaRequired`, `accommodationRequired`,
`groundTransportRequired`. They are derived by comparing the person's home
location against the project's shoot location and reusing this module's **Visa SLA
rules** (§5) — no new visa logic. The **Talent Readiness Engine** (SYS-10 V2.0 §1)
extends the readiness scoring in §4 here so that travel/visa/hotel items only count
when actually required (local hires are excluded). These are enhancements to the
existing identity — **no new traveller entities** are introduced.
