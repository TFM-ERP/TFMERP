# SYS-10 — Casting & Recruitment

The Casting module manages the full talent lifecycle: a master talent database,
project (or standalone) casting calls derived from the script breakdown, a public
application portal with GDPR consent, audition scheduling, and an automated
hand-off that turns a selected candidate into a draft Deal Memo wired to the
budget's union fringes.

It is **dual-target**, exactly like Locations: it runs as a standalone business
module (talent-agency style) and per-project inside a production.

---

## 1. Where it lives

| Surface | Route | Purpose |
|---------|-------|---------|
| Master dashboard | `/casting` | Cross-project rollup (calls by status, open calls, recent submissions) + **All / Standalone** toggle; "New standalone call". |
| Talent Database | `/casting/talent` | The master talent pool — searchable, GDPR-consented, reusable across every call. Add/Edit talent, right-to-be-forgotten, open Travel identity. |
| Per-project panel | Project workspace → **Engagements → Casting** | Calls + submissions for that project only, "Generate from breakdown", Select → Deal Memo. |
| Public talent portal | `/apply/<castingCallId>` | No-login application page for actors, with the mandatory GDPR consent window. |

The per-project view is the component `components/production/CastingPanel.tsx`
(scoped to one `projectId`, no project picker). The master dashboard is
`app/(dashboard)/casting/page.tsx`.

---

## 2. Data model

All models live in `backend/prisma/schema.prisma`.

### Master level

**`GlobalTalentProfile`** — the reusable person record.
Key fields: `fullName`, `stageName`, `status` (`ACTIVE` / `ARCHIVED` /
`DO_NOT_CONTACT`), contact, `gender`, `ethnicity`, `nationality`, `baseCity`,
`languages[]`, `skills[]`, `heightCm`, `physical` (Json), `headshotUrls[]`,
`reelUrls[]`, `resumeUrl`, `unions[]`, `unionStatus`, agency fields, PII
(`dateOfBirth`, `isMinor`, guardian), and GDPR fields (`consentStatus`,
`consentGivenAt`, `consentExpiresAt`, `gdprConsentVersion`, `lawfulBasis`,
`dataRetentionUntil`, `erasureRequestedAt`).

Cross-module links added later:

- `laborBodyId` → `LaborBody` — the performer union/guild (SAG-AFTRA, ACTRA,
  Equity). Drives fringes when cast (see §7).
- `representedById` → `User` — the talent's agent/manager (a `TALENT_REP`).
- `travelIdentity` → `TravelerProfile` (1:1) — the person's Travel Identity.

### Project level

**`CastingCall`** — a role to cast.
Links: `projectId` → `ProductionProject` (nullable → **standalone** call), and
`breakdownElementId` → `BreakdownElement` (the character from the script
breakdown). Spec fields: `roleName`, `roleType` (`CastingRoleType`),
`characterDescription`, `status` (`CastingCallStatus`), `ageMin/Max`, `gender`,
`ethnicity`, `languages[]`, `specialSkills[]`, `unionRequirement`,
`rateMin/Max` + `currency`, `slotsToFill`, `deadline`, `isPublic`.

**`Submission`** — a talent applied to a call. `@@unique([castingCallId, talentId])`
prevents duplicates. Fields: `status` (`SubmissionStatus`), `source`
(`SubmissionSource`), `coverNote`, `proposedRate`, `availabilityNote`, review
fields (`rank`, `score`, `reviewedById`, `decisionNote`).

**`Audition`** — scheduled audition for a submission. `type` (`AuditionType`),
`status` (`AuditionStatus`), `scheduledAt`, `durationMins`, `location`,
`virtualLink`, `selfTapeUrl`, `recordingUrl`, `sides`, `score`,
`ratingBreakdown` (Json), `panelNotes`, `decision`.

**`ConsentLog`** — append-only GDPR/CCPA audit per talent. `type` (`ConsentType`:
`DATA_PROCESSING`, `IMAGE_LIKENESS`, `MINOR_GUARDIAN`, `BACKGROUND_CHECK`,
`MARKETING`), `status` (`ConsentStatus`), `method`, `documentUrl`, `ipAddress`,
`lawfulBasis`, `version`, optional `projectId`, `grantedAt` / `withdrawnAt` /
`expiresAt`.

### Enums

