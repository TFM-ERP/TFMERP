# Email Intelligence Report — TFM-System
**The Film Makers FZ LLC — Qais & Islam mailboxes**
Prepared from a full parse of **8,349 emails** (both mailboxes), distilled to a digest, then analysed + verified online.

---

## 1. Executive summary

A clean parse of 8,348/8,349 `.msg` files surfaced **1,551 contacts that carry a clear full name** (the only ones eligible per the no‑name‑no‑record rule). Of those, the analyzer flagged **208 as new** to your database and **1,343 as matching an existing record** (to enrich).

Two headline findings:

1. **The data validates the system you've built and exposes the gaps it doesn't yet cover.** Keyword frequency across every email maps almost perfectly onto your modules — *location (2,357), crew (1,577), invoice (1,127), permit (1,041), budget (535), NOC (327), insurance (303), risk/method‑statement (195)* — confirming the Locations/Permits/Security/Finance work. But three high‑traffic areas have **no home in the system**: **Travel & Visa (travel 1,016 · visa 369 · accommodation 219)**, **Contracts (844)**, and **Casting/Recruitment (casting 107 + a constant stream of crew/talent applications)**.

2. **Classification needs human/AI judgement, not just keywords.** The first‑pass classifier over‑assigned "CREW" to people who actually work *at production companies* (Image Nation, Breakout Films, Electric Films, The Nudge…). Those are **Client / Business‑Partner** contacts. The corrected rules are in §3 and I've updated the classifier accordingly.

> **Important caveat on the 1,343 "matched":** that number is high and partly driven by loose **name** matching (common first/last names colliding). Treat the **email‑matched** enrichments as safe; review the **name‑only** matches in `contacts.csv` before `--apply`. The refined script tightens this.

---

## 2. Coverage & classification (first pass)

| Suggested class | Count | Note |
|---|---|---|
| OTHER | 779 | needs refinement — many are partners/clients/service providers |
| CREW | 247 | **over‑counted** — production‑company staff misfiled here |
| AUTHORITY | 187 | twofour54, ADFC, DCT, police, RTA, municipalities |
| SERVICE_PROVIDER | 102 | fixers, charter, insurance, travel, logistics |
| VENDOR | 95 | equipment, lighting, grip, catering |
| CLIENT | 61 | brands/agencies commissioning work |
| SUPPLIER | 46 | consumables, transport, stationery |
| PARTNER | 34 | co‑production / financing / distribution |

New contacts skew heavily toward the UAE production ecosystem — Image Nation, Breakout Films, Electric Films, Pinzutu Films, The Nudge Theory, The Cheek, SeeMe Production, NEEDaFIXER, IY Film Locations, Elements, GBSS, plus DCT Abu Dhabi (authority).

---

## 3. Corrected classification rules (verified online)

| Company (domain) | What it is | Correct class | Their people → |
|---|---|---|---|
| **Image Nation Abu Dhabi** (imagenation.ae) | Emirati film studio/financier, part of CMA; 2 Oscars, BAFTA, Emmy | **Business Partner / Client** | Contact · CLIENT_EMPLOYEE |
| **Breakout Films** (breakoutfilms.com) | Dubai production company (Rami Yasin, Mofeed Abu Algebeen) | **Business Partner** (co‑pro / production services) | Contact · OTHER→Partner |
| **Electric Films** (electricfilms.ae) | Dubai production house (BBC, NatGeo, MBC work) | **Business Partner / Client** | Contact · CLIENT_EMPLOYEE |
| **NEEDaFIXER** (needafixer.com) | UAE‑wide fixer / production services | **Service Provider** | Contact · VENDOR_EMPLOYEE |
| **DCT Abu Dhabi** (dctabudhabi.ae) | Dept. of Culture & Tourism | **Authority** | Contact · OTHER |
| The Nudge Theory, The Cheek, SeeMe, Pinzutu, Ffprods | Production/creative companies | Partner / Client | Contact · CLIENT_EMPLOYEE |
| IY Film Locations (iyfilmlocations.com) | Location services | Vendor / Service Provider | Contact · VENDOR_EMPLOYEE |
| VFX Dudes (vfxdudes.com) | VFX house | Vendor | Contact · VENDOR_EMPLOYEE |

**Rule of thumb baked into the refined classifier:** a person at a *production / studio / agency* domain → **Partner/Client contact**, not crew. Genuine **CREW** = individuals offering their own service (freelance DOP/editor/3D artist/gaffer on a personal or single‑discipline domain) — e.g. *Mohamed Adel (editor)*, *Rayyan Afser Khan (3D)*, *Elie Kolko (gaffer)*, *Liam Meyer (VP producer)*.

---

## 4. New modules, features & fields discovered (the system enhancements)

Ranked by email volume = real operational weight.

