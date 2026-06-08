# SYS-12 — Accommodation, Transportation & Logistics ✅ IMPLEMENTED (A–G)

A standalone master module for everything that happens **after** a person is
attached to a production: where they stay, how they move, who drives them, in
which vehicle, on which route, and what it costs. Travel (SYS-11) answers *how do
they get to the production*; SYS-12 answers *where do they stay and how do they
move once they're here* — different operational departments.

It serves **everyone**, not just travellers: local crew, traveling crew, local &
international talent, ATL/BTL, consultants, VIP guests, government delegations and
studio reps — without forcing anyone through a Trip.

> **Architecture rule (non-negotiable):** reuse the existing fleet, vendor, person,
> arrival and budget infrastructure. Add new entities only for accommodation and
> transport scheduling, which genuinely don't exist yet. Do **not** rebuild
> vehicles, drivers, fuel, vendors or the universal person.

---

## 1. What already exists (reuse — do not duplicate)

| Need | Existing entity | Module |
|------|-----------------|--------|
| **In-house vehicles / fleet** | `Asset` (category `VEHICLE`; plate, emirate, VIN, odometer, registration + insurance + expiry, photos, maintenance/damage/fuel logs) | Rentals/Fleet |
| **In-house drivers** | `Driver` (+ `DriverProfile`, `DriverJob` history) | Rentals/Fleet |

> **Important distinction.** The existing Rentals module rents **out** the company's
> own vehicles & caravans (a rental *business*). SYS-12 transport is the opposite
> purpose: it **hires** vehicles/drivers from external rental companies **for
> productions**. So a SYS-12 `TransportVehicle` is a thin wrapper that is **either
> in-house** (links an `Asset`) **or hired** (links a `Supplier` rental company with
> rate/period and, in slice E, a `PurchaseOrder`). Drivers likewise wrap an in-house
> `Driver` or a supplier-provided driver. It shares the fleet data but the purpose
> and the money flow (hiring-in vs renting-out) are different.
| **Fuel** | `FuelLog` (per asset) | Rentals/Fleet |
| **Vehicle bookings/jobs** | `BookingItem`, `DriverJob` | Rentals |
| **Vendors** | `Supplier` (master) + `ProductionVendor` (per-project, PO-linked) | Finance/Production |
| **The universal person** | `TravelerProfile` (`personType` TALENT/ACCOMPANYING/CREW/CONSULTANT/VIP) — talent & crew already link to it | SYS-11 |
| **Accommodation/transport *required?*** | `accommodationRequired`, `groundTransportRequired` flags (computed by the Travel Requirement Engine) | SYS-10 V2.0 §2 |
| **Trip-bound hotel** | `HotelBooking` (on an `Itinerary`) | SYS-11 |
| **Arrival / meet & greet** | `TravelArrival` (airport, flight, terminal, driver, coordinator) | SYS-11 |
| **Money** | `PurchaseOrder` (commitment) + `ProjectTransaction` (actual), `assertPeriodOpen()` guard | Two-Ledger |

**The person is always a `TravelerProfile`.** It's already the universal identity;
local crew get one on demand (the existing `ensureCrewIdentity`), and guests /
delegations use it too (extend `TravelerPersonType` with `GUEST` / `DELEGATE`).
Accommodation and transport attach to the identity directly — a Trip is **not**
required, which is exactly how local people stay out of Travel.

---

## 2. New entities (the only additions)

| Entity | Purpose |
|--------|---------|
| `AccommodationProperty` | A physical property (hotel, apartment block, villa, crew camp, dormitory, serviced apt, resort, staff housing). Links to a `Supplier` (the vendor) + a `MasterLocation`/geo where relevant. |
| `RoomInventory` | A room/unit/bed within a property — number, `RoomType`, capacity, status. |
| `AccommodationAssignment` | Puts a `TravelerProfile` into a `RoomInventory` for a date range, with class + status; optionally links the originating `HotelBooking`. |
| `TransportOrder` | A movement request: type, from → to, datetime, passengers (`TravelerProfile[]`), purpose, project, status. |
| `TransportAssignment` | Fulfils an order with a vehicle (`Asset`) + driver (`Driver`) + route; status. |
| `ShuttleRoute` + `ShuttleStop` | Recurring multi-stop routes (Hotel A → Base Camp → Studio → Airport) with capacity. |