`TalentStatus`, `CastingRoleType` (LEAD/SUPPORTING/FEATURED/DAY_PLAYER/
BACKGROUND/STUNT/VOICE/STAND_IN/OTHER), `CastingCallStatus` (DRAFT/OPEN/
IN_REVIEW/SHORTLISTED/CALLBACKS/OFFER/CAST/CLOSED/CANCELLED), `SubmissionStatus`
(SUBMITTED/UNDER_REVIEW/SHORTLISTED/CALLBACK/OFFERED/CONFIRMED/DECLINED/
WITHDRAWN), `SubmissionSource` (SELF/AGENT/SCOUTED/IMPORTED), `AuditionType`,
`AuditionStatus`, `ConsentType`, `ConsentStatus`.

---

## 3. Backend API

Service: `backend/src/production/casting/casting.service.ts`.
Controllers: `casting.controller.ts` (`CastingController` guarded;
`CastingPublicController` unguarded).

### Authenticated (`/casting`, requires `production` access)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/casting/dashboard` | Cross-project rollup. |
| GET | `/casting/unions` | Performer unions (LaborBodies with a `PERFORMER` classification). |
| GET | `/casting/talent?search=&status=` | List talent (rep-filtered, see §6). |
| GET | `/casting/talent/:id` | Talent detail. |
| POST | `/casting/talent` | Create talent. |
| PUT | `/casting/talent/:id` | Update talent (union, rep, consent, etc.). |
| POST | `/casting/talent/:id/withdraw-consent` | Right-to-be-forgotten. |
| GET | `/casting/calls?projectId=&scope=` | List calls (`scope=standalone` or all). |
| GET | `/casting/calls/:id` | Call + submissions + talent + auditions. |
| POST | `/casting/calls` | Create a call (project or standalone). |
| POST | `/casting/calls/from-breakdown` | Generate calls from castable breakdown elements. |
| PUT | `/casting/calls/:id` | Update a call. |
| PATCH | `/casting/calls/:id/status` | Set call status. |
| GET | `/casting/calls/:id/submissions` | Submissions for a call. |
| PATCH | `/casting/submissions/:id/review` | Set status/score/rank/notes. |
| POST | `/casting/submissions/:id/select` | **Selection hand-off → Deal Memo**. |
| POST | `/casting/submissions/:id/auditions` | Schedule an audition. |
| PUT | `/casting/auditions/:id` | Update an audition. |

### Public (`/casting/public`, no auth — consent enforced in the service)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/casting/public/calls/:id` | Open call details for the apply page. |
| POST | `/casting/public/submit` | Actor submits a profile (requires consent). |

---

## 4. Key workflows

### Calls from the script breakdown
`createCallsFromBreakdown({ projectId | breakdownElementIds })` sweeps the
project's castable `BreakdownElement`s — categories `CAST` → SUPPORTING,
`BACKGROUND` → BACKGROUND, `STUNTS` → STUNT — and creates a `CastingCall` per
element, linked back via `breakdownElementId`. Idempotent: elements that already
have a call are skipped.

### Public application + GDPR Auto-Window
The actor opens `/apply/<callId>`. The page (`app/apply/[callId]/page.tsx`) loads
the role via `GET /casting/public/calls/:id`, shows the spec + an application
form (incl. the **Union/Guild dropdown** sourced from `/casting/unions`), then a
**mandatory consent modal** — data-processing (required), image/likeness,
right-to-be-forgotten acknowledgement, and guardian consent for minors. Submit is
blocked until the required boxes are ticked. `submitProfile()` creates/updates
the `GlobalTalentProfile`, stamps consent on the profile, writes append-only
`ConsentLog` rows (with IP), and upserts the `Submission`.

> **Known gap:** there is currently **no "Copy apply link / Share" button** in the
> UI, and breakdown-generated calls default to `DRAFT` / not public. To use the
> portal today you must construct `<origin>/apply/<callId>` manually. Recommended
> follow-up: a Share button (copy link + QR) and an "Open to public" toggle that
> sets `status = OPEN` / `isPublic = true`.

### Review & auditions
`reviewSubmission` sets status/score/rank. `scheduleAudition` books an audition;
the **master ATS dashboard** (`/casting`, the drag-and-drop calendar grid) lets a
casting director drag a submission onto a time slot to create a 30-minute
in-person audition.

