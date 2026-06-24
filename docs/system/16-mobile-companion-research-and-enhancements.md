# SYS-16 — Mobile & Tablet Companion: Research-Backed Enhancements

**Status:** research + design spec (informs the Figma build).
**Companions:** SYS-14 (IA consolidation), the access model (scopes + hierarchy), the full one-stop-shop module map.
**Method:** industry best-practice research per module (sources cited inline) + reasoning against what TFM already has → concrete enhancements.

---

## 0 · Design principles (UI/UX best practice)

Drawn from current mobile/enterprise UX guidance ([Orbix](https://www.orbix.studio/blogs/mobile-app-ux-best-practices-guide), [Droids on Roids](https://www.thedroidsonroids.com/blog/mobile-app-ui-design-guide), [UXCam](https://uxcam.com/blog/mobile-ux/), [devPulse](https://devpulse.com/insights/ux-ui-design-best-practices-2025-enterprise-applications/)):

- **Phone = focused field tool, tablet = station.** Mobile-first for single tasks on the move; tablet uses list-detail + split view. One responsive codebase via container queries — which our design system already does.
- **Offline-first for non-realtime data.** Cache + outbox; "captured-at, not synced-at." Film happens where there's no signal.
- **Touch + legibility.** 44pt iOS / 48dp Android minimum targets; Dynamic Type; AA contrast in sun *and* dark.
- **Token-based design system** (color/space/type variables) + reusable component library → consistency, faster handoff, design↔code parity.
- **Glanceability.** One primary action per screen, tabular numerals, status-color semantics (gold = signal/active; ok/warn/danger reserved).
- **Adaptive iPhone → iPad → foldable** (iOS now expects fully adaptive layouts).

---

## 1 · Scheduling · call sheets · DOOD

- **Industry standard** ([StudioBinder](https://www.studiobinder.com/film-production-management-software/), [Movie Magic], [Filmustage](https://filmustage.com/blog/best-practices-for-scheduling-a-film/)): stripboard auto-schedule by location/light/page-count with automatic day-breaks; conflict flags before they bite; call sheets generated from the stripboard, auto-populated with cast, locations + map links, contacts, live weather; **delivery tracking** (sent / delivered / viewed / bounced, timestamped); DOOD generated instantly.
- **In TFM today:** `board()`, `autoSchedule({pagesPerDay})`, `dood()`, call-sheet autofill incl. sun-path daylight.
- **Enhancements (mobile/tablet):** today's strip + call sheet readable offline; **read receipts + one-tap "got it / I'll be there"**; weather + sunrise/sunset auto on the sheet; conflict flags surfaced on mobile; **"what changed since v-last"** diff banner; one-tap navigate to location (hand-off + tracking, as in the driver app).

## 2 · Script stack · reader · table read · sides · notes

- **Industry standard** ([Scriptation](https://scriptation.com/features/read-rehearse-record/), Emmy-winning; [best actor apps](https://scriptation.com/blog/best-apps-for-actors/)): listen with **distinct character voices**; table-read on the go; auto-highlight a character's lines + scene headings; **blackout** lines for memorization; line reminders + repeat-scene; **Note Transfer** (annotations auto-relocate across drafts); **Layers** (personal / department / revision); Live Layers sharing; digital sides + Page Maker.
- **In TFM today:** ScriptON already mirrors this 1:1 — reader + karaoke, table read with assigned voices, lining → hot cost, annotation layers with IAM, text-anchored note transfer, audio studio.
- **Enhancements:** actor **highlight / blackout / rehearse** parity on phone + tablet; per-character table-read playback (download for offline); **revision digest** ("3 scenes added · your notes migrated to p.12"); Live Layers on the tablet reading station.

## 3 · Casting & actor access · self-tape

- **Industry standard** ([Casting Networks](https://www.castingnetworks.com/news/what-to-ask-for-in-a-self-tape/), [SAG-AFTRA self-tape rules](https://www.castingnetworks.com/news/what-you-need-to-know-about-the-new-sag-aftra-agreement-self-tapes-and-auditions/)): sides distributed **≥48h** before deadline (24h min); explicit instructions (props, takes, angles, indoor/outdoor); export **MP4 H.264, 1080p, <200MB**; filename `Name_Character_Project`; sides visible to talent on request.
- **In TFM today:** actor-by-link/QR (no login), watermarked sides, self-tape submission (metadata), audition package.
- **Enhancements:** **in-app self-tape** with on-device format/duration validation + auto-filename; deadline **countdown**; reader/rehearse before recording; leak-trace watermark; consent capture; "sides ready 48h" enforced by the system.

## 4 · Locations & technical recce

- **Industry standard** ([Destination Film Guide](https://destinationfilmguide.com/hi-tech-film-location-scouting-tools/), [Cadrage](https://www.cadrage.app/location-scouting/), [SuperScout](https://superscout.ai/blog/film-location-scouting-apps-you-need/)): GPS tagging, geofencing, notes, cloud sync, AR preview (Artemis/MapAPic/Scouty); **sun-path** (PhotoPills/Sun Seeker — point the phone, see the sun's position any time); director's viewfinder capturing **lens + GPS + compass bearing** (Cadrage); collaborative comments + photo annotation.
- **In TFM today:** offline scout capture (GPS), photo plates + tagging, department recce checklists, sun-path math, permits + risk register, scout call sheet, clearance QR.
- **Enhancements:** **live sun-path compass overlay** (azimuth on the camera viewfinder); lens/shot metadata on plates; 360/AR capture; on-site **voice notes auto-transcribed** + tagged; full offline parity; **option-comparison deck on tablet** for director sign-off.

## 5 · Travel & visa

- **Industry standard** ([Corporate Traveler](https://www.corporatetraveler.us/en-us/industry-expertise/film-production-travel), [C-I Studios](https://c-istudios.com/managing-international-film-production-logistics-permits-crew-budget/)): specialist production travel; visas/work-permits handled early to avoid delays (2–5% of budget); flexibility for cast/schedule changes; a "travel report" vendor playbook.
- **In TFM today:** travel desk + readiness engine (passport/visa/flight/hotel).
- **Enhancements:** **visa & work-permit status board** with lead-time + expiry alerts; travel/visa **requests → approvals**; flight + transfer itineraries; passport/ID vault; **group movement manifests**; traveler self-service (upload docs, see itinerary); per-diem link.

## 6 · Transport & airport pickups

- **Industry standard** (above + logistics guides): flexible transport keyed to terrain; local logistics partners; airport pickups; equipment transport coordination.
- **In TFM today:** `TransportOrder` / `TransportAssignment` / `ShuttleRoute` / `TravelArrival`, plus the driver app (designed).
- **Enhancements:** **flight-number-tracked airport pickups** (live ETA, meet-&-greet); a **daily run-sheet**; request → assign → driver/vehicle; passenger manifests; live status to dispatch — all feeding the existing Live Logistics map + driver "on shift" screen.

## 7 · Accommodation

- **Industry standard:** crew travel + accommodation is 20–35% of budget; rooming-list discipline; class tiers.
- **In TFM today:** `AccommodationAssignment` + room inventory.
- **Enhancements:** **rooming list**, check-in/out, room class (standard / exec / VIP), **occupancy calendar + conflict detection**, nightly cost, hotel info card with map + transport link.

## 8 · Meetings & notes  *(new module)*

- **Industry standard** ([Fellow](https://fellow.app/blog/meetings/production-meetings-complete-guide/), [Wrike](https://www.wrike.com/blog/action-items-with-meeting-notes-template/)): agenda split into informational / action / discussion, **time-boxed**; attendees by role; pre-meeting materials; minutes capturing date, attendees, decisions, **action items with owners + deadlines**, next steps; action-item follow-up; everything stored + distributed via the app.
- **In TFM today:** none — net-new.
- **Build it as:** schedule pre-pro + production meetings; **invitees auto-pulled by role/department** ("who's concerned"); meeting room; agenda; **live minutes**; **action items that become assignable tasks** tied to the Person; recurring meetings; searchable notes; agenda items link to project entities (scene / location / budget line).

## 9 · Crew comms & chat

- **Industry standard:** production-meeting/comms apps for sharing; on-set walkie / push-to-talk.
- **In TFM today:** comms backbone — channels scoped to entities, membership derived from assignment, PTT, broadcasts, append-only audit (blueprint).
- **Enhancements:** **hierarchy-driven group creation** (producers → BTL, line producer → dept heads, UPM → BTL crew, dept heads → their crew, 2nd-unit PM → 2nd unit); broadcast down the chain with read tracking; PTT rooms; offline voice notes; admin audit vault.

---

## 10 · Tooling split — Figma vs Adobe

- **Figma (full design build):** variables/tokens (Graphite & Gold, light + dark), component library, every screen at phone + tablet, design → code parity to the React/PWA front-end.
- **Adobe (graphic assets only):** app icon (vector), empty-state illustrations, login backdrop, App Store screenshots, plus photo edit / vectorize / resize / export. *Note: this connector has no text-to-image — assets are authored as vector or edited from real images.*

## 11 · Build order

1. **Foundations** — Figma variables: color (light + dark), type scale, spacing, radius.
2. **Core components** — status bar, bottom tab bar, buttons, cards, chips, list rows, metric cells, map card, trip/step progress, app bar (tablet).
3. **Screens, module by module** — driver (done) → on-set "run the day" → script + actor → locations/recce → people & movement (travel/transport/accommodation) → meetings → comms.
4. **Adobe assets in parallel** — app icon first, then illustrations + store shots.