Vendor ranking (`Preferred` / `Approved` / `Restricted` / `Blacklisted`) and a
property category are **added as fields on `Supplier`**, not a new vendor table.
**Fuel reuses `FuelLog`. Car rental reuses the rentals booking + `PurchaseOrder`**
(a thin `VehicleRental` wrapper only if the project-side needs its own record).
`TravelArrival` is **extended** with `vehicleId`, `driverId` and a check-in status
rather than re-created.

### New enums
`AccommodationType`, `RoomType` (Single/Double/Twin/Suite/Executive Suite/Villa/
Apartment/Dormitory/Bed), `AccommodationClass` (Standard/Business/Executive/VIP/
Ultra VIP), `AccommodationStatus`, `TransportOrderType` (TALENT_PICKUP/CREW_SHUTTLE/
AIRPORT_PICKUP/AIRPORT_DROPOFF/EQUIPMENT_RUN/INTER_LOCATION/OTHER), `TransportStatus`
(REQUESTED/ASSIGNED/EN_ROUTE/COMPLETED/CANCELLED), `VendorRanking`.

---

## 3. Requirement engines (already built — reuse + extend)

- **Accommodation Required** — already computed by the Travel Requirement Engine:
  same city → No; different city/country → Yes (Dubai→Liwa = Yes, London actor =
  Yes, Abu Dhabi local at Abu Dhabi shoot = No). SYS-12 reads
  `accommodationRequired`; no new logic.
- **Ground Transport Required** — reads `groundTransportRequired`.
- **Accommodation Class** — pulled from the **Deal Memo / Talent Negotiation**
  (`TalentNegotiation.accommodationTier`, SYS-10 V2.0 §7), so a Lead's "Executive
  Suite" requirement flows automatically into the assignment and is enforced.

---

## 4. Where it lives (dual-target, like Locations/Travel)

| Surface | Purpose |
|---------|---------|
| **Master** (left sidebar) | Properties + room inventory directory, vehicle registry (over `Asset`), driver roster, vendor ranking, logistics vendor master, cross-project dashboards & reports. |
| **Per-project** (Engagements tab) | This production's rooming list, transport orders, daily movement board, shuttle schedule, fuel & cost — scoped to the project. |
| **Integrations** | Casting/Travel/Crew/Scheduling/Locations/Vendors/Budget/Finance/Payroll/PO/Fleet (see §7). |

### Operational dashboards
- **Daily Movement Board** — today's vehicles, drivers, passengers, pickups,
  drop-offs, late/completed/cancelled movements (a view over `TransportOrder`).
- **Occupancy / Rooming Board** — who's in which room, arrivals/departures,
  extensions, early check-outs (a view over `AccommodationAssignment`).
- **Arrival Dashboard** (extends SYS-11 arrival sheet) — Flight landed → Passenger
  collected → Checked in → Completed, with airport rep, driver, vehicle, hotel.

---

## 5. The flows

```
International talent : Casting → Deal Memo → Travel (Trip) → Accommodation → Transport → Arrival → Production
Traveling crew      : Crew → Travel (Trip) → Accommodation → Transport → Arrival
Local crew on loc.  : Crew → (identity) → Accommodation (camp/villa) → Transport
Local talent/crew   : (identity) → Transport only
VIP / delegation    : Guest identity → Accommodation (VIP class) → Transport → Arrival
```

Every arrow is an entity link, and accommodation/transport hang off the
`TravelerProfile`, so the same screens work for all of them.

---

## 6. Reports (build from day one — computed views)

- **Accommodation:** occupancy, hotel utilization, rooming list, check-in / check-out schedules.
- **Transportation:** vehicle utilization, driver utilization, daily movement, shuttle report.
- **Fuel:** consumption, cost-per-km, fuel by project / vehicle / driver / department (over `FuelLog`).
- **Vendor:** hotel spend, vehicle-rental spend, logistics spend by project (over `PurchaseOrder`/`ProjectTransaction`).
- **Executive:** total accommodation cost, total transport cost, **cost per person**, **cost per shooting day**.

---

## 7. Integration guardrails (prevent duplicates)

