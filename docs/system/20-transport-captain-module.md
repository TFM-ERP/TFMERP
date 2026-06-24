# SYS-12.F — Transport Captain module (production-grade)

**Why this exists.** The previous transport screens looked right but didn't *run the department*. On a real
production the Transport Coordinator/Captain manages the largest physical footprint and one of the biggest
daily spends — department trucks, trailers, honeywagons, picture cars, cast/crew rentals — off the call
sheet, in real time, against hard labour rules. This module turns that into a deterministic workflow on the
same server as the call sheets, ledger, DOOD and chat, so the busywork is automated and the classic
**2nd-AD ↔ Captain phone-tag** disappears.

Researched against: film Transportation Coordinator/Captain workflows (Coordinator → Captains → Drivers →
Picture-Car Coordinator), event/chauffeur dispatch tooling (visual drag-drop board, passenger manifests,
live tracking, geofencing, driver app, accounting sync), union turnaround rules (SAG-AFTRA/DGA/Teamsters),
and the uploaded *Mobile Interface & Telematics Architecture* (one-tap FSM, digital glovebox, adaptive
geofencing, offline outbox, turnaround lockouts).

---

## Two faces, one spine

### A. Captain console (web — the operations cockpit)
1. **Dispatch board (Kanban).** Every run is a card flowing through the FSM columns:
   **Unassigned → Dispatched → En route → Passenger on board → Completed** (+ Cancelled). Assigning a
   driver + vehicle is the core action; the board mirrors the driver app 1:1.
2. **Command map.** Live fleet (GPS), geofenced basecamp/airport pins + arrival check-ins, recce route
   overlays. (Reuses SYS-06 telemetry + the DispatchBoard component.)
3. **The Garage.** Fleet by class — **Working** (honeywagons/generators/grip+camera trucks),
   **Passenger** (cast SUVs/crew shuttles), **Picture** (on-screen cars) — plus a **rental return
   countdown** so trucks never hit late-return day rates.
4. **Crew & compliance.** Driver roster with **turnaround clocks** and a **hard HOS lockout**.
5. **Glovebox queue.** Driver-captured fuel/toll/parking receipts → OCR → 4000-series ledger approval
   (reuses the chat-receipt OCR pipeline).

### B. Driver app (mobile — distraction-free copilot)
Glanceable "Up Next" card · one-tap run lifecycle (Acknowledge → Arrived → Onboard → Complete, geofence
auto-arrive) · Panic button · constraint-aware Navigate · Digital Glovebox (receipt OCR + 4-photo condition
report → Document Vault) · passive telematics + turnaround clock · offline-first outbox.

---

## Data model (additions — `schema.prisma`)
- `TransportStatus` += **`PASSENGER_ONBOARD`** (the "in transit" FSM state).
- `TransportOrder` += lifecycle timestamps `acknowledgedAt / enRouteAt / arrivedAt / onboardAt / completedAt`,
  geofence coords `pickupLat/Lng`, `dropLat/Lng`, and dispatch context `priority` (NORMAL|VIP|URGENT),
  `callSheetId`, `genSource` (dedupe key), `chatChannelId` (auto run-thread).
- `TransportVehicle` += **`fleetClass`** (`TransportFleetClass`: WORKING|PASSENGER|PICTURE|OTHER) +
  `returnLocation`.
- `TransportDriver` += HOS fields `minRestHours` (default 10), `onDutySince`, `lastWrapAt`.
- New **`RouteOverlay`** (+ `RouteKind`: STANDARD|TRUCK_SAFE|NOISE_RESTRICTED|SCENIC|AVOID) — recce routes,
  `projectId` kept as a plain scalar to keep the migration self-contained.

All enums are multi-line; no new relations on `ProductionProject` (scalar `projectId`s only).

## API — `/logistics/captain/*` (`CaptainController` / `CaptainService`)
| Route | Purpose |
|---|---|
| `GET board?projectId&date` | Kanban columns + counts + HOS roster |
| `POST runs/:id/assign` | assign driver+vehicle — **throws if turnaround not met** (`force` to log a forced call) |
| `POST runs/:id/action` | FSM: `ACK\|ARRIVE\|ONBOARD\|COMPLETE\|CANCEL` (writes timestamps, frees vehicle, sets `lastWrapAt`, notifies) |
| `GET hos?projectId` · `POST drivers/:id/wrap` | turnaround board / end duty day |
| `POST sync-callsheet` | cast call times → auto-generate hotel-pickup runs (idempotent via `genSource`) |
| `GET garage?projectId` | fleet by class + rental return countdown (≤72h) |
| `GET/POST/PUT/DELETE routes` | recce route overlays |
| `POST wrap-pickup` | 2nd-AD "actor wrapped" → URGENT run on the board + project-channel alert |

Front-end helpers: `captainApi.*` in `frontend/src/lib/api.ts`.

## Key workflow guarantees
- **Turnaround is enforced in software**, not by memory: `assign()` refuses a driver inside their legal rest
  window; the driver app shows a passive turnaround clock fed by the same `lastWrapAt`.
- **Onboard timestamp is the liability shield** — immutable server time proving the car was there when the
  passenger boarded.
- **Run threads kill phone-tag** — assigning opens a private thread (driver + coordinator) that
  auto-archives on completion; arrival/onboard post automatically.

## Build status
- ✅ Schema delta · `CaptainService` + `CaptainController` · module wiring · `captainApi`.
- ▶ Next: web **Dispatch Board** page (Kanban + assign modal + map) → driver **FSM app** rebuild → glovebox
  ledger + wrapped→nearest-car auto-assign.

> Run once on your machine to apply the schema: `cd backend && npm run db:push` (regenerates the Prisma client).
