# SYS-07 V2.0 — Location Scouting, Recce & Scout Logistics

Status: **SPEC / ROADMAP** (build sequenced into verified slices). Extends SYS-07
(Film Scout & Location Management). Every capability below is **dual-target**: it
works for a **project** (`projectId`) and for the **master library** (no project —
spec / general scouting), following the existing dual-target ops pattern.

---

## 1. Why

Today two "location" worlds aren't joined: the **script's locations** (the computed
Location Breakdown — `ProductionStrip.location`/`locationId`) and **real-world places**
(`Location` ↔ `MasterLocation`, scouting, recces, permits). High-end practice runs a
funnel from script → candidate options → field visits → lock → shoot, with rich,
department-structured capture at each step. This spec builds that spine and the
scout-logistics around it.

Research basis (industry best practice): location scout vs. tech scout are distinct
events; the tech scout/recce happens once a location is creatively fixed and gathers the
HODs to turn ideas into plans (and can trigger script changes); the location report is a
tagged photo deck (approaches, features, sightlines, infrastructure, problems, sun-path,
power, holding) evaluated before the in-person tech scout. Sources: No Film School (Tech
Scout), StudioBinder (Location Scout checklist), Wikipedia (Location scouting), Cadrage,
filmlocal.

---

## 2. Lifecycle (gates, not a fixed sequence)

```
RECON → PRELIMINARY (creative) scout → OPTIONS review → LOCK
      → TECH RECCE (HODs) → PERMIT/PREP → SHOOT-READY → WRAP/RESTORE
```

- **Recon / desk sourcing** — LM gathers candidates against each Need's brief.
- **Preliminary (creative) scout** — small party (LM + Director + Producer, sometimes the
  Writer). Judges the place artistically; may raise **scene-change requests**.
- **Options review / lock** — director / PD / producer compare photo reports remotely; pick.
- **Tech recce** — HOD party (1st AD, DoP, gaffer, grip, sound, SFX, stunts, PD/art,
  transport, safety). Usually after creative-lock, ~1 week pre-shoot; can also occur
  before lock. **Order is not enforced — visits gate on stage, not sequence.**
- **Permit/prep → shoot-ready → wrap/restore** — existing permit/risk/payment flow +
  before/after condition report.

Maps onto the existing `Location.pipelineStage` (`LocationStage`), extended as needed.

---

## 3. The connecting spine: Need → Options → Lock

- **LocationNeed** (dual-target) — one per distinct script location, seeded/synced from the
  breakdown; persisted so it can carry a brief, mood-board/visual refs, required-by date,
  status. Knows its scenes/days/pages/cast/elements from the breakdown computation.
  - `projectId?`, `name`, `intExt`, `sceneRefs`, `brief`, `visualRefs Json`, `requiredBy`,
    `status`, `selectedOptionId?`.
- **LocationNeedOption** — join `LocationNeed ↔ Location` (candidate). `optionStatus`
  (PROPOSED / SCOUTING / RECCED / SHORTLISTED / APPROVED / REJECTED), `rank`, `notes`,
  `isSelected`. Many options per need → "multiple options per scene."
- **Lock** — selecting an option writes `ProductionStrip.locationId` for the need's scenes,
  so call sheets / per-diem geography / transport flow from the chosen place.
- A **copy of the Location Breakdown** lives in the project Locations tab: each Need row
  (scenes/days/IE from the existing `locationBreakdown`) expands to an **Options** panel.

---

## 4. Scout Visit (the field-event + scout call sheet)

One object generalizes today's per-location `TechRecce` into a multi-stop day.

- **ScoutVisit** (dual-target) — `type` (RECON / PRELIMINARY / TECH_RECCE), `date`,
  `purpose`, `status`; **stops** (Needs / candidate Locations); links a **party**, a
  **clearance pack**, and a **transport request**. Printable/sendable = the scout call sheet.
- **ScoutVisitStop** — visit ↔ Need/Location, order (route), per-stop arrival window.
- **ScoutVisitMember** (party) — crew/users assigned to scout; pulls identity docs.
- A stop can spawn/attach a **TechRecce** record (per-location result).

### 4a. Scout party + clearance pack (send IDs ahead)
- Assign scout team from the film crew → party list.
- **Clearance pack** compiles the party's IDs (passport, Emirates ID, photo) into a
  **time-limited shareable link** (preferred for PII) **or** a downloadable PDF/zip, to send
  to the venue's management/security ahead of the visit. Reuses crew doc vault + pack
  generator + share/email.
- **PII controls (mandatory):** per-crew **consent flag** ("OK to share ID with venues"),
  link expiry, and an **audit trail** of what was shared with whom. Mirrors Travel-Identity
  privacy model.