### Selection hand-off → Deal Memo (§7 fringe)
`selectCandidate(submissionId)`:
1. Marks the submission `OFFERED`, moves the call to `OFFER`.
2. Resolves an active `DEAL_MEMO` `ContractTemplate`.
3. Calls `ContractsService.generateFromTemplate()` with the talent's name/email/
   role/rate → produces a **draft Deal Memo** (a `ProjectContract`). For a
   standalone call the contract is standalone and posts to the House/Corporate
   ledger on signature.

Returns a note if no deal-memo template is configured (`seed-deal-memo-template.js`).

---

## 5. Frontend components

- `app/(dashboard)/casting/page.tsx` — master dashboard (stats, open calls,
  recent submissions, scope toggle, new standalone call, expandable submissions).
- `app/(dashboard)/casting/talent/page.tsx` — Talent Database (search, add/edit
  modal with Union + Represented-by + consent, right-to-be-forgotten, **Travel**
  button → opens the Travel Identity).
- `components/production/CastingPanel.tsx` — per-project panel (Engagements tab):
  calls list, Generate-from-breakdown, expandable `CallSubmissions`, Select.
- `app/apply/[callId]/page.tsx` — public portal + GDPR Auto-Window.

---

## 6. Privacy & roles

- **Talent representatives** (`TALENT_REP` role): a rep sees **only** the talent
  whose `representedById` is their user id. Enforced server-side on
  `listTalent` / `getTalent` (others return 403). Assign a rep via the talent's
  **Represented by (agent)** field.
- **Consent & erasure**: consent is mandatory at submission and recorded as an
  append-only `ConsentLog`; `withdrawConsent` flips the profile to
  `DO_NOT_CONTACT` + sets `erasureRequestedAt`.

---

## 7. Integrations

- **Contracts** — selection → `DEAL_MEMO` draft (`ProjectContract`). Full
  signature auto-generates a `PurchaseOrder` (Two-Ledger commitment).
- **Labor & Fringe** — talent's `laborBodyId` (performer union). When a cast
  performer is linked to a **budget line** (`BudgetLineItem.castTalentId`), the
  backend auto-sets the line's `classificationCode = 'PERFORMER'`; the fringe
  engine then posts that union's Pension & Health against the project's frozen
  rate snapshot. (All three performer unions share the code `PERFORMER`.)
- **Travel Identity** — the **Travel** button on a talent calls
  `POST /travel/identities/from-talent/:id`, creating the person's shared
  `TravelerProfile` from their casting record (see SYS-11).

---

## 8. Deploy / smoke

Casting models ship with the modules in `MODULES-TRAVEL-CONTRACTS-CASTING-DEPLOY.md`.
Prerequisites: `prisma db push` + `generate`, and a seeded `DEAL_MEMO` template
(`node prisma/seed-deal-memo-template.js`) for the selection hand-off.

Smoke: Casting → *From breakdown* generates calls → share `/apply/<id>` → an actor
submits with consent → submission appears under the call → *Select → Deal Memo*
drafts a contract.

---

# SYS-10 Casting & Recruitment — Version 2.0 Enhancements 🔶 SPEC

> **Architecture rule (non-negotiable):** maintain all existing models, routes,
> workflows and integrations. Add new entities **only** where no existing entity
> satisfies the requirement. Everything below either (a) adds a genuinely new
> model, (b) adds fields to an existing model, or (c) is a computed view / service
> over existing data — never a duplicate.

## V2.0 entity inventory — new vs reused

| Enhancement | Verdict | Implementation |
|-------------|---------|----------------|
| Talent Readiness Engine | **Computed** | A service + computed `TalentReadiness` view. No table (optional cache only). Extends the existing `TravelerProfile.readiness`. |
| Travel Requirement Engine | **Fields + service** | New **calculated** fields on `GlobalTalentProfile` and `TravelerProfile`. No new entity. |
| Talent Operations Hub | **View/aggregation** | A coordinator screen + aggregation service over existing entities. No new core model. |
| Character Profile | **New model** | `CharacterProfile` inserted between `BreakdownElement` and `CastingCall`. |
| Producer Review Board | **View + small field** | Role-centric UI over `Submission` + `Audition`; adds a `boardVerdict` enum to `Submission`. |
| Talent Performance Review | **New model** | `TalentPerformanceReview` (post-wrap, internal-only). |
| Negotiation Management | **New model** | `TalentNegotiation` between Offer and Deal Memo. |

