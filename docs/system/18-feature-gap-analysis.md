# SYS-18 — Feature Gap Analysis (Design ↔ System)

**Purpose:** verify that every feature the mobile/tablet design (and SYS-16 research) implies has a backing capability in the TFM backend, *before* connecting Figma → code. Source of truth: `backend/prisma/schema.prisma` + `backend/src/*` audited 2026.

**Legend:** ✅ implemented · 🟡 partial (model/data exists, logic/endpoint missing) · 📄 specced-in-doc only (no schema/code) · ❌ missing.

---

## Headline — connect-readiness by module

| Module | Backend status | Safe to connect the designed screens? |
|---|---|---|
| 1 · Scheduling / call sheets / DOOD | ✅ mostly built | **Yes** — 1 gap (delivery receipts) |
| 2 · Script stack (ScriptON) | ✅ built | **Yes** — reader UI is browser-native |
| 3 · Casting / self-tape | ✅ mostly built | **Yes** — several enhancement gaps |
| 4 · Locations & recce | ✅ heavily built | **Yes** — enhancement gaps only |
| 5 · Travel & visa | ✅ built | **Yes** — add alert triggers |
| 6 · Transport / airport | 🟡 built minus live tracking | **Partly** — needs GPS telemetry layer |
| 7 · Accommodation | ✅ built | **Yes** — add conflict detection |
| 8 · Meetings & notes | ❌ net-new, unbuilt | **No** — build backend first |
| 9 · Crew comms & chat | 📄 specced only | **No** — build backend first |

**Bottom line:** 6 modules are connect-ready today. **Meetings (8)** and **Comms (9)** are the two screens whose backend doesn't exist yet. **Transport (6)** live-tracking (the driver "on shift" map) needs a location-telemetry table. Everything else is enhancement polish that degrades gracefully.

---

## 1 · Scheduling / call sheets / DOOD — ✅ mostly built
| Feature | Status | Backing / gap |
|---|---|---|
| Stripboard, auto-schedule by set/pages, day-breaks, conflict flags | ✅ | `ProductionStrip`; `SchedulingService.autoSchedule()`/`board()` (`production/scheduling/scheduling.service.ts`) |
| Call sheet generate + autofill (cast, locations, contacts, daylight) | ✅ | `CallSheet`; `CallSheetsService.autofillDaylight()` via `SunPathService`; `pullFromSchedule()` |
| DOOD generation | ✅ | `DoodCalculationService.generateDoodMatrix()` (SW/W/H/D codes) |
| Live weather on the sheet | 🟡 | sunrise/sunset/golden-hour built; **no live weather feed** — add a weather provider call |
| Delivery tracking (sent/delivered/viewed/bounced) + read receipts | ❌ | only `MailService.sendCallSheet()`; **add `CallSheetDelivery` model + provider/pixel webhooks** |
| "What changed since v-last" diff banner | 🟡 | annotation transfer exists; **no `ScheduleChangeLog`/structured call-sheet diff** |

## 2 · Script stack (ScriptON) — ✅ built
| Feature | Status | Backing / gap |
|---|---|---|
| Reader, sides, Page Maker, lining → hot cost | ✅ | `SidesService`, `LiningService.computeHotCost()`, `HotCostAccrual`, `TakeLog` |
| Table read, assigned character voices, audio studio | ✅ | `VoiceCastingService`, `CharacterVoiceAssignment`, `VoiceProfile`, `AudioRoutingPolicy` |
| Annotation layers (personal/dept/revision) + IAM + note transfer | ✅ | `AnnotationLayer`/`Annotation`/`LayerShare`; `ScriptTransferService.transfer()` (text-anchored re-anchor) |
| Actor highlight / blackout / rehearse | 🟡 | specced (SYS-13b); **browser-native frontend** — backend ready (pageText + cue parse) |
| Revision digest ("3 scenes added · notes migrated") | 🟡 | transfer returns counts; **add `RevisionChangeDigest` (scene-level diff)** |

## 3 · Casting / self-tape — ✅ mostly built
| Feature | Status | Backing / gap |
|---|---|---|
| Actor access (public, no login), audition package, talent DB | ✅ | public `/apply/:castingCallId`; `AuditionPackage`, `GlobalTalentProfile`, `Submission`/`Audition` |
| Watermarked sides | ✅ | `SidesJob` (per-recipient outputs) |
| Self-tape submission + metadata + consent | ✅ | `SelfTapeSubmission` (format/resolution/duration flags), `ConsentLog` |
| Open by QR | ❌ | links exist; **add QR generation around the public token** |
| On-device codec validation (MP4 H.264 1080p <200MB) | ❌ | metadata-only today; **add client validation + enforcement** |
| Auto filename `Name_Character_Project` | ❌ | external `videoUrl` only; **add naming on hosted capture** |
| Deadline countdown + "sides ready ≥48h" gate | ❌ | `deadline` stored; **add countdown + enforcement** |
| Leak-trace watermark (ID per recipient) | ❌ | **add watermark-ID + access audit trail** |

## 4 · Locations & recce — ✅ heavily built
| Feature | Status | Backing / gap |
|---|---|---|
| Offline scout capture (GPS), photo plates + tagging | ✅ | `ScoutSubmission` (idempotent `clientId`), `PhotoPlate` |
| Department recce checklists, permits, risk register | ✅ | `TechRecce`/`RecceNote` + `CHECKLIST_BY_DEPT`; `LocationPermit`; `LocationRisk` |
| Scout call sheet, clearance pack (link) | ✅ | `ScoutVisit`; `ClearancePack` (token + access log) |
| Sun-path (sunrise/sunset/golden/azimuth) | ✅ | `SunPathService.position()` |
| Live sun-path compass/azimuth overlay on viewfinder | 🟡 | math exists; **overlay is frontend** |
| Lens/shot metadata on plates; 360/AR capture | ❌ | `PhotoPlate` has scene/shot refs only; **add lens fields + 360 media type** |
| On-site voice notes auto-transcribed + tagged | ❌ | `RecceNote` text-only; **add voice capture + transcription** |
| Option-comparison deck + director sign-off | ❌ | `LocationNeedOption` (rank/status) exists; **`compareNeed()`/`signOffNeed()` service referenced in docs, not built** |