### 4b. Transport alignment
- Party headcount auto-sizes a **transport request** → Transport module (`TransportOrder` +
  passengers); **notify the transport team**; appears on the daily movement board. Visit
  screen shows transport status; party-size change flags re-sizing. Implemented as a
  *request* the transport team accepts (cleaner audit) rather than a silent order.

---

## 5. Department-structured capture (the recce core)

Upgrade `RecceNote` to be department-structured so each HOD records concerns that roll up
into one report and feed the readiness gate + call sheet.

- **RecceNote**: `department` (DIRECTOR / FIRST_AD / DOP / GAFFER / GRIP / SOUND / SFX /
  STUNTS / ART_PD / COSTUME_MAKEUP / PRODUCER / LM / TRANSPORT / SAFETY / OTHER),
  `note`, `severity`, `actionItem`, `resolved`, photos[].
- Typical concerns per department captured as a checklist (light direction & sun-path,
  power vs generator + genny placement, sound/ambient, rig points, hazards & clearances,
  set dressing/restore, holding/parking/access, nearest hospital, truck count…).

---

## 6. Location Report & photo plates

- **PhotoPlate** (per Location/visit) — `url`, `purpose` (APPROACH / WIDE / FEATURE /
  SIGHTLINE / INFRASTRUCTURE / PROBLEM / AMBIENT), `timeOfDay`, `sceneRef?`/`shotRef?`,
  `caption`, `department?`, `lat/lng?`.
- **Location Report** — the richer, tagged Location Pack: plates by purpose, sun-path/light,
  power plan, parking/holding/access, sketches/floor plans. Versioned; a comparison deck
  across a Need's options for **director sign-off** (reuse share/email).
- **Lookbook / storyboard reference** — plates tagged to scenes/shots become a reusable
  previs asset: export a location lookbook; storyboard/shot-list can reference a location's
  plates as the drawing background. (Storyboard module is downstream — this just exposes
  the tagged plates + an API for it.)

---

## 7. Sun-path / light window

Per location + shoot date, compute sunrise/sunset/golden-hour and sun azimuth/elevation
(date + lat/lng → solar position, no external dep). Surfaces on the recce + as a
**scheduling input** so EXT scenes land in the right light window.

---

## 8. Script feedback loop

- **SceneChangeRequest** — raised from a PRELIMINARY/TECH_RECCE note against specific
  `ProductionStrip`s ("rewrite to fit the venue"); routed to writer/script dept, tracked to
  resolution, reflected back in the breakdown.

---

## 9. Cross-module integration

- **Crew** — scout party + identity docs (clearance pack).
- **Transport** — request by headcount, movement board, notify.
- **Share / Email** — clearance pack out, option shortlist sign-off, scout call sheet.
- **Schedule / DOOD** — locked location's availability window + permit lead-time **gate**
  shoot days; sun-path feeds time-of-day scheduling; distance matrix between consecutive
  locations → company-move time.
- **Call sheets** — locked location autofills address, parking, basecamp, nearest hospital,
  what3words, access.
- **Budget** — option `estFeePerDay` comparison pre-lock; locked fee + genny/permit costs
  post to the budget line (existing `LocationPayment` + ledger).
- **Risk / HSE** — recce hazards → existing `LocationRisk` register.
- **Readiness board** — per-Need state: # options · scouted · recced · permitted · locked ·
  shoot-ready (mirrors talent-readiness).

---

## 10. Dual-target rules

- Every new entity carries `projectId String?` **and** can attach to `masterLocationId` /
  library scope. Standalone Locations module gets the same Scout Visit + party + clearance
  pack + transport, plus "available options" = available crew + available fleet
  (vehicles/drivers) + nearby master-library candidates.
- Project lock writes `ProductionStrip.locationId`; master-only visits never touch a project.

---

## 11. High-end extras to keep on the radar

Cover sets / weather contingencies per Need; company-move time from a distance matrix;
ambient-noise/sound report; before/after **condition (dilapidations) report** tied to the
deposit/`LocationPayment`; insurance certificate + permit lead-time per location; local
crew/vendor directory by region; versioned reports.

---

## 12. Sliced build roadmap (each slice = schema + backend + UI, verified + committed)

> Prerequisite: the current uncommitted batch is type-checked (backend + frontend) and
> committed, so this epic lands on a green base.

- **S1 — Needs spine.** `LocationNeed` + `LocationNeedOption`; sync from breakdown; Options
  panel + Lock (writes `strip.locationId`) in the project Locations tab. Dual-target stubs.
- **S2 — Scout Visit + party.** [DONE] `ScoutVisit` / `ScoutVisitStop` / `ScoutVisitMember`;
  multi-stop route editor, party picker (pulls from project crew, lead flag), printable
  scout call-sheet; headcount endpoint (transport hook); dual-target (projectId null = master).
  Surfaced as the "Scout visits" inner tab on the project Locations tab.