### A. Travel, Visa & Logistics module *(travel 1,016 · visa 369 · accommodation 219 · shipping 38 · charter 10)* — **highest‑value gap**
Crew flights, hotel bookings, **visa/entry‑permit applications** (status + expiry), ground transport, equipment **shipping / carnet / customs**, and air‑charter. Today this lives entirely in email. Build a per‑project **Travel & Logistics** module:
- Entities: `Trip` (person ↔ project), `FlightBooking`, `HotelBooking`, `VisaApplication` (status, expiry, doc), `GroundTransport`, `ShipmentCarnet`.
- Links: crew ↔ trip; trip cost → ledger (category Travel); per‑diem ties to accommodation.
- Automation: build an itinerary from confirmation emails (reuse the `.msg` intake), and **visa/passport expiry reminders** (you already store crew `passportExpiry`/`visaExpiry` — surface them in the same expiry‑digest you built for locations).

### B. Contracts & e‑signature register *(contract 844; DocuSign/eSignature attachments seen)*
A master **Contract** register: deal memos, NDAs, talent/crew contracts, vendor agreements, location agreements (already in Locations). Fields: party, type, value, signed/expiry dates, signing status, file. Relationship to crew/vendor/client/project. Generalises the NOC/agreement work from Locations to the whole company.

### C. Casting & Crew‑application pipeline (ATS) *(casting 107 + a steady inbound stream)*
Both inboxes receive constant **"Application for <role>"** and casting submissions. Build an **inbound applications pipeline**: capture applicant, role, CV/showreel, status (Applied → Shortlisted → Hired), feeding directly into the **Crew Directory** (your paste‑a‑profile importer is the manual half of this). Add `Casting Call` + `Submission` for talent.

### D. Co‑production / business‑development pipeline *(partner 34; many inbound co‑pro/financing/distribution offers to Qais)*
Inbound feature/series co‑production, financing and pre‑sale/distribution inquiries (e.g. "CRAZY RICH ARABS", screenplay submissions, AFM meetings). Extend the existing CRM **Opportunities** with a `CO_PRODUCTION` type: project title, stage, partner, territory, ask.

### E. Vendor / Supplier / Service‑Provider master *(quotation 602 · invoice 1,127)*
A proper company‑level **Vendor & Supplier directory** with category (equipment, fixer, charter, insurance, hotel, HR e.g. MASADER, catering, transport) and their named contacts — so quotations and invoices attach to a known supplier. People with names → Contact; companies → Supplier/Vendor master.

### F. Lightweight contact‑CRM / email intake at master level
8,349 emails prove **email is the real system of record.** A master **Contact** directory (which you have) plus: a `source` field, `lastContactedAt`, a link from contact → company, and the **`.msg`/email intake** you built for Locations generalised to file correspondence + attachments against any contact/vendor/client. Optional auto‑classification on intake.

### What's already validated by the data (no action — confirms the build)
Location (2,357) → Master Location Library ✅ · permit/NOC (1,041/327) → typed permits ✅ · security (650) → Security tab ✅ · insurance (303) → compliance gate ✅ · risk/method statement (195) → Risk + HSE ✅ · budget/invoice (1,127/535) → Finance ✅ · rebate (70) → incentives ✅.

---

## 5. New fields & relationships (smaller, immediate)

- **Contact:** `source` (e.g. "email‑import"), `lastContactedAt`, `linkedCompanyId` (→ Client/Supplier/Vendor), `secondaryEmails[]`, `secondaryPhones[]`.
- **Company unification:** a light `Organization` view/type over Client/Supplier/Vendor so a production house (Image Nation/Breakout) can be tagged **Partner** without forcing it into "Client" or "Supplier".
- **Crew:** recruitment `applicationStatus` (Applied/Shortlisted/Hired/Rejected) + `appliedFor` role; **visa/passport expiry** already present → add to the expiry‑reminder digest.
- **Automations:** expiry reminders for crew visa/passport/insurance + contracts (reuse the daily digest); auto‑file inbound `.msg` to the matching contact/company.

---

## 6. Recommended next steps

1. **Refine + re‑run the dry run.** I updated the classifier (production‑company → Partner/Client; tighter name matching). Re‑run `node tools/analyze-emails.js "C:\emails"` and re‑open `contacts.csv`.
2. **Review `contacts.csv`** — trust email‑matched enrichments; eyeball name‑only matches.
3. **`--apply`** to commit the master‑level enrich/create (crew → CrewMember; everyone else → Contact with the right type).
4. Tell me which of §4 A–F to build first — my recommendation is **A (Travel/Visa/Logistics)**, then **C (applications pipeline)**, then **B (Contracts)**.

---

*Sources: [Image Nation Abu Dhabi (Wikipedia)](https://en.wikipedia.org/wiki/Image_Nation_Abu_Dhabi) · [Breakout Films](https://breakoutfilms.com/) · [NEEDaFIXER](https://www.needafixer.com/filming-in-dubai/) · [Electric Films](https://electricfilms.ae/). Raw data: `report.md`, `contacts.csv`, `digest.json`, `actions.json` in this folder.*