New models total: **3** (`CharacterProfile`, `TalentNegotiation`,
`TalentPerformanceReview`). Everything else reuses or extends.

---

## 1. Talent Readiness Engine (computed)

A single dynamic readiness score per talent **per project**, computed from data
that already exists — not a new store. Categories:

- **Casting** — profile complete, headshots present, resume present, reel present
  (from `GlobalTalentProfile`).
- **Contracts** — deal memo signed, long-form signed (from `ProjectContract`
  status by `ContractType`).
- **Travel** — travel / passport / visa / flight / hotel required **and** present
  (from the Travel Requirement Engine §2 + `TravelerProfile` / `TravelerVisa` /
  `TravelerDocument` / `Trip` bookings).
- **Production** — wardrobe complete, makeup notes complete, publicity complete
  (from §3 prep fields).
- **Payroll** — bank info complete, tax info complete (from `CrewMember`/payroll
  fields).

**Smart logic:** a category item only counts toward readiness if it is *required*.
The Travel Requirement Engine decides that — local talent's travel/visa/hotel
items are marked **not required** and excluded from the score, so coordinators
stop chasing travel documents from local hires. Reuses the existing
`TravelerProfile.readiness` mechanics; adds the casting/contract/production/payroll
dimensions. **No `TalentReadiness` table is required** (compute on read; cache if
performance demands).

## 2. Travel Requirement Engine (calculated fields)

Add to **both** `GlobalTalentProfile` and `TravelerProfile` (kept in sync via the
existing talent↔identity link):

```
isLocalTalent          Boolean
homeCountry            String?
homeCity              String?
workRegion            String?   // shoot region for this engagement
travelRequired        Boolean
visaRequired          Boolean
accommodationRequired Boolean
groundTransportRequired Boolean
```

These are **system-calculated**, not manually entered. The engine compares the
person's home location against the project's shoot location
(`ProductionProject.productionCountry` / city), and derives `visaRequired` by
running the **existing** Visa SLA rules (`lib/visa-rules.ts` /
`travel.service.runVisaSlaEngine`) for nationality × destination. Example: Abu
Dhabi talent + Abu Dhabi shoot → all flags `NO`; London talent + Abu Dhabi shoot →
travel/passport/visa/hotel `YES`. Reuses the Visa engine and the Travel module —
no duplicate logic.

## 3. Talent Operations Hub (coordinator screen)

New section **Casting → Talent Operations**, visible once a `Submission` reaches
`OFFERED` or `CONFIRMED`. One screen that bridges Casting, Contracts, Travel,
Scheduling, Payroll, Wardrobe and Production via a live checklist:

| Group | Source (reused) |
|-------|------------------|
| Contract — Deal Memo / Long-Form / NDA | `ProjectContract` by `ContractType` (no new contract model) |
| Travel — Passport / Visa / Flight / Hotel / Arrival | `TravelerProfile` + `TravelerVisa` + `TravelerDocument` + `Trip`/`Itinerary` bookings + `TravelArrival` |
| Production — Wardrobe / Measurements / Fittings / Makeup notes | new prep fields (§ below) |
| Payroll — Tax docs / Banking / Vendor setup | `CrewMember` banking + payroll fields |

Travel rows are hidden when the Travel Requirement Engine marks them not required.
The **only** potentially new storage here is production prep (wardrobe/makeup) —
prefer adding light fields to the talent/operations record or a small
`TalentProductionPrep` sub-entity *only if* fields don't suffice. Everything else
is aggregation over existing entities.

## 4. Character Profile (new model)

Insert a `CharacterProfile` between the script breakdown and the call:

```
BreakdownElement → CharacterProfile → CastingCall
```

Stores creative (backstory, arc, relationships), production (shoot days,
locations, dialogue pages, stunt days) and casting (requirements, previous
submissions, previous castings). `CharacterProfile.breakdownElementId` →
`BreakdownElement`; `CastingCall.characterProfileId` → `CharacterProfile`
(`from-breakdown` generates the profile + call together). Reuses both existing
entities; adds one model.

## 5. Producer Review Studio — Casting Review Board