## 5 · Travel & visa — ✅ built
| Feature | Status | Backing / gap |
|---|---|---|
| Travel desk + readiness engine (passport/visa/flight/hotel) | ✅ | `TravelerProfile.readiness()`; `Trip`, `Itinerary` |
| Visa/work-permit status board + requests → approvals | ✅ | `VisaApplication`/`TravelerVisa` (SLA days); workflow on `WorkflowEntity.TRIP` |
| Itineraries, passport/ID vault, manifests, per-diem | ✅ | `FlightBooking`/`HotelBooking`/`CarBooking`; `TravelerDocument`; `TravelArrival`; `PerDiem` |
| Lead-time + expiry **alerts** | 🟡 | SLA/expiry stored; **add a watch/notification trigger** (the "expires in 14 days" banner) |
| Supplier/agent booking integration | 🟡 | `TravelSupplier` exists; **no quote/booking endpoints** |

## 6 · Transport / airport — 🟡 built minus live tracking
| Feature | Status | Backing / gap |
|---|---|---|
| TransportOrder/Assignment, shuttle routes, manifests, run-sheet | ✅ | `TransportOrder` (REQUESTED→…→COMPLETED), `ShuttleRoute`/`Stop`/`Rider`, `TransportPassenger` |
| Airport pickup tied to flight number | ✅ | `TravelArrival.flightNumber`; arrival dashboard (LANDED→COLLECTED→…) |
| **Live ETA + continuous GPS (driver "on shift" map)** | ❌ | discrete timestamps only; **add `LocationPing`/telemetry table + realtime channel + flight-status API for live ETA** |
| Live status to dispatch / Live Logistics map | 🟡 | status events exist; **map needs the telemetry above** |

## 7 · Accommodation — ✅ built
| Feature | Status | Backing / gap |
|---|---|---|
| Rooming list, room inventory, hotel info | ✅ | `AccommodationAssignment`, `RoomInventory`, `AccommodationProperty` |
| Check-in/out, class tiers, nightly cost | ✅ | `checkIn/checkOut`, `AccommodationClass`, `nightlyRate` |
| Occupancy + **conflict detection** (the "Conflict" row) | 🟡 | `status` AVAILABLE/OCCUPIED exists; **add overlap-detection service** |
| Dynamic/seasonal pricing; hotel API sync | 🟡 | static `nightlyRate`; manual entry |

## 8 · Meetings & notes — ❌ net-new, unbuilt
No `Meeting`/`Agenda`/`AgendaItem`/`Minutes`/`ActionItem` models or service exist (the only "MEETING" token is a script annotation-layer type). **The entire Meetings screen has no backend.**

**Build:** models `Meeting`, `AgendaItem`, `MeetingAttendee` (role-derived), `MeetingMinute`, `ActionItem` (→ assignable task tied to the Person); services for scheduling, recurring meetings, attendee auto-pull by role/department, room booking, searchable notes, and agenda-item links to project entities (scene/location/budget).

## 9 · Crew comms & chat — 📄 specced only
Fully specced in `driver-fieldops-comms-blueprint.html`, **zero implementation**. No `Channel`/`ChannelMember`/`Message`/`MessageVersion`/`Attachment`/`PttSession`/`AuditAccessLog`, no `comms/` service dir. Generic `AuditLog` exists but isn't message-vault specific.

**Build (blueprint "Next" phase):** schema — `Channel` (scopeType/scopeId), `ChannelMember` (derived-from-assignment, lastReadAt), `Message` (body/type/gps/contentHash/deletedAt), `MessageVersion`, `Attachment` (shared+original+hash), `AuditAccessLog`, `PttSession`. Services — `channel` (auto-membership from assignment + hierarchy group creation), `message` (append-only tombstone deletes + versioning), `broadcast` (read tracking), `audit-vault` (admin-only, logs every read), and the device outbox/service-worker offline sync. PTT/native → "Later".

---

## Prioritised build queue (to make every designed screen real)

**P0 — backend doesn't exist for a designed screen (build before connecting that screen):**
1. **Comms backbone** (Module 9) — Channel/Message/PTT/Attachment/AuditAccessLog + services. Backs the Comms screen, the offline-sync states, and chat surfaced across the app.
2. **Meetings module** (Module 8) — full data layer + services. Backs the Meetings screen.
3. **Transport telemetry** (Module 6) — `LocationPing` + realtime + flight-status. Backs the driver "on shift" live map and transport live status.

**P1 — UI shows it but degrades gracefully (build alongside):**
4. Call-sheet delivery/read-receipts (Module 1) · 5. Visa lead-time/expiry alert trigger (5) · 6. Accommodation conflict-detection (7) · 7. Casting QR + codec validation + auto-filename + deadline gate + leak-watermark (3) · 8. Recce voice-note transcription + lens metadata + option-comparison sign-off (4) · 9. Revision digest (2) · 10. Live weather on call sheet (1).

**P2 — future / nice-to-have:** 360/AR capture (4) · dynamic accommodation pricing + hotel API (7) · travel supplier API (5).

**Net:** 6/9 modules can be wired to the existing backend now. Meetings, Comms, and transport live-tracking are the three real builds; the rest are enhancements.
