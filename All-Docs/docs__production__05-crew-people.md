# 05 — Crew, People, Locations, Scheduling & Output

Covers crew assignments & directory, deal memos, per-diem, locations, the stripboard/breakdown, call sheets, and end credits.

---

## 5.1 Crew Directory vs project crew

Two layers:
- **Crew Directory** (global `CrewMember` registry — a freelancer master with rate cards, documents, bank/IBAN, passport/visa/Emirates-ID, base country/emirate). Managed under `production/crew` pages with `CrewForm` + `DepartmentRolePicker`.
- **Project crew** (`ProductionCrew`) — a per-project booking that **links to** a `CrewMember` (`crewMemberId`). On assignment, the role and rate card are imported from the directory.

`CrewService`: `findByProject`, `create` (prefills from the linked directory member), `findAssignment`, `update`, `remove`, plus the simple production schedule days (`getSchedule`/`createScheduleDay`/`updateScheduleDay`/`deleteScheduleDay`).

### Department → Role taxonomy
A cascading **Department → Role** taxonomy (`frontend/src/lib/filmCrew.ts`, `FILM_CREW`, `rolesFor`, `tierForDepartment`) drives `DepartmentRolePicker`. `ProductionCrew.department` + `roleTitle` capture the specific job; `role` is the coarse `ProductionCrewRole` enum. The base-country dropdown (`countries.ts`) **excludes Israel**.

### Documents & conditional fields
Document attachments hang off crew fields (passport / photo / visa / Emirates ID / IBAN cert / driver licence). Driver-licence fields (`driverLicenseNumber/Expiry/DocUrl`, `productionVehicle`) appear only when the person uses a production vehicle, and conditionally by local/abroad hire. Uploaded files resolve via `assetUrl()` against the backend `/uploads`.

## 5.2 Deal memos & NDAs

`ProductionCrew.dealMemoStatus` (`NOT_SENT → SENT → SIGNED`) and `ndaStatus` (`NOT_REQUIRED → SENT → SIGNED`), with `dealMemoUrl`/`contractUrl`. A branded deal-memo PDF (`print/dealmemo/[id]`) can be generated and emailed (`production/mail/deal-memo/:assignmentId`). Managed in `CrewAssignmentsPanel`. `CrewBookings` flags availability conflicts (overlapping bookings) from assignments.

## 5.3 Per-diem

`PerDiem` (`PENDING → APPROVED → PAID`), optionally linked to an assignment.
- `create` pulls crew name/location from the assignment; `update` recomputes `total = ratePerDay × days`.
- **`generateFromSchedule(projectId)`** — generates per-diem from the Day-Out-of-Days: one entry per cast member, rate × work days, using project intl/cross-emirate defaults (`perDiemInternational`/`perDiemDomestic`).
- Policy intent: per-diem always for crew from abroad; for locals only when filming outside their home emirate — driven by location emirate × crew base emirate × shoot days.
Rendered in `PerDiemPanel`.

## 5.4 Locations

`Location` is a full binder: pin (lat/lng, Google Maps, what3words), type (INT/EXT/STUDIO/BACKLOT), status (SCOUTING/OPTION/CONFIRMED/RELEASED), emirate/area/address, owner contacts, LM/assistant, parking/basecamp/access notes, facilities JSON, nearest-hospital (safety), permit (required/status/number/expiry/doc), fee per day, and photo/document URLs.
`LocationsService`: `list/get/create/update/remove` + **`postFee(id, days)`** (→ coded ledger COST, §04.9). Locations feed call sheets (`CallSheet.locationId`) and strips (`ProductionStrip.locationId`). Rendered in `LocationsPanel`.

## 5.5 Stripboard & scheduling — `scheduling/`

`ProductionStrip` = a scene (scene no., INT/EXT, DAY/NIGHT, set, location, pages as eighths, cast, est. minutes, `shootDay` 0=unscheduled, sort order).
- `board(projectId)` — strips grouped by shoot day with location/call-time.
- `dood(projectId)` — **Day-Out-of-Days**: cast working pattern across scheduled days.
- `createStrip/updateStrip/removeStrip`, `reorder` (drag-drop day + order in a transaction), and **`autoSchedule(projectId, {pagesPerDay})`** — packs unscheduled scenes onto days grouped by set/location up to a pages/day target.
Rendered in `StripboardPanel`; PDF at `print/schedule/[projectId]`.

## 5.6 Breakdown — `breakdown/`

`BreakdownElement` tags a scene by `BreakdownCategory` (cast/props/stunts/vehicles/SFX/VFX/…) with quantity and `estCost`.
- `byStrip`, `sheet(stripId)` (printable, `print/breakdown/[stripId]`), `summary`, CRUD.
- **`pushToBudget(projectId)`** / **`budgetFromBreakdown(projectId, rateCard)`** — generate budget line items from element costs (idempotent; tagged `subTitle='Breakdown'/'Auto-Breakdown'`, `origin=AUTO_BREAKDOWN`). `budgetPreview` shows the default rate card + category counts first.
- Script import (AI) lives here too — see `08-ai-involvement.md`.

## 5.7 Call sheets — `callsheets/`

`CallSheet` (DRAFT/PUBLISHED) holds general/shooting/wrap calls, weather, location (+ map, parking, basecamp), nearest hospital, key contacts, schedule items, cast/background/crew calls, and a next-day advance schedule.
- `create` auto-seeds key contacts + crew calls from crew and pulls location/scenes from the matching schedule day; `pullFromSchedule` refreshes; `publish` releases.
Rendered in `CallSheetsPanel`; branded PDF `print/callsheet/[id]`; email via `production/mail/callsheet/:id`.

## 5.8 End credits — `credits/`

`CreditRoll` (1:1 with project): `blocks` JSON of headings + role/name lines.
- `getOrBuild` returns or builds a default roll from crew; `save` persists; `regenerate` refreshes the crew block while preserving Cast/Special-Thanks.
Rendered in `EndCreditsPanel`; PDF `print/credits/[projectId]`.

## 5.9 Documents vault — `documents/`

`ProjectDocument` (upload or cloud link: UPLOAD/GDRIVE/DROPBOX/LINK), categorised, optionally tied to an entity (`entityType/entityId`, e.g. a PO or deal memo). `DocumentsPanel` supports upload, categorise, cloud-picker import, and search.