| Need | Use the existing… |
|------|-------------------|
| Person (anyone) | `TravelerProfile` (universal identity) |
| Vehicle | `Asset` (category VEHICLE) |
| Driver | `Driver` / `DriverProfile` |
| Fuel | `FuelLog` |
| Vendor + ranking | `Supplier` (+ new ranking/category fields) / `ProductionVendor` |
| Hotel booked via travel | `HotelBooking` (link, don't copy) |
| Arrival | `TravelArrival` (extend) |
| Accommodation/transport required | V2-A flags |
| Accommodation class | `TalentNegotiation.accommodationTier` |
| Money | `PurchaseOrder` + `ProjectTransaction` (Two-Ledger, period-locked) |
| Scheduling dates | project schedule / shoot days |
| Location of stay/movement | `MasterLocation` / geo |

---

## 8. Suggested build order (phased: schema → backend → frontend, one slice each)

1. **SYS-12.A — Accommodation master**: `AccommodationProperty` + `RoomInventory` +
   `Supplier` ranking/category; `AccommodationAssignment` reading the
   `accommodationRequired` flag + class from the deal memo.
2. **SYS-12.B — Crew housing & occupancy board**: camps/villas/dormitories as
   property types; rooming list + occupancy/check-in board.
3. **SYS-12.C — Transport operations** ✅: vehicle registry (in-house `Asset`
   wrapper **or** hired from a rental-company `Supplier`) + driver roster (in-house
   `Driver` or hired/freelance) + `TransportOrder` + `TransportPassenger`
   (identity passengers) + per-project Transport tab + **Daily Movement Board**.
   New entities: `TransportVehicle`, `TransportDriver`, `TransportOrder`,
   `TransportPassenger`. Master registry at `/transport`.
4. **SYS-12.D — Shuttle & bus scheduling** ✅: `ShuttleRoute` + `ShuttleStop`
   (recurring, multi-stop, capacity) + `ShuttleRider` manifest (TravelerProfile
   boarding at a named stop). Vehicle + driver reuse SYS-12.C; capacity = route
   override or vehicle capacity. Per-project **Shuttle** tab with stops editor,
   rider assignment, capacity bar &amp; manifest.
5. **SYS-12.E — Fuel & car rental** ✅: `FuelLog` **broadened** (assetId now
   optional + `transportVehicleId`/`projectId`/`transportDriverId`) so production
   fuel logs against hired *and* in-house vehicles — no new fuel table. Fuel report
   (litres, cost, by-vehicle with cost-per-km from odometer deltas, by-driver). Car
   rental wired to the **Two-Ledger**: `commitVehicle` → `PurchaseOrder`
   (encumbrance, vendor = rental company; staged `purchaseOrderId`), `postVehicleActual`
   → `ledger.create` (period-locked `assertOpen`; standalone → House as
   `CORPORATE_OVERHEAD`; `postedTxnId`). Per-project **Fuel & rental** tab; Commit/Post
   buttons on the Transport registry.
6. **SYS-12.F — Arrival operations** ✅: `TravelArrival` extended with `projectId`,
   `status` (`ArrivalStatus`: Scheduled→Landed→Collected→Checked-in→Completed /
   No-show / Cancelled), structured `vehicleId`/`transportDriverId`, meet-&-greet
   rep, arrival photo and timeline stamps (`landedAt`/`collectedAt`/`checkedInAt`).
   Real-time **Arrival dashboard** (`/logistics/arrivals/dashboard`) + per-project
   **Arrivals** tab with one-click *Advance*.
7. **SYS-12.G — Logistics & executive reports** ✅: computed aggregator
   (`/logistics/reports/summary` per project, `/overview` cross-project) — no new
   tables. Accommodation occupancy/cost (room-nights × nightly rate), transport &
   driver utilisation + hired-vehicle cost, shuttle utilisation, arrival completion,
   and the executive roll-up: **cost-per-person** & **cost-per-shooting-day** (shoot
   days sourced from globals → shoot dates → call-sheet count). Per-project
   **Logistics report** tab + master **Logistics dashboard** (`/logistics`).

Each slice keeps the existing SYS-07/10/11 and Rentals/Fleet architecture intact
and only adds the accommodation/transport entities named above. Cross-references:
the *required?* flags live in **SYS-10 V2.0 §2 / SYS-11 §10**; the accommodation
class originates in **SYS-10 V2.0 §7**; arrival extends **SYS-11 §4**.