- **S3 — Clearance pack.** [DONE] Crew `idShareConsent` flag + ID-doc fields (passport /
  Emirates ID / photo). `ClearancePack` / `ClearancePackMember` (consent-gated doc snapshot) /
  `ClearancePackAccess` (audit). Builder pulls a scout visit's party, includes only consenting
  members, sets a link expiry; share emails the secure link only (never PII inline); printable
  pack; revoke; refresh-consent. Public `/clearance/[token]` page resolves the time-limited link
  (logs a VIEWED access, blocks expired/revoked). "Clearance packs" inner tab on Locations.
- **S4 — Transport request.** [DONE] `ScoutVisit.transportOrderId` link. Visit party headcount
  raises a REQUESTED `TransportOrder` (CREW_SHUTTLE; party in `passengerNote`; from = meeting
  point; scheduled = visit date) — the request the transport team accepts on their movement
  board (cleaner audit than a silent order). Visit card shows status + assigned vehicle/driver,
  flags re-size when the party changes, and can cancel. Re-requesting re-sizes the live order.
- **S5 — Department recce notes.** [DONE] `RecceNote` extended (note, severity INFO→BLOCKER,
  actionItem, resolved, checklist Json) — additive, legacy free-text fields kept. HOD taxonomy
  (Director/1stAD/DoP/Gaffer/Grip/Sound/SFX/Stunts/Art-PD/Costume-Makeup/Producer/LM/Transport/
  Safety…). Per-department concern checklists. `recceRollup(locationId)` groups notes by dept +
  severity tally + open action items + blockers → READY/OUTSTANDING/BLOCKED readiness (feeds S8).
  Assess modal RecceCard gains severity/checklist/action-item/resolve; readiness rollup strip.
- **S6 — Photo plates + Location Report v2.** [DONE] `PhotoPlate` (purpose APPROACH/WIDE/
  FEATURE/SIGHTLINE/INFRASTRUCTURE/PROBLEM/AMBIENT/REFERENCE, scene/shot refs, timeOfDay,
  dept, lat/lng; plain-FK, dual-target) + `LocationNeed` sign-off fields. location-reports
  service/controller: plate CRUD + image upload (multer), `report(locationId)` (plates-by-purpose
  + recce blockers/actions + logistics + permits/risks), `lookbook`/`storyboard` (scene-tagged
  plates), `compareNeed` (ranked options deck w/ thumbnails+scores+blockers), `signOffNeed`.
  Frontend: "Report & plates" tab (upload, tag, printable Report, Lookbook export) + option
  comparison & director sign-off on each Need in the Breakdown & options tab.
- **S7 — Sun-path + schedule gating + call-sheet autofill.** [DONE] `SunPathService` — pure
  NOAA solar math (no dep): sunrise/sunset/solar-noon/civil-twilight/golden-hour + day length +
  sun az/elev at any time, local HH:MM via tz offset (default +240 Asia/Dubai). Endpoints:
  by lat/lng, position, by Location, and `gating/:locationId` (availability window + permit
  validity + sun window → cleared/gated). CallSheet `goldenHourAm/Pm` fields + `autofillDaylight`
  (writes sunrise/sunset/golden from the linked location + shoot date). Frontend: sun-path &
  gating strip on Report & plates tab; "Autofill daylight" button + golden-hour fields on the call sheet.
- **S8 — Scene-change requests** (script loop) + readiness board. [DONE] `SceneChangeRequest`
  (plain-FK to location/need/visit/recceNote; sceneRefs; priority; OPEN→RESOLVED/REJECTED with
  resolution). `script-readiness` service/controller: request CRUD + `readinessBoard(projectId)`
  that fuses each location's recce blockers/actions (S5) + Need sign-off (S6) + permit/availability
  gating (S7) + open scene-changes into READY/OUTSTANDING/BLOCKED. Frontend: "Readiness" inner tab
  — producer board (DataTable) + scene-change raise/track/resolve.
- **S9 — Master-module parity polish** (standalone Scout Visit, available crew/fleet). [DONE]
  `scout-visits/master-options` = crew directory + available house vehicles/drivers + master-library
  candidates. `MasterScoutVisitsPanel` + standalone `/locations/scout-visits` page (sidebar link):
  project-less scout visits (route from library candidates as labelled stops, party from the crew
  directory, per-visit clearance-pack build, available-options feed). ScoutVisit/Clearance/Transport
  were already dual-target (`projectId` null = master), so master visits never touch a project.

Each slice: `prisma db push` + `generate` + `tsc` (both ends) + smoke + commit before the next.

---

Sources: No Film School — Tech Scout; StudioBinder — Location Scout checklist; Wikipedia —
Location scouting; Cadrage; filmlocal — Master Location Scouting.