A role-centric review UI for producers/directors over the **existing**
`Submission` + `Audition` — not a new pipeline. Layout: Role → Candidates; each
card shows headshot, reel, audition, availability, rate, agent (`representedBy`),
notes. Actions — **Approve / Maybe / Pass / Request Callback / Request Chemistry
Read** — map to `Submission.status` plus a small `boardVerdict` enum on
`Submission` (the only schema add). Faster than reviewing submissions one by one.

## 6. Talent Intelligence Database — `TalentPerformanceReview` (new model)

Post-wrap, internal-only department ratings (production: punctuality; director:
performance; AD: professionalism; wardrobe: cooperation; makeup: preparedness).
Links `GlobalTalentProfile` + `ProductionProject` + rater/department. Aggregated
over time into per-talent scores (e.g. Professionalism 9.2 across 8 productions).
**Never visible to talent** — gated by role (producers/admin), reusing the
existing permission model. New model; reuses talent + project.

## 7. Negotiation Management — `TalentNegotiation` (new model)

Sits between the Offer (`Submission` `OFFERED`) and the Deal Memo
(`ProjectContract`). Tracks the full history — financial (initial / counter /
final rate), travel class, accommodation tier, per diem, buyout, exclusivity,
marketing requirements. On agreement it feeds the **existing**
`ContractsService.generateFromTemplate()` with the negotiated final rate, so the
Deal Memo hand-off (§4 of the base doc) is unchanged — just fed better data. New
model; reuses `Submission` + `ContractsService`.

---

## V2.0 new services

- **Travel Requirement Engine** — computes the requirement flags (reuses Visa SLA).
- **Talent Readiness Engine** — computes readiness across casting/contracts/
  travel/production/payroll, gated by requirement flags.
- **Producer Review Board** — verdict/review actions over `Submission`/`Audition`.
- **Talent Operations Hub** — cross-module aggregation for the coordinator screen.

## Integration guardrails (prevent duplicates)

