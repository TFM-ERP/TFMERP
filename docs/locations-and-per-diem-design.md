# Locations (per project) + automatic Per‑Diem — Design

Two connected features. **Locations** turns today's scattered free‑text ("Dubai", "Warehouse") into a real per‑project place record with a map pin, contacts and a manager. **Per‑diem** then becomes automatic, because eligibility depends on *where* you shoot vs. where the crew is based.

---

## 1. Why they're linked

Per‑diem rule you described:
- **Abroad crew** → always get per‑diem (travel allowance) for working days.
- **Local (UAE) crew** → per‑diem **only when filming in a different emirate** than their base. A Dubai‑based gaffer shooting in Abu Dhabi gets it; shooting in Dubai he doesn't.

To compute that automatically the system must know, **per shoot day**, the **emirate of the location** and the **base emirate of each crew member**. The Locations section supplies the first half; a `baseEmirate` on the crew supplies the second.

---

## 2. Locations section — proposed model

A `Location` per project (a real "location binder" entry):

```
Location
  id, projectId, name                 // "Warehouse — Al Quoz"
  type      INT | EXT | STUDIO | BACKLOT
  status    SCOUTING | OPTION | CONFIRMED | RELEASED
  // Geography (drives per-diem + call sheet)
  country (default UAE) · emirate/city · area/district · fullAddress
  lat · lng · googleMapsUrl · what3words
  // People on the location
  locationManagerId  → ProductionCrew (assigned LM)
  locationAssistantId → ProductionCrew
  ownerContactName · ownerPhone · ownerEmail   // on-site / property contact
  // Logistics for the call sheet
  parkingNotes · basecampNotes · accessNotes
  facilities (power / water / toilets / wifi)   // checkboxes
  restrictions (noise curfew, no smoking, etc.)
  nearestHospitalName · nearestHospitalAddress · nearestHospitalPhone  // safety
  // Money & compliance
  locationFeePerDay · currency
  permitRequired · permitStatus · permitNumber · permitExpiry · permitDocUrl
  // Media
  photoUrls[] · documentUrls[]
  notes
```

**Project "Locations" tab** (new): a card grid / list of locations with status chips and a mini map link; click to edit the full record; a small **map preview** from the lat/lng (Google Maps embed link — no API key needed for a link, optional embed later).

### Relationships (what makes it useful, not just a list)
- **Scenes/Stripboard:** each strip gets an optional `locationId` (replacing/augmenting the free‑text `location`). → "which scenes shoot here", and the one‑line schedule groups by location.
- **Shoot days / Call sheets:** the call sheet picks a `locationId` and **auto‑fills** name, address, map URL, parking, basecamp, **nearest hospital**, and the **on‑location contact + LM**. (Today these are typed by hand every time.)
- **Per‑diem:** the location's **emirate** is the trigger for the rule below.
- **Budget/incentives (bonus):** location fees can post to the budget; for ADFC, locations also evidence "filmed in Abu Dhabi".

---

## 3. Call‑sheet integration

When building a call sheet, choose the **Location** → it pulls in address, map pin, parking, basecamp, nearest hospital, and shows the **Location Manager** and **on‑site contact** in the header/safety block. The printed call sheet gains a proper **"Location & Safety"** panel (map link, hospital, LM phone) instead of free text.

---

## 4. Automatic per‑diem

### Inputs
- **Crew base emirate** — add `baseEmirate` to the crew member (Dubai / Abu Dhabi / Sharjah / Ajman / RAK / Fujairah / UMQ). `isLocal=false` = abroad.
- **Working days per person** — already known from the **DOOD** (cast/crew working pattern) and assignment dates.
- **Location emirate per shoot day** — from the day's call‑sheet/strip `locationId`.

### Rule (per person, per shoot day)
```
if crew.isLocal == false                          → eligible (international per-diem rate)
else if dayLocation.emirate != crew.baseEmirate   → eligible (cross-emirate per-diem rate)
else                                              → not eligible (home emirate)
```
Per‑diem days = count of eligible shoot days. Amount = eligible days × rate.

### Rates (configurable, project‑level defaults)
- `internationalPerDiem` (abroad crew) and `domesticPerDiem` (cross‑emirate locals), in the project currency. Editable per person if needed.

### "Generate per‑diem" (one click, like the schedule‑driven one already there)
Walk each assignment's working days → look up that day's location emirate → apply the rule → produce/update a `PerDiem` row per person with the eligible day count, rate and total, plus a note ("3 cross‑emirate days in Abu Dhabi"). Re‑runnable; never silently overwrites manual ones (flag generated ones).

---

## 5. Implementation phases
- **A — Locations section:** `Location` model + per‑project **Locations tab** (CRUD, status, map pin, contacts/LM, permit, hospital, fee). The foundation.
- **B — Wire‑ups:** strip `locationId` picker; call‑sheet location picker + auto‑fill + safety panel on the PDF.
- **C — Per‑diem automation:** `baseEmirate` on crew + project per‑diem rate settings + the rule engine + "Generate per‑diem from schedule & locations".

Recommend building **A → B → C** in order, since per‑diem automation depends on locations carrying an emirate and call sheets/strips referencing them.

---

## Open questions
1. Per‑diem **rates**: project‑level defaults (one international + one domestic figure), or per‑person overrides too?
2. Should a **location fee** auto‑post to the budget/cost report, or stay informational on the location record?
3. Scope of map pin now: a **Google Maps link** from lat/lng (simple, no key) — or an embedded interactive map later?