| Need | Use the existing… |
|------|-------------------|
| Deal Memo / Long-Form / NDA | `ProjectContract` + `ContractType` (don't add contract models) |
| Passport / visa / flight / hotel / arrival | `TravelerProfile` / `TravelerVisa` / `TravelerDocument` / `Trip` / `Itinerary` / `TravelArrival` |
| Union / fringe | `laborBodyId` + `PERFORMER` classification (SYS-11 §8, this doc §7 base) |
| Agent | `GlobalTalentProfile.representedById` |
| Final negotiated rate → contract | `ContractsService.generateFromTemplate()` |

## Suggested build order (phased: schema → backend → frontend, one slice each)

1. **V2-A — Travel Requirement Engine** (fields + compute). Foundation.
2. **V2-B — Talent Readiness Engine** (computed, requirement-gated).
3. **V2-C — Character Profile** (breakdown → profile → call).
4. **V2-D — Talent Negotiation** (offer → deal memo).
5. **V2-E — Talent Operations Hub** (coordinator screen).
6. **V2-F — Producer Review Board**.
7. **V2-G — Talent Performance Review** (post-wrap).

Each slice keeps the existing SYS-10 / SYS-11 architecture intact and only adds the
entities/fields/services named above. Cross-reference: the Travel Requirement
fields and readiness-travel gating are mirrored in **SYS-11 §4 / §5**.

---

# SYS-10 Casting & Recruitment — Version 3.0 Talent Intelligence Platform ✅ IMPLEMENTED (A–H)

V3.0 turns the talent database into an **industry-standard talent CRM + casting
intelligence platform** (Casting Networks / Breakdown Services / Spotlight class):
a deep talent identity, relationship CRM, character assets, advanced search, a
matching engine, the full casting pipeline, and self-tape management.

**Single source of truth = `GlobalTalentProfile`.** Everything below hangs off the
*one* master record. The **master Talent Directory** (`/casting/talent`) is the full
editor; the **project level** shows the *same* profile, scoped to that project's
engagement (the project **Talent roster** already links into the dossier). Nothing
is duplicated per project — the project view is a lens on the master record + that
project's `Submission`/`CharacterProfile`/`Negotiation`/readiness.

> **Non-negotiable (as always):** reuse existing entities; add new ones only where a
> genuine gap exists. No duplicate person, character, audition, union, travel-identity
> or review entities. Historical/locked data is never mutated. No code until the
> specific **V3-x** phase prompt.

## V3.0 reconciliation — have / extend / new

| Spec area | Already in system | Action |
|-----------|-------------------|--------|
| Legal/Stage name, DOB, nationality, gender, ethnicity, languages, skills, height, headshots, reels, resume, portfolio, unions, union status, agent fields, guardian/minor, GDPR | `GlobalTalentProfile` | **reuse** |
| Preferred name, multiple nationalities, current location, dialects, accents, weight, tattoos, distinguishing features, biography, press links, talent categories[] | — | **extend** `GlobalTalentProfile` (scalar/array/JSON fields) |
| Representation (Agency/Manager/Lawyer/Publicist/Business Mgr/PA) each with contract period, commission %, contact, territory, type | flat `agentName/agentEmail/agencyName` + `representedById` | **new** child `TalentRepresentation[]` (keep flat fields as the "primary agent" mirror) |
| Contact: mobile, email | `phone`, `email` | **reuse** + **extend** `whatsapp`, `emergencyContact` (JSON) |
| Professional credits: filmography, TV, commercial, theatre, awards, festivals | — | **new** child `TalentCredit[]` (typed `creditType`) + `awards` JSON |
| Talent categories (Actor…Specialty, multi) | — | **extend** `categories String[]` |
| Interaction timeline (meeting, call, script sent, offer…) + follow-ups | — | **new** `TalentInteraction[]` (CRM timeline) |
| Relationship scoring (engagement/responsiveness/reliability/rehire) | partial inputs (`TalentPerformanceReview`, submissions, interactions) | **new** computed `relationshipScores` (no table) |
| Character: name, backstory, arc, relationships, shoot/stunt days, dialogue pages, locations, requirements | `CharacterProfile` (V2-C) | **reuse** + **extend** characterId/scriptRef/personalityNotes/visualRefs[]/nightShoots/travelDays + structured casting requirements (age range/accent/certifications) |
| Character history (submitted→cast) | derivable from `Submission` + `Audition` + `boardVerdict` | **reuse** (computed history view) |
| Advanced search (standard + advanced filters) | basic `listTalent(search,status)` | **extend** search service (joins travel identity, reviews, rates, history) |
| Saved searches / talent lists / shortlists | — | **new** `SavedSearch[]` + `TalentList[]` + `TalentListMember[]` |
| Matching engine (role ↔ talent, match %) | character requirements + talent attributes + readiness | **new** computed matching service (no table) |
| Expanded pipeline (Draft…Archived, ~25 stages) | `SubmissionStatus` (8) + `CastingCallStatus` + `BoardVerdict` | **extend** `SubmissionStatus` enum + per-stage automation hooks |
| Self-tape: audition package (sides/NDA/brief/mood board/refs), submission (video/slate), auto-validation | `Audition` (`SELF_TAPE`/`IN_PERSON`) | **extend** `Audition` + **new** `AuditionPackage` + `SelfTapeSubmission`; **honours the standing "no video upload for now" rule** — store links/metadata + validation flags, not hosted video |

## V3.0 new entities (the only additions)

| Entity | Purpose |
|--------|---------|
| `TalentRepresentation` | A rep relationship on a talent: `repType` (AGENCY/MANAGER/LAWYER/PUBLICIST/BUSINESS_MANAGER/ASSISTANT), name, contact, `commissionPct`, `territory`, `contractStart/End`, `isPrimary`. |
| `TalentCredit` | A filmography line: `creditType` (FILM/TV/COMMERCIAL/THEATRE), title, role, year, production co., director, link. |
| `TalentInteraction` | CRM timeline event: `type`, date, `userId`, notes, `attachments[]`, `followUpDate`, optional `projectId`/`castingCallId`. |
| `SavedSearch` | A reusable search template: name, `filters` JSON, owner. |
| `TalentList` + `TalentListMember` | Curated lists / shortlists of talent (cross-project). |
| `AuditionPackage` | The brief sent for an audition: links a `CastingCall`/`CharacterProfile`; sides, NDA, character brief, mood boards, reference links, production notes. |
| `SelfTapeSubmission` | A talent's self-tape response: `videoUrl` (external link), slate, materials[], plus auto-validation flags (format/resolution/duration/deadline) — **metadata only, no hosting**. |

New enums: `RepresentationType`, `CreditType`, `InteractionType`, `TalentCategory`,
plus **expanded** `SubmissionStatus` (Draft/Open/Public/Invited/Submitted/
UnderReview/CastingAssistant/CastingDirector/Producer/Director/Studio/Shortlisted/
Callback/ChemistryRead/Negotiation/Offer/DealMemoPending/DealMemoSigned/
TravelPending/VisaPending/Booked/OnSet/Wrapped/Archived). The existing 8 values are
preserved (mapped, never dropped) so no historical submission breaks.

## Dual-target visibility

- **Master Talent Directory** (`/casting/talent`): full profile editor — identity,
  representation, credits, CRM timeline, categories, relationship scores, project
  history, advanced search, saved searches/lists.
- **Project level** (Engagements → Casting → **Talent**): the roster already built;
  each talent opens the **same** master dossier, with project-scoped readiness,
  documents/travel, reviews, status, **matching %** for the role, and the CRM
  timeline filtered to this project. Edits write to the one master record.

## V3.0 phased build order (schema → backend → frontend, one slice each)

1. **V3-A — Deep Talent Identity** ✅: extended `GlobalTalentProfile` (preferred name,
   nationalities[], current location, dialects/accents[], weight, tattoos,
   distinguishing features, biography, press links[], `categories[]`, whatsapp,
   emergency contact) + master editor sections + project **Identity** read tab.
2. **V3-B — Representation & Credits** ✅: `TalentRepresentation[]` + `TalentCredit[]`
   + master **Profile** drawer / project tabs; primary-agent mirror keeps fringe logic intact.
3. **V3-C — Talent CRM** ✅: `TalentInteraction[]` timeline (log/follow-up) + computed
   relationship scores (engagement/responsiveness/reliability/rehire) shown master
   + project.
4. **V3-D — Character Assets** ✅: extended `CharacterProfile` (characterCode, script ref,
   personality, visual refs, scenes/night shoots/travel days, structured casting
   requirements) + computed **Character History** (submitted→auditioned→callback→
   offered→cast) on the character editor.
5. **V3-E — Advanced Search + Saved Searches/Lists** ✅: `searchTalent(filters)` over
   identity + travel (passport validity) + reviews (reliability) + representation +
   awards + age; `SavedSearch` + `TalentList`/`TalentListMember`. Master directory
   gets an **Advanced** filter panel, saved-search chips, **Add to list** and a
   Lists/Shortlists drawer.
6. **V3-F — Matching Engine** ✅: computed role↔talent match % (demographics, age,
   language/accent, skills, past ratings; weighted only over the requirements the
   character specifies) with **strengths / risks / missing** + a travel-readiness
   risk — ranked **Match engine** panel on the character editor
   (`/casting/characters/:id/matches`), plus a single-match endpoint for roster badges.
7. **V3-G — Expanded Casting Pipeline** ✅: widened `SubmissionStatus` to the full
   ~25-stage workflow (legacy 8 values preserved). Shared `pipeline.ts`
   (`SUBMISSION_PIPELINE`, `ENGAGED_STATUSES`) now drives the logistics
   "engaged talent" filters (accommodation/transport/shuttle/arrivals) so cast in
   later stages (DealMemoSigned/TravelPending/Booked/OnSet) still flow through.
   `setSubmissionStatus` fires per-stage **automations** (open negotiation; log
   OFFER_MADE / CONTRACT_SIGNED / BOOKING_CONFIRMED to the CRM timeline) and returns
   the suggested next stage. Pipeline **stage selector** on every submission.
8. **V3-H — Self-Tape Management** ✅: `AuditionPackage` (sides, NDA, character brief,
   mood boards, reference links, production notes, deadline + validation rules) +
   `SelfTapeSubmission` (video/slate **links only**, reported metadata) with
   **auto-validation** of format / resolution / duration / deadline and an
   accept/reject status. Per-call **Self-tape** drawer. Metadata-only — no video
   hosting per the standing rule.

Each slice reuses `GlobalTalentProfile`, `CharacterProfile`, `Submission`,
`Audition`, `TravelerProfile`, `TalentPerformanceReview`, `LaborBody` and the
two-ledger/fringe wiring — adding only the entities/fields named above. Phases are
independent enough to build in any order; **A → D** give the biggest immediate value
(identity + representation + CRM + character assets).
